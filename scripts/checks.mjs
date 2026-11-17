// The core's pull-request checks that need no secret, from one script (#376): the steps of the job the core's
// .github/workflows/core.yml runs after its own check of the copy, and of copies.yml, pr-description.yml,
// signatures.yml and nuget.yml, which run its parts one each. A session may also start it by hand in the folder it works
// in, from the project's root: a tool, and no duty (no rule asks it before a push; #417). It runs, part by part:
//
// - copies: the copies, pointer, reading-size, workflow, entry-file, manifest and shape checks (what each holds, its
//   own script says; the header of .github/workflows/copies.yml says them together);
// - description: the description check (pr-description.mjs), given the pull request's description in PR_BODY or a file;
// - signatures or nuget, the package check: first a look at whether the change touches what it reads, then npm's
//   install and signature check, or NuGet's restore, each with its licence read. It runs the change's own build files
//   (a NuGet restore), so it goes last, and the job runs it in a step of its own after the others: nothing that runs
//   after it reads what a build could have changed.
//
// Each check runs even where one before it failed, so every failure is said, each with its mend; within the package
// check a step runs only where the one before passed, as the steps of a job do. It exits 1 where any failed. What it
// does not run: the core's own check of the copy (core.yml), which runs the workflow's own shell and nothing of the
// repository's, since it is what proves this copy is the core; and personal-terms.yml, which needs a secret. With no
// part named, it runs each part the project's calls to the core's workflows run, with their inputs, read from its
// .github/workflows (by hand: pass --description <a file> for the description). Node's own modules; the package checks
// also npm, or bash, git, jq and the .NET SDK.
//
//   node core/scripts/checks.mjs [copies] [description] [signatures | nuget] [--base <commit, or origin/<branch>>]
//        [--copies <config>] [--sizes <marks>] [--description <file>] [--parts <headings, |-separated>]
//        [--npm <folder>] [--nuget <licence config>] [--advisory]
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { MEND } from "./mend.mjs";
import { started } from "./started.mjs";
import { parseYaml } from "./workflow-run.mjs";

export const PARTS = ["copies", "description", "signatures", "nuget"];
const OPTIONS = ["--base", "--copies", "--sizes", "--description", "--parts", "--npm", "--nuget"];
const FLAGS = ["--advisory"];
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
];

function fail(what, mend) { console.log(`FAIL ${what} ${MEND}${mend}`); process.exit(1); }

function main() {
  let root;
  try { root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { fail("this folder is in no git repository.", "run it from the project's root, in its clone."); }
  process.chdir(root);
  const o = options(process.argv.slice(2));
  if (!o.parts.length) Object.assign(o, fromCalls(root, o));
  const coreAt = `${path.relative(root, path.dirname(path.dirname(fileURLToPath(import.meta.url)))).replace(/\\/g, "/")}/`;
  const temp = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), "core-checks-"));
  const results = [];
  const check = (name, fn) => { console.log(`== ${name}`); const passed = fn(); results.push([name, passed]); return passed; };
  try {
    for (const part of PARTS.filter(p => o.parts.includes(p))) RUN[part](o, { coreAt, temp, check });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  const failed = results.filter(([, passed]) => !passed).map(([name]) => name);
  console.log(failed.length ? `${failed.length} of ${results.length} checks failed, each saying its mend above: ${failed.join("; ")}` : `ok   ${results.length} checks passed`);
  process.exitCode = failed.length ? 1 : 0;
}

// The parts and options given, each checked.
export function options(args) {
  const o = { parts: [], advisory: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (PARTS.includes(a)) { if (!o.parts.includes(a)) o.parts.push(a); continue; }
    if (FLAGS.includes(a)) { o.advisory = true; continue; }
    if (!OPTIONS.includes(a)) fail(`${a} is no part or option of this script.`, `name a part (${PARTS.join(", ")}) or an option the usage line at the top of scripts/checks.mjs shows.`);
    if (i + 1 >= args.length) fail(`${a} is given no value.`, "give it one, as the usage line at the top of scripts/checks.mjs shows.");
    o[a === "--parts" ? "headings" : a.slice(2)] = args[++i];
  }
  return checked(o);
}

// Each part named with what it runs with: both package checks, or one with nothing to run it with, fails.
const NEED = { copies: ["copies", "sizes"], signatures: ["npm"], nuget: ["nuget"] };
function checked(o) {
  if (o.parts.includes("signatures") && o.parts.includes("nuget")) fail("both package checks are named, and a project's packages come from one of them.", "name signatures for npm or nuget for NuGet, as the project's call to the core names npm or nuget.");
  for (const part of o.parts) for (const opt of NEED[part] ?? []) if (!o[opt]) fail(`the part ${part} is named without --${opt}.`, `give --${opt}, as the project's call to the core gives its input ${opt === "npm" ? "npm (the folder of package-lock.json)" : opt}.`);
  if (o.parts.includes("description") && o.description === undefined && process.env.PR_BODY === undefined) fail("the part description is named with no description to read.", "give --description <a file that holds the pull request's description>.");
  return o;
}

// What each call to one of the core's workflows runs here: its parts, each with its settings, read from its inputs.
const FROM = {
  core: w => [w.copies && ["copies", { copies: w.copies, sizes: w.sizes }], w.description === true && ["description", { headings: w.parts }],
    w.npm && ["signatures", { npm: w.npm }], w.nuget && ["nuget", { nuget: w.nuget, advisory: w.advisory }]].filter(Boolean),
  copies: w => [["copies", { copies: w.config, sizes: w.sizes }]],
  "pr-description": w => [["description", { headings: w.parts }]],
  signatures: w => [["signatures", { npm: w.directory ?? "." }]],
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

// By hand, with no part named: what the project's own calls to the core's workflows run, with their inputs; what is
// given on the command line wins.
export function fromCalls(root, given) {
  const found = { parts: [] };
  for (const [part, settings] of callsHere(root).flatMap(([which, w]) => FROM[which](w))) {
    if (!found.parts.includes(part)) found.parts.push(part);
    for (const [k, v] of Object.entries(settings)) if (k === "advisory") found.advisory ||= v === true; else if (v !== undefined && v !== null && v !== "") found[k] ??= String(v);
  }
  if (!found.parts.length) fail("no part is named, and the project calls none of the core's workflows these parts run.", `name a part (${PARTS.join(", ")}) with its options, as the usage line at the top of scripts/checks.mjs shows.`);
  // (the description, by hand, only where one is given; the package check of one kind, as the project's calls name it)
  if (given.description === undefined && process.env.PR_BODY === undefined) {
    found.parts = found.parts.filter(p => p !== "description");
    console.log("note the description check is not run: give --description <a file that holds the pull request's description>");
  }
  if (found.parts.includes("nuget")) found.parts = found.parts.filter(p => p !== "signatures");
  return { ...found, ...Object.fromEntries(Object.entries(given).filter(([k, v]) => k !== "parts" && v !== undefined && v !== false)) };
}

// The base, as a commit: what --base names, fetched where it is origin/<branch> and not here yet (a checkout of one
// commit, as a workflow's); "" where none is given or it is given empty.
function baseCommit(base) {
  if (!base) return "";
  const at = () => execFileSync("git", ["rev-parse", "--verify", "-q", `${base}^{commit}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try { return at(); } catch { /* (not here yet) */ }
  const branch = /^origin\/([A-Za-z0-9._/-]+)$/.exec(base)?.[1];
  if (branch) {
    try { execFileSync("git", ["fetch", "--no-tags", "--depth=1", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`], { stdio: ["ignore", "inherit", "inherit"] }); return at(); } catch { /* (below) */ }
  }
  fail(`--base ${base} is no commit here, and could not be fetched.`, "give the commit the change merges into, such as origin/main after a fetch.");
}

// A program run with the variables given added to this script's own, its output passed on; whether it passed.
function run(cmd, args, { env = {}, cwd = undefined } = {}) {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "inherit", "inherit"], shell: false });
  if (r.error) console.log(`${cmd} could not be started (${r.error.message}).`);
  return r.status === 0;
}
const node = (coreAt, script, args, opts) => run(process.execPath, [`${coreAt}scripts/${script}`, ...args], opts);
// (npm is a script on Windows, started through its shell)
const npm = (args, cwd) => process.platform === "win32" ? run("cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")], { cwd }) : run("npm", args, { cwd });

const RUN = {
  copies(o, { coreAt, check }) {
    if (o.base) baseCommit(o.base);
    for (const [name, script, arg, baseVar] of COPIES) check(name, () => node(coreAt, script, arg ? [o[arg]] : [], { env: baseVar ? { [baseVar]: o.base ?? "" } : {} }));
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
  // says what it holds and why), where the change touches what it reads.
  signatures(o, { coreAt, check }) {
    const dir = o.npm || ".";
    console.log("== Does the pull request change what this check reads?");
    const look = changes(process.env.BASE_SHA || baseCommit(o.base), [":(glob)**/package.json", ":(glob)**/package-lock.json", ":(glob)**/npm-shrinkwrap.json",
      ":(glob)**/.npmrc", `${coreAt}.node-version`, ".github/workflows/signatures.yml", ...caller()],
    "No package list, lock file, .npmrc, Node version or calling workflow changed: nothing to verify.");
    if (!look) return;
    if (!check("Install from the lock file, from the registry alone, running no package's install script",
      () => npm(["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--allow-git=none", "--allow-remote=none", "--allow-file=none"], dir))) return;
    if (!check("The registry's signature on each installed name and version", () => npm(["audit", "signatures"], dir))) return;
    check("Each lock entry's licence and version, as the installed package says them", () => run(process.execPath, [path.resolve(`${coreAt}scripts/licence-installed.mjs`), "."], { cwd: dir }));
  },

  // NuGet's restore from each lock file alone, and each package held to its list (.github/workflows/nuget.yml says what
  // it holds and why), where the change touches what NuGet reads (scripts/nuget-look.sh).
  nuget(o, { coreAt, temp, check }) {
    const dotnet = { DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", EnableWindowsTargeting: "true" };
    const output = path.join(temp, "look");
    fs.writeFileSync(output, "");
    const looked = check("Does the pull request change what NuGet reads?", () => run("bash", ["-e", `${coreAt}scripts/nuget-look.sh`], { env: {
      BASE: process.env.BASE_SHA || baseCommit(o.base), CONFIG: o.nuget, CALLER: process.env.CALLER ?? "", CORE_AT: coreAt,
      NUGET_PACKAGES: path.join(temp, "nuget-look"), GITHUB_OUTPUT: output, ...dotnet } }));
    if (!looked) return;
    const said = Object.fromEntries(fs.readFileSync(output, "utf8").split(/\r?\n/).filter(l => l.includes("=")).map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
    if (said.run === "false") return;
    const advisory = o.advisory ? ["--advisory"] : [];
    const verdict = passed => { if (passed) return true; if (!o.advisory) return false; console.log("Advisory: nothing fails for it yet."); return true; };
    // (before the restore, which runs the pull request's own build files: each package's file held to its lock file's
    // content hash, and its licence read from it, in a step no build has run in; where the look restored, it is left out)
    if (said.built !== "true" && !check("Every locked package and tool, fetched before the restore and held to its list", () => {
      const fetched = path.join(temp, "nuget-fetched");
      const got = node(coreAt, "nuget-fetch.mjs", [o.nuget, "--into", fetched]);
      return verdict(node(coreAt, "nuget.mjs", [o.nuget, "--packages", fetched, "--fetched", ...advisory]) && got);
    })) return;
    const packages = path.join(temp, "nuget-packages");
    if (!check("Restore each project file from its lock file alone", () => {
      // (the project files git knows, and where packages come from, each a line as the script lists them, the registry
      // first: given to every restore, they overrule the sources any NuGet.Config names; without them nothing is restored)
      const list = args => spawnSync(process.execPath, [`${coreAt}scripts/nuget.mjs`, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
      const projects = list(["--projects"]), sources = list([o.nuget, "--sources"]);
      if (projects.status !== 0) return false;
      let passed = sources.status === 0;
      if (passed) {
        const from = sources.stdout.split(/\r?\n/).filter(Boolean).flatMap(s => ["--source", s]);
        for (const project of projects.stdout.split(/\r?\n/).filter(Boolean)) {
          // (the two properties given here overrule a project's own: its packages go to the folder the check reads, and
          // its lock file is the one beside it; each project named from the root, behind "./", so no name reads as an option)
          if (!run("dotnet", ["restore", "--locked-mode", ...from, `-p:RestorePackagesPath=${packages}`, "-p:NuGetLockFilePath=", `./${project}`], { env: { NUGET_PACKAGES: packages, ...dotnet } })) passed = false;
        }
      }
      if (!passed) console.log(`FAIL A restore from a lock file failed (dotnet's errors above): the lock file is not what the project file asks for, a package is not what its lock file names or comes from no source named here (floor rules 7 and 15), or the config names its sources wrongly. ${MEND}where the project file changed, write its lock file anew (dotnet restore --force-evaluate) and commit it, never to take in a package whose content differs from what its lock file names; take out a package no source named in the config serves; or correct the config's sources.`);
      return verdict(passed);
    })) return;
    check("Every package one exact version, and under a licence on its list", () => node(coreAt, "nuget.mjs", [o.nuget, "--packages", packages, ...advisory], { env: { NUGET_PACKAGES: packages } }));
  },
};

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
    if (changed.length) { console.log(`Changed:\n${changed.map(f => `- ${f}`).join("\n")}`); return true; } // (behind a dash, so no file's name starts a workflow command)
    if (/^120000 /m.test(git(["ls-files", "-s", "--", ...paths]))) { console.log("A listed file is a link to another, whose changes this step would not see."); return true; }
    console.log(none);
    return false;
  } catch { return true; }
}

// (last, so every part above is defined when it runs)
if (started(import.meta.url)) main();
