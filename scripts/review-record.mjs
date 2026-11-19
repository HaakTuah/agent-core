// What the reviews find, beside what the core costs (AGENTS.md of the core, "The core is measured as a feature is"):
// run in a project's clone, it reads the pull requests merged into the default branch as core-cost.mjs does (sync,
// upkeep, update, own) and, from GitHub (gh, page by page), every comment on the repository's issues and pull requests
// and the issues labelled `bug`, and counts for each kind of pull request, in five reviews, which got the review, in how
// many it blocked, how many blocking points it raised and how many other points:
//   Codex's code review      its own account (`chatgpt-codex-connector[bot]`, a Bot): a top-level inline comment with a
//                            P-badge and no security marker is a find; P0 and P1 block (roles/shared/review-guidelines.md),
//                            P2 and P3 count as other points; it ran where its summary (scripts/security-review.mjs
//                            `codexState`) says completed, or a receipt or a find of it is there
//   Codex's security review  the same, for the finds that open with its security marker
//   posted reviews           comments of the owner's account (--owner, else the repository's account: floor rule 4)
//                            whose first line opens "Security review:", "Code review:" or "Design check:"; a security
//                            review posted is the second one, beside Codex's. Its points are read only from the lines
//                            of its form (tasks/reviews.md, "What a posted review declares"; #299): the blocking ones
//                            from a line that opens with "Blocking findings: N." (N points), or "No blocking finding.",
//                            "No finding.", "Nothing blocks." or "Blocking: none." (none), the others from one that
//                            opens with "Other findings: M." or "No other finding." ("No finding." too), with or
//                            without ** round it; a comment without the line, or whose lines disagree, is not read for
//                            it, and is never counted as none. A "Security review: none needed" is a note, not a review.
//                            A posted code review is counted again by its stance, from a line "Stance: adversarial." or
//                            "Stance: regular." (stanceOf, below; #397), and one with neither in neither row.
// A review that was not read is said so ("not read"); it is never added as a zero. It also lists the pull requests whose
// second security review blocked where Codex's own found no blocking point, and counts the bugs that reached `main`
// all the same: a bug counts against a pull request only where the owner's account filed it, and a line "Brought in by:
// #N" (the bug form's last line) stands in its body or in a comment of the owner's account (the newest wins), N is a
// pull request that was read and merged before the bug was filed; any other bug is not read, never none. No prose is
// guessed at. It lists each rule the findings of two pull requests or more name, on their line "Rule:" (rulesNamed,
// below). Last it counts the rounds of review each pull request took (#477; review-rounds.mjs, beside this file), from
// the head each review was asked or posted on (reviewEvents, below) and the pull request's commits, read for those it
// counts, the last 30 merged and, given --since, the 30 merged before it. It reads; it writes nothing and changes
// nothing. Git, gh and Node's own modules.
//
//   node core/scripts/review-record.mjs [--since YYYY-MM-DD] [--owner login]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DAY, grid, mergedPulls, repoOf, rulesFor } from "./core-cost.mjs";
import { seen } from "./guards.mjs";
import { roundsLines, roundsOf, wanted } from "./review-rounds.mjs";
import { FINDING, codexState, codexs, named } from "./security-review.mjs";
import { started } from "./started.mjs";
import { ROOT, rules, rulesOf } from "./rules.mjs";
import { pages } from "./stand-in-record.mjs";

const RECEIPT = /^<!-- codex-review-receipt:v1 -->/u;
const REVIEWED = /^\*\*Reviewed commit:\*\* `([0-9a-f]{7,40})`/mu; // (the commit a receipt of Codex's names, as its app writes it)
const BADGE = /!\[(P[0-3]) Badge\]/u;

export const REVIEWS = [
  ["codexCode", "Codex's code review"], ["postedCode", "Code review posted (the next reviewer's or the fallback's)"],
  ["postedAdversarial", "of those, its stance adversarial"], ["postedRegular", "of those, its stance regular"],
  ["codexSecurity", "Codex's security review"], ["postedSecurity", "Security review posted (the second)"],
  ["postedDesign", "Design check posted"],
];
export const KINDS = ["own", "upkeep", "sync", "update"];

// A comment's text as its lines, each carriage return taken out (the web editor ends a line with one before the line feed).
const lines = body => String(body ?? "").replaceAll("\r", "").split("\n");
const firstLine = body => lines(body).find(l => l.trim()) ?? "";

// Which posted review a comment is, from its first line unquoted: security, code, design, or none-needed (a note that
// no security review is needed), or null where it is none.
export function postedKind(body) {
  const first = firstLine(body);
  if (/^\s*>/.test(first)) return null;
  const m = /^\s*(?:\*\*)?(Security review|Code review|Design check):\s*(.*)$/su.exec(first); // (s: a line separator left in the line still matches, so the pattern never goes back over the spaces)
  if (!m) return null;
  if (m[1] === "Design check") return "design";
  if (m[1] === "Code review") return "code";
  return /^(?:\*\*)?\s*none needed\b/iu.test(m[2]) ? "none-needed" : "security";
}

// The one count that the lines of a posted review matching `count` (its number) or `none` (zero) declare, or null where
// none declares it or they disagree.
function declared(body, count, none) {
  const said = new Set();
  for (const raw of lines(seen(body))) { // (as the reader sees it: no line in an HTML comment or a fenced block of code)
    const line = raw.replaceAll("**", "").trim();
    const n = count.exec(line);
    if (n) said.add(Number(n[1]));
    else if (none.test(line)) said.add(0);
  }
  return said.size === 1 ? [...said][0] : null;
}

// The blocking points, and the other points, a posted review declares, each a number or null (not read).
export const blockingOf = body => declared(body, /^Blocking findings: (\d{1,6})\.(?:\s|$)/u, /^(?:No blocking findings?|No findings?|Nothing blocks|Blocking: none)\.(?:\s|$)/iu);
export const otherOf = body => declared(body, /^Other findings: (\d{1,6})\.(?:\s|$)/u, /^(?:No other findings?|No findings?)\.(?:\s|$)/iu);

// The stance a posted code review declares on a line of its own (tasks/reviews.md, "A review's stance follows the kind
// of change"; #397): "adversarial", "regular", or null where no line says one or two lines disagree.
export function stanceOf(body) {
  const said = new Set();
  for (const raw of lines(seen(body))) { const m = /^Stance: (adversarial|regular)\.(?:\s|$)/iu.exec(raw.replaceAll("**", "").trim()); if (m) said.add(m[1].toLowerCase()); }
  return said.size === 1 ? [...said][0] : null;
}

// One inline comment as a find of Codex's: { review: "code" | "security", badge, blocking }, or null where it is not
// one of Codex's, replies to another comment, or has no priority badge.
export function codexFind(comment) {
  if (!codexs(comment) || (comment.in_reply_to_id ?? null) !== null) return null;
  const badge = BADGE.exec(comment.body)?.[1];
  if (!badge) return null;
  return { review: FINDING.test(comment.body) ? "security" : "code", badge, blocking: badge === "P0" || badge === "P1" };
}

// What the five reviews, and the posted code review by stance, did on one pull request, from its comments (issue comments and inline ones, as GitHub's API
// gives them): each of REVIEWS' keys gives { got, blocked: null | "yes" | "no" | "unread", points, other, otherUnread },
// otherUnread true where a posted review that ran declares no count of its other points (Codex's are read by badge).
export function perPull(issueComments, inline, owner) {
  const state = codexState(issueComments);
  const finds = [...inline, ...issueComments].map(codexFind).filter(Boolean); // (a find can be an issue comment too, as security-review.mjs reads them)
  const codex = review => {
    const mine = finds.filter(f => f.review === review);
    const said = state.state?.[review === "code" ? "code_review" : "security_review"];
    const got = said?.status === "completed" || mine.length > 0 || (review === "code" && issueComments.some(c => codexs(c) && RECEIPT.test(c.body)));
    const points = mine.filter(f => f.blocking).length;
    // (the summary says there are finds, or cannot be read, and none of them was found: not read, never none)
    const unread = state.unread === true || said?.has_any_findings === true && mine.length === 0;
    return { got, blocked: !got ? null : points ? "yes" : unread ? "unread" : "no", points, other: mine.length - points, otherUnread: false };
  };
  const posted = (kind, stance) => {
    const mine = issueComments.filter(c => String(c.user?.login ?? "").toLowerCase() === owner.toLowerCase() && postedKind(c.body) === kind && (!stance || stanceOf(c.body) === stance));
    const reads = mine.map(c => blockingOf(c.body)), others = mine.map(c => otherOf(c.body));
    return { got: mine.length > 0, blocked: !mine.length ? null : reads.some(n => n > 0) ? "yes" : reads.every(n => n === 0) ? "no" : "unread",
      points: reads.reduce((s, n) => s + (n ?? 0), 0), other: others.reduce((s, n) => s + (n ?? 0), 0), otherUnread: others.some(n => n === null) };
  };
  return { codexCode: codex("code"), postedCode: posted("code"), postedAdversarial: posted("code", "adversarial"), postedRegular: posted("code", "regular"), codexSecurity: codex("security"), postedSecurity: posted("security"), postedDesign: posted("design") };
}

// What a pull request's reviews were asked or posted on, for its rounds (review-rounds.mjs): { sha, at, blocking }, sha
// the commit the review names (a posted review's first line, the commit a receipt of Codex's names, the one a find of
// Codex's was made on, and the one each review its summary says completed read, the newest alone, as its app keeps it)
// and at the time it was asked or posted, read where no commit is named. A review asked is a line
// "@codex review" alone, in a comment of the owner's account; a note that no security review is needed is none.
export function reviewEvents(issueComments, inline, owner) {
  const mine = c => String(c.user?.login ?? "").toLowerCase() === owner.toLowerCase();
  const out = [];
  for (const c of issueComments) {
    const kind = mine(c) ? postedKind(c.body) : null;
    if (["security", "code", "design"].includes(kind)) out.push({ sha: named(firstLine(c.body))[0], at: c.at, blocking: blockingOf(c.body) > 0 });
    else if (mine(c) && lines(seen(c.body)).some(l => l.trim() === "@codex review")) out.push({ at: c.at, blocking: false });
    else if (codexs(c) && RECEIPT.test(c.body)) out.push({ sha: REVIEWED.exec(c.body)?.[1], at: c.at, blocking: false });
  }
  const { state } = codexState(issueComments);
  for (const review of [state?.code_review, state?.security_review]) if (review?.status === "completed" && review.commit_sha) out.push({ sha: review.commit_sha, blocking: false });
  for (const c of [...inline, ...issueComments]) {
    const find = codexFind(c);
    if (find) out.push({ sha: c.original_commit_id ?? c.commit_id, at: c.at, blocking: find.blocking });
  }
  return out;
}

// The rules a pull request's findings name (the core's tasks/reviews.md, point 8; #254): each on a line of its own
// that opens "Rule:", in a find of Codex's or a review posted by the owner's account, read as a key the same however it
// is written: its backticks, bold and quotes, a closing stop, colon or comma (as rules.mjs's leadOf leaves them out of
// a rule's own key) and a leading "core/" left out, its spaces made one, its case lowered and its control and format
// characters taken out. A quoted line names none.
const RULE = /^[ \t]*(?:[-*][ \t]+)?(?:\*\*)?Rule:(?:\*\*)?[ \t]+(\S.*)$/u;
export const ruleOf = text => String(text).slice(0, 300).replace(/[\p{Cc}\p{Cf}`*"\u201c\u201d]/gu, "").replace(/\s+/gu, " ").trim()
  .replace(/[.:,;]+$/u, "").trim().replace(/^core\//u, "").toLowerCase();
export const rulesIn = body => lines(body).map(l => RULE.exec(l)?.[1]).filter(Boolean).map(ruleOf).filter(Boolean);
export function rulesNamed(issueComments, inline, owner) {
  const finds = [...inline, ...issueComments].filter(c => codexFind(c));
  const posted = issueComments.filter(c => String(c.user?.login ?? "").toLowerCase() === owner.toLowerCase() && ["security", "code", "design"].includes(postedKind(c.body)));
  return [...new Set([...finds, ...posted].flatMap(c => rulesIn(c.body)))].sort();
}

// The rules the findings of two pull requests or more name, from `pulls` as { number, when, rules } (rulesNamed's
// answer), each as { rule, pulls }, the most named first: those alone that a pull request merged on or after `since`
// (a day, YYYY-MM-DD) named, where one is given, so that a month's report lists only what came up again in it.
export function foundTwice(pulls, since = null) {
  const by = new Map(), from = since ? Date.parse(`${since}T00:00:00Z`) : null;
  for (const p of pulls) for (const rule of new Set(p.rules ?? [])) by.set(rule, [...(by.get(rule) ?? []), p]);
  return [...by].filter(([, ps]) => ps.length > 1 && (from === null || ps.some(p => Date.parse(p.when) >= from)))
    .map(([rule, ps]) => ({ rule, pulls: ps.map(p => p.number).sort((a, b) => a - b) }))
    .sort((a, b) => b.pulls.length - a.pulls.length || a.rule.localeCompare(b.rule));
}

// The rules that stand, keyed as ruleOf keys a finding's line: those of the floor, the roles and the modules of the core
// at `core` (rules.mjs), and those of the AGENTS.md and SECURITY.md at the root of the project at `project`, its own;
// null where they cannot be read.
export function standing(core = ROOT, project = process.cwd()) {
  try {
    const own = ["AGENTS.md", "SECURITY.md"].filter(f => fs.existsSync(path.join(project, f)))
      .flatMap(f => rulesOf(f, fs.readFileSync(path.join(project, f), "utf8")));
    return new Set([...rules(core), ...own].map(r => ruleOf(r.key)));
  } catch { return null; }
}

// The counts by review and by kind of pull request, from `pulls` as { number, kind, reviews } (perPull's answer).
export function tally(pulls) {
  const t = {};
  for (const [key] of REVIEWS) {
    t[key] = Object.fromEntries(KINDS.map(k => [k, { merged: 0, got: 0, blocked: 0, unread: 0, points: 0, other: 0, otherUnread: 0 }]));
    for (const p of pulls) {
      const row = t[key][p.kind], r = p.reviews[key];
      row.merged++;
      if (!r.got) continue;
      row.got++;
      if (r.blocked === "yes") row.blocked++;
      if (r.blocked === "unread") row.unread++;
      if (r.otherUnread) row.otherUnread++;
      row.points += r.points; row.other += r.other;
    }
  }
  return t;
}

// The pull requests whose second security review blocked where Codex's read no blocking point (it ran, and was read).
export const secondFound = pulls => pulls.filter(p => p.reviews.codexSecurity.blocked === "no" && p.reviews.postedSecurity.blocked === "yes").map(p => p.number);

// The pull request a bug names as the one that brought it in ("Brought in by: #N" on a line of its own), or null.
export const broughtBy = body => { const all = [...lines(seen(body)).join("\n").matchAll(/^Brought in by: #([1-9]\d{0,8})[ \t]*$/gmu)]; return all.length ? Number(all.at(-1)[1]) : null; };

// The bugs, given as { number, at, login, body } with the owner's comments on any issue as { issue, at, login, body }:
// how many the owner's account filed, which of them are tied to a merged pull request (the newest "Brought in by" of the
// bug's body and the owner's comments on it, naming a pull request that merged, `merged`: Map of number to
// { when, kind }, before the bug was filed), by the kind of that pull request, how many of the rest have no such line
// (`unlined`) and how many name no pull request read that merged before (`unmatched`), and how many other accounts filed.
export function bugs(list, comments, merged, owner) {
  const same = login => String(login ?? "").toLowerCase() === owner.toLowerCase();
  const out = { filed: 0, tied: 0, byKind: Object.fromEntries(KINDS.map(k => [k, 0])), unlined: 0, unmatched: 0, others: 0 };
  for (const b of list) {
    if (!same(b.login)) { out.others++; continue; }
    out.filed++;
    const named = [{ at: b.at, n: broughtBy(b.body) }, ...comments.filter(c => String(c.issue) === String(b.number) && same(c.login)).map(c => ({ at: c.at, n: broughtBy(c.body) }))]
      .filter(x => x.n !== null).sort((a, c) => String(a.at).localeCompare(String(c.at))).at(-1);
    if (!named) { out.unlined++; continue; }
    const pull = merged.get(named.n);
    if (!pull || !(Date.parse(pull.when) < Date.parse(b.at))) { out.unmatched++; continue; }
    out.tied++; out.byKind[pull.kind]++;
  }
  return out;
}

// The part on what was found twice: each rule that stands which two pull requests' findings name, and apart those that
// are no rule that stands (known as print takes it).
function twiceLines(pulls, since, twice, known) {
  const naming = pulls.filter(p => p.rules?.length).length;
  const stands = twice.filter(f => known?.has(f.rule)), not = twice.filter(f => !known?.has(f.rule));
  const listed = fs => fs.map(f => `- ${f.rule}: ${f.pulls.map(n => `#${n}`).join(", ")}`);
  return [`Found twice, a rule that stands which the findings of two pull requests or more name${since ? `, one of them merged from ${since}` : ""}: ${stands.length}${stands.length ? "" : " (none)"}`,
    ...listed(stands),
    ...(not.length ? [`Named twice but no rule that stands${known ? "" : " (the rules could not be read)"}, so no issue is filed for it: ${not.length}`, ...listed(not)] : []),
    `A finding names its rule on a line \"Rule: <file>: <bold lead>\" (the core's tasks/reviews.md, point 8); one without it names none. Of the ${pulls.length} pull requests read, ${naming} have a finding that names one.`];
}

// `known`: the rules that stand, as ruleOf keys them (standing, below), or null where they were not read; a rule found
// twice that is none of them is listed apart, for no issue is filed for it.
export function print(repo, since, pulls, t, bug, twice = [], known = null) {
  const count = k => pulls.filter(p => p.kind === k).length;
  const out = [`The reviews in ${repo}, ${since ? `from ${since}` : "from the first merge read"}: ${pulls.length} merged pull requests (${KINDS.map(k => `${k} ${count(k)}`).join(", ")})`];
  out.push("A point blocks where it is P0 or P1 (Codex) or declared in the form read (a posted review); a posted review in any other wording is \"not read\", never none, and so for its other points.");
  for (const [key, name] of REVIEWS) {
    const rows = KINDS.map(k => [k, t[key][k]]);
    const got = rows.reduce((s, [, r]) => s + r.got, 0);
    out.push("", got ? name : `${name}: on no pull request read`);
    if (!got) continue;
    const codex = key.startsWith("codex");
    out.push(grid([["", "merged", "got it", "blocked", "not read", "blocking points", "other points", ...(codex ? [] : ["other not read"])],
      ...rows.map(([k, r]) => [k, ...(r.merged ? [r.merged, r.got, r.blocked, r.unread, r.points, r.other, ...(codex ? [] : [r.otherUnread])].map(String) : Array(codex ? 6 : 7).fill("-"))])]));
  }
  const second = secondFound(pulls);
  out.push("", `Second security review blocked where Codex's read no blocking point: ${second.length}${second.length ? ` (${second.map(n => `#${n}`).join(", ")})` : ""}`);
  out.push(`Bugs filed by the owner's account: ${bug.filed}; tied to a pull request that merged before: ${bug.tied}${bug.tied ? ` (${KINDS.filter(k => bug.byKind[k]).map(k => `${k} ${bug.byKind[k]}`).join(", ")})` : ""}; not read: ${bug.unlined + bug.unmatched}`
    + (bug.unmatched ? ` (no line ${bug.unlined}, a line naming no pull request read that merged before it ${bug.unmatched})` : "")
    + (bug.others ? `; filed by other accounts, left out: ${bug.others}` : ""));
  out.push("A bug is tied by a line \"Brought in by: #N\", alone on its line, in its body or in a comment of the owner's account; one without it is not read, never none.");
  out.push("", ...twiceLines(pulls, since, twice, known));
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
  let repo, all;
  try { ({ repo, merged: all } = mergedPulls(rules)); } catch (e) { fail(e.message); }
  if (!repo) fail("the repository is not known (GITHUB_REPOSITORY, or origin's address)");
  // (every merge is read for what was found twice, the first time often before --since; the counts read those from it)
  const merged = since ? all.filter(m => Date.parse(m.when) >= Date.parse(`${since}T00:00:00Z`)) : all;
  if (!merged.length) fail("no merged pull request found on the default branch's first-parent line");
  const owner = by ?? repo.split("/")[0];
  const issueComments = pages(`repos/${repo}/issues/comments?sort=created&direction=asc`,
    ".[] | {issue: (.issue_url | split(\"/\") | last | tonumber), created_at, at: .created_at, updated_at, login: .user.login, user: {login: .user.login, type: .user.type}, body} | @json");
  const inline = pages(`repos/${repo}/pulls/comments?sort=created&direction=asc`,
    ".[] | {pull: (.pull_request_url | split(\"/\") | last | tonumber), in_reply_to_id, at: .created_at, commit_id, original_commit_id, user: {login: .user.login, type: .user.type}, body} | @json");
  const issues = pages(`repos/${repo}/issues?state=all&labels=bug`,
    ".[] | {number, at: .created_at, login: .user.login, body, pull: (.pull_request != null)} | @json")
    .filter(b => !b.pull && (!since || b.at >= `${since}T00:00:00Z`)); // (pull requests are taken out after paging, so that a page's length is still GitHub's own)
  const of = m => [issueComments.filter(c => c.issue === m.number), inline.filter(c => c.pull === m.number), owner];
  const named = new Map(all.map(m => [m.number, rulesNamed(...of(m))]));
  const pulls = merged.map(m => ({ number: m.number, kind: m.kind, reviews: perPull(...of(m)), rules: named.get(m.number) }));
  const t = tally(pulls);
  const bug = bugs(issues, issueComments, new Map(merged.map(m => [m.number, m])), owner);
  const twice = foundTwice(all.map(m => ({ number: m.number, when: m.when, rules: named.get(m.number) })), since);
  console.log(print(repo, since, pulls, t, bug, twice, standing()));
  const commitsOf = n => { try { return pages(`repos/${repo}/pulls/${n}/commits?`, ".[] | {sha, at: .commit.committer.date, parents: [.parents[] | {sha}]} | @json"); } catch { return null; } };
  const want = wanted(merged, all, since);
  const rounds = new Map(all.filter(m => want.has(m.number)).map(m => { const commits = commitsOf(m.number); return [m.number, commits && roundsOf(reviewEvents(...of(m)), commits)]; }));
  console.log(`\n${roundsLines(merged, all, since, rounds)}`);
}

if (started(import.meta.url)) main(process.argv.slice(2));
