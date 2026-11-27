// Tests where an MSBuild file decides which files of C# a project compiles, for the test selection
// (scripts/select-csharp-compiles.mjs, through scripts/select-csharp.mjs; #675): every file unsure where one brings in a
// file the reader never reads (outside the repository, one git does not hold, a path MSBuild expands, a wildcard that
// climbs out or names files other than .cs, any item of an imported file, a project of another kind or outside),
// where a project may compile C# by other means (an element or attribute not on the list known safe, so any target,
// task, compiler property, generator item or referenced project's properties among them; a property function, a
// character reference, a processing instruction or a document type; a value's line break or quote; a Link that climbs
// or expands, or on an item but <Compile>; a copy to the output of what may be C#; a wildcard that may reach a folder
// a build writes; an SDK not known, in its own case; a link, a submodule, a path
// with a control character, a file of Razor or XAML, or a solution that builds what is not a .csproj held under C#'s
// type), and none
// where it names a file or project git holds, a wildcard of .cs inside, or only removes or updates, or a solution builds
// only a .csproj held; a file of C# that declares a type of System or Microsoft, or holds a Unicode escape, reached from
// every file. Where other MSBuild files decide it:
// select-csharp-msbuild-test.mjs. The cases: select-csharp-test.mjs.
// Needs the parser (node scripts/install.mjs parser). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-csharp-compile-test.mjs
import fs from "node:fs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { csharpReach } from "../scripts/select-csharp.mjs";
import { heldBeside, msbuildUsings } from "../scripts/select-csharp-project.mjs";
import { git } from "../scripts/select-passed.mjs";
import { done, ok, same } from "./select-csharp-test.mjs";

const lib = { "lib/Rules.cs": "namespace App;\npublic static class Rules { public static bool Allowed() => true; }\n" };
const reach = (item, more = {}) => csharpReach({
  "src/App.csproj": `<Project Sdk="Microsoft.NET.Sdk">${/^<(?:Import|Target|ItemGroup)\b/u.test(item) ? item : `<ItemGroup>${item}</ItemGroup>`}</Project>\n`,
  ...more,
  "src/A.cs": "namespace App;\nclass A { }\n",
  "tests/T.cs": "namespace Tests;\nclass T { void Run() => App.Rules.Allowed(); }\n",
}, undefined, () => ({ msbuild: {}, cs: lib }));
const every = ["lib/Rules.cs", "src/A.cs", "tests/T.cs"], LIB = { "lib/Lib.csproj": "<Project Sdk=\"Microsoft.NET.Sdk\" />\n" };

for (const [item, what, more] of [
  [`<Compile Include="../../shared/Bridge.cs" />`, "a file outside the repository"],
  [`<Compile Include="..\\..\\shared\\Bridge.cs" />`, "a file outside the repository, by Windows' separators"],
  [`<compile include="../../shared/Bridge.cs" />`, "a file outside the repository, the item type in lower case"],
  [`<Compile Include="/opt/shared/Bridge.cs" />`, "a file by a rooted path"],
  [`<Compile Include="Gen/Made.cs" />`, "a file of the repository git does not hold"],
  [`<Compile Include="../lib/Rules.cs;../../shared/Bridge.cs" />`, "a file outside the repository beside one git holds"],
  [`<Compile Include="$(SharedDir)Bridge.cs" />`, "a path with a property MSBuild expands"],
  [`<Compile Include="@(Shared)" />`, "an item MSBuild expands"],
  [`<Compile Include="..%2F..%2Fshared%2FBridge.cs" />`, "an escape MSBuild expands"],
  [`<Compile Include="../../**/*.cs" />`, "a wildcard that climbs out of the repository"],
  [`<Compile Include="../lib/**/../../../x/*.cs" />`, "a wildcard with a climb after it, read as climbing out where MSBuild would expand none"],
  [`<Compile Include="../gen/*.txt" />`, "a wildcard of files other than .cs"],
  [`<Compile Include="../gen/**/*" />`, "a wildcard of every file"],
  [`<Compile Include="../gen/*.cs?" />`, "a wildcard whose name may end past .cs"],
  [`<Compile Include="a.cs" Exclude="b.cs" x />`, "a tag that is no run of attributes"],
  [`<Import Project="../a/b/c/x.props" />`, "a file outside the repository, from an imported file whose own folder would lead to one git holds", { "a/b/c/x.props": `<Project><ItemGroup><Compile Include="../../../lib/Rules.cs" /></ItemGroup></Project>\n` }],
  [`<Import Project="../build/Shared.props" />`, "a wildcard from an imported file, read from the project's folder", { "build/Shared.props": `<Project><ItemGroup><Compile Include="../*.cs" /></ItemGroup></Project>\n` }],
  [`<Target Name="Gather"><CreateItem Include="../../shared/Bridge.cs"><Output TaskParameter="Include" ItemName="Compile" /></CreateItem></Target>`, "a task's output into the item Compile"],
  [`<Target Name="Gather"><ReadLinesFromFile File="list.txt"><Output TaskParameter="Lines" ItemName=" compile " /></ReadLinesFromFile></Target>`, "a task's output into the item Compile, its name spaced and in lower case"],
  [`<Target Name="Build"><Csc Sources="../../shared/Bridge.cs" /></Target>`, "the compiler called by hand"],
  [`<Target Name="corecompile" />`, "a target CoreCompile of its own"],
  [`<Target Name="Gen"><WriteLinesToFile File="Gen/Made.cs" Lines="x" /><ItemGroup><Compile Include="Gen/*.cs" /></ItemGroup></Target>`, "a wildcard in a target, which may match a file the target wrote"],
  [`<Target Name="Build" /><ItemGroup><Compile Include="../lib/*.cs" /></ItemGroup>`, "a wildcard beside a target"],
  [`<ItemGroup><AssemblyAttribute Include="App.HookAttribute"><_Parameter1>App.Rules</_Parameter1></AssemblyAttribute></ItemGroup>`, "an assembly's attribute, which the SDK writes as C#"],
  [`<AssemblyAttribute Include="System.Runtime.CompilerServices.InternalsVisibleTo"><_Parameter1>App.Rules</_Parameter1><_Parameter1_IsLiteral>true</_Parameter1_IsLiteral></AssemblyAttribute>`, "an assembly's attribute of the framework whose argument is written as code"],
  ["", "an assembly's attribute of the framework whose argument an item definition elsewhere writes as a type", { "Directory.Build.props": `<Project><ItemDefinitionGroup><AssemblyAttribute><_Parameter1_TypeName>System.Type</_Parameter1_TypeName></AssemblyAttribute></ItemDefinitionGroup></Project>\n` }],
  [`<Target Name="Gen" AfterTargets="Restore"><WriteLinesToFile File="Gen/Made.cs" Lines="x" /></Target>`, "a file a target writes, which the SDK's default glob takes"],
  [`<Import Project="../build/Gen.targets" />`, "a file a target in an imported file writes", { "build/Gen.targets": `<Project><Target Name="Gen" BeforeTargets="Build"><WriteLinesToFile File="$(MSBuildProjectDirectory)/Gen/Made.cs" Lines="x" /></Target></Project>\n` }],
  ["", "a file a target in Directory.Build.targets writes", { "Directory.Build.targets": `<Project><Target Name="Gen" /></Project>\n` }],
  [`<Target Name="Gather"><CreateItem Include="x.txt"><Output TaskParameter="Include" ItemName="Notes" /></CreateItem></Target>`, "a task's output into any item, even one of another name"],
  [`<Target Name="Gather"><CreateItem Include="App.HookAttribute"><Output TaskParameter="Include" ItemName="AssemblyAttribute" /></CreateItem></Target>`, "a task's output into AssemblyAttribute"],
  [`<Target Name="Gather" BeforeTargets="GenerateGlobalUsings"><CreateItem Include="App"><Output TaskParameter="Include" ItemName="Using" /></CreateItem></Target>`, "a task's output into Using"],
  [`<Target Name="Build" />`, "a target of any name, even an empty one"],
  [`<UsingTask TaskName="Csc" AssemblyFile="tools/MyCsc.dll" />`, "a task of its own in the compiler's place"],
  [`<PropertyGroup><CompilerResponseFile>extra.rsp</CompilerResponseFile></PropertyGroup>`, "a response file handed to the compiler"],
  [`<PropertyGroup><CscToolPath>tools</CscToolPath><CscToolExe>mycsc</CscToolExe></PropertyGroup>`, "a compiler of its own"],
  [`<ItemGroup><Analyzer Include="tools/Gen.dll" /></ItemGroup>`, "a generator held as a binary"],
  [`<ItemGroup><TestingPlatformBuilderHook Include="Hook"><TypeFullName>App.Rules</TypeFullName></TestingPlatformBuilderHook></ItemGroup>`, "a hook the testing platform writes C# to call"],
  [`<AssemblyAttribute Include="System.ClsCompliant"><_Parameter1>on</_Parameter1></AssemblyAttribute>`, "an assembly's attribute of the framework's name in another case, which C# binds to a type of the repository"],
  [`<ProjectReference Include="../gen/Gen.proj" />`, "a project of another kind, whose targets the reader never reads"],
  [`<ProjectReference Include="../../outside/Lib.csproj" />`, "a project outside the repository"],
  [`<ProjectReference Include="../lib/*.csproj" />`, "projects by a wildcard"],
  [`<ProjectReference Include="../lib/Lib.csproj" OutputItemType="Compile" />`, "what a referenced project returns, put into an item", LIB],
  [`<ProjectReference Include="../lib/Lib.csproj" AdditionalProperties="DirectoryBuildPropsPath=../../x.props" />`, "a referenced project built with properties of its own", LIB],
  [`<Import Project="../build/Refs.props" />`, "a project referenced from an imported file, read from the project's folder", { ...LIB, "build/Refs.props": `<Project><ItemGroup><ProjectReference Include="../lib/Lib.csproj" /></ItemGroup></Project>\n` }],
  [`<PropertyGroup><BaseIntermediateOutputPath>../../outside/obj/</BaseIntermediateOutputPath></PropertyGroup>`, "a folder of the project's extensions outside, whose .props and .targets the SDK imports"],
  [`<PropertyGroup><MSBuildProjectExtensionsPath>../../outside/obj/</MSBuildProjectExtensionsPath></PropertyGroup>`, "a folder of the project's extensions moved"],
  [`<PropertyGroup><Features>strict\n/recurse:../../outside/*.cs\n#</Features></PropertyGroup>`, "a value whose line break may carry a switch of its own to the compiler"],
  [`<PropertyGroup><Features>strict<!-- c -->\n/recurse:x.cs</Features></PropertyGroup>`, "a value whose line break stands after a comment"],
  [`<PropertyGroup><Features>strict&#10;/recurse:x.cs</Features></PropertyGroup>`, "a value with a line break's XML escape"],
  [`<PropertyGroup><Features>strict%0a/recurse:x.cs</Features></PropertyGroup>`, "a value with a line break's MSBuild escape"],
  [`<PropertyGroup><RootNamespace><![CDATA[App]]></RootNamespace></PropertyGroup>`, "a CDATA section, which may carry a line break"],
  [`<PropertyGroup><!-- a comment with no end</PropertyGroup>`, "a comment with no end"],
  [`<PropertyGroup><PathMap>a=b$([System.Environment]::NewLine)x.cs</PathMap></PropertyGroup>`, "a property function, which may return a line break"],
  [`<PropertyGroup><RootNamespace>App$( [System.Environment]::NewLine)</RootNamespace></PropertyGroup>`, "a property function, spaced"],
  [`<PropertyGroup><RootNamespace>Lib&#46;Core</RootNamespace></PropertyGroup>`, "a numeric character reference, which may spell a line break or a \"$\""],
  ["", "a processing instruction whose \"<!--\" would hide a line break from the comments' reading", { "Directory.Build.props": "<?x <!-- ?><Project><PropertyGroup><PathMap>a=b\nx.cs</PathMap></PropertyGroup></Project><!-- -->" }], // (no line break past it, which would stand beside what the cut leaves)
  ["", "a <!DOCTYPE>, which may define entities", { "Directory.Build.props": "<!DOCTYPE Project [<!ENTITY e \"x\">]><Project />\n" }],
  [`<ProjectReference Include="../lib/Lib.csproj" Properties="DirectoryBuildPropsPath=../hook.xml" />`, "a referenced project's Properties", LIB],
  [`</ItemGroup><ItemDefinitionGroup><ProjectReference><Properties>X=Y</Properties></ProjectReference></ItemDefinitionGroup><ItemGroup>`, "a referenced project's Properties, as an item definition's element", LIB],
  [`<PropertyGroup><CscEnvironment>DOTNET_STARTUP_HOOKS=../../outside/Hook.dll</CscEnvironment></PropertyGroup>`, "the compiler's environment"],
  [`</ItemGroup><ProjectExtensions><X /></ProjectExtensions><ItemGroup>`, "an element the reader does not know"],
  [`<Using Include="App" Note="x" />`, "an attribute the reader does not know"],
  [`<Using Include="App" include="Other" />`, "two attributes alike but in case, of which a reader may take either"],
  [`<None Include="docs/x.md" Link="../../tests/Gen.cs" CopyToOutputDirectory="Always" />`, "a Link on another item than <Compile>, which sets where a copy is written"],
  [`<Content Include="docs/**" LinkBase="../../../tests" CopyToOutputDirectory="Always" />`, "a LinkBase on another item than <Compile>"],
  [`<Compile Update="A.cs" Link="../../../../../tests/Guard.cs" CopyToOutputDirectory="Always" />`, "a <Compile> copied to the output by a Link that climbs, over a file another project compiles"],
  [`<Compile Update="A.cs" CopyToOutputDirectory="PreserveNewest" />`, "a <Compile> copied to the output"],
  [`<Compile Update="A.cs"><CopyToPublishDirectory>Always</CopyToPublishDirectory></Compile>`, "a <Compile> copied to the output, written inside it"],
  [`<Compile Update="A.cs" Link="../Shown/A.cs" />`, "a Link on a <Compile> that climbs"],
  [`<Compile Update="A.cs" LinkBase="$(Shared)" />`, "a LinkBase on a <Compile> that MSBuild expands"],
  [`<None Include="../lib/Rules.cs" CopyToOutputDirectory="Always" />`, "a file of C# copied to the output, where another project's wildcard may compile it"],
  [`<Content Include="gen/*"><CopyToOutputDirectory>Always</CopyToOutputDirectory></Content>`, "a wildcard copied to the output, written inside the item"],
  [`<None Include="docs/Gen.cs/." CopyToOutputDirectory="Always" /><None Include="docs\\Gen.cs\\." CopyToPublishDirectory="Always" />`, "a file of C# copied to the output by a path whose trailing separator and dot Windows drops"],
  [`<Compile Include="../lib/bin/**/*.cs" />`, "a wildcard into a folder named bin, which a build writes"],
  [`<Compile Include="../lib/Obj. /*.cs" />`, "a wildcard into a folder named obj, by a name Windows trims"],
  [`<Compile Include="../lib/**/*.cs" />`, "a wildcard whose folders may reach a project's folder, where its build writes", LIB],
  [`<Compile Include="**/*.cs" />`, "a wildcard whose folders reach its own project's folder"],
  ["", "an SDK the reader knows but in another case, which the resolver may not find as its own", { "Directory.Build.props": "<Project Sdk=\"microsoft.net.sdk\" />\n" }],
  [`<PropertyGroup><NoWarn>CS1591&quot; /x:y</NoWarn></PropertyGroup>`, "a quote in a value, which may close the compiler's argument"],
  [`<PropertyGroup><NoWarn>CS1591%22 /x:y</NoWarn></PropertyGroup>`, "a quote in a value, by MSBuild's escape"],
  ["", "an SDK the reader does not know, whose files may write C#", { "Directory.Build.props": "<Project Sdk=\"Aspire.AppHost.Sdk/9.5.0\" />\n" }],
  [`</ItemGroup><Sdk Name="Aspire.AppHost.Sdk" Version="9.5.0" /><ItemGroup>`, "an SDK the reader does not know, as an element"],
]) {
  const r = reach(item, more);
  ok(same([...r.unsure].sort(), every), `where a project brings in ${what}, every file of C# is unsure`, JSON.stringify([...r.unsure]));
}

for (const [item, what, more] of [
  [`<Compile Include="../lib/Rules.cs" />`, "a file git holds"],
  [`<Compile Include="..\\lib\\Rules.cs" LinkBase="Shared" />`, "a file git holds, by Windows' separators"],
  [`<Compile Include="../lib/**/*.cs" />`, "a wildcard inside the repository"],
  [`<Compile Remove="Old/*.cs" />`, "nothing, only a removal"],
  [`<Compile Update="A.cs" Link="B.cs" />`, "nothing, only an update"],
  [`<None Include="data.json"><CopyToOutputDirectory>Always</CopyToOutputDirectory></None><Content Update="wwwroot/site.css" CopyToPublishDirectory="Always" />`, "files other than C# copied to the output"],
  ["", "nothing"],
  [`<Compile Include="../lib/*.CS" />`, "a wildcard of .cs in upper case inside the repository"],
  [`<Compile Include="../lib/*.cs" />`, "a wildcard of the files of a project's own folder, which reaches none of its build's folders", LIB],
  [`<AssemblyAttribute Include="System.Runtime.CompilerServices.InternalsVisibleTo"><_Parameter1>App.Tests</_Parameter1></AssemblyAttribute><AssemblyAttribute Include=" System.CLSCompliantAttribute "><_Parameter1>true</_Parameter1></AssemblyAttribute>`, "an assembly's attribute of the framework, written with strings alone"],
  [`<ProjectReference Include="../lib/Lib.csproj" />`, "a project git holds", LIB],
  [`<ProjectReference Include="..\\lib\\Lib.csproj" />`, "a project git holds, by Windows' separators", LIB],
  [`</ItemGroup><Sdk Name="MSTest.Sdk" Version="3.6.3"></Sdk><ItemGroup><Compile Update="A.cs" Link="Shown/A.cs" />`, "an SDK the reader knows, and a Link on a <Compile>"],
  ["", "a project of the usual properties, packages and files, in a file that opens with a byte order mark and the XML declaration", { "Directory.Build.props": "\uFEFF<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<Project><PropertyGroup Condition=\"'$(Configuration)' == 'Debug'\"><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><NoWarn>$(NoWarn);CS1591</NoWarn></PropertyGroup><ItemGroup><PackageReference Include=\"xunit\" Version=\"2.9.0\"><PrivateAssets>all</PrivateAssets></PackageReference><None Include=\"data.json\" CopyToOutputDirectory=\"PreserveNewest\" /></ItemGroup></Project>\n" }],
  [`<Compile\n    Include="../lib/Rules.cs"\n    />\n  </ItemGroup>\n  <PropertyGroup>\n    <LangVersion>latest</LangVersion>\n    <!-- a note\n      over lines -->\n  </PropertyGroup><ItemGroup>`, "a file git holds, its tags and comments over lines"],
]) {
  const r = reach(item, more);
  ok(r.unsure.size === 0 && r.links.get("tests/T.cs")?.has("lib/Rules.cs"), `where a project brings in ${what}, no file is unsure and the links stand`, JSON.stringify([...r.unsure]));
}

let paced = 0;
const attrs = msbuildUsings([["src/App.csproj", `<Project><ItemGroup>${"<AssemblyAttribute Include=\"System.CLSCompliant\" />".repeat(1000)}</ItemGroup></Project>`]], () => paced++);
ok(attrs !== null && paced >= 1000, "the budget is asked for each assembly's attribute, which leaves the links standing", `${paced} ${attrs === null}`);

// (a type of System, where an attribute the SDK writes binds, or a Unicode escape, which may spell one, reached from every file)
for (const [guard, what] of [["namespace System;\npublic class ClsCompliantAttribute : Attribute { }\n", "declares a type in System"],
  ["namespace System.Runtime.CompilerServices;\npublic class InternalsVisibleToAttribute : Attribute { }\n", "declares a type below System"],
  ["namespace Microsoft.Extensions.Configuration.UserSecrets;\npublic class UserSecretsIdAttribute : Attribute { }\n", "declares a type below Microsoft, where the SDK writes UserSecretsIdAttribute"],
  ["namespace Tests;\npublic class Gu\\u0061rd { }\n", "holds a Unicode escape outside a literal"]]) {
  ok(reach("", { "tests/Guard.cs": guard }).links.get("tests/T.cs")?.has("tests/Guard.cs"), `a file that ${what} is reached from every file`);
}
ok(!reach("", { "tests/Guard.cs": "namespace Tests;\npublic class Guard { string s = \"\\u0061\"; }\n" }).links.get("tests/T.cs")?.has("tests/Guard.cs"), "a file whose escape stands in a literal alone is reached by name alone");
const held = (texts, listed = []) => heldBeside(texts, () => {}, () => listed, () => false).unknown === true;
const other = [held({}, ["gen/Gen.vbproj"]), held({ "tools/Gen.proj": "<Project />" }), held({ "gen/Gen.my-proj": "<Project />" }), held({ "gen/Gen.ñproj": "<Project />" }), held({})];
ok(same(other, [true, true, true, true, false]), "a project of another kind git holds or the change holds leaves what git holds unknown, so every file is unsure", JSON.stringify(other));
const odd = [held({}, ["src/A.cs\n/recurse:x\n#.cs"]), held({ "src/B\r.cs": "class B { }\n" }), held({ "src/Counter.razor": "<p />\n" }), held({ "src/Pages/Index.CSHTML": "<p />\n" }), held({ "src/App.xaml": "<Application />\n" }), held({ "src/Views/Main.axaml": "<UserControl />\n" })];
ok(odd.every(Boolean), "a path with a control character, which splits the compiler's response file, or a file the SDK compiles from Razor or XAML, leaves what git holds unknown", JSON.stringify(odd));
const SLN = (...lines) => `Microsoft Visual Studio Solution File, Format Version 12.00\n${lines.join("\n")}\nGlobal\nEndGlobal\n`, APP = { "src/App.csproj": "<Project />" };
const project = (guid, p) => `Project("{${guid}}") = "X", "${p}", "{11111111-2222-3333-4444-555555555555}"\nEndProject`, CSG = "FAE04EC0-301F-11D3-BF4B-00C04F79EFBC";
const sln = [
  held({ ...APP, "App.sln": SLN(project(CSG, "src\\App.csproj"), project("2150E333-8FDC-42A3-9474-1A3956D46DE8", "Tools")) }),
  held({ ...APP, "App.slnx": "<Solution><Folder Name=\"/t/\"><File Path=\"README.md\" /></Folder><Project Path=\"src/App.csproj\" /></Solution>\n" }),
  held({ ...APP, "App.sln": SLN(project(CSG, "src\\App.csproj")), "App.slnf": JSON.stringify({ solution: { path: "App.sln", projects: ["src\\App.csproj"] } }) }),
  held({ ...APP, "App.sln": SLN(project(CSG, "src\\App.csproj"), project(CSG, "gen\\gen.build")) }),
  held({ ...APP, "App.sln": SLN(project(CSG, "..\\outside\\App.csproj")) }),
  held({ ...APP, "App.sln": SLN("Project(\"{x}\") = broken") }),
  held({ ...APP, "App.slnx": "<Solution><Project Path=\"gen/gen.build\" /></Solution>\n" }),
  held({ ...APP, "App.slnx": "<Solution><Project Path=\"src/App.csproj\" Type=\"Classic C#\" /></Solution>\n" }),
  held({ ...APP, "App.slnf": JSON.stringify({ solution: { path: "../outside/App.sln", projects: ["src\\App.csproj"] } }) }),
  held({ ...APP, "App.slnf": "{" }),
  held({ ...APP, "App.sln": SLN(`${project(CSG, "src\\App.csproj")}\r${project(CSG, "gen\\gen.build")}`) }),
  held({ ...APP, "App.sln": SLN(`\u0085${project(CSG, "gen\\gen.build")}`) }),
  held({ ...APP, "App.slnx": "<Solution><Project Path=\"gen/gen.build\" PATH=\"src/App.csproj\" /></Solution>\n" }),
  held({ ...APP, "App.sln": `\uFEFF${SLN(project(CSG, "src\\App.csproj")).replace(/\n/gu, "\r\n")}` }),
  held({ ...APP, "App.sln": SLN(project("9a19103f-16f7-4668-be54-9a1e7a4f7556", "src\\App.csproj")) }),
  held({ ...APP, "App.sln": SLN(project("E24C65DC-7377-472B-9ABA-BC803B73C61A", "src\\App.csproj")) }),
];
ok(same(sln, [false, false, false, true, true, true, true, true, true, true, true, true, true, false, false, true]), "a solution that builds a .csproj held under C#'s type, old or the SDK's, or a folder alone, leaves what git holds read; one that lists another project, a path outside, a line it cannot read (a bare carriage return ending one, a character past ASCII), another type (a web site's), a type in a .slnx, an attribute twice, or a filter of a solution not held, leaves it unknown; a byte order mark and Windows' line ends are read", JSON.stringify(sln));

// (a link and a submodule git holds, in a scratch repository, written to the index alone, as on a system with no
// links: a wildcard inside, the SDK's default among them, would follow the link out or take the submodule's files)
{
  const here = process.cwd(), dir = scratchDir("linked-");
  try {
    process.chdir(dir); git(["init", "-q"]); fs.writeFileSync("A.cs", "class A { }\n"); git(["add", "A.cs"]);
    const blob = git(["hash-object", "-w", "A.cs"]).trim(), unheld = heldBeside({}), linked = {};
    for (const [mode, sha, name] of [["120000", blob, "shared"], ["160000", "1".repeat(40), "vendor/shared"]]) {
      git(["update-index", "--add", "--cacheinfo", `${mode},${sha},${name}`]); linked[mode] = heldBeside({}); git(["rm", "-q", "--cached", name]);
    }
    ok(!unheld.unknown && linked["120000"].unknown && linked["160000"].unknown, "a link or a submodule git holds anywhere leaves what git holds unknown, so every file is unsure", JSON.stringify([unheld, linked]));
    // (git's own list, by the default patterns: a project of another kind, written to the index alone, read so)
    git(["update-index", "--add", "--cacheinfo", `100644,${blob},gen/Gen.proj`]);
    ok(heldBeside({}).unknown === true, "a project of another kind git holds, listed by the default patterns, leaves what git holds unknown");
    git(["rm", "-q", "--cached", "gen/Gen.proj"]); git(["update-index", "--add", "--cacheinfo", `100644,${blob},src/Views/Main.axaml`]);
    ok(heldBeside({}).unknown === true, "a file of Avalonia's XAML git holds, listed by the default patterns, leaves what git holds unknown");
  } finally { process.chdir(here); }
}
done();
