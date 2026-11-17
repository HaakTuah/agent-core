// The bugs fixed since a day, for the sign of the core's record "the core's scripts stay in JavaScript with no type
// checker" (CHOICES.md; #515, point 2), read at each pass over the records: each closed issue labelled `bug`, closed on
// or after the day, with each commit on the default branch's first-parent line whose message says it fixes it ("Fixes
// #12", or closes or resolves) and that changed a script that is no test (scripts/*.mjs, not *-test.mjs); printed with
// that commit, the tree before it (its first parent) and the lines of each such script the fix changed, as they stood
// in that tree. The pass runs the type checker on each tree as the record says and counts the fixes where a finding
// points at a line printed here. It reads only. git, gh and Node's own modules.
//
//   node scripts/fixes.mjs --since YYYY-MM-DD
import { execFileSync } from "node:child_process";
import { DAY, defaultRef, repoOf } from "./core-cost.mjs";
import { started } from "./started.mjs";

// A script the checker is run on: one of scripts/, and no test.
export const SCRIPT = /^scripts\/[^/]+\.mjs$/u;
export const scriptOf = file => SCRIPT.test(file) && !/-test\.mjs$/u.test(file);

// The issues a commit's message says it fixes: "Fixes #12", "closes #3, fixes #4" (GitHub's own words for it).
export const fixedBy = message => [...String(message ?? "").matchAll(/\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s*:?\s+#(\d+)\b/giu)].map(m => Number(m[1]));

// The lines of each file a diff with no context (git diff -U0) changed, as they stood before it: { file: [line, ...] }.
// A hunk that only adds lines changed none of the old, and is placed at the line it follows, so a finding there counts.
export function changedLines(diff) {
  const out = {};
  let file = null;
  for (const line of String(diff ?? "").split("\n")) {
    const named = /^--- (?:a\/(.+)|\/dev\/null)$/u.exec(line);
    if (named) { file = named[1] ?? null; continue; }
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/u.exec(line);
    if (!hunk || !file) continue;
    const start = Number(hunk[1]), count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const lines = count ? Array.from({ length: count }, (_, i) => start + i) : [Math.max(start, 1)];
    (out[file] ??= []).push(...lines);
  }
  return out;
}

// The fixes of the issues `bugs` (their numbers) among the commits `log` ([{ sha, parent, message }], newest first),
// each { issue, sha, parent }: every commit that says it fixes one, so a bug fixed twice shows both.
export const fixesOf = (bugs, log) => log.flatMap(c => fixedBy(c.message).filter(n => bugs.includes(n)).map(issue => ({ issue, sha: c.sha, parent: c.parent })));

function main(argv) {
  const fail = msg => { console.error(`FAIL: ${msg}`); process.exit(1); };
  const since = argv[argv.indexOf("--since") + 1];
  if (!argv.includes("--since") || !DAY.test(since ?? "")) fail("--since takes a day, YYYY-MM-DD: the day on the line \"Read whole:\" of CHOICES.md");
  const git = args => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
  const repo = repoOf();
  if (!repo) fail("the repository is not known (GITHUB_REPOSITORY, or origin's address)");
  const ref = defaultRef(name => { try { git(["rev-parse", "--verify", "--quiet", `${name}^{commit}`]); return true; } catch { return false; } });
  if (!ref) fail("the clone knows no default branch: neither origin's, nor a main of origin's or of its own");
  const bugs = execFileSync("gh", ["api", "--paginate", `repos/${repo}/issues?state=closed&labels=bug&since=${since}T00:00:00Z&per_page=100`,
    "--jq", `.[] | select(.pull_request == null and .closed_at >= "${since}") | .number`], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] })
    .split("\n").filter(Boolean).map(Number);
  // (the default branch's own commits since the day, and, of each merge of a pull request among them, the commits it
  // brought, through which it fixes; a merge whose second parent this clone lacks, a shallow one's, brings none)
  const commits = range => git(["log", "--format=%H%x09%P%x1f%B%x1e", ...range]).split("\x1e").map(e => e.trim()).filter(Boolean).map(e => {
    const [head, message] = e.split("\x1f"), [sha, parents = ""] = head.split("\t");
    return { sha, parent: parents.split(" ")[0], second: parents.split(" ")[1] ?? null, message };
  });
  const log = commits(["--first-parent", `--since=${since}T00:00:00Z`, ref]);
  const merged = log.filter(c => c.second && c.parent).flatMap(c => { try { return commits([`${c.parent}..${c.second}`]); } catch { return []; } });
  const fixes = fixesOf(bugs, [...log, ...merged]);
  let read = 0, unread = 0;
  for (const f of fixes) {
    let diff;
    try { diff = git(["diff", "-U0", "--no-renames", f.parent, f.sha]); } catch { unread++; console.log(`#${f.issue} fixed in ${f.sha}: the tree before it is not in this clone (fetch its history: git fetch --unshallow)`); continue; }
    const lines = Object.entries(changedLines(diff)).filter(([file]) => scriptOf(file));
    if (!lines.length) continue;
    read++;
    console.log(`#${f.issue} fixed in ${f.sha}, the tree before it ${f.parent}:`);
    for (const [file, at] of lines) console.log(`  ${file}: ${at.join(",")}`);
  }
  console.log(`${read} fixes of ${bugs.length} bugs closed since ${since} changed a script that is no test${unread ? `; ${unread} could not be read in this clone` : ""}.`);
}

if (started(import.meta.url)) main(process.argv.slice(2));
