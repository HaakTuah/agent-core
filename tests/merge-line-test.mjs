// Tests the merge line's reader (scripts/merge-line.mjs; #702) through a stand-in for gh: the three facts read from
// the host for each kind of repository (a person's public one, an organisation's public one, an organisation's private
// one on each plan, one whose queue is on, one that asks no up-to-date branch, one whose rules cannot be read), a row
// of the manifest overriding a reading, the one line of advice where a queue is offered and off; the measure, each
// pull request's turn the later of the merge before it and its last marking ready, and the pushes whose checks ran
// counted once each; the cancelling, which cancels nothing while the front's run is not queued and never a run of the
// front's, the next's or the default branch's; and a run told no repository refused with its mend (mend.mjs). Run by
// the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/merge-line-test.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { cancel, facts, follows, line, measure, override } from "../scripts/merge-line.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500)}`}`); } };
const at = min => new Date(Date.UTC(2026, 10, 18, 12, min)).toISOString();
const sha = letter => letter.repeat(40);

// A host: the repository's row, its rules on the default branch (null: refused), its classic protection ("404", a
// row, or null: refused), and an organisation's plan (null: refused).
const host = ({ owner = "User", priv = false, rules = [], classic = "404", plan = "free" }) => route => {
  if (route === "repos/o/n") return JSON.stringify({ default_branch: "main", private: priv, owner: { type: owner, login: "o" } });
  if (route.startsWith("repos/o/n/rules/branches/")) { if (rules === null) throw new Error("HTTP 403"); return JSON.stringify(rules); }
  if (route.includes("/protection/")) { if (classic === "404") throw new Error("gh: Branch not protected (HTTP 404)"); if (classic === "404-other") throw new Error("gh: Not Found (HTTP 404)"); if (classic === null) throw new Error("HTTP 403"); return JSON.stringify(classic); }
  if (route === "orgs/o") { if (plan === null) throw new Error("HTTP 403"); return JSON.stringify({ plan: { name: plan } }); }
  throw new Error(`no such route: ${route}`);
};
const strict = [{ type: "required_status_checks", parameters: { strict_required_status_checks_policy: true } }];

let f = facts({ repo: "o/n", gh: host({ rules: strict }) });
ok(f.upToDate === true && f.queue === "none" && f.billed === false, "a person's public repository: up to date asked, no queue, minutes free", JSON.stringify(f));
ok(/kept by hand/.test(follows(f)) && !/needs-owner/.test(follows(f)), "and the line is kept by hand, with no issue for the owner", follows(f));
f = facts({ repo: "o/n", gh: host({ owner: "Organization", rules: strict }) });
ok(f.queue === "offered" && f.billed === false && /file one for the owner, labelled needs-owner, and nothing waits on it/.test(follows(f)), "an organisation's public repository is offered the queue, and one issue is filed for its owner", follows(f));
f = facts({ repo: "o/n", gh: host({ owner: "Organization", priv: true, rules: strict, plan: "team" }) });
ok(f.queue === "none" && f.billed === true, "an organisation's private one on a smaller plan: no queue, minutes billed", JSON.stringify(f));
ok(facts({ repo: "o/n", gh: host({ owner: "Organization", priv: true, rules: strict, plan: "enterprise" }) }).queue === "offered", "and on the largest plan, the queue offered");
ok(facts({ repo: "o/n", gh: host({ owner: "Organization", priv: true, rules: strict, plan: "a plan to come" }) }).queue === null, "a plan whose name it does not know is not read, never guessed");
f = facts({ repo: "o/n", gh: host({ owner: "Organization", priv: true, rules: strict, plan: null }) });
ok(f.queue === null && /not read .*taken as not offered/.test(f.said[1]) && !/needs-owner/.test(follows(f)), "a plan that cannot be read is said so, taken as no queue", f.said[1]);
f = facts({ repo: "o/n", gh: host({ owner: "Organization", rules: [{ type: "merge_queue" }] }) });
ok(f.queue === "on" && f.upToDate === true && /merge queue keeps the line/.test(follows(f)), "a queue that is on keeps the line", follows(f));
f = facts({ repo: "o/n", gh: host({ rules: [] }) });
ok(f.upToDate === false && /nothing to act on, and nothing waits/.test(follows(f)), "a branch with no up-to-date rule or protection asks no line", follows(f));
ok(facts({ repo: "o/n", gh: host({ rules: [], classic: { strict: true } }) }).upToDate === true, "the classic protection's up-to-date rule is read too");
ok(facts({ repo: "o/n", gh: host({ rules: [], classic: "404-other" }) }).upToDate === null, "a 404 that is not the host's \"Branch not protected\" is not read as no protection");
f = facts({ repo: "o/n", gh: host({ rules: null, classic: null }) });
ok(f.upToDate === null && /not read .*so the line is kept/.test(f.said[0]) && /kept by hand/.test(follows(f)), "rules that cannot be read are said so, and the line is kept", f.said[0]);

const manifest = "| *merge queue* | `on` |\n| *billed minutes* | `yes` |\n";
f = facts({ repo: "o/n", manifest, gh: host({ rules: strict }) });
ok(f.queue === "on" && f.billed === true && /manifest's row \*merge queue\* says \(read: none\)/.test(f.said[1]) && /\*billed minutes\* says \(read: no,/.test(f.said[2]), "a row of the manifest overrides a reading, and what was read is still printed", f.said.join(" | "));
ok(override("| *merge queue* | `maybe` |", "merge queue", ["on", "offered", "none"]) === undefined, "a row with no value the slot takes overrides nothing");

// The measure: three merged pull requests, oldest first #1, #2, #3 (and #9 into another branch, left out); #2 was
// marked ready after #1 merged, so its turn is its marking ready; #3 was ready before #2 merged, so its turn is that merge.
const pulls = [
  { number: 3, merged_at: at(100), created_at: at(0), base: { ref: "main" }, head: { ref: "c", sha: sha("c") } },
  { number: 9, merged_at: at(95), created_at: at(0), base: { ref: "other" }, head: { ref: "x", sha: sha("e") } },
  { number: 2, merged_at: at(60), created_at: at(5), base: { ref: "main" }, head: { ref: "b", sha: sha("b") } },
  { number: 1, merged_at: at(20), created_at: at(1), base: { ref: "main" }, head: { ref: "a", sha: sha("a") } },
  { number: 7, merged_at: null, created_at: at(1), base: { ref: "main" }, head: { ref: "z", sha: sha("f") } },
];
const timeline = { 1: [], 2: [{ event: "ready_for_review", created_at: at(10) }, { event: "ready_for_review", created_at: at(30) }], 3: [{ event: "ready_for_review", created_at: at(40) }] };
const runs = { a: [["1", 2], ["1", 3], ["2", 4]], b: [["3", 31], ["4", 50], ["5", 70]], c: [["6", 50], ["6", 51]] };
const measured = route => {
  if (route === "repos/o/n") return JSON.stringify({ default_branch: "main" });
  if (route.includes("/pulls?")) return JSON.stringify(pulls);
  const t = /issues\/(\d+)\/timeline/.exec(route);
  if (t) return JSON.stringify(timeline[t[1]]);
  const r = /actions\/runs\?branch=(\w+)&/.exec(route);
  if (r) return JSON.stringify({ workflow_runs: runs[r[1]].map(([s, min]) => ({ head_sha: s, created_at: at(min) })) });
  throw new Error(`no such route: ${route}`);
};
let m = measure({ repo: "o/n", count: 3, gh: measured });
ok(m.read === 3 && m.minutes.join() === "19,30,40", "each merge's minutes run from its turn, the later of the merge before it and its last marking ready", JSON.stringify(m));
ok(m.pushes.join() === "2,2,1", "the pushes whose checks ran are counted once each, between its opening and its merge", JSON.stringify(m));
m = measure({ repo: "o/n", count: 2, gh: measured });
ok(m.read === 2 && m.minutes.join() === "30,40", "with one more read than counted, the oldest gives only the merge before the next", JSON.stringify(m));
ok(/of the last 2 merged pull requests, 3 pushes whose checks ran \(a median of 2 each\), and a median of 35\.0 min/.test(line(m)) && /not read/.test(line({ read: 0 })), "the state report's line, and with nothing read, that", line(m));

// The cancelling: the front #1 (head a) and the next #2 (head b); runs queued of #1, #2, #3 (head c), main's, and a push's.
const cancelled = [];
const queue = ({ frontQueued = true, refuse = false }) => (...a) => {
  const route = a.at(-1);
  if (a[0] === "-X") { if (refuse) throw new Error("HTTP 403: Resource not accessible by integration"); cancelled.push(route); return ""; }
  if (route === "repos/o/n") return JSON.stringify({ default_branch: "main" });
  const p = /pulls\/(\d+)$/.exec(route);
  if (p) return JSON.stringify({ state: p[1] === "8" ? "closed" : "open", head: { sha: sha({ 1: "a", 2: "b" }[p[1]] ?? "d") } });
  if (route.includes("actions/runs?status=queued")) return JSON.stringify({ workflow_runs: [
    ...(frontQueued ? [{ id: 11, event: "pull_request", head_sha: sha("a"), head_branch: "a", name: "tests" }] : []),
    { id: 12, event: "pull_request", head_sha: sha("b"), head_branch: "b", name: "tests" },
    { id: 13, event: "pull_request", head_sha: sha("c"), head_branch: "c", name: "tests" },
    { id: 14, event: "push", head_sha: sha("m"), head_branch: "main", name: "tests" },
    { id: 15, event: "pull_request", head_sha: sha("m"), head_branch: "main", name: "tests" },
  ] });
  throw new Error(`no such route: ${route}`);
};
let out = cancel({ repo: "o/n", keep: [1, 2], gh: queue({ frontQueued: false }) });
ok(cancelled.length === 0 && /not queued: nothing is cancelled/.test(out[0]), "while the front's run is not queued, nothing is cancelled", out.join(" | "));
out = cancel({ repo: "o/n", keep: [1, 2], gh: queue({}) });
ok(cancelled.join() === "repos/o/n/actions/runs/13/cancel", "where it is, only the queued run of a pull request neither the front nor the next is cancelled, never main's", cancelled.join());
cancelled.length = 0;
cancel({ repo: "o/n", keep: [1], gh: queue({}) });
ok(cancelled.join() === "repos/o/n/actions/runs/12/cancel,repos/o/n/actions/runs/13/cancel", "with the front alone named, the front's run is spared and the rest cancelled", cancelled.join());
out = cancel({ repo: "o/n", keep: [1], gh: queue({ refuse: true }) });
ok(mended(out.join("\n")), "a cancel the sign-in is refused fails with its mend", out.join(" | "));
let thrown = "";
try { cancel({ repo: "o/n", keep: [8], gh: queue({}) }); } catch (e) { thrown = e.message; }
ok(mended(`FAIL: ${thrown}`), "a front that is no open pull request is refused, with its mend", thrown);

// (the script run by itself, told no repository or a bad front, refuses with its mend)
const script = fileURLToPath(new URL("../scripts/merge-line.mjs", import.meta.url));
for (const args of [[], ["--repo", "o/.."], ["--repo", "o/n", "--cancel", "x"], ["--repo", "o/n", "--cancel", "1,2,3"]]) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  ok(r.status === 1 && mended(r.stdout + r.stderr), `refused, with its mend: ${args.join(" ") || "(nothing)"}`, r.stdout + r.stderr);
}

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
