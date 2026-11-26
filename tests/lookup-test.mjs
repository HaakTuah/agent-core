#!/usr/bin/env node
// Tests of lookup.mjs: each package name invented, each answer of a registry or of GitHub recorded (lookup-stage.mjs) in the
// shape the registry gives, trimmed to what the lookup reads, and handed to it in place of the network (floor rule 8: no
// live call, no real package): what a lock file holds, what is new, the lookup, and every lock entry from npm's registry.
// The check run on a project, in a scratch repository, is lookup-run-test.mjs's. Run: node tests/lookup-test.mjs
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lookUp, newPackages, npmPackages, nugetPackages, run, sourceFaults, YOUNG } from "../scripts/lookup.mjs";
import { INVENTED_SUM, NOW, ago, asked, get, tgz } from "../scripts/lookup-stage.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { if (!cond) { failed++; console.error(`FAIL ${what}`); } };

const pkg = (name, extra = {}) => ({ name, version: "1.1.0", path: `node_modules/${name}`, direct: true, brings: 0, lockPath: "package-lock.json", ...extra });

// ---- What a lock file holds
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
  const at = scratchDir("lookup-source-");
  const g = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: at, encoding: "utf8" }).trim();
  try {
    g("init", "-q");
    writeFileSync(join(at, "licences.json"), JSON.stringify({ lockfiles: ["package-lock.json"], ships: [] }));
    const put = (packages) => writeFileSync(join(at, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/tidy-moss-format": { version: "1.1.0", resolved: tgz("tidy-moss-format"), integrity: INVENTED_SUM }, ...packages } }));
    const old = { "node_modules/from-git": { version: "1.0.0", resolved: "git+https://example.invalid/from-git.git#0123456" }, "node_modules/from-web-held": { version: "3.0.0", resolved: "https://example.invalid/from-web-held-3.0.0.tgz", integrity: INVENTED_SUM } };
    put(old);
    g("add", "-A"); g("commit", "-qm", "base");
    const base = g("rev-parse", "HEAD"), config = join(at, "licences.json");
    let r = await run(config, { root: at, base, get, now: NOW });
    ok(r.code === 0 && r.lines.some((l) => /^REPORT: package-lock\.json: from-git@1\.0\.0 .*a git address.*the pull request's base held it so/u.test(l)), `an entry from git the base held is reported and passes (${r.lines})`);
    const cases = [
      ["a web address", { "node_modules/from-web": { version: "2.0.0", resolved: "https://example.invalid/from-web-2.0.0.tgz", integrity: INVENTED_SUM } }, /from-web@2\.0\.0 .*a web address on example\.invalid/u],
      ["no integrity value, deep in the tree", { "node_modules/tidy-moss-format/node_modules/deep-moss": { version: "1.0.0", resolved: tgz("deep-moss", "1.0.0") } }, /deep-moss@1\.0\.0 .*no integrity value/u],
      ["a git address at another commit", { "node_modules/from-git": { version: "1.0.1", resolved: "git+https://example.invalid/from-git.git#89abcde" } }, /from-git@1\.0\.1 .*a git address/u],
      ["another git address under a held name and version", { "node_modules/from-git": { version: "1.0.0", resolved: "git+https://example.invalid/elsewhere.git#0123456" } }, /from-git@1\.0\.0 .*a git address/u],
      ["a second entry of a held one, nested", { ...old, "node_modules/tidy-moss-format/node_modules/from-git": { version: "1.0.0", resolved: "git+https://example.invalid/from-git.git#0123456" } }, /from-git@1\.0\.0 \(at node_modules\/tidy-moss-format\/node_modules\/from-git\)/u],
      ["a mark of being bundled, beside a git address of its own", { "node_modules/says-bundled": { version: "1.0.0", resolved: "git+ssh://git@example.invalid/anyone/says-bundled.git#0123456", inBundle: true } }, /says-bundled@1\.0\.0 .*a git address/u],
      ["an integrity value npm cannot read", { "node_modules/odd-sum": { version: "1.0.0", resolved: tgz("odd-sum", "1.0.0"), integrity: "x" } }, /odd-sum@1\.0\.0 .*no integrity value/u],
      ["a held web address whose integrity value is taken off", { "node_modules/from-web-held": { version: "3.0.0", resolved: "https://example.invalid/from-web-held-3.0.0.tgz" } }, /from-web-held@3\.0\.0 .*a web address/u],
      ["a held web address whose integrity value changes", { "node_modules/from-web-held": { version: "3.0.0", resolved: "https://example.invalid/from-web-held-3.0.0.tgz", integrity: `sha512-${"B".repeat(86)}==` } }, /from-web-held@3\.0\.0 .*a web address/u],
      ["a packed file outside the project", { "node_modules/far-moss": { version: "1.0.0", resolved: "file:../elsewhere/far-moss-1.0.0.tgz", integrity: INVENTED_SUM } }, /far-moss@1\.0\.0 .*a packed file named by its path/u],
    ];
    for (const [what, packages, said] of cases) {
      put(packages);
      r = await run(config, { root: at, base, get, now: NOW });
      const out = r.lines.join("\n");
      ok(r.code === 1 && mended(out) && r.lines.some((l) => l.startsWith("FAIL: ") && said.test(l)) && /not from npm's registry with an integrity value/u.test(out), `an entry the pull request brings with ${what} fails, saying the mend (${r.lines})`);
    }
    put({ ...old, "node_modules/tidy-moss-format/node_modules/tidy-moss-helper": { version: "1.1.0", inBundle: true }, "node_modules/own-moss": { version: "1.0.0", resolved: "file:vendor/own-moss-1.0.0.tgz", integrity: INVENTED_SUM } });
    r = await run(config, { root: at, base, get, now: NOW });
    ok(r.code === 0 && !r.lines.some((l) => /tidy-moss-helper|own-moss/u.test(l) && /integrity|not npm.s registry/u.test(l)), `a package inside another's file, and a packed file of the project's own, pass (${r.lines})`);
  } finally { rmSync(at, { recursive: true, force: true }); }
}

// ---- An address with a sign-in in it, the sign-in made up and built from pieces as the test runs: the source is named
// by its host alone, and nothing printed holds the user or the password (floor rule 1), a password long enough that its
// "@" stands past where a printed value is cut short among them
{
  const user = ["made", "up"].join("-"), pass = [["not", "a", "pass"].join("_"), "x".repeat(240)].join("-");
  const signed = npmPackages(JSON.stringify({ lockfileVersion: 3, packages: { "": { dependencies: { "web-moss": "1.0.0", "git-moss": "1.0.0" } },
    "node_modules/web-moss": { version: "1.0.0", resolved: `https://${user}:${pass}@example.invalid/web-moss-1.0.0.tgz`, integrity: INVENTED_SUM },
    "node_modules/git-moss": { version: `git+https://${user}:${pass}@example.invalid/git-moss.git#0123456`, resolved: `git+https://${user}:${pass}@example.invalid/git-moss.git#0123456` } } }), "package-lock.json");
  const said = JSON.stringify(sourceFaults([["package-lock.json", signed]], []));
  ok(signed.find((p) => p.name === "web-moss")?.from === "a web address on example.invalid" && !said.includes(user) && !said.includes(pass.slice(0, 12)) && said.includes("git-moss@git+https://example.invalid/git-moss.git"),
    `an address with a sign-in is named by its host, and the sign-in printed nowhere (${said.replaceAll(user, "<user>").replaceAll(pass, "<pass>")})`);
}


console.log(failed ? `${failed} failing` : "ok   lookup.mjs");
process.exit(failed ? 1 : 0);
