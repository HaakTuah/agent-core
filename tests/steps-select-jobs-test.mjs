// Tests the step of the tests a change can reach where a project's tests run in several jobs (#1361, point 4): each job
// on pull requests that names a test of the project's own must select in that job, since the RUN its step writes holds
// in its own job alone; where no job names one, a job that selects is enough, as before. On the project the starter kit
// of this commit writes in a scratch folder. Node's own modules and git.
//
//   node tests/steps-select-jobs-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { STEPS, project } from "../scripts/steps.mjs";
import { kitIn } from "../scripts/steps-kit.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const dir = kitIn(scratchDir("steps-select-jobs-"))("an-npm-project", { packages: "." });
const step = STEPS.find(s => s.lead === "16 November 2026, the tests a change can reach");
const flows = path.join(dir, ".github/workflows");

for (const f of ["tools/rules-test.js", "tools/ui-test.js", "core/tests/kept-test.mjs"]) {
  fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true });
  fs.writeFileSync(path.join(dir, f), "export {};\n");
}
execFileSync("git", ["add", "-A"], { cwd: dir });

const SELECT = "      - run: node core/scripts/select.mjs --env RUN\n        env:\n          SELECT_BASE: HEAD^1\n";
const job = (name, steps) => `  ${name}:\n    runs-on: ubuntu-latest\n    steps:\n${steps}`;
const gated = file => `      - if: env.RUN == 'all' || contains(env.RUN, ' ${file} ')\n        run: node ${file}\n`;
// (the reading of the step with one workflow written, every other workflow of the project's taken out first)
const kept = fs.readdirSync(flows).map(f => [f, fs.readFileSync(path.join(flows, f), "utf8")]);
const said = (jobs, on = "pull_request:") => {
  for (const f of fs.readdirSync(flows)) fs.rmSync(path.join(flows, f));
  fs.writeFileSync(path.join(flows, "tests.yml"), `name: tests\non:\n  ${on}\njobs:\n${jobs.join("")}`);
  return step.check(project(dir));
};

const both = said([job("node", SELECT + gated("tools/rules-test.js")), job("ui", SELECT + gated("tools/ui-test.js"))]);
ok(both === null, "each job that names a test selects in it: done", both);

const oneOfTwo = said([job("node", SELECT + gated("tools/rules-test.js")), job("ui", "      - run: node tools/ui-test.js\n")]);
ok(oneOfTwo !== null && oneOfTwo.includes("`.github/workflows/tests.yml`, its job `ui`") && !oneOfTwo.includes("its job `node`") && oneOfTwo.includes("contains(env.RUN, ' <file> ')"),
  "a job that names a test and selects nothing is named, with the gate of a test a step each, though another job selects", oneOfTwo);

const dotted = said([job("node", SELECT + gated("tools/rules-test.js")), job("ui", "      - run: |\n          npm ci\n          node ./tools/ui-test.js --fast\n")]);
ok(dotted?.includes("its job `ui`"), "a test named with ./ before it, in a script of several lines, is a test the job runs", dotted);

const noneSelects = said([job("node", "      - run: node tools/rules-test.js\n"), job("ui", "      - run: node tools/ui-test.js\n")]);
ok(noneSelects?.includes("its job `node`") && noneSelects.includes("its job `ui`"), "where no job selects, each job that names a test is named", noneSelects);

const runner = said([job("tests", SELECT + "      - run: if [ \"$RUN\" = all ]; then node --test; else node --test $RUN; fi\n"), job("lint", "      - run: npx eslint .\n")]);
ok(runner === null, "where no job names a test, one job that selects, handing its runner the files, is done as before", runner);

const nothing = said([job("tests", "      - run: node --test\n")]);
ok(nothing !== null && nothing.includes("add a step before them"), "where no job selects and none names a test, the mend asks the selection, as before", nothing);

const others = said([job("node", SELECT + gated("tools/rules-test.js")), job("kept", "      - run: node core/tests/kept-test.mjs\n"), job("near", "      - run: node tools/rules-test.json; cat tools/ui-test.js.bak\n")]);
ok(others === null, "a test of the copy of the core, and a file whose name only begins with a test's, name no test of the project's", others);

const pushOnly = said([job("ui", "      - run: node tools/ui-test.js\n")], "push:");
ok(pushOnly !== null && !pushOnly.includes("its job `ui`"), "a job of a workflow pull requests do not run is not read as one that runs tests", pushOnly);

for (const f of fs.readdirSync(flows)) fs.rmSync(path.join(flows, f));
for (const [f, text] of kept) fs.writeFileSync(path.join(flows, f), text);
done("the tests a change can reach, in several jobs");
