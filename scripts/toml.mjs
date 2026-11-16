// A reader of TOML (toml.io, version 1.0) for what the core's checks read in a project's own files, Codex's
// `.codex/config.toml` first (agent-tools.mjs): tables, arrays of tables, dotted and quoted keys, every kind of string,
// arrays and inline tables, each read as JSON would hold it: true and false as booleans, a whole number JavaScript holds
// exactly as a number, and any other number or a date as the text it is written as, which no check here reads. Text it cannot read as TOML,
// a key given twice included, is refused, as the tool that reads the file refuses it, and so is a value nested deeper
// than guards.mjs's DEEPEST, so that what reads it after never runs out of stack. Node's own modules only.
//
//   import { parseToml } from "./toml.mjs";   parseToml(text) -> an object, or throws a SyntaxError naming the line, or,
//                                             where the whole nests too deep, saying so of the file
import { DEEPEST, tooDeep } from "./guards.mjs";

const BARE = /[A-Za-z0-9_-]/u;
const ESCAPES = { b: "\b", t: "\t", n: "\n", f: "\f", r: "\r", '"': '"', "\\": "\\" };
const SCALAR = /^(?:true|false|[+-]?(?:inf|nan)|[0-9+\-][0-9A-Za-z_:.+-]*(?: [0-9][0-9:.+Z-]*)?)/u;

// (a key set as a plain property, never through a setter, and read only where it is the table's own, never through its
// prototype: "__proto__" is a key like any other)
const put = (table, key, value) => Object.defineProperty(table, key, { value, enumerable: true, writable: true, configurable: true });
const own = (table, key) => (Object.hasOwn(table, key) ? table[key] : undefined);
const isTable = v => v !== null && typeof v === "object" && !Array.isArray(v);

export function parseToml(text) {
  const s = String(text).replace(/\r\n/gu, "\n");
  let i = 0;
  const line = () => s.slice(0, i).split("\n").length;
  const fail = what => { throw new SyntaxError(`line ${line()}: ${what}`); };
  const blank = (newlines = false) => {
    for (;;) {
      if (s[i] === " " || s[i] === "\t" || (newlines && s[i] === "\n")) i++;
      else if (s[i] === "#") { while (i < s.length && s[i] !== "\n") i++; }
      else return;
    }
  };
  const ctx = { s, at: () => i, move: n => { i = n; }, fail, blank };
  const root = {}, defined = new Set([root]);
  let current = root;
  for (blank(true); i < s.length; blank(true)) {
    if (s[i] === "[") current = header(ctx, root, defined);
    else assign(ctx, current, 0);
    blank();
    if (i < s.length && s[i] !== "\n") fail("more follows a key's value or a table's name on its line");
  }
  // (a header's names, the arrays of tables on its way and a dotted key below it each nest a level: the whole is counted
  // once read, as guards.mjs counts JSON)
  if (tooDeep(root)) throw new SyntaxError(`the file nests deeper than ${DEEPEST} tables and arrays`);
  return root;
}

// A key: its parts, bare or quoted, joined by dots.
function readKey(ctx) {
  const parts = [];
  for (;;) {
    ctx.blank();
    const c = ctx.s[ctx.at()];
    if (c === '"' || c === "'") { if (ctx.s.startsWith(c.repeat(3), ctx.at())) ctx.fail("a key cannot be a string of several lines"); parts.push(readString(ctx)); }
    else {
      const from = ctx.at();
      let to = from;
      while (to < ctx.s.length && BARE.test(ctx.s[to])) to++;
      if (to === from) ctx.fail("a key is missing");
      parts.push(ctx.s.slice(from, to));
      ctx.move(to);
    }
    ctx.blank();
    if (ctx.s[ctx.at()] !== ".") return parts;
    ctx.move(ctx.at() + 1);
  }
}

// `[a.b]` or `[[a.b]]`: the table the lines below it fill.
function header(ctx, root, defined) {
  const many = ctx.s.startsWith("[[", ctx.at());
  ctx.move(ctx.at() + (many ? 2 : 1));
  const parts = readKey(ctx), close = many ? "]]" : "]";
  if (!ctx.s.startsWith(close, ctx.at())) ctx.fail(`a table's name is not closed by ${close}`);
  ctx.move(ctx.at() + close.length);
  if (parts.length > DEEPEST) ctx.fail(`a table nests deeper than ${DEEPEST}`);
  let table = root;
  for (const part of parts.slice(0, -1)) table = into(ctx, table, part);
  const last = parts[parts.length - 1], there = own(table, last);
  if (many) {
    if (there !== undefined && !(Array.isArray(there) && there.every(isTable))) ctx.fail(`${JSON.stringify(last)} is given as a value and as an array of tables`);
    const made = {};
    if (there === undefined) put(table, last, [made]); else there.push(made);
    defined.add(made);
    return made;
  }
  if (there !== undefined && (!isTable(there) || defined.has(there))) ctx.fail(`the table ${JSON.stringify(parts.join("."))} is given twice`);
  const made = there ?? put(table, last, {})[last];
  defined.add(made);
  return made;
}

// The table under `part` of `table`, made where it is missing; in an array of tables, its last.
function into(ctx, table, part) {
  const there = own(table, part);
  if (there === undefined) return put(table, part, {})[part];
  if (Array.isArray(there) && there.length && isTable(there[there.length - 1])) return there[there.length - 1];
  if (!isTable(there)) ctx.fail(`${JSON.stringify(part)} is given as a value and as a table`);
  return there;
}

// `key = value`, into `table`.
function assign(ctx, table, depth) {
  const parts = readKey(ctx);
  if (ctx.s[ctx.at()] !== "=") ctx.fail("a key is not followed by =");
  ctx.move(ctx.at() + 1);
  ctx.blank();
  let at = table;
  for (const part of parts.slice(0, -1)) at = into(ctx, at, part);
  const last = parts[parts.length - 1];
  if (Object.hasOwn(at, last)) ctx.fail(`the key ${JSON.stringify(parts.join("."))} is given twice`);
  put(at, last, readValue(ctx, depth + parts.length));
}

function readValue(ctx, depth) {
  if (depth > DEEPEST) ctx.fail(`a value nests deeper than ${DEEPEST}`);
  const c = ctx.s[ctx.at()];
  if (c === '"' || c === "'") return readString(ctx);
  if (c === "[") return readArray(ctx, depth);
  if (c === "{") return readInline(ctx, depth);
  const m = SCALAR.exec(ctx.s.slice(ctx.at(), ctx.at() + 64));
  if (!m) ctx.fail("a value is missing or not one TOML reads");
  ctx.move(ctx.at() + m[0].length);
  if (/^[+-]?(?:0|[1-9][0-9]*)$/u.test(m[0]) && Number.isSafeInteger(Number(m[0]))) return Number(m[0]);
  return m[0] === "true" ? true : m[0] === "false" ? false : m[0];
}

function readArray(ctx, depth) {
  const out = [];
  ctx.move(ctx.at() + 1);
  for (;;) {
    ctx.blank(true);
    if (ctx.s[ctx.at()] === "]") { ctx.move(ctx.at() + 1); return out; }
    out.push(readValue(ctx, depth + 1));
    ctx.blank(true);
    if (ctx.s[ctx.at()] === ",") ctx.move(ctx.at() + 1);
    else if (ctx.s[ctx.at()] !== "]") ctx.fail("an array's values are not parted by commas or closed by ]");
  }
}

function readInline(ctx, depth) {
  const out = {};
  ctx.move(ctx.at() + 1);
  ctx.blank();
  if (ctx.s[ctx.at()] === "}") { ctx.move(ctx.at() + 1); return out; }
  for (;;) {
    assign(ctx, out, depth + 1);
    ctx.blank();
    const c = ctx.s[ctx.at()];
    ctx.move(ctx.at() + 1);
    if (c === "}") return out;
    if (c !== ",") ctx.fail("an inline table's keys are not parted by commas or closed by } on its line");
  }
}

// A string of any of the four kinds, its escapes read.
function readString(ctx) {
  const { s } = ctx, q = s[ctx.at()], many = s.startsWith(q.repeat(3), ctx.at());
  let i = ctx.at() + (many ? 3 : 1);
  if (many && s[i] === "\n") i++;
  let out = "";
  for (;;) {
    if (i >= s.length || (!many && s[i] === "\n")) { ctx.move(i); ctx.fail("a string is not closed"); }
    if (many ? s.startsWith(q.repeat(3), i) : s[i] === q) break;
    if (q === "'" || s[i] !== "\\") { out += s[i++]; continue; }
    const [text, next] = escaped(ctx, s, i, many);
    out += text;
    i = next;
  }
  // (a string of several lines may end in one or two of its quotes before its closing three)
  let end = i + (many ? 3 : 1);
  while (many && s[end] === q && end - i < 5) { out += q; end++; }
  ctx.move(end);
  return out;
}

// The escape at `i` of a basic string: [its text, where reading goes on].
function escaped(ctx, s, i, many) {
  const c = s[i + 1];
  if (Object.hasOwn(ESCAPES, c)) return [ESCAPES[c], i + 2];
  if (c === "u" || c === "U") {
    const n = c === "u" ? 4 : 8, hex = s.slice(i + 2, i + 2 + n);
    const code = /^[0-9A-Fa-f]+$/u.test(hex) && hex.length === n ? Number.parseInt(hex, 16) : -1;
    if (code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) { ctx.move(i); ctx.fail("a \\u or \\U escape names no character"); }
    return [String.fromCodePoint(code), i + 2 + n];
  }
  // (in a string of several lines, a backslash at a line's end joins the next line, its leading blanks dropped)
  const rest = /^[ \t]*\n[ \t\n]*/u.exec(s.slice(i + 1));
  if (many && rest) return ["", i + 1 + rest[0].length];
  ctx.move(i);
  return ctx.fail("a backslash starts no escape TOML reads");
}
