// Hostile tests for one input the core reads (floor topic 5, "Every named input has hostile tests"): a pull request's
// description, its body, which anyone who opens a pull request writes. It is read by the description check
// (pr-description.mjs: missing, asked, waitsOn, waitsMend, and its run with PR_BODY in the env) and by the line
// "Read for it:" (reading.mjs: listed, lineMend); the description workflows (.github/workflows/pr-description.yml and
// own-description.yml) hand it over in PR_BODY alone. Each case is refused: nothing of it is taken as a heading, a
// line or a pass. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/hostile-pr-text-test.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { PARTS, missing, waitsMend, waitsOn } from "./pr-description.mjs";
import { lineMend, listed } from "./reading.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const whole = "The change.\n\n## What the owner can try\n\nOpen it.\n\n## Readings taken\n\nNone.\n\nWaits on: nothing\n";
const called = [{ file: "core/floor/topics/input.md", why: "of the kind input" }];
const both = (body) => missing(body).join() === PARTS.join();
// the check as the workflows run it: the body in the env, no pull request's date, so only the headings are asked
const script = fileURLToPath(new URL("./pr-description.mjs", import.meta.url));
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
  for (const [what, body] of [["a number", 42], ["NaN", NaN], ["true", true], ["an object", { body: whole }], ["a function", () => whole]]) {
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
  ok(waitsOn("Waits on: nothing <!-- -->")?.kind === null && waitsOn("Waits on: #241 <img src=x>")?.kind === null, "markup after a right form spoils it");
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
  ok(["#-1", "#1.5", "#1e9", "#", "#0x10", "# 241", "#\u0661\u0662"].every(w => waitsOn(`Waits on: ${w}`)?.kind === null), "an item that is negative, a fraction, an exponent, empty, hex, spaced or in other digits is in none of the forms");
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

process.exit(failed ? 1 : 0);
