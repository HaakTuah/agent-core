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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { fileOf, groupOf, LONG, MARKS, notLinked, offBy, parseBaseline, parseConfig, readerOf, scanMend, survey, unclaimed, verdict, where } from "../scripts/shape.mjs";
import { READERS } from "../scripts/shape-readers.mjs";
import { LARGEST } from "../scripts/tree-walk.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

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
  "wraps that hold an empty name": config(two({ wraps: ["", "lodash"] }, {})),
  "uses that hold an empty name": config(two({ uses: ["", "view"] }, {})),
  "a use of no system": config(two({ uses: ["sound"] }, {})),
  "a use of itself": config(two({ uses: ["rules"] }, {})),
  "an entrance outside its paths": config(two({ entrance: "src/view/index.js" }, {})),
  "a domain that is no name": config(two({ domain: "The Rules" }, {})),
  "the rules using the display": config(two({ domain: "rules", uses: ["view"] }, { domain: "display" })),
  "a package wrapped twice": config(two({ wraps: ["lodash"] }, { wraps: ["lodash"] })),
  "a circle of uses": config(two({ uses: ["view"] }, { uses: ["rules"] })),
  "screens that are no list": config({ screens: "playwright" }),
  "changes that are no list": config({ changes: "Changed:" }),
  "a change's mark with a control character": config({ changes: ["Ticket:\u0007"] }),
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
// (told a base that held none of it: with no base, or one that held the file, it is said, never failed, below)
const lostBaseline = JSON.stringify({ reads: Object.keys(READERS), listed: {} });
const lostSaid = verdict({ config: cfg({}), at: "c.json", self: "s", found, baselineText: lostBaseline, base: { name: "origin/main", baseline: lostBaseline, config: config({}), standing: () => ({ texts: {}, tests: new Set() }) } }).fail.flat().join("\n");
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

// ---- the comments that mark a change (#458) ----
const changeCfg = cfg({ changes: ["Ticket: ABC-"] });
const marked = survey({
  "src/a.js": "// Changed: the loop runs once (old code below)\nconst a = 1; // Fixed in #12\n/* Previously: a map\n * Added 2024-05-01\n * then the rest of a comment that\n * changed: nothing, a line going on in small letters\n */\nconst s = \"// Changed: in a string\";\n// Ticket: ABC-12, the task's own mark\n// moved here 2025-01-02 from b.js\n// replaced by utf-8, a reason\n// padding is added per RFC-4648, lone surrogates replaced by UTF-8 bytes\n// Deprecated: use parseUrl() instead\n// Stripe changed the webhook format on 2023-08-16; older events lack it\n",
  "src/b.cs": "// CHANGED: a heading in capitals\n/// Previously: scanned on every call\n/// was renamed from Foo for ABC-9 (a reason, no mark)\nclass B {}\n",
  "src/c.py": "# Updated for PR 42\nx = '# Changed: in a string'\n",
  "src/d.js": "// Why the loop runs twice: the reader needs both passes (#458 gives the reason)\nexport const d = 1;\n",
}, changeCfg);
const changes = ids(marked).filter(id => id.startsWith("change: "));
ok(same(changes, ["change: src/a.js: \"Ticket:\\u0020ABC-\"", "change: src/a.js: a change's date", "change: src/a.js: a change's heading", "change: src/a.js: the task that changed it", "change: src/a.js: what the code was", "change: src/b.cs: a change's heading", "change: src/b.cs: what the code was", "change: src/c.py: the task that changed it"])
  && marked.entries.get("change: src/a.js: a change's heading").n.count === 2 && marked.entries.get("change: src/a.js: the task that changed it").n.count === 1 && marked.entries.get("change: src/a.js: a change's date").n.count === 1 && readerOf("change: src/a.js: a change's date", marked.readers) === "changes" && fileOf("change: src/a.js: what the code was") === "src/a.js"
  && groupOf("change: src/a.js: \"Ticket:\\u0020ABC-\"").group === "\"Ticket:\\u0020ABC-\"",
  "a comment line that marks a change is an entry of the reader \"changes\", counted by file and mark, in JavaScript, C# and Python, a mark of the config's too; a string, a line going on in small letters, a reason and a pointer to an issue are none", changes.join("\n"));
// (a block comment of 300,000 lines in JavaScript, and of 19,000 in C#, under the largest its reader takes, read
// whole and overflowing nothing; a file whose JSX the reader cannot follow gives no marks, since what it would take for
// a comment may be the element's text)
const tall = `/*\n * Changed: x\n${" * a line\n".repeat(300000)} */\nconst t = 1;\n`;
const longMarked = survey({ "src/t.js": tall, "src/t.cs": `/*\n * Changed: x\n${" * a line\n".repeat(19000)} */\nclass T {}\n`, "src/l.jsx": "const cast = <T>(x: T) => x;\nconst p = <p>// Changed: the text</p>;\n" }, cfg({}));
ok(longMarked.entries.get("change: src/t.js: a change's heading")?.n.count === 1 && longMarked.entries.get("change: src/t.cs: a change's heading")?.n.count === 1 && !ids(longMarked).some(id => id.startsWith("change: src/l.jsx")),
  "a block comment of 300,000 lines is read whole in JavaScript, and of 19,000 in C#, and a file whose JSX the reader cannot follow gives no marks", ids(longMarked).join("\n"));
// (a minified file of 100,000 inline comments on one line, read in time: each comment's lines found within it alone)
const minStart = Date.now(), minified = survey({ "src/min.js": `var a=${"/*#__PURE__*/f()+".repeat(100000)}1;\n` }, cfg({}));
ok(Date.now() - minStart < 5000 && !ids(minified).some(id => id.startsWith("change: ")), "a minified file of 100,000 inline comments on one line is read in time", `${Date.now() - minStart} ms`);
const changeSaid = verdict({ config: changeCfg, at: "c.json", self: "s", found: marked, baselineText: JSON.stringify({ reads: ["javascript", "jsx", "csharp", "python", "scripts", "screens", "changes"], listed: {} }) }).fail.flat().join("\n");
ok(mended(changeSaid) && /comment lines? marks? what changed/.test(changeSaid) && /commit's message/.test(changeSaid), "a new comment that marks a change fails, its mend saying where the words go", changeSaid);
const unread = verdict({ config: changeCfg, at: "c.json", self: "s", found: marked, baselineText: JSON.stringify({ reads: ["javascript", "jsx", "csharp", "python", "scripts", "screens"], listed: {} }) });
ok(!unread.fail.flat().join("\n").includes("what changed"), "a baseline written before the check read them fails nothing over them (Nothing locks a project)", unread.fail.flat().join("\n"));
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
  // (C#'s grammar nests a dotted name a part a level, so one of 130,000 parts is past what its reader follows: the file is
  // counted as lost, and its usings as ones the readers cannot follow)
  [{ "src/a.cs": `using ${Array(130000).fill("a").join(".")};\n` }, f => f.unsure.has("src/a.cs") && ids(f).includes("lost: src/a.cs")],
  [{ "src/a.cs": `${Array.from({ length: 6000 }, (_, i) => `using Z${i};`).join("\n")}\n${Array.from({ length: 6000 }, (_, i) => `namespace N${i} { }`).join("\n")}\n` }, f => f.read.nowhere === 6000],
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
  "function: game/rules/dice.py#roll", "package: game/rules/dice.py -> requests", "package: game/view/board.py -> requests", "platform: game/view/board.py -> winreg"]) && found.read.nowhere === 1 && found.readers.get("game/host/io.py") === "python-tree",
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
const baseOf = (baseline, texts, conf = config({})) => ({ name: "origin/main", baseline, config: conf, standing: () => ({ texts, tests: new Set() }) });
// (#750, point 5: a change that only improves on the baseline passes and says what --write takes out; one that writes
// the baseline writes it whole)
const gone = listed([f100, ["cycle: x.js -> y.js", true]]), noted = v => v.notes.join("\n");
const improved = [{}, { base: baseOf(gone, { "src/a.js": long("tall", 100) }) }, { base: baseOf(gone.replace(/\n?$/u, "\r\n"), { "src/a.js": long("tall", 100) }) }].map(b => judge({ now: { "src/a.js": long("tall", 90) }, baseline: gone, ...b }));
ok(improved.every(v => v.fail.length === 0 && /lists 1 entry that is gone or moved now, which fails nothing/.test(noted(v)) && /--write writes it/.test(noted(v)) && /: x\.js -> y\.js$/m.test(noted(v)) && !/tall/.test(noted(v))),
  "an entry that is gone, where the change leaves the baseline as its base holds it or names no base, passes and is said with the --write that takes it out; one that only shrank is not named", improved.map(noted).join("\n"));
v = judge({ now: { "src/a.js": long("tall", 90) }, baseline: gone.replace("}}", "}, \"grown\": {}}"), base: baseOf(gone, { "src/a.js": long("tall", 100) }) });
ok(mended(said(v)) && /lists 1 entry that is gone or moved now, and this change writes the baseline/.test(said(v)) && /--write/.test(said(v)) && !/tall/.test(said(v)) && !/gone or moved/.test(noted(v)), "where the change writes the baseline, an entry it leaves that is gone fails until --write lowers it", said(v));
const cycle = (a, b) => ({ [a]: `import "./${path.basename(b)}";\n`, [b]: `import "./${path.basename(a)}";\n` });
const loop = JSON.stringify({ reads: Object.keys(READERS), listed: { "cycle: src/x.js -> src/y.js": true, "cycle: src/y.js -> src/x.js": true } });
v = judge({ now: cycle("src/p.js", "src/q.js"), baseline: loop, base: baseOf(loop, {}) });
ok(mended(said(v)) && /src\/p\.js/.test(said(v)), "an entry the base's code no longer held, left listed by an earlier pull request, covers no new breach of its kind", said(v));
v = judge({ now: cycle("src/p.js", "src/q.js"), baseline: loop, base: baseOf(loop, cycle("src/x.js", "src/y.js")) });
ok(v.fail.length === 0, "one the base held, which this change moves, still covers it", said(v));
v = judge({ now: { "src/b.js": long("tall", 100) }, baseline: listed([f100]), base: baseOf(listed([f100]), { "src/b.js": long("tall", 100) }) });
ok(v.fail.length === 0 && /gone or moved/.test(noted(v)), "one an earlier pull request moved, the baseline left as it was, still covers it where it stands now (Codex's finding on #751)", said(v));
v = judge({ now: { "src/b.js": long("tall", 100), "src/c.js": long("tall", 100) }, baseline: listed([f100]), base: baseOf(listed([f100]), { "src/b.js": long("tall", 100) }) });
ok(mended(said(v)) && /src\/c\.js#tall/.test(said(v)), "and covers that one alone: a second of its name fails", said(v));
const fn = (id, lines) => [`function: ${id}`, { lines, depth: 0, branches: 0 }], pair = listed([fn("src/a.js#tall", 300), fn("src/x.js#tall", 100)]);
v = judge({ now: { "src/y.js": long("tall", 300) }, baseline: pair, base: baseOf(pair, { "src/y.js": long("tall", 100) }) });
ok(mended(said(v)) && /src\/y\.js#tall/.test(said(v)), "a moved one claims the smallest entry that covers it, never a mended one's larger numbers to grow into (the fallback reviewer's finding on #751's fix)", said(v));
const even = listed([fn("src/a.js#tall", 100), fn("src/x.js#tall", 100)]);
v = judge({ now: { "src/y.js": long("tall", 100), "src/x.js": long("tall", 100) }, baseline: even, base: baseOf(even, { "src/y.js": long("tall", 100) }) });
ok(mended(said(v)) && !/writes the baseline/.test(said(v)), "a breach new at a moved entry's old id takes no mended entry's place: the base held one of the name, and two fail", said(v));
const py = n => `def tall(a):\n${"    a += 1\n".repeat(n - 1)}`, jsOnly = JSON.stringify({ reads: ["javascript", "javascript-tree"], listed: Object.fromEntries([fn("src/a.js#tall", 100)]) });
v = judge({ now: { "src/b.js": long("tall", 100), "src/z.py": py(100) }, baseline: jsOnly, base: baseOf(jsOnly, { "src/z.py": py(100) }) });
ok(mended(said(v)) && /src\/b\.js#tall/.test(said(v)), "a breach the base holds of a reader the baseline does not name moves no entry of another's", said(v));
// (what the base's code covers is matched as a breach claims an entry, all the base's breaches at once: #751's fifth round)
const grew = listed([fn("src/b.js#tall", 100), fn("src/c.js#tall", 300)]);
v = judge({ now: { "src/b.js": long("tall", 250) }, baseline: grew, base: baseOf(grew, { "src/b.js": long("tall", 250) }) });
ok(v.fail.length === 0 && /gone or moved/.test(noted(v)), "an entry a group-mate's grown breach stands by at the base still covers it: a change that changes no code passes", said(v));
v = judge({ now: { "src/a.js": long("tall", 100), "src/x.js": long("tall", 100) }, baseline: even, base: baseOf(even, { "src/a.js": long("tall", 100) }) });
ok(mended(said(v)) && /1 function passes/.test(said(v)) && /src\/x\.js#tall/.test(said(v)), "a mended entry an earlier pull request left listed covers no breach in its own place either, though no other entry is gone", said(v));
const wide = listed([fn("src/y.js#tall", 300)]), both = listed([fn("src/y.js#tall", 300), fn("src/z.js#tall", 300)]);
v = judge({ now: { "src/y.js": long("tall", 300), "src/z.js": long("tall", 300) }, baseline: wide, base: baseOf(wide, { "src/y.js": long("tall", 300) }) });
ok(mended(said(v)) && /1 function passes/.test(said(v)) && /src\/z\.js#tall/.test(said(v)) && !/held already/.test(said(v)), "a new breach takes no base breach's place that still stands and covers itself: it fails as new", said(v));
v = judge({ now: { "src/y.js": long("tall", 300), "src/z.js": long("tall", 300) }, baseline: both, base: baseOf(wide, { "src/y.js": long("tall", 300) }) });
ok(mended(said(v)) && /src\/z\.js#tall/.test(said(v)) && /neither listed nor held/.test(said(v)), "nor does an entry listed for it, as --write once wrote it", said(v));
v = judge({ now: { "src/b.js": long("tall", 100) }, baseline: jsOnly, base: baseOf(jsOnly, { "src/z.py": py(100) }) });
ok(mended(said(v)) && /src\/b\.js#tall/.test(said(v)), "nor where the change takes that breach out: the entry it would have claimed is mended", said(v));
v = judge({ now: { "src/b.js": long("tall", 250), "src/z.js": long("tall", 100) }, baseline: grew, base: baseOf(grew, { "src/b.js": long("tall", 250), "src/q.js": long("tall", 400) }) });
ok(mended(said(v)) && /src\/z\.js#tall/.test(said(v)), "the entry of a breach that grew at the base, which it lends to no other there, covers no other breach of the base's either", said(v));
const lowered = listed([fn("src/b.js#tall", 80)]);
v = judge({ now: { "src/b.js": long("tall", 80) }, baseline: lowered, base: baseOf(listed([f100]), { "src/a.js": long("tall", 100) }) });
ok(v.fail.length === 0, "a baseline this change lowered, of a breach it moved and shrank, still covers it", said(v));
// (an entry covers no more than the base held: #751's sixth round. `nested`: a function of so many lines, so deep, with
// as many branch points)
const nested = (name, lines, depth) => `export function ${name}(a) {\n${"if (a) {\n".repeat(depth)}${"  a++;\n".repeat(lines - 2 - 2 * depth)}${"}\n".repeat(depth)}}\n`;
const dn = (id, lines, depth) => [`function: ${id}`, { lines, depth, branches: depth }], low = cfg({ marks: { lines: 60 } }), loose = config({ marks: { lines: 120 } });
const stale = listed([dn("src/p.js#tall", 80, 1), dn("src/m.js#tall", 65, 6)]), flat = { "src/s.js": nested("tall", 100, 1) };
const lowering = (now, baseline = stale, was = flat) => judge({ now, conf: low, baseline, base: baseOf(stale, was, loose) });
v = lowering({ "src/s.js": nested("tall", 65, 6) });
ok(mended(said(v)) && /1 function passes/.test(said(v)) && /src\/s\.js#tall \(line 1\): 65 lines, 6 deep/.test(said(v)) && [100, 65].every(n => /held already/.test(said(lowering({ "src/s.js": nested("tall", n, 1) })))),
  "a breach the base held that no entry covers, the check reading more than it did, takes no mended entry's numbers to grow into: it fails as new where it nests deeper, and is to be listed, under no mended entry, where it stands as it stood or shrank (the fallback reviewer's finding on #751's sixth round)", said(v));
const asTest = { "src/t.test.js": nested("tall", 62, 1) }, wasTest = { ...baseOf(stale, asTest, config({ tests: ["src/t.test.js"] })), own: () => ({ texts: asTest, tests: new Set(Object.keys(asTest)) }) };
v = lowering({ "src/s.js": nested("tall", 65, 6) }, stale, { "src/s.js": nested("tall", 62, 1) });
ok(mended(said(v)) && /1 function passes/.test(said(v)) && /src\/s\.js#tall/.test(said(v)) && /src\/t\.test\.js#tall \(line 1\): 65 lines, 6 deep/.test(said(judge({ now: { "src/t.test.js": nested("tall", 65, 6) }, baseline: stale, base: wasTest }))),
  "nor where a mended entry's numbers would cover it: what a baseline left as it is covers is what the base's own check read under it, by the base's config, with its marks and its tests", said(v));
v = lowering({ "src/s.js": nested("tall", 65, 6) }, listed([dn("src/s.js#tall", 65, 6)]));
ok(mended(said(v)) && /1 function passes/.test(said(v)) && /neither listed nor held/.test(said(v)) && lowering({ "src/s.js": nested("tall", 65, 1) }, listed([dn("src/s.js#tall", 65, 1)])).fail.length === 0,
  "nor where the change lists it so: the entry it writes covers it only within what the base held of it", said(v));
const pairs = listed([dn("src/a.js#tall", 100, 2), dn("src/x.js#tall", 90, 6)]), paired = { "src/a.js": nested("tall", 100, 2), "src/y.js": nested("tall", 70, 6) };
v = lowering({ "src/m.js": nested("tall", 64, 6) }, listed([dn("src/m.js#tall", 64, 6)]));
ok(mended(said(v)) && /src\/m\.js#tall/.test(said(v)) && [pairs, listed([dn("src/a.js#tall", 80, 6)])].every(b => judge({ now: { "src/a.js": nested("tall", 80, 6) }, baseline: b, base: baseOf(pairs, paired) }).fail.length === 0),
  "an entry the change wrote covers a breach within what one of the base's stood under there, its entry in the base's baseline, as it did before --write wrote it; a mended one that comes back, listed a line lower, takes no other's place past what that one held", said(v));
const crossed = listed([dn("src/e1.js#tall", 100, 6), dn("src/e2.js#tall", 120, 1)]), cross = { "src/s1.js": nested("tall", 100, 1), "src/s2.js": nested("tall", 60, 6) };
v = judge({ now: { ...cross, "src/s2.js": nested("tall", 120, 6) }, baseline: crossed, base: baseOf(crossed, cross) });
ok(mended(said(v)) && /src\/s2\.js#tall \(line 1\): 120 lines/.test(said(v)) && [judge({ now: cross, baseline: crossed, base: baseOf(crossed, cross) }), judge({ now: cross, baseline: crossed })].every(r => r.fail.length === 0),
  "the order of claiming leaves no breach of the base's without an entry where each can have one: a change that changes no code passes, and one that grows a breach past every entry of its name fails", said(v));
const reason = { grown: { "function: src/g.js#tall": "no other way" } }, why = entries => JSON.stringify({ reads: ["javascript", "javascript-tree"], ...reason, listed: Object.fromEntries(entries) });
const elsewhere = baseline => judge({ now: { "src/h.js": long("tall", 200), "src/g.js": long("tall", 200) }, baseline, base: baseOf(why([fn("src/g.js#tall", 200)]), { "src/h.js": long("tall", 200) }) });
v = elsewhere(why([fn("src/g.js#tall", 200)]));
const kept = elsewhere(why([fn("src/g.js#tall", 200), fn("src/h.js#tall", 200)]));
ok(mended(said(v)) && v.fail.length === 1 && /held already/.test(said(v)) && /src\/h\.js#tall/.test(said(v)) && mended(said(kept)) && /1 function passes/.test(said(kept)) && /src\/g\.js#tall/.test(said(kept)),
  "an entry \"grown\" gives a reason for, its breach moved by an earlier pull request, covers one breach and no second: with a new one at its id, the moved one is to be listed where it stands, and once --write has kept the new one under the old reason, that one fails as new", `${said(v)}\n${said(kept)}`);
const adds = (now, entries) => judge({ now: { "src/g.js": long("tall", 200), ...now }, baseline: why([fn("src/g.js#tall", 200), ...entries]), base: baseOf(listed([fn("src/s.js#tall", 150)]), { "src/s.js": long("tall", 150) }) });
const raised = judge({ now: { "src/g.js": long("tall", 250), "src/t.js": long("tall", 220) }, baseline: why([fn("src/g.js#tall", 250), fn("src/t.js#tall", 220)]), base: baseOf(listed([fn("src/g.js#tall", 200), fn("src/s.js#tall", 220)]), { "src/g.js": long("tall", 200), "src/s.js": long("tall", 220) }) });
const second = judge({ now: { "src/g.js": long("tall", 250), "src/z.js": long("tall", 190) }, baseline: why([fn("src/g.js#tall", 250), fn("src/z.js#tall", 190)]), base: baseOf(listed([fn("src/g.js#tall", 200)]), { "src/g.js": long("tall", 200) }) });
v = adds({ "src/z.js": long("tall", 200) }, []);
ok(mended(said(v)) && /1 function passes/.test(said(v)) && /src\/z\.js#tall/.test(said(v)) && adds({ "src/t.js": long("tall", 140) }, [fn("src/t.js#tall", 140)]).fail.length === 0 && raised.fail.length === 0 && /1 function passes/.test(said(second)) && /src\/z\.js#tall/.test(said(second)),
  "one the change adds with its reason covers its own breach and no second in the place of a breach of the base's that the change mended; one of the base's that moved and shrank beside it is covered by the entry listed for it, as is one that moved beside an entry raised with its reason, whose breach of the base's backs no second entry", `${said(v)}\n${said(raised)}\n${said(second)}`);
// (a pull request that only improves passes told a base and told none: each breach finds an entry wherever a
// one-to-one match exists, whatever the order, and a baseline left as it is reads the same told a base, less the
// entries the base's check read no breach under: #751's eighth round)
{
  const n = (lines, depth) => ({ lines, depth }), crossing = new Map([["function: a1.mjs#main", n(5, 1)], ["function: a2.mjs#main", n(1, 6)], ["function: a3.mjs#main", n(5, 5)]]);
  const shrunk = [5, 1].map(lines => unclaimed(new Map([["function: b1.mjs#main", n(lines, 5)], ["function: b2.mjs#main", n(1, 6)]]), crossing));
  ok(shrunk.every(left => left.length === 0), "a breach that shrinks takes no entry another needs: both are covered as before (the design check's finding on #751)", JSON.stringify(shrunk));
  const two = listed([dn("src/a.js#tall", 100, 1), dn("src/x.js#tall", 65, 6)]), moved = { "src/a.js": nested("tall", 100, 1), "src/z.js": nested("tall", 62, 6) };
  const both = now => [judge({ now, baseline: two, base: baseOf(two, moved) }), judge({ now, baseline: two })];
  let runs = both({ "src/d.js": nested("tall", 63, 1), "src/z.js": nested("tall", 62, 6) });
  ok(runs.every(r => r.fail.length === 0), "a breach moved and shrunk, onto no other's id, passes told the base and told none though a smaller entry of another's would cover it too (the fallback reviewer's finding on #751's seventh round)", runs.map(said).join("\n"));
  runs = both({ "src/z.js": nested("tall", 90, 1), "src/y.js": nested("tall", 62, 6) });
  ok(runs.every(r => r.fail.length === 0), "nor does one moved to where a breach of the base's stood, itself moved on, its entry listed elsewhere, fail told the base", runs.map(said).join("\n"));
  const stands = listed([dn("src/c.js#tall", 90, 6), dn("src/f.js#tall", 150, 5)]), grown = { "src/c.js": nested("tall", 150, 5) };
  runs = [judge({ now: grown, baseline: stands, base: baseOf(stands, grown) }), judge({ now: grown, baseline: stands })];
  ok(runs.every(r => r.fail.length === 0), "nor does a change that changes no code, where a breach of the base's stands under another's entry that its own would not fit under: a baseline left as it is lists nothing the base did not", runs.map(said).join("\n"));
  const first = JSON.stringify({ reads: ["javascript", "javascript-tree"], listed: Object.fromEntries([fn("src/a.js#tall", 100)]) });
  v = judge({ now: { "src/0.py": py(100), "src/b.js": long("tall", 100) }, baseline: first });
  ok(v.fail.length === 0 && /1 breach that stood before is not listed yet/.test(noted(v)), "what a reader the baseline does not name finds claims an entry after every other: it is said, and the moved breach of a reader it names keeps its entry", `${said(v)}\n${noted(v)}`);
}
// (a pull request that passes leaves the check told no base passing, as the push to the branch runs it: #751's seventh round)
{
  const two = listed([dn("src/a.js#tall", 100, 1), dn("src/x.js#tall", 65, 6)]), first = { "src/a.js": nested("tall", 100, 1), "src/c.js": nested("tall", 62, 6) }, then = { "src/x.js": nested("tall", 90, 1), "src/c.js": nested("tall", 62, 6) };
  // (the last: a breach of a reader the baseline does not name, which the check told no base says and does not fail)
  const other = JSON.stringify({ reads: ["javascript", "javascript-tree"], listed: Object.fromEntries([dn("src/a.js#tall", 100, 1), dn("src/z.py#tall", 65, 6)]) }), flatter = { "src/c.js": nested("tall", 62, 1) };
  const steps = [[first, { "src/a.js": nested("tall", 100, 1), "src/x.js": nested("tall", 65, 6) }, two], [then, first, two], [then, first, listed([dn("src/c.js#tall", 62, 6), dn("src/x.js#tall", 90, 1)])], [{ ...flatter, "src/z.py": py(90) }, { ...flatter, "src/a.js": nested("tall", 100, 1) }, other, other]]
    .map(([now, was, baseline, before = two]) => [judge({ now, baseline, base: baseOf(before, was) }), judge({ now, baseline })]);
  v = steps[1][0];
  ok(steps.every(([told, untold]) => (told.fail.length === 0) === (untold.fail.length === 0)) && [0, 2, 3].every(n => steps[n][0].fail.length === 0) && v.fail.length === 1 && mended(said(v)) && /held already/.test(said(v)) && /listed under another id/.test(said(v)) && /SHAPE_BASE=origin\/main node core\/scripts\/shape\.mjs checks\/shape\.json --write/.test(said(v)) && /src\/c\.js#tall \(line 1\): 62 lines, 6 deep/.test(said(v)),
    "a breach left without an entry by one that moved to where its entry is listed fails told the base as it would told none, with --write as its mend, and what passes told the base passes told none: after two pull requests that only improve, the push's own check passes (the fallback reviewer's finding on #751's seventh round)", steps.map(([told, untold]) => `${said(told)}\n${said(untold)}`).join("\n"));
}
v = judge({ now: { "src/b.js": long("tall", 100) }, baseline: listed([f100]) });
ok(v.fail.length === 0 && /gone or moved/.test(noted(v)) && !/functions? pass/.test(said(v)), "a listed function that moved is no new breach: its old entry is said, for --write to list where it stands", noted(v));
ok(mended(`FAIL: ${(() => { try { judge({ now: {}, baseline: "{}" }); return ""; } catch (e) { return e.message; } })()}`), "a baseline that is none is refused, with its mend");
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
ok(v.fail.length === 0 && v.notes.some(n => /written before the check read files that hold JSX, C#, its functions by the lexer, C#, by the parser, Python, its functions by the lexer, Python, by the parser, scripts that share one global space, the tests that open a screen, a window or a device, the tests that reach a real clock, the tests that start another process, the comments that mark a change: 1 breach that stood before is not listed yet/.test(n) && /--write/.test(n)),
  "a baseline written before a reader came: what the base held of it is said, not failed", JSON.stringify(v));
v = judge({ now: { ...csBig, "src/B.cs": `namespace N;\nclass B {\n${csLong("New", 70)}}\n` }, baseline: listed([]), base: baseOf(listed([]), csBig) });
ok(mended(said(v)) && v.fail.length === 1 && /1 function passes/.test(said(v)) && /B\.cs#New/.test(said(v)) && !/A\.cs/.test(said(v)), "and what is new of it fails, from the sync on", said(v));
v = judge({ now: csBig, baseline: listed([]) });
ok(v.fail.length === 0 && v.notes.some(n => /1 breach that stood before/.test(n)), "with no base told, what it finds is said, never failed", said(v));
// (#862: a file a reader comes to take less of, as one past the smaller size it now takes, turns nothing red on the
// sync that brings it, nor on main's push, where no base is told; a new one still fails)
const lostLarge = { "src/Big.cs": `class Big { int[] W = { ${"1, ".repeat(LARGEST.csharp / 3)}1 }; void M() { } }\n`, "src/a.js": long("fine", 10) };
const lostThen = [{ base: baseOf(lostBaseline, lostLarge) }, {}].map(b => judge({ now: lostLarge, baseline: lostBaseline, ...b }));
v = judge({ now: { ...lostLarge, "src/New.cs": lostLarge["src/Big.cs"] }, baseline: lostBaseline, base: baseOf(lostBaseline, lostLarge) });
// (the fallback security review of #879: a file the base held lost, whether by its size or by a parse past its budget
// on that run, excuses nothing a change brings to it)
const grownLost = judge({ now: { ...lostLarge, "src/Big.cs": lostLarge["src/Big.cs"].replace("void M() { }", `void M() {\n${"  x++;\n".repeat(400)}}`) }, baseline: lostBaseline, base: baseOf(lostBaseline, lostLarge) });
ok(grownLost.fail.length === 1 && /held already/.test(said(grownLost)) && /src\/Big\.cs/.test(said(grownLost)) && mended(said(grownLost)), "a file lost that the base held, its text changed, fails as a breach the base held, with its mend", said(grownLost));
ok(lostThen.every(t => t.fail.length === 0 && t.notes.some(n => /1 file of code holds what the reader cannot follow/.test(n) && /src\/Big\.cs/.test(n) && /--write/.test(n))) && v.fail.length === 1 && /src\/New\.cs/.test(said(v)) && !/Big\.cs/.test(said(v)),
  "a file lost that the base held, or with no base told, is said, never failed, and one a pull request adds fails", JSON.stringify([...lostThen.map(t => t.notes), said(v)]));
v = judge({ now: { "src/v.js": `export const V = () => <p>{x}</p>;\n${long("tall", 70)}` }, baseline: JSON.stringify({ listed: { "function: src/v.js#V": { lines: 90, depth: 0, branches: 0 } } }), base: baseOf(listed([]), {}) });
ok(!v.fail.some(f => /gone or moved/.test(f[0])) && v.notes.some(n => /1 entry listed there reads otherwise now/.test(n)), "an entry listed of a file a new reader reads otherwise is said, not failed", said(v));
v = judge({ now: csBig, baseline: JSON.stringify({ ...allReads, listed: {} }), base: baseOf(listed([]), csBig) });
ok(mended(said(v)) && /held already is not in/.test(said(v)) && !v.notes.some(n => /written before/.test(n)), "once the baseline names the reader, what it does not list fails as any other", said(v));
v = judge({ now: { "src/a.tsx": "export const a = 1;\n", "src/b.tsx": lostJsx }, baseline: JSON.stringify({ ...allReads, listed: { "lost: src/a.tsx": true } }), base: baseOf(JSON.stringify({ ...allReads, listed: { "lost: src/a.tsx": true } }), { "src/a.tsx": lostJsx }) });
ok(mended(said(v)) && /src\/b\.tsx/.test(said(v)) && /cannot follow/.test(said(v)), "a file lost covers itself alone: another one lost in its place fails", said(v));
const refusedReads = reads => { try { parseBaseline(JSON.stringify({ reads, listed: {} }), "b.json", ""); return ""; } catch (e) { return `FAIL: ${e.message}`; } };
ok(mended(refusedReads("all")) && mended(refusedReads(["javascript", "cobol"])), "readers that are no list, or a name no reader has, are refused, with their mend");
v = judge({ now: csBig, baseline: JSON.stringify({ reads: ["javascript"], listed: {} }), base: baseOf(JSON.stringify({ ...allReads, listed: { "function: src/A.cs#Big": { lines: 70, depth: 0, branches: 0 } } }), csBig) });
ok(mended(said(v)) && /no longer names 11 readers that origin\/main's names: jsx, javascript-tree, csharp, csharp-tree, python, python-tree, scripts, screens, clocks, processes, changes/.test(said(v)), "a baseline that drops a reader its base named fails, so that what it lists cannot go unlisted while it stands", said(v));

// ---- whole runs, in a scratch repository ----
const dir = scratchDir("shape-test-");
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
put("core-manifest.md", "| *shape check* | `none` |\n"); r = run([]);
let noReason = /turns nothing off/.test(r.out) && /nothing was held/.test(r.out);
put("core-manifest.md", "| *shape check* | `none ` |\n"); r = run([]);
noReason &&= /turns nothing off/.test(r.out) && /nothing was held/.test(r.out); // (padded inside its backticks, no reason all the same)
git("branch", "before");
r = run([], { SHAPE_BASE: "before" });
ok(r.status === 0 && /nothing new in how the code is put together against before, by the starter kit's config/.test(r.out), "with a base, a project with no config is held to the starter kit's, the base as its baseline: what stood passes", r.out);
put("core-manifest.md", "| *shape check* | `none`: . |\n"); r = run([]);
noReason &&= /turns nothing off/.test(r.out); // (a reason with no letter or digit is none)
put("core-manifest.md", "| *shape check* | `none`: kept off |\n"); r = run([], { SHAPE_BASE: "before" });
const turning = r.status === 0 && /::warning::this pull request turns the shape check off .*kept off.*so it runs here/.test(r.out) && /nothing new in how the code is put together/.test(r.out);
commit("off"); git("branch", "off"); git("reset", "-q", "HEAD~1"); // (a base that is off, the commit taken back out of the branch's history)
r = run([], { SHAPE_BASE: "off" });
ok(noReason && turning && r.status === 0 && /^ok {3}the shape check is off: .*kept off/m.test(r.out) && !/nothing new/.test(r.out), "only a `none` with a reason that its base holds too turns the check off: one this pull request writes runs, saying so, and one with no reason turns nothing off, padded or not", r.out);
fs.rmSync(path.join(dir, "core-manifest.md"));
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
ok(r.status === 0 && same(Object.keys(baseline().listed), ["function: src/rules/index.js#tall"]) && same(baseline().listed["function: src/rules/index.js#tall"], { lines: 100, depth: 0, branches: 0 }) && r.out.includes(`note checks/shape-baseline.json names the project's files by path. Mend: ${scanMend("checks/shape-baseline.json")}`), "--first lists what stands, its numbers and no line, and says what a project's own scan of paths named does about the baseline (#1289)", r.out);
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
ok(r.status === 1 && mended(r.out) && /no longer names 11 readers/.test(r.out), "a baseline moved to a new path is compared with the one the base's config names: its readers too only grow", r.out);
fs.rmSync(path.join(dir, "checks/moved.json"));
git("checkout", "-q", "--", ".");
put("core-manifest.md", "| *shape check* | `core/scripts/shape.mjs` with `checks/other.json` |\n");
put("checks/other.json", fs.readFileSync(path.join(dir, "checks/shape.json"), "utf8").replace('"checks/shape-baseline.json"', '"checks/moved.json"'));
put("checks/moved.json", JSON.stringify({ reads: ["javascript"], listed: {} }));
r = run([], { SHAPE_BASE: "base" });
ok(r.status === 1 && mended(r.out) && /no longer names 11 readers/.test(r.out), "a config moved by the manifest is compared with the one the base's own manifest names, its baseline too", r.out);
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
// (a pull request that turns the check off keeps the config's path of the project's own in the row, which the config's
// other readers read, and runs on it: Codex's findings on #1188)
git("mv", "checks/shape.json", "checks/other.json");
put("core-manifest.md", "| *shape check* | `core/scripts/shape.mjs` with `checks/other.json` |\n");
commit("the config at a path of the project's own"); git("branch", "named");
put("core-manifest.md", "| *shape check* | `none`: kept off |\n");
r = run([], { SHAPE_BASE: "named" });
ok(r.status === 1 && mended(r.out) && /no longer names the config at checks\/other\.json/.test(r.out) && /config `checks\/other\.json`/.test(r.out),
  "a pull request that turns the check off and drops the config's path its base names fails, its mend keeping the path in the row", r.out);
put("core-manifest.md", "| *shape check* | `none`: kept off; config `checks/other.json` |\n");
r = run([], { SHAPE_BASE: "named" });
ok(r.status === 0 && /::warning::this pull request turns the shape check off/.test(r.out) && /nothing new in how the code is put together/.test(r.out) && where(fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8")) === "checks/other.json",
  "a pull request that turns the check off and keeps the config's path in the row runs on that config, which the other readers read too", r.out);
// (and so does one a pull request later, once the check is off, and a path the reason quotes is not taken for the config
// nor the path for part of the reason: round 5 of #1188's review)
commit("turned off, the path kept"); git("branch", "-f", "named");
put("core-manifest.md", "| *shape check* | `none`: kept off |\n");
r = run([], { SHAPE_BASE: "named" });
ok(r.status === 1 && mended(r.out) && /no longer names the config at checks\/other\.json/.test(r.out),
  "a pull request that drops the config's path where its base turned the check off fails all the same, with the mend", r.out);
put("core-manifest.md", "| *shape check* | `none`: kept off, as `old.json` said; config `checks/other.json` |\n");
r = run([], { SHAPE_BASE: "named" });
ok(r.status === 0 && /ok {3}the shape check is off: the manifest's \*shape check\* row says `none`: kept off, as `old\.json` said \(/.test(r.out) && where(fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8")) === "checks/other.json" && offBy("| *shape check* | `none`; config `checks/other.json` |") === "",
  "in a row that says `none`, the config is the path after \"config\", and the reason stops before it", r.out);
git("reset", "-q", "--hard", "base"); git("branch", "-D", "-q", "named");
// (a reason of any length is read in one pass: 400,000 spaces then a word, read far inside the time a reading that
// tries each start in turn would take; #1107)
{ const at = Date.now(), long = offBy(`| *shape check* | \`none\`: r${" ".repeat(400000)}a |`), path = offBy("| *shape check* | `none`: r;  config `x.json` |"), not = offBy("| *shape check* | `none`: r; myconfig `x.json` |");
  ok(long?.length === 400002 && path === "r" && not === "r; myconfig `x.json`" && Date.now() - at < 2000, "a reason of any length is read in one pass, and only a path after the word \"config\" is taken off it", `${Date.now() - at} ms`); }
{ const row = "| *shape check* | `none`: config `a.json` broke; config `b.json` |";
  ok(where(row) === "b.json" && offBy(row) === "config `a.json` broke", "the config is the path the reason ends with, the one taken off it, where the reason names another", `${where(row)} / ${offBy(row)}`); }

if (process.platform !== "win32") { // (a link is made without a privilege only off Windows)
  fs.renameSync(path.join(dir, "checks/shape-baseline.json"), path.join(dir, "elsewhere.json"));
  fs.symlinkSync("../elsewhere.json", path.join(dir, "checks/shape-baseline.json"));
  ok([[], ["--write"]].every(a => { const x = run(a); return x.status === 1 && mended(x.out) && /reached through a link/.test(x.out); }) && fs.readFileSync(path.join(dir, "elsewhere.json"), "utf8").includes("listed"),
    "a baseline that is a link is neither read nor written through", run([]).out);
  fs.rmSync(path.join(dir, "checks/shape-baseline.json"));
  fs.renameSync(path.join(dir, "elsewhere.json"), path.join(dir, "checks/shape-baseline.json"));
}

// (an entry an earlier pull request mended and left listed lists nothing in its place, --write told the base: #751's
// fifth round)
{
  const at = scratchDir("shape-test-");
  const there = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...args], { cwd: at, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(at, file)), { recursive: true }); fs.writeFileSync(path.join(at, file), text); };
  const check = (args, base) => { const x = spawnSync(process.execPath, [script, "checks/shape.json", ...args], { cwd: at, encoding: "utf8", env: { ...process.env, SHAPE_BASE: base } }); return { status: x.status, out: `${x.stdout}${x.stderr}` }; };
  const step = what => { there("add", "-A"); there("commit", "-q", "-m", what); };
  there("init", "-q", "-b", "main");
  write("checks/shape.json", config({}));
  write("src/a.js", long("tall", 100));
  write("src/x.js", long("tall", 300));
  check(["--first"], "");
  step("c0");
  there("mv", "src/a.js", "src/y.js");
  there("rm", "-q", "src/x.js");
  step("c1, its baseline left as it was");
  write("src/z.js", long("tall", 300));
  const before = check([], "HEAD");
  const wrote = check(["--write"], "HEAD"), after = check([], "HEAD");
  ok(before.status === 1 && mended(before.out) && wrote.status === 0 && after.status === 1 && mended(after.out) && /src\/z\.js#tall/.test(after.out) && !("function: src/z.js#tall" in JSON.parse(fs.readFileSync(path.join(at, "checks/shape-baseline.json"), "utf8")).listed),
    "a new breach no mended entry covers fails, and --write told the base lists it in no mended one's place", `${before.out}\n${wrote.out}\n${after.out}`);
  there("checkout", "-q", "--", "checks/shape-baseline.json");
  const blind = check(["--write"], ""), held = check([], "HEAD");
  ok(blind.status === 0 && held.status === 1 && mended(held.out) && /src\/z\.js#tall/.test(held.out) && /neither listed nor held/.test(held.out), "and where --write was not told the base, the check against it fails what it listed", held.out);
  there("checkout", "-q", "--", ".");
  fs.rmSync(path.join(at, "src/z.js"));
  write("src/y.js", long("tall", 300));
  write("checks/shape-baseline.json", JSON.stringify({ reads: ["javascript", "javascript-tree"], listed: Object.fromEntries([fn("src/y.js#tall", 300)]) }));
  step("c2, y.js listed as it stands");
  write("src/z.js", long("tall", 300));
  const beside = check(["--write"], "HEAD"), still = check([], "HEAD");
  ok(beside.status === 0 && still.status === 1 && /1 function passes/.test(still.out) && !/held already/.test(still.out) && !("function: src/z.js#tall" in JSON.parse(fs.readFileSync(path.join(at, "checks/shape-baseline.json"), "utf8")).listed),
    "--write told the base lists no new breach in the place of one the base holds that still stands", `${beside.out}\n${still.out}`);
  there("checkout", "-q", "--", ".");
  fs.rmSync(path.join(at, "src/z.js"));
  there("mv", "src/y.js", "src/s.js");
  write("src/s.js", nested("tall", 100, 1));
  write("checks/shape.json", loose);
  write("checks/shape-baseline.json", stale);
  step("c3, a function under a higher mark, two mended entries left listed");
  write("checks/shape.json", config({ marks: { lines: 60 } }));
  write("src/s.js", nested("tall", 65, 6));
  const deeper = check([], "HEAD"), lists = check(["--write"], "HEAD"), yet = check([], "HEAD");
  const unlisted = !("function: src/s.js#tall" in JSON.parse(fs.readFileSync(path.join(at, "checks/shape-baseline.json"), "utf8")).listed);
  there("checkout", "-q", "--", ".");
  there("rm", "-q", "src/s.js");
  write("checks/shape.json", config({}));
  for (const [file, text] of Object.entries(paired)) write(file, text);
  write("checks/shape-baseline.json", pairs);
  step("c4, a breach an earlier pull request moved and shrank, its entry left as it was");
  fs.rmSync(path.join(at, "src/y.js"));
  write("src/a.js", nested("tall", 80, 6));
  const twice = [1, 2].map(() => [check(["--write"], "HEAD").status, fs.readFileSync(path.join(at, "checks/shape-baseline.json"), "utf8"), check([], "HEAD")]);
  ok(deeper.status === 1 && lists.status === 0 && yet.status === 1 && [deeper, yet].every(x => mended(x.out) && /1 function passes/.test(x.out) && /src\/s\.js#tall/.test(x.out)) && unlisted
    && twice.every(([status, text, after]) => status === 0 && after.status === 0 && text === twice[0][1]) && JSON.parse(twice[0][1]).listed["function: src/a.js#tall"].lines === 80,
  "a breach the base held under a higher mark, nested deeper as the mark is lowered, fails as new, and --write told the base lists it in no mended entry's place; --write reads what a baseline covers as the check does, so one it wrote, of a breach in a moved one's place, it writes the same again", `${deeper.out}\n${lists.out}\n${yet.out}\n${twice.map(([, text, after]) => `${text}\n${after.out}`).join("\n")}`);
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
// (with the core's packages not installed, as in a project's job of tests that selects with the config and installs
// none, the config's shape goes unchecked: what the check reads is taken where it holds its form, its defaults else, the
// check says so as a warning, and a config that names no baseline or no code still fails with its mend)
{
  const bare = scratchDir("shape-bare-");
  fs.cpSync(path.join(path.dirname(script), "."), path.join(bare, "core/scripts"), { recursive: true });
  fs.cpSync(path.join(path.dirname(script), "../setup/template"), path.join(bare, "core/setup/template"), { recursive: true });
  const parse = text => spawnSync(process.execPath, ["--input-type=module", "-e", `import { parseConfig } from "./core/scripts/shape.mjs"; try { console.log(JSON.stringify(parseConfig(process.argv[1], "checks/shape.json"))); } catch (e) { console.log("FAIL: " + e.message); }`, text], { cwd: bare, encoding: "utf8" }).stdout;
  const odd = parse(JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"], marks: JSON.parse('{"lines":"x","depth":2,"constructor":5,"__proto__":7}'), suites: { q: {}, r: 30 }, tests: "test/", wiat: 3 })), none = parse(JSON.stringify({ baseline: "b.json" }));
  ok(/"marks":\{"lines":60,"depth":2,"branches":15\}/.test(odd) && /"suites":\{"r":30\}/.test(odd) && /"tests":\[\]/.test(odd) && mended(none) && /names no "baseline" and "code"/.test(none),
    "with the core's packages not installed, the config's shape goes unchecked: what holds its form is read, the rest (a key no mark has, a platform's empty seconds) takes its default, and a config with no code still fails with its mend", `${odd}\n${none}`);
  const wide = "\u{1F600}".repeat(70), marks = parse(JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"], changes: ["Ticket: ABC-", wide] }));
  ok(marks.includes("ABC-") && marks.includes(wide),
    "and a project's marks of a change are read there too, one of 70 characters outside the Basic Multilingual Plane among them", marks);
  fs.writeFileSync(path.join(bare, "shape.json"), config({}));
  for (const a of [["init", "-q"], ["add", "shape.json"]]) execFileSync("git", a, { cwd: bare });
  const said = spawnSync(process.execPath, ["core/scripts/shape.mjs", "shape.json", "--first"], { cwd: bare, encoding: "utf8", env: { ...process.env, SHAPE_BASE: "" } });
  ok(said.status === 0 && /^::warning::The config's shape was not checked: the package ajv is not installed.*\. Mend: /m.test(said.stdout), "and the check says so as a warning, with its mend, and goes on", `${said.stdout}${said.stderr}`);
  fs.rmSync(bare, { recursive: true, force: true });
}
console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
