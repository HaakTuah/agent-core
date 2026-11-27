// Whether a release's trial is due in the core (AGENTS.md, "One batch, then one release"; #1413, point 4): once LINES
// lines of QUEUE.md have merged since the newest release, or DAYS days have passed since it with at least one merged.
// A line merged is an issue a line of QUEUE.md named, at the newest release's commit or in any version of the file
// since, that closed as completed after that commit; the count runs from the commit the release stands on, not the day
// of its cut, since a release is cut from the commit its trial tried (#1413, point 3) and what merged after it is the
// next batch's. A trial whose record on main names a commit past the newest release has run, and no second one is due
// until that release is cut. The scheduled look keeps the issue TITLE while one is due (look.mjs, `dueIssue`), a task
// the orchestrator gives a lane like any other. In the core alone: a project cuts no release. QUEUE.md's text and
// GitHub's answers are untrusted (SECURITY.md, rule 5): each is checked against its form, a version of the file past
// LARGEST bytes is refused unread, and only the repository's name and a date reach gh's route. Git and Node's own modules, and gh.
//
//   node scripts/release-due.mjs      whether a trial is due, and what the count rests on; it writes nothing
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { aRepository, parseBounded } from "./guards.mjs";
import { LARGEST, linesOf } from "./queue.mjs";
import { TRIAL } from "./release-trial.mjs";
import { RELEASE } from "./releases.mjs";
import { started } from "./started.mjs";

export const LINES = 10, DAYS = 7, PAGES = 30;
export const TITLE = "A release's trial is due";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHA = /^[0-9a-f]{40}$/u, DAY = 86400000;

const gitIn = dir => args => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }).trim();
const ghApi = route => {
  const r = spawnSync("gh", ["api", route], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 60000 });
  if (r.status !== 0) throw new Error(`gh could not read ${route.split("?")[0]}: ${String(r.stderr ?? r.error).trim().slice(0, 200)}`);
  return r.stdout;
};

// The newest release on main and what the count rests on, read from git: { release: { name, sha, at }, lines, trialed }
// or null where the core has cut none. `at` is the time of the commit the release stands on; `lines` the issues the
// lines of QUEUE.md named at that commit and in each version of the file since, on main's newest commit `head`;
// `trialed` the commit the trial's record on `head` names where it is past the release, else null.
export function readGit(git, head = "HEAD") {
  const tags = git(["tag", "--list", "release-*", "--merged", head]).split("\n").map(t => t.trim()).filter(t => RELEASE.test(t));
  if (!tags.length) return null;
  const name = tags.sort((a, b) => Number(RELEASE.exec(b)[1]) - Number(RELEASE.exec(a)[1]))[0];
  const sha = git(["rev-parse", "--verify", `refs/tags/${name}^{commit}`]);
  if (!SHA.test(sha)) throw new Error(`${name} leads to no commit`);
  const at = git(["show", "-s", "--format=%cI", sha]);
  const versions = [sha, ...git(["log", "--format=%H", `${sha}..${head}`, "--", "QUEUE.md"]).split("\n").filter(s => SHA.test(s))];
  const lines = new Set();
  for (const v of versions) {
    let size = null;
    try { size = Number(git(["cat-file", "-s", `${v}:QUEUE.md`])); } catch { /* (no QUEUE.md in that version) */ }
    if (size === null) continue;
    if (!(size <= LARGEST)) throw new Error(`QUEUE.md at ${v.slice(0, 7)} is past the ${LARGEST} bytes the reader takes`);
    const text = git(["show", `${v}:QUEUE.md`]);
    for (const line of linesOf(text)) for (const n of line.issues) lines.add(n);
  }
  let trialed = null;
  try {
    const commit = JSON.parse(git(["show", `${head}:${TRIAL}`]))?.commit;
    if (SHA.test(commit ?? "") && commit !== sha) { git(["merge-base", "--is-ancestor", sha, commit]); trialed = commit; }
  } catch { /* (no record, none past the release) */ }
  return { release: { name, sha, at }, lines: [...lines].sort((a, b) => a - b), trialed };
}

// One page of GitHub's list of closed issues, as rows checked against their form: an answer that is not a list, or a
// row that is no issue with its number and times, throws, as does gh failing: the reading never guesses.
function pageOf(text) {
  let rows;
  try { rows = parseBounded(text); } catch (e) { throw new Error(e instanceof SyntaxError ? "GitHub's list of closed issues is no JSON" : e.message); }
  if (!Array.isArray(rows)) throw new Error("GitHub's list of closed issues is no list");
  const closedIssue = row => row !== null && typeof row === "object" && Number.isSafeInteger(row.number) && row.number >= 1 && row.state === "closed" && !Number.isNaN(Date.parse(row.closed_at));
  if (!rows.every(closedIssue)) throw new Error("GitHub's list of closed issues holds a row that is no closed issue with its number and the time it closed");
  return rows;
}

// The issues of `repo` closed as completed after `since` (a time), read from GitHub a page at a time: a Set of their
// numbers, pull requests left out, the reading bound to PAGES pages.
export function closedSince(repo, since, ask = ghApi) {
  if (!aRepository(repo)) throw new Error(`${String(repo).slice(0, 80)} is no repository's name`);
  const from = new Date(since);
  if (Number.isNaN(from.getTime())) throw new Error(`${String(since).slice(0, 40)} is no time`);
  const closed = new Set();
  for (let page = 1; ; page++) {
    const rows = pageOf(ask(`repos/${repo}/issues?state=closed&since=${encodeURIComponent(from.toISOString())}&per_page=100&page=${page}`));
    for (const row of rows) if (!("pull_request" in row) && row.state_reason === "completed" && Date.parse(row.closed_at) > from.getTime()) closed.add(row.number);
    if (rows.length < 100) break;
    if (page >= PAGES) throw new Error(`GitHub's list of closed issues runs past ${PAGES} pages`);
  }
  return closed;
}

// Whether a trial is due, from what was read: { due, merged, days, said }. `read` is readGit's answer, `closed` the
// numbers closedSince gave, `now` the time of the reading.
export function dueness(read, closed, now) {
  if (read === null) return { due: false, merged: [], days: 0, said: "The core has cut no release yet: the first is cut once the queue is worked through." };
  const { release, lines, trialed } = read;
  const merged = lines.filter(n => closed.has(n));
  const days = Math.floor((Date.parse(now) - Date.parse(release.at)) / DAY);
  const since = `since ${release.name} (its commit ${release.sha.slice(0, 7)}, ${release.at.slice(0, 10)}, ${days} ${days === 1 ? "day" : "days"} ago)`;
  const count = `${merged.length} ${merged.length === 1 ? "line" : "lines"} of QUEUE.md merged ${since}${merged.length ? `: ${merged.map(n => `#${n}`).join(", ")}` : ""}`;
  if (trialed) return { due: false, merged, days, said: `Not due: the trial's record names ${trialed.slice(0, 7)}, past ${release.name}, so its trial has run; the release is cut from it (AGENTS.md, "A release is cut on the owner's word"). ${count}.` };
  const due = merged.length >= LINES || (days >= DAYS && merged.length >= 1);
  const why = merged.length >= LINES ? `${LINES} or more lines merged` : due ? `${DAYS} days or more with at least one merged` : `under ${LINES} lines, and ${days >= DAYS ? "none merged" : `under ${DAYS} days`}`;
  return { due, merged, days, said: `${due ? "Due" : "Not due"} (${why}): ${count}.` };
}

// The scheduled look's reader (look.mjs, DUE): the issue TITLE kept while a trial is due, closed once none is; in the
// core alone, and left as it stands where git or GitHub cannot be read. `read`, `closed` stand in for git and gh.
export function dueIssue({ manifest, at, repo }, read = () => readGit(gitIn(ROOT)), closed = since => closedSince(repo ?? CORE, since)) {
  if (manifest !== null || fs.existsSync(path.join(ROOT, "..", "core-manifest.md"))) return null;
  let d;
  try { const r = read(); d = dueness(r, r === null ? new Set() : closed(r.release.at), at); }
  catch (e) { return { title: TITLE, body: null, unread: `whether a release's trial is due could not be read: ${String(e.message).slice(0, 200)}` }; }
  if (!d.due) return { title: TITLE, body: null };
  return {
    title: TITLE,
    owner: false,
    body: [
      `A release's trial is due (\`node scripts/release-due.mjs\`; AGENTS.md, "One batch, then one release"). ${d.said}`,
      "",
      "A task the orchestrator gives a lane: a builder at the strongest tier tries the release on main's newest commit whose checks all passed, from the brief `node scripts/trial-brief.mjs <that commit>` prints, and records it with `node scripts/release.mjs --trial` in a pull request of its own (AGENTS.md, \"Each release is tried on a real project first\"); once that record merges, this issue closes and the release workflow is started on the owner's standing word. The lines that merge after the commit tried go to the next batch.",
    ].join("\n"),
  };
}

function main(argv) {
  if (argv.length) { console.error(`FAIL: ${argv[0]} is no option of this script. Mend: run node scripts/release-due.mjs with nothing`); return 1; }
  if (fs.existsSync(path.join(ROOT, "..", "core-manifest.md"))) { console.error("FAIL: run it in the core's own repository: a project cuts no release. Mend: run it from a clone of the core"); return 1; }
  try {
    const r = readGit(gitIn(ROOT));
    console.log(dueness(r, r === null ? new Set() : closedSince(CORE, r.release.at), new Date().toISOString()).said);
    return 0;
  } catch (e) {
    console.error(`FAIL: whether a release's trial is due could not be read: ${String(e.message).slice(0, 300)}. Mend: run it from a clone of the core with its whole history and tags (git fetch --unshallow --tags), and with gh signed in`);
    return 1;
  }
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
