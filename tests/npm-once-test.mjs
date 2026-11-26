// The stand-in for npm's install (npm-once.mjs; the tests of the checks from plain git, check-test.mjs, install the core's
// packages through it): what it may load and run, held here since the licence scan passes it over (.github/licences.json,
// "scan.skip") and so does not read it. A scratch folder only: no scratch core is made, nor a project. Git's address
// rewrite in the environment it is given, Node's own modules and a stand-in for npm that logs what it is run with.
//
//   node tests/npm-once-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, scratchDir, scratchEnv, tally } from "../scripts/scratch-core.mjs";
import { npmOnce } from "../scripts/npm-once.mjs";

const { ok, done } = tally();
const win = process.platform === "win32";
const tmp = scratchDir("npm-once-test-");
// (the licence scan passes npm-once.mjs over, so what it may run is held here: Node's own modules alone, loaded by
// name; one process started, the real npm's; and, run against a real npm that logs what it is given, every command
// passed on as it came, and npm ci's run with its files unchanged)
{
  const text = fs.readFileSync(path.join(root, "scripts", "npm-once.mjs"), "utf8");
  const loads = [...text.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s+["']([^"']+)["']|\b(?:require|import)\(\s*["'`]([^"'`$]+)["'`]\s*\)/gu)].map(m => (m[1] ?? m[2] ?? m[3]).replace(/^node:/u, ""));
  const calls = (text.match(/\b(?:require|import)\s*\(/gu) ?? []).length, froms = (text.match(/\bfrom\s+["']|\bimport\s+["']/gu) ?? []).length;
  ok(loads.length === calls + froms && loads.every(m => ["fs", "path", "child_process", "crypto"].includes(m)), "npm-once.mjs, which the licence scan passes over, loads Node's fs, path, child_process and crypto alone, each by its name", loads.join(", "));
  ok((text.match(/child_process/gu) ?? []).length === 1 && /const \{ spawnSync \} = require\("(?:node:)?child_process"\)/u.test(text) && (text.match(/\bspawnSync\s*\(/gu) ?? []).length === 1 && !/\bspawnSync\s*\([^\n]*\benv\b/u.test(text), "and it starts one process: child_process is reached only for spawnSync, called once, with the environment it was given");
  ok(!/\b(?:fetch\s*\(|WebSocket\b|EventSource\b)/u.test(text), "and it reaches the network by none of Node's own globals");
  const probe = path.join(tmp, "npm-once-probe"), fake = path.join(probe, "real"), log = path.join(probe, "log.jsonl");
  const [work, again, other] = ["work", "again", "other"].map(d => path.join(probe, d));
  fs.mkdirSync(fake, { recursive: true }); for (const d of [work, again, other]) fs.mkdirSync(d);
  const logger = path.join(fake, "log.cjs");
  fs.writeFileSync(logger, `const fs = require("fs"), path = require("path"), files = {};
for (const f of ["package.json", "package-lock.json", ".npmrc"]) if (fs.existsSync(f)) files[f] = fs.readFileSync(f, "utf8");
const npmEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^npm_config_|^NODE_OPTIONS$/iu.test(k)).sort());
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), files, npmEnv }) + "\\n");
if (process.argv[2] === "ci") fs.mkdirSync("node_modules", { recursive: true });
`);
  // (the fake is handed to npmOnce as the real one, so it needs no name of npm's, and this file stays one the licence
  // scan reads)
  const realFake = path.join(fake, win ? "logger.cmd" : "logger");
  if (win) fs.writeFileSync(realFake, `@"${process.execPath}" "${logger}" %*\r\n`);
  else fs.writeFileSync(realFake, `#!/bin/sh\nexec '${process.execPath}' '${logger}' "$@"\n`, { mode: 0o755 });
  // (from the scratch environment, which leaves the runner's npm settings and credentials out, so a failure prints none)
  const base = scratchEnv(tmp, tmp);
  const probed = npmOnce({ ...base, npm_config_probe: "as-set" }, probe, { real: realFake });
  const ownNpmEnv = JSON.stringify(Object.fromEntries(Object.entries(probed).filter(([k]) => /^npm_config_|^NODE_OPTIONS$/iu.test(k)).sort()));
  const shimDir = path.join(probe, "npm-once"), shim = path.join(shimDir, fs.readdirSync(shimDir).find(f => !f.endsWith(".cjs")));
  const files = { "package.json": '{"name":"p"}\n', "package-lock.json": '{"lockfileVersion":3}\n', ".npmrc": "ignore-scripts=true\n" };
  for (const [f, body] of Object.entries(files)) for (const d of [work, again, other]) fs.writeFileSync(path.join(d, f), f === "package-lock.json" && d === other ? body.replace("3", "4") : body);
  const asked = [["view", "left-pad", "version"], ["ci", "--ignore-scripts", "--no-audit"]];
  // (on Windows a .cmd runs through cmd.exe, so its path is quoted, as npm-once.mjs quotes the real npm's)
  const runShim = (args, cwd) => spawnSync(win ? `"${shim}"` : shim, args, { cwd, env: probed, stdio: "ignore", shell: win });
  for (const args of asked) runShim(args, work);
  runShim(asked[1], again); runShim(asked[1], other);
  const got = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map(l => JSON.parse(l)) : [];
  ok(got.length === 3 && got.slice(0, 2).every((g, i) => JSON.stringify(g.args) === JSON.stringify(asked[i])) && got.every(g => JSON.stringify(g.npmEnv) === ownNpmEnv), "and run with a command, it runs the real npm once with exactly the arguments and npm settings it was given, npm ci's too", JSON.stringify(got.map(g => [g.args, Object.keys(g.npmEnv)])));
  ok(got[1] && path.resolve(got[1].cwd) !== path.resolve(work) && JSON.stringify(got[1].files) === JSON.stringify(files) && fs.existsSync(path.join(work, "node_modules")), "and npm ci runs in a folder of its own with the package list, lock file and .npmrc unchanged, linked back as node_modules", JSON.stringify(got[1] ?? null));
  ok(got.length === 3 && fs.existsSync(path.join(again, "node_modules")) && path.resolve(got[2].cwd) !== path.resolve(got[1].cwd) && got[2].files["package-lock.json"] === files["package-lock.json"].replace("3", "4"), "and npm ci asked again with the same files runs no npm, the same install linked, and with a lock file changed runs it anew", String(got.length));
}
done("the npm stand-in");
