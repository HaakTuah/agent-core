// The functions of a file of C#, as the shape check reads them (shape-csharp.mjs, beside this file), read on the
// parser the core installs (parser.mjs; #529, the first of #530's ports): the grammar, not a lexer written here, tells
// what is code. It keeps the definition the lexer's reader had, word for word:
//   - a function is a method, a constructor, a finaliser, an operator, an accessor (get, set, init, add, remove), a
//     local function, a lambda and an anonymous method with a parameter list, each with a body in braces; a member
//     written with => alone is no block, and not one;
//   - its name is its own (a constructor's, its type's; an operator's "operator", or a conversion's, the last word of
//     its type), an accessor's keyword, and a lambda's, the name it is assigned to (`f = x => { }`), else
//     "(anonymous)";
//   - its lines run from the line of its body's { to that of its };
//   - its depth is the deepest its control blocks nest: the block of an if, else, for, foreach, while, do, switch, try,
//     catch, finally, using, lock, fixed, unsafe, checked and unchecked, each inside the control block it lies in;
//   - it branches at each if, loop (for, foreach, while), case, catch and arm of a switch expression, and each and
//     (&&), or (||, ??, ??=) and choice (? :).
// A function inside another is measured on its own. The lines the lexer reads as the preprocessor's (`directives`)
// are blank to the parser, so that it reads both sides of an #if as code, as the lexer did. It never guesses: a file
// the grammar cannot read whole (C# newer than the grammar the core installs, or no C#), or cannot read in time, has no
// functions told, and the shape check counts it and says so, and fails one a pull request brings (shape.mjs, "lost").
// Proven old against new by tests/shape-readers-test.mjs, and against counts taken by hand.
import { inParser } from "./parser.mjs";
import { LARGEST, walkFunctions } from "./tree-walk.mjs";

/** The functions of `src`: [{ name, line, lines, depth, branches }], in the order their bodies open; null where they
 *  cannot be told. `directives`, the lines (from 1) the preprocessor holds. Read in the parser's thread (read, below). */
export function csharpFunctions(src, directives = []) {
  if (src.length > LARGEST) return null;
  try { return inParser(import.meta.url, "read", src, directives); } catch (e) {
    if (e?.kind === "read") return null;
    // (the load's own mend where it gives one, packages.mjs's, which in a job names the install step: #719)
    if (e?.kind === "load") throw new Error(`The parser or C#'s grammar could not be loaded: ${/ Mend: /u.test(e.message) ? e.message : `${e.message}. Mend: run node core/scripts/install.mjs parser (in the core, scripts/install.mjs parser), which installs the parser's packages from its lock file, then run the check again`}`);
    throw e;
  }
}

// The statements whose block is a control block, and the field it stands in (null: a block among its children).
const CONTROL = {
  if_statement: ["consequence", "alternative"], while_statement: ["body"], do_statement: ["body"], for_statement: ["body"],
  foreach_statement: ["body"], try_statement: ["body"], catch_clause: ["body"], finally_clause: null, using_statement: ["body"],
  lock_statement: null, fixed_statement: null, unsafe_statement: null, checked_statement: null,
};
const OPERATORS = new Set(["&&", "||", "??"]);
const WORD = /^@?[A-Za-z_\u0080-\uffff][\w\u0080-\uffff]*$/u;

/** The functions of `src`, read with the parser's `parse` (in its thread: csharpFunctions, above). */
export function read(parse, src, directives) {
  const lines = src.split("\n"), blank = new Set(directives);
  let text = blank.size ? lines.map((l, k) => (blank.has(k + 1) ? l.replace(/[^\r]/gu, " ") : l)).join("\n") : src;
  let tree = parse("csharp", text);
  try {
    const headers = /\bextension\s*[<(]/u.test(text) ? extensionHeaders(text, tree.rootNode) : [];
    if (headers.length) { text = asTypes(text, headers); tree.delete(); tree = parse("csharp", text); }
    if (tree.rootNode.hasError) return null;
    const before = leafBefore(tree.rootNode);
    return walkFunctions(tree.rootNode, { functionBody, nameOf: node => nameOf(node, before), branches, isControl });
  } finally { tree.delete(); }
}

// C# 14's extension blocks (`extension<T>(T x) where T : U { members }`), which the grammar installed predates and reads
// as a constructor, or as no code: where a member of a type opens with the word `extension` and its parameters, and its
// header reaches a { with no ; or } before it, that header is read as a type's (`class _`), the same length and its
// line breaks kept, so that the members inside are read as a type's are, and the block itself is no function, as the
// language makes it none. Each header's [start, end) in the text.
function extensionHeaders(text, root) {
  const found = [], all = leaves(root), own = outermost(typesNamedExtension(text, root));
  let at = 0;
  for (let k = 0; k < all.length; k++) {
    const node = all[k];
    if (node.type !== "identifier" || node.text !== "extension" || !["{", "}", ";", "]"].includes(all[k - 1]?.type)) continue;
    // (in a type named extension, `extension(...) { }` is its constructor, never a block of C# 14's; the leaves come
    // in the text's order, so the bodies are passed by once each)
    while (at < own.length && own[at][1] <= node.startIndex) at++;
    if (at < own.length && node.startIndex > own[at][0] && node.startIndex < own[at][1]) continue;
    const end = headerEnd(text, node.endIndex);
    if (end !== null) found.push([node.startIndex, end]);
  }
  // (where code that does not build gives two headers that overlap, the later goes)
  let reached = 0;
  return found.sort((a, b) => a[0] - b[0]).filter(([start, end]) => start >= reached && (reached = end) >= 0);
}

// Spans [start, end) as a word strictly inside one of them reads them, in the text's order and none inside another: a
// body inside another adds nothing, and two that touch are kept apart, since where one ends and the next begins is in
// neither.
function outermost(spans) {
  const out = [];
  for (const [start, end] of spans.sort((a, b) => a[0] - b[0])) {
    const last = out.at(-1);
    if (last && start < last[1]) last[1] = Math.max(last[1], end); else out.push([start, end]);
  }
  return out;
}

// The bodies of the types the file names `extension` ([start, end) in the text), found only where its text declares
// one: a type of that name may hold a constructor that looks like an extension block's header.
const TYPES = new Set(["class_declaration", "struct_declaration", "record_declaration", "record_struct_declaration"]);
function typesNamedExtension(text, root) {
  if (!/\b(?:class|struct|record)\s+@?extension\b/u.test(text)) return [];
  const out = [], stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (TYPES.has(node.type) && node.childForFieldName("name")?.text.replace(/^@/u, "") === "extension") {
      const body = node.childForFieldName("body");
      if (body) out.push([body.startIndex, body.endIndex]);
    }
    for (const c of node.children) stack.push(c);
  }
  return out;
}

// Where an extension block's header, from just after its word, ends at the { of its body: its type parameters and
// parameters, balanced, then its constraints; null where a ; } = or the text's end comes first, or no ( does, or none
// ends within HEADER characters (so that a text of many headers that never end is read in time linear in its length).
const HEADER = 2000;
function headerEnd(text, from) {
  let depth = 0, params = false;
  for (let k = from; k < Math.min(text.length, from + HEADER); k++) {
    const c = text[k];
    if (c === "(" || c === "<") { depth++; if (c === "(") params = true; } else if (c === ")" || c === ">") depth--;
    else if (depth === 0 && c === "{") return params ? k : null;
    else if (depth === 0 && (c === ";" || c === "}" || c === "=")) return null;
    if (depth < 0) return null;
  }
  return null;
}

// The text with each header read as a type's: `class _`, then spaces, its line breaks kept.
function asTypes(text, headers) {
  let out = "", at = 0;
  for (const [start, end] of headers) {
    const part = text.slice(start, end), head = "class _";
    out += text.slice(at, start) + head + part.slice(head.length).replace(/[^\r\n]/gu, " ");
    at = end;
  }
  return out + text.slice(at);
}


// The body in braces of a node that is a function, else null.
function functionBody(node) {
  const t = node.type;
  if (t === "anonymous_method_expression") return node.childForFieldName("parameters") ? node.children.find(c => c.type === "block") ?? null : null;
  if (!["method_declaration", "constructor_declaration", "destructor_declaration", "operator_declaration", "conversion_operator_declaration", "accessor_declaration", "local_function_statement", "lambda_expression"].includes(t)) return null;
  const body = node.childForFieldName("body");
  return body?.type === "block" ? body : null;
}

// Whether a node is a control block: a block in a control statement's place for one, or a switch statement's braces.
function isControl(node, parent) {
  if (node.type === "switch_body") return true;
  if (node.type !== "block") return false;
  const fields = parent && CONTROL[parent.type];
  if (fields === undefined || !parent) return false;
  return fields === null || fields.some(f => parent.childForFieldName(f)?.id === node.id);
}

// How many branches a node is.
function branches(node) {
  switch (node.type) {
    case "if_statement": case "while_statement": case "do_statement": case "for_statement": case "foreach_statement":
    case "catch_clause": case "switch_expression_arm": case "conditional_expression": return 1;
    case "switch_section": return node.children.filter(c => c.type === "case").length;
    case "binary_expression": return OPERATORS.has(node.childForFieldName("operator")?.type) ? 1 : 0;
    case "assignment_expression": return node.childForFieldName("operator")?.type === "??=" ? 1 : 0;
    default: return 0;
  }
}

// A function's name.
function nameOf(node, before) {
  const t = node.type, plain = n => n.text.replace(/^@/u, "");
  if (t === "accessor_declaration") return plain(node.childForFieldName("name"));
  if (t === "anonymous_method_expression") return "(anonymous)";
  if (t === "lambda_expression") return lambdaName(node, before);
  if (t === "operator_declaration") { const op = node.childForFieldName("operator")?.type; return op === "true" || op === "false" ? op : "operator"; }
  if (t === "conversion_operator_declaration") return typeWord(node.childForFieldName("type")) ?? "operator";
  return plain(node.childForFieldName("name"));
}

// The word a conversion is named by: its type's last name, type arguments passed over (`List<T>` is List); null for a
// type that ends in another sign (`int?`, `int[]`, a tuple).
function typeWord(type) {
  let at = type;
  if (at?.type === "qualified_name") at = at.childForFieldName("name");
  if (at?.type === "generic_name") at = at.namedChildren.find(c => c.type === "identifier");
  return at && WORD.test(at.text) ? at.text.replace(/^@/u, "") : null;
}

// A lambda's name: the word that `=` assigns it to, before its parameters (async passed over), else "(anonymous)".
function lambdaName(node, before) {
  let at = before(node.childForFieldName("parameters"));
  if (at?.text === "async") at = before(at);
  if (at?.type !== "=") return "(anonymous)";
  const word = before(at);
  return word && WORD.test(word.text) ? word.text.replace(/^@/u, "") : "(anonymous)";
}

// The leaves of the tree under `root` in the order the text holds them, comments passed over: walked once with a
// stack of its own, so that no chain of nodes, however long or deep, is climbed again for each leaf.
function leaves(root) {
  const out = [], stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (node.type === "comment") continue;
    const children = node.children;
    if (!children.length) { out.push(node); continue; }
    for (let k = children.length - 1; k >= 0; k--) stack.push(children[k]);
  }
  return out;
}

// The leaf just before a node, comments passed over, by the leaves of the tree under `root`, listed the first time a
// function's name asks for it (null at the file's start).
function leafBefore(root) {
  let index = null;
  return node => {
    if (!index) { const all = leaves(root); index = new Map(all.map((leaf, k) => [leaf.id, all[k - 1] ?? null])); }
    let first = node;
    while (first.childCount) first = first.child(0);
    return index.get(first.id) ?? null;
  };
}
