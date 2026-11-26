// Checks the measures of how a codebase is put together (scripts/code-shape.mjs): its readers against
// brackets in comments, strings, template literals, regular expressions and JSX, its functions on the parser
// (scripts/javascript-functions.mjs) among them, with each case the lexer before it misread, each measure on a few files made for it,
// and a whole run in a scratch project that holds the core's copy, with its history and its suites. Run by the core's
// tests workflow (.github/workflows/tests.yml).
//
//   node tests/code-shape-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { changedTogether, cycles, globals, imports, isModule, jsxIn, measure, tokens } from "../scripts/code-shape.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { javascriptFunctions } from "../scripts/javascript-functions.mjs";
import { LARGEST, MOST_NODES } from "../scripts/tree-walk.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const here = fileURLToPath(new URL("../scripts/", import.meta.url));
const functions = (src, file = "a.mjs") => javascriptFunctions(file, src);
const fn = (src, file) => functions(src, file).map(f => `${f.name}:${f.line}:${f.lines}:${f.depth}`);

// The reader: no bracket in a comment, string, template or regular expression is counted.
const tricky = [
  "function a(x) {",
  "  const s = '}', t = \"{{\", r = /[}{]\\/}/g; // }",
  "  /* { */ const u = `a ${ { b: '}' }.b } ${`${'{'}`} }`;",
  "  return x / 2 / 3;",
  "}",
  "const b = () => {",
  "  if (x) {",
  "    for (;;) { while (y) { switch (z) { case 1: { break; } } } }",
  "  } else { try { q(); } catch { r(); } }",
  "};",
].join("\n");
ok(same(fn(tricky), ["a:1:5:0", "b:6:5:4"]), `brackets in comments, strings, templates and regexes are not counted, and blocks nest (${fn(tricky)})`);
const control = "function c(x) {\n  if (x) /[}]/.test(x);\n  while (x) { if (x) { x--; } }\n  return x;\n}\n";
ok(same(fn(control), ["c:1:5:2"]), `a regular expression just after a condition's ) is read as one (${fn(control)})`);
const loop = "async function d(xs) {\n  for await (const x of xs) {\n    if (x) { use(x); }\n  }\n}\n";
ok(same(fn(loop), ["d:1:5:2"]), `a for await loop is a block, not a function (${fn(loop)})`);
ok(same(fn("const q = (a) / 2 / (b) / 3;\nfunction e() {\n  return 1;\n}\n"), ["e:2:3:0"]), "a / after an expression's ) is a division");
ok(same(fn("#!/usr/bin/env node\nexport default async function main() {\n  return 1;\n}\n"), ["main:2:3:0"]), "a hashbang is passed over");

// Branch points: each if, loop, case and catch, and each and, or and choice within a line; a function within is its own.
const br = (src, file) => functions(src, file).map(f => `${f.name}:${f.branches}`);
// (a large file is read in time, in step with its size, well within the suite's time mark)
const regexes = src => tokens(src).filter(t => t.t === "regex" || t.v === "/").map(t => t.v);
ok(same(regexes("x = /[/]/g;\n"), ["/[/]/g"]) && same(regexes("x = /a\\/b/;\n"), ["/a\\/b/"]) && same(regexes("x = /a\\\nb/;\n"), ["/a\\\nb/"]) && same(regexes("x = /a[\\]/]b/i;\n"), ["/a[\\]/]b/i"]) && same(regexes("x = /a\ny/;\n"), ["/", "/"]),
  "a regular expression ends at its first / outside a class and an escape, an escape carries past a line's end, and a line's end with no / is no regular expression");
ok(tokens(`x = ${"/[".repeat(300000)}\n`).length === 600002, "a large line is read in time, in step with its size");
// (a large file whose brackets do not pair is not JavaScript, so its functions cannot be told: the grammar's recovery
// from it grows faster than its size, and its time is cut at the reader's budget; one of slashes, unbudgeted, took more
// than two minutes, and one just under the largest the grammar is given is cut at the budget, not left out by its size)
const unclosed = functions(`function f() {\n${"x =(:\n".repeat(10000)}${"[\n".repeat(10000)}${"]".repeat(5000)}}\n`);
const slashed = functions(`x = ${"/[".repeat(LARGEST.javascript / 2 - 3)}\n`);
ok(unclosed === null && slashed === null, "a large file that is no JavaScript is lost, its functions not told, within the suite's time mark");
// (one past the largest the grammar is given, valid or not, is lost unread: its tree's memory, not its time, is what a
// generated file of data would cost; the fallback security review of #785)
const words = n => `export const WORDS = [${Array.from({ length: n }, (_, k) => `"w${k}"`).join(", ")}];\nfunction f() {\n  return 1;\n}\n`;
ok(words(LARGEST.javascript / 12).length <= LARGEST.javascript && same(fn(words(LARGEST.javascript / 12), "a.mjs"), ["f:2:3:0"]) && words(LARGEST.javascript / 8).length > LARGEST.javascript && functions(words(LARGEST.javascript / 8)) === null,
  "a file past the largest the grammar is given is lost unread, and one under it is read whole");
// (and one within the largest whose tree holds more than MOST_NODES, lost unread as well: the walks after the parse,
// which no budget stops, grow with the nodes, not the characters; #880)
const nodes = n => `const A = [${"a,".repeat(n)}];\nfunction f() {\n  return 1;\n}\n`;
ok(nodes(MOST_NODES / 2 + 100).length <= LARGEST.javascript && functions(nodes(MOST_NODES / 2 + 100)) === null && same(fn(nodes(MOST_NODES / 4), "a.mjs"), ["f:2:3:0"]),
  "a file within the largest size whose tree holds more nodes than the most a reader walks is lost unread, and one under it is read whole");
const many = functions(`function f(a) {\n${"  if (a) { a = a ?? 1; }\n".repeat(10000)}}\n`);
ok(same(many?.map(f => `${f.name}:${f.lines}:${f.depth}:${f.branches}`), ["f:10002:1:20000"]), "a large file that is JavaScript is read whole", JSON.stringify(many));
const branching = [
  "function g(a, b) {",
  "  if (a && b || a?.c) { return a ? 1 : 2; } else if (b ?? a) { a ||= b; }",
  "  for (const x of a) { while (x) { do { b--; } while (b); } }",
  "  switch (a) { case 1: case 'two': break; default: }",
  "  try { p.catch(e => e); } catch { /* none */ }",
  "  const o = { if: 1, case: 2, for: 3 }, s = 'if (x) && ||', r = /a?b|c/, t = a | b & 1;",
  "  const inner = y => { if (y) { return y && 1; } };",
  "  return o.if;",
  "}",
].join("\n");
ok(same(br(branching), ["g:13", "inner:2"]), `each if, loop, case and catch counts, and each and, or and choice; not a key, a member, a string, a regular expression or a single & or | (${br(branching)})`);
const optional = "function h(a?: number, b?: string): void {\n  const c: A | B = a?.[0] ?? b!;\n  type T = { x?: number };\n  if (a) { use<T>(c); }\n}\n";
ok(same(br(optional, "a.ts"), ["h:2"]), `TypeScript's optional marks and unions are no branch points (${br(optional, "a.ts")})`);

// Every form of a function, TypeScript's return types and type parameters among them.
const forms = [
  "class A {",
  "  method(a) { return a; }",
  "  get size() { return 1; }",
  "}",
  "const o = { key: function () { return 1; }, arrow: async (x) => { return x; }, plain: { not: 'a function' } };",
  "function typed<T>(a: T): Map<string, T> {",
  "  return new Map();",
  "}",
  "const f = async x => {",
  "  return x;",
  "};",
  "list.map(v => { return v; });",
  "label: { const inner = 1; }",
].join("\n");
ok(same(fn(forms, "a.ts"), ["method:2:1:0", "size:3:1:0", "key:5:1:0", "arrow:5:1:0", "typed:6:3:0", "f:9:3:0", "(anonymous):12:1:0"]), `every form of a function is found, and no other block (${fn(forms, "a.ts")})`);
// (a parameter's default is named by its parameter, in each grammar: TypeScript's writes it as a parameter with a value,
// JavaScript's as an assignment pattern)
const defaults = "function outer(cb = () => { return 1; }, h: H = function () { }) {}\n";
ok(["a.ts", "a.tsx"].every(f => same(fn(defaults, f), ["cb:1:1:0", "h:1:1:0", "outer:1:1:0"])) && same(fn(defaults.replace(": H", ""), "a.js"), ["cb:1:1:0", "h:1:1:0", "outer:1:1:0"]),
  `a function given as a parameter's default is named by its parameter (${fn(defaults, "a.ts")})`);

// What the lexer before the parser misread, read as the definition says (#530, item 6; #723): a regular expression in a
// template literal's code, which ran the lexer to the file's end and lost every function after it; a choice's : taken
// for a key's or a return type's; a method named by a computed key or a string; an object's type as a return type; a
// choice of types counted as a branch; a variable's type taken for its name; a call after extends taken for a function.
const misread = [
  ["export function a(e) {\n  return `x ${/ Mend: /u.test(e) ? `a` : `b`}`;\n}\nfunction b() {\n  if (x) { y(); }\n}\n", "a.mjs", ["a:1:3:0:1", "b:4:3:1:1"]],
  ["function f(r) {\n  const read = rev ? commit.read\n    : g => {\n      return g;\n    };\n}\n", "a.mjs", ["f:1:6:0:1", "(anonymous):3:3:0:0"]],
  ["function f() {\n  return got ? asked(repo, got) : refused ? { yes: false } : null;\n}\n", "a.mjs", ["f:1:3:0:2"]],
  ["class A {\n  [Symbol.iterator]() {\n    return 1;\n  }\n  'quoted'() { return 2; }\n  #own() { return 3; }\n}\n", "a.mjs", ["(anonymous):2:3:0:0", "quoted:5:1:0:0", "#own:6:1:0:0"]],
  ["function f(): { a: number } {\n  if (x) { return { a: 1 }; }\n  return { a: 2 };\n}\n", "a.ts", ["f:1:4:1:1"]],
  ["function f<T>(x: T): T extends string ? 1 : 2 {\n  return x ? 1 : 2;\n}\n", "a.ts", ["f:1:3:0:1"]],
  ["const handle: Handler = () => {\n  return 1;\n};\n", "a.ts", ["handle:1:3:0:0"]],
  ["class A extends mixin(B) {\n  m() { return 1; }\n}\n", "a.mjs", ["m:2:1:0:0"]],
  ["const f = <T>(x: T) => {\n  return x;\n};\n", "a.tsx", ["f:1:3:0:0"]],
];
const told = (src, file) => functions(src, file)?.map(f => `${f.name}:${f.line}:${f.lines}:${f.depth}:${f.branches}`) ?? null;
ok(misread.every(([src, file, want]) => same(told(src, file), want)), "what the lexer misread is read as the definition says", JSON.stringify(misread.map(([src, file]) => told(src, file))));
// TypeScript's words newer than its grammar (export type *, a type's parameter marked in or out) are errors of words
// alone, which pair no block: the functions around them are told; an error of any other sign loses the file.
ok(same(told("export type * from './t';\ninterface I<in out T> { x: T }\nfunction f() {\n  return 1;\n}\n", "a.ts"), ["f:3:3:0:0"]) && told("function f() {\n  return 1;\n}\nconst x = ];\n", "a.mjs") === null,
  "a word the grammar does not know leaves the functions around it told; any other error loses the file");

// What a file imports, and the names it takes.
const imps = imports(tokens([
  "import fs from 'node:fs';",
  "import def, { a, b as c, type T } from './x.mjs';",
  "import * as ns from \"../y\";",
  "import type { U } from './types';",
  "import './side.css';",
  "export { d } from './z.js';",
  "export * from './w';",
  "const lazy = await import('./lazy.mjs');",
  "const old = require('./old');",
  "const x = obj.require('no'); obj.import('no');",
  "export { local };",
  "console.log(import.meta.url);",
].join("\n")));
ok(same(imps.map(i => `${i.kind} ${i.spec} ${i.names.join(",")}`), [
  "import node:fs default", "import ./x.mjs default,a,b,T", "import ../y *", "import ./types U", "import ./side.css ",
  "export ./z.js d", "export ./w *", "dynamic ./lazy.mjs ", "require ./old ",
]), `every form of an import is read, a member's call and a local export not (${imps.map(i => `${i.kind} ${i.spec} ${i.names}`).join("; ")})`);
const typed = imports(tokens("import type { A } from './a';\nimport { type B, type C as D } from './b';\nimport { type as factory } from './f';\nimport { type E, f } from './c';\nimport type, { g } from './d';\nexport type { H } from './e';\n"));
ok(same(typed.map(i => i.types), [true, true, false, false, false, true]), `an import of types alone is told from one that runs, a value named type too (${typed.map(i => i.types)})`);
const typeCycle = measure({ "x.ts": "import type { Y } from './y';\nexport const x = 1;\n", "y.ts": "import { x } from './x';\nexport type Y = number;\n" });
ok(typeCycle.cycles.files.length === 0 && typeCycle.cycles.filesWithTypes.length === 1, "a cycle closed only by an import of types is counted apart");
const bare = imports(tokens("export { local }\nimport { x } from './x.js'\nexport type T = string\nimport y from './y.js'\n"));
ok(same(bare.map(i => `${i.kind} ${i.spec} ${i.names.join(",")}`), ["import ./x.js x", "import ./y.js default"]), `with no semicolons, a local export never takes the next statement's from (${bare.map(i => `${i.kind} ${i.spec} ${i.names}`).join("; ")})`);
ok(!isModule(tokens("var a = 1;\nfunction b() { obj.import('x'); }\n")) && isModule(tokens("module.exports = {};\n")), "a file with no import, export or require is a script; module.exports makes one a module");
ok(same(globals(tokens("var a = 1, z = 2;\nfunction b() { var inner; }\nclass C {}\nconst d = function named() {};\nlet e;\n(function iife() { var f; })();\n")), ["a", "b", "C", "d", "e"]), "a script's top-level names are read, and nothing inside a function");

// JSX: an element is one token, the code in its { } read as code; where none may be (TypeScript, a comparison, a shift,
// a type's parameters), a < is a sign as before.
const app = [
  "import React from 'react';",
  "export function App({ items, user }) {",
  "  const label = user ? \"it's\" : 'none';",
  "  return (",
  "    <div className=\"app\" onClick={() => { if (x) go(); }}>",
  "      {/* don't { */}",
  "      <h1>Don't {label} {'}'} {'{'}</h1>",
  "      {items.length > 0 && items.map(i => <Item key={i.id} {...i} />)}",
  "      <>",
  "        <List<string> data={[1, 2]} render={(v) => v < 2 ? <b>{v}</b> : null} />",
  "      </>",
  "    </div>",
  "  );",
  "}",
  "const f = <T,>(x: T) => { return x; };",
  "function after(a) { return a < 3 && a > 1 && (a << 2) < 9 && a++ < 4; }",
].join("\n");
const jsx = tokens(app, true), shown = (functions(app, "a.tsx") ?? []).map(f => `${f.name}:${f.line}:${f.lines}:${f.depth}:${f.branches}`);
ok(!jsx.lost && same(shown, ["App:2:13:0:3", "(anonymous):5:1:0:1", "f:15:1:0:0", "after:16:1:0:3"]) && same(imports(jsx).map(i => i.spec), ["react"]),
  `a component's lines, depth and branch points are read through its JSX, the code in its braces as code, its text and quotes as text, and an arrow after its type's parameters (<T,>) named as any other (${shown})`);
ok(functions(app.replace("{'}'}", "}"), "a.tsx") === null && functions("const x = <div>\n  <p>open\n", "a.jsx") === null,
  "JSX whose text holds a bare } (JSX's own rule: {'}'}), or an element that never closes, is lost, its functions not told");
const shift = "let a = b << c, d = e++ < f, g = h < i;\nconst k = x => x < 1 ? <a/> : y;\n";
ok(same(tokens(shift.split("\n")[0], true), tokens(shift.split("\n")[0])) && tokens(shift, true).some(t => t.t === "jsx"), "a shift, a comparison after x++ and one after a name stay signs; an element after ? is JSX");
ok(tokens("const x = <div>\n  <p>open\n", true).lost && tokens("const f = <T>(x: T) => x;\n" + "function g() {}\n", true).lost && !tokens("const f = <T extends U>(x: T) => x;\n", true).lost,
  "an element that never closes is lost, as is a type's parameter taken for one (<T>), whose functions cannot be told; <T extends U> and <T,> are parameters");
const deepTemplate = `const x = ${"`${".repeat(3000)}1${"}`".repeat(3000)};\n`, deepJsx = `const x = ${"<a>".repeat(3000)}${"</a>".repeat(3000)};\n`;
ok(tokens(deepTemplate).lost && tokens(deepJsx, true).lost, "a template or an element nested past the reader's limit loses the file, and overflows no stack");
ok(same(functions(deepTemplate), []) && same(functions(deepJsx, "a.jsx"), []) && functions(`function f() {${"if (a) {".repeat(20000)}${"}".repeat(20000)}}`)?.[0]?.depth === 20000,
  "on the parser, a template, an element or blocks nested thousands deep are read, and overflow no stack");
ok(jsxIn("a.jsx") && jsxIn("a.tsx") && jsxIn("a.js") && jsxIn("a.mjs") && !jsxIn("a.ts") && !jsxIn("a.mts"), "JSX is read in .jsx, .tsx and JavaScript's files, never in TypeScript's own, where <T>x is a cast");

// Cycles, between files and folders.
const graph = new Map([["a", new Set(["b"])], ["b", new Set(["c"])], ["c", new Set(["a"])], ["d", new Set(["d"])], ["e", new Set(["a"])]]);
ok(same(cycles(graph), [["a", "b", "c"], ["d"]]), "a cycle of three and a file that imports itself are found, and a file that only leads into one is not");
const chain = new Map(Array.from({ length: 20000 }, (_, k) => [`n${k}`, new Set([`n${(k + 1) % 20000}`])]));
ok(cycles(chain)[0]?.length === 20000, "a cycle of 20,000 files is found without overflowing the stack");

// The measures on a small codebase.
const texts = {
  "engine/rules.mjs": "import { draw } from '../ui/view.mjs';\nimport { roll } from './dice.mjs';\nexport const rule = () => roll();\n",
  "engine/dice.mjs": "import { rule } from './rules.mjs';\nexport function roll() { return rule; }\n",
  "ui/view.mjs": "import { rule } from '../engine/rules.mjs';\nimport { roll } from '../engine/dice.mjs';\nexport function draw() { return rule; }\n",
  "ui/menu.ts": "import { state } from '../engine/state.js';\nimport { helper } from '@game/tools/helper';\nimport lodash from 'lodash';\nimport './missing.mjs';\nimport './look.css';\nexport const m = 1;\n",
  "engine/state.ts": "export const state: number = 1;\n",
  "tools/package.json": "{ \"name\": \"@game/tools\", \"main\": \"index.mjs\" }",
  "tools/helper.mjs": "export const helper = 1;\n",
  "page/one.js": "var shared = 1;\nfunction onlyOne() {}\n",
  "page/two.js": "var shared = 2;\nfunction onlyTwo() {}\nconst later = () => import('../engine/dice.mjs');\n",
};
const m = measure(texts, { commits: [["engine/rules.mjs", "engine/dice.mjs"], ["engine/rules.mjs", "engine/dice.mjs", "x.md"], ["engine/rules.mjs", "engine/dice.mjs"], ["engine/rules.mjs"]], other: { ".cs": 2 } });
ok(m.files.code === 8 && m.files.other[".cs"] === 2, "the code files are counted, and those of other languages named");
ok(m.imports.total === 11 && m.imports.crossingAFolder === 6 && same(m.imports.external, { lodash: 1 }) && same(m.imports.unresolved, ["ui/menu.ts: ./missing.mjs"]), `imports are counted, those crossing a folder, those from outside and those that lead nowhere apart (${JSON.stringify(m.imports)})`);
ok(same(m.imports.foldersBothWays, [{ folders: ["engine", "ui"], imports: [1, 3] }]), "two folders that import each other both ways are named, with how many each way");
ok(same(m.cycles.files, [["engine/dice.mjs", "engine/rules.mjs", "ui/view.mjs"]]) && same(m.cycles.folders, [["engine", "ui"]]), "cycles between files and between folders are found");
ok(same(m.hubs.map(h => [h.file, h.importedBy, h.names]), [["engine/dice.mjs", 3, ["roll"]], ["engine/rules.mjs", 2, ["rule"]]]), "hubs are the files most import, with the names they give, an import of .js reaching its .ts and one of a package the repository holds reaching it");
ok(m.globals.scripts === 2 && m.globals.names === 5 && same(m.globals.inMoreThanOne, [{ name: "shared", files: ["page/one.js", "page/two.js"] }]), "a script's global names are counted, and a name two declare is named");
ok(same(measure(texts, { depth: 1 }).imports.crossingAFolder, 6) && measure({ "a/b/x.mjs": "import './y.mjs';\n", "a/b/y.mjs": "", "a/c/z.mjs": "import '../b/x.mjs';\n" }, { depth: 1 }).imports.crossingAFolder === 0, "with a depth, a folder is the first parts of a path");
const together = changedTogether([...Array(3).fill(["p", "q"]), Array.from({ length: 31 }, (_, k) => `f${k}`).concat(["p", "q"])], new Set(["p", "q", ...Array.from({ length: 31 }, (_, k) => `f${k}`)]));
ok(together.commits === 3 && same(together.pairs, [{ files: ["p", "q"], together: 3, share: 1 }]), "files changed together are counted, a commit that touches more than 30 left out");
ok(same(m.changedTogether.pairs, [{ files: ["engine/dice.mjs", "engine/rules.mjs"], together: 3, share: 1 }]) && m.changedTogether.mostChanged[0].file === "engine/rules.mjs", "a file outside the code read counts in no pair");

// A whole run, in a project that holds the core's copy: its own code alone, its history and its suites.
const dir = scratchDir("code-shape-test-");
const outside = scratchDir("code-shape-outside-"); // what a link leads to, beside the project
try {
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false"); // the machine's own git settings sign and hook nothing here
  git("config", "core.hooksPath", path.join(dir, ".no-hooks"));
  fs.mkdirSync(path.join(dir, "core/scripts"), { recursive: true });
  for (const f of ["code-shape.mjs", "code-shape-lexer.mjs", "code-shape-readers.mjs", "started.mjs", "core-path.mjs", "core-address.mjs", "guards.mjs", "javascript-functions.mjs", "tree-walk.mjs", "parser.mjs", "parser-worker.mjs", "packages.mjs"]) fs.copyFileSync(path.join(here, f), path.join(dir, "core/scripts", f));
  // (the copy's packages, as the sync installs them: the core's own, linked)
  fs.symlinkSync(path.join(here, "../.packages"), path.join(dir, "core/.packages"), "junction");
  fs.mkdirSync(path.join(dir, "src"));
  for (let k = 0; k < 3; k++) {
    fs.writeFileSync(path.join(dir, "src/a.mjs"), `import { b } from './b.mjs';\nexport const a = ${k};\nexport function f() {\n  return b;\n}\n`);
    fs.writeFileSync(path.join(dir, "src/b.mjs"), `export const b = ${k};\n`);
    git("add", "-A");
    git("commit", "-q", "-m", `change ${k}`);
  }
  if (process.platform !== "win32") { // a link git holds is never followed, wherever it leads (Windows' git writes none)
    fs.writeFileSync(path.join(outside, "outside.mjs"), "export const outside = 1;\n");
    fs.symlinkSync(path.join(outside, "outside.mjs"), path.join(dir, "src/link.mjs"));
    git("add", "-A");
  }
  const out = path.join(dir, "out.json");
  const r = spawnSync(process.execPath, [path.join(dir, "core/scripts/code-shape.mjs"), "--suite", "node -e 0", "--suite", "node -e process.exit(3)", "--json", out], { cwd: path.join(dir, "src"), encoding: "utf8" });
  const j = r.status === 0 ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
  ok(j?.files.code === 2, `a project's own code is read, never the core's copy nor a link (${r.stdout}${r.stderr})`);
  ok(same(j?.changedTogether.pairs, [{ files: ["src/a.mjs", "src/b.mjs"], together: 3, share: 1 }]), "its history is read for what changes together");
  ok(same(j?.suites.map(s => s.passed), [true, false]) && j?.suites.every(s => typeof s.seconds === "number"), "each suite is run alone and timed, and whether it passed is said");
  ok(/imports: 1, 0 crossing a folder/.test(r.stdout) && /functions: 1; lines median 3/.test(r.stdout) && /suite: node -e process.exit\(3\): [0-9.]+ s, FAILED/.test(r.stdout), "the summary says what it measured");
  const outer = spawnSync(process.execPath, [path.join(here, "code-shape.mjs"), "--repo", path.join(dir, "src"), "--json", out], { cwd: here, encoding: "utf8" });
  const o = outer.status === 0 ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
  ok(o?.files.code === 2 && o?.changedTogether.commits === 3, `with --repo, another repository is measured, its copy of the core left out (${outer.stdout}${outer.stderr})`);
  // (another repository whose manifest names its copy of the core elsewhere: that copy is left out, not core/)
  const vendored = scratchDir("code-shape-vendored-");
  try {
    const vgit = (...args) => execFileSync("git", args, { cwd: vendored, stdio: "ignore" });
    vgit("init", "-q"); vgit("config", "user.email", "test@example.invalid"); vgit("config", "user.name", "Test"); vgit("config", "commit.gpgsign", "false"); vgit("config", "core.hooksPath", path.join(vendored, ".no-hooks"));
    fs.writeFileSync(path.join(vendored, "core-manifest.md"), `Core: ${CORE} at ${"a".repeat(40)}, copied whole under vendor/core/ (never edited here).\n`);
    fs.mkdirSync(path.join(vendored, "vendor/core/scripts"), { recursive: true });
    fs.writeFileSync(path.join(vendored, "vendor/core/scripts/x.mjs"), "export const x = 1;\n");
    fs.writeFileSync(path.join(vendored, "mine.mjs"), "export const mine = 1;\n");
    vgit("add", "-A"); vgit("commit", "-q", "-m", "one");
    const away = spawnSync(process.execPath, [path.join(here, "code-shape.mjs"), "--repo", vendored, "--json", out], { cwd: here, encoding: "utf8" });
    const w = away.status === 0 ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
    ok(w?.files.code === 1, `with --repo, a copy of the core at the path its manifest names is left out (${away.stdout}${away.stderr})`);
  } finally { fs.rmSync(vendored, { recursive: true, force: true }); }
  const bad = spawnSync(process.execPath, ["core/scripts/code-shape.mjs", "--depth", "two"], { cwd: dir, encoding: "utf8" });
  ok(bad.status === 1 && /FAIL: --depth takes a whole number/.test(bad.stderr), "an option of the wrong shape fails, saying which");
} finally { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); }

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log("all passed");
