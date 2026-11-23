// The stage of scripts/steps/160-the-modules-a-project-takes.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import { read, write } from "../stage-helpers.mjs";
import { project } from "../steps.mjs";
import step from "../steps/160-the-modules-a-project-takes.mjs";

export default {
  // (asked of every project whose list the core's modules outgrew since its release, which a sync of that release's
  // own program, writing nothing, leaves to a session; the mend is what the step words, its writer's lines)
  asked: true,
  stage: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^Not taken: .*\r?\n/m, "")),
  mend: dir => step.write(project(dir), new Set()),
};
