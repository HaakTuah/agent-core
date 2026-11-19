// The functions of a file of JavaScript or TypeScript, JSX among them, as the shape check and the measures read them
// (shape-readers.mjs and code-shape.mjs, beside this file), read on the parser the core installs (parser.mjs; #530, item
// 6; #723): the grammar, not the lexer written here before it, tells what is code. It keeps the definition that
// lexer's reader had:
//   - a function is one with a body in braces: a function's declaration or expression, a generator, a method, a getter
//     or setter, a constructor, and an arrow function whose body is a block; an arrow whose body is an expression is no
//     block, and not one;
//   - its name is its own, else the name it is given where it stands: a variable's, a property's or a class field's it
//     is assigned to (`f = () => { }`, `a.f = function () { }`, `{ f: () => { } }`), a parameter's whose default it is,
//     else "(anonymous)";
//   - its lines run from the line of its body's { to that of its };
//   - its depth is the deepest its control blocks nest: the block of an if, else, for, while, do, with, switch, try,
//     catch and finally, each inside the control block it lies in;
//   - it branches at each if, loop (for, for in and of, while, do), case and catch, and each and (&&, &&=), or (||,
//     ||=, ??, ??=) and choice (? :) of its code; what stands outside its body, a default of its parameters, counts
//     where the function itself stands.
// A function inside another is measured on its own. Where the lexer misread, the grammar reads as the definition says
// (tests/code-shape-test.mjs holds each such case): a method named by a string or a computed key is a function; a
// return type written as an object's type no longer hides the function after it; a choice of TypeScript's types
// (`T extends U ? X : Y`) and an optional method's mark are no branch of the code; a function given to a variable that
// has a type is named by the variable, not the type. It never guesses: a file the grammar cannot read whole (code the
// grammar the core installs does not know, or no JavaScript), or cannot read within its time, has no functions told, and
// the shape check counts it and says so (shape.mjs, "lost").
import path from "node:path";
import { inParser } from "./parser.mjs";

// The grammar each file is read with, by its extension: TypeScript's own (where <T>x is a cast), TypeScript with JSX,
// and JavaScript, whose grammar reads JSX wherever it stands.
const GRAMMAR = { ".ts": "typescript", ".mts": "typescript", ".cts": "typescript", ".tsx": "tsx" };
export const grammarOf = file => GRAMMAR[path.posix.extname(file)] ?? "javascript";

/** The functions of `src`, the text of `file`: [{ name, line, lines, depth, branches }], in the order their bodies
 *  open; null where they cannot be told. Read in the parser's thread (read, below). */
export function javascriptFunctions(file, src) {
  try { return inParser(import.meta.url, "read", grammarOf(file), src); } catch (e) {
    if (e?.kind === "read") return null;
    // (the load's own mend where it gives one, packages.mjs's, which in a job names the install step: #719; tested apart
    // from the message, since the mutation tool's lexer misreads a regular expression inside a template literal)
    const mended = / Mend: /u.test(e?.message ?? "");
    if (e?.kind === "load") throw new Error(`The parser or JavaScript's grammars could not be loaded: ${mended ? e.message : `${e.message}. Mend: run node core/scripts/install.mjs parser (in the core, scripts/install.mjs parser), which installs the parser's packages from its lock file, then run this again`}`);
    throw e;
  }
}

// (how long the grammar may take on one file, in milliseconds, a second and 4 more for each thousand characters: it
// reads JavaScript in time in step with its size, about 1 ms for each thousand characters, and the core's largest file
// in a few; its recovery from text that is no JavaScript grows faster than the text, a line of 300,000 "/[" past two
// minutes. A file it cannot read within it has no functions told)
const budgetOf = src => 1000 + src.length / 250;

/** The functions of `src`, read with the parser's `parse` and the grammar named (in its thread: javascriptFunctions). */
export function read(parse, grammar, src) {
  const tree = parse(grammar, src, budgetOf(src));
  if (!tree) return null;
  try { return tree.rootNode.hasError && !wordsAlone(tree.rootNode) ? null : walk(tree.rootNode); } finally { tree.delete(); }
}

// Whether every error the grammar met under `root` is a word it does not know, nothing else: no sign in it and nothing
// it had to take as missing. TypeScript's newer modifiers and keywords (`export type *`, a type's parameter marked `in`
// or `out`), which the grammar the core installs predates, are such words; a word can neither open nor close a block,
// so the functions around it are told as the definition says. Any other error loses the file.
const WORD = /^[A-Za-z_$][\w$]*$/u;
function wordsAlone(root) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (node.isMissing) return false;
    if (node.isError) { if (!leavesOf(node).every(leaf => WORD.test(leaf.text))) return false; continue; }
    for (const c of node.children) if (c.hasError) stack.push(c);
  }
  return true;
}
function leavesOf(node) {
  const out = [], stack = [node];
  while (stack.length) { const n = stack.pop(); if (n.childCount) stack.push(...n.children); else out.push(n); }
  return out;
}

// The statements whose block is a control block, and the field it stands in (null: the block among its children).
const CONTROL = {
  if_statement: "consequence", else_clause: null, for_statement: "body", for_in_statement: "body", while_statement: "body",
  do_statement: "body", with_statement: "body", try_statement: "body", catch_clause: "body", finally_clause: "body",
};
const FUNCTIONS = new Set(["function_declaration", "generator_function_declaration", "function_expression", "generator_function", "arrow_function", "method_definition"]);
const BRANCHING = new Set(["if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement", "catch_clause", "switch_case", "ternary_expression"]);
const OPERATORS = new Set(["&&", "||", "??"]), ASSIGNED = new Set(["&&=", "||=", "??="]);

// The walk, with a stack of its own so that no nesting runs out of the call stack: each item a node, its parent, the
// function it counts toward (null outside any) and the level of control blocks it stands at. (The parent is carried,
// not asked of the node: the parser finds it from the file's root, at a cost that grows with how deep it lies.)
function walk(root) {
  const found = [], stack = [{ node: root, parent: null, fn: null, level: 0 }];
  while (stack.length) {
    const { node, parent, fn, level } = stack.pop();
    const body = functionBody(node);
    if (body) {
      const own = { name: nameOf(node, parent), line: body.startPosition.row + 1, lines: body.endPosition.row - body.startPosition.row + 1, depth: 0, branches: 0 };
      found.push([body.startIndex, own]);
      // (what stands outside its body, a default of its parameters, counts where the function itself stands)
      for (const c of [...node.children].reverse()) push(stack, c.id === body.id ? null : c, node, fn, level);
      push(stack, body, node, own, 0);
      continue;
    }
    if (fn) fn.branches += branches(node);
    const inner = isControl(node, parent) ? level + 1 : level;
    if (fn && inner > level) fn.depth = Math.max(fn.depth, inner);
    // (all of a node's children at once: one by one, each costs as many steps as the children before it)
    const children = node.children;
    for (let k = children.length - 1; k >= 0; k--) push(stack, children[k], node, fn, inner);
  }
  // (in the order their bodies open, as a baseline numbers functions of one name)
  return found.sort((a, b) => a[0] - b[0]).map(([, fn]) => fn);
}
const push = (stack, node, parent, fn, level) => { if (node) stack.push({ node, parent, fn, level }); };

// The body in braces of a node that is a function, else null.
function functionBody(node) {
  if (!FUNCTIONS.has(node.type)) return null;
  const body = node.childForFieldName("body");
  return body?.type === "statement_block" ? body : null;
}

// Whether a node is a control block: a block in a control statement's place for one, or a switch statement's braces.
function isControl(node, parent) {
  if (node.type === "switch_body") return true;
  if (node.type !== "statement_block" || !parent || !Object.hasOwn(CONTROL, parent.type)) return false;
  const field = CONTROL[parent.type];
  return field === null || parent.childForFieldName(field)?.id === node.id;
}

// How many branches a node is.
function branches(node) {
  if (BRANCHING.has(node.type)) return 1;
  if (node.type === "binary_expression") return OPERATORS.has(node.childForFieldName("operator")?.type) ? 1 : 0;
  if (node.type === "augmented_assignment_expression") return ASSIGNED.has(node.childForFieldName("operator")?.type) ? 1 : 0;
  return 0;
}

// A function's name: its own, else the one it is given where it stands (`parent`), else "(anonymous)".
function nameOf(node, parent) {
  const own = node.childForFieldName("name");
  if (own) return keyName(own);
  const given = givenName(node, parent);
  return given ? keyName(given) : "(anonymous)";
}

// The node that names a function by where it stands: the variable, property, class field or parameter it is the value
// of; a member's property where it is assigned to one. Null where none is.
function givenName(node, parent) {
  const t = parent?.type;
  if (t === "variable_declarator") return parent.childForFieldName("value")?.id === node.id ? parent.childForFieldName("name") : null;
  if (t === "pair") return parent.childForFieldName("value")?.id === node.id ? parent.childForFieldName("key") : null;
  if (t === "public_field_definition" || t === "field_definition") return parent.childForFieldName("value")?.id === node.id ? parent.childForFieldName("name") ?? parent.childForFieldName("property") : null;
  if (t !== "assignment_expression" && t !== "assignment_pattern" && t !== "object_assignment_pattern") return null;
  if (parent.childForFieldName("right")?.id !== node.id) return null;
  const left = parent.childForFieldName("left");
  return left?.type === "member_expression" ? left.childForFieldName("property") : left;
}

// The name a node gives: a word as written (a private one with its #), a string's text; "(anonymous)" for anything
// else (a computed key, a pattern, an element of an array).
function keyName(node) {
  if (["identifier", "property_identifier", "private_property_identifier", "shorthand_property_identifier_pattern", "type_identifier"].includes(node.type)) return node.text;
  if (node.type === "string") return node.text.slice(1, -1);
  return "(anonymous)";
}
