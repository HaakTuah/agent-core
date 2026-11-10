// Checks the versions check (versions.mjs, beside this file), offline: an entry finds exactly one version in its file,
// one that finds none or reaches outside the project fails, and the release it would ask for is the newest stable one
// old enough (invented release times). Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/versions-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { current, newest, issue } from "./versions.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const root = fs.mkdtempSync(path.join(os.tmpdir(), "versions-test-"));
fs.writeFileSync(path.join(root, "pin.txt"), "loads mossgrip@1.5.4 here\n");
const throws = f => { try { f(); return false; } catch { return true; } };

const [e] = current([{ name: "mossgrip", file: "pin.txt", pattern: "mossgrip@(\\d+\\.\\d+\\.\\d+)" }], root);
ok(e.version === "1.5.4", "an entry finds the one version in its file");
ok(throws(() => current([{ name: "mossgrip", file: "pin.txt", pattern: "barkbite@(\\d+\\.\\d+\\.\\d+)" }], root)), "an entry whose pattern finds no version fails, so a moved version is never silently skipped");
ok(throws(() => current([{ name: "mossgrip", file: "../outside.txt", pattern: "(\\d+)" }], root)), "an entry's file outside the project fails");

const now = Date.parse("2026-11-02T00:00:00Z"), ago = d => new Date(now - d * 864e5).toISOString();
const times = { created: ago(900), modified: ago(1), "1.4.0": ago(400), "1.5.4": ago(300), "1.5.10": ago(30), "2.0.0": ago(20), "2.1.0": ago(10), "2.2.0-rc.1": ago(30) };
ok(newest(times, { days: 7, version: "1.5.4" }, now) === "2.1.0", "the newest stable release a week old, numbers compared as numbers");
ok(newest(times, { days: 14, version: "1.5.4" }, now) === "2.0.0", "a script waits two weeks: one out ten days is not yet asked for");
ok(newest(times, { days: 7, sameMajor: true, version: "1.5.4" }, now) === "1.5.10", "within the same major when asked: 1.5.10 above 1.5.4, not 2.x");
ok(newest({ "1.0.0": ago(2) }, { days: 7, version: "1.0.0" }, now) === null, "nothing old enough, nothing asked for");
const i = issue({ name: "mossgrip", file: "pin.txt", version: "1.5.4", days: 14, how: "Bump it." }, "2.0.0", "tools/versions.json");
ok(i.title.startsWith(i.key) && /\*\*Describe the solution you'd like\*\*\nBump it\./.test(i.body), "an issue's title starts with its key (so one already open is found) and its body has the template's headings");

fs.rmSync(root, { recursive: true, force: true });
if (failed) process.exit(1);
