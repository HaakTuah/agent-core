// Where a project's run of each of the core's checks finds its config (#366, #368, #386), read as the check is run, for
// the steps and the comparison with a fresh start (steps.mjs and fresh.mjs, beside this file): from the project's calls
// to the core's workflows (their `with:`), from the steps of its own workflows and of the local actions they use that
// run a script of its copy of the core with `node`, and, where neither runs the check, from the manifest's slot, else
// the starter kit's path. Every source is read, never only the first: where two give different files, or one names its
// file only when the workflow runs, or a script is run from a file the reader does not run (a shell script, a Makefile,
// a package's scripts), the config is not read (Unread), said with why, and compared nowhere, never read as a path no
// check is given. One check's config not read leaves every other's read. Node's own modules only.
import path from "node:path";
import { CORE } from "./core-address.mjs";
import { corePath } from "./core-path.mjs";
import { parseYaml } from "./workflow-run.mjs";

// A config, or a workflow, the reader cannot read: a step that would need it throws this, naming why, so the step is
// reported as not read, never as done or as missing.
export class Unread extends Error {}
// (`mentions` says, from a workflow's text, whether the check would read it)
export const readable = (p, mentions) => {
  const unread = Object.entries(p.workflows).filter(([, w]) => !w.yaml && mentions(w.text ?? "")).map(([f]) => `.github/workflows/${f}`);
  if (unread.length) throw new Unread(`the core's reader cannot read ${unread.join(", ")}, in a form it does not know`);
};

// A project's calls to a workflow of the core's, by the workflow's name: each as [where, job] (its file and its job,
// with uses and with); `calls` the jobs alone, and `call` the first.
const calling = (p, name) => (readable(p, text => text.toLowerCase().includes(`/.github/workflows/${name}@`.toLowerCase())), Object.entries(p.workflows))
  .flatMap(([f, { yaml }]) => Object.values(yaml?.jobs ?? {}).map(job => [`.github/workflows/${f}`, job]))
  .filter(([, job]) => typeof job?.uses === "string" && job.uses.toLowerCase().startsWith(`${CORE}/.github/workflows/${name}@`.toLowerCase()));
export const calls = (p, name) => calling(p, name).map(([, job]) => job);
export const call = (p, name) => calls(p, name)[0] ?? null;

// What each call to the core's workflow `name` passes as its input `key`, as { where, value }: undefined where it passes
// none. One that names it only when the workflow runs (an expression) throws, so the check that needs it is not read.
export function given(p, name, key) {
  return calling(p, name).map(([where, job]) => {
    const value = job.with?.[key];
    if (typeof value === "string" && value.includes("${{")) throw new Unread(`${where} passes the core's ${name} its ${key} as ${value}, which names it only when the workflow runs`);
    return { where, value };
  });
}
// The files the calls pass as `key`, an input the workflow requires: a call that passes none, or no text, is not read.
const passed = (p, name, key = "config") => given(p, name, key).map(({ where, value }) => {
  if (typeof value !== "string" || !value.trim()) throw new Unread(`${where} calls the core's ${name} with no ${key} that names a file`);
  return { where, value: inside(value, `${where}'s call to the core's ${name}`) };
});
// A path as the project's root reads it: "./" and a slash at its end left out, and any "." or ".." in it taken.
const tidy = f => path.posix.normalize(trimSlashes(f)).replace(/^\.\//u, "");
// A path with the "/" at its end left out, walked back over (no regex, so no run of "/" makes it slow).
function trimSlashes(f) {
  let end = f.length;
  while (end > 0 && f[end - 1] === "/") end--;
  return f.slice(0, end);
}
// A file a call or a config names, as a path from the root: one that leads out of the project, starts at the
// machine's root, or is spelled for Windows, is no file of the project's, and not read.
// (the core's workflows run on Linux, where a "\\" is part of a file's name, and a drive letter names no file of the
// project's: either is not read)
const inside = (f, what) => {
  if (/\\|^[A-Za-z]:/u.test(f)) throw new Unread(`${what} names ${f}, a path spelled for Windows, which the check reads as no file of the project's`);
  const at = tidy(f);
  if (at === ".." || at.startsWith("../") || at.startsWith("/")) throw new Unread(`${what} names ${f}, outside the project`);
  return at;
};

// The copy's folder, from the manifest (core-path.mjs), "core/" where it names none.
const copyOf = p => { try { return (p.root && corePath(p.root)) || "core/"; } catch { return "core/"; } };

// A shell's line without its comment: a "#" that starts a word, outside quotes and outside an expression of GitHub's.
function uncommented(line) {
  for (let i = 0, quote = ""; i < line.length; i++) {
    const c = line[i];
    if (quote === "'") { if (c === "'") quote = ""; }
    else if (quote === '"') { if (c === "\\") i++; else if (c === '"') quote = ""; }
    else if (line.startsWith("${{", i)) { const end = line.indexOf("}}", i); if (end < 0) break; i = end + 1; }
    else if (c === "\\") i++;
    else if (c === "'" || c === '"') quote = c;
    else if (c === "#" && (i === 0 || /\s/u.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

// The commands of a step's `run:`, each a list of its words as { text, dynamic }, quotes taken off, as a shell reads
// them: a line continued by "\" joined to the next, a comment left out, commands parted by a line's end, ; & | ( or ).
// A word is dynamic where a variable, a command's output or an expression of GitHub's in it is filled only when the
// workflow runs. A "\" between two letters of a path is read as "/", a folder's parting on Windows. A here-document's
// lines are data the command reads, never commands.
export function commands(run) {
  const text = withoutHereDocuments(run.split(/\r?\n/u).map(uncommented)).join("\n").replace(/\\\n/gu, " ");
  const out = [];
  let words = [], word = null, operand = false; // (operand: the next word is a redirection's file, no argument)
  const add = (s, dynamic = false) => { word ??= { text: "", dynamic: false }; word.text += s; word.dynamic ||= dynamic; };
  const close = () => { if (word && !operand) words.push(word); if (word) operand = false; word = null; };
  const end = () => { close(); operand = false; if (words.length) out.push(words); words = []; };
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(" && word && "?*+@!".includes(text[i - 1])) i = extglob(text, i, add); // (?(…), @(…): a glob of bash's)
    else if (text.startsWith("&>", i) || "<>".includes(text[i])) i = redirection(text, i, () => { if (!/^(?:\d+|\{\w+\})$/u.test(word?.text ?? "")) close(); word = null; operand = true; });
    else if ("\n;&|()".includes(text[i])) end();
    else if (" \t".includes(text[i])) close();
    else i = part(text, i, add);
  }
  end();
  for (const ws of out) for (const w of ws) w.dynamic ||= /%\w+%/u.test(w.text);
  return out;
}
// A redirection at `i` (>, >>, >|, <, 2>, &>, >&2, <<EOF …): `opens` is told, so the word it is written against, a file
// descriptor's number or name ({fd}), is no argument and the word after it is its file; it returns where its operator ends.
function redirection(text, i, opens) {
  opens();
  let j = i + (text[i] === "&" ? 1 : 0);
  while ("<>".includes(text[j + 1] ?? "x")) j++;
  return "&|".includes(text[j + 1] ?? "x") ? j + 1 : j; // (>&2, and >| that writes over a file)
}
// The lines of a step with each here-document's lines left out (`<<EOF` up to the line that holds "EOF" alone); where
// no such line follows, none is left out.
function withoutHereDocuments(lines) {
  const skipped = new Set(hereDocuments(lines).flatMap(({ opens, body }) => body.map((_, k) => opens + 1 + k)));
  return lines.filter((_, k) => !skipped.has(k));
}
// Each here-document of a step's lines, as { opens, body }: the line that opens it and the lines it holds.
function hereDocuments(lines) {
  const found = [], at = new Map(); // (each line's text, trimmed, with the lines it stands on, in order: read once)
  lines.forEach((l, k) => { const t = l.trim(); if (!at.has(t)) at.set(t, []); at.get(t).push(k); });
  for (let n = 0; n < lines.length; n++) {
    const end = hereDocument(lines[n]), last = end ? next(at.get(end) ?? [], n) : -1;
    if (last > n) { found.push({ opens: n, body: lines.slice(n + 1, last) }); n = last - 1; }
  }
  return found;
}
// The first of the sorted line numbers `list` past `n`, or -1.
function next(list, n) {
  let low = 0, high = list.length;
  while (low < high) { const mid = (low + high) >> 1; if (list[mid] <= n) low = mid + 1; else high = mid; }
  return low < list.length ? list[low] : -1;
}
// The word that ends a here-document a line opens: a `<<` outside quotes and arithmetic, never `<<<`, then the word,
// quoted, after a "\\" or bare, starting with a letter or "_"; null where it opens none.
function hereDocument(line) {
  const closes = line.lastIndexOf("))"); // (so that a "((" with none after it is passed in one step)
  for (let i = 0, quote = ""; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === "\\" && quote === '"') i++; else if (c === quote) quote = ""; }
    else if (line.startsWith("((", i)) { if (closes > i) i = line.indexOf("))", i + 2) + 1; } // (with no "))" after it, two subshells)
    else if (c === "'" || c === '"') quote = c;
    else if (c === "\\") i++;
    else if (line.startsWith("<<<", i)) i += 2;
    else if (line.startsWith("<<", i)) {
      const at = /^<<-?[ \t]*(?:\\|(['"]))?([A-Za-z_][\w.-]*)\1/u.exec(line.slice(i));
      if (at) return at[2];
      i++;
    }
  }
  return null;
}
// An extended glob's (…), at `i`, to its closing ")" on that line: added to the word, filled when it runs (a glob that
// may match); it returns where it ends.
function extglob(text, i, add) {
  let depth = 0, j = i;
  for (; j < text.length && text[j] !== "\n"; j++) { if (text[j] === "(") depth++; else if (text[j] === ")" && --depth === 0) break; }
  add(text.slice(i, Math.min(j + 1, text.length)), true);
  return Math.min(j, text.length - 1);
}
// One part of a word, at `i`: given to `add` as what it spells, and whether it is filled only when the workflow runs;
// it returns where the part ends.
const expressionEnd = (text, i) => { const e = text.indexOf("}}", i); return e < 0 ? text.length : e + 2; };
function part(text, i, add) {
  const c = text[i];
  if (text.startsWith("${{", i)) { const j = expressionEnd(text, i); add(text.slice(i, j), true); return j - 1; }
  // (GitHub fills its expressions before the shell runs, single quotes or not)
  if (c === "'") { const e = text.indexOf("'", i + 1), j = e < 0 ? text.length : e; add(text.slice(i + 1, j), text.slice(i + 1, j).includes("${{")); return j; }
  if (c === '"') return doubleQuoted(text, i, add);
  if (c === "\\") { const next = text[i + 1] ?? ""; add(/[\w.-]/u.test(next) && /[\w.-]/u.test(text[i - 1] ?? "") ? `\\${next}` : next); return i + 1; }
  add(c, "$`{*?[".includes(c)); // (an unquoted "{", "*", "?" or "[" may be expanded, {a,b} or a glob, when it runs)
  return i;
}
function doubleQuoted(text, i, add) {
  let j = i + 1;
  for (; j < text.length && text[j] !== '"'; j++) {
    if (text.startsWith("${{", j)) { const k = expressionEnd(text, j); add(text.slice(j, k), true); j = k - 1; }
    else if (text[j] === "\\" && /["\\$`]/u.test(text[j + 1] ?? "")) add(text[++j]);
    else add(text[j], text[j] === "$" || text[j] === "`");
  }
  return j;
}

// The root of the checkout as a workflow names it, at a path's start: read as the project's root.
const ROOT = /^(?:\$GITHUB_WORKSPACE|\$\{GITHUB_WORKSPACE\}|\$\{\{\s*github\.workspace\s*\}\}|\$env:GITHUB_WORKSPACE|%GITHUB_WORKSPACE%)\//u;
// A word as a path from the project's root, run in the folder `dir` (from the root): { at } where it is known, at null
// where it leads out of the project; { dynamic } where it is named only when the workflow runs; { windows } where it
// holds a "\\", a folder's parting on Windows and part of a file's name on Linux, so no one file.
function located(word, dir) {
  if (word.text.includes("\\")) return { windows: true };
  // (the root's name is filled only where the word lets the shell fill it: in single quotes it is text)
  const text = word.text, rooted = word.dynamic && ROOT.test(text), rest = rooted ? text.replace(ROOT, "") : text;
  if (word.dynamic && /\$|`|%\w+%|[{*?[(]/u.test(rest)) return { dynamic: true }; // (a variable, braces or a glob, an extended one too)
  if (!rooted && rest.startsWith("/")) return { at: null };
  const at = path.posix.normalize(rooted ? rest : path.posix.join(dir, rest));
  return { at: at === ".." || at.startsWith("../") ? null : at.replace(/^\.\//u, "") };
}
const NODE = /(?:^|\/)node(?:\.exe)?$/iu;
const WRAPPERS = new Set(["env", "exec", "time", "command", "nohup", "sudo"]);
// The shell's words that start a command's place without being one (if …; then node …), passed over as wrappers are.
const KEYWORDS = new Set(["if", "then", "else", "elif", "do", "while", "until", "!", "{"]);
// A shell given its commands as one word (`bash -c "…"`), whose commands are read as the step's own.
const SHELL = /^(?:.*\/)?(?:(?:ba|z|da)?sh|pwsh|powershell)(?:\.exe)?$/iu;
// Node's options that take the next word as their value, so that it is no script.
const VALUED = new Set(["-r", "--require", "--import", "--loader", "--experimental-loader", "-C", "--conditions", "--env-file", "--title", "--input-type"]);
const CHDIR = /^(?:cd|pushd|popd|chdir|set-location|sl|push-location|pop-location)$/iu;

// The word a command runs with node, by its index ({ at }), past what goes before node (a variable set, env, exec)
// and node's own options; { moves } where the command changes the folder; { inner }, the commands a shell is given as
// one word; {} where it runs nothing with node.
function nodeRuns(words) {
  let i = pastWrappers(words);
  if (i < words.length && CHDIR.test(words[i].text)) return { moves: true };
  if (i < words.length && SHELL.test(words[i].text)) return inline(words, i);
  if (i >= words.length || !NODE.test(words[i].text)) return {};
  const shifted = words.slice(0, i).some(w => CHDIR_OPTION.test(w.text)); // (env --chdir=app node …: another folder)
  for (i++; i < words.length && words[i].text.startsWith("-"); i++) if (VALUED.has(words[i].text)) i++;
  return { at: i, shifted };
}
// Where a command's own word starts: past the variables it sets and its wrappers, with their options (sudo -E -H, env
// -i); an option's value (sudo -u bot) it cannot tell from the command, and runsIn says so.
function pastWrappers(words) {
  let i = 0;
  while (i < words.length && (/^\w+=/u.test(words[i].text) || WRAPPERS.has(words[i].text) || KEYWORDS.has(words[i].text))) {
    const wrapper = WRAPPERS.has(words[i].text);
    for (i++; wrapper && words[i]?.text.startsWith("-"); i++);
  }
  return i;
}
// The commands a shell at word `i` is given as one word, in its plain forms only, as { inner, filled, elsewhere }
// (elsewhere: run in another folder); {} where the reader finds none, and then a naming of the script in the line is
// said not read (unaccounted), never passed over. sh: its options before the string, one of them holding c (-c, -ec,
// -ce), -o and a cluster ending in o taking a value.
function inline(words, i) {
  if (/pwsh|powershell/iu.test(words[i].text)) return powershell(words, i);
  let c = false, k = i + 1;
  for (; k < words.length && /^[-+]/u.test(words[k].text); k++) {
    if (/^-[a-zA-Z]*c[a-zA-Z]*$/u.test(words[k].text)) c = true;
    if (/^[-+][a-zA-Z]*[oO]$/u.test(words[k].text)) k++;
  }
  return c && k < words.length ? { inner: words[k].text, filled: words[k].dynamic } : {};
}
// PowerShell's: -Command (or a prefix down to -c) and -CommandWithArgs (-cwa) give it; a word with a blank and no
// option before it is the command (Windows PowerShell's default); -File (or a prefix) gives a file; -WorkingDirectory
// (-wd) runs it elsewhere; another option takes the next word where that holds no blank and is no option.
function powershell(words, i) {
  let elsewhere = false;
  for (let k = i + 1; k < words.length; k++) {
    const t = words[k].text, next = words[k + 1];
    if (/^-(?:c|co|com|comm|comma|comman|command|commandwithargs|cwa)$/iu.test(t)) return next ? { inner: next.text, filled: next.dynamic, elsewhere } : {};
    if (/^-f(?:i(?:le?)?)?$/iu.test(t)) return {};
    if (!t.startsWith("-")) return /\s/u.test(t) ? { inner: t, filled: words[k].dynamic, elsewhere } : {};
    if (/^-(?:wd|wo\w*)$/iu.test(t)) elsewhere = true;
    if (next && !next.text.startsWith("-") && !/\s/u.test(next.text)) k++;
  }
  return {};
}
// How each script picks its config from its arguments, as it reads them: the first that does not start with "--"; of
// the reading-size and exact-versions checks, the first whatever it is; of the NuGet check, never the value of its
// "--packages", and none where it is run "--projects" or "--imports", which list files and read no config.
const PICKS = { "reading-size.mjs": { first: true }, "exact-versions.mjs": { first: true }, "nuget.mjs": { valued: ["--packages"], none: ["--projects", "--imports"] } };
// The config a run passes the script at word `i`, as that script picks it (PICKS), as { config }, a path from the
// root; { unread } with why it cannot be known; { none } where the run reads no config.
function configAfter(words, i, dir, script) {
  const pick = PICKS[path.posix.basename(script)] ?? {}, args = words.slice(i + 1);
  if (args.some(a => pick.none?.includes(a.text))) return { none: true };
  const k = pick.first ? 0 : args.findIndex((a, n) => !a.text.startsWith("--") && !(n > 0 && pick.valued?.includes(args[n - 1].text)));
  const arg = k < 0 ? words.length : i + 1 + k;
  if (arg >= words.length) return { unread: `runs ${script} with no config` };
  const config = located(words[arg], dir.at);
  if (config.windows) return { unread: `passes ${script} its config as ${words[arg].text}, a path with "\\" that Linux and Windows read as different files` };
  if (config.dynamic) return { unread: `passes ${script} its config as ${words[arg].text}, which names it only when the workflow runs` };
  return config.at === null ? { unread: `passes ${script} its config as ${words[arg].text}, outside the project` } : { config: config.at };
}
// Where a step names the copy's script more often than the reader accounts for, a run that cannot be known (never
// one that is not there), as [{ unread, unsure }]; else []. Each naming of it by its path is accounted for by a run the
// reader read (a config, or one it says it cannot place), or by a line that is one command that runs no script, alone
// (echo, cp, git: NO_RUNNER, with no pipe, redirection, here-document or second command); any other, in whatever form
// of the shell's (timeout 60s node …, cat <<EOF | bash, pwsh -c node …), leaves the step's run of it not read.
function unaccounted(run, script, runs, given = 0) {
  let named = given, text = 0;
  for (const line of run.split(/\r?\n/u).map(uncommented).join("\n").replace(/\\\n/gu, " ").split("\n")) {
    const k = lineNamings(line, path.posix.basename(script));
    named += k;
    if (k && lone(line)) text += k;
  }
  if (runs.some(r => r.unsure)) return []; // (the step is not read already)
  return named > runs.filter(r => !r.unsure).length + text ? [{ unread: `names ${script} in a way the reader does not follow`, unsure: true }] : [];
}
// Whether a line is one command that runs no script, and nothing more.
const lone = line => {
  // (an operator outside quotes; a command's output, $(…) or `…`, or a variable set in passing, ${S:=…}, anywhere,
  // since double quotes run them too; printf -v, which sets a variable, and curl writing a file)
  if (/`|\$\(|\$\{(?!\{)/u.test(line) || /[|;&<>]/u.test(unquoted(line))) return false;
  if (/^\s*printf\s+-v\b/u.test(line) || /^\s*curl\b.*\s(?:-[a-zA-Z]*[oOK]|--output|--remote-name|--config)\b/u.test(line)) return false;
  const [words = [], more] = commands(line);
  return !more && NO_RUNNER.has(path.posix.basename(words[pastWrappers(words)]?.text ?? "").toLowerCase());
};
// How often a line names a script of that name, its quotes taken out and a "\\" read both as "/" and as nothing, as
// Windows and a shell read it.
function lineNamings(line, name) {
  const bare = line.replace(/['"]/gu, "");
  return Math.max(namings(plainPath(bare), name), namings(plainPath(bare.replace(/\\/gu, "")), name));
}
// A text with "\\" read as "/" and "/./" and "//" made one "/", so a path spelled any of those ways reads as one.
const plainPath = text => text.replace(/\\/gu, "/").replace(/\/(?:\.?\/)+/gu, "/");
// A line with what its quotes hold left out, read in one pass.
function unquoted(line) {
  let out = "", quote = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === "\\" && quote === '"') i++; else if (c === quote) quote = ""; }
    else if (c === "'" || c === '"') quote = c;
    else out += c;
  }
  return out;
}
// How often a text names a script of that name, `scripts/<name>`, as the reader matches a run's script (runAt), the
// text's quotes taken out first: whatever stands before it (a path, a variable's or the root's name, another folder
// whose name ends in scripts), so that no naming of the copy's escapes the count; one of another file is then not
// read, never a run hidden (one pass of indexOf, so no text makes it slow).
function namings(text, name) {
  const of = `scripts/${name}`.toLowerCase(), lower = text.toLowerCase();
  let n = 0;
  for (let at = lower.indexOf(of); at >= 0; at = lower.indexOf(of, at + 1)) if (!/[\w.-]/u.test(lower[at + of.length] ?? "")) n++;
  return n;
}
// (env's and sudo's options that run the command in another folder: env -C app, --chdir=app, sudo -D app)
const CHDIR_OPTION = /^(?:-C|-D|--chdir(?:=.*)?|--working-directory(?:=.*)?)$/u;
const NO_RUNNER = new Set(["sha256sum", "sha1sum", "md5sum", "shasum", "jq", "curl", "write-host", "write-output", "echo", "printf", "rm", "chmod", "chown", "cat", "head", "tail", "ls", "test", "[", "grep", "touch", "mkdir", "tee", "wc", "diff", "stat", "readlink", "realpath", "basename", "dirname", "which", "type", "true", "false", ":", "unset", "cd"]);
// The runs read inside a shell's command string, each not read where the outer shell fills the string when it runs
// (`bash -c "node … '$CONFIG'"`: the inner quotes keep nothing from it).
const within = (runs, filled, script) => (filled ? runs.map(() => ({ unread: `runs ${script} in a command string the workflow fills only when it runs`, unsure: true })) : runs);
// Where a step's `run:`, in the folder `dir`, runs `script` (a path from the root, "core/scripts/copies.mjs") with
// node: each as configAfter gives it.
function runsIn(run, dir, script) {
  const found = [];
  let moved = false;
  for (const words of commands(run)) {
    const { moves, inner, filled, elsewhere, shifted, at: i } = nodeRuns(words);
    moved ||= !!moves;
    if (inner !== undefined) found.push(...within(runsIn(inner, moved || elsewhere ? { dynamic: true } : dir, script), filled, script));
    else found.push(...runAt(words, i, moved || shifted ? { dynamic: true, moved: true } : dir, script));
  }
  return found;
}
// The run of a command whose node is given the word at `i`, as runsIn gives it: where that word is no script of the
// copy's, nothing (unaccounted says so where it names the copy's); after a cd, or in a folder named only when it runs, which
// copy it runs cannot be known.
function runAt(words, i, dir, script) {
  const word = words[i];
  if (!word) return [];
  const name = path.posix.basename(script).toLowerCase(), at = located(word, dir.dynamic ? "." : dir.at);
  if (at.dynamic || at.windows || /[{*?[(]|\$'/u.test(word.text.replace(ROOT, ""))) return unplaced(word, dir, name, script);
  if (path.posix.basename(plainPath(word.text)).toLowerCase() !== name) return []; // (another script)
  if (dir.moved) return [{ unread: `runs ${word.text} after a command that changes its folder`, unsure: true }];
  if (dir.dynamic) return [{ unread: `runs ${word.text} in a folder named only when the workflow runs`, unsure: true }];
  // (only the copy's own path, letter for letter, is read; any other file of that name, in any case, is not: a runner
  // that ignores case may run the copy by it)
  return at.at === script ? [configAfter(words, i, dir, script)] : [{ unread: `runs ${word.text}, a file of the name of ${script} that the reader cannot tell from it`, unsure: true }];
}
const literal = x => !/[$`'"\\]/u.test(x);
// A run whose own name, and folder, are globs or braces and hold no variable, matched against the script's: one that
// cannot match it (*.test.mjs, test/**) is no run of it, one that can (copies.mj?, * under core/scripts) is not read.
function globbed(word, dir, folder, own, name, script) {
  if (!globMatches(own, name)) return [];
  if (!dir.moved && !dir.dynamic) {
    const where = folder === null ? dir.at : path.posix.join(dir.at, folder);
    if (literal(where) && !globMatches(where, path.posix.dirname(script))) return [];
  }
  return [{ unread: `runs ${word.text}, a script named only when the workflow runs`, unsure: true }];
}
// Whether a glob can match a name, case left aside. Only a plain one (letters, "*", "?") is ever told no: braces,
// "**" or a class ("[…]", in any form) may match. "*" stands for any run, "/" included, so the answer errs to "may",
// never "no" where one is (one pass of two pointers, so no glob makes it slow).
function globMatches(glob, name) {
  // (what stands before its first wildcard must begin the name, whatever follows: test/** never matches core/scripts)
  const lead = /^(?:[^*?[{(+@!]|[+@!](?!\())*/u.exec(glob)[0].toLowerCase();
  if (!name.toLowerCase().startsWith(lead)) return false;
  if (/[{}[\]()]|\*\*/u.test(glob)) return true; // (braces, a class, an extended glob's (…) or ** may match: none is read)
  const g = glob.toLowerCase(), s = name.toLowerCase();
  let i = 0, j = 0, star = -1, from = 0;
  while (j < s.length) {
    if (i < g.length && (g[i] === "?" || g[i] === s[j])) { i++; j++; }
    else if (i < g.length && g[i] === "*") { star = i++; from = j; }
    else if (star >= 0) { i = star + 1; j = ++from; }
    else return false;
  }
  while (g[i] === "*") i++;
  return i === g.length;
}
// A run whose script is named only when the workflow runs (a variable, an expression of GitHub's, braces, a glob,
// $'…', a "\\"): no run of this script where its folder plainly is no folder scripts (node --test tests/*.mjs) or its
// own name plainly is another's (node ${{ github.action_path }}/index.js); else, where it looks like one of the
// core's (a .mjs file, a folder scripts or core, an expression), not read; one given by a variable alone (node --test
// $RUN) is counted where the step names the path it holds (unaccounted).
function unplaced(word, dir, name, script) {
  const plain = x => !/[$`{}\\'"*?[()]/u.test(x), text = trimSlashes(word.text.replace(ROOT, ""));
  const cut = text.lastIndexOf("/"), folder = cut < 0 ? null : text.slice(0, cut), own = text.slice(cut + 1);
  if (!dir.moved && !dir.dynamic && folder !== null && plain(folder) && !/(?:^|\/)scripts$/iu.test(path.posix.join(dir.at, folder))) return [];
  if (plain(own) && own.toLowerCase() !== name) return [];
  if (literal(own)) return globbed(word, dir, folder, own, name, script);
  return /\.mjs\b|scripts|\bcore\b|\$\{?CORE|\$\{\{/iu.test(text) ? [{ unread: `runs ${word.text}, a script named only when the workflow runs`, unsure: true }] : [];
}

// A step's folder, from the root: its own `working-directory`, else its job's or its workflow's default.
// (one that is no text, or names itself only when the workflow runs, cannot be known)
const folder = (...dirs) => {
  const d = dirs.find(v => v !== undefined && v !== null);
  if (d === undefined) return { at: "." };
  if (typeof d !== "string") return { dynamic: true };
  const text = d;
  // (one named only when the workflow runs, or holding a "\\", which Linux and Windows read as different folders)
  if (/\$|\\/u.test(text)) return { dynamic: true };
  const at = path.posix.normalize(text.replace(ROOT, "")).replace(/(.)\/+$/u, "$1"); // (core/scripts/ is core/scripts)
  return at === ".." || at.startsWith("../") || at.startsWith("/") ? { dynamic: true } : { at };
};

// Each step the project runs from its workflows, and from the local actions (`uses: ./…`) they use, as
// { where, from, run, dir }: the file it stands in, the workflow that runs it, its `run:` and its folder (an action's
// steps run from the root, save where one names its own); an action the reader cannot read as { where, from,
// unreadable }, its text.
const ACTION_DEPTH = 20, STEP_MOST = 20000;
const STEPS_OF = new WeakMap(); // (each project's steps read once, however many checks ask)
// What a step is given beside its run: its env:, its job's and its workflow's, its job's matrix, so that a script named
// there is counted as named (unaccounted). Each mapping is read once, its text values (at any depth, a mapping or a
// list held as text only by its values) counted by name once, however many steps and checks ask.
const GIVEN = new WeakMap();
const WRAP = Symbol("given"); // (a list of what a step is given, made here; a matrix's list is none)
const wrap = (...items) => Object.assign(items, { [WRAP]: true });
const WRAPPED = new WeakMap(); // (each wrapper's count by name, its parts counted once each)
function givenNamings(objects, name) {
  let n = 0;
  for (const o of objects) {
    if (!o || typeof o !== "object") continue;
    if (o[WRAP]) {
      if (!WRAPPED.has(o)) WRAPPED.set(o, new Map());
      const counts = WRAPPED.get(o);
      if (!counts.has(name)) counts.set(name, givenNamings(o, name));
      n += counts.get(name);
      continue;
    }
    if (!GIVEN.has(o)) { const lines = leaves(o); GIVEN.set(o, { lines, whole: lines.whole, counts: new Map() }); }
    const memo = GIVEN.get(o);
    // (a mapping too deep or too large to read whole counts as naming the script, so the step is not read)
    if (!memo.counts.has(name)) memo.counts.set(name, memo.whole ? memo.lines.reduce((k, l) => k + lineNamings(l, name), 0) : 1);
    n += memo.counts.get(name);
  }
  return n;
}
// The text values a mapping or a list holds, at any depth, `whole` false where a bound (depth, count) stopped it.
function leaves(o, depth = 0, out = Object.assign([], { whole: true })) {
  if (depth > 50 || out.length >= 1e5) { out.whole = false; return out; }
  for (const v of Array.isArray(o) ? o : Object.values(o)) {
    if (out.length >= 1e5) { out.whole = false; break; }
    if (typeof v === "string") out.push(v);
    else if (typeof v === "number" || typeof v === "boolean") out.push(`${v}`);
    else if (v && typeof v === "object") leaves(v, depth + 1, out);
  }
  return out;
}
function steps(p) {
  if (STEPS_OF.has(p)) return STEPS_OF.get(p);
  const out = [], parsed = new Map();
  let full = false, calls = 0;
  // (each action's file read and parsed once; an action is read at each call, with what that call gives it, its
  // caller's env: and with: and what the caller is given, as one shared list; never within itself, no deeper than
  // ACTION_DEPTH, and past STEP_MOST steps or calls in all, the rest is said not read)
  const actionFile = at => {
    if (!parsed.has(at)) {
      let found = null;
      for (const f of [`${at}/action.yml`, `${at}/action.yaml`]) {
        const text = p.read(f);
        if (text === null) continue;
        let yaml = null;
        try { yaml = parseYaml(text); } catch { /* (below) */ }
        found = { f, yaml, text };
        break;
      }
      parsed.set(at, found);
    }
    return parsed.get(at);
  };
  const tooMany = (where, from) => { if (!full) out.push({ where, from, tooMany: true }); full = true; };
  const action = (uses, from, envs, chain) => {
    const at = tidy(uses);
    if (chain.includes(at)) return;
    if (chain.length >= ACTION_DEPTH || ++calls > STEP_MOST) return tooMany(at, from);
    const found = actionFile(at);
    if (!found) return;
    if (!found.yaml) { out.push({ where: found.f, from, unreadable: found.text }); return; }
    walk(found.f, from, found.yaml.runs?.steps ?? [], step => folder(step["working-directory"]), envs, [...chain, at]);
  };
  const walk = (where, from, list, dirOf, envs = [], chain = []) => {
    for (const step of Array.isArray(list) ? list : []) {
      if (out.length >= STEP_MOST) return tooMany(where, from);
      if (typeof step?.run === "string") out.push({ where, from, run: step.run, dir: dirOf(step), given: wrap(step?.env, envs) });
      if (typeof step?.uses === "string" && step.uses.startsWith("./")) action(step.uses, from, wrap(step?.env, step?.with, envs), chain);
    }
  };
  for (const [f, w] of Object.entries(p.workflows)) {
    const where = `.github/workflows/${f}`;
    if (!w.yaml) continue;
    for (const job of Object.values(w.yaml.jobs ?? {})) {
      walk(where, where, job?.steps, step => folder(step["working-directory"], job?.defaults?.run?.["working-directory"], w.yaml.defaults?.run?.["working-directory"]), wrap(job?.env, w.yaml.env, job?.strategy));
      // (a call to a workflow of the project's own: what it passes is read as the callee's steps would be given it)
      if (typeof job?.uses === "string" && job.uses.startsWith("./")) out.push({ where, from: where, run: "", dir: { at: "." }, given: [job.with, job.strategy] });
    }
  }
  STEPS_OF.set(p, out);
  return out;
}

// The project's own runs of a script of its copy (`name`, "copies.mjs"), each as { where, from, config } or { where,
// from, unread }: the file the step stands in and the workflow that runs it.
export function runsOwn(p, name) {
  readable(p, text => text.includes(name));
  const script = `${copyOf(p)}scripts/${name}`;
  return steps(p).flatMap(s => {
    if (s.tooMany) return [{ where: s.where, from: s.from, unread: `the project's workflows and actions hold more steps, or actions calling each other more deeply, than the reader follows`, unsure: true }];
    if (s.unreadable !== undefined) return s.unreadable.includes(name) ? [{ where: s.where, from: s.from, unread: `the core's reader cannot read ${s.where}, in a form it does not know`, unsure: true }] : [];
    const runs = runsIn(s.run, s.dir, script);
    return [...runs, ...unaccounted(s.run, script, runs, givenNamings(s.given ?? [], name))].map(r => ({ where: s.where, from: s.from, ...r }));
  });
}
// The workflows of the project's own that run the script, themselves or through an action they use, once each; where
// one may run it or another (`unsure`: after a cd, by a path named only when it runs, …), not read, so a step that asks
// whether a check runs beside another is never told it does on a guess.
export const runFiles = (p, name) => runsOwn(p, name).map(r => {
  if (r.unsure) throw new Unread(`${r.where} ${r.unread}`);
  return r.from;
}).filter((f, k, all) => all.indexOf(f) === k);
const fromRuns = (p, name) => runsOwn(p, name).filter(r => !r.none).map(r => {
  if (r.unread) throw new Unread(`${r.where} ${r.unread}`);
  return { where: r.where, value: r.config };
});

// The files a project runs some other way, which name a script of its copy: a shell script, a Makefile, a package's
// scripts. The reader does not run them, so a check run from one alone is not read, never read at the slot's path.
const OTHER_RUNNERS = /(?:^|\/)(?:[^/]+\.(?:sh|bash|zsh|ps1|psm1|cmd|bat|mk)|Makefile|GNUmakefile|makefile|justfile|package\.json)$/u;
function namedElsewhere(p, names) {
  const at = copyOf(p);
  const own = (p.files ?? []).filter(f => OTHER_RUNNERS.test(f) && !f.startsWith(at) && !f.split("/").includes("node_modules"));
  const of = new RegExp(`(?:^|[^\\w.-])(?:\\./)?${at.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&").replace(/\//gu, "[\\\\/]")}scripts[\\\\/](?:${names.map(n => n.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")).join("|")})(?![\\w.-])`, "u");
  return own.filter(f => {
    const text = p.read(f) ?? "";
    if (!f.endsWith("package.json")) return of.test(text);
    try { return Object.values(JSON.parse(text)?.scripts ?? {}).some(s => typeof s === "string" && of.test(s)); } catch { return of.test(text); }
  });
}
const notElsewhere = (p, names) => {
  const named = namedElsewhere(p, names);
  if (named.length) throw new Unread(`${named.join(", ")} ${named.length > 1 ? "name" : "names"} ${names.map(n => `${copyOf(p)}scripts/${n}`).join(" or ")}, run from a file the core's reader does not run`);
};

// The one file the sources give, undefined where none gives one; where they give different files, not read.
function one(found, what) {
  const files = [...new Set(found.map(f => f.value))];
  if (files.length > 1) throw new Unread(`${what} is given as ${found.map(f => `${f.value} (${f.where})`).join(", ")}, files that differ`);
  return files[0];
}

// The path a manifest's slot names (its first backticked value), else `kit`.
export const slot = (manifest, name, kit) => new RegExp(`^\\|\\s*\\*${name}\\*\\s*\\|\\s*\`([^\`]+)\``, "m").exec(manifest)?.[1] ?? kit;

export const KIT_CONFIGS = { licences: "checks/licences.json", audit: "checks/licences-audit.json", copies: "checks/copies.json", baseline: "checks/copies-baseline.json", sizes: "checks/sizes.json" };

// What a check's config names under `name`, as a path: null where the config is not there or names none; where the
// config is there and no JSON, not read. `rooted`: a "/" at its start read from the project's root, as the licence
// check joins it.
export function key(p, file, name, rooted = false) {
  const text = p.read(file);
  if (text === null) return null;
  let value;
  try { value = JSON.parse(text)?.[name]; } catch { throw new Unread(`${file} is no JSON, so the ${name} it names cannot be read`); }
  return typeof value === "string" && value ? inside(rooted ? value.replace(/^\//u, "") : value, `the ${name} of ${file}`) : null;
}

// The licence check's config: what the calls to the core's licences.yml pass, and the project's own runs of the
// licence and agent-tools scripts, which run beside each other; where none runs it, the NuGet check's own, else the
// kit's.
export function licenceConfig(p) {
  const found = one([...passed(p, "licences.yml"), ...fromRuns(p, "licences.mjs"), ...fromRuns(p, "agent-tools.mjs")], "the licence check's config");
  if (found !== undefined) return found;
  notElsewhere(p, ["licences.mjs", "agent-tools.mjs"]);
  return nugetOwn(p) ?? KIT_CONFIGS.licences;
}
// The NuGet check's own config: what the calls to the core's nuget.yml pass and the project's own runs of its script.
function nugetOwn(p) {
  const found = one([...passed(p, "nuget.yml"), ...fromRuns(p, "nuget.mjs")], "the NuGet check's config");
  if (found === undefined) notElsewhere(p, ["nuget.mjs"]);
  return found;
}
// The NuGet check's config: its own, read first, so that it stands where the licence check's cannot be read; else the
// licence check's (`licences`, read only then).
export const nugetConfig = (p, licences = () => licenceConfig(p)) => nugetOwn(p) ?? licences();
// The copies check's config: the calls' and the project's own runs', else the manifest's *copies check* slot (the
// backticked file in its own cell that is neither the script nor a command), else the kit's.
export function copiesConfig(p) {
  const found = one([...passed(p, "copies.yml"), ...fromRuns(p, "copies.mjs")], "the copies check's config");
  if (found !== undefined) return found;
  notElsewhere(p, ["copies.mjs"]);
  const cell = /^\|\s*\*copies check\*\s*\|([^|\n]*)/m.exec(p.manifest)?.[1].match(/`[^`]+`/g) ?? [];
  const named = cell.map(v => v.slice(1, -1)).find(v => !/\s/.test(v) && !/^(\.\/)?core\//.test(v));
  return named === undefined ? KIT_CONFIGS.copies : inside(named, "the manifest's *copies check* slot");
}
// The size marks: what the calls to the core's copies.yml pass as `sizes` and the project's own runs of the
// reading-size script, else the manifest's *size marks* slot, else the kit's.
export function marksConfig(p) {
  const found = one([...passed(p, "copies.yml", "sizes"), ...fromRuns(p, "reading-size.mjs")], "the size marks");
  if (found !== undefined) return found;
  notElsewhere(p, ["reading-size.mjs"]);
  return inside(slot(p.manifest, "size marks", KIT_CONFIGS.sizes), "the manifest's *size marks* slot");
}
// The folder the signature check reads package-lock.json in, from the root: what the calls to the core's
// signatures.yml pass as `directory` ("." where one passes none), undefined where none calls it.
export function packagesFolder(p) {
  const found = given(p, "signatures.yml", "directory").map(({ where, value }) => {
    if (value !== undefined && typeof value !== "string") throw new Unread(`${where} passes the core's signatures.yml a directory that is no text`);
    return { where, value: value === undefined ? "." : inside(value, `${where}'s call to the core's signatures.yml`) || "." };
  });
  return one(found, "the signature check's folder");
}

// All of them, each null where it cannot be read (Unread), and why under `unread`, each line naming whose it is, so
// the reader can say what it did not compare. Any other error is thrown, never hidden.
export function configs(p) {
  const unread = [];
  const or = (what, read) => { try { return read(); } catch (e) { if (!(e instanceof Unread)) throw e; unread.push(`${what}: ${e.message}`); return null; } };
  const licences = or("the licence check's config not compared", () => licenceConfig(p));
  const audit = licences === null ? null : or("the licence check's audit not compared", () => key(p, licences, "audit", true) ?? KIT_CONFIGS.audit);
  const nuget = or("the NuGet check's config not compared", () => nugetConfig(p, () => licences));
  const copies = or("the copies check's config not compared", () => copiesConfig(p));
  const baseline = copies === null ? null : or("the copies check's baseline not compared", () => key(p, copies, "baseline") ?? KIT_CONFIGS.baseline);
  const sizes = or("the size marks not compared", () => marksConfig(p));
  const packages = or("the signature check's folder not read, its lock file's taken", () => packagesFolder(p));
  return { licences, audit, nuget, copies, baseline, sizes, packages, unread: [...new Set(unread)] };
}
