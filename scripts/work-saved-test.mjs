// Tests of the work-saved hook (work-saved.sh), run as a project registers it: through a shell, main's copy read from
// git and handed to bash, the hook's JSON on its input. In a scratch project with a remote of its own, on Linux and on
// Windows (Git Bash). Node's own modules only.
//
//   node scripts/work-saved-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const command = mode => `bash -c 'f=$(git -C "\${CLAUDE_PROJECT_DIR:-.}" --no-replace-objects show refs/remotes/origin/main:core/scripts/work-saved.sh 2>/dev/null) || exit 0; bash -c "$f" work-saved ${mode}'`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "work-saved-test-"));
const project = path.join(tmp, "project"), remote = path.join(tmp, "remote.git"), bare = path.join(tmp, "bare");
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
// (git's own variables that point at a repository are left out, so every call here lands in the scratch project,
// whatever the run was started from)
const outer = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
const env = { ...outer, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const hook = (mode, dir, input = "{}") => spawnSync("sh", ["-c", command(mode)], { input, encoding: "utf8", env: { ...env, CLAUDE_PROJECT_DIR: dir } });

fs.mkdirSync(path.join(project, "core", "scripts"), { recursive: true });
fs.copyFileSync(fileURLToPath(new URL("./work-saved.sh", import.meta.url)), path.join(project, "core", "scripts", "work-saved.sh"));
git(tmp, "init", "-q", "--bare", "-b", "main", remote);
git(project, "init", "-q", "-b", "main");
git(project, "add", "-A");
git(project, "commit", "-q", "-m", "the hook");
git(project, "remote", "add", "origin", remote);
git(project, "push", "-q", "-u", "origin", "main");

let r = hook("stop", project);
ok(r.status === 0 && !r.stderr, "all committed and pushed: the reply ends", r.stderr);
fs.writeFileSync(path.join(project, "note.txt"), "x\n");
r = hook("stop", project);
ok(r.status === 2 && /1 file\(s\) not committed, such as note\.txt/.test(r.stderr), "a file not committed keeps the reply from ending, and says which", `${r.status} ${r.stderr}`);
r = hook("stop", project, '{"stop_hook_active": true}');
ok(r.status === 0, "a second stop in a row goes through", `${r.status} ${r.stderr}`);
r = hook("start", project);
ok(r.status === 0 && /not committed/.test(r.stdout), "at a session's start it reports and stops nothing", `${r.status} ${r.stdout}`);
// the starter kit's hooks for Kiro and Codex (modules/tools.md), run from a folder inside the project, as those tools
// start a command where the session works, with no CLAUDE_PROJECT_DIR: each finds the project's root by git
const kit = name => JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../setup/template/${name}`, import.meta.url)), "utf8"));
const kiroStop = kit("kiro-hook.json.tmpl").hooks.find(h => h.trigger === "Stop").action.command;
const codex = kit("codex-hooks.json.tmpl").hooks, codexOf = event => codex[event][0].hooks[0].command;
fs.mkdirSync(path.join(project, "sub"), { recursive: true });
const nested = path.join(project, "sub", "other");
git(tmp, "init", "-q", "-b", "main", nested);
fs.mkdirSync(path.join(nested, "core", "scripts"), { recursive: true });
fs.writeFileSync(path.join(nested, "core", "scripts", "work-saved.sh"), "echo NESTED-RAN; echo NESTED-RAN >&2; exit 2\n");
git(nested, "add", "-A"); git(nested, "commit", "-q", "-m", "a script of another repository's"); git(nested, "update-ref", "refs/remotes/origin/main", "HEAD");
const inNested = cmd => { const { CLAUDE_PROJECT_DIR: _, ...rest } = env; return spawnSync("sh", ["-c", cmd], { input: "{}", encoding: "utf8", cwd: nested, env: rest }); };
const kiroStart = kit("kiro-hook.json.tmpl").hooks.find(h => h.trigger === "SessionStart").action.command;
const kitHooks = [kiroStart, kiroStop, codexOf("SessionStart"), codexOf("Stop")];
ok(kitHooks.every(c => { const x = inNested(c); return x.status === 0 && !/NESTED-RAN/.test(`${x.stdout}${x.stderr}`); }),
  "in a repository that holds no such hook file, as one cloned inside the project, neither Kiro's hook nor Codex's two runs its script");
const unguarded = kiroStop.replace('[ -f "$r/.kiro/hooks/work-saved.json" ] || exit 0; ', "");
ok(unguarded !== kiroStop && /NESTED-RAN/.test(inNested(unguarded).stderr), "and without the guard, the same hook would have run it: the test bites");
fs.rmSync(nested, { recursive: true, force: true });
// the core's own hooks, which a project carries in its copy under core/: they run in no repository with a manifest
const own = file => JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), "utf8"));
const ownHooks = [...own(".kiro/hooks/work-saved.json").hooks.map(h => h.action.command), ...["SessionStart", "Stop"].map(e => own(".codex/hooks.json").hooks[e][0].hooks[0].command)];
const taker = path.join(tmp, "taker");
git(tmp, "init", "-q", "-b", "main", taker);
for (const [f, t] of [["core-manifest.md", "# Core manifest\n"], [".codex/hooks.json", "{}\n"], [".kiro/hooks/work-saved.json", "{}\n"], ["scripts/work-saved.sh", "echo TAKER-RAN; echo TAKER-RAN >&2; exit 2\n"]]) {
  fs.mkdirSync(path.dirname(path.join(taker, f)), { recursive: true }); fs.writeFileSync(path.join(taker, f), t);
}
git(taker, "add", "-A"); git(taker, "commit", "-q", "-m", "a project with scripts of its own"); git(taker, "update-ref", "refs/remotes/origin/main", "HEAD");
const inTaker = cmd => { const { CLAUDE_PROJECT_DIR: _, ...rest } = env; return spawnSync("sh", ["-c", cmd], { input: "{}", encoding: "utf8", cwd: taker, env: rest }); };
ok(ownHooks.every(c => !/TAKER-RAN/.test(`${inTaker(c).stdout}${inTaker(c).stderr}`)), "the core's own Kiro and Codex hooks run nothing in a project, which holds a manifest, though its hook files stand");
fs.rmSync(path.join(taker, "core-manifest.md"));
ok(/TAKER-RAN/.test(inTaker(ownHooks[0]).stderr), "and without the manifest the same hook runs main's script: the test bites");
for (const [name, to] of [["kiro-hook.json.tmpl", ".kiro/hooks/work-saved.json"], ["codex-hooks.json.tmpl", ".codex/hooks.json"]]) {
  fs.mkdirSync(path.dirname(path.join(project, to)), { recursive: true });
  fs.copyFileSync(fileURLToPath(new URL(`../setup/template/${name}`, import.meta.url)), path.join(project, to));
}
git(project, "add", ".kiro", ".codex"); git(project, "commit", "-q", "-m", "the kit's hooks for Kiro and Codex"); git(project, "push", "-q");
const other = (cmd, input = "{}") => { const { CLAUDE_PROJECT_DIR: _, ...rest } = env; return spawnSync("sh", ["-c", cmd], { input, encoding: "utf8", cwd: path.join(project, "sub"), env: rest }); };
r = other(kiroStop);
ok(r.status === 2 && /1 file\(s\) not committed, such as note\.txt/.test(r.stderr), "Kiro's stop hook, from the kit, runs main's copy at the project's root and keeps the agent going once", `${r.status} ${r.stderr}`);
r = other(kiroStart);
ok(r.status === 0 && /not committed/.test(r.stdout), "Kiro's start hook reports and stops nothing", `${r.status} ${r.stdout}`);
r = other(codexOf("Stop"), '{"stop_hook_active": true}');
ok(r.status === 0, "Codex's stop hook lets a second stop in a row through", `${r.status} ${r.stderr}`);
r = other(codexOf("SessionStart"));
ok(r.status === 0 && /not committed/.test(r.stdout), "Codex's start hook reports and stops nothing", `${r.status} ${r.stdout}`);
// with no node on the path, the start says in a line that the helper hook is off, and stops nothing
const noNode = (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(d => d && !["node", "node.exe"].some(n => fs.existsSync(path.join(d, n)))).join(path.delimiter);
const pathKey = Object.keys(env).find(k => k.toUpperCase() === "PATH") ?? "PATH";
const bare2 = spawnSync("sh", ["-c", command("start")], { input: "{}", encoding: "utf8", env: { ...env, [pathKey]: noNode, CLAUDE_PROJECT_DIR: project } });
ok(bare2.status === 0 && /The helper hook is off here: Node is not on the path/.test(bare2.stdout) && /not committed/.test(bare2.stdout), "with no Node on the path, the start says in a line that the helper hook is off, beside what it reports, and stops nothing", `${bare2.status} ${bare2.stdout}${bare2.stderr}`);
ok(!/helper hook is off/.test(r.stdout), "with Node on the path it says nothing of it", r.stdout);
// the owner's stop switch: the branch agents-stop on origin, said at the start where it stands, and not where it is gone
git(project, "push", "-q", "origin", "main:agents-stop");
const stopped = hook("start", project);
ok(stopped.status === 0 && /The owner's stop switch is set/.test(stopped.stdout), "with the branch agents-stop on origin, the start says the owner's stop switch is set, and stops nothing itself", `${stopped.status} ${stopped.stdout}`);
git(project, "push", "-q", "origin", "--delete", "agents-stop");
ok(!/stop switch/.test(hook("start", project).stdout), "deleted, it says nothing of it");
git(project, "push", "-q", "origin", "main:claude/agents-stop");
ok(!/stop switch/.test(hook("start", project).stdout), "a branch of another name that ends in agents-stop is no switch");
git(project, "push", "-q", "origin", "--delete", "claude/agents-stop");
// where origin cannot be asked, that is said, after the report, which never waits on it
git(project, "remote", "set-url", "origin", path.join(tmp, "nowhere.git"));
let unread = hook("start", project);
ok(unread.status === 0 && /could not be read/.test(unread.stdout) && /not committed/.test(unread.stdout) && unread.stdout.indexOf("not committed") < unread.stdout.indexOf("could not be read"), "where origin cannot be asked, the start says the switch could not be read, after its report", unread.stdout);
if (process.platform === "win32") console.log("skip an origin that hangs and one that runs a command: run on Linux, as the hook's sh and ssh are Git Bash's here");
else {
  // (an origin that never answers, as an ssh asking for a host's key or a passphrase: the start ends in seconds, its
  // report said, well inside Claude Code's 30 seconds for the hook)
  const bin = path.join(tmp, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "ssh"), "#!/bin/sh\nsleep 45\n", { mode: 0o755 });
  git(project, "remote", "set-url", "origin", "git@github.example:o/r.git");
  const began = Date.now();
  unread = spawnSync("sh", ["-c", command("start")], { input: "{}", encoding: "utf8", env: { ...env, PATH: `${bin}${path.delimiter}${env.PATH}`, CLAUDE_PROJECT_DIR: project } });
  ok(unread.status === 0 && Date.now() - began < 15000 && /not committed/.test(unread.stdout) && /could not be read/.test(unread.stdout), "an origin that never answers holds the start no more than eight seconds, and its report is said", `${Date.now() - began}ms ${unread.stdout}`);
  // (the user's own way to ssh, GIT_SSH among them, is kept)
  const marker = path.join(tmp, "own-ssh-ran");
  fs.writeFileSync(path.join(bin, "own-ssh"), `#!/bin/sh\ntouch '${marker}'\nexit 1\n`, { mode: 0o755 });
  spawnSync("sh", ["-c", command("start")], { input: "{}", encoding: "utf8", env: { ...env, GIT_SSH: path.join(bin, "own-ssh"), CLAUDE_PROJECT_DIR: project } });
  ok(fs.existsSync(marker), "the user's own GIT_SSH is the one that asks origin", "");
  // (an origin whose settings would run a command: set aside)
  git(project, "config", "protocol.ext.allow", "always");
  git(project, "remote", "set-url", "origin", `ext::sh -c touch% ${path.join(tmp, "ran-by-hook")}`);
  hook("start", project);
  ok(!fs.existsSync(path.join(tmp, "ran-by-hook")), "an origin's ext:: address runs nothing", "");
  git(project, "config", "--unset", "protocol.ext.allow");
}
git(project, "remote", "set-url", "origin", remote);
// (with no origin there is no switch, and nothing is said of it)
git(project, "remote", "rename", "origin", "elsewhere");
ok(!/stop switch/.test(hook("start", project).stdout), "with no origin, nothing is said of the switch");
git(project, "remote", "rename", "elsewhere", "origin");
git(project, "add", "-A");
git(project, "commit", "-q", "-m", "a note");
r = hook("stop", project);
ok(r.status === 2 && /1 commit\(s\) on main not pushed/.test(r.stderr), "a commit not pushed keeps the reply from ending", `${r.status} ${r.stderr}`);
git(project, "checkout", "-q", "-b", "task");
r = hook("stop", project);
ok(r.status === 2 && /task holds 1 commit\(s\) on no remote branch/.test(r.stderr), "so does a branch with a commit on no remote branch", `${r.status} ${r.stderr}`);
git(project, "push", "-q", "-u", "origin", "task");
r = hook("stop", project);
ok(r.status === 0, "pushed, the reply ends", `${r.status} ${r.stderr}`);
git(project, "checkout", "-q", "--detach");
r = hook("stop", project);
ok(r.status === 0, "a detached HEAD at a pushed commit: the reply ends", `${r.status} ${r.stderr}`);
fs.writeFileSync(path.join(project, "detached.txt"), "x\n");
git(project, "add", "-A");
git(project, "commit", "-q", "-m", "on a detached head");
r = hook("stop", project);
ok(r.status === 2 && /a detached HEAD holds 1 commit\(s\) on no remote branch/.test(r.stderr), "a commit on a detached HEAD, on no branch at all, keeps the reply from ending", `${r.status} ${r.stderr}`);
git(project, "checkout", "-q", "task");
// The working tree's copy is never the one that runs: an edit there changes nothing until it is merged into main.
fs.writeFileSync(path.join(project, "core", "scripts", "work-saved.sh"), "exit 0\n");
r = hook("stop", project);
ok(r.status === 2 && /not committed/.test(r.stderr), "main's copy runs, not the working tree's", `${r.status} ${r.stderr}`);
fs.mkdirSync(bare);
git(bare, "init", "-q", "-b", "main");
ok(hook("stop", bare).status === 0 && hook("stop", path.join(tmp, "nowhere")).status === 0, "where main holds no copy, or there is no folder, the reply ends");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the work-saved hook`);
process.exitCode = failed ? 1 : 0;
