#!/usr/bin/env node
// What runs with power, and which later commits of a pull request touch none of it (#1134, points 1 and 4;
// tasks/reviews.md, "What a posted review stands for"). The set, as this script reads it from a tree of the repository:
//   - a workflow (.github/workflows/) with a write permission, a secret, or no top-level `permissions:`, where the
//     host's default token, which may write, is what it gets;
//   - an action (an action.yml or action.yaml in any folder);
//   - .claude/, and what comment-only.mjs, beside this file, reads as running by itself beyond .github/ (RUNS_TOO: an
//     agent tool's own folder, hooks, the files that say what installs or builds), the copy of the core aside;
//   - what such a file runs or loads: a path it names (a root-relative one, or one relative to its own folder) that is
//     a script, an action or a file with no extension (an executable such as `./deploy`), and a workflow it calls (`uses:`), followed on through what that names in turn, and, where a script of the
//     set loads a module by a name it builds (an `import(` or `require(` of no plain string), the scripts directly in
//     each folder it names (one that names none loads what its caller names, which is followed from the caller);
//   - a script whose own text calls GitHub, the network or `git push` (CALLS), a file with no extension whose text
//     starts with `#!` among them.
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
// what a workflow's line says of power, comment lines aside: a write permission (`<scope>: write`), write-all, or a
// secret other than the token the job's own permissions bound (secrets.GITHUB_TOKEN)
const POWERED = /(?:^|\n)[ \t]*[^#\n][^\n]*?(?:\bwrite-all\b|\b[a-z-]+[ \t]*:[ \t]*["']?write["']?[ \t]*(?:[,}#]|\n|$)|\bsecrets(?:\.(?!GITHUB_TOKEN\b)|\[|[ \t]*:[ \t]*inherit\b))/u;
const PERMISSIONS = /(?:^|\n)permissions[ \t]*:/u;
// a call to GitHub, the network or `git push`, as a script's text shows it
export const CALLS = /\bfetch[ \t]*\(|\bnode:(?:https?|http2|net|tls|dgram)\b|\brequire\([ \t]*["'](?:https?|http2|net|tls|dgram)["']|\bXMLHttpRequest\b|\bWebSocket\b|\bcurl\b|\bwget\b|\bInvoke-(?:WebRequest|RestMethod)\b|\burllib\b|\brequests\.(?:get|post|put|patch|delete|request)\b|\bgh[ \t]+(?:api|pr|issue|release|run|repo|workflow|auth|secret|label|search)\b|["']gh["']|api\.github\.com|\bGH_TOKEN\b|\bGITHUB_TOKEN\b|\bgit[ \t]+(?:push|fetch|clone|pull|ls-remote)\b|["'](?:push|fetch|clone|pull|ls-remote)["']/u;
// a module loaded by a name built at run time: an import( or require( whose argument is no plain string
const BUILT = /(?:^|\n)[ \t]*(?!\/\/|\*|#)[^\n]*?\b(?:import|require)[ \t]*\([ \t]*(?!["'][^"'\n$]*["'][ \t]*[,)])/u;
// a module's own code, whose names lead from its own folder alone (a root-relative path in it is text it prints)
const MODULE = /\.(?:[cm]?[jt]sx?)$/iu;
// a module's code with its strings left empty and its comments out, for BUILT to read (a template with a `${` stays
// whole, being built)
const code = (text) => text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\$]|\\.|\$(?!\{))*`/gu,
  (found) => (/^["'`]/u.test(found) ? '""' : " "));
// the names a text may give a path by
const TOKENS = /[A-Za-z0-9_@.+~/-]+/gu;
// the largest text read: a file past it is held in the set, unread
const LARGEST = 1 << 20;

// whether a workflow's text gives it power
export const powered = (text) => text === null || POWERED.test(text) || !PERMISSIONS.test(text);
// whether a path is in the set by where it stands alone
// whether a path has no extension: an executable named so (`deploy`, `bin/release`) is run as a script is
const unextended = (name) => path.posix.extname(name) === "";
const placed = (name) => ACTION.test(name) || name.startsWith(".claude/") || RUNS_TOO.test(name);

// The set of a tree: `paths`, every file's path; `read(path)`, its text, or null where it cannot be read or is too large;
// `copy`, the folder of the core's copy, left out (only a sync changes it, its code reviewed in the core's own pull
// request). `why`, where given, is filled with what brought each path in.
export function setOf({ paths, read, copy }, why = new Map()) {
  const own = paths.filter((name) => typeof name === "string" && !(copy && name.startsWith(copy)) && !name.startsWith("core/"));
  const all = new Set(own);
  const set = new Set(), queue = [];
  const add = (name, from) => { if (!set.has(name)) { set.add(name); queue.push(name); why.set(name, from); } };
  for (const name of own) { const seed = seedOf(name, read); if (seed) add(name, seed); }
  for (let i = 0; i < queue.length; i++) {
    const name = queue[i], text = read(name);
    if (text !== null) for (const [other, from] of loadsOf(name, text, all, own)) add(other, from);
  }
  return set;
}
// why a file is in the set by itself (power, place, unread or calls), or null where it is not
function seedOf(name, read) {
  if (WORKFLOW.test(name)) return powered(read(name)) ? "power" : null;
  if (placed(name)) return "place";
  if (!SCRIPT.test(name)) { const text = unextended(name) ? read(name) : null; return text !== null && text.startsWith("#!") && CALLS.test(text) ? "calls" : null; }
  const text = read(name);
  if (text === null) return "unread";
  return CALLS.test(text) ? "calls" : null;
}
// what a file of the set runs or loads, each [path, what brought it in]
function loadsOf(name, text, all, own) {
  const found = [...namedIn(name, text, all)].map((other) => [other, name]);
  if (SCRIPT.test(name) && BUILT.test(MODULE.test(name) ? code(text) : text)) found.push(...[...loadable(name, text, own)].map((other) => [other, `${name} (built)`]));
  return found;
}
// the scripts and actions of `all` a file's text names, by a path from the repository's root or from its own folder,
// and the workflows it calls (`uses: ./.github/workflows/...`): a workflow it only names, it does not run
function namedIn(name, text, all) {
  const folder = path.posix.dirname(name), found = new Set();
  for (const [token] of text.matchAll(TOKENS)) {
    const bare = token.replace(/^\/+/u, "").replace(/[.]+$/u, "");
    const from = [path.posix.normalize(path.posix.join(folder, bare)), ...(MODULE.test(name) ? [] : [bare.replace(/^(?:\.\/)+/u, "")])];
    for (const at of from) {
      if (all.has(at) && at !== name && (SCRIPT.test(at) || ACTION.test(at) || unextended(at))) found.add(at);
    }
  }
  for (const [, called] of text.matchAll(/(?:^|\n)[ \t-]*uses[ \t]*:[ \t]*["']?\.\/(\.github\/workflows\/[^\s"'@#]+)/gu)) if (all.has(called)) found.add(called);
  return found;
}

// What a script that loads a module by a name it builds may load: the scripts directly in each folder of the tree that a
// string names (from the root, or from the script's own folder) on a line that loads so, or on the line that sets a
// name such a line uses (`const FOLDER = ...`). A built name that holds no such string comes from what calls the script,
// which names the module itself, or from a package installed by what is in the set by its place.
function loadable(name, text, own) {
  const folder = path.posix.dirname(name), folders = new Set(own.map((other) => path.posix.dirname(other)));
  const lines = text.split("\n"), loading = lines.filter((line) => BUILT.test(line));
  const used = new Set(loading.flatMap((line) => line.match(/[A-Za-z_$][\w$]*/gu) ?? []));
  const setting = lines.filter((line) => [...line.matchAll(/\b(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*=/gu)].some(([, id]) => used.has(id)));
  const named = new Set();
  for (const line of [...loading, ...setting]) {
    for (const [, quoted] of line.matchAll(/["'`]([^"'`\s$]+)["'`]/gu)) {
      const bare = quoted.replace(/^(?:\.\/)+|\/+$/gu, "");
      for (const at of [path.posix.normalize(path.posix.join(folder, bare)), bare]) if (at !== "." && at !== folder && folders.has(at)) named.add(at);
    }
  }
  return own.filter((other) => SCRIPT.test(other) && named.has(path.posix.dirname(other)));
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
