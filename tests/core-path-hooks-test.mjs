// Tests of where a project's copy of the core stands (core-path.mjs; tasks/repositories.md, "The manifest says where
// the core's copy is"): Claude Code's hooks for a core at another path, a core a submodule carries, and the first
// step of each workflow a project calls that runs the core's scripts. Node's own modules only.
//
//   node tests/core-path-hooks-test.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import zlib from "node:zlib";
import { hookCommands, readCore, projectAt } from "../scripts/core-path.mjs";
import { mended } from "../scripts/mend.mjs";
import { runWorkflow } from "../scripts/workflow-run.mjs";
import { copied, tmp, carried, A, CALLED } from "../scripts/core-path-scratch.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();

// (each required input a workflow takes, given a plain value: only its first steps run here)
const inputsOf = text => Object.fromEntries([...String(/workflow_call:\n\s+inputs:\n([\s\S]*?)\n(?:\s{0,4}\S|$)/u.exec(text)?.[1] ?? "").matchAll(/^ {6}([\w-]+):\n((?: {8}.*\n?)*)/gmu)].filter(m => /required: true/u.test(m[2])).map(m => [m[1], "x"]));
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
    for (const f of ["pointers.mjs", "names.mjs", "links.mjs", "markdown.mjs", "packages.mjs", "rule-files.mjs", "guards.mjs", "core-path.mjs", "core-address.mjs", "started.mjs", "mend.mjs"]) put(lib2, `core/scripts/${f}`, fs.readFileSync(fileURLToPath(new URL(`./${f}`, new URL("../scripts/", import.meta.url))), "utf8"));
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
    for (const f of ["work-saved.sh", "reading.mjs", "guards.mjs"]) put(lib2, `core/scripts/${f}`, fs.readFileSync(fileURLToPath(new URL(`./${f}`, new URL("../scripts/", import.meta.url))), "utf8"));
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

done("where the core's copy stands, for the hooks and the workflows");
