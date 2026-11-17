// Where a hook's command takes the project's files from (floor rule 3: what an agent tool starts by itself runs from
// its copy on `main`; agent-tools.mjs). The starter kit's hooks fetch the script they run from the remote's `main`
// (`git show refs/remotes/origin/main:<path>`), which a session's branch cannot change; a hook that names a file the
// project holds otherwise runs or reads the working tree's copy, which the branch it runs on can change.
//
// What it reads, two ways, and no more. Each word of the command that names a file the project holds, as the command
// writes it (relative to the project's root, or after a variable, a command's output or a backtick's, such as
// $CLAUDE_PROJECT_DIR, "$r" or $(git rev-parse --show-toplevel)), and each quoted text so; and, given the list of the
// project's files, each of them wherever its path stands in the command whole (not within a longer name): as written;
// with the shell's quoting read, level after level, until reading it changes nothing (eight levels at most), its
// backslashes, its backslash-newlines and the escapes of $'...' read as bash reads them; with every backslash read and
// every quote taken out; and with cmd's "^" and PowerShell's backtick read as their escapes. A path written
// `<the remote's main>:<path>` (refs/remotes/origin/main or origin/main) and given to git show or git cat-file -p, in
// the one form FETCHED below reads, names main's copy, which is no file of the working tree; and a file only tested for, by "[", "[[" or "test" where a command starts
// (`[ -f <path> ]`, `test -e <path>`), is neither run nor read, save where the command defines a function or alias of
// that name. Not read here, and so the review's: a path the command builds from parts, reaches by changing folder or
// through ".." past a link, names by a pattern (a glob or braces), or spells otherwise than the forms above; and
// whether a ref named `origin/main` is the remote's. Node's own modules only.
//
//   import { fromTree, pathsIndex } from "./hook-source.mjs";
//   fromTree(command, holds, index) -> the paths it takes from the working tree, where holds(path) says the project
//                                      holds one and index, pathsIndex(the project's files), lists them
import path from "node:path";
import { inProject } from "./guards.mjs";

const WORD = /[^\s'"`;|&()<>{}$\\=,\u0001]+/gu;
const MAIN = /^(?:refs\/remotes\/)?origin\/main$/u;
// (a variable, as the shell, cmd and PowerShell write one, read as one mark: what it holds is not the command's text;
// but a ${...} that holds a command's output or another expansion, as ${X:-$(bash run.sh)}, is no mere variable, and
// is read as written)
const VARIABLE = /\$env:\w+|\$\{[^}$`]*\}|\$\w+|%\w+%/gu;
// (what stands before a word that only tests a file: "[", "[[" or "test" where a command starts (at the start, after a
// newline, ";", "&", "|" or "(", but "&" or "|" not of a redirection such as ">&" or ">|", after a quote that opens,
// or where a shell itself standing so starts its -c script, its quotes read), perhaps after keywords such as "then", "!" or "{", each a
// word of its own, then a test's operator, perhaps a quote and a variable; an option of another program, as node's -r,
// is no test, nor is "test" given to another program, as in "go test -v", or after a word that is no keyword)
const TESTED = /(?:^|[\n;(]|(?<![<>])[&|]|(?:^|[\s=])\\?["'])[ \t]*(?:(?:if|then|else|elif|while|until|do|!|\{)[ \t]+)*(?:(?:[^\s;&|<>"'`()]*\/)?(?:sh|bash|zsh|dash)(?:\.exe)?[ \t]+(?:-\w+[ \t]+)*-c[ \t]+)?(?:\[\[?|test)[ \t]+(?:![ \t]+)?-[A-Za-z][ \t]+\\?["']?\u0001?\\?["']?$/u;
// (a command that defines a name among `names` as a function, in either of bash's forms, by the name alone or a path to
// it, ".exe" or not, as the exemptions read their commands)
const PATHED = `(?:[^\\s;&|\`$()"'<>]*[/\\\\])?`;
const defines = names => new RegExp(`(?:^|[\\s;&|(])${PATHED}(?:${names})(?:\\.exe)?[ \\t]*\\([ \\t]*\\)|\\bfunction[ \\t\\n]+${PATHED}(?:${names})(?:\\.exe)?(?=[\\s({]|$)`, "u");
// (a command that could define a name at its run, by text no reading here sees whole: eval, source or ".", an alias of
// any name, bash's table of aliases, a function bash takes from its environment or a file it reads at its start, or a
// function whose name an expansion gives)
const RUNTIME = /(?:^|[\s;&|(`])(?:eval|source|\.|alias|unalias)(?=[\s;&|)`]|$)|BASH_ALIASES|BASH_FUNC_|BASH_ENV|(?:^|[^\w])ENV=|\u0001[ \t]*\([ \t]*\)/u;
// (no file test of a command that defines test, "[", "[[" or a shell that runs one is one)
const DEFINED = defines("test|\\[\\[?|sh|bash|zsh|dash");
const redefined = raw => DEFINED.test(raw) || RUNTIME.test(raw);
// (what stands before a path read from the project's root: a variable or a command's output, as $(git rev-parse
// --show-toplevel), or a ${...} with a default, perhaps closed by a quote)
const ROOTED = /[\u0001)`}]\\?["']?$/u;

// The quoted texts of a script, read left to right as the shell reads them: a single-quoted text is taken as written, a
// double-quoted one with its backslashes read, and a backslash outside quotes keeps the next character; each quoted text
// is read again as a script of its own, as bash -c '...' runs one, a few levels deep. Each is [its text, what stood
// before it, whether no command word an expansion gives stood before it (riskAt)]; a text holding a blank is a name a
// word alone would split, as "scripts/my hook.sh".
function quotedTexts(script, depth = 0, out = [], safe = true) {
  if (depth > 4) return out;
  const risk = riskAt(script);
  for (let i = 0; i < script.length; i++) {
    const c = script[i];
    if (c === "\\") { i++; continue; }
    if (c !== "'" && c !== '"') continue;
    let j = i + 1, body = "";
    for (; j < script.length && script[j] !== c; j++) {
      if (c === '"' && script[j] === "\\" && j + 1 < script.length) j++;
      body += script[j];
    }
    // (a quote never closed opens nothing, and reading goes on after it; an apostrophe in a comment or a here-document
    // that a later quote of its kind closes is read as a pair, which the shell would not, and stays the review's)
    if (j >= script.length) continue;
    out.push([body, windowAt(script, i), safe && i < risk]);
    quotedTexts(body, depth + 1, out, safe && i < risk);
    i = j;
  }
  return out;
}
// (a word whose blanks a backslash keeps, as scripts/my\ hook.sh: each word read whole, once, and kept where it holds one)
const ESCAPED = /(?:[^\s'"`;|&()<>{}$\\=,\u0001]|\\ )+/gu;

// The project's files as a tree of their paths' characters, for finding each wherever it stands in a command.
export function pathsIndex(files) {
  const root = new Map();
  for (const f of files) {
    let node = root;
    // (by UTF-16 unit, as scan() reads a command, so a name with a character outside the first plane is found)
    for (let k = 0; k < f.length; k++) { const c = f[k]; if (!node.has(c)) node.set(c, new Map()); node = node.get(c); }
    node.set("", true);
  }
  return root;
}
const NAME = /[\w.-]/u;
// (where a path may start: at the start, after a character no name holds, or after "./" or a root's "/" there)
const STARTS = /(?:^|[^\w./-])(?:\.\/|[\u0001)`}]["']?\/+)?$/u;
// A path fetched from main, read in one form and no other, which the starter kit's hooks write: where a command starts
// (at the start, after a newline, ";", "&", "|", "(", "$(" or a backtick), perhaps after keywords such as "then" or
// "{" and the command's own variables (FOO=1), git (by its name or a path to it, ".exe" or not), its options -C or -c
// each with one word, or --name or --name=word, then show or cat-file -p, then `<the remote's main>:<path>`. A word is
// plain text, single- or double-quoted text, variables, $(...) without quotes in it and backtick spans, joined, and
// holds no blank (each reading with the quotes taken out must still find the form). Any other form, git's or another
// program's (java -cp origin/main:x, say), is no fetch: its path is read as taken, and the mend is the kit's form.
// (each alternative takes characters no other takes, the variable's mark among them, so no word is read two ways and
// nothing backtracks without end)
const ARG = `(?:"(?:[^"\`$\\\\\\u0001]|\\u0001|\\$\\([^()"\`]*\\))*"|'[^']*'|\\u0001|\\$\\([^()"'\`]*\\)|\`[^\`]*\`|[^\\s;&|\`$()"'<>\\u0001])+`;
const FETCHED = new RegExp(`(?:^|[\\n;&|(\`])[ \\t]*(?:(?:then|do|else|elif|if|while|until|!|\\{)[ \\t]+)*(?:\\w+=${ARG}?[ \\t]+)*(?:[^\\s;&|\`$()"'<>]*[/\\\\])?git(?:\\.exe)?(?:[ \\t]+(?:-[Cc][ \\t]+${ARG}|--[\\w-]+(?:=${ARG})?))*[ \\t]+(?:show|cat-file[ \\t]+-p)[ \\t]+["']?(?:refs\\/remotes\\/)?origin\\/main:["']?(?:\\.\\/)?$`, "u");
const fetched = before => FETCHED.test(before);
// Where a command word or a -c script (a shell's, or any program's: no reading here tells them apart) first starts with
// an expansion ($E, a ${...}, $(...), a backtick's output), which can define test or git, or anything, as it runs: no
// file test nor fetch after it is one, a test or fetch before it, as the starter kit's f=$(git show ...) before its
// bash -c "$f", keeping its own (each part takes characters no other takes, so nothing backtracks without end). The
// index, or Infinity.
const RISK = new RegExp(`(?:^|[\\n;&|(\`{]|(?<![^\\s])-\\w*c[ \\t])[ \\t]*(?:(?:then|do|else|elif|if|while|until|!|\\{)[ \\t]+)*(?:\\\\?["'])*(?:(?:\\w+=(?:${ARG})?[ \\t]+)+(?:\\\\?["'])*)?[\\u0001\\u0002$\`]`, "u");
function riskAt(text) { const m = RISK.exec(text); return m ? m.index : Infinity; }
// (no fetch of a command that defines git is one)
const GIT_DEFINED = defines("git");
const gitDefined = raw => GIT_DEFINED.test(raw) || RUNTIME.test(raw);
// A script with one level of the shell's quoting read, as the shell reads it before running it: a single-quoted text as
// written; $'...' with its escapes read as bash reads them; a double-quoted one and a word outside quotes with their
// backslashes read and a backslash-newline gone; the quotes themselves gone; a quote never closed runs to the end.
const ANSI = { a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" };
function ansiEscape(s, i) {
  const c = s[i + 1], hex = (from, max) => /^[0-9A-Fa-f]+/u.exec(s.slice(from, from + max))?.[0] ?? "";
  if (Object.hasOwn(ANSI, c)) return [ANSI[c], i + 2];
  if (/[0-7]/u.test(c ?? "")) { const o = /^[0-7]{1,3}/u.exec(s.slice(i + 1))[0]; return [String.fromCharCode(Number.parseInt(o, 8) & 0xff), i + 1 + o.length]; }
  const n = { x: 2, u: 4, U: 8 }[c];
  if (n) {
    const h = hex(i + 2, n), code = h ? Number.parseInt(h, 16) : -1;
    if (code >= 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)) return [String.fromCodePoint(code), i + 2 + h.length];
  }
  return [c ?? "", i + 2];
}
function dequote(s) {
  let out = "";
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === "\\") { if (s[i + 1] !== "\n") out += s[i + 1] ?? ""; i += 2; continue; }
    const ansi = c === "$" && s[i + 1] === "'";
    // (bash's $"..." is read as "...")
    if (c === "$" && s[i + 1] === '"') { i++; continue; }
    if (c !== "'" && c !== '"' && !ansi) { out += c; i++; continue; }
    const [text, next] = quotedAt(s, i + (ansi ? 2 : 1), ansi ? "$'" : c);
    out += text;
    i = next;
  }
  return out;
}
// The text of a quote of the kind `q` ("'", '"' or "$'") whose body starts at `i`, as dequote() reads it, and where
// reading goes on after its closing quote.
function quotedAt(s, i, q) {
  const close = q === '"' ? '"' : "'";
  let out = "";
  while (i < s.length && s[i] !== close) {
    if (q === "$'" && s[i] === "\\") { const [t, next] = ansiEscape(s, i); out += t; i = next; }
    else if (q === '"' && s[i] === "\\" && i + 1 < s.length) { if (s[i + 1] !== "\n") out += s[i + 1]; i += 2; }
    else out += s[i++];
  }
  return [out, i + 1];
}

// A script's quoting read level after level, as scripts within scripts are, until reading it changes nothing (eight
// levels at most): each level's text.
function dequotings(script) {
  const levels = [];
  for (let level = script, n = 0; n < 8; n++) { const next = dequote(level); if (next === level) break; levels.push(next); level = next; }
  return levels;
}

// What stands before `i` in `text`, its last 200 characters at most; where it is cut, its start is marked as no command's
// start (" x "), so no regex here reads the cut as one.
const windowAt = (text, i) => (i > 200 ? ` x ${text.slice(i - 200, i)}` : text.slice(0, i));

// Each of the project's files whose path stands whole in `text`, not fetched from main nor only tested for, into `found`.
function scan(text, index, holds, found, tests, fetches, only = () => true) {
  const risk = riskAt(text);
  for (let i = 0; i < text.length; i++) {
    if (i > 0 && NAME.test(text[i - 1]) && text[i - 1] !== "/") continue;
    let node = index;
    for (let j = i; j < text.length && (node = node.get(text[j])); j++) { // (by UTF-16 unit, as pathsIndex keys them)
      if (!node.has("") || (j + 1 < text.length && /[\w./-]/u.test(text[j + 1]))) continue;
      const at = text.slice(i, j + 1);
      if (!found.has(at) && only(at) && takenAt(windowAt(text, i), tests && i < risk, fetches && i < risk) && holds(at)) found.add(at);
    }
  }
}
// Whether a path that `before` stands before is taken from the working tree: it starts where a path may, is not
// fetched from main, and is not only tested for (a root's "/" or a "./" before a tested path is the test's).
const takenAt = (before, tests, fetches) => STARTS.test(before) && !(fetches && fetched(before)) && !(tests && TESTED.test(before.replace(/(?:\.\/|\/+)$/u, "")));

// Whether a word, `ref` before its colon (or null), that `before` stands before is fetched from main or only tested for,
// where the command lets a test (`tests`) or a fetch (`fetches`) be one.
function exempt(ref, before, tests, fetches) {
  if (ref !== null) return MAIN.test(ref) && fetches && fetched(`${before}${ref}:`);
  return (tests && TESTED.test(before)) || (fetches && fetched(before));
}

// A word's path relative to the project's root: a path after a variable, a command's output or a backtick's is read
// from the root, which is what such a thing holds in a hook; another path that starts at "/" is none of the project's.
const ROOT = /^(?:\u0001|\$\([^)]*\)|`[^`]*`|\$\{[^}]*\})\/+/u;
function fromRoot(p, before, ref, quoted) {
  if (quoted && ROOT.test(p)) return p.replace(ROOT, "");
  if (!p.startsWith("/")) return p;
  return ref !== null || !ROOTED.test(before) ? null : p.replace(/^\/+/u, "");
}

// (the word a ${NAME:-word}, ${NAME:=word}, ${NAME:+word} or ${NAME:?word} gives, colon or not, or a pattern's
// replacement, ${NAME/pattern/word}: read on its own too, since the expansion itself stands as one mark)
const OPERAND = /\$\{\w+(?::?[-=+?]|\/\/?[#%]?[^/}$`]*\/)([^}$`]*)\}/gu;

export function fromTree(command, holds, index = null, operand = false) {
  const operands = [...String(command).matchAll(OPERAND)].map(m => m[1]).filter(w => w.trim());
  const raw = String(command).replace(VARIABLE, "\u0001");
  // (a backslash before a name's letter is Windows' separator; one before a quote, a blank or a "$" is the shell's escape)
  const text = raw.replace(/\\(?=[\w.%-])/gu, "/");
  // (a ${...}'s default is a word, not a command of its own: no file test nor fetch stands at its start; and a definition of test
  // or git is looked for in the command as written and in every reading of its quoting, as alias g'it'=x defines git)
  const forms = [raw, ...dequotings(raw), raw.replace(/\\(.)/gsu, "$1").replace(/["']/gu, "")];
  const found = new Set(), tests = !operand && !forms.some(redefined), fetches = !operand && !forms.some(gitDefined);
  const take = (word, before, quoted = false, safe = true) => {
    const colon = word.lastIndexOf(":"), ref = colon > 0 ? word.slice(0, colon) : null;
    if (exempt(ref, before, tests && safe, fetches && safe)) return;
    const p = fromRoot(colon >= 0 ? word.slice(colon + 1) : word, before, ref, quoted);
    if (p === null || !inProject(p)) return;
    const at = path.posix.normalize(p);
    if (at !== "." && holds(at)) found.add(at);
  };
  // (each word as written, and as the shell unquotes it, so a path through a link inside the checkout, which no list of
  // the project's files holds, is found however it is quoted)
  for (let level = text, n = 0; n < 4; n++) {
    const risk = riskAt(level);
    for (const m of level.matchAll(WORD)) take(m[0], windowAt(level, m.index), false, m.index < risk);
    const next = dequote(level);
    if (next === level) break;
    level = next;
  }
  const risk = riskAt(text);
  for (const m of text.matchAll(ESCAPED)) if (m[0].includes("\\ ")) take(m[0].replace(/\\ /gu, " "), windowAt(text, m.index), false, m.index < risk);
  for (const [body, before, safe] of quotedTexts(raw)) take(body.replace(/\\(?=[\w.%-])/gu, "/"), before, true, safe);
  if (index) {
    // (as written, Windows' separators read; with the shell's quoting read level after level, as scripts within scripts
    // are, until reading it changes nothing; with every backslash read and every quote taken out; and with cmd's and
    // PowerShell's escapes read)
    const variants = [text, ...dequotings(raw)];
    const bare = raw.replace(/\\\n/gu, "").replace(/\\(.)/gsu, "$1").replace(/["']/gu, "");
    // (a closed backtick span holding a blank is the shell's command output, kept as one mark, not PowerShell's escape)
    const escapes = text.replace(/`[^`]*\s[^`]*`/gu, "\u0002").replace(/[\^`](.)/gsu, "$1");
    variants.push(bare, escapes, escapes.replace(/["']/gu, ""));
    for (const variant of variants) scan(variant, index, holds, found, tests, fetches);
    // (and, for a name that holds a "$" or a "%", the command as written, its variables not marked, with its quoting read:
    // a "$" a quote or backslash keeps, as in 'scripts/$notify.sh', and a %name% a POSIX shell never reads, as in
    // scripts/%notify%.sh, are part of a name, which marking would have taken)
    const written = String(command), dollar = at => /[$%]/u.test(at);
    for (const variant of [written, dequote(written)]) scan(variant, index, holds, found, tests, fetches, dollar);
  }
  for (const word of operands) for (const at of fromTree(word, holds, index, true)) found.add(at);
  return [...found];
}
