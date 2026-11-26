// Whether an MSBuild file compiles C# the test selection's reader never reads (select-csharp-project.mjs, beside this
// file; #675), and the attributes of an XML tag, which both read. Node's own modules.
import path from "node:path";
import { importPath } from "./nuget.mjs";

export const CS = /\.cs$/iu; // (a file of C#, in any case, as MSBuild compiles it on Windows)

// The attributes of an XML tag's text ({ include: "App" }, each name in lower case: MSBuild's metadata), read as a run
// of name="value" pairs (either quotes) from its start, so a name in another's value is none; null where anything else
// stands there.
export function attributes(tag) {
  const pair = /\s*([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/uy, out = {};
  let at = 0;
  for (let m; (pair.lastIndex = at, m = pair.exec(tag)); at = pair.lastIndex) out[m[1].toLowerCase()] = m[2] ?? m[3];
  return /^\s*\/?$/u.test(tag.slice(at).trimEnd()) ? out : null; // (one "\s*": two would backtrack)
}

// What brings C# in by its own means, in any case: a <Target>, which may hold any task, an <Output> into any item or a
// write of files the SDK's default **/*.cs then takes; a <UsingTask>, which may replace the compiler's; an item the SDK
// or a package writes C# from or compiles with (<Analyzer>, <TestingPlatformBuilderHook>); and, anywhere, a word that
// hands the compiler a response file or names its own compiler, puts what a referenced project returns into an item
// (OutputItemType), moves the folder whose project extensions the SDK imports, or sets the properties a referenced
// project is built with.
const BY_ITS_OWN = /<(?:Target|UsingTask|Analyzer|TestingPlatformBuilderHook)\b|CompilerResponseFile|CscTool(?:Path|Exe)|OutputItemType|BaseIntermediateOutputPath|MSBuildProjectExtensionsPath|AdditionalProperties|UndefineProperties|GlobalPropertiesToRemove|Set(?:Configuration|Platform|TargetFramework)/iu;
// The assembly's attributes of the framework that the SDK writes with strings alone, as C# names them, in its case
// (InternalsVisibleTo, which test projects use most; CLSCompliant). A repository type of such a name is reached from
// every file (select-csharp.mjs, runsUnnamed).
const ASSEMBLY_STRINGS = new Set(["System.Runtime.CompilerServices.InternalsVisibleTo", "System.Runtime.CompilerServices.InternalsVisibleToAttribute", "System.CLSCompliant", "System.CLSCompliantAttribute"]);
// A line break's escape ("&#10;", "&#xD;", "%0A", in any case) or a CDATA section, which may carry one.
const BREAK = /<!\[CDATA\[|&#(?:0*1[03]|x0*[ad]);|%0[ad]/iu;

// Whether the text of the file `f` compiles C# the reader never reads (#675): what BY_ITS_OWN names; an
// <AssemblyAttribute> but one of ASSEMBLY_STRINGS, or any where metadata that writes its arguments as code ("_IsLiteral",
// "_TypeName") stands anywhere in the file; a value that holds a line break (breaks), which may carry a switch of its own
// into the compiler's response file. Or an item whose Include names, in a part split at ";" and trimmed, in a .csproj
// or the .user beside it: of <Compile>, a file of C# not among `cs` (bringsIn); of <ProjectReference>, anything but a
// .csproj among `known` (the MSBuild files read), written out; and any part at all in another file, since MSBuild reads
// an item's path from the project's folder, not the imported file's; or such a tag not a run of attributes. A wildcard of
// .cs inside reads only files the checkout holds, as the SDK's own default does where no target runs; a Remove or an
// Update alone brings in nothing. `pace` is asked for each item and part.
export function compilesOther(text, f, { cs, known }, pace) {
  if (BY_ITS_OWN.test(text) || breaks(text)) return true;
  const code = /_(?:IsLiteral|TypeName)/iu.test(text);
  for (const m of text.matchAll(/<AssemblyAttribute\b([^<>]*)>/giu)) { pace(); if (code || !ASSEMBLY_STRINGS.has((attributes(m[1])?.include ?? "").trim())) return true; }
  const own = /\.csproj(?:\.user)?$/iu.test(f);
  return anyPart(text, /<Compile\b([^<>]*)>/giu, pace, p => !own || bringsIn(p, f, cs))
    || anyPart(text, /<ProjectReference\b([^<>]*)>/giu, pace, p => !own || /[$@%&*?]/u.test(p) || !/\.csproj$/iu.test(p) || !known.has(importPath(f, p)));
}

// Whether a part of the Include of an item `tag` matches, trimmed and with Windows' separators turned, or a tag of it is
// no run of attributes.
function anyPart(text, tag, pace, brings) {
  for (const m of text.matchAll(tag)) {
    const attrs = attributes(m[1]);
    if (!attrs) return true;
    for (const part of (attrs.include ?? "").split(";")) { pace(); const p = part.trim().replace(/\\/gu, "/"); if (p && brings(p)) return true; }
  }
  return false;
}

// Whether a text, its comments taken out, holds a line break beside other text between two tags, or BREAK; or a
// comment with no end. Each comment is found by indexOf, and each try of the split ends at the next "<": linear.
function breaks(text) {
  if (BREAK.test(text)) return true;
  let plain = "";
  for (let at = 0; at < text.length;) {
    const open = text.indexOf("<!--", at);
    if (open < 0) { plain += text.slice(at); break; }
    const close = text.indexOf("-->", open + 4);
    if (close < 0) return true;
    plain += text.slice(at, open);
    at = close + 3;
  }
  return plain.split(/<[^<>]*>/u).some(t => /[\r\n]/u.test(t) && /\S/u.test(t));
}

// Whether one part `p` of a <Compile>'s Include, in `f`, brings in a file of C# not among `cs`: what MSBuild expands
// ("$", "@", "%", "&"), a path that leads, from `f`'s folder, outside the repository or to a file `cs` does not hold,
// or a wildcard whose path climbs out of the repository anywhere or whose name ends other than in ".cs".
function bringsIn(p, f, cs) {
  if (/[$@%&]/u.test(p)) return true;
  if (!/[*?]/u.test(p)) { const at = importPath(f, p); return at === null || at === "" || !cs.has(at); }
  if (p.startsWith("/") || /^[A-Za-z]:/u.test(p) || !CS.test(p)) return true;
  // (each folder the wildcard's path passes through, its depth below the top counted word by word: none outside)
  let depth = path.posix.dirname(f) === "." ? 0 : path.posix.dirname(f).split("/").length;
  for (const w of p.split("/")) if (w === "..") { if (--depth < 0) return true; } else if (w && w !== ".") depth++;
  return false;
}
