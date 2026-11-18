// Checks how the core takes the packages of other publishers its scripts run (#654): from its lock file, installed by
// scripts/install.mjs into node_modules/, which git does not track, and loaded by scripts/packages.mjs from there alone.
// The lock file is in npm's own form, each package at one exact version from npm's registry with a sha512; nothing of
// another publisher's is tracked in the core, or so in any copy, which core.yml holds to the core; and each script that
// loads a package, with none installed, says it did not run and how to install, never passing, nor reading a project's
// own install of the same name.
//
//   node tests/packages-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mended } from "../scripts/mend.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}${cond || !detail ? "" : `\n${String(detail).slice(0, 1500)}`}`); if (!cond) failed++; };
const json = f => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
// (run as outside a workflow, whatever runs this: a workflow's variables change what a failure says and where it goes)
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GITHUB_|CORE_PACKAGES_)/u.test(k)));

// ---- the lock file: npm's own form, one exact version each, from the registry, with its sha512 ----
{
  const list = json("package.json"), lock = json("package-lock.json");
  const wanted = Object.entries({ ...list.dependencies, ...list.devDependencies });
  ok(list.private === true && wanted.length > 0 && wanted.every(([, v]) => /^\d+\.\d+\.\d+$/u.test(v)), "package.json names each package at one exact version, and the core publishes nothing", JSON.stringify(list));
  const entries = Object.entries(lock.packages ?? {}).filter(([k]) => k);
  ok(lock.lockfileVersion === 3 && wanted.every(([n, v]) => lock.packages?.[`node_modules/${n}`]?.version === v), "package-lock.json is npm's own, and holds each package at the version package.json names", JSON.stringify(Object.keys(lock.packages ?? {})));
  ok(entries.every(([, e]) => /^https:\/\/registry\.npmjs\.org\//u.test(e.resolved ?? "") && /^sha512-/u.test(e.integrity ?? "")), "each entry comes from npm's registry, held to its sha512", entries.filter(([, e]) => !/^sha512-/u.test(e.integrity ?? "")).map(([k]) => k).join(", "));
  const config = json(".github/licences.json");
  ok((config.lockfiles ?? []).includes("package-lock.json"), "the core's licence check reads the lock file, so the licence check and the lookup hold each package (floor rules 10 and 15)");
  // (an install script never runs, whatever npm command is run at the core's root or a copy's: the mechanism holds it)
  const npmrc = fs.readFileSync(path.join(root, ".npmrc"), "utf8");
  ok(/^ignore-scripts\s*=\s*true$/mu.test(npmrc) && /^min-release-age\s*=\s*7$/mu.test(npmrc) && (config.ignoreScriptsIn ?? []).includes(".npmrc"), "the core's .npmrc, which the copy carries, keeps every package's install script off and waits a week, and the licence check holds it there (floor rules 7 and 15)", npmrc);
}

// ---- nothing of another publisher's tracked: no node_modules/, no carried folder ----
{
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  ok(!tracked.some(f => /(?:^|\/)node_modules\//u.test(f) || f.startsWith("third-party/")), "no file of another publisher's is tracked in the core: its packages are installed, never carried", tracked.filter(f => /node_modules\/|^third-party\//u.test(f)).slice(0, 5).join(", "));
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  ok(/^\/node_modules\/$/mu.test(ignore) && ["/.npmrc", "/package.json", "/package-lock.json"].every(f => ignore.split("\n").includes(`!${f}`)), "the core's .gitignore, which travels to the copy's root, keeps the install out of git, and the copy's package list, lock file and .npmrc in it");
}

// ---- with nothing installed, a script that loads a package says it did not run, and how to install ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "packages-test-"));
try {
  // (a project whose own node_modules holds a package of the name, at another version, beside a copy with none)
  const project = path.join(tmp, "project"), copy = path.join(project, "core");
  fs.mkdirSync(path.join(project, "node_modules/yaml"), { recursive: true });
  fs.writeFileSync(path.join(project, "node_modules/yaml/package.json"), JSON.stringify({ name: "yaml", version: "0.0.1", main: "index.js" }));
  fs.writeFileSync(path.join(project, "node_modules/yaml/index.js"), "module.exports = { Lexer: class {}, project: true };\n");
  fs.cpSync(path.join(root, "scripts"), path.join(copy, "scripts"), { recursive: true });
  for (const f of ["package.json", "package-lock.json", ".gitignore", ".npmrc"]) fs.copyFileSync(path.join(root, f), path.join(copy, f));
  // (each script that loads a package, by the call that loads it; a script that loads one and has no case here fails)
  const CALLS = { "yaml-keys.mjs": `twice("a: 1\\n")`, "comment-only.mjs": `readYaml("a: 1\\n")` };
  const loads = fs.readdirSync(path.join(root, "scripts")).filter(f => f.endsWith(".mjs") && f !== "packages.mjs" && /\bload(?:Sync)?\("/u.test(fs.readFileSync(path.join(root, "scripts", f), "utf8")));
  ok(loads.length > 0 && loads.every(f => CALLS[f]), "each script that loads a package has its call here", loads.filter(f => !CALLS[f]).join(", "));
  const call = (f, expr) => spawnSync(process.execPath, ["--input-type=module", "-e", `const m = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts", f)).href)}); console.log(JSON.stringify(m.${expr}));`], { cwd: project, encoding: "utf8", timeout: 60000, env });
  for (const f of loads) {
    const r = call(f, CALLS[f]), out = `${r.stdout}${r.stderr}`;
    ok(r.status === 1 && /did not run: the package \S+ is not installed/u.test(out) && /install\.mjs/u.test(out) && mended(out), `${f}, with nothing installed beside the copy, says it did not run and how to install, and does not take the project's own package of the name`, out);
  }
  // (a script that imports one of them for what needs no package runs with nothing installed: the copies check)
  const plain = call("yaml-keys.mjs", `uncommented("a: 1 # b")`);
  ok(plain.status === 0 && plain.stdout.trim() === JSON.stringify("a: 1"), "what needs no package runs with nothing installed, so a project's own workflow that runs the copies check is not stopped", `${plain.stdout}${plain.stderr}`);
  // (and the install puts each package where the scripts load it from, untracked)
  // (a project whose own .gitignore leaves out an .npmrc and a lock file still tracks the copy's)
  fs.writeFileSync(path.join(project, ".gitignore"), ".npmrc\npackage-lock.json\npackage.json\n");
  execFileSync("git", ["init", "-q"], { cwd: project });
  execFileSync("git", ["add", "-A"], { cwd: project });
  const staged = execFileSync("git", ["ls-files"], { cwd: project, encoding: "utf8" }).split("\n");
  ok(["core/.npmrc", "core/package.json", "core/package-lock.json"].every(f => staged.includes(f)) && !staged.some(f => f.startsWith("core/node_modules/")), "a project whose .gitignore leaves out .npmrc and lock files tracks the copy's all the same", staged.filter(f => f.startsWith("core/") && !f.startsWith("core/scripts/")).join(", "));
  fs.rmSync(path.join(project, ".git"), { recursive: true, force: true });
  const r = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env });
  const lock = JSON.parse(fs.readFileSync(path.join(copy, "package-lock.json"), "utf8"));
  const installed = Object.entries(lock.packages).filter(([k, e]) => k && !e.dev).every(([k]) => fs.existsSync(path.join(copy, k, "package.json")));
  const tests = Object.entries(lock.packages).filter(([k, e]) => k && e.dev);
  ok(r.status === 0 && installed, "install.mjs installs each package of the lock file a script loads into the copy's node_modules", `${r.stdout}${r.stderr}`);
  ok(tests.length > 0 && !tests.some(([k]) => fs.existsSync(path.join(copy, k))), "and none that only the core's own tests run: a copy holds no tests", tests.map(([k]) => k).join(", "));
  const loaded = spawnSync(process.execPath, ["--input-type=module", "-e", `const { load } = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts/packages.mjs")).href)}); const m = await load("yaml"); console.log(m.project ? "project" : typeof m.Lexer);`], { cwd: project, encoding: "utf8", env });
  ok(loaded.status === 0 && loaded.stdout.trim() === "function", "and load() takes the copy's own, never the project's", `${loaded.stdout}${loaded.stderr}`);
  // (an install npm recorded for another lock file is no install of this one: the package did not run)
  const record = path.join(copy, "node_modules/.package-lock.json"), kept = fs.readFileSync(record, "utf8");
  const other = JSON.parse(kept);
  other.packages["node_modules/yaml"].resolved = "https://example.invalid/yaml.tgz";
  fs.writeFileSync(record, JSON.stringify(other));
  const stale = call("yaml-keys.mjs", CALLS["yaml-keys.mjs"]);
  ok(stale.status === 1 && /did not run: the package yaml is not installed .* as package-lock\.json names it/u.test(stale.stderr) && mended(stale.stderr), "a package installed from another lock file than the copy's is never loaded: the check did not run, with its mend", `${stale.stdout}${stale.stderr}`);
  // (in a project's pull request whose install could not reach the registry, the check says it did not run, and fails nothing)
  const unreached = spawnSync(process.execPath, ["--input-type=module", "-e", `const m = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts/yaml-keys.mjs")).href)}); m.${CALLS["yaml-keys.mjs"]};`], { cwd: project, encoding: "utf8", env: { ...env, CORE_PACKAGES_UNREACHED: "1" } });
  ok(unreached.status === 0 && /^::warning::The check did not run: the package yaml could not be installed/mu.test(unreached.stdout) && /Mend: run this job again/u.test(unreached.stdout), "where the job's install could not reach the registry, a check that needs a package says as a warning that it did not run, and fails nothing (#654, point 4)", `${unreached.stdout}${unreached.stderr}`);
  fs.writeFileSync(record, kept);
  // (a lock file whose integrity the registry's tarball does not match: twice refused, then a failure that says the mend)
  const wrong = JSON.parse(fs.readFileSync(path.join(copy, "package-lock.json"), "utf8"));
  const first = Object.keys(wrong.packages).find(k => k && !wrong.packages[k].dev);
  wrong.packages[first].integrity = `sha512-${Buffer.alloc(64, 7).toString("base64")}`;
  fs.writeFileSync(path.join(copy, "package-lock.json"), JSON.stringify(wrong, null, 2));
  fs.rmSync(path.join(copy, "node_modules"), { recursive: true, force: true });
  const refused = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env });
  ok(refused.status === 1 && /runs again/u.test(refused.stderr) && /could not be installed .*twice/u.test(refused.stderr) && mended(refused.stderr), "an install that fails is run once more, and a second failure fails, saying the mend", refused.stderr);
  // (in a project's pull request, the same failure fails nothing: the job is told, and each check after it says it did not run)
  const jobEnv = path.join(tmp, "github-env");
  fs.writeFileSync(jobEnv, "");
  const warned = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env: { ...env, GITHUB_EVENT_NAME: "pull_request", GITHUB_ENV: jobEnv } });
  ok(warned.status === 0 && /^::warning::The core's packages could not be installed .*twice/mu.test(warned.stdout) && /Mend: run this job again/u.test(warned.stdout) && /^CORE_PACKAGES_UNREACHED=1$/mu.test(fs.readFileSync(jobEnv, "utf8")), "in a project's pull request a second failed install is a warning, and tells the job's later checks", `${warned.status} ${warned.stdout}${warned.stderr}`);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

process.exit(failed ? 1 : 0);
