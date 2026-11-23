// What a file of C# reaches, for the test selection (select.mjs, beside this file; #675), read word by word on the
// parser's tokens (shape-csharp.mjs); it never runs the code. A file reaches the files that declare a type it may name:
// each word it holds as a type (or an attribute's, `[Fact]` naming FactAttribute) in a namespace it sees (its own and
// those around it, the global one, those its using directives name, global ones from any file and from <Using> in MSBuild's
// files); each name written out in full, an alias that heads it put for what it names; the files that may declare
// extension members in a namespace it sees; a file of top-level statements, by the name Program; and the files every file
// reaches: those run with no name (an assembly's attribute, a module initializer, a framework's set-up, a source
// generator, an xUnit collection's definition), those that hold a global using directive, and those the grammar lost.
// It reads more than a file takes, never less. A file is unsure (a test that reaches it runs on any change) where the
// grammar lost it, it holds a raw interpolated string, or it reads types by reflection or scans an assembly; every file
// is, where a <Using> names an MSBuild property or git cannot be asked. Files of C# git holds that the config does not
// read are read too, as links between those it reads. Node's own modules and git.
import fs from "node:fs";
import path from "node:path";
import { CHARACTERS, Late } from "./hurry.mjs";
import { readCsharp } from "./shape-csharp.mjs";
import { git } from "./select-passed.mjs";

const TYPE = new Set(["class", "struct", "interface", "enum", "record", "delegate", "namespace"]);
const MODIFIER = new Set(["public", "internal", "private", "protected", "static", "sealed", "abstract", "partial", "readonly", "ref", "unsafe", "file", "new", "extern"]);
// (what C# or a test framework runs with no name: the files that hold one are reached from every file of C#)
const HOOKS = new Set(["ModuleInitializer", "AssemblyInitialize", "AssemblyCleanup", "GlobalTestInitialize", "GlobalTestCleanup", "SetUpFixture", "BeforeEvery", "AfterEvery", "IIncrementalGenerator", "ISourceGenerator", "CollectionDefinition"]);
// (what finds types by reflection, or scans an assembly for them; any word of Assembly or Assemblies too)
const REFLECTS = new Set(["Activator", "GetTypes", "ExportedTypes", "DefinedTypes", "AddControllers", "AddControllersWithViews", "AddMvc", "AddMvcCore", "AddRazorPages",
  "MapControllers", "MapRazorPages", "MapRazorComponents", "AddApplicationPart", "AddAutoMapper", "AddMediatR"]);

const RAW = /\$"""/u; // (one "$" before the quotes, not a run of them: the test is linear in the text)
const hookWord = w => HOOKS.has(w.replace(/Attribute$/u, ""));
const word = k => k.v.replace(/^@/u, "");
const ids = toks => toks.filter(k => k.t === "id").map(word);
// The names that head a dotted name, shortest first, no deeper than `depth` words (a name deeper than every one the
// index holds matches none), `pace` asked for each.
function* prefixes(name, depth, pace) {
  const parts = name.split(".");
  for (let k = 0, head = ""; k < Math.min(parts.length, depth); k++) { pace(); head = join(head, parts[k]); yield head; }
}
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
// the tokens there are no directive (a using statement or declaration). An alias of a type that is no name, a tuple, an
// array or a nullable ("using Pair = (int, App.Item);"), has no target: the words of its type are read as any others,
// so the file that holds a global one, which every file reaches, reaches what they name.
function directive(toks, i) {
  const k = pastHead(toks, i);
  if (k < 0) return null;
  const { parts, end } = nameAt(toks, k), last = pastGeneric(toks, end), eq = toks[k - 1]?.v === ":" ? k - 4 : k - 1;
  const global = toks[i].v === "global", alias = toks[eq]?.v === "=" ? word(toks[eq - 1]) : null;
  if (parts.length && toks[last]?.v === ";") return { end: last, target: parts.join("."), global, alias };
  if (!alias) return null;
  let semi = k;
  while (semi < toks.length && toks[semi].v !== ";") semi++;
  return semi < toks.length ? { end: semi, target: null, global, alias } : null;
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

// Where each "(" of the tokens closes: a Map of its place to that of its ")", read in one pass.
function closings(toks) {
  const close = new Map(), open = [];
  toks.forEach((t, k) => { if (t.v === "(") open.push(k); else if (t.v === ")" && open.length) close.set(open.pop(), k); });
  return close;
}

// The delegates a file declares, by their names: `delegate` then a return type (an anonymous delegate, "delegate {" or
// "delegate (…) {", and a function pointer, "delegate*", declare none; "delegate (int X, int Y) Pair()" returns a
// tuple). Each scan goes on where the last stopped, the parentheses matched once: linear in the tokens.
function delegates(toks) {
  const out = [];
  let close = null;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].v !== "delegate" || ["{", "*"].includes(toks[i + 1]?.v)) continue;
    const start = toks[i + 1]?.v === "(" ? ((close ??= closings(toks)).get(i + 1) ?? toks.length - 1) + 1 : i + 1;
    if (toks[start]?.v === "{") continue;
    const { name, end } = delegateName(toks, start);
    if (name) out.push(name);
    i = Math.max(i, end - 1);
  }
  return out;
}

// A delegate's name, from its return type at `k` on (the last word before "(" outside the type's "<>"), and where
// the scan ended.
function delegateName(toks, k) {
  let depth = 0, name = null;
  for (; k < toks.length && toks[k].v !== ";" && toks[k].v !== "{"; k++) {
    const v = toks[k].v;
    if (v === "<") depth++;
    else if (v === ">") depth--;
    else if (v === "(" && depth === 0) break;
    else if (toks[k].t === "id" && depth === 0) name = word(toks[k]);
  }
  return { name, end: k };
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
  || toks.some((k, i) => k.v === "GetType" && toks[i + 1]?.v === "(" && toks[i + 2]?.v !== ")");

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

// An attribute's value in the text of an XML tag, in either quotes; undefined where the tag has none.
const attribute = (tag, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "u").exec(tag); return m ? m[1] ?? m[2] : undefined; };

// The <Using Include="N"> items of MSBuild's files, each a global using directive ({ target, alias }, an Alias="S" its
// alias), or null where one names a property ("$(...)"), whose value cannot be told here. `pace` is asked for each
// file, and past CHARACTERS of them together the run stops (Late), as it does for the changed files of code.
function msbuildUsings(texts, pace) {
  const out = [], n = texts.reduce((sum, t) => sum + t.length, 0);
  if (n > CHARACTERS) throw new Late(`the project's MSBuild files hold ${n.toLocaleString("en")} characters, past the ${CHARACTERS.toLocaleString("en")} the selection reads, so what each file of C# reaches cannot be told in time`);
  for (const text of texts) {
    pace();
    for (const m of text.matchAll(/<Using\b([^<>]*)>/gu)) { // (each try ends at the next "<": linear in the text)
      const [include, alias] = ["Include", "Alias"].map(a => attribute(m[1], a));
      if (include === undefined) continue;
      if (`${include}${alias ?? ""}`.includes("$(")) return null;
      for (const s of include.split(";")) { const target = s.trim().replace(/^global::/u, ""); if (target) out.push({ target, alias: alias?.trim() || null }); } // one by one: a spread of many outruns the stack
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
// alias to what it names, unsure: the files unread, that hold a raw interpolated string or that reflect, depth: the most
// words of a name declared, deeper than which no name is looked up }.
function indexOf(facts) {
  const ix = { types: new Map(), byLast: new Map(), extensions: new Map(), every: [], globals: [], aliases: new Map(), unsure: new Set(), depth: 1 };
  const deep = name => { ix.depth = Math.max(ix.depth, name.split(".").length); };
  const declare = (full, file) => {
    const dot = full.lastIndexOf(".");
    deep(full);
    into(ix.types, full).add(file);
    into(into(ix.byLast, full.slice(dot + 1), () => new Map()), dot < 0 ? "" : full.slice(0, dot)).add(file);
  };
  for (const [f, x] of facts) {
    for (const t of declared(x)) declare(t, f);
    if (x.extensions) for (const ns of x.placed) { deep(ns); into(ix.extensions, ns).add(f); }
    const globals = x.usings.filter(d => d.global);
    globally(ix, globals);
    if (x.hook || x.unread || globals.length) ix.every.push(f);
    if (x.unread || x.raw || x.reflects) ix.unsure.add(f);
  }
  return ix;
}

// The full names of the types a file declares (x its facts): those the grammar indexes, its delegates in each namespace
// its types stand in, and Program for top-level statements.
const declared = x => [...x.r.types, ...delegates(x.r.toks ?? []).flatMap(d => x.placed.map(ns => join(ns, d))), ...(x.program ? ["Program"] : [])];

// What a changed file of C# no longer does that a test may have reached it by, `was` its text at the base (null where
// it was not there) and `now` its text: a type it declared there and declares no more (a test that named it may now
// find another of that name, by no link to this file), extension members in a namespace, or being reached from every
// file; or that what it declared there cannot be read. Null where it keeps all of them.
export function undeclared(was, now) {
  if (was === null) return null;
  const [before, after] = [was, now].map(src => factsOf(readCsharp(src), src));
  if (before.unread) return "what it declared at the base cannot be read";
  if (after.unread) return null; // (every file reaches it, and every test that does runs on any change)
  const marks = x => [...declared(x).map(t => `the type ${t}`), ...(x.extensions ? x.placed.map(ns => `extension members in ${ns || "the global namespace"}`) : []),
    ...(x.hook || x.usings.some(u => u.global) ? ["what every file reaches (code run with no name, or a global using directive)"] : [])];
  const kept = new Set(marks(after)), gone = marks(before).find(m => !kept.has(m));
  return gone === undefined ? null : `it no longer holds ${gone}`;
}

// Global using directives into the index: an alias's target under its name, any other's target among the globals.
function globally(ix, usings) {
  for (const u of usings) if (u.alias) { if (u.target !== null) into(ix.aliases, u.alias).add(u.target); } else ix.globals.push(u.target);
}

// The names a file writes in full (x its facts): its runs of dotted words, each with an alias that heads it put for
// what the alias names (one of its own or a global one, the word alone too), and what global using directives name (a
// `using static` of MSBuild's names a type no file need name). `pace` is asked for each.
function fullNames(x, ix, pace) {
  const aliases = new Map(ix.aliases), runs = new Set([...x.runs, ...ix.globals]);
  for (const u of x.usings) if (u.alias && u.target !== null) into(aliases, u.alias).add(u.target);
  for (const run of [...x.runs, ...x.words]) { pace(); const [head, ...rest] = run.split("."); for (const t of aliases.get(head) ?? []) runs.add([t, ...rest].join(".")); }
  return runs;
}

// The files one file reaches (x its facts), by the index: the files every file reaches; each type a word of its names
// in a namespace it sees, as itself or as an attribute; each type a name it writes in full names (fullNames), as itself
// or as an attribute, read against the namespaces around it; and the files that may extend in a namespace it sees.
// `pace` is asked in each expansion.
function reachOf(x, ix, pace) {
  const around = new Set(["", ...x.r.namespaces.flatMap(n => [...prefixes(n, ix.depth, pace)])]), sees = new Set(around);
  for (const target of [...ix.globals, ...x.usings.map(u => u.target).filter(t => t !== null)]) for (const p of around) for (const n of prefixes(join(p, target), ix.depth, pace)) sees.add(n);
  const to = new Set(ix.every), add = files => { for (const g of files ?? []) to.add(g); }, runs = fullNames(x, ix, pace);
  for (const w of x.words) for (const last of [w, `${w}Attribute`]) for (const [ns, files] of ix.byLast.get(last) ?? []) if (sees.has(ns)) add(files);
  for (const run of runs) for (const p of around) for (const name of prefixes(join(p, run), ix.depth, pace)) { add(ix.types.get(name)); add(ix.types.get(`${name}Attribute`)); }
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
  const msbuild = held.unknown ? null : msbuildUsings([...held.msbuild, ...read], pace);
  const all = { ...held.cs, ...texts }, files = Object.keys(all).filter(f => f.endsWith(".cs"));
  // (where the usings every file holds cannot be told, every file is unsure)
  if (msbuild === null) return { links, unsure: new Set(files) };
  const facts = new Map(files.map(f => { pace(); return [f, factsOf(readCsharp(all[f]), all[f])]; }));
  const ix = indexOf(facts);
  globally(ix, msbuild);
  for (const [f, x] of facts) { pace(); const to = reachOf(x, ix, pace); to.delete(f); links.set(f, to); }
  return { links, unsure: ix.unsure };
}
