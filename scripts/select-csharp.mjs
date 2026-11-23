// What a file of C# reaches, for the test selection (select.mjs, beside this file; #675): each file of the project's
// whose type it may name, read word by word on the parser's tokens (shape-csharp.mjs). It never runs the code.
//
// A file reaches the files that declare a type it may name: each word it holds, as a type (or the type of an attribute,
// `[Fact]` naming FactAttribute) in a namespace it sees (each it declares and those around it, the global one, each its
// using directives name, global ones from any file and from <Using> in a .csproj, .props or .targets, each read against
// the namespaces around it, and the namespaces those hold); each name written out in full, as App.Rules, an alias that
// heads it put for what it names; the files that may declare extension members in a namespace it sees; each file of
// top-level statements, by the name Program that its tests give it; and the files every file reaches: those C# or a test
// framework runs with no name (an assembly's attribute, a module initializer, an assembly's or a session's set-up, a
// source generator), those that hold a global using directive, and those the grammar lost, whose declarations are not
// known. It reads more than a file takes, never less. Where reach cannot be told, a file is unsure (a test that reaches
// it runs on any change): where the grammar lost it, where it holds a raw interpolated string, where it reads types by
// reflection or scans an assembly for them, and, every file of C#, where a <Using> names an MSBuild property or git
// cannot be asked. The files of C# git holds that the config does not read (a folder of migrations it leaves out)
// are read here too, as links between the files it reads. Node's own modules and git.
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

const RAW = /\$+"""/u;
const hookWord = w => HOOKS.has(w.replace(/Attribute$/u, ""));
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

// The using directive that opens at toks[i] ("using", or "global using"): { end, target, global, alias }, or null where
// the tokens there are no directive (a using statement or declaration).
function directive(toks, i) {
  const k = pastHead(toks, i);
  if (k < 0) return null;
  const { parts, end } = nameAt(toks, k), last = pastGeneric(toks, end), eq = toks[k - 1]?.v === ":" ? k - 4 : k - 1;
  return parts.length && toks[last]?.v === ";"
    ? { end: last, target: parts.join("."), global: toks[i].v === "global", alias: toks[eq]?.v === "=" ? word(toks[eq - 1]) : null } : null;
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

// The token past the ")" that closes the "(" at toks[k].
function pastParens(toks, k) {
  let depth = 0;
  for (; k < toks.length; k++) if (toks[k].v === "(") depth++; else if (toks[k].v === ")" && --depth === 0) return k + 1;
  return k;
}

// The delegates a file declares, by their names: `delegate` then a return type, the name the last word before "(" at the
// top level of the type's "<>" (an anonymous delegate, "delegate {" or "delegate (…) {", and a function pointer,
// "delegate*", declare none; "delegate (int X, int Y) Pair()" returns a tuple).
function delegates(toks) {
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].v !== "delegate" || ["{", "*"].includes(toks[i + 1]?.v)) continue;
    const start = toks[i + 1]?.v === "(" ? pastParens(toks, i + 1) : i + 1;
    if (toks[start]?.v === "{") continue;
    let depth = 0, name = null;
    for (let k = start; k < toks.length && toks[k].v !== ";" && toks[k].v !== "{"; k++) {
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

// Whether a file may declare extension members: a parameter "this T" (behind an attribute, ref, in or scoped too; T a
// tuple too), or an
// extension block ("extension(" or "extension<", whose header the grammar reads as "class _").
const extending = toks => toks.some((k, i) => (k.v === "this" && ["(", "]", "ref", "in", "scoped", "readonly"].includes(toks[i - 1]?.v) && (toks[i + 1]?.t === "id" || toks[i + 1]?.v === "("))
  || (k.v === "extension" && ["(", "<"].includes(toks[i + 1]?.v)) || (k.v === "class" && toks[i + 1]?.v === "_"));
// Whether C# or a test framework runs a file with no name: a hook's word, an assembly's or a module's attribute, or
// TUnit's "Before(Assembly)" and its kin.
const runsUnnamed = (toks, words) => words.some(hookWord) || toks.some((k, i) => k.v === "[" && ["assembly", "module"].includes(toks[i + 1]?.v) && toks[i + 2]?.v === ":")
  || toks.some((k, i) => ["Before", "After"].includes(k.v) && toks[i + 1]?.v === "(" && ["Assembly", "TestSession", "TestDiscovery"].includes(toks[i + 2]?.v));
// Whether a file finds types by reflection or scans an assembly for them; TUnit's "Before(Assembly)" names no scan.
const hookOf = (toks, i) => toks[i - 1]?.v === "(" && ["Before", "After"].includes(toks[i - 2]?.v);
const reflecting = (toks, words) => words.some(w => REFLECTS.has(w))
  || toks.some((k, i) => k.t === "id" && /Assembl(y|ies)/u.test(word(k)) && !hookWord(word(k)) && !hookOf(toks, i))
  || toks.some((k, i) => k.v === "Type" && toks[i + 1]?.v === "." && toks[i + 2]?.v === "GetType");

// What a file holds that bears on its reach: its own namespaces, the namespaces its types stand in, its words, its runs
// of dotted words, its using directives, and whether it declares extension members, runs with no name, reads types by
// reflection, is of top-level statements, was lost by the grammar (unread: what it declares is not known either), or
// holds code the tokens leave out (a raw interpolated string's holes, which they do not read; any text of `$"""` counts,
// a comment's too, which reads more).
function factsOf(r, src) {
  const toks = r.toks ?? [], words = ids(toks), placed = new Set(r.namespaces);
  if (!r.namespaces.length || r.types.some(t => !t.includes("."))) placed.add("");
  return { r, words: new Set(words), ...runsOf(toks), placed: [...placed], extensions: extending(toks), hook: runsUnnamed(toks, words),
    reflects: reflecting(toks, words), unread: r.usings === null || r.functions === null, raw: RAW.test(src), program: topLevel(toks) };
}

// The <Using Include="N"> items of MSBuild's files, each a global using directive ({ target, alias }, an Alias="S" its
// alias), or null where one names a property ("$(...)"), whose value cannot be told here.
function msbuildUsings(texts) {
  const out = [];
  for (const text of texts) {
    for (const m of text.matchAll(/<Using\b([^>]*)>/gu)) {
      const [include, alias] = ["Include", "Alias"].map(a => new RegExp(`\\b${a}\\s*=\\s*"([^"]*)"`, "u").exec(m[1])?.[1]);
      if (include === undefined) continue;
      if (`${include}${alias ?? ""}`.includes("$(")) return null;
      out.push(...include.split(";").map(s => s.trim().replace(/^global::/u, "")).filter(Boolean).map(target => ({ target, alias: alias?.trim() || null })));
    }
  }
  return out;
}

// What git holds that the config does not read and C# compiles with: { msbuild: [the texts of each .props and .targets],
// cs: { path: text } of each file of C# }, a link read as no text; { unknown: true } where git cannot be asked or a file
// cannot be read.
export function heldBeside(texts) {
  try {
    const held = git(["ls-files", "-z", "--", ":(glob)**/*.props", ":(glob)**/*.targets", ":(glob)**/*.cs"]).split("\0").filter(f => f && !(f in texts));
    const text = f => (fs.lstatSync(f).isFile() ? fs.readFileSync(f, "utf8") : "");
    return { msbuild: held.filter(f => !f.endsWith(".cs")).map(text), cs: Object.fromEntries(held.filter(f => f.endsWith(".cs")).map(f => [f, text(f)])) };
  } catch { return { unknown: true }; }
}

// A file of C# that lies under no .csproj's folder: no project compiles it by default, and one may by a path written
// out (<Compile Include>), so what reaches it cannot be told.
export function ofNoProject(file, texts) {
  return !Object.keys(texts).some(f => f.endsWith(".csproj") && file.startsWith(path.posix.dirname(f) === "." ? "" : `${path.posix.dirname(f)}/`));
}


// Where the project declares each type: { types: Map of a full name to its files, byLast: Map of a type's last word to a
// Map of its namespace to its files, extensions: Map of a namespace to the files that may extend in it, every: the files
// every file reaches (those run with no name, those that hold a global using directive, which bears on every file, and
// those unread, whose declarations are not known), globals: what global using directives name, aliases: Map of a global
// alias to what it names, unsure: the files unread, that hold a raw interpolated string or that reflect }.
function indexOf(facts) {
  const ix = { types: new Map(), byLast: new Map(), extensions: new Map(), every: [], globals: [], aliases: new Map(), unsure: new Set() };
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
    const globals = x.usings.filter(d => d.global);
    globally(ix, globals);
    if (x.hook || x.unread || globals.length) ix.every.push(f);
    if (x.unread || x.raw || x.reflects) ix.unsure.add(f);
  }
  return ix;
}

// Global using directives into the index: an alias's target under its name, any other's target among the globals.
function globally(ix, usings) {
  for (const u of usings) if (u.alias) into(ix.aliases, u.alias).add(u.target); else ix.globals.push(u.target);
}

// The names a file writes in full (x its facts): its runs of dotted words, each with an alias that heads it put for
// what the alias names (one of its own or a global one, the word alone too), and what global using directives name (a
// `using static` of MSBuild's names a type no file need name). `pace` is asked for each.
function fullNames(x, ix, pace) {
  const aliases = new Map(ix.aliases), runs = new Set([...x.runs, ...ix.globals]);
  for (const u of x.usings) if (u.alias) into(aliases, u.alias).add(u.target);
  for (const run of [...x.runs, ...x.words]) { pace(); const [head, ...rest] = run.split("."); for (const t of aliases.get(head) ?? []) runs.add([t, ...rest].join(".")); }
  return runs;
}

// The files one file reaches (x its facts), by the index: the files every file reaches; each type a word of its names
// in a namespace it sees, as itself or as an attribute; each type a name it writes in full names (fullNames), as itself
// or as an attribute, read against the namespaces around it; and the files that may extend in a namespace it sees.
// `pace` is asked in each expansion.
function reachOf(x, ix, pace) {
  const around = new Set(["", ...x.r.namespaces.flatMap(n => { pace(); return prefixes(n); })]), sees = new Set(around);
  for (const target of [...ix.globals, ...x.usings.map(u => u.target)]) for (const p of around) { pace(); for (const n of prefixes(join(p, target))) sees.add(n); }
  const to = new Set(ix.every), add = files => { for (const g of files ?? []) to.add(g); }, runs = fullNames(x, ix, pace);
  for (const w of x.words) for (const last of [w, `${w}Attribute`]) for (const [ns, files] of ix.byLast.get(last) ?? []) if (sees.has(ns)) add(files);
  for (const run of runs) for (const p of around) { pace(); for (const name of prefixes(join(p, run))) { add(ix.types.get(name)); add(ix.types.get(`${name}Attribute`)); } }
  for (const ns of sees) add(ix.extensions.get(ns));
  return to;
}

// The links of each file of C# among `texts`, and of each git holds beside them, to the files it may reach, and the
// files whose reach cannot be told: { links: Map of a file to a Set of files, unsure: Set }. `beside` is what git holds
// beside the texts (heldBeside).
export function csharpReach(texts, pace = () => {}, beside = heldBeside) {
  const links = new Map();
  if (!Object.keys(texts).some(f => f.endsWith(".cs"))) return { links, unsure: new Set() };
  const held = beside(texts), read = Object.entries(texts).filter(([f]) => /\.(csproj|props|targets)$/u.test(f)).map(([, t]) => t);
  const msbuild = held.unknown ? null : msbuildUsings([...held.msbuild, ...read]);
  const all = { ...held.cs, ...texts }, files = Object.keys(all).filter(f => f.endsWith(".cs"));
  // (where the usings every file holds cannot be told, every file is unsure)
  if (msbuild === null) return { links, unsure: new Set(files) };
  const facts = new Map(files.map(f => { pace(); return [f, factsOf(readCsharp(all[f]), all[f])]; }));
  const ix = indexOf(facts);
  globally(ix, msbuild);
  for (const [f, x] of facts) { pace(); const to = reachOf(x, ix, pace); to.delete(f); links.set(f, to); }
  return { links, unsure: ix.unsure };
}
