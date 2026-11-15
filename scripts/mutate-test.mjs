// Tests the core's mutation tool (mutate.mjs, beside this file): the faults it puts in and those it leaves alone, the
// tests it runs a file's faults against, the report's form, and a run in a scratch repository: a fault a test catches,
// one that survives, one no test runs, a test that fails as it stands left out, and the project's own files left as
// they were. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/mutate-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { faults, report, testsOf } from "./mutate.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SCRIPT = fileURLToPath(new URL("./mutate.mjs", import.meta.url));
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
  const named = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:2-2"], { cwd: dir, encoding: "utf8" });
  const lines = new Set(JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"].mutants.map(m => m.location.start.line));
  ok(named.status === 0 && same([...lines], [2]), "the lines named alone take faults", named.stdout + named.stderr);
  // (a package the project installed, ignored by git, is reached from the working copies)
  write("package.json", "{}\n"); write(".gitignore", "node_modules/\n"); write("node_modules/limit/index.js", "module.exports = 20;\n");
  write("test/c-test.mjs", "import limit from 'limit';\nimport { big } from '../src/a.mjs';\nif (!big(limit)) process.exit(1);\n");
  git("add", "package.json", ".gitignore", "test/c-test.mjs");
  const installed = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:1-1"], { cwd: dir, encoding: "utf8" });
  const strict = JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"].mutants.find(m => m.replacement === ">=");
  ok(installed.status === 0 && !installed.stdout.includes("test/c-test.mjs") && strict?.status !== "NoCoverage", "a test that imports an installed package runs in the working copies, as it does in the project", installed.stdout + installed.stderr + JSON.stringify(strict));
  git("rm", "-q", "-f", "--cached", "package.json", ".gitignore", "test/c-test.mjs");
  for (const f of ["package.json", ".gitignore", "test/c-test.mjs", "node_modules"]) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  write("test/b-test.mjs", "import { big } from '../src/a.mjs';\nif (big(10)) process.exit(1);\n");
  git("add", "test/b-test.mjs");
  const staged = spawnSync(process.execPath, [SCRIPT, "--report", out, "src/a.mjs:1-1"], { cwd: dir, encoding: "utf8" });
  const edge = JSON.parse(fs.readFileSync(out, "utf8")).files["src/a.mjs"].mutants.find(m => m.replacement === ">=");
  ok(staged.status === 0 && edge?.status === "Killed", "a test staged and not yet committed is run in the working copies", staged.stdout + staged.stderr + JSON.stringify(edge));
  git("rm", "-q", "-f", "test/b-test.mjs");
  const outside = spawnSync(process.execPath, [SCRIPT, "--report", out, "test/a-test.mjs"], { cwd: dir, encoding: "utf8" });
  const bare = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });
  ok(outside.status === 1 && mended(outside.stderr) && bare.status === 1 && mended(bare.stderr), "a file outside the code, and a run told no report, are refused with their mend", outside.stderr + bare.stderr);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
