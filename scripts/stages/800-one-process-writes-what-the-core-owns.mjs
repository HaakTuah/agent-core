// The stage of scripts/steps/800-one-process-writes-what-the-core-owns.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import { BEGIN, END } from "../core-owned.mjs";
import { read, write } from "../stage-helpers.mjs";

export default {
  // (AGENTS.md as a kit from before the process wrote it, its run of import lines with no mark; the mend, as the process
  // writes it, holds that run between the core's two marks again)
  stage: dir => write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace(`${BEGIN}\n`, "").replace(`${END}\n`, "")),
  mend: dir => write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace(/^(@core-manifest\.md\r?\n(?:@.*\r?\n)*)/mu, `${BEGIN}\n$1${END}\n`)),
};
