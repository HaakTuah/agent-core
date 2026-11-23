// The stage of scripts/steps/820-the-modules-a-project-takes-placed-from-what-is-read.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import { read, write } from "../stage-helpers.mjs";

export default {
  // (a module taken by choice and asked of the owner, in a paragraph of its own, as the steps that place the modules
  // write it; the mend is the owner's answer that it fits: the line taken out)
  stage: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^(Floor: .*(?:\r?\n.+)*)/m, "$1\n\nModules to confirm: `planning.md`.")),
  mend: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/\r?\n\r?\nModules to confirm: [^\r\n]*/u, "")),
};
