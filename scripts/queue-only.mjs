#!/usr/bin/env node
// Is this pull request queue-only (floor rule 8; #750, point 2)? A pull request that only changes lines of the
// *progress file* needs no review of its own where this proves it: GitHub's list of its files holds that one file
// alone, whole, changed in place, its patch given; each line it adds names, first on the line, an issue (#n) that is
// open, no pull request, opened by the *owner's account*, labelled `queued` and neither `on-hold` nor `stand-in-yes`,
// and that either carries the owner's word, as AGENTS.md's "Whose words an issue holds" says (labelled `by:owner`; or
// `by:chat` or `by:design`, with its current text quoting the owner under "The owner's word", or setting out "What it
// is" and saying the owner agreed to it), or needs none (labelled `bug`, or opened by the scheduled look, `by:look`);
// and each line it removes names an issue that is closed, or one a line it adds names again (a line edited or moved in
// place). A line is read as the progress file's readers read it (queue.mjs's linesOf: a row or an item that names its
// issues first), each issue it names first counted. A line that names no issue so, an inbox file, issues that cannot
// be read whole, more than a dozen issues (MOST), or an issue that cannot be read, proves nothing, and the pull
// request gets its reviews as any other. What needs no word but cannot be read exactly (a test, a check for a rule
// that stands, an audit's small finding) is left to the reviews too. It reads the labels and the text a review would
// read, so a label set wrongly is caught by neither; that the line joins in the order the owner wants stays with
// whoever writes the file (roles/shared/inbox.md).
// Run by the core's own security-review caller (.github/workflows/own-security-review.yml) from the default branch's
// copy, in a job of its own whose token may read issues, which the core's shared workflow's may not (a project's caller
// grants it no such right), never from the pull request's: it hands the head it proved to that workflow, whose scripts
// then ask no review of it (security-review.mjs, code-review-wait.mjs). The progress file and the owner's account are
// read from the default branch's manifest on disk (AGENTS.md in the core; core-manifest.md in a project).
//
// Usage:  node scripts/queue-only.mjs <the pull request, as GitHub's API gives it> <its files, the same>
//         REPO (or GITHUB_REPOSITORY) the repository; GH_TOKEN for gh. Prints the head's SHA and exits 0 where it
//         proves it; otherwise prints why not and exits 1 (no check: a pull request it does not prove is reviewed).
import { existsSync, readFileSync } from "node:fs";
import { MOST, ownerAt, progressOf, readItem } from "./done-when.mjs";
import { linesOf } from "./queue.mjs";
import { started } from "./started.mjs";

const SHA = /^[0-9a-f]{40}$/u;
const LIST = JSON.parse(readFileSync(new URL("./labels.json", import.meta.url), "utf8"));
const WORD = new Set(["by:owner", "by:chat", "by:design"]), NONE = new Set(["bug", "by:look"]), BARRED = ["on-hold", "stand-in-yes"];
const flat = (pages) => (Array.isArray(pages) ? pages.flat() : []).filter((entry) => entry !== null && typeof entry === "object");
const same = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();

// the lines a patch adds and removes ({ added, removed }), or null where it is no patch of lines GitHub gives
export function changed(patch) {
  if (typeof patch !== "string" || patch === "" || !patch.startsWith("@@")) return null;
  const added = [], removed = [];
  for (const line of patch.split("\n")) {
    if (line.startsWith("+")) added.push(line.slice(1));
    else if (line.startsWith("-")) removed.push(line.slice(1));
  }
  return { added, removed };
}

// the issues a line names first, as "#n", as the progress file's readers read it (queue.mjs); null where it names
// none, or none that can be read whole
function itemsOf(line) {
  const [read] = linesOf(line);
  return read && !read.kept ? read.issues.map((n) => `#${n}`) : null;
}

// the lines under a heading of a text (a Markdown heading, or a line wholly in bold), to the next heading
const headingOf = (line) => /^ {0,3}#{1,6}[ \t]+(.*?)[ \t#]*$/u.exec(line)?.[1] ?? /^\*\*([^*].*?)\*\*:?[ \t]*$/u.exec(line.trim())?.[1] ?? null;
export function under(text, name) {
  const lines = String(text ?? "").split(/\r\n|\r|\n/u), at = lines.findIndex((l) => headingOf(l)?.replace(/[*_:]/gu, "").trim().toLowerCase() === name.toLowerCase());
  if (at < 0) return null;
  const end = lines.findIndex((l, i) => i > at && headingOf(l) !== null);
  return lines.slice(at + 1, end < 0 ? undefined : end).filter((l) => l.trim());
}

// whether an issue's current text carries the owner's word as "Whose words an issue holds" reads it: the owner quoted
// under "The owner's word", or a design set out under "What it is" that the text says the owner agreed to
export function carries(body) {
  if ((under(body, LIST.headings.word) ?? []).some((l) => /^\s*>\s*\S/u.test(l))) return true;
  return (under(body, LIST.headings.design) ?? []).length > 0 && /\bthe owner agreed\b/iu.test(String(body));
}

// why an issue a line adds cannot join without a review, or null where it can
export function joinFault(issue, owner) {
  if (issue === null || issue === undefined || issue.limited) return "could not be read";
  if (issue.state !== "open" || issue.pull) return "is not an open issue";
  if (!same(issue.author, owner)) return "was not opened by the owner's account";
  const labels = new Set(issue.labels);
  if (!labels.has("queued")) return "is not labelled queued";
  const barred = BARRED.find((label) => labels.has(label));
  if (barred) return `is labelled ${barred}`;
  if ([...NONE].some((label) => labels.has(label))) return null;
  if (labels.has("by:owner")) return null;
  if ([...WORD].some((label) => labels.has(label)) && carries(issue.body)) return null;
  return "carries no owner's word that can be read, and is no bug or task of the look";
}

// why the pull request's files are not the progress file alone, changed in place, or null
function fileFault(pull, list, progress) {
  if (!Number.isInteger(pull.changed_files) || pull.changed_files !== 1 || list.length !== 1) return "it changes more than one file";
  const [file] = list;
  if (file.filename !== progress || file.status !== "modified" || file.previous_filename !== undefined) return `its one file is not ${progress}, changed in place`;
  return null;
}

// why an issue a line adds cannot join, or one a line removes is not closed, or null
function itemFault(adds, removes, read, owner) {
  for (const item of new Set(adds)) {
    const fault = joinFault(read(item), owner);
    if (fault) return `${item}, which a line it adds names, ${fault}`;
  }
  for (const item of new Set(removes.filter((item) => !adds.includes(item)))) {
    const issue = read(item);
    if (!issue || issue.limited || issue.state !== "closed" || issue.pull) return `${item}, whose line it removes, is not a closed issue`;
  }
  return null;
}

// { head, why }: head the pull request's SHA where it is queue-only, else null, and why. `progress` the progress file's
// path, `owner` the owner's account, `read(item)` an issue as done-when.mjs's readItem gives it.
export function judge(pull, files, { progress, owner, read }) {
  const head = pull?.head?.sha;
  if (pull?.state !== "open" || typeof head !== "string" || !SHA.test(head)) return { head: null, why: "no open pull request with a head to prove" };
  const list = flat(files);
  const bad = fileFault(pull, list, progress);
  if (bad) return { head: null, why: bad };
  const lines = changed(list[0].patch);
  if (lines === null) return { head: null, why: "GitHub gives no patch of its lines" };
  const added = lines.added.map(itemsOf), removed = lines.removed.map(itemsOf);
  if ([...added, ...removed].some((items) => items === null)) return { head: null, why: "a line it changes names no issue" };
  const adds = added.flat(), removes = removed.flat();
  const items = [...new Set([...adds, ...removes])];
  if (items.length > MOST) return { head: null, why: `it names more than ${MOST} issues` };
  const fault = itemFault(adds, removes, read, owner);
  if (fault) return { head: null, why: fault };
  return { head, why: `queue-only: ${added.length} line${added.length === 1 ? "" : "s"} added, ${removed.length} removed, each issue as floor rule 8 asks` };
}

if (started(import.meta.url)) {
  const [pullFile, filesFile] = process.argv.slice(2);
  if (!pullFile || !filesFile) {
    console.error("usage: node scripts/queue-only.mjs <the pull request, as JSON> <its files, as JSON>");
    process.exit(2);
  }
  const read = (file) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } };
  const repo = String(process.env.REPO ?? process.env.GITHUB_REPOSITORY ?? "");
  // (the default branch's manifest, checked out here: AGENTS.md in the core, core-manifest.md in a project)
  const prefix = existsSync("core-manifest.md") ? "core/" : "";
  const manifest = existsSync(prefix ? "core-manifest.md" : "AGENTS.md") ? readFileSync(prefix ? "core-manifest.md" : "AGENTS.md", "utf8") : "";
  const owner = ownerAt(manifest, prefix, repo);
  const verdict = /^[\w-]+\/[\w.-]+$/u.test(repo) ? judge(read(pullFile), read(filesFile), { progress: progressOf(manifest), owner, read: (item) => readItem(repo, item, ".", owner) })
    : { head: null, why: "no repository named" };
  console.log(verdict.head ?? `not queue-only: ${verdict.why}`);
  if (verdict.head) console.error(verdict.why);
  process.exit(verdict.head ? 0 : 1);
}
