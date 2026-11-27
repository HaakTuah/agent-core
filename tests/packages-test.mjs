// Checks how the core takes the packages of other publishers its scripts run (#654): from its lock file in .packages/,
// installed by scripts/install.mjs into .packages/node_modules/, which git does not track, and loaded by scripts/packages.mjs from there alone.
// The lock file is in npm's own form, each package at one exact version from npm's registry with a sha512, and each it
// brings or updates a week old by the registry's date (floor rule 7), which npm ci never asks, held by
// scripts/week-wait.mjs, whose reading and failure this test holds on answers made here; nothing of
// another publisher's is tracked in the core, or so in any copy, which core.yml holds to the core; and each script that
// loads a package, with none installed, in a copy first runs the copy's installer, once, and where that installs
// nothing says it did not run and why, failing nothing (#1093, point 1); in the core it fails, never passing; and it
// never reads a project's own install of the same name.
//
//   node tests/packages-test.mjs
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { failures, mended } from "../scripts/mend.mjs";

// (what a run says where it failed nothing: a warning that says its mend, as a failure would; where it failed, told())
const told = out => (failures(out).length ? mended(out, { from: projectOf() }) : /^::warning::[^\n]*Mend: \S+\s+\S/mu.test(out));
import { npmWithCache, scratchDir, projectOf } from "../scripts/scratch-core.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}${cond || !detail ? "" : `\n${String(detail).slice(0, 1500)}`}`); if (!cond) failed++; };
const json = f => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
// (run as outside a workflow, whatever runs this: a workflow's variables change what a failure says and where it goes)
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GITHUB_|CORE_PACKAGES_)/u.test(k)));
const plainEnv = { ...env };

// ---- the lock file: npm's own form, one exact version each, from the registry, with its sha512 ----
{
  const list = json(".packages/package.json"), lock = json(".packages/package-lock.json");
  const wanted = Object.entries({ ...list.dependencies, ...list.devDependencies });
  ok(list.private === true && wanted.length > 0 && wanted.every(([, v]) => /^\d+\.\d+\.\d+$/u.test(v)), "package.json names each package at one exact version, and the core publishes nothing", JSON.stringify(list));
  const entries = Object.entries(lock.packages ?? {}).filter(([k]) => k);
  ok(lock.lockfileVersion === 3 && wanted.every(([n, v]) => lock.packages?.[`node_modules/${n}`]?.version === v), "package-lock.json is npm's own, and holds each package at the version package.json names", JSON.stringify(Object.keys(lock.packages ?? {})));
  ok(entries.every(([, e]) => /^https:\/\/registry\.npmjs\.org\//u.test(e.resolved ?? "") && /^sha512-/u.test(e.integrity ?? "")), "each entry comes from npm's registry, held to its sha512", entries.filter(([, e]) => !/^sha512-/u.test(e.integrity ?? "")).map(([k]) => k).join(", "));
  // (PyPI's lock form, the code scan's engine alone, installed only where its step names it: #546)
  const reqs = fs.readFileSync(path.join(root, ".packages/requirements.txt"), "utf8").replace(/\\\r?\n/gu, " ").split(/\r?\n/u).filter(l => l.trim() && !l.startsWith("#"));
  ok(reqs.length > 0 && reqs.every(l => /^[A-Za-z0-9][\w.-]*==\d+(?:\.\d+)+\s/u.test(l) && /--hash=sha256:[0-9a-f]{64}/u.test(l)), ".packages/requirements.txt names each PyPI package at one exact version, each with the SHA-256 of its wheels, so that what is installed is held to those hashes", reqs.join("\n"));
  // (what the package list and lock file hold, as install.mjs reads them before npm runs: their own fields, registry
  // entries alone, and every spec a version, range or tag of npm's registry)
  const { lockFaults, ENTRY_FIELDS } = await import(pathToFileURL(path.join(root, "scripts/packages.mjs")).href);
  const faults = [...lockFaults(list, lock), ...lockFaults(json(".packages/parser/package.json"), json(".packages/parser/package-lock.json")).map(f => `parser's ${f}`)];
  ok(faults.length === 0, "the package list and the lock file hold what install.mjs takes: their own fields, registry entries alone, and every spec a version, range or tag of npm's registry", faults.slice(0, 5).join("; "));
  const bad = [{ ...list, overrides: {} }, { ...list, devDependencies: { x: "git+https://example.invalid/x.git" } }, { ...list, devDependencies: { x: "ids.tgz" } }, { ...list, devDependencies: { x: "1.0.0 || a.tar.gz" } }, { ...list, devDependencies: { x: "file:x" } }, { ...list, devDependencies: { x: "x.tar_gz" } }, { ...list, devDependencies: { x: "^1.0.0" } }];
  const badLocks = [{ ...lock, packages: { ...lock.packages, "node_modules/yaml": { ...lock.packages["node_modules/yaml"], dependencies: { b: "git+https://example.invalid/b.git" } } } },
    { ...lock, packages: { ...lock.packages, "node_modules/yaml": { ...lock.packages["node_modules/yaml"], link: true } } },
    { ...lock, packages: { ...lock.packages, "node_modules/yaml": { ...lock.packages["node_modules/yaml"], resolved: "https://example.invalid/yaml.tgz" } } },
    { lockfileVersion: 3, requires: true, dependencies: { yaml: { version: "git+https://example.invalid/yaml.git" } } }, { ...lock, packages: null }, { ...lock, dependencies: {} },
    { ...lock, packages: { ...lock.packages, "node_modules/a.tgz": lock.packages["node_modules/yaml"] } },
    { ...lock, packages: { ...lock.packages, "node_modules/yaml": { ...lock.packages["node_modules/yaml"], resolved: `${lock.packages["node_modules/yaml"].resolved}?d` } } },
    { ...lock, packages: { ...lock.packages, "": { ...lock.packages[""], scripts: {} } } }, [],
    { ...lock, packages: Object.fromEntries(Object.entries(lock.packages).filter(([k]) => k)) }, { ...lock, packages: {} }];
  ok([...bad, null, []].every(l => lockFaults(l, lock).length > 0) && badLocks.every(l => lockFaults(list, l).length > 0) && lockFaults(list, { ...lock, packages: { ...lock.packages, "node_modules/yaml": { ...lock.packages["node_modules/yaml"], dependencies: { z: "^1.2.3 || ~2", y: "latest" } } } }).length === 0,
    "and a field of its own, a spec naming git, a file or a tarball, a linked entry or one from another address, each is one it refuses; a range or a tag is none");
  const acted = { ...lock, packages: { ...lock.packages, "node_modules/yaml": { ...lock.packages["node_modules/yaml"], optional: true, integrity: "sha512-AAAA" } } };
  ok(lockFaults(list, acted).some(f => /field optional, which npm would act on and the core's lock never writes/u.test(f)), "an entry that holds a field npm would act on that the core's lock never writes is refused before npm runs, whatever else it holds", JSON.stringify(lockFaults(list, acted)));
  // (a spec that names an address with a sign-in in it, in the package list and in a lock entry: the fault names the
  // field and the package and says the spec is not of npm's registry, and quotes nothing of the address, so the sign-in
  // never reaches a check's output (floor rule 1); the sign-in made up, built from pieces as the test runs)
  const user = ["made", "up", "user"].join("-"), pass = ["not", "a", "sign", "in"].join("_"), signed = `git+https://${user}:${pass}@example.invalid/x.git`;
  const signedFaults = [...lockFaults({ ...list, devDependencies: { ...list.devDependencies, x: signed } }, lock),
    ...lockFaults(list, { ...lock, packages: { ...lock.packages, "node_modules/yaml": { ...lock.packages["node_modules/yaml"], dependencies: { x: signed } } } })];
  ok(lockFaults({ ...list, devDependencies: { ...list.devDependencies, x: "^1.0.0" } }, lock).some(f => f.includes('package.json devDependencies: "x" at "^1.0.0", not one exact version')),
    "a range of npm's registry where one exact version belongs is quoted, since it names no address", JSON.stringify(lockFaults({ ...list, devDependencies: { ...list.devDependencies, x: "^1.0.0" } }, lock)));
  ok(signedFaults.length > 0 && signedFaults.every(f => !f.includes(user) && !f.includes(pass) && !f.includes("example.invalid"))
    && signedFaults.some(f => /^package\.json devDependencies: the spec of "x" is not of npm's registry/u.test(f))
    && signedFaults.some(f => /^package-lock\.json node_modules\/yaml dependencies: the spec of "x" is not of npm's registry/u.test(f)),
    "a spec that names an address with a sign-in is refused by its field and package, and nothing of the address is quoted", JSON.stringify(signedFaults).replaceAll(user, "<user>").replaceAll(pass, "<pass>"));
  const unsorted = { ...list, devDependencies: Object.fromEntries(Object.entries(list.devDependencies).reverse()) };
  // (an override, as the core's own mutation tool's lock holds one (#581): there alone, at one exact version of npm's
  // registry, as a package of the list is, and no other spec)
  const own = { overrides: true };
  ok(lockFaults({ ...list, overrides: { yaml: "2.9.1" } }, lock, own).length === 0 && ["^2.9.1", "github:a/b", "file:../x"].every(v => lockFaults({ ...list, overrides: { yaml: v } }, lock, own).length > 0) && lockFaults({ ...list, overrides: { yaml: "2.9.1" } }, lock).length > 0,
    "where the mutation tool's install allows overrides, one passes at one exact version of npm's registry and is refused at a range, a git address or a file; every other install refuses the field", JSON.stringify(lockFaults({ ...list, overrides: { yaml: "^2.9.1" } }, lock, own)));
  ok(Object.keys(unsorted.devDependencies).join() !== Object.keys(lock.packages[""].devDependencies).join() && lockFaults(unsorted, lock).length === 0, "a package list whose packages stand out of order reads as the lock's root entry npm writes, sorted", JSON.stringify(lockFaults(unsorted, lock)));
  // (what npm installed is what the lock file names: its own record of the install, read against the lock entry by
  // entry, whatever field or npm brought another source in; the core's tests' job installs before this runs)
  const record = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, ".packages/node_modules/.package-lock.json"), "utf8")).packages ?? {}; } catch { return null; } })();
  const differ = record === null ? ["no install"] : [...new Set([...Object.keys(record), ...entries.map(([k]) => k)])]
    .filter(k => record[k]?.link || ["version", "resolved", "integrity"].some(f => record[k]?.[f] !== lock.packages[k]?.[f]));
  ok(differ.length === 0, "what npm installed, by its own record, is each entry of the lock file as written, and nothing else", `${differ.slice(0, 5).join(", ")}\nMend: run node scripts/install.mjs; where it still differs, an entry of the lock file or a spec in it names another source than npm's registry, which goes`);
  const config = json(".github/licences.json");
  ok(["", "parser/"].every(d => (config.lockfiles ?? []).includes(`.packages/${d}package-lock.json`) && (config.ignoreScriptsIn ?? []).includes(`.packages/${d}.npmrc`)), "the core's licence check reads the lock file, so the licence check and the lookup hold each package (floor rules 10 and 15)");
  // (an install script never runs, whatever npm command is run at the core's root or a copy's: the mechanism holds it)
  const npmrc = fs.readFileSync(path.join(root, ".packages/.npmrc"), "utf8");
  ok(/^ignore-scripts\s*=\s*true$/mu.test(npmrc) && /^min-release-age\s*=\s*7$/mu.test(npmrc) && (config.ignoreScriptsIn ?? []).includes(".packages/.npmrc"), "the core's .npmrc, which the copy carries, keeps every package's install script off and waits a week, and the licence check holds it there (floor rules 7 and 15)", npmrc);
}

// ---- the week's wait on each package the change brings or updates (floor rule 7) ----
// The wait itself asks npm's registry, a check of its own (scripts/week-wait.mjs, a step of the tests workflow that
// reaches the network); here its reading is held on answers made here, so this test runs with the network cut off (#772).
{
  const { tooYoung, failure } = await import(pathToFileURL(path.join(root, "scripts/week-wait.mjs")).href);
  ok(mended(failure(["yaml@2.9.2: published 2026-11-17T00:00:00.000Z"])), "the week's wait fails with its mend on the failure's own line", failure(["x"]));
  // (and as the step runs it, in a copy whose lock files hold one entry with a field no registry package carries, which
  // fails before any registry is asked, so the run needs no network: its exit code is 1 and its mend on the line it prints)
  const where = scratchDir("week-wait-");
  fs.cpSync(path.join(root, "scripts"), path.join(where, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(where, ".packages/parser"), { recursive: true });
  fs.writeFileSync(path.join(where, ".packages/package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/yaml": { version: "2.9.1", resolved: "https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz", integrity: "sha512-a", link: true } } }));
  fs.writeFileSync(path.join(where, ".packages/parser/package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  const run = spawnSync(process.execPath, [path.join(where, "scripts/week-wait.mjs")], { cwd: where, encoding: "utf8", env: { ...env, PACKAGES_BASE: "no-such-commit" } });
  ok(run.status === 1 && mended(run.stdout) && /its field link/u.test(run.stdout), "the check, run as its step runs it, exits 1 with its mend on the line it prints", `${run.status} ${run.stdout}${run.stderr}`);
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
    [{ ...held, "node_modules/yaml/node_modules/..": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a" } }, /names no installed package's folder/u],
    [{ "node_modules/yaml": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a", dependencies: { ms: "https://example.invalid/ms.tgz" } } }, /its dependencies not the registry's/u],
    [{ "node_modules/yaml": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a", license: "MIT" } }, /its license not the registry's/u],
    [{ ...held, "node_modules/spdx-exceptions": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a" } }, /its folder names another package than its address fetches/u],
    [{ ...held, "node_modules/yaml\\..\\x": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a" } }, /names no installed package's folder/u],
    // (a version field that names an address with a sign-in in it, made up from pieces: quoted with the sign-in cut out)
    [{ "node_modules/yaml": { version: `git+https://${["made", "up"].join("-")}:${["not", "a", "pass"].join("_")}@example.invalid/yaml.git`, resolved: tgz("2.9.1"), integrity: "sha512-a" } }, /its version field git\+https:\/\/example\.invalid\/yaml\.git$/u],
    // (and a key that is such an address, its sign-in cut out with the rest of the fault)
    [{ ...held, [`git+https://${["made", "up"].join("-")}:${["not", "a", "pass"].join("_")}@example.invalid/x.git`]: { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a" } }, /^git\+https:\/\/example\.invalid\/x\.git: a key that names no installed package's folder$/u],
  ];
  const results = await Promise.all(cases.map(([lock]) => tooYoung(lock, held, ask, now)));
  ok(cases.every(([, said], i) => results[i].length === 1 && said.test(results[i][0])) && (await tooYoung(held, held, ask, now)).length === 0
    && (await tooYoung({ "node_modules/yaml": { version: "2.9.1", resolved: tgz("2.9.1"), integrity: "sha512-a" } }, {}, ask, now + day)).length === 0,
    "and the week's wait reads the tarball the address names, never the version field alone, and fails an entry whose address names no version of npm's registry", results.map(r => r.join(" | ")).join(" || "));
}

// (where the lock file or the week's wait failed, nothing below installs or loads a package of it)
if (failed) { console.log(`FAIL ${failed} of the lock file's checks above failed, so nothing of it is installed or loaded here. Mend: mend each line above as it says`); process.exit(1); }

// ---- nothing of another publisher's tracked: no node_modules/, no carried folder ----
{
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  const theirs = f => /(?:^|\/)node_modules(?:\/|$)/u.test(f) || /^\.packages\/pypi(?:\/|$)/u.test(f) || f.startsWith("third-party/");
  ok(!tracked.some(theirs), "no file of another publisher's is tracked in the core, nor a link in its install's place: its packages are installed, never carried", tracked.filter(theirs).slice(0, 5).join(", "));
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  ok(/^\/\.packages\/node_modules$/mu.test(ignore) && /^\/\.packages\/parser\/node_modules$/mu.test(ignore) && /^\/\.packages\/pypi$/mu.test(ignore) && ["/.packages/", "/.packages/.npmrc", "/.packages/package.json", "/.packages/package-lock.json", "/.packages/requirements.txt", "/.packages/parser/", "/.packages/parser/.npmrc", "/.packages/parser/package.json", "/.packages/parser/package-lock.json"].every(f => ignore.split("\n").includes(`!${f}`)), "the core's .gitignore, which travels to the copy's root, keeps the install out of git, a link in its place too, and the copy's package list, lock file and .npmrc in it");
  // (which npm reads each setting that keeps an install to the registry and a week's wait, as npm's own docs of each
  // version list it, and the install's command names each one: #704)
  const { npmIgnores, npmReadsAll } = await import(pathToFileURL(path.join(root, "scripts/npm-reads.mjs")).href);
  ok(npmIgnores("10.9.9").length === 5 && npmIgnores("11.9.0").join() === "allow-remote,allow-file,allow-directory,min-release-age" && npmIgnores("11.13.0").join() === "allow-remote,allow-file,allow-directory"
    && npmIgnores("11.14.1").join() === "allow-remote" && npmIgnores("11.15.0").length === 0 && npmIgnores("12.0.0").length === 0 && npmIgnores("").length === 5 && npmIgnores("11.13.9", ["allow-git"]).length === 0 && npmIgnores("11.14.0-pre.0").length === 3 && npmIgnores("11.15.1-pre.0").length === 0 && npmIgnores("eleven").length === 5 && npmReadsAll() === "11.15.0" && npmReadsAll(["allow-git"]) === "11.9.0",
  "version 10 of npm reads none of the settings, its version 11 reads allow-git from 11.9.0, min-release-age from 11.10.0, allow-remote from 11.15.0 (11.14 lists it, but refuses the registry's own packages under it: #1262) and the others from 11.14.0, and an npm whose version cannot be read is taken to read none");
  // (the version the signature check's mend puts in place, which checks-test.mjs holds to the one its refusal names, is
  // the one npm's single entry in the licence audit names)
  const audited = json(".github/licences-audit.json").entries.filter(e => /^npm$/u.test(e.name)), [, named] = /--ignore-scripts npm@([^`\s]+)`/u.exec(fs.readFileSync(path.join(root, "scripts/checks.mjs"), "utf8")) ?? [];
  ok(audited.length === 1 && !!named && audited[0].version === named, "the licence audit names, for the package manager, one entry, at the version the signature check's mend puts in place (#1262)", `${audited.map(e => e.version)} ${named}`);
  // (the .npmrc the copy carries holds the core's own two settings alone, which install.mjs holds it to too)
  const { npmrcOthers } = await import(pathToFileURL(path.join(root, "scripts/packages.mjs")).href), npmrc = fs.readFileSync(path.join(root, ".packages/.npmrc"), "utf8");
  ok(npmrcOthers(npmrc).length === 0, "the core's .npmrc holds nothing but its own two settings, so the install and the signatures' check ask npm's own registry, with no token, proxy or certificate of another's", npmrcOthers(npmrc).join(" | "));
  // (each form built from pieces when the test runs, so that no file here points npm at another registry)
  const r = ["regi", "stry"].join("");
  ok([`"${r}" = http://127.0.0.1/`, `'${r}'=x`, `${r}[]=x`, "//h/:_authToken=${T}", "https-proxy=http://p/", "strict-ssl=false", "cafile=/x", `@a:${r}=x`, "min-release-age=\r7", "ignore-scripts=true\u2028", "min-release-age=7\u2029"].every(l => npmrcOthers(`ignore-scripts=true\n${l}\n`).length >= 1) && npmrcOthers("\uFEFF# c\n; c\n\nignore-scripts = true\nmin-release-age=7\n").length === 0, "and any other line, in whatever form npm reads it, is one install.mjs refuses");
}

// ---- with nothing installed, a script that loads a package installs it, or says it did not run, and why ----
const tmp = scratchDir("packages-test-");
// (where the run's network is cut off, the installs below read a copy of the job's npm cache, not the registry: #772)
const cached = npmWithCache(tmp, env);
if (cached) { const key = Object.keys(env).find(k => k.toUpperCase() === "PATH") ?? "PATH"; env[key] = `${path.dirname(cached)}${path.delimiter}${env[key] ?? ""}`; }
try {
  // (a project whose own node_modules holds a package of the name, at another version, beside a copy with none)
  const project = path.join(tmp, "project"), copy = path.join(project, "core"), pk = path.join(copy, ".packages");
  fs.mkdirSync(path.join(project, "node_modules/yaml"), { recursive: true });
  fs.writeFileSync(path.join(project, "node_modules/yaml/package.json"), JSON.stringify({ name: "yaml", version: "0.0.1", main: "index.js" }));
  fs.writeFileSync(path.join(project, "node_modules/yaml/index.js"), "module.exports = { Lexer: class {}, project: true };\n");
  // (and whose own package.json takes in every folder as a workspace: the copy's packages stand in a dot folder, which
  // no such pattern takes in, and install on their own all the same)
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "project", private: true, workspaces: ["*", "**"] }));
  fs.cpSync(path.join(root, "scripts"), path.join(copy, "scripts"), { recursive: true });
  for (const f of [".packages/package.json", ".packages/package-lock.json", ".packages/requirements.txt", ".gitignore", ".packages/.npmrc", ".packages/parser/package.json", ".packages/parser/package-lock.json", ".packages/parser/.npmrc"]) fs.cpSync(path.join(root, f), path.join(copy, f));
  // (the parser's install holding one package of its own lock, so that what installs it, and what does not, is seen: #719)
  // (node-addon-api, which the parser's own lock names and holds no dependency: a job that installed the parser has it in npm's cache, and
  // this test, with the network cut off, installs it from a copy of that cache: scratch-core.mjs, npmWithCache, #772)
  const pp = path.join(pk, "parser");
  const staged = json(".packages/parser/package-lock.json").packages["node_modules/node-addon-api"];
  ok(staged?.integrity, "the parser's lock names node-addon-api, which this case installs from the job's cache", "Mend: stage another package of the parser's lock with no dependency in this case, and its name where the case loads it");
  if (!staged?.integrity) process.exit(1); // (nothing below can stage what the lock does not name)
  const parserList = { ...JSON.parse(fs.readFileSync(path.join(pp, "package.json"), "utf8")), dependencies: { "node-addon-api": staged.version } };
  fs.writeFileSync(path.join(pp, "package.json"), JSON.stringify(parserList, null, 2));
  fs.writeFileSync(path.join(pp, "package-lock.json"), JSON.stringify({ name: parserList.name, lockfileVersion: 3, requires: true, packages: { "": { name: parserList.name, license: parserList.license, dependencies: parserList.dependencies }, "node_modules/node-addon-api": staged } }, null, 2));
  // (the copy's installer, which a script that needs a package runs before it reads (#1093, point 1), stands in for one
  // that cannot install while `fails` is there, as npm that cannot be started does, and runs the real one, beside it,
  // where it is not; each run is written in `asked`, by the installs it was given)
  const fails = path.join(tmp, "install-fails"), asked = path.join(tmp, "asked"), askedOf = () => (fs.existsSync(asked) ? fs.readFileSync(asked, "utf8") : "");
  fs.renameSync(path.join(copy, "scripts/install.mjs"), path.join(copy, "scripts/install-real.mjs"));
  fs.writeFileSync(path.join(copy, "scripts/install.mjs"), `import { spawnSync } from "node:child_process";\nimport fs from "node:fs";\nimport { fileURLToPath } from "node:url";\nfs.appendFileSync(${JSON.stringify(asked)}, \`\${process.argv.slice(2).join(" ") || "all"}\\n\`);\nif (fs.existsSync(${JSON.stringify(fails)})) { console.error("FAIL: the core's packages were not installed: npm could not be started. Mend: install npm beside Node, then run this again"); process.exit(1); }\nprocess.exit(spawnSync(process.execPath, [fileURLToPath(new URL("./install-real.mjs", import.meta.url)), ...process.argv.slice(2)], { stdio: "inherit" }).status ?? 1);\n`);
  fs.writeFileSync(fails, "");
  // (each script that loads a package, by the call that loads it; a script that loads one and has no case here fails)
  const CALLS = { "yaml-keys.mjs": `twice("a: 1\\n")`, "comment-only-yaml.mjs": `readYaml("a: 1\\n")`, "parse-yaml.mjs": `parseYaml("a: 1\\n")`, "markdown.mjs": "markdownReader()", "runners.mjs": `workflowsIn(".github/workflows")`, "toml.mjs": `parseToml("a = 1\\n")`, "schemas.mjs": `shapeFaults("copies", {})`, "workflows.mjs": `draftHoles("on: pull_request\\njobs: {}\\n")` };
  // (a reader whose caller goes on without the package, saying so as a warning: it answers null, and loads nothing)
  const ANSWERS_NULL = new Set(["schemas.mjs"]);
  // (parseYaml throws where the package is not installed, and each of its callers says so as a failure or an unread file:
  // here as a check would, so its words are read as one)
  // (a script that stops for want of the package, in a copy, warns and fails nothing; parseYaml and parseToml, which
  // throw for their callers to say, are read as their callers here read them, a failure)
  const THROWS = new Set(["parse-yaml.mjs", "toml.mjs"]);
  const callOf = f => (THROWS.has(f) ? `(() => { try { return m.${CALLS[f]}; } catch (e) { console.error(\`FAIL: \${e.message}\`); process.exit(1); } })()` : `m.${CALLS[f]}`);
  const loads = fs.readdirSync(path.join(root, "scripts")).filter(f => f.endsWith(".mjs") && f !== "packages.mjs" && /\bload(?:Sync)?\("/u.test(fs.readFileSync(path.join(root, "scripts", f), "utf8")));
  ok(loads.length > 0 && loads.every(f => CALLS[f]), "each script that loads a package has its call here", loads.filter(f => !CALLS[f]).join(", "));
  const call = (f, expr) => spawnSync(process.execPath, ["--input-type=module", "-e", `const m = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts", f)).href)}); console.log(JSON.stringify(${expr}));`], { cwd: project, encoding: "utf8", timeout: 60000, env });
  for (const f of loads.filter(x => ANSWERS_NULL.has(x))) {
    fs.rmSync(asked, { force: true });
    const r = call(f, callOf(f));
    ok(r.status === 0 && r.stdout.trim() === "null" && askedOf() === "all\n", `${f}, with nothing installed beside the copy, runs the copy's installer once, and where it installs nothing answers null for its caller to say, and does not take the project's own package of the name`, `${r.stdout}${r.stderr}${askedOf()}`);
  }
  for (const f of loads.filter(x => !ANSWERS_NULL.has(x))) {
    fs.rmSync(asked, { force: true });
    const r = call(f, callOf(f)), out = `${r.stdout}${r.stderr}`;
    ok(r.status === (THROWS.has(f) ? 1 : 0) && /(?:did not run[^\n]*|^FAIL): the package \S+ could not be installed in \S+: npm could not be started\. Mend: /mu.test(out) && (THROWS.has(f) || /^::warning::/mu.test(r.stderr)) && !r.stdout.trim() && askedOf() === "all\n" && told(out),
      `${f}, with nothing installed beside the copy, runs the copy's installer once, and where it installs nothing says it did not run and why, ${THROWS.has(f) ? "to its caller" : "as a warning that fails nothing"}, and does not take the project's own package of the name`, `${r.status} ${out}${askedOf()}`);
  }
  // (the steps, with nothing installed beside the copy: the copy's installer run once, and where it installs nothing, one
  // line in place of every step said unread, with why and the mend, failing nothing; #1095, point 2)
  for (const args of [[], ["--write"], ["--write", "--aside"]]) {
    fs.rmSync(asked, { force: true });
    const r = spawnSync(process.execPath, [path.join(copy, "scripts/steps.mjs"), ...args], { cwd: project, encoding: "utf8", timeout: 60000, env });
    const lines = r.stdout.trim().split("\n"), aside = args.includes("--aside");
    ok(r.status === 0 && (aside ? !r.stdout.trim() && !r.stderr.trim() : lines.length === 1 && /^The steps were not read: the package \S+ could not be installed in \S+: npm could not be started\. Mend: .*\.$/u.test(lines[0]) && !/\.\.$/u.test(lines[0])) && askedOf() === "all\n",
      `steps.mjs${args.length ? ` ${args.join(" ")}` : ""}, with nothing installed beside the copy, runs the copy's installer once, and where it installs nothing ${aside ? "runs no writer and says nothing, the sync having said it" : "says so in one line with its mend"}, and fails nothing`, `${r.status} ${r.stdout}${r.stderr}${askedOf()}`);
  }
  // (the code scan, with its engine not installed, on a change it would read: it did not run, and says how to install)
  const g = (...a) => execFileSync("git", a, { cwd: project, env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" } });
  g("init", "-q"); fs.writeFileSync(path.join(project, "a.py"), "x = 1\n"); g("add", "a.py"); g("commit", "-q", "-m", "code");
  fs.rmSync(asked, { force: true });
  const scanned = spawnSync(process.execPath, [path.join(copy, "scripts/code-scan.mjs")], { cwd: project, encoding: "utf8", timeout: 60000, env }), scanOut = `${scanned.stdout}${scanned.stderr}`;
  ok(scanned.status === 0 && /^::warning::The code scan did not run: semgrep\/bin\/semgrep-core(?:\.exe)? could not be installed in \S+: npm could not be started/mu.test(scanOut) && /^pypi$/mu.test(askedOf()) && told(scanOut), "the code scan, with no engine installed beside the copy, runs the copy's installer for it, and where that installs nothing says it did not run and why, failing nothing", `${scanned.status} ${scanOut}`);
  // (and in the core, whose jobs name what they install, it fails, never passing)
  fs.mkdirSync(path.join(copy, "tests"));
  const scannedInCore = spawnSync(process.execPath, [path.join(copy, "scripts/code-scan.mjs")], { cwd: project, encoding: "utf8", timeout: 60000, env }), coreScanOut = `${scannedInCore.stdout}${scannedInCore.stderr}`;
  fs.rmSync(path.join(copy, "tests"), { recursive: true });
  ok(scannedInCore.status === 1 && /^FAIL: the check did not run: semgrep\/bin\/semgrep-core(?:\.exe)? is not installed in \S+\. Mend: run `if \[ -f \S+install\.mjs \]; then node \S+install\.mjs pypi; fi`/mu.test(scannedInCore.stderr) && told(coreScanOut), "and in the core, which runs no installer for it, it fails, naming the guarded install step, never passing", `${scannedInCore.status} ${coreScanOut}`);
  const scanSkipped = spawnSync(process.execPath, [path.join(copy, "scripts/code-scan.mjs")], { cwd: project, encoding: "utf8", timeout: 60000, env: { ...env, CORE_PACKAGES_UNREACHED: "1" } });
  ok(scanSkipped.status === 0 && /^::warning::The code scan did not run: .*Mend: run this job again/mu.test(scanSkipped.stdout), "and where the job's install could not reach the registry, it says as a warning that it did not run, failing nothing (#654, point 4)", `${scanSkipped.status} ${scanSkipped.stdout}${scanSkipped.stderr}`);
  fs.mkdirSync(path.join(copy, ".packages/pypi"), { recursive: true }); fs.writeFileSync(path.join(tmp, "outside"), "not the engine");
  try { fs.symlinkSync(path.join(tmp, "outside"), path.join(copy, ".packages/pypi", "leads-out")); } catch { /* (no links here: the case is not run) */ }
  if (fs.existsSync(path.join(copy, ".packages/pypi", "leads-out"))) {
    const out = call("packages.mjs", `m.pypiFile("leads-out")`);
    ok(out.status === 0 && /^::warning::the check did not run: leads-out could not be installed/mu.test(out.stderr) && !out.stdout.trim(), "a file under .packages/pypi/ that leads out of it is no file of the install", `${out.stdout}${out.stderr}`);
  }
  // (a script that imports one of them for what needs no package runs with nothing installed: the copies check)
  const plain = call("yaml-keys.mjs", `m.uncommented("a: 1 # b")`);
  ok(plain.status === 0 && plain.stdout.trim() === JSON.stringify("a: 1"), "what needs no package runs with nothing installed, so a project's own workflow that runs the copies check is not stopped", `${plain.stdout}${plain.stderr}`);
  // (a project's Codex config, which the TOML package reads, with nothing installed: the agent-tools check did not run and
  // says the install, and where the job's install could not reach the registry it says as a warning that it left that
  // file unread: its entries are not failed as configured nowhere, and every other failure stands (#654, point 4)
  fs.mkdirSync(path.join(project, ".codex"), { recursive: true });
  fs.writeFileSync(path.join(project, ".codex/config.toml"), "[mcp_servers.docs]\ncommand = \"docs-server\"\n");
  const entry = name => ({ kind: "server", name, publisher: "Example Tools", version: "2.0.0" });
  fs.writeFileSync(path.join(project, "licences.json"), JSON.stringify({ agentTools: [entry("Codex docs")] }));
  const tools = more => spawnSync(process.execPath, [path.join(copy, "scripts/agent-tools.mjs"), "licences.json"], { cwd: project, encoding: "utf8", timeout: 60000, env: { ...env, ...more } });
  const absent = tools({}), skipped = tools({ CORE_PACKAGES_UNREACHED: "1" });
  fs.writeFileSync(path.join(project, ".mcp.json"), JSON.stringify({ mcpServers: { files: { command: "files-server" } } }));
  const others = tools({ CORE_PACKAGES_UNREACHED: "1" });
  fs.rmSync(path.join(project, ".mcp.json"));
  ok(absent.status === 0 && /^::warning::The agent-tools check did not read \.codex\/config\.toml, and ran every other part: the package smol-toml could not be installed in \S+: npm could not be started\. Mend: /mu.test(absent.stdout) && !/docs/u.test(absent.stderr) && told(absent.stdout), "the agent-tools check with a Codex config, where the copy's installer installs nothing, leaves that file unread, saying why, and fails none of its entries", `${absent.status} ${absent.stdout}${absent.stderr}`);
  ok(skipped.status === 0 && /^::warning::The agent-tools check did not read \.codex\/config\.toml, and ran every other part: .*smol-toml.*Mend: run this job again/mu.test(skipped.stdout) && !/docs/u.test(skipped.stderr), "and where the registry did not answer, it says as a warning that it left the Codex config unread, failing none of its entries", `${skipped.status} ${skipped.stdout}${skipped.stderr}`);
  ok(others.status === 1 && /server "files", configured in \.mcp\.json, is not listed/u.test(others.stderr) && !/docs/u.test(others.stderr), "while every other part of the check runs, and fails what it finds", `${others.status} ${others.stdout}${others.stderr}`);
  fs.rmSync(path.join(project, ".codex"), { recursive: true, force: true });
  fs.rmSync(path.join(project, "licences.json"));
  // (the shape check's reader of C#, which reads on the parser's files (installedFile), with nothing installed: it did
  // not run, saying the mend; where the job's install could not reach the registry, it reads nothing of C#, says so
  // as a warning and fails nothing by that alone, and writes no baseline then (#654, point 4))
  {
    const cs = path.join(tmp, "cs");
    fs.mkdirSync(cs);
    fs.cpSync(copy, path.join(cs, "core"), { recursive: true });
    fs.writeFileSync(path.join(cs, "shape.json"), JSON.stringify({ baseline: "shape-baseline.json", code: [".", ":!core/"], tests: [], systems: {} }));
    fs.writeFileSync(path.join(cs, "Program.cs"), "class A { void M(bool x) { if (x) { } } }\n");
    // (a file the grammar cannot read whole, which its baseline lists as lost: only the parser tells it so)
    fs.writeFileSync(path.join(cs, "Bad.cs"), "class B { void M() { int x = ; } }\n");
    execFileSync("git", ["init", "-q"], { cwd: cs });
    execFileSync("git", ["add", "-A"], { cwd: cs });
    const shape = (args, extra = {}) => spawnSync(process.execPath, ["core/scripts/shape.mjs", "shape.json", ...args], { cwd: cs, encoding: "utf8", timeout: 120000, env: { ...env, SHAPE_BASE: "", ...extra } });
    const none = shape(["--first"]), noneOut = `${none.stdout}${none.stderr}`;
    ok(none.status === 1 && /did not run: the package \S+ is not installed/u.test(noneOut) && !fs.existsSync(path.join(cs, "shape-baseline.json")) && told(noneOut), "the shape check, reading C# where the copy's parser list names none of its packages, writes no first baseline, saying the mend", noneOut);
    const refusedWrite = shape(["--first"], { CORE_PACKAGES_UNREACHED: "1" }), refusedOut = `${refusedWrite.stdout}${refusedWrite.stderr}`;
    ok(refusedWrite.status === 1 && /cannot be read and a baseline written now would leave out/u.test(refusedOut) && !fs.existsSync(path.join(cs, "shape-baseline.json")) && told(refusedOut), "where the registry did not answer, it writes no baseline, saying the mend", refusedOut);
    fs.writeFileSync(path.join(cs, "shape-baseline.json"), JSON.stringify({ reads: ["javascript", "jsx", "csharp", "csharp-tree", "python", "scripts", "screens"], listed: { "function: Program.cs#A.M": { lines: 99 }, "lost: Bad.cs": true } }));
    const skipped = shape([], { CORE_PACKAGES_UNREACHED: "1" }), skippedOut = `${skipped.stdout}${skipped.stderr}`;
    ok(skipped.status === 0 && /^::warning::The shape check did not read C#, by the parser \(the reader csharp-tree\): the package web-tree-sitter could not be installed, the registry not answering, .*the 2 entries its baseline lists there \(functions, files the grammar cannot read, and all of a file of C# or Python\) are kept as listed, never failed as gone.*Mend: run this job again/mu.test(skippedOut), "and where it did not answer, the check reads nothing of C#, says which reader it skipped and why as a warning, and fails nothing by that alone, its baseline's function and its file the grammar cannot read kept as listed", skippedOut);
    // (and a cycle of using directives, which only the parser reads now that C# is read on it whole (#530, item 6), is
    // reported, never failed, as Python's is below)
    fs.writeFileSync(path.join(cs, "X.cs"), "using B;\nnamespace A { class X { } }\n");
    fs.writeFileSync(path.join(cs, "Y.cs"), "using A;\nnamespace B { class Y { } }\n");
    execFileSync("git", ["add", "-A"], { cwd: cs });
    const cycle = shape([], { CORE_PACKAGES_UNREACHED: "1" }), cycleOut = `${cycle.stdout}${cycle.stderr}`;
    ok(cycle.status === 0 && !/FAIL/u.test(cycleOut), "and a cycle of C#'s using directives, which only the parser reads, is reported, never failed", cycleOut);
  }
  {
    // (and so of JavaScript's functions, read on the parser too: where the registry did not answer, none is read, a
    // warning names the reader, and its imports, read without the parser, still fail on a cycle)
    const js = path.join(tmp, "js");
    fs.mkdirSync(js);
    fs.cpSync(copy, path.join(js, "core"), { recursive: true });
    fs.writeFileSync(path.join(js, "shape.json"), JSON.stringify({ baseline: "shape-baseline.json", code: [".", ":!core/"], tests: [], systems: {} }));
    fs.writeFileSync(path.join(js, "a.mjs"), `export function f(x) {\n${"  x++;\n".repeat(70)}}\n`);
    fs.writeFileSync(path.join(js, "shape-baseline.json"), JSON.stringify({ reads: ["javascript", "jsx", "javascript-tree", "csharp", "csharp-tree", "python", "scripts", "screens"], listed: { "function: a.mjs#f": { lines: 72 } } }));
    execFileSync("git", ["init", "-q"], { cwd: js });
    execFileSync("git", ["add", "-A"], { cwd: js });
    const shape = () => spawnSync(process.execPath, ["core/scripts/shape.mjs", "shape.json"], { cwd: js, encoding: "utf8", timeout: 120000, env: { ...env, SHAPE_BASE: "", CORE_PACKAGES_UNREACHED: "1" } });
    const skipped = shape(), skippedOut = `${skipped.stdout}${skipped.stderr}`;
    ok(skipped.status === 0 && /^::warning::The shape check did not read JavaScript and TypeScript, their functions by the parser \(the reader javascript-tree\): the package web-tree-sitter could not be installed, .*1 entry its baseline lists there \(functions, files the grammar cannot read, and all of a file of C# or Python\) is kept as listed, never failed as gone.*Mend: run this job again/mu.test(skippedOut),
      "where the registry did not answer, the check reads no function of JavaScript, says so as a warning naming the reader, and keeps its baseline's function", skippedOut);
    fs.writeFileSync(path.join(js, "b.mjs"), "import './c.mjs';\n");
    fs.writeFileSync(path.join(js, "c.mjs"), "import './b.mjs';\n");
    execFileSync("git", ["add", "-A"], { cwd: js });
    const cycle = shape(), cycleOut = `${cycle.stdout}${cycle.stderr}`;
    ok(cycle.status === 1 && /FAIL: 2 imports lie on a cycle/u.test(cycleOut) && mended(cycleOut), "and what the readers of JavaScript find without the parser, a cycle of its imports, fails all the same", cycleOut);
  }
  {
    // (and of Python, whose functions, imports and tokens are all read on the parser (#530, item 6): where the registry
    // did not answer, nothing of a file of Python is read, a warning names the reader, each entry its baseline lists
    // there is kept as listed, a cycle it would find is reported and never failed, and the selection runs each test of
    // Python whose imports it could not read as one that reaches every file)
    const py = path.join(tmp, "py");
    fs.mkdirSync(path.join(py, "tests"), { recursive: true });
    fs.cpSync(copy, path.join(py, "core"), { recursive: true });
    fs.writeFileSync(path.join(py, "shape.json"), JSON.stringify({ baseline: "shape-baseline.json", code: [".", ":!core/"], tests: ["tests/"], systems: {} }));
    fs.writeFileSync(path.join(py, "a.py"), "# Changed: x\nfrom b import x\n");
    fs.writeFileSync(path.join(py, "b.py"), "import a\nx = 1\n");
    fs.writeFileSync(path.join(py, "c.py"), "y = 2\n");
    fs.writeFileSync(path.join(py, "tests/test_c.py"), "import c\n");
    fs.writeFileSync(path.join(py, "shape-baseline.json"), JSON.stringify({ reads: ["javascript", "jsx", "javascript-tree", "csharp", "csharp-tree", "python", "python-tree", "scripts", "screens", "clocks", "processes", "changes"], listed: { "cycle: a.py -> b.py": true, "cycle: b.py -> a.py": true, "change: a.py: a change's heading": { count: 1 } } }));
    const git = (...a) => execFileSync("git", a, { cwd: py, encoding: "utf8" });
    git("init", "-q");
    git("add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "base");
    const unreachedEnv = { ...env, SHAPE_BASE: "", CORE_PACKAGES_UNREACHED: "1" };
    const shape = () => spawnSync(process.execPath, ["core/scripts/shape.mjs", "shape.json"], { cwd: py, encoding: "utf8", timeout: 120000, env: unreachedEnv });
    const skipped = shape(), skippedOut = `${skipped.stdout}${skipped.stderr}`;
    ok(skipped.status === 0 && /^::warning::The shape check did not read Python, by the parser \(the reader python-tree\): the package web-tree-sitter could not be installed, .*the 3 entries its baseline lists there \(functions, files the grammar cannot read, and all of a file of C# or Python\) are kept as listed, never failed as gone.*Mend: run this job again/mu.test(skippedOut),
      "where the registry did not answer, the check reads nothing of Python, says so as a warning naming the reader, and keeps its baseline's cycle and its comment that marks a change", skippedOut);
    fs.writeFileSync(path.join(py, "d.py"), "# Changed: y\nimport e\n");
    fs.writeFileSync(path.join(py, "e.py"), "import d\n");
    git("add", "-A");
    const cycle = shape(), cycleOut = `${cycle.stdout}${cycle.stderr}`;
    ok(cycle.status === 0 && !/FAIL/u.test(cycleOut), "and a cycle of Python's imports and a comment that marks a change, which only the parser reads, are reported, never failed", cycleOut);
    fs.writeFileSync(path.join(py, "c.py"), "y = 3\n");
    git("add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "change");
    const select = spawnSync(process.execPath, ["core/scripts/select.mjs", "shape.json"], { cwd: py, encoding: "utf8", timeout: 120000, env: { ...unreachedEnv, SELECT_BASE: "HEAD^1", GITHUB_ENV: "", GITHUB_STEP_SUMMARY: "" } }), selectOut = `${select.stdout}${select.stderr}`;
    ok(select.status === 0 && /tests\/test_c\.py: reaches every file \(c\.py\)/u.test(selectOut),
      "and the selection runs a test of Python whose imports it could not read as one that reaches every file", selectOut);
  }
  // (and the install puts each package where the scripts load it from, untracked)
  // (a project whose own .gitignore leaves out an .npmrc, a lock file and every dot folder still tracks the copy's)
  fs.writeFileSync(path.join(project, ".gitignore"), ".*\n!.gitignore\n.npmrc\npackage-lock.json\npackage.json\n");
  execFileSync("git", ["init", "-q"], { cwd: project });
  execFileSync("git", ["add", "-A"], { cwd: project });
  const tracked = execFileSync("git", ["ls-files"], { cwd: project, encoding: "utf8" }).split("\n");
  ok(["core/.packages/.npmrc", "core/.packages/package.json", "core/.packages/package-lock.json", "core/.packages/parser/.npmrc", "core/.packages/parser/package.json", "core/.packages/parser/package-lock.json"].every(f => tracked.includes(f)) && !tracked.some(f => /^core\/\.packages\/(?:parser\/)?node_modules\//u.test(f)), "a project whose .gitignore leaves out .npmrc and lock files, and dot folders, tracks the copy's all the same", tracked.filter(f => f.startsWith("core/") && !f.startsWith("core/scripts/")).join(", "));
  fs.rmSync(path.join(project, ".git"), { recursive: true, force: true });
  fs.rmSync(fails);
  const r = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env });
  fs.writeFileSync(fails, "");
  const lock = JSON.parse(fs.readFileSync(path.join(pk, "package-lock.json"), "utf8"));
  const installed = Object.entries(lock.packages).filter(([k, e]) => k && !e.dev).every(([k]) => fs.existsSync(path.join(pk, k, "package.json")));
  const tests = Object.entries(lock.packages).filter(([k, e]) => k && e.dev);
  ok(r.status === 0 && installed, "install.mjs installs each package of the lock file a script loads into the copy's .packages/node_modules, in a project whose workspaces take in every folder", `${r.stdout}${r.stderr}`);
  ok(tests.length > 0 && !tests.some(([k]) => fs.existsSync(path.join(pk, k))), "and none that only the core's own tests run: a copy holds no tests", tests.map(([k]) => k).join(", "));
  // (under an npm that ignores a setting that keeps an install to the registry or a week's wait, as npm 10 that Node 22
  // brings does, it says so in a note and still installs, nothing failing for it; under one that reads them all, no note; #704)
  const { npmIgnores, npmVersion } = await import(pathToFileURL(path.join(root, "scripts/npm-reads.mjs")).href);
  ok(/^note npm \S+ ignores --allow-.*\.node-version/mu.test(r.stdout) === (npmIgnores(npmVersion(project)).length > 0), `and it says in a note whether the package manager here (version ${npmVersion(project)}) ignores a setting that keeps the install to the registry or a week's wait`, r.stdout);
  const loaded = spawnSync(process.execPath, ["--input-type=module", "-e", `const { load } = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts/packages.mjs")).href)}); const m = await load("yaml"); console.log(m.project ? "project" : typeof m.Lexer);`], { cwd: project, encoding: "utf8", env });
  ok(loaded.status === 0 && loaded.stdout.trim() === "function", "and load() takes the copy's own, never the project's", `${loaded.stdout}${loaded.stderr}`);
  // (an install left from before is never loaded for a package its lock does not name as installed: where the package
  // list and lock name nothing, and where the package's own entry is flagged dev at another version; #719)
  const keptMainList = fs.readFileSync(path.join(pk, "package.json"), "utf8"), keptMainLock = fs.readFileSync(path.join(pk, "package-lock.json"), "utf8");
  const leftoverCases = [];
  {
    const list = JSON.parse(keptMainList);
    delete list.dependencies; delete list.devDependencies;
    fs.writeFileSync(path.join(pk, "package.json"), JSON.stringify(list, null, 2));
    fs.writeFileSync(path.join(pk, "package-lock.json"), JSON.stringify({ name: list.name, lockfileVersion: 3, requires: true, packages: { "": { name: list.name, license: list.license } } }, null, 2));
    leftoverCases.push(["a package list and lock that name nothing", call("yaml-keys.mjs", callOf("yaml-keys.mjs"))]);
  }
  {
    const list = JSON.parse(keptMainList), lock = JSON.parse(keptMainLock);
    list.dependencies = { ...list.dependencies, yaml: "2.8.0" };
    lock.packages[""].dependencies = { ...lock.packages[""].dependencies, yaml: "2.8.0" };
    lock.packages["node_modules/yaml"] = { ...lock.packages["node_modules/yaml"], version: "2.8.0", resolved: "https://registry.npmjs.org/yaml/-/yaml-2.8.0.tgz", integrity: `sha512-${Buffer.alloc(64, 9).toString("base64")}`, dev: true };
    fs.writeFileSync(path.join(pk, "package.json"), JSON.stringify(list, null, 2));
    fs.writeFileSync(path.join(pk, "package-lock.json"), JSON.stringify(lock, null, 2));
    leftoverCases.push(["the package's own entry flagged dev at another version", call("yaml-keys.mjs", callOf("yaml-keys.mjs"))]);
  }
  fs.writeFileSync(path.join(pk, "package.json"), keptMainList);
  fs.writeFileSync(path.join(pk, "package-lock.json"), keptMainLock);
  // (where no list names the package, no install puts it there, and the check fails; where its entry is flagged dev, the
  // install is current and the package is not loaded, said as a warning)
  for (const [what, r] of leftoverCases) ok(r.status === (what === leftoverCases[0][0] ? 1 : 0) && /did not run: the package yaml is not installed/u.test(r.stderr) && !r.stdout.trim() && told(r.stderr), `an install left from before is not loaded where ${what}`, `${r.status} ${r.stdout}${r.stderr}`);
  ok(/no package list of the core's names it .*Mend: in a project, take the core's copy back as the core holds it .*in the core, add the package to the package list and lock file/u.test(leftoverCases[0][1].stderr), "and where no package list names the package, the mend is the core's copy taken back, or in the core the package added to a list and its lock, which no install alone would do", leftoverCases[0][1].stderr);
  // (a package the lock flags dev, which only the core's own tests run and read themselves, is never loaded by a script,
  // even where the core's own install holds it as its lock names it)
  const devLoad = spawnSync(process.execPath, ["--input-type=module", "-e", `const p = await import(${JSON.stringify(pathToFileURL(path.join(root, "scripts/packages.mjs")).href)}); console.log(p.installed("yaml"), p.installed("spdx-license-ids"));`], { encoding: "utf8", env });
  ok(devLoad.status === 0 && devLoad.stdout.trim() === "true false", "a package the lock flags dev reads as not installed for a script, beside one it names for them", `${devLoad.stdout}${devLoad.stderr}`);
  // (the parser's install only where a job names it (#719): with none named, its packages are not there, and a script
  // that loads one runs the copy's installer for it alone, saying it did not run where that installs nothing;
  // `install.mjs parser` installs it, and `all` every one)
  const loadParser = () => spawnSync(process.execPath, ["--input-type=module", "-e", `const { loadSync } = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts/packages.mjs")).href)}); console.log(typeof loadSync("node-addon-api").include === "string");`], { cwd: project, encoding: "utf8", env });
  fs.rmSync(asked, { force: true });
  const notNamed = loadParser();
  ok(!fs.existsSync(path.join(pp, "node_modules")) && notNamed.status === 0 && askedOf() === "parser\n" && /^::warning::the check did not run: the package node-addon-api could not be installed in \S*parser\S*node_modules: npm could not be started\. Mend: /mu.test(notNamed.stderr) && !notNamed.stdout.trim() && told(notNamed.stderr),
    "the parser's install is not installed where no job names it, and what loads one of its packages runs the copy's installer for it alone, saying it did not run and why where that installs nothing", `${notNamed.stdout}${notNamed.stderr}${askedOf()}`);
  // (a project's own job that installs the core's first install alone, written before the parser's came: a package of the
  // parser's the copy could not install reads as unreached, so the reader that needs it warns and fails nothing; in the
  // core, which holds its tests and installs nothing itself, never: #719)
  const askUnreached = () => spawnSync(process.execPath, ["--input-type=module", "-e", `const p = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts/packages.mjs")).href)}); console.log(p.unreached("node-addon-api"), p.unreached("yaml"));`], { cwd: project, encoding: "utf8", env });
  const unreachedHere = askUnreached();
  // (a file of a package that is no module, as the parser reads its grammar, with the same words as a load: where the
  // copy's installer installs nothing, what it said, and its mend)
  const fileAsked = spawnSync(process.execPath, ["--input-type=module", "-e", `const p = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts/packages.mjs")).href)}); try { p.installedFile("node-addon-api", "index.js"); } catch (e) { console.log("FAIL: " + e.message); }`], { cwd: project, encoding: "utf8", env });
  ok(/^FAIL: the check did not run: the package node-addon-api could not be installed in \S*parser\S*node_modules: npm could not be started\. Mend: /mu.test(fileAsked.stdout) && told(fileAsked.stdout),
    "a file of a package not installed says it did not run, and why", `${fileAsked.stdout}${fileAsked.stderr}`);
  fs.mkdirSync(path.join(copy, "tests"));
  fs.rmSync(asked, { force: true });
  const unreachedInCore = askUnreached();
  const fileInCore = spawnSync(process.execPath, ["--input-type=module", "-e", `const p = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts/packages.mjs")).href)}); try { p.installedFile("node-addon-api", "index.js"); } catch (e) { console.log("FAIL: " + e.message); }`], { cwd: project, encoding: "utf8", env });
  fs.rmSync(path.join(copy, "tests"), { recursive: true });
  ok(unreachedHere.stdout.trim() === "true false" && unreachedInCore.stdout.trim() === "false false" && askedOf() === "",
    "in a copy whose installer could not install the parser's, a package of it reads as unreached, so its reader warns and fails nothing; in the core, never, and no installer runs there", `${unreachedHere.stdout}${unreachedHere.stderr}${unreachedInCore.stdout}${unreachedInCore.stderr}${askedOf()}`);
  ok(/^FAIL: the check did not run: the package node-addon-api is not installed in \S*parser\S*node_modules as \.packages\/parser\/package-lock\.json names it \(index\.js\)\. Mend: run `if \[ -f \S*install\.mjs \]; then node \S*install\.mjs parser; fi`/mu.test(fileInCore.stdout) && told(fileInCore.stdout),
    "and in the core the mend is the install step, guarded, naming the install (#1090)", `${fileInCore.stdout}${fileInCore.stderr}`);
  {
    // (the shape check in such a job, its copy's parser list naming the parser's own packages, as the core's does: where
    // the copy's installer installs nothing, it reads nothing of C#, and its warning says why, with its mend)
    const cs = path.join(tmp, "cs-unnamed");
    fs.mkdirSync(cs);
    fs.cpSync(copy, path.join(cs, "core"), { recursive: true });
    fs.copyFileSync(path.join(root, ".packages/parser/package.json"), path.join(cs, "core/.packages/parser/package.json"));
    fs.writeFileSync(path.join(cs, "shape.json"), JSON.stringify({ baseline: "shape-baseline.json", code: [".", ":!core/"], tests: [], systems: {} }));
    fs.writeFileSync(path.join(cs, "Program.cs"), "class A { void M(bool x) { if (x) { } } }\n");
    fs.writeFileSync(path.join(cs, "shape-baseline.json"), JSON.stringify({ reads: ["javascript", "jsx", "csharp", "csharp-tree", "python", "scripts", "screens"], listed: { "function: Program.cs#A.M": { lines: 99 } } }));
    execFileSync("git", ["init", "-q"], { cwd: cs });
    execFileSync("git", ["add", "-A"], { cwd: cs });
    const r = spawnSync(process.execPath, ["core/scripts/shape.mjs", "shape.json"], { cwd: cs, encoding: "utf8", timeout: 120000, env: { ...env, SHAPE_BASE: "" } }), out = `${r.stdout}${r.stderr}`;
    ok(r.status === 0 && /^::warning::The shape check did not read C#, by the parser \(the reader csharp-tree\): the package web-tree-sitter could not be installed in \S+: npm could not be started, .*Mend: install npm beside Node/mu.test(out),
      "and the shape check there reads nothing of C#, failing nothing, and its warning says why, with its mend", out);
  }
  // (and where the copy's installer installs, a script that loads a package of the parser's installs it itself, before it
  // reads, saying so in a note on stderr, and then loads it: a project's own job needs no install step for it; #1093,
  // point 1)
  fs.rmSync(fails);
  fs.rmSync(asked, { force: true });
  const selfInstalled = loadParser();
  fs.writeFileSync(fails, "");
  ok(selfInstalled.status === 0 && selfInstalled.stdout.trim() === "true" && askedOf() === "parser\n" && /^note the core's packages of \.packages\/parser\/package-lock\.json were not installed beside its copy, so this check installed them first$/mu.test(selfInstalled.stderr),
    "where the copy's installer installs, a script that loads a package of the parser's installs it first, and loads it", `${selfInstalled.status} ${selfInstalled.stdout}${selfInstalled.stderr}${askedOf()}`);
  fs.rmSync(path.join(pp, "node_modules"), { recursive: true, force: true });
  fs.rmSync(fails);
  const parser = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs"), "parser"], { cwd: project, encoding: "utf8", timeout: 300000, env });
  const named = loadParser();
  ok(parser.status === 0 && /into \.packages\/parser\/node_modules\//u.test(parser.stdout) && !/into \.packages\/node_modules\//u.test(parser.stdout) && named.status === 0 && named.stdout.trim() === "true" && askUnreached().stdout.trim() === "false false",
    "install.mjs parser installs the parser's alone, and its package then loads from there", `${parser.stdout}${parser.stderr}${named.stdout}${named.stderr}`);
  fs.rmSync(path.join(pp, "node_modules"), { recursive: true, force: true });
  const every = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs"), "all"], { cwd: project, encoding: "utf8", timeout: 300000, env });
  // (what the sync and the starter kit hand a copy's installer: `all` where the copy holds the parser's package list,
  // nothing for an older copy's, which knows no other word: #719)
  const { everyInstall } = await import(pathToFileURL(path.join(root, "scripts/packages.mjs")).href);
  const older = path.join(tmp, "older-copy");
  fs.mkdirSync(path.join(older, ".packages"), { recursive: true });
  ok(JSON.stringify(everyInstall(copy)) === '["all"]' && JSON.stringify(everyInstall(older)) === "[]", "everyInstall(), which the sync and the starter kit hand a copy's installer, names every install to a copy that holds the parser's package list, and none to an older copy's (that they call it, the mutation tool's report on their lines holds)");
  ok(every.status === 0 && /into \.packages\/node_modules\//u.test(every.stdout) && /into \.packages\/parser\/node_modules\//u.test(every.stdout) && loadParser().status === 0, "and install.mjs all installs every one, as the sync and the starter kit run it", `${every.stdout}${every.stderr}`);
  // (a lock file that names no package starts no npm, so a job that names `all` pays nothing for an install with nothing in it)
  const keptList = fs.readFileSync(path.join(pp, "package.json"), "utf8"), keptLock = fs.readFileSync(path.join(pp, "package-lock.json"), "utf8");
  const emptyList = { ...JSON.parse(keptList) };
  delete emptyList.dependencies;
  fs.writeFileSync(path.join(pp, "package.json"), JSON.stringify(emptyList, null, 2));
  fs.writeFileSync(path.join(pp, "package-lock.json"), JSON.stringify({ name: emptyList.name, lockfileVersion: 3, requires: true, packages: { "": { name: emptyList.name, license: emptyList.license } } }, null, 2));
  fs.rmSync(path.join(pp, "node_modules"), { recursive: true, force: true });
  const empty = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs"), "parser"], { cwd: project, encoding: "utf8", timeout: 300000, env });
  fs.writeFileSync(path.join(pp, "package.json"), keptList);
  fs.writeFileSync(path.join(pp, "package-lock.json"), keptLock);
  ok(empty.status === 0 && /parser\/package-lock\.json names no package: nothing to install/u.test(empty.stdout) && !fs.existsSync(path.join(pp, "node_modules")), "an install whose lock file names no package starts no npm, and says so", `${empty.stdout}${empty.stderr}`);
  // (but a lock whose root and package list name a package it holds no entry for is no empty one: npm runs, and refuses it,
  // so an install left from before is never taken as current)
  fs.writeFileSync(path.join(pp, "package-lock.json"), JSON.stringify({ name: parserList.name, lockfileVersion: 3, requires: true, packages: { "": { name: parserList.name, license: parserList.license, dependencies: parserList.dependencies } } }, null, 2));
  const unentered = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs"), "parser"], { cwd: project, encoding: "utf8", timeout: 300000, env });
  fs.writeFileSync(path.join(pp, "package-lock.json"), keptLock);
  ok(unentered.status === 1 && !/nothing to install/u.test(unentered.stdout) && told(unentered.stderr), "and a lock whose root names a package it holds no entry for is no empty one: npm is run, and the install fails, saying the mend", `${unentered.status} ${unentered.stdout}${unentered.stderr}`);
  // (nor one with no root entry at all beside a package list that names a package: refused before npm, as npm writes none so)
  fs.writeFileSync(path.join(pp, "package-lock.json"), JSON.stringify({ name: parserList.name, lockfileVersion: 3, requires: true, packages: {} }, null, 2));
  const rootless = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs"), "parser"], { cwd: project, encoding: "utf8", timeout: 300000, env });
  fs.writeFileSync(path.join(pp, "package-lock.json"), keptLock);
  ok(rootless.status === 1 && /no root entry ""/u.test(rootless.stderr) && !/nothing to install/u.test(rootless.stdout) && told(rootless.stderr), "and a lock with no root entry beside a package list that names a package is refused before npm runs, saying the mend", `${rootless.status} ${rootless.stdout}${rootless.stderr}`);
  // (and whatever the install did, an install left from before is never loaded where the lock names fewer packages than
  // the package list beside it: the package did not run)
  const reinstalled = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs"), "parser"], { cwd: project, encoding: "utf8", timeout: 300000, env });
  fs.writeFileSync(path.join(pp, "package-lock.json"), JSON.stringify({ name: parserList.name, lockfileVersion: 3, requires: true, packages: { "": { name: parserList.name, license: parserList.license } } }, null, 2));
  fs.writeFileSync(fails, "");
  const leftover = loadParser();
  fs.writeFileSync(path.join(pp, "package-lock.json"), keptLock);
  ok(reinstalled.status === 0 && leftover.status === 0 && /^::warning::the check did not run: the package node-addon-api could not be installed/mu.test(leftover.stderr) && !leftover.stdout.trim() && told(leftover.stderr), "an install left from before is not loaded where the lock beside the package list names none of its packages", `${reinstalled.status} ${leftover.status} ${leftover.stdout}${leftover.stderr}`);
  // (an install npm recorded for another lock file is no install of this one: the package did not run)
  const record = path.join(pk, "node_modules/.package-lock.json"), kept = fs.readFileSync(record, "utf8");
  const other = JSON.parse(kept);
  other.packages["node_modules/yaml"].resolved = "https://example.invalid/yaml.tgz";
  fs.writeFileSync(record, JSON.stringify(other));
  const stale = call("yaml-keys.mjs", callOf("yaml-keys.mjs"));
  ok(stale.status === 0 && /^::warning::the check did not run: the package yaml could not be installed in \S+: npm could not be started/mu.test(stale.stderr) && !stale.stdout.trim() && told(stale.stderr), "a package installed from another lock file than the copy's is never loaded: the copy's installer is run, and where it installs nothing the check did not run, saying why", `${stale.stdout}${stale.stderr}`);
  // (where the job's install could not reach the registry, a script is told so and runs no installer, which would only
  // wait on it again; a package it loads all the same is never loaded: in a copy the check did not run, said as a
  // warning, and in the core it fails, never passing)
  const loadUnreached = () => spawnSync(process.execPath, ["--input-type=module", "-e", `const p = await import(${JSON.stringify(pathToFileURL(path.join(copy, "scripts/packages.mjs")).href)}); console.log(p.unreached("yaml")); p.loadSync("yaml"); console.log("loaded");`], { cwd: project, encoding: "utf8", env: { ...env, CORE_PACKAGES_UNREACHED: "1" } });
  fs.rmSync(asked, { force: true });
  const unreached = loadUnreached();
  fs.mkdirSync(path.join(copy, "tests"));
  const loadedInCore = loadUnreached();
  fs.rmSync(path.join(copy, "tests"), { recursive: true });
  ok(unreached.status === 0 && unreached.stdout.trim() === "true" && /^::warning::the check did not run: the package yaml could not be installed, the registry not answering\. Mend: run this job again/mu.test(unreached.stderr) && askedOf() === "" && told(unreached.stderr)
    && loadedInCore.status === 1 && loadedInCore.stdout.trim() === "true" && /^FAIL: the check did not run: /mu.test(loadedInCore.stderr),
  "where the job's install could not reach the registry, a script is told so and runs no installer, and a package it loads all the same is never loaded: a warning in a copy, a failure in the core (#654, points 3 and 4)", `${unreached.stdout}${unreached.stderr}${loadedInCore.status} ${loadedInCore.stdout}${loadedInCore.stderr}`);
  fs.writeFileSync(record, kept);
  fs.rmSync(fails);
  // (in a project's pull request the same failure fails all the same: a lock file the registry's tarball does not match
  // is no registry that did not answer, and a pull request can bring it about)
  const jobEnv = path.join(tmp, "github-env");
  fs.writeFileSync(jobEnv, "");
  const inPr = { ...env, GITHUB_EVENT_NAME: "pull_request", GITHUB_ENV: jobEnv };
  // (a registry of its own on loopback for the two installs that need an answer: a tarball whose bytes are not the lock
  // file's integrity, and a packument without the version an address that echoes a network error's name asks for; npm swaps the host of each address in
  // the lock file for the registry it is given, so no job reaches npm's own, #772)
  // (a server that does not start, or an error that ends the test, never leaves it running: it is killed on exit)
  const registry = spawn(process.execPath, ["-e", `require("http").createServer((q, r) => { if (/\\.tgz$/.test(q.url)) { r.end("not a tarball"); } else { r.setHeader("content-type", "application/json"); r.end(JSON.stringify({ name: "yaml", "dist-tags": { latest: "2.9.1" }, versions: { "2.9.1": { name: "yaml", version: "2.9.1", dist: { tarball: "http://127.0.0.1/yaml.tgz" } } } })); } }).listen(0, "127.0.0.1", function () { console.log(this.address().port); });`], { stdio: ["ignore", "pipe", "ignore"] });
  process.on("exit", () => registry.kill()); // (killed whatever ends the test)
  const port = await new Promise((res, rej) => { registry.stdout.once("data", d => res(String(d).trim())); setTimeout(() => rej(new Error("the test's local registry did not start in 15 s")), 15000).unref(); });
  const regEnv = { [["npm_config_regi", "stry"].join("")]: `http://127.0.0.1:${port}/`, npm_config_fetch_retries: "0" };
  const local = { ...inPr, ...regEnv };
  // (a lock file whose integrity the registry's tarball does not match: twice refused, then a failure that says the mend)
  const wrong = JSON.parse(fs.readFileSync(path.join(pk, "package-lock.json"), "utf8"));
  const first = Object.keys(wrong.packages).find(k => k && !wrong.packages[k].dev);
  wrong.packages[first].integrity = `sha512-${Buffer.alloc(64, 7).toString("base64")}`;
  fs.writeFileSync(path.join(pk, "package-lock.json"), JSON.stringify(wrong, null, 2));
  fs.rmSync(path.join(pk, "node_modules"), { recursive: true, force: true });
  const refused = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env: { ...env, ...regEnv } });
  ok(refused.status === 1 && /EINTEGRITY|integrity/iu.test(refused.stderr) && /runs again/u.test(refused.stderr) && /could not be installed .*twice/u.test(refused.stderr) && told(refused.stderr) && !refused.stderr.split("\n").some(l => /^FAIL: /u.test(l) && (l.includes(path.dirname(copy)) || /n[p]m error|_logs|EINTEGRITY/u.test(l))), "an install that fails is run once more, and a second failure fails, saying the mend", refused.stderr);
  const mismatched = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env: local });
  ok(mismatched.status === 1 && !fs.readFileSync(jobEnv, "utf8"), "in a project's pull request an install that fails for anything but the registry not answering fails, and tells the job nothing", `${mismatched.status} ${mismatched.stdout}${mismatched.stderr}`);
  // (nor where npm's message echoes a network error's name from what the lock file holds, a version here: #714)
  const echoing = JSON.parse(fs.readFileSync(path.join(root, ".packages/package-lock.json"), "utf8")), y = echoing.packages["node_modules/yaml"];
  const odd = `${y.version}-${["ETIME", "DOUT"].join("")}`;
  Object.assign(y, { version: odd, resolved: `https://registry.npmjs.org/yaml/-/yaml-${odd}.tgz`, integrity: `sha512-${Buffer.alloc(64, 9).toString("base64")}` });
  fs.writeFileSync(path.join(pk, "package-lock.json"), JSON.stringify(echoing, null, 2));
  fs.writeFileSync(jobEnv, "");
  const echoed = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env: local });
  registry.kill();
  // (npm's own log, which the failure names, holds what npm printed: the case reaches the echo, and the install reads none of it as a network error)
  const npmLog = /(\S+-debug-\d+\.log)/u.exec(echoed.stderr)?.[1];
  ok(echoed.status === 1 && npmLog && /ETIMEDOUT/u.test(fs.readFileSync(npmLog, "utf8")) && !fs.readFileSync(jobEnv, "utf8"), "and one whose message names a network error only as it echoes the lock file fails too, the job told nothing", `${echoed.status} ${echoed.stdout}${echoed.stderr}`);
  // (a registry that does not answer, in a project's pull request, fails nothing: the job is told, and each check after it says it did not run)
  fs.copyFileSync(path.join(root, ".packages/package-lock.json"), path.join(pk, "package-lock.json"));
  const warned = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs")], { cwd: project, encoding: "utf8", timeout: 300000, env: { ...plainEnv, GITHUB_EVENT_NAME: "pull_request", GITHUB_ENV: jobEnv, [["npm_config_regi", "stry"].join("")]: "http://127.0.0.1:9/", npm_config_fetch_retries: "0", npm_config_cache: path.join(tmp, "empty-cache") } });
  ok(warned.status === 0 && /^::warning::The core's packages could not be installed .*twice/mu.test(warned.stdout) && /Mend: run this job again/u.test(warned.stdout) && /failed too: /u.test(warned.stderr) && !/failed too|127\.0\.0\.1|ECONN/u.test(warned.stdout) && /^CORE_PACKAGES_UNREACHED=1$/mu.test(fs.readFileSync(jobEnv, "utf8")), "in a project's pull request a registry that does not answer twice is a warning, and tells the job's later checks", `${warned.status} ${warned.stdout}${warned.stderr}`);
  // (and PyPI's, for the code scan's engine: pip says in Python's words that it could not connect)
  fs.writeFileSync(jobEnv, "");
  const pipWarned = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs"), "pypi"], { cwd: project, encoding: "utf8", timeout: 300000, env: { ...inPr, [["PIP_INDEX", "_URL"].join("")]: "http://127.0.0.1:9/simple", PIP_TIMEOUT: "2", PIP_RETRIES: "1", PIP_NO_CACHE_DIR: "1" } });
  ok(pipWarned.status === 0 && /^::warning::The core's packages could not be installed from \.packages\/requirements\.txt, twice/mu.test(pipWarned.stdout) && /^CORE_PACKAGES_UNREACHED=1$/mu.test(fs.readFileSync(jobEnv, "utf8")), "and so is PyPI's, for the code scan's engine", `${pipWarned.status} ${pipWarned.stdout}${pipWarned.stderr}`);
  // (but not where pip, once a retry got through, refused a wheel for its hash: a python3 that prints both, on a system
  // that runs a shell script by its name)
  if (process.platform !== "win32") {
    const bin = path.join(tmp, "fake-bin");
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, "python3"), "#!/bin/sh\necho \"WARNING: Retrying (Retry(total=4, connect=None, read=None, redirect=None, status=None)) after connection broken by 'ProtocolError('Connection aborted.')': /x\" >&2\necho 'ERROR: THESE PACKAGES DO NOT MATCH THE HASHES FROM THE REQUIREMENTS FILE.' >&2\nexit 1\n", { mode: 0o755 });
    fs.writeFileSync(jobEnv, "");
    const refusedHash = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs"), "pypi"], { cwd: project, encoding: "utf8", timeout: 60000, env: { ...inPr, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
    ok(refusedHash.status === 1 && !fs.readFileSync(jobEnv, "utf8"), "and a wheel pip refused for its hash after a retry fails, the job told nothing, though a connection broke on the way", `${refusedHash.status} ${refusedHash.stdout}${refusedHash.stderr}`);
  }
  // (what would reach past the core's own files: a shrinkwrap npm reads first, another registry, a link in the install's place)
  const refuses = (what, plant, unplant, said, names = []) => {
    plant();
    const r = spawnSync(process.execPath, [path.join(copy, "scripts/install.mjs"), ...names], { cwd: project, encoding: "utf8", timeout: 300000, env });
    unplant();
    ok(r.status === 1 && said.test(r.stderr) && !r.stderr.includes(tmp) && told(r.stderr), `install.mjs installs nothing where ${what}, saying the mend`, `${r.status} ${r.stdout}${r.stderr}`);
  };
  fs.rmSync(path.join(pk, "node_modules"), { recursive: true, force: true });
  refuses("a shrinkwrap stands beside the lock file", () => fs.copyFileSync(path.join(pk, "package-lock.json"), path.join(pk, "npm-shrinkwrap.json")), () => fs.rmSync(path.join(pk, "npm-shrinkwrap.json")), /npm-shrinkwrap\.json stands beside the lock file/u);
  refuses("a file stands in the parser's folder beside its own", () => fs.writeFileSync(path.join(pp, "npmrc"), "\n"), () => fs.rmSync(path.join(pp, "npmrc")), /parser holds "npmrc" beside the package list/u, ["parser"]);
  refuses("the parser's folder is a link", () => { fs.renameSync(pp, `${pp}-moved`); fs.symlinkSync(`${pp}-moved`, pp, "junction"); }, () => { fs.unlinkSync(pp); fs.renameSync(`${pp}-moved`, pp); }, /parser is a link/u, ["parser"]);
  refuses("a file stands in .packages/ beside the core's own", () => { fs.mkdirSync(path.join(pk, "etc")); fs.writeFileSync(path.join(pk, "etc", "npmrc"), "\n"); }, () => fs.rmSync(path.join(pk, "etc"), { recursive: true }), /holds "etc" beside the package list/u);
  const copyNpmrc = fs.readFileSync(path.join(pk, ".npmrc"), "utf8");
  refuses("the .npmrc holds a line beside the core's own two settings", () => fs.appendFileSync(path.join(pk, ".npmrc"), `"${["regi", "stry"].join("")}" = https://example.invalid/\n`), () => fs.writeFileSync(path.join(pk, ".npmrc"), copyNpmrc), /holds a line beside the core's own two settings/u);
  const copyList = fs.readFileSync(path.join(pk, "package.json"), "utf8");
  refuses("the package list names a dependency of git, before npm runs", () => fs.writeFileSync(path.join(pk, "package.json"), JSON.stringify({ ...JSON.parse(copyList), devDependencies: { x: "git+https://example.invalid/x.git" } })), () => fs.writeFileSync(path.join(pk, "package.json"), copyList), /the spec of "x" is not of npm's registry/u);
  // (a lock key that is an address with a sign-in in it: the refusal prints it with the sign-in cut out (floor rule 1),
  // the sign-in made up, built from pieces as the test runs)
  const keyUser = ["made", "up", "user"].join("-"), keyPass = ["not", "a", "sign", "in"].join("_"), copyLock = fs.readFileSync(path.join(pk, "package-lock.json"), "utf8");
  refuses("the lock file holds a key that is an address with a sign-in, which it prints with the sign-in cut out", () => { const l = JSON.parse(copyLock); fs.writeFileSync(path.join(pk, "package-lock.json"), JSON.stringify({ ...l, packages: { ...l.packages, [`git+https://${keyUser}:${keyPass}@example.invalid/x.git`]: {} } })); }, () => fs.writeFileSync(path.join(pk, "package-lock.json"), copyLock), new RegExp(`^(?![^]*(?:${keyUser}|${keyPass}))[^]*"git\\+https://example\\.invalid/x\\.git": a key that names no folder`, "u"));
  const elsewhere = path.join(tmp, "elsewhere");
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(elsewhere, "kept.txt"), "kept\n");
  refuses("node_modules is a link", () => fs.symlinkSync(elsewhere, path.join(pk, "node_modules"), "junction"), () => fs.unlinkSync(path.join(pk, "node_modules")), /node_modules is a link/u);
  ok(fs.existsSync(path.join(elsewhere, "kept.txt")), "and what the link pointed at is kept");
  const moved = path.join(tmp, "packages-elsewhere");
  // (a stray file in the link's target, which the link's refusal names before anything is read through it)
  refuses(".packages is a link, named before what stands where it points", () => { fs.renameSync(pk, moved); fs.writeFileSync(path.join(moved, "stray"), "\n"); fs.symlinkSync(moved, pk, "junction"); }, () => { fs.unlinkSync(pk); fs.rmSync(path.join(moved, "stray")); fs.renameSync(moved, pk); }, /\.packages is a link(?![^]*"stray")/u);
  ok(!fs.existsSync(path.join(moved, "node_modules")) && fs.existsSync(path.join(pk, "package-lock.json")), "and nothing is installed through it");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

process.exit(failed ? 1 : 0);
