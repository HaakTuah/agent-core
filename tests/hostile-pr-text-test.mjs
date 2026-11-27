// Hostile tests for one input the core reads (floor topic 5, "Every named input has hostile tests"): a pull request's
// description, its body, which anyone who opens a pull request writes. It is read by the description check
// (pr-description.mjs: missing, asked, waitsOn, waitsMend, reasonsMend, and its run on PR_BODY) and by the line
// "Read for it:" (reading.mjs: listed, lineMend) and the line "Never needed:" (read-total.mjs: neverNeeded, which the size
// workflow hands it in PR_BODY); the description workflows (.github/workflows/pr-description.yml and
// own-description.yml) hand it over in PR_BODY alone. Each case is refused: nothing of it is taken as a heading, a
// line or a pass. Run by tests.yml.
//
//   node tests/hostile-pr-text-test.mjs
import { spawnSync } from "../scripts/check-runs.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { PARTS, missing, reasonsMend, waitsMend, waitsOn } from "../scripts/pr-description.mjs";
import { lineMend, listed } from "../scripts/reading.mjs";
import { neverNeeded } from "../scripts/read-total.mjs";
import { SHOWN, headMends } from "../scripts/pr-head.mjs";
import { scratchDir, projectOf } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const whole = "The change.\n\n## What the owner can try\n\nOpen it.\n\n## Readings taken\n\nNone.\n\nWaits on: nothing\n";
const called = [{ file: "core/floor/topics/input.md", why: "of the kind input" }];
const both = (body) => missing(body).join() === PARTS.join();
// the check as the workflows run it: the body in the env, no pull request's date, so only the headings are asked
const script = fileURLToPath(new URL("../scripts/pr-description.mjs", import.meta.url));
const run = (body, arg) => {
  const env = { ...process.env, PR_CREATED: "" };
  delete env.PR_BODY;
  if (body !== undefined) env.PR_BODY = body;
  return spawnSync(process.execPath, [script, ...(arg === undefined ? [] : [arg])], { env, encoding: "utf8", timeout: 20000 });
};
const refused = (r) => r.status === 1 && mended(r.stdout) && !/\n\s+at /u.test(r.stderr);

// ---- too long ----
{
  const big = `${"x ".repeat(2_500_000)}\n`; // five megabytes of text
  let t = Date.now();
  ok(both(big) && waitsOn(big) === null && listed(big) === null && Date.now() - t < 5000, "five megabytes with no heading and no line: both headings missing, no line, read in a few seconds");
  t = Date.now();
  ok(missing(`${big}${whole}`).length === 0 && waitsOn(`${big}${whole}`)?.kind === "nothing" && Date.now() - t < 5000, "the same with the headings and the line after it: read rightly, in a few seconds");
  t = Date.now();
  const lines = `${"Waits on: nothing\n".repeat(50_000)}Waits on: soon\n${"## Readings\n".repeat(50_000)}`;
  ok(waitsOn(lines)?.kind === null && /in none of the forms/u.test(waitsMend(lines)) && missing(lines).length === 2 && Date.now() - t < 5000, "fifty thousand right lines before a wrong last one: the last counts, and it is refused");
  t = Date.now();
  const ticks = `Read for it: ${"`core/x.md` ".repeat(100_000)}${"`".repeat(200_000)}`;
  ok(/does not list `core\/floor\/topics\/input\.md`/u.test(lineMend(ticks, called, "cmd")) && Date.now() - t < 5000, "a line of a hundred thousand files and loose backticks: what it lacks is still named, in a few seconds");
  t = Date.now();
  const words = `## ${"*".repeat(1_000_000)}What the owner can tr\n## Readings taken${"!".repeat(1_000_000)}x\n`;
  ok(missing(words).join() === "What the owner can try" && Date.now() - t < 5000, "a megabyte of marks around a heading's words: read through, a word cut short still missing");
  // (the env holds at most 128 KB a value on Linux, so the run is tried with what fits)
  const long = run(`${"y".repeat(100_000)}\n## What the owner can try\n`);
  ok(refused(long) && /has no heading "Readings taken"/u.test(long.stdout), "run with 100 KB of body: it fails with its mend, no stack");
}

// ---- the wrong type ----
{
  for (const [what, body] of [["a number", 42], ["NaN", NaN], ["true", true], ["an object", { body: whole }], ["a function", () => whole], ["a list holding a whole body", [whole]], ["an object that writes itself as one", { toString: () => whole }]]) {
    ok(both(body) && waitsOn(body) === null && listed(body) === null && waitsMend(body) !== null && lineMend(body, called, "cmd") !== null, `a body that is ${what} reads as no body: both headings missing, no line, each mend given`);
  }
  // (the parts' argument, asked(), is the project's own workflow input, never the body's: no case of this input)
}

// ---- markup ----
{
  ok(both("<h2>What the owner can try</h2>\n<h2>Readings taken</h2>\n") && both("<!-- ## What the owner can try -->\n<!-- ## Readings taken -->\n"), "an HTML heading, or a heading and its comment on one line, is no heading");
  ok(both("> ## What the owner can try\n> ## Readings taken\n") && both("- ## What the owner can try\n1. ## Readings taken\n"), "a heading quoted with >, or in a list, is no heading");
  ok(both("<script>## What the owner can try</script>\n<details><summary>## Readings taken</summary></details>\n"), "a heading inside a tag on its line is no heading");
  ok(missing("```\n## What the owner can try\n```\n<!--\n## Readings taken\n-->\n").length === 0, "a heading line in a code block or a multi-line comment counts: the stated exception, its header says it catches the heading forgotten, not the one faked");
  ok(waitsOn("> Waits on: nothing") === null && waitsOn("<!-- Waits on: nothing -->") === null && waitsOn("**Waits on:** nothing") === null && waitsOn("`Waits on: nothing`") === null, "a waits line quoted with >, inside a comment on its line, bold or in code is no line");
  ok(waitsOn(`${whole}> Waits on: the owner: may it merge?\n`)?.kind === "nothing", "a quoted waits line after the real one does not stand in for it");
  ok(waitsOn("Waits on: <script>alert(1)</script>")?.kind === null && /in none of the forms/u.test(waitsMend("Waits on: <b>nothing</b>")), "markup in the waits line is in none of the forms");
  ok(waitsOn("Waits on: nothing <!-- -->")?.kind === "nothing" && waitsOn("Waits on: #241 <img src=x>")?.said === "#241 <img src=x>", "markup after a right form is whatever follows it, kept as data (#750, point 4): the look quotes it in a code span");
  ok(listed("> Read for it: `core/floor/topics/input.md`") === null && /is missing/u.test(lineMend("<!-- Read for it: `core/floor/topics/input.md` -->", called, "cmd")), "a 'Read for it' line quoted or in a comment on its line lists nothing");
  ok(/does not list/u.test(lineMend("Read for it: <code>core/floor/topics/input.md</code>", called, "cmd")), "a file in a code tag, not backticks, is not listed");
  const r = run("<script>alert(1)</script>\n<h2>Readings taken</h2>\n");
  ok(refused(r) && /2 of 2 missing/u.test(r.stdout), "run, a body of markup alone fails with its mend");
}

// ---- a file path ----
{
  for (const p of ["../../etc/passwd", "/etc/passwd", "C:\\Windows\\System32", "core/../x"]) {
    ok(both(`## ${p}\n# ${p}\n`) && waitsOn(`Waits on: ${p}`)?.kind === null, `a path in a heading or the waits line, ${p}, names no part and no form`);
    ok(/does not list `core\/floor\/topics\/input\.md`/u.test(lineMend(`Read for it: \`${p}\``, called, "cmd")), `a path in the line, ${p}, stands for nothing it is called for`);
  }
  ok(/does not list/u.test(lineMend("Read for it: `core/floor/../floor/topics/input.md`, `./core/floor/topics/input.md`", called, "cmd")), "a path spelled another way to the same file is not taken for it: the line must name it as asked");
  ok(lineMend("Read for it: `../../etc/passwd`, `core/floor/topics/input.md`", called, "cmd") === null, "a path beside the right file is ignored: the line is held only to what is called for");
  ok(missing("## What the owner can try/../../etc/passwd\n## Readings taken.txt\n").length === 0, "a heading whose part's words are followed by a mark still counts, as the header says, and opens nothing");
}

// ---- a number out of range ----
{
  ok(["#-1", "#1e9", "#", "#0x10", "# 241", "#\u0661\u0662", "#0", "#007", "#1234567890", "#1-2"].every(w => waitsOn(`Waits on: ${w}`)?.kind === null), "an item that is negative, an exponent, empty, hex, spaced, in other digits, nought, led by a nought, past nine digits or a range is in none of the forms");
  ok(missing("####### What the owner can try\n####### Readings taken\n").length === 2, "seven # are no heading");
  ok(both(42e300) && both(-Infinity), "a body that is a huge or infinite number is no body");
  // (the commits' dates heldAt() reads are GitHub's, never the body's: no case of this input)
}

// ---- nothing at all ----
{
  for (const [what, body] of [["undefined", undefined], ["null", null], ["empty", ""], ["blank lines", "\n\r\n \t\n"], ["an empty array", []], ["an empty object", {}]]) {
    ok(both(body) && waitsOn(body) === null && listed(body) === null && /has no line "Waits on:"/u.test(waitsMend(body)) && /is missing; it must list/u.test(lineMend(body, called, "cmd")), `a body that is ${what} passes nothing: both headings missing, no line, each mend given`);
  }
  ok(waitsOn("Waits on:")?.kind === null && waitsOn("Waits on: the owner: ?")?.kind === null && listed("Read for it:")?.length === 0, "a line with nothing after it is in none of the forms, and lists nothing");
  ok(lineMend(undefined, [], "cmd") === null && missing("", []).length === 0, "where nothing is called for or asked, nothing is asked of an empty body");
  for (const [what, body] of [["unset", undefined], ["empty", ""]]) {
    const r = run(body);
    ok(refused(r) && /2 of 2 missing/u.test(r.stdout), `run with the body ${what}: it fails with its mend, no stack`);
  }
  ok(run(whole).status === 0, "and a right body passes, so the refusals above are the body's");
}

// the line "Reasons read:" asked of a pull request that adds a difference (#756): too long, the wrong type, markup,
// nothing at all; none is taken for the line
{
  const added = ["- a difference"];
  const slow = Date.now();
  ok(reasonsMend(`${"Reasons read:\n".repeat(500000)}`, added) !== null && Date.now() - slow < 2000, "reasonsMend: half a million empty lines \"Reasons read:\" are none, read in no time");
  ok([42, null, undefined, {}, [], { toString: () => "Reasons read: faked" }].every(body => mended(`FAIL ${reasonsMend(body, added)}`, { from: projectOf() })), "reasonsMend: a body of the wrong type is no line, and fails with its mend");
  ok(["**Reasons read:** x", "`Reasons read: x`", "> Reasons read: x", "<!-- Reasons read: x -->", "Reasons read:\u00a0\u200b"].every(body => reasonsMend(body, added) !== null), "reasonsMend: the label in markup, quoted, in a comment, or followed only by blanks is no line");
  ok(reasonsMend("", added) !== null && reasonsMend("Reasons read: x", "not a list") === null && reasonsMend("", []) === null, "reasonsMend: nothing at all fails where a difference is added; with none added, nothing is asked");
}

// the line "Never needed:" the total read takes (read-total.mjs, #469): too long, the wrong type, markup, a path, nothing
// at all; none names a file save a line of its own that says why, and none is read past its own line
{
  const why = "Never needed: `tasks/a.md`, since no task of that kind changes a screen.";
  let slow = Date.now();
  const blank = neverNeeded("\n".repeat(5 * 1024 * 1024)), spaces = neverNeeded(`${" ".repeat(5 * 1024 * 1024)}x`), many = neverNeeded(`${why}\n`.repeat(100000));
  ok(blank.size === 0 && spaces.size === 0 && many.size === 1 && Date.now() - slow < 3000, "neverNeeded: five megabytes of blank lines or of spaces are none, and a line given a hundred thousand times is one, read in no time");
  slow = Date.now();
  ok(neverNeeded(`Never needed: ${"`x` ".repeat(500000)}why`).size === 1 && Date.now() - slow < 3000, "neverNeeded: a line of half a million names is read in no time");
  ok([42, null, undefined, {}, [], { toString: () => why }].every(body => neverNeeded(body).size === 0), "neverNeeded: a body of the wrong type names nothing");
  ok(["**Never needed:** `tasks/a.md` why", `> ${why}`, `<!-- ${why} -->`, `\`${why}\``, "Never needed: `tasks/a.md`", "Never needed: `tasks/a.md` `tasks/b.md`", "Never needed:\n`tasks/a.md` why it was never"].every(body => neverNeeded(body).size === 0),
    "neverNeeded: the line in markup, quoted, in a comment or code, one that names files and says no why, and names on the line after are none");
  const named = neverNeeded("Never needed: `../../etc/passwd`, `C:\\x`, `<script>`, which a polish task never opens.");
  ok(named.size === 3 && named.has("../../etc/passwd") && named.has("<script>"), "neverNeeded: a path or markup in backticks is a name and no more, which only ever spares a file from the list of those lost");
  ok(neverNeeded("").size === 0 && neverNeeded("Never needed:").size === 0, "neverNeeded: nothing at all names nothing");
}

// the archive keys and placeholders the description names (pr-head.mjs, #1136): too long, the wrong type, markup, a
// file path, a number out of range, nothing at all; none is taken for a key the archive holds, none hides what shows,
// and none makes the reading slow
{
  const keys = new Set(["218", "#1084"]), fails = body => headMends(body, { keys }).mends;
  const marks = [" ", "\"", "“", "“x ", "`", "` ", "<!--", "a <!-- ", "`<!--` ", "core archive "];
  for (const mark of marks) {
    const slow = Date.now(), said = fails(`${mark.repeat(Math.floor(65536 / mark.length))}\n`);
    ok(Array.isArray(said) && Date.now() - slow < 2000, `headMends: 64 KB of ${JSON.stringify(mark)}, opened and never closed, is read in no time`);
  }
  const slow = Date.now();
  fails(`${Array.from({ length: 360 }, (_, n) => "`".repeat(n + 1)).join(" ")}\n${" ".repeat(200000)}x\n- ${" ".repeat(200000)}x\n:${" ".repeat(200000)}x\n`);
  ok(Date.now() - slow < 2000, "headMends: runs of backticks of every length, and long runs of blanks before a list mark or after a colon, are read in no time");
  ok([42, NaN, true, {}, [], ["TBD"], { toString: () => "TBD" }, () => "TBD", Symbol("TBD")].every(body => fails(body).length === 0), "headMends: a body of the wrong type is no body, and names nothing");
  ok(fails("a <!-- TBD\n**TODO** <b>XXX</b> [FIXME](x)\n`<!--` core archive 999\n").length === 5 && fails("<!-- TBD -->\n<!--\nTODO\n").length === 0,
    "headMends: markup hides nothing that shows (an unclosed comment mid-line, bold, a tag, a link, a comment's opening in code marks), and a comment hides what it holds");
  ok(fails("core archive ../218\ncore archive /etc/passwd\ncore archive C:\\218").length === 0 && fails("core archive 999/../218").length === 1, "headMends: a path is no key, and a key before one is read as written");
  ok(["core archive -1", "core archive 1e9", "core archive \u0661\u0662", "core archive 0x10"].every(b => fails(b).length === 0) && ["core archive 99999999999999999999", "core archive #0", "core archive #1084.1.2"].every(b => fails(b).length === 1) && fails("core archive 000218").length === 0,
    "headMends: a number out of its form is no key, one too large or past the archive fails, and leading zeros name the item they lead to");
  ok([undefined, null, "", "\n\r\n \t\n"].every(body => fails(body).length === 0 && headMends(body, { keys: null }).notes.length === 0), "headMends: nothing at all names nothing, and says nothing of an archive not read");
  const lines = body => fails(body).map(m => Number(/^line (\d+)/u.exec(m)[1])).join();
  ok(lines("Document the `<!--` opening.\nNotes: TBD\nBehind it: core archive 999999\n") === "3,2" && lines("``a`<!--`` TBD\n`a` <!-- TBD --> `b`\n<!-- `x --> TBD `\n`\"` TBD `\"`\n“a “b” TBD\nx \" TBD `\"`\n") === "1,3,4,5,6",
    "headMends: code marks are read before a comment's opening, as whichever opens first: a \"<!--\" in code marks opens no comment, and a backtick in a comment opens no code; a quote mark in code marks opens no quote, and a quote closes at the first closing mark");
  ok(lines("<!-- -->TBD\"x\"\n<!-- -->\"x\"TBD\nx `\"` TBD `\"`\na`x`\"y\"TBD\na`x`TBD\"y\"\n`TBD` \"y\" `TODO`\n\"`x` TBD\" y\na `b` <!-- TBD --> c\n") === "1,2,3,4,5",
    "  what is read stays in its place after a comment, a code span or a quote, whichever stands first, one inside another going with it");
  ok(lines("A note <!-- with no end\nNotes: TBD\n\nA note <!-- that ends\nTBD -->\nTODO\n\nA note <!-- that would end\n\nTBD -->\n<!-- one\n\nTODO -->XXX\n") === "2,6,10,13",
    "  a \"<!--\" opens a comment where it opens the line or where a \"-->\" closes it in its paragraph; elsewhere it is text, which shows");
  ok(lines("x <!-- TBD") === "1" && lines("a <!-- x\nTBD -->") === "" && lines("a <!-- x\n \nTBD -->") === "3" && lines("   <!-- TBD") === "" && lines("x<!-- TBD") === "1"
    && fails("Tests: <!-- to be added").length === 0 && fails("Tests: <!-- x --> to be added").length === 1
    && fails("A note <!-- \"TBD\" here").length === 0 && fails("Notes:<!---->to be added").length === 1,
    "  on the first line and the last, past a line of blanks, indented up to three; and a \"<!--\" that is text stays in its place, one that opens goes");
}

// the archive the keys are read from (pr-head.mjs's keysAt, #1136), which a fork's branch may make a pipe, a link or a
// folder: each reads as no file, the check is never stopped, and nothing outside the checkout is read as its archive
// (#848); and a description that names many is told of the first SHOWN, then the count of the rest
{
  const head = fileURLToPath(new URL("../scripts/pr-head.mjs", import.meta.url));
  // (in a process of its own with a time limit, so a reader that waits on a pipe fails rather than hangs)
  const keysOf = (root, prefix = "") => {
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", `import(${JSON.stringify(`file://${head}`)}).then(m => { const k = m.keysAt(${JSON.stringify(root)}, ${JSON.stringify(prefix)}); console.log(JSON.stringify(k && [...k])); })`], { encoding: "utf8", timeout: 10000 });
    return r.status === 0 ? JSON.parse(r.stdout) : `failed: ${r.error?.code ?? r.stderr.split("\n").find(Boolean)}`;
  };
  const archive = (dir, prefix = "") => { const at = path.join(dir, prefix, "archive/instructions"); fs.mkdirSync(at, { recursive: true }); return at; };
  const outside = scratchDir("pr-head-outside-");
  fs.writeFileSync(path.join(archive(outside), "items-001.md"), "1. **A day**: an item outside the checkout.\n");
  if (process.platform !== "win32") {
    const piped = scratchDir("pr-head-pipe-"), at = archive(piped);
    fs.writeFileSync(path.join(at, "items-001.md"), "1. **A day**: an item.\n");
    if (spawnSync("mkfifo", [path.join(at, "items-002.md")]).status === 0) ok(JSON.stringify(keysOf(piped)) === '["1"]', "keysAt: a pipe among the archive's files is read as no file, and the check is not stopped");
    const linked = scratchDir("pr-head-link-");
    fs.mkdirSync(path.join(linked, "archive"));
    fs.symlinkSync(path.join(outside, "archive/instructions"), path.join(linked, "archive/instructions"));
    const viaCore = scratchDir("pr-head-core-link-");
    fs.symlinkSync(outside, path.join(viaCore, "core"));
    const fileLink = scratchDir("pr-head-file-link-");
    fs.symlinkSync(path.join(outside, "archive/instructions/items-001.md"), path.join(archive(fileLink), "items-001.md"));
    ok(keysOf(linked) === null && keysOf(viaCore, "core/") === null && keysOf(fileLink) === null, "keysAt: a link to a folder outside the checkout, as the archive, as the copy on the way to it or as one of its files, is read as no archive");
  }
  const foldered = scratchDir("pr-head-folder-");
  fs.mkdirSync(path.join(archive(foldered), "items-001.md"));
  fs.writeFileSync(path.join(archive(foldered), "issue-9.md"), "#9. **A day**: an item.\n");
  ok(JSON.stringify(keysOf(foldered)) === '["#9"]', "keysAt: a folder named as an archive file is no file, with no error");
  const said = headMends("TBD ".repeat(16384), { keys: new Set() }).mends;
  ok(said.length === SHOWN + 1 && said.at(-1).startsWith(`${16384 - SHOWN} more such failures`) && mended(said.map(m => `FAIL ${m}`).join("\n")), `headMends: 64 KB of "TBD " gives the first ${SHOWN} failures and one that counts the rest, each with its mend`);
}

process.exit(failed ? 1 : 0);
