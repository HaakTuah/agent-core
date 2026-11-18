// The shape check's readers (shape.mjs, beside this file; tasks/code-shape.md, "What the check reads"; #354): which
// files it reads, and each file as its reader reads it, in one form whatever its language. JavaScript and TypeScript,
// JSX among them, by the reader of the measures (code-shape.mjs); C# by shape-csharp.mjs; Python by shape-python.mjs;
// and the scripts that share one global space, those of JavaScript or TypeScript with no import or export, by the
// names their top level declares. None runs the code it reads. Node's own modules only.
//
// Each reader has a name, which a baseline lists under "reads" once it lists what that reader finds: a baseline written
// before a reader came lists none of it, and what the pull request's base held of it is reported, never failed, until
// --write lists it (AGENTS.md, "Nothing locks a project").
import path from "node:path";
import { CODE, functions, globals, imports, isModule, isP, jsxIn, tokens } from "./code-shape.mjs";
import { OWN as CS_OWN, csharpIndex, csharpPackages, readCsharp, resolveCsharp } from "./shape-csharp.mjs";
import { OWN as PY_OWN, STDLIB, normal, pythonPackages, readPython, resolvePython } from "./shape-python.mjs";

// Each reader by its name, with what it reads, as a note says it.
export const READERS = {
  javascript: "JavaScript and TypeScript",
  jsx: "files that hold JSX",
  csharp: "C#",
  python: "Python",
  scripts: "scripts that share one global space",
  screens: "the tests that open a screen, a window or a device",
  changes: "the comments that mark a change",
};
// The marks of a change in a comment (tasks/code-shape.md, "A comment says why the code is so, never what changed";
// #458), each by its name, read of each line of a comment, a block's own * and a list's - before it aside: a change's
// heading, a word of change in capitals that opens the line before a colon or a date (a line of a comment that goes on
// from the one above opens in small letters, and is none; a notice of what is deprecated says what to use now, and is
// none); what the code was, "Previously:", "Was:" and the like; a change's date, a word of change and a date written as
// ISO writes one, near each other, opening the line (a change of another's, dated, mid-line, is a reason); and the task
// that changed it, a word of change and "in", "for", "by" or "per" a pull request's or an issue's number (a tracker's
// keys, ABC-12, read as a standard's or an advisory's name, RFC-4648, so a project adds its own pattern for them). None guesses: a pattern found
// to does goes off this list in the pull request that finds it, and a project adds its own in the config ("changes").
const WORDS = ["Added", "Changed", "Fixed", "Updated", "Removed", "Modified", "Moved", "Renamed", "Rewritten", "Refactored", "Replaced"];
const CAPITAL = `(?:${WORDS.flatMap(w => [w, w.toUpperCase()]).join("|")})`, CHANGED = `(?:${WORDS.map(w => w.toLowerCase()).join("|")}|${CAPITAL.slice(3, -1)})`;
const DATE = "(?:19|20)\\d\\d-[01]\\d-[0-3]\\d";
const OPENS = "^\\s*(?:[*-]\\s*)?";
export const CHANGE_MARKS = {
  "a change's heading": new RegExp(`${OPENS}${CAPITAL}\\s*(?::|\\(?${DATE}\\b)`, "u"),
  "what the code was": new RegExp(`${OPENS}(?:Previously|Formerly|Was|Old|PREVIOUSLY|FORMERLY|WAS|OLD)\\s*:`, "u"),
  "a change's date": new RegExp(`${OPENS}(?:${CHANGED}\\b.{0,40}\\b${DATE}\\b|${DATE}\\b\\W{0,3}${CHANGED}\\b)`, "u"),
  "the task that changed it": new RegExp(`\\b${CHANGED}\\s+(?:in|for|by|per)\\s+(?:#\\d+|PR\\s*#?\\d+|pull request\\s*#?\\d+)\\b`, "u"),
};

// What a baseline that names no reader was written with: the check as #246 built it.
export const FIRST_READS = ["javascript"];

export const isCode = file => [...CODE, ".cs", ".py"].includes(path.posix.extname(file));
const PACKAGE_FILE = /(^|\/)(package\.json|pyproject\.toml|[^/]*requirements[^/]*\.txt|[^/]+\.csproj)$/u;
export const isPackageFile = file => PACKAGE_FILE.test(file);
// (the same, as git pathspecs)
export const PACKAGE_FILES = [":(glob)**/package.json", ":(glob)**/pyproject.toml", ":(glob)**/*requirements*.txt", ":(glob)**/*.csproj"];

// The clock and randomness a system of rules may not take for itself in JavaScript: each a run of tokens.
const JS_OWN = [["Math", ".", "random"], ["Date", ".", "now"], ["performance", ".", "now"], ["new", "Date", "(", ")"], ["crypto", ".", "randomUUID"], ["crypto", ".", "getRandomValues"], ["crypto", ".", "randomBytes"], ["crypto", ".", "randomInt"]]
  .map(run => ({ run, what: run.join("").replace("new", "new ") }));

const JSX_FILES = [".jsx", ".tsx"];
// (files that are modules by their extension, whatever they hold; and types alone, which no page loads)
const NEVER_SCRIPTS = [".mjs", ".cjs", ".mts", ".cts"];

// A file of JavaScript or TypeScript: its tokens, read with JSX where it may hold it. One whose JSX the reader cannot
// follow to its end is read without it for its imports, and its functions cannot be told.
function javascript(file, text) {
  const jsx = jsxIn(file), toks = tokens(text, jsx);
  const held = JSX_FILES.includes(path.posix.extname(file)) || toks.some(t => t.t === "jsx");
  const read = toks.lost ? tokens(text) : toks;
  return { reader: held ? "jsx" : "javascript", toks: read, functions: toks.lost ? null : functions(toks), imports: imports(read), own: JS_OWN, lang: "javascript", comments: read.comments };
}

// Each file of code as its reader reads it: { reader, toks, functions (null where they cannot be told), imports, own,
// lang, comments: each line of its comments, { line, text } }, and of C# its namespaces and types.
export function reading(file, text) {
  const ext = path.posix.extname(file);
  if (ext === ".cs") { const r = readCsharp(text); return { ...r, reader: "csharp", imports: r.usings, own: CS_OWN, lang: "csharp" }; }
  if (ext === ".py") return { ...readPython(text), reader: "python", own: PY_OWN, lang: "python" };
  return javascript(file, text);
}

// What the project declares beside its code, for the readers that need it: where its C# declares each namespace and
// type, the folders whose package.json makes .js a module, and the packages its .csproj, pyproject.toml and
// requirements files name ({ ships, declared }, each a Set of names, a Python package's as it is declared).
export function index(readings, texts) {
  const csharp = csharpIndex(readings.filter(([, r]) => r.lang === "csharp"));
  const modules = new Map();
  for (const [file, text] of Object.entries(texts)) {
    if (path.posix.basename(file) !== "package.json") continue;
    let p = null;
    try { p = JSON.parse(text); } catch { /* not a package's */ }
    modules.set(path.posix.dirname(file), p?.type === "module");
  }
  const cs = csharpPackages(texts), py = pythonPackages(texts);
  return { csharp, modules, py, ships: new Set([...cs.ships, ...py.ships.values()]), declared: new Set([...cs.declared, ...py.declared.values()]) };
}

// Whether a file of JavaScript is a module by the package.json nearest it ("type": "module").
function moduleByPackage(file, modules) {
  for (let dir = path.posix.dirname(file); ; dir = path.posix.dirname(dir)) {
    if (modules.has(dir)) return modules.get(dir);
    if (dir === "." || dir === "/" || dir === "") return false;
  }
}

// The names a file adds to the global space it shares with every other such file a page loads; null where it shares
// none: a module (by what it imports or exports, its extension or its package.json), and a file of types alone (.d.ts).
export function shared(file, r, idx) {
  if (r.lang !== "javascript" || NEVER_SCRIPTS.includes(path.posix.extname(file)) || /\.d\.[cm]?ts$/u.test(file)) return null;
  if (isModule(r.toks) || moduleByPackage(file, idx.modules)) return null;
  return bindings(r.toks);
}

// The names a script's top level declares: the first of each list (globals), and each after a comma at the list's
// own level that a = , or ; follows (var a = f(x, y), b = 2, c;).
function bindings(toks) {
  const names = new Set(globals(toks));
  let depth = 0, list = false;
  for (let k = 0; k < toks.length; k++) {
    const v = toks[k].t === "punct" ? toks[k].v : null;
    if (v && "([{".includes(v)) depth++;
    else if (v && ")]}".includes(v)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && toks[k].t === "id" && ["var", "let", "const"].includes(toks[k].v)) { list = true; for (const n of pattern(toks, k + 1)) names.add(n); }
    else if (depth === 0 && v === ";") list = false;
    else if (list && depth === 0 && another(toks, k)) names.add(toks[k + 1].v);
  }
  return [...names];
}
// The names a destructuring pattern at k binds ({ a, b: c, d = f(x, y) } or [e, ...g]): each name in its braces and
// brackets, not in a default's parentheses, that a , } ] or = follows, a key (a :) and a member (a .) aside.
function pattern(toks, k) {
  const names = [];
  let open = 0, parens = 0; // (the brackets open, and how many of them are a default's parentheses)
  if (!isP(toks[k], "{") && !isP(toks[k], "[")) return names;
  for (let j = k; j < toks.length; j++) {
    const v = toks[j].t === "punct" ? toks[j].v : null;
    if (v && "([{".includes(v)) { open++; if (v === "(") parens++; }
    else if (v && ")]}".includes(v)) { open--; if (v === ")") parens--; if (open === 0) return names; }
    else if (toks[j].t === "id" && parens === 0 && !isP(toks[j - 1], ".") && [",", "}", "]", "="].some(s => isP(toks[j + 1], s))) names.push(toks[j].v);
  }
  return names;
}
const another = (toks, k) => isP(toks[k], ",") && toks[k + 1]?.t === "id" && ["=", ",", ";"].some(v => isP(toks[k + 2], v));

// Where an import of C# or Python leads: { to: [files] } where it is the project's own, else { outside, names }, names
// what the config's "platform" and "wraps" are matched against (the name, and each name it lies under), and how it is
// known: "builtin" (the framework's or the standard library's), a package's name, or null (nowhere the check can tell).
export function linked(file, imp, r, idx, files, platform) {
  if (r.lang === "csharp") {
    const to = resolveCsharp(imp, idx.csharp);
    if (to.to) return to;
    const names = to.outside.split(".").map((_, k, parts) => parts.slice(0, k + 1).join("."));
    const pkg = [...names].reverse().find(n => idx.declared.has(n)) ?? null;
    return { outside: to.outside, names, known: pkg ?? (names[0] === "System" || names[0] === "Microsoft" ? "builtin" : null) };
  }
  const known = top => STDLIB.has(top) || idx.py.declared.has(normal(top)) || platform.includes(top);
  const to = resolvePython(file, imp, files, known);
  if (to.to) return to.to.length || imp.level === 0 ? to : { outside: `${".".repeat(imp.level)}${imp.module}`, names: [], known: null };
  const names = to.outside.split(".").map((_, k, parts) => parts.slice(0, k + 1).join("."));
  return { outside: to.outside, names, known: STDLIB.has(to.top) ? "builtin" : idx.py.declared.get(normal(to.top)) ?? null };
}
