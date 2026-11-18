// Installs the code of other publishers the core's scripts run (#654): each registry's from its own lock file at the
// core's root, beside this file's folder, into a folder there that git does not track, taking each package at the one
// version and integrity the lock file names from its registry and running no install script (floor rule 15). The
// sync runs it after it writes the copy (sync.mjs), a session at its start, and each job before a check (README, "How
// a project takes the core"). A fetch that fails is run again once; a second failure fails, saying so (#542).
//
// Each registry, in REGISTRIES, with its lock file and the command that installs it; npm's first, installed where no
// registry is named. One a check needs alone (a large engine, say) is named by that check's job: `install.mjs <name>`.
//
//   node core/scripts/install.mjs [<registry> ...]      (in the core's own repository: node scripts/install.mjs)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";

// (each command written out, so the licence check reads what it runs; npm on Windows is a .cmd file, which Node starts
// only through the shell, and each argument is the script's own)
export const REGISTRIES = {
  npm: { lock: "package-lock.json", into: "node_modules/", run: () => spawnSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: root, encoding: "utf8", shell: windows }) },
  // (the code scan's engine alone, #546: pip takes each wheel at the hash requirements.txt names, binaries only, none
  // of their dependencies and none of their code run, into pypi/; Python 3.10 or later, as every GitHub runner holds)
  pypi: { lock: "requirements.txt", into: "pypi/", run: () => spawnSync("python3", ["-I", "-m", "pip", "install", "--require-hashes", "--no-deps", "--only-binary=:all:", "--no-compile", "--no-input", "--disable-pip-version-check", "--upgrade", "--target", path.join(root, "pypi"), "-r", path.join(root, "requirements.txt")], { cwd: root, encoding: "utf8" }) },
};

const named = process.argv.slice(2);
const unknown = named.filter(n => !Object.hasOwn(REGISTRIES, n));
if (unknown.length) {
  console.error(`FAIL: install.mjs knows no registry ${unknown.join(", ")}. Mend: name one of ${Object.keys(REGISTRIES).join(", ")}, or none for the first`);
  process.exit(1);
}
const first = Object.keys(REGISTRIES)[0]; // (npm's, where none is named)
for (const name of named.length ? named : [first]) {
  const { lock, into, run } = REGISTRIES[name];
  if (!fs.existsSync(path.join(root, lock))) continue; // (a copy whose core holds no lock file of this registry)
  const began = Date.now();
  let r = run();
  if (r.status !== 0) {
    console.error(`note the install from ${lock} failed once, and runs again: ${(r.stderr || r.error?.message || "").trim().split("\n").slice(-1)[0]}`);
    r = run();
  }
  if (r.status !== 0) {
    console.error(`FAIL: the core's packages could not be installed from ${root}${lock}, twice: ${(r.stderr || r.error?.message || "").trim().split("\n").slice(-3).join(" ")}. Mend: run this again once the registry answers; if it fails again, file it as a fault (it takes the program that comes with its platform, and a network that reaches its registry)`);
    process.exit(1);
  }
  console.log(`ok   the core's packages installed from ${lock} into ${into} in ${((Date.now() - began) / 1000).toFixed(1)} s`);
}
