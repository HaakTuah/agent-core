// The merge line's measure (roles/shared/work-flow.md, "Ready pull requests merge in a line"; #702), which the
// monthly state report gives through merge-line.mjs --measure, beside this file: of the last merged pull requests into
// the default branch, the pushes whose checks ran on each, and the minutes from its turn to its merge, its turn the
// later of the merge before it and its last marking ready. Apart from the host's facts and the cancelling, which it
// shares nothing with but its refusal (#1345). gh and Node's own modules.
import { aRepository, parseBounded } from "./guards.mjs";
import { timeOf } from "./moment.mjs";
import { ghApi } from "./labels.mjs";
import { COUNT, lastMerged, median } from "./wait.mjs";

// A refusal, which merge-line.mjs prints as one with its mend, and the reading of what gh answers.
export class Refused extends Error {}
export const refuse = (what, mend) => { throw new Refused(`${what}. Mend: ${mend}`); };
export const json = text => parseBounded(text || "null");

// The times of a pull request's markings ready, read from its timeline: the last, or null where it was never a draft.
function lastReady(repo, n, gh) {
  let last = null;
  for (let page = 1; page <= 10; page++) {
    const rows = json(gh(`repos/${repo}/issues/${n}/timeline?per_page=100&page=${page}`)) ?? [];
    for (const e of rows) if (e?.event === "ready_for_review" && timeOf(e.created_at) !== null) last = Math.max(last ?? 0, timeOf(e.created_at));
    if (rows.length < 100) break;
  }
  return last;
}

// The head commits a pull request's checks were started on, from its branch's runs between its opening and its merge.
function pushesRun(repo, p, gh) {
  const from = timeOf(p.created_at), to = timeOf(p.merged_at), shas = new Set();
  for (let page = 1; page <= 10; page++) {
    const got = json(gh(`repos/${repo}/actions/runs?branch=${encodeURIComponent(p.head.ref)}&event=pull_request&per_page=100&page=${page}`))?.workflow_runs ?? [];
    for (const run of got) { const at = timeOf(run.created_at); if (at !== null && at >= from && at <= to) shas.add(run.head_sha); }
    if (got.length < 100) break;
  }
  return shas.size;
}

// The measure of the last `count` merged pull requests into the default branch: { read, pushes (each one's count),
// minutes (each one's, from its turn to its merge) }.
export function measure({ repo, count = COUNT, gh = ghApi }) {
  if (!aRepository(repo)) refuse(`${JSON.stringify(String(repo)).slice(0, 80)} names no repository`, "name it as <owner>/<name>");
  const branch = json(gh(`repos/${repo}`)).default_branch;
  // (those into the default branch are kept before the sample is cut, so the merge before the oldest is one of them)
  const into = p => Number.isSafeInteger(p.number) && p.base?.ref === branch && timeOf(p.merged_at) !== null && typeof p.head?.ref === "string";
  const merged = lastMerged(repo, count + 1, gh, into)
    .sort((a, b) => timeOf(a.merged_at) - timeOf(b.merged_at));
  const pushes = [], minutes = [];
  merged.forEach((p, i) => {
    if (i === 0 && merged.length > count) return;
    const ready = lastReady(repo, p.number, gh) ?? timeOf(p.created_at);
    const turn = Math.max(ready ?? 0, i > 0 ? timeOf(merged[i - 1].merged_at) : 0);
    minutes.push(Math.max(0, (timeOf(p.merged_at) - turn) / 60000));
    pushes.push(pushesRun(repo, p, gh));
  });
  return { read: pushes.length, pushes, minutes };
}

// The state report's line of the measure.
export function line(m) {
  if (!m?.read) return "- the merge line: not read (no merged pull request could be read).";
  const all = m.pushes.reduce((a, b) => a + b, 0), mins = median(m.minutes.map(x => Math.round(x * 10))) / 10;
  return `- the merge line: of the last ${m.read} merged pull requests, ${all} pushes whose checks ran (a median of ${median(m.pushes)} each), and a median of ${mins.toFixed(1)} min from a pull request's turn to its merge, its turn the later of the merge before it and its last marking ready (\`merge-line.mjs --measure\`).`;
}
