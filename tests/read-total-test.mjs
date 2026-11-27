// Tests for the total read (scripts/read-total.mjs; tasks/cleaning.md, "A cut or a join lowers the total read"; #469):
// on a small core held in memory, a cut that lets a kind of task read less passes the three conditions, and one that
// makes a reader read more, that raises the sum, or that leaves a reader without a file it read fails, each saying its
// mend, save a file the description says was never needed; a change that adds or takes out no file is no cut. And on
// the core's own history and tree, the script runs and fails a call it does not know with its mend.
//
//   node tests/read-total-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { FLOOR, MAKE, START } from "../scripts/reading.mjs";
import { OPEN, candidates, conditions, cuts, tasks, total } from "../scripts/read-total.mjs";

let count = 0, failed = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const said = list => mended(list.map(l => `FAIL: ${l}`).join("\n"));

// A tree in memory: { path: text }.
const memory = texts => ({
  read: f => texts[f] ?? null,
  list: folder => Object.keys(texts).filter(f => f.startsWith(`${folder}/`) && !f.slice(folder.length + 1).includes("/") && f.endsWith(".md")).sort(),
  size: f => (f in texts ? Buffer.byteLength(texts[f]) : null),
});
// (a file's text: its head, then `n` lines of rules of its own, each told by its tag and number, so moved text is seen)
const rules = (tag, n, from = 0) => Array.from({ length: n }, (_, i) => `- A rule of ${tag}, number ${from + i}, which says what it says at some length.`).join("\n");
const text = (head, tag, n, from = 0) => `${head}\n\n${rules(tag, n, from)}\n`;
const core = {
  [FLOOR]: text("# F", "the floor", 30),
  "roles/builder.md": `# B\n\nRead at the start by the role \`builder\`.\n\n**${START}** \`roles/shared/work.md\`.\n`,
  "roles/reviewer.md": `# R\n\nRead at its start by the role \`reviewer\`.\n\n**${START}** \`roles/shared/work.md\`.\n`,
  "roles/shared/work.md": text("# W\n\nRead at the start of every task.", "work", 40),
  "tasks/screens.md": text("# S\n\nRead when a screen changes: the kinds `screen` and `polish`.", "screens", 120),
};
// (the cut: a part of the screens module only a polish task needs moves to a module of its own)
const cut = { ...core, "tasks/screens.md": text("# S\n\nRead when a screen changes: the kind `screen`.", "screens", 60), "tasks/polish.md": text("# P\n\nRead before a polish task: the kind `polish`.", "screens", 40, 60) };
const given = [{ id: "aaaaaaa", paths: ["src/a.js"] }, { id: "bbbbbbb", paths: ["src/b.js"] }];
const before = total(memory(core), given);
const after = texts => { const head = total(memory(texts), given, before); return [total(memory(core), given, head), head]; };

let got = conditions(...after(cut), "Never needed: `tasks/screens.md`, for a polish task, whose part moved to `tasks/polish.md`.");
ok(got.cut && !got.failures.length, "a cut that lets a polish task read less, no reader reading more, passes the three conditions", got.failures.join("\n"));
ok(before.readers.get("a builder's task of the kind polish").cost > total(memory(cut), given).readers.get("a builder's task of the kind polish").cost, "the kind that needed only a part reads less after the cut");
// (a tree's readers try their paths on the path patterns within the steps it is given, its own (#673): past them it
// fails, saying its mend, since a reading that takes every pattern left as matching weighs nothing; within them it
// reads as with all of LIMITS.steps)
let past = null;
try { total(memory(core), given, null, MAKE); } catch (e) { past = e; }
ok(past && /take more than the \d+ steps the total read gives one tree\. Mend: /.test(past.message) && said([past.message]) && total(memory(core), given, null, 1 << 20).sum === before.sum,
  "a tree whose readers' tries of their paths take more steps than it is given fails, saying its mend; within them it reads as with all of them", past?.message);

// (a cut that splits the start file in two: every reader opens both, so each reads more, its extra open counted)
const startSplit = { ...core, "roles/shared/work.md": text("# W\n\nRead at the start of every task.", "work", 20), "roles/shared/more.md": text("# M\n\nRead at the start of every task.", "work", 20, 20) };
startSplit["roles/builder.md"] = startSplit["roles/builder.md"].replace("`roles/shared/work.md`.", "`roles/shared/work.md`, `roles/shared/more.md`.");
startSplit["roles/reviewer.md"] = startSplit["roles/reviewer.md"].replace("`roles/shared/work.md`.", "`roles/shared/work.md`, `roles/shared/more.md`.");
got = conditions(...after(startSplit));
ok(got.cut && got.failures.some(f => /the total read does not go down/.test(f)) && got.failures.some(f => /the role builder, at its start reads more/.test(f)) && said(got.failures),
  `a split that every reader opens whole reads more by its open (${OPEN} bytes), raising the sum: it fails, saying the mend`, got.failures.join("\n"));

// (a cut that leaves a kind without a file it read, which still stands)
const dropped = { ...core, "tasks/screens.md": text("# S\n\nRead when a screen changes: the kind `screen`.", "screens", 110), "tasks/new.md": text("# N\n\nRead for a polish task: the kind `polish`.", "screens", 10, 110) };
got = conditions(...after(dropped));
ok(got.failures.some(f => /the kind polish no longer reads tasks\/screens\.md.*Never needed:/.test(f)) && said(got.failures), "a kind that loses a file it read, which still stands, fails, saying the mend", got.failures.join("\n"));
got = conditions(...after(dropped), "Readings taken\n\nNever needed: `tasks/screens.md`, since a polish task changes no screen's rules.\n");
ok(!got.failures.some(f => /no longer reads/.test(f)), "a file the description says was never needed, on its line `Never needed:`, is no loss", got.failures.join("\n"));
got = conditions(...after(dropped), "Never needed: `tasks/screens.md`\n");
ok(got.failures.some(f => /the kind polish no longer reads tasks\/screens\.md/.test(f)), "a line `Never needed:` that names the file and says no why is no line", got.failures.join("\n"));

// (a cut that drops a kind's last module: the kind is still read, on both sides, and its loss is seen)
const gone = { ...core, "tasks/screens.md": text("# S\n\nRead when a screen changes: the kind `screen`.", "screens", 110), "tasks/screen-more.md": text("# M\n\nRead when a screen changes: the kind `screen`.", "screens", 10, 110) };
got = conditions(...after(gone));
ok(got.cut && got.failures.some(f => /the kind polish no longer reads tasks\/screens\.md/.test(f)), "a kind whose last module no longer names it is read all the same, and loses what it read", got.failures.join("\n"));

// (what is no cut or join: text that moves between files that both stand, a new file of new rules, a file of rules taken
// out whose text stands nowhere, and a rename)
got = conditions(...after({ ...core, "tasks/screens.md": text("# S\n\nRead when a screen changes: the kinds `screen` and `polish`.", "screens", 300) }));
ok(!got.cut && !got.failures.length, "a change that adds or takes out no file the reading script names is no cut, and holds to nothing");
got = conditions(...after({ ...core, "tasks/games.md": text("# G\n\nRead when a game's rule changes: the kind `game`.", "games", 50) }));
ok(!got.cut && !got.failures.length, "a new module of new rules is no cut, though the total read rises", got.failures.join("\n"));
const { "tasks/screens.md": _screens, ...without } = core;
got = conditions(...after(without));
ok(!got.cut, "a module taken out whose text stands nowhere is no join", got.failures.join("\n"));
got = conditions(...after({ ...without, "tasks/screen.md": core["tasks/screens.md"] }));
ok(!got.cut && !got.failures.length, "a module renamed, its text as it stood, is no cut or join", got.failures.join("\n"));
got = conditions(...after({ ...without, "tasks/screens-a.md": text("# A\n\nRead when a screen changes: the kinds `screen` and `polish`.", "screens", 60), "tasks/screens-b.md": text("# B\n\nRead when a screen changes: the kinds `screen` and `polish`.", "screens", 60, 60) }));
ok(got.cut && got.failures.some(f => /does not go down/.test(f)), "a module cut in two that every reader opens both of is a cut, and fails", got.failures.join("\n"));

// (a cut whose moved text is wrapped anew is still a cut, read by its sentences)
const wrapped = { ...cut, "tasks/polish.md": `# P\n\nRead before a polish task: the kind \`polish\`.\n\n${rules("screens", 40, 60).replace(/\n- /gu, " ").replace(/, which/gu, ",\n  which")}\n` };
ok(cuts(before, total(memory(wrapped), given, before)).added.includes("tasks/polish.md"), "a cut whose moved rules are joined and wrapped anew is still a cut");
// (AGENTS.md, which every reader in the core opens at its start, is read: a rule moved out of it to a module is a cut)
const withEntry = { ...core, "AGENTS.md": text("# A", "agents", 80) }, entryBefore = total(memory(withEntry), given);
const movedOut = { ...withEntry, "AGENTS.md": text("# A", "agents", 40), "tasks/agents-more.md": text("# M\n\nRead when a screen changes: the kind `screen`.", "agents", 40, 40) };
const entryAfter = total(memory(movedOut), given, entryBefore);
ok(entryBefore.readers.get("the role builder, at its start").files.includes("AGENTS.md") && cuts(entryBefore, entryAfter).added.includes("tasks/agents-more.md") && entryAfter.sum < entryBefore.sum,
  "AGENTS.md is read by every reader, and a rule moved out of it to a module read on need is a cut that lowers the sum");

const ranked = candidates(memory(core), given);
ok(ranked.length === 1 && ranked[0][0] === "tasks/screens.md" && JSON.stringify(ranked[0][1]) === JSON.stringify(["polish", "screen"]) && ranked[0][2] === 2 * Buffer.byteLength(core["tasks/screens.md"]),
  "a file two kinds of task open is a candidate, with its kinds and what the readers read of it", JSON.stringify(ranked));

// (the core's own: its history gives tasks with their paths, and the script runs on its tree)
const own = tasks("HEAD", 3);
ok(own.every(t => /^[0-9a-f]{7}$/.test(t.id) && Array.isArray(t.paths)), "the core's merged pull requests read as tasks, each with the paths it changed");
const script = fileURLToPath(new URL("../scripts/read-total.mjs", import.meta.url));
const line = spawnSync(process.execPath, [script, "--line"], { encoding: "utf8" });
ok(line.status === 0 && /^The total read: [\d.]+ KB, over each role's start, each kind of task and the last \d+ merged pull requests/.test(line.stdout), "the state report's line is printed", line.stdout + line.stderr);
const same = spawnSync(process.execPath, [script, "--compare", "HEAD"], { encoding: "utf8" });
ok(same.status === 0 && /no cut or join/.test(same.stdout), "against its own head, nothing is cut", same.stdout + same.stderr);
const bad = spawnSync(process.execPath, [script, "--sum"], { encoding: "utf8" });
const noBase = spawnSync(process.execPath, [script, "--compare", "no-such-commit-here"], { encoding: "utf8" });
ok(bad.status === 1 && mended(bad.stderr) && noBase.status === 1 && mended(noBase.stderr), "a call it does not know, and a base that is no commit, fail, saying the mend", bad.stderr + noBase.stderr);

// (in a project, whose copy of the core it stands in, it reads nothing, says so, and decides nothing)
const proj = scratchDir("read-total-"), copy = path.join(proj, "core/scripts");
fs.mkdirSync(copy, { recursive: true });
for (const f of ["read-total.mjs", "reading.mjs", "file-size.mjs", "guards.mjs", "started.mjs", "mend.mjs"]) fs.copyFileSync(fileURLToPath(new URL(`../scripts/${f}`, import.meta.url)), path.join(copy, f));
execFileSync("git", ["init", "-q"], { cwd: proj });
const inProject = spawnSync(process.execPath, [path.join(copy, "read-total.mjs"), "--compare", "HEAD"], { cwd: proj, encoding: "utf8" });
fs.rmSync(proj, { recursive: true, force: true });
ok(inProject.status === 0 && /^not run: the total read reads the core's own repository alone/.test(inProject.stdout), "in a project's copy of the core it reads nothing, says so, and fails nothing", inProject.stdout + inProject.stderr);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the total read`);
process.exit(failed ? 1 : 0);
