// The starter kit (README.md, "How a project takes the core"; setup/starter-kit.md): run from a clone of the core, in
// the root of a project that has none of these files yet, it writes what the project needs before its first task (the
// manifest, the rule files, the hooks' settings, the configs of the copies, reading-size and licence checks, the issue
// forms, Dependabot's config and its calls to the core's workflows, each pinned to the commit the manifest pins) and
// makes the first copy of the core under core/. It never overwrites: where one of its files exists, it names them and
// writes nothing. It ends by listing what is left: the lines the project fills in itself, and the owner's settings.
// It commits and pushes nothing. Git, tar and Node's own modules only.
//
//   node <the clone>/scripts/init.mjs --owner <login> [--name <the project's name>] [--at <full SHA>]
//                                     [--npm <the folder of package-lock.json>] [--private] [--game]
//
//   --owner    the owner's GitHub login: the *owner's account* (floor rule 4), the issue forms' assignee
//   --name     the project's name in its rule files; left out, its folder's
//   --at       the commit of the core's main the project starts from; left out, the clone's own HEAD
//   --npm      its packages come from npm: the signature check and Dependabot's npm updates, for that folder
//   --private  a private repository without GitHub's paid code security: no call to the core's CodeQL and licence
//              workflows, which need it (README.md, point 5, "A private repository")
//   --game     a game: the module game-design.md with the others
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { started } from "./started.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES = path.join(ROOT, "setup", "template");
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
class Failure extends Error {}
const fail = msg => { throw new Failure(msg); };

// Each template and the file it becomes, with when it is written (left out: always). One line a file, so the kit is
// read here whole: setup/starter-kit.md says only how a template is written.
export const FILES = [
  ["core-manifest.md.tmpl", "core-manifest.md"],
  ["AGENTS.md.tmpl", "AGENTS.md"],
  ["CLAUDE.md.tmpl", "CLAUDE.md"],
  ["SECURITY.md.tmpl", "SECURITY.md"],
  ["threat-model.md.tmpl", "docs/threat-model.md"],
  ["PROGRESS.md.tmpl", "docs/PROGRESS.md"],
  ["claude-settings.json.tmpl", ".claude/settings.json"],
  ["copies.json.tmpl", "checks/copies.json"],
  ["licences-audit.json.tmpl", "checks/licences-audit.json"],
  ["dependabot.yml.tmpl", ".github/dependabot.yml"],
  ["issue-bug.md.tmpl", ".github/ISSUE_TEMPLATE/bug_report.md"],
  ["issue-idea.md.tmpl", ".github/ISSUE_TEMPLATE/feature_request.md"],
  ["workflows/core.yml.tmpl", ".github/workflows/core.yml"],
  ["workflows/copies.yml.tmpl", ".github/workflows/copies.yml"],
  ["workflows/pr-description.yml.tmpl", ".github/workflows/pr-description.yml"],
  ["workflows/security-review.yml.tmpl", ".github/workflows/security-review.yml"],
  ["workflows/personal-terms.yml.tmpl", ".github/workflows/personal-terms.yml"],
  ["workflows/delete-merged-branches.yml.tmpl", ".github/workflows/delete-merged-branches.yml"],
  ["workflows/core-moved.yml.tmpl", ".github/workflows/core-moved.yml"],
  ["workflows/codeql.yml.tmpl", ".github/workflows/codeql.yml", o => !o.private],
  ["workflows/licences.yml.tmpl", ".github/workflows/licences.yml", o => !o.private],
  ["workflows/signatures.yml.tmpl", ".github/workflows/signatures.yml", o => o.packages !== undefined],
];
// What the script makes itself, beside the templates' files: none of these may exist either.
const MADE = ["checks/sizes.json", "checks/licences.json", "checks/copies-baseline.json", "core"];
// The files every session reads at its start, as the AGENTS.md template imports them: the reading-size check's marks.
const READ = ["AGENTS.md", "CLAUDE.md", "docs/PROGRESS.md", "core-manifest.md", "core/floor/security.md", "core/modules/how-to-work.md",
  "core/modules/inbox.md", "core/modules/work-flow.md", "core/modules/git.md", "core/modules/claude.md", "core/modules/other-builders.md"];
const KB = 1024;

// The options of a command line, or a Failure that says what is wrong with it. Each value is held to its own form
// before it reaches a file: a login, a commit, a folder inside the project, a name on one line.
export function options(argv) {
  const o = {};
  const VALUE = { "--owner": "owner", "--name": "name", "--npm": "packages", "--at": "at" };
  const FLAG = { "--private": "private", "--game": "game" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a in FLAG) o[FLAG[a]] = true;
    else if (a in VALUE) { if (argv[i + 1] === undefined) fail(`${a} needs a value`); o[VALUE[a]] = argv[++i]; }
    else fail(`unknown argument: ${a}`);
  }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(o.owner ?? "")) fail("--owner <login>: the owner's GitHub login (letters, digits and hyphens)");
  if (o.at !== undefined && !/^[0-9a-f]{40}$/.test(o.at)) fail("--at <full SHA>: the core's commit as 40 hex characters");
  if (o.name !== undefined && (!/^[^\r\n{}`|<>]{1,80}$/u.test(o.name) || o.name.trim() !== o.name)) fail("--name: one line of 80 characters at most, without braces, backticks, bars or angle brackets");
  if (o.packages !== undefined) {
    o.packages = o.packages.replace(/\\/g, "/").replace(/\/+$/, "") || ".";
    if (!/^(\.|[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*)$/.test(o.packages)) fail("--npm <folder>: a folder inside the project, from its root (. for the root itself)");
  }
  return o;
}

// The modules a project takes, as its manifest lists them: all of them for a game, and for any other project each but
// the games' own, by name, read from the core's own folder so the list is the core's at that commit.
export function modules(names, game) {
  return game ? "all" : names.filter(n => n !== "game-design.md").sort().map(n => `\`${n}\``).join(", ");
}

// A template's text with its words filled in; one left unfilled is a fault of the kit, and fails.
export function fill(text, words) {
  const out = text.replace(/\{\{([a-z]+)\}\}/g, (whole, word) => words[word] ?? whole);
  const left = out.match(/\{\{[a-z]+\}\}/);
  if (left) fail(`the starter kit leaves ${left[0]} unfilled`);
  return out;
}

// Every file the kit writes for these options, as [path, text], before the copy of the core: the templates' files.
export function files(o, pin, moduleNames) {
  const words = { owner: o.owner, project: o.name, core: CORE, pin, npm: o.packages, modules: modules(moduleNames, o.game) };
  const read = name => fs.readFileSync(path.join(TEMPLATES, name), "utf8");
  return FILES.filter(([, , when]) => !when || when(o)).map(([template, to]) => {
    let text = fill(read(template), words);
    if (to === ".github/dependabot.yml" && o.packages !== undefined) text += fill(read("dependabot-npm.yml.tmpl"), { ...words, npm: o.packages === "." ? "" : o.packages });
    return [to, text];
  });
}

// The reading-size check's first marks: each file every session reads at about 20 KB, and their total at what they
// come to today, rounded up to a whole KB with one to spare, so the first task has room and the mark means something.
export function sizes(bytes) {
  const total = Object.values(bytes).reduce((a, b) => a + b, 0);
  return { each: 20 * KB, read: Object.fromEntries(Object.keys(bytes).map(f => [f, 20 * KB])), total: (Math.ceil(total / KB) + 1) * KB, split: 50 * KB, skip: [], past: {} };
}

// The licence check's first config: nothing ships yet, and of npm's files only those that stand today are named,
// since the check fails on one it cannot read. `has`: whether a path of the project exists.
export function licences(o, has) {
  const config = { ships: [], audit: "checks/licences-audit.json", scan: { served: [], skip: [] } };
  if (o.packages === undefined) return config;
  const at = name => o.packages === "." ? name : `${o.packages}/${name}`;
  return { lockfiles: [at("package-lock.json")].filter(has), ...config, ignoreScriptsIn: [at(".npmrc")].filter(has) };
}

function init(argv) {
  const o = options(argv);
  const here = process.cwd();
  // (asked of git as a path from the repository's root, empty at the root itself: no two spellings of one folder,
  // such as Windows' short names, are ever compared)
  let below;
  try { below = git(["rev-parse", "--show-prefix"], here); } catch { fail("run it in the root of the project's git repository (git init first)"); }
  if (below !== "") fail("run it in the root of the project's git repository");
  if (fs.realpathSync.native(here) === fs.realpathSync.native(ROOT)) fail("run it in the project, not in the core itself");
  o.name ??= path.basename(here);
  if (!/^[^\r\n{}`|<>]{1,80}$/u.test(o.name)) fail("the folder's name does not serve as the project's: give --name");

  let pin;
  try { pin = git(["rev-parse", `${o.at ?? "HEAD"}^{commit}`], ROOT); } catch { fail(o.at ? `${o.at} is no commit of this clone of the core` : "run it from a clone of the core (the script's own folder is no git repository)"); }
  // (a clone knows the core's main as origin/main: where it does, the pin is held to it here; core.yml holds it always)
  let main = null;
  try { main = git(["rev-parse", "--verify", "--quiet", "refs/remotes/origin/main"], ROOT); } catch { /* (no such ref: core.yml decides) */ }
  if (main) { try { git(["merge-base", "--is-ancestor", pin, main], ROOT); } catch { fail(`${pin} is not a commit of the core's main, as this clone knows it`); } }
  const moduleNames = git(["ls-tree", "--name-only", `${pin}:modules`], ROOT).split("\n").filter(n => n.endsWith(".md"));

  const out = files(o, pin, moduleNames);
  const taken = [...out.map(([to]) => to), ...MADE].filter(to => fs.existsSync(path.join(here, to)));
  if (taken.length) fail(`the project already has ${taken.join(", ")}: the starter kit never overwrites, and wrote nothing`);

  for (const [to, text] of out) {
    fs.mkdirSync(path.dirname(path.join(here, to)), { recursive: true });
    fs.writeFileSync(path.join(here, to), text);
  }
  // the first copy, as the sync makes every copy: the core's tree at the pin, without what it keeps to itself
  fs.mkdirSync(path.join(here, "core"));
  // ("-f -": Windows' own tar reads a tape drive unless told to read its input)
  execFileSync("tar", ["-x", "-f", "-", "-C", "core"], { cwd: here, input: execFileSync("git", ["archive", pin], { cwd: ROOT, maxBuffer: 1 << 28 }) });
  const marks = sizes(Object.fromEntries(READ.map(f => [f, fs.statSync(path.join(here, f)).size])));
  fs.writeFileSync(path.join(here, "checks/sizes.json"), `${JSON.stringify(marks, null, 2)}\n`);
  const licence = licences(o, f => fs.existsSync(path.join(here, f)));
  fs.writeFileSync(path.join(here, "checks/licences.json"), `${JSON.stringify(licence, null, 2)}\n`);
  // the copies check's first baseline: the copies that stand today (it reads the files git knows of)
  const made = [...out.map(([to]) => to), "checks/sizes.json", "checks/licences.json", "core"];
  git(["add", "--", ...made], here);
  execFileSync(process.execPath, ["core/scripts/copies.mjs", "checks/copies.json", "--first"], { cwd: here, stdio: ["ignore", "ignore", "inherit"] });
  git(["add", "--", "checks/copies-baseline.json"], here);

  console.log(`The starter kit is written: ${out.length + 3} files (the last three checks/sizes.json, checks/licences.json and checks/copies-baseline.json), and core/ at ${pin.slice(0, 7)}. All of it is staged; nothing is committed.`);
  const open = out.flatMap(([to, text]) => text.split("\n").map((line, i) => line.includes("FILL IN:") ? `  ${to}:${i + 1}: ${line.slice(line.indexOf("FILL IN:") + 9).trim()}` : null).filter(Boolean));
  console.log(`\nLeft for the project, each marked FILL IN:\n${open.join("\n")}`);
  console.log(`  checks/copies.json: "code", the project's own code as git pathspecs, once it has any`);
  console.log("  checks/licences.json: \"ships\" and \"scan\", once something reaches its users; \"lockfiles\" and \"ignoreScriptsIn\", each npm lock file and .npmrc that did not stand yet");
  console.log("  where it has versions Dependabot cannot see, its versions check: the core's README, point 5");
  if (o.private) console.log("  no call to the core's CodeQL and licence workflows was written (--private): a workflow of the project's own runs the licence check, as the core's README, point 5, \"A private repository\", says");
  console.log(`\nLeft for the owner (the core's README, "Setting up"): the ruleset on main, with the checks \`core / core\` and the project's own required;`);
  console.log("  the Actions setting that every action is pinned to a full commit SHA; the Actions secret PERSONAL_TERMS; and the security reviewer's app.");
}

if (started(import.meta.url)) {
  try { init(process.argv.slice(2)); } catch (e) {
    console.error(`FAIL: ${e instanceof Failure ? e.message : e.stack}`);
    process.exitCode = 1;
  }
}
