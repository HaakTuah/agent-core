// Tests steps.mjs and fresh.mjs (what a release asks of a project, and a project beside a fresh start) on projects the
// starter kit of this commit writes in a scratch folder (init.mjs's `files`, read from the working folder), each a git
// repository with nothing committed. Node's own modules and git.
//
//   node scripts/steps-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { differences, fresh, kind, report as freshReport } from "./fresh.mjs";
import { READ, TEMPLATES, files, licences, sizes } from "./init.mjs";
import { notes as manifestNotes } from "./manifest-reads.mjs";
import { NOTES } from "./releases.mjs";
import { STAGES } from "./steps-stage.mjs";
import { pathsLetThrough } from "./workflow-run.mjs";
import { COST, STEPS, configs, leads, notDone, plain, project, report, runsOwn } from "./steps.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "steps-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const PIN = "a".repeat(40);
const modules = fs.readdirSync(path.join(root, "modules")).filter(n => n.endsWith(".md"));
const texts = dir => Object.fromEntries(fs.readdirSync(path.join(root, dir)).filter(n => n.endsWith(".md")).map(n => [n, fs.readFileSync(path.join(root, dir, n), "utf8")]));

// ---- every entry of the sync notes has its step, and each step is told done one way ----
const notes = leads(fs.readFileSync(path.join(root, NOTES), "utf8"));
ok(notes.length > 0 && JSON.stringify(notes) === JSON.stringify(STEPS.map(s => s.lead)), `every entry of ${NOTES} has its step in steps.mjs, in the same order, and no step stands without one`,
  `entries without a step: ${notes.filter(l => !STEPS.some(s => s.lead === l)).join("; ") || "none"}\nsteps without an entry: ${STEPS.filter(s => !notes.includes(s.lead)).map(s => s.lead).join("; ") || "none"}`);
const ways = STEPS.filter(s => [s.check, s.held, s.unread].filter(Boolean).length !== 1 || !Object.values(COST).includes(s.cost));
ok(!ways.length, "each step is told done one way (a check, a check of the project's that holds it, or why none reads it) and says what it costs", ways.map(s => s.lead).join("\n"));
const unstaged = STEPS.filter(s => s.check && !STAGES[s.lead]).map(s => s.lead);
ok(!unstaged.length && Object.keys(STAGES).every(l => STEPS.some(s => s.lead === l && s.check)), "each step with a check has a stage and a mend in steps-stage.mjs, so the tests can take it out and put it back", unstaged.join("\n"));

// ---- a project the starter kit writes: every step done, no difference from a fresh start ----
function kit(name, o) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  for (const [to, text] of files({ owner: "someone-else", name, ...o }, PIN, modules, n => fs.readFileSync(path.join(root, TEMPLATES, n), "utf8"))) {
    fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true });
    fs.writeFileSync(path.join(dir, to), text);
  }
  fs.mkdirSync(path.join(dir, "checks"), { recursive: true });
  fs.writeFileSync(path.join(dir, "checks/licences.json"), `${JSON.stringify(licences(o, () => false), null, 2)}\n`);
  // (the copy of the core the project holds, as far as its checks read it, and the size marks the kit writes for it)
  for (const part of ["floor", "modules", "scripts", "setup"]) fs.cpSync(path.join(root, part), path.join(dir, "core", part), { recursive: true });
  fs.writeFileSync(path.join(dir, "checks/sizes.json"), `${JSON.stringify(sizes(Object.fromEntries(READ.map(f => [f, fs.statSync(path.join(dir, f)).size]))), null, 2)}\n`);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "checks/copies-baseline.json"), "{\n  \"windows\": {}\n}\n");
  fs.writeFileSync(path.join(dir, "checks/shape-baseline.json"), "{\n  \"listed\": {}\n}\n");
  return dir;
}
const kinds = { "an-npm-project": { packages: "." }, "a-dotnet-project": { nuget: "src", private: true }, "a-game": { packages: "web", game: true } };
const dirs = Object.fromEntries(Object.entries(kinds).map(([name, o]) => [name, kit(name, o)]));
for (const [name, dir] of Object.entries(dirs)) {
  const missed = notDone(dir);
  ok(!missed.length && report(missed).startsWith("Every step a check reads is done"), `${name}, as the starter kit writes it: no step is reported not done`, report(missed));
  const p = project(dir);
  const { o } = kind(p);
  ok(o.owner === "someone-else" && o.name === name && o.packages === kinds[name].packages && o.nuget === kinds[name].nuget && !!o.private === !!kinds[name].private && !!o.game === !!kinds[name].game,
    `${name}: its kind is read from what it holds, as the starter kit was told it`, JSON.stringify(o));
  const found = differences(p, fresh(p));
  ok(!found.length && freshReport(found).includes("no difference"), `${name}: beside a fresh start, no difference`, found.join("\n"));
  // (the core's own manifest check, on the modules and floor of this commit: a slot a module it takes uses, with no row,
  // would be a note on the project's first day, #329)
  const slotNotes = manifestNotes({ manifest: p.manifest, readme: fs.readFileSync(path.join(root, "README.md"), "utf8"), moduleTexts: texts("modules"), floorTexts: texts("floor") });
  ok(!slotNotes.length, `${name}: its manifest takes or leaves out each module and fills each slot they use, so the manifest check gives no note`, slotNotes.join("\n"));
}

// ---- each step taken out: exactly it is reported, with its mend; the mend as written makes it done ----
const dir = dirs["a-dotnet-project"];
for (const step of STEPS.filter(s => s.check)) {
  STAGES[step.lead].stage(dir);
  const missed = notDone(dir);
  ok(missed.length === 1 && missed[0].lead === step.lead && missed[0].mend.length > 20 && missed[0].cost === step.cost, `taken out, "${step.lead}" is reported, alone, with its mend and cost`, report(missed));
  STAGES[step.lead].mend(dir);
  ok(!notDone(dir).length, `and its mend as written makes it done`, report(notDone(dir)));
  STAGES[step.lead].after?.(dir);
}
// several at once, in a project of another kind: exactly those
const lockProject = dirs["an-npm-project"];
const some = STEPS.filter(s => s.check).filter((_, i) => i % 2 === 0).map(s => s.lead);
for (const lead of some) STAGES[lead].stage(lockProject);
ok(JSON.stringify(notDone(lockProject).map(m => m.lead)) === JSON.stringify(some), "several taken out at once are reported, exactly those", report(notDone(lockProject)));
// (in the order steps-stage.mjs lists them, the one whose mend lists what the others write last)
for (const lead of Object.keys(STAGES).filter(l => some.includes(l))) STAGES[lead].mend(lockProject);
ok(!notDone(lockProject).length, "and their mends make every one done");
for (const lead of some) STAGES[lead].after?.(lockProject);

// ---- a suite's path filter, read as GitHub reads one: `?` and `+` repeat the character before them (#379) ----
const SUITE_LEAD = "12 November 2026, a sync and the project's own suites";
const suiteFile = path.join(lockProject, ".github/workflows/suites-filtered.yml");
const suiteBy = filter => { fs.writeFileSync(suiteFile, `name: s\non:\n  pull_request:\n${filter}\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo t\n`); return notDone(lockProject).some(m => m.lead === SUITE_LEAD); };
ok(suiteBy("    paths: ['.github/workflows/core.ya?ml']") && suiteBy("    paths: ['.github/workflows/co+re.yml']") && !suiteBy("    paths: ['.github/workflows/core\\?.yml']")
  && suiteBy("    paths-ignore: ['core/**']") && !suiteBy("    paths: ['src/**']"), "a suite whose filter starts on a call's file alone is reported, its `?` and `+` read as GitHub reads them");
fs.rmSync(suiteFile);
ok(pathsLetThrough(["+x.yml"], ["+x.yml"]) && pathsLetThrough(["?y.yml"], ["?y.yml"]) && pathsLetThrough(["a[b.yml"], ["a[b.yml"])
  && pathsLetThrough(["c]d.yml"], ["c]d.yml"]) && pathsLetThrough(["dir/+e"], ["dir//e"]) && !pathsLetThrough(["a[b.yml"], ["ab.yml"]),
  "a filter's `?` or `+` with nothing before it, and a lone `[` or `]`, is read as itself, and one after a character repeats it, as GitHub reads them");
{
  // (patterns that would keep a backtracking expression busy for minutes, each read at once)
  const began = Date.now(), long = `.github/workflows/${"a".repeat(200)}.yml`;
  const quick = [["**a+a+a+a+a+a+a+b", long], [`${"*".repeat(30)}z`, ".github/workflows/core.yml"], ["*a+a+a+a+a+a+a+a+a+a+b", "a".repeat(500)], ["**/**/**/**/**/x", `${"a/".repeat(300)}y`]]
    .every(([pattern, name]) => !pathsLetThrough([pattern], [name]));
  const reported = suiteBy("    paths: ['*a+a+a+a+a+a+a+a+a+b', '.github/workflows/**']");
  ok(quick && reported && Date.now() - began < 3000, "a filter that would keep a backtracking expression busy is read at once, and read right", `${Date.now() - began} ms`);
  fs.rmSync(suiteFile);
}

// ---- a pull request's trigger in each form GitHub takes: one name, a list, a mapping ----
const signatures = path.join(lockProject, ".github/workflows/signatures.yml");
const asKit = fs.readFileSync(signatures, "utf8");
for (const form of ["on: pull_request", "on: [pull_request, push]"]) {
  fs.writeFileSync(signatures, asKit.replace(/^on:\n  pull_request:\n/m, `${form}\n`));
  ok(!notDone(lockProject).length, `a signature workflow with "${form}" runs on every pull request, and reads done`, report(notDone(lockProject)));
}
fs.writeFileSync(signatures, asKit.replace(/^on:\n  pull_request:\n/m, "on: [push]\n"));
ok(notDone(lockProject).length === 1, "one that is not started by a pull request is reported", report(notDone(lockProject)));
fs.writeFileSync(signatures, asKit);

// ---- a size marks file the reading-size check cannot read: each step that reads it is reported as not read, never as done ----
const marksFile = path.join(lockProject, "checks/sizes.json"), marksAsKit = fs.readFileSync(marksFile, "utf8");
for (const [broken, what] of [["{ not json", "no JSON"], ['{"each": 1}', "the wrong shape"], ["\nFAIL: x\n", "no JSON, a line of which reads as a verdict"]]) {
  fs.writeFileSync(marksFile, broken);
  const missed = notDone(lockProject);
  ok(missed.length === 2 && missed[0].lead.startsWith("14 November 2026, the size marks") && missed[0].mend.includes("did not run to its end")
    && missed[1].lead.startsWith("15 November 2026, the progress file") && missed[1].mend.includes("could not read the project"), `size marks of ${what} are reported as not read, by both steps that read them`, report(missed));
}
fs.writeFileSync(marksFile, marksAsKit);

// ---- rule 5's inputs as SECURITY.md lists them: "None", items naming their tests, nested and wrapped lines ----
const inputs = STEPS.filter(s => s.lead === "16 November 2026, hostile tests for every named input");
const secFile = path.join(lockProject, "SECURITY.md"), secAsKit = fs.readFileSync(secFile, "utf8");
const rule5 = body => { fs.writeFileSync(secFile, secAsKit.replace(/^(5\. .*\n)(?:(?!\d+\. |#).*\n)*/m, `$1${body}`)); return notDone(lockProject, inputs); };
fs.mkdirSync(path.join(lockProject, "tests/hostile"), { recursive: true });
fs.writeFileSync(path.join(lockProject, "tests/hostile/link.test.mjs"), "\n");
ok(!rule5("   None: it takes no input but its user's.\n").length, "rule 5 that says \"None\" names no input, and reads done");
ok(!rule5("   - a shared link: its parts checked against their shape,\n     its hostile tests: `tests/hostile/link.test.mjs`.\n     - its query string, read by the same check.\n").length,
  "an item that names, on a wrapped line, a file that is there reads done, the item nested in it part of it");
ok(!rule5("   - a shared link: its hostile tests in `tests/hostile/`.\n").length, "a folder that is there counts as named");
fs.mkdirSync(path.join(lockProject, "src"), { recursive: true });
fs.writeFileSync(path.join(lockProject, "src/peer.mjs"), "\n");
let missedInputs = rule5("   - a shared link: hostile tests: `tests/hostile/link.test.mjs`.\n   - a peer's message: checked on arrival by `src/peer.mjs`; hostile tests: `tests/hostile/peer.test.mjs`.\n");
ok(missedInputs.length === 1 && missedInputs[0].mend.includes("a peer's message") && !missedInputs[0].mend.includes("a shared link"),
  "an item whose hostile tests are not there is reported, by its words, and only it, though the file of what checks it is there", report(missedInputs));
missedInputs = rule5("   - a shared link: hostile tests: `tests/hostile/link.test.mjs`.\n   - a peer's message: hostile tests: FILL IN\n");
ok(missedInputs.length === 1 && missedInputs[0].mend.includes("a peer's message") && !missedInputs[0].mend.includes("a shared link"),
  "a \"FILL IN\" left in one item reads no other item as done: the item it stands in is reported", report(missedInputs));
missedInputs = rule5("   Each message a peer sends, its size checked.\n");
ok(missedInputs.length === 1 && missedInputs[0].mend.includes("as an item of its own"), "inputs written as a paragraph, no item in it, are reported, the mend saying to list them", report(missedInputs));
fs.writeFileSync(secFile, secAsKit.replace(/^5\. .*\n/m, ""));
ok(notDone(lockProject, inputs)[0]?.mend.includes("could not read the project"), "a SECURITY.md with no rule 5 is reported as not read, never as done");
fs.writeFileSync(secFile, secAsKit);
// (only what this block wrote goes: an earlier stage's mend may have written its own tests there)
for (const f of ["tests/hostile/link.test.mjs", "src/peer.mjs"]) fs.rmSync(path.join(lockProject, f));

// ---- a step left undone on purpose, on the owner's word: declared, not reported ----
const declare = (d, line) => fs.writeFileSync(path.join(d, "core-manifest.md"), fs.readFileSync(path.join(d, "core-manifest.md"), "utf8").replace(/^## Differences\n+None\.\n?/m, `## Differences\n- ${line}\n`));
const sec = STAGES["12 November 2026, the security review shown on every pull request"];
sec.stage(lockProject);
ok(notDone(lockProject).length === 1, "a project with no security-review workflow is reported", report(notDone(lockProject)));
declare(lockProject, '"12 November 2026, the security review shown on every pull request": not wanted here, the owner said (a private repository).');
ok(!notDone(lockProject).length, "until its manifest's \"Differences\" quotes the step's lead, on the owner's word");
sec.mend(lockProject);

// ---- a check that cannot read the project is reported, never read as done ----
const throwing = [{ lead: "a step", cost: COST.check, check: () => { throw new Error("cannot read it"); } }];
ok(notDone(lockProject, throwing)[0]?.mend.includes("could not read the project"), "a check that throws is reported as not read, never as done");
const leaked = plain(`ENOENT: no such file, open '${path.join(lockProject, "x")}' and '${path.join(os.tmpdir(), "y")}' and '${path.join(os.homedir(), "z")}'`, lockProject);
ok(!leaked.includes(lockProject) && !leaked.includes(os.tmpdir()) && !leaked.includes(os.homedir()) && leaked.includes("<the project>"), "an error's words carry no path of the machine's into what a sync prints", leaked);

// ---- beside a fresh start: each kind of difference is listed, and a declared file is not compared ----
const game = dirs["a-game"];
const agents = path.join(game, "AGENTS.md");
fs.writeFileSync(agents, fs.readFileSync(agents, "utf8").replace(/\n## Starting a task\n[\s\S]*?\n## Commands/, "\n## Commands").replace("These whole", "these whole")
  .replace(/at\nthe start of every task\./, "at the start\n  of every task."));
fs.rmSync(path.join(game, ".github/workflows/look.yml"));
const wf = path.join(game, ".github/workflows/copies.yml");
fs.writeFileSync(wf, fs.readFileSync(wf, "utf8").replace(/@[0-9a-f]{40}/g, `@${"b".repeat(40)}`));
const manifest = path.join(game, "core-manifest.md");
fs.writeFileSync(manifest, fs.readFileSync(manifest, "utf8").replace(/^\| \*large file\* \|.*\n/m, "").replace("| `docs/PROGRESS.md` |", "| `PLAN.md` |"));
const cfg = path.join(game, "checks/copies.json");
fs.writeFileSync(cfg, JSON.stringify({ baseline: "checks/copies-baseline.json", code: ["src"] }, null, 2));
let found = differences(project(game), fresh(project(game)));
const has = (file, what) => found.some(d => d.startsWith(`${file}:`) && d.includes(what));
ok(found.length === 4 && has("AGENTS.md", "Starting a task") && has(".github/workflows/look.yml", "missing") && has("core-manifest.md", "the row \"*large file*\"") && has("checks/copies.json", "the key \"prose\""),
  "a paragraph, a file, a table's row and a config's key that the project lacks are listed; a reflowed line, a row's own value and a pin moved are no difference", found.join("\n"));
declare(game, '"AGENTS.md": its own way of starting a task, on the owner\'s word.');
found = differences(project(game), fresh(project(game)));
ok(found.length === 3 && !found.some(d => d.startsWith("AGENTS.md:")), "a file the manifest's \"Differences\" quotes is not compared", found.join("\n"));

// ---- a project that lost its hooks' settings or its signature check: listed, however little of it is left ----
const bare = kit("a-bare-npm-project", { packages: "." });
fs.writeFileSync(path.join(bare, "package-lock.json"), "{}\n");
fs.writeFileSync(path.join(bare, ".claude/settings.json"), '{"permissions": {}, "hooks": {}}\n');
fs.rmSync(path.join(bare, ".github/workflows/signatures.yml"));
found = differences(project(bare), fresh(project(bare)));
ok(found.some(d => d.startsWith(".claude/settings.json: lacks") && d.includes("Edit(//**/.git/**)")) && found.includes(".github/workflows/signatures.yml: missing (the starter kit writes it today)"),
  "hooks' settings emptied, and a signature check lost from an npm project, are listed (its packages read from its lock file too)", found.join("\n"));

// ---- the configs the kit writes beside its templates, and a workflow the core's reader cannot read ----
const plainProject = kit("a-plain-project", {});
fs.rmSync(path.join(plainProject, "checks/sizes.json"));
fs.writeFileSync(path.join(plainProject, "checks/copies-baseline.json"), "{}\n");
found = differences(project(plainProject), fresh(project(plainProject)));
ok(found.includes("checks/sizes.json: missing (the starter kit writes it today)") && found.some(d => d.startsWith("checks/copies-baseline.json: lacks the key \"windows\"")) && found.length === 2,
  "a config the kit writes beside its templates, missing or lacking a key, is listed", found.join("\n"));
const secWorkflow = path.join(plainProject, ".github/workflows/security-review.yml");
fs.writeFileSync(secWorkflow, fs.readFileSync(secWorkflow, "utf8").replace(/^jobs:/m, "env: {SAMPLE: value}\n\njobs:"));
const unread = notDone(plainProject);
const unreadSec = unread.find(m => m.lead.endsWith("the security review shown on every pull request"));
ok(unreadSec?.mend.includes("could not read the project") && unreadSec.mend.includes("security-review.yml") && unread.every(m => m.mend.includes("could not read the project")),
  "a workflow in a form the core's reader does not know is reported as not read, never as a call that is missing or a step done", report(unread));

// ---- a path a project's own file names is read only inside the project ----
fs.writeFileSync(path.join(plainProject, "checks/copies.json"), JSON.stringify({ baseline: "../a-game/checks/copies-baseline.json", code: [], prose: [], proseFromSecurity: true }));
found = differences(project(plainProject), fresh(project(plainProject)));
ok(found.includes("../a-game/checks/copies-baseline.json: missing (the starter kit writes it today)") && project(plainProject).read("../a-game/AGENTS.md") === null,
  "a path that leads out of the project reads as missing, never as another folder's file", found.join("\n"));

// ---- a NuGet project set up at its root, its project file nested; a difference declared: neither is a difference ----
const rootNuget = kit("a-root-nuget-project", { nuget: ".", private: true });
fs.mkdirSync(path.join(rootNuget, "src/App"), { recursive: true });
fs.writeFileSync(path.join(rootNuget, "src/App/App.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\" />\n");
ok(kind(project(rootNuget)).o.nuget === ".", "a NuGet project whose Dependabot directory is the root reads as one set up at its root", kind(project(rootNuget)).o.nuget);
declare(rootNuget, '"AGENTS.md": its own way of starting a task, on the owner\'s word.');
found = differences(project(rootNuget), fresh(project(rootNuget)));
ok(!found.length, "a manifest whose \"Differences\" declares something, in place of the kit's \"None.\", is no difference", found.join("\n"));

// ---- the wording an earlier kit wrote and the kit has left: listed where the project still holds it ----
const older = path.join(tmp, "older", "setup", "template");
fs.cpSync(path.join(root, TEMPLATES), older, { recursive: true });
const LEFT = "Every builder reads the old way of starting a task, which the core has since left.";
fs.writeFileSync(path.join(older, "AGENTS.md.tmpl"), fs.readFileSync(path.join(older, "AGENTS.md.tmpl"), "utf8").replace("## Commands", `${LEFT}\n\n## Commands`));
fs.writeFileSync(path.join(older, "core-manifest.md.tmpl"), fs.readFileSync(path.join(older, "core-manifest.md.tmpl"), "utf8").replace("| *large file* |", "| *old slot* | gone |\n| *large file* |"));
const another = kit("another-npm-project", { packages: "." });
const npmAgents = path.join(another, "AGENTS.md");
const p0 = project(another), olderKit = fresh(p0, older);
ok(olderKit.length > 0 && !differences(p0, fresh(p0), [olderKit]).length, "an earlier kit whose wording the project does not hold adds no difference");
fs.writeFileSync(npmAgents, fs.readFileSync(npmAgents, "utf8").replace("## Commands", `${LEFT}\n\n## Commands`));
fs.writeFileSync(path.join(another, "core-manifest.md"), fs.readFileSync(path.join(another, "core-manifest.md"), "utf8").replace("| *large file* |", "| *old slot* | gone |\n| *large file* |"));
const p1 = project(another);
found = differences(p1, fresh(p1), [olderKit, olderKit]);
ok(found.length === 2 && found.some(d => d.startsWith("AGENTS.md: still holds the paragraph \"Every builder reads") && d.includes("no longer writes")) && found.some(d => d.startsWith("core-manifest.md: still holds the row \"*old slot*\"")),
  "a paragraph and a row an earlier kit wrote that the kit no longer writes, still held, are listed once each", found.join("\n"));
ok(!fresh(p1, path.join(tmp, "nowhere")).length, "an earlier copy with no starter kit gives no kit to compare");
fs.rmSync(path.join(older, "choices.md.tmpl"));
const lacks = fresh(p1, older);
ok(lacks.length === olderKit.length - 1 && !lacks.some(([to]) => to === "docs/choices.md") && differences(p1, fresh(p1), [lacks]).length === 2,
  "an earlier kit that lacks a template added since still gives its other files to compare", lacks.map(([to]) => to).join());

// ---- a project that runs the copies and licence checks from a workflow of its own, its configs at paths of its own ----
// (#366: each step and each difference names the files it holds; #364: a comment that names a script is no run of it)
const ownDir = kit("own-configs", { nuget: "src", private: true });
const move = (from, to) => { fs.mkdirSync(path.dirname(path.join(ownDir, to)), { recursive: true }); fs.renameSync(path.join(ownDir, from), path.join(ownDir, to)); };
for (const [from, to] of [["checks/licences.json", "config/licences.json"], ["checks/licences-audit.json", "config/audit.json"], ["checks/copies.json", "config/copies.json"], ["checks/copies-baseline.json", "config/copies-base.json"]]) move(from, to);
const rewrite = (file, edit) => fs.writeFileSync(path.join(ownDir, file), edit(fs.readFileSync(path.join(ownDir, file), "utf8")));
rewrite("config/licences.json", t => { const { nuget, ...rest } = JSON.parse(t); return JSON.stringify({ ...rest, audit: "config/audit.json" }, null, 2); });
rewrite("config/copies.json", t => t.replace('"checks/copies-baseline.json"', '"config/copies-base.json"'));
rewrite("core-manifest.md", t => t.replace("`core/scripts/copies.mjs` with `checks/copies.json`", "`core/scripts/copies.mjs` with `config/copies.json`"));
for (const f of fs.readdirSync(path.join(ownDir, ".github/workflows"))) if (/^(copies|licences|nuget)\.yml$/.test(f)) fs.rmSync(path.join(ownDir, ".github/workflows", f));
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
const dotted = { files: [], read: () => null, manifest: "", workflows: { "a.yml": { text: "x", yaml: { jobs: { j: { steps: [{ run: "node ./core/scripts/licences.mjs a.json\nnode vendor/core/scripts/copies.mjs b.json" }] } } } } } };
ok(runsOwn(dotted, "licences.mjs").length === 1 && !runsOwn(dotted, "copies.mjs").length, "a script started as ./core/scripts/ is run; one under another folder's core/scripts/ is not the copy's");
// (the argument read as the shell reads it: past an option, through a line's continuation, quoted, and after a quoted
// script; and a slot read in its own cell, past the script and any command)
const passing = (run, manifest = "") => configs({ ...dotted, manifest, workflows: { "a.yml": { text: "x", yaml: { jobs: { j: { steps: [{ run }] } } } } } }).copies;
ok(passing("node core/scripts/copies.mjs --first config/c.json") === "config/c.json" && passing("node core/scripts/copies.mjs \\\n  config/c.json") === "config/c.json"
  && passing('node core/scripts/copies.mjs "config/my copies.json"') === "config/my copies.json" && passing('node "./core/scripts/copies.mjs" config/c.json') === "config/c.json"
  && passing("echo none", "| *copies check* | `node core/scripts/copies.mjs` with `config/s.json` | more `x.json` |\n") === "config/s.json",
  "an argument is read past an option, a line's continuation and quotes, and the slot in its own cell past the script");
ok(configs({ ...dotted, workflows: { "a.yml": { text: "x", yaml: { jobs: { j: { steps: [{ run: 'node core/scripts/copies.mjs "${{ inputs.c }}"' }] } } } } } }).copies === null, "a quoted argument that names it only when the workflow runs is not read");
ok(passing("# a note \\\nnode core/scripts/copies.mjs config/c.json") === "config/c.json", "a comment that ends in a backslash continues nothing, as the shell reads it");
let missedOwn = notDone(ownDir);
const nugetMend = missedOwn.find(m => m.lead === "13 November 2026, the NuGet check")?.mend ?? "";
ok(nugetMend.includes("`config/licences.json` has a \"nuget\" part") && !/checks\//.test(report(missedOwn)), "the NuGet step's mend names the licence config the project holds, never the starter kit's path", report(missedOwn));
ok(!missedOwn.some(m => m.lead === "16 November 2026, an agent's own tools listed"), "the agent-tools step reads the config the project passes, not the word after a comment that names the licence script", report(missedOwn));
const foundOwn = differences(ownP, fresh(ownP));
ok(!foundOwn.some(d => /^checks\//.test(d)) && JSON.stringify(foundOwn.filter(d => /^config\//.test(d))) === JSON.stringify(['config/licences.json: lacks the key "nuget"']),
  "beside a fresh start, the configs are compared where the project holds them, by their keys, and none at the kit's paths is called missing", foundOwn.join("\n"));
// (a copies config named only when the workflow runs leaves the licence config's paths read, and compared)
fs.writeFileSync(path.join(ownDir, ".github/workflows/checks.yml"), ownRun.replace("copies.mjs config/copies.json", 'copies.mjs "$COPIES"'));
const halfP = project(ownDir), half = configs(halfP);
ok(half.licences === "config/licences.json" && half.audit === "config/audit.json" && half.copies === null && half.baseline === null && fresh(halfP).some(([to]) => to === "config/licences.json") && !fresh(halfP).some(([to]) => /^(checks|config)\/copies/.test(to)),
  "a config one workflow names only when it runs leaves that check's paths unread, and the other check's read and compared", JSON.stringify(half));
ok(differences(halfP, fresh(halfP)).some(d => d.startsWith("a config not compared: ") && d.includes("$COPIES")), "and the differences say the config they did not compare, and why");
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
  && exprFound.filter(d => d.startsWith("a config not compared: ") && d.includes("${{ vars.")).length === 2 && !exprFound.some(d => /^(config|checks)\/|^\$\{\{/.test(d)),
  "a config a call passes as an expression is reported not read and compared nowhere, and the other configs read and compared", `${JSON.stringify(exprAt)}\n${exprFound.join("\n")}`);
// (with only a comment naming the script before it, the old reading took the comment's next word as the config)
fs.writeFileSync(path.join(ownDir, ".github/workflows/checks.yml"), ownRun.replace("          node core/scripts/agent-tools.mjs config/licences.json\n", ""));
missedOwn = notDone(ownDir);
const toolsMend = missedOwn.find(m => m.lead === "16 November 2026, an agent's own tools listed")?.mend ?? "";
ok(toolsMend.includes("runs `node core/scripts/agent-tools.mjs config/licences.json` beside it") && !/`(reads|takes)`/.test(toolsMend), "where it does not run the agent-tools check, the step's mend names the config the licence check is passed (#364)", toolsMend);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions`);
process.exitCode = failed ? 1 : 0;
