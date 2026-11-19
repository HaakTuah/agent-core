// Tests Stryker's run as the core's mutation tool (scripts/stryker.mjs and scripts/stryker-plugin.mjs): the report the
// plug-in writes as the run goes, each fault's tests and their limits, the options Stryker is given and the refusals;
// and, with --tool <the folder Stryker is installed in>, a run in a scratch repository with Stryker itself: a fault a
// test catches, one that survives, a test that fails as it stands left out, the faults past the budget not run, and
// the project's own files left as they were. Run by the core's tests workflow (.github/workflows/tests.yml): without
// --tool in the suites, and with it in the step that installs Stryker for the tests' strength.
//
//   node tests/stryker-test.mjs [--tool <folder>]
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { limitOf } from "../scripts/mutate.mjs";
import { coreReporter, named, progress, strykerPlugins } from "../scripts/stryker-plugin.mjs";
import { asItStands, counted, dispatch, optionsOf, stopTests, testsFor, word } from "../scripts/stryker.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SCRIPT = fileURLToPath(new URL("../scripts/stryker.mjs", import.meta.url));
const at = process.argv.indexOf("--tool"), TOOL = at >= 0 ? path.resolve(process.argv[at + 1]) : null;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "stryker-test-"));

try {
  // ---- the report, as the run goes ----
  const cwd = path.join(scratch, "p"), file = path.join(cwd, "src", "a.mjs");
  const plan = (id, line, kind = "Run", status) => ({ plan: kind, mutant: { id, fileName: file, mutatorName: "EqualityOperator", replacement: "!==", location: { start: { line, column: 2 }, end: { line, column: 5 } }, ...(status ? { status } : {}) } });
  const state = progress({ cwd, read: () => "x === 1;\ny === 2;\n" });
  const first = state.plan([plan("0", 0), plan("1", 1, "EarlyResult", "Ignored")]);
  const m0 = first.report.files["src/a.mjs"].mutants[0];
  ok(named(file, cwd) === "src/a.mjs" && same(first.of, { 0: "src/a.mjs", 1: "src/a.mjs" }) && first.report.schemaVersion === "1" && first.report.files["src/a.mjs"].source === "x === 1;\ny === 2;\n",
    "once the faults are planned, the report holds each file by its name from the run's folder, with its text, and the plan each fault's file");
  ok(m0.status === "Pending" && same(m0.location, { start: { line: 1, column: 3 }, end: { line: 1, column: 6 } }) && first.report.files["src/a.mjs"].mutants[1].status === "Ignored",
    "a fault planned to run is not run yet, its place counted from 1; one Stryker judged early keeps its status");
  const then = state.tested({ id: "0", status: "Killed", killedBy: ["0"], statusReason: "a long output", mutatorName: "EqualityOperator", replacement: "!==", location: m0.location });
  ok(then.files["src/a.mjs"].mutants[0].status === "Killed" && !("statusReason" in then.files["src/a.mjs"].mutants[0]) && !("killedBy" in then.files["src/a.mjs"].mutants[0]), "a fault tested takes its status, and neither what a test printed nor the command runner's name for its command");
  const end = state.ended({ files: { "src/a.mjs": { language: "javascript", source: "s", mutants: [{ id: "0", status: "Survived", statusReason: "x", mutatorName: "M", replacement: "r", location: m0.location }] } } });
  ok(end.files["src/a.mjs"].source === "s" && end.files["src/a.mjs"].mutants.length === 1 && end.files["src/a.mjs"].mutants[0].status === "Survived" && !("statusReason" in end.files["src/a.mjs"].mutants[0]),
    "once the run ends, the report is Stryker's own, with nothing a test printed");
  let threw = false;
  try { coreReporter({}); } catch { threw = true; }
  const files = path.join(scratch, "written"), sources = path.join(scratch, "sources.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "x === 1; /* as Stryker rewrote it */\n");
  fs.writeFileSync(sources, JSON.stringify({ [named(file)]: "x === 1;\n" }));
  const reporter = (fs.mkdirSync(files), coreReporter({ coreRun: { report: path.join(files, "r.json"), plan: path.join(files, "plan.json"), sources } }));
  reporter.onMutationTestingPlanReady({ mutantPlans: [plan("0", 0)] });
  ok(JSON.parse(fs.readFileSync(path.join(files, "r.json"), "utf8")).files[named(file)]?.source === "x === 1;\n", "the plug-in writes each file's text as it stood before Stryker wrote its own into it, which its faults' places count in");
  reporter.onMutationTestReportReady({ files: {} });
  ok(same(fs.readdirSync(files).sort(), ["plan.json", "r.json"]) && JSON.parse(fs.readFileSync(path.join(files, "r.json"), "utf8")).schemaVersion === "1",
    "the plug-in writes each file whole beside its place and moves it there, leaving nothing half written", fs.readdirSync(files).join(", "));
  ok(threw && strykerPlugins[0].kind === "Reporter" && strykerPlugins[0].name === "core-report" && same(coreReporter.inject, ["options"]), "the plug-in is a reporter that takes Stryker's options, and refuses to run without its paths");

  // ---- each fault's tests, and their limits ----
  const map = { files: { "src/a.mjs": ["test/a-test.mjs", "test/b-test.mjs"] }, plan: path.join(scratch, "plan.json"), asIs: path.join(scratch, "as-is") };
  fs.mkdirSync(map.asIs);
  const planned = () => ({ 7: "src/a.mjs", 8: "src/other.mjs" });
  fs.writeFileSync(map.plan, JSON.stringify(planned()));
  ok(same(testsFor(map, undefined, planned), []) && same(testsFor(map, "7", planned), map.files["src/a.mjs"]) && same(testsFor(map, "8", planned), []),
    "a fault runs the tests of its file; Stryker's first run, and a file with none, runs no test");
  const calls = [], fake = results => (test, seconds, env) => { const on = "__STRYKER_ACTIVE_MUTANT__" in env; calls.push([test, seconds, on ? "with the fault" : "as it stands"]); return results[`${test}${on ? " with" : ""}`]; };
  process.env.__STRYKER_ACTIVE_MUTANT__ = "7";
  const run1 = fake({ "test/a-test.mjs": { result: "failed", took: 1 }, "test/b-test.mjs": { result: "passed", took: 2 }, "test/b-test.mjs with": { result: "failed", took: 1 } });
  const caught = await dispatch(map, "7", run1);
  ok(caught === 1 && same(calls, [["test/a-test.mjs", 60, "as it stands"], ["test/b-test.mjs", 60, "as it stands"], ["test/b-test.mjs", limitOf(2), "with the fault"]]),
    "a test is run as it stands first, with no fault switched on; one that fails there is left out; the next, with the fault in, is held to mutate.mjs's limit, and its failing catches the fault", JSON.stringify(calls));
  calls.length = 0;
  ok(await dispatch(map, "7", fake({ "test/b-test.mjs with": { result: "passed", took: 2 } })) === 0 && same(calls, [["test/b-test.mjs", limitOf(2), "with the fault"]]),
    "a test is run as it stands once for the whole run, and a fault no test fails on survives", JSON.stringify(calls));
  ok((await asItStands("test/a-test.mjs", map.asIs, () => { throw new Error("run again"); })).result === "failed", "a test's run as it stands is kept for the faults after");
  ok(await dispatch(map, "7", fake({ "test/b-test.mjs with": { result: "timeout", took: 9 } })) === 1, "a test past its limit with the fault in catches it");
  // (a real test past its limit, which leaves a process of its own running: it is stopped with it, off Windows, where
  // a test runs in a group of its own)
  if (process.platform !== "win32") {
    const slowDir = path.join(scratch, "slow"), pidAt = path.join(slowDir, "child.pid");
    fs.mkdirSync(slowDir);
    fs.writeFileSync(path.join(slowDir, "slow-test.mjs"), `import { spawn } from "node:child_process";\nimport fs from "node:fs";\nconst c = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });\nfs.writeFileSync(${JSON.stringify(pidAt)}, String(c.pid));\nawait new Promise(r => setTimeout(r, 60000));\n`);
    const slowMap = { files: { "src/a.mjs": [path.join(slowDir, "slow-test.mjs")] }, plan: map.plan, asIs: path.join(slowDir, "as-is") };
    fs.mkdirSync(slowMap.asIs);
    fs.writeFileSync(path.join(slowMap.asIs, `${Buffer.from(slowMap.files["src/a.mjs"][0]).toString("hex")}.json`), JSON.stringify({ result: "passed", took: -3 }));
    process.env.__STRYKER_ACTIVE_MUTANT__ = "7";
    const started = Date.now(), slow = await dispatch(slowMap, "7");
    delete process.env.__STRYKER_ACTIVE_MUTANT__;
    const pid = Number(fs.readFileSync(pidAt, "utf8"));
    // (a process killed is gone once it is reaped, a moment after: up to 2 s, read from /proc where it stands)
    const gone = () => { try { return !fs.existsSync(`/proc/${pid}`) || /^\S+ \(.*\) [ZX]/u.test(fs.readFileSync(`/proc/${pid}/stat`, "utf8")); } catch { return true; } };
    for (let i = 0; i < 20 && !gone(); i++) await new Promise(r => setTimeout(r, 100));
    let alive = !gone();
    if (!fs.existsSync("/proc")) { try { process.kill(pid, 0); alive = true; } catch { alive = false; } }
    if (alive) process.kill(pid, "SIGKILL");
    ok(slow === 1 && Date.now() - started < 30000 && !alive, "a test past its limit is stopped with every process it started, and the fault is caught", `alive: ${alive}`);
    // (the dispatcher stopped mid-test, as Stryker's stop stops it: the test it named is stopped by stopTests, with all
    // it started)
    fs.rmSync(pidAt, { force: true });
    const groupsAt = path.join(slowDir, "groups"), mapAt = path.join(slowDir, "tests.json");
    fs.mkdirSync(groupsAt);
    fs.writeFileSync(mapAt, JSON.stringify({ ...slowMap, groups: groupsAt }));
    const d = spawn(process.execPath, [SCRIPT, "--tests", mapAt], { env: { ...process.env, __STRYKER_ACTIVE_MUTANT__: "7" }, stdio: "ignore" });
    for (let i = 0; i < 100 && !(fs.existsSync(pidAt) && fs.readdirSync(groupsAt).length); i++) await new Promise(r => setTimeout(r, 100));
    const test = Number(fs.readdirSync(groupsAt)[0]), grandchild = Number(fs.readFileSync(pidAt, "utf8"));
    d.kill("SIGKILL");
    await new Promise(r => d.on("exit", r));
    stopTests(groupsAt);
    const left = [test, grandchild].filter(p => { for (let i = 0; i < 20; i++) { try { const st = fs.readFileSync(`/proc/${p}/stat`, "utf8"); if (/^\S+ \(.*\) [ZX]/u.test(st)) return false; } catch { return false; } spawnSync("sleep", ["0.1"]); } return true; });
    for (const p of left) try { process.kill(p, "SIGKILL"); } catch { /* (gone) */ }
    ok(test > 0 && grandchild > 0 && !left.length && !fs.readdirSync(groupsAt).length, "a test its dispatcher was stopped in the middle of is stopped, with all it started, once Stryker is", `left: ${left.join(", ") || "none"}`);
  }
  delete process.env.__STRYKER_ACTIVE_MUTANT__;
  ok(same(counted({ files: { a: { mutants: [{ status: "Killed" }, { status: "Pending" }, { status: "Killed" }] } } }), { Killed: 2, Pending: 1 }), "a report's faults are counted by their status");

  // ---- the options Stryker is given ----
  const o = optionsOf({ mutate: ["src/a.mjs:1-2"], mapAt: "/x/tests.json", scratch: "/x", report: "/x/r.json", plan: "/x/plan.json", sources: "/x/s.json", concurrency: 2 });
  ok(o.testRunner === "command" && o.inPlace && o.coverageAnalysis === "off" && o.commandRunner.command.endsWith(`--tests ${word("/x/tests.json")}`) && same(o.reporters, ["core-report"]) && o.plugins[0].endsWith("stryker-plugin.mjs") && same(o.coreRun, { report: "/x/r.json", plan: "/x/plan.json", sources: "/x/s.json" }) && same(o.mutate, ["src/a.mjs:1-2"]),
    "Stryker runs this script's tests for each fault by its command runner, in place, with the core's reporter alone");
  const refused = (p, windows) => { try { word(p, windows); return false; } catch (e) { return mended(`FAIL: ${e.message}`); } };
  ok(refused("/x/a\nb", false) && refused("/x/a%PATH%b", true) && refused('/x/"a"', true) && !refused('/x/"a"', false), "a path no shell's word can hold as it is, a line break anywhere, or a % or double quote on Windows, is refused, saying the mend");
  if (process.platform !== "win32") {
    const odd = "/tmp/a $HOME `id` 'q' \\ \"d\"";
    ok(spawnSync("sh", ["-c", `printf %s ${word(odd)}`], { encoding: "utf8" }).stdout === odd, "a path is one word of the shell, read as it is written: nothing in it is expanded");
  }
  const bare = spawnSync(process.execPath, [SCRIPT, "--report", path.join(scratch, "r.json")], { encoding: "utf8" });
  const none = spawnSync(process.execPath, [SCRIPT, "--tool", path.join(scratch, "none"), "--report", path.join(scratch, "r.json")], { encoding: "utf8" });
  ok(bare.status === 1 && mended(bare.stderr) && none.status === 1 && /Stryker is not installed in/.test(none.stderr) && mended(none.stderr) && /npm ci --ignore-scripts/.test(none.stderr),
    "a run not told where Stryker is, or told a folder it is not installed in, fails, saying the mend", `${bare.stderr}\n${none.stderr}`);

  // ---- a run with Stryker itself, in a scratch repository ----
  if (TOOL) {
    const dir = path.join(scratch, "repo");
    fs.mkdirSync(dir);
    const git = (...args) => execFileSync("git", ["-c", "core.fsmonitor=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const write = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
    const SOURCE = "export const big = x => x > 10;\nexport const same = (a, b) => a === b;\n";
    git("init", "-q", "-b", "main"); git("config", "user.email", "t@example.invalid"); git("config", "user.name", "Test");
    write("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"], tests: ["test"] }));
    write("src/a.mjs", SOURCE);
    write("test/a-test.mjs", "import { big, same } from '../src/a.mjs';\nif (big(5) || !big(20) || !same(1, 1) || same(1, 2)) process.exit(1);\n");
    write("test/broken-test.mjs", "import '../src/a.mjs';\nprocess.exit(1);\n");
    git("add", "-A"); git("commit", "-q", "-m", "base");
    const out = path.join(dir, "report.json");
    const run = spawnSync(process.execPath, [SCRIPT, "--tool", TOOL, "--report", out], { cwd: dir, encoding: "utf8" });
    const got = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"]?.mutants ?? [] : [];
    const on = (line, status) => got.some(m => m.location.start.line === line && m.status === status);
    ok(run.status === 0 && on(1, "Survived") && on(2, "Killed") && !got.some(m => m.status === "Pending"), "with Stryker: a fault a test catches is Killed, one it does not Survived, every fault run", `${run.stdout}${run.stderr}`);
    ok(run.stdout.includes("left out, failing or past 60 s as they stand: test/broken-test.mjs"), "a test that fails as it stands is left out, and the run says so", run.stdout);
    ok(fs.readFileSync(path.join(dir, "src/a.mjs"), "utf8") === SOURCE && git("worktree", "list").trim().split("\n").length === 1 && git("status", "--porcelain").trim() === "?? report.json",
      "the project's own files are left as they were, and the working copy taken away", git("status", "--porcelain"));
    write("test/a-test.mjs", `${fs.readFileSync(path.join(dir, "test/a-test.mjs"), "utf8")}await new Promise(r => setTimeout(r, 4000));\n`);
    const slow = spawnSync(process.execPath, [SCRIPT, "--tool", TOOL, "--report", out, "--budget", "6", "src/a.mjs:1-2"], { cwd: dir, encoding: "utf8" });
    const late = JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"]?.mutants ?? [];
    ok(slow.status === 0 && late.some(m => m.status === "Pending") && JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"].source === SOURCE && /not run \(the budget\)/.test(slow.stdout), "past its budget, Stryker is stopped and the faults it did not run are written as not run", `${slow.stdout}${slow.stderr}`);
    // (a run stopped by a signal stops Stryker and all it started before it takes its working copy away, off Windows)
    if (process.platform !== "win32") {
      const strykers = () => spawnSync("pgrep", ["-f", `${TOOL}/node_modules/@stryker-mutator/core/bin/stryker.js run`], { encoding: "utf8" }).stdout.trim();
      const child = spawn(process.execPath, [SCRIPT, "--tool", TOOL, "--report", out, "src/a.mjs:1-2"], { cwd: dir, stdio: "ignore" });
      for (let i = 0; i < 100 && !strykers(); i++) await new Promise(r => setTimeout(r, 100));
      const was = strykers();
      child.kill("SIGTERM");
      await new Promise(r => child.on("exit", r));
      ok(was && !strykers() && git("worktree", "list").trim().split("\n").length === 1, "a run stopped by a signal stops Stryker with it, and takes its working copy away", `before: ${was || "none"}; after: ${strykers() || "none"}`);
    }
  } else console.log("note the run with Stryker itself needs --tool <the folder it is installed in>: the tests workflow gives it in the step that installs Stryker");
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
