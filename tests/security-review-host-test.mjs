// Checks the security-review status against the host's own record (#626; #593, point 9): the comparisons of
// scripts/security-review-host.mjs on cases made here, each failing where it should, then on the recordings of the
// core's own merged pull requests under tests/security-review-host/, offline, with no token; and the recorder itself,
// on a host this test stands in for.
//
//   node tests/security-review-host-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { FOLDER, SECURITY, atMerge, chosen, compare, compareRights, fetchPull, keep, main, recordOf, recordings, securityReviews, standIns, verdictOf, why, writeRights } from "../scripts/security-review-host.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const HEAD = "a".repeat(40), SEEN = "b".repeat(40), BASE = "c".repeat(40);
const CODEX = { login: "chatgpt-codex-connector[bot]", type: "Bot" };
const ME = { login: OWNER, type: "User" };
const OTHER = { login: "a-stranger", type: "User" };
const found = { commit_sha: HEAD, has_any_findings: true, has_unresolved_findings: true, status: "completed" };
const cleared = { ...found, has_unresolved_findings: false };
const summary = (security, at = "2026-11-12T10:30:00Z") => ({ id: 1, user: CODEX, author_association: "NONE", created_at: "2026-11-12T09:00:00Z", updated_at: at,
  body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { status: "completed" }, security_review: security })} -->\n| 🔒 **Security Review** | done |` });
const posted = (sha, at, user = ME, assoc = "OWNER") => ({ id: 2, user, author_association: assoc, created_at: at, updated_at: at, body: `Security review: ${sha}\nBlocking findings: 0.\nOther findings: 0.\nA line of prose.` });
const finding = (id, at) => ({ id, user: CODEX, author_association: "NONE", created_at: at, updated_at: at, path: "a.js", body: "<!-- codex-security-review-finding:v1 -->\n\n### A finding\n\nIts text." });
const review = (commit, at, kind = "🛡️ Codex Security Review · _Automatically triggered_") => ({ id: 9, user: CODEX, commit_id: commit, submitted_at: at,
  body: `<!-- codex-review-receipt:v1 -->\n\n\n### ${kind}\n\nHere are some suggestions.\n\n**Reviewed commit:** \`${commit.slice(0, 10)}\`` });
const commit = { sha: HEAD, parents: [{ sha: BASE }], author: ME, committer: { login: "web-flow", type: "User" }, commit: { verification: { verified: true } } };
// a merged pull request whose Codex security review found one thing on the head, and a review posted after it
const record = (over = {}) => ({
  pull: { number: 7, state: "closed", draft: false, merged_at: "2026-11-12T12:00:00Z", created_at: "2026-11-12T08:00:00Z", commits: 1, changed_files: 1, user: ME,
    head: { sha: HEAD, repo: { full_name: CORE } }, base: { repo: { full_name: CORE, owner: ME } } },
  comments: [summary(found), posted(HEAD, "2026-11-12T11:00:00Z")], findings: [finding(31, "2026-11-12T10:00:00Z")], commits: [commit],
  files: [{ filename: "scripts/a.mjs", status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" }], reviews: [review(HEAD, "2026-11-12T10:00:00Z")],
  threads: [{ resolved: false, first: 31 }], rights: [], ...over });

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
const answer = (login, role, permission = role === "maintain" ? "write" : role, type = "User", push = true) => ({ permission, role_name: role, user: { login, type, permissions: { push } } });
const listed = (login, role, type = "User") => ({ login, type, role_name: role });
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

// --- what the recorder keeps ---
const as = standIns();
ok(as(OWNER) === OWNER && as(OWNER.toUpperCase()) === OWNER.toUpperCase() && as(CODEX.login) === CODEX.login && as("web-flow") === "web-flow" && as(null) === null, "the owner's account, an app's and GitHub's own keep their logins (floor rule 11)");
ok(as("a-stranger") === "someone-1" && as("another") === "someone-2" && as("A-Stranger") === "someone-1", "any other login is given a stand-in, the same for the same login in any case");
const raw = record({
  comments: [summary(found), posted(HEAD, "2026-11-12T11:00:00Z"), { id: 3, user: OTHER, author_association: "NONE", created_at: "2026-11-12T11:10:00Z", updated_at: "2026-11-12T11:10:00Z", body: "A word from a stranger." },
    { ...posted(SEEN, "2026-11-12T11:20:00Z", OTHER, "CONTRIBUTOR"), body: `Security review: ${SEEN}\nprose\nchecked head ${HEAD}\ncomments and steps' names alone in .github/` }],
  findings: [finding(31, "2026-11-12T10:00:00Z"), { ...finding(33, "2026-11-12T10:05:00Z"), user: OTHER, body: "A reply." }, { ...finding(34, "2026-11-12T10:06:00Z"), user: OTHER }],
  files: [{ filename: "scripts/a.mjs", status: "modified", patch: "x", additions: 1 }, { filename: ".github/workflows/a.yml", status: "modified", patch: "y" }, { filename: "b.md", previous_filename: ".claude/x.md", status: "renamed", patch: "z" }],
  reviews: [review(HEAD, "2026-11-12T10:00:00Z"), { ...review(HEAD, "2026-11-12T10:00:00Z"), user: OTHER }, { ...review(HEAD, "2026-11-12T10:00:00Z"), body: "<!-- codex-review-receipt:v1 -->\nno heading" }],
  commits: [{ ...commit, author: OTHER, node_id: "x" }], rights: [{ ...writer, user: { ...writer.user, id: 5 } }], threads: [{ resolved: false, first: 31 }] });
const kept = keep(raw, standIns());
ok(same(kept.comments.map((c) => c.id), [1, 2, 2]) && kept.comments[0].body === summary(found).body, "of the comments, Codex's summary, whole, and the posted reviews are kept, nothing else");
const among = keep(record({ comments: [{ ...finding(40, "2026-11-12T10:00:00Z") }, { ...finding(41, "x"), user: OTHER }, { ...summary(found), id: 42, user: OTHER }, { ...summary(found), id: 43, body: "Codex: <!-- codex-pull-request-review-summary -->" }, { ...posted(HEAD, "x"), id: 44, body: `Note. Security review: ${HEAD}` }] }), standIns()).comments;
ok(same(among.map((c) => [c.id, c.body]), [[40, "<!-- codex-security-review-finding:v1 -->"]]), "a finding of Codex's among the comments is kept, its first line; a look-alike of anyone else's, a summary not at the start, and a review not opening so are not");
ok(keep(record({ commits: [{ ...commit, author: null }] }), standIns()).commits[0].author === null, "a commit whose author the host cannot name keeps none");
const lines = keep(record({ comments: [{ ...posted(HEAD, "x"), body: `Security review: none needed\nchecked head ${HEAD}\n  nothing changed in .github/\nprose: nothing changed in .github/\nXcomments and steps' names alone in .github/` }] }), standIns()).comments[0].body;
ok(lines === `Security review: none needed\nchecked head ${HEAD}\n  nothing changed in .github/`, "a posted review keeps its opening line, though it names no commit, and comment-only.mjs's lines only where they open a line");
ok(kept.comments[1].body === `Security review: ${HEAD}` && kept.comments[2].body === `Security review: ${SEEN}\nchecked head ${HEAD}\ncomments and steps' names alone in .github/`, "of a posted review, its first line and the lines that name a commit or what comment-only.mjs printed");
ok(kept.comments[2].user.login === "someone-1" && kept.commits[0].author.login === "someone-1" && kept.rights[0].user.login === "someone-1", "a stranger's login is one stand-in throughout a recording");
ok(same(kept.findings, [{ id: 31, user: CODEX, author_association: "NONE", created_at: "2026-11-12T10:00:00Z", updated_at: "2026-11-12T10:00:00Z", body: "<!-- codex-security-review-finding:v1 -->" }]), "of the review comments, Codex's security findings, each body cut to its first line");
ok(same(kept.files, [{ filename: "scripts/a.mjs", status: "modified" }, { filename: ".github/workflows/a.yml", status: "modified", patch: "y" }, { filename: "b.md", previous_filename: ".claude/x.md", status: "renamed", patch: "z" }]), "of the files, a patch only where the file runs by itself, on either side of a move");
ok(kept.reviews.length === 2 && kept.reviews[0].body === "<!-- codex-review-receipt:v1 -->\n\n\n### 🛡️ Codex Security Review · _Automatically triggered_" && kept.reviews[1].body === "", "of the reviews, Codex's, each body up to its heading");
ok(same(kept.commits[0], { sha: HEAD, parents: [{ sha: BASE }], author: { login: "someone-1", type: "User" }, committer: { login: "web-flow", type: "User" }, commit: { verification: { verified: true } } }), "of a commit, its SHA, parents, who wrote and committed it and whether GitHub signed it");
ok(same(kept.rights[0], { permission: "write", role_name: "write", user: { login: "someone-1", type: "User", permissions: { push: true } } }), "of a rights answer, its permission, role and account");
ok(same(keep(record({ rights: [{ permission: "admin", role_name: "admin", user: ME }] }), standIns()).rights[0].user, ME), "an answer that gives no push keeps none");
ok(same(kept.pull, { ...raw.pull }) && kept.threads === raw.threads && !("unread" in kept), "the pull request's fields the status reads are kept, and the threads as given");
ok(keep(record({ unread: "refused" }), standIns()).unread === "refused", "rights the host refused are recorded as not read, with why");
ok(same(verdictOf(kept), verdictOf(raw, raw.rights)), "the status judges what is kept as it judges what the host gave");

ok(same(recordOf(raw), kept), "a pull request whose cut keeps the verdict is recorded");
ok(same(recordOf(record({ comments: [summary(found, "2026-11-12T12:00:00Z"), posted(HEAD, "2026-11-12T11:00:00Z")] })).comments[0].updated_at, "2026-11-12T12:00:00Z"), "a summary that last changed at the merge is recorded");
const after = (() => { try { recordOf(record({ comments: [summary(found, "2026-11-12T12:30:00Z")] })); return ""; } catch (e) { return e.message; } })();
ok(mended(after) && /#7: Codex's summary last changed at 2026-11-12T12:30:00Z, after the merge at 2026-11-12T12:00:00Z/u.test(after), "a summary changed after the merge is refused, saying the mend");
const gone = (() => { try { recordOf(record({ comments: [] })); return ""; } catch (e) { return e.message; } })();
ok(mended(gone) && /Codex's summary is not there or cannot be read/u.test(gone), "so is a pull request with no summary");
const lost = (() => { try { recordOf(record({ pull: { ...record().pull, changed_files: 3 }, files: [{ filename: "a" }, { filename: "b" }, { filename: ".github/c.yml", status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" }], comments: [summary(cleared), posted(HEAD, "2026-11-12T11:00:00Z")] })); return ""; } catch (e) { return e.message; } })();
ok(lost === "", "a pull request that changes what runs by itself is recorded with what floor rule 3's count reads");

// --- the recorder, on a host this test stands in for ---
const refusal = (text) => Object.assign(new Error("gh failed"), { stderr: `${text}\n` });
const host = (answers) => {
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
const at = `repos/${CORE}`;
const merged = record();
const pullAnswers = (n, over = {}) => ({
  [`${at}/pulls/${n}`]: { ...merged.pull, number: n }, [`${at}/issues/${n}/comments`]: [merged.comments], [`${at}/pulls/${n}/comments`]: [merged.findings],
  [`${at}/pulls/${n}/commits`]: [merged.commits], [`${at}/pulls/${n}/files`]: [merged.files], [`${at}/pulls/${n}/reviews`]: [merged.reviews],
  graphql: [{ data: { repository: { pullRequest: { reviewThreads: { nodes: [{ isResolved: false, comments: { nodes: [{ databaseId: 31 }] } }, { isResolved: true, comments: { nodes: [] } }] } } } } }], ...over });
const fetched = fetchPull(host(pullAnswers(7)).call, 7);
ok(same(fetched.threads, [{ resolved: false, first: 31 }, { resolved: true, first: undefined }]) && same(fetched.rights, []) && fetched.pull.number === 7 && fetched.reviews.length === 1, "the five inputs, the reviews and the threads are read from the host, GraphQL's threads as { resolved, first }");
const paged = host(pullAnswers(7));
fetchPull(paged.call, 7);
ok(paged.calls.includes(`--paginate --slurp ${at}/issues/7/comments?per_page=100`) && paged.calls.includes(`${at}/pulls/7`), "each list is read whole, a hundred to a page, as the workflow reads it");
const [owner, name] = CORE.split("/");
ok(paged.calls.some((c) => c.startsWith("graphql --paginate --slurp -f query=query($owner:String!,$name:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$endCursor){pageInfo{hasNextPage endCursor} nodes{isResolved comments(first:1){nodes{databaseId}}}}}}}")
  && c.endsWith(` -f owner=${owner} -f name=${name} -F number=7`)), "the threads are read through GraphQL, every page, each with its first comment");
const ccr = fetchPull(host(pullAnswers(7, { graphql: refusal("GraphQL is not available"), [`${at}/pulls/7/ccr/review_threads`]: [{ resolved: false, comment_ids: [31, 40] }, { resolved: true, comment_ids: null }] })).call, 7);
ok(same(ccr.threads, [{ resolved: false, first: 31 }, { resolved: true, first: undefined }]), "where GraphQL is refused, the cloud session's route gives the threads");
const stranger = { ...posted(HEAD, "2026-11-12T11:00:00Z", OTHER, "COLLABORATOR"), body: "Code review: x" };
const by = (login, over = {}) => ({ ...stranger, user: { login, type: "User" }, ...over });
const asks = host(pullAnswers(7, { [`${at}/issues/7/comments`]: [[...merged.comments, stranger, by("a-stranger", { body: "**Design check:** y" }), by("m", { body: "Security review: x", author_association: "MEMBER" }), by("o", { body: "Design check: x", author_association: "OWNER" }),
  by("none", { author_association: "NONE" }), by("contributor", { author_association: "CONTRIBUTOR" }), by("app", { user: { login: "app", type: "Bot" } }), by(OWNER.toLowerCase()), by("hello", { body: "Hello" }), by("quoted", { body: "> Code review: x" }), by("nobody", { user: null })]],
  [`${at}/collaborators/a-stranger/permission`]: writer, [`${at}/collaborators/m/permission`]: writer, [`${at}/collaborators/o/permission`]: writer }));
const rightsRead = fetchPull(asks.call, 7);
ok(same(rightsRead.rights, [writer, writer, writer]) && same(asks.calls.filter((c) => c.includes("/permission")), ["a-stranger", "m", "o"].map((login) => `${at}/collaborators/${login}/permission`)), "the rights are read once for each login the workflow reads them for: a person with a say who posted a review's opening, not the owner");
const refused = fetchPull(host(pullAnswers(7, { [`${at}/issues/7/comments`]: [[...merged.comments, stranger]], [`${at}/collaborators/a-stranger/permission`]: refusal("gh: Access to this GitHub API path is not permitted through this proxy. (HTTP 403)") })).call, 7);
ok(same(refused.rights, []) && refused.unread === "the rights of a commenter: gh: Access to this GitHub API path is not permitted through this proxy. (HTTP 403)", "rights the host refuses are not read, with why");
ok(why({ message: "one\ntwo" }) === "two" && why({ stderr: "", message: "m" }) === "m" && why(undefined) === "undefined" && why({ stderr: "x".repeat(400) }).length === 300, "why a call failed is its last line, cut to 300 characters");

const list = (pulls, rest = []) => ({ [`${at}/pulls`]: (args) => (/&page=1$/u.test(args[0]) ? pulls : rest) });
const withReviews = (n, kinds) => ({ [`${at}/pulls/${n}/reviews`]: [kinds.map((kind) => review(HEAD, "2026-11-12T10:00:00Z", kind))] });
const candidates = { ...list([{ number: 2, merged_at: "2026-11-09T00:00:00Z" }, { number: 3, merged_at: "2026-11-10T00:00:00Z" }, { number: 4, merged_at: null }, { number: 5, merged_at: "2026-11-11T00:00:00Z" }, { number: 6, merged_at: "2026-11-12T00:00:00Z" }]),
  ...withReviews(3, ["🛡️ Codex Security Review"]), ...withReviews(4, ["🛡️ Codex Security Review"]), ...withReviews(5, ["🛡️ Codex Security Review"]), ...withReviews(6, ["💡 Codex Review"]),
  ...withReviews(2, ["💡 Codex Review", "🛡️ Codex Security Review"]) };
ok(same(chosen(host(candidates).call, 8), [5, 3, 2]), "the newest merged pull requests with a Codex security review in the host's list are chosen, newest first");
ok(same(chosen(host(candidates).call, 1), [5]) && same(chosen(host(candidates).call, 0), []), "at most the count asked");
const full = Array.from({ length: 100 }, (_, i) => ({ number: 100 + i, merged_at: null }));
const pagesAsked = host({ ...list(full, full) });
ok(same(chosen(pagesAsked.call, 8), []) && pagesAsked.calls.filter((c) => c.startsWith(`${at}/pulls?`)).length === 5, "five pages of pull requests at most are read");
const twice = host({ ...candidates, ...list([...full.slice(0, 98), { number: 5, merged_at: "2026-11-11T00:00:00Z" }, { number: 3, merged_at: "2026-11-10T00:00:00Z" }], [{ number: 5, merged_at: "2026-11-11T00:00:00Z" }, { number: 2, merged_at: "2026-11-09T00:00:00Z" }]) });
ok(same(chosen(twice.call, 8), [5, 3, 2]) && twice.calls.filter((c) => c.startsWith(`${at}/pulls?`)).length === 2, "a pull request listed again on a later page is chosen once, and a page of fewer than a hundred is the last");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "security-review-host-"));
try {
  const said = [];
  const say = (line) => said.push(line);
  const rightsAnswers = { [`${at}/collaborators`]: [[{ login: OWNER, type: "User", role_name: "admin", id: 1 }, { login: "a-stranger", type: "User", role_name: "write" }]],
    [`${at}/collaborators/${OWNER}/permission`]: answer(OWNER, "admin"), [`${at}/collaborators/a-stranger/permission`]: answer("a-stranger", "write") };
  writeRights(host(rightsAnswers).call, dir, say);
  const written = JSON.parse(fs.readFileSync(path.join(dir, "rights.json"), "utf8"));
  ok(same(written.pushList, [{ login: OWNER, type: "User", role_name: "admin" }, { login: "someone-1", type: "User", role_name: "write" }]) && written.answers[1].user.login === "someone-1" && said.at(-1) === "Recorded the push list: 2 account(s).", "the push list and each login's rights are recorded, a stranger's login a stand-in");
  ok(same(compareRights(written), []), "and compared, the stand-ins the same in both");
  writeRights(host({ [`${at}/collaborators`]: refusal("gh: refused (HTTP 403)") }).call, dir, say);
  ok(same(JSON.parse(fs.readFileSync(path.join(dir, "rights.json"), "utf8")), written) && said.at(-1) === "The host's rights could not be read (gh: refused (HTTP 403)): the recording that stands is kept.", "rights the host refuses now leave the recording that stands");
  fs.rmSync(path.join(dir, "rights.json"));
  writeRights(host({}).call, dir, say);
  ok(JSON.parse(fs.readFileSync(path.join(dir, "rights.json"), "utf8")).unread === `gh: Not Found (HTTP 404) for --paginate --slurp ${at}/collaborators?affiliation=all&permission=push&per_page=100` && /^The host's rights could not be read: gh: Not Found/u.test(said.at(-1)), "with none standing, they are recorded as not read, with why");
  writeRights(host({}).call, dir, say);
  ok(/^The host's rights could not be read: /u.test(said.at(-1)), "and stay so while the host refuses them");

  const warned = [];
  const warn = (line) => warned.push(line);
  const out = path.join(dir, "out");
  const everything = { ...pullAnswers(7), ...pullAnswers(8, { [`${at}/issues/8/comments`]: [[summary(found, "2026-11-12T12:30:00Z")]] }), ...rightsAnswers };
  ok(main(["--pr", "7"], { call: host(everything).call, folder: out, say, warn }) === 0 && same(recordings(out).map((r) => r.file), ["pr-7.json"]) && said.at(-1) === "No difference from the host's record." && said.includes("Recorded #7."), "a pull request asked for is recorded, and the comparison prints that nothing differs");
  ok(same(recordings(out)[0].record, recordOf(fetchPull(host(everything).call, 7))), "what is written is the record");
  ok(main(["--pr", "8", "--pr", "7"], { call: host(everything).call, folder: out, say, warn }) === 1 && /^FAIL: #8: Codex's summary last changed/u.test(warned.at(-1)) && mended(warned.at(-1)) && recordings(out).length === 1, "a pull request refused fails the run, saying the mend, and the others are still recorded");
  fs.writeFileSync(path.join(out, "pr-9.json"), JSON.stringify(record({ comments: [summary(cleared)] })));
  fs.writeFileSync(path.join(out, "note.json"), "{}");
  fs.writeFileSync(path.join(out, "xpr-1.json"), "{}");
  fs.writeFileSync(path.join(out, "pr-1.json.bak"), "{}");
  ok(main(["--count", "0"], { call: host(everything).call, folder: out, say, warn }) === 0 && said.at(-1) === "1 difference(s) from the host's record." && /^#7: Codex's security finding 31/u.test(said.at(-2)), "every recording in the folder is compared, each difference printed, and the run passes: the test fails on them");
  ok(main(["--count", "x"], { call: host({}).call, folder: out, say, warn }) === 2 && mended(warned.at(-1)), "a count it cannot read fails, saying the mend");
  ok(main(["--pr", "1"], { call: host({}).call, folder: out, say, warn }) === 1, "a pull request's number from 1 up is read");
  ok(main(["--pr", "0"], { call: host({}).call, folder: out, say, warn }) === 2 && main(["--count", "-1"], { call: host({}).call, folder: out, say, warn }) === 2 && main(["--count", "1.5"], { call: host({}).call, folder: out, say, warn }) === 2, "so does a number of no pull request, a count below none and one not whole");
  ok(main([], { call: host({}).call, folder: path.join(dir, "none"), say, warn }) === 1 && /^FAIL: the host could not be read \(gh: Not Found \(HTTP 404\)/u.test(warned.at(-1)) && mended(warned.at(-1)), "a host it cannot read fails, saying the mend");
  ok(main(["--pr", "7"], { call: host(everything).call, folder: path.join(dir, "fresh"), say, warn }) === 0 && fs.existsSync(path.join(dir, "fresh", "rights.json")), "the folder is made where it is not there, and the rights written beside the pull requests");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- the recordings of the core's own merged pull requests ---
const recorded = recordings();
ok(recorded.length >= 5, `the core's merged pull requests are recorded under tests/security-review-host/ (${recorded.length})`);
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
