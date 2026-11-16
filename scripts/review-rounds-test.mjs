// Tests of the count of the rounds of review (review-rounds.mjs, and the heads review-record.mjs reads from the
// comments; #477): a round a head, an update from the default branch counted with the commit before it, a review asked
// read at the head of its time, the rounds that found something blocking, and the lines printed. Node's own modules
// only; the calls to gh are the program's own and are not made here. Test data is made up.
//
//   node scripts/review-rounds-test.mjs
import { reviewEvents } from "./review-record.mjs";
import { commitOf, headAt, median, roundsLines, roundsOf, wanted } from "./review-rounds.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const OWNER = "some-owner", CODEX = "chatgpt-codex-connector[bot]";
const sha = c => c.repeat(40);
const at = minute => `2026-11-16T18:${String(minute).padStart(2, "0")}:00Z`;
// a pull request's commits: a, b, then m (an update from main onto b: its second parent no commit of the pull request's),
// then c, and n (an update from main onto c)
const commit = (c, minute, ...parents) => ({ sha: sha(c), at: at(minute), parents: parents.map(p => ({ sha: p.length === 1 ? sha(p) : p })) });
const COMMITS = [commit("a", 0, "0"), commit("b", 10, "a"), commit("e", 15, "b", "f".repeat(40)), commit("c", 20, "e"), commit("d", 25, "c", "9".repeat(40))];
const issue = (login, body, minute) => ({ user: { login, type: login.endsWith("[bot]") ? "Bot" : "User" }, body, at: at(minute) });
const asked = minute => issue(OWNER, "From a builder session, on #1:\n\n@codex review\n", minute);
const posted = (c, blocking, minute) => issue(OWNER, `Security review: ${sha(c)}\n\n${blocking ? `Blocking findings: ${blocking}.` : "No blocking finding."}\nNo other finding.`, minute);
const find = (p, c) => ({ user: { login: CODEX, type: "Bot" }, body: `**<sub><sub>![${p} Badge](https://img.shields.io/badge/${p}-orange?style=flat)</sub></sub> A point**`, in_reply_to_id: null, original_commit_id: sha(c), commit_id: sha("d"), at: at(59) });

ok(commitOf(COMMITS, sha("b")) === sha("b") && commitOf(COMMITS, "bbbbbbb") === sha("b") && commitOf(COMMITS, "bbbbbb") === null && commitOf(COMMITS, sha("7")) === null && commitOf(COMMITS, undefined) === null,
  "a commit is named by its whole SHA or one of seven characters or more that one commit alone starts with");
ok(headAt([commit("a", 5, "0"), commit("b", 5, "a")], at(6)) === sha("b") && headAt(COMMITS, at(12)) === sha("b") && headAt(COMMITS, at(20)) === sha("c") && headAt(COMMITS, "2026-11-16T17:00:00Z") === null,
  "a review asked is read at the commit made last by its time, the later of two made in one second; one before any commit at none");
ok(same(roundsOf([], COMMITS), { rounds: 0, blocking: 0 }), "no review asked or posted is no round");
ok(same(roundsOf([{ at: at(1) }, { at: at(11) }, { sha: sha("e") }, { at: at(16) }, { sha: sha("c") }, { sha: sha("d") }], COMMITS), { rounds: 3, blocking: 0 }),
  "each head a review was asked or posted on is a round, and an update from main counts with the commit before it");
ok(same(roundsOf([{ at: at(1), blocking: true }, { sha: sha("a"), blocking: false }, { sha: sha("e"), blocking: true }, { sha: sha("c") }], COMMITS), { rounds: 3, blocking: 2 }),
  "a round blocks where any review on it found something blocking, its update from main among them");
ok(same(roundsOf([{ sha: sha("7"), at: at(21) }, { sha: "not a sha" }], COMMITS), { rounds: 1, blocking: 0 }),
  "a commit named that is none of the pull request's is read at its time, and one with no time is left out");
// a merge whose second parent is a commit of the pull request's is no update from main: a round of its own
const own = [commit("a", 0, "0"), commit("b", 5, "0"), commit("e", 10, "a", "b")];
ok(same(roundsOf([{ sha: sha("a") }, { sha: sha("e") }], own), { rounds: 2, blocking: 0 }), "a merge of the pull request's own commits is a round of its own");

// what review-record.mjs reads from the comments
const events = reviewEvents([
  asked(11), posted("e", 1, 16), posted("c", 0, 21),
  issue(OWNER, "Security review: none needed for this change.", 22),
  issue(OWNER, "> @codex review", 23),
  issue("someone-else", "@codex review", 24),
  issue(OWNER, `Code review: ${sha("d")}\n\nNo blocking finding.\nNo other finding.`, 26),
  issue(CODEX, "<!-- codex-review-receipt:v1 -->\n\nCodex Review: Didn't find any major issues.\n\n**Reviewed commit:** `aaaaaaaaaa`\n", 30),
  issue(OWNER, "From a builder session, on #1:\n\n```\n@codex review\n```", 31),
  issue("someone-else", "<!-- codex-review-receipt:v1 -->\n\n**Reviewed commit:** `bbbbbbbbbb`\n", 32),
], [find("P1", "a"), find("P2", "c")], OWNER);
ok(same(events.map(e => [e.sha ?? null, e.blocking]), [[null, false], [sha("e"), true], [sha("c"), false], [sha("d"), false], ["aaaaaaaaaa", false], [sha("a"), true], [sha("c"), false]]),
  "the heads read: a review asked, each posted review's commit with its blocking count, a receipt of Codex's and each find's own commit; a note, a quote, another account's ask or receipt and an ask in a fence are none",
  JSON.stringify(events));
ok(same(roundsOf(events, COMMITS), { rounds: 3, blocking: 2 }), "the comments of one pull request fold into its rounds");

ok(median([]) === null && median([3]) === 3 && median([4, 1, 8]) === 4 && median([1, 2, 3, 9]) === 2.5, "the median of none is none, of an even count the mean of its middle two");

// the lines: pull requests newest first, 40 merged before the day and 35 from it, the first of them at its midnight
const all = Array.from({ length: 75 }, (_, i) => ({ number: 100 - i, when: i < 34 ? "2026-11-20T10:00:00Z" : i === 34 ? "2026-11-14T00:00:00Z" : "2026-11-01T10:00:00Z" }));
const counted = all.slice(0, 35);
ok(same([...wanted(counted, all, "2026-11-14")].sort((a, b) => b - a), all.slice(0, 65).map(m => m.number)) && wanted(counted.slice(0, 2), all, null).size === 30,
  "the rounds are read of the pull requests counted, the last 30 merged and the 30 merged before the day");
const rounds = new Map(all.map(m => [m.number, { rounds: m.number % 7 === 0 ? 0 : 2, blocking: 0 }]));
rounds.set(100, { rounds: 8, blocking: 2 }); rounds.set(99, { rounds: 5, blocking: 0 }); rounds.set(80, null);
rounds.set(60, { rounds: 9, blocking: 1 }); // (merged before the day: not among the last 30)
rounds.set(90, { rounds: 12, blocking: 0 }); // (older than #100 and #99, with more rounds)
const text = roundsLines(counted, all, "2026-11-14", rounds);
ok(text.includes("counted: median 2 over the 29 on which") && text.includes("- 12 rounds: #90\n- 8 rounds: #100 (2 blocking)\n- 5 rounds: #99\n- 2 rounds: #97, #96,") && !text.includes("- 0 rounds") && text.includes("- no review asked or posted that the count reads: #98, #91, #84, #77, #70")
  && text.includes("- not read (GitHub gave no commits): #80") && text.includes("1 with a round that found something blocking"),
  "each pull request counted is listed by its rounds, with its blocking ones; one with none read and one not read apart", text);
ok(text.includes("- the last 30 merged: median 2 over the 25 on which a review was read; the 30 merged before 2026-11-14, as the last report read them: median 2 over the 26 on which a review was read.")
  && text.includes("- the most rounds among them: #90 12 rounds; #100 8 rounds, 2 blocking; #99 5 rounds; #97 2 rounds; #96 2 rounds."),
  "the median of the last 30 stands beside that of the 30 before the day, and the five that took the most are named", text);
ok(roundsLines(counted, counted, "2026-11-14", rounds).includes("; none merged before 2026-11-14 was read.") && !roundsLines(counted, all, null, rounds).includes("merged before"),
  "with no merge read before the day it says so, and with no day it gives no comparison");
const few = new Map(all.map(m => [m.number, { rounds: m.number === 95 ? 3 : 0, blocking: 0 }]));
ok(roundsLines(counted, all, null, few).endsWith("- the most rounds among them: #95 3 rounds.") && roundsLines(counted, all, null, new Map()).endsWith("- the most rounds among them: none read."),
  "a pull request with no round read is never among the most");

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
