// Tests the check that each test of the core runs in its tests workflow (scripts/tests-named.mjs; #1546): a test run by
// a line that is no comment passes, in any of the forms the workflow writes; one named only in a comment or a step's
// condition, or not at all, fails with its mend; and the core's own workflow runs every test. Node's own modules.
//
//   node tests/tests-named-test.mjs
import fs from "node:fs";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { report, runIn, unnamed } from "../scripts/tests-named.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}`); } };

const forms = [
  "        run: node tests/a-test.mjs",
  '        run: node tests/b-test.mjs --part "$PART"',
  "        run: node scripts/shape.mjs .github/shape.json --suite upgrade -- node tests/c-test.mjs --part \"$PART\"",
  '          for part in $STAGED; do node tests/d-test.mjs --part "$part" || failed=1; done',
  "        run: node --no-warnings tests/e-test.mjs",
].join("\n");
ok([..."abcde"].every(x => runIn(forms).has(`tests/${x}-test.mjs`)) && runIn(forms).size === 5,
  "a test run by a line, after node's options, another script's `--`, or in a loop, is read as run");

const named = [
  "# node tests/a-test.mjs, in a comment",
  "        if: ${{ contains(env.RUN, ' tests/b-test.mjs ') }}",
  "        run: node tests/c-test.mjsx",
  "        run: node tests/d-test.mjs.bak",
  "        run: echo tests/e-test.mjs",
  "        run: nodex tests/f-test.mjs",
].join("\n");
ok(runIn(named).size === 0, "a test named only in a comment, a step's condition, as part of a longer name or after another program is not read as run");
ok(unnamed("run: node tests/a-test.mjs\n", ["a-test.mjs", "b-test.mjs", "mutation", "c.mjs"]).join() === "tests/b-test.mjs",
  "of the files of tests/, only a test file no line runs is named; a folder or a file of another name is not");
ok(unnamed("run: node tests/a-test.mjs\r\nrun: node tests/b-test.mjs\r\n", ["b-test.mjs", "a-test.mjs"]).length === 0, "line ends of Windows are read as Unix's");

const made = scratchDir("tests-named-");
try {
  fs.mkdirSync(path.join(made, ".github/workflows"), { recursive: true });
  fs.mkdirSync(path.join(made, "tests/mutation"), { recursive: true });
  for (const f of ["a-test.mjs", "b-test.mjs"]) fs.writeFileSync(path.join(made, "tests", f), "");
  fs.writeFileSync(path.join(made, ".github/workflows/tests.yml"), "steps:\n  - run: node tests/a-test.mjs\n  - run: node tests/b-test.mjs\n");
  const fine = report(made);
  ok(fine.status === 0 && fine.err.length === 0 && /each of the 2 tests/u.test(fine.out.join()), `a root whose tests all run passes: ${fine.out}`);
  fs.writeFileSync(path.join(made, ".github/workflows/tests.yml"), "steps:\n  # - run: node tests/b-test.mjs\n  - run: node tests/a-test.mjs\n");
  const bad = report(made);
  ok(bad.status === 1 && bad.err.length === 1 && bad.err[0].startsWith("FAIL: tests/b-test.mjs is run by no line") && mended(bad.err.join("\n"), { from: made }),
    `a test no line runs fails, saying its mend: ${bad.err}`);
  fs.rmSync(path.join(made, ".github"), { recursive: true });
  const gone = report(made);
  ok(gone.status === 1 && /could not be read/u.test(gone.err.join()) && mended(gone.err.join("\n"), { from: made }), "a workflow that is not there fails, saying so and its mend");
} finally { fs.rmSync(made, { recursive: true, force: true }); }

const own = report();
ok(own.status === 0, `the core's own workflow runs each of its tests: ${own.err.join("; ")}`);

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
