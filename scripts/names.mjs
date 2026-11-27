// Names in the descriptions ("No description left untrue" in roles/shared/how-to-work.md; #460, point 4), read by the
// pointer check (pointers.mjs, beside this file): what a description puts in code marks, alone in its marks, that can
// be resolved exactly, and nothing else:
//
//   `src/net.ts`, `net.ts`     a file's name, with an extension some file the project tracks has: it stands where a
//                              tracked file's or folder's path is that name or ends with "/" and that name ("./" and
//                              "../" before it read as nothing), where git ignores it, or where a tracked file of the
//                              project's own that is no Markdown (nor the list below) holds it, as the code that writes
//                              a record names it; one of more than DEEPEST segments, or past SEARCHED to search the
//                              code for, is left alone and counted
//   `npm run lint`             a script of the package file at the project's root ("scripts"), as npm, pnpm or yarn
//                              run it (`npm run-script lint`, `pnpm run lint`, `yarn run lint`, `npm test`), the name
//                              alone or followed by " -- " and its arguments; with no package file there, left alone
//
// Any other mark (a command with more words, a folder, a pattern, a name whose extension no tracked file has) is left
// alone: the check never guesses. The *descriptions* are the files the manifest's row of that slot names in code marks,
// each tracked file and each tracked Markdown file of a folder it names, and the README at the root where the row says
// "README" outside its marks, as the starter kit's row does; with no row, the project's README.md and
// AGENTS.md, where tracked (the README's table of slots); in the core's own repository, its README.md, where a path
// under core/ is the core's own, read without that folder, and one under a folder the core does not hold is a
// project's, left alone. Git and Node's own modules only.
import { spawnSync } from "node:child_process";
import { posix } from "node:path";

// A name of a file: an optional run of "./" or "../", then path parts of letters, digits and ". _ - @ +", the last
// with an extension that holds a letter. A mark with anything else (a space, "<", "*", "{", ":", "/" at its start) is
// none.
const FILE = /^(?:\.{1,2}\/)*(\.?[\w@+-][\w@+.-]*(?:\/[\w@+-][\w@+.-]*)*\.((?=[0-9]*[A-Za-z])[A-Za-z0-9]+))$/u;
const SCRIPT = /^(?:(?:npm|pnpm|yarn) run|npm run-script) ([\w:@./-]+)(?: -- .*)?$|^npm (test|t)(?: -- .*)?$/u;
/** The list of the names that stood when a project took the check, which only shrinks. */
export const LIST = "checks/names.json";

/** The names in a block's text, each { name, file, ext } or { name, script }, in the order they stand. */
export function namesIn(text) {
  const out = [];
  for (const [, mark] of String(text).matchAll(/`([^`\n]+)`/gu)) {
    const name = mark.trim(), f = FILE.exec(name), s = SCRIPT.exec(name);
    if (f) out.push({ name, file: f[1], ext: f[2] });
    else if (s) out.push({ name, script: s[1] ?? "test" });
  }
  return out;
}

/** The scripts a package file's text names, a Set, or null where there is none to read, so nothing is resolved. */
export function scriptsOf(text) {
  if (text === null || text === undefined) return null;
  try { const s = JSON.parse(text)?.scripts; return s && typeof s === "object" && !Array.isArray(s) ? new Set(Object.keys(s)) : new Set(); } catch { return null; }
}

/** The descriptions: the files the manifest's row *descriptions* names, or README.md and AGENTS.md. `{ files, unread }`,
 * `unread` saying why none was read where the row names no tracked file. */
export function descriptionsOf(manifest, tracked) {
  const row = /^\|\s*\*descriptions\*\s*\|(.*)$/mu.exec(String(manifest ?? ""))?.[1];
  if (row === undefined) return { files: ["README.md", "AGENTS.md"].filter(f => tracked.includes(f)) };
  // (the word README outside code marks, as the kit's row and the README's table write it, is the one at the root)
  const prose = /\bREADME\b/u.test(row.replace(/`[^`\n]*`/gu, "")) ? ["README.md"] : [];
  const files = [...prose, ...[...row.matchAll(/`([^`\n]+)`/gu)].map(m => m[1].replace(/^\.\//u, "").replace(/\/$/u, ""))]
    .flatMap(p => (tracked.includes(p) ? [p] : tracked.filter(f => f.startsWith(`${p}/`) && f.endsWith(".md"))));
  return files.length ? { files: [...new Set(files)] } : { files: [], unread: "the manifest's row *descriptions* names no tracked file or folder in code marks, nor the README" };
}

/** The most names it searches the project's code for, in one run: past it, a name is left alone and counted, since the
 * search's work grows with the names times what it found (#460, point 4). */
export const SEARCHED = 1000;

// Of the paths given, those that stand otherwise than as a tracked file: git ignores them, or a tracked file of the
// project's own that is no Markdown, nor the list, holds them (at `tree`, a commit, or the work tree where it is null),
// searched in one run of git for them all, the lines it finds read for each; past SEARCHED, or where git could not
// search, the rest are left alone, counted in `left`.
function elsewhere(paths, { tree, copy }) {
  if (!paths.length) return { off: new Set(), left: 0 };
  const ignored = spawnSync("git", ["check-ignore", "--stdin"], { input: paths.join("\n"), encoding: "utf8" }).stdout ?? "";
  const off = new Set(ignored.split("\n").filter(Boolean)), rest = paths.filter(x => !off.has(x));
  const spec = ["--", ".", ":(exclude,glob)**/*.md", `:(exclude)${LIST}`, ...(copy ? [`:(exclude)${copy}`] : [])];
  const r = rest.length ? spawnSync("git", ["grep", "-h", "-F", "-I", "-f", "-", ...(tree ? [tree] : []), ...spec],
    { input: rest.slice(0, SEARCHED).join("\n"), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }) : { stdout: "" };
  const lines = r.error || r.status > 1 ? null : r.stdout;
  for (const [i, p] of rest.entries()) if (i >= SEARCHED || lines === null || lines.includes(p)) off.add(p);
  return { off, left: (lines === null ? Math.min(rest.length, SEARCHED) : 0) + Math.max(0, rest.length - SEARCHED) };
}

/** The most segments a name it looks up has: a deeper one is left alone and counted, since the index of the tracked
 * paths grows with their depth times this (#460, point 4). */
export const DEEPEST = 32;

// Every run of whole segments of a tracked path, of at most `depth` segments (`a/b/c.ts` gives `a`, `a/b`, `b/c.ts`,
// `c.ts` and the rest), so that a name is looked up once, however many names and paths there are: one stands where it
// is such a run, a file or folder.
function runsOf(tracked, depth) {
  const runs = new Set();
  for (const t of tracked) {
    const s = t.split("/");
    for (let i = 0; i < s.length; i++) {
      let run = s[i];
      runs.add(run);
      for (let j = i + 1; j < Math.min(s.length, i + depth); j++) runs.add(run += `/${s[j]}`);
    }
  }
  return runs;
}

// The most segments a file's name that the descriptions put in code marks has (each { file, blocks }), read in a pass
// of its own that keeps only the number, so the names are never all held at once.
function deepestOf(described) {
  let depth = 1;
  for (const { blocks } of described) for (const b of blocks) for (const n of namesIn(b.text)) if (n.file) depth = Math.max(depth, n.file.split("/").length);
  return depth;
}

// Of a name read, the reason it stands nowhere, or null where it stands, "skip" where it is not read, "deep" where it is
// past DEEPEST: `ctx` holds what brokenNames reads once (the extensions tracked, the runs and top folders of the tracked
// paths, the package file's scripts, whether the core is read).
function judge(n, { core, exts, runs, tops, scripts }) {
  if (n.script !== undefined) return !scripts ? "skip" : scripts.has(n.script) ? null : { what: "names no script of the package file at the project's root" };
  const p = core ? n.file.replace(/^core\//u, "") : n.file;
  // (in the core, a path under a folder it does not hold, `docs/` say, is a project's, which its README describes too)
  if (!exts.has(n.ext) || (core && p.includes("/") && !tops.has(p.split("/")[0]))) return "skip";
  if (p.split("/").length > DEEPEST) return "deep";
  return runs.has(p) ? null : { path: p, what: "names no file the project tracks" };
}

/** The names that stand nowhere, each { file, line, name, what }. `read(f)` gives a file's text or null, `tracked` the
 * tracked paths, `blocksOf(file)` a file's blocks ({ i, text }, markdown.mjs), `skip(file, name)` a name another
 * reading of the check reads already; `core` reads the core's own repository, `copy` is the project's copy of the core,
 * `tree` the commit read, null for the work tree, `usable(f)` whether a description may be read at all. `{ found, count,
 * unread, unusable, left }`: `count` the names read, `unusable` the descriptions not read, `left` the names left alone,
 * past DEEPEST or not searched. */
export function brokenNames({ read, tracked, blocksOf, skip = () => false, core = false, copy = "", tree = null, usable = () => true }) {
  const d = core ? { files: ["README.md"] } : descriptionsOf(read("core-manifest.md"), tracked);
  const unusable = d.files.filter(f => !usable(f));
  const described = d.files.filter(f => !unusable.includes(f)).map(file => ({ file, blocks: blocksOf(file) }));
  const ctx = { core, runs: runsOf(tracked, Math.min(DEEPEST, deepestOf(described))), tops: new Set(tracked.filter(f => f.includes("/")).map(f => f.split("/")[0])),
    scripts: core ? null : scriptsOf(read("package.json")),
    exts: new Set(tracked.map(f => /\.([^./]+)$/u.exec(posix.basename(f))?.[1]).filter(Boolean)) };
  const found = [];
  let count = 0, deep = 0;
  for (const { file, blocks } of described) for (const b of blocks) for (const n of namesIn(b.text)) {
    const v = skip(file, n.name) ? "skip" : judge(n, ctx);
    if (v === "skip" || v === "deep") { deep += v === "deep"; continue; }
    count++;
    if (v) found.push({ file, line: b.i + 1, name: n.name, ...v });
  }
  const { off, left } = elsewhere([...new Set(found.filter(x => x.path).map(x => x.path))], { tree, copy });
  return { found: found.filter(x => !x.path || !off.has(x.path)).map(({ path, ...x }) => x), count, unread: d.unread, unusable, left: left + deep };
}

/** A broken name's key, as the list holds it: its file and its name, its line aside, so that one held is known though lines moved. */
export const nameKey = x => `${x.file}\t${x.name}`;

/** The list's keys from its text, or null where it cannot be read as { "names": [{ "file", "name" }] }. */
export function listOf(text) {
  try {
    const names = JSON.parse(text)?.names;
    return Array.isArray(names) && names.every(x => typeof x?.file === "string" && typeof x?.name === "string") ? new Set(names.map(nameKey)) : null;
  } catch { return null; }
}
