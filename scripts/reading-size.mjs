// The reading-size check ("Read little" and "Split by meaning" in roles/shared/how-to-work.md), for every project that takes
// the core, measured on every PR. Its marks are the project's *size marks*, a JSON file (its SECURITY.md names it under
// rule 3, among the checks on the work), and it fails:
//   - when a file every session reads ("read") is past its mark (about 20 KB, "each"; one past that has a mark of its
//     own, its size: when the file shrinks, the mark comes down with it), or the project's own among them total past
//     "total" (the core's copy under core/, which the core's check holds to the core's tree, is left out: the core's
//     own cap, scripts/size.mjs there, holds what of it every session reads, so that no sync fails a project over what
//     the core grew, the core's AGENTS.md, "Nothing locks a project"; where "total" leaves room above the
//     project's own files for more than half that copy, a note gives the mark to set);
//   - when the PR changes a file past "split" (about 50 KB: Step 0, split it by meaning first), unless "past" lists it
//     with a mark at least its size. The copy of the core (core/, changed only by a sync PR), the paths under "skip"
//     (such as the archive: dated records, added to by every merge) and binary files are not counted.
// A PR that crosses a mark moves the mark in the config only as roles/shared/review-guidelines.md says ("A mark on what
// every session reads", and "What blocks"). The PR's changes are those against SIZES_BASE (set by the copies workflow,
// .github/workflows/copies.yml, which runs this), else where HEAD left origin/main; in CI that is the base's tip
// against the PR's merge commit, so a run after the base moves on counts its new changes too. Node's own modules only.
// A file's size is its bytes without each carriage return before a line feed (file-size.mjs, beside this file), so it
// is the same on a machine where git converts line endings on checkout as on GitHub.
// It checks the project it lies in (core/scripts/ there), whatever the directory it is started from; the config's own
// path is read from that directory.
//
//   node core/scripts/reading-size.mjs <config>
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { corePath, floorCopy, projectAt } from "./core-path.mjs";
import { sizeOf as size } from "./file-size.mjs";

const git = args => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const MARKS = process.argv[2];
if (!MARKS) { console.error("FAIL: no config was named. Mend: name it: node <the core's path, core/ as a rule>scripts/reading-size.mjs <config>"); process.exit(1); }
let marks;
try { marks = JSON.parse(fs.readFileSync(MARKS, "utf8")); } catch (e) { console.error(`FAIL: ${MARKS} could not be read as JSON (${String(e.message).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/gu, "?")}). Mend: name the config the copies workflow is given, and write it as JSON`); process.exit(1); }
if (!marks || typeof marks !== "object" || Array.isArray(marks)) marks = {}; // (JSON's null, a list or a value alone: the form below refuses it)
const num = v => Number.isInteger(v) && v > 0, nums = o => o && typeof o === "object" && !Array.isArray(o) && Object.values(o).every(num);
const shape = [num(marks.each), nums(marks.read), num(marks.total), num(marks.split), marks.past === undefined || nums(marks.past),
  marks.skip === undefined || Array.isArray(marks.skip) && marks.skip.every(s => typeof s === "string" && s.length)];
if (shape.includes(false)) {
  console.error(`FAIL: ${MARKS} is not in the form the check reads. Mend: write it to hold "each", "total" and "split" (byte counts), "read" (each file to its mark), and, if it needs them, "past" (each file to its mark) and "skip" (paths)`);
  process.exit(1);
}
marks.past ??= {};
process.chdir(fileURLToPath(new URL(".", import.meta.url)));
process.chdir(projectAt(process.cwd()).root || git(["rev-parse", "--show-toplevel"]).trim()); // (a carried core's project too: core-path.mjs)
// (a submodule's files too, at their paths from here: a library that carries the core brings its copy so; core-path.mjs)
const tracked = new Set(git(["ls-files", "-z", "--recurse-submodules"]).split("\0").filter(Boolean));
const kb = n => (n / 1024).toFixed(1);
// (the core's copy at the manifest's path, and the floor's own copy a repository whose core a library carries keeps:
// tasks/repositories.md; core-path.mjs)
const at = corePath(".") || "core/", ofCore = [at, ...[floorCopy(".")].filter(Boolean)];
const skip = [...ofCore, ...(marks.skip ?? [])];
const fail = [], notes = [];

// the files every session reads; their total, the project's own alone (the core's copy left out)
let total = 0, core = 0;
for (const [f, mark] of Object.entries(marks.read)) {
  if (!tracked.has(f)) { fail.push(`${f} is listed under "read" in ${MARKS} but is no tracked file. Mend: in ${MARKS}, name it as it now stands, or take it out where no session reads it`); continue; }
  const n = size(f);
  if (ofCore.some(p => f.startsWith(p))) core += n; else total += n;
  if (n > mark) fail.push(`${f} is ${n} bytes, past its mark of ${mark}. Mend: make it smaller, moving what no session needs at every start to a file read when needed; or, once a fresh session that wrote none of it has read the project's own such files whole for more to trim and found too little, raise its mark in ${MARKS}`);
  else if (mark > marks.each && n < mark) fail.push(`${f} has shrunk to ${n} bytes. Mend: lower its mark in ${MARKS} from ${mark} to ${Math.max(n, marks.each)}`);
}
// (a total that leaves room above the project's own files for more than half of what the core's copy every session
// reads comes to, as one set when it counted that copy does however the core grew since: said, with the mark to set
// in one step, never failed. The mark takes that copy off as often as the room holds it, keeping what room is left,
// and is never below a KB above the project's own files, as the starter kit writes one)
const least = (Math.ceil(total / 1024) + 1) * 1024;
const over = marks.total - total - core / 2;
const to = core && over > 0 ? Math.max(marks.total - Math.ceil(over / core) * core, least) : marks.total;
if (to < marks.total) notes.push(`the total in ${MARKS}, ${marks.total}, leaves ${marks.total - total} bytes of room above the project's own files, more than half what the core's copy every session reads comes to (${core}), which the core's own cap holds: set it to ${to} (core/setup/sync-notes.md, 14 November 2026)`);
if (total > marks.total) fail.push(`the project's own files every session reads total ${total} bytes, past their mark of ${marks.total}. Mend: make them smaller, moving what no session needs at every start to a file read when needed; or, once a fresh session that wrote none of it has read the project's own such files whole for more to trim and found too little, raise the total in ${MARKS}`);

// Step 0: files past the split mark that the PR changes
// (a file is read to be counted only where its bytes on disk are past the mark: counted, it is never larger)
const big = [...tracked].filter(f => !skip.some(s => f.startsWith(s)) && fs.existsSync(f) && fs.statSync(f).size > marks.split
  && !fs.readFileSync(f).subarray(0, 8000).includes(0) && size(f) > marks.split);
let base = process.env.SIZES_BASE;
if (!base) try { base = git(["merge-base", "origin/main", "HEAD"]).trim(); } catch { base = ""; }
if (base) {
  // (a submodule's files show here only as its path: a file of a library that carries the core, changed when the pull
  // request moves the library, is not seen as changed, which leaves its split mark unheld, as before such files were read)
  let changed;
  try { changed = new Set(git(["diff", "--name-only", base]).split("\n")); } catch { console.error(`FAIL: ${base} is not a commit here. Mend: fetch it (git fetch origin ${base}), or set SIZES_BASE to the pull request's base`); process.exit(1); }
  for (const f of big.filter(f => changed.has(f))) {
    if (!(marks.past[f] >= size(f))) fail.push(`${f} is ${size(f)} bytes, past the ${marks.split}-byte mark, and this PR changes it. Mend: split it by meaning first, in a pull request of its own that proves its behaviour unchanged, and change it after; or list it under "past" in ${MARKS} and say why in this pull request`);
  }
} else notes.push("no base to compare with (set SIZES_BASE), so the files past the split mark were not checked for changes");
for (const f of Object.keys(marks.past)) if (!big.includes(f)) fail.push(`${MARKS} lists ${f} under "past", but it is not past ${marks.split} bytes now. Mend: take it out of "past"`);

for (const n of notes) console.log(`note ${n}`);
for (const x of fail) console.error(`FAIL: ${x}`);
if (fail.length) process.exit(1);
console.log(`ok   read by every session: ${Object.keys(marks.read).map(f => `${f} ${kb(size(f))} KB`).join(", ")}; the project's own ${kb(total)} of ${kb(marks.total)} KB. `
  + `Past ${kb(marks.split)} KB: ${big.join(", ") || "none"}${base ? ", none changed here" : ""}`);
