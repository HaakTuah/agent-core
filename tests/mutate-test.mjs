// Tests the core's mutation tool (scripts/mutate.mjs): the faults it puts in and those it leaves alone, the
// tests it runs a file's faults against, the report's form, and a run in a scratch repository: a fault a test catches,
// one that survives, one no test runs, a test that fails as it stands left out, and the project's own files left as
// they were. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/mutate-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { faults, report, testsOf } from "../scripts/mutate.mjs";

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

// ---- the report ----
const r = report({ "a.js": "x === 1;\n" }, [{ file: "a.js", text: "x === 1;\n", at: 2, length: 3, original: "===", replacement: "!==", mutatorName: "EqualityOperator", status: "Killed" }]);
ok(r.schemaVersion === "1" && same(r.files["a.js"].mutants[0].location, { start: { line: 1, column: 3 }, end: { line: 1, column: 6 } }) && r.files["a.js"].source === "x === 1;\n", "the report is in the mutation-testing-elements schema, its places counted from 1 and its end past the fault");

// ---- a run, in a scratch repository ----
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutate-test-"));
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
  const run = spawnSync(process.execPath, [SCRIPT, "--report", out], { cwd: dir, encoding: "utf8" });
  const got = JSON.parse(fs.readFileSync(out, "utf8")).files;
  const status = (file, line, replacement) => got[file]?.mutants.find(m => m.location.start.line === line && m.replacement === replacement)?.status;
  ok(run.status === 0 && status("src/a.mjs", 1, ">=") === "Survived" && status("src/a.mjs", 2, "!==") === "Killed" && status("src/b.mjs", 1, "false") === "NoCoverage", "a fault a test catches is Killed, one it does not Survived, one no test names NoCoverage", run.stdout + run.stderr);
  ok(run.stdout.includes("test/broken-test.mjs"), "a test that fails as it stands is left out, and the run says so", run.stdout);
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
  write("node_modules/.package-lock.json", "{}\n"); // (a file of node_modules is copied, needing no right to make a link)
  if (process.platform !== "win32") fs.symlinkSync(path.join(dir, "gone"), path.join(dir, "node_modules", "dangling")); // (left out)
  write("test/c-test.mjs", "import limit from 'limit';\nimport { big } from '../src/a.mjs';\nif (!big(limit)) process.exit(1);\n");
  git("add", "package.json", ".gitignore", "test/c-test.mjs");
  const installed = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:1-1"], { cwd: dir, encoding: "utf8" });
  const strict = JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"].mutants.find(m => m.replacement === ">=");
  ok(installed.status === 0 && !installed.stdout.includes("test/c-test.mjs") && strict?.status !== "NoCoverage" && fs.existsSync(path.join(dir, "node_modules/limit/index.js")), "a test that imports an installed package runs in the working copies, as it does in the project, and what was installed stands after them", installed.stdout + installed.stderr + JSON.stringify(strict));
  // (a workspace's own package, linked from node_modules into the project, is reached in each copy as the copy's own)
  write("src/ws/index.mjs", "export const flag = () => true;\n");
  fs.symlinkSync(path.join("..", "src", "ws"), path.join(dir, "node_modules", "ws"), "junction");
  write("test/ws-test.mjs", "import { flag } from 'ws/index.mjs';\nif (!flag()) process.exit(1);\n");
  git("add", "src/ws/index.mjs", "test/ws-test.mjs");
  const ws = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/ws/index.mjs"], { cwd: dir, encoding: "utf8" });
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

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
