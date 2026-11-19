// The sync notes, read whole (AGENTS.md, "A record pull requests add to is a folder of one file per entry"; #750, point
// 1): setup/sync-notes.md holds what it says of itself and a line naming the folder its entries stand in, a file an
// entry (setup/sync-notes/NNN-<name>.md), read in the order of their names, each with its step of the same name in
// scripts/steps/ (steps.mjs, beside this file). A copy from before the folder holds its entries in the file itself,
// and is read the same way, so that the notes of any two commits compare. Reads only; Node's own modules.
//
//   node core/scripts/sync-notes.mjs     the notes whole, as one text, each entry in its place
import fs from "node:fs";
import path from "node:path";
import { started } from "./started.mjs";

export const NOTES = "setup/sync-notes.md", FOLDER = "setup/sync-notes";
export const POINTER = "Its entries stand in `setup/sync-notes/`, a file each, read in the order of their names.";
// How the notes' one line that is no entry opens: the notice that a sync from a copy older than the folder prints, its
// reader taking what a diff of the file alone adds, which sends the session that syncs to the folder.
export const NOTICE = "- A copy of the core older than 19 November 2026 syncs with a script that reads what a sync asks from this file alone";

// The notes whole, from `read(file)` (its text, null where it is not there) and `list(folder)` (the names of the files
// in it): the file's text, the line naming the folder replaced by the folder's entries; null where the file is not.
export function notesFrom(read, list) {
  const text = read(NOTES);
  if (text === null) return null;
  return text.split("\n").map(line => (line.replace(/\r$/u, "") !== POINTER ? line
    : list(FOLDER).filter(f => f.endsWith(".md")).sort().map(f => (read(`${FOLDER}/${f}`) ?? "").replace(/\r?\n$/u, "")).join("\n"))).join("\n");
}

// The notes whole in the core, or a copy of it, at `root`.
export const notes = (root = ".") => notesFrom(
  f => { try { return fs.readFileSync(path.join(root, f), "utf8"); } catch { return null; } },
  dir => { try { return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name); } catch { return []; } });

// The notes whole at commit `rev`, through `run`, which runs git with the arguments it is given in the repository
// that holds it and returns what git printed (or throws).
export const notesAt = (rev, run) => notesFrom(
  f => { try { return run(["cat-file", "blob", `${rev}:${f}`]); } catch { return null; } },
  dir => { try { return run(["ls-tree", "--name-only", `${rev}:${dir}`]).split("\n").filter(Boolean); } catch { return []; } });

// The entries of notes read whole: each line that opens an item of the list.
export const entries = text => String(text ?? "").split("\n").map(l => l.replace(/\r$/u, "")).filter(l => l.startsWith("- "));

if (started(import.meta.url)) process.stdout.write(notes() ?? "");
