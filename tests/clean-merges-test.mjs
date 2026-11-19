// Tests of the proof that an update from main is the merge git makes (clean-merges.mjs, #323), on merges git really
// makes in a scratch repository: one as git makes it, one with a change of its own, one whose conflict was resolved by
// hand, one whose conflict, both sides adding lines, keeps both whole, in either order, ones whose sides changed or
// deleted a line, and one that does so and changes a line besides (#750, point 3), two in a row, and a list whose
// parents are not git's; and, end to end, the core's security-review.yml run as
// GitHub runs it (workflow-run.mjs) on a pull request whose head is such a merge, GitHub's API a stand-in that gives the
// pull request and logs the statuses it is given: the review of the commit before a merge git makes stands for the
// head, and one before a merge with a change of its own waits, both statuses naming that merge and the mend; and a
// member's review of the head counts where GitHub's answer on the member's rights gives the role write, and only there
// (#412). Git, jq, bash and Node's own modules.
//
//   node tests/clean-merges-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { proved } from "../scripts/clean-merges.mjs";
import { mended } from "../scripts/mend.mjs";
import { checkoutStandIn, ghStandIn, scratchEnv } from "../scripts/scratch-core.mjs";
import { runWorkflow } from "../scripts/workflow-run.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1600).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clean-merges-test-"));
process.on("exit", () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* (left to the system's own cleaning) */ } });
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
// two pull requests that add to the same place: the conflict settled by keeping both sides' lines, in either order
git(r, "checkout", "-q", "-B", "adds", B0);
write(r, "a.txt", "one\ntwo\nthree\nthe pull request's line\n");
const ADDS = commit(r, "the pull request adds a line");
git(r, "checkout", "-q", "-B", "main-adds", B0);
write(r, "a.txt", "one\ntwo\nthree\nmain's line\n");
const MAIN_ADDS = commit(r, "main adds a line at the same place");
const settled = (name, text, extra) => {
  git(r, "checkout", "-q", "-B", name, ADDS);
  return merge(r, MAIN_ADDS, () => { write(r, "a.txt", text); if (extra) extra(); });
};
const MAIN_FIRST = settled("main-first", "one\ntwo\nthree\nmain's line\nthe pull request's line\n");
const OURS_FIRST = settled("ours-first", "one\ntwo\nthree\nthe pull request's line\nmain's line\n");
ok([MAIN_FIRST, OURS_FIRST].every((at) => proved(pullOf(at, [ADDS, at]), listed(r, ADDS, at), r).join() === at), "a conflict settled by keeping both sides' lines whole, main's first or the pull request's, is proved");
const CHANGED = settled("changed", "one\ntwo\nthree\nmain's line\nthe pull request's line, changed\n");
const DROPPED = settled("dropped", "one\ntwo\nthree\nthe pull request's line\n");
const BESIDE = settled("beside", "one\ntwo\nthree\nmain's line\nthe pull request's line\n", () => write(r, "b.txt", "a change of its own\n"));
git(r, "checkout", "-q", "-B", "markers", ADDS);
const MARKERS = merge(r, MAIN_ADDS); // (committed as git's merge left it, its markers in a.txt)
ok([CHANGED, DROPPED, BESIDE, MARKERS].every((at) => proved(pullOf(at, [ADDS, at]), listed(r, ADDS, at), r).length === 0),
  "  but not one that changes the pull request's line, drops main's, changes another file besides, or keeps git's conflict markers");
// a conflict where either side changed or deleted a line: a union keeps one side's change and undoes the other's, so
// no such merge is proved, however it is settled (the fallback reviewer's finding on #753)
const branch = (name, from, text) => { git(r, "checkout", "-q", "-B", name, from); write(r, "e.txt", text); return commit(r, name); };
git(r, "checkout", "-q", "-B", "e-base", B0);
write(r, "e.txt", "a\nrun dangerous\nb\n");
const E0 = commit(r, "a file both sides change");
const E_PR = branch("e-pr", E0, "a\nrun dangerous --verbose\nb\n"), E_DEL = branch("e-del", E0, "a\nb\n"), E_MAIN = branch("e-main", E0, "a\nrun safely\nb\n");
const E_ADD = branch("e-add", E0, "a\nrun dangerous\nadded\nb\n");
const kept = (name, ours, theirs, text) => { git(r, "checkout", "-q", "-B", name, ours); return merge(r, theirs, () => write(r, "e.txt", text)); };
const undone = [
  kept("pr-over-delete", E_PR, E_DEL, "a\nrun dangerous --verbose\nb\n"),
  kept("delete-over-pr", E_DEL, E_PR, "a\nrun dangerous --verbose\nb\n"),
  kept("both-changed", E_PR, E_MAIN, "a\nrun dangerous --verbose\nrun safely\nb\n"),
  kept("both-changed-other", E_PR, E_MAIN, "a\nrun safely\nrun dangerous --verbose\nb\n"),
  kept("delete-beside-add", E_ADD, E_DEL, "a\nadded\nb\n"),
];
ok(undone.every((at) => proved(pullOf(at, [at]), listed(r, at), r).length === 0),
  "  nor one whose conflict a union settles where a side changed or deleted a line: modify against delete either way, the same line changed on both sides in either order, a delete beside an add");
// two conflicts a few lines apart, or apart only by lines with no letter or digit, which merge-file's --union joins
// into one: both kept in place, each conflict's own, is proved; the union that moves a side's line past the line both
// share is not (the fallback reviewer's second finding on #753)
const near = (name, between) => {
  const at = (text) => text.replace("%", between);
  const base = branch(`${name}-base`, B0, at("start\n%\nend\n"));
  const ours = branch(`${name}-pr`, base, at("start\nA pr-line\n%\nB pr-line\nend\n"));
  const theirs = branch(`${name}-main`, base, at("start\nverify || exit 1\n%\nD main-line\nend\n"));
  return { ours, theirs };
};
for (const [name, between] of [["exit", "exit 0"], ["braces", "}\n\n}"]]) {
  const { ours, theirs } = near(name, between);
  const inPlace = kept(`${name}-in-place`, ours, theirs, `start\nA pr-line\nverify || exit 1\n${between}\nB pr-line\nD main-line\nend\n`);
  const moved = kept(`${name}-moved`, ours, theirs, `start\nA pr-line\n${between}\nB pr-line\nverify || exit 1\n${between}\nD main-line\nend\n`);
  ok(proved(pullOf(inPlace, [inPlace]), listed(r, inPlace), r).join() === inPlace && proved(pullOf(moved, [moved]), listed(r, moved), r).length === 0,
    `  two conflicts apart by ${name === "exit" ? "a line both share" : "lines with no letter or digit"}: kept in place, proved; the union that moves main's line past it, not`);
}
// bytes as they are: a binary file both sides changed, emptied by the merge, and one whose byte that is no UTF-8 the
// merge rewrites, are not proved; that byte kept, and a file whose lines end CR LF, both sides adding, are (the fallback
// reviewer's third check on #753)
const bytesOf = (name, base, pr, main, settled) => {
  const b = branch(`${name}-base`, B0, base), o = branch(`${name}-pr`, b, pr), t = branch(`${name}-main`, b, main);
  return kept(`${name}-merge`, o, t, settled);
};
const latin = (text) => Buffer.from(text, "latin1");
const BINARY = bytesOf("binary", latin("a\0b\n"), latin("a\0b\nours\n"), latin("a\0b\ntheirs\n"), "");
const REWRITTEN = bytesOf("latin", latin("a\nsecret=\xff\nb\n"), latin("a\nsecret=\xff\nb\nours\n"), latin("a\nsecret=\xff\nb\ntheirs\n"), "a\nsecret=\ufffd\nb\nours\ntheirs\n");
const LATIN = bytesOf("latin-kept", latin("a\nsecret=\xff\nb\n"), latin("a\nsecret=\xff\nb\nours\n"), latin("a\nsecret=\xff\nb\ntheirs\n"), latin("a\nsecret=\xff\nb\nours\ntheirs\n"));
const CRLF = bytesOf("crlf", "a\r\nb\r\n", "a\r\nb\r\nours\r\n", "a\r\nb\r\ntheirs\r\n", "a\r\nb\r\ntheirs\r\nours\r\n");
const is = (at) => proved(pullOf(at, [at]), listed(r, at), r).join() === at;
ok(!is(BINARY) && !is(REWRITTEN) && is(LATIN) && is(CRLF),
  "  bytes as they are: a binary file emptied, or a byte that is no UTF-8 rewritten, is not proved; that byte kept, and a file of CR LF lines, are");
git(r, "checkout", "-q", "-B", "mode", ADDS);
const MODE = merge(r, MAIN_ADDS, () => { write(r, "a.txt", "one\ntwo\nthree\nmain's line\nthe pull request's line\n"); fs.chmodSync(path.join(r, "a.txt"), 0o755); git(r, "update-index", "--add", "--chmod=+x", "a.txt"); });
git(r, "checkout", "-q", "-B", "gone", B0);
git(r, "rm", "-q", "a.txt");
const GONE = commit(r, "main deletes the file the pull request changes");
git(r, "checkout", "-q", "-B", "deleted", ADDS);
const DELETED = merge(r, GONE, () => write(r, "a.txt", "one\ntwo\nthree\nthe pull request's line\n"));
ok(git(r, "ls-tree", MODE, "a.txt").startsWith("100755") && [MODE, DELETED].every((at) => proved(pullOf(at, [ADDS, at]), listed(r, ADDS, at), r).length === 0), "  nor one that changes the file's mode, nor a file one side deleted");
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
const check = (number, head, posted = [], rights = {}) => {
  const repoOf = { full_name: "someone/project" };
  // (the files name the check's scripts, so that the pull request is held by what they read: the workflow's "held")
  const files = ["scripts/security-review.mjs", "scripts/code-review-wait.mjs"].map((filename) => ({ filename, status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" }));
  const pull = { number, state: "open", draft: false, changed_files: files.length, commits: 2, head: { sha: head, repo: repoOf }, base: { sha: BASE, repo: { ...repoOf, owner: { login: "someone" } } }, user: { login: "someone" } };
  fs.writeFileSync(ghData, JSON.stringify({ [`pulls/${number}$`]: pull, [`issues/${number}/comments`]: [summary, ...posted], [`pulls/${number}/comments`]: [], [`pulls/${number}/commits`]: listed(repo, SEEN, head), [`pulls/${number}/files`]: files, ...rights }));
  fs.writeFileSync(ghLog, "");
  const github = { event_name: "pull_request", repository: "someone/project", actor: "someone", server_url: "https://github.com", run_id: "1", token: "not-a-token",
    event: { action: "synchronize", pull_request: pull, repository: { default_branch: "main", private: false } } };
  const [job] = runWorkflow(fs.readFileSync(path.join(repo, ".github/workflows/security-review.yml"), "utf8"), { github, base: runEnv, temp: tmp, inputs: { advisory: false, root: "." },
    workspace: () => { const ws = fs.mkdtempSync(path.join(tmp, "ws-")); git(ws, "clone", "-q", origin, "."); return ws; },
    uses: { "actions/checkout": checkoutStandIn(env, tmp), "actions/setup-node": () => {} } });
  // (each post the stand-in logs: its route, then the status as jq prints it)
  const statuses = [...fs.readFileSync(ghLog, "utf8").matchAll(/^\S+ (\{[\s\S]*?^\})$/gmu)].map((m) => JSON.parse(m[1]));
  const of = (context) => statuses.find((s) => s.context === context) ?? {};
  return { passed: job.passed, out: job.steps.map((x) => x.out).join(""), security: of("security-review"), code: of("code-review") };
};
const gits = check(1, GITS);
ok(gits.passed && gits.out.includes("Merges from main that bring in main alone: 1.") && gits.security.state === "success" && gits.security.description.includes("only updates from main since")
  && gits.code.state === "success" && gits.code.description.includes("nothing but updates from main since"), "the workflow: a review of the commit before a merge git makes stands for the head, in both statuses", gits.out + JSON.stringify([gits.security, gits.code]));
const own = check(2, OWN);
ok(own.passed && own.out.includes("Merges from main that bring in main alone: 0.") && own.security.state === "pending" && own.code.state === "pending"
  && own.security.description.includes(`merge ${OWN.slice(0, 7)} unproved`) && own.code.description.includes(`merge ${OWN.slice(0, 7)} unproved`) && [own.security, own.code].every((s) => mended(s.description)),
  "  and one before a merge with a change of its own waits, both statuses naming that merge and the mend", own.out + JSON.stringify([own.security, own.code]));

// a member's review of the head, which the job reads the member's rights for (#412)
const member = { user: { login: "a-member", type: "User" }, author_association: "MEMBER", created_at: "2026-11-15T11:00:00Z", updated_at: "2026-11-15T11:00:00Z", body: `Security review: ${OWN}\nNo blocking finding.\nNo other finding.` };
const rightOf = (role_name, permission) => ({ "collaborators/a-member/permission$": { permission, role_name, user: { login: "a-member", type: "User" } } });
const writer = check(2, OWN, [member], rightOf("write", "write"));
ok(writer.passed && writer.security.state === "success" && writer.security.description.includes("a security review is posted"), "the workflow: a member the host lets write counts with nothing named", writer.out + JSON.stringify(writer.security));
const reader = check(2, OWN, [member], rightOf("triage", "read")), unread = check(2, OWN, [member]);
ok(reader.passed && reader.security.state === "pending" && unread.passed && unread.security.state === "pending" && unread.out.includes("The host's rights of a-member could not be read"),
  "  and one it lets only triage, or whose rights cannot be read, does not, the run saying the second", reader.out + unread.out + JSON.stringify([reader.security, unread.security]));

console.log(`\n${count - failed} of ${count} passed`);
process.exit(failed ? 1 : 0);
