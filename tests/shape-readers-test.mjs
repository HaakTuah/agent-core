// Tests the shape check's readers of C# and Python (scripts/shape-csharp.mjs and scripts/shape-python.mjs, their
// functions, and of C# and Python all they read, on the parser: csharp-tree.mjs and python-tree.mjs) on files made for
// them: the functions each finds, with their lines, depth and branch points; what a brace or a keyword in a
// string or a comment is; what each file imports and where it leads; and the packages a project declares. The check's
// own use of them, and of the readers of JSX and of the shared space: shape-test.mjs. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/shape-readers-test.mjs
import { Worker } from "node:worker_threads";
import { csharpIndex, csharpPackages, readCsharp, resolveCsharp } from "../scripts/shape-csharp.mjs";
import { STDLIB, pythonPackages, readPython, resolvePython } from "../scripts/shape-python.mjs";
import { ParserFailed, inParser } from "../scripts/parser.mjs";
import { LARGEST } from "../scripts/tree-walk.mjs";

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
ok(readCsharp("var a = $\"{b}\" + $@\"{c}\";\n").toks.filter(t => t.t === "id").map(t => t.v).join() === "var,a,b,c", "C#: an interpolated string's code is read as code");
ok(same(cs.usings.map(u => `${u.target}${u.static ? " static" : ""}${u.alias ? " alias" : ""}`), ["System", "Game.Rules.Dice static", "Newtonsoft.Json alias", "System.Collections.Generic.List alias", "Game.Debug"]) && same(cs.namespaces, ["Game.View"]) && same(cs.types, ["Game.View.Point", "Game.View.Board"]),
  "C#: its using directives, global, static and aliased, its namespace and its types are read", JSON.stringify([cs.usings, cs.namespaces, cs.types]));
ok(readCsharp("class A { void B() { using (var x = y) { } using var z = w; using Q q = new(); } }\n").usings.length === 0, "C#: a using statement is no directive");
ok(readCsharp(`using A = X.Y.T<${"int, ".repeat(100)}int>;\nusing B = X.Z;\n`).usings.map(u => u.target).join() === "X.Y.T,X.Z", "C#: an alias of a type with many arguments is read whole");
const nested = readCsharp("namespace A {\n  namespace B { class C { } }\n  class D { }\n}\nnamespace E;\nrecord struct F(int x);\n");
ok(same(nested.namespaces, ["A", "A.B", "E"]) && same(nested.types, ["A.B.C", "A.D", "E.F"]), "C#: nested namespaces are joined, a file-scoped one holds the rest of the file", JSON.stringify(nested));
// C#'s usings, declarations, tokens and comments on the parser (#530, item 6): where the lexer misread, as the trial old
// against new found, and where the grammar cannot read a file whole
const csMisread = readCsharp("namespace N {\n  class A<T> where T : class\n  {\n    void M() { foreach (var x in y) { } var s = @\"\"\"q\"\"\"; DateTime.Now.ToString(); }\n    double d = 1e-9 + 1.5.GetHashCode();\n  }\n}\n");
ok(same(csMisread.types, ["N.A"]) && csMisread.toks.some(t => t.v === "1e-9") && csMisread.toks.filter(t => t.v === "DateTime").length === 1 && csMisread.functions.length === 1,
  "C#: a class constraint before in names no type, a verbatim string that opens with escaped quotes is no raw string, and a number with its exponent is one token", JSON.stringify([csMisread.types, csMisread.functions]));
const csLines = readCsharp("var s = @\"\n#not a directive\n\";\n#if A\nint x = 1; // one\n#else\nint x = 2; /* two\r\n   lines */\n#endif\nusing global::G.H;\n");
ok(same(csLines.comments.map(c => `${c.line}:${c.text}`), ["5: one", "7: two\r", "8:   lines "]) && csLines.usings.length === 0 && csLines.toks.filter(t => t.v === "x").length === 2,
  "C#: a # inside a verbatim string is no directive; both sides of an #if are read; a comment's lines are read as the lexer read them; a using of global:: names nothing", JSON.stringify(csLines));
// (the review's three cases: a hole right after an escaped brace, which the grammar reads as text, is read as code; a
// global:: in a type argument leaves the target named; a comment of 600,000 lines is read whole, overflowing nothing)
const escaped = readCsharp("class C { void M() { var s = $\"{{{DateTime.Now}}}\"; var e = $\"{{{{q}}}}\"; var f = $\"{{{Task.Delay(1):N0}}}\"; } }\n");
const escapedWords = escaped.toks.map(t => t.v).filter(Boolean).join(" ");
ok(escapedWords.includes("= DateTime . Now ;") && !escaped.toks.some(t => t.v === "q") && escapedWords.includes("= Task . Delay ( 1 ) ;") && !escaped.toks.some(t => t.v === "N0"),
  "C#: a hole right after an escaped brace is read as code, to its format; an even run of braces is text", JSON.stringify(escaped.toks.map(t => t.v)));
const typeArg = readCsharp("using Alias = Game.Rules.Box<global::System.String>;\nusing B = global::M.N;\nclass C {}\n");
ok(same(typeArg.usings.map(u => u.target), ["Game.Rules.Box"]), "C#: a global:: inside the target's type arguments leaves the target named; one that qualifies the target names nothing", JSON.stringify(typeArg.usings));
const manyLines = readCsharp(`/*${"\n".repeat(600000)}*/ class C { void M() { } }\n`);
ok(manyLines.functions?.length === 1 && manyLines.comments.length === 600001, "C#: a comment of 600,000 short lines is read whole, its lines passed one at a time", JSON.stringify({ functions: manyLines.functions?.length, comments: manyLines.comments.length }));
const csBroken = readCsharp("using A.B;\nnamespace N;\nclass Kept { }\nclass Lost { void M() { return x is [.., 1]; } }\n");
ok(csBroken.functions === null && same(csBroken.usings.map(u => u.target), ["A.B"]) && same(csBroken.namespaces, ["N"]) && csBroken.types.includes("N.Kept"),
  "C#: a file the grammar cannot read whole has no functions told, and its usings and declarations are those the grammar read whole", JSON.stringify(csBroken));
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
// Python's imports and tokens on the parser (#530, item 6): as the lexer read them, across lines in brackets and after a
// \, comments none.
const pyLines = readPython("from a . b import (\n    c as d,  # e\n    f)\nimport \\\n  x.y as z, w\nn = (yield) == 2 ** 3 -> q\nif (m := time.sleep(1)): pass\n");
ok(same(pyLines.imports.map(i => `${i.line}:${i.module} [${i.names}]`), ["1:a.b [c,f]", "4:x.y []", "4:w []"]) && same(pyLines.toks.slice(pyLines.toks.findIndex(t => t.v === "n")).map(t => t.v).join(" "), "n = ( yield ) = = 2 * * 3 - > q if ( m := time . sleep ( 1 ) ) : pass"),
  "Python: an import across lines in brackets and after a \\ is read as one, a name taken by its own and not its alias; each sign but := its own token, a comment none", JSON.stringify(pyLines));
const pyStrings = readPython("x = f\"{random.random()!r:{w}} {time.time()=}\" 'a' \"\"\"b\n# c\"\"\" rb'\\d'\n");
ok(same(pyStrings.toks.map(t => `${t.t}:${t.v}`), ["id:x", "punct:=", "str:", "id:random", "punct:.", "id:random", "punct:(", "punct:)", "id:time", "punct:.", "id:time", "punct:(", "punct:)", "punct:=", "str:", "str:", "str:"]),
  "Python: a string is one token, an f-string's code in its { } read after it and its conversion and format passed over, a # inside a string no comment", JSON.stringify(pyStrings.toks));
// (where the lexer misread a token, as the trial old against new found: a number's exponent split from it; a hole after
// \ in a raw f-string, where the \ escapes nothing, taken for text; a t-string's t taken for a name; and where the
// grammar misreads, a format's fill of = taken for :=, mended to the code before it)
const pyToks = readPython("a = 1e-6 + 2.5E+3\nb = rf\"\\{time.time()}\"\nc = t\"{0}\"\nd = f\"{msg:=^80}{e}\"\n").toks.map(t => `${t.t[0]}${t.v}`).join(" ");
ok(pyToks === "ia p= n1e-6 p+ n2.5E+3 ib p= s itime p. itime p( p) ic p= s n0 id p= s imsg ie",
  "Python: a number with its exponent is one token, a raw f-string's \\{ opens its code, a t-string is a string, and a format's fill of = is no code", pyToks);
// (an import under each kind of block that can hold one: the walk goes only through those, `HOLDS` in python-tree.mjs)
const pyBlocks = readPython(["try:\n    import a\nexcept E:\n    import b\nexcept* F:\n    import c\nelse:\n    import d\nfinally:\n    import e",
  "with x:\n    import f", "async def g():\n    async with y:\n        import h\n    async for i in j:\n        import k", "for l in m:\n    import n\nelse:\n    import o",
  "while p:\n    import q\nelse:\n    import r", "match s:\n    case 1:\n        import t", "@deco\nclass U:\n    import v", "if w:\n    pass\nelif x:\n    import y\nelse:\n    import z"].join("\n") + "\n");
ok(same(pyBlocks.imports.map(i => `${i.module}${i.dynamic ? "!" : ""}`).join(" "), "a b c d e f h! k! n o q r t v y z"),
  "Python: an import is read under each kind of block, a def's as dynamic", JSON.stringify(pyBlocks.imports));
const pyInError = readPython("if TYPE_CHECKING:\nimport y1\nelse:\n    import y2\n");
ok(pyInError.functions === null && same(pyInError.imports.map(i => i.module), ["y1", "y2"]),
  "Python: an import the grammar read whole inside a part it could not read is read all the same", JSON.stringify(pyInError.imports));
const pyBroken = readPython("import first\ndef f(:\n    import inside\nfrom later import (x,\n");
ok(pyBroken.functions === null && same(pyBroken.imports.map(i => `${i.module}${i.dynamic ? " dynamic" : ""}`), ["first", "inside dynamic"]),
  "Python: a file the grammar cannot read whole has its imports read where it read them whole, and none from what it could not", JSON.stringify(pyBroken.imports));
ok(same(shown(readPython("def f():\n\tif a:\n\t\treturn '''x\nif y:\n  z'''\n\treturn 1\n").functions), ["f:1:6:1:1"]), "Python: a tab indents to the next multiple of 8, and a string's lines open no block");
// Python's functions on the parser (#530, item 6): where the lexer misread, the grammar reads as the definition says.
const pyMisread = "def a(x):\n    return x is ... or x\n\ndef b(value):\n    case = value[0]\n    if case:\n        return case.upper()\n";
ok(same(shown(readPython(pyMisread).functions), ["a:1:2:0:1", "b:4:4:1:1"]), "Python: an or after ... is a branch, and case used as a name at a line's start is none", shown(readPython(pyMisread).functions));
const pyEdges = "@pick(a or b)\ndef f(x=y and z) -> int:\n    if x:\n        return [i for i in x if i]  # c\n    # trailing\n\ndef g(t):\n    return f\"{t:=^80}\" if t else ''\nn = lambda: a if b else c\n";
ok(same(shown(readPython(pyEdges).functions), ["f:2:3:1:3", "g:7:2:0:1"]),
  "Python: a decorator's and a default's branches count where the function stands, a comment after the body is none of its lines, and a format's fill of = (which the grammar reads as :=) leaves the functions told", shown(readPython(pyEdges).functions));
ok(readPython("def f():\n    return f\"{t:=or 80}\"\n").functions === null && readPython("def f(:\n    pass\n").functions === null,
  "Python: a file the grammar cannot read whole, an error in an f-string's { } that holds a word among them, has no functions told");
const pySized = n => `${"x = 1\n".repeat(n)}def f():\n    pass\n`, pyUnder = Math.floor(LARGEST / 7);
ok(same(shown(readPython(pySized(pyUnder)).functions), [`f:${pyUnder + 1}:2:0:0`]) && readPython(pySized(LARGEST / 5)).functions === null,
  "Python: a file past the largest the grammar is given is lost unread, and one under it is read whole");
const pyStarted = Date.now();
const pyHostile = [`def f():\n    x = ${"([{".repeat(280000)}\n`, `def f():\n    ${"['".repeat(300000)}\n`].map(t => readPython(t).functions);
ok(pyHostile.every(f => f === null) && Date.now() - pyStarted < 10000, `Python: brackets and strings that never close are lost within the grammar's budget (${Date.now() - pyStarted} ms)`);
const inline = readPython("import a; import b\nif sys.platform == 'win32': import winreg\nif TYPE_CHECKING: from t import T\ndef f(): import lazy\n");
ok(same(inline.imports.map(i => `${i.module}${i.dynamic ? " dynamic" : ""}${i.types ? " types" : ""}`), ["a", "b", "winreg", "t types", "lazy dynamic"]), "Python: imports after a ; and in a one-line suite are read, with where they stand", JSON.stringify(inline.imports));
const files = new Set(["pkg/__init__.py", "pkg/a/m.py", "pkg/a/x.py", "pkg/mod.py", "src/lib/util.py", "tools/helpers.py", "app/json.py", "two/dup.py", "three/dup.py"]);
const std = n => STDLIB.has(n);
const lead = (from, imp) => JSON.stringify(resolvePython(from, { names: [], ...imp }, files, std));
ok(lead("pkg/a/m.py", { level: 1, module: "", names: ["x", "y"] }) === '{"to":["pkg/a/x.py"]}' && lead("pkg/a/m.py", { level: 2, module: "mod", names: ["z"] }) === '{"to":["pkg/mod.py"]}'
  && lead("pkg/a/m.py", { level: 2, module: "", names: ["mod"] }) === '{"to":["pkg/mod.py"]}', "Python: a relative import leads to the module it names, or to each name that is a module of its own");
ok(lead("main.py", { level: 0, module: "lib.util" }) === '{"to":["src/lib/util.py"]}' && lead("tools/run.py", { level: 0, module: "helpers" }) === '{"to":["tools/helpers.py"]}'
  && lead("pkg/a/m.py", { level: 0, module: "pkg.a", names: ["x"] }) === '{"to":["pkg/a/x.py"]}', "Python: an absolute import leads to the project's own module under its root, src/ or the file's own folder");
ok(lead("main.py", { level: 0, module: "json" }) === '{"outside":"json","top":"json"}' && lead("main.py", { level: 0, module: "dup" }) === '{"outside":"dup","top":"dup"}' && lead("main.py", { level: 0, module: "numpy.linalg" }) === '{"outside":"numpy.linalg","top":"numpy"}',
  "Python: the standard library is never taken for a file of the project's that ends in its name, and a name two files end in leads nowhere the reader can tell");
const many = new Set(Array.from({ length: 200000 }, (_, i) => `f${i}.py`));
ok(JSON.stringify(resolvePython("main.py", { level: 0, module: "os", names: [] }, many, std)) === '{"outside":"os","top":"os"}', "Python: an import is led in a project of any number of files");
const long = "m".repeat(100000), names = Array(100000).fill("b");
const wide = new Set(["x.py", "deep/pkg/b.py", ...Array.from({ length: 20000 }, (_, i) => `d${i}/b.py`)]);
ok(JSON.stringify(resolvePython("a.py", { level: 0, module: long, names }, wide, std)) === JSON.stringify({ outside: long, top: long })
  && same(resolvePython("a.py", { level: 1, module: long, names }, wide, std).to, [])
  && JSON.stringify(resolvePython("a.py", { level: 0, module: "z", names: names.slice(0, 20000) }, wide, std)) === '{"outside":"z","top":"z"}'
  && JSON.stringify(resolvePython("a.py", { level: 0, module: "pkg", names: ["b", "c"] }, wide, std)) === '{"to":["deep/pkg/b.py"]}',
  "Python: an import of a long name, of many names or of a name many files share is led, and a module found by the end of its path still is");
ok(Array.from({ length: 20000 }, () => resolvePython("a.py", { level: 0, module: "b", names: [] }, wide, std)).every(r => r.outside === "b")
  && Array.from({ length: 20000 }, (_, i) => resolvePython("a.py", { level: 0, module: `a${i}.b`, names: [] }, wide, std)).every((r, i) => r.outside === `a${i}.b`)
  && same(resolvePython("a.py", { level: 0, module: "d7.b", names: [] }, wide, std).to, ["d7/b.py"]),
  "Python: a module many files end in, imported again and again, or under many names, is led each time");
const inits = new Set(Array.from({ length: 20000 }, (_, i) => `d${i}/__init__/__init__.py`));
const longTop = "t".repeat(100000), distinct = Array.from({ length: 100000 }, (_, i) => `b${i}`);
ok(Array.from({ length: 20000 }, (_, i) => resolvePython("a.py", { level: 0, module: `a${i}.__init__`, names: [] }, inits, std)).every((r, i) => r.outside === `a${i}.__init__`)
  && same(resolvePython("a.py", { level: 0, module: "d7.__init__", names: [] }, inits, std).to, ["d7/__init__/__init__.py"])
  && resolvePython("a.py", { level: 0, module: longTop, names: distinct }, wide, std).outside === longTop,
  "Python: modules of any last part many files end in, and many names from a module of a long name, are led");
const pyPackages = pythonPackages({
  "pyproject.toml": "[project]\nname = \"game\"\ndependencies = [\n  \"requests[socks]>=2\",\n  \"PyYAML\",  # a comment\n]\n[project.optional-dependencies]\ntest = [\"pytest\"]\n[tool.poetry.dependencies]\npython = \"^3.11\"\nflask = \"*\"\n[tool.poetry.group.dev.dependencies]\nblack = \"*\"\n",
  "requirements-dev.txt": "ruff==1\n-r requirements.txt\n", "requirements.txt": "numpy # x\n-e .\nscikit_learn>=1\n",
});
ok(same([...pyPackages.ships.values()], ["requests", "PyYAML", "flask", "numpy", "scikit_learn"]) && same([...pyPackages.declared.keys()].sort(), ["black", "flask", "numpy", "pytest", "pyyaml", "requests", "ruff", "scikit-learn"]),
  "Python: the packages pyproject.toml and requirements files declare are read, those of development apart, by the name pip compares", JSON.stringify([[...pyPackages.ships.values()], [...pyPackages.declared.keys()]]));

// ---- C#'s functions on the parser (csharp-tree.mjs; #529): the cases above, read as the lexer read them, held
// the port's behaviour to the old reader's; these hold it to counts taken by hand ----
// Held out: written and counted by hand by a fresh session that never saw the reader, from its definition frozen first
// (17 November 2026); the lexer's reader counted it the same.
const heldOutCs = String.raw`// held-out.cs: an invented order-routing service, not compiled against anything real.
// Braces in comments { } and keywords if while case && must not count.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Shop.Routing
{
    /* A block comment: if (x) { while (y) { } } && || ?? */
    public record Order(int Id, string? Note, decimal Total)
    {
        public bool IsLarge => Total > 1000m && Note != null;

        public string Describe()
        {
            return $"Order {Id}: {(IsLarge ? "large" : "small")} {{literal}}";
        }
    }

    public class Ledger(int capacity)
    {
        private readonly List<decimal> _items = new List<decimal> { 1m, 2m, 3m };
        public int Capacity { get; } = capacity;

        public decimal this[int index]
        {
            get { return index < _items.Count ? _items[index] : 0m; }
            set
            {
                if (index >= 0 && index < _items.Count)
                {
                    _items[index] = value;
                }
            }
        }
    }

    public abstract class RouterBase
    {
        protected RouterBase(string name) { Name = name; }
        public string Name { get; }
    }

    public sealed class Router : RouterBase, IDisposable
    {
        private readonly object _gate = new object();
        private EventHandler? _changed;
        private int? _limit;
        private string? _label;

        #region Construction

        public Router(string name, int limit) : base(name)
        {
            _limit = limit > 0 ? limit : null;
        }

        public Router() : this("default", 10)
        {
        }

        ~Router()
        {
            Dispose();
        }

        #endregion

        public event EventHandler Changed
        {
            add { lock (_gate) { _changed += value; } }
            remove
            {
                lock (_gate)
                {
                    _changed -= value;
                }
            }
        }

        public string Label
        {
            get => _label ?? "none";
            set { _label = value?.Trim(); _changed?.Invoke(this, EventArgs.Empty); }
        }

        public int Limit => _limit ?? 0;

        public static Router operator +(Router a, Router b)
        {
            return new Router(a.Name + b.Name, a.Limit + b.Limit) { Label = a.Label };
        }

        public static explicit operator int(Router r)
        {
            return r.Limit;
        }

        public void Dispose()
        {
            _changed = null;
        }

        public T Pick<T, K>(IEnumerable<T> items, K key)
            where T : class, IComparable<T>
            where K : notnull
        {
            T? best = null;
            foreach (var item in items)
            {
                if (best == null || item.CompareTo(best) > 0)
                {
                    best = item;
                }
            }
            return best ?? throw new InvalidOperationException("empty { }");
        }

        public string Route(Order order, int code)
        {
            string path = @"C:\orders\{0}\if\while";
            string raw = """
                { "route": "if (a && b) { c ?? d }" }
                """;
            char open = '{';
            string result = "";
            switch (code)
            {
                case 1:
                case 2:
                    result = "local";
                    break;
                case 3 when order.Total > 50m:
                    result = "express";
                    break;
                case 4:
                    goto case 1;
                default:
                    result = order.IsLarge?"freight":"post";
                    break;
            }
#if DEBUG
            Console.WriteLine($"{path} {raw.Length} {open}");
#else
            _label ??= result;
#endif
            return result;
        }

        public Func<int, int> Rule(string kind) => kind switch
        {
            "double" => x => x * 2,
            "clamp" => x => { return x > 100 ? 100 : x; },
            _ => x => x,
        };

        public int Process(IList<Order> orders)
        {
            int total = 0;
            int Weigh(Order o)
            {
                if (o is Order { Note: "fragile" })
                {
                    return 3;
                }
                else if (o.Total > 500m)
                {
                    return 2;
                }
                else
                {
                    return 1;
                }
            }
            Func<Order, bool> heavy = o => o.Total > 200m;
            Action<Order> log = o =>
            {
                if (o.Note != null) if (o.Id > 0) { Console.WriteLine(o.Describe()); }
            };
            Func<int, int> square = delegate (int x) { return x * x; };
            Action ping = delegate { Console.WriteLine(total > 0 ? "ping" : "idle"); };
            orders.ToList().ForEach(o =>
            {
                total += Weigh(o) + (heavy(o) ? 1 : 0);
            });
            try
            {
                using (var ledger = new Disposer())
                {
                    int i = 0;
                    do
                    {
                        log(orders[i]);
                        i++;
                    } while (i < orders.Count && i < Limit);
                }
            }
            catch (ArgumentOutOfRangeException e) when (e.ParamName != null)
            {
                total = -1;
            }
            catch (Exception)
            {
                throw;
            }
            finally
            {
                ping();
            }
            return square(total);
        }
    }

    public sealed class Disposer : IDisposable
    {
        public void Dispose() { }
    }
}
`;
const heldOutByHand = [
  "Describe:15:3:0:1",
  "get:27:1:0:1",
  "set:29:6:1:2",
  "RouterBase:40:1:0:0",
  "Router:54:3:0:1",
  "Router:59:2:0:0",
  "Router:63:3:0:0",
  "add:71:1:1:0",
  "remove:73:6:1:0",
  "set:84:1:0:0",
  "operator:90:3:0:0",
  "int:95:3:0:0",
  "Dispose:100:3:0:0",
  "Pick:107:11:2:4",
  "Route:120:29:1:6",
  "(anonymous):153:1:0:1",
  "Process:158:54:3:5",
  "Weigh:161:14:1:2",
  "log:177:3:1:2",
  "(anonymous):180:1:0:0",
  "(anonymous):183:3:0:1",
  "Dispose:216:1:0:0",
];
ok(same(shown(readCsharp(heldOutCs).functions), heldOutByHand), "C#, held out: each function as a fresh session counted it by hand (22 functions, 153 lines, 26 branches)", shown(readCsharp(heldOutCs).functions));
// What the lexer misread, by its own definition, and the parser reads as the definition says: a choice with no spaces,
// a goto case (no case), a lambda in a switch expression's arm (no arm), the operator >>>, a property pattern (no
// function), a choice in a raw string's hole.
const misread = String.raw`class Q {
  int A(bool a) {
    var x = a?1:2;
    return x;
  }
  void B(int s) {
    switch (s) { case 1: goto case 2; case 2: break; }
  }
  void C() {
    Action d = delegate { if (true) { } };
  }
  Func<int, Func<int,int>> D(int v) {
    return v switch { 1 => y => y, _ => z => z };
  }
  public static Q operator >>>(Q a, int b) { return a; }
  bool E(object o) {
    return o is Foo(1) { P: 2 };
  }
  string F(int n) {
    return $"""{(n > 1 ? "a" : "b")}""";
  }
  void G() {
    if (a) if (b) { }
  }
}
`;
ok(same(shown(readCsharp(misread).functions), ["A:2:4:0:1", "B:6:3:1:2", "C:9:3:1:1", "D:12:3:0:2", "operator:15:1:0:0", "E:16:3:0:0", "F:19:3:0:1", "G:22:3:1:2"]),
  "C#: what the lexer misread is read as the definition says", shown(readCsharp(misread).functions));
// C# 14's extension blocks, which the grammar predates: no function themselves, their members read; the generic form too.
const extension = "static class P\n{\n    extension<T>(IEnumerable<T> s) where T : class\n    {\n        public static int X { get { return 1; } }\n        public int Y() { if (a) { } return 2; }\n    }\n    extension(char c)\n    {\n        public bool Z(int n) { return n > 0 && c != 'x'; }\n    }\n}\n";
ok(same(shown(readCsharp(extension).functions), ["get:5:1:0:0", "Y:6:1:1:1", "Z:10:1:0:1"]), "C#: an extension block of C# 14 is no function, and its members are read", shown(readCsharp(extension).functions));
// What stands outside a function's body is read where the function stands, as the lexer read it: a lambda passed to
// : this(...) is a function of its own, opening before the constructor's body; a default's choice counts for the
// function around the local function.
const outside = "class C {\n  public C() : this(() => {\n    if (a) { if (b) {} }\n  }) {}\n  void L() { int F(int x = a ? 1 : 2) { return x; } }\n}\n";
ok(same(shown(readCsharp(outside).functions), ["(anonymous):2:3:2:2", "C:4:1:0:0", "L:5:1:0:1", "F:5:1:0:0"]), "C#: a lambda in a constructor's initializer is a function, and what stands outside a body counts where its function stands", shown(readCsharp(outside).functions));
// A file the grammar cannot read whole has no functions told: a method that holds C# 14's null-conditional assignment
// (a?.b += 1), which the grammar installed predates, reads as no method at all, so the file is lost, counted and said
// (shape.mjs), where measuring what the grammar read would have passed a long function in silence (#605's fallback
// review).
const newer = `class A\n{\n    void Long()\n    {\n${"        x++;\n".repeat(100)}        a?.b += 1;\n    }\n}\n`;
ok(readCsharp(newer).functions === null, "C#: a file the grammar cannot read whole has no functions told, so that the check counts it and says so");
// (and one past the largest a reader gives its grammar, lost unread: its tree's memory is what a generated file costs)
const sized = n => `class A { int[] W = { ${Array.from({ length: n }, (_, k) => k).join(", ")} }; void M() { } }\n`;
ok(sized(LARGEST / 9).length <= LARGEST && same(shown(readCsharp(sized(LARGEST / 9)).functions), ["M:1:1:0:0"]) && sized(LARGEST / 6).length > LARGEST && readCsharp(sized(LARGEST / 6)).functions === null,
  "C#: a file past the largest the grammar is given is lost unread, and one under it is read whole");
// The parser's thread: a call that fails there is told as the file's ("read"), and the next call gets its own answer,
// never an earlier one's.
let failedAs = null;
try { inParser(new URL("../scripts/csharp-tree.mjs", import.meta.url).href, "no such reader", "class A { }"); } catch (e) { failedAs = e instanceof ParserFailed ? e.kind : String(e); }
ok(failedAs === "read" && same(shown(readCsharp("class A { void M() { if (a) { } } }").functions), ["M:1:1:1:1"]), "C#: a call that fails in the parser's thread is a failure to read the file, and the next call gets its own answer", failedAs);
// A type named extension: its constructor `extension() { }` is read as a constructor, never as an extension block's
// header (Codex's finding on #605).
ok(same(shown(readCsharp("class extension\n{\n    extension() { int x = 0; }\n}\nstatic class P\n{\n    extension(char c) { public int Y() { return 1; } }\n}\n").functions), ["extension:3:1:0:0", "Y:7:1:0:0"]), "C#: a type named extension keeps its constructor, and an extension block beside it is still read as one", shown(readCsharp("class extension\n{\n    extension() { int x = 0; }\n}\n").functions));
// Types named extension inside one another, beside one another and many in a file: each one's constructor is read as
// one, and an extension block between them as a block, its member read.
const kin = "class extension\n{\n    class extension\n    {\n        extension(int x) { }\n    }\n    extension(int y) { }\n}\nstatic class P\n{\n    extension(char c) { public int Y() { return 1; } }\n}\nclass extension\n{\n    extension() { }\n}\n";
const manyKin = readCsharp(`${"class extension { extension(int x) { } }\n".repeat(2000)}static class P { extension(char c) { public int Y() { return 1; } } }\n`).functions;
ok(same(shown(readCsharp(kin).functions).map(f => f.split(":").slice(0, 2).join(":")), ["extension:5", "extension:7", "Y:11", "extension:15"])
  && manyKin.length === 2001 && manyKin.at(-1).name === "Y" && manyKin.slice(0, -1).every(f => f.name === "extension"),
  "C#: types named extension, nested, side by side or many, each keep their constructor, and a block between them is read as one", shown(readCsharp(kin).functions));
// Both sides of an #if read as code, as the lexer read them: an if on each side, one block after.
const sides = "class S\n{\n    void M()\n    {\n#if WINDOWS\n        if (a)\n#else\n        if (b)\n#endif\n        {\n            Go();\n        }\n    }\n}\n";
ok(same(shown(readCsharp(sides).functions), ["M:4:10:1:2"]), "C#: both sides of an #if are read as code, the block after them the second if's", shown(readCsharp(sides).functions));

// ---- what no file can do to the readers: overflow their stack, or take time past its length ----
const deepCs = `class A { string s = ${"$\"{".repeat(5000)}x${"}\"".repeat(5000)}; void B() { } }\n`;
const deepPy = `x = ${'f"{'.repeat(5000)}1${'}"'.repeat(5000)}\ndef f():\n    return 1\n`;
let threw = "";
try { ok(readCsharp(deepCs).functions === null && readPython(deepPy).functions === null, "code nested past the readers' limit loses the file's functions, and throws nothing"); } catch (e) { threw = e.message; ok(false, "code nested past the readers' limit throws nothing", threw); }
const started = Date.now();
readCsharp(`${"#".repeat(400000)}\n`);
readCsharp(`${"using A = B<".repeat(40000)}\n`);
csharpPackages({ "x.csproj": "<PackageReference Include=\"a\" ".repeat(100000) });
ok(Date.now() - started < 5000, `a line of #, aliases that never close and references that never close are read in time linear in their length (${Date.now() - started} ms)`);
// (the parser's walk: blocks and ifs nested twenty thousand deep, a text of headers of C# 14's extension blocks that
// never end, and a word or a lambda at the left end of a chain forty thousand long, each read in time linear in its
// length; #605's fallback review)
const walked = Date.now();
const deepIfs = readCsharp(`class A { void M() {${"if (a) {".repeat(20000)}${"}".repeat(20000)}} }`).functions?.[0];
readCsharp(`class A { void M() {${"{".repeat(40000)}${"}".repeat(40000)}} }`);
readCsharp(`class A {${"x; extension(".repeat(5000)}}`);
readCsharp(`class A { int x = extension ${"+ a ".repeat(40000)}; }`);
readCsharp(`class A { void M() { var f = (() => { })${" + a".repeat(40000)}; } }`);
ok(deepIfs?.depth === 20000 && deepIfs.branches === 20000 && Date.now() - walked < 5000, `C#: code nested twenty thousand deep, headers that never end and the left ends of long chains are read on the parser in time linear in their length (${Date.now() - walked} ms)`, JSON.stringify(deepIfs));

// (code run with --input-type=module, as a script started with node -e and that flag is, reads C# on the parser all the
// same: the parser's thread is not handed that flag, which Node refuses for a module file, where the thread would die
// at once and every file wait out the parser's wait. A thread of this process's own, given the flag, is such code, so no
// other process is started for it)
{
  const at = new URL("../scripts/shape-csharp.mjs", import.meta.url).href;
  const code = `const { parentPort } = await import("node:worker_threads"); const { readCsharp } = await import(${JSON.stringify(at)}); parentPort.postMessage({ argv: process.execArgv, functions: readCsharp("class A { void M() { } }\\n").functions });`;
  const got = await new Promise(resolve => {
    const w = new Worker(code, { eval: true, execArgv: ["--input-type=module"] });
    w.once("message", m => { resolve(m); w.terminate(); });
    w.once("error", e => resolve({ error: String(e?.message ?? e) }));
    w.once("exit", c => resolve({ error: `the thread exited with ${c} and sent nothing` }));
  });
  ok(got.argv?.includes("--input-type=module") && got.functions?.[0]?.name === "M", "code run with --input-type reads C#'s functions on the parser at once", JSON.stringify(got));
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
