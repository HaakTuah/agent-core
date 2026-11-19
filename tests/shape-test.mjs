// Tests the shape check (scripts/shape.mjs): the config it refuses, each kind of breach it finds on a few
// files made for it, what covers an entry and what does not, and whole runs in a scratch repository: the first
// baseline, a new breach of each kind failing with its mend, a baseline that only shrinks against the base, an entry
// that joins because the check reads more, one given its reason, a raised mark, a reader the baseline does not name
// yet, and a suite held to its time; and what each reader of another kind of code (C#, Python, JSX, scripts that share
// one global space) brings to it. Each failure is read for its mend (mend.mjs). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/shape-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { fileOf, groupOf, LONG, MARKS, notLinked, parseBaseline, parseConfig, readerOf, survey, unclaimed, verdict, where } from "../scripts/shape.mjs";
import { READERS } from "../scripts/shape-readers.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const script = fileURLToPath(new URL("../scripts/shape.mjs", import.meta.url));
const ids = found => [...found.entries.keys()].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- the config ----
const config = extra => JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"], ...extra });
const refused = text => { try { parseConfig(text, "checks/shape.json"); return ""; } catch (e) { return `FAIL: ${e.message}`; } };
const two = (a, b) => ({ systems: { rules: { paths: ["src/rules/"], ...a }, view: { paths: ["src/view/"], ...b } } });
const BAD = {
  "no JSON": "{",
  "no object": "[]",
  "an unknown key": config({ extra: 1 }),
  "no baseline": JSON.stringify({ code: ["src"] }),
  "a baseline outside the project": JSON.stringify({ baseline: "../x.json", code: ["src"] }),
  "no code": JSON.stringify({ baseline: "b.json" }),
  "code that is no list": config({ code: "src" }),
  "a platform that is no list": config({ platform: "electron" }),
  "a mark that is no whole number": config({ marks: { lines: 1.5 } }),
  "an unknown mark": config({ marks: { files: 3 } }),
  "aliases that lead out": config({ aliases: { "@/": "../src/" } }),
  "a suite with no seconds": config({ suites: { unit: "fast" } }),
  "systems that are a list": config({ systems: [] }),
  "a system's name": config({ systems: { Rules: { paths: ["src/"] } } }),
  "a system's unknown key": config({ systems: { rules: { paths: ["src/"], owner: "x" } } }),
  "a system with no paths": config({ systems: { rules: {} } }),
  "uses that are no list": config(two({ uses: "view" }, {})),
  "wraps that are no list": config(two({ wraps: "lodash" }, {})),
  "a use of no system": config(two({ uses: ["sound"] }, {})),
  "a use of itself": config(two({ uses: ["rules"] }, {})),
  "an entrance outside its paths": config(two({ entrance: "src/view/index.js" }, {})),
  "a domain that is no name": config(two({ domain: "The Rules" }, {})),
  "the rules using the display": config(two({ domain: "rules", uses: ["view"] }, { domain: "display" })),
  "a package wrapped twice": config(two({ wraps: ["lodash"] }, { wraps: ["lodash"] })),
  "a circle of uses": config(two({ uses: ["view"] }, { uses: ["rules"] })),
  "screens that are no list": config({ screens: "playwright" }),
  "clocks that are no list": config({ clocks: "Clock.Wait" }),
  "processes that are no list": config({ processes: [3] }),
  "a selection that is no object": config({ select: ["test/a.test.js"] }),
  "a selection's unknown key": config({ select: { always: ["test/a.test.js"] } }),
  "a selection's list that is no list": config({ select: { proof: "test/a.test.js" } }),
  "a wait that is no number": config({ wait: "ten minutes" }),
  "a long run of no seconds": config({ long: 0 }),
};
for (const [what, text] of Object.entries(BAD)) ok(mended(refused(text)), `a config is refused, with its mend: ${what}`, refused(text));
const full = parseConfig(config({ ...two({ domain: "rules", entrance: "src/rules/index.js" }, { domain: "display", uses: ["rules"], wraps: ["pixi.js"] }), tests: ["src/**/*.test.js"], aliases: { "@/": "src/" }, platform: ["electron"], marks: { lines: 40 }, suites: { unit: 60, all: { linux: 90, win32: 300 } } }));
ok(same(full.marks, { ...MARKS, lines: 40 }) && full.wrapped.get("pixi.js") === "view" && full.tests.length === 1 && full.suites.all.win32 === 300, "a whole config is read, a mark left out being the core's own");
const costs = parseConfig(config({ screens: ["playwright"], select: { proof: ["test/replay.test.js"] }, wait: 600 }));
ok(same(costs.screens, ["playwright"]) && same(costs.select, { proof: ["test/replay.test.js"], whole: [], none: [] }) && costs.wait === 600 && costs.long === LONG && full.wait === undefined && same(full.screens, []),
  "what the tests cost is read: the screens, the selection's lists, each left out an empty one, the wait's mark, and a long run's seconds, an hour where none is given");
ok(where("| *shape check* | `core/scripts/shape.mjs` with `checks/own/shape.json` |") === "checks/own/shape.json" && where("| *copies check* | `checks/copies.json` |") === "checks/shape.json" && where(null) === "checks/shape.json",
  "the config is where the manifest's row names it, else where the starter kit writes it");

// ---- each kind of breach ----
const cfg = extra => parseConfig(config(extra));
const long = (name, lines) => `export function ${name}(a) {\n${"  a++;\n".repeat(lines - 2)}}\n`;
const branchy = `export function many(a, b) {\n  return ${Array.from({ length: 17 }, (_, i) => `a === ${i}`).join(" || ")};\n}\n`;
const deep = "export function nest(a) {\n  if (a) { for (;;) { while (a) { if (a) { try { a(); } catch { a = 0; } } } } }\n}\n";
// (JSX whose text holds a bare }, which the grammar refuses, as JSX does)
const lostJsx = `const shown = <p>a } b</p>;\n${long("lost", 200)}`;
let found = survey({ "src/a.js": long("tall", 61) + long("fine", 60) + branchy + deep, "src/a.test.js": long("inATest", 200), "src/b.jsx": `export const B = () => <p>{x}</p>;\n${long("inJsx", 200)}`, "src/c.tsx": lostJsx }, cfg({ tests: ["src/a.test.js"] }), new Set(["src/a.test.js"]));
ok(same(ids(found), ["function: src/a.js#many", "function: src/a.js#nest", "function: src/a.js#tall", "function: src/b.jsx#inJsx", "lost: src/c.tsx"]) && found.entries.get("function: src/a.js#tall").n.lines === 61 && found.entries.get("function: src/a.js#many").n.branches === 16 && found.entries.get("function: src/a.js#nest").n.depth === 5 && found.read.jsx === 1 && found.read.functions === 5,
  "a function past a mark is found: its lines, its depth, its branch points, in a file with JSX too; one at the mark and a test's are not; a file whose JSX the reader cannot follow is found as such, its functions not", ids(found));
const lostSaid = verdict({ config: cfg({}), at: "c.json", self: "s", found, baselineText: JSON.stringify({ reads: Object.keys(READERS), listed: {} }) }).fail.flat().join("\n");
ok(["src/a.js", "src/b.jsx", "src/c.tsx"].every(f => found.readers.get(f) === "javascript-tree") && mended(lostSaid) && /1 file of code holds what the reader cannot follow/.test(lostSaid) && /src\/c\.tsx/.test(lostSaid),
  "each file's reader is known, and a new file the reader cannot follow fails, with its mend, so that no line hides a file's functions", lostSaid);
found = survey({ "src/a.js": long("same", 70) + long("same", 80) }, cfg({}));
ok(same(ids(found), ["function: src/a.js#same", "function: src/a.js#same#2"]), "two functions of one name in a file are told apart");

const systems = { systems: {
  rules: { domain: "rules", paths: ["src/rules/"], entrance: "src/rules/index.js" },
  view: { domain: "display", paths: ["src/view/"], uses: ["rules"], entrance: "src/view/index.js" },
  host: { domain: "platform", paths: ["src/host/"] },
  tools: { domain: "tools", paths: ["tools/"] },
} };
found = survey({
  "src/rules/index.js": "export { step } from './step.js';\nimport { draw } from '../view/index.js';\nimport type { T } from '@/view/types.ts';\n",
  "src/rules/step.js": "export const step = s => s + Math.random() + Date.now() + new Date(0).getTime() + obj.Math.random();\n",
  "src/view/index.js": "import { step } from '../rules/index.js';\nimport { inner } from '../rules/step.js';\nexport const draw = () => step(inner);\nconst later = () => import('../rules/step.js');\n",
  "src/view/types.ts": "export type T = number;\n",
  "src/main.js": "import '../src/rules/step.js';\nimport './view/index.js';\nimport './missing.js';\nimport './style.css';\nimport 'left-pad';\n",
}, cfg({ ...systems, aliases: { "@/": "src/" } }));
ok(same(ids(found), ["clock: src/rules/step.js: Date.now", "clock: src/rules/step.js: Math.random", "crossing: rules -> view: src/rules/index.js -> src/view/index.js", "crossing: rules -> view: src/rules/index.js -> src/view/types.ts",
  "cycle: src/rules/index.js -> src/view/index.js", "cycle: src/view/index.js -> src/rules/index.js", "inside: (no system) -> rules: src/main.js -> src/rules/step.js", "inside: view -> rules: src/view/index.js -> src/rules/step.js"]),
  "an import across a boundary nobody declared, one of types and one through an alias too; one past an entrance, a dynamic one and one from no system too; a cycle of what runs; the rules' own clock and randomness, not a member's", ids(found));
ok(found.read.nowhere === 2 && found.read.unnamed === 1 && found.read.imports === 11 && found.entries.get("clock: src/rules/step.js: Math.random").n.count === 1, "an import that leads to no file and a package nobody declares are counted, never failed; a style sheet is neither", JSON.stringify(found.read));

const pkg = JSON.stringify({ name: "app", dependencies: { "pixi.js": "8.0.0", electron: "30.0.0", "@scope/kit": "1.0.0" }, devDependencies: { vitest: "2.0.0" } });
const shipped = wraps => survey({
  "package.json": pkg,
  "src/rules/index.js": "import 'pixi.js';\nimport { x } from '@scope/kit/sub';\nimport 'vitest';\nimport fs from 'node:fs';\nimport 'electron';\n",
  "src/view/index.js": "import * as P from 'pixi.js';\nimport 'vitest';\nconst e = require('electron');\n",
  "src/host/index.js": "import 'electron';\nimport 'node:child_process';\n",
  "tools/build.js": "import 'pixi.js';\nimport '@scope/kit';\n",
  "src/loose.js": "import 'pixi.js';\n",
}, cfg({ systems: { ...systems.systems, view: { ...systems.systems.view, ...(wraps ? { wraps: ["pixi.js"] } : {}) } }, platform: ["electron", "node:child_process"] }));
ok(same(ids(shipped(false)), ["package: src/rules/index.js -> pixi.js", "package: src/view/index.js -> pixi.js", "platform: src/rules/index.js -> electron", "platform: src/view/index.js -> electron"]),
  "a package the project ships with, imported from two systems, is found in both, tools and files of no system aside; one of development alone, one in one system and Node's own are not; a tie to a platform outside its system is", ids(shipped(false)));
ok(same(ids(shipped(true)).filter(id => id.startsWith("package")), ["package: src/loose.js -> pixi.js", "package: src/rules/index.js -> pixi.js"]), "where a system wraps the package, every import outside it is found, and none inside it", ids(shipped(true)));
const mono = survey({ "packages/engine/package.json": JSON.stringify({ name: "@game/engine", main: "src/index.ts" }), "packages/engine/src/index.ts": "export const a = 1;\n", "packages/engine/src/inner.ts": "export const b = 2;\n",
  "packages/web/src/page.ts": "import { a } from '@game/engine';\nimport { b } from '@game/engine/src/inner';\n" },
  parseConfig(JSON.stringify({ baseline: "b.json", code: ["packages"], systems: { engine: { paths: ["packages/engine/"], entrance: "packages/engine/src/index.ts" }, web: { paths: ["packages/web/"], uses: ["engine"] } } })));
ok(same(ids(mono), ["inside: web -> engine: packages/web/src/page.ts -> packages/engine/src/inner.ts"]), "a package the repository holds itself is read as its files: its entrance holds, by its name too", ids(mono));

// ---- the tests that open a screen ----
const screenCfg = cfg({ ...two({ domain: "rules" }, { domain: "display", uses: ["rules"] }), tests: ["src/**/*.test.js", "Tests/**"], screens: ["playwright", "@testing-library", "System.Windows.Forms"] });
const screened = survey({
  "src/rules/a.js": "export const a = 1;\n", "src/view/b.js": "export const b = 1;\n",
  "src/rules/a.test.js": "import { a } from './a.js';\n", "src/view/b.test.js": "import { b } from './b.js';\n",
  "src/e2e/c.test.js": "import { chromium } from 'playwright';\nimport { render } from '@testing-library/react';\n", "src/e2e/d.test.js": "const p = await import('playwright-core');\n",
  "src/tool.js": "import { chromium } from 'playwright';\n", "Tests/FormTests.cs": "using System.Windows.Forms;\nnamespace T;\nclass FormTests {}\n",
}, screenCfg, new Set(["src/rules/a.test.js", "src/view/b.test.js", "src/e2e/c.test.js", "src/e2e/d.test.js", "Tests/FormTests.cs"]));
ok(same(ids(screened).filter(id => id.startsWith("screen: ")), ["screen: Tests/FormTests.cs -> System.Windows.Forms", "screen: src/e2e/c.test.js -> @testing-library", "screen: src/e2e/c.test.js -> playwright"])
  && screened.read.screens === 2 && readerOf("screen: src/e2e/c.test.js -> playwright", screened.readers) === "screens" && fileOf("screen: src/e2e/c.test.js -> playwright") === "src/e2e/c.test.js",
  "a test that imports what opens a screen (a package named, a module under it, in C# a namespace) is an entry of the reader \"screens\"; a test of the display's own code, one of the rules, code that is no test and a package that only starts with a name are not", ids(screened));

// ---- the tests that reach a real clock or start another process (#457, point 1) ----
const reachCfg = cfg({ tests: ["src/**/*.test.js", "Tests/**", "tests/**"], clocks: ["Clock.wait"], processes: ["runTool", "spawnly", "src/helpers/run.js"] });
const reachTests = ["src/a.test.js", "src/b.test.js", "src/c.test.js", "src/d.test.js", "src/e.test.js", "Tests/WaitTests.cs", "tests/test_run.py"];
const reaching = survey({
  "src/a.test.js": "import { spawnSync } from 'node:child_process';\nconst t0 = Date.now();\n",
  "src/b.test.js": "const said = 'Date.now and setTimeout';\nconst o = { x: 1 };\no.setTimeout(1);\n// performance.now()\n",
  "src/c.test.js": "import { setTimeout as sleep } from 'node:timers/promises';\nawait Clock.wait(5);\nrunTool('x');\n",
  "src/d.test.js": "import { run } from 'spawnly/sync';\nconst d = new Date();\nconst e = new Date(0);\n",
  "src/e.test.js": "export const plain = 1;\n", "src/tool.js": "setTimeout(() => {}, 5);\nimport { exec } from 'child_process';\n",
  "Tests/WaitTests.cs": "namespace T;\nclass WaitTests { void A() { Thread.Sleep(5); Process.Start(\"git\"); } }\n",
  "tests/test_run.py": "import subprocess\nimport time\n\ndef test_a():\n    time.sleep(1)\n",
}, reachCfg, new Set(reachTests));
ok(same(ids(reaching).filter(id => /^(timed|process): /.test(id)), ["process: Tests/WaitTests.cs -> Process.Start", "process: src/a.test.js -> node:child_process", "process: src/c.test.js -> runTool", "process: src/d.test.js -> spawnly",
  "process: tests/test_run.py -> subprocess", "timed: Tests/WaitTests.cs -> Thread.Sleep", "timed: src/a.test.js -> Date.now", "timed: src/c.test.js -> Clock.wait", "timed: src/d.test.js -> new Date()", "timed: tests/test_run.py -> time"])
  && reaching.read.timed === 5 && reaching.read.processes === 5,
  "a test that calls or imports what reaches a real clock or starts another process, by its language's names or the config's, is one entry of each kind, its first name in order; a name in a string, a comment, after a dot or with what follows it, and code that is no test, are none", ids(reaching).filter(id => /^(timed|process): /.test(id)));
ok(readerOf("timed: src/a.test.js -> Date.now", reaching.readers) === "clocks" && readerOf("process: src/a.test.js -> node:child_process", reaching.readers) === "processes" && fileOf("timed: src/a.test.js -> Date.now") === "src/a.test.js",
  "each kind is the entry of a reader of its own, \"clocks\" and \"processes\", in the test's file");
const faked = survey({
  "src/f.test.js": "vi.useFakeTimers();\nsetTimeout(() => {}, 5);\nimport { spawnSync } from 'node:child_process';\n",
  "tests/test_sleep.py": "from time import sleep\n\ndef test_a():\n    sleep(1)\n",
  "src/g.test.js": "const options = { setTimeout: false };\nDate.now = () => 42;\n",
  "src/i.test.js": "const useFakeTimers = 1;\nsetTimeout(() => {}, 5);\n", "src/j.test.js": "vi.useFakeTimers();\nvi.useRealTimers();\nconst t = Date.now();\n",
  "Tests/FakeTests.cs": "namespace T;\nclass FakeTests { void A() { var c = new FakeTimeProvider(); Thread.Sleep(5); } }\n",
  "tests/test_frozen.py": "from freezegun import freeze_time\n\n@freeze_time('2026-01-01')\ndef test_a():\n    time.sleep(1)\n",
  "src/k.test.ts": "import type { ChildProcess } from 'node:child_process';\nimport type { TimerOptions } from 'node:timers';\nexport const k = 1;\n",
  "src/helpers/run.js": "export const run = () => 1;\n", "src/h.test.js": "import { run } from './helpers/run.js';\nrun();\n",
}, reachCfg, new Set(["src/f.test.js", "tests/test_sleep.py", "src/g.test.js", "src/h.test.js", "src/i.test.js", "src/j.test.js", "Tests/FakeTests.cs", "tests/test_frozen.py", "src/k.test.ts"]));
ok(same(ids(faked).filter(id => /^(timed|process): /.test(id)), ["process: src/f.test.js -> node:child_process", "process: src/h.test.js -> src/helpers/run.js", "timed: Tests/FakeTests.cs -> Thread.Sleep", "timed: src/f.test.js -> setTimeout", "timed: src/i.test.js -> setTimeout", "timed: src/j.test.js -> Date.now", "timed: tests/test_frozen.py -> time.sleep", "timed: tests/test_sleep.py -> time"]),
  "a test that installs a fake clock is counted all the same, since which calls run under it only running tells (its mend names it); an import of types alone reaches nothing; nor does one that names a clock as a property's key or assigns to it; a module of the clock imported by name counts (Python's from time import sleep), and so does a module of the project's own that the config names", ids(faked));
ok(unclaimed(new Map([["timed: src/a.test.js -> Date.now", true]]), new Map([["timed: src/a.test.js -> setTimeout", true]])).length === 0
  && unclaimed(new Map([["process: src/a.test.js -> runTool", true]]), new Map([["process: src/a.test.js -> node:child_process", true]])).length === 0
  && unclaimed(new Map([["timed: src/b.test.js -> setTimeout", true]]), new Map([["timed: src/a.test.js -> setTimeout", true]])).length === 1,
  "a listed test that reaches another name, or keeps a later one, stands under its old entry; another test's entry is never its");
ok(screened.reach.get("src/e2e/d.test.js") === undefined && same([...screened.reach.get("src/rules/a.test.js")], ["src/rules/a.js"]), "each file's imports of the project's own files are told, for the selection", JSON.stringify([...screened.reach]));

// ---- the readers of other code ----
const csLong = (name, lines) => `  public void ${name}() {\n${"    x++;\n".repeat(lines - 2)}  }\n`;
const csFile = (ns, usings, body = "") => `${usings}namespace ${ns};\npublic class C${ns.length} {\n${body}}\n`;
const layered = { systems: { rules: { domain: "rules", paths: ["src/Rules/", "game/rules/"] }, view: { domain: "display", paths: ["src/View/", "game/view/"], uses: ["rules"] }, host: { domain: "platform", paths: ["src/Host/", "game/host/"], uses: ["view"] } } };
found = survey({
  "src/App.csproj": '<Project><ItemGroup><PackageReference Include="Newtonsoft.Json" Version="13.0.3" /></ItemGroup></Project>',
  "src/Rules/Dice.cs": csFile("Game.Rules", "using Game.View;\nusing Newtonsoft.Json;\n", `${csLong("Roll", 61)}  int R() => new Random(1).Next() + DateTime.Now.Second;\n`),
  "src/View/Board.cs": csFile("Game.View", "using Game.Rules;\nusing System.Text;\nusing Windows.UI;\nusing Unknown.Thing;\n"),
  "src/Host/Io.cs": csFile("Game.Host", "using Newtonsoft.Json.Linq;\nusing Windows.UI.Core;\nusing Game.View;\n"),
}, cfg({ ...layered, platform: ["Windows.UI"] }));
ok(same(ids(found), ["clock: src/Rules/Dice.cs: DateTime.Now", "clock: src/Rules/Dice.cs: new Random(", "crossing: rules -> view: src/Rules/Dice.cs -> src/View/Board.cs", "cycle: src/Rules/Dice.cs -> src/View/Board.cs", "cycle: src/View/Board.cs -> src/Rules/Dice.cs",
  "function: src/Rules/Dice.cs#Roll", "package: src/Host/Io.cs -> Newtonsoft.Json", "package: src/Rules/Dice.cs -> Newtonsoft.Json", "platform: src/View/Board.cs -> Windows.UI"]) && found.read.nowhere === 1 && found.readers.get("src/View/Board.cs") === "csharp-tree",
  "C#: a function past a mark, a using across a boundary nobody declared and on a cycle, a package shipped from two systems, a tie to a platform outside its system and the rules' own clock are found; the framework's own is not, and a namespace nobody declares is counted", ids(found));
// a name a project declares is matched by the longest one an import is or lies under, a platform by the shortest; a
// namespace that holds only deeper ones leads to no file; a Python module deeper than any file is outside
found = survey({
  "src/App.csproj": '<Project><ItemGroup><PackageReference Include="Acme" /><PackageReference Include="Acme.Net" /></ItemGroup></Project>',
  "src/View/A.cs": csFile("Game.View", "using Acme.Net.Http;\nusing Win.Forms.Grid;\nusing Game.Deep;\n"),
  "src/Rules/B.cs": csFile("Game.Deep.Inner", "using Acme.Net;\n"), "src/Rules/C.cs": csFile("Game.Rules", "using Acme;\n"),
  "src/py/a/test_x.py": "from b.c.d.e.f import g\nimport q.r\n", "src/py/b/__init__.py": "",
}, cfg({ ...layered, platform: ["Win.Forms", "Win", "q"] }));
ok(same(ids(found), ["package: src/Rules/B.cs -> Acme.Net", "package: src/View/A.cs -> Acme.Net", "platform: src/View/A.cs -> Win", "platform: src/py/a/test_x.py -> q"]) && found.read.nowhere === 1 && same([...found.unsure], ["src/py/a/test_x.py"]),
  "a dotted name is matched by the longest package declared and the shortest platform it lies under; a namespace holding only deeper ones leads to no file; a module deeper than any file is outside", JSON.stringify([ids(found), found.read.nowhere, [...found.unsure]]));
// (a large file, or many files, of each kind is read in time, in step with its size, well within the suite's time mark)
const many = { "src/App.csproj": '<Project><ItemGroup><PackageReference Include="Pkg" /></ItemGroup></Project>' };
for (let i = 0; i < 3000; i++) { many[`src/Rules/R${i}.cs`] = "using Pkg;\n"; many[`src/View/V${i}.cs`] = "using Pkg;\n"; }
ok(ids(survey(many, cfg(layered))).filter(id => id.startsWith("package: ")).length === 6000, "a package imported from many files in two systems is found once in each file");
const large = [
  [{ "package.json": JSON.stringify({ dependencies: { dep: "1" } }), "src/a.mjs": 'import "dep";\n'.repeat(130000) }, f => f.read.imports === 130000],
  [{ "src/a.cs": `using ${Array(130000).fill("a").join(".")};\n` }, f => f.read.nowhere === 1],
  [{ "src/a.cs": `${Array.from({ length: 80000 }, (_, i) => `using Z${i};`).join("\n")}\n${Array.from({ length: 80000 }, (_, i) => `namespace N${i} { }`).join("\n")}\n` }, f => f.read.nowhere === 80000],
  [{ "src/a.py": `from ${Array(32500).fill("a").join(".")} import ${Array(32500).fill("b").join(", ")}\n` }, f => f.read.nowhere === 1],
];
ok(large.every(([texts, holds]) => holds(survey(texts, cfg({})))), "a large file of each kind of import is read in time, in step with its size, and what it holds still counted");
const pyLong = (name, lines) => `def ${name}(n):\n${"    n += 1\n".repeat(lines - 2)}    return random.randint(1, n)\n`;
found = survey({
  "pyproject.toml": '[project]\nname = "game"\ndependencies = ["requests>=2"]\n[project.optional-dependencies]\ndev = ["pytest"]\n',
  "game/__init__.py": "",
  "game/rules/__init__.py": "from .dice import roll\n",
  "game/rules/dice.py": `import random\nimport datetime\nfrom game.view import board\nimport requests\nstarted = datetime.datetime.now()\n\n${pyLong("roll", 61)}`,
  "game/view/board.py": "from ..rules import dice\nimport requests\nimport pytest\nimport winreg\nimport yaml\n\ndef later():\n    from game.host import io\n",
  "game/host/io.py": "import winreg\nfrom typing import TYPE_CHECKING\nif TYPE_CHECKING:\n    from game.view.board import later\n",
}, cfg({ ...layered, platform: ["winreg"] }));
ok(same(ids(found), ["clock: game/rules/dice.py: datetime.datetime.now", "clock: game/rules/dice.py: random.", "crossing: rules -> view: game/rules/dice.py -> game/view/board.py", "crossing: view -> host: game/view/board.py -> game/host/io.py", "cycle: game/rules/dice.py -> game/view/board.py", "cycle: game/view/board.py -> game/rules/dice.py",
  "function: game/rules/dice.py#roll", "package: game/rules/dice.py -> requests", "package: game/view/board.py -> requests", "platform: game/view/board.py -> winreg"]) && found.read.nowhere === 1 && found.readers.get("game/host/io.py") === "python",
  "Python: the same, relative imports too; an import in a def crosses but makes no cycle, nor one of types alone; a package of development alone and the standard library are not found, and an undeclared one is counted", ids(found));
found = survey({
  "web/a.js": "var App = {};\nfunction helper() {}\n",
  "web/b.js": "function helper() {}\n",
  "web/c.js": "const Only = 1;\n",
  "web/d.js": "var p = f(1, 2), q = 2;\n",
  "web/e.js": "const { r, s: t = g(1, 2), u: { w } } = window.cfg;\n",
  "web/m.js": "export const x = 1;\nconst y = 2;\n",
  "web/n.mjs": "const a = 1, b = 2;\n",
  "web/t.d.ts": "declare const A: number;\ndeclare const B: number;\n",
  "esm/package.json": JSON.stringify({ type: "module" }),
  "esm/s.js": "const p = 1;\nconst q = 2;\n",
  "web/a.test.js": "function one() {}\nfunction two() {}\n",
}, cfg({}), new Set(["web/a.test.js"]));
ok(same(ids(found), ["global: web/a.js: App", "global: web/a.js: helper", "global: web/b.js: helper", "global: web/d.js: p", "global: web/d.js: q", "global: web/e.js: r", "global: web/e.js: t", "global: web/e.js: w"]) && same(["global: web/a.js: helper", "function: a/b.js#f#2", "cycle: x.js -> y.js", "crossing: a -> b: x.js -> y.js", "clock: z.js: Date.now"].map(fileOf), ["web/a.js", "a/b.js", "x.js", "x.js", "z.js"]) && readerOf("global: web/b.js: helper", found.readers) === "scripts",
  "scripts that share one global space: a second name of one file (one of a list, or of a destructuring, too) and a name two files declare are found; one name of its own, a module (by what it holds, its extension or its package.json), types alone and a test are not", ids(found));

// ---- what covers an entry ----
const M = new Map([["function: a.js#f", { lines: 100, depth: 2, branches: 3 }], ["cycle: a.js -> b.js", true], ["crossing: rules -> view: a.js -> b.js", true]]);
const want = entries => new Map(entries);
ok(unclaimed(want([["function: a.js#f", { lines: 90, depth: 4, branches: 15 }]]), M, MARKS).length === 0 && unclaimed(want([["function: a.js#f", { lines: 101, depth: 2, branches: 3 }]]), M, MARKS).length === 1 && unclaimed(want([["function: a.js#f", { lines: 100, depth: 5, branches: 3 }]]), M, MARKS).length === 1,
  "a listed function may shrink, and may grow under a mark it did not pass; past what is listed, or past another mark, it is new");
ok(unclaimed(want([["function: lib/b.js#f", { lines: 100, depth: 2, branches: 3 }]]), M, MARKS).length === 0 && unclaimed(want([["function: lib/b.js#g", { lines: 100, depth: 2, branches: 3 }]]), M, MARKS).length === 1
  && unclaimed(want([["function: a.js#f", { lines: 100, depth: 2, branches: 3 }], ["function: b.js#f", { lines: 100, depth: 2, branches: 3 }]]), M, MARKS).length === 1,
  "a listed function may move under its name, once: a second of that name, and one of another name, are new");
ok(unclaimed(want([["cycle: c.js -> d.js", true]]), M).length === 0 && unclaimed(want([["cycle: a.js -> b.js", true], ["cycle: c.js -> d.js", true]]), M).length === 1 && unclaimed(want([["crossing: rules -> view: c.js -> d.js", true]]), M).length === 0 && unclaimed(want([["crossing: view -> rules: c.js -> d.js", true]]), M).length === 1,
  "an import on a cycle, or across one boundary, may stand in place of one that went; one more, or one across another boundary, is new");
ok(same(["function: a/b.js#f#2", "inside: (no system) -> rules: a.js -> b.js", "platform: a.js -> node:fs", "clock: a.js: new Date()", "package: a.js -> @x/y", "global: a.js: App"].map(id => groupOf(id).group), ["f", "(no system) -> rules", "node:fs", "new Date()", "@x/y", "App"]), "an entry's group is read from its id");

// ---- the verdict, against a base ----
// (a baseline written when the check read JavaScript and TypeScript alone, their functions on the parser)
const listed = entries => JSON.stringify({ reads: ["javascript", "javascript-tree"], listed: Object.fromEntries(entries) });
const f100 = ["function: src/a.js#tall", { lines: 100, depth: 0, branches: 0 }];
const judge = ({ now, baseline, base, conf = cfg({}) }) => verdict({ config: conf, at: "checks/shape.json", self: "core/scripts/shape.mjs", found: survey(now, conf), baselineText: baseline, base });
const said = v => v.fail.flat().join("\n");
let v = judge({ now: { "src/a.js": long("tall", 100) }, baseline: listed([f100]) });
ok(v.fail.length === 0 && v.listed === 1, "what the baseline lists passes");
v = judge({ now: { "src/a.js": long("tall", 101) + long("other", 61) }, baseline: listed([f100]) });
ok(mended(said(v)) && v.fail.length === 1 && /2 functions pass/.test(said(v)) && /src\/a\.js#other \(line 102\): 61 lines/.test(said(v)), "a listed function that grew and a new one past a mark fail, each named with its line and its numbers", said(v));
v = judge({ now: { "src/a.js": long("tall", 90) }, baseline: listed([f100, ["cycle: x.js -> y.js", true]]) });
ok(mended(said(v)) && /lists 1 entry that is gone or moved/.test(said(v)) && /--write/.test(said(v)) && !/tall/.test(said(v)), "an entry that is gone fails until the baseline is lowered; one that only shrank passes", said(v));
v = judge({ now: { "src/b.js": long("tall", 100) }, baseline: listed([f100]) });
ok(v.fail.length === 1 && /gone or moved/.test(said(v)) && !/functions? pass/.test(said(v)), "a listed function that moved is no new breach: its old entry is lowered", said(v));
ok(mended(`FAIL: ${(() => { try { judge({ now: {}, baseline: "{}" }); return ""; } catch (e) { return e.message; } })()}`), "a baseline that is none is refused, with its mend");
const baseOf = (baseline, texts, conf = config({})) => ({ name: "origin/main", baseline, config: conf, standing: () => ({ texts, tests: new Set() }) });
v = judge({ now: { "src/a.js": long("tall", 100) + long("mid", 50) + long("fresh", 45) }, conf: cfg({ marks: { lines: 40 } }), baseline: listed([f100]), base: baseOf(listed([f100]), { "src/a.js": long("tall", 100) + long("mid", 50) }) });
ok(mended(said(v)) && v.fail.length === 2 && /1 breach that origin\/main held already is not in/.test(v.fail[0][0]) && /SHAPE_BASE=origin\/main node core\/scripts\/shape\.mjs checks\/shape\.json --write/.test(v.fail[0][0]) && /#mid/.test(v.fail[0][1]) && /1 function passes/.test(v.fail[1][0]) && /#fresh/.test(v.fail[1][1]),
  "where the config reads more than it did, what the base held already is told from what is new, and its mend is to list it", said(v));
v = judge({ now: { "src/a.js": long("tall", 100) + long("other", 70) }, baseline: listed([f100, ["function: src/a.js#other", { lines: 70, depth: 0, branches: 0 }]]), base: baseOf(listed([f100]), { "src/a.js": long("tall", 100) + long("other", 60) }) });
ok(mended(said(v)) && /lists 1 entry that origin\/main neither listed nor held/.test(said(v)) && /"grown"/.test(said(v)), "an entry that joins the baseline, of code that got worse, fails against the base", said(v));
v = judge({ now: { "src/a.js": long("tall", 100) + long("other", 70) }, baseline: JSON.stringify({ reads: ["javascript", "javascript-tree"], grown: { "function: src/a.js#other": "it mirrors the table of the standard, which a split would hide" }, listed: { [f100[0]]: f100[1], "function: src/a.js#other": { lines: 70, depth: 0, branches: 0 } } }), base: baseOf(listed([f100]), { "src/a.js": long("tall", 100) + long("other", 60) }) });
ok(v.fail.length === 0, "and passes where the baseline gives its reason under \"grown\"", said(v));
v = judge({ now: { "src/a.js": long("tall", 100) }, baseline: listed([f100]), base: baseOf(null, { "src/a.js": long("tall", 100) }, null) });
ok(v.fail.length === 0, "a first baseline lists what the base already held: the check has come, and nothing got worse", said(v));
v = judge({ now: { "src/a.js": long("tall", 100) + long("mid", 50) }, conf: cfg({ marks: { lines: 40 } }), baseline: listed([f100, ["function: src/a.js#mid", { lines: 50, depth: 0, branches: 0 }]]), base: baseOf(listed([f100]), { "src/a.js": long("tall", 100) + long("mid", 50) }) });
ok(v.fail.length === 0, "an entry joins where the check reads more (a mark lowered) and the base held it already", said(v));
v = judge({ now: {}, conf: cfg({ marks: { lines: 80 }, suites: { unit: 90, win: { linux: 10, win32: 50 }, loose: { linux: 5 } } }), baseline: listed([]), base: baseOf(listed([]), {}, config({ suites: { unit: 60, win: { linux: 10, win32: 40 }, gone: 5, loose: 9 } })) });
ok(mended(said(v)) && same(v.fail[0].slice(1), ["  mark: lines", "  mark: suite unit", "  mark: suite win", "  mark: suite gone", "  mark: suite loose"]), "a mark raised, a suite's raised on one platform, and one dropped or left unmarked on a platform, fail against the base", said(v));
v = judge({ now: {}, conf: cfg({ wait: 900 }), baseline: listed([]), base: baseOf(listed([]), {}, config({ wait: 600 })) });
ok(mended(said(v)) && same(v.fail[0]?.slice(1), ["  mark: wait"]), "the wait's mark on a push's checks raised fails against the base, as a suite's does", said(v));
v = judge({ now: {}, conf: cfg({ wait: 500 }), baseline: listed([]), base: baseOf(listed([]), {}, config({ wait: 600 })) });
ok(v.fail.length === 0, "and lowered, passes", said(v));
const view = { "src/view/b.js": "export const b = 1;\n" }, viewTest = { ...view, "src/view/b.test.js": "import { b } from './b.js';\nimport { chromium } from 'playwright';\n" };
const screenJudge = (now, reads, baseTexts) => verdict({ config: screenCfg, at: "checks/shape.json", self: "core/scripts/shape.mjs", found: survey(now, screenCfg, new Set(Object.keys(now).filter(f => f.endsWith(".test.js")))), baselineText: JSON.stringify({ reads, listed: {} }),
  base: { name: "origin/main", baseline: JSON.stringify({ reads, listed: {} }), config: JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"] }), standing: () => ({ texts: baseTexts, tests: new Set(Object.keys(baseTexts).filter(f => f.endsWith(".test.js"))) }) } });
v = screenJudge(viewTest, ["javascript", "jsx", "csharp", "python", "scripts"], viewTest);
ok(v.fail.length === 0 && v.notes.some(n => /1 test file of 1 opens a screen/.test(n)) && v.notes.some(n => /tests that open a screen.*1 breach that stood before/.test(n)), "a test that opened a screen before the baseline named the reader is counted and said, never failed", JSON.stringify(v));
v = screenJudge(viewTest, Object.keys(READERS), view);
ok(mended(said(v)) && /1 test imports what opens a screen/.test(said(v)) && /beneath the screen/.test(said(v)), "once it does, a new test that opens one fails, its mend to test beneath the screen or give its reason", said(v));
const timedTest = { "src/view/b.js": "export const b = 1;\n", "src/view/b.test.js": "import { b } from './b.js';\nimport { execFileSync } from 'node:child_process';\nconst t = Date.now();\n" };
const reachJudge = (now, reads, baseTexts) => verdict({ config: reachCfg, at: "checks/shape.json", self: "core/scripts/shape.mjs", found: survey(now, reachCfg, new Set(Object.keys(now).filter(f => f.endsWith(".test.js")))), baselineText: JSON.stringify({ reads, listed: {} }),
  base: { name: "origin/main", baseline: JSON.stringify({ reads, listed: {} }), config: JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"] }), standing: () => ({ texts: baseTexts, tests: new Set(Object.keys(baseTexts).filter(f => f.endsWith(".test.js"))) }) } });
const before = reachJudge(timedTest, Object.keys(READERS).filter(r => r !== "clocks" && r !== "processes"), timedTest);
ok(before.fail.length === 0 && before.notes.some(n => /1 test file of 1 reaches a real clock/.test(n)) && before.notes.some(n => /1 test file of 1 starts another process/.test(n)) && before.notes.some(n => /reach a real clock, the tests that start another process: 2 breaches that stood before/.test(n)),
  "a test that reached a clock or started a process before the baseline named the readers is counted and said, never failed (a sync turns nothing red)", JSON.stringify(before));
const after = said(reachJudge(timedTest, Object.keys(READERS), { "src/view/b.js": timedTest["src/view/b.js"] }));
ok(mended(after) && /1 test reaches a real clock/.test(after) && /beneath the clock/.test(after) && /a fake clock it installs/.test(after) && /1 test starts another process/.test(after) && /beneath the process/.test(after),
  "once it does, a new one of each fails, its mend to test beneath the clock or the process, or give its reason under \"grown\"", after);
v = judge({ now: {}, conf: cfg({ marks: { lines: 80 } }), baseline: JSON.stringify({ reads: ["javascript", "javascript-tree"], grown: { "mark: lines": "the generated tables run to 75 lines each" }, listed: {} }), base: baseOf(listed([]), {}, config({})) });
ok(v.fail.length === 0, "and pass where \"grown\" gives the raise its reason");
const named = cfg({ systems: { rules: { paths: ["src/rules/"] } } });
v = judge({ now: { "src/rules/a.js": "export const a = 1;\n", "src/old.js": "export const o = 1;\n", "src/new.js": "export const n = 1;\n" }, conf: named, baseline: listed([]), base: baseOf(listed([]), { "src/old.js": "export const o = 1;\n" }) });
ok(mended(said(v)) && v.fail.length === 1 && /1 new file of code lies in no system/.test(said(v)) && v.fail[0].slice(1).join() === "  src/new.js", "once a system is named, a file of code the pull request adds that lies in none fails; one the base held does not", said(v));
v = judge({ now: { "src/new.js": "export const n = 1;\n" }, baseline: listed([]), base: baseOf(listed([]), {}) });
ok(v.fail.length === 0, "where no system is named yet, none does");
v = judge({ now: { "src/rules/a.js": "import '../view/b.js';\n", "src/view/b.js": "export const b = 1;\n" }, conf: cfg(two({ uses: ["view"] }, {})), baseline: listed([]), base: baseOf(listed([]), { "src/view/b.js": "export const b = 1;\n" }, config(two({}, {}))) });
ok(v.fail.length === 0, "a use declared in the config with its first import passes: declaring is how a dependency is allowed, and the reviews read the config's change", said(v));
ok(parseBaseline(JSON.stringify({ audited: { day: "2026-11-15", listed: 3, read: 90 }, listed: {} }), "b.json", "").audited.listed === 3, "a baseline keeps the day and the counts of its last audit");

// a reader the baseline does not name yet: what the base held of it is said, never failed (a sync turns nothing red)
const csBig = { "src/A.cs": `namespace N;\nclass A {\n${csLong("Big", 70)}}\n` }, allReads = { reads: Object.keys(READERS) };
v = judge({ now: csBig, baseline: listed([]), base: baseOf(listed([]), csBig) });
ok(v.fail.length === 0 && v.notes.some(n => /written before the check read files that hold JSX, C#, its functions by the lexer, C#, its functions by the parser, Python, scripts that share one global space, the tests that open a screen, a window or a device, the tests that reach a real clock, the tests that start another process: 1 breach that stood before is not listed yet/.test(n) && /--write/.test(n)),
  "a baseline written before a reader came: what the base held of it is said, not failed", JSON.stringify(v));
v = judge({ now: { ...csBig, "src/B.cs": `namespace N;\nclass B {\n${csLong("New", 70)}}\n` }, baseline: listed([]), base: baseOf(listed([]), csBig) });
ok(mended(said(v)) && v.fail.length === 1 && /1 function passes/.test(said(v)) && /B\.cs#New/.test(said(v)) && !/A\.cs/.test(said(v)), "and what is new of it fails, from the sync on", said(v));
v = judge({ now: csBig, baseline: listed([]) });
ok(v.fail.length === 0 && v.notes.some(n => /1 breach that stood before/.test(n)), "with no base told, what it finds is said, never failed", said(v));
v = judge({ now: { "src/v.js": `export const V = () => <p>{x}</p>;\n${long("tall", 70)}` }, baseline: JSON.stringify({ listed: { "function: src/v.js#V": { lines: 90, depth: 0, branches: 0 } } }), base: baseOf(listed([]), {}) });
ok(!v.fail.some(f => /gone or moved/.test(f[0])) && v.notes.some(n => /1 entry listed there reads otherwise now/.test(n)), "an entry listed of a file a new reader reads otherwise is said, not failed", said(v));
v = judge({ now: csBig, baseline: JSON.stringify({ ...allReads, listed: {} }), base: baseOf(listed([]), csBig) });
ok(mended(said(v)) && /held already is not in/.test(said(v)) && !v.notes.some(n => /written before/.test(n)), "once the baseline names the reader, what it does not list fails as any other", said(v));
v = judge({ now: { "src/a.tsx": "export const a = 1;\n", "src/b.tsx": lostJsx }, baseline: JSON.stringify({ ...allReads, listed: { "lost: src/a.tsx": true } }), base: baseOf(JSON.stringify({ ...allReads, listed: { "lost: src/a.tsx": true } }), { "src/a.tsx": lostJsx }) });
ok(mended(said(v)) && /src\/b\.tsx/.test(said(v)) && /cannot follow/.test(said(v)), "a file lost covers itself alone: another one lost in its place fails", said(v));
const refusedReads = reads => { try { parseBaseline(JSON.stringify({ reads, listed: {} }), "b.json", ""); return ""; } catch (e) { return `FAIL: ${e.message}`; } };
ok(mended(refusedReads("all")) && mended(refusedReads(["javascript", "cobol"])), "readers that are no list, or a name no reader has, are refused, with their mend");
v = judge({ now: csBig, baseline: JSON.stringify({ reads: ["javascript"], listed: {} }), base: baseOf(JSON.stringify({ ...allReads, listed: { "function: src/A.cs#Big": { lines: 70, depth: 0, branches: 0 } } }), csBig) });
ok(mended(said(v)) && /no longer names 9 readers that origin\/main's names: jsx, javascript-tree, csharp, csharp-tree, python, scripts, screens, clocks, processes/.test(said(v)), "a baseline that drops a reader its base named fails, so that what it lists cannot go unlisted while it stands", said(v));

// ---- whole runs, in a scratch repository ----
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shape-test-"));
process.on("exit", () => { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* (left to the system's own cleaning) */ } });
const git = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
const run = (args, env = {}) => { const r = spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, SHAPE_BASE: "", ...env } }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const commit = what => { git("add", "-A"); git("commit", "-q", "-m", what); };
git("init", "-q", "-b", "main");
put("src/rules/index.js", `${long("tall", 100)}export const one = 1;\n`);
put("src/view/index.js", "import { one } from '../rules/index.js';\nexport const two = one + 1;\n");
put("README.md", "A scratch project.\n");
commit("a project");
let r = run([]);
ok(r.status === 0 && /has not written its config of the shape check yet/.test(r.out) && /nothing was held/.test(r.out), "a project with no config and no base passes, and says that nothing was held", r.out);
git("branch", "before");
r = run([], { SHAPE_BASE: "before" });
ok(r.status === 0 && /nothing new in how the code is put together against before, by the starter kit's config/.test(r.out), "with a base, a project with no config is held to the starter kit's, the base as its baseline: what stood passes", r.out);
put("src/rules/more.js", long("another", 61));
put("src/rules/more.test.js", long("inATest", 200));
put("core/scripts/copied.js", long("theCores", 200));
r = run([], { SHAPE_BASE: "before" });
ok(r.status === 1 && mended(r.out) && /1 function passes a mark/.test(r.out) && /more\.js#another/.test(r.out) && !/inATest|theCores/.test(r.out) && /once the project's own config names it under "tests"/.test(r.out),
  "and a pull request that adds a function past a mark fails, with its mend; a test's and the core's copy are not read", r.out);
for (const f of ["src/rules/more.js", "src/rules/more.test.js", "core"]) fs.rmSync(path.join(dir, f), { recursive: true });
r = run(["checks/shape.json"]);
ok(r.status === 1 && mended(r.out), "a config named and not there fails, with its mend", r.out);
put("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"], systems: { rules: { domain: "rules", paths: ["src/rules/"], entrance: "src/rules/index.js" }, view: { domain: "display", paths: ["src/view/"], uses: ["rules"] } }, suites: { quick: 30, slow: { [process.platform]: 0.001 } } }, null, 2));
r = run([]);
ok(r.status === 1 && mended(r.out) && /--first/.test(r.out), "a config with no baseline fails, saying how the first is written", r.out);
r = run(["checks/shape.json", "--first"]);
const baseline = () => JSON.parse(fs.readFileSync(path.join(dir, "checks/shape-baseline.json"), "utf8"));
ok(r.status === 0 && same(Object.keys(baseline().listed), ["function: src/rules/index.js#tall"]) && same(baseline().listed["function: src/rules/index.js#tall"], { lines: 100, depth: 0, branches: 0 }), "--first lists what stands, its numbers and no line", r.out);
ok(run(["checks/shape.json", "--first"]).status === 1 && mended(run(["checks/shape.json", "--first"]).out), "--first writes no second baseline");
commit("the shape check, with its first baseline");
git("branch", "base");
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 0 && /1 old breach listed/.test(r.out) && /1 system names no entrance/.test(r.out), "the check passes on what is listed, and says what it does not hold", r.out);
put("src/rules/clock.js", "import { two } from '../view/index.js';\nexport const now = () => Date.now() + two;\n");
put("src/rules/index.js", `import './clock.js';\n${long("tall", 100)}export const one = 1;\n`);
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /crosses from one system/.test(r.out) && /lies? on a cycle/.test(r.out) && /reads the clock/.test(r.out), "a pull request that adds an import across a boundary, a cycle and the rules' own clock fails, each with its mend", r.out);
fs.rmSync(path.join(dir, "src/rules/clock.js"));
put("src/rules/index.js", `${long("tall", 80)}export const one = 1;\n`);
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 0, "a listed function that shrank passes as it is listed", r.out);
r = run(["--write"]);
ok(r.status === 0 && baseline().listed["function: src/rules/index.js#tall"].lines === 80 && run([], { SHAPE_BASE: "base" }).status === 0, "--write lowers its numbers, and the check passes", r.out);
commit("tall, shorter");
git("branch", "-f", "base");
put("src/rules/index.js", `${long("tall", 81)}export const one = 1;\n`);
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /grows past what the baseline lists/.test(r.out) && !/held already/.test(r.out), "once the lowered baseline is the base's, it may not grow back", r.out);
put("src/rules/index.js", `${long("tall", 80)}export const one = 1;\n`);
put("src/rules/index.js", `${long("tall", 80)}${long("wide", 70)}export const one = 1;\n`);
fs.writeFileSync(path.join(dir, "checks/shape-baseline.json"), JSON.stringify({ listed: { ...baseline().listed, "function: src/rules/index.js#wide": { lines: 70, depth: 0, branches: 0 } } }));
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /neither listed nor held/.test(r.out), "an entry written into the baseline by hand, of code the base did not hold, fails against the base", r.out);
git("checkout", "-q", "base", "--", "checks/shape-baseline.json");
r = run(["--write"]);
ok(r.status === 0 && same(Object.keys(baseline().listed), ["function: src/rules/index.js#tall"]) && baseline().listed["function: src/rules/index.js#tall"].lines === 80 && /passes? a mark/.test(run([], { SHAPE_BASE: "base" }).out),
  "taken back as the base holds it and lowered, the baseline holds no more than before: --write never adds, and the new function fails as new", r.out);
fs.writeFileSync(path.join(dir, "checks/shape-baseline.json"), JSON.stringify({ grown: { "function: src/rules/index.js#wide": "a table of the standard, read as one" }, listed: baseline().listed }));
r = run(["--write"]);
ok(r.status === 0 && baseline().listed["function: src/rules/index.js#wide"].lines === 70 && run([], { SHAPE_BASE: "base" }).status === 0, "but for one \"grown\" gives a reason for, which then passes against the base", r.out);
commit("a function with its reason");
git("branch", "-f", "base");
put("checks/shape.json", fs.readFileSync(path.join(dir, "checks/shape.json"), "utf8").replace('"uses": [\n        "rules"\n      ]', '"uses": []'));
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /1 breach that base held already/.test(r.out) && !/crosses from one system/.test(r.out), "a config that reads more (a use no longer declared) fails on what stood, saying how it is listed", r.out);
ok(run(["--write"]).status === 0 && !Object.keys(baseline().listed).some(id => id.startsWith("crossing")), "--write alone lists nothing new");
r = run(["--write"], { SHAPE_BASE: "base" });
ok(r.status === 0 && "crossing: view -> rules: src/view/index.js -> src/rules/index.js" in baseline().listed && run([], { SHAPE_BASE: "base" }).status === 0, "told the base, --write lists what the base held already, and the check passes", r.out);
git("checkout", "-q", "--", "checks/shape.json", "checks/shape-baseline.json");
put("src/view/index.js", "export const two = 2;\n");
put("checks/shape.json", fs.readFileSync(path.join(dir, "checks/shape.json"), "utf8").replace('"code": [', '"marks": { "lines": 90 },\n  "code": ['));
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /raises or drops 1 mark/.test(r.out) && /mark: lines/.test(r.out), "a raised mark fails against the base", r.out);
git("checkout", "-q", "--", "checks/shape.json");
fs.rmSync(path.join(dir, "checks/shape.json"));
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /no pull request takes the shape check's config out/.test(r.out), "a pull request that takes the config out fails", r.out);
git("checkout", "-q", "--", "checks/shape.json");
r = run([], { SHAPE_BASE: "no such; branch" });
ok(r.status === 1 && mended(r.out), "a base that is no plain name is refused", r.out);
ok(run([], { SHAPE_BASE: "nowhere" }).status === 1 && mended(run([], { SHAPE_BASE: "nowhere" }).out) && run(["--sideways"]).status === 1 && mended(run(["--sideways"]).out), "and so are a base that is no commit and an option the check does not know");

// a baseline written before the readers came, and the sync that brings them: nothing red, then --write lists it
git("checkout", "-q", "--", ".");
put("src/rules/Big.cs", `namespace Game.Rules;\nclass Big {\n${csLong("Roll", 70)}}\n`);
fs.writeFileSync(path.join(dir, "checks/shape-baseline.json"), JSON.stringify({ listed: baseline().listed }, null, 2));
commit("C# that stood before the check read it, and a baseline that names no reader");
git("branch", "-f", "base");
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 0 && /note .*written before the check read .*C#.*1 breach that stood before is not listed yet/.test(r.out), "a pull request after the sync that brings the readers passes, and says what is not listed yet", r.out);
put("src/rules/More.cs", `namespace Game.Rules;\nclass More {\n${csLong("Fresh", 70)}}\n`);
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /More\.cs#Fresh/.test(r.out) && !/Big\.cs#Roll/.test(r.out), "one that adds C# past a mark fails, naming it alone", r.out);
fs.rmSync(path.join(dir, "src/rules/More.cs"));
r = run(["--write"]);
ok(r.status === 0 && "function: src/rules/Big.cs#Roll" in baseline().listed && baseline().reads.includes("csharp") && run([], { SHAPE_BASE: "base" }).status === 0 && !/written before/.test(run([], { SHAPE_BASE: "base" }).out),
  "--write lists what the new readers find and names them, and the check passes against the base", r.out);
commit("the readers' finds listed");
git("branch", "-f", "base");
put("src/rules/Big.cs", `namespace Game.Rules;\nclass Big {\n${csLong("Roll", 75)}}\n`);
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /grows? past what the baseline lists/.test(r.out), "from then on, a listed function of C# may not grow", r.out);
git("checkout", "-q", "--", ".");
put("checks/shape.json", fs.readFileSync(path.join(dir, "checks/shape.json"), "utf8").replace('"checks/shape-baseline.json"', '"checks/moved.json"'));
put("checks/moved.json", JSON.stringify({ reads: ["javascript"], listed: {} }));
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /no longer names 9 readers/.test(r.out), "a baseline moved to a new path is compared with the one the base's config names: its readers too only grow", r.out);
fs.rmSync(path.join(dir, "checks/moved.json"));
git("checkout", "-q", "--", ".");
put("core-manifest.md", "| *shape check* | `core/scripts/shape.mjs` with `checks/other.json` |\n");
put("checks/other.json", fs.readFileSync(path.join(dir, "checks/shape.json"), "utf8").replace('"checks/shape-baseline.json"', '"checks/moved.json"'));
put("checks/moved.json", JSON.stringify({ reads: ["javascript"], listed: {} }));
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /no longer names 9 readers/.test(r.out), "a config moved by the manifest is compared with the one the base's own manifest names, its baseline too", r.out);
for (const f of ["core-manifest.md", "checks/other.json", "checks/moved.json"]) fs.rmSync(path.join(dir, f));
git("checkout", "-q", "--", ".");
put("core-manifest.md", "| *shape check* | `core/scripts/shape.mjs` with `checks/gone.json` |\n");
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /holds it at checks\/shape\.json, where its manifest names it: no pull request takes the shape check's config out/.test(r.out), "a manifest that names a config nowhere, where the base's names one, fails: no pull request takes the config out so", r.out);
fs.mkdirSync(path.join(dir, "checks/gone.json"));
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /is no file/.test(r.out), "a config's path that is a folder fails, with its mend", r.out);
fs.rmSync(path.join(dir, "checks/gone.json"), { recursive: true });
fs.rmSync(path.join(dir, "core-manifest.md"));
put("checks/new.json", fs.readFileSync(path.join(dir, "checks/shape.json"), "utf8").replace('"code": [', '"marks": { "lines": 500 },\n  "code": ['));
r = run(["checks/new.json"], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /raises or drops 1 mark/.test(r.out), "a config named anew on the command line is compared with the one the base's rules name", r.out);
fs.rmSync(path.join(dir, "checks/new.json"));

if (process.platform !== "win32") { // (a link is made without a privilege only off Windows)
  fs.renameSync(path.join(dir, "checks/shape-baseline.json"), path.join(dir, "elsewhere.json"));
  fs.symlinkSync("../elsewhere.json", path.join(dir, "checks/shape-baseline.json"));
  ok([[], ["--write"]].every(a => { const x = run(a); return x.status === 1 && mended(x.out) && /reached through a link/.test(x.out); }) && fs.readFileSync(path.join(dir, "elsewhere.json"), "utf8").includes("listed"),
    "a baseline that is a link is neither read nor written through", run([]).out);
  fs.rmSync(path.join(dir, "checks/shape-baseline.json"));
  fs.renameSync(path.join(dir, "elsewhere.json"), path.join(dir, "checks/shape-baseline.json"));
}

// a suite held to its time
r = run(["checks/shape.json", "--suite", "quick", "--", process.execPath, "-e", "console.log('ran')"]);
ok(r.status === 0 && /ran/.test(r.out) && /the suite quick took \d+ s, within its mark of 30/.test(r.out), "a suite within its mark passes, its own output shown", r.out);
r = run(["checks/shape.json", "--suite", "slow", "--", process.execPath, "-e", "0"]);
ok(r.status === 0 && /^::warning::the suite slow took \d+ s, past its mark of 0\.001, which fails nothing\. Mend: /m.test(r.out) && !/FAIL/.test(r.out), "a suite past its mark, on this platform, is said as a warning with its mend and fails nothing (#733, point 5)", r.out);
r = run(["checks/shape.json", "--suite", "quick", "--", process.execPath, "-e", "process.exit(7)"]);
ok(r.status === 7 && !/FAIL/.test(r.out), "a suite that fails keeps its own status, and the check adds nothing", r.out);
r = run(["checks/shape.json", "--suite", "quick", "--since", String(Math.floor(Date.now() / 1000) - 100)]);
ok(r.status === 0 && /^::warning::the suite quick took 10\d s, past its mark/m.test(r.out), "a time taken since a start the workflow gave is measured against the mark too", r.out);
ok([["--suite", "unnamed", "--", "x"], ["--suite", "quick"], ["--suite", "quick", "--since", "soon"], ["--suite", "quick", "--", "no-such-command-here"]].every(a => { const x = run(["checks/shape.json", ...a]); return x.status === 1 && mended(x.out); }),
  "a suite with no mark, no command, no start or a command that cannot be started is refused, with its mend");

// (a config or baseline is read only inside the project, however its path is written)
const outside = file => { try { notLinked(file); return ""; } catch (e) { return `FAIL: ${e.message}`; } };
ok(["../shape.json", "checks/../../shape.json", "/etc/shape.json", "C:/shape.json", "\\shape.json"].every(f => mended(outside(f)) && /lies outside the project/u.test(outside(f))) && outside("checks/shape.json") === "" && outside("./checks/shape.json") === "",
  "a config or baseline named outside the project is refused, with its mend; one inside it is read");
console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
