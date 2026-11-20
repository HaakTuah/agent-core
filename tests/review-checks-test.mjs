// Tests of the count of how often the host's checks sent a pull request's work back (review-checks.mjs, which
// review-record.mjs prints; #900): which check run is a failure, which commit is a pull request's head, which commits
// count as heads the checks ran on, a pull request that could not be read, the counts by kind and the lines printed.
// Node's own modules only; the calls to gh are the program's own and are not made here. Test data is made up.
//
//   node tests/review-checks-test.mjs
import { KINDS } from "../scripts/review-record.mjs";
import { LAST } from "../scripts/review-rounds.mjs";
import { checksLines, checksOn, checksRead, failedOn, headOf, runsReader, tally } from "../scripts/review-checks.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const sha = c => c.repeat(40);
const commit = (c, ...parents) => ({ sha: sha(c), parents: parents.map(p => ({ sha: p.length === 1 ? sha(p) : p })) });
const run = conclusion => ({ conclusion });
// a pull request: a, b, c, each on the one before; the check runs of each commit by letter
const COMMITS = [commit("a", "0"), commit("b", "a"), commit("c", "b")];
const runsBy = by => s => by[s[0]] ?? [];

ok(failedOn([run("success"), run("failure")]) && failedOn([run("timed_out")]) && failedOn([run("startup_failure")]) && failedOn([null, run("failure")]),
  "a check run that failed, timed out or did not start is a failure");
ok(!failedOn([]) && !failedOn([run("success"), run("cancelled"), run("skipped"), run("neutral"), run(null), run("action_required"), run("stale")]),
  "none, a run that passed, was cancelled by a later push, skipped, is neutral or still running is no failure");

ok(headOf(COMMITS) === sha("c") && headOf([COMMITS[2], COMMITS[0], COMMITS[1]]) === sha("c"), "the head is the commit no other has as a parent, whatever the order");
ok(headOf([commit("a", "0"), commit("b", "0"), commit("c", "0")]) === sha("c") && headOf([commit("a", "0"), commit("b", "0")]) === sha("b") && headOf([]) === null, "where there are two tips, or none, the last commit is the head; no commit has no head");
ok(headOf([commit("a", "0"), commit("e", "a", "f".repeat(40)), commit("b", "e")]) === sha("b"), "an update from the default branch (a merge with a parent outside the pull request) is no tip");

ok(same(checksOn(COMMITS, runsBy({ a: [run("failure")], b: [run("success")], c: [run("success")] })), { heads: 2, failed: 1 }),
  "a head whose check failed and was then changed counts; the last commit's checks are never read");
ok(same(checksOn(COMMITS, runsBy({ a: [run("success")], b: [run("success")], c: [run("failure")] })), { heads: 2, failed: 0 }),
  "a failure on the last commit, which no commit changed, is not counted");
ok(same(checksOn(COMMITS, runsBy({ b: [run("failure"), run("success")] })), { heads: 1, failed: 1 }),
  "a commit that no check ran on, pushed with the one after it, is no head; a run that failed among others counts the head once");
ok(same(checksOn(COMMITS, runsBy({ a: [run("failure")], b: [run("failure")] })), { heads: 2, failed: 2 }), "each failed head counts");
ok(same(checksOn([commit("a", "0")], () => { throw new Error("read"); }), { heads: 0, failed: 0 }), "a pull request of one commit has no head that was changed");
ok(checksOn(null, runsBy({})) === null && checksOn(COMMITS, s => (s === sha("b") ? null : [run("success")])) === null,
  "a pull request whose commits cannot be read, or one commit's check runs, is not read, never none");

// the pull requests read: the last LAST counted, newest first, each with its commits from a Map, its kind kept
const counted = Array.from({ length: LAST + 5 }, (_, i) => ({ number: 100 - i, kind: i % 2 ? "sync" : "own" }));
const read = checksRead(counted, new Map([[100, COMMITS], [99, null], [98, COMMITS]]), runsBy({ a: [run("failure")] }));
ok(read.length === LAST && read[0].kind === "own" && read[1].kind === "sync" && same(read[0].checks, { heads: 1, failed: 1 }) && read[1].checks === null && same(read[2].checks, { heads: 1, failed: 1 }) && read[3].checks === null,
  "the last LAST pull requests counted are read, each by its own commits and kind, and one with no commits read is not read");

const pulls = [
  { kind: "own", checks: { heads: 3, failed: 1 } }, { kind: "own", checks: { heads: 1, failed: 0 } }, { kind: "own", checks: null },
  { kind: "sync", checks: { heads: 2, failed: 2 } }, { kind: "own", checks: { heads: 2, failed: 2 } },
];
const t = tally(pulls, KINDS);
ok(same(t.own, { merged: 4, read: 3, heads: 6, failed: 3, sent: 2 }) && same(t.sync, { merged: 1, read: 1, heads: 2, failed: 2, sent: 1 }) && same(t.upkeep, { merged: 0, read: 0, heads: 0, failed: 0, sent: 0 }),
  "the counts by kind: read, heads, failed heads, and the pull requests with one (sent back); one not read is in none but its merged count");
const text = checksLines(pulls, KINDS);
ok(text.includes("| own | 4 | 3 | 1 | 6 | 3 | 2 |") || /own\s+4\s+3\s+1\s+6\s+3\s+2/.test(text), "the table gives each kind's row", text);
ok(text.includes("Sent back by the host's checks: 3 of the 4 pull requests read (5 heads failed of 8 checked).") && /upkeep\s+-\s+-/.test(text) && text.includes("A count: nothing fails or waits for it."),
  "the totals are said, a kind with no pull request reads as dashes, and the count says nothing fails for it", text);
const [intro, ...table] = text.split("\n").slice(1);
ok(table[0].trim().split(/\s{2,}/).join("|") === "merged|read|not read|heads checked|heads failed|sent back" && table[0].includes("heads checked") && table[0].includes("heads failed") && table[0].includes("sent back") && table[0].includes("not read") && table.length === 6 && intro.startsWith("The host's checks:"),
  "the table has its columns, a header and a row for each kind, each on a line of its own", text);
const asked = [];
const reader = runsReader("some/repo", (path, jq) => { asked.push([path, jq]); if (path.includes("bad")) throw new Error("no answer"); return [{ conclusion: "failure" }]; });
ok(same(reader("abc"), [{ conclusion: "failure" }]) && asked[0][0] === "repos/some/repo/commits/abc/check-runs?filter=latest" && asked[0][1].includes(".check_runs[]") && reader("bad") === null,
  "a commit's check runs are read from the host's route for it, the newest of each check, and null where it gives none", JSON.stringify(asked));
ok(checksLines([{ kind: "own", checks: null }], KINDS).split("\n").at(-1) === "Read on no pull request." && checksLines([{ kind: "own", checks: null }], KINDS).split("\n").length === 3 && !checksLines([], KINDS).includes("sent back"), "where none was read, it says so and prints no table");

console.log(failed ? `\n${failed} of ${count} FAILED` : `\n${count} of ${count} passed`);
process.exit(failed ? 1 : 0);
