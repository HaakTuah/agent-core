// The selection itself (select.mjs runs it; tasks/tests.md, "A pull request runs the tests its change can reach"; #275): of
// the files a pull request changes against its base, each test that can reach one, with the tests it adds or changes,
// those that failed last time, and those the project names as its proof that behaviour was kept, which are never
// selected out.
//
// A test reaches a file where the file lies on the test's imports, followed from file to file (the shape check's
// readers: shape.mjs, beside this file, dynamic imports among them), or where a file of JavaScript or TypeScript on that
// way names it, outside a comment, by its name ("scripts/build.mjs", as a script is started by its path), or where it
// is the __init__.py of a package a file of Python on that way lies in, which Python runs on each import; from a file of
// C#, the files that declare a type it may name, by a word in a namespace it sees or by a name written out in full
// (select-csharp.mjs and select-csharp-project.mjs, which say what they read, and where a file's reach cannot be told).
// A test the config's "select.whole" names reaches every file (one that copies or runs the whole project). It never guesses: where
// a changed file is no code the readers read and no test, a file that is gone, C# of no project (no .csproj above it),
// C# that no longer declares a type it declared at the base, a declaration of types, a script of the global space, or anything the config does not name
// under "select.none" (the files no test reads), the whole suite runs. A fault the whole suite finds that the selection
// left out is a fault of this map, mended at once.
//
// The pathspec matcher is select-matcher.mjs, a project's copy of the core is read by select-copy.mjs, and the config is
// the shape check's (shape.mjs, where()): its "code", "tests", "aliases" and "select" ({ "proof", "whole", "none" }, each
// git pathspecs).
import path from "node:path";
import { CODE } from "./code-shape.mjs";
import { WORDS, mentioned, nameTrie } from "./name-trie.mjs";
import { CHARACTERS } from "./hurry.mjs";
import { matcher } from "./select-matcher.mjs";
import { csharpReach, undeclared } from "./select-csharp.mjs";
import { CS, heldBeside, ofNoProject, tooMuch } from "./select-csharp-project.mjs";
import { copyChange, copyReaching } from "./select-copy.mjs";
import { isCode } from "./shape-readers.mjs";

// A file of JavaScript or TypeScript without its comments, as far as a line tells them: a line that opens with one, and
// one that ends a line after a space. What is left over names more, never less.
// (a line that only a comment opens: "//", "/*", or a block's "* " and "#" in Python; a comment after code is kept, which
// names more, never less)
const uncommented = (text, py) => text.split("\n").filter(l => !(py ? /^\s*#/u : /^\s*(\/\/|\/\*|\*(\s|\/|$))/u).test(l)).join("\n");

// Each file's links to the others: its imports (of C#, `csharp`'s links in their place); from JavaScript, TypeScript or Python, each file whose name (in Python
// its dotted name too) it holds outside a comment; and from a file of Python, the __init__.py and conftest.py of its
// folder and each folder above, which Python and pytest run with no import.
const above = (name, file, texts) => ["", ...file.split("/").slice(0, -1).map((_, k, dirs) => `${dirs.slice(0, k + 1).join("/")}/`)].map(d => `${d}${name}`).filter(f => f !== file && f in texts);
// A file of Python by its dotted name too ("pkg.rules"; a package's own for __init__.py and __main__.py).
const dotted = f => f.replace(/\.py$/u, "").replace(/\/(__init__|__main__)$/u, "").split("/").join(".");
export function links(texts, tests, reach, pace = () => {}, csharp = new Map()) {
  // (each name tried on each text took time in step with the count of names times the count of texts: the names are held in
  // a trie, walked once over each text, name-trie.mjs)
  const byName = nameTrie(Object.keys(texts).map(f => [path.posix.basename(f), f]));
  const byDotted = nameTrie(Object.keys(texts).filter(f => f.endsWith(".py") && dotted(f).includes(".")).map(f => [dotted(f), f]));
  const out = new Map();
  for (const [file, text] of Object.entries(texts)) {
    pace();
    const to = new Set((CS.test(file) ? csharp : reach).get(file) ?? []), py = file.endsWith(".py");
    if (py || CODE.includes(path.posix.extname(file))) {
      // (a Python module's dotted name is looked for in every text of code, as its pattern was, JavaScript's that starts `python -m` too)
      const plain = uncommented(text, py), named = mentioned(byName, plain, WORDS.name, pace);
      for (const f of mentioned(byDotted, plain, WORDS.dotted, pace)) named.add(f);
      for (const f of named) if (f !== file) to.add(f);
    }
    // (Python runs a package's __init__.py on each import under it, and pytest a folder's conftest.py with no import)
    if (py) for (const run of [...above("__init__.py", file, texts), ...above("conftest.py", file, texts)]) to.add(run);
    out.set(file, to);
  }
  // (the files of C# the config does not read, as links between those it reads: select-csharp.mjs)
  for (const [file, to] of csharp) if (!out.has(file)) out.set(file, to);
  return out;
}

// The files each test reaches, the test itself among them; `pace` is asked as the search goes (every 256 files taken off a
// test's queue, so that many tests over many links take only the time the watch allows).
export function reached(tests, linked, pace = () => {}) {
  const out = new Map();
  let steps = 0;
  for (const t of tests) {
    pace();
    const seen = new Set([t]), queue = [t];
    while (queue.length) { if (++steps % 256 === 0) pace(); for (const next of linked.get(queue.pop()) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); } }
    out.set(t, seen);
  }
  return out;
}

// What a pull request runs: { all, why, tests }, `why` the reason for the whole suite, or for each test selected.
// `changed` the paths it changes (gone ones among them), `texts` and `tests` the project as the shape check reads it,
// `reach` its imports, `failed` the tests that failed last time, `config` the shape check's, `before` a changed file's
// text at the base (null where it was not there), `beside` what git holds of C# and MSBuild beside the texts (heldBeside).
export function selection({ changed, texts, tests, reach, scripts = new Set(), unsure = new Set(), unread = [], failed = [], config, watch = null, before = () => null, beside = heldBeside, copy = null, pinned = new Set() }) {
  const proof = matcher(config.select.proof), m = { whole: matcher(config.select.whole), none: matcher(config.select.none), isTest: matcher(config.tests) };
  const by = new Map(), add = (t, why) => { if (tests.has(t) && !by.has(t)) by.set(t, why); };
  const pace = watch?.pace(); // (one budget for the linking and the search from each test)
  const cs = csharpReach(texts, pace, beside);
  const reaches = reached(tests, links(texts, tests, reach, pace, cs.links), pace);
  // (a test that reaches an import the readers cannot follow may reach any file: it runs as one that reaches every file)
  // (and, where pytest runs a conftest.py the config does not read, each test of Python, whose fixtures may come from it)
  const blind = new Set([...reaches].filter(([t, files]) => [...files].some(f => (CS.test(f) ? cs.unsure : unsure).has(f)) || (t.endsWith(".py") && unread.some(c => c.endsWith("conftest.py")))).map(([t]) => t));
  // (the tests that reach every file, told once: the config's pathspecs are tried on each test, never on each changed file's account)
  let every = null, copying = null;
  const ctx = { texts, tests, scripts, add, reaches, pace, before: heldToBudget(before, pace), copy, pinned, ...m, wholes: () => (every ??= [...tests].filter(t => m.whole(t) || blind.has(t))), copyTests: () => (copying ??= copyReaching(texts, reaches, copy)) };
  for (const t of tests) if (proof(t)) add(t, "never selected out: the project's proof that behaviour was kept");
  for (const t of failed) add(t, "failed last time");
  for (const f of changed) {
    const unknown = oneChange(f, ctx);
    if (unknown) return { all: true, why: unknown, tests: [...tests].sort() };
  }
  return { all: false, why: by, tests: [...by.keys()].sort() };
}

// What one changed file selects, through `ctx.add`; the reason the whole suite runs where its reach cannot be told.
function oneChange(f, { texts, tests, scripts, add, reaches, pace, before, wholes, none, isTest, copy, pinned, copyTests }) {
  if (none(f) || pinned.has(f)) return null;
  if (copy && f.startsWith(copy)) return copyChange(f, { add, wholes, copy, copyTests });
  if (isTest(f) && tests.has(f)) add(f, "added or changed"); // (and, a helper among the tests, what imports it)
  const unknown = unknownReach(f, texts, scripts, before, pace);
  if (unknown) return unknown;
  for (const [t, files] of reaches) if (files.has(f)) add(t, `reaches ${f}`);
  // (a test's own file is no file of the project's a whole run tests; one of C# may be a helper a test reaches by reflection)
  if (!isTest(f) || CS.test(f)) for (const t of wholes()) add(t, `reaches every file (${f})`);
  return null;
}

// Why what reaches a changed file cannot be told, or null where its reach is read.
function unknownReach(f, texts, scripts, before, pace) {
  // (a file gone, a helper among the tests too, leaves no import to follow; a package's manifest, read beside the code,
  // links nothing: a change to either may reach every test)
  if (!(f in texts) || !isCode(f)) return `${f} is no code the readers follow, or is gone, so what reaches it cannot be told`;
  if (CS.test(f)) return csharpUnknown(f, texts, before, pace);
  // (a script of the global space is reached by no import at all)
  if (f.endsWith(".d.ts") || scripts.has(f)) return `${f} is a declaration of types, or a script of the global space, whose users no import names, so what reaches it cannot be told`;
  return null;
}

// Why what reaches a changed file of C# cannot be told, or null: it is of no project, reached by a path a project file may
// write out, or no longer declares what a test may have named it by, the test now finding another by no link to this file.
function csharpUnknown(f, texts, before, pace) {
  if (ofNoProject(f, texts)) return `${f} is C# of no project (no .csproj in a folder above it), which a project may compile by its path, so what reaches it cannot be told`;
  const lost = undeclared(before(f), texts[f], pace);
  return lost && `${f} changed so that ${lost}, and a test that reached it by that may now reach another file, so what reaches it cannot be told`;
}

// `before` held to the budget: `pace` asked before each text at the base is read, and the texts read held together to
// CHARACTERS, past which the run stops (Late), as the changed files' own are.
function heldToBudget(before, pace = () => {}) {
  let n = 0;
  return f => {
    pace();
    const text = before(f);
    n += text?.length ?? 0;
    if (n > CHARACTERS) throw tooMuch("the changed files of C# at the base", n);
    return text;
  };
}
