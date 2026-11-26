// Tests where a <Compile> item decides what a file of C# reaches, for the test selection
// (scripts/select-csharp-project.mjs, through scripts/select-csharp.mjs; #675): every file unsure where one brings in a
// file the reader never reads (outside the repository, one git does not hold, a path MSBuild expands, a wildcard that
// climbs out, names files other than .cs or stands beside a target, any item of an imported file, a task's output into
// Compile, the compiler called by hand, an assembly's attribute, a link git holds), and none where it names a file git
// holds, a wildcard of .cs inside, or only removes or updates. Where other MSBuild files decide it:
// select-csharp-msbuild-test.mjs. The cases: select-csharp-test.mjs.
// Needs the parser (node scripts/install.mjs parser). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-csharp-compile-test.mjs
import fs from "node:fs";
import path from "node:path";
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
]) {
  const r = reach(item, more);
  ok(same([...r.unsure].sort(), every), `where a <Compile> brings in ${what}, every file of C# is unsure`, JSON.stringify([...r.unsure]));
}

for (const [item, what] of [
  [`<Compile Include="../lib/Rules.cs" />`, "a file git holds"],
  [`<Compile Include="..\\lib\\Rules.cs" LinkBase="Shared" />`, "a file git holds, by Windows' separators"],
  [`<Compile Include="../lib/**/*.cs" />`, "a wildcard inside the repository"],
  [`<Compile Remove="Old/*.cs" />`, "nothing, only a removal"],
  [`<Compile Update="A.cs" Link="B.cs" />`, "nothing, only an update"],
  ["", "nothing"],
  [`<Target Name="Gather"><CreateItem Include="x.txt"><Output TaskParameter="Include" ItemName="Notes" /></CreateItem></Target>`, "nothing, only a task's output into another item"],
  [`<Target Name="Build" />`, "nothing, only a target of another name"],
  [`<Compile Include="../lib/*.CS" />`, "a wildcard of .cs in upper case inside the repository"],
]) {
  const r = reach(item);
  ok(r.unsure.size === 0 && r.links.get("tests/T.cs")?.has("lib/Rules.cs"), `where a <Compile> brings in ${what}, no file is unsure and the links stand`, JSON.stringify([...r.unsure]));
}

// (a link git holds, in a scratch repository: a wildcard inside, the SDK's default among them, would follow it out)
{
  const here = process.cwd(), dir = scratchDir("linked-");
  try {
    process.chdir(dir); git(["init", "-q"]); fs.symlinkSync(path.join(dir, "..", "outside"), "shared");
    const unheld = heldBeside({}); git(["add", "shared"]);
    const held = heldBeside({});
    ok(!unheld.unknown && held.unknown, "a link git holds anywhere, to a folder outside the repository say, leaves what git holds unknown, so every file is unsure", JSON.stringify([unheld, held]));
  } finally { process.chdir(here); }
}

done();
