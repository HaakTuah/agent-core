// Whether a release's trial is due in the core (AGENTS.md, "One batch, then one release"; #1413, point 4): once LINES
// lines of QUEUE.md have merged since the newest release, or DAYS days have passed since it with at least one merged.
// A line merged is an issue a line of QUEUE.md named, at the newest release's commit or in any version of the file
// since, that closed as completed after that commit, its close made by a merged pull request or by an account that can
// write the repository, as the issue's events and the closer's right on GitHub say (closesRead): a close it cannot read
// so is not counted, and the count says so with its mend; the count runs from the commit the release stands on, not the day
// of its cut, since a release is cut from the commit its trial tried (#1413, point 3) and what merged after it is the
// next batch's. A trial whose record on main names a commit past the newest release and holds no cut has run, and no
// second one is due until that release is cut; one whose record holds the cut is to be run again. The scheduled look keeps the issue TITLE while one is due (look.mjs, `dueIssue`), a task
// the orchestrator gives a lane like any other. In the core alone: a project cuts no release. QUEUE.md's text and
// GitHub's answers are untrusted (SECURITY.md, rule 5): each is checked against its form, a version of the file past
// LARGEST bytes is refused unread, and only the repository's name, a date, an issue's number, a commit's whole SHA and a
// login each in its form reach gh's route. Git and Node's own modules, and gh.
//
//   node scripts/release-due.mjs      whether a trial is due, and what the count rests on; it writes nothing
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { aCommit, aRepository, parseBounded } from "./guards.mjs";
import { LARGEST, linesOf } from "./queue.mjs";
import { TRIAL, trialAt } from "./release-trial.mjs";
import { RELEASE } from "./releases.mjs";
import { writersOf } from "./security-review.mjs";
import { started } from "./started.mjs";

export const LINES = 10, DAYS = 7, PAGES = 30, EVENT_PAGES = 10;
export const TITLE = "A release's trial is due";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHA = /^[0-9a-f]{40}$/u, DAY = 86400000, LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u;

const gitIn = dir => args => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }).trim();
const ghApi = route => {
  const r = spawnSync("gh", ["api", route], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 60000 });
  if (r.status !== 0) throw new Error(`gh could not read ${route.split("?")[0]}: ${String(r.stderr ?? r.error).trim().slice(0, 200)}`);
  return r.stdout;
};

// The newest release on main and what the count rests on, read from git: { release: { name, sha, at }, lines, trialed }
// or null where no release is merged into `head`. `at` is the time of the commit the release stands on; `lines` the
// issues the lines of QUEUE.md named at that commit and in each version of the file since, on main's newest commit `head`;
// `trialed` the commit the trial's record on `head` names where it is past the release and holds no cut (trialAt), else
// null: a trial that stopped the cut is to be run again. Main's own versions alone (--first-parent); a shallow clone throws.
export function readGit(git, head = "HEAD") {
  const tags = git(["tag", "--list", "release-*", "--merged", head]).split("\n").map(t => t.trim()).filter(t => RELEASE.test(t));
  if (!tags.length) {
    if (git(["rev-parse", "--is-shallow-repository"]) === "true") throw new Error("the clone is shallow, so the releases merged into main cannot be read");
    return null;
  }
  const name = tags.sort((a, b) => Number(RELEASE.exec(b)[1]) - Number(RELEASE.exec(a)[1]))[0];
  const sha = git(["rev-parse", "--verify", `refs/tags/${name}^{commit}`]);
  if (!SHA.test(sha)) throw new Error(`${name} leads to no commit`);
  const at = git(["show", "-s", "--format=%cI", sha]);
  const versions = [sha, ...git(["log", "--first-parent", "--format=%H", `${sha}..${head}`, "--", "QUEUE.md"]).split("\n").filter(s => SHA.test(s))];
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
    if (SHA.test(commit ?? "") && commit !== sha) { git(["merge-base", "--is-ancestor", sha, commit]); if (trialAt(commit, git, head).held === null) trialed = commit; }
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

// Who made each close of `numbers` (issues of `repo` closed as completed, each a number readGit read), read from GitHub: { counted, unread, other }.
// Counted, a Set, where the newest close in the issue's events names a commit that a merged pull request brought in,
// or was made by an account whose right on the repository is write, maintain or admin (writersOf); other, the numbers
// whose close was made by neither; unread, [{ number, why }], those whose events, closer or right gave no answer in
// its form: counted neither way, never guessed. An answer read is held to its form, the events to EVENT_PAGES pages.
export function closesRead(repo, numbers, ask = ghApi) {
  if (!aRepository(repo)) throw new Error(`${String(repo).slice(0, 80)} is no repository's name`);
  const read = route => { try { return parseBounded(ask(route)); } catch { return undefined; } };
  const counted = new Set(), unread = [], other = [];
  for (const number of numbers) {
    const how = closer(repo, number, read);
    if (how === true) counted.add(number);
    else if (how === false) other.push(number);
    else unread.push({ number, why: how });
  }
  return { counted, unread, other };
}

// The newest close in the events of issue `number`, or null where they hold none or give no whole answer in its form.
function closeOf(repo, number, read) {
  const events = [];
  for (let page = 1; page <= EVENT_PAGES; page++) {
    const rows = read(`repos/${repo}/issues/${number}/events?per_page=100&page=${page}`);
    if (!Array.isArray(rows)) return null;
    events.push(...rows);
    if (rows.length < 100) return events.filter(e => e?.event === "closed").at(-1) ?? null;
  }
  return null;
}

// Whether a commit was brought in by a merged pull request, as the host's list of its pull requests says.
const merged = (repo, sha, read) => {
  const pulls = aCommit(sha) ? read(`repos/${repo}/commits/${sha}/pulls`) : null;
  return Array.isArray(pulls) && pulls.some(p => typeof p?.merged_at === "string" && !Number.isNaN(Date.parse(p.merged_at)));
};

// How issue `number` was closed: true by a merge or a writer, false by neither, else why it could not be read.
function closer(repo, number, read) {
  const close = closeOf(repo, number, read);
  if (!close) return "its events hold no close that could be read";
  if (merged(repo, close.commit_id, read)) return true;
  const login = close.actor?.login;
  if (typeof login !== "string" || !LOGIN.test(login)) return "who closed it could not be read";
  const right = read(`repos/${repo}/collaborators/${login}/permission`);
  if (typeof right?.permission !== "string") return "the right of the account that closed it could not be read";
  return writersOf([right]).has(login.toLowerCase());
}

// The lines of `lines` closed as completed after `since`, each close read by closesRead: its answer.
export const closesSince = (repo, since, lines, ask = ghApi) => {
  const closed = closedSince(repo, since, ask);
  return closesRead(repo, lines.filter(n => closed.has(n)), ask);
};

// readGit's answer where it found a release: the core has cut releases, so none merged into main is a checkout with no
// tags, never a core with none to count from.
function released(r) {
  if (r === null) throw new Error("no release tag is merged into main here, and the core has cut releases: the checkout holds no tags (git fetch --tags)");
  return r;
}

// Whether a trial is due, from what was read: { due, merged, days, said }. `read` is readGit's answer, `closed` the
// numbers counted (closesRead), `now` the time of the reading, `left` closesRead's closes not counted, which `said` names.
export function dueness(read, closed, now, left = { unread: [], other: [] }) {
  const { release, lines, trialed } = read;
  const merged = lines.filter(n => closed.has(n));
  const days = Math.floor((Date.parse(now) - Date.parse(release.at)) / DAY);
  const since = `since ${release.name} (its commit ${release.sha.slice(0, 7)}, ${release.at.slice(0, 10)}, ${days} ${days === 1 ? "day" : "days"} ago)`;
  const other = left.other.length ? `; not counted, closed by no merge and no account that can write: ${left.other.map(n => `#${n}`).join(", ")}` : "";
  const unread = left.unread.length ? `; not counted, since who made its close could not be read: ${left.unread.map(u => `#${u.number} (${u.why})`).join(", ")}. Mend: run node scripts/release-due.mjs again once gh answers; where it still cannot read one whose work merged, an account that can write the repository reopens it and closes it as completed` : "";
  const count = `${merged.length} ${merged.length === 1 ? "line" : "lines"} of QUEUE.md merged ${since}${merged.length ? `: ${merged.map(n => `#${n}`).join(", ")}` : ""}${other}${unread}`;
  if (trialed) return { due: false, merged, days, said: `Not due: the trial's record names ${trialed.slice(0, 7)}, past ${release.name}, so its trial has run; the release is cut from it (AGENTS.md, "A release is cut on the owner's word"). ${count}.` };
  const due = merged.length >= LINES || (days >= DAYS && merged.length >= 1);
  const why = merged.length >= LINES ? `${LINES} or more lines merged` : due ? `${DAYS} days or more with at least one merged` : `under ${LINES} lines, and ${days >= DAYS ? "none merged" : `under ${DAYS} days`}`;
  return { due, merged, days, said: `${due ? "Due" : "Not due"} (${why}): ${count}.` };
}

// The scheduled look's reader (look.mjs, DUE): the issue TITLE kept while a trial is due, closed once none is; in the
// core alone, and left as it stands where git or GitHub cannot be read. `read`, `closed` stand in for git and gh.
export function dueIssue({ manifest, at, repo }, read = () => readGit(gitIn(ROOT)), closed = (since, lines) => closesSince(repo ?? CORE, since, lines)) {
  if (manifest !== null || fs.existsSync(path.join(ROOT, "..", "core-manifest.md"))) return null;
  let d;
  try {
    const r = released(read());
    const c = closed(r.release.at, r.lines);
    d = dueness(r, c.counted, at, c);
  }
  catch (e) { return { title: TITLE, body: null, unread: `whether a release's trial is due could not be read: ${String(e.message).slice(0, 200)}` }; }
  if (!d.due) return { title: TITLE, body: null };
  return {
    title: TITLE,
    owner: false,
    body: [
      `A release's trial is due (\`node scripts/release-due.mjs\`; AGENTS.md, "One batch, then one release"). ${d.said}`,
      "",
      "A task the orchestrator gives a lane: a builder at the strongest tier tries the release on main's newest commit whose checks all passed, from the brief `node scripts/trial-brief.mjs <that commit>` prints, and records it with `node scripts/release.mjs --trial` in a pull request of its own (AGENTS.md, \"Each release is tried on a real project first\"); once that record merges holding no cut, this issue closes and the release workflow is started on the owner's standing word. The lines that merge after the commit tried go to the next batch.",
    ].join("\n"),
  };
}

function main(argv) {
  if (argv.length) { console.error(`FAIL: ${argv[0]} is no option of this script. Mend: run node scripts/release-due.mjs with nothing`); return 1; }
  if (fs.existsSync(path.join(ROOT, "..", "core-manifest.md"))) { console.error("FAIL: run it in the core's own repository: a project cuts no release. Mend: run it from a clone of the core"); return 1; }
  try {
    const r = released(readGit(gitIn(ROOT)));
    const c = closesSince(CORE, r.release.at, r.lines);
    console.log(dueness(r, c.counted, new Date().toISOString(), c).said);
    return 0;
  } catch (e) {
    console.error(`FAIL: whether a release's trial is due could not be read: ${String(e.message).slice(0, 300)}. Mend: run it from a clone of the core with its whole history and tags (git fetch --tags, with --unshallow where the clone is shallow), and with gh signed in`);
    return 1;
  }
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
