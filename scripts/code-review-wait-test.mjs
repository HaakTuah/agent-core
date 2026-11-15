#!/usr/bin/env node
// Tests for scripts/code-review-wait.mjs: a code review running on the head commit is waited for, a code review of that
// commit, named by its whole SHA, posted by another reviewer ends the wait, and nothing else holds a pull request. Run by tests.yml.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { UNREAD } from "./security-review.mjs";
import { CONTEXT, judge } from "./code-review-wait.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const HEAD = "c".repeat(40);
const OLD = "d".repeat(40);
const pull = { state: "open", draft: false, head: { sha: HEAD } };
const secDone = { commit_sha: HEAD, has_any_findings: null, has_unresolved_findings: null, status: "completed" };
// the summary as Codex's app writes it and GitHub's API gives it, with its code review in the state given
const summary = (code, who = { login: "chatgpt-codex-connector[bot]", type: "Bot" }) => ({
  user: who, author_association: "NONE", updated_at: "2026-11-14T11:30:00Z",
  body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: code, security_review: secDone })} -->\n<!-- codex-security-review:v1 {} -->\n<details>the table</details>`,
});
const running = { commit_sha: HEAD, has_any_findings: null, has_unresolved_findings: null, status: "running" };
const said = (body, assoc = "OWNER") => ({ user: { login: "someone", type: "User" }, author_association: assoc, created_at: "2026-11-14T11:50:00Z", body });
const is = (verdict, isDone, words) => verdict?.sha === HEAD && verdict.done === isDone && verdict.why.includes(words);

ok(is(judge(pull, [summary(running)]), false, "still running"), "Codex's code review running on the head commit is waited for");
ok(["queued", "pending", "in_progress"].every((s) => is(judge(pull, [summary({ ...running, status: s })]), false, "still running")), "and so is one queued or under way by another word Codex's app uses");
ok(is(judge(pull, [summary({ ...running, status: "completed" })]), true, "no code review is running"), "one finished holds nothing, whatever it found");
ok(is(judge(pull, [summary({ ...running, status: "failed" })]), true, "no code review is running") && is(judge(pull, [summary({ ...running, status: "something new" })]), true, "no code review is running"), "a word not known as running holds nothing, so no form of Codex's can hold a pull request for good");
ok(is(judge(pull, [summary({ commit_sha: null, status: null })]), true, "no code review is running") && is(judge(pull, []), true, "no code review is running") && is(judge(pull, null), true, "no code review is running"), "none asked, or no summary at all (a reviewer out of usage never starts), holds nothing");
ok(is(judge(pull, [summary({ ...running, commit_sha: OLD })]), true, "no code review is running"), "one running on an earlier commit does not hold the newest");
ok(is(judge(pull, [summary(running), said(`Code review: the fallback reviewer's, of ${HEAD}. Blocking: none.`)]), true, "is posted"), "a code review of the head commit, named whole, posted by the owner's account ends the wait");
ok(is(judge(pull, [summary(running), said(`Code review: of ${HEAD.slice(0, 7)}`)]), false, "still running") && is(judge(pull, [summary(running), said(`Code review: of ${HEAD.slice(0, 39)}`)]), false, "still running"), "one naming only the commit's first characters does not, since a commit can be made to share them");
const SAME = HEAD.slice(0, 7) + "e".repeat(33);
const same = judge({ ...pull, head: { sha: SAME } }, [summary({ ...running, commit_sha: SAME }), said(`Code review: of ${HEAD}`)]);
ok(same?.sha === SAME && same.done === false && same.why.includes("still running"), "an earlier review of a commit with the same first seven characters does not end the wait on a new head");
ok(is(judge(pull, [summary(running), said(`Code review: of ${HEAD.toUpperCase()}`)]), true, "is posted"), "the whole SHA in capitals counts too");
ok(is(judge(pull, [summary(running), said(`Code review: of f${HEAD}`)]), false, "still running") && is(judge(pull, [summary(running), said(`Code review: of ${HEAD}0`)]), false, "still running") && is(judge(pull, [summary(running), said(`Code review: of ${HEAD}.`)]), true, "is posted"), "the SHA must stand alone: glued to more hex it names no commit, and the wait goes on");
ok(["MEMBER", "COLLABORATOR"].every((a) => is(judge(pull, [summary(running), said(`**Code review:** of ${HEAD}`, a)]), true, "is posted")), "and so does one from a member or collaborator, in bold too, naming the whole commit");
ok(is(judge(pull, [summary(running), said(`Code review: of ${OLD}`)]), false, "still running"), "one posted of another commit does not");
ok(["NONE", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", null].every((a) => is(judge(pull, [summary(running), said(`Code review: of ${HEAD}`, a)]), false, "still running")), "nor one from anyone else");
ok(["code review: of " + HEAD, "> Code review: of " + HEAD, "The Code review: of " + HEAD, "Security review: of " + HEAD].every((b) => is(judge(pull, [summary(running), said(b)]), false, "still running")), "nor one that does not open with the words");
ok(is(judge(pull, [summary(running, { login: "chatgpt-codex-connector", type: "User" })]), true, "no code review is running") && is(judge(pull, [{ ...summary(running), body: `Quoted:\n${summary(running).body}` }]), true, "no code review is running"), "a look-alike summary, by another account or not at a comment's start, is none");
ok(is(judge(pull, [summary(running), summary({ ...running, status: "completed" })]), false, "still running"), "the first summary of Codex's is read, never a later look-alike");
const unread = judge(pull, [{ ...summary(running), body: summary(running).body.replace("codex-review-state:v1", "codex-review-state:v2") }]);
ok(unread.done === true && unread.warning === UNREAD, "a summary whose state cannot be read holds nothing and warns");
ok(judge({ ...pull, state: "closed" }, [summary(running)]) === undefined && judge({ ...pull, draft: true }, [summary(running)]) === undefined && judge({ ...pull, head: { sha: "main" } }, []) === undefined && judge(null, []) === undefined, "a closed pull request, a draft or one with no commit to name gets nothing");
ok(CONTEXT === "code-review", "its status is named code-review");

// Given its commits and files: a pull request that needs a code review waits until one has run.
const done = { ...running, status: "completed" };
const M = "e".repeat(40), F = "f".repeat(40), MAIN = "9".repeat(40);
const commit = (sha, ...parents) => ({ sha, parents: parents.map((p) => ({ sha: p })) });
const line = [commit(OLD, "8".repeat(40)), commit(HEAD, OLD)]; // OLD, then HEAD on it
const code = [{ filename: "src/x.js", status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" }];
const had = (comments, commits = line, files = code, p = pull, rules = [], bound = true) => judge({ commits: commits.length, changed_files: files.length, ...p }, comments, commits, files, rules, bound);
ok(is(had([]), false, "no code review of cccccc") && is(had([summary({ commit_sha: null, status: null })]), false, "ask one, or post"), "one that needs a code review and had none waits, and says how to mend it");
ok(is(had([summary(done)]), true, "a code review has run") && is(had([said(`Code review: of ${HEAD}`)]), true, "a code review has run") && is(had([said(`**Code review:** of ${HEAD}`, "COLLABORATOR")]), true, "a code review has run"), "Codex's completed on the head, or one posted naming the head whole, settles it");
ok(is(had([summary({ ...done, commit_sha: OLD })]), false, "no code review") && is(had([said(`Code review: of ${OLD}`)]), false, "no code review"), "one of an earlier commit with a commit of the builder's after it does not");
ok(is(had([said(`Code review: of ${HEAD.slice(0, 39)}`)]), false, "no code review") && is(had([said(`Code review: of ${HEAD}`, "NONE")]), false, "no code review") && is(had([said(`Security review: of ${HEAD}`)]), false, "no code review"), "nor one naming part of the SHA, by another account, or that is no code review");
const updated = [commit(OLD, "8".repeat(40)), commit(M, OLD, MAIN), commit(HEAD, M, "7".repeat(40))];
ok(is(had([summary({ ...done, commit_sha: OLD })], updated), true, "nothing but updates from main") && is(had([said(`Code review: of ${OLD}`)], updated), true, "nothing but updates"), "one of an earlier commit followed only by merges from main stands");
const mixed = [commit(OLD, "8".repeat(40)), commit(F, OLD), commit(HEAD, F, MAIN)];
const branch = [commit(OLD, "8".repeat(40)), commit(F, "6".repeat(40)), commit(HEAD, OLD, F)];
ok(is(had([summary({ ...done, commit_sha: OLD })], mixed), false, "no code review") && is(had([summary({ ...done, commit_sha: OLD })], branch), false, "no code review") && is(had([summary({ ...done, commit_sha: OLD })], [commit(HEAD, "5".repeat(40), OLD)]), false, "no code review"), "not with a commit of the builder's among them, a merge of a branch of the pull request's own, or a merge whose first parent is not the pull request's");
const md = (filename, extra = {}) => ({ filename, status: "modified", patch: "@@ -1 +1 @@\n-a\n+b", ...extra });
ok(is(had([], line, [md("README.md"), md("docs/how.MD"), md("reports/x.md")]), true, "no code review is running"), "docs alone need none");
ok(["AGENTS.md", "x/CLAUDE.md", "CLAUDE.local.md", "x/AGENTS.override.md", "SECURITY.md", "GEMINI.md", "REVIEW.md", "core-manifest.md", "floor/threat-model.md", "core/README.md", ".github/pull_request_template.md", ".agents/x.md", ".claude/x.md"].every((name) => is(had([], line, [md(name)]), false, "no code review")), "a rule file, the copy of the core, or a file of .github/, .claude/ or .agents/ does");
ok(is(had([], line, [md("docs/rules.md")], pull, ["docs/rules.md"]), false, "no code review") && is(had([], line, [md("x.md", { status: "renamed", previous_filename: "AGENTS.md" })]), false, "no code review"), "so do the project's own rule files its SECURITY.md names, and one moved from a rule file");
const inCore = { ...pull, base: { repo: { full_name: CORE.toUpperCase() } } };
ok(is(had([], line, [md("README.md")], inCore), false, "no code review") && is(had([], line, [md("modules/git.md")], inCore), false, "no code review") && is(had([], line, [md("modules/git.md")]), true, "no code review is running"), "in the core's own repository, where every file is protected, docs need one too; in a project, a folder of that name is docs");
const pin = (a, b) => `@@ -1 +1 @@\n-    uses: ${CORE}/.github/workflows/size.yml@${a}\n+    uses: ${CORE}/.github/workflows/size.yml@${b}`;
const manifest = { filename: "core-manifest.md", status: "modified", patch: `@@ -3 +3 @@\n-Core: ${CORE} at ${"1".repeat(40)}, copied whole under core/.\n+Core: ${CORE} at ${"2".repeat(40)}, copied whole under core/.` };
const sync = [manifest, md("core/scripts/x.mjs"), { filename: ".github/workflows/core.yml", status: "modified", patch: pin("1".repeat(40), "2".repeat(40)) }];
ok(is(had([], line, sync), true, "no code review is running") && is(had([], line, [...sync, md("src/x.js")]), false, "no code review") && is(had([], line, sync.slice(1)), false, "no code review")
  && is(had([], line, [sync[0], { ...sync[2], patch: "@@ -1 +1 @@\n-a\n+b" }]), false, "no code review") && is(had([], line, [md("core-manifest.md"), sync[1]]), false, "no code review"),
  "a sync's shape needs none; with anything more, with no manifest moved, a workflow changed beyond its pins or the manifest beyond its pin, it does");
ok(is(judge(pull, [], line, undefined), true, "no code review is running") && is(judge(pull, [], undefined, code), true, "no code review is running") && is(had([], line, []), true, "no code review is running"), "given no commits or no files, or a pull request that changes nothing, it waits only for a running review, as before");
ok(is(had([], line, [md("README.md")], { ...pull, changed_files: 3001 }), false, "no code review") && is(had([summary({ ...done, commit_sha: OLD })], updated, code, { ...pull, commits: 251 }), false, "no code review")
  && is(had([summary(done)], line, code, { ...pull, commits: 251 }), true, "a code review has run"), "a list of files cut short needs a review; a list of commits cut short proves no update from main, and only a review of the head stands");
const old = had([], line, code, pull, [], false);
ok(old.done === true && old.why.startsWith("before this check came, so not waited for: no code review") && is(had([summary(running)], line, code, pull, [], false), false, "still running"), "a pull request from before the check is told of its missing review, never held for it; a running review is still waited for");
const garbled = { ...summary(done), body: summary(done).body.replace("codex-review-state:v1", "codex-review-state:v2") };
const unreadable = had([garbled]);
ok(unreadable.done === false && unreadable.warning === UNREAD && had([garbled, said(`Code review: of ${HEAD}`)]).done === true, "a summary that cannot be read is no review: the gate still holds, warning, and a posted review settles it");
ok(is(had([summary(running)]), false, "still running") && is(had([summary(running), said(`Code review: of ${HEAD}`)]), true, "is posted"), "a running review is still waited for, and ended by one posted of the head");

// From the command line, as the workflow runs it.
const dir = mkdtempSync(join(tmpdir(), "code-review-wait-"));
try {
  const script = join(dirname(fileURLToPath(import.meta.url)), "code-review-wait.mjs");
  const run = (p, c, env = {}, k = undefined, f = undefined) => {
    writeFileSync(join(dir, "pull.json"), JSON.stringify(p));
    writeFileSync(join(dir, "comments.json"), JSON.stringify(c));
    const more = k === undefined ? [] : [join(dir, "commits.json"), join(dir, "files.json")];
    if (k !== undefined) { writeFileSync(more[0], JSON.stringify(k)); writeFileSync(more[1], JSON.stringify(f)); }
    return JSON.parse(execFileSync(process.execPath, [script, join(dir, "pull.json"), join(dir, "comments.json"), ...more], { encoding: "utf8", env: { ...process.env, ADVISORY: "", RUN_URL: "", ...env } }));
  };
  const advisory = run(pull, [[summary(running)]]);
  ok(advisory.sha === HEAD && advisory.status.state === "success" && advisory.status.context === "code-review" && advisory.status.description.startsWith("Advisory: would wait, Codex's code review"), "run with no word on it, it is advisory and names its status");
  const strict = run(pull, [[summary(running)]], { ADVISORY: "false", RUN_URL: "https://github.com/o/r/actions/runs/9" });
  ok(strict.status.state === "pending" && strict.status.target_url.endsWith("/runs/9") && run(pull, [[summary(running), said(`Code review: of ${HEAD}`)]], { ADVISORY: "false" }).status.state === "success", "told it is not advisory, it waits until the review finishes or another's is posted");
  const counts = { ...pull, commits: 2, changed_files: 1 };
  const none = run(counts, [], { ADVISORY: "false" }, [line], [code]);
  ok(none.status.state === "pending" && none.status.description.startsWith("Waiting: no code review of") && run(counts, [[summary(done)]], { ADVISORY: "false" }, [line], [code]).status.state === "success"
    && run(counts, [], { ADVISORY: "false", BOUND: "false" }, [line], [code]).status.state === "success", "given the commits and files too, it waits for a code review that has not run, and says how to mend it; told the pull request is from before the check, it waits not");
  ok(JSON.stringify(run({ ...pull, draft: true }, [])) === "{}", "a draft prints nothing to mark");
  let usage = 0;
  try { execFileSync(process.execPath, [script], { stdio: "ignore" }); } catch (e) { usage = e.status; }
  ok(usage === 2, "with no files named, it says how it is run");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
