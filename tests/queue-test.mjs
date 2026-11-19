// Tests of the queue's reader (scripts/queue.mjs; AGENTS.md, "The queue"; #750, point 1): a line whose issue has
// closed is skipped, waited on no more, cleared together by the next pull request that changes the queue, and fails
// that pull request while it stands; a project's progress file, a list, read the same way. Node's own modules only; GitHub and the file stand in as functions.
//
//   node tests/queue-test.mjs
import { mended } from "../scripts/mend.mjs";
import { LARGEST, cleared, command, fileAt, linesOf, read, statesOf } from "../scripts/queue.mjs";

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
ok(linesOf("| #679 to #682 | builder | |\n")[0].issues.join() === "679,680,681,682" && linesOf("| #1 to #500 | builder | |\n")[0].issues.join() === "1,500" && read("| #679 to #682 | builder | |\n", n => n !== 681).gone.length === 0, "a range of issues is read whole, and its line stays while one of them is open; one past a hundred wide names its two ends");
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
ok(command(undefined, { file: "Q.md", read: () => "x".repeat(LARGEST + 1), closed: () => () => false }).status === 1 && mended(command(undefined, { file: "Q.md", read: () => "x".repeat(LARGEST + 1), closed: () => () => false }).out), "a progress file past the largest the reader takes is refused, saying the mend");

// the command, in this process, with the file and GitHub standing in
let file = queue, answer = page([open(11), open(12), open(13), open(14)]);
const at = { read: () => file, write: text => { file = text; }, closed: () => statesOf("o/r", () => { if (answer === null) throw new Error("no answer"); return answer; }) };
let r = command(undefined, at);
ok(r.status === 0 && !/^\| #10 /mu.test(r.out) && /^\| #11, point 2 /mu.test(r.out) && /4 open lines, 1 of closed issues skipped \(#10\)/u.test(r.out) && /next: #11/u.test(r.out), "the reader prints the open lines and the next", r.out);
r = command("--check", at);
ok(r.status === 1 && mended(r.out) && /closed: #10/u.test(r.out) && /--clear/u.test(r.out), "a pull request that changes the queue and leaves the line of a closed issue fails, saying the mend", r.out);
r = command("--clear", at);
ok(r.status === 0 && /took out the lines of #10/u.test(r.out) && file === cleared(queue, closed) && command("--check", at).status === 0, "--clear writes the queue without them, and the check then passes", r.out);
answer = null;
r = command("--check", at);
ok(r.status === 1 && mended(r.out) && /could not be read: no answer/u.test(r.out), "where an issue cannot be read, the check fails, saying the mend", r.out);
for (const bad of [command("--other", at), command(undefined, { ...at, read: () => null })]) ok(bad.status === 1 && mended(bad.out), "an option it does not know, or no queue where it runs, fails, saying the mend", bad.out);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the queue's reader`);
process.exit(failed ? 1 : 0);
