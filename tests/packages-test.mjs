// Checks how the core takes the packages of other publishers its scripts run (#654): from its lock file, installed by
// scripts/install.mjs into node_modules/, which git does not track, and loaded by scripts/packages.mjs from there alone.
// The lock file is in npm's own form, each package at one exact version from npm's registry with a sha512, and each it
// brings or updates a week old by the registry's date (floor rule 7), which npm ci never asks; nothing of
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

// ---- the week's wait on each package the change brings or updates (floor rule 7) ----
// npm ci installs a lock file as it is written, the tarball its entry's address names, so the .npmrc's wait holds only
// what npm resolves itself. Each entry new, or other in its version, address or integrity than at the base (the merge's
// first parent, or PACKAGES_BASE), is asked of npm's registry for the date of the version its address names, which must
// be its version field too.
{
  const WEEK = 7 * 86400000;
  const { registryName, registryVersion } = await import(pathToFileURL(path.join(root, "scripts/licences.mjs")).href);
  const { fetched } = await import(pathToFileURL(path.join(root, "scripts/lookup.mjs")).href);
  // (an entry as a whole, its keys in order, so that a change of any field is seen; and the fields an entry fetched from
  // the registry carries: one that links a folder, or is bundled in another, or carries any other field, is refused)
  const whole = e => JSON.stringify(Object.keys(e ?? {}).sort().map(k => [k, e[k]]));
  const same = (a, b) => Boolean(a) && whole(a) === whole(b);
  const FIELDS = new Set(["version", "resolved", "integrity", "license", "dev", "optional", "devOptional", "peer", "engines", "bin", "funding",
    "dependencies", "optionalDependencies", "peerDependencies", "peerDependenciesMeta", "os", "cpu", "libc", "deprecated", "hasInstallScript"]);
  // (each entry that fails, with what is wrong; `ask(name)` gives the registry's document of a package, as fetched does)
  const tooYoung = async (packages, base, ask, now = Date.now()) => {
    const out = [];
    for (const [k, e] of Object.entries(packages ?? {})) {
      if (!k || same(base[k], e)) continue;
      const odd = Object.keys(e).filter(f => !FIELDS.has(f));
      if (!/^(?:node_modules\/(?:@[^/]+\/)?[^/@]+\/)*node_modules\/(?:@[^/]+\/)?[^/@]+$/u.test(k) || odd.length) { out.push(`${k}: ${odd.length ? `its field${odd.length === 1 ? "" : "s"} ${odd.join(", ")}, which no package fetched from the registry carries` : "a key that names no installed package's folder"}`); continue; }
      const name = registryName(e.resolved), version = registryVersion(e.resolved);
      // (an address in its one plain form alone, a name as npm spells one: never one a URL parser reads otherwise)
      const plainAddress = (() => { try { return new URL(e.resolved).href === e.resolved; } catch { return false; } })();
      if (!name || !version || version !== e.version || !plainAddress || !/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u.test(name)) {
        out.push(`${k}: its address names ${name ?? "no package of npm's registry"} at ${version ?? "no version"}${plainAddress ? "" : " in no plain form"}, and its version field ${e.version ?? "none"}`); continue;
      }
      // (the date read is the one of the very tarball npm ci installs: the registry's own document gives that address and
      // that integrity for that version)
      const doc = await ask(name).catch(err => ({ status: err.message }));
      const dist = doc.json?.name === name ? doc.json?.versions?.[version]?.dist : undefined;
      if (doc.status === 200 && (dist?.tarball !== e.resolved || dist?.integrity !== e.integrity)) { out.push(`${name}@${version}: the registry gives another address or integrity for it than the lock file`); continue; }
      const at = Date.parse(doc.json?.time?.[version] ?? "");
      if (!(now - at >= WEEK)) out.push(`${name}@${version}: ${doc.status === 200 ? (Number.isNaN(at) ? "the registry gives no date" : `published ${new Date(at).toISOString()}`) : `the registry answered ${doc.status}`}`);
    }
    return out;
  };
  let base = {};
  try { base = JSON.parse(execFileSync("git", ["show", `${process.env.PACKAGES_BASE || "HEAD^1"}:package-lock.json`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })).packages ?? {}; } catch { /* (no lock file at the base: every entry is new) */ }
  const young = await tooYoung(json("package-lock.json").packages, base, name => fetched(`https://registry.npmjs.org/${name.replace("/", "%2f")}`));
  ok(young.length === 0, "each package the change brings or updates in the lock file is a week old or more by the registry's date (floor rule 7)",
    `${young.join("; ")}\nMend: wait until the version is a week old and run the job again, or take the version before it, its lock entry written by npm's own install`);
  // (held on a lock written by hand: a version field kept while the address names another tarball, an entry with no
  // version, an address off the registry, and a young version, against answers made here)
  const day = 86400000, now = Date.parse("2026-11-18T00:00:00Z");
  const tgz = v => `https://registry.npmjs.org/yaml/-/yaml-${v}.tgz`;
  const docs = { yaml: { time: { "2.9.1": "2026-09-01T00:00:00Z", "2.9.2": "2026-11-17T00:00:00Z" },
    versions: { "2.9.1": { dist: { tarball: tgz("2.9.1"), integrity: "sha512-a" } }, "2.9.2": { dist: { tarball: tgz("2.9.2"), integrity: "sha512-e" } } } } };
  const ask = async name => ({ status: 200, json: { name, ...(docs[name] ?? {}) } });
  const held = { "node_modules/yaml": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a" } };
  const cases = [
    [{ "node_modules/yaml": { version: "2.9.1", resolved: tgz("2.9.2"), integrity: "sha512-b" } }, /names yaml at 2\.9\.2, and its version field 2\.9\.1/u],
    [{ ...held, "node_modules/yaml/node_modules/yaml": { resolved: tgz("2.9.2"), integrity: "sha512-c" } }, /version field none/u],
    [{ "node_modules/yaml": { version: "2.9.1", resolved: "https://example.invalid/yaml-2.9.1.tgz", integrity: "sha512-d" } }, /no package of npm's registry/u],
    [{ "node_modules/yaml": { version: "2.9.2", resolved: tgz("2.9.2"), integrity: "sha512-e" } }, /yaml@2\.9\.2: published 2026-11-17/u],
    [{ "node_modules/yaml": { version: "2.9.1", resolved: "https://registry.npmjs.org/@s\\../z\\..\\yaml/-/z\\..\\yaml-2.9.1.tgz", integrity: "sha512-a" } }, /in no plain form/u],
    [{ "node_modules/yaml": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-z" } }, /another address or integrity/u],
    [{ "node_modules/yaml": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a", link: true } }, /its field link/u],
    [{ ...held, "https:/registry.npmjs.org/yaml/-/yaml-2.9.1.tgz": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a" } }, /names no installed package's folder/u],
  ];
  const results = await Promise.all(cases.map(([lock]) => tooYoung(lock, held, ask, now)));
  ok(cases.every(([, said], i) => results[i].length === 1 && said.test(results[i][0])) && (await tooYoung(held, held, ask, now)).length === 0
    && (await tooYoung({ "node_modules/yaml": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a" } }, {}, ask, now + day)).length === 0,
    "and the week's wait reads the tarball the address names, never the version field alone, and fails an entry whose address names no version of npm's registry", results.map(r => r.join(" | ")).join(" || "));
}

// ---- nothing of another publisher's tracked: no node_modules/, no carried folder ----
{
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  const theirs = f => /(?:^|\/)node_modules(?:\/|$)/u.test(f) || f.startsWith("third-party/");
  ok(!tracked.some(theirs), "no file of another publisher's is tracked in the core, nor a link in its install's place: its packages are installed, never carried", tracked.filter(theirs).slice(0, 5).join(", "));
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  ok(/^\/node_modules$/mu.test(ignore) && ["/.npmrc", "/package.json", "/package-lock.json"].every(f => ignore.split("\n").includes(`!${f}`)), "the core's .gitignore, which travels to the copy's root, keeps the install out of git, a link in its place too, and the copy's package list, lock file and .npmrc in it");
  // (the .npmrc the copy carries holds the core's own two settings alone, which install.mjs holds it to too)
  const { npmrcOthers } = await import(pathToFileURL(path.join(root, "scripts/packages.mjs")).href), npmrc = fs.readFileSync(path.join(root, ".npmrc"), "utf8");
  ok(npmrcOthers(npmrc).length === 0, "the core's .npmrc holds nothing but its own two settings, so the install and the signatures' check ask npm's own registry, with no token, proxy or certificate of another's", npmrcOthers(npmrc).join(" | "));
  // (each form built from pieces when the test runs, so that no file here points npm at another registry)
  const r = ["regi", "stry"].join("");
  ok([`"${r}" = http://127.0.0.1/`, `'${r}'=x`, `${r}[]=x`, "//h/:_authToken=${T}", "https-proxy=http://p/", "strict-ssl=false", "cafile=/x", `@a:${r}=x`, "min-release-age=\r7", "ignore-scripts=true\u2028", "min-release-age=7\u2029"].every(l => npmrcOthers(`ignore-scripts=true\n${l}\n`).length >= 1) && npmrcOthers("\uFEFF# c\n; c\n\nignore-scripts = true\nmin-release-age=7\n").length === 0, "and any other line, in whatever form npm reads it, is one install.mjs refuses");
}

// ---- with nothing installed, a script that loads a package says it did not run, and how to install ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "packages-test-"));
try {
  // (a project whose own node_modules holds a package of the name, at another version, beside a copy with none)
  const project = path.join(tmp, "project"), copy = path.join(project, "core");
  fs.mkdirSync(path.join(project, "node_modules/yaml"), { recursive: true });
  fs.writeFileSync(path.join(project, "node_modules/yaml/package.json"), JSON.stringify({ name: "yaml", version: "0.0.1", main: "index.js" }));
  fs.writeFileSync(path.join(project, "node_modules/yaml/index.js"), "module.exports = { Lexer: class {}, project: true };\n");
  // (and whose own package.json takes the copy's folder in as a workspace: the copy installs on its own all the same)
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "project", private: true, workspaces: ["core"] }));
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
  ok(r.status === 0 && installed, "install.mjs installs each package of the lock file a script loads into the copy's node_modules, in a project whose workspaces name the copy's folder too", `${r.stdout}${r.stderr}`);
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
  // (where the job's install could not reach the registry, a script is told so, and loading the package still fails)
  const unreached = spawnSync(process.execPath, ["--input-type=module", "-e", `const p = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts/packages.mjs")).href)}); console.log(p.unreached("yaml")); p.loadSync("yaml");`], { cwd: project, encoding: "utf8", env: { ...env, CORE_PACKAGES_UNREACHED: "1" } });
  ok(unreached.status === 1 && /^true$/mu.test(unreached.stdout) && mended(unreached.stderr), "where the job's install could not reach the registry, a script is told so, and a package it loads all the same fails, never passing (#654, points 3 and 4)", `${unreached.stdout}${unreached.stderr}`);
  fs.writeFileSync(record, kept);
  // (a lock file whose integrity the registry's tarball does not match: twice refused, then a failure that says the mend)
  const wrong = JSON.parse(fs.readFileSync(path.join(copy, "package-lock.json"), "utf8"));
  const first = Object.keys(wrong.packages).find(k => k && !wrong.packages[k].dev);
  wrong.packages[first].integrity = `sha512-${Buffer.alloc(64, 7).toString("base64")}`;
  fs.writeFileSync(path.join(copy, "package-lock.json"), JSON.stringify(wrong, null, 2));
  fs.rmSync(path.join(copy, "node_modules"), { recursive: true, force: true });
  const refused = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env });
  ok(refused.status === 1 && /runs again/u.test(refused.stderr) && /could not be installed .*twice/u.test(refused.stderr) && mended(refused.stderr), "an install that fails is run once more, and a second failure fails, saying the mend", refused.stderr);
  // (in a project's pull request the same failure fails all the same: a lock file the registry's tarball does not match
  // is no registry that did not answer, and a pull request can bring it about)
  const jobEnv = path.join(tmp, "github-env");
  fs.writeFileSync(jobEnv, "");
  const inPr = { ...env, GITHUB_EVENT_NAME: "pull_request", GITHUB_ENV: jobEnv };
  const mismatched = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env: inPr });
  ok(mismatched.status === 1 && !fs.readFileSync(jobEnv, "utf8"), "in a project's pull request an install that fails for anything but the registry not answering fails, and tells the job nothing", `${mismatched.status} ${mismatched.stdout}${mismatched.stderr}`);
  // (a registry that does not answer, in a project's pull request, fails nothing: the job is told, and each check after it says it did not run)
  fs.copyFileSync(path.join(root, "package-lock.json"), path.join(copy, "package-lock.json"));
  const warned = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env: { ...inPr, [["npm_config_regi", "stry"].join("")]: "http://127.0.0.1:9/", npm_config_fetch_retries: "0", npm_config_cache: path.join(tmp, "empty-cache") } });
  ok(warned.status === 0 && /^::warning::The core's packages could not be installed .*twice/mu.test(warned.stdout) && /Mend: run this job again/u.test(warned.stdout) && /^CORE_PACKAGES_UNREACHED=1$/mu.test(fs.readFileSync(jobEnv, "utf8")), "in a project's pull request a registry that does not answer twice is a warning, and tells the job's later checks", `${warned.status} ${warned.stdout}${warned.stderr}`);
  // (what would reach past the core's own files: a shrinkwrap npm reads first, another registry, a link in the install's place)
  const refuses = (what, plant, unplant, said) => {
    plant();
    const r = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env });
    unplant();
    ok(r.status === 1 && said.test(r.stderr) && mended(r.stderr), `install.mjs installs nothing where ${what}, saying the mend`, `${r.status} ${r.stdout}${r.stderr}`);
  };
  fs.rmSync(path.join(copy, "node_modules"), { recursive: true, force: true });
  refuses("a shrinkwrap stands beside the lock file", () => fs.copyFileSync(path.join(copy, "package-lock.json"), path.join(copy, "npm-shrinkwrap.json")), () => fs.rmSync(path.join(copy, "npm-shrinkwrap.json")), /npm-shrinkwrap\.json stands beside the lock file/u);
  const copyNpmrc = fs.readFileSync(path.join(copy, ".npmrc"), "utf8");
  refuses("the .npmrc holds a line beside the core's own two settings", () => fs.appendFileSync(path.join(copy, ".npmrc"), `"${["regi", "stry"].join("")}" = https://example.invalid/\n`), () => fs.writeFileSync(path.join(copy, ".npmrc"), copyNpmrc), /holds a line beside the core's own two settings/u);
  const elsewhere = path.join(tmp, "elsewhere");
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(elsewhere, "kept.txt"), "kept\n");
  refuses("node_modules is a link", () => fs.symlinkSync(elsewhere, path.join(copy, "node_modules"), "junction"), () => fs.unlinkSync(path.join(copy, "node_modules")), /node_modules is a link/u);
  ok(fs.existsSync(path.join(elsewhere, "kept.txt")), "and what the link pointed at is kept");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

process.exit(failed ? 1 : 0);
