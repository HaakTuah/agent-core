// The state report (modules/orchestrating.md, "The scheduled look"; core archive 218): once a month the scheduled look
// (look.mjs, beside this file) opens it, in the core and in every project that takes it. It reports and asks nothing
// (floor rule 14): each measure that keeps a baseline against the last report, the rules by what holds them where a
// script counts them, and what the look keeps open past a week. In a project it ends with its counts for the core,
// counts and conclusions only: the commit its copy holds and how far behind the core's main that is, the steps of a
// release not done, and of the pull requests merged the month before, how many were the core's upkeep (core-cost.mjs,
// beside this file, sorts them). In the core it says that a session adds the projects' part, which --projects prints:
// the repositories the account gh answers for can reach that hold a manifest naming this core, as the owner's or a
// collaborator's (an organisation's that is neither is not read), and any other whose manifest's row *shares its
// counts* says `yes`, each with the counts from its own newest state report; a project of another owner, and a private
// one, is never named, nor is anything of its code or its discussions carried over (core archive 218). It reads only.
// gh, git and Node's own modules.
//
//   node scripts/state-report.mjs --projects                 in the core, where gh answers for the owner's account
//   node scripts/state-report.mjs --projects --repo o/n ...  the same, of the repositories named alone (where gh may
//                                                            not list the account's, as in a cloud session)
import fs from "node:fs";
import path from "node:path";
import { CORE } from "./core-address.mjs";
import { classify } from "./core-cost.mjs";
import { pinOf } from "./core-moved.mjs";
import { ghApi, pagesOf } from "./labels.mjs";
import { ruleFiles } from "./rule-files.mjs";
import { started } from "./started.mjs";

export const TITLE = "State report";
export const COUNTS = "Counts for the core";
export const SHARES = /^\|[ \t]*\*shares its counts\*[ \t]*\|[ \t]*`yes`[ \t]*\|[ \t]*$/m;
export const monthOf = iso => String(iso).slice(0, 7);
// The month before a month ("2026-11" gives "2026-10").
export const before = month => { const [y, m] = month.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };

// The copies check's baseline, as the manifest's *copies check* row names its config: { at, count }, the count of old
// copies (windows) it lists; null where the project keeps none.
export function copies(root, manifest) {
  const config = /^\|[ \t]*\*copies check\*[ \t]*\|.*`([^`]+\.json)`/m.exec(manifest ?? "")?.[1];
  if (!config) return null;
  try {
    const at = JSON.parse(fs.readFileSync(path.join(root, config), "utf8")).baseline;
    const windows = JSON.parse(fs.readFileSync(path.join(root, at), "utf8")).windows ?? {};
    return { at, count: Object.keys(windows).length };
  } catch { return null; }
}

// The pull requests merged in `month` (`pulls`, each { branch, files, ours }) sorted as core-cost.mjs sorts them.
export function share(pulls, rules) {
  const by = { sync: 0, upkeep: 0, update: 0, own: 0 };
  for (const p of pulls) by[classify(p.branch, p.files, rules, p.ours)]++;
  return { all: pulls.length, ...by };
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "none merged");

// The report's text. `core`: whether this is the core's own repository; `previous`: the last report's text, or null;
// `overdue`: [{ number, title, since }]; `counts` (a project): { pin, behind, steps, merged } as readCounts gives them.
export function body({ core, month, measures, previous, overdue, counts = null, scripts }) {
  const was = previous ? /^- copies: (\d+)/m.exec(previous)?.[1] : undefined;
  const lines = [
    `The state of ${core ? "the core" : "this project"} for ${month}, as the scheduled look reads it on its first run of the month (\`${scripts}/state-report.mjs\`). It reports and asks nothing: whatever is due already has its task. A session that reads it files as a task anything it shows that has none, and closes it.`,
    "",
    "**The measures against their baselines**",
    measures ? `- copies: ${measures.count} old copies in its baseline (\`${measures.at}\`)${was === undefined ? "" : `, ${was} at the last report`}.`
      : core ? "- None: in the core's own repository no baseline may stand." : "- None: no measure keeps a baseline here yet.",
    "",
    "**The rules, by what holds them**",
    "- Not counted: no script counts them yet, so the report leaves them out rather than guess.",
    "",
    "**What is overdue**",
    ...(overdue.length ? overdue.map(o => `- #${o.number} ${o.title}: open since ${o.since.slice(0, 10)}.`) : ["- Nothing: no task the look keeps has stood open past a week."]),
  ];
  if (core) lines.push("", "**The projects that take the core**",
    "- Not read by GitHub's job, whose token reaches this repository alone. A session where gh answers for the owner's account runs `node scripts/state-report.mjs --projects` and adds what it prints here as a note; where its tool cannot reach a project, a session started in that project reads it and passes back counts and conclusions alone.");
  if (counts) lines.push("", `**${COUNTS}**`,
    `- copy: ${counts.pin ?? "not read"}${counts.behind === null ? "" : `, ${counts.behind} commits behind the core's main`}.`,
    `- steps not done: ${counts.steps ?? "not read"}.`,
    counts.merged ? `- merged in ${before(month)}: ${counts.merged.all}, the core's share ${pct(counts.merged.sync + counts.merged.upkeep, counts.merged.all)} (sync ${counts.merged.sync}, upkeep ${counts.merged.upkeep}, update ${counts.merged.update}, own ${counts.merged.own}).`
      : `- merged in ${before(month)}: not read (the token here may not read pull requests).`);
  return lines.join("\n");
}

// A project's counts for the core, read through gh: the copy's commit and how far behind the core's main it is, and the
// pull requests merged in the month before `month` with the files each changed. Each part that cannot be read is null.
export function readCounts({ repo, manifest, month, steps, gh = ghApi }) {
  const pin = pinOf(manifest ?? "");
  let behind = null, merged = null;
  try { if (pin) behind = Number(gh(`repos/${CORE}/compare/${pin}...main`, "--jq", ".ahead_by").trim()); } catch { /* (not read) */ }
  if (!Number.isFinite(behind)) behind = null;
  try {
    const from = `${before(month)}-01T00:00:00Z`, to = `${month}-01T00:00:00Z`, pulls = [];
    for (let page = 1; page <= 50; page++) {
      const rows = JSON.parse(gh(`repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`) || "[]");
      for (const p of rows) if (p.merged_at && p.merged_at >= from && p.merged_at < to)
        pulls.push({ number: p.number, branch: p.head?.ref ?? "", ours: String(p.head?.repo?.full_name ?? "").toLowerCase() === repo.toLowerCase() });
      if (rows.length < 100 || rows.every(p => String(p.updated_at) < from)) break;
    }
    for (const p of pulls) p.files = pagesOf(`repos/${repo}/pulls/${p.number}/files`, gh).map(f => f.filename);
    merged = share(pulls, ruleFiles());
  } catch { /* (not read) */ }
  return { pin, behind, steps, merged };
}

// A project's counts for the core, from its state report's text, as one line: each count of its own heading read by a
// whole-line form that holds numbers and fixed words alone, and written anew from what it holds, so no other text of
// the project's reaches the core's report; null where none is in its form. The commit its copy holds is kept only where
// `named` (the owner's public project).
export function countsFrom(text, named) {
  const part = String(text ?? "").split(`**${COUNTS}**`)[1] ?? "";
  const out = [];
  for (const line of part.split(/\r?\n/)) {
    let m;
    if ((m = /^- copy: ([0-9a-f]{40}|not read)(?:, (\d{1,9}) commits behind the core's main)?\.$/.exec(line))) out.push(`copy${named && m[1] !== "not read" ? ` ${m[1]}` : ""}${m[2] ? ` ${m[2]} commits behind the core's main` : m[1] === "not read" ? " not read" : ""}`);
    else if ((m = /^- steps not done: (\d{1,6}|not read)\.$/.exec(line))) out.push(`steps not done: ${m[1]}`);
    else if ((m = /^- merged in (\d{4}-\d\d): (\d{1,6}), the core's share (\d{1,3}%|none merged) \(sync (\d{1,6}), upkeep (\d{1,6}), update (\d{1,6}), own (\d{1,6})\)\.$/.exec(line)))
      out.push(`merged in ${m[1]}: ${m[2]}, the core's share ${m[3]} (sync ${m[4]}, upkeep ${m[5]}, update ${m[6]}, own ${m[7]})`);
    else if ((m = /^- merged in (\d{4}-\d\d): not read /.exec(line))) out.push(`merged in ${m[1]}: not read`);
  }
  return out.length ? out.join("; ") : null;
}

// How a project is shown in the core's public report: by name only the owner's own public project.
export const shownAs = (name, own, isPrivate) => (own && !isPrivate ? `\`${name}\`` : own ? "a private project of the owner's" : "a project of another owner");

// The state report a project's look wrote: the newest issue titled "State report, YYYY-MM" opened by GitHub's job or by
// the project owner's account, never another's.
export const reportOf = (issues, owner) => [...issues].filter(i => /^State report, \d{4}-\d\d$/.test(i.title) && !i.pull_request
  && ["github-actions[bot]", String(owner).toLowerCase()].includes(String(i.user?.login ?? "").toLowerCase())).sort((a, b) => b.title.localeCompare(a.title))[0] ?? null;

// --projects: each project the account reaches, with its kind and the counts from its own newest state report.
function projects(named) {
  const gh = ghApi;
  const account = gh("user", "--jq", ".login").trim();
  const found = new Map();
  if (named.length) for (const name of named) { const r = JSON.parse(gh(`repos/${name}`)); found.set(r.full_name, { private: r.private, owner: r.owner?.login, shared: !r.permissions?.push && String(r.owner?.login).toLowerCase() !== account.toLowerCase() }); }
  else for (const r of pagesOf("user/repos?affiliation=owner,collaborator", gh)) found.set(r.full_name, { private: r.private, owner: r.owner?.login, shared: false });
  if (!named.length) try {
    const hits = JSON.parse(gh("-X", "GET", "search/code", "-f", 'q="shares its counts" filename:core-manifest.md'));
    for (const h of hits.items ?? []) if (!found.has(h.repository.full_name)) found.set(h.repository.full_name, { private: h.repository.private, owner: h.repository.owner?.login, shared: true });
  } catch { console.log("- (GitHub's code search gave no answer: projects that share their counts without giving access are not listed this time.)"); }
  const rows = [];
  for (const [name, r] of found) {
    if (name.toLowerCase() === CORE.toLowerCase()) continue;
    let manifest;
    try { manifest = Buffer.from(JSON.parse(gh(`repos/${name}/contents/core-manifest.md`)).content ?? "", "base64").toString("utf8"); } catch { continue; }
    if (!pinOf(manifest) || (r.shared && !SHARES.test(manifest))) continue;
    const own = String(r.owner).toLowerCase() === account.toLowerCase();
    const shown = shownAs(name, own, r.private);
    let counts = "its counts could not be read here: a session started in it reads its newest state report and passes back the lines under its heading";
    try {
      const report = reportOf(pagesOf(`repos/${name}/issues?state=all&labels=by%3Alook`, gh), r.owner);
      const read = report && countsFrom(report.body, own && !r.private);
      if (read) counts = `from its report of ${report.title.slice(-7)}: ${read}`;
      else if (!report) counts = "it has no state report yet";
    } catch { /* (the default above) */ }
    rows.push(`- ${shown}: ${counts}.`);
  }
  console.log([`**The projects that take the core** (read ${new Date().toISOString().slice(0, 10)} by \`node scripts/state-report.mjs --projects\`, counts and conclusions only)`, ...(rows.length ? rows : ["- None found."])].join("\n"));
}

if (started(import.meta.url)) {
  const [what, ...rest] = process.argv.slice(2);
  const named = rest.filter((a, i) => rest[i - 1] === "--repo");
  if (what !== "--projects" || rest.some((a, i) => a !== "--repo" && rest[i - 1] !== "--repo") || !named.every(n => /^[\w-]+\/[\w.-]+$/.test(n) && !/\/\.+$/.test(n))) {
    console.error("FAIL: it takes --projects, and --repo owner/name for each repository to read in place of the account's (the look writes the monthly report itself)");
    process.exitCode = 1;
  } else try { projects(named); } catch { console.error("FAIL: gh gave no answer here for the account or a repository named: run it where gh answers for the owner's account, or name the repositories it can reach by --repo"); process.exitCode = 1; }
}
