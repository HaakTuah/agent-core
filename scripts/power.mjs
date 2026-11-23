#!/usr/bin/env node
// What runs with power, and which later commits of a pull request touch none of it (#1134, points 1 and 4;
// tasks/reviews.md, "What a posted review stands for"). The set, as this script reads it from a tree of the repository:
//   - a workflow (.github/workflows/) with a write permission (its value on the line of its scope or the next, in any
//     letters), a secret (by its name, by an index, or the secrets whole, in any letters), or no top-level
//     `permissions:`, where the host's default token, which may write, is what it gets;
//   - an action (an action.yml or action.yaml in any folder);
//   - .claude/, and what comment-only.mjs, beside this file, reads as running by itself beyond .github/ (RUNS_TOO: an
//     agent tool's own folder, hooks, the files that say what installs or builds), the copy of the core at the path
//     the manifest names aside;
//   - what such a file runs or loads, of the files that may run (a script, an action, a file with no extension such as
//     `./deploy`), read from its whole text, a module's comments aside, which run nothing (a `///` directive kept, which
//     a tool reads), in three ways that ask
//     nothing of where a name stands, how it is quoted or which call takes it:
//       1. a name written whole (NAMED): each word (a run of TOKENS, read again with %XX, \xXX and \uXXXX decoded), by
//          its last part and each part of that between dots, names each file of that last name in any folder, with
//          any ending a language adds (`helper` for helper.js or helper.py) or as the index.js, __init__.py or
//          __main__.py of a folder of that name; so a folder it leads from, a space or a quote cannot hide it;
//       2. a name built of fixed text and holes (BUILT: a `${}`, a shell's `$NAME` and `$()`, a format's `{}` and `%s`,
//          a glob's `*` and `?`; a string joined by `+` or `/` to code, the strings of a `join(`/`resolve(` call; a
//          shell's word) that holds a `/` or a `.`, and fixed text besides its ending: each file whose path holds its
//          fixed text in order, a hole standing for any run of characters, the first at the start of a folder's name
//          unless a hole comes first, the last at the end where the name ends in fixed text;
//       3. a name built of holes alone, with its ending at most (`import(x)`, `${root}/${name}.mjs`): it comes from
//          what calls the script, which is read in turn, so it names, besides, only every file below a module's own
//          folder where it starts `./` or `../`, and every file below each folder a plain string names on a line that
//          loads by `import(` or `require(` or on a line that sets a name such a line uses (`const STEPS = "steps"`),
//          declared at the top level or in that line's own block, or assigned anywhere, and so on through each name
//          such a setting line uses in turn;
//     and a workflow it calls (`uses:`), followed on through what each names in turn;
//   - a script whose own text calls GitHub, the network or `git push` (CALLS), or loads a module by a plain name that is
//     no path and none of Node's own modules that reach nothing beyond the machine (LOCAL): a package (axios), or
//     https; or by a name it builds that does not start as a path (UNPLACED), which may be a package's; a file with no
//     extension whose text starts with `#!` among them.
// Code an agent changes is read as data alone: its text is matched, never run. A tree is read from a folder on disk
// (the default branch's checkout) or from a commit of a git clone (`git ls-tree`, `git cat-file`), never checked out.
//
// Run by the core's workflow security-review.yml from the default branch's copy, in the clone of the head's commits it
// fetches (which checks out nothing), it prints, as JSON:
//   { "power": [the paths of the pull request's files in the set, at the default branch or at the head],
//     "light": [the commits of the pull request, each with one parent among its commits, whose changed paths are in the
//     set neither at the parent nor at the commit] }
// which security-review.mjs reads (POWER): floor rule 3's two reviews where "power" holds a path, and a review carried
// across the light commits.
// A commit it could not read in the time it has (DEADLINE, the seconds since the epoch by which it stops; the newest
// commits first) is not light, so its review is asked as before. Git and Node's own modules only.
//
// Usage (in that clone):  node scripts/power.mjs <the pull request, as GitHub's API gives it> <its commits, the same>
//                           <its files, the same> <the default branch's checkout>
//         node scripts/power.mjs --list [<folder>]   prints the set of a folder on disk (the repository's root by
//                                                   default), a path a line with what brought it in (power, place,
//                                                   calls, unread, or the file that runs or loads it)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { RUNS_TOO } from "./comment-only.mjs";
import { started } from "./started.mjs";

const SHA = /^[0-9a-f]{40}$/u;
// a script, by its name
export const SCRIPT = /\.(?:[cm]?[jt]sx?|sh|bash|zsh|py|ps1|psm1|rb|pl|php|lua|bat|cmd)$/iu;
const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/u;
const ACTION = /(?:^|\/)action\.ya?ml$/iu;
// what a workflow's line says of power, comment lines aside, in any letters: a write permission (`<scope>: write`, the
// scope quoted or not, the value after a tag or an anchor, or on the next line), write-all, or the secrets in any form
// (`secrets.NAME`, an index, `inherit`, a declared one, `toJSON(secrets)`) but the token the job's own permissions
// bound (secrets.GITHUB_TOKEN)
const POWERED = /(?:^|\n)[ \t]*[^#\n][^\n]*?(?:\bwrite-all\b|\b[a-z-]+["']?[ \t]*:(?:[ \t]*#[^\n]*)?\s*(?:[!&][^\s]*\s+)*["']?write["']?[ \t]*(?:[,}#]|\n|$)|\bsecrets\b(?!\.GITHUB_TOKEN\b))/iu;
const PERMISSIONS = /(?:^|\n)permissions[ \t]*:/u;
// a call to GitHub, the network or `git push`, as a script's text shows it
export const CALLS = /\bfetch[ \t]*\(|\bnode:(?:https?|http2|net|tls|dgram)\b|\b(?:require\([ \t]*|from[ \t]+|import[ \t]+)["'](?:https?|http2|net|tls|dgram)["']|\bXMLHttpRequest\b|\bWebSocket\b|\bcurl\b|\bwget\b|\bInvoke-(?:WebRequest|RestMethod)\b|\burllib\b|\brequests\.(?:get|post|put|patch|delete|request)\b|\bgh[ \t]+(?:api|pr|issue|release|run|repo|workflow|auth|secret|label|search)\b|["']gh["']|api\.github\.com|\bGH_TOKEN\b|\bGITHUB_TOKEN\b|\bgit[ \t]+(?:push|fetch|clone|pull|ls-remote)\b|["'](?:push|fetch|clone|pull|ls-remote)["']/u;
// a module a script loads by a name written whole (`import x from "y"`, `import "y"`, `export * from "y"`, `import("y")`,
// `require("y")`, `module.require("y")`, `require 'y'`), the name a string of its own (one inside another string, a
// test's fixture, loads nothing), or by a name built at run time that does not start as a path; and Node's own modules
// that reach nothing beyond the machine: any other name that is no path (a package, `https`, `node:dns`, a URL), and
// any built one, may call out
const LOCAL = new Set(["assert", "async_hooks", "buffer", "child_process", "cluster", "console", "constants", "crypto", "diagnostics_channel", "events", "fs", "module", "os", "path", "perf_hooks", "process", "querystring", "readline", "stream", "string_decoder", "test", "timers", "tty", "url", "util", "v8", "vm", "worker_threads", "zlib"]);
function outward(text) {
  const strings = [], marked = text.replace(STRING, (...string) => { strings.push(string[1] ?? string[2] ?? string[3]); return `\u0001${strings.length - 1}\u0001`; });
  return UNPLACED.test(bare(text)) || [...marked.matchAll(/(?:(?:^|[^\w$.])from|(?:^|[^\w$])(?:import|require))\s*\(?\s*\u0001(\d+)\u0001/gu)].map(([, at]) => strings[Number(at)])
    .some((name) => /^[^\s\\]+$/u.test(name) && !/^(?:\.{0,2}\/|#|file:)/u.test(name) && !LOCAL.has(name.replace(/^node:/u, "").split("/")[0]));
}
// a module loaded by a name built at run time: an import( or require( whose argument is no plain string (LOADS), and of
// those, one that does not start as a path or a file's URL (UNPLACED)
const LOADING = String.raw`(?:^|\n)[ \t]*(?!\/\/|\*|#)[^\n]*?\b(?:import|require)[ \t]*\([ \t]*(?!["'][^"'\n$]*["'][ \t]*[,)]`;
const LOADS = new RegExp(`${LOADING})`, "u"), UNPLACED = new RegExp(`${LOADING}|[\`"'](?:\\.{0,2}\\/)|[\\w.]*pathToFileURL\\()`, "u");
// a module's own code, whose comments run nothing
const MODULE = /\.(?:[cm]?[jt]sx?)$/iu;
// a text whose words are commands, each a name it may run
const SHELL = /\.(?:sh|bash|zsh|ps1|psm1|bat|cmd|ya?ml)$/iu;
// a module's code with its comments out (`code`), a `///` directive of TypeScript's, which may add a file, and each
// string and regular expression kept (so a `//` inside one is no comment); and with its strings left empty but for a
// path's start (`bare`)
const COMMENTS = /(?<!\\)\/\*[\s\S]*?\*\/|(?<![/\\])\/\/(?!\/)[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|(?<=(?:^|[(,=:[!&|?{};]|\breturn)[ \t]*)\/(?![/*])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[a-z]*/gmu;
const code = (text) => text.replace(COMMENTS, (found) => (/^\/[/*]/u.test(found) ? " " : found));
const bare = (text) => text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\$]|\\.|\$(?!\{))*`/gu,
  (found) => (/^["'`]/u.test(found) ? `"${found.slice(1).match(/^\.{0,2}\//u)?.[0] ?? ""}"` : " "));
// the names a text may give a path by, and a text with the escapes a name may be written in decoded
const TOKENS = /[A-Za-z0-9_@.+~/-]+/gu;
const decoded = (text) => text.replace(/%([0-9A-Fa-f]{2})|\\x([0-9A-Fa-f]{2})|\\u([0-9A-Fa-f]{4})|\\u\{([0-9A-Fa-f]{1,6})\}/gu,
  (found, ...hex) => { const at = parseInt(hex.slice(0, 4).find((part) => part !== undefined), 16); return at <= 0x10ffff ? String.fromCodePoint(at) : found; });
// the endings a language adds to a name given without one, and the files a folder's name runs
const ENDS = ["", ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".jsx", ".tsx", ".py", ".ps1", ".cmd", ".bat"];
const INSIDE = new Set([...ENDS.slice(1, 9).map((end) => `index${end}`), "__init__.py", "__main__.py"]);
// a hole in a built name; the holes each language writes; a quoted string; a run of strings and code joined by + or /
const HOLE = "\u0000";
const HOLES = /\$\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\$\((?:[^()]|\([^()]*\))*\)|\$[A-Za-z_]\w*|\$[0-9@*#?!]|\{[^{}\n]*\}|%[-#0 +]*\d*(?:\.\d+)?[sdifr]|[*?]+/gu;
const STRING = /`([^`]*)`|"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/gu;
const OPERAND = String.raw`[\w$.\[\]\u0000]+(?:\([^()\n]*\))?`, MARK = String.raw`\u0001\d+\u0001`;
const JOINED = new RegExp(String.raw`(?:${OPERAND}[ \t]*[+/][ \t]*)*${MARK}(?:[ \t]*[+/][ \t]*(?:${MARK}|${OPERAND}))*`, "gu");
const JOIN = /\b(?:join|resolve|joinpath|Join-Path)[ \t]*\(/gu;
// where a built name may end: as written, with an ending, or as a folder's index
const ENDING = String.raw`(?:\.[^/]*|/(?:index|__init__|__main__)\.[^/]+)?$`;
// the largest text read: a file past it is held in the set, unread
const LARGEST = 1 << 20;

// a text with its line ends as LF alone, so a file written with CRLF (as Windows may) reads as one written with LF
const lf = (text) => (text === null ? null : text.replace(/\r\n?/gu, "\n"));
// whether a workflow's text gives it power
export const powered = (text) => text === null || POWERED.test(lf(text)) || !PERMISSIONS.test(lf(text));
// whether a path has no extension: an executable named so (`deploy`, `bin/release`) is run as a script is
const unextended = (name) => path.posix.extname(name) === "";
// whether a path is in the set by where it stands alone
const placed = (name) => ACTION.test(name) || name.startsWith(".claude/") || RUNS_TOO.test(name);
// whether a path is one a file may run or load
const runnable = (name) => SCRIPT.test(name) || ACTION.test(name) || unextended(name);

// The set of a tree: `paths`, every file's path; `read(path)`, its text, or null where it cannot be read or is too large;
// `copy`, the folder of the core's copy as the manifest names it, left out (only a sync changes it, its code reviewed in
// the core's own pull request; a repository whose manifest names none, the core's own among them, leaves out nothing).
// `why`, where given, is filled with what brought each path in.
export function setOf({ paths, read: raw, copy }, why = new Map()) {
  const read = (name) => lf(raw(name));
  const own = paths.filter((name) => typeof name === "string" && !(typeof copy === "string" && copy !== "" && name.startsWith(copy)));
  const runs = own.filter(runnable);
  const tree = { all: new Set(own), runs, byLast: indexOf(runs), folders: new Set(own.map((other) => path.posix.dirname(other))), fits: new Map() };
  const set = new Set(), queue = [];
  const add = (name, from) => { if (!set.has(name)) { set.add(name); queue.push(name); why.set(name, from); } };
  for (const name of own) { const seed = seedOf(name, read); if (seed) add(name, seed); }
  for (let i = 0; i < queue.length; i++) {
    const name = queue[i], text = read(name);
    if (text !== null) for (const [other, from] of loadsOf(name, text, tree)) if (other !== name) add(other, from);
  }
  return set;
}
// why a file is in the set by itself (power, place, unread or calls), or null where it is not
function seedOf(name, read) {
  if (WORKFLOW.test(name)) return powered(read(name)) ? "power" : null;
  if (placed(name)) return "place";
  if (!SCRIPT.test(name)) { const text = unextended(name) ? read(name) : null; return text !== null && text.startsWith("#!") && calls(text) ? "calls" : null; }
  const text = read(name);
  if (text === null) return "unread";
  return calls(MODULE.test(name) ? code(text) : text) ? "calls" : null;
}
const calls = (text) => CALLS.test(text) || outward(text);
// what a file of the set runs or loads, each [path, what brought it in]: by a name written whole, then by one built
function loadsOf(name, raw, tree) {
  const text = MODULE.test(name) ? code(raw) : raw;
  const found = [...namedIn(text, tree)].map((other) => [other, name]);
  const built = new Set(patternsOf(text, SHELL.test(name) || unextended(name)).flatMap((pattern) => fitting(pattern, tree)));
  if (SCRIPT.test(name) && LOADS.test(MODULE.test(name) ? bare(raw) : raw)) for (const other of loadable(name, text, tree)) built.add(other);
  return [...found, ...[...built].map((other) => [other, `${name} (built)`])];
}

// The files that may run, by each key a word names them by: their last part, each run of TOKENS in it (`my helper.mjs`
// by `helper.mjs`), and, for a folder's index.js, __init__.py or __main__.py, the folder's name in the same ways.
function indexOf(runs) {
  const byLast = new Map(), add = (key, at) => byLast.set(key, [...(byLast.get(key) ?? []), at]);
  const keysOf = (part) => new Set([part, ...(part.match(TOKENS) ?? [])]);
  for (const name of runs) {
    const last = path.posix.basename(name);
    for (const key of keysOf(last)) add(key, name);
    if (INSIDE.has(last)) for (const key of keysOf(path.posix.basename(path.posix.dirname(name)))) add(key, name);
  }
  return byLast;
}
// What a text names whole (NAMED): each word's last part, and each part of it between dots (`tools.jobs.run`), as a
// key of the index, bare or with each ending; and a workflow a `uses:` calls.
function namedIn(text, { all, byLast }) {
  const found = new Set();
  const look = (key) => { for (const end of ENDS) for (const at of byLast.get(key + end) ?? []) found.add(at); };
  const words = new Set([...(text.match(TOKENS) ?? []), ...(/[%\\]/u.test(text) ? decoded(text).match(TOKENS) ?? [] : [])]);
  for (const word of words) {
    const last = word.replace(/\.+$/u, "").split("/").pop();
    if (last === "") continue;
    look(last);
    if (last.includes(".")) for (const part of last.split(".")) if (part !== "") look(part);
  }
  for (const [, called] of text.matchAll(/(?:^|\n)[ \t-]*uses[ \t]*:[ \t]*["']?\.\/(\.github\/workflows\/[^\s"'@#]+)/gu)) if (all.has(called)) found.add(called);
  return found;
}

// The names a text builds (BUILT): each string, its holes marked; each run of strings and code joined by + or /, the
// code a hole; the strings of each join( or resolve( call, joined by `/`, its other arguments holes; and, in a text of
// commands, each word, its quotes out.
function patternsOf(text, shell) {
  const holed = text.replace(HOLES, HOLE), strings = [], found = new Set();
  if (shell) for (const word of holed.replace(/["'\\]/gu, "").split(/[\s;|&<>()=,`]+/u)) found.add(word);
  const marked = holed.replace(STRING, (...string) => { strings.push(string[1] ?? string[2] ?? string[3]); return `\u0001${strings.length - 1}\u0001`; });
  const fill = (span) => span.split(/\u0001(\d+)\u0001/u).map((part, i) => (i % 2 ? strings[Number(part)] : /^[\s+]*$/u.test(part) ? "" : HOLE)).join("");
  for (const string of strings) found.add(string);
  for (const [run] of marked.matchAll(JOINED)) found.add(fill(run));
  for (const call of marked.matchAll(JOIN)) found.add(argumentsOf(marked, call.index + call[0].length).map(fill).join("/"));
  return [...found].map((pattern) => pattern.replace(/\u0000+/gu, HOLE)).filter((pattern) => pattern.includes(HOLE));
}
// a call's arguments, from just after its opening bracket to the one that closes it
function argumentsOf(text, from) {
  const args = [""];
  for (let at = from, depth = 1; at < text.length; at++) {
    const c = text[at];
    depth += c === "(" ? 1 : c === ")" ? -1 : 0;
    if (depth === 0) break;
    if (c === "," && depth === 1) args.push(""); else args[args.length - 1] += c;
  }
  return args;
}
// the files a built name may be, each pattern read once a tree: none where it holds no `/` or `.`, or no fixed text
// besides its ending
function fitting(pattern, { runs, fits }) {
  if (fits.has(pattern)) return fits.get(pattern);
  const lead = pattern.match(/^(?:\u0000|\.{1,2}\/|\/)*/u)[0], rest = pattern.slice(lead.length);
  let fit = [];
  if (/[/.]/u.test(pattern) && /[A-Za-z0-9_]/u.test(rest.replace(/\.[A-Za-z0-9]+$/u, ""))) {
    const start = lead.endsWith(HOLE) ? "^.*" : String.raw`^(?:.*[/\s])?`;
    const shapes = rest.includes("/") ? [rest] : [rest, rest.replace(/\./gu, "/")];
    const tests = shapes.map((shape) => new RegExp(`${start}${shape.split(HOLE).map(escaped).join(".*")}${shape.endsWith(HOLE) ? "" : ENDING}`, "u"));
    fit = runs.filter((name) => tests.some((test) => test.test(name)));
  }
  fits.set(pattern, fit);
  return fit;
}
const escaped = (text) => text.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");

// What a module that loads by a name of holes alone may load (way 3): every file below its own folder where the name
// starts `./` or `../`; and below each folder of the tree a plain string names, from the module's own folder or the
// root, on a line that loads by import( or require(, or on a line that sets a name such a line uses (settingOf).
function loadable(name, text, { runs, folders }) {
  const folder = path.posix.dirname(name), under = new Set();
  // (a load's brackets opened on one line and its name on the next are read as one line)
  const lines = text.replace(/\([ \t]*\n\s*/gu, "(").split("\n"), loading = lines.flatMap((line, at) => (LOADS.test(line) ? [at] : []));
  for (const [, up] of loading.map((at) => lines[at]).join("\n").matchAll(/[`"'](\.{1,2}\/(?:\.\.\/)*)(?:\$\{|["'][ \t]*\+)/gu)) under.add(path.posix.join(folder, up, "."));
  for (const line of settingOf(lines, loading)) for (const [, double, single] of line.matchAll(/"([^"$\n]*)"|'([^'$\n]*)'/gu)) {
    const named = (double ?? single).replace(/^(?:\.\/)+|\/+$/gu, "");
    for (const at of named === "" ? [] : [path.posix.normalize(path.posix.join(folder, named)), named]) if (at !== "." && at !== folder && !at.startsWith("../") && [...folders].some((f) => f === at || f.startsWith(`${at}/`))) under.add(at);
  }
  return runs.filter((other) => [...under].some((at) => other.startsWith(`${at}/`)));
}
// The loading lines and the lines that set a name they use, followed back through the names those use in turn: a
// declaration at the top level or in a loading line's own top-level block (one in another block is that block's own),
// an assignment anywhere.
const IDENTIFIER = /[A-Za-z_$][\w$]*/gu, SETS = /\b(?:const|let|var)[ \t]+[[{]?[ \t]*([A-Za-z_$][\w$]*)|(?:^|[\s;(,])([A-Za-z_$][\w$]*)[ \t]*=(?![=>])/gu;
function settingOf(lines, loading) {
  const top = lines.map((line) => /^[^\s})\]]/u.test(line)), blockOf = [];
  lines.forEach((line, at) => blockOf.push(top[at] || at === 0 ? at : blockOf[at - 1]));
  const near = new Set(loading.map((at) => blockOf[at])), taken = new Set(loading), used = new Set(loading.flatMap((at) => lines[at].match(IDENTIFIER) ?? []));
  const sets = (line, at) => [...line.matchAll(SETS)].some(([, declared, assigned]) => used.has(declared ?? assigned) && (assigned !== undefined || top[at] || near.has(blockOf[at])));
  for (let more = true; more;) {
    more = false;
    for (const [at, line] of lines.entries()) if (!taken.has(at) && sets(line, at)) { taken.add(at); more = true; for (const id of line.match(IDENTIFIER) ?? []) used.add(id); }
  }
  return [...taken].map((at) => lines[at]);
}

// A tree on disk: every file under `root`, .git and node_modules aside.
export function diskTree(root) {
  const paths = [];
  const walk = (at) => {
    for (const entry of readdirSync(path.join(root, at), { withFileTypes: true })) {
      const name = at ? `${at}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { if (entry.name !== ".git" && entry.name !== "node_modules") walk(name); }
      else if (entry.isFile() || entry.isSymbolicLink()) paths.push(name);
    }
  };
  walk("");
  const read = (name) => {
    try { const file = path.join(root, name); return statSync(file).size > LARGEST ? null : readFileSync(file, "utf8"); } catch { return null; }
  };
  return { paths, read };
}

const git = (args, cwd, input) => execFileSync("git", args, { cwd, input, encoding: "utf8", stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"], maxBuffer: 1 << 28 });
// A tree of a commit in the git repository at `cwd`, its texts read in one call of git's, never checked out.
export function gitTree(commit, cwd) {
  const entries = git(["ls-tree", "-r", "-z", "--full-tree", "-l", commit], cwd).split("\0").filter(Boolean).map((line) => {
    const [meta, name] = line.split("\t");
    const [, type, sha, size] = meta.split(/ +/u);
    return { name, type, sha, size: Number(size) };
  }).filter((entry) => entry.type === "blob");
  const wanted = entries.filter((entry) => WORKFLOW.test(entry.name) || SCRIPT.test(entry.name) || unextended(entry.name) || placed(entry.name));
  const texts = new Map();
  const small = wanted.filter((entry) => entry.size <= LARGEST);
  if (small.length) {
    const out = execFileSync("git", ["cat-file", "--batch"], { cwd, input: small.map((entry) => entry.sha).join("\n") + "\n", maxBuffer: 1 << 28 });
    let at = 0;
    for (const entry of small) {
      const end = out.indexOf(10, at);
      const size = Number(out.subarray(at, end).toString("utf8").split(" ")[2]);
      texts.set(entry.name, out.subarray(end + 1, end + 1 + size).toString("utf8"));
      at = end + 1 + size + 1;
    }
  }
  return { paths: entries.map((entry) => entry.name), read: (name) => texts.get(name) ?? null };
}

// The paths of a pull request's files (`files`, as GitHub's API gives them, a moved file by both its names) in any of `sets`.
export const powerOf = (files, ...sets) => [...new Set(flat(files).flatMap((file) => [file.filename, file.previous_filename])
  .filter((name) => typeof name === "string" && sets.some((set) => set.has(name))))].sort();

const flat = (pages) => (Array.isArray(pages) ? pages.flat() : []).filter((entry) => entry !== null && typeof entry === "object");

// Of a pull request's commits (`commits`, as GitHub's API gives them), the light ones: one parent, that parent a commit
// of the pull request's, and no path it changes in the set at the parent or at the commit, read with `setAt(commit)`
// and `changed(parent, commit)`; the newest first, until `deadline` (a time in milliseconds) passes.
export function lightOf(commits, { setAt, changed, deadline = Infinity, now = Date.now }) {
  const list = flat(commits).filter((commit) => typeof commit.sha === "string" && SHA.test(commit.sha));
  const ours = new Set(list.map((commit) => commit.sha));
  const light = [];
  for (const commit of [...list].reverse()) {
    if (now() > deadline) break;
    const parents = commit.parents;
    if (!Array.isArray(parents) || parents.length !== 1 || !ours.has(parents[0]?.sha)) continue;
    try {
      const names = changed(parents[0].sha, commit.sha);
      const before = setAt(parents[0].sha), after = setAt(commit.sha);
      if (!names.some((name) => before.has(name) || after.has(name))) light.push(commit.sha);
    } catch { /* a commit not read is not light */ }
  }
  return light;
}

if (started(import.meta.url)) {
  const args = process.argv.slice(2);
  const fail = (why, mend) => { console.error(`FAIL: scripts/power.mjs ${why}. Mend: ${mend}`); process.exit(1); };
  if (args[0] === "--list") {
    const root = args[1] ?? ".";
    if (!existsSync(root)) fail(`found no folder ${root}`, "give the folder of a repository's checkout, or none for the one you stand in");
    const copy = existsSync(path.join(root, "core-manifest.md")) ? (await import("./core-path.mjs")).copyOf(root) : undefined;
    const why = new Map();
    for (const name of [...setOf({ ...diskTree(root), copy }, why)].sort()) console.log(`${name}\t${why.get(name)}`);
    process.exit(0);
  }
  const [pullFile, commitsFile, filesFile, baseDir] = args;
  if (!pullFile || !commitsFile || !filesFile || !baseDir) {
    console.error("usage: node scripts/power.mjs <the pull request, as JSON> <its commits, as JSON> <its files, as JSON> <the default branch's checkout>");
    process.exit(2);
  }
  const read = (file) => {
    try { return JSON.parse(readFileSync(file, "utf8")); }
    catch (e) { return fail(`could not read ${file} as JSON (${e.code ?? e.name})`, "write it again from the GitHub API, as the security-review workflow does, and run the check again"); }
  };
  const pull = read(pullFile), commits = read(commitsFile), files = read(filesFile);
  const head = pull?.head?.sha;
  if (typeof head !== "string" || !SHA.test(head)) fail("was given a pull request with no head commit", "give it the pull request as GitHub's API gives it");
  const copy = existsSync(path.join(baseDir, "core-manifest.md")) ? (await import("./core-path.mjs")).copyOf(baseDir) : undefined;
  const sets = new Map();
  const setAt = (commit) => { if (!sets.has(commit)) sets.set(commit, setOf({ ...gitTree(commit, "."), copy })); return sets.get(commit); };
  const changed = (parent, commit) => git(["diff-tree", "-r", "-z", "--no-renames", "--name-only", parent, commit], ".").split("\0").filter(Boolean);
  const deadline = Number(process.env.DEADLINE) * 1000 || Infinity;
  let atHead;
  try { atHead = setAt(head); } catch (e) { fail(`could not read the head ${head} in this clone (${e.code ?? e.name})`, "run it in a clone that holds the head's commits, as the security-review workflow fetches them"); }
  const power = powerOf(files, setOf({ ...diskTree(baseDir), copy }), atHead);
  console.log(JSON.stringify({ power, light: lightOf(commits, { setAt, changed, deadline }) }));
}
