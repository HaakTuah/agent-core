// The stage of scripts/steps/440-the-tests-a-change-can-reach.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import { spawnSync } from "node:child_process";
import { read, write } from "../stage-helpers.mjs";

export default {
  asked: true,
  // (a test of the project's own, tracked, and no job that selects; the kit's mutation row told a reason other than
  // "no tests yet", so that the strength step stays as it was)
  stage: dir => {
    write(dir, "test/staged.test.mjs", "// the selection's staged test: it guards nothing but its own place\n");
    spawnSync("git", ["add", "test/staged.test.mjs"], { cwd: dir });
    write(dir, "core-manifest.md", read(dir, "core-manifest.md").replace(/^(\| \*mutation tool\* \| `none`): no tests yet[^|\n]*\|/m, "$1: no mutation tool is named for this project's language yet |"));
  },
  // (as the step words it: a step that selects, with its base, before the tests, which run what it names)
  mend: dir => write(dir, ".github/workflows/tests-selected.yml", "name: tests-selected\n\non:\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  tests:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/install.mjs all\n      - run: node core/scripts/select.mjs --env RUN\n        env:\n          SELECT_BASE: HEAD^1\n      - run: if [ \"$RUN\" = all ]; then node --test; else node --test $RUN; fi\n"),
};
