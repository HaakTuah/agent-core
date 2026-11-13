// The starter kit tried on a .NET project, held the way a Windows machine holds one (init.mjs, file-size.mjs): a
// solution with a program and a library, written by the .NET SDK where one is installed (on GitHub's runners it must
// be) and by hand otherwise, takes the kit with its NuGet option; the project is then cloned twice, once as it is
// stored and once as git for Windows clones by default, every line ending converted (core.autocrlf); and the core's
// own checks run in both. What it holds: the kit and every check pass in the converted clone as in the plain one; the
// copy of the core is byte for byte the same in both, since its own .gitattributes travels with it; the reading-size
// check counts the same in both, a file that stands exactly at its mark included; and where the SDK is there, the
// solution builds with the kit in it, and what the build leaves behind disturbs no check. On Linux and on Windows.
// Git, tar, Node's own modules, and the .NET SDK where there is one, which writes its own settings and caches into the
// test's scratch folder.
//
//   node scripts/init-dotnet-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { counted, sizeOf } from "./file-size.mjs";
import { scratch } from "./scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// the count of a file's bytes
const bytes = text => counted(Buffer.from(text, "latin1"));
ok(bytes("a\nb\n") === 4 && bytes("a\r\nb\r\n") === 4 && bytes("") === 0, "a file counts the same whichever line ending it lies on disk with");
ok(bytes("a\rb\r") === 4 && bytes("\r\r\n") === 2 && bytes("\n\r") === 2 && bytes("\r") === 1, "a carriage return that stands before no line feed is counted like any byte");

const { tmp, env, git, run, script, fresh } = scratch("init-dotnet-test-");
// (the SDK is kept quiet, and leaves no build server behind to hold a file of the scratch folder; what it keeps for
// itself, its own settings and its packages' caches, lies in the scratch folder too, and a build reads no
// Directory.Build file from a folder above the project, where on a shared machine anyone could have left one)
const kept = name => path.join(tmp, "sdk", name);
const sdkEnv = { ...env, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1", MSBUILDDISABLENODEREUSE: "1", DOTNET_CLI_USE_MSBUILD_SERVER: "0", UseSharedCompilation: "false",
  DOTNET_CLI_HOME: kept("home"), NUGET_PACKAGES: kept("packages"), NUGET_HTTP_CACHE_PATH: kept("http-cache"), NUGET_PLUGINS_CACHE_PATH: kept("plugins-cache"), ImportDirectoryBuildProps: "false", ImportDirectoryBuildTargets: "false" };
const dotnet = (dir, ...args) => { const r = spawnSync("dotnet", args, { cwd: dir, env: sdkEnv, encoding: "utf8" }); return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}${r.error?.message ?? ""}` }; };
const sdk = dotnet(tmp, "--version").status === 0;
ok(sdk || !process.env.GITHUB_ACTIONS, "on GitHub's runners there is a .NET SDK, so the project there is one the SDK wrote, and is built");

// a .NET project, in a repository that converts line endings as git for Windows does by default
const dir = fresh("a-dotnet-project");
git(dir, "config", "core.autocrlf", "true");
if (sdk) {
  const steps = [["new", "sln", "--name", "Trial"], ["new", "console", "--output", "src/App"], ["new", "classlib", "--output", "src/Lib"],
    ["sln", "add", "src/App", "src/Lib"], ["add", "src/App", "reference", "src/Lib"], ["new", "gitignore"]];
  const wrote = steps.map(args => [args.join(" "), dotnet(dir, ...args)]).filter(([, r]) => r.status !== 0);
  ok(wrote.length === 0, "the .NET SDK writes a solution with a program and a library", wrote.map(([what, r]) => `dotnet ${what}: ${r.out.slice(0, 400)}`).join("\n     "));
} else {
  // (as an editor on Windows writes them: every line ending a carriage return and a line feed)
  const write = (to, text) => { fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true }); fs.writeFileSync(path.join(dir, to), text.replace(/\n/g, "\r\n")); };
  write("src/App/App.csproj", '<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>Exe</OutputType>\n    <TargetFramework>net9.0</TargetFramework>\n  </PropertyGroup>\n  <ItemGroup>\n    <ProjectReference Include="..\\Lib\\Lib.csproj" />\n  </ItemGroup>\n</Project>\n');
  write("src/App/Program.cs", 'Console.WriteLine("Hello, World!");\n');
  write("src/Lib/Lib.csproj", '<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net9.0</TargetFramework>\n  </PropertyGroup>\n</Project>\n');
  write("src/Lib/Class1.cs", "namespace Lib;\n\npublic class Class1\n{\n}\n");
  write(".gitignore", "bin/\nobj/\n");
}
git(dir, "add", "-A");
git(dir, "commit", "-q", "-m", "a .NET project");

const kit = run(dir, script, "--owner", "someone-else", "--name", "A .NET project", "--nuget", ".");
ok(kit.status === 0 && kit.out.includes("The starter kit is written") && kit.out.includes("its NuGet packages: a check of the project's own"), "the kit writes into a .NET project, and says that its NuGet packages need a check of the project's own", kit.out.slice(0, 800));
if (kit.status === 0) {
  ok(fs.readFileSync(path.join(dir, ".github/dependabot.yml"), "utf8").includes('package-ecosystem: "nuget"\n    directory: "/"\n') && !fs.existsSync(path.join(dir, ".github/workflows/signatures.yml")), "Dependabot is told of its NuGet packages, and npm's signature check is not called");
  git(dir, "commit", "-q", "-m", "the starter kit");

  // two clones: as it is stored, and as git for Windows clones it by default
  const clone = (name, autocrlf) => { git(tmp, "clone", "-q", "-c", `core.autocrlf=${autocrlf}`, dir, name); return path.join(tmp, name); };
  const plain = clone("plain", "false"), converted = clone("converted", "true");
  const text = (root, f) => fs.readFileSync(path.join(root, f), "latin1");
  const kitFiles = ["AGENTS.md", "core-manifest.md", "SECURITY.md", "checks/sizes.json", ".github/workflows/core.yml", ".claude/settings.json"];
  ok(kitFiles.every(f => text(converted, f).includes("\r\n") && !text(plain, f).includes("\r")) && git(converted, "status", "--porcelain") === "" && git(plain, "status", "--porcelain") === "",
    "the converted clone holds the kit's files with Windows' line endings, the plain one without, and git sees no change in either");
  const coreFiles = git(plain, "ls-files", "-z", "--", "core").split("\0").filter(Boolean);
  const differing = coreFiles.filter(f => !fs.readFileSync(path.join(plain, f)).equals(fs.readFileSync(path.join(converted, f))));
  ok(coreFiles.length > 50 && differing.length === 0, "the copy of the core is byte for byte the same in both: no line ending in it is ever converted", differing.slice(0, 5).join(", "));

  // the core's own checks, in both
  const CHECKS = [
    ["the pointer check", "core/scripts/pointers.mjs"],
    ["the workflow check", "core/scripts/workflows.mjs"],
    ["the copies check", "core/scripts/copies.mjs", "checks/copies.json"],
    ["the licence check", "core/scripts/licences.mjs", "checks/licences.json"],
    ["the reading-size check", "core/scripts/reading-size.mjs", "checks/sizes.json"],
  ];
  const check = (root, args) => { const r = spawnSync(process.execPath, args, { cwd: root, env: { ...env, SIZES_BASE: "HEAD" }, encoding: "utf8" }); return { status: r.status, out: r.stdout + r.stderr }; };
  const failing = (root, when) => CHECKS.map(([what, ...args]) => [what, check(root, args)]).filter(([, r]) => r.status !== 0)
    .map(([what, r]) => `${what}, ${when}: ${r.out.split("\n").filter(l => /FAIL|Error/.test(l)).slice(0, 3).join(" | ")}`);
  const first = [...failing(plain, "in the plain clone"), ...failing(converted, "in the converted clone")];
  ok(first.length === 0, "every check of the core passes on the .NET project, in the plain clone and in the converted one", first.join("\n     "));

  // the reading-size check counts the same in both
  const sizeLine = root => check(root, ["core/scripts/reading-size.mjs", "checks/sizes.json"]).out.split("\n").find(l => l.startsWith("ok   read by every session")) ?? "";
  const marks = JSON.parse(text(plain, "checks/sizes.json"));
  const read = Object.keys(marks.read), onDisk = root => read.reduce((n, f) => n + fs.statSync(path.join(root, f)).size, 0), total = root => read.reduce((n, f) => n + sizeOf(path.join(root, f)), 0);
  ok(onDisk(converted) > onDisk(plain) && total(converted) === total(plain) && total(plain) === onDisk(plain), "the files every session reads lie on disk larger in the converted clone, and count the same in both: what GitHub holds");
  ok(sizeLine(plain) !== "" && sizeLine(plain) === sizeLine(converted), "the reading-size check says the same of both, to the byte", `${sizeLine(plain)}\n     ${sizeLine(converted)}`);
  // (a mark set exactly at the count: one byte more would fail, and the converted clone lies on disk well past it)
  for (const root of [plain, converted]) fs.writeFileSync(path.join(root, "checks/sizes.json"), JSON.stringify({ ...marks, total: total(plain) }));
  const exact = [plain, converted].map(root => check(root, ["core/scripts/reading-size.mjs", "checks/sizes.json"]));
  for (const root of [plain, converted]) fs.writeFileSync(path.join(root, "checks/sizes.json"), JSON.stringify({ ...marks, total: total(plain) - 1 }));
  const under = [plain, converted].map(root => check(root, ["core/scripts/reading-size.mjs", "checks/sizes.json"]));
  ok(exact.every(r => r.status === 0) && under.every(r => r.status === 1 && r.out.includes("past their mark")), "a total that stands exactly at its mark passes in both, and one byte past it fails in both", exact.concat(under).map(r => r.out.slice(0, 200)).join("\n     "));
  for (const root of [plain, converted]) git(root, "checkout", "-q", "--", "checks/sizes.json");

  // the solution builds with the kit in it, and the checks pass on what the build leaves
  if (sdk) {
    const build = dotnet(converted, "build", "--disable-build-servers", "--verbosity", "quiet");
    ok(build.status === 0, "the solution builds in the converted clone, with the kit and the copy of the core in it", build.out.slice(-1200));
    ok(fs.existsSync(path.join(converted, "src/App/bin")) && git(converted, "status", "--porcelain") === "", "what the build leaves behind is ignored by git, and nothing of the kit's was touched");
    const after = failing(converted, "after the build");
    ok(after.length === 0, "every check of the core still passes after the build", after.join("\n     "));
  }
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the starter kit in a .NET project, cloned as Windows clones it${sdk ? "" : " (no .NET SDK here: the project was written by hand and not built)"}`);
process.exit(failed ? 1 : 0);
