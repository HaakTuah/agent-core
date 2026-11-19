// Tests the selection (scripts/select.mjs): the pathspecs it reads, what a test reaches (its imports, and the
// files its code names outside a comment), and what a pull request runs: the tests a changed file can reach, a test it
// adds or changes, one that failed last time, the project's proof, never selected out, a test that reaches every file,
// the files no test reads, and the whole suite where a changed file's reach cannot be told or no base is told; then
// whole runs in a scratch repository, with what it writes for the steps after it, and each refusal read for its mend
// (mend.mjs). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-test.mjs
import { execFileSync, spawn, spawnSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { links, matcher, passedWhole, reached, selection } from "../scripts/select.mjs";
import { parseConfig, survey } from "../scripts/shape.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const script = fileURLToPath(new URL("../scripts/select.mjs", import.meta.url));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- the pathspecs ----
const m = matcher(["src", ":(glob)**/*.test.js", ":!src/gen/", "QUEUE.md"]);
ok(m("src/a.js") && m("src/deep/b.js") && m("lib/x.test.js") && m("QUEUE.md") && !m("src/gen/c.js") && !m("srcs/a.js") && !m("docs/QUEUE.md"),
  "a pathspec is a path or a folder above it, a glob, or one left out");
ok(matcher(["test/*-test.mjs"])("test/a-test.mjs") && matcher(["test/*-test.mjs"])("test/deep/b-test.mjs") && !matcher(["test/*-test.mjs"])("test/a.mjs") && matcher(["t?st/"])("test/") && matcher(["scripts/*-test.mjs"])("scripts/select-test.mjs")
  && matcher(["scripts/[ab]-test.mjs"])("scripts/a-test.mjs") && !matcher(["scripts/[ab]-test.mjs"])("scripts/c-test.mjs") && matcher(["scripts/[!ab]-test.mjs"])("scripts/c-test.mjs") && !matcher(["scripts/[!ab]-test.mjs"])("scripts/a-test.mjs"),
  "a plain pathspec with a wildcard matches as git's default does, across folders too");
ok(matcher(["."])("any/file.md") && !matcher([])("a.js") && matcher([":(glob)reports/*.md"])("reports/a.md") && !matcher([":(glob)reports/*.md"])("reports/deep/a.md"), "\".\" is every file, no pathspec none, and \"*\" stays within a folder");
ok(matcher([":(glob)src/**/*.js"])("src/a.js") && matcher([":(glob)src/**/*.js"])("src/a/b/c.js") && !matcher([":(glob)src/**/*.js"])("srcx/a.js") && matcher([":(glob)**/x"])("x") && matcher([":(glob)**/x"])("a/x")
  && matcher([":(glob)**/generated/**"])("src/generated/a.js") && matcher([":(glob)**/generated/**"])("generated/a.js") && !matcher([":(glob)**/generated/**"])("src/notgenerated/a.js") && !matcher([":(glob)a/**/b"])("a/xb")
  && matcher([":(glob)a?[b]"])("a?[b]") && !matcher([":(glob)a?[b]"])("axb") && matcher(["a**b"])("a/c/b"), "a glob's \"**/\" is any whole folders or none, never part of a folder's name, and its \"?\" and \"[\" are themselves; runs of \"*\" are one");
{
  // (in time that grows with the path's length, whatever runs of wildcards the pathspec holds)
  const from = Date.now();
  const none = [matcher([`${"*".repeat(60)}b`])("a".repeat(5000)), matcher([`:(glob)${"**/".repeat(40)}${"*".repeat(40)}b`])("a/".repeat(2000)), matcher([`:(glob)${"a*".repeat(60)}b`])("a".repeat(5000)), matcher([`${"a*".repeat(60)}b`])("a".repeat(5000))];
  ok(none.every(m => m === false) && Date.now() - from < 5000, "a pathspec of many wildcards is matched in time that grows with the path's length", `${none}, ${Date.now() - from} ms`);
}

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
ok(!linked.get("src/tool.js").has("src/view.js") && reaches.get("test/run.test.js").has("src/rules.js") && !reaches.get("test/rules.test.js").has("src/view.js"),
  "a name in a line that only a comment opens links nothing, one after the code links (more, never less), and an import points one way", JSON.stringify([...linked].map(([t, f]) => [t, [...f]])));
ok(links({ "a.js": "class A {\n  *run() { spawn('b.js'); }\n}\n", "b.js": "" }, new Set(), new Map()).get("a.js").has("b.js"), "a generator's line that opens with * is code, not a comment");

// ---- what a pull request runs ----
const pick = (changed, failed = []) => selection({ changed, texts, tests, reach, failed, config });
let s = pick(["src/rules.js"]);
ok(!s.all && same(s.tests, ["test/kit.test.js", "test/lazy.test.js", "test/replay.test.js", "test/rules.test.js", "test/run.test.js", "test/view.test.js"]) && s.why.get("test/view.test.js") === "reaches src/rules.js" && /never selected out/.test(s.why.get("test/replay.test.js")) && /every file/.test(s.why.get("test/kit.test.js")),
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
// (what only running the code tells: a test that reaches such an import runs as one that reaches every file)
const blindTexts = { "src/a.js": "export const a = 1;\n", "src/plugins.js": "export const load = n => import(`./p/${n}.js`);\n", "src/view.vue.js": "import App from './App.vue';\n", "src/b.js": "export const b = 2;\n",
  "test/a.test.js": "import '../src/a.js';\n", "test/plugins.test.js": "import '../src/plugins.js';\n", "test/vue.test.js": "import '../src/view.vue.js';\n", "test/b.test.js": "import '../src/b.js';\n", "src/env.d.ts": "declare const X: number;\n" };
const blindConfig = parseConfig(JSON.stringify({ baseline: "b.json", code: ["src", "test"], tests: ["test/"] })), blindTests = new Set(Object.keys(blindTexts).filter(f => f.startsWith("test/"))), blindFound = survey(blindTexts, blindConfig, blindTests);
s = selection({ changed: ["src/b.js"], texts: blindTexts, tests: blindTests, reach: blindFound.reach, unsure: blindFound.unsure, config: blindConfig });
ok(same(s.tests, ["test/b.test.js", "test/plugins.test.js", "test/vue.test.js"]) && blindFound.unsure.has("src/plugins.js") && blindFound.unsure.has("src/view.vue.js") && !blindFound.unsure.has("src/a.js"),
  "a test that reaches a computed import, or an import of a file the readers do not read, runs on any change", JSON.stringify({ s, unsure: [...blindFound.unsure] }));
s = selection({ changed: ["src/env.d.ts"], texts: blindTexts, tests: blindTests, reach: blindFound.reach, config: blindConfig });
ok(s.all && /env\.d\.ts/.test(s.why), "a declaration of types, which no import may name, runs the whole suite", JSON.stringify(s));
const pyMore = { "pkg/__init__.py": "", "pkg/db.py": "def connect():\n    return 1\n", "pkg/plugins.py": "def p():\n    return 2\n", "tests/conftest.py": "from pkg.db import connect\n", "tests/test_x.py": "def test_x(db):\n    assert db\n", "tests/test_load.py": "import importlib\nm = importlib.import_module('pkg.plugins')\n", "tests/fixtures/child.py": "import pkg.db\n", "tests/test_child.py": "import subprocess, sys\nsubprocess.run([sys.executable, 'tests/fixtures/child.py'])\n" };
const pyMoreConfig = parseConfig(JSON.stringify({ baseline: "b.json", code: ["pkg", "tests"], tests: ["tests/"] })), pyMoreTests = new Set(Object.keys(pyMore).filter(f => f.startsWith("tests/"))), pyMoreFound = survey(pyMore, pyMoreConfig, pyMoreTests);
const pick2 = f => selection({ changed: [f], texts: pyMore, tests: pyMoreTests, reach: pyMoreFound.reach, unsure: pyMoreFound.unsure, config: pyMoreConfig }).tests;
const rootConftest = selection({ changed: ["pkg/db.py"], texts: pyMore, tests: pyMoreTests, reach: pyMoreFound.reach, unread: ["conftest.py"], config: pyMoreConfig }).tests;
ok(same(rootConftest, [...pyMoreTests].sort()), "where pytest runs a conftest.py the config does not read, each test of Python runs on any change", JSON.stringify(rootConftest));
const ws = { "packages/app/package.json": JSON.stringify({ name: "@fixture/app", main: "src/legacy.mjs", exports: "./src/actual.mjs" }), "packages/app/src/legacy.mjs": "export const v = 1;\n", "packages/app/src/actual.mjs": "export const v = 2;\n", "test/app.test.mjs": "import { v } from '@fixture/app';\n", "test/other.test.mjs": "export {};\n" };
const wsConfig = parseConfig(JSON.stringify({ baseline: "b.json", code: ["packages", "test"], tests: ["test/"] })), wsTests = new Set(["test/app.test.mjs", "test/other.test.mjs"]), wsFound = survey(ws, wsConfig, wsTests);
ok(same(selection({ changed: ["packages/app/src/actual.mjs"], texts: ws, tests: wsTests, reach: wsFound.reach, unsure: wsFound.unsure, config: wsConfig }).tests, ["test/app.test.mjs"]),
  "a test that imports a package of the project's own that maps its entrances (\"exports\") runs on any change", JSON.stringify([...wsFound.unsure]));
const srcRoot = { "src/pkg/rules.py": "def r():\n    return 1\n", "tests/test_dyn.py": "import importlib\nm = importlib.import_module('pkg.rules')\n", "tests/test_none.py": "def test():\n    pass\n" };
const srcConfig = parseConfig(JSON.stringify({ baseline: "b.json", code: ["src", "tests"], tests: ["tests/"] })), srcTests = new Set(["tests/test_dyn.py", "tests/test_none.py"]), srcFound = survey(srcRoot, srcConfig, srcTests);
ok(selection({ changed: ["src/pkg/rules.py"], texts: srcRoot, tests: srcTests, reach: srcFound.reach, unsure: srcFound.unsure, config: srcConfig }).tests.includes("tests/test_dyn.py"),
  "Python's import_module, a plain string's too, marks its test as reaching any file: the name resolves against roots the readers do not know", JSON.stringify([...srcFound.unsure]));
ok(pick2("pkg/db.py").includes("tests/test_x.py") && pick2("pkg/db.py").includes("tests/test_child.py") && pick2("pkg/plugins.py").includes("tests/test_load.py"),
  "Python: a folder's conftest.py, a fixture run by its path among the tests, and a module named by its dotted name in a string reach the tests that use them", JSON.stringify({ db: pick2("pkg/db.py"), plugins: pick2("pkg/plugins.py") }));
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
  [["--passed", "tests"], { SELECT_BASE: "HEAD^1" }, "--passed on a pull request's run, which is never skipped"],
  [["--passed", "tests;rm"], {}, "a check's name that is none"],
]) { r = run(args, env); ok(r.status === 1 && mended(r.out), `refused, with its mend: ${what}`, r.out); }

// ---- a tree that passed is not run again (#457): a push that merges a pull request's head ----
// (a branch off main that changes a file no reader reads, so its run selected the whole suite, merged with a merge
// commit; `merged` makes it, `moved` moves main first, so the head is not up to date)
const merged = ({ moved = false, file = "README.md" } = {}) => {
  git("checkout", "-q", "-b", `pr${++n}`, "main");
  put(file, `# changed ${n}\n`); git("add", "-A"); git("commit", "-q", "-m", `change ${n}`);
  git("checkout", "-q", "main");
  if (moved) { put(`docs/other${n}.md`, "moved\n"); git("add", "-A"); git("commit", "-q", "-m", `main moved ${n}`); }
  git("merge", "-q", "--no-ff", "-m", `merge ${n}`, `pr${n}`);
  return git("rev-parse", "HEAD^2").trim();
};
let n = 0;
const passedHere = async (asked, selects = () => ({ all: true })) => { const was = process.cwd(); process.chdir(dir); try { return await passedWhole({ check: "tests", selects, asked }); } finally { process.chdir(was); } };
const yes = async () => true;
let head = merged();
let p = await passedHere(async (sha, check) => sha === head && check === "tests");
ok(p.none === true && p.why.includes(head.slice(0, 12)), "a merge whose tree is its head's, whose change selects the whole suite and whose check passed on that head selects nothing", JSON.stringify(p));
p = await passedHere(async () => "a run of it did not pass");
ok(p.all === true && /did not pass on the merged head .*a run of it did not pass/.test(p.why), "a check that did not pass on the head runs the whole suite, saying why", p.why);
p = await passedHere(yes, () => ({ all: false, tests: ["test/run.test.js"] }));
ok(p.all === true && /selected 1 tests, not the whole suite/.test(p.why), "a pull request whose run selected some tests only runs the whole suite here", p.why);
merged({ moved: true });
p = await passedHere(yes);
ok(p.all === true && /held another tree: it was not up to date/.test(p.why), "a head that was not up to date with main runs the whole suite", p.why);
put("CHANGES.md", "a commit straight on main\n"); git("add", "-A"); git("commit", "-q", "-m", "no merge");
p = await passedHere(yes);
ok(p.all === true && /merges no two commits/.test(p.why), "a commit that merges nothing, as a squash or a rebase makes, runs the whole suite", p.why);

// (from the command line: the host asked with the token, a test server standing in for it)
head = merged();
const asks = [];
const server = http.createServer((req, res) => {
  asks.push({ url: req.url, auth: req.headers.authorization });
  const ok2 = req.url.startsWith(`/repos/moss/bark/commits/${head}/check-runs?check_name=tests&`);
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ check_runs: ok2 ? [...before, { id: 9, name: "tests", status: "completed", conclusion: state, app: { slug: app }, started_at: "2026-11-19T10:00:00Z" }] : [] }));
});
// (`before`: an older run of the check on the same head, as a draft's gate leaves one; #733)
let state = "success", app = "github-actions", before = [];
await new Promise(done => server.listen(0, "127.0.0.1", done));
const host = { GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`, GITHUB_REPOSITORY: "moss/bark", GH_TOKEN: "pretend" };
const runLive = (args, env) => new Promise(done => {
  const c = spawn(process.execPath, [script, ...args], { cwd: dir, env: { ...process.env, SELECT_BASE: "", GITHUB_ENV: "", GITHUB_STEP_SUMMARY: "", ...env } });
  let out = ""; c.stdout.on("data", d => { out += d; }); c.stderr.on("data", d => { out += d; }); c.on("close", status => done({ status, out }));
});
fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GITHUB_ENV: envFile });
ok(r.status === 0 && /The selection: none of \d+ tests: the merged head/.test(r.out) && fs.readFileSync(envFile, "utf8") === "RUN=none\n" && asks.at(-1)?.auth === "Bearer pretend",
  "on a push, given --passed, it asks the host with the token, and where the check passed on the merged head it writes \"none\" for the steps after it, never an empty list a runner would read as every test", `${r.out}\n${fs.readFileSync(envFile, "utf8")}`);
app = "another-app"; fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GITHUB_ENV: envFile });
ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=all\n" && /no run of it by GitHub Actions/.test(r.out), "a check of that name another app posted, passed or not, says nothing of the suite: the whole suite runs", r.out);
app = "github-actions"; state = "failure"; fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GITHUB_ENV: envFile });
ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=all\n" && /did not pass on the merged head/.test(r.out), "where the check failed there, the whole suite runs", r.out);
state = "success"; before = [{ id: 3, name: "tests", status: "completed", conclusion: "failure", app: { slug: "github-actions" }, started_at: "2026-11-19T09:00:00Z" }]; fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GITHUB_ENV: envFile });
ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=none\n", "a draft's failed gate before the run that passed on the same head is read as the older: its newest run decides (#733)", r.out);
state = "failure"; before = [{ id: 3, name: "tests", status: "completed", conclusion: "success", app: { slug: "github-actions" }, started_at: "2026-11-19T09:00:00Z" }]; fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GITHUB_ENV: envFile });
ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=all\n" && /its newest run did not pass/.test(r.out), "and a pass before a newer run that failed is no pass: the whole suite runs", r.out);
before = []; state = "success";
fs.writeFileSync(envFile, "");
r = await runLive(["--env", "RUN", "--passed", "tests"], { ...host, GH_TOKEN: "", GITHUB_ENV: envFile });
ok(r.status === 0 && fs.readFileSync(envFile, "utf8") === "RUN=all\n" && /no repository or token/.test(r.out), "with no token, the host is not asked and the whole suite runs", r.out);
server.close();

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
