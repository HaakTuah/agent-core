// Tests of where a project's copy of the core stands (core-path.mjs; tasks/repositories.md, "The manifest says where the
// core's copy is"): the manifest's "Core:" line read in both forms, each fault with its mend, the floor's own copy, the
// carried core read from its library's manifest, the path the reading script reads alone (reading.mjs's pathIn, which
// imports nothing) held to it, and the script run from a project's root. Node's own modules only.
//
//   node scripts/core-path-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { carriedAt, corePath, floorCopyIn, readCore } from "./core-path.mjs";
import { mended } from "./mend.mjs";
import { pathIn } from "./reading.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const A = "a".repeat(40);
const copied = (at = "core/") => `# Core manifest\n\nCore: ${CORE} at ${A}, copied whole under ${at} (never edited here).\n`;
const carried = (lib = "lib/", at = "lib/core/") => `# Core manifest\n\nCore: ${CORE}, carried by ${lib} under ${at} (never edited here).\nFloor copy: floor-copy/\n`;

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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "core-path-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const script = fileURLToPath(new URL("./core-path.mjs", import.meta.url));
const run = text => { fs.writeFileSync(path.join(tmp, "core-manifest.md"), text); return spawnSync(process.execPath, [script], { cwd: tmp, encoding: "utf8" }); };
let out = run(carried());
ok(out.status === 0 && out.stdout.trim() === "lib/core/", "from a project's root it prints the path", out.stdout + out.stderr);
out = run("# Core manifest\n");
ok(out.status === 1 && mended(out.stderr), "and fails, saying the mend, where the line is wrong", out.stderr);
ok(corePath(tmp) === "core/" && corePath(path.join(tmp, "nowhere")) === "", "a manifest whose line is wrong reads as the usual path; no manifest, the core's own root");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on where the core's copy stands`);
process.exitCode = failed ? 1 : 0;
