#!/usr/bin/env node
// Has a code review that is running on this pull request finished (tasks/reviews.md, point 2: a review already
// running is waited for, and one that hangs is taken over, so none can hold a pull request for long)? Run by the core's
// workflow security-review.yml beside scripts/security-review.mjs, in the same job, always from the default branch's
// copy, on what GitHub's own API gives of the pull request and its comments. It waits only while the summary Codex's
// own app keeps on the pull request says its code review is running on the pull request's head commit. The wait ends
// when Codex's code review finishes, or when a comment that opens "Code review:" from the repository's owner, a member
// or a collaborator names that commit by its whole SHA, all forty characters, since a commit can be made to share a
// short one's first characters: how the next reviewer, or the fallback reviewer, posts the review it took over.
// Given the pull request's commits and files, it also waits while a pull request that needs a code review
// (tasks/reviews.md, "Which") has had none: neither Codex's code review completed nor such a comment names the head
// commit, or one that only updates from `main` follow (merges whose second parent is no commit of the pull request's,
// as GitHub's "Update branch" makes; floor rule 8: nothing is reviewed twice), and, given the merges
// scripts/clean-merges.mjs proved, only through merges whose tree is the one git makes of their parents (#323), the
// status naming the one where that stops it. None is needed where every changed file
// is a Markdown file outside the rule files (docs alone; the rule files: floor rule 3's names in any folder, such as
// CLAUDE.local.md too, the copy under core/, .github/, .claude/, .agents/ and .agent/, and those the project's
// SECURITY.md adds; never in the core's own repository, where every file is protected), nor where the pull request has
// a sync's shape: the copy under core/, the manifest's pin and workflows whose pins alone move (floor rule 8: a pure
// sync gets no review; that its copy is the core's is scripts/pure-sync.mjs's to prove, not this check's). Given
// neither list, it waits only for a review running, as it did before it read them. A list GitHub cut short (3000
// files, 250 commits) is read as needing a review and as proving no update from main. A pull request that leaves this
// script alone and whose head does not hold it as the default branch does (BOUND=false, which the workflow sets) stood
// before the check came:
// its missing review is said in the status, never waited for (AGENTS.md, "Nothing locks a project"); brought up to
// date with main, it is held. A summary whose state cannot be read counts as no review of Codex's, with a warning. It
// does not hold what a review says, that docs another provider built got their code review, nor, given no list of the
// merges proved (a workflow older than this script), that a merge from `main` brought no change of its own: those stay
// with the builder and the reviews. It prints, as JSON, the commit to
// mark and the status to give it, named "code-review", or {} for a pull request that is closed or a draft. While
// "advisory" (the workflow's input, on unless turned off) the status is always a pass that says what the check would
// have done, as the security-review status's.
//
// Usage:  node scripts/code-review-wait.mjs <the pull request, as GitHub's API gives it> <its comments, the same>
//           [<its commits, the same> <its files, the same> [<the merges clean-merges.mjs proved>]]
//         ADVISORY=false for a status that waits; BOUND=false for a pull request from before the check; RUN_URL for
//         the link the status carries.
import { readFileSync } from "node:fs";
import { CORE } from "./core-address.mjs";
import { ruleFiles } from "./rule-files.mjs";
import { started } from "./started.mjs";
import { RUNNING, UNREAD, WRITERS, codexState, pinsAlone, standsFrom, status, unproved, whole } from "./security-review.mjs";

export const CONTEXT = "code-review";
const SHA = /^[0-9a-f]{40}$/u;
const POSTED = /^(?:\*\*)?Code review:/u;
const flat = (pages) => (Array.isArray(pages) ? pages.flat() : []).filter((entry) => entry !== null && typeof entry === "object");

// { sha, done, why, warning? }, or undefined for a pull request with nothing to mark (closed, a draft, no commit to name);
// merges: the SHAs of the merges clean-merges.mjs proved the ones git makes, where it ran (#323)
export function judge(pull, comments, commits, files, rules = [], bound = true, merges = undefined) {
  if (pull?.state !== "open" || pull.draft !== false || typeof pull.head?.sha !== "string" || !SHA.test(pull.head.sha)) return undefined;
  const sha = pull.head.sha;
  const read = codexState(flat(comments));
  const verdict = judgeWith(sha, flat(comments), read.state?.code_review, pull, commits, files, rules, bound, merges);
  // (a summary whose state cannot be read is no review of Codex's, running or done: the check warns, and goes on)
  return read.unread ? { ...verdict, warning: UNREAD } : verdict;
}
function judgeWith(sha, list, review, pull, commits, files, rules, bound, merges) {
  const short = sha.slice(0, 7);
  // the whole SHAs a posted code review names, never a prefix: an old review naming the first characters of another
  // commit must not stand for this one
  const posted = new Set(list.filter((comment) => typeof comment.body === "string" && POSTED.test(comment.body) && WRITERS.includes(comment.author_association))
    .flatMap((comment) => (comment.body.match(/(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/giu) ?? []).map((found) => found.toLowerCase())));
  const running = review !== null && typeof review === "object" && review.commit_sha === sha && RUNNING.includes(review.status);
  if (running) {
    if (posted.has(sha)) return { sha, done: true, why: `a code review of ${short} is posted, so Codex's running one is not waited for` };
    return { sha, done: false, why: `Codex's code review of ${short} is still running. Mend: wait for it` };
  }
  if (commits === undefined || files === undefined || (whole(pull, files) && !needs(pull, flat(files), rules))) return { sha, done: true, why: "no code review is running" };
  const seen = new Set(posted);
  if (review !== null && typeof review === "object" && review.status === "completed" && typeof review.commit_sha === "string") seen.add(review.commit_sha);
  // (a review stands for the head where only updates from main follow it, as security-review.mjs reads them)
  if ([...standsFrom(pull, flat(commits), sha, merges)].some((at) => seen.has(at))) return { sha, done: true, why: "a code review has run, and nothing but updates from main since" };
  // (where a merge from main that git would not make stops it, the status names that merge: #323)
  const cut = unproved(pull, flat(commits), sha, merges);
  const why = cut !== undefined && [...standsFrom(pull, flat(commits), sha)].some((at) => seen.has(at))
    ? `no code review of ${short}: merge ${cut.slice(0, 7)} is not the merge git makes. Mend: post "Code review:" naming the head's whole SHA`
    : `no code review of ${short}. Mend: ask one, or another reviewer posts "Code review:" naming its whole SHA`;
  // a pull request whose head does not hold this check as the default branch does stood before it came: reported only
  return bound ? { sha, done: false, why } : { sha, done: true, why: `before this check came, so not waited for: ${why}` };
}

// whether a pull request needs a code review: not where it holds docs alone, or has a sync's shape (the manifest's pin
// moved alone among them)
const MANIFEST = /^(Core: \S+ at )[0-9a-f]{40}(, copied whole under core\/.*)$/u;
const RULES = /(?:^|\/)(?:AGENTS|CLAUDE|SECURITY|GEMINI|REVIEW)(?:\.[\w-]+)?\.md$|threat-model|^core-manifest\.md$|^core\/|(?:^|\/)\.(?:github|claude|agents?)\//iu;
function needs(pull, files, rules) {
  const names = files.flatMap((file) => [file.filename, file.previous_filename]).filter((name) => name !== undefined);
  if (names.length === 0 || names.some((name) => typeof name !== "string")) return names.length > 0;
  // (in the core's own repository every file is protected, its SECURITY.md says, and every pull request gets its code
  // review: AGENTS.md, "How changes are made here")
  if (String(pull.base?.repo?.full_name).toLowerCase() === CORE.toLowerCase()) return true;
  const rule = (name) => RULES.test(name) || rules.includes(name);
  if (names.every((name) => /\.md$/iu.test(name) && !rule(name))) return false;
  const sync = files.every((file) => (file.filename === "core-manifest.md" && pinsAlone(file, MANIFEST)) || (file.filename.startsWith("core/") && (file.previous_filename ?? "core/").startsWith("core/"))
    || (/^\.github\/workflows\/[^/]+\.ya?ml$/u.test(file.filename) && pinsAlone(file)));
  return !(sync && files.some((file) => file.filename === "core-manifest.md"));
}
if (started(import.meta.url)) {
  const [pullFile, commentsFile, commitsFile, filesFile, mergesFile] = process.argv.slice(2);
  if (!pullFile || !commentsFile) {
    console.error("usage: node scripts/code-review-wait.mjs <the pull request, as JSON> <its comments, as JSON> [<its commits, as JSON> <its files, as JSON> [<the merges clean-merges.mjs proved, as JSON>]]");
    process.exit(2);
  }
  const read = (file) => JSON.parse(readFileSync(file, "utf8"));
  // (the project's own rule files, where its SECURITY.md names them; none read, where it names none)
  let rules = [];
  try { rules = ruleFiles(undefined, undefined, { tools: true }); } catch { rules = []; }
  const verdict = judge(read(pullFile), read(commentsFile), commitsFile ? read(commitsFile) : undefined, filesFile ? read(filesFile) : undefined, rules, process.env.BOUND !== "false", mergesFile ? read(mergesFile) : undefined);
  console.log(JSON.stringify(verdict === undefined ? {} : { sha: verdict.sha, status: status(verdict, process.env.ADVISORY !== "false", process.env.RUN_URL, CONTEXT), ...(verdict.warning ? { warning: verdict.warning } : {}) }));
}
