// Tests of the stalled lanes (stalled.mjs): which open pull requests count as lanes, how long each has waited, the
// order, and the printed lines. Node's own modules only; the calls to git and gh are the program's own and are not made
// here.
//
//   node tests/stalled-test.mjs
import { goesOn, handedOff, NOTICE, print, stalled, standingStill } from "../scripts/stalled.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

const now = Date.parse("2026-11-13T19:19:00Z");
const p = (number, ref, at, own = true) => ({ number, title: `t${number}`, ref, at, own });
const s = stalled([
  p(1, "item/balance", "2026-11-13T10:09:00Z"),
  p(2, "polish/frames", "2026-11-13T18:30:00Z"),
  p(3, "lane/old", "2026-11-12T19:19:00Z"),
  p(4, "dependabot/npm_and_yarn/vite-8", "2026-11-01T00:00:00Z"),
  p(5, "patch-1", "2026-11-01T00:00:00Z", false),
  p(6, "lane/unread", undefined),
], now, 3);
ok(s.map(l => l.number).join() === "3,1", "only lanes past the hours count, oldest first; Dependabot's, a fork's and one with no time read are left out", JSON.stringify(s));
ok(Math.abs(s[1].waited - 9.1667) < 0.001 && s[0].waited === 24, "the wait is the hours since the newest commit");
ok(stalled([p(1, "a", "2026-11-13T16:19:00Z")], now, 3).length === 0 && stalled([p(1, "a", "2026-11-13T16:18:59Z")], now, 3).length === 1, "a lane counts only once it is past the hours");
ok(print([], 4, 3) === "No lane stalled: 4 open, none without a push for over 3 h.", "nothing stalled is one line");
ok(print(stalled([p(9, "item/x\u001b[2J", "2026-11-13T10:19:00Z")], now, 3), 2, 3) === "Stalled, no push for over 3 h: 1 of 2 open\n  #9 item/x [2J: 9.0 h since 2026-11-13T10:19:00Z (t9); no hand-off note", "a stalled lane's line, with its control characters taken out", print(stalled([p(9, "item/x\u001b[2J", "2026-11-13T10:19:00Z")], now, 3), 2, 3));

// The hand-off note (tasks/tools.md, "A change of tool loses nothing"; #306): a lane whose description holds one is not
// marked, in each form a line may open it; one that only names it in a sentence, or holds no description, is.
const noted = body => print(stalled([{ ...p(7, "lane/noted", "2026-11-13T10:19:00Z"), body }], now, 3), 1, 3);
for (const body of ["Hand-off: done a; next b", "x\n**Hand-off:** done a", "## Hand-off: done", "- Hand-off: done"]) ok(!noted(body).includes("no hand-off note"), `a lane with a hand-off note is not marked: ${JSON.stringify(body)}`, noted(body));
for (const body of ["It has no Hand-off: here", "", undefined, 42]) ok(noted(body).endsWith("(t7); no hand-off note"), `a lane with none is marked: ${JSON.stringify(body)}`, noted(body));
ok(handedOff("a\nHand-off: b") && !handedOff("hand-off: b"), "the note's line is \"Hand-off:\", as written");

// ---- the work standing still (#471): the progress file's next line, no push of the repository's own for a day, no notice ----
const queue = "| Issue | Who | Waits on |\n| --- | --- | --- |\n| #11 | builder | |\n| #14 | the owner | |\n| #13 | rule builder | #12 |\n| #15 | builder | on hold |\n| #12 | builder | |\n| #16 | rule builder; it changes the floor | |\n";
const closed = n => n === 11, old = { own: true, at: "2026-11-12T08:00:00Z" }, fresh = { own: true, at: "2026-11-13T15:00:00Z" }, fork = { own: false, at: "2026-11-13T18:00:00Z" };
ok(JSON.stringify(standingStill({ queue, closed, pulls: [old, fork], notices: [], now })) === "[12]", "the first line a session could take is reported, where no pull request of the repository's own was pushed in a day (a fork's push counts for nothing): a closed issue's line, one held for the owner, one waiting on an open issue and one on hold are passed over", JSON.stringify(standingStill({ queue, closed, pulls: [old, fork], notices: [], now })));
ok(standingStill({ queue, closed, pulls: [old, fresh], notices: [], now }) === null, "a push of the repository's own in the last day: the work goes on, nothing is reported");
ok(standingStill({ queue, closed, pulls: [], notices: [`${NOTICE} until the window opens on Friday`], now }) === null, "an open notice of the orchestrator's says why: nothing is reported");
ok(standingStill({ queue: "| #13 | builder | #12 |\n| #14 | the owner | |\n| #11 | builder | |\n", closed, pulls: [], notices: [], now }) === null, "no line a session could take, a closed issue's among them: nothing is reported");
ok(JSON.stringify(standingStill({ queue: "| #13 | builder | #11 |\n", closed, pulls: [], notices: [], now })) === "[13]", "a line whose wait has closed can be taken");

ok(standingStill({ queue, closed, pulls: [old], notices: [], now, latest: "2026-11-13T12:00:00Z" }) === null && goesOn({ pulls: [], latest: "2026-11-13T12:00:00Z", now }) && !goesOn({ pulls: [fork], latest: "2026-11-12T08:00:00Z", now }) && !goesOn({ pulls: [{ own: true, at: "not a time" }], now }), "a commit on the default branch in the last day is work going on; a fork's push, an older commit and a time that is no time are not");

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
