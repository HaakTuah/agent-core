// What the pointer check (pointers.mjs) reads of a Markdown file, by the lexer of the `marked` package carried in
// third-party/ (#530): its headings, its bold lead-ins and its blocks, each by the line it stands on (from 0). A block is
// a paragraph or a list item, its lines joined, each trimmed and led by a space, a list item led by its marker; a
// heading, and each row of a table, is a block of its own line as written. A code block, fenced or indented, and HTML
// are no block, and nothing in them is read. A front matter's fences ("---" on the first line and its close) are read
// as blank lines, so its lines are text, as a tool that reads the file whole reads them.
//
//   import { readMarkdown } from "./markdown.mjs";   readMarkdown(text) -> { heads: [{ level, i, text }],
//                                                     bolds: [{ i, text }], blocks: [{ i, text }] }
import marked from "../third-party/marked/lib/marked.umd.js";

const { Lexer } = marked;
const breaks = s => (s.match(/\n/gu) || []).length;
const rows = raw => raw.replace(/\n+$/u, "").split("\n");
const joined = raw => rows(raw).map(l => ` ${l.trim()}`).join("");

export function readMarkdown(text) {
  let src = String(text).replace(/\r\n?/gu, "\n");
  const front = /^---\n(?:.*\n)*?---(?:\n|$)/u.exec(src);
  if (front) src = `\n${front[0].slice(4, front[0].lastIndexOf("---"))}\n${src.slice(front[0].length)}`;
  const out = { heads: [], bolds: [], blocks: [] };
  walk(out, Lexer.lex(src), 0);
  return out;
}

// Each token from `line` on, as the blocks and anchors above.
function walk(out, tokens, line) {
  for (const t of tokens) {
    if (t.type === "heading") {
      out.heads.push({ level: t.depth, i: line, text: t.text });
      out.blocks.push({ i: line, text: rows(t.raw)[0] });
      bolds(out, t, line);
    } else if (t.type === "table") rows(t.raw).forEach((l, k) => out.blocks.push({ i: line + k, text: l }));
    else if (t.type === "paragraph" || t.type === "text") {
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
  let from = 0;
  const go = tokens => {
    for (const x of tokens ?? []) {
      if (x.type !== "strong") { go(x.tokens); continue; }
      const k = block.raw.indexOf(x.raw, from), at = k < 0 ? from : k;
      out.bolds.push({ i: line + breaks(block.raw.slice(0, at)), text: x.text });
      from = at + x.raw.length;
    }
  };
  go(block.tokens);
}
