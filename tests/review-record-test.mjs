// Tests of the count of what the reviews find (review-record.mjs): which posted review a comment is and what it declares,
// which inline comments are finds of Codex's and of which review, what each review did on a pull request, the tally by
// kind, the second security review's finds, which bugs are tied to a pull request, and which rules the findings of two
// pull requests name (AGENTS.md, "A finding seen twice becomes a check"), and the trial of #767 read from them
// (builder-trial.mjs: a pull request's kind, builder and effort, and whether one group's numbers come out worse). Node's own modules only; the
// calls to git and gh are the program's own and are not made here.
//
//   node tests/review-record-test.mjs
import { fileURLToPath } from "node:url";
import { FIVE as trialFive, blockingOf as trialBlocking, builderOf, changedOf, effortOf, findingsOf, groupOf, kindOf, print as trialPrint, verdict } from "../scripts/builder-trial.mjs";
import { blockingOf, broughtBy, bugs, codexFind, foundTwice, otherOf, perPull, postedKind, print, ruleOf, rulesIn, rulesNamed, scoreOf, secondFound, stanceOf, standing, tally } from "../scripts/review-record.mjs";

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
  && postedKind("Security review: none needed for 1..2 (tasks/reviews.md)") === "none-needed" && postedKind("**Security review:** none needed for this change.") === "none-needed" && postedKind("**Security review: none needed**") === "none-needed" && postedKind("Leanness check: a fresh session") === null,
  "a posted review is told by its first line; a note that none is needed, and a leanness check, are none");
ok(postedKind("Security review: x\r\nBlocking findings: 1.") === "security" && blockingOf("Security review: x\r\nBlocking findings: 1.\r\nOther findings: 2.\r\n") === 1 && otherOf("Code review: x\r\nOther findings: 2.\r\n") === 2
  && broughtBy("What.\r\nBrought in by: #12\r\n") === 12 && postedKind("Code review:\r\n") === "code",
  "a comment written in the web editor, its lines ending in a carriage return, reads as any other");
const slow = Date.now(); postedKind(`Security review:${" ".repeat(65536)}a\r`);
ok(Date.now() - slow < 200, "a long first line of spaces and a carriage return reads at once", `${Date.now() - slow} ms`);
ok(postedKind("> Security review: quoted\n\nThanks.") === null && postedKind("Thanks.\nSecurity review: not first") === null && postedKind(null) === null, "a quoted first line, a later line and no text are no review");
ok(blockingOf("Security review: x\n\n**Blocking findings: 0.**\n- a") === 0 && blockingOf("Security review: x\nBlocking findings: 2.") === 2
  && blockingOf("Security review: x\nNo blocking finding.") === 0 && blockingOf("Security review: x\n**Nothing blocks.**") === 0
  && blockingOf("Security review: x\nBlocking: none.") === 0 && blockingOf("Security review: x\nNo finding.") === 0 && blockingOf("Code review: x\n**No blocking findings.**") === 0,
  "each form that declares a count reads, with ** round it or without");
ok(blockingOf("Security review: x\nBlocking findings: 2.\n<!--\nBlocking findings: 0.\n-->") === 2 && blockingOf("Security review: x\n```\nBlocking findings: 0.\n```") === null
  && otherOf("Code review: x\n<!-- Other findings: 3. -->\nOther findings: 1.") === 1 && broughtBy("What.\nBrought in by: #12\n<!--\nBrought in by: #13\n-->") === 12
  && broughtBy("What.\n```\nBrought in by: #13\n```") === null, "a count or a \"Brought in by:\" hidden from the reader, in an HTML comment or a fenced block, is not read");
ok(blockingOf("Security review: x\nBlocking findings: 1.\nBlocking findings: 0.") === null && blockingOf("Security review: x\n**Blocking:**\n1. a point") === null
  && blockingOf("Security review: x. **One blocking finding, fixed in 9e7a**") === null && blockingOf("Security review: x\n**The blocking finding is fixed.**") === null
  && blockingOf("Security review: x\nNo blocking finding in the notes, yet more.") === null && blockingOf("Security review: x\nBlocking findings: 1.\nNo blocking finding.") === null && blockingOf(null) === null,
  "lines that disagree, a list, a sentence and any other wording are not read, never none");
ok(blockingOf("Security review: x\nBlocking findings: 2.\nBlocking findings: 2.") === 2 && blockingOf("Security review: x\n**Blocking findings: 0.** Only comments change.") === 0 && blockingOf("Security review: x\nBlocking findings: 12.5 more") === null,
  "the same count twice is read once, and a declaration that opens a sentence reads");
ok(otherOf("Security review: x\nBlocking findings: 1.\nOther findings: 3.") === 3 && otherOf("Code review: x\n**No other finding.**") === 0 && otherOf("Code review: x\nNo other findings.") === 0
  && otherOf("Design check: x\nNo finding.") === 0 && otherOf("Security review: x\nNo blocking finding.") === null && otherOf("Security review: x\nOther findings: 1.\nNo other finding.") === null
  && otherOf("Security review: x\nTwo nits, fixed.") === null && otherOf(null) === null,
  "the other points read from their own line, \"No finding.\" as none of either; a review without the line, or whose lines disagree, is not read for them");
ok(scoreOf("Code review: x\nScore: 8 of 10.") === 8 && scoreOf("Code review: x\n**Score: 10 of 10.**") === 10 && scoreOf("Design check: x\nScore: 1 of 10.\n") === 1
  && [0, 11, "8.5", "08"].every(n => scoreOf(`Code review: x\nScore: ${n} of 10.`) === null) && scoreOf("Code review: x\nScore: 8 of 10.\nScore: 9 of 10.") === null
  && scoreOf("Code review: x\n<!-- Score: 8 of 10. -->") === null && scoreOf("Code review: x\nScore: 8/10") === null && scoreOf(null) === null,
  "the score is read from its own line, a whole number from 1 to 10; one out of range, in another form, hidden, or two that disagree, is not read");

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
ok(same(r.codexCode, { got: true, blocked: "yes", points: 1, other: 1, otherUnread: false }) && same(r.codexSecurity, { got: true, blocked: "no", points: 0, other: 1, otherUnread: false }) && !r.postedCode.got && !r.postedSecurity.got && !r.postedDesign.got,
  "Codex's finds count by review and priority, a reply counts for nothing", JSON.stringify(r));
r = perPull([summary(done(true), done(true)), issue(CODEX, secure("P1"))], [], OWNER);
ok(r.codexSecurity.blocked === "yes" && r.codexSecurity.points === 1 && r.codexCode.blocked === "unread", "a find of Codex's given as an issue comment counts as one, as security-review.mjs reads it");
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
ok(same(r.postedSecurity, { got: true, blocked: "yes", points: 1, other: 0, otherUnread: true }) && r.postedDesign.blocked === "unread" && same(r.postedCode, { got: true, blocked: "no", points: 0, other: 0, otherUnread: true }),
  "posted reviews count by their kind, from the owner's account alone; one in another wording is not read; a note and another account's are no review", JSON.stringify(r));
r = perPull([posted("Security review: a\nNo blocking finding."), posted("Security review: b\nOne finding, fixed in 9e7a.")], [], OWNER);
ok(r.postedSecurity.blocked === "unread" && r.postedSecurity.points === 0, "a round that was not read keeps the review from counting as none");
r = perPull([issue("Some-Owner", "Code review: a\nBlocking findings: 3.")], [], OWNER);
ok(r.postedCode.points === 3, "the owner's login is matched without regard to case");
r = perPull([posted("Security review: a\nBlocking findings: 1.\nOther findings: 2."), posted("Security review: b\nNo blocking finding.\nNo other finding."), posted("Code review: c\nNo blocking finding.\nOther findings: 4.")], [], OWNER);
ok(same(r.postedSecurity, { got: true, blocked: "yes", points: 1, other: 2, otherUnread: false }) && same(r.postedCode, { got: true, blocked: "no", points: 0, other: 4, otherUnread: false }),
  "a review in the form gives its blocking and its other points, each round added", JSON.stringify(r));

// the tally and the second security review
ok(stanceOf("Code review: a\nStance: adversarial.\nNo blocking finding.") === "adversarial" && stanceOf("Code review: a\n**Stance: regular.**") === "regular" && stanceOf("Code review: a\nNo blocking finding.") === null
  && stanceOf("Code review: a\nStance: adversarial.\nStance: regular.") === null && stanceOf("Code review: a\n```\nStance: adversarial.\n```") === null,
  "a posted code review's stance is read from its line alone; none, two that disagree, or one in a fenced block reads as none");
r = perPull([posted("Code review: a\nStance: adversarial.\nBlocking findings: 2.\nOther findings: 1."), posted("Code review: b\nStance: regular.\nNo blocking finding.\nNo other finding."), posted("Code review: c\nNo blocking finding.\nNo other finding.")], [], OWNER);
ok(same(r.postedAdversarial, { got: true, blocked: "yes", points: 2, other: 1, otherUnread: false }) && same(r.postedRegular, { got: true, blocked: "no", points: 0, other: 0, otherUnread: false }) && r.postedCode.points === 2,
  "posted code reviews are counted again by their stance, one that says none in neither row");
const pull = (number, kind, over = {}) => ({ number, kind, reviews: { ...perPull([], [], OWNER), ...over } });
const rv = (blocked, points = 0, other = 0, otherUnread = false) => ({ got: true, blocked, points, other, otherUnread });
const pulls = [pull(1, "own", { codexSecurity: rv("no"), postedSecurity: rv("yes", 2) }), pull(2, "own", { codexSecurity: rv("no"), postedSecurity: rv("unread", 0, 0, true) }), pull(3, "upkeep", { codexSecurity: rv("yes", 1), postedSecurity: rv("yes", 1) }),
  pull(4, "sync", { codexSecurity: { got: false, blocked: null, points: 0, other: 0, otherUnread: false }, postedSecurity: rv("yes", 1, 3) }), pull(5, "own", { codexCode: rv("yes", 2, 1) })];
const t = tally(pulls);
ok(same(t.postedSecurity.own, { merged: 3, got: 2, blocked: 1, unread: 1, points: 2, other: 0, otherUnread: 1 }) && same(t.postedSecurity.sync, { merged: 1, got: 1, blocked: 1, unread: 0, points: 1, other: 3, otherUnread: 0 })
  && same(t.codexCode.own, { merged: 3, got: 1, blocked: 1, unread: 0, points: 2, other: 1, otherUnread: 0 }) && t.postedDesign.update.merged === 0, "the tally counts by review and by kind", JSON.stringify(t.postedSecurity));
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
ok(same({ ...got, byPull: [...got.byPull].sort() }, { filed: 6, tied: 3, byKind: { own: 2, upkeep: 1, sync: 0, update: 0 }, byPull: [[10, 2], [11, 1]], unlined: 1, unmatched: 2, others: 1 }),
  "a bug is tied only by the owner's account's line, to a pull request merged before it, the newest line winning; the rest are not read, by why", JSON.stringify(got));

// the printout
const text = print("some-one/x", null, pulls, t, got);
ok(/Codex's security review: on no pull request read/.test(text) === false && /Design check posted: on no pull request read/.test(text) && /Second security review blocked where Codex's read no blocking point: 1 \(#1\)/.test(text)
  && /Bugs filed by the owner's account: 6; tied to a pull request that merged before: 3 \(own 2, upkeep 1\); not read: 3 \(no line 1, a line naming no pull request read that merged before it 2\); filed by other accounts, left out: 1/.test(text),
  "the printout says what ran on no pull request, the second review's finds and the bugs", text);
ok(/Codex's code review\n/.test(text) && /^own +3 +1 +1 +0 +2 +1$/m.test(text) && /^update +- +- +- +- +- +-$/m.test(text), "a review that ran prints its table by kind");
ok(/other points +other not read\n/.test(text) && /^own +3 +2 +1 +1 +2 +0 +1$/m.test(text) && /^sync +1 +1 +1 +0 +1 +3 +0$/m.test(text) && /^update +- +- +- +- +- +- +-$/m.test(text),
  "a posted review's table gives its other points and how many reviews were not read for them", text);
const fewer = print("some-one/x", null, [], tally([]), { filed: 2, tied: 0, byKind: { own: 0, upkeep: 0, sync: 0, update: 0 }, unlined: 2, unmatched: 0, others: 0 });
ok(/Bugs filed by the owner's account: 2; tied to a pull request that merged before: 0; not read: 2\n/.test(fewer), "bugs with no line are not read, with no breakdown where every one lacks it", fewer);
const none = print("some-one/x", "2026-11-01", [pull(1, "own")], tally([pull(1, "own")]), bugs([], [], new Map(), OWNER));
ok(["Codex's code review", "Codex's security review", "Design check posted"].every(n => none.includes(`${n}: on no pull request read`)) && /from 2026-11-01/.test(none) && !/\n\S+ +1 +0 +0 +0 +0/.test(none),
  "where no review ran it says so and prints no row of zeros", none);

// the rules the findings name, and those found twice
ok(ruleOf("`floor/security.md: 1. Nothing secret in the repository`.") === "floor/security.md: 1. nothing secret in the repository"
  && ruleOf("**core/roles/shared/how-to-work.md:  \"One fact, one place\"**") === "roles/shared/how-to-work.md: one fact, one place" && ruleOf("x".repeat(400)).length === 300,
  "a rule is read as one key however it is written, its quotes, bold, backticks, stop, case and a leading core/ aside, and no longer than 300");
ok(standing().has(ruleOf("`floor/security.md: Test data is never real:`")) && ruleOf("a.md: One,") === "a.md: one" && ruleOf("a.md: One:.") === "a.md: one",
  "a closing colon or comma is left out as a rule's own key leaves it out, so a lead copied with it still names the rule");
ok(ruleOf("a.md:\u001b[31m one\u0000\u202e two\u200b") === "a.md:[31m one two", "a key holds no control or format character, so none reaches a terminal or an issue");
const stand = standing(), core = fileURLToPath(new URL("..", import.meta.url));
ok(stand?.has("floor/security.md: 1. nothing secret in the repository") && stand.has("tasks/reviews.md: a finding seen twice becomes a check") && stand.has("agents.md: reports from projects") && stand.has("core-changes/projects.md: a check that fails says the mend") && [...stand].some(k => k.startsWith("security.md: ")) && !stand.has("agents.md: forged")
  && !standing(core, "/nonexistent/x").has("agents.md: reports from projects") && !standing(core, "/nonexistent/x").has("core-changes/projects.md: a check that fails says the mend") && standing(core, "/nonexistent/x").has("floor/security.md: 1. nothing secret in the repository") && standing("/nonexistent/x", "/nonexistent/y")?.size === 0,
  "the rules that stand are read as a finding's line keys them: the core's, and the project's own AGENTS.md and SECURITY.md where it has them, and the core's own core-changes/ in its own repository (#1202)");
ok(same(rulesIn("Why.\nRule: `AGENTS.md: A check that fails says the mend`\r\n- **Rule:** tasks/tests.md: Tests\n> Rule: quoted.md: no\nThe Rule: inside a sentence\nRule:\nRule:   "),
  ["agents.md: a check that fails says the mend", "tasks/tests.md: tests"]),
  "a rule is named on a line of its own that opens Rule:, in a list or bold too; a quoted line, one inside a sentence and an empty one name none");
const ruled = (p, rule) => `${badge(p)}\nRule: ${rule}`;
ok(same(rulesNamed([posted("Security review: x\nBlocking findings: 1.\n1. A key in a log.\n   Rule: floor/security.md: 1. Nothing secret in the repository"), posted("Thanks.\nRule: a.md: never"), issue("someone-else", "Code review: x\nRule: b.md: never")],
  [inline(CODEX, ruled("P2", "tasks/tests.md: Tests")), inline(CODEX, ruled("P1", "tasks/tests.md: tests."), { in_reply_to_id: 4 }), inline("someone-else", ruled("P1", "c.md: never")), inline(CODEX, "Rule: d.md: never")], OWNER),
  ["floor/security.md: 1. nothing secret in the repository", "tasks/tests.md: tests"]),
  "a pull request's rules come from Codex's finds, of any priority, and the owner's posted reviews, once each; a reply, another account's comment, a comment that is no review and Codex's words with no badge name none");
const at = (number, when, rules) => ({ number, when, rules });
const twice = foundTwice([at(5, "2026-10-02T10:00:00Z", ["a.md: one", "b.md: two"]), at(9, "2026-11-03T10:00:00Z", ["a.md: one"]), at(7, "2026-10-20T10:00:00Z", ["b.md: two", "a.md: one"]), at(3, "2026-10-01T10:00:00Z", ["c.md: three"]), at(4, "2026-10-01T10:00:00Z", ["c.md: three"])]);
ok(same(twice, [{ rule: "a.md: one", pulls: [5, 7, 9] }, { rule: "b.md: two", pulls: [5, 7] }, { rule: "c.md: three", pulls: [3, 4] }]),
  "a rule named on two pull requests or more is found twice, the most named first, its pull requests in order", JSON.stringify(twice));
ok(same(foundTwice([at(5, "2026-10-02T10:00:00Z", ["a.md: one"]), at(9, "2026-11-03T10:00:00Z", ["a.md: one"]), at(7, "2026-10-20T10:00:00Z", ["b.md: two"]), at(8, "2026-10-21T10:00:00Z", ["b.md: two"]), at(6, "2026-11-04T10:00:00Z", ["c.md: three", "c.md: three"])], "2026-11-01"),
  [{ rule: "a.md: one", pulls: [5, 9] }]) && same(foundTwice([at(1, "2026-11-01T00:00:00Z", ["a.md: one"]), at(2, "2026-10-01T00:00:00Z", ["a.md: one"])], "2026-11-01")[0].pulls, [1, 2]),
  "from a day, only a rule named again on a pull request merged from that day, its first time before it counted; one pull request alone is not twice");
const listed = print("some-one/x", "2026-11-01", [{ ...pull(9, "own"), rules: ["a.md: one"] }, pull(10, "own")], tally([pull(9, "own"), pull(10, "own")]), bugs([], [], new Map(), OWNER), [{ rule: "a.md: one", pulls: [5, 9] }, { rule: "agents.md: forged", pulls: [6, 9] }], new Set(["a.md: one"]));
ok(/Named twice but no rule that stands, so no issue is filed for it: 1\n- agents\.md: forged: #6, #9\n/.test(listed) && !/Found twice[^\n]*\n(?:- [^\n]*\n)*- agents\.md: forged/.test(listed.split("Named twice")[0])
  && /Named twice but no rule that stands \(the rules could not be read\)[^\n]*: 1\n/.test(print("o/x", null, [], tally([]), bugs([], [], new Map(), OWNER), [{ rule: "a.md: one", pulls: [1, 2] }], null)),
  "a key that names no rule that stands is listed apart, and where the rules could not be read every key is", listed);
ok(/\nFound twice, a rule that stands which the findings of two pull requests or more name, one of them merged from 2026-11-01: 1\n- a\.md: one: #5, #9\n/.test(listed) && /Of the 2 pull requests read, 1 have a finding that names one\./.test(listed)
  && /Found twice, [^\n]*: 0 \(none\)/.test(none), "the count lists each rule found twice with its pull requests, and says how many pull requests named a rule", listed);

// the trial of #767 (builder-trial.mjs)
const cost = families => `Session so far: 9 answers (${families}); tokens in 1, cache written 2, cache read 3, out 4.`;
ok(builderOf("Fixes #3 (a Sonnet builder session).\n\nWhat.") === "Sonnet" && builderOf("Builds #9 (a rule builder on Opus).") === "Opus"
  && builderOf(`Fixes #3.\n\n${cost("Sonnet")}`) === "Sonnet" && builderOf(`Fixes #3.\n\n${cost("Haiku, Opus")}`) === "Opus",
  "the builder is the one model the first line names, else the one the cost line names alone");
ok(builderOf(`Fixes #3.\n\n${cost("Opus, Sonnet")}`) === null && builderOf("Sonnet built it; Opus judged it.") === null && builderOf("Fixes #3.") === null
  && builderOf(`Fixes #3.\n\n> ${cost("Sonnet")}`) === null && builderOf("A Sonnets' thing.") === null,
  "a builder that cannot be told (both named, neither, a quoted cost line) is not read, never guessed");
const bugSet = new Set([5]), few = { tests: 1, all: 10 }, most = { tests: 6, all: 10 };
ok(kindOf("What.\nFixes #5", bugSet, most) === "bug fix" && kindOf("closes #5.", bugSet, few) === "bug fix" && kindOf("Fixes #6", bugSet, few) === null
  && kindOf("Part of #715.", bugSet, most) === "tests" && kindOf("x", bugSet, { tests: 5, all: 10 }) === null && kindOf("x", bugSet, { tests: 0, all: 0 }) === null && kindOf("Fixes #50", bugSet, few) === null,
  "a bug fix closes an issue labelled bug; a rework of tests changes more than half its lines under tests/; anything else is neither");
ok(kindOf("x\nTrial kind: tests", bugSet, few) === "tests" && kindOf("Fixes #5\nTrial kind: neither", bugSet, most) === null && kindOf("Trial kind: bug fix", bugSet, few) === "bug fix",
  "a line \"Trial kind:\" overrides what was read");
ok(same(changedOf("3\t2\ttests/a-test.mjs\n4\t1\tscripts/a.mjs\n-\t-\ttests/b.png\n1\t0\tdocs/tests/x.md\n"), { tests: 5, all: 11 }),
  "the lines changed count under tests/ alone, a binary file none");
ok(verdict([1, 2, 3], [1, 2, 3]) === "no worse within noise" && verdict([9, 10, 11], [1, 2, 3]) === "worse, by 8.00 a pull request" && verdict([2, 3, 4], [1, 2, 3]) === "no worse within noise"
  && verdict([1], [1, 2]) === "too few to tell" && verdict([2, 2], [1, 1]) === "worse, by 1.00 a pull request" && verdict([1, 1], [2, 2]) === "no worse within noise",
  "Sonnet is worse only where its mean is above Opus's by more than twice the standard error of the difference");
const ran = (blocked, points, other = 0, otherUnread = false) => ({ got: true, blocked, points, other, otherUnread }), idle = { got: false, blocked: null, points: 0, other: 0, otherUnread: false };
const five = (code, security) => ({ codexCode: code, postedCode: idle, codexSecurity: security, postedSecurity: idle, postedDesign: idle });
ok(trialBlocking(five(ran("yes", 2, 3), ran("no", 0, 1))) === 2 && findingsOf(five(ran("yes", 2, 3), ran("no", 0, 1))) === 6
  && trialBlocking(five(ran("yes", 2), ran("unread", 0))) === null && findingsOf(five(ran("yes", 2), ran("unread", 0))) === null
  && trialBlocking(five(ran("no", 0, 1, true), idle)) === 0 && findingsOf(five(ran("no", 0, 1, true), idle)) === null && findingsOf(five(idle, idle)) === 0,
  "the trial's findings are each review's, blocking and other, and unknown where a count of a review that ran was not read, never none");
const staged = { ...five(ran("yes", 1, 1), idle), postedCode: ran("yes", 2, 1), postedAdversarial: ran("yes", 2, 1), postedRegular: idle };
ok(trialBlocking(staged) === 3 && findingsOf(staged) === 5 && same(trialFive, ["codexCode", "postedCode", "codexSecurity", "postedSecurity", "postedDesign"]),
  "a posted code review counted again by its stance is counted once in the trial, and every other review is counted");
ok(effortOf("Fixes #3 (a builder on Sonnet at medium).") === "medium" && effortOf("Fixes #3, on Sonnet at High.") === "high" && effortOf("Fixes #3, a high-risk fix.") === null
  && effortOf("at medium, then at high") === null && effortOf("x\non Sonnet at medium") === null,
  "the effort is the one the first line names, \"at medium\" or \"at high\"; anything else is not read");
ok(groupOf({ model: "Opus", effort: null }, "model") === "Opus" && groupOf({ model: null, effort: "high" }, "model") === null
  && groupOf({ model: "Sonnet", effort: "medium" }, "effort") === "Sonnet at medium" && groupOf({ model: "Opus", effort: "high" }, "effort") === null && groupOf({ model: "Sonnet", effort: null }, "effort") === null,
  "the groups are Sonnet and Opus, or with --effort Sonnet at medium and at high");
const row = (number, kind, group, findings, extra = {}) => ({ number, kind, group, findings, blocking: 0, rounds: 1, bugs: 0, answers: 10, out: 5, into: 100, ...extra });
const trial = trialPrint("o/r", "2026-11-18", [
  row(1, "bug fix", "Sonnet", 1, { rounds: 2 }), row(2, "bug fix", "Opus", 3, { rounds: null, answers: null, out: null, into: null }),
  row(3, "tests", null, 0), row(4, "tests", "Sonnet", 9), row(5, "tests", "Sonnet", 10), row(6, "tests", "Opus", 1), row(7, "tests", "Opus", 2),
]);
ok(/Sonnet built 3 of the 20[^\n]*, 1 of them bug fixes/.test(trial) && /bug fix, Sonnet\s+1\s+1 \(1\)\s+0 \(1\)\s+2 \(1\)/.test(trial) && /bug fix, Opus\s+1\s+3 \(1\)\s+0 \(1\)\s+-/.test(trial)
  && /- bug fix: findings too few to tell; rounds too few to tell; bugs that reached main too few to tell/.test(trial)
  && /- tests: findings worse, by 8\.00 a pull request; rounds no worse within noise; bugs that reached main no worse within noise/.test(trial)
  && !/answers (too|no|worse)/.test(trial) && /In neither group [^\n]*: #3/.test(trial),
  "the trial's printout gives each kind and group, what was read of each, a verdict kind by kind on what decides, and the pull requests in neither group", trial);
const second = trialPrint("o/r", "2026-12-01", [row(1, "bug fix", "Sonnet at medium", 1), row(2, "bug fix", "Sonnet at high", 1)], "effort");
ok(/second trial of #767, of effort alone/.test(second) && /Sonnet at medium and at high built 2 of the 20 /.test(second) && /bug fix, Sonnet at high\s+1/.test(second) && /Sonnet at medium against Sonnet at high/.test(second),
  "with --effort the printout sets Sonnet at medium against Sonnet at high, and counts the twenty of both", second);

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
