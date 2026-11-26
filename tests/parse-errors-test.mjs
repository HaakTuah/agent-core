// Holds that a parse error the core prints names where, not what (#1333): the kind of fault and its line and column,
// never text of the input. The readers, each given texts that are no JSON, YAML or TOML and that hold a mark, refuse
// them in parseFault's form (scripts/guards.mjs) with the mark nowhere in what they say, at the fault's own place; and
// every JSON.parse of scripts/ (read on the parser the core installs, scripts/parser.mjs, so a call is told from text
// that names one) stands where its error is never printed: in a try whose catch reads nothing of the error but its kind
// (instanceof, .code, .name), else it is parseBounded, which words it so. On Linux and on Windows. Node's own modules,
// the parser, and the YAML and TOML packages the core installs. It holds too that the JSON the core reads has no key
// twice in one object (scripts/json-keys.mjs; #1367), which JSON.parse would read as the last alone: the check's cases, and
// each JSON file git tracks here.
//
//   node tests/parse-errors-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEEK, parseBounded } from "../scripts/guards.mjs";
import { load } from "../scripts/parser.mjs";
import { LARGEST, budgetOf, parseWithin } from "../scripts/tree-walk.mjs";
import { parseToml } from "../scripts/toml.mjs";
import { parseYaml } from "../scripts/parse-yaml.mjs";
import { duplicateKeys, failuresOf, trackedJson } from "../scripts/json-keys.mjs";
import { mended } from "../scripts/mend.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 600).replace(/\n/g, "\n     ")}`}`); } };
const root = fileURLToPath(new URL("..", import.meta.url));
const MARK = "Qz7mark";
const FORM = /^[a-z][^\n]* at line \d+, column \d+$/u;
const said = (read, text) => { try { read(text); return null; } catch (e) { return String(e?.message); } };

// (each: the text, and the line and column of its fault)
const JSON_CASES = [
  [`{"a": ${MARK}}`, 1, 7], [`{"key": "${MARK}"`, 1, 18], [`{\n  "a": 1,\n  "b": ${MARK}\n}`, 3, 8], [`["${MARK}" 2]`, 1, 12],
  [`{"${MARK}": 1}x${MARK}`, 1, 15], [`{"a": "${MARK}\u0001"}`, 1, 15], [`﻿{"${MARK}": 1}`, 1, 1], [`[1,\n"${MARK}",`, 2, 11],
  [`{"a": tru${MARK}}`, 1, 10], [`{"a": -${MARK}}`, 1, 8], [`{\r"${MARK}" 1}`, 2, 11], [`{\r\n"${MARK}" 1}`, 2, 11],
  [`{\r\r\n"${MARK}" 1}`, 3, 11], [`[1,\r${MARK}]`, 2, 1], [`{"a": 1} ${MARK} at position 2`, 1, 10],
  // (short enough that V8 quotes them whole, its words then standing in the quote: only its own offset is read)
  ["nope at position 999", 1, 2], ["[x at position 9]", 1, 2], ["[1,\nx at position 3 (line 1 column 4)]", 2, 1],
];
for (const [text, line, col] of JSON_CASES) {
  const m = said(parseBounded, text);
  ok(m !== null && FORM.test(m) && !m.includes(MARK) && m.endsWith(`at line ${line}, column ${col}`), `a text that is no JSON is refused by its kind and place alone: ${JSON.stringify(text)}`, m);
}
ok(said(parseBounded, "") === "unexpected end of input at line 1, column 1", "an empty text is refused as one that ends early", said(parseBounded, ""));
ok(/^it nests deeper than \d+ objects and lists$/u.test(said(parseBounded, "[".repeat(300) + "]".repeat(300))), "a text nested too deep is still refused so");
ok(JSON.stringify(parseBounded(`{"a":[1,"${MARK}"]}`)) === `{"a":[1,"${MARK}"]}`, "JSON is read as JSON.parse reads it");
// (a long text whose fault V8 gives no offset for is refused before the place is sought, so in the time of one parse,
// and one of SEEK characters still has its place)
{
  const long = n => `[${'"a",'.repeat(Math.ceil(n / 4))}${MARK}]`;
  const m = said(parseBounded, long(4 * SEEK));
  ok(m === `unexpected character, its place not sought in a text past ${SEEK} characters`, "a text past SEEK is refused by its kind alone, its place not sought", m);
  const text = long(SEEK - 20), at = text.length - MARK.length;
  ok(text.length <= SEEK && said(parseBounded, text) === `unexpected character at line 1, column ${at}`, "a text of SEEK characters at most has its place", said(parseBounded, text));
}
// (where V8 names a character and no offset, the place is found by parsing the text's starts: it is the first of them
// that fails other than by ending early, for any text)
{
  const signs = "{}[]:,\"tfnrue01-.eE \\\n\r";
  let wrong = null;
  for (let i = 0; i < 4000 && !wrong; i++) {
    let s = "";
    for (let j = 1 + (i % 12); j > 0; j--) s += signs[(i * 7919 + j * 104729 + j * j * 31) % signs.length];
    let k = 1, message;
    try { JSON.parse(s); continue; } catch (e) { message = e.message; }
    if (!/^Unexpected token/u.test(message)) continue;
    for (; k <= s.length; k++) {
      try { JSON.parse(s.slice(0, k)); } catch (e) { const at = / at position (\d+)/u.exec(e.message); if (!/^Unexpected end/u.test(e.message) && (!at || Number(at[1]) < k)) break; }
    }
    const lines = s.slice(0, k - 1).split(/\r\n|\r|\n/u), place = `at line ${lines.length}, column ${lines.at(-1).length + 1}`;
    const m = said(parseBounded, s);
    if (!m.endsWith(place)) wrong = `${JSON.stringify(s)}: ${m}, not ${place}`;
  }
  ok(!wrong, "where V8 names no offset, the place is the fault's own", wrong ?? "");
}
// (where V8 gives a line and column, the place is V8's own, whatever ends its lines: CRLF, CR or LF)
{
  const signs = "{}[]:,\"tfn01 \n\r";
  let wrong = null, seen = 0;
  for (let i = 0; i < 4000 && !wrong; i++) {
    let s = "";
    for (let j = 2 + (i % 14); j > 0; j--) s += signs[(i * 6151 + j * 92821 + j * j * 17) % signs.length];
    let v8;
    try { JSON.parse(s); continue; } catch (e) { v8 = /\(line (\d+) column (\d+)\)/u.exec(e.message); }
    if (!v8 || !/[\r\n]/u.test(s)) continue;
    seen++;
    const m = said(parseBounded, s);
    if (!m.endsWith(`at line ${v8[1]}, column ${v8[2]}`)) wrong = `${JSON.stringify(s)}: ${m}, not line ${v8[1]} column ${v8[2]}`;
  }
  ok(!wrong && seen > 100, `where V8 gives a line and column, the place is V8's own (${seen} texts with line breaks)`, wrong ?? seen);
}

for (const [text, kind, line, col] of [
  [`a: ${MARK}\n${MARK}: 2\na: 3\n`, "duplicate key", 3, 1], [`x: "${MARK}\\q"\n`, "bad dq escape", 1, 12],
  [`---\na: ${MARK}\n---\nb: 2\n`, "multiple docs", 3, 1], [`a: ${MARK}: c\n`, "block as implicit key", 1, 4], [`a: [${MARK}\n`, null, 2, 1],
]) {
  let e = null;
  try { parseYaml(text); } catch (x) { e = x; }
  const m = String(e?.message);
  ok(FORM.test(m) && !m.includes(MARK) && (!kind || m.startsWith(kind)) && m.endsWith(`at line ${line}, column ${col}`) && typeof e?.code === "string", `a text that is no YAML is refused by its kind and place alone, its code kept: ${JSON.stringify(text)}`, m);
}
for (const [text, line] of [[`a = ${MARK}\n`, 1], [`a = 1\n${MARK} = 1\n${MARK} = 2\n`, 3], [`a = "${MARK}\\q"\n`, 1], [`notify = ["python3", """${MARK}\\\n"""""]\n`, 1]]) {
  const m = said(parseToml, text);
  ok(m !== null && FORM.test(m) && !m.includes(MARK) && m.includes(`at line ${line}, column `), `a text that is no TOML is refused by its kind and place alone: ${JSON.stringify(text)}`, m);
}

// Every JSON.parse of scripts/: where its error is read, or leaves the function it stands in, it prints the text.
const FUNCTION = new Set(["function_declaration", "generator_function_declaration", "function_expression", "generator_function", "arrow_function", "method_definition"]);
// (the one place that reads V8's own message, to word it as parseFault does)
const SHAPER = { file: "scripts/guards.mjs", functions: new Set(["parseBounded", "jsonFaultAt"]) };
const inShaper = (call, file) => { for (let a = call.parent; a; a = a.parent) if (file === SHAPER.file && FUNCTION.has(a.type) && SHAPER.functions.has(nameOf(a))) return true; return false; };
const nameOf = fn => fn.childForFieldName("name")?.text ?? (fn.parent?.type === "variable_declarator" ? fn.parent.childForFieldName("name")?.text : null);
// Whether `body` (a catch's block) reads its error `name` for no more than its kind: `name instanceof X`, `name.code`
// or `name.name` (each with ?. too); any other use, `throw name` among them, may print it.
function kindAlone(body, name) {
  const stack = [body];
  while (stack.length) {
    const n = stack.pop();
    if (n.type === "identifier" && n.text === name) {
      const p = n.parent;
      if (p?.type === "binary_expression" && p.childForFieldName("left")?.id === n.id && p.childForFieldName("operator")?.text === "instanceof") continue;
      if (p?.type === "member_expression" && p.childForFieldName("object")?.id === n.id && ["code", "name"].includes(p.childForFieldName("property")?.text)) continue;
      return false;
    }
    stack.push(...n.children);
  }
  return true;
}
// Why the error of `call` may be printed, or null where it never is.
function printed(call, file) {
  if (inShaper(call, file)) return null;
  let prev = call;
  for (let a = call.parent; a; prev = a, a = a.parent) {
    if (FUNCTION.has(a.type)) return "its error leaves the function it stands in";
    if (a.type !== "try_statement" || a.childForFieldName("body")?.id !== prev.id) continue;
    const handler = a.childForFieldName("handler");
    if (!handler) continue;
    const param = handler.childForFieldName("parameter");
    if (!param) return null;
    if (param.type !== "identifier") return "its catch takes the error apart";
    return kindAlone(handler.childForFieldName("body"), param.text) ? null : "its catch reads the error";
  }
  return "its error leaves the script";
}
const parser = await load();
const files = fs.readdirSync(path.join(root, "scripts"), { recursive: true }).map(f => `scripts/${String(f).replaceAll("\\", "/")}`).filter(f => f.endsWith(".mjs")).sort();
const found = [], calls = { raw: 0 };
for (const file of files) {
  const src = fs.readFileSync(path.join(root, file), "utf8");
  if (!src.includes("JSON.parse")) continue;
  // (with the limits the core reads any JavaScript in: a file past them is not read, and fails here)
  const tree = src.length > LARGEST.javascript ? null : parseWithin(parser.parse, "javascript", src, budgetOf(src));
  if (!tree) { found.push(`${file}: too large, or too slow, for the parser to read within the limits of scripts/tree-walk.mjs, so its calls of JSON.parse are not read. Mend: split it into scripts of their own`); continue; }
  const stack = [tree.rootNode];
  while (stack.length) {
    const n = stack.pop();
    stack.push(...n.children);
    if (n.type !== "call_expression" || n.childForFieldName("function")?.text !== "JSON.parse") continue;
    calls.raw++;
    const why = printed(n, file);
    if (why) found.push(`${file}:${n.startPosition.row + 1}: a JSON.parse whose error may be printed (${why}), and V8's message quotes the text it read. Mend: call parseBounded (scripts/guards.mjs) there instead, which names the fault's kind and place alone`);
  }
  tree.delete();
}
ok(files.length > 100 && calls.raw > 50, `the scripts are read: ${files.length} files, ${calls.raw} calls of JSON.parse`, files.length);
ok(found.length === 0, "no JSON.parse of scripts/ has its error printed: each stands in a try whose catch reads only its kind, or is parseBounded", found.join("\n"));
// (the reader's own rule, read on texts made for it: each way an error leaves is found, and each catch that reads only
// its kind passes)
{
  const cases = [
    ["const a = JSON.parse(t);", "its error leaves the script"],
    ["function f(t) { return JSON.parse(t); }", "its error leaves the function it stands in"],
    ["try { JSON.parse(t); } catch (e) { console.log(e.message); }", "its catch reads the error"],
    ["try { JSON.parse(t); } catch (e) { throw e; }", "its catch reads the error"],
    ["try { JSON.parse(t); } catch ({ message }) { }", "its catch takes the error apart"],
    ["try { JSON.parse(t); } finally { }", "its error leaves the script"],
    ["try { [t].map(x => JSON.parse(x)); } catch { }", "its error leaves the function it stands in"],
    ["try { JSON.parse(t); } catch { }", null],
    ["try { JSON.parse(t); } catch (e) { if (e instanceof SyntaxError) return null; console.log(e?.code, e.name); }", null],
    ["try { try { JSON.parse(t); } finally { } } catch { }", null],
  ];
  const wrong = [];
  for (const [src, want] of cases) {
    const tree = parser.parse("javascript", src), stack = [tree.rootNode];
    let got;
    while (stack.length) { const n = stack.pop(); stack.push(...n.children); if (n.type === "call_expression" && n.childForFieldName("function")?.text === "JSON.parse") got = printed(n, "x.mjs"); }
    tree.delete();
    if (got !== want) wrong.push(`${src}: ${got}, not ${want}`);
  }
  ok(!wrong.length, "the reader tells each way a JSON.parse's error may be printed from a catch that reads only its kind", wrong.join("\n"));
}

// A key that stands twice in one object of a JSON file (#1367): each case is the text and the lines of the key's two places, or null
for (const [text, lines, what] of [
  ['{\n  "a": 1,\n  "b": 2,\n  "a": 3\n}\n', [2, 4], "a key twice, the lines of both"],
  ['{ "past": {\n"x": { "mark": 1 },\n"y": 1,\n"x": { "mark": 2 }\n} }', [2, 4], "a key twice inside a nested object"],
  ['{"a": 1, "\\u0061": 2}', [1, 1], "a key and the same key written with an escape"],
  ['{"a": {"k": 1}, "b": {"k": 2}}', null, "the same key in two objects"],
  ['[{"k": 1}, {"k": 2}]', null, "the same key in the objects of an array"],
  ['{"a": "a", "b": ["a", "b", "a"]}', null, "the same text as values"],
  ['{"a": "x\\"a\\": 1, \\"a\\"", "b": 1}', null, "a key written inside a value"],
  ['{"a": 1, "a": ', null, "a text that is no JSON, left to its readers"],
  ['{"k": {"a": 1, "a": 2}, "k2": 1}', [1, 1], "a key twice in an object that is a value"],
]) {
  const found = duplicateKeys(text);
  ok(lines === null ? found.length === 0 : found.length === 1 && found[0].first === lines[0] && found[0].again === lines[1], what, JSON.stringify(found));
}
{
  const says = failuresOf("twice.json", '{\n  "mark": 1,\n  "mark": 2\n}\n').join("\n");
  ok(says.includes('twice.json holds the key "mark" twice') && says.includes("lines 2 and 3") && mended(says), "a key twice is failed with its file, key, lines and mend", says);
  ok(failuresOf("long.json", `{"${"k".repeat(200)}": 1, "${"k".repeat(200)}": 2}`).join("\n").length < 700, "a long key is cut in what is said");
}
{
  const said = trackedJson().flatMap(f => failuresOf(f, fs.readFileSync(path.join(root, f), "utf8")));
  ok(said.length === 0, "no JSON file this repository tracks holds a key twice in one object", said.join("\n"));
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on how a parse error is worded`);
process.exit(failed ? 1 : 0);
