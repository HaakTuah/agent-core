// The shape check (modules/code-shape.md; core archive 224; #246), for every project that takes the core: how its code
// is put together may not get worse. It reads the project's JavaScript and TypeScript with the reader of the measures
// (code-shape.mjs, beside this file) and fails what is new of:
//   - a function past a mark ("marks": its lines, how deep its blocks nest, how often it branches), tests left out;
//   - an import from one system into another that it does not declare it uses ("systems", each with its "paths", the
//     systems it "uses", its "entrance", its "domain" and the packages it "wraps");
//   - an import that reaches inside a system past its entrance, from anywhere outside it;
//   - an import that lies on a cycle between files (of what runs: a dynamic import or one of types alone makes none);
//   - an import of what binds code to one platform ("platform") outside a system of the domain "platform";
//   - a package the project ships with (a dependency, not one of development alone) imported outside the system that
//     wraps it, or, where none wraps it, from more than one system (systems of tools and of tests aside);
//   - the clock or randomness of its own in a system of the domain "rules", which is passed both.
// What stood before is in the baseline ("baseline", a file the project keeps), and never fails: a listed function may
// shrink and may not grow, and a listed import may go. The baseline only shrinks: against the branch a pull request
// merges into (SHAPE_BASE, set by the workflow) an entry may join only where it stood on that branch already, as this
// config reads that branch's code (the check reads more: a system named, a mark lowered, the first baseline), or
// where the baseline gives its reason under "grown", as a raised mark's is given, which the reviews read
// (modules/review-guidelines.md, "What blocks"). An entry that is gone is taken out with --write, which lowers the
// numbers that fell too, and a pull request that leaves one standing fails, so the baseline lists the debt as it is,
// and what was mended cannot come back. It never guesses: an import that
// leads nowhere it can tell, a file that holds JSX (whose functions its reader cannot tell) and a file in another
// language are counted and said, never failed; a project holds those with its language's own tools.
//
// The config's other keys: "code" and "tests", git pathspecs of what is read (tests for their imports alone);
// "aliases", each prefix an import may start with to the path it stands for; "suites", each suite's time mark in
// seconds, a number or one for each of Node's names for a platform ({ "linux": 60, "win32": 240 }).
//
//   node core/scripts/shape.mjs [<config>]            the check; with no config named, the one the manifest's *shape
//                                                     check* names, else checks/shape.json, and nothing where the
//                                                     project has none yet
//   node core/scripts/shape.mjs <config> --first      write the first baseline, what stands when a project takes the
//                                                     check; only where no baseline exists yet
//   node core/scripts/shape.mjs <config> --write      lower the baseline to what still stands; it adds only what
//                                                     "grown" gives a reason for and, with SHAPE_BASE set, what
//                                                     that branch held already, where the config reads more
//   node core/scripts/shape.mjs <config> --suite <name> -- <command>...   run a suite (with no shell) and hold its
//                                                     time to its mark
//   node core/scripts/shape.mjs <config> --suite <name> --since <seconds>  hold the time since a start the workflow
//                                                     took (date +%s) to the suite's mark
// Run from the project's root, by the copies workflow (.github/workflows/copies.yml) on every pull request; in the
// core by its size workflow. Reads only, but for the baseline it writes when told; git and Node's own modules.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { builtinModules } from "node:module";
import os from "node:os";
import path from "node:path";
import { CODE, cycles, functions, imports, resolve, tokens } from "./code-shape.mjs";
import { started } from "./started.mjs";

export const KIT = "checks/shape.json";
// First guesses, which use tunes (the report of 14 November 2026; #246, part G).
export const MARKS = { lines: 60, depth: 4, branches: 15 };
// The domains a project names its systems under, leaving out what it lacks; a name of its own is allowed beside them.
export const DOMAINS = ["rules", "saved-data", "computer-players", "display", "input", "network", "storage", "platform", "packages", "tools", "tests"];
// What the rules never use: nothing outward.
export const OUTWARD = ["display", "input", "network", "storage", "platform"];
const JSX = [".jsx", ".tsx"];
const KEYS = ["baseline", "code", "tests", "systems", "aliases", "platform", "marks", "suites"];
const SYSTEM_KEYS = ["paths", "uses", "entrance", "domain", "wraps"];
const BUILTIN = new Set(builtinModules.flatMap(m => [m, `node:${m}`]));
// The clock and randomness a system of rules may not take for itself: each a run of tokens.
const OWN = [["Math", ".", "random"], ["Date", ".", "now"], ["performance", ".", "now"], ["new", "Date", "(", ")"], ["crypto", ".", "randomUUID"], ["crypto", ".", "getRandomValues"], ["crypto", ".", "randomBytes"], ["crypto", ".", "randomInt"]];

class Refused extends Error {}
const refuse = (what, mend) => { throw new Refused(`${what}. Mend: ${mend}`); };
const isObject = v => !!v && typeof v === "object" && !Array.isArray(v);
const strings = v => Array.isArray(v) && v.every(s => typeof s === "string" && s.length > 0);
const optional = (v, test) => v === undefined || test(v);
const isName = v => typeof v === "string" && /^[a-z][a-z0-9-]*$/u.test(v);
const plainPath = s => typeof s === "string" && /^[\w@.-][\w@. -]*(\/[\w@.-][\w@. -]*)*\/?$/u.test(s) && !s.split("/").includes("..");
const wholeNumbers = o => Object.values(o).every(n => Number.isInteger(n) && n > 0);
const aSecond = n => Number.isFinite(n) && n > 0;
const seconds = v => aSecond(v) || (isObject(v) && Object.keys(v).length > 0 && Object.values(v).every(aSecond));
const KIT_FORM = "write it as the starter kit does (core/setup/template/shape.json.tmpl): a JSON object with \"baseline\", the baseline's path, and \"code\", git pathspecs of the code to read";

// ---- the config ----

function readLists(c, at) {
  const unknown = Object.keys(c).filter(k => !KEYS.includes(k));
  if (unknown.length) refuse(`${at} holds keys the check does not know: ${unknown.join(", ")}`, `take them out; it reads ${KEYS.map(k => `"${k}"`).join(", ")} alone`);
  if (!plainPath(c.baseline) || c.baseline.endsWith("/")) refuse(`${at} names no "baseline" that is a plain path inside the project`, "name the baseline's path in \"baseline\", as the starter kit writes it (checks/shape-baseline.json)");
  for (const k of ["code", "tests"]) if (!optional(c[k], strings)) refuse(`"${k}" in ${at} is not a list of words`, "list git pathspecs there (\":!\" leaves a path out)");
  if (!optional(c.platform, strings)) refuse(`"platform" in ${at} is not a list of words`, "list there each package or module of Node's that binds code to one platform, by the name it is imported under");
  if (!c.code?.length) refuse(`${at} names no "code" to read`, "list the code's folders in \"code\", as git pathspecs (\":!\" leaves a path out)");
}

function readMarks(c, at) {
  const given = c.marks ?? {}, marks = { ...MARKS, ...(isObject(given) ? given : {}) };
  if (!isObject(given) || Object.keys(marks).length !== 3 || !wholeNumbers(marks))
    refuse(`"marks" in ${at} is not in the form the check reads`, `give "lines", "depth" and "branches" a whole number each, or leave one out for the core's own (${JSON.stringify(MARKS)})`);
  const aliases = c.aliases ?? {}, suites = c.suites ?? {};
  if (!isObject(aliases) || !Object.entries(aliases).every(([k, v]) => k.length > 0 && plainPath(v))) refuse(`"aliases" in ${at} is not in the form the check reads`, "give each prefix an import may start with (\"@/\") the path inside the project it stands for (\"src/\")");
  if (!isObject(suites) || !Object.values(suites).every(seconds)) refuse(`"suites" in ${at} is not in the form the check reads`, "give each suite's name its time mark in seconds: a number, or one for each of Node's names for a platform ({ \"linux\": 60, \"win32\": 240 })");
  return { marks, aliases, suites };
}

function readSystem(name, s, systems, at) {
  const here = `the system "${name}" in ${at}`;
  if (!isName(name)) refuse(`${here} has a name the check does not read`, "name it in small letters, digits and hyphens, a letter first");
  if (!isObject(s) || Object.keys(s).some(k => !SYSTEM_KEYS.includes(k))) refuse(`${here} holds keys the check does not know`, `give it ${SYSTEM_KEYS.map(k => `"${k}"`).join(", ")} alone`);
  if (!Array.isArray(s.paths) || !s.paths.length || !s.paths.every(plainPath)) refuse(`${here} names no "paths" inside the project`, "list its folders (each ending in /) or files there");
  if (!optional(s.uses, strings)) refuse(`"uses" of ${here} is not a list of names`, "list there the systems it may import from");
  if (!optional(s.wraps, strings)) refuse(`"wraps" of ${here} is not a list of names`, "list there the packages it alone imports");
  const other = (s.uses ?? []).find(u => !(u in systems) || u === name);
  if (other !== undefined) refuse(`${here} uses "${other}", which is no other system of the config`, "name a system the config holds, or take it out");
  if (!optional(s.entrance, e => plainPath(e) && s.paths.some(p => e.startsWith(p)))) refuse(`${here} names an "entrance" outside its own paths`, "name the one file of the system that the others import from");
  if (!optional(s.domain, isName)) refuse(`the "domain" of ${here} is not a name`, `name one of ${DOMAINS.join(", ")}, or the project's own in the same form`);
}

// What holds between the systems: the rules use nothing outward, a package is wrapped once, and no circle is declared.
function readTogether(systems, at) {
  const wrapped = new Map();
  for (const [name, s] of Object.entries(systems)) {
    const out = s.domain === "rules" ? (s.uses ?? []).find(u => OUTWARD.includes(systems[u].domain)) : undefined;
    if (out !== undefined) refuse(`the system "${name}" in ${at}, of the rules, declares that it uses "${out}", of the domain ${systems[out].domain}`, `take "${out}" out of its "uses": the rules use nothing outward (the display, input, the network, storage, a platform), and what they need of it is passed in; the imports that stand are listed in the baseline`);
    for (const p of s.wraps ?? []) {
      if (wrapped.has(p)) refuse(`the package ${p} is wrapped by two systems in ${at}, "${wrapped.get(p)}" and "${name}"`, "name it under the \"wraps\" of one system alone");
      wrapped.set(p, name);
    }
  }
  const round = cycles(new Map(Object.entries(systems).map(([n, s]) => [n, new Set(s.uses ?? [])])))[0];
  if (round) refuse(`the systems ${round.map(n => `"${n}"`).join(", ")} in ${at} declare that they use one another in a circle`, "take one direction out of their \"uses\": dependencies point one way, and the imports that stand the other way are listed in the baseline");
  return wrapped;
}

// The config as the check reads it, every key filled; it throws a Refused, with its mend, for one it cannot hold to.
export function parseConfig(text, at = KIT) {
  let c;
  try { c = JSON.parse(text); } catch { refuse(`${at} could not be read as JSON`, KIT_FORM); }
  if (!isObject(c)) refuse(`${at} is not a JSON object`, KIT_FORM);
  readLists(c, at);
  const systems = c.systems ?? {};
  if (!isObject(systems)) refuse(`"systems" in ${at} is not an object`, "give each system's name its \"paths\", and what else it declares: \"uses\", \"entrance\", \"domain\", \"wraps\"");
  for (const [name, s] of Object.entries(systems)) readSystem(name, s, systems, at);
  return { baseline: c.baseline, code: c.code, tests: c.tests ?? [], systems, platform: c.platform ?? [], ...readMarks(c, at), wrapped: readTogether(systems, at) };
}

// ---- what stands ----

const packageOf = spec => (spec.startsWith("@") ? spec.split("/").slice(0, 2) : spec.split("/").slice(0, 1)).join("/");
const isRelative = spec => /^\.\.?(\/|$)/u.test(spec);
const toCode = spec => !/\.[A-Za-z0-9]+$/u.test(spec) || CODE.includes(path.posix.extname(spec));
const add = (ctx, kind, key, group, n = true) => ctx.entries.set(`${kind}: ${key}`, { kind, group, n });
const NONE = "(no system)";

// The packages the project's own package.json files name: those it holds itself, by name; those it ships with; and all
// it declares, the ones of development too.
function manifests(texts) {
  const packages = new Map(), ships = new Set(), declared = new Set();
  for (const [file, text] of Object.entries(texts)) {
    if (path.posix.basename(file) !== "package.json") continue;
    let p = null;
    try { p = JSON.parse(text); } catch { /* not a package's */ }
    if (!isObject(p)) continue;
    if (typeof p.name === "string") packages.set(p.name, { dir: path.posix.dirname(file), main: typeof p.main === "string" ? p.main : null });
    const names = k => Object.keys(isObject(p[k]) ? p[k] : {});
    for (const d of ["dependencies", "peerDependencies", "optionalDependencies"].flatMap(names)) { ships.add(d); declared.add(d); }
    for (const d of names("devDependencies")) declared.add(d);
  }
  return { packages, ships, declared };
}

// The system a file lies in: the one whose path reaches furthest into the file's own; null where none names it.
function systemOf(config, file) {
  let best = null, length = -1;
  for (const [name, s] of Object.entries(config.systems)) for (const p of s.paths) {
    const holds = p.endsWith("/") ? file.startsWith(p) : file === p;
    if (holds && p.length > length) { best = name; length = p.length; }
  }
  return best;
}

function markedFunctions(ctx, file, toks) {
  const seen = new Map(), marks = ctx.config.marks;
  for (const fn of functions(toks)) {
    ctx.read.functions++;
    if (fn.lines <= marks.lines && fn.depth <= marks.depth && fn.branches <= marks.branches) continue;
    const k = (seen.get(fn.name) ?? 0) + 1;
    seen.set(fn.name, k);
    add(ctx, "function", `${file}#${fn.name}${k > 1 ? `#${k}` : ""}`, fn.name, { lines: fn.lines, depth: fn.depth, branches: fn.branches, line: fn.line });
  }
}

function ownClock(ctx, file, toks) {
  const at = (run, k) => run.every((v, j) => toks[k + j].v === v && toks[k + j].t !== "str") && !(toks[k - 1]?.t === "punct" && toks[k - 1].v === ".");
  for (const run of OWN) {
    let count = 0;
    for (let k = 0; k + run.length <= toks.length; k++) if (at(run, k)) count++;
    const what = run.join("").replace("new", "new ");
    if (count) add(ctx, "clock", `${file}: ${what}`, what, { count });
  }
}

// An import that leads to no file of the project: what binds to a platform, a package the project ships with, or
// nowhere the check can tell.
function outside(ctx, from, spec, aliased) {
  const name = packageOf(spec), bound = [spec, name].find(s => ctx.config.platform.includes(s));
  if (bound) { if (from.domain !== "platform") add(ctx, "platform", `${from.file} -> ${bound}`, bound); return; }
  if (BUILTIN.has(spec)) return;
  const known = !aliased && !isRelative(spec) && !ctx.packages.has(name) && ctx.declared.has(name);
  if (known && ctx.ships.has(name)) ctx.usedBy.set(name, [...(ctx.usedBy.get(name) ?? []), from]);
  else if (!known && (toCode(spec) || !isRelative(spec))) ctx.read.nowhere++;
}

// An import from one file of the project to another: across a boundary nobody declared, or past an entrance.
function between(ctx, from, to) {
  const target = systemOf(ctx.config, to);
  if (!target || target === from.system) return;
  const pair = `${from.system ?? NONE} -> ${target}`, key = `${pair}: ${from.file} -> ${to}`, entrance = ctx.config.systems[target].entrance;
  if (from.system && !(ctx.config.systems[from.system].uses ?? []).includes(target)) add(ctx, "crossing", key, pair);
  else if (entrance && to !== entrance) add(ctx, "inside", key, pair);
}

function oneImport(ctx, from, imp) {
  ctx.read.imports++;
  const alias = Object.keys(ctx.config.aliases).filter(a => imp.spec.startsWith(a)).sort((a, b) => b.length - a.length)[0];
  const spec = alias === undefined ? imp.spec : `./${path.posix.relative(path.posix.dirname(from.file), path.posix.join(ctx.config.aliases[alias], imp.spec.slice(alias.length))) || "."}`;
  const to = resolve(from.file, spec, ctx.files, ctx.packages);
  if (!to) { outside(ctx, from, imp.spec, alias !== undefined); return; }
  if (imp.kind !== "dynamic" && !imp.types && to !== from.file) ctx.graph.set(from.file, (ctx.graph.get(from.file) ?? new Set()).add(to));
  between(ctx, from, to);
}

function oneFile(ctx, file, text) {
  const toks = tokens(text), system = systemOf(ctx.config, file), domain = system ? ctx.config.systems[system].domain ?? null : null;
  if (!system) ctx.read.unnamed++;
  if (JSX.includes(path.posix.extname(file))) ctx.read.jsx++;
  else if (!ctx.tests.has(file)) markedFunctions(ctx, file, toks);
  if (domain === "rules") ownClock(ctx, file, toks);
  for (const imp of imports(toks)) oneImport(ctx, { file, system, domain }, imp);
}

function onCycles(ctx) {
  for (const part of cycles(ctx.graph)) {
    const inside = new Set(part);
    for (const from of part) for (const to of ctx.graph.get(from) ?? []) if (inside.has(to)) add(ctx, "cycle", `${from} -> ${to}`, "cycle");
  }
}

// A package the project ships with is imported in one system: the one that wraps it, or, where none does, one alone.
function wrappedOnce(ctx) {
  for (const [name, by] of ctx.usedBy) {
    const home = ctx.config.wrapped.get(name) ?? null;
    const held = by.filter(u => u.domain !== "tools" && u.domain !== "tests" && (home ? u.system !== home : u.system));
    const breach = home ? held.length > 0 : new Set(held.map(u => u.system)).size > 1;
    if (breach) for (const u of held) add(ctx, "package", `${u.file} -> ${name}`, name);
  }
}

// What the check finds in the files given ({ path: text }, package.json files among them): `entries`, a Map of each
// breach's id to { kind, group, n }, n its numbers where it has any; and `read`, the counts of what it read. `tests`
// is the set of the files that are tests: read for their imports, not held to the marks.
export function survey(texts, config, tests = new Set()) {
  const code = Object.keys(texts).filter(f => CODE.includes(path.posix.extname(f))).sort();
  const read = { files: code.length, functions: 0, imports: 0, jsx: 0, nowhere: 0, unnamed: 0, systems: Object.keys(config.systems).length, noEntrance: Object.values(config.systems).filter(s => !s.entrance).length };
  const ctx = { config, tests, files: new Set(Object.keys(texts)), ...manifests(texts), entries: new Map(), graph: new Map(), usedBy: new Map(), read };
  for (const file of code) oneFile(ctx, file, texts[file]);
  onCycles(ctx);
  wrappedOnce(ctx);
  return { entries: ctx.entries, read };
}

// ---- the baseline ----

// A listed entry's kind and group, from its id alone (the baseline holds ids and numbers, nothing more).
export function groupOf(id) {
  const kind = id.slice(0, id.indexOf(": ")), key = id.slice(kind.length + 2);
  if (kind === "function") return { kind, group: key.slice(key.indexOf("#") + 1).replace(/#\d+$/u, "") };
  if (kind === "crossing" || kind === "inside") return { kind, group: key.slice(0, key.indexOf(": ")) };
  if (kind === "cycle") return { kind, group: "cycle" };
  if (kind === "clock") return { kind, group: key.slice(key.lastIndexOf(": ") + 2) };
  return { kind, group: key.slice(key.lastIndexOf(" -> ") + 4) };
}

const NUMBERS = ["lines", "depth", "branches", "count"];
// Whether an entry's numbers are within a listed one's: each no more than listed, or, for a function, than its mark.
const within = (n, listed, marks) => n === true || listed === true || NUMBERS.every(k => (n[k] ?? 0) <= Math.max(listed[k] ?? 0, marks[k] ?? 0));
const size = n => (n === true ? 0 : NUMBERS.reduce((s, k) => s + (n[k] ?? 0), 0));

// The entries of `want` that nothing in `pool` covers: each claims one entry of the pool, the one of its own id where
// its numbers are within that one's, else one of its kind and group that no entry of `want` stands under any more (what
// was listed moved, under its name), the smallest that covers it. Both are Maps of id to numbers (or true).
export function unclaimed(want, pool, marks = {}) {
  const free = new Map(pool), later = [], left = [];
  for (const [id, n] of want) { if (free.has(id) && within(n, free.get(id), marks)) free.delete(id); else later.push([id, n]); }
  for (const id of want.keys()) free.delete(id); // one that stands, and grew, lends its place to no other
  for (const [id, n] of later) {
    const { kind, group } = groupOf(id);
    const covers = ([other, listed]) => { const o = groupOf(other); return o.kind === kind && o.group === group && within(n, listed, marks); };
    const fit = [...free].filter(covers).sort((a, b) => size(a[1]) - size(b[1]) || a[0].localeCompare(b[0]))[0];
    if (fit) free.delete(fit[0]); else left.push(id);
  }
  return left;
}

const numbersOf = n => (n === true ? true : Object.fromEntries(NUMBERS.filter(k => k in n).map(k => [k, n[k]])));
const sorted = map => Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)));
const anEntry = v => v === true || (isObject(v) && Object.keys(v).length > 0 && Object.entries(v).every(([k, n]) => NUMBERS.includes(k) && Number.isInteger(n) && n >= 0));
const said = (grown, id) => (grown[id] ?? "").trim().length > 0;

// A baseline's text as the check reads it: { listed, grown, audited }, listed a Map of id to numbers; it throws a
// Refused where the text is none.
export function parseBaseline(text, at, restore) {
  let b;
  try { b = JSON.parse(text); } catch { refuse(`${at} could not be read as JSON`, restore); }
  if (!isObject(b) || !isObject(b.listed) || !Object.entries(b.listed).every(([id, v]) => /^[a-z]+: \S/u.test(id) && anEntry(v))) refuse(`${at} has no "listed" object of entries the check reads`, restore);
  if (!optional(b.grown, g => isObject(g) && Object.values(g).every(v => typeof v === "string"))) refuse(`"grown" in ${at} is not an object of reasons`, "give each entry that had to join, by its id, its reason in a sentence, or take \"grown\" out");
  return { listed: new Map(Object.entries(b.listed)), grown: b.grown ?? {}, audited: isObject(b.audited) ? b.audited : null };
}

// A baseline as the check writes it: what was audited and what grew kept, the entries sorted.
const written = (listed, grown, audited) => `${JSON.stringify({ ...(audited ? { audited } : {}), ...(Object.keys(grown).length ? { grown } : {}), listed: sorted(listed) }, null, 2)}\n`;

// ---- the project's files ----

const SAFE = ["-c", "core.fsmonitor=false"];
const git = (args, opts = {}) => execFileSync("git", [...SAFE, ...args], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["pipe", "pipe", "ignore"], ...opts });
const lsFiles = (specs, root) => (specs.length ? git(["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...specs], { cwd: root }).split("\0").filter(Boolean) : []);
const readable = f => CODE.includes(path.posix.extname(f)) || path.posix.basename(f) === "package.json";
const PACKAGES = ":(glob)**/package.json";

// The project's files as they stand in the working folder: { texts, tests }, never through a link.
export function standing(config, root = ".") {
  const texts = {};
  for (const f of new Set([...lsFiles([...config.code, ...config.tests], root), ...lsFiles([PACKAGES], root)].filter(readable))) {
    try { if (!fs.lstatSync(path.join(root, f)).isSymbolicLink()) texts[f] = fs.readFileSync(path.join(root, f), "utf8"); } catch { /* listed, not on disk */ }
  }
  return { texts, tests: new Set(lsFiles(config.tests, root)) };
}

// The same files as a commit holds them, read through an index of its own, so that the pathspecs mean what they mean
// in the working folder; a link and a submodule are passed over.
export function standingAt(commit, config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shape-")), env = { ...process.env, GIT_INDEX_FILE: path.join(dir, "index") };
  try {
    git(["read-tree", commit], { env });
    const aFile = m => m && m[1] !== "120000" && m[1] !== "160000" && !m[3].includes("\n");
    const staged = specs => (specs.length ? git(["ls-files", "-z", "--stage", "--", ...specs], { env }).split("\0").map(l => /^(\d+) ([0-9a-f]+) \d\t([\s\S]+)$/u.exec(l)).filter(aFile) : []);
    const wanted = new Map([...staged([...config.code, ...config.tests]), ...staged([PACKAGES])].filter(m => readable(m[3])).map(m => [m[3], m[2]]));
    const out = execFileSync("git", [...SAFE, "cat-file", "--batch"], { input: `${[...wanted.values()].join("\n")}\n`, maxBuffer: 1 << 30, stdio: ["pipe", "pipe", "ignore"] });
    const texts = {};
    let at = 0;
    for (const file of wanted.keys()) {
      const end = out.indexOf(10, at), bytes = Number(out.subarray(at, end).toString().split(" ")[2]);
      texts[file] = out.subarray(end + 1, end + 1 + bytes).toString("utf8");
      at = end + 1 + bytes + 1;
    }
    return { texts, tests: new Set(staged(config.tests).map(m => m[3])) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// The config the manifest's *shape check* row names (its first path to a .json file, in backticks), else the kit's.
export const where = manifest => /`([\w./-]+\.json)`/u.exec(/^.*\*shape check\*.*$/mu.exec(String(manifest ?? ""))?.[0] ?? "")?.[1] ?? KIT;

// ---- the verdict ----

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const UNIT = { lines: "lines", depth: "deep", branches: "branch points", count: "in all" };
const show = (id, n) => `${id.slice(id.indexOf(": ") + 2)}${n === true ? "" : `${n.line ? ` (line ${n.line})` : ""}: ${NUMBERS.filter(k => k in n).map(k => `${n[k]} ${UNIT[k]}`).join(", ")}`}`;
const some = (ids, entries) => ids.slice(0, 20).map(id => `  ${show(id, entries.get(id) ?? true)}`).concat(ids.length > 20 ? [`  and ${ids.length - 20} more`] : []);

// What a new breach of each kind is, and its mend, in words a session acts on with no rule file open.
const SAID = {
  function: (n, c) => [`${plural(n, "function passes", "functions pass")} a mark (${c.marks.lines} lines, ${c.marks.depth} blocks deep, ${c.marks.branches} branch points) that stood under it before, or ${n === 1 ? "grows" : "grow"} past what the baseline lists`,
    "split each by what it does into functions under the marks, its tests proving that it behaves as before"],
  crossing: n => [`${plural(n, "import crosses", "imports cross")} from one system into another that it does not declare it uses`,
    "take what is needed through a system this one may use, or have it passed in; where the dependency is meant, name the other system under this one's \"uses\" in the config (the rules use nothing outward, and no two systems use each other)"],
  inside: n => [`${plural(n, "import reaches", "imports reach")} inside a system, past its entrance`, "import from the system's entrance, the file its \"entrance\" names in the config, and add there what the system is to offer"],
  cycle: n => [`${plural(n, "import lies", "imports lie")} on a cycle between files that did not stand before`, "turn one import of the cycle round: move what both files need into a file that imports neither, or pass it in"],
  platform: n => [`${plural(n, "import binds", "imports bind")} code to one platform outside the system declared for that`, "move the code that needs it into the system of the domain \"platform\", and have the rest call what that system offers, so that the rest builds and tests wherever the project's checks run"],
  package: n => [`${plural(n, "import takes", "imports take")} a package the project ships with outside the one system that wraps it`, "import it in one system alone, named under that system's \"wraps\" in the config, and have the others use what that system offers"],
  clock: n => [`${plural(n, "file", "files")} of the rules ${n === 1 ? "reads" : "read"} the clock or ${n === 1 ? "makes" : "make"} randomness of ${n === 1 ? "its" : "their"} own`, "pass the time and the source of randomness in as arguments, so that the same input gives the same result"],
};

// The breaches no entry of the baseline covers. One that only moved, under its name, claims its old entry and is
// none: the old entry is stale, and --write lists it where it stands now. One that the base held already, as this
// config reads the base's code, is no new breach either: the check reads more than it did (a system named, a mark
// lowered), or the baseline was lowered in this same change past what stands, and --write, told the base, lists it.
// The rest are new, each kind with its mend.
function fresh({ config, at, self, found, baseline, current, base }) {
  let news = unclaimed(current, baseline.listed, config.marks);
  const fail = [];
  if (base && news.length) {
    const left = new Set(unclaimed(new Map(news.map(id => [id, current.get(id)])), base.stood(), config.marks));
    const readMore = news.filter(id => !left.has(id));
    news = news.filter(id => left.has(id));
    if (readMore.length) fail.push([`FAIL: ${plural(readMore.length, "breach", "breaches")} that ${base.name} held already ${readMore.length === 1 ? "is" : "are"} not in ${config.baseline}: the config reads more than it did, or the baseline was lowered past what stands. Mend: list them with SHAPE_BASE=${base.name} node ${self} ${at} --write, and commit the baseline`, ...some(readMore, current)]);
  }
  const byKind = new Map();
  for (const id of news) { const k = found.entries.get(id).kind; byKind.set(k, [...(byKind.get(k) ?? []), id]); }
  for (const [kind, ids] of byKind) { const [what, mend] = SAID[kind](ids.length, config); fail.push([`FAIL: ${what}. Mend: ${mend}`, ...some(ids, current)]); }
  return fail;
}

// The marks the config raises or drops against the base's: each by the id its reason stands under in "grown".
function raised(config, old) {
  const on = (mark, p) => (isObject(mark) ? mark[p] : mark); // a suite's mark on a platform, none where it names none
  const out = Object.keys(MARKS).filter(k => config.marks[k] > old.marks[k]).map(k => `mark: ${k}`);
  for (const [name, mark] of Object.entries(old.suites)) {
    const now = config.suites[name];
    const platforms = [...Object.keys(isObject(mark) ? mark : {}), ...Object.keys(isObject(now) ? now : {}), "any"];
    if (platforms.some(p => on(mark, p) !== undefined && !(on(now, p) <= on(mark, p)))) out.push(`mark: suite ${name}`);
  }
  return out;
}

const tolerant = read => { try { return read(); } catch { return null; } }; // (what the base cannot be read by holds nothing there)
const once = make => { let made = null; return () => (made ??= make()); };
// What the base held, as this config reads the base's code: each breach's id to its numbers.
const stoodAt = (base, config) => { const before = base.standing(); return new Map([...survey(before.texts, config, before.tests).entries].map(([id, e]) => [id, e.n])); };

// Against the pull request's base: what joined the baseline that the base neither listed nor held, and each mark
// raised, where "grown" gives no reason.
function againstBase({ config, at, baseline, base }) {
  const fail = [];
  const was = base.baseline === null ? null : tolerant(() => parseBaseline(base.baseline, base.name, "").listed);
  const old = base.config === null ? null : tolerant(() => parseConfig(base.config, base.name));
  let joined = unclaimed(baseline.listed, was ?? new Map(), config.marks);
  if (joined.length) joined = unclaimed(new Map(joined.map(id => [id, baseline.listed.get(id)])), base.stood(), config.marks).filter(id => !said(baseline.grown, id));
  if (joined.length) fail.push([`FAIL: ${config.baseline} lists ${plural(joined.length, "entry", "entries")} that ${base.name} neither listed nor held, and the baseline only shrinks. Mend: take each out of the baseline and mend the code as the check then says; only where there is no other way, give each its reason under "grown" in the baseline, by its id, and in the pull request, with a fresh session's word there that it found no other way`, ...some(joined, baseline.listed)]);
  const unsaid = (old ? raised(config, old) : []).filter(id => !said(baseline.grown, id));
  if (unsaid.length) fail.push([`FAIL: ${at} raises or drops ${plural(unsaid.length, "mark")} against ${base.name}. Mend: first make the code or the suite fit its mark; only where it cannot, give the raise its reason under "grown" in ${config.baseline}, by the id below, and in the pull request, with a fresh session's word there that it found no other way`, ...unsaid.map(id => `  ${id}`)]);
  return fail;
}

// What the check read and does not hold, each said, never failed.
function notesOf(read) {
  const notes = [];
  if (read.jsx) notes.push(`${plural(read.jsx, "file holds", "files hold")} JSX, whose functions the reader cannot tell: their imports are held, their functions not`);
  if (read.nowhere) notes.push(`${plural(read.nowhere, "import leads", "imports lead")} nowhere the check can tell (no file, no package the project declares, no alias the config names): not held`);
  if (read.unnamed) notes.push(`${read.unnamed} of ${plural(read.files, "file")} lie in no system the config names: held to the marks and the cycles alone`);
  if (read.noEntrance && read.systems > 1) notes.push(`${plural(read.noEntrance, "system names", "systems name")} no entrance: nothing holds what the others import from ${read.noEntrance === 1 ? "it" : "them"}`);
  return notes;
}

// The check's verdict on a project: { fail: [[line, ...details]], notes, listed, read }. `base`, where the pull
// request's base is known: { name, baseline (its text there, or null), config (its text there, or null), standing: ()
// => the base's files as `config` reads them }.
export function verdict({ config, at, self, found, baselineText, base }) {
  const restore = base ? `take it back as ${base.name} holds it (git checkout ${base.name} -- ${config.baseline}), then run node ${self} ${at} --write` : `write it again from what stands (delete it, then node ${self} ${at} --first), in a pull request the reviews read`;
  const baseline = parseBaseline(baselineText, config.baseline, restore);
  const current = new Map([...found.entries].map(([id, e]) => [id, e.n]));
  if (base) base.stood = once(() => stoodAt(base, config));
  const fail = fresh({ config, at, self, found, baseline, current, base });
  // (one that only shrank passes as it is listed: --write lowers its numbers whenever it is run)
  const stale = [...baseline.listed.keys()].filter(id => !current.has(id));
  if (stale.length) fail.push([`FAIL: ${config.baseline} lists ${plural(stale.length, "entry", "entries")} that ${stale.length === 1 ? "is" : "are"} gone or moved now. Mend: run node ${self} ${at} --write and commit the baseline it lowers`, ...some(stale, baseline.listed)]);
  if (base) fail.push(...againstBase({ config, at, baseline, base }));
  return { fail, notes: notesOf(found.read), listed: baseline.listed.size, read: found.read };
}

// ---- the commands ----

// A suite held to its time mark: the command after --, run and timed, or the time since a start the workflow took.
function timed(name, rest, usage) {
  if (rest[0] === "--since" && /^\d+$/u.test(rest[1] ?? "") && rest.length === 2) return { took: Date.now() / 1000 - Number(rest[1]), status: 0 };
  if (rest[0] !== "--" || rest.length < 2) refuse("--suite takes a name, then -- and the suite's command, or --since and the second its run started at", usage);
  const start = process.hrtime.bigint();
  const r = spawnSync(rest[1], rest.slice(2), { stdio: "inherit" });
  if (r.error) refuse(`the suite ${name} could not be started (${rest[1]})`, "name a command that runs here, with no shell, after the --");
  return { took: Number(process.hrtime.bigint() - start) / 1e9, status: r.status ?? 1 };
}

function suite(config, at, self, [name, ...rest]) {
  const mark = config.suites[name ?? ""];
  if (mark === undefined) refuse(`${at} gives the suite ${JSON.stringify(name ?? "")} no time mark`, `name it under "suites" in ${at} with its mark in seconds, set with room above what it takes today so that a slow runner fails nothing`);
  const limit = isObject(mark) ? mark[process.platform] : mark;
  const { took, status } = timed(name, rest, `run node ${self} ${at} --suite ${name} -- <command>`);
  if (status !== 0) return status; // (the suite's own failure, which says its own mend)
  if (limit !== undefined && took > limit) {
    console.error(`FAIL: the suite ${name} took ${Math.round(took)} s, past its mark of ${limit}. Mend: make it faster (set up only what each test needs, run only what the change can reach), or split it so that each part runs alone under a mark of its own; only where it cannot be, raise its mark in ${at} with the reason under "grown" in ${config.baseline} and in the pull request`);
    return 1;
  }
  console.log(`ok   the suite ${name} took ${Math.round(took)} s${limit === undefined ? `; ${at} gives it no mark on ${process.platform}` : `, within its mark of ${limit}`}`);
  return 0;
}

function first(config, at, self, numbers) {
  if (fs.existsSync(config.baseline)) refuse(`${config.baseline} exists, and --first writes only a project's first baseline`, `run node ${self} ${at} to check, or with --write to lower the baseline`);
  fs.mkdirSync(path.dirname(config.baseline), { recursive: true });
  fs.writeFileSync(config.baseline, written(numbers, {}, null));
  console.log(`${config.baseline}: the first baseline, ${plural(numbers.size, "entry", "entries")} that stand today, to be cleaned over time`);
  return 0;
}

// The baseline lowered to what still stands: an entry that is gone goes, one that moved is listed where it stands, a
// number that fell is lowered, and nothing joins but what "grown" gives a reason for and, where the base is told,
// what the base held already as this config reads its code (the check reads more than it did).
function write(config, at, self, numbers, base) {
  const old = parseBaseline(fs.readFileSync(config.baseline, "utf8"), config.baseline, `write it again from what stands (delete it, then node ${self} ${at} --first), in a pull request the reviews read`);
  let joins = unclaimed(numbers, old.listed, config.marks);
  if (base && joins.length) joins = unclaimed(new Map(joins.map(id => [id, numbers.get(id)])), stoodAt({ standing: () => standingAt(base.name, config) }, config), config.marks);
  joins = new Set(joins);
  const kept = new Map([...numbers].filter(([id]) => !joins.has(id) || said(old.grown, id)));
  const grown = Object.fromEntries(Object.entries(old.grown).filter(([id]) => kept.has(id) || id.startsWith("mark: ")));
  fs.writeFileSync(config.baseline, written(kept, grown, old.audited));
  console.log(`${config.baseline}: ${plural(kept.size, "entry", "entries")} listed, ${old.listed.size} before`);
  return 0;
}

// The base a pull request merges into, as SHAPE_BASE names it: { name, show: file => its text there or null }, or null.
function baseOf() {
  const name = process.env.SHAPE_BASE || "";
  if (!name) return null;
  if (!/^\w[\w./^~-]*$/u.test(name)) refuse(`SHAPE_BASE (${JSON.stringify(name).slice(0, 80)}) is no plain name of a commit or branch`, "set it to the pull request's base, such as origin/main");
  try { git(["rev-parse", "--verify", "--quiet", `${name}^{commit}`]); } catch { refuse(`${name} is not a commit here`, `fetch it (git fetch origin ${name.replace(/^origin\//u, "")}), or set SHAPE_BASE to the pull request's base`); }
  return { name, show: file => tolerant(() => git(["show", `${name}:${file}`])) };
}

// Where the config is: the one named, else the manifest's, else the kit's; null where the project has none yet.
function configAt(named, self, base) {
  const at = named ?? where(tolerant(() => fs.readFileSync("core-manifest.md", "utf8")));
  if (fs.existsSync(at)) return at;
  if (named) refuse(`there is no config at ${at}`, `write it as the starter kit does (core/setup/template/shape.json.tmpl), then node ${self} ${at} --first`);
  if (base?.show(at) != null) refuse(`${at} is gone, and ${base.name} holds it: no pull request takes the shape check out`, `take it back as ${base.name} holds it (git checkout ${base.name} -- ${at})`);
  console.log(`ok   the shape check is not taken here yet: no ${at} (core/setup/sync-notes.md, "how code is put together")`);
  return null;
}

function check(config, at, self, found, base) {
  if (!fs.existsSync(config.baseline)) refuse(`there is no baseline at ${config.baseline}`, `write the project's first with node ${self} ${at} --first, and commit it`);
  const v = verdict({ config, at, self, found, baselineText: fs.readFileSync(config.baseline, "utf8"),
    base: base && { name: base.name, baseline: base.show(config.baseline), config: base.show(at), standing: () => standingAt(base.name, config) } });
  for (const note of v.notes) console.log(`note ${note}`);
  if (!base) console.log("note no base to compare with (set SHAPE_BASE to the branch the work started from), so the baseline was not checked for what joined it, and what the config newly reads is not told from what is new");
  for (const line of v.fail.flat()) console.error(line);
  if (v.fail.length) return 1;
  console.log(`ok   nothing new in how the code is put together: ${plural(found.read.functions, "function")} and ${plural(found.read.imports, "import")} read, ${plural(v.listed, "old breach", "old breaches")} listed in ${config.baseline}, to be cleaned`);
  return 0;
}

function main(argv) {
  const self = path.relative(process.cwd(), process.argv[1]).replace(/\\/gu, "/");
  const named = argv[0] && !argv[0].startsWith("--") ? argv[0] : null, rest = named ? argv.slice(1) : argv;
  const base = baseOf(), at = configAt(named, self, base);
  if (at === null) return 0;
  const config = parseConfig(fs.readFileSync(at, "utf8"), at);
  if (rest[0] === "--suite") return suite(config, at, self, rest.slice(1));
  const command = { "--first": first, "--write": write }[rest[0] ?? ""];
  if (rest.length > 1 || (rest.length && !command)) refuse(`the check does not know ${rest.join(" ")}`, `run node ${self} [<config>] [--first | --write], or --suite <name> with -- <command> or --since <seconds>`);
  const now = standing(config), found = survey(now.texts, config, now.tests);
  if (!command) return check(config, at, self, found, base);
  if (command === write && !fs.existsSync(config.baseline)) refuse(`there is no baseline at ${config.baseline}`, `write the project's first with node ${self} ${at} --first, and commit it`);
  return command(config, at, self, new Map([...found.entries].map(([id, e]) => [id, numbersOf(e.n)])), base);
}

if (started(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { if (!(e instanceof Refused)) throw e; console.error(`FAIL: ${e.message}`); process.exitCode = 1; }
}
