// The trial of #767 (the core's AGENTS.md, "A bug fix and a rework of tests are built on Sonnet"): of the pull requests
// merged from --since on (by default 18 November 2026), those whose work is a bug fix or a rework of tests, by the model
// that built them, Sonnet or Opus, with what review-record.mjs, beside this file, reads of each. A pull request's
//   kind      is "bug fix" where a line of its description says "Fixes #n" (or Closes, Resolves) of an issue labelled
//             `bug`, else "tests" where more than half of the lines it changes lie under tests/; a line "Trial kind:
//             bug fix", "tests" or "neither" in its description overrides what was read;
//   builder   is the one of Sonnet and Opus its description's first line names (a Sonnet builder's says so:
//             tools/claude.md, "Who to call"), else the one of them its session-cost line names alone; else not read.
// For each kind and builder it prints the pull requests and the mean, per pull request, of the blocking points its
// reviews raised (each of review-record.mjs's five; a pull request with a review that ran and was not read is left out
// of it), its rounds of review, the bugs tied to it that reached `main` all the same, and what its session-cost line
// rose by (core-cost.mjs, priced: answers, output and tokens carried in), each over the pull requests it could be read
// for; then, for each measure, whether Sonnet's comes out worse than Opus's, of the first three alone: its mean above
// Opus's by more than twice the standard error of the difference. It reads; it writes nothing. Git, gh and Node's own
// modules.
//
//   node core/scripts/builder-trial.mjs [--since YYYY-MM-DD] [--owner login]
import { execFileSync } from "node:child_process";
import { DAY, grid, priced, readings } from "./core-cost.mjs";
import { REVIEWS, bugs, gather, perPull, reviewEvents } from "./review-record.mjs";
import { roundsOf } from "./review-rounds.mjs";
import { started } from "./started.mjs";
import { pages } from "./stand-in-record.mjs";

export const SINCE = "2026-11-18", WANTED = 20;
export const KINDS = ["bug fix", "tests"], BUILDERS = ["Sonnet", "Opus"];
const MEASURES = [["blocking", "blocking points"], ["rounds", "rounds"], ["bugs", "bugs that reached main"],
  ["answers", "answers"], ["out", "output tokens"], ["into", "tokens carried in"]];
const DECIDE = MEASURES.slice(0, 3); // (the cost is given beside them, and decides nothing: a token of Sonnet's costs less than one of Opus's)

const lines = body => String(body ?? "").replaceAll("\r", "").split("\n");

// The one of BUILDERS `text` names, or null where it names neither or both.
const oneOf = text => { const said = BUILDERS.filter(b => new RegExp(`\\b${b}\\b`, "u").test(text)); return said.length === 1 ? said[0] : null; };

// The blocking points of a pull request's reviews (review-record.mjs's perPull), or null where one that ran was not
// read: an unknown is never counted as none.
export const blockingOf = reviews => REVIEWS.some(([key]) => reviews[key].blocked === "unread") ? null : REVIEWS.reduce((s, [key]) => s + reviews[key].points, 0);

// Who built a pull request, from its description: the first line's builder, else the cost line's, else null.
export function builderOf(body) {
  const first = lines(body).find(l => l.trim()) ?? "";
  const cost = lines(body).find(l => l.startsWith("Session so far: "));
  return oneOf(first) ?? (cost ? oneOf(/\(([^)]*)\)/u.exec(cost)?.[1] ?? "") : null);
}

// The kind of a pull request's work, from its description, the issues labelled `bug` (a Set of their numbers) and the
// lines it changes ({ tests, all }): "bug fix", "tests" or null.
export function kindOf(body, bugIssues, changed) {
  const said = lines(body).map(l => /^Trial kind: (bug fix|tests|neither)\s*$/u.exec(l.trim())?.[1]).filter(Boolean).at(-1);
  if (said) return said === "neither" ? null : said;
  const fixes = lines(body).flatMap(l => [...l.matchAll(/\b(?:Fix(?:e[sd])?|Close[sd]?|Resolve[sd]?) #([1-9]\d{0,8})\b/giu)].map(m => Number(m[1])));
  if (fixes.some(n => bugIssues.has(n))) return "bug fix";
  return changed && changed.all > 0 && changed.tests * 2 > changed.all ? "tests" : null;
}

// The lines a merge changes, all and those under tests/, from `git diff --numstat` of its first parent.
export function changedOf(numstat) {
  const out = { tests: 0, all: 0 };
  for (const row of String(numstat).split("\n").filter(Boolean)) {
    const [add, del, file] = row.split("\t");
    if (!/^\d+$/.test(add) || !/^\d+$/.test(del)) continue; // (a binary file has no lines)
    const n = Number(add) + Number(del);
    out.all += n;
    if (file.startsWith("tests/")) out.tests += n;
  }
  return out;
}

const mean = ns => ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : null;
const variance = ns => { const m = mean(ns); return ns.length > 1 ? ns.reduce((s, n) => s + (n - m) ** 2, 0) / (ns.length - 1) : null; };

// Whether `sonnet`'s numbers come out worse (higher) than `opus`'s: "worse", by how much, where its mean is above
// Opus's by more than twice the standard error of the difference, "no worse within noise" where not, "too few to
// tell" where either has fewer than two.
export function verdict(sonnet, opus) {
  if (sonnet.length < 2 || opus.length < 2) return "too few to tell";
  const diff = mean(sonnet) - mean(opus), se = Math.sqrt(variance(sonnet) / sonnet.length + variance(opus) / opus.length);
  return diff > 2 * se && diff > 0 ? `worse, by ${diff.toFixed(2)} a pull request` : "no worse within noise";
}

// The printout, from `pulls` as { number, kind, builder, blocking, rounds, bugs, answers, out, into } (a measure null
// where it was not read).
export function print(repo, since, pulls) {
  const fmt = n => n === null ? "-" : Number.isInteger(n) ? String(n) : n.toFixed(1);
  const of = (kind, builder) => pulls.filter(p => p.kind === kind && p.builder === builder);
  const values = (ps, key) => ps.map(p => p[key]).filter(v => v !== null);
  const sonnet = pulls.filter(p => p.builder === "Sonnet").length, unread = pulls.filter(p => p.builder === null);
  const out = [`The trial of #767 in ${repo}, from ${since}: bug fixes and reworks of tests, by who built them. Sonnet built ${sonnet} of the ${WANTED} the trial waits for.`,
    "Each a mean per pull request, over those it was read for (how many: in brackets).", ""];
  out.push(grid([["", "pull requests", ...MEASURES.map(([, name]) => name)],
    ...KINDS.flatMap(kind => BUILDERS.map(builder => { const ps = of(kind, builder);
      return [`${kind}, ${builder}`, String(ps.length), ...MEASURES.map(([key]) => { const v = values(ps, key); return v.length ? `${fmt(mean(v))} (${v.length})` : "-"; })]; }))]));
  out.push("", "Sonnet against Opus, both kinds together, on what decides the trial: a measure is worse where Sonnet's mean is above Opus's by more than twice the standard error of the difference.");
  for (const [key, name] of DECIDE) out.push(`- ${name}: ${verdict(values(pulls.filter(p => p.builder === "Sonnet"), key), values(pulls.filter(p => p.builder === "Opus"), key))}`);
  if (unread.length) out.push("", `Builder not read (no first line naming Sonnet or Opus, nor a cost line naming one alone): ${unread.map(p => `#${p.number}`).join(", ")}`);
  return out.join("\n");
}

function main(args) {
  const fail = msg => { console.error(`FAIL: ${msg}`); process.exit(1); };
  const value = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
  const since = value("--since") ?? SINCE, by = value("--owner");
  if (!DAY.test(since)) fail("--since takes a day, YYYY-MM-DD");
  if (args.includes("--owner") && !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(by ?? "")) fail("--owner needs the owner's account after it");
  const { repo, merged, owner, issueComments, issues, labelled, of, commitsOf } = gather(since, by, fail);
  const rows = pages(`repos/${repo}/pulls?state=all&sort=created&direction=desc`, ".[] | [.number, (.head.repo.full_name // \"\"), (.body // \"\")] | @json");
  const bodies = new Map(rows.map(([number, , body]) => [number, body]));
  const took = priced(readings(rows, repo, Math.min(...merged.map(m => m.number))));
  const bugSet = new Set(labelled.map(b => b.number));
  const tied = bugs(issues, issueComments, new Map(merged.map(m => [m.number, m])), owner).byPull;
  const pulls = [];
  for (const m of merged) {
    const body = bodies.get(m.number) ?? "";
    const kind = kindOf(body, bugSet, changedOf(execFileSync("git", ["diff", "--numstat", "--no-renames", `${m.sha}^1`, m.sha], { encoding: "utf8" })));
    if (!kind) continue;
    const reviews = perPull(...of(m)), commits = commitsOf(m.number), cost = took.get(m.number) ?? null;
    pulls.push({ number: m.number, kind, builder: builderOf(body),
      blocking: blockingOf(reviews),
      rounds: commits ? roundsOf(reviewEvents(...of(m)), commits).rounds : null,
      bugs: tied.get(m.number) ?? 0, answers: cost?.answers ?? null, out: cost?.out ?? null, into: cost?.into ?? null });
  }
  console.log(print(repo, since, pulls));
}

if (started(import.meta.url)) main(process.argv.slice(2));
