// Tests the shape check's readers of C# and Python (shape-csharp.mjs and shape-python.mjs, beside this file) on files
// made for them: the functions each finds, with their lines, depth and branch points; what a brace or a keyword in a
// string or a comment is; what each file imports and where it leads; and the packages a project declares. The check's
// own use of them, and of the readers of JSX and of the shared space: shape-test.mjs. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node scripts/shape-readers-test.mjs
import { csTokens, csharpIndex, csharpPackages, readCsharp, resolveCsharp } from "./shape-csharp.mjs";
import { STDLIB, logicalLines, pythonPackages, readPython, resolvePython } from "./shape-python.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const shown = fns => fns.map(f => `${f.name}:${f.line}:${f.lines}:${f.depth}:${f.branches}`);

// ---- C# ----
const board = `using System;
global using static Game.Rules.Dice;
using Json = Newtonsoft.Json;
using L = System.Collections.Generic.List<int>;
#if DEBUG
using Game.Debug;
#endif
namespace Game.View
{
    public record Point(int X, int Y) { public int Sum => X + Y; }
    public class Board<T> : IBoard where T : class, new()
    {
        private int? count;
        public Board(int n) : base(n) { count = n > 0 ? n : null; }
        public int Count { get { return count ?? 0; } set { count = value; } }
        public static Board<T> operator +(Board<T> a, Board<T> b) { return a; }
        public string Draw<U>(U x) where U : struct
        {
            var s = $"{x,5:N2} {(count > 1 ? "a" : "b")} {{ if (";
            var v = @"c:\\path""{ if (x) {";
            var r = """raw { if (a) """;
            foreach (var i in Items) {
                if (i is null && x != null || flag) { continue; }
                try { Go(); } catch (Exception e) when (e.Data != null) { } finally { }
            }
            Func<int, int> f = y => { return y * 2; };
            var k = count switch { 1 => "one", 2 => "two", _ => "many" };
            var o = new Foo.Bar(1) { A = 2 };
            return s?.Trim() ?? r; // if (a) { b; }
        }
        int Local() { int Inner(int q) { return q; } return Inner(1); }
        /* void Hidden() { } */
    }
}
`;
const cs = readCsharp(board);
ok(same(shown(cs.functions), ["Board:14:1:0:1", "get:15:1:0:1", "set:15:1:0:0", "operator:16:1:0:0", "Draw:18:13:2:10", "f:26:1:0:0", "Local:31:1:0:0", "Inner:31:1:0:0"]),
  "C#: methods, a constructor that calls its base, accessors, an operator, a lambda and local functions are found; a record, an object's initializer and a member written with => are not", shown(cs.functions));
ok(same(shown(readCsharp("class A {\n  void B() {\n    if (a) { while (b) { lock (c) { using (d) { x(); } } } }\n  }\n}\n").functions), ["B:2:3:4:2"]), "C#: depth counts each control block, lock and using among them");
ok(same(shown(readCsharp("class A {\n  void B() {\n    int? a = b ?c : d;\n    var e = f?[0] ?? g;\n    List<int?>? h = i ? j : k;\n  }\n}\n").functions), ["B:2:5:0:3"]),
  "C#: a ? that marks a type that may be null, or chains, is no choice; one with space before it, and ??, are");
ok(csTokens("var a = $\"{b}\" + $@\"{c}\";\n").filter(t => t.t === "id").map(t => t.v).join() === "var,a,b,c", "C#: an interpolated string's code is read as code");
ok(same(cs.usings.map(u => `${u.target}${u.static ? " static" : ""}${u.alias ? " alias" : ""}`), ["System", "Game.Rules.Dice static", "Newtonsoft.Json alias", "System.Collections.Generic.List alias", "Game.Debug"]) && same(cs.namespaces, ["Game.View"]) && same(cs.types, ["Game.View.Point", "Game.View.Board"]),
  "C#: its using directives, global, static and aliased, its namespace and its types are read", JSON.stringify([cs.usings, cs.namespaces, cs.types]));
ok(readCsharp("class A { void B() { using (var x = y) { } using var z = w; using Q q = new(); } }\n").usings.length === 0, "C#: a using statement is no directive");
const nested = readCsharp("namespace A {\n  namespace B { class C { } }\n  class D { }\n}\nnamespace E;\nrecord struct F(int x);\n");
ok(same(nested.namespaces, ["A", "A.B", "E"]) && same(nested.types, ["A.B.C", "A.D", "E.F"]), "C#: nested namespaces are joined, a file-scoped one holds the rest of the file", JSON.stringify(nested));
const idx = csharpIndex([["src/Rules/Dice.cs", readCsharp("namespace Game.Rules;\npublic static class Dice { }\n")], ["src/Rules/Deck.cs", readCsharp("namespace Game.Rules { class Deck { } }\n")]]);
ok(same(resolveCsharp({ target: "Game.Rules" }, idx).to, ["src/Rules/Dice.cs", "src/Rules/Deck.cs"]) && same(resolveCsharp({ target: "Game.Rules.Dice", static: true }, idx).to, ["src/Rules/Dice.cs"])
  && same(resolveCsharp({ target: "Game" }, idx).to, []) && resolveCsharp({ target: "Newtonsoft.Json" }, idx).outside === "Newtonsoft.Json",
  "C#: a namespace leads to every file that declares it, a static using to its type's file; the project's own root leads nowhere; another's is outside");
const packages = csharpPackages({ "src/App.csproj": `<Project><ItemGroup>
  <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  <PackageReference Include="StyleCop.Analyzers" Version="1.1.118" PrivateAssets="all" />
  <PackageReference Include="Coverlet" Version="6.0.0"><PrivateAssets>all</PrivateAssets></PackageReference>
</ItemGroup></Project>`, "README.md": "<PackageReference Include=\"Not.Read\" />" });
ok(same([...packages.ships], ["Newtonsoft.Json"]) && same([...packages.declared], ["Newtonsoft.Json", "StyleCop.Analyzers", "Coverlet"]), "C#: the packages a .csproj references are read; one marked PrivateAssets all is not shipped", JSON.stringify([...packages.declared]));

// ---- Python ----
const handler = `import os, a.b as c
from . import x, y
from ..pkg.mod import (z,
   w)
if TYPE_CHECKING:
    from typing_t import T
@dec
async def handler(req, n=lambda: 1):
    """A docstring, with { and if and or"""
    if req and n:
        for i in range(3):
            try:
                v = f"{i!r:>{w}} {d["k"]} {a if b else c}" + 'if or' # and if
            except (KeyError, ValueError):
                pass
    elif req or n: return 1
    else:
        def inner(q): return q and 1
        while True: break
    import lazy
    return [i for i in r if i]

class K:
    def m(self):
        match self.x:
            case 1:
                return 2
            case _:
                return 3
match = 3
`;
const py = readPython(handler);
ok(same(shown(py.functions), ["handler:8:14:3:10", "inner:18:1:0:1", "m:24:6:1:2"]),
  "Python: each def is found, its lines to its body's last, its depth by its control blocks (a match is a case's one level), its branch points; none in a string, an f-string's text or a comment", shown(py.functions));
ok(same(py.imports.map(i => `${".".repeat(i.level)}${i.module} [${i.names}]${i.dynamic ? " dynamic" : ""}${i.types ? " types" : ""}`), ["os []", "a.b []", ". [x,y]", "..pkg.mod [z,w]", "typing_t [T] types", "lazy [] dynamic"]),
  "Python: its imports are read, relative ones with their level; one in a def runs when it is called, one under TYPE_CHECKING takes types alone", JSON.stringify(py.imports));
ok(same(logicalLines("a = (1,\n  2)\nb = 3 \\\n  + 4\n\n# c\n    \n").map(l => `${l.line}-${l.end}`), ["1-2", "3-4"]), "Python: lines in brackets and after a \\ are one logical line; blank and comment lines are none");
ok(same(shown(readPython("def f():\n\tif a:\n\t\treturn '''x\nif y:\n  z'''\n\treturn 1\n").functions), ["f:1:6:1:1"]), "Python: a tab indents to the next multiple of 8, and a string's lines open no block");
const files = new Set(["pkg/__init__.py", "pkg/a/m.py", "pkg/a/x.py", "pkg/mod.py", "src/lib/util.py", "tools/helpers.py", "app/json.py", "two/dup.py", "three/dup.py"]);
const std = n => STDLIB.has(n);
const lead = (from, imp) => JSON.stringify(resolvePython(from, { names: [], ...imp }, files, std));
ok(lead("pkg/a/m.py", { level: 1, module: "", names: ["x", "y"] }) === '{"to":["pkg/a/x.py"]}' && lead("pkg/a/m.py", { level: 2, module: "mod", names: ["z"] }) === '{"to":["pkg/mod.py"]}'
  && lead("pkg/a/m.py", { level: 2, module: "", names: ["mod"] }) === '{"to":["pkg/mod.py"]}', "Python: a relative import leads to the module it names, or to each name that is a module of its own");
ok(lead("main.py", { level: 0, module: "lib.util" }) === '{"to":["src/lib/util.py"]}' && lead("tools/run.py", { level: 0, module: "helpers" }) === '{"to":["tools/helpers.py"]}'
  && lead("pkg/a/m.py", { level: 0, module: "pkg.a", names: ["x"] }) === '{"to":["pkg/a/x.py"]}', "Python: an absolute import leads to the project's own module under its root, src/ or the file's own folder");
ok(lead("main.py", { level: 0, module: "json" }) === '{"outside":"json","top":"json"}' && lead("main.py", { level: 0, module: "dup" }) === '{"outside":"dup","top":"dup"}' && lead("main.py", { level: 0, module: "numpy.linalg" }) === '{"outside":"numpy.linalg","top":"numpy"}',
  "Python: the standard library is never taken for a file of the project's that ends in its name, and a name two files end in leads nowhere the reader can tell");
const pyPackages = pythonPackages({
  "pyproject.toml": "[project]\nname = \"game\"\ndependencies = [\n  \"requests>=2\",\n  \"PyYAML\",  # a comment\n]\n[project.optional-dependencies]\ntest = [\"pytest\"]\n[tool.poetry.dependencies]\npython = \"^3.11\"\nflask = \"*\"\n[tool.poetry.group.dev.dependencies]\nblack = \"*\"\n",
  "requirements-dev.txt": "ruff==1\n-r requirements.txt\n", "requirements.txt": "numpy # x\n-e .\nscikit_learn>=1\n",
});
ok(same([...pyPackages.ships.values()], ["requests", "PyYAML", "flask", "numpy", "scikit_learn"]) && same([...pyPackages.declared.keys()].sort(), ["black", "flask", "numpy", "pytest", "pyyaml", "requests", "ruff", "scikit-learn"]),
  "Python: the packages pyproject.toml and requirements files declare are read, those of development apart, by the name pip compares", JSON.stringify([[...pyPackages.ships.values()], [...pyPackages.declared.keys()]]));

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
