// The stalled lanes (roles/orchestrator.md, "A stalled lane"; core archive 200): run in a project's clone on every
// wake of its orchestrator, it reads the repository's open pull requests (gh, page by page) and the time of each one's
// newest commit, and prints those whose branch has had no push for longer than the given hours (HOURS unless --hours
// says otherwise), oldest first, so that no session's word that a lane is "running" stands in for the clock, each
// marked where its description holds no hand-off note (tasks/tools.md, "A change of tool loses nothing"; #306), the
// line "Hand-off:" the fresh builder reads first. Pull requests from a fork and Dependabot's own are no lanes and are
// left out. It prints one line when none has stalled, reads
// only, posts nothing and always exits 0 where it could read: what to do with a stalled lane stays the orchestrator's.
// gh and Node's own modules.
//
//   node core/scripts/stalled.mjs [--hours N] [--repo owner/name]
import { execFileSync } from "node:child_process";
import { REPO } from "./core-cost.mjs";
import { read } from "./queue.mjs";
import { timeOf } from "./moment.mjs";
import { started } from "./started.mjs";

// A description's hand-off note: a line that opens "Hand-off:", bare, bold, a heading or an item of a list.
export const HAND_OFF = /^(?:[-*] |#{1,6} )?(?:\*\*)?Hand-off:/mu;
export const handedOff = body => HAND_OFF.test(typeof body === "string" ? body : "");

// How long a lane may go without a push before it counts as stalled, unless --hours says otherwise.
export const HOURS = 3;

// The lanes, given as { number, title, ref, own (its branch is in this repository), at (its newest commit) }, that have
// had no push for longer than `hours` at `now`, oldest first, each with how long it has waited.
export function stalled(pulls, now, hours) {
  return pulls
    .filter(p => p.own && !String(p.ref).startsWith("dependabot/") && timeOf(p.at) !== null)
    .map(p => ({ ...p, waited: (now - timeOf(p.at)) / 3600000 }))
    .filter(p => p.waited > hours)
    .sort((a, b) => b.waited - a.waited);
}

// A title or a branch's name as it may be printed: no control characters.
const plain = text => String(text ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");

export function print(lanes, open, hours) {
  if (!lanes.length) return `No lane stalled: ${open} open, none without a push for over ${hours} h.`;
  return [`Stalled, no push for over ${hours} h: ${lanes.length} of ${open} open`,
    ...lanes.map(l => `  #${l.number} ${plain(l.ref)}: ${l.waited.toFixed(1)} h since ${l.at} (${plain(l.title)})${handedOff(l.body) ? "" : "; no hand-off note"}`)].join("\n");
}

// Whether work went on in the last `hours` (a day by default) at `now`: a push to a pull request of the repository's
// own (a fork's counts for nothing), or `latest`, the default branch's newest commit, a merge among them.
export const goesOn = ({ pulls, latest = null, now, hours = 24 }) =>
  [...pulls.filter(p => p.own).map(p => p.at), latest].some(at => timeOf(at) !== null && now - timeOf(at) < hours * 3600 * 1000);

// The work standing still (roles/orchestrator.md, "Never held back in silence"; #471): the *progress file*'s next line,
// as its readers read it (queue.mjs's `read`, given `closed`: a closed issue's line skipped, one held for the owner, or
// waiting on anything open or on a hold, not taken), where no work went on (goesOn) and no notice is open (`notices`,
// the titles of the open issues that the orchestrator's account opened; one that opens NOTICE is its word to the owner
// that it holds builders back). The issue numbers that line names first, or null where the work goes on, a notice says
// why it does not, or no line could be taken.
export const NOTICE = "Builders held back for usage";
export function standingStill({ queue, closed, pulls, notices, now, latest = null, hours = 24 }) {
  if (notices.some(t => String(t).startsWith(NOTICE)) || goesOn({ pulls, latest, now, hours })) return null;
  return read(String(queue ?? ""), closed).next?.issues ?? null;
}

// The open pull requests of `repo`, through `api` (gh api's route and --jq, as main gives it), page by page, since a
// cloud session's gh cannot follow pages by itself: each { number, title, ref, sha, own, draft, body, labels, at }, `at`
// the time of its newest commit where its branch is in this repository. Also read by the scheduled look (look.mjs).
export function openPulls(repo, api) {
  const pulls = [];
  for (let page = 1; page <= 50; page++) {
    const rows = api(`repos/${repo}/pulls?state=open&per_page=100&page=${page}`,
      ".[] | [.number, .title, .head.ref, .head.sha, ((.head.repo.full_name // \"\") | ascii_downcase), .draft, (.body // \"\"), [.labels[].name]] | @json")
      .split("\n").filter(Boolean).map(l => JSON.parse(l));
    for (const [number, title, ref, sha, from, draft, body, labels] of rows) pulls.push({ number, title, ref, sha, own: from === repo.toLowerCase(), draft, body, labels });
    if (rows.length < 100) break;
  }
  for (const p of pulls) if (p.own && /^[0-9a-f]{40}$/.test(p.sha)) p.at = api(`repos/${repo}/commits/${p.sha}`, ".commit.committer.date").trim();
  return pulls;
}

function main(args) {
  const fail = msg => { console.error(`FAIL: ${msg}`); process.exit(1); };
  const at = args.indexOf("--repo"), h = args.indexOf("--hours");
  if (at >= 0 && !REPO.test(args[at + 1] ?? "")) fail("--repo needs owner/name after it");
  const hours = h >= 0 ? Number(args[h + 1]) : HOURS;
  if (!(hours > 0 && hours <= 168)) fail("--hours needs a number of hours above 0 and up to 168 after it");
  let repo = at >= 0 ? args[at + 1] : process.env.GITHUB_REPOSITORY;
  if (!repo) try {
    repo = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim())?.[1];
  } catch { /* (no origin) */ }
  if (!REPO.test(repo ?? "")) fail("the repository is not known: give --repo owner/name, or run in a clone of it");
  const api = (path, jq) => execFileSync("gh", ["api", path, "--jq", jq], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1 << 26 });
  const pulls = openPulls(repo, api);
  console.log(print(stalled(pulls, Date.now(), hours), pulls.length, hours));
}

if (started(import.meta.url)) main(process.argv.slice(2));
