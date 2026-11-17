// The tools a project's record shows (AGENTS.md of the core, "What can be read is never asked or declared"; #481): which
// tool built each of its last merged pull requests, by the attribution line its description ends with (floor rule 4),
// and which reviewed them, by a review a bot's account posted and by a comment led "Security review:" or "Code review:"
// that ends with an attribution line, each counted once a pull request. Only what the *owner's account* or a bot's
// account wrote counts (floor rule 4: anyone else's text is data, and names no tool here): a pull request another
// account opened, and a review or comment of another person's, are passed over. The owner's account: the manifest's
// row, else the repository's own account where the host says a person holds it (releases.mjs); where neither is read,
// only bots count. Where the manifest's "Tools" table has no
// "Builder" row, the tools that built come first, most first, then the core's default, and a tool shown reviewing is at
// hand (tasks/roles.md, "Tools are preferences"). It prints what it read, so a wrong reading is seen and a row written over it; it fails nothing and
// changes nothing. The repository: --repo, else GITHUB_REPOSITORY, else origin's address on github.com. gh and Node's
// own modules only.
//
//   node core/scripts/tools-read.mjs [--last <n, 10 where none is given>] [--repo <owner/name>]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { aRepository, logged } from "./guards.mjs";
import { repoOf } from "./inbox.mjs";
import { hostSaid, ownerOf } from "./releases.mjs";
import { started } from "./started.mjs";
import { toolOf } from "./stand-in-record.mjs";

export const NONE = "no tool named";
const LED = /^\s*(?:Security|Code) review:/u;

// Whether `x` ({ login, type }) is the owner's account (`owner`, any case; null where it was not read) or a bot's.
const trusted = (x, owner) => x?.type === "Bot" || (typeof owner === "string" && String(x?.login ?? "").toLowerCase() === owner.toLowerCase());

// The counts, from pulls given as [{ login, type, body, reviews: [{ login, type, body }], comments: [...] }], of what
// the owner's account (`owner`) or a bot wrote: the builders, by the tool each description names, and the reviewers, by
// the tool each review or review comment names, a bot's review by its login; each a list [name, count], most first,
// ties by name; and how many pull requests another account opened, passed over.
export function tally(pulls, owner = null) {
  const builders = new Map(), reviewers = new Map();
  const add = (map, name) => map.set(name, (map.get(name) ?? 0) + 1);
  let others = 0;
  for (const p of pulls) {
    if (!trusted(p, owner)) { others++; continue; }
    add(builders, toolOf(p?.body) ?? NONE);
    for (const t of reviewedBy(p ?? {}, owner)) add(reviewers, t);
  }
  const order = map => [...map].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  return { builders: order(builders), reviewers: order(reviewers), others };
}

// The tools that reviewed one pull request, each once: a review's attribution line, else a bot's login; and a comment led
// "Security review:" or "Code review:" the same way.
function reviewedBy(p, owner) {
  const tool = x => toolOf(x?.body) ?? (x?.type === "Bot" ? String(x.login ?? "") : null);
  const led = (p.comments ?? []).filter(c => LED.test(String(c?.body ?? "")));
  return new Set([...(p.reviews ?? []), ...led].filter(x => trusted(x, owner)).map(tool).filter(Boolean));
}

// The last `n` pull requests merged into the repository, newest first, each with its reviews and comments, as `ask`
// (gh's arguments, its output back) gives them.
export function readPulls(repo, n, ask) {
  const json = args => JSON.parse(ask(["api", ...args]));
  const closed = json([`repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`]);
  const merged = closed.filter(p => p?.merged_at).sort((a, b) => String(b.merged_at).localeCompare(String(a.merged_at))).slice(0, n);
  const people = list => list.map(x => ({ login: String(x?.user?.login ?? ""), type: String(x?.user?.type ?? ""), body: String(x?.body ?? "") }));
  return merged.map(p => ({ number: p.number, login: String(p?.user?.login ?? ""), type: String(p?.user?.type ?? ""), body: String(p.body ?? ""),
    reviews: people(json([`repos/${repo}/pulls/${Number(p.number)}/reviews?per_page=100`])),
    comments: people(json([`repos/${repo}/issues/${Number(p.number)}/comments?per_page=100`])) }));
}

// What it prints: the counts, each name as the record writes it, its control characters taken out (floor rule 4: data).
export function said(repo, pulls, { builders, reviewers, others = 0 }, owner = null) {
  const list = l => (l.length ? l.map(([name, k]) => `${logged(name)} ${k}`).join(", ") : "none");
  return [`the last ${pulls.length} merged pull requests of ${repo}${pulls.length ? ` (#${pulls.at(-1).number} to #${pulls[0].number})` : ""}, as the owner's account (${owner ? logged(owner) : "not read: bots' alone count"}) and bots wrote them${others ? `; ${others} another account opened, passed over` : ""}:`,
    `  built by: ${list(builders)}`, `  reviewed by: ${list(reviewers)}`,
    "where the manifest's \"Tools\" table has no \"Builder\" row, the tools that built come first, most first, then the core's default, and a tool shown reviewing is at hand (core/tasks/roles.md, \"Tools are preferences\"); a row written there decides"].join("\n");
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
  let manifest = "";
  try { manifest = fs.readFileSync("core-manifest.md", "utf8"); } catch { /* (the core's own repository holds none) */ }
  const owner = ownerOf(manifest, hostSaid());
  console.log(said(repo, pulls, tally(pulls, owner), owner));
  return 0;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
