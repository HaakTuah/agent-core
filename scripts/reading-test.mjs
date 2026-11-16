// Tests of the reading script (reading.mjs): how a file says when it is read, what a role reads at its start, what a
// task calls for by its kinds, its paths, its tools and its issue, the check that every module and role says when, the
// line a pull request lists its reading on, and the script run in the core and in a scratch project that holds a copy.
// Node's own modules and git only.
//
//   node scripts/reading-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { FLOOR, FLOOR_WHEN, READ_LINE, READY, START, asked, calledByPaths, coreAt, faults, gather, kindsOf, library, lineMend, listed, matches, opening, ownPaths, reading, readsOf, whenOf } from "./reading.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const file = fileURLToPath(new URL("./reading.mjs", import.meta.url)), root = path.dirname(path.dirname(file));

// how a file says when it is read
const w = text => whenOf(`# A title\n\n${text}\n\nMore, with the kind \`later\`.\n`);
ok(opening("# T\n\n\nRead when a\nthing is done.\n\nNext.") === "Read when a thing is done." && opening("Read at once.\nMore.") === "Read at once. More." && opening("# T\n") === "", "the opening paragraph is the first after the title, its lines joined");
ok(eq(w("Read when a screen changes (core archive 1): the kinds `screen` and `polish`. A screen is `x`."), { start: false, kinds: ["screen", "polish"], paths: [], tools: [], others: [], roles: [] }), "kinds are read after \"the kinds\", joined by commas, and, or; nothing after the paragraph, and no other word in backticks");
ok(eq(w("Read when an update is taken: the kind `update`; the paths `.github/dependabot.yml`, `.node-version` or\n`package*lock.json`.").paths, [".github/dependabot.yml", ".node-version", "package*lock.json"]) && eq(w("Read for the path `a/`.").paths, ["a/"]), "paths after \"the paths\" or \"the path\", over a line's end too");
ok(eq(w("Read by the tool `claude` at the start of every task."), { start: true, kinds: [], paths: [], tools: ["claude"], others: [], roles: [] }) && eq(w("Read at its start by a session of every tool but `claude` and `codex`.").others, ["claude", "codex"]) && w("Read at its start by x.").start,
  "a tool, every tool but some, and \"at the start\" or \"at its start\"");
ok(eq(w("Read at its start by the role `stand-in`: a fresh session.").roles, ["stand-in"]) && w("What every reviewer judges by, read whole.") === null && whenOf("") === null && whenOf(null) === null, "a role's file names its role; a paragraph that does not begin \"Read\" says nothing");

// the files a role's file names
const role = `# The x\n\nRead at its start by the role \`x\`.\n\n**${START}** \`modules/a.md\`, \`roles/builder.md\` and\n\`modules/b.md\`; with its brief, and \`modules/not.md\`.\n\n**${READY}** \`modules/r.md\`. Then \`modules/no.md\`.\n\n**Hands over, gets back:**\n- y: \`modules/z.md\`.\n`;
ok(eq(readsOf(role, START), ["modules/a.md", "roles/builder.md", "modules/b.md"]) && eq(readsOf(role, READY), ["modules/r.md"]) && readsOf("# T\n\nText.\n", START) === null && eq(readsOf(`**${START}** its brief alone.\n`, START), []),
  "a role's line names its files up to the first stop or semicolon, over a line's end; with no such line, none");

// a changed path against a pattern
ok(matches(".github/workflows/", ".github/workflows/tests.yml") && !matches(".github/workflows/", "docs/.github/workflows/x.yml") && !matches(".claude/", ".claude.md") && matches(".claude/", ".claude/settings.json"), "a folder holds every path under it, from the root");
ok(matches("CLAUDE.md", "CLAUDE.md") && matches("CLAUDE.md", "tools/CLAUDE.md") && !matches("CLAUDE.md", "NOT-CLAUDE.md") && matches("package*lock.json", "app/package-lock.json") && matches("package*lock.json", "packages.lock.json") && !matches("package*lock.json", "package.json"), "a name with no folder is a file's name wherever it lies, * for any run of its letters");
ok(matches(".github/dependabot.yml", ".github/dependabot.yml") && !matches(".github/dependabot.yml", "x/.github/dependabot.yml") && matches("src/**/*.css", "src/a/b/c.css") && matches("src/*.css", "src/a.css") && !matches("src/*.css", "src/a/b.css") && !matches("a.b", "aXb") && matches("./a/", "a/b"), "a path with a folder is from the root, * within a folder and ** across them, and a dot is a dot");

// a small core
const texts = {
  "roles/builder.md": `# B\n\nRead at the start by the role \`builder\`.\n\n**${START}** \`modules/work.md\`, \`modules/git.md\`.\n\n**${READY}** \`modules/reviews.md\`; and more.\n`,
  "roles/design.md": `# D\n\nRead at its start by the role \`design\`.\n\n**${START}** \`roles/builder.md\` and what that names.\n`,
  "roles/reviewer.md": `# R\n\nRead at its start by the role \`reviewer\`.\n\n**${START}** \`modules/guidelines.md\`, \`modules/work.md\`.\n`,
  "modules/work.md": "# W\n\nRead at the start of every task.\n",
  "modules/git.md": "# G\n\nRead at the start of every task.\n",
  "modules/guidelines.md": "# G\n\nRead at its start by every reviewer.\n",
  "modules/reviews.md": "# R\n\nRead when a PR is reviewed: the kind `review`.\n",
  "modules/screens.md": "# S\n\nRead when a screen changes: the kinds `screen` and `polish`.\n",
  "modules/games.md": "# G\n\nRead before a polish task: the kind `polish`.\n",
  "modules/updates.md": "# U\n\nRead for an update: the kind `update`; the paths `.github/dependabot.yml` and `package*lock.json`.\n",
  "modules/claude.md": "# C\n\nRead by the tool `claude` at the start of every task.\n",
  "modules/others.md": "# O\n\nRead at the start of every task by a session of every tool but `claude`.\n",
  "modules/kiro.md": "# K\n\nRead by a session of the tool `kiro`, and by whoever hands it a task.\n",
};
const lib = gather(f => texts[f] ?? null, folder => Object.keys(texts).filter(f => f.startsWith(`${folder}/`)));
const files = got => got.task.map(t => t.file);
ok(eq(reading(lib, { role: "builder" }), { start: [FLOOR, "roles/builder.md", "modules/work.md", "modules/git.md"], task: [] }), "a role reads at its start the floor, its own file and the files that names, in that order, and nothing a task alone calls for");
ok(eq(reading(lib, { role: "design" }).start, [FLOOR, "roles/design.md", "roles/builder.md", "modules/work.md", "modules/git.md"]) && eq(reading(lib, { role: "reviewer" }).start, [FLOOR, "roles/reviewer.md", "modules/guidelines.md", "modules/work.md"]),
  "a role's file named there brings what it names too; another role reads its own and no other's");
ok(/"planner" is no role the core has a file for\. Mend: give one of builder, design, reviewer/.test(reading(lib, { role: "planner" }).error) && reading(lib, { role: "" }).error, "a role with no file is an error that names the roles");
ok(eq(reading(lib, { role: "builder", tools: ["claude"] }).start.slice(-1), ["modules/claude.md"]) && eq(reading(lib, { role: "builder", tools: ["kiro"] }).start.slice(-1), ["modules/others.md"]) && eq(reading(lib, { role: "builder", tools: ["kiro"] }).task, [{ file: "modules/kiro.md", why: "the tool kiro" }]) && !reading(lib, { role: "builder", tools: ["claude"] }).start.includes("modules/others.md"),
  "a tool's part joins the start where it says so, the task's reading where it does not; every tool but one leaves that one out");
ok(eq(files(reading(lib, { role: "builder", kinds: ["polish"] })), ["modules/screens.md", "modules/games.md"]) && eq(reading(lib, { role: "builder", kinds: [{ kind: "update", why: "the issue's label" }] }).task, [{ file: "floor/topics.md", why: "the issue's label" }, { file: "modules/updates.md", why: "the issue's label" }]) && eq(files(reading(lib, { role: "builder", kinds: ["nothing"] })), []),
  "a kind calls every module that names it, the floor's topics among them, each with why");
ok(eq(reading(lib, { role: "builder", paths: ["README.md", "app/package-lock.json", ".github/workflows/ci.yml"] }).task, [{ file: "floor/topics.md", why: "the path .github/workflows/ci.yml" }, { file: "modules/updates.md", why: "the path app/package-lock.json" }]), "a changed path calls the modules whose line names it");
ok(eq(files(reading(lib, { role: "builder", ready: true })), ["modules/reviews.md"]) && eq(files(reading(lib, { role: "reviewer", ready: true })), []) && eq(files(reading(lib, { role: "design", ready: true })), ["modules/reviews.md"]), "before its pull request is ready a role reads what its file names for then, a role's file it names bringing its own");
ok(eq(reading(lib, { role: "builder", named: ["modules/screens.md", "modules/git.md"], kinds: ["screen"] }).task, [{ file: "modules/screens.md", why: "the issue names it" }]), "a file an issue names is read once, and one the start already holds is not listed twice");
const own = ownPaths("# Core manifest\n\n## Reading\nText, with `a` and `b`.\n\n| Path | Kind |\n| --- | --- |\n| `src/screens/` | `screen` |\n| `*.css` | `polish` |\n| `x/` | `Not A Kind` |\n| plain | `screen` |\n\n## Differences\n| `y/` | `screen` |\n");
ok(eq(own, [{ path: "src/screens/", kind: "screen" }, { path: "*.css", kind: "polish" }]) && eq(ownPaths("# Core manifest\n"), []) && eq(ownPaths(null), []), "a project's manifest gives its own paths a kind, a row each under \"Reading\", in backticks; no other row or section is read");
ok(eq(calledByPaths(lib, ["src/screens/home.js"], own).map(c => c.file), ["modules/screens.md"]) && /of the kind screen by the manifest's "Reading"/.test(calledByPaths(lib, ["src/screens/home.js"], own)[0].why) && eq(calledByPaths(lib, ["a/site.css"], own).map(c => c.file), ["modules/screens.md", "modules/games.md"]) && eq(calledByPaths(lib, ["src/other.js"], own), []),
  "so a changed path of the project's own calls the modules of its kind");
ok(eq([...kindsOf(lib).keys()].filter(k => !Object.values(FLOOR_WHEN).some(f => f.kinds.includes(k))), ["polish", "review", "screen"]) && eq(kindsOf(lib).get("update"), ["floor/topics.md", "modules/updates.md"]), "the kinds are those the modules name, each with its files");

// the check that every module and role says when
const fault = change => { const t = { ...texts, ...change }; return faults(gather(f => t[f] ?? null, folder => Object.keys(t).filter(f => f.startsWith(`${folder}/`))), f => f in t || f === FLOOR); };
ok(eq(fault({}), []), "a core whose modules and roles each say when has no fault");
const each = [
  [{ "modules/new.md": "# N\n\nA module about something.\n" }, /modules\/new\.md does not say when it is read\. Mend: open it, under its title, with a paragraph that begins "Read"/],
  [{ "modules/new.md": "# N\n\nRead when it is needed.\n" }, /modules\/new\.md says "Read" but not when in words the reading script matches, and no role's file names it\. Mend: add/],
  [{ "modules/new.md": "# N\n\nRead at the start of every task.\n" }, /modules\/new\.md says it is read at the start, and no role's file names it\. Mend:/],
  [{ "modules/new.md": "# N\n\nRead for the kind `Two Words`.\n" }, /`Two Words` is no kind the script can match\. Mend:/],
  [{ "roles/planner.md": "# P\n\nThe planner plans.\n\n**Reads at its start:** `modules/git.md`.\n" }, /roles\/planner\.md does not say when it is read\. Mend: .*the role `planner`/],
  [{ "roles/planner.md": "# P\n\nRead at its start by the role `planner`.\n" }, /roles\/planner\.md names no file its role reads at its start\. Mend:/],
  [{ "roles/planner.md": `# P\n\nRead at its start by the role \`planner\`.\n\n**${START}** \`modules/gone.md\`.\n` }, /roles\/planner\.md names modules\/gone\.md, which is no file of the core\. Mend:/],
  [{ "roles/planner.md": `# P\n\nRead at its start by the role \`planner\`.\n\n**${START}** \`${FLOOR}\`, \`modules/git.md\`.\n` }, /which every role reads whatever its file names\. Mend: take it out/],
  [{ "roles/The Planner.md": `# P\n\nRead at its start by the role \`The Planner\`.\n\n**${START}** \`modules/git.md\`.\n` }, /its name is no word a session can give as its role\. Mend:/],
];
for (const [change, said] of each) { const found = fault(change); ok(found.some(f => said.test(f)) && mended(found.map(f => `FAIL: ${f}`).join("\n")), `a fault is found, each saying its mend: ${String(said).slice(1, 60)}`, found.join("\n")); }

// the line a pull request lists its reading on
ok(eq(listed(`x\n${READ_LINE} \`a.md\`\n\n ${READ_LINE} \`core/modules/b.md\`, \`floor/topics.md\`\n`), ["core/modules/b.md", "floor/topics.md"]) && listed("no line") === null && eq(listed(`${READ_LINE} nothing its paths call for`), []), "the description's last such line gives the files it lists; none where there is no line");
const called = [{ file: "floor/topics.md", why: "the path .github/workflows/ci.yml" }, { file: "modules/updates.md", why: "the path x" }];
ok(lineMend("x", [], "cmd") === null && lineMend(`${READ_LINE} \`modules/updates.md\`, \`floor/topics.md\`, \`more.md\``, called, "cmd") === null, "a pull request whose paths call for nothing needs no line, and one that lists each file passes, whatever else it lists");
ok(/is missing; it must list `floor\/topics\.md` \(the path \.github\/workflows\/ci\.yml\), `modules\/updates\.md`/.test(lineMend("x", called, "cmd")) && /does not list `floor\/topics\.md`.*Mend: read each of those files whole, check the change against it.*\(cmd prints the line\)/.test(lineMend(`${READ_LINE} \`modules/updates.md\``, called, "cmd")) && !/updates/.test(lineMend(`${READ_LINE} \`modules/updates.md\``, called, "cmd").split("Mend:")[0])
  && mended(`FAIL ${lineMend("x", called, "cmd")}`), "one that lacks a file fails, naming each file lacking with the path that called it, and the mend");

// what an issue names under "What to read"
ok(eq(asked("**What it is**\nAn idea, `not this`.\n\n**What to read**\nThe kinds `screen`, and `core/modules/choices.md`.\nAlso `update`.\n\n**Why**\n`nor this`.\n"), ["screen", "core/modules/choices.md", "update"]) && eq(asked("## What to read\n`a`\n## Next\n`b`"), ["a"]) && eq(asked("What to read: `a`"), []) && eq(asked(null), []),
  "the words in backticks under the issue's \"What to read\", a heading or a line in bold, up to the next");

// the core's own files, and the script run
const run = (cwd, ...args) => { const r = spawnSync(process.execPath, [file, ...args], { cwd, encoding: "utf8", env: { ...process.env, GITHUB_REPOSITORY: "" } }); return { status: r.status, out: r.stdout + r.stderr }; };
const core = library(root, "");
ok(coreAt(root) === "" && run(root, "--check").status === 0 && /each of the \d+ modules and 5 roles says when it is read/.test(run(root, "--check").out), "in the core, every module and role says when it is read", run(root, "--check").out);
ok(["builder", "design", "orchestrator", "reviewer", "stand-in"].every(r => !reading(core, { role: r }).error) && [...kindsOf(core).values()].flat().every(f => fs.existsSync(path.join(root, f))), "the core has a file for each of its five roles, and every kind leads to files that stand");
let r = run(root, "builder", "--tool", "claude");
ok(r.status === 0 && /^Read at the start, in the role builder \(each whole\):\n  floor\/security\.md\n  roles\/builder\.md\n/.test(r.out) && /  modules\/claude\.md\n/.test(r.out) && !/modules\/other-builders\.md/.test(r.out) && /Nothing more is called for by this task as given\./.test(r.out), "run for a builder, it prints the start, the tool's part in it", r.out);
r = run(root, "reviewer", "--kind", "security-review", "--path", ".github/workflows/tests.yml", "--kind", "nonesuch");
ok(r.status === 0 && /Read for this task:\n  floor\/topics\.md +the kind security-review\n  floor\/threat-model\.md +the kind security-review\n/.test(r.out) && /note no module is read for the kind "nonesuch"/.test(r.out) && /your tool's part: give --tool/.test(r.out), "run with kinds and a path, it prints each file once with why, and notes a kind no module names", r.out);
r = run(root, "planner");
ok(r.status === 1 && mended(r.out) && /is no role the core has a file for/.test(r.out) && run(root).status === 1 && mended(run(root).out), "a role with no file, or none given, fails saying the mend", r.out);
ok(run(root, "--kinds").status === 0 && /^screen +modules\/screens\.md$/m.test(run(root, "--kinds").out) && /^workflow +floor\/topics\.md$/m.test(run(root, "--kinds").out), "--kinds lists each kind with its files");
ok(/^What to read is set by your role and your task: `node scripts\/reading\.mjs <role> --issue <its issue>` prints it \(the roles: builder, design, orchestrator, reviewer, stand-in;/.test(run(root, "--hook").out) && run(root, "--hook").out.trim().split("\n").length === 1, "--hook prints the one line the start hook gives");

// a scratch project that holds the core's copy
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reading-test-")), project = path.join(tmp, "project");
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const outer = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
const env = { ...outer, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
const git = (...args) => execFileSync("git", args, { cwd: project, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
for (const part of ["floor", "modules", "roles", "scripts"]) fs.cpSync(path.join(root, part), path.join(project, "core", part), { recursive: true });
fs.writeFileSync(path.join(project, "core-manifest.md"), "# Core manifest\n\n## Reading\n| Path | Kind |\n| --- | --- |\n| `src/screens/` | `screen` |\n\n## Differences\nNone.\n");
fs.mkdirSync(path.join(project, "inbox"));
fs.writeFileSync(path.join(project, "inbox", "idea.md"), "State: queued\nBy: owner\n\n**What it is**\nA choice.\n\n**What to read**\n`choice`, `core/modules/helpers.md` and `whatever`.\n");
git("init", "-q", "-b", "main"); git("add", "-A"); git("commit", "-q", "-m", "a project");
const at = (...args) => { const got = spawnSync(process.execPath, [path.join(project, "core", "scripts", "reading.mjs"), ...args], { cwd: project, encoding: "utf8", env: { ...env, GITHUB_REPOSITORY: "" } }); return { status: got.status, out: got.stdout + got.stderr }; };
ok(coreAt(project) === "core/" && /^  core\/floor\/security\.md\n  core\/roles\/stand-in\.md\n  core\/modules\/inbox\.md\n/m.test(at("stand-in").out) && !/modules\/git\.md/.test(at("stand-in").out), "in a project the files are named under core/, and the stand-in reads its own and not the builder's", at("stand-in").out);
r = at("builder", "--issue", "inbox/idea.md");
ok(r.status === 0 && /  core\/modules\/helpers\.md +the issue names it\n/.test(r.out) && /  core\/modules\/choices\.md +the kind choice, which the issue names\n/.test(r.out) && /note the issue names "whatever" under "What to read", which is no kind or file of the core/.test(r.out), "an item of the inbox's folder is read as the issue: the kinds and files it names, and a word that is neither noted", r.out);
r = at("builder", "--issue", "41");
ok(r.status === 0 && /note the issue 41 could not be read: give its kinds with --kind/.test(r.out) && /core\/roles\/builder\.md/.test(r.out), "an issue that cannot be read is noted, and the start still printed", r.out);
fs.mkdirSync(path.join(project, "src", "screens"), { recursive: true }); fs.mkdirSync(path.join(project, ".github", "workflows"), { recursive: true });
fs.writeFileSync(path.join(project, "src", "screens", "home.js"), "x\n"); git("add", "-A"); git("commit", "-q", "-m", "a screen");
fs.writeFileSync(path.join(project, ".github", "workflows", "ci.yml"), "on: push\n");
r = at("builder", "--changed", "HEAD~1");
ok(r.status === 0 && /  core\/modules\/reviews\.md +before the pull request is marked ready\n/.test(r.out) && /  core\/floor\/topics\.md +the path \.github\/workflows\/ci\.yml\n/.test(r.out) && /  core\/modules\/screens\.md +the path src\/screens\/home\.js, of the kind screen by the manifest's "Reading"\n/.test(r.out),
  "before the pull request is ready: what the role reads then, and what the paths changed since the base call for, a file not yet committed and the project's own paths too", r.out);
ok(at("builder", "--changed", "HEAD~1", "--line").out.trim() === `${READ_LINE} \`core/floor/topics.md\`, \`core/modules/screens.md\`` && at("builder", "--changed", "HEAD", "--path", "README.md", "--line").out.trim() === `${READ_LINE} \`core/floor/topics.md\``, "--line prints the line for the description", at("builder", "--changed", "HEAD~1", "--line").out);
ok(at("builder", "--changed").status === 0 && /note the changed paths could not be read from git: give each with --path/.test(at("builder", "--changed").out), "where the base cannot be found, that is noted", at("builder", "--changed").out);
const nowhere = spawnSync(process.execPath, [file, "builder"], { cwd: tmp, encoding: "utf8" });
ok(nowhere.status === 1 && mended(nowhere.stdout + nowhere.stderr) && spawnSync(process.execPath, [file, "--hook"], { cwd: tmp, encoding: "utf8" }).stdout === "", "where no core stands it fails saying the mend, and the hook's line says nothing", nowhere.stderr);
// (read from its input, as the start hook hands it main's copy)
const piped = spawnSync(process.execPath, ["--input-type=module", "-", "--hook"], { cwd: project, input: fs.readFileSync(file, "utf8"), encoding: "utf8" });
ok(piped.status === 0 && /`node core\/scripts\/reading\.mjs <role> --issue <its issue>`/.test(piped.stdout), "handed to node on its input, it runs alone: nothing beside it is imported", piped.stdout + piped.stderr);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the reading script`);
process.exit(failed ? 1 : 0);
