// Tests the manifest check (manifest-reads.mjs, beside this file): on small texts made here, on a project staged with a
// copy of the core's own files, and on the core's own repository, where a gap fails; in a project it only reports.
// Its tests workflow runs this on every pull request here. Node's own modules and git only.
//
//   node scripts/manifest-reads-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { coreGaps, filledIn, modulesOf, notes, slotTable } from "./manifest-reads.mjs";
import { mended } from "./mend.mjs";

let failed = 0, count = 0;
const ok = (cond, what, more = "") => { count++; if (!cond) { failed++; console.error(`FAIL: ${what}${more ? `\n${more}` : ""}`); } };
const has = (list, part) => list.some(f => f.includes(part));

const README = "# x\n\n## Slots\n\n| Slot | What the project fills in |\n| --- | --- |\n| *owner's account* | the login |\n| *follows* | `main` or `releases`; left out, the releases |\n| *progress file* | the queue |\n| *big file*, *tiny file* | a game's names |\n\n## Next\n";
const MODULES = { "a.md": "Reads the *progress file*.", "b.md": "Reads the *follows* slot and the *progress file*.", "g.md": "Uses the *big file*. A *keep it lean* is no slot." };
const FLOOR = { "f.md": "The *owner's account* acts." };
const manifest = (modules, slots, more = "") => `# Core manifest\n\nFloor: whole. Modules: ${modules}.\n${more}\n## Slots\n| Slot | Here |\n| --- | --- |\n${slots}\n\n## Differences\nNone.\n`;
const ROWS = "| *owner's account* | `me` |\n| *progress file* | `Q.md` |";
const run = m => notes({ manifest: m, readme: README, moduleTexts: MODULES, floorTexts: FLOOR });

const table = slotTable(README);
ok(table.size === 5 && table.get("follows").fallback && !table.get("progress file").fallback && table.get("tiny file").what === "a game's names", "the slots table is read, a slot with a default marked, one row of several names shared", JSON.stringify([...table]));
ok(italicsOk(), "an italic phrase that is no slot is no slot used");
function italicsOk() { return !has(run(manifest("all", ROWS + "\n| *big file* | x |")), "keep it lean"); }
const wrapped = notes({ manifest: manifest("all", ROWS), readme: README, moduleTexts: { ...MODULES, "g.md": "Uses the *big\n  file*, as a wrapped line has it." }, floorTexts: FLOOR });
ok(has(wrapped, "no row for *big file*"), "a slot whose name a module wraps over a line break is read as used", wrapped.join("\n"));
const started = Date.now();
notes({ manifest: manifest("all", ROWS), readme: README, moduleTexts: { ...MODULES, "g.md": `Uses the *big\n${" ".repeat(1_000_000)}` }, floorTexts: FLOOR });
ok(Date.now() - started < 2000, `an italic left open before a long blank line is read in one pass, not tried each way (${Date.now() - started} ms)`);

ok(run(manifest("all", ROWS + "\n| *big file* | `1 KB` |")).length === 0, "all modules taken, every slot they use filled or with a default: no note");
let n = run(manifest("`a.md`, `b.md`, `g.md`", ROWS + "\n| *big file* | `1 KB` |"));
ok(n.length === 0, "a list naming every module: no note", n.join("\n"));
n = run(manifest("`a.md`, `b.md`", ROWS));
ok(n.length === 1 && has(n, "core/tasks/g.md is neither on") && has(n, "Not taken: `g.md` (<why"), "a module the list neither takes nor leaves out is named, with the line to add", n.join("\n"));
n = run(manifest("`a.md`, `b.md`", ROWS, "Not taken: `g.md` (no game here).\n"));
ok(n.length === 0, "a module left out with its reason is no note, and a slot only it uses needs no row", n.join("\n"));
n = run(manifest("`a.md`, `b.md`", ROWS, "Not taken: `g.md`.\n"));
ok(n.length === 1 && has(n, "g.md is neither"), "a module left out with no reason is a note");
n = run(manifest("`a.md`, `zzz.md`, `b.md`, `g.md`", ROWS + "\n| *big file* | x |"));
ok(n.length === 1 && has(n, "names zzz.md, which is no module"), "a name on the list that is no module is a note", n.join("\n"));
n = run(manifest("`a.md`, `b.md`", "| *owner's account* | `me` |\n| *progress file* | |", "Not taken: `g.md` (no game).\n"));
ok(n.length === 1 && has(n, "no row for *progress file*") && has(n, "a.md") && has(n, "b.md") && has(n, "| *progress file* | <the queue> |"), "a slot a taken module uses and no row fills is named with its modules and the row to add", n.join("\n"));
n = run(manifest("`b.md`", "| *progress file* | `Q.md` |", "Not taken: `a.md` (x), `g.md` (y).\n"));
ok(n.length === 1 && has(n, "no row for *owner's account*") && has(n, "core/floor/f.md"), "a slot the floor uses needs a row whatever the modules", n.join("\n"));
n = run(manifest("`a.md`, `b.md`", ROWS, "Not taken: `g.md` (no game).\n"));
ok(!has(n, "follows"), "a slot with a default needs no row");
n = run(manifest("everything we like", ROWS));
ok(n.length >= 1 && has(n, "cannot be read"), "a Modules line neither all nor a list is a note, never a guess", n.join("\n"));
n = run(manifest("all", ROWS + "\n| *big file* | x |").replace(/\n/g, "\r\n"));
ok(n.length === 0, `line ends of Windows are read as Unix's: ${n.join("; ")}`);
ok(filledIn(manifest("all", "| *progress file* | |")).size === 0, "a row with no value fills nothing");
const m = modulesOf(manifest("`tasks/a.md`, `b`", ROWS, "Not taken: `g.md` (no game; none).\n"));
ok(m.taken.has("a.md") && m.taken.has("b.md") && m.notTaken.get("g.md") === "no game; none", "names are read with or without the folder and the extension");

// the core's own AGENTS.md reading
const agents = slots => `# x\n\n## The core this repository takes\n\n@tasks/a.md\n\nNot taken, each for its reason:\n\n- \`tasks/g.md\`: no game.\n\n${slots}\n\n## Next\n`;
const own = a => coreGaps({ agents: a, readme: README, moduleTexts: MODULES, floorTexts: FLOOR });
ok(own(agents("The slots here: the *progress file*: `Q.md`; the *owner's account*: `me`.")).length === 0, "the core's own slots paragraph that fills each slot passes, and a module not taken uses none");
let g = own(agents("The slots here: the *progress file*: `Q.md`."));
ok(g.length === 1 && has(g, "no *owner's account*") && has(g, "floor/f.md") && mended(g.map(f => `FAIL: ${f}`).join("\n")), "a gap in the core's own slots fails, saying the slot to add as its mend", g.join("\n"));
g = own(agents("The slots here: the *owner's account*: `me`.\n\n@tasks/b.md"));
ok(g.length === 1 && has(g, "no *progress file*"), "a slot a module taken here uses and the paragraph lacks fails", g.join("\n"));
ok(has(own(agents("no paragraph").replace("The slots here", "x")), "The slots here") && mended(own(agents("no paragraph").replace("The slots here", "x")).map(f => `FAIL: ${f}`).join("\n")), "an AGENTS.md with no slots paragraph fails, saying its mend");

// a project staged with the core's own files as its copy
const root = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-reads-"));
const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  fs.mkdirSync(path.join(root, "core"));
  for (const d of ["scripts", "roles", "tasks", "tools", "floor"]) fs.cpSync(path.join(core, d), path.join(root, "core", d), { recursive: true });
  fs.copyFileSync(path.join(core, "README.md"), path.join(root, "core/README.md"));
  const git = (...a) => execFileSync("git", a, { cwd: root, stdio: "ignore" });
  git("init", "-q");
  const start = (modules, slots, more = "") => { fs.writeFileSync(path.join(root, "core-manifest.md"), manifest(modules, slots, more)); return spawnSync(process.execPath, ["core/scripts/manifest-reads.mjs"], { cwd: root, encoding: "utf8" }); };
  let r = start("`how-to-work.md`, `inbox.md`", "| *owner's account* | `me` |");
  ok(r.status === 0 && /^note core-manifest.md: core\/tools\/codex\.md is neither/m.test(r.stdout) && /no row for \*progress file\*/.test(r.stdout) && /nothing fails over them/.test(r.stdout), "in a project it prints each note and exits 0", r.stdout + r.stderr);
  const kit = fs.readFileSync(path.join(core, "setup/template/core-manifest.md.tmpl"), "utf8").split("\n").filter(l => /^\| \*/.test(l)).join("\n").replace("{{owner}}", "me");
  const others = ["roles/shared", "tasks", "tools"].flatMap(d => fs.readdirSync(path.join(core, d))).filter(f => f !== "game-design.md").map(f => `\`${f}\``).join(", ");
  r = start(others, kit, "Not taken: `game-design.md` (no game here).\n");
  ok(r.status === 0 && /^ok /m.test(r.stdout), "a list of each module but one left out with its reason, and the starter kit's rows, has no note", r.stdout + r.stderr);
  r = start("all", kit);
  ok(r.status === 0 && /no row for \*computer players\*/.test(r.stdout) && !/^note.*no row for \*(progress file|report)\*/m.test(r.stdout), "a game that takes all is asked for the rows its module uses", r.stdout + r.stderr);
  r = start("`how-to-work.md`\r::error title=x::y", "| *owner's account* | `me` |");
  ok(r.status === 0 && !/[\r]/.test(r.stdout) && !/^::/m.test(r.stdout) && /^note /m.test(r.stdout), "a control character in the manifest's text never starts a line of the log, so no workflow command is made of it", JSON.stringify(r.stdout.slice(0, 300)));
  fs.rmSync(path.join(root, "core-manifest.md"));
  r = spawnSync(process.execPath, ["core/scripts/manifest-reads.mjs"], { cwd: root, encoding: "utf8" });
  ok(r.status === 0 && /^note the manifest could not be read/m.test(r.stdout), "no manifest at all is a note, never a failure", r.stdout + r.stderr);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

// the core's own repository
const self = spawnSync(process.execPath, [path.join(core, "scripts/manifest-reads.mjs"), "--core"], { encoding: "utf8" });
ok(self.status === 0, "the core's own AGENTS.md fills each slot its modules use", self.stderr);

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
