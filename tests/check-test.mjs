// Tests of the core's checks from plain git (check.mjs; tasks/hosts.md, "One layer knows no host"; #250): on a
// project the starter kit writes, synced to the core as it stands here, it passes with each check run and each step
// only the host runs named; a copy of the core edited, or a new copy of code, fails with that check's own failure and
// its mend; a project that calls none of the core's workflows, as on another host, is checked by the kit's calls; and
// every workflow of the core's that the starter kit calls is run by it or named among the host's own (HOST_OWN), so a
// new check cannot be left out of it. A scratch core reached through the core's own address by a git rewrite, so no
// git call reaches the network; the checks it runs on the scratch project install the core's packages from a copy of
// the machine's npm cache, made as the test starts, and so reach no registry (#772; tasks/tests.md, "A test that reaches
// the network runs once per batch"). Git, tar, bash, npm and Node's own modules.
//
//   node tests/check-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HOST_OWN } from "../scripts/check.mjs";
import { onPath } from "../scripts/workflow-run.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { npmWithCache, root, scratch, scratchEnv, tally } from "../scripts/scratch-core.mjs";
import { npmOnce } from "../scripts/npm-once.mjs";
import { trialRecord } from "../scripts/release-trial.mjs";

const { ok, done } = tally();
const win = process.platform === "win32";
const { tmp, git, core, project } = scratch("check-test-");
// (the core's packages installed by the real npm once, and linked into each job's clone after: npm-once.mjs; the real
// npm reading a copy of the machine's cache first, so no job reaches the registry: scratch-core.mjs, npmWithCache, #772)
const env = npmOnce(scratchEnv(core, tmp), tmp, { real: npmWithCache(tmp) });
// (the licence scan passes npm-once.mjs over, so what it may run is held here: Node's own modules alone, loaded by
// name; one process started, the real npm's; and, run against a real npm that logs what it is given, every command
// passed on as it came, and npm ci's run with its files unchanged)
{
  const text = fs.readFileSync(path.join(root, "scripts", "npm-once.mjs"), "utf8");
  const loads = [...text.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s+["']([^"']+)["']|\b(?:require|import)\(\s*["'`]([^"'`$]+)["'`]\s*\)/gu)].map(m => (m[1] ?? m[2] ?? m[3]).replace(/^node:/u, ""));
  const calls = (text.match(/\b(?:require|import)\s*\(/gu) ?? []).length, froms = (text.match(/\bfrom\s+["']|\bimport\s+["']/gu) ?? []).length;
  ok(loads.length === calls + froms && loads.every(m => ["fs", "path", "child_process", "crypto"].includes(m)), "npm-once.mjs, which the licence scan passes over, loads Node's fs, path, child_process and crypto alone, each by its name", loads.join(", "));
  ok((text.match(/child_process/gu) ?? []).length === 1 && /const \{ spawnSync \} = require\("(?:node:)?child_process"\)/u.test(text) && (text.match(/\bspawnSync\s*\(/gu) ?? []).length === 1 && !/\bspawnSync\s*\([^\n]*\benv\b/u.test(text), "and it starts one process: child_process is reached only for spawnSync, called once, with the environment it was given");
  ok(!/\b(?:fetch\s*\(|WebSocket\b|EventSource\b)/u.test(text), "and it reaches the network by none of Node's own globals");
  const probe = path.join(tmp, "npm-once-probe"), fake = path.join(probe, "real"), log = path.join(probe, "log.jsonl");
  const [work, again, other] = ["work", "again", "other"].map(d => path.join(probe, d));
  fs.mkdirSync(fake, { recursive: true }); for (const d of [work, again, other]) fs.mkdirSync(d);
  const logger = path.join(fake, "log.cjs");
  fs.writeFileSync(logger, `const fs = require("fs"), path = require("path"), files = {};
for (const f of ["package.json", "package-lock.json", ".npmrc"]) if (fs.existsSync(f)) files[f] = fs.readFileSync(f, "utf8");
const npmEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^npm_config_|^NODE_OPTIONS$/iu.test(k)).sort());
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), files, npmEnv }) + "\\n");
if (process.argv[2] === "ci") fs.mkdirSync("node_modules", { recursive: true });
`);
  // (the fake is handed to npmOnce as the real one, so it needs no name of npm's, and this file stays one the licence
  // scan reads)
  const realFake = path.join(fake, win ? "logger.cmd" : "logger");
  if (win) fs.writeFileSync(realFake, `@"${process.execPath}" "${logger}" %*\r\n`);
  else fs.writeFileSync(realFake, `#!/bin/sh\nexec '${process.execPath}' '${logger}' "$@"\n`, { mode: 0o755 });
  // (from the scratch environment, which leaves the runner's npm settings and credentials out, so a failure prints none)
  const base = scratchEnv(core, tmp);
  const probed = npmOnce({ ...base, npm_config_probe: "as-set" }, probe, { real: realFake });
  const ownNpmEnv = JSON.stringify(Object.fromEntries(Object.entries(probed).filter(([k]) => /^npm_config_|^NODE_OPTIONS$/iu.test(k)).sort()));
  const shimDir = path.join(probe, "npm-once"), shim = path.join(shimDir, fs.readdirSync(shimDir).find(f => !f.endsWith(".cjs")));
  const files = { "package.json": '{"name":"p"}\n', "package-lock.json": '{"lockfileVersion":3}\n', ".npmrc": "ignore-scripts=true\n" };
  for (const [f, body] of Object.entries(files)) for (const d of [work, again, other]) fs.writeFileSync(path.join(d, f), f === "package-lock.json" && d === other ? body.replace("3", "4") : body);
  const asked = [["view", "left-pad", "version"], ["ci", "--ignore-scripts", "--no-audit"]];
  // (on Windows a .cmd runs through cmd.exe, so its path is quoted, as npm-once.mjs quotes the real npm's)
  const runShim = (args, cwd) => spawnSync(win ? `"${shim}"` : shim, args, { cwd, env: probed, stdio: "ignore", shell: win });
  for (const args of asked) runShim(args, work);
  runShim(asked[1], again); runShim(asked[1], other);
  const got = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map(l => JSON.parse(l)) : [];
  ok(got.length === 3 && got.slice(0, 2).every((g, i) => JSON.stringify(g.args) === JSON.stringify(asked[i])) && got.every(g => JSON.stringify(g.npmEnv) === ownNpmEnv), "and run with a command, it runs the real npm once with exactly the arguments and npm settings it was given, npm ci's too", JSON.stringify(got.map(g => [g.args, Object.keys(g.npmEnv)])));
  ok(got[1] && path.resolve(got[1].cwd) !== path.resolve(work) && JSON.stringify(got[1].files) === JSON.stringify(files) && fs.existsSync(path.join(work, "node_modules")), "and npm ci runs in a folder of its own with the package list, lock file and .npmrc unchanged, linked back as node_modules", JSON.stringify(got[1] ?? null));
  ok(got.length === 3 && fs.existsSync(path.join(again, "node_modules")) && path.resolve(got[2].cwd) !== path.resolve(got[1].cwd) && got[2].files["package-lock.json"] === files["package-lock.json"].replace("3", "4"), "and npm ci asked again with the same files runs no npm, the same install linked, and with a lock file changed runs it anew", String(got.length));
}
const check = (dir, ...args) => { const r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs"), ...args], { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const commit = (dir, what) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", what); };

// every workflow the starter kit calls is run here or named the host's own
const kit = path.join(root, "setup", "template", "workflows");
for (const f of fs.readdirSync(kit)) {
  const caller = fs.readFileSync(path.join(kit, f), "utf8");
  const started = /^\s+(?:pull_request|push):/m.test(caller);
  for (const [, name] of caller.matchAll(/\/\.github\/workflows\/([\w.-]+)@/g)) {
    ok(name in HOST_OWN || (started && fs.readFileSync(path.join(root, ".github", "workflows", name), "utf8").includes("workflow_call")),
      `${name}, which the starter kit's ${f} calls, is run by check.mjs on a pull request or a push, or named among the host's own`);
  }
}
for (const name of Object.keys(HOST_OWN)) ok(fs.existsSync(path.join(root, ".github", "workflows", name)), `${name}, named the host's own, is a workflow of the core's`);

// a project the starter kit writes, at the scratch core's commit
const p = project("a-project", "--owner", "someone");
ok(p.status === 0, "the starter kit writes a project", p.out);
const dir = p.dir;
commit(dir, "the starter kit");
let r = check(dir);
ok(r.status === 0 && /ok {3}core\.yml\/core\/core/.test(r.out) && /ok {3}copies\.yml\/copies/.test(r.out), "a project as the kit writes it passes on a push to main, its copy and its copies checked", r.out);
// (with --own, the project's own workflows run too, its jobs that call no workflow, after the core's; with --verdicts,
// each job's verdict that ran is written by its place: #1084)
fs.writeFileSync(path.join(dir, ".github/workflows/own.yml"), "name: own\non:\n  push:\n    branches: [main]\njobs:\n  fine:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo fine\n  broken:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo broken && exit 3\n  later:\n    if: github.event_name == 'pull_request'\n    runs-on: ubuntu-latest\n    steps:\n      - run: exit 4\n  deploy:\n    environment: production\n    runs-on: ubuntu-latest\n    steps:\n      - run: exit 5\n  secret:\n    runs-on: ubuntu-latest\n    steps:\n      - run: test -z \"${{ secrets.PERSONAL_TERMS }}\"\n  mac:\n    runs-on: " + (process.platform === "darwin" ? "windows" : "macos") + "\n    steps: [{run: ':'}]\n  odd:\n    if: hashFilez('x') != ''\n    runs-on: ubuntu-latest\n    steps: [{run: ':'}]\n  behind:\n    needs: odd\n    runs-on: ubuntu-latest\n    steps: [{run: ':'}]\n  gate:\n    needs: [fine, broken]\n    if: always()\n    runs-on: ubuntu-latest\n    steps:\n      - run: test \"${{ join(needs.*.result, ' ') }}\" = \"success failure\"\n");
commit(dir, "a workflow of its own");
const verdictsFile = path.join(tmp, "verdicts.json");
const without = check(dir);
r = check(dir, "--own", "--verdicts", verdictsFile);
const verdicts = JSON.parse(fs.readFileSync(verdictsFile, "utf8"));
ok(without.status === 0 && !/own\.yml/.test(without.out) && r.status === 1 && /ok {3}own\.yml\/fine/.test(r.out) && /FAIL own\.yml\/broken: its step "echo broken && exit 3" failed/.test(r.out) && /skip own\.yml\/later/.test(r.out) && /3 failed, 1 not run, 4 ran\)/.test(r.out),
  "with --own its own jobs run too, one failing or not run failing it, one whose condition fails skipped; without it, none", `${without.out}\n${r.out}`);
ok(/host own\.yml\/deploy: it names an environment/.test(r.out) && !("own.yml/deploy" in verdicts) && verdicts["own.yml/secret"] === "passed",
  "a job of its own that names an environment, which deploys, is the host's own and not run, and its own jobs are given no secret", r.out);
const inside = check(dir, "--own", "--verdicts", path.join(dir, "verdicts.json"));
ok(inside.status === 1 && mended(inside.out) && /--verdicts .* lies in the project.s own repository/.test(inside.out) && !fs.existsSync(path.join(dir, "verdicts.json")), "--verdicts in the project's own repository is refused, saying its mend, and nothing is written there", inside.out);
// (a --verdicts path that is a link to nothing in the project is refused too: a write would follow it there)
const dangling = path.join(tmp, "dangling.json");
let linked = true;
try { fs.symlinkSync(path.join(dir, "linked.json"), dangling, "file"); } catch { linked = false; }
const through = linked ? check(dir, "--verdicts", dangling) : null;
ok(!linked || (through.status === 1 && mended(through.out) && /--verdicts .* is a link/.test(through.out) && !fs.existsSync(path.join(dir, "linked.json"))), "--verdicts that is a link to nothing in the project's repository is refused, saying its mend, and nothing is written there", through?.out);
ok(verdicts["own.yml/fine"] === "passed" && verdicts["own.yml/broken"] === "failed" && !("own.yml/later" in verdicts) && verdicts["core.yml/core/core"] === "passed" && verdicts["own.yml/mac"] === "unrun" && Object.values(verdicts).every(v => /^(pass|fail)ed$|^unrun$|^unread$/.test(v)),
  "and --verdicts writes each job's verdict that ran, the core's and the project's own, by its place", JSON.stringify(verdicts));
ok(verdicts["own.yml/gate"] === "passed" && verdicts["own.yml/odd"] === "unread" && verdicts["own.yml/behind"] === "unread" && !("own.yml" in verdicts) && Object.entries(verdicts).filter(([, v]) => v === "unread").length === 2
  && /FAIL own\.yml\/odd: this runner cannot read it \(a function this reader does not know: hashFilez\)/.test(r.out) && mended(r.out.split("\n").find(l => l.startsWith("FAIL own.yml/odd")) ?? ""),
  "a job of its own this runner cannot read is written unread, with why and its mend, and one behind it too; the jobs it can read, a gate over join(needs.*.result) among them, keep their own verdicts, never the whole file failed (#1263, point 1)", JSON.stringify(verdicts));
git(dir, "reset", "-q", "--hard", "HEAD~1");

// (programs named as those the checks start, committed at the change's root, never run in their place: on Windows a
// program started by its bare name is looked for in its folder first, unless told not to, so the test's own git is
// told so too, while check.mjs is given an environment that does not tell it; #513)
if (win) process.env.NoDefaultCurrentDirectoryInExePath = "1";
const planted = win ? ["bash.exe", "git.exe"] : ["bash", "git"];
// (elsewhere each leaves a mark where it runs, so a run the check's outcome would not show is seen too)
const ranMark = path.join(tmp, "planted-ran");
for (const f of planted) {
  if (win) fs.copyFileSync(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "whoami.exe"), path.join(dir, f));
  else fs.writeFileSync(path.join(dir, f), `#!/bin/sh\necho "$0" >> '${ranMark}'\nexit 3\n`, { mode: 0o755 });
}
commit(dir, "programs named as the checks' own");
// (and with "." and an empty entry ahead on its PATH, each the folder it starts in, which the check must not look in)
const untold = Object.fromEntries(Object.entries(env).filter(([name]) => name.toLowerCase() !== "nodefaultcurrentdirectoryinexepath")
  .map(([name, value]) => [name, /^path$/iu.test(name) ? `.${path.delimiter}${path.delimiter}${value}` : value]));
const checkUntold = () => { const u = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs")], { cwd: dir, env: untold, encoding: "utf8" }); return { status: u.status, out: `${u.stdout}${u.stderr}` }; };
const ranPlanted = () => (fs.existsSync(ranMark) ? fs.readFileSync(ranMark, "utf8").trim() : "");
r = checkUntold();
ok(r.status === 0 && /ok {3}core\.yml\/core\/core/.test(r.out) && ranPlanted() === "", "programs named bash and git at the change's root run in place of none the checks start, \".\" and an empty entry on the PATH too", `${ranPlanted()}\n${r.out}`);
// (with no owner's account in the manifest, the check asks the host who holds the repository, starting git and gh in
// the project's folder from its own environment, held so too: it says what it read from the host, and elsewhere than
// Windows, where the stand-ins leave no mark, no planted program ran for it)
fs.writeFileSync(path.join(dir, "core-manifest.md"), fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8").replace(/^\| \*owner's account\*.*\n/mu, ""));
commit(dir, "no owner's account");
r = checkUntold();
ok(!/owner's account\* \|/u.test(fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8")) && /read from the host: /u.test(r.out) && ranPlanted() === "", "with no owner's account in the manifest, the host is asked by no program of the change's", `${ranPlanted()}\n${r.out}`);
git(dir, "reset", "-q", "--hard", "HEAD~2");
// (and bash is taken from the PATH as the system takes it: on POSIX, a file of that name the user may not run, in a
// folder ahead on the PATH, is passed over for the one it may)
if (!win) {
  const ahead = path.join(tmp, "ahead");
  fs.mkdirSync(ahead, { recursive: true });
  fs.writeFileSync(path.join(ahead, "bash"), "#!/bin/sh\nexit 3\n", { mode: 0o644 });
  const found = onPath("bash", { PATH: `${ahead}${path.delimiter}${process.env.PATH}` });
  ok(found !== null && found !== path.join(ahead, "bash"), "a file named bash ahead on the PATH that may not be run is passed over for one that may", found);
  // (an empty or relative entry, which names the folder a program starts in, is passed over, wherever it starts)
  const here = path.join(tmp, "here");
  fs.mkdirSync(here, { recursive: true });
  fs.writeFileSync(path.join(here, "bash"), "#!/bin/sh\nexit 3\n", { mode: 0o755 });
  const was = process.cwd();
  process.chdir(here);
  const fromHere = [".", "", "./", "../here"].map(entry => onPath("bash", { PATH: `${entry}${path.delimiter}${process.env.PATH}` }));
  process.chdir(was);
  ok(fromHere.every(f => f !== null && path.isAbsolute(f) && path.dirname(f) !== here), "an empty or relative entry on the PATH, the folder a program starts in, is passed over", fromHere.join(", "));
}

const config = path.join(dir, "checks", "copies.json");
fs.writeFileSync(config, JSON.stringify({ ...JSON.parse(fs.readFileSync(config, "utf8")), code: ["src"] }, null, 2));
commit(dir, "the code the copies check reads");
git(dir, "branch", "-q", "base");
fs.writeFileSync(path.join(dir, "notes.md"), "A note.\n");
commit(dir, "a note");
fs.writeFileSync(path.join(tmp, "description.md"), "## What the owner can try\nNothing.\n\n## Readings taken\nNone.\n\nWaits on: nothing\n");
r = check(dir, "--base", "base", "--description", path.join(tmp, "description.md"));
ok(r.status === 0 && /ok {3}pr-description\.yml\//.test(r.out) && /host security-review\.yml\/[\w-]+: security-review\.yml is not run here/.test(r.out), "a pull request with its description passes, the security review's status named the host's own and not run", r.out);
r = check(dir, "--base", "base");
ok(r.status === 0 && r.out.includes("pr-description.yml is not run here: give --description"), "without a description, the description check is named and not run", r.out);
git(dir, "reset", "-q", "--hard", "base");
fs.writeFileSync(path.join(dir, "core", "README.md"), "edited here\n");
commit(dir, "an edit to the copy");
r = check(dir, "--base", "base");
ok(r.status === 1 && r.out.includes("core/ differs from the core at its pin") && mended(r.out), "an edit to the copy of the core fails, with core.yml's own failure and its mend", r.out);

git(dir, "reset", "-q", "--hard", "base");
fs.writeFileSync(path.join(dir, "core", ".github", "workflows", "core.yml"), "on:\n  workflow_call:\njobs:\n  core:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo nothing checked\n");
commit(dir, "the copy's own check emptied");
r = check(dir, "--base", "base");
ok(r.status === 1 && r.out.includes("core/ differs from the core at its pin") && !r.out.includes("nothing checked") && mended(r.out), "a change that edits the copy's own workflow runs the core's as it stands at the call's pin, never the edited one, and fails", r.out);

git(dir, "reset", "-q", "--hard", "base");
fs.mkdirSync(path.join(dir, "src"), { recursive: true });
const block = Array.from({ length: 40 }, (_, i) => `export function f${i}(a, b) { const c = a * ${i} + b; if (c > ${i}) { return c - a; } return c + b * ${i}; }`).join("\n");
fs.writeFileSync(path.join(dir, "src", "one.js"), `${block}\n`);
fs.writeFileSync(path.join(dir, "src", "two.js"), `${block}\n`);
commit(dir, "a copy of code");
r = check(dir, "--base", "base");
ok(r.status === 1 && /FAIL copies\.yml\/copies\/copies: its step "The copies, pointer, reading-size, workflow, entry-file, manifest, shape, choice records' and core's files' checks/.test(r.out) && /^ +== No new copies$/m.test(r.out) && mended(r.out), "a new copy of code fails on a pull request, with the copies check's own failure and its mend", r.out);

// a private project, as the kit writes it: its checks without a secret as steps of core.yml's one job (#376), which a
// failure of the copy stops here, since each runs the copy's scripts
{
  const q = project("a-private-project", "--owner", "someone", "--private");
  ok(q.status === 0, "the starter kit writes a private project", q.out);
  commit(q.dir, "the starter kit");
  const qConfig = path.join(q.dir, "checks", "copies.json");
  fs.writeFileSync(qConfig, JSON.stringify({ ...JSON.parse(fs.readFileSync(qConfig, "utf8")), code: ["src"] }, null, 2));
  commit(q.dir, "the code the copies check reads");
  git(q.dir, "branch", "-q", "base");
  let s = check(q.dir, "--base", "base", "--description", path.join(tmp, "description.md"));
  ok(s.status === 0 && /ok {3}core\.yml\/core\/core/.test(s.out) && !/(copies|pr-description)\.yml\//.test(s.out), "its pull request passes, the copies and description checks run in core.yml's one job", s.out);
  s = check(q.dir, "--base", "base");
  ok(s.status === 0 && s.out.includes("core.yml's description check is not run here: give --description"), "without a description, the one job's description check is named and not run", s.out);
  fs.mkdirSync(path.join(q.dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(q.dir, "src", "one.js"), `${block}\n`);
  fs.writeFileSync(path.join(q.dir, "src", "two.js"), `${block}\n`);
  commit(q.dir, "a copy of code");
  s = check(q.dir, "--base", "base");
  ok(s.status === 1 && /FAIL core\.yml\/core\/core: its step "The copies, pointer, reading-size, workflow, entry-file, manifest, shape, choice records' and core's files' checks" failed/.test(s.out) && /^ +== No new copies$/m.test(s.out) && !/the copy of the core is not the core at its pin/.test(s.out) && mended(s.out),
    "a new copy of code fails it, with the copies check's own failure and its mend, a step of the one job and no failure of the copy", s.out);
  fs.writeFileSync(path.join(q.dir, "core", "README.md"), "edited here\n");
  commit(q.dir, "and an edit to the copy");
  s = check(q.dir, "--base", "base");
  ok(s.status === 1 && /the copy of the core is not the core at its pin, so no other check runs/.test(s.out) && !/its step "The copies, pointer/.test(s.out) && mended(s.out),
    "where the copy is not the core, the steps the one job runs of the copy's scripts run no more, the new copy unread", s.out);
  // (a pin that is no commit of the core, so the core's checkout at it fails, and the copy's own checks.mjs edited to
  // leave a mark where it runs: it must not run, here or in the job, before the copy is proved the core)
  git(q.dir, "reset", "-q", "--hard", "base");
  const mark = path.join(tmp, "copy-scripts-ran");
  fs.writeFileSync(path.join(q.dir, "core", "scripts", "checks.mjs"), `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(mark)}, "ran");\n`);
  const qManifest = path.join(q.dir, "core-manifest.md");
  fs.writeFileSync(qManifest, fs.readFileSync(qManifest, "utf8").replace(/^(Core: \S+ at )[0-9a-f]{40}/m, `$1${"f".repeat(40)}`));
  commit(q.dir, "a pin that is no commit of the core, and an edited script of the copy");
  s = check(q.dir, "--base", "base");
  ok(s.status === 1 && !fs.existsSync(mark) && mended(s.out), "where the core cannot be fetched at the pin, the copy's own scripts run not at all", s.out);
  // (and where the call to core.yml itself is pinned to no commit of the core, so it cannot even be read, the separate
  // checks after it, which run the copy's scripts, run not at all either)
  git(q.dir, "reset", "-q", "--hard", "base");
  fs.writeFileSync(path.join(q.dir, "core", "scripts", "checks.mjs"), `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(mark)}, "ran");\n`);
  const calls = path.join(q.dir, ".github", "workflows", "core.yml");
  fs.writeFileSync(calls, fs.readFileSync(calls, "utf8").replace(/(\/\.github\/workflows\/core\.yml@)[0-9a-f]{40}/, `$1${"e".repeat(40)}`));
  fs.writeFileSync(path.join(q.dir, ".github", "workflows", "copies.yml"), fs.readFileSync(path.join(root, "setup", "template", "workflows", "copies.yml.tmpl"), "utf8").replaceAll("{{core}}", CORE).replaceAll("{{pin}}", /^Core: \S+ at ([0-9a-f]{40})/m.exec(fs.readFileSync(qManifest, "utf8"))[1]));
  commit(q.dir, "a call to core.yml that cannot be read, a call of the copies check's own, and an edited script of the copy");
  git(q.dir, "branch", "-f", "base");
  s = check(q.dir);
  ok(s.status === 1 && !fs.existsSync(mark) && /the copy of the core is not the core at its pin, so no other check runs/.test(s.out) && mended(s.out), "where core.yml cannot even be read at its call's pin, no check after it runs the copy's scripts", s.out);
}

// a change that takes a check's call out still runs it: the calls are the base's
git(dir, "reset", "-q", "--hard", "base");
fs.rmSync(path.join(dir, ".github", "workflows", "core.yml"));
fs.writeFileSync(path.join(dir, "core", "README.md"), "edited here\n");
commit(dir, "the copy edited, and its check's call taken out");
r = check(dir, "--base", "base", "--verdicts", path.join(tmp, "s.json"));
ok(r.status === 1 && r.out.includes("core/ differs from the core at its pin") && r.out.includes("so no other check runs") && !/ok {3}copies\.yml/.test(r.out) && mended(r.out) && /"stopped"/.test(fs.readFileSync(path.join(tmp, "s.json"))),
  "a change that takes out its call to core.yml is still checked by the base's call, and a copy that fails it runs no other check, each said stopped", r.out);
git(dir, "branch", "-q", "-f", "nocore");
r = check(dir, "--base", "nocore");
ok(r.status === 1 && r.out.includes("no call to the core's core.yml") && mended(r.out), "a base that calls no core.yml fails, saying its mend", r.out);

// a listed personal term is found and never printed
git(dir, "reset", "-q", "--hard", "base");
const term = ["Zq", "xv", "Wk"].join("");
fs.writeFileSync(path.join(dir, "notes.md"), `A note naming ${term}.\n`);
commit(dir, "a note with a listed term");
r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs"), "--base", "base"], { cwd: dir, env: { ...env, PERSONAL_TERMS: `${term.toLowerCase()}\n` }, encoding: "utf8" });
const said = `${r.stdout}${r.stderr}`;
ok(r.status === 1 && /FAIL personal-terms\.yml\/check\/check/.test(said) && !said.toLowerCase().includes(term.toLowerCase()) && mended(said), "a listed personal term, listed in other letters' case, fails the change, and the term is printed nowhere in any case", said);

git(dir, "reset", "-q", "--hard", "base");
fs.writeFileSync(path.join(dir, "notes.md"), "A plain note.\n");
commit(dir, "a plain note");
const terms = { ...env, PERSONAL_TERMS: `${term}\n` };
r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs"), "--base", "base", "--branch", `fix-${term.toLowerCase()}`], { cwd: dir, env: terms, encoding: "utf8" });
r.out = `${r.stdout}${r.stderr}`;
ok(r.status === 1 && /FAIL personal-terms\.yml\/check\/check/.test(r.out), "a listed term in the branch's own name fails the change", r.out);

// a path filter reads each name as it is, one beyond ASCII too, and a workflow of the project's own in a form this
// reader does not know, calling none of the core's, leaves every check run
git(dir, "reset", "-q", "--hard", "base");
const pinned = /^Core: \S+ at ([0-9a-f]{40})/m.exec(fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8"))[1];
const address = fs.readFileSync(path.join(dir, ".github", "workflows", "core.yml"), "utf8").match(/uses: (\S+)\/\.github\/workflows\/core\.yml@/)[1];
fs.writeFileSync(path.join(dir, ".github", "workflows", "docs-terms.yml"), `on:\n  pull_request:\n    paths: ['docs/**']\njobs:\n  terms:\n    uses: ${address}/.github/workflows/personal-terms.yml@${pinned}\n    secrets:\n      PERSONAL_TERMS: \${{ secrets.PERSONAL_TERMS }}\n`);
fs.writeFileSync(path.join(dir, ".github", "workflows", "build.yml"), "on: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: [20, 22]\n        node: [24]\n    steps:\n      - run: echo built\n");
commit(dir, "a filtered call, and a build of the project's own");
git(dir, "branch", "-q", "-f", "filtered");
fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
fs.writeFileSync(path.join(dir, "docs", `${String.fromCodePoint(0xe9)}.md`), `Naming ${term}.\n`);
commit(dir, "a doc whose name git quotes");
r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs"), "--base", "filtered"], { cwd: dir, env: { ...env, PERSONAL_TERMS: `${term}\n` }, encoding: "utf8" });
r.out = `${r.stdout}${r.stderr}`;
ok(r.status === 1 && /FAIL docs-terms\.yml\/terms\/check/.test(r.out) && /note \.github\/workflows\/build\.yml is written in a form/.test(r.out), "a call filtered by path runs where the change's file name lies beyond ASCII, and a workflow of the project's own this reader cannot read is passed over, said so", r.out);

// a listed term in a workflow's own name is masked wherever it is printed, and a wildcard branch filter still runs
git(dir, "reset", "-q", "--hard", "base");
const caller = path.join(dir, ".github", "workflows", "personal-terms.yml");
fs.writeFileSync(path.join(dir, ".github", "workflows", `${term.toLowerCase()}-terms.yml`), fs.readFileSync(caller, "utf8").replace("branches: [main]", "branches: ['**']"));
fs.rmSync(caller);
commit(dir, "the terms check's call renamed, filtered by a wildcard");
git(dir, "branch", "-q", "-f", "named");
fs.writeFileSync(path.join(dir, "notes.md"), `Naming ${term}.\n`);
commit(dir, "a note with a listed term");
r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs"), "--base", "named"], { cwd: dir, env: { ...env, PERSONAL_TERMS: `${term}\n` }, encoding: "utf8" });
const masked = `${r.stdout}${r.stderr}`;
ok(r.status === 1 && /FAIL \*\*\*-terms\.yml\/check\/check/.test(masked) && !masked.toLowerCase().includes(term.toLowerCase()), "a call under a branch filter of patterns runs, and a listed term in the workflow's own name is printed nowhere", masked);

// a core that cannot be reached fails, saying its mend
git(dir, "reset", "-q", "--hard", "base");
const away = { ...env, GIT_CONFIG_KEY_0: `url.${path.join(tmp, "nowhere").replace(/\\/g, "/")}.insteadOf`, GIT_CONFIG_KEY_1: `url.${path.join(tmp, "nowhere").replace(/\\/g, "/")}.insteadOf` };
r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs")], { cwd: dir, env: away, encoding: "utf8" });
r.out = `${r.stdout}${r.stderr}`;
ok(r.status === 1 && r.out.includes("the core could not be fetched") && mended(r.out) && !r.stderr.includes("    at "), "a core that cannot be reached fails with its mend, and no stack", r.out);

// a check that keeps a baseline reads the base: the change is checked on its merge into the base, as GitHub checks it
git(dir, "reset", "-q", "--hard", "base");
fs.writeFileSync(path.join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { unlisted: { command: ["np", "x"].join(""), args: ["-y", "an-unlisted-server@1.0.0"] } } }, null, 2));
commit(dir, "an agent's tool no list names");
r = check(dir, "--base", "base");
ok(r.status === 1 && /FAIL licences\.yml\/licences\/licences: its step "Every tool the agents load listed/.test(r.out) && mended(r.out), "a tool the agents load that no list names fails the agent-tools check on a pull request, its base read from the merge's first parent", r.out);

// a head that is its base, or behind it, merges nothing: the change reads as none against that base, never against the
// base's parent (#1231), as the release trial's run before the update has it, its project's main checked out against
// itself; the base here adds a file past the split mark, which the reading-size check, read against the base's parent,
// would find changed
git(dir, "reset", "-q", "--hard", "base");
fs.mkdirSync(path.join(dir, "data"), { recursive: true });
fs.writeFileSync(path.join(dir, "data", "big.txt"), Array.from({ length: 5000 }, (_, i) => `${i} ${(i * 2654435761) % 4294967296}\n`).join(""));
commit(dir, "a file past the split mark, on the base");
git(dir, "branch", "-q", "-f", "large");
const baseline = path.join(tmp, "baseline.json");
r = check(dir, "--base", "large", "--verdicts", baseline);
const before = JSON.parse(fs.readFileSync(baseline, "utf8"));
ok(r.status === 0 && /ok {3}copies\.yml\/copies\/copies/.test(r.out) && before["copies.yml/copies/copies"] === "passed" && r.out.includes("note the head is its base, so the change is read as none against the base"), "a head that is its base passes the copies checks, read against the base itself, and says so", r.out);
const read = trialRecord("0".repeat(40), "2026-11-24", [[before, before]]);
ok(Object.keys(before).length > 0 && read.passedBoth === Object.keys(before).length && read.failedAfter === 0 && read.failedBoth === 0 && read.ranBeforeAlone === 0, "and the trial's record reads that run as its baseline, every job that ran passed and none the update's", JSON.stringify(read));
git(dir, "reset", "-q", "--hard", "base");
r = check(dir, "--base", "large");
ok(r.status === 0 && /ok {3}copies\.yml\/copies\/copies/.test(r.out) && r.out.includes("note the head is behind its base"), "a head behind its base passes the copies checks, read against the base, not the head, and says so", r.out);
git(dir, "reset", "-q", "--hard", "large");
fs.appendFileSync(path.join(dir, "data", "big.txt"), "one more line\n");
commit(dir, "the file past the split mark changed");
r = check(dir, "--base", "large");
ok(r.status === 1 && /past the 51200-byte mark, and this PR changes it/.test(r.out) && mended(r.out), "and a head ahead of that base that changes the file is still read against it, and fails", r.out);
git(dir, "reset", "-q", "--hard", "base");
fs.mkdirSync(path.join(dir, "data"), { recursive: true });
fs.writeFileSync(path.join(dir, "data", "big.txt"), "another file in its place\n");
commit(dir, "the same file, written otherwise");
r = check(dir, "--base", "large");
ok(r.status === 1 && r.out.includes("does not merge into its base without a conflict") && mended(r.out), "a head that does not merge into its base without a conflict is refused, saying its mend", r.out);
{
  const one = project("a-one-commit-project", "--owner", "someone");
  ok(one.status === 0, "the starter kit writes a project for a repository of one commit", one.out);
  // (a workflow of the project's own that reads the commit as a pull request's merge, its second parent a change of nothing)
  fs.writeFileSync(path.join(one.dir, ".github", "workflows", "parents.yml"), "on: [pull_request]\njobs:\n  parents:\n    runs-on: ubuntu-latest\n    steps:\n      - run: git rev-parse -q --verify 'HEAD^2' && git diff --quiet 'HEAD^1' 'HEAD^2' && git diff --quiet 'HEAD^1' HEAD\n");
  commit(one.dir, "the starter kit");
  r = check(one.dir, "--base", "HEAD", "--own");
  ok(r.status === 0 && /ok {3}copies\.yml\/copies\/copies/.test(r.out) && /ok {3}parents\.yml\/parents/.test(r.out), "and in a repository of one commit, a head that is its base passes the copies checks, its base read, the commit a merge of two parents that adds nothing to it", r.out);
}

// another host: no .github/workflows, so the kit's calls are run, read from the core itself
git(dir, "reset", "-q", "--hard", "base");
fs.rmSync(path.join(dir, ".github", "workflows"), { recursive: true, force: true });
commit(dir, "on another host");
r = check(dir);
ok(r.status === 0 && r.out.includes("the starter kit's calls are run") && /ok {3}core\.yml\/core\/core/.test(r.out), "a project with no calls of its own is checked by the starter kit's", r.out);
git(dir, "branch", "-q", "-f", "elsewhere");
fs.rmSync(path.join(dir, "core", "setup", "template", "workflows"), { recursive: true, force: true });
commit(dir, "the copy's starter kit calls taken out");
r = check(dir, "--base", "elsewhere");
ok(r.status === 1 && r.out.includes("core/ differs from the core at its pin") && mended(r.out), "a change that takes the kit's calls out of its copy is still checked by the core's own", r.out);
git(dir, "reset", "-q", "--hard", "elsewhere");

// what it refuses
r = check(dir, "--colour");
ok(r.status === 1 && mended(r.out), "an option it does not know fails, saying its mend", r.out);
r = check(dir, "--base", "no-such-commit");
ok(r.status === 1 && r.out.includes("no commit of this repository") && mended(r.out), "a base that is no commit fails, saying its mend", r.out);
fs.rmSync(path.join(dir, "core-manifest.md"));
commit(dir, "no manifest");
r = check(dir);
ok(r.status === 1 && r.out.includes("core-manifest.md is not in the commit") && mended(r.out), "a commit with no manifest fails, saying its mend", r.out);
done("the core's checks from plain git");
