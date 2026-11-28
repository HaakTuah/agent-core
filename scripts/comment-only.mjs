// Is this pull request's change to what runs by itself only comments and steps' names (floor rule 3)? Such a change
// passes one security review, floor rule 8's, instead of rule 3's two. Its builder runs it from a checkout of the
// core's `main`, never from the pull request's own copy, which the pull request could change, in the pull request's
// clone with the head that merges checked out, brought up to date with `main` for it:
//
//   node <the core's main>/scripts/comment-only.mjs [<a commit already reviewed>]
//
// It reads the head commit, not the working tree, against the merge base with the project's main (fetched), or against
// the commit given, one before the head that it grew from, for a later commit reviewed only for what it changes (floor
// rule 8); a head not up to date with main is refused, since it reads the change against main only where the head
// holds it. It reads every file the pull request
// changes under .github/ or .claude/ (the folders themselves too, any case, at any depth), and every action.yml, a
// project's own action (RUNS, in runs-by-itself.mjs beside this file): each must be a YAML file changed in place, its
// mode kept, no link or submodule there on either side, whose two versions differ only in YAML comments, blank lines
// between entries, and the `name` of a job's steps.
// A step's name is the first key of an item under `jobs.<job>.steps` that YAML reads as text: holding no `${{` and no
// backslash, which in quotes could spell one, so nothing is evaluated; quoted and not empty, or plain from a letter and
// none of the words YAML reads as null, true or false. A comment a tool may read as an instruction (an ignore, a
// disable, a skip, a linter's or scanner's name) must stand word for word beside the same line as before, and the note
// beside an action's version (`uses:`) must stand. Each version is read as comment-only-yaml.mjs, beside this file,
// reads YAML, which refuses, rather than guess, every line it cannot read for sure (#1341). Of the
// files outside what it reads, it refuses those that run by themselves or decide what does (RUNS_TOO, beside RUNS) and
// lists the rest: it exits 0 where there are none, 1 where it refuses, and 2 where others changed, which the session's
// "Security review:" comment says of, file by file, why each runs neither by itself nor with credentials
// (tasks/reviews.md, point 3). It prints the head it checked, for that comment and the merge. Git, Node's own modules
// and, through comment-only-yaml.mjs, the lexer of the YAML package the core installs from its lock file (packages.mjs;
// #654); it changes nothing.
import "./whole-output.mjs";
import { execFileSync } from "node:child_process";
import { readYaml } from "./comment-only-yaml.mjs";
import { RUNS, RUNS_TOO } from "./runs-by-itself.mjs";
import { started } from "./started.mjs";
import { lookOnlyOnPath } from "./workflow-run.mjs";

// (git, started here in the folder this runs in, a head's checkout where a session runs it there, is looked for on
// the PATH alone: workflow-run.mjs)
lookOnlyOnPath();

const YAML = /\.ya?ml$/iu;
// a comment a tool may read as an instruction (a check silenced, a linter told to look away)
const DIRECTIVE = /\b(?:ignore|disable|suppress|skip|allowlist|nosec|noqa|nosemgrep|semgrep|nolint|noinspection|nocheck|codeql|lgtm|nosonar|ggignore|zizmor|actionlint|shellcheck|checkov|trivy|gitleaks|lint|pragma)/iu;

/** Whether `before` and `after`, two versions of one YAML file, differ only in comments, blank lines between entries
 *  and steps' names: { same: true } or { why }. */
export function proof(before, after) {
  const a = readYaml(before), b = readYaml(after);
  if (a.unread.length) return { why: `before: ${a.unread.join("; ")}` };
  if (b.unread.length) return { why: `after: ${b.unread.join("; ")}` };
  const why = lineChanged(a, b) ?? directiveMoved(a, b) ?? usesNoteChanged(a, b);
  return why === null ? { same: true } : { why };
}

// what of a line the proof holds to: a block scalar's text as it stands, an entry's without its comment, a step's name
// left out
function kept(l) {
  return l.content ? `C${l.text}${l.last ? "\u0000no line break after it" : ""}` : `L${l.stepName ? `${l.text.slice(0, l.valueAt)}\u0000a step's name` : l.text}`;
}

// the first line that changed beyond a comment or a step's name, or null
function lineChanged(a, b) {
  const x = a.lines.map(kept), y = b.lines.map(kept);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === y[i]) continue;
    const where = (lines, side) => lines[i] ? `${side} line ${lines[i].n}` : `${side}: nothing`;
    return `more than a comment or a step's name changed (${where(a.lines, "before")}, ${where(b.lines, "after")})`;
  }
  return null;
}

// a comment that a tool may read as an instruction, added, changed or moved (a tool reads it on its own line, or on
// the line after it): each must stand, word for word, beside the same line as before, by its place, the two versions'
// lines being matched one to one by now (two lines may read alike); or null
function directiveMoved(a, b) {
  const left = new Map();
  for (const c of a.comments) if (DIRECTIVE.test(c.text)) left.set(placed(a, c), (left.get(placed(a, c)) ?? 0) + 1);
  for (const c of b.comments) {
    if (!DIRECTIVE.test(c.text)) continue;
    const key = placed(b, c);
    if (left.get(key)) { left.set(key, left.get(key) - 1); continue; }
    return `a comment a tool may read as an instruction, added or moved: ${c.text.slice(0, 80)}`;
  }
  return null;
}

// a comment's place and words, by which the two versions' are matched
function placed(side, c) { return `${c.own ? "before" : "on"} ${c.at}\u0000${c.text}`; }

// the note beside an action's version (`uses:`), changed; or null
function usesNoteChanged(a, b) {
  const note = a.lines.findIndex((l, i) => uses(l.key) && l.note !== b.lines[i].note);
  if (note >= 0) return `the note beside an action's version changed (before line ${a.lines[note].n}, after line ${b.lines[note].n})`;
  return null;
}

// (the key however it is written: quoted, or with an escape that could spell it, is taken for one)
function uses(key) {
  return typeof key === "string" && (/^(["']?)uses\1$/u.test(key) || (key.startsWith('"') && key.includes("\\")));
}

if (started(import.meta.url)) {
  const git = (args, encoding = "utf8") => execFileSync("git", args, { encoding, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
  const clean = s => s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, "?");
  const head = git(["rev-parse", "HEAD"]).trim();
  git(["fetch", "-q", "--no-tags", "origin", "refs/heads/main"]);
  const main = git(["rev-parse", "FETCH_HEAD"]).trim();
  try { git(["merge-base", "--is-ancestor", main, head]); } catch {
    console.log(`the head is not up to date with main (${main.slice(0, 7)}): bring it up to date, and run this on the head that merges`);
    process.exit(1);
  }
  let base = git(["merge-base", main, head]).trim();
  if (process.argv[2]) {
    try { base = git(["rev-parse", "--verify", "--quiet", "--end-of-options", `${process.argv[2]}^{commit}`]).trim(); } catch { base = ""; }
    let grew = Boolean(base) && base !== head;
    try { git(["merge-base", "--is-ancestor", base, head]); } catch { grew = false; }
    if (!grew) {
      console.log(`${clean(process.argv[2])} is no commit before the head that it grew from: a later commit is read only against one before it`);
      process.exit(1);
    }
  }
  // (the whole tree, from whatever folder it is run in, whatever git's diff.relative says)
  const fields = git(["-c", "core.quotePath=false", "diff", "--raw", "-z", "--no-relative", "--no-renames", "--no-abbrev", "--no-ext-diff", "--ignore-submodules=none", base, head]).split("\0");
  const fails = [], read = [], others = [];
  // a link or a submodule where this proof reads, on either side: what it points to is not read
  for (const commit of [base, head]) {
    for (const entry of git(["ls-tree", "-r", "-z", "--full-tree", commit]).split("\0")) {
      const tab = entry.indexOf("\t"), meta = entry.slice(0, tab), file = tab < 0 ? "" : entry.slice(tab + 1); // (a path may hold a tab)
      if (file && RUNS.test(file) && /^1[26]0000 /u.test(meta)) fails.push(`${file}: a link or submodule, at ${commit.slice(0, 7)}`);
    }
  }
  // (a byte order mark at the start is kept, to be refused as one anywhere else is, never dropped unseen)
  const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const blob = sha => utf8.decode(git(["cat-file", "blob", sha], "buffer"));
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const [modeA, modeB, shaA, shaB, status] = fields[i].replace(/^:/u, "").split(" ");
    const file = fields[i + 1];
    if (RUNS_TOO.test(file)) { fails.push(`${file}: a file that runs by itself or decides what does`); continue; }
    if (!RUNS.test(file)) { others.push(file); continue; }
    if (status !== "M" || modeA !== modeB || !["100644", "100755"].includes(modeA)) { fails.push(`${file}: added, deleted, or its mode or kind changed`); continue; }
    if (!YAML.test(file)) { fails.push(`${file}: not a YAML file`); continue; }
    let result;
    try { result = proof(blob(shaA), blob(shaB)); } catch { result = { why: "not text in UTF-8" }; }
    if (result.why) fails.push(`${file}: ${result.why}`);
    else read.push(file);
  }
  if (fails.length) {
    for (const f of fails) console.log(`  NOT ALONE ${clean(f)}`);
    console.log("not comments and steps' names alone: floor rule 3's two security reviews");
    process.exit(1);
  }
  console.log(read.length
    ? `comments and steps' names alone in .github/, .claude/ and actions, ${base.slice(0, 7)}..${head.slice(0, 7)}: ${read.map(clean).join(", ")}`
    : `nothing changed in .github/, .claude/ or an action.yml, ${base.slice(0, 7)}..${head.slice(0, 7)}`);
  console.log(`checked head ${head}`);
  if (others.length) {
    console.log(`also changed, outside what this proof reads: ${others.map(clean).join(", ")}`);
    console.log("rule 8's one review only where the \"Security review:\" comment says of each of these why it runs neither by itself nor with credentials; otherwise floor rule 3's two");
    process.exit(2);
  }
}
