// The functions of a file of Python, as the shape check reads them (shape-python.mjs, beside this file), read on the
// parser the core installs (parser.mjs; #530, item 6): the grammar, not the lexer written here before it, tells what is
// code. It keeps the definition that lexer's reader had:
//   - a function is one a def opens, async or not; a lambda is none;
//   - its name is the def's;
//   - its lines run from its def's line to its body's last line of code, a comment after it no part of it;
//   - its depth is the deepest its control blocks nest: the block of an if, elif, else, for, while, try, except,
//     finally, with and case, each inside the control block it lies in (a match is its case's one level, as a switch
//     is in JavaScript);
//   - it branches at each if, elif, for, while, except and case, and each and, or, a comprehension's for and if, and
//     choice (a if b else c) of its code, an f-string's too; what stands outside its body, a default of its parameters,
//     a decorator, counts where the function itself stands.
// A function inside another is measured on its own. Where the lexer misread, the grammar reads as the definition says
// (tests/shape-readers-test.mjs holds each such case), and where the grammar misreads, the reader mends it from the tree
// (signsInFormats, below). It never guesses: a file the grammar cannot read whole (Python
// newer than the grammar the core installs, or no Python), or cannot read within its time, has no functions told, and
// the shape check counts it and says so (shape.mjs, "lost").
import { inParser } from "./parser.mjs";
import { LARGEST, walkFunctions } from "./tree-walk.mjs";

/** The functions of `src`: [{ name, line, lines, depth, branches }], in the order their bodies open; null where they
 *  cannot be told. Read in the parser's thread (read, below). */
export function pythonFunctions(src) {
  if (src.length > LARGEST) return null;
  try { return inParser(import.meta.url, "read", src); } catch (e) {
    if (e?.kind === "read") return null;
    // (the load's own mend where it gives one, packages.mjs's, which in a job names the install step: #719)
    const mended = / Mend: /u.test(e?.message ?? "");
    if (e?.kind === "load") throw new Error(`The parser or Python's grammar could not be loaded: ${mended ? e.message : `${e.message}. Mend: run node core/scripts/install.mjs parser (in the core, scripts/install.mjs parser), which installs the parser's packages from its lock file, then run this again`}`);
    throw e;
  }
}

// (how long the grammar may take on one file, in milliseconds, as JavaScript's reader gives it: a second and 4 more for
// each thousand characters)
const budgetOf = src => 1000 + src.length / 250;

/** The functions of `src`, read with the parser's `parse` (in its thread: pythonFunctions, above). */
export function read(parse, src) {
  const tree = parse("python", src, budgetOf(src));
  if (!tree) return null;
  try { return tree.rootNode.hasError && !signsInFormats(tree.rootNode) ? null : walkFunctions(tree.rootNode, { functionBody, nameOf, branches, isControl, rowsOf }); } finally { tree.delete(); }
}

// Whether every error the grammar met under `root` lies in an f-string's { } and is signs alone, nothing it had to take
// as missing: the grammar installed reads a format's fill of = as the := of an assignment (`f"{title:=^80}"`), and
// stops at the sign after it. What stands in { } is one expression, which can open no def and no block, and a sign is
// no word, so no branch (if, for, and, or); the functions around it are told as the definition says. Any other error
// loses the file.
const WORD = /[A-Za-z_]/u;
function signsInFormats(root) {
  const stack = [[root, false]];
  while (stack.length) {
    const [node, inFormat] = stack.pop();
    if (node.isMissing) return false;
    if (node.isError) { if (!inFormat || WORD.test(node.text)) return false; continue; }
    for (const c of node.children) if (c.hasError || c.isMissing) stack.push([c, inFormat || node.type === "interpolation"]);
  }
  return true;
}

// The statements and clauses whose block is a control block: each holds one block, its body.
const CONTROL = new Set(["if_statement", "elif_clause", "else_clause", "for_statement", "while_statement", "try_statement", "except_clause", "finally_clause", "with_statement", "case_clause"]);
const BRANCHING = new Set(["if_statement", "elif_clause", "for_statement", "while_statement", "except_clause", "case_clause", "boolean_operator", "for_in_clause", "if_clause", "conditional_expression"]);

const functionBody = node => (node.type === "function_definition" ? node.childForFieldName("body") : null);
const isControl = (node, parent) => node.type === "block" && !!parent && CONTROL.has(parent.type);
const branches = node => (BRANCHING.has(node.type) ? 1 : 0);
const nameOf = node => node.childForFieldName("name")?.text ?? "(anonymous)";
// (from the def's line, async's where it has one, to the last row of code its body holds)
const rowsOf = (node, body) => [node.startPosition.row, lastCode(body)];

// The last row of `node` that holds code: a comment at a block's end, which the grammar keeps in the block, is none.
function lastCode(node) {
  let at = node;
  for (;;) {
    const children = at.children.filter(c => c.type !== "comment");
    if (!children.length) return at.endPosition.row;
    at = children.at(-1);
  }
}
