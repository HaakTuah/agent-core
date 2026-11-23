// Which files two merged pull requests each added to within a week, over the last month (#860): the reading the sync
// note setup/sync-notes/740-a-project-s-records-one-file-per-entry.md asks for, to find the records a project splits
// into a folder of one file per entry (core/tasks/planning.md, "Each entry of a busy record stands in a file of its
// own"). It reads the host's record of each pull request merged into the default branch and the files it added lines
// to, never the clone's history, so a shallow clone, a squash, a merge commit and a rebase merge's several commits all
// count one pull request once. Which of the files it lists are records, and which stay whole, is the session's to say.
// It reads only, through gh; Node's own modules.
//
//   node core/scripts/busy-records.mjs                       from a project's root, the last 31 days
//   node core/scripts/busy-records.mjs --repo owner/name --days 35
import { mergedIn } from "./cited.mjs";
import { repoOf } from "./core-cost.mjs";
import { ghApi, pagesOf } from "./labels.mjs";
import { started } from "./started.mjs";

const DAY = 864e5, WEEK = 7 * DAY;

// The files `pull` added lines to, as the host lists them (a file only deleted from, or removed, adds no entry).
export const addedTo = (repo, pull, gh = ghApi) =>
  pagesOf(`repos/${repo}/pulls/${pull}/files`, gh).filter(f => f.status !== "removed" && f.additions > 0).map(f => f.filename);

// Each file two pull requests merged within a week of each other both added to: [{ file, pulls: [number] }], the
// pulls of every such pair, oldest merge first; the files by name. `merged` is [{ number, at, files }].
export function busy(merged) {
  const by = new Map();
  for (const p of merged) for (const f of new Set(p.files)) by.set(f, [...(by.get(f) ?? []), p]);
  const out = [];
  for (const [file, list] of by) {
    const sorted = list.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)), pulls = new Set();
    for (let i = 1; i < sorted.length; i++)
      if (Date.parse(sorted[i].at) - Date.parse(sorted[i - 1].at) <= WEEK) pulls.add(sorted[i - 1].number).add(sorted[i].number);
    if (pulls.size) out.push({ file, pulls: sorted.map(p => p.number).filter(n => pulls.has(n)) });
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

// What is read of `repo` for the `days` before `now`: the pull requests merged into its default branch, each with the
// files it added to.
export function read(repo, days, now = Date.now(), gh = ghApi) {
  const to = new Date(now).toISOString(), from = new Date(now - days * DAY).toISOString();
  const base = JSON.parse(gh(`repos/${repo}`)).default_branch;
  return mergedIn(repo, from, to, gh).filter(p => p.base?.ref === base)
    .map(p => ({ number: p.number, at: p.merged_at, files: addedTo(repo, p.number, gh) }));
}

// The lines it prints.
export const report = (found, merged, days) => [
  `${merged} pull request(s) merged into the default branch in the last ${days} days; ${found.length} file(s) two of them added to within a week:`,
  ...found.map(f => `  ${f.file}  (#${f.pulls.join(", #")})`),
];

if (started(import.meta.url)) {
  const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
  const repo = arg("--repo") ?? repoOf(), days = Number(arg("--days") ?? 31);
  if (!repo || !(Number.isInteger(days) && days > 0)) {
    console.error(`FAIL: busy-records: ${repo ? `--days ${arg("--days")} is no whole number of days` : "no repository named, and none read from this clone"}. Mend: run it from the project's root, or give --repo owner/name and --days <a whole number>`);
    process.exit(1);
  }
  try {
    const merged = read(repo, days);
    for (const l of report(busy(merged), merged.length, days)) console.log(l);
  } catch (e) {
    console.error(`FAIL: busy-records: the host's record of ${repo}'s pull requests could not be read: ${String(e.message ?? e).split("\n")[0]}. Mend: sign gh in for the repository and run it again; where the project's host is not GitHub, read the same from the host's own list of the merged pull requests and their files`);
    process.exit(1);
  }
}
