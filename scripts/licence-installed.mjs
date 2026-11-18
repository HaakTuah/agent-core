// Is each package's licence, as the lock file names it, what the package itself says (floor rule 10)? The licence
// check (licences.mjs, beside this file) reads every package's licence from the lock file, as npm wrote it there from
// the package's own package.json; npm checks a package's bytes against the lock file and never those fields, so a
// licence written into a lock file by hand would be believed. This reads them back: after an install from the lock
// file (`npm ci`, as the signatures workflow runs it, .github/workflows/signatures.yml, which runs this next), it
// holds every entry of the lock file to the package installed for it, in its licence, read as npm writes one, and in
// its version. With it, the licence check's reading of the lock file is a reading of the packages.
// What is installed, npm reads itself: `npm query "*"`, which lists each package of the folder's installed tree by
// where it stands, with its own package.json's fields as written (#585; npm's `npm sbom`, which the issue named, merges
// the packages of one name and version and so reads no copy bundled beside another, as the pull request that made
// this shows). The core keeps the policy and the rest: which entries are read, by the licence check's own reading
// (lockRead, in licences.mjs), so a link to a folder that is no workspace, a dependency written "file:", is read back
// from that folder's own package; what an install leaves out for another system's sake; the comparison; and each
// failure's mend. It fails any package installed that the lock file does not name, as one bundled in another's tarball
// and left out of the lock file would be, which no check would read, and any reached through a link that leads out of
// the project. What it does not hold: a package of another system, which no install here brings (an optional one that
// names systems which leave this one out, or one that only such packages ask for: counted, and said; a project that
// builds what ships on such a system installs it there, unread); a lock file the workflow does not install from, where
// a project has more than one and calls the workflow for one; the project's own packages (the root, a workspace, a link
// to one); and that a package's own package.json tells the truth about its terms, which nothing but a reading of them
// can. It runs none of what it reads, and npm query runs no package's script. Node's own modules, and npm.
//
//   node core/scripts/licence-installed.mjs [the folder that holds the lock file, the current one if left out]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { DEEPEST, leadsOut, parseBounded } from "./guards.mjs";
import { lockPathOk, lockRead, workspacesIn } from "./licences.mjs";
import { started } from "./started.mjs";

/** A licence as npm writes one into a lock file from a package.json's "license": the type of one written the old way,
 *  as an object; nothing for none or an empty one; else the value as it stands. */
export function lockForm(licence) {
  // (a type within a type is followed in a loop, never by recursion, however deep it nests)
  while (licence && typeof licence === "object" && !Array.isArray(licence) && licence.type) licence = licence.type;
  if (!licence) return null;
  if (typeof licence !== "object") return licence;
  return Object.keys(licence).length ? licence : null;
}

/** A version as npm writes one into a lock file from a package.json's: without the space, "v" or "=" some are spelt with. */
export const plainVersion = (version) => (typeof version === "string" ? version.trim().replace(/^[=v\s]+/u, "") : version);

// Whether a list of systems an entry names ("os", "cpu", "libc": names, or names behind "!") takes in `value`, as npm
// reads one: no list takes in every system; a name behind "!" leaves that one out; other names leave out all the rest.
const fits = (list, value) => {
  if (list === undefined || list === null) return true;
  const names = (Array.isArray(list) ? list : [list]).filter((n) => typeof n === "string");
  if (names.some((n) => n === `!${value}`)) return false;
  const plain = names.filter((n) => !n.startsWith("!"));
  return plain.length === 0 || plain.includes(value) || plain.includes("any");
};

/** The system an install runs on: { os, cpu, libc }, libc being "glibc" or "musl" on Linux and nothing elsewhere. */
export function thisSystem() {
  const libc = process.platform === "linux" ? (process.report?.getReport?.().header?.glibcVersionRuntime ? "glibc" : "musl") : null;
  return { os: process.platform, cpu: process.arch, libc };
}

/**
 * The entries of a lock file's `packages` that an install on `system` leaves out for the system's sake alone, by
 * path: an optional one that names systems which leave this one out, and an optional one that only such entries ask
 * for (a peer an entry marks optional asks for nothing, since npm never installs one for it). Nothing else explains a
 * package that is not there: not a Node version an entry names, which the lock file's
 * writer could set to fit one machine.
 */
export function leftOut(packages, system = thisSystem()) {
  const askers = askersOf(packages);
  // (the largest set that holds: every optional entry to begin with, then, until nothing changes, each that is not of
  // another system itself and that something outside the set asks for, or nothing asks for, taken out; a ring of
  // entries that ask for each other is so decided by who else asks, in a pass over every entry at most once per entry)
  const out = new Set(Object.keys(packages).filter((path) => optional(packages[path])));
  for (let changed = true; changed;) {
    changed = false;
    for (const path of out) {
      if (elsewhere(packages[path], system)) continue;
      const by = askers.get(path) ?? [];
      if (by.length === 0 || by.some((asker) => !out.has(asker))) { out.delete(path); changed = true; }
    }
  }
  return out;
}

/** Who asks for each entry of a lock file's `packages` (leftOut, above): a Map from an entry's path to the paths of
 *  the entries that ask for it. */
function askersOf(packages) {
  const askers = new Map();
  for (const [path, entry] of Object.entries(packages)) {
    if (!entry || typeof entry !== "object" || entry.link) continue;
    for (const name of asks(entry)) { const at = nearest(packages, path, name); if (at !== undefined) askers.set(at, [...(askers.get(at) ?? []), path]); }
  }
  return askers;
}

// (what an entry asks npm to install: its dependencies, its optional ones, and its peers but those it marks optional,
// which npm never installs for it: peerDependenciesMeta)
const asks = (entry) => {
  const meta = entry.peerDependenciesMeta && typeof entry.peerDependenciesMeta === "object" ? entry.peerDependenciesMeta : {};
  const peers = Object.keys({ ...entry.peerDependencies }).filter((name) => !(Object.hasOwn(meta, name) && meta[name]?.optional === true));
  return [...new Set([...Object.keys({ ...entry.dependencies, ...entry.optionalDependencies }), ...peers])];
};

// (a name is found as Node finds one: in the nearest node_modules folder, from the asking package's own upward)
const nearest = (packages, from, name) => {
  for (let dir = from; ; dir = dir.includes("/node_modules/") ? dir.slice(0, dir.lastIndexOf("/node_modules/")) : "") {
    const at = dir ? `${dir}/node_modules/${name}` : `node_modules/${name}`;
    if (Object.hasOwn(packages, at)) return at;
    if (!dir) return undefined;
  }
};

const optional = (entry) => entry && typeof entry === "object" && (entry.optional === true || entry.devOptional === true);
const elsewhere = (entry, system) => !fits(entry.os, system.os) || !fits(entry.cpu, system.cpu) || (entry.libc !== undefined && entry.libc !== null && (system.libc === null || !fits(entry.libc, system.libc)));

// (what a lock file or a package holds, on one line of a log, and no longer than a line)
const shown = (value) => (value === undefined ? "none" : JSON.stringify(value).replace(/[\u007f-\u009f\u2028\u2029]/gu, "?").slice(0, 200));

// (Windows' shell, by the path the system names, where npm is a script: checks.mjs runs npm so)
const COMSPEC = process.env.ComSpec || "cmd.exe";
const AGAIN = "Mend: install from the lock file again (npm ci) and run the check again; where it still cannot, run `npm query \"*\"` in the folder and mend what it says";

/** What is installed in the folder `dir`, as npm reads it (`npm query "*"`): each package by where it stands, from the
 *  folder, its own package.json's fields as written, with its "realpath"; or an error that says its mend. */
export function installedTree(dir) {
  const r = process.platform === "win32"
    ? spawnSync(COMSPEC, ["/d", "/s", "/c", "npm query * --prefix ."], { cwd: dir, encoding: "utf8", maxBuffer: 1 << 28, windowsHide: true })
    : spawnSync("npm", ["query", "*", "--prefix", "."], { cwd: dir, encoding: "utf8", maxBuffer: 1 << 28 });
  // (npm's first line of its own, not the one that names its log, which holds nothing of the project's)
  const said = (r.stderr || "").split(/\r?\n/u).map((line) => line.replace(/^npm (error|ERR!) /u, "").trim()).find((line) => line && !/complete log of this run|^Log files were not written/u.test(line))?.slice(0, 200);
  if (r.error || r.status !== 0) throw new Error(`npm could not read what is installed (${r.error?.message ?? said ?? `it ended with ${r.status}`}). ${AGAIN}`);
  let nodes;
  try { nodes = parseBounded(r.stdout); } catch { nodes = null; }
  if (!Array.isArray(nodes)) throw new Error(`npm's reading of what is installed is no list. ${AGAIN}`);
  return new Map(nodes.filter((n) => n && typeof n === "object" && typeof n.location === "string").map((n) => [n.location, n]));
}

/** Whether npm reached the package `own` through a link that leads out of the project `dir`. */
function outside(dir, own) {
  if (typeof own.realpath !== "string") return true;
  let top;
  try { top = realpathSync(dir); } catch { return true; }
  const rel = relative(top, own.realpath);
  return rel.startsWith("..") || isAbsolute(rel);
}

/** The check, on the folder `dir`, which holds the lock file and the node_modules an install from it filled:
 *  { failures, summary }; `system` is the one the install ran on. */
export function check(dir, system = thisSystem(), read = installedTree) {
  const { name, lock } = lockIn(dir);
  const failures = [];
  // (every entry is written as npm writes one, or the lock file fails before anything is left out or read: lockPathOk,
  // in licences.mjs)
  const odd = Object.entries(lock.packages).filter(([path, entry]) => !lockPathOk(path) || !entry || typeof entry !== "object" || Array.isArray(entry));
  if (odd.length) return { failures: odd.map(([path]) => `${name}: an entry at ${shown(path)} that is not written as npm writes one. Mend: write the lock file anew with npm, never by hand: its install, given --package-lock-only`), summary: `${name} not read; ${odd.length} failing (floor rule 10)` };
  let pkg = {};
  try { pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")); } catch { /* (none: the install read none, and no workspace stands) */ }
  const context = { dir, name, lock, failures, tree: read(dir) };
  const { read: count, absent } = readBack(context, leftOut(lock.packages, system), pkg);
  unnamed(context);
  const summary = `${count} packages of ${name} read back from the packages themselves, their licence and their version` +
    `${absent ? `; ${absent} of another system, not installed here, not read` : ""}; ${failures.length} failing (floor rule 10)`;
  return { failures, summary };
}

/** The lock file in the folder `dir`, read: { name, lock }, or an error that says its mend. */
function lockIn(dir) {
  const [name, second] = ["npm-shrinkwrap.json", "package-lock.json"].filter((f) => existsSync(join(dir, f)));
  if (!name) throw new Error("no npm-shrinkwrap.json or package-lock.json in the folder. Mend: name the folder that holds the lock file, as the signatures workflow's \"directory\"");
  // (an install reads the shrinkwrap file of the two, and the licence check the one its config names: only one may stand)
  if (second) throw new Error("both npm-shrinkwrap.json and package-lock.json stand in the folder. Mend: delete one, keeping the file the project installs from");
  let lock;
  try { lock = parseBounded(readFileSync(join(dir, name), "utf8")); } catch { throw new Error(`cannot read ${name} as JSON, nested no deeper than ${DEEPEST} objects and lists. Mend: write the lock file anew with npm, never by hand: its install, given --package-lock-only`); }
  if (!lock || typeof lock.packages !== "object" || !lock.packages || Array.isArray(lock.packages)) throw new Error(`${name} has no "packages" (npm's lockfile version 2 or 3). Mend: write the lock file anew with npm, never by hand: its install, given --package-lock-only, with npm 7 or later`);
  return { name, lock };
}

/** Each entry of the lock file `name` in `dir` held to the package npm reads as installed for it (check, above), its
 *  failures pushed onto `failures`; `mayLack` is what may be absent (leftOut): { read, absent }. */
function readBack({ dir, name, lock, failures, tree }, mayLack, pkg) {
  let read = 0, absent = 0;
  // (the entries the licence check reads, by its own reading: every installed package, a link's folder among them,
  // but a workspace, the project's own)
  for (const { path, at, entry } of lockRead(lock.packages, workspacesIn(pkg, "package.json"))) {
    if (at === null) { failures.push(`${shown(path)}: a link to a folder ${name} holds no entry for, so what it says of itself cannot be read. Mend: write the lock file anew with npm, never by hand: its install, given --package-lock-only`); continue; }
    const own = tree.get(at);
    // (a folder reached through a link out of the project, npm reads where the link leads, not where it stands)
    if (!own && leadsOut(dir, join(dir, at))) { failures.push(`${shown(path)}: it is reached through a link that leads out of the project, so it is not read. Mend: install from the lock file again (npm ci), which puts each package inside the project; where a link stays, replace the package that makes it`); continue; }
    if (!own) {
      // (only what an install leaves out for the system's sake: leftOut, above)
      if (mayLack.has(path)) absent++;
      else failures.push(`${shown(path)}: not installed, and no optional package of another system or of one alone, so what it says of itself cannot be read. Mend: install from the lock file first (npm ci), then run the check`);
      continue;
    }
    if (outside(dir, own)) { failures.push(`${shown(path)}: it is reached through a link that leads out of the project, so it is not read. Mend: install from the lock file again (npm ci), which puts each package inside the project; where a link stays, replace the package that makes it`); continue; }
    // (npm reads a package.json that is no JSON object as one that says nothing: no name, no version)
    if (own.name === undefined && own.version === undefined) { failures.push(`${shown(path)}: its package.json says neither its name nor its version, or cannot be read as JSON. Mend: install from the lock file again (npm ci); where it still says nothing, replace the package`); continue; }
    read++;
    if (JSON.stringify(lockForm(own.license)) !== JSON.stringify(lockForm(entry.license))) failures.push(`${shown(path)}: ${name} says its licence is ${shown(entry.license)}, and its own package.json says ${shown(own.license)}. Mend: write the lock file anew with npm, never by hand: its install, given --package-lock-only, which takes each licence from the package itself`);
    if (plainVersion(own.version) !== plainVersion(entry.version)) failures.push(`${shown(path)}: ${name} says its version is ${shown(entry.version)}, and its own package.json says ${shown(own.version)}. Mend: write the lock file anew with npm, never by hand: its install, given --package-lock-only`);
  }
  return { read, absent };
}

// (and nothing installed that the lock file does not name, as a package bundled in another's tarball and left out of
// the lock file would be, read by no check: every package npm reads in the folder, the project's own and its
// workspaces' and linked folders' packages among them, is an entry; one npm reaches only outside the project is
// named so)
function unnamed({ dir, name, lock, failures, tree }) {
  for (const [at, own] of tree) {
    if (at === "" || Object.hasOwn(lock.packages, at)) continue;
    if (at.startsWith("../") || outside(dir, own)) failures.push(`${shown(at)}: installed through a link that leads out of the project, so it is not read. Mend: install from the lock file again (npm ci), which puts each package inside the project; where a link stays, replace the package that makes it`);
    else failures.push(`${shown(at)}: installed, and ${name} holds no entry for it, so no check reads its licence: a package bundled in another's and left out of the lock file. Mend: replace the package that bundles it, or ask its makers to name what it bundles`);
  }
}

if (started(import.meta.url)) {
  const [dir = "."] = process.argv.slice(2);
  let result;
  try { result = check(dir); } catch (e) { console.error(`FAIL: ${e.message}`); process.exit(1); }
  for (const f of result.failures) console.error(`FAIL: ${f}`);
  console.log(result.summary);
  process.exit(result.failures.length ? 1 : 0);
}
