// The form of the core's queue, QUEUE.md (roles/shared/inbox.md, "The progress file holds order only"; #552): each row
// of its tables names its issue first and holds no more cells than its table's header, so no line goes unread and the
// file holds no note (AGENTS.md, "The queue"). Read by queue.mjs, beside this file, in --check, in the core alone: a
// project's progress file is not read so (#552's scope). Node's own language only; reads and writes nothing.

// The rows out of their form: { text, why } for each row of a table, past its header and the line under it, that names
// no issue first ("#n", as the readers read it, so no reader takes it as a line) or holds more cells than its header (a
// note, which the file never holds). A cell is split at each "|" Markdown splits it at, one written "\|" kept whole.
const cellsOf = row => row.trim().replace(/^\|/u, "").replace(/(?<!\\)\|$/u, "").split(/(?<!\\)\|/u);
export function unformed(text) {
  const all = String(text ?? "").split("\n").map(l => l.replace(/\r$/u, "")), out = [];
  for (let at = 0; at < all.length; at++) {
    if (!/^\s*\|/u.test(all[at]) || (at > 0 && /^\s*\|/u.test(all[at - 1]))) continue;
    // (rows under no header and its line of dashes are no table, each read for its issue alone)
    const table = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/u.test(all[at + 1] ?? ""), width = table ? cellsOf(all[at]).length : Infinity;
    for (at += table ? 2 : 0; at < all.length && /^\s*\|/u.test(all[at]); at++) {
      const cells = cellsOf(all[at]), row = all[at].trim();
      if (!/^\s*#\d/u.test(cells[0])) out.push({ text: row, why: "names no issue first" });
      else if (cells.length > width) out.push({ text: row, why: `holds ${cells.length} cells, its table's header ${width}` });
    }
  }
  return out;
}

// Each such row's failure, with its mend.
export const formFails = (FILE, text) => unformed(text).map(r => `FAIL: ${FILE} holds a row that ${r.why}: ${r.text}. Mend: give each line of ${FILE} its issue first as "#n" and its three cells, issue, who builds it and what it waits on, a "|" inside a cell written "\\|", and put any note in the description of the line's pull request (AGENTS.md, "The file holds no note")`);
