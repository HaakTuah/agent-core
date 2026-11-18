// What the pointer check (pointers.mjs) reads of a Markdown file, by the lexer of the `marked` package carried in
// third-party/ (#530): its headings, its bold lead-ins and its blocks, each by the line it stands on (from 0). A block is
// a paragraph or a list item, its lines joined, each trimmed and led by a space, a list item led by its marker; a
// heading, and each row of a table, is a block of its own line as written. A code block, fenced or indented, and HTML
// (a block, or a comment inside one) are no block, and nothing in them is read. A front matter ("---" on the first line
// to its close) is one block of plain text, as a tool that reads the file whole reads it: no heading or bold in it.
//
//   import { readMarkdown } from "./markdown.mjs";   readMarkdown(text) -> { heads: [{ level, i, text }],
//                                                     bolds: [{ i, text }], blocks: [{ i, text }] }
import marked from "../third-party/marked/lib/marked.umd.js";

const { Lexer } = marked;
const breaks = s => (s.match(/\n/gu) || []).length;
const rows = raw => raw.replace(/\n+$/u, "").split("\n");
// (a comment of HTML inside a block is read as nothing, as HTML is)
const joined = raw => rows(raw).map(l => ` ${l.trim()}`).join("").replace(/<!--[\s\S]*?-->/gu, "");

export function readMarkdown(text) {
  let src = String(text).replace(/\r\n?/gu, "\n");
  const out = { heads: [], bolds: [], blocks: [] }, front = /^---\n(?:.*\n)*?---(?:\n|$)/u.exec(src);
  let line = 0;
  if (front) {
    const inner = front[0].slice(4, front[0].lastIndexOf("---"));
    if (inner.trim()) out.blocks.push({ i: 1, text: joined(inner) });
    line = breaks(front[0]) + (front[0].endsWith("\n") ? 0 : 1);
    src = src.slice(front[0].length);
  }
  walk(out, Lexer.lex(src), line);
  return out;
}

// Each token from `line` on, as the blocks and anchors above.
function walk(out, tokens, line) {
  for (const t of tokens) {
    if (t.type === "heading") {
      out.heads.push({ level: t.depth, i: line, text: t.text });
      out.blocks.push({ i: line, text: rows(t.raw)[0] });
      bolds(out, t, line);
    } else if (t.type === "table") {
      rows(t.raw).forEach((l, k) => out.blocks.push({ i: line + k, text: l }));
      // (its bold lead-ins by row: the header's line, then each row's after the line under it)
      [t.header, ...t.rows].forEach((cells, k) => cells.forEach(c => bolds(out, c, line + (k ? k + 1 : 0))));
    } else if (t.type === "paragraph" || t.type === "text") {
      out.blocks.push({ i: line, text: joined(t.raw) });
      bolds(out, t, line);
    } else if (t.type === "list") items(out, t.items, line);
    else if (t.type === "blockquote") walk(out, t.tokens, line);
    line += breaks(t.raw);
  }
}

// A list's items from `line` on: each item's first block led by its marker, what it holds read as the rest.
function items(out, list, line) {
  for (const it of list) {
    const marker = /^\s*(?:[-*+]|\d+[.)])\s+/u.exec(it.raw)?.[0].trim() ?? "";
    let at = line;
    for (const c of it.tokens) {
      if ((c.type === "text" || c.type === "paragraph") && at === line) {
        out.blocks.push({ i: at, text: ` ${marker}${joined(c.raw)}` });
        bolds(out, c, at);
      } else walk(out, [c], at);
      at += breaks(c.raw);
    }
    line += breaks(it.raw);
  }
}

// The bold spans of a block, each on the line where its raw text stands, found in turn from the last.
function bolds(out, block, line) {
  const whole = block.raw ?? block.text ?? ""; // (a table's cell holds its text alone, on its row's one line)
  let from = 0;
  const go = tokens => {
    for (const x of tokens ?? []) {
      if (x.type !== "strong") { go(x.tokens); continue; }
      const k = whole.indexOf(x.raw, from), at = k < 0 ? from : k;
      out.bolds.push({ i: line + breaks(whole.slice(0, at)), text: x.text });
      from = at + x.raw.length;
    }
  };
  go(block.tokens);
}
