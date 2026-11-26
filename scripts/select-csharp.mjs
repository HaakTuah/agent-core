// What a file of C# reaches, for the test selection (select.mjs; #675), read on the parser's tokens (shape-csharp.mjs);
// it never runs the code. A file reaches the files that declare a type it may name: each word it holds as a type (or an
// attribute's, `[Fact]` naming FactAttribute) in a namespace it sees (its own and those around it, the global one, those
// its using directives name, global ones from any file, MSBuild's <Using>, and those declared outside every project's
// root); each name written in full, an alias that heads it put for what it names; the files that may declare extension
// members in a namespace it sees; a file of top-level statements, by the name Program; and the files every file
// reaches: those run unnamed (runsUnnamed), those that hold a global using directive, and those unread (lost by the
// grammar, or a name may be split). It reads more than a file takes. A file is unsure (a test that reaches it runs on
// any change) where it is unread, holds code the tokens leave out, or finds types unnamed (REFLECTS); every file is,
// where a <Using> cannot be read whole, a global alias names a hook's attribute, or git cannot be asked. C# git holds
// that the config does not read links those it reads (select-csharp-project.mjs).
import { CS, MSBUILD, heldBeside, msbuildUsings, outside } from "./select-csharp-project.mjs";
import { delegates, join, pairs, word } from "./select-csharp-delegates.mjs";
import { leftOut } from "./select-csharp-text.mjs";
import { plainText } from "./nuget.mjs";
import { readCsharp } from "./shape-csharp.mjs";

const TYPE = new Set(["class", "struct", "interface", "enum", "record", "delegate", "namespace"]);
const MODIFIER = new Set(["public", "internal", "private", "protected", "static", "sealed", "abstract", "partial", "readonly", "ref", "unsafe", "file", "new", "extern"]);
// (what C# or a test framework runs unnamed: a file that holds one is reached from every file)
const HOOKS = new Set(["ModuleInitializer", "AssemblyInitialize", "AssemblyCleanup", "GlobalTestInitialize", "GlobalTestCleanup", "SetUpFixture", "BeforeEvery", "AfterEvery", "IIncrementalGenerator", "ISourceGenerator", "CollectionDefinition"]);
// (what finds types unnamed: reflection, a scan of an assembly or the compilation; a word Assembly or CreateInstance… too)
const REFLECTS = new Set(["IIncrementalGenerator", "ISourceGenerator", "Activator", "TypeDescriptor", "GetTypes", "ExportedTypes", "DefinedTypes", "AddControllers", "AddControllersWithViews", "AddMvc", "AddMvcCore", "AddRazorPages",
  "MapControllers", "MapRazorPages", "MapRazorComponents", "AddApplicationPart", "AddAutoMapper", "AddMediatR", "Migrate", "MigrateAsync",
  "GetMigrations", "GetPendingMigrations", "HasPendingModelChanges"]);

const hookWord = w => HOOKS.has(w.replace(/Attribute$/u, ""));
const TUNIT = /^(Before|After)(Attribute)?$/u;
const ids = toks => toks.filter(k => k.t === "id").map(word);
// The names that head a dotted name, shortest first, no deeper than `depth` words (a name deeper than every one the
// index holds matches none), `pace` asked for each.
function* prefixes(name, depth, pace) {
  const parts = name.split(".");
  for (let k = 0, head = ""; k < Math.min(parts.length, depth); k++) { pace(); head = join(head, parts[k]); yield head; }
}
const into = (map, key, made = () => new Set()) => { if (!map.has(key)) map.set(key, made()); return map.get(key); };

// Past the head of a using directive that opens at toks[i] ("using", or "global using", then "static", "unsafe", an
// alias's "N =", and "global::" or an extern alias's "L::"): the index of its name, or -1 where no directive opens there.
function pastHead(toks, i) {
  let k = toks[i]?.v === "global" ? i + 1 : i;
  if (toks[k]?.v !== "using") return -1;
  for (const v of ["static", "unsafe"]) if (toks[k + 1]?.v === v) k++;
  if (toks[k + 1]?.t === "id" && toks[k + 2]?.v === "=") k += 2;
  if (qualifies(toks, k + 1)) k += 3;
  return k + 1;
}

// The dotted name that stands at toks[k]: { parts, end } (end the index past it).
function nameAt(toks, k) {
  const parts = [];
  while (toks[k]?.t === "id") { parts.push(word(toks[k])); k++; if (toks[k]?.v !== ".") break; k++; }
  return { parts, end: k };
}

// The index past the "<...>" (one or more) that opens at toks[k], or k where none does (its names are read as any other
// words).
function pastGeneric(toks, k) {
  while (toks[k]?.v === "<") k = (pairs(toks).get(k) ?? toks.length - 1) + 1;
  return k;
}

// The using directive that opens at toks[i] ("using", or "global using"): { end, target, global, alias, qual (the
// alias D of "D::", global:: aside) }, or null where the tokens there are no directive (a using statement or
// declaration). An alias of a type that is no name ("using Pair = (int, App.Item);") has no target: the words of its
// type are read as any others.
function directive(toks, i) {
  const k = pastHead(toks, i);
  if (k < 0) return null;
  const { parts, end } = nameAt(toks, k), last = parts.length ? pastGeneric(toks, end) : end, eq = toks[k - 1]?.v === ":" ? k - 4 : k - 1;
  const global = toks[i].v === "global", alias = toks[eq]?.v === "=" ? word(toks[eq - 1]) : null, qual = eq < k - 1 && toks[k - 3].v !== "global" ? word(toks[k - 3]) : null;
  if (parts.length && toks[last]?.v === ";") return { end: last, target: parts.join("."), global, alias, qual };
  if (!alias) return null;
  const semi = pairs(toks).semi[k];
  return semi < toks.length ? { end: semi, target: null, global, alias } : null;
}


// Whether a file opens with statements (in a class Program): the first token past its usings, extern aliases and
// attribute sections opens one, or `src` escapes a TYPE word (the tokens drop its "@").
function topLevel(toks, src) {
  let i = 0;
  for (;;) {
    const d = directive(toks, i);
    if (d) { i = d.end + 1; continue; }
    if (toks[i]?.v === "extern" && toks[i + 1]?.v === "alias") { while (i < toks.length && toks[i].v !== ";") i++; i++; continue; }
    if (toks[i]?.v === "[") { let depth = 0; for (; i < toks.length; i++) { if (toks[i].v === "[") depth++; else if (toks[i].v === "]" && --depth === 0) break; } i++; continue; }
    break;
  }
  while (MODIFIER.has(toks[i]?.v)) i++;
  return i < toks.length && !TYPE.has(toks[i].v) || new RegExp(`@(?:${[...TYPE].join("|")})\\b`, "u").test(src);
}

const qualifies = (toks, i) => toks[i]?.t === "id" && toks[i + 1]?.v === ":" && toks[i + 2]?.v === ":";

// Each run of dotted words in a file (of two words or more, "App.Rules.Allowed"; "D::Data" as "D.Data" and "Data", a
// "global::" dropped: qualifies), and its using directives.
function runsOf(toks) {
  const runs = new Set(), usings = [];
  for (let i = 0; i < toks.length; i++) {
    const d = ["using", "global"].includes(toks[i].v) && directive(toks, i);
    if (d) usings.push(d);
    const q = qualifies(toks, i);
    if (toks[i].t !== "id" || toks[i - 1]?.v === "." || qualifies(toks, i - 3) || (!q && toks[i + 1]?.v !== ".")) continue;
    const { parts } = nameAt(toks, q ? i + 3 : i);
    if (parts.length > 1) runs.add(parts.join("."));
    if (q && toks[i].v !== "global") runs.add([word(toks[i]), ...parts].join("."));
  }
  return { runs, usings };
}

// Whether a file may declare extension members: a parameter "this T" (behind an attribute, ref, in or scoped too; T a
// tuple too), or an extension block ("extension(" or "extension<", whose header the grammar reads as "class _").
const extending = toks => toks.some((k, i) => (k.v === "this" && ["(", "]", "ref", "in", "scoped", "readonly"].includes(toks[i - 1]?.v) && (toks[i + 1]?.t === "id" || toks[i + 1]?.v === "("))
  || (k.v === "extension" && ["(", "<"].includes(toks[i + 1]?.v)) || (k.v === "class" && toks[i + 1]?.v === "_"));
// Whether C# or a test framework runs a file with no name: a hook's word, an assembly's or a module's attribute, TUnit's
// Before or After beside a word Assembly, TestSession or TestDiscovery; a type or a namespace declared in System or
// below it (r the parser's reading), in any case, where an attribute the SDK writes may bind (select-csharp-compiles.mjs);
// or a "\" outside a literal, a Unicode escape that may spell any of these.
const runsUnnamed = (toks, words, r) => words.some(hookWord) || toks.some((k, i) => k.v === "\\" || (k.v === "[" && ["assembly", "module"].includes(toks[i + 1]?.v) && toks[i + 2]?.v === ":"))
  || (toks.some(k => TUNIT.test(k.v)) && toks.some(k => ["Assembly", "TestSession", "TestDiscovery"].includes(k.v)))
  || [...r.types, ...r.namespaces].some(n => /^system(?:\.|$)/iu.test(n));
// Whether a file reflects (each GetType but "GetType()") or scans an assembly for types; "Before(Assembly)" scans none.
const hookOf = (toks, i) => toks[i - 1]?.v === "(" && ["Before", "After"].includes(toks[i - 2]?.v);
const reflecting = (toks, words) => words.some(w => REFLECTS.has(w) || w.startsWith("CreateInstance"))
  || toks.some((k, i) => k.t === "id" && /Assembl(y|ies)/u.test(word(k)) && !hookWord(word(k)) && !hookOf(toks, i))
  || toks.some((k, i) => k.v === "GetType" && !(toks[i + 1]?.v === "(" && toks[i + 2]?.v === ")"));

const LITERAL = { t: "str", v: "" };

// What a file holds that bears on its reach: its own namespaces, the namespaces its types stand in, its words, its runs
// of dotted words, its using directives, and whether it declares extension members, runs with no name, reflects, is of
// top-level statements, is unread (what it declares is not known either), or holds code the tokens leave out
// (select-csharp-text.mjs). Each scan reads the tokens with literals emptied (a '}' is no punctuation).
function factsOf(read, src) {
  const lost = read.usings === null || read.functions === null; // (the parser read none of it: no scan of its text)
  const toks = (read.toks ?? []).map(k => (k.t === "str" ? LITERAL : k)), r = { ...read, toks }, raw = lost ? 2 : leftOut(src);
  const words = ids(toks), placed = new Set(r.namespaces);
  if (!r.namespaces.length || r.types.some(t => !t.includes("."))) placed.add("");
  return { r, words: new Set(words), ...runsOf(toks), placed: [...placed], extensions: extending(toks), hook: runsUnnamed(toks, words, r),
    reflects: reflecting(toks, words), unread: raw > 1, raw, program: !lost && topLevel(toks, src) };
}

// Where the project declares each type: { types: Map of a full name to its files, byLast: Map of a type's last word to
// a Map of its namespace to its files, extensions: Map of a namespace to the files that may extend in it, every: the
// files every file reaches and unsure: the files unsure (each as the head says), globals: what global using directives
// name, aliases: Map of a global alias to what it names, depth: the most words of a declared name }.
function indexOf(facts, pace) {
  const ix = { types: new Map(), byLast: new Map(), extensions: new Map(), every: [], globals: [], aliases: new Map(), qualified: [], unsure: new Set(), depth: 1 };
  const deep = name => { ix.depth = Math.max(ix.depth, name.split(".").length); };
  const declare = (full, file) => {
    const dot = full.lastIndexOf(".");
    deep(full);
    into(ix.types, full).add(file);
    into(into(ix.byLast, full.slice(dot + 1), () => new Map()), dot < 0 ? "" : full.slice(0, dot)).add(file);
  };
  for (const [f, x] of facts) {
    for (const t of declared(x, pace)) { pace(); declare(t, f); }
    if (x.extensions) for (const ns of x.placed) { deep(ns); into(ix.extensions, ns).add(f); }
    const globals = x.usings.filter(d => d.global);
    globally(ix, globals);
    if (x.hook || x.unread || globals.length) ix.every.push(f);
    if (x.unread || x.raw || x.reflects) ix.unsure.add(f);
  }
  return ix;
}

// The full names of the types a file declares (x its facts): those the grammar indexes, its delegates, and Program for
// top-level statements; `pace` asked as delegates are read.
const declared = (x, pace) => [...x.r.types, ...delegates(x.r, pace), ...(x.program ? ["Program"] : [])];

// What a changed file of C# no longer does that a test may have reached it by, `was` its text at the base (null where
// it was not there) and `now` its text: a type it declared there and declares no more (a test that named it may now
// find another of that name, by no link to this file), extension members in a namespace, or being reached from every
// file; or that what it declared there cannot be read. Null where it keeps all of them. `pace` is asked as it reads.
export function undeclared(was, now, pace = () => {}) {
  if (was === null) return null;
  const [before, after] = [was, now].map(src => factsOf(readCsharp(src), src));
  if (before.unread) return "what it declared at the base cannot be read";
  if (after.unread) return null; // (every file reaches it, so every test runs on any change)
  const marks = x => [...declared(x, pace).map(t => `the type ${t}`), ...(x.extensions ? x.placed.map(ns => `extension members in ${ns || "the global namespace"}`) : []),
    ...(x.hook || x.usings.some(u => u.global) ? ["what every file reaches (code run with no name, or a global using directive)"] : [])];
  const kept = new Set(marks(after)), gone = marks(before).find(m => !kept.has(m));
  return gone === undefined ? null : `it no longer holds ${gone}`;
}

// Global using directives into the index: an alias's target under its name, any other's target among the globals.
function globally(ix, usings) {
  for (const u of usings) if (u.alias) { if (u.target !== null) into(ix.aliases, u.alias).add(u.target); if (u.qual && u.target !== null) ix.qualified.push(u); } else { ix.globals.push(u.target); if (u.qual) ix.qualified.push(u); }
}

// The names a file writes in full (x its facts): its runs of dotted words, each with an alias that heads it put for
// what the alias names (its own or a global one, the word alone too, and `[D]` for DAttribute), and what global using
// directives name (a `using static` of MSBuild's names a type no file names), cut past the index's depth. `pace` asked for
// each.
function fullNames(x, ix, aliases, pace) {
  const runs = new Set([...x.runs, ...ix.globals]);
  for (const run of [...x.runs, ...x.words]) { pace(); const [head, ...rest] = run.split(".", ix.depth + 1); for (const t of [...aliases.get(head) ?? [], ...aliases.get(`${head}Attribute`) ?? []]) { pace(); runs.add([t, ...rest].join(".")); } }
  return runs;
}

// The aliases a file sees (x its facts): the global ones and its own, each to what it names, and one whose target "D::"
// or "D." heads also to what the alias D names ("using D = App;" then "using E = D::Data;" names App.Data, as
// "using E = D.Data;" does in a namespace's body), round after round until no alias gains a target, so a chain of
// either form is read in any order. Each target is cut to the index's depth, past which every reader cuts a name, so
// the rounds end. `pace` asked for each.
function aliasesOf(x, ix, pace) {
  const aliases = new Map(ix.aliases), own = new Set();
  const add = (k, t) => { if (aliases.get(k)?.has(t)) return false; if (!own.has(k)) { own.add(k); aliases.set(k, new Set(aliases.get(k))); } aliases.get(k).add(t); return true; }; // (the global sets kept as they are)
  for (const u of x.usings) if (u.alias && u.target !== null) add(u.alias, u.target);
  const chained = [...ix.qualified, ...x.usings].filter(u => u.alias && u.target !== null && (u.qual || x.usings.includes(u)));
  for (let more = true; more;) {
    more = false;
    for (const u of chained) for (const t of [...(u.qual ? qualified(u, aliases) : headed(u.target, aliases))]) { pace(); if (add(u.alias, t.split(".", ix.depth).join("."))) more = true; }
  }
  return aliases;
}

// What a target "D::" heads names: the alias D's targets joined with it, one at a time.
function* qualified(u, aliases) {
  for (const t of aliases.get(u.qual) ?? []) yield join(t, u.target);
}

// What a target names where an alias heads it ("D.Data", or "D" alone), one at a time: the alias's targets joined with
// the rest of it.
function* headed(target, aliases) {
  const dot = target.indexOf("."), head = dot < 0 ? target : target.slice(0, dot), rest = dot < 0 ? "" : target.slice(dot + 1);
  for (const t of aliases.get(head) ?? []) yield rest ? join(t, rest) : t;
}

// The namespaces the global using directives and a file's own name (x its facts), one that "D::" heads also as what
// the alias D names ("using D = App;" then "using D::Data;" names App.Data), as one of a file's own that "D." heads
// does, one at a time, `pace` asked for each.
function* targetsOf(x, ix, aliases, pace) {
  yield* ix.globals;
  for (const u of x.usings) if (u.target !== null) yield u.target;
  for (const u of [...ix.qualified, ...x.usings]) if (u.qual && !u.alias) for (const t of qualified(u, aliases)) { pace(); yield t; }
  for (const u of x.usings) if (!u.alias && !u.qual && u.target !== null) for (const t of headed(u.target, aliases)) { pace(); yield t; }
}

// The files one file reaches (x its facts), by the index: the files every file reaches; each type a word of its names
// in a namespace it sees, and each a name it writes in full names (fullNames) against the namespaces around it, each as
// itself or as an attribute; and the files that may extend in a namespace it sees. `pace` is asked in each expansion.
function reachOf(x, ix, pace) {
  const around = new Set([""]);
  for (const n of x.r.namespaces) for (const p of prefixes(n, ix.depth, pace)) around.add(p);
  const sees = new Set(around), aliases = aliasesOf(x, ix, pace);
  for (const target of targetsOf(x, ix, aliases, pace)) for (const p of around) for (const n of prefixes(join(p, target), ix.depth, pace)) sees.add(n);
  const to = new Set(ix.every), add = files => { for (const g of files ?? []) to.add(g); }, runs = fullNames(x, ix, aliases, pace);
  for (const w of x.words) for (const last of [w, `${w}Attribute`]) for (const [ns, files] of ix.byLast.get(last) ?? []) if (sees.has(ns)) add(files);
  for (const run of runs) for (const p of around) for (const name of prefixes(join(p, run), ix.depth, pace)) { add(ix.types.get(name)); add(ix.types.get(`${name}Attribute`)); }
  for (const ns of sees) add(ix.extensions.get(ns));
  return to;
}

// The links of each file of C# among `texts`, and of each git holds beside them, to the files it may reach, and the
// files whose reach cannot be told: { links: Map of a file to a Set of files, unsure: Set }. `beside` reads what git holds
// (heldBeside).
export function csharpReach(texts, pace = () => {}, beside = heldBeside) {
  const links = new Map();
  if (!Object.keys(texts).some(f => CS.test(f))) return { links, unsure: new Set() };
  const held = beside(texts, pace), read = Object.entries(texts).filter(([f]) => MSBUILD.test(f));
  // (an MSBuild text read as UTF-8 that was not, UTF-16 say, holds a NUL or U+FFFD; one whose XML declaration names
  // another encoding, Latin-1 say, MSBuild reads by it, as plainText says of a held one: MSBuild reads what this cannot)
  const all = { ...held.cs, ...texts }, files = Object.keys(all).filter(f => CS.test(f));
  const msbuild = held.unknown || read.some(([, t]) => /[\0\uFFFD]/u.test(t) || plainText(Buffer.from(t, "utf8")) === null) ? null : msbuildUsings([...Object.entries(held.msbuild), ...read], pace, new Set(files));
  // (where the usings every file holds are untold, every file is unsure)
  if (msbuild === null) return { links, unsure: new Set(files) };
  const facts = new Map(files.map(f => { pace(); return [f, factsOf(readCsharp(all[f]), all[f])]; }));
  const ix = indexOf(facts, pace);
  globally(ix, [...msbuild, ...outside(texts, facts, pace, held.msbuild)]);
  // (or a global alias names a hook's attribute, unseen where it is applied)
  if ([...ix.aliases.values()].some(ts => [...ts].some(t => { const w = t.split(".").pop(); return hookWord(w) || TUNIT.test(w); }))) return { links, unsure: new Set(files) };
  for (const [f, x] of facts) { pace(); const to = reachOf(x, ix, pace); to.delete(f); links.set(f, to); }
  return { links, unsure: ix.unsure };
}
