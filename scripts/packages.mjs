// A package of another publisher, as the core installs it (#654): from node_modules/ at the core's root alone, never a
// project's own install of the same name at another version, and only where what is installed there is what the lock
// file names, each entry by its version, address and integrity (npm's own record of the install, node_modules/
// .package-lock.json, read against package-lock.json), so a folder an earlier install of another lock file left is
// never run. Where it is not so, the check that needs it did not run, and says so with the command that installs it
// (#254, #457); it never passes, and fails, save in a project's pull request whose install could not reach the
// registry, where it says so as a warning (#654, point 4).
//
//   import { load, loadSync } from "./packages.mjs";   const { Lexer } = await load("yaml");
//                                                     loadSync("yaml"): the same, at once, for a package of CommonJS,
//                                                     so a script loads it only where it is used, never on import
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const need = createRequire(path.join(root, "package.json"));

// The package's module, imported from the core's own node_modules/; where it is not there, a failure that says the mend.
export async function load(name) {
  return import(pathToFileURL(found(name)).href);
}

// The same, required at once: a package whose entry is CommonJS, loaded where a function first uses it.
export function loadSync(name) {
  return need(found(name));
}

// Whether the package is installed in the core's own node_modules/, for what reads it and must not stop where it is
// not (steps.mjs, which never fails over one step).
export function installed(name) {
  return entry(name) !== null;
}

// Whether node_modules/ holds what package-lock.json names: each entry of the lock file in npm's record of the install,
// at the same version, from the same address, with the same integrity; all but those only the core's tests run, which
// no script loads and a copy does not install.
let current;
function matches() {
  if (current === undefined) {
    const read = f => { try { return JSON.parse(fs.readFileSync(path.join(root, f), "utf8")).packages ?? {}; } catch { return null; } };
    const wanted = read("package-lock.json"), had = read("node_modules/.package-lock.json");
    current = Boolean(wanted && had) && Object.keys(wanted).filter(k => k && !wanted[k].dev).every(k => had[k] && ["version", "resolved", "integrity"].every(f => wanted[k][f] === had[k][f]));
  }
  return current;
}

// The package's entry file, in the core's own node_modules/ alone, as the lock file names it, or null.
function entry(name) {
  if (!matches()) return null;
  try {
    const own = fs.realpathSync(path.join(root, "node_modules")) + path.sep;
    const at = need.resolve(name);
    return fs.realpathSync(at).startsWith(own) ? at : null;
  } catch { return null; }
}

// The package's entry file; where it is not installed, the failure. Where the job's install could not reach the
// registry, in a project's pull request (install.mjs), a warning that the check did not run, failing nothing (#654,
// point 4); in a job of a workflow, the mend is the install step the job lacks.
function found(name) {
  const file = entry(name);
  if (!file) {
    const install = path.relative(process.cwd(), path.join(root, "scripts", "install.mjs"));
    const at = `${path.relative(process.cwd(), root) || "."}${path.sep}node_modules`;
    if (process.env.CORE_PACKAGES_UNREACHED === "1") {
      console.log(`::warning::The check did not run: the package ${name} could not be installed in ${at}, the registry not answering. Mend: run this job again before the pull request merges; if it fails again, file it as a fault`);
      process.exit(0);
    }
    const mend = process.env.GITHUB_ACTIONS === "true"
      ? `add a step that runs node ${install} to this job, before the step that runs this check, or, where the job has one, run the job again`
      : `run node ${install}, which installs the core's packages from its lock file, then run the check again`;
    console.error(`FAIL: the check did not run: the package ${name} is not installed in ${at} as package-lock.json names it. Mend: ${mend}`);
    process.exit(1);
  }
  return file;
}
