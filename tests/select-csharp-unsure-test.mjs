// Tests where the test selection cannot tell what reaches a file of C# (scripts/select-csharp.mjs, through
// scripts/select.mjs; #675): a file lost by the grammar, one that reads types by reflection or scans an assembly, one
// with a raw interpolated string or an alignment that names something, every file where a <Using> names a property or git cannot be asked; and the whole
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
const csTexts = { "src/App.csproj": PROJ, "src/A.cs": "namespace App;\nclass A { }\n", "tests/T.cs": "namespace Tests;\nclass T { }\n" };
for (const [beside, what] of [[() => ({ msbuild: ["<Using Include=\"$(Root).App\" />"], cs: {} }), "a <Using> names an MSBuild property"], ...["@(ExtraUsings)", "%(Ns.Identity)", "App%2EData", "App&#46;Data"].map(i => [() => ({ msbuild: [`<Using Include="${i}" />`], cs: {} }), `a <Using> of ${i}, which MSBuild expands`]), [() => ({ unknown: true }), "git cannot be asked"]]) {
  const r = csharpReach(csTexts, undefined, beside);
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
  "s.AddRazorPages()", "a.MapControllers()", "a.MapRazorPages()", "a.MapRazorComponents()", "m.AddApplicationPart(a)", "s.AddAutoMapper(a)", "s.AddMediatR(a)", "GetAssemblies()", "Type.GetType(n)", "typeof(X).Assembly"];
const missed = reflectWords.filter(w => !same([...one(`namespace R;\nclass X { void Go() { var r = ${w}; } }\n`).unsure], ["src/X.cs"]));
ok(!missed.length, "each word that finds types by reflection or scans an assembly makes its file unsure, and no other", missed.join(", "));
ok(!one("namespace R;\nclass X { void Go() { var t = x.GetType(); } }\n").unsure.size, "a GetType of an object, not of Type, makes no file unsure");

// ---- what review found (#1159) ----
const rawHole = one("namespace Tests;\nclass Y { string s = $$\"\"\"a {{App.Rules.Allowed()}}\"\"\"; }\n");
ok(same([...rawHole.unsure], ["src/X.cs"]), "a raw interpolated string, whose holes the tokens do not read, makes its file unsure", JSON.stringify([...rawHole.unsure]));
ok(!one("namespace Tests;\nclass Y { string s = \"\"\"a\"\"\" + $\"{1}\" + $\"{2,-10:F1}\" + $\"{F(1, 2)}\"; }\n").unsure.size, "a raw string that is not interpolated, an interpolated one that is not raw, an alignment that names nothing and a call's \",\" make none");
const aligned = ["$\"{1,App.Layout.Width}\"", "$@\"{1,(int)W}\""].filter(e => !one(`namespace Tests;\nclass Y { string s = ${e}; }\n`).unsure.has("src/X.cs"));
ok(!aligned.length, "an interpolation's alignment that holds a word, which the tokens do not read, makes its file unsure", aligned.join(", "));
const bridged = { ...app, "src/Bridge.cs": "namespace App;\nref class Bridge { public static bool Check() => Rules.Allowed(); }\n", "tests/BridgeTest.cs": "using App;\nnamespace Tests;\nclass BridgeTest { void T() { Bridge.Check(); } }\n" };
ok(readCsharp(bridged["src/Bridge.cs"]).functions === null && pick(bridged, "src/Rules.cs").tests.includes("tests/BridgeTest.cs"),
  "a file the grammar loses, whose declarations are not known, is reached from every file and unsure, so a test that names it runs", JSON.stringify(pick(bridged, "src/Rules.cs")));
ok(same([...one("using T = System.Type;\nnamespace R;\nclass X { void Go() { T.GetType(\"App.Rules, App\")!.GetMethod(\"Allowed\")!.Invoke(null, null); } }\n").unsure], ["src/X.cs"]),
  "a GetType given a name, through an alias of Type too, makes its file unsure");
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
