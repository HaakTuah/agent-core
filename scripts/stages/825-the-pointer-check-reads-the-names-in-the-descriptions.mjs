// The stage of scripts/steps/825-the-pointer-check-reads-the-names-in-the-descriptions.mjs: how a project that missed
// that step holds it, and its mend as the step words it. scripts/steps-stage.mjs loads it, in the order of the names.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { at, write } from "../stage-helpers.mjs";

const README = "README.md";
export default {
  // (a description that names a file that stands nowhere, and no list; the mend runs the command the step words)
  stage: dir => {
    const was = fs.existsSync(at(dir, README)) ? fs.readFileSync(at(dir, README), "utf8") : "# The project\n";
    write(dir, README, `${was.trimEnd()}\n\nIts entry point was \`src/staged-gone.md\`.\n`);
    fs.rmSync(at(dir, "checks/names.json"), { force: true });
    spawnSync("git", ["add", "--", README], { cwd: dir });
  },
  mend: dir => {
    const r = spawnSync(process.execPath, ["core/scripts/pointers.mjs", "--write-names"], { cwd: dir, encoding: "utf8", env: { ...process.env, POINTERS_BASE: "" } });
    if (r.status !== 0) throw new Error(`pointers.mjs --write-names: ${r.stderr}`);
  },
};
