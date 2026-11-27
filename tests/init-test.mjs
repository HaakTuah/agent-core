// Tests of the starter kit (init.mjs and setup/template/): what a command line may hold, what each template becomes,
// that every call a template makes names a workflow the core has and gives it what it requires, and the program whole:
// from a scratch copy of the core as it stands here, it writes a scratch project, on which the core's own checks then
// run (the pointer, workflow, copies, licence and reading-size checks), so a template that no longer fits the core
// fails here and not in a project. On Linux and on Windows. Git, tar and Node's own modules only.
//
//   node tests/init-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, CORE_SOURCE } from "../scripts/core-address.mjs";
import { COMMAND } from "../scripts/helper-call.mjs";
import { FILES, files, fill, filtered, GAME_ROWS, licences, linked, modules, named, options, READ, READY_ONLY, sizes, startOf, TEMPLATES } from "../scripts/init.mjs";
import { scratch, scratchDir, scratchEnv } from "../scripts/scratch-core.mjs";
import { parseYaml } from "../scripts/parse-yaml.mjs";
import { evaluate } from "../scripts/workflow-run.mjs";
import { mended } from "../scripts/mend.mjs";
import { BLOB_MAX, readBlobs } from "../scripts/blobs.mjs";

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
ok(options(["--owner", "x", "--game", "--pages", "Build (web)"]).pages === "Build (web)" && options(["--owner", "x", "--versions"]).versions === "checks/versions.json"
  && throws(() => options(["--owner", "x", "--pages", "build"])) && ["", "a\"b", "${{ github.token }}", "a\nb", "-x", "x".repeat(101)].every(n => throws(() => options(["--owner", "x", "--game", "--pages", n]))),
  "a game's build is named in one plain form, for a game alone, and the versions check takes the kit's config (#1095, point 6)");
ok(options(["--owner", "x", "--npm", "tools/"]).packages === "tools" && options(["--owner", "x", "--npm", "."]).packages === "." && options(["--owner", "x", "--npm", "a\\b"]).packages === "a/b", "the npm folder is read from the project's root, either slash");
ok(throws(() => options(["--owner", "x", "--npm", "../out"])) && throws(() => options(["--owner", "x", "--npm", "/abs"])) && throws(() => options(["--owner", "x", "--npm", "a b"])) && throws(() => options(["--owner", "x", "--npm", "a/../../b"])) && throws(() => options(["--owner", "x", "--npm", "$(x)"])), "a folder outside the project, or one that is more than a path, stops it");
ok(options(["--owner", "x", "--nuget", "src\\"]).nuget === "src" && options(["--owner", "x", "--nuget", "."]).nuget === "." && options(["--owner", "x", "--npm", "web", "--nuget", "."]).packages === "web" && throws(() => options(["--owner", "x", "--nuget", "../out"])) && throws(() => options(["--owner", "x", "--nuget"])), "the NuGet folder is held to the same form, with the npm folder or without it");
ok(options(["--owner", "x", "--name", "A fine project"]).name === "A fine project" && named("Bark & Bite (2nd), v1.0!") && named("Tr\u00e6na's tool") && named("x") && named("Snake: the game") && named("C# tools"), "a name is letters, digits and blanks, with the few marks a name uses");
ok(named("\u0939\u093f\u0928\u094d\u0926\u0940") && named("Cafe\u0301") && options(["--owner", "x", "--name", "Cafe\u0301"]).name === "Caf\u00e9" && !named("\u0301x"), "a script written with marks on its letters is a name too, a letter and its accent are read as the one letter, and a mark alone begins no name");
ok(filtered("filter.x.clean sh -c evil\nfilter.lfs.required true\nFILTER.Y.process run\nfilter.x.clean again\n").join() === "filter.x.clean,FILTER.Y.process" && filtered("").length === 0, "a project's own filters that run a command are found by name, and one that runs none is not");
for (const [what, bad] of [["a line break", "two\nlines"], ["a template's word", "{{pin}}"], ["a bar", "a | b"], ["blanks around it", " padded "], ["a blank at its end", "padded "], ["an @, which Claude Code reads as a file to take in", "Try @~/.ssh/id_rsa"], ["an @ at its start", "@AGENTS.md"], ["a tab", "a\tb"], ["a line separator", "a\u2028b"], ["a control character", "a\u0007b"], ["a backtick", "a`b"], ["an angle bracket", "a<b"], ["a dash at its start", "-x"], ["81 characters", "x".repeat(81)], ["nothing", ""]]) {
  ok(!named(bad) && throws(() => options(["--owner", "x", "--name", bad])), `a name with ${what} is refused`);
}

// what the templates become
ok(modules(["b.md", "game-design.md", "a.md"], false) === "`a.md`, `b.md`" && modules(["b.md", "game-design.md"], true) === "all", "a game takes every module, any other project each but the games' own, by name");
ok(fill("{{owner}} at {{pin}}", { owner: "x", pin: A }) === `x at ${A}` && throws(() => fill("{{owner}} {{other}}", { owner: "x" })), "a template's words are filled in, and one left unfilled fails");
const marks = sizes({ "a.md": 1000, "b.md": 1500, "core/floor/security.md": 9000 });
ok(marks.each === 20480 && marks.read["a.md"] === 20480 && marks.read["core/floor/security.md"] === 20480 && marks.total === 4096 && marks.split === 51200, "the first marks: about 20 KB a file, the project's own total a whole KB above what its files come to, with one to spare, the core's copy held to the core's own cap");
ok(JSON.stringify(licences({}, () => true)) === JSON.stringify({ ships: [], audit: "checks/licences-audit.json", scan: { served: [], skip: [] } }), "the first licence config: nothing ships, and no npm file where the project has no npm");
ok(licences({ packages: "tools" }, f => f === "tools/package-lock.json").lockfiles.join() === "tools/package-lock.json" && licences({ packages: "tools" }, () => false).lockfiles.length === 0 && licences({ packages: "." }, () => true).ignoreScriptsIn.join() === ".npmrc", "of npm's files only those that stand are named, from the project's root");

const templates = [];
const walk = dir => { for (const e of fs.readdirSync(path.join(root, TEMPLATES, dir), { withFileTypes: true })) e.isDirectory() ? walk(path.posix.join(dir, e.name)) : templates.push(path.posix.join(dir, e.name)); };
walk("");
ok(templates.every(t => t.endsWith(".tmpl")), "every file of the kit ends in .tmpl, so no tool or check takes one for the real thing", templates.filter(t => !t.endsWith(".tmpl")).join());
const listed = new Set([...FILES.map(([t]) => t), "dependabot-npm.yml.tmpl", "dependabot-nuget.yml.tmpl", "workflows/nuget-paths.yml.tmpl"]);
ok(templates.every(t => listed.has(t)) && [...listed].every(t => templates.includes(t)), "every template is listed in FILES, and every listed one is there", [...templates.filter(t => !listed.has(t)), ...[...listed].filter(t => !templates.includes(t))].join());
ok(new Set(FILES.map(([, to]) => to)).size === FILES.length, "no two templates become the same file");

// every call a template makes: to a workflow the core has, that can be called, with each input it requires
const names = fs.readdirSync(path.join(root, ".github/workflows"));
for (const [template] of FILES.filter(([t]) => t.startsWith("workflows/"))) {
  const text = fs.readFileSync(path.join(root, TEMPLATES, template), "utf8");
  const calls = [...text.matchAll(/^\s+uses: (\S+)$/gm)].map(m => m[1]);
  const callees = calls.map(call => /^\{\{core\}\}\/\.github\/workflows\/([\w.-]+\.yml)@\{\{pin\}\}$/.exec(call)?.[1]);
  ok(calls.length > 0 && callees.every(name => name && names.includes(name)), `${template} makes its calls each to a workflow of the core's, at the pin`, calls.join());
  for (const name of callees.filter(name => name && names.includes(name))) {
    const called = fs.readFileSync(path.join(root, ".github/workflows", name), "utf8");
    const required = [...called.matchAll(/^ {6}(\w+):\r?\n(?: {8}.*\r?\n)*? {8}required: true/gm)].map(m => m[1]);
    ok(/^ {2}workflow_call:/m.test(called) && required.every(input => new RegExp(`^ {6}${input}: \\S`, "m").test(text)), `${template} calls a workflow that can be called, and gives it ${required.join(", ") || "nothing, as it requires nothing"}`);
  }
  ok(!/pull_request_target/.test(text) && /^permissions:\r?\n {2}contents: read\r?\n\r?\njobs:/m.test(text), `${template} gives the whole workflow contents: read and nothing more; what a job needs beyond it, the job asks for`);
}
// what the README leaves to the templates to say (its point 5 points here for them): each workflow's triggers and permissions
const template = name => fs.readFileSync(path.join(root, TEMPLATES, "workflows", name), "utf8").replace(/\r\n/g, "\n");
ok(template("pr-description.yml.tmpl").includes("on:\n  pull_request:\n    types: [opened, edited, reopened, synchronize, ready_for_review]\n"), "the description check runs when a pull request opens, is edited, reopened, pushed to or marked ready");
ok(template("security-review.yml.tmpl").includes("on:\n  pull_request:\n    types: [opened, reopened, synchronize, ready_for_review]\n  issue_comment:\n    types: [created, edited]\n") && template("security-review.yml.tmpl").includes("    permissions:\n      contents: read\n      pull-requests: read\n      statuses: write\n"), "the security-review check has its two triggers, and its job its three permissions");
ok(/^on:\n  schedule:\n    - cron: '\d+ \d+ \* \* \*'.*\n  workflow_dispatch:\n/m.test(template("look.yml.tmpl")) && template("look.yml.tmpl").replace(/ # .*$/gm, "").includes("    permissions:\n      contents: read\n      issues: write\n      pull-requests: read\n      checks: read\n      statuses: read\n"), "the daily look runs daily or by hand, in a job that may read the repository, its pull requests, checks and statuses, and write issues");
ok(template("preview.yml.tmpl").includes("on:\n  workflow_run:\n    workflows: [{{build}}]\n    types: [completed]\n") && template("preview.yml.tmpl").replace(/ # .*$/gm, "").includes("    permissions:\n      contents: write\n      actions: read\n      pull-requests: write\n    uses:"), "a game's previews run once its build has run, in a job that may push gh-pages, read the build's artifact and comment, as the core's preview.yml asks of its caller");
ok(/^on:\n  schedule:\n    - cron: '\d+ \d+ \d+ \* \*'.*\n  workflow_dispatch:\n/m.test(template("versions.yml.tmpl")) && template("versions.yml.tmpl").replace(/ # .*$/gm, "").includes("    permissions:\n      contents: read\n      issues: write\n    uses:"), "the versions check runs monthly or by hand, in a job that may read the repository and write issues, as the core's versions.yml asks of its caller");
const fromFolder = name => fs.readFileSync(path.join(root, TEMPLATES, name), "utf8");
const whole = files({ owner: "someone", name: "P", packages: "tools" }, A, ["git.md"], fromFolder).map(([, text]) => text).join("\n");
ok(JSON.stringify(startOf(Object.fromEntries(files({ owner: "someone", name: "P" }, A, ["git.md"], fromFolder)))) === JSON.stringify(READ)
  && JSON.stringify(startOf({ "AGENTS.md": "@core/floor/security.md\n@core/modules/git.md\n", "CLAUDE.md": "@AGENTS.md\n@core/modules/claude.md\n" })) === JSON.stringify([...READ.filter(f => !f.startsWith("core/")), "core/floor/security.md", "core/modules/git.md", "core/modules/claude.md", "core/modules/other-builders.md"]),
  "the start files the kit measures are those its own entry files name: for the kit as it stands the list it holds, and for a kit from before the rules moved the paths that kit names");
const dependabot = o => files({ owner: "someone", name: "P", ...o }, A, ["git.md"], fromFolder).find(([to]) => to === ".github/dependabot.yml")[1];
const ecosystems = text => (text.match(/package-ecosystem: "/g) ?? []).length;
ok(dependabot({ nuget: "." }).includes('package-ecosystem: "nuget"\n    directory: "/"\n') && ecosystems(dependabot({ nuget: "." })) === 2 && dependabot({ nuget: "src" }).includes('directory: "/src"\n') && ecosystems(dependabot({})) === 1 && !dependabot({}).includes("nuget"), "a project whose packages come from NuGet gets Dependabot's updates for them, for its folder, beside the actions' own, and one that named no installer gets the actions' alone");
// a private repository's checks without a secret run as steps of core.yml's one job (#376): its call given the copies
// check's config and marks, the description check, whose types it takes, and the package check of the project's kind,
// with no call of its own to those checks; a public one keeps a call to each
const kitOf = o => Object.fromEntries(files({ owner: "someone", name: "P", ...o }, A, ["git.md"], fromFolder).map(([to, text]) => [to, text]));
ok(!kitOf({ game: true })[".github/workflows/preview.yml"] && !kitOf({})[".github/workflows/versions.yml"] && kitOf({ game: true, pages: "Build (web)" })[".github/workflows/preview.yml"].includes('    workflows: ["Build (web)"]\n') && parseYaml(kitOf({ game: true, pages: "Build (web)" })[".github/workflows/preview.yml"]).on.workflow_run.workflows[0] === "Build (web)"
  && parseYaml(kitOf({ versions: "checks/versions.json" })[".github/workflows/versions.yml"]).jobs.versions.with.config === "checks/versions.json",
  "the kit writes a game's preview.yml, its build named, and the versions check's call, only where they were asked for (#1095, point 6)");
const oneCall = o => parseYaml(kitOf({ private: true, ...o })[".github/workflows/core.yml"]);
const withNuget = oneCall({ nuget: "." }), withNpm = oneCall({ packages: "tools" }), withBoth = oneCall({ packages: "web", nuget: "." }), withNone = oneCall({});
const separate = to => /\/(copies|pr-description|signatures|nuget)\.yml$/.test(to);
ok(withNuget.jobs.core.with.nuget === "checks/licences.json" && withNuget.jobs.core.with.signatures === undefined && withNpm.jobs.core.with.signatures === "tools" && withNpm.jobs.core.with.nuget === undefined
  && withBoth.jobs.core.with.signatures === "web" && withBoth.jobs.core.with.nuget === "checks/licences.json" && withNone.jobs.core.with.signatures === undefined && withNone.jobs.core.with.nuget === undefined
  && JSON.stringify(withNone.jobs.core.with) === JSON.stringify({ copies: "checks/copies.json", sizes: "checks/sizes.json", description: true }) && withNone.on.pull_request.types.join() === "opened,edited,reopened,synchronize,ready_for_review"
  && !Object.keys(kitOf({ private: true, packages: "web", nuget: "." })).some(separate) && Object.keys(kitOf({ packages: "web", nuget: "." })).filter(separate).length === 4 && parseYaml(kitOf({ packages: "web" })[".github/workflows/core.yml"]).jobs.core.with === undefined,
  "a private project's one call is given the copies check's files, the description check and the package checks of its kind, and its types take in an edited description, with no call of its own to those; a public one's calls are each its own", JSON.stringify([withNuget, withNpm, withNone]));
// a private repository's pull-request checks start only once a pull request is ready (#375): each call also triggers
// when one is marked ready, its job skipped on a draft and run on a push to main; a public one's as they were
const callsOf = o => Object.fromEntries(files({ owner: "someone", name: "P", nuget: ".", packages: ".", ...o }, A, ["git.md"], fromFolder).filter(([to]) => READY_ONLY.includes(to)).map(([to, text]) => [to, parseYaml(text)]));
const privateCalls = callsOf({ private: true }), publicCalls = callsOf({});
const asked = (wf, action, draft, event = "pull_request") => Object.values(wf.jobs).map(job => evaluate(String(job.if ?? "true").replace(/^\$\{\{|\}\}$/g, ""), { github: { event_name: event, event: event === "pull_request" ? { action, pull_request: { draft } } : {} } }))
  .every(Boolean) && (event !== "pull_request" || (wf.on.pull_request?.types ?? ["opened", "reopened", "synchronize"]).includes(action));
ok(Object.keys(privateCalls).length === READY_ONLY.length && Object.values(privateCalls).every(wf => !asked(wf, "synchronize", true) && !asked(wf, "opened", true) && asked(wf, "ready_for_review", false) && asked(wf, "synchronize", false) && asked(wf, "opened", false) && (!wf.on.push || asked(wf, null, null, "push")))
  && privateCalls[".github/workflows/personal-terms.yml"].on.pull_request.types.join() === "opened,edited,synchronize,reopened,ready_for_review" && privateCalls[".github/workflows/core.yml"].on.pull_request.types.join() === "opened,edited,reopened,synchronize,ready_for_review"
  && Object.values(publicCalls).every(wf => asked(wf, "synchronize", true) && Object.values(wf.jobs).every(job => job.if === undefined)),
  "a private project's calls to the core's pull-request checks start no job on a push to a draft, and each once it is marked ready, pushed to once ready or opened ready, and on a push to main; its personal-terms call keeps its own types, and the one job lists ready_for_review once; a public one's start on every push as before", JSON.stringify(privateCalls));
const both = dependabot({ packages: "web", nuget: "." });
ok(ecosystems(both) === 3 && both.indexOf('directory: "/web"') > 0 && both.indexOf('directory: "/web"') < both.indexOf('"nuget"') && (both.match(/^version: 2$/gm) ?? []).length === 1, "a project with both installers gets both, in one config");
ok(JSON.parse(fromFolder("claude-settings.json.tmpl")).hooks.PreToolUse[0].hooks[0].command === COMMAND, "the helper hook's command in the settings template is, letter for letter, the one helper-call.mjs holds and its test runs");
ok(fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8") === fromFolder("claude-settings.json.tmpl").replaceAll(":core/scripts/", ":scripts/"), "the core's own settings are the kit's, its hooks reading main's scripts/ where a project's read core/scripts/ (floor rule 3)");
ok(!/\{\{[a-z]+\}\}/.test(whole) && whole.includes("${{ secrets.PERSONAL_TERMS }}") && whole.includes(`uses: ${CORE}/.github/workflows/core.yml@${A}`) && whole.includes(`dependency-name: "${CORE}*"`), "filled in, no template word is left and GitHub's own expressions stand as written, each call is to the core's own address at the pin, and Dependabot leaves those calls alone");

// the program whole: a scratch copy of the core as it stands here, and a scratch project
const { tmp, env, git, run, core, pin, script, fresh, project } = scratch("init-test-");

const p = project("a-project", "--owner", "someone-else", "--npm", "tools");
const has = f => fs.existsSync(path.join(p.dir, f)), read = f => fs.readFileSync(path.join(p.dir, f), "utf8");
ok(p.status === 0 && p.out.includes("The starter kit is written") && p.out.includes("FILL IN"), "it writes a project and says what is left", p.out.slice(0, 600));
if (p.status === 0) {
  ok(FILES.every(([, to, when]) => has(to) === (!when || !!when({ packages: "tools" }))) && has("checks/sizes.json") && has("checks/licences.json") && has("checks/copies-baseline.json") && has("checks/shape-baseline.json") && has("core/floor/security.md") && !has("core/reports"), "every file its options ask for is there and no other of the kit's, with the copy of the core, without what the core keeps to itself");
  const manifest = read("core-manifest.md");
  ok(new RegExp(`^Core: ${CORE_SOURCE} at ${pin}, copied whole under core/`, "m").test(manifest) && /^\| \*owner's account\* \| `someone-else` \|$/m.test(manifest), "the manifest pins the commit and names the owner's account, as core.yml reads them");
  ok(read("AGENTS.md").startsWith("# a-project\n") && read(".github/workflows/signatures.yml").includes('directory: "tools"') && read(".github/dependabot.yml").includes('directory: "/tools"') && read(".github/ISSUE_TEMPLATE/bug_report.md").includes("assignees: someone-else"), "the project's name is its folder's, and the npm folder and the owner are where they belong");
  ok(JSON.parse(read(".claude/settings.json")).hooks.PreToolUse[0].hooks[0].command.includes("core/scripts/helper-call.mjs") && JSON.parse(read("checks/licences-audit.json")).entries.length === 0, "the settings and the audit are JSON, and the hooks are the core's");
  ok(git(p.dir, "status", "--porcelain").split("\n").every(l => l.startsWith("A  ")), "everything it wrote is staged, and nothing else is touched");
  git(p.dir, "commit", "-q", "-m", "the starter kit");
  for (const [what, ...args] of [
    ["the pointer check", "core/scripts/pointers.mjs"],
    ["the workflow check", "core/scripts/workflows.mjs"],
    ["the copies check", "core/scripts/copies.mjs", "checks/copies.json"],
    ["the shape check", "core/scripts/shape.mjs"],
    ["the licence check", "core/scripts/licences.mjs", "checks/licences.json"],
    ["the reading-size check", "core/scripts/reading-size.mjs", "checks/sizes.json"],
  ]) {
    const r = spawnSync(process.execPath, args, { cwd: p.dir, env: { ...env, SIZES_BASE: "HEAD" }, encoding: "utf8" });
    ok(r.status === 0, `${what} passes on the project it wrote`, (r.stdout + r.stderr).split("\n").filter(l => /FAIL|Error/.test(l)).slice(0, 5).join("\n     "));
  }
  // (the core's copy may grow, as a sync brings it, past the project's own total, and the check still passes; the
  // project's own files may not)
  const sizeCheck = () => spawnSync(process.execPath, ["core/scripts/reading-size.mjs", "checks/sizes.json"], { cwd: p.dir, env: { ...env, SIZES_BASE: "HEAD" }, encoding: "utf8" });
  const grow = (f, n) => { const at = path.join(p.dir, f), was = fs.readFileSync(at, "utf8"); fs.writeFileSync(at, `${was}${"x".repeat(n)}\n`); return () => fs.writeFileSync(at, was); };
  let undo = grow("core/floor/security.md", 3000);
  const coreGrew = sizeCheck();
  undo();
  undo = grow("AGENTS.md", 3000);
  const ownGrew = sizeCheck();
  undo();
  ok(coreGrew.status === 0 && ownGrew.status === 1 && /project's own files every session reads total .*\. Mend: make them smaller/.test(ownGrew.stderr) && mended(ownGrew.stderr), "the core's copy grown by a sync fails no project's total; the project's own files grown past it do", `${coreGrew.stderr}${ownGrew.stdout}`);
  // (a listing of the tracked paths past 1 MB, Node's default buffer for what git prints, is read whole, and where git cannot
  // list at all the check fails saying so, with its mend: #1204; the index is put back after each)
  const indexAt = path.join(p.dir, ".git/index"), indexWas = fs.readFileSync(indexAt);
  const blob = spawnSync("git", ["hash-object", "-w", "--stdin"], { cwd: p.dir, input: "", encoding: "utf8" }).stdout.trim();
  // (the form is "mode SP sha SP stage TAB path": a tab before the stage names a path with a tab, which Windows refuses, and the
  // refusals, 30000 lines, kill git past the buffer and leave index.lock behind: #1234)
  const added = spawnSync("git", ["update-index", "--add", "--index-info"], { cwd: p.dir, encoding: "utf8", input: Array.from({ length: 30000 }, (_, i) => `100644 ${blob} 0\tgenerated/folder-${i}/a-file-with-a-path-of-fifty-characters-${i}.txt\n`).join("") });
  const firstAt = "generated/folder-0/a-file-with-a-path-of-fifty-characters-0.txt";
  ok(added.status === 0 && spawnSync("git", ["ls-files", "--", firstAt], { cwd: p.dir, encoding: "utf8" }).stdout.trim() === firstAt, "the 30000 tracked paths the listing test needs are written to the index, each as the path it names", `${added.error ?? ""} ${String(added.stderr).slice(0, 300)}`);
  const longList = sizeCheck();
  fs.writeFileSync(indexAt, "not an index");
  const noList = sizeCheck();
  fs.writeFileSync(indexAt, indexWas);
  ok(longList.status === 0 && !/ENOBUFS/.test(longList.stderr), "a project whose tracked paths list past 1 MB passes the reading-size check, the listing read whole", `${longList.stdout}${longList.stderr}`);
  ok(noList.status === 1 && mended(noList.stderr) && /git could not list the tracked paths/.test(noList.stderr) && !/at .*\.mjs:\d+/.test(noList.stderr), "where git cannot list the tracked paths, the reading-size check fails saying so, with its mend", noList.stderr);
  // (a file past the split mark that a pull request changes asks the question: no line in "past", or one with no why
  // or grown a quarter past its mark, fails with its mend; one whose line says why it stays whole passes, and one of a
  // mark alone that stood before stands as it did; #469)
  const marksAt = path.join(p.dir, "checks/sizes.json"), marksWas = fs.readFileSync(marksAt, "utf8");
  const pastAs = past => { fs.writeFileSync(marksAt, JSON.stringify({ ...JSON.parse(marksWas), past })); return sizeCheck(); };
  fs.writeFileSync(path.join(p.dir, "big.md"), `${"a line of a long record\n".repeat(2600)}`);
  git(p.dir, "add", "big.md");
  const big = fs.statSync(path.join(p.dir, "big.md")).size, why = "every reader of it reads it whole";
  const [unlisted, bare, grown, kept, within, issue] = [pastAs({}), pastAs({ "big.md": big }), pastAs({ "big.md": { mark: Math.floor(big / 1.3), why } }),
    pastAs({ "big.md": { mark: big, why } }), pastAs({ "big.md": { mark: Math.ceil(big / 1.2), why } }), pastAs({ "big.md": { mark: big, why: "#812" } })];
  // (a line of a mark alone that stood on the base stands as before: noted while its file is within it, failed past it)
  fs.writeFileSync(marksAt, JSON.stringify({ ...JSON.parse(marksWas), past: { "big.md": big } }));
  git(p.dir, "commit", "-q", "-m", "a mark alone", "--", "checks/sizes.json");
  const stood = sizeCheck();
  fs.appendFileSync(path.join(p.dir, "big.md"), "a line more\n");
  const stoodGrown = sizeCheck();
  git(p.dir, "reset", "-q", "--soft", "HEAD~1");
  // (a line that stood with its why, whose mark this pull request raises, is noted, the question asked again)
  fs.writeFileSync(marksAt, JSON.stringify({ ...JSON.parse(marksWas), past: { "big.md": { mark: big - 100, why } } }));
  git(p.dir, "commit", "-q", "-m", "a line with its why", "--", "checks/sizes.json");
  const raised = pastAs({ "big.md": { mark: big + 1000, why } });
  git(p.dir, "reset", "-q", "--soft", "HEAD~1");
  git(p.dir, "rm", "-q", "-f", "--cached", "big.md");
  fs.rmSync(path.join(p.dir, "big.md"));
  fs.writeFileSync(marksAt, marksWas);
  // (each fails nothing: the question is noted, with what answers it, and the scheduled look keeps it; #1413, point 6)
  const asks = (r, why) => r.status === 0 && !/FAIL/.test(r.stderr) && new RegExp(`big\\.md is \\d+ bytes, past the 51200-byte mark, and this PR changes it, which fails nothing: ${why}\\. Mend: ask in what ways it could be split so that someone reads less`).test(r.stdout);
  ok(asks(unlisted, 'it has no line under "past"') && asks(bare, 'its line under "past" is a mark alone, with no why') && asks(grown, 'it has grown more than a quarter past its mark of \\d+ under "past"'),
    "a changed file past the split mark with no line, a line with no why, or one grown a quarter past its mark fails nothing, its question noted with its mend", `${unlisted.stdout}${unlisted.stderr}${bare.stdout}${grown.stdout}`);
  ok(kept.status === 0 && within.status === 0 && issue.status === 0 && ![kept, within, issue].some(r => /which fails nothing/.test(r.stdout)), "a line that says why the file stays whole, or names the split's issue, passes and asks nothing, its file grown less than a quarter past its mark too", `${kept.stderr}${within.stderr}${issue.stderr}`);
  ok(stood.status === 0 && /big\.md is listed under "past" .* with a mark alone: when next you change its line/.test(stood.stdout + stood.stderr) && asks(stoodGrown, 'it has grown past its mark alone, \\d+, under "past"'),
    "a line of a mark alone that stood on the base passes while its file is within it, noted, and once the file grows past it its question is noted, failing nothing", `${stood.stdout}${stood.stderr}${stoodGrown.stdout}${stoodGrown.stderr}`);
  ok(raised.status === 0 && /big\.md: this PR raises its mark under "past" .* from \d+ to \d+, so the question is asked again/.test(raised.stdout + raised.stderr), "a mark this pull request raises on a line that stood is noted, so the reviews read its why again", `${raised.stdout}${raised.stderr}`);
  // (a copy the project adds fails the copies check, and each failure says its mend)
  undo = grow("AGENTS.md", 0);
  fs.appendFileSync(path.join(p.dir, "AGENTS.md"), `\n${fs.readFileSync(path.join(p.dir, "core/floor/security.md"), "utf8").split(/\r?\n/u).find(l => /^- It is never pushed to/u.test(l))}\n`);
  const copy = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json"], { cwd: p.dir, env, encoding: "utf8" });
  const noConfig = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/none.json"], { cwd: p.dir, env, encoding: "utf8" });
  undo();
  ok(copy.status === 1 && /a new copy: .*\. Mend: keep it in the one place/.test(copy.stderr) && mended(copy.stderr) && noConfig.status === 1 && mended(noConfig.stderr),
    "a copy the project adds fails the copies check, as does a config it cannot read, each saying its mend", `${copy.stderr}${noConfig.stderr}`);
  // (against the base, a rule file taken off SECURITY.md's list is held to the base's list, and a pathspec git cannot
  // read fails with its mend, not git's own error)
  const secAt = path.join(p.dir, "SECURITY.md"), secWas = fs.readFileSync(secAt, "utf8");
  fs.writeFileSync(secAt, secWas.replace("**the rule files:** `docs/threat-model.md`;", "**the rule files:** `AGENTS.md`;"));
  const offList = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json"], { cwd: p.dir, env: { ...env, COPIES_BASE: "HEAD" }, encoding: "utf8" });
  fs.writeFileSync(secAt, secWas);
  const cfgP = path.join(p.dir, "checks/copies.json"), cfgPWas = fs.readFileSync(cfgP, "utf8");
  // (a config named outside plain ASCII is found at the base all the same: git names it unquoted)
  const wide = path.join(p.dir, "checks/cópies.json");
  fs.writeFileSync(wide, cfgPWas);
  git(p.dir, "add", "checks/cópies.json");
  git(p.dir, "commit", "-q", "-m", "a config named outside plain ASCII");
  fs.writeFileSync(wide, JSON.stringify({ ...JSON.parse(cfgPWas), prose: [] }));
  const wideRun = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/cópies.json"], { cwd: p.dir, env: { ...env, COPIES_BASE: "HEAD" }, encoding: "utf8" });
  git(p.dir, "reset", "-q", "--hard", "HEAD~1");
  ok(wideRun.status === 1 && /checks\/cópies\.json reads \d+ files fewer than HEAD's config read/u.test(wideRun.stderr) && mended(wideRun.stderr), "a config named outside plain ASCII is held to the base's too", wideRun.stdout + wideRun.stderr);
  fs.writeFileSync(cfgP, JSON.stringify({ ...JSON.parse(cfgPWas), code: [":(bogus)x"] }));
  const badSpec = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json"], { cwd: p.dir, env, encoding: "utf8" });
  // (a pathspec above the project, whose failure names no place on this machine; a baseline outside it, refused)
  fs.writeFileSync(cfgP, JSON.stringify({ ...JSON.parse(cfgPWas), code: ["../elsewhere"] }));
  const aboveSpec = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json"], { cwd: p.dir, env, encoding: "utf8" });
  const outside = ["../baseline.json", path.join(os.tmpdir(), "baseline.json")].map((baseline) => {
    fs.writeFileSync(cfgP, JSON.stringify({ ...JSON.parse(cfgPWas), baseline }));
    return spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json", "--first"], { cwd: p.dir, env, encoding: "utf8" });
  });
  // (a first baseline under a folder linked out of the project is refused, never written there; a junction on Windows)
  const away = scratchDir("copies-away-");
  fs.symlinkSync(away, path.join(p.dir, "linked"), "junction");
  fs.writeFileSync(cfgP, JSON.stringify({ ...JSON.parse(cfgPWas), baseline: "linked/baseline.json" }));
  const linked = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json", "--first"], { cwd: p.dir, env, encoding: "utf8" });
  const wroteAway = fs.existsSync(path.join(away, "baseline.json"));
  fs.rmSync(path.join(p.dir, "linked"));
  fs.rmSync(away, { recursive: true, force: true });
  ok(linked.status === 1 && mended(linked.stderr) && /lies outside the project/u.test(linked.stderr) && !wroteAway, "a first baseline under a folder linked out of the project is refused, never written there, saying its mend", linked.stdout + linked.stderr);
  fs.writeFileSync(cfgP, cfgPWas);
  ok(aboveSpec.status === 1 && mended(aboveSpec.stderr) && !aboveSpec.stderr.includes(p.dir) && !aboveSpec.stderr.includes(fs.realpathSync(p.dir))
    && outside.every((r) => r.status === 1 && mended(r.stderr) && /the config's "baseline", .*, lies outside the project/u.test(r.stderr)) && !fs.existsSync(path.join(p.dir, "..", "baseline.json")),
    "a pathspec above the project fails naming no place on this machine, and a baseline outside the project is refused, never written, each saying its mend", `${aboveSpec.stderr}${outside.map((r) => r.stderr).join("")}`);
  ok(secWas.includes("**the rule files:** `docs/threat-model.md`;") && offList.status === 1 && /files fewer than HEAD's config read: docs\/threat-model\.md \(prose\)/u.test(offList.stderr) && mended(offList.stderr)
    && badSpec.status === 1 && /git cannot read the pathspecs :\(bogus\)x: .*\. Mend: write each as a plain git pathspec, .* in the config's "code" or "prose"/u.test(badSpec.stderr) && mended(badSpec.stderr),
    "against the base, a rule file taken off SECURITY.md's list fails, and a pathspec git cannot read fails, each saying its mend", `${offList.stderr}${badSpec.stderr}`);
  // (code that matches other code once names and numbers are set aside is reported by the copies check, and fails
  // nothing; a function past a mark, which the kit's own shape config reads from the first day, fails with its mend)
  const twin = (a, b) => [`export function ${a}(seed, ${b}) {`, `  const ${a}Start = ${b}.first(seed) + 1;`, `  let ${a}Total = ${a}Start * 2;`, `  if (${a}Total > ${b}.limit) ${a}Total = ${b}.limit - 3;`, `  for (const ${a}Item of ${b}.items) ${a}Total += ${a}Item.weight;`,
    `  const ${a}Mean = ${a}Total / (${b}.items.length || 1);`, `  const ${a}Label = ${b}.name + ": " + String(${a}Mean);`, `  ${b}.record(${a}Label, ${a}Mean, 7);`, `  while (${a}Total > 100) ${a}Total -= ${b}.step;`, `  return [${a}Start, ${a}Total, ${a}Mean];`, "}", ""].join("\n");
  fs.mkdirSync(path.join(p.dir, "src"));
  fs.writeFileSync(path.join(p.dir, "src/one.js"), twin("left", "table"));
  fs.writeFileSync(path.join(p.dir, "src/two.js"), twin("right", "sheet"));
  fs.writeFileSync(path.join(p.dir, "checks/near.json"), JSON.stringify({ baseline: "checks/near-baseline.json", code: ["src"], prose: [] }));
  git(p.dir, "add", "src");
  spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/near.json", "--first"], { cwd: p.dir, env, encoding: "utf8" });
  const near = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/near.json"], { cwd: p.dir, env, encoding: "utf8" });
  ok(near.status === 0 && /note 1 run of code matches another once names and numbers are set aside/.test(near.stdout) && /^  src\/one\.js:1-10 and src\/two\.js:1-10$/m.test(near.stdout) && /no new copies \(0 old ones/.test(near.stdout),
    "code that matches other code once names and numbers are set aside is reported, and fails nothing", `${near.stdout}${near.stderr}`);
  fs.writeFileSync(path.join(p.dir, "src/long.js"), `export function long(a) {\n${"  a++;\n".repeat(70)}}\n`);
  const shaped = spawnSync(process.execPath, ["core/scripts/shape.mjs"], { cwd: p.dir, env: { ...env, SHAPE_BASE: "HEAD" }, encoding: "utf8" });
  ok(shaped.status === 1 && /1 function passes a mark/.test(shaped.stderr) && mended(shaped.stderr), "a function past a mark fails the shape check in a project the kit wrote, from its first day", `${shaped.stdout}${shaped.stderr}`);
  git(p.dir, "rm", "-rqf", "--cached", "src");
  for (const f of ["src", "checks/near.json", "checks/near-baseline.json"]) fs.rmSync(path.join(p.dir, f), { recursive: true, force: true });
  // (the core runs the same check on itself, with its own config and baseline (#339): it passes as the core stands, a
  // copy added fails, and its mend names the path a session types there, with no "core/" before it)
  // (the core without its own tests/ and the scripts the check does not import, which are most of the code it reads and
  // which no case here is about: a run costs what it reads, so each of the 23 below took about half as long; the check
  // on the core whole is the pull request's own run of it, #812)
  const imported = new Set(), queue = ["scripts/copies.mjs"];
  for (let f; (f = queue.pop()) !== undefined;) {
    if (imported.has(f)) continue;
    imported.add(f);
    for (const [, rel] of fs.readFileSync(path.join(core, f), "utf8").matchAll(/["'](\.{1,2}\/[^"'\n]+\.m?js)["']/g)) queue.push(path.posix.join(path.posix.dirname(f), rel));
  }
  git(core, "rm", "-rq", "tests");
  const unread = git(core, "ls-files", "scripts/*.mjs", "scripts/*.sh").split("\n").filter(f => f && !imported.has(f));
  for (let i = 0; i < unread.length; i += 100) git(core, "rm", "-q", ...unread.slice(i, i + 100)); // a command line is capped on Windows
  git(core, "commit", "-q", "-m", "without the core's tests and the scripts the copies check does not import");
  const coreRun = run(core, "scripts/copies.mjs", ".github/copies.json");
  const how = path.join(core, "roles/shared/how-to-work.md"), howWas = fs.readFileSync(how, "utf8");
  fs.appendFileSync(how, `\n${fs.readFileSync(path.join(core, "floor/security.md"), "utf8").split(/\r?\n/u).find(l => /^- It is never pushed to/u.test(l))}\n`);
  const ownCopy = run(core, "scripts/copies.mjs", ".github/copies.json");
  fs.writeFileSync(how, howWas);
  fs.rmSync(path.join(core, ".github/copies-baseline.json"));
  const ownNone = run(core, "scripts/copies.mjs", ".github/copies.json");
  git(core, "checkout", "-q", "--", ".github/copies-baseline.json");
  ok(coreRun.status === 0 && ownCopy.status === 1 && /a new copy: .*roles\/shared\/how-to-work\.md:.*\. Mend: keep it in the one place/u.test(ownCopy.out) && mended(ownCopy.out)
    && ownNone.status === 1 && /Mend: write the project's first with node scripts\/copies\.mjs \.github\/copies\.json --first/u.test(ownNone.out) && mended(ownNone.out),
    "the core's own copies check passes on the core without its tests and the scripts it does not import, and fails a copy added there, its mends naming the core's own paths", `${coreRun.out}${ownCopy.out}${ownNone.out}`);
  // (against the base, the config is held to the base's (#348): a baseline moved, or a file the base's config read and
  // this one does not, fails with its mend, and the mend as worded passes; a config widened passes)
  const cfgAt = path.join(core, ".github/copies.json"), cfgWas = fs.readFileSync(cfgAt, "utf8");
  const againstBase = change => {
    fs.writeFileSync(cfgAt, JSON.stringify(change(JSON.parse(cfgWas))));
    const r = spawnSync(process.execPath, ["scripts/copies.mjs", ".github/copies.json"], { cwd: core, env: { ...env, COPIES_BASE: "main" }, encoding: "utf8" });
    return { status: r.status, out: r.stdout + r.stderr };
  };
  const same = againstBase(c => c);
  fs.copyFileSync(path.join(core, ".github/copies-baseline.json"), path.join(core, ".github/moved.json"));
  const moved = againstBase(c => ({ ...c, baseline: ".github/moved.json" }));
  fs.rmSync(path.join(core, ".github/moved.json"));
  const narrowed = againstBase(c => ({ ...c, prose: c.prose.filter(p => p !== "CLAUDE.md") }));
  const narrowedCode = againstBase(c => ({ ...c, code: c.code.filter(p => p !== ".github/workflows/*.yml"), prose: [...c.prose, ".github/workflows/*.yml"] }));
  const widened = againstBase(c => ({ ...c, prose: [...c.prose, ".node-version"] }));
  git(core, "checkout", "-q", "main", "--", ".github/copies.json");
  const mendedRun = spawnSync(process.execPath, ["scripts/copies.mjs", ".github/copies.json"], { cwd: core, env: { ...env, COPIES_BASE: "main" }, encoding: "utf8" });
  const back = /Mend: take the config back as main holds it \(git checkout main -- \.github\/copies\.json\)/u;
  ok(same.status === 0 && widened.status === 0
    && moved.status === 1 && /moves the baseline from \.github\/copies-baseline\.json to \.github\/moved\.json against main/u.test(moved.out) && back.test(moved.out) && mended(moved.out)
    && narrowed.status === 1 && /reads 1 files fewer than main's config read: CLAUDE\.md \(prose\)/u.test(narrowed.out) && back.test(narrowed.out) && mended(narrowed.out)
    && narrowedCode.status === 1 && /\.github\/workflows\/[^ ]+\.yml \(code\)/u.test(narrowedCode.out) && mended(narrowedCode.out)
    && mendedRun.status === 0,
    "against the base, a baseline moved or a file left out of the config fails, saying its mend, and the mend passes; a config widened passes", `${same.out}${moved.out}${narrowed.out}${narrowedCode.out}${widened.out}${mendedRun.stdout}${mendedRun.stderr}`);
  // (a file the base's config read, renamed out of every spec, is held by its new name, and the mend as worded passes;
  // a file deleted is no narrowing; #371)
  // (each run's temporary folder is one of its own, so that the base's index, written there, is seen taken away after)
  const baseRun = (config = ".github/copies.json") => {
    const scratchTmp = fs.mkdtempSync(path.join(tmp, "copies-tmp-"));
    const r = spawnSync(process.execPath, ["scripts/copies.mjs", config], { cwd: core, env: { ...env, COPIES_BASE: "main", TMPDIR: scratchTmp, TEMP: scratchTmp, TMP: scratchTmp }, encoding: "utf8" });
    const left = fs.readdirSync(scratchTmp);
    fs.rmSync(scratchTmp, { recursive: true, force: true });
    return { status: r.status, out: r.stdout + r.stderr + (left.length ? `\nleft in its temporary folder: ${left.join(", ")}` : ""), left: left.length };
  };
  git(core, "mv", "roles/shared/how-to-work.md", "elsewhere.md");
  const renamedOut = baseRun();
  git(core, "mv", "elsewhere.md", "roles/shared/how-to-work.md");
  git(core, "rm", "-q", "roles/shared/how-to-work.md");
  const deleted = baseRun();
  git(core, "reset", "-q", "--hard", "main");
  ok(renamedOut.status === 1 && /reads 1 files fewer than main's config read: elsewhere\.md \(prose\)\. Mend: take the config back/u.test(renamedOut.out) && mended(renamedOut.out) && deleted.status === 0 && !renamedOut.left && !deleted.left,
    "against the base, a file its config read and renamed out of every spec fails, by its new name, with its mend; one deleted passes; and the base's index is taken away after", `${renamedOut.out}${deleted.out}`);
  // (a file renamed out of every spec and rewritten past half, which git reads as deleted and added, or whose lines
  // move into a file no spec reads, is followed to the file that took in most of its lines; one that took in half or
  // less passes; #434)
  const howText = fs.readFileSync(path.join(core, "roles/shared/how-to-work.md"), "utf8");
  const fresh = Array.from({ length: howText.split("\n").length * 3 }, (_, i) => `A line of new text, the ${i}th.`).join("\n");
  git(core, "mv", "roles/shared/how-to-work.md", "elsewhere.md");
  fs.appendFileSync(path.join(core, "elsewhere.md"), `\n${fresh}\n`);
  git(core, "add", "elsewhere.md");
  const status = git(core, "diff", "-M", "--name-status", "--cached", "main");
  const rewritten = baseRun();
  git(core, "reset", "-q", "--hard", "main");
  fs.appendFileSync(path.join(core, "CHOICES.md"), `\n${howText}`);
  git(core, "rm", "-q", "roles/shared/how-to-work.md");
  git(core, "add", "CHOICES.md");
  const movedIn = baseRun();
  git(core, "reset", "-q", "--hard", "main");
  // (exactly half of a file's lines, each holding a word and counted once, is not most of them)
  const distinct = f => [...new Set(fs.readFileSync(path.join(core, f), "utf8").split("\n").map(l => l.trim()).filter(l => /[\p{L}\p{N}]/u.test(l)))];
  const even = ["roles/shared/how-to-work.md", ...fs.readdirSync(path.join(core, "tasks")).map(f => `tasks/${f}`)].find(f => f.endsWith(".md") && distinct(f).length % 2 === 0);
  fs.writeFileSync(path.join(core, "notes.md"), `${distinct(even).slice(0, distinct(even).length / 2).join("\n")}\n`);
  git(core, "rm", "-q", even);
  git(core, "add", "notes.md");
  const partly = baseRun();
  git(core, "reset", "-q", "--hard", "main");
  fs.rmSync(path.join(core, "notes.md"), { force: true });
  // (a line in any script counts: a read file of a heading and lines in another alphabet, deleted, is not taken in by a
  // file that holds the heading alone)
  const branch = git(core, "rev-parse", "--abbrev-ref", "HEAD");
  git(core, "checkout", "-q", "-b", "with-notes");
  fs.writeFileSync(path.join(core, "roles/shared/notes.md"), "# Notes\n\nПервая строка\nВторая строка\nТретья строка\n");
  git(core, "add", "roles/shared/notes.md");
  git(core, "commit", "-q", "-m", "a read file in another alphabet");
  git(core, "rm", "-q", "roles/shared/notes.md");
  fs.writeFileSync(path.join(core, "elsewhere.md"), "# Notes\n");
  git(core, "add", "elsewhere.md");
  const alphabet = spawnSync(process.execPath, ["scripts/copies.mjs", ".github/copies.json"], { cwd: core, env: { ...env, COPIES_BASE: "with-notes" }, encoding: "utf8" });
  git(core, "checkout", "-q", "-f", branch);
  git(core, "branch", "-q", "-D", "with-notes");
  git(core, "reset", "-q", "--hard", "main");
  fs.rmSync(path.join(core, "elsewhere.md"), { force: true });
  // (a read file of fewer than three lines, deleted, is followed nowhere, though a new file holds both its lines)
  git(core, "checkout", "-q", "-b", "with-stub");
  fs.writeFileSync(path.join(core, "roles/shared/stub.md"), "# Notes\nTODO\n");
  git(core, "add", "roles/shared/stub.md");
  git(core, "commit", "-q", "-m", "a read file of two lines");
  git(core, "rm", "-q", "roles/shared/stub.md");
  fs.writeFileSync(path.join(core, "log.md"), "# Notes\nTODO\nA meeting log of its own.\n");
  git(core, "add", "log.md");
  const stub = spawnSync(process.execPath, ["scripts/copies.mjs", ".github/copies.json"], { cwd: core, env: { ...env, COPIES_BASE: "with-stub" }, encoding: "utf8" });
  git(core, "checkout", "-q", "-f", branch);
  git(core, "branch", "-q", "-D", "with-stub");
  git(core, "reset", "-q", "--hard", "main");
  fs.rmSync(path.join(core, "log.md"), { force: true });
  // (a new file named "0:u.md", which git would read as the index's u.md, steers nothing: the file that took the text
  // in is named; off Windows, where a name may hold a colon)
  let decoy = null;
  if (process.platform !== "win32") {
    git(core, "rm", "-q", "roles/shared/how-to-work.md");
    fs.writeFileSync(path.join(core, "u.md"), `${howText}\n${fresh}\n`);
    fs.writeFileSync(path.join(core, "0:u.md"), "Decoy.\n");
    git(core, "add", "u.md", "0:u.md");
    decoy = baseRun();
    git(core, "reset", "-q", "--hard", "main");
    for (const f of ["u.md", "0:u.md"]) fs.rmSync(path.join(core, f), { force: true });
  }
  const tookIn = file => new RegExp(`reads 1 files fewer than main's config read: ${file} \\(prose, which took in most of the lines of roles/shared/how-to-work\\.md, deleted\\)\\. Mend: take the config back`, "u");
  ok(/^D\troles\/shared\/how-to-work\.md$/mu.test(status) && rewritten.status === 1 && tookIn("elsewhere\\.md").test(rewritten.out) && mended(rewritten.out)
    && movedIn.status === 1 && tookIn("CHOICES\\.md").test(movedIn.out) && mended(movedIn.out) && partly.status === 0 && alphabet.status === 0 && stub.status === 0
    && (decoy === null || (decoy.status === 1 && tookIn("u\\.md").test(decoy.out) && !/0:u\.md \(prose/u.test(decoy.out))),
    "against the base, a file its config read, renamed out of every spec and rewritten past half or moved into a file no spec reads, fails by the file that took in its lines, with its mend; one that took in half of them, only the lines in one alphabet of a file in two, or a file of two lines, passes; a decoy named as an index path steers nothing", `${status}${rewritten.out}${movedIn.out}${partly.out}${alphabet.stdout}${alphabet.stderr}${stub.stdout}${stub.stderr}${decoy?.out ?? ""}`);
  // (the blobs the follow reads: one batch, a binary or a file past its megabyte skipped; a read git fails, or an answer
  // cut short, fails the check with its mend, never an empty answer that would switch the follow off; #434)
  const answer = parts => (args, ids) => Buffer.from(args[1] === "--batch-check" ? parts.check(ids) : parts.read(ids), "latin1");
  const asked = [];
  const blobsRead = readBlobs(["a1", "b2", "c3", "a1"], answer({
    check: () => `a1 blob 3\nb2 blob 2\nc3 blob ${BLOB_MAX + 1}\n`,
    read: ids => { asked.push(...ids); return ids.map(id => (id === "a1" ? "a1 blob 3\nhi\n\n" : "b2 blob 2\nx\0\n")).join(""); } }));
  const gitFails = readBlobs(["a1"], () => { throw Object.assign(new Error("spawn"), { stderr: Buffer.from("fatal: not a git repository\n") }); });
  const cutShort = readBlobs(["a1"], answer({ check: () => "a1 blob 3\n", read: () => "a1 blob 3\nhi" }));
  ok(blobsRead.text?.get("a1") === "hi\n" && !blobsRead.text.has("b2") && !blobsRead.text.has("c3") && blobsRead.text.size === 1 && asked.join() === "a1,b2"
    && /^git could not read .*\(fatal: not a git repository\)/u.test(gitFails.failure) && mended(`FAIL: ${gitFails.failure}`)
    && /did not parse to its end, at byte 0 of 12/u.test(cutShort.failure) && mended(`FAIL: ${cutShort.failure}`) && readBlobs([]).text.size === 0,
    "the follow's blobs are read in one batch, a binary or a file past a megabyte skipped; a read git fails, or an answer cut short, fails with its mend", JSON.stringify([...(blobsRead.text ?? [])]) + (gitFails.failure ?? "") + (cutShort.failure ?? ""));
  // (a file of the core's copy that a sync moves out of what the project's config reads fails nothing: the core's own
  // pull request held the move)
  const coreFile = fs.readdirSync(path.join(p.dir, "core/tasks")).find(f => f.endsWith(".md"));
  git(p.dir, "mv", `core/tasks/${coreFile}`, `core/elsewhere-${coreFile}`);
  const synced = spawnSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json"], { cwd: p.dir, env: { ...env, COPIES_BASE: "HEAD" }, encoding: "utf8" });
  git(p.dir, "reset", "-q", "--hard", "HEAD");
  ok(synced.status === 0, "against the base, a file of the core's copy that a sync renames out of the project's config fails nothing", synced.stdout + synced.stderr);
  // (a config moved with the call that names it is held to the one the base called: narrowed or its baseline moved,
  // it fails with its mend; moved whole, it passes; one beside a config still called is a first, held to nothing; #370)
  const tests = path.join(core, ".github/workflows/tests.yml"), testsWas = fs.readFileSync(tests, "utf8"), cfgMain = JSON.parse(cfgWas);
  // (`keepCall`: the call still names the base's config; `shapeToo`: the shape check's config, which names a baseline
  // too, moved with its call at the same time)
  const shapeWas = fs.readFileSync(path.join(core, ".github/shape.json"), "utf8");
  const moveTo = (config, { keepCall = false, shapeToo = false, dropOld = false } = {}) => {
    const put = (at, text) => { fs.writeFileSync(path.join(core, at), text); git(core, "add", at); };
    put(".github/copies-two.json", JSON.stringify(config));
    // (the call alone moved, a comment still naming the old call, as a project's caller names its config in a comment)
    let calls = testsWas;
    if (!keepCall) calls = calls.replace("run: node scripts/copies.mjs .github/copies.json", "run: node scripts/copies.mjs .github/copies-two.json # was: node scripts/copies.mjs .github/copies.json");
    // (`dropOld`: the base's config deleted, a call to it left where it never runs)
    // (and calls to paths the system cannot look up: a name past any length, one through a file)
    if (dropOld) { git(core, "rm", "-q", ".github/copies.json"); calls = calls.replace("jobs:\n", `jobs:\n  never:\n    if: false\n    runs-on: ubuntu-latest\n    steps:\n      - run: node scripts/copies.mjs .github/copies.json\n      - run: node scripts/copies.mjs ${"n".repeat(300)}.json\n      - run: node scripts/copies.mjs AGENTS.md/x.json\n`); }
    fs.writeFileSync(tests, calls);
    if (shapeToo) {
      put(".github/shape-two.json", shapeWas);
      for (const f of fs.readdirSync(path.join(core, ".github/workflows"))) {
        const at = path.join(core, ".github/workflows", f);
        fs.writeFileSync(at, fs.readFileSync(at, "utf8").replaceAll(".github/shape.json", ".github/shape-two.json"));
      }
    }
    const r = baseRun(".github/copies-two.json");
    git(core, "reset", "-q", "--hard", "main");
    return r;
  };
  const movedNarrow = moveTo({ ...cfgMain, prose: cfgMain.prose.filter(x => x !== "CLAUDE.md") });
  const narrowDropped = moveTo({ ...cfgMain, prose: cfgMain.prose.filter(x => x !== "CLAUDE.md") }, { dropOld: true });
  fs.copyFileSync(path.join(core, ".github/copies-baseline.json"), path.join(core, ".github/moved.json"));
  const movedBaseline = moveTo({ ...cfgMain, baseline: ".github/moved.json" });
  fs.rmSync(path.join(core, ".github/moved.json"));
  const movedWhole = moveTo(cfgMain), beside = moveTo({ ...cfgMain, prose: ["README.md"] }, { keepCall: true }), withShape = moveTo(cfgMain, { shapeToo: true });
  // (two configs the base called, replaced by one: each is read on its own, so one's ":!" cancels nothing the other read)
  const two = (() => {
    const cfg = (at, prose) => { fs.writeFileSync(path.join(core, at), JSON.stringify({ baseline: cfgMain.baseline, code: [], prose })); git(core, "add", at); };
    git(core, "checkout", "-q", "-b", "two-configs");
    cfg(".github/copies-a.json", ["README.md"]);
    cfg(".github/copies-b.json", ["AGENTS.md", ":!README.md"]);
    fs.writeFileSync(tests, testsWas.replace("run: node scripts/copies.mjs .github/copies.json", "run: node scripts/copies.mjs .github/copies-a.json && node scripts/copies.mjs .github/copies-b.json"));
    git(core, "commit", "-qam", "two configs");
    cfg(".github/copies-new.json", ["AGENTS.md"]);
    fs.writeFileSync(tests, testsWas.replace("run: node scripts/copies.mjs .github/copies.json", "run: node scripts/copies.mjs .github/copies-new.json"));
    const r = spawnSync(process.execPath, ["scripts/copies.mjs", ".github/copies-new.json"], { cwd: core, env: { ...env, COPIES_BASE: "two-configs" }, encoding: "utf8" });
    git(core, "checkout", "-qf", "main");
    git(core, "branch", "-qD", "two-configs");
    return { status: r.status, out: r.stdout + r.stderr };
  })();
  ok(two.status === 1 && /reads 1 files fewer than two-configs's config read: README\.md \(prose\)/u.test(two.out) && mended(two.out), "against the base, two configs it called and one now are each read on their own: one's \":!\" leaves out nothing the other read", two.out);
  const calledInPlace = /\.github\/copies-two\.json, called in place of \.github\/copies\.json \(the config main's workflows call\),/u;
  const backMoved = /Mend: take the config back as main holds it \(git checkout main -- \.github\/copies\.json\), and name it in the call again/u;
  ok(movedNarrow.status === 1 && calledInPlace.test(movedNarrow.out) && narrowDropped.status === 1 && calledInPlace.test(narrowDropped.out) && /reads 1 files fewer than main's config read: CLAUDE\.md \(prose\)/u.test(movedNarrow.out) && backMoved.test(movedNarrow.out) && mended(movedNarrow.out)
    && movedBaseline.status === 1 && calledInPlace.test(movedBaseline.out) && /moves the baseline from \.github\/copies-baseline\.json to \.github\/moved\.json against main/u.test(movedBaseline.out) && mended(movedBaseline.out)
    && movedWhole.status === 0 && beside.status === 0 && withShape.status === 0,
    "against the base, a config moved with its call is held to the one the base called, narrowed or its baseline moved failing with its mend; moved whole, or beside one still called, or with another check's config moved too, it passes; a call left to the old config, deleted, counts for nothing", `${movedNarrow.out}${narrowDropped.out}${movedBaseline.out}${movedWhole.out}${beside.out}${withShape.out}`);
  // (the scripts back, for what runs the core's own from here: the kit's second run)
  git(core, "checkout", "-q", pin, "--", "scripts");
  git(core, "commit", "-q", "-m", "its scripts again");
  // (a total set when it counted the core's copy too passes, and a note gives the mark to set, even after the core
  // grew past the room that total had left; a total of the project's own says nothing)
  const sizesAt = path.join(p.dir, "checks/sizes.json"), was = fs.readFileSync(sizesAt, "utf8"), own = JSON.parse(was).total;
  const coreBytes = Object.keys(JSON.parse(was).read).filter(f => f.startsWith("core/")).reduce((n, f) => n + Buffer.byteLength(fs.readFileSync(path.join(p.dir, f), "utf8").replace(/\r\n/g, "\n")), 0);
  const setTotal = t => fs.writeFileSync(sizesAt, JSON.stringify({ ...JSON.parse(was), total: t }));
  setTotal(own + coreBytes + 4000);
  const roomy = sizeCheck();
  setTotal(own + 3 * coreBytes);
  const roomier = sizeCheck();
  setTotal(own + coreBytes);
  undo = grow("core/floor/security.md", 2000);
  const grownPast = sizeCheck();
  undo();
  fs.writeFileSync(sizesAt, was);
  ok(roomy.status === 0 && roomy.stdout.includes(`set it to ${own + 4000}`) && grownPast.status === 0 && grownPast.stdout.includes(`set it to ${own}`) && roomier.stdout.includes(`set it to ${own}`) && !/leaves [0-9]+ bytes of room/.test(sizeCheck().stdout),
    "a total set when it counted the core's copy passes, and a note gives the mark that keeps the project's room in one step, a KB above its own at least, after the core grew past that room too; a total of the project's own says nothing", `${roomy.stdout}\n${grownPast.stdout}\n${roomier.stdout}`);
  // (run again, the project holds the core: the kit hands it to the sync, the one process for such a project (#1083),
  // which reaches the scratch core by the core's own address; at the same pin it moves nothing, and the process finds
  // nothing to write)
  const again = spawnSync(process.execPath, [script, "--owner", "someone-else", "--at", pin], { cwd: p.dir, env: scratchEnv(core, tmp), encoding: "utf8" });
  const said = `${again.stdout}${again.stderr}`;
  ok(again.status === 0 && said.includes("taken by the sync") && said.includes("nothing to write") && git(p.dir, "status", "--porcelain") === "", "run again, it takes the project the sync's way, the same process, and changes nothing", said);
}
git(core, "reset", "-q", "--hard", pin); // (the copies cases are over: the projects below take the core whole again, tests/ and the pin as scratch() made them)
const q = project("private-game", "--owner", "x", "--private", "--game", "--name", "A private game", "--pages", "Build", "--versions");
ok(q.status === 0 && fs.readFileSync(path.join(q.dir, ".github/workflows/preview.yml"), "utf8").includes('workflows: ["Build"]') && fs.readFileSync(path.join(q.dir, ".github/workflows/versions.yml"), "utf8").includes("config: checks/versions.json") && JSON.stringify(JSON.parse(fs.readFileSync(path.join(q.dir, "checks/versions.json"), "utf8")).entries) === "[]",
  "a game served by the host's pages gets its preview.yml, and a project with versions Dependabot cannot see its versions.yml and the config it names, with no entry yet (#1095, point 6)", q.out.slice(0, 400));
ok(q.status === 0 && !fs.existsSync(path.join(q.dir, ".github/workflows/codeql.yml")) && !fs.existsSync(path.join(q.dir, ".github/workflows/licences.yml")) && !fs.existsSync(path.join(q.dir, ".github/workflows/signatures.yml")) && fs.existsSync(path.join(q.dir, "checks/licences.json")), "a private project without npm gets no call to CodeQL, the licence workflow or the signature check, and still its licence config", q.out.slice(0, 400));
// (every kind the program writes: the core's manifest check, run in the project, gives no note on its first day, #329)
for (const [what, r] of [["an npm project", p], ["a private game", q]]) {
  if (r.status !== 0) continue;
  const m = spawnSync(process.execPath, ["core/scripts/manifest-reads.mjs"], { cwd: r.dir, env, encoding: "utf8" });
  ok(m.status === 0 && m.stdout.startsWith("ok ") && !m.stdout.includes("note "), `${what}: the core's manifest check, run in it, gives no note`, m.stdout.slice(0, 600));
}
if (q.status === 0) {
  const qManifest = fs.readFileSync(path.join(q.dir, "core-manifest.md"), "utf8"), left = q.out.split("\n");
  ok(GAME_ROWS.every(([slot, what]) => qManifest.includes(`\n| *${slot}* | FILL IN: ${what} |\n`) && left.some(l => /^  core-manifest\.md:[0-9]+: /.test(l) && l.endsWith(`: ${what}`))),
    "a game's manifest has a row for each slot game-design.md uses, each left to fill and named, without its table's bar, in what is left", q.out.slice(0, 1500));
}
if (q.status === 0) ok(/^Floor: whole\. Modules: all\.$/m.test(fs.readFileSync(path.join(q.dir, "core-manifest.md"), "utf8")) && fs.readFileSync(path.join(q.dir, "AGENTS.md"), "utf8").startsWith("# A private game\n"), "a game takes every module, and a name given is the name used");
// (a project that holds JavaScript and its tests gets Stryker, and its licence config names the data the lock brings: #1247, point 1)
{
  const dir = fresh("a-project-with-tests");
  fs.writeFileSync(path.join(dir, "a.js"), "export const a = 1;\n");
  fs.writeFileSync(path.join(dir, "a.test.js"), "import { a } from './a.js';\n");
  const r = run(dir, script, "--owner", "x"), config = JSON.parse(fs.readFileSync(path.join(dir, "checks/licences.json"), "utf8"));
  ok(r.status === 0 && fs.existsSync(path.join(dir, "checks/mutation/.npmrc")) && config.data?.includes("caniuse-lite") && !r.out.includes('under "data"'), "a project with code and tests gets the list's tool, and its licence config names the data its lock brings, so nothing is left to ask of it", r.out.slice(0, 1500));
}
const t = project("a-folder-named-true", "--owner", "x", "--npm", "true");
ok(t.status === 0 && fs.readFileSync(path.join(t.dir, ".github/workflows/signatures.yml"), "utf8").includes('directory: "true"') && fs.readFileSync(path.join(t.dir, ".github/dependabot.yml"), "utf8").includes('directory: "/true"'), "a folder whose name YAML would read as something else is written in quotes, so it stays a name");
const n = project("a-dotnet-project", "--owner", "x", "--nuget", "src", "--private");
const nRead = f => fs.readFileSync(path.join(n.dir, f), "utf8");
ok(n.status === 0 && nRead(".github/workflows/core.yml").includes("      nuget: checks/licences.json\n") && !/^\s*advisory:/m.test(nRead(".github/workflows/core.yml")) && !fs.existsSync(path.join(n.dir, ".github/workflows/nuget.yml")) && JSON.stringify(JSON.parse(nRead("checks/licences.json")).nuget) === '{"ships":[],"tools":[]}' && nRead(".github/dependabot.yml").includes('directory: "/src"') && !fs.existsSync(path.join(n.dir, ".github/workflows/signatures.yml")) && n.out.includes("RestorePackagesWithLockFile"),
  "a project whose packages come from NuGet gets the NuGet check, which fails from the first day (here, private, a step of the one job), the config's part for its lock files, and is told to turn lock files on; a private one too, since that check needs nothing GitHub sells", n.out.slice(0, 400));
ok(!fs.existsSync(path.join(t.dir, ".github/workflows/nuget.yml")) && JSON.parse(fs.readFileSync(path.join(t.dir, "checks/licences.json"), "utf8")).nuget === undefined, "and one that named no NuGet folder gets neither");
ok(p.status !== 0 || /\*\*the trusted builder:\*\*\n\s+FILL IN:/.test(read("SECURITY.md")) && p.out.includes("who may change the protected files"), "who may change the protected files, where the project narrows floor rule 3, is left for the project to say, and listed with what is left");
// the kit is read from the commit, never from the clone's working folder: an edit not yet committed reaches no project
const edited = path.join(core, TEMPLATES, "workflows", "core.yml.tmpl");
const before = fs.readFileSync(edited, "utf8");
fs.writeFileSync(edited, before.replace("contents: read", "contents: write"));
const u = project("from-the-commit", "--owner", "x");
fs.writeFileSync(edited, before);
ok(u.status === 0 && fs.readFileSync(path.join(u.dir, ".github/workflows/core.yml"), "utf8").includes("contents: read") && !fs.readFileSync(path.join(u.dir, ".github/workflows/core.yml"), "utf8").includes("contents: write"), "a template edited in the clone and not committed is not what a project gets: it gets the commit's", u.out.slice(0, 300));

// links: nothing is written through one, wherever it leads, and nothing at all once one is found
ok(linked(tmp, "no/such/path") === null, "a path that is not there yet holds no link");
const outside = path.join(tmp, "outside");
fs.mkdirSync(outside);
const link = (name, to, dir) => { const at = path.join(tmp, name); fs.mkdirSync(at); git(at, "init", "-q", "-b", "main"); dir(at, to); return at; };
let canLink = true;
try { fs.symlinkSync(outside, path.join(tmp, "probe"), "dir"); } catch { canLink = false; }
if (!canLink) console.log("skip the links: this machine lets the test make none");
else {
  const a = link("linked-folder", outside, (at, to) => fs.symlinkSync(to, path.join(at, ".claude"), "dir"));
  ok(linked(a, ".claude/settings.json") === ".claude", "a link is found at the part of the path where it stands");
  const ra = run(a, script, "--owner", "x");
  ok(ra.status === 1 && ra.out.includes("writes through no link") && fs.readdirSync(outside).length === 0 && fs.readdirSync(a).sort().join() === ".claude,.git", "a folder of the project that is a link to elsewhere stops the kit before it writes anything, there or here", ra.out.slice(0, 300));
  const b = link("linked-file", path.join(outside, "missing.md"), (at, to) => fs.symlinkSync(to, path.join(at, "AGENTS.md"), "file"));
  const rb = run(b, script, "--owner", "x");
  ok(rb.status === 1 && fs.readdirSync(outside).length === 0 && fs.readdirSync(b).sort().join() === ".git,AGENTS.md", "so does a file that is a link to one not yet there: the file it names is never made", rb.out.slice(0, 300));
  const c = link("linked-core", outside, (at, to) => fs.symlinkSync(to, path.join(at, "core"), "dir"));
  const rc = run(c, script, "--owner", "x");
  ok(rc.status === 1 && fs.readdirSync(outside).length === 0, "and a core/ that is a link: the copy is written into no other folder", rc.out.slice(0, 300));
}
// git's own variables that point elsewhere: the kit still writes into the project it is run in, from the clone it lies in
const pointedDir = path.join(tmp, "pointed-elsewhere");
fs.mkdirSync(pointedDir);
git(pointedDir, "init", "-q", "-b", "main");
const pe = spawnSync(process.execPath, [script, "--owner", "x"], { cwd: pointedDir, env: { ...env, GIT_DIR: path.join(p.dir, ".git"), GIT_WORK_TREE: p.dir }, encoding: "utf8" });
ok(pe.status === 0 && fs.existsSync(path.join(pointedDir, "core-manifest.md")) && git(p.dir, "status", "--porcelain") === "" && git(pointedDir, "status", "--porcelain").includes("A  core-manifest.md"), "with git pointed at another project's repository, the kit writes and stages in the project it is run in, and leaves the other as it was", (pe.stdout + pe.stderr).slice(0, 300));
// a filter in the project's own git settings would run a command on `git add`: the kit refuses before it adds
const fdir = path.join(tmp, "with-a-filter");
fs.mkdirSync(fdir);
git(fdir, "init", "-q", "-b", "main");
const ran = path.join(tmp, "the-filter-ran");
git(fdir, "config", "--local", "filter.kit.clean", `${JSON.stringify(process.execPath)} -e "require('fs').writeFileSync(process.argv[1], '')" ${JSON.stringify(ran)}`);
fs.writeFileSync(path.join(fdir, ".gitattributes"), "* filter=kit\n");
const rf = run(fdir, script, "--owner", "x");
ok(rf.status === 1 && rf.out.includes("filter.kit.clean") && !fs.existsSync(ran) && !fs.existsSync(path.join(fdir, "core-manifest.md")), "a project whose own git settings hold a filter is refused before anything is written or added, and the filter never runs", rf.out.slice(0, 300));
const r = project("no-owner");
ok(r.status === 1 && fs.readdirSync(r.dir).join() === ".git", "without an owner it writes nothing");
fs.mkdirSync(path.join(p.dir, "sub"));
ok(run(path.join(p.dir, "sub"), script, "--owner", "x").status === 1 && run(tmp, script, "--owner", "x").status === 1 && run(core, script, "--owner", "x").status === 1, "it runs only in the root of a project's repository, never in a folder below it, outside one or in the core itself");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the starter kit`);
process.exitCode = failed ? 1 : 0;
