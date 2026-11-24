// Tests the manifest check (scripts/manifest-reads.mjs): on small texts made here, on a project staged with a
// copy of the core's own files, and on the core's own repository, where a slot's mark short of its part fails; in a
// project it only reports.
// Its tests workflow runs this on every pull request here. Node's own modules and git only.
//
//   node tests/manifest-reads-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIRM, factsOf, markGap, markGaps, modulesOf, moduleNames, notes, placed, placeOf, slotTable, toConfirm, toPlace } from "../scripts/manifest-reads.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { places, rewritten } from "../scripts/step-checks-modules.mjs";
import modules from "../scripts/steps/160-the-modules-a-project-takes.mjs";
import { writable } from "../scripts/step-writers.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, more = "") => { count++; if (!cond) { failed++; console.error(`FAIL: ${what}${more ? `\n${more}` : ""}`); } };
const has = (list, part) => list.some(f => f.includes(part));

// the README's table and its marks (#481)
const README = rows => `# x\n\n## Slots\n\n| Slot | What the project fills in | Mark |\n| --- | --- | --- |\n${rows}\n\n## Next\n`;
const ROWS = "| *owner's account* | the login | read: the repository's own account (`scripts/a.mjs`) |\n| *follows* | `main` or `releases` | choice: left out, the releases |\n| *big file*, *tiny file* | a game's names | cannot be read: no script reads a game's names; left out, the module's own words |";
const stands = f => f === "scripts/a.mjs";
const table = slotTable(README(ROWS));
ok(table.size === 4 && table.get("tiny file").what === "a game's names" && table.get("follows").mark === "choice: left out, the releases", "the slots table is read, each with its mark, one row of several names shared", JSON.stringify([...table]));
ok(markGaps(README(ROWS), stands).length === 0, "each mark with its parts: no failure");
ok(markGap("read: the account (`scripts/a.mjs`, `.github/workflows/b.yml`)", f => true) === "" && markGap("choice: left out, none", stands) === "" && markGap("cannot be read: why; left out, none", stands) === "", "each of the three marks, whole, passes");
const gaps = markGaps(README(`${ROWS}\n| *pace* | the lines | none |\n| *dose* | a state | read: the baseline |\n| *large file* | a size | read: \`scripts/gone.mjs\` |\n| *report* | a place | choice: the description |\n| *audits* | a folder | cannot be read: left out, docs/ |\n| *milestone* | an issue | |`), stands);
const said = name => gaps.find(g => g.includes(`*${name}*`)) ?? "";
ok(gaps.length === 6 && /none of the three marks/.test(said("pace")) && /names no reader/.test(said("dose")) && /`scripts\/gone.mjs`, which the core does not hold/.test(said("large file")) && /no default/.test(said("report")) && /no reason/.test(said("audits")) && /none of the three marks/.test(said("milestone")), "a mark missing, a read with no reader or one gone, a choice with no default and a cannot-be-read with no reason each fail", gaps.join("\n"));
ok(gaps.every(g => mended(`FAIL: ${g}`)), "each failure says its mend");
ok(has(markGaps("# x\n\nno table\n", stands), "no \"## Slots\" table") && mended(`FAIL: ${markGaps("# x\n", stands)[0]}`), "a README with no table fails, saying its mend");
ok(markGap("read: `../etc/x.mjs`", f => !f.split("/").includes("..")) !== "", "a reader named outside the core is no reader");
ok(markGaps(README(ROWS).replace(/\n/g, "\r\n"), stands).length === 0, "line ends of Windows are read as Unix's");

// the manifest's modules
const MODULES = { "a.md": "x", "b.md": "y", "g.md": "z" };
const manifest = (modules, more = "") => `# Core manifest\n\nFloor: whole. Modules: ${modules}.\n${more}\n## Slots\n| Slot | Here |\n| --- | --- |\n\n## Differences\nNone.\n`;
const run = m => notes({ manifest: m, moduleTexts: MODULES });
ok(run(manifest("all")).length === 0, "all modules taken: no note, and no slot asked for a row");
let n = run(manifest("`a.md`, `b.md`, `g.md`"));
ok(n.length === 0, "a list naming every module: no note", n.join("\n"));
n = run(manifest("`a.md`, `b.md`"));
ok(n.length === 1 && has(n, "core/tasks/g.md is neither on") && has(n, "Not taken: `g.md` (<why"), "a module the list neither takes nor leaves out is named, with the line to add", n.join("\n"));
n = run(manifest("`a.md`, `b.md`", "Not taken: `g.md` (no game here).\n"));
ok(n.length === 0, "a module left out with its reason is no note", n.join("\n"));
n = run(manifest("`a.md`, `b.md`", "Not taken: `g.md`.\n"));
ok(n.length === 1 && has(n, "g.md is neither"), "a module left out with no reason is a note");
n = run(manifest("`a.md`, `zzz.md`, `b.md`, `g.md`"));
ok(n.length === 1 && has(n, "names zzz.md, which is no module"), "a name on the list that is no module is a note", n.join("\n"));
n = run(manifest("everything we like"));
ok(n.length >= 1 && has(n, "cannot be read"), "a Modules line neither all nor a list is a note, never a guess", n.join("\n"));
n = run(manifest("all").replace(/\n/g, "\r\n"));
ok(n.length === 0, `line ends of Windows are read as Unix's: ${n.join("; ")}`);
const m = modulesOf(manifest("`tasks/a.md`, `b`", "Not taken: `g.md` (no game; none).\n"));
ok(m.taken.has("a.md") && m.taken.has("b.md") && m.notTaken.get("g.md") === "no game; none", "names are read with or without the folder and the extension");

// the modules a list neither takes nor leaves out, placed from what is read exactly (#1094)
{
  const SHA = "a".repeat(40), GAME = ["computer players"];
  const kit = (list, more = "", core = `Core: ${CORE} at ${SHA}, copied whole under core/`) => `# Core manifest\n\n${core}\n\nFloor: whole. Modules: ${list}.\n${more}\n## Slots\n\n| Slot | Here |\n| --- | --- |\n| *progress file* | \`docs/PROGRESS.md\` |\n`;
  const game = text => text.replace("| *progress file*", "| *computer players* | `src/ai/` |\n| *progress file*");
  const facts = (text, files = []) => factsOf({ manifest: text, files, gameSlots: GAME });
  const plain = facts(kit("`a.md`"));
  ok(!plain.game && plain.oneRepository === true && !plain.screen, "a project with no game's row, its copy whole under core/ and no screen's file reads so", JSON.stringify(plain));
  ok(facts(game(kit("`a.md`"))).game && facts(kit("`a.md`"), ["web/App.tsx"]).screen && !facts(kit("`a.md`"), ["src/a.ts"]).screen, "a game's row and a file a screen is made of are read");
  ok(facts(kit("`a.md`", "", `Core: ${CORE}, carried by lib/ under lib/core/`)).oneRepository === false && facts(kit("`a.md`", "", "Core: a line no reader knows")).oneRepository === null, "a library that carries the core reads as more than one repository, and a line in neither form as not read");
  ok(placeOf("game-design.md", plain).take === false && placeOf("game-design.md", { ...plain, game: true }).take === true && !placeOf("game-design.md", plain).choice, "a game's module is placed by the game's row, never asked");
  ok(placeOf("repositories.md", plain).take === false && placeOf("repositories.md", { ...plain, oneRepository: false }).take === true && placeOf("repositories.md", { ...plain, oneRepository: null }).choice === true, "the module of several repositories is placed by the Core line, and asked where it cannot be read");
  ok(placeOf("screens.md", { ...plain, screen: true }).take === true && placeOf("screens.md", plain).choice === true && placeOf("planning.md", plain).choice === true, "a screen's file takes the module of screens; with none, and for a module no fact decides, it is taken by choice and asked");
  const names = ["a.md", "game-design.md", "planning.md", "repositories.md", "x.md"];
  ok(toPlace(kit("all"), names, plain).length === 0 && toPlace(kit("everything"), names, plain) === null, "a list that says all places nothing, and one that cannot be read gives null, never a guess");
  const left = toPlace(kit("`a.md`", "Not taken: `x.md`.\n"), names, plain);
  ok(left.map(l => l.name).join() === "game-design.md,planning.md,repositories.md", "a module the line Not taken names, with no reason too, is never placed", JSON.stringify(left));
  ok(toPlace(kit("`a.md`"), names, plain, ["planning.md"]).map(l => l.name).join() === "planning.md", "a step places only the modules it names");
  const text = placed(kit("`a.md`"), toPlace(kit("`a.md`"), names, plain));
  const read = modulesOf(text);
  ok(["a.md", "planning.md", "x.md"].every(n => read.taken.has(n)) && !read.taken.has("game-design.md") && read.notTaken.get("game-design.md") === "the project is no game: its manifest holds no game's row" && read.notTaken.has("repositories.md"),
    "placed, the list takes what it should and the line Not taken leaves out the rest with each reason, both read back by modulesOf", text);
  ok([...toConfirm(text)].sort().join() === "planning.md,x.md" && toPlace(text, names, plain).length === 0 && new RegExp(`^${CONFIRM} \`planning\\.md\`, \`x\\.md\`\\.$`, "m").test(text), "the modules taken by choice stand on the confirmation's line, and a second placing finds nothing", text);
  ok(/^Not taken: [^\n]*\n\nModules to confirm: /m.test(text), "the confirmation's line stands in a paragraph of its own, so the kit's paragraph of the module lines stays as the kit writes it", text);
  const p = { name: "planning.md", take: true, choice: true };
  ok(/Modules: `b\.md`, `planning\.md`, `z\.md`\.$/m.test(placed(kit("`b.md`, `z.md`"), [p])) && /Modules: `z\.md`, `b\.md`, `planning\.md`\.$/m.test(placed(kit("`z.md`, `b.md`"), [p])), "a list in order, as the kit writes it, stays in order, and one out of order gains the name at its end");
  const crlf = kit("`a.md`", "Not taken: `x.md` (none here).\n").replace(/\n/g, "\r\n"), again = placed(crlf, toPlace(crlf, names, plain));
  ok(!/[^\r]\n/.test(again) && /^Not taken: `x\.md` \(none here\), `game-design\.md` \(the project is no game[^)]*\), `repositories\.md` \([^)]*\)\.\r$/m.test(again) && modulesOf(again).notTaken.get("x.md") === "none here", "a line Not taken that stands is added to, its reasons kept, and Windows' line ends stay", again);
  // (a list of bare names, as the README's format writes the line, is read where each is a module, and gains names in
  // the form its names stand in: #1248, points 1 and 2)
  const bare = modulesOf(kit("tasks/a.md, planning and x"), names), words = modulesOf(kit("a, the rest"), names);
  ok([...bare.taken].sort().join() === "a.md,planning.md,x.md" && words.taken === null && modulesOf(kit("a, planning")).taken === null && toPlace(kit("a, planning"), names, plain).length === 3,
    "a bare list is read where each name is a module of the core, never where a name is no module or no module is known", JSON.stringify([...bare.taken ?? []]));
  ok(/Modules: a, planning, z\.$/m.test(placed(kit("a, z"), [p])) && /Modules: `a`, `planning`, `z`\.$/m.test(placed(kit("`a`, `z`"), [p])) && /Modules: a\.md, planning\.md\.$/m.test(placed(kit("a.md"), [p]))
    && /Modules: `z`, `a`, `planning`\.$/m.test(placed(kit("`z`, `a`"), [p])), "a name added takes the list's own form: bare or in backticks, with \".md\" only where a name there has it", placed(kit("a, z"), [p]));
  ok(notes({ manifest: kit("a, planning"), moduleTexts: { "a.md": "", "planning.md": "" } }).length === 0 && has(notes({ manifest: kit("a, whatever"), moduleTexts: { "a.md": "" } }), "or by its bare name"), "the notes read a bare list too, and say how a list is written where one cannot be read");
  // (the steps read it with the core's own modules, a module a step leaves aside among them; a line they cannot read is
  // quoted; and the writers' refusal of a manifest changed beyond its pin says what a sync's move is let through)
  const coreList = kit("cleaning, game-design.md and tasks/tests"), unread = e => { try { places({ manifest: e, files: [] }); } catch (err) { return err.message; } return ""; };
  ok(places({ manifest: coreList, files: [] }, { except: ["cleaning.md"] }).every(l => !["cleaning.md", "game-design.md", "tests.md"].includes(l.name))
    && /"Modules:" line of `core-manifest\.md` \("cleaning, whatever\."\) is neither "all" nor a list/.test(unread(kit("cleaning, whatever"))) && /has no "Modules:" line/.test(unread("# Core manifest\n")),
    "the steps read a bare list by the core's modules, a module left aside too, and quote a line they cannot read", unread(kit("cleaning, whatever")));
  // (a name the core moved out of its modules, in either form, is read and named with where its text went, and the step
  // that places the modules gives the line as it should read, the writer writing just that: the module its text went to
  // in its place, or no name where it went to no module; a name no reader knows is named where the line cannot be read: #1259, point 1)
  const MODS = { except: ["done-when.md", "planning.md", "repositories.md"] }, old = kit("cleaning, git and orchestrating"), ticked = kit("`cleaning.md`, `git.md`, `work-flow.md`");
  const said = modules.check({ manifest: old, files: [] }) ?? "", line = text => /^.*\bModules:.*$/mu.exec(text)?.[0] ?? "";
  const wrote = rewritten({ manifest: old, files: [] }, MODS), twice = rewritten({ manifest: ticked, files: [] }, MODS);
  ok(unread(old) === "" && /`git`[^;]*core\/roles\/shared\/work-flow\.md/u.test(said) && /`orchestrating`[^;]*core\/roles\/orchestrator\.md/u.test(said) && said.includes(`"${line(wrote)}"`),
    "a bare list holding names the core moved is read, the step naming each with where its text went and quoting the line as the writer writes it", said);
  ok(/\bwork-flow\b/u.test(line(wrote)) && !/\bgit\b|orchestrating/u.test(line(wrote)) && !/`git\.md`/u.test(line(twice)) && (line(twice).match(/work-flow/gu) ?? []).length === 1 && !/`git`/u.test(modules.check({ manifest: twice, files: [] }) ?? ""),
    "the writer puts the module a moved name's text went to in its place, once, and takes out one whose text went to no module, in backticks too", `${line(wrote)}\n${line(twice)}`);
  // (a moved name whose module the line "Not taken:" names is taken out, never put back in its place: the owner left it out)
  const outList = kit("`cleaning.md`, `git.md`", "Not taken: `work-flow.md` (the owner's reason).\n"), outSaid = modules.check({ manifest: outList, files: [] }) ?? "", outWrote = rewritten({ manifest: outList, files: [] }, MODS);
  ok(!/work-flow|`git\.md`/u.test(line(outWrote)) && /^Not taken: `work-flow\.md`/mu.test(outWrote) && /`git\.md`[^;]*"Not taken:"[^;]*the name goes/u.test(outSaid),
    "a moved name whose module the line \"Not taken:\" names goes, its module left out as it was", `${line(outWrote)}\n${outSaid}`);
  // (a list the move empties, its names all gone to a role or to a module left out, is read as taking none, and the writer
  // places each module on it: the step neither throws nor leaves "Modules: .")
  const emptied = l => { try { return line(rewritten({ manifest: l, files: [] }, MODS)); } catch (e) { return `threw: ${e.message}`; } };
  const roleOnly = emptied(kit("orchestrating")), outOnly = emptied(kit("`git.md`", "Not taken: `work-flow.md` (the owner's reason).\n"));
  ok([roleOnly, outOnly].every(l => /Modules: .*\bcleaning\b/u.test(l) && !/orchestrating|\bgit\b|threw/u.test(l)) && !/work-flow/u.test(outOnly),
    "a list the move empties is read as taking no module, and the writer places each module on it", `${roleOnly}\n${outOnly}`);
  ok(/`whatever`[^.]*no module of the core/u.test(unread(kit("cleaning, whatever"))), "a line that cannot be read names each name that is no module of the core", unread(kit("cleaning, whatever")));
  let refused = "";
  try { writable({ root: scratchDir("manifest-reads-writable-"), manifest: kit("all") }, "core-manifest.md", new Set(["core-manifest.md"])); } catch (e) { refused = e.message; }
  ok(refused.includes("has changes not yet committed beyond its `Core:` line, whose move by the sync alone is let through"), "the writers' refusal of a manifest changed beyond its pin says the sync's move of it is let through", refused);
  let threw = null;
  try { placed(kit("all"), [{ name: "a.md", take: true }]); } catch (e) { threw = e; }
  ok(threw && /names no module/.test(threw.message), "a Modules line with no module to add after is never written");
  const core = moduleNames(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  ok(core.includes("game-design.md") && core.includes("claude.md") && core.includes("work-flow.md") && !core.some(n => !n.endsWith(".md")), "the core's modules are read from its folders", core.join());
}

// a project staged with the core's own files as its copy
const root = scratchDir("manifest-reads-");
const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  fs.mkdirSync(path.join(root, "core"));
  for (const d of ["scripts", ".packages", "roles", "tasks", "tools", "floor"]) fs.cpSync(path.join(core, d), path.join(root, "core", d), { recursive: true });
  fs.copyFileSync(path.join(core, "README.md"), path.join(root, "core/README.md"));
  const git = (...a) => execFileSync("git", a, { cwd: root, stdio: "ignore" });
  git("init", "-q");
  const start = (modules, more = "") => { fs.writeFileSync(path.join(root, "core-manifest.md"), manifest(modules, more)); return spawnSync(process.execPath, ["core/scripts/manifest-reads.mjs"], { cwd: root, encoding: "utf8" }); };
  let r = start("`how-to-work.md`, `inbox.md`");
  ok(r.status === 0 && /^note core-manifest.md: core\/tools\/codex\.md is neither/m.test(r.stdout) && !/no row for/.test(r.stdout) && /nothing fails over them/.test(r.stdout), "in a project it prints each note and exits 0, and asks no slot for a row", r.stdout + r.stderr);
  const others = ["roles/shared", "tasks", "tools"].flatMap(d => fs.readdirSync(path.join(core, d))).filter(f => f !== "game-design.md").map(f => `\`${f}\``).join(", ");
  r = start(others, "Not taken: `game-design.md` (no game here).\n");
  ok(r.status === 0 && /^ok /m.test(r.stdout), "a list of each module but one left out with its reason has no note", r.stdout + r.stderr);
  r = start("all");
  ok(r.status === 0 && /^ok /m.test(r.stdout), "a game that takes all, with no row, has no note: each slot is read or has a default", r.stdout + r.stderr);
  r = start("`how-to-work.md`\r::error title=x::y");
  ok(r.status === 0 && !/[\r]/.test(r.stdout) && !/^::/m.test(r.stdout) && /^note /m.test(r.stdout), "a control character in the manifest's text never starts a line of the log, so no workflow command is made of it", JSON.stringify(r.stdout.slice(0, 300)));
  fs.rmSync(path.join(root, "core-manifest.md"));
  r = spawnSync(process.execPath, ["core/scripts/manifest-reads.mjs"], { cwd: root, encoding: "utf8" });
  ok(r.status === 0 && /^note the manifest could not be read/m.test(r.stdout) && !r.stdout.includes(root) && !r.stdout.includes(fs.realpathSync(root)), "no manifest at all is a note, never a failure, naming the file from the project's root, never by its place on this machine", r.stdout + r.stderr);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

// the core's own repository
const self = spawnSync(process.execPath, [path.join(core, "scripts/manifest-reads.mjs"), "--core"], { encoding: "utf8" });
ok(self.status === 0, "each slot of the core's own README carries its mark", self.stderr);
{ // the core's own, with a slot's mark taken out: fails, saying its mend
  const dir = scratchDir("manifest-reads-core-");
  try {
    for (const d of ["scripts", ".packages"]) fs.cpSync(path.join(core, d), path.join(dir, d), { recursive: true });
    fs.writeFileSync(path.join(dir, "README.md"), fs.readFileSync(path.join(core, "README.md"), "utf8").replace(/^(\| \*large file\* \|[^|\n]*\|)[^|\n]*\|$/m, "$1 |"));
    execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
    const r = spawnSync(process.execPath, [path.join(dir, "scripts/manifest-reads.mjs"), "--core"], { encoding: "utf8" });
    ok(r.status === 1 && /\*large file\* carries none of the three marks/.test(r.stderr) && mended(r.stderr), "the core's README with a slot's mark taken out fails, saying its mend", r.stdout + r.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
