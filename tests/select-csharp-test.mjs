// Tests what a file of C# reaches for the test selection (scripts/select-csharp.mjs, through scripts/select.mjs; #675):
// a type named by a word in a namespace the file sees (its own and those around it, a using directive's, a global one's,
// MSBuild's <Using>), by an attribute, by its full name, through an alias or `using static`; an extension member; a
// delegate; a file of top-level statements by Program; a file C# or a test framework runs with no name; and C# git holds
// that the config does not read, read as links between the files it reads. Where reach cannot be told:
// select-csharp-unsure-test.mjs, which imports the cases made here; run by itself, this file checks them. Needs the
// parser (node scripts/install.mjs parser). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-csharp-test.mjs
import { csharpReach } from "../scripts/select-csharp.mjs";
import { links, reached, selection } from "../scripts/select.mjs";
import { parseConfig, survey } from "../scripts/shape.mjs";
import { readCsharp } from "../scripts/shape-csharp.mjs";
import { started } from "../scripts/started.mjs";

// the checks' tally, and the cases both tests share: the projects, and what a change selects among them
let failed = 0, count = 0;
export const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
export const done = () => { console.log(`${count - failed} of ${count} passed`); process.exitCode = failed ? 1 : 0; };
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const nothing = () => ({ msbuild: [], cs: {} });

export const PROJ = "<Project Sdk=\"Microsoft.NET.Sdk\" />\n";
export const config = parseConfig(JSON.stringify({ baseline: "b.json", code: ["src", "tests"], tests: ["tests/"] }));
// What a change to `changed` selects among `texts`, the tests those under tests/, `was` its text at the base.
export function pick(texts, changed, was) {
  const tests = new Set(Object.keys(texts).filter(f => f.startsWith("tests/") && f.endsWith(".cs"))), found = survey(texts, config, tests);
  return selection({ changed: [changed], texts, tests, reach: found.reach, scripts: found.scripts, unsure: found.unsure, config, ...(was !== undefined && { before: f => (f === changed ? was : null) }) });
}

// ---- a type named by a word, in a namespace the file sees ----
export const app = {
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
export const globals = {
  "src/App.csproj": PROJ, "src/Rules.cs": "namespace App;\npublic static class Rules { public static bool Allowed() => true; }\n",
  "tests/Tests.csproj": "<Project Sdk=\"Microsoft.NET.Sdk\">\n  <ItemGroup>\n    <Using Include=\"App\" />\n  </ItemGroup>\n</Project>\n",
  "tests/RulesTest.cs": "namespace Tests;\nclass RulesTest { void T() { Rules.Allowed(); } }\n",
};
export const viaFile = { ...globals, "tests/Tests.csproj": PROJ, "tests/Usings.cs": "global using App;\n" };
export const web = {
  "src/App.csproj": PROJ, "tests/Tests.csproj": PROJ,
  "src/Program.cs": "using App;\nvar app = Start.Build();\napp.Run();\n",
  "src/Start.cs": "namespace App;\npublic static class Start { public static object Build() => null; }\n",
  "src/Info.cs": "[assembly: System.Runtime.CompilerServices.InternalsVisibleTo(\"Tests\")]\n",
  "src/Init.cs": "namespace App;\nstatic class Init { [System.Runtime.CompilerServices.ModuleInitializer] internal static void Go() { } }\n",
  "tests/WebTest.cs": "namespace Tests;\nclass WebTest { object f = new Factory<Program>(); }\n",
  "tests/PlainTest.cs": "namespace Tests;\nclass PlainTest { }\n",
};
export const one = (src, extra = {}) => csharpReach({ "src/App.csproj": PROJ, "tests/T.cs": "namespace Tests;\nclass T { }\n", "src/X.cs": src, ...extra }, undefined, nothing);

if (started(import.meta.url)) {
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
  ok(same(pick(globals, "src/Rules.cs").tests, ["tests/RulesTest.cs"]), "a namespace a .csproj's <Using> names is seen by every file", JSON.stringify(pick(globals, "src/Rules.cs")));
  ok(same(pick(viaFile, "src/Rules.cs").tests, ["tests/RulesTest.cs"]), "and so is one a global using directive names, in any file", JSON.stringify(pick(viaFile, "src/Rules.cs")));
  const props = csharpReach({ ...globals, "tests/Tests.csproj": PROJ }, undefined, () => ({ msbuild: ["<Project><ItemGroup><Using Include=\"App\" /></ItemGroup></Project>"], cs: {} }));
  ok(props.links.get("tests/RulesTest.cs")?.has("src/Rules.cs"), "and one a .props or .targets file git holds beside the config's files names", JSON.stringify([...props.links]));

  // ---- top-level statements, and what runs with no name ----
  ok(same(pick(web, "src/Start.cs").tests, ["tests/WebTest.cs"]), "a file of top-level statements is reached by Program, and through it what it names", JSON.stringify(pick(web, "src/Start.cs")));
  for (const f of ["src/Info.cs", "src/Init.cs"]) ok(same(pick(web, f).tests, ["tests/PlainTest.cs", "tests/WebTest.cs"]), `${f === "src/Info.cs" ? "an assembly's attribute" : "a module initializer"}, which runs with no name, is reached from every test`, JSON.stringify(pick(web, f)));

  // ---- C# git holds that the config does not read ----
  const unread = csharpReach({ "src/App.csproj": PROJ, "src/A.cs": "namespace App;\nclass A { }\n", "tests/T.cs": "using App.Data;\nnamespace Tests;\nclass T { Seed s; }\n" }, undefined,
    () => ({ msbuild: [], cs: { "src/Data/Seed.cs": "namespace App.Data;\nclass Seed { A a; }\n" } }));
  ok(unread.links.get("tests/T.cs")?.has("src/Data/Seed.cs") && unread.links.get("src/Data/Seed.cs")?.has("src/A.cs") && !unread.unsure.size,
    "a file of C# git holds that the config does not read is read as a link between those it reads", JSON.stringify([...unread.links].map(([f, to]) => [f, [...to]])));
  const through = reached(new Set(["tests/T.cs"]), links({ "tests/T.cs": "", "src/A.cs": "" }, new Set(["tests/T.cs"]), new Map(), undefined, unread.links));
  ok(through.get("tests/T.cs").has("src/A.cs"), "and a test reaches, through it, what it links to", JSON.stringify([...through.get("tests/T.cs")]));
  ok(readCsharp(app["src/Rules.cs"]) === readCsharp(app["src/Rules.cs"]), "a text read once is not parsed again");

  // ---- each hook, and each head of a file before its statements ----
  const hooks = ["ModuleInitializer", "AssemblyInitialize", "AssemblyCleanup", "GlobalTestInitialize", "GlobalTestCleanup", "SetUpFixture", "BeforeEvery", "AfterEvery"]
    .map(w => [w, `namespace H;\nclass X { [${w}] void Go() { } }\n`])
    .concat(["IIncrementalGenerator", "ISourceGenerator"].map(w => [w, `namespace H;\nclass X : ${w} { }\n`]),
      ["Assembly", "TestSession", "TestDiscovery"].map(w => [`Before(${w})`, `namespace H;\nclass X { [Before(${w})] void Go() { } }\n`]),
      [["[module: …]", "[module: System.Security.UnverifiableCode]\nnamespace H;\nclass X { }\n"], ["After(Assembly)", "namespace H;\nclass X { [After(Assembly)] void Go() { } }\n"]]);
  const runs = hooks.filter(([, src]) => !one(src).links.get("tests/T.cs")?.has("src/X.cs") || one(src).unsure.size).map(([w]) => w);
  ok(!runs.length, "each hook's word, a generator's interface, TUnit's Before and After of the assembly, the session and discovery, and a module's attribute make a file reached from every file, and none unsure", runs.join(", "));
  ok(!one("namespace H;\nclass X { [Before(Test)] void Go() { } }\n").links.get("tests/T.cs")?.has("src/X.cs"), "a hook of each test is no hook of the assembly");
  const named = (src, test = "namespace Tests;\nclass T { object f = new Factory<Program>(); }\n") => one(src, { "tests/T.cs": test }).links.get("tests/T.cs")?.has("src/X.cs");
  const heads = [["extern alias", "extern alias Old;\nusing App;\nvar x = 1;\n"], ["a generic alias", "using L = System.Collections.Generic.List<System.Collections.Generic.List<int>>;\nvar x = new L();\n"],
    ["a global using", "global using App;\nvar x = 1;\n"], ["an attribute of the assembly", "using App;\n[assembly: A]\n[assembly: B]\nvar x = 1;\n"]];
  const notProgram = heads.filter(([, src]) => !named(src)).map(([w]) => w);
  ok(!notProgram.length, "a file of top-level statements is Program past its using directives, extern aliases, generic aliases and attributes", notProgram.join(", "));
  const declares = ["public", "internal", "private", "protected", "static", "sealed", "abstract", "partial", "readonly", "ref", "unsafe", "file", "new", "extern"].map(m => [m, `using App;\n${m} ${m === "ref" ? "struct" : "class"} X { }\n`])
    .concat(["struct", "interface", "enum", "record"].map(t => [t, `using App;\n${t} X { }\n`]), [["delegate", "using App;\npublic delegate void X();\n"], ["namespace", "using App;\nnamespace H { class X { } }\n"]]);
  const asProgram = declares.filter(([, src]) => named(src)).map(([w]) => w);
  ok(!asProgram.length, "a file that declares a type, behind any modifier, is no Program", asProgram.join(", "));

  // ---- what review found (#1159) ----
  const tuple = one("namespace App;\npublic delegate (int X, int Y) Pair();\n", { "tests/T.cs": "using App;\nnamespace Tests;\nclass T { Pair p; }\n" });
  ok(tuple.links.get("tests/T.cs")?.has("src/X.cs"), "a delegate that returns a tuple is reached by its name", JSON.stringify([...tuple.links].map(([f, to]) => [f, [...to]])));
  const lambda = one("namespace App;\nclass X { System.Action<int> a = delegate (int n) { }; }\n", { "tests/T.cs": "using App;\nnamespace Tests;\nclass T { n m; }\n" });
  ok(!lambda.links.get("tests/T.cs")?.has("src/X.cs"), "an anonymous delegate with parameters declares no name");
  const src = "namespace A { namespace B.C { class Q { delegate void Inner(); } } delegate void Outer(); }\nnamespace E { class P { } }\n";
  const placed = ["using A.B.C;\nnamespace Tests;\nclass T { Inner i; }\n", "using A;\nnamespace Tests;\nclass T { Outer o; }\n", "using E;\nnamespace Tests;\nclass T { Outer o; Inner i; }\n"]
    .map(t => !!one(src, { "tests/T.cs": t }).links.get("tests/T.cs")?.has("src/X.cs"));
  ok(same(placed, [true, true, false]), "a delegate is declared in the namespace it stands in, nested ones joined, and in no other of its file's", JSON.stringify(placed));
  const escaped = ["namespace App; class @namespace {} class C { @namespace field; } delegate void D();\n", "@namespace x = null;\nnamespace App { delegate void D(); }\nclass @namespace {}\n", "namespace App { class C { void M() { @namespace.@namespace.Go(); } } delegate void D(); }\nclass @namespace {}\n"]
    .map(s => !!one(s, { "tests/T.cs": "using App;\nclass T { D d; }\n" }).links.get("tests/T.cs")?.has("src/X.cs"));
  ok(same(escaped, [true, true, true]), "an escaped @namespace heads no namespace: not in a type, not as a statement, not after a dot", JSON.stringify(escaped));
  const propsRead = csharpReach({ ...globals, "tests/Tests.csproj": PROJ, "Directory.Build.props": "<Project><ItemGroup><Using Include=\"App\" /></ItemGroup></Project>" }, undefined, nothing);
  ok(propsRead.links.get("tests/RulesTest.cs")?.has("src/Rules.cs"), "a .props file the config reads is read for its <Using> too", JSON.stringify([...propsRead.links].map(([f, to]) => [f, [...to]])));
  const aliased = csharpReach({ ...app, "src/Usings.cs": "global using S = App.Data.Store;\n", "tests/AliasTest.cs": "namespace Tests;\nclass AliasTest { S s; }\n" }, undefined, nothing);
  const viaAlias = reached(new Set(["tests/AliasTest.cs"]), aliased.links).get("tests/AliasTest.cs");
  ok(viaAlias.has("src/Store.cs") && !viaAlias.has("src/Rules.cs"), "a global alias is followed, from a file that names it, to the type it names", JSON.stringify([...viaAlias]));
  const qualified = one("namespace App.Testing;\npublic class CustomFactAttribute : System.Attribute { }\n", { "tests/T.cs": "namespace Tests;\nclass T { [App.Testing.CustomFact] void Go() { } }\n" });
  ok(qualified.links.get("tests/T.cs")?.has("src/X.cs"), "an attribute named in full is reached without \"Attribute\" too", JSON.stringify([...qualified.links].map(([f, to]) => [f, [...to]])));
  const receivers = ["[NotNullWhen(true)] this string? s", "ref this int s", "this in int s", "scoped this ref int s", "this (int X, int Y) v"].filter(param =>
    !one(`namespace App.Ext;\npublic static class E { public static bool Has(${param}) => true; }\n`, { "tests/T.cs": "using App.Ext;\nnamespace Tests;\nclass T { }\n" }).links.get("tests/T.cs")?.has("src/X.cs"));
  ok(!receivers.length, "an extension's receiver is read behind an attribute, ref, in and scoped, and as a tuple", receivers.join(", "));
  ok(same(pick(viaFile, "tests/Usings.cs").tests, ["tests/RulesTest.cs", "tests/Usings.cs"]), "a file that holds a global using directive is reached from every file, since a change to it bears on each", JSON.stringify(pick(viaFile, "tests/Usings.cs")));
  const suffixed = ["System.Runtime.CompilerServices.ModuleInitializerAttribute", "AssemblyInitializeAttribute"].filter(w => {
    const r = one(`namespace H;\nclass X { [${w}] static void Go() { } }\n`);
    return !r.links.get("tests/T.cs")?.has("src/X.cs") || r.unsure.size;
  });
  ok(!suffixed.length, "a hook written with \"Attribute\" is a hook too, and no scan of an assembly", suffixed.join(", "));
  const forms = ["(int Count, App.Data.Store Item)", "App.Data.Store[]", "App.Data.Store?"].filter(form => !reached(new Set(["tests/AliasTest.cs"]), csharpReach({ ...app,
    "src/Usings.cs": `global using S = ${form};\n`, "tests/AliasTest.cs": "namespace Tests;\nclass AliasTest { S s; }\n" }, undefined, nothing).links).get("tests/AliasTest.cs").has("src/Store.cs"));
  ok(!forms.length, "a global alias of a tuple, an array or a nullable type is read for the types it names", forms.join(", "));
  const nsAlias = one("namespace App.Data;\npublic class Store { }\n", { "tests/T.cs": "using D = App;\nnamespace Tests;\nclass T { object s = new D.Data.Store(); }\n" });
  ok(nsAlias.links.get("tests/T.cs")?.has("src/X.cs"), "a namespace alias that heads a name in full is put for what it names", JSON.stringify([...nsAlias.links].map(([f, to]) => [f, [...to]])));
  const items = ["<Using Include=\"App.Data.Store\" Alias=\"S\" />", "<Using Include=\"App.Data.Store\" Static=\"true\" />"].filter(item => !csharpReach({
    "src/App.csproj": PROJ, "src/Store.cs": "namespace App.Data;\npublic class Store { public static void Go() { } }\n",
    "tests/Tests.csproj": `<Project><ItemGroup>${item}</ItemGroup></Project>`, "tests/T.cs": "namespace Tests;\nclass T { S s; void M() { Go(); } }\n",
  }, undefined, nothing).links.get("tests/T.cs")?.has("src/Store.cs"));
  ok(!items.length, "a <Using> with an Alias, or Static, reaches the type it names from every file", items.join(", "));
  const collected = { ...app, "src/Db.cs": "namespace App;\npublic class DbFixture { }\n", "tests/DbCollection.cs": "using App;\nusing Xunit;\nnamespace Tests;\n[CollectionDefinition(\"db\")]\npublic class DbCollection : ICollectionFixture<DbFixture> { }\n",
    "tests/DbTest.cs": "using Xunit;\nnamespace Tests;\n[Collection(\"db\")]\nclass DbTest { }\n" };
  ok(pick(collected, "src/Db.cs").tests.includes("tests/DbTest.cs"), "an xUnit collection's definition, which its tests find by a string, is reached from every file, and the fixture it names with it", JSON.stringify(pick(collected, "src/Db.cs")));
  const quoted = csharpReach({ "src/App.csproj": PROJ, "src/Store.cs": "namespace App.Data;\npublic class Store { }\n", "tests/Tests.csproj": "<Project><ItemGroup><Using Include='App.Data' /></ItemGroup></Project>",
    "tests/T.cs": "namespace Tests;\nclass T { Store s; }\n" }, undefined, nothing);
  ok(quoted.links.get("tests/T.cs")?.has("src/Store.cs"), "a <Using> whose attribute stands in single quotes is read", JSON.stringify([...quoted.links].map(([f, to]) => [f, [...to]])));
  done();
}
