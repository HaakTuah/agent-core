// Checks the description check (scripts/pr-description.mjs): a part is there only as a heading that starts
// with its words. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/pr-description-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { asked, copyAtBase, doneAsked, DONE_SINCE, missing, PARTS } from "../scripts/pr-description.mjs";
import { costMend, NO_COST } from "../scripts/pr-cost.mjs";
import { numberMend } from "../scripts/pr-number.mjs";
import { reasonsMend } from "../scripts/pr-reasons.mjs";
import { heldAt, waitsMend, waitsOn } from "../scripts/pr-waits.mjs";
import * as facade from "../scripts/pr-description.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const whole = "The change.\n\n## What the owner can try\n\nOpen it.\n\n## Readings taken\n\nNone.\n";

// the names pr-description.mjs exported before its split (#888)
ok(["CHANGED_SINCE", "COST_SINCE", "DONE_SINCE", "HOLDS", "MANIFEST_MAX", "NO_COST", "NUMBER_SINCE", "PARTS", "PLAN_SINCE", "READS_SINCE", "REASONS", "REASONS_SINCE", "UNREADABLE", "WAITS", "WAITS_SINCE", "YES_SINCE", "asked", "calledFor", "copyAtBase", "costMend", "differencesAdded", "doneAsked", "heldAt", "missing", "numberMend", "planAsked", "reasonsMend", "waitsMend", "waitsOn"].every(n => n in facade), "pr-description.mjs still exports each name it exported before its split");
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
// run, each failure says its mend (no pull request's date given, so the line is not asked of it here)
const run = body => spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/pr-description.mjs", import.meta.url))], { env: { ...process.env, PR_BODY: body, PR_CREATED: "" }, encoding: "utf8" });
const none = run("The change, and nothing else.");
ok(none.status === 1 && /has no heading "Readings taken"\. Mend: add "## Readings taken"/.test(none.stdout) && mended(none.stdout) && run(whole).status === 0, "run, a description without its headings fails, each failure saying its mend, and one with them passes");
ok(mended(`FAIL ${waitsMend("x")}`) && mended(`FAIL ${waitsMend("Waits on: soon")}`) && mended(`FAIL ${costMend("x")}`) && mended(`FAIL ${numberMend("## What holds it\n- a rule")}`) && mended(`FAIL ${reasonsMend("x", ["- a"])}`), "so do the lines' own failures, as the script prints them");
process.exit(failed ? 1 : 0);
