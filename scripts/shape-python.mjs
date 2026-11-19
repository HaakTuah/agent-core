// The shape check's reader of Python (shape.mjs and shape-readers.mjs, beside this file; #354). It reads a file's
// logical lines, as Python joins them inside brackets and after a \ at a line's end, with its strings (an f-string's
// code in its { } read as code); from them, what each file imports, and its tokens, for the runs of the clock. Its
// functions are read on the parser the core installs (python-functions.mjs, which says how each is measured; #530,
// item 6). It never runs the code. Node's own modules, and the parser's installed packages.
//
// An import is read with where it stands: in a def, it runs when the function is called (as a dynamic import does in
// JavaScript), and under `if TYPE_CHECKING:` it takes types alone; neither makes a cycle.
import path from "node:path";
import { COMMENT_READ, NEST } from "./code-shape.mjs";
import { unreachedFor } from "./parser.mjs";
import { pythonFunctions } from "./python-functions.mjs";

// The standard library's modules, which lead to no file of the project and no package: Python 3.13's, with those that
// earlier versions still hold.
export const STDLIB = new Set(`__future__ abc antigravity argparse array ast asyncio atexit base64 bdb binascii bisect
  builtins bz2 cProfile calendar cmath cmd code codecs codeop collections colorsys compileall concurrent configparser
  contextlib contextvars copy copyreg csv ctypes curses dataclasses datetime dbm decimal difflib dis doctest email
  encodings ensurepip enum errno faulthandler fcntl filecmp fileinput fnmatch fractions ftplib functools gc genericpath
  getopt getpass gettext glob graphlib grp gzip hashlib heapq hmac html http idlelib imaplib importlib inspect io
  ipaddress itertools json keyword linecache locale logging lzma mailbox marshal math mimetypes mmap modulefinder msvcrt
  multiprocessing netrc nt ntpath nturl2path numbers opcode operator optparse os pathlib pdb pickle pickletools pkgutil
  platform plistlib poplib posix posixpath pprint profile pstats pty pwd py_compile pyclbr pydoc pydoc_data pyexpat
  queue quopri random re readline reprlib resource rlcompleter runpy sched secrets select selectors shelve shlex shutil
  signal site smtplib socket socketserver sqlite3 sre_compile sre_constants sre_parse ssl stat statistics string
  stringprep struct subprocess symtable sys sysconfig syslog tabnanny tarfile tempfile termios textwrap this threading
  time timeit tkinter token tokenize tomllib trace traceback tracemalloc tty turtle turtledemo types typing
  unicodedata unittest urllib uuid venv warnings wave weakref webbrowser winreg winsound wsgiref xml xmlrpc zipapp
  zipfile zipimport zlib zoneinfo aifc asynchat asyncore audioop cgi cgitb chunk crypt distutils imghdr imp lib2to3
  mailcap nis nntplib ossaudiodev pipes smtpd sndhdr spwd sunau telnetlib uu xdrlib`.split(/\s+/u));

// The clock and randomness a system of rules may not take for itself (shape.mjs, "clock"): each a run of tokens, a
// run that ends in "." taking any name after it.
export const OWN = [
  ...["time", "time_ns", "monotonic", "monotonic_ns", "perf_counter", "perf_counter_ns"].map(n => ({ run: ["time", ".", n], what: `time.${n}` })),
  ...["now", "utcnow", "today"].flatMap(n => [{ run: ["datetime", ".", n], what: `datetime.${n}` }, { run: ["datetime", ".", "datetime", ".", n], what: `datetime.datetime.${n}` }]),
  { run: ["date", ".", "today"], what: "date.today" }, { run: ["datetime", ".", "date", ".", "today"], what: "datetime.date.today" },
  { run: ["random", "."], what: "random." }, { run: ["secrets", "."], what: "secrets." },
  { run: ["from", "random", "import"], what: "from random import" }, { run: ["from", "secrets", "import"], what: "from secrets import" },
  { run: ["uuid", ".", "uuid1"], what: "uuid.uuid1" }, { run: ["uuid", ".", "uuid4"], what: "uuid.uuid4" },
  { run: ["os", ".", "urandom"], what: "os.urandom" },
];

const OPENS = "([{", CLOSES = ")]}";
const PREFIX = /^[rRbBuUfF]{1,2}$/u;

// The logical lines of a file's text: [{ indent, line, end, toks }], toks being { t: "id" | "num" | "str" | "punct",
// v, line }; comments and blank lines dropped.
export function logicalLines(src) {
  const lex = new Lexer(src);
  lex.code(false);
  lex.close();
  lex.lines.lost = lex.lost;
  lex.lines.comments = lex.comments;
  return lex.lines;
}

class Lexer {
  constructor(src) { Object.assign(this, { src, n: src.length, i: 0, line: 1, depth: 0, indent: 0, start: true, current: null, lines: [], nest: 0, lost: false, comments: [] }); }

  push(t, v, l = this.line) {
    if (!this.current) this.current = { indent: this.indent, line: l, end: l, toks: [] };
    this.current.toks.push({ t, v, line: l });
  }

  close() {
    if (this.current) { this.current.end = this.line; this.lines.push(this.current); }
    this.current = null;
  }

  // The code up to the end, or, `hole`, up to the } that closes an f-string's { (its format after a ! or : passed over).
  code(hole) {
    let depth = 0;
    while (this.i < this.n) {
      const c = this.src[this.i];
      if (this.start) this.margin();
      else if (this.blank(c) || this.literal(c)) continue;
      else if (hole && depth === 0 && (c === "}" || c === ":" || (c === "!" && this.src[this.i + 1] !== "="))) { this.format(); return; }
      else depth += this.sign(c);
    }
  }

  // A physical line's indentation, a tab reaching the next multiple of 8.
  margin() {
    let col = 0;
    for (; this.i < this.n && (this.src[this.i] === " " || this.src[this.i] === "\t"); this.i++) col = this.src[this.i] === "\t" ? (Math.floor(col / 8) + 1) * 8 : col + 1;
    if (this.depth === 0 && !this.current) this.indent = col;
    this.start = false;
  }

  blank(c) {
    if (c === "\n") {
      if (this.depth === 0) this.close();
      this.line++; this.i++; this.start = true;
      return true;
    }
    if (c === "\\" && this.src[this.i + 1] === "\n") { this.line++; this.i += 2; return true; } // (the line goes on)
    if (c === "\\" && this.src.startsWith("\r\n", this.i + 1)) { this.line++; this.i += 3; return true; }
    if (c === " " || c === "\t" || c === "\r" || c === "\f" || c === "﻿") { this.i++; return true; }
    if (c !== "#") return false;
    const from = this.i + 1;
    while (this.i < this.n && this.src[this.i] !== "\n") this.i++;
    this.comments.push({ line: this.line, text: this.src.slice(from, Math.min(this.i, from + COMMENT_READ)) });
    return true;
  }

  literal(c) {
    if (c === "'" || c === '"') { this.string(""); return true; }
    if (/[A-Za-z_\u0080-￿]/u.test(c)) { this.word(); return true; }
    if (/[0-9]/u.test(c) || (c === "." && /[0-9]/u.test(this.src[this.i + 1] ?? ""))) {
      let j = this.i + 1;
      while (j < this.n && /[0-9A-Za-z_.]/u.test(this.src[j])) j++;
      this.push("num", this.src.slice(this.i, j));
      this.i = j;
      return true;
    }
    return false;
  }

  // A name, or a string's prefix (f"", rb'') where a quote follows it.
  word() {
    let j = this.i + 1;
    while (j < this.n && /[\w\u0080-￿]/u.test(this.src[j])) j++;
    const w = this.src.slice(this.i, j);
    this.i = j;
    if (PREFIX.test(w) && (this.src[j] === "'" || this.src[j] === '"')) this.string(w.toLowerCase());
    else this.push("id", w);
  }

  // A string from its quote, its prefix given: one "str" token, the code of an f-string's { } read after it.
  string(prefix) {
    const q = this.src[this.i], triple = this.src.startsWith(q.repeat(3), this.i), close = triple ? q.repeat(3) : q;
    const from = this.line;
    this.push("str", "", from);
    this.i += close.length;
    this.depth++; // (a line inside the string, or inside its code, ends no logical line)
    while (this.i < this.n && !this.src.startsWith(close, this.i)) {
      const c = this.src[this.i];
      if (c === "\n" && !triple) break;
      if (c === "\\") { if (this.src[this.i + 1] === "\n") this.line++; this.i += 2; continue; }
      if (prefix.includes("f") && c === "{") { this.hole(); continue; }
      if (c === "\n") this.line++;
      this.i++;
    }
    this.depth--;
    if (this.src.startsWith(close, this.i)) this.i += close.length;
  }

  // A { in an f-string: {{ a brace of its text, else the code up to its }.
  hole() {
    if (this.src[this.i + 1] === "{") { this.i += 2; return; }
    this.i++;
    if (this.nest >= NEST) { this.lost = true; this.i = this.n; return; } // (past it, the file is lost)
    this.nest++;
    this.code(true);
    this.nest--;
  }

  // An f-string's format, after its ! or :, to the } that ends its { (a { } inside it passed over): nothing to read.
  format() {
    for (let depth = 0; this.i < this.n; this.i++) {
      const c = this.src[this.i];
      if (c === "\n") this.line++;
      if (c === "{") depth++;
      else if (c === "}" && depth-- === 0) { this.i++; return; }
    }
  }

  // A sign, its own token (:= one, so that it opens no block); how far it moves the brackets' depth.
  sign(c) {
    if (this.src.startsWith(":=", this.i)) { this.push("punct", ":="); this.i += 2; return 0; }
    this.push("punct", c);
    this.i++;
    const moves = OPENS.includes(c) ? 1 : CLOSES.includes(c) ? -1 : 0;
    this.depth = Math.max(0, this.depth + moves);
    return moves;
  }
}

const isId = (tok, v) => tok?.t === "id" && tok.v === v;
const isP = (tok, v) => tok?.t === "punct" && tok.v === v;
// (the words that open a block, beside def, class and match)
const CONTROL = new Set(["if", "elif", "else", "for", "while", "try", "except", "finally", "with", "case"]);

// Where a compound statement's header ends: the index of its first : outside brackets; -1 where it has none.
function headerColon(toks) {
  let depth = 0;
  for (let k = 0; k < toks.length; k++) {
    if (toks[k].t !== "punct") continue;
    const v = toks[k].v;
    if (OPENS.includes(v)) depth++;
    else if (CLOSES.includes(v)) depth--;
    else if (v === ":" && depth === 0) return k;
  }
  return -1;
}

// The statement a logical line opens: { word, at, colon }, word the keyword that opens a block (def, class, a control
// word, match), at its index (an async passed over), colon where its header ends; word null where it opens none.
function statement(toks) {
  const at = isId(toks[0], "async") ? 1 : 0, word = toks[at]?.t === "id" ? toks[at].v : null;
  const colon = headerColon(toks), soft = word === "match" || word === "case";
  const opens = colon > at && (word === "def" || word === "class" || CONTROL.has(word) || word === "match")
    && !(soft && toks[at + 1]?.t === "punct" && ["=", ".", ",", ")", ":"].includes(toks[at + 1].v));
  return { word: opens ? word : null, at, colon };
}

// What a logical line imports: [{ level, module, names, line }], level the count of its leading dots.
function importsOf(toks) {
  if (isId(toks[0], "import")) {
    return split(toks.slice(1)).map(part => ({ level: 0, module: dotted(part), names: [], line: toks[0].line })).filter(i => i.module);
  }
  if (!isId(toks[0], "from")) return [];
  let k = 1, level = 0;
  for (; isP(toks[k], "."); k++) level++;
  const at = toks.findIndex(t => isId(t, "import"));
  if (at < 0) return [];
  const names = split(toks.slice(at + 1).filter(t => !isP(t, "(") && !isP(t, ")"))).map(part => (isP(part[0], "*") ? "*" : part[0]?.v)).filter(Boolean);
  return [{ level, module: dotted(toks.slice(k, at)), names, line: toks[0].line }];
}
const split = toks => toks.reduce((parts, t) => (isP(t, ",") ? parts.push([]) : parts.at(-1).push(t), parts), [[]]);
// (a dotted name, up to its `as`)
const dotted = toks => { const end = toks.findIndex(t => isId(t, "as")); return (end < 0 ? toks : toks.slice(0, end)).filter(t => t.t === "id").map(t => t.v).join("."); };

// A file read: { functions: [{ name, line, lines, depth, branches }] (null where its code nests past NEST or the parser
// cannot read it whole; none where the parser could not be installed), imports: [{ level, module, names, line, dynamic,
// types }], toks }.
export function readPython(src) {
  const lines = logicalLines(src), stack = [], imports = [];
  for (const ln of lines) {
    while (stack.length && stack.at(-1).indent >= ln.indent) stack.pop();
    const st = statement(ln.toks);
    const dynamic = st.word === "def" || stack.some(s => s.def), types = stack.some(s => s.types) || (st.word === "if" && isTypeChecking(ln.toks.slice(0, st.colon + 1)));
    for (const part of statements(ln.toks, st)) for (const imp of importsOf(part)) imports.push({ ...imp, dynamic, types });
    if (st.word) stack.push({ indent: ln.indent, def: st.word === "def", types: st.word === "if" && isTypeChecking(ln.toks) });
  }
  return { functions: lines.lost ? null : unreachedFor("python") ? [] : pythonFunctions(src), imports, toks: lines.flatMap(l => l.toks), comments: lines.comments };
}

// A logical line's simple statements: those after `;`, and of a compound statement those after its header's colon
// (`if x: import y`).
function statements(toks, st) {
  const body = st.word ? toks.slice(st.colon + 1) : toks;
  return body.reduce((parts, t) => (isP(t, ";") ? parts.push([]) : parts.at(-1).push(t), parts), [[]]);
}

const isTypeChecking = toks => /^if (typing \. )?TYPE_CHECKING :$/u.test(toks.map(t => t.v).join(" "));

// ---- where an import leads ----

// Where a module's dotted path leads among the project's files: `<path>.py` or `<path>/__init__.py`, under the
// project's root, the importing file's folder or src/; null where none.
const ROOTS = from => ["", `${path.posix.dirname(from)}/`.replace(/^\.\//u, ""), "src/"];
function moduleAt(parts, from, files) {
  const p = parts.join("/");
  for (const root of ROOTS(from)) {
    const found = [`${root}${p}.py`, `${root}${p}/__init__.py`].find(f => files.has(f));
    if (found) return found;
  }
  return null;
}

const DEEP = new WeakMap();
const deepest = files => {
  if (!DEEP.has(files)) { let most = 0; for (const f of files) most = Math.max(most, f.split("/").length); DEEP.set(files, most + 1); }
  return DEEP.get(files);
};
// Of a module none of those roots holds, the one file whose path ends in it; null where none does, or more than one;
// each module's answer made once for each set of files.
const ENDS = new WeakMap();
function bySuffix(parts, files) {
  const p = parts.join("/"), key = `${parts.at(-1).length}:${p}`;
  if (!ENDS.has(files)) ENDS.set(files, new Map());
  const known = ENDS.get(files);
  if (known.has(key)) return known.get(key);
  // (a module of more parts is answered from the folders' index, a plain name being read there as it is here)
  if (parts.length > 1 && plain(parts.at(-1))) {
    known.set(key, one(endingIn(files, parts.slice(0, -1).join("/").split("/")), parts.at(-1)));
    return known.get(key);
  }
  const ends = [`${p}.py`, `${p}/__init__.py`];
  let count = 0, file = null;
  for (const e of ends) {
    let node = suffixTree(files, path.posix.basename(e) === "__init__.py" ? `${parts.at(-1)}/__init__.py` : path.posix.basename(e));
    const segs = e.split("/");
    for (let k = segs.length - 1; k >= 0 && node; k--) node = node.get(segs[k]);
    if (node) { count += node.count; file = node.file; }
  }
  known.set(key, count === 1 ? file : null);
  return known.get(key);
}

// The files byName holds under one name, by their path read from its end: each node the count of files under it and
// one of them; made once for each name and set of files.
const SUFFIXES = new WeakMap();
function suffixTree(files, name) {
  if (!SUFFIXES.has(files)) SUFFIXES.set(files, new Map());
  const trees = SUFFIXES.get(files);
  if (!trees.has(name)) {
    const root = new Map();
    for (const f of byName(files).get(name) ?? []) {
      const segs = f.split("/");
      let node = root;
      for (let k = segs.length - 1; k >= 0; k--) {
        if (!node.has(segs[k])) node.set(segs[k], Object.assign(new Map(), { count: 0, file: f }));
        node = node.get(segs[k]);
        node.count++;
      }
    }
    trees.set(name, root);
  }
  return trees.get(name);
}

// The project's Python files by their name (a package's __init__.py by its folder's: "pkg/__init__.py"), made once
// for each set of files.
const NAMED = new WeakMap();
function byName(files) {
  if (NAMED.has(files)) return NAMED.get(files);
  const named = new Map();
  for (const f of files) {
    if (!f.endsWith(".py")) continue;
    const name = path.posix.basename(f) === "__init__.py" ? `${path.posix.basename(path.posix.dirname(f))}/__init__.py` : path.posix.basename(f);
    if (!named.has(name)) named.set(name, []);
    named.get(name).push(f);
  }
  NAMED.set(files, named);
  return named;
}

// The names an import takes from a module, each read against the module's folder once the folder is found, so a name
// costs its own length alone: { "<name>.py": file } and { "<name>/__init__.py": file } of each folder, the folders
// also by their path read from its end, for a module found by the end of its path. A name that holds a "/", or a module
// named __init__, is read as a whole path instead; made once for each set of files.
const TOP = "\0";
const MANY = Symbol("more than one");
const FOLDERS = new WeakMap();
function folders(files) {
  if (FOLDERS.has(files)) return FOLDERS.get(files);
  const held = new Map(), ends = new Map();
  const add = (dir, name, f) => { if (!held.has(dir)) held.set(dir, new Map()); held.get(dir).set(name, f); };
  for (const f of files) {
    if (!f.endsWith(".py")) continue;
    const i = f.lastIndexOf("/"), dir = i < 0 ? TOP : f.slice(0, i), name = f.slice(i + 1);
    if (name !== "__init__.py") add(dir, name, f);
    else if (i >= 0) { const j = dir.lastIndexOf("/"); add(j < 0 ? TOP : dir.slice(0, j), `${dir.slice(j + 1)}/__init__.py`, f); }
  }
  for (const [dir, names] of held) {
    if (dir === TOP) continue;
    const segs = dir.split("/");
    let node = ends;
    for (let k = segs.length - 1; k >= 0; k--) { if (!node.has(segs[k])) node.set(segs[k], new Map()); node = node.get(segs[k]); }
    (node.here ??= []).push(names);
  }
  const out = { held, ends };
  FOLDERS.set(files, out);
  return out;
}
const plain = n => !n.includes("/") && n !== "__init__";
// The files a folder holds by name: the folder named by a path that ends in "/", or by "" for the project's root.
const heldIn = (files, at) => folders(files).held.get(at === "" ? TOP : at.slice(0, -1));
const inFolder = (names, n) => names?.get(`${n}.py`) ?? names?.get(`${n}/__init__.py`) ?? null;
// Every file under a folder whose path ends in the given parts, by name, each name's one file or MANY.
function endingIn(files, parts) {
  let node = folders(files).ends;
  for (let k = parts.length - 1; k >= 0 && node; k--) node = node.get(parts[k]);
  if (!node) return null;
  if (!node.all) {
    const all = new Map(), stack = [node];
    while (stack.length) {
      const at = stack.pop();
      for (const names of at.here ?? []) for (const [n, f] of names) all.set(n, all.has(n) ? MANY : f);
      for (const next of at.values()) stack.push(next);
    }
    node.all = all;
  }
  return node.all;
}
const one = (all, n) => {
  const a = all?.get(`${n}.py`), b = all?.get(`${n}/__init__.py`);
  return (a === undefined) === (b === undefined) || a === MANY || b === MANY ? null : (a ?? b);
};

// A relative import's files: each name that is a module of its own, else the module it names.
function relative(from, imp, files) {
  const up = path.posix.dirname(from).split("/").filter(s => s !== ".");
  const base = [...up.slice(0, up.length - (imp.level - 1)), ...(imp.module ? imp.module.split(".") : [])].join("/");
  const at = p => [`${p}.py`, `${p}/__init__.py`].map(f => f.replace(/^\//u, "")).find(f => files.has(f)) ?? null;
  const names = heldIn(files, `${base}/`.replace(/^\//u, "")), seen = new Map();
  const sub = n => (plain(n) ? inFolder(names, n) : at(`${base}/${n}`));
  const subs = imp.names.filter(n => n !== "*").map(n => { if (!seen.has(n)) seen.set(n, sub(n)); return seen.get(n); });
  const own = subs.length && subs.every(Boolean) ? null : at(base);
  return [...subs.filter(Boolean), ...(own ? [own] : [])];
}

// Where an import leads: { to: [files] } where it is the project's own, else { outside, top }, outside its dotted name.
// `known` says whether a top-level name is the standard library's, a package's the project declares or one the config
// binds to a platform: such a name is never looked for among the project's files by the end of their paths.
export function resolvePython(from, imp, files, known) {
  if (imp.level > 0) return { to: relative(from, imp, files) };
  const parts = imp.module.split("."), most = deepest(files), p = parts.join("/");
  let top;
  const isKnown = () => (top ??= known(parts[0]));
  const find = q => (q.length > most ? null : moduleAt(q, from, files) ?? (isKnown() ? null : bySuffix(q, files)));
  // (a module of more parts than the deepest file's path holds is no file of the project, nor is any name under it)
  const names = imp.names.filter(n => n !== "*"), seen = new Map();
  let roots, all;
  const sub = n => {
    if (!plain(n)) return find([...parts, n]);
    roots ??= ROOTS(from).map(root => heldIn(files, `${root}${p}/`));
    for (const held of roots) { const f = inFolder(held, n); if (f) return f; }
    if (isKnown()) return null;
    all ??= endingIn(files, p.split("/"));
    return one(all, n);
  };
  const subs = parts.length + 1 > most ? [] : names.map(n => { if (!seen.has(n)) seen.set(n, sub(n)); return seen.get(n); });
  const named = subs.filter(Boolean);
  const own = named.length === subs.length && subs.length ? null : find(parts);
  const to = [...named, ...(own ? [own] : [])];
  return to.length ? { to } : { outside: imp.module, top: parts[0] };
}

// ---- the packages a project declares ----

// A package's name as pip compares it.
export const normal = name => name.toLowerCase().replace(/[-_.]+/gu, "-");
const requirement = s => /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/u.exec(s)?.[1] ?? null;

// The packages of a requirements file: each line's name (an option, -r or -e, left out).
function requirements(text) {
  return text.split("\n").map(l => l.replace(/#.*/u, "").trim()).filter(l => l && !l.startsWith("-")).map(requirement).filter(Boolean);
}

// The packages of a pyproject.toml, by its tables: { ships, dev }. Read by its lines: [project]'s dependencies and
// Poetry's dependencies ship; optional ones, dependency groups and Poetry's groups are of development.
function pyproject(text) {
  const out = { ships: [], dev: [] };
  const quoted = s => [...s.matchAll(/["']([^"']+)["']/gu)].map(m => requirement(m[1])).filter(Boolean);
  let table = "", list = null;
  for (const raw of text.split("\n")) {
    const l = raw.replace(/#.*/u, "").trim();
    if (/^\[[^\]]+\]$/u.test(l)) { table = l.slice(1, -1).trim(); list = null; continue; }
    const key = list ? null : /^([\w.-]+)\s*=\s*(.*)$/u.exec(l), kind = key ? tableKind(table, key[1]) : null;
    if (kind === "array") list = table === "project" ? "ships" : "dev";
    else if (kind) out[kind].push(key[1]);
    if (!list) continue;
    out[list].push(...quoted(key ? key[2] : l));
    if ((key ? key[2] : l).replace(/"[^"]*"|'[^']*'/gu, "").includes("]")) list = null; // (requests[socks] is no end)
  }
  return out;
}

// What a key of a table names: "array", a list of requirements; "ships" or "dev", the key a package's own name.
function tableKind(table, key) {
  if ((table === "project" && key === "dependencies") || table === "project.optional-dependencies" || table === "dependency-groups") return "array";
  if (table === "tool.poetry.dependencies") return key === "python" ? null : "ships";
  if (table === "tool.poetry.dev-dependencies" || /^tool\.poetry\.group\.[^.]+\.dependencies$/u.test(table)) return "dev";
  return null;
}

// The packages the project's own requirements files and pyproject.toml files declare: { ships, declared }, each a
// Map of the name pip compares (normal) to the name as declared. A requirements file named for development or tests
// (requirements-dev.txt, test-requirements.txt) declares packages of development alone.
export function pythonPackages(texts) {
  const ships = new Map(), declared = new Map();
  const add = (names, shipped) => { for (const n of names) { declared.set(normal(n), n); if (shipped) ships.set(normal(n), n); } };
  for (const [file, text] of Object.entries(texts)) {
    const base = path.posix.basename(file);
    if (/requirements.*\.txt$/iu.test(base)) add(requirements(text), !/dev|test/iu.test(base));
    else if (base === "pyproject.toml") { const p = pyproject(text); add(p.ships, true); add(p.dev, false); }
  }
  return { ships, declared };
}
