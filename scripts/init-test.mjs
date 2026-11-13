// Tests of the starter kit (init.mjs and setup/template/): what a command line may hold, what each template becomes,
// that every call a template makes names a workflow the core has and gives it what it requires, and the program whole:
// from a scratch copy of the core as it stands here, it writes a scratch project, on which the core's own checks then
// run (the pointer, workflow, copies, licence and reading-size checks), so a template that no longer fits the core
// fails here and not in a project. On Linux and on Windows. Git, tar and Node's own modules only.
//
//   node scripts/init-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, CORE_SOURCE } from "./core-address.mjs";
import { FILES, files, fill, licences, modules, options, sizes } from "./init.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const throws = fn => { try { fn(); return false; } catch { return true; } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A = "a".repeat(40);

// the command line
ok(options(["--owner", "some-one"]).owner === "some-one" && options(["--owner", "x", "--private", "--game"]).private && options(["--owner", "x", "--game"]).game, "an owner, and the two flags");
ok(throws(() => options([])) && throws(() => options(["--owner"])) && throws(() => options(["--owner", "a b"])) && throws(() => options(["--owner", "-x"])) && throws(() => options(["--owner", "x`; rm -rf y`"])), "an owner is one GitHub login, and is asked for");
ok(throws(() => options(["--owner", "x", "--force"])) && throws(() => options(["--owner", "x", "y"])), "an argument it does not know stops it");
ok(options(["--owner", "x", "--at", A]).at === A && throws(() => options(["--owner", "x", "--at", "main"])) && throws(() => options(["--owner", "x", "--at", A.slice(1)])), "a commit is 40 hex characters");
ok(options(["--owner", "x", "--npm", "tools/"]).packages === "tools" && options(["--owner", "x", "--npm", "."]).packages === "." && options(["--owner", "x", "--npm", "a\\b"]).packages === "a/b", "the npm folder is read from the project's root, either slash");
ok(throws(() => options(["--owner", "x", "--npm", "../out"])) && throws(() => options(["--owner", "x", "--npm", "/abs"])) && throws(() => options(["--owner", "x", "--npm", "a b"])) && throws(() => options(["--owner", "x", "--npm", "a/../../b"])) && throws(() => options(["--owner", "x", "--npm", "$(x)"])), "a folder outside the project, or one that is more than a path, stops it");
ok(options(["--owner", "x", "--name", "A fine project"]).name === "A fine project" && throws(() => options(["--owner", "x", "--name", "two\nlines"])) && throws(() => options(["--owner", "x", "--name", "{{pin}}"])) && throws(() => options(["--owner", "x", "--name", "a | b"])) && throws(() => options(["--owner", "x", "--name", " padded "])), "a name is one line that can break no table, template or code span");

// what the templates become
ok(modules(["b.md", "game-design.md", "a.md"], false) === "`a.md`, `b.md`" && modules(["b.md", "game-design.md"], true) === "all", "a game takes every module, any other project each but the games' own, by name");
ok(fill("{{owner}} at {{pin}}", { owner: "x", pin: A }) === `x at ${A}` && throws(() => fill("{{owner}} {{other}}", { owner: "x" })), "a template's words are filled in, and one left unfilled fails");
const marks = sizes({ "a.md": 1000, "b.md": 1500 });
ok(marks.each === 20480 && marks.read["a.md"] === 20480 && marks.total === 4096 && marks.split === 51200, "the first marks: about 20 KB a file, the total a whole KB above what the files come to, with one to spare");
ok(JSON.stringify(licences({}, () => true)) === JSON.stringify({ ships: [], audit: "checks/licences-audit.json", scan: { served: [], skip: [] } }), "the first licence config: nothing ships, and no npm file where the project has no npm");
ok(licences({ packages: "tools" }, f => f === "tools/package-lock.json").lockfiles.join() === "tools/package-lock.json" && licences({ packages: "tools" }, () => false).lockfiles.length === 0 && licences({ packages: "." }, () => true).ignoreScriptsIn.join() === ".npmrc", "of npm's files only those that stand are named, from the project's root");

const templates = [];
const walk = dir => { for (const e of fs.readdirSync(path.join(root, "setup/template", dir), { withFileTypes: true })) e.isDirectory() ? walk(path.posix.join(dir, e.name)) : templates.push(path.posix.join(dir, e.name)); };
walk("");
ok(templates.every(t => t.endsWith(".tmpl")), "every file of the kit ends in .tmpl, so no tool or check takes one for the real thing", templates.filter(t => !t.endsWith(".tmpl")).join());
const listed = new Set([...FILES.map(([t]) => t), "dependabot-npm.yml.tmpl"]);
ok(templates.every(t => listed.has(t)) && [...listed].every(t => templates.includes(t)), "every template is listed in FILES, and every listed one is there", [...templates.filter(t => !listed.has(t)), ...[...listed].filter(t => !templates.includes(t))].join());
ok(new Set(FILES.map(([, to]) => to)).size === FILES.length, "no two templates become the same file");

// every call a template makes: to a workflow the core has, that can be called, with each input it requires
const names = fs.readdirSync(path.join(root, ".github/workflows"));
for (const [template] of FILES.filter(([t]) => t.startsWith("workflows/"))) {
  const text = fs.readFileSync(path.join(root, "setup/template", template), "utf8");
  const calls = [...text.matchAll(/^\s+uses: (\S+)$/gm)].map(m => m[1]);
  const name = /^\{\{core\}\}\/\.github\/workflows\/([\w.-]+\.yml)@\{\{pin\}\}$/.exec(calls[0] ?? "")?.[1];
  ok(calls.length === 1 && name && names.includes(name), `${template} makes one call, to a workflow of the core's, at the pin`, calls.join());
  if (!name || !names.includes(name)) continue;
  const called = fs.readFileSync(path.join(root, ".github/workflows", name), "utf8");
  const required = [...called.matchAll(/^ {6}(\w+):\r?\n(?: {8}.*\r?\n)*? {8}required: true/gm)].map(m => m[1]);
  ok(/^ {2}workflow_call:/m.test(called) && required.every(input => new RegExp(`^ {6}${input}: \\S`, "m").test(text)), `${template} calls a workflow that can be called, and gives it ${required.join(", ") || "nothing, as it requires nothing"}`);
  ok(!/pull_request_target/.test(text) && /^permissions:\r?\n {2}contents: read$/m.test(text) || name === "delete-merged-branches.yml", `${template} starts from contents: read`);
}
// what the README leaves to the templates to say (its point 5 points here for them): each workflow's triggers and permissions
const template = name => fs.readFileSync(path.join(root, "setup/template/workflows", name), "utf8").replace(/\r\n/g, "\n");
ok(template("pr-description.yml.tmpl").includes("on:\n  pull_request:\n    types: [opened, edited, reopened, synchronize, ready_for_review]\n"), "the description check runs when a pull request opens, is edited, reopened, pushed to or marked ready");
ok(template("security-review.yml.tmpl").includes("on:\n  pull_request:\n    types: [opened, reopened, synchronize, ready_for_review]\n  issue_comment:\n    types: [created, edited]\n") && template("security-review.yml.tmpl").includes("permissions:\n  contents: read\n  pull-requests: read\n  statuses: write\n"), "the security-review check has its two triggers and its three permissions");
ok(/^on:\n  schedule:\n    - cron: '\d+ \d+ \* \* \*'.*\n  workflow_dispatch:\n/m.test(template("core-moved.yml.tmpl")) && template("core-moved.yml.tmpl").includes("    permissions:\n      contents: read\n      issues: write\n"), "the core-moved check runs daily or by hand, in a job that may read the repository and write issues");
const whole = files({ owner: "someone", name: "P", packages: "tools" }, A, ["git.md"]).map(([, text]) => text).join("\n");
ok(!/\{\{[a-z]+\}\}/.test(whole) && whole.includes("${{ secrets.PERSONAL_TERMS }}") && whole.includes(`uses: ${CORE}/.github/workflows/core.yml@${A}`) && whole.includes(`dependency-name: "${CORE}*"`), "filled in, no template word is left and GitHub's own expressions stand as written, each call is to the core's own address at the pin, and Dependabot leaves those calls alone");

// the program whole: a scratch copy of the core as it stands here, and a scratch project
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "init-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
Object.assign(env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" });
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const run = (dir, ...args) => { const r = spawnSync(process.execPath, args, { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: r.stdout + r.stderr }; };
const core = path.join(tmp, "the-core");
fs.cpSync(root, core, { recursive: true, filter: src => path.basename(src) !== ".git" && path.basename(src) !== "node_modules" });
git(core, "init", "-q", "-b", "main");
git(core, "add", "-A");
git(core, "commit", "-q", "-m", "the core as it stands");
const pin = git(core, "rev-parse", "HEAD");
const script = path.join(core, "scripts", "init.mjs");
const project = (name, ...args) => {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir);
  git(dir, "init", "-q", "-b", "main");
  return { dir, ...run(dir, script, ...args) };
};

const p = project("a-project", "--owner", "someone-else", "--npm", "tools");
const has = f => fs.existsSync(path.join(p.dir, f)), read = f => fs.readFileSync(path.join(p.dir, f), "utf8");
ok(p.status === 0 && p.out.includes("The starter kit is written") && p.out.includes("FILL IN"), "it writes a project and says what is left", p.out.slice(0, 600));
if (p.status === 0) {
  ok(FILES.every(([, to]) => has(to)) && has("checks/sizes.json") && has("checks/licences.json") && has("checks/copies-baseline.json") && has("core/floor/security.md") && !has("core/reports"), "every file is there, with the copy of the core, without what the core keeps to itself");
  const manifest = read("core-manifest.md");
  ok(new RegExp(`^Core: ${CORE_SOURCE} at ${pin}, copied whole under core/`, "m").test(manifest) && /^\| \*owner's account\* \| `someone-else` \|$/m.test(manifest), "the manifest pins the commit and names the owner's account, as core.yml reads them");
  ok(read("AGENTS.md").startsWith("# a-project\n") && read(".github/workflows/signatures.yml").includes("directory: tools") && read(".github/dependabot.yml").includes('directory: "/tools"') && read(".github/ISSUE_TEMPLATE/bug_report.md").includes("assignees: someone-else"), "the project's name is its folder's, and the npm folder and the owner are where they belong");
  ok(JSON.parse(read(".claude/settings.json")).hooks.PreToolUse[0].hooks[0].command.includes("core/scripts/helper-call.mjs") && JSON.parse(read("checks/licences-audit.json")).entries.length === 0, "the settings and the audit are JSON, and the hooks are the core's");
  ok(git(p.dir, "status", "--porcelain").split("\n").every(l => l.startsWith("A  ")), "everything it wrote is staged, and nothing else is touched");
  git(p.dir, "commit", "-q", "-m", "the starter kit");
  for (const [what, ...args] of [
    ["the pointer check", "core/scripts/pointers.mjs"],
    ["the workflow check", "core/scripts/workflows.mjs"],
    ["the copies check", "core/scripts/copies.mjs", "checks/copies.json"],
    ["the licence check", "core/scripts/licences.mjs", "checks/licences.json"],
    ["the reading-size check", "core/scripts/reading-size.mjs", "checks/sizes.json"],
  ]) {
    const r = spawnSync(process.execPath, args, { cwd: p.dir, env: { ...env, SIZES_BASE: "HEAD" }, encoding: "utf8" });
    ok(r.status === 0, `${what} passes on the project it wrote`, (r.stdout + r.stderr).split("\n").filter(l => /FAIL|Error/.test(l)).slice(0, 5).join("\n     "));
  }
  const again = run(p.dir, script, "--owner", "someone-else");
  ok(again.status === 1 && again.out.includes("never overwrites") && git(p.dir, "status", "--porcelain") === "", "run again, it overwrites nothing and says which files stand");
}
const q = project("private-game", "--owner", "x", "--private", "--game", "--name", "A private game");
ok(q.status === 0 && !fs.existsSync(path.join(q.dir, ".github/workflows/codeql.yml")) && !fs.existsSync(path.join(q.dir, ".github/workflows/licences.yml")) && !fs.existsSync(path.join(q.dir, ".github/workflows/signatures.yml")) && fs.existsSync(path.join(q.dir, "checks/licences.json")), "a private project without npm gets no call to CodeQL, the licence workflow or the signature check, and still its licence config", q.out.slice(0, 400));
if (q.status === 0) ok(/^Floor: whole\. Modules: all\.$/m.test(fs.readFileSync(path.join(q.dir, "core-manifest.md"), "utf8")) && fs.readFileSync(path.join(q.dir, "AGENTS.md"), "utf8").startsWith("# A private game\n"), "a game takes every module, and a name given is the name used");
const r = project("no-owner");
ok(r.status === 1 && fs.readdirSync(r.dir).join() === ".git", "without an owner it writes nothing");
fs.mkdirSync(path.join(p.dir, "sub"));
ok(run(path.join(p.dir, "sub"), script, "--owner", "x").status === 1 && run(tmp, script, "--owner", "x").status === 1 && run(core, script, "--owner", "x").status === 1, "it runs only in the root of a project's repository, never in a folder below it, outside one or in the core itself");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the starter kit`);
process.exitCode = failed ? 1 : 0;
