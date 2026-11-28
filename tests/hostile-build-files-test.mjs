// Hostile tests for one input the core reads (floor topic 5, "Every named input has hostile tests"): a project's build,
// package and workflow files (package.json, package-lock.json, packages.lock.json, the licence check's config with its
// "nuget" and "agentTools", .github/workflows/*.yml, an agent tool's settings), which anyone who opens a pull request
// writes. Read by licences.mjs (its lock and config readers), exact-versions.mjs, nuget.mjs (its lock and config
// readers; its build files' XML has its own hostile block in nuget-test.mjs, "const hostile", near line 223, not
// repeated here; its project readers' links out of the project), workflows.mjs with yaml-keys.mjs (the tools it runs aside, which the trial of #580 read on such files), parse-yaml.mjs (parseYaml, #864), sync.mjs (the move
// of the pins in the workflows), runners.mjs (#733), and agent-tools-links.mjs (its links out of the checkout:
// agent-tools-links-test.mjs). Each case is refused: nothing of it is taken as a pass or a value, and a failure
// says its mend. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/hostile-build-files-test.mjs
import { spawnSync } from "../scripts/check-runs.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configured } from "../scripts/agent-tools-configured.mjs";
import { listed } from "../scripts/agent-tools-entries.mjs";
import { check as exactCheck, exact } from "../scripts/exact-versions.mjs";
import { check as licenceCheck, licenceOk, loadConfig, lockPathOk, workspacesIn } from "../scripts/licences.mjs";
import { quick, said, scratch } from "../scripts/hostile.mjs";
import { mended } from "../scripts/mend.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { NOT_A_FILE, lockPackages, nugetConfig, plainText, projectFilesByContent, readProject as readBuildFile } from "../scripts/nuget.mjs";
import { ownFiles } from "../scripts/own-files.mjs";
import { moveCalls } from "../scripts/sync.mjs";
import { draftHoles, lines, readable } from "../scripts/workflows.mjs";
import { twice } from "../scripts/yaml-keys.mjs";
import { parserLeftOut } from "../scripts/packages.mjs";
import { read as runnersRead, workflowsIn } from "../scripts/runners.mjs";
import { OWNER, scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const { fresh } = scratch("hostile-build-files-test");
const throwsMended = (fn) => { try { fn(); return false; } catch (e) { return !(e instanceof RangeError) && mended(`FAIL: ${e.message}`); } };
const text = (v) => (typeof v === "string" ? v : JSON.stringify(v));
// exact-versions on files in memory: the lock file and the root's package.json
const exactOn = (lock, list) => {
  const files = { "package-lock.json": text(lock), ...(list === undefined ? {} : { "package.json": text(list) }) };
  return exactCheck("package-lock.json", (p) => { if (!Object.hasOwn(files, p)) throw new Error(`no such file: ${p}`); return files[p]; });
};
const oneDep = (spec, version = "1.0.0") => exactOn({ packages: { "": {}, "node_modules/moss-a": { version } } }, { dependencies: { "moss-a": spec } });
// the licence check on a project of one lock file
const lockProject = (packages) => fresh({ "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": {}, ...packages } }), "package.json": "{}" });
const licences = (dir) => licenceCheck({ lockfiles: ["package-lock.json"], ships: [] }, dir);
const configFile = (c) => { const f = path.join(fresh(), "c.json"); fs.writeFileSync(f, text(c)); return f; };
const ALLOW = new Set(["MIT"]);
const nuLock = (lock) => lockPackages(text(lock), "packages.lock.json");
const nuEntry = (id, e) => ({ version: 1, dependencies: { net9: { [id]: { type: "Direct", resolved: "1.0.0", requested: "[1.0.0]", contentHash: "x", ...e } } } });
const settings = (t) => configured((f) => (f === ".claude/settings.json" ? t : null), () => []);
const tool = (e) => listed({ agentTools: [{ kind: "plugin", name: "p", publisher: "moss", version: "1.0.0", ...e }] }, "c.json");

// ---- too long ----
{
  const many = Array.from({ length: 30000 }, (_, i) => `moss-${i}`), each = (v) => Object.fromEntries(many.map((m) => [`node_modules/${m}`, v]));
  let r;
  ok(quick(() => (r = exactOn({ packages: { "": {}, ...each({ version: "1.0.0" }) } }, { dependencies: Object.fromEntries(many.map((m) => [m, "^1.0.0"])) })).length === 30000 && said(r)), "exact-versions reads thirty thousand packages, a range each, and fails each with its mend, in a few seconds");
  ok(quick(() => !exact(`1.0.0-${"a".repeat(1_000_000)}`) && oneDep(`1.0.0-${"a".repeat(1_000_000)}`).length === 1), "a version a megabyte long is no exact version");
  ok(quick(() => !licenceOk(`${"MIT AND ".repeat(50000)}Moss-1.0`, ALLOW) && !licenceOk(`${"(".repeat(20000)}MIT${")".repeat(20000)}`, ALLOW)), "a licence of fifty thousand terms, one off the list, or nested twenty thousand deep, is not allowed");
  ok(quick(() => (r = licences(lockProject(each({ version: "1.0.0", license: "Moss-1.0" })))).failures.length === 30000 && said(r.failures)), "the licence check fails thirty thousand packages off its list, each with its mend, in a few seconds");
  ok(quick(() => (r = nuLock({ version: 1, dependencies: { net9: Object.fromEntries(many.map((m) => [m, { type: "Direct", resolved: "1.0.0", requested: "[1.0.0, 2.0.0)", contentHash: "x" }])) } })).failures.length === 30000 && said(r.failures)), "NuGet's lock reader fails thirty thousand packages asked for by a range, each with its mend");
  ok(quick(() => twice(`on: push\njobs:\n${"  j:\n    runs-on: x\n".repeat(8000)}`).length === 7999 && JSON.stringify(twice(`on: push\njobs:\n${"  j:\n    runs-on: x\n".repeat(100000)}`)) === '[{"line":1,"key":null,"first":null,"size":true}]' && lines("\\x70".repeat(1_000_000)).length === 0), "a workflow of a few hundred kilobytes is read for keys given twice, one of megabytes is said unread, and the forbidden trigger is searched for in both, in a few seconds");
  // (a text of three million `[`, about 3 MB, ran Node out of heap in the package's parser: #752; it is not given to it)
  ok(quick(() => JSON.stringify(twice(`a: ${"[".repeat(3e6)}\n`)) === '[{"line":1,"key":null,"first":null,"size":true}]' && draftHoles(`a: ${"[".repeat(3e6)}\n`).length === 0), "a text of three million opening brackets is said unread at once, by both readers of a workflow, never given to the parser");
  ok(quick(() => twice("]".repeat(100000)).length === 0 && twice(`{${",".repeat(100000)}`).length === 0 && twice("!t ".repeat(50000)).length === 0), "a text of a hundred thousand closing brackets or commas, or of fifty thousand tags, each an error the package reads, is read in a few seconds");
  ok(quick(() => [`a: ${"{b: ".repeat(50000)}`, Array.from({ length: 5000 }, (_, i) => `${" ".repeat(i)}k:`).join("\n")].every(t => JSON.stringify(twice(t).map(k => k.key)) === "[null]")), "a flow value fifty thousand deep, or keys indented five thousand deep, are read without a throw, and said to be read only in part");
  // (the same text through parseYaml, which reads a project's own workflow for check.mjs, own-runs.mjs and steps.mjs: #864;
  // it runs as its own process so that a reader that gave it to the package would end in the run's timeout or an exit
  // with no mend, and no clock is read here)
  const big = spawnSync(process.execPath, ["--input-type=module", "-e", `import { parseYaml } from ${JSON.stringify(new URL("../scripts/parse-yaml.mjs", import.meta.url).href)};
    const say = (t) => { try { parseYaml(t); return "read"; } catch (e) { return "FAIL: " + e.message; } };
    console.log(say("a: " + "[".repeat(3e6) + "\\n")); console.log(say("# " + "x".repeat(262144) + "\\na: 1\\n")); console.log(say("# " + "x".repeat(262000) + "\\na: 1\\n"));`], { encoding: "utf8", timeout: 10000 });
  const [huge, past, under] = big.stdout.split("\n");
  ok(big.status === 0 && mended(huge) && /longer than 262144 characters/u.test(huge) && mended(past) && under === "read" && !/\n\s+at /u.test(big.stderr), "parseYaml refuses three million opening brackets, and a text one character past the length read, with its mend and never to the package, and reads one under it");
  ok(quick(() => settings(JSON.stringify({ hooks: { Stop: [{ hooks: many.map((m) => ({ type: "command", command: `echo ${m}` })) }] } })).tools.size === 30000), "thirty thousand agent hooks are read in a few seconds");
  ok(quick(() => (r = listed({ agentTools: many.map((m) => ({ kind: "plugin", name: m, publisher: "moss", version: "^1" })) }, "c.json")).problems.length === 30000 && said(r.problems)), "thirty thousand agentTools entries pinned to a range each fail with their mend");
}

// ---- the wrong type ----
{
  ok([5, { "^": 1 }, ["1.0.0"], null, true].every((spec) => !exact(spec) && said(oneDep(spec))), "a version given as a number, an object, a list, null or true is no exact version, and fails with its mend");
  ok(said(exactOn({ packages: { "": {} } }, { dependencies: ["moss-a"] })) && exactOn("[]").length === 1, "a package list that is a list, or a lock file that is one, is refused");
  ok([5, { type: "MIT" }, [{ type: "MIT" }], ["MIT"], null, undefined, true].every((l) => !licenceOk(l, ALLOW)), "a licence given as a number, an object, a list of objects or of names, null or true is not allowed");
  const typed = licences(lockProject({ "node_modules/moss-a": { version: "1.0.0", license: 5 }, "node_modules/moss-b": { version: "1.0.0", license: { type: "MIT" } }, "node_modules/moss-c": { version: "1.0.0", license: [{ type: "MIT" }] } }));
  ok(typed.failures.length === 3 && said(typed.failures), "the licence check fails a lock file's licence of the wrong type, each with its mend");
  ok([{ lockfiles: "package-lock.json", ships: [] }, { lockfiles: [], ships: 5 }, { lockfiles: [5], ships: [] }, { lockfiles: ["package-lock.json"], ships: [], audit: 5 }, [], "5"].every((c) => throwsMended(() => loadConfig(configFile(c)))), "a licence config with a list, path or object of the wrong type is refused, with its mend");
  ok(throwsMended(() => licences(fresh({ "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: [] }), "package.json": "{}" }))) && throwsMended(() => licences(lockProject({ "node_modules/moss-a": "1.0.0" }))), "a lock file whose packages are a list, or whose entry is a string, is refused whole, with its mend");
  ok(throwsMended(() => nugetConfig({ nuget: [] })) && throwsMended(() => nugetConfig({ nuget: { ships: "packages.lock.json" } })) && throwsMended(() => nugetConfig({ nuget: { sources: [5] } })), "a NuGet config of the wrong type is refused, with its mend");
  ok([{ version: "1", dependencies: {} }, { version: 1, dependencies: [] }, { version: 1, dependencies: { net9: [] } }, nuEntry("M", { resolved: 1 }), nuEntry("M", { type: 5 })].every((l) => { const r = nuLock(l); return r.packages.length === 0 && said(r.failures); }) && said(nuLock(nuEntry("M", { contentHash: 5 })).failures), "NuGet's lock reader refuses a version, list, entry, kind or content hash of the wrong type, with its mend");
  ok(said(settings("[]").problems) && said(settings("null").problems) && said(settings("5").problems), "agent settings that are a list, null or a number are no JSON object, and fail with their mend");
  for (const [what, v] of [["a list", ["moss@market"]], ["a text", "moss@market"], ["a number", 5]]) {
    const r = settings(JSON.stringify({ enabledPlugins: v }));
    ok(r.tools.size === 0 && r.problems.length === 1 && said(r.problems), `an "enabledPlugins" that is ${what} is refused as the wrong shape, with its mend, never read by its indexes`);
  }
  const servers = configured((f) => (f === ".mcp.json" ? JSON.stringify({ mcpServers: ["moss"] }) : null), () => []);
  ok(servers.tools.size === 0 && said(servers.problems), "an \"mcpServers\" that is a list is refused as the wrong shape, with its mend, never read by its indexes");
  const entries = listed({ agentTools: [5, { kind: 1, name: "x", publisher: "y", version: "1.0.0" }, { kind: "plugin", name: 5, publisher: [], version: 1 }] }, "c.json");
  ok(entries.keys.size === 0 && said(entries.problems) && said(listed({ agentTools: "all" }, "c.json").problems), "an agentTools list, or an entry of it, of the wrong type is taken as no entry, with its mend");
  ok(!readable("o\0n\0:\0") && !readable("on: \ufffd"), "a workflow in UTF-16, or holding bytes that are no UTF-8, is not text the search trusts");
}

// ---- markup ----
{
  ok(!exact("<b>1.0.0</b>") && said(oneDep("<b>1.0.0</b>")) && said(oneDep("1.0.0\n::error::x")), "a version holding markup, or a line break and a workflow command, is no exact version");
  ok(!licenceOk("<b>MIT</b>", ALLOW) && !licenceOk("MIT<script>", ALLOW) && !licenceOk("MIT\u2028", ALLOW), "a licence holding markup or a line separator is not allowed");
  const r = nuLock({ version: 1, dependencies: { net9: { ...nuEntry("<script>").dependencies.net9, ...nuEntry("M\n::error::x").dependencies.net9 } } });
  ok(r.packages.length === 0 && said(r.failures) && !r.failures.some((f) => f.includes("\n")), "a NuGet id holding markup or a line break is no id, and its failure stays on its line");
  ok(lines("<a>pull_request_target</a>").length === 1 && lines("pull_request\\x5ftarget").length === 1, "the forbidden trigger is found inside markup and behind an escape");
  const tags = tool({ name: "<img src=x>", version: "<b>1.0.0</b>" });
  ok(tags.keys.size === 0 && said(tags.problems), "an agentTools entry whose version is markup is no entry");
}

// ---- a file path ----
{
  ok(["../outside", "node_modules/../../outside", "/etc/x", "C:\\x", "node_modules\\..\\x", "node_modules//x", "./node_modules/x"].every((p) => !lockPathOk(p)), "a lock entry's path that leaves the project, starts at a root, or is spelt otherwise than npm writes it, is refused");
  const out = exactOn({ packages: { "": {}, "../moss-away": {}, "/etc": {} } }, {});
  ok(out.length === 2 && said(out) && out.every((p) => /no folder of the project's/u.test(p)), "exact-versions reads no package.json at a lock key that leaves the project, and says so with its mend");
  ok(said(exactOn({ packages: { "": {}, "node_modules/moss-a": { link: true, resolved: "../outside" } } }, { dependencies: { "moss-a": "file:../outside" } })), "a dependency linked to a folder outside the project is none of its own, and its \"file:\" spec fails");
  ok(throwsMended(() => licences(lockProject({ "node_modules/../../outside": { version: "1.0.0", license: "MIT" } }))), "the licence check refuses a lock file holding a path that leaves the project, whole, with its mend");
  ok(throwsMended(() => workspacesIn({ workspaces: ["../*"] }, "package.json")) && throwsMended(() => workspacesIn({ workspaces: [5] }, "package.json")), "a workspace named by a pattern, or not by a path, is refused with its mend");
  ok(["../packages.lock.json", "/abs/packages.lock.json", "a/../../packages.lock.json", "./packages.lock.json"].every((p) => throwsMended(() => nugetConfig({ nuget: { ships: [p] } }))) && ["../feed/", "/abs/feed/", "file:///x/", "http://moss.example/"].every((s) => throwsMended(() => nugetConfig({ nuget: { sources: [s] } }))), "the NuGet config refuses a lock file or source outside the project, or a source that is no https address, with its mend");
  const nid = nuLock({ version: 1, dependencies: { net9: { ...nuEntry("../evil").dependencies.net9, ...nuEntry("M", { resolved: "../1.0.0", requested: "[../1.0.0]" }).dependencies.net9 } } });
  ok(nid.packages.length === 0 && said(nid.failures), "NuGet's lock reader takes no package whose id or version holds a path, so none names a folder to write");
  // a workflow that is a link to a file outside the project, and one in UTF-16, run as the copies workflow runs the check
  const root = path.join(fresh({ "outside.yml": "on: push\n", "in/.github/workflows/b.yml": "on: push\n" }), "in");
  // (the whole of scripts/, as a project's copy holds it, so whatever the check imports is there)
  fs.cpSync(fileURLToPath(new URL("../scripts", import.meta.url)), path.join(root, "core/scripts"), { recursive: true });
  fs.cpSync(fileURLToPath(new URL("../.packages", import.meta.url)), path.join(root, "core/.packages"), { recursive: true, filter: parserLeftOut });
  fs.symlinkSync(path.join(root, "../outside.yml"), path.join(root, ".github/workflows/a.yml"));
  fs.writeFileSync(path.join(root, ".github/workflows/c.yml"), Buffer.from("\ufeffon: push\n", "utf16le"));
  for (const a of [["init", "-q"], ["add", "-A"]]) spawnSync("git", a, { cwd: root });
  const noTools = { ...process.env, ZIZMOR: "", ACTIONLINT: "" }; // (the core's own readers alone: the two tools are read on such files by the trial of #580)
  const run = spawnSync(process.execPath, ["core/scripts/workflows.mjs"], { cwd: root, env: noTools, encoding: "utf8", timeout: 20000 });
  ok(run.status === 1 && mended(run.stdout) && /a\.yml: a link/u.test(run.stdout) && /c\.yml: not UTF-8/u.test(run.stdout) && !/\n\s+at /u.test(run.stderr), "the workflow check fails a workflow that is a link out of the project, unread, and one in UTF-16, each with its mend");
  // a workflow nested far past what one holds, in the forms that ran for minutes in the second reader (#837): explicit-key
  // marks, flow mappings, and a file of many keys just under the depth read; each is read within five seconds
  const deepRoot = path.join(fresh({ "in/.github/workflows/b.yml": "on: push\n" }), "in");
  fs.cpSync(path.join(root, "core"), path.join(deepRoot, "core"), { recursive: true });
  const nested = { "keys.yml": `${"? ".repeat(700)}a\n`, "flow.yml": `x: ${"{".repeat(700)}a: 1${"}".repeat(700)}\n`, "many.yml": `on: push\n${`${"? ".repeat(100)}b\n`.repeat(500)}` };
  for (const [name, body] of Object.entries(nested)) fs.writeFileSync(path.join(deepRoot, ".github/workflows", name), body);
  for (const a of [["init", "-q"], ["add", "-A"]]) spawnSync("git", a, { cwd: deepRoot });
  // (the five seconds a hostile input may take are the run's own timeout: it is cut off, with no status, where it takes longer)
  const deep = spawnSync(process.execPath, ["core/scripts/workflows.mjs"], { cwd: deepRoot, env: noTools, encoding: "utf8", timeout: 5000 });
  ok(deep.status === 0 && /^ok   4 workflows/mu.test(deep.stdout) && !/\n\s+at /u.test(deep.stderr), "the workflow check reads explicit-key marks and flow mappings nested far past the depth read, and a file of many just under it, within five seconds", deep.stdout);
  // an oversized workflow that a pull request leaves as it is, where git writes line ends as CRLF on checkout, reads as the
  // same text as its base, so it is only noted: the working tree's file and the base's blob differ in their bytes, never in the text (#752)
  const crlfRoot = path.join(fresh({ "in/.github/workflows/big.yml": `on: push\n# ${"x".repeat(270000)}\n`, "in/.gitattributes": "*.yml text eol=crlf\n" }), "in");
  fs.cpSync(path.join(root, "core"), path.join(crlfRoot, "core"), { recursive: true });
  const gitAt = (...a) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...a], { cwd: crlfRoot, encoding: "utf8" });
  gitAt("init", "-q"); gitAt("add", "-A"); gitAt("commit", "-q", "-m", "base");
  fs.rmSync(path.join(crlfRoot, ".github/workflows/big.yml")); gitAt("checkout", "-q", "--", ".github/workflows/big.yml");
  const crlf = spawnSync(process.execPath, ["core/scripts/workflows.mjs"], { cwd: crlfRoot, env: { ...noTools, WORKFLOWS_BASE: "HEAD" }, encoding: "utf8", timeout: 5000 });
  ok(fs.readFileSync(path.join(crlfRoot, ".github/workflows/big.yml"), "utf8").includes("\r\n") && crlf.status === 0 && /big\.yml: the file is longer.*as on the base/u.test(crlf.stdout) && !/FAIL/u.test(crlf.stdout), "an oversized workflow left as it was, checked out with CRLF line ends, is only noted as on the base, never failed", crlf.stdout);
  // a line break of YAML 1.1 that the package does not read (U+0085, U+2028, U+2029), hiding a key given twice or a call left
  // without ready_for_review, in a file a pull request adds: each fails with its mend, a file of three million of them too,
  // and the same files unchanged from the base are only noted (#872)
  const brk = path.join(fresh({ "in/.github/workflows/b.yml": "on: push\n" }), "in");
  fs.cpSync(path.join(root, "core"), path.join(brk, "core"), { recursive: true });
  const gitBrk = (...a) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...a], { cwd: brk, encoding: "utf8" });
  gitBrk("init", "-q"); gitBrk("add", "-A"); gitBrk("commit", "-q", "-m", "base");
  const breaks = { "nel.yml": "\u0085", "ls.yml": "\u2028", "ps.yml": "\u2029" };
  for (const [name, br] of Object.entries(breaks)) fs.writeFileSync(path.join(brk, ".github/workflows", name), `on: push\nx: 1${br}x: 2\n`);
  fs.writeFileSync(path.join(brk, ".github/workflows/many.yml"), `on: push\n${"\u2028".repeat(3e6)}\n`);
  gitBrk("add", "-A");
  const brkRun = (base) => spawnSync(process.execPath, ["core/scripts/workflows.mjs"], { cwd: brk, env: { ...noTools, WORKFLOWS_BASE: base }, encoding: "utf8", timeout: 10000 });
  const brkNew = brkRun("HEAD");
  ok(brkNew.status === 1 && Object.entries(breaks).every(([name, br]) => new RegExp(`FAIL \\.github/workflows/${name}:2: the file holds the line break U\\+${br.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}.*Mend: replace each`, "u").test(brkNew.stdout)) && /many\.yml:2: the file holds the line break U\+2028 and 2999999 more/u.test(brkNew.stdout) && mended(brkNew.stdout) && !/\n\s+at /u.test(brkNew.stderr), "the workflow check fails a file a pull request adds that holds U+0085, U+2028 or U+2029, one of three million of them too, each with its mend");
  gitBrk("commit", "-q", "-m", "held");
  const brkOld = brkRun("HEAD");
  ok(brkOld.status === 0 && !/FAIL/u.test(brkOld.stdout) && /note \.github\/workflows\/nel\.yml:2: .*as on the base/u.test(brkOld.stdout), "the same files unchanged from the base are only noted");
  // the sync's move of the pins, and NuGet's readers, on a workflow and a build file that are links out (#446)
  const call = `jobs:\n  a:\n    uses: ${CORE}/.github/workflows/x.yml@${"a".repeat(40)}\n`;
  const away = path.join(fresh({ "outside.yml": call, "outside.props": "<Project></Project>\n", "in/.github/workflows/b.yml": "on: push\n" }), "in");
  fs.symlinkSync(path.join(away, "../outside.yml"), path.join(away, ".github/workflows/a.yml"));
  fs.mkdirSync(path.join(away, "build"));
  fs.symlinkSync(path.join(away, "../outside.props"), path.join(away, "build/x.xml"));
  for (const a of [["init", "-q"], ["add", "-A"]]) spawnSync("git", a, { cwd: away });
  const here = process.cwd();
  process.chdir(away);
  let calls;
  try { calls = moveCalls("b".repeat(40), path.join(away, "no-core"), ownFiles(away)); } finally { process.chdir(here); }
  ok(calls.moved.length === 0 && calls.unread.join() === ".github/workflows/a.yml" && fs.readFileSync(path.join(away, "../outside.yml"), "utf8") === call, "the sync reads no workflow that is a link out of the project, names it unread, and writes nothing through it");
  ok(readBuildFile(away, ".github/workflows/a.yml") === NOT_A_FILE && readBuildFile(away, "build/x.xml") === NOT_A_FILE && projectFilesByContent(away, ["build/x.xml"]).length === 0, "NuGet's readers read no file through a link out of the project, and take none for a project file");
  // (a link whose text steps back by a `..` after a folder link out of the project, its spelling naming a file of the
  // project's own: read where the system reads it, outside, so as none)
  if (process.platform !== "win32") {
    fs.mkdirSync(path.join(away, "../deep")); fs.writeFileSync(path.join(away, "../y.md"), "away\n"); fs.writeFileSync(path.join(away, "y.md"), "inside\n");
    fs.symlinkSync(path.join(away, "../deep"), path.join(away, "far")); fs.symlinkSync("far/../y.md", path.join(away, "z.md"));
    spawnSync("git", ["add", "-A"], { cwd: away });
    ok(ownFiles(away).read("y.md") === "inside\n" && ownFiles(away).read("z.md") === null, "a project's own files read no link whose `..` after a folder link leads out, though its spelling names a file of its own");
  }
}

// ---- a number out of range ----
{
  ok(["99999999999999999999.0.0", "-1", "1.-2.3", "1.2.3.4", "01.0.0", "1e3.0.0", "Infinity.0.0", "NaN"].every((v) => !exact(v) && said(oneDep(v, v))), "a version out of range (twenty digits, below nought, four numbers, a nought before, an exponent, Infinity, NaN) is no exact version, though the lock says the same");
  const nv = nuLock({ version: 1, dependencies: { net9: { ...nuEntry("M", { resolved: "99999999999999999999.0.0" }).dependencies.net9, ...nuEntry("N", { resolved: "-1", requested: "[-1]" }).dependencies.net9 } } });
  ok(said(nv.failures) && !nv.packages.some((p) => p.version === "-1"), "NuGet's lock reader takes no version below nought, and fails one the project does not ask for exactly");
  ok([3, -1, 1e308, "1"].every((v) => said(nuLock({ version: v, dependencies: {} }).failures)), "a NuGet lock file of a version it does not know, a large or negative number among them, is refused with its mend");
  ok(said(tool({ version: "99999999999999999999.0.0" }).problems) && said(tool({ version: "-1" }).problems), "an agentTools version out of range is no exact version, with its mend");
}

// ---- nothing at all ----
{
  ok(said(exactOn("")) && said(exactOn({ packages: { "": {} } })), "an empty lock file, or a lock entry with no package.json beside it, fails with its mend");
  ok(exactOn("{}").length === 1 && exactOn("null").length === 1 && said(exactOn("{}")) && said(exactOn("null")), "a lock file of nothing but braces, or null, holds no packages and is refused with its mend");
  for (const [what, files] of [["an empty lock file", { "package-lock.json": "", "package.json": "{}" }], ["a lock file that is no JSON", { "package-lock.json": "lock", "package.json": "{}" }],
    ["an empty package.json", { "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": {} } }), "package.json": "" }], ["a package.json that is no JSON", { "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": {} } }), "package.json": "list" }]]) {
    let got = "";
    try { licences(fresh(files)); } catch (e) { got = e instanceof SyntaxError ? `raw ${e.message}` : `FAIL: ${e.message}`; }
    ok(mended(got) && !/^raw /u.test(got) && (!what.includes("package.json") || /Mend: correct it to JSON/u.test(got)), `the licence check refuses ${what} in its own words, with its mend, never JSON's own error`);
  }
  ok(["", "   ", "()", "MIT AND"].every((l) => !licenceOk(l, ALLOW)), "an empty licence, blanks alone, empty brackets or an expression cut short are not allowed");
  const none = licences(lockProject({ "node_modules/moss-a": { version: "1.0.0" } }));
  ok(none.failures.length === 1 && said(none.failures), "a package with no licence fails the licence check with its mend");
  ok(["", "{}"].every((c) => throwsMended(() => loadConfig(configFile(c)))), "an empty licence config, or one that names nothing, is refused with its mend");
  ok(said(lockPackages("", "packages.lock.json").failures) && said(lockPackages("{}", "packages.lock.json").failures) && throwsMended(() => nugetConfig({})), "an empty NuGet lock file, or config, is refused with its mend");
  ok(plainText(null) === "" && plainText(Buffer.from([0xff, 0xfe, 0x3c, 0])) === null && plainText(Buffer.from([0xc3, 0x28])) === null && plainText(Buffer.from('<?xml version="1.0" encoding="utf-16"?><a>\u00e9</a>')) === null, "a NuGet file not there reads as nothing, and one in UTF-16, not UTF-8, or of another encoding it declares is not read");
  ok(twice("").length === 0 && twice("\ufeff").length === 0 && lines("").length === 0, "an empty workflow holds no key twice and no trigger");
  ok(said(settings("").problems) && settings("{}").tools.size === 0 && listed({}, "c.json") === null && said(listed({ agentTools: [{}] }, "c.json").problems), "empty agent settings fail with their mend, an empty object configures nothing, and an empty entry is refused");
}

// ---- the reader of where the tests run (runners.mjs; #733): a workflow file that anyone's pull request writes ----
{
  const dir = scratchDir("hostile-runners-");
  const one = (name, body) => { for (const f of fs.readdirSync(dir)) if (f !== OWNER) fs.rmSync(path.join(dir, f)); fs.writeFileSync(path.join(dir, name), body); return workflowsIn(dir); };
  try {
    let w = one("loop.yml", "on: push\njobs:\n  t: &a\n    runs-on: [ubuntu-latest, *a]\n    steps: *a\n");
    ok(!w.selfHosted && !w.onHost, "runners.mjs: a job whose anchors refer to themselves is read as far as it goes, each object once, and nothing overflows");
    w = one("deep.yml", `on: push\njobs:\n  t:\n    runs-on: ${"[".repeat(5000)}x${"]".repeat(5000)}\n`);
    ok(w.unread.includes("deep.yml") || w.unknown, "runners.mjs: a runner nested thousands deep is not read, and the file is named or its runner said unread");
    w = one("types.yml", "on: 5\njobs: x\n");
    ok(!w.onHost && !w.selfHosted && !w.unknown && !w.unread.length, "runners.mjs: a trigger and jobs of the wrong type say nothing runs here");
    w = one("list.yml", "- a\n- b\n");
    ok(!w.onHost && !w.unread.length, "runners.mjs: a file that is a list holds no workflow");
    w = one("markup.yml", "on: pull_request\njobs:\n  t:\n    runs-on: \"<script>alert(1)</script>\"\n    steps:\n      - run: node core/scripts/shape.mjs c.json --suite u -- x\n");
    const r = runnersRead({ repo: "o/n", dir, gh: () => JSON.stringify({ private: false }) });
    ok(w.unknown && r.where === "self-hosted" && !r.said.join(" ").includes("<script>") && /could not be read/.test(r.advice ?? ""), "runners.mjs: a runner named in markup is not read, taken as the owner's own and advised on, and its name never printed");
    w = one("empty.yml", "");
    ok(!w.onHost && !w.unread.length, "runners.mjs: an empty file holds no workflow");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

console.log(failed ? `${failed} failing` : "ok   every hostile build, package and workflow file is refused");
process.exit(failed ? 1 : 0);
