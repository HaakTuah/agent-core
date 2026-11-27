// The daily try (#1413, point 5; AGENTS.md, "The owner's own projects try the core each day"): once a day, a job of the
// core's scheduled look (.github/workflows/own-look.yml) tries the core at main's newest commit whose checks all passed
// (releases.mjs, greenMain) on each of the owner's own projects that take it, as a release's trial does (#1084): in a
// scratch clone, the project's checks run before the sync and after it (check.mjs --own --verdicts), the two set side by
// side as the trial sets them (release-trial.mjs, compared), and a project held where the trial's record would hold a
// cut (trialAt). Nothing is written to any project: the clone holds no sign-in, nothing is pushed, and no draft is opened
// (the drafts stay at a release's trial, #1334). A project of another owner is never tried here. What it prints, writes
// and files is counts and conclusions alone: the core's logs are public, so every project's name is masked in GitHub's
// log, the output of the project's own checks stays in files on the runner, and the bug it files names no project; a
// session where gh answers for the owner's account runs --local to see which project and which checks. Git, gh and
// Node's own modules.
//
//   node scripts/daily-try.mjs --green                  the commit to try: main's newest whose checks all passed
//   node scripts/daily-try.mjs --find <dir>             the owner's own projects, cloned under <dir> (GH_TOKEN: the
//                                                       owner's read-only sign-in, PROJECTS_READ, where given; SIGNED_IN
//                                                       says whether it was), a count printed, no name
//   node scripts/daily-try.mjs --run <dir> <core>       each clone tried at the core checked out at <core>; its counts
//                                                       written to <dir>/try.json and printed as one line of JSON
//   node scripts/daily-try.mjs --file                   the counts (TRY) filed: a bug where a project was held, and the
//                                                       issue for the owner's sign-in where none was given
//   node scripts/daily-try.mjs --local [<dir>]          in a session: found, cloned and tried as above, from gh's own
//                                                       sign-in, each project and the checks that held it named here
//                                                       alone, nothing written on GitHub
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { readCore, manifestText } from "./core-path.mjs";
import { parseBounded } from "./guards.mjs";
import { ghApi, pagesOf } from "./labels.mjs";
import { BOT, LABELS, OWNERS, text } from "./look-keep.mjs";
import { greenMain } from "./releases.mjs";
import { COUNTS, compared, trialAt, trialRecord } from "./release-trial.mjs";
import { started } from "./started.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const OWNER = CORE.split("/")[0];
export const SECRET = "PROJECTS_READ";
export const TITLE = "The daily try held the core";
export const SIGNIN = "The daily try reads none of the owner's private projects";
const SHA = /^[0-9a-f]{40}$/u, DAY = /^\d{4}-\d\d-\d\d$/u;
const MINUTES = 25;
// The limits of what it reads (SECURITY.md, rule 5): a manifest of 1 MB, GitHub's own for a file's content, past which
// a repository is no project of the core's; a file of verdicts of 16 MB, past which it is read as none written; and the
// counts --file reads, of 4 KB, past which they are in no form.
export const MANIFEST_MAX = 1 << 20, VERDICTS_MAX = 16 << 20, COUNTS_MAX = 4096;
// The counts --run writes and --file reads, each a whole number: the projects found and how many of them are private;
// those tried; those already at the commit; those whose run before wrote no verdicts (the copy's check, not the
// commit's, so untried); those whose sync to the commit failed, or whose run after wrote no verdicts (the commit's,
// each held); and those the trial's reading holds.
export const TALLY = ["found", "private", "tried", "atPin", "untried", "syncFailed", "afterUnread", "held"];

// The owner's own projects that take the core, as state-report.mjs --projects finds them, kept to the repositories the
// owner's account owns (never another owner's, tried only at a release): with the owner's sign-in, every one it owns;
// without, its public ones. Each { name, private }. GitHub's answer that a repository holds no manifest (404) means
// "not a project"; any other failure throws, so that a reading not taken is never taken for none.
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
  return found;
}

// git with the sign-in passed through git's environment for that one call, never in its arguments or a file the clone
// keeps, so the clone holds none and nothing can be pushed from it.
function clone(name, into, token, url = n => `https://github.com/${n}.git`) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  if (token) Object.assign(env, { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader", GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}` });
  return spawnSync("git", ["clone", "--quiet", "--no-tags", url(name), into], { env, stdio: "ignore", timeout: 10 * 60000 }).status === 0;
}

// --find: the projects found, cloned under `dir` as p1, p2, … (their names in dir/projects.json, on this machine alone),
// each name masked in GitHub's log first.
export function find(dir, { signedIn, token, gh = ghApi, url, say = console.log, actions = process.env.GITHUB_ACTIONS === "true" } = {}) {
  const found = owned(signedIn, gh);
  if (actions) for (const p of found) for (const n of new Set([p.name, p.name.split("/")[1]])) say(`::add-mask::${n}`);
  fs.mkdirSync(dir, { recursive: true });
  const list = found.map((p, i) => ({ ...p, dir: `p${i + 1}`, cloned: clone(p.name, path.join(dir, `p${i + 1}`), token, url) }));
  fs.writeFileSync(path.join(dir, "projects.json"), `${JSON.stringify({ signedIn: !!signedIn, projects: list })}\n`);
  say(`The daily try found ${list.length} of the owner's own projects that take the core (${signedIn ? `${list.filter(p => p.private).length} private` : `the public ones alone, the private ones wanting the owner's sign-in ${SECRET}`}), and cloned ${list.filter(p => p.cloned).length}.`);
  return list;
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

// One project tried at the core checked out at `core` (its commit `sha`): the run before, the sync, the run after, each
// output to a log in `out`. What it came to: "atPin", "untried", "syncFailed", "afterUnread", or the pair, held or not.
export function tryOne(p, core, sha, out, run = runLogged) {
  const at = path.join(out, p.dir), log = path.join(out, `${p.dir}.log`);
  const manifest = manifestText(path.join(at, "core-manifest.md"));
  const copy = readCore(manifest ?? "");
  if (copy.pin === sha) return { came: "atPin" };
  const own = copy.path ? path.join(at, copy.path, "scripts") : null;
  const ownCheck = own && fs.existsSync(path.join(own, "check.mjs")) && fs.readFileSync(path.join(own, "check.mjs"), "utf8").includes("--verdicts");
  const main = (spawnSync("git", ["rev-parse", "HEAD"], { cwd: at, encoding: "utf8" }).stdout ?? "").trim();
  run(process.execPath, [path.join(core, "scripts", "toolchain.mjs"), at], at, log);
  const check = (script, file) => run(process.execPath, [script, "--base", main, "--own", "--verdicts", file], at, log);
  const before = path.join(out, `${p.dir}.before.json`), after = path.join(out, `${p.dir}.after.json`);
  check(ownCheck ? path.join(own, "check.mjs") : path.join(core, "scripts", "check.mjs"), before);
  if (!readJson(before)) return { came: "untried" };
  const synced = run("git", ["switch", "--quiet", "-c", "daily-try"], at, log)
    && run(process.execPath, [fs.existsSync(path.join(own ?? "", "sync.mjs")) ? path.join(own, "sync.mjs") : path.join(core, "scripts", "sync.mjs"), sha], at, log)
    && run("git", ["add", "-A"], at, log)
    && run("git", ["-c", "user.name=daily-try", "-c", "user.email=daily-try@example.invalid", "commit", "--quiet", "--no-verify", "-m", "The daily try's sync (never pushed)"], at, log);
  if (!synced) return { came: "syncFailed" };
  check(path.join(core, "scripts", "check.mjs"), after);
  const pair = [readJson(before), readJson(after)];
  if (!pair[1]) return { came: "afterUnread" };
  return { came: holds(pair, sha) ? "held" : "tried", pair };
}

// --run: every clone `dir` holds tried at the core `core`, and the counts.
export function runAll(dir, core, { run = runLogged, day = new Date().toISOString().slice(0, 10), sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: core, encoding: "utf8" }).stdout.trim() } = {}) {
  const { signedIn = false, projects = [] } = readJson(path.join(dir, "projects.json")) ?? {};
  const tally = Object.fromEntries(TALLY.map(k => [k, 0]));
  tally.found = projects.length; tally.private = projects.filter(p => p.private).length;
  const pairs = [], each = [];
  for (const p of projects) {
    const r = p.cloned ? tryOne(p, core, sha, dir, run) : { came: "untried" };
    tally[r.came === "held" ? "held" : r.came === "tried" ? "tried" : r.came]++;
    if (r.came === "held") tally.tried++;
    if (r.pair) pairs.push(r.pair);
    each.push({ ...p, ...r });
  }
  const counts = trialRecord(sha, day, pairs);
  const out = { commit: sha, day, signedIn: !!signedIn, ...tally, ...Object.fromEntries(COUNTS.map(k => [k, counts[k]])) };
  fs.writeFileSync(path.join(dir, "try.json"), `${JSON.stringify(out)}\n`);
  return { out, each };
}

// Whether counts are in the form --run writes; nothing else is read by --file, which builds its text from numbers alone.
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
  return `The daily try of ${t.day} held the core at ${t.commit}, main's newest commit whose checks all passed: of ${plural(t.found, "project")} of the owner's own that take the core (${t.private} private), ${t.tried} tried, ${t.atPin} already at it and ${t.untried} not tried; ${how.join("; ")}.\n\nThe projects are not named here, since the core is public (floor rules 4 and 11). Mend: a session where gh answers for the owner's account runs \`node scripts/daily-try.mjs --local\` from a clone of the core at that commit, which names, there alone, each project and the checks that held it; it finds the core's fault from that project's run after the sync, mends it in the core in a pull request of its own that says "Fixes" this issue, and carries nothing of a private project into it but counts and conclusions. A bug, it waits for no line (roles/shared/inbox.md, "Bugs don't wait").`;
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

function main([what, ...args]) {
  const fail = why => { console.error(`FAIL ${why}`); return 1; };
  // (no commit to try is no failure: it prints nothing, and the try's steps after it do not run)
  if (what === "--green") { const g = greenMain(ROOT); if (g.sha) console.log(g.sha); else console.error(`${g.said}: nothing to try today; the next day's run tries again.`); return 0; }
  if (what === "--find" && args.length === 1) {
    const signedIn = process.env.SIGNED_IN === "true";
    try { find(path.resolve(args[0]), { signedIn, token: signedIn ? process.env.GH_TOKEN : undefined }); return 0; }
    catch { return fail("GitHub gave no answer, or none that could be read, for the owner's repositories or a manifest, so no project was found (not none found). Mend: start the job again; where it fails each day, see whether the owner's sign-in has expired."); }
  }
  if (what === "--run" && args.length === 2) { const { out } = runAll(path.resolve(args[0]), path.resolve(args[1])); console.log(JSON.stringify(out)); return 0; }
  if (what === "--file" && !args.length) {
    try { const text = process.env.TRY ?? ""; file(text.length > COUNTS_MAX ? null : parseBounded(text || "null")); return 0; }
    catch (e) { return fail(`${e.message}. Mend: read the try job's log for its counts; start the look again once it gives them.`); }
  }
  if (what === "--local" && args.length <= 1) {
    const dir = path.resolve(args[0] ?? fs.mkdtempSync(path.join(os.tmpdir(), "daily-try-")));
    const token = spawnSync("gh", ["auth", "token"], { encoding: "utf8" }).stdout?.trim();
    find(dir, { signedIn: true, token, actions: false });
    const { out, each } = runAll(dir, ROOT);
    for (const p of each) {
      const c = p.pair ? compared(...p.pair) : null;
      const why = c ? ["failedAfter", "failedAfterAlone", "unreadAfter", "unreadBefore", "stoppedAfter", "unrunAfterRan"].flatMap(k => c[k].map(j => `${j} (${k})`)) : [];
      console.log(`- ${p.name}: ${p.came}${why.length ? `: ${why.join(", ")}` : ""}; its log: ${path.join(dir, `${p.dir}.log`)}`);
    }
    console.log(JSON.stringify(out));
    return 0;
  }
  return fail("it takes --green, --find <dir>, --run <dir> <core>, --file or --local [<dir>]. Mend: give one of them, as the script's head says.");
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
