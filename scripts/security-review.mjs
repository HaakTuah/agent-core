#!/usr/bin/env node
// Has this pull request's security review run (floor rule 8, and what tasks/reviews.md, point 3, adds: a security
// review that starts by itself is waited for on every pull request)? Run by the core's workflow security-review.yml,
// always from the default branch's copy, on what GitHub's own API gives of the pull request and its comments. It takes
// two things as proof: the summary Codex's own app keeps on the pull request (its login and kind are GitHub's, which no
// one else can post under), saying its security review is completed; or a comment that opens "Security review:" from
// the repository's owner, or an account the project names (the workflow's input "reviewers"), with a say in the
// repository by GitHub's own word (owner, member or collaborator), which is how another reviewer's, or the fallback
// reviewer's, is posted (tasks/reviews.md, point 3; #99). Given the pull request's commits, a review stands for the
// head only where it saw the head, or a commit that only updates from main follow (merges whose second parent is no
// commit of the pull request's, as GitHub's "Update branch" makes): Codex's by the commit its summary names, a posted
// one by a commit it names by its whole SHA; any other later commit needs a posted review, or the note that none is
// needed, naming the head, and the status says when the review it passes on saw an earlier commit than the head. Given
// too the merges scripts/clean-merges.mjs proved, the tree of each the merge git makes of its two parents (#323), an
// update from main is only such a merge: one whose tree carries a change of its own, or that git cannot make without
// a conflict, needs a review naming it or a later commit, and the status names it. Where
// Codex's summary says its security review is running, only such a comment posted after it began ends the wait for it
// (that review is waited for: core archive 206), never one posted before, a note that none is needed among them: it
// began when the summary's row for it says it has run since, where that time can be read and is no later than the
// summary's last change, and otherwise at that last change, the latest it can have begun. Where a push starts it again,
// a review posted before that counts no longer while it runs; where Codex does not start it on a push, the later commit
// needs a posted review naming the head, as above. Where Codex's summary says a finding of its security review is open,
// the check waits until such a comment is posted after Codex's newest security finding, and after Codex's summary last
// changed, naming the head: the fallback reviewer's check of the fix (Codex's own mark of an open finding does not
// clear by itself once the finding is fixed). A finding given in a review's own body alone, which the workflow does not
// fetch, is not to be found among the comments, so the summary's last change is the latest any can have come; where
// none is found at all, the status says so. A pull request from before the check whose review came before that change
// is told, never held (BOUND=false, below), and one with no review after the newest finding found, or with none at all
// where none is found, waits, as before.
// Dependabot's own pull request (opened by it from a branch of the repository, every commit of it written by Dependabot
// and signed by GitHub, so that one somebody else has pushed to, or brought up to date by a merge, is its own no
// longer) passes where no review of Codex's has begun on it: floor rule 17 holds it (with a branch of the repository,
// its status is written when the first comment that counts arrives, which is Codex's summary once the code review rule
// 17 asks for is asked). A pull request that needs no security review and gets none by itself says so in a comment of
// that kind, which its code reviewer checks (tasks/reviews.md, point 3); the status then says a review is posted, and
// cannot tell that note from a review. A pure sync needs neither (floor rule 8): where the workflow's run of the
// default branch's pure-sync.mjs proved the head one (PURE), it passes where no review of Codex's has begun by itself,
// and one that has is waited for and read as on any pull request, as are floor rule 3's two asked of it never. Nothing
// else on the pull request counts: not its description, not a comment of anyone else, not a review's own text.
// Where the pull request changes what runs by itself (a file comment-only.mjs reads: under .github/ or .claude/, or an
// action.yml; the copy under core/ aside, which only a sync changes), it asks floor rule 3's two security reviews:
// Codex's and a posted one, or two posted. One is enough, as before, where each such file only moves pins (changed in
// place, each changed line a `uses:` line whose whole SHA moved and that differs in nothing else but the note after it,
// a version's word: an action's version, rule 17, or a sync's calls to the core's workflows), or where a posted review
// holds what comment-only.mjs printed on the head ("checked head" and its whole SHA: comments and steps' names alone,
// rule 8's one). Given no list of the files (a workflow older than this script), it asks one review, as it did before
// it read them; a list GitHub cut short (3000 files) is read as one that changes what runs by itself. Of a pull request
// that leaves this script alone and whose head does not hold it as the default branch does (BOUND=false, which the
// workflow sets), which stood before the check came, it says the second is missing and never waits for it, and so it
// says of a review posted before Codex's running one began, or before its summary last changed where it marks a finding
// open, and of one that names no commit the head stands on, and it counts a member's or collaborator's review that it
// does not name, saying so (AGENTS.md, "Nothing locks a project"); brought up to date with main, it is held. What it
// does not hold: what a posted review says, whether a finding is blocking, who posted each of two reviews (one login
// may post both), that comment-only.mjs's printout is true (its code reviewer runs it again), and, given no list of the
// merges proved (a workflow older than this script), that a merge from main brought no change of its own; those stay
// with the builder and the reviews. It prints, as JSON, the commit to
// mark and the status to give it, or {} for a pull request that is closed or a draft. While "advisory" (the workflow's
// input, on unless turned off) the status is always a pass that says what the check would have done, until the
// project's owner turns that off (#99). What the status proves where every review is posted (none starts by itself, as
// through a plug-in): that a review was posted for the head, not who made it, since builder and reviewer may post under
// one login, which no check here tells apart (#187).
//
// Usage:  node scripts/security-review.mjs <the pull request, as GitHub's API gives it> <its comments, the same>
//           [<its review comments, the same> [<its commits, the same> [<its files, the same> [<the merges proved>]]]]
//         ADVISORY=false for a status that waits; BOUND=false for a pull request from before the check; RUN_URL for
//         the link the status carries; REVIEWERS for the accounts named; PURE for the head pure-sync.mjs proved.
import { readFileSync } from "node:fs";
import { RUNS } from "./comment-only.mjs";
import { started } from "./started.mjs";

export const CODEX = "chatgpt-codex-connector[bot]";
const DEPENDABOT = "dependabot[bot]";
// the first two lines of the summary Codex's app keeps: the second is its state, as JSON (GitHub's API gives its braces
// as they are; one written as &#123; or &#125;, as a delivery may show it, is read as one too)
const SUMMARY = /^<!-- codex-pull-request-review-summary -->\r?\n<!-- codex-review-state:v1 ([^\r\n]{1,4000}) -->\r?\n/u;
export const WRITERS = ["OWNER", "MEMBER", "COLLABORATOR"]; // GitHub's own word for who wrote a comment, not the comment's
const POSTED = /^(?:\*\*)?Security review:/u;
export const FINDING = /^<!-- codex-security-review-finding:v1 -->/u; // how a finding of Codex's security review opens
const SHA = /^[0-9a-f]{40}$/u;
// who posts the review a waiting status asks for, and when, the actor first, since a commit status shows only a short
// description (#395; tasks/reviews.md, point 3). Where Codex's app starts the review by itself (its summary holds
// a security review, or cannot be read), the fallback reviewer, after its own check of the newest commit, never Codex asked by
// a comment, which it answers with a code review; elsewhere, the security reviewer the project uses, asked again.
// (what a posted review carries, which the count of reviews reads: its kind and the whole SHA it read, and the lines
// "Blocking findings: N." and "Other findings: M." (or "No blocking finding.", "No other finding."; #299, #403), each
// quoted, "⏎" between them for a new line, named here as one so that each mend says it whole within GitHub's 140
// characters, the situation before it worded short to leave it room; the code-review wait names its own kind)
export const NEW_LINE = "⏎";
export const form = kind => [`${kind} review: <whole SHA>`, "Blocking findings: N.", "Other findings: M."].map(line => `"${line}"`).join(NEW_LINE);
const FORM = form("Security");
const CHECKS = `fallback posts ${FORM}`;
const HIDDEN = `Codex finding not found. Mend: ${CHECKS}`;
function mendsFor(read) {
  const app = read.unread === true || (read.review !== null && typeof read.review === "object");
  // (one begun gets about 30 minutes, one not begun about 5: point 3)
  const begun = RUNNING.includes(read.review?.status);
  return app ? { post: CHECKS, none: `wait ${begun ? "30 min for Codex's" : "5 min"}; then the fallback reviewer reviews, posts one` }
    : { post: `your reviewer posts ${FORM}`, none: "your security reviewer reviews; with Codex's app, the fallback reviewer after 5 min" };
}
// the words Codex's app writes for a review under way; any other (completed, none, or one not known) is none running,
// so that a form nobody documents can never hold a pull request for good (scripts/code-review-wait.mjs reads them too)
export const RUNNING = ["running", "queued", "pending", "in_progress"];
export const CONTEXT = "security-review";

const flat = (pages) => (Array.isArray(pages) ? pages.flat() : []).filter((entry) => entry !== null && typeof entry === "object");
export const codexs = (comment) => comment.user?.login === CODEX && comment.user.type === "Bot" && typeof comment.body === "string";
const newest = (times) => times.reduce((latest, at) => (at > latest ? at : latest), -Infinity); // -Infinity: none

// what the summary Codex's app keeps says of its reviews: { state, at, body }, the whole state, when the summary last
// changed (GitHub's updated_at, as given) and its text, or {} where there is no summary, and { unread: true } where a
// summary of Codex's is there but its state cannot be read, a form nobody documents having changed (core archive 201).
// The app keeps one summary and edits it, so the first comment of its that opens as one is read, never a later
// look-alike. scripts/code-review-wait.mjs reads its code review from it too.
const OPENS = /^<!-- codex-pull-request-review-summary -->/u;
export function codexState(comments) {
  for (const comment of flat(comments)) {
    if (!codexs(comment) || !OPENS.test(comment.body)) continue;
    const text = SUMMARY.exec(comment.body)?.[1];
    let state;
    try { state = text === undefined ? undefined : JSON.parse(text.replaceAll("&#123;", "{").replaceAll("&#125;", "}")); } catch { state = undefined; }
    if (state === null || typeof state !== "object" || !("security_review" in state)) return { unread: true };
    return { state, at: comment.updated_at, body: comment.body };
  }
  return {};
}
// the row of the summary's table for its security review, while it runs: "🔄 **Running** since" the time it began
const SINCE = /^\| 🔒 \*\*Security Review\*\* \| 🔄 \*\*Running\*\* since <relative-time datetime="([0-9T:.Z-]{1,40})">/mu;
// of its security review: { review, began }, review undefined where there is none it can read, or { unread: true };
// began is when the review began as a number (NaN where no time can be read): its row's time, where that is no later
// than the summary's last change, or else that change; changed is that last change (NaN where it cannot be read)
function codex(comments) {
  const read = codexState(comments);
  if (!read.state) return read;
  const changed = Date.parse(read.at), since = Date.parse(SINCE.exec(read.body)?.[1]);
  return { review: read.state.security_review, began: since <= changed ? since : changed, changed };
}
// what the check says where Codex's summary is there but cannot be read: a warning beside the status, which waits or
// passes as it would with no summary at all
export const UNREAD = "Codex's summary is on the pull request, but its state cannot be read: its form may have changed, and scripts/security-review.mjs must learn it";

// { sha, done, why }, or undefined for a pull request with nothing to mark (closed, a draft, no commit to name). more:
// { reviewers, the accounts besides the repository's owner whose posted review counts; pure, whether pure-sync.mjs
// proved the head a pure sync; merges, the SHAs of the merges clean-merges.mjs proved the ones git makes, where it ran }
export function judge(pull, comments, reviewComments, commits, files, bound = true, more = {}) {
  if (pull?.state !== "open" || pull.draft !== false || typeof pull.head?.sha !== "string" || !SHA.test(pull.head.sha)) return undefined;
  const sha = pull.head.sha;
  const list = flat(comments);
  const whose = counted(pull, more.reviewers);
  const writers = list.filter((comment) => typeof comment.body === "string" && POSTED.test(comment.body) && WRITERS.includes(comment.author_association));
  // (of a pull request whose head does not hold this check as the default branch does, which stood before it came, a
  // member's or collaborator's review counts as it did then, and the status says so: AGENTS.md, "Nothing locks a
  // project")
  const all = bound ? writers.filter((comment) => whose(comment.user?.login)) : writers;
  const unnamed = !bound && writers.some((comment) => !whose(comment.user?.login));
  const read = codex(list), review = read.review, warning = read.unread ? UNREAD : undefined;
  // while Codex's own runs, only a review posted after it began counts (a time that cannot be read is taken as the
  // newest, so nothing is posted after it)
  const running = review !== null && typeof review === "object" && RUNNING.includes(review.status);
  const began = Number.isFinite(read.began) ? read.began : Infinity;
  const posted = running ? all.filter((comment) => (Date.parse(comment.created_at) || -Infinity) > began) : all;
  // (a summary's last change that cannot be read is taken as the newest, as above)
  const changed = Number.isFinite(read.changed) ? read.changed : Infinity;
  // the commits a review stands for the head from: the head, and each reached from it through updates from main alone
  // (given no list of the commits, a workflow older than this script, any review stands for it, as before)
  const chain = commits === undefined ? undefined : standsFrom(pull, flat(commits), sha, more.merges);
  const stand = (at) => chain === undefined || chain.has(at);
  const forHead = chain === undefined ? posted : posted.filter((comment) => named(comment.body).some((at) => chain.has(at)));
  // the merge from main where the chain stops for want of proof (#323): a review of it, or of a later commit, stands
  const cut = chain === undefined ? undefined : unproved(pull, flat(commits), sha, more.merges);
  let verdict = judgeWith({ sha, list, posted, forHead, stand, bind: chain !== undefined, review, pull, reviewComments, commits, changed, bound, pure: more.pure === true, cut, mends: mendsFor(read) });
  if (running && !verdict.done && all.length > 0 && posted.length === 0) {
    const why = "Codex's security review is running, begun after every \"Security review:\" posted. Mend: wait for it";
    // (one whose head does not hold this check as the default branch does stood before it came: reported)
    verdict = bound ? { sha, done: false, why } : { sha, done: true, why: "before this check came, so not waited for: Codex's security review began after every \"Security review:\"" };
  }
  // floor rule 3's two, where what runs by itself changed beyond its pins and no proof of comments alone is posted (a
  // pure sync needs neither: floor rule 8)
  if (verdict.done && more.pure !== true && files !== undefined && (!whole(pull, files) || flat(files).some((file) => runs(file) && !pinsAlone(file))) && !posted.some((comment) => commentsAlone(comment.body, sha))) {
    const codexDone = review !== null && typeof review === "object" && review.status === "completed";
    if ((codexDone ? 1 : 0) + posted.length < 2) {
      const why = `floor rule 3 asks two. Mend: the fallback reviewer posts the second, or comment-only.mjs's printout for ${sha.slice(0, 7)}`;
      // a pull request whose head does not hold this check as the default branch does stood before it came: reported
      verdict = bound ? { sha, done: false, why } : { sha, done: true, why: `before this check came, so not waited for: ${why}` };
    } else verdict = { ...verdict, why: `${verdict.why}; floor rule 3's two are there` };
  }
  if (unnamed && verdict.done) verdict = { ...verdict, why: `${verdict.why}; a review from an account not named counts, as before this check came` };
  return warning ? { ...verdict, warning } : verdict;
}

// whose posted review counts (#99): the repository's owner's, and the accounts the project names (the workflow's
// input "reviewers"), each by its login in any case, as GitHub reads one; nobody else's, a member's or a
// collaborator's neither. One login may post the builder's work and its review alike: that this tells no one apart
// stays with the reviews (#187)
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\[bot\])?$/u;
export const reviewersOf = (text) => (typeof text === "string" ? text.split(/[\s,]+/u) : []).filter((name) => LOGIN.test(name));
function counted(pull, reviewers) {
  const names = new Set([pull.base?.repo?.owner?.login, ...(Array.isArray(reviewers) ? reviewers : [])].filter((name) => typeof name === "string" && LOGIN.test(name)).map((name) => name.toLowerCase()));
  return (login) => typeof login === "string" && names.has(login.toLowerCase());
}
// the commits a comment names by their whole SHA, all forty characters (a shorter one can be made to match another)
export const named = (body) => (typeof body === "string" ? body.match(/(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/giu) ?? [] : []).map((at) => at.toLowerCase());
// the commits a review of which stands for the head (#99): the head, and each reached from it by first parents through
// merges whose second parent is no commit of the pull request's (updates from main, as GitHub's "Update branch" makes:
// nothing is reviewed twice, floor rule 8). Given the merges proved (clean-merges.mjs: each one's tree the merge git
// makes of its parents, #323), it goes past those alone, and a review of the merge where it stops, which saw that
// merge's own tree, still stands. A list GitHub cut short (250 commits) proves no update from main: the head alone then.
// scripts/code-review-wait.mjs and scripts/clean-merges.mjs read it too.
export function standsFrom(pull, commits, head, merges) {
  const chain = new Set([head]);
  // (a count that is no whole number of at least none proves nothing: the head alone)
  if (!Number.isInteger(pull.commits) || pull.commits < 0 || commits.length < pull.commits) return chain;
  const proved = merges === undefined ? undefined : new Set(Array.isArray(merges) ? merges : []);
  const by = new Map(commits.filter((commit) => typeof commit.sha === "string").map((commit) => [commit.sha, commit]));
  for (let at = head; chain.size <= by.size;) {
    const parents = by.get(at)?.parents;
    if (!Array.isArray(parents) || parents.length !== 2 || typeof parents[0]?.sha !== "string" || typeof parents[1]?.sha !== "string" || by.has(parents[1].sha)) break;
    if (proved !== undefined && !proved.has(at)) break;
    at = parents[0].sha;
    if (chain.has(at)) break;
    chain.add(at);
  }
  return chain;
}
// the update from main where the chain stops for want of proof (#323), or undefined where nothing stops it so: the
// last commit the chain reaches, where without the proof it reaches further
export function unproved(pull, commits, head, merges) {
  if (merges === undefined) return undefined;
  const chain = standsFrom(pull, commits, head, merges);
  return standsFrom(pull, commits, head).size > chain.size ? [...chain].at(-1) : undefined;
}

// whether GitHub gave every file the pull request changes (it gives at most 3000): a list cut short is read as one
// that changes what runs by itself, never as one that does not
export const whole = (pull, files) => Number.isInteger(pull.changed_files) && pull.changed_files >= 0 && flat(files).length >= pull.changed_files;
// what runs by itself, as comment-only.mjs reads it, the copy of the core under core/ aside (only a sync changes it,
// and its code passed its reviews in the core's own pull request: floor rule 8); a file moved counts on either side
const runs = (file) => [file.filename, file.previous_filename].some((name) => typeof name === "string" && !name.startsWith("core/") && RUNS.test(name));
// a `uses:` line pinned to a whole SHA, with the note after it if any: [the line with the pin and note set aside]
const USES = /^(\s*(?:-\s+)?["']?uses["']?\s*:\s*["']?[^\s"'@#]+@)[0-9a-f]{40}(["']?)(?:\s+#\s*[\w.+-]*)?$/u;
// whether a file, as GitHub's API gives it among a pull request's files, only moves pins: changed in place, and in
// each hunk of its patch the removed and added lines pair one to one, each pair a `uses:` line whose whole SHA moved
// and that differs in nothing else but the note after it, a version's word (a patch GitHub leaves out, a file too
// large, is no proof); or, given another pattern, lines it reads alike once its groups alone are kept
export function pinsAlone(file, pinned = USES) {
  if (file?.status !== "modified" || typeof file.patch !== "string" || file.patch === "") return false;
  const hunks = [];
  for (const line of file.patch.split("\n")) {
    if (line.startsWith("@@")) hunks.push({ "-": [], "+": [] });
    else if (hunks.length && (line[0] === "-" || line[0] === "+")) hunks.at(-1)[line[0]].push(line.slice(1));
  }
  const bare = (line) => pinned.exec(line)?.slice(1).join("\u0000");
  const pin = (line) => /(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/u.exec(line)?.[0];
  return hunks.length > 0 && hunks.every((hunk) => hunk["-"].length === hunk["+"].length
    && hunk["-"].every((line, i) => bare(line) !== undefined && bare(line) === bare(hunk["+"][i]) && pin(line) !== pin(hunk["+"][i])));
}
// whether a posted review holds what comment-only.mjs printed on this head: comments and steps' names alone
const ALONE = /^\s*(?:comments and steps' names alone in \.github\/|nothing changed in \.github\/)/mu;
export const commentsAlone = (body, sha) => typeof body === "string" && ALONE.test(body) && new RegExp(`^\\s*checked head ${sha}(?![0-9a-f])`, "mu").test(body);
// whether a completed review says no finding is open: only false, or null, which Codex gives where it found nothing;
// true, or a value of any other type, is read as one open
const noneOpen = (review) => review.has_unresolved_findings === false || review.has_unresolved_findings === null;
function judgeWith({ sha, list, posted, forHead, stand, bind, review, pull, reviewComments, commits, changed, bound, pure, cut, mends }) {
  const short = sha.slice(0, 7);
  // what a review of an earlier commit wants, where a merge from main after it is not the one git makes (#323)
  const notGits = cut === undefined ? "" : `; merge ${cut.slice(0, 7)} is not the merge git makes`;
  // what waits, or, on a pull request whose head does not hold this check as the default branch does, which stood
  // before it came, is told and never held
  const hold = (why, told = why) => (bound ? { sha, done: false, why } : { sha, done: true, why: `before this check came, so not waited for: ${told}` });
  // a posted review that names an earlier commit than the head, which nothing but updates from main follow, says so
  const ofHead = forHead.some((comment) => named(comment.body).includes(sha));
  const postedWhy = bind && forHead.length > 0 && !ofHead ? "a security review is posted on an earlier commit, only updates from main since" : "a security review is posted on the pull request";
  if (review !== null && typeof review === "object" && review.status === "completed") {
    const at = typeof review.commit_sha === "string" && SHA.test(review.commit_sha) ? review.commit_sha : undefined;
    const on = at === undefined ? "" : at === sha ? ` (on ${short})` : ` (on ${at.slice(0, 7)}, earlier than the head ${short}${bind && stand(at) ? ", only updates from main since" : ""})`;
    if (noneOpen(review)) {
      // a review of an earlier commit stands only where nothing but updates from main follow it; otherwise a posted
      // review names the head, or a commit only such updates follow (a pure sync needs none, its review waited for)
      if (pure || !bind || (at !== undefined && stand(at))) return { sha, done: true, why: `Codex's security review has run${on}` };
      if (forHead.length > 0) return { sha, done: true, why: `${postedWhy}; Codex's saw ${at === undefined ? "a commit not named" : `${at.slice(0, 7)}, earlier`}` };
      const saw = at === undefined ? "no commit" : at.slice(0, 7);
      if (cut !== undefined && at !== undefined && standsFrom(pull, flat(commits), sha).has(at)) return hold(`merge ${cut.slice(0, 7)} unproved. Mend: ${CHECKS}`, `Codex's review saw ${saw}${notGits}`);
      return hold(`Codex saw ${saw}, not the head. Mend: ${CHECKS}`, `Codex's review saw ${saw}, not the head ${short}`);
    }
    // a finding of it is marked open: only a review posted after its newest finding, and its summary's last change,
    // settles it, and one that names the head (or a commit only updates from main follow)
    const found = newest([...list, ...flat(reviewComments)].filter((comment) => codexs(comment) && FINDING.test(comment.body)).map((comment) => Date.parse(comment.created_at) || Infinity));
    const last = newest(forHead.map((comment) => Date.parse(comment.created_at) || -Infinity));
    const ever = newest(posted.map((comment) => Date.parse(comment.created_at) || -Infinity));
    if (found !== -Infinity) {
      if (last <= found) {
        // (one whose review followed the finding but names no commit the head stands on, from before the check: told)
        if (!bound && ever > found) return hold("", `a review follows Codex's newest security finding, but names not the head ${short}`);
        return { sha, done: false, why: `Codex finding open. Mend: answer, then ${CHECKS}` };
      }
      // after the newest found, but a newer one may be given in a review's own body alone, which is not fetched: the
      // review settles the mark only if posted after Codex's summary last changed too, the latest that one can have
      // come (#293)
      if (last > changed) return { sha, done: true, why: `Codex's security review has run${on}, and a review is posted after its newest finding` };
      return hold(`Codex summary changed since. Mend: ${CHECKS}`, "Codex's summary changed after the review that followed its newest finding");
    }
    // none is to be found among the comments (one in a review's own body, say): only a review posted after Codex's
    // summary last changed settles it, the latest the finding can have come (#251)
    if (last > changed) return { sha, done: true, why: `Codex's security review has run${on}; its open finding is not among the comments, and a review is posted after it` };
    // (one whose head does not hold this check as the default branch does stood before it came: reported, where a
    // review is posted, which settled it before; with none posted it waited before, and waits still)
    if (ever === -Infinity) return { sha, done: false, why: HIDDEN };
    return hold(HIDDEN, "Codex's open security finding is not among the comments, nor a review after it");
  }
  // a pure sync, as pure-sync.mjs proved it, needs no review where none has begun by itself (floor rule 8): one that
  // has, Codex's running, is waited for as above
  if (pure && !(review !== null && typeof review === "object" && RUNNING.includes(review.status))) return { sha, done: true, why: "a pure sync, as pure-sync.mjs proves: no review needed, none begun by itself yet (floor rule 8)" };
  if (forHead.length > 0) return { sha, done: true, why: postedWhy };
  // Dependabot's own, with no review of Codex's begun on it: the floor holds it another way (rule 17). Its own means
  // opened by it from a branch of the repository, every commit written by it and signed by GitHub, the head among them.
  const all = flat(commits);
  const its = (commit) => commit.author?.login === DEPENDABOT && commit.author.type === "Bot" && commit.committer?.login === "web-flow" && commit.commit?.verification?.verified === true;
  const dependabots = pull.user?.login === DEPENDABOT && pull.user.type === "Bot" && typeof pull.head.repo?.full_name === "string" && pull.head.repo.full_name === pull.base?.repo?.full_name
    && all.length > 0 && all.every(its) && all.some((commit) => commit.sha === sha);
  if (dependabots && !(review !== null && typeof review === "object" && typeof review.status === "string")) return { sha, done: true, why: "Dependabot's own, which floor rule 17 holds" };
  // (one naming a commit that only a merge from main git would not make follows: that merge named, #323)
  const loose = cut === undefined ? undefined : standsFrom(pull, all, sha);
  if (cut !== undefined && posted.some((comment) => named(comment.body).some((at) => loose.has(at)))) return hold(`merge ${cut.slice(0, 7)} unproved. Mend: ${mends.post}`, `a security review saw an earlier commit${notGits}`);
  if (posted.length > 0) return hold(`posted review not on head. Mend: ${mends.post}`, `a security review is posted, but names not the head ${short}`);
  return { sha, done: false, why: `no security review has run yet. Mend: ${mends.none}` };
}

// the commit status GitHub is given: while advisory always a pass, saying what the check would have done (context: the
// status's name, this check's unless scripts/code-review-wait.mjs gives its own)
export function status(verdict, advisory, url, context = CONTEXT) {
  const state = verdict.done || advisory ? "success" : "pending";
  // (where Codex's summary cannot be read, the status says so too, where the owner sees it; GitHub takes 140 characters)
  const description = `${advisory ? "Advisory: " : ""}${verdict.done ? "" : advisory ? "would wait, " : "Waiting: "}${verdict.why}${verdict.warning ? "; summary unreadable" : ""}`.slice(0, 140);
  return { state, description, context, ...(typeof url === "string" && /^https:\/\/[\w./-]{1,200}$/u.test(url) ? { target_url: url } : {}) };
}

if (started(import.meta.url)) {
  const [pullFile, commentsFile, reviewCommentsFile, commitsFile, filesFile, mergesFile] = process.argv.slice(2);
  if (!pullFile || !commentsFile) {
    console.error("usage: node scripts/security-review.mjs <the pull request, as JSON> <its comments, as JSON> [<its review comments, as JSON> [<its commits, as JSON> [<its files, as JSON> [<the merges clean-merges.mjs proved, as JSON>]]]]");
    process.exit(2);
  }
  // (a file that is not JSON, or is gone, fails with its mend, never with a stack: the workflow writes each from gh api)
  const read = (file) => {
    try { return JSON.parse(readFileSync(file, "utf8")); }
    catch (e) { console.error(`FAIL: scripts/security-review.mjs could not read ${file} as JSON (${e.code ?? e.name}). Mend: write it again from the GitHub API, as the security-review workflow does, and run the check again`); process.exit(1); }
  };
  // (PURE: the head's whole SHA, where pure-sync.mjs, run by the workflow from the default branch's copy, proved it)
  const pull = read(pullFile);
  const verdict = judge(pull, read(commentsFile), reviewCommentsFile ? read(reviewCommentsFile) : [], commitsFile ? read(commitsFile) : undefined, filesFile ? read(filesFile) : undefined, process.env.BOUND !== "false",
    { reviewers: reviewersOf(process.env.REVIEWERS), pure: typeof pull?.head?.sha === "string" && SHA.test(pull.head.sha) && process.env.PURE === pull.head.sha,
      merges: mergesFile ? read(mergesFile) : undefined });
  console.log(JSON.stringify(verdict === undefined ? {} : { sha: verdict.sha, status: status(verdict, process.env.ADVISORY !== "false", process.env.RUN_URL), ...(verdict.warning ? { warning: verdict.warning } : {}) }));
}
