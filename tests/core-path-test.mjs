// Tests of where a project's copy of the core stands (core-path.mjs; tasks/repositories.md, "The manifest says where
// the core's copy is"): the manifest's "Core:" line read in both forms, each fault with its mend, the floor's own
// copy, the carried core read from its library's manifest, the path the reading script reads alone (reading.mjs's
// pathIn, which imports nothing) held to it, and the script run from a project's root. Node's own modules only.
//
//   node tests/core-path-test.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { readCore, floorCopyIn, carriedAt, corePath, manifestText, floorCopy, atCopy, mendAt, trackedOf, copyHeld, copyAside } from "../scripts/core-path.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { pathIn } from "../scripts/reading.mjs";
import { copied, A, carried, CALLED, tmp } from "../scripts/core-path-scratch.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();

// the line, in both forms
let r = readCore(copied());
ok(r.form === "copied" && r.pin === A && r.path === "core/", "the usual line reads as a copy under core/, at its pin: a project in one repository reads as it did", JSON.stringify(r));
r = readCore(copied("vendor/the-core/"));
ok(r.form === "copied" && r.path === "vendor/the-core/", "a copy at another path the line names", JSON.stringify(r));
r = readCore(carried());
ok(r.form === "carried" && r.library === "lib/" && r.path === "lib/core/" && r.pin === undefined, "a core a library carries: the library and the path, and no pin of its own", JSON.stringify(r));
for (const [what, text] of [
  ["no line", "# Core manifest\n"],
  ["two lines", copied() + copied()],
  ["another core's address", copied().replace(CORE, "someone/else")],
  ["a pin that is no full SHA", copied().replace(A, "abc")],
  ["a path that climbs out", copied("../core/")],
  ["a path into .git", copied(".git/core/")],
  ["a path where an install writes", copied("node_modules/core/")],
  ["a carried path outside its library", carried("lib/", "other/core/")],
  ["a carried path that is the library itself", carried("lib/", "lib/")],
  ["a path that climbs out after a plain segment", copied("core/../evil/")],
  ["a carried library that climbs out after a plain segment", carried("lib/../x/", "lib/../x/core/")],
]) {
  const got = readCore(text);
  ok(got.wrong && mended(`FAIL: ${got.wrong}`) && !got.path, `${what}: read as wrong, saying the mend`, JSON.stringify(got));
}
ok(readCore(`> ${copied().split("\n")[2]}`).wrong, "a line quoted is no line");
// the floor's own copy
ok(floorCopyIn(carried()) === "floor-copy/" && floorCopyIn(copied()) === null && floorCopyIn("Floor copy: ../x/\n") === null, "the floor's own copy is the folder its line names, and none where no line names a folder");
// the reading script's own reading of the path, held to this one's
for (const text of [copied(), copied("vendor/the-core/"), carried(), carried("libs/shared/", "libs/shared/core/")]) ok(pathIn(text) === readCore(text).path, `the reading script reads the path ${readCore(text).path} alike`);
ok(pathIn("# Core manifest\n") === "core/", "where the line names none, the reading script takes the usual path");
// the sed of the workflows' first step (the personal-terms check's too, which reads the base's manifest) and of the work-saved hook, run on the same lines: each reads the path readCore
// reads, and nothing where readCore reads it as wrong, so no check runs a script from a folder core.yml never compared
{
  const hook = fs.readFileSync(fileURLToPath(new URL("../scripts/work-saved.sh", import.meta.url)), "utf8");
  const seds = [...[...CALLED, "personal-terms.yml"].map(f => [f, /sed -n -E ('[^']+')/u.exec(fs.readFileSync(fileURLToPath(new URL(`../.github/workflows/${f}`, import.meta.url)), "utf8"))?.[1] ?? "'no sed'", out => out.split(" ")[0]]),
    ["the hook", /sed -n -E ('s#\^Core: [^']+')/u.exec(hook)[1], out => out]];
  for (const text of [copied(), copied("vendor/the-core/"), carried(), copied("core/../evil/"), carried("lib/../x/", "lib/../x/core/"), copied("core/..x/"), `${copied().trimEnd()} trailing words\n`]) {
    const want = readCore(text).path ?? "";
    for (const [who, sed, take] of seds) {
      const r = spawnSync("bash", ["-c", `printf '%s\\n' "$1" | sed -n -E ${sed} | head -n 1`, "-", text], { encoding: "utf8" });
      ok(take(r.stdout.trim()) === want, `${who} read ${JSON.stringify(text.split("\n")[2])} as readCore does: ${want || "nothing"}`, r.stdout + r.stderr);
    }
  }
}
// the carried core, from its library's manifest
const files = { "lib/core-manifest.md": copied() };
const read = f => files[f] ?? null;
r = carriedAt(readCore(carried()), read);
ok(r.pin === A && r.path === "lib/core/", "a carried core's pin is its library's", JSON.stringify(r));
for (const [what, line, lib] of [
  ["a library whose manifest cannot be read", carried("other/", "other/core/"), files],
  ["a library whose path for the core is another", carried("lib/", "lib/the-core/"), files],
  ["a library that carries the core it does not copy", carried(), { "lib/core-manifest.md": carried("x/", "x/core/") }],
]) {
  const got = carriedAt(readCore(line), f => lib[f] ?? null);
  ok(got.wrong && mended(`FAIL: ${got.wrong}`), `${what}: wrong, saying the mend`, JSON.stringify(got));
}
// the script, from a project's root
const script = fileURLToPath(new URL("../scripts/core-path.mjs", import.meta.url));
const run = text => { fs.writeFileSync(path.join(tmp, "core-manifest.md"), text); return spawnSync(process.execPath, [script], { cwd: tmp, encoding: "utf8" }); };
let out = run(carried());
ok(out.status === 0 && out.stdout.trim() === "lib/core/", "from a project's root it prints the path", out.stdout + out.stderr);
out = run("# Core manifest\n");
ok(out.status === 1 && mended(out.stderr), "and fails, saying the mend, where the line is wrong", out.stderr);
ok(corePath(tmp) === "core/" && corePath(path.join(tmp, "nowhere")) === "", "a manifest whose line is wrong reads as the usual path; no manifest, the core's own root");
// the sync writes the copy where the path leads: a folder on the way that is a link, which could lead out of the
// project, stops it before it fetches or writes anything
if (process.platform !== "win32") {
  const linked = path.join(tmp, "linked"), outside = path.join(tmp, "outside");
  fs.mkdirSync(linked); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(linked, "vendor"));
  fs.writeFileSync(path.join(linked, "core-manifest.md"), copied("vendor/the-core/"));
  spawnSync("git", ["init", "-q"], { cwd: linked }); // (a project is a git repository, whose files the sync reads: own-files.mjs)
  const r = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/sync.mjs", import.meta.url))], { cwd: linked, encoding: "utf8" });
  ok(r.status === 1 && /vendor, on the way to the copy's path vendor\/the-core\/, is a link/.test(r.stderr) && mended(r.stderr) && fs.readdirSync(outside).length === 0, "the sync refuses a path through a link, saying the mend, and writes nothing", r.stderr);
} else console.log("note a link cannot be made here (Windows), so the sync's refusal of one is not tried");
// a manifest that is no regular file, or past a mebibyte, reads as empty: the usual path, no floor copy, and nothing
// that stops the script reading it (a manifest linked to a device once took every reader down: #593, point 8)
const odd = path.join(tmp, "odd");
fs.mkdirSync(path.join(odd, "core-manifest.md"), { recursive: true });
const big = path.join(tmp, "big");
fs.mkdirSync(big);
fs.writeFileSync(path.join(big, "core-manifest.md"), `${copied("vendor/core/")}${"x".repeat(1 << 20)}`);
ok(manifestText(path.join(odd, "core-manifest.md")) === "" && corePath(odd) === "core/" && floorCopy(odd) === null && corePath(big) === "core/" && manifestText(path.join(tmp, "nowhere", "core-manifest.md")) === null,
  "a manifest that is a folder, or past a mebibyte, reads as empty and so as the usual path; none, as null");
const edge = path.join(tmp, "edge");
fs.mkdirSync(edge);
fs.writeFileSync(path.join(edge, "core-manifest.md"), carried().padEnd(1 << 20, " "));
ok(corePath(edge) === "lib/core/" && floorCopy(edge) === "floor-copy/", "a manifest of a mebibyte exactly is read, its path and its floor copy among it");
// (through a link too: to a folder here, never to a device, which a mutant of the check would read without end and
// take the machine's memory with it)
if (process.platform !== "win32") {
  const linked = path.join(tmp, "linked-manifest");
  fs.mkdirSync(path.join(linked, "elsewhere"), { recursive: true });
  fs.symlinkSync(path.join(linked, "elsewhere"), path.join(linked, "core-manifest.md"));
  const r = spawnSync(process.execPath, [script], { cwd: linked, encoding: "utf8", timeout: 20000 });
  ok(corePath(linked) === "core/" && floorCopy(linked) === null && r.status === 1 && mended(r.stderr), "a manifest that is a link to what is no regular file reads as empty, and the script says the mend", `${r.status} ${r.signal} ${r.stderr}`);
}
// The starter kit's and the notes' words for the copy, in the project's own (#628): each core/ that begins a path
ok(atCopy("read core/tasks/x.md", "core/") === "read core/tasks/x.md" && atCopy("core/a ../../core/b `core/c` agent-core/d", "vendor/core/") === "vendor/core/a ../../vendor/core/b `vendor/core/c` agent-core/d",
  "a bare core/ is the copy's path, and agent-core/ is not");
ok(["vendor/core/", "packages/core/agent/", "packages/core/core/", "a.core/"].every(c => { const once = atCopy("x core/a ../../core/b `core/c`", c); return once === atCopy(once, c); }), "a second pass over a text changes nothing, whatever core/ the copy's own path holds");
{
  const mend = "see `core/scripts/x.mjs`, core/notes.md, src/core/a, vendor/core/b, `core/` and core/modules/x (in `core/notes.md`)";
  ok(mendAt(mend, "vendor/core/") === "see `vendor/core/scripts/x.mjs`, core/notes.md, src/core/a, vendor/core/b, `vendor/core/` and vendor/core/modules/x (in `core/notes.md`)" && mendAt(mend, "core/") === mend && mendAt(mendAt(mend, "packages/core/agent/"), "packages/core/agent/") === mendAt(mend, "packages/core/agent/"),
    "in a mend the core's own files are the copy's, and the project's own paths, core/notes.md and src/core/ among them, are not");
  ok(mendAt("see `core/scripts/x.mjs`. And core/README.md. Then core/floor.", "vendor/core/") === "see `vendor/core/scripts/x.mjs`. And vendor/core/README.md. Then vendor/core/floor.",
    "a core's file or folder at the end of a sentence is the copy's, its full stop kept");
  const mine = new Set(["core/AGENTS.md", "core/tests/a.test.mjs"]), own = at => [...mine].some(f => f === at || f.startsWith(`${at}/`));
  ok(mendAt("`core/AGENTS.md`, `core/tests/a.test.mjs`, `core/tests/`, `core/scripts/x.mjs`, `core/floor/` and `core/`.", "vendor/core/", own) === "`core/AGENTS.md`, `core/tests/a.test.mjs`, `core/tests/`, `vendor/core/scripts/x.mjs`, `vendor/core/floor/` and `vendor/core/`.",
    "a path the project holds as its own file or folder stays its own, though the core has one of the name");
}
ok(atCopy("refs/remotes/origin/main:vendor/core/a core/b", "vendor/core/") === "refs/remotes/origin/main:vendor/core/a vendor/core/b" && atCopy("core/a", "lib/the-core/") === "lib/the-core/a",
  "one already behind the copy's own folders is left as it stands");

// The copy told apart from the core's own repository (#1350), from the files git tracks at a checkout's root, for the
// scripts that read what runs with power or gate a merge: the core's own tracks scripts/core-path.mjs there, a
// project's does not; where no repository is there, the files on disk are read
{
  const at = (name, files, track = files) => {
    const dir = path.join(tmp, name);
    for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
    if (track) { spawnSync("git", ["init", "-q", dir]); spawnSync("git", ["add", "--", ...Object.keys(track)], { cwd: dir }); }
    return dir;
  };
  const own = { "core-manifest.md": copied("scripts/"), "scripts/core-path.mjs": "export {};\n" };
  const core = at("tracked-own", own), project = at("tracked-copy", { "core-manifest.md": copied("vendor/core/") });
  const untracked = at("tracked-none", { "core-manifest.md": copied("vendor/core/") }, {}), bare = at("tracked-no-manifest", { "README.md": "x\n" });
  const loose = at("tracked-no-repository", own, null), looseCopy = at("tracked-no-repository-copy", { "core-manifest.md": copied("vendor/core/") }, null);
  ok(JSON.stringify(trackedOf(core)) === JSON.stringify(["core-manifest.md", "scripts/core-path.mjs"]) && JSON.stringify(trackedOf(project)) === JSON.stringify(["core-manifest.md"]) && trackedOf(untracked).length === 0,
    "of the two files, those git tracks at the root are read, never one that only stands on disk", JSON.stringify([trackedOf(core), trackedOf(project), trackedOf(untracked)]));
  ok(copyHeld(core) === null && copyAside(core) === null, "in the core's own repository a manifest at its root names no copy, for either reading");
  ok(copyHeld(project) === "vendor/core/" && copyAside(project) === "vendor/core/", "in a project the copy is the manifest's");
  ok(copyHeld(untracked) === null && copyHeld(bare) === null && copyAside(bare) === "core/", "a manifest git does not track names none to the gates, and with no manifest only a check that leaves a copy aside takes core/");
  ok(JSON.stringify(trackedOf(loose)) === JSON.stringify(["core-manifest.md", "scripts/core-path.mjs"]) && copyHeld(loose) === null && copyAside(loose) === null && copyHeld(looseCopy) === "vendor/core/",
    "where no repository is there, the files on disk tell the core from a copy the same way", JSON.stringify(trackedOf(loose)));
}

done("where the core's copy stands");
