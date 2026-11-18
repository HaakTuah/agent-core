// Installs the code of other publishers the core's scripts run (#654): each registry's from its own lock file at the
// core's root, beside this file's folder, into a folder there that git does not track, taking each package at the one
// version and integrity the lock file names from its registry alone (no git, web or file address, whatever an .npmrc
// says) and running no install script (floor rule 15). The
// sync runs it after it writes the copy (sync.mjs), a session at its start, and each job before a check (README, "How
// a project takes the core"). A fetch that fails is run again once; a second failure fails, saying so (#542), save in a
// project's pull request, where each check that needs a package then says it did not run, failing nothing (#654, point 4).
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
// (the core's own repository, which holds its tests: a copy holds none, .gitattributes keeping them out, and installs no
// package that only the core's tests run)
const own = fs.existsSync(path.join(root, "tests"));

// (each command written out, so the licence check reads what it runs; npm on Windows is a .cmd file, which Node starts
// only through the shell, and each argument is the script's own)
export const REGISTRIES = {
  npm: { lock: "package-lock.json", into: "node_modules/", run: () => spawnSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--allow-git=none", "--allow-remote=none", "--allow-file=none", ...(own ? [] : ["--omit=dev"])], { cwd: root, encoding: "utf8", shell: windows }) },
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
    const why = (r.stderr || r.error?.message || "").trim().split("\n").slice(-3).join(" ");
    // (in a project's pull request, a registry that did not answer fails nothing by that alone (#654, point 4): each
    // check that needs a package says it did not run, and the job is run again before the merge)
    if (!own && /^pull_request/u.test(process.env.GITHUB_EVENT_NAME ?? "") && process.env.GITHUB_ENV) {
      fs.appendFileSync(process.env.GITHUB_ENV, "CORE_PACKAGES_UNREACHED=1\n");
      const said = `The core's packages could not be installed from ${lock}, twice, so each check that needs one did not run: ${why}. Mend: run this job again before the pull request merges; if it fails again, file it as a fault`;
      console.log(`::warning::${said}`);
      if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- Did not run: ${said.replace(/[<>&`*_[\]|]/gu, "?")}\n`);
      continue;
    }
    console.error(`FAIL: the core's packages could not be installed from ${root}${lock}, twice: ${why}. Mend: run this again once the registry answers; if it fails again, file it as a fault (it takes the program that comes with its platform, and a network that reaches its registry)`);
    process.exit(1);
  }
  console.log(`ok   the core's packages installed from ${lock} into ${into} in ${((Date.now() - began) / 1000).toFixed(1)} s`);
}
