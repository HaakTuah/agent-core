// The commands of a step's `run:`, as bash reads them, on the parser the core installs (parser.mjs; #530, item 3):
// the grammar, not a reader written here, tells a command, a word, a quote, a comment and a here-document. Each command
// is a list of its words as { text, dynamic }, its name first and then its arguments, quotes taken off; an assignment
// before it is a word of its own, a redirection and its file are none. A command inside another (in $( ), a
// subshell, a pipeline, a list, an if, a loop or a function) is one of its own, in the order they stand. A test
// ([ ], [[ ]]) and a declaration (export, local, declare, readonly, unset) are commands of their words as written. A
// word is dynamic where a variable, a command's output, arithmetic, an unquoted glob or brace, or an expression of
// GitHub's in it is filled only when the workflow runs, or where it holds %NAME%, cmd's variable. A "\" between two
// letters of a path is kept, read as "/", a folder's parting on Windows. A here-document's lines are data, never
// commands. Where the grammar cannot read part of the text, what it reads around that part is still given, as the
// reader before it gave what it could.
//
//   import { bashCommands } from "./bash-commands.mjs";   bashCommands(run) -> [[{ text, dynamic }, ...], ...]
import { inParser } from "./parser.mjs";

/** The commands of `run` (read in the parser's thread: read, below). Where the parser could not be loaded, it throws,
 *  saying so with the install's mend. */
export function bashCommands(run) {
  const text = String(run);
  // (each text read once: a step that stands thousands of times, or an action called as often, costs one reading)
  if (READ.has(text)) return structuredClone(READ.get(text));
  try {
    const found = inParser(import.meta.url, "read", text);
    if (READ.size >= READ_MOST) READ.clear();
    READ.set(text, found);
    return structuredClone(found);
  } catch (e) {
    // (the load's own mend where it gives one, packages.mjs's, which in a job names the install step)
    const mended = / Mend: /u.test(e?.message ?? "");
    if (e?.kind === "load") throw new Error(`The parser or the grammar of bash could not be loaded: ${mended ? e.message : `${e.message}. Mend: run node core/scripts/install.mjs parser (in the core, scripts/install.mjs parser), which installs the parser's packages from its lock file, then run this again`}`);
    throw e;
  }
}

const READ = new Map(), READ_MOST = 10000;

// GitHub fills each of its expressions before the shell runs, quoted or not: each is read as a word's letters that no
// text holds, of the same length, so that the grammar reads it as part of the word it stands in, then given back.
// An extended glob of bash's (?( ), *( ), +( ), @( ), !( )), which the grammar reads as a subshell after a word, is read
// so too, as a part of its word filled when it runs: each subshell that opens right after one of those signs is stood
// in for, as an expression is, and the text read again.
const EXPRESSION = /\$\{\{[\s\S]*?(?:\}\}|$)/gu;
const mark = (kind, n, length) => `GH${kind}${n}Z`.padEnd(length, "_");
const MARKED = /GH(?:EXPR|GLOB)\d+Z/u;
// (how long the grammar may take on the whole text, and then on one line of it, in milliseconds: its recovery from an
// error grows faster than the text, and no step holds a line it cannot read in that time but to hide what it holds. A
// line it cannot read so is not read, and a naming of the script on it, which no run accounts for, leaves the run not
// read: check-configs.mjs, `unaccounted`)
const WHOLE = 500, LINE = 100;

/** The commands of `run`, read with the parser's `parse` (in its thread: bashCommands, above). */
export function read(parse, run) {
  const filled = [];
  const text = run.replace(EXPRESSION, m => { const k = mark("EXPR", filled.length, m.length); filled.push([k, m]); return k; });
  const back = s => filled.reduceRight((acc, [k, m]) => acc.split(k).join(m), s);
  const out = [];
  const whole = readable(parse, text, filled, WHOLE);
  if (whole !== null) commandsIn(parse, whole, 0, { back, out });
  else {
    // (the whole past its budget: each line alone, within its own)
    let at = 0;
    for (const line of text.split("\n")) {
      const one = line.trim() ? readable(parse, line, filled, LINE) : null;
      if (one !== null) commandsIn(parse, one, at, { back, out });
      at += line.length + 1;
    }
  }
  return out.sort((a, b) => a.at - b.at).map(c => c.words).filter(w => w.length);
}

// `text` with each extended glob stood in for, taken into `filled`, or null where the grammar cannot read it within
// `budget`.
function readable(parse, text, filled, budget) {
  for (let pass = 0; pass < GLOB_PASSES; pass++) {
    const tree = parse("bash", text, budget);
    if (!tree) return null;
    const globs = [];
    const seek = n => { if (n.type === "subshell" && "?*+@!".includes(text[n.startIndex - 1] ?? "")) globs.push([n.startIndex, n.endIndex]); else for (const c of n.namedChildren) seek(c); };
    seek(tree.rootNode);
    tree.delete();
    if (!globs.length) return text;
    for (const [a, b] of globs.reverse()) { const k = mark("GLOB", filled.length, b - a); filled.push([k, text.slice(a, b)]); text = text.slice(0, a) + k + text.slice(b); }
  }
  return text;
}
// (an extended glob inside another is found on the next reading, to this depth)
const GLOB_PASSES = 4;

// The commands of `text`, which stands at `offset` in the step's: the whole read at once, then each line inside a part
// the grammar could not read, where that gave no command, read alone, so that nothing the grammar reads past is lost;
// and the lines of a here-document with no line that ends it, which a shell would read to the step's end, read as
// commands, each alone, as the reader before this one read them, so that no run is missed.
function commandsIn(parse, text, offset, ctx) {
  const tree = parse("bash", text, WHOLE);
  if (!tree) return;
  try {
    const found = [], local = { ...ctx, out: found, offset, parse };
    walk(tree.rootNode, local);
    if (tree.rootNode.hasError && text.includes("\n")) { // (a line alone is read once: what it gives is all)
      const errors = [], seek = n => { if (n.type === "ERROR" || n.isMissing) errors.push([n.startPosition.row, n.endPosition.row]); else if (n.hasError) for (const c of n.children) seek(c); };
      seek(tree.rootNode);
      const lines = text.split("\n"), starts = [];
      for (let k = 0, at = 0; k < lines.length; at += lines[k].length + 1, k++) starts.push(at);
      const rowOf = at => { let low = 0, high = starts.length - 1; while (low < high) { const mid = (low + high + 1) >> 1; if (starts[mid] <= at - offset) low = mid; else high = mid - 1; } return low; };
      const covered = new Set(found.map(c => rowOf(c.at)));
      const rows = new Set(errors.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k)));
      for (const r of rows) if (!covered.has(r) && lines[r]?.trim()) commandsIn(parse, lines[r], offset + starts[r], { ...ctx, out: found });
    }
    ctx.out.push(...found);
  } finally { tree.delete(); }
}

// The nodes that are a command, and those whose words are read as written.
const AS_WRITTEN = new Set(["test_command", "declaration_command", "unset_command"]);
function walk(node, ctx) {
  if (node.type === "comment") return;
  if (node.type === "heredoc_body") return unended(node, ctx);
  const body = node.type === "redirected_statement" ? node.childForFieldName("body") : null;
  if (body?.type === "command") return redirected(node, body, ctx);
  if (node.type === "command") commandWords(node, ctx);
  else if (AS_WRITTEN.has(node.type)) ctx.out.push({ at: ctx.offset + node.startIndex, words: writtenWords(node, ctx.back) });
  else assignments(node, ctx);
  for (const child of node.namedChildren) walk(child, ctx);
}
// A here-document with no line that ends it: its lines read as commands, each alone, so that one inside another's is
// read once, never again with each that holds it.
function unended(node, ctx) {
  if (node.parent?.children.some(c => c.type === "heredoc_end")) return;
  let at = node.startIndex;
  for (const line of node.text.split("\n")) { if (line.trim()) commandsIn(ctx.parse, line, ctx.offset + at, ctx); at += line.length + 1; }
}
// A command that stands in a redirection: its words with the redirection's, then what both hold. (A node is a new
// object at each call: told apart by its id.)
function redirected(node, body, ctx) {
  commandWords(body, ctx, node);
  for (const child of node.namedChildren) if (child.id !== body.id) walk(child, ctx);
  for (const child of body.namedChildren) walk(child, ctx);
}
// Assignments alone on a line are a command of their words, as the reader before this one read them.
function assignments(node, ctx) {
  if ((node.type !== "variable_assignment" && node.type !== "variable_assignments") || !STATEMENTS.has(node.parent?.type)) return;
  const list = node.type === "variable_assignment" ? [node] : node.namedChildren.filter(c => c.type === "variable_assignment");
  for (const line of byLine(list)) ctx.out.push({ at: ctx.offset + line[0].startIndex, words: line.map(c => wordOf(c, ctx.back)) });
}
// Assignments in runs on one line each: the grammar joins those of two lines (below).
function byLine(list) {
  const lines = [];
  for (const c of list) { if (lines.length && lines.at(-1).at(-1).endPosition.row === c.startPosition.row) lines.at(-1).push(c); else lines.push([c]); }
  return lines;
}
// (where a statement stands: assignments there are no command's prefix)
const STATEMENTS = new Set(["program", "list", "pipeline", "subshell", "compound_statement", "if_statement", "elif_clause", "else_clause",
  "do_group", "case_item", "command_substitution", "process_substitution", "redirected_statement", "negated_command"]);

// A command's words: each assignment before it, its name and its arguments, a comment, a redirection and its file left
// out. Where the command stands in a redirection (`redirected`), the words the grammar gives its redirections after
// their file are the command's arguments, as bash gives them, and a word written against a redirection, a descriptor's
// name ({fd}>), is none. Assignments that end on a line before the command's name are a command of their own: the
// grammar the core installs (tree-sitter-bash 0.25.1) reads two or more assignments on a line as the prefix of the
// command on the next, where bash reads them as two.
function commandWords(node, ctx, redirected = null) {
  const { back, out, offset } = ctx;
  const redirects = redirected ? redirected.namedChildren.filter(c => c.type === "file_redirect") : [];
  const against = new Set(redirects.map(r => r.startIndex));
  const kids = node.namedChildren.filter(c => !["comment", "file_redirect", "heredoc_redirect", "herestring_redirect"].includes(c.type))
    .filter(c => !(against.has(c.endIndex) && /^\{\w+\}$/u.test(c.text)));
  const name = kids.find(c => c.type === "command_name");
  const before = name ? kids.filter(c => c.type === "variable_assignment" && c.endIndex <= name.startIndex) : [];
  const apart = before.length && before.at(-1).endPosition.row < name.startPosition.row;
  if (apart) for (const line of byLine(before)) out.push({ at: offset + line[0].startIndex, words: line.map(c => wordOf(c, back)) });
  const words = [];
  for (const child of kids) {
    if (apart && before.includes(child)) continue;
    words.push(wordOf(child.type === "command_name" ? child.namedChildren[0] ?? child : child, back));
  }
  for (const r of redirects) for (const d of r.childrenForFieldName("destination").slice(1)) words.push(wordOf(d, back));
  out.push({ at: offset + (apart ? name.startIndex : node.startIndex), words });
}

// A test's or a declaration's words, each leaf or word as written, its brackets and its keyword among them.
function writtenWords(node, back) {
  const words = [];
  const each = n => {
    if (n.type === "file_redirect" || n.type === "heredoc_redirect" || n.type === "comment") return;
    if (WORDS.has(n.type) || n.childCount === 0) { if (n.text.trim()) words.push(wordOf(n, back)); return; }
    for (const c of n.children) each(c);
  };
  for (const c of node.children) each(c);
  return words;
}
const WORDS = new Set(["word", "string", "raw_string", "ansi_c_string", "concatenation", "simple_expansion", "expansion", "command_substitution",
  "process_substitution", "arithmetic_expansion", "number", "variable_assignment", "extglob_pattern", "brace_expression", "translated_string"]);

// A word as { text, dynamic }: its quotes taken off, as the shell reads it, and whether it is filled when it runs.
function wordOf(node, back) {
  const word = { text: "", dynamic: false };
  part(node, word);
  word.text = back(word.text);
  word.dynamic ||= MARKED.test(textOf(node)) || /%\w+%/u.test(word.text);
  return word;
}
const textOf = node => node.text;
const FILLED = new Set(["simple_expansion", "expansion", "command_substitution", "process_substitution", "arithmetic_expansion", "brace_expression", "extglob_pattern", "ansi_c_string"]);
function part(node, word) {
  const t = node.type;
  if (FILLED.has(t)) { word.text += node.text; word.dynamic = true; return; }
  if (t === "raw_string") { word.text += node.text.slice(1, -1); return; }
  if (t === "string" || t === "translated_string") { doubleQuoted(node, word); return; }
  if (t === "concatenation" || t === "variable_assignment") { for (const c of node.children) part(c, word); return; }
  if (t === "word" || t === "number" || node.childCount === 0) { unquoted(node.text, word); return; }
  for (const c of node.children) part(c, word);
}
// A double-quoted string's letters: its escapes taken off, what it fills read as filled when it runs.
function doubleQuoted(node, word) {
  for (const [k, c] of node.children.entries()) {
    if (c.type === '"' || (c.type === "$" && k === 0)) continue; // (the quotes, and the $ of $"…")
    if (c.type === "$") { word.text += "$"; word.dynamic = true; continue; }
    if (c.type === "string_content") word.text += c.text.replace(/\\(["\\$`])/gu, "$1").replace(/\\\n/gu, "");
    else part(c, word);
  }
}
// An unquoted word's letters: a "\" takes off what follows, but between two letters of a path, where it is kept; an
// unquoted "{", "*", "?" or "[" may be expanded when it runs.
function unquoted(text, word) {
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") {
      const next = text[i + 1] ?? "";
      word.text += /[\w.-]/u.test(next) && /[\w.-]/u.test(text[i - 1] ?? "") ? `\\${next}` : next === "\n" ? "" : next;
      i++;
    } else {
      word.text += c;
      if ("$`{*?[".includes(c)) word.dynamic = true;
    }
  }
}
