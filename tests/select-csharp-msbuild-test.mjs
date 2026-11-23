// Tests where MSBuild's files decide what a file of C# reaches, for the test selection (scripts/select-csharp-project.mjs,
// through scripts/select-csharp.mjs; #675): a <Using> read in any form, each of its aliases and Static; every file unsure
// where a <Using> names a property, holds what the reader cannot read, or an <Import> or a Custom…Microsoft… property may
// bring in a file it never sees, or git cannot be asked; C# of no project; the namespaces outside every project's root;
// and what git holds beside the texts, a link among them unknown, past the budget Late. The cases: select-csharp-test.mjs.
// Needs the parser (node scripts/install.mjs parser). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/select-csharp-msbuild-test.mjs
import fs from "node:fs";
import path from "node:path";
import { Late } from "../scripts/hurry.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { csharpReach } from "../scripts/select-csharp.mjs";
import { heldBeside, ofNoProject } from "../scripts/select-csharp-project.mjs";
import { PROJ, done, nothing, ok, one, same } from "./select-csharp-test.mjs";

// ---- a <Using>, and every file where one cannot be read ----
const csTexts = { "src/App.csproj": PROJ, "src/A.cs": "namespace App;\nclass A { }\n", "tests/T.cs": "namespace Tests;\nclass T { }\n" };
for (const [held, what] of [...["$(Root).App", "@(ExtraUsings)", "%(Ns.Identity)", "App%2EData", "App&#46;Data"].map(i => [`<Using Include="${i}" />`, `a <Using> of ${i}, which MSBuild expands`]),
  ...["$(D)u.xml", "c.proj", "u.props.xml", "a.props;u.xml", "../U.Props", "c.props/u.xml", "u.xml;a.props", "$(X).props", ...["GetPathOfFileAbove('u.xml', 'a.props')", "IO.Path]::ChangeExtension('a.props', '.xml')", "IO.Path]::Combine('a.props', '..', 'u.xml')",
    "String]::Copy('a.props').Replace('.props', '.xml')", "String]::Concat('a.props', '.xml')"].map(f => `$([${f.startsWith("Get") ? "MSBuild]::" : "System."}${f})`)].map(p => [`<Import Project="${p}" />`, `a .props git holds imports ${p}, whose <Using> items it may not hold`]),
  ["<PropertyGroup><CustomAfterMicrosoftCommonTargets>u.xml</CustomAfterMicrosoftCommonTargets></PropertyGroup>", "a .props names a file the SDK imports by a Custom…Microsoft… property"], [null, "git cannot be asked"]]) {
  const r = csharpReach(csTexts, undefined, () => held ? { msbuild: [held], cs: {} } : { unknown: true });
  ok(same([...r.unsure].sort(), ["src/A.cs", "tests/T.cs"]), `where ${what}, every file of C# is unsure`, JSON.stringify([...r.unsure]));
}
ok(ofNoProject("lib/A.cs", csTexts) && !ofNoProject("src/A.cs", csTexts) && !ofNoProject("A.cs", { "App.csproj": PROJ }), "C# is of no project where no .csproj stands in a folder above it");

const unreadMeta = csharpReach({ ...csTexts, "tests/Tests.csproj": "<Project><ItemGroup><Using Include=\"App\"><!-- <Alias>D</Alias> --></Using></ItemGroup></Project>" }, undefined, nothing);
ok(same([...unreadMeta.unsure].sort(), ["src/A.cs", "tests/T.cs"]), "a <Using> whose elements the reader cannot read makes every file unsure", JSON.stringify([...unreadMeta.unsure]));

const items = ["<Using Include=\"App.Data.Store\" Alias=\"S\" />", "<Using Include=\"App.Data.Store\" Alias=\"SAttribute\" />", "<Using Include=\"App.Data.Store\" Static=\"true\" />"].filter(item => !csharpReach({
  "src/App.csproj": PROJ, "src/Store.cs": "namespace App.Data;\npublic class Store { public static void Go() { } }\n",
  "tests/Tests.csproj": `<Project><ItemGroup>${item}</ItemGroup></Project>`, "tests/T.cs": "namespace Tests;\nclass T { [S] S s; void M() { Go(); } }\n",
}, undefined, nothing).links.get("tests/T.cs")?.has("src/Store.cs"));
ok(!items.length, "a <Using> with an Alias (an attribute's too), or Static, reaches the type it names from every file", items.join(", "));
const store = item => csharpReach({ "src/App.csproj": PROJ, "src/Store.cs": "namespace App.Data;\npublic class Store { }\n", "tests/Tests.csproj": `<Project><ItemGroup>${item}</ItemGroup></Project>`,
  "tests/T.cs": "namespace Tests;\nclass T { D.Data.Store s; }\n" }, undefined, nothing);
const tags = ["<Using Note=\"Alias='Q'\" Include=\"App\" Alias=\"D\" />", "<using Include=\"App\" Alias=\"D\" />", "<USING Include=\"App\" Alias=\"D\"></USING>", "<Using Include=\"App\" Alias=\"Q\"><Alias>D</Alias></Using>", "<Using Include=\"App\" Alias=\"@D\" />",
  "<Using Include=\"App\">\n  <alias>D</alias>\n  <Visible>false</Visible>\n</Using>", "<Using Include=\"App\" Alias=\"D\" /></ItemGroup><Import Project=\"$([MSBuild]::GetPathOfFileAbove('Directory.Build.props', '..'))\" /><ItemGroup>",
  "<Using Include=\"App\" Alias=\"D\" /></ItemGroup><Import Project=\"$(MSBuildThisFileDirectory)a.props; $([MSBuild]::GetDirectoryNameOfFileAbove($(MSBuildThisFileDirectory).., a.props))/a.props\" /><ItemGroup>"]
  .filter(item => !store(item).links.get("tests/T.cs")?.has("src/Store.cs"));
ok(!tags.length, "a <Using> is read in any case, each attribute from its own pair, both aliases where an attribute and an element each give one, an alias's \"@\" dropped, and beside an <Import> of a .props", tags.join(" | "));
const untold = ["<Using Include=\"App\" /><Using Update=\"App\" Alias=\"D\" />", "<Using Include=\"App\" Alias=\"D\" Note=\"a\"b\" />", "<Using Include=\"App.Data.Store[]\" Alias=\"D\" />", "<Using Include=\"App.Data.Store?\" Alias=\"D\" />", "<Using Include=\"App\" Alias=\"D-x\" />",
  "<Using Include=\"App\" Alias=\"D\" /></ItemGroup><Import Project=\"u.xml\" /><ItemGroup>", "</ItemGroup><ItemDefinitionGroup><Using Alias=\"D\" /></ItemDefinitionGroup><ItemGroup><Using Include=\"App\" />"].filter(item => store(item).unsure.size !== 2);
ok(!untold.length, "a <Using> that updates another or defines an item's metadata, whose tag is no run of attributes, or whose target or alias is no plain name, or a .csproj that imports an .xml, makes every file unsure", untold.join(" | "));


// ---- the namespaces outside every project's root, seen by every file ----
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
    fs.symlinkSync("Directory.Build.props", path.join(dir, "Link.props"));
    ok(heldBeside({}, () => [...files, "Link.props"]).unknown, "a link git holds there, which is not followed, leaves what git holds unknown, so every file is unsure");
    add("Big.cs", `// ${"x".repeat(4_000_000)}\n`);
    let thrown;
    try { heldBeside({}, () => files); } catch (e) { thrown = e; }
    ok(thrown instanceof Late && /past the 4,000,000/u.test(thrown.message), "past 4,000,000 bytes of it, the selection is late and runs the whole suite", String(thrown));
  } finally { process.chdir(here); }
}


done();
