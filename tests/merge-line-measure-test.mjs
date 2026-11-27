// Tests the merge line's measure (scripts/merge-line-measure.mjs; #702, #1345) through a stand-in for gh: each pull
// request's turn the later of the merge before it and its last marking ready, the pushes whose checks ran counted once
// each, the state report's line, and --measure through merge-line.mjs reading the count it is given. Run by the core's
// tests workflow (.github/workflows/tests.yml).
//
//   node tests/merge-line-measure-test.mjs
import { line, measure } from "../scripts/merge-line-measure.mjs";
import { main } from "../scripts/merge-line.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500)}`}`); } };
const at = min => new Date(Date.UTC(2026, 10, 18, 12, min)).toISOString();
const sha = letter => letter.repeat(40);

// The measure: three merged pull requests, oldest first #1, #2, #3 (and #9 into another branch, left out); #2 was
// marked ready after #1 merged, so its turn is its marking ready, as is #3's, marked ready after #2 merged.
const pulls = [
  { number: 3, merged_at: at(100), created_at: at(0), base: { ref: "main" }, head: { ref: "c", sha: sha("c") } },
  { number: 9, merged_at: at(95), created_at: at(0), base: { ref: "other" }, head: { ref: "x", sha: sha("e") } },
  { number: 2, merged_at: at(60), created_at: at(5), base: { ref: "main" }, head: { ref: "b", sha: sha("b") } },
  { number: 1, merged_at: at(20), created_at: at(1), base: { ref: "main" }, head: { ref: "a", sha: sha("a") } },
  { number: 7, merged_at: null, created_at: at(1), base: { ref: "main" }, head: { ref: "z", sha: sha("f") } },
];
// (#3's timeline runs over two pages, its marking ready on the second, a later event of another kind beside it; #2's
// runs fall on its opening and on its merge, which count)
const filler = Array.from({ length: 100 }, () => ({ event: "commented", created_at: at(1) }));
const timeline = { 1: [[]], 2: [[{ event: "ready_for_review", created_at: at(10) }, { event: "ready_for_review", created_at: at(30) }]], 3: [filler, [{ event: "ready_for_review", created_at: at(70) }, { event: "commented", created_at: at(90) }]] };
const runFiller = Array.from({ length: 100 }, () => ({ head_sha: "x", created_at: at(500) }));
const runs = { a: [[["1", 2], ["1", 3], ["2", 4]]], b: [[["3", 5], ["4", 50], ["5", 70]]], c: [runFiller, [["6", 50], ["6", 51], ["7", 100]]] };
const measured = route => {
  if (route === "repos/o/n") return JSON.stringify({ default_branch: "main" });
  if (route.includes("/pulls?")) return JSON.stringify(pulls);
  const page = Number(/&page=(\d+)/.exec(route)?.[1] ?? 1) - 1;
  const t = /issues\/(\d+)\/timeline/.exec(route);
  if (t) return JSON.stringify(timeline[t[1]][page] ?? []);
  const r = /actions\/runs\?branch=(\w+)&/.exec(route);
  if (r) return JSON.stringify({ workflow_runs: (runs[r[1]][page] ?? []).map(x => (Array.isArray(x) ? { head_sha: x[0], created_at: at(x[1]) } : x)) });
  throw new Error(`no such route: ${route}`);
};
let m = measure({ repo: "o/n", count: 3, gh: measured });
ok(m.read === 3 && m.minutes.join() === "19,30,30", "each merge's minutes run from its turn, the later of the merge before it and its last marking ready", JSON.stringify(m));
ok(m.pushes.join() === "2,2,2", "the pushes whose checks ran are counted once each, from its opening to its merge, past a full page", JSON.stringify(m));
const all = measure({ repo: "o/n", count: 10, gh: measured });
ok(all.read === 3 && all.minutes.join() === "19,30,30", "with fewer merged than asked, the oldest counts from its own marking ready", JSON.stringify(all));
m = measure({ repo: "o/n", count: 2, gh: measured });
ok(m.read === 2 && m.minutes.join() === "30,30", "the last two into the default branch are counted, one into another left out", JSON.stringify(m));
// (#3 made ready before #2 merged: its turn is that merge; with one more read than counted, the oldest gives only that)
timeline[3] = [[{ event: "ready_for_review", created_at: at(40) }]];
const mainOnly = route => (route.includes("/pulls?") ? JSON.stringify(pulls.filter(p => p.number !== 9)) : measured(route));
const extra = measure({ repo: "o/n", count: 2, gh: mainOnly });
ok(extra.read === 2 && extra.minutes.join() === "30,40", "with one more read than counted, the oldest gives only the merge before the next", JSON.stringify(extra));
const past = measure({ repo: "o/n", count: 1, gh: measured });
ok(past.read === 1 && past.minutes.join() === "40", "a merge into another branch is passed over before the sample is cut: the merge before the oldest is one into main", JSON.stringify(past));
timeline[3] = [filler, [{ event: "ready_for_review", created_at: at(70) }, { event: "commented", created_at: at(90) }]];
ok(/of the last 2 merged pull requests, 4 pushes whose checks ran \(a median of 2 each\), and a median of 30\.0 min/.test(line(m)) && /not read/.test(line({ read: 0 })), "the state report's line, and with nothing read, that", line(m));

// (--measure, run through merge-line.mjs)
const out = [];
const code = main(["--repo", "o/n", "--measure", "--count", "2"], { gh: measured, say: l => out.push(l), warn: l => out.push(l) });
ok(code === 0 && /of the last 2 merged pull requests/.test(out.join("\n")), "--measure reads the count it is given", out.join("\n"));

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
