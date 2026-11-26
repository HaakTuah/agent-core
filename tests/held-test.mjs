#!/usr/bin/env node
// Tests of held.mjs: each package name invented, each answer of a registry or of GitHub recorded here in the shape the
// registry gives, trimmed to what it reads, and handed to it in place of the network (floor rule 8: no live call, no
// real package). Run: node tests/held-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { GITHUB_MOST } from "../scripts/lookup.mjs";
import { STALE, heldPackages, lookAgain, report } from "../scripts/held.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { if (!cond) { failed++; console.error(`FAIL ${what}${detail ? `\n     ${String(detail).slice(0, 1500)}` : ""}`); } };
const NOW = Date.parse("2026-11-17T12:00:00Z");
const ago = (days) => new Date(NOW - days * 86400000).toISOString();

// ---- Recorded answers
const npmDoc = (name, last, repo = `invented-org/${name}`) => ({
  name, time: { created: ago(2000), modified: ago(3), "1.0.0": ago(2000), "1.1.0": last },
  versions: { "1.1.0": { name, repository: { type: "git", url: `git+https://github.com/${repo}.git` } } },
});
const answers = {
  "https://registry.npmjs.org/kept-moss": { status: 200, json: npmDoc("kept-moss", ago(30)) },
  "https://registry.npmjs.org/old-moss": { status: 200, json: npmDoc("old-moss", ago(STALE + 40)) },
  "https://registry.npmjs.org/deep-old-moss": { status: 200, json: npmDoc("deep-old-moss", ago(STALE + 1)) },
  "https://registry.npmjs.org/shut-moss": { status: 200, json: npmDoc("shut-moss", ago(60)) },
  "https://registry.npmjs.org/gone-moss": { status: 404 },
  "https://registry.npmjs.org/flaky-moss": { status: 503 },
  "https://api.github.com/repos/invented-org/kept-moss": { status: 200, json: { archived: false } },
  "https://api.github.com/repos/invented-org/shut-moss": { status: 200, json: { archived: true } },
  "https://api.nuget.org/v3/registration5-gz-semver2/invented.moss.old/index.json": { status: 200, json: { items: [{ items: [{ catalogEntry: { version: "1.0.0", published: ago(STALE + 100) } }] }] } },
  "https://api.nuget.org/v3/registration5-gz-semver2/invented.moss.kept/index.json": { status: 200, json: { items: [{ items: [{ catalogEntry: { version: "2.0.0", published: ago(10) } }] }] } },
};
const asked = [];
const get = async (url) => { asked.push(url); return answers[url] ?? { status: 404 }; };
const pkg = (name, extra = {}) => ({ name, version: "1.1.0", path: `node_modules/${name}`, direct: true, lockPath: "package-lock.json", nuget: false, sources: 0, ...extra });

// ---- The lookup again, on recorded answers
let r = await lookAgain([pkg("kept-moss"), pkg("old-moss"), pkg("deep-old-moss", { direct: false, by: ["kept-moss"] }), pkg("shut-moss"), pkg("gone-moss"), pkg("flaky-moss"), pkg("from-git", { from: "a git address" })], { get, now: NOW });
const line = (name) => r.stale.find((l) => l.includes(`: ${name}@`)) ?? "";
ok(/no release since \d{4}-\d\d-\d\d, over 365 days ago$/u.test(line("old-moss")), "a package with no release within the year is stale", r.stale);
ok(/deep-old-moss@1\.1\.0: no release since .*, brought by kept-moss$/u.test(line("deep-old-moss")), "one another brings is read too, deep in the tree, naming what brings it", r.stale);
ok(/shut-moss@1\.1\.0: its repository, github\.com\/invented-org\/shut-moss, is archived$/u.test(line("shut-moss")), "one whose repository is archived is stale", r.stale);
ok(/gone-moss@1\.1\.0: its registry no longer has it/u.test(line("gone-moss")), "one its registry no longer knows is stale", r.stale);
ok(r.stale.length === 4 && !line("kept-moss") && !asked.some((u) => u.includes("from-git")), "one released this year, its repository not archived, is not, and one from elsewhere is not asked", r.stale);
ok(r.unread.length === 1 && /flaky-moss@1\.1\.0: the registry of npm could not be read \(it answered 503\)/u.test(r.unread[0]) && r.asked === 6, "a registry that does not answer leaves the package unread, never stale", r.unread);
const body = report(r);
ok(body.startsWith("Packages the project holds that have gone stale") && body.includes("- package-lock.json: old-moss@1.1.0:") && /Left unread this time \(1\)/u.test(body) && body.includes("core/tasks/updates.md"), "the report lists each as a task, then what was left unread", body);
ok(report({ stale: [], unread: [], asked: 3, notOnGitHub: 0 }) === null, "with nothing stale, there is no report");

// a held npm version gone from the registry, while others stand, is stale; GitHub that does not answer leaves it unread
answers["https://registry.npmjs.org/moved-on-moss"] = { status: 200, json: { ...npmDoc("moved-on-moss", ago(5)), versions: { "2.0.0": { name: "moved-on-moss" } } } };
answers["https://registry.npmjs.org/quiet-moss"] = { status: 200, json: npmDoc("quiet-moss", ago(20)) };
answers["https://api.github.com/repos/invented-org/quiet-moss"] = { status: 503 };
r = await lookAgain([pkg("moved-on-moss"), pkg("quiet-moss")], { get, now: NOW });
ok(r.stale.length === 1 && /moved-on-moss@1\.1\.0: its registry no longer has this version/u.test(r.stale[0]), "a held version its registry no longer has is stale, though newer ones stand", r.stale);
ok(r.unread.length === 1 && /quiet-moss@1\.1\.0: GitHub did not answer whether its repository/u.test(r.unread[0]), "GitHub not answering leaves the package unread, never taken as not archived", r.unread);
// a version that is an address with a sign-in in it, its "@" past where a printed value is cut short: the sign-in is
// cut out first, so none of it is printed (floor rule 1); the sign-in made up, built from pieces as the test runs
const user = ["made", "up"].join("-"), pass = [["not", "a", "pass"].join("_"), "x".repeat(240)].join("-");
r = await lookAgain([pkg("flaky-moss", { version: `git+https://${user}:${pass}@example.invalid/flaky-moss.git` })], { get, now: NOW });
ok(r.unread.length === 1 && r.unread[0].includes("flaky-moss@git+https://example.invalid/flaky-moss.git") && !r.unread[0].includes(user) && !r.unread[0].includes(pass.slice(0, 12)),
  "a version that is an address with a long sign-in is printed with the sign-in cut out", r.unread.join(" | ").replaceAll(user, "<user>").replaceAll(pass.slice(0, 12), "<pass>"));

// GitHub, asked of at most GITHUB_MOST named packages, the oldest last release first
asked.length = 0;
const many = Array.from({ length: GITHUB_MOST + 3 }, (_, i) => `many-moss-${String(i).padStart(2, "0")}`);
for (const [i, name] of many.entries()) answers[`https://registry.npmjs.org/${name}`] = { status: 200, json: npmDoc(name, ago(300 - i)) };
r = await lookAgain(many.map((name) => pkg(name)), { get, now: NOW });
// (each asked repository by its path on GitHub's API, the host read whole)
const onGitHub = new Set(asked.map((u) => new URL(u)).filter((u) => u.host === "api.github.com").map((u) => u.pathname));
ok(onGitHub.size === GITHUB_MOST && onGitHub.has("/repos/invented-org/many-moss-00") && !onGitHub.has(`/repos/invented-org/${many.at(-1)}`) && r.notOnGitHub === 3, `GitHub is asked of ${GITHUB_MOST} named packages at most, the oldest last release first`, onGitHub.size);

// past its time, nothing more is asked, and what was not asked is said
asked.length = 0;
r = await lookAgain([pkg("old-moss"), pkg("kept-moss")], { get, now: NOW, until: 0 });
ok(asked.length === 0 && r.stale.length === 0 && r.unread.length === 2 && r.unread.every((u) => /not asked, past the 120 seconds/u.test(u)), "past its time it asks nothing more, and says what it did not ask", r.unread);

// NuGet
r = await lookAgain([pkg("Invented.Moss.Old", { version: "1.0.0", nuget: true, lockPath: "src/packages.lock.json" }), pkg("Invented.Moss.Kept", { version: "2.0.0", nuget: true, lockPath: "src/packages.lock.json" }), pkg("Invented.Moss.Private", { version: "1.0.0", nuget: true, sources: 1, lockPath: "src/packages.lock.json" })], { get, now: NOW });
ok(r.stale.length === 1 && /^src\/packages\.lock\.json: Invented\.Moss\.Old@1\.0\.0: no release since/u.test(r.stale[0]) && r.unread.length === 0, "NuGet: a stale package is found, and one from a source the config names is not judged", r);

// ---- What a project holds: every lock file the config names, each package once
const dir = scratchDir("held-test-");
try {
  execFileSync("git", ["init", "-q"], { cwd: dir });
  const lock = (packages) => JSON.stringify({ lockfileVersion: 3, packages: { "": { dependencies: Object.fromEntries(Object.keys(packages).filter((k) => !k.includes("/node_modules/")).map((k) => [k.slice(13), "1.1.0"])) }, ...packages } });
  const tgz = (name) => `https://registry.npmjs.org/${name}/-/${name}-1.1.0.tgz`;
  writeFileSync(join(dir, "package-lock.json"), lock({ "node_modules/kept-moss": { version: "1.1.0", resolved: tgz("kept-moss") }, "node_modules/old-moss": { version: "1.1.0", resolved: tgz("old-moss") } }));
  mkdirSync(join(dir, "tools"));
  writeFileSync(join(dir, "tools/package-lock.json"), lock({ "node_modules/old-moss": { version: "1.1.0", resolved: tgz("old-moss") } }));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/packages.lock.json"), JSON.stringify({ version: 1, dependencies: { net8: { "Invented.Moss.Old": { type: "Direct", requested: "[1.0.0, )", resolved: "1.0.0", contentHash: "abc=" } }, net9: { "Invented.Moss.Old": { type: "Direct", requested: "[2.0.0, )", resolved: "2.0.0", contentHash: "def=" } } } }));
  writeFileSync(join(dir, "licences.json"), JSON.stringify({ lockfiles: ["package-lock.json", "tools/package-lock.json"], ships: [], nuget: { ships: ["src/packages.lock.json"], tools: [] } }));
  writeFileSync(join(dir, "package.json"), "{}");
  writeFileSync(join(dir, "tools/package.json"), "{}");
  const here = process.cwd();
  process.chdir(dir);
  let held;
  try { held = heldPackages(dir, [["licences.json", false], ["licences.json", true]]); } finally { process.chdir(here); }
  const names = held.packages.map((p) => `${p.nuget ? "nuget:" : ""}${p.name}`).sort();
  const nugetVersions = held.packages.filter((p) => p.nuget).map((p) => p.version).sort().join();
  ok(JSON.stringify([...new Set(names)]) === JSON.stringify(["kept-moss", "nuget:Invented.Moss.Old", "old-moss"]) && nugetVersions === "1.0.0,2.0.0" && held.unread.length === 0, "every lock file the config names is read, npm's and NuGet's, each package once for each version a framework locks", JSON.stringify(held));
  process.chdir(dir);
  try { held = heldPackages(dir, [["absent.json", false]]); } finally { process.chdir(here); }
  ok(held.packages.length === 0 && held.unread.length === 1 && held.unread[0].startsWith("absent.json:"), "a config that cannot be read is said, never taken as holding nothing", JSON.stringify(held));
  // (a config the project makes a link out of itself is never opened, and nothing of what it holds is printed)
  const outside = scratchDir("held-outside-");
  writeFileSync(join(outside, "secret.json"), JSON.stringify({ lockfiles: ["invented-outside-path"] }));
  symlinkSync(join(outside, "secret.json"), join(dir, "linked.json"));
  process.chdir(dir);
  try { held = heldPackages(dir, [["linked.json", false]]); } finally { process.chdir(here); rmSync(outside, { recursive: true, force: true }); }
  ok(held.packages.length === 0 && held.unread.length === 1 && /leads out of the project/u.test(held.unread[0]) && !held.unread[0].includes("invented-outside-path"), "a config that links out of the project is not opened, and nothing of it printed", JSON.stringify(held));
} finally { rmSync(dir, { recursive: true, force: true }); }

// ---- A config the workflows name only when they run is said unread, and the issue left as it stands (exit 3)
{
  const at = scratchDir("held-unnamed-");
  try {
    execFileSync("git", ["init", "-q"], { cwd: at });
    mkdirSync(join(at, ".github/workflows"), { recursive: true });
    writeFileSync(join(at, ".github/workflows/licences.yml"), "name: l\non:\n  pull_request:\njobs:\n  l:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node core/scripts/licences.mjs ${{ vars.LICENCE_CONFIG }}\n");
    mkdirSync(join(at, "checks"));
    writeFileSync(join(at, "checks/licences.json"), JSON.stringify({ lockfiles: [], ships: [] }));
    const run = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/held.mjs", import.meta.url)), "--issue"], { cwd: at, encoding: "utf8" });
    ok(run.status === 3 && run.stdout.trim() === "", "a config named only when the workflow runs is not stood in for by the kit's: the issue is left as it stands", `${run.status} ${run.stdout} ${run.stderr}`);
  } finally { rmSync(at, { recursive: true, force: true }); }
}

// ---- Each sync runs it among its reports (#1095), as the sync runs one: from the project's root, no option; a project
// whose config holds no lock file is asked of no registry, and the run says so and fails nothing
{
  const at = scratchDir("held-sync-");
  try {
    execFileSync("git", ["init", "-q"], { cwd: at });
    mkdirSync(join(at, "checks"));
    writeFileSync(join(at, "checks/licences.json"), JSON.stringify({ lockfiles: [], ships: [] }));
    const run = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/held.mjs", import.meta.url))], { cwd: at, encoding: "utf8" });
    const listed = /\["host\.mjs"\], \["held\.mjs"\]/.test(readFileSync(new URL("../scripts/sync.mjs", import.meta.url), "utf8"));
    ok(listed && run.status === 0 && /^ok   none of the 0 packages asked has gone stale/.test(run.stdout), "the sync runs held.mjs among its reports, and with nothing held it says so and fails nothing", `${listed} ${run.status} ${run.stdout} ${run.stderr}`);
  } finally { rmSync(at, { recursive: true, force: true }); }
}

// ---- Its options: a wrong one fails, saying the mend
const wrong = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/held.mjs", import.meta.url)), "--wrong"], { encoding: "utf8" });
ok(wrong.status === 2 && mended(wrong.stderr), "a wrong option fails, saying the mend", wrong.stderr);

if (failed) { console.error(`${failed} failing`); process.exit(1); }
console.log("ok   held.mjs");
