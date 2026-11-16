// Tests the selection (select.mjs, beside this file): the pathspecs it reads, what a test reaches (its imports, and the
// files its code names outside a comment), and what a pull request runs: the tests a changed file can reach, a test it
// adds or changes, one that failed last time, the project's proof, never selected out, a test that reaches every file,
// the files no test reads, and the whole suite where a changed file's reach cannot be told or no base is told; then
// whole runs in a scratch repository, with what it writes for the steps after it, and each refusal read for its mend
// (mend.mjs). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/select-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { links, matcher, reached, selection } from "./select.mjs";
import { parseConfig, survey } from "./shape.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const script = fileURLToPath(new URL("./select.mjs", import.meta.url));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- the pathspecs ----
const m = matcher(["src", ":(glob)**/*.test.js", ":!src/gen/", "QUEUE.md"]);
ok(m("src/a.js") && m("src/deep/b.js") && m("lib/x.test.js") && m("QUEUE.md") && !m("src/gen/c.js") && !m("srcs/a.js") && !m("docs/QUEUE.md"),
  "a pathspec is a path or a folder above it, a glob, or one left out");
ok(matcher(["test/*-test.mjs"])("test/a-test.mjs") && matcher(["test/*-test.mjs"])("test/deep/b-test.mjs") && !matcher(["test/*-test.mjs"])("test/a.mjs") && matcher(["t?st/"])("test/") && matcher(["scripts/*-test.mjs"])("scripts/select-test.mjs")
  && matcher(["scripts/[ab]-test.mjs"])("scripts/a-test.mjs") && !matcher(["scripts/[ab]-test.mjs"])("scripts/c-test.mjs") && matcher(["scripts/[!ab]-test.mjs"])("scripts/c-test.mjs") && !matcher(["scripts/[!ab]-test.mjs"])("scripts/a-test.mjs"),
  "a plain pathspec with a wildcard matches as git's default does, across folders too");
ok(matcher(["."])("any/file.md") && !matcher([])("a.js") && matcher([":(glob)reports/*.md"])("reports/a.md") && !matcher([":(glob)reports/*.md"])("reports/deep/a.md"), "\".\" is every file, no pathspec none, and \"*\" stays within a folder");

// ---- what a test reaches ----
const config = parseConfig(JSON.stringify({ baseline: "b.json", code: ["src", "test"], tests: ["test/"], select: { proof: ["test/replay.test.js"], whole: ["test/kit.test.js"], none: ["QUEUE.md", "docs/"] } }));
const texts = {
  "src/rules.js": "export const rule = 1;\n",
  "src/view.js": "import { rule } from './rules.js';\nexport const view = rule;\n",
  "src/tool.js": "// view.js is only named here in a comment\nexport const tool = 2;\n",
  "src/run.js": "import { spawnSync } from 'node:child_process';\nspawnSync(process.execPath, ['src/tool.js']); // and rules.js only after the code\n",
  "src/lazy.js": "export const later = () => import('./rules.js');\n",
  "test/rules.test.js": "import { rule } from '../src/rules.js';\n",
  "test/view.test.js": "import { view } from '../src/view.js';\n",
  "test/run.test.js": "import '../src/run.js';\n",
  "test/lazy.test.js": "import '../src/lazy.js';\n",
  "test/replay.test.js": "import '../src/view.js';\n",
  "test/kit.test.js": "// copies the whole project\n",
  "test/helper.js": "export const fixture = 1;\n",
  "test/uses-helper.test.js": "import { fixture } from './helper.js';\n",
};
const tests = new Set(Object.keys(texts).filter(f => f.startsWith("test/") && f !== "test/helper.js"));
const reach = survey(texts, config, tests).reach, linked = links(texts, tests, reach), reaches = reached(tests, linked);
ok(reaches.get("test/view.test.js").has("src/rules.js") && reaches.get("test/run.test.js").has("src/tool.js") && reaches.get("test/lazy.test.js").has("src/rules.js"),
  "a test reaches what its imports reach, file to file, a file a script starts by its name and a dynamic import's", JSON.stringify([...reaches].map(([t, f]) => [t, [...f]])));
ok(!linked.get("src/tool.js").has("src/view.js") && !reaches.get("test/run.test.js").has("src/rules.js") && !reaches.get("test/rules.test.js").has("src/view.js"),
  "a name in a comment, before or after the code, links nothing, and an import points one way", JSON.stringify([...linked].map(([t, f]) => [t, [...f]])));

// ---- what a pull request runs ----
const pick = (changed, failed = []) => selection({ changed, texts, tests, reach, failed, config });
let s = pick(["src/rules.js"]);
ok(!s.all && same(s.tests, ["test/kit.test.js", "test/lazy.test.js", "test/replay.test.js", "test/rules.test.js", "test/view.test.js"]) && s.why.get("test/view.test.js") === "reaches src/rules.js" && /never selected out/.test(s.why.get("test/replay.test.js")) && /every file/.test(s.why.get("test/kit.test.js")),
  "a changed file runs each test that reaches it, the proof, never selected out, and a test that reaches every file; the others not", JSON.stringify([...s.why]));
s = pick(["src/tool.js"]);
ok(same(s.tests, ["test/kit.test.js", "test/replay.test.js", "test/run.test.js"]), "a script started by its name runs the test whose code starts it", JSON.stringify(s.tests));
s = pick(["test/rules.test.js", "QUEUE.md", "docs/guide.md"], ["test/lazy.test.js", "test/gone.test.js"]);
ok(same(s.tests, ["test/lazy.test.js", "test/replay.test.js", "test/rules.test.js"]) && s.why.get("test/rules.test.js") === "added or changed" && s.why.get("test/lazy.test.js") === "failed last time",
  "a test changed runs, one that failed last time runs, a file no test reads runs nothing, and a test that is gone is none", JSON.stringify([...s.why]));
s = pick(["test/helper.js"]);
ok(same(s.tests, ["test/replay.test.js", "test/uses-helper.test.js"]), "a helper among the tests runs each test that imports it", JSON.stringify(s.tests));
s = pick(["QUEUE.md"]);
ok(same(s.tests, ["test/replay.test.js"]), "a change to the files no test reads runs the proof alone", JSON.stringify(s.tests));
s = pick(["test/old-helper.js"]);
ok(s.all && /test\/old-helper\.js/.test(s.why), "a file gone from among the tests, a helper another test may still import, runs the whole suite", JSON.stringify(s));
const py = { "pkg/__init__.py": "raise RuntimeError('broken')\n", "pkg/rules.py": "def rule():\n    return 1\n", "tests/test_rules.py": "import pkg.rules\n" };
const pyConfig = parseConfig(JSON.stringify({ baseline: "b.json", code: ["pkg", "tests"], tests: ["tests/"] })), pyTests = new Set(["tests/test_rules.py"]);
s = selection({ changed: ["pkg/__init__.py"], texts: py, tests: pyTests, reach: survey(py, pyConfig, pyTests).reach, config: pyConfig });
ok(!s.all && same(s.tests, ["tests/test_rules.py"]), "a Python package's __init__.py, which runs on every import under it, reaches the tests that import the package", JSON.stringify(s));
const cs = { "src/Rules.cs": "namespace App;\npublic static class Rules { public static bool Allowed() => true; }\n", "tests/RulesTest.cs": "namespace Tests;\nclass RulesTest { void T() { App.Rules.Allowed(); } }\n", "web/app.js": "function draw() {}\n" };
const csConfig = parseConfig(JSON.stringify({ baseline: "b.json", code: ["src", "tests", "web"], tests: ["tests/"] })), csTests = new Set(["tests/RulesTest.cs"]), csFound = survey(cs, csConfig, csTests);
for (const f of ["src/Rules.cs", "web/app.js"]) {
  s = selection({ changed: [f], texts: cs, tests: csTests, reach: csFound.reach, scripts: csFound.scripts, config: csConfig });
  ok(s.all && s.why.includes(f), `${f === "web/app.js" ? "a script of the global space, which no import names," : "C#, whose types a test reaches by their full names with no using,"} runs the whole suite`, JSON.stringify(s));
}
s = selection({ changed: ["package.json"], texts: { ...texts, "package.json": "{\"dependencies\":{\"x\":\"1.0.0\"}}" }, tests, reach, config });
ok(s.all && /package\.json/.test(s.why), "a package's manifest, read beside the code, runs the whole suite: it links to no file, and may reach every test", JSON.stringify(s));
for (const [changed, what] of [[["package.json"], "a file of no code the readers follow"], [["src/gone.js"], "a file of code that is gone"], [["src/rules.js", "config/app.json"], "data beside code"]]) {
  s = pick(changed);
  ok(s.all && s.tests.length === tests.size && s.why.includes(changed.at(-1)), `the whole suite runs for ${what}: what reaches it cannot be told`, JSON.stringify(s));
}

// ---- whole runs, in a scratch repository ----
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "select-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
const git = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
const run = (args, env = {}) => { const r = spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, SELECT_BASE: "", GITHUB_ENV: "", GITHUB_STEP_SUMMARY: "", ...env } }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
git("init", "-q", "-b", "main");
for (const [f, t] of Object.entries(texts)) put(f, t);
put("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src", "test"], tests: ["test/"], select: { proof: ["test/replay.test.js"], none: ["QUEUE.md"] } }));
put("QUEUE.md", "# Queue\n");
git("add", "-A"); git("commit", "-q", "-m", "base");
put("src/tool.js", "export const tool = 3;\n"); put("QUEUE.md", "# Queue\n\n- one\n");
git("add", "-A"); git("commit", "-q", "-m", "change");
const envFile = path.join(dir, "env"), summary = path.join(dir, "summary");
let r = run(["--env", "RUN"], { SELECT_BASE: "HEAD^1", GITHUB_ENV: envFile, GITHUB_STEP_SUMMARY: summary });
ok(r.status === 0 && /2 of 8 tests/.test(r.out) && fs.readFileSync(envFile, "utf8") === "RUN= test/replay.test.js test/run.test.js \n" && fs.readFileSync(summary, "utf8").includes("test/run.test.js: reaches src/tool.js"),
  "against the base, it says what it ran and why, on the job's summary too, and writes the tests for the steps after it, each between spaces", `${r.out}\n${fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : ""}`);
if (process.platform !== "win32") { // (a name with a line's end in it cannot be made on Windows)
  put("test/odd\nNODE_OPTIONS=x.test.js", "import '../src/tool.js';\n"); git("add", "test/odd\nNODE_OPTIONS=x.test.js"); git("commit", "-q", "-m", "an odd name");
  fs.writeFileSync(envFile, "");
  r = run(["--env", "RUN"], { SELECT_BASE: "HEAD^1", GITHUB_ENV: envFile });
  ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=all\n" && /holds what a list of names cannot/.test(r.out), "a test whose name holds a line's end runs the whole suite, and sets no other variable", `${r.out}\n${fs.readFileSync(envFile, "utf8")}`);
  git("rm", "-q", "test/odd\nNODE_OPTIONS=x.test.js"); git("commit", "-q", "-m", "no odd name");
}
fs.writeFileSync(envFile, "");
r = run(["--env", "RUN"], { GITHUB_ENV: envFile });
ok(r.status === 0 && /the whole suite, 8 tests: no base is told/.test(r.out) && fs.readFileSync(envFile, "utf8") === "RUN=all\n", "with no base told, as on main, the whole suite runs", r.out);
put("failed.txt", "test/rules.test.js\n");
r = run(["checks/shape.json", "--failed", "failed.txt"], { SELECT_BASE: git("rev-list", "--max-parents=0", "HEAD").trim() });
ok(r.status === 0 && /test\/rules\.test\.js: failed last time/.test(r.out), "the tests that failed last time are read from the file named", r.out);
fs.renameSync(path.join(dir, "checks/shape.json"), path.join(dir, "checks/other.json"));
r = run([], { SELECT_BASE: "HEAD^1" });
ok(r.status === 0 && /the whole suite, all its tests: the shape check's config \(checks\/shape\.json\) cannot be read/.test(r.out), "where the shape check's config cannot be read, the whole suite runs", r.out);
fs.renameSync(path.join(dir, "checks/other.json"), path.join(dir, "checks/shape.json"));
for (const [args, env, what] of [
  [[], { SELECT_BASE: "no-such-branch" }, "a base that is no commit"],
  [[], { SELECT_BASE: "--output=x" }, "a base that is no plain name"],
  [["--failed", "nowhere.txt"], {}, "a file of failures that is not there"],
  [["--env", "run me"], {}, "a variable's name that is none"],
  [["--env", "RUN"], { GITHUB_ENV: "" }, "--env outside a workflow"],
  [["--all"], {}, "a word it does not know"],
]) { r = run(args, env); ok(r.status === 1 && mended(r.out), `refused, with its mend: ${what}`, r.out); }

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
