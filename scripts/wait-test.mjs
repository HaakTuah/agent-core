// Tests what a pull request waits on (wait.mjs, beside this file): the time the checks of one push took, from the
// first one's start to the last one's end, a check skipped or not ended counting nothing; the median; the last merged
// pull requests read through a stand-in for gh, a head that is no commit's whole name left out; the line the state report gives, against the mark or with none; and a
// run told no repository, refused with its mend (mend.mjs). Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node scripts/wait-test.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { body, pushWait } from "./state-report.mjs";
import { line, measure, median, waited } from "./wait.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500)}`}`); } };
const at = min => new Date(Date.UTC(2026, 10, 16, 12, min)).toISOString();
// (a commit's whole name, as GitHub gives one, of one letter: "a" for the first)
const sha = letter => letter.repeat(40);
const check = (from, to, conclusion = "success") => ({ started_at: at(from), completed_at: to === null ? null : at(to), conclusion });

ok(waited([check(0, 2), check(1, 11), check(3, 5)]) === 660, "a push waits from its first check's start to its last one's end");
ok(waited([check(0, 2), check(0, 30, "skipped"), check(1, null)]) === 120 && waited([]) === null, "a check skipped or not ended counts nothing, and none that ran is no time");
ok(median([5, 1, 3]) === 3 && median([4, 1, 3, 2]) === 3 && median([]) === null, "the median of an odd and an even count, and of none");

const pulls = [
  { merged_at: at(50), head: { sha: sha("c") } }, { merged_at: null, head: { sha: sha("e") } },
  { merged_at: at(40), head: { sha: sha("b") } }, { merged_at: at(30), head: { sha: sha("a") } },
];
const checks = { a: [check(0, 10)], b: [check(0, 4)], c: [check(0, 6)] };
const gh = route => (route.includes("/pulls?") ? JSON.stringify(pulls) : JSON.stringify({ check_runs: checks[/commits\/(\w+)\//.exec(route)[1][0]] }));
// (100 pull requests a page, the newest merges on the second: an old one updated lately fills the first)
const page1 = [...Array.from({ length: 99 }, (_, k) => ({ merged_at: at(k % 10), updated_at: at(58), head: { sha: sha("a") } })), { merged_at: null, updated_at: at(57), head: { sha: sha("e") } }];
const page2 = [{ merged_at: at(56), updated_at: at(56), head: { sha: sha("c") } }, { merged_at: at(55), updated_at: at(55), head: { sha: sha("b") } }];
const paged = route => (route.includes("/pulls?") ? JSON.stringify([page1, page2][Number(/&page=(\d+)/.exec(route)[1]) - 1] ?? []) : JSON.stringify({ check_runs: checks[/commits\/(\w+)\//.exec(route)[1][0]] }));
const deep = measure({ repo: "o/n", count: 2, gh: paged });
ok(deep.median === 300 && deep.read === 2, "the newest merges are found past a page of older ones updated lately", JSON.stringify(deep));
let m = measure({ repo: "o/n", count: 2, mark: 600, gh });
ok(m.median === 300 && m.read === 2, "the last merged pull requests are read, newest first, one not merged left out", JSON.stringify(m));
ok(/5\.0 min, the median of the last 2 merged pull requests' checks, within its mark of 10\.0 min/.test(line(m)), "the state report's line gives the median within its mark", line(m));
ok(/past its mark of 4\.0 min: a task brings it down/.test(line({ ...m, mark: 240 })), "and past it, the task it asks", line({ ...m, mark: 240 }));
ok(/gives no mark under "wait"/.test(line({ ...m, mark: undefined })) && /not read/.test(line({ median: null, read: 0 })), "with no mark, it says so; with nothing read, it says that");

// (a head that is no commit's whole name is not read, and no route is built from it)
const routes = [], odd = [...pulls, { merged_at: at(59), head: { sha: "../../x" } }, { merged_at: at(58), head: { sha: "A".repeat(40) } }];
const named = measure({ repo: "o/n", count: 5, gh: route => { routes.push(route); return route.includes("/pulls?") ? JSON.stringify(odd) : gh(route); } });
ok(named.read === 3 && routes.every(r => r.includes("/pulls?") || /\/commits\/[0-9a-f]{40}\/check-runs\?/u.test(r)), "a head that is no commit's whole name is left out, and a route is built only from forty hexadecimal digits", JSON.stringify(routes));
let thrown = "";
try { measure({ repo: "../..", gh }); } catch (e) { thrown = e.message; }
ok(mended(`FAIL: ${thrown}`), "a repository named by dots alone is refused, with its mend", thrown);

const report = body({ core: false, month: "2026-11", measures: null, wait: line(m), previous: null, overdue: [], scripts: "core/scripts" });
ok(report.includes(`**The measures against their baselines**\n${line(m)}`), "the monthly state report gives the line among its measures", report);

ok(/^- what a push waits on: not read \(GitHub did not answer/.test(pushWait("o/n", ".", null, () => { throw new Error("403"); })) && /6\.0 min/.test(pushWait("o/n", ".", null, gh)), "the state report says the wait not read where GitHub does not answer, never leaves it out", pushWait("o/n", ".", null, () => { throw new Error("403"); }));

const script = fileURLToPath(new URL("./wait.mjs", import.meta.url));
for (const args of [[], ["--repo", "not a repo"], ["--repo", "../.."], ["--repo", "o/.."], ["--repo", "o/n", "--count", "many"]]) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  ok(r.status === 1 && mended(`${r.stdout}${r.stderr}`), `refused, with its mend: ${args.join(" ") || "no repository"}`, `${r.stdout}${r.stderr}`);
}

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
