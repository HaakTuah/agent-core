// What a description names that its head does not hold ("No description left untrue" in roles/shared/how-to-work.md;
// #1136), the part of that rule's breach a script reads exactly: an archive key the head's archive does not hold, and a
// placeholder left in. pr-description.mjs, beside this file, says what the check asks as a whole, runs this one and
// exports what it holds.
// It never guesses: each part takes a token of a fixed form and compares it with what the archive's reader (archive.mjs,
// beside this file) answers, or with a fixed list, and a token in no such form is not read. Not read either: a quoted
// line (">"), which holds another's words; what stands in double quotes, which mentions a word rather than uses it; and
// an HTML comment, which no reader sees. A commit is not read (#1136, its first part): of the descriptions of 637 merged
// pull requests, 12 named a hash outside the head's history, each true (another repository's pin, a digest, an example,
// an earlier head named as earlier), so a check of it would fail what the rule allows.
// - An archive key: "core archive N" against the archive of the core's copy, in any repository; and, in the core's own
//   alone, whose archive it is, "archive item N" (or "core archive item N"), N a number, "#N" or "#N.P", in any case. A
//   project's own archive may key its items otherwise, so that form is not read there.
// - A placeholder, outside code marks: a word of PLACEHOLDERS in capitals, whole, as written; and "to be added", in any
//   case, where it opens a bracket, a line or a list item, or follows a colon, as a placeholder stands (in a sentence it
//   is ordinary words).
// Node's own modules.
//
//   import { headMends, named, keysAt } from "./pr-head.mjs";
import { items } from "./archive.mjs";

export const PLACEHOLDERS = ["to be added", "TBD", "TODO", "XXX", "FIXME"];
export const HEAD_MEND = "Mend: bring the description to the head in one edit: name the item that stands, or take the line out";

const KEY = String.raw`(#\d+(?:\.\d+)?|\d+)\b`;
const CORE_KEY = new RegExp(String.raw`\bcore archive ${KEY}`, "giu");
const ITEM_KEY = new RegExp(String.raw`\b(?:core )?archive item ${KEY}`, "giu");
const CAPS = new RegExp(PLACEHOLDERS.filter(p => p === p.toUpperCase()).map(p => String.raw`\b${p}\b`).join("|"), "gu");
// (the blanks before a list mark and those after it never overlap, so a long line of blanks is read in one pass)
const ADDED = /(?:^\s*(?:(?:[-*+]|\d+[.)])\s+)?|[([<:]\s*)(to\s+be\s+added)\b/giu;

// The description's lines, each with its number and its text, with what is not read taken out (`text`) and, besides,
// what stands in code marks (`prose`): a fenced block's lines have no prose. A quoted line is left out whole.
function linesOf(body) {
  const out = [];
  let fence = null, comment = false;
  for (const [i, raw] of String(body ?? "").split(/\r\n|\r|\n/u).entries()) {
    const open = /^ {0,3}(`{3,}|~{3,})/u.exec(raw);
    if (fence) { if (open && open[1][0] === fence[0] && open[1].length >= fence.length && !raw.slice(open[0].length).trim()) fence = null; out.push({ at: i + 1, text: raw, prose: "" }); continue; }
    if (open && !comment) { fence = open[1]; out.push({ at: i + 1, text: raw, prose: "" }); continue; }
    // (an HTML comment taken out, one that runs on over lines too)
    let line = "", rest = raw;
    while (rest) {
      if (comment) { const end = rest.indexOf("-->"); if (end < 0) rest = ""; else { comment = false; rest = rest.slice(end + 3); line += " "; } }
      else { const start = rest.indexOf("<!--"); if (start < 0) { line += rest; rest = ""; } else { line += rest.slice(0, start); rest = rest.slice(start + 4); comment = true; } }
    }
    if (/^\s*>/u.test(line)) continue;
    const text = line.replace(/"[^"]*"|“[^”]*”/gu, " ");
    out.push({ at: i + 1, text, prose: text.replace(/(`+)[^`]*?\1/gu, " ") });
  }
  return out;
}

// What the description names, each with the line it stands on: { keys, placeholders }, each a list of { at, token,
// said }. `own` says whether the repository is the core's own, whose archive "archive item N" names.
export function named(body, own = true) {
  const keys = [], placeholders = [];
  for (const { at, text, prose } of linesOf(body)) {
    // (in the order they stand on the line)
    keys.push(...[...text.matchAll(CORE_KEY), ...(own ? text.matchAll(ITEM_KEY) : [])].sort((x, y) => x.index - y.index).map(m => ({ at, token: m[1], said: m[0] })));
    for (const m of prose.matchAll(CAPS)) placeholders.push({ at, token: m[0], said: m[0] });
    for (const m of prose.matchAll(ADDED)) placeholders.push({ at, token: m[1], said: m[1] });
  }
  return { keys, placeholders };
}

// The keys the archive at `root` holds, as text ("218", "#733.2"), both its forms; null where it holds none.
export function keysAt(root) {
  const { reasons, words } = items(root);
  const keys = new Set([...reasons.keys(), ...words.keys()].map(String));
  return keys.size ? keys : null;
}

// The failures of a description, { mends, notes }: each mend a line naming where it stands and what it names, then its
// mend; `notes`, what was not read and why. `keys` is as keysAt() gives it, `own` as named() takes it.
export function headMends(body, { keys, own = true }) {
  const { keys: said, placeholders } = named(body, own), mends = [], notes = [];
  if (said.length && keys === null) notes.push("the archive keys the description names are not read here: no archive could be read");
  else for (const k of said) if (!keys.has(k.token.replace(/^0+(?=\d)/u, ""))) mends.push(`line ${k.at} of the description names "${k.said}", which the head's archive does not hold. ${HEAD_MEND}`);
  for (const p of placeholders) mends.push(`line ${p.at} of the description holds the placeholder "${p.said}". ${HEAD_MEND}, or write what it stands for; where the word is meant as it stands, put it in code marks`);
  return { mends, notes };
}
