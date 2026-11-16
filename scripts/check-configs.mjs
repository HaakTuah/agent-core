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
const tidy = f => path.posix.normalize(f.replace(/\/+$/u, "")).replace(/^\.\//u, "");
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
    if (text.startsWith("&>", i) || "<>".includes(text[i])) i = redirection(text, i, () => { if (!/^\d+$/u.test(word?.text ?? "")) close(); word = null; operand = true; });
    else if ("\n;&|()".includes(text[i])) end();
    else if (" \t".includes(text[i])) close();
    else i = part(text, i, add);
  }
  end();
  for (const ws of out) for (const w of ws) w.dynamic ||= /%\w+%/u.test(w.text);
  return out;
}
// A redirection at `i` (>, >>, <, 2>, &>, >&2, <<EOF …): `opens` is told, so the word it is written against, a file
// descriptor's number, is no argument and the word after it is its file; it returns where its operator ends.
function redirection(text, i, opens) {
  opens();
  let j = i + (text[i] === "&" ? 1 : 0);
  while ("<>".includes(text[j + 1] ?? "x")) j++;
  return text[j + 1] === "&" ? j + 1 : j;
}
// The lines of a step with each here-document's lines left out (`<<EOF` up to the line that holds "EOF" alone); where
// no such line follows, none is left out.
function withoutHereDocuments(lines) {
  const out = [], at = new Map(); // (each line's text, trimmed, with the lines it stands on, in order: read once)
  lines.forEach((l, k) => { const t = l.trim(); if (!at.has(t)) at.set(t, []); at.get(t).push(k); });
  for (let n = 0; n < lines.length; n++) {
    out.push(lines[n]);
    const end = hereDocument(lines[n]), last = end ? next(at.get(end) ?? [], n) : -1;
    if (last > n) n = last - 1;
  }
  return out;
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
// One part of a word, at `i`: given to `add` as what it spells, and whether it is filled only when the workflow runs;
// it returns where the part ends.
const expressionEnd = (text, i) => { const e = text.indexOf("}}", i); return e < 0 ? text.length : e + 2; };
function part(text, i, add) {
  const c = text[i];
  if (text.startsWith("${{", i)) { const j = expressionEnd(text, i); add(text.slice(i, j), true); return j - 1; }
  // (GitHub fills its expressions before the shell runs, single quotes or not)
  if (c === "'") { const e = text.indexOf("'", i + 1), j = e < 0 ? text.length : e; add(text.slice(i + 1, j), text.slice(i + 1, j).includes("${{")); return j; }
  if (c === '"') return doubleQuoted(text, i, add);
  if (c === "\\") { const next = text[i + 1] ?? ""; add(/[\w.-]/u.test(next) && /[\w.-]/u.test(text[i - 1] ?? "") ? `/${next}` : next); return i + 1; }
  add(c, c === "$" || c === "`");
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
// where it leads out of the project; { dynamic } where it is named only when the workflow runs.
function located(word, dir) {
  const text = slashed(word), rooted = ROOT.test(text), rest = text.replace(ROOT, "");
  if (word.dynamic && /\$|`|%\w+%/u.test(rest)) return { dynamic: true };
  if (!rooted && rest.startsWith("/")) return { at: null };
  const at = path.posix.normalize(rooted ? rest : path.posix.join(dir, rest));
  return { at: at === ".." || at.startsWith("../") ? null : at.replace(/^\.\//u, "") };
}
// (a "\" left in a word, quoted or not, read as "/": a path spelled for Windows)
const slashed = word => word.text.replace(/\\/gu, "/");
const NODE = /(?:^|\/)node(?:\.exe)?$/iu;
const WRAPPERS = new Set(["env", "exec", "time", "command", "nohup", "sudo"]);
// The shell's words that start a command's place without being one (if …; then node …), passed over as wrappers are.
const KEYWORDS = new Set(["if", "then", "else", "elif", "do", "while", "until", "!", "{"]);
// A shell given its commands as one word (`bash -c "…"`), whose commands are read as the step's own.
// (its option that takes them: -c, alone or last in a cluster such as -ec, or PowerShell's -Command)
const SHELL = /^(?:.*\/)?(?:(?:ba|z|da)?sh|pwsh|powershell)(?:\.exe)?$/iu, INLINE = /^(?:-[a-z]*c|-command)$/iu;
// Node's options that take the next word as their value, so that it is no script.
const VALUED = new Set(["-r", "--require", "--import", "--loader", "--experimental-loader", "-C", "--conditions", "--env-file", "--title", "--input-type"]);
const CHDIR = /^(?:cd|pushd|popd|chdir|set-location|sl)$/iu;

// The word a command runs with node, by its index ({ at }), past what goes before node (a variable set, env, exec)
// and node's own options; { moves } where the command changes the folder; { inner }, the commands a shell is given as
// one word; {} where it runs nothing with node.
function nodeRuns(words) {
  let i = pastWrappers(words);
  if (i < words.length && CHDIR.test(words[i].text)) return { moves: true };
  if (i < words.length && SHELL.test(words[i].text)) return inline(words, i);
  if (i >= words.length || !NODE.test(words[i].text)) return {};
  for (i++; i < words.length && words[i].text.startsWith("-"); i++) if (VALUED.has(words[i].text)) i++;
  return { at: i };
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
// The commands a shell at word `i` is given as one word, past its other options, as { inner }; {} where it is given none.
function inline(words, i) {
  let k = i + 1;
  while (k < words.length && words[k].text.startsWith("-") && !INLINE.test(words[k].text)) k++;
  return k + 1 < words.length && INLINE.test(words[k].text) ? { inner: words[k + 1].text, filled: words[k + 1].dynamic } : {};
}
// How each script picks its config from its arguments, as it reads them: the first that does not start with "--"; of
// the reading-size and exact-versions checks, the first whatever it is; of the NuGet check, never the value of its
// "--packages", and none where it is run "--projects" or "--imports", which list files and read no config.
const PICKS = { "reading-size.mjs": { first: true }, "exact-versions.mjs": { first: true }, "nuget.mjs": { valued: ["--packages"], none: ["--projects", "--imports"] } };
// The config a run passes the script at word `i`, as that script picks it (PICKS), as { config }, a path from the
// root; { unread } with why it cannot be known; null where the run reads no config.
function configAfter(words, i, dir, script) {
  const pick = PICKS[path.posix.basename(script)] ?? {}, args = words.slice(i + 1);
  if (args.some(a => pick.none?.includes(a.text))) return null;
  const k = pick.first ? 0 : args.findIndex((a, n) => !a.text.startsWith("--") && !(n > 0 && pick.valued?.includes(args[n - 1].text)));
  const arg = k < 0 ? words.length : i + 1 + k;
  if (arg >= words.length) return { unread: `runs ${script} with no config` };
  const config = located(words[arg], dir.at);
  if (config.dynamic) return { unread: `passes ${script} its config as ${words[arg].text}, which names it only when the workflow runs` };
  return config.at === null ? { unread: `passes ${script} its config as ${words[arg].text}, outside the project` } : { config: config.at };
}
// Where a command that starts with a wrapper or a shell the reader could not get past names the script, a run that
// cannot be known (never one that is not there), as { unread }; else nothing.
// (only past `from`, where the reader stopped: a node word that the copy's script follows, by its path, or a shell's
// -c whose string names it)
const unfollowed = (words, script, from) => {
  const first = words.find(w => !/^\w+=/u.test(w.text));
  if (!first || !(WRAPPERS.has(first.text) || SHELL.test(first.text))) return [];
  const names = w => !!w && slashed(w).replace(ROOT, "").replace(/^\.\//u, "") === script;
  const hidden = words.some((w, j) => j > from && ((NODE.test(w.text) && names(words[j + 1])) || (INLINE.test(w.text) && !!words[j + 1] && slashed(words[j + 1]).includes(script))));
  return hidden ? [{ unread: `runs ${script} through a wrapper or a shell whose options the reader does not follow` }] : [];
};
// The runs read inside a shell's command string, each not read where the outer shell fills the string when it runs
// (`bash -c "node … '$CONFIG'"`: the inner quotes keep nothing from it).
const within = (runs, filled, script) => (filled ? runs.map(() => ({ unread: `runs ${script} in a command string the workflow fills only when it runs` })) : runs);
// Where a step's `run:`, in the folder `dir`, runs `script` (a path from the root, "core/scripts/copies.mjs") with
// node: each as configAfter gives it.
function runsIn(run, dir, script) {
  const found = [];
  let moved = false;
  for (const words of commands(run)) {
    const { moves, inner, filled, at: i } = nodeRuns(words);
    moved ||= !!moves;
    if (inner !== undefined) found.push(...within(runsIn(inner, moved ? { dynamic: true } : dir, script), filled, script));
    else if (i === undefined) found.push(...(moves ? [] : unfollowed(words, script, 0)));
    else found.push(...runAt(words, i, moved ? { dynamic: true, moved } : dir, script));
  }
  return found;
}
// The run of a command whose node is given the word at `i`, as runsIn gives it: where that word is no script of the
// copy's, a run the reader could not place (unfollowed); after a cd, or in a folder named only when it runs, which
// copy it runs cannot be known.
function runAt(words, i, dir, script) {
  const word = words[i];
  if (!word || !slashed(word).endsWith(`scripts/${path.posix.basename(script)}`)) return unfollowed(words, script, i - 1);
  if (dir.moved) return [{ unread: `runs ${word.text} after a command that changes its folder` }];
  const at = dir.dynamic ? { dynamic: true } : located(word, dir.at);
  if (at.dynamic) return [{ unread: `runs ${word.text} in a folder or by a path named only when the workflow runs` }];
  const config = at.at === script ? configAfter(words, i, dir, script) : null;
  return config ? [config] : [];
}

// A step's folder, from the root: its own `working-directory`, else its job's or its workflow's default.
// (one that is no text, or names itself only when the workflow runs, cannot be known)
const folder = (...dirs) => {
  const d = dirs.find(v => v !== undefined && v !== null);
  if (d === undefined) return { at: "." };
  if (typeof d !== "string") return { dynamic: true };
  const text = d;
  if (/\$/u.test(text)) return { dynamic: true };
  const at = path.posix.normalize(text.replace(ROOT, "").replace(/\\/gu, "/"));
  return at === ".." || at.startsWith("../") || at.startsWith("/") ? { dynamic: true } : { at };
};

// Each step the project runs from its workflows, and from the local actions (`uses: ./…`) they use, as
// { where, from, run, dir }: the file it stands in, the workflow that runs it, its `run:` and its folder (an action's
// steps run from the root, save where one names its own); an action the reader cannot read as { where, from,
// unreadable }, its text.
const STEPS_OF = new WeakMap(); // (each project's steps read once, however many checks ask)
function steps(p) {
  if (STEPS_OF.has(p)) return STEPS_OF.get(p);
  const out = [], seen = new Set();
  const action = (uses, from) => {
    const at = tidy(uses);
    if (seen.has(`${from}\0${at}`)) return; // (an action two workflows use is read for each)
    seen.add(`${from}\0${at}`);
    for (const f of [`${at}/action.yml`, `${at}/action.yaml`]) {
      const text = p.read(f);
      if (text === null) continue;
      let yaml = null;
      try { yaml = parseYaml(text); } catch { /* (below) */ }
      if (!yaml) { out.push({ where: f, from, unreadable: text }); return; }
      walk(f, from, yaml.runs?.steps ?? [], step => folder(step["working-directory"]));
      return;
    }
  };
  const walk = (where, from, list, dirOf) => {
    for (const step of Array.isArray(list) ? list : []) {
      if (typeof step?.run === "string") out.push({ where, from, run: step.run, dir: dirOf(step) });
      if (typeof step?.uses === "string" && step.uses.startsWith("./")) action(step.uses, from);
    }
  };
  for (const [f, w] of Object.entries(p.workflows)) {
    const where = `.github/workflows/${f}`;
    if (!w.yaml) continue;
    for (const job of Object.values(w.yaml.jobs ?? {})) {
      walk(where, where, job?.steps, step => folder(step["working-directory"], job?.defaults?.run?.["working-directory"], w.yaml.defaults?.run?.["working-directory"]));
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
    if (s.unreadable !== undefined) return s.unreadable.includes(name) ? [{ where: s.where, from: s.from, unread: `the core's reader cannot read ${s.where}, in a form it does not know` }] : [];
    return runsIn(s.run, s.dir, script).map(r => ({ where: s.where, from: s.from, ...r }));
  });
}
// The workflows of the project's own that run the script, themselves or through an action they use, once each.
export const runFiles = (p, name) => [...new Set(runsOwn(p, name).map(r => r.from))];
const fromRuns = (p, name) => runsOwn(p, name).map(r => {
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
