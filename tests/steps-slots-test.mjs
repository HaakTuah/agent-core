// Tests steps.mjs on projects the starter kit of this commit writes in a scratch folder (init.mjs's `files`, each a git
// repository with nothing committed) where a slot, a trigger or a mark stands otherwise than the kit writes it: a slot
// whose row names a file of the project's own, a pull request's trigger in each form GitHub takes, a size marks file the
// reading-size check cannot read, a step left undone on the owner's word, the proof that a pull request is queue-only
// and a check that cannot read the project. Node's own modules and git.
//
//   node tests/steps-slots-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { STAGES } from "../scripts/steps-stage.mjs";
import { kitIn, only, declare } from "../scripts/steps-kit.mjs";
import { COST, notDone, plain, report } from "../scripts/steps.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-slots-");
const kit = kitIn(tmp);

const dirs = Object.fromEntries(Object.entries({ "an-npm-project": { packages: "." }, "a-dotnet-project": { nuget: "src", private: true } }).map(([name, o]) => [name, kit(name, o, { held: false })]));
const lockProject = dirs["an-npm-project"];

// ---- a slot whose row names a file of the project's own, not the kit's: the step reads that file, its mend names it ----
{
  const at = dirs["a-dotnet-project"], manifest = path.join(at, "core-manifest.md"), was = fs.readFileSync(manifest, "utf8");
  const slot = row => fs.writeFileSync(manifest, was.replace("| *large file* |", `${row}\n| *large file* |`));
  const write = (f, text) => { fs.mkdirSync(path.dirname(path.join(at, f)), { recursive: true }); fs.writeFileSync(path.join(at, f), text); };
  // (the shape check: its config at the row's path reads done; gone from there, it is reported by that path, though the
  // kit's path still holds one)
  const shape = only("16 November 2026, how code is put together"), kitShape = fs.readFileSync(path.join(at, "checks/shape.json"), "utf8");
  slot("| *shape check* | `core/scripts/shape.mjs` with `config/shape.json` |");
  write("config/shape.json", kitShape);
  const shapeThere = notDone(at, shape);
  fs.rmSync(path.join(at, "config"), { recursive: true });
  const shapeGone = notDone(at, shape);
  ok(!shapeThere.length && shapeGone.length === 1 && shapeGone[0].mend.includes("`config/shape.json`") && !shapeGone[0].mend.includes("checks/shape.json"),
    "a *shape check* row that names a config of its own: the step reads that config, and where it is gone says so by its path, never reading the kit's", `${report(shapeThere)}\n${report(shapeGone)}`);
  // (the choice records: a record that lacks its lines is read at the row's path, and one at the kit's path is not read)
  const today = only("17 November 2026, what the project would be built on today"), lacking = "# Choices\n\n## Choice: the database\n\nWe picked one.\n";
  slot("| *choice records* | `docs/decisions.md` |");
  write("docs/decisions.md", lacking);
  const choicesThere = notDone(at, today);
  fs.rmSync(path.join(at, "docs/decisions.md"));
  const kitChoices = fs.readFileSync(path.join(at, "docs/choices.md"), "utf8");
  write("docs/choices.md", lacking);
  const choicesAtKit = notDone(at, today);
  write("docs/choices.md", kitChoices);
  ok(choicesThere.length === 1 && choicesThere[0].mend.includes("`docs/decisions.md`") && !choicesAtKit.length,
    "a *choice records* row that names a file of its own: the step reads that file and its mend names it, and the kit's path is not read", `${report(choicesThere)}\n${report(choicesAtKit)}`);
  // (records that stand a file each in a folder the file names, #870: the step reads them, the lacking one reported)
  write("docs/decisions.md", "# Choices\n\nIts records stand in `docs/decisions/`, a file each, read in the order of their names.\n");
  write("docs/decisions/010-the-database.md", "## Choice: the database\n\nWe picked one.\n");
  const choicesInFolder = notDone(at, today);
  fs.rmSync(path.join(at, "docs/decisions"), { recursive: true }); fs.rmSync(path.join(at, "docs/decisions.md"));
  ok(choicesInFolder.length === 1 && choicesInFolder[0].mend.includes("`docs/decisions.md`"), "records in a folder the row's file names are read by the step, one that lacks its lines reported", report(choicesInFolder));
  // (the progress file: one past a quarter of the general mark, with no mark of its own, is reported by the row's path;
  // the kit's path, however long, is not read)
  const progress = only("15 November 2026, the progress file holds order only"), kitProgress = fs.readFileSync(path.join(at, "docs/PROGRESS.md"), "utf8");
  fs.writeFileSync(manifest, was.replace("| *progress file* | `docs/PROGRESS.md` |", "| *progress file* | `PLAN.md` |"));
  write("PLAN.md", "- #1 a line\n".repeat(1000));
  const progressThere = notDone(at, progress);
  write("PLAN.md", "- #1 a line\n");
  write("docs/PROGRESS.md", "- #1 a line\n".repeat(1000));
  const progressAtKit = notDone(at, progress);
  write("docs/PROGRESS.md", kitProgress);
  fs.rmSync(path.join(at, "PLAN.md"));
  ok(progressThere.length === 1 && progressThere[0].mend.includes("Trim `PLAN.md`") && !progressAtKit.length,
    "a *progress file* row that names a file of its own: the step reads that file and its mend names it, and the kit's path is not read", `${report(progressThere)}\n${report(progressAtKit)}`);
  fs.writeFileSync(manifest, was);
  ok(!notDone(at).length, "and the project as it was reads every step done again", report(notDone(at)));
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
  ok(missed.length === 3 && missed[0].lead.startsWith("14 November 2026, the size marks") && missed[0].mend.includes("did not run to its end")
    && missed[1].lead.startsWith("15 November 2026, the progress file") && missed[1].mend.includes("could not read the project")
    && missed[2].lead.startsWith("24 November 2026, the size marks read") && missed[2].mend.includes("could not read the project"), `size marks of ${what} are reported as not read, by each of the three steps that read them`, report(missed));
}
fs.writeFileSync(marksFile, marksAsKit);

// ---- the core's part of AGENTS.md as the step of the start reads it (#1272, point 4): within its marks; with none, as a
// kit wrote it before them, its imports of the copy; marks it cannot tell apart, said not read, never done ----
{
  const start = "24 November 2026, the size marks read what the core's part imports", agents = path.join(lockProject, "AGENTS.md"), agentsAsKit = fs.readFileSync(agents, "utf8");
  const [BEGIN, END] = ["<!-- The core's part: a sync writes it; write yours outside. -->", "<!-- The core's part ends. -->"];
  const unmarked = agentsAsKit.replace(`${BEGIN}\n`, "").replace(`${END}\n`, "");
  const marks = JSON.parse(marksAsKit), without = { ...marks, read: Object.fromEntries(Object.entries(marks.read).filter(([f]) => f !== "core/roles/builder.md")) };
  ok(agentsAsKit.includes(BEGIN) && unmarked !== agentsAsKit, "(the kit's AGENTS.md holds the core's marks)");
  fs.writeFileSync(agents, unmarked);
  ok(!notDone(lockProject).some(s => s.lead === start), "an AGENTS.md with no marks, its imports all named under \"read\", reads done", report(notDone(lockProject)));
  fs.writeFileSync(marksFile, `${JSON.stringify(without, null, 2)}\n`);
  let missed = notDone(lockProject).filter(s => s.lead === start);
  ok(missed.length === 1 && missed[0].mend.includes("`core/roles/builder.md`"), "and with one it imports left out of \"read\", names that file", report(missed));
  fs.writeFileSync(agents, `${agentsAsKit}\n${BEGIN}\n`);
  missed = notDone(lockProject).filter(s => s.lead === start);
  ok(missed.length === 1 && missed[0].mend.includes("could not read the project"), "marks given twice are said not read, never done", report(missed));
  fs.writeFileSync(agents, agentsAsKit.replace(/\n/g, "\r\n"));
  missed = notDone(lockProject).filter(s => s.lead === start);
  ok(missed.length === 1 && missed[0].mend.includes("`core/roles/builder.md`") && !missed[0].mend.includes("core/floor/security.md"), "an AGENTS.md with Windows line ends is read as one with Unix ones", report(missed));
  fs.writeFileSync(agents, agentsAsKit); fs.writeFileSync(marksFile, marksAsKit);
}

// ---- a step left undone on purpose, on the owner's word: declared, not reported ----
const sec = STAGES["12 November 2026, the security review shown on every pull request"];
sec.stage(lockProject);
ok(notDone(lockProject).length === 1, "a project with no security-review workflow is reported", report(notDone(lockProject)));
declare(lockProject, '"12 November 2026, the security review shown on every pull request": not wanted here, the owner said (a private repository).');
ok(!notDone(lockProject).length, "until its manifest's \"Differences\" quotes the step's lead, on the owner's word");
sec.mend(lockProject);

// ---- the proof that a pull request is queue-only (#750): read whole, at the review's pin, its job kept running ----
{
  const QUEUE_LEAD = "19 November 2026, a pull request of the progress file alone proved by a script", flow = path.join(lockProject, ".github/workflows/security-review.yml"), was = fs.readFileSync(flow, "utf8");
  const queueAsked = change => { fs.writeFileSync(flow, change(was)); const said = notDone(lockProject, only(QUEUE_LEAD)).some(m => m.lead === QUEUE_LEAD); fs.writeFileSync(flow, was); return said; };
  ok(!queueAsked(t => t) && queueAsked(t => t.replace(/(queue-only\.yml@)\w+/, "$1main")) && queueAsked(t => t.replace("      issues: read\n", ""))
    && queueAsked(t => t.replace("    if: ${{ !cancelled() }}\n", "")) && queueAsked(t => t.replace("    needs: queue\n", "")) && queueAsked(t => t.replace("needs.queue.outputs.head", "needs.queue.outputs.other"))
    && !queueAsked(t => t.replace("if: ${{ !cancelled() }}", "if: ${{ always() && github.event_name != 'push' }}")),
    "a caller of the security review is asked the queue job unless it calls queue-only.yml at the review's pin, may read issues, and the review's job needs it, takes its head and runs where it is skipped");
}

// ---- a check that cannot read the project is reported, never read as done ----
const throwing = [{ lead: "a step", cost: COST.check, check: () => { throw new Error("cannot read it"); } }];
ok(notDone(lockProject, throwing)[0]?.mend.includes("could not read the project"), "a check that throws is reported as not read, never as done");
const leaked = plain(`ENOENT: no such file, open '${path.join(lockProject, "x")}' and '${path.join(os.tmpdir(), "y")}' and '${path.join(os.homedir(), "z")}'`, lockProject);
ok(!leaked.includes(lockProject) && !leaked.includes(os.tmpdir()) && !leaked.includes(os.homedir()) && leaked.includes("<the project>"), "an error's words carry no path of the machine's into what a sync prints", leaked);

done("steps-slots");
