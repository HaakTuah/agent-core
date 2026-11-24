// Tests the readers of the steps that read what the project's files name (step-checks-hostile.mjs and step-checks-moved.mjs,
// with steps.mjs): rule 5's inputs as SECURITY.md lists them, and the rules' move. On the project the starter kit of this
// commit writes in a scratch folder. Node's own modules and git.
//
//   node tests/steps-files-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { MOVED_GLOB, NEW_GLOBS, moved } from "../scripts/step-checks-moved.mjs";
import { STEPS, notDone, project, report } from "../scripts/steps.mjs";
import { PIN, kitIn } from "../scripts/steps-kit.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-files-");
const kit = kitIn(tmp);
const only = lead => STEPS.filter(s => s.lead === lead);
// (the starter kit's npm project, every step done as the kit writes it)
const lockProject = kit("an-npm-project", { packages: "." });

// ---- rule 5's inputs as SECURITY.md lists them: "None", items naming their tests, nested and wrapped lines ----
const inputs = only("16 November 2026, hostile tests for every named input");
const secFile = path.join(lockProject, "SECURITY.md"), secAsKit = fs.readFileSync(secFile, "utf8");
const rule5 = body => { fs.writeFileSync(secFile, secAsKit.replace(/^(5\. .*\n)(?:(?!\d+\. |#).*\n)*/m, `$1${body}`)); return notDone(lockProject, inputs); };
fs.mkdirSync(path.join(lockProject, "tests/hostile"), { recursive: true });
fs.writeFileSync(path.join(lockProject, "tests/hostile/link.test.mjs"), "\n");
ok(!rule5("   None: it takes no input but its user's.\n").length, "rule 5 that says \"None\" names no input, and reads done");
ok(!rule5("   - a shared link: its parts checked against their shape, limits: 2,000 characters, 5 s,\n     its hostile tests: `tests/hostile/link.test.mjs`.\n     - its query string, read by the same check.\n").length,
  "an item that names, on a wrapped line, a file that is there reads done, the item nested in it part of it");
ok(!rule5("   - a shared link: limits: none, a link's length is the browser's; its hostile tests in `tests/hostile/`.\n").length, "a folder that is there counts as named, and \"limits: none\" is an answer");
fs.mkdirSync(path.join(lockProject, "src"), { recursive: true });
fs.writeFileSync(path.join(lockProject, "src/peer.mjs"), "\n");
let missedInputs = rule5("   - a shared link: limits: 2 KB; hostile tests: `tests/hostile/link.test.mjs`.\n   - a peer's message: checked on arrival by `src/peer.mjs`; limits: 64 KB, 5 s; hostile tests: `tests/hostile/peer.test.mjs`.\n");
ok(missedInputs.length === 1 && missedInputs[0].mend.includes("a peer's message") && !missedInputs[0].mend.includes("a shared link"),
  "an item whose hostile tests are not there is reported, by its words, and only it, though the file of what checks it is there", report(missedInputs));
missedInputs = rule5("   - a shared link: limits: 2 KB; hostile tests: `tests/hostile/link.test.mjs`.\n   - a peer's message: limits: 64 KB; hostile tests: FILL IN\n");
ok(missedInputs.length === 1 && missedInputs[0].mend.includes("a peer's message") && !missedInputs[0].mend.includes("a shared link"),
  "a \"FILL IN\" left in one item reads no other item as done: the item it stands in is reported", report(missedInputs));
missedInputs = rule5("   - a shared link: limits: 2 KB; hostile tests: `tests/hostile/link.test.mjs`.\n   - a peer's message: limits: FILL IN; hostile tests: `tests/hostile/link.test.mjs`.\n");
ok(missedInputs.length === 1 && /"limits:"/u.test(missedInputs[0].mend) && missedInputs[0].mend.includes("a peer's message") && !missedInputs[0].mend.includes("a shared link"),
  "an item whose limits name no number and not \"none\" is reported, by its words, and only it", report(missedInputs));
missedInputs = rule5("   - a peer's message: hostile tests: `tests/hostile/link.test.mjs`, limits: `64` in backticks\n");
ok(missedInputs.length === 1 && /"limits:"/u.test(missedInputs[0].mend), "a number in backticks, a path's or a name's, states no limit", report(missedInputs));
missedInputs = rule5("   - a saved game, its version read first; limits: 1 MB, 5 s; hostile tests: `tests/hostile/link.test.mjs`.\n   - a peer's message, checked by `src/version-check.mjs`; limits: 64 KB; hostile tests: `tests/hostile/link.test.mjs`.\n");
ok(missedInputs.length === 1 && /newest version/u.test(missedInputs[0].mend) && missedInputs[0].mend.includes("a saved game") && !missedInputs[0].mend.includes("a peer's message"),
  "an item that says its input carries a version, and names no version among its limits, is reported; a path in backticks says nothing of one", report(missedInputs));
ok(!rule5("   - a saved game, its version read first; limits: 1 MB, 5 s, version 3; hostile tests: `tests/hostile/link.test.mjs`.\n").length,
  "an item whose limits name the newest version its reader knows reads done");
ok(rule5("   - a saved game, its version read first; limits: 1 MB, 5 s, a newer version refused; hostile tests: `tests/hostile/link.test.mjs`.\n").length === 1
  && rule5("   - a saved game, its version read first, `limits: version 3`; limits: 1 MB; hostile tests: `tests/hostile/link.test.mjs`.\n").length === 1,
  "a version named among the limits with no number, or a version only in backticks, does not read done");
ok(rule5("   - a saved game, its version read first; limits: 1 MB, a newer version refused, 5 s; hostile tests: `tests/hostile/link.test.mjs`.\n").length === 1
  && rule5("   - a saved game, `limits: x`, its version read first; limits: 1 MB; hostile tests: `tests/hostile/link.test.mjs`.\n").length === 1,
  "a later number in the clause is no version's, and a \"limits:\" in backticks hides none of the item's words");
ok(!rule5("   - a peer's message, which carries no version number; limits: 64 KB; hostile tests: `tests/hostile/link.test.mjs`.\n").length,
  "an item that says its input carries no version is not asked to name one");
missedInputs = rule5("   - a saved game, refused without a version; limits: 1 MB; hostile tests: `tests/hostile/link.test.mjs`.\n   - a save, \u001b[31mred\u0007\u009b\u200f\u2028\u202e\u2066\ufeff; limits: 1 MB; hostile tests: none\n");
ok(missedInputs.length === 1 && /newest version/u.test(missedInputs[0].mend) && missedInputs[0].mend.includes("a saved game") && !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/u.test(missedInputs[0].mend),
  "an item that names its version otherwise is still asked to name the newest, and an item's control characters never reach the mend", report(missedInputs));
missedInputs = rule5("   Each message a peer sends, its size checked.\n");
ok(missedInputs.length === 1 && missedInputs[0].mend.includes("as an item of its own"), "inputs written as a paragraph, no item in it, are reported, the mend saying to list them", report(missedInputs));
fs.writeFileSync(secFile, secAsKit.replace(/^5\. .*\n/m, ""));
ok(notDone(lockProject, inputs)[0]?.mend.includes("could not read the project"), "a SECURITY.md with no rule 5 is reported as not read, never as done");
fs.writeFileSync(secFile, secAsKit);
// (only what this block wrote goes: an earlier stage's mend may have written its own tests there)
for (const f of ["tests/hostile/link.test.mjs", "src/peer.mjs"]) fs.rmSync(path.join(lockProject, f));

// the step of the rules' move, on a project of its own making: a config that stands outside checks/, a copies config
// written a pattern a line, a file a tool pulls the core's files in by, two old paths that are now one file, and a
// dated record, which is left as it stands
{
  const moveDir = path.join(tmp, "moved-project"), put = (f, text) => { fs.mkdirSync(path.dirname(path.join(moveDir, f)), { recursive: true }); fs.writeFileSync(path.join(moveDir, f), text); };
  const step = STEPS.find(x => x.lead === "16 November 2026, the rules in folders that say who reads them or when");
  put("core-manifest.md", "# Core manifest\n\nPaths: in the core's files, one into floor/, roles/, tasks/, tools/, scripts/, setup/ or archive/ is under core/; any other is ours.\n");
  put("AGENTS.md", "# A project\n\n@core/modules/work-flow.md\n@core/modules/git.md\n");
  put("config/sizes.json", `${JSON.stringify({ read: ["core/modules/how-to-work.md"] })}\n`);
  put("config/copies.json", `{\n  "prose": [\n    "core/floor/*.md",\n    ${MOVED_GLOB}\n  ]\n}\n`);
  put("docs/2026-01-05-what-was-read.md", "Read that day: `core/modules/inbox.md`.\n");
  put("docs/reports/first.md", "Read: `core/modules/inbox.md`.\n");
  execFileSync("git", ["init", "-q"], { cwd: moveDir });
  let said = step.check(project(moveDir)) ?? "";
  ok(said.startsWith("In one pull request") && said.includes("`core/modules/how-to-work.md` is now `core/roles/shared/how-to-work.md` (in `config/sizes.json`)") && said.includes(`after the pattern ${MOVED_GLOB} add the patterns`) && said.includes("(in `config/copies.json`)")
    && said.includes("a file that named `core/modules/work-flow.md` beside the other path that now leads to `core/roles/shared/work-flow.md` names that file once") && !said.includes("inbox"),
    "the step names an old path in a config wherever it stands, a copies config that reads the old folder alone, and two old paths that are now one file; a dated record it leaves as it stands", said);
  // (a rule file is read whatever its name or its folder, a config in a folder named as a dated record's too)
  put("SECURITY.md", "# Security\n\n**3. The protected files,** here, **the rule files:** `.cursorrules`, `docs/records/standing.md`;\n");
  put(".cursorrules", "Read core/modules/screens.md first.\n"); put("docs/records/standing.md", "As `core/modules/choices.md` says.\n"); put(".github/reports/sizes.json", `${JSON.stringify(["core/modules/cleaning.md"])}\n`); put(".cursor/rules/core.mdc", "Read core/modules/helpers.md.\n"); put(".windsurfrules", "Read core/modules/reviews.md.\n");
  said = step.check(project(moveDir)) ?? "";
  ok(said.includes("`core/modules/screens.md` is now `core/tasks/screens.md` (in `.cursorrules`)") && said.includes("(in `docs/records/standing.md`)") && said.includes("(in `.github/reports/sizes.json`)") && said.includes("(in `.cursor/rules/core.mdc`)") && said.includes("(in `.windsurfrules`)") && !said.includes("inbox"),
    "a rule file is read whatever its name or folder, a file where a tool keeps what it reads whatever its name, and a config wherever it lies; the dated records still are not", said);
  for (const f of ["SECURITY.md", ".cursorrules", "docs/records/standing.md", ".github/reports/sizes.json", ".cursor/rules/core.mdc", ".windsurfrules"]) fs.rmSync(path.join(moveDir, f));
  put(".kiro/steering/core.md", "#[[file:core/modules/how-to-work.md]]\n");
  said = step.check(project(moveDir)) ?? "";
  ok(said.startsWith("Before any other task, since a tool whose entry file pulls the core's files in follows no further import"), "where a file a tool pulls the core's files in by still names an old path, the step comes before any other task, and says why", said);
  fs.rmSync(path.join(moveDir, ".kiro"), { recursive: true });
  put("AGENTS.md", "# A project\n\n@core/roles/shared/work-flow.md\n"); put("config/sizes.json", `${JSON.stringify({ read: ["core/roles/shared/how-to-work.md"] })}\n`);
  put("config/copies.json", `{\n  "prose": [\n    "core/floor/*.md",\n    ${MOVED_GLOB},\n    ${NEW_GLOBS.join(",\n    ")}\n  ]\n}\n`);
  ok(step.check(project(moveDir)) === null, "and it is done once each is named by its new path and the copies config reads the new folders beside the old, however its patterns are laid out", step.check(project(moveDir)) ?? "");
  // (many files of the project's that still name an old path, none marked by its attributes: their attributes are read
  // once, so the step answers within SECURITY.md item 5's 5 s; #1272, point 3)
  for (let i = 0; i < 1000; i += 1) put(`docs/n${i}.md`, "Read `core/modules/inbox.md`.\n");
  const t0 = Date.now(), many = step.check(project(moveDir)) ?? "", ms = Date.now() - t0;
  ok(ms < 5000 && many.includes("`docs/n999.md`") && many.includes("leaves"), `the step reads 1,000 files that name an old path, none marked, in ${ms} ms, and names each as left`, many.slice(0, 300));
  fs.rmSync(path.join(moveDir, "docs"), { recursive: true });
}
// (the same where the copy stands at another path: the paths the step names, and the patterns of a copies config it reads,
// are that path's, in what it says too: #628)
{
  const dir = path.join(tmp, "vendored-moved-project"), put = (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
  const step = STEPS.find(x => x.lead === "16 November 2026, the rules in folders that say who reads them or when");
  put("core-manifest.md", `# Core manifest\n\nCore: ${CORE} at ${PIN}, copied whole under vendor/core/ (never edited here).\nPaths: in the core's files, one into floor/, roles/, tasks/, tools/, scripts/, setup/ or archive/ is under vendor/core/; any other is ours.\n`);
  put("AGENTS.md", "# A project\n\n@vendor/core/modules/work-flow.md\n");
  put("config/copies.json", `{\n  "prose": [\n    "vendor/core/floor/*.md",\n    "vendor/core/modules/*.md"\n  ]\n}\n`);
  put("core/notes.md", "A file of the project's own, which names vendor/core/modules/how-to-work.md.\n");
  put("core/AGENTS.md", "A rule file of the project's own, which names vendor/core/modules/inbox.md.\n");
  execFileSync("git", ["init", "-q"], { cwd: dir });
  const said = notDone(dir, [step])[0]?.mend ?? "";
  ok(said.includes("`vendor/core/modules/work-flow.md` is now `vendor/core/roles/shared/work-flow.md` (in `AGENTS.md`)") && said.includes('after the pattern "vendor/core/modules/*.md" add the patterns "vendor/core/floor/topics/*.md", "vendor/core/roles/*.md"') && said.includes("`core/notes.md`") && said.includes("`core/AGENTS.md`") && !/(?<![\w/-])core\//.test(said.replaceAll("`core/notes.md`", "").replaceAll("`core/AGENTS.md`", "")),
    "where the copy stands at another path, the step reads a copies config's patterns at it and names the files and patterns by it, and a file of the project's own that stands at core/ by its own name", said);
}
// the files that point from the paths the rules left: each names a file or a folder the core holds, and what one says
// stands elsewhere than the rest of it stands there
const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const there = to => fs.existsSync(path.join(coreRoot, to)) && fs.statSync(path.join(coreRoot, to)).isDirectory() === to.endsWith("/");
ok(Object.keys(moved()).length > 0 && Object.values(moved()).every(there) && Object.values(moved.apart()).flat().every(a => there(a.to) && fs.readFileSync(path.join(coreRoot, a.to), "utf8").includes(`**${a.lead}**`)),
  "each file at a path the rules left names a file or a folder that stands, and a rule it says stands elsewhere stands there", JSON.stringify([moved(), moved.apart()]));

done("steps-files");
