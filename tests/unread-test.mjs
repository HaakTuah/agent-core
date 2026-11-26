// Tests of what the workflow runner and the release's trial do with a job the runner cannot read (#1263, points 1 and
// 2): with sayUnread, each job it can read runs and keeps its own verdict, a gate over join(needs.*.result) among them,
// and a job it cannot read, a job behind one and a matrix it cannot read are each unread by their own key; without it,
// such a form still throws. In the trial's record, what was not read is not measured, a class of its own that holds the
// cut, never failed both nor the release's; and a job that ran before and was stopped or not run after holds it too,
// one that ran in neither run, stopped or unrun, holding nothing (#1257). check.mjs writing "unread" for each such job:
// tests/check-test.mjs. Node's own modules, the runner and the trial's record.
//
//   node tests/unread-test.mjs
import fs from "node:fs";
import path from "node:path";
import { compared, trialAt, trialRecord } from "../scripts/release-trial.mjs";
// (a sync's reading for the project tried, which every record holds, #1261)
const SYNC = { pure: true, from: "release-1" }, OTHER = { none: "another-owner" };
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

  // (#1263, point 2, as #1257 sets it: a job that ran before and could not be read after holds the cut, never failed both;
  // one read in neither run is not measured, a class of its own that holds nothing)
  const c = compared({ "ci.yml": "failed", "own.yml/a": "passed", "own.yml/b": "unread", "own.yml/c": "unread", "own.yml/d": "unread", "gone.yml/x": "passed", "m.yml/grid": "unread", "m2.yml/grid": "passed" },
    { "ci.yml/lint": "passed", "ci.yml/test": "failed", "ci.yml/gate": "unread", "own.yml/a": "unread", "own.yml/b": "failed", "own.yml/c": "passed", "own.yml/d": "unread", "new.yml/n": "unread", "gone.yml": "unread", "m.yml/grid (one)": "failed", "m2.yml/grid (two)": "unread" });
  ok(c.unreadAfter.join() === "own.yml/a,gone.yml,m2.yml/grid (two)" && c.unreadNeither.join() === "ci.yml/gate,own.yml/d,new.yml/n" && c.unreadBefore.join() === "ci.yml/test,own.yml/b,m.yml/grid (one)" && c.ranAfterAlone.join() === "ci.yml/lint,own.yml/c"
    && !c.failedBoth.length && !c.failedBeforeAlone.length && !c.failedAfterAlone.length && !c.ranBeforeAlone.length,
    "a job that ran before, by its key, its file or its matrix, and is unread after is not measured after; one unread after that ran not before, unread then too, new, or in a file an older check.mjs could not read whole, is not measured in either run; one unread before that fails after is not measured either; none is failed both, nor the release's", JSON.stringify(c));
  const job = compared({ "a.yml/x": "failed", "b.yml": "failed" }, { "a.yml/x/y": "unread", "b.yml/z": "unread" });
  ok(job.unreadAfter.join() === "a.yml/x/y" && job.unreadNeither.join() === "b.yml/z" && !job.failedBeforeAlone.length,
    "  a job, or a call, failed before is read as run then, so one unread under it after holds the cut, never the record's guess that it measured nothing; only a whole file failed before is read so", JSON.stringify(job));
  const record = trialRecord(SHA("d"), "2026-11-24", [[{ "ci.yml/gate": "passed" }, { "ci.yml/lint": "passed", "ci.yml/gate": "unread" }]], [SYNC], [OTHER]);
  const at = trialAt(SHA("d"), args => (args[0] === "show" ? JSON.stringify(record) : ""));
  ok(record.unreadAfter === 1 && record.failedBoth === 0 && record.failedBeforeAlone === 0 && /1 check was not measured in the trial on a real project, 1 of them run before and not read after the update and 0 not read before it and failed after[\s\S]*Mend: teach the core's workflow runner/u.test(at.held ?? "") && /1 run before and not read after it and 0 not read before it and failed after \(not measured\)/u.test(at.said),
    "  and the record counts it, and release.mjs reads the class as holding the cut, saying its mend", `${at.said}\n${at.held}`);
  const before = trialAt(SHA("d"), args => (args[0] === "show" ? JSON.stringify({ ...record, unreadAfter: 0, unreadBefore: 2 }) : ""));
  ok(/2 checks were not measured[\s\S]*0 of them run before and not read after the update and 2 not read before it and failed after[\s\S]*take the run before the update again with the release's check\.mjs/u.test(before.held ?? ""), "  one not read before and failed after holds it too, its mend the run before taken again by the release's check.mjs", before.held);
  const neither = trialRecord(SHA("d"), "2026-11-24", [[{ "ci.yml": "failed", "own.yml/d": "unread" }, { "ci.yml/lint": "passed", "ci.yml/gate": "unread", "own.yml/d": "unread" }]], [SYNC], [OTHER]);
  const neitherAt = trialAt(SHA("d"), args => (args[0] === "show" ? JSON.stringify(neither) : ""));
  ok(neither.unreadNeither === 2 && neither.unreadAfter === 0 && neither.failedBoth === 0 && neitherAt.held === null && /2 read in neither run \(not measured, holding nothing\)/u.test(neitherAt.said),
    "  a job read in neither run is counted and said, never failed both, and holds nothing, as #1257 says of a check that ran neither before nor after", `${neitherAt.said}\n${neitherAt.held}`);

  // (#1257: a check that ran before and was stopped after, or not run after, holds the cut, its mend the trial run again
  // once what stopped it is mended; one stopped after that ran not before ran in neither run and holds nothing)
  const s = compared({ "a.yml/x": "passed", "b.yml/y": "unrun", "c.yml/z": "stopped", "e.yml/k": "failed" },
    { "a.yml/f": "failed", "a.yml/x": "stopped", "b.yml/y": "stopped", "c.yml/z": "stopped", "d.yml": "stopped", "e.yml": "stopped" });
  ok(s.stoppedAfter.join() === "a.yml/x,e.yml" && s.stoppedNeither?.join() === "b.yml/y,c.yml/z,d.yml" && !s.failedBeforeAlone.length && !s.ranBeforeAlone.length,
    "a job stopped after that ran before, by its key or under its file, is stopped after; one that ran not before, stopped or unrun then too, or new, ran in neither run (#1257)", JSON.stringify(s));
  const stopped = trialRecord(SHA("e"), "2026-11-24", [[{ "a.yml/x": "passed", "a.yml/y": "passed", "b.yml/n": "unrun" }, { "a.yml/x": "failed", "a.yml/y": "stopped", "b.yml/n": "stopped" }]], [SYNC], [OTHER]);
  const held = trialAt(SHA("e"), args => (args[0] === "show" ? JSON.stringify({ ...stopped, failedAfter: 0 }) : ""));
  ok(stopped.stoppedAfter === 1 && stopped.stoppedNeither === 1 && /1 check that ran before measured nothing after the update in the trial on a real project, 1 stopped behind a failure and 0 not run on the trial's machine[\s\S]*Mend: find from the trial's run after the update what stopped it, mend that[\s\S]*try the release/u.test(held.held ?? "") && /1 stopped after it that ran not before \(holding nothing\)/u.test(held.said),
    "  the record counts each, and release.mjs reads one that ran before and was stopped after as holding the cut, with its mend: the trial run again once what stopped it is mended", `${held.said}\n${held.held}`);
  const unrun = trialAt(SHA("e"), args => (args[0] === "show" ? JSON.stringify({ ...stopped, failedAfter: 0, stoppedAfter: 0, unrunAfterRan: 2 }) : ""));
  ok(/2 checks that ran before measured nothing after the update[\s\S]*0 stopped behind a failure and 2 not run on the trial's machine/u.test(unrun.held ?? ""), "  one that ran before and was not run after holds it too", unrun.held);
  const neitherStopped = trialAt(SHA("e"), args => (args[0] === "show" ? JSON.stringify({ ...stopped, failedAfter: 0, stoppedAfter: 0 }) : ""));
  ok(neitherStopped.held === null && /0 ran before and stopped after it behind a failure, 1 stopped after it that ran not before \(holding nothing\)/u.test(neitherStopped.said), "  and one stopped after that ran not before holds nothing, as #1257 says of a check that ran neither before nor after", `${neitherStopped.said}\n${neitherStopped.held}`);
  const unrunBoth = trialRecord(SHA("e"), "2026-11-24", [[{ "w.yml/x": "unrun" }, { "w.yml/x": "unrun", "a.yml/y": "passed" }]], [SYNC], [OTHER]);
  const unrunBothAt = trialAt(SHA("e"), args => (args[0] === "show" ? JSON.stringify(unrunBoth) : ""));
  ok(unrunBoth.unrunAfter === 1 && unrunBoth.unrunAfterRan === 0 && unrunBothAt.held === null, "  and one unrun in both runs, a suite for another system's runner, holds nothing, as #1257 says", `${JSON.stringify(unrunBoth)}\n${unrunBothAt.held}`);
}
done("a job the runner cannot read, and the trial's not measured");
