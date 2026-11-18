// Tests of the stalled lanes (stalled.mjs): which open pull requests count as lanes, how long each has waited, the
// order, and the printed lines. Node's own modules only; the calls to git and gh are the program's own and are not made
// here.
//
//   node tests/stalled-test.mjs
import { NOTICE, print, stalled, standingStill } from "../scripts/stalled.mjs";

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
ok(print(stalled([p(9, "item/x\u001b[2J", "2026-11-13T10:19:00Z")], now, 3), 2, 3) === "Stalled, no push for over 3 h: 1 of 2 open\n  #9 item/x [2J: 9.0 h since 2026-11-13T10:19:00Z (t9)", "a stalled lane's line, with its control characters taken out", print(stalled([p(9, "item/x\u001b[2J", "2026-11-13T10:19:00Z")], now, 3), 2, 3));

// ---- the work standing still (#471): lines a session could take, no push of the repository's own for a day, no notice ----
const queue = "| Issue | Who | Waits on |\n| --- | --- | --- |\n| #12 | builder | |\n| #13 | rule builder | #12 |\n| #14 | the owner | on hold |\n| #15 | the owner | |\n| #16 | rule builder; it changes the floor | |\n";
const old = { own: true, at: "2026-11-12T08:00:00Z" }, fresh = { own: true, at: "2026-11-13T15:00:00Z" }, fork = { own: false, at: "2026-11-13T18:00:00Z" };
ok(JSON.stringify(standingStill({ queue, pulls: [old, fork], notices: [], now })) === "[12,16]", "lines that wait on nothing and are not the owner's are reported, where no pull request of the repository's own was pushed in a day (a fork's push counts for nothing)");
ok(standingStill({ queue, pulls: [old, fresh], notices: [], now }) === null, "a push of the repository's own in the last day: the work goes on, nothing is reported");
ok(standingStill({ queue, pulls: [], notices: [`${NOTICE} until the window opens on Friday`], now }) === null, "an open notice of the orchestrator's says why: nothing is reported");
ok(standingStill({ queue: "| #13 | builder | #12 |\n| #15 | the owner | |\n", pulls: [], notices: [], now }) === null, "no line a session could take: nothing is reported");

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
