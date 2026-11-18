// Tests the check of what the core offers each agent tool (scripts/tools-offer.mjs; tasks/tools.md, "What the core
// offers one tool, it offers each"; #467): the core's own table passes, and each kind of wrong cell, a tool with no
// column, a file no cell names and a map with no day fails, saying its mend. Its tests workflow runs it on every pull
// request here. Node's own modules.
//
//   node tests/tools-offer-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { TABLE, table, wrong } from "../scripts/tools-offer.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const text = fs.readFileSync(path.join(root, TABLE), "utf8");
const tools = JSON.parse(fs.readFileSync(path.join(root, "scripts/staged-tools.json"), "utf8")).tools;
const tracked = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
// (the core's table with the cell of one row and one tool's column written anew)
const cell = (row, tool, to, from = text) => {
  const t = table(from), col = t.tools.findIndex(x => x.name === tool) + 1;
  return from.split("\n").map(l => l.startsWith(`| ${row} |`) ? l.split("|").map((c, i) => (i === col + 1 ? ` ${to} ` : c)).join("|") : l).join("\n");
};
const check = (t, more = {}) => wrong({ root, text: t, tools, tracked, ...more });
const says = (r, what) => r.wrong.length === 1 && r.wrong[0].includes(what) && mended(`FAIL ${r.wrong[0]}`);

const own = check(text);
ok(own.wrong.length === 0 && table(text).tools.map(x => x.name).join() === tools.join(), "the core's own table passes, a column for each tool of the list", own.wrong.join("\n"));
ok(says(check(cell("The orchestrator", "Kiro", "")), "is empty"), "an empty cell fails, saying its mend");
ok(says(check(cell("The orchestrator", "Kiro", "maybe later")), "in none of the three forms"), "a cell in no form fails");
ok(says(check(cell("The orchestrator", "Kiro", "cannot: kiro.dev, its page on agents")), "in none of the three forms"), "a cannot with no day it was read fails");
ok(check(cell("The orchestrator", "Kiro", "cannot: kiro.dev, its page on agents, read 18 November 2026")).wrong.length === 0, "a cannot with its page and day passes");
ok(says(check(cell("The orchestrator", "Kiro", "not yet")), "in none of the three forms"), "a not yet with no issue fails");
const closed = check(text, { isOpen: n => n !== 680 });
ok(closed.wrong.length > 0 && closed.wrong.every(w => w.includes("#680, which is not open") && mended(`FAIL ${w}`)), "a not yet whose issue is closed fails, each cell that names it, where it can be read", closed.wrong.join("\n"));
ok(check(text, { isOpen: () => null }).unread.includes("680"), "and where it cannot be read, nothing fails for it and it is named as not read");
ok(says(check(text, { tools: [...tools, "Zed"] }), "the tool Zed"), "a tool of the list with no column fails");
ok(says(check(cell("The orchestrator", "Kiro", "carried: `tools/zed.md`")), "names tools/zed.md, which is not there"), "a carried cell that names a file not there fails");
ok(says(check(cell("Helpers, and the hook that holds their model and effort", "Claude Code", "carried: `tasks/helpers.md`")), "scripts/helper-call.mjs is a file of a tool's own"), "a hook script no cell names fails");
const kit = check(cell("The entry file", "Kiro", "carried: it reads `AGENTS.md` itself"));
ok(kit.wrong.length === 2 && kit.wrong[0].startsWith("setup/template/kiro-steering.md.tmpl is a file of a tool's own") && kit.wrong[1].startsWith(".kiro/steering/core.md is a file") && kit.wrong.every(w => mended(`FAIL ${w}`)),
  "a template of the starter kit for a tool that no cell names fails, and so does the core's own file it writes, which counts as named where its template is", kit.wrong.join("\n"));
ok(says(check(cell("The map of the tiers to its models", "Codex", "carried: `tools/other-builders.md`")), "says no day its documentation was read"), "a map whose part says no day its documentation was read fails");
const run = spawnSync(process.execPath, [path.join(root, "scripts/tools-offer.mjs")], { encoding: "utf8" });
ok(run.status === 0 && /0 wrong/.test(run.stdout), "run on the core, it passes", `${run.stdout}${run.stderr}`);

console.log(failed ? `${failed} of ${count} failed` : `all ${count} passed`);
process.exit(failed ? 1 : 0);
