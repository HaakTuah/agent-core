// Checks that the core meets, in its own repository, what floor topic 5 asks of every project (#359; AGENTS.md, "The
// core abides by its own rules"): its SECURITY.md lists under rule 5 each input anyone but the user at hand can shape,
// each naming its hostile tests, as the sync's step "16 November 2026, hostile tests for every named input" reads it in a
// project (scripts/steps.mjs), which the core, holding no copy and running no sync, would otherwise never
// read. And that the list and the tests stand together: each file of hostile tests here (`tests/hostile-*-test.mjs`)
// is named by an input and run by the tests workflow. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/own-inputs-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { notDone, STEPS } from "../scripts/steps.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = f => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/gu, "\n");

const step = STEPS.filter(s => s.lead === "16 November 2026, hostile tests for every named input");
ok(step.length === 1, "the sync's step for named inputs is there to read the core with");
const missed = notDone(root, step);
ok(!missed.length, `the core's SECURITY.md lists its inputs under rule 5, each naming hostile tests that are there${missed.length ? `: ${missed.map(m => m.mend).join(" ")}` : ""}`);

const security = read("SECURITY.md"), workflow = read(".github/workflows/tests.yml");
const rule5 = /^5\. [\s\S]*?(?=^\d+\. |^#|(?![\s\S]))/mu.exec(security)?.[0] ?? "";
const named = new Set([...rule5.matchAll(/hostile\s+tests:\s+`(tests\/hostile-[a-z-]+-test\.mjs)`/gu)].map(m => m[1]));
const files = fs.readdirSync(path.join(root, "tests")).filter(f => /^hostile-[a-z-]+-test\.mjs$/u.test(f)).map(f => `tests/${f}`);
ok(files.length > 0 && named.size > 0, "the core has files of hostile tests, and its rule 5 names them");
for (const f of files) {
  ok(named.has(f), `${f} is named by an input in SECURITY.md, rule 5${named.has(f) ? "" : `. Mend: name it there, after the words "hostile tests:" of the input it tries, or take the file out`}`);
  ok(workflow.includes(`run: node ${f}\n`), `${f} is run by the tests workflow${workflow.includes(`run: node ${f}\n`) ? "" : `. Mend: give it a step in .github/workflows/tests.yml, as the other hostile tests have`}`);
}
for (const f of named) ok(files.includes(f), `${f}, named in SECURITY.md, rule 5, is there${files.includes(f) ? "" : ". Mend: write it, or name the file that holds that input's hostile tests"}`);

process.exit(failed ? 1 : 0);
