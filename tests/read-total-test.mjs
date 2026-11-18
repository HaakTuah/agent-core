// Tests for the total read (scripts/read-total.mjs; tasks/cleaning.md, "A cut or a join lowers the total read"; #469):
// on a small core held in memory, a cut that lets a kind of task read less passes the three conditions, and one that
// makes a reader read more, that raises the sum, or that leaves a reader without a file it read fails, each saying its
// mend, save a file the description says was never needed; a change that adds or takes out no file is no cut. And on
// the core's own history and tree, the script runs and fails a call it does not know with its mend.
//
//   node tests/read-total-test.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { FLOOR, START } from "../scripts/reading.mjs";
import { OPEN, candidates, conditions, tasks, total } from "../scripts/read-total.mjs";

let count = 0, failed = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const said = list => mended(list.map(l => `FAIL: ${l}`).join("\n"));

// A tree in memory: { path: text }.
const memory = texts => ({
  read: f => texts[f] ?? null,
  list: folder => Object.keys(texts).filter(f => f.startsWith(`${folder}/`) && !f.slice(folder.length + 1).includes("/") && f.endsWith(".md")).sort(),
  size: f => (f in texts ? Buffer.byteLength(texts[f]) : null),
});
const text = (head, n) => `${head}\n${"x".repeat(n)}\n`;
const core = {
  [FLOOR]: text("# F", 2000),
  "roles/builder.md": `# B\n\nRead at the start by the role \`builder\`.\n\n**${START}** \`roles/shared/work.md\`.\n`,
  "roles/reviewer.md": `# R\n\nRead at its start by the role \`reviewer\`.\n\n**${START}** \`roles/shared/work.md\`.\n`,
  "roles/shared/work.md": text("# W\n\nRead at the start of every task.\n", 3000),
  "tasks/screens.md": text("# S\n\nRead when a screen changes: the kinds `screen` and `polish`.\n", 9000),
};
// (the cut: a part of the screens module only a polish task needs moves to a module of its own)
const cut = { ...core, "tasks/screens.md": text("# S\n\nRead when a screen changes: the kind `screen`.\n", 4000), "tasks/polish.md": text("# P\n\nRead before a polish task: the kind `polish`.\n", 3000) };
const given = [{ id: "aaaaaaa", paths: ["src/a.js"] }, { id: "bbbbbbb", paths: ["src/b.js"] }];
const before = total(memory(core), given);

let got = conditions(before, total(memory(cut), given), "Never needed: `tasks/screens.md`, for a polish task, whose part moved to `tasks/polish.md`.");
ok(got.cut && !got.failures.length, "a cut that lets a polish task read less, no reader reading more, passes the three conditions", got.failures.join("\n"));
ok(before.readers.get("a builder's task of the kind polish").cost > total(memory(cut), given).readers.get("a builder's task of the kind polish").cost, "the kind that needed only a part reads less after the cut");

// (a cut that splits the start file in two: every reader opens both, so each reads more, its extra open counted)
const startSplit = { ...core, "roles/shared/work.md": text("# W\n\nRead at the start of every task.\n", 1500), "roles/shared/more.md": text("# M\n\nRead at the start of every task.\n", 1500) };
startSplit["roles/builder.md"] = startSplit["roles/builder.md"].replace("`roles/shared/work.md`.", "`roles/shared/work.md`, `roles/shared/more.md`.");
startSplit["roles/reviewer.md"] = startSplit["roles/reviewer.md"].replace("`roles/shared/work.md`.", "`roles/shared/work.md`, `roles/shared/more.md`.");
got = conditions(before, total(memory(startSplit), given));
ok(got.cut && got.failures.some(f => /the total read does not go down/.test(f)) && got.failures.some(f => /the role builder, at its start reads more/.test(f)) && said(got.failures),
  `a split that every reader opens whole reads more by its open (${OPEN} bytes), raising the sum: it fails, saying the mend`, got.failures.join("\n"));

// (a cut that leaves a kind without a file it read, which still stands)
const dropped = { ...core, "tasks/screens.md": text("# S\n\nRead when a screen changes: the kind `screen`.\n", 9000), "tasks/new.md": text("# N\n\nRead for a polish task: the kind `polish`.\n", 10) };
got = conditions(before, total(memory(dropped), given));
ok(got.failures.some(f => /the kind polish no longer reads tasks\/screens\.md.*Never needed:/.test(f)) && said(got.failures), "a kind that loses a file it read, which still stands, fails, saying the mend", got.failures.join("\n"));
got = conditions(before, total(memory(dropped), given), "Readings taken\n\nNever needed: `tasks/screens.md`, since a polish task changes no screen's rules.\n");
ok(!got.failures.some(f => /no longer reads/.test(f)), "a file the description says was never needed, on its line `Never needed:`, is no loss", got.failures.join("\n"));

// (a change that moves text and adds or takes out no file is no cut)
got = conditions(before, total(memory({ ...core, "tasks/screens.md": text("# S\n\nRead when a screen changes: the kinds `screen` and `polish`.\n", 20000) }), given));
ok(!got.cut && !got.failures.length, "a change that adds or takes out no file the reading script names is no cut, and holds to nothing");

ok(JSON.stringify(candidates(memory(core))) === JSON.stringify([["tasks/screens.md", ["polish", "screen"]]]), "a file two kinds of task open is a candidate, with its kinds");

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

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the total read`);
process.exit(failed ? 1 : 0);
