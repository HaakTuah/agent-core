// A key given twice in one mapping of a YAML file, which GitHub's workflow reader refuses, running none of the file's
// jobs (#393). The workflow check (workflows.mjs, beside this file) fails each with its line. It reads only as much
// YAML as that needs, line by line, and never throws: a block mapping by its keys' indent (a list's items each a
// mapping of their own, the lines a value runs on past its key passed over, a block scalar's among them), and a flow
// mapping (`{ a: 1, b: 2 }`), on one line or on several. A key is read as YAML spells it, quoted or plain, so "if" and
// if are one key. What it does not read: a key written the long way (`? key`), whose mapping is read without it, and a
// line break other than \n and \r, which GitHub's reader does not take as one either. Node's own modules only.

// A line without its comment (" #" outside quotes, or "#" at its start).
export function uncommented(line) {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === quote) quote = ""; else if (c === "\\" && quote === '"') i++; }
    else if (c === "#" && (i === 0 || /\s/u.test(line[i - 1]))) return line.slice(0, i).trimEnd();
    else if ((c === '"' || c === "'") && (i === 0 || /[\s:[{,-]/u.test(line[i - 1]))) quote = c;
  }
  return line.trimEnd();
}

// A double-quoted key's escapes, each as what it spells (YAML 1.2's: one letter, or a code in hex).
const ESCAPE = /\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|([\s\S]))/gu;
const LETTERS = { 0: "\0", a: "\x07", b: "\b", t: "\t", "\t": "\t", n: "\n", v: "\v", f: "\f", r: "\r", e: "\x1b", " ": " ", N: "\x85", _: "\xa0", L: "\u2028", P: "\u2029" };
const unescape = (whole, x, u, U, letter) => {
  const code = parseInt(x ?? u ?? U ?? "", 16);
  if (!Number.isNaN(code)) return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  return LETTERS[letter] ?? letter;
};

// A key as YAML reads it: a quoted one unquoted, a plain one as it stands.
export function keyName(raw) {
  if (raw[0] === "'" && raw.at(-1) === "'") return raw.slice(1, -1).replaceAll("''", "'");
  if (raw[0] === '"' && raw.at(-1) === '"') return raw.slice(1, -1).replace(ESCAPE, unescape);
  return raw.trim();
}

// "key: value" at the start of a line's text, as { key, value }, or null where it holds no key.
const KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|(?:[^\s#'"{}[\],&*!|>%@`?:-]|[?:-]\S).*?)[ \t]*:(?:[ \t]+(.*))?$/u;
export function keyAt(text) {
  const m = KEY.exec(text);
  return m ? { key: keyName(m[1]), value: (m[2] ?? "").trim() } : null;
}

// Whether a value holds nothing but an anchor or a tag, so that what it names stands on the lines below it.
const opens = value => /^(?:[&!]\S*(?:[ \t]+|$))*$/u.test(value);

// The keys given twice in each flow mapping of a flow value (`{` or `[`, and all it holds), each as { key, at, first }:
// the key as YAML reads it and the offsets in the text of the second and the first.
export function flowTwice(text) {
  const found = [];
  let i = 0;
  const blank = () => { while (i < text.length && /\s/u.test(text[i])) i++; };
  const quoted = () => {
    const q = text[i];
    let j = i + 1;
    for (; j < text.length && text[j] !== q; j++) if (text[j] === "\\" && q === '"') j++;
    while (q === "'" && text[j + 1] === "'") for (j += 2; j < text.length && text[j] !== q; j++);
    const raw = text.slice(i, j + 1);
    i = j + 1;
    return keyName(raw);
  };
  const plain = () => {
    const start = i;
    while (i < text.length && !/[,[\]{}]/u.test(text[i]) && !(text[i] === ":" && /^(?:[\s,[\]{}]|)$/u.test(text[i + 1] ?? ""))) i++;
    return text.slice(start, i).trim();
  };
  const node = () => { blank(); return "{[".includes(text[i]) ? collection() : `"'`.includes(text[i]) ? quoted() : plain(); };
  function collection() {
    const close = text[i] === "{" ? "}" : "]", keys = new Map();
    i++;
    while (i < text.length && text[i] !== close) {
      const start = (blank(), i), key = node();
      blank();
      const pair = text[i] === ":";
      if (pair) { i++; node(); blank(); }
      if (close === "}" && typeof key === "string" && (pair || key)) { if (keys.has(key)) found.push({ key, at: start, first: keys.get(key) }); else keys.set(key, start); }
      if (i === start) i++; // a character no node takes: passed over, so the reading always moves on
      else if (text[i] === ",") i++;
    }
    i++;
  }
  node();
  return found;
}

// A line's text past its list's dashes, each "-" and the blanks after it, as { at, item, rest }: where the rest stands,
// where the last dash stood (whose value a scalar after it is; the line's indent where there is none), and the rest,
// null where a dash ends the line, so that its item's mapping starts on the next.
function items(text, col) {
  let at = col, item = col, rest = text.slice(col);
  for (let dash; (dash = /^-(?:[ \t]+|$)/u.exec(rest)); item = at, at += dash[0].length, rest = rest.slice(dash[0].length)) {
    if (dash[0] === "-") return { at, item: at, rest: null };
  }
  return { at, item, rest };
}

// The keys given twice in one mapping of a YAML text, each as { line, key, first }: the line of the second, the key as
// YAML reads it and the line of the first, numbered from 1.
export function twice(text) {
  const found = [], rows = text.replace(/^\ufeff/u, "").split(/\r\n|\r|\n/u);
  const frames = []; // the block mappings open at this line, outermost first: { col, keys }, or { col } for a list's item with nothing after its dash, just past it
  let past = Infinity, flow = null; // past: the lines indented further than this belong to the value above; flow: a flow value being read
  const end = () => {
    if (!flow) return;
    const at = offset => flow.line + flow.text.slice(0, offset).split("\n").length - 1;
    for (const f of flowTwice(flow.text)) found.push({ line: at(f.at), key: f.key, first: at(f.first) });
    flow = null;
  };
  const value = (v, col, line) => { if (opens(v)) return; past = col; if ("{[".includes(v[0])) flow = { text: v, line }; };
  rows.forEach((row, n) => {
    const text = uncommented(row), col = /^[ \t]*/u.exec(row)[0].length;
    if (!text.trim()) return;
    if (col > past) { if (flow) flow.text += `\n${text.trim()}`; return; }
    end();
    past = Infinity;
    if (/^(?:---|\.\.\.)(?:\s|$)/u.test(text)) { frames.length = 0; return; }
    while (frames.length && frames.at(-1).col > col) frames.pop();
    const { at, item, rest } = items(text, col);
    if (rest === null) { frames.push({ col: at + 0.5 }); return; }
    const pair = keyAt(rest);
    if (!pair) { if (rest) value(rest, item, n + 1); return; }
    const top = frames.at(-1), first = top?.col === at ? top.keys?.get(pair.key) : undefined;
    if (first) found.push({ line: n + 1, key: pair.key, first });
    else if (top?.col === at && top.keys) top.keys.set(pair.key, n + 1);
    else frames.push({ col: at, keys: new Map([[pair.key, n + 1]]) });
    value(pair.value, at, n + 1);
  });
  end();
  return found;
}

