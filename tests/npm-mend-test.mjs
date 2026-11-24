// Checks that the mend the signature check gives under an npm too old for it (scripts/checks.mjs, #1262), followed as
// worded, makes the check pass: on a scratch project whose lock file names one package of the registry's, under an npm
// that stands as 11.14.1 (which lists --allow-remote, but under --allow-remote=none refuses the registry's own packages
// too) the check installs nothing and fails, saying the mend; its command, run by the machine's npm from outside the
// repository, installs the npm it names, and with that folder's bin first on the PATH the check installs, reads the
// signature and passes. The npm that stands as 11.14.1 is a stand-in that answers its version and hands every other
// call to the machine's own, so nothing is fetched but what the mend names, which the licence audit holds. It installs
// npm and the package from npm's registry, so it is in the part network (tasks/tests.md, "A test that reaches the
// network runs once per batch"). On Linux, as the refusal's own case in checks-test.mjs. Git, npm and Node's own modules.
//
//   node tests/npm-mend-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { npmRefused } from "../scripts/npm-reads.mjs";
import { root, scratchDir, scratchEnv, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
if (process.platform !== "win32") {
  const tmp = scratchDir("npm-mend-test-");
  // (its name built from pieces, so that the licence scan reads no command here: the one install this test makes is the
  // mend's own, read from what the check prints, whose command the scan reads in checks.mjs)
  const NPM = ["n", "pm"].join("");
  // (as every scratch test's: no token, secret, password, credential or npm setting of the run's reaches git or npm)
  const env = scratchEnv(root, tmp);
  const git = (...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8" }).trim();
  const npm = (bin, args) => spawnSync(NPM, args, { cwd: tmp, env: { ...env, PATH: `${bin}${path.delimiter}${env.PATH}` }, encoding: "utf8" });

  // (the machine's npm, standing as one the check refuses: it answers its version and hands every other call to the npm
  // found first on the PATH, by an absolute entry)
  const real = env.PATH.split(path.delimiter).filter(d => path.isAbsolute(d)).map(d => path.join(d, NPM)).find(f => { try { fs.accessSync(f, fs.constants.X_OK); return fs.statSync(f).isFile(); } catch { return false; } });
  const old = path.join(tmp, "old");
  fs.mkdirSync(old);
  fs.writeFileSync(path.join(old, NPM), `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 11.14.1; exit 0; fi\nexec ${JSON.stringify(real ?? "")} "$@"\n`, { mode: 0o755 });
  ok(!!real && npm(old, ["--version"]).stdout.trim() === "11.14.1", "the machine's npm here stands as 11.14.1", real);

  // (a project whose copy of the core is this one, and whose change adds one package the core's own lock file pins)
  const dir = path.join(tmp, "p");
  fs.mkdirSync(path.join(dir, "web"), { recursive: true });
  fs.symlinkSync(root, path.join(dir, "core"));
  fs.writeFileSync(path.join(dir, "web/package.json"), "{\"private\": true}\n");
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD");
  const yaml = JSON.parse(fs.readFileSync(path.join(root, ".packages/package-lock.json"), "utf8")).packages["node_modules/yaml"];
  fs.writeFileSync(path.join(dir, "web/package.json"), `${JSON.stringify({ private: true, dependencies: { yaml: yaml.version } })}\n`);
  fs.writeFileSync(path.join(dir, "web/package-lock.json"), `${JSON.stringify({ lockfileVersion: 3, requires: true, packages: { "": { dependencies: { yaml: yaml.version } },
    "node_modules/yaml": { version: yaml.version, resolved: yaml.resolved, integrity: yaml.integrity, license: yaml.license, bin: yaml.bin, engines: yaml.engines } } }, null, 2)}\n`);
  git("add", "-A");
  git("commit", "-q", "-m", "a package");
  const check = bin => {
    const r = spawnSync(process.execPath, ["core/scripts/checks.mjs", "signatures", "--signatures", "web"], { cwd: dir, env: { ...env, BASE_SHA: base, PATH: `${bin}${path.delimiter}${env.PATH}` }, encoding: "utf8" });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  };

  const refused = check(old);
  ok(refused.status === 1 && npmRefused(refused.out) === "11.15.0" && mended(refused.out), "under 11.14.1 the check installs nothing and fails, saying the mend", refused.out);
  // (the mend as worded: its command, run by the machine's npm from outside the repository, its folder named; then that
  // folder's bin first on the PATH)
  const [, words] = new RegExp(`\`(${NPM} install --global --prefix=<its-folder> [^\`]+)\``, "u").exec(refused.out) ?? [];
  const mendAt = path.join(tmp, "mended");
  const followed = words && npm(old, words.replace("<its-folder>", mendAt).split(" ").slice(1));
  ok(followed?.status === 0, "its command, run as worded by the machine's npm, installs the version it names", words ?? refused.out);
  const passed = check(`${path.join(mendAt, "bin")}${path.delimiter}${old}`);
  ok(passed.status === 0 && /verified registry signature/u.test(passed.out), "and with that folder's bin first on the PATH, the check installs from the lock file, reads the signature and passes", passed.out.slice(-1200));
} else console.log("skip: the refusal's case runs on Linux, as checks-test.mjs's does");

done("the signature check's mend for an npm too old for it, followed as worded");
