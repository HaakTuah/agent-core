// Tests of the trial of a release on a real project (release-trial.mjs, and release.mjs --trial): a run before the update beside
// one after it, and its record, which holds the cut where it does not stand for the commit, or where a check passed before and
// failed after. Cutting a release itself: release-test.mjs (#958). In a scratch repository; on Linux and on Windows. Git and
// Node's own modules only.
//
//   node tests/release-trial-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTS, TRIAL, compared, ownCount, trialAt, trialRecord } from "../scripts/release-trial.mjs";
import { DRAFT_COUNTS } from "../scripts/trial-draft-record.mjs";
import { answerOf, answersOf } from "../scripts/trial-sync.mjs";
import { scratchCore } from "../scripts/releases-scratch.mjs";
import { shownAs } from "../scripts/state-report.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

const { tmp, git } = scratchCore("release-trial-test-");

// the trial on a real project (#1084): a run before the update beside one after it, and its record, which holds the cut
// where it does not stand for the commit, or where a check passed before and failed after
{
  const c = compared({ "a.yml/x": "passed", "a.yml/y": "failed", "a.yml/z": "passed", "a.yml/gone": "failed" }, { "a.yml/x": "passed", "a.yml/y": "failed", "a.yml/z": "failed", "b.yml/new": "failed", "b.yml/more": "passed" });
  ok(Object.values(c).join(";") === "a.yml/x;;a.yml/y;a.yml/z;b.yml/new;;;b.yml/more;;a.yml/gone;;;;;", "each job is in its class of COUNTS: passed both, failed both (standing before), failed after where it passed before or did not run (the update's), ran after alone, and failed before alone", JSON.stringify(c));
  const t = path.join(tmp, "trial");
  git(tmp, "init", "-q", "-b", "main", t);
  const commit = (files, msg) => { for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(t, f)), { recursive: true }); fs.writeFileSync(path.join(t, f), text); } git(t, "add", "-A"); git(t, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", msg); return git(t, "rev-parse", "HEAD"); };
  const read = args => git(t, ...args);
  const tried = commit({ "a.txt": "1\n" }, "the commit tried");
  const none = trialAt(tried, read);
  ok(/has not run for/.test(none.said) && /Mend: try the release on a copy of a project/.test(none.held ?? ""), "with no record, the release says the trial has not run, and the cut is held, saying its mend");
  const SYNC = [{ pure: true, from: "release-1" }], OTHER = [{ none: "another-owner" }];
  const record = r => commit({ [TRIAL]: `${JSON.stringify(r)}\n` }, "the trial's record");
  const passed = trialRecord(tried, "2026-11-22", [[{ "a.yml/x": "passed", "a.yml/y": "failed" }, { "a.yml/x": "passed", "a.yml/y": "failed" }]], SYNC, OTHER);
  ok(passed.projects === 1 && passed.passedBoth === 1 && passed.failedBoth === 1 && Object.keys(passed).join() === `commit,day,projects,${COUNTS},baselineFromClone,syncPure,syncNotPure,syncUnproved,copiesFrom,mainsRead,ownProjects,drafts,draftsAnotherOwner,draftsStopped,${DRAFT_COUNTS}`, "the record holds the commit, the day and counts alone, nothing of the project");
  let at = record(passed);
  let r = trialAt(at, read);
  ok(r.held === null && /in 1 project: 1 check passed before and after the update, 0 failed before and passed after, 1 failed before and after \(standing before the release\), 0 passed before and failed after/.test(r.said), "a record of the commit before, which the release changes by the record alone, stands, and one failing both does not hold the cut", r.said);
  at = commit({ "a.txt": "2\n" }, "more since");
  r = trialAt(at, read);
  ok(/changes more than the record since \(a\.txt\)/.test(r.held ?? ""), "a commit that changes more than the record since the commit tried holds the cut", r.held);
  // (#1413, point 3: the cut on the commit tried, the record read from main's newest commit, where it merged with others)
  const merged = commit({ "b.txt": "1\n" }, "merged meanwhile");
  ok(trialAt(tried, read, merged).held === null && /has not run for/.test(trialAt(tried, read).held ?? "") && /changes more than the record since/.test(trialAt(merged, read).held ?? ""), "the commit tried, the record read from a later commit of main with other changes merged between, stands; read on the commit tried itself, which holds no record, or cut on the later commit, it holds the cut");
  const later = commit({ "a.txt": "3\n" }, "tried again");
  at = record(trialRecord(later, "2026-11-23", [[{ "a.yml/x": "passed" }, { "a.yml/x": "failed" }]], SYNC, OTHER));
  r = trialAt(at, read);
  ok(/1 check failed after the release in the trial on a real project, 1 of them passing before it[\s\S]*Mend: find the release's fault/.test(r.held ?? ""), "a check that passed before and failed after holds the cut, saying its mend", r.held);
  at = record(trialRecord(later, "2026-11-23", [[{ "a.yml/x": "passed", "a.yml/gate": "passed" }, { "a.yml/x": "passed", "a.yml/gate": "unread" }]], SYNC, OTHER));
  r = trialAt(at, read);
  ok(/1 check was not measured in the trial on a real project, 1 of them run before and not read after the update[\s\S]*Mend: teach the core's workflow runner/.test(r.held ?? "") && !/failed after the release/.test(r.held ?? ""), "a check that ran before and the trial's run after could not read holds the cut as not measured, saying its mend (#1257; #1263, point 2)", r.held);
  at = record(trialRecord(later, "2026-11-23", [[{ "a.yml": "failed" }, { "a.yml/x": "passed", "a.yml/gate": "unread" }]], SYNC, OTHER));
  r = trialAt(at, read);
  ok(r.held === null && /1 read in neither run \(not measured, holding nothing\)/.test(r.said), "one read in neither run, under a file an older check.mjs failed whole before, holds nothing and is no failure (#1257)", `${r.said}\n${r.held}`);
  at = record(trialRecord(later, "2026-11-23", []));
  r = trialAt(at, read);
  ok(r.held === null && /No project that takes the core allowed a trial/.test(r.said), "where no project allowed a trial, the release says so, and it is not held");
  // (the sync's reading against the commit tried, pure-sync.mjs --trial, and the copy each run before started from:
  // counted, and holding no cut, pure or not; #1261)
  const one = [{ "a.yml/x": "passed" }, { "a.yml/x": "passed" }];
  const readings = trialRecord(later, "2026-11-23", [one, one, one], [{ pure: true, from: "release-5", main: "origin" }, { pure: false, from: "release-5", main: "clone" }, { pure: true, from: "main", main: "origin" }], [...OTHER, ...OTHER, ...OTHER]);
  ok(readings.syncPure === 2 && readings.syncNotPure === 1 && JSON.stringify(readings.copiesFrom) === JSON.stringify({ "release-5": 2, main: 1 }) && JSON.stringify(readings.mainsRead) === JSON.stringify({ origin: 2, clone: 1 }), "the record counts the syncs pure and not against the commit tried, and the copies the runs before started from, by the core's release", JSON.stringify(readings));
  r = trialAt(record(readings), read);
  ok(r.held === null && /2 of the syncs pure, 1 not; the runs before the update started from the copies their main held, 2 from release-5, 1 from a commit of the core's main that is no release; the syncs read 2 against the project's main fetched from the clone's origin, 1 against a clone's own branch main, the clone having no origin\./.test(r.said), "  and says them, a sync not pure holding no cut: it is a reading", `${r.said}\n${r.held}`);
  const printed = `  NOT PURE something\nnot a pure sync against the commit tried, ${later}: a trial's reading\ntrial answer: ${JSON.stringify({ commit: later, pure: false, from: "main" })}\n`;
  ok(JSON.stringify(answerOf(printed, later)) === JSON.stringify({ answer: { pure: false, from: "main", main: "unknown" } })
    && JSON.stringify(answerOf(`trial answer: ${JSON.stringify({ commit: later, pure: true, from: "main", main: "clone" })}`, later)) === JSON.stringify({ answer: { pure: true, from: "main", main: "clone" } })
    && ["elsewhere", "unknown", 7, null].every(main => /holds no line/.test(answerOf(`trial answer: ${JSON.stringify({ commit: later, pure: true, from: "main", main })}`, later).why ?? "")) && /not the commit tried/.test(answerOf(printed, tried).why) && /holds no line/.test(answerOf("a pure sync: core a -> b\nmerge it with sha=x\n", later).why)
    && /holds no line/.test(answerOf(`trial answer: ${JSON.stringify({ commit: later, pure: "yes", from: "main" })}`, later).why) && /holds no line/.test(answerOf(`trial answer: ${JSON.stringify({ commit: later, pure: true, from: "my-project" })}`, later).why),
    "the sync's reading is read from what pure-sync.mjs --trial printed: its answer for the commit tried alone, never the proof's lines, a verdict of no form or a copy named otherwise than by the core");
  const noForm = [{ commit: later, projects: "one" }, { ...trialRecord(later, "2026-11-23", []), failedAfter: 2 }, { ...trialRecord(later, "2026-11-23", []), day: "<b>soon</b>" },
    { ...readings, syncPure: 3 }, { ...readings, syncPure: 1, copiesFrom: { "release-5": 1, main: 1 } }, { ...readings, copiesFrom: { "release-5": 1, main: 1 } }, { ...readings, copiesFrom: { "a project": 3 } }, { ...readings, copiesFrom: null }, (({ syncPure, syncNotPure, ...rest }) => rest)(readings),
    { ...readings, mainsRead: { origin: 1, clone: 1 } }, { ...readings, mainsRead: { origin: 2, "a project": 1 } }, { ...readings, mainsRead: null }, { ...readings, mainsRead: { origin: 3, clone: 0 } }]
    .map(bad => trialAt(record(bad), read));
  ok(noForm.every(n => /no form/.test(n.said) && n.held !== null), "a record in no form holds the cut: a count that is no count, one of no project that counts a check, a day of no form, syncs read more or fewer than its projects, copies that do not add up to them, one named otherwise than by the core, copies of no form, no syncs' counts at all, and mains read against that do not add up, are named otherwise, are of no form or count none (#1394)");
  const noCopies = trialAt(record((({ copiesFrom, mainsRead, ...rest }) => rest)(readings)), read), noMains = trialAt(record((({ mainsRead, ...rest }) => rest)(readings)), read);
  ok(!/no form/.test(noCopies.said) && /2 of the syncs pure, 1 not\./.test(noCopies.said), "a record without the copies, data it may leave out, is in its form and says the syncs alone (#1261's design check)", noCopies.said);
  ok(!/no form/.test(noMains.said) && /no release\./.test(noMains.said) && !/the syncs read/.test(noMains.said), "  and one written before the mains read against came, without them, is in its form and says the rest (#1394)", noMains.said);
  // (a later commit that takes out a file git would read as renamed into the record is still more than the record)
  commit({ "old.json": `${JSON.stringify({ a: 1, b: 2, c: 3, d: 4, e: 5 }, null, 2)}\n` }, "a file like the record");
  const like = git(t, "rev-parse", "HEAD");
  git(t, "rm", "-q", "old.json");
  at = record({ ...trialRecord(like, "2026-11-23", []) });
  ok(/changes more than the record since \(old\.json\)/.test(trialAt(at, read).held ?? ""), "a file taken out beside the record is no rename of it: the cut is held", trialAt(at, read).held);
  const cli = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "release.mjs"), "--trial", "abc"], { encoding: "utf8" });
  ok(cli.status === 1 && /--trial needs the full SHA/.test(cli.stderr), "--trial with no full SHA writes nothing and says what it needs", cli.stderr);
  const listed = ["**The projects that take the core** (read 2026-11-22)", `- ${shownAs("o/a", true, false)}: it has no state report yet.`, `- ${shownAs("o/b", true, true)}: from its report of 2026-10: 3.`, `- ${shownAs("x/c", false, false)}: it has no state report yet.`, "- (GitHub's code search gave no answer.)"].join("\n");
  ok(ownCount(listed) === 2 && ownCount("**The projects that take the core**\n- None found.") === 0, "the owner's projects are counted from what state-report.mjs --projects prints, in shownAs's words: its own public and private, never another owner's, a note or none found");
  const inCore = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "release.mjs"), "--trial", later, path.join(path.dirname(fileURLToPath(import.meta.url)), "before.json"), path.join(tmp, "after.json")], { encoding: "utf8" });
  ok(inCore.status === 1 && /lies in the core's own repository/.test(inCore.stderr), "--trial refuses a run's verdicts kept in the core's own repository, where a project's job names could be committed", inCore.stderr);
  const here = path.dirname(fileURLToPath(import.meta.url)), unsure = spawnSync(process.execPath, [path.join(here, "..", "scripts", "release.mjs"), "--trial", later, [here, "nothere", "..", "before.json"].join(path.sep), path.join(tmp, "after.json")], { encoding: "utf8" });
  ok(unsure.status === 1 && /or where a link on its way leads cannot be told/.test(unsure.stderr), "and one named by a `..` after a part of the core's repository that does not stand, where it leads cannot be told", unsure.stderr);
  const releaseMjs = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "release.mjs"), runs = path.join(tmp, "runs.json"), said = path.join(tmp, "said.txt");
  fs.writeFileSync(runs, JSON.stringify(one[0])); fs.writeFileSync(said, "a pure sync: core a -> b\nmerge it with sha=x\n");
  const cliRun = (...args) => spawnSync(process.execPath, [releaseMjs, "--trial", later, ...args], { encoding: "utf8" });
  const [syncFirst, syncTwice, syncInCore, syncNoAnswer, syncNone] = [cliRun("--sync", said, runs, runs), cliRun(runs, runs, "--sync", said, "--sync", said), cliRun(runs, runs, "--sync", path.join(path.dirname(fileURLToPath(import.meta.url)), "said.txt")), cliRun(runs, runs, "--sync", said), cliRun(runs, runs)];
  ok([syncFirst, syncTwice].every(c => c.status === 1 && /--trial needs the full SHA[^\n]*--sync/.test(c.stderr)) && syncInCore.status === 1 && /lies in the core's own repository/.test(syncInCore.stderr)
    && syncNoAnswer.status === 1 && !/given with --sync/.test(syncNoAnswer.stderr) && /project 1's runs are given with no --draft after them/.test(syncNoAnswer.stderr) && syncNone.status === 1 && /project 1's runs are given with no --sync after them: run `node <a clone/.test(syncNone.stderr),
    "--trial takes one --sync after each pair, never none, kept outside the core's own repository, and a file that holds no answer goes on to the next reading (a reading never asked is no reading)", [syncFirst, syncTwice, syncInCore, syncNoAnswer, syncNone].map(c => c.stderr).join("\n"));
  // (a reading that crashed, stopped before its answer or holds none in its form is counted not proved, so the record
  // still stands; one never asked, a file not read and an answer for another commit are refused; #1361, point 18)
  const crashed = path.join(tmp, "crashed.txt"), empty = path.join(tmp, "empty.txt"), pureOne = path.join(tmp, "pure.txt"), elsewhere = path.join(tmp, "elsewhere.txt");
  fs.writeFileSync(crashed, "node:internal/errors: Command failed: git fetch -q --no-tags origin refs/heads/main\nfatal: 'origin' does not appear to be a git repository\n");
  fs.writeFileSync(empty, "");
  fs.writeFileSync(pureOne, `a pure sync against the commit tried, ${later}: a trial's reading\ntrial answer: ${JSON.stringify({ commit: later, pure: true, from: "release-5" })}\n`);
  fs.writeFileSync(elsewhere, `trial answer: ${JSON.stringify({ commit: tried, pure: true, from: "release-5" })}\n`);
  const counted = answersOf([pureOne, crashed, empty, said], later, 4);
  ok(JSON.stringify(counted.answers) === JSON.stringify([{ pure: true, from: "release-5", main: "unknown" }, ...Array(3).fill({ pure: false, from: "unknown", main: "unknown", unproved: true })]) && counted.unproved.length === 3
    && counted.unproved.every((l, i) => l.startsWith(`project ${i + 2}'s sync, counted not proved: `) && l.includes("holds no line `trial answer: `")) && counted.why === undefined,
    "a sync's reading that crashed, is empty or holds no answer is counted not proved, from a copy not read, and says so for each", JSON.stringify(counted));
  const elsewhereNoForm = path.join(tmp, "elsewhere-no-form.txt");
  fs.writeFileSync(elsewhereNoForm, `trial answer: ${JSON.stringify({ commit: tried, pure: "yes", from: "a project" })}\n`);
  const [unreadFile, other, otherNoForm, never] = [answersOf([path.join(tmp, "not-there.txt")], later, 1), answersOf([elsewhere], later, 1), answersOf([elsewhereNoForm], later, 1), answersOf([], later, 1)];
  const otherKinds = [null, 7, { sha: later }].map(commit => answerOf(`trial answer: ${JSON.stringify({ commit, pure: true, from: "main" })}`, later)), noCommit = answerOf(`trial answer: ${JSON.stringify({ pure: true, from: "main" })}`, later), fromList = answerOf(`trial answer: ${JSON.stringify({ commit: later, pure: true, from: ["main"] })}`, later);
  ok(/not-there\.txt, given with --sync for project 1, cannot be read/.test(unreadFile.why) && [other, otherNoForm].every(o => /answers for [0-9a-f]{7}, not the commit tried/.test(o.why)) && /given with no --sync after them/.test(never.why)
    && otherKinds.every(o => !o.none && /not the commit tried/.test(o.why)) && noCommit.none === true && fromList.none === true,
    "  and a file not read, an answer for another commit, in its form or not and whatever names it, and a reading never asked are refused all the same; one naming no commit, or a copy by no name, is no answer", [unreadFile, other, otherNoForm, never].map(r => r.why).join("\n"));
  const unprovedSaid = trialAt(record(trialRecord(later, "2026-11-23", [one, one], counted.answers.slice(0, 2), [...OTHER, ...OTHER])), read);
  ok(unprovedSaid.held === null && /1 of the syncs pure, 1 not, 1 of them not proved, their reading holding no answer;[^]*; the syncs read 2 against a main their reading does not name\./.test(unprovedSaid.said), "  the record counts the syncs not proved apart and says them, and the mains no reading named, holding no cut", unprovedSaid.said);
  const unprovedNoForm = [{ ...readings, syncUnproved: 2 }, { ...readings, syncUnproved: -1 }, { ...readings, syncUnproved: "one" }].map(bad => trialAt(record(bad), read));
  ok(unprovedNoForm.every(n => /no form/.test(n.said) && n.held !== null) && !/no form/.test(trialAt(record((({ syncUnproved, ...rest }) => rest)(readings)), read).said),
    "  a record with more syncs not proved than not pure, or a count of them that is no count, is in no form; one written before them, without it, is in its form");
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the trial of a release`);
process.exitCode = failed ? 1 : 0;
