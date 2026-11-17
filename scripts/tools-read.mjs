// The tools a project's record shows (AGENTS.md of the core, "What can be read is never asked or declared"; #481): which
// tool built each of its last merged pull requests, by the attribution line its description ends with (floor rule 4),
// and which reviewed them, by a review a bot's account posted and by a comment led "Security review:" or "Code review:"
// that ends with an attribution line, each counted once a pull request. Where the manifest's "Tools" table has no row
// for a role, the tools read here come first, most first, then the core's default (tasks/roles.md, "Tools are
// preferences"). It prints what it read, so a wrong reading is seen and a row written over it; it fails nothing and
// changes nothing. The repository: --repo, else GITHUB_REPOSITORY, else origin's address on github.com. gh and Node's
// own modules only.
//
//   node core/scripts/tools-read.mjs [--last <n, 10 where none is given>] [--repo <owner/name>]
import { execFileSync } from "node:child_process";
import { aRepository, logged } from "./guards.mjs";
import { repoOf } from "./inbox.mjs";
import { started } from "./started.mjs";
import { toolOf } from "./stand-in-record.mjs";

export const NONE = "no tool named";
const LED = /^\s*(?:Security|Code) review:/u;

// The counts, from pulls given as [{ body, reviews: [{ login, type, body }], comments: [{ login, type, body }] }]: the
// builders, by the tool each description names, and the reviewers, by the tool each review or review comment names, a
// bot's review by its login; each a list [name, count], most first, ties by name.
export function tally(pulls) {
  const builders = new Map(), reviewers = new Map();
  const add = (map, name) => map.set(name, (map.get(name) ?? 0) + 1);
  for (const p of pulls) {
    add(builders, toolOf(p.body) ?? NONE);
    const by = new Set();
    for (const r of p.reviews ?? []) { const t = toolOf(r.body) ?? (r.type === "Bot" ? r.login : null); if (t) by.add(t); }
    for (const c of p.comments ?? []) { if (!LED.test(String(c.body ?? ""))) continue; const t = toolOf(c.body) ?? (c.type === "Bot" ? c.login : null); if (t) by.add(t); }
    for (const t of by) add(reviewers, t);
  }
  const order = map => [...map].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  return { builders: order(builders), reviewers: order(reviewers) };
}

// The last `n` pull requests merged into the repository, newest first, each with its reviews and comments, as `ask`
// (gh's arguments, its output back) gives them.
export function readPulls(repo, n, ask) {
  const json = args => JSON.parse(ask(["api", ...args]));
  const closed = json([`repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`]);
  const merged = closed.filter(p => p?.merged_at).sort((a, b) => String(b.merged_at).localeCompare(String(a.merged_at))).slice(0, n);
  const people = list => list.map(x => ({ login: String(x?.user?.login ?? ""), type: String(x?.user?.type ?? ""), body: String(x?.body ?? "") }));
  return merged.map(p => ({ number: p.number, body: String(p.body ?? ""),
    reviews: people(json([`repos/${repo}/pulls/${Number(p.number)}/reviews?per_page=100`])),
    comments: people(json([`repos/${repo}/issues/${Number(p.number)}/comments?per_page=100`])) }));
}

// What it prints: the counts, each name as the record writes it, its control characters taken out (floor rule 4: data).
export function said(repo, pulls, { builders, reviewers }) {
  const list = l => (l.length ? l.map(([name, k]) => `${logged(name)} ${k}`).join(", ") : "none");
  return [`the last ${pulls.length} merged pull requests of ${repo}${pulls.length ? ` (#${pulls.at(-1).number} to #${pulls[0].number})` : ""}:`,
    `  built by: ${list(builders)}`, `  reviewed by: ${list(reviewers)}`,
    "where the manifest's \"Tools\" table has no row for a role, these come first, most first, then the core's default (core/tasks/roles.md, \"Tools are preferences\"); a row written there decides"].join("\n");
}

function main(args) {
  const at = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const n = Number(at("--last") ?? 10);
  let repo = at("--repo") ?? process.env.GITHUB_REPOSITORY;
  if (!repo) try { repo = repoOf(execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch { /* (no origin) */ }
  // (nothing read is said so, and the core's default stands: it fails nothing)
  if (!aRepository(repo) || !(Number.isInteger(n) && n > 0)) { console.log("note the record could not be read: give --repo <owner/name> and --last a whole number; the core's default stands (core/tasks/roles.md)"); return 0; }
  const ask = a => execFileSync("gh", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 });
  let pulls;
  try { pulls = readPulls(repo, n, ask); } catch { console.log(`note gh could not read ${repo}'s merged pull requests; the core's default stands (core/tasks/roles.md)`); return 0; }
  console.log(said(repo, pulls, tally(pulls)));
  return 0;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
