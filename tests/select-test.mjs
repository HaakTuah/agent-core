// Tests the selection (scripts/select.mjs): what a test reaches (its imports, and the
// files its code names outside a comment), and what a pull request runs: the tests a changed file can reach, a test it
// adds or changes, one that failed last time, the project's proof, never selected out, a test that reaches every file,
// the files no test reads, and the whole suite where a changed file's reach cannot be told or no base is told; then
// whole runs in a scratch repository, with what it writes for the steps after it, and each refusal read for its mend
// (mend.mjs). The pathspecs (select-matcher-test.mjs) and a tree that passed (select-passed-test.mjs) are tested
// apart (#943). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { ALL_MS, Late, hurry } from "../scripts/hurry.mjs";
import { WORDS, mentioned, nameTrie } from "../scripts/name-trie.mjs";
import { links, reached, selection } from "../scripts/select-reach.mjs";
import { parseConfig, survey } from "../scripts/shape.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const script = fileURLToPath(new URL("../scripts/select.mjs", import.meta.url));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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

// ---- how much of what a pull request changes is read (hurry.mjs; #881) ----
{
  let clock = 0;
  const lateness = f => { try { f(); return null; } catch (e) { return e instanceof Late ? e.message : `not Late: ${e}`; } };
  const watch = () => hurry({ files: new Set(["src/rules.js", "src/view.js"]), ms: 100, characters: 50, now: () => clock });
  const slow = at => () => { clock += at; return "read"; };
  let w = watch();
  ok(w.timed("src/rules.js", slow(60)) === "read" && w.timed("src/view.js", slow(40)) === "read" && w.timed("src/tool.js", slow(ALL_MS - 200)) === "read",
    "files read within the budget together are read, and a file the pull request leaves as it was counts for none of the changed files' budget");
  // (the project's own files count for the whole run's budget, from the watch's start: a project whose size alone is
  // more than can be read in time runs the whole suite, as the linking does; #962)
  w = watch();
  ok(w.timed("src/tool.js", slow(ALL_MS)) === "read" && new RegExp(`project's files of code.*took ${ALL_MS + 1} ms, past the ${ALL_MS} ms.*cannot be told in time`, "u").test(lateness(() => w.timed("src/other.js", slow(1)))),
    "the project's own files, which the pull request leaves as they were, are read within the whole run's budget and stop the reading past it, saying why");
  w = watch();
  const whole = w.pace(1e9);
  clock += ALL_MS + 1;
  ok(new RegExp(`took ${ALL_MS + 1} ms, past the ${ALL_MS} ms`, "u").test(lateness(whole)), "the linking stops too where the whole run, from the watch's start, has taken past its budget, though its own time is not spent");
  // (one file of code the pull request leaves as it was is held to the characters the changed files share, so that no
  // one read of the project's own carries the run far past the whole run's budget)
  const own = { "src/rules.js": "x", "src/tool.js": "x".repeat(51), "docs/data.json": "x".repeat(99) };
  ok(lateness(() => watch().size(own, ["src/rules.js"])) === null && lateness(() => watch().size({ ...own, "src/tool.js": "x".repeat(50) }, ["src/rules.js", "src/tool.js"])) === null
    && /src\/tool\.js, a file of code the pull request leaves as it was, holds 51 characters, past the 50/u.test(lateness(() => watch().size(own, ["src/rules.js", "src/tool.js"]))),
    "a file of code the pull request leaves as it was, past the characters on its own, stops the reading before any is read, saying which; one that is no code counts for none");
  ok(same(watch().first(["src/a.js", "src/rules.js", "src/b.js", "src/view.js"]), ["src/rules.js", "src/view.js", "src/a.js", "src/b.js"]), "the changed files are given first, each part in the order given");
  w = watch();
  w.timed("src/rules.js", slow(60));
  ok(/took 120 ms, past the 100 ms.*cannot be told in time/u.test(lateness(() => w.timed("src/view.js", slow(60)))), "changed files that take past the budget together stop the reading, saying why");
  ok(lateness(() => watch().size({ "src/rules.js": "x".repeat(30), "src/view.js": "x".repeat(20), "src/tool.js": "x".repeat(9999) })) === null
    && /hold 51 characters, past the 50/u.test(lateness(() => watch().size({ "src/rules.js": "x".repeat(30), "src/view.js": "x".repeat(21) }))), "changed files of more characters than the limit stop the reading before any is read; one the pull request leaves as it was counts for none");
  w = hurry({ files: new Set(), ms: 100, now: () => clock });
  const pace = w.pace(50);
  clock += 40;
  ok(lateness(pace) === null && /took 60 ms, past the 50 ms/u.test(lateness(() => { clock += 20; pace(); })), "the linking of files is held to a time of its own, from when it is asked, and stops saying why");
  // (the pace is asked inside the loops: once for each file linked, and once for each test and 256 files taken off a queue)
  let asked = 0;
  const many = Object.fromEntries(Array.from({ length: 200 }, (_, n) => [`src/m${n}.js`, `export const v = ${n};\n`])), manyTests = new Set(Object.keys(many).slice(0, 3));
  const linkedMany = links(many, manyTests, new Map(), () => asked++);
  ok(asked >= 200 && linkedMany.size === 200 && same([...links(texts, tests, reach)].map(([f, to]) => [f, [...to]]), [...links(texts, tests, reach, () => {})].map(([f, to]) => [f, [...to]])),
    "links asks its pace once a file, and links as it did where no pace is given", `${asked} asks`);
  asked = 0;
  const chain = new Map(Array.from({ length: 1000 }, (_, n) => [`f${n}`, new Set([`f${n + 1}`])]));
  reached(new Set(["f0", "f500"]), chain, () => asked++);
  ok(asked >= 2 + 1500 / 256 - 1 && same([...reached(tests, linked)].map(([t, f]) => [t, [...f]]), [...reached(tests, linked, () => {})].map(([t, f]) => [t, [...f]])),
    "reached asks its pace once a test and every 256 files taken off a queue, and reaches as it did where none is given", `${asked} asks`);
  const late = lateness(() => survey(texts, config, tests, hurry({ files: new Set(Object.keys(texts)), ms: -1 })));
  ok(late && /took \d+ ms, past the -1 ms/u.test(late), "the shape check's survey reads each changed file under the watch and fails where it is past", late);
  const owned = lateness(() => survey(texts, config, tests, hurry({ files: new Set(), all: -1 })));
  ok(owned && /project's files of code.*past the -1 ms/u.test(owned), "the shape check's survey reads the project's own files under the whole run's budget and fails where it is past", owned);
  const one = lateness(() => survey(texts, config, tests, hurry({ files: new Set(), characters: 40 })));
  ok(one && /src\/lazy\.js, a file of code the pull request leaves as it was, holds 49 characters, past the 40/u.test(one), "the shape check's survey gives the watch its files of code, so one of the project's own past the characters stops it", one);
  // (one of C# past the largest its parser takes is read not at all, so it is held to no characters of its own; one of
  // Python is read whole for its computed imports and the names it holds, so it is)
  const most = Math.max(...Object.keys(texts).map(f => texts[f].length)), big = "x = 1\n".repeat(most);
  ok(lateness(() => survey({ ...texts, "src/Data.cs": big }, config, tests, hurry({ files: new Set(), characters: most }))) === null
    && /src\/data\.py, a file of code the pull request leaves as it was/u.test(lateness(() => survey({ ...texts, "src/data.py": big }, config, tests, hurry({ files: new Set(), characters: most }))) ?? ""),
    "a file of C# the pull request leaves as it was, past the characters, does not stop the reading; one of Python, read whole, does");
  // (the selection reads the changed files first, so that one slow to read is read before the project's own spend the
  // time, and of JavaScript no functions, its parser's work, which it does not use; what it reaches is the same)
  const order = [], spy = { ...hurry({ files: new Set(["src/view.js", "test/view.test.js"]) }) };
  const timedBy = spy.timed;
  spy.timed = (file, read) => { order.push(file); return timedBy(file, read); };
  const watched = survey({ ...texts, "src/tall.js": `export function tall() {\n${"  a();\n".repeat(80)}}\n` }, config, tests, spy);
  const plain = survey({ ...texts, "src/tall.js": `export function tall() {\n${"  a();\n".repeat(80)}}\n` }, config, tests);
  const asLists = m => JSON.stringify([...m].map(([f, to]) => [f, [...to].sort()]).sort());
  const count = Object.keys(texts).filter(f => f.endsWith(".js")).length + 1, read = order.slice(0, count);
  ok(same(read.slice(0, 2), ["src/view.js", "test/view.test.js"]) && new Set(read).size === count, "the survey under the watch reads the changed files first, then the project's own, each once", order.join(" "));
  ok(asLists(watched.reach) === asLists(plain.reach) && same([...watched.unsure].sort(), [...plain.unsure].sort()) && same([...watched.scripts].sort(), [...plain.scripts].sort())
    && [...plain.entries.keys()].some(id => id.startsWith("function: src/tall.js")) && ![...watched.entries.keys()].some(id => id.startsWith("function: ")) && watched.read.functions === 0,
    "the survey under the watch reads no functions of JavaScript, and finds the same reach, unsure files and scripts as without it", [...plain.entries.keys()].join(" "));
}

{
  // (the tests that reach every file are told once, not once for each changed file: many files, many tests and many globs of
  // the config's "select.whole", which a pull request writes itself, take in time that grows with the product of the two
  // counts, not of the three)
  const globs = Array.from({ length: 10 }, (_, k) => `:(glob)**/x${k}*y*z`);
  const cfg = parseConfig(JSON.stringify({ baseline: "b.json", code: ["src", "test"], tests: ["test/"], select: { proof: [], whole: globs, none: [] } }));
  const code = Object.fromEntries(Array.from({ length: 500 }, (_, n) => [`src/c${n}.js`, `export const v = ${n};\n`]));
  const suite = Object.fromEntries(Array.from({ length: 600 }, (_, n) => [`test/t${n}.test.js`, `export const v = ${n};\n`]));
  const all = { ...code, ...suite }, many = new Set(Object.keys(suite)), from = Date.now();
  const picked = selection({ changed: Object.keys(code), texts: all, tests: many, reach: new Map(), config: cfg });
  ok(!picked.all && picked.tests.length === 0 && Date.now() - from < 3000, `500 changed files over 600 tests and 10 globs of "select.whole" select in ${Date.now() - from} ms, none of those tests reaching every file`, JSON.stringify(picked.tests.slice(0, 3)));
}

// ---- the files whose names a text holds, in one pass (name-trie.mjs; #881) ----
{
  // (the same files as the regular expression of each name that it replaced, over names and texts made to be hard)
  const esc = x => x.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const oracle = (entries, text, kind) => new Set(entries.filter(([n]) => n && new RegExp(kind === "name" ? `(^|[^\\w-])${esc(n)}(?![\\w-])` : `(^|[^\\w.])${esc(n)}(?![\\w])`, "u").test(text)).map(([, f]) => f));
  let seed = 20261120;
  const roll = n => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return (seed >>> 8) % n; };
  const bits = ["a", "b", "ab", ".", "-", "_", " ", "\n", "/", "é", "😀", "x1", ".js", "a.b", "'", "9"], made = n => Array.from({ length: n }, () => bits[roll(bits.length)]).join("");
  for (const kind of ["name", "dotted"]) {
    let hit = 0, bad = null;
    for (let round = 0; round < 3000 && !bad; round++) {
      const entries = Array.from({ length: 1 + roll(8) }, (_, k) => [made(1 + roll(4)), `f${k}`]), text = made(roll(40));
      const got = [...mentioned(nameTrie(entries), text, WORDS[kind])].sort().join(), want = [...oracle(entries, text, kind)].sort().join();
      if (want) hit++;
      if (got !== want) bad = JSON.stringify({ entries, text, got, want });
    }
    ok(!bad && hit >= 40, `${kind}: 3000 random names and texts, ${hit} of them holding a name, give the files the regular expression of each name gave`, bad);
  }
  // (a Python module's dotted name is held in a text of JavaScript too, as it was: a test that starts `python -m pkg.rules`)
  const py = links({ "pkg/rules.py": "x = 1\n", "test/run.test.js": "spawnSync('python', ['-m', 'pkg.rules']);\n", "test/other.test.js": "spawnSync('python', ['-m', 'pkg.rulesx']);\n" }, new Set(), new Map());
  ok(py.get("test/run.test.js").has("pkg/rules.py") && !py.get("test/other.test.js").has("pkg/rules.py"), "a Python module's dotted name links from a text of JavaScript, as the pattern of each name did");
  let asks = 0;
  mentioned(nameTrie([["ab", "f"]]), "x".repeat(10000), WORDS.name, () => asks++);
  ok(asks === 3, "mentioned asks its pace every 4096 places a name may start at", `${asks} asks`);
  const trie = nameTrie([["select.mjs", "s"], ["a.js", "x/a.js"], ["a.js", "y/a.js"], ["b", "b"], ["ab", "ab"]]), holds = text => [...mentioned(trie, text, WORDS.name)].sort().join(" ");
  ok(holds("node scripts/select.mjs") === "s" && holds("xselect.mjs") === "" && holds("select.mjsx") === "" && holds("my-select.mjs") === "" && holds("a.jsx a.js") === "x/a.js y/a.js" && holds("ab b") === "ab b" && holds("a b") === "b" && holds("b-") === "" && holds("a.js-x") === "" && holds("-b") === "" && holds("") === "",
    "a name is held between characters that are no part of a word, files that share one together, and one that another holds by its end");
  const text = "export const v = f1.js file ".repeat(150000), from = Date.now();
  const found = mentioned(nameTrie(Array.from({ length: 20000 }, (_, k) => [`file${k}.js`, `src/file${k}.js`])), text, WORDS.name);
  ok(found.size === 0 && Date.now() - from < 3000, `20,000 names over ${text.length.toLocaleString("en")} characters are told in ${Date.now() - from} ms`);
}

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
const cs = { "App.csproj": "<Project Sdk=\"Microsoft.NET.Sdk\" />\n", "src/Rules.cs": "namespace App;\npublic static class Rules { public static bool Allowed() => true; }\n", "tests/RulesTest.cs": "namespace Tests;\nclass RulesTest { void T() { App.Rules.Allowed(); } }\n", "web/app.js": "function draw() {}\n" };
const csConfig = parseConfig(JSON.stringify({ baseline: "b.json", code: ["src", "tests", "web"], tests: ["tests/"] })), csTests = new Set(["tests/RulesTest.cs"]), csFound = survey(cs, csConfig, csTests);
s = selection({ changed: ["src/Rules.cs"], texts: cs, tests: csTests, reach: csFound.reach, scripts: csFound.scripts, unsure: csFound.unsure, config: csConfig, beside: () => ({ msbuild: {}, cs: {} }) });
ok(!s.all && same(s.tests, ["tests/RulesTest.cs"]), "C#: a test that names a type by its full name, with no using directive, reaches its file (select-csharp-test.mjs reads the rest)", JSON.stringify(s));
s = selection({ changed: ["web/app.js"], texts: cs, tests: csTests, reach: csFound.reach, scripts: csFound.scripts, config: csConfig });
ok(s.all && s.why.includes("web/app.js"), "a script of the global space, which no import names, runs the whole suite", JSON.stringify(s));
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
const lostPy = { "src/pkg/a.py": "def a():\n    return 1\n", "src/pkg/b.py": "def b():\n    return 2\n", "tests/test_lost.py": "import src.pkg.a\nx = (\nfrom src.pkg import (b,", "tests/test_none.py": "def test():\n    pass\n" };
const lostConfig = parseConfig(JSON.stringify({ baseline: "b.json", code: ["src", "tests"], tests: ["tests/"] })), lostTests = new Set(["tests/test_lost.py", "tests/test_none.py"]), lostFound = survey(lostPy, lostConfig, lostTests);
const lostRun = selection({ changed: ["src/pkg/b.py"], texts: lostPy, tests: lostTests, reach: lostFound.reach, unsure: lostFound.unsure, config: lostConfig }).tests;
ok(lostFound.unsure.has("tests/test_lost.py") && same(lostRun, ["tests/test_lost.py"]), "a file of Python the grammar cannot read whole may import, in the part it lost, what no reader sees: a test that reaches it runs on any change", JSON.stringify({ lostRun, unsure: [...lostFound.unsure] }));
const lostCs = { "src/A.cs": "namespace App;\npublic class A { }\n", "src/B.cs": "namespace Other;\npublic class B { }\n", "tests/LostTest.cs": "using App;\nnamespace Tests;\nclass LostTest { void T(A a) { a?.b += 1; } }\n", "tests/NoneTest.cs": "namespace Tests;\nclass NoneTest { }\n" };
const lostCsTests = new Set(["tests/LostTest.cs", "tests/NoneTest.cs"]), lostCsFound = survey(lostCs, lostConfig, lostCsTests);
const lostCsRun = selection({ changed: ["src/B.cs"], texts: lostCs, tests: lostCsTests, reach: lostCsFound.reach, unsure: lostCsFound.unsure, config: lostConfig }).tests;
ok(same([...lostCsFound.unsure], ["tests/LostTest.cs"]) && lostCsRun.includes("tests/LostTest.cs"), "and so does one of C#, its using directives read on the parser too", JSON.stringify({ lostCsRun, unsure: [...lostCsFound.unsure] }));
ok(pick2("pkg/db.py").includes("tests/test_x.py") && pick2("pkg/db.py").includes("tests/test_child.py") && pick2("pkg/plugins.py").includes("tests/test_load.py"),
  "Python: a folder's conftest.py, a fixture run by its path among the tests, and a module named by its dotted name in a string reach the tests that use them", JSON.stringify({ db: pick2("pkg/db.py"), plugins: pick2("pkg/plugins.py") }));
s = selection({ changed: ["package.json"], texts: { ...texts, "package.json": "{\"dependencies\":{\"x\":\"1.0.0\"}}" }, tests, reach, config });
ok(s.all && /package\.json/.test(s.why), "a package's manifest, read beside the code, runs the whole suite: it links to no file, and may reach every test", JSON.stringify(s));
for (const [changed, what] of [[["package.json"], "a file of no code the readers follow"], [["src/gone.js"], "a file of code that is gone"], [["src/rules.js", "config/app.json"], "data beside code"]]) {
  s = pick(changed);
  ok(s.all && s.tests.length === tests.size && s.why.includes(changed.at(-1)), `the whole suite runs for ${what}: what reaches it cannot be told`, JSON.stringify(s));
}

// ---- whole runs, in a scratch repository ----
const dir = scratchDir("select-test-");
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

// ---- a sync's change: the copy of the core and the pins of calls to its workflows (#1093, point 2) ----
const sha = "a".repeat(40), pinOf = at => `jobs:\n  core:\n    uses: ${CORE}/.github/workflows/core.yml@${at}\n`;
put("core-manifest.md", `# Manifest\n\nCore: ${CORE} at ${sha}, copied whole under core/ (never edited here).\n`);
put("core/scripts/x.mjs", "export const x = 1;\n"); put("core/setup/notes.md", "notes\n"); put("core/.node-version", "24\n");
put("test/copy.test.js", "import { spawnSync } from 'node:child_process';\nspawnSync(process.execPath, ['core/scripts/x.mjs']);\n");
put("test/joined.test.js", "import path from 'node:path';\nexport const at = path.join('core', 'scripts');\n");
put("test/windows.test.js", "import { spawnSync } from 'node:child_process';\nspawnSync(process.execPath, ['core\\\\scripts\\\\x.mjs']);\n");
put(".github/workflows/core.yml", pinOf(sha));
git("add", "-A"); git("commit", "-q", "-m", "a copy");
put("core/scripts/x.mjs", "export const x = 2;\n"); put("core/setup/notes.md", "more notes\n"); put(".github/workflows/core.yml", pinOf("b".repeat(40)));
git("add", "-A"); git("commit", "-q", "-m", "a sync");
r = run([], { SELECT_BASE: "HEAD^1" });
ok(r.status === 0 && /test\/copy\.test\.js: can run the copy of the core/.test(r.out) && /test\/joined\.test\.js: can run the copy of the core/.test(r.out) && /test\/windows\.test\.js: can run the copy of the core/.test(r.out) && !/test\/rules\.test\.js/.test(r.out) && !/whole suite/.test(r.out),
  "a sync's change selects the tests that name the copy alone, by a path Windows writes too: the rest of the copy, and a workflow in which only a pin moved, select none", r.out);
put(".github/workflows/core.yml", `${pinOf("c".repeat(40))}    secrets: inherit\n`);
git("add", "-A"); git("commit", "-q", "-m", "more than a pin");
r = run([], { SELECT_BASE: "HEAD^1" });
ok(r.status === 0 && /the whole suite, \d+ tests: \.github\/workflows\/core\.yml is no code/.test(r.out), "a workflow changed beyond its pins runs the whole suite, as any file no reader follows does", r.out);
put("core/.node-version", "26\n");
git("add", "-A"); git("commit", "-q", "-m", "a newer Node");
r = run([], { SELECT_BASE: "HEAD^1" });
ok(r.status === 0 && /the whole suite, \d+ tests: core\/\.node-version, the Node the suites run on, changed/.test(r.out), "the copy's .node-version runs the whole suite: every test runs on that Node", r.out);

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
