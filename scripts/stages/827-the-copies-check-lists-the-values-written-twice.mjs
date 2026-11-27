// The stage of scripts/steps/827-the-copies-check-lists-the-values-written-twice.mjs: how a project that missed that step
// holds it, and its mend as the step words it. scripts/steps-stage.mjs loads it, in the order of the names.
import { spawnSync } from "node:child_process";
import { copies, readJson, write } from "../stage-helpers.mjs";
import { copiesConfig } from "../check-configs.mjs";
import { project } from "../steps.mjs";

export default {
  asked: true,
  // (the baseline as a release before it wrote it, with no list; the mend runs the command the step words)
  stage: dir => {
    const baseline = readJson(dir, copiesConfig(project(dir))).baseline, held = readJson(dir, baseline);
    delete held.values;
    write(dir, baseline, `${JSON.stringify(held, null, 2)}\n`);
    spawnSync("git", ["add", "--", baseline], { cwd: dir });
  },
  mend: dir => {
    const r = copies(dir, "--first");
    if (r.status !== 0) throw new Error(`copies.mjs --first: ${r.stderr}`);
  },
};
