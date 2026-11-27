// Tests of agent-tools.mjs (floor topic 15, "An agent's own tools are code with its sign-ins"): the kit's own hooks,
// a project with no list and nesting. Each case a made-up project in a temporary git repository, never a real one,
// run as licences.yml runs the check, and every failure read for its mend (mend.mjs). Git and Node's own modules; the
// projects and their runs stand in scripts/agent-tools-scratch.mjs, which the tests beside this one share.
//
//   node tests/agent-tools-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { kitHooks } from "../scripts/agent-tools.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { hookCommands, readCore } from "../scripts/core-path.mjs";
import { kitForm } from "../scripts/hook-source.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { parseToml } from "../scripts/toml.mjs";
import { KIT, run, project, pr, env, git, change, LINKS, link, cli, SCRIPT, withPlugins, listing, PLUGIN, asserting } from "../scripts/agent-tools-scratch.mjs";
import { tally } from "../scripts/scratch-core.mjs";
import { OWN_SCRIPT } from "../scripts/core-path-scratch.mjs";

const { ok, done } = tally();
const { passes, fails } = asserting(ok);

// ---- the kit's own hooks are the core's ----
const kitGroups = JSON.parse(KIT).hooks;
const allKit = kitHooks().map(id => JSON.parse(id)), kitIds = allKit.filter(id => id.length === 4);
ok(JSON.stringify(allKit.filter(id => id.length === 5).map(([, tool, event]) => `${tool} ${event}`)) === JSON.stringify(["Kiro SessionStart", "Kiro Stop", "Codex SessionStart", "Codex Stop"]),
  "the starter kit's hooks for Kiro and Codex are the core's too", JSON.stringify(allKit));
ok(JSON.stringify(kitIds.map(([, event, matcher, hook]) => [event, matcher, hook.type])) === JSON.stringify([["SessionStart", "startup|resume", "command"], ["PreToolUse", "Agent|Task", "command"], ["Stop", "", "command"]]) && kitIds[2][3].command === kitGroups.Stop[0].hooks[0].command && kitIds[2][3].timeout === kitGroups.Stop[0].hooks[0].timeout,
  "the starter kit's hooks are read by event, matcher and the whole hook", JSON.stringify(kitIds));
const reordered = JSON.parse(KIT);
reordered.hooks.Stop[0].hooks[0] = Object.fromEntries(Object.entries(reordered.hooks.Stop[0].hooks[0]).reverse());
passes(run(project({ ".claude/settings.json": JSON.stringify(reordered), "checks/licences.json": { lockfiles: [], agentTools: [] } })), "the kit's hook with its keys in another order is still the kit's");
const pair = { hooks: { ...JSON.parse(KIT).hooks, PostToolUse: [{ hooks: [{ type: "command", command: "echo hi", timeout: 30 }] }, { hooks: [{ type: "command", command: "echo hi", timeout: 60 }] }] } };
passes(run(pr(project({ ".claude/settings.json": pair }), { "README.md": "a change of its own\n" })), "two hooks of one command a timeout apart, held by the base, fail nothing");
const slower = JSON.parse(KIT);
slower.hooks.Stop[0].hooks[0].timeout = 600;
fails(run(project({ ".claude/settings.json": JSON.stringify(slower), "checks/licences.json": { lockfiles: [], agentTools: [] } })), "a kit's command with another timeout is not the kit's hook", 'the hook "Stop: ');
passes(run(project()), "a project as the starter kit writes it, with no list, passes");
// (a copy at another path than core/, which its manifest names: the kit's hooks with that path written in, or the commands
// core-path.mjs gives for it, are the kit's own; the kit's hooks naming core/ are not, there: #628)
{
  const line = `Core: ${CORE} at ${"a".repeat(40)}, copied whole under vendor/core/ (never edited here).\n`, empty = { lockfiles: [], agentTools: [] };
  const given = JSON.parse(KIT), commands = hookCommands(readCore(line));
  given.hooks.SessionStart[0].hooks[0].command = commands.start;
  given.hooks.PreToolUse[0].hooks[0].command = commands.helper;
  given.hooks.Stop[0].hooks[0].command = commands.stop;
  fails(run(project({ "core-manifest.md": line, ".claude/settings.json": KIT.replaceAll("origin/main:core/", "origin/main:vendor/core/"), "checks/licences.json": empty })), "the kit's hooks with the copy's path written in, the manifest naming it, are not the kit's own: a session would start without the floor", "is not listed");
  passes(run(project({ "core-manifest.md": line, ".claude/settings.json": given, "checks/licences.json": empty })), "the commands core-path.mjs gives for the copy's path are the kit's own");
  fails(run(project({ "core-manifest.md": line, ...OWN_SCRIPT, ".claude/settings.json": given, "checks/licences.json": empty })), "but not in the core's own repository, which tracks scripts/core-path.mjs at its root and holds no copy whatever manifest stands there", "is not listed");
  fails(run(project({ "core-manifest.md": line, "checks/licences.json": empty })), "the kit's hooks naming core/ where the manifest names another path are not the kit's own", "is not listed");
  // (the commands core-path.mjs gives for a path other than core/ are in the kit's form: they run main's copy, a library's at
  // the commit main pins, and a session whose floor cannot be read is stopped first; a working tree's file is none)
  const forms = [line, `Core: ${CORE}, carried by lib/ under lib/core/ (never edited here).\n`].flatMap(l => Object.values(hookCommands(readCore(l))));
  ok(forms.length === 6 && forms.every(kitForm), "the commands for a copy at another path, and for a core a library carries, are in the kit's form", forms.filter(c => !kitForm(c)).join("\n"));
  const start = hookCommands(readCore(`Core: ${CORE}, carried by lib/ under lib/core/ (never edited here).\n`)).stop;
  const own = '${CLAUDE_PROJECT_DIR:-.}';
  const variants = [start.replace("modules/lib", "modules/other"), start.replace(" 2>/dev/null; }) || exit 0", "; }) || exit 0; rm -rf x"), start.replace("refs/remotes/origin/main:lib", "HEAD:lib"), start.replace(`git -C "${own}" --git-dir="$m"`, `git -C "${own}"/lib`),
    start.replace(`git -C "${own}" --git-dir="$m"`, `git --git-dir="${own}"/lib/.git`), start.replace('"$s:core/scripts/work-saved.sh"', '"$s:core/scripts/other.sh"'), start.replace("main:lib 2>", "main:other 2>").replace("modules/lib", "modules/other")];
  ok(variants.every(v => v !== start) && !variants.some(kitForm),
    "and a variation of them that reads the library's file from another folder or from the working tree, runs more, lets git find a repository a branch committed in the library's place, or shows another file of the library's commit than the one fetched first, is not");
  // (a core a library carries: the same)
  const carried = `Core: ${CORE}, carried by lib/ under lib/core/ (never edited here).\n`, forCarried = JSON.parse(KIT), commandsFor = hookCommands(readCore(carried));
  forCarried.hooks.SessionStart[0].hooks[0].command = commandsFor.start; forCarried.hooks.PreToolUse[0].hooks[0].command = commandsFor.helper; forCarried.hooks.Stop[0].hooks[0].command = commandsFor.stop;
  passes(run(project({ "core-manifest.md": carried, ".claude/settings.json": forCarried, "checks/licences.json": empty })), "for a core a library carries, the commands core-path.mjs gives for it are the kit's own");
  fails(run(project({ "core-manifest.md": carried, ".claude/settings.json": KIT.replaceAll("origin/main:core/", "origin/main:lib/core/"), "checks/licences.json": empty })), "for a core a library carries, the kit's hooks with the path written in are not the kit's own either", "is not listed");
  // (a variation of the commands that shows another file of the library's commit than the one fetched first, or git run in
  // the library's folder: not the kit's hooks, fails, #930)
  for (const [variant, what] of [[commandsFor.start.replace('"$s:core/scripts/work-saved.sh"', '"$s:core/scripts/other.sh"'), "a fallback that shows another file of the library's commit than the one fetched first"],
    [commandsFor.start.replace('git -C "${CLAUDE_PROJECT_DIR:-.}" --git-dir="$m"', 'git -C "${CLAUDE_PROJECT_DIR:-.}"/lib'), "one that runs git in the library's folder"]]) {
    const given = JSON.parse(KIT); given.hooks.SessionStart[0].hooks[0].command = variant;
    fails(run(project({ "core-manifest.md": carried, ".claude/settings.json": given, "checks/licences.json": empty })), `${what} is not the kit's own`, "is not listed");
  }
  // (what the library's commit main pins holds at the script a carried core's hook reads: git prints a link's target, which
  // bash runs as a command; the check reads it in the superproject's own module repository, as the hook does, #930)
  const gitf = (dir, ...args) => execFileSync("git", ["-c", "protocol.file.allow=always", ...args], { cwd: dir, env, encoding: "utf8" }).trim();
  const library = () => {
    const lib = scratchDir("agent-tools-lib-");
    git(lib, "init", "-q", "-b", "main");
    const commit = files => { change(lib, files); git(lib, "add", "-A"); git(lib, "commit", "-q", "-m", "library"); return git(lib, "rev-parse", "HEAD"); };
    return { lib, commit };
  };
  if (LINKS) {
    const good = { "core/scripts/work-saved.sh": "echo saved\n", "core/scripts/helper-call.mjs": "// helper\n" };
    const { lib, commit } = library();
    commit(good);
    const linkedScript = commit({ ...good, "core/scripts/work-saved.sh": link("../../../elsewhere.sh") });
    const plainAgain = commit(good);
    const carriedProject = () => {
      const dir = project({ "core-manifest.md": carried, ".claude/settings.json": forCarried, "checks/licences.json": empty });
      gitf(dir, "submodule", "add", "-q", lib, "lib");
      gitf(dir, "submodule", "update", "--init", "-q");
      git(dir, "commit", "-q", "-m", "the library, pinned at its newest commit");
      return dir;
    };
    // (the library pinned at `to` by a pull request, as a bump of it: the base holds the earlier pin)
    const bump = (dir, to, files = {}) => {
      git(dir, "checkout", "-q", "-B", "change");
      gitf(path.join(dir, "lib"), "checkout", "-q", to);
      change(dir, files);
      git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "bump");
      git(dir, "checkout", "-q", "main"); git(dir, "merge", "-q", "--no-ff", "-m", "merge", "change");
      return dir;
    };
    // (the submodule's files left out of the working tree, as a checkout that brings in no submodule leaves them: the check
    // reads the commit main pins, never the folder; its module repository stays where git keeps it)
    const bare = dir => { for (const f of fs.readdirSync(path.join(dir, "lib"))) fs.rmSync(path.join(dir, "lib", f), { recursive: true, force: true }); return dir; };
    const first = git(lib, "rev-parse", "HEAD~2");
    const pinned = () => { const dir = carriedProject(); bump(dir, first); return dir; };
    passes(run(bare(bump(pinned(), plainAgain))), "a carried core whose pinned commit holds the hooks' scripts as plain files passes");
    const SAYS = 'reads "core/scripts/work-saved.sh" from the commit of "lib" that main pins, which holds it as no plain file';
    fails(run(bare(bump(pinned(), linkedScript))), "a carried core whose pinned commit holds the hook's script as a link fails", SAYS, 'make "core/scripts/work-saved.sh" a plain file committed in "lib"');
    // (a hook of the base's, held before: noted, as one that stood is; and with the library's objects not at hand: said, never failed)
    const standing = bare(bump(bump(pinned(), linkedScript), linkedScript, { "README.md": "a change of its own\n" }));
    const stood = run(standing);
    ok(stood.status === 0 && stood.out.includes(SAYS), "one the base held is noted, not failed", stood.out);
    const away = bare(bump(pinned(), linkedScript));
    fs.rmSync(path.join(away, ".git", "modules", "lib"), { recursive: true, force: true });
    const unread = run(away);
    ok(unread.status === 0 && unread.out.includes("not read:") && unread.out.includes("git submodule update --init lib"), "where the submodule's repository is not at hand, the file is said not read, never failed", unread.out);
    // (the library's folder itself a link in the branch's commit: the folder it leads to is the branch's to choose)
    const asLink = pinned();
    git(asLink, "checkout", "-q", "-B", "change"); git(asLink, "rm", "-q", "-f", "lib");
    change(asLink, { lib: link("../elsewhere") });
    git(asLink, "add", "-A", "-f"); git(asLink, "commit", "-q", "-m", "lib as a link"); git(asLink, "checkout", "-q", "main"); git(asLink, "merge", "-q", "--no-ff", "-m", "merge", "change");
    fails(run(asLink), "a carried core whose library's folder is committed as a link fails", 'reads "core/scripts/work-saved.sh" from the library "lib", which this project commits as a link', 'commit "lib" as the submodule that carries the core');
  }
}
passes(run(project({ "checks/licences.json": { lockfiles: [], agentTools: [] } })), "and with an empty list");
passes(run(project({ "checks/licences.json": { lockfiles: [], agentTools: [] } }), "--core"), "in the core's own repository too");
// (the command prints what the check gives, and exits as it says, as the cases here read it)
for (const [dir, what] of [[project(), "passes"], [project({ ".claude/settings.json": JSON.stringify(slower), "checks/licences.json": { lockfiles: [], agentTools: [] } }), "fails"]]) {
  const asRun = cli(dir), asCalled = run(dir);
  ok(asRun.status === asCalled.status && asRun.out === asCalled.out, `the command, on a project that ${what}, prints what the check gives and exits ${asCalled.status}`, `${asRun.status}\n${asRun.out}\n----\n${asCalled.out}`);
}
{ const r = spawnSync(process.execPath, [SCRIPT], { cwd: project(), encoding: "utf8" }); ok(r.status === 2 && r.stderr.includes("usage: "), "the command with no config says how it is run and exits 2", `${r.status}\n${r.stderr}`); }
// ---- with no list yet: the pull request's base counts as it (nothing locks a project) ----
const old = project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }) });
const noted = run(old);
ok(noted.status === 0 && /note .*holds no "agentTools" yet[\s\S]*helper@example-market/.test(noted.out), "with no list and no base, as on a push, what is unlisted is noted and nothing fails", noted.out);
passes(run(pr(old, { "README.md": "a change of its own\n" })), "a pull request that adds no tool passes, a tool its base held unlisted standing");
fails(run(pr(project(), { ".claude/settings.json": withPlugins({ "helper@example-market": true }) })), "a pull request that adds an unlisted tool fails", "is new in this pull request and listed nowhere");
passes(run(pr(project(), { ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing(PLUGIN) })), "and passes once it writes the list");
fails(run(pr(project(), { ".claude/skills/notes/SKILL.md": "x" })), "a pull request that adds a skill, unlisted, fails", 'the skill "notes"');
fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }) }), "--core"), "in the core's own repository a missing list counts as empty, so an unlisted tool fails", "is not listed");
// ---- no key of a project's file reaches an object's prototype (#476's fallback security review) ----
{
  const t = parseToml("[__proto__]\nenabledPlugins = { \"evil@m\" = true }\n[a]\n__proto__.x = 1\n");
  ok(({}).enabledPlugins === undefined && ({}).x === undefined && Object.hasOwn(t, "__proto__") && Object.hasOwn(t.a.__proto__, "x"), "a TOML key \"__proto__\" fills a table of its own, never Object.prototype");
  fails(run(pr(project({ ...listing() }), { ".claude/settings.json": withPlugins({ "evil@m": true }), ".codex/config.toml": "[__proto__]\nenabledPlugins = { \"evil@m\" = true }\n" })), "so a plug-in turned on beside such a config.toml is still not the kit's, and fails unlisted", 'the plug-in "evil@m"');
}
// ---- nesting is bounded, and a line from the project stays on its line ----
{
  const deep = `{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"true","more":${"[".repeat(20000)}1${"]".repeat(20000)}}]}]}}`;
  fails(run(project({ ".claude/settings.json": deep, ...listing() })), "settings nested past the bound are not read", ".claude/settings.json cannot be read as a JSON object, nested no deeper than 200 objects and lists");
  fails(run(project({ "checks/licences.json": `{"lockfiles":[],"agentTools":${"[".repeat(20000)}${"]".repeat(20000)}}` })), "a config nested past the bound is not read", "checks/licences.json cannot be read (it nests deeper than 200 objects and lists)");
  const withLine = JSON.parse(KIT);
  withLine.hooks.Stop.push({ matcher: "x", hooks: [{ type: "command", command: "y\n::name::value" }] });
  const r = run(project({ ".claude/settings.json": withLine, ...listing() }));
  ok(r.status === 1 && !r.out.split(/\r?\n/u).some(l => l.startsWith("::")), "a command from the project is printed on its own line, no part of it starting another", r.out);
}

done("the kit's hooks, a project with no list and nesting");
