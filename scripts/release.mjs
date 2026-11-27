// Cuts a release of the core (README.md, "How a project takes the core", point 1; core-changes/releases.md, "A release is cut on the
// owner's word"): the tag `release-N`, N one past the newest release's, on the commit of the core's main its trial
// tried (#1413, point 3), which the trial's record on main's newest commit names, or main's newest where none does. A
// project that follows the releases (releases.mjs, beside this file) takes the core only from such a tag, so a release
// is what the core's owner hands on to another owner's project, on purpose. Run in the core's own repository alone: in
// a project's copy it refuses, since a project cuts no release. Without --cut it says what the release would be and
// what it would ask of a project (the sync notes it carries, each with roughly what it costs a project where it is not
// done yet: steps.mjs, beside this file) and how a copy older than release-1 would take it, and cuts nothing; with
// --cut it says the same, and how such a copy takes it once it is cut. The owner tags nothing by hand: the release
// workflow (.github/workflows/release.yml) runs the cut, started by a session on the owner's word, once its own jobs of
// the upgrade test on Windows have passed on that commit (#715), and hands it that commit and GitHub's list of the
// checks that ran there; the cut is refused where that commit is no commit of main's or does not follow the newest
// release, where a check on it has not passed; and, once the staged cases hold a release (staged.mjs, beside this
// file), where one failed in its last run as main's newest record holds it; and where the trial on a real
// project (release-trial.mjs, beside this file; #1084) has no record on main's newest commit that stands for it, or one where a check passed before the
// update and failed after it, or one was not measured, a job check.mjs could not read (#1263), or one failed on the draft of
// the sync in the owner's own projects that passed on main or ran on the draft alone (trial-draft.mjs; #1334). Git and Node's own modules only.
//
//   node scripts/release.mjs          what the next release would be, and what it carries
//   node scripts/release.mjs --cut --at <sha> --runs <file> --full <file>
//                                     cuts it: the tag is pushed to the core's repository, and nothing else is. Only
//                                     where <sha> is a commit of main's past the newest release, the checks listed in --runs, GitHub's
//                                     answer to repos/<core>/actions/runs?head_sha=<sha>&branch=main&event=push, have
//                                     all passed, and the tests' hourly or hand-started runs in --full, its answer to
//                                     repos/<core>/actions/workflows/tests.yml/runs?head_sha=<sha>&branch=main, are none
//                                     unfinished, the newest passed (fullRun); without the three it cuts nothing
//   node scripts/release.mjs --trial <sha> [<before> <after> --sync <reading> --draft <reading>]...
//                                     writes the trial's record for the commit <sha>: for each project tried, the file
//                                     check.mjs --verdicts wrote before the update and the one after, each outside
//                                     every repository, counted, and after them, with --sync, which each pair needs, the file with what
//                                     pure-sync.mjs --trial <sha> printed of its sync, read as a reading that holds no
//                                     cut, with the copy its runs before started from (#1261); none where no project that takes the core allowed a
//                                     trial, which it refuses where scripts/state-report.mjs --projects finds one of
//                                     the owner's own; where the trial holds the cut, it says how the runs are taken,
//                                     the baseline from a clone of the core where the copy cannot (#1244); and after
//                                     each pair, with --draft, the file with what trial-draft.mjs printed of the draft
//                                     of its sync, or of why none was opened (its `none` form), the
//                                     owner's own projects each given one (#1334)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { FOLDER, NOTICE } from "./sync-notes.mjs";
import { aCommit } from "./guards.mjs";
import { NOTES, OWN, RELEASE, asksBetween, fetchCore, held, inBare, namedReleases, past, plainEnv, releasesIn } from "./releases.mjs";
import { atRelease } from "./staged.mjs";
import { TRIAL, trial, trialAt } from "./release-trial.mjs";
import { FULL, NARROWED } from "./tests-parts.mjs";
import { started } from "./started.mjs";
import { STEPS } from "./steps.mjs";

const git = (args, cwd) => execFileSync("git", args, { cwd, env: plainEnv(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// The next release in a repository that holds the core's main and its tags: its name, the commit it would stand on,
// the release before it (null: the first), and what a sync from that one to it asks of a project. It stands on the
// commit `at` of main, the one the trial tried (#1413, point 3), or, where none is given, on the commit the trial's
// record on main's newest commit names where that follows the newest release, else on main's newest commit. Null
// where the newest release already stands on that commit: there is nothing to hand on. It is numbered after every tag
// with a release's name, one that is no release included, so its name is never taken; and it throws where that number
// would be no release's name any more, and where `at` is no commit of main's or does not follow the newest release.
export function next(dir, at = null) {
  const tip = inBare(dir, ["rev-parse", "refs/heads/main"]).trim();
  const [before] = releasesIn(dir);
  const sha = standsOn(dir, at, tip, before);
  if (before?.sha === sha) return null;
  if (before && !past(before.sha, sha, dir)) throw new Error(`${sha.slice(0, 7)} does not follow ${before.name}, the newest release: try the release on a newer commit of main, and record that trial`);
  const name = `release-${(namedReleases(dir).at(-1)?.n ?? 0) + 1}`;
  if (!RELEASE.test(name)) throw new Error(`${name} is no release's name: a tag numbered too high stands in the way, and is the owner's to remove`);
  return { name, sha, tip, before: before ?? null, asks: before ? asksBetween(before.sha, sha, dir) : [] };
}

// The commit the next release stands on: `at`, which must be of main (main's newest `tip`), or, where none is given, the
// one the trial's record on main names where that follows `before`, the newest release, else main's newest.
function standsOn(dir, at, tip, before) {
  if (at !== null) {
    if (!past(at, tip, dir)) throw new Error(`${String(at).slice(0, 7)} is no commit of main's: start the release again once the trial's record on main names a commit of main`);
    return at;
  }
  const named = tried(dir);
  return named && past(named, tip, dir) && (!before || (named !== before.sha && past(before.sha, named, dir))) ? named : tip;
}

// The commit the trial's record on main's newest commit names (release-trial.mjs, TRIAL), or null where none is read.
export function tried(dir) {
  try { const r = JSON.parse(inBare(dir, ["show", `refs/heads/main:${TRIAL}`])); return aCommit(r?.commit) ? r.commit : null; } catch { return null; }
}

// An entry the release asks, with its step's cost (steps.mjs) on the line below it; an entry with no step says so, and
// the notes' notice to a sync from a copy older than the folder (sync-notes.mjs) costs what the entries it sends to do.
export const costed = entry => {
  if (entry.startsWith(NOTICE)) return `${entry}\n  Cost: that of each entry it sends the session to, as its step says.`;
  const step = STEPS.find(s => entry.startsWith(`- **${s.lead}.**`));
  // (an `owner` read from the host, step 390's, is the owner's in a private repository alone)
  const whose = !step?.owner ? "" : typeof step.owner === "function" ? " (the owner's in a private repository)" : " (the owner's)";
  return `${entry}\n  Cost: ${step ? `${step.cost}${whose}` : "unknown: the entry has no step in scripts/steps/"}.`;
};

// What the core's owner tells a project whose copy is older than release-1 when handing a release on (#365): its own
// sync script knows no release and, run with no SHA, takes the core's newest main, so it syncs once with this SHA.
export const older = (name, sha) => `A project whose copy is older than release-1 syncs to ${name} once with its full SHA, \`node core/scripts/sync.mjs ${sha}\`: its own sync script, run with none, takes the core's main (setup/sync-notes.md, at its top).`;

// (held and OWN stand in releases.mjs, beside this file, which the syncs read too: #733)
export { OWN, held };

// Whether this file lies in the core's own repository: its scripts/ at the root of a repository that is no project's
// copy, even a copy kept as a repository of its own (a clone or a submodule under a project's core/, with the
// project's manifest beside it).
export function inTheCore(file = fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(file), "..");
  // (asked of git as a path from the repository's root, empty at the root itself: no two spellings of one folder,
  // such as Windows' short names, are ever compared)
  try { if (git(["rev-parse", "--show-prefix"], root) !== "") return false; } catch { return false; }
  return !(path.basename(root) === "core" && fs.existsSync(path.join(root, "..", "core-manifest.md")));
}

// The value after a flag on the command line, null where the flag is not there; it throws where the flag stands last.
function after(flag, argv) {
  const i = argv.indexOf(flag);
  if (i < 0) return null;
  if (i + 1 >= argv.length) throw new Error(`${flag} needs a value`);
  return argv[i + 1];
}

// Why the release `name` at `sha` is not cut, or null: the staged cases hold it (`staged`, from atRelease), or a check
// on that commit has not passed, as the list of the runs there (`runs`, a file) says.
// The core's tests in full on a commit (#733, points 3 and 6): a pull request's run and a push's are on Linux alone, so
// a release waits on the tests' runs there that ran once an hour or were started by hand, which hold the Windows
// suites: none unfinished, the newest passed. A reason it holds the release, or null.
export const TESTS = ".github/workflows/tests.yml";
// The newest of runs, by when each last started (a re-run moves it), the higher id of two that started together, as
// tests.yml's hourly run reads them.
const startOf = r => (typeof r?.run_started_at === "string" ? Date.parse(r.run_started_at) || 0 : 0);
const lastOf = runs => runs.reduce((a, b) => (startOf(b) > startOf(a) || (startOf(b) === startOf(a) && Number(b?.id ?? 0) > Number(a?.id ?? 0)) ? b : a));
// The tests' runs in full on a commit: those once an hour, and those started by hand that bear the workflow's own name,
// never one that named the parts it ran; one by hand whose name is neither counts only where it did not pass, so a name
// GitHub gives otherwise can hold a release and never let one stand (tests-parts.mjs, FULL; #954).
const byHand = r => r?.display_title === FULL || (r?.conclusion !== "success" && !String(r?.display_title ?? "").startsWith(NARROWED));
const inFull = list => (Array.isArray(list?.workflow_runs) ? list.workflow_runs : []).filter(r => r?.path === TESTS
  && (r?.event === "schedule" || (r?.event === "workflow_dispatch" && byHand(r))));
// (it holds while any full run on the commit is unfinished, and reads the newest: an hourly run skips only where none
// other is going and the newest passed, so a skipped one is the newest only where nothing started after it)
// A run started by hand tests main's newest commit alone, so on a commit main has moved on from (`behind`) none can be
// started any more, and the mend is a trial on a newer commit.
export function fullRun(list, behind = false) {
  const runs = inFull(list);
  if (!runs.length) return behind
    ? "the tests have not run in full on it, the Windows suites with them, and main has moved on from it, so no run can be started there any more: try the release on a newer commit of main whose tests in full have passed, record that trial, and start the release again"
    : "the tests have not run in full on it yet, the Windows suites with them: start the tests workflow on main by hand (its page under Actions), naming no part, or wait for its hourly run, and start the release again once it has passed";
  const going = runs.find(r => r?.status !== "completed");
  if (going) return `the tests in full (their ${going?.event === "schedule" ? "hourly" : "hand-started"} run): ${going?.status ?? "unreadable"}`;
  const last = lastOf(runs), how = last?.event === "schedule" ? "hourly" : "hand-started";
  return last?.conclusion === "success" ? null : `the tests in full (their ${how} run): ${last?.conclusion ?? "unreadable"}`;
}

function whyNot(name, sha, tip, staged, trialed, runs, fullFile) {
  if (staged.held) return `${name} is not cut: ${staged.held}.`;
  if (trialed.held) return `${name} is not cut: ${trialed.held}.`;
  const readList = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
  const list = readList(runs), full = readList(fullFile);
  const notFull = Array.isArray(full?.workflow_runs) ? fullRun(full, sha !== tip) : "the tests' runs on it could not be read";
  const reasons = [...held(list), ...notFull ? [notFull] : []];
  return reasons.length ? `${name} is not cut: the checks on ${sha.slice(0, 7)} have not all passed. Start the release again once they have.\n${reasons.map(r => `  ${r}`).join("\n")}` : null;
}

// Prints what the release is, what it asks of a project, and what the staged cases and the trial on a real project say
// of it; gives those two.
export function told({ name, sha, tip, before, asks }, dir) {
  console.log(`${name} at ${sha}${sha === tip ? "" : `, the commit its trial tried, main standing at ${tip.slice(0, 7)}`}${before ? `, after ${before.name} at ${before.sha.slice(0, 7)}: https://github.com/${CORE}/compare/${before.name}...${sha}` : ", the first release"}`);
  console.log(asks === null
    ? `What it asks of a project beyond the copy could not be read: read the entries of ${FOLDER}/ newer than ${before.name}.`
    : asks.length
      ? `It asks more of a project than the copy (${NOTES}), each with roughly what it costs a project where it is not done yet:\n${asks.map(costed).join("\n")}`
      : before ? `It asks nothing of a project beyond the copy (${NOTES}).` : `The first release: a project reads ${NOTES} whole against where it stands.`);
  // (the staged cases' newest verdicts on the commit tried or before it, read on main's newest commit, where the runs at
  // the release are recorded: #1413, point 3)
  const staged = atRelease(sha, before, rev => inBare(dir, rev), tip);
  console.log(staged.said);
  // (the record read on main's newest commit, where it merged after the commit it names: #1413, point 3)
  const trialed = trialAt(sha, rev => inBare(dir, rev), "refs/heads/main");
  console.log(trialed.said);
  if (trialed.held) console.log(`Until then it is not cut: ${trialed.held}.`);
  return { staged, trialed };
}

function main(argv) {
  const fail = msg => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };
  if (!inTheCore()) return fail("run it in the core's own repository: a project cuts no release");
  if (argv[0] === "--trial") return trial(argv.slice(1), fail);
  const cut = argv.includes("--cut");
  let at, runs;
  let full;
  try { at = after("--at", argv); runs = after("--runs", argv); full = after("--full", argv); } catch (e) { return fail(e.message); }
  // (asked before anything is fetched: a cut is never tried without the commit it is for and the checks on it)
  if (cut && (at === null || runs === null || full === null)) return fail("--cut needs --at <sha>, --runs <file> and --full <file>: the release workflow gives all three (.github/workflows/release.yml)");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "core-release-"));
  try {
    fetchCore(dir);
    const release = next(dir, at);
    if (!release) { console.log(`the newest release, ${releasesIn(dir)[0].name}, already stands on the commit a release would stand on: nothing to release`); return; }
    const { name, sha } = release;
    const { staged, trialed } = told(release, dir);
    if (!cut) { console.log(older(name, sha)); console.log("Not cut: the release workflow cuts it, started on the owner's word."); return; }
    const stop = whyNot(name, sha, release.tip, staged, trialed, runs, full);
    if (stop) return fail(stop);
    // (the commit goes straight to the new tag on the core's repository: a tag that exists is never moved)
    inBare(dir, ["push", "--quiet", `https://github.com/${CORE}`, `${sha}:refs/tags/${name}`]);
    console.log(`${name} is cut.`);
    console.log(older(name, sha));
  } catch (e) {
    fail(e.stderr?.toString().trim() || e.message);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (started(import.meta.url)) main(process.argv.slice(2));
