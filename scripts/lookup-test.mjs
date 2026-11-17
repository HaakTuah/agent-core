#!/usr/bin/env node
// Tests of lookup.mjs: each package name invented, each answer of a registry or of GitHub recorded here in the shape
// the registry gives, trimmed to what the lookup reads, and handed to it in place of the network (floor rule 8: no
// live call, no real package). Run: node scripts/lookup-test.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { lookUp, newPackages, npmPackages, nugetPackages, run, YOUNG } from "./lookup.mjs";
import { CORE } from "./core-address.mjs";
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
  "https://api.nuget.org/v3/registration5-gz-semver2/invented.moss.lines/index.json": { status: 200, json: { items: [
    { items: [{ catalogEntry: { version: "1.0.0", published: ago(10) } }] },
    { items: [{ catalogEntry: { version: "2.0.0", published: ago(700), authors: "Old Line" } }] },
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
  "": { dependencies: { "tidy-moss-format": "1.1.0", "moss-alias": "npm:tidy-moss-helper@1.1.0", local: "file:local" }, devDependencies: { "dev-moss": "1.0.0" } },
  "node_modules/dev-moss": { version: "1.0.0", resolved: tgz("dev-moss", "1.0.0"), devDependencies: { "brand-new-moss": "1.1.0" } },
  "node_modules/tidy-moss-format": { version: "1.1.0", resolved: tgz("tidy-moss-format"), dependencies: { "brand-new-moss": "1.1.0" } },
  "node_modules/moss-alias": { version: "1.1.0", resolved: tgz("tidy-moss-helper") },
  "node_modules/brand-new-moss": { version: "1.1.0", resolved: tgz("brand-new-moss"), dependencies: { "@invented/scoped-moss": "1.1.0" } },
  "node_modules/@invented/scoped-moss": { version: "1.1.0", resolved: tgz("@invented/scoped-moss") },
  "node_modules/from-git": { version: "1.0.0", resolved: "git+https://example.invalid/from-git.git#0123456" },
  "node_modules/local": { link: true, resolved: "local" },
  local: { version: "1.0.0" },
} };
const read = npmPackages(JSON.stringify(lock), "package-lock.json");
for (const resolved of [null, ""]) {
  const blank = npmPackages(JSON.stringify({ lockfileVersion: 3, packages: { "": { dependencies: { "brand-new-moss": "1.1.0" } }, "node_modules/brand-new-moss": { version: "1.1.0", resolved } } }), "package-lock.json");
  ok(blank.length === 1 && !blank[0].from && blank[0].name === "brand-new-moss", `npm: an entry whose "resolved" is ${JSON.stringify(resolved)}, which npm fetches from the registry, is the registry's (${JSON.stringify(blank)})`);
}
const omitted = npmPackages(JSON.stringify({ lockfileVersion: 3, packages: { "": { dependencies: { "brand-new-moss": "1.1.0", "moss-alias": "npm:tidy-moss-helper@1.1.0" } }, "node_modules/brand-new-moss": { version: "1.1.0", integrity: "sha512-AAAA" }, "node_modules/moss-alias": { name: "tidy-moss-helper", version: "1.1.0", integrity: "sha512-AAAA" } } }), "package-lock.json");
ok(omitted.length === 2 && omitted.every((p) => !p.from) && omitted.map((p) => p.name).sort().join() === "brand-new-moss,tidy-moss-helper", `npm: a lock file written with the registry's address left out reads each entry as the registry's, by its name or its alias's real name (${JSON.stringify(omitted)})`);
const by = (name) => read.find((p) => p.name === name);
ok(by("dev-moss")?.direct === true && by("dev-moss")?.brings === 0, "npm: a development dependency of the project's own is named by it, and an installed package's own development dependencies bring nothing");
ok(read.length === 6 && by("from-git")?.from === "a git address" && read.filter((p) => p.from).length === 1, `npm: the five packages npm's registry gives are read, and the one from git marked so, the link left out (${read.map((p) => p.name)})`);
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

// A long chain of packages each the project names, as a lock file a pull request leaves alone: read in a bounded time,
// with no set kept for every package (it once ran out of memory), and what each brings read only where it is asked.
{
  const many = 4000, chain = { "": { dependencies: Object.fromEntries(Array.from({ length: many }, (_, i) => [`chain-moss-${i}`, "1.0.0"])) } };
  for (let i = 0; i < many; i++) chain[`node_modules/chain-moss-${i}`] = { version: "1.0.0", resolved: tgz(`chain-moss-${i}`), ...(i + 1 < many ? { dependencies: { [`chain-moss-${i + 1}`]: "1.0.0" } } : {}) };
  const began = Date.now(), long = npmPackages(JSON.stringify({ lockfileVersion: 3, packages: chain }), "package-lock.json");
  const none = newPackages([["package-lock.json", long]], [long.map((p) => ({ name: p.name }))]);
  ok(long.length === many && none.length === 0 && Date.now() - began < 5000, `a lock file of ${many} packages in a chain, left alone, is read in a bounded time (${Date.now() - began} ms)`);
  ok(long[many - 2].brings === 1 && long[many - 2].by.length === 0 && long[0].brings === many - 1, "and what one brings is read where it is asked");
}

// The same for NuGet: a long chain of packages the project names, left alone, read in a bounded time.
{
  const many = 3000, deps = {};
  for (let i = 0; i < many; i++) deps[`Invented.Chain.${i}`] = { type: "Direct", requested: "[1.0.0, )", resolved: "1.0.0", contentHash: "AAAA", ...(i + 1 < many ? { dependencies: { [`Invented.Chain.${i + 1}`]: "1.0.0" } } : {}) };
  const began = Date.now(), long = nugetPackages(JSON.stringify({ version: 1, dependencies: { "net8.0": deps } }), "packages.lock.json");
  const none = newPackages([["packages.lock.json", long]], [long.map((p) => ({ name: p.name }))], true);
  ok(long.length === many && none.length === 0 && Date.now() - began < 5000, `NuGet: a lock file of ${many} packages in a chain, left alone, is read in a bounded time (${Date.now() - began} ms)`);
  ok(long[0].brings === many - 1 && long[many - 1].by.length === many - 1, "and what one brings, and what brings it, are read where they are asked");
}

// ---- What is new
const fresh = newPackages([["package-lock.json", read]], [[{ name: "tidy-moss-helper" }], [{ name: "@invented/scoped-moss" }]]);
ok(fresh.map((p) => p.name).sort().join() === "brand-new-moss,dev-moss,from-git,tidy-moss-format" && fresh.every((p) => p.lockPath === "package-lock.json"), "a package any lock file of the base held, under any version, is not new");
ok(newPackages([["a/package-lock.json", [pkg("x", { direct: false })]], ["b/package-lock.json", [pkg("x")]]], []).length === 1, "a package new in two lock files is looked up once, where the project names it");
ok(newPackages([["a/package-lock.json", [pkg("x")]], ["b/package-lock.json", [pkg("x", { direct: false })]]], [])[0]?.lockPath === "a/package-lock.json", "and once named by the project, it stays so where another lock file only brings it");
const both = newPackages([["a/package-lock.json", [pkg("twin-moss", { from: "a git address" })]], ["b/package-lock.json", [pkg("twin-moss")]]], []);
ok(both.length === 2 && both.some((p) => !p.from), "a name from git does not stand in for the same name the registry gives, which is still looked up");
ok(newPackages([["packages.lock.json", [pkg("Invented.Moss.Core")]]], [[{ name: "invented.moss.core" }]], true).length === 0, "NuGet: an id the base held in another case is not new");
ok(newPackages([["packages.lock.json", [pkg("Invented.Moss.Core")]]], [[{ name: "invented.moss.core" }]]).length === 1, "npm: a name is held by its exact spelling");
ok(newPackages([["package-lock.json", [pkg("twin-moss")]]], [[pkg("twin-moss", { from: "a git address" })]]).length === 1, "a name the base took from git does not hold the same name the registry now gives");
ok(newPackages([["package-lock.json", [pkg("twin-moss", { from: "a git address" })]]], [[pkg("twin-moss")]]).length === 1, "nor the registry's name one from git");

// ---- The lookup
const one = async (p, nuget = false) => lookUp([p], { get, now: NOW, nuget });
let r = await one(pkg("tidy-moss-format", { brings: 2 }));
ok(r.failures.length === 0 && r.reports.length === 1, `an old package that exists passes (${JSON.stringify(r)})`);
const odd = await lookUp([pkg("tidy-moss-format", { lockPath: "a\n::error::b/packages.lock.json" })], { get, now: NOW });
ok(!/[\r\n]/u.test(odd.reports[0] ?? "\n"), "a lock file's path is printed on one line, whatever its folder's name");
const report = r.reports[0] ?? "";
for (const fact of ["named by the project", `first published ${ago(800).slice(0, 10)} (800 days ago)`, `last release ${ago(30).slice(0, 10)}`, "repository github.com/invented-org/tidy-moss-format, archived, naming the package back", "published by invented-publisher", "brings 2 packages with it", "provenance: yes"])
  ok(report.includes(fact), `the report says "${fact}" (${report})`);
r = await one(pkg("from-git", { from: "a web address on example.invalid" }));
ok(r.failures.length === 0 && r.reports[0]?.includes("not from the npm registry but from a web address on example.invalid, so not looked up") && !asked.some((u) => u.includes("from-git")), `a new entry from elsewhere than the registry is printed, never asked of it (${r.reports})`);
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
r = await one(pkg("Invented.Moss.Lines", { version: "1.0.0" }), true);
ok(r.failures.length === 0 && r.reports[0]?.includes(`first published ${ago(700).slice(0, 10)}`) && r.reports[0].includes(`last release ${ago(10).slice(0, 10)}`), `NuGet: every page is read, since a lower version may be the newer (${JSON.stringify(r)})`);
r = await one(pkg("invented.moss.young", { version: "1.0.0" }), true);
ok(r.failures.length === 1 && /40 days ago/u.test(r.failures[0]), `NuGet: a young package fails (${r.failures})`);
for (const [what, answer] of [["no pages", { status: 200, json: { items: [] } }], ["a page that does not answer", { status: 200, json: { items: [{ "@id": "https://api.nuget.org/v3/registration5-gz-semver2/invented.moss.gone/page/1.0.0/2.0.0.json", lower: "1.0.0", upper: "2.0.0" }] } }]]) {
  r = await lookUp([pkg("Invented.Moss.Gone")], { get: async (url) => (url.endsWith("index.json") ? answer : { status: 500 }), now: NOW, nuget: true });
  ok(r.failures.length === 1 && /could not be read/u.test(r.failures[0]), `NuGet: an index with ${what} fails the lookup (${r.failures})`);
}
r = await lookUp([pkg("Invented.Moss.Absent")], { get, now: NOW, nuget: true, sources: 1 });
ok(r.failures.length === 0 && /from a source the config names/u.test(r.reports[0] ?? ""), `NuGet: where the config names sources of its own, an id NuGet's registry lacks is from one of them, reported and not failed (${JSON.stringify(r)})`);
r = await lookUp([pkg("Invented.Moss.Core", { version: "9.9.9" })], { get, now: NOW, nuget: true });
ok(r.failures.length === 1 && /no version 9\.9\.9 of it/u.test(r.failures[0]), `NuGet: an id the registry knows at no such version fails, where the config names no other source (${r.failures})`);
r = await lookUp([pkg("Invented.Moss.Core", { version: "9.9.9" })], { get, now: NOW, nuget: true, sources: 1 });
ok(r.failures.length === 0 && /from a source the config names/u.test(r.reports[0] ?? ""), "NuGet: and is from a source of the config's where it names one, its old public dates never read for it");
r = await one(pkg("Invented.Moss.Absent"), true);
ok(r.failures.length === 1 && /NuGet registry has no such package/u.test(r.failures[0]), "NuGet: an id the registry does not know fails");
r = await one(pkg("Invented.Moss.Astray"), true);
ok(r.failures.length === 1 && /outside the registry/u.test(r.failures[0]), "NuGet: a page the index places outside the registry is not fetched");

// ---- Every lock entry from npm's registry, with an integrity value (#488, point 4)
{
  const at = mkdtempSync(join(tmpdir(), "lookup-source-"));
  const g = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: at, encoding: "utf8" }).trim();
  try {
    g("init", "-q");
    writeFileSync(join(at, "licences.json"), JSON.stringify({ lockfiles: ["package-lock.json"], ships: [] }));
    const put = (packages) => writeFileSync(join(at, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/tidy-moss-format": { version: "1.1.0", resolved: tgz("tidy-moss-format"), integrity: "sha512-invented" }, ...packages } }));
    const old = { "node_modules/from-git": { version: "1.0.0", resolved: "git+https://example.invalid/from-git.git#0123456" } };
    put(old);
    g("add", "-A"); g("commit", "-qm", "base");
    const base = g("rev-parse", "HEAD"), config = join(at, "licences.json");
    let r = await run(config, { root: at, base, get, now: NOW });
    ok(r.code === 0 && r.lines.some((l) => /^REPORT: package-lock\.json: from-git@1\.0\.0 .*a git address.*the pull request's base held it so/u.test(l)), `an entry from git the base held is reported and passes (${r.lines})`);
    const cases = [
      ["a web address", { "node_modules/from-web": { version: "2.0.0", resolved: "https://example.invalid/from-web-2.0.0.tgz", integrity: "sha512-invented" } }, /from-web@2\.0\.0 .*a web address on example\.invalid/u],
      ["no integrity value, deep in the tree", { "node_modules/tidy-moss-format/node_modules/deep-moss": { version: "1.0.0", resolved: tgz("deep-moss", "1.0.0") } }, /deep-moss@1\.0\.0 .*no integrity value/u],
      ["a git address at another commit", { "node_modules/from-git": { version: "1.0.1", resolved: "git+https://example.invalid/from-git.git#89abcde" } }, /from-git@1\.0\.1 .*a git address/u],
      ["a packed file outside the project", { "node_modules/far-moss": { version: "1.0.0", resolved: "file:../elsewhere/far-moss-1.0.0.tgz", integrity: "sha512-invented" } }, /far-moss@1\.0\.0 .*a packed file named by its path/u],
    ];
    for (const [what, packages, said] of cases) {
      put(packages);
      r = await run(config, { root: at, base, get, now: NOW });
      const out = r.lines.join("\n");
      ok(r.code === 1 && mended(out) && r.lines.some((l) => l.startsWith("FAIL: ") && said.test(l)) && /not from npm's registry with an integrity value/u.test(out), `an entry the pull request brings with ${what} fails, saying the mend (${r.lines})`);
    }
    put({ ...old, "node_modules/tidy-moss-format/node_modules/tidy-moss-helper": { version: "1.1.0", inBundle: true }, "node_modules/own-moss": { version: "1.0.0", resolved: "file:vendor/own-moss-1.0.0.tgz", integrity: "sha512-invented" } });
    r = await run(config, { root: at, base, get, now: NOW });
    ok(r.code === 0 && !r.lines.some((l) => /tidy-moss-helper|own-moss/u.test(l) && /integrity|not npm.s registry/u.test(l)), `a package inside another's file, and a packed file of the project's own, pass (${r.lines})`);
  } finally { rmSync(at, { recursive: true, force: true }); }
}

// ---- The check on a project
const tmp = mkdtempSync(join(tmpdir(), "lookup-test-"));
const git = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: tmp, encoding: "utf8" }).trim();
try {
  git("init", "-q");
  writeFileSync(join(tmp, "licences.json"), JSON.stringify({ lockfiles: ["package-lock.json"], ships: [] }));
  writeFileSync(join(tmp, "package.json"), "{}");
  // (each entry with an integrity value, as npm writes one, unless the test says otherwise)
  const write = (packages) => writeFileSync(join(tmp, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, ...Object.fromEntries(Object.entries(packages).map(([k, e]) => [k, { integrity: "sha512-invented", ...e }])) } }));
  write({ "node_modules/tidy-moss-format": { version: "1.1.0", resolved: tgz("tidy-moss-format") } });
  mkdirSync(join(tmp, "fixtures"), { recursive: true });
  writeFileSync(join(tmp, "fixtures/package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/never-published-moss": { version: "1.0.0", resolved: tgz("never-published-moss", "1.0.0"), integrity: "sha512-invented" } } }));
  git("add", "-A"); git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD");
  const config = join(tmp, "licences.json");
  r = await run(config, { root: tmp, base: null, get, now: NOW, event: "push" });
  ok(r.code === 0 && /nothing looked up/u.test(r.lines.join("\n")), "with no base, as on a push, nothing is new and nothing is asked");
  r = await run(config, { root: tmp, base: null, get, now: NOW, event: "pull_request" });
  ok(r.code === 1 && mended(r.lines.join("\n")) && /fetch-depth: 2/u.test(r.lines[0]), `with no base on a pull request, it fails, saying the mend (${r.lines})`);
  asked.length = 0;
  r = await run(config, { root: tmp, base, get, now: NOW });
  ok(r.code === 0 && asked.length === 0 && /ok {3}0 new packages/u.test(r.lines.join("\n")), `what the base held is not looked up (${r.lines})`);
  write({ "node_modules/tidy-moss-format": { version: "1.2.0", resolved: tgz("tidy-moss-format", "1.2.0") }, "node_modules/never-published-moss": { version: "1.0.0", resolved: tgz("never-published-moss", "1.0.0") } });
  r = await run(config, { root: tmp, base, get, now: NOW });
  const out = r.lines.join("\n");
  ok(r.code === 1 && mended(out) && /^FAIL: package-lock\.json: never-published-moss@1\.0\.0/mu.test(out) && !/tidy-moss-format/u.test(out) && /1 of 1 new package fail/u.test(out), `an update passes unlooked, and a new name the registry lacks fails, saying the mend, though a lock file the config does not name held it (${r.lines})`);
  // A lock file merged as data, which the pull request then names in the config: its names are new, not held.
  writeFileSync(join(tmp, "licences.json"), JSON.stringify({ lockfiles: ["package-lock.json", "fixtures/package-lock.json"], ships: [] }));
  write({ "node_modules/tidy-moss-format": { version: "1.1.0", resolved: tgz("tidy-moss-format") }, "node_modules/never-published-moss": { version: "1.0.0", resolved: tgz("never-published-moss", "1.0.0") } });
  r = await run(config, { root: tmp, base, get, now: NOW });
  ok(r.code === 1 && /^FAIL: package-lock\.json: never-published-moss@1\.0\.0/mu.test(r.lines.join("\n")), `a lock file the pull request newly names in the config makes no name held (${r.lines})`);
  writeFileSync(join(tmp, "licences.json"), JSON.stringify({ lockfiles: ["package-lock.json"], ships: [] }));
  // A lock file the pull request makes a link to a file outside the project: refused, and nothing of the file printed.
  const outside = mkdtempSync(join(tmpdir(), "lookup-outside-"));
  writeFileSync(join(outside, "secret.txt"), "invented-secret-text-not-json");
  rmSync(join(tmp, "package-lock.json"));
  symlinkSync(join(outside, "secret.txt"), join(tmp, "package-lock.json"));
  r = await run(config, { root: tmp, base, get, now: NOW });
  ok(r.code === 1 && mended(r.lines.join("\n")) && /leads out of the project/u.test(r.lines.join("\n")) && !/invented-secret/u.test(r.lines.join("\n")), `a lock file that links out of the project is refused, unread (${r.lines})`);
  // The config itself, made a link out of the project: refused before it is opened, under either flag.
  symlinkSync(join(outside, "secret.txt"), join(tmp, "linked.json"));
  for (const nuget of [false, true]) {
    r = await run(join(tmp, "linked.json"), { root: tmp, base, nuget, get, now: NOW });
    ok(r.code === 1 && mended(r.lines.join("\n")) && /leads out of the project/u.test(r.lines.join("\n")) && !/invented-secret/u.test(r.lines.join("\n")), `a config that links out of the project is refused, unread${nuget ? ", for NuGet too" : ""} (${r.lines})`);
  }
  // Run from the folder above the project, a config that links out of the project into that folder is refused too.
  writeFileSync(join(tmp, "..", `${basename(tmp)}-beside.json`), JSON.stringify({ "invented-outside-key": 1 }));
  rmSync(join(tmp, "linked.json"));
  symlinkSync(join(tmp, "..", `${basename(tmp)}-beside.json`), join(tmp, "linked.json"));
  const here = process.cwd();
  process.chdir(join(tmp, ".."));
  try { r = await run(join(basename(tmp), "linked.json"), { root: tmp, base, get, now: NOW }); } finally { process.chdir(here); }
  ok(r.code === 1 && /leads out of the project/u.test(r.lines.join("\n")) && !/invented-outside-key/u.test(r.lines.join("\n")), `run from the folder above, a config that links into it is refused, unread (${r.lines})`);
  rmSync(join(tmp, "..", `${basename(tmp)}-beside.json`));
  rmSync(join(tmp, "linked.json"));
  writeFileSync(join(tmp, "broken.json"), "{ invented-config-text");
  r = await run(join(tmp, "broken.json"), { root: tmp, base, nuget: true, get, now: NOW });
  ok(r.code === 1 && mended(r.lines.join("\n")) && !/invented-config-text/u.test(r.lines.join("\n")), `a NuGet config that is no JSON fails, quoting none of it (${r.lines})`);
  rmSync(join(tmp, "broken.json"));
  rmSync(join(tmp, "package-lock.json")); rmSync(outside, { recursive: true, force: true });
  writeFileSync(join(tmp, "package-lock.json"), "{ not json");
  r = await run(config, { root: tmp, base, get, now: NOW });
  ok(r.code === 1 && mended(r.lines.join("\n")) && !/not json/u.test(r.lines.join("\n")), `a lock file that cannot be read fails, saying the mend and quoting none of it (${r.lines})`);
  // The sync's step, on a workflow of the project's own: each lookup is asked for apart, so one does not hide the other.
  const step = STEPS.filter((x) => x.lead === "16 November 2026, a new package looked up");
  mkdirSync(join(tmp, ".github/workflows"), { recursive: true });
  const own = (...lines) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${lines.map((l) => `      - run: ${l}\n`).join("")}`);
  own("node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/exact-versions.mjs c.json", "node core/scripts/nuget.mjs c.json");
  let missed = notDone(tmp, step);
  ok(missed.length === 1 && /for each config `core\/scripts\/exact-versions\.mjs` is given, add a step that runs `node core\/scripts\/lookup\.mjs` with the same config,/u.test(missed[0].mend) && !/`--nuget`/u.test(missed[0].mend), `the NuGet lookup does not stand in for the npm one (${missed.map((m) => m.mend)})`);
  own("node core/scripts/exact-versions.mjs c.json", "node core/scripts/nuget-fetch.mjs c.json", "node core/scripts/lookup.mjs c.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /with the same config and `--nuget`/u.test(missed[0].mend), `nor the npm lookup for the NuGet one (${missed.map((m) => m.mend)})`);
  own("node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json", "node core/scripts/nuget.mjs c.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /give its checkout `fetch-depth: 2`/u.test(missed[0].mend), `with both, a checkout of one commit is still reported, since the lookup would read no base (${missed.map((m) => m.mend)})`);
  writeFileSync(join(tmp, ".github/workflows/own.yml"), `${readFileSync(join(tmp, ".github/workflows/own.yml"), "utf8").replace("    steps:\n", "    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n")}`);
  ok(notDone(tmp, step).length === 0, "and with both, on a checkout that holds the base, the step is done");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: echo first\n  b:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /give its checkout `fetch-depth: 2`/u.test(missed[0].mend), `a fetch depth in another job than the lookup's does not count (${missed.map((m) => m.mend)})`);
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: |\n          node core/scripts/exact-versions.mjs c.json\n          # node core/scripts/lookup.mjs c.json\n");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /add a step that runs `node core\/scripts\/lookup\.mjs/u.test(missed[0].mend), `a lookup in a shell comment runs nothing, and does not count (${missed.map((m) => m.mend)})`);
  const nugetJob = (...lines) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n${lines.map((l) => `      - run: ${l}\n`).join("")}`);
  nugetJob("dotnet restore --locked-mode", "node core/scripts/nuget.mjs c.json", "node core/scripts/lookup.mjs c.json --nuget");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /with nothing before it in its job but the checkout, `setup-` actions and the core's lookup, exact-versions, licence and agent-tools scripts/u.test(missed[0].mend), `a NuGet lookup after the restore, which runs the pull request's build files, does not count (${missed.map((m) => m.mend)})`);
  nugetJob("node core/scripts/lookup.mjs c.json --nuget", "dotnet restore --locked-mode", "node core/scripts/nuget.mjs c.json");
  ok(notDone(tmp, step).length === 0, "and before it, it does");
  nugetJob("node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/lookup.mjs c.json", "node core/scripts/nuget.mjs c.json");
  ok(notDone(tmp, step).length === 0, "the core's lookup and exact-versions scripts may stand before it");
  // Before the NuGet lookup only what cannot run the pull request's build files may stand: an allow-list, so a build
  // spelled any way is caught.
  for (const [what, line] of [["by a script in another folder named core", "node src/core/scripts/restore.mjs"], ["inside a core script's words", 'node core/scripts/labels.mjs "$(dotnet restore)"'], ["by the core's mutation tool, which runs the project's tests", "node core/scripts/mutate.mjs --report r.json 1"], ["behind a variable", "env X=1 dotnet build"], ["under sudo", "sudo dotnet restore"], ["in a script", "./build.sh"], ["in PowerShell", "pwsh build.ps1"], ["by make", "make restore"], ["by node on another file", "node build.mjs"]]) {
    nugetJob(line, "node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/nuget.mjs c.json");
    ok(notDone(tmp, step).length === 1, `a NuGet lookup after a build ${what} does not count`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - uses: actions/setup-dotnet@v5\n      - uses: ./.github/actions/build\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor after a local action, though a setup action may stand before it");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - uses: actions/setup-dotnet@v5\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 0, "and after the checkout and a setup action alone, it counts");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n        env:\n          NODE_OPTIONS: --import ./build.mjs\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor after a core script Node is told to load a file of the project's before");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/lookup.mjs c.json --nuget\n        env:\n          NODE_OPTIONS: --import ./build.mjs\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor a lookup Node is told to load a file of the project's before");
  // What has a step run more than its words show, before the NuGet lookup or in it.
  const lic = (extra) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n${extra}      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n`);
  for (const [what, extra] of [
    ["BASH_ENV", "      - run: node core/scripts/licences.mjs c.json\n        env:\n          BASH_ENV: ./build.sh\n"],
    ["a PATH of the project's", "      - run: node core/scripts/licences.mjs c.json\n        env:\n          PATH: ./tools:/usr/bin:/bin\n"],
    ["a node of the project's", "      - run: ./tools/node core/scripts/licences.mjs c.json\n"],
    ["a shell of the step's own", "      - run: node core/scripts/licences.mjs c.json\n        shell: ./build.sh {0}\n"],
    ["an expansion bash evaluates", "      - run: node core/scripts/licences.mjs ${X:Y}\n"],
    ["a step that writes to $GITHUB_ENV", "      - run: echo NODE_OPTIONS=--import=./build.mjs >> \"$GITHUB_ENV\"\n"],
  ]) {
    lic(extra);
    ok(notDone(tmp, step).length === 1, `a NuGet lookup after a step with ${what} does not count`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: ./tools/node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor a lookup run by a node of the project's");
  for (const [what, extra] of [
    ["LD_PRELOAD", "      - run: node core/scripts/licences.mjs c.json\n        env:\n          LD_PRELOAD: ./tools/hook.so\n"],
    ["a bash function named node", "      - run: node core/scripts/licences.mjs c.json\n        env:\n          BASH_FUNC_node%%: \"() { ./build.sh; }\"\n"],
    ["a variable its words do not name", "      - run: node core/scripts/licences.mjs c.json\n        env:\n          HOOK: ./build.sh\n"],
    ["a script of the core's from another folder", "      - run: node core/scripts/licences.mjs c.json\n        working-directory: tools\n"],
  ]) {
    lic(extra);
    ok(notDone(tmp, step).length === 1, `a NuGet lookup after a step with ${what} does not count`);
  }
  for (const [what, line, dir] of [["a lookup that writes over its own script", "node core/scripts/lookup.mjs c.json --nuget 3>core/scripts/lookup.mjs"], ["a lookup script the pull request holds", "node tools/core/scripts/lookup.mjs c.json --nuget"], ["a lookup run from another folder", "node core/scripts/lookup.mjs ../c.json --nuget", "tools"]]) {
    writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: ${line}\n${dir ? `        working-directory: ${dir}\n` : ""}      - run: node core/scripts/nuget.mjs c.json\n`);
    ok(notDone(tmp, step).length === 1, `${what} counts for none`);
  }
  nugetJob("npm run build", "node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json");
  ok(notDone(tmp, step).length === 1, "an npm lookup after a step that runs the project's own files counts for none");
  for (const [what, extra] of [
    ["a setup action given an env of its own", "      - uses: actions/setup-node@v4\n        env:\n          LD_PRELOAD: ./evil.so\n"],
    ["a checkout of another repository into the copy's folder", "      - uses: actions/checkout@v7\n        with:\n          repository: someone/else\n          path: core\n"],
    ["a setup action that caches, running the package manager", "      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: yarn\n"],
    ["OPENSSL_CONF, though the step's words name it", "      - run: node core/scripts/licences.mjs $OPENSSL_CONF\n        env:\n          OPENSSL_CONF: evil.cnf\n"],
    ["a variable its words name, but not as its config", "      - run: node core/scripts/licences.mjs c.json $HOOK\n        env:\n          HOOK: ./build.sh\n"],
  ]) {
    lic(extra);
    ok(notDone(tmp, step).length === 1, `a NuGet lookup after a step with ${what} does not count`);
  }
  for (const [what, runner] of [["a Windows runner, whose shell is pwsh", "windows-latest"], ["a runner a matrix names", "${{ matrix.os }}"], ["a self-hosted runner, which may be Windows", "self-hosted"]]) {
    writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ${runner}\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/licences.mjs @(./evil.ps1)\n      - run: node core/scripts/lookup.mjs c.json --nuget\n        shell: bash\n      - run: node core/scripts/nuget.mjs c.json\n`);
    ok(notDone(tmp, step).length === 1, `a NuGet lookup after a step with no shell named on ${what} does not count`);
  }
  lic("      - run: node core/scripts/licences.mjs c.json\n");
  ok(notDone(tmp, step).length === 0, "and after the licence script alone, it does");
  lic("      - uses: actions/setup-node@v4\n        with:\n          node-version-file: .node-version\n");
  ok(notDone(tmp, step).length === 0, "and after a setup action given only its version, it does");
  lic("      - uses: actions/setup-node@v5\n        with:\n          node-version: 22\n          package-manager-cache: false\n");
  ok(notDone(tmp, step).length === 0, "and after one whose cache is turned off, it does");
  lic("      - uses: actions/setup-node@v5\n        with:\n          node-version: 22\n          cache: false\n");
  ok(notDone(tmp, step).length === 1, "but not after one given cache: false, which names a package manager, not a switch");
  lic("      - uses: actions/setup-dotnet@v4\n        with:\n          dotnet-version: 8.x\n          cache: false\n");
  ok(notDone(tmp, step).length === 0, "save in setup-dotnet, where cache: false is the switch turned off");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    container:\n      image: node:22\n      env:\n        NODE_OPTIONS: --require ./evil.js\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor a lookup in a job run in a container of its own");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    services:\n      s:\n        image: node:22\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor one in a job beside service containers");
  nugetJob("echo PATH=./tools >> \"$GITHUB_PATH\"", "node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json");
  ok(notDone(tmp, step).length === 1, "nor does an npm lookup after a step that writes to $GITHUB_PATH");
  writeFileSync(join(tmp, "core-manifest.md"), `# Manifest\n\nCore: ${CORE} at ${"0".repeat(40)}, copied whole under shared/\n`);
  nugetJob("node shared/scripts/exact-versions.mjs c.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /runs `node shared\/scripts\/lookup\.mjs/u.test(missed[0].mend), `where the manifest puts the core under shared/, its scripts are read there (${missed.map((m) => m.mend)})`);
  nugetJob("node shared/scripts/lookup.mjs c.json", "node shared/scripts/exact-versions.mjs c.json");
  ok(notDone(tmp, step).length === 0, "and its lookup there counts");
  writeFileSync(join(tmp, "core-manifest.md"), "# Manifest\n");
  for (const [what, line] of [["named by an echo", "echo core/scripts/lookup.mjs c.json"], ["allowed to fail", "node core/scripts/lookup.mjs c.json || true"]]) {
    nugetJob("node core/scripts/exact-versions.mjs c.json", line);
    missed = notDone(tmp, step);
    ok(missed.length === 1 && /add a step that runs `node core\/scripts\/lookup\.mjs/u.test(missed[0].mend), `a lookup ${what} does not count (${missed.map((m) => m.mend)})`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  push:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor one in a workflow no pull request starts");
  for (const [what, on] of [["only once it closes", "  pull_request:\n    types: [closed]\n"], ["only where its paths change", "  pull_request:\n    paths: [docs/**]\n"], ["only into some branches", "  pull_request:\n    branches: [nothing-here]\n"]]) {
    writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n${on}jobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n`);
    ok(notDone(tmp, step).length === 1, `nor one in a workflow a pull request starts ${what}`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\n    types: [opened, synchronize, reopened, ready_for_review]\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 0, "and one that runs on its opening and every push counts");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n        continue-on-error: true\n");
  ok(notDone(tmp, step).length === 1, "nor one in a step allowed to fail");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n        if: false\n");
  ok(notDone(tmp, step).length === 1, "nor one under a condition the reader cannot tell");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    continue-on-error: true\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor one in a job allowed to fail");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /no `ref:`/u.test(missed[0].mend), `and a checkout of another commit than the merge does not hold the base (${missed.map((m) => m.mend)})`);
  nugetJob("msbuild -t:Restore", "node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/nuget.mjs c.json");
  ok(notDone(tmp, step).length === 1, "a NuGet lookup after an msbuild restore does not count");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: dotnet restore --locked-mode\n        if: always()\n      - run: node core/scripts/lookup.mjs c.json --nuget\n      - run: node core/scripts/nuget.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "a restore under a condition before the NuGet lookup is still a restore before it");
  for (const [what, extra] of [["piped on", "node core/scripts/lookup.mjs c.json | tee out"], ["sent to the background", "node core/scripts/lookup.mjs c.json &"]]) {
    nugetJob("node core/scripts/exact-versions.mjs c.json", extra);
    ok(notDone(tmp, step).length === 1, `a lookup ${what}, whose failure the step does not see, does not count`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: windows-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 1, "nor one under pwsh, Windows' default shell, which goes on past a failure");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: windows-latest\n    defaults:\n      run:\n        shell: bash\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs c.json\n      - run: node core/scripts/lookup.mjs c.json\n");
  ok(notDone(tmp, step).length === 0, "and one under bash on Windows counts");
  nugetJob("node core/scripts/exact-versions.mjs checks/frontend.json", "node core/scripts/exact-versions.mjs checks/backend.json", "node core/scripts/lookup.mjs checks/frontend.json");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /for each config `core\/scripts\/exact-versions\.mjs` is given/u.test(missed[0].mend), `a lookup of one config does not stand for another config's check (${missed.map((m) => m.mend)})`);
  nugetJob("node core/scripts/exact-versions.mjs checks/frontend.json", "node core/scripts/exact-versions.mjs checks/backend.json", "node core/scripts/lookup.mjs checks/frontend.json", "node core/scripts/lookup.mjs checks/backend.json");
  ok(notDone(tmp, step).length === 0, "and with a lookup of each, the step is done");
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  front:\n    runs-on: ubuntu-latest\n    env:\n      CONFIG: checks/frontend.json\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs \"$CONFIG\"\n      - run: node core/scripts/lookup.mjs \"$CONFIG\"\n  back:\n    runs-on: ubuntu-latest\n    env:\n      CONFIG: checks/backend.json\n    steps:\n      - run: node core/scripts/exact-versions.mjs \"$CONFIG\"\n");
  missed = notDone(tmp, step);
  ok(missed.length === 1, `a config named only when the workflow runs is matched in its own job alone (${missed.map((m) => m.mend)})`);
  const stepEnv = (check, look) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - run: node core/scripts/exact-versions.mjs "$CONFIG"\n        env:\n          CONFIG: ${check}\n      - run: node core/scripts/lookup.mjs "$CONFIG"\n        env:\n          CONFIG: ${look}\n`);
  stepEnv("checks/backend.json", "checks/frontend.json");
  ok(notDone(tmp, step).length === 1, "a variable config the lookup's step gives another value does not count");
  stepEnv("checks/backend.json", "checks/backend.json");
  ok(notDone(tmp, step).length === 0, "and given the same value, it does");
  // A check run from a local composite action is seen where it runs, as are a lookup there and a build there.
  const action = (...lines) => { mkdirSync(join(tmp, ".github/actions/packages"), { recursive: true }); writeFileSync(join(tmp, ".github/actions/packages/action.yml"), `name: packages\nruns:\n  using: composite\n  steps:\n${lines.map((l) => `    - run: ${l}\n      shell: bash\n`).join("")}`); };
  const usesAction = () => writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - uses: ./.github/actions/packages\n");
  action("node core/scripts/exact-versions.mjs c.json"); usesAction();
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /add a step that runs `node core\/scripts\/lookup\.mjs`/u.test(missed[0].mend), `a check run from a local action, with no lookup, is not done (${missed.map((m) => m.mend)})`);
  action("node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json");
  ok(notDone(tmp, step).length === 0, "and with the lookup beside it there, it is");
  action("dotnet restore --locked-mode", "node core/scripts/lookup.mjs c.json --nuget", "node core/scripts/nuget.mjs c.json");
  ok(notDone(tmp, step).length === 1, "a restore in a local action, before its NuGet lookup, is read as a build");
  action("node core/scripts/lookup.mjs c.json --nuget", "dotnet restore --locked-mode", "node core/scripts/nuget.mjs c.json");
  ok(notDone(tmp, step).length === 0, "and a NuGet lookup first there counts");
  writeFileSync(join(tmp, ".github/actions/packages/action.yml"), "name: [unclosed\n");
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /cannot be read whole/u.test(missed[0].mend), `a local action that cannot be read is named, not taken as running nothing (${missed.map((m) => m.mend)})`);
  // Ten actions, each calling the next ten times, would be ten billion steps: a bound on all a workflow's actions read.
  for (let i = 0; i < 10; i++) {
    mkdirSync(join(tmp, `.github/actions/a${i}`), { recursive: true });
    writeFileSync(join(tmp, `.github/actions/a${i}/action.yml`), `name: a${i}\nruns:\n  using: composite\n  steps:\n${i === 9 ? "    - run: node core/scripts/exact-versions.mjs c.json\n      shell: bash\n" : `    - uses: ./.github/actions/a${i + 1}\n`.repeat(10)}`);
  }
  writeFileSync(join(tmp, ".github/workflows/own.yml"), "name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - uses: ./.github/actions/a0\n");
  const began = Date.now();
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /past 5000 steps/u.test(missed[0].mend) && Date.now() - began < 20000, `actions that call each other without end are read to a bound, and named (${missed.map((m) => m.mend.slice(0, 200))})`);
  // An action's input is its caller's `with:`: two calls given two configs are two configs, and one given none matches none.
  for (const [name, line] of [["look", "node core/scripts/lookup.mjs ${{ inputs.config }}"], ["check", "node core/scripts/exact-versions.mjs ${{ inputs.config }}"]]) {
    mkdirSync(join(tmp, `.github/actions/${name}`), { recursive: true });
    writeFileSync(join(tmp, `.github/actions/${name}/action.yml`), `name: ${name}\ninputs:\n  config:\n    required: false\nruns:\n  using: composite\n  steps:\n    - run: ${line}\n      shell: bash\n`);
  }
  const calls = (look, check) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n      - uses: ./.github/actions/look\n${look ? `        with:\n          config: ${look}\n` : ""}      - uses: ./.github/actions/check\n${check ? `        with:\n          config: ${check}\n` : ""}`);
  calls("checks/a.json", "checks/b.json");
  ok(notDone(tmp, step).length === 1, "a lookup an action is given one config for does not stand for a check another is given another for");
  calls("checks/b.json", "checks/b.json");
  ok(notDone(tmp, step).length === 0, "and given the same, it does");
  calls(null, null);
  ok(notDone(tmp, step).length === 1, "an input no caller gives matches nothing");
  // The same, an input given through env.
  for (const [name, line] of [["look", "node core/scripts/lookup.mjs \"$CFG\""], ["check", "node core/scripts/exact-versions.mjs \"$CFG\""]]) {
    writeFileSync(join(tmp, `.github/actions/${name}/action.yml`), `name: ${name}\ninputs:\n  config:\n    required: false\nruns:\n  using: composite\n  steps:\n    - run: ${line}\n      shell: bash\n      env:\n        CFG: \${{ inputs.config }}\n`);
  }
  calls("checks/a.json", "checks/b.json");
  ok(notDone(tmp, step).length === 1, "an input given through env is the caller's too: a lookup of one config does not stand for another's check");
  calls("checks/b.json", "checks/b.json");
  ok(notDone(tmp, step).length === 0, "and given the same through env, it does");
  rmSync(join(tmp, ".github/actions"), { recursive: true, force: true });
  // An action past a megabyte is named, not read, and each action is read once however often it is used.
  mkdirSync(join(tmp, ".github/actions/big"), { recursive: true });
  writeFileSync(join(tmp, ".github/actions/big/action.yml"), `name: big\n# ${"x".repeat(1 << 20)}\nruns:\n  using: composite\n  steps:\n    - run: node core/scripts/exact-versions.mjs c.json\n      shell: bash\n`);
  writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${"      - uses: ./.github/actions/big\n".repeat(2000)}`);
  const timed = Date.now();
  missed = notDone(tmp, step);
  ok(missed.length === 1 && /cannot be read whole/u.test(missed[0].mend) && Date.now() - timed < 10000, `an action past a megabyte is named, and read once (${Date.now() - timed} ms; ${missed.map((m) => m.mend.slice(0, 160))})`);
  rmSync(join(tmp, ".github/actions"), { recursive: true, force: true });
  // One config's name in two folders is two configs: a lookup in one folder does not stand for the other's check.
  const dirs = (...pairs) => writeFileSync(join(tmp, ".github/workflows/own.yml"), `name: own\non:\n  pull_request:\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 2\n${pairs.map(([d, l]) => `      - run: ${l}\n        working-directory: ${d}\n`).join("")}`);
  dirs(["frontend", "node ../core/scripts/exact-versions.mjs licences.json"], ["backend", "node ../core/scripts/exact-versions.mjs licences.json"], ["frontend", "node ../core/scripts/lookup.mjs licences.json"]);
  ok(notDone(tmp, step).length === 1, "a lookup run in one folder does not stand for a check of the same name in another");
  dirs(["frontend", "node ../core/scripts/exact-versions.mjs licences.json"], ["backend", "node ../core/scripts/exact-versions.mjs licences.json"], [".", "node core/scripts/lookup.mjs frontend/licences.json"], [".", "node core/scripts/lookup.mjs backend/licences.json"]);
  ok(notDone(tmp, step).length === 1, "a lookup run from another folder than the root counts for none, though a check may run there");
  dirs([".", "node core/scripts/lookup.mjs frontend/licences.json"], [".", "node core/scripts/lookup.mjs backend/licences.json"], ["frontend", "node ../core/scripts/exact-versions.mjs licences.json"], ["backend", "node ../core/scripts/exact-versions.mjs licences.json"]);
  ok(notDone(tmp, step).length === 0, "and with a lookup of each folder's config from the root, before them, the step is done");
  nugetJob("node core/scripts/exact-versions.mjs c.json", "node core/scripts/lookup.mjs c.json # waits & sees");
  ok(notDone(tmp, step).length === 0, "an ampersand in a comment does not send the lookup to the background");
} finally { rmSync(tmp, { recursive: true, force: true }); }

console.log(failed ? `${failed} failing` : "ok   lookup.mjs");
process.exit(failed ? 1 : 0);
