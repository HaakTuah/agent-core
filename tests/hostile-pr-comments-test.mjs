// Hostile tests for one input the core reads (floor topic 5, "Every named input has hostile tests"): the comments and
// reviews on a pull request, their bodies and authors, as GitHub's API gives them. They are read by the security-review
// check (security-review.mjs: judge, codexState, codexs, reviewersOf, named, commentsAlone, standsFrom, whole), the
// code-review wait (code-review-wait.mjs: judge) and the size check's reader of the "Leanness check:" answer (size.mjs:
// answered, raised, capsOf, and its run with --raise), the tools reader (tools-read.mjs: tally, said), and the late
// findings' reader (review-marks.mjs: repliersOf, lateOf; look.mjs: lateFinding), whose replier's login goes into a
// request's route. Each case is
// refused: nothing of it is taken as a review, an answer, a commit or a pass, nor a tool's name past the line it stands on. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/hostile-pr-comments-test.mjs
import { spawnSync } from "../scripts/check-runs.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { judge as codeJudge } from "../scripts/code-review-wait.mjs";
import { mended } from "../scripts/mend.mjs";
import { CODEX, codexState, codexs, commentsAlone, judge, named, reviewersOf, standsFrom, status, whole } from "../scripts/security-review.mjs";
import { lateFinding } from "../scripts/look.mjs";
import { lateOf, repliersOf } from "../scripts/review-marks.mjs";
import { answered as answeredBy, capsOf, raised as raisedBy, whoseOf } from "../scripts/size.mjs";
// (the size check counts an answer from the repository's owner, "someone" here, with no right read)
const owner = whoseOf("someone", []), answered = (comments) => answeredBy(comments, owner), raised = (base, head, comments) => raisedBy(base, head, comments, capsOf(head), owner);
import { NONE, said as toolsSaid, tally } from "../scripts/tools-read.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const HEAD = "a".repeat(40), BASE = "d".repeat(40), OTHER = "e".repeat(40);
// (the owner is "someone", an invented login; the repository is no real one)
const pull = { state: "open", draft: false, head: { sha: HEAD }, base: { repo: { owner: { login: "someone" }, full_name: "someone/project" } }, commits: 1, changed_files: 1 };
const commits = [{ sha: HEAD, parents: [{ sha: BASE }] }];
const files = [{ filename: "src/a.js", status: "modified" }];
const said = (body, more = {}) => ({ user: { login: "someone", type: "User" }, author_association: "OWNER", created_at: "2026-11-12T11:00:00Z", updated_at: "2026-11-12T11:00:00Z", body, ...more });
const bot = { login: CODEX, type: "Bot" };
const summary = (security, more = {}) => ({ user: bot, author_association: "NONE", updated_at: "2026-11-12T10:00:00Z", body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { commit_sha: HEAD, status: "completed" }, security_review: security })} -->\n`, ...more });
// the verdict on these comments, and whether it waits with its mend said
const sec = (comments, p = pull) => judge(p, comments, [], commits, files);
const refused = (v) => v?.done === false && mended(status(v, false).description);
const right = `Security review: ${HEAD}`;
const lean = (body, more) => said(body, more);
// the size check's own text, and a base whose builder's cap is one step lower, so that the head raises it
const sizeText = fs.readFileSync(fileURLToPath(new URL("../scripts/size.mjs", import.meta.url)), "utf8");
const base = sizeText.replace(/^  builder: (\d+) \* 1024,$/mu, (_, n) => `  builder: ${Number(n) - 1} * 1024,`);
const lacks = (comments) => /no comment that opens "Leanness check:" from the owner or a person the host lets write\. Mend: /u.test(raised(base, sizeText, comments) ?? "");
// what the code review waits on, outside the core's own repository, a file of code changed
const code = (comments, p = pull, f = files) => codeJudge(p, comments, commits, f);

ok(sec([said(right)]).done === true && lacks([]) && raised(base, sizeText, [lean("Leanness check: too little room")]) === null && code([said(`Code review: ${HEAD}`)]).done === true,
  "the readers take a right review, answer and code review: so each refusal below is the case's");

// ---- too long ----
{
  let t = Date.now();
  const crowd = Array.from({ length: 30_000 }, (_, i) => said(right, { author_association: "NONE", user: { login: `stranger${i}`, type: "User" } }));
  ok(refused(sec(crowd)) && Date.now() - t < 5000, "thirty thousand comments of strangers each naming the head: no review, read in a few seconds");
  t = Date.now();
  ok(sec([...crowd, said(right)]).done === true && Date.now() - t < 5000, "the owner's one among them is still found");
  t = Date.now();
  ok(sec([said(`Security review: ${"a".repeat(5_000_000)}`)]).done === false && named("f".repeat(5_000_000)).length === 0 && Date.now() - t < 5000, "five megabytes of hex names no commit, in a few seconds");
  t = Date.now();
  ok(sec([said(`Security review: ${"x ".repeat(2_500_000)}${HEAD}`)]).done === true && Date.now() - t < 5000, "a five-megabyte review naming the head at its end is read rightly");
  const big = summary({ status: "completed", commit_sha: HEAD, note: "x".repeat(5000) });
  ok(codexState([big]).unread === true && sec([big]).warning !== undefined && refused(sec([big])), "a Codex state line past its 4000 characters cannot be read: a warning, and the check waits");
  t = Date.now();
  const many = Array.from({ length: 50_000 }, () => lean("Leanness check: none", { author_association: "NONE" }));
  ok(!answered(many) && answered([...many, lean("Leanness check: none")]) && Date.now() - t < 5000, "fifty thousand answers of no one with a say count for nothing, the one with a say counts, in a few seconds");
  t = Date.now();
  ok(code(crowd.map(c => ({ ...c, body: `Code review: ${HEAD}` }))).done === false && Date.now() - t < 5000, "and the code review wait, thirty thousand of them: no code review");
  t = Date.now();
  const chain = Array.from({ length: 20_000 }, (_, i) => ({ sha: i.toString(16).padStart(40, "0"), parents: [{ sha: (i + 1).toString(16).padStart(40, "0") }, { sha: OTHER }] }));
  const walked = standsFrom({ commits: chain.length }, chain, chain[0].sha).size;
  ok(walked >= chain.length && walked <= chain.length + 1 && Date.now() - t < 5000, "a chain of twenty thousand merges from main is walked in a few seconds, no further than its commits");
}

// ---- the wrong type ----
{
  for (const [what, body] of [["a number", 42], ["an object", { text: right }], ["an array", [right]], ["null", null]]) {
    ok(refused(sec([said(body)])) && !answered([lean(body)]) && code([said(body)]).done === false, `a comment whose body is ${what} is no review, no answer, no code review`);
  }
  ok(refused(sec([said(right, { author_association: ["OWNER"] })])) && refused(sec([said(right, { author_association: "owner" })])) && !answered([lean("Leanness check: x", { author_association: "owner" })]), "an author's say that is a list, or not GitHub's own word, counts for nothing");
  ok(refused(sec([said(right, { user: { login: ["someone"] } })])) && refused(sec([said(right, { user: "someone" })])), "an author whose login is a list, or a user that is text, counts for nothing");
  for (const [what, comments] of [["text", right], ["a number", 7], ["an object", { 0: said(right), length: 1 }]]) {
    ok(refused(sec(comments)) && !answered(comments) && code(comments).done === false, `comments that are ${what}, not a list, hold no review`);
  }
  ok(!codexs({ user: bot, body: 42 }) && !codexs({ user: { login: CODEX, type: "User" }, body: "x" }), "a comment of Codex's with a body not text, or its login on a user, is not Codex's");
  ok(refused(sec([summary("completed")])) && refused(sec([summary({ status: ["completed"], commit_sha: HEAD })])) && refused(sec([summary({ status: "completed", commit_sha: [HEAD] })])), "a Codex state of the wrong shape, its status a list, or its commit a list, proves no review of the head");
  ok(reviewersOf(["someone"]).length === 0 && reviewersOf(42).length === 0, "the accounts named, given not as text, name none");
  ok(capsOf(42) === null && capsOf({ builder: 1 }) === null, "a base of size.mjs that is not text sets no caps");
}

// ---- markup ----
{
  for (const body of [`> ${right}`, `<!-- -->${right}`, `x\n${right}`, ` ${right}`, `<b>${right}</b>`, `<script>${right}</script>`, `\`${right}\``]) {
    ok(refused(sec([said(body)])), `a review line quoted, after markup or a first line, or in code is no review: ${JSON.stringify(body.slice(0, 24))}`);
  }
  ok(refused(sec([said(`Security review: <a href="x">${HEAD.slice(0, 20)}</a>${HEAD.slice(20)}</a>`)])), "a commit split by markup is named by none of its halves");
  ok(refused(sec([said(`Security review: ${HEAD}a`)])) && refused(sec([said(`Security review: ${HEAD.slice(1)}`)])), "forty-one or thirty-nine hex characters name no commit");
  const fake = { ...summary({ status: "completed", commit_sha: HEAD }), user: { login: CODEX, type: "User" } };
  ok(refused(sec([fake])) && codexState([fake]).state === undefined && refused(sec([{ ...fake, user: { login: "chatgpt-codex-connector", type: "Bot" } }])), "a Codex summary posted by a user under its login, or by a bot without [bot], is no summary");
  ok(refused(sec([said(summary({ status: "completed", commit_sha: HEAD }).body)])), "the owner's comment holding a copy of Codex's summary is no summary");
  const since = { ...summary({ status: "running", commit_sha: HEAD }), body: `${summary({ status: "running" }).body}| 🔒 **Security Review** | 🔄 **Running** since <relative-time datetime="<script>">` };
  ok(refused(sec([since, said(right, { created_at: "2026-11-12T09:00:00Z" })])), "a running row whose time is markup moves its start to the summary's change, never before: an older review waits");
  ok(!commentsAlone(`> checked head ${HEAD}\n> comments and steps' names alone in .github/`, HEAD) && !commentsAlone(`checked head ${HEAD}<!--\n-->comments and steps' names alone in .github/`, HEAD), "comment-only.mjs's printout quoted, or after markup, is no proof");
  for (const body of ["> Leanness check: none", "<!-- -->Leanness check: none", "x\nLeanness check: none", "`Leanness check:` none"]) ok(!answered([lean(body)]), `a leanness answer quoted, after markup or in code is none: ${JSON.stringify(body)}`);
  ok(code([said(`> Code review: ${HEAD}`), said(`<p>Code review: ${HEAD}</p>`)]).done === false, "a code review quoted or in a tag is none");
}

// ---- a file path ----
{
  for (const p of ["../../etc/passwd", "/etc/passwd", "C:\\Windows\\System32", "core/../x"]) {
    ok(refused(sec([said(`Security review: ${p}`)])) && named(p).length === 0 && reviewersOf(p).length === 0 && code([said(`Code review: ${p}`)]).done === false, `a path where a commit or an account is expected, ${p}, names neither`);
    ok(judge({ ...pull, head: { sha: p } }, [said(right)], [], commits, files) === undefined && codeJudge({ ...pull, head: { sha: p } }, [], commits, files) === undefined, `a head named ${p} is nothing to mark`);
    ok(refused(sec([said(right)], { ...pull, base: { repo: { owner: { login: p } } } })), `an owner's login ${p} makes no one's review count`);
    ok(refused(sec([summary({ status: "completed", commit_sha: p })])), `Codex's review on a commit ${p} proves no review of the head`);
  }
  ok(code([], pull, [{ filename: "core/../AGENTS.md", status: "modified" }, { filename: "docs/../.github/x.md", status: "modified" }]).done === false, "a docs file whose path climbs into the rule files still needs a code review");
  const r = runSize(path.join("..", "..", "nowhere", "size.mjs"), "[]");
  ok(r.status === 1 && mended(r.stderr) && !/\n\s+at /u.test(r.stderr), "run, a base path that leads nowhere fails with its mend, no stack");
}

// ---- a number out of range ----
{
  for (const n of [NaN, Infinity, 1e21, 1.5, "1"]) {
    ok(!whole({ changed_files: n }, files) && standsFrom({ commits: n }, [{ sha: HEAD, parents: [{ sha: BASE }, { sha: OTHER }] }], HEAD).size === 1, `a count of files or commits of ${n} proves no list whole and no update from main`);
  }
  const huge = sec([said(right)], { ...pull, changed_files: 1e21 });
  ok(refused(huge) && huge.why.includes("floor rule 3"), "a huge count of files reads the list as cut short: two reviews asked");
  const running = summary({ status: "running", commit_sha: HEAD }, { updated_at: "2026-11-12T10:00:00Z" });
  for (const at of ["+275760-09-13T00:00:00.001Z", "9999-99-99T99:99:99Z", "", 0]) {
    ok(refused(sec([running, said(right, { created_at: at })])), `while Codex's runs, a review dated ${JSON.stringify(at)} is not after it began`);
  }
  ok(refused(sec([summary({ status: "running" }, { updated_at: "not a date" }), said(right, { created_at: "2030-01-01T00:00:00Z" })])), "a summary whose change cannot be dated lets no review count as after it");
  const open = { status: "completed", commit_sha: HEAD, has_unresolved_findings: true };
  ok(refused(sec([summary(open, { updated_at: "never" }), said(right, { created_at: "2030-01-01T00:00:00Z" })])), "an open finding on a summary that cannot be dated: no review settles it");
  ok(refused(judge(pull, [summary(open), said(right)], [{ user: bot, created_at: "+999999-01-01T00:00:00Z", body: "<!-- codex-security-review-finding:v1 -->" }], commits, files)), "a finding dated out of range is taken as the newest: no review after it");
  for (const line of ["  builder: 9999999 * 1024,", "  builder: 0 * 1024,", "  builder: -1 * 1024,", "  builder: 1e3 * 1024,"]) {
    ok(capsOf(`export const CAPS = {\n${line}\n};\n`) === null, `a cap ${line.trim()} sets nothing`);
  }
}

// ---- nothing at all ----
{
  for (const [what, comments] of [["undefined", undefined], ["null", null], ["empty text", ""], ["an empty list", []], ["an empty object", {}], ["a list of nothing", [null, undefined, {}, [], [[]]]]]) {
    ok(refused(sec(comments)) && !answered(comments) && lacks(comments) && code(comments).done === false && codexState(comments).state === undefined, `comments that are ${what}: no review, no answer, no code review, each wait with its mend`);
  }
  ok(judge(undefined, []) === undefined && judge(null, []) === undefined && judge({}, []) === undefined && codeJudge(undefined, []) === undefined, "no pull request is nothing to mark, and nothing throws");
  ok(reviewersOf(undefined).length === 0 && reviewersOf("").length === 0 && named(undefined).length === 0 && !commentsAlone(undefined, HEAD) && !commentsAlone("", HEAD), "no text names no account, no commit, no proof");
  ok(refused(sec([said("Security review:")])) && !answered([lean("")]) && code([said("Code review:")]).done === false, "a review line with nothing after it names nothing");
  ok(raised(null, sizeText, []) !== null && mended(`FAIL: ${raised(null, sizeText, [])}`) && capsOf("") === null, "no base of size.mjs: the raise cannot be told, and the check says its mend");
  ok(runSize(null, JSON.stringify([lean("Leanness check: too little room")])).status === 0, "run, a right answer passes the raise: so the refusals below are the comments'");
  for (const text of ["", "null", "{}", "[]", "42"]) {
    const r = runSize(null, text);
    ok(r.status === 1 && mended(r.stderr) && !/\n\s+at /u.test(r.stderr), `run, comments of ${JSON.stringify(text)} answer no raise: it fails with its mend, no stack`);
  }
  for (const script of ["security-review.mjs", "code-review-wait.mjs"]) for (const text of ["", "not json", null]) {
    const r = runReview(script, text);
    ok(r.status === 1 && mended(r.stderr) && !/\n\s+at /u.test(r.stderr) && !r.stdout.trim(), `run, ${script} with comments ${text === null ? "that are not there" : `of ${JSON.stringify(text)}`} fails with its mend, no stack and no status`);
  }
}

// the review checks run on a scratch pull request and comments (none written where the text is null)
function runReview(script, commentsText) {
  const tmp = scratchDir("hostile-pr-comments-test-");
  try {
    fs.writeFileSync(path.join(tmp, "pull.json"), "{}");
    if (commentsText !== null) fs.writeFileSync(path.join(tmp, "comments.json"), commentsText);
    return spawnSync(process.execPath, [fileURLToPath(new URL(`./${script}`, new URL("../scripts/", import.meta.url))), "pull.json", "comments.json"], { cwd: tmp, encoding: "utf8", timeout: 20000 });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// the size check run with --raise on a scratch base and comments: its base the one lower step, unless one is named
function runSize(baseFile, commentsText) {
  const tmp = scratchDir("hostile-pr-comments-test-");
  try {
    fs.writeFileSync(path.join(tmp, "base.mjs"), base);
    fs.writeFileSync(path.join(tmp, "comments.json"), commentsText);
    return spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/size.mjs", import.meta.url)), "--raise", baseFile ?? "base.mjs", "comments.json"], { cwd: tmp, encoding: "utf8", timeout: 20000, env: { ...process.env, OWNER: "someone" } });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// the tools reader: what a pull request's description, reviews and comments name as their tool (#481)
{
  const odd = [null, undefined, 5, {}, [], "x"];
  const t = tally(odd.map(body => ({ login: "o", type: "User", body, reviews: odd.map(b => ({ login: b, type: b, body: b })), comments: odd.map(b => ({ login: b, type: "Bot", body: b })) })), "o");
  ok(t.builders.length === 1 && t.builders[0][0] === NONE && t.reviewers.length === 0, "tools-read.mjs: bodies and authors of no form name no builder and no reviewer");
  const bodies = tally(["Claude Code", "Codex", "GitHub Copilot"].map((tool, i) => ({ login: `not-a-tool-${i}[bot]`, type: "Bot", number: i + 1, body: `x\n\n🤖 Generated with [${tool}](https://e.invalid)`, reviews: [], comments: [] })), "o");
  ok(bodies.builders.length === 1 && bodies.builders[0][0] === NONE && bodies.builders[0][1] === 3, "tools-read.mjs: a bot's body names no builder, only its login on the list of the tools' bots does (#901)", JSON.stringify(bodies.builders));
  const marked = tally([{ login: "o", type: "User", body: "x\n🤖 Generated with [<img src=x onerror=alert(1)>\u0007::error::](https://e.invalid)", reviews: [{ login: "x\n::error::y", type: "Bot", body: "" }], comments: [{ login: "o", type: "User", body: "Security review: x\n\nGenerated by [](https://e.invalid)" }, { login: "a", type: "User", body: "Security review: x\n\nGenerated by [Their Tool](https://e.invalid)" }] }], "o");
  const printed = toolsSaid("o/r", [{ number: 1 }], marked);
  ok(!/\n::/.test(printed) && !printed.includes("\u0007") && marked.reviewers.length === 1, "tools-read.mjs: a tool's name or a bot's login with markup or a control character is only quoted, never starts a line of the log, an empty name is none, and another person's comment names no tool");
  const big = "Generated with [".repeat(1 << 18), at = Date.now();
  tally([{ login: "o", type: "User", body: big, reviews: [{ login: "b", type: "Bot", body: big }], comments: [{ login: "o", type: "User", body: `Code review: ${big}` }] }], "o");
  ok(Date.now() - at < 3000, `tools-read.mjs: bodies of 4 MB of half-made attribution lines are read in ${Date.now() - at} ms`);
}

// the late findings' reader (review-marks.mjs: repliersOf, lateOf; look.mjs: lateFinding): a replier's login goes into
// the route of a request for its right, so a login that is not GitHub's own form, an account that is no person's, or a
// reply whose association may not write, is asked for nothing, and answers no finding
{
  const badge = "<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>";
  const find = { id: 1, pull_request_url: "https://api.github.com/repos/o/r/pulls/7", html_url: "https://github.com/o/r/pull/7#discussion_r1", created_at: "2026-11-18T10:00:00Z", user: bot, body: `${badge} A finding` };
  const reply = (user, more = {}) => ({ id: 2, in_reply_to_id: 1, pull_request_url: "https://api.github.com/repos/o/r/pulls/7", created_at: "2026-11-18T11:00:00Z", user, author_association: "MEMBER", body: "Done.", ...more });
  const logins = ["../../admin", "a/b", "a?per_page=1", "a%2Fb", "a#b", "<b>x</b>", "a b", "a\nb", "-a", "a".repeat(40), "", 123, null, undefined, {}];
  const hostile = [...logins.map(login => reply({ login, type: "User" })), reply(null), reply(undefined), reply("someone"), reply({ login: "someone", type: "Bot" }), reply({ login: "someone", type: "Organization" }),
    reply({ login: "someone", type: "User" }, { author_association: "NONE" }), reply({ login: "someone", type: "User" }, { author_association: "CONTRIBUTOR" }), reply({ login: "someone", type: "User" }, { author_association: ["MEMBER"] }),
    reply({ login: "someone", type: "User" }, { in_reply_to_id: "1" }), reply({ login: "someone", type: "User" }, { in_reply_to_id: null })];
  for (const c of hostile) {
    const routes = [], seen = [];
    const gh = route => { routes.push(route); if (route.startsWith("repos/o/r/pulls/comments")) return JSON.stringify(/page=1$/.test(route) ? [find, c] : []); if (/collaborators\//.test(route)) return JSON.stringify({ role_name: "admin", permission: "admin", user: { login: "someone", type: "User", permissions: { push: true } } }); return JSON.stringify({ merged_at: "2026-11-18T09:00:00Z" }); };
    lateFinding("o/r", (title, what) => seen.push(what), "2026-11-18T12:00:00Z", gh);
    ok(repliersOf([find, c]).length === 0 && !routes.some(r => /collaborators\//.test(r)) && /discussion_r1/.test(seen[0] ?? ""),
      `review-marks.mjs: a reply from ${String(JSON.stringify(c.user)).slice(0, 60)}, ${JSON.stringify(c.author_association)}, to ${JSON.stringify(c.in_reply_to_id)}, is asked no right and answers no finding`);
  }
  // and where a right is read, only the host's answer for that very person counts: another's answer, or a bot's, is none
  const member = reply({ login: "someone", type: "User" }), merged = new Map([[7, "2026-11-18T09:00:00Z"]]);
  ok(lateOf([find, member], merged, "", new Set(["other"])).length === 1 && lateOf([find, member], merged, "", new Set()).length === 1 && lateOf([find, member], merged).length === 1 && lateOf([find, member], merged, "", new Set(["someone"])).length === 0,
    "review-marks.mjs: a reply answers a finding only where the rights read name its own author");
}

process.exit(failed ? 1 : 0);
