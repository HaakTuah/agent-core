#!/usr/bin/env node
// Tests for scripts/code-review-wait.mjs: a code review running on the head commit is waited for, a code review of that
// commit, named by its whole SHA, posted by another reviewer ends the wait, and nothing else holds a pull request. Run by tests.yml.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

// From the command line, as the workflow runs it.
const dir = mkdtempSync(join(tmpdir(), "code-review-wait-"));
try {
  const script = join(dirname(fileURLToPath(import.meta.url)), "code-review-wait.mjs");
  const run = (p, c, env = {}) => {
    writeFileSync(join(dir, "pull.json"), JSON.stringify(p));
    writeFileSync(join(dir, "comments.json"), JSON.stringify(c));
    return JSON.parse(execFileSync(process.execPath, [script, join(dir, "pull.json"), join(dir, "comments.json")], { encoding: "utf8", env: { ...process.env, ADVISORY: "", RUN_URL: "", ...env } }));
  };
  const advisory = run(pull, [[summary(running)]]);
  ok(advisory.sha === HEAD && advisory.status.state === "success" && advisory.status.context === "code-review" && advisory.status.description.startsWith("Advisory: would wait, Codex's code review"), "run with no word on it, it is advisory and names its status");
  const strict = run(pull, [[summary(running)]], { ADVISORY: "false", RUN_URL: "https://github.com/o/r/actions/runs/9" });
  ok(strict.status.state === "pending" && strict.status.target_url.endsWith("/runs/9") && run(pull, [[summary(running), said(`Code review: of ${HEAD}`)]], { ADVISORY: "false" }).status.state === "success", "told it is not advisory, it waits until the review finishes or another's is posted");
  ok(JSON.stringify(run({ ...pull, draft: true }, [])) === "{}", "a draft prints nothing to mark");
  let usage = 0;
  try { execFileSync(process.execPath, [script], { stdio: "ignore" }); } catch (e) { usage = e.status; }
  ok(usage === 2, "with no files named, it says how it is run");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
