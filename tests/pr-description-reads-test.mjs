// Checks the line "Read for it:" (scripts/pr-reads.mjs, run by scripts/pr-description.mjs): what the paths a pull request changes call for. Split from pr-description-test.mjs (#888); run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/pr-description-reads-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calledFor, coreHere } from "../scripts/pr-reads.mjs";
import { mended } from "../scripts/mend.mjs";
import { lineMend } from "../scripts/reading.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what, got = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}${cond || !got ? "" : `: ${got}`}`); if (!cond) failed++; };

// what a pull request's changed paths call for, in a scratch project: the merge commit against its base, the kinds of
// the project's own paths as the base holds them, the copy's own paths left out
{
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), tmp = scratchDir("pr-description-test-"), project = path.join(tmp, "project");
  const outer = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
  const env = { ...outer, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...args) => execFileSync("git", args, { cwd: project, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(project, f)), { recursive: true }); fs.writeFileSync(path.join(project, f), text); };
  for (const part of ["floor", "tasks", "roles"]) fs.cpSync(path.join(root, part), path.join(project, "core", part), { recursive: true });
  put("core-manifest.md", "# Core manifest\n\nFloor: whole. Modules: `screens.md`.\nNot taken: `game-design.md` (no game).\n"); put("checks/reading.json", `${JSON.stringify({ paths: { "src/screens/": "polish" } })}\n`); put("src/screens/a.js", "1\n");
  git("init", "-q", "-b", "main"); git("add", "-A"); git("commit", "-q", "-m", "the base");
  ok(calledFor(tmp) === null, "where no core stands, what a change calls for cannot be read");
  put("src/screens/a.js", "2\n"); put("checks/reading.json", "{}\n"); put("core-manifest.md", "# Core manifest\n\nFloor: whole. Modules: `updates.md`.\nNot taken: `game-design.md` (no game), `screens.md` (none).\n"); put("core/CLAUDE.md", "x\n"); put(".github/workflows/caf\u00e9.yml", "on: push\n");
  git("add", "-A"); git("commit", "-q", "-m", "a change that empties its own reading config");
  const called = calledFor(project);
  ok(JSON.stringify(called.map(c => c.file)) === JSON.stringify(["core/tasks/screens.md", "core/tasks/updates.md", "core/floor/topics/workflows.md"]) && /of the kind polish/.test(called[0].why) && /core-manifest\.md/.test(called[1].why),
    "a pull request's changed paths call for their files by the reading config and the manifest its base holds, not those it carries (a changed manifest calling for tasks/updates.md, #756): a module the base's manifest leaves out is not asked, one the change itself leaves out still is; a path of the copy calls for nothing, and one outside ASCII is read as spelled", JSON.stringify(called));
  ok(/does not list `core\/tasks\/screens\.md`/.test(lineMend("Read for it: `core/floor/topics/workflows.md`", called, "cmd")) && lineMend("Read for it: `core/floor/topics/workflows.md`, `core/tasks/screens.md`, `core/tasks/updates.md`", called, "cmd") === null, "and the line is held to them");
  // (where the core lies at the head: read, or a failure with its mend, never a pass)
  ok(JSON.stringify(coreHere(project)) === JSON.stringify({ at: "core/", mend: null }), "where the core lies at the head is read from its manifest, with nothing to mend");
  if (process.platform !== "win32") {
    const text = fs.readFileSync(path.join(project, "core-manifest.md"), "utf8");
    put("docs/m.md", text); fs.rmSync(path.join(project, "core-manifest.md")); fs.symlinkSync("docs/m.md", path.join(project, "core-manifest.md"));
    git("add", "-A"); git("commit", "-q", "-m", "a tracked link");
    const linked = coreHere(project);
    ok(linked.at === null && mended(`FAIL ${linked.mend}`), "a tracked link in the manifest's place is refused, with its mend", JSON.stringify(linked));
    fs.rmSync(path.join(project, "core-manifest.md")); put("core-manifest.md", text); git("add", "-A"); git("commit", "-q", "-m", "the file back");
  }
  // (a project's head that moves its copy, its manifest naming the new place: read there, as core.yml holds that copy
  // to its pin)
  const manifestText = fs.readFileSync(path.join(project, "core-manifest.md"), "utf8");
  put("core-manifest.md", `Core: someone/core at ${"0".repeat(40)}, copied whole under x/\n`); put("x/roles/a.md", "a\n"); put("x/floor/security.md", "f\n");
  git("add", "-A"); git("commit", "-q", "-m", "another place");
  ok(JSON.stringify(coreHere(project)) === JSON.stringify({ at: "x/", mend: null }), "a project's head that moves its copy is read where its manifest puts it, with nothing to mend");
  put("core-manifest.md", manifestText); fs.rmSync(path.join(project, "x"), { recursive: true }); git("add", "-A"); git("commit", "-q", "-m", "the place back");
  if (process.platform !== "win32") {
    fs.renameSync(path.join(project, "core", "tasks"), path.join(project, "core", "t")); fs.symlinkSync("t", path.join(project, "core", "tasks"));
    put("src/screens/a.js", "3\n"); git("add", "-A"); git("commit", "-q", "-m", "a module folder as a link");
    let linkedLib = null;
    try { calledFor(project); } catch (e) { linkedLib = e; }
    ok(linkedLib !== null && mended(linkedLib.message), "a link where the core's modules stand is unread, and fails with its mend", linkedLib?.message);
    fs.rmSync(path.join(project, "core", "tasks")); fs.renameSync(path.join(project, "core", "t"), path.join(project, "core", "tasks")); git("add", "-A"); git("commit", "-q", "-m", "the folder back");
    const odd = path.join(project, "core", "tasks", "a\n::notice::b.md");
    fs.symlinkSync("../roles/builder.md", odd); git("add", "-A"); git("commit", "-q", "-m", "a link with a line break in its name");
    let oddLink = null;
    try { calledFor(project); } catch (e) { oddLink = e; }
    ok(oddLink !== null && mended(oddLink.message) && !/\n/.test(oddLink.message) && oddLink.message.includes(JSON.stringify("core/tasks/a\n::notice::b.md")), "a link's name is printed written out, so that no line of it reads as the script's own", oddLink?.message);
    fs.rmSync(odd); git("add", "-A"); git("commit", "-q", "-m", "the link out");
  }
  fs.renameSync(path.join(project, "core", "roles"), path.join(project, "core", "r")); git("add", "-A"); git("commit", "-q", "-m", "the roles moved");
  const gone = coreHere(project);
  ok(gone.at === null && mended(`FAIL ${gone.mend}`), "a head that holds the core nowhere its base held it fails, with its mend", JSON.stringify(gone));
  git("checkout", "-q", "--orphan", "alone"); git("commit", "-q", "-m", "no parent");
  ok(calledFor(project) === null, "with no base to read against, nothing is asked");
}
// (a head of the core's own repository that puts its rules elsewhere, its added manifest naming a copy it brings:
// refused, with its mend)
{
  const tmp = scratchDir("pr-description-test-"), own = path.join(tmp, "own");
  const outer = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
  const env = { ...outer, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...args) => execFileSync("git", args, { cwd: own, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(own, f)), { recursive: true }); fs.writeFileSync(path.join(own, f), text); };
  put("roles/a.md", "a\n"); put("floor/security.md", "f\n");
  git("init", "-q", "-b", "main"); git("add", "-A"); git("commit", "-q", "-m", "the base");
  ok(JSON.stringify(coreHere(own)) === JSON.stringify({ at: "", mend: null }), "the core's own repository is read at its root, with nothing to mend");
  put("core-manifest.md", `Core: someone/core at ${"0".repeat(40)}, copied whole under x/\n`); put("x/roles/a.md", "a\n"); put("x/floor/security.md", "f\n");
  git("add", "-A"); git("commit", "-q", "-m", "another place");
  const moved = coreHere(own);
  ok(moved.at === null && mended(`FAIL ${moved.mend}`) && /under x\/, where its base, the core's own repository, held them at its root/.test(moved.mend), "a head of the core's own repository that reads its rules elsewhere is refused, with its mend", JSON.stringify(moved));
}
process.exit(failed ? 1 : 0);
