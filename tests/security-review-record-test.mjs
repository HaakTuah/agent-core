// Checks the recorder of the host's own record of the security review (#626; #593, point 9),
// scripts/security-review-record.mjs: what it keeps of the host's answers (floor rule 11), that what it keeps leaves
// the status's verdict as it was, and its reading of a host this test stands in for. The comparisons:
// tests/security-review-host-test.mjs.
//
//   node tests/security-review-record-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { compareRights, recordings, verdictOf } from "../scripts/security-review-host.mjs";
import { chosen, fetchPull, keep, main, recordOf, standIns, why, writeRights } from "../scripts/security-review-record.mjs";
import { CODEX, HEAD, ME, OTHER, SEEN, BASE, answer, cleared, commit, finding, found, host, posted, record, refusal, review, same, summary } from "./security-review-cases.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const writer = { permission: "write", role_name: "write", user: { ...OTHER, permissions: { push: true } } };

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
const DEPENDABOT = { login: "dependabot[bot]", type: "Bot" };
const itsOwn = (over) => record({ pull: { ...record().pull, user: DEPENDABOT }, ...over });
ok(keep(itsOwn({ commits: [{ ...commit, author: null }] }), standIns()).commits[0].author === null, "a commit whose author the host cannot name keeps none");
const lines = keep(record({ comments: [{ ...posted(HEAD, "x"), body: `Security review: none needed\nchecked head ${HEAD}\n  nothing changed in .github/\nprose: nothing changed in .github/\nXcomments and steps' names alone in .github/` }] }), standIns()).comments[0].body;
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
const after = (() => { try { recordOf(record({ comments: [summary(found, "2026-11-12T12:30:00Z")] })); return ""; } catch (e) { return e.message; } })();
ok(mended(after) && /#7: Codex's summary last changed at 2026-11-12T12:30:00Z, after the merge at 2026-11-12T12:00:00Z/u.test(after), "a summary changed after the merge is refused, saying the mend");
const gone = (() => { try { recordOf(record({ comments: [] })); return ""; } catch (e) { return e.message; } })();
ok(mended(gone) && /Codex's summary is not there or cannot be read/u.test(gone), "so is a pull request with no summary");
const lost = (() => { try { recordOf(record({ pull: { ...record().pull, changed_files: 3 }, files: [{ filename: "a" }, { filename: "b" }, { filename: ".github/c.yml", status: "modified", patch: "@@ -1 +1 @@\n-a\n+b" }], comments: [summary(cleared), posted(HEAD, "2026-11-12T11:00:00Z")] })); return ""; } catch (e) { return e.message; } })();
ok(lost === "", "a pull request that changes what runs by itself is recorded with what floor rule 3's count reads");

// --- the recorder, on a host this test stands in for ---
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


process.exit(failed ? 1 : 0);
