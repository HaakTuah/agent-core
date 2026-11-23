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
//   - what such a file runs or loads, or may, of the files that may run (a script, an action, a file with no extension
//     such as `./deploy`). A text is asked for names and folders alone: never which call takes a name, on which line it
//     stands, how it is quoted, or which name feeds which, since each such question has a form that answers it wrongly.
//     Its whole text is read, comments and strings too: a reader of comments that loses its place hides the code after
//     it. Names are read in any letters, as a file system that holds `Lib` and `lib` as one does, and in those of any
//     writing. A file read as running that does not costs a review; one that runs and is not read is the error. Four
//     ways:
//       1. a name written whole: each word (a run of TOKENS, read again with %XX, \xXX and \uXXXX decoded), by its
//          last part and each part of that between dots, names each file of that last name in any folder, with any
//          ending a language adds (`helper` for helper.js, helper.py or helper.rb) or as the index.js, __init__.py,
//          __main__.py or init.lua of a folder of that name; so a folder it leads from, a space or a quote cannot hide
//          it; strings joined alone (by `+`, `..` or ` . `) are read as the one name they make;
//       2. a folder written whole: the same last part of a word (`tools/kinds`, `./kit/`, `"kinds"`), and its parts
//          between dots as a path (`tools.kinds`), names each folder of that name in any folder, and every file below
//          it joins: whatever builds a name inside it (a load, a process, a shell's `.` or its glob, a Python import),
//          on that line or another, in that file or in one that hands it the folder. A path whose last part names
//          nothing in the folder written before it (`kinds/p-`, the rest built in whatever form) names the same way
//          the nearest folder it writes that the tree holds;
//       3. a folder written nowhere: each file of the set brings in the files of its own folder and of each folder
//          above it, up to the root, where a name led by a call that finds the folder, a bare name and a glob at the
//          working directory lead; and a name built of holes alone that starts `./` or `../` brings in every file
//          below the folder it starts from: the file's own, or the root for a workflow, whose steps start there;
//       4. a name built of fixed text and holes (a `${}`, a shell's `$NAME` and `$()`, a format's `{}`, `%s` and
//          `%(name)s`, Ruby's `#{}`, a batch file's `%NAME%`, a glob's `*` and `?`; a string joined to code by `+`,
//          `/`, `..` or ` . `, the strings of a `join(`/`resolve(` call; a word; a `\` between folders read as a `/`
//          too): each file whose path holds its fixed text in order, a hole standing for any run of characters, the
//          first at the start of a folder's name unless a hole comes first, the last at the path's end, before an
//          ending, or as a folder's name, every file below it; one with neither `/` nor `.` stands for one part of a
//          path, and only with three letters or digits in a row, less fitting every name;
//     and a workflow it calls (`uses:`), followed on through what each names in turn.
//     What these do not read, no text of the set writing it: a folder a walk finds from above it (`find .`, `**`, a
//     loop within a loop, a test runner's own search), below a file's own folder or the working directory, written
//     nowhere and not led to by `./`; a name or a folder kept in what is no file that may run (a list in JSON, a
//     command's output, a variable set outside the repository); a name no part of which is written whole (each
//     folder's and the file's built), its holes or joins in a form not listed above, or its fixed text under three
//     letters or digits in a row with neither `/` nor `.`; a name hidden on purpose (encoded, joined from a list); a
//     `./` in a script run from another folder than its own; what a link leads to in a tree read from disk (one to a
//     folder is not walked, one to a file reads as that file; in a commit a link is a file that holds its path, read
//     as any text); what a file too large to read runs; and a file of a language SCRIPT does not list;
//   - a file that may run and that no text can name, a part of its path holding nothing a word is made of (a folder
//     `(!)`), held as a script too large to read is;
//   - a script whose own text calls GitHub, the network or `git push` (CALLS, a list of forms), or loads a module by a
//     plain name that is no path and none of Node's own modules that reach nothing beyond the machine (LOCAL): a package
//     (axios), or https; or by a name it builds that does not start as a path (UNPLACED), which may be a package's; a
//     file with no extension whose text starts with `#!` among them. A load in a string or a comment counts.
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
// `require("y")`, `module.require("y")`, `require 'y'`), wherever the text holds it, or by a name built at run time that
// does not start as a path or a file's URL (UNPLACED); and Node's own modules that reach nothing beyond the machine: any
// other name that is no path (a package, `https`, `node:dns`, a URL), and any built one, may call out
const LOCAL = new Set(["assert", "async_hooks", "buffer", "child_process", "cluster", "console", "constants", "crypto", "diagnostics_channel", "events", "fs", "module", "os", "path", "perf_hooks", "process", "querystring", "readline", "stream", "string_decoder", "test", "timers", "tty", "url", "util", "v8", "vm", "worker_threads", "zlib"]);
const PLAIN = /(?:(?:^|[^\w$.])from|(?:^|[^\w$])(?:import|require))\s*\(?\s*["'`]([^"'`\s\\]+)["'`]/gu;
const UNPLACED = /\b(?:import|require)[ \t]*\([ \t]*(?!["'][^"'\n$]*["'][ \t]*[,)]|[`"'](?:\.{0,2}\/)|[\w.]*pathToFileURL\()/u;
const outward = (text) => UNPLACED.test(text) || [...text.matchAll(PLAIN)].some(([, name]) => !/^(?:\.{0,2}\/|#|file:)/u.test(name) && !LOCAL.has(name.replace(/^node:/u, "").split("/")[0]));
// the names a text may give a path by: its runs of TOKENS and, where it holds letters beyond those, its runs of WIDE
// too, the letters of any writing (a text and a path are each brought to one form, NFC, before they are asked); and a
// text with the escapes a name may be written in decoded
const TOKENS = /[A-Za-z0-9_@.+~/-]+/gu, WIDE = /[\p{L}\p{M}\p{N}_@.+~/-]+/gu;
const tokens = (text) => { const plain = text.match(TOKENS) ?? []; return /[^\u0000-\u007f]/u.test(text) ? plain.concat(text.match(WIDE) ?? []) : plain; };
const decoded = (text) => text.replace(/%([0-9A-Fa-f]{2})|\\x([0-9A-Fa-f]{2})|\\u([0-9A-Fa-f]{4})|\\u\{([0-9A-Fa-f]{1,6})\}/gu,
  (found, ...hex) => { const at = parseInt(hex.slice(0, 4).find((part) => part !== undefined), 16); return at <= 0x10ffff ? String.fromCodePoint(at) : found; });
// the endings a language adds to a name given without one (Node, Python, PowerShell, Windows, Ruby, Lua), and the
// files a folder's name runs
const ENDS = ["", ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".jsx", ".tsx", ".py", ".ps1", ".psm1", ".cmd", ".bat", ".rb", ".lua"];
const INSIDE = new Set([...ENDS.slice(1, 9).map((end) => `index${end}`), "__init__.py", "__main__.py", "init.lua"]);
// a hole in a built name, the text in small letters. A text is read twice (READINGS), each with the holes and the
// strings it knows: once with every hole a language writes, a `$()` and a `{}` whole among them, and a string between
// backticks one string; once with neither of those, so a text that pairs its brackets or its backticks otherwise than
// the first reads them (a block on one line, a backtick alone) loses no name it builds. A format's two holes with
// letters between them (`%s_%s`) are no batch file's `%NAME%`
const HOLE = "\u0000";
const ATOMS = String.raw`\$\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\$[a-z_]\w*(?::\w+)?|\$[0-9@*#?!]|#\{[^{}\n]*\}|%~[a-z]*\d|%[a-z_]\w*%(?![sdifr])|%%~?[a-z]|![a-z_]\w*!|%\([^()\n]*\)[sdifr]|%[-#0 +]*\d*(?:\.\d+)?[sdifr]|[*?]+`;
const QUOTED = String.raw`"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'`;
const READINGS = [[new RegExp(String.raw`\$\((?:[^()]|\([^()]*\))*\)|\{[^{}\n]*\}|${ATOMS}`, "gu"), new RegExp(`\`([^\`]*)\`|${QUOTED}`, "gu")], [new RegExp(ATOMS, "gu"), new RegExp(QUOTED, "gu")]];
// a run of strings and code joined by `+` or `/`, by Lua's `..`, or by the ` . ` of PHP and Perl
const OPERAND = String.raw`[\w$.\[\]\u0000]+(?:\([^()\n]*\))?`, MARK = String.raw`\u0001\d+\u0001`;
const BY = String.raw`\s*(?:[+/]|\.\.|(?<=\s)\.(?=\s))\s*`;
const JOINED = new RegExp(String.raw`(?:${OPERAND}${BY})*${MARK}(?:${BY}(?:${MARK}|${OPERAND}))*`, "gu");
const JOIN = /\b(?:join|resolve|joinpath|join-path)[ \t]*\(/gu;
// where a built name may end: as written, with an ending, or as a folder, every file below it
const ENDING = String.raw`(?:\.[^/]*|/.*)?$`;
// the largest text read: a file past it is held in the set, unread, as is one no word can name (wordless)
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
// whether no text can name a path: a part of it holds nothing a word is made of (`(!)/run.sh`), so it is held, unread
const wordless = (name) => name.toLowerCase().split("/").some((part) => tokens(part).length === 0);

// The set of a tree: `paths`, every file's path; `read(path)`, its text, or null where it cannot be read or is too large;
// `copy`, the folder of the core's copy as the manifest names it, left out (only a sync changes it, its code reviewed in
// the core's own pull request; a repository whose manifest names none, the core's own among them, leaves out nothing).
// `why`, where given, is filled with what brought each path in.
export function setOf({ paths, read: raw, copy }, why = new Map()) {
  const read = (name) => lf(raw(name));
  const own = paths.filter((name) => typeof name === "string" && !(typeof copy === "string" && copy !== "" && name.startsWith(copy)));
  const tree = treeOf(own, paths);
  const set = new Set(), queue = [];
  const add = (name, from) => { if (!set.has(name)) { set.add(name); queue.push(name); why.set(name, from); } };
  for (const name of own) { const seed = seedOf(name, read); if (seed) add(name, seed); }
  for (let i = 0; i < queue.length; i++) for (const [other, from] of loadsOf(queue[i], read(queue[i]), tree)) add(other, from);
  return set;
}
// why a file is in the set by itself (power, place, unread or calls), or null where it is not
function seedOf(name, read) {
  if (WORKFLOW.test(name)) return powered(read(name)) ? "power" : null;
  if (placed(name)) return "place";
  if (runnable(name) && wordless(name)) return "unread";
  if (!SCRIPT.test(name)) { const text = unextended(name) ? read(name) : null; return text !== null && text.startsWith("#!") && calls(text) ? "calls" : null; }
  const text = read(name);
  if (text === null) return "unread";
  return calls(text) ? "calls" : null;
}
const calls = (text) => CALLS.test(text) || outward(text);
// What a file of the set runs or loads, each path with what brought it in: the files beside it and beside each folder
// above it (way 3), then, from its text in small letters, what it builds (way 4), every file below the folder a built
// name of holes alone starts from with `./` or `../` (way 3), and what it names whole (ways 1 and 2).
function loadsOf(name, text, tree) {
  const found = new Map(), folder = path.posix.dirname(name);
  const take = (files, from) => { for (const other of files ?? []) if (!found.has(other)) found.set(other, from); };
  for (let at = folder; ; at = path.posix.dirname(at)) { take(tree.inside.get(at), name); if (at === ".") break; }
  if (text === null) return found;
  const low = text.toLowerCase().normalize("NFC").replace(/[\u0000\u0001]/gu, " "), { built, whole } = patternsOf(low);
  for (const pattern of built) {
    take(fitting(pattern, tree), `${name} (built)`);
    const up = fixed(pattern) ? undefined : pattern.match(/^(?:\.{1,2}\/)+/u)?.[0];
    if (up) { const from = path.posix.join(WORKFLOW.test(name) ? "." : folder, up, "."); take(from === "." ? tree.runs : tree.below.get(from), `${name} (built)`); }
  }
  take(namedIn(whole.length ? `${low}\n${whole.join("\n")}` : low, tree), name);
  return found;
}

// The files that may run, as a text may name them, each key in small letters. `byLast`: by each key a word names a
// file by, its last part, each run of TOKENS in it (`my helper.mjs` by `helper.mjs`), each also without the ending a
// language adds (`helper`), and, for a folder's index.js, __init__.py, __main__.py or init.lua, the folder's name in
// the same ways. `named`: the folders that hold one, at any
// depth, by the same keys of their own names; `below`, each folder's files at any depth; `inside`, the files of each
// folder itself (the root is `.`); `flows`, every path of the tree, for a workflow called; `pairs`, each part of a
// path of `all` (the copy's too) with the part before it, by which a path a text writes is known to name something.
function treeOf(own, all) {
  const runs = own.filter(runnable), byLast = new Map(), named = new Map(), below = new Map(), inside = new Map(), flows = new Map(), pairs = new Set();
  const add = (map, key, at) => { if (map.has(key)) map.get(key).push(at); else map.set(key, [at]); };
  const keysOf = (part) => new Set([part, ...tokens(part)]);
  const bare = (key) => ENDS.filter((end) => end !== "" && key.length > end.length && key.endsWith(end)).map((end) => key.slice(0, -end.length));
  const filed = (part) => new Set([...keysOf(part)].flatMap((key) => [key, ...bare(key)]));
  const lastOf = (name) => path.posix.basename(name).toLowerCase().normalize("NFC");
  for (const name of own) add(flows, name.toLowerCase(), name);
  for (const name of all) if (typeof name === "string") name.toLowerCase().normalize("NFC").split("/").forEach((part, i, parts) => { if (i) pairs.add(`${parts[i - 1]}/${part}`); });
  for (const name of runs) {
    const last = lastOf(name), folder = path.posix.dirname(name);
    for (const key of filed(last)) add(byLast, key, name);
    if (INSIDE.has(last)) for (const key of filed(lastOf(folder))) add(byLast, key, name);
    add(inside, folder, name);
    for (let at = folder; at !== "."; at = path.posix.dirname(at)) {
      if (!below.has(at)) for (const key of keysOf(lastOf(at))) add(named, key, at);
      add(below, at, name);
    }
  }
  const forms = runs.map((name) => name.toLowerCase().normalize("NFC"));
  return { flows, runs, forms, byLast, named, below, inside, pairs, fits: new Map(), text: forms.join("\n") };
}
// What a text names whole (ways 1 and 2): each word's last part, and each part of it between dots (`tools.jobs.run`),
// as a key of the files, bare or with each ending; the same last part as a folder's name, and its parts between dots
// as a folder's path (`tools.kinds`), every file below it; where the folder written before the last part holds nothing
// of that name, the nearest folder the word writes; and a workflow a `uses:` calls.
function namedIn(text, { flows, byLast, named, below, pairs }) {
  const found = new Set(), take = (files) => { for (const at of files ?? []) found.add(at); };
  const look = (key) => take(byLast.get(key));
  const under = (name, above) => { for (const folder of named.get(name) ?? []) if (above === "" || `/${path.posix.dirname(folder)}`.toLowerCase().normalize("NFC").endsWith(`/${above}`)) take(below.get(folder)); };
  const nearest = (above, last) => { if (above.length && !ENDS.some((end) => pairs.has(`${above.at(-1)}/${last}${end}`))) under(above.findLast((part) => named.has(part)) ?? "", ""); };
  const words = new Set([...tokens(text), ...(/[%\\]/u.test(text) ? tokens(decoded(text).toLowerCase().normalize("NFC")) : [])]);
  for (const word of words) {
    const above = (word.includes("..") ? path.posix.normalize(word) : word).replace(/[./]+$/u, "").split("/"), last = above.pop();
    if (last === "") continue;
    look(last);
    under(last, "");
    nearest(above, last);
    const parts = last.includes(".") ? last.split(".").filter((part) => part !== "") : [];
    for (const part of parts) look(part);
    if (parts.length) under(parts.at(-1), parts.slice(0, -1).join("/"));
  }
  for (const [, called] of text.matchAll(/(?:^|\n)[ \t-]*uses[ \t]*:[ \t]*["']?\.\/(\.github\/workflows\/[^\s"'@#]+)/gu)) take(flows.get(called));
  return found;
}

// The names a text builds (way 4), in each reading of it: each word, its quotes out; each string, its holes marked;
// each run of strings and code joined (JOINED), the code a hole; and the strings of each join( or resolve( call,
// joined by `/`, its other arguments holes; each with a `\` also as one with a `/` there. `built` are those with a
// hole; `whole`, the runs of strings alone, which name a file as a word does (`"./hel" + "per.cjs"`).
function patternsOf(text) {
  const built = new Set(), whole = new Set();
  const keep = (name) => { if (name.includes(HOLE)) for (const form of name.includes("\\") ? [name, name.replace(/\\+/gu, "/")] : [name]) built.add(form.replace(/\u0000+/gu, HOLE)); };
  for (const [holes, string] of READINGS) {
    const holed = text.replace(holes, HOLE), strings = [];
    for (const word of holed.split(/[\s;|&<>()=,`]+/u)) {
      const quoteless = word.replace(/["']/gu, ""), bare = quoteless.replace(/\\/gu, "");
      if (bare.includes(HOLE)) { keep(bare); keep(quoteless); }
    }
    const marked = holed.replace(string, (...found) => { strings.push(found[1] ?? found[2] ?? found[3]); return `\u0001${strings.length - 1}\u0001`; });
    const fill = (span) => span.split(/\u0001(\d+)\u0001/u).map((part, i) => (i % 2 ? strings[Number(part)] : /^[\s+.]*$/u.test(part) ? "" : HOLE)).join("");
    for (const found of strings) keep(found);
    for (const [run] of marked.matchAll(JOINED)) { const name = fill(run); if (name.includes(HOLE)) keep(name); else if (run.split("\u0001").length > 3) whole.add(name); }
    for (const call of marked.matchAll(JOIN)) keep(argumentsOf(marked, call.index + call[0].length).map(fill).join("/"));
  }
  return { built: [...built], whole: [...whole] };
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
// whether a built name holds fixed text besides what leads it (holes, `./`, `../`, `/`) and its ending
const LEAD = /^(?:\u0000|\.{1,2}\/|\/)*/u;
const fixed = (pattern) => /[\p{L}\p{N}_]/u.test(pattern.replace(LEAD, "").replace(/\.[A-Za-z0-9]+$/u, ""));
// The files a built name may be, each pattern read once a tree: none where it holds no fixed text besides its ending,
// or fixed text no path holds. One with a `/` or a `.` is held by a path in order, a hole any run of characters. One
// with neither stands for one part of a path, a file's name or a folder's, a hole any run within it, and only where
// three letters or digits of it stand in a row: shorter fixed text (`${n}s`) fits every name and so reads nothing.
function fitting(pattern, { runs, forms, fits, text }) {
  if (fits.has(pattern)) return fits.get(pattern);
  const lead = pattern.match(LEAD)[0], rest = pattern.slice(lead.length), held = (shape) => shape.split(HOLE).every((part) => text.includes(part));
  let shapes = [];
  if (!fixed(pattern)) shapes = [];
  else if (!/[/.]/u.test(pattern)) shapes = /[\p{L}\p{N}_]{3}/u.test(pattern) && held(pattern) ? [`^(?:.*/)?${pattern.split(HOLE).map(escaped).join("[^/]*")}${ENDING}`] : [];
  else {
    const start = lead.endsWith(HOLE) ? "^.*" : String.raw`^(?:.*[/\s])?`;
    shapes = (rest.includes("/") ? [rest] : [rest, rest.replace(/\./gu, "/")]).filter(held).map((shape) => `${start}${shape.split(HOLE).map(escaped).join(".*")}${shape.endsWith(HOLE) ? "" : ENDING}`);
  }
  const tests = shapes.map((shape) => new RegExp(shape, "iu")), fit = tests.length ? runs.filter((name, i) => tests.some((test) => test.test(forms[i]))) : [];
  fits.set(pattern, fit);
  return fit;
}
const escaped = (text) => text.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");

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
