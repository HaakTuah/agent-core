// Checks the NuGet check's own steps: first its look, "Does the pull request change what NuGet reads?"
// (scripts/nuget-look.sh, run as scripts/checks.mjs runs it), then the whole job of .github/workflows/nuget.yml, whose
// steps scripts/checks.mjs holds, run as GitHub runs it (scripts/workflow-run.mjs), on scratch pull
// requests of a .NET project that holds one real package in its lock file: it says to restore wherever a pull request
// changes a file it names (a file an Import brings in among them, as the project's copy of the core's script lists
// them), and, where none changed, wherever NuGet finds a lock file that no longer holds what its
// project asks for, however the project asks (in an import, two imports on a line, through a property, a link, a name
// outside plain ASCII), or a package downloaded beside it; and not to where only other files change, a project's
// NuGet.Config that maps its packages to their sources included. No package is
// downloaded: the step restores against an empty source. The whole job, on a project with no package: its restore and
// its check pass, and a lock file that no longer holds what its project asks for fails the restore. Where there is no
// .NET SDK (never on GitHub's runners) only the first look is tried, and the whole job on a stand-in for dotnet that
// says the machine lacks the SDK band global.json pins, whose restore reads as not run (#1361, point 10). The one case where the restore must succeed, which
// asks NuGet's own registry, is nuget-gate-network-test.mjs's, in the part network (#772). The whole job installs the core's packages from a
// copy of the machine's npm cache, made as the test starts, so it reaches no registry (#772). On Linux and on Windows.
// Git, bash, jq, the .NET SDK, npm and Node's own modules.
//
//   node tests/nuget-gate-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { stepEnv } from "../scripts/check.mjs";
import { nugetScratch } from "../scripts/nuget-gate-scratch.mjs";
import { root, tally } from "../scripts/scratch-core.mjs";
import { CORE } from "../scripts/core-address.mjs";

const { ok, done } = tally();
const { tmp, env, git, sdk, tfm, project, whole } = nugetScratch("nuget-gate-test-");
ok(sdk || !process.env.GITHUB_ACTIONS, "on GitHub's runners there is a .NET SDK, so NuGet's own word is asked here as there");

const LOCK = `${JSON.stringify({ version: 1, dependencies: { [tfm]: { "Newtonsoft.Json": { type: "Direct", requested: "[13.0.3, )", resolved: "13.0.3", contentHash: "HrC5BXdl00IP9zeV+0Z848QWPAoCr9P3bDEZguI+gkLcBKAOxix/tLEAAHC+UvDNPv4a2d18lOReHMOagPa+zQ==" } } } }, null, 2)}\n`;
const EMPTY = "<Project>\n</Project>\n";
// (a build file that asks for a package only where a text file it reads says so: what the first look's listing cannot
// name, since only a build's own evaluation reads it, and NuGet's own word sees)
const FLAGGED = "<Project>\n  <PropertyGroup>\n    <Flag>$([System.IO.File]::ReadAllText('$(MSBuildThisFileDirectory)build/flag.txt').Trim())</Flag>\n  </PropertyGroup>\n  <ItemGroup Condition=\"'$(Flag)' == 'yes'\">\n    <PackageReference Include=\"Serilog\" Version=\"4.0.0\" />\n  </ItemGroup>\n</Project>\n";
const ADDS = '<Project>\n  <ItemGroup>\n    <PackageReference Include="Serilog" Version="4.0.0" />\n  </ItemGroup>\n</Project>\n';
const START = {
  "README.md": "# A project\n",
  "src/App/App.csproj": project(),
  "src/App/Program.cs": "System.Console.WriteLine(1);\n",
  "src/App/packages.lock.json": LOCK,
  "build/deps.xml": EMPTY,
  "checks/licences.json": '{ "audit": "checks/audit.json", "nuget": { "ships": ["src/App/packages.lock.json"], "tools": [], "sources": ["https://example.invalid/v3/index.json", "local-packages/"] } }\n',
  "checks/audit.json": '{ "entries": [] }\n',
  "local-packages/readme.txt": "packages\n",
  ".github/workflows/nuget.yml": "name: nuget\n",
  ".github/workflows/restore.yml": "name: restore\n",
};
let n = 0;
// The step's answer on a pull request that changes `files` (null removes one) from a project that starts as `start`.
// With `steps`, the look runs in the environment check.mjs gives the steps it runs (stepEnv), not the scratch's own.
function gate(files, { start = {}, base = true, caller = "nuget.yml", link = null, steps = false } = {}) {
  const dir = path.join(tmp, `repo-${++n}`);
  fs.mkdirSync(dir);
  git(dir, "init", "-q", "-b", "main");
  const put = set => { for (const [f, text] of Object.entries(set)) { const at = path.join(dir, f); if (text === null) fs.rmSync(at); else { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); } } };
  put({ ...START, ...start });
  fs.cpSync(path.join(root, "scripts"), path.join(dir, "core/scripts"), { recursive: true });
  if (link) fs.symlinkSync(link[1], path.join(dir, link[0]));
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  const baseSha = git(dir, "rev-parse", "HEAD");
  if (typeof files === "function") files(dir); else put(files);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "-m", "a change");
  const output = path.join(tmp, `look-${n}`);
  fs.writeFileSync(output, "");
  const from = steps ? { ...stepEnv(path.join(tmp, `step-home-${n}`)), MSBUILDDISABLENODEREUSE: "1", DOTNET_CLI_USE_MSBUILD_SERVER: "0" } : env;
  const r = spawnSync("bash", ["-e", "core/scripts/nuget-look.sh"], { cwd: dir, encoding: "utf8", env: { ...from, BASE: base ? baseSha : "", CONFIG: "checks/licences.json",
    CALLER: `someone/project/.github/workflows/${caller}@refs/pull/1/merge`, GITHUB_REPOSITORY: "someone/project", CORE_AT: "core/", NUGET_PACKAGES: path.join(tmp, `look-packages-${n}`),
    GITHUB_OUTPUT: output, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", EnableWindowsTargeting: "true" } });
  const said = /^run=(.*)$/m.exec(fs.readFileSync(output, "utf8"))?.[1]?.trim();
  return { run: r.status === 0 ? said : undefined, out: `${r.stdout}${r.stderr}` };
}
const restores = (what, ...args) => { const r = gate(...args); ok(r.run === "true", `${what}: it restores`, r.out); return r; };
const skips = (what, ...args) => { const r = gate(...args); ok(r.run === "false", `${what}: no restore`, r.out); };

// the first look, by name
for (const [what, files, opts] of [
  ["one that changes a project file", { "src/App/App.csproj": project().replace("</Project>", "  <!-- a note -->\n</Project>") }],
  ["one that changes a lock file", { "src/App/packages.lock.json": LOCK.replace("\n}\n", "\n}\n\n") }],
  ["one that adds a response file beside a project file, spelt in any case", { "src/App/msbuild.RSP": "-p:RestoreSources=x\n" }],
  ["one that changes a NuGet.Config, spelt in any case", { "NuGet.Config": "<configuration/>\n" }],
  ["one that changes the licence config", { "checks/licences.json": START["checks/licences.json"].replace("[]", "[ ]") }],
  ["one that changes the audit the config names", { "checks/audit.json": '{ "entries": [ ] }\n' }],
  ["one that changes a folder the config names as a source", { "local-packages/a.nupkg": "x" }],
  ["one that adds a tools manifest at a folder's top, which dotnet reads as one in .config/", { "dotnet-tools.json": '{ "version": 1, "isRoot": true, "tools": {} }\n' }],
  ["one that changes the calling workflow, under its own name", { ".github/workflows/restore.yml": "name: restore again\n" }, { caller: "restore.yml" }],
  ["one that changes only a file an Import brings in", { "build/deps.xml": "<Project>\n  <!-- a note -->\n</Project>\n" }],
  ["one that changes only a file an imported file brings in, written with a tab and a reference", { "build/deeper .xml": "<Project>\n  <!-- a note -->\n</Project>\n" }, { start: { "build/deps.xml": '<Project>\n  <Import Project="deeper\t&#46;xml" />\n</Project>\n', "build/deeper .xml": EMPTY } }],
  ["one that changes only a file a property MSBuild's targets import names", { "build/after.xml": "<Project>\n  <!-- a note -->\n</Project>\n" }, { start: { "Directory.Build.props": "<Project>\n  <PropertyGroup>\n    <CustomAfterMicrosoftCommonTargets>$(MSBuildThisFileDirectory)build/after.xml</CustomAfterMicrosoftCommonTargets>\n  </PropertyGroup>\n</Project>\n", "build/after.xml": EMPTY } }],
  ["one that changes only the attributes git writes the checkout by, at the root", { ".gitattributes": "*.xml text\n" }],
  ["one that changes only the attributes git writes the checkout by, in a folder", { "src/App/.gitattributes": "*.xml text\n" }],
  ["a pull request with no base to read it against", { "README.md": "# More\n" }, { base: false }],
]) { const r = restores(what, files, opts); if (what !== "a pull request with no base to read it against") ok(r.out.includes("Changed:"), `${what}: named by the first look`, r.out); }

// the config is read only as a file of the project's own: a tracked link in its place is refused, with its mend
let canLink = true;
try { fs.symlinkSync("nowhere", path.join(tmp, "probe")); } catch { canLink = false; }
if (canLink) {
  const r = gate(dir => { const at = path.join(dir, "checks/licences.json"); fs.writeFileSync(path.join(dir, "checks/real.json"), fs.readFileSync(at)); fs.rmSync(at); fs.symlinkSync("real.json", at); });
  ok(r.run === undefined && r.out.includes("checks/licences.json, the licence check's config, is a link") && mended(r.out), "a tracked link in the config's place is refused, with its mend", r.out);
  const away = path.join(tmp, "away");
  const folder = gate(dir => { fs.cpSync(path.join(dir, "checks"), away, { recursive: true }); fs.rmSync(path.join(dir, "checks"), { recursive: true }); fs.symlinkSync(away, path.join(dir, "checks")); });
  ok(folder.run === undefined && folder.out.includes("checks/licences.json, the licence check's config, stands in a folder outside the project") && mended(folder.out), "a config whose folder a tracked link leads out of the project is refused, with its mend", folder.out);
  const dirAt = gate(dir => { const at = path.join(dir, "checks/licences.json"); fs.rmSync(at); fs.mkdirSync(at); fs.writeFileSync(path.join(at, "x"), "x"); });
  ok(dirAt.run === undefined && dirAt.out.includes("is no regular file (a folder, a device or a pipe)") && mended(dirAt.out), "a folder in the config's place is refused, with its mend", dirAt.out);
}

// the second look, NuGet's own word, where no file the first names changed
if (!sdk) console.log("skip NuGet's own word: no .NET SDK here");
else {
  skips("a pull request that changes only a doc", { "README.md": "# A project\n\nMore.\n" });
  skips("one that changes only another workflow", { ".github/workflows/other.yml": "name: other\n" });
  // (as check.mjs runs it, which hands its steps only the variables it keeps: on Windows NuGet reads the system's and
  // the user's folders from the environment, and a restore with one missing failed with no code of its own; #1239)
  skips("a pull request that changes only a doc, the look run in the environment check.mjs gives its steps", { "README.md": "# A project\n\nMore.\n" }, { steps: true });
  // (a restore that fails with no code of NuGet's prints its error lines whole, so the cause is seen, and none of them
  // is read as a workflow command: neither "::" after leading spaces nor "##[" anywhere; #1239)
  const failing = "a failure of the project's own, with no code, printed whole to its last word";
  const own = restores("a pull request that changes only a doc, in a project whose restore fails with no code of NuGet's", { "README.md": "# A project\n\nMore.\n" },
    { start: { "Directory.Build.targets": `<Project>\n  <Target Name="Fails" BeforeTargets="Restore">\n    <Message Importance="high" Text="::error::two" />\n    <Error Text="${failing} ##[error]one" />\n  </Target>\n</Project>\n` } });
  ok(own.out.includes("src/App/App.csproj: the restore failed with no error NuGet names. It printed:") && new RegExp(`^  \\| .*error.*${failing}`, "m").test(own.out), "and the look prints the restore's error line whole, behind \"  | \"", own.out);
  ok(/error::two/.test(own.out) && !own.out.includes("##[") && !/^\s*::/m.test(own.out), "and none of the lines it prints is read as a workflow command", own.out);
  // (nor does a NuGet call in a step that names no config of its own, as the restore from the lock files does, read a
  // machine-wide config of the caller's, which may name a source with its sign-in: that folder is the step's own; #1239)
  const machine = path.join(tmp, "machine"), work = path.join(tmp, "machine-work");
  for (const d of [path.join(machine, "NuGet", "Config"), work]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(machine, "NuGet", "Config", "planted.config"), '<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n  <packageSources>\n    <add key="planted" value="https://planted.invalid/v3/index.json" />\n  </packageSources>\n</configuration>\n');
  const planted = { ...env, ...Object.fromEntries(["PROGRAMFILES(X86)", "PROGRAMDATA", "NUGET_COMMON_APPLICATION_DATA"].map(k => [Object.keys(env).find(e => e.toUpperCase() === k) ?? k, machine])) };
  const sources = from => spawnSync("dotnet", ["nuget", "list", "source"], { cwd: work, env: from, encoding: "utf8" }).stdout ?? "";
  const given = spawnSync(process.execPath, ["--input-type=module", "-e", `import { stepEnv } from ${JSON.stringify(new URL("../scripts/check.mjs", import.meta.url).href)}; console.log(JSON.stringify(stepEnv(${JSON.stringify(path.join(tmp, "machine-home"))})));`], { env: planted, encoding: "utf8" });
  const read = sources(planted), inStep = given.status === 0 ? sources(JSON.parse(given.stdout)) : given.stderr;
  ok(read.includes("planted") && given.status === 0 && !inStep.includes("planted") && /nuget\.org|No sources/i.test(inStep), "a NuGet call in a step reads no machine-wide config of the caller's, where the caller's own call reads it", `${read}\n${inStep}`);
  // (a NuGet.Config that maps every package to the registry, against a confusion of sources: the empty source the look
  // restores from is mapped to none, which NuGet names as its own error, NU1100, not as a package not found; #380)
  const MAPPED = '<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n  <packageSources>\n    <clear />\n    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />\n  </packageSources>\n  <packageSourceMapping>\n    <packageSource key="nuget.org">\n      <package pattern="*" />\n    </packageSource>\n  </packageSourceMapping>\n</configuration>\n';
  skips("a pull request that changes only a doc, in a project whose NuGet.Config maps its packages to their sources", { "README.md": "# A project\n\nMore.\n" }, { start: { "NuGet.Config": MAPPED } });
  restores("one that adds a package only in an imported file, in such a project", { "build/deps.xml": ADDS }, { start: { "NuGet.Config": MAPPED } });
  restores("one that adds a package only in a file a project file imports", { "build/deps.xml": ADDS });
  restores("one that adds it in the second of two imports on a line", { "build/two.xml": ADDS }, { start: { "src/App/App.csproj": project('  <Import Project="..\\..\\build\\deps.xml" /><Import Project="..\\..\\build\\two.xml" />\n'), "build/two.xml": EMPTY } });
  restores("one that asks for a package by a text file a build file reads, which no listing can name", { "build/flag.txt": "yes\n" }, { start: { "Directory.Build.props": FLAGGED, "build/flag.txt": "no\n" } });
  restores("one that adds it in an imported file whose name is not plain ASCII", { "build/Ünï.xml": ADDS }, { start: { "build/deps.xml": '<Project>\n  <Import Project="Ünï.xml" />\n</Project>\n', "build/Ünï.xml": EMPTY } });
  restores("one that adds a package in an import, where the project's record of its restore lies outside the checkout", { "build/deps.xml": '<Project>\n  <ItemGroup>\n    <PackageDownload Include="Newtonsoft.Json" Version="[12.0.1]" />\n  </ItemGroup>\n</Project>\n' },
    { start: { "Directory.Build.props": `<Project>\n  <PropertyGroup>\n    <BaseIntermediateOutputPath>${path.join(tmp, "elsewhere", String(n + 1)).replace(/\\/g, "/")}/</BaseIntermediateOutputPath>\n  </PropertyGroup>\n</Project>\n` } });
  restores("one that downloads a package beside the lock file, of a name it locks at another version", { "build/deps.xml": '<Project>\n  <ItemGroup>\n    <PackageDownload Include="Newtonsoft.Json" Version="[12.0.1]" />\n  </ItemGroup>\n</Project>\n' });
  let canLink = true;
  try { fs.symlinkSync(path.join(tmp, "nowhere"), path.join(tmp, "probe")); } catch { canLink = false; }
  if (!canLink) console.log("skip the links: this machine lets the test make none");
  else restores("one that points an imported link at a file that adds a package", dir => { fs.rmSync(path.join(dir, "build/link.xml")); fs.symlinkSync("adds.xml", path.join(dir, "build/link.xml")); },
    { start: { "build/deps.xml": '<Project>\n  <Import Project="link.xml" />\n</Project>\n', "build/empty.xml": EMPTY, "build/adds.xml": ADDS }, link: ["build/link.xml", "empty.xml"] });
}

// the whole job, its restore and its check run as GitHub runs them, on a project that holds the core as core/
if (sdk) {
  const FETCH = "Every locked package and tool, fetched before the restore and held to its list";
  // (where the first look itself restored, which it does only where nothing it reads changed from the base, the read
  // before the restore runs all the same, before the check's own restore)
  const bare = project("").replace(/  <ItemGroup>[\s\S]*?<\/ItemGroup>\n/, "");
  // (a text file a build file reads, which only NuGet's own word sees: any project file, whatever brings it in, the first
  // look names by itself)
  const built = whole({ "build/flag.txt": "yes\n" }, { "Directory.Build.props": FLAGGED, "build/flag.txt": "no\n" });
  ok(!built.passed && /NU1004/.test(built.out) && built.ran.includes(FETCH) && built.ran.indexOf(FETCH) < built.ran.indexOf("Restore each project file from its lock file alone") && !built.out.includes("is left out"), "where the first look restored, the read before the restore still runs before the check's restore, and the restore fails what no lock file holds", built.out.slice(-1500));
  const imported = whole({ "build/deps.xml": ADDS }, { "src/App/App.csproj": bare.replace("<PropertyGroup>", '<Import Project="..\\..\\build\\deps.xml" />\n  <PropertyGroup>'), "build/deps.xml": EMPTY });
  ok(!imported.passed && /NU1004/.test(imported.out) && imported.ran.includes(FETCH) && imported.ran.indexOf(FETCH) < imported.ran.indexOf("Restore each project file from its lock file alone") && imported.out.includes("build/deps.xml"), "where only an imported file changed, the first look names it, so the read before the restore runs, and the restore fails what no lock file holds", imported.out.slice(-1500));
  const stale = whole({ "src/App/App.csproj": project("") });
  ok(!stale.passed && /NU1004/.test(stale.out) && /A restore from a lock file failed .*\. Mend: /.test(stale.out) && mended(stale.out), "and where the project asks for a package its lock file does not hold, the restore fails the job", stale.out);
}

// the whole job on a machine without the SDK band the project's global.json pins (a stand-in for dotnet that says so): the
// restore is not run, the machine's fault, and the job says what it lacks with its mend, not that a lock file failed
if (process.platform === "win32") console.log("skip the job without the SDK band: the stand-in for dotnet is a shell script");
else {
  const bin = path.join(tmp, "no-band");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "dotnet"), '#!/bin/sh\necho "A compatible .NET SDK was not found." >&2\necho "Requested SDK version: 1.0.100"\nexit 1\n', { mode: 0o755 });
  const kept = env.PATH;
  env.PATH = `${bin}${path.delimiter}${kept}`;
  const lacked = whole({ "README.md": "# More\n" });
  env.PATH = kept;
  ok(!lacked.passed && lacked.out.includes("The restores could not run: this machine has no .NET SDK that the global.json here accepts") && /could not run here, since this machine lacks the \.NET SDK band the global\.json names: Restore each project file from its lock file alone\. Mend: /.test(lacked.out) && mended(lacked.out) && !lacked.out.includes("A restore from a lock file failed"),
    "a machine without the SDK band global.json pins leaves the restore not run, saying what it lacks with its mend, and no lock file is said to have failed", lacked.out.slice(-1500));
}

// a changed file whose name holds "##[" is listed broken, behind its dash
{
  const r = gate({ "src/##[group]x/App.csproj": project() });
  ok(r.run === "true" && r.out.includes("- src/# #[group]x/App.csproj") && !r.out.includes("##["), "a changed file whose name holds \"##[\" is listed with it broken", r.out);
}

// the second look, where the copy of the core stands at another path than core/ (#918): the restore's own records are read
// outside the copy, at the path the caller gives (CORE_AT), whatever the copy holds. A stand-in for dotnet writes one for
// the project and, inside the copy, one that downloads a package beside a lock file, which only a look that reads the
// copy as a project's own file reports (the SDK's own word is tried above, where there is one).
if (process.platform === "win32") console.log("skip the copy at another path: the stand-in for dotnet is a shell script");
else {
  const standIn = path.join(tmp, "stand-in");
  fs.mkdirSync(standIn);
  fs.writeFileSync(path.join(standIn, "dotnet"), `#!/bin/sh
for a; do last=$a; done
dir=$(dirname "$last")
mkdir -p "$dir/obj" "$COPY/obj"
printf '{"project":{"restore":{"projectPath":"%s/%s"},"frameworks":{}}}' "$PWD" "\${last#./}" > "$dir/obj/project.assets.json"
printf '{"project":{"restore":{"projectPath":"%s/%sx.csproj"},"frameworks":{"x":{"downloadDependencies":[{"name":"Beside.Lock"}]}}}}' "$PWD" "$COPY" > "$COPY/obj/project.assets.json"
`, { mode: 0o755 });
  const atCopy = (copy, at, bin = standIn, files = {}) => {
    const dir = path.join(tmp, `copy-${++n}`);
    fs.mkdirSync(dir);
    git(dir, "init", "-q", "-b", "main");
    for (const [f, text] of Object.entries({ ...START, ...files, "core-manifest.md": `# Core manifest\n\nCore: ${CORE} at ${"a".repeat(40)}, copied whole under ${copy} (never edited here).\n` })) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
    fs.cpSync(path.join(root, "scripts"), path.join(dir, copy, "scripts"), { recursive: true });
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "base");
    const baseSha = git(dir, "rev-parse", "HEAD");
    fs.writeFileSync(path.join(dir, "README.md"), "# A project\n\nMore.\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "a change");
    const output = path.join(tmp, `look-${n}`);
    fs.writeFileSync(output, "");
    const r = spawnSync("bash", ["-e", `${copy}scripts/nuget-look.sh`], { cwd: dir, encoding: "utf8", env: { ...env, PATH: `${bin}${path.delimiter}${env.PATH}`, COPY: at, BASE: baseSha, CONFIG: "checks/licences.json",
      CALLER: "someone/project/.github/workflows/restore.yml@refs/pull/1/merge", GITHUB_REPOSITORY: "someone/project", CORE_AT: copy, NUGET_PACKAGES: path.join(tmp, `look-packages-${n}`), GITHUB_OUTPUT: output } });
    return { run: r.status === 0 ? /^run=(.*)$/m.exec(fs.readFileSync(output, "utf8"))?.[1]?.trim() : undefined, out: `${r.stdout}${r.stderr}` };
  };
  const vendor = atCopy("vendor/core/", "vendor/core/"), deeper = atCopy("third_party/the-core/", "third_party/the-core/"), usual = atCopy("core/", "core/");
  ok(vendor.run === "false" && deeper.run === "false" && usual.run === "false", "the restore's records inside the copy of the core, at core/ or at the path the caller gives, are no project's own: the look says no restore", [vendor, deeper, usual].map(r => r.out).join("\n"));
  const elsewhere = atCopy("vendor/core/", "vendor/other/");
  ok(elsewhere.run === "true", "and a record in a folder that is not the copy still makes it run", elsewhere.out);

  // a project file whose path starts with "::" or holds "##[" is named broken in each failure line, as NuGet's own output
  // is: a stand-in for dotnet whose restore fails, with no error named and with one NuGet names
  const failing = said => { const bin = path.join(tmp, `fails-${++n}`); fs.mkdirSync(bin); fs.writeFileSync(path.join(bin, "dotnet"), `#!/bin/sh\n${said}\nexit 1\n`, { mode: 0o755 }); return bin; };
  const unnamed = atCopy("core/", "core/", failing(""), { "::error::x/App.csproj": project() }).out, coded = atCopy("core/", "core/", failing('echo "error NU1004: the lock file"'), { "src/##[group]x/App.csproj": project() }).out;
  ok(unnamed.includes(": :error: :x/App.csproj: the restore failed with no error NuGet names") && !/^\s*::/m.test(unnamed), "a project file's path that starts with \"::\" is broken where the restore fails with no error named", unnamed);
  ok(coded.includes("src/# #[group]x/App.csproj: error NU1004") && !coded.includes("##["), "and one that holds \"##[\" is broken where it fails with an error NuGet names", coded);
  // (a machine without the SDK band the project's global.json pins: the failure says it is the machine's, with its mend, not
  // that the restore failed with no error named)
  const noBand = atCopy("core/", "core/", failing('echo "A compatible .NET SDK was not found." >&2; echo "Requested SDK version: 8.0.100"'), { "App.csproj": project() }).out;
  ok(/App\.csproj: no restore ran, since this machine has no \.NET SDK that the project's global\.json accepts: the machine's fault, not the change's\. Mend: install the SDK band/.test(noBand) && !noBand.includes("the restore failed with no error"), "a restore that fails for want of the SDK band global.json pins says it is the machine's fault, with its mend", noBand);
  // (and where only letters beyond ASCII stand between a pair's marks: in the project's path and in what dotnet printed;
  // #1348)
  const pair = /:[^\u0000-\u007f]*:|#[^\u0000-\u007f]*#[^\u0000-\u007f]*\[/u;
  const beyond = atCopy("core/", "core/", failing('echo "the restore of #\u00e9#[group]y stopped"'), { "src/:\u00e9:a#\u00e9#[group]x/App.csproj": project() }).out;
  ok(beyond.includes("src/: \u00e9:a# \u00e9#[group]x/App.csproj: the restore failed with no error NuGet names") && beyond.includes("  | the restore of # \u00e9#[group]y stopped") && !pair.test(beyond),
    "and a letter beyond ASCII between a pair's marks breaks nothing: the path and dotnet's lines are shown with each pair broken", beyond);
}

done("the NuGet check's own steps");
