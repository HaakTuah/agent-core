// Tests of the reasons a question or idea filed with the core leaves unsaid (reasons-said.mjs; #765): the forms hold the
// heading with one guidance, which names the rule; which issues are read and which are reported; the mend; and long
// bodies read in time. Node's own modules.
//
//   node tests/reasons-said-test.mjs
import fs from "node:fs";
import { quick } from "../scripts/hostile.mjs";
import { HEADING, namesRule, ownWords, reasonsUnsaid, under } from "../scripts/reasons-said.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

const R = `**${HEADING}**`;
const forms = ["question.md", "feature_request.md"].map(f => fs.readFileSync(new URL(`../.github/ISSUE_TEMPLATE/${f}`, import.meta.url), "utf8"));
const guide = under(forms[0], HEADING);
ok(HEADING === "The rule's reasons" && guide && forms.every(f => under(f, HEADING) === guide && namesRule(f)),
  "the question and idea forms hold the heading, with the same guidance, which names the rule", guide);
ok(forms.every(f => !namesRule(ownWords(f)) && under(ownWords(f), HEADING) === "") && ownWords(`${R}\n${guide}\nmine`).endsWith("mine"),
  "a form's own lines are not the filer's: unchanged, it names no rule and says nothing under the heading; the filer's lines stay");

ok(namesRule("see `core/tasks/updates.md`") && namesRule("On roles/shared/inbox.md.") && namesRule("Floor rule 3 reads two ways") && namesRule("floor rule 12, its second point") && namesRule("floor/topics/workflows.md"),
  "a rule is named by a rule file's path, with core/ before it or not, a file of a subfolder too, or as a floor rule");
ok(!namesRule("tasks/nothere.md, core/scripts/labels.mjs, xtasks/updates.md, tasks/updates.mdx, tasks/updates.md.bak") && !namesRule("```\ntasks/updates.md\n```") && !namesRule("<!-- floor rule 3 -->") && !namesRule("the rule on updates"),
  "no rule file, a file that is no rule file, a path inside a longer word, one in a fenced block or a comment, and a rule named by words alone are not");
ok(under(`**${HEADING}**\nx\n  y\n\nFound while: z\n**The kind of project**\nw`, HEADING) === "x y" && under(`## ${HEADING}\n<!-- a -->\n## The kind of project`, HEADING) === "" && under("**Other**\nx", HEADING) === null
  && under(`${R}\n**Its first reason**\nholds not\n**The kind of project**`, HEADING) === "**Its first reason** holds not",
  "the words under the heading, bold or with #, to the next of the forms' headings (a bold line of the filer's own is the filer's), without comments or the Found while line; none where it is not there");

const owner = "someone", me = { login: "Someone" }, other = { login: "another" }, bot = { login: "github-actions[bot]", type: "Bot" };
const late = "2026-12-01T10:00:00Z", early = "2026-11-01T10:00:00Z", since = "2026-11-16T00:00:00Z";
const L = (...n) => n.map(name => ({ name }));
const said = `${R}\nIts reason, one review a change, does not hold: the project has one contributor.`;
const filed = [
  { number: 50, user: me, labels: L("needs-owner", "by:project"), body: "**The rule**\n`core/tasks/updates.md`, its first rule.", created_at: late },
  { number: 51, user: other, labels: L("needs-owner"), body: `**The rule**\nfloor rule 3\n\n${R}\n${guide}`, created_at: late },
  { number: 52, user: other, labels: L("needs-owner"), body: `About roles/shared/inbox.md.\n\n${said}`, created_at: late },
  { number: 53, user: bot, labels: L("needs-owner", "by:look"), body: "A look's issue on tasks/updates.md.", created_at: late },
  { number: 54, user: me, labels: L("queued", "by:builder"), body: "A builder's idea on tasks/updates.md.", created_at: late },
  { number: 55, user: me, labels: ["needs-owner", "by:project"], body: "On core/scripts/labels.mjs.", created_at: late },
  { number: 56, user: other, labels: L("needs-owner"), body: `On \`tasks/updates.md\`.\n\n${R}\n<!-- nothing yet -->\n\n**The kind of project**\nprivate`, created_at: late },
  { number: 57, user: other, labels: L("needs-owner"), body: "On tasks/updates.md, filed before the rule.", created_at: early },
  { number: 58, user: other, labels: L("needs-owner"), body: forms[1], created_at: late },
  { number: 59, user: me, labels: ["by:project"], body: `On tasks/updates.md.\n\n${said}`, created_at: late },
  { number: 60, user: other, labels: L("needs-owner"), body: forms[1].replace(/^The idea in a line or two.*$/mu, "A dry run for `scripts/sync.mjs`."), created_at: late },
  { number: 61, user: other, labels: L("needs-owner"), body: forms[1].replace(/^The file and section, if there is one.*$/mu, "`core/tasks/updates.md`, its first rule."), created_at: late },
  { number: 62, body: "On tasks/updates.md, the day the rule came.", created_at: since },
  { number: 63, user: me, labels: [null, "by:project"], body: "On tasks/updates.md.", created_at: late },
];
const got = reasonsUnsaid({ issues: filed, owner, since });
ok(got.length === 1 && got[0].items.join() === "#50,#51,#56,#61,#62,#63",
  "an issue from a project (by:project, its labels as names or objects, or another account that is no bot, or none given) that names a rule in its own words, with the heading left out, empty or as the form gives it, from the day the rule came, is reported; one that says them, a bot's, an agent's own, one that names no rule (the form's guidance naming one) and one from before the rule are not",
  JSON.stringify(got));
ok(got[0]?.what.includes("reasons.mjs") && got[0].what.includes(HEADING) && /owner's account filed it, edit the issue/.test(got[0].what) && /ask its filer/.test(got[0].what),
  "its mend names the heading, the script that prints the reasons, and who adds them");
ok(reasonsUnsaid({ issues: filed.slice(2, 5), owner, since }).length === 0 && reasonsUnsaid({ issues: null, owner, since }).length === 0 && reasonsUnsaid({ issues: [null, 7, "x"], owner, since }).length === 0,
  "nothing to mend, or a list holding what is no issue: nothing reported, nothing thrown");

ok(quick(() => !namesRule(`${"tasks/".repeat(30000)}x`) && !namesRule(`${"core/floor/a".repeat(20000)}.md`) && under(`${R}\n${"**x\n".repeat(30000)}`, HEADING) !== null
  && under(`${"#".repeat(65000)} x\n${R}`, HEADING) === "" && ownWords(`${"**x\n".repeat(30000)}`).length > 0),
  "a body of any shape, the longest GitHub keeps, is read in a few seconds");

console.log(failed ? `${failed} of ${count} failed` : `${count} of ${count} passed`);
process.exit(failed ? 1 : 0);
