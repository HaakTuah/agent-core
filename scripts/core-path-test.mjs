// Tests of where a project's copy of the core stands (core-path.mjs; tasks/repositories.md, "The manifest says where the
// core's copy is"): the manifest's "Core:" line read in both forms, each fault with its mend, the floor's own copy, the
// carried core read from its library's manifest, the path the reading script reads alone (reading.mjs's pathIn, which
// imports nothing) held to it, and the script run from a project's root. Node's own modules only.
//
//   node scripts/core-path-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { carriedAt, corePath, floorCopyIn, hookCommands, projectAt, readCore } from "./core-path.mjs";
import { mended } from "./mend.mjs";
import { pathIn } from "./reading.mjs";
import { runWorkflow } from "./workflow-run.mjs";

// The workflows a project calls whose first step reads where the core's copy stands.
const CALLED = ["copies.yml", "core-moved.yml", "licences.yml", "look.yml", "nuget.yml", "pr-description.yml", "signatures.yml", "versions.yml"];
// (each required input a workflow takes, given a plain value: only its first steps run here)
const inputsOf = text => Object.fromEntries([...String(/workflow_call:\n\s+inputs:\n([\s\S]*?)\n(?:\s{0,4}\S|$)/u.exec(text)?.[1] ?? "").matchAll(/^ {6}([\w-]+):\n((?: {8}.*\n?)*)/gmu)].filter(m => /required: true/u.test(m[2])).map(m => [m[1], "x"]));
let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const A = "a".repeat(40);
const copied = (at = "core/") => `# Core manifest\n\nCore: ${CORE} at ${A}, copied whole under ${at} (never edited here).\n`;
const carried = (lib = "lib/", at = "lib/core/") => `# Core manifest\n\nCore: ${CORE}, carried by ${lib} under ${at} (never edited here).\nFloor copy: floor-copy/\n`;

// the line, in both forms
let r = readCore(copied());
ok(r.form === "copied" && r.pin === A && r.path === "core/", "the usual line reads as a copy under core/, at its pin: a project in one repository reads as it did", JSON.stringify(r));
r = readCore(copied("vendor/the-core/"));
ok(r.form === "copied" && r.path === "vendor/the-core/", "a copy at another path the line names", JSON.stringify(r));
r = readCore(carried());
ok(r.form === "carried" && r.library === "lib/" && r.path === "lib/core/" && r.pin === undefined, "a core a library carries: the library and the path, and no pin of its own", JSON.stringify(r));
for (const [what, text] of [
  ["no line", "# Core manifest\n"],
  ["two lines", copied() + copied()],
  ["another core's address", copied().replace(CORE, "someone/else")],
  ["a pin that is no full SHA", copied().replace(A, "abc")],
  ["a path that climbs out", copied("../core/")],
  ["a path into .git", copied(".git/core/")],
  ["a path where an install writes", copied("node_modules/core/")],
  ["a carried path outside its library", carried("lib/", "other/core/")],
  ["a carried path that is the library itself", carried("lib/", "lib/")],
  ["a path that climbs out after a plain segment", copied("core/../evil/")],
  ["a carried library that climbs out after a plain segment", carried("lib/../x/", "lib/../x/core/")],
]) {
  const got = readCore(text);
  ok(got.wrong && mended(`FAIL: ${got.wrong}`) && !got.path, `${what}: read as wrong, saying the mend`, JSON.stringify(got));
}
ok(readCore(`> ${copied().split("\n")[2]}`).wrong, "a line quoted is no line");
// the floor's own copy
ok(floorCopyIn(carried()) === "floor-copy/" && floorCopyIn(copied()) === null && floorCopyIn("Floor copy: ../x/\n") === null, "the floor's own copy is the folder its line names, and none where no line names a folder");
// the reading script's own reading of the path, held to this one's
for (const text of [copied(), copied("vendor/the-core/"), carried(), carried("libs/shared/", "libs/shared/core/")]) ok(pathIn(text) === readCore(text).path, `the reading script reads the path ${readCore(text).path} alike`);
ok(pathIn("# Core manifest\n") === "core/", "where the line names none, the reading script takes the usual path");
// the sed of the workflows' first step and of the work-saved hook, run on the same lines: each reads the path readCore
// reads, and nothing where readCore reads it as wrong, so no check runs a script from a folder core.yml never compared
{
  const hook = fs.readFileSync(fileURLToPath(new URL("./work-saved.sh", import.meta.url)), "utf8");
  const seds = [...CALLED.map(f => [f, /sed -n -E ('[^']+')/u.exec(fs.readFileSync(fileURLToPath(new URL(`../.github/workflows/${f}`, import.meta.url)), "utf8"))?.[1] ?? "'no sed'", out => out.split(" ")[0]]),
    ["the hook", /sed -n -E ('s#\^Core: [^']+')/u.exec(hook)[1], out => out]];
  for (const text of [copied(), copied("vendor/the-core/"), carried(), copied("core/../evil/"), carried("lib/../x/", "lib/../x/core/"), copied("core/..x/"), `${copied().trimEnd()} trailing words\n`]) {
    const want = readCore(text).path ?? "";
    for (const [who, sed, take] of seds) {
      const r = spawnSync("bash", ["-c", `printf '%s\\n' "$1" | sed -n -E ${sed} | head -n 1`, "-", text], { encoding: "utf8" });
      ok(take(r.stdout.trim()) === want, `${who} read ${JSON.stringify(text.split("\n")[2])} as readCore does: ${want || "nothing"}`, r.stdout + r.stderr);
    }
  }
}

// the carried core, from its library's manifest
const files = { "lib/core-manifest.md": copied() };
const read = f => files[f] ?? null;
r = carriedAt(readCore(carried()), read);
ok(r.pin === A && r.path === "lib/core/", "a carried core's pin is its library's", JSON.stringify(r));
for (const [what, line, lib] of [
  ["a library whose manifest cannot be read", carried("other/", "other/core/"), files],
  ["a library whose path for the core is another", carried("lib/", "lib/the-core/"), files],
  ["a library that carries the core it does not copy", carried(), { "lib/core-manifest.md": carried("x/", "x/core/") }],
]) {
  const got = carriedAt(readCore(line), f => lib[f] ?? null);
  ok(got.wrong && mended(`FAIL: ${got.wrong}`), `${what}: wrong, saying the mend`, JSON.stringify(got));
}

// the script, from a project's root
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "core-path-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const script = fileURLToPath(new URL("./core-path.mjs", import.meta.url));
const run = text => { fs.writeFileSync(path.join(tmp, "core-manifest.md"), text); return spawnSync(process.execPath, [script], { cwd: tmp, encoding: "utf8" }); };
let out = run(carried());
ok(out.status === 0 && out.stdout.trim() === "lib/core/", "from a project's root it prints the path", out.stdout + out.stderr);
out = run("# Core manifest\n");
ok(out.status === 1 && mended(out.stderr), "and fails, saying the mend, where the line is wrong", out.stderr);
ok(corePath(tmp) === "core/" && corePath(path.join(tmp, "nowhere")) === "", "a manifest whose line is wrong reads as the usual path; no manifest, the core's own root");
// the sync writes the copy where the path leads: a folder on the way that is a link, which could lead out of the
// project, stops it before it fetches or writes anything
if (process.platform !== "win32") {
  const linked = path.join(tmp, "linked"), outside = path.join(tmp, "outside");
  fs.mkdirSync(linked); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(linked, "vendor"));
  fs.writeFileSync(path.join(linked, "core-manifest.md"), copied("vendor/the-core/"));
  const r = spawnSync(process.execPath, [fileURLToPath(new URL("./sync.mjs", import.meta.url))], { cwd: linked, encoding: "utf8" });
  ok(r.status === 1 && /vendor, on the way to the copy's path vendor\/the-core\/, is a link/.test(r.stderr) && mended(r.stderr) && fs.readdirSync(outside).length === 0, "the sync refuses a path through a link, saying the mend, and writes nothing", r.stderr);
} else console.log("note a link cannot be made here (Windows), so the sync's refusal of one is not tried");

// Claude Code's hooks for a core at another path: for core/ the helper's and the stop's are the starter kit's own, and
// where a submodule carries the core, the start reads the work-saved hook from the library's commit main pins, never
// from the working tree, and stops a session whose floor cannot be read, which no script of the core's could say
const kit = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../setup/template/claude-settings.json.tmpl", import.meta.url)), "utf8")).hooks;
const usual = hookCommands(readCore(copied()));
ok(usual.helper === kit.PreToolUse[0].hooks[0].command && usual.stop === kit.Stop[0].hooks[0].command, "for core/, the helper's and the stop's commands are the starter kit's");
{
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(k))),
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  const git = (cwd, ...args) => execFileSync("git", ["-c", "protocol.file.allow=always", ...args], { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const lib = path.join(tmp, "the-library"), project = path.join(tmp, "a-project"), origin = path.join(tmp, "a-project.git");
  const put = (dir, f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
  put(lib, "core/scripts/work-saved.sh", "echo \"the hook of main's pin ran: $1\"\n");
  put(lib, "core/floor/security.md", "# The floor\n");
  put(lib, "core-manifest.md", copied());
  git(tmp, "init", "-q", "-b", "main", lib);
  git(lib, "add", "-A");
  git(lib, "commit", "-q", "-m", "the library");
  git(tmp, "init", "-q", "--bare", "-b", "main", origin);
  git(tmp, "init", "-q", "-b", "main", project);
  git(project, "submodule", "add", "-q", lib, "lib");
  put(project, "core-manifest.md", carried());
  git(project, "add", "-A");
  git(project, "commit", "-q", "-m", "a project");
  git(project, "remote", "add", "origin", origin);
  git(project, "push", "-q", "-u", "origin", "main");
  const hooks = hookCommands(readCore(carried()));
  const run = command => spawnSync("sh", ["-c", command], { input: "{}", encoding: "utf8", env: { ...env, CLAUDE_PROJECT_DIR: project } }).stdout;
  let said = run(hooks.start);
  ok(/the hook of main's pin ran: start/.test(said) && !/STOP/.test(said), "where a submodule carries the core, the start runs the hook of the library's commit main pins", said);
  fs.writeFileSync(path.join(project, "lib/core/scripts/work-saved.sh"), "echo the working tree ran\n");
  said = run(hooks.stop);
  ok(/the hook of main's pin ran: stop/.test(said) && !/working tree/.test(said), "and never the working tree's copy, edited", said);
  // (a check run from the carried copy reads the project it stands in, not the library: projectAt)
  const at = projectAt(path.join(project, "lib", "core", "scripts"));
  ok(fs.realpathSync(at.root) === fs.realpathSync(project) && at.prefix === "lib/core/scripts/", "a script of a copy a submodule carries takes the project as its root, its prefix from there", JSON.stringify(at));
  const own = projectAt(lib);
  ok(fs.realpathSync(own.root) === fs.realpathSync(lib) && own.prefix === "", "a repository of its own is its own root", JSON.stringify(own));
  // (and a check run from it reads the project's own files, the submodule's among them: the pointer check, from a library
  // that carries its scripts)
  {
    const lib2 = path.join(tmp, "a-library-with-scripts"), consumer = path.join(tmp, "a-consumer");
    for (const f of ["pointers.mjs", "rule-files.mjs", "core-path.mjs", "core-address.mjs", "started.mjs"]) put(lib2, `core/scripts/${f}`, fs.readFileSync(fileURLToPath(new URL(`./${f}`, import.meta.url)), "utf8"));
    put(lib2, "core/floor/security.md", "# The floor\n\n**1. Nothing secret in the repository.**\n");
    put(lib2, "core-manifest.md", copied());
    put(lib2, "AGENTS.md", "# The library\n");
    git(tmp, "init", "-q", "-b", "main", lib2); git(lib2, "add", "-A"); git(lib2, "commit", "-q", "-m", "a library");
    git(tmp, "init", "-q", "-b", "main", consumer);
    git(consumer, "submodule", "add", "-q", lib2, "lib");
    put(consumer, "core-manifest.md", carried());
    put(consumer, "SECURITY.md", "# Security\n\n**3. The protected files,** here, **the rule files:** none of its own;\n");
    const pointers = text => { put(consumer, "AGENTS.md", text); git(consumer, "add", "-A"); return spawnSync(process.execPath, [path.join(consumer, "lib/core/scripts/pointers.mjs")], { cwd: consumer, encoding: "utf8" }); };
    let r = pointers("# A consumer\n\n@lib/core/floor/security.md\n");
    ok(r.status === 0, "the pointer check from a copy a submodule carries reads the project's AGENTS.md, and finds the submodule's files", r.stdout + r.stderr);
    r = pointers("# A consumer\n\nThe floor: `lib/core/floor/nowhere.md`.\n");
    ok(r.status !== 0 && /AGENTS\.md/.test(r.stderr) && /nowhere\.md/.test(r.stderr) && mended(r.stderr), "and fails the project's own pointer that leads nowhere, saying the mend", r.stdout + r.stderr);
    // (and the start hook names what a branch's changed paths call for, its reading script and the core's modules read
    // from the library's commit main pins, in the submodule's repository)
    for (const f of ["work-saved.sh", "reading.mjs"]) put(lib2, `core/scripts/${f}`, fs.readFileSync(fileURLToPath(new URL(`./${f}`, import.meta.url)), "utf8"));
    put(lib2, "core/roles/builder.md", fs.readFileSync(fileURLToPath(new URL("../roles/builder.md", import.meta.url)), "utf8"));
    put(lib2, "core/tasks/notes.md", "# Notes\n\nRead when a note changes: the path `note.txt`.\n");
    git(lib2, "add", "-A"); git(lib2, "commit", "-q", "-m", "the reading script");
    git(path.join(consumer, "lib"), "pull", "-q", "origin", "main");
    put(consumer, "AGENTS.md", "# A consumer\n\n@lib/core/floor/security.md\n");
    git(consumer, "add", "-A"); git(consumer, "commit", "-q", "-m", "a consumer");
    const origin2 = path.join(tmp, "a-consumer.git");
    git(tmp, "init", "-q", "--bare", "-b", "main", origin2);
    git(consumer, "remote", "add", "origin", origin2); git(consumer, "push", "-q", "-u", "origin", "main");
    git(consumer, "checkout", "-q", "-b", "a-note"); put(consumer, "note.txt", "a note\n");
    const said = spawnSync("sh", ["-c", hookCommands(readCore(carried())).start], { input: "{}", encoding: "utf8", env: { ...env, CLAUDE_PROJECT_DIR: consumer } }).stdout;
    ok(/calls for `lib\/core\/tasks\/notes\.md`/.test(said), "the start hook, from a core a submodule carries, names the module the branch's changed paths call for", said);
  }
  git(project, "submodule", "deinit", "-q", "-f", "lib");
  said = run(hooks.start);
  ok(/^STOP: the floor cannot be read at lib\/core\/floor\/security\.md.*Mend: /m.test(said) && !/hook of main's pin ran/.test(said), "where the submodule is not checked out, the start stops the session, saying the mend", said);
}

// The first step of each workflow a project calls that runs the core's scripts: where the core's copy stands, read from
// the manifest; a submodule that carries it fetched, or a failure that says the mend where it cannot be
{
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(k))),
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  const git = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  let k = 0;
  const projectWith = (manifest, submodule = false) => {
    const dir = path.join(tmp, `calls-${++k}`);
    git(tmp, "init", "-q", "-b", "main", dir);
    fs.writeFileSync(path.join(dir, "core-manifest.md"), manifest);
    if (submodule) {
      fs.mkdirSync(path.join(dir, "lib"));
      fs.writeFileSync(path.join(dir, ".gitmodules"), `[submodule "lib"]\n\tpath = lib\n\turl = ${path.join(tmp, "no-such-library").replace(/\\/g, "/")}\n`);
      git(dir, "update-index", "--add", "--cacheinfo", `160000,${A},lib`);
    }
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "a project");
    return dir;
  };
  const github = { event_name: "pull_request", repository: "someone/project", base_ref: "main", event: { repository: { default_branch: "main", private: false }, pull_request: { number: 1, base: { sha: "" } } } };
  const usual = projectWith(copied()), unfetched = projectWith(carried(), true);
  const workflows = fileURLToPath(new URL("../.github/workflows/", import.meta.url));
  for (const f of CALLED) {
    const text = fs.readFileSync(path.join(workflows, f), "utf8");
    // (the daily look's jobs run on a schedule alone)
    const on = /schedule/.test(/^ {4}if: .*$/mu.exec(text)?.[0] ?? "") ? { ...github, event_name: "schedule" } : github;
    const job = dir => runWorkflow(text, { inputs: inputsOf(text), github: on, base: env, temp: tmp, workspace: () => dir, uses: { "actions/checkout": () => {}, "actions/setup-node": () => {} }, until: "core-at" })[0];
    const ran = job(usual), stopped = job(unfetched);
    const step = r => r.steps.find(x => /Where the core's copy stands/.test(x.name)) ?? { passed: false, out: "no such step" };
    ok(step(ran).passed, `${f}: its first step reads core/ from a project in one repository`, step(ran).out);
    ok(!step(stopped).passed && mended(step(stopped).out) && /the library lib, a submodule that carries the core, could not be fetched here/.test(step(stopped).out), `${f}: where the submodule that carries the core cannot be fetched, it fails, saying the mend`, step(stopped).out);
  }
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on where the core's copy stands`);
process.exitCode = failed ? 1 : 0;
