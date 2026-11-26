// Tests where a <Compile> item decides what a file of C# reaches, for the test selection
// (scripts/select-csharp-project.mjs, through scripts/select-csharp.mjs; #675): every file unsure where one brings in a
// file the reader never reads (outside the repository, one git does not hold, a path MSBuild expands, a wildcard that
// climbs out), and none where it names a file git holds, a wildcard inside, or only removes or updates. Where other
// MSBuild files decide it: select-csharp-msbuild-test.mjs. The cases: select-csharp-test.mjs.
// Needs the parser (node scripts/install.mjs parser). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-csharp-compile-test.mjs
import { csharpReach } from "../scripts/select-csharp.mjs";
import { done, ok, same } from "./select-csharp-test.mjs";

const lib = { "lib/Rules.cs": "namespace App;\npublic static class Rules { public static bool Allowed() => true; }\n" };
const reach = (item, held = lib) => csharpReach({
  "src/App.csproj": `<Project Sdk="Microsoft.NET.Sdk"><ItemGroup>${item}</ItemGroup></Project>\n`,
  "src/A.cs": "namespace App;\nclass A { }\n",
  "tests/T.cs": "namespace Tests;\nclass T { void Run() => App.Rules.Allowed(); }\n",
}, undefined, () => ({ msbuild: {}, cs: held }));
const every = ["lib/Rules.cs", "src/A.cs", "tests/T.cs"];

for (const [item, what] of [
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
  [`<Compile Include="../lib/**/../../../x/*.cs" />`, "a wildcard that climbs out past its wildcard"],
  [`<Compile Include="a.cs" Exclude="b.cs" x />`, "a tag that is no run of attributes"],
]) {
  const r = reach(item);
  ok(same([...r.unsure].sort(), every), `where a <Compile> brings in ${what}, every file of C# is unsure`, JSON.stringify([...r.unsure]));
}

for (const [item, what] of [
  [`<Compile Include="../lib/Rules.cs" />`, "a file git holds"],
  [`<Compile Include="..\\lib\\Rules.cs" LinkBase="Shared" />`, "a file git holds, by Windows' separators"],
  [`<Compile Include="../lib/**/*.cs" />`, "a wildcard inside the repository"],
  [`<Compile Remove="Old/*.cs" />`, "nothing, only a removal"],
  [`<Compile Update="A.cs" Link="B.cs" />`, "nothing, only an update"],
  ["", "nothing"],
]) {
  const r = reach(item);
  ok(r.unsure.size === 0 && r.links.get("tests/T.cs")?.has("lib/Rules.cs"), `where a <Compile> brings in ${what}, no file is unsure and the links stand`, JSON.stringify([...r.unsure]));
}

done();
