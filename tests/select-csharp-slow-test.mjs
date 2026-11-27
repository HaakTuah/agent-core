// Tests the selection's time on C# a pull request writes to be slow to read (scripts/select-csharp.mjs, through
// scripts/select-reach.mjs; #675): each of the files and MSBuild texts below, hostile or only very long, ends in the time
// SECURITY.md item 5 allows, as a selection or as the whole suite, or late. It reads none of the cases' fixture: each
// builds its own base, config and tests. Split from tests/select-test.mjs (#1380), where the selection's other cases
// stand. Needs the parser (node scripts/install.mjs parser). Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/select-csharp-slow-test.mjs
import { Late, hurry } from "../scripts/hurry.mjs";
import { selection } from "../scripts/select-reach.mjs";
import { parseConfig } from "../scripts/shape.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };

// ---- C# a pull request writes to be slow to read (select-csharp.mjs): each ends in time, selected or as the whole suite ----
{
  const csConfig = parseConfig(JSON.stringify({ baseline: "b.json", code: ["src", "tests"], tests: ["tests/"] })), csTests = new Set(["tests/T.cs"]);
  const base = { "App.csproj": "<Project Sdk=\"Microsoft.NET.Sdk\" />\n", "tests/T.cs": "namespace Tests;\nclass T { }\n" };
  const words = n => Array.from({ length: n }, (_, k) => `N${k}`).join(".");
  const shrunk = Object.fromEntries(Array.from({ length: 50 }, (_, k) => [`src/S${k}.cs`, `namespace App;\nclass S${k} { }\n`]));
  for (const [what, more, changed, before] of [
    ["a name of 25,000 dotted words", { "src/X.cs": `namespace App;\nclass X { object o = ${words(25000)}; }\n` }, ["src/X.cs"]],
    ["a namespace of 10,000 dotted words", { "src/X.cs": `namespace ${words(10000)};\nclass X { }\n` }, ["src/X.cs"]],
    ["22,000 aliases of \"(\" before one \";\"", { "src/X.cs": `${"using A=(".repeat(22000)};\nnamespace App;\nclass X { }\n` }, ["src/X.cs"]],
    ["22,000 aliases of \"<\" before one \";\"", { "src/X.cs": `${"using A=<".repeat(22000)};\nnamespace App;\nclass X { }\n` }, ["src/X.cs"]],
    ["190,000 \"$\" before no string", { "src/X.cs": `namespace App;\nclass X { string s = ${"$".repeat(190000)}; }\n` }, ["src/X.cs"]],
    ["a .props of 150,000 \"<Using \"", { "Directory.Build.props": "<Using ".repeat(150000), "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]],
    ["5,000 namespaces of one delegate each", { "src/X.cs": Array.from({ length: 5000 }, (_, k) => `namespace N${k}{delegate void D${k}();}`).join("\n") }, ["src/X.cs"]],
    ["18,000 references to a parameter named @delegate", { "src/X.cs": `namespace App;\nclass X { int F(int @delegate) => ${"@delegate+".repeat(18000)}0; }\n` }, ["src/X.cs"]],
    ["2,000 namespaces each in the last", { "src/X.cs": `${"namespace a{".repeat(2000)}class c{}${"}".repeat(2000)}` }, ["src/X.cs"]],
    ["two files of 10,000 namespaces each in the last, a delegate innermost", { "src/X.cs": `${"namespace a{".repeat(10000)}delegate void d();${"}".repeat(10000)}`, "src/Y.cs": `${"namespace b{".repeat(10000)}delegate void d();${"}".repeat(10000)}` }, ["src/X.cs", "src/Y.cs"]],
    ["a <Using> of 150,000 names", { "Directory.Build.props": `<Project><ItemGroup><Using Include="${"A;".repeat(150000)}" /></ItemGroup></Project>`, "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]],
    ["a <Using> of 1,900,000 names, an alias in its attribute and its element", { "Directory.Build.props": `<Project><ItemGroup><Using Include="${"A;".repeat(1900000)}" Alias="D"><Alias>E</Alias></Using></ItemGroup></Project>`, "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]],
    ["an alias of 18,000 targets heading a name of 15,001 words", { "Directory.Build.props": `<Project><ItemGroup><Using Include="${words(18000)}" Alias="D" /></ItemGroup></Project>`.replaceAll(".", ";"), "src/X.cs": `namespace App;\nclass X { object o = ${"D.".repeat(15000)}D; }\n` }, ["src/X.cs"]],
    ["an alias of 8,000 targets heading 4,000 using directives", { "Directory.Build.props": `<Project><ItemGroup><Using Include="${words(8000)}" Alias="D" /></ItemGroup></Project>`.replaceAll(".", ";"), "src/X.cs": `${Array.from({ length: 4000 }, (_, k) => `using D::U${k};`).join("\n")}\nnamespace App;\nclass X { }\n` }, ["src/X.cs"]],
    ["an alias of 8,000 targets heading 4,000 aliases", { "Directory.Build.props": `<Project><ItemGroup><Using Include="${words(8000)}" Alias="D" /></ItemGroup></Project>`.replaceAll(".", ";"), "src/X.cs": `${Array.from({ length: 4000 }, (_, k) => `using E${k} = D::U${k};`).join("\n")}\nnamespace App;\nclass X { }\n` }, ["src/X.cs"]],
    ...["", "a"].map(w => [`a <RootNamespace> of "${w}", 200,000 spaces and a word, no close`, { "src/App.csproj": `<Project><PropertyGroup><RootNamespace>${w}${" ".repeat(200000)}x</PropertyGroup></Project>`, "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]]),
    ["a <RootNamespace> of 3,900,000 dots", { "src/App.csproj": `<Project><PropertyGroup><RootNamespace>${".".repeat(3900000)}</RootNamespace></PropertyGroup></Project>`, "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]],
    ["an <Import> of 1,300,000 \"../\" and a .props", { "src/Directory.Build.props": `<Project><Import Project="${"../".repeat(1300000)}a.props" /></Project>`, "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]],
    ["an <Import> found above $(MSBuildThisFileDirectory) and 1,300,000 \"../\"", { "src/Directory.Build.props": `<Project><Import Project="$([MSBuild]::GetPathOfFileAbove('a.props', '$(MSBuildThisFileDirectory)${"../".repeat(1300000)}'))" /></Project>`, "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]],
    ["an <Import> of GetPathOfFileAbove( and 1,000,000 spaces, no .props", { "Directory.Build.props": `<Project><Import Project="$([MSBuild]::GetPathOfFileAbove(${" ".repeat(1000000)}x))" /></Project>`, "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]],
    ...["GetPathOfFileAbove('x.props', '$(MSBuildThisFileDirectory)~'", "GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory)~, x.props"].map(call => [`an <Import> of ${call.split("(")[0]} from a folder 1,900,000 deep`, { "Directory.Build.props": `<Project><Import Project="$([MSBuild]::${call.replace("~", "a/".repeat(1900000))}))${call.startsWith("GetDir") ? "/x.props" : ""}" /></Project>`, "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]]),
    ["4,000 aliases each heading the one before it, \".\" and \"::\" in turn", { "src/X.cs": `using A0 = App;\nnamespace N {\n${Array.from({ length: 4000 }, (_, k) => `using A${4000 - k} = A${3999 - k}${k % 2 ? "::" : "."}W;`).join("\n")}\nclass X { }\n}\n` }, ["src/X.cs"]],
    ["a <Compile of 1,000,000 characters and no end", { "Directory.Build.props": `<Project><ItemGroup><Compile${"a".repeat(1000000)}</ItemGroup></Project>`, "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]],
    ["a <Using of 1,000,000 spaces before a stray character", { "Directory.Build.props": `<Project><ItemGroup><Using${" ".repeat(1000000)}x /></ItemGroup></Project>`, "src/X.cs": "namespace App;\nclass X { }\n" }, ["src/X.cs"]],
    ...["/*", "var s = @\""].map(open => [`a ${open} of 199,900 line ends`, { "src/X.cs": `namespace App;\nclass X { }\n${open}${"\n".repeat(199900)}*/";\n` }, ["src/X.cs"]]),
    ["50 files of C# each 100,000 characters at the base, past what the selection reads", shrunk, Object.keys(shrunk), f => (f in shrunk ? `namespace App;\n${"// x\n".repeat(20000)}` : null)],
  ]) {
    const texts = { ...base, ...more }, from = Date.now();
    let got;
    try { got = selection({ changed, texts, tests: csTests, reach: new Map(), config: csConfig, watch: hurry({ files: new Set(changed) }), beside: () => ({ msbuild: {}, cs: {} }), ...(before && { before }) }); } catch (e) { got = e instanceof Late ? "late" : String(e); }
    const ms = Date.now() - from;
    ok((before ? got === "late" : got === "late" || got.all !== undefined) && ms < 5000, `${what}: ${got === "late" ? "the whole suite, late" : got.all ? "the whole suite" : "selected"} in ${ms} ms`, String(got));
  }
}

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
