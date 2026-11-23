// Tests of the reader of a project's `security-review.yml` (review-caller.mjs; #1085): the kit's call read as posting
// the status on every pull request, in a public repository and, given `private: true` or `advisory: false`, in a private
// one; each form GitHub would refuse, start on some pull requests alone, or run where the check cannot post, read as not
// known; a call of another repository's, and a `root` that does not hold the core, among them. Node's own modules.
//
//   node tests/review-caller-test.mjs
import fs from "node:fs";
import { CORE } from "../scripts/core-address.mjs";
import { callsPosting } from "../scripts/review-caller.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const pin = "a".repeat(40), held = new Set(["core/.node-version", "core/scripts/security-review.mjs"]), has = f => held.has(f);
const call = w => `on:\n  pull_request:\n    types: [opened, reopened, synchronize, ready_for_review]\n  issue_comment:\n    types: [created, edited]\njobs:\n  queue:\n    permissions:\n      contents: read\n      pull-requests: read\n      issues: read\n    uses: ${CORE}/.github/workflows/queue-only.yml@${pin}\n  security-review:\n    needs: queue\n    if: \${{ !cancelled() }}\n    permissions:\n      contents: read\n      pull-requests: read\n      statuses: write\n    uses: ${CORE}/.github/workflows/security-review.yml@${pin} # the pin\n${w}`;

// the kit's own call, as the starter kit renders it
const kit = fs.readFileSync(new URL("../setup/template/workflows/security-review.yml.tmpl", import.meta.url), "utf8").replaceAll("{{core}}", CORE).replaceAll("{{pin}}", pin);
ok(callsPosting(kit, true, has) === true && callsPosting(kit, false, has) === false, "the kit's call: posting in a public repository, and in a private one not, wanting `private: true`");
ok(callsPosting(call(""), true, has) === true, "the fixture's call, the kit's form: posting in a public repository");

// the core a call's root holds
for (const [w, holds, said] of [["", true, "the default root, holding the core"], ["    with:\n      root: core/\n", true, "a root with its slash"],
  ["    with:\n      root: lib/core\n", false, "a root that does not hold the core"], ["    with:\n      root: ${{ vars.ROOT }}\n", false, "a root read only at its run"],
  ["    with:\n      root: ../core\n", false, "a root out of the project"], ["    with:\n      root: /core\n", false, "a root that is absolute"],
  ["    with:\n      root: ./core\n", true, "a root from the project's own folder"], ["    with:\n      root: /\n", false, "the runner's root"], ["    with:\n      root: ///\n", false, "the runner's root, its slash doubled"],
  ["    with:\n      root: ''\n", false, "an empty root"], ["    with:\n      root: nope/../core\n", false, "a root through a folder that is not there"], ["    with:\n      root: core//\n", false, "a root with its slash doubled"],
  ["    with:\n      root: 'core '\n", false, "a root with a space"]]) {
  const got = callsPosting(call(w), true, has);
  ok(got === (holds ? true : null), `a public repository whose call is given ${said}: ${holds ? "posting" : "not known"}`, String(got));
}
ok(callsPosting(call(""), true, f => f !== "core/.node-version" && has(f)) === null, "a core with no Node version, on which the workflow fails: not known");
for (const [w, where] of [["    with:\n      advisory: ${{ vars.ADVISORY }}\n", true], ["    with:\n      private: true\n      advisory: ${{ vars.ADVISORY }}\n", false]])
  ok(callsPosting(call(w), where, has) === null, `a ${where ? "public" : "private"} repository whose call gives a boolean input an expression, on which GitHub fails the call: not known`);
ok(callsPosting(call("").replace("  queue:\n", "  Queue:\n  queue:\n").replace("jobs:\n  Queue:\n", "jobs:\n  Queue:\n    uses: " + CORE + "/.github/workflows/queue-only.yml@" + pin + "\n    permissions: read-all\n"), true, has) === null, "two jobs named alike but for case, which GitHub refuses: not known");
ok(callsPosting(call("").replaceAll(CORE, "someone/agent-core"), true, has) === null, "a call of a workflow of the same name in another repository: not known");
ok(callsPosting(call("").replace(`queue-only.yml@`, `x/queue-only.yml@`), true, has) === null, "a call of the core's by a path the core has not: not known");
ok(callsPosting(call("").replaceAll(CORE, CORE.toLowerCase()), true, has) === true, "the core's repository named in another case, which GitHub finds: posting");
ok(callsPosting(call("").replaceAll(CORE, CORE.replace(/k/i, "\u212a")), true, has) === null, "the core's repository named with a sign that lowers to a letter (the Kelvin sign), which GitHub does not find: not known");
for (const [from, to, said] of [["/.github/workflows/queue-only", "/.GITHUB/workflows/queue-only", "a folder"], ["/.github/workflows/queue-only", "/.github/Workflows/queue-only", "a folder"], ["queue-only.yml@", "Queue-Only.yml@", "a workflow's name"]]) {
  let got;
  try { got = callsPosting(call("").replace(from, to), true, has); } catch (e) { got = e; }
  ok(got === null, `a call of the core's by ${said} in another case, which GitHub does not find: not known, and no failure`, String(got));
}

for (const [w, said] of [["    with:\n      private: true\n", "`private: true`"], ["    with:\n      advisory: false\n", "`advisory: false`, which posts the status"],
  ["    with: { private: true }\n", "`private: true` in a flow mapping"], ["    with:\n      private: true # runs in a private repository\n", "`private: true` with a comment"],
  ["    with:\n      advisory: false  # enforce review\n", "`advisory: false` with a comment"]]) {
  ok(callsPosting(call(w), false, has) === true, `a private repository whose call is given ${said}: read as posting`);
  ok(callsPosting(call(w).replace("  issue_comment:\n    types: [created, edited]\n", "  issue_comment:\n").replace("    needs: queue\n    if: ${{ !cancelled() }}\n    permissions:\n      contents: read\n      pull-requests: read\n      statuses: write\n", "").replace("jobs:", "permissions: write-all\njobs:"), false, has) === true, `a private repository whose call is given ${said}, its rights the workflow's and its comments' types GitHub's own: read as posting`);
}
const perms = "    permissions:\n      contents: read\n      pull-requests: read\n      statuses: write\n", ons = /on:\n  pull_request:\n.*\n  issue_comment:\n.*\n/;
for (const [text, said] of [[call("    with:\n      private: ${{ vars.PRIVATE }}\n"), "an input read only at its run"], ["jobs: [\n", "no YAML"],
  ["jobs:\n  other:\n    uses: x/y/.github/workflows/z.yml@b\n    with:\n      private: true\n", "no call of the core's security review"],
  [call("    with:\n      private: true\n").replace(/^  (queue|security-review):\n    /gm, "  - "), "jobs as a list, which GitHub refuses"],
  [call("    with:\n      private: true\n").replace(perms, ""), "no permissions given, left to the repository's default"],
  [call("    with:\n      private: true\n").replace(perms, "").replace("jobs:", "permissions: {}\njobs:"), "a workflow that grants nothing"],
  [call("    with:\n      private: true\n").replace(/  queue:\n[\s\S]*?(?=  security-review:)/, ""), "a job needed that is not there"],
  [`# private: true\n${call("    with:\n      private: false\n")}`, "only a comment that says it, not the call"]]) {
  const got = callsPosting(text, false, has);
  ok(got === (said.startsWith("only") ? false : null), `a private repository whose call holds ${said}: ${said.startsWith("only") ? "read as not posting" : "not known, never not posting"}`, String(got));
}
// each break of a call that would post, in a private repository giving private: true and in a public one
for (const [change, said] of [[t => t.replace("if: ${{ !cancelled() }}", "if: false"), "a condition on its call other than the kit's"],
  [t => t.replace(ons, "on: [push]\n"), "no pull request among its triggers"],
  [t => t.replace("types: [opened, reopened, synchronize, ready_for_review]", "types: [closed]"), "a pull request's types the kit's do not hold"],
  [t => t.replace("types: [opened, reopened, synchronize, ready_for_review]", "types: [opened, reopened, synchronize]"), "a pull request's types without a draft marked ready"],
  [t => t.replace(ons, "on: [pull_request, issue_comment]\n"), "GitHub's own types of a pull request, which leave out a draft marked ready"],
  [t => t.replace("    types:", "    branches: [release]\n    types:"), "a filter of branches"],
  [t => t.replace("    types:", "    paths: ['docs/**']\n    types:"), "a filter of paths"],
  [t => t.replace(/  issue_comment:\n.*\n/, ""), "no comment among its triggers, through which alone a pull request of Dependabot's or a fork's gets the status"],
  [t => t.replace("types: [created, edited]", "types: [deleted]"), "a comment's types the kit's do not hold"],
  [t => t.replace("      statuses: write\n", "      statuses: read\n"), "a job given no right to write statuses"],
  [t => t.replace(perms, "    permissions:\n      statuses: write\n"), "a call granted statuses alone, less than the review asks"],
  [t => t.replace("      contents: read\n      pull-requests: read\n      issues: read\n", "      contents: none\n"), "a queue's call granted less than it asks"],
  [t => t.replace("    needs: queue\n", "    needs: [queue, build]\n"), "a job needed that is not there"],
  [t => t.replace("queue-only.yml", "other.yml"), "a call of another workflow, whose asks are not read"],
  [t => t.replace("jobs:", "concurrency:\n  group: x\n  cancel-in-progress: true\njobs:"), "a concurrency, by which a later run may cancel the one that posts"],
  [t => t.replace("    needs: queue\n", "    needs: queue\n    concurrency: { group: x, cancel-in-progress: true }\n"), "a concurrency on its call"],
  [t => t.replace(/(queue-only\.yml@a+\n)/, "$1    with:\n      advisroy: false\n"), "an input its workflow does not define"],
  [t => t.replace(/(queue-only\.yml@a+\n)/, "$1    with:\n      private: 'yes'\n"), "an input not of its type"],
  [t => t.replace(/(queue-only\.yml@a+\n)/, "$1    secrets: inherit\n"), "a secret passed"], [t => t.replace(/(queue-only\.yml@a+\n)/, "$1    runs-on: x\n"), "a call with a runner"],
  [t => t.replace("  queue:\n", "  queue:\n    needs: security-review\n"), "jobs that need each other"], [t => t.replace("needs: queue", "needs: [queue, security-review]"), "a job that needs itself"],
  [t => t.replace("jobs:\n", "jobs:\n  build:\n    runs-on: x\n    steps: [{ run: echo }]\n"), "a job not a call, which may wait on a runner or an approval"],
  [t => t.replace("jobs:", "bogus: 1\njobs:"), "a key at its top not the kit's"], [t => t.replace("  queue:\n", "  1q:\n").replace("needs: queue", "needs: 1q"), "a job named as GitHub refuses"],
  [t => t.replace("    if: ${{ !cancelled() }}\n", ""), "a job it needs and no condition, so skipped where that job fails"]]) {
  for (const [w, where] of [["    with:\n      private: true\n", "private"], ["", "public"]]) {
    const broken = change(call(w)), got = callsPosting(broken, where === "public", has);
    ok(broken !== call(w) && got === null, `a ${where} repository whose call holds ${said}: not known`, String(got));
  }
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
