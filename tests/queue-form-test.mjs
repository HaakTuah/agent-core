// Tests of the queue's check where GitHub cannot be read, and of the core's queue's form (scripts/queue.mjs --check,
// scripts/queue-form.mjs; #552): where the issues' states cannot be read, --check says so and fails nothing, --clear
// fails and writes nothing; each row of a table names its issue first and holds no more cells than its header, in the
// core alone. Node's own modules only; GitHub and the file stand in as functions.
//
//   node tests/queue-form-test.mjs
import { mended } from "../scripts/mend.mjs";
import { LARGEST, command, statesOf } from "../scripts/queue.mjs";
import { CUT, SHOWN, unformed } from "../scripts/queue-form.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const rows = "| Issue | Who | Waits on |\n| --- | --- | --- |\n| #13 | builder | |\n| #14 | builder | #13 |\n";
let answer = JSON.stringify([13, 14, 15].map(n => ({ number: n, state: "open" }))), file = rows;
const at = { read: () => file, write: text => { file = text; }, closed: () => statesOf("o/r", () => { if (answer === null) throw new Error("no answer"); return answer; }) };
const check = (text, extra = {}) => command("--check", { ...at, ...extra, read: () => text });

let r = check(rows);
ok(r.status === 0 && /^ok /u.test(r.out) && unformed(rows).length === 0, "a table whose every row names its issue first in its header's three cells passes", r.out);
r = check(rows + "| #15 | builder | #5 \\| #6 |\n");
ok(r.status === 1 && /holds 4 cells/u.test(r.out) && /no "\|" inside a cell/u.test(r.out), "a \"|\" inside a cell, even written \"\\|\", is a cell more, as the reader splits it, and fails", r.out);
r = check(rows + "| x |\n".repeat(SHOWN + 5) + "| y\u0007" + "z".repeat(CUT * 2) + " |\n");
ok(r.status === 1 && r.out.split("\n").length === SHOWN + 1 && /holds 6 more rows out of their form, not shown\. Mend: /u.test(r.out), "past the first rows out of form, the rest are counted, not shown, so a hostile queue prints a few lines", r.out.slice(0, 300));
r = check(rows + "| y\u0007" + "z".repeat(CUT * 2) + " |\n");
ok(r.status === 1 && r.out.includes("| y\\u0007z") && !r.out.includes("\u0007") && r.out.includes(" .... Mend: ") && r.out.length < CUT + 600, "a row shown is cut short, its control characters written out", r.out);
r = check(rows + "| #15 | builder | | done on Monday |\n");
ok(r.status === 1 && mended(r.out) && /holds 4 cells, its table's header 3: \| #15 /u.test(r.out), "a row with more cells than its table's header fails, saying the mend", r.out);
r = check(rows + "| the menu, #16 | builder | |\n| | builder | |\n");
ok(r.status === 1 && mended(r.out) && /names no issue first: \| the menu, #16 /u.test(r.out) && /names no issue first: \| \| builder/u.test(r.out), "a row that names no issue first, or none at all, fails, saying the mend", r.out);
ok(check(rows + "| #15 | builder | | x |\n", { project: "core/" }).status === 0, "a project's progress file is not read for its form (#552's scope)");
ok(unformed("| #13 | builder | |\n| x | y |\n").length === 1 && unformed("| A | B |\n|:--|--:|\n| #2 | a | b |\n").length === 1, "rows under no header are each read for their issue; a header's line of dashes may hold colons");

// a hostile queue as large as the reader takes is read in one pass (Codex's finding on 1b59b43)
const hostile = ["| h |\n|---" + " ".repeat(LARGEST - 20) + "x\n", "| h |\n|" + "-".repeat(LARGEST / 2) + " ".repeat(LARGEST / 2 - 20) + "x\n", "| h |\n| - |\n|" + "\\".repeat(LARGEST - 20) + "\n", "|" + " |".repeat(LARGEST / 2 - 4) + "\n"];
const started = Date.now();
for (const text of hostile) unformed(text);
ok(Date.now() - started < 2000, "a hostile queue as large as the reader takes is read in a pass, well under two seconds", `${Date.now() - started} ms`);

answer = null;
r = check(rows);
ok(r.status === 0 && /^note the issues the queue names could not be read \(no answer\).*fails nothing/u.test(r.out), "where GitHub cannot be read, the check says so and fails nothing (#459)", r.out);
r = check(rows + "| #15 | builder | | x |\n");
ok(r.status === 1 && /holds 4 cells/u.test(r.out) && /^note the issues/mu.test(r.out), "where GitHub cannot be read, the form is still read", r.out);
r = command("--clear", at);
ok(r.status === 1 && mended(r.out) && /could not be read: no answer/u.test(r.out) && file === rows, "--clear, where GitHub cannot be read, fails, saying the mend, and writes nothing", r.out);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the queue's form`);
process.exit(failed ? 1 : 0);
