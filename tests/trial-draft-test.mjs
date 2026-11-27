// Tests of the draft in a release's trial (#1334; AGENTS.md, "A release's trial opens its update as a draft in the
// owner's own projects"): the draft's checks read beside main's on a stand-in for the host, each in its class; no answer
// for a draft of another owner's, behind a stop switch or one not read, no draft, pinned elsewhere, with no check or one
// not finished, or a list not read whole; and why none was opened, read. The record the readings make and the cut it
// holds: tests/trial-draft-record-test.mjs. No call reaches the network, and no process is started. Node's own modules.
//
//   node tests/trial-draft-test.mjs
import { OWNER } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { draftCounts, readDraft, readNone, repoHash } from "../scripts/trial-draft.mjs";
import { saidOf } from "../scripts/trial-draft-checks.mjs";
import { DRAFT_COUNTS, LINE, draftAnswerOf } from "../scripts/trial-draft-record.mjs";
import { tally } from "../scripts/scratch-core.mjs";
import { HEAD, SHA, TRIED, host } from "./trial-draft-host-test.mjs";

const { ok, done } = tally();

// (each check run and status in its verdict: a job skipped, as on a draft, did not run; one not finished waits)
const said = saidOf([{ name: "lint", status: "completed", conclusion: "success" }, { name: "skip", status: "completed", conclusion: "skipped" }, { name: "late", status: "in_progress", conclusion: null },
  { name: "both", status: "completed", conclusion: "success" }, { name: "both", status: "completed", conclusion: "failure" }, { name: "odd", status: "completed", conclusion: "something new" }], [{ context: "ext", state: "error" }, { context: "wait", state: "pending" }]);
ok(JSON.stringify(said) === JSON.stringify({ lint: "passed", skip: "skipped", late: "waiting", both: "failed", odd: "failed", ext: "failed", wait: "waiting" }),
  "a check run or status is skipped, passed, failed or waiting, a name twice its worse, and a conclusion of no known form failed", JSON.stringify(said));

// (each class: a check run on main alone, a push's job, measures nothing of the draft)
const counts = draftCounts({ pp: "passed", fp: "failed", pf: "passed", ff: "failed", push: "passed", gate: "passed", off: "passed" }, { pp: "passed", fp: "passed", pf: "failed", ff: "failed", review: "failed", new: "passed", gate: "failed", skip: "skipped", off: "skipped" }, ["gate"]);
ok(Object.keys(counts).join() === DRAFT_COUNTS.join() && Object.values(counts).join() === "1,1,1,1,1,1,1,1,1",
  "passed on both, fixed on the draft, failed on both, failed on the draft where it passed on main, failed and passed on the draft alone, a gate the builder named and a check skipped on the draft, apart where it passed on main, are each counted, and a job of main's alone is not", JSON.stringify(counts));

const read = readDraft("o/p", "7", TRIED, [], host());
ok(read.answer?.commit === TRIED && read.answer.repo === repoHash(41) && read.answer.draftPassedBoth === 1 && read.answer.draftFailedAlone === 1 && read.failed.join() === "dependency review",
  "a draft pinned to the commit tried is read beside main's newest commit, with its repository's id hashed: the dependency review, on the draft alone, failed", JSON.stringify(read));
const refused = [readDraft("o/p", "7", TRIED, [], host({ pull: { base: { ref: "main", repo: { owner: { login: "someone-else" }, default_branch: "main" } } } })), readDraft("o/p", "7", TRIED, [], host({ stop: true })),
  readDraft("o/p", "7", TRIED, [], host({ pull: { draft: false } })), readDraft("o/p", "7", TRIED, [], host({ pull: { base: { ref: "crafted", repo: { fork: false, owner: { login: OWNER }, default_branch: "main" } } } })), readDraft("o/p", "7", TRIED, [], host({ pin: SHA("d") })), readDraft("o/p", "7", TRIED, [], host({ late: true })),
  readDraft("o/p", "7", TRIED, [], host({ stop: "unread" })), readDraft("o/p", "7", TRIED, [], host({ empty: true })), readDraft("o/p", "7", TRIED, [], host({ short: true })),
  readDraft("o/p", "7", TRIED, [], host({ empty: "skipped" })), readDraft("o/p", "7", TRIED, [], host({ queued: true })), readDraft("o/p", "7", TRIED, [], host({ pull: { head: { sha: HEAD, repo: { id: 99 } } } })), readDraft("o/p", "7", TRIED, [], host({ pull: { user: { login: "someone-else" } } })),
  readDraft("o/p", "7", TRIED, [], host({ noCore: true })), readDraft("o/p", "7", TRIED, [], host({ manifest: "unread" })), readDraft("o/p", "7", TRIED, [], host({ pull: { head: { sha: HEAD, repo: {} }, base: { ref: "main", repo: { fork: false, owner: { login: OWNER }, default_branch: "main" } } } })), readDraft("o/p", "7", TRIED, [], host({ mainLate: true })),
  readDraft("o/p", "7", TRIED, [], host({ carried: true })), readDraft("o/p", "7", TRIED, [], host({ mainQueued: true }))];
ok(refused.every(r => !r.answer && mended(`FAIL no answer for the draft: ${r.why}.`)) && /not owned by the core's owner's account[\s\S]*tell the owner at once[\s\S]*none <the commit tried>/.test(refused[0].why) && /stop switch stands[\s\S]*write nothing more there[\s\S]*none <the commit tried>/.test(refused[1].why)
  && /no draft/.test(refused[2].why) && /against crafted, not the project's default branch, main/.test(refused[3].why) && /pins ddddddd, not the commit tried, aaaaaaa[\s\S]*sync\.mjs a{40}/.test(refused[4].why) && /1 checks on the draft and 0 on main's newest commit have not finished/.test(refused[5].why)
  && /stop switch could not be read \(GitHub answered 403/.test(refused[6].why) && /no check has run on the draft/.test(refused[7].why) && /GitHub gave 2 of 3 check_runs/.test(refused[8].why)
  && /no check has run on the draft/.test(refused[9].why) && /1 checks on the draft/.test(refused[10].why) && /comes from another repository than the project's/.test(refused[11].why) && /comes from another account/.test(refused[12].why)
  && /pins no copy of this core/.test(refused[13].why) && /manifest could not be read \(GitHub answered 502/.test(refused[14].why) && /comes from another repository/.test(refused[15].why) && /0 checks on the draft and 1 on main's newest commit have not finished/.test(refused[16].why)
  && /pins no copy of this core/.test(refused[17].why) && /0 checks on the draft and 1 on main's newest commit have not finished/.test(refused[18].why),
  "no answer, each saying its mend, for a repository the core's owner does not own, a stop switch that stands or cannot be read, a pull request that is no draft, one against a branch that is not the default, one pinned elsewhere, a check not finished, no check on the draft, a list not read whole, every check skipped, a workflow not finished with no check yet, a pull request from a fork, one another account opened or one with no repository's id, a repository that takes no copy of this core or whose manifest could not be read, a check the draft holds still waiting on main, a default branch whose manifest carries the core with no pin, and a workflow the draft ran queued on main with no check yet", refused.map(r => r.why).join("\n"));
const gate = readDraft("o/p", "7", TRIED, ["dependency review"], host()), many = readDraft("o/p", "7", TRIED, [], host({ many: true })), unstarted = readDraft("o/p", "7", TRIED, [], host({ unstarted: true })), unstartedBoth = readDraft("o/p", "7", TRIED, [], host({ unstarted: "both" }));
const deploy = readDraft("o/p", "7", TRIED, [], host({ mainWaits: "deploy" })), skippedReview = readDraft("o/p", "7", TRIED, [], host({ skipReview: true }));
const deployRun = readDraft("o/p", "7", TRIED, [], host({ deployRun: true })), sameFlow = readDraft("o/p", "7", TRIED, [], host({ mainWaits: "tests" })), skippedAfter = readDraft("o/p", "7", TRIED, [], host({ skipReview: "after" }));
ok(deploy.answer?.draftPassedBoth === 1 && deployRun.answer?.draftSkipped === 1 && sameFlow.answer?.draftPassedBoth === 1 && skippedReview.answer?.draftSkipped === 1 && skippedReview.answer.draftFailedAlone === 0 && skippedReview.skipped.join() === "dependency review" && skippedReview.skippedAfter.length === 0 && skippedAfter.skippedAfter.join() === "dependency review" && skippedAfter.answer.draftSkippedAfter === 1 && skippedAfter.answer.draftSkipped === 0,
  "  a run on main waiting on a person (a deploy waiting for its reviewer, in a workflow of its own or the draft's, or a job the draft skipped) holds no reading, and a check skipped on the draft is counted and named apart, saying where it passed on main", JSON.stringify([deploy, deployRun, sameFlow, skippedReview, skippedAfter]));
// (on main: a job held for a person, a push's workflow the draft did not run and a check it does not hold give an
// answer, a run held for a person beside a finished one of its name read as that one; a check the draft skipped still
// running there, beside a run of its name held for a person or not, a workflow it skipped whole queued there, and a
// workflow it ran queued in either order beside one held for a person, give none)
const W = (name, status = "waiting") => ({ name, status, conclusion: null });
const heldJob = readDraft("o/p", "7", TRIED, [], host({ mainRuns: [W("deploy")], draftRuns: [{ name: "deploy", status: "completed", conclusion: "success" }] }));
const pushOnly = readDraft("o/p", "7", TRIED, [], host({ mainFlows: [W("release", "queued")] })), mainOnly = readDraft("o/p", "7", TRIED, [], host({ mainRuns: [W("publish", "in_progress")] }));
const lateSkip = readDraft("o/p", "7", TRIED, [], host({ mainRuns: [W("lint", "in_progress")], draftRuns: [{ name: "lint", status: "completed", conclusion: "skipped" }] }));
const twoRuns = [[W("tests"), W("tests", "queued")], [W("tests", "queued"), W("tests")]].map(f => readDraft("o/p", "7", TRIED, [], host({ mainFlows: f })));
const twoJobs = readDraft("o/p", "7", TRIED, [], host({ mainRuns: [W("lint"), W("lint", "in_progress")], draftRuns: [{ name: "lint", status: "completed", conclusion: "skipped" }] }));
const heldBeside = [["skipped", "success"], ["failure", "success"], ["failure", "failure"]].map(([c, m]) => readDraft("o/p", "7", TRIED, [], host({ mainRuns: [W("lint"), { name: "lint", status: "completed", conclusion: m }], draftRuns: [{ name: "lint", status: "completed", conclusion: c }] })));
const flowSkipped = readDraft("o/p", "7", TRIED, [], host({ mainFlows: [W("nightly", "queued")], draftFlows: [{ name: "nightly", status: "completed", conclusion: "skipped" }] }));
ok(heldJob.answer && pushOnly.answer && mainOnly.answer && heldBeside[0].skippedAfter.join() === "lint" && heldBeside[0].answer.draftSkippedAfter === 1 && heldBeside[1].answer?.draftFailedAfter === 1 && heldBeside[1].failed.includes("lint") && heldBeside[2].answer?.draftFailedBoth === 1 && heldBeside[2].answer.draftFailedAlone === 1 && heldBeside[2].failed.join() === "dependency review" && !lateSkip.answer && !twoJobs.answer && !flowSkipped.answer && twoRuns.every(r => /1 on main's newest commit have not finished/.test(r.why ?? "")),
  "  on main, a job held for a person, a workflow the draft did not run and a check it does not hold give an answer, a run held for a person beside a finished one of its name read as that one, in the counts and the failures named, while a check the draft skipped still running there, beside a run of its name held for a person or not, a workflow it skipped whole queued there, and a workflow it ran queued beside one held for a person in either order, give none", JSON.stringify([heldJob, pushOnly, mainOnly, heldBeside, lateSkip, twoJobs, flowSkipped, twoRuns]));
ok(gate.answer?.draftGated === 1 && gate.gated.join() === "dependency review" && gate.failed.length === 0, "  a check the builder named as failing for being a draft is counted apart and named apart", JSON.stringify(gate));
const gatedSkip = readDraft("o/p", "7", TRIED, ["dependency review"], host({ skipReview: "after" }));
ok(gatedSkip.answer?.draftGated === 1 && gatedSkip.answer.draftSkippedAfter === 0 && gatedSkip.gated.join() === "dependency review" && gatedSkip.skippedAfter.length === 0,
  "  so is one it named as skipping after passing on main", JSON.stringify(gatedSkip));
ok(many.answer?.draftPassedAlone === 150 && unstarted.answer?.draftFailedAlone === 2 && unstarted.failed.includes("audit (could not start)") && unstartedBoth.answer?.draftFailedBoth === 1 && !unstartedBoth.failed.includes("audit (could not start)"),
  "  every page of the checks is read, and a workflow that could not start counts as failed: on the draft alone the release's, on main too standing before", JSON.stringify([many.answer, unstarted.failed, unstartedBoth.answer]));

// (why no draft was opened, read: another owner's, a stop switch that stands, and none for one of the owner's own)
const [other, stop, own, unread, noCore] = [readNone("o/p", TRIED, host({ owner: "someone-else" })), readNone("o/p", TRIED, host({ stop: true })), readNone("o/p", TRIED, host()), readNone("o/p", TRIED, host({ stop: "unread" })), readNone("o/p", TRIED, host({ stop: true, noCore: true }))];
ok(other.answer?.none === "another-owner" && other.answer.repo === repoHash(41) && stop.answer?.none === "stop-switch" && !own.answer && /opens a draft there/.test(own.why) && !unread.answer && /pins no copy of this core/.test(noCore.why ?? "") && [own, noCore].every(r => mended(`FAIL no answer for the project: ${r.why}.`)),
  "`none` reads another owner's repository and a stop switch that stands, and gives no answer for the owner's own project whose stop switch does not stand or cannot be read, nor for a repository that takes no copy of this core", JSON.stringify([other, stop, own, unread]));

// (a project under the owner's account is the owner's own only where it is no fork, or a fork of the account's own: the
// pull request's answer names no parent, so the repository's own is read, and where it cannot be, nothing is answered)
const [theirFork, ownFork, forkUnread] = ["theirs", "own", "unread"].map(fork => readDraft("o/p", "7", TRIED, [], host({ fork })));
const [noneTheirs, noneOwn] = ["theirs", "own"].map(fork => readNone("o/p", TRIED, host({ fork })));
ok(!theirFork.answer && /not owned by the core's owner's account[\s\S]*fork of a repository another account owns[\s\S]*tell the owner at once/.test(theirFork.why ?? "") && ownFork.answer?.commit === TRIED
  && !forkUnread.answer && /could not be read to say whose it is/.test(forkUnread.why ?? "") && [theirFork, forkUnread].every(r => mended(`FAIL no answer for the draft: ${r.why}.`))
  && noneTheirs.answer?.none === "another-owner" && !noneOwn.answer && /opens a draft there/.test(noneOwn.why ?? ""),
  "a draft in a fork of another account's repository under the owner's account is refused, and `none` reads it as another owner's, while a fork of the account's own is read as its own; a fork whose own answer cannot be read gives no answer", JSON.stringify([theirFork, ownFork.answer, forkUnread, noneTheirs, noneOwn]));

// (each answer, printed as the command prints it, read back by the reader release.mjs --trial runs on it: #1108)
const back = [read, skippedAfter, other, stop].map(r => draftAnswerOf(`${LINE}${JSON.stringify(r.answer)}\n`, TRIED));
ok(JSON.stringify(back[0]) === JSON.stringify({ answer: Object.fromEntries(DRAFT_COUNTS.map(k => [k, read.answer[k]])), repo: read.answer.repo }) && back[1].answer?.draftSkippedAfter === 1
  && back[2].none === "another-owner" && back[3].none === "stop-switch" && back.every(b => b.repo === repoHash(41)),
  "each answer, a draft's or a `none`, printed as the command prints it, is read back to the same counts and reason", JSON.stringify(back));

done("the draft in a release's trial");
