// Tests of the queue's reader (scripts/queue.mjs; AGENTS.md, "The queue"; #750, point 1): a line whose issue has
// closed is skipped, waited on no more, cleared together by the next pull request that changes the queue, and fails
// that pull request while it stands; a project's progress file, a list, read the same way (where GitHub cannot be read,
// and the form: queue-form-test.mjs). Node's own modules only; GitHub and the file stand in as functions.
//
//   node tests/queue-test.mjs
import fs from "node:fs";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { LARGEST, cleared, closedAt, command, fileAt, linesOf, read, statesOf, unplaced } from "../scripts/queue.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const queue = [
  "# The core's queue", "", "The first line that waits on nothing is next.", "",
  "| Issue | Who | Waits on |", "| --- | --- | --- |",
  "| #10 | rule builder | |",
  "| #11, point 2 | builder | #10 |",
  "| #12 | builder | #9 and #13 |",
  "| #13 | builder | |",
  "| #14 | the owner | on hold |",
  "",
].join("\n");
const shut = new Set([10, 9]), closed = n => shut.has(n);
// a project's progress file, a list (#750, point 1, in every project)
const list = "# Progress\n\n- #20 the menu, builder\n- [ ] #21 sound, waits on #20 and #9\n  - a note under it\n* #22 the save, waits on the owner's word\nNot a line: #23\n";
const items = linesOf(list);
ok(items.map(l => l.issues.join("+")).join() === "20,21,22" && items[1].waits.join() === "20,9" && items[0].waits.length === 0 && items[2].words === "the owner's word", "in a list, an item that names its issue first is a line, what it waits on read after \"waits on\"");
ok(read(list, n => n === 20 || n === 9).next?.issues[0] === 21 && cleared(list, n => n === 20) === list.replace("- #20 the menu, builder\n", ""), "a list is read and cleared as the core's table is");
ok(fileAt(null) === "QUEUE.md" && fileAt("| *progress file* | `docs/PLAN.md` |\n") === "docs/PLAN.md" && fileAt("no slot\n") === "docs/PROGRESS.md", "the progress file is the core's queue, or the one a project's manifest names, else the starter kit's");


const lines = linesOf(queue);
ok(lines.map(l => l.issues.join("+")).join() === "10,11,12,13,14" && lines[1].waits.join() === "10" && lines[2].waits.join() === "9,13" && lines[0].waits.length === 0 && lines[4].words === "on hold", "each row of the table is a line, its issue the first it names, what it waits on read from its last cell");
let got = read(queue, closed);
ok(got.open.map(l => l.issues[0]).join() === "11,12,13,14" && got.gone.map(l => l.issues[0]).join() === "10", "the line of a closed issue is skipped, the others kept in order");
ok(got.next?.issues[0] === 11, "a line that waits only on what has closed waits on nothing: it is next", JSON.stringify(got.next));
ok(read(queue, n => n === 10 || n === 11).next?.issues[0] === 13 && read(queue, () => false).next?.issues[0] === 10, "one that waits on an open issue is passed over; with nothing closed, the first that waits on nothing is next");
ok(read(queue.replace("| #13 | builder | |", "| #13 | builder | the owner's word |"), n => [10, 11, 12].includes(n)).next === null, "a line that waits on words naming no issue still waits");
const after = cleared(queue, closed);
ok(after === queue.replace("| #10 | rule builder | |\n", ""), "clearing takes out the line of each closed issue and changes nothing else");
ok(cleared(queue, () => false) === queue && cleared(queue.replace(/\n/gu, "\r\n"), closed).includes("| #11, point 2 | builder | #10 |\r\n"), "with nothing closed it changes nothing, and keeps the file's line endings");

// a line held for the owner, and one that names several issues (the fallback reviewer's findings on #757)
const held = "| #30 | the owner | on hold, after #29 |\n| #31 | builder | #29 |\n| #32, #33 and #34 | builder | |\n| #35 to #36 | builder | |\n";
ok(read(held, n => n === 29).next?.issues[0] === 31, "a line held for the owner is never next, whatever it waits on");
const holds = "| #40 | builder | on hold, after #39 |\n| #41 | builder | #593's points 1 to 3 |\n| #42 | builder | #39 and #593 |\n";
ok(read(holds, n => [39, 593].includes(n)).next?.issues[0] === 41 && read(holds.replace(/^.*#41.*\n/mu, ""), n => [39, 593].includes(n)).next?.issues[0] === 42, "a line whose wait names only issues, or points of one, is free once they have closed (Codex's finding on #757)");
ok(read("| #40 | builder | on hold, after #39 |\n", n => n === 39).next === null, "a line that waits on a hold besides an issue stays waiting once the issue has closed");
ok(linesOf("| #679 to #682 | builder | |\n")[0].issues.join() === "679,680,681,682" && linesOf("| #1 to #500 | builder | |\n")[0].kept && read("| #679 to #682 | builder | |\n", n => n !== 681).gone.length === 0, "a range of issues is read whole, and its line stays while one of them is open; one past a hundred wide is kept, never cleared by its two ends");
ok(linesOf(held)[2].issues.join() === "32,33,34" && read(held, n => n === 32).gone.length === 0 && read(held, n => [32, 33, 34].includes(n)).gone.map(l => l.issues[0]).join() === "32" && cleared(held, n => n === 35) === held,
  "a line that names several issues goes only once all of them have closed");

// GitHub's list of open issues, a page at a time
const asked = [], page = rows => JSON.stringify(rows), open = n => ({ number: n, state: "open" });
const states = statesOf("o/r", route => { asked.push(route); return route.endsWith("page=1") ? page(Array.from({ length: 100 }, (_, i) => open(i + 100))) : page([open(11)]); });
ok(!states(11) && !states(150) && states(10) && states(9999) && asked.length === 2 && asked[0] === "repos/o/r/issues?state=open&per_page=100&page=1", "the open issues are read a page at a time, and every number not open counts as closed");
const throws = gh => { try { statesOf("o/r", gh); return false; } catch { return true; } };
ok(throws(() => { throw new Error("no network"); }), "where GitHub cannot answer, the reading throws, never guessing");

// hostile input (SECURITY.md, rule 5): GitHub's answers and the file's text, each refused or read as data
for (const answer of ["not json", "{}", "null", page([null]), page([{ number: "11", state: "open" }]), page([{ number: 11, state: "closed" }]), page([{ number: -1, state: "open" }]), page([{ number: 1.5, state: "open" }]), page([{ number: 2 ** 60, state: "open" }]), page([{ state: "open" }])])
  ok(throws(() => answer), `an answer of ${answer.slice(0, 40)} is refused, never read as open or closed`);
ok(throws(route => (/page=(\d+)/u.exec(route)[1] <= 100 ? page(Array.from({ length: 100 }, (_, i) => open(i + 1))) : page([]))), "an answer that never ends is refused at 100 pages");
const odd = ["| #99999999999 | builder | |", "| #0 | builder | |", "|#7|", "| x #8 | builder | |", "- see #9", "-#10 no space", "| #11 | builder | $(touch x) #12 `rm` |", "| | | |", "|", "#13 alone"].join("\n");
const seen = linesOf(odd);
ok(seen.map(l => l.issues.join("+")).join() === "0,7,11" && seen[2].waits.join() === "12" && seen[2].words === "$(touch x) #12 `rm`", "a line is read only where a cell or item names its issue first in at most nine digits, and its words stay text", JSON.stringify(seen));
const slot = at => `| *progress file* | \`${at}\` |\n`;
ok(["../../.ssh/authorized_keys", "/etc/passwd", ".git/config", "docs/../../x.md", "core/QUEUE.md", "notes.txt", "C:/x.md"].every(at => fileAt(slot(at)) === null) && fileAt(slot("docs/./PLAN.md")) === "docs/PLAN.md",
  "a progress file the manifest names outside the project, in .git or core/, or not Markdown, is refused (the fallback reviewer's finding on #757)");
ok(["AGENTS.md", "docs/CLAUDE.md", "SECURITY.md", "core-manifest.md", ".github/workflows/x.md", ".claude/x.md", ".kiro/x.md", ".agents/x.md", "REVIEW.md", "GEMINI.md"].every(at => fileAt(slot(at)) === null) && fileAt(slot("docs/AGENTS-NOTES.md")) === "docs/AGENTS-NOTES.md",
  "a progress file the manifest names that is a protected file, which --clear would rewrite, is refused (the fallback reviewer's finding on #757's fixes)");
const open13 = n => n !== 13 && n !== 250, packed = "| #12-#13 | builder | |\n| #12/#13 | builder | |\n| #1 to #500 | builder | |\n| #12 | builder | |\n";
ok(cleared(packed, open13) === "| #12-#13 | builder | |\n| #12/#13 | builder | |\n| #1 to #500 | builder | |\n" && linesOf(packed)[0].issues.join() === "12,13",
  "the first cell's every issue is read, one after a dash or a slash too, and a range too wide to read is kept: --clear takes out no line of an open issue (the fallback reviewer's finding on #757's fixes)");
ok(linesOf("| #50 | builder | agent-core#740 and a/b#7 and x-#8 |\n")[0].waits.length === 0 && linesOf("| other#51 | builder | |\n").length === 0, "a number another repository's name stands before is no issue of this one's");
ok(command("--clear", { file: "Q.md", read: () => queue, write: () => { throw new Error("written"); }, closed: () => () => true }).status === 1 && mended(command("--check", { file: "Q.md", read: () => queue, closed: () => () => true }).out),
  "where GitHub's list names none of the file's lines open, as another repository's would, it refuses and writes nothing");
ok(command(undefined, { file: "Q.md", read: () => "\u20ac".repeat(LARGEST / 2), closed: () => () => false }).status === 1, "the largest is counted in bytes, not characters");
ok(command(undefined, { file: "Q.md", read: () => "x".repeat(LARGEST + 1), closed: () => () => false }).status === 1 && mended(command(undefined, { file: "Q.md", read: () => "x".repeat(LARGEST + 1), closed: () => () => false }).out), "a progress file past the largest the reader takes is refused, saying the mend");

// the command, in this process, with the file and GitHub standing in
let file = queue, answer = page([open(11), open(12), open(13), open(14)]);
const at = { read: () => file, write: text => { file = text; }, closed: () => statesOf("o/r", () => { if (answer === null) throw new Error("no answer"); return answer; }) };
let r = command(undefined, at);
ok(r.status === 0 && !/^\| #10 /mu.test(r.out) && /^\| #11, point 2 /mu.test(r.out) && /4 open lines, 1 of closed issues skipped \(#10\)/u.test(r.out) && /next: #11/u.test(r.out), "the reader prints the open lines and the next", r.out);
r = command("--check", at);
ok(r.status === 1 && mended(r.out) && /closed: #10/u.test(r.out) && /run node scripts\/queue\.mjs --clear/u.test(r.out), "a pull request that changes the queue and leaves the line of a closed issue fails, saying the mend, in the core by its own path", r.out);
ok(/run node core\/scripts\/queue\.mjs --clear/u.test(command("--check", { ...at, project: "core/" }).out), "and in a project by its copy's (Codex's finding on #757)");
ok(/run node lib\/core\/scripts\/queue\.mjs --clear/u.test(command("--check", { ...at, project: "lib/core/" }).out) && fileAt(slot("lib/core/QUEUE.md"), [], "lib/core/") === null && fileAt(slot("docs/PLAN.md"), [], "lib/core/") === "docs/PLAN.md" && fileAt(slot("lib/core-manifest.md"), [], "lib/") === null && fileAt(slot("Lib/x.md"), [], "lib/") === null, "a copy the manifest places elsewhere is read where it stands: its mend names its path, and the progress file is never inside it, nor inside the library that carries it (Codex's review of c2c351c; the fallback reviewer's check of 3c0720b)");
r = command("--clear", at);
ok(r.status === 0 && /took out the lines of #10/u.test(r.out) && file === cleared(queue, closed) && command("--check", at).status === 0, "--clear writes the queue without them, and the check then passes", r.out);
for (const bad of [command("--other", at), command(undefined, { ...at, read: () => null })]) ok(bad.status === 1 && mended(bad.out), "an option it does not know, or no queue where it runs, fails, saying the mend", bad.out);

// the issues a line names first, read whole in every spelling, a row's and an item's (the fallback reviewer's second
// check of #757's fixes): with #13 and #15 open, no line of theirs goes
const spelled = ["| #12-#14 | b | |", "| #12\u2013#20 | b | |", "| #12..#20 | b | |", "| #12 through #20 | b | |", "| #12 to 20 | b | |", "| #12 up to #20 | b | |", "| #5 to #3 | b | |", "| #12 (with #13) | b | |", "- #12 and #13: x", "* [x] #12/#13 y", "- #12-#15 y"].join("\n") + "\n";
const two13 = n => n !== 13 && n !== 15;
ok(cleared(spelled, two13) === spelled && linesOf(spelled).length === 11 && cleared("- #12, waits on #13\n", two13) === "", "a range in any spelling, or a second issue in a row or an item, is read, and --clear takes out no line of an open issue; what an item waits on is not its issue", cleared(spelled, two13));
ok(cleared("| #593, points 6, 7 widened, 10 and 11 | b | |\n| #12 | b | |\n- #14 build it, waits on #12\n", n => n !== 99) === "", "a row's points, and an item's words, keep no line of issues all closed");
ok(["docs/threat-model.md", "CLAUDE.local.md", "AGENTS.override.md", "docs/.agents/x.md", "a/.agent/x.md", "x/.kiro/y.md"].every(at => fileAt(slot(at)) === null) && fileAt(slot("docs/RULES-x.md"), ["docs/RULES-x.md"]) === null && fileAt(slot("docs/PLAN.md"), ["docs/RULES-x.md"]) === "docs/PLAN.md",
  "every file floor rule 3 protects by its name, and each rule file the project's SECURITY.md adds, is refused as the progress file");
const asked1 = [], answers = { 7: { status: 0, stdout: '{"number":7,"state":"closed"}' }, 8: { status: 0, stdout: '{"number":8,"state":"open"}' }, 9: { status: 1, stdout: '{"message":"Not Found"}' }, 10: { status: 1, stdout: "" }, 11: { status: 0, stdout: '{"number":12,"state":"closed"}' } };
const one = n => closedAt("o/r", n, route => { asked1.push(route); return answers[n]; });
ok(one(7) && !one(8) && one(9) && asked1[0] === "repos/o/r/issues/7", "one issue is read alone: closed, open, or not there, which counts closed");
ok((() => { try { one(10); return false; } catch { return true; } })() && (() => { try { one(11); return false; } catch { return true; } })(), "an answer that is no issue with its state, or another's, throws, never guessing");
let wrote = null;
r = command("--clear", { file: "Q.md", read: () => "| #7 | b | |\n| #8 | b | |\n| #20 | b | |\n", write: t => { wrote = t; }, closed: () => n => n !== 20, confirm: n => n === 7 });
ok(r.status === 0 && wrote === "| #8 | b | |\n| #20 | b | |\n", "--clear takes out a line only once each of its issues, read alone, has closed: one the list missed stays", wrote);

// the fallback reviewer's third check of #757's fixes: a kept line of closed issues, a numbered item, a wrapped one,
// what --clear says, a deleted issue, and a bare number joined to an issue
const keptShut = "| #502, the first half | builder | |\n| #503 | builder | |\n";
ok(read(keptShut, n => n === 502).next?.issues[0] === 503 && read(keptShut, n => n === 502).stale.length === 1 && mended(command("--check", { file: "Q.md", read: () => keptShut, closed: () => n => n === 502 }).out) && /first half/u.test(command("--check", { file: "Q.md", read: () => keptShut, closed: () => n => n === 502 }).out),
  "a line kept, its issues read all closed, is never next, and the check names it, to be taken out by hand");
ok(cleared("| #502, case 1, step 2 | b | |\n", n => n === 502) === "", "a row's cases and steps, as its points, keep no line of an issue closed");
const numbered = "1. #20 the menu\n2) #21 the sound\n+ #22 the save\n";
ok(linesOf(numbered).map(l => l.issues[0]).join() === "20,21,22" && cleared(numbered, n => n === 21) === "1. #20 the menu\n+ #22 the save\n", "a numbered item, and one bulleted with +, is a line, as the starter kit's progress file writes them");
const wraps = "- #12 the menu, with\n  #13 the sound\n- #14 the save, waits\n  on #15\n  - a note under it\n  - #16 a part of its own\n- #17 x\n";
ok(cleared(wraps, n => n === 12) === wraps && cleared(wraps, n => n === 12 || n === 13) === wraps.replace("- #12 the menu, with\n  #13 the sound\n", "") && linesOf(wraps)[1].waits.join() === "15" && cleared(wraps, n => n === 14) === "- #12 the menu, with\n  #13 the sound\n  - #16 a part of its own\n- #17 x\n",
  "an item wrapped onto the lines after it is read and cleared whole, the items under it leaving with it, one that names an issue of its own staying", cleared(wraps, n => n === 14));
r = command("--clear", { file: "Q.md", read: () => "| #7 | b | |\n| #8 | b | |\n| #9 | b | |\n", write: () => {}, closed: () => n => n !== 9, confirm: n => n === 7 });
ok(/lines of #7, closed$/u.test(r.out), "--clear says it took out only the lines it took out", r.out);
ok(closedAt("o/r", 5, () => ({ status: 1, stdout: '{"message":"This issue was deleted"}' })), "a deleted issue counts closed, as one not there does");
ok(cleared("- #12, 13 and 14: parts\n- #12/13 x\n- #12 & 13\n| #12\u2212#14 | b | |\n", n => n !== 13).split("\n").length === 5 && fileAt(slot("docs/r.md"), ["docs/R.md"]) === null, "a bare number joined to an issue is read as one, a minus sign joins a range, and a project's rule file is refused whatever its letters' case");

const under = "- #12 the menu\n  - then #16, the sound\n  - **#17** bold\n  - [#18](u) link\n  - a note\n- #14 the save\n  - a note, with\n    #18 the load\n\t- tabbed, of #14\n- #19 x\n";
ok(cleared(under, n => n === 12) === under.replace("- #12 the menu\n", "") && cleared(under, n => n === 14) === under.replace("- #14 the save\n  - a note, with\n", "") && cleared("- #12 a\n\t- a note\n- #13 b\n", n => n === 12) === "- #13 b\n",
  "a line under an item that names an issue anywhere ends its span and stays; a tab counts as an indent (the fallback reviewer's check of 5d45e56)");
ok(cleared("\t- #12 a\n\t- a sibling\n\t\t- under it\n- #13 b\n", n => n === 12) === "\t- a sibling\n\t\t- under it\n- #13 b\n", "a tab counts four in an item's own indent as in the lines under it, so a tab-indented sibling stays (the fallback reviewer's check of c2c351c)");
ok(cleared("- #12\u2212#14 x\n- #12\u2010#14 y\n", n => n !== 13) === "- #12\u2212#14 x\n- #12\u2010#14 y\n", "a minus sign or a hyphen of Unicode joins a range, in an item too");
const big = "| #1 | b | |\n".repeat(20000) + "| #2 | b | |\n";
linesOf(big);
ok(linesOf(big).length === 20001, "a long file is read line by line, its text split once");

// a queue that leads outside through a link: in the core, the mend names the core's own file, not a manifest it lacks
const here = process.cwd(), scratch = scratchDir("queue-");
fs.writeFileSync(path.join(scratch, "elsewhere.md"), "| #1 | builder | |\n");
fs.mkdirSync(path.join(scratch, "repo"));
fs.symlinkSync(path.join(scratch, "elsewhere.md"), path.join(scratch, "repo", "QUEUE.md"));
process.chdir(path.join(scratch, "repo"));
fs.writeFileSync(path.join(scratch, "repo", "AGENTS.md"), "rules\n");
fs.symlinkSync("../AGENTS.md", path.join(scratch, "repo", "inside.md"));
fs.mkdirSync(path.join(scratch, "repo", ".github"));
fs.symlinkSync(".github", path.join(scratch, "repo", "docs"));
try {
  const core = unplaced(false, "QUEUE.md"), project = unplaced(true, "QUEUE.md");
  ok(mended(unplaced(true, "inside.md")) && mended(unplaced(true, "docs/PROGRESS.md")) && unplaced(true, "plain.md") === null, "a progress file reached through a link inside the project, to a protected file or through a linked folder, is refused (the fallback reviewer's second check of #757's fixes)");
  ok(mended(core) && /make QUEUE\.md a plain file/u.test(core) && !/manifest/u.test(core) && mended(project) && /manifest/u.test(project), "a queue reached through a link fails, its mend in the core naming QUEUE.md and in a project the manifest's row (the fallback reviewer's finding on #757's fixes)", core);
} finally { process.chdir(here); fs.rmSync(scratch, { recursive: true, force: true }); }

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the queue's reader`);
process.exit(failed ? 1 : 0);
