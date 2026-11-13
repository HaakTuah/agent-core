// Is each package's licence, as the lock file names it, what the package itself says (floor rule 10)? The licence
// check (licences.mjs, beside this file) reads every package's licence from the lock file, as npm wrote it there from
// the package's own package.json; npm checks a package's bytes against the lock file and never those fields, so a
// licence written into a lock file by hand would be believed. This reads them back: after an install from the lock
// file (`npm ci`, as the signatures workflow runs it, .github/workflows/signatures.yml, which runs this next), it
// holds every entry of the lock file to the package.json of the package installed for it, in its licence, read as npm
// writes one, and in its version. With it, the licence check's reading of the lock file is a reading of the packages.
// What it does not hold: a package of another system, which no install here brings (an optional one that names the
// systems it is for, whose folder is not there: counted, and said); the project's own packages (the root, a workspace, a link to one); and that a
// package's own package.json tells the truth about its terms, which nothing but a reading of them can. It runs none
// of what it reads: each package.json is read as JSON. Node's own modules only.
//
//   node core/scripts/licence-installed.mjs [the folder that holds the lock file, the current one if left out]
import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { started } from "./started.mjs";

/** A licence as npm writes one into a lock file from a package.json's "license": the type of one written the old way,
 *  as an object; nothing for none or an empty one; else the value as it stands. */
export function lockForm(licence) {
  if (!licence) return null;
  if (typeof licence !== "object") return licence;
  if (!Array.isArray(licence) && licence.type) return lockForm(licence.type);
  return Object.keys(licence).length ? licence : null;
}

// (what a lock file or a package holds, on one line of a log, and no longer than a line)
const shown = (value) => (value === undefined ? "none" : JSON.stringify(value).replace(/[\u007f-\u009f\u2028\u2029]/gu, "?").slice(0, 200));

/** The check, on the folder `dir`, which holds the lock file and the node_modules an install from it filled:
 *  { failures, summary }. */
export function check(dir) {
  // (where both stand, the shrinkwrap file is the one an install reads)
  const name = ["npm-shrinkwrap.json", "package-lock.json"].find((f) => existsSync(join(dir, f)));
  if (!name) throw new Error("no npm-shrinkwrap.json or package-lock.json in the folder");
  let lock;
  try { lock = JSON.parse(readFileSync(join(dir, name), "utf8")); } catch { throw new Error(`cannot read ${name} as JSON`); }
  if (!lock || typeof lock.packages !== "object" || !lock.packages || Array.isArray(lock.packages)) throw new Error(`${name} has no "packages" (npm's lockfile version 2 or 3)`);
  const failures = [];
  let read = 0, absent = 0;
  for (const [path, entry] of Object.entries(lock.packages)) {
    // (an installed package lies under a node_modules folder; anything else is the project's own: its root, a workspace)
    if (!/(?:^|\/)node_modules\/[^/]/u.test(path) || !entry || typeof entry !== "object" || entry.link) continue;
    if (posix.normalize(path) !== path || path.startsWith("/") || path.split("/").includes("..")) { failures.push(`${name}: an entry at ${shown(path)}, which is no folder inside the project`); continue; }
    const file = join(dir, path, "package.json");
    if (!existsSync(file)) {
      // (only what npm itself leaves out: an optional package that names the systems it is for, on another)
      if ((entry.optional || entry.devOptional) && (entry.os || entry.cpu || entry.libc)) absent++;
      else failures.push(`${path}: not installed, and no optional package of another system, so what it says of itself cannot be read: install from the lock file first (npm ci)`);
      continue;
    }
    let own;
    try { own = JSON.parse(readFileSync(file, "utf8")); } catch { own = null; }
    if (!own || typeof own !== "object" || Array.isArray(own)) { failures.push(`${path}: its package.json cannot be read as JSON`); continue; }
    read++;
    if (JSON.stringify(lockForm(own.license)) !== JSON.stringify(lockForm(entry.license))) failures.push(`${path}: ${name} says its licence is ${shown(entry.license)}, and its own package.json says ${shown(own.license)}`);
    if (own.version !== entry.version) failures.push(`${path}: ${name} says its version is ${shown(entry.version)}, and its own package.json says ${shown(own.version)}`);
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
