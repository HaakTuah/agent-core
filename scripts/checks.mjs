// The core's pull-request checks that need no secret, from one script (#376): the steps of the job the core's
// .github/workflows/core.yml runs after its own check of the copy, and of copies.yml, pr-description.yml,
// signatures.yml and nuget.yml, which run its parts one each. A session may also start it by hand in the folder it works
// in, from the project's root: a tool, and no duty (no rule asks it before a push; #417). It runs, part by part:
//
// - copies: the copies, pointer, reading-size, workflow, entry-file, manifest, shape, choice records' and core's files' checks (what each holds, its
//   own script says; the header of .github/workflows/copies.yml says them together);
// - description: the description check (pr-description.mjs), given the pull request's description in PR_BODY or a file;
// - signatures and nuget, the package checks: first a look at whether the change touches what it reads, then npm's
//   install and signature check, or NuGet's restore, each with its licence read, the restore only where the code is
//   proven the repository's own (ownCode). Before any part, each NuGet call's
//   lookup of the packages new to the project (lookup.mjs), since a restore runs the change's own build files. They go last, and the job runs each in
//   a step of its own after the others; the NuGet restore runs the change's own build files, so it goes after all, and
//   nothing that runs after it reads what a build could have changed.
//
// Each check runs even where one before it failed, so every failure is said, each with its mend; within the package
// check a step runs only where the one before passed, as the steps of a job do. It exits 1 where any failed; where none
// failed and a check could not run, since a program it starts is not on this machine, it says so and exits 127, as a
// shell does for a command not found, so a run of the job elsewhere leaves it unrun, never failed (#1361, point 19). What it
// does not run: the core's own check of the copy (core.yml), which runs the workflow's own shell and nothing of the
// repository's, since it is what proves this copy is the core (by hand, node core/scripts/check.mjs runs it from plain
// git, beside every other check); and personal-terms.yml, which needs a secret. By hand the package checks work in the
// project's own folder, as the job does in its checkout: npm's install replaces node_modules with packages whose
// install scripts never ran, and a restore writes obj/, so a session that needs its own build after them installs
// again, or runs them in a worktree of their own. With no
// part named, it runs each part the project's calls to the core's workflows run, with their inputs, read from its
// .github/workflows (by hand: pass --description <a file> for the description). Node's own modules; the package checks
// also npm, or bash, git, jq and the .NET SDK.
//
//   node core/scripts/checks.mjs [copies] [description] [signatures | nuget] [--base <commit, or origin/<branch>>]
//        [--copies <config>] [--sizes <marks>] [--description <file>] [--parts <headings, |-separated>]
//        [--signatures <folder of package-lock.json>] [--nuget <licence config>] [--advisory] [--own-repository]
//
// --own-repository, outside a workflow alone, says the code checked out is the repository's own (a clone of the
// owner's own project, as the daily try and a release's trial make): without it, there, the NuGet check runs no
// restore (ownCode, below).
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { MEND, guard } from "./mend.mjs";
import { installStep, installed } from "./packages.mjs";
import { npmIgnores, npmReadsAll, npmRefusal, npmVersion } from "./npm-reads.mjs";
import { asText } from "./guards.mjs";
import { parseYaml } from "./parse-yaml.mjs";

export const PARTS = ["copies", "description", "signatures", "nuget"];
const OPTIONS = ["--base", "--copies", "--sizes", "--description", "--parts", "--signatures", "--nuget"];
const FLAGS = ["--advisory", "--own-repository"];
// The checks of the part "copies", in the order its workflow ran them: each its step's name, its script, its argument
// (an option's name) and the variable that gives it the base.
export const COPIES = [
  ["No new copies", "copies.mjs", "copies", "COPIES_BASE"],
  ["Every pointer in the rule files leads somewhere", "pointers.mjs", null, "POINTERS_BASE"],
  ["The files every session reads keep to their marks", "reading-size.mjs", "sizes", "SIZES_BASE"],
  ["No workflow names the forbidden trigger or gives a key twice", "workflows.mjs", null, "WORKFLOWS_BASE"],
  ["Each agent tool's entry file pulls in every file AGENTS.md names", "entry-files.mjs", null, "ENTRY_BASE"],
  ["The manifest takes or leaves out each module and fills each slot they use (reports, never fails)", "manifest-reads.mjs", null, null],
  ["Nothing new in how the code is put together", "shape.mjs", null, "SHAPE_BASE"],
  ["Each choice record a change adds is argued in full", "choices.mjs", null, "CHOICES_BASE"],
  ["Each file and part the core marks that a change touches is as the core writes it", "converge.mjs", null, "CONVERGE_BASE"],
];

function fail(what, mend) { console.log(`FAIL ${what} ${MEND}${mend}`); process.exit(1); }

function main() {
  // (on Windows, no program is looked for in the folder a check runs in, which the change under check fills: neither by
  // Node when it starts one nor by a shell it starts; every other system looks only on the PATH)
  if (process.platform === "win32") process.env.NoDefaultCurrentDirectoryInExePath = "1";
  let root;
  try { root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { fail("this folder is in no git repository.", "run it from the project's root, in its clone."); }
  process.chdir(root);
  const o = options(process.argv.slice(2));
  if (!o.parts.length) Object.assign(o, fromCalls(root, o));
  const coreAt = copyAt(root);
  const temp = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), "core-checks-"));
  const results = [];
  // (a check that failed where a program it starts could not be found, and nothing it started failed, did not run:
  // #1361, point 19)
  const check = (name, fn) => { console.log(`== ${name}`); const { lacked, broke } = starts, passed = fn(); results.push([name, passed, !passed && starts.lacked > lacked && starts.broke === broke]); return passed; };
  try {
    // (first, each NuGet call's lookup of the packages new to the project, floor topic 15: before any part runs a
    // restore, which runs the pull request's own build files, so that no config's restore runs before another's lookup)
    if (o.parts.includes("nuget")) for (const settings of runsOf(o, "nuget")) lookUp({ ...o, ...settings }, { coreAt, check });
    // (each part once for each call that runs it with settings of its own, as two calls for two lock files' folders)
    for (const part of PARTS.filter(p => o.parts.includes(p))) for (const settings of runsOf(o, part)) RUN[part]({ ...o, ...settings }, { coreAt, temp, check });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  const failed = results.filter(([, passed, unrun]) => !passed && !unrun).map(([name]) => name);
  const unrun = results.filter(([, , u]) => u).map(([name]) => name), wants = [...lacking].join(", ");
  if (unrun.length) console.log(`FAIL ${unrun.length} of ${results.length} checks could not run here, since this machine lacks ${wants}: ${unrun.join("; ")}. ${MEND}install ${wants} on this machine, or run the job where it is (the host's runners), and run this again.`);
  console.log(failed.length ? `${failed.length} of ${results.length} checks failed, each saying its mend above: ${failed.join("; ")}` : `ok   ${results.length - unrun.length} checks passed`);
  process.exitCode = failed.length ? 1 : unrun.length ? 127 : 0;
}

// Where the copy of the core stands, from the project's root, ending in "/": as the workflow's step read it from the
// manifest (CORE_AT), where it holds this script; else this script's own folder, both paths made real first, since on
// Windows git names the root by its long name where Node may name a temporary folder by its short one.
function copyAt(root) {
  const here = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const at = process.env.CORE_AT;
  if (at && /\/$/.test(at) && fs.existsSync(path.join(root, at, "scripts/checks.mjs")) && fs.realpathSync.native(path.join(root, at)) === fs.realpathSync.native(here)) return at;
  return `${path.relative(fs.realpathSync.native(root), fs.realpathSync.native(here)).replace(/\\/g, "/")}/`;
}

// The parts and options given, each checked.
export function options(args) {
  const o = { parts: [], advisory: false, ownRepository: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (PARTS.includes(a)) { if (!o.parts.includes(a)) o.parts.push(a); continue; }
    if (FLAGS.includes(a)) { o[a === "--advisory" ? "advisory" : "ownRepository"] = true; continue; }
    if (!OPTIONS.includes(a)) fail(`${a} is no part or option of this script.`, `name a part (${PARTS.join(", ")}) or an option the usage line at the top of scripts/checks.mjs shows.`);
    if (i + 1 >= args.length) fail(`${a} is given no value.`, "give it one, as the usage line at the top of scripts/checks.mjs shows.");
    o[a === "--parts" ? "headings" : a.slice(2)] = args[++i];
  }
  return checked(o);
}

// Each part named with what it runs with: both package checks, or one with nothing to run it with, fails.
const NEED = { copies: ["copies", "sizes"], signatures: ["signatures"], nuget: ["nuget"] };
function checked(o) {
  for (const part of o.parts) for (const opt of NEED[part] ?? []) if (!o[opt]) fail(`the part ${part} is named without --${opt}.`, `give --${opt}, as the project's call to the core gives its input ${opt}.`);
  if (o.parts.includes("description") && o.description === undefined && process.env.PR_BODY === undefined) fail("the part description is named with no description to read.", "give --description <a file that holds the pull request's description>.");
  return o;
}

// What each call to one of the core's workflows runs here: its parts, each with its settings, read from its inputs.
const FROM = {
  core: w => [w.copies && ["copies", { copies: w.copies, sizes: w.sizes }], w.description === true && ["description", { headings: w.parts }],
    w.signatures && ["signatures", { signatures: w.signatures }], w.nuget && ["nuget", { nuget: w.nuget, advisory: w.advisory }]].filter(Boolean),
  copies: w => [["copies", { copies: w.config, sizes: w.sizes }]],
  "pr-description": w => [["description", { headings: w.parts }]],
  signatures: w => [["signatures", { signatures: w.directory ?? "." }]],
  nuget: w => [["nuget", { nuget: w.config, advisory: w.advisory }]],
};

// The project's calls to those workflows, from its .github/workflows: [which, its inputs] each.
function callsHere(root) {
  const dir = path.join(root, ".github/workflows");
  const call = new RegExp(`^${CORE.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/\\.github/workflows/(core|copies|pr-description|signatures|nuget)\\.ya?ml@`, "i");
  const read = f => { try { return parseYaml(fs.readFileSync(path.join(dir, f), "utf8")); } catch { return null; } };
  return (fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.ya?ml$/.test(f)) : []).flatMap(f => Object.values(read(f)?.jobs ?? {}))
    .map(job => [call.exec(String(job?.uses ?? ""))?.[1]?.toLowerCase(), job?.with ?? {}]).filter(([which]) => which);
}

// By hand, with no part named: what the project's own calls to the core's workflows run, each call's part with its own
// inputs, a part run once for each distinct call (runsOf), what the command line gives winning.
export function fromCalls(root, given) {
  // (the calls are read with the YAML package: with it not installed, none could be read, which is no "calls none")
  if (!installed("yaml")) fail("no part is named, and the project's calls to the core's workflows cannot be read: the core's packages are not installed.", `run \`${installStep()}\`, then this again, or name a part (${PARTS.join(", ")})`);
  const runs = [];
  for (const [part, settings] of callsHere(root).flatMap(([which, w]) => FROM[which](w))) {
    const set = Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, k === "advisory" ? v === true : String(v)]));
    if (!runs.some(r => r.part === part && JSON.stringify(r.settings) === JSON.stringify(set))) runs.push({ part, settings: set });
  }
  if (!runs.length) fail("no part is named, and the project calls none of the core's workflows these parts run.", `name a part (${PARTS.join(", ")}) with its options, as the usage line at the top of scripts/checks.mjs shows.`);
  let parts = [...new Set(runs.map(r => r.part))];
  // (the description, by hand, only where one is given)
  if (given.description === undefined && process.env.PR_BODY === undefined) {
    parts = parts.filter(p => p !== "description");
    console.log("note the description check is not run: give --description <a file that holds the pull request's description>");
  }
  return { parts, runs };
}

// The settings a part runs with, once for each call that runs it: the project's calls' (fromCalls), each with what the
// command line gives over it; or, where parts are named on the command line, that line's alone.
function runsOf(o, part) {
  if (!o.runs) return [{}];
  const given = Object.fromEntries(Object.entries(o).filter(([k, v]) => !["parts", "runs", "advisory"].includes(k) && v !== undefined));
  return o.runs.filter(r => r.part === part).map(r => ({ ...r.settings, ...given, advisory: r.settings.advisory === true || o.advisory }));
}

// The base, as a commit: what --base names, fetched where it is origin/<branch> and not here yet (a clone that lacks
// it; the core's workflows give HEAD^1, the merge's first parent, which their checkout holds, since their fetch has no
// token to sign in with: #674); "" where none is given or it is given empty. Where it cannot be had, it fails, or, given
// `exits` false, throws that failure's line.
const gitOk = (args) => { try { execFileSync("git", args, { stdio: "ignore" }); return true; } catch { return false; } };
function baseCommit(base, exits = true) {
  if (!base) return "";
  // (HEAD^1 is the base only as the first parent of a merge: on a head alone it is the change's own earlier commit)
  if (base === "HEAD^1" && !gitOk(["rev-parse", "--verify", "-q", "HEAD^2^{commit}"])) {
    const what = "--base HEAD^1 is given, and HEAD is no merge: HEAD^1 would be the change's own earlier commit, not its base.", mend = "check out the merge a pull request's run makes with `fetch-depth: 2`, or give the commit the change merges into, such as origin/main after a fetch.";
    if (exits) fail(what, mend);
    throw new Error(`FAIL ${what} ${MEND}${mend}`);
  }
  const at = () => execFileSync("git", ["rev-parse", "--verify", "-q", `${base}^{commit}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try { return at(); } catch { /* (not here yet) */ }
  const branch = /^origin\/([A-Za-z0-9._/-]+)$/.exec(base)?.[1];
  if (branch) {
    try { execFileSync("git", ["fetch", "--no-tags", "--depth=1", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`], { stdio: ["ignore", "inherit", "inherit"] }); return at(); } catch { /* (below) */ }
  }
  const what = `--base ${base} is no commit here, and could not be fetched.`, mend = "give the commit the change merges into, such as origin/main after a fetch.";
  if (exits) fail(what, mend);
  throw new Error(`FAIL ${what} ${MEND}${mend}`);
}

// The programs a check could not start, since they are not on this machine, and how many times one was not found and
// one started failed, so that a check is read as not run only where it lacked a program and nothing it started failed
// (#1361, point 19).
const lacking = new Set(), starts = { lacked: 0, broke: 0 };
// (the host's words where the SDK band a project's global.json pins is not on this machine, and the program said lacking
// for it, which the mend asks installed: #1361, point 10)
const SDK_LACKING = /compatible .{0,20}SDK was not found|requested SDK version/iu, SDK_BAND = "the .NET SDK band the global.json names";
// Whether a program started and passed; one that could not be started is said so, with its mend where one is given, and
// one not found noted as lacking (Node says ENOENT for a folder to run in that is not there too, which is no program
// lacking).
function begun(r, what, cwd, mend = "") {
  if (!r.error) { if (r.status !== 0) starts.broke++; return r.status === 0; }
  console.log(`${what} could not be started (${r.error.message}).${mend && ` ${MEND}${mend}`}`);
  if (r.error.code === "ENOENT" && (!cwd || fs.existsSync(cwd))) { lacking.add(String(r.error.path)); starts.lacked++; }
  return false;
}
// A program run with the variables given added to this script's own, its output passed on; whether it passed.
function run(cmd, args, { env = {}, cwd = undefined } = {}) {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "inherit", "inherit"], shell: false });
  return begun(r, cmd, cwd);
}
const node = (coreAt, script, args, opts) => run(process.execPath, [`${coreAt}scripts/${script}`, ...args], opts);
// The registry's packages installed from the lock file, running no package's install script, and their signatures
// checked: each written out whole, on Windows through its shell, where the program is a script. Whether each passed.
const shown = { stdio: ["ignore", "inherit", "inherit"] };
// (Windows' shell, by the path the system names, never a cmd.exe the checked-out folder holds)
const COMSPEC = process.env.ComSpec || "cmd.exe";
// (the mend only where npm itself is not on this machine; on Windows what fails to start is the shell: #1361, point 9)
const passed = (r, cwd) => begun(r, "The package manager", cwd, process.platform !== "win32" && r.error?.code === "ENOENT"
  ? "install npm beside Node (the script that fetches Node brings Node alone), then run this check again." : "");
// (only under an npm that reads each setting that keeps the install to the registry: an older one, npm 10 that Node 22
// brings among them, ignores them without a word and would fetch any git, web or file source the lock file names; #704)
const ALLOWS = ["allow-git", "allow-remote", "allow-file"];
function unread(cwd) {
  const version = npmVersion(cwd);
  // (a version not read where npm cannot be started at all is a machine that lacks npm, not one too old: #1361, point 9)
  if (!version && process.platform !== "win32") { const at = spawnSync("npm", ["--version"], { cwd }); if (at.error) return !passed(at, cwd); }
  const ignored = npmIgnores(version, ALLOWS);
  if (!ignored.length) return false;
  // (the mend's command names the least npm written out, so the licence scan reads it; checks-test.mjs holds it to `least`)
  const least = npmReadsAll(ALLOWS);
  console.log(`FAIL ${npmRefusal(version, ignored, least)} ${MEND}from a folder outside the repository, install the version the refusal names into a folder of its own, also outside the repository, running no install script: ${"`npm install --global --prefix=<its-folder> --ignore-scripts npm@11.15.0`"}; then put that folder's bin (on Windows, the folder itself) first on the PATH and run this check again`);
  return true;
}
const install = cwd => !unread(cwd) && passed(process.platform === "win32"
  ? spawnSync(COMSPEC, ["/d", "/s", "/c", "npm ci --ignore-scripts --no-audit --no-fund --allow-git=none --allow-remote=none --allow-file=none"], { cwd, ...shown })
  : spawnSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--allow-git=none", "--allow-remote=none", "--allow-file=none"], { cwd, ...shown }), cwd);
const signed = cwd => passed(process.platform === "win32" ? spawnSync(COMSPEC, ["/d", "/s", "/c", "npm audit signatures"], { cwd, ...shown })
  : spawnSync("npm", ["audit", "signatures"], { cwd, ...shown }), cwd);

// Where advisory, a failure said and passed.
const advised = o => passed => { if (passed) return true; if (!o.advisory) return false; console.log("Advisory: nothing fails for it yet."); return true; };
// Each package new to the project looked up in NuGet's registry (lookup.mjs, floor topic 15), for one NuGet call: run
// for every call before any part restores, its verdict recorded, and the checks after it run on its failure too.
function lookUp(o, { coreAt, check }) {
  check("Each package new to the project looked up in NuGet's registry (floor topic 15)", () => advised(o)(node(coreAt, "lookup.mjs", [o.nuget, "--nuget"],
    { env: { LOOKUP_BASE: process.env.BASE_SHA || baseCommit(o.base) } })));
}

const RUN = {
  copies(o, { coreAt, check }) {
    // (a base that cannot be had is a failure of its own, and every check still runs, each saying what it could not read;
    // one that can is given to each as its commit, so a base named from here, such as HEAD^1, names the same commit
    // wherever a check reads it; #674)
    let base = o.base ?? "";
    if (o.base) check("The base the change merges into", () => { try { base = baseCommit(o.base, false); return true; } catch (e) { console.log(e.message); return false; } });
    for (const [name, script, arg, baseVar] of COPIES) check(name, () => node(coreAt, script, arg ? [o[arg]] : [], { env: baseVar ? { [baseVar]: base } : {} }));
  },

  description(o, { coreAt, check }) {
    let body = process.env.PR_BODY;
    if (o.description !== undefined) {
      try { body = fs.readFileSync(o.description, "utf8"); } catch { fail(`--description ${o.description} cannot be read.`, "give the path of a file that holds the pull request's description."); }
    }
    const env = { PR_BODY: body, PR_CREATED: process.env.PR_CREATED || new Date().toISOString(), BASE_SHA: process.env.BASE_SHA || baseCommit(o.base) };
    check("The description has its parts", () => node(coreAt, "pr-description.mjs", [o.headings ?? ""], { env }));
  },

  // npm's own install from the lock file and its own check of the registry's signatures (.github/workflows/signatures.yml
  // says what it holds and why), where the change touches what it reads: never the core's own package list, lock file
  // and .npmrc in its copy's .packages/, which the core's own repository checks (#654), and which a sync alone changes.
  signatures(o, { coreAt, check }) {
    const dir = o.signatures || ".";
    console.log("== Does the pull request change what this check reads?");
    const look = changes(process.env.BASE_SHA || baseCommit(o.base), [":(glob)**/package.json", ":(glob)**/package-lock.json", ":(glob)**/npm-shrinkwrap.json",
      ":(glob)**/.npmrc", `${coreAt}.node-version`, ".github/workflows/signatures.yml", ...caller(), ...["package.json", "package-lock.json", ".npmrc"].flatMap(f => [`:(exclude)${coreAt}.packages/${f}`, `:(exclude)${coreAt}.packages/parser/${f}`])],
    "No package list, lock file, .npmrc, Node version or calling workflow changed: nothing to verify.");
    if (!look) return;
    if (!check("Install from the lock file, from the registry alone, running no package's install script",
      () => install(dir))) return;
    if (!check("The registry's signature on each installed name and version", () => signed(dir))) return;
    check("Each lock entry's licence and version, as the installed package says them", () => run(process.execPath, [path.resolve(`${coreAt}scripts/licence-installed.mjs`), "."], { cwd: dir }));
  },

  // NuGet's restore from each lock file alone, and each package held to its list (.github/workflows/nuget.yml says what
  // it holds and why), where the change touches what NuGet reads (scripts/nuget-look.sh).
  nuget(o, { coreAt, temp, check }) {
    const dotnet = { DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", EnableWindowsTargeting: "true" };
    const output = path.join(temp, "look");
    fs.writeFileSync(output, "");
    const advisory = o.advisory ? ["--advisory"] : [], verdict = advised(o), own = ownCode(o);
    // (the look runs a restore of its own only where the code is proven the repository's own: OWN)
    const looked = check("Does the pull request change what NuGet reads?", () => run("bash", ["-e", `${coreAt}scripts/nuget-look.sh`], { env: {
      BASE: process.env.BASE_SHA || baseCommit(o.base), CONFIG: o.nuget, CALLER: process.env.CALLER ?? "", CORE_AT: coreAt,
      NUGET_PACKAGES: path.join(temp, "nuget-look"), GITHUB_OUTPUT: output, OWN: own ? "true" : "", ...dotnet } }));
    if (!looked) return;
    const said = Object.fromEntries(fs.readFileSync(output, "utf8").split(/\r?\n/).filter(l => l.includes("=")).map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
    if (said.run === "false") return;
    // (a restore runs the pull request's own build files: none runs unless the code is proven the repository's own)
    if (!own) { check("Is the code the repository's own, so a restore may run its build files?", () => { console.log(`FAIL ${NOT_OWN}`); return false; }); return; }
    // (before the restore, which runs the pull request's own build files: each package's file held to its lock file's
    // content hash, and its licence read from it, and the project's files read as committed, whatever the look ran: it
    // ran a build only where nothing it reads changed from the base, so the base's build files, which gain nothing the
    // read judges by what else they run)
    if (!check("Every locked package and tool, fetched before the restore and held to its list", () => {
      const fetched = path.join(temp, "nuget-fetched");
      const got = node(coreAt, "nuget-fetch.mjs", [o.nuget, "--into", fetched]);
      return verdict(node(coreAt, "nuget.mjs", [o.nuget, "--packages", fetched, "--fetched", ...advisory]) && got);
    })) return;
    // (the reads after each project's restore, their verdict the next check's)
    const each = { reads: true, restoredAny: false };
    const readAfter = (folder, lock) => node(coreAt, "nuget.mjs", [o.nuget, "--packages", folder, "--restored", ...(lock ? ["--lock", lock] : []), ...advisory], { env: { NUGET_PACKAGES: folder } });
    if (!check("Restore each project file from its lock file alone", () => {
      // (the project files git knows, and where packages come from, each a line as the script lists them, the registry
      // first: given to every restore, they overrule the sources any NuGet.Config names; without them nothing is restored)
      const list = args => spawnSync(process.execPath, [`${coreAt}scripts/nuget.mjs`, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
      const projects = list(["--projects"]), sources = list([o.nuget, "--sources"]);
      if (projects.status !== 0) return false;
      let passed = sources.status === 0, restored = true;
      const named = projects.stdout.split(/\r?\n/).filter(Boolean);
      // (a machine without the SDK band the global.json pins that dotnet reads from the folder the restores run in, its
      // rollForward allowing no other, restores nothing: the restores did not run, the machine's fault, not the change's,
      // since their failure is no word on the lock files; asked once, as each restore would ask it; #1361, point 10)
      const sdk = passed && named.length ? spawnSync("dotnet", ["--version"], { env: { ...process.env, ...dotnet }, encoding: "utf8" }) : undefined;
      if (sdk && !sdk.error && sdk.status !== 0 && SDK_LACKING.test(`${sdk.stdout}${sdk.stderr}`)) {
        console.log("The restores could not run: this machine has no .NET SDK that the global.json here accepts.");
        lacking.add(SDK_BAND); starts.lacked++; passed = false;
      } else if (passed) {
        const from = sources.stdout.split(/\r?\n/).filter(Boolean).flatMap(s => ["--source", s]);
        if (!restoreEach(named, from, { temp, dotnet, readAfter, each })) passed = restored = false;
      }
      if ((sources.status !== 0 || !restored) && !lacking.has("dotnet")) console.log(`FAIL A restore from a lock file failed (dotnet's errors above): the lock file is not what the project file asks for, a package is not what its lock file names or comes from no source named here (floor rules 7 and 15), or the config names its sources wrongly. ${MEND}where the project file changed, write its lock file anew (dotnet restore --force-evaluate) and commit it, never to take in a package whose content differs from what its lock file names; take out a package no source named in the config serves; or correct the config's sources.`);
      return verdict(passed);
    })) return;
    // (after the restore, nothing of git's is read for the base, which the restore could have rewritten: each comparison
    // with it was made before, by the read above; with no project to restore, one read of an empty folder)
    check("Every package one exact version, and under a licence on its list", () => {
      if (each.restoredAny) return each.reads;
      const empty = fs.mkdtempSync(path.join(temp, "nuget-packages-"));
      try { return readAfter(empty, null); } finally { fs.rmSync(empty, { recursive: true, force: true }); }
    });
  },
};

// Whether the code checked out is proven the repository's own, so that a restore may run its build files: in a workflow
// (GITHUB_ACTIONS), where the event is a pull request whose event file names its head repository as this one (a missing
// head repository, a fork's that was deleted, counting as another's), or a push, a schedule, a person's dispatch or a
// pull request in the merge queue, which only a writer starts or merges, with the event file the runner writes; any
// other event (pull_request_target, workflow_run) proves nothing. Elsewhere only with --own-repository, which the daily
// try and a release's trial give for the clones they make of the owner's own projects (check.mjs, which writes the
// event file its steps read only then, so its push counts as the repository's own only with it), and another host's
// pipeline on runs of the repository's own branches. A session's own environment, which could say anything here, is a
// foothold this does not hold against.
const OWN_EVENTS = ["push", "schedule", "workflow_dispatch", "merge_group"];
export function ownCode(o, env = process.env) {
  if (env.GITHUB_ACTIONS !== "true") return o.ownRepository === true;
  if (!env.GITHUB_EVENT_PATH || !env.GITHUB_REPOSITORY) return false;
  let event;
  try { event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, "utf8")); } catch { return false; }
  if (event === null || typeof event !== "object") return false;
  if (OWN_EVENTS.includes(env.GITHUB_EVENT_NAME)) return true;
  const head = env.GITHUB_EVENT_NAME === "pull_request" ? event.pull_request?.head?.repo?.full_name : undefined;
  return typeof head === "string" && head === env.GITHUB_REPOSITORY;
}
export const NOT_OWN = `this pull request comes from another repository, or nothing proves the code checked out is this repository's own, and it changes what NuGet reads; a restore runs its build files, so none ran. ${MEND}the owner brings the change into a branch of the repository, whose pull request runs the check whole (by hand, on a clone of the owner's own project, give --own-repository; on another host's pipeline, give it on runs of the repository's own branches, never on a merge request from a fork).`;

// Each project file restored from its lock file alone into a folder of its own and read at once (readAfter, with
// --restored and its lock file), before the next project's restore; the folder, with NuGet's caches of downloads and
// plug-ins and its scratch folder beside it, taken out before that restore starts, whatever the restore or the read
// did, so that no project's restore runs beside anything another's wrote: whether every restore passed, each read's
// verdict and whether any restored written to `each`.
function restoreEach(named, from, { temp, dotnet, readAfter, each }) {
  let restored = true;
  for (const project of named) {
    const own = fs.mkdtempSync(path.join(temp, "nuget-restore-")), packages = path.join(own, "packages");
    const caches = { NUGET_PACKAGES: packages, NUGET_HTTP_CACHE_PATH: path.join(own, "http-cache"), NUGET_PLUGINS_CACHE_PATH: path.join(own, "plugins-cache"), NUGET_SCRATCH: path.join(own, "scratch") };
    try {
      fs.mkdirSync(packages);
      // (the two properties given here overrule a project's own: its packages go to the folder the check reads, and its
      // lock file is the one beside it; each project named from the root, behind "./", so no name reads as an option)
      if (!run("dotnet", ["restore", "--locked-mode", ...from, `-p:RestorePackagesPath=${packages}`, "-p:NuGetLockFilePath=", `./${project}`], { env: { ...caches, ...dotnet } })) { restored = false; continue; }
      each.restoredAny = true;
      console.log(`-- What the restore of ${asText(project)} brought, read before the next restore`);
      if (!readAfter(packages, path.posix.join(path.posix.dirname(project), "packages.lock.json"))) each.reads = false;
    } finally { fs.rmSync(own, { recursive: true, force: true }); }
  }
  return restored;
}

// The calling workflow, by its own path, where the run says it (CALLER, GitHub's workflow_ref): a change to it is one the
// package check reads.
function caller() {
  const ref = process.env.CALLER ?? "", repo = process.env.GITHUB_REPOSITORY ?? "";
  const file = repo && ref.startsWith(`${repo}/`) ? ref.slice(repo.length + 1).split("@")[0] : "";
  return file ? [`:(literal)${file}`] : [];
}

// Whether the change touches a path given, by git's own diff from the base: any doubt (no base, a base that is not here
// and cannot be fetched, a git command that fails, a listed file that is a link to another) means it does. Says why.
function changes(base, paths, none) {
  const git = args => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  try {
    if (!base) return true;
    try { git(["cat-file", "-e", `${base}^{commit}`]); } catch { git(["fetch", "--quiet", "--no-tags", "--depth=1", "origin", base]); }
    const changed = git(["diff", "--no-renames", "--name-only", base, "HEAD", "--", ...paths]).split("\n").filter(Boolean);
    // (each name behind a dash and as text alone, so none starts or holds a workflow command; #1348)
    if (changed.length) { console.log(`Changed:\n${changed.map(f => `- ${asText(f)}`).join("\n")}`); return true; }
    if (/^120000 /m.test(git(["ls-files", "-s", "--", ...paths]))) { console.log("A listed file is a link to another, whose changes this step would not see."); return true; }
    console.log(none);
    return false;
  } catch { return true; }
}

// (last, so every part above is defined when it runs)
if (guard(import.meta.url)) main();
