// The security-review status against the host's own record (#626; #593, point 9): the host is the authority on who
// may write and on what a pull request's reviews are, so this records, for the core's own merged pull requests that
// had a Codex security review in the host's list of reviews, what the host says of them, and compares the status with
// it. Run by hand, or by the session that takes the core's monthly state report, in a clone of the core where gh
// answers for the owner's account; it writes one file per pull request under tests/security-review-host/ and the
// rights in rights.json there, then prints the comparison. tests/security-review-host-test.mjs reads the files
// offline, with no token, and fails where the comparison finds a difference.
//
// What it records of each pull request: the five inputs security-review.yml fetches (the pull request, its comments,
// its review comments, its commits and its files), the host's list of its reviews (pulls/N/reviews), its review
// threads (GraphQL's reviewThreads, or the cloud session's pulls/N/ccr/review_threads where GraphQL is refused) and the
// rights the workflow would read for its commenters (collaborators/<login>/permission). Of the repository: the host's
// push list (collaborators?affiliation=all&permission=push) and the rights answer of each login on it. These are the
// core's own public pull requests, the owner's (#593, point 9): no other repository is read.
//
// It keeps only the fields the comparison reads (floor rule 11): of the comments, Codex's summary and findings and the
// posted "Security review:"; of the reviews, Codex's, each body cut after its heading; of the files, a patch only where
// the file runs by itself. Any login but the owner's account, an app's and GitHub's own (web-flow) is given a stand-in,
// the same within a pull request. It refuses to write a pull request whose judge() on what it keeps differs from
// judge() on what the host gave, so the cut drops nothing the status reads. A rights answer the host refuses (a cloud
// session's proxy refuses the collaborators routes) is recorded as not read, with why, and a recording of them that
// stands is kept.
//
// The comparisons (compare, compareRights), each a kind of the pass recorded on #624
// (reports/2026-11-18-the-security-review-status-read-whole.md):
//   - writersOf() and the push list name the same logins, but for one listed on purpose: an app's account, and a custom
//     role, which counts for no one (W5-W7, W11);
//   - no Codex security review in pulls/N/reviews was submitted after the summary's last change, which the status takes
//     as the latest a finding can have come (F9, F10);
//   - the summary names the commit of Codex's newest security review, where its findings stand (F13, F14);
//   - an unresolved thread a Codex security finding opened does not meet a status that passes with no "Security
//     review:" posted after it, the pull request judged as it stood at its merge (F9).
// Codex's running state has no authority outside its summary, so it gets no comparison.
//
//   node scripts/security-review-host.mjs [--count N] [--pr N]...     (N: 8 where none is given)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RUNS } from "./comment-only.mjs";
import { CORE, OWNER } from "./core-address.mjs";
import { FINDING, POSTED, codexState, codexs, counted, judge, writersOf } from "./security-review.mjs";
import { started } from "./started.mjs";

export const FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "security-review-host");
// how a security review of Codex's opens in the host's list of reviews, its kind given by the heading after the receipt
export const SECURITY = /^<!-- codex-review-receipt:v1 -->\s*### 🛡️ Codex Security Review/u;
// the roles GitHub defines; any other is a custom role (W6)
const ROLES = ["read", "triage", "write", "maintain", "admin"];
const flat = (list) => (Array.isArray(list) ? list.flat() : []).filter((entry) => entry !== null && typeof entry === "object");
const time = (at) => Date.parse(at);
const lower = (login) => String(login).toLowerCase();

// Codex's security reviews among the host's reviews of a pull request, submitted by its merge
export const securityReviews = (record) => flat(record.reviews).filter((review) => codexs(review) && SECURITY.test(review.body) && time(review.submitted_at) <= time(record.pull.merged_at));
// the pull request as it stood at its merge, as the workflow's last run read it: open and no draft, with what came by
// then (a comment's time unreadable is kept, as the host gave it)
export function atMerge(record) {
  const by = (entry) => !(time(entry.created_at) > time(record.pull.merged_at));
  const pull = { ...record.pull, state: "open", draft: false };
  return [pull, flat(record.comments).filter(by), flat(record.findings).filter(by), record.commits, record.files];
}
export const verdictOf = (record, rights = record.rights) => judge(...atMerge(record), true, { rights: Array.isArray(rights) ? rights : [] });

// what differs between the status and the host's record of one pull request's reviews: a list of lines, empty where
// nothing does
export function compare(record) {
  const n = `#${record.pull.number}`;
  const summary = codexState(record.comments);
  if (!summary.state) return [`${n}: Codex's summary is ${summary.unread ? "there but cannot be read" : "not there"}, so nothing of its security review can be compared`];
  const reviews = securityReviews(record);
  const out = reviews.filter((review) => !(time(review.submitted_at) <= time(summary.at)))
    .map((review) => `${n}: Codex's security review ${review.id} was submitted at ${review.submitted_at}, after the summary last changed (${summary.at}), which the status takes as the latest a finding can have come`);
  return [...out, ...commitDiffers(n, summary.state.security_review, reviews), ...threadsOpen(n, record)];
}
// where the summary says findings stand, the commit it names is that of Codex's newest security review, and where it
// says none do, no security review of Codex's (each of which carries findings) is on that commit
function commitDiffers(n, said, reviews) {
  if (said?.status !== "completed") return [];
  const newest = reviews.reduce((last, review) => (last === undefined || time(review.submitted_at) > time(last.submitted_at) ? review : last), undefined);
  if (said.has_any_findings === true && newest !== undefined && newest.commit_id !== said.commit_sha) return [`${n}: the summary names ${said.commit_sha} for Codex's security review, but its newest review in the host's list is on ${newest.commit_id}`];
  if (said.has_any_findings !== true && reviews.some((review) => review.commit_id === said.commit_sha)) return [`${n}: the summary says Codex's security review of ${said.commit_sha} found nothing, but the host lists a security review of Codex's on that commit`];
  return [];
}
// an unresolved thread a Codex security finding opened, where the status passed with no "Security review:" posted
// after that finding
function threadsOpen(n, record) {
  if (!Array.isArray(record.threads)) return [];
  const [pull, comments, findings] = atMerge(record);
  const byId = new Map(findings.map((comment) => [comment.id, comment]));
  const open = record.threads.filter((thread) => thread.resolved === false).map((thread) => byId.get(thread.first))
    .filter((comment) => comment !== undefined && codexs(comment) && FINDING.test(comment.body));
  const verdict = verdictOf(record);
  if (!verdict.done) return [];
  const whose = counted(pull, [], writersOf(record.rights));
  const posted = comments.filter((comment) => POSTED.test(comment.body) && whose(comment.user));
  return open.filter((finding) => !posted.some((comment) => time(comment.created_at) > time(finding.created_at)))
    .map((finding) => `${n}: Codex's security finding ${finding.id} is unresolved on the merged head, with no "Security review:" posted after it, yet the status passed: ${verdict.why}`);
}

// what differs between writersOf() and the host's push list: a list of lines, empty where nothing does
export function compareRights(rights) {
  const answers = flat(rights.answers), writers = writersOf(answers);
  const listed = flat(rights.pushList);
  const pushers = new Set(listed.map((entry) => lower(entry.login)));
  const out = [];
  for (const entry of listed) {
    const login = lower(entry.login);
    if (writers.has(login)) continue;
    const answer = answers.find((each) => lower(each.user?.login) === login);
    if (answer === undefined) out.push(`${entry.login} is on the host's push list, but no rights answer of theirs is recorded`);
    else if (!onPurpose(answer)) out.push(`${entry.login} is on the host's push list, but writersOf() does not count them (role ${answer.role_name}, permission ${answer.permission})`);
  }
  for (const login of writers) if (!pushers.has(login)) out.push(`writersOf() counts ${login}, who is not on the host's push list`);
  return out;
}
// the two listed on purpose, as the host's answer gives them: an app's account, which writersOf() never counts, and a
// custom role, which counts for no one (security-review.mjs, writersOf)
const onPurpose = (answer) => answer.user?.type !== "User" || !ROLES.includes(answer.role_name);

// --- the recording ---

// the host, through gh: a call is gh api's arguments, its answer the JSON gh prints (the test hands in its own)
export const gh = (args) => JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }));
const pages = (call, route) => flat(call(["--paginate", "--slurp", `${route}${route.includes("?") ? "&" : "?"}per_page=100`]));
// why a call failed, in the host's or gh's own words, one line
export const why = (e) => String(e?.stderr || e?.message).trim().split("\n").at(-1).slice(0, 300);

// a stand-in for each login but the owner's account, an app's and GitHub's own, the same within one recording
export function standIns() {
  const given = new Map();
  return (login) => {
    if (typeof login !== "string" || lower(login) === lower(OWNER) || login.endsWith("[bot]") || login === "web-flow") return login;
    if (!given.has(lower(login))) given.set(lower(login), `someone-${given.size + 1}`);
    return given.get(lower(login));
  };
}
// (an account the host cannot name, a commit's author whose address matches none, is null)
const userOf = (user, as) => (user ? { login: as(user.login), type: user.type } : user);
const firstLines = (body, upTo) => body.split("\n").slice(0, upTo).join("\n");

// what is kept of each input: the fields judge() and the comparisons read
export function keep(raw, as) {
  return { pull: pullKept(raw.pull, as), comments: flat(raw.comments).filter(kept).map((c) => commentKept(c, as, bodyKept(c.body))),
    findings: flat(raw.findings).filter((c) => codexs(c) && FINDING.test(c.body)).map((c) => commentKept(c, as, firstLines(c.body, 1))),
    commits: flat(raw.commits).map((c) => commitKept(c, as)), files: flat(raw.files).map(fileKept), reviews: flat(raw.reviews).filter(codexs).map((r) => reviewKept(r, as)),
    threads: raw.threads, rights: flat(raw.rights).map((answer) => rightOf(answer, as)), ...(raw.unread ? { unread: raw.unread } : {}) };
}
const pullKept = (p, as) => ({ number: p.number, state: p.state, draft: p.draft, merged_at: p.merged_at, created_at: p.created_at, commits: p.commits, changed_files: p.changed_files,
  user: userOf(p.user, as), head: { sha: p.head.sha, repo: { full_name: p.head.repo?.full_name } }, base: { repo: { full_name: p.base.repo.full_name, owner: userOf(p.base.repo.owner, as) } } });
// of the comments, Codex's summary and security findings, and the posted "Security review:"
const SUMMARY_OPENS = /^<!-- codex-pull-request-review-summary -->/u;
const kept = (c) => (codexs(c) && (SUMMARY_OPENS.test(c.body) || FINDING.test(c.body))) || POSTED.test(c.body);
const commentKept = (c, as, body) => ({ id: c.id, user: userOf(c.user, as), author_association: c.author_association, created_at: c.created_at, updated_at: c.updated_at, body });
// what the status reads of a comment's body: Codex's summary whole, a finding's first line, and of a posted review its
// first line and each that names a commit or says what comment-only.mjs printed
const READ_LINES = /[0-9a-f]{40}|^\s*(?:comments and steps' names alone in \.github\/|nothing changed in \.github\/)/iu;
function bodyKept(body) {
  if (SUMMARY_OPENS.test(body)) return body;
  if (FINDING.test(body)) return firstLines(body, 1);
  return body.split("\n").filter((line, i) => i === 0 || READ_LINES.test(line)).join("\n");
}
const commitKept = (c, as) => ({ sha: c.sha, parents: flat(c.parents).map((parent) => ({ sha: parent.sha })), author: userOf(c.author, as), committer: userOf(c.committer, as),
  commit: { verification: { verified: c.commit.verification?.verified } } });
// of the files, a patch only where the file runs by itself, as the status reads it
const fileKept = (f) => ({ filename: f.filename, previous_filename: f.previous_filename, status: f.status, ...([f.filename, f.previous_filename].some((name) => RUNS.test(name)) ? { patch: f.patch } : {}) });
// of Codex's reviews, the body up to its heading, which says its kind
const reviewKept = (r, as) => ({ id: r.id, user: userOf(r.user, as), commit_id: r.commit_id, submitted_at: r.submitted_at, body: firstLines(r.body, String(r.body).split("\n").findIndex((line) => line.startsWith("###")) + 1) });
const rightOf = (answer, as) => ({ permission: answer.permission, role_name: answer.role_name, user: { ...userOf(answer.user, as), ...(answer.user?.permissions ? { permissions: { push: answer.user.permissions.push } } : {}) } });

// the review threads, each { resolved, first: the id of its first comment }: GraphQL where the host answers it, else
// the cloud session's route
function threadsOf(call, n) {
  const [owner, name] = CORE.split("/");
  const query = "query($owner:String!,$name:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$endCursor){pageInfo{hasNextPage endCursor} nodes{isResolved comments(first:1){nodes{databaseId}}}}}}}";
  try {
    const got = call(["graphql", "--paginate", "--slurp", "-f", `query=${query}`, "-f", `owner=${owner}`, "-f", `name=${name}`, "-F", `number=${n}`]);
    return flat(got).flatMap((page) => page.data.repository.pullRequest.reviewThreads.nodes).map((t) => ({ resolved: t.isResolved, first: t.comments.nodes[0]?.databaseId }));
  } catch {
    return flat(call([`repos/${CORE}/pulls/${n}/ccr/review_threads`])).map((t) => ({ resolved: t.resolved, first: Array.isArray(t.comment_ids) ? t.comment_ids[0] : undefined }));
  }
}
// the logins whose rights the workflow reads: each that posted a "Security review:", "Code review:" or "Design
// check:" with a say in the repository, a person's account, but the owner (security-review.yml)
const commenters = (comments) => [...new Set(flat(comments).filter((c) => typeof c.body === "string" && /^(\*\*)?(Security review|Code review|Design check):/u.test(c.body)
  && ["OWNER", "MEMBER", "COLLABORATOR"].includes(c.author_association) && c.user?.type === "User" && lower(c.user.login) !== lower(OWNER)).map((c) => c.user.login))];

function rightsOf(call, logins) {
  const rights = [];
  for (const login of logins) {
    try { rights.push(call([`repos/${CORE}/collaborators/${login}/permission`])); } catch (e) { return { rights, unread: `the rights of a commenter: ${why(e)}` }; }
  }
  return { rights };
}
// what the host gives of one merged pull request
export function fetchPull(call, n) {
  const at = `repos/${CORE}`;
  const raw = { pull: call([`${at}/pulls/${n}`]), comments: pages(call, `${at}/issues/${n}/comments`), findings: pages(call, `${at}/pulls/${n}/comments`),
    commits: pages(call, `${at}/pulls/${n}/commits`), files: pages(call, `${at}/pulls/${n}/files`), reviews: pages(call, `${at}/pulls/${n}/reviews`) };
  raw.threads = threadsOf(call, n);
  return { ...raw, ...rightsOf(call, commenters(raw.comments)) };
}
// the record of one pull request, or a failure where Codex's summary changed after the merge (what the status read
// then cannot be known) or where what it keeps would change the status's verdict
export function recordOf(raw) {
  const at = codexState(raw.comments).at;
  if (!(time(at) <= time(raw.pull.merged_at))) throw new Error(`FAIL: #${raw.pull.number}: Codex's summary ${at ? `last changed at ${at}, after the merge at ${raw.pull.merged_at}` : "is not there or cannot be read"}, so what the status read at the merge cannot be known. Mend: record another pull request (--pr N)`);
  const record = keep(raw, standIns());
  const before = JSON.stringify(verdictOf(raw, raw.rights)), after = JSON.stringify(verdictOf(record));
  if (before !== after) throw new Error(`FAIL: #${raw.pull.number}: the security-review status reads what the recorder leaves out (${before} against ${after}). Mend: keep the field it reads in keep() of scripts/security-review-host.mjs, and record it again`);
  return record;
}

// the newest merged pull requests with a Codex security review in the host's list of reviews, at most count
export function chosen(call, count) {
  const picked = [];
  for (let page = 1; page <= 5 && picked.length < count; page++) {
    const listed = call([`repos/${CORE}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`]);
    for (const p of listed.filter((each) => each.merged_at && !picked.includes(each.number)).sort((a, b) => time(b.merged_at) - time(a.merged_at))) {
      if (picked.length < count && pages(call, `repos/${CORE}/pulls/${p.number}/reviews`).some((review) => codexs(review) && SECURITY.test(review.body))) picked.push(p.number);
    }
    if (listed.length < 100) break;
  }
  return picked;
}
// the push list and each login's rights answer, or why they could not be read
function fetchRights(call) {
  try {
    const pushList = pages(call, `repos/${CORE}/collaborators?affiliation=all&permission=push`).map((entry) => ({ login: entry.login, type: entry.type, role_name: entry.role_name }));
    const answers = pushList.map((entry) => call([`repos/${CORE}/collaborators/${entry.login}/permission`]));
    return { pushList, answers };
  } catch (e) { return { unread: why(e) }; }
}
// the rights, written to rights.json in the folder: a recording that stands is kept where the host refuses them now
export function writeRights(call, folder, say) {
  const file = path.join(folder, "rights.json");
  const got = fetchRights(call);
  const stands = fs.existsSync(file) && !JSON.parse(fs.readFileSync(file, "utf8")).unread;
  if (got.unread && stands) return say(`The host's rights could not be read (${got.unread}): the recording that stands is kept.`);
  const as = standIns();
  const rights = got.unread ? { unread: got.unread } : { pushList: got.pushList.map((entry) => ({ ...entry, login: as(entry.login) })), answers: got.answers.map((answer) => rightOf(answer, as)) };
  fs.writeFileSync(file, `${JSON.stringify(rights, null, 1)}\n`);
  return say(got.unread ? `The host's rights could not be read: ${got.unread}` : `Recorded the push list: ${rights.pushList.length} account(s).`);
}

// the recordings in a folder, each as { file, record }
export const recordings = (folder = FOLDER) => fs.readdirSync(folder).filter((name) => /^pr-\d+\.json$/u.test(name)).sort()
  .map((name) => ({ file: name, record: JSON.parse(fs.readFileSync(path.join(folder, name), "utf8")) }));

// records what it is asked and prints the comparison; its exit code: 2 for arguments it cannot read, 1 where a pull
// request was refused or the host could not be read
export function main(args, { call = gh, folder = FOLDER, say = console.log, warn = console.error } = {}) {
  const at = args.indexOf("--count"), count = at >= 0 ? Number(args[at + 1]) : 8;
  const asked = args.flatMap((arg, i) => (arg === "--pr" ? [Number(args[i + 1])] : []));
  if (!Number.isInteger(count) || count < 0 || asked.some((n) => !Number.isInteger(n) || n < 1)) {
    warn("FAIL: --count and --pr take a whole number. Mend: run node scripts/security-review-host.mjs [--count N] [--pr N]...");
    return 2;
  }
  try {
    fs.mkdirSync(folder, { recursive: true });
    const refused = recordEach(call, asked.length ? asked : chosen(call, count), folder, say, warn);
    writeRights(call, folder, say);
    const found = recordings(folder).flatMap(({ record }) => compare(record));
    for (const line of found) say(line);
    say(found.length ? `${found.length} difference(s) from the host's record.` : "No difference from the host's record.");
    return refused > 0 ? 1 : 0;
  } catch (e) {
    warn(`FAIL: the host could not be read (${why(e)}). Mend: run it where gh answers for the owner's account, or run it again once the host answers`);
    return 1;
  }
}
// each pull request recorded in its own file; how many were refused
function recordEach(call, numbers, folder, say, warn) {
  let refused = 0;
  for (const n of numbers) {
    const raw = fetchPull(call, n);
    try {
      fs.writeFileSync(path.join(folder, `pr-${n}.json`), `${JSON.stringify(recordOf(raw), null, 1)}\n`);
      say(`Recorded #${n}.`);
    } catch (e) {
      warn(e.message);
      refused++;
    }
  }
  return refused;
}

if (started(import.meta.url)) process.exit(main(process.argv.slice(2)));
