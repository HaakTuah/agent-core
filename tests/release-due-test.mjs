// Tests of whether a release's trial is due (scripts/release-due.mjs; AGENTS.md, "One batch, then one release";
// #1413, point 4): the lines of QUEUE.md read from the newest release's commit and each version since, the issues
// closed as completed after that commit read from a stand-in for GitHub, the trial due at ten lines merged or a week
// with one, never while a trial's record past the release stands, and the scheduled look's issue kept, closed or left
// as it stands. Every repository and name is invented. Git and Node's own modules.
//
//   node tests/release-due-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DAYS, LINES, TITLE, closedSince, dueIssue, dueness, readGit } from "../scripts/release-due.mjs";
import { DUE } from "../scripts/look.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// ---- a scratch repository: a release, then the queue changed twice and a trial's record written ----
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-due-"));
const env = { ...process.env, GIT_AUTHOR_NAME: "Example", GIT_AUTHOR_EMAIL: "example@example.invalid", GIT_COMMITTER_NAME: "Example", GIT_COMMITTER_EMAIL: "example@example.invalid" };
const git = args => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const commit = (file, text, when) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); git(["add", "."]); execFileSync("git", ["commit", "-q", "-m", file], { cwd: dir, env: { ...env, GIT_COMMITTER_DATE: when, GIT_AUTHOR_DATE: when } }); return git(["rev-parse", "HEAD"]); };
try {
  git(["init", "-q", "-b", "main"]);
  commit("QUEUE.md", "| Issue | Who | Waits on |\n|---|---|---|\n| #1 | any builder | nothing |\n", "2026-11-01T10:00:00Z");
  git(["tag", "release-1"]);
  const r2 = commit("QUEUE.md", "| Issue | Who | Waits on |\n|---|---|---|\n| #2 | any builder | nothing |\n| #3 | any builder | nothing |\n", "2026-11-10T10:00:00Z");
  git(["tag", "release-2"]);
  commit("QUEUE.md", "| Issue | Who | Waits on |\n|---|---|---|\n| #3 | any builder | nothing |\n| #4 and #5 | any builder | #3 |\n", "2026-11-11T10:00:00Z");
  commit("QUEUE.md", "| Issue | Who | Waits on |\n|---|---|---|\n| #5 | any builder | #3 |\n| #6 | any builder | nothing |\n", "2026-11-12T10:00:00Z");
  const read = readGit(git);
  ok(read.release.name === "release-2" && read.release.sha === r2 && read.release.at.startsWith("2026-11-10"), "the newest release by its number, with the time of the commit it stands on", JSON.stringify(read.release));
  ok(read.lines.join() === "2,3,4,5,6", "the lines read at the release's commit and in each version of QUEUE.md since, every issue a line names first, none from before the release", read.lines.join());
  ok(read.trialed === null, "with no trial's record, no trial has run");

  const tried = commit("scripts/x.mjs", "\n", "2026-11-13T10:00:00Z");
  commit("reports/release-trial.json", JSON.stringify({ commit: tried }), "2026-11-13T11:00:00Z");
  ok(readGit(git).trialed === tried, "a trial's record past the release is read as a trial that has run");
  commit("reports/release-trial.json", JSON.stringify({ commit: r2 }), "2026-11-13T12:00:00Z");
  ok(readGit(git).trialed === null, "a record of the release's own commit is the trial of the release already cut, not a new one");
  git(["tag", "-d", "release-1"]); git(["tag", "-d", "release-2"]);
  ok(readGit(git) === null, "with no release cut, there is nothing to count from");
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

// ---- what is due ----
const release = { name: "release-2", sha: "a".repeat(40), at: "2026-11-10T10:00:00Z" };
const lines = Array.from({ length: 12 }, (_, i) => i + 1);
const at = (days, n, trialed = null) => dueness({ release, lines, trialed }, new Set(lines.slice(0, n)), new Date(Date.parse(release.at) + days * 86400000).toISOString());
ok(LINES === 10 && DAYS === 7, "the marks are ten lines and seven days, as the stand-in settled them");
ok(!at(2, LINES - 1).due && at(2, LINES).due && /^Due \(10 or more lines merged\): 10 lines of QUEUE\.md merged since release-2/.test(at(2, LINES).said), "ten lines merged make a trial due, nine within the week do not", at(2, LINES).said);
ok(at(DAYS, 1).due && !at(DAYS - 1, 1).due && !at(30, 0).due, "a week with one line merged makes it due; six days, or a month with none, do not", at(30, 0).said);
ok(!at(30, 12, "b".repeat(40)).due && /its trial has run/.test(at(30, 12, "b".repeat(40)).said), "no second trial is due while a trial's record past the release stands");
ok(!dueness({ release, lines: [20], trialed: null }, new Set([21, 22]), "2026-12-30T00:00:00Z").due, "an issue closed that no line of the queue named is no line merged");
ok(!dueness(null, new Set(), "2026-12-30T00:00:00Z").due, "with no release, none is due by count");

// ---- the closed issues, read from a stand-in for GitHub ----
const routes = [];
const rows = [
  { number: 3, state: "closed", state_reason: "completed", closed_at: "2026-11-11T00:00:00Z" },
  { number: 4, state: "closed", state_reason: "not_planned", closed_at: "2026-11-11T00:00:00Z" },
  { number: 5, state: "closed", state_reason: "completed", closed_at: "2026-11-09T00:00:00Z" },
  { number: 6, state: "closed", state_reason: "completed", closed_at: "2026-11-12T00:00:00Z", pull_request: {} },
];
const got = closedSince("example-owner/example-core", release.at, route => { routes.push(route); return JSON.stringify(rows); });
ok([...got].join() === "3", "only issues closed as completed after the release's commit count: not one closed as not planned, one closed before, or a pull request", [...got].join());
ok(routes.length === 1 && routes[0].startsWith("repos/example-owner/example-core/issues?state=closed&since=2026-11-10T10%3A00%3A00.000Z"), "the route holds the repository's name and the time alone", routes[0]);
const throws = f => { try { f(); return false; } catch { return true; } };
ok(throws(() => closedSince("not a repo", release.at, () => "[]")) && throws(() => closedSince("example-owner/example-core", release.at, () => "{}"))
  && throws(() => closedSince("example-owner/example-core", release.at, () => JSON.stringify([{ number: "3" }]))) && throws(() => closedSince("example-owner/example-core", release.at, () => { throw new Error("HTTP 502"); })),
  "a name that is no repository's, an answer that is no list, a row out of its form and gh failing each throw: the reading never guesses");
let pages = 0;
ok(throws(() => closedSince("example-owner/example-core", release.at, () => { pages++; return JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ number: i + 1, state: "closed", state_reason: "completed", closed_at: "2026-11-11T00:00:00Z" }))); })) && pages === 30, "the reading stops at its pages' bound");

// ---- the scheduled look's issue ----
const ctx = { manifest: null, at: "2026-11-20T00:00:00Z", repo: "example-owner/example-core" };
const read = () => ({ release, lines, trialed: null });
const issue = dueIssue(ctx, read, () => new Set(lines));
ok(DUE.includes(dueIssue), "the scheduled look reads it");
ok(issue.title === TITLE && issue.owner === false && /trial-brief\.mjs/.test(issue.body) && /release\.mjs --trial/.test(issue.body) && /next batch/.test(issue.body), "while one is due, the look keeps a queued issue that says how the trial is run and recorded", issue.body);
ok(dueIssue(ctx, read, () => new Set()).body === null, "once none is due, the look closes it");
const unread = dueIssue(ctx, () => { throw new Error("no tags here"); });
ok(unread.body === null && /could not be read: no tags here/.test(unread.unread), "where git or GitHub cannot be read, the issue is left as it stands, saying why");
ok(dueIssue({ ...ctx, manifest: "# Core manifest\n" }, read, () => new Set(lines)) === null, "in a project, which cuts no release, nothing is read");

console.log(`${count} assertions on whether a release's trial is due`);
if (failed) { console.error(`${failed} failed`); process.exitCode = 1; }
