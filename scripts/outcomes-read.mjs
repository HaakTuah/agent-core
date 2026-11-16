// The outcomes' reading (outcomes.mjs, beside this file, holds the measures and says what each reads): what GitHub
// gives of a repository, through gh, page by page, as the measures take it, and the lines the monthly state report
// (state-report.mjs) leads with. Of the SAMPLE newest merged tasks of the span it reads each one's commits, and, for a
// commit after the pull request was ready that no finding came before, the checks of the commit before it. It reads
// only. gh and Node's own modules.
//
//   node scripts/outcomes-read.mjs --repo owner/name --month YYYY-MM     the lines for a month (the state report's)
//   node scripts/outcomes-read.mjs --repo owner/name --from YYYY-MM-DD --to YYYY-MM-DD [--corrections file.json]
//                                       a fixed span, as the first reading took it, the corrections given as
//                                       [{ at, pull, kind }] where they were found by reading, and with
//                                       --root <folder> how the code grows in that checkout
import fs from "node:fs";
import { blockingOf, codexFind, otherOf, postedKind } from "./review-record.mjs";
import { priced, reading as costOf, sessionOf } from "./core-cost.mjs";
import { reading as shapeReading, rulesOf } from "./dose.mjs";
import { ghApi, pagesOf } from "./labels.mjs";
import { FIRST, LABEL, MEASURES, MONTHS, SAMPLE, corrections, growth, lines, measure, same, windowOf } from "./outcomes.mjs";
import { started } from "./started.mjs";

const CLOSES = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?) #(\d{1,9})\b/giu;

// What is read of `repo` from `from` to `to` (ms), through gh, as the measures take it.
export function read(repo, from, to, owner = repo.split("/")[0], gh = ghApi) {
  const iso = new Date(from).toISOString().replace(/\.\d{3}Z$/u, "Z");
  const pulls = [];
  for (let page = 1; page <= 200; page++) {
    const rows = JSON.parse(gh(`repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=100&page=${page}`) || "[]");
    pulls.push(...rows);
    if (rows.length < 100 || rows.every(p => String(p.created_at) < iso)) break;
  }
  const issues = pagesOf(`repos/${repo}/issues?state=all&since=${iso}`, gh).filter(i => !i.pull_request);
  const comments = pagesOf(`repos/${repo}/issues/comments?since=${iso}&sort=created&direction=asc`, gh).map(c => ({ issue: Number(String(c.issue_url).split("/").at(-1)), at: c.created_at, login: c.user?.login, user: c.user, body: c.body ?? "" }));
  const inline = pagesOf(`repos/${repo}/pulls/comments?since=${iso}&sort=created&direction=asc`, gh).map(c => ({ pull: Number(String(c.pull_request_url).split("/").at(-1)), at: c.created_at, user: c.user, body: c.body ?? "", in_reply_to_id: c.in_reply_to_id ?? null }));
  const events = [];
  for (let page = 1; page <= 300; page++) {
    const rows = JSON.parse(gh(`repos/${repo}/issues/events?per_page=100&page=${page}`) || "[]");
    events.push(...rows.map(e => ({ event: e.event, at: e.created_at, number: e.issue?.number, label: e.label?.name ?? null })));
    if (rows.length < 100 || rows.every(e => String(e.created_at) < iso)) break;
  }
  return gather({ repo, owner, to, pulls, issues, comments, inline, events, gh });
}

// The data the measures read, from what GitHub gave (and, for the sample's commits and checks, `gh`): the sample the
// SAMPLE newest merged tasks before `to` (ms).
export function gather({ repo, owner, to = Infinity, pulls, issues, comments, inline, events, gh = null }) {
  const labelled = new Map(issues.map(i => [i.number, (i.labels ?? []).map(l => (typeof l === "string" ? l : l.name))]));
  const { merged, reverts } = merges(repo, pulls, labelled);
  const joined = new Map();
  for (const e of [...events].sort((a, b) => String(a.at).localeCompare(String(b.at)))) if (e.event === "labeled" && e.label === "queued" && !joined.has(e.number)) joined.set(e.number, e.at);
  const done = issues.filter(i => i.state === "closed" && i.state_reason === "completed");
  const queued = done.filter(i => joined.has(i.number)).map(i => ({ joined: joined.get(i.number), done: i.closed_at }));
  const bugs = done.filter(i => (labelled.get(i.number) ?? []).includes("bug")).map(i => ({ at: i.created_at, closed: i.closed_at }));
  const sample = merged.filter(p => Date.parse(p.when) < to).sort((a, b) => b.when.localeCompare(a.when)).slice(0, SAMPLE).map(p => sampled(p, { repo, owner, comments, inline, events, gh }));
  return { merged, reverts, queued, bugs, sample, corrections: corrections(issues, comments, owner) };
}

// The merged tasks, Dependabot's left out, each with whether it closes a bug or a correction (`labelled`: each issue's
// label names) and what it was priced at; and the reverts, each with the pull request it undid.
function merges(repo, pulls, labelled) {
  const took = priced(pulls.filter(p => same(p.head?.repo?.full_name, repo)).map(p => ({ number: p.number, session: sessionOf(p.body), reading: costOf(p.body) })));
  const mends = body => [...String(body ?? "").matchAll(CLOSES)].some(m => (labelled.get(Number(m[1])) ?? []).some(l => l === "bug" || l === LABEL));
  const merged = pulls.filter(p => p.merged_at && !same(p.user?.login, "dependabot[bot]")).map(p => ({ number: p.number, when: p.merged_at, created: p.created_at, mends: mends(p.body), took: took.get(p.number) ?? null }));
  const reverts = pulls.filter(p => p.merged_at && /^Revert "/u.test(p.title ?? "")).map(p => ({ when: p.merged_at, of: Number(/\bReverts [\w.-]+\/[\w.-]+#(\d{1,9})\b/u.exec(p.body ?? "")?.[1] ?? NaN) }));
  return { merged, reverts };
}

// One pull request of the sample: its events, and each commit after it was ready by cause.
function sampled(p, { repo, owner, comments, inline, events, gh }) {
  const mine = [...comments.filter(c => c.issue === p.number), ...inline.filter(c => c.pull === p.number)];
  const own = events.filter(e => e.number === p.number);
  const ready = own.filter(e => e.event === "ready_for_review" && e.at <= p.when).map(e => e.at).sort().at(-1) ?? p.created;
  let commits = [];
  try { commits = gh ? pagesOf(`repos/${repo}/pulls/${p.number}/commits`, gh).map(c => ({ sha: c.sha, at: c.commit?.committer?.date, base: (c.parents ?? []).length > 1 })) : []; } catch { commits = []; }
  const found = mine.filter(c => codexFind(c) || (same(c.user?.login, owner) && ["security", "code", "design"].includes(postedKind(c.body)) && ((blockingOf(c.body) ?? 0) + (otherOf(c.body) ?? 0)) > 0)).map(c => c.at);
  const after = [];
  commits.forEach((c, i) => {
    if (!(c.at > ready)) return;
    if (c.base) { after.push("base"); return; }
    const before = i ? commits[i - 1] : null, since = before && before.at > ready ? before.at : ready;
    if (found.some(at => at > since && at <= c.at)) after.push("finding");
    else if (before && failedOn(repo, before.sha, gh)) after.push("check");
    else after.push("neither");
  });
  return { ...p, events: [...mine.map(c => c.at), ...own.map(e => e.at), ...commits.map(c => c.at)].filter(Boolean), after };
}
const failedOn = (repo, sha, gh) => { try { return JSON.parse(gh(`repos/${repo}/commits/${sha}/check-runs?per_page=100`)).check_runs?.some(r => r.conclusion === "failure") ?? false; } catch { return false; } };

// The first reading's texts for `repo`, by key, from the core's file; null where it holds none for it.
export function firstOf(repo, root = ".") {
  try { return JSON.parse(fs.readFileSync(`${root}/${FIRST}`, "utf8")).repos?.[repo] ?? null; } catch { return null; }
}

// The lines for the state report of `repo` for `month`; one line that says why where GitHub did not answer.
export function report({ repo, month, manifest = null, root = ".", previous = null, share = null, gh = ghApi }) {
  let data;
  try { data = read(repo, windowOf(month, MONTHS).from, windowOf(month).to, repo.split("/")[0], gh); }
  catch { return [`- Not read: GitHub did not answer for the pull requests, issues and events of ${month} (the look's job needs \`issues: read\` and \`pull-requests: read\`).`]; }
  let grown = null;
  try { grown = growth(shapeReading(rulesOf(manifest, root).rules, root), root); } catch { grown = null; }
  return lines({ rows: measure(data, month), grown, share, first: firstOf(repo, root), previous });
}

// How the code grows in the project at `root` (its manifest's shape check, or the core's AGENTS.md where it has no
// manifest); null where it cannot be read.
export function grownAt(root) {
  let manifest = null;
  try { manifest = fs.readFileSync(`${root}/core-manifest.md`, "utf8"); } catch { /* the core's own */ }
  try { return growth(shapeReading(rulesOf(manifest, root).rules, root), root); } catch { return null; }
}

if (started(import.meta.url)) {
  const args = process.argv.slice(2), at = f => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  const repo = at("--repo"), month = at("--month"), from = at("--from"), to = at("--to"), given = at("--corrections"), dir = at("--root");
  const day = /^\d{4}-\d\d-\d\d$/u;
  if (!/^[\w-]+\/(?!\.+$)[\w.-]+$/u.test(repo ?? "") || !(month ? /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(month) : day.test(from ?? "") && day.test(to ?? "")) || (args.includes("--root") && !fs.existsSync(dir ?? ""))) {
    console.error("FAIL: it takes --repo owner/name and either --month YYYY-MM or --from and --to YYYY-MM-DD, and --root only with a folder that stands. Mend: name the repository and the span, as `node scripts/outcomes-read.mjs --repo owner/name --month 2026-10`");
    process.exitCode = 1;
  } else if (month) console.log(report({ repo, month }).join("\n"));
  else {
    const w = { from: Date.parse(`${from}T00:00:00Z`), to: Date.parse(`${to}T00:00:00Z`) };
    const data = read(repo, w.from, w.to);
    if (given) data.corrections = JSON.parse(fs.readFileSync(given, "utf8"));
    const rows = MEASURES.map(m => ({ key: m.key, outcome: m.outcome, direct: m.direct, label: m.label, text: m.of(data, w).text, months: 1 }));
    const grown = dir ? grownAt(dir) : null;
    console.log(lines({ rows, grown }).join("\n"));
    console.log(JSON.stringify(Object.fromEntries([...rows.map(r => [r.key, r.text]), ...(grown ? [["size", `${grown.kb} KB in ${grown.files} files, ${grown.large} of them over 20 KB`], ["functions", Object.entries(grown.over).map(([k, n]) => `${n} over ${grown.marks[k]} ${k}`).join(", ")]] : [])])));
  }
}
