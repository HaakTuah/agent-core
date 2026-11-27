// Tests what each test is worth (scripts/test-record.mjs): the steps of a workflow that start a test, the
// runs read from GitHub's jobs and from JUnit reports, what a test alone catches from a mutation report that names
// every test that caught a fault, a failure for no reason (failed and passed on one commit in one job) told from a real
// one, the verdict of each test (kept by one of three, the proof kept too, proposed, or not weighed where its faults
// were not counted), the table and what it asks; then a whole run on JUnit reports in a scratch folder, and each
// refusal read for its mend (mend.mjs). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/test-record-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { alone, fromJobs, fromJunit, record, saysWhatItGuards, stepsOf, table } from "../scripts/test-record.mjs";
import { scratchDir, projectOf } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500)}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tests = new Set(["test/a-test.mjs", "test/b-test.mjs", "test/c-test.mjs", "test/d-test.mjs"]);

const flow = `jobs:
  suites:
    strategy:
      matrix:
        include:
          - { os: ubuntu-latest, part: all }
    steps:
      - name: The a check
        if: \${{ !cancelled() }}
        run: node test/a-test.mjs
      - name: "The b check, timed"
        run: node checks/shape.mjs checks/shape.json --suite b -- node test/b-test.mjs
      - name: Not a test
        run: node test/a-test.mjs.bak
      - uses: actions/checkout@v4
        with:
          run: node test/c-test.mjs
      - name: The d check, a block
        run: |
          echo first
          node test/d-test.mjs
      - name: After the block
        run: echo nothing
  other:
    steps:
      - name: Test
        run: node test/a-test.mjs
  third:
    steps:
      - name: Test
        run: node test/c-test.mjs
`;
const steps = stepsOf(flow, tests);
ok(same([...steps], [["The a check", "test/a-test.mjs"], ["The b check, timed", "test/b-test.mjs"], ["The d check, a block", "test/d-test.mjs"]]), "each step that starts a test file is read by its name, whatever form of YAML stands around it, a block's lines too; a name two jobs give to different tests is left out", JSON.stringify([...steps]));

const t = s => new Date(Date.UTC(2026, 10, 16, 12, 0, s)).toISOString();
const step = (name, from, to, conclusion = "success") => ({ name, started_at: t(from), completed_at: t(to), conclusion });
const jobs = [
  { name: "suites (linux)", head_sha: "s1", created_at: "2026-11-10T00:00:00Z", steps: [step("The a check", 0, 4), step("The b check, timed", 4, 14, "failure"), step("Not a test", 14, 15)] },
  { name: "suites (linux)", head_sha: "s1", created_at: "2026-11-10T01:00:00Z", steps: [step("The a check", 0, 6), step("The b check, timed", 6, 16)] },
  { name: "suites (windows)", head_sha: "s1", created_at: "2026-11-10T00:00:00Z", steps: [step("The a check", 0, 2, "failure"), step("The b check, timed", 2, 3, "skipped")] },
];
const runs = fromJobs(jobs, steps);
ok(runs.length === 5 && runs.every(r => tests.has(r.test)) && runs[0].seconds === 4 && runs[0].key === "s1 suites (linux)", "a run of each test is read from each job's steps, a step skipped or of no test left out", JSON.stringify(runs));
const junit = fromJunit({
  "1.xml": '<testsuite><testcase classname="test/c-test.mjs" name="one" time="1.5"/><testcase file="test/c-test.mjs" name="two" time="0.5"></testcase><testcase classname="test/d-test.mjs" name="x" time="2"><failure message="no"/></testcase></testsuite>',
  "2.xml": '<testsuite><testcase classname="test/d-test.mjs" name="x" time="3"><error/></testcase></testsuite>',
});
ok(same(junit.map(r => [r.test, r.seconds, r.passed, r.key]), [["test/c-test.mjs", 2, true, "1.xml"], ["test/d-test.mjs", 2, false, "1.xml"], ["test/d-test.mjs", 3, false, "2.xml"]]), "a JUnit report is a run: each file's cases summed, failed where one fails or errs", JSON.stringify(junit));

const report = { files: { "src/a.mjs": { mutants: [{ killedBy: ["1"] }, { killedBy: ["1", "2"] }, { killedBy: ["2"] }, { killedBy: ["1", "1b"] }, { status: "Survived" }] } }, testFiles: { "test/a-test.mjs": { tests: [{ id: "1" }, { id: "1b" }] }, "test/b-test.mjs": { tests: [{ id: "2" }] } } };
const caught = alone(report);
ok(same([...caught], [["test/a-test.mjs", 2], ["test/b-test.mjs", 1]]) && alone({ files: { a: { mutants: [{ status: "Killed" }] } } }) === null, "what a test file alone catches is counted where faults name their tests, two cases of one file as that file, and is none where none does", JSON.stringify([...caught ?? []]));

const rows = record({ tests, runs: [...runs, ...junit], alone: new Map([["test/a-test.mjs", 2]]), named: new Set(["test/c-test.mjs"]), proof: new Set(), screens: new Set(["test/d-test.mjs"]), clocks: new Set(["test/a-test.mjs"]), processes: new Set(["test/a-test.mjs", "test/d-test.mjs"]) });
const row = name => rows.find(r => r.test === name);
ok(row("test/a-test.mjs").runs === 3 && row("test/a-test.mjs").seconds === 4 && row("test/a-test.mjs").real === 1 && row("test/a-test.mjs").flaky === 0, "a test failing on one platform alone fails for a real reason", JSON.stringify(row("test/a-test.mjs")));
ok(row("test/b-test.mjs").flaky === 1 && row("test/b-test.mjs").real === 0 && /^proposed/.test(row("test/b-test.mjs").verdict), "one that failed and passed on one commit in one job failed for no reason; caught nothing alone, no rule names it: proposed", JSON.stringify(row("test/b-test.mjs")));
ok(saysWhatItGuards("// Tests tasks/tests.md, \"A new test says what it guards\"\nx();\n") && saysWhatItGuards("\n# guards #275, point 8\n") && !saysWhatItGuards("// tests the selection\n") && !saysWhatItGuards("x(); // modules/a.md\n"),
  "a test guards a stated rule where its opening line, a comment, names a rule file or an issue");
ok(/it guards a stated rule/.test(row("test/c-test.mjs").verdict) && /failed for a real reason/.test(row("test/d-test.mjs").verdict) && row("test/d-test.mjs").last === "2.xml" && row("test/d-test.mjs").screen && /alone catches 2/.test(row("test/a-test.mjs").verdict),
  "a test is kept by what it alone catches, a rule that names it, or a real failure", JSON.stringify(rows));
const unweighed = record({ tests: new Set(["test/x-test.mjs"]), runs: [], alone: null, named: new Set(), proof: new Set(), screens: new Set() });
const proved = record({ tests: new Set(["test/x-test.mjs"]), runs: [], alone: new Map(), named: new Set(), proof: new Set(["test/x-test.mjs"]), screens: new Set() });
ok(/^not weighed/.test(unweighed[0].verdict) && /^kept: the project's proof/.test(proved[0].verdict), "where no fault was counted no test is proposed, and the project's proof is kept", JSON.stringify([unweighed, proved]));
const said = table(rows).join("\n");
ok(said.includes("| `test/b-test.mjs` |") && /Failed for no reason, each to be mended or removed, never retried in silence: `test\/b-test\.mjs` \(1\)/.test(said) && /Proposed for removal or merging.*`test\/b-test\.mjs`/.test(said) && /1 open a screen, 3 s of it/.test(said)
  && /1 reach a real clock, 4 s of it \(\d+%\); 2 start another process, 7 s of it \(\d+%\)/.test(said) && row("test/a-test.mjs").clock && row("test/d-test.mjs").process && !row("test/d-test.mjs").clock,
  "the table names each test, what fails for no reason, what is proposed, and the share of the time the tests that open a screen, reach a real clock or start another process take (#457)", said);

const short = (test, seconds, clock) => ({ test, runs: 1, seconds, real: 0, last: null, flaky: 0, alone: null, screen: false, clock, process: false, verdict: "kept: x" });
ok(/1 reach a real clock, 1 s of it \(60%\)/.test(table([short("a", 0.6, true), short("b", 0.4, false)]).join("\n")), "a share is taken from the times as they stand, rounded only as it is shown", table([short("a", 0.6, true), short("b", 0.4, false)]).join("\n"));

// ---- a whole run, on JUnit reports in a scratch folder ----
const dir = scratchDir("test-record-test-");
const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
execFileSync("git", ["init", "-q"], { cwd: dir });
put("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src", "test"], tests: ["test/"], screens: ["playwright"] }));
put("src/a.mjs", "export const a = 1;\n"); put("test/a-test.mjs", "import '../src/a.mjs';\nimport { spawnSync } from 'node:child_process';\nconst t = Date.now();\n"); put("test/b-test.mjs", "// guards #12, the bug it caught\n"); put("test/e2e-test.mjs", "import 'playwright';\n");
put("reports/1.xml", '<testcase classname="test/a-test.mjs" name="a" time="1"/><testcase classname="test/e2e-test.mjs" name="e" time="9"/>');
put("reports/2.xml", '<testcase classname="test/a-test.mjs" name="a" time="3"><failure/></testcase><testcase classname="test/e2e-test.mjs" name="e" time="7"/>');
put("mutation.json", JSON.stringify({ files: { "src/a.mjs": { mutants: [{ killedBy: ["test/a-test.mjs"] }] } } }));
put("checks/broken.json", "{");
// (a config that stands, outside the project: refused as outside, never read as none there)
const away = scratchDir("test-record-away-");
fs.writeFileSync(path.join(away, "shape.json"), fs.readFileSync(path.join(dir, "checks/shape.json")));
const awayAt = path.relative(dir, path.join(away, "shape.json")).split(path.sep).join("/");
const script = fileURLToPath(new URL("../scripts/test-record.mjs", import.meta.url));
const run = args => { const r = spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
let r = run(["checks/shape.json", "--junit", "reports", "--mutation", "mutation.json"]);
ok(r.status === 0 && /\| `test\/a-test\.mjs` \| 2 \| 2 \| 1 \(2\.xml\) \| 0 \| 1 \|  \| yes \| yes \|/.test(r.out) && /\| `test\/e2e-test\.mjs` \| 2 \| 8 \| 0 \| 0 \| 0 \| yes \|  \|  \| proposed/.test(r.out) && /1 open a screen, 8 s of it/.test(r.out)
  && /1 reach a real clock, 2 s of it \(20%\); 1 start another process, 2 s of it \(20%\)/.test(r.out) && /\| `test\/b-test\.mjs` \| 0 .*kept: it guards a stated rule/.test(r.out),
  "a whole run reads the reports, the faults and the tests that open a screen, reach a real clock or start another process, and prints the table", r.out);
for (const [args, what] of [[["checks/shape.json", "--junit", "nowhere"], "a folder of reports that is not there"], [["checks/shape.json", "--mutation", "reports/1.xml"], "a mutation report that is no JSON"],
  [["checks/shape.json", "--repo", "o/n"], "a repository with no workflow named"], [["checks/none.json"], "no config"], [["checks/shape.json", "--every"], "a word it does not know"],
  [[awayAt], "a config outside the project"], [["checks/broken.json"], "a config that is no JSON"]]) {
  r = run(args);
  ok(r.status === 1 && mended(r.out, { from: projectOf() }) && (args[0] !== awayAt || /lies outside the project/u.test(r.out)), `refused, with its mend: ${what}`, r.out);
}
// (a config named by an address that holds a sign-in: refused with its mend, the sign-in cut as shape.mjs cuts it, #1236)
{
  const secret = ["made", "up", String(process.pid)].join("-"), at = `https://someone:${secret}@example.invalid/shape.json`;
  r = run([at]);
  ok(r.status === 1 && mended(r.out) && !r.out.includes(secret), "refused, with its mend: a config named by an address that holds a sign-in, the sign-in never printed", r.out);
}

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
