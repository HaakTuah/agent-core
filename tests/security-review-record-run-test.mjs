// Checks the recorder of the host's own record of the security review (#626; #593, point 9),
// scripts/security-review-record.mjs, on a host this test stands in for: what it reads, which pull requests it chooses,
// what it writes and how it fails. What it keeps of the host's answers: tests/security-review-record-test.mjs.
//
//   node tests/security-review-record-run-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { compareRights, recordings } from "../scripts/security-review-host.mjs";
import { chosen, fetchPull, main, recordOf, unreadOf, why, writeRights } from "../scripts/security-review-record.mjs";
import { HEAD, OTHER, answer, cleared, found, host, posted, record, refusal, review, same, summary } from "./security-review-host-test.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const writer = { permission: "write", role_name: "write", user: { ...OTHER, permissions: { push: true } } };

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
const reset = fetchPull(host(pullAnswers(7, { [`${at}/issues/7/comments`]: [[...merged.comments, stranger]], [`${at}/collaborators/a-stranger/permission`]: refusal(`Get "https://api.github.com/${at}/collaborators/a-stranger/permission": read tcp: connection reset by peer`) })).call, 7);
ok(reset.unread === `the rights of a commenter: Get "https://api.github.com/${at}/collaborators/<login>/permission": read tcp: connection reset by peer` && unreadOf({ message: `Command failed: gh api ${at}/collaborators/a-stranger/permission` }) === `Command failed: gh api ${at}/collaborators/<login>/permission`, "why a call failed keeps no login its route names (floor rule 11)");
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
  const gaps = path.join(dir, "gaps");
  ok(main(["--pr", "8", "--pr", "7"], { call: host({ ...pullAnswers(7), ...rightsAnswers }).call, folder: gaps, say, warn }) === 1 && /^FAIL: #8: the host could not give it \(gh: Not Found/u.test(warned.at(-1)) && mended(warned.at(-1))
    && same(recordings(gaps).map((r) => r.file), ["pr-7.json"]) && fs.existsSync(path.join(gaps, "rights.json")) && said.at(-1) === "No difference from the host's record.", "a pull request the host cannot give is refused, saying the mend, and the others, the rights and the comparison still follow");
  ok(main(["--count", "x"], { call: host({}).call, folder: out, say, warn }) === 2 && mended(warned.at(-1)), "a count it cannot read fails, saying the mend");
  ok(main(["--pr", "1"], { call: host({}).call, folder: out, say, warn }) === 1, "a pull request's number from 1 up is read");
  ok(main(["--pr", "0"], { call: host({}).call, folder: out, say, warn }) === 2 && main(["--count", "-1"], { call: host({}).call, folder: out, say, warn }) === 2 && main(["--count", "1.5"], { call: host({}).call, folder: out, say, warn }) === 2, "so does a number of no pull request, a count below none and one not whole");
  ok(main([], { call: host({}).call, folder: path.join(dir, "none"), say, warn }) === 1 && /^FAIL: the host could not be read \(gh: Not Found \(HTTP 404\)/u.test(warned.at(-1)) && mended(warned.at(-1)), "a host it cannot read fails, saying the mend");
  ok(main(["--pr", "7"], { call: host(everything).call, folder: path.join(dir, "fresh"), say, warn }) === 0 && fs.existsSync(path.join(dir, "fresh", "rights.json")), "the folder is made where it is not there, and the rights written beside the pull requests");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
