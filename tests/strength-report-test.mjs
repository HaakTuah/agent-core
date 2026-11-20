// Tests the strength check's report (scripts/strength-report.mjs, which scripts/strength.mjs reads the tool's report
// with): a fault's id, a report read and refused, and the counts. The verdict on what it reads is
// tests/strength-verdict-test.mjs. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/strength-report-test.mjs
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { counted, faultsOf, idOf } from "../scripts/strength-report.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };

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

// ---- the counts ----
const f = (id, status) => ({ file: "a.js", line: 2, id, status, mutatorName: "EqualityOperator", original: "===", replacement: "!==" });
const c = counted([f("x", "Killed"), f("y", "Timeout"), f("z", "Survived"), f("w", "NoCoverage"), f("v", "Pending"), f("u", "CompileError")]);
ok(c.caught === 2 && c.survived === 2 && c.pending === 1 && c.line.includes("2 of 4") && c.line.includes("50%") && c.line.includes("1 not run"), "Killed and Timeout are caught, Survived and NoCoverage survived, Pending not run, the rest not counted", c.line);

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
