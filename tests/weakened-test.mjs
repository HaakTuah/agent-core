// Tests of the reader of tests a pull request edits (weakened.mjs; tasks/code-shape.md, "A test taken out or weakened
// is said"; #307): which lines it lists, what it leaves, the mend the description check gives, and the read of a
// merge commit against its base, the test files named by the shape check's config as the base holds it. Node's own
// modules and git.
//
//   node tests/weakened-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { ASSERT, LINE, SKIP, baseOf, changedMend, testsChanged, weakened } from "../scripts/weakened.mjs";
import { scratchDir, projectOf } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// ---- the lines it reads ----
for (const l of ["assert.equal(sum([1, 2, 3]), 6);", "  expect(total).toBe(6);", "ok(r.status === 0, \"x\");", "Assert.Equal(6, Sum(1, 2, 3));", "    assert total == 6", "self.assertEqual(total, 6)", "\tt.Errorf(\"got %d\", got)", "require.NoError(t, err)", "total.Should().Be(6);", "XCTAssertEqual(total, 6)", "    assert_eq!(sum(&[1, 2, 3]), 6);", "assert!(ok);", "  assert_equal 6, sum([1, 2, 3])", "  refute_nil total"])
  ok(ASSERT.test(l), `an assertion is read: ${l.trim()}`);
for (const l of ["const total = sum([1, 2]);", "import assert from \"node:assert/strict\";", "const fs = require(\"node:fs\");", "// equal parts"])
  ok(!ASSERT.test(l), `no assertion: ${l.trim()}`);
for (const l of ["it.skip(\"sums\", () => {", "test.only(\"sums\", () => {", "xit(\"sums\", () => {", "[Fact(Skip = \"later\")]", "[Ignore]", "@pytest.mark.skip(reason=\"later\")", "#[ignore]", "    pytest.skip(\"later\")", "\tt.Skip(\"later\")", "@Disabled", "test(\"sums\", { skip: !hasGit }, () => {", "test(\"sum() of none\", { skip: true }, () => {", "test(\"sum() of none\", { timeout: 9, only: true }, () => {", "test(\"sums\", { skip: true }, () => {", "test(\"sums\", { timeout: 1000, skip: true }, () => {", "  skip: \"until #9\",", "this.skip();"])
  ok(SKIP.test(l), `a skip is read: ${l.trim()}`);
for (const l of ["test(\"sums\", { timeout: 1000, skip: false }, () => {", "test(\"sums\", { skip: false }, () => {", "it(\"skips the blank lines\", () => {", "const skipped = rows.filter(r => r.skip);", "ok(x, \"comment-only: a step\", y);", "const o = { only: \"copies.yml\" };", "const kept = { skip: [] };", "// todo: later"])
  ok(!SKIP.test(l), `no skip: ${l.trim()}`);

{
  const long = `${".assert".repeat(100000)}`;
  ASSERT.test(long.slice(0, 1000)); SKIP.test(long.slice(0, 1000));
  ok(weakened(`diff --git a/t.test.mjs b/t.test.mjs\n--- a/t.test.mjs\n+++ b/t.test.mjs\n@@ -1 +0,0 @@\n-${long}`).length === 0, "a line of 700 KB is read by its first part");
  ok(weakened(`diff --git a/t.test.mjs b/t.test.mjs\n--- a/t.test.mjs\n+++ b/t.test.mjs\n@@ -1 +0,0 @@\n-${" ".repeat(1000)}assert(x)`).length === 0, "an assertion past the part of a line that is read is not read");
}

// ---- a diff ----
const DIFF = [
  "diff --git a/test/sum.test.mjs b/test/sum.test.mjs", "index 1..2 100644", "--- a/test/sum.test.mjs", "+++ b/test/sum.test.mjs",
  "@@ -3,3 +3,2 @@", "-assert.equal(sum([1, 2, 3]), 6);", "-assert.equal(sum([2]), 2);", "+assert.ok(sum([2]) > 0);", " console.log(\"ok\");",
  "diff --git a/test/moved.test.mjs b/test/moved.test.mjs", "--- a/test/moved.test.mjs", "+++ b/test/moved.test.mjs",
  "@@ -1 +1 @@", "-assert.equal(a, 1);", "@@ -9 +8 @@", "+assert.equal(a, 1);",
  "diff --git a/test/gone.test.mjs b/test/gone.test.mjs", "deleted file mode 100644", "--- a/test/gone.test.mjs", "+++ /dev/null", "@@ -1,2 +0,0 @@", "-import assert from \"node:assert\";", "-assert.ok(true);",
  "diff --git a/test/new.test.mjs b/test/new.test.mjs", "new file mode 100644", "--- /dev/null", "+++ b/test/new.test.mjs", "@@ -0,0 +1,2 @@", "+test.skip(\"later\", () => {});", "+assert.ok(true);",
  "diff --git a/test/stricter.test.mjs b/test/stricter.test.mjs", "--- a/test/stricter.test.mjs", "+++ b/test/stricter.test.mjs", "@@ -1 +1 @@", "-assert.ok(sum([2]) > 0);", "+assert.equal(sum([2]), 2);",
  "diff --git a/test/plain.test.mjs b/test/plain.test.mjs", "--- a/test/plain.test.mjs", "+++ b/test/plain.test.mjs", "@@ -1 +1 @@", "-const x = 1;", "+const x = 2;",
].join("\n");
const found = weakened(DIFF), byFile = Object.fromEntries(found.map(f => [f.file, f]));
ok(found.map(f => f.file).join() === "test/sum.test.mjs,test/gone.test.mjs,test/new.test.mjs,test/stricter.test.mjs", "each test file with an assertion out or changed, or a skip added, is named; a moved line and a plain change are not", JSON.stringify(found));
ok(found.map(f => f.weaker).join() === "true,true,true,false", "a file left with fewer lines that assert, or with a skip added, is weaker; one whose assertion is only changed is not", JSON.stringify(found.map(f => f.weaker)));
ok(byFile["test/sum.test.mjs"].asserts.length === 2 && byFile["test/sum.test.mjs"].skips.length === 0, "an assertion taken out and one changed are both listed, for the reviewer to rule on");
ok(byFile["test/gone.test.mjs"].asserts.join() === "assert.ok(true);", "a deleted file is named by its header, its assertions listed");
ok(byFile["test/new.test.mjs"].skips.length === 1 && !byFile["test/new.test.mjs"].asserts.length, "a skip added is listed; an assertion added is not");
{
  const twice = weakened("diff --git a/t.test.mjs b/t.test.mjs\n--- a/t.test.mjs\n+++ b/t.test.mjs\n@@ -2 +1,0 @@\n-assert.equal(actual, 1);\n@@ -5 +3,0 @@\n-assert.equal(actual, 1);\n@@ -8,0 +7 @@\n+assert.equal(actual, 1);");
  ok(twice.length === 1 && twice[0].asserts.length === 1 && twice[0].weaker, "a line added once cancels one taken out and no more: two taken out and one added leaves one, and the file weaker", JSON.stringify(twice));
}
{
  const smoke = weakened("diff --git a/test/smoke.test.mjs b/test/smoke.test.mjs\ndeleted file mode 100644\n--- a/test/smoke.test.mjs\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-import { run } from \"../src/run.mjs\";\n-run([1, 2]);");
  ok(smoke.length === 1 && smoke[0].deleted && smoke[0].weaker && /`test\/smoke\.test\.mjs` \(deleted\)/.test(changedMend("", smoke)), "a test file deleted is weaker and named, though no line of it asserts by a pattern", JSON.stringify(smoke));
  const added = weakened("diff --git a/test/x.test.mjs b/test/x.test.mjs\n--- a/test/x.test.mjs\n+++ b/test/x.test.mjs\n@@ -1 +1 @@\n-deleted file mode 100644\n+x");
  ok(added.length === 0, "a line of a file's body that reads like git's header is no deletion", JSON.stringify(added));
}
ok(weakened("").length === 0 && weakened(null).length === 0, "no diff, nothing found");

// ---- the mend ----
const mend = changedMend("## Readings taken\nNone.", found);
ok(mended(`FAIL ${mend}`, { from: projectOf() }) && mend.includes("`test/sum.test.mjs` (2 assertion lines taken out or changed)") && mend.includes("`test/new.test.mjs` (1 skip added)") && mend.includes(`"${LINE}"`), "a description that names none fails with its mend, each file and what was found in it", mend);
ok(changedMend(`Readings…\n\n${LINE} \`test/sum.test.mjs\` (the case moved to sum-cases); \`test/gone.test.mjs\` (it proved nothing)\n- \`test/new.test.mjs\`: skipped until #9 lands\n\nWaits on: a review`, found) === null, "the line and the lines right after it, to a blank line, name each: no mend");
ok(/`test\/new\.test\.mjs`/.test(changedMend(`${LINE} \`test/sum.test.mjs\`, \`test/gone.test.mjs\`\n\n\`test/new.test.mjs\``, found) ?? ""), "a file named only past the blank line is not named on the line");
ok(changedMend("no line", []) === null, "nothing found asks nothing");
ok(!mend.includes("test/stricter.test.mjs"), "an assertion only changed asks nothing of the description: the reviewer rules on it from the list");
ok(changedMend("", [{ file: "test/a\u001b[2J\u202e.mjs", asserts: ["x"], skips: [], weaker: true }]).includes("`test/a?[2J?.mjs`"), "a file's name is printed with no control or bidirectional character");

// ---- a merge commit against its base, in a scratch repository ----
const tmp = scratchDir("weakened-test-");
const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
const git = (...a) => execFileSync("git", a, { cwd: tmp, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const put = (f, t) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), t); };
// (a name git quotes: with a quotation mark where the file system takes one, which Windows does not, else a non-ASCII letter)
const odd = process.platform === "win32" ? "q\u00e9b" : "q\"b";
git("init", "-q", "-b", "main");
put("core-manifest.md", "# Core manifest\n\n| *shape check* | `checks/shape.json` |\n");
put("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src/"], tests: ["test/"] }));
put("test/sum.test.mjs", "assert.equal(sum([1, 2, 3]), 6);\nassert.equal(sum([2]), 2);\n");
put("other/check.mjs", "assert.equal(1, 1);\n");
put(`test/${odd}.test.mjs`, "assert.equal(1, 1);\nassert.equal(2, 2);\n");
git("add", "-A"); git("commit", "-q", "-m", "base");
git("checkout", "-q", "-b", "pr");
put("test/sum.test.mjs", "assert.equal(sum([2]), 2);\n");
put("other/check.mjs", "");
put(`test/${odd}.test.mjs`, "assert.equal(1, 1);\n");
put(".gitattributes", "test/** -diff\n");
git("commit", "-q", "-am", "pr");
put("test/sum.test.mjs", "assert.equal(sum([2]), 2);\ntest.skip(\"later\", () => {});\n");
put("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src/"], tests: ["nowhere/"] }));
git("commit", "-q", "-am", "pr, its last commit");
git("update-ref", "refs/remotes/origin/main", "main");
const files = r => r?.map(f => f.file).sort().join();
ok(files(testsChanged(tmp, "HEAD^1")) === "test/sum.test.mjs", "on a branch head, its first parent is only its last commit", JSON.stringify(testsChanged(tmp, "HEAD^1")));
const head = testsChanged(tmp, baseOf(tmp));
ok(files(head) === `test/${odd}.test.mjs,test/sum.test.mjs` && head.find(f => f.file === "test/sum.test.mjs").skips.length === 1, "on a branch head that is no merge, it is read whole, against where it left origin/main", JSON.stringify(head));
ok(files(testsChanged(tmp, baseOf(tmp, "main"))) === files(head), "--base <ref> reads it against where it left that ref");
ok(baseOf(tmp, "--output=x") === null && testsChanged(tmp, "--output=x") === null && testsChanged(tmp, "") === null, "a ref or base that would read as an option reads as not read, and never reaches git");
// (a branch head that merged its base in: main gains a test of its own, which the pull request's reading leaves out)
git("checkout", "-q", "main"); put("test/main.test.mjs", "assert.equal(1, 1);\n"); git("add", "-A"); git("commit", "-q", "-m", "main's own");
put("test/main.test.mjs", ""); git("commit", "-q", "-am", "main empties its own test");
git("update-ref", "refs/remotes/origin/main", "main");
git("checkout", "-q", "pr"); git("merge", "-q", "--no-ff", "-m", "merge main into pr", "main");
ok(files(testsChanged(tmp, baseOf(tmp))) === files(head), "a branch head that merged its base in is read against where it left origin/main: its own lines, none of its base's", JSON.stringify(testsChanged(tmp, baseOf(tmp))));
git("checkout", "-q", "main"); git("update-ref", "-d", "refs/remotes/origin/main"); git("merge", "-q", "--no-ff", "-m", "merge", "pr");
ok(baseOf(tmp) === git("rev-parse", "HEAD^1").trim(), "where origin/main cannot be read, a merge commit is read against its first parent, the base");
const read = testsChanged(tmp, baseOf(tmp));
ok(read?.map(f => f.file).sort().join() === `test/${odd}.test.mjs,test/sum.test.mjs` && read.every(f => f.asserts.length === 1 && f.weaker), "a merge commit is read against its base: the tests the base's config names, never a file outside them, not as the pull request's own config would have it, a name git would quote read as its own, and as text whatever the pull request's attributes say", JSON.stringify(read));
git("checkout", "-q", "-b", "untested");
put("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src/"], tests: [] })); git("commit", "-q", "-am", "no tests named");
put("test/sum.test.mjs", ""); git("commit", "-q", "-am", "a test emptied");
ok(testsChanged(tmp, "HEAD^1") === null, "a base whose config names no tests reads as not read, never as nothing found", JSON.stringify(testsChanged(tmp, "HEAD^1")));
git("checkout", "-q", "--orphan", "alone"); git("commit", "-q", "-m", "a commit with no parent");
ok(testsChanged(tmp) === null && baseOf(tmp, "untested") === null && testsChanged(tmp, baseOf(tmp, "untested")) === null, "a commit with no base to read against reads as not read", String(testsChanged(tmp)));

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
