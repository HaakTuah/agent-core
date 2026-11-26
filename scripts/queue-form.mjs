// The form of the core's queue, QUEUE.md (roles/shared/inbox.md, "The progress file holds order only"; #552): each row
// of its tables names its issue first and holds no more cells than its table's header, so no line goes unread and the
// file holds no note (AGENTS.md, "The queue"). Read by queue.mjs, beside this file, in --check, in the core alone: a
// project's progress file is not read so (#552's scope). Node's own language only; reads and writes nothing.

// The rows out of their form: { text, why } for each row of a table, past its header and the line under it, that names
// no issue first ("#n", as the readers read it, so no reader takes it as a line) or holds more cells than its header (a
// note, which the file never holds). A cell is split at each "|", as queue.mjs's reader splits it, so a "|" inside a
// cell makes a cell more and is read as out of form; each pattern reads a line in one pass, whatever it holds
// (SECURITY.md, rule 5).
const cellsOf = row => row.trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|");
export function unformed(text) {
  const all = String(text ?? "").split("\n").map(l => l.replace(/\r$/u, "")), out = [];
  for (let at = 0; at < all.length; at++) {
    if (!/^\s*\|/u.test(all[at]) || (at > 0 && /^\s*\|/u.test(all[at - 1]))) continue;
    // (rows under no header and its line of dashes are no table, each read for its issue alone)
    const table = /^\s*\|/u.test(all[at + 1] ?? "") && cellsOf(all[at + 1]).every(c => /^:?-+:?$/u.test(c.trim())), width = table ? cellsOf(all[at]).length : Infinity;
    for (at += table ? 2 : 0; at < all.length && /^\s*\|/u.test(all[at]); at++) {
      const cells = cellsOf(all[at]), row = all[at].trim();
      if (!/^\s*#\d/u.test(cells[0])) out.push({ text: row, why: "names no issue first" });
      else if (cells.length > width) out.push({ text: row, why: `holds ${cells.length} cells, its table's header ${width}` });
    }
  }
  return out;
}

// Each such row's failure, with its mend: the first SHOWN rows, each cut to CUT characters with its control characters
// written out (\u0007), then a count of the rest, so a hostile queue prints a few lines whatever it holds.
export const SHOWN = 20, CUT = 120;
const shown = text => [...text.slice(0, CUT)].map(c => /[\p{Cc}\p{Cf}]/u.test(c) ? `\\u${c.codePointAt(0).toString(16).padStart(4, "0")}` : c).join("") + (text.length > CUT ? " ..." : "");
export function formFails(FILE, text) {
  const rows = unformed(text), mend = `Mend: give each line of ${FILE} its issue first as "#n" and its three cells, issue, who builds it and what it waits on, with no "|" inside a cell, and put any note in the description of the line's pull request (AGENTS.md, "The file holds no note")`;
  const out = rows.slice(0, SHOWN).map(r => `FAIL: ${FILE} holds a row that ${r.why}: ${shown(r.text)}. ${mend}`);
  if (rows.length > SHOWN) out.push(`FAIL: ${FILE} holds ${rows.length - SHOWN} more rows out of their form, not shown. ${mend}`);
  return out;
}
