// Tests of where a project's copy of the core stands (core-path.mjs; tasks/repositories.md, "The manifest says where the
// core's copy is"): the manifest's "Core:" line read in both forms, each fault with its mend, the floor's own copy, the
// carried core read from its library's manifest, the path the reading script reads alone (reading.mjs's pathIn, which
// imports nothing) held to it, and the script run from a project's root. Node's own modules only.
//
//   node tests/core-path-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { CORE } from "../scripts/core-address.mjs";
import { atCopy, carriedAt, corePath, floorCopy, floorCopyIn, hookCommands, manifestText, mendAt, projectAt, readCore } from "../scripts/core-path.mjs";
import { mended } from "../scripts/mend.mjs";
import { pathIn } from "../scripts/reading.mjs";
import { runWorkflow } from "../scripts/workflow-run.mjs";

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
// the sed of the workflows' first step (the personal-terms check's too, which reads the base's manifest) and of the work-saved hook, run on the same lines: each reads the path readCore
// reads, and nothing where readCore reads it as wrong, so no check runs a script from a folder core.yml never compared
{
  const hook = fs.readFileSync(fileURLToPath(new URL("../scripts/work-saved.sh", import.meta.url)), "utf8");
  const seds = [...[...CALLED, "personal-terms.yml"].map(f => [f, /sed -n -E ('[^']+')/u.exec(fs.readFileSync(fileURLToPath(new URL(`../.github/workflows/${f}`, import.meta.url)), "utf8"))?.[1] ?? "'no sed'", out => out.split(" ")[0]]),
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
const script = fileURLToPath(new URL("../scripts/core-path.mjs", import.meta.url));
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
  spawnSync("git", ["init", "-q"], { cwd: linked }); // (a project is a git repository, whose files the sync reads: own-files.mjs)
  const r = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/sync.mjs", import.meta.url))], { cwd: linked, encoding: "utf8" });
  ok(r.status === 1 && /vendor, on the way to the copy's path vendor\/the-core\/, is a link/.test(r.stderr) && mended(r.stderr) && fs.readdirSync(outside).length === 0, "the sync refuses a path through a link, saying the mend, and writes nothing", r.stderr);
} else console.log("note a link cannot be made here (Windows), so the sync's refusal of one is not tried");
// a manifest that is no regular file, or past a mebibyte, reads as empty: the usual path, no floor copy, and nothing
// that stops the script reading it (a manifest linked to a device once took every reader down: #593, point 8)
const odd = path.join(tmp, "odd");
fs.mkdirSync(path.join(odd, "core-manifest.md"), { recursive: true });
const big = path.join(tmp, "big");
fs.mkdirSync(big);
fs.writeFileSync(path.join(big, "core-manifest.md"), `${copied("vendor/core/")}${"x".repeat(1 << 20)}`);
ok(manifestText(path.join(odd, "core-manifest.md")) === "" && corePath(odd) === "core/" && floorCopy(odd) === null && corePath(big) === "core/" && manifestText(path.join(tmp, "nowhere", "core-manifest.md")) === null,
  "a manifest that is a folder, or past a mebibyte, reads as empty and so as the usual path; none, as null");
const edge = path.join(tmp, "edge");
fs.mkdirSync(edge);
fs.writeFileSync(path.join(edge, "core-manifest.md"), carried().padEnd(1 << 20, " "));
ok(corePath(edge) === "lib/core/" && floorCopy(edge) === "floor-copy/", "a manifest of a mebibyte exactly is read, its path and its floor copy among it");
// (through a link too: to a folder here, never to a device, which a mutant of the check would read without end and
// take the machine's memory with it)
if (process.platform !== "win32") {
  const linked = path.join(tmp, "linked-manifest");
  fs.mkdirSync(path.join(linked, "elsewhere"), { recursive: true });
  fs.symlinkSync(path.join(linked, "elsewhere"), path.join(linked, "core-manifest.md"));
  const r = spawnSync(process.execPath, [script], { cwd: linked, encoding: "utf8", timeout: 20000 });
  ok(corePath(linked) === "core/" && floorCopy(linked) === null && r.status === 1 && mended(r.stderr), "a manifest that is a link to what is no regular file reads as empty, and the script says the mend", `${r.status} ${r.signal} ${r.stderr}`);
}

// The starter kit's and the notes' words for the copy, in the project's own (#628): each core/ that begins a path
ok(atCopy("read core/tasks/x.md", "core/") === "read core/tasks/x.md" && atCopy("core/a ../../core/b `core/c` agent-core/d", "vendor/core/") === "vendor/core/a ../../vendor/core/b `vendor/core/c` agent-core/d",
  "a bare core/ is the copy's path, and agent-core/ is not");
ok(["vendor/core/", "packages/core/agent/", "packages/core/core/", "a.core/"].every(c => { const once = atCopy("x core/a ../../core/b `core/c`", c); return once === atCopy(once, c); }), "a second pass over a text changes nothing, whatever core/ the copy's own path holds");
{
  const mend = "see `core/scripts/x.mjs`, core/notes.md, src/core/a, vendor/core/b, `core/` and core/modules/x (in `core/notes.md`)";
  ok(mendAt(mend, "vendor/core/") === "see `vendor/core/scripts/x.mjs`, core/notes.md, src/core/a, vendor/core/b, `vendor/core/` and vendor/core/modules/x (in `core/notes.md`)" && mendAt(mend, "core/") === mend && mendAt(mendAt(mend, "packages/core/agent/"), "packages/core/agent/") === mendAt(mend, "packages/core/agent/"),
    "in a mend the core's own files are the copy's, and the project's own paths, core/notes.md and src/core/ among them, are not");
  ok(mendAt("see `core/scripts/x.mjs`. And core/README.md. Then core/floor.", "vendor/core/") === "see `vendor/core/scripts/x.mjs`. And vendor/core/README.md. Then vendor/core/floor.",
    "a core's file or folder at the end of a sentence is the copy's, its full stop kept");
  const mine = new Set(["core/AGENTS.md", "core/tests/a.test.mjs"]), own = at => [...mine].some(f => f === at || f.startsWith(`${at}/`));
  ok(mendAt("`core/AGENTS.md`, `core/tests/a.test.mjs`, `core/tests/`, `core/scripts/x.mjs`, `core/floor/` and `core/`.", "vendor/core/", own) === "`core/AGENTS.md`, `core/tests/a.test.mjs`, `core/tests/`, `vendor/core/scripts/x.mjs`, `vendor/core/floor/` and `vendor/core/`.",
    "a path the project holds as its own file or folder stays its own, though the core has one of the name");
}
ok(atCopy("refs/remotes/origin/main:vendor/core/a core/b", "vendor/core/") === "refs/remotes/origin/main:vendor/core/a vendor/core/b" && atCopy("core/a", "lib/the-core/") === "lib/the-core/a",
  "one already behind the copy's own folders is left as it stands");

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
  // (a root compared as the file system finds it, however git and Node each spell it)
  const same = (a, b) => fs.realpathSync.native(a).toLowerCase() === fs.realpathSync.native(b).toLowerCase();
  ok(same(at.root, project) && at.prefix === "lib/core/scripts/", "a script of a copy a submodule carries takes the project as its root, its prefix from there", JSON.stringify(at));
  const own = projectAt(lib);
  ok(same(own.root, lib) && own.prefix === "", "a repository of its own is its own root", JSON.stringify(own));
  // (and a check run from it reads the project's own files, the submodule's among them: the pointer check, from a library
  // that carries its scripts)
  {
    const lib2 = path.join(tmp, "a-library-with-scripts"), consumer = path.join(tmp, "a-consumer");
    for (const f of ["pointers.mjs", "markdown.mjs", "packages.mjs", "rule-files.mjs", "guards.mjs", "core-path.mjs", "core-address.mjs", "started.mjs"]) put(lib2, `core/scripts/${f}`, fs.readFileSync(fileURLToPath(new URL(`./${f}`, new URL("../scripts/", import.meta.url))), "utf8"));
    // (and the package the check reads Markdown with, as the core's install leaves it: the lock file, npm's record of
    // the install and the package)
    for (const f of ["package.json", "package-lock.json", ".npmrc", "node_modules/.package-lock.json", "node_modules/marked"]) fs.cpSync(fileURLToPath(new URL(`../.packages/${f}`, import.meta.url)), path.join(lib2, "core/.packages", f), { recursive: true });
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
    for (const f of ["work-saved.sh", "reading.mjs"]) put(lib2, `core/scripts/${f}`, fs.readFileSync(fileURLToPath(new URL(`./${f}`, new URL("../scripts/", import.meta.url))), "utf8"));
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
  // (a branch that commits, where the library stands, files that form a bare repository: its tree object under the genuine
  // name holds another script. The commands read the library's commit main pins, from the repository named, never one git
  // finds in the working tree: run in the folder the forged script runs, and the commands name the submodule's .git instead)
  {
    const evil = path.join(tmp, "a-forged-project"), bare = path.join(tmp, "the-library.git"), origin3 = path.join(tmp, "a-forged-project.git");
    git(tmp, "init", "-q", "-b", "main", evil);
    git(evil, "submodule", "add", "-q", lib, "lib");
    git(evil, "add", "-A"); git(evil, "commit", "-q", "-m", "a project");
    git(tmp, "init", "-q", "--bare", "-b", "main", origin3);
    git(evil, "remote", "add", "origin", origin3); git(evil, "push", "-q", "-u", "origin", "main");
    git(tmp, "clone", "-q", "--bare", lib, bare);
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: bare, env, input: "echo FORGED\n", encoding: "utf8" }).trim();
    const tree = git(bare, "rev-parse", "HEAD:core/scripts").trim(), body = Buffer.concat([Buffer.from("100644 work-saved.sh\0"), Buffer.from(blob, "hex")]);
    const loose = path.join(bare, "objects", tree.slice(0, 2), tree.slice(2));
    fs.rmSync(loose, { force: true }); fs.mkdirSync(path.dirname(loose), { recursive: true });
    fs.writeFileSync(loose, zlib.deflateSync(Buffer.concat([Buffer.from(`tree ${body.length}\0`), body])));
    git(evil, "checkout", "-q", "-b", "forged"); git(evil, "rm", "-q", "-f", "lib");
    fs.cpSync(bare, path.join(evil, "lib"), { recursive: true });
    git(evil, "add", "-A", "-f"); git(evil, "commit", "-q", "-m", "a bare repository where the library stood");
    const stop = hookCommands(readCore(carried())).stop, inFolder = stop.replace('git -C "${CLAUDE_PROJECT_DIR:-.}" --git-dir="$m"', 'git -C "${CLAUDE_PROJECT_DIR:-.}"/lib'), at = command => spawnSync("sh", ["-c", command], { input: "{}", encoding: "utf8", env: { ...env, CLAUDE_PROJECT_DIR: evil } }).stdout;
    ok(/FORGED/.test(at(inFolder)) && !/FORGED/.test(at(stop)),
      "a bare repository a branch commits where the library stands is not read by the commands for a carried core, though git, run in the folder, reads it", `${at(inFolder)}|${at(stop)}`);
    // (and a branch that commits the library's folder itself as a link, to a folder outside the project whose .git holds the
    // forged repository, where git run at lib/.git finds it, #930: the commands name the superproject's own module repository,
    // which the link does not reach, and run main's pin)
    if (process.platform !== "win32") {
      const linked = path.join(tmp, "a-linked-project"), outside = path.join(tmp, "a-folder-outside"), origin4 = path.join(tmp, "a-linked-project.git");
      git(tmp, "init", "-q", "-b", "main", linked);
      git(linked, "submodule", "add", "-q", lib, "lib");
      git(linked, "add", "-A"); git(linked, "commit", "-q", "-m", "a project");
      git(tmp, "init", "-q", "--bare", "-b", "main", origin4);
      git(linked, "remote", "add", "origin", origin4); git(linked, "push", "-q", "-u", "origin", "main");
      fs.mkdirSync(outside, { recursive: true }); fs.cpSync(bare, path.join(outside, ".git"), { recursive: true });
      git(linked, "checkout", "-q", "-b", "linked"); git(linked, "rm", "-q", "-f", "lib");
      fs.symlinkSync(outside, path.join(linked, "lib"));
      git(linked, "add", "-A", "-f"); git(linked, "commit", "-q", "-m", "the library's folder as a link");
      const stop = hookCommands(readCore(carried())).stop, oldForm = stop.replace('git -C "${CLAUDE_PROJECT_DIR:-.}" --git-dir="$m"', 'git --git-dir="${CLAUDE_PROJECT_DIR:-.}"/lib/.git');
      const at = command => spawnSync("sh", ["-c", command], { input: "{}", encoding: "utf8", env: { ...env, CLAUDE_PROJECT_DIR: linked } }).stdout;
      ok(/FORGED/.test(at(oldForm)) && !/FORGED/.test(at(stop)) && /the hook of main's pin ran: stop/.test(at(stop)),
        "the library's folder a branch commits as a link is not read by the commands for a carried core: they run the pin's script from the module repository", `${at(oldForm)}|${at(stop)}`);
    }
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
