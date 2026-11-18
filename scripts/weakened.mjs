// The tests a pull request edits (tasks/code-shape.md, "A test taken out or weakened is said"; #307): in each test file
// it changes, each line that asserts (ASSERT) that it takes out or changes, and each line that skips a case or runs
// one alone (SKIP) that it adds, read from git as the merge commit against its first parent, the base, each file on
// its own and as text, whatever its attributes say. A test file is one the *shape check*'s config names under "tests",
// the manifest and the config read as the base holds them, so that a pull request does not set either for itself. It
// lists each such line for the reviewer, who rules on each. Where a file is left with fewer lines that assert than it
// had, or gains a skip, the pull request has made it weaker than it stood, and the description check
// (pr-description.mjs, beside this file) asks that the description name that file on its line LINE, with why; an
// assertion only changed, which may be made stricter, is listed and asks nothing. A line is matched by its pattern,
// and a line that only looks like one is listed too: the reviewer rules on it. An assertion spread over several lines
// is read by the line that holds its call alone. Git and Node's own modules.
//
//   node core/scripts/weakened.mjs        in a checkout of a pull request's merge commit: each line, by its file
import { spawnSync } from "node:child_process";
import { parseConfig, where } from "./shape.mjs";
import { started } from "./started.mjs";

export const LINE = "Tests changed:";
// A name or a line as it may be printed: a fork's pull request writes them, so no control, bidirectional or separating
// character of theirs reaches a log.
export const plain = text => String(text ?? "").replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "?");
// A line that asserts, in the test frameworks and languages the projects use: node's assert and the core's ok(),
// expect(...), xUnit's and NUnit's Assert, Python's assert and self.assert..., minitest's assert and refute, Rust's
// assert! macros, Go's t.Error and t.Fatal, testify's require., XCTest's XCTAssert, FluentAssertions' .Should().
export const ASSERT = /\b(?:assert\w*|expect|ok|equal|deepEqual|deepStrictEqual|strictEqual|notEqual|notStrictEqual|throws|doesNotThrow|rejects|Assert|CollectionAssert|StringAssert|XCTAssert\w*|self\.assert\w*)(?:\.\w+){0,4}\s*\(|\b(?:debug_)?assert(?:_eq|_ne)?!\s*\(|\brequire\.\w+\s*\(|\bt\.(?:Errorf?|Fatalf?|Fail|FailNow)\s*\(|^\s*(?:assert|refute)\w*\s+\S|\.Should\(\)|\.should\b/u;
// A line that skips a case, or runs one alone and so skips the rest: .skip, .todo and .only, xit, [Ignore] and
// Skip =, pytest's and unittest's skip, Go's t.Skip, Rust's #[ignore], JUnit's @Disabled, node:test's { skip: ... },
// mocha's this.skip().
export const SKIP = /#\[ignore\b|\bpytest\.skip\s*\(|\b(?:it|test|describe|context|suite)\.(?:skip|todo|only)\b|\b(?:xit|xtest|xdescribe|xcontext|fit|fdescribe)\s*\(|\[(?:Ignore|Skip)\b|\bSkip\s*=|@pytest\.mark\.(?:skip|xfail)\w*|@unittest\.skip\w*|@(?:Disabled|Ignore)\b|\bt\.Skip\w*\s*\(|\{\s*(?:skip|todo|only)\s*:(?!\s*false\b)|\bthis\.skip\s*\(/u;

// The longest line a pattern reads: a longer one is read by its first part, so that no line holds a check up.
const LONG = 1000;
const asserts = l => ASSERT.test(l.slice(0, LONG)), skips = l => SKIP.test(l.slice(0, LONG));

// What a diff (git diff -U0) does to the tests: [{ file, asserts, skips, weaker }], `asserts` the lines that assert it
// takes out or changes, `skips` the lines that skip it adds, `weaker` where the file is left with fewer lines that
// assert or gains a skip; a file named only where it holds one of them.
export function weakened(diff) {
  const files = [];
  let at = null;
  for (const line of String(diff ?? "").split("\n")) {
    // (a file's name from its header, "diff --git a/<it> b/<it>" with no rename, so a file deleted is named too)
    // (a name git quotes is no header this reads by its name: testsChanged() gives each file its name from git's list)
    if (line.startsWith("diff --git ")) { const header = /^diff --git a\/(.+?) b\/(.+)$/u.exec(line); at = { file: header?.[2] ?? null, gone: [], added: [] }; files.push(at); continue; }
    if (!at || /^(?:---|\+\+\+) /u.test(line)) continue;
    if (line.startsWith("-")) at.gone.push(line.slice(1));
    else if (line.startsWith("+")) at.added.push(line.slice(1));
  }
  return files.map(f => {
    // (a line taken out and added again as it was, moved, is neither: each added once cancels one taken out, and no more)
    const unmatched = (lines, against) => { const left = new Map(); for (const l of against) left.set(l.trim(), (left.get(l.trim()) ?? 0) + 1); return lines.filter(l => { const n = left.get(l.trim()) ?? 0; if (n) left.set(l.trim(), n - 1); return !n; }); };
    const out = unmatched(f.gone, f.added).filter(asserts), skipped = unmatched(f.added, f.gone).filter(skips);
    const fewer = f.gone.filter(asserts).length > f.added.filter(asserts).length;
    return { file: f.file, asserts: out, skips: skipped, weaker: fewer || skipped.length > 0 };
  }).filter(f => f.asserts.length || f.skips.length);
}

// The mend where the description does not name, on its line LINE (that line and the lines right after it, to the next
// blank line), each file `found` lists as weaker; null where it does, or where none is.
export function changedMend(body, found, list = "node core/scripts/weakened.mjs") {
  found = found.filter(f => f.weaker);
  if (!found.length) return null;
  const lines = String(body ?? "").split(/\r\n|\r|\n/u), start = lines.findIndex(l => l.replace(/^[\s>*_-]+/u, "").startsWith(LINE));
  let said = "";
  if (start >= 0) for (let i = start; i < lines.length && (i === start || lines[i].trim()); i++) said += `${lines[i]}\n`;
  const unnamed = found.filter(f => !said.includes(`\`${f.file}\``));
  if (!unnamed.length) return null;
  return `the description does not name, on its line "${LINE}", each test file this pull request leaves with fewer lines that assert, or in which it skips a case: ${unnamed.map(f => `\`${plain(f.file)}\` (${[f.asserts.length && `${f.asserts.length} assertion line${f.asserts.length === 1 ? "" : "s"} taken out or changed`, f.skips.length && `${f.skips.length} skip${f.skips.length === 1 ? "" : "s"} added`].filter(Boolean).join(", ")})`).join(", ")}. Mend: add the line "${LINE}" naming each file in backticks with why (the case proved nothing, the assertion was made stricter, the case moved), so that the reviewer rules on each; ${list} lists the lines`;
}

// What the pull request in the checkout at `dir` does to its tests, as weakened() gives it; null where it cannot be
// read (no base, no config at the base).
export function testsChanged(dir = ".") {
  const git = (...args) => { const r = spawnSync("git", args, { cwd: dir, encoding: "utf8", maxBuffer: 1 << 28 }); return r.status === 0 ? r.stdout : null; };
  const manifest = git("show", "HEAD^1:core-manifest.md") ?? git("show", "HEAD^1:AGENTS.md");
  if (manifest === null) return null;
  const at = where(manifest), text = git("show", `HEAD^1:${at}`);
  if (text === null) return null;
  let tests;
  try { tests = parseConfig(text, at).tests ?? []; } catch { return null; }
  if (!tests.length) return [];
  // (each file by its name, read whole from git's list and given back as a literal path, so that no name git would
  // quote, and no attribute a pull request sets, keeps a line from its own file)
  const names = git("diff", "--name-only", "-z", "--no-renames", "HEAD^1", "HEAD", "--", ...tests);
  if (names === null) return null;
  const found = [];
  for (const file of names.split("\0").filter(Boolean)) {
    const diff = git("diff", "-U0", "--text", "--no-renames", "--no-ext-diff", "--no-textconv", "--no-color", "HEAD^1", "HEAD", "--", `:(literal)${file}`);
    if (diff === null) return null;
    found.push(...weakened(diff).map(f => ({ ...f, file })));
  }
  return found;
}

if (started(import.meta.url)) {
  const found = testsChanged(".");
  if (found === null) console.log("Not read: the change could not be read against its base, or the base holds no shape check config naming the tests.");
  else if (!found.length) console.log("No test file of this pull request's has an assertion taken out or changed, or a case skipped.");
  else for (const f of found) {
    console.log(`${plain(f.file)}${f.weaker ? " (weaker than it stood: the description names it on its line \"" + LINE + "\")" : ""}:`);
    for (const l of f.asserts) console.log(`  out or changed: ${plain(l.trim().slice(0, 160))}`);
    for (const l of f.skips) console.log(`  skip added: ${plain(l.trim().slice(0, 160))}`);
  }
}
