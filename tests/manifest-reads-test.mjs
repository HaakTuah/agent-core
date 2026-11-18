// Tests the manifest check (scripts/manifest-reads.mjs): on small texts made here, on a project staged with a
// copy of the core's own files, and on the core's own repository, where a slot's mark short of its part fails; in a
// project it only reports.
// Its tests workflow runs this on every pull request here. Node's own modules and git only.
//
//   node tests/manifest-reads-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markGap, markGaps, modulesOf, notes, slotTable } from "../scripts/manifest-reads.mjs";
import { mended } from "../scripts/mend.mjs";

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

// a project staged with the core's own files as its copy
const root = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-reads-"));
const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  fs.mkdirSync(path.join(root, "core"));
  for (const d of ["scripts", "third-party", "roles", "tasks", "tools", "floor"]) fs.cpSync(path.join(core, d), path.join(root, "core", d), { recursive: true });
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-reads-core-"));
  try {
    for (const d of ["scripts", "third-party"]) fs.cpSync(path.join(core, d), path.join(dir, d), { recursive: true });
    fs.writeFileSync(path.join(dir, "README.md"), fs.readFileSync(path.join(core, "README.md"), "utf8").replace(/^(\| \*large file\* \|[^|\n]*\|)[^|\n]*\|$/m, "$1 |"));
    execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
    const r = spawnSync(process.execPath, [path.join(dir, "scripts/manifest-reads.mjs"), "--core"], { encoding: "utf8" });
    ok(r.status === 1 && /\*large file\* carries none of the three marks/.test(r.stderr) && mended(r.stderr), "the core's README with a slot's mark taken out fails, saying its mend", r.stdout + r.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
