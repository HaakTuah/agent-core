#!/usr/bin/env node
// Has a code review that is running on this pull request finished (modules/reviews.md, point 2: a review already
// running is waited for, and one that hangs is taken over, so none can hold a pull request for long)? Run by the core's
// workflow security-review.yml beside scripts/security-review.mjs, in the same job, always from the default branch's
// copy, on what GitHub's own API gives of the pull request and its comments. It waits only while the summary Codex's
// own app keeps on the pull request says its code review is running on the pull request's head commit. The wait ends
// when Codex's code review finishes, or when a comment that opens "Code review:" from the repository's owner, a member
// or a collaborator names that commit by its whole SHA, all forty characters, since a commit can be made to share a
// short one's first characters: how the next reviewer, or the fallback reviewer, posts the review it took over.
// Given the pull request's commits and files, it also waits while a pull request that needs a code review
// (modules/reviews.md, "Which") has had none: neither Codex's code review completed nor such a comment names the head
// commit, or one that only updates from `main` follow (merges whose second parent is no commit of the pull request's,
// as GitHub's "Update branch" makes; floor rule 8: nothing is reviewed twice). None is needed where every changed file
// is a Markdown file outside the rule files (docs alone: floor rule 3's names in any folder, the copy under core/,
// .github/, .claude/, .agents/ and .agent/, those the project's SECURITY.md adds, and in the core's own repository
// floor/ and modules/), nor where the pull request has a sync's shape: the copy under core/, the manifest's pin and
// workflows whose pins alone move (floor rule 8: a pure sync gets no review; that its copy is the core's is
// scripts/pure-sync.mjs's to prove, not this check's). Given neither, it waits only for a review running, as it did
// before it read them. It does not hold what a review says, that a docs PR another provider built got its code review,
// nor that a merge from `main` brought no change of its own: those stay with the builder and the reviews. It prints, as
// JSON, the commit to mark and the status to give it, named "code-review", or {} for a pull request that is closed or a
// draft. While "advisory" (the workflow's input, on unless turned off) the status is always a pass that says what the
// check would have done, as the security-review status's.
//
// Usage:  node scripts/code-review-wait.mjs <the pull request, as GitHub's API gives it> <its comments, the same>
//           [<its commits, the same> <its files, the same>]
//         ADVISORY=false for a status that waits; RUN_URL for the link the status carries.
import { readFileSync } from "node:fs";
import { CORE } from "./core-address.mjs";
import { ruleFiles } from "./rule-files.mjs";
import { started } from "./started.mjs";
import { UNREAD, WRITERS, codexState, pinsAlone, status } from "./security-review.mjs";

export const CONTEXT = "code-review";
const SHA = /^[0-9a-f]{40}$/u;
const POSTED = /^(?:\*\*)?Code review:/u;
// the words Codex's app writes for a review under way; any other (completed, none, or one not known) is none running,
// so that a form nobody documents can never hold a pull request for good
const RUNNING = ["running", "queued", "pending", "in_progress"];
const flat = (pages) => (Array.isArray(pages) ? pages.flat() : []).filter((entry) => entry !== null && typeof entry === "object");

// { sha, done, why, warning? }, or undefined for a pull request with nothing to mark (closed, a draft, no commit to name)
export function judge(pull, comments, commits, files, rules = []) {
  if (pull?.state !== "open" || pull.draft !== false || typeof pull.head?.sha !== "string" || !SHA.test(pull.head.sha)) return undefined;
  const sha = pull.head.sha;
  const list = flat(comments);
  const read = codexState(list);
  if (read.unread) return { sha, done: true, why: "no code review is running", warning: UNREAD };
  const review = read.state?.code_review;
  const short = sha.slice(0, 7);
  // the whole SHAs a posted code review names, never a prefix: an old review naming the first characters of another
  // commit must not stand for this one
  const posted = new Set(list.filter((comment) => typeof comment.body === "string" && POSTED.test(comment.body) && WRITERS.includes(comment.author_association))
    .flatMap((comment) => (comment.body.match(/(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/giu) ?? []).map((found) => found.toLowerCase())));
  const running = review !== null && typeof review === "object" && review.commit_sha === sha && RUNNING.includes(review.status);
  if (running) {
    if (posted.has(sha)) return { sha, done: true, why: `a code review of ${short} is posted, so Codex's running one is not waited for` };
    return { sha, done: false, why: `Codex's code review of ${short} is still running` };
  }
  if (commits === undefined || files === undefined || !needs(pull, flat(files), rules)) return { sha, done: true, why: "no code review is running" };
  const seen = new Set(posted);
  if (review !== null && typeof review === "object" && review.status === "completed" && typeof review.commit_sha === "string") seen.add(review.commit_sha);
  if (stands(flat(commits), sha, seen)) return { sha, done: true, why: "a code review has run, and nothing but updates from main since" };
  return { sha, done: false, why: `no code review of ${short}: ask one, or post "Code review:" naming its whole SHA (modules/reviews.md)` };
}

// whether a pull request needs a code review: not where it holds docs alone, or has a sync's shape (the manifest's pin
// moved alone among them)
const MANIFEST = /^(Core: \S+ at )[0-9a-f]{40}(, copied whole under core\/.*)$/u;
const RULES = /(?:^|\/)(?:AGENTS|CLAUDE|SECURITY|GEMINI|REVIEW)\.md$|threat-model|^core-manifest\.md$|^core\/|(?:^|\/)\.(?:github|claude|agents?)\//iu;
function needs(pull, files, rules) {
  const names = files.flatMap((file) => [file.filename, file.previous_filename]).filter((name) => name !== undefined);
  if (names.length === 0 || names.some((name) => typeof name !== "string")) return names.length > 0;
  const core = String(pull.base?.repo?.full_name).toLowerCase() === CORE.toLowerCase();
  const rule = (name) => RULES.test(name) || rules.includes(name) || (core && /^(?:floor|modules)\//u.test(name));
  if (names.every((name) => /\.md$/iu.test(name) && !rule(name))) return false;
  const sync = files.every((file) => (file.filename === "core-manifest.md" && pinsAlone(file, MANIFEST)) || (file.filename.startsWith("core/") && (file.previous_filename ?? "core/").startsWith("core/"))
    || (/^\.github\/workflows\/[^/]+\.ya?ml$/u.test(file.filename) && pinsAlone(file)));
  return !(sync && files.some((file) => file.filename === "core-manifest.md"));
}
// whether a reviewed commit stands for the head: the head itself, or reached from it by first parents through merges
// whose second parent is no commit of the pull request's (updates from main, which nothing reviews twice)
function stands(commits, head, seen) {
  const by = new Map(commits.filter((commit) => typeof commit.sha === "string").map((commit) => [commit.sha, commit]));
  for (let at = head, step = 0; step <= by.size; step++) {
    if (seen.has(at)) return true;
    const parents = by.get(at)?.parents;
    if (!Array.isArray(parents) || parents.length !== 2 || by.has(parents[1]?.sha)) return false;
    at = parents[0]?.sha;
  }
  return false;
}

if (started(import.meta.url)) {
  const [pullFile, commentsFile, commitsFile, filesFile] = process.argv.slice(2);
  if (!pullFile || !commentsFile) {
    console.error("usage: node scripts/code-review-wait.mjs <the pull request, as JSON> <its comments, as JSON> [<its commits, as JSON> <its files, as JSON>]");
    process.exit(2);
  }
  const read = (file) => JSON.parse(readFileSync(file, "utf8"));
  // (the project's own rule files, where its SECURITY.md names them; none read, where it names none)
  let rules = [];
  try { rules = ruleFiles(); } catch { rules = []; }
  const verdict = judge(read(pullFile), read(commentsFile), commitsFile ? read(commitsFile) : undefined, filesFile ? read(filesFile) : undefined, rules);
  console.log(JSON.stringify(verdict === undefined ? {} : { sha: verdict.sha, status: status(verdict, process.env.ADVISORY !== "false", process.env.RUN_URL, CONTEXT), ...(verdict.warning ? { warning: verdict.warning } : {}) }));
}
