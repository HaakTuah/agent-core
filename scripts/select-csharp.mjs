// What a file of C# reaches, for the test selection (select.mjs, beside this file; #675): each file of the project's
// whose type it may name, read word by word on the parser's tokens (shape-csharp.mjs). It never runs the code.
//
// A file reaches the files that declare a type it may name: each word it holds, as a type (or the type of an attribute,
// `[Fact]` naming FactAttribute) in a namespace it sees (each it declares and those around it, the global one, each its
// using directives name, global ones from any file and from <Using> in a .csproj, .props or .targets, each read against
// the namespaces around it, and the namespaces those hold); each name written out in full, as App.Rules; the files that
// may declare extension members in a namespace it sees; each file of top-level statements, by the name Program that its
// tests give it; and the files C# or a test framework runs with no name (an assembly's attribute, a module initializer, an
// assembly's or a session's set-up, a source generator). It reads more than a file takes, never less. Where reach cannot
// be told, a file is unsure (a test that reaches it runs on any change): where the grammar lost it, where it reads
// types by reflection or scans an assembly for them, and, every file of C#, where git holds a file of C# the config does
// not read, or a <Using> names an MSBuild property. Node's own modules and git.
import fs from "node:fs";
import path from "node:path";
import { readCsharp } from "./shape-csharp.mjs";
import { git } from "./select-passed.mjs";

const TYPE = new Set(["class", "struct", "interface", "enum", "record", "delegate", "namespace"]);
const MODIFIER = new Set(["public", "internal", "private", "protected", "static", "sealed", "abstract", "partial", "readonly", "ref", "unsafe", "file", "new", "extern"]);
// (what C# or a test framework runs with no name: the files that hold one are reached from every file of C#)
const HOOKS = new Set(["ModuleInitializer", "AssemblyInitialize", "AssemblyCleanup", "GlobalTestInitialize", "GlobalTestCleanup", "SetUpFixture", "BeforeEvery", "AfterEvery", "IIncrementalGenerator", "ISourceGenerator"]);
// (what finds types by reflection, or scans an assembly for them; any word of Assembly or Assemblies too)
const REFLECTS = new Set(["Activator", "GetTypes", "ExportedTypes", "DefinedTypes", "AddControllers", "AddControllersWithViews", "AddMvc", "AddMvcCore", "AddRazorPages",
  "MapControllers", "MapRazorPages", "MapRazorComponents", "AddApplicationPart", "AddAutoMapper", "AddMediatR"]);

const ids = toks => toks.filter(k => k.t === "id").map(k => k.v.replace(/^@/u, ""));
const prefixes = name => name.split(".").map((_, k, parts) => parts.slice(0, k + 1).join("."));
const join = (a, b) => (a ? `${a}.${b}` : b);

// The using directive that opens at toks[i] ("using", or "global using"): { end, target, global }, or null where the
// tokens there are no directive (a using statement or declaration).
function directive(toks, i) {
  const global = toks[i]?.v === "global" && toks[i + 1]?.v === "using";
  let k = i + (global ? 1 : 0);
  if (toks[k]?.v !== "using") return null;
  k++;
  if (toks[k]?.v === "static") k++;
  if (toks[k]?.v === "unsafe") k++;
  if (toks[k]?.t === "id" && toks[k + 1]?.v === "=") k += 2;
  if (toks[k]?.v === "global" && toks[k + 1]?.v === ":" && toks[k + 2]?.v === ":") k += 3;
  const parts = [];
  while (toks[k]?.t === "id") { parts.push(toks[k].v.replace(/^@/u, "")); k++; if (toks[k]?.v !== ".") break; k++; }
  if (!parts.length) return null;
  // (an alias of a generic type, "using L = List<App.Item>;", up to its end: the names in it are read as any other)
  if (toks[k]?.v === "<") { let depth = 0; for (; k < toks.length; k++) { if (toks[k].v === "<") depth++; else if (toks[k].v === ">" && --depth === 0) { k++; break; } } }
  return toks[k]?.v === ";" ? { end: k, target: parts.join("."), global } : null;
}

// Where the statements at the top of a file begin: the first token past its using directives, extern aliases and
// attribute sections; true where that token opens a statement (the file is of top-level statements, which C# compiles
// into a class Program of the global namespace).
function topLevel(toks) {
  let i = 0;
  for (;;) {
    const d = directive(toks, i);
    if (d) { i = d.end + 1; continue; }
    if (toks[i]?.v === "extern" && toks[i + 1]?.v === "alias") { while (i < toks.length && toks[i].v !== ";") i++; i++; continue; }
    if (toks[i]?.v === "[") { let depth = 0; for (; i < toks.length; i++) { if (toks[i].v === "[") depth++; else if (toks[i].v === "]" && --depth === 0) break; } i++; continue; }
    break;
  }
  while (MODIFIER.has(toks[i]?.v)) i++;
  return i < toks.length && !TYPE.has(toks[i].v);
}

// The delegates a file declares, by their names: `delegate` then a return type, the name the last word before "(" at the
// top level of the type's "<>" (an anonymous delegate, "delegate (" or "delegate {", and a function pointer, "delegate*",
// declare none).
function delegates(toks) {
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].v !== "delegate" || ["(", "{", "*"].includes(toks[i + 1]?.v)) continue;
    let depth = 0, name = null;
    for (let k = i + 1; k < toks.length && toks[k].v !== ";" && toks[k].v !== "{"; k++) {
      const v = toks[k].v;
      if (v === "<") depth++;
      else if (v === ">") depth--;
      else if (v === "(" && depth === 0) break;
      else if (toks[k].t === "id" && depth === 0) name = v.replace(/^@/u, "");
    }
    if (name) out.push(name);
  }
  return out;
}

// What a file holds that bears on its reach: its own namespaces, the namespaces its types stand in, its words, its runs
// of dotted words (each of two words or more), its using directives, and whether it declares extension members, runs
// with no name, reads types by reflection, or was lost by the grammar.
function factsOf(r) {
  const toks = r.toks ?? [], words = ids(toks);
  const placed = new Set(r.namespaces);
  if (!r.namespaces.length || r.types.some(t => !t.includes("."))) placed.add("");
  const runs = new Set(), usings = [];
  for (let i = 0; i < toks.length; i++) {
    const d = (toks[i].v === "using" || toks[i].v === "global") && directive(toks, i);
    if (d) usings.push(d);
    if (toks[i].t !== "id" || toks[i - 1]?.v === "." || toks[i + 1]?.v !== ".") continue;
    const run = [toks[i].v.replace(/^@/u, "")];
    for (let k = i + 1; toks[k]?.v === "." && toks[k + 1]?.t === "id"; k += 2) run.push(toks[k + 1].v.replace(/^@/u, ""));
    if (run.length > 1) runs.add(run.join("."));
  }
  const at = (k, v) => toks[k]?.v === v;
  const extensions = toks.some((k, i) => (k.v === "this" && at(i - 1, "(") && toks[i + 1]?.t === "id") || (k.v === "extension" && (at(i + 1, "(") || at(i + 1, "<"))) || (k.v === "class" && at(i + 1, "_")));
  const hook = words.some(w => HOOKS.has(w)) || toks.some((k, i) => k.v === "[" && ["assembly", "module"].includes(toks[i + 1]?.v) && at(i + 2, ":"))
    || toks.some((k, i) => ["Before", "After"].includes(k.v) && at(i + 1, "(") && ["Assembly", "TestSession", "TestDiscovery"].includes(toks[i + 2]?.v));
  const reflects = words.some(w => REFLECTS.has(w) || (/Assembl(y|ies)/u.test(w) && !HOOKS.has(w))) || toks.some((k, i) => k.v === "Type" && at(i + 1, ".") && toks[i + 2]?.v === "GetType");
  return { r, words: new Set(words), runs, usings, placed: [...placed], extensions, hook, reflects, lost: r.usings === null || r.functions === null, program: topLevel(toks) };
}

// The <Using Include="N"> items of MSBuild's files: their namespaces, or null where one names a property ("$(...)"),
// whose value cannot be told here.
function msbuildUsings(texts) {
  const out = [];
  for (const text of texts) {
    for (const m of text.matchAll(/<Using\b([^>]*)>/gu)) {
      const include = /\bInclude\s*=\s*"([^"]*)"/u.exec(m[1])?.[1];
      if (include === undefined) continue;
      if (include.includes("$(")) return null;
      out.push(...include.split(";").map(s => s.trim().replace(/^global::/u, "")).filter(Boolean));
    }
  }
  return out;
}

// What git holds that the config does not read and C# compiles with: { msbuild: [the texts of each .props and .targets],
// unreadCs: whether a file of C# is among them }; { unknown: true } where git cannot be asked or a file cannot be read.
export function heldBeside(texts) {
  try {
    const held = git(["ls-files", "-z", "--", ":(glob)**/*.props", ":(glob)**/*.targets", ":(glob)**/*.cs"]).split("\0").filter(Boolean);
    const msbuild = held.filter(f => !f.endsWith(".cs") && !(f in texts)).map(f => (fs.lstatSync(f).isFile() ? fs.readFileSync(f, "utf8") : ""));
    return { msbuild, unreadCs: held.some(f => f.endsWith(".cs") && !(f in texts)) };
  } catch { return { unknown: true }; }
}

// A file of C# that lies under no .csproj's folder: no project compiles it by default, and one may by a path written
// out (<Compile Include>), so what reaches it cannot be told.
export function ofNoProject(file, texts) {
  return !Object.keys(texts).some(f => f.endsWith(".csproj") && file.startsWith(path.posix.dirname(f) === "." ? "" : `${path.posix.dirname(f)}/`));
}

// The links of each file of C# among `texts` to the files it may reach, and the files whose reach cannot be told:
// { links: Map of a file to a Set of files, unsure: Set }. `beside` is what git holds beside the texts (heldBeside).
export function csharpReach(texts, pace = () => {}, beside = heldBeside) {
  const files = Object.keys(texts).filter(f => f.endsWith(".cs")), links = new Map(), unsure = new Set();
  if (!files.length) return { links, unsure };
  const held = beside(texts);
  const msbuild = held.unknown ? null : msbuildUsings([...held.msbuild, ...Object.entries(texts).filter(([f]) => f.endsWith(".csproj")).map(([, t]) => t)]);
  const facts = new Map();
  for (const f of files) { pace(); facts.set(f, factsOf(readCsharp(texts[f]))); }
  // (where git holds C# the config does not read, or the usings of every file cannot be told, every file is unsure)
  if (msbuild === null || held.unreadCs) return { links, unsure: new Set(files) };
  // Each type by its last word, with its namespace and files; the files that may declare extensions in each namespace.
  const byLast = new Map(), types = new Set(), extensions = new Map(), hooks = [];
  const declare = (full, file) => {
    const dot = full.lastIndexOf("."), last = full.slice(dot + 1), ns = dot < 0 ? "" : full.slice(0, dot);
    types.add(full);
    if (!byLast.has(last)) byLast.set(last, new Map());
    const at = byLast.get(last);
    if (!at.has(ns)) at.set(ns, new Set());
    at.get(ns).add(file);
  };
  const globals = [...msbuild];
  for (const [f, x] of facts) {
    for (const t of x.r.types) declare(t, f);
    for (const d of delegates(x.r.toks ?? [])) for (const ns of x.placed) declare(join(ns, d), f);
    if (x.program) declare("Program", f);
    if (x.extensions) for (const ns of x.placed) { if (!extensions.has(ns)) extensions.set(ns, new Set()); extensions.get(ns).add(f); }
    if (x.hook) hooks.push(f);
    for (const u of x.usings) if (u.global) globals.push(u.target);
    if (x.lost || x.reflects) unsure.add(f);
  }
  const typed = name => { const dot = name.lastIndexOf("."); return byLast.get(name.slice(dot + 1))?.get(dot < 0 ? "" : name.slice(0, dot)) ?? []; };
  for (const [f, x] of facts) {
    pace();
    // (the namespaces around the file, the global one among them; and those it sees, each target read against each)
    const around = new Set(["", ...x.r.namespaces.flatMap(prefixes)]), sees = new Set(around);
    for (const target of [...globals, ...x.usings.map(u => u.target)]) for (const p of around) for (const n of prefixes(join(p, target))) sees.add(n);
    const to = new Set(hooks);
    for (const w of x.words) for (const last of [w, `${w}Attribute`]) for (const [ns, at] of byLast.get(last) ?? []) if (sees.has(ns)) for (const g of at) to.add(g);
    for (const run of x.runs) for (const p of around) for (const name of prefixes(join(p, run))) if (types.has(name)) for (const g of typed(name)) to.add(g);
    for (const ns of sees) for (const g of extensions.get(ns) ?? []) to.add(g);
    to.delete(f);
    links.set(f, to);
  }
  return { links, unsure };
}
