// Tests where a <Compile> item decides what a file of C# reaches, for the test selection
// (scripts/select-csharp-project.mjs, through scripts/select-csharp.mjs; #675): every file unsure where one brings in a
// file the reader never reads (outside the repository, one git does not hold, a path MSBuild expands, a wildcard that
// climbs out or names files other than .cs, any item of an imported file), where a project may compile C# by other
// means (any target, a task in the compiler's place, the compiler's own properties, an item the SDK writes C# from or a
// generator, a link or a submodule git holds), and none where it names a file git holds, a wildcard of .cs inside, or
// only removes or updates. Where other MSBuild files decide it:
// select-csharp-msbuild-test.mjs. The cases: select-csharp-test.mjs.
// Needs the parser (node scripts/install.mjs parser). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-csharp-compile-test.mjs
import fs from "node:fs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { csharpReach } from "../scripts/select-csharp.mjs";
import { heldBeside } from "../scripts/select-csharp-project.mjs";
import { git } from "../scripts/select-passed.mjs";
import { done, ok, same } from "./select-csharp-test.mjs";

const lib = { "lib/Rules.cs": "namespace App;\npublic static class Rules { public static bool Allowed() => true; }\n" };
const reach = (item, more = {}) => csharpReach({
  "src/App.csproj": `<Project Sdk="Microsoft.NET.Sdk">${/^<(?:Import|Target|ItemGroup)\b/u.test(item) ? item : `<ItemGroup>${item}</ItemGroup>`}</Project>\n`,
  ...more,
  "src/A.cs": "namespace App;\nclass A { }\n",
  "tests/T.cs": "namespace Tests;\nclass T { void Run() => App.Rules.Allowed(); }\n",
}, undefined, () => ({ msbuild: {}, cs: lib }));
const every = ["lib/Rules.cs", "src/A.cs", "tests/T.cs"];

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
]) {
  const r = reach(item, more);
  ok(same([...r.unsure].sort(), every), `where a project brings in ${what}, every file of C# is unsure`, JSON.stringify([...r.unsure]));
}

for (const [item, what] of [
  [`<Compile Include="../lib/Rules.cs" />`, "a file git holds"],
  [`<Compile Include="..\\lib\\Rules.cs" LinkBase="Shared" />`, "a file git holds, by Windows' separators"],
  [`<Compile Include="../lib/**/*.cs" />`, "a wildcard inside the repository"],
  [`<Compile Remove="Old/*.cs" />`, "nothing, only a removal"],
  [`<Compile Update="A.cs" Link="B.cs" />`, "nothing, only an update"],
  ["", "nothing"],
  [`<Compile Include="../lib/*.CS" />`, "a wildcard of .cs in upper case inside the repository"],
  [`<AssemblyAttribute Include="System.Runtime.CompilerServices.InternalsVisibleTo"><_Parameter1>App.Tests</_Parameter1></AssemblyAttribute><AssemblyAttribute Include=" System.CLSCompliantAttribute "><_Parameter1>true</_Parameter1></AssemblyAttribute>`, "an assembly's attribute of the framework, written with strings alone"],
]) {
  const r = reach(item);
  ok(r.unsure.size === 0 && r.links.get("tests/T.cs")?.has("lib/Rules.cs"), `where a project brings in ${what}, no file is unsure and the links stand`, JSON.stringify([...r.unsure]));
}

// (a link and a submodule git holds, in a scratch repository, written to the index alone, as on a system with no
// links: a wildcard inside, the SDK's default among them, would follow the link out or take the submodule's files)
{
  const here = process.cwd(), dir = scratchDir("linked-");
  try {
    process.chdir(dir); git(["init", "-q"]); fs.writeFileSync("A.cs", "class A { }\n"); git(["add", "A.cs"]);
    const blob = git(["hash-object", "-w", "A.cs"]).trim(), unheld = heldBeside({}), held = {};
    for (const [mode, sha, name] of [["120000", blob, "shared"], ["160000", "1".repeat(40), "vendor/shared"]]) {
      git(["update-index", "--add", "--cacheinfo", `${mode},${sha},${name}`]); held[mode] = heldBeside({}); git(["rm", "-q", "--cached", name]);
    }
    ok(!unheld.unknown && held["120000"].unknown && held["160000"].unknown, "a link or a submodule git holds anywhere leaves what git holds unknown, so every file is unsure", JSON.stringify([unheld, held]));
  } finally { process.chdir(here); }
}

done();
