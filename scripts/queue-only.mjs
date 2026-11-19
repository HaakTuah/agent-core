#!/usr/bin/env node
// Is this pull request queue-only (floor rule 8; #750, point 2)? A pull request that only changes lines of the
// *progress file* needs no review of its own where this proves it: GitHub's list of its files holds that one file
// alone, whole, changed in place, its patch given, from a branch of the repository's own, never a fork's (floor rule
// 4); each line it adds is in the file's form (formFault: a row or an item as the file's lines on the default branch
// are, its "Who" leading with a builder a line there names, its other words ones the file already holds, issues and
// numbers aside, in letters, figures and plain punctuation, 240 characters at most), and names, first on the line, an
// issue (#n) that is open, no pull request, opened by the *owner's account*, labelled `queued` and neither `on-hold`
// nor `stand-in-yes`, and that either carries the owner's word, as AGENTS.md's "Whose words an issue holds" says
// (labelled `by:owner`, its text holding no agent's attribution line, opener or "Found while:"; or `by:chat` or
// `by:design`, with its current text quoting the owner under "The owner's word", or saying, in a sentence or clause
// that opens so under "What it is" or "The owner's word", that the owner agreed, with no "not", "if" or "whether" in
// it), or needs none (labelled `bug`, or opened by the scheduled look, `by:look`); and each line it removes names an
// issue that is closed, or one a line it adds names again (a line edited or moved in place). A line is read as the
// progress file's readers read it (queue.mjs's linesOf: a row or an item that names its issues first), each issue it
// names first counted. A line that names no issue so, or is in no such form, an inbox file, issues that cannot be read
// whole, more than a dozen issues (MOST), or an issue that cannot be read, proves nothing, and the pull request gets
// its reviews as any other. So a word new to the file, which no script can read exactly, is read by a review, and
// joins the words later lines may use only once a review passed it. What needs no word but cannot be read exactly (a
// test, a check for a rule that stands, an audit's small finding) is left to the reviews too. It reads the labels and
// the text a review would read, so a label set wrongly is caught by neither; that the line joins in the order the
// owner wants stays with whoever writes the file (roles/shared/inbox.md).
// Run by the core's own security-review caller (.github/workflows/own-security-review.yml) from the default branch's
// copy, in a job of its own whose token may read issues, which the core's shared workflow's may not (a project's caller
// grants it no such right), never from the pull request's: it hands the head it proved to that workflow, whose scripts
// then ask no review of it (security-review.mjs, code-review-wait.mjs). The progress file and the owner's account are
// read from the default branch's manifest on disk (AGENTS.md in the core; core-manifest.md in a project), and the file's
// form from its copy there, as git holds it (1 MB at most, queue.mjs's LARGEST).
//
// Usage:  node scripts/queue-only.mjs <the pull request, as GitHub's API gives it> <its files, the same>
//         REPO (or GITHUB_REPOSITORY) the repository; GH_TOKEN for gh. Prints the head's SHA and exits 0 where it
//         proves it; otherwise prints why not and exits 1 (no check: a pull request it does not prove is reviewed).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { MOST, ownerAt, progressOf, readItem } from "./done-when.mjs";
import { byAgent, found, opens } from "./labels.mjs";
import { LARGEST, linesOf } from "./queue.mjs";
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

// The form of a line the progress file holds (#750, point 2): what a script reads of it exactly. A word is a run of
// letters or figures (an inner ' or - kept) or a span in backticks; an issue (#n) or a number is free; what lies
// between words is plain punctuation alone; a row's "Who" leads, to its first ; : , or (, with a builder.
const TOKEN = /`[^`\n]*`|#\d+|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu, FREE = /^(?:#?\d+)$/u, BETWEEN = /^[ \t.,;:()|'’*+-]*$/u;
const LONGEST = 240;
const BULLET = /^\s*(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?/u;
const cellsOf = (line) => line.split("|").slice(1, -1);
const shapeOf = (line) => (/^\|/u.test(line) ? `a row of ${cellsOf(line).length} cells` : "an item");
const leadOf = (line) => (/^\|/u.test(line) ? String(cellsOf(line)[1] ?? "").split(/[;:,(]/u)[0].trim().toLowerCase() : null);
const wordsOf = (text) => String(text).match(TOKEN) ?? [];

// the form the progress file's lines take on the default branch: { shapes, leads, words }, or null where it is no text
export function formOf(base) {
  if (typeof base !== "string") return null;
  const lines = linesOf(base).map((l) => l.text);
  return { shapes: new Set(lines.map(shapeOf)), leads: new Set(lines.map(leadOf).filter((l) => l !== null)),
    words: new Set(wordsOf(base).map((w) => w.toLowerCase())) };
}

// why a line a pull request adds is not in the file's form (formOf), or null
export function formFault(line, form) {
  if (line.length > LONGEST) return `is longer than ${LONGEST} characters`;
  if (!form.shapes.has(shapeOf(line))) return `is ${shapeOf(line)}, which no line of the file is`;
  const lead = leadOf(line);
  if (lead !== null && !form.leads.has(lead)) return `names as its builder "${lead.slice(0, 40)}", which no line of the file names`;
  const text = line.replace(BULLET, "");
  if (!BETWEEN.test(text.replace(TOKEN, ""))) return "holds a character other than letters, figures and plain punctuation";
  const fresh = wordsOf(text).find((w) => !FREE.test(w) && !form.words.has(w.toLowerCase()));
  return fresh === undefined ? null : `holds the word "${fresh.slice(0, 40)}", which the file does not hold yet`;
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
// under "The owner's word", or a design set out under "What it is" that the text says the owner agreed to, where they
// stand on the owner's voice (roles/shared/inbox.md), never under "The session's view (not a decision)": a sentence,
// or a clause after ", and", that opens "the owner agreed", with no "not", "never", "if", "unless" or "whether" to its
// end (an agreement in doubt, or one supposed, is none)
const AGREED = /(?:^|[.!?]\s+|,\s+and\s+)(?:[-*>]\s+)?the owner agreed\b([^.!?]*)/giu, DOUBT = /\b(?:not|never|if|unless|whether)\b|n't\b/iu;
const agrees = (line) => [...line.matchAll(AGREED)].some((m) => !DOUBT.test(m[1]));
export function carries(body) {
  const word = under(body, LIST.headings.word) ?? [], design = under(body, LIST.headings.design) ?? [];
  if (word.some((l) => /^\s*>\s*\S/u.test(l))) return true;
  return design.length > 0 && [...design, ...word].some(agrees);
}

// whether an issue labelled by:owner reads as typed by the owner: no agent's attribution line, no line that opens as
// an agent's comment does (labels.json's openers), and no "Found while:" (floor rule 4, "The owner's word")
export const typed = (body) => !byAgent(body) && !found(body) && !String(body ?? "").split("\n").some((l) => opens(l));

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
  if (labels.has("by:owner")) return typed(issue.body) ? null : "is labelled by:owner, but its text is an agent's";
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

// why a pull request's branches keep it from being proved: a head that is no branch of the repository's own, or a base
// that is not the default branch, whose file the form is read from; null where neither
function branchFault(pull) {
  const from = pull.head?.repo?.full_name, into = pull.base?.repo?.full_name;
  if (typeof from !== "string" || typeof into !== "string" || !same(from, into)) return "its head is no branch of the repository's own (floor rule 4)";
  if (typeof pull.base?.ref !== "string" || pull.base.ref !== pull.base?.repo?.default_branch) return "it merges into no default branch, whose file its form is read from";
  return null;
}

// { head, why }: head the pull request's SHA where it is queue-only, else null, and why. `progress` the progress file's
// path, `owner` the owner's account, `read(item)` an issue as done-when.mjs's readItem gives it, `base` the progress
// file's text on the default branch, whose form an added line must have.
export function judge(pull, files, { progress, owner, read, base }) {
  const head = pull?.head?.sha;
  if (pull?.state !== "open" || typeof head !== "string" || !SHA.test(head)) return { head: null, why: "no open pull request with a head to prove" };
  const stray = branchFault(pull);
  if (stray) return { head: null, why: stray };
  const form = formOf(base);
  if (form === null) return { head: null, why: `${progress} on the default branch could not be read` };
  const list = flat(files);
  const bad = fileFault(pull, list, progress);
  if (bad) return { head: null, why: bad };
  const lines = changed(list[0].patch);
  if (lines === null) return { head: null, why: "GitHub gives no patch of its lines" };
  const added = lines.added.map(itemsOf), removed = lines.removed.map(itemsOf);
  if ([...added, ...removed].some((items) => items === null)) return { head: null, why: "a line it changes names no issue" };
  for (const line of lines.added) {
    const off = formFault(line, form);
    if (off) return { head: null, why: `a line it adds ${off}` };
  }
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
  const owner = ownerAt(manifest, prefix, repo), progress = progressOf(manifest);
  // (the progress file as the default branch's commit holds it, from git, so that a link is never followed)
  const shown = spawnSync("git", ["show", `HEAD:${progress}`], { encoding: "utf8", maxBuffer: LARGEST + 1 });
  const base = shown.status === 0 && shown.stdout.length <= LARGEST ? shown.stdout : null;
  const verdict = /^[\w-]+\/[\w.-]+$/u.test(repo) ? judge(read(pullFile), read(filesFile), { progress, owner, read: (item) => readItem(repo, item, ".", owner), base })
    : { head: null, why: "no repository named" };
  console.log(verdict.head ?? `not queue-only: ${verdict.why}`);
  if (verdict.head) console.error(verdict.why);
  process.exit(verdict.head ? 0 : 1);
}
