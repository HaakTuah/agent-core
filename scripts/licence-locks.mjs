// The npm lock files of a project that its licence config does not name (floor rule 10; #1316), for the licence check
// (licences.mjs, beside this file). GitHub's dependency review matches the names it lets through ("data", "fonts" and
// some of "accepted", the project's and the core's: actionLists there) by name alone, whatever the version, in every
// lock file a pull request changes; so a lock file the licence check does not read is held by the review alone, which
// cannot tell what ships and lets those names through unread. Each tracked package-lock.json and npm-shrinkwrap.json
// is named in "lockfiles", or is said here: one the pull request adds fails; one that stood at its base, or with no base
// to read it against, is reported and passes ("Nothing locks a project" in the core's AGENTS.md). Left to others: those
// the config's scan reads (licence-scan.mjs, which fails every one it reads), a shrinkwrap file beside a named lock file
// or the other way round (the check's own failure), and, in a project, its copy of the core, whose lock files the core
// holds under its own config, the copy held to the pin byte for byte (core.yml).
import { execFileSync } from "node:child_process";
import { posix } from "node:path";
import { copyOf } from "./core-path.mjs";

const LOCKFILE = /(^|\/)(package-lock|npm-shrinkwrap)\.json$/u;

// (a path of the config's "scan" holds a file where it is that file, or a folder ending in "/" above it, as the scan reads it)
const under = (f, paths) => (paths ?? []).some((p) => p === "" || p === f || (p.endsWith("/") && f.startsWith(p)));

/** The tracked files of the project at `root` (git ls-files), or null where git lists none there. */
export function trackedIn(root) {
  try { return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean); } catch { return null; }
}

/** Each npm lock file of `tracked` (the tracked files of the project at `root`, or null where none could be listed)
 *  that `config` (normalised) does not name, read against `base` (a commit, or null) with `stood(f)`, whether the base
 *  held `f`: { failures, reports }. */
export function unnamedLocks(root, tracked, config, base, stood) {
  const failures = [], reports = [];
  if (tracked === null) return { failures, reports: ["the project's npm lock files could not be listed (git lists no tracked file at its root), so none the licence config does not name is said; a lock file it does not name is held by the dependency review alone. Mend: run the check in the project's git checkout"] };
  const named = new Set(config.lockfiles ?? []);
  const copy = tracked.includes("core-manifest.md") ? copyOf(root) : null;
  const twin = (f) => posix.join(posix.dirname(f), posix.basename(f) === "npm-shrinkwrap.json" ? "package-lock.json" : "npm-shrinkwrap.json");
  for (const f of tracked) {
    if (!LOCKFILE.test(f) || named.has(f) || named.has(twin(f))) continue;
    if (copy !== null && f.startsWith(copy)) continue;
    if (config.scan && !under(f, config.scan.skip)) continue;
    const said = `${f} is an npm lock file the licence config's "lockfiles" does not name, so this check reads none of its packages and the dependency review alone holds them, by name, to the tools' list`;
    if (base && !stood(f)) failures.push(`${said}. Mend: name ${f} in the config's "lockfiles", and its package.json in "ships" where its packages reach users`);
    else reports.push(`${said}; it stood so ${base ? "at the pull request's base" : "with no base to read it against"}, so it passes: name it in the config's "lockfiles"`);
  }
  return { failures, reports };
}
