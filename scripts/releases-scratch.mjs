// What the tests of the core's releases (releases-test.mjs, release-test.mjs, release-trial-test.mjs) stand on: a scratch repository that stands
// in for the core (main with four commits, a side branch), with git's own variables that point at another repository left
// out of the process and git finding no bare repository by itself (as Git 3.0 has it by default), and a project's own
// repository to try the scripts' guard against those variables. Tests only. Git and Node's own modules only.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { NOTES, elsewhere, fetchCore } from "./releases.mjs";
import { scratchDir } from "./scratch-core.mjs";

/** The scratch core: `core` is its path, `git(dir, ...args)` runs git there with no variable that points elsewhere,
 *  `commit(notes)` adds a commit holding the sync notes, `head` is the notes' first lines, `c1`..`c4` and `side` are the
 *  commits, and `fetched()` is a copy of it fetched as the scripts fetch the core. */
export function scratchCore(prefix) {
  const tmp = scratchDir(prefix);
  // (git's own variables that point at a repository are left out, so every call lands in the scratch one)
  for (const name of Object.keys(process.env)) if (elsewhere.test(name)) delete process.env[name];
  // (and git finds no bare repository by itself, as Git 3.0 has it by default: the scripts name each one they make)
  Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.bareRepository", GIT_CONFIG_VALUE_0: "explicit" });
  // (the test's own calls never take a variable that points elsewhere, even while one is set to try the scripts)
  const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !elsewhere.test(name))), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const core = path.join(tmp, "core");
  fs.mkdirSync(path.join(core, path.dirname(NOTES)), { recursive: true });
  git(core, "init", "-q", "-b", "main");
  let n = 0;
  const commit = (notes) => {
    fs.writeFileSync(path.join(core, NOTES), notes);
    fs.writeFileSync(path.join(core, "n"), String(++n));
    git(core, "add", "-A");
    git(core, "commit", "-q", "-m", `commit ${n}`);
    return git(core, "rev-parse", "HEAD");
  };
  const head = "# What a sync asks of a project\n\n";
  const c1 = commit(head), c2 = commit(`${head}- **First.** Done when one.\n`);
  git(core, "checkout", "-q", "-b", "side");
  const side = commit(`${head}- **First.** Done when one.\n- **Aside.** Never on main.\n`);
  git(core, "checkout", "-q", "main");
  const c3 = commit(`${head}- **First.** Done when one.\n- **Second.** Done when two.\n`), c4 = commit(`${head}- **First.** Done when one.\n- **Second.** Done when two.\n`);
  const fetched = () => { const dir = fs.mkdtempSync(path.join(tmp, "fetched-")); fetchCore(dir, core); return dir; };
  return { tmp, git, core, commit, head, c1, c2, c3, c4, side, fetched };
}

/** A project's own repository with a copy of the core under `core/scripts` and one commit, `own`, for the tests of what
 *  the scripts do while git's own variables point at it: `victim` is its path. */
export function victimRepo(tmp, git) {
  const victim = path.join(tmp, "victim");
  fs.mkdirSync(path.join(victim, "core", "scripts"), { recursive: true });
  git(victim, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(victim, "f"), "x");
  git(victim, "add", "-A");
  git(victim, "commit", "-q", "-m", "its own");
  return { victim, own: git(victim, "rev-parse", "HEAD") };
}
