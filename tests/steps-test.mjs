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
import { hookCommands, readCore } from "../scripts/core-path.mjs";
import { READ, TEMPLATES, files, licences, sizes } from "../scripts/init.mjs";
import { notes as manifestNotes } from "../scripts/manifest-reads.mjs";
import { FOLDER, NOTES, NOTICE, POINTER, entries, notes as notesWhole } from "../scripts/sync-notes.mjs";
import { READERS, isCode } from "../scripts/shape-readers.mjs";
import { leftOut } from "../scripts/reading.mjs";
import { readNothing } from "../scripts/read-nothing.mjs";
import { holders } from "../scripts/holders.mjs";
import { STAGES } from "../scripts/steps-stage.mjs";
import { parseYaml, pathsLetThrough } from "../scripts/workflow-run.mjs";
import { COST, MOVED_GLOB, NEW_GLOBS, STEPS, Unread, configs, leads, moved, notDone, plain, project, report, runsOwn } from "../scripts/steps.mjs";
import { READ_MOST } from "../scripts/own-files.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = scratchDir("steps-test-");
const PIN = "a".repeat(40);
// (a test that reads one step's answer asks for that step alone: the others' checks, the agent tools' files among them, which run
// the copies and pointers checks on the whole project, answer nothing it reads, and a Windows runner pays for each)
const only = lead => STEPS.filter(s => s.lead === lead);
// What a reader's "one pass" or its bound means is that its work grows in step with its text (or stops at
// its bound), never a time of its own on a real clock, which a busy machine stretches: `read(n, k)` reads a text of
// size n (its k-th, so that none is read from the reader's memory) and says whether it was read right, or does what
// needs building first and returns what then reads it, which alone is timed; the least of a few readings at each of two
// sizes, taken in turn so that a pause lands on none of them, is compared, the smaller held to at least 10 ms, below
// which a clock tells nothing; and a reader that is linear keeps the larger over the smaller near the sizes' own ratio,
// where one gone quadratic takes it to its square. The sizes are small, so that the parser's own time
// (bash-commands.mjs) stays far from its end however busy the machine. The factor of three and the smaller sizes hold
// "one pass" as "not quadratic at these sizes", a small term that shows only past them unseen.
const linear = (read, small, large, runs = 5) => {
  read(small, -1)?.call?.(); // (the first reading starts the parser)
  const least = new Map([[small, Infinity], [large, Infinity]]);
  let right = true;
  for (let k = 0; k < runs; k++) for (const n of [small, large]) {
    let at = Date.now(), got = read(n, k);
    if (typeof got === "function") { at = Date.now(); got = got(); }
    right = got && right;
    least.set(n, Math.min(least.get(n), Date.now() - at));
  }
  const ratio = least.get(large) / Math.max(10, least.get(small));
  return { right, linear: ratio < 3 * (large / small), shown: `${small} took ${least.get(small)} ms, ${large} took ${least.get(large)} ms` };
};
const modules = ["roles/shared", "tasks", "tools"].flatMap(d => fs.readdirSync(path.join(root, d)).filter(n => n.endsWith(".md")));
const texts = dir => Object.fromEntries(fs.readdirSync(path.join(root, dir)).filter(n => n.endsWith(".md")).map(n => [n, fs.readFileSync(path.join(root, dir, n), "utf8")]));

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
// (`at`: where the project's copy of the core stands, as its manifest names it, "core/" the default. Its own files then
// name that path wherever the kit wrote core/, as a project that moved its copy has them: #628. `library`: the folder of a
// library that carries the core, its files committed here, at `at` inside it, as the manifest's line and the library's
// own manifest say it, with the floor's own copy in floor-copy/; `submodule`: the library a submodule of the project,
// which git lists by its commit alone)
function kit(name, o, { held = true, at = "core/", library = null, submodule = false } = {}) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  const there = text => at === "core/" ? text : text.replace(/(?<![\w-])core\//gu, at);
  const readAt = f => at === "core/" ? f : f.replace(/^core\//u, at);
  for (const [to, text] of files({ owner: "someone-else", name, ...o }, PIN, modules, n => fs.readFileSync(path.join(root, TEMPLATES, n), "utf8"))) {
    fs.mkdirSync(path.dirname(path.join(dir, there(to))), { recursive: true });
    fs.writeFileSync(path.join(dir, there(to)), there(text));
  }
  if (library) {
    const manifest = path.join(dir, "core-manifest.md"), own = /^Core: .*$/m.exec(fs.readFileSync(manifest, "utf8"))[0];
    fs.writeFileSync(manifest, fs.readFileSync(manifest, "utf8").replace(own, `Core: ${CORE}, carried by ${library} under ${at} (never edited here).\nFloor copy: floor-copy/`));
    fs.mkdirSync(path.join(dir, library), { recursive: true });
    fs.writeFileSync(path.join(dir, library, "core-manifest.md"), `${own.replace(`under ${at}`, `under ${at.slice(library.length)}`)}\n`);
    fs.cpSync(path.join(root, "floor"), path.join(dir, "floor-copy"), { recursive: true });
  }
  if (at !== "core/") {
    // (its hooks are the commands core-path.mjs gives for that path, which stop a session whose floor cannot be read there)
    const settings = path.join(dir, ".claude/settings.json"), hooks = JSON.parse(fs.readFileSync(settings, "utf8")), commands = hookCommands(readCore(fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8")));
    hooks.hooks.SessionStart[0].hooks[0].command = commands.start; hooks.hooks.PreToolUse[0].hooks[0].command = commands.helper; hooks.hooks.Stop[0].hooks[0].command = commands.stop;
    fs.writeFileSync(settings, `${JSON.stringify(hooks, null, 2)}\n`);
  }
  fs.mkdirSync(path.join(dir, "checks"), { recursive: true });
  fs.writeFileSync(path.join(dir, "checks/licences.json"), `${JSON.stringify(licences(o, () => false), null, 2)}\n`);
  // (the copy of the core the project holds, as far as its checks read it, its .gitignore too, which keeps the installed packages out of git as in a
  // synced project, where staging them cost a Windows runner over a minute; and the size marks the kit writes for it)
  for (const part of ["floor", "modules", "roles", "tasks", "tools", "scripts", ".packages", "setup", ".gitignore"]) fs.cpSync(path.join(root, part), path.join(dir, at, part), { recursive: true });
  if (submodule) {
    const lib = path.join(dir, library), git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "-c", "protocol.file.allow=always", ...args], { cwd: lib, stdio: "ignore" });
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "the library");
    execFileSync("git", ["-c", "protocol.file.allow=always", "submodule", "add", "-q", `${lib.replace(/\\/g, "/")}-origin.git`, library.replace(/\/$/, "")], { cwd: dir, stdio: "ignore" });
  }
  // (the files the marks name stand under the copy's path; the total counts the project's own alone, as for core/)
  const marks = sizes(Object.fromEntries(READ.map(f => [f, fs.statSync(path.join(dir, readAt(f))).size])));
  marks.read = Object.fromEntries(Object.entries(marks.read).map(([f, mark]) => [readAt(f), mark]));
  fs.writeFileSync(path.join(dir, "checks/sizes.json"), `${JSON.stringify(marks, null, 2)}\n`);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  // (the copies check's first baseline as the starter kit writes it, its two entry files' shared sentence listed)
  execFileSync(process.execPath, [`${at}scripts/copies.mjs`, "checks/copies.json", "--first"], { cwd: dir, stdio: "ignore" });
  fs.writeFileSync(path.join(dir, "checks/shape-baseline.json"), `${JSON.stringify({ reads: Object.keys(READERS), listed: {} }, null, 2)}\n`);
  // (the first list of what holds the project's own rules, as the starter kit writes it: #662)
  execFileSync(process.execPath, [`${at}scripts/holders.mjs`, "--own", "--write"], { cwd: dir, stdio: "ignore" });
  // (a reading of the project against the core, recorded as the pull request of its first reading records it: #464)
  execFileSync(process.execPath, [`${at}scripts/core-reading.mjs`, "--recorded"], { cwd: dir, stdio: "ignore" });
  if (held) roundTrip(name, o, dir);
  return dir;
}
// (every kit, as it is written and before any case changes it: every step done, its kind read back, no difference from a
// fresh start; so each value of each option the kit takes is held wherever a kit is made with it, and a kit made with
// options another already holds is made with held: false, which spares the suite's time its round trip)
function roundTrip(name, given, dir) {
  const missed = notDone(dir);
  ok(!missed.length && report(missed).startsWith("Every step a check reads is done"), `${name}, as the starter kit writes it: no step is reported not done`, report(missed));
  const p = project(dir);
  const { o } = kind(p);
  ok(o.owner === "someone-else" && o.name === name && o.packages === given.packages && o.nuget === given.nuget && !!o.private === !!given.private && !!o.game === !!given.game,
    `${name}: its kind is read from what it holds, as the starter kit was told it (${JSON.stringify(given)})`, JSON.stringify(o));
  const found = differences(p, fresh(p));
  ok(!found.length && freshReport(found).includes("no difference"), `${name}: beside a fresh start, no difference`, found.join("\n"));
  // (the core's own manifest check, on the modules of this commit: a module the list neither takes nor leaves out would
  // be a note on the project's first day, #329)
  const moduleNotes = manifestNotes({ manifest: p.manifest, moduleTexts: { ...texts("roles/shared"), ...texts("tasks"), ...texts("tools") } });
  ok(!moduleNotes.length, `${name}: its manifest takes or leaves out each module, so the manifest check gives no note`, moduleNotes.join("\n"));
}
// (the same projects with the copy at another path, and the starter kit's own folder names read from it: #628)
const vendored = {};
for (const [name, o, at] of [["a-vendored-npm-project", { packages: "." }, "vendor/core/"], ["a-vendored-dotnet-game", { nuget: "src", game: true }, "third_party/the-core/"]]) vendored[name] = kit(name, o, { at });
// (the configs the kit writes leave out and name the copy at the manifest's path, which the fresh comparison above reads: #918)
for (const [name, at] of [["a-vendored-npm-project", "vendor/core/"], ["a-vendored-dotnet-game", "third_party/the-core/"]]) {
  const shape = fs.readFileSync(path.join(vendored[name], "checks/shape.json"), "utf8"), copies = fs.readFileSync(path.join(vendored[name], "checks/copies.json"), "utf8");
  ok(shape.includes(`":!${at}"`) && !/":!core\//u.test(shape) && copies.includes(`"${at}floor/*.md"`) && !/"core\//u.test(copies), `${name}: the starter kit's shape and copies configs leave out and name the copy where the manifest says it stands`, `${shape}\n${copies}`);
}
// (the steps that read a project's own run of the core's scripts read it at the copy's path: a mutation tool's strength
// check, and the selection of the tests a change can reach with the name of the check that gates a tree that passed)
{
  const dir = vendored["a-vendored-npm-project"], manifest = path.join(dir, "core-manifest.md"), was = fs.readFileSync(manifest, "utf8");
  const strong = STEPS.find(s => s.lead === "16 November 2026, how strong the tests are"), passed = STEPS.find(s => s.lead.endsWith("a tree that passed is not run again"));
  const flow = path.join(dir, ".github/workflows/strength.yml"), select = path.join(dir, ".github/workflows/select.yml");
  fs.writeFileSync(manifest, was.replace(/^\| \*mutation tool\* \|.*$/m, "| *mutation tool* | `node vendor/core/scripts/mutate.mjs --report {report} {lines}` |"));
  const said = body => { fs.writeFileSync(flow, `name: strength\non:\n  pull_request:\njobs:\n  tests:\n    runs-on: ubuntu-latest\n    steps:\n${body}`); return notDone(dir, [strong])[0]?.mend ?? null; };
  const bare = said("      - run: node vendor/core/scripts/strength.mjs\n"), runs = said("      - run: node vendor/core/scripts/strength.mjs\n        env:\n          STRENGTH_BASE: origin/main\n");
  ok(runs === null && bare?.includes("`node vendor/core/scripts/strength.mjs`"), "a workflow that runs the strength check at the copy's path with its base reads done, and the mend asks for the step at that path", `${bare}\n${runs}`);
  fs.writeFileSync(select, "name: select\non:\n  push:\n  pull_request:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node vendor/core/scripts/select.mjs --env RUN\n");
  const selected = notDone(dir, [passed])[0]?.mend ?? null;
  ok(selected?.includes(".github/workflows/select.yml") && selected.includes("its job `t`"), "a selection run at the copy's path, with no check named that a tree passed, is found", selected);
  fs.writeFileSync(manifest, was); fs.rmSync(flow); fs.rmSync(select);
}
// (a submodule of the project that carries no core is none of its own files: a project with one reads as it did)
{
  const dir = kit("a-project-with-another-submodule", { packages: "." }, { held: false }), other = path.join(dir, "third");
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, "App.csproj"), "<Project />\n");
  const g = (cwd, ...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "-c", "protocol.file.allow=always", ...args], { cwd, stdio: "ignore" });
  g(other, "init", "-q", "-b", "main"); g(other, "add", "-A"); g(other, "commit", "-q", "-m", "other");
  g(dir, "submodule", "add", "-q", `${other.replace(/\\/g, "/")}-origin.git`, "third");
  ok(!project(dir).files.some(f => f.startsWith("third/")) && !notDone(dir).length, "the files of a submodule that carries no core are not the project's own, and no step reads it", report(notDone(dir)));
}
// (a core a library carries, its files committed in the project: the library's own manifest pins it, and the floor's own
// copy stands beside it until every tool has passed the staged cases)
kit("a-library-carried-project", { packages: "." }, { at: "lib/core/", library: "lib/" });
kit("a-submodule-carried-project", { packages: "." }, { at: "lib/core/", library: "lib/", submodule: true });
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
ok(JSON.stringify(notDone(lockProject).map(m => m.lead)) === JSON.stringify(some), "several taken out at once are reported, exactly those", report(notDone(lockProject)));
// (in the order steps-stage.mjs loads them: the steps', and `last` where a stage's mend reads what the others' mends write)
for (const lead of Object.keys(STAGES).filter(l => some.includes(l))) STAGES[lead].mend(lockProject);
ok(!notDone(lockProject).length, "and their mends make every one done");
for (const lead of some) STAGES[lead].after?.(lockProject);
// (two whose stages both write a job that selects, taken out together: each still reported, as the upgrade test's
// random draw takes them, #457)
{
  const pair = ["16 November 2026, the tests a change can reach", "18 November 2026, a tree that passed is not run again"];
  for (const lead of pair) STAGES[lead].stage(lockProject);
  ok(pair.every(lead => notDone(lockProject, only(lead)).some(m => m.lead === lead)), "the tests a change can reach and a tree that passed, taken out together, are each reported", report(notDone(lockProject)));
  for (const lead of Object.keys(STAGES).filter(l => pair.includes(l))) STAGES[lead].mend(lockProject);
  for (const lead of pair) STAGES[lead].after?.(lockProject);
}

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

// ---- a suite's path filter, read as GitHub reads one: `?` and `+` repeat the character before them (#379) ----
const SUITE_LEAD = "12 November 2026, a sync and the project's own suites";
const suiteFile = path.join(lockProject, ".github/workflows/suites-filtered.yml");
const suiteBy = filter => { fs.writeFileSync(suiteFile, `name: s\non:\n  pull_request:\n${filter}\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo t\n`); return notDone(lockProject, only(SUITE_LEAD)).some(m => m.lead === SUITE_LEAD); };
ok(suiteBy("    paths: ['.github/workflows/core.ya?ml']") && suiteBy("    paths: ['.github/workflows/co+re.yml']") && !suiteBy("    paths: ['.github/workflows/core\\?.yml']")
  && suiteBy("    paths-ignore: ['core/**']") && !suiteBy("    paths: ['src/**']"), "a suite whose filter starts on a call's file alone is reported, its `?` and `+` read as GitHub reads them");
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

// ---- a step left undone on purpose, on the owner's word: declared, not reported ----
const declare = (d, line) => fs.writeFileSync(path.join(d, "core-manifest.md"), fs.readFileSync(path.join(d, "core-manifest.md"), "utf8").replace(/^## Differences\n+None\.\n?/m, `## Differences\n- ${line}\n`));
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
const bare = kit("a-bare-npm-project", { packages: "." }, { held: false });
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
    const said2 = notDone(kitDir, step); // (a read that never ended would never return: the suite's own time stops it)
    fs.rmSync(agents);
    fs.writeFileSync(agents, was);
    ok(said2.length === 1 && /names `AGENTS\.md`, which is no regular file of the project's own/.test(said2[0].mend), "the size marks' step hands the reading-size check no file the reader would not read, and says which", said2[0]?.mend);
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
const another = kit("another-npm-project", { packages: "." }, { held: false });
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
  const labelled = linear(n => () => copiesOf({ "a.yml": { jobs: { j: { "runs-on": [...Array.from({ length: n }, (_, k) => `l${k}`), "ubuntu-latest"],
    steps: [...Array.from({ length: 4 * n }, () => ({ run: "echo x" })), { run: "node core/scripts/copies.mjs $GITHUB_WORKSPACE/config/c.json" }] } } } }) === "config/c.json", 500, 4000);
  ok(labelled.right && labelled.linear, "a job's many labels, over many steps, are read once", labelled.shown);
  ok(copiesOf({ "a.yml": stepped("node ../core/scripts/copies.mjs config/c.json", { "working-directory": "%GITHUB_WORKSPACE%/app" }, { "runs-on": "ubuntu-latest" }) }) === null, "a folder named by a shell's variable, which no shell fills there, is not read");
  // (a macOS runner's shell is bash; an organisation's runner group may hold Windows machines, so its shell cannot be told)
  ok(["macos-latest", "macos-14"].every(r => rooted("$GITHUB_WORKSPACE", {}, { "runs-on": r }) === "config/c.json" && rooted("$env:GITHUB_WORKSPACE", {}, { "runs-on": r }) === null)
    && [{ group: "org-runners" }, { group: "org-runners", labels: ["ubuntu-latest"] }].every(r => rooted("$GITHUB_WORKSPACE", {}, { "runs-on": r }) === null && rooted("$env:GITHUB_WORKSPACE", {}, { "runs-on": r }) === null),
    "on a macOS runner the root is read as bash names it; on an organisation's runner group, whose shell cannot be told, in no shell's spelling");
}
// (the same runners, read by the new-package step for whether a lookup's failure stops its step: a macOS runner's bash
// does; a runner group's shell, which may be Windows' pwsh, cannot be told, so its lookup does not count)
{
  const lookupStep = STEPS.find(s => s.lead === "16 November 2026, a new package looked up");
  const on = runner => lookupStep.check({ ...inMemory({ "a.yml": { on: { pull_request: null }, jobs: { a: { "runs-on": runner, steps: [{ uses: "actions/checkout@v7", with: { "fetch-depth": 2 } },
    { run: "node core/scripts/lookup.mjs c.json --nuget" }, { run: "node core/scripts/nuget.mjs c.json" }] } } } }), root: tmp });
  ok(on("ubuntu-latest") === null && on("macos-latest") === null && [{ group: "org-runners" }, { group: "org-runners", labels: ["ubuntu-latest"] }].every(r => on(r)?.includes("add a step that runs `node core/scripts/lookup.mjs`")),
    "a NuGet lookup on a macOS runner counts, as on Linux; one on an organisation's runner group does not");
}
// (a .NET project known by a solution or a project file of any of its languages: each reads as NuGet, in its folder)
ok([["src/App.sln", "src"], ["src/App.slnx", "src"], ["src/App/App.fsproj", "src/App"], ["src/App/App.vbproj", "src/App"], ["App.sln", "."], ["src/App.SLN", "src"]].every(([f, at]) => kind({ ...inMemory({}, { [f]: "<Project />\n" }), root: tmp }).o.nuget === at),
  "a project holding only a .sln, .slnx, .fsproj or .vbproj, in any case, reads as a NuGet project, set up in that file's folder");
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
// a workflow nested past what the reader of keys given twice reads is told with its own mend, to nest it less, never
// as a key given twice it may not hold (#610)
{
  const keysStep = STEPS.find(s => s.lead === "16 November 2026, no workflow gives a key twice");
  const deep = keysStep.check(inMemory({}, { ".github/workflows/deep.yml": `on: push\nx: ${"[".repeat(200)}1${"]".repeat(200)}\n` }));
  const both = keysStep.check(inMemory({}, { ".github/workflows/deep.yml": `on: push\nx: ${"[".repeat(200)}1${"]".repeat(200)}\n`, ".github/workflows/two.yml": "on: push\non: pull_request\n" }));
  ok(/nest the lists and mappings of these workflows or actions no deeper than a workflow needs, a few levels, since past 128 deep a key given twice in them cannot be read: `\.github\/workflows\/deep\.yml`\./.test(deep ?? "") && !/keep one of the two keys/.test(deep ?? "")
    && /keep one of the two keys.*`\.github\/workflows\/two\.yml` line 2, "on"/.test(both ?? "") && /no deeper than a workflow needs.*`\.github\/workflows\/deep\.yml`/.test(both ?? "")
    && keysStep.check(inMemory({}, { ".github/workflows/flat.yml": "on: push\n" })) === null,
    "a workflow nested past 128 deep is told to nest less, a key given twice to keep one, each with its own mend, and a plain one passes", [deep, both].join("\n"));
  // (a workflow longer than the length read is told to be cut, never to nest less: #752)
  const long = keysStep.check(inMemory({}, { ".github/workflows/long.yml": `on: push\n# ${"x".repeat(262144)}\n` }));
  ok(/cut these workflows or actions to under 262144 characters.*`\.github\/workflows\/long\.yml`\./.test(long ?? "") && !/nest the lists/.test(long ?? ""),
    "a workflow longer than the length read is told to be cut, with its own mend", long ?? "");
}

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
const opened = linear((n, k) => copiesOf({ "a.yml": stepped(`${"cat <<EOF\n".repeat(n)}node core/scripts/copies.mjs config/c${k}.json`) }) === `config/c${k}.json`, 500, 8000);
ok(opened.right && opened.linear, "here-documents with no end leave every line read, in one pass", opened.shown);
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
const parens = linear((n, k) => copiesOf({ "a.yml": stepped(`${"(".repeat(n)}\nnode core/scripts/copies.mjs config/c.json\n# ${k}`) }) === "config/c.json", 3125, 50000);
ok(parens.right && parens.linear, "a long line of \"((\" is read in one pass", parens.shown);
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
const longEnv = linear((n, k) => notRead("copies", { "a.yml": stepped(`env ${"-S ".repeat(n)}'node core/scripts/copies.mjs c.json' # ${k}`) }), 1250, 20000);
ok(longEnv.right && longEnv.linear, "many of env's options are read in one pass", longEnv.shown);
const versionsStep = STEPS.find(s => s.lead === "12 November 2026, exact versions");
ok(versionsStep.check(inMemory({ "a.yml": stepped("cd tools && node scripts/exact-versions.mjs x.json") }, { "package-lock.json": "{}" })) === null, "where the project runs no licence check of its own, a companion run it cannot place asks nothing");
// (npm known by either lock file it installs from, package-lock.json or npm-shrinkwrap.json: each reads as npm, and the
// step asks its companion run of each)
ok(["package-lock.json", "npm-shrinkwrap.json"].every(f => kind({ ...inMemory({}, { [f]: "{}" }), root: tmp }).o.packages === "." && typeof versionsStep.check(inMemory({ "a.yml": stepped("node core/scripts/licences.mjs l.json") }, { [f]: "{}" })) === "string"),
  "a project holding npm-shrinkwrap.json in place of package-lock.json reads as npm, and the exact-versions step asks of it as of the other");
ok(["core/package-lock.json", "node_modules/a/npm-shrinkwrap.json", "tools/node_modules/b/package-lock.json"].every(f => versionsStep.check(inMemory({ "a.yml": stepped("node core/scripts/licences.mjs l.json") }, { [f]: "{}" })) === null),
  "a lock file inside the core's copy or an installed package asks nothing of the project");
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
const wordy = linear((n, k) => notRead("copies", { "a.yml": stepped(`timeout 1 '${"node ".repeat(n)}x' core/scripts/copies.mjs # ${k}`) }), 5000, 40000);
ok(wordy.right && wordy.linear, "a long word is read in one pass", wordy.shown);
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
const quotes = linear((n, k) => copiesOf({ "a.yml": stepped(`echo core/scripts/copies.mjs ${"\"\\".repeat(n)} # ${k}`) }) === "checks/copies.json", 5000, 40000);
ok(quotes.right && quotes.linear, "quotes are read in one pass", quotes.shown);
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
const manyEnvs = linear(n => {
  const manyEnv = Object.fromEntries(Array.from({ length: n }, (_, k) => [`E${k}`, `v${k}`])), manySteps = Array.from({ length: n }, (_, k) => ({ run: `echo ${k}` }));
  return () => copiesOf({ "a.yml": { env: manyEnv, jobs: { j: { env: manyEnv, steps: manySteps } } } }) === "checks/copies.json";
}, 250, 2000);
ok(manyEnvs.right && manyEnvs.linear, "a workflow's and a job's env: are read once, however many steps", manyEnvs.shown);
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
// (past the bound the run is not read and the work stops there, so it grows no faster than the input, though the bound does not hold it flat)
const fan = linear(n => {
  const files = { ".github/actions/a/action.yml": `runs:\n  using: composite\n  steps:\n${"    - uses: ./.github/actions/b\n".repeat(n - 1)}`, ".github/actions/b/action.yml": `runs:\n  using: composite\n  steps:\n${"    - run: echo x\n      shell: bash\n".repeat(n)}` };
  return () => notRead("copies", { "a.yml": { jobs: { j: { steps: [{ uses: "./.github/actions/a" }] } } } }, files);
}, 200, 1999);
ok(fan.right && fan.linear, "actions called thousands of times are read once each, and past the bound the run is not read", fan.shown);
const chain = linear(n => {
  const files = Object.fromEntries(Array.from({ length: n }, (_, k) => [`.github/actions/c${k}/action.yml`, `runs:\n  using: composite\n  steps:\n${"    - run: echo x\n      shell: bash\n".repeat(n / 40)}    - uses: ./.github/actions/c${k + 1}\n`]));
  return () => notRead("copies", { "a.yml": { env: { A: "x" }, jobs: { j: { steps: [{ uses: "./.github/actions/c0" }] } } } }, files);
}, 200, 2000);
ok(chain.right && chain.linear, "a long chain of actions is read no deeper than the bound", chain.shown);
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
const stars = linear((n, k) => notRead("copies", { "a.yml": stepped(`node core/scripts/${"*".repeat(n)}x c.json\nnode core/${"*".repeat(n)}/copies.mjs c.json # ${k}`) }), 10, 40);
ok(stars.right && stars.linear, "a glob of many stars is read in one pass", stars.shown);
// (the review of 5f229be: any class may match, read in one pass; a folder's "/" at its end is no other folder)
const classes = linear((n, k) => ["core/scripts/copie[]s].mjs", "core/scripts/copie[!]a].mjs", "core/scripts/[a[:alpha:]]opies.mjs", "core/scripts/[^[:digit:]]opies.mjs", `core/scripts/${"[a".repeat(n)}]x`]
  .every(f => notRead("copies", { "a.yml": stepped(`node ${f} c.json # ${k}`) })) && notRead("copies", { "a.yml": stepped("node copies.mj? c.json", { "working-directory": "core/scripts/" }) }), 12500, 100000);
ok(classes.right && classes.linear,
  "a class in any form may match, read in one pass; a folder named with a \"/\" at its end is that folder", classes.shown);
ok(configs(inMemory({ "a.yml": stepped("node core/scripts/reading-size.mjs config/sizes*.json") })).sizes === null && notRead("copies", { "a.yml": stepped("node core/scripts/copies.mjs config/c?.json") })
  && copiesOf({ "a.yml": stepped("node core/scripts/copies.mjs 'config/c*.json'") }) === "config/c*.json", "a config given as an unquoted glob is not read; a quoted one is a file's name");
// (the review of 3546fd8: an extended glob of bash's may match; a run of "/" is read in one pass)
ok(["c?(x)opies.mjs", "+(c)opies*.mjs", "!(x)*.mjs", "@(copies|x).mjs", "!(x).mjs", "copies.@(mjs)"].every(f => notRead("copies", { "a.yml": stepped(`shopt -s extglob\nnode core/scripts/${f} c.json`) }))
  && ["core/?(x)scripts/c*.mjs", "core/@(scripts)/c*.mjs"].every(f => notRead("copies", { "a.yml": stepped(`shopt -s extglob\nnode ${f} c.json`) })),
  "an extended glob of bash's, in the script's name or its folder, may match, so the run is not read");
const slashes = linear((n, k) => copiesOf({ "a.yml": stepped(`node core/scripts${"/".repeat(n)}x*.mjs c.json\nnode core/scripts/copies.mjs c.json # ${k}`) }) === "c.json", 12500, 100000);
ok(slashes.right && slashes.linear, "a run of \"/\" is read in one pass", slashes.shown);
// (on the parser, #530: a text the grammar cannot read within its time is not read at all, since a line read alone
// would misread a quote or a continued line over it; the fallback reviewer's review of 4ffb50d)
ok(notRead("copies", { "a.yml": stepped(`echo ${"a?(b)".repeat(100000)}\nnode core/scripts/copies.mjs c.json`) }), "a long line of extended globs leaves its step not read, which the grammar's own budget decides");
const oneRun = { ".github/actions/a/action.yml": "runs:\n  using: composite\n  steps:\n    - run: echo x\n      shell: bash\n" };
const givenEnv = linear(n => {
  const bigEnv = Object.fromEntries(Array.from({ length: n }, (_, k) => [`E${k}`, `v${k}`]));
  return () => copiesOf({ "a.yml": { jobs: { j: { env: bigEnv, steps: Array.from({ length: n / 450 }, () => ({ uses: "./.github/actions/a" })) } } } }, oneRun) === "checks/copies.json";
}, 12375, 99000);
ok(givenEnv.right && givenEnv.linear,
  "a large env: given to many calls of an action is read once", givenEnv.shown);
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
  ok(said.includes("`vendor/core/modules/work-flow.md` is now `vendor/core/roles/shared/work-flow.md` (in `AGENTS.md`)") && said.includes('after the pattern "vendor/core/modules/*.md" add the patterns "vendor/core/floor/topics/*.md", "vendor/core/roles/*.md"') && said.includes("`core/notes.md`") && said.includes("`core/AGENTS.md`") && !/(?<![\w/-])core\//.test(said.replace("`core/notes.md`", "").replace("`core/AGENTS.md`", "")),
    "where the copy stands at another path, the step reads a copies config's patterns at it and names the files and patterns by it, and a file of the project's own that stands at core/ by its own name", said);
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
  ok(JSON.stringify(shown("! node core/scripts/lookup.mjs c.json\nif ! node a.mjs; then x; fi")) === JSON.stringify(["! node core/scripts/lookup.mjs c.json", "! if", "! node a.mjs", "! x"])
    && notRead("copies", { "a.yml": stepped("! node core/scripts/copies.mjs config/c.json") }),
    "a \"!\" in a step leads each of its commands, and a check's run under it is not read as its run");
// (Codex's review of d32e5f0: a command inside a function, a loop, an if, a case or a { } group may run once, many
// times or never, so its keyword is a command of its own, and the step is never one command run once)
ok(["check() { node core/scripts/lookup.mjs c.json; }", "for f in; do node core/scripts/lookup.mjs c.json; done", "case x in y) node core/scripts/lookup.mjs c.json;; esac",
  "while false; do node core/scripts/lookup.mjs c.json; done", "{ node core/scripts/lookup.mjs c.json; }"].every(run => { const c = shown(run); return c.length > 1 && c.includes("node core/scripts/lookup.mjs c.json"); })
  && JSON.stringify(shown("until x; do y; done")) === JSON.stringify(["until", "x", "y"]),
  "a command inside a function, a loop, a case or a group is read with its keyword as a command before it, so no such step reads as one command run once");
// (the fallback reviewer's check of ccee6c9: a here-document opened in a subshell is data to its delimiter's line, as
// bash reads it; a subshell at a step's start is no extended glob)
ok(copiesOf({ "a.yml": stepped("(cat <<E)\nnode core/scripts/copies.mjs config/fake.json\nE\nnode core/scripts/copies.mjs config/c.json") }) !== "config/fake.json"
  && JSON.stringify(shown("(cat <<\"E\")\nnode fake.mjs\nE\nnode real.mjs")) === JSON.stringify(["cat", "node real.mjs"])
  && JSON.stringify(shown("cat <<A <<-B\nnode x.mjs\nA\nnode y.mjs\n\tB\nnode z.mjs")) === JSON.stringify(["cat", "node z.mjs"])
  && JSON.stringify(shown("cat <<E\n\tE\nnode fake.mjs\nE\nnode real.mjs")) === JSON.stringify(["cat", "node real.mjs"])
  && JSON.stringify(shown("cat <<-E\n\tE\nnode real.mjs")) === JSON.stringify(["cat", "node real.mjs"])
  && JSON.stringify(shown("( node core/scripts/lookup.mjs c.json )")) === JSON.stringify(["node core/scripts/lookup.mjs c.json"]),
  "a here-document opened in a subshell, or second on its line, holds its lines as data to its delimiter's line, tabs before it ending only a '<<-', and a subshell at a step's start is read as one");
// (the fallback reviewer's check of d32e5f0: a folder changed behind "!" is changed, and a pipeline under it is led by
// it in each of its commands)
ok(["! cd app; node core/scripts/copies.mjs config/c.json", "! pushd app\nnode core/scripts/copies.mjs config/c.json", "! echo x | node core/scripts/copies.mjs config/c.json",
  "! { echo x; } | node core/scripts/copies.mjs config/c.json", "true\n! false\nnode core/scripts/copies.mjs config/c.json"]
  .every(run => notRead("copies", { "a.yml": stepped(run) })), "a folder changed behind \"!\" leaves the run after it not read, and so does a check's run in a step that holds \"!\" anywhere, a pipeline's or a group's under it among them");
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions`);
process.exitCode = failed ? 1 : 0;
