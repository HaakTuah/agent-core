// The stage of scripts/steps/270-the-size-marks-total-counts-the-project-s-own.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import { spawnSync } from "node:child_process";
import { read, write } from "../stage-helpers.mjs";
import { parseBounded } from "../guards.mjs";

// (the total each project held before its stage, which `after` puts back)
const was = new Map();

export default {
  // (a total that still counts the core's copy, as one written before the core's own cap held it)
  stage: dir => { const m = parseBounded(read(dir, "checks/sizes.json")); was.set(dir, m.total); write(dir, "checks/sizes.json", `${JSON.stringify({ ...m, total: 1000000 }, null, 2)}\n`); },
  mend: dir => {
    const r = spawnSync(process.execPath, ["core/scripts/reading-size.mjs", "checks/sizes.json"], { cwd: dir, encoding: "utf8", env: { ...process.env, SIZES_BASE: "" } });
    const to = Number(/set it to (\d+)/.exec(r.stdout)[1]);
    const m = parseBounded(read(dir, "checks/sizes.json"));
    write(dir, "checks/sizes.json", `${JSON.stringify({ ...m, total: to }, null, 2)}\n`);
  },
  // (the mend's total leaves a room that hangs on how 1,000,000 falls against what the core's copy reads, so a later
  // stage that reads less of that copy, one taking a file out of "read", would find the room too large and the step
  // not done: the total the kit wrote goes back)
  after: dir => {
    const m = parseBounded(read(dir, "checks/sizes.json"));
    write(dir, "checks/sizes.json", `${JSON.stringify({ ...m, total: was.get(dir) }, null, 2)}\n`);
  },
};
