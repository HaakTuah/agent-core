// Tests reasons.mjs (#756, point 2): a rule's reasons in one step, on rule files, a list and an archive written in a
// scratch folder, and run on the core's own. Its tests workflow runs it on every pull request here. Node's own modules.
//
//   node tests/reasons-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { entryFile } from "../scripts/holders.mjs";
import { mended } from "../scripts/mend.mjs";
import { lines, reasonsOf, report } from "../scripts/reasons.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = scratchDir("reasons-test-");
const write = (f, text) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), text); };

write("AGENTS.md", "# A core\n\n**An own rule.** Said here.\n");
write("tasks/x.md", "# A module\n\nRead when needed.\n\n**A first rule.** Said.\n\n**A second rule.** Said too.\n\n**A rule with none.** Nothing behind it.\n");
write("archive/instructions/items-001.md", [
  "# Items", "", "1. **20 October 2026** (a chat). Asked: why. Decided: so,", "   over two lines, as #12 says.", "",
  "2. **21 October 2026**, #34, point 1. A line of reasoning, naming #12 again and #56.", "   Changed by: 3.", "",
  "3. **22 October 2026**, #78. It changed item 2.", "   Changes: 2.", "   Changed by: 4.", "",
  "4. **23 October 2026**, #90. It changed item 3.", "   Changes: 3.", "",
].join("\n"));
for (const [key, behind, number] of [["tasks/x.md: A first rule", [1, 2], "findings; outcome: asked"], ["tasks/x.md: A second rule", [2, 9]], ["tasks/x.md", [1]], ["AGENTS.md: An own rule", [2]]]) {
  write(`scripts/holders/${entryFile(key)}`, JSON.stringify({ rule: key, behind, ...(number ? { number } : {}) }));
}

const first = reasonsOf(tmp, "tasks/x.md: A first rule");
ok(first.rule === "tasks/x.md: A first rule" && first.items.map(it => it.key).join() === "1,2" && first.fileItems.map(it => it.key).join() === "1", "a rule named whole gives the items behind it, and those behind its file as a whole", JSON.stringify(first));
ok(first.items[0].date === "20 October 2026" && first.items[0].text === "(a chat). Asked: why. Decided: so, over two lines, as #12 says." && first.items[0].file === "archive/instructions/items-001.md", "an item's date, its reasoning on one line and its file are read", JSON.stringify(first.items[0]));
ok(first.items[1].text.startsWith("#34, point 1. A line") && first.items[1].issues.join() === "34,12,56", "each issue an item names is read once", JSON.stringify(first.items[1]));
ok(first.items[1].text.endsWith("and #56.") && first.items[1].changedBy.join() === "3" && first.later.map(it => it.key).join() === "3,4", "an item's marks are no part of its text, and each later item that changed one listed is followed to the newest", JSON.stringify(first.later));
const printed = lines(first, tmp, tmp).join("\n");
ok(printed.includes("- Core archive 2, 21 October 2026 (archive/instructions/items-001.md): #34, point 1. A line of reasoning, naming #12 again and #56.\n  Changed by core archive 3: what it decided stands only as that changed it.") && printed.includes("Later items that changed one of these:\n- Core archive 3,") && printed.includes("issues/90"), "it prints, under an item, the items that changed it, then those items and their issues", printed);
ok(printed.includes("Its number: findings; outcome: asked.\n") && printed.includes("- Core archive 1, 20 October 2026 (archive/instructions/items-001.md): (a chat).") && printed.includes("Behind tasks/x.md's text as a whole:"), "it prints the number once, each item with its date and file, and the file's own items", printed);
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

// the command's report, on the core's own: a rule's reasons, and each failure saying its mend
const run = query => { const r = report(query, root, root); return { status: r.status, stdout: r.out }; };
const own = run("The archive is pointed to from the list");
ok(own.status === 0 && own.stdout.startsWith("core-changes/holders.md: The archive is pointed to from the list\n") && /- Core archive \S+, .*\(archive\/instructions\//u.test(own.stdout) && own.stdout.includes(`https://github.com/${CORE}/issues/252`), "run on the core's own rule, it prints its items and issues", own.stdout);
const several = run("builder"), nothing = run("no rule is named so");
ok(several.status === 1 && mended(several.stdout) && several.stdout.includes("roles/builder.md: Read by task, twice"), "run with a part that names several rules, it fails, listing them, with the mend", several.stdout);
ok(nothing.status === 1 && mended(nothing.stdout) && nothing.stdout.includes('as `node scripts/reasons.mjs "security.md: 3. The protected files"`'), "run with a part that names none, it fails with the mend, naming the command as seen from where it is run", nothing.stdout);
ok(report("no rule is named so", root, path.join(root, "scripts")).out.includes("`node reasons.mjs "), "the command named in the mend is the path from the folder it is run in");

const listed = report("rule", tmp, tmp).out.split("\n");
ok(listed.length === 5 && listed.slice(1).every(k => k.startsWith("  ") && !k.startsWith("   ")) && listed[1] === "  AGENTS.md: An own rule", "a part that names several rules lists each on a line of its own, set in", listed.join("|"));
ok(report("a first rule", tmp, tmp).status === 0 && report("a first rule", tmp, tmp).out === lines(first, tmp, tmp).join("\n"), "the report of one rule is the lines it gives, joined");
const bare = path.join(tmp, "bare");
fs.mkdirSync(path.join(bare, "tasks"), { recursive: true });
fs.writeFileSync(path.join(bare, "tasks", "x.md"), "# A module\n\n**A lone rule.** Said.\n");
const wrong = report("a lone rule", bare, bare);
ok(wrong.status === 0 && wrong.out.startsWith("FAIL ") && wrong.out.includes("Mend:") && wrong.out.split("\n")[1] === "tasks/x.md: A lone rule", "where the list cannot be read it says so first, with its mend, and the rule's lines follow", wrong.out);

process.exit(failed ? 1 : 0);
