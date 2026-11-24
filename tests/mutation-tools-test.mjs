// Tests the mutation tool a project's manifest names from the core's list (scripts/mutation-tools.mjs and its list
// mutation-tools.json; #1107): the list's tools on the floor's list of licences and Stryker at the version the core's
// own runs pin; the row read from a project's code, tests and test runner; a row the project wrote kept, and one the kit
// or the script gave filled again, its reasons matched whole; and --write in a scratch repository, which writes the row,
// the tool's package list and its npm config, each through no link, names the lock under the size marks' "skip", and
// says what is left: the lock file, the entries of the licence check's config at the path the project's call gives it,
// the data packages among them, and the job's install and step. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/mutation-tools-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIST, NO_TESTS, NPMRC, fillable, folderOf, leftFor, lineOf, named, packageList, readProject, rowFor, setUp, testRunner, written } from "../scripts/mutation-tools.mjs";
import { scratch, scratchDir } from "../scripts/scratch-core.mjs";
import { licenceOk, policy } from "../scripts/licences.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { toolOf } from "../scripts/strength.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT = path.join(ROOT, "scripts/mutation-tools.mjs"), SCRIPT_URL = new URL("../scripts/mutation-tools.mjs", import.meta.url).href;

// ---- the list ----
const floor = fs.readFileSync(path.join(ROOT, "floor/topics/licences.md"), "utf8").split("\n").slice(0, 12).join(" ");
ok(Object.values(LIST.tools).every(t => t.licence && floor.includes(t.licence)), "each tool of the list carries a licence of the floor's first list (rule 10)");
ok(LIST.languages.every(l => LIST.tools[l.tool]), "each language of the list names a tool the list holds");
const core = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/mutation/package.json"), "utf8"));
const stryker = LIST.tools.Stryker;
ok(core.devDependencies[stryker.package] === stryker.version && same(core.overrides, stryker.overrides) && same(JSON.parse(packageList(stryker)), core),
  "Stryker stands in the list at the version and overrides the core's own runs pin, and the package list it writes is the core's own");
// (the packages of the core's lock the tools' list takes only as data are the list's "data", named so by the core's config)
const pol = policy({}), as = (v, kind) => licenceOk(v.license, pol.allowedFor("", false, kind));
const asData = [...new Set(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, "tests/mutation/package-lock.json"), "utf8")).packages).filter(([k, v]) => k && !as(v) && as(v, "data")).map(([k]) => k.split("node_modules/").pop()))].sort();
ok(asData.length && same(asData, [...stryker.data].sort()) && asData.every(n => JSON.parse(fs.readFileSync(path.join(ROOT, ".github/licences.json"), "utf8")).data.includes(n)), "Stryker's lock's data packages are the list's \"data\", as the core's config names them (#1247, point 1)", asData);
ok(NPMRC === fs.readFileSync(path.join(ROOT, "tests/mutation/.npmrc"), "utf8"), "the npm config written beside it is the core's own folder's: no install script, no release under a week old");
ok(Object.values(LIST.tools).every(t => (t.command ? !t.none && /^[\w.-]+$/.test(t.version) : !!t.none)), "each tool gives a command, its version exact, or the reason the core names it for none");

// ---- the row read ----
const at = o => rowFor({ copy: "core/", runner: null, ...o });
const js = at({ code: ["src/a.mjs", "lib/b.ts"], tests: true, runner: "node" });
ok(js.tool === "Stryker" && js.command === "node core/scripts/stryker.mjs --tool checks/mutation --report {report} {lines}" && same(toolOf(lineOf(js)).command.slice(0, 2), ["node", "core/scripts/stryker.mjs"]),
  "JavaScript and TypeScript run by node name Stryker through the copy's stryker.mjs, a row the strength check reads");
ok(at({ code: ["a.js"], tests: true }).command?.startsWith("node core/") && at({ code: ["a.js"], tests: true, copy: "vendor/core/" }).command.includes("node vendor/core/scripts/stryker.mjs"),
  "a project whose package.json gives no test script still names Stryker, and a copy at another path is named at its path");
ok(at({ code: ["a.js"], tests: true, runner: "jest" }).none?.includes("`jest`"), "tests run by another runner give none, naming that runner");
ok(at({ code: ["a.cs"], tests: true }).none === LIST.tools["Stryker.NET"].none && at({ code: ["a.py"], tests: true }).none === LIST.tools.mutmut.none,
  "C# and Python give none with the reason the list gives for their tool");
const two = at({ code: ["a.ts", "b.ts", "c.py", "d.go"], tests: true }), tie = at({ code: ["a.js", "b.py"], tests: true }).none;
ok(two.tool === "Stryker" && same(two.rest, [".go", "Python"]) && lineOf(two).endsWith("; its .go and Python code not measured |") && same(toolOf(lineOf(two)).command, toolOf(lineOf(js)).command)
  && tie?.includes("1 file each") && fillable(lineOf({ none: tie })) && at({ code: ["a.go", "b.go", "c.js"], tests: true }).none?.includes(".go"),
  "code in the languages of more tools, or of one the list does not know, is measured in its main one, the rest named; a tie gives none");
ok(same(at({ code: ["a.js"], tests: false }), { none: NO_TESTS }) && toolOf(lineOf({ none: NO_TESTS })).none.startsWith("no tests yet") && at({ code: [], tests: true }).none?.startsWith("no code yet"),
  "a project with no tests, or with tests and no code the list knows, gives none, its reason starting so");
ok(testRunner('{"scripts":{"test":"  node --test tests/"}}') === "node" && testRunner('{"scripts":{}}') === null && testRunner("{ not json") === null && testRunner(null) === null,
  "the test runner is the first word of package.json's test script, or none where it gives none");
const jest = testRunner('{"scripts":{"test":"node --experimental-vm-modules node_modules/jest/bin/jest.js"}}');
ok(jest === "node node_modules/jest/bin/jest.js" && at({ code: ["a.mjs"], tests: true, runner: jest }).none?.includes("node_modules/jest/bin/jest.js"),
  "a test script that runs another runner through node names that runner, and the list's tool is not named for it");

// ---- a row the project wrote is kept ----
const MANIFEST = row => `# Core manifest\n\n## Slots\n| Slot | Here |\n| --- | --- |\n| *owner's account* | someone |\n${row}\n## Differences\nNone.\n`;
ok(fillable(MANIFEST("")) && fillable(MANIFEST(lineOf({ none: NO_TESTS }))) && fillable(MANIFEST("| *mutation tool* | `none`: no tests yet; the builder who adds the first names the tool here (`core/tasks/code-shape.md`) |"))
  && fillable(MANIFEST(lineOf(at({ code: ["a.cs"], tests: true })))) && fillable(MANIFEST(lineOf(at({ code: ["a.js"], tests: true, runner: "jest" }))))
  && fillable(MANIFEST("| *mutation tool* | `none` |")),
  "a row that is not there, says `none` with no reason, or holds a reason the kit or the list gives, an older kit's included, is filled again");
// (tests vitest runs, installed as the root's npm lock file shows it, name Stryker with each test run by vitest: #1274)
const vi = at({ code: ["src/a.ts"], tests: true, runner: "vitest", locked: true }), unlocked = at({ code: ["src/a.ts"], tests: true, runner: "vitest", locked: false }).none;
ok(vi.tool === "Stryker" && vi.command === "node core/scripts/stryker.mjs --tool checks/mutation --runner vitest --report {report} {lines}" && folderOf(toolOf(lineOf(vi)).command) === "checks/mutation",
  "tests vitest runs, the root's npm lock file holding vitest, name Stryker with its tests run by vitest, installed where the list says (#1274)");
ok(/^its tests run by `vitest` \(package\.json's test script\), and no package-lock\.json at the project's root holds vitest, which is read to know it is installed: .*commit the lock file/.test(unlocked ?? "") && fillable(MANIFEST(lineOf({ none: unlocked }))),
  "where no npm lock file at the root shows vitest installed, none, saying what to commit, a reason filled again once it is", unlocked);
ok(fillable(MANIFEST("| *mutation tool* | `none`: its tests run by `vitest` (package.json's test script), and the core runs Stryker only on tests run by `node <file>` (`core/scripts/stryker.mjs`) |"))
  && /only on tests run by `node <file>` or `vitest run <file>`/.test(at({ code: ["a.js"], tests: true, runner: "jest" }).none ?? ""),
  "the reason written before #1274 for a vitest project is filled again, and another runner's names both the core runs");
const optioned = at({ code: ["src/a.ts"], tests: true, runner: "vitest", locked: true, plain: false }).none;
ok(/^its tests run by `vitest` \(package\.json's test script\) with more than `vitest run`, which the core does not give each test's run: .*vitest's config/.test(optioned ?? "") && fillable(MANIFEST(lineOf({ none: optioned }))),
  "a vitest test script with options of its own (--globals, say), which each test's run would lose, gives none, saying the mend, a reason filled again", optioned);
ok(!fillable(MANIFEST("| *mutation tool* | `none`: the owner keeps the measure off for this prototype |")) && !fillable(MANIFEST("| *mutation tool* | `node checks/mutate.mjs {lines}` |")),
  "a command, or a `none` with the project's own reason, is the project's and stays (#1107, point 3)");
ok(!fillable(MANIFEST("| *mutation tool* | `none`: no tests yet worth measuring, a prototype |")) && !fillable(MANIFEST("| *mutation tool* | `none`: its code is in flux, the owner's call |")),
  "an owner's own reason that starts as one the script gives is the owner's, and stays: the script's reasons are matched whole");
const crlf = written(MANIFEST(lineOf({ none: NO_TESTS })).replaceAll("\n", "\r\n"), js);
ok(crlf.includes(`${lineOf(js)}\r\n`) && !/[^\r]\n/.test(crlf), "a manifest with CRLF line ends keeps them, the row written in place included");
const filled = written(MANIFEST(lineOf({ none: NO_TESTS })), js);
ok(filled.includes(lineOf(js)) && !filled.includes(NO_TESTS) && filled.split("\n").length === MANIFEST(lineOf(js)).split("\n").length, "the row is written in place of the one that stands");
const added = written(MANIFEST(""), js).split("\n");
ok(added[added.indexOf("| *owner's account* | someone |") + 1] === lineOf(js), "a row that is not there is written after the last row of the slots");

// ---- --write, in a scratch repository ----
const dir = scratchDir("mutation-tools-test-");
const sh = (...args) => execFileSync("git", ["-c", "core.fsmonitor=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const put = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: "utf8" });
const read = f => fs.readFileSync(path.join(dir, f), "utf8");
try {
  sh("init", "-q", "-b", "main");
  put("core-manifest.md", MANIFEST(lineOf({ none: NO_TESTS })));
  put("src/a.mjs", "export const a = 1;\n");
  let r = run("--write");
  ok(r.status === 0 && read("core-manifest.md").includes(NO_TESTS) && !fs.existsSync(path.join(dir, "checks/mutation")), "with no tests, --write leaves none and writes no tool's folder", r.stdout + r.stderr);
  put("tests/a-test.mjs", "import '../src/a.mjs';\n");
  put("package.json", '{"scripts":{"test":"node tests/a-test.mjs"}}');
  r = run();
  ok(r.status === 0 && r.stdout.includes("Read: 1 files of code (JavaScript), tests, the tests run by node.") && read("core-manifest.md").includes(NO_TESTS), "without --write it prints what it read and the row, and writes nothing", r.stdout + r.stderr);
  r = run("--write");
  ok(r.status === 0 && read("core-manifest.md").includes(lineOf(js)) && same(JSON.parse(read("checks/mutation/package.json")), core) && read("checks/mutation/.npmrc") === NPMRC
    && /Left to do: commit checks\/mutation\/package\.json with its lock file/.test(r.stdout) && /Left to do: name checks\/mutation\/package-lock\.json under "lockfiles"/.test(r.stdout)
    && /Left to do: name checks\/mutation\/\.npmrc under "ignoreScriptsIn"/.test(r.stdout) && /Left to do: in the project's own job .*node core\/scripts\/strength\.mjs .*two security reviews/.test(r.stdout),
    "once there are tests, --write names Stryker, writes its package list and npm config, and says the lock file, the licence check's entries and the job's two steps are left", r.stdout + r.stderr);
  ok(/Left to do: have any audit the project keeps of its own lock files read checks\/mutation\/package-lock\.json too/.test(r.stdout),
    "--write names any audit the project keeps of its lock files, which must read the tool's lock too (#1265, point 3)", r.stdout + r.stderr);
  // (the licence check's config where the project's call gives it, and the lock named under the size marks' "skip": #1247, points 3 and 2)
  fs.rmSync(path.join(dir, "checks/mutation"), { recursive: true });
  put(".github/workflows/licences.yml", `on: pull_request\njobs:\n  licences:\n    uses: ${CORE}/.github/workflows/licences.yml@${"0".repeat(40)}\n    with:\n      config: policy/licences.json\n`);
  put("policy/licences.json", '{"lockfiles":[]}');
  put("checks/sizes.json", '{"each":1,"read":{},"total":1,"split":1,"skip":["docs/"]}\n');
  sh("add", "-A");
  sh("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "--no-gpg-sign", "-m", "the project");
  r = run("--write");
  const skip = () => same(JSON.parse(read("checks/sizes.json")).skip, ["docs/", "checks/mutation/package-lock.json"]);
  ok(r.status === 0 && /"lockfiles" in the licence check's config \(policy\/licences\.json\)/.test(r.stdout) && /under "data" in that config/.test(r.stdout) && skip() && run("--write").status === 0 && skip(),
    "--write reads the licence check's config at the path the project's call gives, asks its data packages, and names the lock under the size marks' \"skip\", once", r.stdout + r.stderr);
  put("checks/mutation/package-lock.json", "{}");
  const has = f => fs.existsSync(path.join(dir, f)), config = { lockfiles: ["checks/mutation/package-lock.json"], ignoreScriptsIn: ["checks/mutation/.npmrc"], data: stryker.data };
  ok(leftFor(stryker, has, config).length === 0 && leftFor(stryker, has, { lockfiles: config.lockfiles, data: config.data }).length === 1 && leftFor(undefined, () => false).length === 0,
    "nothing is left once the lock file stands and the licence check's config names it, the npm config and the data packages, and each entry it lacks is asked; nothing for a row that names no tool");
  fs.writeFileSync(path.join(dir, "checks/mutation/package.json"), packageList({ ...stryker, version: "9.0.0" }));
  ok(/names @stryker-mutator\/core at 9\.0\.0, where the core's list gives 10\.1\.1\. Mend: take checks\/mutation\/package\.json out and run/.test(named({ root: dir, manifest: read("core-manifest.md") }) ?? ""),
    "a package list behind the list's version is named, its mend the writer");
  fs.writeFileSync(path.join(dir, "checks/mutation/package.json"), packageList(stryker));
  put("core-manifest.md", MANIFEST("| *mutation tool* | `none`: the owner keeps the measure off |"));
  r = run("--write");
  ok(r.status === 0 && read("core-manifest.md").includes("the owner keeps the measure off") && r.stdout.includes("is the project's own"), "--write keeps the project's own none", r.stdout + r.stderr);
  // (the row the list gives, standing with no package list, as an older kit wrote it: the check asks for the list and
  // --write writes it; setUp writes over nothing that stands)
  fs.rmSync(path.join(dir, "checks"), { recursive: true, force: true });
  put("core-manifest.md", MANIFEST(lineOf(js)));
  const p = { root: dir, manifest: read("core-manifest.md") };
  ok(/checks\/mutation\/package\.json, the package list it is installed from, is not there as a file of the project.s own\. Mend: run `node core\/scripts\/mutation-tools\.mjs --write`/.test(named(p) ?? ""), "the list's row with no package list is named, its mend the writer", named(p));
  r = run("--write");
  ok(r.status === 0 && same(JSON.parse(read("checks/mutation/package.json")), core) && named(p) === null, "--write writes the package list where the list's row already stands, and the check then passes", r.stdout + r.stderr);
  put("checks/mutation/package.json", "{}\n");
  ok(same(setUp(dir, js).written, []) && read("checks/mutation/package.json") === "{}\n" && same(setUp(dir, { none: NO_TESTS }).written, []), "setUp writes over no package list or npm config that stands, and writes none for a row that names no tool");
  // (a pipe where package.json stands is read as no file, and the read ends: a child, so that a read that hangs fails;
  // where the system makes no pipe, as Windows, the case is the one without it: a file that reads as none)
  fs.rmSync(path.join(dir, "package.json"));
  if (process.platform === "win32" || spawnSync("mkfifo", [path.join(dir, "package.json")]).status !== 0) put("package.json", "{ not json");
  const piped = spawnSync(process.execPath, ["--input-type=module", "-e", `const m = await import(${JSON.stringify(SCRIPT_URL)}); console.log(JSON.stringify(m.readProject(${JSON.stringify(dir)}, "")));`], { encoding: "utf8", timeout: 20000 });
  ok(piped.status === 0 && JSON.parse(piped.stdout || "{}").runner === null, "a pipe where package.json stands is read as none, and the read ends", piped.stdout + piped.stderr + (piped.error?.message ?? ""));
  fs.rmSync(path.join(dir, "package.json"));
  // (vitest, as the test script names it, read as installed only where the root's npm lock file holds it there: #1274)
  put("package.json", '{"scripts":{"test":"vitest run"}}\n');
  const lockOf = packages => put("package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: { "": {}, ...packages } }));
  lockOf({ "node_modules/vitest": { version: "3.2.4", dev: true } });
  const locked = readProject(dir, "");
  lockOf({ "node_modules/other/node_modules/vitest": { version: "3.2.4" } });
  const nested = readProject(dir, "");
  put("package-lock.json", "{ not json");
  const broken = readProject(dir, "");
  fs.rmSync(path.join(dir, "package-lock.json"));
  const unlockedProject = readProject(dir, "");
  ok(locked?.runner === "vitest" && locked.locked === true && nested?.locked === false && broken?.locked === false && unlockedProject?.locked === false,
    "vitest is read as installed where the root's npm lock file holds it at the root, and not where it holds it deeper, cannot be read or is not there", JSON.stringify({ locked, nested, broken, unlockedProject }));
  const plainOf = script => { put("package.json", JSON.stringify({ scripts: { test: script } })); return readProject(dir, "")?.plain; };
  ok(plainOf("vitest run") === true && plainOf(" vitest ") === true && plainOf("vitest run --globals") === false && plainOf("vitest run && node x.mjs") === false && plainOf("node --test") === true,
    "a vitest test script is plain where it holds vitest, or vitest run, alone; another runner's is not read for it");
  fs.rmSync(path.join(dir, "package.json"));
  // (a link where checks/ stands, to a folder outside the project: nothing is written through it, and what is left says
  // so; where the system makes no link, the case is the one of a file where the folder should be)
  const outside = scratchDir("mutation-tools-outside-");
  fs.rmSync(path.join(dir, "checks"), { recursive: true, force: true });
  try { fs.symlinkSync(outside, path.join(dir, "checks"), "dir"); } catch { put("checks", "not a folder\n"); }
  const through = setUp(dir, js);
  ok(same(through.written, []) && !fs.existsSync(path.join(outside, "mutation")) && /make checks\/mutation a folder of the project's own/.test(through.blocked ?? ""), "a link or a file on the tool folder's path is written through to nothing, and what is left says so", JSON.stringify(through));
  fs.rmSync(path.join(dir, "checks"), { recursive: true, force: true });
  // (a manifest that is a link, to a file outside the project: --write neither reads nor writes through it, and says the
  // mend; where the system makes no link, the case is skipped, as nothing then can be one)
  const kept = MANIFEST(lineOf({ none: NO_TESTS }));
  fs.writeFileSync(path.join(outside, "core-manifest.md"), kept);
  fs.rmSync(path.join(dir, "core-manifest.md"));
  let linkedManifest = true;
  try { fs.symlinkSync(path.join(outside, "core-manifest.md"), path.join(dir, "core-manifest.md"), "file"); } catch { linkedManifest = false; }
  if (linkedManifest) {
    r = run("--write");
    ok(r.status === 1 && /core-manifest\.md is reached through a link.*Mend: /.test(r.stderr) && fs.readFileSync(path.join(outside, "core-manifest.md"), "utf8") === kept,
      "a manifest reached through a link is neither read nor written through it, and the failure says the mend", r.stdout + r.stderr);
  }
  fs.rmSync(path.join(dir, "core-manifest.md"));
  put("core-manifest.md", kept);
  fs.rmSync(outside, { recursive: true, force: true });
  // (a command the repository's own config names as its fsmonitor runs not when the reader lists its files)
  const hook = path.join(dir, "fsmonitor-hook"), marker = path.join(dir, "fsmonitor-ran");
  fs.writeFileSync(hook, `#!/bin/sh\ntouch "${marker}"\n`, { mode: 0o755 });
  sh("config", "core.fsmonitor", hook);
  readProject(dir, "");
  ok(!fs.existsSync(marker), "the reader lists the project's files with its fsmonitor off, so the command its config names does not run");
  sh("config", "--unset", "core.fsmonitor");
  r = run("--wrte");
  ok(r.status === 1 && /Mend: /.test(r.stderr), "an unknown argument fails with its mend", r.stderr);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---- the round trip (#1108): in a project the starter kit writes of each kind the upgrade test holds, once it holds code and
// tests, what --write writes is read back by the strength check's reader and the step's ----
{
  const { git, run: runIn, project: kitProject } = scratch("mutation-tools-round-trip-");
  const kinds = [
    { name: "An npm project", args: ["--npm", "."], code: ["src/app.js", "export const one = () => 1;\n"], test: ["tests/app.test.js", "import { one } from \"../src/app.js\";\nif (one() !== 1) process.exit(1);\n"] },
    { name: "A private .NET project", args: ["--nuget", ".", "--private"], crlf: true, code: ["src/App.cs", "public static class App { public static int One() => 1; }\n"], test: ["tests/AppTests.cs", "public class AppTests { }\n"] },
  ];
  for (const k of kinds) {
    const p = kitProject(k.name.replace(/\W+/gu, "-"), "--owner", "the-owner", "--name", k.name, ...k.args);
    ok(p.status === 0, `round trip, ${k.name}: the starter kit writes a project`, p.out);
    for (const [f, text] of [k.code, k.test]) { fs.mkdirSync(path.dirname(path.join(p.dir, f)), { recursive: true }); fs.writeFileSync(path.join(p.dir, f), text); }
    git(p.dir, "add", "-A");
    git(p.dir, "commit", "-q", "-m", "the kit, code and tests");
    if (k.crlf) {
      git(p.dir, "config", "core.autocrlf", "true");
      const at = path.join(p.dir, "core-manifest.md");
      fs.writeFileSync(at, fs.readFileSync(at, "utf8").replace(/\r?\n/g, "\r\n"));
    }
    const done = runIn(p.dir, "core/scripts/mutation-tools.mjs", "--write");
    const manifest = fs.readFileSync(path.join(p.dir, "core-manifest.md"), "utf8"), tool = toolOf(manifest), step = named({ root: p.dir, manifest });
    const row = k.crlf ? tool?.none !== undefined && tool.none.length > 0 && !/^no (?:tests|code) yet/u.test(tool.none) : tool?.command?.[1] === "core/scripts/stryker.mjs";
    const folder = path.join(p.dir, stryker.folder), kept = fs.existsSync(path.join(folder, "package.json"));
    ok(done.status === 0 && row && step === null && (k.crlf ? !kept : JSON.parse(fs.readFileSync(path.join(folder, "package.json"), "utf8")).devDependencies?.[stryker.package] === stryker.version && fs.readFileSync(path.join(folder, ".npmrc"), "utf8") === NPMRC),
      `round trip, ${k.name}: the row and the package list written are read back by the strength check's reader and the step's`, `${done.out}\n${JSON.stringify(tool)}\n${step}`);
  }
}

console.log(`\n${count - failed}/${count} passed`);
if (failed) process.exitCode = 1;
