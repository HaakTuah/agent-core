// Tests the marks check (scripts/pattern.mjs; AGENTS.md, "A rule is written to one pattern"; #1137): a rule a change
// adds fails for each mark it lacks, with its mend, and passes with all of them; a rule worded anew is reported and
// fails nothing; one whose own text is unchanged, one moved to another file and one marked "describes" alone are not
// read; a rule's own text leaves out the rules nested in it. Then the check itself, called beneath the process, on this
// repository against a base and without one, on a base that is no commit, and where no rule is read. Its tests workflow runs it on every pull request here. Node's own modules.
//
//   node tests/pattern-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { judge, lacking, main, report } from "../scripts/pattern.mjs";
import { rulesOf } from "../scripts/rules.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parts = text => lacking(text).map(m => m.part);

const whole = "By default x. Nothing changes it. It does not mean y. Reason: z. Held by `scripts/x.mjs`.";
ok(!parts(whole).length, "a rule with its reason, its holder and \"Nothing changes it.\" lacks nothing");
ok(!parts("By default x. The one condition that changes it: w. Reason: z. Held, in part, by a check.").length
  && !parts("x. Nothing changes it. Reason: z. Held in part by a, and by nothing yet for b.").length
  && !parts("x. Nothing changes it. Reason: z. Held, for the pass, by its issue.").length
  && !parts("x. Nothing changes it. Reason: z. Held, in the core, by its test.").length
  && !parts("x. Nothing changes it. Reason: z. Held here by `own-description.yml`.").length
  && !parts("x. Nothing changes it. Reason: z. Held by nothing yet.").length, "each form of a holder the rules use is read, and one condition");
ok(String(parts("By default x. Nothing changes it. Held by a check.")) === "no reason", "a rule with no \"Reason:\" lacks its reason");
ok(String(parts("By default x. Nothing changes it. Reason: z. Its holder is a check.")) === "no holder"
  && String(parts("By default x. Nothing changes it. Reason: z. Upheld by a check.")) === "no holder", "a rule with no \"Held … by\" lacks its holder");
ok(String(parts("By default x. Reason: z. Held by a check.")) === "no condition", "a rule with neither \"Nothing changes it.\" nor a condition lacks its condition");
ok(String(parts("By default x. The one condition that changes it: a. The one condition that changes it: b. Reason: z. Held by a check.")) === "two conditions",
  "a rule with two conditions is read as having two");

// a scratch rule file, as rules.mjs reads it, before and after a change
const file = "tasks/x.md";
const base = rulesOf(file, ["# X", "", `**Stands.** ${whole}`, "", "**Stood bare.** By default x.", "", "**Moved.** By default x.", "", "**Describes.** See elsewhere.", ""].join("\n"));
const headText = [
  "# X", "", `**Stands.** ${whole}`, "",
  "**Stood bare.** By default x, worded anew.", "",
  "**Added bare.** By default x. The one condition that changes it: a. The one condition that changes it: b.", "",
  `**Added whole.** ${whole}`, "",
  "**Describes.** See elsewhere, and more.", "",
  "**Points elsewhere.** See the other file.", "",
  `- **Parent.** ${whole}`, "  - **Nested.** By default x.", "",
].join("\n");
const head = [...rulesOf(file, headText), ...rulesOf("tasks/y.md", "**Moved.** By default x.\n")];
const holders = { [`${file}: Points elsewhere`]: "describes", [`${file}: Describes`]: "describes", [`${file}: Nested`]: ["describes", "audit"], [`${file}: Added bare`]: "check: scripts/describes.mjs" };
const { added, changed } = judge(head, base, holders);
const leads = list => list.map(r => r.lead).sort().join(", ");
ok(leads(added) === "Added bare, Added whole, Nested, Parent", "the rules a change adds are those whose lead the base holds nowhere; one moved to another file is not added, one marked \"describes\" alone not read, and one a check of that name holds is read");
ok(String(added.find(r => r.lead === "Added bare").lacks.map(m => m.part)) === "no reason,no holder,two conditions", "a rule added is read for every mark it lacks");
ok(String(added.find(r => r.lead === "Nested").lacks.map(m => m.part)) === "no reason,no holder,no condition"
  && !added.find(r => r.lead === "Parent").lacks.length, "a rule's own text leaves out a rule nested in it, which is read on its own");
ok(leads(changed) === "Moved, Stood bare", "a rule worded anew, or moved, that lacks a mark is reported; one unchanged, or whole, is not");
const out = report(head, base, holders, "base");
ok(out.failed === 6 && out.lines.filter(l => l.startsWith("FAIL")).length === 6 && mended(out.lines.join("\n")), "each mark a rule added lacks fails, by its file and lead, with its mend");
ok(out.lines.some(l => /^tasks\/x\.md: "Stood bare" is worded anew and lacks: no reason, no holder, no condition; reported/u.test(l)), "a rule worded anew is reported with the marks it lacks, and fails nothing");
ok(report(head.filter(r => !r.lead.startsWith("Added") && r.lead !== "Nested"), base, holders, "base").failed === 0, "a change that adds no rule lacking a mark passes");

// the check itself, on this repository, as size.yml runs it
const same = main(["--base", "HEAD"], root);
ok(same.code === 0 && /rules read against HEAD: 0 added, 0 marks missing in them; 0 worded anew/u.test(same.lines.join("\n")), "against its own commit, nothing is added and it passes");
const none = main([], root);
const counted = /^no --base given: nothing failed\. Of (\d+) rules that bind: (\d+) with no reason, (\d+) with no holder, (\d+) with no condition, (\d+) with two conditions$/u.exec(none.lines.join("\n"));
ok(none.code === 0 && counted && Number(counted[1]) > 100 && counted.slice(2).every(n => Number(n) < Number(counted[1])) && Number(counted[4]) > 0,
  "without a base it fails nothing, counts the rules that bind and those that lack each mark, and says so");
const bad = [main(["--base", "--no-such"], root), main(["--base"], root), main(["--base", "no-such-commit"], root)];
ok(bad.every(b => b.code === 1 && mended(b.lines.join("\n")) && /^FAIL --base needs a commit/u.test(b.lines[0])), "a base that is an option, missing or no commit fails, with its mend");
const empty = fs.mkdtempSync(path.join(os.tmpdir(), "pattern-"));
const nothing = main([], empty);
fs.rmSync(empty, { recursive: true, force: true });
ok(nothing.code === 1 && mended(nothing.lines.join("\n")) && /no rule of the floor/u.test(nothing.lines[0]), "where no rule is read it fails, since it would pass anything, with its mend");

console.log(`${count} assertions on the marks check`);
if (failed) { console.error(`${failed} failed`); process.exit(1); }
