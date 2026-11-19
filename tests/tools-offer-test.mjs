// Tests the check of what the core offers each agent tool (scripts/tools-offer.mjs; tasks/tools.md, "What the core
// offers one tool, it offers each"; #467): the core's own table passes, and each kind of wrong cell, a tool with no
// column, a file no cell names, a map with no day and a part that leaves out a way a review is asked, or names the ways
// out of order (#397), fails, saying its mend; and so does a part of tasks/ways.md out of its form (#397). Its tests workflow runs it on every pull
// request here. Node's own modules.
//
//   node tests/tools-offer-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { TABLE, TOOL_DIRS, WAYS, table, wrong } from "../scripts/tools-offer.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const text = fs.readFileSync(path.join(root, TABLE), "utf8");
const tools = JSON.parse(fs.readFileSync(path.join(root, "scripts/staged-tools.json"), "utf8")).tools;
// (the files of a tool's own folders and the root's Markdown files, read from the checkout in place of the list of git's
// the script asks for; so a clean checkout, as CI's is: a file a tool wrote there and git does not track fails the first case)
const under = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => (e.isDirectory() ? under(`${d}/${e.name}`) : [`${d}/${e.name}`]));
const tracked = [...TOOL_DIRS.filter(d => fs.existsSync(path.join(root, d))).flatMap(under), ...fs.readdirSync(root).filter(f => /\.md$/u.test(f))];
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
ok(table(text).tools.find(t => t.name === "Kiro").issue === "#680" && !table(text).rows.some(r => /^Its issue/u.test(r.what)), "the last row names each column's issue, and is no row of what is offered");
ok(says(check(cell("The orchestrator", "Kiro", "maybe later")), "in none of the three forms"), "a cell in no form fails");
ok(says(check(cell("The orchestrator", "Kiro", "cannot: kiro.dev, its page on agents")), "in none of the three forms"), "a cannot with no day it was read fails");
ok(check(cell("The orchestrator", "Kiro", "cannot: kiro.dev, its page on agents, read 18 November 2026")).wrong.length === 0, "a cannot with its page and day passes");
const noIssue = check(cell("Its issue for what is not yet carried", "Kiro", ""));
ok(noIssue.wrong.length === 4 && noIssue.wrong.every(w => w.includes("names no issue") && mended(`FAIL ${w}`)), "a not yet whose column names no issue fails, each such cell; one that names its own (#400) passes", noIssue.wrong.join("\n"));
ok(says(check(cell("The orchestrator", "Kiro", "not yet: soon")), "in none of the three forms"), "a not yet naming no issue number fails");
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
// (Kiro's part as it stands, read through `read`, with its ways' lines written anew)
const kiro = fs.readFileSync(path.join(root, "tools/kiro.md"), "utf8");
const withKiro = to => check(text, { read: f => (f === "tools/kiro.md" ? to : fs.readFileSync(path.join(root, f), "utf8")) });
ok(WAYS.every(w => kiro.includes(w)) && withKiro(kiro).wrong.length === 0, "each tool's part says how a review is asked by each way, and passes");
ok(says(withKiro(kiro.replace("*Through a plug-in:*", "Through a plug-in:")), 'by the way "*Through a plug-in:*"'), "a part that leaves out a way fails, naming it and saying its mend");
const swapped = kiro.replace("*Side by side:*", "\u0000").replace("*On the host:*", "*Side by side:*").replace("\u0000", "*On the host:*");
ok(says(withKiro(swapped), "out of order"), "a part that names the ways out of order fails, saying its mend");
const heading = to => text.replace("Kiro (`tools/kiro.md`)", `Kiro (\`${to}\`)`);
ok(says(check(heading("tools")), "which is no file in the repository") && says(check(heading("../outside.md")), "which is no file in the repository"), "a heading that names a folder, or a file outside the repository, as a part fails, saying its mend");
// (tasks/ways.md as it stands, read through `read`, with a part written anew: tasks/ways.md, "A way of running sessions
// has a part of its own")
const waysText = fs.readFileSync(path.join(root, "tasks/ways.md"), "utf8");
const withWays = to => check(text, { read: f => (f === "tasks/ways.md" ? to : fs.readFileSync(path.join(root, f), "utf8")) });
ok(withWays(waysText).wrong.length === 0 && (waysText.match(/^## /gmu) ?? []).length === 3, "each way's part holds its labels in order, and passes");
ok(says(withWays(waysText.replace("- *Floor:*", "-")), "the part `cloud` holds *Task:*, *State:*, *Review:*, *Installs:*, where each part holds"), "a part that leaves out a label fails, naming it and saying its mend");
ok(says(withWays(waysText.replace("- *Task:* the owner starts", "- *Statex:* x\n- *Task:* the owner starts").replace("- *State:* none given", "- *Task:* none given")), "the part `terminal` holds"), "a part with a label twice or out of order fails");
ok(says(withWays(waysText.replace("## A plain terminal: `terminal`", "## A plain terminal")), "names no way") && says(withWays(waysText.replace("`terminal`", "`cloud`")), "has two parts"), "a heading that names no way, or a way named twice, fails");
ok(says(withWays(waysText.replace("- *Installs:* none: a terminal", "- *Installs:* a terminal")), "line *Installs:* is in no form read here"), "a line *Installs:* in no form read fails");

console.log(failed ? `${failed} of ${count} failed` : `all ${count} passed`);
process.exit(failed ? 1 : 0);
