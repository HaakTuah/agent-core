// Checks the recorder of the host's own record of the security review (#626; #593, point 9),
// scripts/security-review-record.mjs: what it keeps of the host's answers (floor rule 11), and that what it keeps leaves
// the status's verdict as it was. Its reading of a host: tests/security-review-record-run-test.mjs; the comparisons:
// tests/security-review-host-test.mjs.
//
//   node tests/security-review-record-test.mjs
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { verdictOf } from "../scripts/security-review-host.mjs";
import { keep, recordOf, standIns } from "../scripts/security-review-record.mjs";
import { CODEX, HEAD, ME, OTHER, SEEN, BASE, answer, cleared, commit, finding, found, host, posted, record, review, same, summary } from "./security-review-host-test.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const writer = { permission: "write", role_name: "write", user: { ...OTHER, permissions: { push: true } } };

// --- what the recorder keeps ---
const as = standIns();
ok(as(OWNER) === OWNER && as(OWNER.toUpperCase()) === OWNER.toUpperCase() && as(CODEX.login) === CODEX.login && as("web-flow") === "web-flow" && as(null) === null, "the owner's account, an app's and GitHub's own keep their logins (floor rule 11)");
ok(as("a-stranger") === "someone-1" && as("another") === "someone-2" && as("A-Stranger") === "someone-1", "any other login is given a stand-in, the same for the same login in any case");
const raw = record({
  comments: [summary(found), posted(HEAD, "2026-11-12T11:00:00Z"), { id: 3, user: OTHER, author_association: "NONE", created_at: "2026-11-12T11:10:00Z", updated_at: "2026-11-12T11:10:00Z", body: "A word from a stranger." },
    { ...posted(SEEN, "2026-11-12T11:20:00Z", OTHER, "COLLABORATOR"), body: `Security review: ${SEEN}\nprose\nchecked head ${HEAD}\ncomments and steps' names alone in .github/` }],
  findings: [finding(31, "2026-11-12T10:00:00Z"), { ...finding(33, "2026-11-12T10:05:00Z"), user: OTHER, body: "A reply." }, { ...finding(34, "2026-11-12T10:06:00Z"), user: OTHER }],
  files: [{ filename: "scripts/a.mjs", status: "modified", patch: "x", additions: 1 }, { filename: ".github/workflows/a.yml", status: "modified", patch: "y" }, { filename: "b.md", previous_filename: ".claude/x.md", status: "renamed", patch: "z" }],
  reviews: [review(HEAD, "2026-11-12T10:00:00Z"), { ...review(HEAD, "2026-11-12T10:00:00Z"), user: OTHER }, { ...review(HEAD, "2026-11-12T10:00:00Z"), body: "<!-- codex-review-receipt:v1 -->\nno heading" }],
  commits: [{ ...commit, author: OTHER, node_id: "x" }], rights: [{ ...writer, user: { ...writer.user, id: 5 } }], threads: [{ resolved: false, first: 31 }] });
const kept = keep(raw, standIns());
ok(same(kept.comments.map((c) => c.id), [1, 2, 2]) && kept.comments[0].body === summary(found).body, "of the comments, Codex's summary, whole, and the posted reviews are kept, nothing else");
const among = keep(record({ comments: [{ ...finding(40, "2026-11-12T10:00:00Z") }, { ...finding(41, "x"), user: OTHER }, { ...summary(found), id: 42, user: OTHER }, { ...summary(found), id: 43, body: "Codex: <!-- codex-pull-request-review-summary -->" }, { ...posted(HEAD, "x"), id: 44, body: `Note. Security review: ${HEAD}` }] }), standIns()).comments;
ok(same(among.map((c) => [c.id, c.body]), [[40, "<!-- codex-security-review-finding:v1 -->"]]), "a finding of Codex's among the comments is kept, its first line; a look-alike of anyone else's, a summary not at the start, and a review not opening so are not");
const DEPENDABOT = { login: "dependabot[bot]", type: "Bot" };
const itsOwn = (over) => record({ pull: { ...record().pull, user: DEPENDABOT }, ...over });
ok(keep(itsOwn({ commits: [{ ...commit, author: null }] }), standIns()).commits[0].author === null, "a commit whose author the host cannot name keeps none");
const lines = keep(record({ comments: [{ ...posted(HEAD, "x"), body: `Security review: none needed\nchecked head ${HEAD}\n  nothing changed in .github/\nprose: nothing changed in .github/\nXcomments and steps' names alone in .github/` }] }), standIns()).comments[0].body;
const outsiders = keep(record({ comments: [summary(found), { ...posted(HEAD, "x", OTHER, "NONE"), id: 50 }, { ...posted(HEAD, "x", OTHER, "CONTRIBUTOR"), id: 51 }, { ...posted(HEAD, "x", OTHER, "MEMBER"), id: 52 }] }), standIns()).comments;
ok(same(outsiders.map((c) => c.id), [1, 52]), "a posted review is kept only from an account the host calls a writer, as the status reads it; an outsider's text is not (floor rules 4, 11)");
const fork = keep(record({ pull: { ...record().pull, head: { sha: HEAD, repo: { full_name: "a-stranger/agent-core" } } } }), standIns()).pull;
ok(fork.head.repo.full_name === "someone-1/agent-core" && fork.base.repo.full_name === CORE, "a fork's owner in the head's name is a stand-in, the core's own name kept");
ok(lines === `Security review: none needed\nchecked head ${HEAD}\n  nothing changed in .github/`, "a posted review keeps its opening line, though it names no commit, and comment-only.mjs's lines only where they open a line");
ok(kept.comments[1].body === `Security review: ${HEAD}` && kept.comments[2].body === `Security review: ${SEEN}\nchecked head ${HEAD}\ncomments and steps' names alone in .github/`, "of a posted review, its first line and the lines that name a commit or what comment-only.mjs printed");
ok(kept.comments[2].user.login === "someone-1" && kept.rights[0].user.login === "someone-1", "a stranger's login is one stand-in throughout a recording");
ok(same(kept.findings, [{ id: 31, user: CODEX, author_association: "NONE", created_at: "2026-11-12T10:00:00Z", updated_at: "2026-11-12T10:00:00Z", body: "<!-- codex-security-review-finding:v1 -->" }]), "of the review comments, Codex's security findings, each body cut to its first line");
ok(same(kept.files, [{ filename: "scripts/a.mjs", status: "modified" }, { filename: ".github/workflows/a.yml", status: "modified" }, { filename: "b.md", previous_filename: ".claude/x.md", status: "renamed" }]), "of the files, no patch the status reads as more than pins moved");
const pins = { filename: ".github/workflows/a.yml", status: "modified", patch: `@@ -1 +1 @@\n-      - uses: actions/checkout@${SEEN} # v1\n+      - uses: actions/checkout@${HEAD} # v2` };
ok(same(keep(record({ files: [pins] }), standIns()).files, [pins]), "a patch that only moves pins is kept, which floor rule 3's count reads");
ok(kept.reviews.length === 2 && kept.reviews[0].body === "<!-- codex-review-receipt:v1 -->\n\n\n### 🛡️ Codex Security Review · _Automatically triggered_" && kept.reviews[1].body === "", "of the reviews, Codex's, each body up to its heading");
ok(same(kept.commits[0], { sha: HEAD, parents: [{ sha: BASE }] }), "of a commit, its SHA and parents");
ok(same(keep(itsOwn({ commits: [{ ...commit, author: OTHER, node_id: "x" }] }), standIns()).commits[0], { sha: HEAD, parents: [{ sha: BASE }], author: { login: "someone-1", type: "User" }, committer: { login: "web-flow", type: "User" }, commit: { verification: { verified: true } } }), "and on Dependabot's own pull request who wrote and committed it and whether GitHub signed it, a stranger a stand-in");
const signed = itsOwn({ comments: [], commits: [{ ...commit, sha: HEAD, author: DEPENDABOT, committer: { login: "web-flow", type: "User" } }], pull: { ...record().pull, user: DEPENDABOT, head: { sha: HEAD, repo: { full_name: CORE } } } });
ok(same(verdictOf(keep(signed, standIns())), verdictOf(signed)) && verdictOf(signed).done === true, "the status reads Dependabot's own on what is kept as on what the host gave");
ok(same(kept.rights[0], { permission: "write", role_name: "write", user: { login: "someone-1", type: "User", permissions: { push: true } } }), "of a rights answer, its permission, role and account");
ok(same(keep(record({ rights: [{ permission: "admin", role_name: "admin", user: ME }] }), standIns()).rights[0].user, ME), "an answer that gives no push keeps none");
ok(same(kept.pull, { ...raw.pull }) && kept.threads === raw.threads && !("unread" in kept), "the pull request's fields the status reads are kept, and the threads as given");
ok(keep(record({ unread: "refused" }), standIns()).unread === "refused", "rights the host refused are recorded as not read, with why");
ok(same(verdictOf(kept), verdictOf(raw, raw.rights)), "the status judges what is kept as it judges what the host gave");

ok(same(recordOf(raw), kept), "a pull request whose cut keeps the verdict is recorded");
ok(same(recordOf(record({ comments: [summary(found, "2026-11-12T12:00:00Z"), posted(HEAD, "2026-11-12T11:00:00Z")] })).comments[0].updated_at, "2026-11-12T12:00:00Z"), "a summary that last changed at the merge is recorded");
const dropping = (() => { try { recordOf(record({ comments: [summary(cleared), posted(HEAD, "2026-11-12T11:00:00Z")] }), (got, as) => ({ ...keep(got, as), comments: [] })); return ""; } catch (e) { return e.message; } })();
ok(mended(dropping) && /#7: the security-review status reads what the recorder leaves out .*keep\(\) of scripts\/security-review-record\.mjs/u.test(dropping), "a cut that changes the verdict is refused, saying the mend in the file keep() is in");
const after = (() => { try { recordOf(record({ comments: [summary(found, "2026-11-12T12:30:00Z")] })); return ""; } catch (e) { return e.message; } })();
ok(mended(after) && /#7: Codex's summary last changed at 2026-11-12T12:30:00Z, after the merge at 2026-11-12T12:00:00Z/u.test(after), "a summary changed after the merge is refused, saying the mend");
const gone = (() => { try { recordOf(record({ comments: [] })); return ""; } catch (e) { return e.message; } })();
ok(mended(gone) && /Codex's summary is not there or cannot be read/u.test(gone), "so is a pull request with no summary");
const lost = (() => { try { recordOf(record({ pull: { ...record().pull, changed_files: 3 }, files: [{ filename: "a" }, { filename: "b" }, { filename: ".github/c.yml", status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" }], comments: [summary(cleared), posted(HEAD, "2026-11-12T11:00:00Z")] })); return ""; } catch (e) { return e.message; } })();
ok(lost === "", "a pull request that changes what runs by itself is recorded with what floor rule 3's count reads");

process.exit(failed ? 1 : 0);
