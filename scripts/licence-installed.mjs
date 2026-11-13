// Is each package's licence, as the lock file names it, what the package itself says (floor rule 10)? The licence
// check (licences.mjs, beside this file) reads every package's licence from the lock file, as npm wrote it there from
// the package's own package.json; npm checks a package's bytes against the lock file and never those fields, so a
// licence written into a lock file by hand would be believed. This reads them back: after an install from the lock
// file (`npm ci`, as the signatures workflow runs it, .github/workflows/signatures.yml, which runs this next), it
// holds every entry of the lock file to the package.json of the package installed for it, in its licence, read as npm
// writes one, and in its version. With it, the licence check's reading of the lock file is a reading of the packages.
// What it does not hold: a package npm marks optional that no install here brings (one for another system, or one
// only such a package asks for: counted, and said; a project that builds what ships on such a system installs it
// there, unread); a lock file the workflow does not install from, where a project has more than one and calls the
// workflow for one; the project's own packages (the root, a workspace, a link to one); and that a package's own
// package.json tells the truth about its terms, which nothing but a reading of them can. It runs none of what it
// reads: each package.json is read as JSON. Node's own modules only.
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

// (what a lock file or a package holds, on one line of a log, and no longer than a line)
const shown = (value) => (value === undefined ? "none" : JSON.stringify(value).replace(/[\u007f-\u009f\u2028\u2029]/gu, "?").slice(0, 200));

/** The check, on the folder `dir`, which holds the lock file and the node_modules an install from it filled:
 *  { failures, summary }. */
export function check(dir) {
  const [name, second] = ["npm-shrinkwrap.json", "package-lock.json"].filter((f) => existsSync(join(dir, f)));
  if (!name) throw new Error("no npm-shrinkwrap.json or package-lock.json in the folder");
  // (an install reads the shrinkwrap file of the two, and the licence check the one its config names: only one may stand)
  if (second) throw new Error("both npm-shrinkwrap.json and package-lock.json stand in the folder: keep one");
  let lock;
  try { lock = JSON.parse(readFileSync(join(dir, name), "utf8")); } catch { throw new Error(`cannot read ${name} as JSON`); }
  if (!lock || typeof lock.packages !== "object" || !lock.packages || Array.isArray(lock.packages)) throw new Error(`${name} has no "packages" (npm's lockfile version 2 or 3)`);
  const failures = [];
  let read = 0, absent = 0;
  for (const [path, entry] of Object.entries(lock.packages)) {
    // (every entry is written as npm writes one, or it fails before anything is left out: lockPathOk, in licences.mjs)
    if (!lockPathOk(path) || !entry || typeof entry !== "object" || Array.isArray(entry)) { failures.push(`${name}: an entry at ${shown(path)} that is not written as npm writes one`); continue; }
    // (an installed package, by the licence check's own test; anything else is the project's own: its root, a
    // workspace, a link to one)
    if (!lockInstalled(path) || entry.link) continue;
    const file = join(dir, path, "package.json");
    if (!existsSync(file)) {
      // (only what npm itself may leave out: a package it marks optional, which is one for another system or one
      // that only such a package asks for)
      if (entry.optional || entry.devOptional) absent++;
      else failures.push(`${shown(path)}: not installed, and not one npm marks optional, so what it says of itself cannot be read: install from the lock file first (npm ci)`);
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
    `${absent ? `; ${absent} optional ones not installed here (another system's), not read` : ""}; ${failures.length} failing (floor rule 10)`;
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
