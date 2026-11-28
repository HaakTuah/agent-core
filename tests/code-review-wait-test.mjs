#!/usr/bin/env node
// Tests for scripts/code-review-wait.mjs: a code review running on the head commit is waited for, a code review of that
// commit, named by its whole SHA, posted by another reviewer ends the wait, and nothing else holds a pull request. Run by tests.yml.
import { execFileSync, spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { UNREAD, status } from "../scripts/security-review.mjs";
import { CONTEXT, judge } from "../scripts/code-review-wait.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { checkout, copied, OWN_SCRIPT } from "../scripts/core-path-scratch.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const HEAD = "c".repeat(40);
const OLD = "d".repeat(40);
// (its owner, "someone", is whose posted reviews count with no right read: security-review.mjs, counted)
const pull = { state: "open", draft: false, head: { sha: HEAD }, base: { repo: { owner: { login: "someone" } } } };
const secDone = { commit_sha: HEAD, has_any_findings: null, has_unresolved_findings: null, status: "completed" };
// the summary as Codex's app writes it and GitHub's API gives it, with its code review in the state given
const summary = (code, who = { login: "chatgpt-codex-connector[bot]", type: "Bot" }) => ({
  user: who, author_association: "NONE", updated_at: "2026-11-14T11:30:00Z",
  body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: code, security_review: secDone })} -->\n<!-- codex-security-review:v1 {} -->\n<details>the table</details>`,
});
const running = { commit_sha: HEAD, has_any_findings: null, has_unresolved_findings: null, status: "running" };
const said = (body, assoc = "OWNER") => ({ user: { login: "someone", type: "User" }, author_association: assoc, created_at: "2026-11-14T11:50:00Z", updated_at: "2026-11-14T11:50:00Z", body });
const is = (verdict, isDone, words) => verdict?.sha === HEAD && verdict.done === isDone && verdict.why.includes(words);

ok(is(judge(pull, [summary(running)]), false, "still running"), "Codex's code review running on the head commit is waited for");
ok(["queued", "pending", "in_progress"].every((s) => is(judge(pull, [summary({ ...running, status: s })]), false, "still running")), "and so is one queued or under way by another word Codex's app uses");
ok(is(judge(pull, [summary({ ...running, status: "completed" })]), true, "no code review is running"), "one finished holds nothing, whatever it found");
ok(is(judge(pull, [summary({ ...running, status: "failed" })]), true, "no code review is running") && is(judge(pull, [summary({ ...running, status: "something new" })]), true, "no code review is running"), "a word not known as running holds nothing, so no form of Codex's can hold a pull request for good");
ok(is(judge(pull, [summary({ commit_sha: null, status: null })]), true, "no code review is running") && is(judge(pull, []), true, "no code review is running") && is(judge(pull, null), true, "no code review is running"), "none asked, or no summary at all (a reviewer out of usage never starts), holds nothing");
ok(is(judge(pull, [summary({ ...running, commit_sha: OLD })]), true, "no code review is running"), "one running on an earlier commit does not hold the newest");
ok(is(judge(pull, [summary(running), said(`Code review: the fallback reviewer's, of ${HEAD}. Blocking: none.`)]), true, "is posted"), "a code review of the head commit, named whole, posted by the owner's account ends the wait");
const retold = { ...said(`Code review: of ${HEAD}`), updated_at: "2026-11-14T12:30:00Z" };
ok(is(judge(pull, [summary(running), retold]), false, "still running") && is(judge(pull, [summary(running), retold], undefined, undefined, [], false), true, "is posted"), "a code review edited since it was posted counts no longer; on a pull request from before the check it counts as it did");
ok(is(judge(pull, [summary(running), said(`Code review: of ${HEAD.slice(0, 7)}`)]), false, "still running") && is(judge(pull, [summary(running), said(`Code review: of ${HEAD.slice(0, 39)}`)]), false, "still running"), "one naming only the commit's first characters does not, since a commit can be made to share them");
const SAME = HEAD.slice(0, 7) + "e".repeat(33);
const same = judge({ ...pull, head: { sha: SAME } }, [summary({ ...running, commit_sha: SAME }), said(`Code review: of ${HEAD}`)]);
ok(same?.sha === SAME && same.done === false && same.why.includes("still running"), "an earlier review of a commit with the same first seven characters does not end the wait on a new head");
ok(is(judge(pull, [summary(running), said(`Code review: of ${HEAD.toUpperCase()}`)]), true, "is posted"), "the whole SHA in capitals counts too");
ok(is(judge(pull, [summary(running), said(`Code review: of f${HEAD}`)]), false, "still running") && is(judge(pull, [summary(running), said(`Code review: of ${HEAD}0`)]), false, "still running") && is(judge(pull, [summary(running), said(`Code review: of ${HEAD}.`)]), true, "is posted"), "the SHA must stand alone: glued to more hex it names no commit, and the wait goes on");
ok(["MEMBER", "COLLABORATOR"].every((a) => is(judge(pull, [summary(running), said(`**Code review:** of ${HEAD}`, a)]), true, "is posted")), "and so does the repository's owner's, whatever association GitHub gives it, in bold too, naming the whole commit");
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
const had = (comments, commits = line, files = code, p = pull, rules = [], bound = true, copy = null) => judge({ commits: commits.length, changed_files: files.length, ...p }, comments, commits, files, rules, bound, undefined, copy);
ok(is(had([]), false, "no code review") && is(had([summary({ commit_sha: null, status: null })]), false, "a fresh reviewer posts"), "one that needs a code review and had none waits, and says how to mend it");
ok(is(had([summary(done)]), true, "a code review has run") && is(had([said(`Code review: of ${HEAD}`)]), true, "a code review has run") && is(had([said(`**Code review:** of ${HEAD}`, "COLLABORATOR")]), true, "a code review has run"), "Codex's completed on the head, or one posted naming the head whole, settles it");
ok(is(had([summary({ ...done, commit_sha: OLD })]), false, "no code review") && is(had([said(`Code review: of ${OLD}`)]), false, "no code review"), "one of an earlier commit with a commit of the builder's after it does not");
ok(is(had([said(`Code review: of ${HEAD.slice(0, 39)}`)]), false, "no code review") && is(had([said(`Code review: of ${HEAD}`, "NONE")]), false, "no code review") && is(had([said(`Security review: of ${HEAD}`)]), false, "no code review"), "nor one naming part of the SHA, by another account, or that is no code review");
const updated = [commit(OLD, "8".repeat(40)), commit(M, OLD, MAIN), commit(HEAD, M, "7".repeat(40))];
// A review that found nothing blocking stands across the pull request's own commits after it that a review checked and
// found nothing blocking in, each a fix its own finding's reviewer checks (#1134, point 1); across one no review
// checked, or with a blocking finding, or Codex's with a blocking finding on its commit or its findings not given, not
{
  const checks = [said(`Security review: of ${HEAD}\nBlocking findings: 0.\nOther findings: 1.`)];
  // (Codex's security review here names the earlier commit, so it checks no later one)
  const ofOld = (s) => ({ ...s, body: s.body.replace(`"security_review":${JSON.stringify(secDone)}`, `"security_review":` + JSON.stringify({ ...secDone, commit_sha: OLD })) });
  const found = (more, by = checks) => judge({ commits: line.length, changed_files: 1, ...pull }, [ofOld(summary({ ...done, commit_sha: OLD })), ...by], line, code, [], true, undefined, null, more);
  const codexFinds = (badge, on = { commit_id: OLD }) => [{ id: 1, user: { login: "chatgpt-codex-connector[bot]", type: "Bot" }, body: `**<sub><sub>![${badge} Badge](https://img.shields.io/badge/${badge}-red?style=flat)</sub></sub>  A finding**`, ...on }];
  ok(is(had([said(`Code review: of ${OLD}\nBlocking findings: 0.\nOther findings: 2.`), ...checks]), true, "only checked fixes or updates from main since") && is(had([said(`Code review: of ${OLD}\nBlocking findings: 1.\nOther findings: 0.`), ...checks]), false, "no code review"),
    "a posted review of an earlier commit that found nothing blocking stands across the builder's commits after it that a review checked; one with a blocking finding does not");
  ok(is(had([said(`Code review: of ${OLD}\nBlocking findings: 0.\nOther findings: 2.`)]), false, "no code review") && is(found({ findings: [] }, []), false, "no code review")
    && is(found({ findings: [] }, [said(`Security review: of ${HEAD}\nBlocking findings: 1.\nOther findings: 0.`)]), false, "no code review") && is(found({ findings: [] }, [said(`Security review: of ${HEAD}\nBlocking findings: 0.\nOther findings: 0.`, "NONE")]), false, "no code review"),
    "nor across a later commit no review checked, one whose check found something blocking, or one checked by an account not counted: new work asks a review of what it changes");
  const secured = (state) => judge({ commits: line.length, changed_files: 1, ...pull }, [{ ...summary({ ...done, commit_sha: OLD }), body: summary({ ...done, commit_sha: OLD }).body.replace(`"security_review":${JSON.stringify(secDone)}`, `"security_review":` + JSON.stringify({ ...secDone, ...state })) }], line, code, [], true, undefined, null, { findings: [] });
  ok(is(secured({ has_any_findings: false }), true, "only checked fixes") && is(secured({}), true, "only checked fixes")
    && is(secured({ has_any_findings: true, has_unresolved_findings: false }), false, "no code review") && is(secured({ has_unresolved_findings: true }), false, "no code review") && is(secured({ commit_sha: OLD }), false, "no code review"),
    "Codex's security review of the later commit that found nothing checks it, as a posted review does, in either form it gives (false, or null in both fields); one that found something, or of another commit, does not");
  ok(is(found({ findings: [] }), true, "only checked fixes") && is(found({ findings: codexFinds("P2") }), true, "only checked fixes") && is(found({ findings: codexFinds("P2", { commit_id: OLD, in_reply_to_id: null }) }), true, "only checked fixes"),
    "Codex's of an earlier commit with no blocking finding stands so too");
  ok(is(found({ findings: codexFinds("P1") }), false, "no code review") && is(found({ findings: codexFinds("P0", {}) }), false, "no code review") && is(found({ findings: codexFinds("P1", { commit_id: "1".repeat(40) }) }), true, "only checked fixes") && is(found(), false, "no code review"),
    "but not with a blocking finding on its commit or on none named, nor where its findings are not given; one on another commit is that commit's");
  const reported = (more) => judge({ commits: line.length, changed_files: 1, ...pull }, [ofOld(summary({ ...done, commit_sha: OLD, has_any_findings: true, has_unresolved_findings: true })), ...checks], line, code, [], true, undefined, null, more);
  ok(is(reported({ findings: [] }), false, "no code review") && is(reported({ findings: codexFinds("P1", { commit_id: "1".repeat(40) }) }), false, "no code review") && is(reported({ findings: codexFinds("P2") }), true, "only checked fixes"),
    "nor where its summary says it found something and none of it on that commit is read here; one whose findings read here block nothing stands");
  const merged = [commit(OLD, "8".repeat(40)), commit(M, MAIN, OLD), commit(HEAD, M)];
  ok(is(had([said(`Code review: of ${OLD}\nBlocking findings: 0.\nOther findings: 0.`)], merged), false, "no code review"), "a merge of the pull request's own commit into another line is no fix it stands across");
}
ok(is(had([summary({ ...done, commit_sha: OLD })], updated), true, "nothing but updates from main") && is(had([said(`Code review: of ${OLD}`)], updated), true, "nothing but updates"), "one of an earlier commit followed only by merges from main stands");
// Given the merges clean-merges.mjs proved (#323), only those carry a review past them; the status names the one that
// stops it, with its mend
// The marks reviews leave (review-marks.mjs; #551): a session's posted review declares its two lines and its score
// (#710), and, in the core, a design-checked pull request has a design check of the head
{
  // (a review counts for the marks as the security-review status counts one: here the repository's owner, "someone")
  const owned = { ...pull, base: { repo: { owner: { login: "someone" }, full_name: "someone/project" } } };
  const had = (comments, commits = line, files = code, p = owned, rules = [], bound = true, copy = null, more = {}) => judge({ commits: commits.length, changed_files: files.length, ...p }, comments, commits, files, rules, bound, undefined, copy, more);
  const at = "2026-11-18T09:00:00Z", now = (body, assoc = "OWNER", when = at) => ({ ...said(body, assoc), created_at: when, updated_at: when });
  const lines = "Blocking findings: 0.\nNo other finding.";
  const ran = [summary(done)];
  ok(is(had([...ran, now(`Code review: of ${HEAD}`)]), false, "lacks lines") && mended(`FAIL ${had([...ran, now(`Code review: of ${HEAD}`)]).why}`),
    "if a session's posted code review has no declared lines, the status waits, saying its mend");
  ok(is(had([...ran, now(`Code review: of ${HEAD}\n${lines}`)]), true, "a code review has run") && is(had([...ran, now(`Security review: none needed, ${HEAD}`)]), true, "a code review has run"),
    "one with both lines, and a note that no security review is needed, which declares nothing, keep it");
  ok(is(had([...ran, now(`Security review: ${HEAD}\nBlocking findings: 0.`)]), false, "Security review lacks lines") && is(had([...ran, now(`Code review: of ${HEAD}`), now(`Code review: of ${HEAD}\n${lines}`, "OWNER", "2026-11-18T10:00:00Z")]), true, "a code review has run"),
    "a review with one line of the two waits; posted again with both, the newer one settles it");
  ok(is(had([...ran, now(`Code review: of ${HEAD}`, "OWNER", "2026-11-17T23:59:59Z")]), true, "a code review has run") && is(had([...ran, { ...now(`Code review: of ${HEAD}`, "NONE"), user: { login: "stranger", type: "User" } }]), true, "a code review has run"),
    "a review posted before the rule's day, or by an account the host does not let write, is not read");
  const tasks = [{ filename: "tasks/reviews.md", status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" }], core = { ...pull, created_at: at, base: { repo: { owner: { login: "someone" }, full_name: CORE } } };
  ok(is(had(ran, line, tasks, core), false, "no design check") && mended(`FAIL ${had(ran, line, tasks, core).why}`), "if a pull request of the core that changes tasks/ has no design check of its head, the status waits, saying its mend");
  ok(is(had([...ran, now(`Design check: ${HEAD}\n${lines}`)], line, tasks, core), true, "a code review has run") && is(had([...ran, now(`Design check: ${OLD}\n${lines}`)], updated, tasks, core), true, "a code review has run"),
    "a design check naming the head, or a commit only updates from main follow, settles it");
  const blocked = "Blocking findings: 1.\nNo other finding.";
  ok(is(had([...ran, now(`Design check: ${OLD}\n${blocked}`)], line, tasks, core), false, "no design check") && is(had([...ran, { ...now(`Design check: ${HEAD}\n${lines}`), updated_at: "2026-11-18T11:00:00Z" }], line, tasks, core), false, "no design check"),
    "one of an earlier commit with a blocking finding and the builder's after it, or one edited since it was posted, does not");
  ok(is(had([...ran, now(`Design check: ${OLD}\n${lines}`), now(`Code review: of ${HEAD}\n${lines}`)], line, tasks, core), true, "a code review has run")
    && is(had([{ ...ran[0], body: ran[0].body.replace(`"security_review":${JSON.stringify(secDone)}`, `"security_review":` + JSON.stringify({ ...secDone, has_any_findings: true, has_unresolved_findings: true })) }, now(`Design check: ${OLD}\n${lines}`)], line, tasks, core), false, "no design check"),
    "one of an earlier commit that found nothing blocking stands across the builder's fixes after it that a review checked, and not across one none checked (#1134, point 1)");
  ok(is(had(ran, line, code, core), true, "a code review has run") && is(had(ran, line, tasks, { ...core, base: { repo: { full_name: "someone/project" } } }), true, "")
    && is(had(ran, line, tasks, { ...core, created_at: "2026-11-17T12:00:00Z" }), true, "a code review has run"),
    "a change outside the rule folders, a project's pull request, and one opened before the rule's day ask no design check");
  ok(is(had(ran, line, tasks, core, [], false), true, "before this check came, so not waited for: no design check"), "a pull request from before the check is told, never held");
  // GitHub's association proves no right to write: in an organisation a member may only read. Only the host's rights,
  // read for those who posted (RIGHTS), or the accounts the project names (REVIEWERS), make a member's review count
  const member = (body, login = "reader") => ({ ...now(body, "MEMBER"), user: { login, type: "User" } });
  const right = (login, role_name, permission, push) => ({ role_name, permission, user: { login, type: "User", permissions: { push } } });
  const org = { ...owned, base: { repo: { owner: { login: "some-org" }, full_name: "some-org/project" } } }, orgCore = { ...core, base: { repo: { owner: { login: "some-org" }, full_name: CORE } } };
  const reads = { rights: [right("reader", "read", "read", false)] }, writes = { rights: [right("reader", "write", "write", true)] };
  ok(is(had([...ran, member(`Security review: ${HEAD}`)], line, code, org, [], true, null, reads), true, "a code review has run") && is(had([...ran, member(`Security review: ${HEAD}`)], line, code, org), true, "a code review has run"),
    "a posted review without its lines from a member who may only read, or whose right was not read, holds nothing");
  ok(is(had([...ran, member(`Security review: ${HEAD}`)], line, code, org, [], true, null, writes), false, "Security review lacks lines") && is(had([...ran, member(`Security review: ${HEAD}`)], line, code, org, [], true, null, { reviewers: ["reader"] }), false, "lacks lines"),
    "one from a member the host's rights let write, or whom the project names, holds it until posted again");
  ok(is(had([...ran, member(`Design check: ${HEAD}\n${lines}`)], line, tasks, orgCore, [], true, null, reads), false, "no design check") && is(had([...ran, member(`Design check: ${HEAD}\n${lines}`)], line, tasks, orgCore, [], true, null, writes), true, "a code review has run"),
    "a design check from a member who may only read settles nothing; one from a member who may write settles it");
  // a posted code review that ends the wait counts the same way: never by GitHub's association alone
  const review = member(`Code review: of ${HEAD}\n${lines}`);
  ok(is(had([summary(running), review], line, code, org, [], true, null, reads), false, "still running") && is(had([review], line, code, org, [], true, null, reads), false, "no code review") && is(had([review], line, code, org), false, "no code review"),
    "a code review posted by a member who may only read, or whose right was not read, neither ends a running review's wait nor stands for one");
  ok(is(had([summary(running), review], line, code, org, [], true, null, writes), true, "is posted") && is(had([review], line, code, org, [], true, null, writes), true, "a code review has run")
    && is(had([review], line, code, org, [], true, null, { reviewers: ["reader"] }), true, "a code review has run") && is(had([member(`Code review: of ${HEAD}\n${lines}`, "some-org")], line, code, org), true, "a code review has run"),
    "one from a member the host's rights let write, an account the project names, or the repository's owner does");
  ok(is(had([summary(running), review], line, code, org, [], false, null, reads), false, "still running") && is(had([summary(running), review], line, code, org, [], false, null, writes), true, "is posted")
    && is(had([summary(running), { ...review, updated_at: "2026-11-18T10:00:00Z" }], line, code, org, [], false, null, writes), true, "is posted"),
    "on a pull request from before the check, a posted code review counts only from an account counted, as on any other, an edited one too");
  // each mend says the whole form of what is to be posted within GitHub's 140 characters, advisory or waiting
  const kinds = [["Security review", "Security review"], ["Code review", "Code review"], ["Design check", "Design check"]];
  const rendered = kinds.map(([kind]) => had([...ran, now(`${kind}: ${HEAD}`)])).concat([had(ran, line, tasks, core)]);
  ok(rendered.every(v => [true, false].every(advisory => { const d = status(v, advisory).description; return d.length <= 140 && /Blocking findings: N\.⏎Other findings: M\.⏎Score: S of 10\.$/u.test(d) && mended(`FAIL ${d}`); })),
    "each mark's mend, as the status renders it, names the whole form within GitHub's 140 characters", rendered.map(v => status(v, false).description).join(" | "));
  // a posted review declares its score too, on a line "Score: N of 10." of its own, from the day that was asked (#710)
  const scored = "2026-11-20T09:00:00Z", late = (body) => now(body, "OWNER", scored);
  ok(is(had([...ran, late(`Code review: of ${HEAD}\n${lines}`)]), false, "Code review lacks lines") && is(had([...ran, late(`Code review: of ${HEAD}\n${lines}\nScore: 0 of 10.`)]), false, "lacks lines")
    && is(had([...ran, late(`Code review: of ${HEAD}\n${lines}\nScore: 11 of 10.`)]), false, "lacks lines") && is(had([...ran, late(`Code review: of ${HEAD}\n${lines}\nScore: 8.5 of 10.`)]), false, "lacks lines")
    && mended(`FAIL ${had([...ran, late(`Code review: of ${HEAD}\n${lines}`)]).why}`),
    "if a review posted from the score's day declares no score from 1 to 10 on a line of its own, the status waits, saying its mend");
  ok(is(had([...ran, late(`Code review: of ${HEAD}\n${lines}\nScore: 8 of 10.`)]), true, "a code review has run") && is(had([...ran, late(`Code review: of ${HEAD}\n${lines}\n**Score: 10 of 10.**`)]), true, "a code review has run")
    && is(had([...ran, now(`Code review: of ${HEAD}\n${lines}`)]), true, "a code review has run") && is(had([...ran, late(`Security review: none needed, ${HEAD}`)]), true, "a code review has run"),
    "one with its score keeps it; one posted before the score's day, or a note that none is needed, is not asked it");
  ok(is(had([...ran, late(`Design check: ${HEAD}\n${lines}`)], line, tasks, { ...core, created_at: scored }), false, "Design check lacks lines") && is(had([...ran, late(`Design check: ${HEAD}\n${lines}\nScore: 9 of 10.`)], line, tasks, { ...core, created_at: scored }), true, "a code review has run"),
    "a design check is asked its score as the other kinds are");
}
const proved = (comments, merges, commits = updated) => judge({ commits: commits.length, changed_files: 1, ...pull }, comments, commits, code, [], true, merges);
const stopped = proved([summary({ ...done, commit_sha: OLD })], [HEAD]);
ok(is(proved([summary({ ...done, commit_sha: OLD })], [HEAD, M]), true, "nothing but updates from main") && is(proved([said(`Code review: of ${M}`)], [HEAD]), true, "nothing but updates"), "a review stands across the merges proved the ones git makes, and a review of the merge where they stop stands too");
ok(is(stopped, false, "merge eeeeeee unproved. Mend: another posts") && is(proved([said(`Code review: of ${OLD}`)], []), false, "merge ccccccc unproved") && is(proved([summary({ ...done, commit_sha: OLD })], {}), false, "merge ccccccc unproved")
  && mended(`Waiting: ${stopped.why}`) && [`Waiting: ${stopped.why}`, `Advisory: ${stopped.why}`, `Advisory: ${proved([], []).why}`].every((d) => d.length <= 140), "one of an earlier commit with a merge not proved after it waits, naming that merge and the mend, within GitHub's 140 characters (a list that is no list proves none)");
// (each mend names what the posted review carries: its kind and whole SHA, its two lines of counts and its score; #403, #710)
ok(is(stopped, false, "Mend: another posts Code review: <whole SHA>⏎Blocking findings: N.⏎Other findings: M.⏎Score: S of 10.") && is(proved([], []), false, "Mend: a fresh reviewer posts Code review: <whole SHA>⏎Blocking findings: N.⏎Other findings: M.⏎Score: S of 10."),
  "each mend names the posted review's form, its two lines of counts and its score");
ok([stopped, proved([], [])].every((v) => [true, false].every((a) => status(v, a, undefined, CONTEXT).description === `${a ? "Advisory" : "Waiting"}: ${v.why}`)), "each mend stands whole in its status, advisory or not, within GitHub's 140 characters");
ok(is(proved([], []), false, "no code review. Mend: a fresh reviewer posts") && is(had([summary({ ...done, commit_sha: OLD })], updated), true, "nothing but updates"), "with no review behind the merge it waits as before, and given no list of the merges proved (an older workflow) the parents alone are read, as before");
const mixed = [commit(OLD, "8".repeat(40)), commit(F, OLD), commit(HEAD, F, MAIN)];
const branch = [commit(OLD, "8".repeat(40)), commit(F, "6".repeat(40)), commit(HEAD, OLD, F)];
ok(is(had([summary({ ...done, commit_sha: OLD })], mixed), false, "no code review") && is(had([summary({ ...done, commit_sha: OLD })], branch), false, "no code review") && is(had([summary({ ...done, commit_sha: OLD })], [commit(HEAD, "5".repeat(40), OLD)]), false, "no code review"), "not with a commit of the builder's among them, a merge of a branch of the pull request's own, or a merge whose first parent is not the pull request's");
const md = (filename, extra = {}) => ({ filename, status: "modified", patch: "@@ -1 +1 @@\n-a\n+b", ...extra });
ok(is(had([], line, [md("README.md"), md("docs/how.MD"), md("reports/x.md")]), true, "no code review is running"), "docs alone need none");
ok(["AGENTS.md", "x/CLAUDE.md", "CLAUDE.local.md", "x/AGENTS.override.md", "SECURITY.md", "GEMINI.md", "REVIEW.md", "core-manifest.md", "floor/threat-model.md", "core/README.md", ".github/pull_request_template.md", ".agents/x.md", ".claude/x.md"].every((name) => is(had([], line, [md(name)]), false, "no code review")), "a rule file, the copy of the core, or a file of .github/, .claude/ or .agents/ does");
ok(is(had([], line, [md("docs/rules.md")], pull, ["docs/rules.md"]), false, "no code review") && is(had([], line, [md("x.md", { status: "renamed", previous_filename: "AGENTS.md" })]), false, "no code review"), "so do the project's own rule files its SECURITY.md names, and one moved from a rule file");
{
  // (a file a pull request adds where a tool's folder leads, which no list holds yet: rule-files.mjs's toolFolders)
  const added = [md("docs/steer/new.md", { status: "added" })], at = (more) => judge({ commits: line.length, changed_files: 1, ...pull }, [], line, added, [], true, undefined, null, more);
  ok(is(at({ folders: ["docs/steer"] }), false, "no code review") && is(at({ folders: [""] }), false, "no code review") && is(at({ folders: ["docs/other"] }), true, "no code review is running") && is(at({}), true, "no code review is running"),
    "a file added where a tool's folder leads needs one, the project's root too, and one elsewhere, or with no folders read, does not");
}
const inCore = { ...pull, base: { repo: { full_name: CORE.toUpperCase() } } };
ok(is(had([], line, [md("README.md")], inCore), false, "no code review") && is(had([], line, [md("roles/shared/git.md")], inCore), false, "no code review") && is(had([], line, [md("roles/shared/git.md")]), true, "no code review is running"), "in the core's own repository, where every file is protected, docs need one too; in a project, a folder of that name is docs");
const pin = (a, b) => `@@ -1 +1 @@\n-    uses: ${CORE}/.github/workflows/size.yml@${a}\n+    uses: ${CORE}/.github/workflows/size.yml@${b}`;
const manifest = { filename: "core-manifest.md", status: "modified", patch: `@@ -3 +3 @@\n-Core: ${CORE} at ${"1".repeat(40)}, copied whole under core/.\n+Core: ${CORE} at ${"2".repeat(40)}, copied whole under core/.` };
const sync = [manifest, md("core/scripts/x.mjs"), { filename: ".github/workflows/core.yml", status: "modified", patch: pin("1".repeat(40), "2".repeat(40)) }];
ok(is(had([], line, sync), true, "no code review is running") && is(had([], line, [...sync, md("src/x.js")]), false, "no code review") && is(had([], line, sync.slice(1)), false, "no code review")
  && is(had([], line, [sync[0], { ...sync[2], patch: "@@ -1 +1 @@\n-a\n+b" }]), false, "no code review") && is(had([], line, [md("core-manifest.md"), sync[1]]), false, "no code review"),
  "a sync's shape needs none; with anything more, with no manifest moved, a workflow changed beyond its pins or the manifest beyond its pin, it does");
{
  // (a copy at the path the manifest names, which the sync's patch shows: core-path.mjs)
  const there = { ...manifest, patch: manifest.patch.replaceAll("under core/.", "under vendor/the-core/ (never edited here).") };
  // (the copy's path as the default branch's manifest names it, which the script adds to the rule files: a Markdown file
  // of the copy is a rule file, so a change to it alone needs its code review)
  const at = (files, rules = []) => had([], line, files, pull, rules, true, "vendor/the-core/");
  ok(is(at([md("vendor/the-core/roles/shared/review-guidelines.md")]), false, "no code review") && is(at([md("vendor/the-core/floor/topics/workflows.md")]), false, "no code review")
    && is(had([], line, [md("vendor/the-core/roles/shared/review-guidelines.md")]), true, "no code review is running"),
    "a Markdown file of a copy at the path the default branch's manifest names is a rule file: a change to it alone needs its code review (and, where no manifest names that path, is docs)");
  ok(is(at([there, md("vendor/the-core/scripts/x.mjs"), sync[2]]), true, "no code review is running"), "and a sync's shape at that path needs none");
  // (a folder the project's SECURITY.md lists among its rule files is no copy: a pin moved beside a change there needs a
  // review, as a project's own file beside a sync always did)
  ok(is(at([there, md("docs/rules/run.mjs")], ["docs/rules/"]), false, "no code review") && is(at([md("docs/rules/run.mjs")], ["docs/rules/"]), false, "no code review"),
    "a folder among the project's rule files is never taken for the copy");
  ok(is(had([], line, [there, md("vendor/the-core/scripts/x.mjs"), sync[2]]), true, "no code review is running") && is(had([], line, [there, md("core/scripts/x.mjs")]), false, "no code review"),
    "a sync's shape at the path the manifest names needs none; a file under core/ beside it is no part of that copy");
}
ok(is(judge(pull, [], line, undefined), true, "no code review is running") && is(judge(pull, [], undefined, code), true, "no code review is running") && is(had([], line, []), true, "no code review is running"), "given no commits or no files, or a pull request that changes nothing, it waits only for a running review, as before");
ok(is(had([], line, [md("README.md")], { ...pull, changed_files: 3001 }), false, "no code review") && is(had([summary({ ...done, commit_sha: OLD })], updated, code, { ...pull, commits: 251 }), false, "no code review")
  && is(had([summary(done)], line, code, { ...pull, commits: 251 }), true, "a code review has run"), "a list of files cut short needs a review; a list of commits cut short proves no update from main, and only a review of the head stands");
const old = had([], line, code, pull, [], false);
ok(old.done === true && old.why.startsWith("before this check came, so not waited for: no code review") && is(had([summary(running)], line, code, pull, [], false), false, "still running"), "a pull request from before the check is told of its missing review, never held for it; a running review is still waited for");
const garbled = { ...summary(done), body: summary(done).body.replace("codex-review-state:v1", "codex-review-state:v2") };
const unreadable = had([garbled]);
ok(unreadable.done === false && unreadable.warning === UNREAD && had([garbled, said(`Code review: of ${HEAD}`)]).done === true, "a summary that cannot be read is no review: the gate still holds, warning, and a posted review settles it");
ok(is(had([summary(running)]), false, "still running") && is(had([summary(running), said(`Code review: of ${HEAD}`)]), true, "is posted"), "a running review is still waited for, and ended by one posted of the head");

// A pull request its caller proved queue-only (#750): in the core, where every pull request needs its code review, it
// needs none where GitHub's whole list of its files is one Markdown file that runs nothing, since a proof handed by a
// caller changed in the pull request itself must wave through nothing more.
const lineOf = { filename: "QUEUE.md", status: "modified", patch: "@@ -1 +1 @@\n-| #1 | builder | |\n+| #2 | builder | |" };
const queued = (comments, files, p = inCore, proved = true) => judge({ commits: line.length, changed_files: files.length, ...p }, comments, line, [files], [], true, undefined, null, { queue: proved });
ok(is(queued([], [lineOf]), true, "queue-only, as queue-only.mjs proves") && is(queued([], [lineOf], inCore, false), false, "no code review"),
  "proved queue-only, its one file the progress file, it needs no code review; not proved, it is any pull request");
ok(is(queued([], [lineOf, { ...lineOf, filename: "README.md" }]), false, "no code review") && is(queued([], [{ ...lineOf, filename: "QUEUE.yml" }]), false, "no code review")
  && is(queued([], [{ ...lineOf, filename: ".github/workflows/x.md" }]), false, "no code review") && is(queued([], [lineOf], { ...inCore, changed_files: 2 }), false, "no code review"),
  "but not where its files are two, one is no Markdown, one runs by itself, or GitHub's list is cut short, whatever its caller says");
ok(is(queued([summary(running)], [lineOf]), false, "still running"), "a code review of Codex's running on the head is still waited for");

// From the command line, as the workflow runs it.
const dir = scratchDir("code-review-wait-");
try {
  const script = fileURLToPath(new URL("../scripts/code-review-wait.mjs", import.meta.url));
  const run = (p, c, env = {}, k = undefined, f = undefined, cwd = undefined) => {
    writeFileSync(join(dir, "pull.json"), JSON.stringify(p));
    writeFileSync(join(dir, "comments.json"), JSON.stringify(c));
    const more = k === undefined ? [] : [join(dir, "commits.json"), join(dir, "files.json")];
    if (k !== undefined) { writeFileSync(more[0], JSON.stringify(k)); writeFileSync(more[1], JSON.stringify(f)); }
    return JSON.parse(execFileSync(process.execPath, [script, join(dir, "pull.json"), join(dir, "comments.json"), ...more], { cwd, encoding: "utf8", env: { ...process.env, ADVISORY: "", RUN_URL: "", ...env } }));
  };
  const advisory = run(pull, [[summary(running)]]);
  ok(advisory.sha === HEAD && advisory.status.state === "success" && advisory.status.context === "code-review" && advisory.status.description.startsWith("Advisory: Codex's code review"), "run with no word on it, it is advisory and names its status");
  const strict = run(pull, [[summary(running)]], { ADVISORY: "false", RUN_URL: "https://github.com/o/r/actions/runs/9" });
  ok(strict.status.state === "pending" && mended(strict.status.description) && strict.status.description.length < 140 && strict.status.target_url.endsWith("/runs/9") && run(pull, [[summary(running), said(`Code review: of ${HEAD}`)]], { ADVISORY: "false" }).status.state === "success", "told it is not advisory, it waits until the review finishes or another's is posted");
  const counts = { ...pull, commits: 2, changed_files: 1 };
  const none = run(counts, [], { ADVISORY: "false" }, [line], [code]);
  ok(none.status.state === "pending" && none.status.description.startsWith("Waiting: no code review. Mend") && mended(none.status.description) && run(counts, [[summary(done)]], { ADVISORY: "false" }, [line], [code]).status.state === "success"
    && run({ ...counts, created_at: "2026-11-14T09:00:00Z" }, [], { ADVISORY: "false", BOUND: "false", SINCE: "2026-11-14T10:00:00Z" }, [line], [code]).status.state === "success"
    && run({ ...counts, created_at: "2026-11-14T11:00:00Z" }, [], { ADVISORY: "false", BOUND: "false", SINCE: "2026-11-14T10:00:00Z" }, [line], [code]).status.state === "pending",
  "given the commits and files too, it waits for a code review that has not run, and says how to mend it; told the pull request is from before the check and opened before the script first came to the default branch, it waits not; opened since, it waits");
  const proved = { ...inCore, commits: line.length, changed_files: 1 };
  ok(run(proved, [], { ADVISORY: "false", QUEUE: HEAD }, [line], [lineOf]).status.state === "success" && run(proved, [], { ADVISORY: "false", QUEUE: OLD }, [line], [lineOf]).status.state === "pending",
    "told the caller's proof holds for the head, a queue-only pull request needs no code review; for another commit it does");
  // (the copy told apart from the core's own repository, as core-path.mjs's copyHeld does, #1350: the default branch's
  // checkout that tracks scripts/core-path.mjs at its root holds no copy, whatever manifest stands beside it, so a pin
  // moved beside a change under the path that manifest names is no sync; in a project's checkout it is)
  const named = copied("vendor/the-core/");
  const rulesLine = { "SECURITY.md": "**the rule files:** `docs/rules.md`;\n" };
  const own = checkout(dir, "own", { "core-manifest.md": named, ...OWN_SCRIPT, ...rulesLine }), copy = checkout(dir, "copy", { "core-manifest.md": named, ...rulesLine });
  const moved = [manifest, md("vendor/the-core/scripts/x.mjs")];
  ok(run(counts, [], { ADVISORY: "false" }, [line], moved, own).status.state === "pending" && run(counts, [], { ADVISORY: "false" }, [line], moved, copy).status.state === "success",
    "the core's own checkout, with a manifest at its root, holds no copy: a pin moved beside a change under the path it names needs its code review; a project's is a sync");
  ok(run(proved, [], { ADVISORY: "false", QUEUE: HEAD }, [line], [md("core/.github/notes.md")], own).status.state === "pending" && run(proved, [], { ADVISORY: "false", QUEUE: HEAD }, [line], [md("vendor/the-core/.github/notes.md")], copy).status.state === "success",
    "and holding no copy, it leaves nothing aside, core/ included: a file there that runs by itself is no queue line; under a project's copy it is");
  ok(JSON.stringify(run({ ...pull, draft: true }, [])) === "{}", "a draft prints nothing to mark");
  // (a project whose SECURITY.md has no line of its rule files: its own list cannot be read, so every file is read as
  // protected, as in the core, saying the mend; the pull request that adds the line passes once its code review has run,
  // and a sync's shape, which reads no list, needs none)
  const lineless = checkout(dir, "lineless", { "SECURITY.md": "# Security\n", "core-manifest.md": named });
  const adds = [{ filename: "SECURITY.md", status: "modified", patch: "+**the rule files:** `docs/rules.md`;" }];
  let warned = "";
  const runLineless = (c, f) => {
    writeFileSync(join(dir, "pull.json"), JSON.stringify(counts)); writeFileSync(join(dir, "comments.json"), JSON.stringify(c)); writeFileSync(join(dir, "commits.json"), JSON.stringify([line])); writeFileSync(join(dir, "files.json"), JSON.stringify(f));
    const r = spawnSync(process.execPath, [script, join(dir, "pull.json"), join(dir, "comments.json"), join(dir, "commits.json"), join(dir, "files.json")], { cwd: lineless, encoding: "utf8", env: { ...process.env, ADVISORY: "false" } });
    warned = r.stderr;
    return r.status === 0 ? JSON.parse(r.stdout).status?.state : `exit ${r.status}`;
  };
  ok(runLineless([], [md("docs/rules.md")]) === "pending" && /no "the rule files:" line.* Mend: add to rule 3 the line/.test(warned) && /every file is read as protected/.test(warned)
    && runLineless([], adds) === "pending" && runLineless([[summary(done)]], adds) === "success" && runLineless([[summary(done)]], [md("docs/notes.md")]) === "success" && runLineless([], moved) === "success",
  "where the project's SECURITY.md names no rule files, it does not take the list as empty: every file is read as protected, so a Markdown file waits for its code review, saying the mend, and the pull request that adds the line passes once its code review has run; a sync's shape, which reads no list, needs none", warned);
  let usage = 0;
  try { execFileSync(process.execPath, [script], { stdio: "ignore" }); } catch (e) { usage = e.status; }
  ok(usage === 2, "with no files named, it says how it is run");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
