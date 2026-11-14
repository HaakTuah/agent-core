// The tree a project's copy of the core must be: the core's at a pin, without the one folder that commit's own
// .gitattributes keeps in the core alone (the line `/reports export-ignore`, which `git archive` obeys when the sync
// makes the copy). A pin from before that line gives the whole tree, and so does any other spelling of the line: it
// is read as a whole line, byte for byte, as core.yml reads it (`grep -x`). Built in the repository whose git folder is
// `gitDir` (a bare repository's own folder, or a clone's .git), from the pin's own entries: each call names that folder
// outright, as releases.mjs says a bare repository must be. And how two trees are compared, here and in core.yml alike
// (core archive 201): entry by entry, by git's object ids and types, so a file's content, a link and a submodule each
// count, while the executable bit does not: a copy made on Windows records every file 100644, and nothing runs a file
// of the copy by its mode (each of its scripts is started through bash or node). This is the one place that reason is
// written; core.yml and pure-sync.mjs point here. Git and Node's own modules only; proven by copy-tree-test.mjs.
import { inBare } from "./releases.mjs";

const KEPT = "/reports export-ignore";
const git = (args, gitDir, input) =>
  inBare(gitDir, args, { input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"], maxBuffer: 1 << 26 });

export function copyTree(pin, gitDir) {
  let attributes = "";
  try { attributes = git(["show", `${pin}:.gitattributes`], gitDir); } catch { /* (none at that pin) */ }
  if (!attributes.split("\n").includes(KEPT)) return git(["rev-parse", `${pin}^{tree}`], gitDir).trim();
  const entries = git(["ls-tree", "-z", pin], gitDir).split("\0").filter((entry) => entry && entry.slice(entry.indexOf("\t") + 1) !== "reports");
  return git(["mktree", "-z"], gitDir, entries.map((entry) => `${entry}\0`).join("")).trim();
}

/** A tree's entries, one line each, "mode type id<TAB>path" with every file's mode as 100644, in git's order and with
 *  each path quoted as git quotes it (so no name holding a line's end can pass for two entries), as core.yml lists
 *  them: two copies are the same where these are. `tree` names a tree in the repository whose git folder is `gitDir`. */
export function entries(tree, gitDir) {
  return git(["-c", "core.quotePath=true", "ls-tree", "-r", "--full-tree", tree], gitDir).split("\n").filter(Boolean).map((e) => e.replace(/^100755 blob /, "100644 blob ")).join("\n");
}

/** Whether `core` in the commit `rev`, in the repository whose git folder is `gitDir`, is a folder: a tree entry, never
 *  a submodule's pointer (whose id may name a tree all the same) nor a file or a link. */
export function coreIsFolder(rev, gitDir) {
  try {
    return git(["ls-tree", rev, "--", "core"], gitDir) === `040000 tree ${git(["rev-parse", "--verify", "-q", `${rev}:core`], gitDir).trim()}\tcore\n`;
  } catch {
    return false;
  }
}
