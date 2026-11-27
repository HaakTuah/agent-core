// What C# compiles with beyond a file's own text, for the test selection (select-csharp.mjs, beside this file; #675):
// the global using directives MSBuild's <Using> items write, the files of C# and MSBuild git holds that the config does
// not read (and whether one compiles C# it never reads: select-csharp-compiles.mjs), and whether a file of C# lies under
// a .csproj's folder. Each read is held to the selection's budget (Late past it, which runs the whole suite). Node's own
// modules and git.
import fs from "node:fs";
import path from "node:path";
import { CHARACTERS, Late } from "./hurry.mjs";
import { importPath, plainText } from "./nuget.mjs";
import { git } from "./select-passed.mjs";
import { COMPILED, CS, SOLUTION, attributes, buildsOther, compilesOther } from "./select-csharp-compiles.mjs";

export { CS };

// The namespaces a project's SDK or test framework imports with no <Using> git holds, where ImplicitUsings is on (the
// SDKs' own .props, Web, Worker, Windows desktop and Blazor's; xUnit v3's, MSTest's and TUnit's). Each is taken as a
// global using in every project, on or off: one more seen namespace only links more.
const IMPLICIT = ["System", "System.Collections.Generic", "System.IO", "System.Linq", "System.Net.Http", "System.Net.Http.Json", "System.Threading",
  "System.Threading.Tasks", "System.Drawing", "System.Windows.Forms", "Microsoft.AspNetCore.Builder", "Microsoft.AspNetCore.Hosting", "Microsoft.AspNetCore.Http",
  "Microsoft.AspNetCore.Routing", "Microsoft.AspNetCore.Components.WebAssembly.Hosting", "Microsoft.Extensions.Configuration",
  "Microsoft.Extensions.DependencyInjection", "Microsoft.Extensions.Hosting", "Microsoft.Extensions.Logging", "Xunit",
  "Microsoft.VisualStudio.TestTools.UnitTesting", "TUnit.Core", "TUnit.Assertions", "TUnit.Assertions.Extensions"];

// The metadata a <Using> item gives as elements of its own ({ alias: "D" } of "<Alias>D</Alias>", a name in any case),
// read from `at`, past its opening tag, to its "</Using>"; null where anything else stands there (a comment among them).
function children(text, at) {
  const child = /\s*<(\w+)\s*>([^<]*)<\/\1\s*>/uy, out = {};
  for (let m; (child.lastIndex = at, m = child.exec(text)); at = child.lastIndex) out[m[1].toLowerCase()] = m[2];
  const close = /\s*<\/Using\s*>/iuy;
  close.lastIndex = at;
  return close.test(text) ? out : null;
}

// The run stopped (Late) where `what` holds `n` characters (or bytes), past CHARACTERS.
export const tooMuch = (what, n, unit = "characters") => new Late(`${what} hold ${n.toLocaleString("en")} ${unit}, past the ${CHARACTERS.toLocaleString("en")} the selection reads, so what each file of C# reaches cannot be told in time`);

// Each target of an Include (";" between them) with each alias given, put in `out` once (`seen` holds those put),
// `pace` asked for each, an alias's "@" dropped as the tokens drop it; false where a target or an alias is no plain name.
function targets(out, seen, include, given, pace) {
  const aliases = given.map(a => /^@?[\p{L}\p{N}_]+$/u.test(a) ? a.replace(/^@/u, "") : null);
  if (aliases.includes(null)) return false;
  for (const s of include.split(";")) {
    const target = s.trim().replace(/^global::/u, "");
    if (!target) continue;
    if (!/^[\p{L}\p{N}_]+(?:\.[\p{L}\p{N}_]+)*$/u.test(target)) return false; // (words between dots: linear)
    for (const alias of aliases.length ? aliases : [null]) { pace(); const key = alias === null ? target : `${target}\0${alias}`; if (!seen.has(key)) { seen.add(key); out.push({ target, alias }); } } // (a spread of many outruns the stack)
  }
  return true;
}

// Whether the text of the file `f` imports a file other than a .props or .targets that git holds (`known`): git's .xml
// or .proj, or a file outside the repository, may hold a <Using> the reader never sees. Each part of an <Import>'s Project, split at ";" and trimmed, is read as one only where it ends in ".props" or
// ".targets", in lower case as git lists them, and holds nothing MSBuild expands but its reserved path properties
// ($(MSBuildThisFileDirectory) and its kin, which no file can set, where another $(MSBuild…) can be) and
// GetDirectoryNameOfFileAbove of such: a part written whole as GetPathOfFileAbove('….props', …) too. Any other part
// ($(X).props, whose X may hold ";", or a property function that ends elsewhere) is another file, and so is a property
// that may name a file MSBuild or the SDK imports by it: one named Custom{Before,After}…, any whose name holds Props,
// Targets or Profile (DirectoryBuildTargetsPath, AfterMicrosoftNETSdkTargets, NuGetRestoreTargets, PublishProfile…),
// and the extensions' paths, whose ImportBefore and ImportAfter folders it imports. Each part that is one must lead,
// as MSBuild reads it (nuget.mjs's importPath: relative to `f`'s folder), to a file of `known`; one found above a folder
// (GetPathOfFileAbove, GetDirectoryNameOfFileAbove), from `f`'s folder or one $(MSBuildThisFileDirectory) heads, to one
// `known` holds at that folder or above it, since past the repository's top it would read a file git does not hold.
// (Each regex is anchored, its alternatives start apart, and a run of spaces is read by one part alone: linear.)
const RESERVED = "MSBuild(?:ThisFile(?:Directory(?:NoRoot)?|Extension|FullPath|Name)?|Project(?:Directory(?:NoRoot)?|Extension|File|FullPath|Name)|StartupDirectory)";
const PATH = String.raw`(?:[^$%@&;'"()]|\$\(${RESERVED}\))`;
const PART = new RegExp(String.raw`^(?:${PATH}|\$\(\[MSBuild\]::GetDirectoryNameOfFileAbove\((?:${PATH}|'(?:${PATH})*')*\)\))*\.(?:props|targets)$`, "u");
const ABOVE = new RegExp(String.raw`^\$\(\[MSBuild\]::GetPathOfFileAbove\(\s*'?((?:[^\s$%@&;'"(),][^$%@&;'"(),]*)?\.(?:props|targets))'?\s*(?:,((?:${PATH}|'(?:${PATH})*')*))?\)\)$`, "u");
const NAME_ABOVE = /^\$\(\[MSBuild\]::GetDirectoryNameOfFileAbove\(((?:[^,()]|\$\(MSBuildThisFileDirectory\))*),([^,()]*)\)\)(.*)$/iu;
// Such a property names no file where its element is empty (<TargetFrameworkProfile />), or, of a switch named Import…
// (ImportDirectoryBuildProps), holds only true or false; any other content, or an attribute, may name one, and so may
// an extensions' path even empty, which roots its ImportBefore and ImportAfter folders at the drive's top.
const HOOK = /<((?:Custom(?:Before|After)|[\w.]*(?:Props|Targets|Profile)|MSBuild(?:User)?ExtensionsPath)[\w.]*)/giu;
const BARE = /\s*(?:\/>|>(?:\s*(true|false))?\s*<\/([\w.]+)\s*>)/yiu;
function importsOther(text, f, { known, folders, found }, pace) {
  for (const m of text.matchAll(HOOK)) {
    BARE.lastIndex = m.index + m[0].length;
    const b = BARE.exec(text);
    if (!b || (b[2] !== undefined && b[2] !== m[1]) || (b[1] !== undefined && !/^Import/u.test(m[1])) || /^MSBuild(?:User)?ExtensionsPath/iu.test(m[1])) return true;
  }
  const inside = at => at !== null && at !== "" && known.has(at);
  // (the folder at or above `start` that holds the file `name`, as git lists it: "" the top; null where none does, where
  // `start` is no folder a file of `folders` lies in, or `name` is more than a file's name, or one Windows reads otherwise (`C:a.props`, a wildcard); the answer kept in `found` for
  // each folder climbed, and `pace` asked at each, each a slice of the last: each folder climbed once a name)
  const above = (start, name) => {
    const s = start === undefined ? "$(MSBuildThisFileDirectory)" : start.trim().replace(/^'|'$/gu, "").trim();
    let d = /^\$\(MSBuildThisFileDirectory\)/iu.test(s) && !s.includes("%") ? importPath(f, `${s}/.`, { anchored: true }) : null;
    if (d === null || d === "" || !/^[^\s$%@&;'"(),/\\:*?<>|]+$/u.test(name) || name === "." || name === "..") return null;
    if (d === ".") d = "";
    if (!folders.has(d)) return null;
    return climb(d, name, { known, found }, pace);
  };
  // (`pace` asked for each part, so a part whose search `found` already keeps asks it too)
  const leads = p => {
    pace();
    const a = ABOVE.exec(p), n = !a && NAME_ABOVE.exec(p);
    if (a) return above(a[2], a[1]) !== null;
    // (MSBuild writes the folder found with no separator after it, and the rest straight on: only a rest that opens with
    // one, and is a path to a .props or .targets as a part is, leads beside it)
    if (n) { const d = above(n[1], n[2].trim().replace(/^'|'$/gu, "")); return d !== null && /^[\\/][^$%@&;'"()]*\.(?:props|targets)$/u.test(n[3]) && inside(importPath(path.posix.join(d, "_"), n[3].slice(1))); }
    return PART.test(p) && inside(importPath(f, p));
  };
  for (const m of text.matchAll(/<Import\b([^<>]*)>/giu)) if (!(attributes(m[1])?.project ?? "").split(";").every(p => leads(p.trim()))) return true;
  return false;
}

// The folder at or above `d` that holds `name` among `known`, or null: climbed a folder at a time, each a slice of the
// last, until one whose answer `found` keeps, which then keeps the answer for each folder climbed.
function climb(d, name, { known, found }, pace) {
  const climbed = [];
  let at = null;
  for (; ; d = d.slice(0, Math.max(d.lastIndexOf("/"), 0))) {
    pace();
    const k = `${d}\0${name}`;
    if (found.has(k)) { at = found.get(k); break; }
    climbed.push(k);
    if (known.has(d ? `${d}/${name}` : name)) { at = d; break; }
    if (d === "") break;
  }
  for (const k of climbed) found.set(k, at);
  return at;
}

// Each folder a file of `known` lies in, or one above it, "" the top: the only folders a search above can start from.
function foldersOf(known, pace) {
  const folders = new Set([""]);
  for (const f of known) for (let i = f.indexOf("/"); i >= 0; i = f.indexOf("/", i + 1)) { pace(); folders.add(f.slice(0, i)); }
  return folders;
}

// The <Using Include="N"> items of MSBuild's files, each a global using directive ({ target, alias }, an Alias="S" or
// <Alias>S</Alias> its alias, both where both stand), and the IMPLICIT ones; or null where one holds an Update, a tag
// that is no run of attributes, or what MSBuild expands ("$(...)" a property,
// "@(...)" an item, "%" metadata or an escape, "%2E" a "."; "&" an XML reference, "&#46;" a "."), what the reader
// cannot tell from its metadata (children), or a target or alias that is no plain name (an array's, a tuple's, a
// nullable type's), whose value cannot be told here; or null where one imports a file other than a .props or
// .targets git holds (importsOther), or compiles a file of C# not among `cs` (compilesOther). `entries` gives each
// file's name and text; `pace` is asked for each file and each target; past CHARACTERS of them together, Late.
export function msbuildUsings(entries, pace, cs = new Set()) {
  const out = IMPLICIT.map(target => ({ target, alias: null })), seen = new Set(), n = entries.reduce((sum, [, t]) => sum + t.length, 0);
  const known = new Set(entries.map(([f]) => f)), found = new Map(), folders = foldersOf(known, pace);
  if (n > CHARACTERS) throw tooMuch("the project's MSBuild files", n);
  for (const [f, text] of entries) {
    pace();
    if (importsOther(text, f, { known, folders, found }, pace) || compilesOther(text, f, { cs, known }, pace)) return null;
    for (const m of text.matchAll(/<Using\b([^<>]*)>/giu)) { // (an item type in any case; each try ends at the next "<": linear)
      const attrs = attributes(m[1]), meta = !attrs || m[1].trimEnd().endsWith("/") ? {} : children(text, m.index + m[0].length);
      if (!attrs || meta === null || "update" in attrs) return null; // (an Update changes an item the reader took already)
      const include = attrs.include ?? meta.include, given = [attrs.alias, meta.alias].map(a => a?.trim()).filter(Boolean);
      if (include === undefined) { if ("remove" in attrs) continue; return null; } // (an item definition's Alias or Static applies to every <Using>)
      if (/\$\(|@\(|%|&/u.test(`${include}${given.join("")}`)) return null;
      if (!targets(out, seen, include, given, pace)) return null;
    }
  }
  return out;
}

// The texts MSBuild reads as a project's: a .csproj and what it imports by name or beside it.
export const MSBUILD = /\.(?:csproj|props|targets|csproj\.user|pubxml|pubxml\.user)$/iu; // (in any case, as MSBuild finds them on Windows)

// What git holds that the config does not read and C# compiles with: { msbuild: { path: text } of each .csproj (one in
// another case, say, which MSBuild builds on Windows), .props, .targets, .csproj.user, which MSBuild imports beside its .csproj, and .pubxml and .pubxml.user, which the SDK imports by a
// publish profile, cs: { path: text } of each file of C# }; { unknown: true } where git cannot be asked, a file cannot
// be read or is not UTF-8 (nuget.mjs's plainText: UTF-16, say, which MSBuild and the compiler read and this would not),
// a link among them (never followed) too, or a path holds a control character (a line break in a file's name splits
// the compiler's response file), or a Directory.Build.rsp stands, whose switches may set any property with no element
// to read, or a project of another kind (a .proj, a .vbproj: any *.*proj but a .csproj), which a <ProjectReference> may
// build and whose targets may write files, or a solution builds anything but a .csproj held (buildsOther), or a file
// the SDK compiles to C# stands (COMPILED), or git holds a link or a submodule anywhere, since a wildcard inside, the SDK's default **/*.cs among
// them, would follow a link out of the repository or take a submodule's files, which git does not list here; past
// CHARACTERS bytes of them, Late. `pace` is asked before each file is read; `listed` gives the files git holds of those
// kinds, `linked` whether git holds a link or a submodule (mode 120000 or 160000).
export function heldBeside(texts, pace = () => {}, listed = () => git(["ls-files", "-z", "--", ...["*.csproj", "*.props", "*.targets", "*.csproj.user", "*.pubxml", "*.pubxml.user", "Directory.Build.rsp", "*.*proj", "*.sln", "*.slnx", "*.slnf", "*.razor", "*.cshtml", "*.xaml", "*.axaml", "*.cs"].map(p => `:(glob,icase)**/${p}`)]).split("\0"),
  linked = () => git(["ls-files", "-s", "-z"]).split("\0").some(e => /^1[26]0000 /u.test(e))) {
  let n = 0;
  try {
    if (linked()) return { unknown: true };
    const every = listed().filter(Boolean), held = every.filter(f => !(f in texts)), all = [...every, ...Object.keys(texts)];
    if (all.some(f => /[\0-\x1f\x7f]/u.test(f) || path.posix.basename(f).toLowerCase() === "directory.build.rsp" || /\.[^/.]*proj$/iu.test(f) && !/\.csproj$/iu.test(f) || COMPILED.test(f))) return { unknown: true };
    const text = f => { pace(); const st = fs.lstatSync(f); if (!st.isFile()) throw new Error(`${f} is no file`); if ((n += st.size) > CHARACTERS) throw tooMuch("the files git holds beside", n, "bytes"); const t = plainText(fs.readFileSync(f)); if (t === null) throw new Error(`${f} is not UTF-8`); return t; };
    const lower = re => new Set(all.filter(f => re.test(f)).map(f => f.toLowerCase())), projects = lower(/\.csproj$/iu), solutions = lower(/\.slnx?$/iu);
    if (all.filter(f => SOLUTION.test(f)).some(f => buildsOther(f, f in texts ? texts[f] : text(f), projects, solutions))) return { unknown: true };
    return { msbuild: Object.fromEntries(held.filter(f => !CS.test(f) && !SOLUTION.test(f)).map(f => [f, text(f)])), cs: Object.fromEntries(held.filter(f => CS.test(f)).map(f => [f, text(f)])) };
  } catch (e) { if (e instanceof Late) throw e; return { unknown: true }; }
}

// A file of C# that lies under no .csproj's folder: no project compiles it by default, and one may by a path written
// out (<Compile Include>), so what reaches it cannot be told.
export function ofNoProject(file, texts) {
  return !Object.keys(texts).some(f => f.endsWith(".csproj") && file.startsWith(path.posix.dirname(f) === "." ? "" : `${path.posix.dirname(f)}/`));
}

// Global using directives of each namespace the files of C# declare (facts, a Map of a file to its facts) outside the
// root namespace of every project, among `texts` and `others` ({ path: text } of the MSBuild files git holds beside them): a
// package's own .props may import one by a <Using> git does not hold (Aspire's, MAUI's), and one more namespace seen only
// links more. A project's root is its name; none where a .props or .targets sets one.
export function outside(texts, facts, pace, others = {}) {
  const roots = new Map(), end = Symbol("root"); // (a tree of the roots' words, so a namespace is walked once: linear)
  const msbuild = Object.entries(texts).filter(([f]) => MSBUILD.test(f));
  const shared = [...Object.values(others), ...msbuild.filter(([f]) => !f.endsWith(".csproj")).map(([, t]) => t)].some(t => ROOT.test(t));
  for (const [f, t] of shared ? [] : msbuild.filter(([f]) => f.endsWith(".csproj"))) {
    if (ROOT.test(t) || /<Import[\s/>]/iu.test(t)) continue; // (see ROOT below)
    let n = roots;
    for (const w of path.posix.basename(f, ".csproj").split(".")) { pace(); n = n.get(w) ?? n.set(w, new Map()).get(w); }
    n.set(end, true);
  }
  const under = ns => { let n = roots; for (const w of ns.split(".")) { n = n.get(w); if (!n) return false; if (n.has(end)) return true; } return false; };
  const out = new Set();
  for (const x of facts.values()) for (const ns of x.placed) { pace(); if (ns && !under(ns)) out.add(ns); }
  return [...out].map(target => ({ target, alias: null }));
}

// (a project that names a <RootNamespace> anywhere, or imports a file that may set one, adds no root, and more is
// outside: what MSBuild evaluates of it, a condition, a comment or another file, cannot be told without evaluating it)
const ROOT = /<RootNamespace[\s/>]/iu;
