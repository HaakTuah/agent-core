// Where a project's copy of the core stands (tasks/repositories.md, "The manifest says where the core's copy is"; #285):
// read from its manifest's one `Core:` line, never assumed. Two forms:
//
//   Core: <the core's address> at <full SHA>, copied whole under <path>/ (never edited here).
//   Core: <the core's address>, carried by <library>/ under <path>/ (never edited here).
//
// the first a copy of the project's own, pinned and synced here; the second the core a library of the project's carries
// (a folder of this repository: its files committed, or a submodule), at <path>/ inside it, as that library's own
// manifest, <library>/core-manifest.md, pins it: one sync, in the library. `core/` is the default and the first form's
// usual path, so a project in one repository reads as it always did. The core's own repository has no manifest, and its
// path is "" (its root). Node's own modules only; proven by core-path-test.mjs.
//
//   node core/scripts/core-path.mjs    prints the path, from the project's root; a line with its mend where the line is wrong
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, CORE_SOURCE } from "./core-address.mjs";

export const MANIFEST = "core-manifest.md", DEFAULT = "core/";
// (a folder of the repository, from its root: plain names joined by "/", ending in "/"; none is "." or "..", nor .git,
// nor node_modules, where an install writes and no checkout holds the files)
const SEGMENT = "[A-Za-z0-9_][A-Za-z0-9._-]*";
const PATH = `(?:${SEGMENT}/)+`;
const COPIED = `copied whole under (${PATH})`, CARRIED = `carried by (${PATH}) under (${PATH})`;
const FORMS = `"Core: ${CORE} at <full commit SHA>, copied whole under <path>/" or "Core: ${CORE}, carried by <library>/ under <path>/"`;
const plain = p => !p.split("/").some(s => s === ".git" || s === "node_modules" || /^\.+$/u.test(s));

/** The manifest's `Core:` line read: { form: "copied", pin, path } or { form: "carried", library, path }, or
 *  { wrong } with its mend where there is no one such line. `address` is the core's, as core-address.mjs names it. */
export function readCore(text, address = CORE) {
  const source = address === CORE ? CORE_SOURCE : address.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
  const lines = String(text ?? "").split(/\r?\n/u).filter(l => /^Core: /u.test(l));
  const mend = `Mend: write one line ${FORMS.replaceAll(CORE, address)}, as the sync writes it (core/ is the usual path)`;
  if (lines.length !== 1) return { wrong: `${MANIFEST} has ${lines.length ? "more than one" : "no"} "Core:" line. ${mend}` };
  const copied = new RegExp(`^Core: ${source} at ([0-9a-f]{40}), ${COPIED}`, "u").exec(lines[0]);
  if (copied && plain(copied[2])) return { form: "copied", pin: copied[1], path: copied[2] };
  const carried = new RegExp(`^Core: ${source}, ${CARRIED}`, "u").exec(lines[0]);
  if (carried && plain(carried[2]) && carried[2].startsWith(carried[1]) && carried[2] !== carried[1])
    return { form: "carried", library: carried[1], path: carried[2] };
  if (carried) return { wrong: `${MANIFEST}: the core is carried by ${carried[1]} but its path, ${carried[2]}, is no folder inside it. Mend: name the folder of the library that holds the core, as the library's own manifest names it (${carried[1]}core/ where it keeps the usual path)` };
  return { wrong: `${MANIFEST}: its "Core:" line is in neither form, or names a path with ".", "..", .git or node_modules in it. ${mend}` };
}

/** The path of the core from the root `root`: "" in the core's own repository (no manifest), the manifest's where its
 *  line reads, and the default where it does not (the checks that read the line say what is wrong with it). */
export function corePath(root = ".") {
  let text;
  try { text = fs.readFileSync(path.join(root, MANIFEST), "utf8"); } catch { return ""; }
  return readCore(text).path ?? DEFAULT;
}

/** The folder of the floor's own copy the manifest names on its line "Floor copy: <folder>/", which a repository whose
 *  core a library carries keeps until every agent tool has passed the staged cases carried and no-floor; null where it
 *  names none. Given the manifest's text, or with `root` read from there. */
export function floorCopyIn(text) {
  return new RegExp(`^Floor copy: (${PATH})`, "mu").exec(String(text ?? ""))?.[1] ?? null;
}
export function floorCopy(root = ".") {
  try { return floorCopyIn(fs.readFileSync(path.join(root, MANIFEST), "utf8")); } catch { return null; }
}

/** For a carried core, what the library's own manifest says: { pin, path } with the path from this repository's root,
 *  or { wrong } with its mend. `read(file)` gives a file's text from the root, or null. */
export function carriedAt(core, read) {
  const own = read(`${core.library}${MANIFEST}`);
  if (own === null) return { wrong: `${core.library}${MANIFEST} cannot be read here, so neither the pin nor the path of the core the library carries can be. Mend: have the library's files in the checkout (its folder committed, or its submodule checked out: git submodule update --init ${core.library.slice(0, -1)})` };
  const lib = readCore(own);
  if (lib.wrong) return { wrong: `${core.library}${lib.wrong}` };
  if (lib.form !== "copied") return { wrong: `${core.library}${MANIFEST} names no copy of its own: a library carries the core it copies, at its pin. Mend: carry the core from the library that holds the copy` };
  if (`${core.library}${lib.path}` !== core.path) return { wrong: `${MANIFEST} names the carried core under ${core.path}, and the library's manifest under ${core.library}${lib.path}. Mend: name ${core.library}${lib.path} in the "Core:" line` };
  return { pin: lib.pin, path: core.path };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let text = null;
  try { text = fs.readFileSync(MANIFEST, "utf8"); } catch { /* (the core's own root) */ }
  const core = text === null ? { path: "" } : readCore(text);
  if (core.wrong) { console.error(`FAIL: ${core.wrong}`); process.exit(1); }
  console.log(core.path || "(the core's own root)");
}
