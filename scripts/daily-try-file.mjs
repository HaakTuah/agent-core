// The daily try's counts (#1413, point 5; scripts/daily-try.mjs, whose jobs these are): the line each project's runner
// prints at the end of its log, how the filing job reads it back from each runner's own log alone and sums the runners'
// counts, and what it files from them on GitHub: counts and conclusions alone, naming no project. gh and Node's own
// modules.
import { spawnSync } from "node:child_process";
import { CORE } from "./core-address.mjs";
import { parseBounded } from "./guards.mjs";
import { ghApi, pagesOf } from "./labels.mjs";
import { BOT, LABELS, OWNERS, text } from "./look-keep.mjs";
import { COUNTS } from "./release-trial.mjs";

export const OWNER = CORE.split("/")[0];
export const SECRET = "PROJECTS_READ";
export const TITLE = "The daily try held the core";
export const SIGNIN = "The daily try reads none of the owner's private projects";
// The line each project's runner prints for --file, which reads it back from that job's log.
export const LINE = "daily-try counts: ";
export const SHA = /^[0-9a-f]{40}$/u;
const DAY = /^\d{4}-\d\d-\d\d$/u;
// The limits of what is read here (SECURITY.md, rule 5): a runner's line of counts of 4 KB, past which it is in no
// form, and 10,000 of each count in it (CHECKS_MAX: the most checks one runner's pair of runs may count in a class, so
// no runner's line can push the sum past what formed reads and stop the filing for every project); a runner's job log
// of 16 MB, past which its line is read as none; and 256 runners, GitHub's most for one matrix, the projects past them
// not tried.
export const CHECKS_MAX = 10000, COUNTS_MAX = 4096, LOG_MAX = 16 << 20, LEGS_MAX = 256;
// The counts --file sums and files, each a whole number: the projects found and how many of them are private; those
// tried; those already at the commit; those whose run before wrote no verdicts (the copy's check, not the commit's, so
// untried), with those whose runner said nothing; those whose sync to the commit failed, or whose run after wrote no
// verdicts (the commit's, each held); and those the trial's reading holds.
export const TALLY = ["found", "private", "tried", "atPin", "untried", "syncFailed", "afterUnread", "held"];
// What one project's try came to, as its runner's line says it.
export const CAME = ["tried", "held", "atPin", "untried", "syncFailed", "afterUnread"];

// Whether a runner's counts are in the form --run prints: its number within the `found` (at most LEGS_MAX), the
// commit tried (`sha`, or any commit where none is given), what it came to, and the trial's classes as whole numbers.
export function legFormed(l, sha, found) {
  return l !== null && typeof l === "object" && Number.isSafeInteger(l.leg) && l.leg >= 1 && l.leg <= Math.min(found, LEGS_MAX)
    && (sha ? l.commit === sha : SHA.test(String(l.commit))) && CAME.includes(l.came) && COUNTS.every(k => Number.isSafeInteger(l[k]) && l[k] >= 0 && l[k] <= CHECKS_MAX);
}

// The counts of the runner `leg` from the text after its log's last LINE, or null where they are in no form or are
// another runner's: read only to COUNTS_MAX, whoever reads them (--file to sum them, --local to show them).
export function legOf(text, leg, found, sha = null) {
  let l = null;
  try { l = typeof text !== "string" || text.length > COUNTS_MAX ? null : parseBounded(text); } catch { l = null; }
  return legFormed(l, sha, found) && l.leg === leg ? l : null;
}

// The counts --file files, from the runners' `lines` (each { leg, text }: the runner's number and the text after the
// last LINE of its log) and what --list found: a runner's line read only where it is in form and gives that runner's
// own number, and a runner with none (it failed, timed out, or said nothing) counted as not tried.
export function gather(lines, { sha, day, signedIn, found, privates }) {
  const by = new Map();
  for (const { leg, text } of lines) {
    const l = sha ? legOf(text, leg, found, sha) : null;
    if (l) by.set(leg, l);
  }
  const t = { commit: sha, day, signedIn: !!signedIn, ...Object.fromEntries([...TALLY, ...COUNTS].map(k => [k, 0])), found, private: privates };
  t.untried += Math.max(0, found - LEGS_MAX);
  for (let leg = 1; leg <= Math.min(found, LEGS_MAX); leg++) {
    const l = by.get(leg);
    if (!l) { t.untried++; continue; }
    t[l.came]++;
    if (l.came === "held") t.tried++;
    for (const k of COUNTS) t[k] += l[k];
  }
  return t;
}

// The runners' lines of the look's run `run` (its attempt `attempt`): for each job of the try's matrix ("try <n>"), its
// number and the text after the last LINE of its log, read through `gh`, which the runner's own script prints after the
// project's code has run; a log past LOG_MAX read as none. GitHub's refusal throws, so that a reading not taken is never
// read as runners that said nothing.
export function legLines(run, attempt, { gh = ghApi, repo = CORE } = {}) {
  const jobs = [];
  for (let page = 1; page <= 3; page++) {
    const got = parseBounded(gh(`repos/${repo}/actions/runs/${run}/attempts/${attempt}/jobs?per_page=100&page=${page}`))?.jobs;
    if (!Array.isArray(got)) throw new Error("GitHub gave no list of the look's jobs");
    jobs.push(...got);
    if (got.length < 100) break;
  }
  const lines = [];
  for (const j of jobs) {
    const m = /^try (\d+)$/u.exec(String(j?.name));
    if (!m || !Number.isSafeInteger(j?.id)) continue;
    const log = String(gh(`repos/${repo}/actions/jobs/${j.id}/logs`));
    const at = log.length > LOG_MAX ? -1 : log.lastIndexOf(LINE);
    if (at >= 0) lines.push({ leg: Number(m[1]), text: log.slice(at + LINE.length).split("\n")[0].trim() });
  }
  return lines;
}

// Whether counts are in the form gather sums; nothing else is read by file, which builds its text from numbers alone.
export function formed(t) {
  return t !== null && typeof t === "object" && SHA.test(String(t.commit)) && DAY.test(String(t.day)) && typeof t.signedIn === "boolean"
    && [...TALLY, ...COUNTS].every(k => Number.isSafeInteger(t[k]) && t[k] >= 0) && t.private <= t.found
    && t.tried + t.atPin + t.untried + t.syncFailed + t.afterUnread === t.found && t.held <= t.tried;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const failing = t => t.held + t.syncFailed + t.afterUnread;

// The bug's text, counts and conclusions alone: the commit, how many projects held it and how, never which.
export function bugText(t) {
  const how = [t.held && `${plural(t.held, "project")} whose checks the trial's reading holds (${t.failedAfter} passed before the sync and failed after, ${t.failedAfterAlone} failed after not run before, ${t.unreadAfter + t.unreadBefore} not measured, ${t.stoppedAfter + t.unrunAfterRan} measured nothing after)`,
    t.syncFailed && `${plural(t.syncFailed, "project")} whose sync to the commit failed`, t.afterUnread && `${plural(t.afterUnread, "project")} whose run after the sync wrote no verdicts`].filter(Boolean);
  return `The daily try of ${t.day} held the core at ${t.commit}, main's newest commit whose checks all passed: of ${plural(t.found, "project")} of the owner's own that take the core (${t.private} private), ${t.tried} tried, ${t.atPin} already at it and ${t.untried} not tried; ${how.join("; ")}.\n\nThe projects are not named here, since the core is public (floor rules 4 and 11), and each was tried on a runner known by its number. Mend: a session where gh answers for the owner's account runs \`node scripts/daily-try.mjs --local\` from a clone of the core, which names, there alone, the project each runner of the latest look tried and what it came to, and runs none of their code; a session started in that project then takes its checks before and after a sync to that commit, in a clone of its own, finds the core's fault, mends it in the core in a pull request of its own that says "Fixes" this issue, and carries nothing of a private project into it but counts and conclusions. A bug, it waits for no line (roles/shared/inbox.md, "Bugs don't wait").`;
}
export const SIGNIN_TEXT = `The daily try (scripts/daily-try.mjs) tries the core each day on the owner's own projects, and without a sign-in it reads only the public ones. Mend, the owner's alone: make a fine-grained personal access token on the owner's account with read-only "Contents" (and the "Metadata" it brings) on the owner's repositories that take the core, and nothing more, and save it as the Actions secret ${SECRET} of ${CORE} (Settings, Secrets and variables, Actions). The next day's try then reads the private ones too and closes this issue. Nothing else waits on it: the public projects are tried meanwhile.`;

// --file: what the counts `t` come to on GitHub, through `write` (gh api's form) and `gh` for reads.
export function file(t, { gh = ghApi, write = ghWrite, say = console.log, repo = CORE } = {}) {
  if (!formed(t)) throw new Error("the daily try's counts are in no form --run writes");
  const open = pagesOf(`repos/${repo}/issues?state=open&labels=by%3Alook&creator=${encodeURIComponent(BOT)}`, gh).filter(i => !i.pull_request);
  const bug = open.find(i => i.title === TITLE), signin = open.find(i => i.title === SIGNIN);
  if (failing(t)) {
    const body = bugText(t);
    if (!bug) { write("POST", `repos/${repo}/issues`, { title: TITLE, body: text(body, "the daily try"), labels: ["bug", ...LABELS], assignees: [OWNER] }); say("Filed: the daily try's bug."); }
    else if (!`${bug.body}\n${pagesOf(`repos/${repo}/issues/${bug.number}/comments`, gh).map(c => c.body).join("\n")}`.includes(t.commit)) { write("POST", `repos/${repo}/issues/${bug.number}/comments`, { body: `From the scheduled look: ${body}` }); say(`Noted on #${bug.number}: the daily try held ${t.commit.slice(0, 7)} too.`); }
    else say(`#${bug.number} already holds the try of ${t.commit.slice(0, 7)}.`);
  } else say(`The daily try held nothing at ${t.commit.slice(0, 7)}.`);
  if (!t.signedIn && !signin) { write("POST", `repos/${repo}/issues`, { title: SIGNIN, body: text(SIGNIN_TEXT, "the daily try"), labels: [OWNERS, LABELS[1]], assignees: [OWNER] }); say("Filed: the owner's sign-in for the daily try."); }
  if (t.signedIn && signin) { write("POST", `repos/${repo}/issues/${signin.number}/comments`, { body: "From the scheduled look: the sign-in is given; the daily try reads the private projects." }); write("PATCH", `repos/${repo}/issues/${signin.number}`, { state: "closed", state_reason: "completed" }); }
}

function ghWrite(method, route, payload) {
  const r = spawnSync("gh", ["api", "-X", method, route, "--input", "-"], { input: JSON.stringify(payload), encoding: "utf8" });
  if (r.status !== 0) throw new Error(`GitHub refused ${method} ${route.replace(/^repos\/[^/]+\/[^/]+\//u, "")}`);
}
