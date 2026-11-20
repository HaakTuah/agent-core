// Tests the selection's pathspec matcher (scripts/select-matcher.mjs): a path or a folder above it, git's default
// wildcards, ":(glob)" and what ":!" leaves out, and that a match takes time in step with the path's length. Split from
// the selection's test (select-test.mjs; #943). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-matcher-test.mjs
import { matcher } from "../scripts/select-matcher.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };

// ---- the pathspecs ----
const m = matcher(["src", ":(glob)**/*.test.js", ":!src/gen/", "QUEUE.md"]);
ok(m("src/a.js") && m("src/deep/b.js") && m("lib/x.test.js") && m("QUEUE.md") && !m("src/gen/c.js") && !m("srcs/a.js") && !m("docs/QUEUE.md"),
  "a pathspec is a path or a folder above it, a glob, or one left out");
ok(matcher(["test/*-test.mjs"])("test/a-test.mjs") && matcher(["test/*-test.mjs"])("test/deep/b-test.mjs") && !matcher(["test/*-test.mjs"])("test/a.mjs") && matcher(["t?st/"])("test/") && matcher(["scripts/*-test.mjs"])("scripts/select-test.mjs")
  && matcher(["scripts/[ab]-test.mjs"])("scripts/a-test.mjs") && !matcher(["scripts/[ab]-test.mjs"])("scripts/c-test.mjs") && matcher(["scripts/[!ab]-test.mjs"])("scripts/c-test.mjs") && !matcher(["scripts/[!ab]-test.mjs"])("scripts/a-test.mjs"),
  "a plain pathspec with a wildcard matches as git's default does, across folders too");
ok(matcher(["."])("any/file.md") && !matcher([])("a.js") && matcher([":(glob)reports/*.md"])("reports/a.md") && !matcher([":(glob)reports/*.md"])("reports/deep/a.md"), "\".\" is every file, no pathspec none, and \"*\" stays within a folder");
ok(matcher([":(glob)src/**/*.js"])("src/a.js") && matcher([":(glob)src/**/*.js"])("src/a/b/c.js") && !matcher([":(glob)src/**/*.js"])("srcx/a.js") && matcher([":(glob)**/x"])("x") && matcher([":(glob)**/x"])("a/x")
  && matcher([":(glob)**/generated/**"])("src/generated/a.js") && matcher([":(glob)**/generated/**"])("generated/a.js") && !matcher([":(glob)**/generated/**"])("src/notgenerated/a.js") && !matcher([":(glob)a/**/b"])("a/xb")
  && matcher([":(glob)a?[b]"])("a?[b]") && !matcher([":(glob)a?[b]"])("axb") && matcher(["a**b"])("a/c/b"), "a glob's \"**/\" is any whole folders or none, never part of a folder's name, and its \"?\" and \"[\" are themselves; runs of \"*\" are one");
{
  // (in time that grows with the path's length, whatever runs of wildcards the pathspec holds)
  const from = Date.now();
  const none = [matcher([`${"*".repeat(60)}b`])("a".repeat(5000)), matcher([`:(glob)${"**/".repeat(40)}${"*".repeat(40)}b`])("a/".repeat(2000)), matcher([`:(glob)${"a*".repeat(60)}b`])("a".repeat(5000)), matcher([`${"a*".repeat(60)}b`])("a".repeat(5000))];
  ok(none.every(m => m === false) && Date.now() - from < 5000, "a pathspec of many wildcards is matched in time that grows with the path's length", `${none}, ${Date.now() - from} ms`);
}


console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
