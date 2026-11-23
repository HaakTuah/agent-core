// The stage of scripts/steps/470-how-done-will-be-judged.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import { read, write } from "../stage-helpers.mjs";

export default {
  // (a list of modules written before the module came, which neither takes it nor leaves it out; the mend takes it, as
  // the step words it: its line "Modules to confirm:", the owner's to answer, is the stage of 23 November 2026's)
  stage: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/`done-when\.md`, /g, "")),
  mend: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^(Floor: whole\. Modules: `[^`]+`)/m, "$1, `done-when.md`")),
};
