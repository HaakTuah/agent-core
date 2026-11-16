// The caps on the core's rules (README.md, "Two layers"): what a role reads at its start stays under that role's cap, so
// a new rule there replaces text rather than adding to it (core archive 134 and 234; #304). A role's start is what the
// reading script gives for it (reading.mjs, beside this file): the floor's security.md, the role's own file under
// roles/ and the files that names, with every module a tool's session reads at its start (a builder's own part); a
// file read only when a task calls for it is held instead by the reviews' "content put where its readers must read
// past it" (roles/shared/review-guidelines.md; core archive 201). A cap keeps the rules lean and decides nothing else: no
// rule is moved, cut short or left out to fit, and a change that honest trimming gives no room for raises that role's
// cap in the same pull request, saying why, once a fresh session has read all the rules for room and found too little
// (AGENTS.md, "How changes are made here"; core archive 179 and 181). That session's answer stands in the pull
// request as a comment that opens "Leanness check:" (roles/shared/review-guidelines.md, "A mark on what every session
// reads"), and with --raise this script fails a pull request that raises a role's cap and has no such comment from the
// repository's owner, a member or a collaborator, by GitHub's own word for who wrote it, and one that raises it by more
// than one step. It holds that the comment is there, not what it says, when it was written or that a fresh session
// wrote it: whether the session found too little room stays with the reviews, as does any change to this check itself,
// which a pull request runs in its own version, and the first cap of a role that had none. Run from this repository's
// root by the size workflow (.github/workflows/size.yml); Node's own modules only.
//
//   node scripts/size.mjs                                  what each role reads at its start, against its cap, and
//                                                          the queue against its own mark
//   node scripts/size.mjs --raise <base> <comments>        a raise has its leanness check: <base>, this file as the
//                                                          pull request's base holds it; <comments>, the pull
//                                                          request's comments as GitHub's API gives them
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { sizeOf } from "./file-size.mjs";
import { library, reading } from "./reading.mjs";
import { started } from "./started.mjs";

// Each role's cap, a whole number of KB: one line a role, spelled exactly so. The builder's is the one cap of before,
// which held what every session read at its start, raised one step on 16 November 2026 for the builder's own file
// (#304), its leanness check having found 108 bytes of room for the 1,038 that file needed; the others were first set
// that day, each the whole KB next above its start.
export const CAPS = {
  builder: 28 * 1024,
  design: 29 * 1024,
  orchestrator: 42 * 1024,
  reviewer: 22 * 1024,
  "stand-in": 19 * 1024,
};
// The core's *progress file*, read at every session's start here, held to a mark of its own, below the general mark a
// project's size marks give each such file (roles/shared/inbox.md, "The progress file holds order only"; core archive 216):
// set at its first trim, as each project sets its own. A raise of it is read by the reviews, as any mark's is
// (roles/shared/review-guidelines.md, "A mark on what every session reads"); this script checks only that the queue is
// under it.
export const QUEUE = { file: "QUEUE.md", mark: 4 * 1024 };
const WRITERS = ["OWNER", "MEMBER", "COLLABORATOR"]; // GitHub's own word for who wrote a comment, not the comment's
const ANSWER = /^(?:\*\*)?Leanness check:/u;

// The files a role reads at its start, in the core at `dir`, by their paths there: what the reading script gives for
// the role, and each module a tool's session reads at its start. Null where the role has no file.
export function counted(role, dir = ".") {
  const lib = library(dir, ""), got = reading(lib, { role });
  if (got.error) return null;
  const parts = Object.entries(lib.modules).filter(([, w]) => w?.start && (w.tools.length || w.others.length)).map(([f]) => f);
  return [...new Set([...got.start, ...parts])];
}
// The roles the core has a file for, at `dir`.
export const rolesAt = (dir = ".") => Object.values(library(dir, "").roles).map(r => r.name);

// The caps a version of this file sets, in bytes, read from its text, { role: bytes }: the one block that sets CAPS,
// a line a role, each a whole number of KB, spelled exactly as above; or, of a version from before each role had its
// own, the one line that set CAP, read as the builder's (with `export` before it or, as it stood at first, without).
// Null where there is no one such block or line, or both: a caller that gets null fails, and never guesses.
const ONE = /^(?:export )?const CAP = ([1-9][0-9]{0,5}) \* 1024;\r?$/m;
export function capsOf(text) {
  if (typeof text !== "string") return null;
  const blocks = [...text.matchAll(/^export const CAPS = \{\r?\n((?:  (?:[a-z][a-z0-9-]*|"[a-z][a-z0-9-]*"): [1-9][0-9]{0,5} \* 1024,\r?\n)+)\};\r?$/gm)];
  const one = [...text.matchAll(/^(?:export )?const CAP = ([1-9][0-9]{0,5}) \* 1024;\r?$/gm)];
  if (blocks.length + one.length !== 1) return null;
  if (one.length) return { builder: Number(one[0][1]) * 1024 };
  const caps = {};
  for (const m of blocks[0][1].matchAll(/^  "?([a-z][a-z0-9-]*)"?: ([1-9][0-9]{0,5}) \* 1024,\r?$/gm)) {
    if (m[1] in caps) return null;
    caps[m[1]] = Number(m[2]) * 1024;
  }
  return caps;
}

// Whether the comments of a pull request, as GitHub's API gives them (a list, or a list of pages), hold a leanness
// check's answer: a comment that opens with it, written by the owner, a member or a collaborator.
export function answered(comments) {
  return (Array.isArray(comments) ? comments.flat() : []).some(c => c !== null && typeof c === "object"
    && WRITERS.includes(c.author_association) && typeof c.body === "string" && ANSWER.test(c.body));
}

// What is wrong with a pull request's raise of a cap, as one line; null where nothing is: no cap is raised, or one is
// raised one step and the raise has its answer. `base` and `head` are this file's text at the pull request's base and
// as it would merge, and `running` the caps the head's script really holds the rules to: where the block read from its
// text says another (a look-alike block in a comment, the real one spelled otherwise), the text is not trusted and the
// check fails. A role the base gives no cap is at its first cap: no raise against the one cap of before, which counted
// no role but the builder; against a base with a cap a role, no raise up to the smallest cap that base holds, and above
// it a raise that needs its answer, so that a role's file given another name takes no room its old name had not.
export function raised(base, head, comments, running = capsOf(head)) {
  const from = capsOf(base), to = capsOf(head);
  const same = (a, b) => a !== null && b !== null && JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
  if (!same(to, running)) return "scripts/size.mjs: its block that sets CAPS is not the one block the check reads, or does not set the caps the script runs with. Mend: write it as export const CAPS = {, then a line a role as   <role>: <KB> * 1024, and }; with nothing else that sets CAPS or CAP";
  if (from === null) return "the base's scripts/size.mjs has no block that sets CAPS, nor the one line that set CAP, as the check reads them, so whether this pull request raises a cap cannot be told. Mend: bring the branch up to date with main, whose scripts/size.mjs sets them so, and run the check again";
  for (const [role, cap] of Object.entries(to)) {
    const was = from[role], least = Math.min(...Object.values(from));
    if (was === undefined) {
      if (ONE.test(base) || cap <= least || answered(comments)) continue;
      return `scripts/size.mjs: the role ${role}, new here, takes a first cap of ${cap} bytes, above the smallest the base holds (${least}), and the pull request has no comment that opens "Leanness check:". Mend: have a fresh session read what the role reads at its start for room, post its answer in a comment that opens "Leanness check:", and run this check again; or set its cap at ${least / 1024} * 1024 or under`;
    }
    if (cap <= was) continue;
    if (cap - was !== 1024) return `scripts/size.mjs: the cap of the role ${role} rises from ${was} to ${cap} bytes, more than one step. Mend: set it to ${was / 1024 + 1} * 1024, one step of a whole KB, or leave it and say the rules in fewer words`;
    if (!answered(comments)) return `scripts/size.mjs: the cap of the role ${role} rises from ${was} to ${cap} bytes, and the pull request has no comment that opens "Leanness check:". Mend: have a fresh session read all the rules for room, post its answer in a comment that opens "Leanness check:", and run this check again; or leave the cap and say the rules in fewer words`;
  }
  return null;
}

function raise(baseFile, commentsFile) {
  let base = null, comments = null;
  try { base = fs.readFileSync(baseFile, "utf8"); comments = JSON.parse(fs.readFileSync(commentsFile, "utf8")); } catch { /* (said below) */ }
  if (comments === null) { console.error("FAIL: the base's size.mjs or the pull request's comments could not be read. Mend: name both, readable: node scripts/size.mjs --raise <base> <comments, as JSON>"); return 1; }
  const wrong = raised(base, fs.readFileSync(fileURLToPath(import.meta.url), "utf8"), comments, CAPS);
  if (wrong) { console.error(`FAIL: ${wrong}`); return 1; }
  const from = capsOf(base), up = Object.keys(CAPS).filter(r => from[r] !== undefined && from[r] < CAPS[r]);
  console.log(up.length ? `ok   the cap of ${up.join(", ")} rises one step, and the pull request holds a leanness check's answer` : "ok   no role's cap is raised");
  return 0;
}
// What is wrong with one role's start against its cap, as the failure with its mend; null where nothing, its count printed.
function over(role, roles) {
  const files = roles.includes(role) ? counted(role) : null, cap = CAPS[role];
  if (files === null) return `scripts/size.mjs gives the role ${role} a cap, and roles/ holds no file for it. Mend: take its line out of CAPS, or put its file back`;
  if (cap === undefined) return `the role ${role} has no cap. Mend: give it a line in CAPS of scripts/size.mjs, the whole KB next above what it reads at its start, and say so in the pull request`;
  const missing = files.filter(f => !fs.existsSync(f));
  if (missing.length) return `what the role ${role} reads at its start cannot be counted: ${missing.join(", ")}. Mend: put back the file moved or taken out, or name it as it now stands in roles/${role}.md`;
  const total = files.reduce((sum, f) => sum + sizeOf(f), 0);
  console.log(`what the role ${role} reads at its start (${files.join(", ")}): ${total} bytes of ${cap}`);
  return total <= cap ? null : `what the role ${role} reads at its start is ${total - cap} bytes over its cap. Mend: say the rules this\n`
    + "pull request changes in fewer words and trim what is said twice; raise the role's cap by one KB only once a fresh session\n"
    + "has read all the rules for room and found too little, its answer posted in a comment that opens \"Leanness check:\".";
}

function main([flag, baseFile, commentsFile]) {
  if (flag === "--raise") return raise(baseFile, commentsFile);
  const roles = rolesAt();
  if (!roles.length || !fs.existsSync(QUEUE.file)) { console.error(`FAIL: what each role reads at its start cannot be counted: ${roles.length ? QUEUE.file : "roles/"} is not here. Mend: run it from the core's root, where roles/ and ${QUEUE.file} stand, or put back what was moved or taken out`); return 1; }
  const wrong = [...new Set([...roles, ...Object.keys(CAPS)])].map(role => over(role, roles)).filter(Boolean);
  const queue = sizeOf(QUEUE.file);
  console.log(`the queue (${QUEUE.file}): ${queue} bytes of its mark, ${QUEUE.mark}`);
  if (queue > QUEUE.mark) wrong.push(`${QUEUE.file} is ${queue - QUEUE.mark} bytes past its mark. Mend: take out each finished line, and any\n`
    + "note, which belongs in the description of its line's pull request: the file holds what is next and nothing done.");
  for (const w of wrong) console.error(`FAIL: ${w}`);
  return wrong.length ? 1 : 0;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
