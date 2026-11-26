// Tests of how the draft in a release's trial names each check (#1334; scripts/trial-draft-checks.mjs): by its
// workflow and job, so one workflow's job stands for no other's; a workflow run failed with no failed job of its own a
// check of its own; a skip after passing on main read through a rename alone; one tied to no workflow kept apart; and
// two checks on one name, in one commit or across the two, giving no answer. The rest: tests/trial-draft-test.mjs. No
// call reaches the network, and no process is started. Node's own modules.
//
//   node tests/trial-draft-names-test.mjs
import { readDraft } from "../scripts/trial-draft.mjs";
import { tally } from "../scripts/scratch-core.mjs";
import { TRIED, host } from "./trial-draft-host.mjs";

const { ok, done } = tally();
const F = (name, id, c = "failure") => ({ name, status: "completed", conclusion: c, check_suite_id: id }), J = (name, id, c) => ({ name, status: "completed", conclusion: c, check_suite: { id } });
const at = over => readDraft("o/p", "7", TRIED, [], host(over));

// (a workflow run failed with no failed job of its own, and each job named by its workflow)
const jobless = at({ draftFlows: [F("lint", 9), F("build", 8)], draftRuns: [J("compile", 8, "failure")] }), passedJob = at({ draftFlows: [F("e2e", 3)], draftRuns: [J("run", 3, "success")] });
const twoFlows = at({ mainFlows: [F("push-ci", 5)], mainRuns: [J("test", 5, "failure")], draftFlows: [F("pr-ci", 6)], draftRuns: [J("test", 6, "failure")] });
ok(jobless.failed?.includes("lint (failed outside its jobs)") && jobless.failed.includes("build: compile") && !jobless.failed.includes("build (failed outside its jobs)") && passedJob.failed?.includes("e2e (failed outside its jobs)")
  && twoFlows.failed?.includes("pr-ci: test") && twoFlows.answer?.draftFailedAlone === 2 && twoFlows.answer.draftFailedBoth === 0,
  "a workflow run that failed with no failed job of its own is a failed check, one with a job failing by it, and each job is named by its workflow, so a failure of one workflow's job on main stands for no other's", JSON.stringify([jobless, passedJob, twoFlows]));

// (a skip read against main through a rename alone)
const renamed = [F("CI checks", 6, "success"), null].map(f => at({ mainFlows: [F("CI", 5, "success")], mainRuns: [J("lint", 5, "success")], draftFlows: f ? [f] : [], draftRuns: [J("lint", 6, "skipped")] }));
const held = at({ mainRuns: [J("lint", 50, "success")], draftFlows: [F("docs", 7, "success")], draftRuns: [J("lint", 51, "success"), J("lint", 7, "skipped")] });
const ran = at({ mainFlows: [F("CI", 5, "success")], mainRuns: [J("lint", 5, "success")], draftFlows: [F("CI", 6, "success"), F("docs", 7, "success")], draftRuns: [J("build", 6, "success"), J("lint", 7, "skipped")] });
const onMain = at({ mainFlows: [F("CI", 5, "success"), F("docs", 8, "success")], mainRuns: [J("lint", 5, "success"), J("build", 8, "success")], draftFlows: [F("docs", 7, "success")], draftRuns: [J("lint", 7, "skipped")] });
ok(renamed.every(r => r.answer?.draftSkippedAfter === 1) && [held, ran, onMain].every(r => r.answer?.draftSkipped === 1 && r.answer.draftSkippedAfter === 0),
  "  a skip after passing on main under a workflow renamed, or tied to none, is not run after, while a job of another workflow of the same name skipped on the draft is a skip alone where main's check is on the draft, its workflow ran there or the draft's ran on main", JSON.stringify([renamed, held, ran, onMain]));

// (two checks on one name: one tied to no workflow kept apart; two workflows' pairs, in one commit or across the two, none)
const app = at({ draftFlows: [F("CI", 6, "success")], draftRuns: [J("lint", 6, "success"), J("CI: lint", 99, "failure")] });
const clash = at({ draftFlows: [F("A", 3, "success"), F("A: B", 4, "success")], draftRuns: [J("B: x", 3, "success"), J("x", 4, "success")] });
const crossed = at({ mainFlows: [F("A: B", 5)], mainRuns: [J("x", 5, "failure")], draftFlows: [F("A", 6)], draftRuns: [J("B: x", 6, "failure")] });
const mend = /meet on the name "A: B: x" from two workflows or jobs[^]*Mend: tell the owner; in a pull request of the project's own, never the sync's draft, give one of them another name, and read again once it has merged$/;
ok(app.failed?.includes("CI: lint (no workflow)") && app.answer?.draftFailedAlone === 2 && /^two checks of \w{7} /.test(clash.why ?? "") && mend.test(clash.why) && /^two checks of main's newest commit and the draft /.test(crossed.why ?? "") && mend.test(crossed.why),
  "  a check tied to no workflow named as a workflow's job is kept apart under its own name, and two workflows' jobs meeting on one name, in one commit or across main's and the draft's, give no answer, saying its mend", JSON.stringify([app, clash.why, crossed.why]));
done("the names of the draft's checks in a release's trial");
