// How floor rule 8's proof that a change to what runs by itself is only comments and steps' names (comment-only.mjs,
// beside this file; floor rule 3) reads a YAML file, line by line (readYaml), for that proof to compare. It reads YAML
// as GitHub's parser does where it reads it at all, and refuses, rather than guess, every line it cannot read for sure:
// a tab, a carriage return or another control character or line break, a byte order mark, a character YAML refuses; a
// value that runs on to the next line (a quoted or plain one, or one in [ ] or { }); a # inside [ ] or { }, or a quote
// there but one around plain words in [ ] (#1313); an anchor, alias, tag, explicit key or document marker. A line
// inside a block scalar (`run: |`) is text, a # line too, and changes nothing only where it is unchanged; the blank
// lines after its last are not, unless it keeps them (`|+`). It loads the lexer of the YAML package the core installs
// from its lock file (packages.mjs; #654), which says where each token of a line and each block scalar's text ends,
// this reader deciding what it reads (#530). Split from the proof (#1341). Node's own modules and that package; it
// changes nothing.
import { loadSync } from "./packages.mjs";

// what YAML 1.1 or 1.2 reads as a line break besides \n, a tab, a byte order mark, every other control character, and
// the two characters YAML refuses in a file (U+FFFE and U+FFFF), which would stop the whole file being read
const UNREAD = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029\ufeff\ufffe\uffff]/u;
const HEADER = /^[|>](?:[1-9][+-]?|[+-][1-9]?)?(?: +(#.*)?)?$/u; // a block scalar's header, with its comment if any
// a quoted value of plain words in [ ] (the starter kit's `update-types: ["minor", "patch"]`, `patterns: ["*"]`)
const WORDS = /^(["'])[A-Za-z0-9 ._/*+-]*\1$/u;
// a plain step's name YAML 1.1 or 1.2 reads as no string
const NOT_TEXT = /^(?:~|null|true|false|yes|no|on|off|y|n)$/iu;

// The text's tokens as the YAML package the core installs reads them (its lexer; #530, #654), each
// { src, at, content }: its text, its offset in the text, and whether it is a block scalar's text, the lines after its
// header, which hold no YAML. The lexer's own marks, which stand for no text, are left out.
function tokensOf(text) {
  const out = [];
  let at = 0, marked = false, header = false;
  const { Lexer } = loadSync("yaml"); // (loaded where it is used: no import of this file needs it)
  for (const src of new Lexer().lex(text)) {
    if (src === "\x02" || src === "\x18") continue; // (a document's start; a [ ] or { } left open, read below)
    if (src === "\x1f") { marked = true; continue; }
    out.push({ src, at, content: marked && header });
    if (marked) header = false;
    else if (src[0] === "|" || src[0] === ">") header = true;
    marked = false;
    at += src.length;
  }
  return out;
}

// The text's lines, each { line, n, last, toks, content, within }: its tokens (each with `col`, its column past the
// line's indentation), whether it is a block scalar's text, and whether it lies within a token that began on a line
// before (a value that runs on, read as such on its first line).
function linesOf(text, raw, broken) {
  const starts = [];
  for (let i = 0, at = 0; i < raw.length; at += raw[i].length + 1, i++) starts.push(at);
  const lineAt = at => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= at) lo = mid; else hi = mid - 1; } return lo; };
  const rows = raw.map((line, i) => ({ line, n: i + 1, last: i === raw.length - 1 && !broken, toks: [], content: false, within: false, indent: /^ */u.exec(line)[0].length }));
  for (const t of tokensOf(text)) {
    if (!t.src || !rows.length) continue;
    const first = lineAt(t.at), end = lineAt(t.at + t.src.length - 1);
    // (a block scalar's text first: one of a single blank line, kept by `|+`, is a line break alone)
    if (t.content) { for (let i = first; i <= end; i++) rows[i].content = true; continue; }
    if (t.src === "\n") continue;
    for (let i = first + 1; i <= end; i++) rows[i].within = true;
    if (!/^ +$/u.test(t.src)) rows[first].toks.push({ ...t, col: t.at - starts[first] - rows[first].indent, runs: end > first });
  }
  return rows;
}

// one node of a line's text `rest` from `at`, its tokens `toks` (each with its column in `rest`): { kind, text, start,
// end, comment } (kind "key" for a key, its text without the ":"), or { why }
function node(rest, toks, at) {
  while (rest[at] === " ") at++;
  if (at >= rest.length) return { kind: "empty", text: "", start: at, end: at, comment: null };
  const c = rest[at], next = rest[at + 1];
  const spaced = next === undefined || next === " ";
  if (c === "#") return rest[at - 1] === " " ? { kind: "empty", text: "", start: at, end: at, comment: at } : { why: "a # that opens no comment" };
  if (c === "|" || c === ">") return header(rest, at);
  const why = barred(c, spaced);
  if (why) return { why };
  const k = toks.findIndex(t => t.col === at);
  if (k < 0) return { why: "a node the YAML package does not start where this proof does" };
  if (c === "[" || c === "{") return flow(rest, toks, k);
  if (c === '"' || c === "'") return quoted(rest, toks, k);
  return plain(rest, toks, k);
}

// what a node may not start with, as this proof reads YAML: why, or null
function barred(c, spaced) {
  if (c === "-" && spaced) return "a sequence on a key's line";
  if (c === ":" && spaced) return "a key with no name";
  if ("&*!".includes(c)) return "an anchor, alias or tag";
  if ("?%@`".includes(c)) return "an explicit key or a character YAML reserves";
  return "]},".includes(c) ? "a [ ] or { } out of place" : null;
}

// a block scalar's header, with its comment if any
function header(rest, at) {
  const m = HEADER.exec(rest.slice(at));
  if (!m) return { why: "a block scalar's header this proof does not read" };
  const comment = m[1] === undefined ? null : rest.length - m[1].length;
  const text = rest.slice(at, comment ?? rest.length).replace(/ +$/u, "");
  return { kind: "block", text, start: at, end: rest.length, comment, fixed: /[1-9]/u.test(text) };
}

// a [ ] or { }, ending at the token that closes the one the k-th opens, on its own line
function flow(rest, toks, k) {
  const at = toks[k].col;
  let depth = 0, j = k;
  for (; j < toks.length; j++) {
    if ("[{".includes(toks[j].src)) depth++;
    else if ("]}".includes(toks[j].src) && --depth === 0) break;
  }
  const end = j < toks.length ? toks[j].col + 1 : rest.length;
  // (in [ ] alone, a quoted value the lexer ends on its own quote and that holds only plain words is read: no quote,
  // escape, #, bracket, comma or colon within it to read two ways; #1313)
  // (what stands between them, gathered in one pass, so a long list costs no more than its length)
  let text = "", from = at;
  // (the brackets open around each token: only one whose innermost is a [ is read so, never one in a { } within it)
  const open = [];
  for (const t of toks.slice(k, j)) {
    if ("[{".includes(t.src)) open.push(t.src);
    else if ("]}".includes(t.src)) open.pop();
    else if (rest[at] === "[" && open.at(-1) === "[" && WORDS.test(t.src)) { text += rest.slice(from, t.col); from = t.col + t.src.length; }
  }
  text += rest.slice(from, end);
  if (/["'#&*!]/u.test(text)) return { why: "a quote, #, anchor, alias or tag inside [ ] or { }" };
  if (j >= toks.length || toks.slice(k, j).some(t => t.runs)) return { why: "a [ ] or { } that runs on to the next line" };
  return after(rest, toks, j + 1, at, end, "flow");
}

// a quoted value, as the lexer ends it: on its own line, closed by its quote (one no backslash escapes, or past the
// pairs of quotes that stand for one)
function quoted(rest, toks, k) {
  const t = toks[k], q = t.src[0], body = t.src.slice(1);
  const trail = (q === '"' ? /\\*"$/u : /'+$/u).exec(body)?.[0] ?? "";
  const closed = !t.runs && trail.length % 2 === 1; // (an odd run: the last quote one no backslash escapes, or past the pairs of quotes)
  if (!closed) return { why: "a quoted value that runs on to the next line" };
  return after(rest, toks, k + 1, t.col, t.col + t.src.length, "quoted");
}

// a plain value, as the lexer ends it: at " #" (a comment), or at ": " or a final ":" (a key)
function plain(rest, toks, k) {
  const t = toks[k], at = t.col;
  if (t.runs) return { why: "a value that runs on to the next line" };
  const n = toks[k + 1];
  if (n?.src === ":" && (n.col + 1 === rest.length || rest[n.col + 1] === " ")) return { kind: "key", text: rest.slice(at, n.col), start: at, end: n.col + 1, comment: null };
  const note = toks.slice(k + 1).find(x => x.src[0] === "#" && rest[x.col - 1] === " ");
  if (note) return { kind: "plain", text: rest.slice(at, note.col).replace(/ +$/u, ""), start: at, end: note.col, comment: note.col };
  return { kind: "plain", text: rest.slice(at).replace(/ +$/u, ""), start: at, end: rest.length, comment: null };
}

// what may follow a quoted value or one in [ ] or { }: nothing, a comment, or the ":" that makes it a key
function after(rest, toks, k, at, end, kind) {
  const n = toks[k];
  if (!n) return { kind, text: rest.slice(at, end), start: at, end, comment: null };
  if (n.src[0] === "#" && n.col > end) return { kind, text: rest.slice(at, end), start: at, end, comment: n.col };
  if (n.src === ":" && (n.col + 1 === rest.length || rest[n.col + 1] === " ") && kind === "quoted") return { kind: "key", text: rest.slice(at, end), start: at, end: n.col + 1, comment: null };
  return { why: `text after a ${kind === "flow" ? "[ ] or { }" : "quoted value"}` };
}

// A block scalar's text, read by the lexer: each line as it stands, its last marked where the file ends with no line
// break, the break being part of the text. Blank lines before its first line may not hold more spaces than it; blank
// lines after its last are no part of it unless its header keeps them (`|+`), nor are they where they hold no more
// spaces than its text's indentation, YAML reading a line of more spaces as text.
function contentOf(rows, i, lines, unread) {
  let j = i;
  while (j < rows.length && rows[j].content) j++;
  const block = rows.slice(i, j), blank = r => r.indent === r.line.length, first = block.find(r => !blank(r));
  if (first && block.slice(0, block.indexOf(first)).some(r => r.line.length > first.indent)) unread.push(`line ${first.n}: a block scalar's first line less indented than a blank line before it`);
  let end = block.length;
  if (!lines.at(-1)?.value?.includes("+")) while (end > 0 && blank(block[end - 1]) && !(first && block[end - 1].line.length > first.indent)) end--;
  for (const r of block.slice(0, end)) lines.push({ n: r.n, content: true, text: r.line, last: r.last });
  return j;
}

// A line's key, if it has one, and its value, from `at`, past its "- "s: { key, keyCol, value } or { why }.
function keyAndValue(rest, toks, at, indent) {
  const first = node(rest, toks, at);
  if (first.why || first.kind !== "key") return { key: null, keyCol: null, value: first, why: first.why };
  const value = node(rest, toks, first.end);
  const why = value.why ?? (value.kind === "key" ? "two keys on one line" : value.kind !== "empty" && rest[first.end] !== " " ? "a value with no space after its key" : null);
  return { key: first.text, keyCol: indent + at, value, why };
}

// The blank lines after the text of a block scalar whose header keeps them (`|+`), its text too, as the proof read
// them: every blank line up to the next that is not, a last one with no line break after it among them, which the
// lexer leaves out. Returns the line after them.
function keptBlanks(rows, i, lines) {
  for (; i < rows.length && rows[i].indent === rows[i].line.length && !rows[i].within; i++) lines.push({ n: rows[i].n, content: true, text: rows[i].line, last: rows[i].last });
  return i;
}

// One line of YAML that is no block scalar's text, read into `lines` and `comments`, or what is unread of it.
function entryOf(r, lines, comments, unread) {
  const { line, n, indent } = r, rest = line.slice(indent);
  if (rest[0] === "#") { comments.push({ text: rest, at: lines.length, own: true }); return; }
  if (/^(?:---|\.\.\.)(?: |$)/u.test(rest)) { unread.push(`line ${n}: a document marker`); return; }
  let at = 0, items = 0, dash = indent;
  while (rest[at] === "-" && (at + 1 === rest.length || rest[at + 1] === " ")) { items++; dash = indent + at; at++; while (rest[at] === " ") at++; }
  const { key, keyCol, value, why } = keyAndValue(rest, r.toks, at, indent);
  if (why) { unread.push(`line ${n}: ${why}`); return; }
  const cut = value.comment === null ? rest.length : value.comment;
  const note = rest.slice(cut);
  if (note) comments.push({ text: note, at: lines.length, own: false });
  lines.push({ n, indent, items, key, keyCol, kind: value.kind, value: value.text, valueAt: value.kind === "empty" ? null : indent + value.start, note, text: line.slice(0, indent + cut).replace(/ +$/u, "") });
  return value.kind === "block" ? { from: key !== null ? keyCol : dash, keep: value.text.includes("+"), fixed: value.fixed } : null;
}

// A block scalar whose header gives its indentation (`|2`): its text read as more than YAML may, never less, every line
// past the column its key or its last "- " stands at, and the blank lines among them, those after its last kept only
// where its header keeps them. Returns the line after it.
function fixedOf(rows, i, { from, keep }, lines, unread) {
  let held = [];
  for (; i < rows.length; i++) {
    const r = rows[i], text = { n: r.n, content: true, text: r.line, last: r.last };
    // (a line past the column that the lexer reads as YAML, no text of a block scalar and no comment alone: the two
    // readings part there, and what follows cannot be read for sure)
    if (r.indent >= from + 1 && r.indent < r.line.length && !r.content && !(r.toks.length === 1 && r.toks[0].src[0] === "#")) unread.push(`line ${r.n}: a line YAML reads outside the block scalar whose header gives its indentation`);
    if (r.indent === r.line.length && r.indent <= from + 1) { held.push(text); continue; }
    if (r.indent < from + 1) break;
    for (const h of [...held, text]) lines.push(h);
    held = [];
  }
  if (keep) for (const h of held) lines.push(h);
  return i;
}

// The lines read into `lines` and `comments`, a block scalar's text as such, or what is unread of them.
function readRows(rows, lines, comments, unread) {
  for (let i = 0; i < rows.length;) {
    if (rows[i].content) { i = contentOf(rows, i, lines, unread); continue; }
    // (a line within a token that began on a line before, a value that runs on, is refused here too: its first line may be
    // one the proof reads as a block scalar's text)
    if (rows[i].within && rows[i].indent < rows[i].line.length) unread.push(`line ${rows[i].n}: a value on a line of its own, or one that runs on from the line before`);
    const block = rows[i].indent < rows[i].line.length && !rows[i].within ? entryOf(rows[i], lines, comments, unread) : null;
    i = block?.fixed ? fixedOf(rows, i + 1, block, lines, unread) : i + 1;
    if (block?.keep && !block.fixed) i = keptBlanks(rows, rows[i]?.content ? contentOf(rows, i, lines, unread) : i, lines);
  }
}

/** How YAML reads `text`, line by line: { lines, unread }. Each line kept is either a block scalar's ("content", as it
 *  stands) or one with its entries (items, the "- " before its key or value; key; value); comment lines and blank lines
 *  between entries are left out, a line's own comment cut off. `unread` says, by line, what this proof cannot read.
 *  The YAML package's lexer says where each token and each block scalar's text ends; this proof, what it reads. */
export function readYaml(text) {
  const unread = [], lines = [], comments = [];
  const bad = UNREAD.exec(text);
  if (bad) return { lines, comments, unread: [`line ${text.slice(0, bad.index).split("\n").length}: a tab, carriage return, byte order mark, another control character or line break, or a character YAML refuses`] };
  const raw = text.split("\n"), broken = text.endsWith("\n");
  if (broken) raw.pop(); // (what follows the last line break is no line)
  readRows(linesOf(text, raw, broken), lines, comments, unread);
  // one entry a line: a line that is no key and no item continues a value, or stands alone where YAML would read it so;
  // and nothing deeper may follow a line that holds its value, where YAML would read it as that value running on
  const entries = lines.filter(l => !l.content);
  entries.forEach((l, k) => {
    if (l.key === null && l.items === 0) unread.push(`line ${l.n}: a value on a line of its own, or one that runs on from the line before`);
    const next = entries[k + 1];
    if (next && ["plain", "quoted", "flow"].includes(l.kind) && next.indent > (l.key !== null ? l.keyCol : l.indent)) unread.push(`line ${next.n}: a value that runs on from line ${l.n}`);
  });
  if (unread.length) return { lines: [], comments: [], unread };
  // the steps' names: `- name: <value>` as the first key of an item under jobs.<job>.steps, read as text: holding no ${{
  // and no \ (a double-quoted name's escape, \x24 for $, would spell an expression the text does not show), quoted and
  // not empty, or plain from a letter and no word YAML reads as null or true or false
  const holder = (k) => {
    const me = entries[k];
    for (let p = k - 1; p >= 0; p--) {
      const q = entries[p];
      if (q.indent < me.indent || (q.indent === me.indent && q.items === 0 && me.items > 0)) return p;
    }
    return -1;
  };
  const opens = (p, key) => p >= 0 && entries[p].items === 0 && entries[p].kind === "empty" && (key === undefined ? entries[p].key !== null : entries[p].key === key);
  entries.forEach((l, k) => {
    if (l.items !== 1 || l.key !== "name" || l.value.includes("${{") || l.value.includes("\\")) return;
    if (!(l.kind === "quoted" ? l.value.length > 2 : l.kind === "plain" && /^[A-Za-z]/u.test(l.value) && !NOT_TEXT.test(l.value))) return;
    const steps = holder(k);
    if (!opens(steps, "steps")) return;
    const job = holder(steps);
    if (!opens(job)) return;
    const jobs = holder(job);
    if (opens(jobs, "jobs") && entries[jobs].indent === 0) l.stepName = true;
  });
  return { lines, comments, unread };
}
