// The stage of scripts/steps/670-the-parser-s-packages-installed-where-the-shape.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import fs from "node:fs";
import { at, write, SCRIPTS } from "../stage-helpers.mjs";

export default {
  // (a job of the project's own that runs the shape check after an install that names no lock but the first; the mend
  // names every one, as the copies check's job does)
  stage: dir => write(dir, ".github/workflows/shape-staged.yml", SCRIPTS.replace("      - run: echo test\n", "      - run: if [ -f core/scripts/install.mjs ]; then node core/scripts/install.mjs; fi\n      - run: node core/scripts/shape.mjs\n")),
  after: dir => fs.rmSync(at(dir, ".github/workflows/shape-staged.yml"), { force: true }),
  mend: dir => write(dir, ".github/workflows/shape-staged.yml", SCRIPTS.replace("      - run: echo test\n", "      - run: if [ -f core/scripts/install.mjs ]; then node core/scripts/install.mjs all; fi\n      - run: node core/scripts/shape.mjs\n")),
};
