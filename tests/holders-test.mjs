// Tests rules.mjs (what counts as a rule, and its text), holders.mjs (what holds each, the archive's items behind each,
// and what it fails; and, with --own, a project's own rules, which fail nothing: #662) and archive.mjs (the archive's two forms in step), on
// rule files and holders written in a scratch folder, and on the core's own. Its tests workflow runs it on every pull
// request here. Node's own modules.
//
//   node tests/holders-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inStep } from "../scripts/archive.mjs";
import { OWN, counts, holders, ownHolders, ownReport, report } from "../scripts/holders.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { fingerprint, rules, rulesOf } from "../scripts/rules.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "holders-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

// ---- what counts as a rule ----
const text = [
  "# A module", "", "Read when needed.", "",
  "**1. A rule of a paragraph.**", "- Its first point.", "- **A rule inside it:** said here.", "  - and its own point.", "",
  "Running text with **bold** inside opens nothing.", "",
  "**2. The next one,** said in one line.", "",
  "1. **Numbered** and its text", "   on two lines.", "   - **Its own item,** indented.", "2. **The second numbered.**", "",
  "```", "**Not a rule** in a fence.", "```", "",
  "- **A last item.**",
].join("\n");
const r = rulesOf("tasks/x.md", text);
ok(JSON.stringify(r.map(x => x.lead)) === JSON.stringify(["1. A rule of a paragraph", "A rule inside it", "2. The next one", "Numbered", "Its own item", "The second numbered", "A last item"]),
  "a rule is each paragraph or item that opens with a bold lead, its stop or colon left out; none in running text or a fence", JSON.stringify(r.map(x => x.lead)));
ok(r[0].text.includes("and its own point") && r[0].text.includes("Running text") && !r[0].text.includes("2. The next one"), "a paragraph's rule runs to the next paragraph that opens one, its items in it");
ok(r[1].text === "- **A rule inside it:** said here.\n  - and its own point.", "an item's rule holds the lines indented under it, and stops at the next item at its depth", r[1].text);
ok(r[3].text.includes("on two lines") && r[3].text.includes("Its own item") && !r[3].text.includes("The second"), "a numbered item holds its own items");
ok(fingerprint("a  rule\nsaid") === fingerprint("a rule said") && fingerprint("a rule") !== fingerprint("a rules"), "a fingerprint changes with a word, not with spacing");
const mine = rules(root);
ok(mine.length > 100 && new Set(mine.map(x => x.key)).size === mine.length, `the core's floor and modules hold ${mine.length} rules, no two named alike`);
ok(rules(root, { agents: true }).some(x => x.key === "AGENTS.md: Nothing locks a project"), "with agents, the core's own AGENTS.md is read too");

// ---- what holds each, and what fails ----
const project = (holdersJson, extra = {}) => {
  const dir = fs.mkdtempSync(path.join(tmp, "p-"));
  fs.mkdirSync(path.join(dir, "tasks")); fs.mkdirSync(path.join(dir, "scripts"));
  fs.writeFileSync(path.join(dir, "tasks", "x.md"), text);
  fs.writeFileSync(path.join(dir, "scripts", "a-check.mjs"), "");
  fs.writeFileSync(path.join(dir, "scripts", "holders.json"), typeof holdersJson === "string" ? holdersJson : JSON.stringify({ holders: holdersJson, ...(extra.behind ? { behind: extra.behind } : {}), ...(extra.numbers ? { numbers: extra.numbers } : {}) }));
  delete extra.behind; delete extra.numbers;
  for (const [f, t] of Object.entries(extra)) fs.writeFileSync(path.join(dir, f), t);
  return dir;
};
const aCase = { name: "a-case", holds: ["tasks/x.md: The second numbered", "tasks/x.md: A last item"], inPart: ["tasks/x.md: A last item"] };
const good = holders(project({ "tasks/x.md: 1. A rule of a paragraph": "check: scripts/a-check.mjs", "tasks/x.md: A rule inside it": ["check: GitHub's ruleset, in part", "audit, in part"], "tasks/x.md: Numbered": "describes", "tasks/x.md: Its own item": "audit" }), [aCase]);
const c = counts(good);
ok(!good.wrong.length && c.check === 1 && c.case === 1 && c.audit === 1 && c.part === 2 && c.describes === 1 && JSON.stringify(c.none) === JSON.stringify(["tasks/x.md: 2. The next one"]),
  "each rule is counted by its holders, a staged case's own among them; one held only in part counts as in part; one with none is listed", JSON.stringify({ ...c, wrong: good.wrong }));
const hooked = counts(holders(project({ "tasks/x.md: 1. A rule of a paragraph": "check: scripts/work-saved.sh, in part", "tasks/x.md: A rule inside it": ["check: scripts/helper-call.mjs", "describes"], "tasks/x.md: Numbered": ["check: scripts/work-saved.sh", "check: scripts/a-check.mjs, in part"] }, { "scripts/work-saved.sh": "", "scripts/helper-call.mjs": "" }), []));
ok(JSON.stringify(hooked.hooked) === JSON.stringify(["tasks/x.md: 1. A rule of a paragraph", "tasks/x.md: A rule inside it"]) && hooked.none.includes("tasks/x.md: A rule inside it") && hooked.check === 0 && hooked.part === 1,
  "a rule whose only holders are hooks is listed as held by none, and one a check holds beside a hook is counted by the check (tasks/tools.md)", JSON.stringify(hooked));
const bad = holders(project({ "tasks/x.md: Gone": "check: scripts/a-check.mjs", "tasks/x.md: Numbered": "check: scripts/missing.mjs", "tasks/x.md: A last item": "case: a-case", "tasks/x.md: The second numbered": "reviews" }), []);
ok(bad.wrong.length === 4 && bad.wrong.every(w => /Mend: /.test(w)), "a key that names no rule, a check not there, a staged case named here and a holder in no form each fail, saying the mend", bad.wrong.join("\n"));
ok(holders(project("{ not json"), []).wrong.length === 1, "holders.json that cannot be read fails");
ok(report(root).length >= 1 && /^- Of \d+ rules/.test(report(root)[0]), "the state report's lines begin with the counts");

// ---- the archive's items behind each rule, and its two forms ----
const archive = (reasons, words = {}) => {
  const dir = project({}, {});
  for (const [folder, files] of [["archive/instructions", reasons], ["words", words]]) {
    fs.mkdirSync(path.join(dir, folder), { recursive: true });
    for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(dir, folder, f), t);
  }
  return dir;
};
const inStepOk = archive({ "items-001.md": "# Reasons\n\n1. **1 Nov** (a game). Asked: a. Decided: b.\n\n2. **16 Nov**, #9: why.\n" }, { "items-001.md": "# Words\n\n1. **1 Nov** (a game): \"yes, with a condition\".\n" });
ok(!inStep(inStepOk).length, "an archive whose items each have their reasoning, the newest naming its issue, is in step", inStep(inStepOk).join("\n"));
const outOf = archive({ "items-001.md": "1. **1 Nov**. Asked: a. Said: b.\n\n3. **2 Nov**. Decided: c.\n     > a quote\n\n4. **16 Nov**, #9: twice.\n\n4. **16 Nov**: no issue.\n" }, { "items-001.md": "1. **1 Nov**: words.\n\n2. **1 Nov**: words.\n" });
const outWrong = inStep(outOf);
const late = archive({ "items-001.md": "1. **1 Nov**. Decided: a.\n" }, { "items-001.md": "1. **1 Nov**: words.\n\n246. **17 Nov**: new words.\n" });
ok(inStep(late).some(w => w.includes("item 246 adds the owner's words") && /Mend: /.test(w)), "the owner's words past item 245 fail, saying the mend", inStep(late).join("\n"));
ok(["item 4 stands twice", "item 2 has no reasoning", "item 2 is missing", "item 3 quotes", "item 1 does not say what was decided", "item 4 names no issue"].every(w => outWrong.some(x => x.includes(w))) && outWrong.every(w => /Mend: /.test(w)),
  "an item twice, words with no reasoning, a gap, a quote, no decision and a new item with no issue each fail, saying the mend", outWrong.join("\n"));
// (#394: of an item numbered twice, the one outside the file its number puts it in is the one to move, with the next
// free number at the end of the newest file; one alone outside its file fails too; in the words, a twice-numbered item
// takes its reasoning's number)
const r3 = "3. **3 Nov**, #3: c.\n", r1 = "1. **1 Nov**, #1: a.\n\n2. **2 Nov**, #2: b.\n";
const twiceAcross = inStep(archive({ "items-001.md": `${r1}\n3. **3 Nov**, #4: d.\n`, "items-003.md": r3 }));
ok(twiceAcross.some(w => /archive\/instructions: item 3 stands twice, at archive\/instructions\/items-001\.md:5 and archive\/instructions\/items-003\.md:1\. Mend: give the one at archive\/instructions\/items-001\.md:5 the next free number, 4, at the end of archive\/instructions\/items-003\.md/.test(w)),
  "of an item numbered twice, the one outside its number's file moves, whichever stands first, with the next free number (#394's own case)", twiceAcross.join("\n"));
const twiceIn = inStep(archive({ "items-001.md": `${r1}\n2. **2 Nov**, #5: e.\n` }));
ok(twiceIn.some(w => /item 2 stands twice, at [^ ]*items-001\.md:3 and [^ ]*items-001\.md:5\. Mend: give the one at archive\/instructions\/items-001\.md:5 the next free number, 3/.test(w)), "of two in their file, the later moves", twiceIn.join("\n"));
const outside = inStep(archive({ "items-001.md": `${r1}\n4. **4 Nov**, #4: d.\n`, "items-003.md": r3 }));
ok(outside.some(w => /archive\/instructions\/items-001\.md:5: item 4 stands outside archive\/instructions\/items-003\.md, the file its number puts it in\. Mend: /.test(w)), "an item alone in a file its number does not put it in fails, saying the mend", outside.join("\n"));
const twoTwice = inStep(archive({ "items-001.md": `${r1}\n1. **1 Nov**, #6: f.\n\n2. **2 Nov**, #7: g.\n` }));
ok(twoTwice.some(w => /item 1 stands twice.* the next free number, 3,/.test(w)) && twoTwice.some(w => /item 2 stands twice.* the next free number, 4,/.test(w)), "two numbers each used twice are each given a free number of their own", twoTwice.join("\n"));
const below = inStep(archive({ "items-005.md": "5. **5 Nov**, #5: e.\n\n1. **1 Nov**, #1: a.\n" }));
ok(below.some(w => /item 1 stands outside no file of archive\/instructions\/, since none starts at or below 1, .* Mend: /.test(w)) && !below.some(w => w.includes("undefined")), "an item below every file's first number says so, and never \"undefined\"", below.join("\n"));
const wordsAstray = inStep(archive({ "items-001.md": `${r1}\n3. **3 Nov**, #3: c.\n` }, { "items-001.md": "1. **1 Nov**: a.\n\n3. **3 Nov**: c.\n", "items-003.md": "# Words\n" }));
ok(wordsAstray.some(w => /words\/items-001\.md:3: item 3 stands outside words\/items-003\.md, the file its number puts it in\. Mend: move it there$/.test(w)), "in the words, an item outside its file is moved there, and given no other number", wordsAstray.join("\n"));
const wordsTwice = inStep(archive({ "items-001.md": "1. **1 Nov**. Decided: a.\n" }, { "items-001.md": "1. **1 Nov**: words.\n\n1. **1 Nov**: more.\n" }));
ok(wordsTwice.some(w => /words: item 1 stands twice, .* Mend: give the one at words\/items-001\.md:3 the number its reasoning has in archive\/instructions\//.test(w)), "in the words, an item numbered twice takes the number its reasoning has, never a new one", wordsTwice.join("\n"));
const behindBad = holders(project({}, { behind: { "tasks/x.md: Gone": [1], "tasks/x.md: Numbered": [7], "tasks/x.md: Its own item": "1", "tasks/x.md": [1] }, "tasks/y.md": "# Y\n\n- **A rule** (core archive 1).\n" }), []);
ok(["names \"tasks/x.md: Gone\"", "core archive 7 is no item", "is no list of item numbers", "tasks/y.md:3 points to the archive"].every(w => behindBad.wrong.some(x => x.includes(w))) && !behindBad.wrong.some(x => x.includes("names \"tasks/x.md\"")) && behindBad.wrong.every(w => /Mend: /.test(w)),
  "behind: a key that is no rule, an item not in the archive, no list, and a pointer in a rule file each fail, saying the mend; a rule file alone is a key", behindBad.wrong.join("\n"));

// ---- the core's own, and the script as a check ----
const own = spawnSync(process.execPath, [path.join(root, "scripts", "holders.mjs")], { encoding: "utf8" });
const numbersBad = holders(project({}, { numbers: { "tasks/x.md: Gone": "findings; outcome: robust", "tasks/x.md: Numbered": "findings", "tasks/x.md: Its own item": "check fires; outcome: fast" } }), []);
ok(numbersBad.wrong.length === 2 && numbersBad.wrong.some(w => w.includes("\"numbers\", names \"tasks/x.md: Gone\"")) && numbersBad.wrong.some(w => w.includes("\"tasks/x.md: Numbered\": \"findings\" is in no form")) && numbersBad.wrong.every(w => /Mend: /.test(w)),
  "numbers: a key that is no rule, and a number with no outcome, each fail, saying the mend; one in its form passes", numbersBad.wrong.join("\n"));
ok(own.status === 0 && !own.stderr, "the core's own holders.json names only rules that stand, and checks that are there", own.stderr);
const failing = project({ "tasks/x.md: Gone": "audit" });
fs.mkdirSync(path.join(failing, "scripts", "staged"));
for (const f of ["archive.mjs", "core-address.mjs", "core-path.mjs", "guards.mjs", "holders.mjs", "rule-files.mjs", "rules.mjs", "started.mjs"]) fs.copyFileSync(path.join(root, "scripts", f), path.join(failing, "scripts", f));
fs.writeFileSync(path.join(failing, "scripts", "staged.mjs"), "export const CASES = [];\n");
fs.writeFileSync(path.join(failing, "scripts", "outcomes.mjs"), "export const NUMBER = /^$/u;\n");
const run = spawnSync(process.execPath, [path.join(failing, "scripts", "holders.mjs")], { encoding: "utf8" });
ok(run.status === 1 && mended(`${run.stdout}${run.stderr}`), "where holders.json is wrong the check fails, each failure saying its mend", `${run.stdout}${run.stderr}`);

// ---- a project's own rules (#662) ----
// (a scratch project: its AGENTS.md with one rule held and one not, the file it pulls in, its SECURITY.md with the rule
// file it adds, and a copy of the core whose rules are none of its own)
const proj = fs.mkdtempSync(path.join(tmp, "own-"));
const put = (f, t) => { fs.mkdirSync(path.dirname(path.join(proj, f)), { recursive: true }); fs.writeFileSync(path.join(proj, f), t); };
put("AGENTS.md", "# A game\n\n@core/floor/security.md\n@docs/play.md\n\n- **Each computer player keeps its style.** A test plays each.\n- **Name things plainly.** Words.\n");
put("docs/play.md", "# Play\n\n- **A turn ends on a move.** Rules of play.\n");
put("SECURITY.md", "# Security\n\n3. **The protected files,** besides:\n   - **the rule files:** `docs/design.md`;\n");
put("docs/design.md", "# Design\n\n**Saves are small.** Read on need.\n");
put("core/floor/security.md", "# The floor\n\n**1. Nothing secret.** The core's.\n");
put("tests/style.test.js", "");
// (a tool's own file of the project's, and a copy of the core where its manifest places it, under shared/core/)
const copied = fs.mkdtempSync(path.join(tmp, "own-"));
const put2 = (f, t) => { fs.mkdirSync(path.dirname(path.join(copied, f)), { recursive: true }); fs.writeFileSync(path.join(copied, f), t); };
put2("AGENTS.md", "# A tool\n\n@shared/core/floor/security.md\n\n- **Keep it short.** Words.\n");
put2("SECURITY.md", "# Security\n");
put2("core-manifest.md", "Core: " + CORE + " at " + "a".repeat(40) + ", copied whole under shared/core/ (never edited here).\n");
put2("shared/core/floor/security.md", "# The floor\n\n**1. Nothing secret.** The core's.\n");
put2("GEMINI.md", "# Gemini\n\n- **Ask before a big change.** Words.\n");
spawnSync("git", ["init", "-q"], { cwd: copied });
spawnSync("git", ["add", "-A"], { cwd: copied });
const tooled = ownHolders(copied).rules.map(r => r.key);
ok(tooled.includes("GEMINI.md: Ask before a big change") && tooled.includes("AGENTS.md: Keep it short") && !tooled.some(k => k.startsWith("shared/core/")),
  "a tool's own file of the project's is read for its rules, and the core's copy is left out where the manifest places it", tooled.join("; "));
const ownCli = (...a) => spawnSync(process.execPath, [path.join(root, "scripts", "holders.mjs"), "--own", ...a], { cwd: proj, encoding: "utf8" });
const unlisted = ownHolders(proj);
ok(JSON.stringify(unlisted.rules.map(r => r.key).sort()) === JSON.stringify(["AGENTS.md: Each computer player keeps its style", "AGENTS.md: Name things plainly", "SECURITY.md: The protected files", "SECURITY.md: the rule files", "docs/design.md: Saves are small", "docs/play.md: A turn ends on a move"]) && !unlisted.list
  && unlisted.start.has("docs/play.md: A turn ends on a move") && !unlisted.start.has("docs/design.md: Saves are small"),
  "a project's own rules are those of its rule files, what its AGENTS.md pulls in and what its SECURITY.md adds, none of the core's copy; those pulled in are read at the start", unlisted.rules.map(r => r.key).join("; "));
let r2 = ownCli("--write");
const written = JSON.parse(fs.readFileSync(path.join(proj, OWN), "utf8")).holders;
ok(r2.status === 0 && Object.keys(written).length === 6 && Object.values(written).every(v => v === "none") && /6 have no holder/.test(r2.stdout),
  "--write writes the first list, each rule named as held by none, and fails nothing", `${r2.stdout}${r2.stderr}`);
fs.writeFileSync(path.join(proj, OWN), JSON.stringify({ holders: { ...written, "AGENTS.md: Each computer player keeps its style": "check: tests/style.test.js", "docs/design.md: Saves are small": "check: tests/saves.test.js", "AGENTS.md: Gone": "audit", "docs/play.md: A turn ends on a move": "check: the code review" } }));
const held = ownHolders(proj), lines = ownReport(proj);
ok(counts(held).check === 1 && counts(held).none.length === 5 && held.wrong.length === 3 && held.wrong.some(w => w.includes("a review, which holds no rule")) && held.wrong.every(w => /Mend: /.test(w)),
  "the list names one rule's check, which is there; one that is not there, a review named as a check, and a rule that is gone, are wrong, each with its mend", held.wrong.join("\n"));
const listed = lines.find(l => l.startsWith("- No holder")) ?? "";
ok(/^- Of 6 rules of the project's own .*: 1 held whole by a check, .* 5 have no holder/.test(lines[0]) && listed.indexOf("docs/play.md: A turn ends on a move") < listed.indexOf("docs/design.md: Saves are small") && !listed.includes("Each computer player") && lines.filter(l => /Mend: /.test(l)).length === 3,
  "the report's lines: the counts, the rules with no holder, those read at a session's start first, and each wrong line of the list", lines.join("\n"));
// (a key and a value of the list, and a rule's lead, holding a line break, a workflow command and a mention: each goes
// into the report on one line, in a code span)
fs.writeFileSync(path.join(proj, OWN), JSON.stringify({ holders: { "x\n::error::key @ghost": "audit", "AGENTS.md: Name things plainly": "weird\n::warning::v" } }));
put("docs/play.md", "# Play\n\n- **A turn ends on a move.** Rules of play.\n- **Ask `@octocat` first.** Words.\n");
const hostile = ownReport(proj);
ok(hostile.every(l => !l.includes("\n")) && !hostile.some(l => /(?:^|[^`'])@(?:ghost|octocat)/u.test(l.replace(/`[^`]*`/gu, ""))) && hostile.some(l => l.includes("`x?::error::key @ghost`")),
  "text from the project's files goes into the report on one line, in code spans, so no workflow command or mention acts (floor rule 5)", hostile.join("\n"));
fs.writeFileSync(path.join(proj, OWN), '{"holders": @ghost }');
const unreadable = ownReport(proj).join("\n");
ok(/cannot be read \(`[^`]*@ghost[^`]*`\)/u.test(unreadable) && !/@ghost/u.test(unreadable.replace(/`[^`]*`/gu, "")), "a list that cannot be read is named with JSON's own words in a code span, so no mention in it acts", unreadable);
put("docs/play.md", "# Play\n\n- **A turn ends on a move.** Rules of play.\n");
fs.writeFileSync(path.join(proj, OWN), JSON.stringify({ holders: { ...written, "AGENTS.md: Each computer player keeps its style": "check: tests/style.test.js", "docs/design.md: Saves are small": "check: tests/saves.test.js", "AGENTS.md: Gone": "audit", "docs/play.md: A turn ends on a move": "check: the code review" } }));
r2 = ownCli();
ok(r2.status === 0 && /No holder/.test(r2.stdout), "--own fails nothing, a wrong list included", `${r2.stdout}${r2.stderr}`);
r2 = ownCli("--write");
const kept = JSON.parse(fs.readFileSync(path.join(proj, OWN), "utf8")).holders;
ok(r2.status === 0 && kept["AGENTS.md: Each computer player keeps its style"] === "check: tests/style.test.js" && kept["AGENTS.md: Name things plainly"] === "none", "--write again keeps what the list names", JSON.stringify(kept));

console.log(failed ? `${failed} of ${count} failed` : `all ${count} passed`);
process.exit(failed ? 1 : 0);
