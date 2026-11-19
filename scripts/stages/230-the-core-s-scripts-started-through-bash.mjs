// The stage of scripts/steps/230-the-core-s-scripts-started-through-bash.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import { read, write } from "../stage-helpers.mjs";

export default {
  stage: dir => write(dir, ".github/workflows/publish-staged.yml", "name: publish-staged\n\non:\n  push:\n\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - run: core/scripts/site-publish.sh root site\n"),
  mend: dir => write(dir, ".github/workflows/publish-staged.yml", read(dir, ".github/workflows/publish-staged.yml").replace("- run: core/scripts/", "- run: bash core/scripts/")),
};
