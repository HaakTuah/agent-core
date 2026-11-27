// Checks the licence check's lists and readers (scripts/licences.mjs), alone, on invented names: how a licence
// expression is read, which list allows what, a package known by its registry address, npm's settings; and, of the
// core's own files, that its audit's entry for Node names the version the core pins (#592); and that the config's
// schema and the check's own checks of its form, its fallback where ajv is not installed, read it alike (#530). The
// check on a whole project, and its scan, are checked by licence-scan-test.mjs and the licence-scan and licence-yes tests beside it. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/licences-test.mjs
import { readable } from "../scripts/licence-yes.mjs";
import { installed } from "../scripts/packages.mjs";
import { keysOf } from "../scripts/schemas.mjs";
import { actionLists, alongside, coreConfig, check, licenceOk, loadConfig, movedOff, policy, registryName, registryOverrides, registryVersion, releaseAge, scriptsOff, WAIT } from "../scripts/licences.mjs";
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what, more = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) { failed++; if (more) console.log(more); } };

// the pin, .node-version, is one fact that the audit's entry for Node and node.sh's sums each name: the scan reads the
// download as pinned by the entry's version, so an entry left behind when the pin moves would pass unseen (#592)
{
  const core = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  const pin = core(".node-version").trim();
  const entry = JSON.parse(core(".github/licences-audit.json")).entries.filter(e => e.name === "Node.js");
  // (node.sh's case on "$want-$(uname -m)" read strictly, line by line: the pin's x86_64 arm, its aarch64 arm, each
  // with one sum, then the closing *) alone, so that no glob, alternative, extra arm or form the test does not know,
  // above the pin's lines or among them, passes)
  const block = /^case "\$want-\$\(uname -m\)" in\n([\s\S]*?)\nesac$/mu.exec(core("scripts/node.sh").replace(/\r\n/gu, "\n"))?.[1];
  const v = pin.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const shapes = [new RegExp(`^  ${v}-x86_64\\) arch=x64 sum=[0-9a-f]{64} ;;$`, "u"), new RegExp(`^  ${v}-aarch64\\) arch=arm64 sum=[0-9a-f]{64} ;;$`, "u"), /^  \*\) (?:[^;]|;(?!;))*;;$/u];
  const lines = block === undefined ? [] : block.split("\n");
  const odd = block === undefined ? ['no line `case "$want-$(uname -m)" in` closed by `esac`'] : [
    ...lines.flatMap((line, i) => (shapes[i]?.test(line) ? [] : [`line ${i + 1} of the case, ${JSON.stringify(line)}`])),
    ...shapes.slice(lines.length).map((_, i) => `no line ${lines.length + i + 1}`)];
  const want = ["x86_64", "aarch64"].map(arch => `${pin}-${arch}`);
  ok(entry.length === 1 && entry[0].version === pin && odd.length === 0,
    `the audit's entry for Node, and node.sh's sums, one for each architecture, name the pin in .node-version, ${pin}`,
    `the entry names ${entry.map(e => e.version).join(", ") || "nothing"}; in scripts/node.sh, ${odd.join("; ") || "the case is as wanted"}; where the case wants exactly three lines: \`  ${want[0]}) arch=x64 sum=<its sha256> ;;\`, \`  ${want[1]}) arch=arm64 sum=<its sha256> ;;\` and \`  *) <one command line, no ;;> ;;\`. Mend: set "version" of the entry "Node.js" in .github/licences-audit.json to the version .node-version names, and give node.sh's case on "$want-$(uname -m)" that version's two sums, one for x86_64 and one for aarch64, in those three lines and no other, in the pull request that moves the pin (tasks/updates.md, "Node")`);
}

const lists = policy({ data: ["mossgrip-data"], fonts: ["mossgrip-face"] });
const code = lists.allowedFor("mossgrip-lib"), data = lists.allowedFor("mossgrip-data"), font = lists.allowedFor("mossgrip-face");
const tool = lists.allowedFor("mossgrip-cli", false);
const all = (exprs, allow, want) => exprs.every((x) => licenceOk(x, allow) === want);
ok(all(["MIT AND (BSD-2-Clause OR Apache-2.0)", "(MIT OR CC0-1.0)", "MIT OR GPL-3.0-only"], code, true)
  && all(["(MIT OR GPL-3.0-only) AND (GPL-3.0-only)", "GPL-3.0-only"], code, false), "reads AND and OR with their brackets");
ok(all([undefined, "", "MIT AND", "(MIT", "MIT OR (", "Apache-2.0 WITH LLVM-exception", "MIT AND GPL-3.0-only OR MIT"], code, false), "refuses no licence, an exception, a broken expression, and AND and OR mixed without brackets");
ok(all(["CC-BY-4.0", "OFL-1.1"], code, false) && all(["CC-BY-4.0", "PDDL-1.0"], data, true) && !licenceOk("OFL-1.1", data)
  && licenceOk("OFL-1.1", font) && !licenceOk("CC-BY-4.0", font) && licenceOk("Public Domain", code), "CC-BY only for named data, OFL only for named fonts, the public domain for any");
ok(all(["MIT\n", "\tMIT", " MIT OR ISC\r\n"], code, true) && all(["MIT\tOR ISC", "MIT\u00a0OR ISC", "MIT WITH", "\t"], code, false), "blanks at an expression's ends are read past, as they always were; one within it but a space is refused");
ok(all(["GPL-3.0-only", "LGPL-2.1-or-later", "MPL-2.0", "EUPL-1.2", "OSL-3.0", "CECILL-2.1", "MS-RL", "BSL-1.0", "Artistic-1.0-Perl", "PSF-2.0"], tool, true)
  && all(["GPL-3.0-only", "LGPL-2.1-or-later", "MPL-2.0", "EUPL-1.2", "OSL-3.0", "CECILL-2.1", "MS-RL"], code, false), "tools may use every licence the Open Source Initiative approves, what ships none of its copyleft ones");
ok(all(["BUSL-1.1", "SSPL-1.0", "Elastic-2.0", "CC-BY-NC-4.0", "CC-BY-ND-4.0", undefined], tool, false), "nor any terms floor rule 10 never allows");
ok(registryName("https://registry.npmjs.org/mossgrip-data/-/mossgrip-data-1.0.0.tgz") === "mossgrip-data" && registryName("https://registry.npmjs.org/@moss/grip/-/grip-1.0.0.tgz") === "@moss/grip"
  && [undefined, "file:vendor/mossgrip-data.tgz", "vendor/mossgrip-data", "git+https://mossgrip.example/data.git", "https://mossgrip.example/mossgrip-data/-/mossgrip-data-1.0.0.tgz",
    "https://registry.npmjs.org/@moss\\../z\\..\\grip/-/z\\..\\grip-1.0.0.tgz", "https://registry.npmjs.org/@moss/../-/grip-1.0.0.tgz", "https://registry.npmjs.org/%2e%2e/-/grip-1.0.0.tgz"].every((r) => registryName(r) === undefined)
  && registryName("https://registry.npmjs.org/JSONStream/-/JSONStream-1.3.5.tgz") === "JSONStream" && registryName("https://registry.npmjs.org/-moss/-/-moss-1.0.0.tgz") === "-moss"
  && registryName("https://registry.npmjs.org/@-moss/grip/-/grip-1.0.0.tgz") === "@-moss/grip" && ["https://registry.npmjs.org/.moss/-/.moss-1.0.0.tgz", "https://registry.npmjs.org/.moss/-/moss-1.0.0.tgz", "https://registry.npmjs.org/_moss/-/moss-1.0.0.tgz",
    "https://registry.npmjs.org/@_moss/grip/-/grip-1.0.0.tgz", "https://registry.npmjs.org/@.moss/grip/-/grip-1.0.0.tgz", "https://registry.npmjs.org/moss/-/_moss-1.0.0.tgz"].every((r) => registryName(r) === undefined)
  && registryName("https://registry.npmjs.org/-/-/--0.0.1.tgz") === "-" && registryVersion("https://registry.npmjs.org/-/-/--0.0.1.tgz") === "0.0.1",
  "names a package by its registry address, never by a name the lockfile could be given");
ok(registryVersion("https://registry.npmjs.org/mossgrip-data/-/mossgrip-data-1.0.0.tgz") === "1.0.0" && registryVersion("https://registry.npmjs.org/@moss/grip/-/grip-2.0.0-beta.1.tgz") === "2.0.0-beta.1"
  && registryVersion("https://registry.npmjs.org/mossgrip-data/-/lichen-1.0.0.tgz") === undefined && registryVersion("file:vendor/mossgrip-data-1.0.0.tgz") === undefined && registryVersion(undefined) === undefined,
  "and its version by the same address");
ok(["BUSL-1.1", "SSPL-1.0", "Elastic-2.0", "CC-BY-NC-4.0", "CC-BY-ND-4.0", "PolyForm-Noncommercial-1.0.0", "PolyForm-Small-Business-1.0.0", "FSL-1.1-MIT", "MIT + Commons Clause", "LicenseRef-NonCommercial",
  "LicenseRef-Business-Source", "LicenseRef-NoDerivatives", "LicenseRef-Source-Available", "Server Side Public License", '{"type":"BUSL-1.1"}', "non_commercial use only", "BSL-1.1", "BSL 1.1", "BSL", "MIT AND BSL-1.1"].every((l) => lists.never.test(l))
  && ["MIT", "NCSA", "LicenseRef-Vendor-EULA", "LGPL-3.0-only", "UNLICENSED", "CNRI-Python", "Unicode-DFS-2016", "BSL-1.0", "BSL 1.0", "PostgreSQL", "MS-PL", "Apache-2.0 WITH LLVM-exception"].every((l) => !lists.never.test(l)),
  "knows the terms no list and no yes takes in by their ids and by the words they go by, and no allowed licence among them");
const ids = new Set(lists.tools);
ok(["MIT", "(MIT OR GPL-2.0-only)", "GPL-2.0-only WITH Classpath-exception-2.0", "LicenseRef-A AND (MIT OR LGPL-3.0-only)", "LicenseRef-Vendor-EULA"].every((l) => readable(l, ids))
  && ["", "AND", "()", "MIT AND", "(MIT", "MIT)", "MIT OR OR MIT", "MIT WITH", "MIT WITH AND", "WITH x", "MIT MIT", "Some-Words", "LicenseRef-", "LicenseRef-.", "LicenseRef--", "MIT WITH -x", `${"(".repeat(60)}MIT${")".repeat(60)}`, `${"(".repeat(200000)}MIT`, undefined, 7].every((l) => !readable(l, ids)),
  "reads a yes's licence as one whole expression of ids it knows and names the owner gave, and nothing else");
const lines = actionLists({ ships: [], data: ["mossgrip-data"], accepted: [{ package: "mossgrip-lib@1.0.0", licence: "LGPL-3.0-only", ships: true, yes: "y", notice: "n" }, { package: "@moss/bought@2.1.0", licence: "LicenseRef-Vendor-EULA", ships: false, yes: "y" }, { entry: "Bark pack", licence: "LicenseRef-Vendor-EULA", ships: true, yes: "y" }] }, {});
ok(lines.length === 2 && lines[0].startsWith("allow-licenses=0BSD,") && lines[1] === "allow-dependencies-licenses=pkg:npm/mossgrip-data,pkg:npm/@moss/bought",
  "the dependency review is told to let through, of what the owner accepted, only a package under a licence it would refuse", lines[1]);
// a project's sync brings the core's lock files into its pull request, which the dependency review reads under the
// project's lists: with a config of a project's that names none of the core's data packages, as the starter kit writes
// it, every package of each lock file the copy holds passes them, by its licence or its name (#1310)
{
  const kit = { lockfiles: ["package-lock.json"], ships: ["package.json"] };
  const [allow, through] = actionLists(kit).map((l) => l.slice(l.indexOf("=") + 1).split(","));
  const licences = new Set(allow), names = new Set(through);
  const copied = execFileSync("git", ["archive", "HEAD"], { cwd: new URL("..", import.meta.url), maxBuffer: 1 << 28 }).toString("latin1");
  const locks = (coreConfig().lockfiles ?? []).filter((f) => copied.includes(`${f}\0`));
  const refused = locks.flatMap((f) => Object.entries(JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).packages)
    .filter(([path, p]) => path && !p.link && !licenceOk(p.license, licences) && !names.has(`pkg:npm/${path.slice(path.lastIndexOf("node_modules/") + 13)}`))
    .map(([path, p]) => `${f}: ${path} (${p.license})`));
  ok(locks.includes(".packages/package-lock.json") && !refused.length && !actionLists(kit, {})[1].includes("spdx-exceptions"),
    "every package of the core's lock files the copy holds passes the dependency review's lists of a project that names none of them, by the core's own config", refused.join("\n"));
  const dir = scratchDir("core-licences-"), at = join(dir, "licences.json");
  try {
    const refuses = (text) => { writeFileSync(at, text); try { coreConfig(at); return ""; } catch (e) { return e.message; } };
    ok(JSON.stringify(coreConfig(join(dir, "none.json"))) === "{}" && /cannot be read as JSON\. Mend: /u.test(refuses("{")) && /no npm package name.*\. Mend: /u.test(refuses('{"data":["Not A Name"]}'))
      && /no npm package name/u.test(refuses('{"accepted":[{"package":7}]}')) && refuses('{"data":["x"],"accepted":[{"entry":"e"}]}') === "",
      "the core's own config is none where it is not there, and refused, saying its mend, where it cannot be read or names what is no package");
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const npmrc = ["registry=https://mossgrip.example/", "replace-registry-host=always", "@x:registry = https://mossgrip.example/", '"registry"=https://mossgrip.example/', '"replace-registry-host"=always', "${KEY}=https://mossgrip.example/"];
ok(JSON.stringify(registryOverrides(npmrc.join("\n"))) === JSON.stringify(npmrc) && registryOverrides("fund=false\naudit=false\n# registry=x\n; registry=x\n").length === 0
  && JSON.stringify(registryOverrides("ignore-scripts=true\nregistry=https://mossgrip.example/\n")) === JSON.stringify(["registry=https://mossgrip.example/"])
  && JSON.stringify(registryOverrides("ignore-scripts=false\nIGNORE-SCRIPTS=true\nignore-scripts=\n")) === JSON.stringify(["ignore-scripts=false", "IGNORE-SCRIPTS=true", "ignore-scripts="]),
  "refuses every npm setting but a few harmless ones, however its key is spelt");
ok(scriptsOff("# no install scripts\nignore-scripts=true\n") && !scriptsOff("ignore-scripts=false\n"), "knows when install scripts are off");
// (an .npmrc is read line by line as npm reads it, a lone carriage return ending a line too)
ok(!scriptsOff("ignore-scripts=\rtrue\n") && releaseAge("min-release-age=\r7\n") === null && JSON.stringify(registryOverrides("fund=\rregistry=x\n")) === JSON.stringify(["registry=x"])
  && releaseAge("ignore-scripts=true\r\nmin-release-age=7\r\n") === 7 && scriptsOff("\uFEFFignore-scripts=true\n")
  && !scriptsOff("ignore-scripts=true\u2028\n") && releaseAge("min-release-age=7\u2029\n") === null && registryOverrides("ignore-scripts=true\u2028\n").length === 1
  && registryOverrides("fund=false\u00a0\nmin-release-age=7\u3000\n").length === 0 && scriptsOff("ignore-scripts=true\u00a0\n"),
  "reads an .npmrc's lines as npm does, at each carriage return too");

// a licence the floor moved off the list for what ships (MS-PL, 13 November 2026): held at the base, reported and passing;
// added or updated, failing, that pull request alone
const ships = policy().allowedFor("x", true);
ok(!ships.has("MS-PL") && policy().allowedFor("x", false).has("MS-PL") && movedOff("MS-PL", ships) && !movedOff("MIT OR MS-PL", ships) && !movedOff("GPL-3.0-only", ships), "MS-PL is off the list for what ships and on the tools', and only it is a licence moved off");
{
  const dir = scratchDir("licences-test-moved-");
  const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: join(dir, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  const git = (...args) => execFileSync("git", args, { cwd: dir, env: gitEnv, stdio: ["ignore", "pipe", "pipe"] });
  const lock = (deps) => JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "p", dependencies: Object.fromEntries(deps.map(([n, v]) => [n, v])) }, ...Object.fromEntries(deps.map(([n, v, l]) => [`node_modules/${n}`, { version: v, license: l, resolved: `https://registry.npmjs.org/${n}/-/${n}-${v}.tgz` }])) } });
  const commit = (deps) => { writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "p", dependencies: Object.fromEntries(deps.map(([n, v]) => [n, v])) })); writeFileSync(join(dir, "package-lock.json"), lock(deps)); git("add", "-A"); git("commit", "-q", "-m", "x"); };
  try {
    git("init", "-q");
    commit([["held", "1.0.0", "MS-PL"], ["fine", "1.0.0", "MIT"]]);
    commit([["held", "1.0.0", "MS-PL"], ["fine", "1.0.0", "MIT"], ["added", "2.0.0", "MS-PL"]]);
    const config = { ships: ["package.json"], lockfiles: ["package-lock.json"] };
    const r = check(config, dir, "HEAD^1", config);
    ok(r.reports.length === 1 && r.reports[0].includes("held@1.0.0") && r.reports[0].includes("13 November 2026") && r.failures.length === 1 && r.failures[0].includes("added@2.0.0"), "held at the base, a package under MS-PL is reported and passes; one the pull request adds fails, it alone", JSON.stringify(r));
    commit([["held", "1.1.0", "MS-PL"], ["fine", "1.0.0", "MIT"]]);
    const u = check(config, dir, "HEAD^1", config);
    ok(u.reports.length === 0 && u.failures.length === 1 && u.failures[0].includes("held@1.1.0"), "one the pull request updates fails too: the yes is for that version", JSON.stringify(u));
    // (a package the base held only as a tool, which a pull request moves into what ships, was not shipped there)
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "p", dependencies: { fine: "1.0.0" }, devDependencies: { dev: "1.0.0" } }));
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "p", dependencies: { fine: "1.0.0" }, devDependencies: { dev: "1.0.0" } }, "node_modules/fine": { version: "1.0.0", license: "MIT", resolved: "https://registry.npmjs.org/fine/-/fine-1.0.0.tgz" }, "node_modules/dev": { version: "1.0.0", license: "MS-PL", dev: true, resolved: "https://registry.npmjs.org/dev/-/dev-1.0.0.tgz" } } }));
    git("add", "-A"); git("commit", "-q", "-m", "a tool");
    const asTool = check(config, dir, "HEAD^1", config);
    commit([["dev", "1.0.0", "MS-PL"], ["fine", "1.0.0", "MIT"]]);
    const moved = check(config, dir, "HEAD^1", config);
    ok(asTool.failures.length === 0 && moved.reports.length === 0 && moved.failures.length === 1 && moved.failures[0].includes("dev@1.0.0"), "one the base held only as a tool, which the pull request moves into what ships, fails: it was not shipped there", JSON.stringify([asTool, moved]));
    // (and a lock file whose packages the base's own config did not ship, which the pull request's config now ships)
    const tools = check(config, dir, "HEAD^1", { ships: [], lockfiles: ["package-lock.json"] });
    ok(tools.reports.length === 0 && tools.failures.some((f) => f.includes("dev@1.0.0")), "one in a lock file the base's own config did not ship fails too, read by that config", JSON.stringify(tools));
    // (and where the base held no config at this one's path, as when a pull request moves it, nothing shipped there)
    const elsewhere = check(config, dir, "HEAD^1", null);
    ok(elsewhere.reports.length === 0 && elsewhere.failures.some((f) => f.includes("dev@1.0.0")), "where the base held no config at this one's path, nothing counts as shipped there", JSON.stringify(elsewhere));
    // (a package is known by what it is: an alias moved to another package of the same version is another)
    const alias = (to, note = "") => {
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "p", description: note, dependencies: { compat: `npm:${to}@1.0.0` } }));
      writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "p", dependencies: { compat: `npm:${to}@1.0.0` } }, "node_modules/compat": { version: "1.0.0", license: "MS-PL", resolved: `https://registry.npmjs.org/${to}/-/${to}-1.0.0.tgz` } } }));
      git("add", "-A"); git("commit", "-q", "-m", to);
      return check(config, dir, "HEAD^1", config);
    };
    alias("old-pkg");
    const kept = alias("old-pkg", "again"), swapped = alias("new-pkg");
    ok(kept.failures.length === 0 && kept.reports.length === 1 && swapped.reports.length === 0 && swapped.failures.some((f) => f.includes("compat@1.0.0")), "an alias the base shipped is reported; one moved to another package of the same version fails, known by what it is", JSON.stringify([kept, swapped]));
    const none = check(config, dir, null);
    ok(none.reports.length === 1 && none.reports[0].includes("no base to read") && none.failures.length === 0, "with no base to read (a checkout of one commit), it is reported and passes, as it passed before: no sync fails a project over it", JSON.stringify(none));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// the week's wait in the package manager's own settings (#488, point 3): min-release-age in each .npmrc that keeps
// install scripts off, failing only where a pull request takes it out or adds such a file without it
ok(WAIT === 7 && releaseAge("ignore-scripts=true\nmin-release-age=7\n") === 7 && releaseAge("min-release-age=3\nmin-release-age = 10\n") === 10 && releaseAge("# min-release-age=7\n") === null && releaseAge("min-release-age=seven\n") === null,
  "reads the wait an .npmrc sets, its last line counting, and none from a comment or a word");
ok(registryOverrides("ignore-scripts=true\nmin-release-age=7\n").length === 0 && JSON.stringify(registryOverrides("min-release-age-exclude[]=@x/*\nbefore=2026-01-01\n")) === JSON.stringify(["min-release-age-exclude[]=@x/*", "before=2026-01-01"]),
  "takes the wait among the harmless settings, and never what undoes it");
{
  const dir = scratchDir("licences-test-wait-");
  const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: join(dir, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  const git = (...args) => execFileSync("git", args, { cwd: dir, env: gitEnv, stdio: ["ignore", "pipe", "pipe"] });
  const commit = (files) => { for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text); git("add", "-A"); git("commit", "-q", "-m", "c"); };
  const config = { ships: [], lockfiles: [], ignoreScriptsIn: [".npmrc"] };
  const waits = (r) => [...r.failures, ...r.reports].filter((m) => m.includes("min-release-age"));
  try {
    git("init", "-q");
    commit({ ".npmrc": "ignore-scripts=true\n" });
    commit({ "README.md": "a change of its own\n" });
    let r = check(config, dir, "HEAD^1", config);
    ok(r.failures.length === 0 && waits(r).length === 1 && r.reports.some((m) => m.includes(".npmrc does not set min-release-age=7") && m.includes("at the pull request's base")), "an .npmrc that stood without the wait is reported and passes", JSON.stringify(r));
    r = check(config, dir, null, config);
    ok(r.failures.length === 0 && r.reports.some((m) => m.includes("min-release-age") && m.includes("no base to read")), "with no base to read, it is reported and passes", JSON.stringify(r));
    commit({ ".npmrc": "ignore-scripts=true\nmin-release-age=7\n" });
    r = check(config, dir, "HEAD^1", config);
    ok(r.failures.length === 0 && waits(r).length === 0, "an .npmrc with the wait passes, and says nothing", JSON.stringify(r));
    commit({ ".npmrc": "ignore-scripts=true\nmin-release-age=3\n" });
    r = check(config, dir, "HEAD^1", config);
    ok(r.failures.length === 1 && r.failures[0].includes("Mend: add the line min-release-age=7 to .npmrc"), "a pull request that shortens the wait fails, saying the mend", JSON.stringify(r));
    git("rm", "-q", ".npmrc"); git("commit", "-q", "-m", "none");
    writeFileSync(join(dir, ".npmrc"), "ignore-scripts=true\n");
    r = check(config, dir, "HEAD", config);
    ok(r.failures.some((m) => m.includes("min-release-age")), "an .npmrc the base did not hold, added without the wait, fails", JSON.stringify(r));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// the project's files the check reads: each a regular file of its own, read to a bound (core-path.mjs's regularText),
// and one it does not read fails, naming why, with its mend
{
  const dir = scratchDir("licences-test-bound-"), away = scratchDir("licences-test-away-");
  const big = (text, past) => `${text}${"x".repeat(past)}\n`, PAST = (1 << 24) + 1;
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
    writeFileSync(join(dir, "package.json"), '{ "name": "p", "version": "1.0.0" }\n');
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ name: "p", lockfileVersion: 3, packages: { "": { name: "p", version: "1.0.0" } }, pad: "x".repeat(3 << 19) }));
    writeFileSync(join(dir, ".npmrc"), big("ignore-scripts=true\nmin-release-age=7\n#", 1 << 20));
    writeFileSync(join(dir, "audit.json"), '{ "entries": [] }\n');
    writeFileSync(join(dir, "NOTICES.txt"), big("", 1 << 20));
    const lawful = check({ ships: [], lockfiles: ["package-lock.json"], ignoreScriptsIn: [".npmrc"], audit: "audit.json", notices: "NOTICES.txt" }, dir, null, null);
    ok(!lawful.failures.some((m) => /package-lock\.json|\.npmrc|NOTICES\.txt/u.test(m)), "a lock file, an npm config file and a notices file past a mebibyte, within the bound, are read", JSON.stringify(lawful.failures));
    writeFileSync(join(dir, ".npmrc"), big("ignore-scripts=true\nmin-release-age=7\n#", PAST));
    writeFileSync(join(dir, "NOTICES.txt"), big("", PAST));
    let r;
    try { r = check({ ships: [], lockfiles: [], ignoreScriptsIn: [".npmrc"], audit: "audit.json", notices: "NOTICES.txt" }, dir, null, null); } catch (e) { r = { failures: [e.message] }; }
    const pastBound = (f) => (m) => m.includes(`${f} is past ${1 << 24} bytes`) && m.includes("Mend:");
    ok(r.failures.some(pastBound(".npmrc")) && !r.failures.some((m) => m.includes("does not set ignore-scripts")), "an npm config file past the bound is unread, and fails naming the bound, with its mend", JSON.stringify(r.failures));
    ok(r.failures.some(pastBound("NOTICES.txt")), "a notices file past the bound is unread, and fails naming the bound, with its mend", JSON.stringify(r.failures));
    writeFileSync(join(dir, ".npmrc"), "ignore-scripts=true\nmin-release-age=7\n");
    rmSync(join(dir, "NOTICES.txt"));
    writeFileSync(join(dir, "package-lock.json"), big("{}", PAST));
    let thrown = "";
    try { check({ ships: [], lockfiles: ["package-lock.json"] }, dir, null, null); } catch (e) { thrown = e.message; }
    ok(pastBound("package-lock.json")(thrown), "a lock file past the bound is unread, and fails naming the bound, with its mend", thrown);
    writeFileSync(join(dir, "audit.json"), `{ "entries": [] }${" ".repeat(PAST)}\n`);
    thrown = "";
    try { check({ ships: [], lockfiles: [], audit: "audit.json" }, dir, null, null); } catch (e) { thrown = e.message; }
    ok(pastBound("audit.json")(thrown), "an audit past the bound is unread, and fails naming the bound, with its mend", thrown);
    rmSync(join(dir, "audit.json")); rmSync(join(dir, "package-lock.json"));
    writeFileSync(join(dir, ".npmrc"), "registry=https://example.invalid/\n");
    writeFileSync(join(dir, "sub.npmrc"), big("registry=https://example.invalid/\n#", 1 << 20));
    writeFileSync(join(dir, "big.npmrc"), big("registry=https://example.invalid/\n#", PAST));
    let links = true;
    writeFileSync(join(away, "away.json"), JSON.stringify({ ships: [], lockfiles: [] }));
    try { symlinkSync(join(away, "away.json"), join(dir, "linked.json")); } catch { links = false; }
    const set = check({ ships: [], lockfiles: [], ignoreScriptsIn: [".npmrc"] }, dir, null, null).failures;
    ok(set.some((m) => m.startsWith(".npmrc: npm setting not allowed")) && set.some((m) => m.startsWith("sub.npmrc: npm setting not allowed")) && set.some(pastBound("big.npmrc")), "an npm config file is read to the bound for what it sets, and one past it is unread and fails, with its mend", JSON.stringify(set));
    let config = "";
    try { loadConfig(join(dir, "linked.json"), dir); } catch (e) { config = e.message; }
    ok(!links || (config.includes("reached through a link that leads out of the project") && config.includes("Mend:")), "a config reached through a link that leads out of the project is refused unread, with its mend", config);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(away, { recursive: true, force: true }); }
}

// the config's form (#530): its schema, read by ajv, and the check's own checks of it, which read it where ajv is not
// installed (a copy of the scripts with no packages), refuse the same configs, each with its mend, and pass the same
{
  const base = { lockfiles: ["package-lock.json", "tools/package-lock.json"], ships: ["package.json"], data: ["spdx-exceptions"], fonts: [], ignoreScriptsIn: [".npmrc"],
    audit: "audit.json", notices: "NOTICES.txt", scan: { served: ["site/"], tools: ["scripts/"], skip: ["x.mjs"] }, nuget: { any: 1 }, accepted: [], agentTools: [] };
  const set = (o, k, v) => { const x = structuredClone(o); if (v === undefined) delete x[k]; else x[k] = v; return x; };
  const configs = [base, {}, { ships: [] }, { ships: [], lockfiles: [] }, { ships: [], audit: "a.json" }, { ...base, extra: 1 }, { ...base, Ships: [] }];
  // (every key the schema gives, but "scan", varied below, and those the other checks read: so a key added to both
  // readings is compared too)
  for (const k of keysOf("licences").filter((k) => !["scan", "nuget", "accepted", "agentTools"].includes(k))) {
    for (const v of [undefined, [], [""], ["a"], "a", "", 5, null, [5], {}, ["a", ""]]) configs.push(set(base, k, v), set(set(base, "audit", undefined), k, v), set(set(base, "lockfiles", undefined), k, v));
  }
  for (const v of [undefined, null, [], {}, "x", { served: [] }, { served: [""] }, { served: ["./x"] }, { served: ["/x"] }, { served: ["."] }, { served: [""], skip: [""] }, { served: [], tools: [5] },
    { served: "x" }, { servd: [] }, { served: [], servd: [] }, { tools: [] }, { served: ["../x"] }, { served: ["a//b"] }]) configs.push(set(base, "scan", v), set(set(base, "audit", undefined), "scan", v));
  const dir = scratchDir("licence-config-"), bare = join(dir, "bare"), file = join(dir, "c.json");
  try {
    // (with no packages here, both readings would be the fallback and agree with themselves)
    ok(installed("ajv"), "the core's packages are installed, so the schema is read against the fallback", "Mend: run node scripts/install.mjs, then this test again");
    if (installed("ajv")) {
      cpSync(new URL("../scripts/", import.meta.url), join(bare, "scripts"), { recursive: true });
      cpSync(new URL("../floor/", import.meta.url), join(bare, "floor"), { recursive: true });
      const [withAjv, without] = await Promise.all([import("../scripts/licences.mjs"), import(pathToFileURL(join(bare, "scripts", "licences.mjs")).href)]);
      const said = (m, c) => { writeFileSync(file, JSON.stringify(c)); try { m.loadConfig(file); return null; } catch (e) { return e.message; } };
      const apart = configs.map((c) => [c, said(withAjv, c), said(without, c)]).filter(([, a, b]) => (a === null) !== (b === null) || [a, b].some((m) => m !== null && !/ Mend: \S/u.test(m)));
      const passed = configs.filter((c) => said(withAjv, c) === null).length;
      ok(!apart.length && passed > 10 && passed < configs.length - 100, `the config's schema and the check's own checks of its form refuse the same ${configs.length - passed} of ${configs.length} configs, each saying its mend, and pass the same ${passed}`,
        apart.slice(0, 5).map((x) => JSON.stringify(x)).join("\n"));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// The checks run beside the licence check (#1093, point 2) read against the base the job names (LOOKUP_BASE), as the
// lookup does, where the checkout holds the head and not a merge: a range that stood there is reported, never failed;
// where it names none and the checkout holds none, what stands cannot be told from what is new, so a range is reported,
// never failed (Codex's review of ea0438a); and a base the job names that the checkout does not hold fails, saying its
// mend, where the lookup would warn.
{
  const dir = scratchDir("licences-test-alongside-");
  const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: join(dir, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  const git = (...args) => execFileSync("git", args, { cwd: dir, env: gitEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const was = { log: console.log, error: console.error, event: process.env.GITHUB_EVENT_NAME, base: process.env.LOOKUP_BASE };
  const run = async (base) => {
    const lines = [];
    console.log = console.error = (l) => lines.push(String(l));
    process.env.GITHUB_EVENT_NAME = "pull_request";
    if (base === undefined) delete process.env.LOOKUP_BASE; else process.env.LOOKUP_BASE = base;
    try { return { failed: await alongside(join(dir, "c.json"), dir), out: lines.join("\n") }; } finally { console.log = was.log; console.error = was.error; }
  };
  try {
    git("init", "-q");
    writeFileSync(join(dir, "c.json"), JSON.stringify({ ships: ["package.json"], lockfiles: ["package-lock.json"] }));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "p", dependencies: { a: "^1.2.3" } }));
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "p", dependencies: { a: "^1.2.3" } }, "node_modules/a": { version: "1.2.3", license: "MIT", resolved: "https://registry.npmjs.org/a/-/a-1.2.3.tgz" } } }));
    git("add", "-A"); git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD");
    writeFileSync(join(dir, "x.txt"), "x"); git("add", "-A"); git("commit", "-q", "-m", "head");
    const named = await run(base);
    ok(!named.failed && /stood so at the pull request's base: reported, never failed/u.test(named.out) && !/^FAIL/mu.test(named.out), "on a checkout of the head, a range that stood at the base the job names is reported, never failed", named.out);
    const lacking = await run("f".repeat(40));
    const none = await run(undefined);
    ok(!none.failed && /no base to read it against: reported, never failed/u.test(none.out) && /^::warning::The lookup of the packages new to the project did not run/mu.test(none.out) && !/^FAIL/mu.test(none.out),
      "where the job names no base and its checkout holds none, a range is reported, never failed, beside the lookup's warning", none.out);
    ok(lacking.failed && /^FAIL: the lookup of the packages new to the project cannot run: the job names the pull request's base \(LOOKUP_BASE\), and its checkout does not hold that commit\. Mend: /mu.test(lacking.out), "a base the job names that its checkout does not hold fails the lookup, saying its mend", lacking.out);
  } finally {
    for (const [k, v] of [["GITHUB_EVENT_NAME", was.event], ["LOOKUP_BASE", was.base]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(dir, { recursive: true, force: true });
  }
}

process.exit(failed ? 1 : 0);
