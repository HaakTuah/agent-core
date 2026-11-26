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
// The archive is a file of the checkout, which a fork's branch may make a link, a pipe or a folder, so it is read through
// the guards of reading.mjs (#848): what is not a regular file of the checkout's own reads as nothing. At most SHOWN
// failures are given, then the count of the rest. Node's own modules.
//
//   import { headMends, headOf, keysAt } from "./pr-head.mjs";
import { items } from "./archive.mjs";
import { realFiles, regular } from "./reading.mjs";

const PLACEHOLDERS = ["to be added", "TBD", "TODO", "XXX", "FIXME"];
export const SHOWN = 10;
// (the archive read through reading.mjs's guards; each link met goes into `links`)
const guarded = links => ({ list: (root, folder) => realFiles(root, folder, links), read: regular });
export const HEAD_MEND = "Mend: bring the description to the head in one edit: name the item that stands, or take the line out";
export const PLACE_MEND = "Mend: in one edit, write what the placeholder stands for, or take the line out; where the word is meant as it stands, put it in code marks";

const KEY = String.raw`(#\d+(?:\.\d+)?|\d+)\b`;
const CORE_KEY = new RegExp(String.raw`\bcore archive ${KEY}`, "giu");
const ITEM_KEY = new RegExp(String.raw`\b(?:core )?archive item ${KEY}`, "giu");
const CAPS = new RegExp(PLACEHOLDERS.filter(p => p === p.toUpperCase()).map(p => String.raw`\b${p}\b`).join("|"), "gu");
// (the blanks before a list mark and those after it never overlap, so a long line of blanks is read in one pass)
const ADDED = /(?:^\s*(?:(?:[-*+]|\d+[.)])\s+)?|[([<:]\s*)(to\s+be\s+added)\b/giu;

// The description's lines, each with its number and its text, with what is not read taken out (`text`) and, besides,
// what stands in code marks (`prose`): a fenced block's lines have no prose. A quoted line is left out whole. Each line
// is read in one pass, so no text makes the check slow.
function linesOf(body) {
  const out = [], state = { comment: false }, lines = (typeof body === "string" ? body : "").split(/\r\n|\r|\n/u), closes = [];
  // (whether a "-->" stands on a later line of the same paragraph, before the next blank line)
  for (let i = lines.length - 1, next = false; i >= 0; i--) { closes[i] = next; next = lines[i].trim() !== "" && (next || lines[i].includes("-->")); }
  let fence = null;
  for (const [i, raw] of lines.entries()) {
    const open = /^ {0,3}(`{3,}|~{3,})/u.exec(raw);
    if (fence) { if (open && open[1][0] === fence[0] && open[1].length >= fence.length && !raw.slice(open[0].length).trim()) fence = null; out.push({ at: i + 1, text: raw, prose: "" }); continue; }
    if (open && !state.comment) { fence = open[1]; out.push({ at: i + 1, text: raw, prose: "" }); continue; }
    const { line, bare, code } = marked(raw, state, closes[i]);
    if (/^\s*>/u.test(line)) continue;
    // (what stands in double quotes, "…" or “…”, outside code marks; one opening mark of each kind is read at a time)
    const quotes = [...bare.matchAll(/"[^"]*"|“[^“”]*”/gu)].map(m => [m.index, m.index + m[0].length]);
    out.push({ at: i + 1, text: cut(line, quotes), prose: cut(line, [...quotes, ...code]) });
  }
  return out;
}

// A line with its HTML comments taken out, one that runs on over lines too (`state.comment`); `bare`, the same with
// what its code spans hold blanked; and `code`, where each code span stands in it. As CommonMark reads them, whichever
// opens first wins: a "<!--" in code marks opens no comment, and a run of backticks closes at the next run of the same
// length or is only text. A "<!--" opens a comment where it opens the line, or where a "-->" closes it on this line or
// a later one of its paragraph (`closes`); elsewhere it is only text, which shows.
function marked(raw, state, closes) {
  const runs = spans(raw), code = [], lead = /^ {0,3}(?=<!--)/u.exec(raw)?.[0].length ?? -1, last = raw.lastIndexOf("-->");
  let line = "", bare = "", r = 0, at = 0, opener = -1;
  while (at < raw.length) {
    if (state.comment) { const end = raw.indexOf("-->", at); if (end < 0) break; state.comment = false; line += " "; bare += " "; at = end + 3; continue; }
    while (r < runs.length && runs[r].at < at) r++;
    if (opener < at) { const next = raw.indexOf("<!--", at); opener = next < 0 ? raw.length : next; }
    const run = runs[r], stop = Math.min(run?.at ?? raw.length, opener);
    line += raw.slice(at, stop); bare += raw.slice(at, stop);
    if (run?.at === stop) {
      if (run.end > run.at + run.n) code.push([line.length, line.length + run.end - run.at]);
      line += raw.slice(run.at, run.end); bare += " ".repeat(run.end - run.at); at = run.end;
    } else {
      const opens = stop < raw.length && (stop === lead || stop + 4 <= last || closes);
      if (!opens) { line += raw.slice(stop, stop + 4); bare += raw.slice(stop, stop + 4); }
      state.comment = opens; at = stop + 4;
    }
  }
  return { line, bare, code };
}

// The runs of backticks of a line, each { at, n, end }: where a code span it opens ends, after the next run of the same
// length, or, where none follows, the end of the run itself, which is then only text. Read once, from the line's end.
function spans(raw) {
  const runs = [...raw.matchAll(/`+/gu)].map(m => ({ at: m.index, n: m[0].length })), after = new Map();
  for (const run of runs.toReversed()) { run.end = (after.get(run.n) ?? run.at) + run.n; after.set(run.n, run.at); }
  return runs;
}

// A line with each range of it ([from, to]) put as one blank; a range inside another goes with it.
function cut(line, ranges) {
  let out = "", at = 0;
  for (const [from, to] of ranges.toSorted((x, y) => x[0] - y[0])) if (from >= at) { out += `${line.slice(at, from)} `; at = to; }
  return out + line.slice(at);
}

// What the description names, each with the line it stands on: { keys, placeholders }, each a list of { at, token,
// said }. `own` says whether the repository is the core's own, whose archive "archive item N" names.
function named(body, own) {
  const keys = [], placeholders = [];
  for (const { at, text, prose } of linesOf(body)) {
    // (in the order they stand on the line)
    keys.push(...[...text.matchAll(CORE_KEY), ...(own ? text.matchAll(ITEM_KEY) : [])].sort((x, y) => x.index - y.index).map(m => ({ at, token: m[1], said: m[0] })));
    for (const m of prose.matchAll(CAPS)) placeholders.push({ at, token: m[0], said: m[0] });
    for (const m of prose.matchAll(ADDED)) placeholders.push({ at, token: m[1], said: m[1] });
  }
  return { keys, placeholders };
}

// The keys the archive under `prefix` of the checkout at `root` holds, as text ("218", "#733.2"), both its forms; null
// where it holds none. Each part of the path is read as reading.mjs reads it, so a link on the way reads as no archive,
// and each link met goes into `links`, by its path under `root`.
export function keysAt(root, prefix = "", links = new Set()) {
  const { reasons, words } = items(root, prefix, guarded(links));
  const keys = new Set([...reasons.keys(), ...words.keys()].map(String));
  return keys.size ? keys : null;
}

// What the check says of a description in the repository whose copy of the core lies at `at`, as coreAt() (reading.mjs)
// gives it: "" in the core's own, whose archive "archive item N" names; its path in a project; null where none is found,
// so that no archive is read. { mends, oks }: the failures, and the lines that pass.
export function headOf(body, at) {
  const links = new Set(), { mends, notes } = headMends(body, { keys: at === null ? null : keysAt(".", at, links), own: at === "" });
  if (links.size) notes.push(`the archive's ${[...links].sort().map(l => JSON.stringify(l)).join(", ")} ${links.size > 1 ? "are links" : "is a link"}, read as no file`);
  return { mends, oks: mends.length ? notes : [...notes, "the description names no archive key its head does not hold, and leaves no placeholder in"] };
}

// The failures of a description, { mends, notes }: each mend a line naming where it stands and what it names, then its
// mend, the first SHOWN of them and then one that counts the rest; `notes`, what was not read and why. `keys` is as
// keysAt() gives it, `own` as named() takes it.
export function headMends(body, { keys, own = true }) {
  const { keys: said, placeholders } = named(body, own), mends = [], notes = [];
  if (said.length && keys === null) notes.push("the archive keys the description names are not read here: no archive could be read");
  else for (const k of said) if (!keys.has(k.token.replace(/^0+(?=\d)/u, ""))) mends.push(`line ${k.at} of the description names "${k.said}", which the head's archive does not hold. ${HEAD_MEND}`);
  for (const p of placeholders) mends.push(`line ${p.at} of the description holds the placeholder "${p.said}". ${PLACE_MEND}`);
  if (mends.length > SHOWN) return { mends: [...mends.slice(0, SHOWN), `${mends.length - SHOWN} more such failures of the description, not shown. Mend: take them out or bring them to the head in the same edit, then run the check again`], notes };
  return { mends, notes };
}
