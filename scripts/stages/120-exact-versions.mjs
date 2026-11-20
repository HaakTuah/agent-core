// The stage of scripts/steps/120-exact-versions.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import fs from "node:fs";
import { at, read, write } from "../stage-helpers.mjs";

export default {
  // (an npm project that runs the licence script from a workflow of its own, without the exact-versions check)
  stage: dir => {
    if (!fs.existsSync(at(dir, "package-lock.json"))) write(dir, "stage-npm/package-lock.json", "{}\n");
    const core = at(dir, ".github/workflows/licences.yml");
    if (fs.existsSync(core)) { write(dir, ".stage-licences/licences.yml", fs.readFileSync(core, "utf8")); fs.rmSync(core); }
    write(dir, ".github/workflows/licences-own.yml", "name: licences-own\n\non:\n  pull_request:\n\njobs:\n  licences:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/install.mjs\n      - run: node core/scripts/licences.mjs checks/licences.json\n      - run: node core/scripts/agent-tools.mjs checks/licences.json\n      - run: node core/scripts/lookup.mjs checks/licences.json\n");
  },
  mend: dir => {
    write(dir, ".github/workflows/licences-own.yml", `${read(dir, ".github/workflows/licences-own.yml")}      - run: node core/scripts/exact-versions.mjs checks/licences.json\n`);
    if (fs.existsSync(at(dir, ".stage-licences"))) { write(dir, ".github/workflows/licences.yml", read(dir, ".stage-licences/licences.yml")); fs.rmSync(at(dir, ".stage-licences"), { recursive: true }); }
  },
};
