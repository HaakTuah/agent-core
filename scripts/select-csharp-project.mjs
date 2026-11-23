// What C# compiles with beyond a file's own text, for the test selection (select-csharp.mjs, beside this file; #675):
// the global using directives MSBuild's <Using> items write, the files of C# and MSBuild git holds that the config does
// not read, and whether a file of C# lies under a .csproj's folder. Each read is held to the selection's budget (Late
// past it, which runs the whole suite). Node's own modules and git.
import fs from "node:fs";
import path from "node:path";
import { CHARACTERS, Late } from "./hurry.mjs";
import { git } from "./select-passed.mjs";

// An attribute's value in the text of an XML tag, in either quotes; undefined where the tag has none.
const attribute = (tag, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "u").exec(tag); return m ? m[1] ?? m[2] : undefined; };

// The run stopped (Late) where `what` holds `n` characters (or bytes), past CHARACTERS.
export const tooMuch = (what, n, unit = "characters") => new Late(`${what} hold ${n.toLocaleString("en")} ${unit}, past the ${CHARACTERS.toLocaleString("en")} the selection reads, so what each file of C# reaches cannot be told in time`);

// The <Using Include="N"> items of MSBuild's files, each a global using directive ({ target, alias }, an Alias="S" its
// alias), or null where one names a property ("$(...)"), whose value cannot be told here. `pace` is asked for each
// file; past CHARACTERS of them together, Late.
export function msbuildUsings(texts, pace) {
  const out = [], n = texts.reduce((sum, t) => sum + t.length, 0);
  if (n > CHARACTERS) throw tooMuch("the project's MSBuild files", n);
  for (const text of texts) {
    pace();
    for (const m of text.matchAll(/<Using\b([^<>]*)>/gu)) { // (each try ends at the next "<": linear in the text)
      const [include, alias] = ["Include", "Alias"].map(a => attribute(m[1], a));
      if (include === undefined) continue;
      if (`${include}${alias ?? ""}`.includes("$(")) return null;
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
