// Tests of the records of the choices that are hard to undo as every reader reads them (choices-records.mjs, with the
// script choices.mjs that runs them; #912): where a project keeps them, what a record holds and the conditions a line
// "Trips when:" names. git and Node's own modules.
//
//   node tests/choices-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KIT, parse, where } from "../scripts/choices-records.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const here = fileURLToPath(new URL("../scripts", import.meta.url)); // (the scripts this tests, beside the folder tests/)

// ---- where they are ----
ok(where("") === KIT && where(null) === KIT, "with no slot named, the records are the starter kit's file");
ok(where("| *choice records* | `docs/design.md` |") === "docs/design.md", "a manifest's row names them");
ok(where("the *choice records*: `CHOICES.md`; the *report*: the PR's description") === "CHOICES.md", "the core's AGENTS.md names them in its slots");
ok(where("| *choice records* | `../elsewhere.md` |") === null && where("| *choice records* | `/etc/x` |") === null && where("| *choice records* | `a/../../b` |") === null,
  "a name that leads out of the project is no path the records are read from");
ok(where(fs.readFileSync(path.join(here, "..", "AGENTS.md"), "utf8")) === "CHOICES.md", "the core names its own records");

// ---- what a record holds ----
const file = day => `# Choices that are hard to undo\n\nRead whole: ${day}\n\n## Choice: one language\n\n- Chosen for: x.\n- Reopens it: a test takes over a minute.\n\n## Choice: where data is kept\r\n\r\n- Chosen for: y.\r\n\r\n## Notes\n\nReopens it: not this record's.\n`;
const found = parse(file("2026-11-15"));
ok(found.records.length === 2 && found.records[0].name === "one language" && found.records[0].sign && !found.records[1].sign,
  "each record is found by its heading, with whether it names its sign; a line under another heading is not its sign", JSON.stringify(found));
ok(found.read === "2026-11-15" && found.open === 0, "the day of the last pass is read from its line");
ok(parse("## Choice: a\nReopens it:\n").records[0].sign === false, "an empty sign names none");
ok(parse("Read whole: FILL IN: today\n## Choice: a\nReopens it: FILL IN: the sign\n").open === 2 && parse("Read whole: soon\n").read === null && parse("Read whole: 2026-13-45\n").read === null,
  "a line still to fill in is counted, and a day that is no day is none");
ok(parse("## Choice: a\u0007b\n").records[0].name === "a b" && parse("## Choice: a\u202eb\u200bc\n").records[0].name === "a b c", "a name is printed with no control characters, nor any that reorder or hide text");
// ---- a sign written in a measure ----
const lines = parse("## Choice: a\n- Reopens it: past 150 files.\n- Trips when: `files > 150`, `cycles>=1`, `constructor > 1`, `rm -rf /`, `files > 1e9`\n## Choice: b\nTrips when: when it feels slow\n## Choice: c\n").records;
ok(JSON.stringify(lines[0].conditions) === JSON.stringify([{ measure: "files", op: ">", limit: 150 }, { measure: "cycles", op: ">=", limit: 1 }])
  && JSON.stringify(lines[0].unknown) === JSON.stringify(["constructor > 1", "rm -rf /", "files > 1e9"]),
  "a line \"Trips when:\" gives each condition in backticks that names a measure, an operator and a number; anything else is only quoted back, never run", JSON.stringify(lines[0]));
ok(lines[1].conditions.length === 0 && lines[1].unknown.join() === "when it feels slow" && lines[2].conditions.length === 0 && lines[2].unknown.length === 0,
  "a line with no condition in backticks is quoted back as naming none, and a record with no such line names none");

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
