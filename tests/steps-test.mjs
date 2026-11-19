// Tests steps.mjs and fresh.mjs (what a release asks of a project, and a project beside a fresh start) on projects the
// starter kit of this commit writes in a scratch folder (init.mjs's `files`, read from the working folder), each a git
// repository with nothing committed. Node's own modules and git.
//
//   node tests/steps-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { differences, fresh, kind, report as freshReport } from "../scripts/fresh.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { READ, TEMPLATES, files, licences, sizes } from "../scripts/init.mjs";
import { notes as manifestNotes } from "../scripts/manifest-reads.mjs";
import { NOTES } from "../scripts/releases.mjs";
import { READERS } from "../scripts/shape-readers.mjs";
import { STAGES } from "../scripts/steps-stage.mjs";
import { parseYaml, pathsLetThrough } from "../scripts/workflow-run.mjs";
import { COST, MOVED_GLOB, NEW_GLOBS, READ_MOST, STEPS, Unread, configs, leads, moved, notDone, plain, project, report, runsOwn } from "../scripts/steps.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "steps-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const PIN = "a".repeat(40);
const modules = ["roles/shared", "tasks", "tools"].flatMap(d => fs.readdirSync(path.join(root, d)).filter(n => n.endsWith(".md")));
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
  for (const part of ["floor", "modules", "roles", "tasks", "tools", "scripts", ".packages", "setup"]) fs.cpSync(path.join(root, part), path.join(dir, "core", part), { recursive: true });
  fs.writeFileSync(path.join(dir, "checks/sizes.json"), `${JSON.stringify(sizes(Object.fromEntries(READ.map(f => [f, fs.statSync(path.join(dir, f)).size]))), null, 2)}\n`);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  // (the copies check's first baseline as the starter kit writes it, its two entry files' shared sentence listed)
  execFileSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json", "--first"], { cwd: dir, stdio: "ignore" });
  fs.writeFileSync(path.join(dir, "checks/shape-baseline.json"), `${JSON.stringify({ reads: Object.keys(READERS), listed: {} }, null, 2)}\n`);
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
  // (the core's own manifest check, on the modules of this commit: a module the list neither takes nor leaves out would
  // be a note on the project's first day, #329)
  const moduleNotes = manifestNotes({ manifest: p.manifest, moduleTexts: { ...texts("roles/shared"), ...texts("tasks"), ...texts("tools") } });
  ok(!moduleNotes.length, `${name}: its manifest takes or leaves out each module, so the manifest check gives no note`, moduleNotes.join("\n"));
}
// (a named tool is done only where a workflow on pull requests runs the check with its base)
{
  const dir = dirs["an-npm-project"], manifest = path.join(dir, "core-manifest.md"), was = fs.readFileSync(manifest, "utf8");
  const step = STEPS.find(s => s.lead === "16 November 2026, how strong the tests are"), flow = path.join(dir, ".github/workflows/strength.yml");
  fs.writeFileSync(manifest, was.replace(/^\| \*mutation tool\* \|.*$/m, "| *mutation tool* | `node core/scripts/mutate.mjs --report {report} {lines}` |"));
  const said = body => { fs.writeFileSync(flow, `name: strength\non:\n  pull_request:\njobs:\n  tests:\n    runs-on: ubuntu-latest\n    steps:\n${body}`); return step.check(project(dir)); };
  const comment = said("      # TODO: node core/scripts/strength.mjs\n      - run: echo later\n");
  const bare = said("      - run: node core/scripts/strength.mjs\n");
  const runs = said("      - run: node core/scripts/strength.mjs\n        env:\n          STRENGTH_BASE: origin/main\n");
  ok(comment !== null && bare !== null && runs === null, "a named mutation tool reads done only where a workflow on pull requests runs the strength check with its base, never where one only mentions it", `${comment}\n${bare}\n${runs}`);
  fs.writeFileSync(manifest, was); fs.rmSync(flow);
}
// (the starter kit's `none`: no tests yet stands until the project's own code holds a test)
{
  const dir = dirs["an-npm-project"], test = path.join(dir, "src", "first.test.js");
  fs.mkdirSync(path.dirname(test), { recursive: true });
  fs.writeFileSync(test, "export {};\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const said = notDone(dir).find(s => s.lead === "16 November 2026, how strong the tests are");
  ok(said?.mend.includes("has tests now"), "the starter kit's mutation-tool row, none for no tests yet, is reported once the project's own code holds a test", JSON.stringify(said));
  execFileSync("git", ["rm", "-q", "--cached", "src/first.test.js"], { cwd: dir });
  fs.rmSync(test);
  // (a test folder the config names beside its code, not inside it: its tests count too)
  const config = path.join(dir, "checks/shape.json"), was = fs.readFileSync(config, "utf8"), apart = path.join(dir, "test", "a.js");
  fs.writeFileSync(config, `${JSON.stringify({ ...JSON.parse(was), code: ["src"], tests: ["test"] }, null, 2)}\n`);
  fs.mkdirSync(path.dirname(apart), { recursive: true }); fs.writeFileSync(apart, "export {};\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const beside = notDone(dir).find(s => s.lead === "16 November 2026, how strong the tests are");
  ok(beside?.mend.includes("has tests now"), "and once a test stands in a folder of tests the config names apart from its code", JSON.stringify(beside));
  execFileSync("git", ["rm", "-q", "--cached", "test/a.js"], { cwd: dir });
  fs.rmSync(path.join(dir, "test"), { recursive: true }); fs.writeFileSync(config, was);
  execFileSync("git", ["add", "-A"], { cwd: dir });
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
// (two whose stages both write a job that selects, taken out together: each still reported, as the upgrade test's
// random draw takes them, #457)
{
  const pair = ["16 November 2026, the tests a change can reach", "18 November 2026, a tree that passed is not run again"];
  for (const lead of pair) STAGES[lead].stage(lockProject);
  ok(pair.every(lead => notDone(lockProject).some(m => m.lead === lead)), "the tests a change can reach and a tree that passed, taken out together, are each reported", report(notDone(lockProject)));
  for (const lead of Object.keys(STAGES).filter(l => pair.includes(l))) STAGES[lead].mend(lockProject);
  for (const lead of pair) STAGES[lead].after?.(lockProject);
}

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
  const quick = [["**a+a+a+a+a+a+a+b", long], [`${"*".repeat(30)}z`, ".github/workflows/core.yml"], ["*a+a+a+a+a+a+a+a+a+a+b", "a".repeat(500)], ["**/**/**/**/**/x", `${"a/".repeat(300)}y`], [`${"**/a/".repeat(500)}x`, `${"a/".repeat(2000)}y`]]
    .every(([pattern, name]) => !pathsLetThrough([pattern], [name]));
  const reported = suiteBy("    paths: ['*a+a+a+a+a+a+a+a+a+b', '.github/workflows/**']");
  ok(quick && reported && Date.now() - began < 3000, "a filter that would keep a backtracking expression busy is read at once, and read right", `${Date.now() - began} ms`);
  fs.rmSync(suiteFile);
}

// ---- a tree that passed (#457): a job that selects on a push alone ran nowhere else, and is not asked --passed ----
{
  const PASSED_LEAD = "18 November 2026, a tree that passed is not run again", pushed = path.join(lockProject, ".github/workflows/pushed.yml");
  const asked = on => { fs.writeFileSync(pushed, `name: p\non:\n${on}\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node core/scripts/select.mjs --env RUN\n`); return notDone(lockProject).some(m => m.lead === PASSED_LEAD); };
  ok(!asked("  push:\n    branches: [main]") && asked("  push:\n  pull_request:") && asked("  pull_request:\n  push:\n    branches: [main]"),
    "a job that selects on a push alone is not asked --passed, since its suite ran nowhere else; one a pull request runs too is");
  const job = (select, runner) => { fs.writeFileSync(pushed, `name: p\non:\n  pull_request:\n  push:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${select}\n      - ${runner}\n`); return notDone(lockProject).some(m => m.lead === PASSED_LEAD); };
  const sel = 'node core/scripts/select.mjs --env RUN ${SELECT_PASSED:+--passed "$SELECT_PASSED"}';
  ok(job(sel, 'run: if [ "$RUN" = all ]; then node --test; else node --test $RUN; fi') && !job(sel, 'run: if [ "$RUN" = all ]; then node --test; elif [ "$RUN" != none ]; then node --test $RUN; fi')
    && !job(sel, "if: env.RUN == 'all'\n        run: node --test") && !job(sel, "if: ${{ env.RUN == 'all' || contains(env.RUN, ' test/a.test.mjs ') }}\n        run: node --test test/a.test.mjs")
    && job(sel, "if: env.RUN == 'all'\n        run: node --test\n      - if: env.RUN != 'all'\n        run: node --test $RUN") && job(sel, "if: contains(env.RUN, 'no')\n        run: node --test")
    && job(sel, "if: ${{ !(env.RUN == 'all') }}\n        run: node --test") && job(sel, "if: ${{ env.RUN == 'all' || github.event_name == 'push' }}\n        run: node --test")
    && !job(sel, "if: ${{ !cancelled() && (env.RUN == 'all' || contains(env.RUN, ' test/a.test.mjs ')) }}\n        run: node --test test/a.test.mjs")
    && job(sel, 'run: [ "$RUN" != none ] || true; node --test $RUN')
    && job("node core/scripts/select.mjs --env RUN", 'run: if [ "$RUN" = all ]; then node --test; elif [ "$RUN" != none ]; then node --test $RUN; fi'),
    "it reads done only where the selection gives --passed and every step that reads RUN runs nothing on \"none\", in a shape it can read so: an if: whose parts joined by && hold RUN in one part, nothing but == 'all' and contains(env.RUN, ' <file> ') joined by ||, or the run line the mend gives; any other shape is reported: != 'all', a negation, an || with another term, a contains that \"none\" could hold, a run line of another shape");
  fs.rmSync(pushed);
}

// ---- a shape baseline written before the check read C#, Python, JSX and shared scripts (#354): its mend names them ----
const shapeBaseline = path.join(lockProject, "checks/shape-baseline.json"), shapeAsKit = fs.readFileSync(shapeBaseline, "utf8");
fs.writeFileSync(shapeBaseline, "{\n  \"listed\": {}\n}\n");
let shapeMissed = notDone(lockProject);
ok(shapeMissed.length === 2 && shapeMissed[1].lead === "18 November 2026, the shape check reads C#'s functions on the parser" && /written before the check read C#, its functions by the parser: run `node core\/scripts\/shape\.mjs checks\/shape\.json --write`/.test(shapeMissed[1].mend) && shapeMissed[0].lead === "16 November 2026, how code is put together" && /written before the check read files that hold JSX, C#, its functions by the lexer, Python, scripts that share one global space, the tests that open a screen, a window or a device, the tests that reach a real clock, the tests that start another process:/.test(shapeMissed[0].mend) && /node core\/scripts\/shape\.mjs checks\/shape\.json --write/.test(shapeMissed[0].mend),
  "a shape baseline that names no reader is reported by both its steps, each mend to write it with every reader", report(shapeMissed));
execFileSync(process.execPath, ["core/scripts/shape.mjs", "checks/shape.json", "--write"], { cwd: lockProject, env: { ...process.env, SHAPE_BASE: "" } });
shapeMissed = notDone(lockProject);
ok(!shapeMissed.length && JSON.parse(fs.readFileSync(shapeBaseline, "utf8")).reads.length === Object.keys(READERS).length, "and the mend as written makes it done", report(shapeMissed));
fs.writeFileSync(shapeBaseline, shapeAsKit);

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
fs.writeFileSync(secWorkflow, fs.readFileSync(secWorkflow, "utf8").replace(/^jobs:/m, "env: [SAMPLE\n\njobs:"));
const unread = notDone(plainProject);
const unreadSec = unread.find(m => m.lead.endsWith("the security review shown on every pull request"));
ok(unreadSec?.mend.includes("could not read the project") && unreadSec.mend.includes("security-review.yml") && unread.every(m => m.mend.includes("could not read the project")),
  "a workflow the core's reader cannot read, a flow sequence never closed, is reported as not read, never as a call that is missing or a step done", report(unread));

// ---- a path a project's own file names is read only inside the project ----
fs.writeFileSync(path.join(plainProject, "checks/copies.json"), JSON.stringify({ baseline: "../a-game/checks/copies-baseline.json", code: [], prose: [], proseFromSecurity: true }));
found = differences(project(plainProject), fresh(project(plainProject)));
ok(found.some(d => d.startsWith("the copies check's baseline not compared: ") && d.includes("../a-game/checks/copies-baseline.json, outside the project")) && !found.some(d => d.startsWith("../")) && project(plainProject).read("../a-game/AGENTS.md") === null,
  "a path that leads out of the project is said not compared, never read as another folder's file", found.join("\n"));

// ---- what the steps read is a regular file of the project's own, of a size a rule file or config keeps to (#362, #423):
// a link (in or out), a folder link that leads out, an endless device and a file past the size read as missing, and the
// last is named in the report ----
{
  const dir = path.join(tmp, "links"), outside = path.join(tmp, "outside");
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "# own\n");
  fs.writeFileSync(path.join(outside, "secret.md"), "outside\n");
  fs.writeFileSync(path.join(dir, "docs/big.md"), "x".repeat(READ_MOST + 1));
  const linked = [];
  // (and git's own folder and a file it ignores, a person's own, read neither by a link nor by name)
  fs.writeFileSync(path.join(dir, ".gitignore"), ".env\n");
  fs.writeFileSync(path.join(dir, ".env"), "# a person's own\n");
  for (const [at, to, type] of [["in.md", "AGENTS.md", "file"], ["gitcfg.md", ".git/config", "file"], ["env.md", ".env", "file"], ["out.md", path.join(outside, "secret.md"), "file"], ["far", outside, "dir"], ...(process.platform === "win32" ? [] : [["zero.md", "/dev/zero", "file"]])]) {
    try { fs.symlinkSync(to, path.join(dir, at), type); linked.push(at); } catch { /* (a system that makes no link here: that case is not run) */ }
  }
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const p = project(dir);
  // (each part named, so that a system where one differs says which; a path through a file is no folder anywhere, and
  // Windows says there is nothing there, where others say it is no folder: neither is handed on)
  const parts = {
    own: p.read("AGENTS.md") === "# own\n",
    "links out or to a device": linked.filter(at => at !== "in.md").every(at => p.read(at === "far" ? "far/secret.md" : at) === null),
    "a folder and a file past the size": p.read("docs") === null && p.read("docs/big.md") === null,
    "a link to a file of its own": !linked.includes("in.md") || p.read("in.md") === "# own\n",
    "git's own and an ignored file, by name": p.read(".env") === null && p.read(".git/config") === null,
    "safe: its own, nothing there, not the big file": p.safe("AGENTS.md") && p.safe("nothing-here.md") && !p.safe("docs/big.md"),
    "safe: a path through a file never throws": typeof p.safe("AGENTS.md/x") === "boolean" && (process.platform === "win32" || !p.safe("AGENTS.md/x")),
    "safe: no link out or to a device": linked.filter(at => at !== "in.md" && at !== "far").every(at => !p.safe(at)),
  };
  const reads = Object.values(parts).every(Boolean);
  const said = report(Object.assign([], { unread: p.unread }));
  ok(reads && p.unread.join() === "docs/big.md" && said.includes(`Left unread, each past ${READ_MOST} bytes`) && said.includes("`docs/big.md`"),
    `the steps read a regular file of the project's own and nothing else: a link to one reads as it, a link out or to a device (${linked.join(", ") || "none made here"}), a folder and a file past the size read as missing, the last named in the report`, `${said}\n${Object.entries(parts).filter(([, v]) => !v).map(([k]) => `not so: ${k}`).join("\n")}`);
  // (the size marks' step never hands the reading-size check a file the reader would not read: a tracked link to an
  // endless device among the files its marks name is reported as not read, at once)
  if (process.platform !== "win32") {
    const kitDir = dirs["an-npm-project"], agents = path.join(kitDir, "AGENTS.md"), was = fs.readFileSync(agents);
    fs.rmSync(agents);
    fs.symlinkSync("/dev/zero", agents);
    const step = STEPS.filter(x => x.lead === "14 November 2026, the size marks' total counts the project's own files");
    const at = Date.now(), said2 = notDone(kitDir, step);
    fs.rmSync(agents);
    fs.writeFileSync(agents, was);
    ok(said2.length === 1 && /names `AGENTS\.md`, which is no regular file of the project's own/.test(said2[0].mend) && Date.now() - at < 30000, "the size marks' step hands the reading-size check no file the reader would not read, and says which", said2[0]?.mend);
  }
}

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
const dotted = { files: [], read: () => null, manifest: "", workflows: { "a.yml": { text: "x", yaml: { jobs: { j: { steps: [{ run: "node ./core/scripts/licences.mjs a.json\nnode vendor/core/scripts/copies.mjs b.json" }] } } } } } };
ok(runsOwn(dotted, "licences.mjs").length === 1 && runsOwn(dotted, "copies.mjs").every(r => r.unsure) && runsOwn(dotted, "copies.mjs").length === 1,
  "a script started as ./core/scripts/ is run; one under another folder's core/scripts/ is not the copy's, and not read");
// (the argument read as the shell reads it: past an option, through a line's continuation, quoted, and after a quoted
// script; and a slot read in its own cell, past the script and any command)
const passing = (run, manifest = "") => configs({ ...dotted, manifest, workflows: { "a.yml": { text: "x", yaml: { jobs: { j: { steps: [{ run }] } } } } } }).copies;
ok(passing("node core/scripts/copies.mjs --first config/c.json") === "config/c.json" && passing("node core/scripts/copies.mjs \\\n  config/c.json") === "config/c.json"
  && passing('node core/scripts/copies.mjs "config/my copies.json"') === "config/my copies.json" && passing('node "./core/scripts/copies.mjs" config/c.json') === "config/c.json"
  && passing("echo none", "| *copies check* | `node core/scripts/copies.mjs` with `config/s.json` | more `x.json` |\n") === "config/s.json",
  "an argument is read past an option, a line's continuation and quotes, and the slot in its own cell past the script");
ok(configs({ ...dotted, workflows: { "a.yml": { text: "x", yaml: { jobs: { j: { steps: [{ run: 'node core/scripts/copies.mjs "${{ inputs.c }}"' }] } } } } } }).copies === null, "a quoted argument that names it only when the workflow runs is not read");
ok(passing("# a note \\\nnode core/scripts/copies.mjs config/c.json") === "config/c.json", "a comment that ends in a backslash continues nothing, as the shell reads it");
// (#386: each config read as its check is run, from every source the project gives it, and not read where they differ
// or one cannot be known)
const inMemory = (workflows, files = {}, manifest = "") => ({ files: Object.keys(files), read: f => files[f] ?? null, manifest,
  workflows: Object.fromEntries(Object.entries(workflows).map(([f, yaml]) => [f, { text: JSON.stringify(yaml), yaml }])) });
const stepped = (run, step = {}, job = {}, top = {}) => ({ ...top, jobs: { j: { ...job, steps: [{ run, ...step }] } } });
const coreCall = (name, inputs) => ({ jobs: { c: { uses: `${CORE}/.github/workflows/${name}@${"0".repeat(40)}`, with: inputs } } });
const copiesOf = (...a) => configs(inMemory(...a)).copies;
ok(copiesOf({ "a.yml": stepped('echo "mend: node core/scripts/copies.mjs <config>"\nprintf "%s" core/scripts/copies.mjs x.json') }) === "checks/copies.json",
  "a script a line only names, as in a message, is not read as run: only one node starts is");
ok(copiesOf({ "a.yml": stepped('node core/scripts/copies.mjs "config/a # b.json"') }) === "config/a # b.json" && copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs config/c.json # its config") }) === "config/c.json",
  "a \" #\" inside quotes cuts nothing short; one outside them starts a comment");
ok(["node $GITHUB_WORKSPACE/core/scripts/copies.mjs config/c.json", 'node "${{ github.workspace }}/core/scripts/copies.mjs" "$GITHUB_WORKSPACE/config/c.json"',
  "node ${GITHUB_WORKSPACE}/core/scripts/copies.mjs ./config/c.json", "node --no-warnings core/scripts/copies.mjs --first config/c.json"]
  .every(run => copiesOf({ "a.yml": stepped(run, {}, { "runs-on": "ubuntu-latest" }) }) === "config/c.json"), "the checkout's root as a workflow names it and node's options read as the shell reads them");
{
  const rooted = (run, step = {}, job = {}, top = {}) => copiesOf({ "a.yml": stepped(`node core/scripts/copies.mjs ${run}/config/c.json`, step, job, top) });
  ok(rooted("%GITHUB_WORKSPACE%", { shell: "cmd" }) === "config/c.json" && rooted("$env:GITHUB_WORKSPACE", {}, { "runs-on": "windows-latest" }) === "config/c.json"
    && rooted("$GITHUB_WORKSPACE", {}, { "runs-on": ["self-hosted", "linux"], defaults: { run: { shell: "bash -e {0}" } } }) === "config/c.json"
    && rooted("$GITHUB_WORKSPACE", {}, {}, { defaults: { run: { shell: "sh" } } }) === "config/c.json" && rooted("${{ github.workspace }}") === "config/c.json",
    "the root is read as the step's shell names it, the expression in any shell");
  ok([["%GITHUB_WORKSPACE%", { shell: "bash" }], ["%GITHUB_WORKSPACE%", {}, { "runs-on": "ubuntu-latest" }], ["$GITHUB_WORKSPACE", {}, { "runs-on": "windows-latest" }],
    ["$GITHUB_WORKSPACE", { shell: "cmd" }], ["$env:GITHUB_WORKSPACE", { shell: "bash" }], ["$GITHUB_WORKSPACE"], ["$GITHUB_WORKSPACE", {}, { "runs-on": "${{ matrix.os }}" }],
    ["$GITHUB_WORKSPACE", { shell: "python" }], ["$GITHUB_WORKSPACE", { shell: ["bash"] }]].every(a => rooted(...a) === null),
    "a root named as another shell names it, or where the step's shell cannot be told, is not read as the root");
  ok(rooted("$ENV:GITHUB_WORKSPACE", { shell: "pwsh" }) === "config/c.json" && rooted("%github_workspace%", { shell: "cmd" }) === "config/c.json"
    && rooted("${{ GITHUB.Workspace }}", { shell: "bash" }) === "config/c.json"
    && rooted("$GITHUB_WORKSPACE", { shell: "/bin/bash -e {0}" }) === "config/c.json" && rooted("$env:GITHUB_WORKSPACE", { shell: "powershell.exe" }) === "config/c.json"
    && rooted("$github_workspace", { shell: "bash" }) === null && rooted("$env:github_workspace", { shell: "pwsh" }, { "runs-on": "ubuntu-latest" }) === null,
    "a root's name read in any case only where its shell reads it so (cmd's, PowerShell's env: drive, GitHub's expression), and a shell named by its path");
  const manyLabels = Date.now(), labelled = { jobs: { j: { "runs-on": [...Array.from({ length: 5000 }, (_, k) => `l${k}`), "ubuntu-latest"],
    steps: [...Array.from({ length: 19000 }, () => ({ run: "echo x" })), { run: "node core/scripts/copies.mjs $GITHUB_WORKSPACE/config/c.json" }] } } };
  ok(copiesOf({ "a.yml": labelled }) === "config/c.json" && Date.now() - manyLabels < 1500, "a job's many labels, over many steps, are read once", `${Date.now() - manyLabels} ms`);
  ok(copiesOf({ "a.yml": stepped("node ../core/scripts/copies.mjs config/c.json", { "working-directory": "%GITHUB_WORKSPACE%/app" }, { "runs-on": "ubuntu-latest" }) }) === null, "a folder named by a shell's variable, which no shell fills there, is not read");
}
ok(["node core\\scripts\\copies.mjs config\\c.json", 'node "core\\scripts\\copies.mjs" "config\\c.json"', "node core/scripts/copies.mjs 'config\\c.json'"].every(run => copiesOf({ "a.yml": stepped(run) }) === null),
  "a path with \"\\\", one file on Windows and another on Linux, is not read");
ok(copiesOf({ "a.yml": stepped("node ../core/scripts/copies.mjs ../config/c.json", { "working-directory": "app" }) }) === "config/c.json"
  && copiesOf({ "a.yml": stepped("node ../core/scripts/copies.mjs ../config/c.json", {}, { defaults: { run: { "working-directory": "app" } } }) }) === "config/c.json",
  "a step run in a folder of its own reads its paths from there");
const notRead = (what, ...a) => { const at = configs(inMemory(...a)); return at[what] === null && at.unread.length > 0; };
ok(notRead("copies", { "a.yml": stepped("node ../core/scripts/copies.mjs c.json", { "working-directory": "${{ inputs.at }}" }) })
  && notRead("copies", { "a.yml": stepped("cd app && node ../core/scripts/copies.mjs c.json") })
  && notRead("copies", { "a.yml": stepped('node "$CORE_AT"scripts/copies.mjs c.json') }) && notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs --first") }),
  "a step whose folder or script is named only when it runs, one that changes its folder first, and a run with no config are not read");
const nugetRun = inMemory({ "l.yml": coreCall("licences.yml", { config: "checks/licences.json" }), "n.yml": stepped("node core/scripts/nuget.mjs config/n.json") });
ok(configs(nugetRun).nuget === "config/n.json" && configs(nugetRun).licences === "checks/licences.json", "the project's own run of the NuGet check gives its config, before the licence check's");
const action = "name: checks\nruns:\n  using: composite\n  steps:\n    - run: node core/scripts/copies.mjs config/a.json\n      shell: bash\n";
ok(copiesOf({ "a.yml": { jobs: { j: { steps: [{ uses: "./.github/actions/check" }] } } } }, { ".github/actions/check/action.yml": action }) === "config/a.json",
  "a step of a local action a workflow uses is read as the workflow's own");
const elsewhere = configs(inMemory({}, { "scripts/check.sh": "node core/scripts/copies.mjs config/x.json\n", "package.json": JSON.stringify({ scripts: { licences: "node core/scripts/licences.mjs config/l.json" } }) }));
ok(elsewhere.copies === null && elsewhere.licences === null && elsewhere.unread.some(u => u.includes("scripts/check.sh")) && elsewhere.unread.some(u => u.includes("package.json")),
  "a check run only from a shell script or a package's scripts is not read, never read at the slot's or the kit's path", JSON.stringify(elsewhere));
ok(configs(inMemory({}, { "README.sh.md": "node core/scripts/copies.mjs config/x.json" })).copies === "checks/copies.json", "a file that runs nothing, naming the script, gives no source");
ok(notRead("copies", { "a.yml": coreCall("copies.yml", { config: "a.json", sizes: "s.json" }), "b.yml": coreCall("copies.yml", { config: "b.json", sizes: "s.json" }) })
  && notRead("copies", { "a.yml": coreCall("copies.yml", { config: "a.json", sizes: "s.json" }), "b.yml": stepped("node core/scripts/copies.mjs b.json") })
  && notRead("licences", { "a.yml": stepped("node core/scripts/licences.mjs a.json\nnode core/scripts/agent-tools.mjs b.json") })
  && copiesOf({ "a.yml": coreCall("copies.yml", { config: "a.json", sizes: "s.json" }), "b.yml": stepped("node core/scripts/copies.mjs ./a.json") }) === "a.json",
  "two sources that give different files, calls or runs, are not read, naming each; two that give one file read it");
ok(notRead("copies", { "a.yml": coreCall("copies.yml", { sizes: "s.json" }) }) && notRead("licences", { "a.yml": coreCall("licences.yml", {}) }), "a call that passes no config is not read, never passed by to the next source");
const parts = files => configs(inMemory({ "a.yml": coreCall("licences.yml", { config: "c/l.json" }) }, files));
ok(parts({ "c/l.json": "{ no json" }).licences === "c/l.json" && parts({ "c/l.json": "{ no json" }).audit === null && parts({ "c/l.json": "{ no json" }).unread.some(u => u.startsWith("the licence check's audit not compared: "))
  && parts({}).audit === "checks/licences-audit.json" && parts({ "c/l.json": JSON.stringify({ audit: "/c/audit.json" }) }).audit === "c/audit.json",
  "a config there and no JSON leaves its audit unread, one not there the kit's, and an audit named from the root read as the licence check joins it");
const sized = configs(inMemory({ "a.yml": coreCall("copies.yml", { config: "c/c.json", sizes: "c/sizes.json" }) }, {}, "| *size marks* | `checks/sizes.json` |\n"));
ok(sized.sizes === "c/sizes.json" && configs(inMemory({}, {}, "| *size marks* | `m/s.json` |\n")).sizes === "m/s.json", "the size marks are those the copies call passes, else the slot's");
const signed = configs(inMemory({ "s.yml": coreCall("signatures.yml", { directory: "${{ inputs.at }}" }) }));
ok(signed.packages === null && signed.unread.some(u => u.startsWith("the signature check's folder not read")) && configs(inMemory({ "s.yml": coreCall("signatures.yml", {}) })).packages === ".",
  "the signature check's folder passed as an expression is not read; none passed is the root");
const advisory = STEPS.find(s => s.lead === "13 November 2026, the NuGet check fails from the first day");
let threw = null;
try { advisory.check(inMemory({ "n.yml": coreCall("nuget.yml", { config: "c.json", advisory: "${{ vars.ADVISORY }}" }) })); } catch (e) { threw = e; }
ok(threw instanceof Unread && advisory.check(inMemory({ "n.yml": coreCall("nuget.yml", { config: "c.json", advisory: true }) })) !== null, "the NuGet call's advisory passed as an expression is not read as false");
// (the reviews of 72474d0: an expression in single quotes, a run through an action counted by its workflow, each
// script's arguments as it reads them, a folder that is no text, a Windows path in quotes, a shell given its commands
// as one word, a here-document, and a file a call names outside the project)
ok(notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs '${{ vars.CONFIG }}'") }), "an expression of GitHub's in single quotes is filled before the shell runs, so not read");
const viaAction = inMemory({ "a.yml": { jobs: { j: { steps: [{ run: "node core/scripts/licences.mjs l.json" }, { uses: "./.github/actions/t" }] } } } },
  { ".github/actions/t/action.yml": "runs:\n  using: composite\n  steps:\n    - run: node core/scripts/agent-tools.mjs l.json\n      shell: bash\n" });
ok(JSON.stringify(runsOwn(viaAction, "agent-tools.mjs").map(r => [r.where, r.from])) === JSON.stringify([[".github/actions/t/action.yml", ".github/workflows/a.yml"]]), "a run through a local action is counted by the workflow that uses it");
const nugetOf = run => configs(inMemory({ "n.yml": stepped(run) })).nuget;
ok(nugetOf("node core/scripts/nuget.mjs --packages restored config/n.json") === "config/n.json" && nugetOf("node core/scripts/nuget.mjs config/n.json\nnode core/scripts/nuget.mjs --projects") === "config/n.json"
  && configs(inMemory({ "a.yml": stepped("node core/scripts/reading-size.mjs -x") })).sizes === "-x" && copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs -x") }) === "-x",
  "each script's config is the argument it picks itself: never the NuGet check's folder, none where it lists files, and an option of one dash taken as the scripts take it");
ok(notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs c.json", { "working-directory": { toString: "x" } }) }), "a folder that is no text is not read, and stops no other reading");
ok(copiesOf({ "a.yml": stepped('bash -c "node core/scripts/copies.mjs config/c.json"') }) === "config/c.json"
  && copiesOf({ "a.yml": stepped("sudo node core/scripts/copies.mjs config/c.json") }) === "config/c.json"
  && notRead("copies", { "a.yml": stepped("cat <<EOF > notes.md\nnode core/scripts/copies.mjs config/doc.json\nEOF\nnode core/scripts/copies.mjs config/c.json") }),
  "a shell given its commands as one word and sudo are read as runs; a here-document's lines are never read as one, and naming the script they leave its run not read");
ok(notRead("copies", { "a.yml": coreCall("copies.yml", { config: "../../x.json", sizes: "s.json" }) }) && notRead("sizes", { "a.yml": coreCall("copies.yml", { config: "c.json", sizes: "/s.json" }) }),
  "a file a call names outside the project is not read");
// (the review of 94b6a6c: a "<<" that opens no here-document hides no line, a wrapper's and a shell's options pass, an
// action two workflows use counts for each, every file named outside the project is not read, the NuGet check's
// --imports reads no config, and a reading that throws leaves nothing kept)
ok(["read x <<< hello", "n=$((1<<k))", 'echo "a <<EOF b"', 'node -e "console.log(1 << 2)"', "cat <<OPEN"].every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json")
  && notRead("copies", { "a.yml": stepped("cat <<\\EOF > x\nnode core/scripts/copies.mjs config/doc.json\nEOF\nnode core/scripts/copies.mjs config/c.json") }),
  "a \"<<\" in quotes, in <<< or in arithmetic, and one with no line that ends it, leave out no line; one after a \"\\\" does");
ok(["sudo -E node core/scripts/copies.mjs config/c.json", 'bash -ec "node core/scripts/copies.mjs config/c.json"', 'pwsh -NoProfile -Command "node core/scripts/copies.mjs config/c.json"']
  .every(run => copiesOf({ "a.yml": stepped(run) }) === "config/c.json"), "a wrapper's and a shell's own options pass to the run");
const shared = { ".github/actions/t/action.yml": "runs:\n  using: composite\n  steps:\n    - run: node core/scripts/agent-tools.mjs l.json\n      shell: bash\n" };
ok(JSON.stringify(runsOwn(inMemory({ "a.yml": { jobs: { j: { steps: [{ uses: "./.github/actions/t" }] } } }, "b.yml": { jobs: { j: { steps: [{ run: "node core/scripts/licences.mjs l.json" }, { uses: "./.github/actions/t" }] } } } }, shared), "agent-tools.mjs").map(r => r.from))
  === JSON.stringify([".github/workflows/a.yml", ".github/workflows/b.yml"]), "an action two workflows use counts for each");
ok(notRead("packages", { "s.yml": coreCall("signatures.yml", { directory: "../x" }) }) && notRead("copies", {}, {}, "| *copies check* | `core/scripts/copies.mjs` with `../c.json` |\n")
  && notRead("sizes", {}, {}, "| *size marks* | `/abs/s.json` |\n") && notRead("copies", { "a.yml": coreCall("copies.yml", { config: "..\\x.json", sizes: "s.json" }) }),
  "a folder, a slot or a call's file outside the project, a Windows one too, is not read");
ok(nugetOf("node core/scripts/nuget.mjs --imports\nnode core/scripts/nuget.mjs config/n.json --packages restored") === "config/n.json", "the NuGet check run to list imports reads no config");
let failOnce = true;
const flaky = { ...inMemory({ "a.yml": { jobs: { j: { steps: [{ uses: "./.github/actions/t" }] } } }, "b.yml": stepped("node core/scripts/copies.mjs config/b.json") }), read: f => { if (failOnce) { failOnce = false; throw new Error("once"); } return null; } };
try { configs(flaky); } catch { /* (the first reading throws) */ }
ok(configs(flaky).copies === "config/b.json", "a reading that throws keeps nothing, so the next reads every step");
// (the review of eb6c597: every option of a wrapper passed, and a run behind one it cannot follow said not read; a
// here-document's end found in one pass; a "((" with no "))" opens two subshells; a path spelled for Windows in a call or a slot not read)
ok(copiesOf({ "a.yml": stepped("sudo -E -H node core/scripts/copies.mjs config/c.json") }) === "config/c.json"
  && notRead("copies", { "a.yml": stepped("sudo -u bot node core/scripts/copies.mjs config/c.json") }) && copiesOf({ "a.yml": stepped("bash -o pipefail -c 'node core/scripts/copies.mjs config/c.json'") }) === "config/c.json"
  && copiesOf({ "a.yml": stepped("pwsh -ExecutionPolicy Bypass -Command 'node core/scripts/copies.mjs config/c.json'") }) === "config/c.json",
  "every option of a wrapper is passed, a shell's options with their values too, and a run behind a wrapper's option's value is not read");
const opened = `${"cat <<EOF\n".repeat(20000)}node core/scripts/copies.mjs config/c.json`, started = Date.now();
ok(copiesOf({ "a.yml": stepped(opened) }) === "config/c.json" && Date.now() - started < 1500, "here-documents with no end leave every line read, in one pass", `${Date.now() - started} ms`);
ok(notRead("copies", { "a.yml": stepped("((echo a) ; cat <<EOF)\nnode core/scripts/copies.mjs config/doc.json\nEOF\nnode core/scripts/copies.mjs config/c.json") }), "a \"((\" with no \"))\" hides no here-document after it");
ok(notRead("copies", { "a.yml": coreCall("copies.yml", { config: "config\\c.json", sizes: "s.json" }) }) && notRead("packages", { "s.yml": coreCall("signatures.yml", { directory: "app\\web" }) })
  && notRead("copies", {}, {}, "| *copies check* | `core/scripts/copies.mjs` with `C:/c.json` |\n"), "a path a call or a slot spells for Windows is not read");
// (Codex's review of eb6c597: a redirection's file is no argument, a command after then or do is read, and a command
// string the outer shell fills is not read)
ok(["node core/scripts/copies.mjs > check.log config/c.json", "node core/scripts/copies.mjs 2>&1 config/c.json", "node core/scripts/copies.mjs 2> err.log config/c.json", "node core/scripts/copies.mjs &>out config/c.json",
  "if test -f config/c.json; then node core/scripts/copies.mjs config/c.json; fi", "for f in a; do node core/scripts/copies.mjs config/c.json; done", "node core/scripts/copies.mjs config/c.json < /dev/null"]
  .every(run => copiesOf({ "a.yml": stepped(run) }) === "config/c.json"), "a redirection's file is no argument, and a command after then or do is read");
ok(notRead("copies", { "a.yml": stepped(`bash -c "node core/scripts/copies.mjs '$CONFIG'"`) }), "a command string the outer shell fills when it runs is not read");
// (the review of 3537f48: a run behind a wrapper's option said not read only where a node run of the copy's script
// follows; and a long line of "((" read in one pass)
ok(["sudo chmod +x core/scripts/copies.mjs", "time echo core/scripts/copies.mjs", "sudo -u bot cp core/scripts/copies.mjs.bak y"]
  .every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json")
  && notRead("copies", { "a.yml": stepped("sudo -u node node core/scripts/copies.mjs config/c.json") }) && notRead("copies", { "a.yml": stepped("bash -e ci/run.sh core/scripts/copies.mjs") }) && notRead("copies", { "a.yml": stepped("sudo -u bot node tools/scripts/copies.mjs") }),
  "a wrapper's command that runs no node of the copy's script is no run, and one whose node the reader cannot place, or a file given it, is not read");
const parens = Date.now();
ok(copiesOf({ "a.yml": stepped(`${"(".repeat(400000)}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json" && Date.now() - parens < 1500, "a long line of \"((\" is read in one pass", `${Date.now() - parens} ms`);
// (the review of 2240d78 and 9246a3b: a node run behind a wrapper's option with node's own options, or held in one
// word, and one after a keyword, said not read; >| and {fd}> are redirections)
ok(["sudo -u bot node --no-warnings core/scripts/copies.mjs config/c.json", "sudo -u bot node -r x core/scripts/copies.mjs config/c.json", "env -S 'node core/scripts/copies.mjs config/c.json'",
  "if true; then sudo -u bot node core/scripts/copies.mjs config/c.json; fi", "for a in b; do sudo -u bot node core/scripts/copies.mjs config/c.json; done"]
  .every(run => notRead("copies", { "a.yml": stepped(run) })), "a node run behind a wrapper's option, with node's own options, in one word, or after a keyword, is not read");
ok(copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs >|log config/c.json") }) === "config/c.json" && copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs {fd}>log config/c.json") }) === "config/c.json",
  "a redirection that writes over a file, or names its descriptor, takes no argument");
// (Codex's review of 2240d78: a node run of the copy's script behind any word the reader does not know is not read; a
// brace expansion is filled when it runs; a companion run the reader cannot place proves nothing)
ok(notRead("copies", { "a.yml": stepped("timeout 60s node core/scripts/copies.mjs config/c.json") }) && notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs config/{copies,other}.json") })
  && copiesOf({ "a.yml": stepped('node core/scripts/copies.mjs "config/{c}.json"') }) === "config/{c}.json",
  "a node run of the script behind a word the reader does not know, and an unquoted brace expansion, are not read; a quoted brace is text");
const companion = STEPS.find(s => s.lead === "12 November 2026, exact versions");
let companionThrew = null;
try { companion.check(inMemory({ "a.yml": stepped("node core/scripts/licences.mjs l.json\ncd tools && node scripts/exact-versions.mjs l.json") }, { "package-lock.json": "{}" })); } catch (e) { companionThrew = e; }
ok(companionThrew instanceof Unread, "a companion run the reader cannot place is not read as the core's", String(companionThrew));
// (the review of 9358ea5: a word that only holds the script's name is no run, an expression ends the reading, and
// env's -S joined to its value is read)
ok(["time echo \"node core/scripts/copies.mjs config/c.json\"", "sudo chmod +x ${{ github.workspace }}/core/scripts/copies.mjs", "time echo ${{ github.workspace }}/core/scripts/copies.mjs"]
  .every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json"), "a word that only holds the script's name, quoted or filled by an expression, is no run");
ok(["env -S'node core/scripts/copies.mjs config/c.json'", "env --split-string='node core/scripts/copies.mjs config/c.json'"].every(run => notRead("copies", { "a.yml": stepped(run) })), "env's -S joined to the commands it splits is read as giving them");
ok(copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs '$GITHUB_WORKSPACE/config/c.json'") }) === "$GITHUB_WORKSPACE/config/c.json" && notRead("copies", { "a.yml": stepped("node '$GITHUB_WORKSPACE/core/scripts/copies.mjs' c.json") }),
  "the root's name in single quotes is text, never the root");
// (the review of 1dd5dbf: a shell's file and that file's arguments are never its own commands; a command that runs no
// script names it as text; env -S read only as env's; the exact-versions step asks of companions only where the licence
// check runs)
ok(["bash -e ./run.sh -c 'node core/scripts/copies.mjs other.json'", "bash -x script.sh -c 'node core/scripts/copies.mjs other.json'", "pwsh -File x.ps1 -Command 'node core/scripts/copies.mjs other.json'"]
  .every(line => notRead("copies", { "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }))
  && ["echo Then run node core/scripts/copies.mjs your.json", "echo env -S 'node core/scripts/copies.mjs x'"]
    .every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json"),
  "a shell's file given arguments that name the script is not read, never read as the file's; a command that runs no script gives no run");
const longEnv = Date.now();
ok(notRead("copies", { "a.yml": stepped(`env ${"-S ".repeat(20000)}'node core/scripts/copies.mjs c.json'`) }) && Date.now() - longEnv < 1500, "many of env's options are read in one pass", `${Date.now() - longEnv} ms`);
const versionsStep = STEPS.find(s => s.lead === "12 November 2026, exact versions");
ok(versionsStep.check(inMemory({ "a.yml": stepped("cd tools && node scripts/exact-versions.mjs x.json") }, { "package-lock.json": "{}" })) === null, "where the project runs no licence check of its own, a companion run it cannot place asks nothing");
// (the review of b6aaf95: a shell's options read so that its -c string is found, and a shell not given a file is not
// read silently; more commands that run no script; a wrapper that moves the folder)
ok(["sh -euo pipefail -c 'node core/scripts/copies.mjs config/c.json'", "bash -eo pipefail -c 'node core/scripts/copies.mjs config/c.json'", "pwsh -ep Bypass -Command 'node core/scripts/copies.mjs config/c.json'",
  "bash -ec -- 'node core/scripts/copies.mjs config/c.json'", "bash -ce 'node core/scripts/copies.mjs config/c.json'", "bash -c -o pipefail 'node core/scripts/copies.mjs config/c.json'",
  "powershell -NoProfile \"node core/scripts/copies.mjs config/c.json\"", "pwsh -CommandWithArgs 'node core/scripts/copies.mjs config/c.json'", "powershell -exec bypass -c 'node core/scripts/copies.mjs config/c.json'"]
  .every(run => copiesOf({ "a.yml": stepped(run) }) === "config/c.json"), "a shell's options, clustered, abbreviated or with --, leave its -c string read");
// (the commands that fetch or install, npx and curl, built from pieces, so that the licence check reads no tool here)
const NPX = ["np", "x"].join(""), CURL = ["cu", "rl"].join("");
ok(["sha256sum core/scripts/copies.mjs", "jq . core/scripts/copies.mjs", `${CURL} -d 'node core/scripts/copies.mjs' x`, "Write-Host core/scripts/copies.mjs"]
  .every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json"), "more commands that run no script name it as text");
ok(["env -C app node ../core/scripts/copies.mjs c.json", "env --chdir=app node ../core/scripts/copies.mjs c.json", "sudo -D app node ../core/scripts/copies.mjs c.json"].every(run => notRead("copies", { "a.yml": stepped(run) })),
  "a wrapper that runs the command in another folder leaves the run not read");
ok(notRead("copies", { "a.yml": stepped("source /dev/stdin <<'EOF'\nnode core/scripts/copies.mjs config/custom.json\nEOF") }) && notRead("copies", { "a.yml": stepped("bash <<EOF\nnode core/scripts/copies.mjs config/custom.json\nEOF") })
  && notRead("copies", { "a.yml": stepped("cat <<EOF > notes.md\nnode core/scripts/copies.mjs config/doc.json\nEOF\nnode core/scripts/copies.mjs config/c.json") }),
  "a here-document that names the script is not read, whatever it is fed to, since what it writes may be run");
// (the review of 744fb64: commands that run others, a path before the script in a string, PowerShell's other folder,
// and a long word, read in one pass)
ok([`${NPX} node core/scripts/copies.mjs config/c.json`, "find . -exec node core/scripts/copies.mjs config/c.json ';'", "timeout 60 bash -c 'node $GITHUB_WORKSPACE/core/scripts/copies.mjs config/c.json'",
  "timeout 60 bash -c 'cd app && node ../core/scripts/copies.mjs ../config/c.json'", "pwsh -wd app -c 'node core/scripts/copies.mjs config/c.json'", `${NPX} prettier --check core/scripts/copies.mjs`]
  .every(run => notRead("copies", { "a.yml": stepped(run) })), "a command that may run others, a string the reader cannot place, and PowerShell run elsewhere, are not read");
const wordy = Date.now();
ok(notRead("copies", { "a.yml": stepped(`timeout 1 '${"node ".repeat(40000)}x' core/scripts/copies.mjs`) }) && Date.now() - wordy < 1500, "a long word is read in one pass", `${Date.now() - wordy} ms`);
// (the review of be09443 and 814895c: every naming of the script a step holds is accounted for, or the run is not
// read: a here-document piped to a shell or written to a file run later, a here-string, PowerShell's -Command given
// words, a folder changed by Push-Location)
ok(["cat <<'EOF' | bash\nnode core/scripts/copies.mjs config/custom.json\nEOF", "cat > run.sh <<'EOF'\nnode core/scripts/copies.mjs config/custom.json\nEOF\nbash run.sh",
  "bash <<<'node core/scripts/copies.mjs config/custom.json'", "pwsh -c node core/scripts/copies.mjs config/custom.json", "powershell -NoProfile -Command node ./core/scripts/copies.mjs config/custom.json",
  "pwsh -c 'Push-Location app; node ../core/scripts/copies.mjs ../config/custom.json'"].every(run => notRead("copies", { "a.yml": stepped(run) })),
  "a naming of the script the reader does not account for leaves the run not read, in whatever form of the shell's");
// (on the parser, #530: a command in $( ) or ` ` is a command, as the reader's definition parts commands at ( and ), and
// its run is read as any other)
ok(copiesOf({ "a.yml": stepped('echo "$(node core/scripts/copies.mjs config/custom.json)"') }) === "config/custom.json" && copiesOf({ "a.yml": stepped("echo `node core/scripts/copies.mjs config/custom.json`") }) === "config/custom.json",
  "a command whose output a line takes runs the script all the same, and is read as its run");
// (the review of 6757c34: commands that can run another are no text; every naming of scripts/<name> is counted, as
// a run's is matched; quotes read in one pass)
ok(["awk 'BEGIN{system(\"node core/scripts/copies.mjs bad.json\")}'", "git -c alias.r='!node core/scripts/copies.mjs bad.json' r", "sed -n '1e node core/scripts/copies.mjs bad.json' x",
  "node core//scripts/copies.mjs good.json\ntimeout 60 node core/scripts/copies.mjs bad.json", "timeout 60 node \"$CORE_AT\"scripts/copies.mjs bad.json",
  "pwsh -c 'Push-Location app; node ../core/scripts/copies.mjs ../config/custom.json'"].every(run => notRead("copies", { "a.yml": stepped(run) })),
  "a command that can run another, a second naming beside a read run, a path joined to a variable and a folder pushed are not read");
const quotes = Date.now();
ok(copiesOf({ "a.yml": stepped(`echo core/scripts/copies.mjs ${"\"\\".repeat(80000)}`) }) === "checks/copies.json" && Date.now() - quotes < 1500, "quotes are read in one pass", `${Date.now() - quotes} ms`);
// (the review of 3085de7: a naming of scripts/<name> by any path, in any case or with quotes, ./ or // inside, is
// counted; commands that can set up a run are no text)
ok(["node my_scripts/copies.mjs x.json\ntimeout 60 node core/scripts/copies.mjs bad.json", "node ~/work/p/core/scripts/copies.mjs bad.json", "node Core/scripts/copies.mjs bad.json",
  "node core/scripts/\"copies.mjs\" good.json\ntimeout 60 node core/scripts/copies.mjs bad.json", "node core/scripts/./copies.mjs bad.json\ntimeout 60 node core/scripts/copies.mjs x.json",
  "gh alias set r '!node core/scripts/copies.mjs bad.json'\ngh r", "export NODE_OPTIONS='--import=./core/scripts/copies.mjs'\nnode x.mjs bad.json", "cp core/scripts/copies.mjs x.mjs\nnode x.mjs bad.json"]
  .every(run => notRead("copies", { "a.yml": stepped(run) })), "a naming by any other path, case, quote or ./ in it, and a command that sets up a run, leave the run not read");
ok(copiesOf({ "a.yml": stepped("node core/scripts//copies.mjs config/c.json") }) === "config/c.json", "a path with // in it is read as the copy's");
// (the review of 8b368b1: a naming however it ends, set in passing or in env:, in another case or spelling, and a run
// by a path the reader cannot place, are not read; node --test $RUN, which names no script, reads as before)
const withEnv = (run, env) => ({ "a.yml": { jobs: { j: { steps: [{ run, env }] } } } });
ok(["S=${S:-core/scripts/copies.mjs}\nnode $S bad.json", "x=`echo core/scripts/copies.mjs`\nnode $x bad.json", "printf -v S core/scripts/copies.mjs\nnode $S bad.json",
  ": ${S:=core/scripts/copies.mjs}\nnode $S bad.json", "node core/Scripts/copies.mjs bad.json", "node core/scripts/Copies.mjs bad.json",
  "node core/scripts/{copies,}.mjs bad.json", "cd core/scripts && node copies.mjs bad.json", `${CURL} -so x.mjs file://$PWD/core/scripts/copies.mjs\nnode x.mjs bad.json`]
  .every(run => notRead("copies", { "a.yml": stepped(run) })) && notRead("copies", withEnv("node $S bad.json", { S: "core/scripts/copies.mjs" }))
  && copiesOf({ "a.yml": stepped("node --test $RUN\nnode core/scripts/copies.mjs config/c.json") }) === "config/c.json" && copiesOf({ "a.yml": stepped("node core/scripts/x/../copies.mjs c.json") }) === "c.json",
  "a naming however it ends, set in passing or in env:, in another case or spelling, and a run the reader cannot place, are not read; node --test $RUN is no run of it, and core/scripts/x/../copies.mjs is the copy's");
// (the review of 35e05e0: what a step is given beside its run, read safely and once: an env: of any shape, a matrix, a
// local workflow's call)
ok(copiesOf(withEnv("node core/scripts/copies.mjs config/c.json", { S: { toString: "x", valueOf: "y" } })) === "config/c.json"
  && notRead("copies", { "a.yml": { jobs: { j: { strategy: { matrix: { script: ["core/scripts/copies.mjs"] } }, steps: [{ run: "node ${{ matrix.script }} bad.json" }] } } } })
  && notRead("copies", { "a.yml": { jobs: { c: { uses: "./.github/workflows/b.yml", with: { script: "core/scripts/copies.mjs" } } } }, "b.yml": stepped("node ${{ inputs.script }} bad.json") }),
  "an env: of any shape is read without a throw; a matrix or a local workflow's call that names the script leaves its run not read");
const manyEnv = Object.fromEntries(Array.from({ length: 2000 }, (_, k) => [`E${k}`, `v${k}`]));
const manySteps = Array.from({ length: 2000 }, (_, k) => ({ run: `echo ${k}` }));
const envStarted = Date.now();
ok(copiesOf({ "a.yml": { env: manyEnv, jobs: { j: { env: manyEnv, steps: manySteps } } } }) === "checks/copies.json" && Date.now() - envStarted < 3000, "a workflow's and a job's env: are read once, however many steps", `${Date.now() - envStarted} ms`);
ok(notRead("copies", { "a.yml": stepped('node "$GITHUB_WORKSPACE/core/scripts/copies.mjs" c.json', { "working-directory": "app\\dir" }) }), "a folder with \"\\\" in it is not read as one");
// (the review of b69d16f: a script given by an expression of GitHub's, or in a mapping too large to read whole, and a
// key named __proto__, leave the run not read)
ok(notRead("copies", { "a.yml": stepped("node ${{ inputs.script }} bad.json") }) && notRead("copies", { "a.yml": stepped("node ${{ needs.a.outputs.s }} bad.json") })
  && notRead("copies", { "a.yml": { jobs: { j: { strategy: { matrix: { s: Array.from({ length: 100001 }, (_, k) => `v${k}`) } }, steps: [{ run: "echo x" }] } } } })
  && notRead("copies", { "a.yml": { jobs: { j: { steps: [{ run: "node $__proto__ bad.json", env: parseYaml("__proto__: core/scripts/copies.mjs\n") }] } } } }),
  "a script given by an expression of GitHub's, a mapping too large to read whole, and a key named __proto__ leave the run not read");
// (Codex's review of 8237183 and the review after it: a local action's steps are given what its caller is given; a
// file of another plain name past an expression is no run of the script)
ok(notRead("copies", { "a.yml": { env: { CHECK: "core/scripts/copies.mjs" }, jobs: { j: { steps: [{ uses: "./.github/actions/c" }] } } } }, { ".github/actions/c/action.yml": "runs:\n  using: composite\n  steps:\n    - run: node \"$CHECK\" config/custom.json\n      shell: bash\n" })
  && copiesOf({ "a.yml": stepped("node ${{ github.action_path }}/index.js\nnode core/scripts/copies.mjs config/c.json") }) === "config/c.json",
  "a local action is read with what its caller gives it; a file of another plain name past an expression is no run of the script");
// (the review of 165db25: actions read once, and their steps, calls and depth bounded; a glob or a "/" after the name)
const fanFiles = { ".github/actions/a/action.yml": `runs:\n  using: composite\n  steps:\n${"    - uses: ./.github/actions/b\n".repeat(1999)}`, ".github/actions/b/action.yml": `runs:\n  using: composite\n  steps:\n${"    - run: echo x\n      shell: bash\n".repeat(2000)}` };
const fanStarted = Date.now();
ok(notRead("copies", { "a.yml": { jobs: { j: { steps: [{ uses: "./.github/actions/a" }] } } } }, fanFiles) && Date.now() - fanStarted < 5000, "actions called thousands of times are read once each, and past the bound the run is not read", `${Date.now() - fanStarted} ms`);
const chainFiles = Object.fromEntries(Array.from({ length: 2000 }, (_, k) => [`.github/actions/c${k}/action.yml`, `runs:\n  using: composite\n  steps:\n${"    - run: echo x\n      shell: bash\n".repeat(50)}    - uses: ./.github/actions/c${k + 1}\n`]));
const chainStarted = Date.now();
ok(notRead("copies", { "a.yml": { env: { A: "x" }, jobs: { j: { steps: [{ uses: "./.github/actions/c0" }] } } } }, chainFiles) && Date.now() - chainStarted < 5000, "a long chain of actions is read no deeper than the bound", `${Date.now() - chainStarted} ms`);
ok(['node "$CORE"/scripts/copies.mj? c.json', "node $CORE/scripts/copie[s].mjs c.json", "node $CORE/scripts/copies.* c.json", "node $C/copies.mjs/ c.json", "node ${{ github.action_path }}/copies.mjs/ c.json", "node core/scripts/copies.mj? c.json"]
  .every(run => notRead("copies", { "a.yml": stepped(run) })) && copiesOf({ "a.yml": stepped("node --test tests/*.mjs\nnode core/scripts/copies.mjs config/c.json") }) === "config/c.json",
  "a glob or a \"/\" after the script's name leaves the run not read; a glob in a folder that is no scripts folder is no run of it");
// (the review of f1663f5: a glob in the script's own name matched against the script's; what a step is given counted
// through the shared lists, never flattened again)
ok(["node copies.mj? c.json", "node ./copies.* c.json", "node * c.json", "node $D/copies.mj? c.json"].every(run => notRead("copies", { "a.yml": stepped(run, { "working-directory": "core/scripts" }) }))
  && ["node --test **/*.test.mjs", 'node --test "**/*.test.mjs"', "node --test test/**/*.mjs", "node --test scripts/*.test.mjs"].every(line => copiesOf({ "a.yml": stepped(`${line}\nnode core/scripts/copies.mjs config/c.json`) }) === "config/c.json"),
  "a glob that can match the script's name, in its folder, is not read; one that cannot is no run of it");
// (the review of 8b78d8e: a glob after a cd or in a folder named only when it runs is not read, never a throw; a glob
// of many stars is read in one pass; braces, classes and ** may match)
ok(["cd app && node core/scripts/c*.mjs c.json", "pushd x; node ../core/scripts/copies.mj? c.json", "node core/scripts/{cop*,x}.mjs c.json", "node core/scripts/[[:alpha:]]opies.mjs c.json", "node core/**/s*/c*.mjs c.json"]
  .every(run => notRead("copies", { "a.yml": stepped(run) })) && notRead("copies", { "a.yml": stepped("node s*/c*.mjs c.json", { "working-directory": "${{ inputs.d }}" }) }),
  "a glob after a cd, in a folder named only when it runs, or with braces, a class or ** that may match, is not read");
const stars = Date.now();
ok(notRead("copies", { "a.yml": stepped(`node core/scripts/${"*".repeat(40)}x c.json\nnode core/${"*".repeat(40)}/copies.mjs c.json`) }) && Date.now() - stars < 1500, "a glob of many stars is read in one pass", `${Date.now() - stars} ms`);
// (the review of 5f229be: any class may match, read in one pass; a folder's "/" at its end is no other folder)
const classes = Date.now();
ok(["core/scripts/copie[]s].mjs", "core/scripts/copie[!]a].mjs", "core/scripts/[a[:alpha:]]opies.mjs", "core/scripts/[^[:digit:]]opies.mjs", `core/scripts/${"[a".repeat(100000)}]x`]
  .every(f => notRead("copies", { "a.yml": stepped(`node ${f} c.json`) })) && notRead("copies", { "a.yml": stepped("node copies.mj? c.json", { "working-directory": "core/scripts/" }) }) && Date.now() - classes < 3000,
  "a class in any form may match, read in one pass; a folder named with a \"/\" at its end is that folder", `${Date.now() - classes} ms`);
ok(configs(inMemory({ "a.yml": stepped("node core/scripts/reading-size.mjs config/sizes*.json") })).sizes === null && notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs config/c?.json") })
  && copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs 'config/c*.json'") }) === "config/c*.json", "a config given as an unquoted glob is not read; a quoted one is a file's name");
// (the review of 3546fd8: an extended glob of bash's may match; a run of "/" is read in one pass)
ok(["c?(x)opies.mjs", "+(c)opies*.mjs", "!(x)*.mjs", "@(copies|x).mjs", "!(x).mjs", "copies.@(mjs)"].every(f => notRead("copies", { "a.yml": stepped(`shopt -s extglob\nnode core/scripts/${f} c.json`) }))
  && ["core/?(x)scripts/c*.mjs", "core/@(scripts)/c*.mjs"].every(f => notRead("copies", { "a.yml": stepped(`shopt -s extglob\nnode ${f} c.json`) })),
  "an extended glob of bash's, in the script's name or its folder, may match, so the run is not read");
const slashes = Date.now();
ok(copiesOf({ "a.yml": stepped(`node core/scripts${"/".repeat(100000)}x*.mjs c.json\nnode core/scripts/copies.mjs c.json`) }) === "c.json" && Date.now() - slashes < 1500, "a run of \"/\" is read in one pass", `${Date.now() - slashes} ms`);
const globs = Date.now();
// (on the parser, #530: a text the grammar cannot read within its time is not read at all, since a line read alone
// would misread a quote or a continued line over it; the fallback reviewer's review of 4ffb50d)
ok(notRead("copies", { "a.yml": stepped(`echo ${"a?(b)".repeat(100000)}\nnode core/scripts/copies.mjs c.json`) }) && Date.now() - globs < 1500, "a long line of extended globs leaves its step not read, within the time mark", `${Date.now() - globs} ms`);
const bigEnv = Object.fromEntries(Array.from({ length: 99000 }, (_, k) => [`E${k}`, `v${k}`]));
const oneRun = { ".github/actions/a/action.yml": "runs:\n  using: composite\n  steps:\n    - run: echo x\n      shell: bash\n" };
const givenStarted = Date.now();
ok(copiesOf({ "a.yml": { jobs: { j: { env: bigEnv, steps: Array.from({ length: 200 }, () => ({ uses: "./.github/actions/a" })) } } } }, oneRun) === "checks/copies.json" && Date.now() - givenStarted < 5000,
  "a large env: given to many calls of an action is read once", `${Date.now() - givenStarted} ms`);
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
}
// the files that point from the paths the rules left: each names a file or a folder the core holds, and what one says
// stands elsewhere than the rest of it stands there
const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const there = to => fs.existsSync(path.join(coreRoot, to)) && fs.statSync(path.join(coreRoot, to)).isDirectory() === to.endsWith("/");
ok(Object.keys(moved()).length > 0 && Object.values(moved()).every(there) && Object.values(moved.apart()).flat().every(a => there(a.to) && fs.readFileSync(path.join(coreRoot, a.to), "utf8").includes(`**${a.lead}**`)),
  "each file at a path the rules left names a file or a folder that stands, and a rule it says stands elsewhere stands there", JSON.stringify([moved(), moved.apart()]));

// the agent tools' files step: where the copies or pointer check cannot run to its verdict, it is not read, never done
{
  const step = STEPS.find(s => s.lead === "16 November 2026, the agent tools' files read for copies and pointers"), d = dirs["an-npm-project"];
  const unread = () => { try { step.check(project(d)); return ""; } catch (e) { return e instanceof Unread ? e.message : `${e}`; } };
  const cfg = path.join(d, "checks/copies.json"), was = fs.readFileSync(cfg, "utf8");
  fs.writeFileSync(cfg, "{ not json");
  let said = unread();
  fs.writeFileSync(cfg, was);
  ok(/the copies check did not run to its verdict on checks\/copies\.json/.test(said), "where the copies check stops before its verdict, the step is not read", said);
  for (const script of ["copies.mjs", "pointers.mjs"]) {
    const at = path.join(d, "core/scripts", script);
    fs.renameSync(at, `${at}.away`);
    said = unread();
    fs.renameSync(`${at}.away`, at);
    ok(said === `no copy of ${script} to run`, `with no copy of ${script}, the step is not read`, said);
  }
  if (process.platform !== "win32") {
    const outside = path.join(tmp, "copies-outside.json");
    fs.writeFileSync(outside, was); fs.rmSync(cfg); fs.symlinkSync(outside, cfg);
    said = unread();
    fs.rmSync(cfg); fs.writeFileSync(cfg, was);
    ok(/the copies check's config `checks\/copies\.json` is no regular file of the project's own/.test(said), "a copies config whose link leads out of the project is not handed to the check", said);
  }
  ok(step.check(project(d)) === null, "and with each put back, the starter kit's project has nothing to list", step.check(project(d)) ?? "");
  if (process.platform !== "win32") {
    // (a tracked link to a file git does not track: what the step says follows that file, read through the link)
    fs.mkdirSync(path.join(d, "notes"), { recursive: true });
    fs.writeFileSync(path.join(d, "notes/g.md"), "# G\n\nAs `docs/nowhere-g.md` says.\n");
    fs.symlinkSync("../../notes/g.md", path.join(d, ".kiro/steering/g.md"));
    execFileSync("git", ["add", ".kiro/steering/g.md"], { cwd: d });
    const before = step.check(project(d)) ?? "";
    fs.writeFileSync(path.join(d, "notes/g.md"), "# G\n\nAs `AGENTS.md` says.\n");
    const after = step.check(project(d));
    execFileSync("git", ["rm", "-q", "-f", ".kiro/steering/g.md"], { cwd: d }); fs.rmSync(path.join(d, "notes"), { recursive: true });
    ok(before.includes(".kiro/steering/g.md:3") && after === null, "a broken pointer in a tool's file that links to a file git does not track is named, and once that file is mended, no longer", `${before}\n${after}`);
    // (a tracked link to a device, or to a file outside the project, is never opened: the step reads on)
    fs.symlinkSync("/dev/zero", path.join(d, "zero")); fs.symlinkSync(path.join(tmp, "copies-outside.json"), path.join(d, "outside.json"));
    execFileSync("git", ["add", "zero", "outside.json"], { cwd: d });
    const linked = step.check(project(d));
    execFileSync("git", ["rm", "-q", "-f", "zero", "outside.json"], { cwd: d });
    ok(linked === null, "a tracked link to a device or to a file outside the project is never opened, and the step reads on", `${linked}`);
  }
}

// ---- a call that skips a draft is read in every form of its trigger (#375) ----
{
  const step = STEPS.find(s => s.lead === "16 November 2026, checks once a pull request is ready");
  const call = (on, types = "") => { const text = `name: core\n\non:${on}${types}\n\njobs:\n  core:\n    if: \${{ !github.event.pull_request.draft }}\n    uses: ${CORE}/.github/workflows/core.yml@${PIN}\n`; return { workflows: { "core.yml": { text, yaml: parseYaml(text) } } }; };
  const reported = ["  pull_request", " pull_request", " [push, pull_request]", "\n  pull_request:", "\n  pull_request:\n    types: [opened, synchronize]"].filter(on => step.check(call(on)));
  ok(reported.length === 5 && !step.check(call("\n  pull_request:\n    types: [opened, reopened, synchronize, ready_for_review]")) && !step.check(call("\n  push:")),
    "a call that skips its job on a draft is reported wherever its pull_request trigger leaves ready_for_review out, in each form `on:` takes, and read done where it lists it or where no pull request starts it", reported.join(" | "));
}

// ---- a call to core.yml that folds part of the one job: what it leaves out, and what it runs twice (#376) ----
{
  const step = STEPS.find(s => s.lead === "17 November 2026, the checks as one job");
  const wf = (name, uses, w = "") => [name, { text: `jobs:\n  j:\n    uses: ${CORE}/.github/workflows/${uses}@${PIN}\n${w}`, yaml: parseYaml(`jobs:\n  j:\n    uses: ${CORE}/.github/workflows/${uses}@${PIN}\n${w}`) }];
  const of = (...files) => step.check({ workflows: Object.fromEntries(files), files: [], read: () => null, root: "." });
  const all = "    with:\n      copies: c.json\n      sizes: s.json\n      description: true\n      signatures: web\n";
  ok(of(wf("core.yml", "core.yml")) === null && of(wf("core.yml", "core.yml", all)) === null && of(wf("core.yml", "core.yml", "    with:\n      signatures: web\n"), wf("copies.yml", "copies.yml"), wf("d.yml", "pr-description.yml")) === null,
    "a call to core.yml alone, or one that folds each check, or one whose other checks are still called on their own, reads done");
  const left = of(wf("core.yml", "core.yml", "    with:\n      description: true\n")), twice = of(wf("core.yml", "core.yml", all), wf("s.yml", "signatures.yml")), bare = of(wf("core.yml", "core.yml", "    with:\n      copies: c.json\n      description: true\n"));
  ok(/pass it `copies: checks\/copies\.json`/.test(left ?? "") && /`signatures\.yml`, which its `signatures:` runs too/.test(twice ?? "") && /`sizes: checks\/sizes\.json` beside its `copies:`/.test(bare ?? ""),
    "one that leaves the copies checks out, runs the signature check twice, or passes copies without its marks is reported, each with its mend", [left, twice, bare].join("\n"));
}

// ---- a step's commands on the parser's bash grammar (bash-commands.mjs; #530, item 3): where the grammar the core
// installs reads otherwise than bash, the reader mends it from the tree ----
{
  const { bashCommands } = await import("../scripts/bash-commands.mjs");
  const shown = run => bashCommands(run).map(c => c.map(w => `${w.text}${w.dynamic ? "*" : ""}`).join(" "));
  ok(JSON.stringify(shown("a=1 b=2\nnode core/scripts/copies.mjs c.json")) === JSON.stringify(["a=1 b=2", "node core/scripts/copies.mjs c.json"]),
    "assignments on a line of their own are a command apart from the next line's, where the grammar joins them");
  ok(JSON.stringify(shown("node core/scripts/copies.mjs > log c.json 2>&1 d.json")) === JSON.stringify(["node core/scripts/copies.mjs c.json d.json"]),
    "the words after a redirection's file are the command's arguments, as bash gives them, where the grammar gives them to the redirection");
  ok(JSON.stringify(shown("node core/scripts/c?(x)opies.mjs c.json")) === JSON.stringify(["node core/scripts/c?(x)opies.mjs* c.json"]) && JSON.stringify(shown('echo "a?(b)"')) === JSON.stringify(["echo a?(b)"]),
    "an extended glob is part of its word, filled when it runs, where the grammar reads a subshell; in quotes it is text");
  ok(JSON.stringify(shown("echo ${{ inputs.a }}x 'y${{ b }}'\ncat <<EOF\nnode no\nEOF\nnode yes")) === JSON.stringify(["echo ${{ inputs.a }}x* y${{ b }}*", "cat", "node yes"]),
    "an expression of GitHub's is filled when it runs, quoted or not, and a here-document's lines are no commands");
  ok(JSON.stringify(shown("cat <<OPEN\nnode core/scripts/copies.mjs c.json")) === JSON.stringify(["cat", "node core/scripts/copies.mjs c.json"]),
    "a here-document with no line that ends it leaves its lines read as commands, so that no run is missed");
  ok(JSON.stringify(shown('echo "$(node a.mjs)" `node b.mjs`')) === JSON.stringify(['echo $(node a.mjs)* `node b.mjs`*', "node a.mjs", "node b.mjs"]),
    "a command inside $( ) or ` ` is a command of its own, its output a word filled when it runs");
  // (Codex's security review of 76119ae: "!" turns a command's status over, so a check run under it cannot fail)
  ok(JSON.stringify(shown("! node core/scripts/lookup.mjs c.json\nif ! node a.mjs; then x; fi")) === JSON.stringify(["! node core/scripts/lookup.mjs c.json", "! node a.mjs", "x"])
    && notRead("copies", { "a.yml": stepped("! node core/scripts/copies.mjs config/c.json") }),
    "a command led by \"!\" keeps it as its first word, and a check's run under it is not read as its run");
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions`);
process.exitCode = failed ? 1 : 0;
