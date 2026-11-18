// The blind sample (README.md, "What the core is for"; #594): with each month's state report, a small sample of the
// month before's merged work, drawn at random and laid out without its story, for the owner to approve or not; the
// share approved is what the core is for, and the state report gives it among the outcomes (outcomes.mjs, beside this
// file). The scheduled look keeps it in one issue, TITLE, labelled needs-owner: on its first run of a month it lays out
// the new draw there, and the state report it writes that run reads first the owner's answers to the draw it replaces.
// Each change is laid out by its diff alone, file by file (GitHub's own patch of the pull request), so nothing says who
// built it, why, or what its reviews said; its number stands only in a comment of the issue's text, for the session that
// files a "no" as a correction. The draw is fixed by the repository and the month (the same each run), never picked by
// hand. The owner answers in a comment, a line each: "3: yes", or "3: no, <kind>", the kind one of a correction's
// (outcomes.mjs, KINDS). It asks and waits on nothing: a month the owner skips is said in the report as not read, and a
// "no" is a correction, built as any is. Through gh; Node's own modules.
//
//   import { reader, shareOf, line } from "./blind-sample.mjs";
import crypto from "node:crypto";
import { mergedIn } from "./cited.mjs";
import { ghApi, pagesOf } from "./labels.mjs";
import { BLIND as LABEL, KINDS } from "./outcomes.mjs";
import { byAgent } from "./stand-in-record.mjs";

export const TITLE = "The blind sample";
export const COUNT = 10, LINES = 60;
const MARK = /<!-- blind-sample (\d{4}-\d\d) drawn (\d{4}-\d\d-\d\dT[\d:]+Z) pulls ([\d ]*) -->/u;
const ANSWER = new RegExp(`^\\s*(\\d{1,2})\\s*[:.)]\\s*(yes|no)\\b(?:\\s*[,;:-]\\s*(${KINDS.join("|")}))?`, "iu");

// The month before a month ("2026-01" gives "2025-12").
export const before = month => { const [y, m] = month.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };

// The draw: of the pull requests merged (Dependabot's left out), COUNT of them, ordered by a hash of the repository, the
// month and each number, so the same month gives the same draw on every run and no hand picks it.
export function draw(pulls, repo, month, count = COUNT) {
  const key = p => crypto.createHash("sha256").update(`${repo.toLowerCase()} ${month} ${p.number}`).digest("hex");
  return pulls.filter(p => p.merged_at && !/^dependabot\//u.test(p.head?.ref ?? "") && p.user?.login !== "dependabot[bot]")
    .map(p => ({ p, k: key(p) })).sort((a, b) => a.k.localeCompare(b.k)).slice(0, count).map(({ p }) => p.number).sort((a, b) => a - b);
}

// One change laid out: each file it changed, with GitHub's patch, LINES lines at most, the rest counted.
export function laidOut(files, lines = LINES) {
  const out = [], patch = [];
  for (const f of files) {
    out.push(`- \`${String(f.filename).replace(/[`\r\n]/gu, "?")}\` (${f.status}, +${f.additions ?? 0} -${f.deletions ?? 0})`);
    if (f.patch) patch.push(`--- ${f.filename}`, ...String(f.patch).split("\n"));
  }
  const shown = patch.slice(0, lines).map(l => l.replace(/```/gu, "'''"));
  return [...out, "", "```diff", ...shown, "```", ...(patch.length > lines ? [`(${patch.length - lines} more lines of the diff not shown)`] : [])].join("\n");
}

// The issue's text for the draw of `month`, made at `drawn` (the first of the month after): each change by its place in
// the draw, laid out by `filesOf(number)`.
export function bodyOf(month, drawn, numbers, filesOf) {
  const parts = [`The blind sample of the work merged in ${month}: ${numbers.length} changes drawn at random, each shown by what it changed alone, with no word of who built it, why, or what its reviews found (README.md, "What the core is for"; \`scripts/blind-sample.mjs\`). Would you approve each, shown it so?`,
    "",
    `Answer in a comment, a line each: \`3: yes\`, or \`3: no, <kind>\`, the kind one of ${KINDS.map(k => `\`${k}\``).join(", ")}. Nothing waits on it: next month's state report gives the share approved, or says the month was not answered, and a session files each "no" as a correction.`];
  if (!numbers.length) parts.push("", `Nothing was merged in ${month}, so nothing is drawn.`);
  numbers.forEach((n, i) => parts.push("", `### ${i + 1}`, "", laidOut(filesOf(n))));
  parts.push("", `<!-- blind-sample ${month} drawn ${drawn} pulls ${numbers.join(" ")} -->`);
  return parts.join("\n");
}

// The draw an issue's text holds: { month, drawn, pulls } or null.
export function drawOf(body) {
  const m = MARK.exec(String(body ?? ""));
  return m ? { month: m[1], drawn: m[2], pulls: m[3].trim() ? m[3].trim().split(" ").map(Number) : [] } : null;
}

// The owner's answers to a draw: the owner's own comments (no agent's), made since it was drawn, a line each; the last
// answer to a place wins. { place: { yes, kind } }.
export function answersOf(draw, comments, owner) {
  const out = {};
  const own = comments.filter(c => String(c.user?.login ?? "").toLowerCase() === String(owner).toLowerCase() && !byAgent(c.body ?? "") && String(c.created_at) >= draw.drawn)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (const c of own) for (const l of String(c.body ?? "").split(/\r?\n/u)) {
    const m = ANSWER.exec(l);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > draw.pulls.length) continue;
    out[Number(m[1])] = { yes: m[2].toLowerCase() === "yes", kind: m[3] ? m[3].toLowerCase() : null, pull: draw.pulls[Number(m[1]) - 1] };
  }
  return out;
}

// The share approved of the draw an issue holds: { month, drawn, answered, approved, no: [{ pull, kind }] }, or null.
export function shareOf(issue, comments, owner) {
  const d = drawOf(issue?.body);
  if (!d) return null;
  const a = Object.values(answersOf(d, comments, owner));
  return { month: d.month, drawn: d.pulls.length, answered: a.length, approved: a.filter(x => x.yes).length, no: a.filter(x => !x.yes).map(x => ({ pull: x.pull, kind: x.kind })) };
}

// The state report's line, among the outcomes (outcomes.mjs holds its label and reads its words).
export function line(s) {
  if (!s) return `- ${LABEL}: not read, none drawn yet.`;
  if (!s.answered) return `- ${LABEL}: not read, none of ${s.drawn} drawn from ${s.month} answered.`;
  return `- ${LABEL}: ${s.approved} of ${s.answered} answered, ${Math.round((100 * s.approved) / s.answered)}%, of ${s.drawn} drawn from ${s.month}.`;
}

// The share of the draw the issue held before this run, read through gh: the look's state report calls it with the issue
// it keeps under TITLE (or none); null where there is none, or GitHub did not answer.
export function shareNow(repo, issue, owner, gh = ghApi) {
  if (!issue) return null;
  try { return shareOf(issue, pagesOf(`repos/${repo}/issues/${issue.number}/comments`, gh), owner); } catch { return null; }
}

// The issue the look keeps under TITLE, as GitHub gives it, or null.
export function keptIssue(repo, gh = ghApi) {
  return pagesOf(`repos/${repo}/issues?state=all&labels=by%3Alook`, gh).filter(i => i.title === TITLE && !i.pull_request).sort((a, b) => b.number - a.number)[0] ?? null;
}

// The look's reader (look.mjs, DUE): on the first run of a month, the draw of the month before, laid out, drawn at
// that run's time (`at`), so only answers after it count; on later runs that month, the issue as it stands.
export function reader({ repo, at, gh = ghApi }) {
  if (!repo) return null;
  const month = before(String(at).slice(0, 7)), drawn = String(at).replace(/\.\d+Z$/u, "Z");
  try {
    if (drawOf(keptIssue(repo, gh)?.body)?.month === month) return { title: TITLE, unread: `the draw of ${month} stands`, owner: true };
    const numbers = draw(mergedIn(repo, `${month}-01T00:00:00Z`, drawn, gh), repo, month);
    const files = n => pagesOf(`repos/${repo}/pulls/${n}/files`, gh);
    return { title: TITLE, body: bodyOf(month, drawn, numbers, files), owner: true };
  } catch { return { title: TITLE, unread: "GitHub did not answer for the month's merged pull requests and their files", owner: true }; }
}
