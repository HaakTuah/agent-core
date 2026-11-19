// The core's queue (QUEUE.md; AGENTS.md, "The queue"), read as its readers read it: its lines in order, a line whose
// issue has closed skipped, since a line no longer leaves in the pull request that closes its issue, where pull
// requests merging side by side collided on the one file, and the next pull request that changes the queue clears
// such lines together (#750, point 1). A line is a row of the table whose first cell names its issue first ("#n");
// what it waits on is its last cell, and an issue or pull request named there that has closed is waited on no more.
// This repository only; no project calls it. Reads the issues through gh (GITHUB_REPOSITORY and GH_TOKEN where GitHub's
// job sets them; else the core's own address and gh's sign-in); writes QUEUE.md with --clear alone.
//
//   node scripts/queue.mjs           the open lines in order, and the next: the first that waits on nothing open
//   node scripts/queue.mjs --clear   takes out the line of each closed issue, in the pull request that changes the queue
//   node scripts/queue.mjs --check   on a pull request that changes the queue: fails where a line of a closed issue
//                                    stands, saying the mend (own-description.yml runs it)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { CORE } from "./core-address.mjs";
import { started } from "./started.mjs";

export const FILE = "QUEUE.md";
const ROW = /^\|\s*#(\d+)\b[^|]*\|/u;

// The lines of a queue's text, in order: { at, text, issue, waits }, `at` its index among the text's lines, `waits`
// the numbers its last cell names.
export function linesOf(text) {
  return String(text ?? "").split("\n").map((line, at) => {
    const m = ROW.exec(line);
    if (!m) return null;
    const cells = line.replace(/\r$/u, "").split("|").slice(1, -1);
    const waits = [...String(cells.at(-1) ?? "").matchAll(/#(\d+)\b/gu)].map(w => Number(w[1]));
    return { at, text: line, issue: Number(m[1]), waits, words: String(cells.at(-1) ?? "").trim() };
  }).filter(Boolean);
}

// The queue as its readers take it, given `closed` (a number => whether that issue or pull request has closed):
// { open, gone, next }, `gone` the lines of closed issues, `next` the first open line that waits on nothing open (a
// last cell empty, or naming only what has closed), or null.
export function read(text, closed) {
  const lines = linesOf(text), gone = lines.filter(l => closed(l.issue)), open = lines.filter(l => !closed(l.issue));
  const free = l => (l.waits.length ? l.waits.every(closed) : l.words === "");
  return { open, gone, next: open.find(free) ?? null };
}

// The text with the line of each closed issue taken out, and nothing else changed.
export function cleared(text, closed) {
  const out = new Set(linesOf(text).filter(l => closed(l.issue)).map(l => l.at));
  return String(text).split("\n").filter((_, at) => !out.has(at)).join("\n");
}

// Whether each number names a closed issue or pull request, asked of GitHub once each; throws where gh cannot answer.
export function statesOf(numbers, repo, gh = route => {
  const r = spawnSync("gh", ["api", route, "--jq", ".state"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`gh could not read ${route}: ${String(r.stderr ?? r.error).trim()}`);
  return r.stdout.trim();
}) {
  const closed = new Map();
  for (const n of new Set(numbers)) closed.set(n, gh(`repos/${repo}/issues/${n}`) === "closed");
  return n => closed.get(n) === true;
}

// The command, given its option and what it reads and writes: { status, out }, `out` what it prints. `at`: { read()
// the queue's text or null, write(text), closed(numbers) a reader of each one's state, which throws where GitHub
// cannot answer }.
export function command(flag, at) {
  const out = [], said = (status, ...lines) => ({ status, out: [...out, ...lines].join("\n") });
  if (flag !== undefined && !["--clear", "--check"].includes(flag)) return said(1, `FAIL: ${flag} is no option of this script. Mend: run node scripts/queue.mjs, with --clear or --check, or with nothing`);
  const text = at.read();
  if (text === null) return said(1, `FAIL: ${FILE} is not here. Mend: run it from the core's root`);
  const lines = linesOf(text);
  let closed;
  try { closed = at.closed(lines.flatMap(l => [l.issue, ...l.waits])); } catch (e) { return said(1, `FAIL: the issues the queue names could not be read: ${e.message}. Mend: run it again; where gh is not signed in, sign it in, or set GH_TOKEN`); }
  const { open, gone, next } = read(text, closed), named = gone.map(l => `#${l.issue}`).join(", ");
  if (flag === "--clear") {
    at.write(cleared(text, closed));
    return said(0, gone.length ? `${FILE}: took out the lines of ${named}, closed` : `${FILE}: no line of a closed issue`);
  }
  if (flag === "--check") {
    if (gone.length) return said(1, `FAIL: ${FILE} holds the line of ${gone.length === 1 ? "an issue" : "issues"} closed: ${named}, and this pull request changes the queue. Mend: run node scripts/queue.mjs --clear and commit ${FILE}`);
    return said(0, `ok   ${FILE} holds no line of a closed issue`);
  }
  out.push(...open.map(l => l.text));
  return said(0, `${open.length} open lines${gone.length ? `, ${gone.length} of closed issues skipped (${named}), which the next pull request that changes the queue takes out` : ""}`, next ? `next: #${next.issue}` : "next: none waits on nothing open");
}

function main([flag]) {
  const repo = /^[\w.-]+\/[\w.-]+$/u.test(process.env.GITHUB_REPOSITORY ?? "") ? process.env.GITHUB_REPOSITORY : CORE;
  const { status, out } = command(flag, { read: () => (fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : null), write: text => fs.writeFileSync(FILE, text), closed: numbers => statesOf(numbers, repo) });
  (status ? console.error : console.log)(out);
  return status;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
