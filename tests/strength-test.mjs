// Tests the strength check run on a project (scripts/strength.mjs; its report is tests/strength-report-test.mjs, its verdict tests/strength-verdict-test.mjs):
// the row that names the tool, the lines a pull request changes and how the tool is told them, and whole runs in a
// scratch repository with a tool of its own: reported only before the baseline, a survivor failed with its mend once it
// stands, one listed passing, a tool that cannot run, `none`, and the whole run writing the baseline, and a cleaning
// task's run lowering it. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/strength-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { baselineOf, changedLines, linesArg, toolOf } from "../scripts/strength.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SCRIPT = fileURLToPath(new URL("../scripts/strength.mjs", import.meta.url));

// ---- the row, the baseline's place, the lines ----
ok(same(toolOf("| *mutation tool* | `mutator run --mutate {lines}` |"), { command: ["mutator", "run", "--mutate", "{lines}"] }) && same(toolOf("| *mutation tool* | `none`: no tool reads GDScript |"), { none: "no tool reads GDScript" }) && toolOf("| *dose* | `in debt` |") === null && toolOf("| *mutation tool* | soon |") === null,
  "the row names the tool's command, or none with its reason; a project with no row, or a row with nothing in backticks, has none named");
// (a row of any length is read in one pass: a reason of 400,000 spaces then a word, read far inside the time a reading
// that tries each start in turn would take; #1107)
{ const at = Date.now(), long = toolOf(`| *mutation tool* | \`none\`: r${" ".repeat(400000)}a${" ".repeat(1000)}|`);
  ok(long?.none?.length === 400002 && Date.now() - at < 2000, "a row of any length is read in one pass", `${Date.now() - at} ms`); }
ok(baselineOf({ baseline: "checks/shape-baseline.json" }) === "checks/strength-baseline.json" && baselineOf({ baseline: ".github/shape-baseline.json" }) === ".github/strength-baseline.json", "the baseline stands beside the shape check's");
ok(linesArg(new Map([["a.js", new Set([3, 1, 2, 7])], ["b.js", new Set([5])]])) === "a.js:1-3,a.js:7-7,b.js:5-5", "the lines are told as runs, <file>:<first>-<last>, joined by commas");

// ---- whole runs, in a scratch repository ----
const dir = scratchDir("strength-test-");
const sh = (...args) => execFileSync("git", ["-c", "core.fsmonitor=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const write = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
const run = (args = [], env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_STEP_SUMMARY: "", ...env } });
const MANIFEST = tool => `# Core manifest\n\n## Slots\n| Slot | Here |\n| --- | --- |\n| *mutation tool* | ${tool} |\n`;
try {
  sh("init", "-q", "-b", "main"); sh("config", "user.email", "t@example.invalid"); sh("config", "user.name", "Test");
  write("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"], tests: ["test"] }));
  write("src/a.js", "export const a = x => x === 1;\n");
  write("test/a.test.js", "import { a } from '../src/a.js';\n");
  // (the scratch tool: a report of one fault that survives on each line it is told, every line of a file told with no
  // lines, in the schema's form)
  write("tool.mjs", "import fs from 'node:fs';\nconst [lines, out] = process.argv.slice(2);\nconst files = {};\nfor (const part of lines.split(',')) { const [file, r] = part.split(':'); const source = fs.readFileSync(file, 'utf8'); const [first, last] = r ? r.split('-').map(Number) : [1, source.split('\\n').length - 1]; files[file] ??= { source, mutants: [] }; for (let n = first; n <= last; n++) files[file].mutants.push({ id: `${file}:${n}`, mutatorName: 'EqualityOperator', replacement: '!==', status: process.env.STATUS || 'Survived', location: { start: { line: n, column: 26 }, end: { line: n, column: 29 } } }); }\nfs.writeFileSync(out, JSON.stringify({ schemaVersion: '1', files }));\n");
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
  // (the shape check's config, whose code it measures, is read only inside the project, wherever the manifest's row
  // names it: a path that leads out of it, or a link to a file outside, fails with its mend, and nothing of it is read)
  {
    const away = scratchDir("strength-away-"), mark = `made-up-${process.pid}`, kept = fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8");
    fs.writeFileSync(path.join(away, "x.json"), JSON.stringify({ baseline: `${mark}.json`, code: [mark], [mark]: 1 }));
    const cases = [[path.relative(dir, path.join(away, "x.json")).split(path.sep).join("/"), /lies outside the project/u]];
    if (process.platform !== "win32") { fs.symlinkSync(path.join(away, "x.json"), path.join(dir, "checks/linked.json")); cases.push(["checks/linked.json", /reached through a link/u]); }
    const missed = cases.map(([at, said]) => {
      write("core-manifest.md", `${kept}| *shape check* | \`${at}\` |\n`);
      const x = run(["--whole"]), out = x.stdout + x.stderr;
      return x.status === 1 && mended(x.stderr) && said.test(x.stderr) && !out.includes(mark) ? "" : `${at}\n${out}`;
    }).filter(Boolean);
    ok(missed.length === 0, "a shape config the manifest names outside the project, or through a link, is refused with its mend, and nothing of what it leads to is read", missed.join("\n"));
    fs.rmSync(path.join(dir, "checks/linked.json"), { force: true }); write("core-manifest.md", kept);
  }
  r = run(["--whole"], { STATUS: "Pending" });
  ok(r.status === 1 && mended(r.stderr) && !fs.existsSync(path.join(dir, "checks/strength-baseline.json")), "a whole run that left faults not run writes no baseline, and says the mend", r.stdout + r.stderr);
  r = run(["--whole"]);
  const written = JSON.parse(fs.readFileSync(path.join(dir, "checks/strength-baseline.json"), "utf8"));
  ok(r.status === 0 && Object.keys(written.listed).length === 2 && written.whole?.commit && /^\d{4}-\d\d-\d\d$/.test(written.whole.day), "the whole run writes the baseline, with the day and commit it ran on", r.stdout + r.stderr);
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
  ok(r.status === 1 && mended(r.stderr) && JSON.parse(fs.readFileSync(path.join(dir, "checks/strength-baseline.json"), "utf8")).listed && Object.keys(JSON.parse(fs.readFileSync(path.join(dir, "checks/strength-baseline.json"), "utf8")).listed).length === 2, "a cleaning task's run that left faults not run lowers nothing, and says the mend", r.stdout + r.stderr);
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
