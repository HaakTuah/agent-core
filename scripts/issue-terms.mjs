// Nothing personal, ever (floor rule 11), in what no pull request holds (#783): the personal-terms check
// (.github/workflows/personal-terms.yml) reads a pull request while it is open, and this reads the rest of what a
// repository's sessions and owner write on GitHub. Of the texts written or edited in the last DAYS days (a run each day,
// with a week to spare for runs missed), it reads each issue's title and description, each pull request's title and
// description once it is merged or closed, and each comment: on an issue or a pull request, a review's, and a review's
// inline ones. It takes each listed term out of the text, "[…]" in its place, through GitHub's own edit of that text.
// The terms are those of the personal-terms check, the Actions secret PERSONAL_TERMS given as TERMS, read as that check
// reads them: one a line, the blanks around it no part of it, matched in any case, a Claude Code session's link id left
// out (tests/issue-terms-test.mjs holds the two in step). It prints no term and no text, and in a job no place where one
// stood, since a job's log is as public as its repository: only counts, and the mend. Without TERMS it reads nothing
// and says so. It fails nothing (exit 0), save a wrong option or no repository to read.
//
// GitHub keeps each earlier version of a description or a comment, shown to every reader, until someone with write
// access deletes it by hand (the text's "edited" menu); an issue's old title stays in its timeline, which no one can
// delete. So where a term was taken out, the owner learns where in private: a session the owner works with runs this
// with --private, signed in to gh as the owner, which takes out the same and names, in that session's own chat alone,
// each text it changed or could not, and each whose kept versions still hold a term. A job's token may edit only what
// its workflow grants (the core's look.yml grants issues, not pull requests), so a text it may not edit is counted, and
// --private takes it out. Run by the daily look's job (the core's look.yml, and own-look.yml here), from a repository's
// root. gh and Node's own modules.
//
//   TERMS=... node core/scripts/issue-terms.mjs              what a job runs: counts alone
//   TERMS=... node core/scripts/issue-terms.mjs --private    in a session the owner works with, never a job: names them
//   ... --days N                                             N days back in place of DAYS (a first run: --days 36500)
//   ... --dry                                                takes nothing out; says what it would
import { spawnSync } from "node:child_process";
import { repoOf } from "./inbox.mjs";
import { ghApi, pagesOf } from "./labels.mjs";
import { started } from "./started.mjs";

export const DAYS = 8;
export const MARK = "[…]";

// The terms, as the personal-terms check reads its list: one a line, the blanks around each (a carriage return among
// them) no part of it, and no empty one.
export const termsOf = raw => String(raw ?? "").split("\n").map(t => t.trim()).filter(Boolean);

// A Claude Code session's link, of its one shape alone, as the personal-terms check's `link` reads it: its random id
// (the 22 characters of base58 after session_01) is no one's personal information and is not read; a whole link,
// starting a line or after a blank or an opening mark, and ending at a blank, a mark of punctuation or the line's end.
const LINK = /(?<=^|[\s(<\["`])https:\/\/claude\.ai\/code\/session_01([1-9A-HJ-NP-Za-km-z]{22})(?=[\s.,;:!?)>"`/*]|$)/gmu;
const ids = text => [...text.matchAll(LINK)].map(m => { const from = m.index + m[0].length - 22; return [from, from + 22]; });
const escape = t => t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

// Each place a term stands in `text`, as [from, to], leftmost first, the longest term where two start at one place; none
// inside a session's link id.
export function places(text, terms) {
  if (!terms.length || typeof text !== "string" || !text) return [];
  const any = new RegExp([...terms].sort((a, b) => b.length - a.length).map(escape).join("|"), "giu");
  const out = ids(text);
  return [...text.matchAll(any)].map(m => [m.index, m.index + m[0].length]).filter(([a, b]) => !out.some(([c, d]) => a < d && c < b));
}
export const holds = (text, terms) => places(text, terms).length > 0;

// The text with each term taken out, MARK in its place; taken again until none stands, since a cut can join two parts
// into a term.
export function takeOut(text, terms) {
  let now = text;
  for (let round = 0; round < 5; round++) {
    const at = places(now, terms);
    if (!at.length) return now;
    for (const [a, b] of at.reverse()) now = `${now.slice(0, a)}${MARK}${now.slice(b)}`;
  }
  return now;
}

// What is read, from GitHub's answers through `gh` (ghApi's form): each text as { kind, url, node, fields, edit }, where
// `fields` are its texts by the name GitHub's edit takes and `edit` is [method, route] of that edit.
export function texts(repo, since, gh = ghApi) {
  const pages = route => pagesOf(route, gh);
  const out = [];
  const touched = pages(`repos/${repo}/issues?state=all&sort=updated&direction=desc&since=${since}`);
  for (const i of touched) {
    // (a pull request's own title and description once it is merged or closed: while it is open the personal-terms
    // check reads them)
    if (i.pull_request && i.state !== "closed") continue;
    out.push({ kind: i.pull_request ? "pull request" : "issue", url: i.html_url, node: i.node_id, fields: { title: i.title, body: i.body }, edit: ["PATCH", `repos/${repo}/issues/${i.number}`] });
  }
  for (const c of pages(`repos/${repo}/issues/comments?since=${since}`)) out.push({ kind: "comment", url: c.html_url, node: c.node_id, fields: { body: c.body }, edit: ["PATCH", `repos/${repo}/issues/comments/${c.id}`] });
  for (const c of pages(`repos/${repo}/pulls/comments?since=${since}`)) out.push({ kind: "review comment", url: c.html_url, node: c.node_id, fields: { body: c.body }, edit: ["PATCH", `repos/${repo}/pulls/comments/${c.id}`] });
  // (a review's own text has no list by date: those of each pull request touched in the days read, written in them)
  for (const p of touched.filter(i => i.pull_request)) {
    for (const r of pages(`repos/${repo}/pulls/${p.number}/reviews`)) {
      if (typeof r.submitted_at === "string" && r.submitted_at < since) continue;
      out.push({ kind: "review", url: r.html_url, node: r.node_id, fields: { body: r.body }, edit: ["PUT", `repos/${repo}/pulls/${p.number}/reviews/${r.id}`] });
    }
  }
  return out;
}

// GitHub's edit, its text on standard input and never on a command line; refused, false, naming nothing.
export const editGh = (method, route, payload) => spawnSync("gh", ["api", "-X", method, route, "--input", "-"], { input: JSON.stringify(payload), encoding: "utf8", stdio: ["pipe", "ignore", "ignore"] }).status === 0;

// Of each text that holds a term, its fields with the terms out, edited; what was done, by text.
export function clean(all, terms, { edit = editGh, dry = false } = {}) {
  const changed = [], refused = [];
  for (const t of all) {
    const payload = {};
    for (const [key, value] of Object.entries(t.fields)) if (holds(value, terms)) payload[key] = takeOut(value, terms);
    if (!Object.keys(payload).length) continue;
    // (a review's edit takes its body alone, and an issue's what changed)
    if (dry || edit(t.edit[0], t.edit[1], payload)) changed.push(t); else refused.push(t);
  }
  return { changed, refused };
}

// Of `nodes`, those whose earlier versions GitHub keeps hold a term, by GitHub's GraphQL (userContentEdits), fifty a
// call; one that cannot be read is counted unread.
export function versions(nodes, terms, gh = ghApi) {
  const held = new Set(), unread = new Set();
  const q = "query($ids:[ID!]!){nodes(ids:$ids){id ...on UserContentEditable{userContentEdits(first:100){nodes{diff}}}}}";
  for (let i = 0; i < nodes.length; i += 50) {
    const batch = nodes.slice(i, i + 50);
    let got = null;
    try { got = JSON.parse(gh("graphql", "-f", `query=${q}`, ...batch.flatMap(id => ["-f", `ids[]=${id}`]))); } catch {}
    const rows = Array.isArray(got?.data?.nodes) ? got.data.nodes : null;
    if (!rows) { batch.forEach(id => unread.add(id)); continue; }
    for (const row of rows) {
      const edits = row?.userContentEdits?.nodes;
      if (!Array.isArray(edits)) { if (row?.id) unread.add(row.id); continue; }
      if (edits.some(e => holds(e?.diff, terms))) held.add(row.id);
    }
  }
  return { held, unread };
}

// The repository read: GITHUB_REPOSITORY in a job, else the clone's origin.
function repository() {
  if (process.env.GITHUB_ACTIONS === "true") return /^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY ?? "") ? process.env.GITHUB_REPOSITORY : null;
  const origin = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" });
  return origin.status === 0 ? repoOf(origin.stdout) : null;
}

export function main(argv, { env = process.env, gh = ghApi, edit = editGh, now = new Date(), repo = undefined, say = console.log } = {}) {
  const known = new Set(["--private", "--dry", "--days"]);
  const days = argv.includes("--days") ? Number(argv[argv.indexOf("--days") + 1]) : DAYS;
  const bad = argv.filter((a, i) => !known.has(a) && argv[i - 1] !== "--days");
  if (bad.length || !Number.isSafeInteger(days) || days < 1) { console.error("FAIL issue-terms.mjs was given an option it does not know. Mend: run it with --private, --dry or --days N (a whole number of days), or none."); return 1; }
  const job = env.GITHUB_ACTIONS === "true", own = argv.includes("--private"), dry = argv.includes("--dry");
  if (own && job) { console.error("FAIL issue-terms.mjs --private names where a term stood, and a job's log is as public as its repository. Mend: run --private only in a session the owner works with; in a job, run it with no option."); return 1; }
  const terms = termsOf(env.TERMS);
  if (!terms.length) { say("Personal terms in issues and comments: TERMS is not set here (the Actions secret PERSONAL_TERMS, passed to the daily job), so nothing was read."); return 0; }
  const at = repo === undefined ? repository() : repo;
  if (!at) { console.error("FAIL issue-terms.mjs found no GitHub repository to read here. Mend: run it from a clone whose origin is on GitHub, or in GitHub's job."); return 1; }
  const since = new Date(now.getTime() - days * 86400000).toISOString().replace(/\.\d{3}Z$/u, "Z");
  let all;
  try { all = texts(at, since, gh); } catch { say("Personal terms in issues and comments: GitHub's issues and comments could not be read here, so nothing was read. Mend: run it again where gh answers for an account that may read them."); return 0; }
  const { changed, refused } = clean(all, terms, { edit, dry });
  const verb = dry ? "would take a term out of" : "took a term out of";
  say(`Personal terms in issues and comments: read ${all.length} texts written or edited in the last ${days} days; ${verb} ${changed.length}${refused.length ? `; ${refused.length} that hold one this account may not edit` : ""}.`);
  if (!own) {
    if (changed.length || refused.length) say(`GitHub keeps each earlier version of a text edited, shown to every reader. Mend: a session the owner works with runs \`TERMS=<the list> node ${env.CORE_AT ?? "core/"}scripts/issue-terms.mjs --private --days ${days}\` there, signed in to gh as the owner, which takes out what this could not and names, in its own chat alone, each text whose earlier versions hold a term; the owner deletes those versions by hand (the text's "edited" menu).`);
    return 0;
  }
  // (in a session the owner works with: where, for the owner's eyes alone)
  for (const t of changed) say(`${dry ? "would change" : "changed"}: ${t.url} (${t.kind})${"title" in t.fields && holds(t.fields.title, terms) ? "; its old title stays in its timeline, which no one can delete" : ""}`);
  for (const t of refused) say(`could not change: ${t.url} (${t.kind}); edit it by hand`);
  const { held, unread } = versions(all.map(t => t.node).filter(Boolean), terms, gh);
  for (const t of all.filter(x => held.has(x.node))) say(`earlier versions hold a term: ${t.url} (${t.kind}); delete them in its "edited" menu`);
  if (unread.size) say(`the earlier versions of ${unread.size} texts could not be read; look at their "edited" menus by hand`);
  return 0;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
