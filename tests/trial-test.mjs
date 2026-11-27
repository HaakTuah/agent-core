// Tests of check.mjs as a release's trial runs it, and of the trial's record (#1245, #1244; AGENTS.md, "A release is
// cut on the owner's word"): a workflow's jobs run in their `needs` order with the needs context; the checkout stand-in
// takes a commit's id and a ref written whole as they are; the setup-node stand-in says where the machine's Node is not
// the one a step asks; a sync's calls are its own, and the base's it leaves out; jobs stopped behind a failure are
// counted, and hold the cut, as a baseline taken from a clone of the core is; and a sync to a commit of the core's main
// past its newest release, as a trial makes, is said to need nothing. On scratch repositories alone, so no call reaches
// the network. Git and Node's own modules.
//
//   node tests/trial-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { RUN_FROM } from "../scripts/check.mjs";
import { sameNode, standIns } from "../scripts/check-actions.mjs";
import { closing, movesForward, ownJobs, syncCalls, triggered, unrunWhy } from "../scripts/check-calls.mjs";
import { BLIND, COUNTS, compared, trialAt, trialRecord } from "../scripts/release-trial.mjs";
// (a sync's reading for each project tried, which every record holds, #1261)
const SYNC = { pure: true, from: "release-1" }, OTHER = { none: "another-owner" };
import { sideOf } from "../scripts/attached.mjs";
import { notInstalled } from "../scripts/packages.mjs";
import { mended } from "../scripts/mend.mjs";
import { runWorkflow, withAbsolutePath } from "../scripts/workflow-run.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("trial-test-");
const env = { ...withAbsolutePath(process.env), GIT_AUTHOR_NAME: "Tester", GIT_AUTHOR_EMAIL: "tester@example.invalid", GIT_COMMITTER_NAME: "Tester", GIT_COMMITTER_EMAIL: "tester@example.invalid", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(tmp, "gitconfig") };
fs.writeFileSync(env.GIT_CONFIG_GLOBAL, "[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const commit = (dir, file, text) => { fs.writeFileSync(path.join(dir, file), text); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", file); return git(dir, "rev-parse", "HEAD"); };
const SHA = n => String(n).repeat(40);

{
  // (point 3: the jobs in their needs order, each with the results and outputs of those it needs, as GitHub gives them)
  const ws = fs.mkdtempSync(path.join(tmp, "ws-"));
  const run = text => runWorkflow(text, { github: { event_name: "pull_request" }, base: env, temp: tmp, workspace: () => ws, uses: {} });
  const gated = run(`on: pull_request
jobs:
  late:
    needs: [early]
    if: needs.early.outputs.go == 'yes' && needs.early.result == 'success'
    runs-on: ubuntu-latest
    steps:
      - run: echo late ran
  skipped:
    needs: early
    if: needs.early.outputs.go == 'no'
    runs-on: ubuntu-latest
    steps:
      - run: echo skipped ran
  early:
    runs-on: ubuntu-latest
    outputs:
      go: \${{ steps.s.outputs.go }}
    steps:
      - id: s
        run: echo "go=yes" >> "$GITHUB_OUTPUT"
`);
  ok(gated.map(j => `${j.job}:${j.ran}`).join() === "early:true,late:true,skipped:false" && gated.every(j => j.passed), "a job runs after the jobs it needs, its condition reading their outputs and results (#1245, point 3)", JSON.stringify(gated.map(j => [j.job, j.ran, j.passed])));
  const after = run(`on: pull_request
jobs:
  first:
    runs-on: ubuntu-latest
    steps:
      - run: exit 1
  next:
    needs: first
    runs-on: ubuntu-latest
    steps:
      - run: echo next ran
  always:
    needs: first
    if: always()
    runs-on: ubuntu-latest
    steps:
      - run: echo always ran
`);
  ok(after.map(j => `${j.job}:${j.ran}:${j.passed}:${!!j.stopped}`).join() === "first:true:false:false,next:false:true:true,always:true:true:false" && !gated.some(j => j.stopped),
    "a job whose need failed is skipped as stopped, for check.mjs to write so, and one that asks always() runs; one skipped by its own condition is not stopped (#1245, point 2)", JSON.stringify(after));
  const refused = text => { try { run(text); return ""; } catch (e) { return e.message; } };
  ok(/need each other in a loop/u.test(refused("on: push\njobs:\n  a:\n    needs: b\n    runs-on: x\n    steps: [{run: 'true'}]\n  b:\n    needs: a\n    runs-on: x\n    steps: [{run: 'true'}]\n")) && /needs c, which is no job/u.test(refused("on: push\njobs:\n  a:\n    needs: c\n    runs-on: x\n    steps: [{run: 'true'}]\n")),
    "a loop of needs, or a need that names no job, is refused, as GitHub refuses the workflow");

  // (point 4: the checkout stand-in takes a full commit's id, and a ref written whole, as they are; a bare name is a branch)
  const origin = path.join(tmp, "origin");
  fs.mkdirSync(origin); git(origin, "init", "-q");
  const first = commit(origin, "a.md", "a\n");
  git(origin, "checkout", "-q", "-b", "feature"); const onBranch = commit(origin, "b.md", "b\n");
  git(origin, "checkout", "-q", "main"); const pulled = commit(origin, "c.md", "c\n");
  git(origin, "update-ref", "refs/pull/1/head", pulled); git(origin, "reset", "-q", "--hard", first);
  const clone = path.join(tmp, "clone");
  execFileSync("git", ["clone", "-q", "--", ".", clone], { cwd: origin, stdio: ["ignore", "pipe", "pipe"] });
  const checkout = standIns({ git: (cwd, ...a) => git(cwd, ...a), say: () => {}, tmp })["actions/checkout"];
  const at = ref => { checkout({ ref }, clone); return git(clone, "rev-parse", "HEAD"); };
  ok(at(first) === first && at("refs/pull/1/head") === pulled && at("feature") === onBranch, "the checkout stand-in checks out a commit's id and a ref written whole as they are, and a bare name as the origin's branch (#1245, point 4)");
  ok(standIns({ git, say: () => {}, tmp })["some/action"]() === false, "  and any other action is the host's own, not run");

  // (point 5: setup-node installs nothing, and says once where the step asks a Node other than the machine's)
  const have = process.versions.node, major = have.split(".")[0];
  ok(sameNode(major, have) && sameNode(`${major}.x`, have) && sameNode(have, have) && sameNode("1.2.3", have) === false && sameNode("lts/*", have) === null, "the machine's Node is matched against the one a step asks, part by part");
  const said = [], setup = standIns({ git, say: s => said.push(s), tmp })["actions/setup-node"];
  setup({ "node-version": "1.2.3" }, ws); setup({ "node-version": "1.2.3" }, ws); setup({ "node-version": `v${have}` }, ws);
  fs.writeFileSync(path.join(ws, ".node-version"), "lts/*\n"); setup({ "node-version-file": ".node-version" }, ws);
  ok(said.length === 2 && /asks Node 1\.2\.3 .*runs Node .*a verdict may differ/u.test(said[0]) && /asks Node lts\/\* .*cannot match/u.test(said[1]), "the setup-node stand-in says, once a version, where the machine's Node is not the one asked, and where it cannot tell (#1245, point 5)", said.join("\n"));

  // (point 1: a sync, the pin moved forward along the core's main, runs its own calls, and the base's it leaves out)
  const past = (older, newer) => ({ [`${SHA(1)} ${SHA(2)}`]: true, [`${SHA(2)} refs/heads/main`]: true, [`${SHA(3)} refs/heads/main`]: true })[`${older} ${newer}`] ?? false;
  ok(movesForward(SHA(1), SHA(2), past) && !movesForward(SHA(2), SHA(1), past) && !movesForward(SHA(1), SHA(1), past) && !movesForward(SHA(1), SHA(3), past) && !movesForward(null, SHA(2), past),
    "a change is a sync where it moves the pin forward along the core's main, and no other (#1245, point 1)");
  const calls = job => Boolean(job?.uses);
  const base = [{ file: "core.yml", wf: { jobs: { core: { uses: "old" }, gone: { uses: "old" }, own: { steps: [] } } } }, { file: "left.yml", wf: { jobs: { x: { uses: "old" } } } }];
  const head = [{ file: "core.yml", wf: { jobs: { core: { uses: "new" } } } }];
  const merged = syncCalls(base, head, calls, uses => uses.replace("old", "new"));
  ok(merged.length === 3 && merged[0].wf.jobs.core.uses === "new" && Object.keys(merged[1].wf.jobs).join() === "gone" && merged[1].wf.jobs.gone.uses === "new" && merged[2].file === "left.yml", "  its own calls run, and each call of the base's it leaves out runs, moved to its pin (#1258)", JSON.stringify(merged));
  const weak = syncCalls([{ file: "c.yml", wf: { jobs: { copies: { uses: "c@old", with: { a: 1, b: 2 } }, same: { with: { b: 2, a: 1 }, uses: "s@old" } } } }], [{ file: "c.yml", wf: { jobs: { copies: { uses: "core@new" }, same: { uses: "s@new", with: { a: 1, b: 2 } } } } }], calls, uses => uses.replace("old", "new"));
  ok(weak.length === 2 && Object.keys(weak[1].wf.jobs).join() === "copies (as the base calls it)" && weak[1].wf.jobs["copies (as the base calls it)"].uses === "c@new" && weak[1].wf.jobs["copies (as the base calls it)"].with.b === 2,
    "  and a call the sync changes in more than its pin runs too as the base calls it, at the new pin, so no check is dropped by a weakened call", JSON.stringify(weak));
  const narrowed = syncCalls([{ file: "c.yml", wf: { on: { pull_request: null }, jobs: { c: { uses: "c@old" } } } }], [{ file: "c.yml", wf: { on: { workflow_dispatch: null }, jobs: { c: { uses: "c@new" } } } }], calls, uses => uses.replace("old", "new"));
  ok(narrowed.length === 2 && narrowed[1].wf.on.pull_request === null && narrowed[1].wf.jobs["c (as the base calls it)"].uses === "c@new",
    "  and so does a call whose file's triggers the sync changes, run on the base's triggers", JSON.stringify(narrowed));

  // (point 8: a push that names tags alone starts on no push to main, and a job on another system is left unrun, said so;
  // point 9: a step that wants a program this machine lacks says which)
  const notes = [], own = ownJobs({ file: "o.yml", wf: { jobs: { core: { uses: "x" }, deploy: { environment: "e", steps: [] }, mine: { needs: ["core", "deploy"], steps: [] }, after: { needs: "mine", steps: [] } } } }, m => notes.push(m));
  ok(Object.keys(own[0].wf.jobs).join() === "mine,after" && own[0].wf.jobs.mine.needs.length === 0 && own[0].wf.jobs.after.needs === "mine" && notes.some(n => /mine needs core, deploy, not run here/u.test(n)),
    "a job of the project's own that needs a job not run here runs without it, said so, and one that needs a kept job keeps its need", JSON.stringify({ own, notes }));
  ok(!triggered({ push: { tags: ["v*"] } }, { event: "push" }) && triggered({ push: { tags: ["v*"], branches: ["main"] } }, { event: "push" }) && triggered({ push: null }, { event: "push" }),
    "a push that names tags and no branch is no push to main; one that names main beside its tags, or nothing, is (#1245, point 8)");
  const away = runWorkflow(`on: pull_request
jobs:
  win:
    runs-on: windows-latest
    steps:
      - run: echo win ran
  here:
    runs-on: [self-hosted, linux]
    steps:
      - run: echo here ran
  named:
    runs-on: [self-hosted, machine-2]
    steps:
      - run: echo named ran
  lacking:
    runs-on: ubuntu-latest
    steps:
      - run: no-such-program-of-the-trial --version
`, { github: { event_name: "pull_request" }, base: env, temp: tmp, workspace: () => ws, uses: {}, machine: "linux" });
  const [win, here, named, lacking] = ["win", "here", "named", "lacking"].map(id => away.find(j => j.job === id));
  ok(win.ran === false && /^it runs on Windows, which this machine is not$/u.test(win.unrun) && here.ran && here.passed && named.ran && named.passed && lacking.ran,
    "with the machine named, a job whose runs-on names another system is unrun and says which; one on this system runs, and so does one whose runner's own name holds a system's only in part (#1245, point 8)", JSON.stringify(away.map(j => [j.job, j.ran, j.unrun])));
  const linux = runWorkflow("on: pull_request\njobs:\n  linux:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo linux ran\n", { github: { event_name: "pull_request" }, base: env, temp: tmp, workspace: () => ws, uses: {}, machine: "win32" });
  ok(linux[0].ran && linux[0].passed && !linux[0].unrun, "  a Linux job runs on a machine of another system, as the core's own jobs do", JSON.stringify(linux));
  const lines = [], close = counts => closing(counts, l => lines.push(l), l => lines.push(l));
  ok(close({ failed: 0, ran: 3, unrun: 1 }) === 1 && mended(lines[0]) && /^FAIL 1 job\(s\) skipped above could not run here/u.test(lines[0]) && close({ failed: 0, ran: 3, unrun: 0 }) === 0 && close({ failed: 1, ran: 3, unrun: 0 }) === 1,
    "a job unrun alone fails the run, saying its mend; with none unrun or failed it passes (#1245, points 8 and 9)", lines.join("\n"));
  lines.length = 0;
  ok(close({ failed: 1, ran: 3, unrun: 0 }) === 1 && lines[0] === "1 of the jobs run here failed, 0 not run (the core's checks that run from plain git and, with --own, the project's own jobs)" && close({ failed: 0, ran: 3, unrun: 0 }) === 0 && lines[1] === "ok   every job run here passed (3: the core's checks that run from plain git and, with --own, the project's own jobs)",
    "the summary names the project's own jobs beside the core's checks, never counting them as the core's (#1275, point 2)", lines.join("\n"));
  ok(!lacking.passed && lacking.steps.find(s => !s.passed)?.missing === "no-such-program-of-the-trial", "a step that wants a program this machine lacks names it, for check.mjs to leave the job unrun (#1245, point 9)", JSON.stringify(lacking.steps));
  // (#1361, point 19: a script that could not spawn a program, Node's ENOENT, and exits 127 as checks.mjs then does, names
  // it too, so the job is unrun; one that exits 1 with the same words beside them failed)
  fs.writeFileSync(path.join(ws, "spawns.mjs"), 'import { spawnSync } from "node:child_process";\nconst r = spawnSync("no-such-program-of-the-trial", ["restore"]);\nconsole.log(`could not be started (${r.error.message}).`);\nprocess.exit(Number(process.argv[2]));\n');
  const spawned = runWorkflow(`on: pull_request\njobs:\n  unrun:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node spawns.mjs 127\n  failed:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node spawns.mjs 1\n`,
    { github: { event_name: "pull_request" }, base: env, temp: tmp, workspace: () => ws, uses: {}, machine: "linux" });
  const [unrunJob, failedJob] = ["unrun", "failed"].map(id => spawned.find(j => j.job === id));
  ok(unrunJob.steps[0]?.missing === "no-such-program-of-the-trial" && unrunWhy(unrunJob) === "it needs no-such-program-of-the-trial, which this machine lacks" && failedJob.steps[0]?.missing === undefined && unrunWhy(failedJob) === null,
    "a step whose program a script could not spawn (ENOENT), exiting 127, names it and its job is unrun; one exiting 1 with the same words failed (#1361, point 19)", JSON.stringify(spawned.map(j => j.steps)));

  // (point 10: each job in its class, the record counting each, and a job failed after alone holding the cut as the release's)
  const all = compared({ p: "passed", f: "failed", pf: "passed", ff: "failed", gone: "passed", lost: "failed", was: "stopped", off: "unrun", ranThen: "passed" },
    { p: "passed", f: "passed", pf: "failed", ff: "failed", newp: "passed", newf: "failed", was: "passed", off: "unrun", w: "unrun", ranThen: "unrun" });
  ok(Object.keys(all).join() === COUNTS.join() && Object.values(all).map(j => j.join()).join(";") === "p;f;ff;pf;newf;;;newp,was;gone;lost;off,w;ranThen;;;",
    "passed both, fixed after, failed both, failed after, failed after alone, stopped after, stopped in neither run, ran after alone, ran before alone, failed before alone, unrun after, and unrun after where it ran before are each counted as named (#1245, point 10)", JSON.stringify(all));
  const alone = trialRecord(SHA("b"), "2026-11-24", [[{}, { "new.yml/x": "failed", "w.yml/x": "unrun" }]], [SYNC], [OTHER]);
  const aloneAt = trialAt(SHA("b"), args => (args[0] === "show" ? JSON.stringify(alone) : ""));
  ok(alone.failedAfterAlone === 1 && alone.unrunAfter === 1 && /1 check failed after the release .*0 of them passing before it and 1 not run before/u.test(aloneAt.held) && /1 not run after on this machine, and 0 not run after it there though they ran before/u.test(aloneAt.said),
    "  a job that ran after alone and failed holds the cut as the release's, and one unrun after is said and holds nothing", `${aloneAt.said}\n${aloneAt.held}`);

  const lost = trialRecord(SHA("c"), "2026-11-24", [[{ "a.yml/x": "passed" }, { "a.yml/x": "unrun" }]], [SYNC], [OTHER]);
  const lostAt = trialAt(SHA("c"), args => (args[0] === "show" ? JSON.stringify(lost) : ""));
  ok(lost.unrunAfterRan === 1 && /1 check that ran before measured nothing after the update in the trial on a real project, 0 stopped behind a failure and 1 not run on the trial's machine/u.test(lostAt.held ?? "") && /1 not run after it there though they ran before/u.test(lostAt.said),
    "  a job that ran before and was unrun after holds the cut, saying its mend (#1257)", `${lostAt.said}\n${lostAt.held}`);

  // (point 2 and #1244: jobs stopped after count apart, and hold the cut where they ran before (#1257); a baseline from a clone of the core is counted)
  const before = { [RUN_FROM]: "a clone of the core", "core.yml/core": "passed", "core.yml/tests (a)": "passed", "own.yml/lint": "passed", "own.yml/gone": "passed" };
  const afterRun = { "core.yml/core": "failed", "core.yml/tests": "stopped", "own.yml": "stopped" };
  const c = compared(before, afterRun);
  ok(c.failedAfter.join() === "core.yml/core" && c.stoppedAfter.join() === "core.yml/tests,own.yml" && c.ranBeforeAlone.length === 0 && c.passedBoth.length === 0, "a job stopped after a failure is counted apart, with the jobs of its place before, and the key that says where check.mjs ran from is no job (#1245, point 2)", JSON.stringify(c));
  const record = trialRecord(SHA("a"), "2026-11-24", [[before, afterRun], [{ "x.yml/y": "passed" }, { "x.yml/y": "passed" }]], [SYNC, SYNC], [OTHER, OTHER]);
  ok(record.stoppedAfter === 2 && record.baselineFromClone === 1 && record.projects === 2, "the record counts the jobs stopped after, and the baselines taken from a clone of the core (#1244)", JSON.stringify(record));
  const showing = r => args => { if (args[0] === "show") return JSON.stringify(r); if (args[0] === "diff") return ""; return ""; };
  const stopped = trialAt(SHA("a"), showing({ ...record, failedAfter: 0 }));
  ok(/2 checks that ran before measured nothing after the update in the trial on a real project, 2 stopped behind a failure/u.test(stopped.held ?? "") && /2 ran before and stopped after it behind a failure.*1 of the baselines taken by the release's check\.mjs from a clone of the core/u.test(stopped.said),
    "a trial with jobs that ran before and were stopped after holds the cut (#1257), the baseline from a clone of the core counted", `${stopped.said}\n${stopped.held}`);
  const clean = trialAt(SHA("a"), showing({ ...record, failedAfter: 0, stoppedAfter: 0 }));
  ok(clean.held === null && /0 ran before and stopped after it behind a failure/u.test(clean.said), "  and with none stopped, unrun or failed after, it holds nothing", clean.said);
  ok(clean.said.endsWith(BLIND) && /dependency review.*only on a real pull request.*core's own tests hold the dependency review's lists/u.test(BLIND), "  and what it says names the blind spot, GitHub's dependency review, which runs only on a real pull request, and that the core's own tests hold its lists (#1310)", clean.said);
  ok(trialAt(SHA("a"), showing(record)).held !== null, "  where one failed after, it holds the cut");
  ok(trialAt(SHA("a"), showing({ ...record, baselineFromClone: 3 })).held !== null, "  and a record with more baselines from a clone than projects is in no form it writes");

  // (point 6: run from a clone of the core with its packages missing, check.mjs says so with the command that installs them)
  ok(mended(`FAIL no workflow can be read here: ${notInstalled("yaml")}`) && /install\.mjs/u.test(notInstalled("yaml")), "a package missing is said with the command that installs it (#1245, point 6)", notInstalled("yaml"));
  const [what, mend] = notInstalled("yaml").split(". Mend: "), yaml = `FAIL no workflow can be read here: ${what}. Mend: ${mend}`;
  ok(!/\.\./u.test(yaml) && mended(yaml) && mend?.startsWith("run "), "and in one full stop before its mend, as check.mjs splits and words it (#1275, point 3)", yaml);

  // (point 7: a sync to a commit of the core's main past its newest release, as a trial makes, needs nothing)
  const core = path.join(tmp, "core");
  fs.mkdirSync(core); git(core, "init", "-q");
  const released = commit(core, "one.md", "1\n"); git(core, "tag", "release-1"); const unreleased = commit(core, "two.md", "2\n");
  const bare = path.join(tmp, "core.git"); execFileSync("git", ["clone", "-q", "--bare", "--", ".", bare], { cwd: core, stdio: ["ignore", "pipe", "pipe"] });
  const project = path.join(tmp, "project");
  fs.mkdirSync(project); git(project, "init", "-q"); commit(project, "core-manifest.md", "| *follows* | `releases` |\n");
  const sideSaid = [];
  const sayer = { way: (part, text) => sideSaid.push(["way", part, text]), unread: (part, text) => sideSaid.push(["unread", part, text]) };
  const side = sideOf(project, "core/", bare, { pin: unreleased, main: "HEAD" }, sayer);
  ok(side === null && sideSaid.length === 1 && sideSaid[0][0] === "unread" && /not yet a release: in a release's trial .*pure-sync\.mjs --trial [0-9a-f]{40}`.*nothing else is to be done/u.test(sideSaid[0][2]), "a sync to a commit of main past the newest release, as a trial makes, is said to need nothing in a trial, and is counted neither way (#1245, point 7)", JSON.stringify(sideSaid));
  ok(sideOf(project, "core/", bare, { pin: released, main: "HEAD" }, sayer) === released, "  and a sync to a release runs from that release");
}
done("check.mjs as a release's trial runs it");
