// The measures of how a codebase is put together (#245): the audit's numbers kept as a script, so the next audit is a
// run and not a study. It reads the JavaScript and TypeScript files git holds and prints a summary; with --json it
// writes every number. It measures and fails nothing: what is held of it, and how, is the shape check's (shape.mjs,
// beside this file, which reads with this file's readers; tasks/code-shape.md). Node's own modules, git and the
// parser's installed packages.
//
// What it gives, of the files it reads:
//   - imports: how many, how many cross a folder, those of code that lead to no file, and the pairs of folders that
//     import each other both ways (no layer is declared yet, so a pair that runs both ways is the sign of an import
//     against the grain that needs none);
//   - import cycles, between files and between folders, of what runs (a dynamic import, or one of types alone, which
//     TypeScript erases, makes none), and between files with those of types counted too;
//   - hubs: the files most others import, and the names each gives them;
//   - shared global names: in a file with no import, export or require, what its top level declares, and the names
//     more than one such file declares;
//   - functions: how many lines each spans, how deep its blocks nest (if, for, while, switch, catch, else, try, do; a
//     function within it is measured on its own) and how often it branches: each if, loop (for, while), case and
//     catch, and each and (&&), or (||, ??) and choice (? :) within a line;
//   - which files change together in the history (commits that touch more than 30 of them, such as a move, are left
//     out, and so is every merge);
//   - with --suite, how long each named suite takes when it runs alone, and whether it passed.
// Its functions are read on the parser the core installs (javascript-functions.mjs, whose definition they keep): a
// file whose functions it cannot tell is counted with none. Its imports and a script's names are read by a lexer, not a
// parser: it knows comments, strings, template literals, regular expressions and the elements of JSX (in .jsx, .tsx
// and JavaScript's own files; jsxIn), so a bracket in one of them is not counted. Files in other languages are counted
// and named, and not measured here: the shape check reads C# and Python with readers of their own (shape-readers.mjs).
//
//   node core/scripts/code-shape.mjs [<pathspec>...] [--repo <folder>] [--depth <n>] [--history <n>]
//                                    [--suite "<command>"]... [--json <file>]
//
//   <pathspec>   git pathspecs of the code to measure (":!" leaves a path out); left out, the whole repository but for
//                a copy of the core (core/, or where the manifest names it), where the script runs from that copy or measures another repository
//   --repo       the repository to measure, a clone this script does not lie in (one read for an audit); left out, the
//                one it lies in. Its suites, where --suite names them, run its own code
//   --depth      a folder is the first n parts of a file's path (packages/engine, for 2); left out, its whole folder
//   --history    how many of the newest commits the count of what changes together reads; 500 if left out
//   --suite      a command that runs one suite, run alone from the repository's root and timed; may be repeated
//   --json       the file every number is written to, as JSON
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { started } from "./started.mjs";
import { copyOf, projectAt } from "./core-path.mjs";
import { javascriptFunctions } from "./javascript-functions.mjs";

export const CODE = [".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx"];
export const OTHER = [".cs", ".fs", ".vb", ".py", ".go", ".rs", ".java", ".kt", ".scala", ".swift", ".dart", ".gd", ".lua", ".c", ".cpp", ".h", ".rb", ".php"];
const REGEX_AFTER = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
// git's settings that run a command by themselves, off: a folder measured with --repo may hold a .git it was handed
const SAFE = ["-c", "core.fsmonitor=false"];
const BULK = 30; // a commit that touches more of the measured files than this is a move or a sweep, not a sign

// The tokens of a file's text: { t: "id" | "num" | "str" | "regex" | "punct", v, line, at }, `at` where it starts in the
// text (for a template's runs, where the run ends). Comments and white space are dropped, each comment's lines kept in
// the list's `comments` ({ line, text }; shape.mjs reads them for a change's mark); a template literal is a
// "str" token for each run of its text, with the code of each ${ } between them. With
// `jsx` (jsxIn, below), an element of JSX is a "jsx" token at its <, with the code of each { } in it between ( and );
// where one never closes, the list's `lost` is true, and the file is read again without JSX.
export function tokens(src, jsx = false) {
  const lex = new Lexer(src, jsx);
  lex.code(false);
  lex.out.lost = lex.lost;
  lex.out.comments = lex.comments;
  return lex.out;
}

// Each line of a comment, from `a` (where its text starts) to `b`, as { line, text }, from the line `line` on, added to
// `to` one at a time, so that a comment of any length overflows nothing; of each line its first COMMENT_READ characters
// alone, all a mark is read in.
export const COMMENT_READ = 400;
export function commentLines(to, src, a, b, line) {
  const text = src.slice(a, b);
  let k = 0;
  for (let at = 0; at <= text.length; k++) {
    const end = text.indexOf("\n", at), stop = end < 0 ? text.length : end;
    to.push({ line: line + k, text: text.slice(at, Math.min(stop, at + COMMENT_READ)) });
    at = stop + 1;
  }
}

// Whether a file's tokens are read with JSX: a file of .jsx or .tsx, and one of JavaScript, where no expression may
// start with a < (in TypeScript one may: a cast, <T>x, which a file of .tsx cannot hold).
export const jsxIn = file => [".jsx", ".tsx", ".js", ".mjs", ".cjs"].includes(path.posix.extname(file));
// How deep a template's code, an element or its code may nest before the reader stops: past it the file is lost, so
// that no file overflows the reader's stack.
export const NEST = 200;
const TAG = /^<\s*(?:>|[A-Za-z_$])/u; // (a fragment, or a tag's name)
const TYPE_PARAMETER = /^<\s*(?:const\s+)?[A-Za-z_$][\w$]*\s*(?:,|=|extends\b)/u; // (<T,> or <T extends U> in .tsx)

class Lexer {
  constructor(src, jsx) {
    Object.assign(this, { src, jsx, n: src.length, out: [], parens: [], prev: null, line: 1, lost: false, nest: 0, comments: [] });
    // (parens: for each open (, whether it opens an if, for, while or with's condition)
    this.i = src.startsWith("#!") ? src.indexOf("\n") : 0;
    if (this.i < 0) this.i = this.n;
  }

  push(t, v, l = this.line) { this.prev = { t, v, line: l, at: this.i }; this.out.push(this.prev); }
  lines(a, b) { for (let k = a; k < b; k++) if (this.src[k] === "\n") this.line++; }

  // What `read` reads, one level deeper; past NEST, nothing more of the file, which is lost.
  nested(read) {
    if (this.nest >= NEST) { this.lost = true; this.i = this.n; return false; }
    this.nest++;
    try { return read(); } finally { this.nest--; }
  }

  // The code up to the end, or, `inner`, up to the } that closes the { before it (not a token): whether it reached it.
  code(inner) {
    return inner ? this.nested(() => this.run(true)) : this.run(false);
  }

  run(inner) {
    let depth = 0;
    while (this.i < this.n) {
      const c = this.src[this.i];
      if (this.blank(c) || this.literal(c)) continue;
      if (c === "{") depth++;
      else if (c === "}" && inner && depth-- === 0) { this.i++; return true; }
      this.punct(c);
    }
    return false;
  }

  // White space or a comment, passed over: whether there was one.
  blank(c) {
    const { src, i, n } = this;
    if (c === "\n") { this.line++; this.i++; return true; }
    if (c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v" || c === "\ufeff") { this.i++; return true; }
    if (c === "/" && src[i + 1] === "/") { while (this.i < n && src[this.i] !== "\n") this.i++; commentLines(this.comments, src, i + 2, this.i, this.line); return true; }
    if (c !== "/" || src[i + 1] !== "*") return false;
    const e = src.indexOf("*/", i + 2), end = e < 0 ? n : e + 2;
    commentLines(this.comments, src, i + 2, e < 0 ? n : e, this.line);
    this.lines(i, end);
    this.i = end;
    return true;
  }

  // A string, template, regular expression, word, number or element of JSX, read as its token(s): whether there was one.
  literal(c) {
    if (c === "'" || c === '"') return this.quoted(c);
    if (c === "`") { this.i++; this.template(); return true; }
    if (c === "/" && this.regexHere() && this.regex()) return true;
    if (/[A-Za-z_$#\u0080-\uffff]/.test(c)) return this.word(/[A-Za-z0-9_$\u0080-\uffff]/, "id");
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(this.src[this.i + 1] ?? ""))) return this.word(/[0-9A-Za-z_.]/, "num");
    return c === "<" && this.jsx && this.jsxHere() && this.element();
  }

  quoted(c) {
    const { src, i, n } = this;
    let j = i + 1;
    while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
    const from = this.line;
    this.lines(i, Math.min(j, n));
    this.push("str", src.slice(i + 1, j), from);
    this.i = j + 1;
    return true;
  }

  word(rest, t) {
    let j = this.i + 1;
    while (j < this.n && rest.test(this.src[j])) j++;
    this.push(t, this.src.slice(this.i, j));
    this.i = j;
    return true;
  }

  // From just inside a template's text to its end, the code of each ${ } read between its runs.
  template() {
    const { src, n } = this;
    let from = this.line;
    while (this.i < n) {
      const c = src[this.i];
      if (c === "\\") { this.lines(this.i, this.i + 2); this.i += 2; continue; }
      if (c === "`") { this.i++; this.push("str", "`", from); return; }
      if (c === "$" && src[this.i + 1] === "{") {
        this.i += 2;
        this.push("str", "`", from);
        if (!this.code(true)) return;
        from = this.line;
        continue;
      }
      if (c === "\n") this.line++;
      this.i++;
    }
    this.push("str", "`", from);
  }

  // A / starts a regular expression where no value stands before it: at the start, after an operator, a keyword, or the
  // ) that closes a condition (`if (x) /a/.test(y)`).
  regexHere() {
    const prev = this.prev;
    return !prev || (prev.t === "punct" && (prev.v !== ")" || prev.condition) && prev.v !== "]") || (prev.t === "id" && REGEX_AFTER.has(prev.v));
  }

  // Where a scan from each place ends, out of a class and in one ([0] and [1]): at the / that closes it, or -1; made
  // once for the text, from its end back, so each / is read in one step.
  regexEnds() {
    const { src, n } = this, out = new Int32Array(n + 2).fill(-1), inside = new Int32Array(n + 2).fill(-1);
    for (let j = n - 1; j >= 0; j--) {
      const d = src[j];
      if (d === "\n") continue;
      if (d === "\\") { out[j] = out[j + 2]; inside[j] = inside[j + 2]; continue; }
      out[j] = d === "/" ? j : d === "[" ? inside[j + 1] : out[j + 1];
      inside[j] = d === "]" ? out[j + 1] : inside[j + 1];
    }
    return [out, inside];
  }

  regex() {
    const { src, i, n } = this;
    this.ends ??= this.regexEnds();
    let j = this.ends[0][i + 1];
    if (j < 0) return false;
    j++;
    while (j < n && /[A-Za-z]/.test(src[j])) j++;
    this.push("regex", src.slice(i, j));
    this.i = j;
    return true;
  }

  // A sign, its own token (=> one of two signs); a ( says whether it opens a condition, and the ) that closes it too.
  punct(c) {
    if (this.src.startsWith("=>", this.i)) { this.push("punct", "=>"); this.i += 2; return; }
    this.sign(c);
    this.i++;
  }

  sign(c) {
    const prev = this.prev;
    const condition = c === "(" ? prev?.t === "id" && ["if", "while", "for", "with"].includes(prev.v) || (isId(prev, "await") && isId(this.out.at(-2), "for")) : false;
    if (c === "(") this.parens.push(condition);
    this.push("punct", c);
    if (c === ")") this.prev.condition = this.parens.pop() === true;
  }

  // ---- JSX ----

  // An element may start where an expression may: at the start, after a sign but a value's end, a shift's first < or
  // a + or - (which may end x++), or after a keyword that a value follows.
  jsxHere() {
    const prev = this.prev;
    if (!prev) return true;
    if (prev.t === "id") return REGEX_AFTER.has(prev.v);
    return prev.t === "punct" && ![")", "]", "}", "<", "+", "-"].includes(prev.v);
  }

  // An element from its <: false, nothing read, where no tag follows (a comparison, a type's parameters).
  element() {
    const ahead = this.src.slice(this.i, this.i + 200);
    if (!TAG.test(ahead) || TYPE_PARAMETER.test(ahead)) return false;
    return this.nested(() => this.tag());
  }

  tag() {
    this.push("jsx", "<");
    this.i++;
    this.space();
    if (this.src[this.i] === ">") { this.i++; this.children(); return true; }
    this.name();
    this.attributes();
    return true;
  }

  // White space, and comments between attributes, passed over.
  space() {
    while (this.i < this.n) {
      const c = this.src[this.i];
      if (c === "/" && (this.src[this.i + 1] === "/" || this.src[this.i + 1] === "*")) this.blank(c);
      else if (/\s/u.test(c)) this.blank(c) || this.i++;
      else return;
    }
  }

  // A tag's name or an attribute's, with a tag's type arguments in TypeScript (<List<T> items={x}>).
  name() {
    while (this.i < this.n && /[\w$.:-]/u.test(this.src[this.i])) this.i++;
    if (this.src[this.i] !== "<") return;
    for (let depth = 0; this.i < this.n; this.i++) {
      if (this.src[this.i] === "<") depth++;
      else if (this.src[this.i] === ">" && --depth === 0) { this.i++; return; }
    }
  }

  // The attributes, up to the tag's end, then its children where it has them.
  attributes() {
    while (this.space(), this.i < this.n) {
      const c = this.src[this.i];
      if (c === "/" && this.src[this.i + 1] === ">") { this.i += 2; return; }
      if (c === ">") { this.i++; this.children(); return; }
      if (c === "{") this.inner();
      else if (c === '"' || c === "'") this.text(c);
      else if (c === "<") this.element() || this.i++;
      else if (/[\w$]/u.test(c)) this.name();
      else this.i++;
    }
    this.lost = true;
  }

  // An attribute's value in quotes, which no backslash escapes.
  text(c) {
    const end = this.src.indexOf(c, this.i + 1), to = end < 0 ? this.n : end + 1;
    this.lines(this.i, to);
    this.i = to;
  }

  // The children, up to the closing tag.
  children() {
    while (this.i < this.n) {
      const c = this.src[this.i];
      if (c === "{") { this.inner(); continue; }
      if (c === "<" && /^<\s*\//u.test(this.src.slice(this.i, this.i + 50))) { this.text(">"); return; }
      if (c === "<" && this.element()) continue;
      if (c === "\n") this.line++;
      this.i++;
    }
    this.lost = true;
  }

  // The code of a { } in an element, between ( and ).
  inner() {
    this.i++;
    this.sign("(");
    if (!this.code(true)) this.lost = true;
    this.sign(")");
  }
}

export const isId = (tok, v) => tok?.t === "id" && (v === undefined || tok.v === v);
export const isP = (tok, v) => tok?.t === "punct" && tok.v === v;
const notMember = (toks, k) => !isP(toks[k - 1], ".") && !isP(toks[k - 1], "?");

// What a file imports: [{ spec, kind: "import" | "export" | "dynamic" | "require", names }], names being what it takes
// by name ("default" and "*" for a default and a whole namespace; empty where it takes nothing by name or the call
// says nothing of it).
export function imports(toks) {
  const found = [];
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    if (tok.t !== "id" || !notMember(toks, k)) continue;
    const hit = importAt(toks, k);
    if (hit) found.push(hit);
  }
  return found;
}

// What the word at k imports, by its kind: null where it is none of them.
function importAt(toks, k) {
  const v = toks[k].v;
  if (v === "require") return requireCall(toks, k);
  if (v === "import") return importStatement(toks, k);
  if (v === "export") return exportClause(toks, k);
  return null;
}

function requireCall(toks, k) {
  const named = isP(toks[k + 1], "(") && toks[k + 2]?.t === "str" && isP(toks[k + 3], ")");
  return named ? { spec: toks[k + 2].v, kind: "require", names: [] } : null;
}

// An import( call, an import of a module for its effects alone, or an import with a clause.
function importStatement(toks, k) {
  const next = toks[k + 1];
  if (isP(next, "(")) return toks[k + 2]?.t === "str" ? { spec: toks[k + 2].v, kind: "dynamic", names: [] } : null;
  if (next?.t === "str") return { spec: next.v, kind: "import", names: [] };
  if (isP(next, ".")) return null;
  return clauseEntry(toks, k, "import");
}

function exportClause(toks, k) {
  const next = toks[k + 1];
  return isP(next, "{") || isP(next, "*") || isId(next, "type") ? clauseEntry(toks, k, "export") : null;
}

// The import or export whose clause starts after the word at k; null where its clause names no module.
function clauseEntry(toks, k, kind) {
  const f = fromClause(toks, k + 1);
  return f ? { ...f, kind, types: typesOnly(toks, k + 1) } : null;
}

// Whether an import or export clause takes types alone, which TypeScript erases before the code runs: `import type`,
// or braces whose every name is marked `type`.
function typesOnly(toks, k) {
  if (isId(toks[k], "type") && !isId(toks[k + 1], "from") && !isP(toks[k + 1], ",")) return true;
  if (!isP(toks[k], "{")) return false;
  let names = 0;
  for (let j = k + 1; j < toks.length && !isP(toks[j], "}"); j++) {
    if (isP(toks[j], ",") || isId(toks[j], "as") || isId(toks[j - 1], "as")) continue;
    // (`type as x` takes a value named type; `type x` a type)
    if (!isId(toks[j], "type") || isP(toks[j + 1], ",") || isP(toks[j + 1], "}") || (isId(toks[j + 1], "as") && !isId(toks[j + 2], "as"))) return false;
    names++; j++;
  }
  return names > 0;
}

// The names an import or export clause takes, and the module after its `from`; null where none follows it: where the
// clause ends (its braces close, or an = shows a declaration) with no `from` after it, so a statement with no semicolon
// never lends its `from` to the one before it.
function fromClause(toks, k) {
  const clause = { names: [], braces: false };
  for (let j = k; j < toks.length && j < k + 400; j++) {
    const tok = toks[j];
    if (clauseEnds(toks, j)) return null;
    if (isId(tok, "from") && !clause.braces && toks[j + 1]?.t === "str") return { spec: toks[j + 1].v, names: clause.names };
    takeInClause(toks, j, k, clause);
  }
  return null;
}

// Whether the clause ends at j with no `from` after it: a ; or =, or braces that close with none next.
function clauseEnds(toks, j) {
  const tok = toks[j];
  return isP(tok, ";") || isP(tok, "=") || (isP(tok, "}") && !isId(toks[j + 1], "from"));
}

// The token at j of a clause started at k: where its braces open or close, or a name it takes.
function takeInClause(toks, j, k, clause) {
  const tok = toks[j];
  if (isP(tok, "{")) clause.braces = true;
  else if (isP(tok, "}")) clause.braces = false;
  else if (isP(tok, "*")) clause.names.push("*");
  else if (tok.t === "id") {
    const name = clause.braces ? nameInBraces(toks, j) : nameBeforeBraces(toks, j, k);
    if (name) clause.names.push(name);
  }
}

// The name an id inside the braces gives (`type` itself where it stands as a name), null for a keyword.
function nameInBraces(toks, j) {
  const tok = toks[j];
  if (tok.v === "type") return isP(toks[j + 1], ",") || isP(toks[j + 1], "}") ? tok.v : null;
  return !isId(toks[j - 1], "as") && tok.v !== "as" ? tok.v : null;
}

// "default" for the id that starts a clause started at k (not `type`), or follows a , that no braces or `type` precede.
function nameBeforeBraces(toks, j, k) {
  const first = j === k && toks[j].v !== "type";
  return first || (isP(toks[j - 1], ",") && !isP(toks[j - 2], "}") && !isId(toks[j - 2], "type")) ? "default" : null;
}

// Whether a file is a module: it imports, exports or requires (module.exports too); one that does none of these, a
// dynamic import aside, shares its top level with every other such file a page loads.
export function isModule(toks) {
  return toks.some((tok, k) => tok.t === "id" && notMember(toks, k)
    && (tok.v === "export" || (tok.v === "import" && !isP(toks[k + 1], "(")) || (tok.v === "require" && isP(toks[k + 1], "("))
      || (tok.v === "module" && isP(toks[k + 1], ".") && isId(toks[k + 2], "exports"))));
}

// The names a file's top level declares: function, class, var, let and const, the first of each list.
export function globals(toks) {
  const names = new Set();
  let depth = 0;
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    if (tok.t === "punct" && "([{".includes(tok.v)) depth++;
    else if (tok.t === "punct" && ")]}".includes(tok.v)) depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const name = declaredAt(toks, k);
      if (name) names.add(name);
    }
  }
  return [...names];
}

// The name the declaration at k gives, null where none starts there (a function or class as an expression has none).
function declaredAt(toks, k) {
  const tok = toks[k];
  if (tok.t !== "id" || !["function", "class", "var", "let", "const"].includes(tok.v) || !notMember(toks, k)) return null;
  const next = isP(toks[k + 1], "*") ? toks[k + 2] : toks[k + 1];
  return next?.t === "id" && !isExpression(toks, k) ? next.v : null;
}

function isExpression(toks, k) {
  const tok = toks[k], before = toks[k - 1];
  if (tok.v !== "function" && tok.v !== "class") return false;
  return before && !isP(before, ";") && !isP(before, "}") && !isId(before, "export") && !isId(before, "async");
}

// A tree of dotted names, each by its parts; `lyingUnder` gives the names of it that a dotted name is or lies under,
// shortest first, and `holdsUnder` whether any name of it lies under a dotted name, each in one walk of the name.
export function nameTree(names) {
  const root = new Map();
  for (const name of names) {
    let node = root;
    for (const part of name.split(".")) { if (!node.has(part)) node.set(part, new Map()); node = node.get(part); }
    node.name = name;
  }
  return root;
}
export function lyingUnder(tree, name) {
  const out = [];
  let node = tree;
  for (const part of name.split(".")) { node = node.get(part); if (!node) break; if (node.name !== undefined) out.push(node.name); }
  return out;
}
export function holdsUnder(tree, name) {
  let node = tree;
  for (const part of name.split(".")) { node = node.get(part); if (!node) return false; }
  return node.size > 0;
}

// Adds a value to the list a map holds under a key, the list made where there is none yet.
export const append = (map, key, value) => { const list = map.get(key); if (list) list.push(value); else map.set(key, [value]); };

// Where an import leads in the repository: the file it names, with its extension or index added as Node and the
// bundlers add them, or the file of a package the repository holds itself; null for a package from outside.
export function resolve(from, spec, files, packages) {
  const tryFile = p => {
    p = path.posix.normalize(p);
    const tries = [p, ...CODE.map(e => p + e), ...CODE.map(e => `${p}/index${e}`)];
    if (/\.(m|c)?js$/.test(p)) tries.push(...[".ts", ".tsx", ".mts", ".cts"].map(e => p.replace(/\.(m|c)?js$/, e)));
    return tries.find(t => files.has(t)) ?? null;
  };
  if (spec.startsWith("./") || spec.startsWith("../") || spec === "." || spec === "..") return tryFile(path.posix.join(path.posix.dirname(from), spec));
  const name = packageName(spec);
  const pkg = packages.get(name);
  if (!pkg) return null;
  const rest = spec.slice(name.length);
  return rest ? tryFile(path.posix.join(pkg.dir, rest)) : tryFile(path.posix.join(pkg.dir, pkg.main ?? "index"));
}

// The cycles of a graph (a Map of node to a Set of nodes): its strongly connected parts of more than one node, and each
// node that leads to itself, each part's nodes sorted.
export function cycles(graph) {
  let index = 0;
  const idx = new Map(), low = new Map(), on = new Set(), stack = [], parts = [];
  const visit = start => { // Tarjan's, kept iterative so a long chain of imports does not overflow the stack
    const work = [[start, [...(graph.get(start) ?? [])], 0]];
    idx.set(start, index); low.set(start, index); index++; stack.push(start); on.add(start);
    while (work.length) {
      const frame = work[work.length - 1], [v, next] = frame;
      if (frame[2] < next.length) {
        const w = next[frame[2]++];
        if (!idx.has(w)) { idx.set(w, index); low.set(w, index); index++; stack.push(w); on.add(w); work.push([w, [...(graph.get(w) ?? [])], 0]); }
        else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
        continue;
      }
      work.pop();
      if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
      if (low.get(v) === idx.get(v)) {
        const part = [];
        let w;
        do { w = stack.pop(); on.delete(w); part.push(w); } while (w !== v);
        if (part.length > 1 || graph.get(v)?.has(v)) parts.push(part.sort());
      }
    }
  };
  for (const v of [...graph.keys()].sort()) if (!idx.has(v)) visit(v);
  return parts.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}

const folderOf = (file, depth) => { const parts = path.posix.dirname(file).split("/"); return (depth ? parts.slice(0, depth) : parts).join("/") || "."; };
const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
const addEdge = (graph, a, b) => { if (!graph.has(a)) graph.set(a, new Set()); graph.get(a).add(b); };

// The packages the files declare, by name: { dir, main } of each package.json that has a name.
function packagesOf(texts) {
  const packages = new Map();
  for (const [file, text] of Object.entries(texts)) if (path.posix.basename(file) === "package.json") {
    try { const p = JSON.parse(text); if (typeof p.name === "string") packages.set(p.name, { dir: path.posix.dirname(file), main: typeof p.main === "string" ? p.main : null }); } catch { /* not a package's */ }
  }
  return packages;
}

// A package's name in an import's spec: its first part, or its first two where it is scoped.
const packageName = spec => spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];

// Every measure of the files given ({ path: text }), with the history's commits (lists of the paths each touched,
// newest first) and the suites' runs.
export function measure(texts, { depth = 0, commits = [], suites = [], other = {} } = {}) {
  const files = new Set(Object.keys(texts));
  const code = [...files].filter(f => CODE.includes(path.posix.extname(f))).sort();
  const book = {
    files, packages: packagesOf(texts), depth, fileGraph: new Map(), withTypes: new Map(), folderGraph: new Map(),
    folderEdges: new Map(), offered: new Map(), external: new Map(), unresolved: [], total: 0, crossing: 0,
  };
  const fns = [], scripts = [];
  for (const file of code) {
    const toks = tokens(texts[file], jsxIn(file));
    for (const fn of javascriptFunctions(file, texts[file]) ?? []) fns.push({ file, ...fn });
    if (!isModule(toks)) scripts.push({ file, names: globals(toks) });
    for (const imp of imports(toks)) noteImport(book, file, imp);
  }
  return {
    files: { code: code.length, other },
    imports: importsSummary(book),
    cycles: { files: cycles(book.fileGraph), folders: cycles(book.folderGraph), filesWithTypes: cycles(book.withTypes) },
    hubs: hubsOf(book.offered),
    globals: globalsSummary(scripts),
    functions: functionsSummary(fns),
    changedTogether: changedTogether(commits, new Set(code)),
    suites,
  };
}

// An import of `file` set in the book: counted, and either where it leads in the repository or what it leaves out.
function noteImport(book, file, imp) {
  book.total++;
  const to = resolve(file, imp.spec, book.files, book.packages);
  if (to) noteEdges(book, file, to, imp);
  else noteLeftOut(book, file, imp.spec);
}

// An import that leads to no file: a relative one that should have (named a file, or none by its extension) is listed
// as unresolved; a package from outside is counted by name.
function noteLeftOut(book, file, spec) {
  if (/^\.\.?(\/|$)/.test(spec)) {
    if (!/\.[A-Za-z0-9]+$/.test(spec) || CODE.includes(path.posix.extname(spec))) book.unresolved.push(`${file}: ${spec}`);
    return;
  }
  const name = packageName(spec);
  book.external.set(name, (book.external.get(name) ?? 0) + 1);
}

// The edges an import from `file` to the file `to` adds: between files, with the imports of types alone left out of
// the graphs of what runs (a dynamic import makes none), and between folders.
function noteEdges(book, file, to, imp) {
  const runs = imp.kind !== "dynamic";
  if (runs) addEdge(book.withTypes, file, to);
  if (runs && !imp.types) addEdge(book.fileGraph, file, to);
  if (!book.offered.has(to)) book.offered.set(to, { by: new Set(), names: new Set() });
  book.offered.get(to).by.add(file);
  for (const n of imp.names) book.offered.get(to).names.add(n);
  const a = folderOf(file, book.depth), b = folderOf(to, book.depth);
  if (a === b) return;
  book.crossing++;
  if (runs && !imp.types) addEdge(book.folderGraph, a, b);
  const key = `${a}\u0000${b}`;
  book.folderEdges.set(key, (book.folderEdges.get(key) ?? 0) + 1);
}

function importsSummary(book) {
  const { total, crossing, offered, external, unresolved } = book;
  return {
    total, crossingAFolder: crossing, intoTheRepository: [...offered.values()].reduce((s, o) => s + o.by.size, 0),
    external: Object.fromEntries([...external].sort((a, b) => b[1] - a[1])), unresolved,
    foldersBothWays: foldersBothWays(book.folderEdges),
  };
}

// The pairs of folders that import each other, the pair that does so least often last.
function foldersBothWays(folderEdges) {
  const bothWays = [];
  for (const [key, n] of folderEdges) {
    const [a, b] = key.split("\u0000"), back = folderEdges.get(`${b}\u0000${a}`);
    if (back && a < b) bothWays.push({ folders: [a, b], imports: [n, back] });
  }
  return bothWays.sort((x, y) => Math.min(...y.imports) - Math.min(...x.imports));
}

// The files more than one file imports, most imported first, with the names each gives them.
function hubsOf(offered) {
  const hubs = [...offered].map(([file, o]) => ({ file, importedBy: o.by.size, names: [...o.names].sort() }))
    .sort((x, y) => y.importedBy - x.importedBy || x.file.localeCompare(y.file));
  return hubs.filter(h => h.importedBy > 1);
}

// The scripts' ({ file, names }) global names, and those more than one of them declares.
function globalsSummary(scripts) {
  const declared = new Map();
  for (const s of scripts) for (const n of s.names) append(declared, n, s.file);
  const inMoreThanOne = [...declared].filter(([, f]) => f.length > 1).map(([name, f]) => ({ name, files: f.sort() }))
    .sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name));
  return { scripts: scripts.length, names: scripts.reduce((s, x) => s + x.names.length, 0), inMoreThanOne };
}

function functionsSummary(fns) {
  const lengths = fns.map(f => f.lines).sort((a, b) => a - b);
  const byLength = [...fns].sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file) || a.line - b.line);
  const byDepth = [...fns].sort((a, b) => b.depth - a.depth || b.lines - a.lines || a.file.localeCompare(b.file));
  const lines = { median: quantile(lengths, 0.5), p90: quantile(lengths, 0.9), max: lengths.at(-1) ?? 0 };
  return {
    count: fns.length, lines, over50Lines: fns.filter(f => f.lines > 50).length, over100Lines: fns.filter(f => f.lines > 100).length,
    depth4OrMore: fns.filter(f => f.depth >= 4).length, ...branching(fns), longest: byLength.slice(0, 20),
    deepest: byDepth.filter(f => f.depth > 0).slice(0, 20),
  };
}

// How the functions branch: how many do so more than 15 and more than 30 times, and the twenty that branch most.
function branching(fns) {
  const most = fns.filter(f => f.branches > 0).sort((a, b) => b.branches - a.branches || a.file.localeCompare(b.file) || a.line - b.line);
  return { over15Branches: fns.filter(f => f.branches > 15).length, over30Branches: fns.filter(f => f.branches > 30).length, mostBranching: most.slice(0, 20) };
}

// The pairs of files changed in the same commits, most often first: how often, and what share of the rarer one's
// changes that is.
export function changedTogether(commits, measured) {
  const changes = new Map(), pairs = new Map();
  let read = 0;
  for (const commit of commits) {
    const touched = [...new Set(commit)].filter(f => measured.has(f)).sort();
    if (touched.length > BULK) continue;
    read++;
    for (const f of touched) changes.set(f, (changes.get(f) ?? 0) + 1);
    for (let a = 0; a < touched.length; a++) for (let b = a + 1; b < touched.length; b++) {
      const key = `${touched[a]}\u0000${touched[b]}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
  }
  const list = [...pairs].filter(([, n]) => n >= 3).map(([key, n]) => {
    const files = key.split("\u0000");
    return { files, together: n, share: Math.round(100 * n / Math.min(...files.map(f => changes.get(f)))) / 100 };
  }).sort((x, y) => y.together - x.together || y.share - x.share || x.files[0].localeCompare(y.files[0]));
  const mostChanged = [...changes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([file, n]) => ({ file, changes: n }));
  return { commits: read, pairs: list.slice(0, 50), mostChanged };
}

// The project's root: the repository named, or the one this copy stands in, a project's whose library carries its core
// in a submodule included (core-path.mjs).
const rootOf = (repo, here) => (repo ? "" : projectAt(here).root) || execFileSync("git", [...SAFE, "rev-parse", "--show-toplevel"], { cwd: repo ?? here, encoding: "utf8" }).trim();

// What is read where none is named: the whole repository, but the core's copy where this script stands in one (the path
// from the root to it as git itself says it, since a path worked out from two folders' names can differ in spelling,
// as a short name of Windows' does from the long one git gives; core-path.mjs), and another repository's, at the path its
// manifest names (core/ where it has none).
const specsOf = (repo, here, root) => {
  const copy = repo ? copyOf(root) : projectAt(here).prefix.replace(/scripts\/$/u, "");
  return copy ? [".", `:!${copy}`] : ["."];
};

function main(argv) {
  const opts = parseArguments(argv);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = rootOf(opts.repo, here), specs = opts.specs.length ? opts.specs : specsOf(opts.repo, here, root);
  const listed = execFileSync("git", [...SAFE, "ls-files", "-z", "--", ...specs], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
  const { texts, other } = readFiles(root, listed);
  const log = execFileSync("git", [...SAFE, "log", "--no-merges", "-n", String(opts.history), "--format=%x00", "--name-only", "--", ...specs], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
  const commits = log.split("\0").slice(1).map(c => c.split("\n").map(s => s.trim()).filter(Boolean));
  const suites = opts.suites.map(command => runSuite(root, command));
  const m = measure(texts, { depth: opts.depth, commits, suites, other });
  if (opts.json) fs.writeFileSync(opts.json, JSON.stringify(m, null, 2) + "\n");
  print(m);
}

function parseArguments(argv) {
  const opts = { specs: [], suites: [], depth: 0, history: 500, json: null, repo: null };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    const value = () => { if (k + 1 >= argv.length) fail(`${a} needs a value`); return argv[++k]; };
    if (a === "--depth") opts.depth = whole(value(), a);
    else if (a === "--history") opts.history = whole(value(), a);
    else if (a === "--suite") opts.suites.push(value());
    else if (a === "--json") opts.json = path.resolve(value());
    else if (a === "--repo") opts.repo = path.resolve(value());
    else if (a.startsWith("--")) fail(`unknown option ${a}`);
    else opts.specs.push(a);
  }
  return opts;
}

// The text of each code file listed, and the count of files in other languages by extension.
function readFiles(root, listed) {
  const texts = {}, other = {};
  for (const f of listed) {
    const ext = path.posix.extname(f);
    if (CODE.includes(ext) || path.posix.basename(f) === "package.json") { // never through a link, which may lead outside
      try { if (!fs.lstatSync(path.join(root, f)).isSymbolicLink()) texts[f] = fs.readFileSync(path.join(root, f), "utf8"); } catch { /* listed, not on disk */ }
    }
    else if (OTHER.includes(ext)) other[ext] = (other[ext] ?? 0) + 1;
  }
  return { texts, other };
}

function runSuite(root, command) {
  const start = process.hrtime.bigint();
  const r = spawnSync(command, { cwd: root, shell: true, stdio: "ignore" });
  return { command, seconds: Math.round(Number(process.hrtime.bigint() - start) / 1e8) / 10, passed: r.status === 0 };
}

function print(m) {
  const say = s => console.log(s);
  say(`files: ${m.files.code} read${Object.keys(m.files.other).length ? `; not measured here: ${Object.entries(m.files.other).map(([e, n]) => `${n} ${e}`).join(", ")}` : ""}`);
  say(`imports: ${m.imports.total}, ${m.imports.crossingAFolder} crossing a folder; folders that import each other both ways: ${m.imports.foldersBothWays.length}`);
  for (const b of m.imports.foldersBothWays.slice(0, 5)) say(`  ${b.folders[0]} <-> ${b.folders[1]} (${b.imports[0]} and ${b.imports[1]})`);
  say(`cycles: ${m.cycles.files.length} between files, ${m.cycles.folders.length} between folders; ${m.cycles.filesWithTypes.length} between files where imports of types alone count too`);
  for (const c of m.cycles.files.slice(0, 5)) say(`  ${c.length} files: ${c.slice(0, 4).join(", ")}${c.length > 4 ? ", ..." : ""}`);
  say(`hubs (imported by most): ${m.hubs.slice(0, 5).map(h => `${h.file} (${h.importedBy})`).join(", ") || "none"}`);
  say(`files with no import: ${m.globals.scripts}, declaring ${m.globals.names} global names, ${m.globals.inMoreThanOne.length} of them in more than one file`);
  const f = m.functions;
  say(`functions: ${f.count}; lines median ${f.lines.median}, 90th percentile ${f.lines.p90}, longest ${f.lines.max}; over 50 lines ${f.over50Lines}, over 100 ${f.over100Lines}; nesting 4 deep or more ${f.depth4OrMore}; branching more than 15 times ${f.over15Branches}, more than 30 ${f.over30Branches}`);
  for (const x of f.longest.slice(0, 5)) say(`  ${x.file}:${x.line} ${x.name}, ${x.lines} lines, ${x.depth} deep, ${x.branches} branch points`);
  const t = m.changedTogether;
  say(`changed together (${t.commits} commits): ${t.pairs.slice(0, 5).map(p => `${p.files.join(" + ")} ${p.together}x`).join("; ") || "no pair 3 times"}`);
  for (const s of m.suites) say(`suite: ${s.command}: ${s.seconds} s, ${s.passed ? "passed" : "FAILED"}`);
}

function whole(v, name) { if (!/^[0-9]+$/.test(v)) fail(`${name} takes a whole number`); return Number(v); }
function fail(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }

if (started(import.meta.url)) main(process.argv.slice(2));
