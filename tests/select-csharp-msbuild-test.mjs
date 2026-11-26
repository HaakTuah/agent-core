// Tests where MSBuild's files decide what a file of C# reaches, for the test selection (scripts/select-csharp-project.mjs,
// through scripts/select-csharp.mjs; #675): a <Using> read in any form, each of its aliases and Static; every file unsure
// where a <Using> names a property, holds what the reader cannot read, or an <Import> or a property MSBuild imports by
// may bring in a file it never sees, or git cannot be asked; a .csproj.user and a .pubxml read; C# of no project; the
// namespaces outside every project's root; and what git holds beside the texts, a link or a Directory.Build.rsp among
// them unknown, past the budget Late. The cases: select-csharp-test.mjs.
// Needs the parser (node scripts/install.mjs parser). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-csharp-msbuild-test.mjs
import fs from "node:fs";
import path from "node:path";
import { Late } from "../scripts/hurry.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { csharpReach } from "../scripts/select-csharp.mjs";
import { heldBeside, msbuildUsings, ofNoProject } from "../scripts/select-csharp-project.mjs";
import { git } from "../scripts/select-passed.mjs";
import { PROJ, done, nothing, ok, one, same } from "./select-csharp-test.mjs";

// ---- a <Using>, and every file where one cannot be read ----
const csTexts = { "src/App.csproj": PROJ, "src/A.cs": "namespace App;\nclass A { }\n", "tests/T.cs": "namespace Tests;\nclass T { }\n" };
for (const [held, what] of [...["$(Root).App", "@(ExtraUsings)", "%(Ns.Identity)", "App%2EData", "App&#46;Data"].map(i => [`<Using Include="${i}" />`, `a <Using> of ${i}, which MSBuild expands`]),
  ...["$(D)u.xml", "c.proj", "u.props.xml", "a.props;u.xml", "../U.Props", "c.props/u.xml", "u.xml;a.props", "$(X).props", ...["GetPathOfFileAbove('u.xml', 'a.props')", "IO.Path]::ChangeExtension('a.props', '.xml')", "IO.Path]::Combine('a.props', '..', 'u.xml')",
    "String]::Copy('a.props').Replace('.props', '.xml')", "String]::Concat('a.props', '.xml')"].map(f => `$([${f.startsWith("Get") ? "MSBuild]::" : "System."}${f})`)].map(p => [`<Import Project="${p}" />`, `a .props git holds imports ${p}, whose <Using> items it may not hold`]),
  ...["MSBuildMine", "MSBuildAllProjects", "MSBuildProjectExtensionsPath"].map(m => [`<PropertyGroup><${m}>u.xml;a</${m}></PropertyGroup><Import Project="$(${m}).props" />`, `a .props imports $(${m}).props, a property of MSBuild's name that a file can set`]),
  ...["CustomAfterMicrosoftCommonTargets", "DirectoryBuildTargetsPath", "_DirectoryBuildTargetsFile", "_DirectoryBuildPropsFile", "DirectoryPackagesPropsPath", "LanguageTargets", "MSBuildUserExtensionsPath", "MSBuildExtensionsPath", "CustomAfterDirectoryBuildTargets", "CustomBeforeDirectoryBuildProps", "CodeAnalysisTargets", "AfterMicrosoftNETSdkTargets", "AlternateCommonProps", "NuGetBuildTasksPackTargets", "NuGetRestoreTargets", "BeforeTargetFrameworkInferenceTargets", "PublishProfile", "WebPublishProfileFile"].map(m => [`<PropertyGroup><${m}>$(MSBuildThisFileDirectory)u.xml</${m}></PropertyGroup>`, `a .props names a file MSBuild or the SDK imports by ${m}`]),
  ...["<CustomAfterMicrosoftCommonTargets>true</CustomAfterMicrosoftCommonTargets>", "<ImportDirectoryBuildProps Condition=\"$(A)\">true</ImportDirectoryBuildProps>", "<ImportDirectoryBuildProps>true</X>", "<ImportDirectoryBuildProps>true;u.xml</ImportDirectoryBuildProps>", "<MSBuildExtensionsPath />", "<MSBuildUserExtensionsPath></MSBuildUserExtensionsPath>", "<MSBuildExtensionsPath64 />"].map(e => [`<PropertyGroup>${e}</PropertyGroup>`, `a .props holds ${e}, which may name a file`]), [null, "git cannot be asked"]]) {
  const r = csharpReach(csTexts, undefined, () => held ? { msbuild: { "Directory.Build.props": held, "a.props": "<Project />" }, cs: {} } : { unknown: true });
  ok(same([...r.unsure].sort(), ["src/A.cs", "tests/T.cs"]), `where ${what}, every file of C# is unsure`, JSON.stringify([...r.unsure]));
}
const bare = ["<TargetFrameworkProfile />", "<TargetFrameworkProfile></TargetFrameworkProfile>", "<ImportDirectoryBuildProps>true</ImportDirectoryBuildProps>", "<ImportDirectoryBuildTargets> False </ImportDirectoryBuildTargets>"].filter(e => csharpReach(csTexts, undefined, () => ({ msbuild: { "Directory.Build.props": `<Project><PropertyGroup>${e}</PropertyGroup></Project>` }, cs: {} })).unsure.size);
ok(!bare.length, "a property of a hook's name that is empty, or a switch named Import… of true or false, names no file and leaves the files read", bare.join(" | "));
const userFiles = ["src/App.csproj.user", "src/Properties/PublishProfiles/P.pubxml", "src/Properties/PublishProfiles/P.pubxml.user"].filter(f => !same([...csharpReach({ ...csTexts, [f]: "<Project><ItemGroup><Using Include=\"$(Root).App\" /></ItemGroup></Project>" }, undefined, nothing).unsure].sort(), ["src/A.cs", "tests/T.cs"]));
ok(!userFiles.length, "a .csproj.user, which MSBuild imports beside its .csproj, and a .pubxml or .pubxml.user, which the SDK imports by a publish profile, are read for their <Using> items", userFiles.join(" | "));
ok(ofNoProject("lib/A.cs", csTexts) && !ofNoProject("src/A.cs", csTexts) && !ofNoProject("A.cs", { "App.csproj": PROJ }), "C# is of no project where no .csproj stands in a folder above it");

const unreadMeta = csharpReach({ ...csTexts, "tests/Tests.csproj": "<Project><ItemGroup><Using Include=\"App\"><!-- <Alias>D</Alias> --></Using></ItemGroup></Project>" }, undefined, nothing);
ok(same([...unreadMeta.unsure].sort(), ["src/A.cs", "tests/T.cs"]), "a <Using> whose elements the reader cannot read makes every file unsure", JSON.stringify([...unreadMeta.unsure]));

const items = ["<Using Include=\"App.Data.Store\" Alias=\"S\" />", "<Using Include=\"App.Data.Store\" Alias=\"SAttribute\" />", "<Using Include=\"App.Data.Store\" Static=\"true\" />"].filter(item => !csharpReach({
  "src/App.csproj": PROJ, "src/Store.cs": "namespace App.Data;\npublic class Store { public static void Go() { } }\n",
  "tests/Tests.csproj": `<Project><ItemGroup>${item}</ItemGroup></Project>`, "tests/T.cs": "namespace Tests;\nclass T { [S] S s; void M() { Go(); } }\n",
}, undefined, nothing).links.get("tests/T.cs")?.has("src/Store.cs"));
ok(!items.length, "a <Using> with an Alias (an attribute's too), or Static, reaches the type it names from every file", items.join(", "));
const store = (item, held = {}) => csharpReach({ "src/App.csproj": PROJ, "src/Store.cs": "namespace App.Data;\npublic class Store { }\n", "tests/Tests.csproj": `<Project><ItemGroup>${item}</ItemGroup></Project>`,
  "tests/T.cs": "namespace Tests;\nclass T { D.Data.Store s; }\n" }, undefined, () => ({ msbuild: held, cs: {} }));
const tags = ["<Using Note=\"Alias='Q'\" Include=\"App\" Alias=\"D\" />", "<using Include=\"App\" Alias=\"D\" />", "<USING Include=\"App\" Alias=\"D\"></USING>", "<Using Include=\"App\" Alias=\"Q\"><Alias>D</Alias></Using>", "<Using Include=\"App\" Alias=\"@D\" />",
  "<Using Include=\"App\">\n  <alias>D</alias>\n  <Visible>false</Visible>\n</Using>"]
  .filter(item => !store(item).links.get("tests/T.cs")?.has("src/Store.cs"));
ok(!tags.length, "a <Using> is read in any case, each attribute from its own pair, both aliases where an attribute and an element each give one, and an alias's \"@\" dropped", tags.join(" | "));
// (an <Import> of a .props or .targets git holds, by a path from the file's folder, or found above a folder it gives)
const heldProps = { "Directory.Build.props": "<Project />", "a.props": "<Project />", "tests/a.props": "<Project />" }, imported = p => `<Using Include="App" Alias="D" /></ItemGroup><Import Project="${p}" /><ItemGroup>`;
const unlinked = ["a.props", "../a.props", "$(MSBuildThisFileDirectory)a.props; $([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory).., a.props))/a.props", "$([MSBuild]::GetPathOfFileAbove('Directory.Build.props'))",
  "$([MSBuild]::GetPathOfFileAbove('Directory.Build.props', '$(MSBuildThisFileDirectory)..'))", "$([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory), a.props))\\a.props"].filter(p => !store(imported(p), heldProps).links.get("tests/T.cs")?.has("src/Store.cs"));
ok(!unlinked.length, "a <Using> is read beside an <Import> of a .props git holds, by a path from the file's folder or found above the folder it starts from", unlinked.join(" | "));
// (one that leads outside the checkout, or to a file git does not hold, or found above a folder this cannot tell, may hold a <Using> never read)
const outsideImports = ["../../shared/GlobalUsings.props", "b.props", "$(MSBuildThisFileDirectory)b.props", "$([MSBuild]::GetPathOfFileAbove('Shared.props'))", "$([MSBuild]::GetPathOfFileAbove('Directory.Build.props', '..'))",
  "$([MSBuild]::GetPathOfFileAbove('Directory.Build.props', '$(MSBuildThisFileDirectory)../..'))", "$([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory), b.props))/b.props", "$([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory), a.props))/../b.props",
  "$([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory), a.props))a.props", "$([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory).., Directory.Build.props))Lib.csproj",
  "$([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory).., Directory.Build.props))/src/App.csproj", "$([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory), x%41.props))/a.props",
  "$([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory)%2E%2E, a.props))/a.props", "$([MSBuild]::GetPathOfFileAbove('tests/a.props'))", "$([MSBuild]::GetPathOfFileAbove('..'))"]
  .filter(p => store(imported(p), heldProps).unsure.size !== 2);
const windowsNames = ["C:a.props", "a*.props", "a?.props", "a|.props"].filter(n => store(imported(`$([MSBuild]::GetPathOfFileAbove('${n}'))`), { ...heldProps, [n]: "<Project />" }).unsure.size !== 2);
ok(!windowsNames.length, "a search above for a name Windows reads otherwise (a drive's, a wildcard) makes every file unsure, though git holds it", windowsNames.join(" | "));
ok(!outsideImports.length, "an <Import> of a .props outside the checkout, of one git does not hold, or found above a folder this cannot tell (an escape in its start or name, a name that is a path, a rest after the folder found that opens with no separator or is no .props), makes every file unsure", outsideImports.join(" | "));
let paced = 0;
const many = msbuildUsings([["Directory.Build.props", `<Project><ItemGroup><Using Include="${"A;".repeat(1000)}" Alias="D"><Alias>E</Alias></Using></ItemGroup></Project>`]], () => paced++);
ok(paced >= 2000 && many.filter(u => u.target === "A").length === 2, "the budget is asked for each target and alias of a <Using>, and each is put once", `${paced} ${many.length}`);
const plainAfter = csharpReach({ "src/App.csproj": PROJ, "src/Store.cs": "namespace App.Data;\npublic class Store { }\n", "tests/Tests.csproj": "<Project><ItemGroup><Using Include=\"App.Data\" Alias=\"@null\" /><Using Include=\"App.Data\" /></ItemGroup></Project>",
  "tests/T.cs": "namespace Tests;\nclass T { Store s; }\n" }, undefined, nothing);
ok(plainAfter.links.get("tests/T.cs")?.has("src/Store.cs"), "a plain <Using> of a target is put beside one of the same target whose alias is \"null\"", JSON.stringify([...plainAfter.links]));
const upper = { "src/App.csproj": PROJ, "src/Store.cs": "namespace App.Data;\npublic class Store { }\n", "tests/T.cs": "namespace Tests;\nclass T { Store s; Helper h; }\n" };
const viaUpper = csharpReach(upper, undefined, () => ({ msbuild: {}, cs: { "tests/Usings.CS": "global using App.Data;\n", "tests/Helper.CS": "namespace Tests;\nclass Helper { }\n" } }));
ok(viaUpper.links.get("tests/T.cs")?.has("src/Store.cs") && viaUpper.links.get("tests/T.cs")?.has("tests/Helper.CS"), "a file of C# git holds beside the texts is read in any case of its extension: its global using, and the type it declares", JSON.stringify([...viaUpper.links]));
const usings = "<Project><ItemGroup><Using Include=\"App.Data\" /></ItemGroup></Project>";
const misread = t => [...csharpReach({ ...upper, "tests/Tests.csproj": t }, undefined, nothing).unsure].sort(), all = ["src/Store.cs", "tests/T.cs"];
const wide = misread(Buffer.from(`\ufeff${usings}`, "utf16le").toString("utf8")), latin = misread(`<?xml version="1.0" encoding="iso-8859-1"?>${usings.replace("Data", "Dat\u00ea")}`);
ok(same(wide, all) && same(latin, all), "a .csproj among the texts in UTF-16, or declared Latin-1 over bytes not ASCII, which MSBuild reads otherwise than UTF-8, makes every file unsure", JSON.stringify([wide, latin]));
const heldUpper = csharpReach(upper, undefined, () => ({ msbuild: { "tests/Tests.CSPROJ": usings }, cs: {} }));
ok(heldUpper.links.get("tests/T.cs")?.has("src/Store.cs"), "a .CSPROJ git holds beside the texts is read for its <Using> items", JSON.stringify([...heldUpper.links]));
const above1 = "<Project><Import Project=\"$([MSBuild]::GetPathOfFileAbove('a.props'))\" /></Project>";
const siblings = n => [...Array(n)].map((_, i) => [`${"d/".repeat(600)}s${i}/x.props`, above1]).concat([["a.props", "<Project />"]]);
let one300 = 0, all300 = 0;
msbuildUsings(siblings(300).map(([f, t]) => [f, f === "a.props" ? t : "<Project />"]), () => one300++);
msbuildUsings(siblings(300), () => all300++);
ok(all300 - one300 < 2000, "searches from sibling folders climb what they share once", `${all300 - one300}`);
const deep = [[`${"d/".repeat(600)}x.props`, `<Project>${`<Import Project="$([MSBuild]::GetPathOfFileAbove('a.props'))" />`.repeat(500)}</Project>`], ["a.props", "<Project />"]];
let climbed = 0, late = 0, once = 0;
const found = msbuildUsings(deep, () => climbed++);
msbuildUsings([[deep[0][0], above1], deep[1]], () => once++);
try { msbuildUsings(deep, () => { if (++late > 100) throw new Late("past the budget"); }); } catch (e) { late = e; }
ok(found !== null && once >= 600 && climbed - once >= 499 && climbed < 3000 && late instanceof Late, "the budget is asked at each folder a search climbs and at each part, and a search is made once", `${climbed} ${once} ${late}`);
const untold = ["<Using Include=\"App\" /><Using Update=\"App\" Alias=\"D\" />", "<Using Include=\"App\" Alias=\"D\" Note=\"a\"b\" />", "<Using Include=\"App.Data.Store[]\" Alias=\"D\" />", "<Using Include=\"App.Data.Store?\" Alias=\"D\" />", "<Using Include=\"App\" Alias=\"D-x\" />",
  "<Using Include=\"App\" Alias=\"D\" /></ItemGroup><Import Project=\"u.xml\" /><ItemGroup>", "</ItemGroup><ItemDefinitionGroup><Using Alias=\"D\" /></ItemDefinitionGroup><ItemGroup><Using Include=\"App\" />"].filter(item => store(item).unsure.size !== 2);
ok(!untold.length, "a <Using> that updates another or defines an item's metadata, whose tag is no run of attributes, or whose target or alias is no plain name, or a .csproj that imports an .xml, makes every file unsure", untold.join(" | "));


// ---- the namespaces outside every project's root, seen by every file ----
const used = { "tests/T.cs": "namespace Tests;\nclass T { bool b = \"x\".Allowed(); }\n" }, ext = ns => one(`namespace ${ns};\npublic static class Ext { public static bool Allowed(this string s) => true; }\n`, used).links.get("tests/T.cs")?.has("src/X.cs");
ok(ext("Aspire.Hosting") && !ext("App.Inner"), "a namespace declared outside every project's root, which a package's own .props may import, is seen by every file; one under a root is not");
const ext2 = "namespace App.Inner;\npublic static class Ext { public static bool Allowed(this string s) => true; }\n", group = x => `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>${x}</PropertyGroup></Project>`;
const rooted = (x, beside = {}, more = {}) => csharpReach({ "src/App.csproj": group(x), "src/X.cs": ext2, ...used, ...more }, undefined, () => ({ msbuild: beside, cs: {} })).links.get("tests/T.cs")?.has("src/X.cs");
const unread = ["Lib&#46;Core", "Lib%2ECore", "$(Company).App", "<![CDATA[App]]>", "App<!-- c -->", " Lib "].map(v => `<RootNamespace>${v}</RootNamespace>`)
  .concat("<RootNamespace Condition=\"'$(A)' == ''\">App</RootNamespace>", "<RootNamespace>App</RootNamespace><RootNamespace>Lib</RootNamespace>", "<!-- <RootNamespace>Lib</RootNamespace> -->",
    "</PropertyGroup><PropertyGroup Condition=\"false\"><RootNamespace>Lib</RootNamespace>", "</PropertyGroup><ProjectExtensions><RootNamespace>Lib</RootNamespace></ProjectExtensions><PropertyGroup>").filter(x => !rooted(x));
if (!rooted("</PropertyGroup><Import Project=\"root.props\" /><PropertyGroup>", { "src/root.props": "<Project />" })) unread.push("an <Import> of a .props git holds");
ok(!unread.length && rooted("", { "Directory.Build.props": group("<RootNamespace>Lib</RootNamespace>") }) && rooted("", [], { "Directory.Build.props": group("<RootNamespace>Lib</RootNamespace>") }) && !rooted(""),
  "a project that names a <RootNamespace> anywhere or imports a file, or beside a .props or .targets git holds that names one, adds no root, so its namespaces are seen by every file; its name is a root", unread.join(" | "));


// (what git holds beside the texts, the files it lists written in a scratch folder: within CHARACTERS bytes, read; past
// it, Late before a file is read whole)
{
  const here = process.cwd(), dir = scratchDir("held-"), files = [];
  const add = (f, text) => { fs.writeFileSync(path.join(dir, f), text); files.push(f); };
  try {
    add("A.cs", "class A { }\n"); add("Directory.Build.props", "<Project />\n"); add("B.cs", "class B { }\n");
    process.chdir(dir);
    const held = heldBeside({ "B.cs": "" }, undefined, () => files, () => false);
    ok(same(Object.keys(held.cs), ["A.cs"]) && same(Object.keys(held.msbuild), ["Directory.Build.props"]), "what git holds of C# and MSBuild beside the texts is read", JSON.stringify(held));
    let asked = 0, paced;
    try { heldBeside({}, () => { if (++asked > 2) throw new Late("past the budget"); }, () => files, () => false); } catch (e) { paced = e; }
    ok(paced instanceof Late && asked === 3, "the budget is asked before each file git holds beside the texts is read, so many empty files cannot outlast it", String(paced));
    // (git lists them in any case, as MSBuild finds them on Windows)
    git(["init", "-q"]); fs.writeFileSync(path.join(dir, "directory.build.rsp"), "-p:A=b\n"); fs.writeFileSync(path.join(dir, "Low.PROPS"), "<Project />\n"); fs.writeFileSync(path.join(dir, "Up.CSPROJ"), "<Project />\n"); git(["add", "directory.build.rsp", "Low.PROPS", "Up.CSPROJ"]);
    const lower = heldBeside({}); fs.rmSync(path.join(dir, "directory.build.rsp")); git(["rm", "-q", "--cached", "directory.build.rsp"]);
    ok(lower.unknown && Object.keys(heldBeside({}).msbuild).includes("Low.PROPS") && Object.keys(heldBeside({}).msbuild).includes("Up.CSPROJ") && !("Up.CSPROJ" in heldBeside({ "Up.CSPROJ": "" }).msbuild), "a directory.build.rsp, a .PROPS or a .CSPROJ git holds is listed in any case, and a project among the texts is not read again", JSON.stringify(lower));
    fs.symlinkSync("Directory.Build.props", path.join(dir, "Link.props"));
    fs.writeFileSync(path.join(dir, "Directory.Build.rsp"), "-p:CustomAfterMicrosoftCommonTargets=u.xml\n");
    ok(heldBeside({}, undefined, () => [...files, "Directory.Build.rsp"]).unknown, "a Directory.Build.rsp git holds, whose switches may set any property, leaves what git holds unknown, so every file is unsure");
    ok(heldBeside({}, undefined, () => [...files, "Link.props"]).unknown, "a link git holds there, which is not followed, leaves what git holds unknown, so every file is unsure");
    fs.writeFileSync(path.join(dir, "Wide.props"), Buffer.from("\ufeff<Project><ItemGroup><Using Include=\"App\" Alias=\"D\" /></ItemGroup></Project>", "utf16le"));
    fs.writeFileSync(path.join(dir, "Bom.props"), "\ufeff<Project />\n");
    ok(heldBeside({}, undefined, () => [...files, "Wide.props"]).unknown && heldBeside({}, undefined, () => [...files, "Bom.props"]).msbuild["Bom.props"] === "<Project />\n", "a file git holds there in UTF-16, which MSBuild reads and this does not, leaves what git holds unknown; one in UTF-8 with its mark is read");
    add("Big.cs", `// ${"x".repeat(4_000_000)}\n`);
    let thrown;
    try { heldBeside({}, undefined, () => files); } catch (e) { thrown = e; }
    ok(thrown instanceof Late && /past the 4,000,000/u.test(thrown.message), "past 4,000,000 bytes of it, the selection is late and runs the whole suite", String(thrown));
  } finally { process.chdir(here); }
}


done();
