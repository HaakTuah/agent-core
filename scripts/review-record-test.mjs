// Tests of the count of what the reviews find (review-record.mjs): which posted review a comment is and what it declares,
// which inline comments are finds of Codex's and of which review, what each review did on a pull request, the tally by
// kind, the second security review's finds, and which bugs are tied to a pull request. Node's own modules only; the
// calls to git and gh are the program's own and are not made here.
//
//   node scripts/review-record-test.mjs
import { blockingOf, broughtBy, bugs, codexFind, perPull, postedKind, print, secondFound, tally } from "./review-record.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const OWNER = "some-owner", CODEX = "chatgpt-codex-connector[bot]";
const badge = p => `**<sub><sub>![${p} Badge](https://img.shields.io/badge/${p}-orange?style=flat)</sub></sub> A point**\n\nWhy.`;
const secure = p => `<!-- codex-security-review-finding:v1 -->\n\n### 🛡️ Codex Security Review\n\n${badge(p)}`;
const inline = (login, body, extra = {}) => ({ user: { login, type: login.endsWith("[bot]") ? "Bot" : "User" }, body, in_reply_to_id: null, ...extra });
const issue = (login, body, type = login.endsWith("[bot]") ? "Bot" : "User") => ({ user: { login, type }, body, updated_at: "2026-11-12T10:00:00Z" });
const summary = (code, security) => issue(CODEX, `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: code, security_review: security })} -->\n`);
const done = (has = false) => ({ status: "completed", has_any_findings: has });
const posted = body => issue(OWNER, body);

// a posted review: the kind, and the one form that gives its blocking points
ok(postedKind("Security review: the fallback reviewer's.") === "security" && postedKind("**Security review:** a fresh") === "security"
  && postedKind("Code review: of 42b5") === "code" && postedKind("\n\nDesign check: 31bb") === "design" && postedKind("**Code review:** x") === "code"
  && postedKind("Security review: none needed for 1..2 (modules/reviews.md)") === "none-needed" && postedKind("Leanness check: a fresh session") === null,
  "a posted review is told by its first line; a note that none is needed, and a leanness check, are none");
ok(postedKind("> Security review: quoted\n\nThanks.") === null && postedKind("Thanks.\nSecurity review: not first") === null && postedKind(null) === null, "a quoted first line, a later line and no text are no review");
ok(blockingOf("Security review: x\n\n**Blocking findings: 0.**\n- a") === 0 && blockingOf("Security review: x\nBlocking findings: 2.") === 2
  && blockingOf("Security review: x\nNo blocking finding.") === 0 && blockingOf("Security review: x\n**Nothing blocks.**") === 0
  && blockingOf("Security review: x\nBlocking: none.") === 0 && blockingOf("Security review: x\nNo finding.") === 0 && blockingOf("Code review: x\n**No blocking findings.**") === 0,
  "each form that declares a count reads, with ** round it or without");
ok(blockingOf("Security review: x\nBlocking findings: 1.\nBlocking findings: 0.") === null && blockingOf("Security review: x\n**Blocking:**\n1. a point") === null
  && blockingOf("Security review: x. **One blocking finding, fixed in 9e7a**") === null && blockingOf("Security review: x\n**The blocking finding is fixed.**") === null
  && blockingOf("Security review: x\nNo blocking finding in the notes, yet more.") === null && blockingOf("Security review: x\nBlocking findings: 1.\nNo blocking finding.") === null && blockingOf(null) === null,
  "lines that disagree, a list, a sentence and any other wording are not read, never none");
ok(blockingOf("Security review: x\nBlocking findings: 2.\nBlocking findings: 2.") === 2 && blockingOf("Security review: x\n**Blocking findings: 0.** Only comments change.") === 0 && blockingOf("Security review: x\nBlocking findings: 12.5 more") === null,
  "the same count twice is read once, and a declaration that opens a sentence reads");

// Codex's finds
ok(same(codexFind(inline(CODEX, badge("P1"))), { review: "code", badge: "P1", blocking: true }) && codexFind(inline(CODEX, badge("P2"))).blocking === false
  && same(codexFind(inline(CODEX, secure("P1"))), { review: "security", badge: "P1", blocking: true }) && codexFind(inline(CODEX, badge("P0"))).blocking === true && codexFind(inline(CODEX, badge("P3"))).blocking === false,
  "a P-badge is a find of Codex's, security where its marker opens it, and blocks at P0 and P1");
ok(codexFind(inline(CODEX, badge("P1"), { in_reply_to_id: 5 })) === null && codexFind(inline(CODEX, "Thanks, fixed.")) === null
  && codexFind(inline("someone-else", badge("P1"))) === null && codexFind(inline(OWNER, secure("P1"))) === null && codexFind(inline(CODEX, badge("P1"), { user: { login: CODEX, type: "User" } })) === null,
  "a reply, a comment with no badge, another account's copy, and a User named like the bot are no find of Codex's");

// one pull request
let r = perPull([summary(done(true), done(false)), issue(CODEX, "<!-- codex-review-receipt:v1 -->\nCodex Review")],
  [inline(CODEX, badge("P1")), inline(CODEX, badge("P2")), inline(CODEX, badge("P1"), { in_reply_to_id: 3 }), inline(CODEX, secure("P2"))], OWNER);
ok(same(r.codexCode, { got: true, blocked: "yes", points: 1, other: 1 }) && same(r.codexSecurity, { got: true, blocked: "no", points: 0, other: 1 }) && !r.postedCode.got && !r.postedSecurity.got && !r.postedDesign.got,
  "Codex's finds count by review and priority, a reply counts for nothing", JSON.stringify(r));
r = perPull([summary(done(true), done(false))], [], OWNER);
ok(r.codexCode.blocked === "unread" && r.codexSecurity.blocked === "no", "a summary that says there are finds when none is found is not read, never none");
r = perPull([issue(CODEX, "<!-- codex-pull-request-review-summary -->\nno state here")], [], OWNER);
ok(r.codexCode.got === false && r.codexSecurity.got === false, "a summary that cannot be read is no review that ran");
r = perPull([issue(OWNER, `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: done(), security_review: done() })} -->\n`), issue(OWNER, "<!-- codex-review-receipt:v1 -->\nCodex Review"),
  issue("some-user", "x", "User")], [], OWNER);
ok(!r.codexCode.got && !r.codexSecurity.got, "the owner's account posting a copy of Codex's summary or receipt is no Codex");
r = perPull([issue(CODEX, `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: done(), security_review: done() })} -->\n`, "User")], [], OWNER);
ok(!r.codexCode.got, "a User account named like the bot is no Codex");
r = perPull([], [], OWNER);
ok(Object.values(r).every(v => !v.got && v.blocked === null), "a pull request that got no review has none");

r = perPull([posted("Security review: a\n**Blocking findings: 1.**"), posted("Security review: b\nNo blocking finding."), posted("Design check: c\nEvery part lands."), posted("Code review: d\nBlocking: none."),
  posted("Security review: none needed for 1..2"), posted("Leanness check: fresh"), issue("another-account", "Security review: x\nBlocking findings: 2.")], [], OWNER);
ok(same(r.postedSecurity, { got: true, blocked: "yes", points: 1, other: 0 }) && r.postedDesign.blocked === "unread" && same(r.postedCode, { got: true, blocked: "no", points: 0, other: 0 }),
  "posted reviews count by their kind, from the owner's account alone; one in another wording is not read; a note and another account's are no review", JSON.stringify(r));
r = perPull([posted("Security review: a\nNo blocking finding."), posted("Security review: b\nOne finding, fixed in 9e7a.")], [], OWNER);
ok(r.postedSecurity.blocked === "unread" && r.postedSecurity.points === 0, "a round that was not read keeps the review from counting as none");
r = perPull([issue("Some-Owner", "Code review: a\nBlocking findings: 3.")], [], OWNER);
ok(r.postedCode.points === 3, "the owner's login is matched without regard to case");

// the tally and the second security review
const pull = (number, kind, over = {}) => ({ number, kind, reviews: { ...perPull([], [], OWNER), ...over } });
const rv = (blocked, points = 0, other = 0) => ({ got: true, blocked, points, other });
const pulls = [pull(1, "own", { codexSecurity: rv("no"), postedSecurity: rv("yes", 2) }), pull(2, "own", { codexSecurity: rv("no"), postedSecurity: rv("unread") }), pull(3, "upkeep", { codexSecurity: rv("yes", 1), postedSecurity: rv("yes", 1) }),
  pull(4, "sync", { codexSecurity: { got: false, blocked: null, points: 0, other: 0 }, postedSecurity: rv("yes", 1) }), pull(5, "own", { codexCode: rv("yes", 2, 1) })];
const t = tally(pulls);
ok(same(t.postedSecurity.own, { merged: 3, got: 2, blocked: 1, unread: 1, points: 2, other: 0 }) && same(t.postedSecurity.sync, { merged: 1, got: 1, blocked: 1, unread: 0, points: 1, other: 0 })
  && same(t.codexCode.own, { merged: 3, got: 1, blocked: 1, unread: 0, points: 2, other: 1 }) && t.postedDesign.update.merged === 0, "the tally counts by review and by kind", JSON.stringify(t.postedSecurity));
ok(same(secondFound(pulls), [1]), "the second security review's finds are the pull requests where Codex's read none and it blocked: not where Codex did not run, nor where it was not read");

// bugs
const merged = new Map([[10, { when: "2026-11-10T10:00:00Z", kind: "own" }], [11, { when: "2026-11-11T10:00:00Z", kind: "upkeep" }]]);
const b = (number, at, login, body) => ({ number, at, login, body });
ok(broughtBy("x\nBrought in by: #12\ny") === 12 && broughtBy("Brought in by: #3\nBrought in by: #4") === 4 && broughtBy("see Brought in by: #3") === null && broughtBy("Brought in by: #3 and more") === null && broughtBy(null) === null,
  "the line is read where it stands alone, the last of them");
const got = bugs([
  b(20, "2026-11-12T00:00:00Z", OWNER, "What.\nBrought in by: #10"),                  // tied to a own PR
  b(21, "2026-11-09T00:00:00Z", OWNER, "Brought in by: #10"),                       // filed before it merged
  b(22, "2026-11-12T00:00:00Z", OWNER, "Brought in by: #99"),                       // no merged PR of that number read
  b(23, "2026-11-12T00:00:00Z", "someone-else", "Brought in by: #10"),              // another account
  b(24, "2026-11-12T00:00:00Z", OWNER, "no line, but it names #10 in prose"),       // no line: not tied
  b(25, "2026-11-12T00:00:00Z", OWNER, "Brought in by: #10"),                       // a newer owner comment names another
  b(26, "2026-11-12T00:00:00Z", OWNER, "no line"),                                  // tied later by a comment
], [
  { issue: 25, at: "2026-11-13T00:00:00Z", login: OWNER, body: "Brought in by: #11" },
  { issue: 26, at: "2026-11-13T00:00:00Z", login: OWNER, body: "Brought in by: #10" },
  { issue: 24, at: "2026-11-13T00:00:00Z", login: "someone-else", body: "Brought in by: #10" },
], merged, OWNER);
ok(same(got, { filed: 6, tied: 3, byKind: { own: 2, upkeep: 1, sync: 0, update: 0 }, others: 1 }), "a bug is tied only by the owner's account's line, to a pull request merged before it, the newest line winning", JSON.stringify(got));

// the printout
const text = print("some-one/x", null, pulls, t, got);
ok(/Codex's security review: on no pull request read/.test(text) === false && /Design check posted: on no pull request read/.test(text) && /Second security review blocked where Codex's read no blocking point: 1 \(#1\)/.test(text)
  && /Bugs filed by the owner's account: 6; tied to a pull request that merged before: 3 \(own 2, upkeep 1\); not tied: 3; filed by other accounts, left out: 1/.test(text),
  "the printout says what ran on no pull request, the second review's finds and the bugs", text);
ok(/Codex's code review\n/.test(text) && /^own +3 +1 +1 +0 +2 +1$/m.test(text) && /^update +- +- +- +- +- +-$/m.test(text), "a review that ran prints its table by kind");
const none = print("some-one/x", "2026-11-01", [pull(1, "own")], tally([pull(1, "own")]), bugs([], [], new Map(), OWNER));
ok(["Codex's code review", "Codex's security review", "Design check posted"].every(n => none.includes(`${n}: on no pull request read`)) && /from 2026-11-01/.test(none) && !/\n\S+ +1 +0 +0 +0 +0/.test(none),
  "where no review ran it says so and prints no row of zeros", none);

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
