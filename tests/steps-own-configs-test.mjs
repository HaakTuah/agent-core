// Tests the configs steps.mjs reads and fresh.mjs compares, on projects the starter kit of this commit writes in a scratch
// folder (each a git repository with nothing committed) that run the copies, licence and agent-tools checks from a
// workflow of their own with their configs at paths of their own, called with configs of their own or with an expression
// (#366, #368, #364), and the checks that read nothing there (#459). Node's own modules and git.
//
//   node tests/steps-own-configs-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { differences, fresh } from "../scripts/fresh.mjs";
import { isCode } from "../scripts/shape-readers.mjs";
import { leftOut } from "../scripts/reading.mjs";
import { readNothing } from "../scripts/read-nothing.mjs";
import { holders } from "../scripts/holders.mjs";
import { only, heldKitIn } from "../scripts/steps-kit.mjs";
import { configs, notDone, project, report, runsOwn } from "../scripts/steps.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-own-configs-");
const kit = heldKitIn(tmp, ok);

const dirs = { "an-npm-project": kit("an-npm-project", { packages: "." }, { held: false }) };

// ---- a project that runs the copies and licence checks from a workflow of its own, its configs at paths of its own ----
// (#366: each step and each difference names the files it holds; #364: a comment that names a script is no run of it)
const ownDir = kit("own-configs", { nuget: "src", private: true }, { held: false });
const move = (from, to) => { fs.mkdirSync(path.dirname(path.join(ownDir, to)), { recursive: true }); fs.renameSync(path.join(ownDir, from), path.join(ownDir, to)); };
for (const [from, to] of [["checks/licences.json", "config/licences.json"], ["checks/licences-audit.json", "config/audit.json"], ["checks/copies.json", "config/copies.json"], ["checks/copies-baseline.json", "config/copies-base.json"]]) move(from, to);
const rewrite = (file, edit) => fs.writeFileSync(path.join(ownDir, file), edit(fs.readFileSync(path.join(ownDir, file), "utf8")));
rewrite("config/licences.json", t => { const { nuget, ...rest } = JSON.parse(t); return JSON.stringify({ ...rest, audit: "config/audit.json" }, null, 2); });
rewrite("config/copies.json", t => t.replace('"checks/copies-baseline.json"', '"config/copies-base.json"'));
rewrite("core-manifest.md", t => t.replace("`core/scripts/copies.mjs` with `checks/copies.json`", "`core/scripts/copies.mjs` with `config/copies.json`"));
for (const f of fs.readdirSync(path.join(ownDir, ".github/workflows"))) if (/^(copies|licences|nuget)\.yml$/.test(f)) fs.rmSync(path.join(ownDir, ".github/workflows", f));
// (the parts of core.yml's one job those calls stood for, left out with them: #376)
rewrite(".github/workflows/core.yml", t => t.replace(/^ {6}(copies|sizes|nuget): .*\n/gm, ""));
fs.mkdirSync(path.join(ownDir, "src/App"), { recursive: true });
fs.writeFileSync(path.join(ownDir, "src/App/App.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\" />\n");
const ownRun = "name: checks\n\non:\n  pull_request:\n\njobs:\n  checks:\n    runs-on: ubuntu-latest\n    steps:\n      # core/scripts/licences.mjs reads the list below\n      - run: |\n          # core/scripts/licences.mjs takes its config first\n          node core/scripts/copies.mjs config/copies.json\n          node core/scripts/licences.mjs config/licences.json # core/scripts/licences.mjs reads\n          node core/scripts/agent-tools.mjs config/licences.json\n";
fs.writeFileSync(path.join(ownDir, ".github/workflows/checks.yml"), ownRun);
execFileSync("git", ["add", "-A"], { cwd: ownDir });
const ownP = project(ownDir);
const at = configs(ownP);
ok(at.licences === "config/licences.json" && at.audit === "config/audit.json" && at.copies === "config/copies.json" && at.baseline === "config/copies-base.json",
  "the configs are read where the project's own workflow and its manifest's slot name them, and the audit and baseline as those configs name them", JSON.stringify(at));
ok(runsOwn(ownP, "licences.mjs").length === 1 && !runsOwn(ownP, "exact-versions.mjs").length, "a workflow runs a script only where a step's run: value runs it, a comment that names it read as none");
let missedOwn = notDone(ownDir);
const nugetMend = missedOwn.find(m => m.lead === "13 November 2026, the NuGet check")?.mend ?? "";
ok(nugetMend.includes("`config/licences.json` has a \"nuget\" part") && !/checks\//.test(report(missedOwn).split("\n\nChecks that read nothing")[0]), "the NuGet step's mend names the licence config the project holds, never the starter kit's path", report(missedOwn));
// the checks that read nothing here (#459, point 2): the shape check where "code" names no file of its languages, the
// strength where the manifest names no mutation tool, each with the rules scripts/holders/ says it holds; said in the
// report, failing nothing
{
  const bare = path.join(tmp, "no-code");
  fs.cpSync(dirs["an-npm-project"], bare, { recursive: true });
  // (the kit's own files of code, a test among them, taken out: the project holds none the shape check's readers know)
  const kitCode = execFileSync("git", ["ls-files", "-z", "--", ".", ":!core/"], { cwd: bare, encoding: "utf8" }).split("\0").filter(f => f && isCode(f));
  if (kitCode.length) execFileSync("git", ["rm", "-q", "-f", "--", ...kitCode], { cwd: bare });
  const before = notDone(bare), was = before.nothing.map(n => n.check);
  const readBare = f => { try { return fs.readFileSync(path.join(bare, f), "utf8"); } catch { return null; } };
  const names = [...new Set(holders().rules.map(r => path.posix.basename(r.file)))];
  const manifestOf = but => readBare("core-manifest.md").replace(/^Not taken:.*$/gmu, "").replace(/\bModules:[^\n]*/u, `Modules: ${names.filter(m => m !== but).map(m => `\`${m}\``).join(", ")}.`) + (but ? `\nNot taken: \`${but}\` (the test's)\n` : "");
  const all = readNothing(bare, manifestOf(""), readBare).find(n => n.check === "core/scripts/shape.mjs");
  const without = readNothing(bare, manifestOf("repositories.md"), readBare).find(n => n.check === "core/scripts/shape.mjs");
  // (the strength of the tests: named where the manifest's *mutation tool* is `none`, as the kit writes it; where it
  // names a tool, named all the same where the shape check's config names no file it reads, or is not there, and the
  // shape check then said to have no config; each with the script's path in the core beside the project's)
  const withTool = manifestOf("").replace(/^\| \*mutation tool\* \|[^\n]*$/mu, "| *mutation tool* | `node core/scripts/mutate.mjs --report {report} {lines}` |");
  const toolNoCode = readNothing(bare, withTool, readBare), noConfig = readNothing(bare, withTool, f => (f === "checks/shape.json" ? null : readBare(f)));
  const strengthOf = l => l.find(n => n.script === "scripts/strength.mjs");
  ok(/`none`/u.test(strengthOf(before.nothing)?.why ?? "") && strengthOf(before.nothing).check === "core/scripts/strength.mjs" && withTool !== manifestOf("")
    && /names under "code" no file it measures/u.test(strengthOf(toolNoCode)?.why ?? "") && /waits for `checks\/shape\.json`/u.test(strengthOf(noConfig)?.why ?? "")
    && /holds no `checks\/shape\.json`/u.test(noConfig.find(n => n.script === "scripts/shape.mjs")?.why ?? ""),
    "the strength of the tests is said to read nothing where no mutation tool is named, or where the shape check's config names no file it reads or is not there, and a missing config is said as missing", JSON.stringify({ toolNoCode, noConfig }));
  // (strength is decided by what it measures, never by the shape check's languages: a Go file under "code" is
  // measured, so the strength read something there while the shape check did not; and code of none it measures, a
  // JavaScript test beside it, leaves the strength with nothing while the shape check reads the test)
  fs.mkdirSync(path.join(bare, "go"), { recursive: true });
  fs.writeFileSync(path.join(bare, "go", "main.go"), "package main\n");
  fs.mkdirSync(path.join(bare, "bin"), { recursive: true });
  fs.writeFileSync(path.join(bare, "bin", "run.sh"), "echo\n");
  fs.mkdirSync(path.join(bare, "t"), { recursive: true });
  fs.writeFileSync(path.join(bare, "t", "a.test.js"), "export {};\n");
  execFileSync("git", ["add", "-A"], { cwd: bare });
  const withConfig = c => f => (f === "checks/shape.json" ? JSON.stringify({ baseline: "checks/shape-baseline.json", ...c }) : readBare(f));
  const goSaid = readNothing(bare, withTool, withConfig({ code: ["go/"], tests: [] })), shSaid = readNothing(bare, withTool, withConfig({ code: ["bin/", "t/"], tests: ["t/"] }));
  ok(!strengthOf(goSaid) && goSaid.some(n => n.script === "scripts/shape.mjs") && /names under "code" no file it measures/u.test(strengthOf(shSaid)?.why ?? "") && !shSaid.some(n => n.script === "scripts/shape.mjs"),
    "the strength is said to read nothing by what it measures, a file of a language the shape check's readers do not know among it, never by the shape check's languages", JSON.stringify({ goSaid, shSaid }));
  // (#1107, point 3: the shape check the manifest turns off, with the owner's reason, is said to read nothing, its reason
  // given, whatever its config names, and a `none` with no reason turns nothing off; Stryker named from a folder that
  // holds no lock file is said to read nothing, since no job installs it, and one with its lock file is not)
  const shapeOf = l => l.find(n => n.script === "scripts/shape.mjs"), readsTests = withConfig({ code: ["t/"], tests: ["t/"] });
  const offSaid = readNothing(bare, `${withTool}\n| *shape check* | \`none\`: the owner's reason |\n`, readsTests);
  const noReason = readNothing(bare, `${withTool}\n| *shape check* | \`none\` |\n`, readsTests);
  const stryker = withTool.replace(/^\| \*mutation tool\* \|[^\n]*$/mu, "| *mutation tool* | `node core/scripts/stryker.mjs --tool checks/mutation --report {report} {lines}` |");
  const lockless = readNothing(bare, stryker, withConfig({ code: ["go/"], tests: [] }));
  const locked = readNothing(bare, stryker, f => (f === "checks/mutation/package-lock.json" ? "{}" : withConfig({ code: ["go/"], tests: [] })(f)));
  ok(/is `none`, which turns it off: the owner's reason$/u.test(shapeOf(offSaid)?.why ?? "") && !shapeOf(noReason)
    && /runs Stryker from `checks\/mutation`, which holds no lock file/u.test(strengthOf(lockless)?.why ?? "") && !strengthOf(locked),
    "the shape check turned off by the owner's `none` with a reason reads nothing, one with no reason is not off, and Stryker with no lock file to install it from reads nothing", JSON.stringify({ offSaid, noReason, lockless, locked }));
  execFileSync("git", ["rm", "-q", "-r", "-f", "--", "go", "bin", "t"], { cwd: bare });
  // (a file of code the shape check does not read, a link or one listed and gone from the disk, makes it read nothing)
  fs.mkdirSync(path.join(bare, "ln"), { recursive: true });
  fs.writeFileSync(path.join(bare, "ln", "gone.js"), "export {};\n");
  execFileSync("git", ["add", "-A"], { cwd: bare });
  fs.rmSync(path.join(bare, "ln", "gone.js"));
  let linked = true;
  try { fs.symlinkSync(path.join(bare, "core-manifest.md"), path.join(bare, "ln", "a.js")); } catch { linked = false; }
  // (and a nested repository named as a file of code, which git lists and the check cannot read)
  fs.mkdirSync(path.join(bare, "ln", "nested.js"));
  execFileSync("git", ["init", "-q"], { cwd: path.join(bare, "ln", "nested.js") });
  fs.writeFileSync(path.join(bare, "ln", "nested.js", "x.txt"), "x\n");
  execFileSync("git", ["-C", path.join(bare, "ln", "nested.js"), "add", "-A"]);
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-C", path.join(bare, "ln", "nested.js"), "commit", "-q", "-m", "x"]);
  ok(readNothing(bare, withTool, withConfig({ code: ["ln/"], tests: [] })).some(n => n.script === "scripts/shape.mjs"),
    `the shape check is said to read nothing where its only files of code are ${linked ? "a link, " : ""}a nested repository and one gone from the disk, which it does not read`);
  fs.rmSync(path.join(bare, "ln"), { recursive: true, force: true });
  execFileSync("git", ["add", "-A"], { cwd: bare });
  // (where which checks read nothing cannot be read, the report says so, never that every check read something)
  const unreadNothing = Object.assign([], { nothing: null, nothingWhy: "a reason" });
  ok(report(unreadNothing).includes("Which checks read nothing here could not be read (a reason)") && !report(Object.assign([], { nothing: [] })).includes("read nothing"),
    "where the checks that read nothing could not be read, the sync's report says so", report(unreadNothing));
  const codeAt = JSON.parse(fs.readFileSync(path.join(bare, "checks/shape.json"), "utf8")).code.find(c => !c.startsWith(":"));
  fs.mkdirSync(path.join(bare, codeAt), { recursive: true });
  fs.writeFileSync(path.join(bare, codeAt, "a.js"), "export const a = 1;\n");
  execFileSync("git", ["add", "-A"], { cwd: bare });
  const now = notDone(bare).nothing.map(n => n.check);
  const out = leftOut(fs.readFileSync(path.join(bare, "core-manifest.md"), "utf8")), fileOf = new Map(holders().rules.map(r => [r.key, r.file]));
  const listed = [...holders().by].filter(([k, l]) => l.some(h => h.kind === "check" && h.by === "scripts/shape.mjs") && !out.has(path.posix.basename(fileOf.get(k)))).map(([k]) => k);
  const shape = before.nothing.find(n => n.check === "core/scripts/shape.mjs");
  ok(listed.length && JSON.stringify(shape?.holds) === JSON.stringify(listed) && !was.includes("core/scripts/select.mjs") && report(before).includes("Checks that read nothing here") && before.nothing.every(n => n.holds.length && n.why.length > 20)
    && !now.includes("core/scripts/shape.mjs"),
    "a project whose code holds no file the shape check's readers know is said to have the shape check read nothing, with the rules holders.json says it holds; a file of code there makes it read", report(before));
  // (a rule of a module the manifest leaves out is not named among those a check holds there)
  ok(all?.holds.some(k => k.startsWith("tasks/repositories.md:")) && without && !without.holds.some(k => k.startsWith("tasks/repositories.md:")) && without.holds.length === all.holds.filter(k => !k.startsWith("tasks/repositories.md:")).length,
    "a rule of a module the manifest leaves out is not named among those a check that read nothing holds", JSON.stringify({ all, without }));
}

ok(!missedOwn.some(m => m.lead === "16 November 2026, an agent's own tools listed"), "the agent-tools step reads the config the project passes, not the word after a comment that names the licence script", report(missedOwn));
const foundOwn = differences(ownP, fresh(ownP));
ok(!foundOwn.some(d => /^checks\//.test(d)) && JSON.stringify(foundOwn.filter(d => /^config\//.test(d))) === JSON.stringify(['config/licences.json: lacks the key "nuget"']),
  "beside a fresh start, the configs are compared where the project holds them, by their keys, and none at the kit's paths is called missing", foundOwn.join("\n"));
// (a copies config named only when the workflow runs leaves the licence config's paths read, and compared)
fs.writeFileSync(path.join(ownDir, ".github/workflows/checks.yml"), ownRun.replace("copies.mjs config/copies.json", 'copies.mjs "$COPIES"'));
const halfP = project(ownDir), half = configs(halfP);
ok(half.licences === "config/licences.json" && half.audit === "config/audit.json" && half.copies === null && half.baseline === null && fresh(halfP).some(([to]) => to === "config/licences.json") && !fresh(halfP).some(([to]) => /^(checks|config)\/copies/.test(to)),
  "a config one workflow names only when it runs leaves that check's paths unread, and the other check's read and compared", JSON.stringify(half));
ok(differences(halfP, fresh(halfP)).some(d => d.startsWith("the copies check's config not compared: ") && d.includes("$COPIES")), "and the differences say whose config they did not compare, and why");
// (a project whose licence and NuGet checks are called with configs of their own: the "nuget" part is looked for in the
// NuGet check's, the rest in the licence check's)
const mixed = kit("mixed-configs", { packages: ".", nuget: "src" });
const lic = JSON.parse(fs.readFileSync(path.join(mixed, "checks/licences.json"), "utf8"));
const { nuget: nugetPart, ...npmPart } = lic;
fs.mkdirSync(path.join(mixed, "config"));
fs.writeFileSync(path.join(mixed, "config/npm.json"), JSON.stringify(npmPart, null, 2));
fs.writeFileSync(path.join(mixed, "config/dotnet.json"), JSON.stringify({ nuget: nugetPart }, null, 2));
fs.rmSync(path.join(mixed, "checks/licences.json"));
for (const [wf, to] of [["licences.yml", "config/npm.json"], ["nuget.yml", "config/dotnet.json"]]) {
  const at = path.join(mixed, ".github/workflows", wf);
  fs.writeFileSync(at, fs.readFileSync(at, "utf8").replace("config: checks/licences.json", `config: ${to}`));
}
execFileSync("git", ["add", "-A"], { cwd: mixed });
const mixedP = project(mixed), mixedFound = differences(mixedP, fresh(mixedP));
ok(configs(mixedP).licences === "config/npm.json" && configs(mixedP).nuget === "config/dotnet.json" && !mixedFound.some(d => /^(config|checks)\//.test(d)),
  "a licence config and a NuGet config of their own are each compared with their own part of the kit's", mixedFound.join("\n"));
// (and a NuGet call that names its config outright is read where the licence config is named only when a workflow runs)
const licencesLate = { ...mixedP, workflows: { ...mixedP.workflows, "licences.yml": { text: "licences.mjs", yaml: { jobs: { j: { steps: [{ run: 'node core/scripts/licences.mjs "$LICENCES"' }] } } } } } };
const late = configs(licencesLate);
ok(late.licences === null && late.nuget === "config/dotnet.json" && fresh(licencesLate).some(([to]) => to === "config/dotnet.json"),
  "a NuGet config the NuGet call names outright is read and compared where the licence config cannot be", JSON.stringify(late));
// (#368: a call's input that names its config only when the workflow runs, an expression, is never read as a path: that
// check's config is reported not read and compared nowhere, the licence config without the "nuget" part, and the others
// read and compared)
for (const [wf, from] of [["copies.yml", "checks/copies.json"], ["nuget.yml", "config/dotnet.json"]]) {
  const at = path.join(mixed, ".github/workflows", wf);
  fs.writeFileSync(at, fs.readFileSync(at, "utf8").replace(`config: ${from}`, `config: \${{ vars.${wf.split(".")[0].toUpperCase()} }}`));
}
execFileSync("git", ["add", "-A"], { cwd: mixed });
const exprP = project(mixed), exprAt = configs(exprP), exprFound = differences(exprP, fresh(exprP));
ok(exprAt.licences === "config/npm.json" && exprAt.nuget === null && exprAt.copies === null && exprAt.baseline === null
  && exprFound.filter(d => /^the (NuGet|copies) check's config not compared: /.test(d) && d.includes("${{ vars.")).length === 2 && !exprFound.some(d => /^(config|checks)\/|^\$\{\{/.test(d)),
  "a config a call passes as an expression is reported not read and compared nowhere, and the other configs read and compared", `${JSON.stringify(exprAt)}\n${exprFound.join("\n")}`);
// (with only a comment naming the script before it, the old reading took the comment's next word as the config)
fs.writeFileSync(path.join(ownDir, ".github/workflows/checks.yml"), ownRun.replace("          node core/scripts/agent-tools.mjs config/licences.json\n", ""));
missedOwn = notDone(ownDir);
const toolsMend = missedOwn.find(m => m.lead === "16 November 2026, an agent's own tools listed")?.mend ?? "";
ok(toolsMend.includes("runs `node core/scripts/agent-tools.mjs config/licences.json` beside it") && !/`(reads|takes)`/.test(toolsMend), "where it does not run the agent-tools check, the step's mend names the config the licence check is passed (#364)", toolsMend);


done("steps-own-configs");
