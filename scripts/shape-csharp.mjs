// The shape check's reader of C# (shape.mjs and shape-readers.mjs, beside this file; #354). Its lexer knows comments,
// preprocessor lines, strings (verbatim, raw, and interpolated ones, whose code in { } it reads as code) and characters,
// so a brace in one of them is not counted, and reads what a file declares and takes, and the clock it reads; its
// functions are read on the parser the core installs (csharp-functions.mjs, which holds their definition; #529). It
// never runs the code. Node's own modules, and the parser's installed packages.
//
// What a file takes from another is read from its using directives alone: `using N;` takes every file that declares the
// namespace N; `using static N.T;` and an alias, the files that declare the type T in N. What a file sees by its own
// namespace, and a name written out in full, it takes without a directive, and the reader does not read.
import path from "node:path";
import { NEST, append, commentLines, holdsUnder, isId, isP, nameTree } from "./code-shape.mjs";
import { csharpFunctions } from "./csharp-functions.mjs";
import { unreachedFor } from "./parser.mjs";

// The clock and randomness a system of rules may not take for itself (shape.mjs, "clock"): each a run of tokens.
export const OWN = [
  ...[["DateTime", "Now"], ["DateTime", "UtcNow"], ["DateTime", "Today"], ["DateTimeOffset", "Now"], ["DateTimeOffset", "UtcNow"],
    ["Environment", "TickCount"], ["Environment", "TickCount64"], ["Stopwatch", "GetTimestamp"], ["Stopwatch", "StartNew"],
    ["Random", "Shared"], ["Guid", "NewGuid"], ["TimeProvider", "System"], ["RandomNumberGenerator", "GetBytes"], ["RandomNumberGenerator", "GetInt32"]]
    .map(([a, b]) => ({ run: [a, ".", b], what: `${a}.${b}` })),
  { run: ["new", "Random", "("], what: "new Random(" },
];

// The tokens of a file's text: { t: "id" | "num" | "str" | "punct", v, line, gap }, gap whether white space or a
// comment stands before it.
export function csTokens(src) {
  const lex = new Lexer(src);
  lex.code(false);
  lex.out.lost = lex.lost;
  lex.out.comments = lex.comments;
  lex.out.directives = lex.directives;
  return lex.out;
}

class Lexer {
  // (fresh: nothing but white space stands before i on its line, where a # opens a preprocessor line)
  constructor(src) { Object.assign(this, { src, n: src.length, i: 0, line: 1, out: [], gap: true, fresh: true, nest: 0, lost: false, directives: [], comments: [] }); }

  push(t, v, l = this.line) { this.out.push({ t, v, line: l, gap: this.gap }); this.gap = false; this.fresh = false; }
  lines(a, b) { for (let k = a; k < b; k++) if (this.src[k] === "\n") this.line++; }

  // The code up to the end, or, `hole`, up to the } that ends an interpolated string's { (its format after a : or ,
  // passed over).
  code(hole) {
    let depth = 0;
    while (this.i < this.n) {
      const c = this.src[this.i];
      if (this.blank(c) || this.literal(c)) continue;
      if (hole && depth === 0 && (c === "}" || c === ":" || c === ",")) { this.format(); return; }
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) depth--;
      if (this.src.startsWith("=>", this.i)) { this.push("punct", "=>"); this.i += 2; } else { this.push("punct", c); this.i++; }
    }
  }

  blank(c) {
    const { src, i, n } = this;
    if (c === "\n") { this.line++; this.i++; this.fresh = true; return (this.gap = true); }
    if (/\s/u.test(c) || c === "﻿") { this.i++; return (this.gap = true); }
    const preprocessor = c === "#" && this.fresh;
    if (preprocessor) this.directives.push(this.line);
    if (preprocessor || (c === "/" && src[i + 1] === "/")) {
      while (this.i < n && src[this.i] !== "\n") this.i++;
      if (!preprocessor) commentLines(this.comments, src, i + 2, this.i, this.line);
      return (this.gap = true);
    }
    if (c !== "/" || src[i + 1] !== "*") return false;
    const e = src.indexOf("*/", i + 2), end = e < 0 ? n : e + 2;
    commentLines(this.comments, src, i + 2, e < 0 ? n : e, this.line);
    this.lines(i, end);
    this.i = end;
    return (this.gap = true);
  }

  literal(c) {
    const prefix = /^[$@]*/u.exec(this.src.slice(this.i, this.i + 8))[0];
    if (this.src[this.i + prefix.length] === '"') { this.string(prefix); return true; }
    if (c === "'") { this.char(); return true; }
    if (/[A-Za-z_@\u0080-￿]/u.test(c)) { this.word(/[\w\u0080-￿]/u, "id"); return true; }
    if (/[0-9]/u.test(c) || (c === "." && /[0-9]/u.test(this.src[this.i + 1] ?? ""))) { this.word(/[\w.]/u, "num"); return true; }
    return false;
  }

  word(rest, t) {
    let j = this.i + 1;
    while (j < this.n && rest.test(this.src[j])) j++;
    this.push(t, this.src.slice(this.i, j).replace(/^@/u, ""));
    this.i = j;
  }

  char() {
    let j = this.i + 1;
    while (j < this.n && this.src[j] !== "'" && this.src[j] !== "\n") j += this.src[j] === "\\" ? 2 : 1;
    this.push("str", this.src.slice(this.i + 1, j));
    this.i = j + 1;
  }

  // A string from its prefix ($ and @) and quote: one "str" token, the code of an interpolated one's { } read after it.
  string(prefix) {
    this.push("str", "");
    this.i += prefix.length;
    const quotes = /^"*/u.exec(this.src.slice(this.i, this.i + 64))[0].length;
    if (quotes >= 3) { this.raw(quotes); return; }
    this.i++;
    const verbatim = prefix.includes("@"), holes = prefix.includes("$");
    while (this.i < this.n && this.inString(this.src[this.i], verbatim, holes));
    if (this.src[this.i] === '"') this.i++;
  }

  // One step through a string's text: false at its end. {{ and }} are braces of its text; a { opens its code.
  inString(c, verbatim, holes) {
    const next = this.src[this.i + 1];
    if (c === '"' && verbatim && next === '"') { this.i += 2; return true; }
    if (c === '"' || (c === "\n" && !verbatim)) return false;
    if (c === "\\" && !verbatim) { this.lines(this.i, this.i + 2); this.i += 2; return true; }
    if (holes && (c === "{" || c === "}")) {
      if (next === c) this.i += 2;
      else if (c === "{") { this.i++; this.hole(); } else this.i++;
      return true;
    }
    if (c === "\n") this.line++;
    this.i++;
    return true;
  }

  // The code of an interpolated string's { }, one level deeper; past NEST, nothing more of the file, which is lost.
  hole() {
    if (this.nest >= NEST) { this.lost = true; this.i = this.n; return; }
    this.nest++;
    this.code(true);
    this.nest--;
  }

  // A raw string ("""), to the same count of quotes: its holes, where it has them, not read.
  raw(quotes) {
    const close = '"'.repeat(quotes), end = this.src.indexOf(close, this.i + quotes), to = end < 0 ? this.n : end + quotes;
    this.lines(this.i, to);
    this.i = to;
    while (this.src[this.i] === '"') this.i++;
  }

  // A hole's alignment or format, after its , or :, up to the } that ends it.
  format() {
    while (this.i < this.n && this.src[this.i] !== "}") { if (this.src[this.i] === "\n") this.line++; this.i++; }
    this.i++;
  }
}

// ---- what a file declares and takes ----

// A dotted name from k: { name, end }, end the index after it.
function dotted(toks, k) {
  const parts = [];
  let j = k;
  for (; toks[j]?.t === "id"; j += 2) { parts.push(toks[j].v); if (!isP(toks[j + 1], ".")) { j++; break; } }
  return { name: parts.join("."), end: j };
}

// A using directive at k: { target, static, alias } where one stands there (`using N;`, `using static N.T;`, `using
// A = N.T;`, global or not), else null: a using statement (`using (x)`, `using var x = y;`) is none. `semi` gives, for
// each token, the index of the next ; (where an alias's type arguments end).
function directive(toks, k, semi) {
  if (!isId(toks[k], "using") || isP(toks[k - 1], ".")) return null;
  const isStatic = isId(toks[k + 1], "static"), from = k + (isStatic ? 2 : 1);
  const alias = toks[from]?.t === "id" && isP(toks[from + 1], "=");
  const d = dotted(toks, alias ? from + 2 : from);
  const end = alias && isP(toks[d.end], "<") ? semi[d.end] : d.end;
  return d.name && isP(toks[end], ";") ? { target: d.name, static: isStatic, alias } : null;
}

// The namespaces a file declares, by where each opens (`namespace N;`, or `namespace N { }`, nested ones joined), and
// the types (class, struct, interface, enum, record) declared in each: { namespaces: [names], types: ["N.T"] }.
function declared(toks) {
  const frames = [], namespaces = new Set(), types = new Set();
  let depth = 0;
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    if (isP(tok, "{")) depth++;
    else if (isP(tok, "}") && --depth < (frames.at(-1)?.depth ?? -1)) frames.pop();
    else if (isId(tok, "namespace") && toks[k + 1]?.t === "id") namespaces.add(opened(toks, k, frames, depth));
    else if (TYPES.has(tok.v) && tok.t === "id") typeAt(toks, k, frames, types);
  }
  return { namespaces: [...namespaces], types: [...types] };
}

const TYPES = new Set(["class", "struct", "interface", "enum", "record"]);
const within = (frames, name) => (frames.length ? `${frames.at(-1).name}.${name}` : name);

// A namespace that opens at k, within the one around it, its frame kept until the brace that closes it (a file-scoped
// one's, never): its full name.
function opened(toks, k, frames, depth) {
  const d = dotted(toks, k + 1), name = within(frames, d.name);
  frames.push({ name, depth: isP(toks[d.end], "{") ? depth + 1 : 0 });
  return name;
}

// A type declared at k (record class and record struct as one), by its full name.
function typeAt(toks, k, frames, types) {
  const at = isId(toks[k + 1], "class") || isId(toks[k + 1], "struct") ? k + 2 : k + 1;
  if (toks[at]?.t === "id" && toks[at].v !== "where") types.add(within(frames, toks[at].v));
}

// A file read: { functions (null where its code nests past NEST; none where the parser could not be installed, the
// registry not answering in a project's pull request, which the shape check says: shape-readers.mjs, unreachedReaders), usings: [{ target, static, alias }], namespaces, types, toks,
// comments: [{ line, text }] }.
export function readCsharp(src) {
  const toks = csTokens(src);
  const semi = new Array(toks.length + 1).fill(toks.length);
  for (let k = toks.length - 1; k >= 0; k--) semi[k] = isP(toks[k], ";") ? k : semi[k + 1];
  const usings = toks.map((_, k) => directive(toks, k, semi)).filter(Boolean);
  return { functions: toks.lost ? null : unreachedFor("csharp") ? [] : csharpFunctions(src, toks.directives), usings, ...declared(toks), toks, comments: toks.comments };
}

// Where the project's C# declares each namespace and type: { namespaces, types }, each a Map of a name to its files.
export function csharpIndex(readings) {
  const namespaces = new Map(), types = new Map();
  for (const [file, r] of readings) {
    for (const n of r.namespaces) append(namespaces, n, file);
    for (const t of r.types) append(types, t, file);
  }
  return { namespaces, types, under: nameTree(namespaces.keys()) };
}

// Where a using directive leads: { to: [files] } where the project declares what it names, else { outside: its name }.
export function resolveCsharp(u, index) {
  const name = u.target;
  if (!u.static && !u.alias && index.namespaces.has(name)) return { to: index.namespaces.get(name) };
  const found = index.namespaces.get(name) ?? index.types.get(name);
  if (found) return { to: found };
  // (a namespace that only holds the project's own namespaces leads to no file, and nowhere outside either)
  if (holdsUnder(index.under, name)) return { to: [] };
  return { outside: name };
}

// The packages the project's own .csproj files reference: { ships, declared }, each a Set of package ids; one marked
// PrivateAssets="all" (an analyzer, a build tool) is declared and not shipped.
export function csharpPackages(texts) {
  const ships = new Set(), declared = new Set();
  for (const [file, text] of Object.entries(texts)) {
    if (path.posix.extname(file) !== ".csproj") continue;
    // (each reference read up to the next, by indexOf alone, so that no file makes the reading slower than its length)
    for (const part of text.split("<PackageReference").slice(1)) {
      const end = part.indexOf(">"), attributes = end < 0 ? part : part.slice(0, end);
      const body = attributes.endsWith("/") ? "" : part.slice(end + 1, Math.max(0, part.indexOf("</PackageReference>")));
      const id = /\b(?:Include|Update)\s*=\s*"([^"]+)"/u.exec(attributes)?.[1];
      if (!id || !/^\s/u.test(part)) continue;
      declared.add(id);
      if (!/PrivateAssets\s*=\s*"all"/iu.test(attributes) && !/<PrivateAssets>\s*all\s*<\/PrivateAssets>/iu.test(body)) ships.add(id);
    }
  }
  return { ships, declared };
}
