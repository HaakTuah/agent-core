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
import { NOTES } from "./releases.mjs";
import { STAGES } from "./steps-stage.mjs";
import { COST, STEPS, leads, notDone, plain, project, report } from "./steps.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "steps-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const PIN = "a".repeat(40);
const modules = fs.readdirSync(path.join(root, "modules")).filter(n => n.endsWith(".md"));

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
}

// ---- each step taken out: exactly it is reported, with its mend; the mend as written makes it done ----
const dir = dirs["a-dotnet-project"];
for (const step of STEPS.filter(s => s.check)) {
  STAGES[step.lead].stage(dir);
  const missed = notDone(dir);
  ok(missed.length === 1 && missed[0].lead === step.lead && missed[0].mend.length > 20 && missed[0].cost === step.cost, `taken out, "${step.lead}" is reported, alone, with its mend and cost`, report(missed));
  STAGES[step.lead].mend(dir);
  ok(!notDone(dir).length, `and its mend as written makes it done`, report(notDone(dir)));
}
// several at once, in a project of another kind: exactly those
const lockProject = dirs["an-npm-project"];
const some = STEPS.filter(s => s.check).filter((_, i) => i % 2 === 0).map(s => s.lead);
for (const lead of some) STAGES[lead].stage(lockProject);
ok(JSON.stringify(notDone(lockProject).map(m => m.lead)) === JSON.stringify(some), "several taken out at once are reported, exactly those", report(notDone(lockProject)));
for (const lead of some) STAGES[lead].mend(lockProject);
ok(!notDone(lockProject).length, "and their mends make every one done");

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

// ---- a step left undone on purpose, on the owner's word: declared, not reported ----
const declare = (d, line) => fs.writeFileSync(path.join(d, "core-manifest.md"), fs.readFileSync(path.join(d, "core-manifest.md"), "utf8").replace(/^## Differences\n+None\.\n?/m, `## Differences\n- ${line}\n`));
const sec = STAGES["12 November 2026, the security review shown on every pull request"];
sec.stage(lockProject);
ok(notDone(lockProject).length === 1, "a project with no security-review workflow is reported");
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

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions`);
process.exitCode = failed ? 1 : 0;
