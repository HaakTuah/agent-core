// Checks the security-review status against the host's own record (#626; #593, point 9): the comparisons of
// scripts/security-review-host.mjs on cases made here, each failing where it should, then on the recordings of the
// core's own merged pull requests under reports/security-review-host/, offline, with no token. The recorder:
// tests/security-review-record-test.mjs, which imports the cases made here; run by itself, this file checks them.
//
//   node tests/security-review-host-test.mjs
import fs from "node:fs";
import path from "node:path";
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { FOLDER, SECURITY, atMerge, compare, compareRights, recordings, securityReviews, verdictOf } from "../scripts/security-review-host.mjs";
import { started } from "../scripts/started.mjs";

// the cases both tests share: a merged pull request as the host records it, and the host's answers on rights and to
// the recorder's calls
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const HEAD = "a".repeat(40), SEEN = "b".repeat(40), BASE = "c".repeat(40);
export const CODEX = { login: "chatgpt-codex-connector[bot]", type: "Bot" };
export const ME = { login: OWNER, type: "User" };
export const OTHER = { login: "a-stranger", type: "User" };
export const found = { commit_sha: HEAD, has_any_findings: true, has_unresolved_findings: true, status: "completed" };
export const cleared = { ...found, has_unresolved_findings: false };
export const summary = (security, at = "2026-11-12T10:30:00Z") => ({ id: 1, user: CODEX, author_association: "NONE", created_at: "2026-11-12T09:00:00Z", updated_at: at,
  body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { status: "completed" }, security_review: security })} -->\n| 🔒 **Security Review** | done |` });
export const posted = (sha, at, user = ME, assoc = "OWNER") => ({ id: 2, user, author_association: assoc, created_at: at, updated_at: at, body: `Security review: ${sha}\nBlocking findings: 0.\nOther findings: 0.\nA line of prose.` });
export const finding = (id, at) => ({ id, user: CODEX, author_association: "NONE", created_at: at, updated_at: at, path: "a.js", body: "<!-- codex-security-review-finding:v1 -->\n\n### A finding\n\nIts text." });
export const review = (commit, at, kind = "🛡️ Codex Security Review · _Automatically triggered_") => ({ id: 9, user: CODEX, commit_id: commit, submitted_at: at,
  body: `<!-- codex-review-receipt:v1 -->\n\n\n### ${kind}\n\nHere are some suggestions.\n\n**Reviewed commit:** \`${commit.slice(0, 10)}\`` });
export const commit = { sha: HEAD, parents: [{ sha: BASE }], author: ME, committer: { login: "web-flow", type: "User" }, commit: { verification: { verified: true } } };
// a merged pull request whose Codex security review found one thing on the head, and a review posted after it
export const record = (over = {}) => ({
  pull: { number: 7, state: "closed", draft: false, merged_at: "2026-11-12T12:00:00Z", created_at: "2026-11-12T08:00:00Z", commits: 1, changed_files: 1, user: ME,
    head: { sha: HEAD, repo: { full_name: CORE } }, base: { repo: { full_name: CORE, owner: ME } } },
  comments: [summary(found), posted(HEAD, "2026-11-12T11:00:00Z")], findings: [finding(31, "2026-11-12T10:00:00Z")], commits: [commit],
  files: [{ filename: "scripts/a.mjs", status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" }], reviews: [review(HEAD, "2026-11-12T10:00:00Z")],
  threads: [{ resolved: false, first: 31 }], rights: [], ...over });
export const answer = (login, role, permission = role === "maintain" ? "write" : role, type = "User", push = true) => ({ permission, role_name: role, user: { login, type, permissions: { push } } });
export const listed = (login, role, type = "User") => ({ login, type, role_name: role });
// a host the recorder's test stands in for: each call answered from a table by its route, or refused as gh refuses it
export const refusal = (text) => Object.assign(new Error("gh failed"), { stderr: `${text}\n` });
export const host = (answers) => {
  const calls = [];
  const call = (args) => {
    calls.push(args.join(" "));
    const key = Object.keys(answers).find((route) => args.some((arg) => arg === route || arg.startsWith(`${route}?`) || arg.startsWith(`query=`) && route === "graphql"));
    if (key === undefined) throw refusal(`gh: Not Found (HTTP 404) for ${args.join(" ")}`);
    const given = answers[key];
    if (given instanceof Error) throw given;
    return typeof given === "function" ? given(args) : given;
  };
  return { call, calls };
};

if (started(import.meta.url)) {
  let failed = 0;
  const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };

  // --- the comparisons of a pull request's reviews ---
  ok(same(compare(record()), []), "a Codex security finding on the head, its thread open, with a review posted after it: no difference");
  ok(verdictOf(record()).done === true && /a review is posted after its newest finding/u.test(verdictOf(record()).why), "the status is judged as the pull request stood at its merge, open and no draft");
  ok(atMerge(record())[0].state === "open" && atMerge(record())[0].draft === false && atMerge(record())[0].number === 7, "at its merge the pull request reads as open and no draft, the rest as recorded");
  ok(same(atMerge(record({ comments: [summary(found), posted(HEAD, "2026-11-12T12:00:00Z"), posted(SEEN, "2026-11-12T12:00:01Z")] }))[1].map((c) => c.created_at), ["2026-11-12T09:00:00Z", "2026-11-12T12:00:00Z"]), "what came at the merge is read with it, what came after is not");
  ok(same(atMerge(record({ findings: [finding(31, "2026-11-12T10:00:00Z"), finding(32, "2026-11-12T12:30:00Z")] }))[2].map((c) => c.id), [31]), "a finding after the merge is not read");
  ok(verdictOf(record({ comments: [summary({ ...cleared, commit_sha: SEEN })] })).done === false, "the status is judged as one held by the check, which waits where Codex saw another commit than the head");
  const writes = { permission: "write", role_name: "write", user: { ...OTHER, permissions: { push: true } } };
  const theirs = { comments: [summary(found), posted(HEAD, "2026-11-12T11:00:00Z", OTHER, "COLLABORATOR")] };
  ok(verdictOf(record({ ...theirs, rights: [writes] })).done === true && verdictOf(record(theirs)).done === false, "with the rights recorded: a review of an account the host lets write counts, as the workflow reads it");

  const late = compare(record({ reviews: [review(HEAD, "2026-11-12T10:45:00Z")] }));
  ok(late.length === 1 && /#7: Codex's security review 9 was submitted at 2026-11-12T10:45:00Z, after the summary last changed \(2026-11-12T10:30:00Z\)/u.test(late[0]), "a Codex security review submitted after the summary's last change is a difference (F9, F10)");
  ok(same(compare(record({ reviews: [review(HEAD, "2026-11-12T10:30:00Z")] })), []), "one submitted at the summary's last change is none");
  ok(same(compare(record({ reviews: [review(HEAD, "2026-11-12T12:30:00Z")] })), []), "one submitted after the merge is not read");
  ok(same(compare(record({ reviews: [review(HEAD, "2026-11-12T10:45:00Z", "💡 Codex Review")] })), []), "Codex's code review, in the same list, is not its security review");
  ok(same(compare(record({ reviews: [{ ...review(HEAD, "2026-11-12T10:45:00Z"), user: ME }] })), []), "a review by anyone but Codex's app is not read as one of Codex's");
  ok(securityReviews(record({ reviews: [review(HEAD, "2026-11-12T10:00:00Z"), review(SEEN, "2026-11-12T12:00:00Z"), review(SEEN, "2026-11-12T12:00:01Z")] })).length === 2, "Codex's security reviews are those submitted by the merge, its own second among them");
  ok(SECURITY.test(review(HEAD, "x").body) && !SECURITY.test(review(HEAD, "x", "💡 Codex Review").body), "a security review is told from a code review by its heading");
  ok(!SECURITY.test(`> ${review(HEAD, "x").body}`), "a review that quotes one is not one");
  ok(same(compare(record({ reviews: null, threads: [] })), []) && same(compare(record({ reviews: "none" })), []), "reviews the host did not list are none");

  const moved = compare(record({ reviews: [review(SEEN, "2026-11-12T09:30:00Z"), review(BASE, "2026-11-12T10:00:00Z")] }));
  ok(moved.length === 1 && moved[0] === `#7: the summary names ${HEAD} for Codex's security review, but its newest review in the host's list is on ${BASE}`, "the summary naming another commit than Codex's newest security review is a difference (F13)");
  ok(same(compare(record({ reviews: [review(BASE, "2026-11-12T09:30:00Z"), review(HEAD, "2026-11-12T10:00:00Z")] })), []), "only the newest review is compared, an older one on another commit is none");
  const none = { ...found, has_any_findings: false, has_unresolved_findings: false };
  const quiet = compare(record({ comments: [summary(none)], threads: [] }));
  ok(quiet.length === 1 && quiet[0] === `#7: the summary says Codex's security review of ${HEAD} found nothing, but the host lists a security review of Codex's on that commit`, "a summary that says nothing was found, beside a security review on its commit, is a difference (F14)");
  ok(same(compare(record({ comments: [summary({ ...none, has_any_findings: null })], reviews: [review(SEEN, "2026-11-12T10:00:00Z")], threads: [] })), []), "a summary that found nothing on another commit than the reviews' is none");
  ok(compare(record({ comments: [summary(none)], reviews: [review(SEEN, "2026-11-12T09:00:00Z"), review(HEAD, "2026-11-12T10:00:00Z")], threads: [] })).length === 1, "nor is it hidden by a review on another commit beside it");
  ok(compare(record({ reviews: [review(HEAD, "2026-11-12T10:00:00Z"), review(SEEN, "2026-11-12T10:00:00Z")] })).length === 0, "of two reviews submitted at once, the first is the newest");
  ok(same(compare(record({ comments: [{ ...summary(found), body: summary(found).body.replace(JSON.stringify(found), "null") }, posted(HEAD, "2026-11-12T11:00:00Z")] })), []), "a summary whose security review is null has no commit to compare");
  ok(same(compare(record({ comments: [summary({ ...found, status: "running" }), posted(HEAD, "2026-11-12T11:00:00Z")], reviews: [review(SEEN, "2026-11-12T10:00:00Z")] })), []), "a summary whose security review is not completed has no commit to compare");
  ok(same(compare(record({ reviews: [] })), []), "a summary with findings and no review in the host's list is none");

  const unseen = compare(record({ comments: [summary(cleared)] }));
  ok(unseen.length === 1 && /^#7: Codex's security finding 31 is unresolved on the merged head, with no "Security review:" posted after it, yet the status passed: Codex's security review has run \(on aaaaaaa\)$/u.test(unseen[0]), "an open thread of a Codex security finding, where the status passed with no review after it, is a difference (F9)");
  ok(same(compare(record({ comments: [summary(cleared), posted(HEAD, "2026-11-12T11:00:00Z")] })), []), "with a review posted after the finding, none");
  ok(compare(record({ comments: [summary(cleared), posted(HEAD, "2026-11-12T09:59:00Z")] })).length === 1, "a review posted before the finding does not settle it");
  ok(compare(record({ comments: [summary(cleared), posted(HEAD, "2026-11-12T10:00:00Z")] })).length === 1, "nor one posted the same second, as the status reads it");
  ok(compare(record({ comments: [summary(cleared), posted(HEAD, "2026-11-12T11:00:00Z"), posted(HEAD, "2026-11-12T09:59:00Z")] })).length === 0, "one review after it settles it, whatever came before");
  ok(compare(record({ comments: [summary(cleared), { ...posted(HEAD, "2026-11-12T11:00:00Z"), body: `Code review: ${HEAD}` }] })).length === 1, "a posted code review does not settle a security finding");
  ok(compare(record({ comments: [summary(cleared), posted(HEAD, "2026-11-12T12:30:00Z")] })).length === 1, "nor one posted after the merge");
  ok(compare(record({ comments: [summary(cleared), posted(HEAD, "2026-11-12T11:00:00Z", OTHER, "COLLABORATOR")] })).length === 1, "nor one from an account the status does not count");
  const writer = { permission: "write", role_name: "write", user: { ...OTHER, permissions: { push: true } } };
  ok(same(compare(record({ comments: [summary(cleared), posted(HEAD, "2026-11-12T11:00:00Z", OTHER, "COLLABORATOR")], rights: [writer] })), []), "but one from an account the recorded rights let write does");
  ok(same(compare(record({ comments: [summary(cleared)], threads: [{ resolved: true, first: 31 }] })), []), "a resolved thread is none");
  ok(same(compare(record({ comments: [summary(cleared)], threads: [{ resolved: false, first: 32 }] })), []), "a thread no Codex security finding opened is none");
  ok(same(compare(record({ comments: [summary(cleared)], findings: [{ ...finding(31, "2026-11-12T10:00:00Z"), body: "A finding of the code review." }] })), []), "a thread Codex's code review opened is none");
  ok(same(compare(record({ comments: [summary(cleared)], findings: [{ ...finding(31, "2026-11-12T10:00:00Z"), user: ME }] })), []), "a thread anyone but Codex opened is none");
  ok(same(compare(record({ comments: [summary(cleared)], threads: null })), []), "with no threads recorded, none is compared");
  ok(same(compare(record({ comments: [summary(found)], findings: [finding(31, "2026-11-12T11:30:00Z")] })), []), "where the status waits, an open thread is no difference");
  ok(same(compare(record({ comments: [summary(cleared)], findings: [finding(31, "2026-11-12T12:30:00Z")] })), []), "a finding after the merge is not on the merged head");
  ok(compare(record({ comments: [summary(cleared)], threads: [{ resolved: true, first: 31 }, { resolved: false, first: 31 }] })).length === 1, "each open thread is read, a resolved one beside it or not");

  ok(same(compare(record({ comments: [] })), ["#7: Codex's summary is not there, so nothing of its security review can be compared"]), "with no summary of Codex's, the comparison says so");
  ok(same(compare(record({ comments: [{ ...summary(found), body: "<!-- codex-pull-request-review-summary -->\nno state" }] })), ["#7: Codex's summary is there but cannot be read, so nothing of its security review can be compared"]), "with a summary it cannot read, so");

  // --- the comparison of who may write ---
  ok(same(compareRights({ pushList: [listed(OWNER, "admin"), listed("w", "write"), listed("m", "maintain")], answers: [answer(OWNER, "admin"), answer("w", "write"), answer("m", "maintain")] }), []), "admin, write and maintain on the push list are the writers writersOf() counts (W5)");
  ok(same(compareRights({ pushList: [listed("W", "write")], answers: [answer("w", "write")] }), []), "logins are compared in any case");
  ok(same(compareRights({ pushList: [listed("c", "a-custom-role")], answers: [answer("c", "a-custom-role", "write")] }), []), "a custom role with push counts for no one, listed on purpose (W6)");
  ok(same(compareRights({ pushList: [listed("app", "write", "Bot")], answers: [answer("app", "write", "write", "Bot")] }), []), "an app's account counts for no one, listed on purpose (W7)");
  ok(same(compareRights({ pushList: [listed("r", "write")], answers: [answer("r", "read")] }), ["r is on the host's push list, but writersOf() does not count them (role read, permission read)"]), "a role GitHub defines that the push list holds and writersOf() does not count is a difference");
  ok(same(["triage", "write", "maintain", "admin"].map((role) => compareRights({ pushList: [listed("r", role)], answers: [answer("r", role, "read")] }).length), [1, 1, 1, 1]), "so is each role GitHub defines, whatever its permission says");
  ok(same(compareRights({ pushList: [listed("a", "write"), listed("b", "write")], answers: [answer("a", "read"), answer("b", "write")] }), ["a is on the host's push list, but writersOf() does not count them (role read, permission read)"]), "each login is read against its own answer");
  ok(same(compareRights({ pushList: [listed("b", "write")], answers: [{ permission: "none", role_name: "none", user: null }, answer("b", "read")] }).length, 1), "an answer with no account is no one's");
  ok(same(compareRights({ pushList: "x", answers: "y" }), []), "lists the host did not give are none");
  ok(same(compareRights({ pushList: [null, "w", listed("w", "write")], answers: [null, 3, answer("w", "write")] }), []), "and an entry that is no object is skipped");
  ok(same(compareRights({ pushList: [listed("w", "write")], answers: [answer("w", "write", "write", "User", false)] }), ["w is on the host's push list, but writersOf() does not count them (role write, permission write)"]), "so is a writer whose answer says it may not push");
  ok(same(compareRights({ pushList: [listed("w", "write")], answers: [] }), ["w is on the host's push list, but no rights answer of theirs is recorded"]), "one on the push list with no answer recorded is a difference");
  ok(same(compareRights({ pushList: [], answers: [answer("w", "write")] }), ["writersOf() counts w, who is not on the host's push list"]), "one writersOf() counts who is not on the push list is a difference");
  ok(same(compareRights({}), []), "nothing recorded, nothing compared");

  // --- the recordings of the core's own merged pull requests ---
  const recorded = recordings();
  ok(recorded.length >= 5, `the core's merged pull requests are recorded under reports/security-review-host/ (${recorded.length})`);
  for (const { file, record: one } of recorded) {
    const differs = compare(one);
    ok(differs.length === 0, `${file}: the status agrees with the host's record${differs.length ? `: ${differs.join("; ")}` : ""}`);
    ok(securityReviews(one).length > 0 && Array.isArray(one.threads), `${file}: it holds a Codex security review in the host's list, and the threads`);
    const logins = [...JSON.stringify(one).matchAll(/"login":"([^"]*)"/gu)].map((m) => m[1]);
    ok(logins.every((login) => login === OWNER || login.endsWith("[bot]") || login === "web-flow" || /^someone-\d+$/u.test(login)), `${file}: no login but the owner's account, an app's, GitHub's own and stand-ins (floor rule 11)`);
  }
  const rights = JSON.parse(fs.readFileSync(path.join(FOLDER, "rights.json"), "utf8"));
  if (rights.unread) console.log(`note who may write was not compared: the host's rights are not recorded (${rights.unread}); the recorder, run where gh answers for the owner's account, records them`);
  else ok(same(compareRights(rights), []), "writersOf() agrees with the host's push list");

  process.exit(failed ? 1 : 0);
}
