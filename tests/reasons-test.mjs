// Tests reasons.mjs (#756, point 2): a rule's reasons in one step, on rule files, a list and an archive written in a
// scratch folder, and run on the core's own. Its tests workflow runs it on every pull request here. Node's own modules.
//
//   node tests/reasons-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { lines, reasonsOf } from "../scripts/reasons.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reasons-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const write = (f, text) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), text); };

write("AGENTS.md", "# A core\n\n**An own rule.** Said here.\n");
write("tasks/x.md", "# A module\n\nRead when needed.\n\n**A first rule.** Said.\n\n**A second rule.** Said too.\n\n**A rule with none.** Nothing behind it.\n");
write("archive/instructions/items-001.md", [
  "# Items", "", "1. **20 October 2026** (a chat). Asked: why. Decided: so,", "   over two lines, as #12 says.", "",
  "2. **21 October 2026**, #34, point 1. A line of reasoning, naming #12 again and #56.", "",
].join("\n"));
write("scripts/holders.json", JSON.stringify({
  behind: { "tasks/x.md: A first rule": [1, 2], "tasks/x.md: A second rule": [2, 9], "tasks/x.md": [1], "AGENTS.md: An own rule": [2] },
  numbers: { "tasks/x.md: A first rule": "findings; outcome: asked" },
}));

const first = reasonsOf(tmp, "tasks/x.md: A first rule");
ok(first.rule === "tasks/x.md: A first rule" && first.items.map(it => it.key).join() === "1,2" && first.fileItems.map(it => it.key).join() === "1", "a rule named whole gives the items behind it, and those behind its file as a whole", JSON.stringify(first));
ok(first.items[0].date === "20 October 2026" && first.items[0].text === "(a chat). Asked: why. Decided: so, over two lines, as #12 says." && first.items[0].file === "archive/instructions/items-001.md", "an item's date, its reasoning on one line and its file are read", JSON.stringify(first.items[0]));
ok(first.items[1].text.startsWith("#34, point 1. A line") && first.items[1].issues.join() === "34,12,56", "each issue an item names is read once", JSON.stringify(first.items[1]));
const printed = lines(first, tmp, tmp).join("\n");
ok(printed.includes("Its number: findings; outcome: asked; the outcome it stands for: asked.") && printed.includes("- Core archive 1, 20 October 2026 (archive/instructions/items-001.md): (a chat).") && printed.includes("Behind tasks/x.md's text as a whole:"), "it prints the number and its outcome, each item with its date and file, and the file's own items", printed);
ok([12, 34, 56].every(n => printed.includes(`- https://github.com/${CORE}/issues/${n}`)) && printed.indexOf("issues/12") < printed.indexOf("issues/34"), "it prints each issue's address once, in order", printed);
ok(lines(first, path.join(tmp, "."), path.dirname(tmp)).join("\n").includes(`(${path.basename(tmp)}/archive/instructions/items-001.md)`) && lines(first, tmp, path.join(tmp, "tasks")).join("\n").includes(`(${path.join(tmp, "archive/instructions/items-001.md").replace(/\\/gu, "/")})`), "a path is printed from where it runs where it lies under it, as a project's root holds its copy, and whole elsewhere");
ok(reasonsOf(tmp, "  a FIRST   rule ").rule === "tasks/x.md: A first rule", "a part of the rule's key names it, any case and spacing");
ok(reasonsOf(tmp, "AGENTS.md: An own rule").items[0].key === 2, "a rule of AGENTS.md is read too");
const second = reasonsOf(tmp, "a second rule");
ok(second.items[1].missing === true && lines(second, tmp, tmp).join("\n").includes("Core archive 9: not in the archive"), "an item the list names that is not in the archive is said so", JSON.stringify(second));
const none = lines(reasonsOf(tmp, "a rule with none"), tmp, tmp).join("\n");
ok(none.includes("no item of the archive is listed yet") && none.includes("Its number: none named"), "a rule with no item and no number says so", none);
ok(reasonsOf(tmp, "rule").matches.length === 4 && reasonsOf(tmp, "no such").matches.length === 0 && reasonsOf(tmp, "").matches.length === 0, "a query that names several rules, or none, gives what it matched");
ok(reasonsOf(tmp, "tasks/x.md").rule === "tasks/x.md" && reasonsOf(tmp, "tasks/x.md").fileItems.length === 0, "a rule file named whole gives the items behind its text");

// run, on the core's own: a rule's reasons, and each failure saying its mend
const run = (...args) => spawnSync(process.execPath, [path.join(root, "scripts/reasons.mjs"), ...args], { cwd: root, encoding: "utf8" });
const own = run("The archive is pointed to from the list");
ok(own.status === 0 && own.stdout.startsWith("AGENTS.md: The archive is pointed to from the list\n") && /- Core archive \S+, .*\(archive\/instructions\//u.test(own.stdout) && own.stdout.includes(`https://github.com/${CORE}/issues/252`), "run on the core's own rule, it prints its items and issues", own.stdout + own.stderr);
const several = run("builder"), nothing = run("no rule is named so");
ok(several.status === 1 && mended(several.stdout) && several.stdout.includes("roles/builder.md: Read by task, twice"), "run with a part that names several rules, it fails, listing them, with the mend", several.stdout);
ok(nothing.status === 1 && mended(nothing.stdout), "run with a part that names none, it fails with the mend", nothing.stdout);

process.exit(failed ? 1 : 0);
