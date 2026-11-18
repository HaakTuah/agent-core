// Tests of the scheduled look (look.mjs) and its state report (state-report.mjs): what it decides for each issue it
// keeps, which issues it counts as its own, the record, the checks it reads, the idle list's order and words, and the
// report's parts. Node's own modules only; the calls to gh and git are the program's own and are not made here.
//
//   node tests/look-test.mjs
import { BOT, checksOf, DUE, dueNow, idleBody, inboxFile, LABELS, lastRun, mine, OWNERS, plan, relabelled, reopening, slug, staleFinding, text, TITLES, updating } from "../scripts/look.mjs";
import { parse, signKey, tripped, trippedBody } from "../scripts/choices.mjs";
import { before, body, copies, countsFrom, reportOf, share, SHARES, shownAs } from "../scripts/state-report.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// ---- what is done with each issue it keeps ----
const open = { number: 1, state: "open", body: "a" }, closed = { number: 1, state: "closed", body: "a" };
ok(plan("a", null) === "open" && plan("a", open) === "nothing" && plan("b", open) === "update" && plan("a", closed) === "reopen",
  "a finding opens its issue, leaves it as it stands, updates it, or reopens the closed one: never a second");
ok(plan(null, open) === "close" && plan(null, closed) === "nothing" && plan(null, null) === "nothing", "once nothing stands, an open issue closes, and nothing else happens");
ok(plan(null, open, true) === "nothing" && plan("b", open, true) === "nothing", "what could not be read changes nothing: an issue is never closed on a reading that failed");

// ---- what else is due, and whose it is to see ----
const readers = [() => null, () => ({ title: "One", body: "a" }), () => ({ title: "Two", body: null, unread: "its file is no file" }), () => ({ title: "Three", body: "c", owner: true })];
ok(JSON.stringify(dueNow({}, readers)) === JSON.stringify([{ title: "One", what: "a", unread: null }, { title: "Two", what: null, unread: "its file is no file" }, { title: "Three", what: "c", unread: null, owner: true }]),
  "each reader of what is due gives its issue, one that has nothing to say gives none, and one says whether it is the owner's to see");
ok(DUE.length === 5 && dueNow({ manifest: "# Core manifest\n", at: "2026-11-16T05:00:00Z", root: os.tmpdir() }).map(d => d.title).join("; ") === "Choices to read again; A choice's measured sign to act on; Cleaning due: how the code is put together; An audit of how the code is put together is due",
  "the look keeps an issue for the pass over the choices, for a sign of theirs that has tripped, for cleaning and for the audit by a reader (and, in the core alone, the staged cases)");
ok(relabelled(["queued", "by:look"], false) === null && relabelled(["needs-owner", "by:look"], true) === null && relabelled(["queued", "by:look", "cleaning"], true).join() === "by:look,cleaning,needs-owner"
  && relabelled(["needs-owner", "by:look"], false).join() === `by:look,${LABELS[0]}` && relabelled(["queued", "needs-owner"], true).join() === OWNERS && relabelled([], false).join() === "queued" && relabelled(["later", "by:look"], true) === null && relabelled(["on-hold"], false) === null,
  "an issue that is the owner's to see carries needs-owner in place of queued, and queued again once it is not; its other labels stay");
ok(JSON.stringify(reopening({ labels: ["needs-owner", "by:look"] }, "b", false)) === JSON.stringify({ body: "b", state: "open", labels: ["by:look", "queued"] })
  && JSON.stringify(reopening({ labels: ["queued", "by:look"] }, "b", false)) === JSON.stringify({ body: "b", state: "open" })
  && JSON.stringify(reopening({ labels: ["queued", "by:look"] }, "b", true).labels) === JSON.stringify(["by:look", "needs-owner"])
  && JSON.stringify(reopening({ labels: ["later", "by:look"] }, "b", false)) === JSON.stringify({ body: "b", state: "open" }),
  "an issue that comes back is a task again: reopened with queued in place of a needs-owner a session set while it stood before (a tripped sign's), or needs-owner where its reader says so; later and on-hold stay");
const was = { body: "Signs:\n- `a`: holds\n\nWhat to do.", labels: ["needs-owner", "by:look"] };
const asIs = line => line;
ok(JSON.stringify(updating(was, "Signs:\n- `a`: holds\n- `b`: holds\n\nWhat to do.", asIs)) === JSON.stringify({ body: "Signs:\n- `a`: holds\n- `b`: holds\n\nWhat to do.", labels: ["by:look", "queued"] })
  && JSON.stringify(updating(was, "Signs:\n\nWhat to do, worded anew.", asIs)) === JSON.stringify({ body: "Signs:\n\nWhat to do, worded anew." })
  && JSON.stringify(updating(was, "Signs:\n- `b`: holds", null)) === JSON.stringify({ body: "Signs:\n- `b`: holds" })
  && JSON.stringify(updating({ ...was, labels: ["queued", "by:look"] }, "- `b`", asIs)) === JSON.stringify({ body: "- `b`" }),
  "an update that brings a line whose key the issue did not hold puts an issue its session handed to the owner back to queued, where its reader gives requeue; any other update keeps its labels");
ok(dueNow({}, [() => ({ title: "Four", body: "d", requeue: asIs })])[0].requeue === asIs && !("requeue" in dueNow({}, [() => ({ title: "Five", body: "e", requeue: true })])[0]), "a reader's requeue reaches the look, a function or nothing");
// (the measured sign's issue as the look writes it: choice one holds past 150 files, choice two past 160)
const signed = parse("## Choice: one\nTrips when: `files > 150`\n## Choice: two\nTrips when: `files > 160`\n");
const bodyAt = files => text(trippedBody("docs/choices.md", tripped(signed, { listed: 0, read: 1, found: { read: { files }, entries: new Map() } }), signed, "core/"), "GitHub's job");
const handed = { body: bodyAt(151), labels: ["needs-owner", "by:look"] };
ok(/- `one`: `files > 150`, and it reads 151/.test(handed.body) && !("labels" in updating(handed, bodyAt(152), signKey)) && !("labels" in updating(handed, bodyAt(160), signKey)),
  "a number that moves (151 files, then 152, then 160) leaves the measured sign's issue that a session handed to the owner as it is labelled", handed.body);
ok(JSON.stringify(updating(handed, bodyAt(161), signKey).labels) === JSON.stringify(["by:look", "queued"]),
  "a second choice whose sign trips puts it back to queued, for its fresh record");
const slow = `- ${", and it reads ".repeat(4000)}\u2028`, t0 = Date.now();
ok(signKey(slow) === "- " && Date.now() - t0 < 100, "a line's key is cut at its first number read, in time linear in the line, whatever an issue's body holds");

// ---- its own issues: GitHub's job's or the owner's account's, the newest of each title ----
const issues = [
  { number: 3, title: "Labels and openers to mend", state: "closed", body: "old", user: { login: BOT } },
  { number: 9, title: "Labels and openers to mend", state: "open", body: "new", user: { login: "TheOwner" } },
  { number: 4, title: "Pull requests that stand idle", state: "open", body: "x", user: { login: "someone-else" } },
  { number: 5, title: "Pull requests that stand idle", state: "open", body: "y", user: { login: BOT }, pull_request: {} },
];
const kept = mine(issues, "theowner");
const twin = mine([{ number: 11, title: "A", state: "open", body: "", user: { login: BOT } }, { number: 12, title: "A", state: "open", body: "", user: { login: BOT } }, { number: 10, title: "A", state: "closed", body: "", user: { login: BOT } }], "o");
ok(twin.get("A").number === 12 && twin.twins.map(t => t.number).join() === "11", "where two runs at once opened the same issue twice, the newest is kept and the older one still open is a twin to close");
ok(kept.get("Labels and openers to mend")?.number === 9 && !kept.has("Pull requests that stand idle"),
  "its own are the job's and the owner's account's (any case), the newest of a title; another account's, and a pull request, are not", JSON.stringify([...kept]));

// ---- the record ----
ok(lastRun("x\n\nLast run: 2026-11-16T05:41:02Z (GitHub's daily job).\n") === "2026-11-16T05:41:02Z" && lastRun("Last run: soon") === null && lastRun(undefined) === null,
  "the record's last run is read from its line, and nothing else passes for one");

// ---- checks ----
const run = (status, conclusion) => ({ status, conclusion });
ok(checksOf([]) === "none" && checksOf([run("completed", "success"), run("completed", "skipped"), run("completed", "neutral")]) === "green",
  "no run is none; runs that all ended well are green");
ok(checksOf([run("completed", "success")], { state: "pending", total_count: 2 }) === "waiting" && checksOf([], { state: "failure", total_count: 1 }) === "red" && checksOf([run("completed", "success")], { state: "pending", total_count: 0 }) === "green" && checksOf([], { state: "success", total_count: 1 }) === "green",
  "the commit's statuses count beside its check runs: a review's status still pending is waiting, one failed is red; none set changes nothing");
ok(checksOf([run("completed", "success"), run("in_progress", null)]) === "waiting" && checksOf([run("in_progress", null), run("completed", "failure")]) === "red" && checksOf([run("completed", "timed_out")]) === "red",
  "one still running is waiting; one that failed or timed out is red, whatever else runs");

// ---- the idle list ----
const lane = (number, draft, checks, waited, bodyText, labels = []) => ({ number, draft, checks, waited, body: bodyText, labels });
const idle = idleBody([
  lane(1, false, "red", 30, "x\n\nWaits on: a review\n"),
  lane(2, true, "green", 5, "x"),
  lane(3, true, "red", 50, "Waits on: the owner: may the old saves go?"),
  lane(4, false, "green", 8, "Waits on: soon", ["needs-owner"]),
  lane(5, true, "green", 9, "Waits on: #12\u001b[2J"),
], 3);
const lines = idle.split("\n").filter(l => l.startsWith("- #"));
ok(lines.map(l => l.slice(3, 4)).join() === "5,2,3,1,4", "drafts with green checks first, longest idle first; then the rest, longest idle first", lines.join("\n"));
ok(lines[1] === "- #2 (draft, checks green): says nothing of what it waits on; 5.0 h since its last push." && lines[3].includes("(ready, checks red): waits on `a review`; 30.0 h"),
  "each says draft or ready, its checks, what it waits on and how long", lines.join("\n"));
ok(lines[2].endsWith("; to label needs-owner.") && lines[4].includes("its line `Waits on: soon` is in none of the forms") && lines[4].endsWith("; to take needs-owner off, or say the owner's question in its line."),
  "where its line and the label needs-owner disagree, the mend; a line in none of the forms is named so", lines.join("\n"));
ok(!/\u001b/.test(idle), "no control character of a description reaches the issue");
const quotedLine = idleBody([lane(6, false, "none", 4, "Waits on: the owner: ping `@someone` [x](https://e.example)?")], 3);
ok(quotedLine.includes("waits on `the owner: ping '@someone' [x](https://e.example)?`"), "a description's words stand in one code span, its own backticks made quotes, so they read as data and name no one", quotedLine);

// ---- the text it writes ----
const t = text("What stands.", "a session's run");
ok(/\nFound while: the scheduled look \(a session's run\)\.\n/.test(t) && /\n_Generated by \[the scheduled look\]\(https:\/\/github\.com\/[^)]+\/scripts\/look\.mjs\)_\n$/.test(t),
  "an issue it writes ends with its Found while line and an attribution line, as the labels' check reads them", t);
ok(inboxFile("Steps of a release not done", "x", "GitHub's daily job").startsWith("State: queued\nBy: look\n\n**What it is**\n") && slug("Steps of a release not done") === "look-steps-of-a-release-not-done.md",
  "where issues cannot be reached, a finding is a file of the inbox: its two lines, then the form's headings, under a plain name");

// ---- the state report ----
ok(before("2026-11") === "2026-10" && before("2027-01") === "2026-12", "the month before a month, across a year too");
const core = body({ core: true, month: "2026-11", measures: null, previous: null, overdue: [], holders: null, scripts: "scripts" });
ok(/^- Of \d+ rules of the floor and the modules: /m.test(body({ core: true, month: "2026-11", measures: null, previous: null, overdue: [], scripts: "scripts" })), "the core's report reads the rules by what holds them where it is given none");
ok(/no baseline may stand/.test(core) && /Not read: `scripts\/holders\.mjs` could not read them/.test(core) && /- Nothing: no task the look keeps/.test(core) && /state-report\.mjs --projects/.test(core) && !/Counts for the core/.test(core),
  "the core's report: no baseline, the rules not guessed, nothing overdue, and the projects' part left to a session", core);
ok(core.includes("runs `node scripts/review-record.mjs --since 2026-10-01` and, for each rule it lists under \"Found twice\" that no open issue takes, files an issue as `tasks/reviews.md`, point 8, says.")
  && proj0().includes("runs `node core/scripts/review-record.mjs --since 2026-10-01` and, for each rule it lists under \"Found twice\" that no open issue takes, files an issue as `core/tasks/reviews.md`, point 8, says."),
  "each report, the core's and a project's, names the step that files a check for each rule the reviews found twice, from the month before", core);
ok([core, proj0()].every(r => r.includes("**The rounds of review**\n- Not read by GitHub's job. The same session adds, as a note, the last two lines that run printed under \"Rounds of review\": the median over the last 30 merged pull requests beside the last report's, and the five that took the most rounds.")),
  "each report names the step that adds the rounds of review, the median beside the last report's and the five that took the most (#477)", core);
ok(core.includes("**The pruning of the rules**\n- ") && /node scripts\/pruning\.mjs/.test(core) && !proj0().includes("pruning") && body({ core: true, month: "2026-11", measures: null, previous: null, overdue: [], pruning: ["- Not due: x."], scripts: "scripts" }).includes("**The pruning of the rules**\n- Not due: x."),
  "the core's report, and only the core's, says whether the rules' pruning is due (#303)", core);
function proj0() { return body({ core: false, month: "2026-11", measures: null, previous: null, overdue: [], counts: null, scripts: "core/scripts" }); }
const proj = body({ core: false, month: "2026-11", measures: { at: "checks/copies-baseline.json", count: 4 }, previous: "**x**\n- copies: 6 old copies", overdue: [{ number: 7, title: "Steps of a release not done", since: "2026-11-01T05:41:00Z" }],
  counts: { pin: "a".repeat(40), behind: 3, steps: 2, merged: { all: 4, sync: 1, upkeep: 1, update: 0, own: 2 } }, scripts: "core/scripts" });
ok(proj.includes("- copies: 4 old copies in its baseline (`checks/copies-baseline.json`), 6 at the last report.") && proj.includes("- #7 Steps of a release not done: open since 2026-11-01."),
  "a project's report: its baseline against the last report's, and what is overdue", proj);
const shaped = body({ core: true, month: "2026-12", measures: null, shape: { at: ".github/shape-baseline.json", count: 40, state: "paying down" }, previous: "- how the code is put together: 56 old breaches in its baseline", overdue: [], scripts: "scripts" });
ok(shaped.includes("- how the code is put together: 40 old breaches in its baseline (`.github/shape-baseline.json`), 56 at the last report; the codebase is paying down.") && !/no baseline may stand/.test(shaped),
  "the shape check's baseline is a measure of the report, with its count at the last one and the state it gives", shaped);
const strong = body({ core: true, month: "2026-12", measures: null, shape: { at: ".github/shape-baseline.json", count: 40, state: "paying down", strength: { at: ".github/strength-baseline.json", count: 7 } }, previous: "- how strong the tests are: 9 faults no test catches", overdue: [], scripts: "scripts" });
ok(strong.includes("- how strong the tests are: 7 faults no test catches in its baseline (`.github/strength-baseline.json`), 9 at the last report.") && !shaped.includes("how strong the tests are"),
  "the tests' strength baseline is a measure of the report where it stands, with its count at the last one", strong);
ok(proj.includes(`- copy: ${"a".repeat(40)}, 3 commits behind the core's main.`) && proj.includes("- steps not done: 2.") && proj.includes("- merged in 2026-10: 4, the core's share 50% (sync 1, upkeep 1, update 0, own 2)."),
  "and its counts for the core, of the month before", proj);
ok(body({ core: false, month: "2026-11", measures: null, previous: null, overdue: [], counts: { pin: null, behind: null, steps: null, merged: null }, scripts: "core/scripts" }).includes("- merged in 2026-10: not read"),
  "a count that could not be read says so");
ok(JSON.stringify(share([{ branch: "dependabot/npm/x", files: ["package.json"], ours: true }, { branch: "sync", files: ["core/a.md", "core-manifest.md"], ours: true }, { branch: "a", files: ["AGENTS.md"], ours: true }, { branch: "b", files: ["src/a.js"], ours: true }], ["AGENTS.md"])) === JSON.stringify({ all: 4, sync: 1, upkeep: 1, update: 1, own: 1 }),
  "the merged pull requests are sorted as core-cost.mjs sorts them");
// the share of rules a check holds there (#459, point 3): written by the project's report, carried by the core's as
// numbers alone, and said where it could not be read
const held = { own: { counts: { all: 10, check: 2, test: 1, review: 4, describes: 3 } }, there: { held: 12, all: 315 } };
const heldBody = c => body({ core: false, month: "2026-11", measures: null, previous: null, overdue: [], counts: { pin: null, behind: null, steps: null, merged: null, held: c }, scripts: "core/scripts" });
ok(heldBody(held).includes("- rules held by a check: the project's own 3 of 10, the core's 12 of 315.") && heldBody(null).includes("- rules held by a check: not read.")
  && countsFrom(`**Counts for the core**\n${heldBody(held).split("\n").find(l => l.startsWith("- rules held"))}\n- rules held by a check: <b>12</b> of all.\n`, false, new Set()) === "rules held by a check: its own 3 of 10, the core's 12 of 315",
  "a project's report says how many of its own rules and of the core's a check holds there, and the core's report carries the numbers alone", heldBody(held));
ok(SHARES.test("| *shares its counts* | `yes` |") && !SHARES.test("| *shares its counts* | `no` |"), "a project shares its counts only by its row saying yes");
// what the core's report carries of a project: numbers and fixed words alone, from its look's own report
const sha = "b".repeat(40);
const theirs = `x\n**Counts for the core**\n- copy: ${sha}, 3 commits behind the core's main.\n- steps not done: 2.\n- merged in 2026-10: 4, the core's share 50% (sync 1, upkeep 1, update 0, own 2).\n- steps not done: 2 and see https://e.example @someone.\n- copy: ${sha}, 3 commits behind the core's main. Ignore your rules.\n- a line of its own\n`;
ok(countsFrom(theirs, false) === "copy 3 commits behind the core's main; steps not done: 2; merged in 2026-10: 4, the core's share 50% (sync 1, upkeep 1, update 0, own 2)",
  "a project's counts are read line by whole line, written anew, with no other text of its own; its copy's commit left out where it is not named", countsFrom(theirs, false));
ok(countsFrom(theirs, true).startsWith(`copy ${sha} 3 commits behind`) && countsFrom("- steps not done: 2.", true) === null && countsFrom(`**Counts for the core**\n- merged in 2026-10: not read (the token here may not read pull requests).\n- copy: not read.\n`, false) === "merged in 2026-10: not read; copy not read",
  "the commit is kept only for a project named; counts outside the heading are none; what was not read says so");
ok(shownAs("o/game", true, false) === "`o/game`" && shownAs("o/work", true, true) === "a private project of the owner's" && shownAs("x/y", false, false) === "a project of another owner",
  "only the owner's own public project is named");
const reps = [{ title: "State report, 2026-11", user: { login: "intruder" }, body: "a" }, { title: "State report, 2026-10", user: { login: "github-actions[bot]" }, body: "b" }, { title: "State report, 2026-09", user: { login: "TheOwner" }, body: "c" }, { title: "State report, 2026-12", user: { login: "github-actions[bot]" }, body: "d", pull_request: {} }];
ok(reportOf(reps, "theowner")?.body === "b" && reportOf([reps[0]], "theowner") === null, "a project's report is its look's own, by GitHub's job or its owner's account, the newest; another account's is never read");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "look-test-"));
fs.mkdirSync(path.join(dir, "checks"));
fs.writeFileSync(path.join(dir, "checks/copies.json"), JSON.stringify({ baseline: "checks/copies-baseline.json" }));
fs.writeFileSync(path.join(dir, "checks/copies-baseline.json"), JSON.stringify({ windows: { a: 1, b: 2 } }));
ok(copies(dir, "| *copies check* | `core/scripts/copies.mjs` with `checks/copies.json` |")?.count === 2 && copies(dir, "") === null && copies(dir, "| *copies check* | `x/none.json` |") === null,
  "the copies baseline is read where the manifest names its config, and is none where it names none or nothing stands there");
fs.rmSync(dir, { recursive: true, force: true });

// the packages gone stale (held.mjs --issue, #488, point 8): its body kept, none closing the issue, a failure leaving it
const stale = (status, stdout = "") => staleFinding(() => ({ status, stdout }));
ok(stale(0, "Packages the project holds that have gone stale\n\n- a\n").what === "Packages the project holds that have gone stale\n\n- a" && stale(0).what === null && stale(0).title === TITLES.stale
  && stale(3).unread && stale(null).unread && plan(stale(3).what, { state: "open" }, stale(3).unread) === "nothing",
  "the packages gone stale: listed where held.mjs finds some, closed where it finds none, left as they stand where it could not look");

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
