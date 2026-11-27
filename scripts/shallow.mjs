// Whether a clone holds the history a reader counts (#1027, #1422): a shallow clone holds no commit older than its
// boundary, and a count from it passes a part for the whole, the same wrong number for every rule or merge whose
// start the boundary hides. The readers that count merges or commits from git (core-cost.mjs, review-record.mjs,
// pruning-read.mjs, dose.mjs, fixes.mjs) ask this one place, say it could not count, and give its mend. A reader
// changes nothing, so the clone is never deepened here. git and Node's own modules.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const git = (args, root) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });

// A moment's day, UTC's whatever offset it was written with.
export const dayOf = iso => new Date(iso).toISOString().slice(0, 10);

export const isShallow = (root = ".") => git(["rev-parse", "--is-shallow-repository"], root).trim() === "true";

// Why the history cannot all be read from the clone at `root`, or null where it can: it is shallow and `since` (a day)
// is no day after its newest boundary commit (the clone then holds all that is newer than `since`), or none is given.
// `reaches` words what starts before the boundary; the mend is the words of the failure. It throws where git cannot
// read `root`.
export function shallowGap(since = null, root = ".", reaches = `--since ${since}`) {
  if (!isShallow(root)) return null;
  const file = path.resolve(root, git(["rev-parse", "--git-path", "shallow"], root).trim());
  const days = (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : [])
    .map(sha => dayOf(git(["log", "-1", "--format=%cI", sha], root).trim()));
  const newest = days.sort().at(-1);
  if (since && newest && since > newest) return null;
  return `the clone is shallow, so it holds no history older than its boundary${newest ? ` (${newest})` : ""}${since ? ` and ${reaches} reaches before it` : ""}, and a count from it would pass a part for the whole. Mend: run git fetch --unshallow in this clone, then run the command again`;
}
