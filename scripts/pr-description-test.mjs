// Checks the description check (pr-description.mjs, beside this file): a part is there only as a heading that starts
// with its words. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/pr-description-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { asked, calledFor, heldAt, missing, PARTS, waitsMend, waitsOn } from "./pr-description.mjs";
import { lineMend } from "./reading.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const whole = "The change.\n\n## What the owner can try\n\nOpen it.\n\n## Readings taken\n\nNone.\n";

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
ok(waitsMend("Waits on: nothing") === null && /has no line "Waits on:"/.test(waitsMend("x")) && /"Waits on: soon" is in none of the forms/.test(waitsMend("Waits on: soon")) && /needs-owner/.test(waitsMend("")),
  "the mend names what is missing or wrong, and the forms, with the label for the owner");
const cs = [{ sha: "c", date: "2026-11-20T00:00:00Z" }, { sha: "b", date: "2026-11-18T00:00:00Z" }, { sha: "a", date: "2026-11-17T00:00:00Z" }];
const read = [];
ok(heldAt(cs, "2026-11-19T00:00:00Z", s => (read.push(s), s !== "a")) === true && read.join() === "b", "the line is asked where the copy's newest commit from before the pull request opened holds it, one file read");
ok(heldAt(cs, "2026-11-17T12:00:00Z", s => s !== "a") === false && heldAt(cs, "2026-11-01T00:00:00Z", () => true) === false && heldAt([], "2026-11-19T00:00:00Z", () => true) === false,
  "not where that commit's copy lacks it, where the copy changed only after the pull request opened, or where nothing changed it");
const slow = Date.now();
missing(`${"#".repeat(300000)} x\n${"## ".repeat(100000)}\n${" ".repeat(300000)}# Readings taken\n`.repeat(3));
ok(Date.now() - slow < 2000, "a long description of signs and spaces is read in no time");
// what a pull request's changed paths call for, in a scratch project: the merge commit against its base, the kinds of
// the project's own paths as the base holds them, the copy's own paths left out
{
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pr-description-test-")), project = path.join(tmp, "project");
  process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
  const outer = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
  const env = { ...outer, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...args) => execFileSync("git", args, { cwd: project, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(project, f)), { recursive: true }); fs.writeFileSync(path.join(project, f), text); };
  for (const part of ["floor", "modules", "roles"]) fs.cpSync(path.join(root, part), path.join(project, "core", part), { recursive: true });
  put("core-manifest.md", "# Core manifest\n"); put("checks/reading.json", `${JSON.stringify({ paths: { "src/screens/": "screen" } })}\n`); put("src/screens/a.js", "1\n");
  git("init", "-q", "-b", "main"); git("add", "-A"); git("commit", "-q", "-m", "the base");
  ok(calledFor(tmp) === null, "where no core stands, what a change calls for cannot be read");
  put("src/screens/a.js", "2\n"); put("checks/reading.json", "{}\n"); put("core/CLAUDE.md", "x\n"); put(".github/workflows/caf\u00e9.yml", "on: push\n");
  git("add", "-A"); git("commit", "-q", "-m", "a change that empties its own reading config");
  const called = calledFor(project);
  ok(JSON.stringify(called.map(c => c.file)) === JSON.stringify(["core/floor/topics.md", "core/modules/screens.md"]) && /of the kind screen/.test(called[1].why),
    "a pull request's changed paths call for their files by the reading config its base holds, not the one it carries; a path of the copy calls for nothing, and one outside ASCII is read as spelled", JSON.stringify(called));
  ok(/does not list `core\/modules\/screens\.md`/.test(lineMend("Read for it: `core/floor/topics.md`", called, "cmd")) && lineMend("Read for it: `core/floor/topics.md`, `core/modules/screens.md`", called, "cmd") === null, "and the line is held to them");
  git("checkout", "-q", "--orphan", "alone"); git("commit", "-q", "-m", "no parent");
  ok(calledFor(project) === null, "with no base to read against, nothing is asked");
}
// run, each failure says its mend (no pull request's date given, so the line is not asked of it here)
const run = body => spawnSync(process.execPath, [fileURLToPath(new URL("./pr-description.mjs", import.meta.url))], { env: { ...process.env, PR_BODY: body, PR_CREATED: "" }, encoding: "utf8" });
const none = run("The change, and nothing else.");
ok(none.status === 1 && /has no heading "Readings taken"\. Mend: add "## Readings taken"/.test(none.stdout) && mended(none.stdout) && run(whole).status === 0, "run, a description without its headings fails, each failure saying its mend, and one with them passes");
ok(mended(`FAIL ${waitsMend("x")}`) && mended(`FAIL ${waitsMend("Waits on: soon")}`), "so does the line's own failure, as the script prints it");
process.exit(failed ? 1 : 0);
