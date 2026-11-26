// A scratch history for the tests of the readers that count from git (#1422; shallow.mjs): a repository whose commits
// each carry a day and a subject, and clones of it, whole and shallow. Node's own modules and git.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { scratchDir } from "./scratch-core.mjs";

const IDENT = ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false"];

// The repository `src` of a scratch folder `prefix`: a branch `main` of one commit for each of `steps`, [{ day, subject,
// files: { name: text } }], oldest first, the files written whole, and the folder's name. `clone(name, ...options)`
// makes a clone of it beside it (`--depth`, `--shallow-since`), whose path it returns.
export function scratchHistory(prefix, steps) {
  const dir = scratchDir(prefix), src = path.join(dir, "src");
  const at = (cwd, day, ...args) => execFileSync("git", [...IDENT, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", env: { ...process.env, GIT_COMMITTER_DATE: `${day}T12:00:00Z`, GIT_AUTHOR_DATE: `${day}T12:00:00Z` } });
  fs.mkdirSync(src);
  at(src, steps[0].day, "init", "-q", "-b", "main");
  for (const { day, subject, files } of steps) {
    for (const [name, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(src, name)), { recursive: true }); fs.writeFileSync(path.join(src, name), text); }
    at(src, day, "add", "-A"); at(src, day, "commit", "-q", "-m", subject);
  }
  return { dir, src, clone: (name, ...options) => { at(dir, steps[0].day, "clone", "-q", ...options, `file://${src}`, name); return path.join(dir, name); } };
}
