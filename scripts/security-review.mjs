#!/usr/bin/env node
// Has this pull request's security review run (floor rule 8: "No PR merges before its security review has run, nor
// with a blocking security finding open")? Run by the core's workflow security-review.yml, always from the default
// branch's copy, on what GitHub's own API gives of the pull request and its comments. It takes two things as proof:
// the summary Codex's own app keeps on the pull request (its login and kind are GitHub's, which no one else can post
// under), saying its security review is completed, with no finding of it left open; or a comment that opens "Security
// review:" from the repository's owner, a member or a collaborator, which is how another reviewer's, or the fallback
// reviewer's, is posted (modules/reviews.md, point 3). Nothing else on the pull request counts: not its description,
// not a comment of anyone else, not a review's own text. What it does not hold: that a later commit which changes
// what the review was for got its check, nor what a posted review says; both stay with the builder and the reviews.
// It prints, as JSON, the commit to mark and the status to give it, or {} for a pull request that is closed or a
// draft. While "advisory" (the workflow's input, on unless turned off) the status is always a pass that says what the
// check would have done, so a week of pull requests shows whether it is right before anything waits for it.
//
// Usage:  node scripts/security-review.mjs <the pull request, as GitHub's API gives it> <its comments, the same>
//         ADVISORY=false for a status that waits; RUN_URL for the link the status carries.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CODEX = "chatgpt-codex-connector[bot]";
// the first two lines of the summary Codex's app keeps: the second is its state, as JSON with each brace written as
// &#123; or &#125;
const SUMMARY = /^<!-- codex-pull-request-review-summary -->\r?\n<!-- codex-review-state:v1 ([^\r\n]{1,4000}) -->\r?\n/u;
const WRITERS = ["OWNER", "MEMBER", "COLLABORATOR"]; // GitHub's own word for who wrote a comment, not the comment's
const POSTED = /^(?:\*\*)?Security review:/u;
const SHA = /^[0-9a-f]{40}$/u;
export const CONTEXT = "security-review";

// what the newest summary of Codex's app says of its security review; undefined where there is none it can read
function codex(comments) {
  let newest;
  for (const comment of comments) {
    if (comment?.user?.login !== CODEX || comment.user.type !== "Bot" || typeof comment.body !== "string") continue;
    const text = SUMMARY.exec(comment.body)?.[1];
    if (text === undefined) continue;
    let state;
    try { state = JSON.parse(text.replaceAll("&#123;", "{").replaceAll("&#125;", "}")); } catch { continue; }
    const at = Date.parse(comment.updated_at) || 0;
    if (newest === undefined || at >= newest.at) newest = { at, review: state?.security_review };
  }
  return newest?.review;
}

// { sha, done, why }, or undefined for a pull request with nothing to mark (closed, a draft, no commit to name)
export function judge(pull, comments) {
  if (pull?.state !== "open" || pull.draft !== false || typeof pull.head?.sha !== "string" || !SHA.test(pull.head.sha)) return undefined;
  const sha = pull.head.sha;
  const list = Array.isArray(comments) ? comments.flat() : [];
  const review = codex(list);
  if (review !== null && typeof review === "object" && review.status === "completed") {
    if (review.has_unresolved_findings === true) return { sha, done: false, why: "Codex's security review has a finding open" };
    const on = typeof review.commit_sha === "string" && SHA.test(review.commit_sha) ? ` (on ${review.commit_sha.slice(0, 7)})` : "";
    return { sha, done: true, why: `Codex's security review has run${on}` };
  }
  const posted = list.some((comment) => typeof comment?.body === "string" && POSTED.test(comment.body) && WRITERS.includes(comment.author_association));
  if (posted) return { sha, done: true, why: "a security review is posted on the pull request" };
  return { sha, done: false, why: "no security review has run yet" };
}

// the commit status GitHub is given: while advisory always a pass, saying what the check would have done
export function status(verdict, advisory, url) {
  const state = verdict.done || advisory ? "success" : "pending";
  const description = `${advisory ? "Advisory: " : ""}${verdict.done ? "" : advisory ? "would wait, " : "Waiting: "}${verdict.why}`;
  return { state, description, context: CONTEXT, ...(typeof url === "string" && /^https:\/\/[\w./-]{1,200}$/u.test(url) ? { target_url: url } : {}) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [pullFile, commentsFile] = process.argv.slice(2);
  if (!pullFile || !commentsFile) {
    console.error("usage: node scripts/security-review.mjs <the pull request, as JSON> <its comments, as JSON>");
    process.exit(2);
  }
  const verdict = judge(JSON.parse(readFileSync(pullFile, "utf8")), JSON.parse(readFileSync(commentsFile, "utf8")));
  console.log(JSON.stringify(verdict === undefined ? {} : { sha: verdict.sha, status: status(verdict, process.env.ADVISORY !== "false", process.env.RUN_URL) }));
}
