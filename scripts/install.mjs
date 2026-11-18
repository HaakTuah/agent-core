// Installs the packages of other publishers the core's scripts run (#654): from package-lock.json at the core's root,
// beside this file's folder, into node_modules/ there, which git does not track. `npm ci` takes each package at the one
// version and integrity the lock file names from its registry, and runs no install script (floor rule 15). The sync
// runs it after it writes the copy (sync.mjs), a session at its set-up and each job before a check (README, "How a
// project takes the core"). A fetch that fails is run again once; a second failure fails, saying so (#542).
//
//   node core/scripts/install.mjs      (in the core's own repository: node scripts/install.mjs)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
const ci = () => spawnSync(windows ? "npm.cmd" : "npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: root, encoding: "utf8", shell: windows });

const began = Date.now();
let r = ci();
if (r.status !== 0) {
  console.error(`note the install failed once, and runs again: ${(r.stderr || r.error?.message || "").trim().split("\n").slice(-1)[0]}`);
  r = ci();
}
if (r.status !== 0) {
  console.error(`FAIL: the core's packages could not be installed from ${root}package-lock.json, twice: ${(r.stderr || r.error?.message || "").trim().split("\n").slice(-3).join(" ")}. Mend: run this again once npm's registry answers; if it fails again, file it as a fault (npm needs Node's own npm, and the network to reach registry.npmjs.org)`);
  process.exit(1);
}
console.log(`ok   the core's packages installed from package-lock.json in ${((Date.now() - began) / 1000).toFixed(1)} s`);
