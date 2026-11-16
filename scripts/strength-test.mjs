// Tests the strength check (strength.mjs, beside this file): the row that names the tool, the lines a pull request
// changes and how the tool is told them, a fault's id, a report read and refused, the counts, what the baseline claims
// and what may join it, and whole runs in a scratch repository with a tool of its own: reported only before the
// baseline, a survivor failed with its mend once it stands, one listed passing, a tool that cannot run, `none`, and
// the whole run writing the baseline, and a cleaning task's run lowering it. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/strength-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { baselineOf, changedLines, counted, faultsOf, heldBy, lowered, idOf, witnesses, joinedUnsaid, linesArg, opened, toolOf, unlisted, verdict } from "./strength.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SCRIPT = fileURLToPath(new URL("./strength.mjs", import.meta.url));

// ---- the row, the baseline's place, the lines ----
ok(same(toolOf("| *mutation tool* | `mutator run --mutate {lines}` |"), { command: ["mutator", "run", "--mutate", "{lines}"] }) && same(toolOf("| *mutation tool* | `none`: no tool reads GDScript |"), { none: "no tool reads GDScript" }) && toolOf("| *dose* | `in debt` |") === null && toolOf("| *mutation tool* | soon |") === null,
  "the row names the tool's command, or none with its reason; a project with no row, or a row with nothing in backticks, has none named");
ok(baselineOf({ baseline: "checks/shape-baseline.json" }) === "checks/strength-baseline.json" && baselineOf({ baseline: ".github/shape-baseline.json" }) === ".github/strength-baseline.json", "the baseline stands beside the shape check's");
ok(linesArg(new Map([["a.js", new Set([3, 1, 2, 7])], ["b.js", new Set([5])]])) === "a.js:1-3,a.js:7-7,b.js:5-5", "the lines are told as runs, <file>:<first>-<last>, joined by commas");

// ---- a fault's id, a report ----
const source = "const a = 1;\nif (x === 1)   return;\n";
const mutant = (line, column, endColumn, status, replacement = "!==") => ({ id: "1", mutatorName: "EqualityOperator", replacement, status, location: { start: { line, column }, end: { line, column: endColumn } } });
ok(idOf("a.js", source, mutant(2, 7, 10, "Survived")) === "survivor: a.js: if (x === 1) return; [=== -> !==]", "a fault's id holds its file, its line's text with the spaces folded, and what became what: no line number, so it stands where lines move");
const report = files => JSON.stringify({ schemaVersion: "1", files });
const read = faultsOf(report({ "a.js": { source, mutants: [mutant(2, 7, 10, "Survived"), mutant(2, 7, 10, "Killed", "=="), mutant(1, 1, 6, "NoCoverage", "")] } }), new Map([["a.js", new Set([2])]]));
ok(read.length === 2 && read.every(f => f.line === 2), "only the faults on the lines wanted are read", JSON.stringify(read));
ok(faultsOf(report({ [path.resolve("x", "b.js")]: { source, mutants: [mutant(1, 1, 2, "Killed")] } }), null, "x")[0].file === "b.js", "a file the report names by its full path is read as the project's own");
for (const [bad, what] of [["{", "not JSON"], [JSON.stringify({ schemaVersion: "1" }), "no files"], [report({ "a.js": { source, mutants: [{ status: "Killed" }] } }), "a fault with no place"]]) {
  let said = "";
  try { faultsOf(bad, null); } catch (e) { said = `FAIL: ${e.message}`; }
  ok(mended(said), `a report that is ${what} is refused, and the refusal says the mend`, said);
}

// ---- the counts, the claims ----
const f = (id, status) => ({ file: "a.js", line: 2, id, status, mutatorName: "EqualityOperator", original: "===", replacement: "!==" });
const c = counted([f("x", "Killed"), f("y", "Timeout"), f("z", "Survived"), f("w", "NoCoverage"), f("v", "Pending"), f("u", "CompileError")]);
ok(c.caught === 2 && c.survived === 2 && c.pending === 1 && c.line.includes("2 of 4") && c.line.includes("50%") && c.line.includes("1 not run"), "Killed and Timeout are caught, Survived and NoCoverage survived, Pending not run, the rest not counted", c.line);
const listed = new Map([["survivor: x", { count: 1 }]]);
ok(same(unlisted([f("survivor: x", "Survived")], listed), []) && unlisted([f("survivor: x", "Survived"), f("survivor: x", "NoCoverage")], listed).length === 1 && unlisted([f("survivor: y", "Survived"), f("survivor: x", "Killed")], listed).length === 1,
  "a survivor is claimed by its id, up to the count listed; one more, or one of another id, is not");
const b = (entries, grown = {}, whole = null) => ({ listed: new Map(Object.entries(entries)), grown, whole });
ok(same(joinedUnsaid(b({ p: { count: 1 }, q: { count: 2 } }), b({ p: { count: 1 }, q: { count: 1 } })), ["q"]) && same(joinedUnsaid(b({ q: { count: 2 } }, { q: "it changes nothing the program does" }), b({ q: { count: 1 } })), []),
  "an entry that joins the baseline, or grows, needs its reason under \"grown\"");
const runs = [b({ q: { count: 2 } }, {}, { day: "2026-12-01", commit: "b" }), b({}, {}, { day: "2026-11-01", commit: "a" })];
const found = "survivor: a.js: x(); [! -> ]", madeUp = "survivor: a.js: nowhere(); [! -> ]", wholeRun = [b({ [found]: { count: 1 }, [madeUp]: { count: 1 } }, {}, { day: "2026-12-01", commit: "b" }), b({}, {}, { day: "2026-11-01", commit: "a" })];
ok(same(joinedUnsaid(...wholeRun, false, new Map(), new Map(), () => "x();\n"), [madeUp]), "a whole run's pull request that lists an entry for a line that stands nowhere in its file fails: no run found it");
ok(same(joinedUnsaid(runs[0], runs[1], false, new Map(), new Map(), () => null), ["q"]) && same(joinedUnsaid(b({ "survivor: q.js: q(); [! -> ]": { count: 2 } }, {}, { day: "2026-12-01", commit: "b" }), runs[1], false, new Map(), new Map(), () => "q();\n"), []) && same(joinedUnsaid(...runs, true), ["q"]) && same(joinedUnsaid(b({ q: { count: 1 } }), null), []),
  "with no reason, only in the pull request that records a new whole run and changes no code or test, or writes the first baseline: one that changes code cannot take in its own survivors so");
const old = "survivor: a.js: if (x === 1) return; [=== -> !==]", gone = opened(new Map([[old, { count: 1 }], ["survivor: b.js: kept(); [! -> ]", { count: 1 }]]), new Set(["a.js"]));
const renamed = { ...f("survivor: a.js: if (y === 1) return; [=== -> !==]", "Survived") }, other = { ...f("survivor: a.js: if (y === 1) return; [=== -> ==]", "Survived") };
const repeated = "survivor: a.js: return true; [true -> false]", file = "function f() {\n  return true;\n}\nfunction g() {\n  return true;\n}\n";
const entry = new Map([[repeated, { count: 1 }]]), watched = witnesses(entry, () => file, new Map([["a.js", new Set([4, 5, 6])]]));
const survives = heldBy(entry, [f(repeated, "Survived")]), caught = heldBy(entry, [f(repeated, "Killed")]), unrun = heldBy(entry, [f(repeated, "Pending")]);
ok(same([...watched.get("a.js")], [2]) && survives.get(repeated) === 1 && unlisted([f(repeated, "Survived")], entry, new Map(), survives).length === 1 && !caught.has(repeated) && unrun.get(repeated) === 1 && unlisted([f(repeated, "Survived")], entry, new Map(), caught).length === 0 && witnesses(entry, () => file, new Map([["b.js", new Set([1])]])).size === 0,
  "an unchanged line that repeats a listed one is run too: where its fault still survives, a changed repeat cannot use the entry; where a test catches it there, the entry is the changed line's; where it was not run, it holds the entry");
const was = "survivor: a.js: export const flag = () => true; [true -> false]", now2 = "survivor: a.js: export const flag = () => { return true; }; [true -> false]";
const low = lowered(new Map([[was, { count: 1 }], ["survivor: b.js: x [! -> ]", { count: 2 }]]), new Map([[now2, 1]]), ["a.js"]);
const twice = "survivor: a.js: return true; [true -> false]", rewritten = "survivor: a.js: return (true); [true -> false]";
ok(same([...low].sort(), [[now2, 1], ["survivor: b.js: x [! -> ]", 2]].sort()) && same([...lowered(new Map([[was, { count: 1 }]]), new Map(), ["a.js"])], []) && same([...lowered(new Map([[twice, { count: 2 }]]), new Map([[twice, 1], [rewritten, 1]]), ["a.js"])].sort(), [[rewritten, 1], [twice, 1]].sort()),
  "a cleaning run keeps the debt of a line it rewrote, one copy of a repeated line too, under the fault's new id, and drops it only where the fault no longer survives; an entry of another file stays");
const origins = new Map();
lowered(new Map([[was, { count: 1 }]]), new Map([[now2, 1]]), ["a.js"], origins);
const afterLower = b({ [now2]: { count: 1 } }), beforeLower = b({ [was]: { count: 1 } }), baseGone = opened(beforeLower.listed, new Set(["a.js"]));
ok(origins.get(now2) === was && same(joinedUnsaid(afterLower, beforeLower, true, baseGone), []) && same(joinedUnsaid(b({ [now2]: { count: 2 } }), beforeLower, true, baseGone), [now2]),
  "the pull request of a cleaning run that carried a rewritten line's debt to its new id passes; one that adds to it does not");
const swapped = "survivor: a.js: return 2 > 1; [> -> >=]", kept = "survivor: a.js: return x > 1; [> -> >=]", baseKept = b({ [kept]: { count: 1 } });
ok(same(joinedUnsaid(b({ [swapped]: { count: 1 } }), baseKept, true, opened(baseKept.listed, new Set(["a.js"])), new Map([[kept, 1]])), [swapped]) && same(joinedUnsaid(b({ [swapped]: { count: 1 } }), baseKept, true, opened(baseKept.listed, new Set(["a.js"])), new Map()), []),
  "a pull request that drops an entry whose fault still survives on its unchanged line, and lists a new survivor in its place, fails; where the run finds that fault caught, the swap passes");
const two = new Map([[twice, { count: 2 }]]), rewrittenOne = { ...f(rewritten, "Survived") };
ok(same([...gone.keys()], [old]) && same(unlisted([renamed], new Map([[old, { count: 1 }]]), gone), []) && unlisted([renamed, renamed], new Map([[old, { count: 1 }]]), gone).length === 1 && unlisted([other], new Map([[old, { count: 1 }]]), gone).length === 1
  && same(unlisted([rewrittenOne], two, opened(two, new Set(["a.js"])), new Map([[twice, 1]])), []) && unlisted([rewrittenOne], two, opened(two, new Set(["a.js"])), new Map([[twice, 2]])).length === 1,
  "a listed fault whose line a change rewrote is claimed by the same fault on the new line, once, also where another copy of the line stands and holds the rest; another fault there is the change's own");

// ---- the verdict ----
const before = verdict({ faults: [f("survivor: z", "Survived"), f("k", "Killed")], baseline: null, was: null, at: "checks/strength-baseline.json", deleted: ["test/a.test.js"] });
ok(!before.fails && before.lines.some(l => l.startsWith("survived: a.js:2")) && before.lines.some(l => l.includes("Reported only")) && before.lines.some(l => l.includes("test/a.test.js")) && !before.lines.some(l => l.startsWith("FAIL")),
  "before the baseline stands, a survivor is shown and fails nothing; a deleted test file is named", before.lines.join("\n"));
const after = verdict({ faults: [f("survivor: z", "Survived"), f("survivor: x", "Survived")], baseline: b({ "survivor: x": { count: 1 } }), was: b({ "survivor: x": { count: 1 } }), at: "checks/strength-baseline.json", deleted: [] });
ok(after.fails && after.lines.filter(l => l.startsWith("FAIL")).length === 1 && mended(after.lines.join("\n")) && after.lines.join("\n").includes('"survivor: z"'), "once it stands, a survivor it does not list fails, naming its id, with its mend; one listed passes", after.lines.join("\n"));
const short = verdict({ faults: [f("k", "Killed"), f("p", "Pending")], baseline: b({}), was: b({}), at: "s.json", deleted: [] });
ok(!short.fails && short.lines.some(l => l.startsWith("1 faults on the changed lines were not run")), "once it stands, faults past the tool's budget are said to be held nowhere", short.lines.join("\n"));
const taken = verdict({ faults: [], baseline: null, was: b({ "survivor: x": { count: 1 } }), at: "s.json", deleted: [] });
ok(taken.fails && mended(taken.lines.join("\n")), "a pull request that takes out the baseline the base held fails, with its mend", taken.lines.join("\n"));
const grew = verdict({ faults: [], baseline: b({ "survivor: x": { count: 2 } }), was: b({ "survivor: x": { count: 1 } }), at: "s.json", deleted: [] });
ok(grew.fails && mended(grew.lines.join("\n")), "an entry that joined with no reason fails, with its mend", grew.lines.join("\n"));

// ---- whole runs, in a scratch repository ----
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strength-test-"));
const sh = (...args) => execFileSync("git", ["-c", "core.fsmonitor=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const write = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
const run = (args = [], env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_STEP_SUMMARY: "", ...env } });
const MANIFEST = tool => `# Core manifest\n\n## Slots\n| Slot | Here |\n| --- | --- |\n| *mutation tool* | ${tool} |\n`;
try {
  sh("init", "-q", "-b", "main"); sh("config", "user.email", "t@example.invalid"); sh("config", "user.name", "Test");
  write("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"], tests: ["test"] }));
  write("src/a.js", "export const a = x => x === 1;\n");
  write("test/a.test.js", "import { a } from '../src/a.js';\n");
  // (the scratch tool: a report of one fault that survives on each line it is told, in the schema's form)
  write("tool.mjs", "import fs from 'node:fs';\nconst [lines, out] = process.argv.slice(2);\nconst files = {};\nfor (const part of lines.split(',')) { const [file, r] = part.split(':'); const first = Number((r ?? '1-1').split('-')[0]); files[file] ??= { source: fs.readFileSync(file, 'utf8'), mutants: [] }; files[file].mutants.push({ id: String(first), mutatorName: 'EqualityOperator', replacement: '!==', status: process.env.STATUS || 'Survived', location: { start: { line: first, column: 26 }, end: { line: first, column: 29 } } }); }\nfs.writeFileSync(out, JSON.stringify({ schemaVersion: '1', files }));\n");
  write("core-manifest.md", MANIFEST("`node tool.mjs {lines} {report}`"));
  sh("add", "-A"); sh("commit", "-q", "-m", "base");
  sh("checkout", "-q", "-b", "change");
  write("src/a.js", "export const a = x => x === 1;\nexport const b = y => y === 2;\n");
  sh("commit", "-qam", "a change");
  let r = run([], { STRENGTH_BASE: "main" });
  ok(r.status === 0 && r.stdout.includes("survived: src/a.js:2") && r.stdout.includes("Reported only") && !r.stdout.includes("src/a.js:1:"), "a pull request's run, with no baseline: the tool is told the changed line alone, its survivor shown, nothing failed", r.stdout + r.stderr);
  // (a baseline that is a link, here to a file outside the project, is neither read nor written; links need a right
  // of their own on Windows, so this case runs elsewhere)
  if (process.platform !== "win32") {
    const outside = path.join(os.tmpdir(), `strength-outside-${process.pid}.json`);
    fs.writeFileSync(outside, "{\"listed\": {}}\n");
    fs.symlinkSync(outside, path.join(dir, "checks/strength-baseline.json"));
    const linked = run(["--whole"]);
    ok(linked.status === 1 && mended(linked.stderr) && fs.readFileSync(outside, "utf8") === "{\"listed\": {}}\n", "a baseline reached through a link is refused, with its mend, and what it leads to is left as it was", linked.stdout + linked.stderr);
    fs.rmSync(path.join(dir, "checks/strength-baseline.json")); fs.rmSync(outside);
  }
  r = run(["--whole"], { STATUS: "Pending" });
  ok(r.status === 1 && mended(r.stderr) && !fs.existsSync(path.join(dir, "checks/strength-baseline.json")), "a whole run that left faults not run writes no baseline, and says the mend", r.stdout + r.stderr);
  r = run(["--whole"]);
  const written = JSON.parse(fs.readFileSync(path.join(dir, "checks/strength-baseline.json"), "utf8"));
  ok(r.status === 0 && Object.keys(written.listed).length === 1 && written.whole?.commit && /^\d{4}-\d\d-\d\d$/.test(written.whole.day), "the whole run writes the baseline, with the day and commit it ran on", r.stdout + r.stderr);
  sh("add", "-A"); sh("commit", "-qm", "the whole run"); sh("checkout", "-q", "main"); sh("merge", "-q", "--ff-only", "change"); sh("checkout", "-q", "-b", "next");
  write("src/a.js", "export const a = x => x === 1;\nexport const b = y => y === 2;\nexport const c = z => z === 3;\n");
  sh("commit", "-qam", "another");
  r = run([], { STRENGTH_BASE: "main" });
  ok(r.status === 1 && mended(r.stdout + r.stderr) && r.stderr.includes("src/a.js:3"), "once the baseline stands, a survivor on a changed line it does not list fails, with its mend", r.stdout + r.stderr);
  // (as a whole run on the branch would write it: a new stamp, and the survivor of the line the change adds)
  const listedNow = JSON.parse(fs.readFileSync(path.join(dir, "checks/strength-baseline.json"), "utf8"));
  write("checks/strength-baseline.json", `${JSON.stringify({ ...listedNow, whole: { day: "2026-12-01", commit: "elsewhere" }, listed: { ...listedNow.listed, "survivor: src/a.js: export const c = z => z === 3; [== -> !==]": { count: 1 } } }, null, 2)}\n`);
  r = run([], { STRENGTH_BASE: "main" });
  ok(r.status === 1 && mended(r.stderr) && r.stderr.includes("where the base did not"), "a pull request that changes code cannot take its own survivors in by a whole run of its own", r.stdout + r.stderr);
  sh("checkout", "--", "checks/strength-baseline.json");
  write("src/a.js", "export const a = y => y === 1;\nexport const b = y => y === 2;\n");
  write("src/Game.cs", "class Game { bool Over(int x) { return x == 1; } }\n");
  sh("add", "-A");
  r = run([], { STRENGTH_BASE: "main" });
  ok(r.status === 1 && !r.stderr.includes("src/a.js:1") && r.stderr.includes("src/Game.cs:1"), "a listed fault whose line the change rewrote passes; a file in another language the tool reports is held too", r.stdout + r.stderr);
  sh("reset", "-q", "--hard"); sh("clean", "-qfd", "--", "src");
  // (a starter kit's config reads the whole project as code: an audit's pull request that changes only the config,
  // the baseline and its report still changes no code or test)
  sh("checkout", "-q", "main"); sh("checkout", "-q", "-b", "kit");
  write("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: [".", ":!core/"], tests: ["test"] }));
  sh("commit", "-qam", "the kit's config"); sh("checkout", "-q", "-b", "audit");
  write("docs/audits/2026-12-01.md", "the audit's report\n");
  r = run(["--whole"]);
  const audit = run([], { STRENGTH_BASE: "kit" });
  ok(r.status === 0 && audit.status === 0 && !audit.stderr.includes("FAIL"), "where the config reads the whole project, the audit's pull request (its baseline and report alone) takes in what its whole run found", r.stdout + r.stderr + audit.stdout + audit.stderr);
  write("data/levels.json", "{}\n");
  sh("add", "data/levels.json");
  const data = run([], { STRENGTH_BASE: "kit" });
  ok(data.status === 1 && data.stderr.includes("where the base did not"), "and one that also changes a file the code reads, data too, does not", data.stdout + data.stderr);
  sh("checkout", "-q", "-f", "next"); for (const f of ["docs", "data"]) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  r = run(["--lower", "src/a.js"], { STATUS: "Pending" });
  ok(r.status === 1 && mended(r.stderr) && JSON.parse(fs.readFileSync(path.join(dir, "checks/strength-baseline.json"), "utf8")).listed && Object.keys(JSON.parse(fs.readFileSync(path.join(dir, "checks/strength-baseline.json"), "utf8")).listed).length === 1, "a cleaning task's run that left faults not run lowers nothing, and says the mend", r.stdout + r.stderr);
  r = run(["--lower", "src/a.js"], { STATUS: "Killed" });
  const lowered = JSON.parse(fs.readFileSync(path.join(dir, "checks/strength-baseline.json"), "utf8"));
  const refused = run(["--lower", "test/a.test.js"]);
  ok(r.status === 0 && Object.keys(lowered.listed).length === 0 && lowered.whole?.commit === written.whole.commit && refused.status === 1 && mended(refused.stderr), "a cleaning task's run lowers the file's entries to what survives, keeping the whole run's record; a file outside the code is refused", r.stdout + r.stderr + refused.stderr);
  sh("checkout", "--", "checks/strength-baseline.json");
  write("core-manifest.md", MANIFEST("`node missing-tool.mjs {lines} {report}`"));
  r = run([], { STRENGTH_BASE: "main" });
  ok(r.status === 1 && mended(r.stdout + r.stderr), "once it stands, a tool that cannot run fails, saying the mend", r.stdout + r.stderr);
  write("core-manifest.md", MANIFEST("`none`: no tool reads our language"));
  r = run([], { STRENGTH_BASE: "main" });
  ok(r.status === 0 && r.stdout.includes("left out") && r.stdout.includes("no tool reads our language"), "a row that says none leaves the measure out, saying why", r.stdout + r.stderr);
  write("core-manifest.md", "# Core manifest\n");
  r = run([], { STRENGTH_BASE: "main" });
  ok(r.status === 0 && r.stdout.includes("no row"), "a project with no row is told the step, and nothing fails", r.stdout + r.stderr);
  write("core-manifest.md", MANIFEST("`node tool.mjs {lines} {report}`"));
  // (a file whose name holds a space: git ends its header with a tab, which is no part of the name)
  write("src/a b.js", "export const s = 1;\n"); sh("add", "src/a b.js");
  const here = process.cwd(); process.chdir(dir);
  let spaced;
  try { spaced = changedLines("HEAD", ["src/a b.js"]); } finally { process.chdir(here); }
  ok(spaced.has("src/a b.js") && !spaced.has("src/a b.js\t"), "a changed file whose name holds a space is read by its name", JSON.stringify([...spaced.keys()]));
  sh("rm", "-q", "-f", "--cached", "src/a b.js"); fs.rmSync(path.join(dir, "src/a b.js"));
  r = run([], { STRENGTH_BASE: "no-such-branch" });
  ok(r.status === 1 && mended(r.stderr), "a base that is no commit here is refused, with its mend", r.stderr);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
