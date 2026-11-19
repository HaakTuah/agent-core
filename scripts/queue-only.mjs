#!/usr/bin/env node
// Is this pull request queue-only (floor rule 8; #750, point 2)? A pull request that only changes lines of the
// *progress file* needs no review of its own where this proves it: GitHub's list of its files holds that one file
// alone, whole, changed in place, its patch given, from a branch of the repository's own, never a fork's (floor rule
// 4), into the default branch, the file being no rule file (rule-files.mjs); each line it adds is in the file's form
// (formFault: a row ending with its last "|", or an item, as the file's lines on the default branch are, each cell
// after a row's first, or an item's text after its issues, one a line there holds word for word, issues and numbers
// aside, 240 characters at most), names no points or steps of an issue before what it waits on, and names,
// first on the line, an issue (#n) that is open, no pull request, opened by the *owner's account*, labelled `queued`
// and neither `on-hold` nor `stand-in-yes`, and that either carries the owner's word, as AGENTS.md's "Whose words an
// issue holds" says (labelled `by:owner`, its text holding no agent's attribution line, opener or "Found while:"; or
// `by:chat` or `by:design`, with its current text quoting the owner under "The owner's word", or saying, in a sentence
// or clause that opens so under "What it is" or "The owner's word" and ends with a full stop, that the owner agreed,
// with no word of doubt, refusal or a part in it, fenced blocks read as neither), or needs none (labelled `bug`, or
// opened by the scheduled look, `by:look`); and each line it removes names an issue that is closed, or one a line it
// adds names again (a line edited or moved in place). A line is read as the progress file's readers read it
// (queue.mjs's linesOf: a row or an item that names its issues first), each issue it names first counted. A line that
// names no issue so, or is in no such form, an inbox file, issues that cannot be read whole, more than a dozen issues
// (MOST), or an issue that cannot be read, proves nothing, and the pull request gets its reviews as any other. So
// words new to the file, which no script can read exactly, are read by a review, and join what later lines may say
// only once a review passed them. What needs no word but cannot be read exactly (a test, a check for a rule that
// stands, an audit's small finding) is left to the reviews too. It reads the labels and the text a review would read,
// so a label set wrongly is caught by neither. It does not read the order: where the line joins, and which of the
// file's builders it names (a rule's issue given to a plain builder), stay with whoever writes the file
// (roles/shared/inbox.md; AGENTS.md, "Who builds a line, the line says").
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
import { RULES, ruleFiles } from "./rule-files.mjs";
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

// The form of a line the progress file holds (#750, point 2): what a script reads of it exactly. A row counts as one
// only where the line ends with its last "|", since GitHub shows nothing after it and every session reads it; each
// cell after a row's first (its builder, what it waits on), and an item's text after the issues it opens with, must
// be word for word one that a line on the default branch holds in that place, its issues and numbers aside, so a line
// says nothing the file has not said before. (A row's first cell holding more than issues and their points is read as
// naming none, by linesOf, and one naming points is refused by namesPoints.)
const LONGEST = 240;
const BULLET = /^\s*(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?/u, LEADS = /^#\d{1,9}(?:(?:\s*(?:,|&|\band\b|\bto\b)\s*)+#\d{1,9})*/u;
const ROW = /^\|.*\|[ \t]*$/u;
const cellsOf = (line) => line.trimEnd().split("|").slice(1, -1);
const shapeOf = (line) => (ROW.test(line) ? `a row of ${cellsOf(line).length} cells` : /^\|/u.test(line) ? "a row with text after its last |" : "an item");
const plain = (text) => text.replace(/#\d{1,9}/gu, "#n").replace(/\d+/gu, "n").replace(/\s+/gu, " ").trim();
// what a line says beyond the issues it names first, each part by its place: a row's cells after the first, an
// item's text after its issues
const partsOf = (line) => (ROW.test(line) ? cellsOf(line).slice(1).map((cell, at) => `${at + 1}: ${plain(cell)}`)
  : [`item: ${plain(line.replace(BULLET, "").replace(LEADS, ""))}`]);

// the form the progress file's lines take on the default branch: { shapes, parts }, or null where it is no text
export function formOf(base) {
  if (typeof base !== "string") return null;
  const lines = linesOf(base).map((l) => l.text);
  return { shapes: new Set(lines.map(shapeOf)), parts: new Set(lines.flatMap(partsOf)) };
}

// why a line a pull request adds is not in the file's form (formOf), or null
export function formFault(line, form) {
  if (line.length > LONGEST) return `is longer than ${LONGEST} characters`;
  if (!form.shapes.has(shapeOf(line))) return `is ${shapeOf(line)}, which no line of the file is`;
  const fresh = partsOf(line).find((part) => !form.parts.has(part));
  return fresh === undefined ? null : `says "${fresh.replace(/^\w+: /u, "").slice(0, 60)}" where no line of the file says it`;
}

// whether a line names points, steps, cases or parts of an issue before what it waits on: the owner's agreement is read
// for the whole issue, never for its points, so such a line is left to the reviews
const POINTS = /\b(?:points?|steps?|cases?|parts?)\b/iu;
export const namesPoints = (line) => POINTS.test(ROW.test(line) ? cellsOf(line).slice(0, -1).join("|") : line.replace(/\bwaits\s+on\b.*$/isu, ""));

// the lines under a heading of a text (a Markdown heading, or a line wholly in bold), to the next heading; a fenced
// block's lines are neither heading nor text, since what a fence holds is shown as code, never as the issue's word
const headingOf = (line) => /^ {0,3}#{1,6}[ \t]+(.*?)[ \t#]*$/u.exec(line)?.[1] ?? /^\*\*([^*].*?)\*\*:?[ \t]*$/u.exec(line.trim())?.[1] ?? null;
const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
function unfenced(text) {
  let fence = null;
  return String(text ?? "").split(/\r\n|\r|\n/u).map((line) => {
    const mark = FENCE.exec(line)?.[1];
    if (fence === null && mark) { fence = mark; return ""; }
    if (fence !== null) { if (mark && mark[0] === fence[0] && mark.length >= fence.length && !line.trim().slice(mark.length).trim()) fence = null; return ""; }
    return line;
  });
}
export function under(text, name) {
  const lines = unfenced(text), at = lines.findIndex((l) => headingOf(l)?.replace(/[*_:]/gu, "").trim().toLowerCase() === name.toLowerCase());
  if (at < 0) return null;
  const end = lines.findIndex((l, i) => i > at && headingOf(l) !== null);
  return lines.slice(at + 1, end < 0 ? undefined : end).filter((l) => l.trim());
}

// whether an issue's current text carries the owner's word as "Whose words an issue holds" reads it: the owner quoted
// under "The owner's word", or a design set out under "What it is" that the text says the owner agreed to, where they
// stand on the owner's voice (roles/shared/inbox.md), never under "The session's view (not a decision)": a sentence,
// or a clause after ", and", that opens "the owner agreed" and ends with a full stop, with no word of doubt, refusal
// or a part in it ("not", "if", "whether", "nothing", "yet", "only", "points" and the like), since an agreement in
// doubt, supposed, withheld or given to a part is no yes to the whole issue
const AGREED = /(?:^|[.!?]\s+|,\s+and\s+)(?:[-*>]\s+)?the owner agreed\b([^.!?]*)\./giu;
const DOUBT = /\b(?:not|never|no|none|nothing|if|unless|whether|yet|later|only|part|parts|partly|points?|steps?|cases?)\b|n't\b/iu;
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
// file's text on the default branch, whose form an added line must have, `rules` the project's rule files as
// rule-files.mjs lists them, beside those its RULES names: a progress file that is one is read at a session's start as
// a rule, and changing it asks a code review (floor rule 8).
export function judge(pull, files, { progress, owner, read, base, rules = [] }) {
  const head = pull?.head?.sha;
  if (pull?.state !== "open" || typeof head !== "string" || !SHA.test(head)) return { head: null, why: "no open pull request with a head to prove" };
  const form = formOf(base), list = flat(files);
  const why = setFault(pull, progress, rules, form) ?? fileFault(pull, list, progress);
  if (why) return { head: null, why };
  const lines = changed(list[0].patch);
  const off = lines === null ? "GitHub gives no patch of its lines" : lineFault(lines, form);
  if (off) return { head: null, why: off };
  const adds = lines.added.flatMap(itemsOf), removes = lines.removed.flatMap(itemsOf);
  if (new Set([...adds, ...removes]).size > MOST) return { head: null, why: `it names more than ${MOST} issues` };
  const fault = itemFault(adds, removes, read, owner);
  if (fault) return { head: null, why: fault };
  const [n, m] = [lines.added.length, lines.removed.length];
  return { head, why: `queue-only: ${n} line${n === 1 ? "" : "s"} added, ${m} removed, each issue as floor rule 8 asks` };
}

// why the progress file, or the branches the pull request joins, keep it from being proved, or null: a rule file
// (whose change asks a code review, floor rule 8), branches as branchFault reads them, or a file on the default branch
// whose form cannot be read
function setFault(pull, progress, rules, form) {
  if (RULES.test(progress) || rules.includes(progress)) return `${progress} is a rule file, whose change asks a code review (floor rule 8)`;
  return branchFault(pull) ?? (form === null ? `${progress} on the default branch could not be read` : null);
}

// why the lines a patch changes are not ones a script reads exactly, or null: each names its issues first, and each it
// adds is in the file's form and names no points of an issue
function lineFault(lines, form) {
  if ([...lines.added, ...lines.removed].some((line) => itemsOf(line) === null)) return "a line it changes names no issue";
  for (const line of lines.added) {
    const off = formFault(line, form) ?? (namesPoints(line) ? "names points or steps of an issue, whose agreement is read for the whole issue alone" : null);
    if (off) return `a line it adds ${off}`;
  }
  return null;
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
  // (where SECURITY.md lists no rule files of the project's own, as in the core, those floor rule 3 names by name alone)
  const rules = (() => { try { return ruleFiles(undefined, undefined, { tools: true }); } catch { return []; } })();
  const verdict = /^[\w-]+\/[\w.-]+$/u.test(repo) ? judge(read(pullFile), read(filesFile), { progress, owner, read: (item) => readItem(repo, item, ".", owner), base, rules })
    : { head: null, why: "no repository named" };
  console.log(verdict.head ?? `not queue-only: ${verdict.why}`);
  if (verdict.head) console.error(verdict.why);
  process.exit(verdict.head ? 0 : 1);
}
