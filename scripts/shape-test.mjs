// Tests the shape check (shape.mjs, beside this file): the config it refuses, each kind of breach it finds on a few
// files made for it, what covers an entry and what does not, and whole runs in a scratch repository: the first
// baseline, a new breach of each kind failing with its mend, a baseline that only shrinks against the base, an entry
// that joins because the check reads more, one given its reason, a raised mark, and a suite held to its time. Each
// failure is read for its mend (mend.mjs). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/shape-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { groupOf, MARKS, parseBaseline, parseConfig, survey, unclaimed, verdict, where } from "./shape.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const script = fileURLToPath(new URL("./shape.mjs", import.meta.url));
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
};
for (const [what, text] of Object.entries(BAD)) ok(mended(refused(text)), `a config is refused, with its mend: ${what}`, refused(text));
const full = parseConfig(config({ ...two({ domain: "rules", entrance: "src/rules/index.js" }, { domain: "display", uses: ["rules"], wraps: ["pixi.js"] }), tests: ["src/**/*.test.js"], aliases: { "@/": "src/" }, platform: ["electron"], marks: { lines: 40 }, suites: { unit: 60, all: { linux: 90, win32: 300 } } }));
ok(same(full.marks, { ...MARKS, lines: 40 }) && full.wrapped.get("pixi.js") === "view" && full.tests.length === 1 && full.suites.all.win32 === 300, "a whole config is read, a mark left out being the core's own");
ok(where("| *shape check* | `core/scripts/shape.mjs` with `checks/own/shape.json` |") === "checks/own/shape.json" && where("| *copies check* | `checks/copies.json` |") === "checks/shape.json" && where(null) === "checks/shape.json",
  "the config is where the manifest's row names it, else where the starter kit writes it");

// ---- each kind of breach ----
const cfg = extra => parseConfig(config(extra));
const long = (name, lines) => `export function ${name}(a) {\n${"  a++;\n".repeat(lines - 2)}}\n`;
const branchy = `export function many(a, b) {\n  return ${Array.from({ length: 17 }, (_, i) => `a === ${i}`).join(" || ")};\n}\n`;
const deep = "export function nest(a) {\n  if (a) { for (;;) { while (a) { if (a) { try { a(); } catch { a = 0; } } } } }\n}\n";
let found = survey({ "src/a.js": long("tall", 61) + long("fine", 60) + branchy + deep, "src/a.test.js": long("inATest", 200), "src/b.jsx": long("inJsx", 200) }, cfg({ tests: ["src/a.test.js"] }), new Set(["src/a.test.js"]));
ok(same(ids(found), ["function: src/a.js#many", "function: src/a.js#nest", "function: src/a.js#tall"]) && found.entries.get("function: src/a.js#tall").n.lines === 61 && found.entries.get("function: src/a.js#many").n.branches === 16 && found.entries.get("function: src/a.js#nest").n.depth === 5 && found.read.jsx === 1 && found.read.functions === 4,
  "a function past a mark is found: its lines, its depth, its branch points; one at the mark, a test's and one in a file with JSX are not", ids(found));
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
ok(same(["function: a/b.js#f#2", "inside: (no system) -> rules: a.js -> b.js", "platform: a.js -> node:fs", "clock: a.js: new Date()", "package: a.js -> @x/y"].map(id => groupOf(id).group), ["f", "(no system) -> rules", "node:fs", "new Date()", "@x/y"]), "an entry's group is read from its id");

// ---- the verdict, against a base ----
const listed = entries => JSON.stringify({ listed: Object.fromEntries(entries) });
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
v = judge({ now: { "src/a.js": long("tall", 100) + long("other", 70) }, baseline: JSON.stringify({ grown: { "function: src/a.js#other": "it mirrors the table of the standard, which a split would hide" }, listed: { [f100[0]]: f100[1], "function: src/a.js#other": { lines: 70, depth: 0, branches: 0 } } }), base: baseOf(listed([f100]), { "src/a.js": long("tall", 100) + long("other", 60) }) });
ok(v.fail.length === 0, "and passes where the baseline gives its reason under \"grown\"", said(v));
v = judge({ now: { "src/a.js": long("tall", 100) }, baseline: listed([f100]), base: baseOf(null, { "src/a.js": long("tall", 100) }, null) });
ok(v.fail.length === 0, "a first baseline lists what the base already held: the check has come, and nothing got worse", said(v));
v = judge({ now: { "src/a.js": long("tall", 100) + long("mid", 50) }, conf: cfg({ marks: { lines: 40 } }), baseline: listed([f100, ["function: src/a.js#mid", { lines: 50, depth: 0, branches: 0 }]]), base: baseOf(listed([f100]), { "src/a.js": long("tall", 100) + long("mid", 50) }) });
ok(v.fail.length === 0, "an entry joins where the check reads more (a mark lowered) and the base held it already", said(v));
v = judge({ now: {}, conf: cfg({ marks: { lines: 80 }, suites: { unit: 90, win: { linux: 10, win32: 50 }, loose: { linux: 5 } } }), baseline: listed([]), base: baseOf(listed([]), {}, config({ suites: { unit: 60, win: { linux: 10, win32: 40 }, gone: 5, loose: 9 } })) });
ok(mended(said(v)) && same(v.fail[0].slice(1), ["  mark: lines", "  mark: suite unit", "  mark: suite win", "  mark: suite gone", "  mark: suite loose"]), "a mark raised, a suite's raised on one platform, and one dropped or left unmarked on a platform, fail against the base", said(v));
v = judge({ now: {}, conf: cfg({ marks: { lines: 80 } }), baseline: JSON.stringify({ grown: { "mark: lines": "the generated tables run to 75 lines each" }, listed: {} }), base: baseOf(listed([]), {}, config({})) });
ok(v.fail.length === 0, "and pass where \"grown\" gives the raise its reason");
const named = cfg({ systems: { rules: { paths: ["src/rules/"] } } });
v = judge({ now: { "src/rules/a.js": "export const a = 1;\n", "src/old.js": "export const o = 1;\n", "src/new.js": "export const n = 1;\n" }, conf: named, baseline: listed([]), base: baseOf(listed([]), { "src/old.js": "export const o = 1;\n" }) });
ok(mended(said(v)) && v.fail.length === 1 && /1 new file of code lies in no system/.test(said(v)) && v.fail[0].slice(1).join() === "  src/new.js", "once a system is named, a file of code the pull request adds that lies in none fails; one the base held does not", said(v));
v = judge({ now: { "src/new.js": "export const n = 1;\n" }, baseline: listed([]), base: baseOf(listed([]), {}) });
ok(v.fail.length === 0, "where no system is named yet, none does");
v = judge({ now: { "src/rules/a.js": "import '../view/b.js';\n", "src/view/b.js": "export const b = 1;\n" }, conf: cfg(two({ uses: ["view"] }, {})), baseline: listed([]), base: baseOf(listed([]), { "src/view/b.js": "export const b = 1;\n" }, config(two({}, {}))) });
ok(v.fail.length === 0, "a use declared in the config with its first import passes: declaring is how a dependency is allowed, and the reviews read the config's change", said(v));
ok(parseBaseline(JSON.stringify({ audited: { day: "2026-11-15", listed: 3, read: 90 }, listed: {} }), "b.json", "").audited.listed === 3, "a baseline keeps the day and the counts of its last audit");

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
ok(r.status === 1 && mended(r.out) && /past its mark of 0\.001/.test(r.out), "a suite past its mark, on this platform, fails with its mend", r.out);
r = run(["checks/shape.json", "--suite", "quick", "--", process.execPath, "-e", "process.exit(7)"]);
ok(r.status === 7 && !/FAIL/.test(r.out), "a suite that fails keeps its own status, and the check adds nothing", r.out);
r = run(["checks/shape.json", "--suite", "quick", "--since", String(Math.floor(Date.now() / 1000) - 100)]);
ok(r.status === 1 && mended(r.out) && /took 10\d s/.test(r.out), "a time taken since a start the workflow gave is held to the mark too", r.out);
ok([["--suite", "unnamed", "--", "x"], ["--suite", "quick"], ["--suite", "quick", "--since", "soon"], ["--suite", "quick", "--", "no-such-command-here"]].every(a => { const x = run(["checks/shape.json", ...a]); return x.status === 1 && mended(x.out); }),
  "a suite with no mark, no command, no start or a command that cannot be started is refused, with its mend");

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
