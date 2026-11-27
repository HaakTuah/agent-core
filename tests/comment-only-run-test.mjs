// Tests of the proof that a change to what runs by itself is only comments and steps' names (comment-only.mjs; floor
// rule 3), the script run end to end, as its builder runs it, on a pull request's branch in a scratch clone: which
// files it reads under .github/ and .claude/ (any case, any depth) and a project's own action.yml, and which outside
// them it refuses; a file added, deleted or its mode changed, a file not YAML, text not UTF-8 or opening with a byte
// order mark, the copy of the core, a link whose path holds a tab, the script run from a folder below the root, the
// working tree left unread, and a later commit read against the one reviewed. Its reading of a workflow's text is
// comment-only-test.mjs's. On Linux and on Windows. Git and Node's own modules only.
//
//   node tests/comment-only-run-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RUNS, RUNS_TOO } from "../scripts/runs-by-itself.mjs";
import { BASE, edit } from "../scripts/comment-only-stage.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "comment-only.mjs");

// ---- which files it reads, and which outside it refuses (a short name tried here, not on a disk: Windows would write
// CLAUDE~1/settings.json into .claude/) ----
ok([".github/workflows/x.yml", ".GitHub/x.md", "a/.claude/b", ".claude", "sub/.github", "action.yml", "tools/act/Action.YAML"].every(f => RUNS.test(f))
  && !["github/x.yml", "x.github/y", "my-action.yml", "action.yml.md"].some(f => RUNS.test(f)), "what it reads: .github/ and .claude/, the folders themselves too, at any depth and in any case, and every action.yml");
ok(["CLAUDE~1/settings.json", "GITHUB~1/workflows/x.yml", "a/b~2c/d", ".mcp.json", "x/package.json", "yarn.lock", ".vscode/settings.json", "core/x", "Dockerfile.ci", ".gitmodules",
  "Directory.Build.targets", "src/App.csproj", "Directory.Packages.props", "NuGet.Config", "global.json", ".config/dotnet-tools.json", "src/packages.lock.json",
  ".yarnrc.yml", ".npmrc", ".node-version", ".node-least", ".nvmrc", ".devcontainer.json", ".husky/pre-commit", ".pre-commit-config.yaml", ".envrc", "Makefile", "GNUmakefile", "justfile", "Taskfile.yml", ".tool-versions", "mise.toml", ".mise.toml",
  "src/App.csproj.user", "Directory.Build.rsp", "build/All.proj", "src/Shared.projitems", "src/Shared.shproj", ".pnpmfile.cjs", ".yarn/releases/yarn-4.0.0.cjs", "app.Dockerfile", "Containerfile", "core/.github/workflows/x.yml", ".kiro/hooks/x.json", ".kiro/steering/core.md", ".codex/config.toml", ".agents/rules/core.md", ".agent/rules/x.md", ".gemini/settings.json", ".kiro", ".cursor/mcp.json", ".windsurf/rules/x.md", ".amazonq/x.json", ".continue/config.yaml", ".roo/x.json"].every(f => RUNS_TOO.test(f))
  && !["docs/about~notes.md", "src/core/x.mjs", "README.md", "scripts/x.mjs", "packages.md"].some(f => RUNS_TOO.test(f)), "what it refuses outside: a short name with ~ and a digit, the tools', packages' and builds' files, git's hooks, a task runner's file, the copy of the core, another agent tool's own folder");

// ---- the script end to end, on a pull request's branch ----
const tmp = scratchDir("comment-only-test-");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(GIT_|GITHUB_|RUNNER_|ACTIONS_|CI$)|TOKEN|SECRET|PASSWORD|CREDENTIAL/iu.test(name)));
Object.assign(env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid",
  GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_ALLOW_PROTOCOL: "file", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.autocrlf", GIT_CONFIG_VALUE_0: "false" });
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const write = (dir, f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
const origin = path.join(tmp, "origin.git"), work = path.join(tmp, "work");
git(tmp, "init", "-q", "--bare", "-b", "main", origin);
execFileSync("git", ["clone", "-q", "--", ".", work], { cwd: origin, stdio: ["ignore", "pipe", "pipe"] });
const WF = ".github/workflows/t.yml";
write(work, WF, BASE);
write(work, ".claude/settings.json", "{}\n");
write(work, ".github/CODEOWNERS", "* @someone\n");
write(work, "tools/.Claude/notes.md", "notes\n");
write(work, "README.md", "readme\n");
const ACTION = "name: a\nruns:\n  using: composite\n  steps:\n    - name: First # a note\n      shell: bash\n      run: echo\n";
write(work, "action.yml", ACTION);
git(work, "add", "-A");
git(work, "commit", "-q", "-m", "main");
git(work, "push", "-q", "origin", "HEAD:main");
const MAIN = git(work, "rev-parse", "HEAD");
const branch = (name, change, add = true) => { git(work, "checkout", "-q", "-f", "-B", name, MAIN); change(); if (add) git(work, "add", "-A"); git(work, "commit", "-q", "-m", name); return git(work, "rev-parse", "HEAD"); };
const run = (...args) => { const r = spawnSync(process.execPath, [script, ...args], { cwd: work, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };

const COMMENTS = edit("# the kinds", "# what starts it", edit("- name: The check", "- name: Checked"));
let head = branch("comments", () => write(work, WF, COMMENTS));
let r = run();
ok(r.status === 0 && r.out.includes(`comments and steps' names alone in .github/, .claude/ and actions, ${MAIN.slice(0, 7)}..${head.slice(0, 7)}: ${WF}`)
  && r.out.includes(`checked head ${head}`) && !r.out.includes("also changed"), "a comment and a step's name changed, nothing else: proven, the head printed", r.out);
write(work, WF, edit("runs-on: ubuntu-latest", "runs-on: windows-latest"));
r = run();
ok(r.status === 0, "the working tree is not read: the head commit is", r.out);
git(work, "checkout", "-q", "--", WF);

head = branch("and-outside", () => { write(work, WF, COMMENTS); write(work, "scripts/x.mjs", "// a script\n"); });
r = run();
ok(r.status === 2 && r.out.includes(`: ${WF}`) && r.out.includes("also changed, outside what this proof reads: scripts/x.mjs")
  && r.out.includes("says of each of these why it runs neither by itself nor with credentials") && r.out.includes(`checked head ${head}`),
  "a file changed outside what it reads: proven for what it reads, the file listed, and not passed (2) until the session says of it", r.out);
for (const file of [".mcp.json", "package.json", "web/package-lock.json", ".vscode/tasks.json", ".devcontainer/devcontainer.json", "core/scripts/x.mjs", ".gitattributes", "Dockerfile"]) {
  branch(`too-${file.replace(/\W/gu, "-")}`, () => { write(work, WF, COMMENTS); write(work, file, "{}\n"); });
  r = run();
  ok(r.status === 1 && r.out.includes(`NOT ALONE ${file}: a file that runs by itself or decides what does`), `${file}, which runs by itself or decides what does: refused`, r.out);
}

branch("code", () => write(work, WF, edit("echo hi", "echo bye")));
r = run();
ok(r.status === 1 && r.out.includes(`NOT ALONE ${WF}: more than a comment`) && r.out.includes("floor rule 3's two security reviews"), "a run line changed: refused", r.out);

branch("added", () => write(work, ".github/workflows/new.yml", "# only a comment\n"));
r = run();
ok(r.status === 1 && r.out.includes("NOT ALONE .github/workflows/new.yml: added, deleted"), "a workflow added: refused", r.out);

branch("deleted", () => fs.rmSync(path.join(work, WF)));
r = run();
ok(r.status === 1 && r.out.includes(`NOT ALONE ${WF}: added, deleted`), "a workflow deleted: refused", r.out);

branch("mode", () => git(work, "update-index", "--chmod=+x", WF), false);
r = run();
ok(r.status === 1 && r.out.includes(`NOT ALONE ${WF}: added, deleted, or its mode`), "a workflow's mode changed: refused", r.out);

branch("settings", () => write(work, ".claude/settings.json", '{ "hooks": {} }\n'));
r = run();
ok(r.status === 1 && r.out.includes("NOT ALONE .claude/settings.json: not a YAML file"), "Claude Code's settings changed: refused", r.out);

branch("owners", () => write(work, ".github/CODEOWNERS", "* @someone-else\n"));
r = run();
ok(r.status === 1 && r.out.includes("NOT ALONE .github/CODEOWNERS: not a YAML file"), "a file under .github/ that is not YAML: refused", r.out);

branch("nested", () => write(work, "tools/.Claude/notes.md", "notes, changed\n"));
r = run();
ok(r.status === 1 && r.out.includes("NOT ALONE tools/.Claude/notes.md"), "a .claude folder deeper down and in another case: read as one", r.out);

branch("action-code", () => write(work, "action.yml", ACTION.replace("run: echo", "run: echo more")));
r = run();
ok(r.status === 1 && r.out.includes("NOT ALONE action.yml: more than a comment"), "a project's own action outside .github/: its run line read", r.out);
head = branch("action-comment", () => write(work, "action.yml", ACTION.replace("# a note", "# another note")));
r = run();
ok(r.status === 0 && r.out.includes(`and actions, ${MAIN.slice(0, 7)}..${head.slice(0, 7)}: action.yml`), "a project's own action: a comment alone proven", r.out);

branch("binary", () => fs.writeFileSync(path.join(work, WF), Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a])));
r = run();
ok(r.status === 1 && r.out.includes(`NOT ALONE ${WF}: not text in UTF-8`), "a workflow that is not UTF-8: refused", r.out);

head = branch("outside", () => write(work, "README.md", "readme, changed\n"));
r = run();
ok(r.status === 2 && r.out.includes("nothing changed in .github/, .claude/ or an action.yml") && r.out.includes("also changed, outside what this proof reads: README.md"), "nothing changed under .github/ or .claude/: said, and the files outside listed", r.out);

const reviewed = branch("later", () => write(work, WF, edit("echo hi", "echo bye")));
write(work, WF, edit("# A workflow for the test", "# A note added after the review", edit("echo hi", "echo bye")));
git(work, "commit", "-q", "-am", "a comment");
head = git(work, "rev-parse", "HEAD");
r = run(reviewed);
ok(r.status === 0 && r.out.includes(`${reviewed.slice(0, 7)}..${head.slice(0, 7)}: ${WF}`), "a later commit read against the one reviewed: only what it changes", r.out);
r = run();
ok(r.status === 1, "the same branch against main: refused, for the change reviewed before", r.out);
r = run(git(work, "rev-parse", "comments"));
ok(r.status === 1 && r.out.includes("is no commit before the head that it grew from"), "a commit given that the head did not grow from: refused", r.out);

// a link where it reads, on the side reviewed: what it points to is not read
const linked = branch("link", () => { const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: work, env, input: "hooks.yml" }).toString().trim(); git(work, "update-index", "--add", "--cacheinfo", `120000,${blob},.claude/hooks.yml`); }, false);
write(work, WF, COMMENTS);
git(work, "add", "--", WF);
git(work, "commit", "-q", "-m", "a comment after the link");
r = run(linked);
ok(r.status === 1 && r.out.includes(`NOT ALONE .claude/hooks.yml: a link or submodule, at ${linked.slice(0, 7)}`), "a link under .claude/ on the side reviewed: refused", r.out);

// a link named .claude deeper down, on the side reviewed
const linkedFolder = branch("link-folder", () => { const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: work, env, input: "cfg" }).toString().trim(); git(work, "update-index", "--add", "--cacheinfo", `120000,${blob},sub/.claude`); }, false);
write(work, WF, COMMENTS);
git(work, "add", "--", WF);
git(work, "commit", "-q", "-m", "a comment after the link");
r = run(linkedFolder);
ok(r.status === 1 && r.out.includes("NOT ALONE sub/.claude: a link or submodule"), "a link that is itself named .claude: refused", r.out);
r = run("HEAD");
ok(r.status === 1 && r.out.includes("is no commit before the head"), "the head given as the commit reviewed: refused, nothing being read", r.out);

// a byte order mark added at the very start: refused as one anywhere else is
branch("bom", () => write(work, WF, `\ufeff${BASE}`));
r = run();
ok(r.status === 1 && r.out.includes(`NOT ALONE ${WF}`) && r.out.includes("byte order mark"), "a byte order mark added before the first line: refused", r.out);
// run from a folder below the root where git's diff.relative is set: the whole tree is read all the same
branch("relative", () => write(work, WF, edit("echo hi", "echo bye")));
const below = spawnSync(process.execPath, [script], { cwd: path.join(work, "tools"), env: { ...env, GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_1: "diff.relative", GIT_CONFIG_VALUE_1: "true" }, encoding: "utf8" });
ok(below.status === 1 && `${below.stdout}${below.stderr}`.includes(`NOT ALONE ${WF}: more than a comment`), "run from a folder below the root, with diff.relative set: the change outside that folder is read and refused", `${below.stdout}${below.stderr}`);
// a file of the copy of the core under .github/, only a comment of it changed: refused as the copy, never read as YAML
const copied = branch("copy", () => write(work, "core/.github/workflows/c.yml", "# the core's\nname: c\n"));
write(work, "core/.github/workflows/c.yml", "# the core's, changed\nname: c\n");
git(work, "commit", "-q", "-am", "a comment in the copy");
r = run(copied);
ok(r.status === 1 && r.out.includes("NOT ALONE core/.github/workflows/c.yml: a file that runs by itself or decides what does"), "a comment changed in the copy of the core's workflows: refused as the copy", r.out);
// a link whose path holds a tab, on the side reviewed: read whole, past the tab (a name Windows writes no file under)
if (process.platform !== "win32") {
  const tabbed = branch("link-tab", () => { const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: work, env, input: "cfg" }).toString().trim(); git(work, "update-index", "--add", "--cacheinfo", `120000,${blob},dir\tx/.claude`); }, false);
  write(work, WF, COMMENTS);
  git(work, "add", "--", WF);
  git(work, "commit", "-q", "-m", "a comment after the link");
  r = run(tabbed);
  ok(r.status === 1 && r.out.includes("NOT ALONE dir?x/.claude: a link or submodule"), "a link whose path holds a tab: refused", r.out);
}

// main moves on: a head not up to date with it is not the head that merges
git(work, "checkout", "-q", "-f", "-B", "moved", MAIN);
write(work, "README.md", "main moved on\n");
git(work, "commit", "-q", "-am", "main moves on");
git(work, "push", "-q", "origin", "HEAD:main");
branch("behind", () => write(work, WF, COMMENTS));
r = run();
ok(r.status === 1 && r.out.includes("the head is not up to date with main"), "a head behind main: refused until it is brought up to date", r.out);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the script run end to end`);
process.exitCode = failed ? 1 : 0;
