// The starter kit (README.md, "How a project takes the core"; setup/starter-kit.md): run from a clone of the core, in
// the root of a project that has none of these files yet, it writes what the project needs before its first task (the
// manifest, the rule files, the hooks' settings, the configs of the copies, shape, reading-size and licence checks, the issue
// forms, the choice records, Dependabot's config and its calls to the core's workflows, each pinned to the commit the
// manifest pins) and makes the first copy of the core under core/. The templates and the copy are both read from the
// commit the manifest pins, never from the clone's working folder, so what it writes is what was reviewed. It never
// overwrites: where one of its files exists, it names them and writes nothing; nor does it write through a link, which
// could lead outside the project (floor rule 13). It ends by listing what is left: the lines the project fills in
// itself, and the owner's settings. It commits and pushes nothing. Git, tar and Node's own modules only.
//
//   node <the clone>/scripts/init.mjs --owner <login> [--name <the project's name>] [--at <full SHA>]
//                                     [--npm <the folder of package-lock.json>] [--nuget <the folder of the solution>]
//                                     [--private] [--game]
//
//   --owner    the owner's GitHub login: the *owner's account* (floor rule 4), the issue forms' assignee
//   --name     the project's name in its rule files; left out, its folder's
//   --at       the commit of the core's main the project starts from; left out, the clone's own HEAD
//   --npm      its packages come from npm: the signature check and Dependabot's npm updates, for that folder
//   --nuget    its packages come from NuGet (.NET): the NuGet check and Dependabot's NuGet updates, for the folder
//              that holds its solution or project files (. for the root)
//   --private  a private repository without GitHub's paid code security: no call to the core's CodeQL and licence
//              workflows, which need it (README.md, point 5, "A private repository"), a NuGet check started only
//              by a pull request that changes a file NuGet reads by name, and each pull-request check started only
//              once a pull request is no draft (READY_ONLY)
//   --game     a game: the module game-design.md with the others
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { sizeOf } from "./file-size.mjs";
import { MODULES } from "./reading.mjs";
import { plainEnv } from "./releases.mjs";
import { started } from "./started.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TEMPLATES = "setup/template";
// (every call without git's own variables that point at another repository, so each lands in the folder it names:
// releases.mjs)
const raw = (args, cwd, env = plainEnv()) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 });
const git = (args, cwd, env) => raw(args, cwd, env).trim();
// For every call made in the project itself, whose own git settings are not the kit's to trust (a folder may come
// whole from someone else): the two settings that run a command by themselves are turned off, as work-saved.sh turns
// them off. A filter of the project's own, which would run on `git add`, cannot be turned off so: the kit refuses a
// project whose own settings hold one, before it adds anything (`filtered`, below).
const guarded = () => ({ ...plainEnv(), GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "core.fsmonitor", GIT_CONFIG_VALUE_0: "false", GIT_CONFIG_KEY_1: "core.hooksPath", GIT_CONFIG_VALUE_1: "/dev/null" });
class Failure extends Error {}
const fail = msg => { throw new Failure(msg); };

// Each template and the file it becomes, with when it is written (left out: always). One line a file, so the kit is
// read here whole: setup/starter-kit.md says only how a template is written.
export const FILES = [
  ["core-manifest.md.tmpl", "core-manifest.md"],
  ["AGENTS.md.tmpl", "AGENTS.md"],
  ["CLAUDE.md.tmpl", "CLAUDE.md"],
  ["kiro-steering.md.tmpl", ".kiro/steering/core.md"],
  ["antigravity-rule.md.tmpl", ".agents/rules/core.md"],
  ["kiro-hook.json.tmpl", ".kiro/hooks/work-saved.json"],
  ["codex-hooks.json.tmpl", ".codex/hooks.json"],
  ["SECURITY.md.tmpl", "SECURITY.md"],
  ["threat-model.md.tmpl", "docs/threat-model.md"],
  ["PROGRESS.md.tmpl", "docs/PROGRESS.md"],
  ["choices.md.tmpl", "docs/choices.md"],
  ["claude-settings.json.tmpl", ".claude/settings.json"],
  ["copies.json.tmpl", "checks/copies.json"],
  ["shape.json.tmpl", "checks/shape.json"],
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
  ["workflows/look.yml.tmpl", ".github/workflows/look.yml"],
  ["workflows/codeql.yml.tmpl", ".github/workflows/codeql.yml", o => !o.private],
  ["workflows/licences.yml.tmpl", ".github/workflows/licences.yml", o => !o.private],
  ["workflows/signatures.yml.tmpl", ".github/workflows/signatures.yml", o => o.packages !== undefined],
  ["workflows/nuget.yml.tmpl", ".github/workflows/nuget.yml", o => o.nuget !== undefined],
];
// What the script makes itself, beside the templates' files: none of these may exist either.
const MADE = ["checks/sizes.json", "checks/licences.json", "checks/copies-baseline.json", "checks/shape-baseline.json", "core"];
// What a builder's session reads at its start in a project the kit writes at any commit, as the kit's own entry files
// there name it: the files of READ that are the project's own, each file of the core its AGENTS.md and CLAUDE.md pull
// in on a line of its own, and the part for every tool but Claude beside Claude's: the reading-size check's marks. For
// the kit as it stands it is READ.
export function startOf(written) {
  const pulled = [...`${written["AGENTS.md"] ?? ""}\n${written["CLAUDE.md"] ?? ""}`.matchAll(/^@(core\/[\w./-]+\.md)[ \t]*$/gmu)].map(m => m[1]);
  const claude = pulled.find(f => f.endsWith("/claude.md"));
  return [...new Set([...READ.filter(f => !f.startsWith("core/")), ...pulled, ...(claude ? [claude.replace(/claude\.md$/u, "other-builders.md")] : [])])];
}
// The files every session reads at its start, as the AGENTS.md template of the kit as it stands imports them, and of
// the core's own (those under core/) what the core's cap counts (size.mjs).
export const READ = ["AGENTS.md", "CLAUDE.md", "docs/PROGRESS.md", "core-manifest.md", "core/floor/security.md", "core/roles/builder.md", "core/roles/shared/how-to-work.md",
  "core/roles/shared/inbox.md", "core/roles/shared/work-flow.md", "core/tools/claude.md", "core/tools/other-builders.md"];
const KB = 1024;

// A project's name as it may stand in a rule file's heading: letters, digits and blanks, and the few marks a name
// uses, beginning with a letter or digit and ending with no blank. Nothing a tool reads as more than a name gets in:
// no @ (Claude Code takes "@path" in a rule file for a file to read in), no line break of any kind, no control
// character, no bracket, brace, backtick or bar. The folder's name, where it serves as the project's, is held to it too.
// Read in its composed form, so a letter written as a letter and its accent (as a folder's name can be) is one letter;
// marks that belong to a letter are let in after the first, for the scripts that are written with them.
export const NAME = "at most 80 letters, digits and blanks, with . _ ' & , ( ) + ! - : # where a name needs them, beginning with a letter or digit";
export const named = text => /^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._'&,()+!:#-]{0,79}$/u.test(text.normalize("NFC")) && !text.endsWith(" ");

// The commands the project's own git settings would run on `git add`: its filters, read with what its settings
// include, as names only. None is the usual case; the user's own settings, outside the project, are the user's.
export function filtered(lines) {
  return [...new Set(lines.split("\n").map(l => /^(filter\.[^\s]*\.(?:clean|smudge|process))(?:\s|$)/i.exec(l)?.[1]).filter(Boolean))];
}

// The part of a path inside the project that is a link, if any, or null: nothing is written through one, since it may
// lead outside the project. A path that does not exist yet has none from there on.
export function linked(root, to) {
  let at = root;
  for (const part of to.split("/")) {
    at = path.join(at, part);
    let found;
    try { found = fs.lstatSync(at); } catch { return null; }
    if (found.isSymbolicLink()) return path.relative(root, at).split(path.sep).join("/");
  }
  return null;
}

// The options of a command line, or a Failure that says what is wrong with it. Each value is held to its own form
// before it reaches a file: a login, a commit, a folder inside the project, a name on one line.
export function options(argv) {
  const o = {};
  const VALUE = { "--owner": "owner", "--name": "name", "--npm": "packages", "--nuget": "nuget", "--at": "at" };
  const FLAG = { "--private": "private", "--game": "game" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a in FLAG) o[FLAG[a]] = true;
    else if (a in VALUE) { if (argv[i + 1] === undefined) fail(`${a} needs a value`); o[VALUE[a]] = argv[++i]; }
    else fail(`unknown argument: ${a}`);
  }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(o.owner ?? "")) fail("--owner <login>: the owner's GitHub login (letters, digits and hyphens)");
  if (o.at !== undefined && !/^[0-9a-f]{40}$/.test(o.at)) fail("--at <full SHA>: the core's commit as 40 hex characters");
  if (o.name !== undefined && !named(o.name)) fail(`--name: ${NAME}`);
  o.name = o.name?.normalize("NFC");
  for (const [flag, key] of [["--npm", "packages"], ["--nuget", "nuget"]]) {
    if (o[key] === undefined) continue;
    o[key] = o[key].replace(/\\/g, "/").replace(/\/+$/, "") || ".";
    if (!/^(\.|[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*)$/.test(o[key])) fail(`${flag} <folder>: a folder inside the project, from its root (. for the root itself)`);
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

// A game's own rows of its manifest: the slots tasks/game-design.md uses, each left for the project to fill (#329).
export const GAME_ROWS = [
  ["computer players", "what the game calls its computer players, and where their logic lives"],
  ["measured players", "the computer players the measurement plays, and where they live"],
  ["what they are shown", "what the computer players are shown of the game, and where it is made"],
  ["use-against-ignore measurement", "the command that plays a feature used against it ignored, and what it prints"],
  ["where the numbers go", "where that measurement's numbers are kept"],
  ["where rules are taught", "where a player learns the rules, such as the help screen's file"],
];

// The modules' names as a commit of the core holds them: in the folders that say who reads them or when, or, at a commit
// from before the rules moved there, in modules/.
function modulesAt(pin) {
  const namesIn = d => { try { return git(["ls-tree", "--name-only", `${pin}:${d}`], ROOT).split("\n").filter(n => n.endsWith(".md")); } catch { return []; } };
  return MODULES.some(d => namesIn(d).length) ? MODULES.flatMap(namesIn) : namesIn("modules");
}
// Every file the kit writes for these options, as [path, text], before the copy of the core: the templates' files.
// `read` gives a template's text by its name under setup/template/ (the program reads it from the pinned commit).
export function files(o, pin, moduleNames, read) {
  const words = { owner: o.owner, project: o.name, core: CORE, pin, npm: o.packages, nuget: o.nuget, modules: modules(moduleNames, o.game), declined: o.game ? "" : "\nNot taken: `game-design.md` (the project is no game).",
    games: o.game ? GAME_ROWS.map(([slot, what]) => `\n| *${slot}* | FILL IN: ${what} |`).join("") : "" };
  return FILES.filter(([, , when]) => !when || when(o)).map(([template, to]) => {
    let text = fill(read(template), words);
    // (Dependabot's own part for each installer the project named, after the part every project has)
    if (to === ".github/dependabot.yml") {
      const folder = at => at === "." ? "" : at;
      if (o.packages !== undefined) text += fill(read("dependabot-npm.yml.tmpl"), { ...words, npm: folder(o.packages) });
      if (o.nuget !== undefined) text += fill(read("dependabot-nuget.yml.tmpl"), { ...words, nuget: folder(o.nuget) });
    }
    // (a private repository's NuGet check starts only where a pull request changes a file NuGet reads by name: no other
    // pull request bills its job; AGENTS.md, "Nothing locks a project")
    if (to === ".github/workflows/nuget.yml" && o.private) text = text.replace(/^ {2}pull_request:\r?\n/m, on => `${on}${fill(read("workflows/nuget-paths.yml.tmpl"), words)}`);
    if (READY_ONLY.includes(to) && o.private) text = readyOnly(text);
    return [to, text];
  });
}

// A private repository's pull-request checks start only once a pull request is ready (#375): each of these calls also
// triggers when one is marked ready, and its job is skipped on a draft, so a push to a draft bills no job and marking
// it ready runs each once. The trigger and the condition stand together in the project's own file, so a project that
// keeps its calls as they were runs every check as before (AGENTS.md, "Nothing locks a project").
export const READY_ONLY = ["core.yml", "copies.yml", "personal-terms.yml", "signatures.yml", "nuget.yml"].map(f => `.github/workflows/${f}`);
export const READY = "${{ !github.event.pull_request.draft }}";
export const readyOnly = text => text
  // (the trigger's own types, where it lists them, gain the one more; else it lists them: GitHub's three and that one)
  .replace(/^ {2}pull_request:(\r?\n)((?: {4}.*\r?\n)*)/m, (on, eol, block) => /^ {4}types: \[/m.test(block)
    ? on.replace(/^( {4}types: \[[^\]\r\n]*)\]/m, "$1, ready_for_review]")
    : `  pull_request:${eol}    types: [opened, reopened, synchronize, ready_for_review]${eol}${block}`)
  .replace(/^(jobs:\r?\n {2}[\w-]+:(\r?\n))/m, (job, _, eol) => `${job}    if: ${READY}${eol}`);

// The reading-size check's first marks: each file every session reads at about 20 KB, and the total of the project's
// own among them (the core's copy under core/ is held to the core's own cap) at what they come to today, rounded up
// to a whole KB with one to spare, so the first task has room and the mark means something.
export function sizes(bytes) {
  const total = Object.entries(bytes).filter(([f]) => !f.startsWith("core/")).reduce((a, [, b]) => a + b, 0);
  return { each: 20 * KB, read: Object.fromEntries(Object.keys(bytes).map(f => [f, 20 * KB])), total: (Math.ceil(total / KB) + 1) * KB, split: 50 * KB, skip: [], past: {} };
}

// The licence check's first config: nothing ships yet, and of npm's files only those that stand today are named,
// since the check fails on one it cannot read. A project whose packages come from NuGet gets the NuGet check's part,
// its lock files still to be named. `has`: whether a path of the project exists.
export function licences(o, has) {
  const config = { ships: [], audit: "checks/licences-audit.json", scan: { served: [], skip: [] }, ...(o.nuget === undefined ? {} : { nuget: { ships: [], tools: [] } }) };
  if (o.packages === undefined) return config;
  const at = name => o.packages === "." ? name : `${o.packages}/${name}`;
  return { lockfiles: [at("package-lock.json")].filter(has), ...config, ignoreScriptsIn: [at(".npmrc")].filter(has) };
}

// The first baselines of the copies check and the shape check: what stands today, which each reads from the files git
// knows of, so the kit's own are added first.
function firstBaselines(here) {
  for (const check of ["copies", "shape"]) {
    execFileSync(process.execPath, [`core/scripts/${check}.mjs`, `checks/${check}.json`, "--first"], { cwd: here, env: guarded(), stdio: ["ignore", "ignore", "inherit"] });
    git(["add", "--", `checks/${check}-baseline.json`], here, guarded());
  }
}

function init(argv) {
  const o = options(argv);
  const here = process.cwd();
  // (asked of git as a path from the repository's root, empty at the root itself: no two spellings of one folder,
  // such as Windows' short names, are ever compared)
  let below;
  try { below = git(["rev-parse", "--show-prefix"], here, guarded()); } catch { fail("run it in the root of the project's git repository (git init first)"); }
  if (below !== "") fail("run it in the root of the project's git repository");
  if (fs.realpathSync.native(here) === fs.realpathSync.native(ROOT)) fail("run it in the project, not in the core itself");
  o.name ??= path.basename(here).normalize("NFC");
  if (!named(o.name)) fail(`the folder's name does not serve as the project's (${NAME}): give --name`);
  let filters = "";
  try { filters = raw(["config", "--local", "--includes", "--get-regexp", "^filter\\."], here, guarded()); } catch { /* (none: git ends with 1) */ }
  if (filtered(filters).length) fail(`the project's own git settings hold ${filtered(filters).join(", ")}, which would run a command when the kit adds its files: take it out of .git/config first, or start from a fresh git init`);

  let pin;
  try { pin = git(["rev-parse", `${o.at ?? "HEAD"}^{commit}`], ROOT); } catch { fail(o.at ? `${o.at} is no commit of this clone of the core` : "run it from a clone of the core (the script's own folder is no git repository)"); }
  // (a clone knows the core's main as origin/main: where it does, the pin is held to it here; core.yml holds it always)
  let main = null;
  try { main = git(["rev-parse", "--verify", "--quiet", "refs/remotes/origin/main"], ROOT); } catch { /* (no such ref: core.yml decides) */ }
  if (main) { try { git(["merge-base", "--is-ancestor", pin, main], ROOT); } catch { fail(`${pin} is not a commit of the core's main, as this clone knows it`); } }
  const moduleNames = modulesAt(pin);

  const read = name => { try { return raw(["show", `${pin}:${TEMPLATES}/${name}`], ROOT); } catch { return fail(`${pin} holds no ${TEMPLATES}/${name}: take a commit of the core that has the starter kit`); } };
  const out = files(o, pin, moduleNames, read);
  const targets = [...out.map(([to]) => to), ...MADE];
  const links = [...new Set(targets.map(to => linked(here, to)).filter(Boolean))];
  if (links.length) fail(`the project holds a link at ${links.join(", ")}: the starter kit writes through no link, and wrote nothing`);
  // (a link whose target is missing is there all the same: asked without following it)
  const taken = targets.filter(to => { try { fs.lstatSync(path.join(here, to)); return true; } catch { return false; } });
  if (taken.length) fail(`the project already has ${taken.join(", ")}: the starter kit never overwrites, and wrote nothing`);

  // ("wx": a file that has appeared since, a link too, is refused and never written over)
  const write = (to, text) => { fs.mkdirSync(path.dirname(path.join(here, to)), { recursive: true }); fs.writeFileSync(path.join(here, to), text, { flag: "wx" }); };
  for (const [to, text] of out) write(to, text);
  // the first copy, as the sync makes every copy: the core's tree at the pin, without what it keeps to itself
  fs.mkdirSync(path.join(here, "core"));
  // ("-f -": Windows' own tar reads a tape drive unless told to read its input)
  execFileSync("tar", ["-x", "-f", "-", "-C", "core"], { cwd: here, input: execFileSync("git", ["archive", pin], { cwd: ROOT, env: plainEnv(), maxBuffer: 1 << 28 }) });
  const marks = sizes(Object.fromEntries(startOf(Object.fromEntries(out)).map(f => [f, sizeOf(path.join(here, f))])));
  write("checks/sizes.json", `${JSON.stringify(marks, null, 2)}\n`);
  write("checks/licences.json", `${JSON.stringify(licences(o, f => fs.existsSync(path.join(here, f))), null, 2)}\n`);
  git(["add", "--", ...out.map(([to]) => to), "checks/sizes.json", "checks/licences.json", "core"], here, guarded());
  firstBaselines(here);

  console.log(`The starter kit is written: ${out.length + 4} files (the last four checks/sizes.json, checks/licences.json, checks/copies-baseline.json and checks/shape-baseline.json), and core/ at ${pin.slice(0, 7)}. All of it is staged; nothing is committed.`);
  const open = out.flatMap(([to, text]) => text.split("\n").map((line, i) => line.includes("FILL IN:") ? `  ${to}:${i + 1}: ${line.slice(line.indexOf("FILL IN:") + 9).replace(/\s*\|\s*$/, "").trim()}` : null).filter(Boolean));
  console.log(`\nLeft for the project, each marked FILL IN:\n${open.join("\n")}`);
  console.log(`  checks/copies.json: "code", the project's own code as git pathspecs, once it has any`);
  console.log(`  checks/shape.json: "systems", each system the project has, by its name, with its paths, what it uses and its entrance, once it has any; "tests", its test files (core/tasks/code-shape.md)`);
  console.log("  checks/licences.json: \"ships\" and \"scan\", once something reaches its users; \"lockfiles\" and \"ignoreScriptsIn\", each npm lock file and .npmrc that did not stand yet");
  console.log("  where it has versions Dependabot cannot see, its versions check: the core's README, point 5");
  console.log("  its labels, once its repository is on GitHub: node core/scripts/labels.mjs --make, which makes those of core/scripts/labels.json (core/roles/shared/inbox.md)");
  if (o.nuget !== undefined) console.log("  its NuGet packages: lock files turned on (RestorePackagesWithLockFile in its project files or Directory.Build.props) and committed, and each packages.lock.json named in checks/licences.json under \"nuget\", as one whose packages ship or one of tools that only run");
  if (o.private) console.log("  no call to the core's CodeQL and licence workflows was written (--private): a workflow of the project's own runs the licence check, as the core's README, point 5, \"A private repository\", says");
  console.log(`\nLeft for the owner (the core's README, "Setting up"): the ruleset on main, with the checks \`core / core\` and the project's own required;`);
  console.log("  the Actions setting that every action is pinned to a full commit SHA; the Actions secret PERSONAL_TERMS; and the security reviewer's app.");
  console.log("\nWhat owning this project asks of the owner, in one plain page: core/setup/owner-guide.md");
}

if (started(import.meta.url)) {
  try { init(process.argv.slice(2)); } catch (e) {
    console.error(`FAIL: ${e instanceof Failure ? e.message : e.stack}`);
    process.exitCode = 1;
  }
}
