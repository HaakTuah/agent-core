// The stage of scripts/steps/824-the-size-marks-read-what-the-core-s-part-imports.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import { read, write } from "../stage-helpers.mjs";

const FILE = "core/roles/builder.md";

export default {
  // (the size marks of a project whose kit predates the role files: the builder's role, which the core's part of
  // AGENTS.md imports, not under "read"; the mend names it there at the marks' "each", as the step words it)
  stage: dir => {
    const m = JSON.parse(read(dir, "checks/sizes.json")), { [FILE]: _, ...rest } = m.read;
    write(dir, "checks/sizes.json", `${JSON.stringify({ ...m, read: rest }, null, 2)}\n`);
  },
  mend: dir => {
    const m = JSON.parse(read(dir, "checks/sizes.json"));
    write(dir, "checks/sizes.json", `${JSON.stringify({ ...m, read: { ...m.read, [FILE]: m.each } }, null, 2)}\n`);
  },
};
