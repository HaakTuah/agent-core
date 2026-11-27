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
// path is "" (its root). Node's own modules only; proven by core-path-test.mjs, core-path-hooks-test.mjs
// and core-path-read-test.mjs.
//
//   node core/scripts/core-path.mjs           prints the path, from the project's root; a line with its mend where the
//                                             line is wrong
//   node core/scripts/core-path.mjs --hooks   the commands of Claude Code's hooks for that path (hookCommands)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE, CORE_SOURCE } from "./core-address.mjs";
import { started } from "./started.mjs";
import { leadsOut, parseBounded } from "./guards.mjs";

export const MANIFEST = "core-manifest.md", DEFAULT = "core/";
// (a folder of the repository, from its root: plain names joined by "/", ending in "/"; none is "." or "..", nor .git,
// nor node_modules, where an install writes and no checkout holds the files)
const SEGMENT = "[A-Za-z0-9_][A-Za-z0-9._-]*";
const PATH = `(?:${SEGMENT}/)+`;
// (each path ends where the line has a space or ends, so a segment that is no plain name, as "..", fails the line
// rather than leaving a shorter path read; core.yml, the workflows' first step and the hooks read it so too)
const COPIED = `copied whole under (${PATH})(?= |$)`, CARRIED = `carried by (${PATH}) under (${PATH})(?= |$)`;
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
  const text = manifestText(path.join(root, MANIFEST));
  return text === null ? "" : readCore(text).path ?? DEFAULT;
}

/** The manifest's text at `file`, or null where there is none. One that is no regular file, a link to a device say, or
 *  past a mebibyte, or that stands there but cannot be read, reads as empty, its "Core:" line then missing, so that it stops no script that reads it. Given
 *  `{ linked: false }`, as the suites' selection reads its rules file, a link itself is no regular file, whatever it
 *  leads to; the manifest's other readers follow one (SECURITY.md, rule 5). */
export function manifestText(file, { linked = true } = {}) {
  const text = regularText(file, { linked });
  if (text !== null) return text;
  // (none read: null where nothing stands there, as the link that leads nowhere it follows, else empty)
  try { (linked ? fs.statSync : fs.lstatSync)(file); return ""; } catch { return null; }
}
const isLink = file => { try { return fs.lstatSync(file).isSymbolicLink(); } catch { return false; } };

/** The text of the regular file at `file`, read through one descriptor so that what is checked is what is read: opened
 *  once, without following a link where `linked` is false and without waiting (a pipe swapped in stops nothing), where
 *  the platform gives those flags, then checked open, and at most `bound` bytes of it read. Null where it is not there,
 *  is no regular file (a link, where `linked` is false), is past the bound or cannot be read. */
export function regularText(file, { linked = true, bound = 1 << 20 } = {}) {
  const { O_RDONLY, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
  // (where the platform gives no flag that refuses a link as it opens, as Windows, the link is refused before it)
  if (!linked && O_NOFOLLOW === undefined && isLink(file)) return null;
  // (where it follows a link, what the link leads to is looked at first, and opened only where it is a regular file; the
  // file opened must then be the one looked at, else nothing of it is read)
  const seen = linked ? lookedAt(file, bound) : undefined;
  if (seen === null) return null;
  let fd;
  try { fd = fs.openSync(file, O_RDONLY | (linked ? 0 : O_NOFOLLOW ?? 0) | (O_NONBLOCK ?? 0)); } catch { return null; }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > bound || (seen !== undefined && (stat.dev !== seen.dev || stat.ino !== seen.ino))) return null;
    return readAtMost(fd, bound);
  } catch { return null; } finally { fs.closeSync(fd); }
}
/** The text of a file of the project's own at `file`, as regularText reads it within `bound` bytes (a mebibyte where
 *  none is given), where `file`, every link on its way followed, lies inside the folder `root` (guards.mjs,
 *  leadsOut); else null. So a link inside the project reads as the file it leads to, and one that leads out of it, or
 *  to a device, a pipe or a folder, reads as none. */
export const ownText = (file, { root = ".", bound } = {}) => (leadsOut(root, file) ? null : regularText(file, { bound }));
// What the path leads to, where it is a regular file within `bound` bytes; else null.
function lookedAt(file, bound) {
  try { const seen = fs.statSync(file); return seen.isFile() && seen.size <= bound ? seen : null; } catch { return null; }
}
// The text an open descriptor holds, or null past `bound` bytes: one byte past it is asked, so that a file grown since
// it was checked is read as past it.
function readAtMost(fd, bound) {
  const chunks = [];
  let total = 0;
  while (total <= bound) {
    const chunk = Buffer.alloc(Math.min(1 << 16, bound + 1 - total)), n = fs.readSync(fd, chunk, 0, chunk.length, null);
    if (n === 0) break;
    chunks.push(chunk.subarray(0, n)); total += n;
  }
  return total > bound ? null : Buffer.concat(chunks).toString("utf8");
}

/** A text of the starter kit's or of the sync notes' as the project holds it, whose copy of the core stands at `copy`
 *  (corePath's, a path ending in "/"): the kit and the notes write the copy as core/, so each core/ that begins a path
 *  (not agent-core/, and not one that is part of the copy's own path already, as vendor/core/ is) is the copy's path
 *  (#628), and a second pass changes nothing. Of a mend, which names the project's own paths too: mendAt. */
export const atCopy = (text, copy) => {
  if (copy === "core/") return text;
  // (a core/ that is part of the copy's own path, wherever in it, is left, so that a second pass changes nothing)
  const inside = [...copy.matchAll(/core\//gu)].map(m => m.index);
  return text.replace(/(?<![\w-])core\//gu, (hit, at) => inside.some(i => at - i >= 0 && text.startsWith(copy, at - i)) ? hit : copy);
};
/** A mend as the project reads it: the core's own words in it (a step's wording, the notes' file names) name the copy as
 *  core/, and the project's own paths, which the mend names too, are left as they are. A core/ is the copy's where it
 *  stands at the start of a path (no letter, digit, dot, dash or slash before it, so a path already at the copy's
 *  place, or one of the project's own like src/core/, is passed over), and a file or folder of the core follows it
 *  (scripts/, floor/, README.md...) or nothing does, and that the project does not hold a file or folder of its own at
 *  (`own`): its core/notes.md and its core/AGENTS.md are its own (#628). A second pass changes nothing. */
// (and modules/, which the core's files left and the entries of the notes still name)
const TOP = new Set([...fs.readdirSync(new URL("..", import.meta.url)).filter(n => n !== ".git"), "modules"]);
// `own(path)` says whether the project holds a file or folder of its own at a path (steps.mjs: its files outside the copy),
// which is then its own whatever its name: a project that keeps the copy elsewhere often has its own core/ folder.
export const mendAt = (text, copy, own = () => false) => copy === "core/" ? text
  : text.replace(/(?<![\w./-])core\/([\w.-]*)([\w./-]*)/gu, (hit, name, rest) => {
    const at = `core/${name}${rest}`.replace(/\.+$/u, "").replace(/\/$/u, "");
    return (!name || TOP.has(name.replace(/\.+$/u, ""))) && !(at !== "core" && own(at)) ? copy + hit.slice("core/".length) : hit;
  });
/** The copy's path as the pattern of a regular expression. */
export const inCopy = copy => copy.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");

/** The core's copy as a path prefix, for a check to leave out of a project's own files: the manifest's path at `root`, or
 *  core/ where there is none to read (the core's own root, which holds no folder of that name). Read once for each root
 *  in a run, so a check may ask it for every file. */
const copies = new Map();
export const copyOf = (root = ".") => {
  if (!copies.has(root)) copies.set(root, corePath(root) || DEFAULT);
  return copies.get(root);
};

// (this script, which the core's own repository alone tracks at its root)
const OWN = "scripts/core-path.mjs";
/** The folder of the core's copy a check leaves out of a project's own files, given the tracked files of the repository at
 *  `root`: null in the core's own repository, which holds no copy whatever a core-manifest.md at its root says (its
 *  scripts/core-path.mjs is tracked at the root), and in a repository with no manifest; else copyOf(root) (#1350). */
export const copyAmong = (tracked, root = ".") =>
  tracked.includes(MANIFEST) && !tracked.includes(OWN) ? copyOf(root) : null;

/** Of the two files copyAmong reads, those git tracks at `root`, a checkout's root, the settings by which git runs a
 *  command of the checkout's own turned off; where git cannot list them there (no repository), those that stand on disk.
 *  A folder inside another repository that it does not track lists none: no copy is read there, which counts more as the
 *  project's own, never less. */
export function trackedOf(root = ".") {
  try {
    return execFileSync("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "ls-files", "-z", "--", MANIFEST, OWN], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean);
  } catch { return [MANIFEST, OWN].filter(f => fs.existsSync(path.join(root, f))); }
}
/** The copy's folder, or null, at the checkout `root`, for the scripts that read what runs with power or gate a merge
 *  (from the default branch's checkout) and for the suites' selection (from a pull request's own): copyAmong on what
 *  trackedOf finds there, so the core's own repository holds no copy. */
export const copyHeld = (root = ".") => copyAmong(trackedOf(root), root);
/** Whether the checkout at `root` is the core's own repository, as trackedOf finds it, whatever manifest stands at its
 *  root: the one that reads its rules from AGENTS.md, never from a core-manifest.md. */
export const coreItself = (root = ".") => trackedOf(root).includes(OWN);
/** The same for a check that leaves a copy out of a project's own files even where no manifest names it: null in the
 *  core's own repository, which leaves nothing out; else copyOf(root), core/ where no manifest names a path. */
export const copyAside = (root = ".") => coreItself(root) ? null : copyOf(root);

/** The folder of the floor's own copy the manifest names on its line "Floor copy: <folder>/", which a repository whose
 *  core a library carries keeps until every agent tool has passed the staged cases carried and no-floor; null where it
 *  names none. Given the manifest's text, or with `root` read from there. */
export function floorCopyIn(text) {
  return new RegExp(`^Floor copy: (${PATH})(?= |$)`, "mu").exec(String(text ?? ""))?.[1] ?? null;
}
export function floorCopy(root = ".") {
  const text = manifestText(path.join(root, MANIFEST));
  return text === null ? null : floorCopyIn(text);
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

/** The project a script of the core's copy at `from` (a folder) checks: { root, prefix }, the root git's top of the
 *  working tree there, or, where that is a library's submodule carrying the core into a project whose manifest names it
 *  so, the project's own, so that no check reads the library's files in the project's place; and the path from that
 *  root to `from`, as git spells it, with its last "/" ("" at the root). Both "" where `from` is in no work tree. */
export function projectAt(from) {
  const ask = args => { try { return execFileSync("git", ["rev-parse", ...args], { cwd: from, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
  const top = ask(["--show-toplevel"]), prefix = ask(["--show-prefix"]), above = top ? ask(["--show-superproject-working-tree"]) : "";
  if (!above) return { root: top, prefix };
  const text = manifestText(path.join(above, MANIFEST));
  if (text === null) return { root: top, prefix };
  const line = readCore(text);
  // (where `from` stands in the project, spelled from git's own answers alone, since a folder's name as Node gives it
  // may differ, as Windows' short names do from git's long ones)
  const within = `${path.relative(above, top).split(path.sep).join("/")}/${prefix}`;
  if (line.form !== "carried" || !within.startsWith(line.path)) return { root: top, prefix };
  return { root: above, prefix: within };
}

/** The commands of Claude Code's hooks (.claude/settings.json) for a core at another path than core/, as the starter
 *  kit writes them for core/ (setup/template/claude-settings.json.tmpl): { start, helper, stop }. Each reads its script
 *  from main's own tree, never the working tree's (floor rule 3); where a submodule carries the core, from the library's
 *  commit main pins, read in the superproject's own module repository (`git rev-parse --git-path modules/<library>`),
 *  never in the library's folder, which a branch can commit as it likes (#930). The start first stops a session whose floor cannot be read at the path (tasks/repositories.md, "A
 *  session that cannot read its floor does nothing else"), since there no script of the core's can run to say so. */
export function hookCommands(core) {
  const dir = '"${CLAUDE_PROJECT_DIR:-.}"';
  const read = script => {
    const own = `git -C ${dir} --no-replace-objects show refs/remotes/origin/main:${core.path}scripts/${script} 2>/dev/null`;
    if (core.form !== "carried") return own;
    const lib = core.library.slice(0, -1), rest = core.path.slice(core.library.length);
    return `${own} || { s=$(git -C ${dir} --no-replace-objects rev-parse refs/remotes/origin/main:${lib} 2>/dev/null) && m=$(git -C ${dir} rev-parse --git-path modules/${lib} 2>/dev/null) && git -C ${dir} --git-dir="$m" --no-replace-objects show "$s:${rest}scripts/${script}" 2>/dev/null; }`;
  };
  const stop = `echo "STOP: the floor cannot be read at ${core.path}floor/security.md, where core-manifest.md says the core stands. Do nothing else in this session until it is mended. Mend: bring the files of the core into the checkout (git submodule update --init, where a submodule carries them), or, where that cannot be done here, say so to the owner and stop."`;
  return {
    start: `bash -c '[ -f ${dir}/${core.path}floor/security.md ] || { ${stop}; exit 0; }; f=$(${read("work-saved.sh")}) || { echo "Not run: the work-saved hook runs only its copy merged into main, and refs/remotes/origin/main has none. Fetch main (git fetch origin main), and it runs from the next reply on."; exit 0; }; bash -c "$f" work-saved start'`,
    helper: `bash -c 'f=$(${read("helper-call.mjs")}) || exit 0; node --input-type=module -e "$f"'`,
    stop: `bash -c 'f=$(${read("work-saved.sh")}) || exit 0; bash -c "$f" work-saved stop'`,
  };
}

/** The text of Claude Code's settings as the starter kit writes it (core/), with its three hooks' commands those for the
 *  copy at `core.path` (hookCommands), as a project whose manifest names another path holds them; unchanged where the
 *  path is core/, where `core` is null, or where the text has no such hook (an older kit's keeps its own). */
export function hooksAt(text, core) {
  if (!core || core.path === "core/") return text;
  const settings = parseBounded(text), commands = hookCommands(core);
  for (const [event, command] of [["SessionStart", commands.start], ["PreToolUse", commands.helper], ["Stop", commands.stop]]) {
    const hook = settings.hooks?.[event]?.[0]?.hooks?.[0];
    if (hook) hook.command = command;
  }
  return `${JSON.stringify(settings, null, 2)}\n`;
}

if (started(import.meta.url)) {
  const text = manifestText(MANIFEST); // (null: the core's own root)
  const core = text === null ? { path: "" } : readCore(text);
  if (core.wrong) { console.error(`FAIL: ${core.wrong}`); process.exit(1); }
  if (process.argv.includes("--hooks")) console.log(JSON.stringify(hookCommands(core), null, 2));
  else console.log(core.path || "(the core's own root)");
}
