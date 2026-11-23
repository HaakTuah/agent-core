// Tests where the test selection cannot tell what reaches a file of C# (scripts/select-csharp.mjs, through
// scripts/select.mjs; #675): a file lost by the grammar, one that reads types by reflection, scans an assembly or is a source generator, one
// with a raw interpolated string or an alignment that names something, one where an escape or a formatting character may
// split a name, which every file reaches, every file where a <Using> names a property or
// holds what the reader cannot read or an <Import> of another file, a global alias names a hook's attribute or git cannot be asked; a namespace an SDK
// imports by ImplicitUsings and a <Using>'s Alias given as an element, which reach every file; and the whole
// suite where a changed file is C# of no project or no longer declares what it declared at the base, a change to a
// helper among the tests, and the budget, of what git holds beside the texts too. The cases: select-csharp-test.mjs. Needs the parser (node scripts/install.mjs
// parser). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-csharp-unsure-test.mjs
import fs from "node:fs";
import path from "node:path";
import { Late } from "../scripts/hurry.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { csharpReach } from "../scripts/select-csharp.mjs";
import { heldBeside, ofNoProject } from "../scripts/select-csharp-project.mjs";
import { selection } from "../scripts/select.mjs";
import { readCsharp } from "../scripts/shape-csharp.mjs";
import { PROJ, app, config, done, nothing, ok, one, pick, same, web } from "./select-csharp-test.mjs";

// ---- a file whose reach cannot be told, and every file ----
const scans = { ...web, "src/Program.cs": "using App;\nvar app = Start.Build();\nbuilder.Services.AddControllers();\n", "src/Lone.cs": "namespace Lone;\nclass Lone { }\n" };
ok(same(pick(scans, "src/Lone.cs").tests, ["tests/WebTest.cs"]), "a test that reaches a file which scans an assembly for types runs on any change", JSON.stringify(pick(scans, "src/Lone.cs")));
const reflects = { ...web, "tests/MakeTest.cs": "namespace Tests;\nclass MakeTest { object o = System.Activator.CreateInstance(System.Type.GetType(\"App.Start\")); }\n" };
ok(pick(reflects, "src/Start.cs").tests.includes("tests/MakeTest.cs"), "and so does one that makes a type by reflection", JSON.stringify(pick(reflects, "src/Start.cs")));
const domain = { ...web, "tests/DomainTest.cs": "namespace Tests;\nclass DomainTest { object o = System.AppDomain.CurrentDomain.CreateInstanceAndUnwrap(\"App\", \"App.Start\"); }\n" };
ok(pick(domain, "src/Start.cs").tests.includes("tests/DomainTest.cs"), "and one that makes a type named in a string through an AppDomain", JSON.stringify(pick(domain, "src/Start.cs")));
const csTexts = { "src/App.csproj": PROJ, "src/A.cs": "namespace App;\nclass A { }\n", "tests/T.cs": "namespace Tests;\nclass T { }\n" };
for (const [held, what] of [...["$(Root).App", "@(ExtraUsings)", "%(Ns.Identity)", "App%2EData", "App&#46;Data"].map(i => [`<Using Include="${i}" />`, `a <Using> of ${i}, which MSBuild expands`]),
  ...["$(D)u.xml", "c.proj", "u.props.xml", "a.props;u.xml", "../U.Props", "c.props/u.xml", "u.xml;a.props"].map(p => [`<Import Project="${p}" />`, `a .props git holds imports ${p}, whose <Using> items it may not hold`]), [null, "git cannot be asked"]]) {
  const r = csharpReach(csTexts, undefined, () => held ? { msbuild: [held], cs: {} } : { unknown: true });
  ok(same([...r.unsure].sort(), ["src/A.cs", "tests/T.cs"]), `where ${what}, every file of C# is unsure`, JSON.stringify([...r.unsure]));
}
ok(ofNoProject("lib/A.cs", csTexts) && !ofNoProject("src/A.cs", csTexts) && !ofNoProject("A.cs", { "App.csproj": PROJ }), "C# is of no project where no .csproj stands in a folder above it");
const lone = { ...app, "shared/Common.cs": "namespace App;\npublic class Common { }\n" };
const loneRun = selection({ changed: ["shared/Common.cs"], texts: lone, tests: new Set(["tests/UsingTest.cs"]), reach: new Map(), config });
ok(loneRun.all && /of no project/u.test(loneRun.why), "a changed file of C# of no project runs the whole suite", JSON.stringify(loneRun));
const r = csharpReach({ ...csTexts, "src/Lost.cs": "namespace App;\nclass Lost { void T() { a?.b += 1; } }\n" }, undefined, nothing);
ok(same([...r.unsure], ["src/Lost.cs"]), "a file the grammar loses is unsure, and no other", JSON.stringify([...r.unsure]));

// ---- each word of the list ----
const reflectWords = ["Activator.CreateInstance(t)", "a.GetTypes()", "a.ExportedTypes", "a.DefinedTypes", "s.AddControllers()", "s.AddControllersWithViews()", "s.AddMvc()", "s.AddMvcCore()",
  "s.AddRazorPages()", "a.MapControllers()", "a.MapRazorPages()", "a.MapRazorComponents()", "m.AddApplicationPart(a)", "s.AddAutoMapper(a)", "s.AddMediatR(a)", "d.Database.Migrate()", "GetAssemblies()", "Type.GetType(n)", "typeof(X).Assembly",
  "default(IIncrementalGenerator)", "default(ISourceGenerator)"];
const missed = reflectWords.filter(w => !same([...one(`namespace R;\nclass X { void Go() { var r = ${w}; } }\n`).unsure], ["src/X.cs"]));
ok(!missed.length, "each word that finds types by reflection or scans an assembly makes its file unsure, and no other", missed.join(", "));
const gen = { ...app, "src/Gen.cs": "namespace Gen;\n[Generator] public class Catalog : IIncrementalGenerator { public void Initialize(object c) { } }\n", "src/Widget.cs": "namespace App;\npublic class Widget { }\n",
  "tests/CountTest.cs": "namespace Tests;\nclass CountTest { int n = Generated.Catalog.Count; }\n" };
ok(pick(gen, "src/Widget.cs").tests.includes("tests/CountTest.cs"), "a source generator, which reads types it never names, makes a test that reaches it run on any change", JSON.stringify(pick(gen, "src/Widget.cs")));
ok(!one("namespace R;\nclass X { void Go() { var t = x.GetType(); } }\n").unsure.size, "a GetType of an object, not of Type, makes no file unsure");

// ---- what review found (#1159) ----
const rawHole = one("namespace Tests;\nclass Y { string s = $$\"\"\"a {{App.Rules.Allowed()}}\"\"\"; }\n");
ok(same([...rawHole.unsure], ["src/X.cs"]), "a raw interpolated string, whose holes the tokens do not read, makes its file unsure", JSON.stringify([...rawHole.unsure]));
ok(!one("namespace Tests;\nclass Y { string s = \"\"\"a\"\"\" + $\"{1}\" + $\"{2,-10:F1}\" + $\"{F(1, 2)}\"; }\n").unsure.size, "a raw string that is not interpolated, an interpolated one that is not raw, an alignment that names nothing and a call's \",\" make none");
const aligned = ["$\"{1,App.Layout.Width}\"", "$@\"{1,(int)W}\""].filter(e => !one(`namespace Tests;\nclass Y { string s = ${e}; }\n`).unsure.has("src/X.cs"));
ok(!aligned.length, "an interpolation's alignment that holds a word, which the tokens do not read, makes its file unsure", aligned.join(", "));
const hidden = ["$\"{{{'}' + App.Layout.Width}}}\"", "\"Price: $\" + $\"{1,App.Layout.Width}\"", "/* $\" */ $\"{1,App.Layout.Width}\"", "// $\"\n$\"{1,App.Layout.Width}\"", "'\"' + $\"{1,App.Layout.Width}\"", "@\"a\"\"$\" + $\"{1,App.Layout.Width}\"", "\"\"\"a \" b\"\"\" + $\"{1,App.Layout.Width}\"", "$\"{1 /* } */ ,App.Layout.Width}\"", "$\"{\"\"\"a\"}\"\"\"}\" + $\"{1,App.Layout.Width}\"", "$@\"{\"\"\"a\"}\"\"\"}\" + $\"{1,App.Layout.Width}\"", "$\"{1,Ⅻ.Ⅹ}\"", "$\"{1,\\u0041pp.Width}\"", "App.R\\u0075les.Width + \"\"", "$\"{R\\u0075les.Width}\"",
  "1;\n#if NEVER\n/*\n#endif\nint w = App.Layout.Width;\n// */\nstring t = \"\"", ...["@\"", "\"\"\""].map(q => `1;\n#if false\nstring q = ${q}\n#endif\nstring t = $"{1,App.Layout.Width}";\n#if false\n${q};\n#endif\nstring u = ""`),
  ...["\r", "\u0085", "\u2028", "\u2029"].map(e => `1; // x${e}string t = $"{1,App.Layout.Width}";\nstring u = ""`), "1;\n#region r\rstring t = $\"{1,App.Layout.Width}\";\nstring u = \"\""].filter(e => !one(`namespace Tests;\nclass Y { string s = ${e}; }\n`).unsure.has("src/X.cs"));
ok(!hidden.length, "a \"$\\\"\" in a string, a character or a comment, a comment, raw string or brace's character in a hole, a name of letter-numbers or escapes, a name's escape outside an alignment, a comment or string one branch of an \"#if\" opens, and a line's end other than \"\\n\", hide no alignment", hidden.join(" | "));
// (a name an escape or a formatting character splits, where a file declares it or a test names it; a byte order mark splits none)
const split = [["src/Rules.cs", "namespace App;\npublic static class R\\u0075les { public static bool Allowed() => true; }\n", "tests/UsingTest.cs"],
  ["src/Rules.cs", "namespace App;\npublic static class Ru\u200Cles { public static bool Allowed() => true; }\n", "tests/UsingTest.cs"],
  ["tests/OtherTest.cs", "using App;\nnamespace Tests;\nclass OtherTest { void T() { Ru\u200Cles.Allowed(); } }\n", "tests/OtherTest.cs"],
  // (and where what the scan cannot keep in step with stands first: a raw interpolated string, a comment in a hole, an
  // alignment's word, an odd line end)
  ...["$\"\"\"{1}\"\"\"", "$\"{1 /* c */}\"", "$\"{1,K.W}\"", "\"\"; // \r"].flatMap(e => ["R\\u0075les", "Ru\u200Cles"].map(n => ["src/Rules.cs",
    `namespace App;\npublic static class ${n} { static string s = ${e};\n public static bool Allowed() => true; }\n`, "tests/UsingTest.cs"])),
  // (and a plain name a comment one branch of an "#if" opens hides from the tokens, there too after what the scan cannot
  // keep in step with)
  ...["", "// $\"\"\"\n", "static class K { static string s = $\"{1,K.W}\"; const int W = 1; }\n", "/*\n#region r\n*/\n"].flatMap(e => ["#endif", "\x1A#endif", "#\x1Aendif"].map(d => [e, d])).map(([e, d]) => ["src/Rules.cs", `namespace App;\n${e}#if NEVER\n/*\n${d}\npublic static class Rules { public static bool Allowed() => true; }\n// */\n`, "tests/UsingTest.cs"]),
  // (and a plain name after a "//" comment that a line's end other than "\n" ends, which the tree reads on)
  ...["\r", "\u0085", "\u2028", "\u2029"].map(e => ["src/Rules.cs", `namespace App;\n// note${e}public static class Rules { public static bool Allowed() => true; }\n`, "tests/UsingTest.cs"])].filter(([f, text, test]) => !pick({ ...app, [f]: text }, "src/Rules.cs").tests.includes(test));
ok(!split.length, "a file where an escape or a formatting character may split a name it declares or names, or an \"#if\" or an odd line end may hide one, is reached from every file", split.map(c => c[0]).join(", "));
ok(!pick({ ...app, "tests/OtherTest.cs": `\uFEFF${app["tests/OtherTest.cs"]}` }, "src/Rules.cs").tests.includes("tests/OtherTest.cs"), "a byte order mark at a file's start splits no name");
const implicit = one("namespace System;\npublic static class Ext { public static bool Allowed(this string s) => true; }\n", { "tests/T.cs": "namespace Tests;\nclass T { bool b = \"x\".Allowed(); }\n" });
ok(implicit.links.get("tests/T.cs")?.has("src/X.cs"), "a namespace an SDK imports by ImplicitUsings, which no <Using> git holds names, is seen by every file", JSON.stringify([...implicit.links.get("tests/T.cs") ?? []]));
const unreadMeta = csharpReach({ ...csTexts, "tests/Tests.csproj": "<Project><ItemGroup><Using Include=\"App\"><!-- <Alias>D</Alias> --></Using></ItemGroup></Project>" }, undefined, nothing);
ok(same([...unreadMeta.unsure].sort(), ["src/A.cs", "tests/T.cs"]), "a <Using> whose elements the reader cannot read makes every file unsure", JSON.stringify([...unreadMeta.unsure]));
const hookAlias = csharpReach({ ...csTexts, "src/Usings.cs": "global using MI = System.Runtime.CompilerServices.ModuleInitializerAttribute;\n", "src/Init.cs": "namespace App;\nstatic class Init { [MI] internal static void Go() { } }\n" }, undefined, nothing);
ok(hookAlias.unsure.has("src/Init.cs") && hookAlias.unsure.has("tests/T.cs"), "a global alias of a hook's attribute, which the file that applies it never names, makes every file unsure", JSON.stringify([...hookAlias.unsure]));
const store = item => csharpReach({ "src/App.csproj": PROJ, "src/Store.cs": "namespace App.Data;\npublic class Store { }\n", "tests/Tests.csproj": `<Project><ItemGroup>${item}</ItemGroup></Project>`,
  "tests/T.cs": "namespace Tests;\nclass T { D.Data.Store s; }\n" }, undefined, nothing);
const tags = ["<Using Note=\"Alias='Q'\" Include=\"App\" Alias=\"D\" />", "<using Include=\"App\" Alias=\"D\" />", "<USING Include=\"App\" Alias=\"D\"></USING>", "<Using Include=\"App\" Alias=\"Q\"><Alias>D</Alias></Using>", "<Using Include=\"App\" Alias=\"@D\" />",
  "<Using Include=\"App\">\n  <alias>D</alias>\n  <Visible>false</Visible>\n</Using>", "<Using Include=\"App\" Alias=\"D\" /></ItemGroup><Import Project=\"$([MSBuild]::GetPathOfFileAbove('Directory.Build.props', '..'))\" /><ItemGroup>"]
  .filter(item => !store(item).links.get("tests/T.cs")?.has("src/Store.cs"));
ok(!tags.length, "a <Using> is read in any case, each attribute from its own pair, both aliases where an attribute and an element each give one, an alias's \"@\" dropped, and beside an <Import> of a .props", tags.join(" | "));
const untold = ["<Using Include=\"App\" /><Using Update=\"App\" Alias=\"D\" />", "<Using Include=\"App\" Alias=\"D\" Note=\"a\"b\" />", "<Using Include=\"App.Data.Store[]\" Alias=\"D\" />", "<Using Include=\"App.Data.Store?\" Alias=\"D\" />", "<Using Include=\"App\" Alias=\"D-x\" />",
  "<Using Include=\"App\" Alias=\"D\" /></ItemGroup><Import Project=\"u.xml\" /><ItemGroup>", "</ItemGroup><ItemDefinitionGroup><Using Alias=\"D\" /></ItemDefinitionGroup><ItemGroup><Using Include=\"App\" />"].filter(item => store(item).unsure.size !== 2);
ok(!untold.length, "a <Using> that updates another or defines an item's metadata, whose tag is no run of attributes, or whose target or alias is no plain name, or a .csproj that imports an .xml, makes every file unsure", untold.join(" | "));
const tunit = one("global using B = TUnit.Core.BeforeAttribute;\nnamespace App;\nstatic class Init { [B(Assembly)] public static void Go() { } }\n");
const session = one("namespace App;\nstatic class Init { [Before(HookType.TestSession)] public static void Go() { } }\n");
ok(tunit.unsure.has("tests/T.cs") && session.links.get("tests/T.cs")?.has("src/X.cs"), "TUnit's Before or After beside a word Assembly, TestSession or TestDiscovery is a hook, and a global alias of it makes every file unsure",
  JSON.stringify([[...tunit.unsure], [...session.links.get("tests/T.cs") ?? []]]));
const used = { "tests/T.cs": "namespace Tests;\nclass T { bool b = \"x\".Allowed(); }\n" }, ext = ns => one(`namespace ${ns};\npublic static class Ext { public static bool Allowed(this string s) => true; }\n`, used).links.get("tests/T.cs")?.has("src/X.cs");
ok(ext("Aspire.Hosting") && !ext("App.Inner"), "a namespace declared outside every project's root, which a package's own .props may import, is seen by every file; one under a root is not");
const ext2 = "namespace App.Inner;\npublic static class Ext { public static bool Allowed(this string s) => true; }\n", group = x => `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>${x}</PropertyGroup></Project>`;
const rooted = (x, beside = [], more = {}) => csharpReach({ "src/App.csproj": group(x), "src/X.cs": ext2, ...used, ...more }, undefined, () => ({ msbuild: beside, cs: {} })).links.get("tests/T.cs")?.has("src/X.cs");
const unread = ["Lib&#46;Core", "Lib%2ECore", "$(Company).App", "<![CDATA[App]]>", "App<!-- c -->", " Lib "].map(v => `<RootNamespace>${v}</RootNamespace>`)
  .concat("<RootNamespace Condition=\"'$(A)' == ''\">App</RootNamespace>", "<RootNamespace>App</RootNamespace><RootNamespace>Lib</RootNamespace>", "<!-- <RootNamespace>Lib</RootNamespace> -->",
    "</PropertyGroup><PropertyGroup Condition=\"false\"><RootNamespace>Lib</RootNamespace>", "</PropertyGroup><ProjectExtensions><RootNamespace>Lib</RootNamespace></ProjectExtensions><PropertyGroup>",
    "</PropertyGroup><Import Project=\"root.props\" /><PropertyGroup>").filter(x => !rooted(x));
ok(!unread.length && rooted("", [group("<RootNamespace>Lib</RootNamespace>")]) && rooted("", [], { "Directory.Build.props": group("<RootNamespace>Lib</RootNamespace>") }) && !rooted(""),
  "a project that names a <RootNamespace> anywhere or imports a file, or beside a .props or .targets git holds that names one, adds no root, so its namespaces are seen by every file; its name is a root", unread.join(" | "));
const bridged = { ...app, "src/Bridge.cs": "namespace App;\nref class Bridge { public static bool Check() => Rules.Allowed(); }\n", "tests/BridgeTest.cs": "using App;\nnamespace Tests;\nclass BridgeTest { void T() { Bridge.Check(); } }\n" };
ok(readCsharp(bridged["src/Bridge.cs"]).functions === null && pick(bridged, "src/Rules.cs").tests.includes("tests/BridgeTest.cs"),
  "a file the grammar loses, whose declarations are not known, is reached from every file and unsure, so a test that names it runs", JSON.stringify(pick(bridged, "src/Rules.cs")));
ok(same([...one("using T = System.Type;\nnamespace R;\nclass X { void Go() { T.GetType(\"App.Rules, App\")!.GetMethod(\"Allowed\")!.Invoke(null, null); } }\n").unsure], ["src/X.cs"]),
  "a GetType given a name, through an alias of Type too, makes its file unsure");
ok(one("namespace R;\nclass X { System.Func<string, System.Type?> f = System.Type.GetType; }\n").unsure.has("src/X.cs"), "and a GetType taken as a method group");
const helped = { ...app, "tests/Helper.cs": "namespace Tests;\npublic static class Helper { public static bool Allowed() => true; }\n",
  "tests/ReflectTest.cs": "namespace Tests;\nclass ReflectTest { void T() { System.Type.GetType(\"Tests.Helper\")!.GetMethod(\"Allowed\")!.Invoke(null, null); } }\n" };
ok(same(pick(helped, "tests/Helper.cs").tests, ["tests/Helper.cs", "tests/ReflectTest.cs"]), "a change to a helper of C# among the tests runs a test whose reach cannot be told", JSON.stringify(pick(helped, "tests/Helper.cs")));
const was = "namespace App;\npublic static class Rules { public static bool Allowed() => true; }\n";
const moved = { ...app, "src/Rules.cs": "namespace Retired;\npublic static class Rules { public static bool Allowed() => true; }\n" };
const kept = { ...app, "src/Rules.cs": "namespace App;\npublic static class Rules { public static bool Allowed() => false; }\n" };
const unextended = { ...app, "src/Ext.cs": "namespace App.Ext;\npublic static class Twice { public static int Double(int x) => x * 2; }\n" };
ok(pick(moved, "src/Rules.cs", was).all && pick(moved, "src/Rules.cs", "namespace App;\nref class Rules { }\n").all && pick(unextended, "src/Ext.cs", app["src/Ext.cs"]).all
  && pick(app, "src/Unused.cs", `global using App;\n${app["src/Unused.cs"]}`).all,
  "a file of C# that no longer declares a type it declared at the base, its extension members or a global using directive, or whose base cannot be read, runs the whole suite", JSON.stringify(pick(moved, "src/Rules.cs", was)));
ok(!pick(kept, "src/Rules.cs", was).all && !pick(app, "src/Unused.cs", null).all, "one that keeps what it declared, and one that is new, select by their reach", JSON.stringify(pick(kept, "src/Rules.cs", was)));
const deep = Array.from({ length: 400 }, (_, k) => `N${k}`).join(".");
let asked = 0, stopped = false;
try { csharpReach({ "src/App.csproj": PROJ, "src/X.cs": `using System;\nnamespace ${deep};\nclass Y { }\n` }, () => { if (++asked > 50) throw new Error("late"); }, nothing); } catch { stopped = true; }
ok(stopped, "the budget is asked inside the expansion of a deep namespace, so a file of one cannot outlast it", `asked ${asked}`);

// (what git holds beside the texts, the files it lists written in a scratch folder: within CHARACTERS bytes, read; past
// it, Late before a file is read whole)
{
  const here = process.cwd(), dir = scratchDir("held-"), files = [];
  const add = (f, text) => { fs.writeFileSync(path.join(dir, f), text); files.push(f); };
  try {
    add("A.cs", "class A { }\n"); add("Directory.Build.props", "<Project />\n"); add("B.cs", "class B { }\n");
    process.chdir(dir);
    const held = heldBeside({ "B.cs": "" }, () => files);
    ok(same(Object.keys(held.cs), ["A.cs"]) && held.msbuild.length === 1, "what git holds of C# and MSBuild beside the texts is read", JSON.stringify(held));
    add("Big.cs", `// ${"x".repeat(4_000_000)}\n`);
    let thrown;
    try { heldBeside({}, () => files); } catch (e) { thrown = e; }
    ok(thrown instanceof Late && /past the 4,000,000/u.test(thrown.message), "past 4,000,000 bytes of it, the selection is late and runs the whole suite", String(thrown));
  } finally { process.chdir(here); }
}

done();
