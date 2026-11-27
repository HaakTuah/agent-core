// Tests the strength check's verdict (scripts/strength-verdict.mjs, which scripts/strength.mjs judges a run with):
// what the baseline claims and what may join it, a cleaning run's lowering, the tool's second run, and the verdict on a
// run. On values built here, no process started; the report it reads is tests/strength-report-test.mjs, the check run in a
// scratch repository tests/strength-test.mjs. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/strength-verdict-test.mjs
import { mended } from "../scripts/mend.mjs";
import { projectOf } from "../scripts/scratch-core.mjs";
import { faultsOf } from "../scripts/strength-report.mjs";
import { again, joinedUnsaid, kindOf, lowered, needed, undercut, unlisted, unsure, verdict, watched } from "../scripts/strength-verdict.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- the claims, the verdict's reading of a run ----
const mutant = (line, column, endColumn, status, replacement = "!==") => ({ id: "1", mutatorName: "EqualityOperator", replacement, status, location: { start: { line, column }, end: { line, column: endColumn } } });
const f = (id, status) => ({ file: "a.js", line: 2, id, status, mutatorName: "EqualityOperator", original: "===", replacement: "!==" });
const listed = new Map([["survivor: x", { count: 1 }]]);
ok(same(unlisted([f("survivor: x", "Survived")], listed), []) && unlisted([f("survivor: x", "Survived"), f("survivor: x", "NoCoverage")], listed).length === 1 && unlisted([f("survivor: y", "Survived"), f("survivor: x", "Killed")], listed).length === 1,
  "a survivor is claimed by its id, up to the count listed; one more, or one of another id, is not");
const b = (entries, grown = {}, whole = null) => ({ listed: new Map(Object.entries(entries)), grown, whole });
ok(same(joinedUnsaid(b({ p: { count: 1 }, q: { count: 2 } }), b({ p: { count: 1 }, q: { count: 1 } })), ["q"]) && same(joinedUnsaid(b({ q: { count: 2 } }, { q: "it changes nothing the program does" }), b({ q: { count: 1 } })), []),
  "an entry that joins the baseline, or grows, needs its reason under \"grown\"");
const runs = [b({ q: { count: 2 } }, {}, { day: "2026-12-01", commit: "b" }), b({}, {}, { day: "2026-11-01", commit: "a" })];
const found = "survivor: a.js: x(); [! -> ]", madeUp = "survivor: a.js: nowhere(); [! -> ]", wholeRun = [b({ [found]: { count: 1 }, [madeUp]: { count: 1 } }, {}, { day: "2026-12-01", commit: "b" }), b({}, {}, { day: "2026-11-01", commit: "a" })];
const tooMany = [b({ [found]: { count: 5 } }, {}, { day: "2026-12-01", commit: "b" }), b({}, {}, { day: "2026-11-01", commit: "a" })];
ok(same(joinedUnsaid(...wholeRun, false, () => "x();\n"), [madeUp]) && same(joinedUnsaid(...tooMany, false, () => "x();\nx();\n"), [found]) && same(joinedUnsaid(...tooMany, false, () => "x();\n".repeat(5)), []),
  "a whole run's pull request that lists an entry for a line that stands nowhere in its file, or more of it than the file can hold, fails: no run found it");
ok(same(joinedUnsaid(runs[0], runs[1], false, () => null), ["q"]) && same(joinedUnsaid(b({ "survivor: q.js: q(); [! -> ]": { count: 1 } }, {}, { day: "2026-12-01", commit: "b" }), runs[1], false, () => "q();\n"), []) && same(joinedUnsaid(...runs, true), ["q"]) && same(joinedUnsaid(b({ q: { count: 1 } }), null), []),
  "with no reason, only in the pull request that records a new whole run and changes no code or test, or writes the first baseline: one that changes code cannot take in its own survivors so");
ok(kindOf("survivor: a.js: const a = [1, 2]; [[1, 2] -> []]") === kindOf("survivor: a.js: let b = [1, 2]; [[1, 2] -> []]") && kindOf("survivor: a.js: const a = [1, 2]; [[1, 2] -> []]") !== kindOf("survivor: a.js: const a = [3]; [[3] -> []]") && kindOf("survivor: a.js: if (x === 1) return; [=== -> !==]") !== kindOf("survivor: b.js: if (x === 1) return; [=== -> !==]"),
  "a fault's kind is its file and what became what, read right where its line's text holds brackets of its own");
// (one listed, rewritten; another fault on the new line; one line of two copies rewritten, the other holding the rest)
const old = "survivor: a.js: if (x === 1) return; [=== -> !==]", one = new Map([[old, { count: 1 }]]);
const renamed = { ...f("survivor: a.js: if (y === 1) return; [=== -> !==]", "Survived") }, other = { ...f("survivor: a.js: if (y === 1) return; [=== -> ==]", "Survived") };
const twice = "survivor: a.js: return true; [true -> false]", rewritten = "survivor: a.js: return (true); [true -> false]";
const two = new Map([[twice, { count: 2 }]]), rewrittenOne = { ...f(rewritten, "Survived") };
ok(same(unlisted([renamed], one), []) && unlisted([renamed, renamed], one).length === 1 && unlisted([other], one).length === 1 && same(unlisted([renamed], one, [f(old, "Killed")]), []) && unlisted([renamed], one, [f(old, "Survived")]).length === 1
  && same(unlisted([rewrittenOne], two, [f(twice, "Survived")]), []) && unlisted([rewrittenOne], two, [f(twice, "Survived"), f(twice, "Survived")]).length === 1,
  "a listed fault whose line a change rewrote is claimed by the same fault on the new line, once, also where another copy of the line stands and holds the rest; another fault there is the change's own");
const repeated = "survivor: a.js: return true; [true -> false]", file = "function f() {\n  return true;\n}\nfunction g() {\n  return true;\n}\nconst h = () => true || false;\n";
const entry = new Map([[repeated, { count: 1 }]]), seen = watched([repeated], () => file, new Map([["a.js", new Set([4, 5, 6])]]));
ok(same([...seen.get("a.js")], [2, 7]) && unlisted([f(repeated, "Survived")], entry, [f(repeated, "Survived")]).length === 1 && unlisted([f(repeated, "Survived")], entry, [f(repeated, "Killed")]).length === 0 && unlisted([f(repeated, "Survived")], entry, [f(repeated, "Pending")]).length === 0 && watched([repeated], () => file, new Map([["b.js", new Set([1])]])).size === 1 && watched(["survivor: b.js: x [! -> ]"], () => file, new Map()).size === 0,
  "every unchanged line that could hold a listed kind is run: where its fault still survives, a changed line cannot use the entry; where a test catches it there, the entry is the changed line's; where it was not run, as on a changed line, it holds nothing, so a budget that runs out turns nothing red");
// (a line rewritten once and left unlisted under its old id: a later change that adds the same fault elsewhere in the
// file finds the rewritten line holding the entry)
ok(unlisted([{ ...f("survivor: a.js: if (z === 1) return; [=== -> !==]", "Survived"), line: 9 }], one, [renamed]).length === 1,
  "debt that moved earlier under another id still holds its entry: a later survivor of that kind in the file is the later change's own");
const was = "survivor: a.js: export const flag = () => true; [true -> false]", now2 = "survivor: a.js: export const flag = () => { return true; }; [true -> false]";
const low = lowered(new Map([[was, { count: 1 }], ["survivor: b.js: x [! -> ]", { count: 2 }]]), new Map([[now2, 1]]), ["a.js"]);
ok(same([...low].sort(), [[now2, 1], ["survivor: b.js: x [! -> ]", 2]].sort()) && same([...lowered(new Map([[was, { count: 1 }]]), new Map(), ["a.js"])], []) && same([...lowered(two, new Map([[twice, 1], [rewritten, 1]]), ["a.js"])].sort(), [[rewritten, 1], [twice, 1]].sort()) && same([...lowered(new Map([[was, { count: 1 }]]), new Map([[now2, 1], [twice, 1]]), ["a.js"])], [[now2, 1]]),
  "a cleaning run keeps the debt of a line it rewrote, one copy of a repeated line too, under the fault's new id, and drops it only where the fault no longer survives; nothing past a kind's total joins; an entry of another file stays");
// (the newest case: one "return true;" and one "return (true);" listed, and the first rewritten into the second)
const both = new Map([[twice, { count: 1 }], [rewritten, { count: 1 }]]), cleaned = lowered(both, new Map([[rewritten, 2]]), ["a.js"]);
const cleanedRun = verdict({ faults: [rewrittenOne], still: [rewrittenOne], baseline: b({ [rewritten]: { count: cleaned.get(rewritten) } }), was: b(Object.fromEntries(both)), at: "s.json", deleted: [] });
ok(same([...cleaned], [[rewritten, 2]]) && !cleanedRun.fails,
  "a cleaning run that rewrites a line into another the baseline lists keeps both copies' debt under the one id, and its pull request passes", cleanedRun.lines.join("\n"));
const afterLower = b({ [now2]: { count: 1 } }), beforeLower = b({ [was]: { count: 1 } });
ok(same(joinedUnsaid(afterLower, beforeLower), []) && same(joinedUnsaid(b({ [now2]: { count: 2 } }), beforeLower), [now2]),
  "the pull request of a cleaning run that carried a rewritten line's debt to its new id passes; one that adds to it does not");
const swapped = "survivor: a.js: return 2 > 1; [> -> >=]", kept = "survivor: a.js: return x > 1; [> -> >=]", baseKept = b({ [kept]: { count: 1 } });
const swap = still => verdict({ faults: [f(swapped, "Survived")], still, baseline: b({ [swapped]: { count: 1 } }), was: baseKept, at: "s.json", deleted: [] });
ok(swap([f(kept, "Survived")]).fails && !swap([f(kept, "Killed")]).fails && same(needed([f(swapped, "Survived")], b({ [swapped]: { count: 1 } }), baseKept), [swapped, kept]),
  "a pull request that drops an entry whose fault still survives on its unchanged line, and lists a new survivor in its place, fails; where the run finds that fault caught, the swap passes");
const dropped = still => verdict({ faults: [], still, baseline: b({}), was: baseKept, at: "s.json", deleted: [] });
ok(dropped([f(kept, "Survived")]).fails && mended(dropped([f(kept, "Survived")]).lines.join("\n"), { from: projectOf() }) && !dropped([f(kept, "Killed")]).fails && same(needed([], b({}), baseKept), [kept]) && same(needed([], b({}), baseKept, true), []) && same(undercut(b({}), baseKept, [f(kept, "Survived")]).map(k => k.held), [1]),
  "a pull request that drops an entry while its fault still survives fails, with its mend; once a test catches it, the entry goes; a whole run's pull request is not measured so", dropped([f(kept, "Survived")]).lines.join("\n"));
// (a file split: one of b.js's two listed survivors moved into a.js, with the same fault)
const inB = "survivor: b.js: if (x === 1) return; [=== -> !==]", inA = "survivor: a.js: if (x === 1) return; [=== -> !==]";
const fB = id => ({ ...f(id, "Survived"), file: id.split(": ")[1] }), split = { [inB]: { count: 1 }, [inA]: { count: 1 } }, unsplit = b({ [inB]: { count: 2 } });
const moved = (listed, faults, still) => verdict({ faults, still, baseline: b(listed), was: unsplit, at: "s.json", deleted: [] });
ok(!moved(split, [fB(inA)], [fB(inB)]).fails && moved(split, [fB(inA)], [fB(inB), fB(inB)]).fails && moved({ [inB]: { count: 1 }, [inA]: { count: 2 } }, [fB(inA)], [fB(inB)]).fails && moved(split, [fB(inA)], [fB(inB), { ...fB(inB), status: "Pending" }]).fails
  && mended(moved(split, [fB(inA)], [fB(inB), fB(inB)]).lines.join("\n"), { from: projectOf() }),
  "debt a split carried to another file, listed there and as much fewer where it left, passes; where the old file still holds it, or the new lists more than the run found, it fails, with its mend", moved(split, [fB(inA)], [fB(inB)]).lines.join("\n"));

const unrunOld = verdict({ faults: [], still: [{ ...f(kept, "Pending") }], baseline: b({}), was: baseKept, at: "s.json", deleted: [] });
const notMeasured = verdict({ faults: [f(repeated, "Survived")], still: [f(repeated, "Pending")], baseline: b({ [repeated]: { count: 1 } }), was: b({ [repeated]: { count: 1 } }), at: "s.json", deleted: [] });
ok(unrunOld.fails && !notMeasured.fails && notMeasured.lines.some(l => l.startsWith("Not measured:") && l.includes("Readings taken")) && same(unsure([f(repeated, "Survived")], entry, [f(repeated, "Killed")]), []),
  "a pull request that lowers an entry while a fault of its kind was not run fails, since only debt measured gone leaves the list; a survivor that passes only for want of a run is said not to be measured", notMeasured.lines.join("\n"));
// (#408: the tool run a second time, with a budget of its own, on the lines whose faults the first left unrun alone;
// each fault by its place, file, line and column, and id)
const at = (id, status, line, column = 1) => ({ ...f(id, status), line, column }), on = (...lines) => new Map([["a.js", new Set(lines)]]);
const told = [], asked = lines => [...lines].map(([file, where]) => [file, [...where]]);
const second = again([at(repeated, "Pending", 2), at(repeated, "Survived", 7)], lines => { told.push(asked(lines)); return [at(repeated, "Survived", 2)]; }, on(2, 7));
const measuredAgain = verdict({ faults: [f(repeated, "Survived")], still: second, baseline: b({ [repeated]: { count: 1 } }), was: b({ [repeated]: { count: 1 } }), at: "s.json", deleted: [] });
const stillUnrun = again([at(repeated, "Pending", 2), at(repeated, "Killed", 7)], () => [at(repeated, "Pending", 2)], on(2, 7));
ok(same(told, [[["a.js", [2]]]]) && second.length === 2 && second.every(g => g.status === "Survived") && measuredAgain.fails && !measuredAgain.lines.some(l => l.startsWith("Not measured:"))
  && again([at(repeated, "Killed", 2)], () => { throw new Error("run again"); }, on(2)).length === 1 && verdict({ faults: [f(repeated, "Survived")], still: stillUnrun, baseline: b({ [repeated]: { count: 1 } }), was: b({ [repeated]: { count: 1 } }), at: "s.json", deleted: [] }).lines.some(l => l.startsWith("Not measured:")),
  "a fault left unrun on the lines a change left alone is run again, on its line alone, and what that run finds takes its place: a survivor that grows the debt then fails; where it stays unrun, it is said not measured, and with nothing unrun the tool is not run again", measuredAgain.lines.join("\n"));
// (the fallback reviewer's cases on #463: a survivor the first run judged on a line it re-runs is kept, though the second
// run leaves it unrun; two faults of one id on one line, told apart by their column, are each matched to their own)
const kept4 = again([at(repeated, "Survived", 4, 5), at(repeated, "Pending", 4, 20), at(repeated, "Killed", 9)], () => [at(repeated, "Pending", 4, 5), at(repeated, "Pending", 4, 20)], on(4, 9));
const twoOnOne = again([at(repeated, "Survived", 4, 5), at(repeated, "Pending", 4, 20), at(repeated, "Killed", 9)], () => [at(repeated, "Survived", 4, 5), at(repeated, "Killed", 4, 20)], on(4, 9));
const judgedNow = again([at(repeated, "Pending", 4, 5), at(kept, "Pending", 4, 9), at(repeated, "Killed", 9)], () => [at(repeated, "Survived", 4, 5), at(repeated, "Survived", 4, 30)], on(4, 9));
let calls = 0;
const sameQueue = again([at(repeated, "Pending", 2), at(repeated, "Survived", 2, 9)], () => { calls++; return []; }, on(2));
const otherKinds = again([at(repeated, "Pending", 2)], () => { calls++; return []; }, on(2, 3));
// (and two faults that share a start and, cut short, an id, as a tool that faults a whole expression writes them: each
// matched to its own by the whole of it, its end and what it became)
const longLine = "if (someObject.someLongPropertyName.anotherProperty.length < limit) go();\nkeep();\n";
const wide = (status, replacement, line = 1) => ({ ...mutant(line, 5, 67, status, replacement), mutatorName: "EqualityOperator" });
const reportOf = (...mutants) => JSON.stringify({ files: { "a.js": { source: longLine, mutants } } });
const shared = faultsOf(reportOf(wide("Pending", "someObject.someLongPropertyName.anotherProperty.length <= limit"), wide("Pending", "someObject.someLongPropertyName.anotherProperty.length >= limit"), { ...mutant(2, 1, 5, "Killed", "x"), mutatorName: "Other" }), null);
const sharedAgain = order => again(shared, () => faultsOf(reportOf(...order), null), on(1, 2));
const truth = [wide("Survived", "someObject.someLongPropertyName.anotherProperty.length <= limit"), wide("Killed", "someObject.someLongPropertyName.anotherProperty.length >= limit")];
ok(shared[0].id === shared[1].id && [truth, [...truth].reverse()].every(order => { const got = sharedAgain(order); return got.filter(g => g.status === "Survived").length === 1 && got.filter(g => g.status === "Killed").length === 2 && got.find(g => g.status === "Survived").replacement.endsWith("<= limit"); }),
  "two faults that share a start and, cut short, an id are each matched to their own by the whole of them, in whatever order the second report holds them");
ok(kept4.filter(g => g.status === "Survived").length === 1 && kept4.length === 3
  && verdict({ faults: [f(repeated, "Survived")], still: kept4, baseline: b({ [repeated]: { count: 1 } }), was: b({ [repeated]: { count: 1 } }), at: "s.json", deleted: [] }).fails
  && twoOnOne.filter(g => g.status === "Survived").length === 1 && twoOnOne.filter(g => g.status === "Killed").length === 2
  && judgedNow.length === 3 && judgedNow.filter(g => g.status === "Survived").length === 1 && judgedNow.some(g => g.id === kept && g.status === "Pending")
  && sameQueue.length === 2 && calls === 1 && otherKinds.length === 1,
  "fault by fault, by place and id: a survivor the first run judged is kept though the second run leaves its line unrun; two faults of one id on one line are each matched to their own, so none is counted twice; a fault judged again takes the place of that fault alone; where the lines left unrun are all the first run measured, no second run is made, and where it measured others too, one is");
ok(unrunOld.lines.some(l => l.startsWith("FAIL") && l.includes("did not run (its budget)") && l.includes("raise the tool's budget") && l.includes("MUTATE_BUDGET")) && mended(unrunOld.lines.join("\n"), { from: projectOf() }) && !dropped([f(kept, "Survived")]).lines.some(l => l.includes("budget where"))
  && same(undercut(b({}), baseKept, [f(kept, "Pending")]).map(k => k.unrun), [1]),
  "where an entry is held up only by faults the tool did not run, the failure says so and names a larger budget in its mend; where the faults ran and survive, it does not", unrunOld.lines.join("\n"));

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

const survivorMend = verdict({ faults: [f(swapped, "Survived")], still: [f(swapped, "Survived")], baseline: b({}), was: b({}), at: "s.json", deleted: [] }).lines.join("\n");
ok(mended(survivorMend) && /with no network where the run cuts it off/u.test(survivorMend), "a survivor's mend names the cut", survivorMend);

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
