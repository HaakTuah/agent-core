// The stage of scripts/steps/420-how-strong-the-tests-are.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import { read, write, SLOTS } from "../stage-helpers.mjs";

export default {
  asked: true,
  stage: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").split(/\r?\n/).filter(l => !l.includes("*mutation tool*")).join("\n")),
  // (as the step words it: the row, here `none` with its reason, in place of one with none where another stage wrote it)
  mend: dir => write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^\| \*mutation tool\* \|.*\r?\n/mu, "").replace(SLOTS, "$1| *mutation tool* | `none`: no mutation tool is named for this project's language yet |\n")),
};
