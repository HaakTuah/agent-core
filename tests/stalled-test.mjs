// Tests of the stalled lanes (stalled.mjs): which open pull requests count as lanes, how long each has waited, the
// order, the states a way reports, and the printed lines. Node's own modules only; the calls to git and gh are the
// program's own and are not made here.
//
//   node tests/stalled-test.mjs
import { goesOn, handedOff, MERGES_SKIPPED, namesNext, NOTICE, openPulls, print, readStates, reported, stalled, standingStill, statesIn } from "../scripts/stalled.mjs";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";

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
ok(print(stalled([p(9, "item/x\u001b[2J", "2026-11-13T10:19:00Z")], now, 3), 2, 3) === "Stalled, no push for over 3 h: 1 of 2 open\n  #9 item/x [2J: 9.0 h since 2026-11-13T10:19:00Z (t9); no hand-off note; its newest commit names no next step", "a stalled lane's line, with its control characters taken out", print(stalled([p(9, "item/x\u001b[2J", "2026-11-13T10:19:00Z")], now, 3), 2, 3));

// The hand-off note (tasks/tools.md, "A change of tool loses nothing"; #306): a lane whose description holds one is not
// marked, in each form a line may open it; one that only names it in a sentence, or holds no description, is.
const noted = body => print(stalled([{ ...p(7, "lane/noted", "2026-11-13T10:19:00Z"), body }], now, 3), 1, 3);
for (const body of ["Hand-off: done a; next b", "x\n**Hand-off:** done a", "## Hand-off: done", "- Hand-off: done"]) ok(!noted(body).includes("no hand-off note"), `a lane with a hand-off note is not marked: ${JSON.stringify(body)}`, noted(body));
for (const body of ["It has no Hand-off: here", "", undefined, 42]) ok(noted(body).endsWith("(t7); no hand-off note; its newest commit names no next step"), `a lane with none is marked: ${JSON.stringify(body)}`, noted(body));
ok(handedOff("a\nHand-off: b") && !handedOff("hand-off: b"), "the note's line is \"Hand-off:\", as written");

// The next step a commit names (tasks/tools.md, "Each pushed commit names its next step"; #1505, point 1): a lane whose
// newest commit's message holds a line "Next:" that names something is not marked; one with none, or an empty one, is.
const next = message => print(stalled([{ ...p(8, "lane/next", "2026-11-13T10:19:00Z"), body: "Hand-off: done a", message }], now, 3), 1, 3);
for (const message of ["Write the rule\n\nNext: the reviews", "Next: the merge\n\nCo-Authored-By: a session"]) ok(next(message).endsWith("(t8)"), `a lane whose newest commit names its next step is not marked: ${JSON.stringify(message)}`, next(message));
for (const message of ["Write the rule", "Write the rule\nNext:", "Write it. Next: the reviews", "next: the reviews", "", undefined]) ok(next(message).endsWith("(t8); its newest commit names no next step"), `a lane whose newest commit names none is marked: ${JSON.stringify(message)}`, next(message));
ok(namesNext("a\nNext: b") && !namesNext("a\nNext:  ") && !namesNext(null), "the step's line is \"Next:\" with something after it");

// ---- the states a way reports (tasks/ways.md, "A session's state is read where the way gives it"; #397) ----
// (a lane given a state, by its number or its branch, is printed by it and never judged by the clock; the rest are)
const lanes = [p(1, "item/balance", "2026-11-13T10:09:00Z"), p(3, "lane/old", "2026-11-12T19:19:00Z"), p(8, "lane/quiet", "2026-11-13T09:00:00Z"), p(5, "patch-1", "2026-11-01T00:00:00Z", false)];
const states = readStates(JSON.stringify({ 3: "working", "lane/quiet": "waiting", "patch-1": "blocked" }));
ok(stalled(lanes, now, 3, states).map(l => l.number).join() === "1" && reported(lanes, states).map(l => `${l.number}:${l.state}`).join() === "3:working,8:waiting",
  "a lane whose state the way reports is never judged by the clock, by its number or its branch; a fork's is no lane", JSON.stringify(reported(lanes, states)));
const shown = print(stalled(lanes, now, 3, states), 4, 3, reported(lanes, states));
ok(shown.includes("Stalled, no push for over 3 h: 1 of 4 open\n  #1 ") && shown.includes("As the way reports, not judged by the clock: 2 of 4 open\n  #3 lane/old: working (t3)\n  #8 lane/quiet: waiting (t8)"), "the lanes given a state are printed by it, after those the clock judged", shown);
ok(print([], 2, 3, reported([p(3, "lane/old", "2026-11-12T19:19:00Z")], states)).startsWith("No lane stalled: 2 open, none of the rest without a push"), "with none stalled, the lanes given a state are still printed");
ok(stalled(lanes, now, 3).length === 3 && stalled(lanes, now, 3, null).length === 3 && reported(lanes, null).length === 0, "with no states given, every lane is judged by the clock, as before");
for (const bad of ["{", "[]", "null", JSON.stringify({ 3: "running" }), JSON.stringify({ 3: ["working"] }), "[".repeat(300) + "]".repeat(300), " ".repeat((1 << 20) + 1), undefined]) {
  const r = readStates(bad);
  ok(r.problem && mended(`FAIL: ${r.problem}`), `states in no form read here are refused, saying the mend: ${JSON.stringify(bad)?.slice(0, 40)}`, r.problem);
}
const missing = statesIn(fileURLToPath(new URL("./no-such-states.json", import.meta.url)));
ok(missing.problem && mended(`FAIL: ${missing.problem}`) && statesIn(fileURLToPath(new URL(".", import.meta.url))).problem && statesIn(undefined).problem, "a states file that cannot be read, a folder or none, is refused, saying the mend", missing.problem);

// ---- the work standing still (#471): the progress file's next line, no push of the repository's own for a day, no notice ----
const queue = "| Issue | Who | Waits on |\n| --- | --- | --- |\n| #11 | builder | |\n| #14 | the owner | |\n| #13 | rule builder | #12 |\n| #15 | builder | on hold |\n| #12 | builder | |\n| #16 | rule builder; it changes the floor | |\n";
const closed = n => n === 11, old = { own: true, at: "2026-11-12T08:00:00Z" }, fresh = { own: true, at: "2026-11-13T15:00:00Z" }, fork = { own: false, at: "2026-11-13T18:00:00Z" };
ok(JSON.stringify(standingStill({ queue, closed, pulls: [old, fork], notices: [], now })) === "[12]", "the first line a session could take is reported, where no pull request of the repository's own was pushed in a day (a fork's push counts for nothing): a closed issue's line, one held for the owner, one waiting on an open issue and one on hold are passed over", JSON.stringify(standingStill({ queue, closed, pulls: [old, fork], notices: [], now })));
ok(standingStill({ queue, closed, pulls: [old, fresh], notices: [], now }) === null, "a push of the repository's own in the last day: the work goes on, nothing is reported");
ok(standingStill({ queue, closed, pulls: [], notices: [`${NOTICE} until the window opens on Friday`], now }) === null, "an open notice of the orchestrator's says why: nothing is reported");
ok(standingStill({ queue: "| #13 | builder | #12 |\n| #14 | the owner | |\n| #11 | builder | |\n", closed, pulls: [], notices: [], now }) === null, "no line a session could take, a closed issue's among them: nothing is reported");
ok(JSON.stringify(standingStill({ queue: "| #13 | builder | #11 |\n", closed, pulls: [], notices: [], now })) === "[13]", "a line whose wait has closed can be taken");

ok(standingStill({ queue, closed, pulls: [old], notices: [], now, latest: "2026-11-13T12:00:00Z" }) === null && goesOn({ pulls: [], latest: "2026-11-13T12:00:00Z", now }) && !goesOn({ pulls: [fork], latest: "2026-11-12T08:00:00Z", now }) && !goesOn({ pulls: [{ own: true, at: "not a time" }], now }), "a commit on the default branch in the last day is work going on; a fork's push, an older commit and a time that is no time are not");

// The open pull requests as `openPulls` reads them, through a fake `api` that answers a route as the host does.
{
  const repo = "o/r", sha = n => String(n).padStart(40, "0"), row = `[7,"t","lane/x","${sha(1)}","o/r",false,"",[]]`;
  const pullsOf = commits => openPulls(repo, route => route.includes("/pulls?") ? row : commits[route.split("/commits/")[1]] ?? "");
  let got = pullsOf({ [sha(1)]: "2026-11-27T10:00:00Z\nWrite x\n\nNext: y\n" })[0];
  ok(got.at === "2026-11-27T10:00:00Z" && got.message === "Write x\n\nNext: y\n" && namesNext(got.message), "a pull request's newest commit: its time, and its whole message, not its first line");
  got = pullsOf({ [sha(1)]: "2026-11-27T12:00:00Z 2 " + sha(2) + "\nMerge main into lane", [sha(2)]: "2026-11-27T10:00:00Z 1 " + sha(3) + "\nWrite x\n\nNext: y" })[0];
  ok(got.at === "2026-11-27T12:00:00Z" && namesNext(got.message) && got.message.startsWith("Write x"), "a merge of the base as the newest commit: its time stands, the message is the newest commit's that is no merge", JSON.stringify(got));
  const chain = { [sha(1)]: "2026-11-27T12:00:00Z 2 " + sha(2) + "\nMerge" };
  for (let i = 2; i <= MERGES_SKIPPED + 2; i++) chain[sha(i)] = `2026-11-27T12:00:00Z 2 ${sha(i + 1)}\nMerge`;
  ok(!namesNext(pullsOf(chain)[0].message), "a long run of merges is stepped back over only so far, and names no step");
}

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
