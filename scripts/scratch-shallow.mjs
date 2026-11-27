// A scratch history for the tests of the readers that count from git (#1422; shallow.mjs): a repository whose commits
// each carry a day and a subject, and clones of it, whole and shallow. Node's own modules and git.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { scratchDir } from "./scratch-core.mjs";

const IDENT = ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false"];

// One git call in `cwd`; a last argument that is an object is the environment it adds. Its failure carries git's own words.
const git = (cwd, ...args) => {
  const env = typeof args.at(-1) === "object" ? args.pop() : {};
  return execFileSync("git", [...IDENT, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", env: { ...process.env, ...env } });
};

// A clone in `cwd` of the local repository `src`, to `to`, whole or to `depth` commits: its path. Each call is written out
// so the licence scan reads it as no fetch (#1437).
function cloneTo(cwd, src, to, depth) {
  if (depth === undefined) execFileSync("git", ["clone", "-q", "--", `file://${src}`, to], { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  else execFileSync("git", ["clone", "-q", "--depth", String(depth), "--", `file://${src}`, to], { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  return path.resolve(cwd, to);
}

// The repository `src` of a scratch folder `prefix`: a branch `main` of one commit for each of `steps`, [{ day, subject,
// files: { name: text } }], oldest first, the files written whole, and the folder's name. `clone(name, depth)` makes a
// clone of it beside it, whole or to `depth` commits, whose path it returns.
export function scratchHistory(prefix, steps) {
  const dir = scratchDir(prefix), src = path.join(dir, "src");
  const at = (cwd, day, ...args) => git(cwd, ...args, { GIT_COMMITTER_DATE: `${day}T12:00:00Z`, GIT_AUTHOR_DATE: `${day}T12:00:00Z` });
  fs.mkdirSync(src);
  at(src, steps[0].day, "init", "-q", "-b", "main");
  for (const { day, subject, files } of steps) {
    for (const [name, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(src, name)), { recursive: true }); fs.writeFileSync(path.join(src, name), text); }
    at(src, day, "add", "-A"); at(src, day, "commit", "-q", "-m", subject);
  }
  const clone = (name, depth) => cloneTo(dir, src, name, depth);
  return { dir, src, clone };
}

// A shallow clone of the repository `src`, to `depth` commits, beside it as `<its folder>-<name>`: its path.
export function shallowCopy(src, name, depth) {
  return cloneTo(path.dirname(src), src, `${src}-${name}`, depth);
}
