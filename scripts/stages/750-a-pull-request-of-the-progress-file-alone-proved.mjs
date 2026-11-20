// The stage of scripts/steps/750-a-pull-request-of-the-progress-file-alone-proved.mjs: how a project that missed that step holds it, and its mend as the step words it.
// scripts/steps-stage.mjs loads it, in the order of the names.
import fs from "node:fs";
import { CORE } from "../core-address.mjs";
import { PIN, at, read, write } from "../stage-helpers.mjs";

export default {
  asked: true,
  // (the caller of the core's security-review.yml as the starter kits before it wrote it: no job `queue`, and the
  // review's job neither needs it nor is handed its head; where the step of 12 November has taken the caller out, one
  // that holds the job `queue` alone, which that step's mend then writes over with the caller it kept)
  stage: dir => {
    const file = ".github/workflows/security-review.yml";
    if (!fs.existsSync(at(dir, file))) {
      const pin = fs.existsSync(at(dir, ".stage/security-review.yml")) ? /security-review\.yml@(\S+)/.exec(read(dir, ".stage/security-review.yml"))?.[1] ?? PIN : PIN;
      return write(dir, file, `name: security-review\n\non:\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  queue:\n    permissions:\n      contents: read\n      pull-requests: read\n      issues: read\n    uses: ${CORE}/.github/workflows/queue-only.yml@${pin}\n`);
    }
    write(dir, file, read(dir, file).replace(/^ {2}queue:[ \t]*\r?\n(?:(?: {4}.*)?\r?\n)*/m, "").replace(/^ {4}(?:needs: queue|if: \$\{\{ !cancelled\(\) \}\})[ \t]*\r?\n/gm, "")
      .replace(/^ {6}queue: .*\r?\n/m, "").replace(/^ {4}with:[ \t]*\r?\n(?! {6})/m, ""));
  },
  // (as the step words it: the job `queue` at the pin the review's call has, and the three lines in the review's job;
  // nothing where the caller holds the job already)
  mend: dir => {
    const file = ".github/workflows/security-review.yml", text = read(dir, file), nl = text.includes("\r\n") ? "\r\n" : "\n";
    if (text.includes("/.github/workflows/queue-only.yml@")) return;
    const pin = /security-review\.yml@(\S+)/.exec(text)[1], lines = l => l.map(x => `${x}${nl}`).join("");
    const job = lines(["  queue:", "    permissions:", "      contents: read", "      pull-requests: read", "      issues: read", `    uses: ${CORE}/.github/workflows/queue-only.yml@${pin}`]);
    let out = text.replace(/^ {2}security-review:[ \t]*\r?\n/m, m => `${job}${m}${lines(["    needs: queue", "    if: ${{ !cancelled() }}"])}`);
    const queue = "      queue: ${{ needs.queue.outputs.head }}";
    out = /^ {4}with:[ \t]*$/m.test(out) ? out.replace(/^ {4}with:[ \t]*\r?\n/m, m => `${m}${lines([queue])}`)
      : out.replace(/^( {4}uses: \S+\/\.github\/workflows\/security-review\.yml@\S+[ \t]*)(\r?\n|$)/m, (m, uses) => `${uses}${nl}${lines(["    with:", queue])}`);
    write(dir, file, out);
  },
};
