// Tests of the check that reads each package's licence and version back from the package itself
// (licence-installed.mjs): on a made-up lock file and the folders an install from it would fill. Run by the core's
// tests workflow (.github/workflows/tests.yml). Node's own modules only.
//
//   node scripts/licence-installed-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, lockForm } from "./licence-installed.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "licence-installed-test-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
let n = 0;
// A project: `locked` is the lock file's packages by path; `installed`, each package's own package.json by path (a
// path left out is a package no install brought; a string is written as it stands).
const project = (locked, installed, lockName = "package-lock.json") => {
  const dir = path.join(tmp, `p${++n}`);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, lockName), JSON.stringify({ name: "bark", lockfileVersion: 3, packages: { "": { name: "bark" }, ...locked } }));
  for (const [at, own] of Object.entries(installed)) { fs.mkdirSync(path.join(dir, at), { recursive: true }); fs.writeFileSync(path.join(dir, at, "package.json"), typeof own === "string" ? own : JSON.stringify(own)); }
  return dir;
};
const said = (dir) => { try { const r = check(dir); return [...r.failures, r.summary].join("\n"); } catch (e) { return `threw: ${e.message}`; } };
const A = "node_modules/mossgrip-lib", B = "node_modules/@moss/grip", C = "node_modules/bark-x/node_modules/mossgrip-lib";
const one = (lock, own) => said(project({ [A]: { version: "1.0.0", ...lock } }, own === undefined ? {} : { [A]: own }));

ok(lockForm("MIT") === "MIT" && lockForm({ type: "MIT", url: "x" }) === "MIT" && lockForm(undefined) === null && lockForm("") === null && lockForm({}) === null && lockForm([]) === null
  && JSON.stringify(lockForm(["MIT", "ISC"])) === '["MIT","ISC"]' && JSON.stringify(lockForm({ url: "x" })) === '{"url":"x"}', "a licence is read as npm writes one into a lock file: the type of one written as an object, nothing for an empty one, else as it stands");
const good = said(project(
  { [A]: { version: "1.0.0", license: "MIT" }, [B]: { version: "2.1.0", license: "Apache-2.0" }, [C]: { version: "0.9.0" }, "node_modules/bark-x": { version: "3.0.0", license: "ISC" },
    "packages/own": { name: "own", version: "0.0.1", license: "LicenseRef-Owner" }, "node_modules/own": { resolved: "packages/own", link: true },
    "node_modules/@moss/grip-win32": { version: "2.1.0", license: "Apache-2.0", optional: true, os: ["win32"] } },
  { [A]: { name: "mossgrip-lib", version: "1.0.0", license: "MIT" }, [B]: { version: "2.1.0", license: { type: "Apache-2.0", url: "x" } }, [C]: { version: "0.9.0" }, "node_modules/bark-x": { version: "3.0.0", license: "ISC" } }));
ok(/^4 packages of package-lock\.json read back from the packages themselves, their licence and their version; 1 of another system, not installed here, not read; 0 failing/.test(good),
  "a lock file whose every entry says what its package says passes: a scope, a package inside another's folder, one with no licence on either side, the old object form; the project's own packages and a link to one are not its to read, and an optional package of another system is counted as not read", good);
ok(/mossgrip-lib: package-lock\.json says its licence is "MIT", and its own package\.json says "GPL-3\.0-only"/.test(one({ license: "MIT" }, { version: "1.0.0", license: "GPL-3.0-only" })), "a licence written into the lock file that the package does not say fails, by name, with both");
ok(/says its licence is "MIT", and its own package\.json says none/.test(one({ license: "MIT" }, { version: "1.0.0" })) && /says its licence is none, and its own package\.json says "BUSL-1\.1"/.test(one({}, { version: "1.0.0", license: "BUSL-1.1" }))
  && /says its licence is "MIT", and its own package\.json says \{"type":"SSPL-1\.0"\}/.test(one({ license: "MIT" }, { version: "1.0.0", license: { type: "SSPL-1.0" } })), "so does one the lock file adds, one it leaves out, and one the package writes the old way");
ok(/says its version is "1\.0\.0", and its own package\.json says "2\.0\.0"/.test(one({ license: "MIT" }, { version: "2.0.0", license: "MIT" })), "a version the lock file claims and the package does not say fails");
ok(/mossgrip-lib: not installed, and no optional package of another system/.test(one({ license: "MIT" })) && /not installed, and no optional package of another system/.test(one({ license: "MIT", optional: true })) && /not installed/.test(one({ license: "MIT", os: ["win32"] }))
  && /1 of another system, not installed here, not read; 0 failing/.test(one({ license: "MIT", devOptional: true, cpu: ["arm64"] })), "a package that is not installed fails, unless it is an optional one that names the systems it is for: to be called optional, or to name a system, is not enough alone");
ok(/its package\.json cannot be read as JSON/.test(one({ license: "MIT" }, "{ not json")) && /its package\.json cannot be read as JSON/.test(one({ license: "MIT" }, "[]")), "a package whose own package.json cannot be read fails");
ok(/an entry at "node_modules\/\.\.\/\.\.\/elsewhere", which is no folder inside the project/.test(said(project({ "node_modules/../../elsewhere": { version: "1.0.0" } }, {}))) && /no folder inside the project/.test(said(project({ "/abs/node_modules/x": { version: "1.0.0" } }, {}))),
  "an entry that points out of the project is read nowhere, and fails");
const shrink = project({ [A]: { version: "1.0.0", license: "MIT" } }, { [A]: { version: "1.0.0", license: "ISC" } }, "npm-shrinkwrap.json");
fs.writeFileSync(path.join(shrink, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { [A]: { version: "1.0.0", license: "ISC" } } }));
ok(/npm-shrinkwrap\.json says its licence is "MIT"/.test(said(shrink)), "where both lock files stand, the one npm takes is the one read");
const none = path.join(tmp, "none"); fs.mkdirSync(none);
const old = project({}, {}); fs.writeFileSync(path.join(old, "package-lock.json"), JSON.stringify({ lockfileVersion: 1, dependencies: {} }));
const broken = project({}, {}); fs.writeFileSync(path.join(broken, "package-lock.json"), "{");
ok(/threw: no npm-shrinkwrap\.json or package-lock\.json/.test(said(none)) && /threw: package-lock\.json has no "packages"/.test(said(old)) && /threw: cannot read package-lock\.json as JSON/.test(said(broken)), "no lock file, one of the old form, or one that is no JSON stops the check");
const long = one({ license: "MIT" }, { version: "1.0.0", license: `MIT\n::error::${"x".repeat(500)}` });
ok(long.split("\n").length === 2 && long.split("\n")[0].length < 400, "what a package says of itself is shown on one line, and no longer than a line", long.slice(0, 300));

const script = fileURLToPath(new URL("./licence-installed.mjs", import.meta.url));
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: tmp });
const fine = project({ [A]: { version: "1.0.0", license: "MIT" } }, { [A]: { version: "1.0.0", license: "MIT" } }), forged = project({ [A]: { version: "1.0.0", license: "MIT" } }, { [A]: { version: "1.0.0", license: "GPL-3.0-only" } });
ok(run(fine).status === 0 && /^1 packages of package-lock\.json read back/.test(run(fine).stdout) && run(forged).status === 1 && /^FAIL: node_modules\/mossgrip-lib: /.test(run(forged).stderr) && run(none).status === 1 && run().status === 1,
  "as a program: it passes and says what it read, fails with each failure on a line, and fails where there is no lock file, the folder named or the current one");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the licences read back from the packages`);
process.exitCode = failed ? 1 : 0;
