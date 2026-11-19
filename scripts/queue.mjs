// The *progress file* (in the core, QUEUE.md; AGENTS.md, "The queue"; in a project, the file its manifest's slot
// names: roles/shared/inbox.md, "The progress file holds order only"), read as its readers read it: its lines in order,
// a line whose issue has closed skipped, since a line no longer leaves in the pull request that closes its issue,
// where pull requests merging side by side collided on the one file, and the next pull request that changes the file
// clears such lines together (#750, point 1). A line is a row of a table or an item of a list that names its issue
// first ("#n"), and goes once every issue it names first has closed; what it waits on is a row's last cell, or what an
// item names after "waits on", and an issue or pull request named there that has closed is waited on no more. Its
// text and GitHub's answers are untrusted (SECURITY.md, rule 5): each is checked against its form, and only the
// repository's name reaches gh's route. Reads the issues through gh (GITHUB_REPOSITORY and
// GH_TOKEN where GitHub's job sets them; else the repository origin names, or, in the core, its own address, and gh's
// sign-in); writes the progress file with --clear alone.
//
//   node core/scripts/queue.mjs           the open lines in order, and the next: the first that waits on nothing open
//   node core/scripts/queue.mjs --clear   takes out the line of each closed issue, in the pull request that changes
//                                         the file
//   node core/scripts/queue.mjs --check   on a pull request that changes the file: fails where a line of a closed issue
//                                         stands, saying the mend (in the core, own-description.yml runs it)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { CORE } from "./core-address.mjs";
import { progressOf } from "./done-when.mjs";
import { repoOf } from "./inbox.mjs";
import { started } from "./started.mjs";

export const FILE = "QUEUE.md";
export const LARGEST = 1 << 20; // (bytes: a progress file past it is refused, never read; SECURITY.md, rule 5)
const ROW = /^\|([^|]*)\|/u, ITEM = /^\s*[-*]\s+(?:\[[ xX]\]\s+)?#(\d{1,9})\b/u;
// The numbers a text names, a range "#a to #b" (at most a hundred wide) named whole.
const numbers = text => [...String(text).matchAll(/#(\d{1,9})\b(?:\s+to\s+#(\d{1,9})\b)?/gu)].flatMap(m => {
  const [from, to] = [Number(m[1]), m[2] === undefined ? null : Number(m[2])];
  return to !== null && to > from && to - from <= 100 ? Array.from({ length: to - from + 1 }, (_, i) => from + i) : to === null ? [from] : [from, to];
});
// What a line waits on beyond the issues it names: its words with each reference ("#n", "#n's points 1 to 3") and the
// words that join them taken out; a line whose words keep anything else (a hold, the owner's word) still waits.
const beyond = words => String(words).replace(/#\d{1,9}(?:'s\s+points?\s+[\d\s,]+(?:(?:to|and)\s+\d+)?)?/gu, " ").replace(/\b(?:and|after|then|or)\b|[,;.]/gu, " ").trim();

// The lines of a progress file's text, in order: { at, text, issues, waits, words, owner }: `at` its index among the
// text's lines; `issues` the issues it names first (a row's first cell, all it names there; an item's first);
// `waits` the numbers what it waits on names (a row's last cell, or what an item names after "waits on"), `words`
// that text; `owner` whether a row's second cell holds it for the owner ("the owner", AGENTS.md, "The queue").
export function linesOf(text) {
  return String(text ?? "").split("\n").map((line, at) => {
    const plain = line.replace(/\r$/u, ""), row = ROW.exec(plain), item = row ? null : ITEM.exec(plain);
    const issues = row ? (/^\s*#\d/u.test(row[1]) ? numbers(row[1]) : []) : item ? [Number(item[1])] : [];
    if (!issues.length) return null;
    const cells = row ? plain.split("|").slice(1, -1) : [];
    const words = (row ? cells.at(-1) ?? "" : /\bwaits on\b(.*)$/iu.exec(plain)?.[1] ?? "").trim();
    return { at, text: line, issues, waits: numbers(words), words, owner: row !== null && /^\s*the owner\b/iu.test(cells[1] ?? "") };
  }).filter(Boolean);
}

// The progress file as its readers take it, given `closed` (a number => whether that issue or pull request has
// closed): { open, gone, next }, `gone` the lines all of whose issues have closed, `next` the first open line that no
// one holds for the owner and that waits on nothing open (what it waits on empty, or naming only what has closed and
// nothing else, such as a hold), or null.
export function read(text, closed) {
  const lines = linesOf(text), done = l => l.issues.every(closed);
  const gone = lines.filter(done), open = lines.filter(l => !done(l));
  const free = l => !l.owner && l.waits.every(closed) && beyond(l.words) === "";
  return { open, gone, next: open.find(free) ?? null };
}

// The text with each line all of whose issues have closed taken out, and nothing else changed.
export function cleared(text, closed) {
  const out = new Set(linesOf(text).filter(l => l.issues.every(closed)).map(l => l.at));
  return String(text).split("\n").filter((_, at) => !out.has(at)).join("\n");
}

// Which numbers name an open issue or pull request, read from GitHub's list of the open ones (a page at a time,
// through `gh`): a number => whether it has closed, every number not open counted closed, so that a line naming one
// that does not exist goes, never stays. Each row is checked against its form; a page that is not a list, or a row
// that is no open item with a whole number, throws, as does gh failing: the reading never guesses.
export function statesOf(repo, gh = route => {
  const r = spawnSync("gh", ["api", route], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`gh could not read ${route.split("?")[0]}: ${String(r.stderr ?? r.error).trim().slice(0, 200)}`);
  return r.stdout;
}) {
  const open = new Set();
  for (let page = 1; ; page++) {
    let rows;
    try { rows = JSON.parse(gh(`repos/${repo}/issues?state=open&per_page=100&page=${page}`)); } catch (e) { throw new Error(e instanceof SyntaxError ? "GitHub's list of open issues is no JSON" : e.message); }
    if (!Array.isArray(rows)) throw new Error("GitHub's list of open issues is no list");
    for (const row of rows) {
      if (row === null || typeof row !== "object" || !Number.isSafeInteger(row.number) || row.number < 1 || row.state !== "open") throw new Error("GitHub's list of open issues holds a row that is no open issue with its number");
      open.add(row.number);
    }
    if (rows.length < 100) break;
    if (page >= 100) throw new Error("GitHub's list of open issues runs past 100 pages");
  }
  return n => !open.has(n);
}

// The command, given its option and what it reads and writes: { status, out }, `out` what it prints. `at`: { file,
// read() the progress file's text or null, write(text), closed() a reader of whether a number has closed, which
// throws where GitHub cannot answer }.
export function command(flag, at) {
  const out = [], said = (status, ...lines) => ({ status, out: [...out, ...lines].join("\n") }), FILE = at.file ?? "QUEUE.md";
  if (flag !== undefined && !["--clear", "--check"].includes(flag)) return said(1, `FAIL: ${flag} is no option of this script. Mend: run node scripts/queue.mjs, with --clear or --check, or with nothing`);
  const text = at.read();
  if (typeof text === "string" && text.length > LARGEST) return said(1, `FAIL: ${FILE} is ${text.length} bytes, past the ${LARGEST} the reader takes. Mend: take out the lines of finished work and any notes, which belong in the pull requests' descriptions`);
  if (text === null) return said(1, `FAIL: ${FILE} is not here. Mend: run it from the repository's root, where the progress file its manifest names stands (in the core, QUEUE.md)`);
  let closed;
  try { closed = at.closed(); } catch (e) { return said(1, `FAIL: the issues the queue names could not be read: ${e.message}. Mend: run it again; where gh is not signed in, sign it in, or set GH_TOKEN`); }
  const { open, gone, next } = read(text, closed), named = gone.map(l => l.issues.map(n => `#${n}`).join(" and ")).join(", ");
  if (flag === "--clear") {
    at.write(cleared(text, closed));
    return said(0, gone.length ? `${FILE}: took out the lines of ${named}, closed` : `${FILE}: no line of a closed issue`);
  }
  if (flag === "--check") {
    if (gone.length) return said(1, `FAIL: ${FILE} holds the line of ${gone.length === 1 ? "an issue" : "issues"} closed: ${named}, and this pull request changes the queue. Mend: run node ${at.file ? "core/" : ""}scripts/queue.mjs --clear and commit ${FILE}`);
    return said(0, `ok   ${FILE} holds no line of a closed issue`);
  }
  out.push(...open.map(l => l.text));
  return said(0, `${open.length} open lines${gone.length ? `, ${gone.length} of closed issues skipped (${named}), which the next pull request that changes the queue takes out` : ""}`, next ? `next: ${next.issues.map(n => `#${n}`).join(" and ")}` : "next: none that a session takes waits on nothing open");
}

// The progress file where the command runs: a project's, as its manifest names it; the core's own where none stands.
export const fileAt = manifest => (manifest === null ? FILE : progressOf(manifest));

function main([flag]) {
  const manifest = fs.existsSync("core-manifest.md") ? fs.readFileSync("core-manifest.md", "utf8") : null, file = fileAt(manifest);
  const origin = spawnSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" }).stdout;
  const repo = /^[\w.-]+\/[\w.-]+$/u.test(process.env.GITHUB_REPOSITORY ?? "") ? process.env.GITHUB_REPOSITORY : repoOf(origin) ?? (manifest === null ? CORE : null);
  if (repo === null) { console.error("FAIL: which repository on GitHub this is cannot be told: its origin is no address on github.com. Mend: set GITHUB_REPOSITORY to its owner/name, and run it again"); return 1; }
  const { status, out } = command(flag, { file, read: () => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null), write: text => fs.writeFileSync(file, text), closed: () => statesOf(repo) });
  (status ? console.error : console.log)(out);
  return status;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
