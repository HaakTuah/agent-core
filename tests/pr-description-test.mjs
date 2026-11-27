// Checks the description check (scripts/pr-description.mjs): a part is there only as a heading that starts
// with its words, and what a description names that its head does not hold (#1136). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/pr-description-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { asked, copyAtBase, doneAsked, DONE_SINCE, HEAD_SINCE, headAsked, missing, PARTS } from "../scripts/pr-description.mjs";
import { costMend, NO_COST } from "../scripts/pr-cost.mjs";
import { HEAD_MEND, PLACE_MEND, SHOWN, headMends, headOf, keysAt, linksNote } from "../scripts/pr-head.mjs";
import { entriesChanged, entriesMend, numberMend } from "../scripts/pr-number.mjs";
import { reasonsMend } from "../scripts/pr-reasons.mjs";
import { heldAt, waitsMend, waitsOn } from "../scripts/pr-waits.mjs";
import * as facade from "../scripts/pr-description.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const whole = "The change.\n\n## What the owner can try\n\nOpen it.\n\n## Readings taken\n\nNone.\n";

// the names pr-description.mjs exported before its split (#888)
ok(["CHANGED_SINCE", "COST_SINCE", "DONE_SINCE", "HEAD_SINCE", "HOLDS", "MANIFEST_MAX", "NO_COST", "NUMBER_SINCE", "PARTS", "PLAN_SINCE", "READS_SINCE", "REASONS", "REASONS_SINCE", "UNREADABLE", "WAITS", "WAITS_SINCE", "YES_SINCE", "asked", "calledFor", "copyAtBase", "costMend", "differencesAdded", "doneAsked", "headMends", "heldAt", "missing", "numberMend", "planAsked", "reasonsMend", "waitsMend", "waitsOn"].every(n => n in facade), "pr-description.mjs still exports each name it exported before its split");
ok(missing(whole).length === 0, "a description with both headings passes");
ok(missing("### What the owner can try\nx\n###### readings TAKEN (the unsure first)\nx\n").length === 0, "any level of heading, any case, and words after the part's own");
ok(missing("## What the owner can try: nothing yet\r\n## Readings taken, the unsure first\r\n").length === 0, "a mark after the part's words, and lines that end both ways");
ok(missing("The change.").join() === PARTS.join() && missing("").length === 2 && missing(undefined).length === 2 && missing(null).length === 2, "a description with neither, an empty one and none at all each miss both");
ok(missing("## What the owner can try\nx\n").join() === "Readings taken", "one missing part is named");
ok(missing("**What the owner can try:** x\n**Readings taken:** none\nWhat the owner can try\nReadings taken\n").length === 2, "bold words, or the words on a plain line, are no heading");
ok(missing("## What the owner can trying\n## Readings takenly\n## Not what the owner can try\n##Readings taken\n").length === 2, "a longer word, the words not at the start, and a # with no space after it do not count");
ok(missing("    ## What the owner can try\n\t## Readings taken\n").length === 2, "a line indented as code is no heading");
ok(missing("## Risks\n## Rollback\n", ["Risks", "Rollback", "Test plan"]).join() === "Test plan", "a project's own parts are asked for in place of the two");
ok(missing("## **What the owner can try**\n## _Readings\u00a0 taken_ \n").length === 0 && missing("## 1. What the owner can try\n## \u2705 Readings taken\n").join() === "What the owner can try", "bold or a sign before the words, and blanks of any kind between them, are read through; a number before them is not");
ok(missing("## \u0130stanbul notes\n## STRASSE: none\n", ["\u0130stanbul", "Strasse"]).length === 0 && missing("## \u0130stanbuls\n", ["\u0130stanbul"]).length === 1, "a part whose small letters are longer than its capitals is still matched whole");
ok(missing("```\n## What the owner can try\n```\n<!--\n## Readings taken\n-->\n").length === 0, "it reads no Markdown: a heading line in a code block or a comment counts (stated in the script's header)");
ok(asked().join() === PARTS.join() && asked("").join() === PARTS.join() && asked(" | ").join() === PARTS.join() && asked("+").join() === PARTS.join(), "no argument, an empty one and one of separators alone each ask for the two");
ok(asked("Risks| Rollback ").join() === "Risks,Rollback", "a project's own parts stand in place of the two");
ok(asked("+What holds it").join() === [...PARTS, "What holds it"].join() && asked(" +A|B").join() === [...PARTS, "A", "B"].join() && asked("+Readings taken").join() === PARTS.join(), "parts led by a + are added to the two, none of them twice");
ok(missing(whole, asked("+What holds it")).join() === "What holds it" && missing(`${whole}## What holds it\n\nNone.\n`, asked("+What holds it")).length === 0, "an added part is asked for, and found");
// the line that says what a pull request waits on
ok(["nothing", "a review", "checks", "#241"].every(w => waitsOn(`x\n\nWaits on: ${w}\n`)?.kind) && waitsOn("Waits on: the owner: may the old saves go?").kind === "the owner",
  "each form of the line is read: nothing, a review, checks, an item, and the owner with the question");
ok(waitsOn("x") === null && waitsOn("Waits on: soon").kind === null && waitsOn("Waits on: the owner").kind === null && waitsOn("Waits on: the owner: why").kind === null,
  "no line is none; one in no form, or the owner without a question in one sentence ending in a question mark, is no form");
ok(waitsOn("Waits on: the owner: a?\r\nWaits on: nothing").kind === "nothing" && waitsOn("  Waits on:   a review  ").said === "a review", "the last such line counts, trimmed");
// (#750, point 4: the check fails what is missing, never phrasing)
ok(waitsOn("Waits on: #724, then the orchestrator's word").kind === "item" && waitsOn("Waits on: Nothing").kind === "nothing" && waitsOn("Waits on: a review by Codex").kind === "a review"
  && waitsOn("Waits on: checks.").kind === "checks" && waitsOn("Waits on: The owner: may it go? Then #3.").kind === "the owner",
  "a line that begins with a form, in any case, is in it whatever follows");
ok(["nothingness", "a reviewer", "checksum", "#12a", "the owner: why", "soon, nothing"].every(w => waitsOn(`Waits on: ${w}`).kind === null),
  "  but a word that only starts like a form, the owner with no question, or a form that does not begin the line, is in none");
ok(costMend("x\nSession so far: 1,204 answers (opus); tokens in 3, cache written 4, cache read 5, out 6.\n") === null && costMend(`x\r\n  ${NO_COST}\r\n`) === null,
  "the cost line, or the mark that the script printed none, on a line of its own, is enough");
ok([costMend("x"), costMend(`see ${NO_COST}`), costMend("No cost line."), costMend(null)].every(m => /Mend: run `node core\/scripts\/session-cost\.mjs`/.test(m ?? "") && m.includes(NO_COST)),
  "a description with neither, or the mark inside a line, is to mend, the mend naming the script and the mark");
ok(numberMend("## What holds it\n\nNone\n") === null && numberMend("x") === null
  && numberMend("## What holds it\n- \"A rule\": held by its check.\n  Number: correction: misread; outcome: asked.\n## Readings taken\nNumber: x") === null,
  "the number is asked only where \"What holds it\" stands and holds more than None, and one line in its form is enough");
ok(numberMend("## What holds it\n- Number: check fires; outcome: robust; rare harm.") === null && numberMend("## What holds it\n- Number: check fires; outcome: robust; rare") === null
  && numberMend("## What holds it\n- Number: Check fires; outcome: fast (the statuses wait less)") === null,
  "a number may say that its rule guards against rare and severe harm, and a line that begins in the form passes whatever follows, in any case (#750, point 4)");
ok([numberMend("## What holds it\n- \"A rule\": held by its check.\n## Readings taken\nNumber: findings; outcome: robust"), numberMend("### What holds it\n- Number: findings; outcome: cost")].every(m => /Mend: under it, .*"Number: <findings \| check fires \| correction: <kind>>; outcome: <asked/.test(m ?? ""))
  && /it reads "findings; outcome: cost"/.test(numberMend("### What holds it\n- Number: findings; outcome: cost")),
  "a rule with no number under the heading, one under another heading, or one in no form, is to mend, the mend giving the form");
ok(waitsMend("Waits on: nothing") === null && /has no line "Waits on:"/.test(waitsMend("x")) && /"Waits on: soon" is in none of the forms/.test(waitsMend("Waits on: soon")) && /needs-owner/.test(waitsMend("")),
  "the mend names what is missing or wrong, and the forms, with the label for the owner");
const cs = [{ sha: "c", date: "2026-11-20T00:00:00Z" }, { sha: "b", date: "2026-11-18T00:00:00Z" }, { sha: "a", date: "2026-11-17T00:00:00Z" }];
const read = [];
ok(heldAt(cs, "2026-11-19T00:00:00Z", s => (read.push(s), s !== "a")) === true && read.join() === "b", "the line is asked where the copy's newest commit from before the pull request opened holds it, one file read");
ok(heldAt(cs, "2026-11-17T12:00:00Z", s => s !== "a") === false && heldAt(cs, "2026-11-01T00:00:00Z", () => true) === false && heldAt([], "2026-11-19T00:00:00Z", () => true) === false,
  "not where that commit's copy lacks it, where the copy changed only after the pull request opened, or where nothing changed it");
// how done will be judged (done-when.mjs): asked only of a pull request opened since the copy on its base held it
const holds = "export const DONE_SINCE = \"x\";";
ok(doneAsked("2026-11-18T00:00:00Z", holds) && doneAsked(DONE_SINCE, holds), "asked of a pull request opened on or after the day, its base's copy holding it");
ok(!doneAsked("2026-11-16T23:59:59Z", holds) && !doneAsked("2026-11-18T00:00:00Z", "an older copy") && !doneAsked("2026-11-18T00:00:00Z", null) && !doneAsked("", holds),
  "not of one opened before, one whose base's copy lacked it or could not be read, nor one with no day");
const slow = Date.now();
missing(`${"#".repeat(300000)} x\n${"## ".repeat(100000)}\n${" ".repeat(300000)}# Readings taken\n`.repeat(3));
numberMend(`## What holds it\n- Number: x${".".repeat(64000)}y${" ".repeat(64000)}\n`);
ok(Date.now() - slow < 2000, "a long description of signs and spaces is read in no time, its line \"Number:\" too");
// what the description names that its head does not hold (pr-head.mjs; #1136): an archive key, a placeholder
{
  const keys = new Set(["218", "262", "#733.2", "#1084"]);
  const fails = (body, own = true) => headMends(body, { keys, own }).mends;
  ok(fails("Behind it: core archive 218, Core archive #733.2 and archive item #1084; archive item 262.\n").length === 0, "a key the head's archive holds passes, by number or by issue, in any case");
  ok(fails("Adds archive item #1136, and core archive 263.\n\n`archive item 264`\n").map(m => /^line (\d+) .*"(.*)"/u.exec(m).slice(1).join(" ")).join() === "1 archive item #1136,1 core archive 263,3 archive item 264",
    "a key it does not hold fails, by line and as written, in code marks too");
  ok(fails("archive item 263", false).length === 0 && fails("core archive 263", false).length === 1, "in a project, whose own archive may key its items otherwise, only \"core archive N\" is read");
  ok(fails("> a finding: archive item 263 is taken\nIt read \"core archive 999\" and “core archive 998” as examples.\n<!-- core archive 997 -->\n<!--\nTBD\n-->\n").length === 0,
    "a quoted line, words in double quotes and an HTML comment, one over lines too, are not read");
  ok(headMends("core archive 263", { keys: null }).mends.length === 0 && /not read here: no archive could be read/u.test(headMends("core archive 263", { keys: null }).notes.join()), "where no archive can be read, no key is asked, and it says so");
  ok(keysAt(".")?.has("218") && keysAt(".")?.has("#1084") && keysAt(scratchDir("pr-head-none-")) === null, "the keys are read from the archive at the root given, both its forms; none where it holds none");
  ok(["TBD", "TODO: the test", "XXX", "FIXME", "(to be added here)", "- to be added", "1. To be added", "Tests: to  be added", "Tests: to be\tadded"].every(t => fails(`The change.\n${t}\n`).length === 1),
    "a placeholder fails: a word of the list in capitals, and \"to be added\" where it opens a bracket, a line or a list item, or follows a colon");
  ok(["todo", "TODOs", "a line to be added to the list", "`TODO`", "```\nFIXME\n```", "a \"TODO\"", "\"TBD\" first", "`TODO` first", "` to be added"].every(t => fails(`The change.\n${t}\n`).length === 0),
    "  but not the word in small letters or in a longer word, \"to be added\" in a sentence or after a lone backtick, nor one in code marks or double quotes");
  const all = fails("core archive 263\nTBD\n");
  ok(all.length === 2 && all.every(m => mended(`FAIL ${m}`)) && all[0].includes(HEAD_MEND) && all[1].includes(PLACE_MEND), "each failure says its mend");
  ok(fails("TBD\n").join() === `line 1 of the description holds the placeholder "TBD". ${PLACE_MEND}` && fails("x (to be added)").join() === `line 1 of the description holds the placeholder "to be added". ${PLACE_MEND}` && fails("x\n\ncore archive 263").join() === `line 3 of the description names "core archive 263", which the head's archive does not hold. ${HEAD_MEND}`,
    "a failure names its line and what it holds, in its words");
  ok(fails("core archive 0218, core archive 00218 and core archive 0").length === 1 && headMends("archive item 263", { keys }).mends.length === 1 && headMends("", { keys }).mends.length === 0 && headMends(undefined, { keys }).mends.length === 0,
    "a number is read without its leading zeros; the core's own form is read where nothing says otherwise; an empty description fails nothing");
  const lines = body => fails(body).map(m => Number(/^line (\d+)/u.exec(m)[1])).join();
  ok(lines("```\nTODO\n```\nTODO\n~~~\nXXX\n~~~\nXXX\n") === "4,8" && lines("````\nTBD\n```\nTBD\n````\nTBD\n") === "6" && lines("```\nTBD\n``` not yet\nTBD\n```\nTBD\n") === "6"
    && lines("~~~\nTBD\n```\nTBD\n~~~\nTBD\n") === "6" && lines("```\nTBD\n```  \nTBD\n") === "4" && lines("x\n```\ncore archive 999\n```\n") === "3" && lines("x\n``` core archive 999\nTBD\n```\n") === "2" && lines("```js\nTBD\n```\nTBD\n") === "4" && lines("    ```\nTBD\n") === "2" && lines("x ```\nTBD\n") === "2" && lines("``\nTBD\n") === "2" && lines("~~\nTBD\n") === "2",
    "a fenced block, of three marks or more, is not read up to the fence that closes it: of its kind, as long or longer, with nothing after but blanks; one indented four or not at a line's start opens none; an archive key in it is read all the same, as one in code marks is");
  ok(lines("a <!-- TBD --> b TODO\n<!--\nFIXME\n-->XXX\nTBD<!-- x -->TBD\n<!-- a --> <!--\nTODO\n-->\n<!-- one\n``` -->TODO\n<!-- XXX-->\n") === "1,4,5,5,10" && lines("  > TBD\na > TBD\n") === "2" && lines("a\"x\"TBD\na`x`TBD\n``TBD``\n`` a ` TBD ``\n") === "1,2",
    "an HTML comment, on a line or over lines, is read around, its place a blank; a line quoted after blanks is not read, one with a \">\" inside is; what quotes and code marks hold, of any length, is not read, and a blank stands for it");
  ok(["  to be added", "-  to be added", "12. to be added", "To be added.", "* to be added", "2) to be added", "[to be added]", "<to be added>"].every(t => fails(`The change.\n${t}\n`).length === 1) && fails("x- to be added\nIt is to be added").length === 0,
    "  \"to be added\" after blanks, a list mark of any width, or an opening bracket fails; inside a line it does not");
  ok(headOf("TBD", "").mends.length === 1 && headOf("archive item 99999", "").mends.length === 1 && headOf("archive item 99999", "./").mends.length === 0 && headOf("core archive 99999", "./").mends.length === 1 && headOf("core archive 99999", null).mends.length === 0
    && /no archive could be read/u.test(headOf("core archive 99999", null).oks.join()) && headOf("core archive 218", "").oks.at(-1).startsWith("the description names no archive key") && headOf("TBD", "").oks.length === 0
    && headOf("core archive 99999", scratchDir("pr-head-at-") + "/").mends.length === 0,
    "where the copy lies says which archive is read and whether the core's own form is: the core's own here, a project's copy there, none where none is found");
  if (process.platform !== "win32") {
    const linked = scratchDir("pr-head-links-"), outside = scratchDir("pr-head-links-out-"), back = process.cwd();
    fs.mkdirSync(path.join(linked, "archive")); fs.mkdirSync(path.join(outside, "instructions"));
    fs.writeFileSync(path.join(outside, "instructions", "items-001.md"), "1. **A day**: an item.\n");
    fs.symlinkSync(path.join(outside, "instructions"), path.join(linked, "archive", "instructions"));
    let said;
    try { process.chdir(linked); said = headOf("core archive 1", "").oks; } finally { process.chdir(back); }
    ok(said.includes(`the archive's "archive/instructions" is a link or lies behind one, read as no file`) && /no archive could be read/u.test(said.join()), "a link where the archive stands is named, and read as no archive");
  }
  const many = linksNote(new Set(["a\u009b[31m", ...Array.from({ length: SHOWN + 2 }, (_, n) => `w${n}`)]));
  ok(many.startsWith(`the archive's "a\\u009b[31m", "w0"`) && many.includes(` and 3 more are links`) && !/[\u0080-\u009f]/u.test(many), "the links are named in quotes, a control character written out, the first ones and then the count of the rest");
  ok(headAsked(HEAD_SINCE, "export const HEAD_SINCE") && headAsked("2026-11-24T00:00:00Z", "export const HEAD_SINCE") && !headAsked("2026-11-22T23:59:59Z", "export const HEAD_SINCE") && !headAsked(HEAD_SINCE, "an older copy") && !headAsked(HEAD_SINCE, null) && !headAsked("", "export const HEAD_SINCE"),
    "the line is asked of a pull request opened on or after its day, its base's copy holding it");
}
// the copy whose history says which lines are asked: where the base's manifest puts the core, never the head's (#455)
{
  const tmp = scratchDir("pr-description-copy-");
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...a) => execFileSync("git", a, { cwd: tmp, env, stdio: ["ignore", "pipe", "pipe"] });
  const manifest = under => `# Core manifest\n\nCore: an-owner/agent-core at ${"a".repeat(40)}, copied whole under ${under} (never edited here).\n`;
  const commit = text => { if (text === null) fs.rmSync(path.join(tmp, "core-manifest.md"), { force: true }); else fs.writeFileSync(path.join(tmp, "core-manifest.md"), text); git("add", "-A"); git("commit", "-q", "--allow-empty", "-m", "x"); };
  git("init", "-q");
  commit(manifest("vendor/core/")); commit(manifest("elsewhere/"));
  ok(copyAtBase(tmp) === "vendor/core/scripts/pr-description.mjs", "the copy is read where the base's manifest puts it, under another path than core/, whatever the head's manifest says");
  commit(null); commit(manifest("vendor/core/"));
  ok(copyAtBase(tmp) === "scripts/pr-description.mjs", "where the base holds no manifest, the core's own scripts/ are read, though the head adds one");
}
// the lines "Number:" in step with the entries whose number the pull request adds or changes (#1138, part 3)
{
  const F = "findings; outcome: robust", C = "check fires; outcome: fast", R = "correction: misread; outcome: asked; rare harm", standing = new Set([F, C, R]);
  const holds = (...lines) => `## What holds it\n${lines.map(l => `- ${l}`).join("\n")}\n## Readings taken\nNumber: ${C}\n`;
  const two = [{ rule: "AGENTS.md: One", number: F }, { rule: "AGENTS.md: Two", number: F }];
  ok(entriesMend(holds(`"One": held by x.\n  Number: ${F}.`, `"Two". Number: Findings; Outcome: robust (the findings fall)`), two, standing) === null
    && entriesMend(holds(`Number: ${R}`, `Number: ${F}`), [{ rule: "AGENTS.md: Three", number: R }], standing) === null
    && entriesMend("No part.", two, standing) === null && entriesMend(holds(`Number: ${C}`), [], standing) === null,
    "a line for each entry the pull request numbers, in any case and whatever follows, passes; so does a line beyond them that names a number an entry holds (a rule widened, its number kept), and a description without the part");
  const short = entriesMend(holds(`Number: ${F}`), two, standing), none = entriesMend("## What holds it\nNone\n", [two[0]], standing);
  ok(/the entry of "AGENTS\.md: Two" gets the number "findings; outcome: robust", which no line "Number:" under "What holds it" gives \(1 line for 2 entries/.test(short ?? "") && !short.includes("AGENTS.md: One")
    && /the entry of "AGENTS\.md: One" gets the number/.test(none ?? "") && [short, none].every(m => mended(`FAIL ${m}`)),
    "one line for two rules, and \"None\" where an entry gains a number, each fail, naming the entry left without its line, with the mend", `${short}\n${none}`);
  const stray = entriesMend(holds(`Number: ${F}`, `Number: correction: looks wrong; outcome: usable`, "Number: none yet"), [two[0]], standing), wrong = entriesMend(holds(`Number: ${C}`), [two[0]], standing);
  ok(/the line "Number: correction: looks wrong; outcome: usable" under "What holds it" names a number no entry of scripts\/holders\/ holds\. Mend: /.test(stray ?? "") && !/none yet/.test(stray)
    && /the entry of "AGENTS\.md: One" gets the number/.test(wrong ?? "") && mended(`FAIL ${stray}`),
    "a line whose number no entry holds fails, and a line in no form is left to the number's own check; a line of another number does not stand for the entry", `${stray}\n${wrong}`);
  const tmp = scratchDir("pr-description-entries-");
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...a) => execFileSync("git", a, { cwd: tmp, env, stdio: ["ignore", "pipe", "pipe"] });
  const entry = (f, rule, number, extra = "") => { fs.mkdirSync(path.join(tmp, "scripts", "holders"), { recursive: true }); fs.writeFileSync(path.join(tmp, "scripts", "holders", f), JSON.stringify({ rule, holder: "audit", ...(number ? { number } : {}), behind: [1] }, null, 2) + extra); };
  git("init", "-q");
  entry("kept.json", "AGENTS.md: Kept", F); entry("moved.json", "AGENTS.md: Moved", F); entry("renum.json", "AGENTS.md: Renum", F); entry("gone.json", "AGENTS.md: Gone", C); entry("plain.json", "AGENTS.md: Plain", null);
  git("add", "-A"); git("commit", "-q", "-m", "base");
  fs.renameSync(path.join(tmp, "scripts", "holders", "moved.json"), path.join(tmp, "scripts", "holders", "moved-now.json"));
  entry("kept.json", "AGENTS.md: Kept", F, "\n"); entry("renum.json", "AGENTS.md: Renum", C); entry("plain.json", "AGENTS.md: Plain", R); entry("new.json", "AGENTS.md: New", F);
  fs.rmSync(path.join(tmp, "scripts", "holders", "gone.json"));
  git("add", "-A"); git("commit", "-q", "-m", "head");
  const read = entriesChanged(tmp);
  ok(JSON.stringify(read?.changed.map(c => c.rule).sort()) === JSON.stringify(["AGENTS.md: New", "AGENTS.md: Plain", "AGENTS.md: Renum"]) && JSON.stringify([...read.standing].sort()) === JSON.stringify([R, C, F].sort()),
    "from git: an entry added with a number, one that gains one and one whose number changes are read; one only edited or renamed with its number, and one taken out, are not", JSON.stringify(read && { changed: read.changed, standing: [...read.standing] }));
  ok(entriesChanged(scratchDir("pr-description-nogit-")) === null, "where the change cannot be read against its base, nothing is read");
}
// run, each failure says its mend (no pull request's date given, so the line is not asked of it here)
const run = body => spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/pr-description.mjs", import.meta.url))], { env: { ...process.env, PR_BODY: body, PR_CREATED: "" }, encoding: "utf8" });
const none = run("The change, and nothing else.");
ok(none.status === 1 && /has no heading "Readings taken"\. Mend: add "## Readings taken"/.test(none.stdout) && mended(none.stdout) && run(whole).status === 0, "run, a description without its headings fails, each failure saying its mend, and one with them passes");
ok(mended(`FAIL ${waitsMend("x")}`) && mended(`FAIL ${waitsMend("Waits on: soon")}`) && mended(`FAIL ${costMend("x")}`) && mended(`FAIL ${numberMend("## What holds it\n- a rule")}`) && mended(`FAIL ${reasonsMend("x", ["- a"])}`), "so do the lines' own failures, as the script prints them");
process.exit(failed ? 1 : 0);
