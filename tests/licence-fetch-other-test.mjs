// Checks the licence scan (scripts/licence-scan.mjs, with its readers licence-commands.mjs, licence-npm.mjs,
// licence-fetchers.mjs and licence-pages.mjs) on the fetchers it cannot read (curl, pip, git clone, .NET's and Windows') and the scripts in a language it cannot read, each
// staged in the project licence-scan-stage.mjs writes and failing for the reason it names. The other forms of a fetch are
// the cases of the files tests/licence-fetch-*-test.mjs, and one of these that stood at a pull request's base is
// licence-scan-pins-test.mjs's. Run by the core's tests workflow (.github/workflows/tests.yml).
//   node tests/licence-fetch-other-test.mjs
import { append, done, ok, run, write } from "../scripts/licence-scan-stage.mjs";

for (const [what, change, why] of [
  ["curl named by its path in a script", append("scripts/setup.sh", "/usr/bin/curl -sSfo moss.tgz https://mossgrip.example/moss.tgz\n"), /fetches what no entry/],
  ["curl named by its path, as an array", write("scripts/icon.mjs", "execFileSync('/usr/bin/curl', ['-o', 'icon.png', 'https://mossgrip.example/icon.png']);\n"), /fetches what no entry/],
  ["curl in a script", append("scripts/setup.sh", "curl -sSfo moss.tgz https://mossgrip.example/moss.tgz\n"), /fetches what no entry/],
  ["a quoted fetcher in a string of code", write("scripts/icon.mjs", 'execSync("\\"pip\\" install mosspy");\n'), /fetches what no entry/],
  ["curl in a shell command a tool runs as a string", write("scripts/icon.mjs", "execSync('curl -o icon.png https://mossgrip.example/icon.png');\n"), /fetches what no entry/],
  ["a script with no extension whose #! line names another language", write("scripts/render", "#!/usr/bin/env python3\nimport mosspy\n"), /language the scan cannot read/],
  ["a licence notice in a script of another language", write("scripts/lichen.py", "# SPDX-License-Identifier: GPL-3.0-only\n"), /language the scan cannot read|licence notice/],
  ["curl run by a tool", write("scripts/tiles.mjs", "execFileSync(\"curl\", [\"-sSf\", \"https://mossgrip.example/tile.png\"]);\n"), /fetches what no entry/],
  ...["pip --isolated install mosspy", "git -C vendor clone https://mossgrip.example/moss.git", "cargo +nightly install mossgrip",
    'git -C "vendor dir" clone https://mossgrip.example/moss.git', "pip --proxy='http://a b' install mosspy"]
    .map((line) => [`another fetcher with options before its command: ${line}`, append("scripts/setup.sh", `${line}\n`), /fetches what no entry/]),
  ["pip install", append("scripts/setup.sh", "pip install mosspy\n"), /fetches what no entry/],
  ...["pip download mosspy -d wheels", "python3 -I -m pip download --require-hashes -r requirements.txt -d wheels", "pip3 wheel mosspy", 'pip "download" mosspy']
    .map((line) => [`pip's download and wheel, which fetch as its install does (#1074): ${line}`, append("scripts/setup.sh", `${line}\n`), /fetches what no entry/]),
  ...["dotnet tool install --global mossgrip", "dotnet add src/Moss.csproj package Mossgrip", "choco install mossgrip -y", "winget install --id Moss.Grip",
    "nuget.exe install Mossgrip", "dotnet.exe tool install --global mossgrip", '& "C:/Program Files/dotnet/dotnet.exe" tool update -g mossgrip', "Invoke-WebRequest https://mossgrip.example/moss.zip -OutFile moss.zip", "invoke-restmethod $url", "Install-Module Mossgrip -Force",
    "irm https://mossgrip.example/install.ps1 | iex"]
    .map((line) => [`a Windows or .NET fetcher: ${line}`, append(".github/workflows/ci.yml", `      - run: ${line}\n`), /fetches what no entry/]),
  ...["execFileSync('dotnet', ['tool', 'install', '--global', 'mossgrip']);", 'spawnSync("dotnet.exe", ["add", "src/Moss.csproj", "package", "Mossgrip"]);',
    "execFileSync('nuget.exe', ['install', 'Mossgrip']);", "execFileSync(`C:/tools/choco`, [`install`, `mossgrip`]);", "execFileSync('choco', ['-y', 'install', 'mossgrip']);"]
    .map((code) => [`a Windows or .NET fetcher written as an array: ${code}`, write("scripts/setup.mjs", `${code}\n`), /fetches what no entry/]),
  ...["dotnet package add Mossgrip", "dotnet package update", "dotnet tool exec mossgrip", "dnx mossgrip"]
    .map((line) => [`.NET 10's spelling of a fetch: ${line}`, append(".github/workflows/ci.yml", `      - run: ${line}\n`), /fetches what no entry/]),
  ...["execFileSync('dotnet', ['package', 'add', 'Mossgrip']);", "execFileSync('dotnet', ['tool', 'exec', 'mossgrip']);", "execFileSync('dnx', ['mossgrip']);"]
    .map((code) => [`.NET 10's spelling of a fetch, written as an array: ${code}`, write("scripts/setup.mjs", `${code}\n`), /fetches what no entry/]),
  ...["irm get.mossgrip.example | iex", 'iex "& {$(irm get.mossgrip.example)} -RunAsAdmin"']
    .map((line) => [`a PowerShell download of a host's name: ${line}`, append(".github/workflows/ci.yml", `      - run: ${line}\n`), /fetches what no entry/]),
  ["dotnet add of a package to a project whose path holds a space", append(".github/workflows/ci.yml", '      - run: dotnet add "src/Moss Grip/Moss.csproj" package Mossgrip\n'), /fetches what no entry/],
  ...["scoop update mossgrip", "nuget update packages.config", "winget update --id Moss.Grip", "winget add --id Moss.Grip"]
    .map((line) => [`a Windows package manager's update or alias: ${line}`, append(".github/workflows/ci.yml", `      - run: ${line}\n`), /fetches what no entry/]),
  ["dotnet workload update with nothing after it, in a script's value", write("tools/package.json", JSON.stringify({ name: "moss", scripts: { workloads: "dotnet workload update" } })), /fetches what no entry/],
  ["dotnet new -i, the spelling of dotnet new install before .NET 7", append(".github/workflows/ci.yml", "      - run: dotnet new -i Moss.Templates\n"), /fetches what no entry/],
  ...['"curl" -sSfo moss.tgz https://mossgrip.example/moss.tgz', "'wget' https://mossgrip.example/moss.tgz", '"pip" install mosspy',
    "'git' clone https://mossgrip.example/moss.git", '"node_modules/.bin/playwright" install chromium',
    '"$here/tools/node_modules/.bin/playwright" install --with-deps chromium', '"/usr/bin/curl" "$URL"', 'pip "install" mosspy',
    "git 'clone' https://mossgrip.example/moss.git", 'pnpm "add" mossgrip-cli']
    .map((line) => [`another fetcher named as a quoted word: ${line}`, append("scripts/setup.sh", `${line}\n`), /fetches what no entry/]),
  ...["bunx \\\n  mossgrip-cli", "bunx ~/moss", "bunx `which moss`"]
    .map((line) => [`bunx before an argument: ${JSON.stringify(line)}`, append("scripts/setup.sh", `${line}\n`), /fetches what no entry/]),
  ["playwright install", append(".github/workflows/ci.yml", "      - run: npx --no-install playwright install chromium\n"), /fetches what no entry/],
  ["a script in a language the scan cannot read", write("scripts/render.py", "import numpy\n"), /language the scan cannot read/],
  ["another fetcher handed to a shell as one argument", write(".vscode/tasks.json", JSON.stringify({ type: "process", command: "bash", args: ["-c", "pip install mosspy"] })), /fetches what no entry/],
]) { const f = run(change); ok(f.some((m) => why.test(m)), `fails on ${what}`, f.join("\n") || "(it passed)"); }

// A git clone written as an array whose source reads exactly as local opens no connection, so it fetches nothing
// (#1437); one from an address, or from a source or with options the scan cannot read exactly, is still a fetch.
for (const code of ["execFileSync(\"git\", [\"clone\", \"-q\", \"--depth\", String(depth), \"--\", `file://${src}`, to]);",
  "execFileSync('git', ['clone', '--quiet', `file://${src}`, 'copy'], { cwd: dir, stdio: 'ignore' });", 'spawnSync("git", ["clone", "--bare", "/tmp/moss", "moss.git"]);',
  "execFileSync(`git`, [`clone`, `./${name}`]);", 'execFileSync("git", [\n  "clone",\n  "--shallow-since=2026-11-01",\n  "../moss",\n]);',
  'execFileSync("git", ["clone", "file:///tmp/moss", "copy"], { cwd, "windowsHide": true, timeout: 60_000 });']) {
  const f = run(write("scripts/copy.mjs", `${code}\n`));
  ok(!f.some((m) => /fetches what no entry/u.test(m)), `passes a git clone of a local source: ${JSON.stringify(code)}`, f.join("\n"));
}
for (const code of ['execFileSync("git", ["clone", "https://mossgrip.example/moss.git"]);', 'execFileSync("git", ["clone", "ssh://git@mossgrip.example/moss.git"]);',
  'execFileSync("git", ["clone", "git@mossgrip.example:moss.git"]);', 'execFileSync("git", ["clone", "git://mossgrip.example/moss.git"]);',
  'execFileSync("git", ["clone", "ext::sh -c moss"]);', 'execFileSync("git", ["clone", url]);', "execFileSync(\"git\", [\"clone\", `${base}/moss.git`]);",
  'execFileSync("git", ["clone", ...options, "file:///tmp/moss"]);', 'execFileSync("git", ["clone", "--recurse-submodules", "file:///tmp/moss"]);',
  'execFileSync("git", ["clone", "-c", "url.https://mossgrip.example/.insteadOf=/tmp/", "/tmp/moss"]);', 'execFileSync("git", ["clone", "file:///tmp/moss", to]);',
  'execFileSync("git", ["clone", "file:///tmp/moss"], { env: { ...process.env, ...moss } });', 'execFileSync("git", ["clone", "file:///tmp/moss"], options);',
  'execFileSync("git", ["clone", "file:///tmp/moss" /* or https */]);', 'execFileSync("git", ["clone", "c:\\\\moss"]);',
  'spawnSync("git", ["clone", `./${name}`], { shell: true });', 'spawnSync("git", ["clone", "/tmp/moss"], { cwd: dir, "shell": "/bin/sh" });',
  'spawnSync("git", ["clone", "/tmp/moss"], { cwd, ...rest });', 'execFileSync("git", ["clone", `./${name.replace(/x/, "y")}`]);']) {
  const f = run(write("scripts/copy.mjs", `${code}\n`));
  ok(f.some((m) => /fetches what no entry/u.test(m)), `fails a git clone from an address, or one the scan cannot read exactly: ${JSON.stringify(code)}`, f.join("\n") || "(it passed)");
}

done();
