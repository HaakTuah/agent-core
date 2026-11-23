// The stage of scripts/steps/160-the-modules-a-project-takes.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import { read, write } from "../stage-helpers.mjs";

export default {
  // (a list of modules written before the line "Not taken:" came, which neither takes `game-design.md` nor leaves it out;
  // the mend leaves it out with the reason the step reads, the project holding no game's row)
  stage: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^Not taken: .*\r?\n/m, "")),
  mend: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^(Floor: .*)$/m, "$1\nNot taken: `game-design.md` (the project is no game: its manifest holds no game's row).")),
};
