// A package of another publisher, as the core installs it (#654): from node_modules/ at the core's root alone, never a
// project's own install of the same name at another version. Where it is not installed there, the check that needs it
// did not run, and says so with the command that installs it (#254, #457); it never passes.
//
//   import { load } from "./packages.mjs";   const { Lexer } = await load("yaml");
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// The package's module, imported from the core's own node_modules/; where it is not there, a failure that says the mend.
export async function load(name) {
  let found = null;
  try {
    const own = fs.realpathSync(path.join(root, "node_modules")) + path.sep;
    const file = createRequire(path.join(root, "package.json")).resolve(name);
    if (fs.realpathSync(file).startsWith(own)) found = file;
  } catch { /* not installed: said below */ }
  if (!found) {
    const script = path.relative(process.cwd(), process.argv[1] ?? "") || "this check";
    console.error(`FAIL: ${script} did not run: the package ${name} is not installed in ${path.relative(process.cwd(), root) || "."}${path.sep}node_modules. Mend: run node ${path.relative(process.cwd(), path.join(root, "scripts", "install.mjs"))}, which installs the core's packages from its lock file, then run the check again`);
    process.exit(1);
  }
  return import(pathToFileURL(found).href);
}
