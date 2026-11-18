// A package of another publisher, as the core installs it (#654): from node_modules/ at the core's root alone, never a
// project's own install of the same name at another version. Where it is not installed there, the check that needs it
// did not run, and says so with the command that installs it (#254, #457); it never passes.
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

// The package's entry file, in the core's own node_modules/ alone, or null.
function entry(name) {
  try {
    const own = fs.realpathSync(path.join(root, "node_modules")) + path.sep;
    const at = need.resolve(name);
    return fs.realpathSync(at).startsWith(own) ? at : null;
  } catch { return null; }
}

// The package's entry file; where it is not installed, the failure.
function found(name) {
  const file = entry(name);
  if (!file) {
    const script = path.relative(process.cwd(), process.argv[1] ?? "") || "this check";
    console.error(`FAIL: ${script} did not run: the package ${name} is not installed in ${path.relative(process.cwd(), root) || "."}${path.sep}node_modules. Mend: run node ${path.relative(process.cwd(), path.join(root, "scripts", "install.mjs"))}, which installs the core's packages from its lock file, then run the check again`);
    process.exit(1);
  }
  return file;
}
