// Is this pull request's change to the floor or the review guidelines only paths that follow files it moves (floor rule
// 3, "The owner's yes in the PR"; #886, point 1)? Such a change asks no yes of the owner: a pointer that only follows a
// moved file cannot widen a session's mandate. The description check (pr-description.mjs, beside this file) runs it on
// the merge commit against its base, and asks the yes only of the files it does not prove; a builder may run it, from
// a checkout of the core's `main`, in the pull request's clone with the head checked out:
//
//   node <the core's main>/scripts/path-only.mjs [<the base, by default the merge base with origin/main>]
//
// A file the PR moves is one git finds renamed with its content whole (`-M100%`), and a folder it moves one whose
// files all moved so: the old path stands no more at the head, the new one stood nowhere at the base, and the new one
// holds what the old held. A file that asks the yes (owner-yes.mjs's asks) is proven where it is changed in place, a
// regular file on both sides, and its two versions are the same text but where a path of such a move stands in the old
// and that move's new path in the same place in the new; a path stands where no letter, digit, "_", ".", "/" or "-"
// comes before it and no letter, digit, "_" or "-", nor "." or "/" before one, comes after. It refuses, never guessing,
// a file that asks the yes and is added, deleted or moved itself, a move into or out of such a path, every other change
// of a word, and every file where the pull request changes this script or owner-yes.mjs, so that the code that
// proves is always `main`'s, as floor rule 3 asks, though the description check runs the pull request's copy. Git and Node's
// own modules; it changes nothing.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { asks } from "./owner-yes.mjs";

export const SELF = "scripts/path-only.mjs";
// the files whose code the proof runs: where the pull request changes one, the copy that runs is not `main`'s
export const OWN = [SELF, "scripts/owner-yes.mjs"];
const REGULAR = "100644";

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

// The spellings of each move, old to new: a file's path; a folder's, with its slash and without. Moves into or out of
// a path that asks the yes are left out: they are refused, and justify no pointer.
export function spellings(moves) {
  const pairs = new Map();
  for (const { from, to, folder } of moves) {
    if (asks(from) || asks(to) || from === to) continue;
    pairs.set(from, to);
    if (folder) pairs.set(`${from}/`, `${to}/`);
  }
  return pairs;
}

// `text` cut at each path of `names` (old or new, the longest first): literal text and paths, in turn, from a literal.
export function tokens(text, names) {
  if (!names.length) return [text];
  const alt = [...names].sort((a, b) => b.length - a.length).map(escape).join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}_./-])(?:${alt})(?![\\p{L}\\p{N}_-]|[./][\\p{L}\\p{N}_])`, "gu");
  const out = [];
  let at = 0;
  for (const m of text.matchAll(re)) { out.push(text.slice(at, m.index), m[0]); at = m.index + m[0].length; }
  out.push(text.slice(at));
  return out;
}

// Where `one` first differs from `other`, some forty characters of it, on one line.
const near = (one, other) => { let i = 0; while (i < one.length && one[i] === other[i]) i++; return one.slice(Math.max(0, i - 20), i + 20).replace(/\s+/gu, " "); };

// Why `after` is not `before` with paths of `pairs` (spellings) followed, or null where it is.
export function follows(before, after, pairs) {
  const names = [...new Set([...pairs.keys(), ...pairs.values()])];
  const a = tokens(before, names), b = tokens(after, names);
  if (a.length !== b.length) return "it changes more than paths: a path stands where the other side has none";
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (i % 2 === 0) return `it changes words that are no path of a move: "${near(a[i], b[i])}" becomes "${near(b[i], a[i])}"`;
    if (pairs.get(a[i]) !== b[i]) return `the path ${a[i]} becomes ${b[i]}, which is not where the pull request moves it`;
  }
  return null;
}

// The verdict on each changed file that asks the yes. `changed`: [{ path, status ("M", "A", "D"...), before, after,
// modes: [base's, head's] }]; `moves`: [{ from, to, folder }]; `self`: whether the pull request changes SELF.
// Returns { proven: [path], refused: [{ path, why }] }.
export function verdicts({ changed, moves, self = false }) {
  const pairs = spellings(moves), proven = [], refused = [];
  for (const f of changed) {
    if (!asks(f.path)) continue;
    const why = self ? `the pull request changes ${OWN.join(" or ")}, so the proof that would run is not main's`
      : f.status !== "M" ? "it is added, deleted or moved, not changed in place"
      : f.modes?.[0] !== REGULAR || f.modes?.[1] !== REGULAR ? "it is not a regular file on both sides, its mode kept"
      : follows(f.before, f.after, pairs);
    if (why) refused.push({ path: f.path, why }); else proven.push(f.path);
  }
  return { proven, refused };
}

// The folders a file's move moves with it: the old and new paths cut at each common trailing part.
export function foldersOf(from, to) {
  const a = from.split("/"), b = to.split("/"), out = [];
  while (a.length > 1 && b.length > 1 && a.at(-1) === b.at(-1)) { a.pop(); b.pop(); out.push({ from: a.join("/"), to: b.join("/") }); }
  return out;
}

const run = (cwd, args) => { const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 26 }); return r.status === 0 ? r.stdout : null; };
const fields = out => (out === "" ? [] : out.replace(/\0$/u, "").split("\0"));

// The moves from `base` to `head` in `cwd`: each file git finds renamed whole, and each folder (foldersOf) that stands
// no more, whose new path stood nowhere and each of whose files moved whole beneath it; null where git cannot say.
function movesOf(cwd, base, head) {
  const renamed = run(cwd, ["diff", "--name-status", "-M100%", "--diff-filter=R", "-z", base, head]);
  if (renamed === null) return null;
  const moves = [], r = fields(renamed);
  for (let i = 0; i + 2 < r.length; i += 3) if (r[i] === "R100") moves.push({ from: r[i + 1], to: r[i + 2] });
  const files = new Set(moves.map(m => `${m.from}\0${m.to}`)), seen = new Set();
  const stands = (at, p) => run(cwd, ["cat-file", "-e", `${at}:${p}`]) !== null;
  const whole = d => { const listed = run(cwd, ["ls-tree", "-r", "--name-only", "-z", base, "--", `${d.from}/`]); return listed !== null && fields(listed).every(f => files.has(`${f}\0${d.to}${f.slice(d.from.length)}`)); };
  for (const d of moves.flatMap(m => foldersOf(m.from, m.to))) {
    if (seen.has(`${d.from}\0${d.to}`)) continue;
    seen.add(`${d.from}\0${d.to}`);
    if (!stands(head, d.from) && !stands(base, d.to) && whole(d)) moves.push({ ...d, folder: true });
  }
  return moves;
}

// One changed file as verdicts takes it: of one that asks the yes, its modes and, changed in place, its two texts.
function fileOf(cwd, base, head, status, path) {
  if (!asks(path)) return { path, status };
  const mode = at => (run(cwd, ["ls-tree", at, "--", path]) ?? "").split(" ")[0];
  const text = at => (status === "M" ? run(cwd, ["show", `${at}:${path}`]) : null);
  return { path, status, modes: [mode(base), mode(head)], before: text(base), after: text(head) };
}

// What git says of the change from `base` to `head` in `cwd`, as verdicts takes it, or null where git cannot say.
export function read(cwd, base, head) {
  const all = run(cwd, ["diff", "--name-status", "--no-renames", "-z", base, head]), moves = movesOf(cwd, base, head);
  if (all === null || moves === null) return null;
  const names = fields(all), changed = [];
  for (let i = 0; i + 1 < names.length; i += 2) changed.push(fileOf(cwd, base, head, names[i], names[i + 1]));
  if (changed.some(f => f.status === "M" && asks(f.path) && (f.before === null || f.after === null))) return null;
  return { changed, moves, self: changed.some(f => OWN.includes(f.path)) };
}

// The paths of `asked` (the files that ask the yes) that the change from base to head proves only follow moves: [] where
// git cannot say.
export function proven(cwd, base, head, asked) {
  const got = read(cwd, base, head);
  return got === null ? [] : verdicts(got).proven.filter(p => asked.includes(p));
}

// The line a refused file fails with, its mend.
export const failure = ({ path, why }) => `FAIL: ${path} asks the owner's yes: ${why}. Mend: quote the owner's yes for it under "The owner's word" (floor rule 3), or take out of this pull request every change to it but paths that follow a file the pull request moves`;

function main() {
  const cwd = process.cwd(), given = process.argv[2];
  const head = run(cwd, ["rev-parse", "HEAD"])?.trim();
  const base = given ?? run(cwd, ["merge-base", "HEAD", "origin/main"])?.trim();
  if (!head || !base) {
    console.log(`FAIL: git could not give the head or the base${given ? ` ${given}` : " (the merge base with origin/main)"}. Mend: run it in the pull request's clone with the head checked out, after git fetch origin main, or name the base`);
    process.exit(1);
  }
  const got = read(cwd, base, head);
  if (got === null) { console.log(`FAIL: git could not read the change from ${base} to ${head}. Mend: fetch both commits (git fetch origin main) and run it again`); process.exit(1); }
  const { proven: ok, refused } = verdicts(got);
  console.log(`checked head ${head} against ${base}`);
  for (const p of ok) console.log(`ok   ${p}: only paths that follow files the pull request moves`);
  for (const r of refused) console.log(failure(r));
  if (!ok.length && !refused.length) console.log("ok   nothing here asks the owner's yes: the change touches neither the floor nor the review guidelines");
  process.exit(refused.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
