// Tests rules.mjs (what counts as a rule, and its text), holders.mjs (what holds each, the archive's items behind each,
// and what it fails; and, with --own, a project's own rules, which fail nothing: #662) and archive.mjs (the archive's two forms in step), on
// rule files and holders written in a scratch folder, and on the core's own. Its tests workflow runs it on every pull
// request here, after the core's install: the file's form is read by ajv (schemas.mjs), and the script as a check is run
// once on a copy with no packages.
//
//   node tests/holders-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inStep as inStepAt, itemsIn, KEY, LAST_NUMBERED } from "../scripts/archive.mjs";
import { OWN, counts, entryFile, heldThere, holders, named, ownHolders, ownReport, report, shareLine } from "../scripts/holders.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { fingerprint, rules, rulesOf } from "../scripts/rules.mjs";
import { installed } from "../scripts/packages.mjs";
import { leftOut } from "../scripts/reading.mjs";
import { heldHere } from "../scripts/state-report.mjs";
import { shapeFaults } from "../scripts/schemas.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

// (the file's form is read by ajv, which the core's install brings; without it the cases that read the form could only
// fail on a message they never get, among the lines of the cases that ran, so the test stops and says what it lacks, #905)
if (!installed("ajv")) { console.error("FAIL: the core's packages are not installed, so the form of scripts/holders/ cannot be read (ajv). Mend: run `node scripts/install.mjs` first, then run this again"); process.exit(1); }

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = scratchDir("holders-test-");

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
// (the list as its entries stand: a file for each rule, named as entryFile names it)
const writeList = (dir, { holders: h = {}, behind: b = {}, numbers: n = {} }) => {
  fs.mkdirSync(path.join(dir, "scripts", "holders"), { recursive: true });
  for (const key of new Set([...Object.keys(h), ...Object.keys(b), ...Object.keys(n)])) {
    fs.writeFileSync(path.join(dir, "scripts", "holders", entryFile(key)), JSON.stringify({ rule: key, ...(key in h ? { holder: h[key] } : {}), ...(key in b ? { behind: b[key] } : {}), ...(key in n ? { number: n[key] } : {}) }));
  }
};
const project = (holdersJson, extra = {}) => {
  const dir = fs.mkdtempSync(path.join(tmp, "p-"));
  fs.mkdirSync(path.join(dir, "tasks")); fs.mkdirSync(path.join(dir, "scripts"));
  fs.writeFileSync(path.join(dir, "tasks", "x.md"), text);
  fs.writeFileSync(path.join(dir, "scripts", "a-check.mjs"), "");
  if (typeof holdersJson === "string") { fs.mkdirSync(path.join(dir, "scripts", "holders")); fs.writeFileSync(path.join(dir, "scripts", "holders", "broken.json"), holdersJson); }
  else writeList(dir, { holders: holdersJson, behind: extra.behind, numbers: extra.numbers });
  delete extra.behind; delete extra.numbers;
  for (const [f, t] of Object.entries(extra)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); }
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
ok(holders(project("{ not json"), []).wrong.length === 1, "an entry that cannot be read fails");
ok(report(root).length >= 1 && /^- Of \d+ rules/.test(report(root)[0]), "the state report's lines begin with the counts");

// ---- the archive's items behind each rule, and its two forms ----
// (each small archive here is read with its own last numbered item as the last that keeps its number; the core's own,
// 262, is read where a test names it)
const inStep = dir => inStepAt(dir, Math.max(0, ...[...itemsIn(dir, "archive/instructions").items.keys()].filter(Number.isInteger)));
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
  "an item twice, words with no reasoning, a numbered item taken out, a quote, no decision and a new item with no issue each fail, saying the mend", outWrong.join("\n"));
// (#394: of an item numbered twice, the one outside the file its number puts it in is the one to move, keyed by its
// issue since #744; one alone outside its file fails too; in the words, a twice-numbered item takes its reasoning's
// number)
const r3 = "3. **3 Nov**, #3: c.\n", r1 = "1. **1 Nov**, #1: a.\n\n2. **2 Nov**, #2: b.\n";
const twiceAcross = inStep(archive({ "items-001.md": `${r1}\n3. **3 Nov**, #4: d.\n`, "items-003.md": r3 }));
ok(twiceAcross.some(w => /archive\/instructions: item 3 stands twice, at archive\/instructions\/items-001\.md:5 and archive\/instructions\/items-003\.md:1\. Mend: give the one at archive\/instructions\/items-001\.md:5 a key by the issue that carries its owner's word, "#N", in a file of its own, archive\/instructions\/issue-N\.md, and change each "core archive 3" that means it/.test(w)),
  "of an item numbered twice, the one outside its number's file moves, whichever stands first, keyed by its issue (#394's own case; #744)", twiceAcross.join("\n"));
const twiceIn = inStep(archive({ "items-001.md": `${r1}\n2. **2 Nov**, #5: e.\n` }));
ok(twiceIn.some(w => /item 2 stands twice, at [^ ]*items-001\.md:3 and [^ ]*items-001\.md:5\. Mend: give the one at archive\/instructions\/items-001\.md:5 a key by the issue/.test(w)), "of two in their file, the later moves", twiceIn.join("\n"));
const outside = inStep(archive({ "items-001.md": `${r1}\n4. **4 Nov**, #4: d.\n`, "items-003.md": r3 }));
ok(outside.some(w => /archive\/instructions\/items-001\.md:5: item 4 stands outside archive\/instructions\/items-003\.md, the file its key puts it in\. Mend: /.test(w)), "an item alone in a file its number does not put it in fails, saying the mend", outside.join("\n"));
const twoTwice = inStep(archive({ "items-001.md": `${r1}\n1. **1 Nov**, #6: f.\n\n2. **2 Nov**, #7: g.\n` }));
ok(twoTwice.some(w => /item 1 stands twice.* a key by the issue .*"core archive 1"/.test(w)) && twoTwice.some(w => /item 2 stands twice.* a key by the issue .*"core archive 2"/.test(w)), "two numbers each used twice are each given a key of their issue", twoTwice.join("\n"));
const below = inStep(archive({ "items-005.md": "5. **5 Nov**, #5: e.\n\n1. **1 Nov**, #1: a.\n" }));
ok(below.some(w => /item 1 stands outside no file of archive\/instructions\/, since none starts at or below 1, .* Mend: /.test(w)) && !below.some(w => w.includes("undefined")), "an item below every file's first number says so, and never \"undefined\"", below.join("\n"));
const wordsAstray = inStep(archive({ "items-001.md": `${r1}\n3. **3 Nov**, #3: c.\n` }, { "items-001.md": "1. **1 Nov**: a.\n\n3. **3 Nov**: c.\n", "items-003.md": "# Words\n" }));
ok(wordsAstray.some(w => /words\/items-001\.md:3: item 3 stands outside words\/items-003\.md, the file its key puts it in\. Mend: move it there$/.test(w)), "in the words, an item outside its file is moved there, and given no other number", wordsAstray.join("\n"));
const wordsTwice = inStep(archive({ "items-001.md": "1. **1 Nov**. Decided: a.\n" }, { "items-001.md": "1. **1 Nov**: words.\n\n1. **1 Nov**: more.\n" }));
ok(wordsTwice.some(w => /words: item 1 stands twice, .* Mend: give the one at words\/items-001\.md:3 the number its reasoning has in archive\/instructions\//.test(w)), "in the words, an item numbered twice takes the number its reasoning has, never a new one", wordsTwice.join("\n"));
// (#756, point 3: an item that changes an earlier one says so, and the earlier one is marked back)
const marked = (one, two, three = "") => archive({ "items-001.md": `1. **1 Nov**, #1: a.${one}\n\n2. **2 Nov**, #2: b.${two}\n\n3. **3 Nov**, #3: c.${three}\n` });
ok(!inStep(marked("\n   Changed by: 2, 3.", "\n   Changes: 1.", "\n   Changes: 1.")).length, "items that change an earlier one, each marked back on it, are in step", inStep(marked("\n   Changed by: 2, 3.", "\n   Changes: 1.", "\n   Changes: 1.")).join("\n"));
const notBack = inStep(marked("\n   Changed by: 3.", "\n   Changes: 1.", "\n   Changes: 1."));
ok(notBack.length === 1 && /item 2 changes item 1, which is not marked so\. Mend: give item 1, in archive\/instructions\/items-001\.md, the line "Changed by: 3, 2\."/u.test(notBack[0]), "an item that names one it changes, not marked back, fails, its mend the whole line to write", notBack.join("\n"));
const noMatch = inStep(marked("\n   Changed by: 2.", ""));
ok(noMatch.length === 1 && /item 1 says item 2 changed it, but item 2 names no change of it\. Mend: give item 2, .* the line "Changes: 1\."/u.test(noMatch[0]), "a \"Changed by:\" with no \"Changes:\" to match fails, saying the mend", noMatch.join("\n"));
const strays = inStep(marked("\n   Changes: 1.", "\n   Changes: 9, #4.", "\n   Changed by: 7."));
ok(["item 1 says it changes 1, which is itself", "item 2 says it changes 9, which is no item", "item 2 says it changes #4, which is no item", "item 3 says 7 changed it, which is no item"].every(w => strays.some(x => x.includes(w))) && strays.every(w => /Mend: /u.test(w)), "a mark naming its own item or no item of the archive fails, saying the mend", strays.join("\n"));
const forms = inStep(marked("\n   Changed by: 2", "\n   Changes: 1.\n   Changes: 1.", "\n   Changes: one."));
const hidden = inStep(marked("\n   Changed by: 2.\rhidden", "\n   Changes: 1.\rX"));
ok(hidden.filter(w => w.includes("a mark not in its form or given twice")).length === 2 && !hidden.some(w => /[\r\n]/u.test(w)) && hidden.some(w => w.includes("\\rhidden")), "a mark that holds a lone carriage return is read whole, fails its form, and is quoted with it escaped, so no log line starts inside it", hidden.join("\n"));
ok(forms.filter(w => w.includes("a mark not in its form or given twice")).length === 3 && forms.every(w => /Mend: /u.test(w)), "a mark with no stop, one given twice and one with no key each fail, saying the form", forms.join("\n"));
ok(!inStep(marked("", "", "")).length && !inStep(archive({ "items-001.md": "1. **1 Nov**, #1: Changes: 2. on its opening line, which is prose.\n" })).length, "an item with no mark, and prose on an opening line, are no marks");
const markKeyed = archive({ "items-001.md": "1. **1 Nov**, #1: a.\n   Changed by: #9.1.\n", "issue-9.1.md": "# Issue 9.1\n\n#9.1. **19 Nov**, #9: b.\n     Changes: 1.\n" });
ok(!inStep(markKeyed).length, "a mark keyed by an issue's point is read as the archive keys it", inStep(markKeyed).join("\n"));
const behindBad = holders(project({}, { behind: { "tasks/x.md: Gone": [1], "tasks/x.md: Numbered": [7], "tasks/x.md: Its own item": "1", "tasks/x.md": [1] }, "tasks/y.md": "# Y\n\n- **A rule** (core archive 1).\n" }), []);
ok(["names \"tasks/x.md: Gone\"", "core archive 7 is no item", "\"behind\", \"tasks/x.md: Its own item\" must be array. Mend: write it as a list of the keys", "tasks/y.md:3 points to the archive"].every(w => behindBad.wrong.some(x => x.includes(w))) && !behindBad.wrong.some(x => x.includes("names \"tasks/x.md\"")) && behindBad.wrong.every(w => /Mend: /.test(w)),
  "behind: a key that is no rule, an item not in the archive, no list, and a pointer in a rule file each fail, saying the mend; a rule file alone is a key", behindBad.wrong.join("\n"));

// (#744: an item after the last numbered one is keyed by its issue, or one point of it, in a file of its own named by its
// key (#750, point 1); a key used twice, one in another's file, one in the words and a number past the last each fail;
// "behind" names keys)
const keyed = archive({ "items-001.md": r1, "issue-9.md": "# Issue 9\n\n#9. **19 Nov**: h.\n", "issue-9.2.md": "#9.2. **19 Nov**: i.\n", "issue-12.1.md": "#12.1. **19 Nov**: j.\n" });
ok(!inStep(keyed).length, "items keyed by their issue, or a point of it, each in a file of its own named by its key, are in step", inStep(keyed).join("\n"));
const lastNumbered = inStepAt(archive({ "items-001.md": `${r1}\n262. **19 Nov**, #8: the last numbered.\n` }));
ok(!lastNumbered.some(w => w.includes("keyed by a running number")) && lastNumbered.some(w => w.includes("item 3 is missing, though items 1 to 262 keep their numbers") && /Mend: /.test(w)), "the last numbered item, 262, keeps its number, and one of 1 to 262 taken out fails, saying the mend", lastNumbered.slice(0, 3).join("\n"));
const lastTaken = inStepAt(archive({ "items-001.md": `${r1}\n261. **19 Nov**, #8: the one before.\n` }));
ok(lastTaken.some(w => w.includes("item 262 is missing") && /Mend: /.test(w)), "the last numbered item taken out fails too, as the top of the range is read to 262 whatever stands", lastTaken.filter(w => w.includes("262")).join("\n"));
const keyedBad = inStepAt(archive({ "items-001.md": `${r1}\n#9. **19 Nov**: h.\n`, "items-263.md": "263. **19 Nov**, #8: k.\n", "issue-12.1.md": "#12.1. **19 Nov**: j.\n\n#12.1. **19 Nov**: l.\n", "issue-13.md": "#13. **19 Nov**: m.\n\n#13.2. **19 Nov**: n.\n" }, { "issue-12.1.md": "#12.1. **19 Nov**: words.\n" }));
ok([/items-001\.md:5: item #9 stands outside archive\/instructions\/issue-9\.md, the file its key puts it in\. Mend: move it there$/, /item #12\.1 stands twice, .* Mend: give the one at archive\/instructions\/issue-12\.1\.md:3 a key of its own, "#12\.P"/,
  /issue-13\.md:3: item #13\.2 stands outside archive\/instructions\/issue-13\.2\.md, the file its key puts it in\. Mend: move it there$/,
  /item 263 is keyed by a running number, a key that names no issue, .* Mend: key it "#N"/, /words\/issue-12\.1\.md: item #12\.1 adds the owner's words here/].every(re => keyedBad.some(w => re.test(w))) && keyedBad.every(w => /Mend: /.test(w)),
  "a keyed item in another file, two items in one file, a key used twice, a number past the last and a keyed item in the words each fail, saying the mend", keyedBad.join("\n"));
const keysAt = archive({ "items-001.md": r1, "issue-9.md": "#9. **19 Nov**: h.\n", "issue-9.2.md": "#9.2. **19 Nov**: i.\n" });
writeList(keysAt, { behind: { "tasks/x.md: Numbered": [1, "#9", "#9.2"], "tasks/x.md: Its own item": ["9", "#x", 7.5], "tasks/x.md: A last item": ["#10"] } });
fs.writeFileSync(path.join(keysAt, "tasks", "y.md"), "# Y\n\n- **A rule** (core archive #9).\n");
const behindKeys = holders(keysAt, []);
ok([...[0, 1, 2].map(i => `"tasks/x.md: Its own item", item ${i} `), "core archive #10 is no item", "tasks/y.md:3 points to the archive"].every(w => behindKeys.wrong.some(x => x.includes(w))) && behindKeys.wrong.filter(x => x.includes("Its own item")).every(x => x.includes("Mend: write an item's key as the archive keys it")) && !behindKeys.wrong.some(x => x.includes("\"tasks/x.md: Numbered\"")) && behindKeys.wrong.every(w => /Mend: /.test(w)),
  "behind: a number and keys by an issue that stand pass; a key that names no issue, one not in the archive and a keyed pointer in a rule file each fail, saying the mend", behindKeys.wrong.join("\n"));

// ---- each rule's entry stands in a file of its own, named from the rule (#750, point 1; #853) ----
{
  const dir = project({ "tasks/x.md: Numbered": "describes" }), at = f => path.join(dir, "scripts", "holders", f);
  fs.writeFileSync(at("a-misnamed.json"), JSON.stringify({ rule: "tasks/x.md: Its own item", holder: "audit" }));
  fs.writeFileSync(at("not-an-object.json"), "[]");
  fs.writeFileSync(at(entryFile("tasks/x.md: A last item")), JSON.stringify({ rule: "tasks/x.md: A last item", holders: "audit" }));
  fs.writeFileSync(at("notes.txt"), "no");
  const faults = named(dir).faults;
  ok(faults.length === 4 && faults.every(f => /Mend: /.test(f)) && faults.some(f => f.includes(`rename the file to ${entryFile("tasks/x.md: Its own item")}`)) && faults.some(f => /no object with a "rule"/.test(f)) && faults.some(f => /has "holders", which an entry does not read/.test(f)) && faults.some(f => f.includes("notes.txt")),
    "an entry in a file not named from its rule, one that is no object with a rule, one with a part it does not read and a file that is no entry each fail, saying the mend", faults.join("\n"));
  ok(holders(dir, []).wrong.length === 4, "and they fail the check once each", holders(dir, []).wrong.join("\n"));
  const twin = holders(project({}, { "tasks/z.md": "# Z\n\nRead when needed.\n\n**A rule.** a.\n\n**A rule!** b.\n" }), []).wrong;
  ok(twin.some(w => /would be the entry of "tasks\/z\.md: A rule" and "tasks\/z\.md: A rule!"\. Mend: reword the lead/.test(w)), "two rules whose entries would share a file fail, saying the mend", twin.join("\n"));
  const twinOwn = holders(project({}, { "AGENTS.md": "# A core\n\n**An own rule.** a.\n\n**An own rule!** b.\n" }), []).wrong;
  ok(twinOwn.some(w => /would be the entry of "AGENTS\.md: An own rule" and "AGENTS\.md: An own rule!"\. Mend: /.test(w)), "and so do two rules of the core's own AGENTS.md", twinOwn.join("\n"));
  const all = rules(root, { agents: true }), seen = new Map();
  for (const r of all) seen.set(entryFile(r.key), [...(seen.get(entryFile(r.key)) ?? []), r.key]);
  ok([...seen.values()].every(k => k.length === 1), "no two rules of the core share the file name their entry would stand in", [...seen.values()].filter(k => k.length > 1).join("\n"));
}

// ---- the list's form, its schema's (#530) ----
const formOf = j => shapeFaults("holders", j, "", "scripts/holders");
const shapes = [null, [], { holders: [] }, { behind: "a" }, { numbers: 3 }, { holders: { a: 5 } }, { holders: { a: "" } }, { holders: { a: ["audit", ""] } }, { holders: { a: [4] } },
  { behind: { a: [] } }, { behind: { a: [0] } }, { behind: { a: [LAST_NUMBERED + 1] } }, { behind: { a: ["#"] } }, { behind: { a: ["#9.x"] } }, { behind: { a: [null] } }, { numbers: { a: "" } }, { numbers: { a: 3 } }];
const refused = shapes.map(j => formOf(j));
ok(refused.every(f => f.length === 1 && /^scripts\/holders.* Mend: \S/u.test(f[0])), "each part in no form the file holds is refused once, said of the file and where in it, with its mend",
  refused.map((f, i) => `${JSON.stringify(shapes[i])}: ${JSON.stringify(f)}`).join("\n"));
ok(JSON.stringify(formOf(named(root).json)) === "[]" && JSON.stringify(formOf({ holders: { a: [] }, behind: { a: [1, LAST_NUMBERED, "#9", "#9.2"] }, numbers: { a: "x" }, other: 1 })) === "[]",
  "the core's own file holds its form, as do a number up to the last numbered item and keys by an issue or one point of it; a key the file does not name is let be, as the script let it");
const keyRule = JSON.parse(fs.readFileSync(path.join(root, "scripts", "schemas", "holders.json"), "utf8")).properties.behind.additionalProperties.items;
ok(keyRule.pattern === KEY.source && keyRule.maximum === LAST_NUMBERED && keyRule.mend.includes(`up to ${LAST_NUMBERED} `), "the schema's form of a key is the archive's own (archive.mjs's KEY and LAST_NUMBERED), its mend naming the last numbered item", JSON.stringify(keyRule));

// ---- the core's own, and the script as a check ----
const own = spawnSync(process.execPath, [path.join(root, "scripts", "holders.mjs")], { encoding: "utf8" });
const numbersBad = holders(project({ "tasks/x.md: Its own item": "check: scripts/a-check.mjs" }, { numbers: { "tasks/x.md: Gone": "findings; outcome: robust", "tasks/x.md: Numbered": "findings", "tasks/x.md: Its own item": "check fires; outcome: fast" } }), []);
ok(numbersBad.wrong.length === 2 && numbersBad.wrong.some(w => w.includes("(\"number\") names \"tasks/x.md: Gone\"")) && numbersBad.wrong.some(w => w.includes("tasks-x-md--numbered.json (\"number\"): \"findings\" is in no form")) && numbersBad.wrong.every(w => /Mend: /.test(w)),
  "numbers: a key that is no rule, and a number with no outcome, each fail, saying the mend; one in its form passes", numbersBad.wrong.join("\n"));
// (#1138, part 1: "check fires" where no holder is a check, a number the pruning can never move)
const fires = "check fires; outcome: robust";
const still = holders(project({ "tasks/x.md: 1. A rule of a paragraph": "audit", "tasks/x.md: A rule inside it": "describes", "tasks/x.md: Numbered": "check: scripts/a-check.mjs, in part", "tasks/x.md: Its own item": ["audit", "check: GitHub's ruleset"] },
  { numbers: { "tasks/x.md: 1. A rule of a paragraph": fires, "tasks/x.md: A rule inside it": `${fires}; rare harm`, "tasks/x.md: 2. The next one": fires, "tasks/x.md: The second numbered": fires, "tasks/x.md: Numbered": fires, "tasks/x.md: Its own item": fires, "tasks/x.md: A last item": "findings; outcome: robust" } }), [aCase]);
const stillOf = key => still.wrong.filter(w => w.includes(`gives "${key}" the number "check fires", but none of its holders is a check`) && /Mend: give the rule a number a holder of its own can move \("findings", or "correction: <kind>"\)/.test(w));
ok(["1. A rule of a paragraph", "A rule inside it", "2. The next one", "The second numbered"].every(k => stillOf(`tasks/x.md: ${k}`).length === 1) && still.wrong.length === 4 && mended(still.wrong.map(w => `FAIL ${w}`).join("\n")),
  "\"check fires\" fails where the rule is held by the audit, by what describes, by a staged case or by nothing, saying the mend; held by a check, whole or in part, or with another number, it passes", still.wrong.join("\n"));
ok(own.status === 0 && !own.stderr, "the core's own entries in scripts/holders/ name only rules that stand, and checks that are there", own.stderr);
const failing = project({ "tasks/x.md: Gone": "audit" });
fs.mkdirSync(path.join(failing, "scripts", "staged"));
fs.mkdirSync(path.join(failing, "scripts", "schemas"));
for (const f of ["archive.mjs", "core-address.mjs", "core-path.mjs", "guards.mjs", "holder-form.mjs", "holders.mjs", "holders-own.mjs", "packages.mjs", "reading.mjs", "rule-files.mjs", "rules.mjs", "schemas.mjs", "schemas/holders.json", "started.mjs", "mend.mjs"]) fs.copyFileSync(path.join(root, "scripts", f), path.join(failing, "scripts", f));
fs.writeFileSync(path.join(failing, "scripts", "staged.mjs"), "export const CASES = [];\n");
fs.writeFileSync(path.join(failing, "scripts", "outcomes.mjs"), "export const NUMBER = /^$/u;\n");
const run = spawnSync(process.execPath, [path.join(failing, "scripts", "holders.mjs")], { encoding: "utf8" });
ok(run.status === 1 && mended(`${run.stdout}${run.stderr}`) && /^::warning::The form of scripts\/holders\/ was not checked: the package ajv is not installed in \S+ as \S+ names it\. Mend: run `if \[ -f \S*scripts\/install\.mjs \]; then node \S*scripts\/install\.mjs; fi`/mu.test(run.stdout),
  "where an entry is wrong the check fails, each failure saying its mend; on a copy with no packages its form goes unchecked, said as a warning with its mend, and the rest is read as ever", `${run.stdout}${run.stderr}`);

// ---- the share a check holds in a project (#459, point 3) ----
{
  const all = heldThere(root, []), shape = heldThere(root, ["scripts/shape.mjs"]), floorOnly = heldThere(root, [], new Set(holders(root).rules.map(r => path.posix.basename(r.file)).filter(f => f !== "security.md")));
  ok(all.held > shape.held && shape.all === all.all && floorOnly.all < all.all && floorOnly.all === holders(root).rules.filter(r => r.file.startsWith("floor/")).length,
    "the core's rules a check holds in a project leave out those whose every check read nothing there, and count only the modules it takes, the floor's always", JSON.stringify({ all, shape, floorOnly }));
  ok(shareLine({ all: 7, check: 2 }, { held: 9, all: 40 }) === "- rules held by a check: the project's own 2 of 7, the core's 9 of 40.", "the share's line holds the counts alone");
  const coreLine = report(root).find(l => l.startsWith("- rules held by a check: the floor's")) ?? "";
  const h = holders(root), ownCount = rules(root, { agents: true }).filter(r => r.file === "AGENTS.md").length, cc = counts(h), oc = counts(h.own);
  ok(ownCount > 0 && oc.all === ownCount && oc.check > 0 && cc.all === h.rules.length && !h.rules.some(r => r.file === "AGENTS.md")
    && coreLine === `- rules held by a check: the floor's and the modules' ${cc.check} of ${cc.all}; the core's own ${oc.check} of ${ownCount}, those of \`AGENTS.md\`.`,
    "the core's own report gives its share of the floor's and the modules' rules and, counted apart, of its own AGENTS.md's (#925)", coreLine);
  // (a scratch core whose AGENTS.md holds two rules: the count of its own held by a check rises once an entry names one,
  // the floor's and the modules' unchanged; one held in part, or by a check that is not there, does not raise it)
  const own = (h2, extra = {}) => holders(project(h2, { "AGENTS.md": "# A core\n\n- **An own rule.** a.\n- **Another.** b.\n", ...extra }), []);
  const before = own({}), after = own({ "AGENTS.md: An own rule": "check: tests/a-test.mjs" }, { "tests/a-test.mjs": "" });
  const partly = own({ "AGENTS.md: An own rule": "check: scripts/a-check.mjs, in part" }), gone = own({ "AGENTS.md: An own rule": "check: tests/gone-test.mjs" });
  ok(!before.wrong.length && !after.wrong.length && counts(before.own).check === 0 && counts(after.own).check === 1 && counts(after.own).all === 2
    && counts(after).check === counts(before).check && counts(after).all === counts(before).all && counts(partly.own).check === 0 && counts(partly.own).part === 1
    && counts(gone.own).check === 0 && gone.wrong.some(w => /"AGENTS\.md: An own rule" is held by "tests\/gone-test\.mjs", which is not there\. Mend: /u.test(w)),
    "an entry of AGENTS.md that names a check raises the core's own count, apart from the floor's and the modules'; one in part counts in part, and a check not there fails with its mend",
    JSON.stringify({ before: counts(before.own), after: counts(after.own), gone: gone.wrong }));
}

// (the share read in a project as the monthly report reads it (state-report.mjs, heldHere): one with no shape config and no mutation tool, whose
// core's count leaves out the rules those two checks hold, and its own rule counted)
{
  const proj = fs.mkdtempSync(path.join(tmp, "held-here-")), was = process.cwd();
  const manifest = "Core: x at " + "a".repeat(40) + ".\n\n| *mutation tool* | `none` |\n";
  fs.writeFileSync(path.join(proj, "core-manifest.md"), manifest);
  fs.writeFileSync(path.join(proj, "AGENTS.md"), "# A project\n\n- **Keep it short.** Words.\n");
  spawnSync("git", ["init", "-q"], { cwd: proj });
  spawnSync("git", ["add", "-A"], { cwd: proj });
  let got;
  try { process.chdir(proj); got = heldHere(manifest); } finally { process.chdir(was); }
  const all = heldThere(root, [], leftOut(manifest)), less = heldThere(root, ["scripts/shape.mjs", "scripts/strength.mjs"], leftOut(manifest));
  ok(got && got.own.all === 1 && got.there.all === all.all && got.there.held === less.held && less.held < all.held,
    "a project's share is read there: its own rules, and the core's less those whose every check read nothing there", JSON.stringify({ got, all, less }));
}

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
// (#484, point 9: the report asks of every rule, held or not, whom it is about, until the list's "about" answers it)
const askedOf = lines.find(l => l.startsWith("- Whom a rule is about, 0 of 6 answered")) ?? "";
ok(askedOf.includes("whether it is about this project, its kind or every project") && askedOf.includes("Each computer player keeps its style") && !lines.some(l => l.startsWith("- About a kind")),
  "a project's report asks of every own rule, one a check holds among them, whether it is about the project, its kind or every project, until the list answers it", lines.join("\n"));
ok(/^- Of 6 rules of the project's own .*: 1 held whole by a check, .* 5 have no holder/.test(lines[0]) && listed.indexOf("docs/play.md: A turn ends on a move") < listed.indexOf("docs/design.md: Saves are small") && !listed.includes("Each computer player") && lines.filter(l => /Mend: /.test(l)).length === 3,
  "the report's lines: the counts, the rules with no holder, those read at a session's start first, and each wrong line of the list", lines.join("\n"));
// (holders that are no text, or empty, as no schema reads a project's list: named wrong once for their key, and the
// report still made)
fs.writeFileSync(path.join(proj, OWN), JSON.stringify({ holders: { ...written, "AGENTS.md: Name things plainly": [3, "", { by: "x" }], "docs/design.md: Saves are small": null } }));
const untyped = ownHolders(proj);
ok(untyped.wrong.length === 2 && untyped.wrong.every(w => w.includes("no text or an empty one") && /Mend: /.test(w)) && ownReport(proj)[0].startsWith("- Of 6 rules"),
  "a holder in the project's list that is no text, or an empty one, is named wrong once for its key, saying the mend, and the report is still made", untyped.wrong.join("\n"));
// (a key and a value of the list, and a rule's lead, holding a line break, a workflow command and a mention: each goes
// into the report on one line, in a code span)
fs.writeFileSync(path.join(proj, OWN), JSON.stringify({ holders: { "x\n::error::key @ghost": "audit", "AGENTS.md: Name things plainly": "weird\n::warning::v" } }));
put("docs/play.md", "# Play\n\n- **A turn ends on a move.** Rules of play.\n- **Ask `@octocat` first.** Words.\n");
const hostile = ownReport(proj);
ok(hostile.every(l => !l.includes("\n")) && !hostile.some(l => /(?:^|[^`'])@(?:ghost|octocat)/u.test(l.replace(/`[^`]*`/gu, ""))) && hostile.some(l => l.includes("`x?::error::key @ghost`")),
  "text from the project's files goes into the report on one line, in code spans, so no workflow command or mention acts (floor rule 5)", hostile.join("\n"));
fs.writeFileSync(path.join(proj, OWN), '{"holders": @ghost }');
const unreadable = ownReport(proj).join("\n");
ok(/cannot be read \(`unexpected character at line 1, column 13`\)/u.test(unreadable) && !/@ghost/u.test(unreadable), "a list that cannot be read is named by the fault's kind and place alone, in a code span, so nothing of the list, a mention among it, reaches the report", unreadable);
put("docs/play.md", "# Play\n\n- **A turn ends on a move.** Rules of play.\n");
fs.writeFileSync(path.join(proj, OWN), JSON.stringify({ holders: { ...written, "AGENTS.md: Each computer player keeps its style": "check: tests/style.test.js", "docs/design.md: Saves are small": "check: tests/saves.test.js", "AGENTS.md: Gone": "audit", "docs/play.md: A turn ends on a move": "check: the code review" } }));
// (the answers, in the list's "about": those about a kind or every project named to be filed, naming the kind; a key
// that is no rule and an answer in no form wrong, each with its mend; a rule answered is no longer asked)
{
  const listNow = JSON.parse(fs.readFileSync(path.join(proj, OWN), "utf8"));
  fs.writeFileSync(path.join(proj, OWN), JSON.stringify({ ...listNow, about: { "AGENTS.md: Each computer player keeps its style": "its kind: a game with computer players", "AGENTS.md: Name things plainly": "every project", "docs/play.md: A turn ends on a move": "this project", "docs/design.md: Saves are small": "the game", "AGENTS.md: Gone": "this project" } }));
  const answered = ownHolders(proj), said = ownReport(proj), wider = said.find(l => l.startsWith("- About a kind")) ?? "", asked = said.find(l => l.startsWith("- Whom a rule is about")) ?? "";
  ok(answered.about.size === 3 && answered.wrong.filter(w => w.includes('"about"') || w.includes("is said to be about")).length === 2 && answered.wrong.every(w => /Mend: /.test(w))
    && wider.includes("`AGENTS.md: Each computer player keeps its style`, `its kind: a game with computer players`") && wider.includes("`AGENTS.md: Name things plainly`, `every project`") && !wider.includes("A turn ends")
    && asked.startsWith("- Whom a rule is about, 3 of 6 answered") && !asked.includes("Each computer player") && asked.includes("Saves are small"),
    "the list's answers name the rules about a kind or every project to be filed, naming the kind; a key that is no rule and an answer in no form are wrong, each with its mend", `${said.join("\n")}\n${answered.wrong.join("\n")}`);
  fs.writeFileSync(path.join(proj, OWN), JSON.stringify({ ...listNow, about: ["x"] }));
  ok(ownHolders(proj).wrong.some(w => w.includes('its "about" is no object') && /Mend: /.test(w)), "an \"about\" that is no object is wrong, with its mend");
  r2 = ownCli("--write");
  ok(JSON.stringify(JSON.parse(fs.readFileSync(path.join(proj, OWN), "utf8")).about) === '["x"]', "--write keeps the list's \"about\" as it stands");
  fs.writeFileSync(path.join(proj, OWN), JSON.stringify(listNow));
}
r2 = ownCli();
ok(r2.status === 0 && /No holder/.test(r2.stdout), "--own fails nothing, a wrong list included", `${r2.stdout}${r2.stderr}`);
r2 = ownCli("--write");
const kept = JSON.parse(fs.readFileSync(path.join(proj, OWN), "utf8")).holders;
ok(r2.status === 0 && kept["AGENTS.md: Each computer player keeps its style"] === "check: tests/style.test.js" && kept["AGENTS.md: Name things plainly"] === "none", "--write again keeps what the list names", JSON.stringify(kept));

console.log(failed ? `${failed} of ${count} failed` : `all ${count} passed`);
process.exit(failed ? 1 : 0);
