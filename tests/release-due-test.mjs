// Tests of whether a release's trial is due (scripts/release-due.mjs; AGENTS.md, "One batch, then one release";
// #1413, point 4): the lines of QUEUE.md read from the newest release's commit and each version since, the issues
// closed as completed after that commit read from a stand-in for GitHub, each counted only where an account that can
// write, named by the issue itself, or a merged pull request's commit, found in its events, made its close, the trial due at ten lines merged or a week
// with one, never while a trial's record past the release stands, and the scheduled look's issue kept, closed or left
// as it stands. Every repository and name is invented. Git and Node's own modules.
//
//   node tests/release-due-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CLOSES, DAYS, LINES, TITLE, closedSince, closesRead, closesSince, dueIssue, dueness, headed, readGit, routeSaid } from "../scripts/release-due.mjs";
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
let pagesAsked = 0;
{
  const R = "repos/example-owner/example-core", at = "2026-11-11T00:00:00Z", merge = "c".repeat(40), loose = "d".repeat(40);
  const issue = login => ({ number: 1, state: "closed", closed_at: at, closed_by: login === null ? null : { login } });
  const close = (commit_id = null, created_at = at) => ({ event: "closed", actor: { login: "example-anyone" }, commit_id, created_at });
  const right = (login, role_name, permission) => ({ permission, role_name, user: { login, type: "User" } });
  const host = {}, last = {};
  const base = (ref = "main", full_name = "Example-Owner/example-core") => ({ ref, repo: { full_name, default_branch: "main" } });
  const closedBy = (n, login, events, pages = 1) => { host[`${R}/issues/${n}`] = issue(login); last[n] = pages; if (events) host[`${R}/issues/${n}/events?per_page=100&page=${pages}`] = events; };
  closedBy(11, "example-outsider", [close()]);
  closedBy(12, "example-former", [close(merge)]);
  closedBy(13, "example-writer", [close()]);
  closedBy(14, null, [close()]);
  closedBy(15, "example-gone", [close()]);
  closedBy(16, "example-outsider", [close(loose)]);
  closedBy(18, "example-outsider", [{ event: "labeled", created_at: at }, close(null, "2026-11-10T00:00:00Z")]);
  closedBy(19, "example-outsider", [{ event: "labeled", created_at: at }, close(merge)], 3);
  host[`${R}/issues/19/events?per_page=100&page=1`] = Array.from({ length: 100 }, () => ({ event: "mentioned", created_at: "2026-11-10T00:00:00Z" }));
  closedBy(20, "-example-writer", [close()]);
  closedBy(21, "example-app[bot]", [close()]);
  closedBy(22, "example-outsider", [close("e".repeat(40))]);
  host[`${R}/commits/${"e".repeat(40)}/pulls`] = [null, { merged_at: "not a time" }, { merged_at: 0 }, { merged_at: null }];
  closedBy(23, "example-outsider", [close("f".repeat(40))]);
  host[`${R}/commits/${"f".repeat(40)}/pulls`] = [{ merged_at: null, base: base() }, { merged_at: "2026-11-11T00:00:00Z", base: base() }];
  closedBy(24, "example-outsider", null, 25);
  host[`${R}/issues/24/events?per_page=100&page=1`] = [close(merge)];
  for (let p = 2; p <= 25; p++) host[`${R}/issues/24/events?per_page=100&page=${p}`] = Array.from({ length: 100 }, () => ({ event: "mentioned", created_at: at }));
  closedBy(25, "example-outsider", [close(merge, "2026-11-10T00:00:00Z"), { event: "reopened", created_at: "2026-11-10T01:00:00Z" }, close()]);
  closedBy(26, "example-outsider", [close("a".repeat(40))]);
  closedBy(27, "example-writer/../example-writer", [close()]);
  closedBy(28, "example-outsider", null);
  closedBy(29, "example-outsider", null, 3);
  host[`${R}/issues/29/events?per_page=100&page=1`] = [close(merge)];
  closedBy(30, "example-writer", [close()]);
  host[`${R}/issues/30`].closed_at = 0;
  closedBy(31, "abcde/../x[bot]", [close()]);
  host[`${R}/issues/11/events?per_page=100&page=1`] = [null, close()];
  host[`${R}/commits/${merge}/pulls`] = [{ number: 40, merged_at: "2026-11-11T00:00:00Z", base: base() }];
  closedBy(32, "example-outsider", [close("b".repeat(40))]);
  host[`${R}/commits/${"b".repeat(40)}/pulls`] = [{ merged_at: "2026-11-11T00:00:00Z", base: base("side") }, { merged_at: "2026-11-11T00:00:00Z", base: base("main", "example-other/example-core") }, { merged_at: "2026-11-11T00:00:00Z" }, { merged_at: "2026-11-11T00:00:00Z", base: { ref: "main", repo: { default_branch: "main" } } }];
  host[`${R}/commits/${loose}/pulls`] = [{ number: 41, merged_at: null }];
  host[`${R}/collaborators/example-outsider/permission`] = right("example-outsider", "read", "read");
  host[`${R}/collaborators/example-former/permission`] = right("example-former", "read", "read");
  host[`${R}/collaborators/example-writer/permission`] = right("example-writer", "maintain", "write");
  const asked = [];
  const ask = (route, head) => {
    asked.push(route);
    if (!(route in host)) throw new Error("gh could not read the route: Not Found (HTTP 404)");
    const body = JSON.stringify(host[route]), n = /\/issues\/(\d+)\/events/u.exec(route)?.[1];
    return head ? `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nLink: <https://api.github.com/x?per_page=100&page=2>; rel="next", <https://api.github.com/x?per_page=100&page=${last[n]}>; rel="last"\r\n\r\n${body}` : body;
  };
  const numbers = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
  const got = closesRead("example-owner/example-core", numbers, ask);
  const why = n => got.unread.find(u => u.number === n)?.why ?? "";
  ok(!got.counted.has(11) && got.other.includes(11), "a close by an account that cannot write is not counted", JSON.stringify(got));
  ok(got.counted.has(12), "a close a merged pull request's commit made is counted, though its closer can no longer write", JSON.stringify(got));
  ok(got.counted.has(13) && !asked.some(r => r.startsWith(`${R}/issues/13/events`)), "a close by an account that can write is counted, from the issue itself, its events unread", JSON.stringify(got));
  ok(/who closed it could not be read/.test(why(14)) && /right .* could not be read/.test(why(15)), "a close whose closer, or the closer's right, cannot be read is not counted, and is named unread", JSON.stringify(got.unread));
  ok(got.other.includes(16) && got.other.includes(22) && got.counted.has(23), "a commit counts only where a pull request of it holds the time it merged", JSON.stringify(got));
  ok(/from the issue/.test(why(17)), "an issue that cannot be read is not counted, and is named unread", why(17));
  ok(/whether a merged pull request made it/.test(why(18)) && /whether a merged pull request made it/.test(why(26)), "a close not found in the events, or a commit whose pull requests cannot be read, is not counted, and is named unread", JSON.stringify(got.unread));
  ok(got.counted.has(19) && !asked.includes(`${R}/issues/19/events?per_page=100&page=2`), "the events are read from their newest page back, the close found there before the pages before it", asked.filter(r => r.includes("/19/")).join(" "));
  ok(/who closed it/.test(why(20)) && /who closed it/.test(why(27)) && !asked.some(r => r.includes("/collaborators/-") || r.includes("..")), "a closer whose login is out of its form is unread, and reaches no route", JSON.stringify(got.unread));
  ok(got.other.includes(21) && !asked.some(r => r.includes("[bot]")), "a close by an app's account is no writer's: not counted, its right never asked", JSON.stringify(got));
  const of24 = asked.filter(r => r.startsWith(`${R}/issues/24/events`));
  ok(/whether a merged pull request made it/.test(why(24)) && of24.length === 11 && !of24.includes(`${R}/issues/24/events?per_page=100&page=15`), "events past their bound back from the newest page are read no further, and the close is unread", of24.length);
  ok([28, 29].every(n => /whether a merged pull request made it/.test(why(n))), "events that cannot be read, on their first page or on a page back, leave the close unread", JSON.stringify(got.unread));
  ok(/from the issue/.test(why(30)) && /who closed it/.test(why(31)), "a close time out of its form, and an app's login out of its form, leave the close unread", JSON.stringify(got.unread));
  ok(asked.filter(r => r === `${R}/issues/11/events?per_page=100&page=1`).length === 1 && !asked.some(r => r.endsWith("&page=0")), "each page of the events is asked once, and none before the first", asked.filter(r => r.includes("/11/events")).join(" "));
  ok(got.other.includes(32), "a pull request counts only where it merged into the repository's own default branch, as its base says", JSON.stringify(got));
  ok(got.other.includes(25), "the close read is the one the issue names, never an earlier one before a reopening", JSON.stringify(got));
  ok([...got.counted].join() === "12,13,19,23" && got.other.join() === "11,16,21,22,25,32", "nothing else is counted", JSON.stringify(got));
  const said = dueness({ release, lines: numbers, trialed: null }, got.counted, "2026-11-12T00:00:00Z", got).said;
  ok(/4 lines of QUEUE\.md merged .*: #12, #13, #19, #23; not counted, closed by no merge and no account that can write: #11, #16, #21, #22, #25, #32; not counted, since who made its close could not be read: #14 \(who closed it could not be read\), #15 \(the right .*Mend: /.test(said), "the count names the closes it did not count, those unread with their mend", said);
  const plain = dueness({ release, lines: [12], trialed: null }, new Set([12]), "2026-11-12T00:00:00Z").said;
  ok(/: 1 line of QUEUE\.md merged since release-2 \(.*\): #12\.$/.test(plain), "where every close was counted, the count names nothing more", plain);
  const none = dueness({ release, lines: [12], trialed: null }, new Set(), "2026-11-12T00:00:00Z").said;
  ok(/: 0 lines of QUEUE\.md merged since release-2 \([^)]*\)\.$/.test(none), "with none counted, the count names none", none);
  let longName = "";
  try { closesRead("x".repeat(100), [1], ask); } catch (e) { longName = e.message; }
  ok(longName === `${"x".repeat(80)} is no repository's name`, "a name that is no repository's throws, cut short where it is named", longName);
  asked.length = 0;
  ok(closesRead("example-owner/example-core", [0, -1, 1.5, "13"], ask).unread.length === 0 && asked.length === 0 && closesRead("example-owner/example-core", [1], ask).unread.length === 1, "a number out of its form reaches no route; the first issue's does");
  pagesAsked = 0;
  const many = closesRead("example-owner/example-core", Array.from({ length: CLOSES + 1 }, () => 13), r => { pagesAsked++; return ask(r); });
  ok(many.counted.has(13) && many.unread.length === 1 && /past the 100 closes/.test(many.unread[0].why) && pagesAsked === CLOSES * 2, "past the closes one reading takes, the rest are read no further and named unread", `${pagesAsked} ${JSON.stringify(many.unread)}`);
  ok(throws(() => closesRead("example-owner/example-core", [13], () => { throw new Error("gh could not read the route: HTTP 502"); })), "where gh gives no answer at all, the reading throws, as an unread host does");
  const both = closesSince("example-owner/example-core", release.at, [11, 13, 99], (route, head) => route.includes("/issues?") ? JSON.stringify([11, 13, 20].map(number => ({ number, state: "closed", state_reason: "completed", closed_at: at }))) : ask(route, head));
  ok([...both.counted].join() === "13" && both.other.join() === "11" && !both.unread.length, "only the queue's lines closed after the release have their closes read", JSON.stringify(both));
  ok(routeSaid(`${R}/collaborators/example-writer/permission`) === `${R}/collaborators/<login>/permission` && routeSaid(`${R}/issues/1/events?per_page=100&page=2`) === `${R}/issues/1/events`, "a failure names a route without its query, and without the login of a right's route");
  ok(headed("HTTP/1.1 200 OK\nLink: <https://api.github.com/x?page=2>; rel=\"next\"\n\n[]").last === 1 && headed("HTTP/1.1 200 OK\n\n[1]").body.join() === "1" && throws(() => headed("[]")) && headed("HTTP/1.1 200 OK\nX-Not-Link: <https://api.github.com/x?page=9>; rel=\"last\"\nLink: <https://api.github.com/x?page=3>; rel=\"last\"\n\n[]").last === 3, "an answer's head gives its last page, or 1 where its Link names none; an answer with no head is refused");
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
const undecided = dueIssue({ ...ctx, at: "2026-11-12T00:00:00Z" }, () => ({ release, lines, trialed: null }), () => ({ counted: new Set([1]), unread: lines.slice(1).map(number => ({ number, why: "who closed it could not be read" })), other: [] }));
ok(undecided.body === null && /could not be read: who made the closes of #2, #3, .*#12 could not be read, and counted they would make one due .*Mend: /.test(undecided.unread ?? ""), "where the closes it could not read would make a trial due, the look's issue is left as it stands, naming them with their mend", JSON.stringify(undecided));
const longer = dueIssue({ ...ctx, at: "2026-11-12T00:00:00Z" }, () => ({ release, lines: Array.from({ length: 30 }, (_, i) => i + 1), trialed: null }), () => ({ counted: new Set(), unread: Array.from({ length: 25 }, (_, i) => ({ number: i + 1, why: "who closed it could not be read" })), other: [] }));
ok(/#1, #2, .*#20 and 5 more could not be read/.test(longer.unread ?? "") && !/#21/.test(longer.unread), "past twenty, the closes it could not read are counted, not named", longer.unread);
const decided = dueIssue({ ...ctx, at: "2026-11-12T00:00:00Z" }, () => ({ release, lines, trialed: null }), () => ({ counted: new Set([1]), unread: [{ number: 2, why: "who closed it could not be read" }], other: [] }));
ok(decided.body === null && decided.unread === undefined, "where they would not, it closes as before", JSON.stringify(decided));
const unread = dueIssue(ctx, () => { throw new Error("no tags here"); });
ok(unread.body === null && /could not be read: no tags here/.test(unread.unread), "where git or GitHub cannot be read, the issue is left as it stands, saying why");
const untagged = dueIssue(ctx, () => null, all);
ok(untagged.body === null && /holds no tags/.test(untagged.unread ?? ""), "a checkout with no release tag, in a core that has cut releases, leaves the issue as it stands", JSON.stringify(untagged));
ok(dueIssue({ ...ctx, manifest: "# Core manifest\n" }, read, all) === null, "in a project, which cuts no release, nothing is read");

console.log(`${count} assertions on whether a release's trial is due`);
if (failed) { console.error(`${failed} failed`); process.exitCode = 1; }
