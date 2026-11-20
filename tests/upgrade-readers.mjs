// The readers of a project's set-up, read against the tools that define what they read (#629; #593, point 9), on a
// project the upgrade test has synced (upgrade-test.mjs, which calls this): git, for the kinds of file a project holds
// (project(), steps.mjs); bash, for how a workflow's `run:` names a check's config (configs(), check-configs.mjs); and,
// of the NuGet project, the .NET SDK, for the build files a build reads (importsOf, nuget.mjs, which is the NuGet
// check's reader too). A clone of the project after the sync, held as the project is (core.autocrlf, core.fileMode),
// is given what the readers would otherwise meet nowhere here: a file of each kind git holds (a link of each kind, a
// submodule, a file to run), a workflow of its own that runs the checks in several of bash's forms, and build files
// that Import one another. The host's settings (private or not, a path filter's match, a runner's default shell) are
// not compared: the upgrade test's API is a stand-in. Node's own modules, git, bash, and the .NET SDK where there is one.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { configs, copyAt } from "../scripts/check-configs.mjs";
import { importsOf, projectFilesByContent, readProject } from "../scripts/nuget.mjs";
import { project } from "../scripts/steps.mjs";
import { runWorkflow } from "../scripts/workflow-run.mjs";

const lf = text => text.replace(/\r\n/g, "\n");
const slash = f => f.split(path.sep).join("/");
const write = (dir, to, text) => { fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true }); fs.writeFileSync(path.join(dir, to), text); };
// (a path from `home`, with "/", or null where it leads out of it)
const within = (home, to) => { const rel = path.relative(home, to); return !rel || rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel) ? null : slash(rel); };

/**
 * Each reader against its tool, on a clone of the synced project `p` ({ name, dir }) in `tmp`: `ok` takes each
 * comparison; `env` is the environment the test's programs are given, `sdk` whether the .NET SDK is here and `sdkEnv`
 * what it runs with.
 */
export function readersAgainstTools(p, { tmp, env, ok, sdk, sdkEnv }) {
  const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();
  const held = key => { try { return git(p.dir, "config", "--get", key); } catch { return ""; } };
  const dir = path.join(tmp, `${p.name}-kinds`);
  git(tmp, "clone", "-q", ...["core.autocrlf", "core.fileMode"].flatMap(k => held(k) ? ["-c", `${k}=${held(k)}`] : []), "--branch", "main", p.dir, dir);
  const dotnet = fs.existsSync(path.join(dir, "src/App/App.csproj"));
  kinds(dir, git, tmp);
  ownWorkflow(dir);
  if (dotnet) buildFiles(dir);
  git(dir, "add", "-A");
  againstGit(p, dir, git, ok);
  againstBash(p, dir, { tmp, env, ok });
  if (dotnet && sdk) againstSdk(p, dir, { tmp, env: { ...env, ...sdkEnv }, ok });
  else if (dotnet) console.log(`note ${p.name}: no .NET SDK here, so its build files are not read against the SDK's`);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---- git: each entry of the index, read as git holds it ----

// A file of each kind git holds, beside the project's own: text with both line ends, a file to run, a link of each kind
// (to a file of the project's, to a link, to a file git ignores, out of the project, by an absolute path inside it, to
// nothing, to a folder), each written by git as it writes a link on this machine, and a submodule with a file of its own.
function kinds(dir, git, tmp) {
  write(dir, "kinds/text.txt", "a line\r\nanother\nthe last\r\n");
  write(dir, "kinds/run.sh", "#!/bin/sh\necho run\n");
  write(dir, "dist/ignored.txt", "a file git ignores\n");
  const outside = path.join(tmp, "outside-the-project.txt");
  fs.writeFileSync(outside, "a file of no project's\n");
  const home = fs.realpathSync(dir);
  git(dir, "add", "kinds/text.txt", "kinds/run.sh");
  git(dir, "update-index", "--chmod=+x", "kinds/run.sh");
  const links = { "kinds/to-text": "text.txt", "kinds/to-link": "to-text", "kinds/to-ignored": "../dist/ignored.txt", "kinds/to-outside": slash(path.relative(path.join(home, "kinds"), outside)),
    "kinds/to-absolute": slash(path.join(home, "kinds/text.txt")), "kinds/to-nothing": "nothing-here.txt", "kinds/to-folder": "." };
  for (const [link, target] of Object.entries(links)) {
    const oid = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: dir, input: target, encoding: "utf8" }).trim();
    git(dir, "update-index", "--add", "--cacheinfo", `120000,${oid},${link}`);
  }
  git(dir, "checkout", "--", ...Object.keys(links));
  const sub = path.join(dir, "third-party/library");
  fs.mkdirSync(sub, { recursive: true });
  git(sub, "init", "-q");
  write(sub, "inner.txt", "a file of the submodule's\n");
  git(sub, "add", "-A");
  git(sub, "-c", "user.name=someone", "-c", "user.email=someone@example.invalid", "commit", "-q", "-m", "the library");
}

// Each entry `git ls-files -s` lists, read by project() as git holds it: a file (100644, 100755) as `git show :<path>`
// gives it, its CRLF made LF; a link (120000) as its target's text where git lists the target inside the project, else
// as missing, and as its own text where git wrote it as a file (core.symlinks false); a submodule (160000) as missing,
// and the files in it too.
function againstGit(p, dir, git, ok) {
  const entries = new Map(git(dir, "ls-files", "-s", "-z").split("\0").filter(Boolean).map(l => {
    const [, mode, oid, f] = /^(\d+) ([0-9a-f]+) \d+\t([\s\S]+)$/.exec(l);
    return [f, { mode, oid }];
  }));
  const blobs = blobTexts(dir, [...entries.values()].filter(e => e.mode !== "160000").map(e => e.oid));
  const home = fs.realpathSync(dir);
  const expected = (f, hops = 0) => {
    const e = entries.get(f);
    if (!e || e.mode === "160000") return null;
    if (e.mode !== "120000" || !fs.lstatSync(path.join(dir, f)).isSymbolicLink()) return lf(blobs.get(e.oid));
    if (hops > 40) return null;
    const target = blobs.get(e.oid);
    return (at => at === null ? null : expected(at, hops + 1))(within(home, path.resolve(path.dirname(path.join(home, f)), target)));
  };
  const read = project(dir);
  const wrong = [...entries.keys(), "third-party/library/inner.txt"].filter(f => read.read(f) !== expected(f));
  const modes = new Set([...entries.values()].map(e => e.mode));
  ok(["100644", "120000", "160000"].every(m => modes.has(m)) && entries.get("third-party/library")?.mode === "160000" && entries.get("kinds/to-text")?.mode === "120000",
    `${p.name}: its clone holds a file, a link of each kind and a submodule, as git lists them`, [...modes].join(", "));
  ok(!wrong.length, `${p.name}: project() reads each of the ${entries.size} entries git lists as git holds it: a file as its blob, a link as its target where git lists it, a submodule as missing`,
    wrong.slice(0, 10).map(f => `${f} (${entries.get(f)?.mode ?? "in the submodule"}): read ${JSON.stringify(read.read(f)?.slice(0, 60) ?? null)}, git ${JSON.stringify(expected(f)?.slice(0, 60) ?? null)}`).join("\n"));
}

// The text of each blob, by its object id, in one call of git's.
function blobTexts(dir, oids) {
  const unique = [...new Set(oids)], out = new Map();
  const bytes = execFileSync("git", ["cat-file", "--batch"], { cwd: dir, input: unique.map(o => `${o}\n`).join(""), maxBuffer: 1 << 30 });
  for (let at = 0, k = 0; k < unique.length; k++) {
    const nl = bytes.indexOf(10, at), [oid, , size] = bytes.subarray(at, nl).toString("utf8").split(" ");
    out.set(oid, bytes.subarray(nl + 1, nl + 1 + Number(size)).toString("utf8"));
    at = nl + 1 + Number(size) + 1;
  }
  return out;
}

// ---- bash: where a workflow's run of a check names its config ----

// A workflow of the project's own that runs each check whose config the reader reads, in several of bash's forms (a
// path with "./" and quotes, a variable set before it and an option of node's, a line continued, a step in another
// folder, a command string given to bash, the workspace by GitHub's expression and by bash's variable), each naming the
// file the project's calls to the core's workflows name, so that every source agrees.
function ownWorkflow(dir) {
  write(dir, ".github/workflows/own-checks.yml", ["name: own checks", "", "on:", "  pull_request:", "", "jobs:", "  checks:", "    runs-on: ubuntu-latest", "    steps:",
    "      - run: node core/scripts/copies.mjs checks/copies.json",
    "      - run: |", "          node \"./core/scripts/licences.mjs\" 'checks/licences.json'", "          if true; then CI=1 node --no-warnings core/scripts/agent-tools.mjs \\", "            checks/licences.json; fi",
    "      - working-directory: checks", "        run: node ../core/scripts/reading-size.mjs sizes.json",
    "      - run: bash -c 'node \"$GITHUB_WORKSPACE/core/scripts/nuget.mjs\" --packages .nuget/packages checks/licences.json'",
    "      - run: node \"${{ github.workspace }}/core/scripts/copies.mjs\" --first checks/copies.json", ""].join("\n"));
}

// Which of configs()' files each script's config is, and how the script picks it from its arguments (its own code):
// the reading-size check its first; the NuGet check the first not "--", past the value of its --packages; any other
// the first not "--".
const CHECKED = { "copies.mjs": "copies", "licences.mjs": "licences", "agent-tools.mjs": "licences", "nuget.mjs": "nuget", "reading-size.mjs": "sizes" };
const picked = (name, args) => name === "reading-size.mjs" ? args[0]
  : args.find((a, i) => !a.startsWith("--") && !(name === "nuget.mjs" && args[i - 1] === "--packages"));

// The workflow run by bash as GitHub runs it, with a `node` first on its PATH that logs the folder it runs in and its
// arguments; each run of a check's script names, as the script picks it, the file configs() gives for that check.
function againstBash(p, dir, { tmp, env, ok }) {
  const bin = path.join(tmp, `${p.name}-logging-node`), log = path.join(tmp, `${p.name}-node-log`);
  write(bin, "node", "#!/usr/bin/env bash\n{ pwd -W 2>/dev/null || pwd; for a in \"$@\"; do printf '%s\\n' \"$a\"; done; printf '\\036\\n'; } >> \"$NODE_LOG\"\n");
  fs.chmodSync(path.join(bin, "node"), 0o755);
  fs.rmSync(log, { force: true });
  const key = Object.keys(env).find(k => k.toUpperCase() === "PATH") ?? "PATH";
  const results = runWorkflow(fs.readFileSync(path.join(dir, ".github/workflows/own-checks.yml"), "utf8"), {
    github: { event_name: "pull_request", repository: `someone-else/${p.name}`, workspace: dir }, base: { ...env, [key]: `${bin}${path.delimiter}${env[key]}`, NODE_LOG: log },
    workspace: () => dir, uses: {}, temp: tmp });
  const failedSteps = results.flatMap(r => r.steps.filter(s => !s.passed).map(s => `${s.name}: ${s.out}`));
  const home = fs.realpathSync(dir), copy = copyAt(project(dir));
  const runs = (fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "").split("\x1e\n").filter(Boolean).map(record => {
    const [cwd, ...args] = record.replace(/\n$/, "").split("\n");
    const at = args.findIndex(a => !a.startsWith("-")), script = within(home, fs.realpathSync(path.resolve(fs.realpathSync(cwd), args[at])));
    const name = path.posix.basename(script ?? ""), config = picked(name, args.slice(at + 1));
    return { script, name, config: config === undefined ? null : within(home, path.resolve(fs.realpathSync(cwd), config)) };
  });
  const read = configs(project(dir));
  const wrong = runs.filter(r => r.script !== `${copy}scripts/${r.name}` || !CHECKED[r.name] || read[CHECKED[r.name]] !== r.config);
  ok(!failedSteps.length && runs.length === 6, `${p.name}: bash runs each of the 6 runs of a check its own workflow holds`, `${failedSteps.join("\n")}\n${JSON.stringify(runs)}`);
  ok(!read.unread.length && !wrong.length, `${p.name}: configs() names, for each check, the file bash gives its script (${[...new Set(runs.map(r => r.name))].join(", ")})`,
    `${read.unread.join("\n")}\n${wrong.map(r => `${r.script} ${r.config}: configs() gives ${read[CHECKED[r.name]]}`).join("\n")}`);
}

// ---- the .NET SDK: the build files a build of the project reads ----

// Build files that Import one another: the folder's own, which the SDK imports by itself, one by a path from it, of
// a name no build file has, and one by $(MSBuildThisFileDirectory), of such a name too: a file of a build file's name
// importsOf reads whoever imports it.
function buildFiles(dir) {
  write(dir, "Directory.Build.props", '<Project>\r\n  <Import Project="build/shared.xml" />\r\n  <Import Project="$(MSBuildThisFileDirectory)build/this-folder.xml" />\r\n</Project>\r\n');
  write(dir, "Directory.Build.targets", "<Project />\r\n");
  write(dir, "build/shared.xml", "<Project>\r\n  <PropertyGroup>\r\n    <Shared>true</Shared>\r\n  </PropertyGroup>\r\n</Project>\r\n");
  write(dir, "build/this-folder.xml", "<Project />\r\n");
}

// The project's own files that `dotnet msbuild -pp` of each of its project files names (those git lists, outside the
// copy), against those importsOf reads.
function againstSdk(p, dir, { tmp, env, ok }) {
  const read = project(dir), copy = copyAt(read), own = read.files.filter(f => !f.startsWith(copy)), home = fs.realpathSync(dir);
  const listed = new Set(own), named = new Set(), failed = [];
  for (const proj of own.filter(f => /\.(?:cs|fs|vb)proj$/i.test(f))) {
    const out = path.join(tmp, `${p.name}-pp.xml`);
    const r = spawnSync("dotnet", ["msbuild", "-nologo", `-pp:${out}`, proj], { cwd: dir, env, encoding: "utf8" });
    if (r.status !== 0) { failed.push(`${proj}: ${r.stdout}${r.stderr}`); continue; }
    // (each file the build reads stands alone on a line of a comment, by its full path)
    for (const line of fs.readFileSync(out, "utf8").split(/\r?\n/)) {
      if (!path.isAbsolute(line.trim()) || !fs.existsSync(line.trim())) continue;
      const f = within(home, fs.realpathSync(line.trim()));
      if (f !== null && listed.has(f)) named.add(f);
    }
  }
  const imports = importsOf(own, f => readProject(dir, f), projectFilesByContent(dir, own)), reader = new Set(imports.files.keys());
  const differ = [...named].filter(f => !reader.has(f)).map(f => `the SDK reads ${f}, importsOf does not`).concat([...reader].filter(f => !named.has(f)).map(f => `importsOf reads ${f}, the SDK does not`),
    imports.unread.map(u => `importsOf could not follow ${u.project} from ${u.from}`));
  ok(!failed.length && named.size >= 5 && !differ.length, `${p.name}: importsOf reads the project's own build files that dotnet msbuild -pp names, and only those (${named.size})`, `${failed.join("\n")}${differ.join("\n")}`);
}
