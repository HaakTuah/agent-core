// Tests what a file of C# reaches for the test selection (scripts/select-csharp.mjs, through scripts/select.mjs; #675):
// a type named by a word in a namespace the file sees (its own and those around it, a using directive's, a global one's,
// MSBuild's <Using>), by an attribute, by its full name, through an alias or `using static`; an extension member; a
// delegate; a file of top-level statements by Program; a file C# or a test framework runs with no name; and the files
// whose reach cannot be told (lost by the grammar, reflection, a <Using> that names a property, C# of no project); and
// C# git holds that the config does not read, read as links between the files it reads. Needs the parser (node
// scripts/install.mjs parser). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-csharp-test.mjs
import { csharpReach, ofNoProject } from "../scripts/select-csharp.mjs";
import { links, reached, selection } from "../scripts/select.mjs";
import { parseConfig, survey } from "../scripts/shape.mjs";
import { readCsharp } from "../scripts/shape-csharp.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nothing = () => ({ msbuild: [], cs: {} });

const PROJ = "<Project Sdk=\"Microsoft.NET.Sdk\" />\n";
const config = parseConfig(JSON.stringify({ baseline: "b.json", code: ["src", "tests"], tests: ["tests/"] }));
// What a change to `changed` selects among `texts`, the tests those under tests/.
function pick(texts, changed) {
  const tests = new Set(Object.keys(texts).filter(f => f.startsWith("tests/") && f.endsWith(".cs"))), found = survey(texts, config, tests);
  return selection({ changed: [changed], texts, tests, reach: found.reach, scripts: found.scripts, unsure: found.unsure, config });
}

// ---- a type named by a word, in a namespace the file sees ----
const app = {
  "src/App.csproj": PROJ, "tests/Tests.csproj": "<Project Sdk=\"Microsoft.NET.Sdk\">\n  <ItemGroup>\n    <PackageReference Include=\"xunit\" Version=\"2.9.3\" />\n  </ItemGroup>\n</Project>\n",
  "src/Rules.cs": "namespace App;\npublic static class Rules { public static bool Allowed() => true; }\n",
  "src/Other/Rules.cs": "namespace Other;\npublic static class Rules { public static bool Allowed() => false; }\n",
  "src/Slow.cs": "namespace App.Marks;\npublic class SlowAttribute : System.Attribute { }\n",
  "src/Handler.cs": "namespace App { public delegate void Handler<T>(T value); }\n",
  "src/Ext.cs": "namespace App.Ext;\npublic static class Twice { public static int Double(this int x) => x * 2; }\n",
  "src/Store.cs": "namespace App.Data { public class Store { } }\n",
  "src/Unused.cs": "namespace App.Unused;\npublic class Nobody { }\n",
  "tests/UsingTest.cs": "using App;\nusing Xunit;\nnamespace Tests;\nclass UsingTest { void T() { Rules.Allowed(); } }\n",
  "tests/InsideTest.cs": "namespace App.Tests;\nclass InsideTest { void T() { Rules.Allowed(); } }\n",
  "tests/FullTest.cs": "namespace Tests;\nclass FullTest { void T() { global::App.Data.Store s = null; } }\n",
  "tests/AliasTest.cs": "using S = App.Data.Store;\nusing static App.Rules;\nnamespace Tests;\nclass AliasTest { S s; void T() { Allowed(); } }\n",
  "tests/MarkTest.cs": "using App.Marks;\nnamespace Tests;\nclass MarkTest { [Slow] void T() { } }\n",
  "tests/DelegateTest.cs": "using App;\nnamespace Tests;\nclass DelegateTest { Handler<int> h; }\n",
  "tests/ExtTest.cs": "using App.Ext;\nnamespace Tests;\nclass ExtTest { void T() { 3.Double(); } }\n",
  "tests/OtherTest.cs": "namespace Tests;\nclass OtherTest { void T() { var x = 1; } }\n",
};
const chosen = f => pick(app, f).tests;
ok(same(chosen("src/Rules.cs"), ["tests/AliasTest.cs", "tests/InsideTest.cs", "tests/UsingTest.cs"]),
  "a type is reached by its word through a using directive, from inside its namespace, and through using static; a type of the same word in a namespace the test does not see is not", JSON.stringify(chosen("src/Rules.cs")));
ok(same(chosen("src/Other/Rules.cs"), []), "a type no test sees selects no test, and a using directive of a package's namespace (Xunit, its package xunit) makes none run on any change", JSON.stringify(chosen("src/Other/Rules.cs")));
ok(same(chosen("src/Store.cs"), ["tests/AliasTest.cs", "tests/FullTest.cs"]), "a type is reached by its full name, global:: before it, and through an alias", JSON.stringify(chosen("src/Store.cs")));
ok(same(chosen("src/Slow.cs"), ["tests/MarkTest.cs"]), "an attribute is reached by its name without \"Attribute\"", JSON.stringify(chosen("src/Slow.cs")));
ok(same(chosen("src/Handler.cs"), ["tests/DelegateTest.cs"]), "a delegate, which the grammar indexes as no type, is reached by its name", JSON.stringify(chosen("src/Handler.cs")));
ok(same(chosen("src/Ext.cs"), ["tests/ExtTest.cs"]), "an extension member is reached through the namespace its class stands in, its class never named", JSON.stringify(chosen("src/Ext.cs")));
ok(same(chosen("src/Unused.cs"), []), "a file no test names selects none", JSON.stringify(chosen("src/Unused.cs")));
const block = { ...app, "src/Ext.cs": "namespace App.Ext;\npublic static class Twice { extension(int x) { public int Double() => x * 2; } }\n" };
ok(same(pick(block, "src/Ext.cs").tests, ["tests/ExtTest.cs"]), "and so is one of an extension block", JSON.stringify(pick(block, "src/Ext.cs")));

// ---- usings every file holds: a global using directive, MSBuild's <Using> ----
const globals = {
  "src/App.csproj": PROJ, "src/Rules.cs": "namespace App;\npublic static class Rules { public static bool Allowed() => true; }\n",
  "tests/Tests.csproj": "<Project Sdk=\"Microsoft.NET.Sdk\">\n  <ItemGroup>\n    <Using Include=\"App\" />\n  </ItemGroup>\n</Project>\n",
  "tests/RulesTest.cs": "namespace Tests;\nclass RulesTest { void T() { Rules.Allowed(); } }\n",
};
ok(same(pick(globals, "src/Rules.cs").tests, ["tests/RulesTest.cs"]), "a namespace a .csproj's <Using> names is seen by every file", JSON.stringify(pick(globals, "src/Rules.cs")));
const viaFile = { ...globals, "tests/Tests.csproj": PROJ, "tests/Usings.cs": "global using App;\n" };
ok(same(pick(viaFile, "src/Rules.cs").tests, ["tests/RulesTest.cs"]), "and so is one a global using directive names, in any file", JSON.stringify(pick(viaFile, "src/Rules.cs")));
const props = csharpReach({ ...globals, "tests/Tests.csproj": PROJ }, undefined, () => ({ msbuild: ["<Project><ItemGroup><Using Include=\"App\" /></ItemGroup></Project>"], cs: {} }));
ok(props.links.get("tests/RulesTest.cs")?.has("src/Rules.cs"), "and one a .props or .targets file git holds beside the config's files names", JSON.stringify([...props.links]));

// ---- top-level statements, and what runs with no name ----
const web = {
  "src/App.csproj": PROJ, "tests/Tests.csproj": PROJ,
  "src/Program.cs": "using App;\nvar app = Start.Build();\napp.Run();\n",
  "src/Start.cs": "namespace App;\npublic static class Start { public static object Build() => null; }\n",
  "src/Info.cs": "[assembly: System.Runtime.CompilerServices.InternalsVisibleTo(\"Tests\")]\n",
  "src/Init.cs": "namespace App;\nstatic class Init { [System.Runtime.CompilerServices.ModuleInitializer] internal static void Go() { } }\n",
  "tests/WebTest.cs": "namespace Tests;\nclass WebTest { object f = new Factory<Program>(); }\n",
  "tests/PlainTest.cs": "namespace Tests;\nclass PlainTest { }\n",
};
ok(same(pick(web, "src/Start.cs").tests, ["tests/WebTest.cs"]), "a file of top-level statements is reached by Program, and through it what it names", JSON.stringify(pick(web, "src/Start.cs")));
for (const f of ["src/Info.cs", "src/Init.cs"]) ok(same(pick(web, f).tests, ["tests/PlainTest.cs", "tests/WebTest.cs"]), `${f === "src/Info.cs" ? "an assembly's attribute" : "a module initializer"}, which runs with no name, is reached from every test`, JSON.stringify(pick(web, f)));

// ---- where reach cannot be told ----
const scans = { ...web, "src/Program.cs": "using App;\nvar app = Start.Build();\nbuilder.Services.AddControllers();\n", "src/Lone.cs": "namespace Lone;\nclass Lone { }\n" };
ok(same(pick(scans, "src/Lone.cs").tests, ["tests/WebTest.cs"]), "a test that reaches a file which scans an assembly for types runs on any change", JSON.stringify(pick(scans, "src/Lone.cs")));
const reflects = { ...web, "tests/MakeTest.cs": "namespace Tests;\nclass MakeTest { object o = System.Activator.CreateInstance(System.Type.GetType(\"App.Start\")); }\n" };
ok(pick(reflects, "src/Start.cs").tests.includes("tests/MakeTest.cs"), "and so does one that makes a type by reflection", JSON.stringify(pick(reflects, "src/Start.cs")));
const csTexts = { "src/App.csproj": PROJ, "src/A.cs": "namespace App;\nclass A { }\n", "tests/T.cs": "namespace Tests;\nclass T { }\n" };
for (const [beside, what] of [[() => ({ msbuild: ["<Using Include=\"$(Root).App\" />"], cs: {} }), "a <Using> names an MSBuild property"], [() => ({ unknown: true }), "git cannot be asked"]]) {
  const r = csharpReach(csTexts, undefined, beside);
  ok(same([...r.unsure].sort(), ["src/A.cs", "tests/T.cs"]), `where ${what}, every file of C# is unsure`, JSON.stringify([...r.unsure]));
}
const unread = csharpReach({ "src/App.csproj": PROJ, "src/A.cs": "namespace App;\nclass A { }\n", "tests/T.cs": "using App.Data;\nnamespace Tests;\nclass T { Seed s; }\n" }, undefined,
  () => ({ msbuild: [], cs: { "src/Data/Seed.cs": "namespace App.Data;\nclass Seed { A a; }\n" } }));
ok(unread.links.get("tests/T.cs")?.has("src/Data/Seed.cs") && unread.links.get("src/Data/Seed.cs")?.has("src/A.cs") && !unread.unsure.size,
  "a file of C# git holds that the config does not read is read as a link between those it reads", JSON.stringify([...unread.links].map(([f, to]) => [f, [...to]])));
const through = reached(new Set(["tests/T.cs"]), links({ "tests/T.cs": "", "src/A.cs": "" }, new Set(["tests/T.cs"]), new Map(), undefined, unread.links));
ok(through.get("tests/T.cs").has("src/A.cs"), "and a test reaches, through it, what it links to", JSON.stringify([...through.get("tests/T.cs")]));
ok(ofNoProject("lib/A.cs", csTexts) && !ofNoProject("src/A.cs", csTexts) && !ofNoProject("A.cs", { "App.csproj": PROJ }), "C# is of no project where no .csproj stands in a folder above it");
const lone = { ...app, "shared/Common.cs": "namespace App;\npublic class Common { }\n" };
const loneRun = selection({ changed: ["shared/Common.cs"], texts: lone, tests: new Set(["tests/UsingTest.cs"]), reach: new Map(), config });
ok(loneRun.all && /of no project/u.test(loneRun.why), "a changed file of C# of no project runs the whole suite", JSON.stringify(loneRun));
const r = csharpReach({ ...csTexts, "src/Lost.cs": "namespace App;\nclass Lost { void T() { a?.b += 1; } }\n" }, undefined, nothing);
ok(same([...r.unsure], ["src/Lost.cs"]), "a file the grammar loses is unsure, and no other", JSON.stringify([...r.unsure]));
ok(readCsharp(app["src/Rules.cs"]) === readCsharp(app["src/Rules.cs"]), "a text read once is not parsed again");

// ---- each word of the lists, and each head of a file before its statements ----
const one = (src, extra = {}) => csharpReach({ "src/App.csproj": PROJ, "tests/T.cs": "namespace Tests;\nclass T { }\n", "src/X.cs": src, ...extra }, undefined, nothing);
const hooks = ["ModuleInitializer", "AssemblyInitialize", "AssemblyCleanup", "GlobalTestInitialize", "GlobalTestCleanup", "SetUpFixture", "BeforeEvery", "AfterEvery"]
  .map(w => [w, `namespace H;\nclass X { [${w}] void Go() { } }\n`])
  .concat(["IIncrementalGenerator", "ISourceGenerator"].map(w => [w, `namespace H;\nclass X : ${w} { }\n`]),
    ["Assembly", "TestSession", "TestDiscovery"].map(w => [`Before(${w})`, `namespace H;\nclass X { [Before(${w})] void Go() { } }\n`]),
    [["[module: …]", "[module: System.Security.UnverifiableCode]\nnamespace H;\nclass X { }\n"], ["After(Assembly)", "namespace H;\nclass X { [After(Assembly)] void Go() { } }\n"]]);
const runs = hooks.filter(([, src]) => !one(src).links.get("tests/T.cs")?.has("src/X.cs") || one(src).unsure.size).map(([w]) => w);
ok(!runs.length, "each hook's word, a generator's interface, TUnit's Before and After of the assembly, the session and discovery, and a module's attribute make a file reached from every file, and none unsure", runs.join(", "));
ok(!one("namespace H;\nclass X { [Before(Test)] void Go() { } }\n").links.get("tests/T.cs")?.has("src/X.cs"), "a hook of each test is no hook of the assembly");
const reflectWords = ["Activator.CreateInstance(t)", "a.GetTypes()", "a.ExportedTypes", "a.DefinedTypes", "s.AddControllers()", "s.AddControllersWithViews()", "s.AddMvc()", "s.AddMvcCore()",
  "s.AddRazorPages()", "a.MapControllers()", "a.MapRazorPages()", "a.MapRazorComponents()", "m.AddApplicationPart(a)", "s.AddAutoMapper(a)", "s.AddMediatR(a)", "GetAssemblies()", "Type.GetType(n)", "typeof(X).Assembly"];
const missed = reflectWords.filter(w => !same([...one(`namespace R;\nclass X { void Go() { var r = ${w}; } }\n`).unsure], ["src/X.cs"]));
ok(!missed.length, "each word that finds types by reflection or scans an assembly makes its file unsure, and no other", missed.join(", "));
ok(!one("namespace R;\nclass X { void Go() { var t = x.GetType(); } }\n").unsure.size, "a GetType of an object, not of Type, makes no file unsure");
const named = (src, test = "namespace Tests;\nclass T { object f = new Factory<Program>(); }\n") => one(src, { "tests/T.cs": test }).links.get("tests/T.cs")?.has("src/X.cs");
const heads = [["extern alias", "extern alias Old;\nusing App;\nvar x = 1;\n"], ["a generic alias", "using L = System.Collections.Generic.List<System.Collections.Generic.List<int>>;\nvar x = new L();\n"],
  ["a global using", "global using App;\nvar x = 1;\n"], ["an attribute of the assembly", "using App;\n[assembly: A]\n[assembly: B]\nvar x = 1;\n"]];
const notProgram = heads.filter(([, src]) => !named(src)).map(([w]) => w);
ok(!notProgram.length, "a file of top-level statements is Program past its using directives, extern aliases, generic aliases and attributes", notProgram.join(", "));
const declares = ["public", "internal", "private", "protected", "static", "sealed", "abstract", "partial", "readonly", "ref", "unsafe", "file", "new", "extern"].map(m => [m, `using App;\n${m} class X { }\n`])
  .concat(["struct", "interface", "enum", "record"].map(t => [t, `using App;\n${t} X { }\n`]), [["delegate", "using App;\npublic delegate void X();\n"], ["namespace", "using App;\nnamespace H { class X { } }\n"]]);
const asProgram = declares.filter(([, src]) => named(src)).map(([w]) => w);
ok(!asProgram.length, "a file that declares a type, behind any modifier, is no Program", asProgram.join(", "));

console.log(`${count - failed} of ${count} passed`);
process.exitCode = failed ? 1 : 0;
