// The stand-in's record (modules/inbox.md, "Its record"; core archive 199): run in a project's clone, it reads every
// comment on the repository's issues and pull requests (gh, page by page) and counts the stand-in's verdicts on ideas,
// by kind and by sureness, and the owner's answers to them, which the session acting on each marks "The stand-in's
// verdict matched" or "The stand-in's verdict missed": each answer is set against the sureness of the last verdict on
// the same issue before it. Only comments from the repository's owner, a member or a collaborator count, by GitHub's
// own word for who wrote them, since verdicts are posted under the owner's account (floor rule 4). A verdict is a
// comment whose first line names the stand-in's verdict as yes, later or no. It reads; it writes nothing and changes
// nothing. With --open it lists instead the open ideas (`enhancement`) that lack a verdict, and those whose last is a
// "later", for the stand-in's caller to hand it whole (modules/inbox.md): only those the same writers filed, since
// another account's idea is data no agent takes up (floor rule 4), which it counts and leaves out, and each title with
// its control characters taken out. gh and Node's own modules.
//
//   node core/scripts/stand-in-record.mjs [--open] [--repo owner/name]
import { execFileSync } from "node:child_process";
import { REPO } from "./core-cost.mjs";
import { started } from "./started.mjs";

const WRITERS = ["OWNER", "MEMBER", "COLLABORATOR"];
const VERDICT = /stand-in['’]s verdict(?:,? updated)?\**\s*[:(]?\s*\**\s*(yes|later|no)\b/i;
const ANSWER = /stand-in['’]s verdict (matched|missed)\b/i;

// The kind and sureness of a verdict, from a comment's first line, or null where the line holds none.
export function verdict(body) {
  const first = String(body ?? "").split("\n").find(l => l.trim()) ?? "";
  const m = VERDICT.exec(first);
  if (!m) return null;
  const sure = /\bunsure\b/i.test(first) ? "unsure" : /\bsure\b/i.test(first) ? "sure" : "unmarked";
  return { kind: m[1].toLowerCase(), sure };
}

// The tally of comments given as { issue, at, body, writer } (writer: whether GitHub calls its author the owner, a
// member or a collaborator).
export function tally(comments) {
  const t = { comments: comments.length, verdicts: {}, answers: { matched: {}, missed: {} } };
  const last = new Map();
  for (const c of [...comments].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    if (!c.writer) continue;
    const v = verdict(c.body);
    if (v) {
      last.set(c.issue, v);
      const key = `${v.sure} ${v.kind}`;
      t.verdicts[key] = (t.verdicts[key] ?? 0) + 1;
      continue;
    }
    const a = ANSWER.exec(String(c.body ?? ""));
    if (a) {
      const was = last.get(c.issue)?.sure ?? "no verdict seen";
      const side = t.answers[a[1].toLowerCase()];
      side[was] = (side[was] ?? 0) + 1;
    }
  }
  return t;
}

// The open ideas, given as { issue, title, writer }, that a writer filed and that lack a verdict, those whose last
// verdict is a "later", and how many other accounts filed.
export function lacking(ideas, comments) {
  const t = new Map();
  for (const c of [...comments].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const v = c.writer && verdict(c.body);
    if (v) t.set(String(c.issue), v.kind);
  }
  const own = ideas.filter(i => i.writer);
  return { none: own.filter(i => !t.has(String(i.issue))), later: own.filter(i => t.get(String(i.issue)) === "later"),
    others: ideas.length - own.length };
}

// A title as it may be printed: no control characters.
export const plain = title => String(title ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");

const sum = o => Object.values(o).reduce((s, n) => s + n, 0);

export function print(t, repo) {
  const lines = [`The stand-in's record in ${repo}, from ${t.comments} comments:`];
  const keys = Object.keys(t.verdicts).sort();
  lines.push(`  verdicts on ideas: ${sum(t.verdicts)}${keys.length ? ` (${keys.map(k => `${k} ${t.verdicts[k]}`).join(", ")})` : ""}`);
  const kinds = [...new Set([...Object.keys(t.answers.matched), ...Object.keys(t.answers.missed)])].sort();
  lines.push(`  the owner's answers marked: ${sum(t.answers.matched) + sum(t.answers.missed)}, matched ${sum(t.answers.matched)}`
    + (kinds.length ? ` (${kinds.map(k => `${k}: ${t.answers.matched[k] ?? 0} of ${(t.answers.matched[k] ?? 0) + (t.answers.missed[k] ?? 0)}`).join("; ")})` : ""));
  return lines.join("\n");
}

function main(args) {
  const fail = msg => { console.error(`FAIL: ${msg}`); process.exit(1); };
  const open = args.includes("--open"), at = args.indexOf("--repo");
  if (at >= 0 && !REPO.test(args[at + 1] ?? "")) fail("--repo needs owner/name after it");
  let repo = at >= 0 ? args[at + 1] : process.env.GITHUB_REPOSITORY;
  if (!repo) try {
    repo = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim())?.[1];
  } catch { /* (no origin) */ }
  if (!REPO.test(repo ?? "")) fail("the repository is not known: give --repo owner/name, or run in a clone of it");
  // (page by page: a cloud session's gh cannot follow pages by itself)
  const pages = (path, jq) => {
    const rows = [];
    for (let page = 1; page <= 500; page++) {
      const out = execFileSync("gh", ["api", `${path}&per_page=100&page=${page}`, "--jq", jq],
        { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1 << 28 });
      const got = out.split("\n").filter(Boolean).map(l => JSON.parse(l));
      rows.push(...got);
      if (got.length < 100) break;
    }
    return rows;
  };
  const comments = pages(`repos/${repo}/issues/comments?sort=created`,
    ".[] | [(.issue_url | split(\"/\") | last), .created_at, .author_association, .body] | @json")
    .map(([issue, at, who, body]) => ({ issue, at, body, writer: WRITERS.includes(who) }));
  if (!open) return console.log(print(tally(comments), repo));
  const ideas = pages(`repos/${repo}/issues?state=open&labels=enhancement`,
    ".[] | select(.pull_request | not) | [(.number | tostring), .title, .author_association] | @json")
    .map(([issue, title, who]) => ({ issue, title, writer: WRITERS.includes(who) }));
  const { none, later, others } = lacking(ideas, comments);
  console.log([`Open ideas in ${repo} with no verdict of the stand-in's: ${none.length}`, ...none.map(i => `  #${i.issue} ${plain(i.title)}`),
    `Open ideas whose last verdict is a "later": ${later.length}`, ...later.map(i => `  #${i.issue} ${plain(i.title)}`),
    ...(others ? [`Left out: ${others} filed by other accounts, data until the owner's own comment takes one up (floor rule 4)`] : [])].join("\n"));
}

if (started(import.meta.url)) main(process.argv.slice(2));
