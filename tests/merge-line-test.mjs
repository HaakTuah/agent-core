// Tests the merge line's reader (scripts/merge-line.mjs; #702) through a stand-in for gh: the three facts read from
// the host for each kind of repository (a person's public one, an organisation's public one, an organisation's private
// one on each plan, one whose queue is on, one that asks no up-to-date branch, one whose rules cannot be read), a row
// of the manifest overriding a reading, the one line of advice where a queue is offered and off, and where users get a
// release and the host still asks an up-to-date branch (#733); the cancelling, which cancels nothing while the front's
// run is not queued and never a run of the front's, the next's or the default branch's; and a run told no repository
// refused with its mend (mend.mjs). The measure's cases stand in merge-line-measure-test.mjs, beside this file (#1345).
// Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/merge-line-test.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { cancel, coreOwn, facts, follows, main, override } from "../scripts/merge-line.mjs";
import fs from "node:fs";
import path from "node:path";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500)}`}`); } };
const at = min => new Date(Date.UTC(2026, 10, 18, 12, min)).toISOString();
const sha = letter => letter.repeat(40);

// A host: the repository's row, its rules on the default branch (null: refused), its classic protection ("404", a
// row, or null: refused), and an organisation's plan (null: refused).
// `newest`: the runs the push of the default branch's newest commit started, as the host lists them (undefined: not
// answered).
const host = ({ owner = "User", priv = false, rules = [], classic = "404", plan = "free", newest = undefined }) => route => {
  if (route === "repos/o/n/commits/main" && newest !== undefined) return JSON.stringify({ sha: "c".repeat(40) });
  if (route.startsWith("repos/o/n/actions/runs?head_sha=") && newest !== undefined) return JSON.stringify(newest);
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
f = facts({ repo: "o/n", gh: host({ owner: "Organization", priv: true, rules: strict, plan: "a plan to come" }) });
ok(f.queue === null && /"a plan to come", a name this script does not know\), so taken as not offered/.test(f.said[1]), "a plan whose name it does not know is not read, never guessed, and said so", f.said[1]);
ok(facts({ repo: "o/n", gh: host({ rules: [{ type: "required_status_checks", parameters: { strict_required_status_checks_policy: false } }] }) }).upToDate === false, "required checks that ask no up-to-date branch ask no line");
f = facts({ repo: "o/n", gh: host({ owner: "Organization", priv: true, rules: strict, plan: null }) });
ok(f.queue === null && /plan did not answer\), so taken as not offered/.test(f.said[1]) && !/needs-owner/.test(follows(f)), "a plan that cannot be read is said so, taken as no queue", f.said[1]);
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

// Where users get a release (floor rule 12; #733): no row says each merge; a row *users get* says a release, and the
// advice to switch the up-to-date setting off is given only where the host asks it.
f = facts({ repo: "o/n", gh: host({ rules: strict }) });
ok(f.users === "merges" && /its users get: each merge, as no row/.test(f.said[3]) && !/a release/.test(follows(f)), "with no row, users get each merge and the line is as before", f.said[3]);
ok(/published on a merge alone: a pull request is brought up to date first, until its agents make its publishing wait on a green default branch/.test(follows(f)) && /row \*users get\* then says `releases`/.test(follows(f)), "and the advice says it publishes on a merge alone until its agents make it wait on a green branch (#733, point 8)", follows(f));
const releases = "| *users get* | `releases` |\n";
f = facts({ repo: "o/n", manifest: releases, gh: host({ rules: strict }) });
ok(f.users === "releases" && /merges on its own green checks/.test(follows(f)) && /to switch it off/.test(follows(f)) && /needs-owner/.test(follows(f)) && /kept by hand/.test(follows(f)), "users get a release and the host still asks an up-to-date branch: the owner is advised once, and the line kept meanwhile", follows(f));
f = facts({ repo: "o/n", manifest: releases, gh: host({ rules: [] }) });
ok(/merges on its own green checks/.test(follows(f)) && /nothing to act on/.test(follows(f)) && !/needs-owner/.test(follows(f)), "users get a release and no up-to-date branch is asked: no advice, no line", follows(f));
f = facts({ repo: "o/n", manifest: releases, gh: host({ rules: null, classic: null }) });
ok(/was not read, so the line is kept/.test(follows(f)) && !/needs-owner/.test(follows(f)), "users get a release, and the host's rules cannot be read: the line is kept, no advice", follows(f));
ok(facts({ repo: "o/n", manifest: "| *users get* | `sometimes` |\n", gh: host({ rules: strict }) }).users === "merges", "a row *users get* with no value it takes is read as each merge");
// The default branch's newest commit, read in every project: a failed check stops every merge but the fix.
const runsOf = (...rs) => ({ total_count: rs.length, workflow_runs: rs.map(([conclusion, status = "completed"]) => ({ name: "tests", path: ".github/workflows/tests.yml", status, conclusion })) });
f = facts({ repo: "o/n", manifest: releases, gh: host({ rules: [], newest: runsOf(["success"]) }) });
ok(f.newest.state === "passed" && /cccccc.: its checks all passed/.test(f.said.at(-1)) && !/auto-merge off/.test(follows(f)), "the newest commit passed: merging goes on", f.said.at(-1));
f = facts({ repo: "o/n", manifest: releases, gh: host({ rules: [], newest: runsOf(["success"], [null, "in_progress"]) }) });
ok(f.newest.state === "running" && /still running/.test(f.said.at(-1)) && !/auto-merge off/.test(follows(f)), "its checks still running: merging goes on", f.said.at(-1));
f = facts({ repo: "o/n", manifest: releases, gh: host({ rules: [], newest: runsOf(["success"], ["failure"]) }) });
ok(f.newest.state === "failed" && /a check failed \(tests: failure\)/.test(f.said.at(-1)) && /no pull request but its fix merges/.test(follows(f)) && /auto-merge off on every other open pull request/.test(follows(f)), "a failed check: no pull request but its fix merges, auto-merge turned off on the others", follows(f));
f = facts({ repo: "o/n", manifest: releases, gh: host({ rules: [], newest: "not json" }) });
ok(f.newest.state === null && /read them before a merge/.test(follows(f)), "checks that cannot be read are said so, and read before a merge", follows(f));
f = facts({ repo: "o/n", gh: host({ rules: [], newest: runsOf(["failure"]) }) });
ok(f.users === "merges" && f.newest.state === "failed" && /published on a merge alone/.test(follows(f)) && /no pull request but its fix merges/.test(follows(f)) && /auto-merge off on every other open pull request/.test(follows(f)), "where users get each merge, a failed check on the newest commit stops every merge but the fix all the same", follows(f));
// The core's own row, read from its AGENTS.md where no manifest stands.
const root = scratchDir("merge-line-core-");
fs.mkdirSync(path.join(root, "scripts"));
fs.writeFileSync(path.join(root, "scripts", "merge-line.mjs"), "");
fs.writeFileSync(path.join(root, "AGENTS.md"), "the *users get*:\n`releases`, its users taking the core from a release;\n");
ok(override(coreOwn(root), "users get", ["merges", "releases"]) === "releases", "the core reads its own *users get* from its AGENTS.md, across a line's end");
fs.writeFileSync(path.join(root, "AGENTS.md"), "no such slot\n");
ok(coreOwn(root) === null && coreOwn(path.join(root, "none")) === null, "and nothing where it names none, or outside the core");
fs.rmSync(root, { recursive: true, force: true });

// The cancelling: the front #1 (head a) and the next #2 (head b); runs queued of #1, #2, #3 (head c), main's, and a
// push's; and, spared, a run on the front's branch at a newer head, one of a pull request into another branch, and a
// fork's, which names no pull request.
const cancelled = [];
const pr = (n, base = "main") => [{ number: n, base: { ref: base } }];
const queue = ({ frontQueued = true, refuse = false, rules = strict }) => (...a) => {
  const route = a.at(-1);
  if (a[0] === "-X") { if (refuse) throw new Error("HTTP 403: Resource not accessible by integration"); cancelled.push(route); return ""; }
  if (route === "repos/o/n" || route.startsWith("repos/o/n/rules/") || route.includes("/protection/")) return host({ rules })(route);
  const p = /pulls\/(\d+)$/.exec(route);
  if (p) return JSON.stringify({ state: p[1] === "8" ? "closed" : "open", head: { sha: sha({ 1: "a", 2: "b" }[p[1]] ?? "d"), ref: { 1: "a", 2: "b" }[p[1]] ?? "d", repo: { full_name: "o/n" } } });
  if (route.includes("actions/runs?status=queued&per_page=100&page=2")) return JSON.stringify({ workflow_runs: [{ id: 16, event: "pull_request", head_sha: sha("g"), head_branch: "g", name: "tests", pull_requests: pr(6) }] });
  if (route.includes("actions/runs?status=queued")) return JSON.stringify({ workflow_runs: [
    ...Array.from({ length: 89 }, (_, k) => ({ id: 100 + k, event: "schedule", head_sha: sha("m"), head_branch: "main", name: "look" })),
    ...(frontQueued ? [{ id: 11, event: "pull_request", head_sha: sha("a"), head_branch: "a", name: "tests", pull_requests: pr(1) }] : []),
    { id: 12, event: "pull_request", head_sha: sha("b"), head_branch: "b", name: "tests", pull_requests: pr(2) },
    { id: 13, event: "pull_request", head_sha: sha("c"), head_branch: "c", name: "tests", pull_requests: pr(3) },
    ...(frontQueued ? [{ id: 17, event: "pull_request", head_sha: sha("n"), head_branch: "a", name: "tests", pull_requests: pr(1) }] : []),
    { id: 18, event: "pull_request", head_sha: sha("p"), head_branch: "p", name: "tests", pull_requests: pr(5, "release") },
    { id: 20, event: "pull_request", head_sha: sha("r"), head_branch: "b-renamed", name: "tests", pull_requests: pr(2) },
    ...(frontQueued ? [{ id: 21, event: "pull_request", head_sha: sha("a"), head_branch: "elsewhere", name: "tests", pull_requests: pr(9) }] : []),
    { id: 22, event: "pull_request", head_sha: sha("s"), head_branch: "a", head_repository: { full_name: "fork/n" }, name: "tests", pull_requests: pr(10) },
    { id: 19, event: "pull_request", head_sha: sha("q"), head_branch: "q", head_repository: { full_name: "fork/n" }, name: "tests", pull_requests: [] },
    { id: 14, event: "push", head_sha: sha("m"), head_branch: "main", name: "tests" },
    { id: 15, event: "pull_request", head_sha: sha("m"), head_branch: "main", name: "tests" },
  ] });
  throw new Error(`no such route: ${route}`);
};
let out = cancel({ repo: "o/n", keep: [1, 2], gh: queue({ frontQueued: false }) });
ok(cancelled.length === 0 && /not queued: nothing is cancelled/.test(out[0]), "while the front's run is not queued, nothing is cancelled", out.join(" | "));
out = cancel({ repo: "o/n", keep: [1, 2], gh: queue({}) });
ok(cancelled.join() === "repos/o/n/actions/runs/13/cancel,repos/o/n/actions/runs/22/cancel,repos/o/n/actions/runs/16/cancel", "where it is, only the queued runs of pull requests into main neither the front nor the next are cancelled: never main's, the front's at a newer head, one into another branch or a fork's", cancelled.join());
cancelled.length = 0;
for (const [what, rules, why, manifest = null] of [["no up-to-date branch is asked", [], /before it merges: no,/], ["the host's merge queue keeps the line", [{ type: "merge_queue" }], /merge queue keeps it/],
  ["the manifest's row says a queue keeps the line", strict, /merge queue keeps it/, "| *merge queue* | `on` |\n"],
  ["a queue is on, though the manifest's row says none", [{ type: "merge_queue" }], /merge queue keeps it/, "| *merge queue* | `none` |\n"]]) {
  let said = "";
  try { cancel({ repo: "o/n", keep: [1], manifest, gh: queue({ rules }) }); } catch (e) { said = e.message; }
  ok(cancelled.length === 0 && mended(`FAIL: ${said}`) && /not kept by hand/.test(said) && why.test(said), `where ${what}, nothing is cancelled and it says why`, said);
}
cancelled.length = 0;
cancel({ repo: "o/n", keep: [1], gh: queue({}) });
ok(cancelled.join() === "repos/o/n/actions/runs/12/cancel,repos/o/n/actions/runs/13/cancel,repos/o/n/actions/runs/20/cancel,repos/o/n/actions/runs/22/cancel,repos/o/n/actions/runs/16/cancel", "with the front alone named, the front's run is spared and the rest cancelled", cancelled.join());
out = cancel({ repo: "o/n", keep: [1], gh: queue({ refuse: true }) });
ok(mended(out.join("\n")), "a cancel the sign-in is refused fails with its mend", out.join(" | "));
let thrown = "";
try { cancel({ repo: "o/n", keep: [8], gh: queue({}) }); } catch (e) { thrown = e.message; }
ok(mended(`FAIL: ${thrown}`), "a front that is no open pull request is refused, with its mend", thrown);

// (its run, through the stand-in: each mode but --measure, its options read, and a cancel refused for its sign-in)
const run = (argv, gh) => { const out = [], err = []; const code = main(argv, { gh, say: l => out.push(l), warn: l => err.push(l) }); return { code, out: out.join("\n"), err: err.join("\n") }; };
let r = run(["--repo", "o/n"], host({ rules: strict }));
ok(r.code === 0 && /^What o\/n's host says of the merge line:\n- a branch must be up to date .*yes/.test(r.out) && /kept by hand/.test(r.out), "by itself it prints what it read and what follows", r.out);
cancelled.length = 0;
r = run(["--repo", "o/n", "--cancel", "1,2"], queue({}));
ok(r.code === 0 && cancelled.length === 3 && /cancelled: run 13/.test(r.out), "--cancel spares the front and the next it is given", r.out);
r = run(["--repo", "o/n", "--cancel", "1"], queue({ refuse: true }));
ok(r.code === 1 && mended(r.err) && r.out === "", "a cancel refused fails the run, its mend said", r.err);
for (const argv of [["--repo", "o/n", "--count", "0"], ["--repo", "o/n", "--count", "2.5"], ["--repo", "o/n", "--cancel", "0"], ["--repo", "o/n", "--cancel", "1,1.5"], ["--repo", "o/n", "--cancel"]]) {
  let said = "";
  try { run(argv, () => { throw new Error("no call is made"); }); } catch (e) { said = e.message; }
  ok(mended(`FAIL: ${said}`) && !/no call is made/.test(said), `refused before any call, with its mend: ${argv.join(" ")}`, said);
}

// (the script run by itself, told no repository or a bad front, refuses with its mend)
const script = fileURLToPath(new URL("../scripts/merge-line.mjs", import.meta.url));
for (const args of [[], ["--repo", "o/.."], ["--repo", "o/n", "--cancel", "x"], ["--repo", "o/n", "--cancel", "1,2,3"]]) {
  r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  ok(r.status === 1 && mended(r.stdout + r.stderr) && !/GitHub did not answer/.test(r.stderr), `refused, with its mend: ${args.join(" ") || "(nothing)"}`, r.stdout + r.stderr);
}

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
