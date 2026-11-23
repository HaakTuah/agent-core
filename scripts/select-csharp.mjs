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
import { heldBeside, msbuildUsings, outside } from "./select-csharp-project.mjs";
import { leftOut } from "./select-csharp-text.mjs";
import { readCsharp } from "./shape-csharp.mjs";

const TYPE = new Set(["class", "struct", "interface", "enum", "record", "delegate", "namespace"]);
const MODIFIER = new Set(["public", "internal", "private", "protected", "static", "sealed", "abstract", "partial", "readonly", "ref", "unsafe", "file", "new", "extern"]);
// (what C# or a test framework runs unnamed: a file that holds one is reached from every file)
const HOOKS = new Set(["ModuleInitializer", "AssemblyInitialize", "AssemblyCleanup", "GlobalTestInitialize", "GlobalTestCleanup", "SetUpFixture", "BeforeEvery", "AfterEvery", "IIncrementalGenerator", "ISourceGenerator", "CollectionDefinition"]);
// (what finds types unnamed: reflection, a scan of an assembly or the compilation; a word Assembly or CreateInstance… too)
const REFLECTS = new Set(["IIncrementalGenerator", "ISourceGenerator", "Activator", "GetTypes", "ExportedTypes", "DefinedTypes", "AddControllers", "AddControllersWithViews", "AddMvc", "AddMvcCore", "AddRazorPages",
  "MapControllers", "MapRazorPages", "MapRazorComponents", "AddApplicationPart", "AddAutoMapper", "AddMediatR"]);

const hookWord = w => HOOKS.has(w.replace(/Attribute$/u, ""));
const TUNIT = /^(Before|After)(Attribute)?$/u;
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

// The using directive that opens at toks[i] ("using", or "global using"): { end, target, global, alias }, or null where
// the tokens there are no directive (a using statement or declaration). An alias of a type that is no name
// ("using Pair = (int, App.Item);") has no target: the words of its type are read as any others.
function directive(toks, i) {
  const k = pastHead(toks, i);
  if (k < 0) return null;
  const { parts, end } = nameAt(toks, k), last = parts.length ? pastGeneric(toks, end) : end, eq = toks[k - 1]?.v === ":" ? k - 4 : k - 1;
  const global = toks[i].v === "global", alias = toks[eq]?.v === "=" ? word(toks[eq - 1]) : null;
  if (parts.length && toks[last]?.v === ";") return { end: last, target: parts.join("."), global, alias };
  if (!alias) return null;
  const semi = pairs(toks).semi[k];
  return semi < toks.length ? { end: semi, target: null, global, alias } : null;
}


// Where the statements at the top of a file begin: the first token past its using directives, extern aliases and
// attribute sections; true where that token opens a statement (top-level statements, which C# compiles into a global
// class Program).
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

// Where each "(" and "<" of a file's tokens closes (a Map of its place to that of its ")" or ">"), and at each place
// the next ";" (semi); read once per file.
const paired = new WeakMap(), SHUT = { __proto__: null, ")": "(", ">": "<" };
function pairs(toks) {
  if (paired.has(toks)) return paired.get(toks);
  const close = new Map(), open = { "(": [], "<": [] }, semi = new Int32Array(toks.length + 1).fill(toks.length);
  toks.forEach((t, k) => { if (t.v === "(" || t.v === "<") open[t.v].push(k); else if (open[SHUT[t.v]]?.length) close.set(open[SHUT[t.v]].pop(), k); });
  for (let k = toks.length - 1; k >= 0; k--) semi[k] = toks[k].v === ";" ? k : semi[k + 1];
  paired.set(toks, Object.assign(close, { semi }));
  return paired.get(toks);
}

// The delegates a file declares, by their full names: `delegate` then a return type (an anonymous delegate, "delegate {"
// or "delegate (…) {", and a function pointer, "delegate*", declare none; "delegate (int X, int Y) Pair()" returns a
// tuple), each in the namespace it stands in, read from the tokens as they go: a block's within its braces, inside
// those around it, and a file-scoped one's to the end. Each scan goes on where the last stopped (pairs): linear in the
// tokens, and a namespace's full name is made once, where a delegate stands in it.
function delegates(r, pace) {
  const toks = r.toks, out = [], within = namespaces(toks, new Set(r.namespaces), pace);
  for (let i = 0; i < toks.length; i++) {
    const next = within.step(i);
    if (next !== i) { i = next; continue; }
    if (toks[i].v !== "delegate" || ["{", "*"].includes(toks[i + 1]?.v)) continue;
    const start = toks[i + 1]?.v === "(" ? (pairs(toks).get(i + 1) ?? toks.length - 1) + 1 : i + 1;
    if (toks[start]?.v === "{") continue;
    const { name, end } = delegateName(toks, start);
    if (name) out.push(join(within.name(), name));
    i = Math.max(i, end - 1);
  }
  return out;
}

// The namespace a scan of a file's tokens stands in: step(i) reads the token at i, a brace or a namespace's head, and
// gives where the scan goes on (i, or past the head); name() the full name where it stands. The tokens drop an escaped
// word's "@", so "namespace" heads a namespace only at a namespace's own level, not after a ".", and naming one the
// grammar declared (`known`): `class C { @namespace field; }` declares none. `pace` is asked at each head.
function namespaces(toks, known, pace) {
  const open = [];
  let depth = 0, file = { full: "" };
  return {
    name: () => (open.at(-1) ?? file).full,
    step(i) {
      const v = toks[i].v;
      if (v === "{") depth++;
      else if (v === "}") { depth--; while (open.at(-1)?.depth > depth) open.pop(); }
      else if (v === "namespace" && depth === (open.at(-1)?.depth ?? 0) && toks[i - 1]?.v !== ".") {
        pace();
        const { name, end } = dotted(toks, i + 1), whole = join((open.at(-1) ?? file).full, name);
        if (toks[end]?.v === ";" && known.has(name)) file = { full: name };
        else if (toks[end]?.v === "{" && known.has(whole)) open.push({ full: whole, depth: ++depth });
        else return i;
        return end;
      }
      return i;
    },
  };
}

// A dotted name from `k` on ("App.Rules"), and where it ended.
function dotted(toks, k) {
  const parts = [];
  for (; toks[k]?.t === "id"; k += 2) { parts.push(word(toks[k])); if (toks[k + 1]?.v !== ".") { k++; break; } }
  return { name: parts.join("."), end: k };
}

// A delegate's name, from its return type at `k` on (the last word before "(" outside the type's "<>"), and where
// the scan ended (a ";", "{" or "}": `@delegate` reads as the keyword, and `new[] { @delegate }` declares none).
function delegateName(toks, k) {
  let depth = 0, name = null;
  for (; k < toks.length && ![";", "{", "}"].includes(toks[k].v); k++) {
    const v = toks[k].v;
    if (v === "<") depth++;
    else if (v === ">") depth--;
    else if (v === "(" && depth === 0) break;
    else if (toks[k].t === "id" && depth === 0) name = word(toks[k]);
  }
  return { name, end: k };
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
// Whether C# or a test framework runs a file with no name: a hook's word, an assembly's or a module's attribute, or
// TUnit's Before or After beside a word Assembly, TestSession or TestDiscovery.
const runsUnnamed = (toks, words) => words.some(hookWord) || toks.some((k, i) => k.v === "[" && ["assembly", "module"].includes(toks[i + 1]?.v) && toks[i + 2]?.v === ":")
  || (toks.some(k => TUNIT.test(k.v)) && toks.some(k => ["Assembly", "TestSession", "TestDiscovery"].includes(k.v)));
// Whether a file finds types by reflection or scans an assembly for them; TUnit's "Before(Assembly)" names no scan.
const hookOf = (toks, i) => toks[i - 1]?.v === "(" && ["Before", "After"].includes(toks[i - 2]?.v);
const reflecting = (toks, words) => words.some(w => REFLECTS.has(w) || w.startsWith("CreateInstance"))
  || toks.some((k, i) => k.t === "id" && /Assembl(y|ies)/u.test(word(k)) && !hookWord(word(k)) && !hookOf(toks, i))
  || toks.some((k, i) => k.v === "GetType" && toks[i + 1]?.v === "(" && toks[i + 2]?.v !== ")");

const LITERAL = { t: "str", v: "" };

// What a file holds that bears on its reach: its own namespaces, the namespaces its types stand in, its words, its runs
// of dotted words, its using directives, and whether it declares extension members, runs with no name, reads types by
// reflection, is of top-level statements, is unread (what it declares is not known either), or holds code the tokens
// leave out (select-csharp-text.mjs). Each scan reads the tokens with every literal's value emptied, so a character's
// ('}') is no punctuation.
function factsOf(read, src) {
  const toks = (read.toks ?? []).map(k => (k.t === "str" ? LITERAL : k)), r = { ...read, toks }, raw = leftOut(src);
  const words = ids(toks), placed = new Set(r.namespaces);
  if (!r.namespaces.length || r.types.some(t => !t.includes("."))) placed.add("");
  return { r, words: new Set(words), ...runsOf(toks), placed: [...placed], extensions: extending(toks), hook: runsUnnamed(toks, words),
    reflects: reflecting(toks, words), unread: r.usings === null || r.functions === null || raw > 1, raw, program: topLevel(toks) };
}

// Where the project declares each type: { types: Map of a full name to its files, byLast: Map of a type's last word to
// a Map of its namespace to its files, extensions: Map of a namespace to the files that may extend in it, every: the
// files every file reaches and unsure: the files unsure (each as the head says), globals: what global using directives
// name, aliases: Map of a global alias to what it names, depth: the most words of a declared name }.
function indexOf(facts, pace) {
  const ix = { types: new Map(), byLast: new Map(), extensions: new Map(), every: [], globals: [], aliases: new Map(), unsure: new Set(), depth: 1 };
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
// top-level statements; `pace` is asked as the delegates are read.
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
  for (const u of usings) if (u.alias) { if (u.target !== null) into(ix.aliases, u.alias).add(u.target); } else ix.globals.push(u.target);
}

// The names a file writes in full (x its facts): its runs of dotted words, each with an alias that heads it put for
// what the alias names (one of its own or a global one, the word alone too), and what global using directives name (a
// `using static` of MSBuild's names a type no file need name), cut past the index's depth. `pace` is asked for each.
function fullNames(x, ix, pace) {
  const aliases = new Map(ix.aliases), runs = new Set([...x.runs, ...ix.globals]);
  for (const u of x.usings) if (u.alias && u.target !== null) into(aliases, u.alias).add(u.target);
  for (const run of [...x.runs, ...x.words]) { pace(); const [head, ...rest] = run.split(".", ix.depth + 1); for (const t of aliases.get(head) ?? []) { pace(); runs.add([t, ...rest].join(".")); } }
  return runs;
}

// The files one file reaches (x its facts), by the index: the files every file reaches; each type a word of its names
// in a namespace it sees, and each a name it writes in full names (fullNames) against the namespaces around it, each
// as itself or as an attribute; and the files that may extend in a namespace it sees.
// `pace` is asked in each expansion.
function reachOf(x, ix, pace) {
  const around = new Set([""]);
  for (const n of x.r.namespaces) for (const p of prefixes(n, ix.depth, pace)) around.add(p);
  const sees = new Set(around);
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
  // (where the usings every file holds are untold, every file is unsure)
  if (msbuild === null) return { links, unsure: new Set(files) };
  const facts = new Map(files.map(f => { pace(); return [f, factsOf(readCsharp(all[f]), all[f])]; }));
  const ix = indexOf(facts, pace);
  globally(ix, [...msbuild, ...outside(texts, facts, pace)]);
  // (or a global alias names a hook's attribute, unseen where it is applied)
  if ([...ix.aliases.values()].some(ts => [...ts].some(t => { const w = t.split(".").pop(); return hookWord(w) || TUNIT.test(w); }))) return { links, unsure: new Set(files) };
  for (const [f, x] of facts) { pace(); const to = reachOf(x, ix, pace); to.delete(f); links.set(f, to); }
  return { links, unsure: ix.unsure };
}
