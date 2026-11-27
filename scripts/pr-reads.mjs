// What the paths a pull request changes call for, for the line "Read for it:" (split from pr-description.mjs, #888; "One
// script says what to read" in tasks/tools.md). pr-description.mjs, beside this file, runs it and exports it.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { coreAtBase } from "./owner-yes.mjs";
import { OWN, calledByPaths, coreAt, leftOut, library, ownOf, ownPaths, shown, taken, whole } from "./reading.mjs";

// What the paths a pull request changes call for, [{ file, why }], in the checkout at `dir`, the merge commit against
// its first parent, the base: each file by its path from the root (under core/ in a project). The kinds a project
// gives its own paths, and the modules its manifest leaves out, are read as the base holds them, so that a pull request
// does not set either for itself; the
// modules' own lines are the copy's, which core.yml holds to the core's. Null where the change cannot be read; a git
// read that did not finish throws, with its mend (whole(), reading.mjs).
export function calledFor(dir) {
  const git = (...args) => whole(spawnSync("git", args, { cwd: dir, encoding: "utf8", maxBuffer: 1 << 26 }));
  const prefix = coreAt(dir), diff = prefix === null ? null : git("diff", "--name-only", "--no-renames", "-z", "HEAD^1", "HEAD");
  if (diff === null) return null;
  const own = prefix ? ownPaths(OWN.map(f => git("show", `HEAD^1:${f}`)).find(text => text !== null)) : [];
  const all = library(dir, prefix);
  // (a link among the modules is read as no file: a failure with its mend, never a module that asks nothing; each
  // printed as shown() writes it, so that no name reads as a line of the script's own)
  if (all.links.length) throw new Error(`FAIL: what the changed paths call for cannot be read: ${all.links.map(shown).join(", ")} ${all.links.length === 1 ? "is a link" : "are links"} where the core's rules stand. Mend: put each file and folder itself in its place, as the base holds it, and run the check again`);
  const lib = taken(all, leftOut(prefix ? git("show", "HEAD^1:core-manifest.md") : ""), prefix);
  return calledByPaths(lib, ownOf(diff.split("\0").filter(Boolean), prefix), own).map(c => ({ ...c, file: `${prefix}${c.file}` }));
}

// Where the core lies at the head of the checkout at `dir`, as coreAt finds it, with the failure's mend where the
// description's lines cannot be read for it: a core-manifest.md that stands as no regular file of the checkout's own, or
// a head that holds the core anywhere but where its base held it (coreAtBase, owner-yes.mjs), so that no line that
// reads where the core lies is passed as not asked, nor read from a place the pull request sets. { at, mend }, the mend
// null where there is none.
export function coreHere(dir) {
  let stat = null;
  try { stat = fs.lstatSync(path.join(dir, "core-manifest.md")); } catch { /* (none: the core's own root, or a project's first) */ }
  if (stat && !stat.isFile()) return { at: null, mend: "core-manifest.md is no regular file of the checkout's own, and the description's lines read from it where the core lies. Mend: put the manifest itself in its place, a file as the sync writes it, and run the check again" };
  const at = coreAt(dir), base = coreAtBase(dir);
  if (at === null && base !== null) return { at, mend: "the head holds the core's roles/ and floor nowhere as a real folder and file, though its base held them, so the description's lines cannot be read for it. Mend: put the core's copy back as the base held it, each file and folder itself in its place, and run the check again" };
  if (base !== null && at !== base) return { at: null, mend: `the head holds the core under ${at || "its root"}, where its base held it under ${base || "its root"}, so the description's lines are not read for it. Mend: keep the core where the base holds it, the manifest's "Core:" line as the base has it, and move it in a pull request of its own, and run the check again` };
  return { at, mend: null };
}
