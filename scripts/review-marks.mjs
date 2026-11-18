// The marks reviews leave, as a check reads them (#551), for every project that takes the core:
//   - What a posted review declares (tasks/reviews.md, point 3): of the comments that open "Security review:", "Code
//     review:" or "Design check:" from an account the host lets write, posted on or after MARKS_SINCE, the newest of
//     each kind declares its blocking findings and its other findings on lines of their own, as review-record.mjs,
//     beside this file, reads them (blockingOf, otherOf); a note that none is needed declares nothing, and Codex's app,
//     which posts in its own form under an account of its own, is not read here.
//   - The design check (tasks/reviews.md, point 4): in the core's own repository, a pull request that changes a file
//     under floor/, roles/, tasks/ or tools/ (its *design-checked PRs*) has a "Design check:" from such an account,
//     as first posted, naming by its whole SHA the head or a commit that only updates from main follow; one opened
//     before MARKS_SINCE is not asked. In a project, which pull requests are design-checked is its manifest's slot,
//     none by default, which no check reads without guessing, so none is asked.
//   - A late review (tasks/reviews.md, "A late review is still read"): of Codex's findings in the last week (inline,
//     with a priority badge), those made after their pull request merged with no reply, which the scheduled look lists
//     (look.mjs, beside this file); a posted review's findings, written in its comment's text, are no check's to read.
// The first two are read by code-review-wait.mjs, beside this file, into the code-review status. What a review says,
// and whether its counts are true, stay the reviewer's. Node's own modules only.
import { blockingOf, codexFind, otherOf, postedKind } from "./review-record.mjs";
import { asPosted } from "./security-review.mjs";

// The day from which a posted review is asked its lines, and a pull request opened then its design check.
export const MARKS_SINCE = "2026-11-18T00:00:00Z";
// The folders whose change makes a pull request of the core's design-checked (AGENTS.md's slot *design-checked PRs*).
export const DESIGNED = /^(?:floor|roles|tasks|tools)\//u;
const KINDS = { security: "Security review", code: "Code review", design: "Design check" };
const SHAS = /(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/giu;
// A posted review's form, as security-review.mjs's form() writes it, for each kind.
const formOf = kind => `${kind}: <whole SHA>⏎Blocking findings: N.⏎Other findings: M.`;

// Of the posted reviews among `comments` (an issue's, as GitHub's API gives them) by an account in `writers` (GitHub's
// author_association), posted on or after `since`, the kinds whose newest declares no line of its blocking findings
// or of its other findings: ["Code review", ...].
export function undeclared(comments, writers, since = MARKS_SINCE) {
  const newest = new Map();
  for (const c of comments) {
    const kind = postedKind(c?.body);
    if (!KINDS[kind] || !writers.includes(c.author_association) || String(c.created_at ?? "") < since) continue;
    if (!newest.has(kind) || String(c.created_at) >= String(newest.get(kind).created_at)) newest.set(kind, c);
  }
  return [...newest].filter(([, c]) => blockingOf(c.body) === null || otherOf(c.body) === null).map(([kind]) => KINDS[kind]);
}

// Whether a pull request of the core's (`core`: its base is the core's own repository) asks the design check: opened on
// or after `since`, and changing a file under DESIGNED, by its name now or before (`files`, as GitHub's API gives them).
export const designAsked = (pull, files, core, since = MARKS_SINCE) => core && String(pull?.created_at ?? "") >= since
  && files.some(f => [f?.filename, f?.previous_filename].some(n => typeof n === "string" && DESIGNED.test(n)));

// Whether a "Design check:" from an account in `writers`, as first posted, names a commit of `chain` (the head and the
// commits that only updates from main follow, as security-review.mjs's standsFrom gives them).
export const designed = (comments, writers, chain) => comments.some(c => postedKind(c?.body) === "design" && writers.includes(c.author_association) && asPosted(c)
  && (String(c.body).match(SHAS) ?? []).some(sha => chain.has(sha.toLowerCase())));

// What the marks make a pull request wait on, a line with its mend, or null where they are kept.
export function marksWait({ pull, comments, files, chain, writers, core }) {
  const missing = undeclared(comments, writers);
  if (missing.length) return `a posted ${missing.join(" and a posted ")} declares no line of its findings. Mend: post it again, as a new comment, in its form (${formOf(missing[0])})`;
  if (files !== undefined && chain !== undefined && designAsked(pull, files, core) && !designed(comments, writers, chain)) return `no design check of the head. Mend: a fresh reviewer judges the work against its design (tasks/reviews.md, point 4), and posts ${formOf(KINDS.design)}`;
  return null;
}

// The late findings (tasks/reviews.md, "A late review is still read"): of `inline` (review comments, any pull
// request's, as GitHub's API gives them), Codex's findings made after their pull request merged (`merged`, a Map of the
// pull request's number to when it merged), with no comment replying to them: [{ pull, url, review, at }].
export function lateOf(inline, merged) {
  const answered = new Set(inline.map(c => c?.in_reply_to_id).filter(id => id !== undefined && id !== null));
  return inline.flatMap(c => {
    const find = codexFind(c), pull = Number(/\/pulls\/(\d+)$/u.exec(String(c?.pull_request_url ?? ""))?.[1]);
    const at = merged.get(pull);
    return find && at && String(c.created_at) > at && !answered.has(c.id) ? [{ pull, url: String(c.html_url ?? ""), review: find.review, at: String(c.created_at) }] : [];
  });
}

// The body of the look's issue for them, or null where none stands.
export const lateBody = late => (late.length ? `Findings of a reviewer the project asks, made after their pull request merged, with no reply (tasks/reviews.md, "A late review is still read"). A session answers each as point 5 of that file says: what holds is a bug, filed and fixed (a weakness: floor rule 9, never described in public), and its reply on the finding says what was done.\n\n${late.map(l => (l.review === "security" ? `- #${l.pull}, a finding of Codex's security review, ${l.at.slice(0, 10)}: read it on the pull request; nothing of it is written here (floor rule 9)` : `- #${l.pull}, Codex's code review, ${l.at.slice(0, 10)}: ${l.url}`)).join("\n")}` : null);
