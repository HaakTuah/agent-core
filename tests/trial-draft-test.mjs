// Tests of the draft in a release's trial (#1334; AGENTS.md, "A release's trial opens its update as a draft in the
// owner's own projects"): the draft's checks read beside main's on a stand-in for the host, each in its class; no answer
// for a draft of another owner's, behind a stop switch or one not read, no draft, pinned elsewhere, with no check or one
// not finished, or a list not read whole; why none was opened, read; what release.mjs --trial takes after each pair; and the record, which holds the cut where a check failed on the draft that
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
import { draftCounts, readDraft, readNone, repoHash, saidOf } from "../scripts/trial-draft.mjs";
import { DRAFT_COUNTS, draftAnswerOf, draftReadingsOf, draftsIn, draftsShort } from "../scripts/trial-draft-record.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("trial-draft-test-");
const SHA = n => String(n).repeat(40);
const TRIED = SHA("a"), MAIN = SHA("b"), HEAD = SHA("c");

// (each check run and status in its verdict: a job skipped, as on a draft, did not run; one not finished waits)
const said = saidOf([{ name: "lint", status: "completed", conclusion: "success" }, { name: "skip", status: "completed", conclusion: "skipped" }, { name: "late", status: "in_progress", conclusion: null },
  { name: "both", status: "completed", conclusion: "success" }, { name: "both", status: "completed", conclusion: "failure" }, { name: "odd", status: "completed", conclusion: "something new" }], [{ context: "ext", state: "error" }, { context: "wait", state: "pending" }]);
ok(JSON.stringify(said) === JSON.stringify({ lint: "passed", skip: "skipped", late: "waiting", both: "failed", odd: "failed", ext: "failed", wait: "waiting" }),
  "a check run or status is skipped, passed, failed or waiting, a name twice its worse, and a conclusion of no known form failed", JSON.stringify(said));

// (each class: a check run on main alone, a push's job, measures nothing of the draft)
const counts = draftCounts({ pp: "passed", fp: "failed", pf: "passed", ff: "failed", push: "passed", gate: "passed" }, { pp: "passed", fp: "passed", pf: "failed", ff: "failed", review: "failed", new: "passed", gate: "failed", skip: "skipped" }, ["gate"]);
ok(Object.keys(counts).join() === DRAFT_COUNTS.join() && Object.values(counts).join() === "1,1,1,1,1,1,1,1",
  "passed on both, fixed on the draft, failed on both, failed on the draft where it passed on main, failed and passed on the draft alone, a gate the builder named and a check skipped on the draft are each counted, and a job of main's alone is not", JSON.stringify(counts));

// (the draft read on a stand-in for the host, each list given page by page)
const page = (route, key, all) => {
  const n = Number(/[?&]page=(\d+)/.exec(route)?.[1] ?? 0);
  return n ? { body: { [key]: all.slice((n - 1) * 100, n * 100), total_count: all.length } } : { why: "no page asked" };
};
const host = (over = {}) => route => {
  const pulls = { state: "open", draft: true, user: { login: OWNER }, head: { sha: HEAD, repo: { id: 41 } }, base: { ref: "main", repo: { id: 41, owner: { login: OWNER }, default_branch: "main" } }, ...over.pull };
  const draftRuns = over.empty ? (over.empty === "skipped" ? [{ name: "tests", status: "completed", conclusion: "skipped" }] : []) : [{ name: "tests", status: "completed", conclusion: "success" }, ...(over.deployRun ? [{ name: "deploy", status: "completed", conclusion: "skipped" }] : []), { name: "dependency review", status: over.late ? "queued" : "completed", conclusion: over.late ? null : over.skipReview ? "skipped" : "failure" }, ...(over.many ? Array.from({ length: 150 }, (_, i) => ({ name: `job ${i}`, status: "completed", conclusion: "success" })) : [])];
  if (route === "repos/o/p/pulls/7") return { body: pulls };
  if (route === "repos/o/p") return { body: { id: 41, owner: { login: over.owner ?? OWNER } } };
  if (route === "repos/o/p/contents/core-manifest.md") return over.manifest === "unread" ? { why: "GitHub answered 502 (Bad Gateway)" } : over.noCore ? { why: "GitHub answered 404 (Not Found)" } : { body: { content: Buffer.from(over.carried ? `Core: ${CORE}, carried by lib/ under lib/core/\n` : `Core: ${CORE} at ${MAIN}, copied whole under core/\n`).toString("base64") } };
  if (route === "repos/o/p/branches/agents-stop") return over.stop === "unread" ? { why: "GitHub answered 403 (forbidden)" } : over.stop ? { body: { name: "agents-stop" } } : { why: "GitHub answered 404 (Not Found)" };
  if (route === `repos/o/p/contents/core-manifest.md?ref=${HEAD}`) return { body: { content: Buffer.from(`Core: ${CORE} at ${over.pin ?? TRIED}, copied whole under core/\n`).toString("base64") } };
  if (route === "repos/o/p/commits/main") return { body: { sha: MAIN } };
  if (route.startsWith(`repos/o/p/commits/${MAIN}/check-runs`)) return page(route, "check_runs", [{ name: "tests", status: over.mainLate ? "in_progress" : "completed", conclusion: over.mainLate ? null : "success" }, ...(over.deployRun ? [{ name: "deploy", status: "waiting", conclusion: null }] : []), ...(over.skipReview === "after" ? [{ name: "dependency review", status: "completed", conclusion: "success" }] : [])]);
  if (route.startsWith(`repos/o/p/commits/${HEAD}/check-runs`)) return over.short ? { body: { check_runs: draftRuns, total_count: draftRuns.length + 1 } } : page(route, "check_runs", draftRuns);
  if (route.startsWith(`repos/o/p/actions/runs?head_sha=${HEAD}`)) return page(route, "workflow_runs", [...(over.unstarted ? [{ name: "audit", status: "completed", conclusion: "startup_failure" }] : []), ...(over.queued ? [{ name: "review", status: "queued", conclusion: null }] : []), { name: "tests", status: "completed", conclusion: "success" }]);
  if (route.startsWith(`repos/o/p/actions/runs?head_sha=${MAIN}`)) return page(route, "workflow_runs", [...(over.unstarted === "both" ? [{ name: "audit", status: "completed", conclusion: "startup_failure" }] : []), ...(over.mainWaits ? [{ name: over.mainWaits, status: "waiting", conclusion: null }] : []), ...(over.mainQueued ? [{ name: "tests", status: "queued", conclusion: null }] : [])]);
  if (/\/status\?/.test(route)) return page(route, "statuses", []);
  return { why: "no such route in the stand-in" };
};
const read = readDraft("o/p", "7", TRIED, [], host());
ok(read.answer?.commit === TRIED && read.answer.repo === repoHash(41) && read.answer.draftPassedBoth === 1 && read.answer.draftFailedAlone === 1 && read.failed.join() === "dependency review",
  "a draft pinned to the commit tried is read beside main's newest commit, with its repository's id hashed: the dependency review, on the draft alone, failed", JSON.stringify(read));
const refused = [readDraft("o/p", "7", TRIED, [], host({ pull: { base: { ref: "main", repo: { owner: { login: "someone-else" }, default_branch: "main" } } } })), readDraft("o/p", "7", TRIED, [], host({ stop: true })),
  readDraft("o/p", "7", TRIED, [], host({ pull: { draft: false } })), readDraft("o/p", "7", TRIED, [], host({ pull: { base: { ref: "crafted", repo: { owner: { login: OWNER }, default_branch: "main" } } } })), readDraft("o/p", "7", TRIED, [], host({ pin: SHA("d") })), readDraft("o/p", "7", TRIED, [], host({ late: true })),
  readDraft("o/p", "7", TRIED, [], host({ stop: "unread" })), readDraft("o/p", "7", TRIED, [], host({ empty: true })), readDraft("o/p", "7", TRIED, [], host({ short: true })),
  readDraft("o/p", "7", TRIED, [], host({ empty: "skipped" })), readDraft("o/p", "7", TRIED, [], host({ queued: true })), readDraft("o/p", "7", TRIED, [], host({ pull: { head: { sha: HEAD, repo: { id: 99 } } } })), readDraft("o/p", "7", TRIED, [], host({ pull: { user: { login: "someone-else" } } })),
  readDraft("o/p", "7", TRIED, [], host({ noCore: true })), readDraft("o/p", "7", TRIED, [], host({ manifest: "unread" })), readDraft("o/p", "7", TRIED, [], host({ pull: { head: { sha: HEAD, repo: {} }, base: { ref: "main", repo: { owner: { login: OWNER }, default_branch: "main" } } } })), readDraft("o/p", "7", TRIED, [], host({ mainLate: true })),
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
ok(deploy.answer?.draftPassedBoth === 1 && deployRun.answer?.draftSkipped === 1 && sameFlow.answer?.draftPassedBoth === 1 && skippedReview.answer?.draftSkipped === 1 && skippedReview.answer.draftFailedAlone === 0 && skippedReview.skipped.join() === "dependency review" && skippedReview.skippedAfter.length === 0 && skippedAfter.skippedAfter.join() === "dependency review",
  "  a run on main waiting on a person (a deploy waiting for its reviewer, in a workflow of its own or the draft's, or a job the draft skipped) holds no reading, and a check skipped on the draft is counted and named apart, saying where it passed on main", JSON.stringify([deploy, deployRun, sameFlow, skippedReview, skippedAfter]));
ok(gate.answer?.draftGated === 1 && gate.gated.join() === "dependency review" && gate.failed.length === 0, "  a check the builder named as failing for being a draft is counted apart and named apart", JSON.stringify(gate));
ok(many.answer?.draftPassedAlone === 150 && unstarted.answer?.draftFailedAlone === 2 && unstarted.failed.includes("audit (could not start)") && unstartedBoth.answer?.draftFailedBoth === 1 && !unstartedBoth.failed.includes("audit (could not start)"),
  "  every page of the checks is read, and a workflow that could not start counts as failed: on the draft alone the release's, on main too standing before", JSON.stringify([many.answer, unstarted.failed, unstartedBoth.answer]));

// (why no draft was opened, read: another owner's, a stop switch that stands, and none for one of the owner's own)
const [other, stop, own, unread, noCore] = [readNone("o/p", TRIED, host({ owner: "someone-else" })), readNone("o/p", TRIED, host({ stop: true })), readNone("o/p", TRIED, host()), readNone("o/p", TRIED, host({ stop: "unread" })), readNone("o/p", TRIED, host({ stop: true, noCore: true }))];
ok(other.answer?.none === "another-owner" && other.answer.repo === repoHash(41) && stop.answer?.none === "stop-switch" && !own.answer && /opens a draft there/.test(own.why) && !unread.answer && /pins no copy of this core/.test(noCore.why ?? "") && [own, noCore].every(r => mended(`FAIL no answer for the project: ${r.why}.`)),
  "`none` reads another owner's repository and a stop switch that stands, and gives no answer for the owner's own project whose stop switch does not stand or cannot be read, nor for a repository that takes no copy of this core", JSON.stringify([other, stop, own, unread]));

// (what trial-draft.mjs printed, read for the commit tried, and what release.mjs --trial takes after each pair)
const printed = `  failed on the draft: x\ndraft answer: ${JSON.stringify(read.answer)}\n`;
ok(draftAnswerOf(`draft answer: ${JSON.stringify({ ...read.answer, repo: [read.answer.repo] })}`, TRIED).why && draftAnswerOf(`draft answer: ${JSON.stringify({ commit: TRIED, repo: read.answer.repo, none: ["stop-switch"] })}`, TRIED).why && draftAnswerOf(printed, TRIED).answer?.draftFailedAlone === 1 && !("commit" in draftAnswerOf(printed, TRIED).answer) && /not the commit tried/.test(draftAnswerOf(printed, SHA("e")).why) && /holds no line/.test(draftAnswerOf("draft answer: {\"commit\":1}", TRIED).why),
  "the draft's reading is its last line's counts for the commit tried alone, each value of its own type");
const parsed = draftsIn(["b1", "a1", "--sync", "s1", "--draft", "d1", "b2", "a2", "--draft", "d2", "--sync", "s2"]);
ok(JSON.stringify(parsed) === JSON.stringify({ rest: ["b1", "a1", "--sync", "s1", "b2", "a2", "--sync", "s2"], drafts: [{ file: "d1" }, { file: "d2" }] })
  && [["--draft", "d"], ["b", "--draft", "d"], ["b", "a", "--draft", "d", "--draft", "e"], ["b", "a", "--draft"]].every(a => draftsIn(a).why) && /takes no --no-draft/.test(draftsIn(["b", "a", "--no-draft", "x"]).why ?? ""),
  "--trial takes one --draft after each whole pair, beside its --sync, and refuses one before a pair, two for a pair, a file not named and a reason declared in its place", JSON.stringify(parsed));
const file = (name, text) => { const f = path.join(tmp, name); fs.writeFileSync(f, text); return f; };
const [d1, d2, dn] = [file("d1.txt", printed), file("d2.txt", printed), file("dn.txt", `draft answer: ${JSON.stringify({ ...other.answer, repo: repoHash(42) })}\n`)];
const readings = draftReadingsOf([{ file: d1 }, { file: dn }], TRIED, 2);
ok(readings.readings?.length === 2 && readings.readings[1].none === "another-owner" && /reads a project already given a reading/.test(draftReadingsOf([{ file: d1 }, { file: d2 }], TRIED, 2).why ?? "")
  && /cannot be read/.test(draftReadingsOf([{ file: path.join(tmp, "gone.txt") }], TRIED, 1).why ?? "") && /not the commit tried/.test(draftReadingsOf([{ file: d1 }], SHA("e"), 1).why ?? "") && /with no --draft after them/.test(draftReadingsOf([], TRIED, 1).why ?? ""),
  "each pair's reading is read from its file: one project's reading given twice, a file not read, one for another commit and a pair with none are refused", JSON.stringify(readings));
ok(draftsShort(2, [{ answer: {} }, { none: "stop-switch" }]) === null && /2 of the owner's projects take the core[\s\S]*1 was given/.test(draftsShort(2, [{ answer: {} }, { none: "another-owner" }]) ?? "") && /could not be read/.test(draftsShort(null, []) ?? ""),
  "the readings fall short where fewer of the owner's own projects had a draft or a stop switch than were found, or where none could be found");

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
const [inCore, none, twice, gone] = [cli(runs, runs, "--sync", sync, "--draft", path.join(path.dirname(fileURLToPath(import.meta.url)), "draft.txt")), cli(runs, runs, "--sync", sync), cli(runs, runs, "--draft", d1, "--draft", d1), cli(runs, runs, "--sync", sync, "--draft", path.join(tmp, "gone.txt"))];
ok(/lies in the core's own repository/.test(inCore.why) && /with no --draft after them/.test(none.why) && /one `--draft/.test(twice.why) && /cannot be read/.test(gone.why),
  "--trial refuses a draft's reading kept in the core's own repository, a pair with no draft's reading, two for one pair and a file not read, writing nothing", [inCore, none, twice, gone].map(c => c.why).join("\n"));
done("the draft in a release's trial");
