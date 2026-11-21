// Tests steps.mjs (what a release asks of a project) on projects the starter kit of this commit writes in a scratch
// folder (init.mjs's `files`, read from the working folder), each a git repository with nothing committed: every entry
// of the sync notes has its step, every kit's project has every step done and no difference from a fresh start, and each
// step taken out is reported alone, with its mend, which makes it done. The readers the steps use, and the project's
// differences from a fresh start, are tested in the steps-*-test.mjs files beside it. Node's own modules and git.
//
//   node tests/steps-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { differences, fresh } from "../scripts/fresh.mjs";
import { FOLDER, NOTES, NOTICE, POINTER, entries, notes as notesWhole } from "../scripts/sync-notes.mjs";
import { STAGES } from "../scripts/steps-stage.mjs";
import { only, heldKitIn } from "../scripts/steps-kit.mjs";
import { COST, STEPS, leads, notDone, project, report } from "../scripts/steps.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-");
const kit = heldKitIn(tmp, ok);

// ---- every entry of the sync notes has its step, and each step is told done one way ----
const notes = leads(notesWhole(root));
ok(notes.length > 0 && JSON.stringify(notes) === JSON.stringify(STEPS.map(s => s.lead)), `every entry of ${NOTES} has its step in scripts/steps/, in the same order, and no step stands without one`,
  `entries without a step: ${notes.filter(l => !STEPS.some(s => s.lead === l)).join("; ") || "none"}\nsteps without an entry: ${STEPS.filter(s => !notes.includes(s.lead)).map(s => s.lead).join("; ") || "none"}`);
// (#750, point 1: each entry in a file of its own, its step in a file of the same name, and none in the notes' file)
const noteFiles = fs.readdirSync(path.join(root, FOLDER)), stepFiles = fs.readdirSync(path.join(root, "scripts", "steps"));
const named = f => f.replace(/\.(md|mjs)$/u, "");
const unpaired = [...noteFiles.filter(f => !f.endsWith(".md") || !stepFiles.includes(`${named(f)}.mjs`)).map(f => `${FOLDER}/${f}`),
  ...stepFiles.filter(f => !f.endsWith(".mjs") || !noteFiles.includes(`${named(f)}.md`)).map(f => `scripts/steps/${f}`)];
ok(noteFiles.length === STEPS.length && !unpaired.length, `each entry stands in a file of ${FOLDER}/ and its step in a file of scripts/steps/ of the same name, NNN-<name>`, `without its pair: ${unpaired.join(", ")}`);
const notOne = noteFiles.filter(f => !/^- \*\*[^\n]+\n$/u.test(fs.readFileSync(path.join(root, FOLDER, f), "utf8")));
ok(!notOne.length, `each file of ${FOLDER}/ holds one entry, on one line`, notOne.join(", "));
const own = fs.readFileSync(path.join(root, NOTES), "utf8");
ok(!leads(own).length && entries(own).length === 1 && entries(own)[0].startsWith(NOTICE) && entries(own)[0].includes("`core/setup/sync-notes/`") && own.split("\n").filter(l => l === POINTER).length === 1, `${NOTES} holds no entry of its own, only the notice to a sync from an older copy, and names the folder once: a new entry is a file of ${FOLDER}/, named to stand after the one before it`, entries(own).join("\n"));
const printed = execFileSync(process.execPath, [path.join(root, "scripts", "sync-notes.mjs")], { cwd: tmp, encoding: "utf8" });
ok(printed === notesWhole(root), "node core/scripts/sync-notes.mjs, run from another folder (a project's root), prints the notes of the copy it stands in", printed.slice(0, 300));
const ways = STEPS.filter(s => [s.check, s.held, s.unread].filter(Boolean).length !== 1 || !Object.values(COST).includes(s.cost));
ok(!ways.length, "each step is told done one way (a check, a check of the project's that holds it, or why none reads it) and says what it costs", ways.map(s => s.lead).join("\n"));
const unstaged = STEPS.filter(s => s.check && !STAGES[s.lead]).map(s => s.lead);
ok(!unstaged.length, "each step with a check has a stage and a mend, in a file of scripts/stages/ of its step's name, so the tests can take it out and put it back", unstaged.join("\n"));
// (a stage whose file has no step of the same name that holds a check is read by nothing)
const stageFiles = fs.readdirSync(path.join(root, "scripts", "stages")).sort();
const withCheck = stepFiles.filter(f => f.endsWith(".mjs")).sort().filter((f, i) => STEPS[i].check);
const stray = stageFiles.filter(f => !f.endsWith(".mjs") || !withCheck.includes(f));
ok(!stray.length && stageFiles.length === Object.keys(STAGES).length, "each file of scripts/stages/ is the stage of the step of the same name in scripts/steps/, a step with a check", stray.join(", "));

// ---- a project the starter kit writes: every step done, no difference from a fresh start ----
// (`kit` writes the starter kit's project, as steps-kit.mjs says, and reads it back at once unless `held` is false)
const kinds = { "an-npm-project": { packages: "." }, "a-dotnet-project": { nuget: "src", private: true }, "a-game": { packages: "web", game: true } };
const dirs = Object.fromEntries(Object.entries(kinds).map(([name, o]) => [name, kit(name, o)]));
// (the pairs of options no other kit of this file is made with: npm in a private repository, a private game and an npm
// game, all three in one kit, and a game built with NuGet)
const pairs = Object.fromEntries(Object.entries({ "a-private-npm-game": { packages: ".", private: true, game: true }, "a-dotnet-game": { nuget: "src", game: true } }).map(([name, o]) => [name, kit(name, o)]));
// (a manifest with no `Core:` line, or one in neither form: the copy is read at core/, the default, and nothing throws;
// beside a fresh start the line alone is listed, as the kit writes it)
{
  const at = pairs["a-dotnet-game"], manifest = path.join(at, "core-manifest.md"), was = fs.readFileSync(manifest, "utf8");
  for (const [what, text] of [["no `Core:` line", was.replace(/^Core: .*\n/m, "")], ["a `Core:` line in neither form", was.replace(/^Core: .*$/m, "Core: a line the reader does not know")]]) {
    fs.writeFileSync(manifest, text);
    let missed = null, found = null, threw = null;
    try { missed = notDone(at); const p = project(at); found = differences(p, fresh(p)); } catch (e) { threw = e; }
    ok(!threw && !missed.length && found.length === 1 && found[0].startsWith("core-manifest.md: lacks the paragraph \"Core: "),
      `a manifest with ${what}: the steps read the copy at core/, every one done, and beside a fresh start only the line is listed`, threw?.stack ?? `${report(missed ?? [])}\n${(found ?? []).join("\n")}`);
  }
  fs.writeFileSync(manifest, was);
}
// ---- each step taken out: exactly it is reported, with its mend; the mend as written makes it done ----
// (each step's mend is read for its own step alone, and for every other step by the next step's reading, which reads them
// all and is told of exactly that step: a mend that left another step undone shows there, as "after the mend of ..."; and
// the last mend by a reading of all the steps at the end, so no reading of all of them is made twice for one step)
const dir = dirs["a-dotnet-project"];
let mended = null;
for (const step of STEPS.filter(s => s.check)) {
  STAGES[step.lead].stage(dir);
  const missed = notDone(dir);
  ok(missed.length === 1 && missed[0].lead === step.lead && missed[0].mend.length > 20 && missed[0].cost === step.cost, `taken out, "${step.lead}" is reported, alone, with its mend and cost`, `${mended ? `(after the mend of "${mended}") ` : ""}${report(missed)}`);
  STAGES[step.lead].mend(dir);
  const left = notDone(dir, only(step.lead));
  ok(!left.length, `and its mend as written makes it done`, report(left));
  STAGES[step.lead].after?.(dir);
  mended = step.lead;
}
const left = notDone(dir);
ok(!left.length, "and, every one taken out and mended in turn, every step reads done", `(after the mend of "${mended}") ${report(left)}`);
// (the parser's packages installed where the selection of tests runs too, which reads through the shape check's
// readers, all of Python on the parser: a job that selects after the first install alone reads not done; #530, item 6)
{
  const PARSER_LEAD = "19 November 2026, the parser's packages installed where the shape check runs", file = path.join(dir, ".github/workflows/select-staged.yml");
  const flow = named => `name: select-staged\n\non:\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node core/scripts/install.mjs${named}\n      - run: node core/scripts/select.mjs --env RUN\n`;
  const said = named => { fs.writeFileSync(file, flow(named)); execFileSync("git", ["add", "-A", "--", file], { cwd: dir }); const m = notDone(dir, only(PARSER_LEAD)).find(x => x.lead === PARSER_LEAD); fs.rmSync(file); execFileSync("git", ["add", "-A", "--", file], { cwd: dir }); return m; };
  const first = said("");
  ok(first && /`\.github\/workflows\/select-staged\.yml` that runs the shape check or the selection of tests/u.test(first.mend) && !said(" all") && !said(" parser"),
    "a job that selects the tests after the core's first install alone reads not done, its mend naming the workflow; one that installs the parser's too reads done", JSON.stringify(first));
}
// (the project's tests at the pace of a release, read exactly: all four types, and a condition that skips a draft;
// #733, point 7)
{
  const READY_LEAD = "19 November 2026, the project's tests at the pace of a release", file = path.join(dir, ".github/workflows/ready-exact.yml");
  const flow = (types, cond) => `name: ready-exact\n\non:\n  pull_request:\n    types: [${types}]\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    if: \${{ ${cond} }}\n    runs-on: ubuntu-latest\n    steps:\n      - run: node core/scripts/install.mjs all\n      - run: node core/scripts/shape.mjs checks/shape.json --suite unit -- node --test\n`;
  const reads = (types, cond) => { fs.writeFileSync(file, flow(types, cond)); execFileSync("git", ["add", "-A", "--", file], { cwd: dir }); const m = notDone(dir, only(READY_LEAD)).some(x => x.lead === READY_LEAD); fs.rmSync(file); execFileSync("git", ["add", "-A", "--", file], { cwd: dir }); return m; };
  ok(reads("ready_for_review", "!github.event.pull_request.draft") && reads("opened, synchronize, reopened, ready_for_review", "github.event.pull_request.draft") && !reads("opened, synchronize, reopened, ready_for_review", "github.event.pull_request.draft == false") && !reads("opened, synchronize, reopened, ready_for_review", "github.actor != 'x' && !github.event.pull_request.draft") && reads("opened, synchronize, reopened, ready_for_review", "always() || !github.event.pull_request.draft") && !reads("opened, synchronize, reopened, ready_for_review", "!cancelled() && !github.event.pull_request.draft") && reads("opened, synchronize, reopened, ready_for_review", "!cancelled() && !(github.event.pull_request.draft || x)") && reads("opened, synchronize, reopened, ready_for_review", "always() }} && !github.event.pull_request.draft && ${{ true") && reads("opened, synchronize, reopened, ready_for_review", "github.actor != ' && !github.event.pull_request.draft && '") && !reads("opened, synchronize, reopened, ready_for_review", "github.actor != 'it''s && x' && !github.event.pull_request.draft") && reads("opened, synchronize, reopened, ready_for_review", "github.event.pull_request.labels[github.actor && !github.event.pull_request.draft && 1]"),
    "a job that starts a suite reads done only with all four types and a condition of parts joined by && that skips a draft, a status function such as `!cancelled()` among them and a quoted string one word, not one that runs on drafts alone, an || that lets one through, text outside its ${{ }}, an index or a draft part inside a string");
}
// (and its publishing: a workflow that publishes a site otherwise than from a green default branch reads not done, its
// mend saying how it waits on one; one on the checks' completed run, each job asking the run's success and its head
// repository or needing a job that does, a push of tags alone and a person's dispatch read done; #733, points 7 and 8)
{
  const READY_LEAD = "19 November 2026, the project's tests at the pace of a release", file = path.join(dir, ".github/workflows/pages.yml");
  const GREEN = "github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_repository.full_name == github.repository";
  const RUN = "  workflow_run:\n    workflows: [tests]\n    types: [completed]\n    branches: [main]";
  const job = (name, cond, needs, deploy) => `  ${name}:\n${cond === null ? "" : `    if: \${{ ${cond} }}\n`}${needs ? `    needs: ${needs}\n` : ""}    runs-on: ubuntu-latest\n    steps:\n      - ${deploy ? "uses: actions/deploy-pages@v4" : "run: npm run build"}\n`;
  const flow = (on, jobs) => `name: pages\n\non:\n${on}\n\npermissions:\n  contents: read\n\njobs:\n${jobs}`;
  const said = (on, jobs = job("deploy", null, null, true)) => { fs.writeFileSync(file, flow(on, jobs)); execFileSync("git", ["add", "-A", "--", file], { cwd: dir }); const m = notDone(dir, only(READY_LEAD)).find(x => x.lead === READY_LEAD); fs.rmSync(file); execFileSync("git", ["add", "-A", "--", file], { cwd: dir }); return m; };
  const onPush = said("  push:\n    branches: [main]");
  ok(onPush && /publishes what its users get otherwise than from a green default branch \(`\.github\/workflows\/pages\.yml`\)/.test(JSON.stringify(onPush)) && /workflow_run/.test(JSON.stringify(onPush)) && /users get\* to `releases`/.test(JSON.stringify(onPush)),
    "a workflow that publishes a site on a push alone reads not done, its mend making it wait on the checks' completed run and the row *users get* say releases", JSON.stringify(onPush));
  const notDoneOn = [
    ["on that run with no condition", RUN, undefined],
    ["on that run, the job that builds unguarded", RUN, job("build", null, null, false) + job("deploy", GREEN, "build", true)],
    ["on that run, a condition joined by ||", RUN, job("deploy", GREEN.replace("&&", "||"), null, true)],
    ["on that run, the success alone", RUN, job("deploy", "github.event.workflow_run.conclusion == 'success'", null, true)],
    ["on that run, a part inside a string", RUN, job("deploy", `github.actor != ' && ${GREEN.replace(/'/gu, "''")} && '`, null, true)],
    ["on that run of every branch", "  workflow_run:\n    workflows: [tests]\n    types: [completed]", job("deploy", GREEN, null, true)],
    ["on a schedule", "  schedule:\n    - cron: '0 * * * *'", undefined],
    ["on a push of branches and tags", "  push:\n    branches: [main]\n    tags: ['v*']", undefined],
  ].filter(([, on, jobs]) => !said(on, jobs)).map(([what]) => what);
  const doneOn = [
    ["on that run, its one job guarded", RUN, job("deploy", GREEN, null, true)],
    ["on that run, a first job guarded and the other needing it", RUN, job("build", GREEN, null, false) + job("deploy", null, "[build]", true)],
    ["on that run and a person's dispatch", RUN + "\n  workflow_dispatch:", job("deploy", GREEN, null, true)],
    ["on a push of tags alone", "  push:\n    tags: ['v*']", undefined],
    ["on a release", "  release:\n    types: [published]", undefined],
  ].filter(([, on, jobs]) => said(on, jobs)).map(([what]) => what);
  ok(!notDoneOn.length && !doneOn.length, "a publishing workflow reads done only where each trigger waits on a green branch: on the checks' completed run of one branch with every job guarded, or needing a guarded one, a push of tags alone, a release, a person's dispatch", JSON.stringify({ notDoneOn, doneOn }));
}
// several at once, in a project of another kind: exactly those
const lockProject = dirs["an-npm-project"];
const some = STEPS.filter(s => s.check).filter((_, i) => i % 2 === 0).map(s => s.lead);
for (const lead of some) STAGES[lead].stage(lockProject);
const several = notDone(lockProject);
ok(JSON.stringify(several.map(m => m.lead)) === JSON.stringify(some), "several taken out at once are reported, exactly those", report(several));
// (in the order steps-stage.mjs loads them: the steps', and `last` where a stage's mend reads what the others' mends write)
for (const lead of Object.keys(STAGES).filter(l => some.includes(l))) STAGES[lead].mend(lockProject);
ok(!notDone(lockProject).length, "and their mends make every one done");
for (const lead of some) STAGES[lead].after?.(lockProject);
// (two whose stages both write a job that selects, taken out together: each still reported, as the upgrade test's
// random draw takes them, #457)
{
  const pair = ["16 November 2026, the tests a change can reach", "18 November 2026, a tree that passed is not run again"];
  for (const lead of pair) STAGES[lead].stage(lockProject);
  const together = pair.map(lead => notDone(lockProject, only(lead)));
  ok(pair.every((lead, i) => together[i].some(m => m.lead === lead)), "the tests a change can reach and a tree that passed, taken out together, are each reported", report(together.flat()));
  for (const lead of Object.keys(STAGES).filter(l => pair.includes(l))) STAGES[lead].mend(lockProject);
  for (const lead of pair) STAGES[lead].after?.(lockProject);
}


done("steps");
