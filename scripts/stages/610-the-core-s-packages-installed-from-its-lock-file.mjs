// The stage of scripts/steps/610-the-core-s-packages-installed-from-its-lock-file.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import fs from "node:fs";
import { at, write, SCRIPTS } from "../stage-helpers.mjs";

export default {
  // (a job of the project's own that runs a script of the copy with nothing installed, before it only a step that names
  // the install and one that never runs; the mend installs first, guarded, as it can go in ahead of the sync)
  stage: dir => write(dir, ".github/workflows/scripts-staged.yml", SCRIPTS.replace("      - run: echo test\n", "      - run: echo core/scripts/install.mjs\n      - if: false\n        run: node core/scripts/install.mjs\n      - run: node core/scripts/steps.mjs\n")),
  after: dir => fs.rmSync(at(dir, ".github/workflows/scripts-staged.yml"), { force: true }),
  mend: dir => write(dir, ".github/workflows/scripts-staged.yml", SCRIPTS.replace("      - run: echo test\n", "      - run: if [ -f core/scripts/install.mjs ]; then node core/scripts/install.mjs; fi\n      - run: node core/scripts/steps.mjs\n")),
};
