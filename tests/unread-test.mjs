// Tests of what the workflow runner and the release's trial do with a job the runner cannot read (#1263, points 1 and
// 2): with sayUnread, each job it can read runs and keeps its own verdict, a gate over join(needs.*.result) among them,
// and a job it cannot read, a job behind one and a matrix it cannot read are each unread by their own key; without it,
// such a form still throws. In the trial's record, what was not read is not measured, a class of its own that holds the
// cut, never failed both nor the release's. check.mjs writing "unread" for each such job: tests/check-test.mjs. Node's
// own modules, the runner and the trial's record.
//
//   node tests/unread-test.mjs
import fs from "node:fs";
import path from "node:path";
import { compared, trialAt, trialRecord } from "../scripts/release-trial.mjs";
import { runWorkflow, withAbsolutePath } from "../scripts/workflow-run.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("unread-test-");
const env = withAbsolutePath(process.env);
const SHA = n => String(n).repeat(40);

{
  // (#1263, point 1: with `sayUnread`, each job the runner can read runs and keeps its verdict, a gate over
  // join(needs.*.result) among them; a job it cannot read, a job behind it and a matrix it cannot read are each said
  // unread by their own key; without it, a job it cannot read still throws, so a test of the core's own workflows fails)
  const ws = fs.mkdtempSync(path.join(tmp, "ws-"));
  const text = `on: pull_request
jobs:
  fine:
    runs-on: ubuntu-latest
    steps:
      - run: echo fine
  broken:
    runs-on: ubuntu-latest
    steps:
      - run: exit 3
  odd:
    if: hashFilez('x') != ''
    runs-on: ubuntu-latest
    steps:
      - run: echo odd
  behind:
    needs: odd
    runs-on: ubuntu-latest
    steps:
      - run: echo behind
  grid:
    strategy:
      matrix:
        include: [one]
    runs-on: ubuntu-latest
    steps:
      - run: echo grid
  shells:
    strategy:
      matrix:
        sh: [bash, pwsh]
    runs-on: ubuntu-latest
    steps:
      - run: echo shell
      - if: matrix.sh == 'pwsh'
        run: echo shell
        shell: pwsh
  gate:
    needs: [fine, broken]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - run: test "\${{ join(needs.*.result, ' ') }}" = "success failure"
`;
  const opts = { github: { event_name: "pull_request" }, base: env, temp: tmp, workspace: () => ws, uses: {} };
  let jobs = null, threw = null;
  try { jobs = runWorkflow(text, { ...opts, sayUnread: true }); } catch (e) { threw = e.message; }
  const by = Object.fromEntries((jobs ?? []).map(j => [j.job, j]));
  ok(threw === null && by.fine?.passed && by.broken?.ran && !by.broken.passed && by.gate?.ran && by.gate.passed,
    "a job the runner cannot read leaves every job it can read run, each with its own verdict, the gate over join(needs.*.result) among them (#1263, point 1)", threw ?? JSON.stringify(jobs));
  ok(/a function this reader does not know: hashFilez/u.test(by.odd?.unread ?? "") && by.odd.ran === false && !by.odd.passed && /^it needs odd, which this runner could not read$/u.test(by.behind?.unread ?? "") && by.behind.ran === false,
    "  the job it cannot read is said unread with why, and a job that needs it measured nothing, never a guessed result", JSON.stringify([by.odd, by.behind]));
  ok(/a matrix's include this runner does not know/u.test(by.grid?.unread ?? "") && by["shells (bash)"]?.passed && /^a shell this runner does not know: pwsh \(in shells\)$/u.test(by["shells (pwsh)"]?.unread ?? "") && by["shells (pwsh)"].ran === false,
    "  a matrix it cannot read is unread by its job's own key, and of one it reads, only the combination it cannot run is unread", JSON.stringify([by.grid, by["shells (bash)"], by["shells (pwsh)"]]));
  let strict = null;
  try { runWorkflow(text, opts); } catch (e) { strict = e.message; }
  ok(/does not know/u.test(strict ?? ""), "  without sayUnread, a form it cannot read still throws, so a test of the core's own workflows fails and teaches it", strict);

  // (#1263, point 2: what cannot be read is not measured, a class of its own that holds the cut (#1257), never failed both)
  const c = compared({ "ci.yml": "failed", "own.yml/a": "passed", "own.yml/b": "unread", "own.yml/c": "unread", "gone.yml/x": "passed", "m.yml/grid": "unread" },
    { "ci.yml/lint": "passed", "ci.yml/test": "failed", "ci.yml/gate": "unread", "own.yml/a": "unread", "own.yml/b": "failed", "own.yml/c": "passed", "gone.yml": "unread", "m.yml/grid (one)": "failed" });
  ok(c.unreadAfter.join() === "ci.yml/gate,own.yml/a,gone.yml" && c.unreadBefore.join() === "ci.yml/test,own.yml/b,m.yml/grid (one)" && c.ranAfterAlone.join() === "ci.yml/lint,own.yml/c"
    && !c.failedBoth.length && !c.failedBeforeAlone.length && !c.failedAfterAlone.length && !c.ranBeforeAlone.length,
    "a job unread after is not measured, whatever it was before; one unread before, or in a file an older check.mjs could not read whole, that fails after is not measured either; none is failed both, nor the release's, and a whole file unread after counts its jobs of before with it", JSON.stringify(c));
  const record = trialRecord(SHA("d"), "2026-11-24", [[{ "ci.yml": "failed" }, { "ci.yml/lint": "passed", "ci.yml/gate": "unread" }]]);
  const at = trialAt(SHA("d"), args => (args[0] === "show" ? JSON.stringify(record) : ""));
  ok(record.unreadAfter === 1 && record.failedBoth === 0 && record.failedBeforeAlone === 0 && /1 check was not measured in the trial on a real project, 1 of them not read after the update and 0 not read before it and failed after[\s\S]*Mend: teach the core's workflow runner/u.test(at.held ?? "") && /1 not read after it and 0 not read before it and failed after \(not measured\)/u.test(at.said),
    "  and the record counts it, and release.mjs reads the class as holding the cut, saying its mend", `${at.said}\n${at.held}`);
  const before = trialAt(SHA("d"), args => (args[0] === "show" ? JSON.stringify({ ...record, unreadAfter: 0, unreadBefore: 2 }) : ""));
  ok(/2 checks were not measured[\s\S]*0 of them not read after the update and 2 not read before it and failed after[\s\S]*take the run before the update again with the release's check\.mjs/u.test(before.held ?? ""), "  one not read before and failed after holds it too, its mend the run before taken again by the release's check.mjs", before.held);
}
done("a job the runner cannot read, and the trial's not measured");
