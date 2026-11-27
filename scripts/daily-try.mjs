// The daily try (#1413, point 5; AGENTS.md, "The owner's own projects try the core each day"): once a day, jobs of the
// core's scheduled look (.github/workflows/own-look.yml) try the core at main's newest commit whose checks all passed
// (releases.mjs, greenMain) on each of the owner's own projects that take it, as a release's trial does (#1084): each
// project alone, on a fresh runner of its own that holds no other project's clone, in a scratch clone, its checks run
// before the sync and after it (check.mjs --own --verdicts), the two set side by side as the trial sets them
// (release-trial.mjs, compared), and a project held where the trial's record would hold a cut (trialAt). Nothing is
// written to any project: the clone holds no sign-in, nothing is pushed, and no draft is opened (the drafts stay at a
// release's trial, #1334). A project of another owner is never tried here. What it prints, writes and files is counts
// and conclusions alone: the core's logs are public, so every project's name is masked in GitHub's log and each
// project's runner is known by a number, the output of the project's own checks stays in files on that runner, and the
// bug it files names no project; a session where gh answers for the owner's account runs --local to see which project
// each number was, which runs no project's code. Git, gh and Node's own modules.
//
//   node scripts/daily-try.mjs --green                  the commit to try: main's newest whose checks all passed
//   node scripts/daily-try.mjs --list                   the owner's own projects counted (GH_TOKEN: the owner's
//                                                       read-only sign-in, PROJECTS_READ, where given; SIGNED_IN says
//                                                       whether it was), each name masked, no name printed; the counts
//                                                       and the runners' numbers to $GITHUB_OUTPUT
//   node scripts/daily-try.mjs --clone <n> <dir>        the n-th of those projects alone, cloned to <dir> (FOUND: how
//                                                       many --list found; none where the list changed since)
//   node scripts/daily-try.mjs --run <dir> <core>       that clone tried at the core checked out at <core>, given no
//                                                       sign-in; its counts printed as one line, for the runner LEG
//   node scripts/daily-try.mjs --file                   each runner's line read from its job's log, the counts summed
//                                                       and filed: a bug where a project was held, and the issue for
//                                                       the owner's sign-in where none was given
//   node scripts/daily-try.mjs --local                  in a session: which project each runner of the latest look
//                                                       tried, from gh's own sign-in, named here alone; it runs no
//                                                       project's code and writes nothing on GitHub
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { readCore, manifestText } from "./core-path.mjs";
import { parseBounded } from "./guards.mjs";
import { ghApi, pagesOf } from "./labels.mjs";
import { BOT, LABELS, OWNERS, text } from "./look-keep.mjs";
import { greenMain } from "./releases.mjs";
import { COUNTS, trialAt, trialRecord } from "./release-trial.mjs";
import { started } from "./started.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const OWNER = CORE.split("/")[0];
export const SECRET = "PROJECTS_READ";
export const TITLE = "The daily try held the core";
export const SIGNIN = "The daily try reads none of the owner's private projects";
// The line each project's runner prints for --file, which reads it back from that job's log.
export const LINE = "daily-try counts: ";
const SHA = /^[0-9a-f]{40}$/u, DAY = /^\d{4}-\d\d-\d\d$/u;
const MINUTES = 25;
// The limits of what it reads (SECURITY.md, rule 5): a manifest of 1 MB, GitHub's own for a file's content, past which
// a repository is no project of the core's; a file of verdicts of 16 MB, past which it is read as none written; a
// runner's line of counts of 4 KB, past which it is in no form; a runner's job log of 16 MB, past which its line is read
// as none; and 256 runners, GitHub's most for one matrix, the projects past them not tried.
// (CHECKS_MAX: the most checks one runner's pair of runs may count in a class, so no runner's line can push the sum
// past what formed reads and stop the filing for every project)
export const CHECKS_MAX = 10000, MANIFEST_MAX = 1 << 20, VERDICTS_MAX = 16 << 20, COUNTS_MAX = 4096, LOG_MAX = 16 << 20, LEGS_MAX = 256;
// The counts --file sums and files, each a whole number: the projects found and how many of them are private; those
// tried; those already at the commit; those whose run before wrote no verdicts (the copy's check, not the commit's, so
// untried), with those whose runner said nothing; those whose sync to the commit failed, or whose run after wrote no
// verdicts (the commit's, each held); and those the trial's reading holds.
export const TALLY = ["found", "private", "tried", "atPin", "untried", "syncFailed", "afterUnread", "held"];
// What one project's try came to, as its runner's line says it.
export const CAME = ["tried", "held", "atPin", "untried", "syncFailed", "afterUnread"];

// The owner's own projects that take the core, as state-report.mjs --projects finds them, kept to the repositories the
// owner's account owns (never another owner's, tried only at a release): with the owner's sign-in, every one it owns;
// without, its public ones; in the order of their names, so that each runner's number names the same project in each
// reading. Each { name, private }. GitHub's answer that a repository holds no manifest (404) means "not a project"; any
// other failure throws, so that a reading not taken is never taken for none.
export function owned(signedIn, gh = ghApi, owner = OWNER) {
  const listed = signedIn ? pagesOf("user/repos?affiliation=owner", gh) : pagesOf(`users/${owner}/repos?type=owner`, gh);
  const found = [];
  for (const r of listed) {
    const name = String(r?.full_name ?? "");
    if (String(r?.owner?.login ?? "").toLowerCase() !== owner.toLowerCase() || name.toLowerCase() === CORE.toLowerCase() || r.archived) continue;
    let manifest;
    try { const content = parseBounded(gh(`repos/${name}/contents/core-manifest.md`))?.content; manifest = typeof content === "string" ? Buffer.from(content, "base64").toString("utf8") : ""; }
    catch (e) { if (/\(HTTP 404\)\s*$/u.test(String(e?.message).trim())) continue; throw e; }
    if (manifest.length > MANIFEST_MAX) continue;
    if (readCore(manifest).form) found.push({ name, private: !!r.private });
  }
  return found.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
}

// Each name masked in GitHub's log before anything else is printed, in a job of GitHub's alone.
function mask(projects, say, actions) {
  if (actions) for (const p of projects) for (const n of new Set([p.name, p.name.split("/")[1]])) say(`::add-mask::${n}`);
}

// --list: the projects found, counted, each name masked; what the jobs after it take, as GitHub's step outputs (`out`):
// the counts and the runners' numbers, 1 to the projects found, at most LEGS_MAX. Nothing is cloned here.
export function list({ signedIn, gh = ghApi, say = console.log, out = () => {}, actions = process.env.GITHUB_ACTIONS === "true" } = {}) {
  const found = owned(signedIn, gh);
  mask(found, say, actions);
  const legs = Array.from({ length: Math.min(found.length, LEGS_MAX) }, (_, i) => i + 1);
  for (const [k, v] of Object.entries({ found: found.length, private: found.filter(p => p.private).length, signed: !!signedIn, legs: JSON.stringify(legs) })) out(`${k}=${v}`);
  say(`The daily try found ${found.length} of the owner's own projects that take the core (${signedIn ? `${found.filter(p => p.private).length} private` : `the public ones alone, the private ones wanting the owner's sign-in ${SECRET}`}); each is tried on a runner of its own${found.length > LEGS_MAX ? `, the first ${LEGS_MAX} alone` : ""}.`);
  return { found, legs };
}

// git with the sign-in passed through git's environment for that one call, never in its arguments or a file the clone
// keeps, so the clone holds none and nothing can be pushed from it.
function clone(name, into, token, url = n => `https://github.com/${n}.git`) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  if (token) Object.assign(env, { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader", GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}` });
  return spawnSync("git", ["clone", "--quiet", "--no-tags", url(name), into], { env, stdio: "ignore", timeout: 10 * 60000 }).status === 0;
}

// --clone: the `leg`-th project alone cloned to `into`, its name masked first; none where the list no longer holds the
// `expected` projects --list found, so that the number never names another project. Whether it was cloned.
export function cloneLeg(leg, into, { signedIn, token, expected, gh = ghApi, url, say = console.log, actions = process.env.GITHUB_ACTIONS === "true" } = {}) {
  const found = owned(signedIn, gh);
  mask(found, say, actions);
  const p = found.length === expected ? found[leg - 1] : undefined;
  const cloned = !!p && clone(p.name, into, token, url);
  say(cloned ? `Runner ${leg}: its project cloned.` : `Runner ${leg}: nothing cloned (${p ? "the clone failed" : `the owner's projects are no longer the ${expected} found`}), so it is counted as not tried.`);
  return cloned;
}

// The environment the project's own code runs with: no sign-in of any kind, and none of the files through which a step
// of GitHub's writes its outputs, its summary or a later step's environment.
export const BARE = /TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|^PROJECTS_READ$|^GH_|^PERSONAL_TERMS$|^GIT_CONFIG|^ACTIONS_|^GITHUB_(OUTPUT|ENV|PATH|STATE|STEP_SUMMARY)$/u;
const bare = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !BARE.test(k)));

// A command in `cwd`, its output to the file `log` alone; whether it exited 0.
export function runLogged(cmd, args, cwd, log, env = bare()) {
  const fd = fs.openSync(log, "a");
  try { return spawnSync(cmd, args, { cwd, env, stdio: ["ignore", fd, fd], timeout: MINUTES * 60000 }).status === 0; } finally { fs.closeSync(fd); }
}

const readJson = file => { try { if (fs.statSync(file).size > VERDICTS_MAX) return null; const v = parseBounded(fs.readFileSync(file, "utf8")); return v !== null && typeof v === "object" ? v : null; } catch { return null; } };

// Whether the trial's reading holds a pair of runs, [before, after], as its record would hold a release's cut: the
// trial's own judgement (release-trial.mjs, trialAt), on a record of that one project, so that what holds is one fact.
export function holds(pair, sha) {
  const record = trialRecord(sha, "2000-01-01", [pair], [{ pure: true, from: "main" }], [{ none: "another-owner" }]);
  return trialAt(sha, args => (args[0] === "show" ? JSON.stringify(record) : "")).held !== null;
}

// The scripts a project's run before the sync takes, and its sync: the copy's own where it has them (its check where it
// writes verdicts), else those of the core under try, as a release's trial takes them.
function scriptsOf(at, copy, core) {
  const own = copy.path ? path.join(at, copy.path, "scripts") : null, theirs = name => (own && fs.existsSync(path.join(own, name)) ? path.join(own, name) : null);
  const check = theirs("check.mjs");
  return {
    before: check && fs.readFileSync(check, "utf8").includes("--verdicts") ? check : path.join(core, "scripts", "check.mjs"),
    sync: theirs("sync.mjs") ?? path.join(core, "scripts", "sync.mjs"),
  };
}

// One project, cloned at `at`, tried at the core checked out at `core` (its commit `sha`): the run before, the sync, the
// run after, each output to the log `project.log` in `out`, outside the clone. What it came to: "atPin", "untried",
// "syncFailed", "afterUnread", or the pair, held or not.
export function tryOne(at, core, sha, out, run = runLogged) {
  const log = path.join(out, "project.log");
  const manifest = manifestText(path.join(at, "core-manifest.md"));
  const copy = readCore(manifest ?? "");
  if (copy.pin === sha) return { came: "atPin" };
  const scripts = scriptsOf(at, copy, core);
  const main = (spawnSync("git", ["rev-parse", "HEAD"], { cwd: at, encoding: "utf8" }).stdout ?? "").trim();
  run(process.execPath, [path.join(core, "scripts", "toolchain.mjs"), at], at, log);
  const check = (script, file) => run(process.execPath, [script, "--base", main, "--own", "--verdicts", file], at, log);
  const before = path.join(out, "before.json"), after = path.join(out, "after.json");
  check(scripts.before, before);
  if (!readJson(before)) return { came: "untried" };
  const synced = run("git", ["switch", "--quiet", "-c", "daily-try"], at, log)
    && run(process.execPath, [scripts.sync, sha], at, log)
    && run("git", ["add", "-A"], at, log)
    && run("git", ["-c", "user.name=daily-try", "-c", "user.email=daily-try@example.invalid", "commit", "--quiet", "--no-verify", "-m", "The daily try's sync (never pushed)"], at, log);
  if (!synced) return { came: "syncFailed" };
  check(path.join(core, "scripts", "check.mjs"), after);
  const pair = [readJson(before), readJson(after)];
  if (!pair[1]) return { came: "afterUnread" };
  return { came: holds(pair, sha) ? "held" : "tried", pair };
}

// --run: the one project its runner cloned to `dir`/project tried at the core `core`, and that runner's counts, numbers
// and the commit alone: what it came to, and the trial's classes of its pair of runs.
export function runLeg(dir, core, leg, { run = runLogged, sha = (spawnSync("git", ["rev-parse", "HEAD"], { cwd: core, encoding: "utf8" }).stdout ?? "").trim() } = {}) {
  const at = path.join(dir, "project");
  const r = fs.existsSync(at) ? tryOne(at, core, sha, dir, run) : { came: "untried" };
  const counts = trialRecord(sha, "2000-01-01", r.pair ? [r.pair] : []);
  return { leg, commit: sha, came: r.came, ...Object.fromEntries(COUNTS.map(k => [k, counts[k]])) };
}

// Whether a runner's counts are in the form --run prints: its number within the `found` (at most LEGS_MAX), the
// commit tried, what it came to, and the trial's classes as whole numbers.
export function legFormed(l, sha, found) {
  return l !== null && typeof l === "object" && Number.isSafeInteger(l.leg) && l.leg >= 1 && l.leg <= Math.min(found, LEGS_MAX)
    && l.commit === sha && CAME.includes(l.came) && COUNTS.every(k => Number.isSafeInteger(l[k]) && l[k] >= 0 && l[k] <= CHECKS_MAX);
}

// The counts --file files, from the runners' `lines` (each { leg, text }: the runner's number and the text after the
// last LINE of its log) and what --list found: a runner's line read only where it is in form and gives that runner's
// own number, and a runner with none (it failed, timed out, or said nothing) counted as not tried.
export function gather(lines, { sha, day, signedIn, found, privates }) {
  const by = new Map();
  for (const { leg, text } of lines) {
    let l = null;
    try { l = typeof text !== "string" || text.length > COUNTS_MAX ? null : parseBounded(text); } catch { l = null; }
    if (legFormed(l, sha, found) && l.leg === leg) by.set(leg, l);
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

const fail = why => { console.error(`FAIL ${why}`); return 1; };
const toOutput = line => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`); };
const whole = v => (/^\d+$/u.test(String(v)) ? Number(v) : NaN);
const UNREAD = "GitHub gave no answer, or none that could be read, for the owner's repositories or a manifest, so no project was found (not none found). Mend: start the job again; where it fails each day, see whether the owner's sign-in has expired.";

// --file: what --list found (FOUND, PRIVATE, SIGNED_IN), the commit (SHA), and the runners' lines of this run (RUN_ID,
// RUN_ATTEMPT), each held to its form before anything is written.
function fileFromEnv(env = process.env) {
  const found = whole(env.FOUND), privates = whole(env.PRIVATE);
  if (!SHA.test(String(env.SHA)) || !(found <= 1e6) || !(privates <= found) || !/^\d+$/u.test(`${env.RUN_ID}${env.RUN_ATTEMPT}`)) throw new Error("the daily try's counts are in no form --list writes");
  const lines = found ? legLines(env.RUN_ID, env.RUN_ATTEMPT) : [];
  file(gather(lines, { sha: env.SHA, day: new Date().toISOString().slice(0, 10), signedIn: env.SIGNED_IN === "true", found, privates }));
}

// --local: the project each runner of the latest finished look tried, named from gh's own sign-in, and what it came to;
// no project's code is run and nothing is written.
function local(gh = ghApi, say = console.log) {
  const run = parseBounded(gh(`repos/${CORE}/actions/workflows/own-look.yml/runs?branch=main&status=completed&per_page=1`))?.workflow_runs?.[0];
  if (!Number.isSafeInteger(run?.id)) { say("No finished run of the scheduled look to read."); return; }
  const found = owned(true, gh), by = new Map(legLines(run.id, run.run_attempt ?? 1, { gh }).map(l => [l.leg, l.text]));
  say(`The look of ${String(run.created_at).slice(0, 10)}: ${found.length} of the owner's own projects found now, in the order each runner took them${by.size > found.length ? `; it tried ${by.size}, so the list has changed and a number may name another project` : ""}.`);
  for (const [i, p] of found.entries()) {
    let l = null;
    try { l = parseBounded(by.get(i + 1) ?? "null"); } catch { l = null; }
    say(`- runner ${i + 1}, ${p.name}: ${l?.came ?? "said nothing (not tried)"}${l?.commit ? ` at ${String(l.commit).slice(0, 7)}` : ""}`);
  }
}

// Each command (the script's head), by its flag; each takes the command's arguments and gives the exit code.
const COMMANDS = {
  // (no commit to try is no failure: it prints nothing, and the try's steps after it do not run)
  "--green": () => { const g = greenMain(ROOT); if (g.sha) console.log(g.sha); else console.error(`${g.said}: nothing to try today; the next day's run tries again.`); return 0; },
  "--list": () => {
    try { list({ signedIn: process.env.SIGNED_IN === "true", out: toOutput }); return 0; } catch { return fail(UNREAD); }
  },
  "--clone": ([leg, dir]) => {
    const signedIn = process.env.SIGNED_IN === "true", n = whole(leg), expected = whole(process.env.FOUND);
    if (!(n >= 1 && n <= LEGS_MAX) || Number.isNaN(expected)) return fail("it takes the runner's number, 1 to 256, and FOUND, how many --list found. Mend: give them, as the script's head says.");
    try { cloneLeg(n, path.resolve(dir), { signedIn, token: signedIn ? process.env.GH_TOKEN : undefined, expected }); return 0; } catch { return fail(UNREAD); }
  },
  "--run": ([dir, core]) => {
    const leg = whole(process.env.LEG);
    if (!(leg >= 1 && leg <= LEGS_MAX)) return fail("it takes LEG, the runner's number, 1 to 256. Mend: set it from the job's matrix, as own-look.yml does.");
    console.log(`${LINE}${JSON.stringify(runLeg(path.resolve(dir), path.resolve(core), leg))}`);
    return 0;
  },
  "--file": () => {
    try { fileFromEnv(); return 0; } catch (e) { return fail(`${e.message}. Mend: read the try's jobs' logs for their counts; start the look again once they give them.`); }
  },
  "--local": () => { try { local(); return 0; } catch { return fail(UNREAD); } },
};
// How many arguments each takes, at least and at most.
const ARITY = { "--green": [0, 0], "--list": [0, 0], "--clone": [2, 2], "--run": [2, 2], "--file": [0, 0], "--local": [0, 0] };

function main([what, ...args]) {
  const [least, most] = Object.hasOwn(ARITY, what) ? ARITY[what] : [1, 0];
  if (args.length < least || args.length > most) return fail("it takes --green, --list, --clone <n> <dir>, --run <dir> <core>, --file or --local. Mend: give one of them, as the script's head says.");
  return COMMANDS[what](args);
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
