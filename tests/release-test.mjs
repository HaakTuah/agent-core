// Tests of cutting a core release (release.mjs, with the trial on a real project in release-trial.mjs): the next release and
// its number, the checks on the commit it would stand on, the full run of the tests, how a copy older than the last two
// takes one, where a release may be cut and what each ask of a release costs. The trial on a real project and its record,
// which holds the cut: release-trial-test.mjs.
// In a scratch repository that stands in for the core, fetched as the scripts fetch the core (which tags are releases and
// what a sync asks: releases-test.mjs; what a project follows: follows-test.mjs); on Linux and on Windows. Git and Node's own
// modules only.
//
//   node tests/release-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OWN, costed, fullRun, held, inTheCore, next, older, tried } from "../scripts/release.mjs";
import { TRIAL } from "../scripts/release-trial.mjs";
import { STEPS } from "../scripts/steps.mjs";
import { NOTICE } from "../scripts/sync-notes.mjs";
import { scratchCore, victimRepo } from "../scripts/releases-scratch.mjs";


let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// a scratch core: main with four commits, a side branch, and tags
const { tmp, git, core, commit, head, c1, c2, c3, c4, side, fetched } = scratchCore("release-test-");

let dir = fetched();
ok(next(dir).name === "release-1" && next(dir).sha === c4 && next(dir).before === null && next(dir).asks.length === 0, "the first release would stand on main's newest commit");

git(core, "tag", "release-1", c2);
git(core, "tag", "-a", "-m", "the second", "release-2", c3); // (a tag with a message of its own: its commit is what counts)
git(core, "tag", "release-3", side); // (on a commit that is not main's: no release)
git(core, "tag", "release-04", c4); // (not a release's name)
git(core, "tag", "v9", c4);
dir = fetched();
const coming = next(dir);
ok(coming.name === "release-4" && coming.sha === c4 && coming.before.name === "release-2" && coming.asks.length === 0, "the next release stands on main's newest commit, numbered after every tag with a release's name, the one that is no release too, so its name is never taken");

// a tag of a tag, and a number out of main's order
git(core, "tag", "-a", "-m", "inner", "inner", c4);
git(core, "tag", "-a", "-m", "a tag of a tag", "release-5", "inner");
git(core, "tag", "release-6", c1); // (numbered newest, on main's oldest commit: a mistake)
dir = fetched();
ok(next(dir) === null, "with the newest release on main's newest commit there is nothing to release");
commit(`${head}- **First.** Done when one.\n- **Second.** Done when two.\n- **Third.** Done when three.\n`);
dir = fetched();
ok(next(dir).name === "release-7" && next(dir).before.name === "release-5" && next(dir).asks.join() === "- **Third.** Done when three.", "the next one is numbered past the mistaken tag, and carries what the notes gained since the newest release");
git(core, "tag", "release-999999999", c1);
let refused = false;
try { next(fetched()); } catch { refused = true; }
ok(refused, "a tag numbered so high that the next would be no release's name stops the cut, and says so");
git(core, "tag", "-d", "release-999999999");
dir = fetched();
const tip = git(core, "rev-parse", "main");
// (#1413, point 3: the release stands on the commit of main its trial tried, main having moved on since)
const refusal = at => { try { next(dir, at); return ""; } catch (e) { return e.message; } };
const later = commit(`${head}- **First.** Done when one.\n- **Second.** Done when two.\n- **Third.** Done when three.\n`);
dir = fetched();
ok(next(dir, tip).sha === tip && next(dir, tip).tip === later && next(dir, tip).asks.join() === "- **Third.** Done when three.", "asked for a commit of main that main has moved on from, the release stands on it, carrying what the notes gained up to it alone", JSON.stringify(next(dir, tip)));
ok(/is no commit of main's/.test(refusal(side)) && /is no commit of main's/.test(refusal("not a commit")), "a commit that is not main's, or no commit, is refused");
ok(/does not follow release-5, the newest release/.test(refusal(c2)) && next(dir, c4) === null, "one before the newest release is refused, and the newest release's own commit has nothing to hand on");
// (with no commit asked, as the preview reads it: the one the trial's record on main names, where it follows the newest release)
const record = sha => { fs.mkdirSync(path.join(core, "reports"), { recursive: true }); fs.writeFileSync(path.join(core, TRIAL), JSON.stringify({ commit: sha })); git(core, "add", "-A"); git(core, "commit", "-q", "-m", "the trial's record"); };
record(tip);
dir = fetched();
ok(tried(dir) === tip && next(dir).sha === tip && next(dir).tip !== tip, "the preview stands on the commit the trial's record on main names", JSON.stringify(next(dir)));
record(c2);
dir = fetched();
ok(tried(dir) === c2 && next(dir).sha === git(core, "rev-parse", "main"), "and on main's newest commit where the record names one the newest release does not come before");
record("no sha");
dir = fetched();
ok(tried(dir) === null && next(dir).sha === git(core, "rev-parse", "main"), "or where it names no commit");

// the checks on the commit a release would stand on
const run = (name, status, conclusion, path = `.github/workflows/${name}.yml`) => ({ name, path, status, conclusion });
const list = (...runs) => ({ total_count: runs.length, workflow_runs: runs });
// the core's tests in full on that commit (#733): of the tests' runs there once an hour or by hand, which hold the
// Windows suites, none is unfinished and the newest, by when it last started (a re-run moves it), passed
// (each bears the workflow's own name, as GitHub gives a run whose run-name is empty: tests-parts-test.mjs reads the rest)
const full = (event, conclusion, id, status = "completed", at = `2026-11-19T10:${String(id).padStart(2, "0")}:00Z`) => ({ ...run("tests", status, conclusion), event, id, run_started_at: at, display_title: "tests" });
ok(/have not run in full on it yet/.test(fullRun(list({ ...run("tests", "completed", "success"), event: "push" }))), "a commit whose tests ran only on its push, on Linux, has not had them in full, and the release waits, saying how to start them");
ok(/main has moved on from it, so no run can be started there any more: try the release on a newer commit/.test(fullRun(list(), true)) && !/moved on/.test(fullRun(list())), "on a commit main has moved on from, where no run can be started any more, the mend is a trial on a newer commit");
ok(fullRun(list(full("schedule", "success", 10))) === null && fullRun(list(full("workflow_dispatch", "success", 10))) === null, "an hourly or a hand-started run that passed lets the release stand");
ok(fullRun(list(full("workflow_dispatch", "success", 10), full("schedule", "failure", 9))) === null && /hourly run\): failure/.test(fullRun(list(full("schedule", "failure", 10), full("workflow_dispatch", "success", 9)))), "the newest of them, by when it last started, decides, in whatever order GitHub lists them: a pass started after a failure lets it stand, a failure started after a pass holds it");
ok(/hand-started run\): failure/.test(fullRun(list(full("schedule", "success", 20), full("workflow_dispatch", "failure", 10, "completed", "2026-11-19T11:00:00Z")))) && fullRun(list(full("schedule", "failure", 20, "completed", "2026-11-19T10:00:00Z"), full("schedule", "success", 10, "completed", "2026-11-19T10:00:00Z"))) !== null, "an older run started again by hand, which failed, holds it over a skipped run made before; two that started together, the one made last decides");
ok(/hand-started run\): in_progress/.test(fullRun(list(full("schedule", "success", 11), full("workflow_dispatch", null, 10, "in_progress")))), "and a full run still going on the commit holds it, though a skipped hourly run was made after it");
ok(/in_progress/.test(fullRun(list(full("schedule", null, 10, "in_progress")))) && /not run in full/.test(fullRun(list({ ...full("schedule", "success", 10), path: ".github/workflows/other.yml" }))), "one still going holds it, and another workflow's run is no run of the tests");
ok(held(list(run("tests", "completed", "success"), run("size", "completed", "success"))).length === 0, "a commit whose every check has passed may carry a release");
ok(held(list(run("tests", "completed", "success"), run("size", "completed", "skipped"), run("other", "completed", "neutral"))).length === 0, "a check that was skipped holds nothing where another passed");
ok(held(list(run("tests", "in_progress", null), run("size", "completed", "success"))).join() === "tests: in_progress" && held(list(run("tests", "queued", null))).join() === "tests: queued", "a check still going holds it");
ok(held(list(run("tests", "completed", "failure"), run("size", "completed", "cancelled"), run("x", "completed", "timed_out"))).join() === "tests: failure,size: cancelled,x: timed_out", "so does each that failed, was cancelled or ran out of time");
ok(held(list()).join() === "no check has passed on it yet" && held(list(run("size", "completed", "skipped"))).join() === "no check has passed on it yet", "so does a commit no check has run on yet, or on which every check only skipped");
ok(held(list(run("release", "completed", "failure", OWN), run("tests", "completed", "success"))).length === 0 && held(list(run("release", "in_progress", null, OWN))).join() === "no check has passed on it yet", "the release workflow's own runs, an earlier try that failed too, are no check of the commit");
ok(held({ total_count: 3, workflow_runs: [run("tests", "completed", "success")] }).join().includes("3 runs stand on it and 1 were read"), "a list read only in part holds it");
ok([null, undefined, {}, [], "text", { workflow_runs: [] }, { total_count: "1", workflow_runs: [run("tests", "completed", "success")] }, { total_count: 1, workflow_runs: {} }].every(l => held(l).join() === "the list of the checks on it could not be read"), "so does a list in any other form");
const handed = older("release-7", "b".repeat(40));
ok(handed.includes(`node core/scripts/sync.mjs ${"b".repeat(40)}`) && handed.includes("older than release-1") && handed.includes("release-7"), "each release says how a copy older than release-1 takes it: once, with the release's full SHA (#365)", handed);
// (asked of the script itself, in this repository: each stops before anything is fetched or pushed)
const cutting = (...args) => { const r = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/release.mjs", import.meta.url)), "--cut", ...args], { encoding: "utf8" }); return r.status === 1 && /--cut needs --at <sha>, --runs <file> and --full <file>|needs a value/.test(r.stderr) && !r.stdout; };
ok(cutting() && cutting("--at", "a".repeat(40)) && cutting("--runs", "runs.json") && cutting("--runs", "runs.json", "--at") && cutting("--at", "a".repeat(40), "--runs", "runs.json"), "a cut asked for without the commit it is for, without the checks on it, or without the tests' runs there, is refused before anything is fetched");
ok(held({ total_count: 2, workflow_runs: [null, run("tests", "completed", "success")] }).join() === "a check: unreadable" && held(list({ name: "tests", path: "p" })).join() === "tests: unreadable", "and a run in it that cannot be read");

// git's own variables that point elsewhere: a project's repository is never touched, and the guard is not fooled
const { victim } = victimRepo(tmp, git);
process.env.GIT_DIR = path.join(victim, ".git");
process.env.GIT_WORK_TREE = victim;
let fooled;
try { fooled = inTheCore(path.join(victim, "core", "scripts", "release.mjs")); } finally { delete process.env.GIT_DIR; delete process.env.GIT_WORK_TREE; }
ok(fooled === false, "and a project's copy is still no place to cut a release from");

// where a release may be cut
ok(inTheCore(), "this file lies in the core's own repository");
const project = path.join(tmp, "project");
fs.mkdirSync(path.join(project, "core", "scripts"), { recursive: true });
git(project, "init", "-q");
ok(!inTheCore(path.join(project, "core", "scripts", "release.mjs")), "a copy under a project's core/ is not the core: a project cuts no release");
ok(!inTheCore(path.join(tmp, "nowhere", "scripts", "release.mjs")), "nor is a folder that is no repository");
// a copy kept as a repository of its own under a project's core/, the project's manifest beside it
const nested = path.join(tmp, "nested");
fs.mkdirSync(path.join(nested, "core", "scripts"), { recursive: true });
fs.writeFileSync(path.join(nested, "core-manifest.md"), "# Core manifest\n");
git(path.join(nested, "core"), "init", "-q");
ok(!inTheCore(path.join(nested, "core", "scripts", "release.mjs")), "nor is a clone or submodule of the core under a project's core/");

// what a release asks, each with roughly what it costs a project where it is not done yet (steps.mjs)
const owners = STEPS.find(s => s.owner === true), hosts = STEPS.find(s => typeof s.owner === "function");
ok(costed(`- **${STEPS[0].lead}.** Done when one.`).endsWith(`\n  Cost: ${STEPS[0].cost}.`) && costed(`- **${owners.lead}.** Done when two.`).endsWith("(the owner's).") && costed(`- **${hosts.lead}.** Done when two.`).endsWith("(the owner's in a private repository).")
  && costed("- **No such entry.** Done when three.").includes("unknown") && costed(`${NOTICE}: and so on.`).includes("each entry it sends the session to") && costed("- A line of no form.").includes("unknown"), "each ask of a release says what it costs, the owner's marked so, one with no step or of no form says so, and the notice costs what it sends to");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on cutting a release`);
process.exitCode = failed ? 1 : 0;
