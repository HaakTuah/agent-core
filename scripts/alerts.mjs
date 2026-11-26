// The daily reading of the Dependabot alerts (floor/topics/weaknesses.md, rule 9's first point; tasks/updates.md, "An
// alert Dependabot does not mend"; #1142): run once a day on an orchestrator's wake (roles/orchestrator.md), from the
// project's root, with the session's own sign-in through gh. It reads the repository's open Dependabot alerts and, of
// each, only what the task needs (its number, when it was opened, its link, the package, its ecosystem and manifest, the
// advisory's id and the first fixed version), never an advisory's own text, which is outsiders' (floor rule 4). Each
// alert open more than a day with no open pull request of Dependabot's for its package becomes one bug issue, labelled
// bug, queued and by:orchestrator, worded as Dependabot's pull requests are: what it updates, and that it fixes a
// published advisory. An alert whose issue stands, in any state, is never filed again: the alert's number is in its
// title. Where the sign-in cannot read the alerts (the host's job token cannot; floor rule 1 makes no key for it), it
// says it read nothing and why, and fails nothing. It reads no secret-scanning or code-scanning alert, and dismisses
// none. It writes issues alone, and fails nothing (exit 0), save on a wrong option. gh, git and Node's own modules.
//
//   node core/scripts/alerts.mjs          read the alerts and file each task
//   node core/scripts/alerts.mjs --dry    what it would file; it writes nothing

import { spawnSync } from "node:child_process";
import { repoOf } from "./inbox.mjs";
import { ghApi, pagesOf } from "./labels.mjs";
import { plain } from "./look-kinds.mjs";
import { started } from "./started.mjs";

export const DAY = 24 * 3600 * 1000;
export const LABELS = ["bug", "queued", "by:orchestrator"];
const DEPENDABOT = "dependabot[bot]";
// The fields read of each alert, nothing of the advisory's text (gh's --jq, one object a line).
const FIELDS = ".[] | {number, created_at, html_url, package: .dependency.package, manifest: .dependency.manifest_path, ghsa: .security_advisory.ghsa_id, fixed: .security_vulnerability.first_patched_version.identifier}";

// A value of GitHub's made one plain line, with no backtick to break its code span.
const bare = text => plain(text).replace(/`/g, "'").trim();

// The title of an alert's issue, which finds it again: the alert's number makes it one of its own.
export const titleOf = a => `Update ${bare(a.package?.name)} (${bare(a.package?.ecosystem)}): it fixes a published advisory (Dependabot alert ${a.number})`;

// Whether an open pull request of Dependabot's names the package, by its title, branch or description.
const named = (pull, name) => {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), word = new RegExp(`(?:^|[^\\w@/.-])${esc}(?=$|[^\\w/-]|-\\d)`, "i");
  return [pull.title, pull.head?.ref?.replace(/^dependabot\/[^/]+\//, " "), pull.body].some(t => word.test(String(t ?? "")));
};

// The alerts that are tasks: open more than a day at `at`, with no open pull request of Dependabot's for the package.
export const tasksOf = (alerts, pulls, at) => alerts.filter(a => Number.isInteger(a.number) && a.package?.name
  && Date.parse(at) - Date.parse(a.created_at) > DAY
  && !pulls.some(p => p.user?.login === DEPENDABOT && p.state !== "closed" && named(p, String(a.package.name))));

// The body of an alert's issue.
export const bodyOf = a => {
  const ghsa = /^GHSA(?:-[a-z0-9]{4}){3}$/i.test(String(a.ghsa ?? "")) ? a.ghsa : null, fixed = a.fixed ? `\`${bare(a.fixed)}\`` : "no version yet";
  return [`Dependabot alert ${a.number} has stood open more than a day with no open pull request of Dependabot's for its package. It is a bug task ("Bugs don't wait"), mended as any update (\`tasks/updates.md\`, "An alert Dependabot does not mend").`, "",
    `- Package: \`${bare(a.package.name)}\` (${bare(a.package.ecosystem)}), in \`${bare(a.manifest)}\``,
    `- Published advisory: ${ghsa ? `[${ghsa}](https://github.com/advisories/${ghsa})` : "named in the alert"}; first fixed version: ${fixed}`,
    `- The alert, which its repository's admins see: ${/^https:\/\/github\.com\/[\w./-]+$/.test(String(a.html_url ?? "")) ? a.html_url : "in the Security tab"}`, "",
    "Take a version that fixes it, of the package or of the one that brings it in, or the package manager's override, through the lookup, the licence check, the tests and the reviews. Where none passes, judge whether the weak code is reached: where it is not, file an issue labelled `needs-owner` asking the owner to dismiss the alert as \"Risk is tolerable\", with that reason; where it is, report it privately (floor rule 9, \"Reporting a weakness\"), never in an issue. Where the advisory says the version is malicious, floor rule 7's \"A package found bad goes at once\" takes it instead. Say nothing here of how it could be attacked.", "",
    "Found while: the orchestrator's daily reading of the Dependabot alerts (`core/scripts/alerts.mjs`)."].join("\n");
};

// The open alerts, or { unread } with why they could not be read with this sign-in.
export function readAlerts(repo, gh = ghApi) {
  try { return { alerts: String(gh("--paginate", `repos/${repo}/dependabot/alerts?state=open&per_page=100`, "--jq", FIELDS)).split("\n").filter(l => l.trim()).map(l => JSON.parse(l)) }; }
  catch (e) {
    const why = /\bHTTP 403\b/.test(String(e?.message)) ? "this sign-in may not read them, or Dependabot alerts are off" : /\bHTTP 404\b/.test(String(e?.message)) ? "GitHub shows them to no one this sign-in stands for" : "GitHub gave no answer";
    return { unread: why };
  }
}

// The reading: what it filed, or would file with `dry`, and each line it said. `gh` is GitHub's way in, or a test's.
export function reading({ repo, at = new Date().toISOString(), dry = false, gh = ghApi, say = console.log }) {
  const read = readAlerts(repo, gh);
  if (read.unread) { say(`The Dependabot alerts of ${repo} read nothing: ${read.unread}. Nothing waits on it; a session whose sign-in reads them reads them at its wake.`); return { unread: read.unread, filed: [] }; }
  let pulls, issues;
  try { pulls = pagesOf(`repos/${repo}/pulls?state=open`, gh); issues = pagesOf(`repos/${repo}/issues?state=all&labels=bug`, gh); }
  catch { say(`The pull requests or issues of ${repo} could not be read, so no alert was filed. Run it again where gh answers.`); return { unread: "the pull requests or issues", filed: [] }; }
  const titles = new Set(issues.map(i => i.title)), filed = [];
  for (const a of tasksOf(read.alerts, pulls, at)) {
    const title = titleOf(a);
    if (titles.has(title)) continue;
    if (!dry) { try { gh("--method", "POST", `repos/${repo}/issues`, "-f", `title=${title}`, "-f", `body=${bodyOf(a)}`, ...LABELS.flatMap(l => ["-f", `labels[]=${l}`])); } catch { say(`FAIL: the issue "${title}" could not be filed. Mend: file it by hand with the labels ${LABELS.join(", ")}, or run this again where gh may write issues`); continue; } }
    filed.push(title); say(`${dry ? "Would file" : "Filed"}: ${title}`);
  }
  say(`Dependabot alerts read: ${read.alerts.length} open, ${filed.length} ${dry ? "to file" : "filed"}.`);
  return { filed };
}

function main(args) {
  const odd = args.find(a => a !== "--dry");
  if (odd) { console.error(`FAIL: ${odd} is no option of alerts.mjs. Mend: run it with no option, or with --dry`); return 1; }
  const repo = repoOf(spawnSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" }).stdout);
  if (!repo) { console.log("The Dependabot alerts read nothing: this clone's origin is not on github.com."); return 0; }
  reading({ repo, dry: args.includes("--dry") });
  return 0;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
