// What C# compiles with beyond a file's own text, for the test selection (select-csharp.mjs, beside this file; #675):
// the global using directives MSBuild's <Using> items write, the files of C# and MSBuild git holds that the config does
// not read, and whether a file of C# lies under a .csproj's folder. Each read is held to the selection's budget (Late
// past it, which runs the whole suite). Node's own modules and git.
import fs from "node:fs";
import path from "node:path";
import { CHARACTERS, Late } from "./hurry.mjs";
import { git } from "./select-passed.mjs";

// The attributes of an XML tag's text ({ include: "App" }, each name in lower case: MSBuild's metadata), read as a run
// of name="value" pairs (either quotes) from its start, so a name in another's value is none; null where anything else
// stands there.
function attributes(tag) {
  const pair = /\s*([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/uy, out = {};
  let at = 0;
  for (let m; (pair.lastIndex = at, m = pair.exec(tag)); at = pair.lastIndex) out[m[1].toLowerCase()] = m[2] ?? m[3];
  return /^\s*\/?$/u.test(tag.slice(at).trimEnd()) ? out : null; // (one "\s*": two would backtrack)
}

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

// The <Using Include="N"> items of MSBuild's files, each a global using directive ({ target, alias }, an Alias="S" or
// <Alias>S</Alias> its alias, both where both stand), and the IMPLICIT ones; or null where one holds an Update, a tag
// that is no run of attributes, or what MSBuild expands ("$(...)" a property,
// "@(...)" an item, "%" metadata or an escape, "%2E" a "."; "&" an XML reference, "&#46;" a ".") or what the reader
// cannot tell from its metadata (children), whose value cannot be told here. `pace` is asked for each file; past
// CHARACTERS of them together, Late.
export function msbuildUsings(texts, pace) {
  const out = IMPLICIT.map(target => ({ target, alias: null })), n = texts.reduce((sum, t) => sum + t.length, 0);
  if (n > CHARACTERS) throw tooMuch("the project's MSBuild files", n);
  for (const text of texts) {
    pace();
    for (const m of text.matchAll(/<Using\b([^<>]*)>/giu)) { // (an item type in any case; each try ends at the next "<": linear)
      const attrs = attributes(m[1]), meta = !attrs || m[1].trimEnd().endsWith("/") ? {} : children(text, m.index + m[0].length);
      if (!attrs || meta === null || "update" in attrs) return null; // (an Update changes an item the reader took already)
      const include = attrs.include ?? meta.include, given = [attrs.alias, meta.alias].map(a => a?.trim()).filter(Boolean);
      if (include === undefined) continue;
      if (/\$\(|@\(|%|&/u.test(`${include}${given.join("")}`)) return null;
      for (const s of include.split(";")) { const target = s.trim().replace(/^global::/u, ""); if (target) for (const alias of given.length ? given : [null]) out.push({ target, alias }); } // (a spread of many outruns the stack)
    }
  }
  return out;
}

// What git holds that the config does not read and C# compiles with: { msbuild: [the texts of each .props and .targets],
// cs: { path: text } of each file of C# }, a link read as no text; { unknown: true } where git cannot be asked or a file
// cannot be read; past CHARACTERS bytes of them, Late. `listed` gives the files git holds of those kinds.
export function heldBeside(texts, listed = () => git(["ls-files", "-z", "--", ":(glob)**/*.props", ":(glob)**/*.targets", ":(glob)**/*.cs"]).split("\0")) {
  let n = 0;
  try {
    const held = listed().filter(f => f && !(f in texts));
    const text = f => { const st = fs.lstatSync(f); if ((n += st.isFile() ? st.size : 0) > CHARACTERS) throw tooMuch("the files git holds beside", n, "bytes"); return st.isFile() ? fs.readFileSync(f, "utf8") : ""; };
    return { msbuild: held.filter(f => !f.endsWith(".cs")).map(text), cs: Object.fromEntries(held.filter(f => f.endsWith(".cs")).map(f => [f, text(f)])) };
  } catch (e) { if (e instanceof Late) throw e; return { unknown: true }; }
}

// A file of C# that lies under no .csproj's folder: no project compiles it by default, and one may by a path written
// out (<Compile Include>), so what reaches it cannot be told.
export function ofNoProject(file, texts) {
  return !Object.keys(texts).some(f => f.endsWith(".csproj") && file.startsWith(path.posix.dirname(f) === "." ? "" : `${path.posix.dirname(f)}/`));
}

// Global using directives of each namespace the files of C# declare (facts, a Map of a file to its facts) outside the
// root namespace of every project, among `texts`: a package's own .props may import one by a <Using> git does not hold
// (Aspire's, MAUI's), and one more namespace seen only links more. None is a root where a .props or .targets sets one.
export function outside(texts, facts, pace) {
  const roots = new Map(), end = Symbol("root"); // (a tree of the roots' words, so a namespace is walked once: linear)
  const msbuild = Object.entries(texts).filter(([f]) => /\.(csproj|props|targets)$/u.test(f));
  const shared = msbuild.some(([f, t]) => !f.endsWith(".csproj") && ROOT.test(t));
  for (const [f, t] of shared ? [] : msbuild.filter(([f]) => f.endsWith(".csproj"))) {
    const words = rootOf(f, t);
    if (!words) continue;
    let n = roots;
    for (const w of words) { pace(); n = n.get(w) ?? n.set(w, new Map()).get(w); }
    n.set(end, true);
  }
  const under = ns => { let n = roots; for (const w of ns.split(".")) { n = n.get(w); if (!n) return false; if (n.has(end)) return true; } return false; };
  const out = new Set();
  for (const x of facts.values()) for (const ns of x.placed) { pace(); if (ns && !under(ns)) out.add(ns); }
  return [...out].map(target => ({ target, alias: null }));
}

const ROOT = /<RootNamespace[\s/>]/iu;
// The words of a .csproj's root namespace (its <RootNamespace>, else its name), or null where its <RootNamespace> is not
// one plain element of words: it then adds no root, and more is outside.
function rootOf(f, t) {
  const given = /<RootNamespace\s*>([^<]*)<\/RootNamespace\s*>/iu.exec(t)?.[1].trim(); // (no two runs share a space: linear)
  const tags = t.match(/<RootNamespace[\s/>]/giu)?.length ?? 0;
  return tags > 1 || (tags && !/^[\p{L}\p{N}_.]+$/u.test(given ?? "")) ? null : (given ?? path.posix.basename(f, ".csproj")).split(".");
}
