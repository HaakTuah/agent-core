// Tests the readers of the steps that read when and how the checks run (step-checks-tests.mjs, step-checks-ready.mjs and
// step-checks-shape.mjs, with steps.mjs): the strength check's run, a suite's path filter, a tree that passed, a shape
// baseline written before the check read more languages, a call that skips a draft and a call that folds the one job. On
// the project the starter kit of this commit writes in a scratch folder. Node's own modules and git.
//
//   node tests/steps-checks-run-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { READERS } from "../scripts/shape-readers.mjs";
import { parseYaml } from "../scripts/parse-yaml.mjs";
import { pathsLetThrough } from "../scripts/workflow-run.mjs";
import { STEPS, notDone, project, report } from "../scripts/steps.mjs";
import { PIN, kitIn, linear } from "../scripts/steps-kit.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-checks-run-");
const kit = kitIn(tmp);
const only = lead => STEPS.filter(s => s.lead === lead);
// (the kit's npm project, every step done as the starter kit writes it: what the first of the main test's sections stand on)
const lockProject = kit("an-npm-project", { packages: "." });
const dirs = { "an-npm-project": lockProject };

// (a named tool is done only where a workflow on pull requests runs the check with its base)
{
  const dir = dirs["an-npm-project"], manifest = path.join(dir, "core-manifest.md"), was = fs.readFileSync(manifest, "utf8");
  const step = STEPS.find(s => s.lead === "16 November 2026, how strong the tests are"), flow = path.join(dir, ".github/workflows/strength.yml");
  fs.writeFileSync(manifest, was.replace(/^\| \*mutation tool\* \|.*$/m, "| *mutation tool* | `node core/scripts/mutate.mjs --report {report} {lines}` |"));
  const said = body => { fs.writeFileSync(flow, `name: strength\non:\n  pull_request:\njobs:\n  tests:\n    runs-on: ubuntu-latest\n    steps:\n${body}`); return step.check(project(dir)); };
  const comment = said("      # TODO: node core/scripts/strength.mjs\n      - run: echo later\n");
  const bare = said("      - run: node core/scripts/strength.mjs\n");
  const runs = said("      - run: node core/scripts/strength.mjs\n        env:\n          STRENGTH_BASE: origin/main\n");
  const inline = said("      - run: STRENGTH_BASE=origin/main node core/scripts/strength.mjs\n");
  const exported = said("      - run: |\n          export STRENGTH_BASE=origin/${{ github.base_ref }}\n          node core/scripts/strength.mjs\n");
  const empty = said("      - run: STRENGTH_BASE= node core/scripts/strength.mjs\n");
  const quoted = said("      - run: STRENGTH_BASE=\"\" node core/scripts/strength.mjs\n");
  const commented = said("      - run: |\n          # STRENGTH_BASE=origin/main\n          node core/scripts/strength.mjs\n");
  ok(inline === null && exported === null && empty !== null && quoted !== null && commented !== null, "a base set inline in the step's script counts as given, an empty one or one in a comment does not", `${inline}\n${exported}\n${empty}\n${quoted}\n${commented}`);
  ok(comment !== null && bare !== null && runs === null, "a named mutation tool reads done only where a workflow on pull requests runs the strength check with its base, never where one only mentions it", `${comment}\n${bare}\n${runs}`);
  fs.writeFileSync(manifest, was); fs.rmSync(flow);
}
// (the starter kit's `none`: no tests yet stands until the project's own code holds a test)
{
  const dir = dirs["an-npm-project"], test = path.join(dir, "src", "first.test.js");
  fs.mkdirSync(path.dirname(test), { recursive: true });
  fs.writeFileSync(test, "export {};\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const said = notDone(dir, only("16 November 2026, how strong the tests are")).find(s => s.lead === "16 November 2026, how strong the tests are");
  ok(said?.mend.includes("has tests now"), "the starter kit's mutation-tool row, none for no tests yet, is reported once the project's own code holds a test", JSON.stringify(said));
  execFileSync("git", ["rm", "-q", "--cached", "src/first.test.js"], { cwd: dir });
  fs.rmSync(test);
  // (a test folder the config names beside its code, not inside it: its tests count too)
  const config = path.join(dir, "checks/shape.json"), was = fs.readFileSync(config, "utf8"), apart = path.join(dir, "test", "a.js");
  fs.writeFileSync(config, `${JSON.stringify({ ...JSON.parse(was), code: ["src"], tests: ["test"] }, null, 2)}\n`);
  fs.mkdirSync(path.dirname(apart), { recursive: true }); fs.writeFileSync(apart, "export {};\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const beside = notDone(dir, only("16 November 2026, how strong the tests are")).find(s => s.lead === "16 November 2026, how strong the tests are");
  ok(beside?.mend.includes("has tests now"), "and once a test stands in a folder of tests the config names apart from its code", JSON.stringify(beside));
  execFileSync("git", ["rm", "-q", "--cached", "test/a.js"], { cwd: dir });
  fs.rmSync(path.join(dir, "test"), { recursive: true }); fs.writeFileSync(config, was);
  execFileSync("git", ["add", "-A"], { cwd: dir });
}

// ---- a suite's path filter, read as GitHub reads one: `?` and `+` repeat the character before them (#379) ----
const SUITE_LEAD = "12 November 2026, a sync and the project's own suites";
const suiteFile = path.join(lockProject, ".github/workflows/suites-filtered.yml");
const suiteBy = filter => { fs.writeFileSync(suiteFile, `name: s\non:\n  pull_request:\n${filter}\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo t\n`); return notDone(lockProject, only(SUITE_LEAD)).some(m => m.lead === SUITE_LEAD); };
ok(suiteBy("    paths: ['.github/workflows/core.ya?ml']") && suiteBy("    paths: ['.github/workflows/co+re.yml']") && !suiteBy("    paths: ['.github/workflows/core\\?.yml']")
  && suiteBy("    paths-ignore: ['core/**']") && !suiteBy("    paths: ['src/**']"), "a suite whose filter starts on a call's file alone is reported, its `?` and `+` read as GitHub reads them");
{
  // (a stand-in, its `paths` a suite's `paths-ignore` in another order, so that a check a ruleset asks for reports where the
  // suite is skipped, is left out; one whose `paths` differ is a suite: #1248, point 3)
  const list = order => `[${order.map(p => `'${p}'`).join(", ")}]`, kept = ["core/**", "core-manifest.md", ".github/workflows/core.yml"];
  const standIn = path.join(lockProject, ".github/workflows/stand-in.yml"), named = () => notDone(lockProject, only(SUITE_LEAD)).find(m => m.lead === SUITE_LEAD)?.mend ?? "";
  const put = (paths, job = "t") => fs.writeFileSync(standIn, `name: s\non:\n  pull_request:\n    paths: ${paths}\njobs:\n  ${job}:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo stand-in\n`);
  suiteBy(`    paths-ignore: ${list(kept)}`);
  put(list([...kept].reverse()));
  const left = !named().includes("stand-in.yml");
  put(list([...kept].reverse()), "other-tests");
  const otherJobs = named().includes("stand-in.yml");
  put(list([...kept, "src/**"]));
  ok(left && otherJobs && !named().includes("stand-in.yml"), "a workflow whose `paths` are a suite's `paths-ignore`, or more, its jobs the suite's, stands in for it and is left out; one whose jobs differ is reported", named());
  // (a stand-in reports only the check a ruleset asks for, one job of a suite of several; its `paths` cover the suite's
  // `paths-ignore`, a path more among them; one that leaves a path out, or whose job's name no reader tells exactly, a
  // matrix's or an expression's, is reported, and the mend never asks a stand-in to take a path out: #1260)
  const suiteJobs = jobs => fs.writeFileSync(suiteFile, `name: s\non:\n  pull_request:\n    paths-ignore: ${list(kept)}\njobs:\n${jobs.map(j => `  ${j}:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ${j}\n`).join("")}`);
  suiteJobs(["t", "lint", "build"]);
  put(list([...kept].reverse()));
  const oneOfSeveral = !named().includes("stand-in.yml");
  put(list([...kept, "docs/**"]));
  const covers = !named().includes("stand-in.yml");
  put(list(kept.slice(1)), "t");
  const short = named();
  fs.writeFileSync(standIn, `name: s\non:\n  pull_request:\n    paths: ${list(kept)}\njobs:\n  t:\n    strategy:\n      matrix:\n        os: [ubuntu-latest]\n    runs-on: \${{ matrix.os }}\n    steps:\n      - run: echo stand-in\n`);
  const matrix = named().includes("stand-in.yml");
  fs.writeFileSync(standIn, `name: s\non:\n  pull_request:\n    paths: ${list(kept)}\njobs:\n  t:\n    name: \${{ github.workflow }}\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo stand-in\n`);
  const expression = named().includes("stand-in.yml");
  ok(oneOfSeveral && covers && short.includes("stand-in.yml") && matrix && expression && /gains the same paths under its `paths`, never `!<its path>`/.test(short),
    "a stand-in reporting one check of a suite of several, its `paths` covering the suite's `paths-ignore`, is left out; one that leaves a path out, or whose job's name is a matrix's or an expression's, is reported, the mend never taking a stand-in's path out", short);
  // (a matrix job whose names GitHub reports, `test (…)`, no check of the suite's can share is a suite, its mend the
  // ordinary one that does the step; an expression's name may be any, so it may still stand in: #1260, a review's finding)
  suiteJobs(["lint"]);
  fs.writeFileSync(standIn, `name: s\non:\n  pull_request:\n    paths: ['src/**', '.github/workflows/**']\njobs:\n  test:\n    strategy:\n      matrix:\n        os: [ubuntu-latest]\n    runs-on: \${{ matrix.os }}\n    steps:\n      - run: echo t\n`);
  const unshared = named();
  fs.writeFileSync(standIn, `name: s\non:\n  pull_request:\n    paths: ['src/**', '.github/workflows/**']\njobs:\n  test:\n    name: \${{ github.workflow }}\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo t\n`);
  const anyName = named();
  ok(/takes each out with `!<its path>`[^]*stand-in\.yml/u.test(unshared) && !/may stand in[^]*stand-in\.yml/u.test(unshared) && /may stand in[^]*stand-in\.yml/u.test(anyName),
    "a workflow with `paths` whose matrix job no check of a suite's can share gets the mend that does the step; one whose job's name is an expression may still stand in", `${unshared}\n${anyName}`);
  fs.rmSync(standIn);
}
fs.rmSync(suiteFile);
ok(pathsLetThrough(["+x.yml"], ["+x.yml"]) && pathsLetThrough(["?y.yml"], ["?y.yml"]) && pathsLetThrough(["a[b.yml"], ["a[b.yml"])
  && pathsLetThrough(["c]d.yml"], ["c]d.yml"]) && pathsLetThrough(["dir/+e"], ["dir//e"]) && !pathsLetThrough(["a[b.yml"], ["ab.yml"]),
  "a filter's `?` or `+` with nothing before it, and a lone `[` or `]`, is read as itself, and one after a character repeats it, as GitHub reads them");
{
  // (patterns that would keep a backtracking expression busy for minutes: each shape of them grows with its size, and the
  // time with it must not grow faster)
  const long = `.github/workflows/${"a".repeat(200)}.yml`;
  const quick = [[n => [`**a${"+a".repeat(n)}+b`, long], 3, 6], [n => [`${"*".repeat(n)}z`, ".github/workflows/core.yml"], 10, 30], [n => [`*a${"+a".repeat(n)}+b`, "a".repeat(500)], 5, 10],
    [n => [`${"**/".repeat(n)}x`, `${"a/".repeat(300)}y`], 3, 5], [n => [`${"**/a/".repeat(n)}x`, `${"a/".repeat(2000)}y`], 250, 500]]
    .map(([make, small, large]) => linear(n => { const [pattern, name] = make(n); return !pathsLetThrough([pattern], [name]); }, small, large));
  const reported = suiteBy("    paths: ['*a+a+a+a+a+a+a+a+a+b', '.github/workflows/**']");
  ok(quick.every(q => q.right && q.linear) && reported, "a filter that would keep a backtracking expression busy is read at once, and read right", quick.map(q => q.shown).join("; "));
  fs.rmSync(suiteFile);
}

// ---- a tree that passed (#457): a job that selects on a push alone ran nowhere else, and is not asked --passed ----
{
  const PASSED_LEAD = "18 November 2026, a tree that passed is not run again", pushed = path.join(lockProject, ".github/workflows/pushed.yml");
  const asked = on => { fs.writeFileSync(pushed, `name: p\non:\n${on}\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node core/scripts/select.mjs --env RUN\n`); return notDone(lockProject, only(PASSED_LEAD)).some(m => m.lead === PASSED_LEAD); };
  ok(!asked("  push:\n    branches: [main]") && asked("  push:\n  pull_request:") && asked("  pull_request:\n  push:\n    branches: [main]"),
    "a job that selects on a push alone is not asked --passed, since its suite ran nowhere else; one a pull request runs too is");
  const job = (select, runner) => { fs.writeFileSync(pushed, `name: p\non:\n  pull_request:\n  push:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${select}\n      - ${runner}\n`); return notDone(lockProject, only(PASSED_LEAD)).some(m => m.lead === PASSED_LEAD); };
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
ok(shapeMissed.length === 4 && shapeMissed[3].lead === "19 November 2026, the shape check reads the functions of Python on the parser" && /written before the check read Python, by the parser: run `node core\/scripts\/shape\.mjs checks\/shape\.json --write`/.test(shapeMissed[3].mend) && shapeMissed[2].lead === "19 November 2026, the shape check reads the functions of JavaScript and TypeScript on the parser" && /written before the check read JavaScript and TypeScript, their functions by the parser: run `node core\/scripts\/shape\.mjs checks\/shape\.json --write`/.test(shapeMissed[2].mend) && shapeMissed[1].lead === "18 November 2026, the shape check reads C#'s functions on the parser" && /written before the check read C#, by the parser: run `node core\/scripts\/shape\.mjs checks\/shape\.json --write`/.test(shapeMissed[1].mend) && shapeMissed[0].lead === "16 November 2026, how code is put together" && /written before the check read files that hold JSX, C#, its functions by the lexer, Python, its functions by the lexer, scripts that share one global space, the tests that open a screen, a window or a device, the tests that reach a real clock, the tests that start another process, the comments that mark a change:/.test(shapeMissed[0].mend) && /node core\/scripts\/shape\.mjs checks\/shape\.json --write/.test(shapeMissed[0].mend),
  "a shape baseline that names no reader is reported by each of its steps, each mend to write it with every reader", report(shapeMissed));
execFileSync(process.execPath, ["core/scripts/shape.mjs", "checks/shape.json", "--write"], { cwd: lockProject, env: { ...process.env, SHAPE_BASE: "" } });
shapeMissed = notDone(lockProject);
ok(!shapeMissed.length && JSON.parse(fs.readFileSync(shapeBaseline, "utf8")).reads.length === Object.keys(READERS).length, "and the mend as written makes it done", report(shapeMissed));
fs.writeFileSync(shapeBaseline, shapeAsKit);

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

done("steps-checks-run");
