// Tests the mutation tool a project's manifest names from the core's list (scripts/mutation-tools.mjs and its list
// mutation-tools.json; #1107): the list's tools on the floor's list of licences and Stryker at the version the core's
// own runs pin; the row read from a project's code, tests and test runner; a row the project wrote kept, and one the kit
// or the script gave filled again; and --write in a scratch repository, which writes the row and the tool's package
// list and says what is left. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/mutation-tools-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIST, NO_TESTS, fillable, leftFor, lineOf, packageList, rowFor, testRunner, written } from "../scripts/mutation-tools.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { toolOf } from "../scripts/strength.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT = path.join(ROOT, "scripts/mutation-tools.mjs");

// ---- the list ----
const floor = fs.readFileSync(path.join(ROOT, "floor/topics/licences.md"), "utf8").split("\n").slice(0, 12).join(" ");
ok(Object.values(LIST.tools).every(t => t.licence && floor.includes(t.licence)), "each tool of the list carries a licence of the floor's first list (rule 10)");
ok(LIST.languages.every(l => LIST.tools[l.tool]), "each language of the list names a tool the list holds");
const core = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/mutation/package.json"), "utf8"));
const stryker = LIST.tools.Stryker;
ok(core.devDependencies[stryker.package] === stryker.version && same(core.overrides, stryker.overrides) && same(JSON.parse(packageList(stryker)), core),
  "Stryker stands in the list at the version and overrides the core's own runs pin, and the package list it writes is the core's own");
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
ok(at({ code: ["a.js", "b.py"], tests: true }).none?.includes("one tool") && at({ code: ["a.go"], tests: true }).none?.includes(".go"),
  "code in languages of two tools, or of one the list does not know, gives none with why");
ok(same(at({ code: ["a.js"], tests: false }), { none: NO_TESTS }) && toolOf(lineOf({ none: NO_TESTS })).none.startsWith("no tests yet") && at({ code: [], tests: true }).none?.startsWith("no code yet"),
  "a project with no tests, or with tests and no code the list knows, gives none, its reason starting so");
ok(testRunner('{"scripts":{"test":"  node --test tests/"}}') === "node" && testRunner('{"scripts":{}}') === null && testRunner("{ not json") === null && testRunner(null) === null,
  "the test runner is the first word of package.json's test script, or none where it gives none");

// ---- a row the project wrote is kept ----
const MANIFEST = row => `# Core manifest\n\n## Slots\n| Slot | Here |\n| --- | --- |\n| *owner's account* | someone |\n${row}\n## Differences\nNone.\n`;
ok(fillable(MANIFEST("")) && fillable(MANIFEST(lineOf({ none: NO_TESTS }))) && fillable(MANIFEST("| *mutation tool* | `none`: no tests yet; the builder who adds the first names the tool here (`core/tasks/code-shape.md`) |"))
  && fillable(MANIFEST(lineOf(at({ code: ["a.cs"], tests: true })))) && fillable(MANIFEST(lineOf(at({ code: ["a.js"], tests: true, runner: "jest" }))))
  && fillable(MANIFEST("| *mutation tool* | `none` |")),
  "a row that is not there, says `none` with no reason, or holds a reason the kit or the list gives, an older kit's included, is filled again");
ok(!fillable(MANIFEST("| *mutation tool* | `none`: the owner keeps the measure off for this prototype |")) && !fillable(MANIFEST("| *mutation tool* | `node checks/mutate.mjs {lines}` |")),
  "a command, or a `none` with the project's own reason, is the project's and stays (#1107, point 3)");
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
  ok(r.status === 0 && read("core-manifest.md").includes(lineOf(js)) && same(JSON.parse(read("checks/mutation/package.json")), core) && /Left to do: commit checks\/mutation\/package\.json with its lock file/.test(r.stdout) && /Left to do: install it in the project's own job/.test(r.stdout),
    "once there are tests, --write names Stryker, writes its package list, and says the lock file and the install are left", r.stdout + r.stderr);
  put("checks/mutation/package-lock.json", "{}");
  ok(leftFor(stryker, f => fs.existsSync(path.join(dir, f))).length === 0 && leftFor(undefined, () => false).length === 0, "nothing is left once the lock file stands, nor for a row that names no tool");
  put("core-manifest.md", MANIFEST("| *mutation tool* | `none`: the owner keeps the measure off |"));
  r = run("--write");
  ok(r.status === 0 && read("core-manifest.md").includes("the owner keeps the measure off") && r.stdout.includes("is the project's own"), "--write keeps the project's own none", r.stdout + r.stderr);
  r = run("--wrte");
  ok(r.status === 1 && /Mend: /.test(r.stderr), "an unknown argument fails with its mend", r.stderr);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${count - failed}/${count} passed`);
if (failed) process.exitCode = 1;
