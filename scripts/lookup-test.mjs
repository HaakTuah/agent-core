#!/usr/bin/env node
// Tests of lookup.mjs: each package name invented, each answer of a registry or of GitHub recorded here in the shape
// the registry gives, trimmed to what the lookup reads, and handed to it in place of the network (floor rule 8: no
// live call, no real package). Run: node scripts/lookup-test.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lookUp, newPackages, npmPackages, nugetPackages, run, YOUNG } from "./lookup.mjs";
import { mended } from "./mend.mjs";
import { notDone, STEPS } from "./steps.mjs";

let failed = 0;
const ok = (cond, what) => { if (!cond) { failed++; console.error(`FAIL ${what}`); } };
const NOW = Date.parse("2026-11-16T12:00:00Z");
const ago = (days) => new Date(NOW - days * 86400000).toISOString();

// ---- Recorded answers (npm's registry: a package's whole document; NuGet's: a registration index; GitHub's: a repository)
const npmDoc = (name, created, extra = {}) => ({
  name, time: { created, modified: ago(3), "1.0.0": created, "1.1.0": ago(30) },
  versions: { "1.1.0": { name, _npmUser: { name: "invented-publisher" }, repository: { type: "git", url: `git+https://github.com/invented-org/${name}.git` }, dist: { attestations: { provenance: { predicateType: "https://slsa.dev/provenance/v1" } } }, ...extra } },
});
const answers = {
  "https://registry.npmjs.org/tidy-moss-format": { status: 200, json: npmDoc("tidy-moss-format", ago(800)) },
  "https://registry.npmjs.org/tidy-moss-helper": { status: 200, json: npmDoc("tidy-moss-helper", ago(400)) },
  "https://registry.npmjs.org/brand-new-moss": { status: 200, json: npmDoc("brand-new-moss", ago(12)) },
  "https://registry.npmjs.org/@invented%2Fscoped-moss": { status: 200, json: npmDoc("@invented/scoped-moss", ago(200)) },
  "https://registry.npmjs.org/never-published-moss": { status: 404 },
  "https://registry.npmjs.org/taken-off-moss": { status: 200, json: { name: "taken-off-moss", time: { created: ago(900), unpublished: { time: ago(5) } } } },
  "https://registry.npmjs.org/flaky-moss": { status: 503 },
  "https://api.github.com/repos/invented-org/tidy-moss-format": { status: 200, json: { archived: true } },
  "https://raw.githubusercontent.com/invented-org/tidy-moss-format/HEAD/package.json": { status: 200, json: { name: "tidy-moss-format" } },
  "https://api.nuget.org/v3/registration5-gz-semver2/invented.moss.core/index.json": { status: 200, json: { items: [
    { "@id": "https://api.nuget.org/v3/registration5-gz-semver2/invented.moss.core/page/0.1.0/1.0.0.json", lower: "0.1.0", upper: "1.0.0" },
    { items: [{ catalogEntry: { version: "2.0.0", published: ago(20), authors: "Invented Authors", projectUrl: "https://github.com/invented-org/moss-core" } }] },
  ] } },
  "https://api.nuget.org/v3/registration5-gz-semver2/invented.moss.core/page/0.1.0/1.0.0.json": { status: 200, json: { items: [
    { catalogEntry: { version: "0.1.0", published: "1900-01-01T00:00:00+00:00" } },
    { catalogEntry: { version: "1.0.0", published: ago(500) } },
  ] } },
  "https://api.nuget.org/v3/registration5-gz-semver2/invented.moss.young/index.json": { status: 200, json: { items: [{ items: [{ catalogEntry: { version: "1.0.0", published: ago(40) } }] }] } },
  "https://api.nuget.org/v3/registration5-gz-semver2/invented.moss.astray/index.json": { status: 200, json: { items: [{ "@id": "https://elsewhere.invalid/page.json", lower: "1.0.0", upper: "2.0.0" }] } },
  "https://api.github.com/repos/invented-org/moss-core": { status: 200, json: { archived: false } },
};
const asked = [];
const get = async (url) => { asked.push(url); return answers[url] ?? { status: 404 }; };
const pkg = (name, extra = {}) => ({ name, version: "1.1.0", path: `node_modules/${name}`, direct: true, brings: 0, lockPath: "package-lock.json", ...extra });

// ---- What a lock file holds
const tgz = (name, v = "1.1.0") => `https://registry.npmjs.org/${name}/-/${name.slice(name.indexOf("/") + 1)}-${v}.tgz`;
const lock = { lockfileVersion: 3, packages: {
  "": { dependencies: { "tidy-moss-format": "1.1.0", "moss-alias": "npm:tidy-moss-helper@1.1.0", local: "file:local" } },
  "node_modules/tidy-moss-format": { version: "1.1.0", resolved: tgz("tidy-moss-format"), dependencies: { "brand-new-moss": "1.1.0" } },
  "node_modules/moss-alias": { version: "1.1.0", resolved: tgz("tidy-moss-helper") },
  "node_modules/brand-new-moss": { version: "1.1.0", resolved: tgz("brand-new-moss"), dependencies: { "@invented/scoped-moss": "1.1.0" } },
  "node_modules/@invented/scoped-moss": { version: "1.1.0", resolved: tgz("@invented/scoped-moss") },
  "node_modules/from-git": { version: "1.0.0", resolved: "git+https://example.invalid/from-git.git#0123456" },
  "node_modules/local": { link: true, resolved: "local" },
  local: { version: "1.0.0" },
} };
const read = npmPackages(JSON.stringify(lock), "package-lock.json");
const by = (name) => read.find((p) => p.name === name);
ok(read.length === 4, `npm: the four packages npm's registry gives are read, the one from git and the link left out (${read.map((p) => p.name)})`);
ok(by("tidy-moss-helper")?.direct === true, "npm: an alias is read by the name its registry address gives, and counts as named by the project");
ok(by("tidy-moss-format")?.direct === true && by("tidy-moss-format")?.brings === 2, "npm: a package the project names brings what its dependencies bring, deep too");
ok(by("brand-new-moss")?.direct === false && by("brand-new-moss")?.brings === 1 && by("@invented/scoped-moss")?.by.join() === "tidy-moss-format", "npm: a package another brings is not named by the project, and names what does");

const nugetLock = JSON.stringify({ version: 1, dependencies: { "net8.0": {
  "Invented.Moss.Core": { type: "Direct", requested: "[2.0.0, )", resolved: "2.0.0", contentHash: "aGFzaA==", dependencies: { "invented.moss.young": "1.0.0" } },
  "Invented.Moss.Young": { type: "Transitive", resolved: "1.0.0", contentHash: "aGFzaA==" },
  "Own.Project": { type: "Project" },
} } });
const nread = nugetPackages(nugetLock, "src/packages.lock.json");
ok(nread.length === 2 && nread.find((p) => p.name === "Invented.Moss.Core")?.brings === 1 && nread.find((p) => p.name === "Invented.Moss.Young")?.direct === false && nread.find((p) => p.name === "Invented.Moss.Young")?.by.join() === "Invented.Moss.Core", `NuGet: its packages read, a dependency matched in any case, the project's own left out (${JSON.stringify(nread)})`);

// ---- What is new
const fresh = newPackages([["package-lock.json", read]], [[{ name: "tidy-moss-helper" }], [{ name: "@invented/scoped-moss" }]]);
ok(fresh.map((p) => p.name).sort().join() === "brand-new-moss,tidy-moss-format" && fresh.every((p) => p.lockPath === "package-lock.json"), "a package any lock file of the base held, under any version, is not new");
ok(newPackages([["a/package-lock.json", [pkg("x", { direct: false })]], ["b/package-lock.json", [pkg("x")]]], []).length === 1, "a package new in two lock files is looked up once, where the project names it");
ok(newPackages([["a/package-lock.json", [pkg("x")]], ["b/package-lock.json", [pkg("x", { direct: false })]]], [])[0]?.lockPath === "a/package-lock.json", "and once named by the project, it stays so where another lock file only brings it");
ok(newPackages([["packages.lock.json", [pkg("Invented.Moss.Core")]]], [[{ name: "invented.moss.core" }]], true).length === 0, "NuGet: an id the base held in another case is not new");
ok(newPackages([["packages.lock.json", [pkg("Invented.Moss.Core")]]], [[{ name: "invented.moss.core" }]]).length === 1, "npm: a name is held by its exact spelling");

// ---- The lookup
const one = async (p, nuget = false) => lookUp([p], { get, now: NOW, nuget });
let r = await one(pkg("tidy-moss-format", { brings: 2 }));
ok(r.failures.length === 0 && r.reports.length === 1, `an old package that exists passes (${JSON.stringify(r)})`);
const report = r.reports[0] ?? "";
for (const fact of ["named by the project", `first published ${ago(800).slice(0, 10)} (800 days ago)`, `last release ${ago(30).slice(0, 10)}`, "repository github.com/invented-org/tidy-moss-format, archived, naming the package back", "published by invented-publisher", "brings 2 packages with it", "provenance: yes"])
  ok(report.includes(fact), `the report says "${fact}" (${report})`);
r = await one(pkg("never-published-moss"));
ok(r.failures.length === 1 && /has no such package/u.test(r.failures[0]) && mended(`FAIL: ${r.failures[0]}`), `a name the registry does not know fails, saying the mend (${r.failures})`);
r = await one(pkg("taken-off-moss"));
ok(r.failures.length === 1 && /taken off the registry/u.test(r.failures[0]), `a package whose versions were taken off fails (${r.failures})`);
const comes = new Date(NOW + (YOUNG - 12) * 86400000).toISOString().slice(0, 10);
r = await one(pkg("brand-new-moss"));
ok(r.failures.length === 1 && r.failures[0].includes(`12 days ago, under the ${YOUNG} days`) && r.failures[0].includes(`wait until ${comes} to add this one`) && mended(`FAIL: ${r.failures[0]}`), `a package the project names, first published under ${YOUNG} days ago, fails, saying the day it may come (${r.failures})`);
asked.length = 0;
r = await one(pkg("brand-new-moss", { direct: false, by: ["tidy-moss-format"] }));
ok(r.failures.length === 1 && r.failures[0].includes(`hold the change that brings it (to tidy-moss-format) until ${comes}, or take a version of tidy-moss-format that does not bring it`) && mended(`FAIL: ${r.failures[0]}`), `one that another brings fails too, naming what brings it (${r.failures})`);
ok(r.reports.length === 1 && r.reports[0].includes("brought by tidy-moss-format") && !asked.some((u) => u.includes("brand-new-moss") && u.includes("github")), "a young package is still printed for the review, and GitHub is asked only of a package the project names");
r = await lookUp([pkg("tidy-moss-format")], { get, now: Date.parse(ago(800)) + YOUNG * 86400000 + (Date.parse(ago(0)) - NOW) });
ok(r.failures.length === 0, `a package first published ${YOUNG} days ago to the day passes (${r.failures})`);
for (const [what, json] of [["no versions", { time: { created: ago(800) } }], ["no time and no versions", { time: null }]]) {
  r = await lookUp([pkg("tidy-moss-format")], { get: async () => ({ status: 200, json }), now: NOW });
  ok(r.failures.length === 1 && /taken off the registry/u.test(r.failures[0]), `an answer with ${what} is a package taken off (${r.failures})`);
}
r = await one(pkg("bad/name/../x"));
ok(r.failures.length === 1 && /not one npm's registry gives/u.test(r.failures[0]) && !asked.some((u) => u.includes("bad")), "a name npm's registry never gives is not asked of it");
r = await one(pkg("@invented/scoped-moss"));
ok(r.failures.length === 0 && asked.includes("https://registry.npmjs.org/@invented%2Fscoped-moss"), "a scoped package is asked by its scope and name");
r = await one(pkg("flaky-moss"));
ok(r.failures.length === 1 && /could not be read \(it answered 503\)/u.test(r.failures[0]) && mended(`FAIL: ${r.failures[0]}`), `a registry that does not answer fails the lookup, saying the mend (${r.failures})`);
const thrown = await lookUp([pkg("tidy-moss-format")], { get: async () => { throw new Error("connect timed out"); }, now: NOW });
ok(thrown.failures.length === 1 && /connect timed out/u.test(thrown.failures[0]), "a network that fails fails the lookup");
asked.length = 0;
r = await lookUp(Array.from({ length: 30 }, () => pkg("tidy-moss-format")), { get, now: NOW });
ok(asked.filter((u) => u.startsWith("https://api.github.com/")).length === 20 && r.reports.filter((l) => l.includes("GitHub not asked: past the 20")).length === 10, "GitHub is asked of 20 packages at most, so a run never reaches its hourly limit, and the rest say so");

r = await one(pkg("Invented.Moss.Core", { version: "2.0.0" }), true);
ok(r.failures.length === 0 && r.reports[0]?.includes(`first published ${ago(500).slice(0, 10)}`) && r.reports[0].includes(`last release ${ago(20).slice(0, 10)}`) && r.reports[0].includes("github.com/invented-org/moss-core, not archived") && r.reports[0].includes("Invented Authors (as the package writes its authors)"), `NuGet: a page is fetched where the index leaves it out, and an unlisted version's date of 1900 is no date (${JSON.stringify(r)})`);
r = await one(pkg("invented.moss.young", { version: "1.0.0" }), true);
ok(r.failures.length === 1 && /40 days ago/u.test(r.failures[0]), `NuGet: a young package fails (${r.failures})`);
for (const [what, answer] of [["no pages", { status: 200, json: { items: [] } }], ["a page that does not answer", { status: 200, json: { items: [{ "@id": "https://api.nuget.org/v3/registration5-gz-semver2/invented.moss.gone/page/1.0.0/2.0.0.json", lower: "1.0.0", upper: "2.0.0" }] } }]]) {
  r = await lookUp([pkg("Invented.Moss.Gone")], { get: async (url) => (url.endsWith("index.json") ? answer : { status: 500 }), now: NOW, nuget: true });
  ok(r.failures.length === 1 && /could not be read/u.test(r.failures[0]), `NuGet: an index with ${what} fails the lookup (${r.failures})`);
}
r = await one(pkg("Invented.Moss.Absent"), true);
ok(r.failures.length === 1 && /NuGet registry has no such package/u.test(r.failures[0]), "NuGet: an id the registry does not know fails");
r = await one(pkg("Invented.Moss.Astray"), true);
ok(r.failures.length === 1 && /outside the registry/u.test(r.failures[0]), "NuGet: a page the index places outside the registry is not fetched");

// ---- The check on a project
const tmp = mkdtempSync(join(tmpdir(), "lookup-test-"));
const git = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: tmp, encoding: "utf8" }).trim();
try {
  git("init", "-q");
  writeFileSync(join(tmp, "licences.json"), JSON.stringify({ lockfiles: ["package-lock.json"], ships: [] }));
  writeFileSync(join(tmp, "package.json"), "{}");
  const write = (packages) => writeFileSync(join(tmp, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, ...packages } }));
  write({ "node_modules/tidy-moss-format": { version: "1.1.0", resolved: tgz("tidy-moss-format") } });
  git("add", "-A"); git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD");
  const config = join(tmp, "licences.json");
  r = await run(config, { root: tmp, base: null, get, now: NOW });
  ok(r.code === 0 && /nothing looked up/u.test(r.lines.join("\n")), "with no base, nothing is new and nothing is asked");
  asked.length = 0;
  r = await run(config, { root: tmp, base, get, now: NOW });
  ok(r.code === 0 && asked.length === 0 && /ok {3}0 new packages/u.test(r.lines.join("\n")), `what the base held is not looked up (${r.lines})`);
  write({ "node_modules/tidy-moss-format": { version: "1.2.0", resolved: tgz("tidy-moss-format", "1.2.0") }, "node_modules/never-published-moss": { version: "1.0.0", resolved: tgz("never-published-moss", "1.0.0") } });
  r = await run(config, { root: tmp, base, get, now: NOW });
  const out = r.lines.join("\n");
  ok(r.code === 1 && mended(out) && /^FAIL: package-lock\.json: never-published-moss@1\.0\.0/mu.test(out) && !/tidy-moss-format/u.test(out) && /1 of 1 new package fail/u.test(out), `an update passes unlooked, and a new name the registry lacks fails, saying the mend (${r.lines})`);
  writeFileSync(join(tmp, "package-lock.json"), "{ not json");
  r = await run(config, { root: tmp, base, get, now: NOW });
  ok(r.code === 1 && mended(r.lines.join("\n")), `a lock file that cannot be read fails, saying the mend (${r.lines})`);
  // The sync's step, on a workflow of the project's own: each lookup is asked for apart, so one does not hide the other.
  const step = STEPS.filter((x) => x.lead === "16 November 2026, a new package looked up");
  mkdirSync(join(tmp, ".github/workflows"), { recursive: true });
  const own = (...lines) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${lines.map((l) => `      - run: ${l}\n`).join("")}`);
  own("node core/scripts/exact-versions.mjs c.json", "node core/scripts/nuget.mjs c.json", "node core/scripts/lookup.mjs c.json --nuget");
  let missed = notDone(tmp, step);
  ok(missed.length === 1 && /runs `node core\/scripts\/lookup\.mjs <the licence check's config>`/u.test(missed[0].mend) && !/--nuget`/u.test(missed[0].mend), `the NuGet lookup does not stand in for the npm one (${missed.map((m) => m.mend)})`);
  own("node core/scripts/exact-versions.mjs c.json", "node core/scripts/nuget-fetch.mjs c.json", "node core/scripts/lookup.mjs c.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /--nuget`/u.test(missed[0].mend), `nor the npm lookup for the NuGet one (${missed.map((m) => m.mend)})`);
  own("node core/scripts/exact-versions.mjs c.json", "node core/scripts/nuget.mjs c.json", "node core/scripts/lookup.mjs c.json", "node core/scripts/lookup.mjs c.json --nuget");
  ok(notDone(tmp, step).length === 0, "and with both, the step is done");
} finally { rmSync(tmp, { recursive: true, force: true }); }

console.log(failed ? `${failed} failing` : "ok   lookup.mjs");
process.exit(failed ? 1 : 0);
