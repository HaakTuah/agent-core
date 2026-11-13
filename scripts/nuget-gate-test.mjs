// Checks the first step of the NuGet check (.github/workflows/nuget.yml, "Does the pull request change what NuGet
// reads?"), run as GitHub runs it (workflow-run.mjs, beside this file), on scratch pull requests of a .NET project:
// it says to restore wherever the pull request changes anything NuGet reads, a file a project file imports under a name
// of its own included, followed through what that file imports, and wherever it is in doubt; and not to where only
// other files change. On Linux and on Windows. Git, bash, jq and Node's own modules.
//
//   node scripts/nuget-gate-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runWorkflow } from "./workflow-run.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 800).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/nuget.yml"), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nuget-gate-test-"));
process.on("exit", () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* (left to the system's own cleaning) */ } });
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(GIT_|GITHUB_|RUNNER_|ACTIONS_|CI$)/i.test(name)));
Object.assign(env, { GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" });
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const PROJECT = '<Project Sdk="Microsoft.NET.Sdk">\n  <Import Project="..\\..\\build\\deps.xml" />\n  <PropertyGroup>\n    <TargetFramework>net9.0</TargetFramework>\n  </PropertyGroup>\n</Project>\n';
const START = {
  "README.md": "# A project\n",
  "src/App/App.csproj": PROJECT,
  "src/App/packages.lock.json": '{ "version": 1, "dependencies": { "net9.0": {} } }\n',
  "build/deps.xml": '<Project>\n  <Import Project="more.xml" Condition="true" />\n</Project>\n',
  "build/more.xml": "<Project>\n</Project>\n",
  "checks/licences.json": '{ "audit": "checks/audit.json", "nuget": { "ships": ["src/App/packages.lock.json"], "tools": [], "sources": ["https://example.invalid/v3/index.json", "local-packages/"] } }\n',
  "checks/audit.json": '{ "entries": [] }\n',
  "local-packages/readme.txt": "packages\n",
  ".github/workflows/nuget.yml": "name: nuget\n",
  ".github/workflows/restore.yml": "name: restore\n",
};
let n = 0;
// The step's answer on a pull request that changes `files` (null removes one) from a project that starts as `start`.
function gate(files, { start = {}, base = true, caller = "nuget.yml", link = null } = {}) {
  const dir = path.join(tmp, `repo-${++n}`);
  fs.mkdirSync(dir);
  git(dir, "init", "-q", "-b", "main");
  const put = set => { for (const [f, text] of Object.entries(set)) { const at = path.join(dir, f); if (text === null) fs.rmSync(at); else { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); } } };
  put({ ...START, ...start });
  if (link) fs.symlinkSync(link[1], path.join(dir, link[0]));
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  const baseSha = git(dir, "rev-parse", "HEAD");
  put(files);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "-m", "a change");
  const github = { event_name: "pull_request", repository: "someone/project", workflow_ref: `someone/project/.github/workflows/${caller}@refs/pull/1/merge`,
    event: { pull_request: { base: { sha: base ? baseSha : "" } } } };
  const [job] = runWorkflow(workflow, { inputs: { config: "checks/licences.json" }, github, base: env, workspace: () => dir, uses: { "actions/checkout": () => {} }, until: "what", temp: tmp });
  const step = job.steps.find(s => s.name === "Does the pull request change what NuGet reads?");
  return { run: job.outputs.what?.outputs.run, out: step?.out ?? JSON.stringify(job.steps) };
}
const restores = (what, ...args) => { const r = gate(...args); ok(r.run === "true", `${what}: it restores`, r.out); };
const skips = (what, ...args) => { const r = gate(...args); ok(r.run === "false", `${what}: no restore`, r.out); };

skips("a pull request that changes only a doc", { "README.md": "# A project\n\nMore.\n" });
restores("one that changes a project file", { "src/App/App.csproj": PROJECT.replace("</Project>", "  <!-- a note -->\n</Project>") });
restores("one that changes a lock file", { "src/App/packages.lock.json": '{ "version": 1, "dependencies": { "net9.0": { } } }\n' });
restores("one that changes only a file a project file imports, under a name of its own", { "build/deps.xml": '<Project>\n  <Import Project="more.xml" />\n  <ItemGroup><PackageReference Include="A" Version="1.0.0" /></ItemGroup>\n</Project>\n' });
restores("one that changes only a file that an imported file imports", { "build/more.xml": '<Project>\n  <ItemGroup><PackageReference Include="A" Version="1.0.0" /></ItemGroup>\n</Project>\n' });
restores("one that changes a shared project's items", { "src/Shared/Shared.projitems": "<Project>\n</Project>\n" }, { start: { "src/Shared/Shared.projitems": "<Project/>\n" } });
restores("one that changes a NuGet.Config, spelt in any case", { "NuGet.Config": "<configuration/>\n" });
restores("one that adds a response file beside a project file, spelt in any case", { "src/App/msbuild.RSP": "-p:RestoreSources=x\n" });
restores("one that changes the licence config", { "checks/licences.json": START["checks/licences.json"].replace("[]", "[ ]") });
restores("one that changes the audit the config names", { "checks/audit.json": '{ "entries": [ ] }\n' });
restores("one that changes a folder the config names as a source", { "local-packages/a.nupkg": "x" });
restores("one that changes the calling workflow, under its own name", { ".github/workflows/restore.yml": "name: restore again\n" }, { caller: "restore.yml" });
skips("one that changes another workflow", { ".github/workflows/other.yml": "name: other\n" });
restores("a doc's change where an import is made of a property", { "README.md": "# More\n" }, { start: { "build/more.xml": '<Project>\n  <Import Project="$(MSBuildThisFileDirectory)x.props" />\n</Project>\n' } });
restores("a doc's change where an import leads outside the repository", { "README.md": "# More\n" }, { start: { "build/more.xml": '<Project>\n  <Import Project="..\\..\\..\\outside.props" />\n</Project>\n' } });
restores("a doc's change where an import's path stands on another line", { "README.md": "# More\n" }, { start: { "build/more.xml": '<Project>\n  <Import\n    Project="x.props" />\n</Project>\n' } });
restores("a pull request with no base to read it against", { "README.md": "# More\n" }, { base: false });
let canLink = true;
try { fs.symlinkSync(path.join(tmp, "nowhere"), path.join(tmp, "probe")); } catch { canLink = false; }
if (canLink) restores("a doc's change where a listed file is a link", { "README.md": "# More\n" }, { link: ["Directory.Build.props", "README.md"] });
else console.log("skip the link: this machine lets the test make none");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the NuGet check's first step`);
process.exitCode = failed ? 1 : 0;
