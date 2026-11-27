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
  for (let m; (pair.lastIndex = at, m = pair.exec(tag)); at = pair.lastIndex) {
    const name = m[1].toLowerCase();
    if (Object.hasOwn(out, name)) return null; // (two names alike but in case: which one a reader takes is not known)
    out[name] = m[2] ?? m[3];
  }
  return /^\s*\/?$/u.test(tag.slice(at).trimEnd()) ? out : null; // (one "\s*": two would backtrack)
}

// The names an MSBuild file may hold for the reader to read it (#675), in lower case, as MSBuild reads a property's: of
// an element, the project's own structure, the items the reader reads (<Compile>, <ProjectReference>, <Using>,
// <AssemblyAttribute>, <Import>) or that bring no C# of the repository in (packages, frameworks, files copied or
// embedded), their metadata that changes nothing the compiler reads, and the properties that name no file, tool, task,
// target or folder (a property the reader reads, RootNamespace, or the importsOther's switches beside them); of an
// attribute, those the same items and structure take. An element or attribute of any other name, a <Target>, a
// <UsingTask>, an <Analyzer>, a property of the compiler's own, a referenced project's Properties among them, is one
// whose effect is not known, so the file is not read: a list of what is known safe, not of what is refused, so a way
// in no one listed reads as unknown (each review of a refused list found another).
const ELEMENTS = new Set(["project", "propertygroup", "itemgroup", "import", "importgroup", "choose", "when", "otherwise", "sdk",
  "compile", "projectreference", "using", "assemblyattribute", "packagereference", "packageversion", "globalpackagereference", "frameworkreference",
  "none", "content", "embeddedresource", "folder", "internalsvisibleto",
  "alias", "static", "version", "versionoverride", "privateassets", "includeassets", "excludeassets", "copytooutputdirectory", "copytopublishdirectory", "visible",
  "targetframework", "targetframeworks", "outputtype", "nullable", "implicitusings", "langversion", "ispackable", "istestproject", "ispublishable", "rootnamespace",
  "assemblyname", "generatedocumentationfile", "treatwarningsaserrors", "warningsaserrors", "warningsnotaserrors", "warninglevel", "nowarn", "defineconstants",
  "versionprefix", "versionsuffix", "assemblyversion", "fileversion", "informationalversion", "authors", "company", "product", "copyright", "description",
  "packageid", "packagetags", "packagelicenseexpression", "packageprojecturl", "repositoryurl", "repositorytype", "packagereadmefile", "title", "neutrallanguage",
  "managepackageversionscentrally", "centralpackagetransitivepinningenabled", "invariantglobalization", "deterministic", "continuousintegrationbuild",
  "analysislevel", "analysismode", "enforcecodestyleinbuild", "enablenetanalyzers", "allowunsafeblocks", "checkforoverflowunderflow", "debugtype", "debugsymbols",
  "optimize", "configurations", "platforms", "platformtarget", "runtimeidentifier", "runtimeidentifiers", "selfcontained", "publishaot", "publishtrimmed",
  "isaotcompatible", "istrimmable", "usersecretsid", "importdirectorybuildprops", "importdirectorybuildtargets", "importdirectorypackagesprops",
  "targetframeworkprofile", "enabledefaultcompileitems", "enabledefaultitems", "generateassemblyinfo", "generatepackageonbuild", "includesymbols",
  "symbolpackageformat", "nugetaudit", "nugetauditmode", "nugetauditlevel", "restorepackageswithlockfile", "satelliteresourcelanguages"]);
const ATTRIBUTES = new Set(["include", "remove", "update", "exclude", "condition", "label", "sdk", "name", "project", "toolsversion", "xmlns", "version",
  "versionoverride", "privateassets", "includeassets", "excludeassets", "alias", "static", "copytooutputdirectory", "copytopublishdirectory", "visible", "link", "linkbase"]);
// (an assembly's attribute's arguments, _Parameter1 and on, as an element or an attribute; never _Parameter1_IsLiteral
// or _Parameter1_TypeName, which write an argument as code)
const known = (names, n) => names.has(n.toLowerCase()) || /^_parameter\d+$/iu.test(n);
// The assembly's attributes of the framework that the SDK writes with strings alone, as C# names them, in its case
// (InternalsVisibleTo, which test projects use most; CLSCompliant). A repository type of such a name is reached from
// every file (select-csharp.mjs, runsUnnamed).
const ASSEMBLY_STRINGS = new Set(["System.Runtime.CompilerServices.InternalsVisibleTo", "System.Runtime.CompilerServices.InternalsVisibleToAttribute", "System.CLSCompliant", "System.CLSCompliantAttribute"]);
// What MSBuild or XML reads that a tag's name does not show, anywhere in the text: a processing instruction (<?) past
// the XML declaration at the start, in which a "<!--" would hide what follows from the comments' reading; a <!DOCTYPE>,
// which may define entities; a CDATA section; a numeric character reference (&#10;, &#36;), which may spell a line break
// or a "$"; MSBuild's escape of a line break (%0A); and a property function ("$([", spaced or not) but the two that
// importsOther reads exactly, since one may return a line break (System.Environment::NewLine) or a file's text.
const HIDDEN = /<\?|<!DOCTYPE|<!\[CDATA\[|&#|%0[ad]|\$\(\s*\[(?!MSBuild\]::Get(?:PathOf|DirectoryNameOf)FileAbove\()/iu;
const DECLARATION = /^\uFEFF?<\?xml\s[^<>?]*\?>/u;
const TAG = /<(\/?)([^\s<>/]*)(?![^\s<>/])([^<>]*)>/gu; // (the name taken whole, never given back to the rest: linear)
// The SDKs whose own files bring in no C# of the repository that the reader does not read, as Sdk="Name" or "Name/1.0",
// in their own case, as the resolver finds their folder on Linux.
const SDK = /^(?:Microsoft\.NET\.Sdk(?:\.(?:Web|Razor|Worker|BlazorWebAssembly|WindowsDesktop|StaticWebAssets))?|MSTest\.Sdk)(?:\/[\w.+-]+)?$/u;

// Whether the text of the file `f` compiles C# the reader never reads (#675): what HIDDEN names, a comment with no end,
// a tag the reader does not know (unknown); a value that holds a line break (between two tags, beside other text) or a
// quote, either of which may carry a switch of its own into the compiler's response file; an <AssemblyAttribute> but one of
// ASSEMBLY_STRINGS. Or an item whose Include names, in a part split at ";" and trimmed, in a .csproj or the .user beside
// it: of <Compile>, a file of C# not among `cs` (bringsIn); of <ProjectReference>, anything but a .csproj among `known`
// (the MSBuild files read), written out; and any part at all in another file, since MSBuild reads an item's path from
// the project's folder, not the imported file's. A wildcard of .cs inside reads only files the checkout holds, as the
// SDK's own default does where no target runs; a Remove or an Update alone brings in nothing. `pace` is asked for each
// tag, item and part.
export function compilesOther(text, f, { cs, known }, pace) {
  const plain = uncommented(text.replace(DECLARATION, ""));
  if (plain === null || HIDDEN.test(plain) || unknown(plain, pace)) return true;
  if (plain.split(/<[^<>]*>/u).some(t => (/[\r\n]/u.test(t) && /\S/u.test(t)) || /"|&quot;|%22/iu.test(t))) return true;
  for (const m of plain.matchAll(/<AssemblyAttribute\b([^<>]*)>/giu)) { pace(); if (!ASSEMBLY_STRINGS.has((attributes(m[1])?.include ?? "").trim())) return true; }
  const own = /\.csproj(?:\.user)?$/iu.test(f);
  return anyPart(plain, /<Compile\b([^<>]*)>/giu, pace, p => !own || bringsIn(p, f, cs, known, pace))
    || anyPart(plain, /<ProjectReference\b([^<>]*)>/giu, pace, p => !own || /[$@%&*?]/u.test(p) || !/\.csproj$/iu.test(p) || !known.has(importPath(f, p)));
}

// The text with its comments taken out, each found by indexOf (linear); null where a "<?" stands before the first, in
// which its "<!--" is no comment, or one has no end.
function uncommented(text) {
  let plain = "";
  for (let at = 0; at < text.length;) {
    const open = text.indexOf("<!--", at);
    if (open < 0) return plain + text.slice(at);
    const close = text.indexOf("-->", open + 4);
    if (close < 0 || text.slice(at, open).includes("<?")) return null;
    plain += text.slice(at, open);
    at = close + 3;
  }
  return plain;
}

// Whether a text, its comments out, holds a tag of an element the reader does not know, or an attribute of one; one
// unsafe where it stands; a tag that is no run of attributes, or closes with any; or a "<" outside every tag. Each try
// ends at the next "<": linear.
function unknown(plain, pace) {
  let item = null; // (the item whose tag stands open, its name and attributes, for the metadata written inside it)
  for (const m of plain.matchAll(TAG)) {
    pace();
    const attrs = m[1] ? (/^\s*$/u.test(m[3]) ? {} : null) : attributes(m[3]);
    if (!known(ELEMENTS, m[2]) || !attrs || Object.keys(attrs).some(a => !known(ATTRIBUTES, a)) || (!m[1] && unsafe(m[2], attrs, item))) return true;
    if (ITEMS.test(m[2])) item = m[1] || m[3].trimEnd().endsWith("/") ? null : { name: m[2], attrs };
  }
  return plain.replace(TAG, "").includes("<");
}

// The items whose metadata may be written inside them, and the metadata that copies an item's file to the output.
const ITEMS = /^(?:compile|none|content|embeddedresource)$/iu, COPY = /^copyto(?:output|publish)directory$/iu;

// Whether the known attributes `attrs` of an opening tag of `name`, inside the open `item`, are not safe there: a Link
// or LinkBase but on a <Compile>, where it sets where a copy is written; on a <Compile>, one but a plain path below
// (none of MSBuild's expansions, no "..", not rooted); a copy to the output of a file that may be C# (a <Compile>'s,
// or a part of an Include or Update that ends in ".cs", trailing dots, blanks and separators aside, as Windows drops
// them, or that MSBuild expands), as an attribute or written inside the
// item, which the copy may write where another project compiles it, over a file git holds or into a folder its wildcard
// reaches; an SDK but those of SDK, in an Sdk attribute's parts or an <Sdk>'s Name, which must be there.
function unsafe(name, attrs, item) {
  const compile = /^compile$/iu.test(name);
  if (!compile && ("link" in attrs || "linkbase" in attrs)) return true;
  if (compile && [attrs.link, attrs.linkbase].some(l => l !== undefined && !plainBelow(l))) return true;
  if (ITEMS.test(name) && Object.keys(attrs).some(a => COPY.test(a)) && copiesCs(name, attrs)) return true;
  return (COPY.test(name) && item !== null && copiesCs(item.name, item.attrs)) || unknownSdk(name, attrs);
}
function unknownSdk(name, attrs) {
  const element = /^sdk$/iu.test(name);
  if (element && !(attrs.name ?? "").trim()) return true;
  return [...(attrs.sdk ?? "").split(";"), ...(element ? [attrs.name] : [])].some(n => n.trim() && !SDK.test(n.trim()));
}
const plainBelow = l => !/[$%@&;:]|^\s*[\\/]/u.test(l) && !l.split(/[\\/]/u).some(w => w.trim() === "..");
const copiesCs = (name, attrs) => /^compile$/iu.test(name) ||
  [attrs.include, attrs.update].some(v => (v ?? "").split(";").some(p => /[*?$@%&]|\.cs[\s./\\]*$/iu.test(p)));

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

// Whether one part `p` of a <Compile>'s Include, in `f`, brings in a file of C# not among `cs`: what MSBuild expands
// ("$", "@", "%", "&"), a path that leads, from `f`'s folder, outside the repository or to a file `cs` does not hold,
// or a wildcard whose path climbs out of the repository anywhere or whose name ends other than in ".cs", or that may
// reach a folder a build writes: a folder named bin or obj on its path, or, where a folder's word is a wildcard, the
// folder of a .csproj among `known` at or below where its plain words lead. The reader matches a wildcard against what
// git holds, and a build writes its output (a copy, a generated file) under each project's folder before another
// project's wildcard may be expanded.
function bringsIn(p, f, cs, known, pace) {
  if (/[$@%&]/u.test(p)) return true;
  if (!/[*?]/u.test(p)) { const at = importPath(f, p); return at === null || at === "" || !cs.has(at); }
  return p.startsWith("/") || /^[A-Za-z]:/u.test(p) || !CS.test(p) || wildcardOut(p, f, known, pace);
}
function wildcardOut(p, f, known, pace) {
  const words = p.split("/"), wild = words.findIndex(w => /[*?]/u.test(w));
  // (Windows drops a word's trailing dots and blanks, so "bin." is bin)
  if (words.slice(0, -1).some(w => /^(?:bin|obj)$/iu.test(w.replace(/[\s.]+$/u, "")))) return true;
  // (each folder the wildcard's path passes through, its depth below the top counted word by word: none outside)
  let depth = path.posix.dirname(f) === "." ? 0 : path.posix.dirname(f).split("/").length;
  for (const w of words) if (w === "..") { if (--depth < 0) return true; } else if (w && w !== ".") depth++;
  if (wild === words.length - 1) return false;
  // (the folder above the wildcard, as git holds it, which Linux reads, and each plain word trimmed as Windows reads
  // it: "lib." and "lib " are lib there)
  const trimmed = words.slice(0, wild).map(w => (w === "." || w === ".." ? w : w.replace(/[\s.]+$/u, "")));
  return [words.slice(0, wild), trimmed].some(above => {
    const at = path.posix.dirname(importPath(f, [...above, "x"].join("/")) ?? "");
    return projectsWithin(known, pace).has(at === "." ? "" : at.toLowerCase());
  });
}

// Each folder a .csproj of `known` lies in, and each above it, "" the top, in lower case, as Windows finds them; kept
// for each `known`, so its projects are walked once. `pace` is asked for each folder, and a walk stops at a folder
// already held, whose own are held with it.
const within = new WeakMap();
function projectsWithin(known, pace) {
  if (!within.has(known)) {
    const folders = new Set();
    for (const f of known) if (/\.csproj$/iu.test(f)) for (let d = path.posix.dirname(f.toLowerCase()); ; d = path.posix.dirname(d)) {
      pace();
      const at = d === "." ? "" : d;
      if (folders.has(at)) break;
      folders.add(at);
      if (d === "." || d === "/") break;
    }
    within.set(known, folders);
  }
  return within.get(known);
}

// The solution files, and the files the SDK or a package compiles to C# the reader never reads (Razor's, XAML's,
// Avalonia's), in any case.
export const SOLUTION = /\.(?:sln|slnx|slnf)$/iu, COMPILED = /\.(?:razor|cshtml|xaml|axaml)$/iu;
// (a .sln's solution folder, which builds nothing, and C#'s two project types, the old and the SDK's; any other type,
// a web site's among them, may build its path otherwise)
const FOLDER = "2150E333-8FDC-42A3-9474-1A3956D46DE8", CSHARP = new Set(["FAE04EC0-301F-11D3-BF4B-00C04F79EFBC", "9A19103F-16F7-4668-BE54-9A1E7A4F7556"]);

// Whether the solution file `f` (its text `text`) builds anything but a .csproj of `projects` (the lower-cased paths of
// those git or the change holds): a solution builds a project of any extension under C#'s GUID, whose targets may write
// files of C#. Of a .sln, read as ASCII alone, each line that holds "Project(" names a solution folder or, under C#'s
// type, a .csproj of them; of a .slnx, each
// <Project>'s Path does, with no Type; of a .slnf, its solution is a .sln or .slnx git holds and each project it lists
// a .csproj of them, read from that solution's folder. Anything else, a line or a file not read whole among it, is
// another.
export function buildsOther(f, text, projects, solutions) {
  const held = (from, p) => /\.csproj$/iu.test(p) && projects.has(importPath(from, p)?.toLowerCase());
  // (a .sln is read line by line as .NET reads one, a "\r" alone ending a line too; any character but a tab and
  // ASCII's printable ones, which .NET's trimming might take as a blank, makes it another)
  if (/\.sln$/iu.test(f)) return /[^\t\r\n\x20-\x7e]/u.test(text.replace(/^\uFEFF/u, "")) || text.split(/\r\n|\r|\n/u).filter(l => /Project\s*\(/iu.test(l)).some(l => {
    const m = /^\s*Project\s*\(\s*"\{([0-9A-F-]+)\}"\s*\)\s*=\s*"[^"]*"\s*,\s*"([^"]*)"\s*,\s*"\{[0-9A-F-]+\}"\s*$/iu.exec(l);
    return !m || (m[1].toUpperCase() !== FOLDER && (!CSHARP.has(m[1].toUpperCase()) || !held(f, m[2])));
  });
  if (/\.slnx$/iu.test(f)) return [...text.matchAll(/<Project\b([^<>]*)>/giu)].some(m => { const a = attributes(m[1]); return !a || "type" in a || !held(f, a.path ?? ""); }) || /<Project\b[^<>]*$/iu.test(text);
  try {
    const { solution } = JSON.parse(text), from = importPath(f, String(solution.path));
    return !solutions.has(from?.toLowerCase()) || !/\.slnx?$/iu.test(from) || !Array.isArray(solution.projects) || solution.projects.some(p => typeof p !== "string" || !held(from, p));
  } catch { return true; }
}
