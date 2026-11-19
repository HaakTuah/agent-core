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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { progressOf } from "./done-when.mjs";
import { leadsOut, inProject } from "./guards.mjs";
import { repoOf } from "./inbox.mjs";
import { started } from "./started.mjs";

export const FILE = "QUEUE.md";
export const LARGEST = 1 << 20; // (bytes: a progress file past it is refused, never read; SECURITY.md, rule 5)
const ROW = /^\|([^|]*)\|/u, ITEM = /^\s*[-*]\s+(?:\[[ xX]\]\s+)?#(\d{1,9})\b/u;
// The numbers a text names, a range "#a to #b" (at most a hundred wide) named whole.
const numbers = text => [...String(text).matchAll(/(?<![\w/-])#(\d{1,9})\b(?:\s+to\s+#(\d{1,9})\b)?/gu)].flatMap(m => {
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

// What the command reads, or why it cannot: { text, closed } or { fail }, the failure with its mend.
function readIn(flag, at, FILE) {
  if (flag !== undefined && !["--clear", "--check"].includes(flag)) return { fail: `FAIL: ${flag} is no option of this script. Mend: run node scripts/queue.mjs, with --clear or --check, or with nothing` };
  const text = at.read();
  if (text === null) return { fail: `FAIL: ${FILE} is not here. Mend: run it from the repository's root, where the progress file its manifest names stands (in the core, QUEUE.md)` };
  if (Buffer.byteLength(text) > LARGEST) return { fail: `FAIL: ${FILE} is ${Buffer.byteLength(text)} bytes, past the ${LARGEST} the reader takes. Mend: take out the lines of finished work and any notes, which belong in the pull requests' descriptions` };
  let closed;
  try { closed = at.closed(); } catch (e) { return { fail: `FAIL: the issues the queue names could not be read: ${e.message}. Mend: run it again; where gh is not signed in, sign it in, or set GH_TOKEN` }; }
  const all = read(text, closed);
  if (all.gone.length && !all.open.length) return { fail: `FAIL: GitHub's list of open issues names none of the ${all.gone.length} lines of ${FILE}, which may be the list of another repository. Mend: run it again from the repository's root, GITHUB_REPOSITORY set to its owner/name; where every line's issue has truly closed, take them out by hand` };
  return { text, closed, all };
}

// The command, given its option and what it reads and writes: { status, out }, `out` what it prints. `at`: { file,
// project (whether it runs in a project, from its copy of the core), read() the progress file's text or null,
// write(text), closed() a reader of whether a number has closed, which throws where GitHub cannot answer }.
export function command(flag, at) {
  const FILE = at.file ?? "QUEUE.md", got = readIn(flag, at, FILE);
  if (got.fail) return { status: 1, out: got.fail };
  const { open, gone, next } = got.all, named = gone.map(l => l.issues.map(n => `#${n}`).join(" and ")).join(", ");
  if (flag === "--clear") {
    at.write(cleared(got.text, got.closed));
    return { status: 0, out: gone.length ? `${FILE}: took out the lines of ${named}, closed` : `${FILE}: no line of a closed issue` };
  }
  if (flag === "--check") {
    if (gone.length) return { status: 1, out: `FAIL: ${FILE} holds the line of ${gone.length === 1 ? "an issue" : "issues"} closed: ${named}, and this pull request changes the queue. Mend: run node ${at.project ? "core/" : ""}scripts/queue.mjs --clear and commit ${FILE}` };
    return { status: 0, out: `ok   ${FILE} holds no line of a closed issue` };
  }
  const last = [`${open.length} open lines${gone.length ? `, ${gone.length} of closed issues skipped (${named}), which the next pull request that changes the queue takes out` : ""}`, next ? `next: ${next.issues.map(n => `#${n}`).join(" and ")}` : "next: none that a session takes waits on nothing open"];
  return { status: 0, out: [...open.map(l => l.text), ...last].join("\n") };
}

// The progress file where the command runs: a project's, as its manifest names it; the core's own where none stands.
// A project's slot is input (SECURITY.md, rule 5): a path taken only where it is a plain Markdown file inside the
// project, out of .git and core/, and that leads nowhere outside it through a link; else null, which fails.
export const fileAt = manifest => {
  if (manifest === null) return FILE;
  const at = progressOf(manifest), plain = path.posix.normalize(String(at).replace(/\\/gu, "/"));
  return inProject(at) && /\.md$/iu.test(plain) && !/^(?:\.git|core)(?:\/|$)/iu.test(plain) ? plain : null;
};
// Whether this runs from a project's copy of the core (core/scripts/queue.mjs), not from the core itself, read from
// where this file lies, never from a file a pull request could add.
const inCopy = () => path.relative(process.cwd(), fileURLToPath(import.meta.url)).replace(/\\/gu, "/") === "core/scripts/queue.mjs";

// Where the command runs: { copy, file, repo } or { fail }, the failure with its mend.
function placed() {
  const copy = inCopy(), manifest = copy && fs.existsSync("core-manifest.md") ? fs.readFileSync("core-manifest.md", "utf8") : null;
  const file = copy ? fileAt(manifest ?? "") : FILE;
  if (file === null || (fs.existsSync(file) && leadsOut(process.cwd(), file))) return { fail: "FAIL: the progress file core-manifest.md names is no plain Markdown file inside the project (outside .git and core/, reached through no link). Mend: name the progress file in the manifest's row *progress file* as a path such as docs/PROGRESS.md" };
  if (fs.existsSync(file) && fs.statSync(file).size > LARGEST) return { fail: `FAIL: ${file} is ${fs.statSync(file).size} bytes, past the ${LARGEST} the reader takes. Mend: take out the lines of finished work and any notes, which belong in the pull requests' descriptions` };
  const origin = spawnSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" }).stdout;
  const repo = /^[\w.-]+\/[\w.-]+$/u.test(process.env.GITHUB_REPOSITORY ?? "") ? process.env.GITHUB_REPOSITORY : repoOf(origin) ?? (copy ? null : CORE);
  if (repo === null) return { fail: "FAIL: which repository on GitHub this is cannot be told: its origin is no address on github.com. Mend: set GITHUB_REPOSITORY to its owner/name, and run it again" };
  return { copy, file, repo };
}

function main([flag]) {
  const at = placed();
  if (at.fail) { console.error(at.fail); return 1; }
  const { status, out } = command(flag, { file: at.file, project: at.copy, read: () => (fs.existsSync(at.file) ? fs.readFileSync(at.file, "utf8") : null), write: text => fs.writeFileSync(at.file, text), closed: () => statesOf(at.repo) });
  (status ? console.error : console.log)(out);
  return status;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
