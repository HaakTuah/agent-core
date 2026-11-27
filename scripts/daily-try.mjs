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
import { LEGS_MAX, LINE, OWNER, SECRET, SHA, file, gather, legLines, legOf } from "./daily-try-file.mjs";
import { ghApi, pagesOf } from "./labels.mjs";
import { greenMain } from "./releases.mjs";
import { COUNTS, trialAt, trialRecord } from "./release-trial.mjs";
import { started } from "./started.mjs";
import { pinned } from "./toolchain.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MINUTES = 25;
// The limits of what the runners read (SECURITY.md, rule 5): a manifest of 1 MB, GitHub's own for a file's content,
// past which a repository is no project of the core's; and a file of verdicts of 16 MB, past which it is read as none
// written. Those of the runners' lines: daily-try-file.mjs.
const MANIFEST_MAX = 1 << 20, VERDICTS_MAX = 16 << 20;

// The owner's own projects that take the core, as state-report.mjs --projects finds them, kept to the repositories the
// owner's account owns, never a fork of another's (never another owner's, tried only at a release): with the owner's sign-in, every one it owns;
// without, its public ones; in the order of their names, so that each runner's number names the same project in each
// reading. Each { name, private }. GitHub's answer that a repository holds no manifest (404) means "not a project"; any
// other failure throws, so that a reading not taken is never taken for none.
export function owned(signedIn, gh = ghApi, owner = OWNER) {
  const listed = signedIn ? pagesOf("user/repos?affiliation=owner", gh) : pagesOf(`users/${owner}/repos?type=owner`, gh);
  const found = [];
  for (const r of listed) {
    const name = String(r?.full_name ?? "");
    if (!ownRepo(r, name, owner, gh)) continue;
    let manifest;
    try { const content = parseBounded(gh(`repos/${name}/contents/core-manifest.md`))?.content; manifest = typeof content === "string" ? Buffer.from(content, "base64").toString("utf8") : ""; }
    catch (e) { if (/\(HTTP 404\)\s*$/u.test(String(e?.message).trim())) continue; throw e; }
    if (manifest.length > MANIFEST_MAX) continue;
    if (readCore(manifest).form) found.push({ name, private: !!r.private });
  }
  return found.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
}

// Whether a repository the owner's account holds is the owner's own all the way back: one that is no fork, or a fork
// whose parent and source the owner's account owns too, as GitHub's own answer for it says. A fork of another's, or one
// whose answer says nothing of either, is not (#1459). Any failure to read throws, as above.
function ownFork(name, owner, gh) {
  const r = parseBounded(gh(`repos/${name}`));
  if (r?.fork === false) return true;
  const is = x => String(x?.owner?.login ?? "").toLowerCase() === owner.toLowerCase();
  return r?.fork === true && is(r.parent) && is(r.source);
}

// Whether a listed repository may be one of the owner's projects: the owner's account's, not the core, not archived,
// and the owner's own all the way back.
function ownRepo(r, name, owner, gh) {
  if (String(r?.owner?.login ?? "").toLowerCase() !== owner.toLowerCase() || name.toLowerCase() === CORE.toLowerCase() || r.archived) return false;
  return r.fork === false || ownFork(name, owner, gh);
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

// The toolchain the project at `at` pins, fetched as a release's trial fetches it (toolchain.mjs), what it said to the
// log `log`: what the project's runs are to set (none where nothing was fetched, and the job that needs it then reads
// alike before and after).
function toolsFor(at, log) {
  let t;
  try { t = pinned({ project: at, env: bare() }); } catch (e) { t = { lines: [`NOT FETCHED: the toolchain (${e.message})`], vars: null }; }
  fs.appendFileSync(log, `${t.lines.join("\n")}\n`);
  return t.vars ?? {};
}

// One project, cloned at `at`, tried at the core checked out at `core` (its commit `sha`): the toolchain it pins, then
// the run before, the sync, the run after, each given what the toolchain says to set, each output to the log
// `project.log` in `out`, outside the clone. What it came to: "atPin", "untried", "syncFailed", "afterUnread", or the
// pair, held or not.
export function tryOne(at, core, sha, out, run = runLogged, tools = toolsFor) {
  const log = path.join(out, "project.log");
  const manifest = manifestText(path.join(at, "core-manifest.md"));
  const copy = readCore(manifest ?? "");
  if (copy.pin === sha) return { came: "atPin" };
  const scripts = scriptsOf(at, copy, core);
  const main = (spawnSync("git", ["rev-parse", "HEAD"], { cwd: at, encoding: "utf8" }).stdout ?? "").trim();
  const env = { ...bare(), ...tools(at, log) }, go = (cmd, args) => run(cmd, args, at, log, env);
  const check = (script, file) => go(process.execPath, [script, "--base", main, "--own", "--verdicts", file]);
  const before = path.join(out, "before.json"), after = path.join(out, "after.json");
  check(scripts.before, before);
  if (!readJson(before)) return { came: "untried" };
  const synced = go("git", ["switch", "--quiet", "-c", "daily-try"])
    && go(process.execPath, [scripts.sync, sha])
    && go("git", ["add", "-A"])
    && go("git", ["-c", "user.name=daily-try", "-c", "user.email=daily-try@example.invalid", "commit", "--quiet", "--no-verify", "-m", "The daily try's sync (never pushed)"]);
  if (!synced) return { came: "syncFailed" };
  check(path.join(core, "scripts", "check.mjs"), after);
  const pair = [readJson(before), readJson(after)];
  if (!pair[1]) return { came: "afterUnread" };
  return { came: holds(pair, sha) ? "held" : "tried", pair };
}

// --run: the one project its runner cloned to `dir`/project tried at the core `core`, and that runner's counts, numbers
// and the commit alone: what it came to, and the trial's classes of its pair of runs.
export function runLeg(dir, core, leg, { run = runLogged, tools, sha = (spawnSync("git", ["rev-parse", "HEAD"], { cwd: core, encoding: "utf8" }).stdout ?? "").trim() } = {}) {
  const at = path.join(dir, "project");
  const r = fs.existsSync(at) ? tryOne(at, core, sha, dir, run, tools) : { came: "untried" };
  const counts = trialRecord(sha, "2000-01-01", r.pair ? [r.pair] : []);
  return { leg, commit: sha, came: r.came, ...Object.fromEntries(COUNTS.map(k => [k, counts[k]])) };
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

// --local: the project each runner of the latest finished look tried, named from gh's own sign-in, and what it came to,
// each runner's line held to the form --file reads (daily-try-file.mjs, legOf), so that what a project's code printed in
// the public log reaches the session as one of the words CAME holds and a commit, or as nothing; no project's code is
// run and nothing is written.
export function local(gh = ghApi, say = console.log) {
  const run = parseBounded(gh(`repos/${CORE}/actions/workflows/own-look.yml/runs?branch=main&status=completed&per_page=1`))?.workflow_runs?.[0];
  if (!Number.isSafeInteger(run?.id) || !Number.isSafeInteger(run?.run_attempt ?? 1)) { say("No finished run of the scheduled look to read."); return; }
  const found = owned(true, gh), by = new Map(legLines(run.id, run.run_attempt ?? 1, { gh }).map(l => [l.leg, l.text]));
  const day = /^\d{4}-\d\d-\d\d/u.exec(String(run.created_at))?.[0] ?? "an unknown day";
  say(`The look of ${day}: ${found.length} of the owner's own projects found now, in the order each runner took them${by.size > found.length ? `; it tried ${by.size}, so the list has changed since and a number may name another project` : ""}.`);
  for (const [i, p] of found.entries()) {
    const l = legOf(by.get(i + 1), i + 1, found.length);
    say(`- runner ${i + 1}, ${p.name}: ${l ? `${l.came} at ${l.commit.slice(0, 7)}` : "said nothing in form (not tried)"}`);
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
