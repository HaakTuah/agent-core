// What a pull request waits on (modules/tests.md, "What a push waits on has a time mark"; #321), for every project
// that takes the core: of the pull requests merged last, the time the checks of each one's last push took, from the
// first check's start to the last one's end, and their median, held to the mark the shape check's config gives under
// "wait" (shape.mjs, beside this file, which lets the mark rise only as a suite's does). It reports and fails nothing:
// the monthly state report says the median beside its mark (state-report.mjs), and the session that reads a median
// past it files the task that brings it down.
//
//   node core/scripts/wait.mjs [<config>] --repo <owner>/<name> [--count <n>]
//       the last n merged pull requests (30 where none is given), through gh. Reads only; gh and Node's own modules.
import fs from "node:fs";
import { ghApi } from "./labels.mjs";
import { notLinked, parseConfig, where } from "./shape.mjs";
import { started } from "./started.mjs";

class Refused extends Error {}
const refuse = (what, mend) => { throw new Refused(`${what}. Mend: ${mend}`); };
export const COUNT = 30;

// The seconds the checks of one push took: from the first one's start to the last one's end, of those that ran to an
// end (one skipped or not started counts nothing); null where none did.
export function waited(checks) {
  const ran = checks.filter(c => c.started_at && c.completed_at && c.conclusion !== "skipped");
  if (!ran.length) return null;
  const from = Math.min(...ran.map(c => Date.parse(c.started_at))), to = Math.max(...ran.map(c => Date.parse(c.completed_at)));
  return Math.max(0, Math.round((to - from) / 1000));
}

export const median = xs => { const s = [...xs].sort((a, b) => a - b), k = s.length >> 1; return s.length ? (s.length % 2 ? s[k] : Math.round((s[k - 1] + s[k]) / 2)) : null; };

// The median wait of the last `count` merged pull requests of `repo`, read through `gh`: { median, read, mark }, mark
// the config's, or undefined where it gives none.
export function measure({ repo, count = COUNT, mark, gh = ghApi }) {
  // (newest updated first: a pull request is updated when it merges, so once a page's last update is older than the
  // count-th newest merge read, no later page holds a newer one)
  const merged = [], kth = () => merged.map(p => p.merged_at).sort().reverse()[count - 1];
  for (let page = 1; page <= 10; page++) {
    const rows = JSON.parse(gh(`repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`) || "[]");
    merged.push(...rows.filter(p => p.merged_at));
    if (rows.length < 100 || (merged.length >= count && String(rows.at(-1).updated_at) < kth())) break;
  }
  const times = merged.sort((a, b) => b.merged_at.localeCompare(a.merged_at)).slice(0, count)
    .map(p => waited(JSON.parse(gh(`repos/${repo}/commits/${p.head.sha}/check-runs?per_page=100`) || "{}").check_runs ?? [])).filter(t => t !== null);
  return { median: median(times), read: times.length, mark };
}

// The line the state report gives: the median against its mark.
export function line(m) {
  if (m.median === null) return `- what a push waits on: not read (no merged pull request's checks could be read).`;
  const minutes = s => `${(s / 60).toFixed(1)} min`;
  const against = m.mark === undefined ? "; the shape check's config gives no mark under \"wait\"" : m.median > m.mark ? `, past its mark of ${minutes(m.mark)}: a task brings it down (modules/tests.md)` : `, within its mark of ${minutes(m.mark)}`;
  return `- what a push waits on: ${minutes(m.median)}, the median of the last ${m.read} merged pull requests' checks${against}.`;
}

function main(argv) {
  const named = argv[0] && !argv[0].startsWith("--") ? argv[0] : null, rest = named ? argv.slice(1) : argv;
  const opt = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
  const repo = opt("--repo"), count = Number(opt("--count") ?? COUNT);
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repo ?? "") || !(Number.isInteger(count) && count > 0)) refuse("no repository was named, or the count is no whole number", "run node core/scripts/wait.mjs [<config>] --repo <owner>/<name> [--count <n>]");
  const rules = ["core-manifest.md", "AGENTS.md"].find(f => fs.existsSync(f)), at = named ?? where(rules ? fs.readFileSync(rules, "utf8") : "");
  let mark;
  try { mark = fs.existsSync(notLinked(at)) ? parseConfig(fs.readFileSync(at, "utf8"), at).wait : undefined; } catch { mark = undefined; }
  console.log(line(measure({ repo, count, mark })));
  return 0;
}

if (started(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { if (!(e instanceof Refused)) throw e; console.error(`FAIL: ${e.message}`); process.exitCode = 1; }
}
