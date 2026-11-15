// What the reviews find, beside what the core costs (AGENTS.md of the core, "The core is measured as a feature is"):
// run in a project's clone, it reads the pull requests merged into the default branch as core-cost.mjs does (sync,
// upkeep, update, own) and, from GitHub (gh, page by page), every comment on the repository's issues and pull requests
// and the issues labelled `bug`, and counts for each kind of pull request, in five reviews, which got the review, in how
// many it blocked, and how many blocking points it raised:
//   Codex's code review      its own account (`chatgpt-codex-connector[bot]`, a Bot): a top-level inline comment with a
//                            P-badge and no security marker is a find; P0 and P1 block (modules/review-guidelines.md),
//                            P2 and P3 count as other points; it ran where its summary (scripts/security-review.mjs
//                            `codexState`) says completed, or a receipt or a find of it is there
//   Codex's security review  the same, for the finds that open with its security marker
//   posted reviews           comments of the owner's account (--owner, else the repository's account: floor rule 4)
//                            whose first line opens "Security review:", "Code review:" or "Design check:"; a security
//                            review posted is the second one, beside Codex's. Its blocking points are read only from
//                            a line that opens with "Blocking findings: N." (N points), or "No blocking finding.",
//                            "No finding.", "Nothing blocks." or "Blocking: none." (none), with or without ** round it;
//                            a comment in any other wording, or whose lines disagree, is not read, and is never
//                            counted as none. A "Security review: none needed" is a note, not a review.
// A review that was not read is said so ("not read"); it is never added as a zero. It also lists the pull requests whose
// second security review blocked where Codex's own found no blocking point, and counts the bugs that reached `main`
// all the same: a bug counts against a pull request only where the owner's account filed it, and a line "Brought in by:
// #N" stands in its body or in a comment of the owner's account (the newest wins), N is a pull request that was read and
// merged before the bug was filed. No prose is guessed at. It reads; it writes nothing and changes nothing. Git, gh and
// Node's own modules.
//
//   node core/scripts/review-record.mjs [--since YYYY-MM-DD] [--owner login]
import { execFileSync } from "node:child_process";
import { mergedPulls, repoOf, rulesFor } from "./core-cost.mjs";
import { codexState } from "./security-review.mjs";
import { started } from "./started.mjs";
import { pages } from "./stand-in-record.mjs";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CODEX = "chatgpt-codex-connector[bot]";
const SECURITY_MARK = /^<!-- codex-security-review-finding:v1 -->/u;
const RECEIPT = /^<!-- codex-review-receipt:v1 -->/u;
const BADGE = /!\[(P[0-3]) Badge\]/u;
const codexIs = c => c?.user?.login === CODEX && c.user.type === "Bot" && typeof c.body === "string";

export const REVIEWS = [
  ["codexCode", "Codex's code review"], ["postedCode", "Code review posted (the next reviewer's or the fallback's)"],
  ["codexSecurity", "Codex's security review"], ["postedSecurity", "Security review posted (the second)"],
  ["postedDesign", "Design check posted"],
];
export const KINDS = ["own", "upkeep", "sync", "update"];

// Which posted review a comment is, from its first line unquoted: security, code, design, or none-needed (a note that
// no security review is needed), or null where it is none.
export function postedKind(body) {
  const first = String(body ?? "").split("\n").find(l => l.trim()) ?? "";
  if (/^\s*>/.test(first)) return null;
  const m = /^\s*(?:\*\*)?(Security review|Code review|Design check):\s*(.*)$/u.exec(first);
  if (!m) return null;
  if (m[1] === "Design check") return "design";
  if (m[1] === "Code review") return "code";
  return /^(?:\*\*)?\s*none needed\b/iu.test(m[2]) ? "none-needed" : "security";
}

// The blocking points a posted review declares, as a number, or null where it declares none in the forms read or its
// lines disagree.
export function blockingOf(body) {
  const seen = new Set();
  for (const raw of String(body ?? "").split("\n")) {
    const line = raw.replaceAll("**", "").trim();
    const n = /^Blocking findings: (\d{1,6})\.(?:\s|$)/u.exec(line);
    if (n) seen.add(Number(n[1]));
    else if (/^(?:No blocking findings?|No findings?|Nothing blocks|Blocking: none)\.(?:\s|$)/iu.test(line)) seen.add(0);
  }
  return seen.size === 1 ? [...seen][0] : null;
}

// One inline comment as a find of Codex's: { review: "code" | "security", badge, blocking }, or null where it is not
// one of Codex's, replies to another comment, or has no priority badge.
export function codexFind(comment) {
  if (!codexIs(comment) || (comment.in_reply_to_id ?? null) !== null) return null;
  const badge = BADGE.exec(comment.body)?.[1];
  if (!badge) return null;
  return { review: SECURITY_MARK.test(comment.body) ? "security" : "code", badge, blocking: badge === "P0" || badge === "P1" };
}

// What the five reviews did on one pull request, from its comments (issue comments and inline ones, as GitHub's API
// gives them): each of REVIEWS' keys gives { got, blocked: null | "yes" | "no" | "unread", points, other }.
export function perPull(issueComments, inline, owner) {
  const state = codexState(issueComments);
  const finds = inline.map(codexFind).filter(Boolean);
  const codex = review => {
    const mine = finds.filter(f => f.review === review);
    const said = state.state?.[review === "code" ? "code_review" : "security_review"];
    const got = said?.status === "completed" || mine.length > 0 || (review === "code" && issueComments.some(c => codexIs(c) && RECEIPT.test(c.body)));
    const points = mine.filter(f => f.blocking).length;
    // (the summary says there are finds, or cannot be read, and none of them was found: not read, never none)
    const unread = state.unread === true || said?.has_any_findings === true && mine.length === 0;
    return { got, blocked: !got ? null : points ? "yes" : unread ? "unread" : "no", points, other: mine.length - points };
  };
  const posted = kind => {
    const mine = issueComments.filter(c => String(c.user?.login ?? "").toLowerCase() === owner.toLowerCase() && postedKind(c.body) === kind);
    const reads = mine.map(c => blockingOf(c.body));
    return { got: mine.length > 0, blocked: !mine.length ? null : reads.some(n => n > 0) ? "yes" : reads.every(n => n === 0) ? "no" : "unread",
      points: reads.reduce((s, n) => s + (n ?? 0), 0), other: 0 };
  };
  return { codexCode: codex("code"), postedCode: posted("code"), codexSecurity: codex("security"), postedSecurity: posted("security"), postedDesign: posted("design") };
}

// The counts by review and by kind of pull request, from `pulls` as { number, kind, reviews } (perPull's answer).
export function tally(pulls) {
  const t = {};
  for (const [key] of REVIEWS) {
    t[key] = Object.fromEntries(KINDS.map(k => [k, { merged: 0, got: 0, blocked: 0, unread: 0, points: 0, other: 0 }]));
    for (const p of pulls) {
      const row = t[key][p.kind], r = p.reviews[key];
      row.merged++;
      if (!r.got) continue;
      row.got++;
      if (r.blocked === "yes") row.blocked++;
      if (r.blocked === "unread") row.unread++;
      row.points += r.points; row.other += r.other;
    }
  }
  return t;
}

// The pull requests whose second security review blocked where Codex's read no blocking point (it ran, and was read).
export const secondFound = pulls => pulls.filter(p => p.reviews.codexSecurity.blocked === "no" && p.reviews.postedSecurity.blocked === "yes").map(p => p.number);

// The pull request a bug names as the one that brought it in ("Brought in by: #N" on a line of its own), or null.
export const broughtBy = body => { const all = [...String(body ?? "").matchAll(/^Brought in by: #(\d{1,9})[ \t]*$/gmu)]; return all.length ? Number(all.at(-1)[1]) : null; };

// The bugs, given as { number, at, login, body } with the owner's comments on any issue as { issue, at, login, body }:
// how many the owner's account filed, which of them are tied to a merged pull request (the newest "Brought in by" of the
// bug's body and the owner's comments on it, naming a pull request that merged, `merged`: Map of number to
// { when, kind }, before the bug was filed), by the kind of that pull request, and how many other accounts filed.
export function bugs(list, comments, merged, owner) {
  const same = login => String(login ?? "").toLowerCase() === owner.toLowerCase();
  const out = { filed: 0, tied: 0, byKind: Object.fromEntries(KINDS.map(k => [k, 0])), others: 0 };
  for (const b of list) {
    if (!same(b.login)) { out.others++; continue; }
    out.filed++;
    const named = [{ at: b.at, n: broughtBy(b.body) }, ...comments.filter(c => String(c.issue) === String(b.number) && same(c.login)).map(c => ({ at: c.at, n: broughtBy(c.body) }))]
      .filter(x => x.n !== null).sort((a, c) => String(a.at).localeCompare(String(c.at))).at(-1);
    const pull = named && merged.get(named.n);
    if (!pull || !(Date.parse(pull.when) < Date.parse(b.at))) continue;
    out.tied++; out.byKind[pull.kind]++;
  }
  return out;
}

function grid(lines) {
  const width = lines[0].map((_, i) => Math.max(...lines.map(l => l[i].length)));
  return lines.map(l => l.map((c, i) => i ? c.padStart(width[i]) : c.padEnd(width[i])).join("  ")).join("\n");
}

export function print(repo, since, pulls, t, bug) {
  const count = k => pulls.filter(p => p.kind === k).length;
  const out = [`The reviews in ${repo}, ${since ? `from ${since}` : "from the first merge read"}: ${pulls.length} merged pull requests (${KINDS.map(k => `${k} ${count(k)}`).join(", ")})`];
  out.push("A point blocks where it is P0 or P1 (Codex) or declared in the form read (a posted review); a posted review in any other wording is \"not read\", never none.");
  for (const [key, name] of REVIEWS) {
    const rows = KINDS.map(k => [k, t[key][k]]);
    const got = rows.reduce((s, [, r]) => s + r.got, 0);
    out.push("", got ? name : `${name}: on no pull request read`);
    if (!got) continue;
    const codex = key.startsWith("codex");
    out.push(grid([["", "merged", "got it", "blocked", "not read", "blocking points", ...(codex ? ["other points"] : [])],
      ...rows.map(([k, r]) => [k, ...(r.merged ? [r.merged, r.got, r.blocked, r.unread, r.points, ...(codex ? [r.other] : [])].map(String) : Array(codex ? 6 : 5).fill("-"))])]));
  }
  const second = secondFound(pulls);
  out.push("", `Second security review blocked where Codex's read no blocking point: ${second.length}${second.length ? ` (${second.map(n => `#${n}`).join(", ")})` : ""}`);
  out.push(`Bugs filed by the owner's account: ${bug.filed}; tied to a pull request that merged before: ${bug.tied}${bug.tied ? ` (${KINDS.filter(k => bug.byKind[k]).map(k => `${k} ${bug.byKind[k]}`).join(", ")})` : ""}; not tied: ${bug.filed - bug.tied}`
    + (bug.others ? `; filed by other accounts, left out: ${bug.others}` : ""));
  out.push("A bug is tied by a line \"Brought in by: #N\", alone on its line, in its body or in a comment of the owner's account.");
  return out.join("\n");
}

function main(args) {
  const fail = msg => { console.error(`FAIL: ${msg}`); process.exit(1); };
  const value = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
  const since = value("--since"), by = value("--owner");
  if (args.includes("--since") && !DAY.test(since ?? "")) fail("--since takes a day, YYYY-MM-DD");
  if (args.includes("--owner") && !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(by ?? "")) fail("--owner needs the owner's account after it");
  let rules;
  try { process.chdir(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()); rules = rulesFor(repoOf()); } catch (e) { fail(`run it in a project that takes the core: ${e.message.split("\n")[0]}`); }
  let repo, merged;
  try { ({ repo, merged } = mergedPulls(rules, since)); } catch (e) { fail(e.message); }
  if (!repo) fail("the repository is not known (GITHUB_REPOSITORY, or origin's address)");
  if (!merged.length) fail("no merged pull request found on the default branch's first-parent line");
  const owner = by ?? repo.split("/")[0];
  const issueComments = pages(`repos/${repo}/issues/comments?sort=created&direction=asc`,
    ".[] | {issue: (.issue_url | split(\"/\") | last | tonumber), created_at, at: .created_at, updated_at, login: .user.login, user: {login: .user.login, type: .user.type}, body} | @json");
  const inline = pages(`repos/${repo}/pulls/comments?sort=created&direction=asc`,
    ".[] | {pull: (.pull_request_url | split(\"/\") | last | tonumber), in_reply_to_id, user: {login: .user.login, type: .user.type}, body} | @json");
  const issues = pages(`repos/${repo}/issues?state=all&labels=bug`,
    ".[] | {number, at: .created_at, login: .user.login, body, pull: (.pull_request != null)} | @json")
    .filter(b => !b.pull && (!since || b.at >= `${since}T00:00:00Z`)); // (pull requests are taken out after paging, so that a page's length is still GitHub's own)
  const pulls = merged.map(m => ({ number: m.number, kind: m.kind,
    reviews: perPull(issueComments.filter(c => c.issue === m.number), inline.filter(c => c.pull === m.number), owner) }));
  const t = tally(pulls);
  const bug = bugs(issues, issueComments, new Map(merged.map(m => [m.number, m])), owner);
  console.log(print(repo, since, pulls, t, bug));
}

if (started(import.meta.url)) main(process.argv.slice(2));
