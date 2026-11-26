// The stage of scripts/steps/826-the-daily-look-reads-the-whole-history.mjs: how a project that missed that step holds
// it, and its mend as the step words it. scripts/steps-stage.mjs loads it, in the order of the names.
import fs from "node:fs";
import { CORE } from "../core-address.mjs";
import { readCore } from "../core-path.mjs";
import { at, read, write, PIN } from "../stage-helpers.mjs";

const LOOK = ".github/workflows/look.yml";
const CALL = /^( {4}uses: .*\/\.github\/workflows\/look\.yml@)[0-9a-f]{40}/mu;
export default {
  // (the daily job's call left at an earlier commit, as a project that keeps its call off the sync holds it; where the
  // project has no daily job of the kit's, that call written so)
  stage: dir => write(dir, LOOK, fs.existsSync(at(dir, LOOK)) ? read(dir, LOOK).replace(CALL, `$1${PIN}`)
    : `name: look\n\non:\n  schedule:\n    - cron: '41 5 * * *'\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\njobs:\n  look:\n    permissions:\n      contents: read\n      issues: write\n      pull-requests: read\n      checks: read\n      statuses: read\n    uses: ${CORE}/.github/workflows/look.yml@${PIN}\n    secrets:\n      PERSONAL_TERMS: \${{ secrets.PERSONAL_TERMS }}\n`),
  mend: dir => write(dir, LOOK, read(dir, LOOK).replace(CALL, `$1${readCore(read(dir, "core-manifest.md")).pin}`)),
};
