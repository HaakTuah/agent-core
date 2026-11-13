// Is each package's licence, as the lock file names it, what the package itself says (floor rule 10)? The licence
// check (licences.mjs, beside this file) reads every package's licence from the lock file, as npm wrote it there from
// the package's own package.json; npm checks a package's bytes against the lock file and never those fields, so a
// licence written into a lock file by hand would be believed. This reads them back: after an install from the lock
// file (`npm ci`, as the signatures workflow runs it, .github/workflows/signatures.yml, which runs this next), it
// holds every entry of the lock file to the package.json of the package installed for it, in its licence, read as npm
// writes one, and in its version. With it, the licence check's reading of the lock file is a reading of the packages.
// What it does not hold: a package of another system, which no install here brings (an optional one that names
// systems which leave this one out, or one that only such packages ask for: counted, and said; a project that builds
// what ships on such a system installs it there, unread); a lock file the workflow does not install from, where a
// project has more than one and calls the workflow for one; the project's own packages (the root, a workspace, a link
// to one); and that a package's own package.json tells the truth about its terms, which nothing but a reading of
// them can. It runs none of what it reads: each package.json is read as JSON. Node's own modules only.
//
//   node core/scripts/licence-installed.mjs [the folder that holds the lock file, the current one if left out]
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lockInstalled, lockPathOk } from "./licences.mjs";
import { started } from "./started.mjs";

/** A licence as npm writes one into a lock file from a package.json's "license": the type of one written the old way,
 *  as an object; nothing for none or an empty one; else the value as it stands. */
export function lockForm(licence) {
  if (!licence) return null;
  if (typeof licence !== "object") return licence;
  if (!Array.isArray(licence) && licence.type) return lockForm(licence.type);
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
 * for. Nothing else explains a package that is not there: not a Node version an entry names, which the lock file's
 * writer could set to fit one machine.
 */
export function leftOut(packages, system = thisSystem()) {
  const asks = (entry) => Object.keys({ ...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies });
  // (a name is found as Node finds one: in the nearest node_modules folder, from the asking package's own upward)
  const found = (from, name) => {
    for (let dir = from; ; dir = dir.includes("/node_modules/") ? dir.slice(0, dir.lastIndexOf("/node_modules/")) : "") {
      const at = dir ? `${dir}/node_modules/${name}` : `node_modules/${name}`;
      if (Object.hasOwn(packages, at)) return at;
      if (!dir) return undefined;
    }
  };
  const askers = new Map();
  for (const [path, entry] of Object.entries(packages)) {
    if (!entry || typeof entry !== "object" || entry.link) continue;
    for (const name of asks(entry)) { const at = found(path, name); if (at !== undefined) askers.set(at, [...(askers.get(at) ?? []), path]); }
  }
  const optional = (entry) => entry && typeof entry === "object" && (entry.optional === true || entry.devOptional === true);
  const elsewhere = (entry) => !fits(entry.os, system.os) || !fits(entry.cpu, system.cpu) || (entry.libc !== undefined && entry.libc !== null && (system.libc === null || !fits(entry.libc, system.libc)));
  const out = new Map();
  const is = (path, seen) => {
    if (out.has(path)) return out.get(path);
    const entry = packages[path];
    if (!optional(entry)) return false;
    if (elsewhere(entry)) { out.set(path, true); return true; }
    if (seen.has(path)) return true; // (a ring of entries that ask for each other: decided by who else asks)
    seen.add(path);
    const by = askers.get(path) ?? [];
    const all = by.length > 0 && by.every((asker) => is(asker, seen));
    seen.delete(path);
    if (seen.size === 0) out.set(path, all);
    return all;
  };
  return new Set(Object.keys(packages).filter((path) => is(path, new Set())));
}

// (what a lock file or a package holds, on one line of a log, and no longer than a line)
const shown = (value) => (value === undefined ? "none" : JSON.stringify(value).replace(/[\u007f-\u009f\u2028\u2029]/gu, "?").slice(0, 200));

/** The check, on the folder `dir`, which holds the lock file and the node_modules an install from it filled:
 *  { failures, summary }; `system` is the one the install ran on. */
export function check(dir, system = thisSystem()) {
  const [name, second] = ["npm-shrinkwrap.json", "package-lock.json"].filter((f) => existsSync(join(dir, f)));
  if (!name) throw new Error("no npm-shrinkwrap.json or package-lock.json in the folder");
  // (an install reads the shrinkwrap file of the two, and the licence check the one its config names: only one may stand)
  if (second) throw new Error("both npm-shrinkwrap.json and package-lock.json stand in the folder: keep one");
  let lock;
  try { lock = JSON.parse(readFileSync(join(dir, name), "utf8")); } catch { throw new Error(`cannot read ${name} as JSON`); }
  if (!lock || typeof lock.packages !== "object" || !lock.packages || Array.isArray(lock.packages)) throw new Error(`${name} has no "packages" (npm's lockfile version 2 or 3)`);
  const failures = [];
  const mayLack = leftOut(lock.packages, system);
  let read = 0, absent = 0;
  for (const [path, entry] of Object.entries(lock.packages)) {
    // (every entry is written as npm writes one, or it fails before anything is left out: lockPathOk, in licences.mjs)
    if (!lockPathOk(path) || !entry || typeof entry !== "object" || Array.isArray(entry)) { failures.push(`${name}: an entry at ${shown(path)} that is not written as npm writes one`); continue; }
    // (an installed package, by the licence check's own test; anything else is the project's own: its root, a
    // workspace, a link to one)
    if (!lockInstalled(path) || entry.link) continue;
    const file = join(dir, path, "package.json");
    if (!existsSync(file)) {
      // (only what an install leaves out for the system's sake: leftOut, above)
      if (mayLack.has(path)) absent++;
      else failures.push(`${shown(path)}: not installed, and no optional package of another system or of one alone, so what it says of itself cannot be read: install from the lock file first (npm ci)`);
      continue;
    }
    let own;
    // (read as npm reads one: a byte-order mark before it is no part of it)
    try { const text = readFileSync(file, "utf8"); own = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text); } catch { own = null; }
    if (!own || typeof own !== "object" || Array.isArray(own)) { failures.push(`${shown(path)}: its package.json cannot be read as JSON`); continue; }
    read++;
    if (JSON.stringify(lockForm(own.license)) !== JSON.stringify(lockForm(entry.license))) failures.push(`${shown(path)}: ${name} says its licence is ${shown(entry.license)}, and its own package.json says ${shown(own.license)}`);
    if (plainVersion(own.version) !== plainVersion(entry.version)) failures.push(`${shown(path)}: ${name} says its version is ${shown(entry.version)}, and its own package.json says ${shown(own.version)}`);
  }
  const summary = `${read} packages of ${name} read back from the packages themselves, their licence and their version` +
    `${absent ? `; ${absent} of another system, not installed here, not read` : ""}; ${failures.length} failing (floor rule 10)`;
  return { failures, summary };
}

if (started(import.meta.url)) {
  const [dir = "."] = process.argv.slice(2);
  let result;
  try { result = check(dir); } catch (e) { console.error(`FAIL: ${e.message}`); process.exit(1); }
  for (const f of result.failures) console.error(`FAIL: ${f}`);
  console.log(result.summary);
  process.exit(result.failures.length ? 1 : 0);
}
