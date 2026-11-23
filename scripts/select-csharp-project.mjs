// What C# compiles with beyond a file's own text, for the test selection (select-csharp.mjs, beside this file; #675):
// the global using directives MSBuild's <Using> items write, the files of C# and MSBuild git holds that the config does
// not read, and whether a file of C# lies under a .csproj's folder. Each read is held to the selection's budget (Late
// past it, which runs the whole suite). Node's own modules and git.
import fs from "node:fs";
import path from "node:path";
import { CHARACTERS, Late } from "./hurry.mjs";
import { git } from "./select-passed.mjs";

// An attribute's value in the text of an XML tag, in either quotes, its name in any case (MSBuild's metadata); undefined
// where the tag has none.
const attribute = (tag, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "iu").exec(tag); return m ? m[1] ?? m[2] : undefined; };

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
  const close = /\s*<\/Using\s*>/uy;
  close.lastIndex = at;
  return close.test(text) ? out : null;
}

// The run stopped (Late) where `what` holds `n` characters (or bytes), past CHARACTERS.
export const tooMuch = (what, n, unit = "characters") => new Late(`${what} hold ${n.toLocaleString("en")} ${unit}, past the ${CHARACTERS.toLocaleString("en")} the selection reads, so what each file of C# reaches cannot be told in time`);

// The <Using Include="N"> items of MSBuild's files, each a global using directive ({ target, alias }, an Alias="S" or
// <Alias>S</Alias> its alias), and the IMPLICIT ones; or null where one holds what MSBuild expands ("$(...)" a property,
// "@(...)" an item, "%" metadata or an escape, "%2E" a "."; "&" an XML reference, "&#46;" a ".") or what the reader
// cannot tell from its metadata (children), whose value cannot be told here. `pace` is asked for each file; past
// CHARACTERS of them together, Late.
export function msbuildUsings(texts, pace) {
  const out = IMPLICIT.map(target => ({ target, alias: null })), n = texts.reduce((sum, t) => sum + t.length, 0);
  if (n > CHARACTERS) throw tooMuch("the project's MSBuild files", n);
  for (const text of texts) {
    pace();
    for (const m of text.matchAll(/<Using\b([^<>]*)>/gu)) { // (each try ends at the next "<": linear in the text)
      const meta = m[1].trimEnd().endsWith("/") ? {} : children(text, m.index + m[0].length);
      if (meta === null) return null;
      const [include, alias] = ["Include", "Alias"].map(a => attribute(m[1], a) ?? meta[a.toLowerCase()]);
      if (include === undefined) continue;
      if (/\$\(|@\(|%|&/u.test(`${include}${alias ?? ""}`)) return null;
      for (const s of include.split(";")) { const target = s.trim().replace(/^global::/u, ""); if (target) out.push({ target, alias: alias?.trim() || null }); } // (a spread of many outruns the stack)
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
