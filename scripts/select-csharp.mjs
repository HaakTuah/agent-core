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

const word = k => k.v.replace(/^@/u, "");
const ids = toks => toks.filter(k => k.t === "id").map(word);
const prefixes = name => name.split(".").map((_, k, parts) => parts.slice(0, k + 1).join("."));
const join = (a, b) => (a ? `${a}.${b}` : b);
const into = (map, key, made = () => new Set()) => { if (!map.has(key)) map.set(key, made()); return map.get(key); };

// Past the head of a using directive that opens at toks[i] ("using", or "global using", then "static", "unsafe", an
// alias's "N =" and "global::", each where it stands): the index of its name, or -1 where no directive opens there.
function pastHead(toks, i) {
  let k = toks[i]?.v === "global" ? i + 1 : i;
  if (toks[k]?.v !== "using") return -1;
  for (const v of ["static", "unsafe"]) if (toks[k + 1]?.v === v) k++;
  if (toks[k + 1]?.t === "id" && toks[k + 2]?.v === "=") k += 2;
  if (["global", ":", ":"].every((v, n) => toks[k + 1 + n]?.v === v)) k += 3;
  return k + 1;
}

// The dotted name that stands at toks[k]: { parts, end } (end the index past it).
function nameAt(toks, k) {
  const parts = [];
  while (toks[k]?.t === "id") { parts.push(word(toks[k])); k++; if (toks[k]?.v !== ".") break; k++; }
  return { parts, end: k };
}

// The index past the "<...>" that opens at toks[k], or k where none does ("using L = List<App.Item>;": the names in it
// are read as any other words).
function pastGeneric(toks, k) {
  let depth = 0;
  for (; k < toks.length && (toks[k].v === "<" || depth > 0); k++) depth += toks[k].v === "<" ? 1 : toks[k].v === ">" ? -1 : 0;
  return k;
}

// The using directive that opens at toks[i] ("using", or "global using"): { end, target, global }, or null where the
// tokens there are no directive (a using statement or declaration).
function directive(toks, i) {
  const k = pastHead(toks, i);
  if (k < 0) return null;
  const { parts, end } = nameAt(toks, k), last = pastGeneric(toks, end);
  return parts.length && toks[last]?.v === ";" ? { end: last, target: parts.join("."), global: toks[i].v === "global" } : null;
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
      else if (toks[k].t === "id" && depth === 0) name = word(toks[k]);
    }
    if (name) out.push(name);
  }
  return out;
}


// Each run of dotted words in a file (of two words or more, "App.Rules.Allowed"), and its using directives.
function runsOf(toks) {
  const runs = new Set(), usings = [];
  for (let i = 0; i < toks.length; i++) {
    const d = ["using", "global"].includes(toks[i].v) && directive(toks, i);
    if (d) usings.push(d);
    if (toks[i].t !== "id" || toks[i - 1]?.v === "." || toks[i + 1]?.v !== ".") continue;
    const { parts } = nameAt(toks, i);
    if (parts.length > 1) runs.add(parts.join("."));
  }
  return { runs, usings };
}

// Whether a file may declare extension members: a parameter "this T", or an extension block ("extension(" or
// "extension<", whose header the grammar reads as "class _").
const extending = toks => toks.some((k, i) => (k.v === "this" && toks[i - 1]?.v === "(" && toks[i + 1]?.t === "id")
  || (k.v === "extension" && ["(", "<"].includes(toks[i + 1]?.v)) || (k.v === "class" && toks[i + 1]?.v === "_"));
// Whether C# or a test framework runs a file with no name: a hook's word, an assembly's or a module's attribute, or
// TUnit's "Before(Assembly)" and its kin.
const runsUnnamed = (toks, words) => words.some(w => HOOKS.has(w)) || toks.some((k, i) => k.v === "[" && ["assembly", "module"].includes(toks[i + 1]?.v) && toks[i + 2]?.v === ":")
  || toks.some((k, i) => ["Before", "After"].includes(k.v) && toks[i + 1]?.v === "(" && ["Assembly", "TestSession", "TestDiscovery"].includes(toks[i + 2]?.v));
// Whether a file finds types by reflection or scans an assembly for them.
const reflecting = (toks, words) => words.some(w => REFLECTS.has(w) || (/Assembl(y|ies)/u.test(w) && !HOOKS.has(w)))
  || toks.some((k, i) => k.v === "Type" && toks[i + 1]?.v === "." && toks[i + 2]?.v === "GetType");

// What a file holds that bears on its reach: its own namespaces, the namespaces its types stand in, its words, its runs
// of dotted words, its using directives, and whether it declares extension members, runs with no name, reads types by
// reflection, is of top-level statements, or was lost by the grammar.
function factsOf(r) {
  const toks = r.toks ?? [], words = ids(toks), placed = new Set(r.namespaces);
  if (!r.namespaces.length || r.types.some(t => !t.includes("."))) placed.add("");
  return { r, words: new Set(words), ...runsOf(toks), placed: [...placed], extensions: extending(toks), hook: runsUnnamed(toks, words),
    reflects: reflecting(toks, words), lost: r.usings === null || r.functions === null, program: topLevel(toks) };
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


// Where the project declares each type: { types: Map of a full name to its files, byLast: Map of a type's last word to a
// Map of its namespace to its files, extensions: Map of a namespace to the files that may extend in it, hooks: the files
// run with no name, globals: the namespaces global using directives name, unsure: the files lost or that reflect }.
function indexOf(facts) {
  const ix = { types: new Map(), byLast: new Map(), extensions: new Map(), hooks: [], globals: [], unsure: new Set() };
  const declare = (full, file) => {
    const dot = full.lastIndexOf(".");
    into(ix.types, full).add(file);
    into(into(ix.byLast, full.slice(dot + 1), () => new Map()), dot < 0 ? "" : full.slice(0, dot)).add(file);
  };
  for (const [f, x] of facts) {
    for (const t of x.r.types) declare(t, f);
    for (const d of delegates(x.r.toks ?? [])) for (const ns of x.placed) declare(join(ns, d), f);
    if (x.program) declare("Program", f);
    if (x.extensions) for (const ns of x.placed) into(ix.extensions, ns).add(f);
    if (x.hook) ix.hooks.push(f);
    for (const u of x.usings) if (u.global) ix.globals.push(u.target);
    if (x.lost || x.reflects) ix.unsure.add(f);
  }
  return ix;
}

// The files one file reaches (x its facts), by the index: the files run with no name; each type a word of its names in
// a namespace it sees, as itself or as an attribute; each its runs of dotted words name in full, read against the
// namespaces around it; and the files that may extend in a namespace it sees.
function reachOf(x, ix) {
  const around = new Set(["", ...x.r.namespaces.flatMap(prefixes)]), sees = new Set(around);
  for (const target of [...ix.globals, ...x.usings.map(u => u.target)]) for (const p of around) for (const n of prefixes(join(p, target))) sees.add(n);
  const to = new Set(ix.hooks), add = files => { for (const g of files ?? []) to.add(g); };
  for (const w of x.words) for (const last of [w, `${w}Attribute`]) for (const [ns, files] of ix.byLast.get(last) ?? []) if (sees.has(ns)) add(files);
  for (const run of x.runs) for (const p of around) for (const name of prefixes(join(p, run))) add(ix.types.get(name));
  for (const ns of sees) add(ix.extensions.get(ns));
  return to;
}

// The links of each file of C# among `texts` to the files it may reach, and the files whose reach cannot be told:
// { links: Map of a file to a Set of files, unsure: Set }. `beside` is what git holds beside the texts (heldBeside).
export function csharpReach(texts, pace = () => {}, beside = heldBeside) {
  const files = Object.keys(texts).filter(f => f.endsWith(".cs")), links = new Map();
  if (!files.length) return { links, unsure: new Set() };
  const held = beside(texts), projects = Object.entries(texts).filter(([f]) => f.endsWith(".csproj")).map(([, t]) => t);
  const msbuild = held.unknown ? null : msbuildUsings([...held.msbuild, ...projects]);
  // (where git holds C# the config does not read, or the usings of every file cannot be told, every file is unsure)
  if (msbuild === null || held.unreadCs) return { links, unsure: new Set(files) };
  const facts = new Map(files.map(f => { pace(); return [f, factsOf(readCsharp(texts[f]))]; }));
  const ix = indexOf(facts);
  ix.globals.push(...msbuild);
  for (const [f, x] of facts) { pace(); const to = reachOf(x, ix); to.delete(f); links.set(f, to); }
  return { links, unsure: ix.unsure };
}
