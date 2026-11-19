// Tests of the queue's reader (scripts/queue.mjs; AGENTS.md, "The queue"; #750, point 1): a line whose issue has
// closed is skipped, waited on no more, cleared together by the next pull request that changes the queue, and fails
// that pull request while it stands. Node's own modules only; GitHub and the file stand in as functions.
//
//   node tests/queue-test.mjs
import { mended } from "../scripts/mend.mjs";
import { cleared, command, linesOf, read, statesOf } from "../scripts/queue.mjs";

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

const lines = linesOf(queue);
ok(lines.map(l => l.issue).join() === "10,11,12,13,14" && lines[1].waits.join() === "10" && lines[2].waits.join() === "9,13" && lines[0].waits.length === 0 && lines[4].words === "on hold", "each row of the table is a line, its issue the first it names, what it waits on read from its last cell");
let got = read(queue, closed);
ok(got.open.map(l => l.issue).join() === "11,12,13,14" && got.gone.map(l => l.issue).join() === "10", "the line of a closed issue is skipped, the others kept in order");
ok(got.next?.issue === 11, "a line that waits only on what has closed waits on nothing: it is next", JSON.stringify(got.next));
ok(read(queue, n => n === 10 || n === 11).next?.issue === 13 && read(queue, () => false).next?.issue === 10, "one that waits on an open issue is passed over; with nothing closed, the first that waits on nothing is next");
ok(read(queue.replace("| #13 | builder | |", "| #13 | builder | the owner's word |"), n => [10, 11, 12].includes(n)).next === null, "a line that waits on words naming no issue still waits");
const after = cleared(queue, closed);
ok(after === queue.replace("| #10 | rule builder | |\n", ""), "clearing takes out the line of each closed issue and changes nothing else");
ok(cleared(queue, () => false) === queue && cleared(queue.replace(/\n/gu, "\r\n"), closed).includes("| #11, point 2 | builder | #10 |\r\n"), "with nothing closed it changes nothing, and keeps the file's line endings");

const asked = [];
const states = statesOf([10, 11, 10, 12], "o/r", route => { asked.push(route); return route.endsWith("/10") ? "closed" : "open"; });
ok(states(10) && !states(11) && !states(99) && asked.length === 3 && asked[0] === "repos/o/r/issues/10", "each issue's state is asked of GitHub once");
let threw = false; try { statesOf([1], "o/r", () => { throw new Error("no network"); }); } catch { threw = true; }
ok(threw, "where GitHub cannot answer, the reading throws, never guessing");

// the command, in this process, with the file and GitHub standing in
let file = queue;
const at = { read: () => file, write: text => { file = text; }, closed: numbers => statesOf(numbers, "o/r", route => (/\/(?:10|9)$/u.test(route) ? "closed" : route.endsWith("/77") ? (() => { throw new Error("no answer"); })() : "open")) };
let r = command(undefined, at);
ok(r.status === 0 && !/^\| #10 /mu.test(r.out) && /^\| #11, point 2 /mu.test(r.out) && /4 open lines, 1 of closed issues skipped \(#10\)/u.test(r.out) && /next: #11/u.test(r.out), "the reader prints the open lines and the next", r.out);
r = command("--check", at);
ok(r.status === 1 && mended(r.out) && /closed: #10/u.test(r.out) && /--clear/u.test(r.out), "a pull request that changes the queue and leaves the line of a closed issue fails, saying the mend", r.out);
r = command("--clear", at);
ok(r.status === 0 && /took out the lines of #10/u.test(r.out) && file === cleared(queue, closed) && command("--check", at).status === 0, "--clear writes the queue without them, and the check then passes", r.out);
file = `${queue}| #77 | builder | |\n`;
r = command("--check", at);
ok(r.status === 1 && mended(r.out) && /could not be read: no answer/u.test(r.out), "where an issue cannot be read, the check fails, saying the mend", r.out);
for (const bad of [command("--other", at), command(undefined, { ...at, read: () => null })]) ok(bad.status === 1 && mended(bad.out), "an option it does not know, or no queue where it runs, fails, saying the mend", bad.out);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the queue's reader`);
process.exit(failed ? 1 : 0);
