// Tests the core's mutation tool (scripts/mutate.mjs): the faults it puts in and those it leaves alone, the
// tests it runs a file's faults against, the report's form, and a run in a scratch repository: a fault a test catches,
// one that survives, one no test runs, a test that fails as it stands left out, and the project's own files left as
// they were. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/mutate-test.mjs
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { faults, report, testsOf } from "../scripts/mutate.mjs";
import { OWNER, foldedLoop, scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SCRIPT = fileURLToPath(new URL("../scripts/mutate.mjs", import.meta.url));
const pairs = src => faults(src).map(f => `${f.original}>${f.replacement}`);

// ---- the faults ----
ok(same(pairs("a === b; a !== b; a == b; a != b;"), ["===>!==", "!==>===", "==>!=", "!=>=="]), "an equality is turned");
ok(same(pairs("a < b; a <= b; a > b; a >= b;"), ["<><=", "<=><", ">>>=", ">=>>"]), "a comparison is turned at its edge");
ok(same(pairs("a && b || c;"), ["&&>||", "||>&&"]) && same(pairs("x = true; y = false; o.true;"), ["true>false", "false>true"]), "and and or are swapped, and true and false, but no name after a dot");
ok(same(pairs("if (!x) f(!y);"), ["!>", "!>"]) && same(pairs("a + b; c - 1; (d) + e;"), ["+>-", "->+", "+>-"]), "a ! is dropped, and + and - between two values swapped");
ok(same(pairs("x <<= 2; y >>> 1; i++; j -= 1; k += 2; z = -w; f(a => a); v &&= 1; u ??= 2;"), []), "no fault is put into a longer operator, a sign, an arrow or an assignment");
ok(same(pairs("s = 'a < b'; t = `x === ${y}`; r = /a<b/; // c && d\n"), []), "no fault is put into a string, a template's text, a pattern or a comment");
ok(same(faults("a === b;\nc === d;\n", line => line === 2).map(f => f.at), [11]), "only the lines wanted take faults");

// ---- the tests a file's faults run against ----
ok(same(testsOf("scripts/shape.mjs", { "scripts/dose-test.mjs": "from './shape.mjs'", "scripts/code-shape-test.mjs": "from './code-shape.mjs'", "scripts/shape-test.mjs": "from './shape.mjs'" }), ["scripts/shape-test.mjs", "scripts/dose-test.mjs"]),
  "a file's tests are those that name it, not a longer name ending in it, its own first");
// (a test that imports a file without its ending, or by its JavaScript ending, as TypeScript's are written: #1274)
ok(same(testsOf("src/game.ts", { "test/game.test.ts": "import { play } from '../src/game';", "test/board.test.ts": "import { play } from \"../src/game.js\";", "test/other.test.ts": "import '../src/game-board';\nimport '../src/endgame';", "test/data.test.ts": "const game = 1;" }), ["test/game.test.ts", "test/board.test.ts"]),
  "a test that imports the file without its ending, or by its JavaScript ending, names it; one that names a longer file, or holds the word alone, does not (#1274)");

// ---- the report ----
const r = report({ "a.js": "x === 1;\n" }, [{ file: "a.js", text: "x === 1;\n", at: 2, length: 3, original: "===", replacement: "!==", mutatorName: "EqualityOperator", status: "Killed" }]);
ok(r.schemaVersion === "1" && same(r.files["a.js"].mutants[0].location, { start: { line: 1, column: 3 }, end: { line: 1, column: 6 } }) && r.files["a.js"].source === "x === 1;\n", "the report is in the mutation-testing-elements schema, its places counted from 1 and its end past the fault");

// ---- a run, in a scratch repository ----
const dir = scratchDir("mutate-test-");
const git = (...args) => execFileSync("git", ["-c", "core.fsmonitor=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const write = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
const SOURCE = "export const big = x => x > 10;\nexport const same = (a, b) => a === b || false;\n";
try {
  git("init", "-q", "-b", "main"); git("config", "user.email", "t@example.invalid"); git("config", "user.name", "Test");
  write("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"], tests: ["test"] }));
  write("src/a.mjs", SOURCE);
  write("src/b.mjs", "export const yes = () => true;\n");
  write("test/a-test.mjs", "import { big, same } from '../src/a.mjs';\nif (big(5) || !big(20) || !same(1, 1)) process.exit(1);\n");
  write("test/broken-test.mjs", "import '../src/a.mjs';\nprocess.exit(1);\n");
  git("add", "-A"); git("commit", "-q", "-m", "base");
  const out = path.join(dir, "report.json");
  const run = spawnSync(process.execPath, [SCRIPT, "--report", out], { cwd: dir, encoding: "utf8", env: { ...process.env, CORE_OFFLINE: "" } });
  const got = JSON.parse(fs.readFileSync(out, "utf8")).files;
  const status = (file, line, replacement) => got[file]?.mutants.find(m => m.location.start.line === line && m.replacement === replacement)?.status;
  ok(run.status === 0 && status("src/a.mjs", 1, ">=") === "Survived" && status("src/a.mjs", 2, "!==") === "Killed" && status("src/b.mjs", 1, "false") === "NoCoverage", "a fault a test catches is Killed, one it does not Survived, one no test names NoCoverage", run.stdout + run.stderr);
  ok(run.stdout.includes("test/broken-test.mjs"), "a test that fails as it stands is left out, and the run says so", run.stdout);
  ok(!run.stdout.includes("the network is cut off here"), "and where the network stands, it does not say a test that reaches it may be among them", run.stdout);
  const cutRun = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:1-1"], { cwd: dir, encoding: "utf8", env: { ...process.env, CORE_OFFLINE: "1" } });
  ok(cutRun.stdout.includes("the network is cut off here, so a test that reaches it may be among them"), "where the network is cut off, it says a test that reaches it may be among those left out", cutRun.stdout + cutRun.stderr);
  ok(fs.readFileSync(path.join(dir, "src/a.mjs"), "utf8") === SOURCE && git("worktree", "list").trim().split("\n").length === 1 && git("status", "--porcelain").trim() === "?? report.json", "the project's own files are left as they were, and its working copies taken away", git("status", "--porcelain"));
  // (a link HEAD holds that the working folder has replaced by a file: the copy takes the file, writing nothing through
  // the link; links need a right of their own on Windows, so this case runs elsewhere)
  if (process.platform !== "win32") {
    write("kept.txt", "the project's own\n");
    fs.symlinkSync(path.join(dir, "kept.txt"), path.join(dir, "linked.txt")); // (to the project's own file, by its full path)
    git("add", "kept.txt", "linked.txt"); git("commit", "-q", "-m", "a link");
    fs.rmSync(path.join(dir, "linked.txt")); write("linked.txt", "a file now\n"); git("add", "linked.txt");
    spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:1-1"], { cwd: dir, encoding: "utf8" });
    ok(fs.readFileSync(path.join(dir, "kept.txt"), "utf8") === "the project's own\n", "a link HEAD holds, replaced by a file in the working folder, is not written through", fs.readFileSync(path.join(dir, "kept.txt"), "utf8"));
    git("rm", "-q", "-f", "kept.txt", "linked.txt"); git("commit", "-q", "-m", "no link");
  }
  // (a file deleted in the working folder and not yet committed is gone in the copies too)
  write("conf/old.json", "{}\n"); write("test/conf-test.mjs", "import fs from 'node:fs';\nimport { big } from '../src/a.mjs';\nif (fs.existsSync('conf/old.json') || big(5)) process.exit(1);\n");
  git("add", "conf/old.json", "test/conf-test.mjs"); git("commit", "-q", "-m", "a config");
  fs.rmSync(path.join(dir, "conf/old.json"));
  const deletedRun = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:1-1"], { cwd: dir, encoding: "utf8" });
  ok(deletedRun.status === 0 && !deletedRun.stdout.includes("test/conf-test.mjs"), "a file deleted in the working folder is gone in the copies, so a test that asks it gone passes there as it does here", deletedRun.stdout + deletedRun.stderr);
  git("rm", "-q", "-f", "--cached", "conf/old.json"); git("rm", "-q", "-f", "test/conf-test.mjs"); git("commit", "-q", "-m", "no config");
  const named = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:2-2"], { cwd: dir, encoding: "utf8" });
  const lines = new Set(JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"].mutants.map(m => m.location.start.line));
  ok(named.status === 0 && same([...lines], [2]), "the lines named alone take faults", named.stdout + named.stderr);
  // (a package the project installed, ignored by git, is reached from the working copies)
  write("package.json", "{}\n"); write(".gitignore", "node_modules/\n"); write("node_modules/limit/index.js", "module.exports = 20;\n");
  write("node_modules/.package-lock.json", "{}\n");
  if (process.platform !== "win32") fs.symlinkSync(path.join(dir, "gone"), path.join(dir, "node_modules", "dangling"));
  // (and the package's real path lies in the copy's own node_modules, as scripts/packages.mjs asks of the core's installs; #984)
  write("test/c-test.mjs", "import fs from 'node:fs';\nimport path from 'node:path';\nimport limit from 'limit';\nimport { big } from '../src/a.mjs';\nif (!fs.realpathSync('node_modules/limit/index.js').startsWith(fs.realpathSync('node_modules') + path.sep) || !big(limit)) process.exit(1);\n");
  git("add", "package.json", ".gitignore", "test/c-test.mjs");
  const installed = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:1-1"], { cwd: dir, encoding: "utf8" });
  const strict = JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"].mutants.find(m => m.replacement === ">=");
  ok(installed.status === 0 && !installed.stdout.includes("test/c-test.mjs") && strict?.status !== "NoCoverage" && fs.existsSync(path.join(dir, "node_modules/limit/index.js")), "a test that imports an installed package, which lies in its node_modules by its real path, runs in the working copies, as it does in the project, and what was installed stands after them", installed.stdout + installed.stderr + JSON.stringify(strict));
  // (a workspace's own package, linked from node_modules into the project, is reached in each copy as the copy's own)
  // (with a workspace link in node_modules, the copy's own folder holds a file by a copy, which needs no right to make a link, and leaves a dangling link out)
  write("src/ws/index.mjs", "export const flag = () => true;\n");
  fs.symlinkSync(path.join("..", "src", "ws"), path.join(dir, "node_modules", "ws"), "junction");
  write("test/ws-test.mjs", "import { flag } from 'ws/index.mjs';\nif (!flag()) process.exit(1);\n");
  git("add", "src/ws/index.mjs", "test/ws-test.mjs");
  // (and beside it, a link whose spelling leads back to itself, read by the system out of the project through a folder
  // link: the copy's folder is made, and the run ends)
  foldedLoop(dir, "node_modules/loop");
  const ws = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/ws/index.mjs"], { cwd: dir, encoding: "utf8", timeout: 300000, killSignal: "SIGKILL" });
  const wsFault = JSON.parse(fs.readFileSync(out, "utf8")).files["src/ws/index.mjs"]?.mutants.find(m => m.replacement === "false");
  ok(ws.status === 0 && wsFault?.status === "Killed" && fs.readFileSync(path.join(dir, "src/ws/index.mjs"), "utf8").includes("true"), "a test that imports the project's own workspace package through node_modules runs against the copy's faults", ws.stdout + ws.stderr + JSON.stringify(wsFault));
  git("rm", "-q", "-f", "--cached", "package.json", ".gitignore", "test/c-test.mjs", "src/ws/index.mjs", "test/ws-test.mjs");
  for (const f of ["package.json", ".gitignore", "test/c-test.mjs", "test/ws-test.mjs", "src/ws", "node_modules"]) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  write("test/b-test.mjs", "import { big } from '../src/a.mjs';\nif (big(10)) process.exit(1);\n");
  git("add", "test/b-test.mjs");
  const staged = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:1-1"], { cwd: dir, encoding: "utf8" });
  const edge = JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"].mutants.find(m => m.replacement === ">=");
  ok(staged.status === 0 && edge?.status === "Killed", "a test staged and not yet committed is run in the working copies", staged.stdout + staged.stderr + JSON.stringify(edge));
  // (with --every, each fault runs against every test that names its file, and names each that caught it)
  write("test/d-test.mjs", "import { big } from '../src/a.mjs';\nif (big(10)) process.exit(1);\n");
  write("src/barrel.mjs", "export { big } from './a.mjs';\n");
  write("test/e-test.mjs", "import { big } from '../src/barrel.mjs';\nif (big(10)) process.exit(1);\n");
  git("add", "test/d-test.mjs", "src/barrel.mjs", "test/e-test.mjs");
  spawnSync(process.execPath, [SCRIPT, "--report", out, "--every", "src/a.mjs:1-1"], { cwd: dir, encoding: "utf8" });
  const all = JSON.parse(fs.readFileSync(out, "utf8")), both = all.files["src/a.mjs"].mutants.find(m => m.replacement === ">=");
  spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:1-1"], { cwd: dir, encoding: "utf8" });
  const first = JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"].mutants.find(m => m.replacement === ">=");
  ok(both?.status === "Killed" && same([...both.killedBy].sort(), ["test/b-test.mjs", "test/d-test.mjs", "test/e-test.mjs"]) && "test/e-test.mjs" in all.testFiles && first?.killedBy?.length === 1,
    "a fault names the tests that caught it: with --every all of them, one through a barrel too, else the first", JSON.stringify({ both, first }));
  git("rm", "-q", "-f", "test/b-test.mjs", "test/d-test.mjs", "src/barrel.mjs", "test/e-test.mjs");
  const outside = spawnSync(process.execPath, [SCRIPT, "--report", out, "test/a-test.mjs"], { cwd: dir, encoding: "utf8" });
  const bare = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });
  ok(outside.status === 1 && mended(outside.stderr) && bare.status === 1 && mended(bare.stderr), "a file outside the code, and a run told no report, are refused with their mend", outside.stderr + bare.stderr);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

// ---- a test the run stops leaves no scratch folder behind (#934) ----
// A test stopped with SIGKILL runs no handler, so its scratch folder stays until the next test starts and takes away
// those whose process is gone; one whose process still runs is never taken.
{
  const scratchCore = path.join(path.dirname(SCRIPT), "scratch-core.mjs");
  const code = `import { scratchDir } from ${JSON.stringify(pathToFileURL(scratchCore).href)}; console.log(scratchDir("stopped-test-")); if (process.argv[1] === "wait") setInterval(() => {}, 1000);`;
  const start = mode => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", code, mode], { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", d => { out += d; if (out.includes("\n")) resolve({ child, dir: out.trim() }); });
    child.on("error", reject);
    child.on("close", () => resolve({ child, dir: out.trim() }));
  });
  const ended = child => new Promise(r => child.exitCode !== null || child.signalCode ? r() : child.on("close", r));
  const stopped = await start("wait"), running = await start("wait");
  stopped.child.kill("SIGKILL");
  await ended(stopped.child);
  const next = await start("end");
  await ended(next.child);
  ok(!fs.existsSync(stopped.dir), "the next test to start takes away the scratch folder of a test that was stopped", stopped.dir);
  ok(fs.existsSync(running.dir), "the scratch folder of a test still running is left where it is", running.dir);
  ok(!fs.existsSync(next.dir), "a test that ends takes away its own scratch folder as before");
  // (a folder another machine's process made, over a temporary folder shared between machines, is no business of this one's)
  const foreign = scratchDir("stopped-test-");
  fs.writeFileSync(path.join(foreign, OWNER), `${os.hostname()}-elsewhere:999999999`);
  await ended((await start("end")).child);
  ok(fs.existsSync(foreign), "the scratch folder of a process on another machine is left where it is", foreign);
  running.child.kill("SIGKILL");
  await ended(running.child);
  for (const dir of [running.dir, stopped.dir, foreign]) fs.rmSync(dir, { recursive: true, force: true });
}

// ---- no test makes its own folder under the temporary one (#965) ----
// A folder a test makes with mkdtemp there, removed only by its process's exit event, stays where the run was stopped;
// scratchDir (scripts/scratch-core.mjs) records its owner, so the next test takes it away. A folder made inside one
// scratchDir makes goes with it, and is no leak. Read from the text of each test and of the two scripts the tests share that make folders (scripts/hostile.mjs, scripts/licence-scan-stage.mjs), a line at a time.
{
  const leaks = text => text.split("\n").filter(line => !/^\s*\/\//.test(line) && /\bmkdtemp(?:Sync)?\(.*(?:tmpdir\(|TMPDIR|RUNNER_TEMP)/.test(line));
  const made = ["fs.mkdtemp", "Sync(path.join(os.tmp", "dir(), 'x-'))"].join(""), bare = ["mkdtemp", "Sync(join(tmp", "dir(), 'x-'))"].join(""), inside = ["fs.mkdtemp", "Sync(path.join(tmp, 'x-'))"].join("");
  ok(leaks(`const a = ${made};`).length === 1 && leaks(`  const b = ${bare};`).length === 1 && leaks(`const c = ${inside};\n// ${made}\nconst d = scratchDir("x-");`).length === 0, "a line that makes a folder under the temporary one with mkdtemp is a leak, one inside a scratch folder, a comment and scratchDir are not");
  const root = path.join(path.dirname(SCRIPT), "..");
  const files = [...fs.readdirSync(path.join(root, "tests")).filter(f => f.endsWith(".mjs")).map(f => `tests/${f}`), "scripts/hostile.mjs", "scripts/licence-scan-stage.mjs"];
  const found = files.flatMap(f => leaks(fs.readFileSync(path.join(root, f), "utf8")).map(line => `${f}: ${line.trim().slice(0, 100)}`));
  // (one exit listener serves all of a process's scratch folders: a test that makes one for each of its cases would pass Node's limit of ten)
  const listeners = process.listenerCount("exit");
  for (let i = 0; i < 12; i++) scratchDir("listeners-test-");
  ok(process.listenerCount("exit") === listeners, "scratchDir adds no exit listener of its own for each folder");
  ok(found.length === 0, "no test, and not scripts/hostile.mjs nor the staged project of the licence tests, makes a folder under the temporary one with mkdtemp: they use scratchDir", `${found.slice(0, 5).join("\n")}\nMend: replace the call with scratchDir(prefix) from scripts/scratch-core.mjs, which removes the folder at the process's exit or, if the run was stopped, at the next test's start, and delete the exit handler that removed it.`);
}

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
