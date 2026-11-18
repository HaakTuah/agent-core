// Tests of the reader of tests a pull request edits (weakened.mjs; tasks/code-shape.md, "A test taken out or weakened
// is said"; #307): which lines it lists, what it leaves, the mend the description check gives, and the read of a
// merge commit against its base, the test files named by the shape check's config as the base holds it. Node's own
// modules and git.
//
//   node tests/weakened-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { ASSERT, LINE, SKIP, changedMend, testsChanged, weakened } from "../scripts/weakened.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// ---- the lines it reads ----
for (const l of ["assert.equal(sum([1, 2, 3]), 6);", "  expect(total).toBe(6);", "ok(r.status === 0, \"x\");", "Assert.Equal(6, Sum(1, 2, 3));", "    assert total == 6", "self.assertEqual(total, 6)", "\tt.Errorf(\"got %d\", got)", "require.NoError(t, err)", "total.Should().Be(6);", "XCTAssertEqual(total, 6)"])
  ok(ASSERT.test(l), `an assertion is read: ${l.trim()}`);
for (const l of ["const total = sum([1, 2]);", "import assert from \"node:assert/strict\";", "const fs = require(\"node:fs\");", "// equal parts"])
  ok(!ASSERT.test(l), `no assertion: ${l.trim()}`);
for (const l of ["it.skip(\"sums\", () => {", "test.only(\"sums\", () => {", "xit(\"sums\", () => {", "[Fact(Skip = \"later\")]", "[Ignore]", "@pytest.mark.skip(reason=\"later\")", "\tt.Skip(\"later\")", "@Disabled", "test(\"sums\", { skip: true }, () => {", "this.skip();"])
  ok(SKIP.test(l), `a skip is read: ${l.trim()}`);
for (const l of ["test(\"sums\", { skip: false }, () => {", "it(\"skips the blank lines\", () => {", "const skipped = rows.filter(r => r.skip);"])
  ok(!SKIP.test(l), `no skip: ${l.trim()}`);

// ---- a diff ----
const DIFF = [
  "diff --git a/test/sum.test.mjs b/test/sum.test.mjs", "index 1..2 100644", "--- a/test/sum.test.mjs", "+++ b/test/sum.test.mjs",
  "@@ -3,3 +3,2 @@", "-assert.equal(sum([1, 2, 3]), 6);", "-assert.equal(sum([2]), 2);", "+assert.ok(sum([2]) > 0);", " console.log(\"ok\");",
  "diff --git a/test/moved.test.mjs b/test/moved.test.mjs", "--- a/test/moved.test.mjs", "+++ b/test/moved.test.mjs",
  "@@ -1 +1 @@", "-assert.equal(a, 1);", "@@ -9 +8 @@", "+assert.equal(a, 1);",
  "diff --git a/test/gone.test.mjs b/test/gone.test.mjs", "deleted file mode 100644", "--- a/test/gone.test.mjs", "+++ /dev/null", "@@ -1,2 +0,0 @@", "-import assert from \"node:assert\";", "-assert.ok(true);",
  "diff --git a/test/new.test.mjs b/test/new.test.mjs", "new file mode 100644", "--- /dev/null", "+++ b/test/new.test.mjs", "@@ -0,0 +1,2 @@", "+test.skip(\"later\", () => {});", "+assert.ok(true);",
  "diff --git a/test/plain.test.mjs b/test/plain.test.mjs", "--- a/test/plain.test.mjs", "+++ b/test/plain.test.mjs", "@@ -1 +1 @@", "-const x = 1;", "+const x = 2;",
].join("\n");
const found = weakened(DIFF), byFile = Object.fromEntries(found.map(f => [f.file, f]));
ok(found.map(f => f.file).join() === "test/sum.test.mjs,test/gone.test.mjs,test/new.test.mjs", "each test file with an assertion out or changed, or a skip added, is named; a moved line and a plain change are not", JSON.stringify(found));
ok(byFile["test/sum.test.mjs"].asserts.length === 2 && byFile["test/sum.test.mjs"].skips.length === 0, "an assertion taken out and one changed are both listed, for the reviewer to rule on");
ok(byFile["test/gone.test.mjs"].asserts.join() === "assert.ok(true);", "a deleted file is named by its header, its assertions listed");
ok(byFile["test/new.test.mjs"].skips.length === 1 && !byFile["test/new.test.mjs"].asserts.length, "a skip added is listed; an assertion added is not");
ok(weakened("").length === 0 && weakened(null).length === 0, "no diff, nothing found");

// ---- the mend ----
const mend = changedMend("## Readings taken\nNone.", found);
ok(mended(`FAIL ${mend}`) && mend.includes("`test/sum.test.mjs` (2 assertion lines out or changed)") && mend.includes("`test/new.test.mjs` (1 skip added)") && mend.includes(`"${LINE}"`), "a description that names none fails with its mend, each file and what was found in it", mend);
ok(changedMend(`Readings…\n\n${LINE} \`test/sum.test.mjs\` (the case moved to sum-cases); \`test/gone.test.mjs\` (it proved nothing)\n- \`test/new.test.mjs\`: skipped until #9 lands\n\nWaits on: a review`, found) === null, "the line and the lines right after it, to a blank line, name each: no mend");
ok(/`test\/new\.test\.mjs`/.test(changedMend(`${LINE} \`test/sum.test.mjs\`, \`test/gone.test.mjs\`\n\n\`test/new.test.mjs\``, found) ?? ""), "a file named only past the blank line is not named on the line");
ok(changedMend("no line", []) === null, "nothing found asks nothing");

// ---- a merge commit against its base, in a scratch repository ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "weakened-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
const git = (...a) => execFileSync("git", a, { cwd: tmp, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const put = (f, t) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), t); };
git("init", "-q", "-b", "main");
put("core-manifest.md", "# Core manifest\n\n| *shape check* | `checks/shape.json` |\n");
put("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src/"], tests: ["test/"] }));
put("test/sum.test.mjs", "assert.equal(sum([1, 2, 3]), 6);\nassert.equal(sum([2]), 2);\n");
put("other/check.mjs", "assert.equal(1, 1);\n");
git("add", "-A"); git("commit", "-q", "-m", "base");
git("checkout", "-q", "-b", "pr");
put("test/sum.test.mjs", "assert.equal(sum([2]), 2);\n");
put("other/check.mjs", "");
put("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src/"], tests: ["nowhere/"] }));
git("commit", "-q", "-am", "pr");
git("checkout", "-q", "main"); git("merge", "-q", "--no-ff", "-m", "merge", "pr");
const read = testsChanged(tmp);
ok(read?.length === 1 && read[0].file === "test/sum.test.mjs" && read[0].asserts.length === 1, "a merge commit is read against its base: the tests the base's config names, never a file outside them, and not as the pull request's own config would have it", JSON.stringify(read));
git("checkout", "-q", "--orphan", "alone"); git("commit", "-q", "-m", "a commit with no parent");
ok(testsChanged(tmp) === null, "a commit with no base to read against reads as not read", String(testsChanged(tmp)));

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
