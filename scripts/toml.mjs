// A reader of TOML for what the core's checks read in a project's own files, Codex's `.codex/config.toml` first
// (agent-tools.mjs): the `smol-toml` package carried in third-party/ reads it (#530), and this module gives what it read
// as JSON would hold it: true and false as booleans, a whole number JavaScript holds exactly as a number, and any other
// number or a date as text, which no check here reads. Text the package cannot read as TOML, a key given twice
// included, is refused, as the tool that reads the file refuses it, and so is a value nested deeper than guards.mjs's
// DEEPEST, so that what reads it after never runs out of stack.
//
//   import { parseToml } from "./toml.mjs";   parseToml(text) -> an object, or throws a SyntaxError naming the line, or,
//                                             where the whole nests too deep, saying so of the file
import { parse, TomlDate, TomlError } from "../third-party/smol-toml/dist/index.cjs";
import { DEEPEST, tooDeep } from "./guards.mjs";

// (a key set as a plain property, never through a setter: "__proto__" is a key like any other)
const put = (table, key, value) => Object.defineProperty(table, key, { value, enumerable: true, writable: true, configurable: true });

export function parseToml(text) {
  let read;
  try { read = parse(String(text), { integersAsBigInt: true, maxDepth: DEEPEST }); } catch (e) {
    if (!(e instanceof TomlError)) throw new SyntaxError(`the file cannot be read as TOML (${String(e?.message ?? e).split("\n")[0]})`);
    const what = e.message.split("\n")[0].replace(/^Invalid TOML document: /u, "");
    throw new SyntaxError(`line ${e.line}: ${/excessively nested/u.test(what) ? `a value nests deeper than ${DEEPEST}` : what}`);
  }
  const root = plain(read);
  // (the package counts its depth its own way: the whole is counted once more, as guards.mjs counts JSON)
  if (tooDeep(root)) throw new SyntaxError(`the file nests deeper than ${DEEPEST} tables and arrays`);
  return root;
}

// A value the package read, as JSON would hold it (above), walked with a stack of its own, never by recursion.
function plain(value) {
  const top = { out: undefined };
  const stack = [[value, top, "out"]];
  while (stack.length) {
    const [v, into, key] = stack.pop();
    if (Array.isArray(v)) {
      const out = new Array(v.length);
      put(into, key, out);
      for (let k = v.length - 1; k >= 0; k--) stack.push([v[k], out, k]);
    } else if (v !== null && typeof v === "object" && !(v instanceof TomlDate)) {
      const out = {};
      put(into, key, out);
      // (each table's keys put in the order they were written, as the stack gives them back)
      for (const k of Object.keys(v).reverse()) stack.push([v[k], out, k]);
    } else put(into, key, scalar(v));
  }
  return top.out;
}

// A whole number JavaScript holds exactly as a number; any other number, or a date, as TOML writes it.
function scalar(v) {
  if (typeof v === "bigint") return Number.isSafeInteger(Number(v)) ? Number(v) : String(v);
  if (typeof v === "number") return Number.isNaN(v) ? "nan" : v === Infinity ? "inf" : v === -Infinity ? "-inf" : Number.isInteger(v) ? v.toFixed(1) : String(v);
  if (v instanceof TomlDate) return v.toISOString();
  return v;
}
