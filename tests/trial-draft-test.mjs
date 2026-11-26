// Tests of the draft in a release's trial (#1334; AGENTS.md, "A release's trial opens its update as a draft in the
// owner's own projects"): the draft's checks read beside main's on a stand-in for the host, each in its class; no answer
// for a draft of another owner's, behind a stop switch, no draft, pinned elsewhere or with a check not finished; what
// release.mjs --trial takes after each pair; and the record, which holds the cut where a check failed on the draft that
// passed on main or ran on the draft alone, or where one of the owner's own projects found had no draft. No call reaches
// the network, and no process is started. Node's own modules.
//
//   node tests/trial-draft-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { trial, trialAt, trialRecord } from "../scripts/release-trial.mjs";
import { DRAFT_COUNTS, draftAnswerOf, draftCounts, draftsIn, readDraft, saidOf } from "../scripts/trial-draft.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("trial-draft-test-");
const SHA = n => String(n).repeat(40);
const TRIED = SHA("a"), MAIN = SHA("b"), HEAD = SHA("c");

// (each check run and status in its verdict: a job skipped, as on a draft, did not run; one not finished waits)
const said = saidOf([{ name: "lint", status: "completed", conclusion: "success" }, { name: "skip", status: "completed", conclusion: "skipped" }, { name: "late", status: "in_progress", conclusion: null },
  { name: "both", status: "completed", conclusion: "success" }, { name: "both", status: "completed", conclusion: "failure" }, { name: "odd", status: "completed", conclusion: "something new" }], [{ context: "ext", state: "error" }, { context: "wait", state: "pending" }]);
ok(JSON.stringify(said) === JSON.stringify({ lint: "passed", late: "waiting", both: "failed", odd: "failed", ext: "failed", wait: "waiting" }),
  "a check run or status is passed, failed or waiting, a skipped job not run, a name twice its worse, and a conclusion of no known form failed", JSON.stringify(said));

// (each class: a check run on main alone, a push's job, measures nothing of the draft)
const counts = draftCounts({ pp: "passed", fp: "failed", pf: "passed", ff: "failed", push: "passed", gate: "passed" }, { pp: "passed", fp: "passed", pf: "failed", ff: "failed", review: "failed", new: "passed", gate: "failed" }, ["gate"]);
ok(Object.keys(counts).join() === DRAFT_COUNTS.join() && Object.values(counts).join() === "1,1,1,1,1,1,1",
  "passed on both, fixed on the draft, failed on both, failed on the draft where it passed on main, failed and passed on the draft alone, and a gate the builder named are each counted, and a job of main's alone is not", JSON.stringify(counts));

// (the draft read on a stand-in for the host)
const host = (over = {}) => route => {
  const pulls = { state: "open", draft: true, head: { sha: HEAD }, base: { ref: "main", repo: { owner: { login: OWNER }, default_branch: "main" } }, ...over.pull };
  if (route === "repos/o/p/pulls/7") return { body: pulls };
  if (route === "repos/o/p/branches/agents-stop") return over.stop ? { body: { name: "agents-stop" } } : { why: "GitHub answered 404" };
  if (route === `repos/o/p/contents/core-manifest.md?ref=${HEAD}`) return { body: { content: Buffer.from(`Core: ${CORE} at ${over.pin ?? TRIED}, copied whole under core/\n`).toString("base64") } };
  if (route === "repos/o/p/commits/main") return { body: { sha: MAIN } };
  if (route.startsWith(`repos/o/p/commits/${MAIN}/check-runs`)) return { body: { check_runs: [{ name: "tests", status: "completed", conclusion: "success" }] } };
  if (route.startsWith(`repos/o/p/commits/${HEAD}/check-runs`)) return { body: { check_runs: [{ name: "tests", status: "completed", conclusion: "success" }, { name: "dependency review", status: over.late ? "queued" : "completed", conclusion: over.late ? null : "failure" }] } };
  if (route.endsWith("/status")) return { body: { statuses: [] } };
  return { why: "no such route in the stand-in" };
};
const read = readDraft("o/p", "7", TRIED, [], host());
ok(read.answer?.commit === TRIED && read.answer.draftPassedBoth === 1 && read.answer.draftFailedAlone === 1 && read.failed.join() === "dependency review",
  "a draft pinned to the commit tried is read beside main's newest commit: the dependency review, on the draft alone, failed", JSON.stringify(read));
const refused = [readDraft("o/p", "7", TRIED, [], host({ pull: { base: { ref: "main", repo: { owner: { login: "someone-else" }, default_branch: "main" } } } })), readDraft("o/p", "7", TRIED, [], host({ stop: true })),
  readDraft("o/p", "7", TRIED, [], host({ pull: { draft: false } })), readDraft("o/p", "7", TRIED, [], host({ pull: { base: { ref: "crafted", repo: { owner: { login: OWNER }, default_branch: "main" } } } })), readDraft("o/p", "7", TRIED, [], host({ pin: SHA("d") })), readDraft("o/p", "7", TRIED, [], host({ late: true }))];
ok(refused.every(r => !r.answer && mended(`FAIL no answer for the draft: ${r.why}.`)) && /not owned by the core's owner's account[\s\S]*--no-draft another-owner/.test(refused[0].why) && /stop switch stands[\s\S]*--no-draft stop-switch/.test(refused[1].why)
  && /no draft/.test(refused[2].why) && /against crafted, not the project's default branch, main/.test(refused[3].why) && /pins ddddddd, not the commit tried, aaaaaaa[\s\S]*sync\.mjs a{40}/.test(refused[4].why) && /1 checks on the draft and 0 on main's newest commit have not finished/.test(refused[5].why),
  "no answer, each saying its mend, for a repository the core's owner does not own, a stop switch that stands, a pull request that is no draft, one against a branch that is not the default, one pinned elsewhere, and a check not finished", refused.map(r => r.why).join("\n"));
ok(readDraft("o/p", "7", TRIED, ["dependency review"], host()).answer?.draftGated === 1, "  a check the builder named as failing for being a draft is counted apart");

// (what trial-draft.mjs printed, read for the commit tried, and what release.mjs --trial takes after each pair)
const printed = `  failed on the draft: x\ndraft answer: ${JSON.stringify(read.answer)}\n`;
ok(draftAnswerOf(printed, TRIED).answer?.draftFailedAlone === 1 && !("commit" in draftAnswerOf(printed, TRIED).answer) && /not the commit tried/.test(draftAnswerOf(printed, SHA("e")).why) && /holds no line/.test(draftAnswerOf("draft answer: {\"commit\":1}", TRIED).why),
  "the draft's reading is its last line's counts for the commit tried alone");
const parsed = draftsIn(["b1", "a1", "--sync", "s1", "--draft", "d1", "b2", "a2", "--no-draft", "stop-switch", "--sync", "s2"]);
ok(JSON.stringify(parsed) === JSON.stringify({ rest: ["b1", "a1", "--sync", "s1", "b2", "a2", "--sync", "s2"], drafts: [{ file: "d1" }, { none: "stop-switch" }] })
  && [["--draft", "d"], ["b", "--draft", "d"], ["b", "a", "--draft", "d", "--draft", "e"], ["b", "a", "--no-draft", "because"], ["b", "a", "--draft"]].every(a => draftsIn(a).why),
  "--trial takes one --draft or --no-draft after each whole pair, beside its --sync, and refuses one before a pair, two for a pair, a reason of no form or a file not named", JSON.stringify(parsed));

// (the record, and the cut it holds)
const one = [{ "a.yml/x": "passed" }, { "a.yml/x": "passed" }], SYNC = { pure: true, from: "release-7" };
const clean = Object.fromEntries(DRAFT_COUNTS.map(k => [k, 0]));
const at = r => trialAt(TRIED, args => (args[0] === "show" ? JSON.stringify(r) : ""));
const passed = trialRecord(TRIED, "2026-11-26", [one, one], [SYNC, SYNC], [{ answer: { ...clean, draftPassedBoth: 3, draftPassedAlone: 1 } }, { none: "another-owner" }], 1);
ok(passed.drafts === 1 && passed.draftsAnotherOwner === 1 && passed.ownProjects === 1 && at(passed).held === null && /1 read of 1 such projects found, 1 projects of another owner's with none[\s\S]*3 checks passed on main and the draft/.test(at(passed).said),
  "a draft read in the owner's own project and none in another owner's: the record counts them and holds nothing", at(passed).said);
const failed = trialRecord(TRIED, "2026-11-26", [one], [SYNC], [{ answer: { ...clean, draftFailedAlone: 1 } }], 1);
ok(/1 check failed on the draft of the sync in the owner's own projects, 0 of them passing on main and 1 run on the draft alone\. Mend: find the release's fault/.test(at(failed).held ?? ""), "a check failed on the draft alone holds the cut, saying its mend", at(failed).held);
const after = trialRecord(TRIED, "2026-11-26", [one], [SYNC], [{ answer: { ...clean, draftFailedAfter: 1 } }], 1), gated = trialRecord(TRIED, "2026-11-26", [one], [SYNC], [{ answer: { ...clean, draftGated: 1, draftFailedBoth: 1 } }], 1);
ok(at(after).held !== null && at(gated).held === null, "  as one that passed on main does, while one failed on both or named as a draft's gate holds nothing");
const missing = trialRecord(TRIED, "2026-11-26", [one], [SYNC], [{ none: "another-owner" }], 2), stopped = trialRecord(TRIED, "2026-11-26", [one], [SYNC], [{ none: "stop-switch" }], 1);
ok(/2 of the owner's own projects that take the core were tried with no draft of the sync read/.test(at(missing).held ?? "") && at(stopped).held === null, "a record with fewer drafts than the owner's own projects found holds the cut; a stop switch that stood counts as none to open", at(missing).held);
ok([{ ...passed, drafts: 2 }, { ...passed, draftsAnotherOwner: 0 }, { ...passed, ownProjects: -1 }, { ...trialRecord(TRIED, "2026-11-26", [one], [SYNC], [{ none: "another-owner" }], 0), draftPassedBoth: 1 }, (({ drafts, ...rest }) => rest)(passed)].every(r => /no form/.test(at(r).said) && at(r).held !== null),
  "a record whose drafts and their lack are not one for each project, a count of no form, counts of checks with no draft read, or no drafts' counts at all, is in no form");

// (the command: a draft's reading kept in the core's own repository is refused, as a pair with none or two)
const runs = path.join(tmp, "runs.json"), sync = path.join(tmp, "sync.txt");
fs.writeFileSync(runs, JSON.stringify(one[0])); fs.writeFileSync(sync, `trial answer: ${JSON.stringify({ commit: TRIED, pure: true, from: "release-7" })}\n`);
const cli = (...args) => trial([TRIED, ...args], why => ({ why })) ?? {};
const [inCore, none, twice] = [cli(runs, runs, "--sync", sync, "--draft", path.join(path.dirname(fileURLToPath(import.meta.url)), "draft.txt")), cli(runs, runs, "--sync", sync), cli(runs, runs, "--no-draft", "stop-switch", "--no-draft", "stop-switch")];
ok(/lies in the core's own repository/.test(inCore.why) && /neither --draft nor --no-draft/.test(none.why) && /one `--draft/.test(twice.why),
  "--trial refuses a draft's reading kept in the core's own repository, a pair with no draft's reading or reason, and two for one pair, writing nothing", [inCore, none, twice].map(c => c.why).join("\n"));
done("the draft in a release's trial");
