// Tests of whether a release's trial is due (scripts/release-due.mjs; AGENTS.md, "One batch, then one release";
// #1413, point 4): the lines of QUEUE.md read from the newest release's commit and each version since, the issues
// closed as completed after that commit read from a stand-in for GitHub, each counted only where a merged pull request
// or an account that can write made its close, the trial due at ten lines merged or a week
// with one, never while a trial's record past the release stands, and the scheduled look's issue kept, closed or left
// as it stands. Every repository and name is invented. Git and Node's own modules.
//
//   node tests/release-due-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DAYS, LINES, TITLE, closedSince, closesRead, closesSince, dueIssue, dueness, readGit } from "../scripts/release-due.mjs";
import { DUE } from "../scripts/look.mjs";
import { trialRecord } from "../scripts/release-trial.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// ---- a scratch repository: a release, then the queue changed twice and a trial's record written ----
const dir = scratchDir("release-due-");
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_"))), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(dir, "..", `${path.basename(dir)}.gitconfig`), GIT_AUTHOR_NAME: "Example", GIT_AUTHOR_EMAIL: "example@example.invalid", GIT_COMMITTER_NAME: "Example", GIT_COMMITTER_EMAIL: "example@example.invalid" };
const git = args => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const commit = (file, text, when) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); git(["add", "."]); execFileSync("git", ["commit", "-q", "-m", file], { cwd: dir, env: { ...env, GIT_COMMITTER_DATE: when, GIT_AUTHOR_DATE: when } }); return git(["rev-parse", "HEAD"]); };
{
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
  commit("reports/release-trial.json", JSON.stringify(trialRecord(tried, "2026-11-13", [])), "2026-11-13T11:00:00Z");
  ok(readGit(git).trialed === tried, "a trial's record past the release that holds no cut is read as a trial that has run");
  commit("reports/release-trial.json", JSON.stringify(trialRecord(tried, "2026-11-13", [[{ "a.yml/x": "passed" }, { "a.yml/x": "failed" }]], [{ pure: true, from: "release-2" }], [{ none: "another-owner" }])), "2026-11-13T11:30:00Z");
  ok(readGit(git).trialed === null, "a trial's record that stops the cut is no trial that has run: one is to be run again");
  commit("reports/release-trial.json", JSON.stringify({ commit: tried }), "2026-11-13T11:45:00Z");
  ok(readGit(git).trialed === null, "a record in no form the trial writes is no trial that has run");
  commit("reports/release-trial.json", JSON.stringify({ commit: r2 }), "2026-11-13T12:00:00Z");
  ok(readGit(git).trialed === null, "a record of the release's own commit is the trial of the release already cut, not a new one");
  commit("QUEUE.md", `| #7 | any builder | ${"x".repeat(1 << 20)} |\n`, "2026-11-14T10:00:00Z");
  let refused = null;
  try { readGit(git); } catch (e) { refused = e.message; }
  ok(/is past the 1048576 bytes the reader takes/.test(refused ?? ""), "a version of QUEUE.md past the reader's bound is refused, never read", refused);
  const side = commit("QUEUE.md", "| #8 | any builder | nothing |\n", "2026-11-14T11:00:00Z");
  git(["reset", "-q", "--hard", "HEAD~2"]);
  execFileSync("git", ["merge", "-q", "--no-ff", "-m", "merge", side, "-X", "theirs"], { cwd: dir, env: { ...env, GIT_COMMITTER_DATE: "2026-11-14T12:00:00Z", GIT_AUTHOR_DATE: "2026-11-14T12:00:00Z" }, stdio: "ignore" });
  ok(readGit(git).lines.join() === "2,3,4,5,6,8", "only main's own versions of QUEUE.md are read, never those a merged branch held on its way", readGit(git).lines.join());
  git(["tag", "-d", "release-1"]); git(["tag", "-d", "release-2"]);
  ok(readGit(git) === null, "with no release cut, there is nothing to count from");
  let shallow = null;
  try { readGit(args => (args[0] === "rev-parse" ? "true" : "")); } catch (e) { shallow = e.message; }
  ok(/shallow/.test(shallow ?? ""), "a shallow clone, whose releases cannot be read, throws rather than reading none cut", shallow);
}

// ---- what is due ----
const release = { name: "release-2", sha: "a".repeat(40), at: "2026-11-10T10:00:00Z" };
const lines = Array.from({ length: 12 }, (_, i) => i + 1);
const at = (days, n, trialed = null) => dueness({ release, lines, trialed }, new Set(lines.slice(0, n)), new Date(Date.parse(release.at) + days * 86400000).toISOString());
ok(LINES === 10 && DAYS === 7, "the marks are ten lines and seven days, as the stand-in settled them");
ok(!at(2, LINES - 1).due && at(2, LINES).due && /^Due \(10 or more lines merged\): 10 lines of QUEUE\.md merged since release-2/.test(at(2, LINES).said), "ten lines merged make a trial due, nine within the week do not", at(2, LINES).said);
ok(at(DAYS, 1).due && !at(DAYS - 1, 1).due && !at(30, 0).due, "a week with one line merged makes it due; six days, or a month with none, do not", at(30, 0).said);
ok(!at(30, 12, "b".repeat(40)).due && /its trial has run/.test(at(30, 12, "b".repeat(40)).said), "no second trial is due while a trial's record past the release stands");
ok(!dueness({ release, lines: [20], trialed: null }, new Set([21, 22]), "2026-12-30T00:00:00Z").due, "an issue closed that no line of the queue named is no line merged");

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

// ---- who made each close, read from a stand-in for GitHub ----
{
  const merge = "c".repeat(40), loose = "d".repeat(40);
  const closedBy = (login, commit_id = null) => [{ event: "labeled", actor: { login: "example-writer" } }, { event: "closed", actor: login === null ? null : { login }, commit_id }];
  const right = (login, role_name, permission) => ({ permission, role_name, user: { login, type: "User" } });
  const host = {
    "repos/example-owner/example-core/issues/11/events?per_page=100&page=1": closedBy("example-outsider"),
    "repos/example-owner/example-core/issues/12/events?per_page=100&page=1": closedBy("example-merger", merge),
    "repos/example-owner/example-core/issues/13/events?per_page=100&page=1": closedBy("example-writer"),
    "repos/example-owner/example-core/issues/14/events?per_page=100&page=1": closedBy(null),
    "repos/example-owner/example-core/issues/15/events?per_page=100&page=1": closedBy("example-gone"),
    "repos/example-owner/example-core/issues/16/events?per_page=100&page=1": closedBy("example-outsider", loose),
    "repos/example-owner/example-core/issues/18/events?per_page=100&page=1": [{ event: "labeled", actor: { login: "example-writer" } }],
    [`repos/example-owner/example-core/commits/${merge}/pulls`]: [{ number: 40, merged_at: "2026-11-11T00:00:00Z" }],
    [`repos/example-owner/example-core/commits/${loose}/pulls`]: [{ number: 41, merged_at: null }],
    "repos/example-owner/example-core/collaborators/example-outsider/permission": right("example-outsider", "read", "read"),
    "repos/example-owner/example-core/collaborators/example-writer/permission": right("example-writer", "maintain", "write"),
  };
  const asked = [];
  const ask = route => { asked.push(route); if (!(route in host)) throw new Error("HTTP 404"); return JSON.stringify(host[route]); };
  const got = closesRead("example-owner/example-core", [11, 12, 13, 14, 15, 16, 17, 18], ask);
  ok(!got.counted.has(11) && got.other.includes(11), "a close by an account that cannot write is not counted", JSON.stringify(got));
  ok(got.counted.has(12) && !asked.some(r => r.endsWith("/example-merger/permission")), "a close a merged pull request made is counted, by the merge alone", JSON.stringify(got));
  ok(got.counted.has(13), "a close by an account that can write is counted", JSON.stringify(got));
  ok(!got.counted.has(16) && got.other.includes(16), "a commit no merged pull request brought in counts for nothing: its closer's right decides", JSON.stringify(got));
  const why = n => got.unread.find(u => u.number === n)?.why ?? "";
  ok(!got.counted.has(14) && /who closed it could not be read/.test(why(14)) && !got.counted.has(15) && /right .* could not be read/.test(why(15)), "a close whose actor, or the actor's right, cannot be read is not counted, and is named unread", JSON.stringify(got.unread));
  ok(/events/.test(why(17)) && /events/.test(why(18)), "an issue whose events cannot be read, or hold no close, is not counted, and is named unread", JSON.stringify(got.unread));
  ok([...got.counted].join() === "12,13" && got.other.join() === "11,16", "nothing else is counted", JSON.stringify(got));
  const said = dueness({ release, lines: [11, 12, 13, 14], trialed: null }, got.counted, "2026-11-12T00:00:00Z", got).said;
  ok(/2 lines of QUEUE\.md merged .*: #12, #13; not counted, closed by no merge and no account that can write: #11, #16; not counted, since who made its close could not be read: #14 \(who closed it could not be read\).*Mend: /.test(said), "the count names the closes it did not count, those unread with their mend", said);
  ok(throws(() => closesRead("not a repo", [1], ask)), "a name that is no repository's throws");
  const both = closesSince("example-owner/example-core", release.at, [11, 13, 99], route => route.includes("/issues?") ? JSON.stringify([11, 13, 20].map(number => ({ number, state: "closed", state_reason: "completed", closed_at: "2026-11-11T00:00:00Z" }))) : ask(route));
  ok([...both.counted].join() === "13" && both.other.join() === "11" && !both.unread.length, "only the queue's lines closed after the release have their closes read", JSON.stringify(both));
  ok(throws(() => closesSince("example-owner/example-core", release.at, [11], () => { throw new Error("HTTP 502"); })), "where GitHub gives no answer at all, the reading throws, as an unread host does");
}

// ---- the scheduled look's issue ----
const ctx = { manifest: null, at: "2026-11-20T00:00:00Z", repo: "example-owner/example-core" };
const read = () => ({ release, lines, trialed: null });
const all = () => ({ counted: new Set(lines), unread: [], other: [] });
const issue = dueIssue(ctx, read, all);
ok(DUE.includes(dueIssue), "the scheduled look reads it");
ok(issue.title === TITLE && issue.owner === false && /trial-brief\.mjs/.test(issue.body) && /release\.mjs --trial/.test(issue.body) && /next batch/.test(issue.body), "while one is due, the look keeps a queued issue that says how the trial is run and recorded", issue.body);
ok(dueIssue(ctx, read, () => ({ counted: new Set(), unread: [], other: [] })).body === null, "once none is due, the look closes it");
const someUnread = dueIssue(ctx, read, () => ({ counted: new Set(lines.slice(0, LINES)), unread: [{ number: 12, why: "who closed it could not be read" }], other: [11] }));
ok(/#12 \(who closed it could not be read\)/.test(someUnread.body ?? "") && /Mend: /.test(someUnread.body ?? ""), "the look's issue names a close it could not read, with its mend", someUnread.body);
const unread = dueIssue(ctx, () => { throw new Error("no tags here"); });
ok(unread.body === null && /could not be read: no tags here/.test(unread.unread), "where git or GitHub cannot be read, the issue is left as it stands, saying why");
const untagged = dueIssue(ctx, () => null, all);
ok(untagged.body === null && /holds no tags/.test(untagged.unread ?? ""), "a checkout with no release tag, in a core that has cut releases, leaves the issue as it stands", JSON.stringify(untagged));
ok(dueIssue({ ...ctx, manifest: "# Core manifest\n" }, read, all) === null, "in a project, which cuts no release, nothing is read");

console.log(`${count} assertions on whether a release's trial is due`);
if (failed) { console.error(`${failed} failed`); process.exitCode = 1; }
