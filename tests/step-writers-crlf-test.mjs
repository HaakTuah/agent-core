// Tests that the steps' writers keep a file's Windows line ends (#1238): the size marks written by marksWritten, the
// files writeMoved changes, the manifest writePlaced writes, each on a tree whose files have CRLF, as git writes one
// with core.autocrlf, and read back in them. Node's own modules.
//
//   node tests/step-writers-crlf-test.mjs
import fs from "node:fs";
import path from "node:path";
import { kitIn } from "../scripts/steps-kit.mjs";
import { project } from "../scripts/steps.mjs";
import { eolOf, inEnds, marksWritten, writeMoved } from "../scripts/step-writers.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const dir = kitIn(scratchDir("crlf-writers-"))("an-npm-project", { packages: "." });
const raw = f => fs.readFileSync(path.join(dir, f), "utf8");
const crlf = text => text.replace(/\r?\n/gu, "\r\n");
const allCrlf = text => /\r\n/u.test(text) && !/(^|[^\r])\n/u.test(text);
const toCrlf = f => fs.writeFileSync(path.join(dir, f), crlf(raw(f)));

const marks = "checks/sizes.json";
fs.writeFileSync(path.join(dir, marks), JSON.stringify({ total: 1, read: {} }, null, 2) + "\n");
toCrlf(marks);
let p = project(dir);
ok(eolOf(p, marks) === "\r\n" && inEnds(p, marks, "a\nb\n") === "a\r\nb\r\n" && eolOf(p, "core-manifest.md") === "\n" && inEnds(p, "core-manifest.md", "a\n") === "a\n",
  "the helper reads a file's line ends from its raw text and writes in them");
marksWritten(p, { marks, json: JSON.parse(p.read(marks)) }, j => { j.total = 12345; }, new Set());
ok(allCrlf(raw(marks)) && raw(marks).includes("12345"), "marksWritten keeps the marks' Windows line ends", JSON.stringify(raw(marks).slice(0, 80)));

// (a file the rules' move rewrites: the old path in a manifest with Windows line ends)
const manifest = "core-manifest.md", old = "Paths: in the core's files, one into floor/, modules/, scripts/, setup/ or archive/ is under core/; any other is ours.";
fs.writeFileSync(path.join(dir, manifest), crlf(raw(manifest).replace(/^Paths: .*$/mu, old)));
p = project(dir);
writeMoved(p, new Set());
ok(!raw(manifest).includes(old) && allCrlf(raw(manifest)), "writeMoved keeps the manifest's Windows line ends", JSON.stringify(raw(manifest).slice(0, 80)));
done();
