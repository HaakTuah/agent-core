#!/usr/bin/env node
// Has a code review that is running on this pull request finished (modules/reviews.md, point 2: a review already
// running is waited for, and one that hangs is taken over, so none can hold a pull request for long)? Run by the core's
// workflow security-review.yml beside scripts/security-review.mjs, in the same job, always from the default branch's
// copy, on what GitHub's own API gives of the pull request and its comments. It waits only while the summary Codex's own
// app keeps on the pull request says its code review is running on the pull request's head commit. The wait ends when
// Codex's code review finishes, or when a comment that opens "Code review:" from the repository's owner, a member or a
// collaborator names that commit by at least its first seven characters: how the next reviewer, or the fallback
// reviewer, posts the review it took over. A code review that never starts (one not asked, or a reviewer out of
// usage) has nothing running, and holds nothing. It does not hold that a code review was asked, nor what one says: those
// stay with the builder and the reviews. It prints, as JSON, the commit to mark and the status to give it, named
// "code-review", or {} for a pull request that is closed or a draft. While "advisory" (the workflow's input, on unless
// turned off) the status is always a pass that says what the check would have done, as the security-review status's.
//
// Usage:  node scripts/code-review-wait.mjs <the pull request, as GitHub's API gives it> <its comments, the same>
//         ADVISORY=false for a status that waits; RUN_URL for the link the status carries.
import { readFileSync } from "node:fs";
import { started } from "./started.mjs";
import { UNREAD, WRITERS, codexState, status } from "./security-review.mjs";

export const CONTEXT = "code-review";
const SHA = /^[0-9a-f]{40}$/u;
const POSTED = /^(?:\*\*)?Code review:/u;
// the words Codex's app writes for a review under way; any other (completed, none, or one not known) is none running,
// so that a form nobody documents can never hold a pull request for good
const RUNNING = ["running", "queued", "pending", "in_progress"];
const flat = (pages) => (Array.isArray(pages) ? pages.flat() : []).filter((entry) => entry !== null && typeof entry === "object");

// { sha, done, why, warning? }, or undefined for a pull request with nothing to mark (closed, a draft, no commit to name)
export function judge(pull, comments) {
  if (pull?.state !== "open" || pull.draft !== false || typeof pull.head?.sha !== "string" || !SHA.test(pull.head.sha)) return undefined;
  const sha = pull.head.sha;
  const list = flat(comments);
  const read = codexState(list);
  if (read.unread) return { sha, done: true, why: "no code review is running", warning: UNREAD };
  const review = read.state?.code_review;
  const running = review !== null && typeof review === "object" && review.commit_sha === sha && RUNNING.includes(review.status);
  if (!running) return { sha, done: true, why: "no code review is running" };
  const short = sha.slice(0, 7);
  const posted = list.some((comment) => typeof comment.body === "string" && POSTED.test(comment.body) && WRITERS.includes(comment.author_association) && comment.body.includes(short));
  if (posted) return { sha, done: true, why: `a code review of ${short} is posted, so Codex's running one is not waited for` };
  return { sha, done: false, why: `Codex's code review of ${short} is still running` };
}

if (started(import.meta.url)) {
  const [pullFile, commentsFile] = process.argv.slice(2);
  if (!pullFile || !commentsFile) {
    console.error("usage: node scripts/code-review-wait.mjs <the pull request, as JSON> <its comments, as JSON>");
    process.exit(2);
  }
  const read = (file) => JSON.parse(readFileSync(file, "utf8"));
  const verdict = judge(read(pullFile), read(commentsFile));
  console.log(JSON.stringify(verdict === undefined ? {} : { sha: verdict.sha, status: status(verdict, process.env.ADVISORY !== "false", process.env.RUN_URL, CONTEXT), ...(verdict.warning ? { warning: verdict.warning } : {}) }));
}
