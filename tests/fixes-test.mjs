// Tests of the lister of fixed bugs for the sign of the record on types (fixes.mjs): which commits fix which issue,
// which files are scripts the checker reads, and the lines a fix changed as they stood before it. Node's own modules;
// the calls to git and gh are the program's own and are not made here, save that it refuses a day that is none.
//
//   node tests/fixes-test.mjs
import { mended } from "../scripts/mend.mjs";
import { scratchHistory } from "../scripts/scratch-shallow.mjs";
import { changedLines, cutShort, fixedBy, fixesOf, NO_DAY, parentsOf, scriptOf, sinceOf } from "../scripts/fixes.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

ok(fixedBy("Fixes #12").join() === "12" && fixedBy("x\n\nfixes #3, closes #4 and Resolved #5").join() === "3,4,5" && fixedBy("Fix: #7").join() === "7",
  "a commit fixes each issue its message says it fixes, closes or resolves, in GitHub's words");
ok(fixedBy("See #12, part of #13").length === 0 && fixedBy("prefixes #9").length === 0 && fixedBy(null).length === 0, "an issue only named, or a word that ends so, is no fix");
ok(scriptOf("scripts/look.mjs") && !scriptOf("tests/look-test.mjs") && !scriptOf("scripts/staged/steps.mjs") && !scriptOf("core/scripts/look.mjs") && !scriptOf("scripts/x.json"),
  "the checker reads a script of scripts/ that is no test");
const diff = [
  "diff --git a/scripts/a.mjs b/scripts/a.mjs", "--- a/scripts/a.mjs", "+++ b/scripts/a.mjs",
  "@@ -3,2 +3,4 @@ function f() {", "-x", "-y", "+x", "+y", "+z", "+w",
  "@@ -10 +12 @@", "-a", "+b",
  "@@ -20,0 +23,2 @@", "+c", "+d",
  "diff --git a/scripts/new.mjs b/scripts/new.mjs", "--- /dev/null", "+++ b/scripts/new.mjs", "@@ -0,0 +1,3 @@", "+n",
].join("\n");
const lines = changedLines(diff);
ok(JSON.stringify(lines) === JSON.stringify({ "scripts/a.mjs": [3, 4, 10, 20] }), "the lines a fix changed are those of the tree before it, an addition placed at the line it follows, and a new file has none", JSON.stringify(lines));
const log = [{ sha: "c3", parent: "c2", message: "Fixes #5" }, { sha: "c2", parent: "c1", message: "Fixes #6, fixes #5" }, { sha: "c1", parent: "c0", message: "Fixes #99" }];
ok(JSON.stringify(fixesOf([5, 6], log)) === JSON.stringify([{ issue: 5, sha: "c3", parent: "c2" }, { issue: 6, sha: "c2", parent: "c1" }, { issue: 5, sha: "c2", parent: "c1" }]),
  "each commit that fixes a closed bug is a fix, a bug fixed twice showing both, and an issue that is no closed bug none");
const [a, b, c] = ["a", "b", "c"].map(x => x.repeat(40));
const read = parentsOf(`${a} ${b} ${c}\n${b} ${c}\n${c}\nHEAD --output=../../target\n${a} --output=x\n\n`);
ok(JSON.stringify(read) === JSON.stringify([{ sha: a, parent: b, second: c }, { sha: b, parent: c, second: null }, { sha: c, parent: null, second: null }]),
  "a commit's hash and parents are read only as whole object ids: a line with anything else, an option among them, is left out", JSON.stringify(read));
ok(fixesOf([5], [{ sha: c, parent: null, message: "Fixes #5" }]).length === 0, "a commit with no parent here is no fix to read");
const merge = { sha: a, parent: b, message: "Merge pull request #9\n\nFixes #5, fixes #6", brought: [{ sha: c, parent: b, message: "The mend. Fixes #5" }] };
ok(JSON.stringify(fixesOf([5, 6], [merge])) === JSON.stringify([{ issue: 6, sha: a, parent: b }, { issue: 5, sha: c, parent: b }]),
  "a merge's word for an issue a commit it brought fixes is that one fix, counted once; one it alone names is its own", JSON.stringify(fixesOf([5, 6], [merge])));
ok(sinceOf(["--since", "2026-11-01"]) === "2026-11-01" && sinceOf(["x", "--since", "2026-11-01", "y"]) === "2026-11-01", "a day is read after the word that asks it");
ok(sinceOf(["--since", "soon"]) === null && sinceOf(["--since"]) === null && sinceOf([]) === null && sinceOf(["2026-11-01"]) === null && sinceOf(["--since", "2026-11-01\nx"]) === null,
  "a day that is none, none given, or a day without the word that asks it is refused");
ok(/^--since takes a day/.test(NO_DAY), "and the refusal says what it takes");

// A shallow clone holds no fix older than its boundary: the lister refuses it, with the mend, before it counts a part as the whole (#1422).
{
  const steps = ["2026-11-01", "2026-11-05", "2026-11-10", "2026-11-15"].map((day, i) => ({ day, subject: `Change ${i + 1} (#${i + 1})`, files: { "scripts/a.mjs": `export const n = ${i};\n` } }));
  const h = scratchHistory("fixes-shallow-", steps), cut = h.clone("cut", "--depth", "2"), whole = h.clone("whole");
  const early = cutShort("2026-11-02", [], cut), late = cutShort("2026-11-20", [], cut), behind = [{ sha: a, parent: b, second: c, brought: [{ sha: c, parent: null }] }];
  ok(typeof early === "string" && /shallow/.test(early) && /--since 2026-11-02 reaches before it/.test(early) && mended(`FAIL: ${early}`), "in a shallow clone a day before its boundary is refused: it says the clone could not hold the span, and its mend", String(early));
  ok(late === null && cutShort("2026-11-02", [], whole) === null, "a day after the boundary is read, and a whole clone is read from any day", String(late));
  const brought = cutShort("2026-11-20", behind, cut);
  ok(/brought commits from behind the clone's boundary/.test(brought) && mended(`FAIL: ${brought}`) && cutShort("2026-11-02", behind, whole) === null, "in a shallow clone a merge that brought commits from behind its boundary is refused too, with its mend", String(brought));
}

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
