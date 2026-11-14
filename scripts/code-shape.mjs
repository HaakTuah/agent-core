// The measures of how a codebase is put together (#245): the audit's numbers kept as a script, so the next audit is a
// run and not a study. It reads the JavaScript and TypeScript files git holds and prints a summary; with --json it
// writes every number, the lists a baseline would hold among them. It measures and fails nothing: what is held, and
// how, is the module's that follows the audit (#246). Node's own modules and git only.
//
// What it gives, of the files it reads:
//   - imports: how many, how many cross a folder, those of code that lead to no file, and the pairs of folders that import each other both ways (no layer
//     is declared yet, so a pair that runs both ways is the sign of an import against the grain that needs none);
//   - import cycles, between files and between folders, of what runs (a dynamic import, or one of types alone, which
//     TypeScript erases, makes none), and between files with those of types counted too;
//   - hubs: the files most others import, and the names each gives them;
//   - shared global names: in a file with no import, export or require, what its top level declares, and the names
//     more than one such file declares;
//   - functions: how many lines each spans and how deep its blocks nest (if, for, while, switch, catch, else, try, do;
//     a function within it is measured on its own);
//   - which files change together in the history (commits that touch more than 30 of them, such as a move, are left
//     out, and so is every merge);
//   - with --suite, how long each named suite takes when it runs alone, and whether it passed.
// Its reader is a lexer, not a parser: it knows comments, strings, template literals and regular expressions, so a
// bracket in one of them is not counted, but it does not read JSX, and a function or a block it cannot tell from its
// brackets alone (a body after a return type in TypeScript that holds braces, an if with no braces) is measured as the
// brackets show it. Files in other languages are counted and named, and left to the project's own tools.
//
//   node core/scripts/code-shape.mjs [<pathspec>...] [--repo <folder>] [--depth <n>] [--history <n>]
//                                    [--suite "<command>"]... [--json <file>]
//
//   <pathspec>   git pathspecs of the code to measure (":!" leaves a path out); left out, the whole repository but for
//                a copy of the core (core/), where the script runs from that copy or measures another repository
//   --repo       the repository to measure, a clone this script does not lie in (one read for an audit); left out, the
//                one it lies in
//   --depth      a folder is the first n parts of a file's path (packages/engine, for 2); left out, its whole folder
//   --history    how many of the newest commits the count of what changes together reads; 500 if left out
//   --suite      a command that runs one suite, run alone from the repository's root and timed; may be repeated
//   --json       the file every number is written to, as JSON
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { started } from "./started.mjs";

export const CODE = [".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx"];
const OTHER = [".cs", ".py", ".go", ".rs", ".java", ".kt", ".swift", ".gd", ".lua", ".c", ".cpp", ".h", ".rb", ".php"];
const REGEX_AFTER = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
const CONTROL = new Set(["if", "for", "while", "switch", "catch", "with"]);
const CONTROL_BARE = new Set(["else", "try", "finally", "do"]);
const TYPE_TOKENS = new Set([".", "<", ">", "[", "]", "|", "&", ",", "?"]);
const BULK = 30; // a commit that touches more of the measured files than this is a move or a sweep, not a sign
const OPEN = { ")": "(", "]": "[", "}": "{" };

// The tokens of a file's text: { t: "id" | "num" | "str" | "regex" | "punct", v, line }. Comments and white space are
// dropped; a template literal is a "str" token for each run of its text, with the code of each ${ } between them.
export function tokens(src) {
  const out = [], stack = []; // stack: for each open ${ }, how many { are open inside it
  const parens = []; // for each open (, whether it opens an if, for, while or with's condition
  let i = src.startsWith("#!") ? src.indexOf("\n") : 0, line = 1, prev = null;
  if (i < 0) return out;
  const n = src.length;
  const push = (t, v, l = line) => { prev = { t, v, line: l }; out.push(prev); };
  const lines = (a, b) => { for (let k = a; k < b; k++) if (src[k] === "\n") line++; };
  // a / starts a regular expression where no value stands before it: at the start, after an operator, a keyword, or the
  // ) that closes a condition (`if (x) /a/.test(y)`)
  const regexHere = () => !prev || (prev.t === "punct" && (prev.v !== ")" || prev.condition) && prev.v !== "]") || (prev.t === "id" && REGEX_AFTER.has(prev.v));
  const template = () => { // from just inside a template's text to its end or its next ${
    const from = line;
    while (i < n) {
      const c = src[i];
      if (c === "\\") { lines(i, i + 2); i += 2; continue; }
      if (c === "`") { i++; push("str", "`", from); return; }
      if (c === "$" && src[i + 1] === "{") { i += 2; push("str", "`", from); stack.push(0); return; }
      if (c === "\n") line++;
      i++;
    }
    push("str", "`", from);
  };
  while (i < n) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v" || c === "﻿") { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2), end = e < 0 ? n : e + 2; lines(i, end); i = end; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      const from = line; lines(i, Math.min(j, n)); push("str", src.slice(i + 1, j), from); i = j + 1; continue;
    }
    if (c === "`") { i++; template(); continue; }
    if (c === "/" && regexHere()) {
      let j = i + 1, inClass = false;
      while (j < n && src[j] !== "\n") {
        const d = src[j];
        if (d === "\\") { j += 2; continue; }
        if (inClass) { if (d === "]") inClass = false; } else if (d === "[") inClass = true; else if (d === "/") break;
        j++;
      }
      if (src[j] === "/") { j++; while (j < n && /[A-Za-z]/.test(src[j])) j++; push("regex", src.slice(i, j)); i = j; continue; }
    }
    if (/[A-Za-z_$#\u0080-￿]/.test(c)) {
      let j = i + 1; while (j < n && /[A-Za-z0-9_$\u0080-￿]/.test(src[j])) j++;
      push("id", src.slice(i, j)); i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i + 1; while (j < n && /[0-9A-Za-z_.]/.test(src[j])) j++;
      push("num", src.slice(i, j)); i = j; continue;
    }
    if (c === "{" && stack.length) stack[stack.length - 1]++;
    if (c === "}" && stack.length) {
      if (stack[stack.length - 1] === 0) { stack.pop(); i++; template(); continue; }
      stack[stack.length - 1]--;
    }
    if (src.startsWith("=>", i)) { push("punct", "=>"); i += 2; continue; }
    const condition = c === "(" ? prev?.t === "id" && ["if", "while", "for", "with"].includes(prev.v) || (isId(prev, "await") && isId(out.at(-2), "for")) : false;
    if (c === "(") parens.push(condition);
    push("punct", c); i++;
    if (c === ")") prev.condition = parens.pop() === true;
  }
  return out;
}

const isId = (tok, v) => tok?.t === "id" && (v === undefined || tok.v === v);
const isP = (tok, v) => tok?.t === "punct" && tok.v === v;
const notMember = (toks, k) => !isP(toks[k - 1], ".") && !isP(toks[k - 1], "?");

// What a file imports: [{ spec, kind: "import" | "export" | "dynamic" | "require", names }], names being what it takes
// by name ("default" and "*" for a default and a whole namespace; empty where it takes nothing by name or the call
// says nothing of it).
export function imports(toks) {
  const found = [];
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    if (tok.t !== "id" || !notMember(toks, k)) continue;
    if (tok.v === "require" && isP(toks[k + 1], "(") && toks[k + 2]?.t === "str" && isP(toks[k + 3], ")")) found.push({ spec: toks[k + 2].v, kind: "require", names: [] });
    else if (tok.v === "import" && isP(toks[k + 1], "(") && toks[k + 2]?.t === "str") found.push({ spec: toks[k + 2].v, kind: "dynamic", names: [] });
    else if (tok.v === "import" && toks[k + 1]?.t === "str") found.push({ spec: toks[k + 1].v, kind: "import", names: [] });
    else if (tok.v === "import" && !isP(toks[k + 1], ".") && !isP(toks[k + 1], "(")) { const f = fromClause(toks, k + 1); if (f) found.push({ ...f, kind: "import", types: typesOnly(toks, k + 1) }); }
    else if (tok.v === "export" && (isP(toks[k + 1], "{") || isP(toks[k + 1], "*") || isId(toks[k + 1], "type"))) { const f = fromClause(toks, k + 1); if (f) found.push({ ...f, kind: "export", types: typesOnly(toks, k + 1) }); }
  }
  return found;
}

// Whether an import or export clause takes types alone, which TypeScript erases before the code runs: `import type`,
// or braces whose every name is marked `type`.
function typesOnly(toks, k) {
  if (isId(toks[k], "type") && !isId(toks[k + 1], "from") && !isP(toks[k + 1], ",")) return true;
  if (!isP(toks[k], "{")) return false;
  let names = 0;
  for (let j = k + 1; j < toks.length && !isP(toks[j], "}"); j++) {
    if (isP(toks[j], ",") || isId(toks[j], "as") || isId(toks[j - 1], "as")) continue;
    if (!isId(toks[j], "type") || isP(toks[j + 1], ",") || isP(toks[j + 1], "}")) return false;
    names++; j++;
  }
  return names > 0;
}

// The names an import or export clause takes, and the module after its `from`; null where none follows it: where the
// clause ends (its braces close, or an = shows a declaration) with no `from` after it, so a statement with no semicolon
// never lends its `from` to the one before it.
function fromClause(toks, k) {
  const names = [];
  let braces = false;
  for (let j = k; j < toks.length && j < k + 400; j++) {
    const tok = toks[j];
    if (isP(tok, ";") || isP(tok, "=") || (isP(tok, "}") && !isId(toks[j + 1], "from"))) return null;
    if (isId(tok, "from") && !braces && toks[j + 1]?.t === "str") return { spec: toks[j + 1].v, names };
    if (isP(tok, "{")) braces = true;
    else if (isP(tok, "}")) braces = false;
    else if (isP(tok, "*")) names.push("*");
    else if (tok.t === "id" && braces && !isId(toks[j - 1], "as") && tok.v !== "type" && tok.v !== "as") names.push(tok.v);
    else if (tok.t === "id" && braces && tok.v === "type" && (isP(toks[j + 1], ",") || isP(toks[j + 1], "}"))) names.push(tok.v);
    else if (tok.t === "id" && !braces && j === k && tok.v !== "type") names.push("default");
    else if (tok.t === "id" && !braces && isP(toks[j - 1], ",") && !isP(toks[j - 2], "}") && !isId(toks[j - 2], "type")) names.push("default");
  }
  return null;
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
    else if (depth === 0 && tok.t === "id" && ["function", "class", "var", "let", "const"].includes(tok.v) && notMember(toks, k)) {
      const next = isP(toks[k + 1], "*") ? toks[k + 2] : toks[k + 1];
      const before = toks[k - 1];
      const expression = tok.v === "function" || tok.v === "class" ? before && !isP(before, ";") && !isP(before, "}") && !isId(before, "export") && !isId(before, "async") : false;
      if (next?.t === "id" && !expression) names.add(next.v);
    }
  }
  return [...names];
}

// The functions of a file: [{ name, line, lines, depth }], lines from the line of its body's { to that of its }, depth
// the deepest its control blocks nest inside it.
export function functions(toks) {
  const found = [], stack = [];
  const openAt = new Map();
  const top = () => { for (let s = stack.length - 1; s >= 0; s--) if (stack[s].v === "{") return stack[s]; return null; };
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    if (tok.t !== "punct") continue;
    if (tok.v === "(" || tok.v === "[") stack.push({ v: tok.v, k });
    else if (tok.v === "{") {
      const kind = blockKind(toks, k, openAt);
      const parent = top();
      const entry = { v: "{", k, kind, fn: parent?.fn ?? null, cd: kind === "function" ? 0 : parent?.cd ?? 0 };
      if (kind === "function") {
        entry.fn = { name: functionName(toks, k, openAt), line: tok.line, lines: 1, depth: 0 };
        found.push(entry.fn);
      } else if (kind === "control") {
        entry.cd++;
        if (entry.fn) entry.fn.depth = Math.max(entry.fn.depth, entry.cd);
      }
      stack.push(entry);
    } else if (OPEN[tok.v]) {
      let s = stack.length - 1;
      while (s >= 0 && stack[s].v !== OPEN[tok.v]) s--;
      if (s < 0) continue;
      const entry = stack[s];
      stack.length = s;
      openAt.set(k, entry.k);
      if (entry.kind === "function") entry.fn.lines = tok.line - toks[entry.k].line + 1;
    }
  }
  return found;
}

// The token a block's header ends on, a return type in TypeScript passed over: the ) of `f(a): T {`.
function headerEnd(toks, k, openAt) {
  const prev = toks[k - 1];
  if (isP(prev, ")") || isP(prev, "=>")) return k - 1;
  for (let j = k - 1; j > 0 && j > k - 40; j--) {
    const tok = toks[j];
    if (isP(tok, ":") && j < k - 1 && isP(toks[j - 1], ")") && openAt.has(j - 1)) return j - 1;
    if (!(tok.t === "id" || tok.t === "str" || tok.t === "num" || (tok.t === "punct" && TYPE_TOKENS.has(tok.v)))) break;
  }
  return k - 1;
}

function blockKind(toks, k, openAt) {
  const end = headerEnd(toks, k, openAt), tok = toks[end];
  if (isP(tok, "=>")) return "function";
  if (tok?.t === "id") return CONTROL_BARE.has(tok.v) || tok.v === "catch" ? "control" : "other";
  if (!isP(tok, ")") || !openAt.has(end)) return "other";
  const at = typeParameters(toks, openAt.get(end)), before = toks[at - 1];
  if (before?.t !== "id") return "other";
  return CONTROL.has(before.v) || (before.v === "await" && isId(toks[at - 2], "for")) ? "control" : "function";
}

// Where a function's header starts before its parameters' (, its type parameters passed over: the < of `f<T>(a)`.
function typeParameters(toks, open) {
  if (!isP(toks[open - 1], ">")) return open;
  let depth = 0;
  for (let j = open - 1; j > 0 && j > open - 40; j--) {
    if (isP(toks[j], ">")) depth++;
    else if (isP(toks[j], "<") && --depth === 0) return toks[j - 1]?.t === "id" ? j : open;
    else if (!(toks[j].t === "id" || (toks[j].t === "punct" && TYPE_TOKENS.has(toks[j].v)))) return open;
  }
  return open;
}

function functionName(toks, k, openAt) {
  const end = headerEnd(toks, k, openAt);
  let start = end; // the first token of the header's parameters
  if (isP(toks[end], "=>")) start = isP(toks[end - 1], ")") && openAt.has(end - 1) ? openAt.get(end - 1) : end - 1;
  else if (openAt.has(end)) start = typeParameters(toks, openAt.get(end));
  let j = start - 1;
  if (isId(toks[j], "async")) j--;
  const tok = toks[j];
  if (tok?.t === "id" && tok.v !== "function" && !isP(toks[end], "=>")) return tok.v;
  if (isId(tok, "function") || isP(toks[end], "=>")) {
    let b = isId(tok, "function") ? j - 1 : j;
    if (isId(toks[b], "async")) b--;
    if ((isP(toks[b], "=") || isP(toks[b], ":")) && (toks[b - 1]?.t === "id" || toks[b - 1]?.t === "str")) return toks[b - 1].v;
  }
  return "(anonymous)";
}

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
  const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
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

// Every measure of the files given ({ path: text }), with the history's commits (lists of the paths each touched,
// newest first) and the suites' runs.
export function measure(texts, { depth = 0, commits = [], suites = [], other = {} } = {}) {
  const files = new Set(Object.keys(texts));
  const packages = new Map();
  for (const [file, text] of Object.entries(texts)) if (path.posix.basename(file) === "package.json") {
    try { const p = JSON.parse(text); if (typeof p.name === "string") packages.set(p.name, { dir: path.posix.dirname(file), main: typeof p.main === "string" ? p.main : null }); } catch { /* not a package's */ }
  }
  const code = [...files].filter(f => CODE.includes(path.posix.extname(f))).sort();
  const fileGraph = new Map(), withTypes = new Map(), folderGraph = new Map(), folderEdges = new Map(), offered = new Map(), external = new Map();
  const fns = [], scripts = [], unresolved = [];
  let total = 0, crossing = 0;
  for (const file of code) {
    const toks = tokens(texts[file]);
    for (const fn of functions(toks)) fns.push({ file, ...fn });
    if (!isModule(toks)) scripts.push({ file, names: globals(toks) });
    for (const imp of imports(toks)) {
      total++;
      const to = resolve(file, imp.spec, files, packages);
      if (!to && /^\.\.?(\/|$)/.test(imp.spec)) { if (!/\.[A-Za-z0-9]+$/.test(imp.spec) || CODE.includes(path.posix.extname(imp.spec))) unresolved.push(`${file}: ${imp.spec}`); continue; }
      if (!to) { const name = imp.spec.startsWith("@") ? imp.spec.split("/").slice(0, 2).join("/") : imp.spec.split("/")[0]; external.set(name, (external.get(name) ?? 0) + 1); continue; }
      if (imp.kind !== "dynamic") addEdge(withTypes, file, to);
      if (imp.kind !== "dynamic" && !imp.types) addEdge(fileGraph, file, to);
      if (!offered.has(to)) offered.set(to, { by: new Set(), names: new Set() });
      offered.get(to).by.add(file);
      for (const n of imp.names) offered.get(to).names.add(n);
      const a = folderOf(file, depth), b = folderOf(to, depth);
      if (a !== b) {
        crossing++;
        if (imp.kind !== "dynamic" && !imp.types) addEdge(folderGraph, a, b);
        const key = `${a}\u0000${b}`;
        folderEdges.set(key, (folderEdges.get(key) ?? 0) + 1);
      }
    }
  }
  const bothWays = [];
  for (const [key, n] of folderEdges) {
    const [a, b] = key.split("\u0000"), back = folderEdges.get(`${b}\u0000${a}`);
    if (back && a < b) bothWays.push({ folders: [a, b], imports: [n, back] });
  }
  const hubs = [...offered].map(([file, o]) => ({ file, importedBy: o.by.size, names: [...o.names].sort() }))
    .sort((x, y) => y.importedBy - x.importedBy || x.file.localeCompare(y.file));
  const declared = new Map();
  for (const s of scripts) for (const n of s.names) declared.set(n, [...(declared.get(n) ?? []), s.file]);
  const lengths = fns.map(f => f.lines).sort((a, b) => a - b);
  const byLength = [...fns].sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file) || a.line - b.line);
  const byDepth = [...fns].sort((a, b) => b.depth - a.depth || b.lines - a.lines || a.file.localeCompare(b.file));
  return {
    files: { code: code.length, other },
    imports: { total, crossingAFolder: crossing, intoTheRepository: [...offered.values()].reduce((s, o) => s + o.by.size, 0), external: Object.fromEntries([...external].sort((a, b) => b[1] - a[1])), unresolved, foldersBothWays: bothWays.sort((x, y) => Math.min(...y.imports) - Math.min(...x.imports)) },
    cycles: { files: cycles(fileGraph), folders: cycles(folderGraph), filesWithTypes: cycles(withTypes) },
    hubs: hubs.filter(h => h.importedBy > 1),
    globals: { scripts: scripts.length, names: scripts.reduce((s, x) => s + x.names.length, 0), inMoreThanOne: [...declared].filter(([, f]) => f.length > 1).map(([name, f]) => ({ name, files: f.sort() })).sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name)) },
    functions: { count: fns.length, lines: { median: quantile(lengths, 0.5), p90: quantile(lengths, 0.9), max: lengths.at(-1) ?? 0 }, over50Lines: fns.filter(f => f.lines > 50).length, over100Lines: fns.filter(f => f.lines > 100).length, depth4OrMore: fns.filter(f => f.depth >= 4).length, longest: byLength.slice(0, 20), deepest: byDepth.filter(f => f.depth > 0).slice(0, 20) },
    changedTogether: changedTogether(commits, new Set(code)),
    suites,
  };
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

function main(argv) {
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
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: opts.repo ?? here, encoding: "utf8" }).trim();
  // where this script lies in the repository, as git itself says it (a path worked out from the two folders' names can
  // differ in spelling, as a short name of Windows' does from the long one git gives)
  const self = execFileSync("git", ["rev-parse", "--show-prefix"], { cwd: here, encoding: "utf8" }).trim();
  const specs = opts.specs.length ? opts.specs : opts.repo || self.startsWith("core/") ? [".", ":!core/"] : ["."];
  const listed = execFileSync("git", ["ls-files", "-z", "--", ...specs], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
  const texts = {}, other = {};
  for (const f of listed) {
    const ext = path.posix.extname(f);
    if (CODE.includes(ext) || path.posix.basename(f) === "package.json") { // never through a link, which may lead outside
      try { if (!fs.lstatSync(path.join(root, f)).isSymbolicLink()) texts[f] = fs.readFileSync(path.join(root, f), "utf8"); } catch { /* listed, not on disk */ }
    }
    else if (OTHER.includes(ext)) other[ext] = (other[ext] ?? 0) + 1;
  }
  const log = execFileSync("git", ["log", "--no-merges", "-n", String(opts.history), "--format=%x00", "--name-only", "--", ...specs], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
  const commits = log.split("\0").slice(1).map(c => c.split("\n").map(s => s.trim()).filter(Boolean));
  const suites = opts.suites.map(command => {
    const start = process.hrtime.bigint();
    const r = spawnSync(command, { cwd: root, shell: true, stdio: "ignore" });
    return { command, seconds: Math.round(Number(process.hrtime.bigint() - start) / 1e8) / 10, passed: r.status === 0 };
  });
  const m = measure(texts, { depth: opts.depth, commits, suites, other });
  if (opts.json) fs.writeFileSync(opts.json, JSON.stringify(m, null, 2) + "\n");
  print(m);
}

function print(m) {
  const say = s => console.log(s);
  say(`files: ${m.files.code} read${Object.keys(m.files.other).length ? `; left to the project's own tools: ${Object.entries(m.files.other).map(([e, n]) => `${n} ${e}`).join(", ")}` : ""}`);
  say(`imports: ${m.imports.total}, ${m.imports.crossingAFolder} crossing a folder; folders that import each other both ways: ${m.imports.foldersBothWays.length}`);
  for (const b of m.imports.foldersBothWays.slice(0, 5)) say(`  ${b.folders[0]} <-> ${b.folders[1]} (${b.imports[0]} and ${b.imports[1]})`);
  say(`cycles: ${m.cycles.files.length} between files, ${m.cycles.folders.length} between folders; ${m.cycles.filesWithTypes.length} between files where imports of types alone count too`);
  for (const c of m.cycles.files.slice(0, 5)) say(`  ${c.length} files: ${c.slice(0, 4).join(", ")}${c.length > 4 ? ", ..." : ""}`);
  say(`hubs (imported by most): ${m.hubs.slice(0, 5).map(h => `${h.file} (${h.importedBy})`).join(", ") || "none"}`);
  say(`files with no import: ${m.globals.scripts}, declaring ${m.globals.names} global names, ${m.globals.inMoreThanOne.length} of them in more than one file`);
  const f = m.functions;
  say(`functions: ${f.count}; lines median ${f.lines.median}, 90th percentile ${f.lines.p90}, longest ${f.lines.max}; over 50 lines ${f.over50Lines}, over 100 ${f.over100Lines}; nesting 4 deep or more ${f.depth4OrMore}`);
  for (const x of f.longest.slice(0, 5)) say(`  ${x.file}:${x.line} ${x.name}, ${x.lines} lines, ${x.depth} deep`);
  const t = m.changedTogether;
  say(`changed together (${t.commits} commits): ${t.pairs.slice(0, 5).map(p => `${p.files.join(" + ")} ${p.together}x`).join("; ") || "no pair 3 times"}`);
  for (const s of m.suites) say(`suite: ${s.command}: ${s.seconds} s, ${s.passed ? "passed" : "FAILED"}`);
}

function whole(v, name) { if (!/^[0-9]+$/.test(v)) fail(`${name} takes a whole number`); return Number(v); }
function fail(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }

if (started(import.meta.url)) main(process.argv.slice(2));
