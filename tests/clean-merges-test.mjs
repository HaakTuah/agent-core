// Tests of the proof that an update from main is the merge git makes (clean-merges.mjs, #323), on merges git really
// makes in a scratch repository: one as git makes it, one with a change of its own, one whose conflict was resolved by
// hand, two in a row, and a list whose parents are not git's; and, end to end, the core's security-review.yml run as
// GitHub runs it (workflow-run.mjs) on a pull request whose head is such a merge, GitHub's API a stand-in that gives the
// pull request and logs the statuses it is given: the review of the commit before a merge git makes stands for the
// head, and one before a merge with a change of its own waits, both statuses naming that merge and the mend; and a
// member's review of the head counts where GitHub's answer on the member's rights gives the role write, and only there
// (#412). Git, jq, bash and Node's own modules.
//
//   node tests/clean-merges-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { proved } from "../scripts/clean-merges.mjs";
import { mended } from "../scripts/mend.mjs";
import { checkoutStandIn, ghStandIn, scratchDir, scratchEnv } from "../scripts/scratch-core.mjs";
import { runWorkflow } from "../scripts/workflow-run.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1600).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = scratchDir("clean-merges-test-");
const slash = (p) => p.replace(/\\/g, "/");
const env = scratchEnv(tmp, tmp);
// (the proof runs git with this process's own environment, as the workflow runs it: the same isolation here)
for (const name of Object.keys(process.env)) if (!(name in env)) delete process.env[name];
Object.assign(process.env, env);
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();
const write = (dir, f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
const commit = (dir, message) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", message); return git(dir, "rev-parse", "HEAD"); };
const merge = (dir, other, alter) => {
  try { git(dir, "merge", "-q", "--no-ff", "--no-commit", other); } catch { /* (a conflict: alter resolves it) */ }
  if (alter) alter();
  return commit(dir, "Merge main");
};
// the pull request and its commits as GitHub's API gives them: its own commits, each with the parents git holds
const listed = (dir, ...shas) => shas.map((sha) => ({ sha, parents: git(dir, "show", "-s", "--format=%P", sha).split(" ").map((p) => ({ sha: p })) }));
const pullOf = (head, commits) => ({ state: "open", draft: false, commits: commits.length, head: { sha: head } });

// ---- merges git makes, and merges it does not ----
const r = path.join(tmp, "repo");
fs.mkdirSync(r);
git(r, "init", "-q", "-b", "main");
write(r, "a.txt", "one\ntwo\nthree\n");
write(r, "b.txt", "x\n");
const B0 = commit(r, "base");
git(r, "checkout", "-q", "-b", "pr");
write(r, "a.txt", "ONE\ntwo\nthree\n");
const X = commit(r, "the reviewed change");
git(r, "checkout", "-q", "main");
write(r, "b.txt", "y\n");
const Y = commit(r, "main moves");
git(r, "checkout", "-q", "pr");
const CLEAN = merge(r, Y);
ok(proved(pullOf(CLEAN, [X, CLEAN]), listed(r, X, CLEAN), r).join() === CLEAN, "a merge from main as git makes it is proved");
git(r, "checkout", "-q", "-B", "dirty", X);
const DIRTY = merge(r, Y, () => write(r, "c.txt", "a change of its own\n"));
ok(proved(pullOf(DIRTY, [X, DIRTY]), listed(r, X, DIRTY), r).length === 0, "one that carries a change of its own is not");
git(r, "checkout", "-q", "-B", "edited", X);
const EDITED = merge(r, Y, () => write(r, "a.txt", "ONE\ntwo\nthree, changed in the merge\n"));
ok(proved(pullOf(EDITED, [X, EDITED]), listed(r, X, EDITED), r).length === 0, "nor one that changes a file the pull request changed");
git(r, "checkout", "-q", "-b", "other", Y);
write(r, "a.txt", "One!\ntwo\nthree\n");
const Y2 = commit(r, "main changes the same line");
git(r, "checkout", "-q", "-B", "conflict", X);
const RESOLVED = merge(r, Y2, () => write(r, "a.txt", "ONE\ntwo\nthree\n"));
ok(proved(pullOf(RESOLVED, [X, RESOLVED]), listed(r, X, RESOLVED), r).length === 0, "nor one whose conflict was resolved by hand, even to one side's text");
git(r, "checkout", "-q", "main");
write(r, "d.txt", "z\n");
const Y3 = commit(r, "main moves again");
git(r, "checkout", "-q", "-B", "twice", CLEAN);
const TWICE = merge(r, Y3);
ok(proved(pullOf(TWICE, [X, CLEAN, TWICE]), listed(r, X, CLEAN, TWICE), r).join() === [TWICE, CLEAN].join(), "two in a row, each as git makes it: both proved, from the head");
git(r, "checkout", "-q", "-B", "over", DIRTY);
const OVER = merge(r, Y3);
ok(proved(pullOf(OVER, [X, DIRTY, OVER]), listed(r, X, DIRTY, OVER), r).join() === OVER, "one as git makes it over one that is not: the walk stops at the one that is not");
const lying = listed(r, X, CLEAN).map((c) => (c.sha === CLEAN ? { ...c, parents: [{ sha: X }, { sha: B0 }] } : c));
ok(proved(pullOf(CLEAN, [X, CLEAN]), lying, r).length === 0, "a list that names other parents than git holds proves nothing");
ok(proved(pullOf(X, [X]), listed(r, X), r).length === 0 && proved(pullOf(CLEAN, [CLEAN]), listed(r, CLEAN), r).join() === CLEAN && proved(pullOf("main", []), [], r).length === 0, "a head that is no merge, or no SHA, proves none; one whose reviewed commit is not listed still proves the merge");
ok(proved(pullOf(CLEAN, [X, CLEAN]), listed(r, X, CLEAN), tmp).length === 0, "outside a repository that holds the commits, none is proved");
const cli = spawnSync(process.execPath, [path.join(root, "scripts", "clean-merges.mjs"), ...["pull", "commits"].map((name, i) => {
  const file = path.join(tmp, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(i === 0 ? pullOf(TWICE, [X, CLEAN, TWICE]) : [listed(r, X, CLEAN, TWICE)]));
  return file;
})], { cwd: r, env, encoding: "utf8" });
ok(cli.status === 0 && JSON.stringify(JSON.parse(cli.stdout)) === JSON.stringify([TWICE, CLEAN]), "run as the workflow runs it, in the clone, it prints the merges proved, as JSON (the commits as pages)", cli.stdout + cli.stderr);
const usage = spawnSync(process.execPath, [path.join(root, "scripts", "clean-merges.mjs")], { env, encoding: "utf8" });
ok(usage.status === 2 && usage.stderr.includes("usage:"), "with no files named, it says how it is run");

// ---- the workflow, as GitHub runs it on such a pull request ----
// the repository: a copy of the core as it stands here, its main pushed to a bare origin reached through GitHub's
// address by a git rewrite; the pull request's commits pushed beside it
const repo = path.join(tmp, "core"), origin = path.join(tmp, "origin.git");
fs.cpSync(root, repo, { recursive: true, filter: (src) => !["/.git", "/node_modules"].some((x) => slash(src).endsWith(x)) });
git(repo, "init", "-q", "-b", "main");
const BASE = commit(repo, "the core");
git(tmp, "init", "-q", "--bare", "-b", "main", origin);
git(repo, "remote", "add", "origin", origin);
git(repo, "push", "-q", "origin", "main");
git(repo, "checkout", "-q", "-b", "pr");
write(repo, "notes.txt", "the reviewed change\n");
const SEEN = commit(repo, "the reviewed change");
git(repo, "checkout", "-q", "main");
write(repo, "main.txt", "main moves\n");
const MAIN = commit(repo, "main moves");
git(repo, "checkout", "-q", "pr");
const GITS = merge(repo, MAIN);
git(repo, "checkout", "-q", "-B", "pr-dirty", SEEN);
const OWN = merge(repo, MAIN, () => write(repo, "notes.txt", "the reviewed change, and one no review saw\n"));
git(repo, "push", "-q", "origin", `${GITS}:refs/pull/1/head`, `${OWN}:refs/pull/2/head`);

const { env: runEnv, ghData, ghLog } = ghStandIn(env, tmp, origin);
// Codex's summary: both its reviews completed on the commit before the merge
const state = { code_review: { commit_sha: SEEN, status: "completed" }, security_review: { commit_sha: SEEN, has_any_findings: false, has_unresolved_findings: false, status: "completed" } };
const summary = { user: { login: "chatgpt-codex-connector[bot]", type: "Bot" }, author_association: "NONE", created_at: "2026-11-15T10:00:00Z", updated_at: "2026-11-15T10:00:00Z",
  body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify(state)} -->\n<details>the table</details>` };
// (by default the files name the check's scripts, so that the pull request is held by what they read: the workflow's
// "held"; given others, the head's copy is read from the host, which has none here, as of a pull request from before)
const scripts = ["scripts/security-review.mjs", "scripts/code-review-wait.mjs"];
const check = (number, head, posted = [], rights = {}, { names = scripts, opened = "2026-11-15T09:00:00Z" } = {}) => {
  const repoOf = { full_name: "someone/project" };
  const files = names.map((filename) => ({ filename, status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" }));
  const pull = { number, state: "open", draft: false, created_at: opened, changed_files: files.length, commits: 2, head: { sha: head, repo: repoOf }, base: { sha: BASE, repo: { ...repoOf, owner: { login: "someone" } } }, user: { login: "someone" } };
  fs.writeFileSync(ghData, JSON.stringify({ [`pulls/${number}$`]: pull, [`issues/${number}/comments`]: [summary, ...posted], [`pulls/${number}/comments`]: [], [`pulls/${number}/commits`]: listed(repo, SEEN, head), [`pulls/${number}/files`]: files, ...rights }));
  fs.writeFileSync(ghLog, "");
  const github = { event_name: "pull_request", repository: "someone/project", actor: "someone", server_url: "https://github.com", run_id: "1", token: "not-a-token",
    event: { action: "synchronize", pull_request: pull, repository: { default_branch: "main", private: false } } };
  const [job] = runWorkflow(fs.readFileSync(path.join(repo, ".github/workflows/security-review.yml"), "utf8"), { github, base: runEnv, temp: tmp, inputs: { advisory: false, root: "." },
    workspace: () => { const ws = fs.mkdtempSync(path.join(tmp, "ws-")); execFileSync("git", ["clone", "-q", "--no-checkout", "--", ".", ws], { cwd: origin, stdio: ["ignore", "pipe", "pipe"] }); git(ws, "reset", "-q", "--hard"); return ws; },
    uses: { "actions/checkout": checkoutStandIn(env, tmp), "actions/setup-node": () => {} } });
  // (each post the stand-in logs: its route, then the status as jq prints it)
  const statuses = [...fs.readFileSync(ghLog, "utf8").matchAll(/^\S+ (\{[\s\S]*?^\})$/gmu)].map((m) => JSON.parse(m[1]));
  const of = (context) => statuses.find((s) => s.context === context) ?? {};
  return { passed: job.passed, out: job.steps.map((x) => x.out).join(""), security: of("security-review"), code: of("code-review") };
};
// (its files are the check's scripts, which run with power, so floor rule 3's two are asked: Codex's, and one posted on
// the same commit, #1134, point 4)
const second = { user: { login: "someone", type: "User" }, author_association: "OWNER", created_at: "2026-11-15T10:30:00Z", updated_at: "2026-11-15T10:30:00Z", body: `Security review: ${SEEN}\nNo blocking finding.\nNo other finding.` };
const gits = check(1, GITS, [second]);
ok(gits.passed && gits.out.includes("Merges from main that are the ones git makes: 1.") && gits.security.state === "success" && gits.security.description.includes("only updates from main since")
  && gits.code.state === "success" && gits.code.description.includes("nothing but updates from main since"), "the workflow: a review of the commit before a merge git makes stands for the head, in both statuses", gits.out + JSON.stringify([gits.security, gits.code]));
const own = check(2, OWN);
ok(own.passed && own.out.includes("Merges from main that are the ones git makes: 0.") && own.security.state === "pending" && own.code.state === "pending"
  && own.security.description.includes(`merge ${OWN.slice(0, 7)} unproved`) && own.code.description.includes(`merge ${OWN.slice(0, 7)} unproved`) && [own.security, own.code].every((s) => mended(s.description)),
  "  and one before a merge with a change of its own waits, both statuses naming that merge and the mend", own.out + JSON.stringify([own.security, own.code]));

// a member's review of the head, which the job reads the member's rights for (#412)
const member = { user: { login: "a-member", type: "User" }, author_association: "MEMBER", created_at: "2026-11-15T11:00:00Z", updated_at: "2026-11-15T11:00:00Z", body: `Security review: ${OWN}\nNo blocking finding.\nNo other finding.` };
const rightOf = (role_name, permission) => ({ "collaborators/a-member/permission$": { permission, role_name, user: { login: "a-member", type: "User" } } });
// (with the member's code review of the head beside it, which the security-review status waits for too: #1339)
const memberCode = { ...member, body: `Code review: ${OWN}\nNo blocking finding.\nNo other finding.` };
const writer = check(2, OWN, [member, memberCode], rightOf("write", "write"));
ok(writer.passed && writer.security.state === "success" && writer.security.description.includes("a security review is posted") && writer.code.state === "success", "the workflow: a member the host lets write counts with nothing named", writer.out + JSON.stringify(writer.security));
const reader = check(2, OWN, [member, memberCode], rightOf("triage", "read")), unread = check(2, OWN, [member, memberCode]);
ok([reader, unread].every((r) => r.passed && r.security.state === "pending" && !r.security.description.includes("code-review waits")) && unread.out.includes("The host's rights of a-member could not be read"),
  "  and one it lets only triage, or whose rights cannot be read, does not, the run saying the second", reader.out + unread.out + JSON.stringify([reader.security, unread.security]));

// a pull request that leaves the check's scripts alone, whose head holds none: from before the check only where it was
// opened before each script first came to the default branch, as the host dates the merge of its first commit there,
// read against that branch's own line before the merge, never a later change to it; where that cannot be read, it is held
const FIRST = "f".repeat(40), NEWER = "e".repeat(40), BEFORE = "9".repeat(40), MERGE = "8".repeat(40), TIP = "7".repeat(40);
const merged = (at, ref = "main") => [{ merged_at: at, base: { ref }, merge_commit_sha: MERGE }];
// (the merge that brought the first commit: its first parent, the default branch before it, which holds no copy of the
// script, as the host gives it; and the first commit's own first parent, which holds none either)
const history = (first, newer) => ({ "commits\\?path=": [{ sha: NEWER }, { sha: FIRST }], [`commits/${FIRST}/pulls`]: merged(first), [`commits/${NEWER}/pulls`]: merged(newer),
  [`commits/${MERGE}$`]: { sha: MERGE, parents: [{ sha: BEFORE }, { sha: FIRST }] }, [`commits/${FIRST}$`]: { sha: FIRST, parents: [{ sha: BEFORE }] } });
const alone = (data) => check(3, OWN, [], data, { names: ["notes.txt"] });
const since = alone(history("2026-11-10T00:00:00Z", "2026-11-16T00:00:00Z")), before = alone(history("2026-11-16T00:00:00Z", "2026-11-17T00:00:00Z")), unknown = alone({});
ok(since.passed && since.security.state === "pending" && since.code.state === "pending" && since.security.description.includes(`merge ${OWN.slice(0, 7)} unproved`),
  "the workflow: a pull request opened after the check first came is held, though a later change to the scripts came after it opened", since.out + JSON.stringify([since.security, since.code]));
ok(before.passed && before.security.state === "success" && before.code.state === "success" && [before.security, before.code].every((s) => s.description.includes("before this check came, so not waited for")),
  "  one opened before the check first came is told, never held", before.out + JSON.stringify([before.security, before.code]));
// each answer of the host's that is not as it should be dates nothing, so the pull request is held, and the step still
// writes both statuses: a list of commits that is no list, or an empty one, a first commit merged by no pull request
// or only into another branch, a merge with no time or commit that can be read, one whose parents cannot be read or
// that has none, or whose first parent holds the script already
const early = history("2026-11-16T00:00:00Z", "2026-11-17T00:00:00Z");
const odd = [{ ...early, "commits\\?path=": { sha: FIRST } }, { ...early, "commits\\?path=": [] }, { ...early, [`commits/${FIRST}/pulls`]: [] },
  { ...early, [`commits/${FIRST}/pulls`]: merged("2026-11-16T00:00:00Z", "other") }, { ...early, [`commits/${FIRST}/pulls`]: merged("soon") },
  { ...early, [`commits/${FIRST}/pulls`]: [{ merged_at: "2026-11-16T00:00:00Z", base: { ref: "main" } }] },
  { ...early, [`commits/${MERGE}$`]: { sha: MERGE } }, { ...early, [`commits/${MERGE}$`]: { sha: MERGE, parents: [] } },
  { [`contents/scripts/[^?]+\\?ref=${BEFORE}`]: { sha: "1".repeat(40) }, ...early }].map(alone);
ok(odd.every((r) => r.passed && r.security.state === "pending" && r.code.state === "pending"),
  "  and an answer of the host's not as it should be dates nothing, so it is held", odd.map((r) => JSON.stringify([r.security.state, r.code.state])).join(" "));
// (the first of two merges that hold the commit dates it; and the date counts only as the default branch's own line
// shows it: where that branch, just before the merge, already held the script, nothing is dated)
const twice = alone({ ...early, [`commits/${FIRST}/pulls`]: [{ ...merged("2026-11-18T00:00:00Z")[0], merge_commit_sha: TIP }, ...merged("2026-11-16T00:00:00Z")] });
const onLine = alone({ ...early, [`commits/${MERGE}$`]: { sha: MERGE, parents: [{ sha: TIP }, { sha: FIRST }] }, [`contents/scripts/[^?]+\\?ref=${TIP}`]: { sha: "1".repeat(40) } });
ok(twice.passed && twice.security.state === "success" && onLine.passed && onLine.security.state === "pending" && onLine.code.state === "pending",
  "  it is dated by the first merge that brought the script, read on the default branch's own line", twice.out + onLine.out + JSON.stringify([twice.security, onLine.security, onLine.code]));
const long = alone({ ...history("2026-11-16T00:00:00Z", "2026-11-17T00:00:00Z"), "commits\\?path=": Array.from({ length: 100 }, () => ({ sha: FIRST })) });
ok(unknown.passed && unknown.security.state === "pending" && unknown.code.state === "pending" && long.passed && long.security.state === "pending" && long.code.state === "pending",
  "  and where when it came cannot be read, or its history runs past five pages, it is held", unknown.out + long.out + JSON.stringify([unknown.security, unknown.code, long.security, long.code]));

console.log(`\n${count - failed} of ${count} passed`);
process.exit(failed ? 1 : 0);
