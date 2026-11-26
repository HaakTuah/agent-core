// Tests of the record of the drafts in a release's trial (#1334; AGENTS.md, "A release's trial opens its update as a
// draft in the owner's own projects"): what trial-draft.mjs printed, read for the commit tried; what release.mjs --trial
// takes after each pair; and the record, which holds the cut where a check failed on the draft that passed on main or
// ran on the draft alone, or where one of the owner's own projects found had no draft. The readings themselves:
// tests/trial-draft-test.mjs. No call reaches the network, and no process is started. Node's own modules.
//
//   node tests/trial-draft-record-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trial, trialAt, trialRecord } from "../scripts/release-trial.mjs";
import { repoHash } from "../scripts/trial-draft.mjs";
import { DRAFT_COUNTS, draftAnswerOf, draftReadingsOf, draftsIn, draftsShort } from "../scripts/trial-draft-record.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("trial-draft-record-test-");
const SHA = n => String(n).repeat(40);
const TRIED = SHA("a");
// (a draft's reading and a `none` one, as trial-draft.mjs gives them; tests/trial-draft-test.mjs reads them from a host)
const read = { answer: { commit: TRIED, repo: repoHash(41), ...Object.fromEntries(DRAFT_COUNTS.map(k => [k, 0])), draftPassedBoth: 1, draftFailedAlone: 1 } };
const other = { answer: { commit: TRIED, repo: repoHash(41), none: "another-owner" } };

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
const skips = trialRecord(TRIED, "2026-11-26", [one], [SYNC], [{ answer: { ...clean, draftPassedBoth: 1, draftSkipped: 2 } }], 1), skipsAfter = trialRecord(TRIED, "2026-11-26", [one], [SYNC], [{ answer: { ...clean, draftPassedBoth: 1, draftSkipped: 2, draftSkippedAfter: 1 } }], 1);
ok(at(after).held !== null && at(gated).held === null && at(skips).held === null && /2 more were skipped on the draft, measuring nothing there, 0 of them passing on main/.test(at(skips).said) && /1 check passed on main and was skipped on the draft of the sync in the owner's own projects, not run after\. Mend: find why each skips[\s\S]*--gate <its name>/.test(at(skipsAfter).held ?? "") && /3 more were skipped on the draft, measuring nothing there, 1 of them passing on main and so not run after/.test(at(skipsAfter).said),
  "  as one that passed on main does, and so does one that passed on main and was skipped on the draft, not run after, saying its mend, while one failed on both, named as a draft's gate or skipped on the draft where it did not pass on main, holds nothing", [at(skips).said, at(skipsAfter).held]);
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
done("the record of the drafts in a release's trial");
