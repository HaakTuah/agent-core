// Tests of agent-tools.mjs (floor topic 15, "An agent's own tools are code with its sign-ins"): each case a made-up
// project in a temporary git repository, never a real one, run as licences.yml runs the check, and every failure read
// for its mend (mend.mjs). Git and Node's own modules.
//
//   node tests/agent-tools-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installedBy, kitHooks, listed, printed } from "../scripts/agent-tools.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { kitForm } from "../scripts/hook-source.mjs";
import { mended } from "../scripts/mend.mjs";
import { STEPS, notDone } from "../scripts/steps.mjs";
import { parseToml } from "../scripts/toml.mjs";
import { readWays, waysOf } from "../scripts/ways.mjs";
import { parserLeftOut } from "../scripts/packages.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/agent-tools.mjs", import.meta.url));
const template = name => fs.readFileSync(fileURLToPath(new URL(`../setup/template/${name}`, import.meta.url)), "utf8");
const KIT = template("claude-settings.json.tmpl"), KIRO = template("kiro-hook.json.tmpl"), CODEX = template("codex-hooks.json.tmpl");
// Links (and git storing them as links) are read on Linux and macOS, where GitHub's runners run the check in a project;
// on Windows, where making one needs a right the runner may not give, those cases are left out and said so.
const LINKS = process.platform !== "win32";
if (!LINKS) console.log("note the cases with links are run on Linux and macOS alone");
let failed = 0, count = 0;
const made = [];
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail ? `\n${detail}` : ""}`); } };
// (git's own settings of this machine left out, as the core's other tests leave them: a file that is not there, since
// Windows' git cannot open its null device as one, and line endings stored as written)
const none = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tools-"));
made.push(none);
const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: path.join(none, "none"), GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.autocrlf", GIT_CONFIG_VALUE_0: "false" };
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8" }).trim();
const write = (dir, file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
const withPlugins = plugins => JSON.stringify({ ...JSON.parse(KIT), enabledPlugins: plugins }, null, 2);
const PLUGIN = { kind: "plugin", name: "helper@example-market", publisher: "Example Tools", version: "1.4.0" };

// A link to `to`, as a value of `files`, made as the file system makes one (git stores it as one, mode 120000).
const LINK = Symbol("link"), link = to => ({ [LINK]: to });
// A project as the starter kit writes it: its hooks' settings and a licence config with no list. `files` replaces or
// adds files; a null removes one.
function project(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tools-"));
  made.push(dir);
  git(dir, "init", "-q", "-b", "main");
  write(dir, ".claude/settings.json", KIT);
  write(dir, "checks/licences.json", JSON.stringify({ lockfiles: [] }));
  change(dir, files);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  return dir;
}
function change(dir, files) {
  for (const [file, text] of Object.entries(files)) {
    if (text === null) fs.rmSync(path.join(dir, file), { force: true, recursive: true });
    else if (text?.[LINK] !== undefined) { fs.rmSync(path.join(dir, file), { force: true, recursive: true }); fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.symlinkSync(text[LINK], path.join(dir, file)); }
    else { try { if (fs.lstatSync(path.join(dir, file)).isSymbolicLink()) fs.rmSync(path.join(dir, file)); } catch { /* (nothing there) */ } write(dir, file, typeof text === "string" ? text : JSON.stringify(text, null, 2)); }
  }
}
// The pull request: the change committed on a branch and merged into main with --no-ff, as GitHub's merge checkout has
// it (the base is its first parent).
function pr(dir, files) {
  git(dir, "checkout", "-q", "-B", "change"); // (-B: a second pull request on the same project starts from its main)
  change(dir, files);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "change");
  git(dir, "checkout", "-q", "main");
  git(dir, "merge", "-q", "--no-ff", "-m", "merge", "change");
  return dir;
}
// (the check is called here, as its command calls it, and what it prints read as a run of it would give it: its output,
// then its errors; the command itself, run as a program, by cli, where that is what a case reads; #715)
const run = (dir, ...args) => {
  const { lines, status } = printed(dir, "checks/licences.json", { core: args.includes("--core") });
  const of = stream => lines.filter(([s]) => s === stream).map(([, l]) => `${l}\n`).join("");
  return { status, out: `${of("out")}${of("err")}` };
};
const cli = (dir, ...args) => { const r = spawnSync(process.execPath, [SCRIPT, "checks/licences.json", ...args], { cwd: dir, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const passes = (r, what) => ok(r.status === 0 && !/FAIL/.test(r.out), what, r.out);
const fails = (r, what, ...says) => ok(r.status === 1 && mended(r.out) && says.every(s => r.out.includes(s)), `${what}, and says the mend`, r.out);

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
passes(run(project({ "checks/licences.json": { lockfiles: [], agentTools: [] } })), "and with an empty list");
passes(run(project({ "checks/licences.json": { lockfiles: [], agentTools: [] } }), "--core"), "in the core's own repository too");
// (the command prints what the check gives, and exits as it says, as the cases here read it)
for (const [dir, what] of [[project(), "passes"], [project({ ".claude/settings.json": JSON.stringify(slower), "checks/licences.json": { lockfiles: [], agentTools: [] } }), "fails"]]) {
  const asRun = cli(dir), asCalled = run(dir);
  ok(asRun.status === asCalled.status && asRun.out === asCalled.out, `the command, on a project that ${what}, prints what the check gives and exits ${asCalled.status}`, `${asRun.status}\n${asRun.out}\n----\n${asCalled.out}`);
}
{ const r = spawnSync(process.execPath, [SCRIPT], { cwd: project(), encoding: "utf8" }); ok(r.status === 2 && r.stderr.includes("usage: "), "the command with no config says how it is run and exits 2", `${r.status}\n${r.stderr}`); }

// ---- with a list ----
const listing = (...entries) => ({ "checks/licences.json": { lockfiles: [], agentTools: entries } });
passes(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing(PLUGIN) })), "a plug-in listed with its publisher and one exact version passes");
passes(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": false }), ...listing() })), "a plug-in turned off is not configured");
fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing() })), "a plug-in configured and not listed fails", 'the plug-in "helper@example-market", configured in .claude/settings.json, is not listed');
fails(run(project({ ".mcp.json": { mcpServers: { files: { command: "files-server" } } }, ...listing() })), "a tool server not listed fails", 'the tool server "files"', "configured in .mcp.json");
fails(run(project({ ".claude/skills/release-notes/SKILL.md": "---\nname: release-notes\n---\n", ...listing() })), "a skill not listed fails", 'the skill "release-notes"');
passes(run(project({ ".claude/skills/release-notes/SKILL.md": "x", ...listing({ kind: "skill", name: "release-notes", publisher: "this project" }) })), "a skill of the project's own needs no version");
const ownHook = JSON.stringify({ hooks: { ...JSON.parse(KIT).hooks, PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "true" }] }] } });
fails(run(project({ ".claude/settings.json": ownHook, ...listing() })), "a hook beside the kit's, not listed, fails", 'the hook "PostToolUse Write: true"');
passes(run(project({ ".claude/settings.json": ownHook, ...listing({ kind: "hook", name: "PostToolUse Write: true", publisher: "this project" }) })), "and passes once listed");

// ---- what a way installs (tasks/ways.md, "What a way installs is listed"; #397): named on its part's line, a hook is
// printed as that way's and fails nothing for being unlisted; a line in no form read fails ----
{
  const part = installs => `## A way: \`a-way\`\n\n- *Task:* x\n- *State:* x\n- *Review:* x\n- *Installs:* ${installs}\n  more of it\n- *Floor:* x\n`;
  const byWay = (dir, installs) => {
    const { lines, status } = printed(dir, "checks/licences.json", { ways: installedBy(readWays(part(installs))) });
    return { status, out: lines.map(([, l]) => `${l}\n`).join("") };
  };
  const named = byWay(project({ ".claude/settings.json": ownHook, ...listing() }), "`hook PostToolUse Write: true`, and `hook Stop: other`");
  passes(named, "a hook a way's part names is not failed as unlisted");
  ok(named.out.includes('note installed by the way `a-way` (tasks/ways.md), so listed by it: the hook "PostToolUse Write: true", configured in .claude/settings.json'), "and is printed as installed by that way", named.out);
  const inPr = byWay(pr(project(), { ".claude/settings.json": ownHook }), "`hook PostToolUse Write: true`");
  ok(!/listed nowhere|is not listed/u.test(inPr.out) && /not in the starter kit's form/u.test(inPr.out), "nor as new in a pull request where no list is written, while a command not in the kit's form fails as any hook's does (floor rule 3)", inPr.out);
  fails(byWay(project({ ".claude/settings.json": ownHook, ...listing() }), "none"), "a hook no way names is the project's own, unlisted", 'the hook "PostToolUse Write: true"');
  fails(byWay(project({ ".claude/settings.json": ownHook, ...listing() }), "not yet: #397"), "nor does a way the core has not read excuse it", 'the hook "PostToolUse Write: true"');
  for (const bad of ["a hook of its own", "`PostToolUse Write: true`", "", "`plugin some-plugin@market`"]) fails(byWay(project(), bad), `a line *Installs:* in no form read fails: ${JSON.stringify(bad)}`, "the part `a-way`'s line *Installs:* is in no form read here");
  const real = waysOf();
  ok(real.problems.length === 0 && real.ways.map(w => w.name).join() === "cloud,side-by-side,terminal" && installedBy().fail.length === 0, "the core's own parts are read, each line *Installs:* in its form", JSON.stringify(real));
  ok(installedBy(waysOf(() => { throw new Error("gone"); })).notes.length === 1 && installedBy(waysOf(() => { throw new Error("gone"); })).fail.length === 0, "a module that cannot be read is noted and fails nothing");
}
const sameMatcher = JSON.parse(KIT);
sameMatcher.hooks.Stop[0].hooks.push({ type: "command", command: "fetch-and-run" });
fails(run(project({ ".claude/settings.json": JSON.stringify(sameMatcher), ...listing() })), "a command added beside a kit's hook, under the same event, fails: only the kit's own command is the core's", 'the hook "Stop: fetch-and-run"');
const changed = JSON.parse(KIT);
changed.hooks.PreToolUse[0].hooks[0].command = "fetch-and-run";
fails(run(project({ ".claude/settings.json": JSON.stringify(changed), ...listing() })), "and so does a kit's hook whose command is changed", 'the hook "PreToolUse Agent|Task: fetch-and-run"');
fails(run(project({ ".claude/settings.local.json": { enabledPlugins: { "helper@example-market": true } }, ...listing() })), "a plug-in turned on in a committed settings.local.json, not listed, fails", "configured in .claude/settings.local.json");
fails(run(project({ ...listing(PLUGIN) })), "an entry nothing configures fails", 'lists the plug-in "helper@example-market", which nothing configures');
fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing({ ...PLUGIN, version: "^1.4.0" }) })), "a plug-in at a range fails", 'its version "^1.4.0" is not one exact version');
fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing({ ...PLUGIN, version: undefined }) })), "a plug-in with no version fails", "it gives no version");
passes(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing({ ...PLUGIN, version: "0123456789abcdef0123456789abcdef01234567" }) })), "a plug-in at a full commit passes");
fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing({ ...PLUGIN, publisher: " " }) })), "an entry with no publisher fails", "it names no publisher");
fails(run(project({ ...listing({ kind: "extension", name: "x", publisher: "y", version: "1.0.0" }) })), "an entry of no known kind fails", 'its kind "extension" is none of');
fails(run(project({ "checks/licences.json": { lockfiles: [], agentTools: {} } })), "a list that is no list fails", '"agentTools" is no list');
fails(run(project({ ".mcp.json": "{ not json" })), "a tool's settings that are no JSON fail", ".mcp.json cannot be read as a JSON object");
fails(run(project({ "checks/licences.json": "{" })), "a config that is no JSON fails", "checks/licences.json cannot be read");
// ---- links where a tool reads its files: none is followed (git's mode 120000 says what a link is) ----
// (each case one a past review found of the reading that followed links, #600 to #706: a new or changed link fails
// whatever it leads to; one the base held is noted, and fails only where the pull request changes what its text names)
if (LINKS) {
  const LINKED = "is a link where an agent tool reads its files, and this check follows no link";
  const away = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tools-"));
  made.push(away);
  fs.writeFileSync(path.join(away, "settings.json"), withPlugins({ "helper@example-market": true }));
  const shared = { "shared/notes/SKILL.md": "# notes\n", "shared/settings.json": withPlugins({ "helper@example-market": true }) };
  // (a link added by a pull request, at each kind of place a tool reads, to each kind of place: it fails as a link)
  for (const [at, to, what] of [
    [".claude/skills/notes", "../../shared/notes", "a skill linked inside the checkout, listed or not"],
    [".claude/settings.json", path.join(away, "settings.json"), "a settings file linked out of the checkout"],
    [".claude/skills", away, "a skills folder linked out of the checkout"],
    [".mcp.json", "shared/settings.json", "a tool server's file linked inside the checkout"],
    [".claude/skills/sub", "../../vendor/sub", "a skill's folder linked to a submodule"],
    [".kiro/settings", "../Shared", "a link to a name the commit holds only in another case"],
    [".claude/skills/s", "..\\..\\shared\\notes", "a link whose text only Windows reads as a path"],
    [".claude/agents/x", "../../node_modules/pkg/agents", "a link below agents into an installed package"],
    [".claude/agents", "../shared", "a folder of agents that is a link"],
    [".claude", "shared", ".claude itself as a link"],
    [".Claude", "shared", "a .claude link in another case beside a plain .claude"],
    [".claude/commands/c.md", "../../shared/notes/SKILL.md", "a command's file that is a link"],
    [".kiro/hooks/lint.json", "../../shared/settings.json", "a Kiro hook file that is a link"],
    [".codex", "shared", "Codex's folder as a link"],
  ]) fails(run(pr(project({ ...shared, ...listing({ kind: "skill", name: "notes", publisher: "this project" }) }), { [at]: link(to) })), `${what} fails, whatever it leads to`, `"${at}" ${LINKED}`);
  // (a file the base held, made a link to a place of the same text, is a link added)
  fails(run(pr(project({ ".mcp.json": withPlugins({}) }), { ".mcp.json": link(path.join(away, "settings.json")) })), "a link where the base held a file of the same text fails", `".mcp.json" ${LINKED}`);
  // (a link elsewhere in the project is none of this check's)
  passes(run(pr(project({ ...shared, ...listing() }), { "docs/notes": link("../shared/notes") })), "a link where no tool reads its files is none of the agent tools'");

  // (what stood before turns nothing red: a link the base held, the same link to the same target, is noted)
  const heldLinks = project({ ...shared, ".claude/skills/notes": link("../../shared/notes"), ".mcp.json": link(path.join(away, "settings.json")), ".claude/agents/x": link("../../node_modules/pkg/agents") });
  const stood = run(pr(heldLinks, { "README.md": "a change of its own\n" }));
  ok(stood.status === 0 && stood.out.includes(`as the base held it, nothing fails here: ".mcp.json" ${LINKED}`) && stood.out.includes(`".claude/skills/notes" ${LINKED}`) && stood.out.includes(`".claude/agents/x" ${LINKED}`), "links the base held, inside the checkout, out of it and into an installed package, are noted and fail nothing", stood.out);
  passes(run(pr(heldLinks, { "shared/notes/README.md": "beside the skill\n" })), "nor once a file beside what one leads to, which no tool reads, changes");
  // (#709's security review of c5deb9a: one into what an install fills is reported as such, never failed, since no list
  // can name every file that steers an install, and failing each pull request would lock the project)
  const filled = run(pr(project({ ...shared, ".claude/agents/x": link("../../node_modules/pkg/agents") }), { "package-lock.json": "{}\n" }));
  ok(filled.status === 0 && filled.out.includes("one an install fills (node_modules, a virtual environment), so what an install puts there, which this check cannot read"), "one the base held into an installed package is reported as such, never failed, as its lock changes", filled.out);
  passes(run(pr(heldLinks, { "shared/settings.json": withPlugins({ "other@example-market": true }) })), "nor once the place a link out of the checkout's name names in the checkout changes, which is no tool's");
  fails(run(pr(heldLinks, { ".claude/skills/notes": link("../../shared/other") })), "but one the base held, moved, is new", `".claude/skills/notes" ${LINKED}`);
  fails(run(heldLinks, "--core"), "and in the core's own repository none may stand", `".mcp.json" ${LINKED}`);
  const pushed = project({ ".claude/skills/notes": link("../../shared/notes"), ...shared });
  const noBase = run(pushed);
  ok(noBase.status === 0 && noBase.out.includes(`with no base to read against, nothing fails here: ".claude/skills/notes" ${LINKED}`), "with no base, as on a push, one is noted", noBase.out);

  // (and fails where the pull request changes what its text names: a new skill, a hook, a submodule, a link further along)
  const behind = project({ ...shared, ".claude/skills": link("../shared/skills"), "shared/skills/notes/SKILL.md": "# notes\n", ".claude/settings.json": link("../shared/settings.json"), ".kiro/settings": link("../cfg") , "cfg/mcp.json": "{}\n" });
  const BEHIND = "which the base held, and this pull request changes";
  fails(run(pr(behind, { "shared/skills/evil/SKILL.md": "# evil\n" })), "a skill a pull request adds behind a link the base held fails", `".claude/skills" is a link`, BEHIND, '"shared/skills/evil/SKILL.md"');
  fails(run(pr(behind, { "shared/skills/notes/SKILL.md": "---\nname: notes\nallowed-tools: Bash\n---\n" })), "and so does a skill changed there", BEHIND);
  fails(run(pr(behind, { "shared/settings.json": withPlugins({ "other@example-market": true }) })), "and a settings file changed behind its link", `".claude/settings.json" is a link`, BEHIND);
  fails(run(pr(behind, { "shared/skills": null })), "and the folder it names taken out", BEHIND);
  fails(run(pr(behind, { cfg: link("elsewhere") , "cfg/mcp.json": null })), "and a link on its way, made further along", `".kiro/settings" is a link`, BEHIND, '"cfg"');
  passes(run(pr(behind, { "shared/skills/notes/run.sh": "echo a helper\n", "shared/skills/README.md": "x\n" })), "while a file there that no tool reads as a tool's changes nothing");
  fails(run(pr(project({ ...shared, ".claude/skills/s": link("..\\..\\shared\\notes") }), { "shared/notes/SKILL.md": "---\nname: s\nallowed-tools: Bash\n---\n" })), "and one whose text Windows reads by its backslashes, once what that names changes", BEHIND, '"shared/notes/SKILL.md"');
  {
    const sub = project({ ...shared, ".claude/skills": link("../shared/skills"), "shared/skills/notes/SKILL.md": "# notes\n" });
    git(sub, "checkout", "-q", "-B", "change");
    fs.mkdirSync(path.join(sub, "shared/skills/vendored"), { recursive: true });
    git(sub, "update-index", "--add", "--cacheinfo", `160000,${git(sub, "rev-parse", "HEAD")},shared/skills/vendored`);
    git(sub, "commit", "-q", "-m", "a submodule behind the link"); git(sub, "checkout", "-q", "main"); git(sub, "merge", "-q", "--no-ff", "-m", "merge", "change");
    fails(run(sub), "and a submodule put behind it", BEHIND, '"shared/skills/vendored"');
  }
  const passing = project({ ...shared, "a/b": link("../shared"), ".claude/skills": link("../a/b/skills"), "shared/skills/notes/SKILL.md": "# notes\n" });
  const past = run(pr(passing, { "shared/skills/evil/SKILL.md": "# evil\n" }));
  ok(past.status === 0 && past.out.includes("the way to what its text names passes a link, which this check does not follow"), "one whose way passes another link is reported, never failed, what lies past it unread", past.out);

  // (#709's fallback security review of c5deb9a: what a link's text names is read as Linux reads it, a ".." after a link
  // on its way and Unicode's forms among it, a submodule's change is seen whatever .gitmodules says, and a link to the
  // checkout's root is held by all a tool reads below it)
  fails(run(pr(project({ ".claude/skills": link("../x/../y"), "x/k": "x\n", "a/b/y/.keep": "", "y/notes/SKILL.md": "# notes\n" }), { x: link("a/b"), "a/b/y/evil/SKILL.md": "# evil\n" })), "a link the base held whose way steps out of a folder the pull request makes a link fails", BEHIND, '"x"');
  fails(run(pr(project({ ".claude/skills": link("../caf\u00e9"), "caf\u00e9/notes/SKILL.md": "# notes\n" }), { "cafe\u0301/evil/SKILL.md": "# evil\n" })), "and one where a skill is added under the name in another of Unicode's forms", BEHIND);
  fails(run(pr(project({ ".claude/skills": link(".."), "README.md": "x\n" }), { "evil/SKILL.md": "# evil\n" })), "and one to the checkout's root, once a skill is added there", BEHIND, '"evil/SKILL.md"');
  {
    const ignored = project({ ".claude/skills": link("../stash"), "stash/notes/SKILL.md": "# notes\n", ".gitmodules": "" });
    fs.mkdirSync(path.join(ignored, "stash/evil"), { recursive: true });
    git(ignored, "update-index", "--add", "--cacheinfo", `160000,${git(ignored, "rev-parse", "HEAD")},stash/evil`); git(ignored, "commit", "-q", "-m", "a submodule");
    git(ignored, "checkout", "-q", "-B", "change"); fs.writeFileSync(path.join(ignored, ".gitmodules"), '[submodule "evil"]\n\tpath = stash/evil\n\turl = ./x\n\tignore = all\n');
    git(ignored, "update-index", "--add", "--cacheinfo", `160000,${git(ignored, "rev-parse", "HEAD")},stash/evil`); git(ignored, "add", ".gitmodules"); git(ignored, "commit", "-q", "-m", "moved, its change ignored");
    git(ignored, "checkout", "-q", "main"); git(ignored, "merge", "-q", "--no-ff", "-m", "merge", "change");
    fails(run(ignored), "and one whose submodule behind it moves, though .gitmodules says to ignore its changes", BEHIND, '"stash/evil"');
  }
  const outsideHeld = run(pr(project({ ".claude/skills": link(away) }), { "README.md": "x\n" }));
  ok(outsideHeld.status === 0 && outsideHeld.out.includes("its text leaves the checkout or names a whole path, so what this pull request changes where it leads is not read"), "one that leaves the checkout is reported so, never failed", outsideHeld.out);
  // (a tool held as the base's where a link is replaced with its files is the same tool, read with all the base's files)
  const market = () => project({ ".claude/settings.json": link("../conf/settings.json"), "conf/settings.json": withPlugins({ "foo@m": true }) });
  fails(run(pr(market(), { ".claude/settings.json": withPlugins({ "foo@m": true }), ".claude/settings.local.json": { extraKnownMarketplaces: { m: { source: { source: "github", repo: "example/other" } } } } })), "a link replaced with its files, a plug-in there made another by a marketplace a file beside it declares, is new", 'the plug-in "foo@m", configured in .claude/settings.json, is new');
  passes(run(pr(market(), { ".claude/settings.json": withPlugins({ "foo@m": true }) })), "while the same plug-in, its files the link's alone, stands as the base's");
  // (#709's code review of c5deb9a: a hook that takes a file from the working tree, behind a link the base held, stands
  // as the base's once the link is replaced with its files; and a checkout with core.symlinks off, which writes a link as a
  // plain file of its text, reads it as a link still)
  {
    const hooked = JSON.parse(KIT);
    hooked.hooks.Stop = [{ hooks: [{ type: "command", command: "bash scripts/format.sh" }] }];
    const text = JSON.stringify(hooked, null, 2), hookBase = project({ ".claude/settings.json": link("../conf/settings.json"), "conf/settings.json": text, "scripts/format.sh": "echo\n" });
    const hookMend = run(pr(hookBase, { ".claude/settings.json": text }));
    ok(hookMend.status === 0 && hookMend.out.includes("as the base held it, nothing fails here"), "a hook from the working tree behind a link the base held, the link replaced with its files, is noted as the base's", hookMend.out);
    // (#709's code review of e2f2f28: and a pin breach a tool behind such a link held, the link replaced with its files)
    const unpinned = JSON.stringify({ mcpServers: { files: { command: "npx", args: ["-y", "@example/files-server"] } } }, null, 2);
    const pinBase = project({ ".mcp.json": link("conf/mcp.json"), "conf/mcp.json": unpinned, ...listing({ kind: "server", name: "files", publisher: "Example Tools", version: "2.0.0" }) });
    const pinMend = run(pr(pinBase, { ".mcp.json": unpinned }));
    ok(pinMend.status === 0 && pinMend.out.includes("as the base held it, nothing fails here: the tool server") && pinMend.out.includes("fetched at no fixed version"), "a pin breach of a tool server behind a link the base held, the link replaced with its files, is noted as the base's", pinMend.out);
    const plain = project({ ...shared, ".claude/skills/notes/SKILL.md": link("../../../shared/notes/SKILL.md") });
    git(plain, "config", "core.symlinks", "false");
    fs.rmSync(path.join(plain, ".claude/skills/notes/SKILL.md")); fs.writeFileSync(path.join(plain, ".claude/skills/notes/SKILL.md"), "../../../shared/notes/SKILL.md");
    const plainRun = run(pr(plain, { "README.md": "a change of its own\n" }));
    ok(plainRun.status === 0 && plainRun.out.includes(`".claude/skills/notes/SKILL.md" ${LINKED}`), "a link a checkout with core.symlinks off writes as a plain file is read as a link, never as a skill", plainRun.out);
  }
  // (the mend: a link the base held replaced with the very files it named stands as the base's, a pull request that
  // turns a link into files adds no link, and an entry the base listed behind its link stays a note until then)
  const mendable = project({ ...shared, ".claude/skills/notes": link("../../shared/notes") });
  passes(run(pr(mendable, { ".claude/skills/notes": null, ".claude/skills/notes/SKILL.md": "# notes\n" })), "a link the base held replaced with the files it led to passes, what they configure the base's");
  // (#709's fallback check of 99a04a7: only where each step a ".." steps out of is a plain folder of the base's)
  fails(run(pr(project({ ".claude/skills": link("nope/../stash"), ".claude/stash/evil/SKILL.md": "# evil\n" }), { ".claude/skills": null, ".claude/skills/evil/SKILL.md": "# evil\n" })), "one replaced with the files its words name, where a \"..\" steps out of no folder the base held, is new", 'the skill "evil"');
  const other = run(pr(project({ ...shared, ".claude/skills/notes": link("../../shared/notes") }), { ".claude/skills/notes": null, ".claude/skills/notes/SKILL.md": "# other\n" }));
  ok(other.status === 1 && !other.out.includes(LINKED) && other.out.includes('the skill "notes", configured in .claude/skills/notes/SKILL.md, is new in this pull request') && mended(other.out), "one replaced with other files adds no link, and fails only for what it configures anew, saying to list it", other.out);
  const listedBehind = project({ ...shared, ".claude/skills/notes": link("../../shared/notes"), ...listing({ kind: "skill", name: "notes", publisher: "this project" }) });
  const unseen = run(pr(listedBehind, { "README.md": "a change of its own\n" }));
  ok(unseen.status === 0 && unseen.out.includes('as the base held it, nothing fails here: checks/licences.json: "agentTools" lists the skill "notes", which nothing configures'), "an entry the base listed behind a link it held, which no reading here follows, is noted", unseen.out);
  fails(run(pr(project({ ...shared, ...listing({ kind: "skill", name: "notes", publisher: "this project" }), ".claude/skills/notes/SKILL.md": "# notes\n" }), { ".claude/skills/notes": null })), "while one the pull request leaves configured by nothing fails", "which nothing configures");
  ok(notDone(heldLinks, STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed"))[0]?.mend.includes(`".claude/skills/notes" ${LINKED}`), "the sync note's step reads not done while one stands, and names it");

  // (a thousand links below a folder of agents, each to one folder of thousands of files, are read in seconds, #696)
  const many = project({ ...Object.fromEntries(Array.from({ length: 3000 }, (_, i) => [`shared/big/${i}.md`, "x"])) });
  for (let i = 0; i < 1000; i++) { fs.mkdirSync(path.join(many, ".claude/agents"), { recursive: true }); fs.symlinkSync("../../shared/big", path.join(many, `.claude/agents/l${i}`)); }
  git(many, "add", "-A"); git(many, "commit", "-q", "-m", "many links");
  const at = Date.now(), manyRun = run(pr(many, { "shared/big/new.md": "y" }));
  ok(manyRun.status === 1 && Date.now() - at < 30000, "1,000 links the base held below agents, each to 3,000 files, are read in seconds", `${Date.now() - at} ms`);
}
const colon = JSON.parse(KIT);
colon.hooks.Stop.push({ matcher: "Write: x", hooks: [{ type: "command", command: "y" }] });
fails(run(project({ ".claude/settings.json": JSON.stringify(colon), ...listing({ kind: "hook", name: "Stop Write: x: y", publisher: "this project" }) })), "a matcher that holds \": \", which a hook's name splits at, fails", 'matcher "Write: x" holds ": "');
const twins = JSON.parse(KIT), http = { type: "http", url: "https://hooks.example.invalid" };
twins.hooks.PostToolUse = [{ hooks: [http, { type: "command", command: JSON.stringify(http) }] }];
fails(run(project({ ".claude/settings.json": JSON.stringify(twins), ...listing({ kind: "hook", name: `PostToolUse: ${JSON.stringify(http)}`, publisher: "this project" }) })), "two hooks that would share a name, one by its command and one by its text, fail", "share the name");
// the base read through git's own tree as the working tree is read
passes(run(pr(project({ ".claude/skills/résumé/SKILL.md": "x" }), { "README.md": "a change of its own\n" })), "a skill whose folder's name git would quote, held by the base, stays in its baseline");
// a hook of another type that carries a command's text is not that command's hook, against the kit or the base
const asWeb = JSON.parse(KIT);
asWeb.hooks.Stop[0].hooks[0] = { type: "http", url: "https://hooks.example.invalid/x", command: asWeb.hooks.Stop[0].hooks[0].command };
fails(run(project({ ".claude/settings.json": JSON.stringify(asWeb), ...listing() })), "a web hook carrying the kit's command is not the kit's hook", "hooks.example.invalid/x", "is not listed");
const echoed = { hooks: { ...JSON.parse(KIT).hooks, PostToolUse: [{ hooks: [{ type: "command", command: "echo hi" }] }] } };
const toWeb = structuredClone(echoed);
toWeb.hooks.PostToolUse[0].hooks[0] = { type: "http", url: "https://hooks.example.invalid", command: "echo hi" };
fails(run(pr(project({ ".claude/settings.json": echoed }), { ".claude/settings.json": toWeb })), "and a command hook the base held, turned into a web hook with the same command, is new", "is new in this pull request");
if (process.platform !== "win32") {
  const odd = run(project({ ".claude/skills/x\n::warning::injected/SKILL.md": "x", ...listing() }));
  ok(odd.status === 1 && !/^::warning::/m.test(odd.out) && mended(odd.out), "a skill folder's name with a line break in it prints on the failure's own line, so it writes no workflow command", odd.out);
}
// a sync that changes the kit's hooks: the project's own, as the base's kit wrote them, still count as the core's
const synced = project({ ...listing() });
const HERE = fileURLToPath(new URL("..", import.meta.url));
fs.cpSync(path.join(HERE, "scripts"), path.join(synced, "core/scripts"), { recursive: true });
fs.cpSync(path.join(HERE, ".packages"), path.join(synced, "core/.packages"), { recursive: true, filter: parserLeftOut });
fs.cpSync(path.join(HERE, "setup/template"), path.join(synced, "core/setup/template"), { recursive: true });
git(synced, "add", "-A"); git(synced, "commit", "-q", "-m", "the copy");
const newKit = JSON.parse(KIT);
newKit.hooks.Stop[0].hooks[0].command = "a newer stop";
pr(synced, { "core/setup/template/claude-settings.json.tmpl": JSON.stringify(newKit, null, 2) });
const fromCopy = spawnSync(process.execPath, ["core/scripts/agent-tools.mjs", "checks/licences.json"], { cwd: synced, encoding: "utf8" });
ok(fromCopy.status === 0 && !/FAIL/.test(fromCopy.stdout + fromCopy.stderr), "a sync that changes the kit's hooks fails no project whose hooks the base's kit wrote", fromCopy.stdout + fromCopy.stderr);
// the sync note's step: a list written, and the check run where the project runs the licence script itself
const step = STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed");
const ownRun = "name: licences-own\n\non:\n  pull_request:\n\njobs:\n  licences:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node core/scripts/licences.mjs checks/licences.json\n";
ok(step.length === 1 && !notDone(project({ ...listing() }), step).length, "the step reads done in a project that configures only the kit's hooks");
const noRun = notDone(project({ ".github/workflows/licences-own.yml": ownRun }), step);
ok(noRun.length === 1 && noRun[0].mend.includes("runs `node core/scripts/agent-tools.mjs checks/licences.json` beside it"), "and not done where a workflow of the project's own runs the licence script without the agent-tools check", JSON.stringify(noRun));
ok(!notDone(project({ ".github/workflows/licences-own.yml": `${ownRun}      - run: node core/scripts/agent-tools.mjs checks/licences.json\n` }), step).length, "and done once that workflow runs it beside it");
const elsewhere = { "config/licences.json": { lockfiles: [], agentTools: [{ kind: "server", name: "files", publisher: "Example Tools", version: "2.0.0" }] }, ".mcp.json": { mcpServers: { files: { command: "files-server" } } } };
ok(!notDone(project({ ...elsewhere, ".github/workflows/licences-own.yml": `${ownRun.replaceAll("checks/licences.json", "config/licences.json")}      - run: node core/scripts/agent-tools.mjs config/licences.json\n` }), step).length, "and reads the config the project's own workflow passes, where it names another");
const byVariable = notDone(project({ ".github/workflows/licences-own.yml": `${ownRun.replace("checks/licences.json", '"$CONFIG"')}      - run: node core/scripts/agent-tools.mjs "$CONFIG"\n` }), step);
ok(byVariable.length === 1 && byVariable[0].mend.includes("could not read the project") && byVariable[0].mend.includes("$CONFIG"), "and says it cannot read one the workflow passes by a variable, never read as done", JSON.stringify(byVariable));
ok(notDone(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }) }), step)[0]?.mend.includes('the plug-in "helper@example-market"'), "and not done where a tool is configured and the list is not written");
ok(listed({ lockfiles: [] }, "c") === null, "a config with no \"agentTools\" holds no list");

passes(run(project({ ".gitignore": ".claude/settings.local.json\n", ".claude/settings.local.json": { enabledPlugins: { "helper@example-market": true } }, ...listing() })), "a settings.local.json git ignores is a person's own, and not read");
fails(run(pr(project({ ".mcp.json": { mcpServers: { files: { command: "files-server" } } }, ...listing({ kind: "server", name: "files", publisher: "Example Tools", version: "2.0.0" }) }), { "checks/licences.json": { lockfiles: [] } })),
  "a pull request that takes out the list the base held fails", '"agentTools" is gone, which the base held');

// ---- the pin a tool's own configuration gives (#352) ----
const C1 = "0123456789abcdef0123456789abcdef01234567", C2 = "89abcdef0123456789abcdef0123456789abcdef";
const marketAt = (source, file = ".claude/settings.json") => ({ [file]: JSON.stringify({ ...JSON.parse(KIT), enabledPlugins: { "helper@example-market": true }, extraKnownMarketplaces: { "example-market": { source } } }, null, 2) });
// (each made by a pull request, so that its base held none of it; held() below, by the base)
const pinned = (source, version) => pr(project(), { ...marketAt(source), ...listing({ ...PLUGIN, version }) });
passes(run(pinned({ source: "github", repo: "example/market", ref: C1 }, C1)), "a plug-in whose marketplace is pinned at a commit, listed at that commit, passes");
fails(run(pinned({ source: "github", repo: "example/market", ref: C1 }, "1.4.0")), "and fails listed at another version", `is listed at "1.4.0"`, `pins it at "${C1}"`);
fails(run(pinned({ source: "git", url: "https://example.invalid/market.git", ref: "main" }, "1.4.0")), "a plug-in whose marketplace takes a branch fails as fetched at no fixed version", "is fetched at no fixed version", 'the branch or tag "main"', '"ref"');
fails(run(pinned({ source: "github", repo: "example/market" }, "1.4.0")), "and so does one whose marketplace names no ref", "its repository's default branch");
passes(run(pinned({ source: "directory", path: "./market" }, "1.4.0")), "a marketplace of another kind is left to the review");
passes(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing(PLUGIN) })), "and so is one the project does not declare");
const local = pr(project(), { ...marketAt({ source: "github", repo: "example/market", ref: "main" }), ...marketAt({ source: "github", repo: "example/market", ref: C2 }, ".claude/settings.local.json"), ...listing({ ...PLUGIN, version: C2 }) });
passes(run(local), "a committed settings.local.json's marketplace is read above settings.json's, as Claude Code reads it");
const inline = entry => ({ source: "settings", name: "example-market", plugins: [{ name: "helper", source: entry }] });
passes(run(pinned(inline({ source: "github", repo: "example/helper", sha: C1 }), C1)), "a plug-in a settings marketplace fetches at its sha, listed at it, passes");
fails(run(pinned(inline({ source: "git-subdir", url: "https://example.invalid/tools.git", path: "helper", ref: "v1" }), "1.4.0")), "and one it fetches with no sha fails", 'names no "sha"', 'the branch or tag "v1"');
passes(run(pinned(inline({ source: "npm", package: "@example/helper@1.4.0" }), "1.4.0")), "a plug-in a settings marketplace fetches from npm at one version, listed at it, passes");
passes(run(pinned(inline({ source: "npm", package: "@example/helper", version: "1.4.0" }), "1.4.0")), "and so with the version in its own field");
fails(run(pinned(inline({ source: "npm", package: "@example/helper", version: "^1.4.0" }), "1.4.0")), "and fails at a range", 'names the version "^1.4.0", which is no one exact version');
fails(run(pinned(inline({ source: "npm", package: "@example/helper@1.4.1" }), "1.4.0")), "and at another version than the list's", 'pins it at "1.4.1"');
const SERVER = { kind: "server", name: "files", publisher: "Example Tools", version: "2.0.0" };
const served = (server, version = "2.0.0") => pr(project(), { ".mcp.json": { mcpServers: { files: server } }, ...listing({ ...SERVER, version }) });
passes(run(served({ command: "npx", args: ["-y", "@example/files-server@2.0.0", "--root", "."] })), "a tool server npx starts at one version, listed at it, passes");
fails(run(served({ command: "npx", args: ["-y", "@example/files-server@2.0.0"] }, "2.0.1")), "and fails listed at another", 'is listed at "2.0.1"', 'pins it at "2.0.0"');
fails(run(served({ command: "npx", args: ["-y", "@example/files-server"] })), "a tool server npx starts at no version fails", "names no version, so the newest is fetched", '"@example/files-server@"');
fails(run(served({ command: "npx", args: ["files-server@latest"] })), "and so does one at a tag", 'names the version "latest"');
passes(run(served({ command: "cmd", args: ["/c", "npx", "-y", "@example/files-server@2.0.0"] })), "npx started through cmd /c, as on Windows, is read the same");
passes(run(served({ command: "npx", args: ["--package=@example/files-server@2.0.0", "files"] })), "and the package npx is given as an option");
fails(run(served({ command: "npx.cmd", args: ["-p", "@example/files-server", "files"] })), "and fails there with no version", "is fetched at no fixed version");
passes(run(served({ type: "http", url: "https://example.invalid/mcp" })), "a hosted tool server is left to the review");
passes(run(served({ command: "files-server" })), "and so is one another command starts");
// what a project held before is noted, not failed (nothing locks a project)
const held = project({ ...marketAt({ source: "github", repo: "example/market", ref: "main" }), ...listing(PLUGIN) });
const heldNote = run(held);
ok(heldNote.status === 0 && /note with no base to read against, nothing fails here: the plug-in "helper@example-market" is fetched at no fixed version/.test(heldNote.out), "a pin breach with no base, as on a push, is noted and nothing fails", heldNote.out);
const heldPr = run(pr(held, { "README.md": "a change of its own\n" }));
ok(heldPr.status === 0 && /note as the base held it, nothing fails here/.test(heldPr.out), "a pull request that changes neither the tool nor its entry passes, the breach its base held noted", heldPr.out);
fails(run(pr(pinned({ source: "github", repo: "example/market", ref: C1 }, "1.4.0"), listing({ ...PLUGIN, version: "1.4.1" }))), "a pull request that changes the entry fails a breach that stands", 'is listed at "1.4.1"');
fails(run(pr(pinned({ source: "github", repo: "example/market", ref: C1 }, C1), marketAt({ source: "github", repo: "example/market", ref: C2 }))), "and so does one that moves the pin and not the entry", `pins it at "${C2}"`);
passes(run(pr(pinned({ source: "github", repo: "example/market", ref: C1 }, C1), { ...marketAt({ source: "github", repo: "example/market", ref: C2 }), ...listing({ ...PLUGIN, version: C2 }) })), "and passes moving both");
fails(run(pr(held, marketAt({ source: "github", repo: "example/other-market", ref: "main" }))), "and so does one that gives the tool another source, its breach the same in words", "is fetched at no fixed version");
const heldServer = project({ ".mcp.json": { mcpServers: { files: { command: "npx", args: ["-y", "@example/files-server@2.0.0"] } } }, ...listing({ ...SERVER, version: "2.0.1" }) });
fails(run(pr(heldServer, { ".mcp.json": { mcpServers: { files: { command: "npx", args: ["-y", "@example/other-server@2.0.0"] } } } })), "and one that runs another package at the same version", 'pins it at "2.0.0"');
const heldInline = project({ ...marketAt(inline({ source: "github", repo: "example/helper" })), ...listing(PLUGIN) });
fails(run(pr(heldInline, marketAt(inline({ source: "url", url: "https://example.invalid/helper.git" })))), "and one that changes a settings marketplace's entry for it", 'names no "sha"');
const two = sibling => ({ source: "settings", name: "example-market", plugins: [{ name: "helper", source: { source: "github", repo: "example/helper" } }, { name: "other", source: { source: "github", repo: "example/other", sha: sibling } }] });
const twoAt = sibling => ({ ".claude/settings.json": JSON.stringify({ ...JSON.parse(KIT), enabledPlugins: { "helper@example-market": true, "other@example-market": true }, extraKnownMarketplaces: { "example-market": { source: two(sibling) } } }, null, 2) });
const OTHER = { kind: "plugin", name: "other@example-market", publisher: "Example Tools", version: C1 };
const siblings = run(pr(project({ ...twoAt(C1), ...listing(PLUGIN, OTHER) }), { ...twoAt(C2), ...listing(PLUGIN, { ...OTHER, version: C2 }) }));
ok(siblings.status === 0 && /note as the base held it/.test(siblings.out), "a change to another plug-in's entry in the same settings marketplace leaves a breach the base held noted", siblings.out);
const twice = inline({ source: "github", repo: "example/helper" });
twice.plugins.push({ name: "helper", source: { source: "url", url: "https://example.invalid/helper.git" } });
fails(run(pr(heldInline, marketAt(twice))), "and one that adds a second entry of the plug-in's name", 'holds 2 entries for "helper"');
const twicePinned = inline({ source: "github", repo: "example/helper", sha: C1 });
twicePinned.plugins.push({ name: "helper", source: { source: "url", url: "https://example.invalid/helper.git" } });
fails(run(pinned(twicePinned, C1)), "two entries of a plug-in's name fail, the first pinned or not", "holds 2 entries for", "keep one entry for it");
fails(run(pinned({ source: "github", repo: "example/market", ref: [C1] }, C1)), "a ref that is no text pins nothing", "names no commit");
fails(run(pinned(inline({ source: "github", repo: "example/helper", sha: C1.toUpperCase() }), C1)), "and a sha not written as git writes a commit pins nothing", 'which is no full commit as git writes one');
const pinnedNoList = project({ ...marketAt({ source: "github", repo: "example/market", ref: C1 }) });
fails(run(pr(pinnedNoList, listing(PLUGIN))), "a list written for the first time at another version than an exact pin fails", `pins it at "${C1}"`);
passes(run(pr(project({ ...marketAt({ source: "github", repo: "example/market", ref: C1 }) }), listing({ ...PLUGIN, version: C1 }))), "and passes written at the pin");
const unlistedLoose = project({ ".mcp.json": { mcpServers: { files: { command: "npx", args: ["-y", "files-server"] } } } });
const written = run(pr(unlistedLoose, listing(SERVER)));
ok(written.status === 0 && /note as the base held it/.test(written.out), "a pull request that writes the list for a tool its base fetched at no fixed version notes it, not fails", written.out);
fails(run(held, "--core"), "in the core's own repository a pin breach fails", "is fetched at no fixed version");
const pinStep = STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed");
ok(notDone(held, pinStep)[0]?.mend.includes("is fetched at no fixed version"), "the sync note's step reads not done while a pin breach stands");
ok(!notDone(pinned({ source: "github", repo: "example/market", ref: C1 }, C1), pinStep).length, "and done once each pin and entry agree");

// ---- with no list yet: the pull request's base counts as it (nothing locks a project) ----
const old = project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }) });
const noted = run(old);
ok(noted.status === 0 && /note .*holds no "agentTools" yet[\s\S]*helper@example-market/.test(noted.out), "with no list and no base, as on a push, what is unlisted is noted and nothing fails", noted.out);
passes(run(pr(old, { "README.md": "a change of its own\n" })), "a pull request that adds no tool passes, a tool its base held unlisted standing");
fails(run(pr(project(), { ".claude/settings.json": withPlugins({ "helper@example-market": true }) })), "a pull request that adds an unlisted tool fails", "is new in this pull request and listed nowhere");
passes(run(pr(project(), { ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing(PLUGIN) })), "and passes once it writes the list");
fails(run(pr(project(), { ".claude/skills/notes/SKILL.md": "x" })), "a pull request that adds a skill, unlisted, fails", 'the skill "notes"');
fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }) }), "--core"), "in the core's own repository a missing list counts as empty, so an unlisted tool fails", "is not listed");

// ---- what Kiro and Codex configure (#407) ----
{
  const kits = { ".kiro/hooks/work-saved.json": KIRO, ".codex/hooks.json": CODEX };
  passes(run(project({ ...kits, ...listing() })), "the starter kit's Kiro and Codex hooks need no entry");
  const kiroHook = (command, extra = {}) => ({ version: "v1", hooks: [{ name: "lint", trigger: "PostFileSave", matcher: "\\.ts$", action: { type: "command", command }, ...extra }] });
  const LINT = { kind: "hook", name: "Kiro PostFileSave \\.ts$: npx eslint@9.0.0 --fix", publisher: "this project" };
  fails(run(project({ ...kits, ".kiro/hooks/lint.json": kiroHook("npx eslint@9.0.0 --fix"), ...listing() })), "a Kiro hook of the project's own, not listed, fails", 'the hook "Kiro PostFileSave \\\\.ts$: npx eslint@9.0.0 --fix", configured in .kiro/hooks/lint.json, is not listed');
  passes(run(project({ ...kits, ".kiro/hooks/lint.json": kiroHook("npx eslint@9.0.0 --fix"), ...listing(LINT) })), "and passes once listed");
  passes(run(project({ ".kiro/hooks/notes.md": "# not a hook file\n", ...listing() })), "a file under .kiro/hooks that is no JSON is no hook Kiro reads");
  const kiroServer = { ".kiro/settings/mcp.json": { mcpServers: { docs: { command: "npx", args: ["-y", "docs-server"] } } } };
  fails(run(pr(project({ ...listing() }), { ...kiroServer, ...listing({ kind: "server", name: "Kiro docs", publisher: "Example Tools", version: "2.0.0" }) })), "a Kiro tool server is held to the pin its configuration gives", 'the tool server "Kiro docs" is fetched at no fixed version: .kiro/settings/mcp.json, in the arguments of "docs", names no version');
  fails(run(project({ ...kiroServer, ".mcp.json": { mcpServers: { "Kiro docs": { command: "x" } } }, ...listing() })), "one server name in two files is refused", 'the tool server "Kiro docs" is configured in .mcp.json too');
  const toml = `notify = ["notify-send", "done"]\n\n[mcp_servers.search]\ncommand = "npx"\nargs = ["-y", "search-server@1.2.3"]\n\n[[hooks.PreToolUse]]\nmatcher = "^Bash$"\n\n[[hooks.PreToolUse.hooks]]\ntype = "command"\ncommand = 'echo checked'\ntimeout = 30\n`;
  const codexListed = listing({ kind: "server", name: "Codex search", publisher: "Example Tools", version: "1.2.3" }, { kind: "hook", name: "Codex notify: notify-send done", publisher: "this project" }, { kind: "hook", name: "Codex PreToolUse ^Bash$: echo checked", publisher: "this project" });
  passes(run(project({ ...kits, ".codex/config.toml": toml, ...codexListed })), "Codex's config.toml is read: its tool servers, its notify and its hooks, each listed");
  fails(run(project({ ".codex/config.toml": toml, ...listing() })), "each of them unlisted fails", 'the tool server "Codex search"', 'the hook "Codex notify: notify-send done"', 'the hook "Codex PreToolUse ^Bash$: echo checked"');
  // (the shapes main's readers refuse in Claude Code's files are refused in Kiro's and Codex's too, each with its mend)
  fails(run(project({ ".kiro/settings/mcp.json": { mcpServers: ["docs"] }, ...listing() })), "Kiro's tool servers given as a list are refused", '.kiro/settings/mcp.json: "mcpServers" is not a JSON object');
  fails(run(project({ ".codex/config.toml": "mcp_servers = \"docs\"\n", ...listing() })), "Codex's tool servers given as a text are refused", '.codex/config.toml: "mcp_servers" is not a TOML table');
  fails(run(project({ ".codex/config.toml": "hooks = 1\n", ...listing() })), "and so are Codex's hooks given as a number in config.toml", '.codex/config.toml: "hooks" is not a TOML table');
  fails(run(project({ ".codex/hooks.json": { hooks: ["Stop"] }, ...listing() })), "and Codex's hooks given as a list in hooks.json", '.codex/hooks.json: "hooks" is not a JSON object');
  fails(run(project({ ".kiro/hooks/x.json": { version: "v1", hooks: { name: "x" } }, ...listing() })), "and a Kiro hook file whose hooks are no list", '.kiro/hooks/x.json: "hooks" is not a JSON list');
  fails(run(project({ ".kiro/hooks/ask.json": { version: "v1", hooks: [{ name: "ask", trigger: "Stop", matcher: 5, action: { type: "agent", prompt: "review it" } }] }, ...listing() })),
    "a Kiro hook that asks the agent is named by the whole hook, and a matcher that is no text is no matcher", 'the hook "Kiro Stop: {\\"name\\":\\"ask\\",\\"trigger\\":\\"Stop\\",\\"matcher\\":5,\\"action\\":{\\"type\\":\\"agent\\"');
  fails(run(project({ ".kiro/hooks/odd.json": { version: "v1", hooks: [{ name: "odd", trigger: "Stop", action: { type: "command", command: ["echo"] } }] }, ...listing() })),
    "a command hook whose command is no text is named by the whole hook too", 'the hook "Kiro Stop: {\\"name\\":\\"odd\\",\\"trigger\\":\\"Stop\\",\\"action\\":{\\"type\\":\\"command\\",\\"command\\":[\\"echo\\"]}');
  fails(run(project({ ".codex/hooks.json": { hooks: { Stop: [{ hooks: [{ type: "command", command: "echo done" }] }] } }, ...listing() })), "a hook of .codex/hooks.json beside the kit's, not listed, fails", 'the hook "Codex Stop: echo done", configured in .codex/hooks.json');
  // (a tool server or plug-in is its whole configuration: one the base held, changed, is no longer the one it held;
  // #476's fallback security review)
  const searchServer = command => `[mcp_servers.search]\ncommand = "${command}"\nargs = ["-y", "search@1.0.0"]\n`;
  const heldServer = project({ ".codex/config.toml": searchServer("npx"), ...listing() });
  passes(run(pr(heldServer, { "README.md": "a change of its own\n" })), "a tool server the base held unlisted, unchanged, is noted");
  fails(run(pr(heldServer, { ".codex/config.toml": searchServer("bash") })), "and one whose command the pull request changes fails", 'the tool server "Codex search"');
  fails(run(pr(project({ ".codex/config.toml": searchServer("npx") }), { ".codex/config.toml": searchServer("bash") })), "so too where no list is written yet", 'the tool server "Codex search", configured in .codex/config.toml, is new in this pull request');
  const market = ref => ({ ...JSON.parse(KIT), enabledPlugins: { "helper@example-market": true }, extraKnownMarketplaces: { "example-market": { source: { source: "github", repo: "example/market", ref } } } });
  fails(run(pr(project({ ".claude/settings.json": market("main") }), { ".claude/settings.json": market("other") })), "and a plug-in whose marketplace the pull request points elsewhere", 'the plug-in "helper@example-market"');
  const sharedMarket = ref => ({ ...JSON.parse(KIT), enabledPlugins: { "helper@m": true }, extraKnownMarketplaces: { m: { source: { source: "settings", plugins: [{ name: "helper", source: { source: "github", repo: "example/helper", sha: C1 } }, { name: "other", source: { source: "github", repo: "example/other", ref } }] } } } });
  const sharedRun = run(pr(project({ ".claude/settings.json": sharedMarket("main"), ...listing() }), { ".claude/settings.json": sharedMarket("next") }));
  const bare = sha => ({ ...JSON.parse(KIT), enabledPlugins: { helper: true }, extraKnownMarketplaces: { helper: { source: { source: "settings", plugins: [{ name: "helper", source: { source: "github", repo: "example/helper", sha } }] } } } });
  passes(run(pr(project({ ".claude/settings.json": bare(C1) }), { ".claude/settings.json": bare(C2) })), "a plug-in named with no marketplace is read as before: by its name");
  ok(sharedRun.status === 0 && /note as the base held it[^\n]*the plug-in "helper@m"/.test(sharedRun.out), "while a change to another plug-in's entry in the same marketplace leaves it as the base held it", sharedRun.out);
  // (a list written before the check read Kiro's and Codex's files: what they held stands, noted, and only a pull
  // request that adds one fails; #476's code review)
  const older = project({ ".codex/config.toml": "notify = [\"notify-send\", \"done\"]\n", ...listing() });
  const unchanged = run(pr(older, { "README.md": "a change of its own\n" }));
  ok(unchanged.status === 0 && /note as the base held it, nothing fails here: the hook "Codex notify: notify-send done"/.test(unchanged.out), "a tool the base held unlisted, beside a list written before the check read it, is noted, not failed", unchanged.out);
  fails(run(pr(older, { "README.md": "another change of its own\n" }), "--core"), "in the core's own repository none stands, base or none", 'the hook "Codex notify: notify-send done", configured in .codex/config.toml, is not listed');
  fails(run(pr(older, { ".codex/config.toml": "notify = [\"notify-send\", \"again\"]\n" })), "and one the pull request adds or changes fails", 'the hook "Codex notify: notify-send again"');
  const listedOnce = project({ ".codex/config.toml": "notify = [\"notify-send\", \"done\"]\n", ...listing({ kind: "hook", name: "Codex notify: notify-send done", publisher: "this project" }) });
  fails(run(pr(listedOnce, listing())), "while an entry the base's list held, taken out, fails: the list only grows true", 'the hook "Codex notify: notify-send done", configured in .codex/config.toml, is not listed');
  fails(run(project({ ".codex/config.toml": "[mcp_servers.x]\ncommand = \"npx\"\ncommand = \"node\"\n", ...listing() })), "a config.toml Codex would refuse is refused", ".codex/config.toml cannot be read as TOML (line 3: trying to redefine an already defined table or value)");
}

// ---- where each hook's command comes from (#407; floor rule 3) ----
{
  const withHook = command => ({ hooks: { ...JSON.parse(KIT).hooks, PostToolUse: [{ hooks: [{ type: "command", command }] }] } });
  const kitCommand = words => `bash -c 'f=$(git -C "\${CLAUDE_PROJECT_DIR:-.}" --no-replace-objects show refs/remotes/origin/main:scripts/format.sh 2>/dev/null) || exit 0; bash -c "$f"${words}'`;
  const TREE_HOOK = "bash scripts/format.sh", MAIN_HOOK = "git show refs/remotes/origin/main:scripts/format.sh | bash", KIT_HOOK = kitCommand("");
  const NOT_KIT = "is not in the starter kit's form, so nothing shows that it runs its copy on main";
  const entry = (command, extra = {}) => ({ kind: "hook", name: `PostToolUse: ${command}`, publisher: "this project", ...extra });
  const script = { "scripts/format.sh": "echo formatted\n" };
  const fromWorkingTree = { from: "the working tree" };
  const added = command => run(pr(project({ ...script, ...listing() }), { ".claude/settings.json": withHook(command), ...listing(entry(command)) }));
  fails(added(TREE_HOOK), "a new hook not in the kit's form fails, as one that runs the working tree's copy", NOT_KIT, "--no-replace-objects show refs/remotes/origin/main:");
  fails(added(MAIN_HOOK), "and so does one that fetches from main in a form of its own: no command but the kit's is read", NOT_KIT);
  fails(added("npx -y tool@1.0.0"), "and one that names no file of the project", NOT_KIT);
  fails(added(kitCommand("'; bash scripts/format.sh; '")), "and one broken out of the kit's quote", NOT_KIT);
  // (#476's code review of e76b2bb: the path fetched is written one way alone, so the file the check reads is the one fetched)
  for (const spelt of ["./scripts/format.sh", "scripts/./format.sh", "x/../scripts/format.sh"])
    fails(added(KIT_HOOK.replace("main:scripts/format.sh", `main:${spelt}`)), `and one that fetches ${spelt}, another spelling of a file`, NOT_KIT);
  passes(added(KIT_HOOK), "a new hook in the kit's form passes");
  passes(added(kitCommand(" check now")), "and so does one with plain words after its script, which main's copy reads");
  // (the settings by which Claude Code runs a command of its own, read as hooks are)
  const withSetting = (key, value) => ({ ".claude/settings.json": { ...JSON.parse(KIT), [key]: value } });
  const named = (key, command) => ({ kind: "hook", name: `${key}: ${command}`, publisher: "this project" });
  for (const [key, value] of [["apiKeyHelper", TREE_HOOK], ["awsAuthRefresh", TREE_HOOK], ["awsCredentialExport", TREE_HOOK], ["gcpAuthRefresh", TREE_HOOK], ["otelHeadersHelper", TREE_HOOK], ["statusLine", { type: "command", command: TREE_HOOK }], ["fileSuggestion", { type: "command", command: TREE_HOOK }]])
    fails(run(pr(project({ ...script, ...listing() }), { ...withSetting(key, value), ...listing(named(key, TREE_HOOK)) })), `Claude Code's "${key}" not in the kit's form fails as a hook does`, NOT_KIT);
  passes(run(pr(project({ ...script, ...listing() }), { ...withSetting("statusLine", { type: "command", command: KIT_HOOK }), ...listing(named("statusLine", KIT_HOOK)) })), "one in the kit's form passes, listed");
  // (and Codex's model providers' commands that print a token)
  for (const key of ["auth", "gateway_oauth.credential_export"])
    fails(run(pr(project({ ...script, ...listing() }), { ".codex/config.toml": `[model_providers.p.${key}]\ncommand = "bash"\nargs = ["scripts/format.sh"]\n`, ...listing({ kind: "hook", name: `Codex model_providers.p.${key}: bash scripts/format.sh`, publisher: "this project" }) })), `Codex's "model_providers.p.${key}" fails as a setting of no kit's form does`, "is of a kind no starter kit writes");
  fails(run(pr(project({ ...script, ...listing() }), withSetting("statusLine", { type: "command", command: KIT_HOOK }))), "and fails unlisted", 'the hook "statusLine: ');
  fails(run(pr(project({ ...script, ...listing() }), withSetting("apiKeyHelper", ["bash", "x"]))), "a setting of another shape is refused", '"apiKeyHelper" is neither a command nor');
  // (#633's fallback security review of b0f654f: a hook the base held under an event of a setting's name, which never ran,
  // moved into that setting, is new)
  const asEvent = { ...JSON.parse(KIT), hooks: { ...JSON.parse(KIT).hooks, statusLine: [{ hooks: [{ type: "command", command: TREE_HOOK }] }] } };
  fails(run(pr(project({ ...script, ".claude/settings.json": asEvent }), withSetting("statusLine", { type: "command", command: TREE_HOOK }))), "a hook the base held under a setting's name, moved into the setting, is new", NOT_KIT);
  // (and what else a tool runs by itself: the hooks of a skill's or a subagent's frontmatter, a remote server's and a
  // marketplace's command for its headers, a marketplace's command source, and a Codex model provider, held whole)
  const front = key => `---\nname: rev\n${key}:\n  Stop:\n    - hooks:\n        - type: command\n          command: ${TREE_HOOK}\n---\n# rev\n`;
  const SKILL = { kind: "skill", name: "rev", publisher: "this project" };
  for (const [what, files] of [
    ["a subagent's frontmatter", { ".claude/agents/rev.md": front("hooks") }],
    ["a skill's frontmatter, its key in another case", { ".claude/skills/rev/SKILL.md": front("Hooks"), ...listing(SKILL) }],
    ["a frontmatter whose key is quoted with an escape", { ".claude/agents/rev.md": front('"ho\\u006fks"') }],
    ["a marketplace's headersHelper", withSetting("extraKnownMarketplaces", { m: { source: { source: "github", repo: "example/m" }, headersHelper: TREE_HOOK } })],
    ["a marketplace's command source", withSetting("extraKnownMarketplaces", { m: { source: { source: "settings", plugins: [{ name: "p", source: { source: "command", command: TREE_HOOK } }] } } })],
    ["a Codex model provider whose token command, in the kit's form, runs in another folder", { ".codex/config.toml": `[model_providers.p.auth]\ncommand = "bash"\nargs = ["-c", ${JSON.stringify(KIT_HOOK.slice("bash -c '".length, -1))}]\ncwd = "sub"\n`, ...listing(SKILL, { kind: "hook", name: `Codex model_providers.p.auth: bash -c ${KIT_HOOK.slice("bash -c '".length, -1)}`, publisher: "this project" }) }],
    ["a Codex model provider with no command, by where it sends a key", { ".codex/config.toml": "[model_providers.p]\nbase_url = \"https://example.invalid/v1\"\nenv_key = \"KEY\"\n" }],
  ]) fails(run(pr(project({ ...script, ...listing(SKILL) }), files)), `${what} fails as a hook of no kit's form does`, "is of a kind no starter kit writes, so nothing shows that it runs its copy on main", "Mend: take it out of the project's files");
  // (Codex's code review of ccb1705: and one marked as the baseline's, new, fails with that same mend, never the kit's form)
  const providerMarked = run(pr(project({ ...script, ...listing(SKILL) }), { ".codex/config.toml": "[model_providers.p]\nbase_url = \"https://example.invalid/v1\"\nenv_key = \"KEY\"\n", ...listing(SKILL, { kind: "hook", name: "Codex model_providers.p: its settings", publisher: "this project", from: "the working tree" }) }));
  fails(providerMarked, "a setting of no kit's form, new and marked as the baseline's, fails with the mend that can be taken", "the base held no such hook", "Mend: take it out of the project's files");
  ok(!providerMarked.out.includes("Mend: write its command in the starter kit's form"), "and its mend is not to rewrite a command it may not have", providerMarked.out);
  fails(run(pr(project({ ...script, ...listing() }), { ".mcp.json": { mcpServers: { api: { type: "http", url: "https://example.invalid/mcp", headersHelper: TREE_HOOK } } } })), "a remote server's headersHelper not in the kit's form fails as a hook does", NOT_KIT);
  // (#647's fallback security review of 341004e: the frontmatter split as Claude Code splits it, and held whole in any
  // form but a plain mapping of simple keys, in a subagent at any depth and a command too)
  const HOOKS = "        - type: command\n          command: bash x.sh";
  for (const [what, file, text] of [
    ["one closed mid-line", ".claude/agents/rev.md", `---\nname: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS} # ---\n# rev\n`],
    ["one opened by another space", ".claude/agents/rev.md", `---\u000b\nname: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["one written as JSON", ".claude/agents/rev.md", '---\n{"name":"rev","hooks":{"Stop":[{"hooks":[{"type":"command","command":"bash x.sh"}]}]}}\n---\n'],
    ["one keyed by an alias", ".claude/agents/rev.md", `---\ndescription: &k hooks\n*k :\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["one indented whole", ".claude/agents/rev.md", `---\n  name: rev\n  hooks: {}\n---\n`],
    ["one in a subfolder", ".claude/agents/sub/rev.md", `---\nname: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["a command's", ".claude/commands/rev.md", `---\ndescription: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["one with tool servers", ".claude/agents/rev.md", "---\nname: rev\nmcp_servers:\n  x:\n    type: stdio\n    command: bash\n---\n"],
    // (#647's fallback security review of 304f1e9: a lone carriage return, which YAML reads as a line's end, and a
    // subagent at any depth)
    ["one with a key after a lone carriage return", ".claude/agents/rev.md", `---\nname: rev\ndescription: d\n\rhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["one nine folders deep", ".claude/agents/1/2/3/4/5/6/7/8/9/rev.md", `---\nname: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`],
    ["one too long to read", ".claude/agents/rev.md", `---\nname: rev\ndescription: ${"x".repeat(70000)}\n---\n`],
  ]) fails(run(pr(project({ ...script, ...listing() }), { [file]: text })), `a frontmatter, ${what}, fails as a setting of no kit's form does`, "is of a kind no starter kit writes", "Mend: take it out of the project's files");
  passes(run(pr(project({ ...script, ...listing() }), { ".claude/agents/sub/rev.md": "---\nname: rev\ndescription: \"reviews: hooks and all\"\ntools: [Read, Grep]\nmodel: opus\n---\n# rev\n" })), "a plain frontmatter of simple keys passes, at any depth");
  // (a skill's or command's body that runs a command where it is invoked, and a subagent's permission mode but the
  // default, each held as a setting no starter kit writes)
  const NOKIT = "is of a kind no starter kit writes";
  const SK = { kind: "skill", name: "s", publisher: "this project" };
  fails(run(pr(project({ ...script, ...listing(SK), ".claude/skills/s/SKILL.md": "# s\n" }), { ".claude/skills/s/SKILL.md": "# s\nThe branch: !`git branch --show-current`\n" })), "a skill's body that runs a command inline fails", NOKIT, "shell: the commands its text runs");
  fails(run(pr(project({ ...script, ...listing() }), { ".claude/commands/c.md": "# c\n```!\nbash x.sh\n```\n" })), "and so does a command's block that runs one", NOKIT);
  passes(run(pr(project({ ...script, ...listing() }), { ".claude/commands/c.md": "# c\nSay `hello`, and nothing more!\n" })), "a command whose text runs nothing passes");
  const shellStood = project({ ...script, ".claude/commands/c.md": "# c\n!`date`\n", ...listing() });
  const shellKept = run(pr(shellStood, { "README.md": "x\n" }));
  ok(shellKept.status === 0 && shellKept.out.includes("as the base held it"), "one the base held is noted while its text stands", shellKept.out);
  for (const mode of ["bypassPermissions", "'acceptEdits' # quoted"]) fails(run(pr(project({ ...script, ...listing() }), { ".claude/agents/rev.md": `---\nname: rev\npermissionMode: ${mode}\n---\n` })), `a subagent's permission mode ${mode} fails`, NOKIT, "permissionMode");
  passes(run(pr(project({ ...script, ...listing() }), { ".claude/agents/rev.md": "---\nname: rev\npermissionMode: default\n---\n" })), "and its default passes");
  fails(run(pr(project({ ...script, ...listing() }), withSetting("permissions", { defaultMode: "bypassPermissions" }))), "settings whose permission mode runs all without asking fail", NOKIT, "permissions.defaultMode");
  passes(run(pr(project({ ...script, ...listing() }), withSetting("permissions", { defaultMode: "acceptEdits" }))), "and settings of another mode pass");
  // (#693's fallback security review of fdd2d96: every key that folds to the permission mode, whichever a reader keeps;
  // a block that runs a command wherever it stands; and the tools a skill lets run without asking)
  for (const front of ["PermissionMode: default\npermissionMode: bypassPermissions", "permissionMode: default\npermissionMode: bypassPermissions"]) fails(run(pr(project({ ...script, ...listing() }), { ".claude/agents/rev.md": `---\nname: rev\n${front}\n---\n` })), `a permission mode written twice, ${front.split("\n")[0]} first, fails`, NOKIT, "permissionMode");
  for (const body of ["# c\n> ```!\nbash x.sh\n```\n", "# c\n````!\nbash x.sh\n````\n", "# c\nRun this: ```!\nbash x.sh\n```\n"]) fails(run(pr(project({ ...script, ...listing() }), { ".claude/commands/c.md": body })), `a command's block that runs a command, ${JSON.stringify(body.split("\n")[1])}, fails`, NOKIT);
  fails(run(pr(project({ ...script, ...listing(SK), ".claude/skills/s/SKILL.md": "# s\n" }), { ".claude/skills/s/SKILL.md": "---\nname: s\nallowed-tools: Bash(*)\n---\n# s\n" })), "a skill's tools it lets run without asking fail as a setting", NOKIT);
  // (a folder of Claude Code's below the project's root, which it reads where it works there)
  const NESTED = "is a folder of Claude Code's below the project's root";
  // (the core's own copy is none of the project's: its .claude is the core's, held to the core's commit by core.yml)
  const manifest = at => ({ "core-manifest.md": `Core: ${CORE} at ${"a".repeat(40)}, copied whole under ${at} (never edited here).\n` });
  passes(run(pr(project({ ...script, ...manifest("core/"), ...listing() }), { "core/.claude/settings.json": KIT, "core/README.md": "# core\n" })), "the core's own copy, where the manifest names it, with its .claude, is no folder of the project's below its root");
  fails(run(pr(project({ ...script, ...listing() }), { "core/.claude/settings.json": KIT })), "but with no manifest, as in the core's own repository, a core/.claude fails as any other does", NESTED);
  const elsewhere = run(pr(project({ ...script, ...manifest("vendor/core/"), ...listing() }), { "vendor/core/.claude/settings.json": KIT, "core/.claude/settings.json": KIT }));
  ok(elsewhere.status === 1 && elsewhere.out.includes("core/.claude is a folder") && !elsewhere.out.includes("vendor/core/.claude is a folder"), "and where the manifest names another path, that one alone is left out", elsewhere.out);
  fails(run(pr(project({ ...script, ...listing() }), { "app/.claude/skills/x/SKILL.md": "# x\n" })), "a folder of skills below the project's root fails", NESTED, "Mend: move what it holds into the root's .claude folder");
  const nested = () => project({ ...script, "app/.Claude/agents/rev.md": "---\nname: rev\n---\n", ...listing() });
  const nestedKept = run(pr(nested(), { "README.md": "x\n" }));
  ok(nestedKept.status === 0 && nestedKept.out.includes(NESTED), "one the base held, in whatever case, is noted", nestedKept.out);
  fails(run(pr(nested(), { "app/.Claude/agents/rev.md": `---\nname: rev\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n` })), "but not once what it holds changes", NESTED);
  fails(run(pr(project({ ...script, ...listing() }), { "app/.claude/settings.json": KIT })), "and so do a nested folder's settings", NESTED);
  const nfd = () => project({ ...script, ["e\u0301/.claude/agents/rev.md"]: "---\nname: rev\n---\n", ...listing() });
  fails(run(pr(nfd(), { ["e\u0301/.claude/agents/rev.md"]: "---\nname: rev\npermissionMode: bypassPermissions\n---\n" })), "and one below a name in another normal form, changed", NESTED);
  if (LINKS) {
    const nestedLink = project({ ...script, "shared/skills/x/SKILL.md": "# x\n", ...listing() });
    fs.mkdirSync(path.join(nestedLink, "app"), { recursive: true }); fs.symlinkSync("../shared", path.join(nestedLink, "app/.claude"));
    git(nestedLink, "add", "-A"); git(nestedLink, "commit", "-q", "-m", "a nested .claude as a link");
    fails(run(nestedLink, "--core"), "and a nested .claude that is a link", NESTED);
  }
  for (const at of [".claude/Agents/rev.md", ".claude/agents/rev.MD", ".claude/Commands/rev.md"]) fails(run(pr(project({ ...script, ...listing() }), { [at]: "---\nname: rev\n---\n" })), `a subagent's file in another letter case, ${at}, fails`, "in another case");
  passes(run(pr(project({ ...script, ...listing() }), { ".claude/agents/rev.md": "---\nname: rev\ndescription: reviews hooks\n---\n# rev\n" })), "a subagent with no hooks in its frontmatter passes");
  const frontStood = project({ ...script, ".claude/agents/rev.md": front("hooks") });
  const frontKept = run(pr(frontStood, { ".claude/agents/rev.md": `${front("hooks")}more of its prompt\n` }));
  ok(frontKept.status === 0 && frontKept.out.includes("as the base held it"), "one the base held is noted while its frontmatter stands", frontKept.out);
  const helperStood = project({ ...script, ...withSetting("apiKeyHelper", TREE_HOOK) });
  const helperKept = run(pr(helperStood, { "README.md": "a change of its own\n" }));
  ok(helperKept.status === 0 && helperKept.out.includes(`the hook "apiKeyHelper: ${TREE_HOOK}"`), "one the base held is noted, not failed", helperKept.out);
  fails(run(pr(project({ ...script, ...listing() }), { ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK, fromWorkingTree)) })), "a new one marked as the baseline's fails all the same: the baseline lists only what stood", "the base held no such hook");
  const stood = project({ ...script, ".claude/settings.json": withHook(TREE_HOOK) });
  const kept = run(pr(stood, { "README.md": "a change of its own\n" }));
  ok(kept.status === 0 && /note as the base held it, nothing fails here: the hook "PostToolUse: bash scripts\/format.sh"/.test(kept.out), "one the base held, with no list, is noted, not failed", kept.out);
  const firstList = run(pr(stood, listing(entry(TREE_HOOK))));
  ok(firstList.status === 0 && /note as the base held it[\s\S]*"from": "the working tree"/.test(firstList.out), "a pull request that writes the list notes it, saying how to list it in the baseline", firstList.out);
  const marked = pr(stood, listing(entry(TREE_HOOK, fromWorkingTree)));
  const listedIn = run(marked);
  ok(listedIn.status === 0 && /note .*lists it in the baseline/.test(listedIn.out), "and passes with it marked, listed in the baseline", listedIn.out);
  fails(run(pr(marked, listing(entry(TREE_HOOK)))), "a pull request that takes the mark out while the hook stands fails: the baseline only shrinks", NOT_KIT);
  fails(run(pr(project({ ...script, ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) }), { ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK)) })), "a hook the base held in the kit's form that the pull request writes otherwise fails", NOT_KIT);
  fails(run(project({ ...script, ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK, fromWorkingTree)) })), "a mark on a hook in the kit's form fails", 'but its command is the starter kit\'s form, which runs its copy on main. Mend: take "from" out');
  fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing({ ...PLUGIN, ...fromWorkingTree }) })), "a mark on what is no hook fails", 'only a hook\'s entry may say "from"');
  fails(run(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK, fromWorkingTree)) }), "--core"), "in the core's own repository none may stand, marked or not", "none may stand");
  const kiroTree = { version: "v1", hooks: [{ name: "fmt", trigger: "Stop", action: { type: "command", command: "node \"$CLAUDE_PROJECT_DIR/scripts/fmt.mjs\"" } }] };
  fails(run(pr(project({ ...listing() }), { "scripts/fmt.mjs": "", ".kiro/hooks/fmt.json": kiroTree, ".codex/config.toml": "notify = [\"python3\", \"scripts/notify.py\"]\n", "scripts/notify.py": "", ...listing({ kind: "hook", name: "Kiro Stop: node \"$CLAUDE_PROJECT_DIR/scripts/fmt.mjs\"", publisher: "this project" }, { kind: "hook", name: "Codex notify: python3 scripts/notify.py", publisher: "this project" }) })),
    "Kiro's and Codex's hooks are held to it too", `the hook "Kiro Stop: node`, `the hook "Codex notify: python3 scripts/notify.py", configured in .codex/config.toml, ${NOT_KIT}`);
  // (#476's code review of 2a76778: notify's words are read as the one command they make, so the kit's form passes)
  const kitNotify = ["bash", "-c", "f=$(git -C \"${CLAUDE_PROJECT_DIR:-.}\" --no-replace-objects show refs/remotes/origin/main:scripts/notify.sh 2>/dev/null) || exit 0; bash -c \"$f\""];
  const notifyRun = words => run(pr(project({ ...listing() }), { "scripts/notify.sh": "", ".codex/config.toml": `notify = ${JSON.stringify(words)}\n`, ...listing({ kind: "hook", name: `Codex notify: ${words.join(" ")}`, publisher: "this project" }) }));
  passes(notifyRun(kitNotify), "Codex's notify given as the kit's form, bash, -c and its script, passes");
  fails(notifyRun(["git", "show", "refs/remotes/origin/main:scripts/notify.sh"]), "while a fetch of its own form fails", NOT_KIT);
  // (#476's security review of a74309b: the command Codex runs on Windows in a hook's place is held to the kit's form too,
  // and named, so its entry reads otherwise than the kit's)
  const codexHook = hook => ({ hooks: { Stop: [{ hooks: [hook] }] } });
  const evil = "powershell -File scripts/evil.ps1";
  const windowsRun = (files, name) => run(pr(project({ ...listing() }), { "scripts/evil.ps1": "", ...files, ...listing({ kind: "hook", name, publisher: "this project" }) }));
  fails(windowsRun({ ".codex/hooks.json": codexHook({ type: "command", command: KIT_HOOK, commandWindows: evil }) }, `Codex Stop: ${KIT_HOOK} (Windows: ${evil})`), "a Codex hook in the kit's form whose commandWindows is not fails", NOT_KIT, "(Windows: powershell");
  fails(windowsRun({ ".codex/config.toml": `[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = ${JSON.stringify(KIT_HOOK)}\ncommand_windows = ${JSON.stringify(evil)}\n` }, `Codex Stop: ${KIT_HOOK} (Windows: ${evil})`), "and so does one in config.toml whose command_windows is not", NOT_KIT);
  const only = { type: "command", command_windows: evil };
  fails(windowsRun({ ".codex/hooks.json": codexHook(only) }, `Codex Stop: ${JSON.stringify(only)}`), "and one with a Windows command alone", NOT_KIT);
  // (#476's fallback security review of 490c9d9: a folder or a submodule's entry at the fetched path is no script either,
  // since git prints what it holds, a name a line, for bash to run)
  const NOT_FILE = 'fetches "scripts/format.sh" from main, which the project holds as no plain file';
  fails(run(pr(project({ ...listing() }), { "scripts/format.sh/bash evil.sh": "", ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) })), "a hook in the kit's form that fetches a folder fails", NOT_FILE);
  const mainDir = project({ "scripts/format.sh/x": "", ...listing() });
  fs.rmSync(path.join(mainDir, "scripts/format.sh"), { recursive: true });
  fails(run(pr(mainDir, { "scripts/format.sh": "echo a file\n", ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) })), "and one whose fetched path main holds as a folder", NOT_FILE);
  const sub = project({ ...listing() });
  git(sub, "checkout", "-q", "-B", "change");
  change(sub, { ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) });
  git(sub, "add", "-A"); git(sub, "update-index", "--add", "--cacheinfo", `160000,${git(sub, "rev-parse", "HEAD")},scripts/format.sh`);
  git(sub, "commit", "-q", "-m", "a submodule's entry"); git(sub, "checkout", "-q", "main"); git(sub, "merge", "-q", "--no-ff", "-m", "merge", "change");
  fails(run(sub), "and one whose fetched path is a submodule's entry", NOT_FILE);
  // (#476's fallback security review of bf7b3b2: what git shows at the path is asked of git, whatever the listing says,
  // as of an empty folder, which the listing leaves out)
  const emptyBase = project({ ...listing() }), inEmpty = { cwd: emptyBase, env, encoding: "utf8" };
  const emptyTree = execFileSync("git", ["mktree"], { ...inEmpty, input: "" }).trim();
  const withEmpty = execFileSync("git", ["mktree"], { ...inEmpty, input: `${git(emptyBase, "ls-tree", "HEAD")}\n040000 tree ${emptyTree}\tformat.sh\n` }).trim();
  git(emptyBase, "update-ref", "refs/heads/main", git(emptyBase, "commit-tree", withEmpty, "-p", "HEAD", "-m", "an empty folder at the path"));
  git(emptyBase, "reset", "-q", "--hard");
  const rootKit = KIT_HOOK.replace("main:scripts/format.sh", "main:format.sh");
  fails(run(pr(emptyBase, { ".claude/settings.json": withHook(rootKit), ...listing(entry(rootKit)) })), "and one whose fetched path main holds as an empty folder", 'fetches "format.sh" from main, which the project holds as no plain file');
  // (#476's fallback security review of de6baf6: and where the merge itself holds an empty folder there, main a file)
  const emptyHead = project({ "format.sh": "echo a file\n", ...listing() }), inHead = { cwd: emptyHead, env, encoding: "utf8" };
  pr(emptyHead, { ".claude/settings.json": withHook(rootKit), ...listing(entry(rootKit)) });
  const headEmpty = execFileSync("git", ["mktree"], { ...inHead, input: "" }).trim();
  const lines = git(emptyHead, "ls-tree", "HEAD").split("\n").filter(l => !l.endsWith("\tformat.sh"));
  const headTree = execFileSync("git", ["mktree"], { ...inHead, input: `${lines.join("\n")}\n040000 tree ${headEmpty}\tformat.sh\n` }).trim();
  git(emptyHead, "update-ref", "refs/heads/main", git(emptyHead, "commit-tree", headTree, "-p", "HEAD^1", "-p", "HEAD^2", "-m", "merge"));
  git(emptyHead, "reset", "-q", "--hard");
  fails(run(emptyHead), "and one whose merge holds an empty folder at the fetched path, main a file", 'fetches "format.sh" from main, which the project holds as no plain file');
  // (#476's fallback security review of 32e028f: where a tree git would refuse names one entry to a path lookup and
  // another to git show, as one out of order with a broken entry that empties the whole listing, the object git show
  // resolves is what is asked)
  const oddBase = project({ ...listing() }), inOdd = { cwd: oddBase, env };
  const oid = text => execFileSync("git", ["hash-object", "-w", "--stdin"], { ...inOdd, encoding: "utf8", input: text }).trim();
  const entries = git(oddBase, "ls-tree", "HEAD").split("\n").map(l => { const [meta, name] = l.split("\t"); const [mode, , id] = meta.split(" "); return [mode === "040000" ? "40000" : mode, name, id]; });
  const raw = [["40000", "aaa", oid("y\n")], ...entries, ["100644", "zzzzzzzzzzzzzzzz", oid("x\n")], ["120000", "format.sh", oid("tree.sh")]].map(([m, n, o]) => Buffer.concat([Buffer.from(`${m} ${n}\0`), Buffer.from(o, "hex")]));
  const oddTree = execFileSync("git", ["hash-object", "-t", "tree", "--literally", "-w", "--stdin"], { ...inOdd, encoding: "utf8", input: Buffer.concat(raw) }).trim();
  const oddMain = git(oddBase, "commit-tree", oddTree, "-p", "HEAD", "-m", "a tree out of order");
  // (the pull request's own tree written from the clean checkout, its commits made by hand over that main)
  change(oddBase, { "format.sh": "echo a file\n", ".claude/settings.json": withHook(rootKit), ...listing(entry(rootKit)) });
  git(oddBase, "add", "-A");
  const prTree = git(oddBase, "write-tree"), prCommit = git(oddBase, "commit-tree", prTree, "-p", oddMain, "-m", "change");
  git(oddBase, "update-ref", "refs/heads/main", git(oddBase, "commit-tree", prTree, "-p", oddMain, "-p", prCommit, "-m", "merge"));
  fails(run(oddBase), "and one whose fetched path main holds as a link in a tree out of order", 'fetches "format.sh" from main, which the project holds as no plain file');
  // (a link whose target is longer than any file system follows leads nowhere, read at the base as in the tree)
  const longBase = project({ ...listing() }), inLong = { cwd: longBase, env, encoding: "utf8" };
  const longLink = execFileSync("git", ["hash-object", "-w", "--stdin"], { ...inLong, input: "a/".repeat(300000) }).trim();
  const kiro = execFileSync("git", ["mktree"], { ...inLong, input: `120000 blob ${longLink}\thooks\n` }).trim();
  const longTree = execFileSync("git", ["mktree"], { ...inLong, input: `${git(longBase, "ls-tree", "HEAD")}\n040000 tree ${kiro}\t.kiro\n` }).trim();
  const longMain = git(longBase, "commit-tree", longTree, "-p", "HEAD", "-m", "a link too long to follow");
  // (the pull request's own tree, which holds no such link, its commits made by hand over that main and checked out)
  change(longBase, { "README.md": "a change of its own\n" });
  git(longBase, "add", "-A");
  const longPrTree = git(longBase, "write-tree"), longPr = git(longBase, "commit-tree", longPrTree, "-p", longMain, "-m", "change");
  git(longBase, "update-ref", "refs/heads/main", git(longBase, "commit-tree", longPrTree, "-p", longMain, "-p", longPr, "-m", "merge"));
  git(longBase, "reset", "-q", "--hard");
  passes(run(longBase), "a link at the base too long to follow leads nowhere, and the check goes on");
  // (a tool's file in another case is what a file system that ignores case gives the tool)
  fails(run(pr(project({ ...listing() }), { ".Codex/hooks.json": codexHook({ type: "command", command: "bash scripts/evil.sh" }) })), "a tool's file in another case fails", ".Codex is .codex in another case", "Mend: rename it to .codex");
  fails(run(pr(project({ ...listing() }), { ".Kiro/hooks/x.JSON": { version: "v1", hooks: [{ name: "x", trigger: "Stop", action: { type: "command", command: "bash scripts/evil.sh" } }] } })), "and so does a Kiro hook file in another case, its .json too", "Mend: rename it to .kiro");
  fails(run(pr(project({ ...listing() }), { ".kiro/hooks/x.JSON": { version: "v1", hooks: [{ name: "x", trigger: "Stop", action: { type: "command", command: "bash scripts/evil.sh" } }] } })), "and a Kiro hook file whose .json is in another case", "Mend: rename it to .kiro/hooks/x.json");
  // (a folder the project's own helper writes none of, so a file system that ignores case keeps the name as written)
  const oddStood = run(pr(project({ ".Codex/config.toml": "# none\n", ...listing() }), { "README.md": "a change of its own\n" }));
  ok(oddStood.status === 0 && /\.Codex is \.codex in another case/.test(oddStood.out), "one the base held is noted, not failed", oddStood.out);
  fails(run(pr(project({ ".Codex/config.toml": "# none\n", ...listing() }), { ".Codex/config.toml": "notify = [\"bash\", \"scripts/new.sh\"]\n" })), "but not once the pull request changes it", "Mend: rename it to .codex");
  const caseStep = STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed");
  ok(notDone(project({ ".Codex/config.toml": "# none\n", ...listing() }), caseStep)[0]?.mend.includes("Mend: rename it to .codex"), "the sync note's step reads not done while a tool's file stands in another case");
  // (what the tool reads under it is found through each folder's own names, in whatever case they stand, so one the base
  // held is noted only while each file the tool reads there stands)
  const deep = (files, changed, says) => fails(run(pr(project({ ...files, ...listing() }), changed)), says, "in another case", "Mend: rename it to");
  deep({ ".Codex/Config.toml": "# none\n" }, { ".Codex/Config.toml": "notify = [\"bash\", \"scripts/new.sh\"]\n" }, "and not once the pull request changes a file under it in another case too");
  deep({ ".Kiro/Hooks/lint.json": "{}\n" }, { ".Kiro/Hooks/lint.json": { version: "v1", hooks: [{ name: "x", trigger: "Stop", action: { type: "command", command: "bash scripts/new.sh" } }] } }, "nor a hook file in a folder under it in another case");
  deep({ ".Claude/Skills/notes/skill.md": "# notes\n" }, { ".Claude/Skills/notes/skill.md": "# notes, changed\n" }, "nor a skill's file under it in another case");
  deep({ ".Kiro/Hooks/lint.json": "{}\n" }, { ".Kiro/Hooks/new.json": "{}\n" }, "nor a hook file added under it");
  fails(run(pr(project({ ...listing() }), { ".claude/skills/notes/Skill.md": "# notes\n" })), "and a skill whose SKILL.md is in another case", "Mend: rename it to .claude/skills/notes/SKILL.md");
  // (a skill's folder in another case is left out where the file system ignores case, as Windows' and macOS's do: there
  // the working tree gives the tool's own name what git's tree holds under another, so the skill reads as new)
  const caseless = (() => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tools-")); made.push(d); fs.writeFileSync(path.join(d, "a"), ""); return fs.existsSync(path.join(d, "A")); })();
  const deepStood = run(pr(project({ ".Kiro/Hooks/lint.json": "{}\n", ...(caseless ? {} : { ".Claude/Skills/notes/skill.md": "# notes\n" }), ...listing() }), { "README.md": "a change of its own\n" }));
  ok(deepStood.status === 0 && /\.Kiro is \.kiro in another case/.test(deepStood.out) && (caseless || /\.Claude is \.claude in another case/.test(deepStood.out)), "while what stands under it is noted, not failed", deepStood.out);
  // (#600's code review of 038f301: what the tool does not read under it changes nothing of what it reads, and a folder
  // whose files are all ignored holds none of the project's)
  const docStood = run(pr(project({ ".Kiro/hooks/lint.json": "{}\n", ".Kiro/hooks/README.md": "notes\n", ...listing() }), { ".Kiro/hooks/README.md": "notes, changed\n" }));
  ok(docStood.status === 0 && /\.Kiro is \.kiro in another case/.test(docStood.out), "a file under it the tool does not read, changed, leaves it noted", docStood.out);
  const ignoredBase = project({ ".gitignore": ".Codex/*\n", ...listing() });
  write(ignoredBase, ".Codex/config.toml", "notify = [\"bash\", \"x.sh\"]\n");
  passes(run(pr(ignoredBase, { "README.md": "a change of its own\n" })), "and a folder in another case whose files are all ignored is none of the project's");
  // (#600's code review of e380041: and an ignored file beside a tracked one is none of what the tool's note is held to)
  const besideBase = project({ ".gitignore": ".Codex/config.toml\n", ".Codex/hooks.json": "{}\n", ...listing() });
  write(besideBase, ".Codex/config.toml", "notify = [\"bash\", \"x.sh\"]\n");
  const besideRun = run(pr(besideBase, { "README.md": "a change of its own\n" }));
  ok(besideRun.status === 0 && /\.Codex is \.codex in another case/.test(besideRun.out), "an ignored file beside a tracked one under it leaves it noted", besideRun.out);
  // (#600's code review of b2502b6: a file in a tool folder that the tool does not read names no folder on its way)
  const unread = pr(project({ ".gitignore": ".Kiro/hooks/*.json\n", ...listing() }), { "README.md": "a change of its own\n" });
  write(unread, ".Kiro/hooks/lint.json", "{}\n");
  write(unread, ".Kiro/hooks/README.md", "notes\n");
  passes(run(unread), "a file there the tool does not read, beside its ignored hooks, is no tool's file");
  // (#600's fallback security review of 8dfe536: a commit git cannot list is no commit with nothing in it)
  process.env.AGENT_TOOLS_LISTING_MAX = "16";
  const unlisted = cli(pr(project({ ...listing() }), { "README.md": "a change of its own\n" }));
  delete process.env.AGENT_TOOLS_LISTING_MAX;
  fails(unlisted, "a head git cannot list fails", "cannot be listed", "Mend: ");
  // (#600's fallback security review of 72e6450: names are compared as a file system that folds case does)
  fails(run(pr(project({ ...listing() }), { ".claude/\u017fkills/notes/SKILL.md": "# notes\n" })), "a name that differs only by a letter a full case fold matches fails too", "in another case");
  // (#476's security review of a74309b: what the kit's form fetches from main must be a file, not a link, whose target's
  // name main would give in the script's place)
  if (LINKS) {
    const linkFetch = project({ "scripts/tree.sh": "echo the branch's\n", ...listing() });
    fs.symlinkSync("./tree.sh", path.join(linkFetch, "scripts/format.sh"));
    fails(run(pr(linkFetch, { ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) })), "a hook in the kit's form that fetches a link from main fails", 'fetches "scripts/format.sh" from main, which the project holds as no plain file');
    // (#647's fallback security review: its mend is its own, the command being in the kit's form already)
    const linkFetchSays = run(linkFetch);
    ok(linkFetchSays.out.includes('Mend: make "scripts/format.sh" a plain file committed in the project') && !/no plain file[^\n]*Mend: write its command in the starter kit's form/u.test(linkFetchSays.out), "and its mend is to make the fetched file a plain one, not to write the command in the kit's form it is in", linkFetchSays.out);
    // (#476's code review of ac42a35: the starter kit's own hooks too, where what they fetch is a link)
    const kitLink = project({ "scripts/tree.sh": "echo the branch's\n", ...listing() });
    fs.mkdirSync(path.join(kitLink, "core/scripts"), { recursive: true });
    fs.symlinkSync("../../scripts/tree.sh", path.join(kitLink, "core/scripts/work-saved.sh"));
    fails(run(pr(kitLink, { "README.md": "a change of its own\n" }), "--core"), "a hook of the starter kit's own, unchanged, whose fetched file is a link, fails", 'fetches "core/scripts/work-saved.sh" from main, which the project holds as no plain file');
    // (#476's code review of a76614d: and where main holds it as a link that the pull request makes a file, since the hook
    // fetches from main until the pull request merges)
    const mainLink = project({ "scripts/tree.sh": "echo the branch's\n", ...listing() });
    fs.symlinkSync("./tree.sh", path.join(mainLink, "scripts/format.sh"));
    git(mainLink, "add", "-A"); git(mainLink, "commit", "-q", "-m", "a link on main");
    git(mainLink, "checkout", "-q", "-B", "change"); fs.unlinkSync(path.join(mainLink, "scripts/format.sh"));
    fails(run(pr(mainLink, { "scripts/format.sh": "echo a file\n", ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) })), "and so does one whose fetched link the pull request makes a file, main holding the link until it merges", 'fetches "scripts/format.sh" from main, which the project holds as no plain file');
  }
  const step = STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed");
  ok(notDone(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK)) }), step)[0]?.mend.includes(NOT_KIT), "the sync note's step reads not done while a hook not in the kit's form stands unmarked");
  ok(!notDone(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK, fromWorkingTree)) }), step).length, "and done once it is marked, listed in the baseline");
  // (the kit's forms, whole: its own hooks are each in one, and a command a megabyte long is told from them at once)
  ok(kitHooks().map(id => JSON.parse(id)).flatMap(id => { const h = id[id.length - 1]; return [h.command, h.action?.command].filter(Boolean); }).every(kitForm), "the starter kit's own hooks are each in the kit's form");
  const began = Date.now();
  for (const command of [`${KIT_HOOK}${" x".repeat(1 << 18)}`, kitCommand(" x".repeat(1 << 18)), "'".repeat(1 << 20)]) kitForm(command);
  ok(Date.now() - began < 5000, "and a command a megabyte long is told from the kit's form at once", `${Date.now() - began} ms`);
}

// ---- what git stores where a tool reads its files ----
{
  // (a submodule's entry, put in the index as git stores one, in a commit of its own on top of `dir`'s branch)
  // (its folder left empty on disk, as a checkout that brings in no submodule leaves it, so `git add -A` keeps it)
  const gitlink = (dir, at, id = git(dir, "rev-parse", "HEAD")) => { fs.mkdirSync(path.join(dir, at), { recursive: true }); git(dir, "update-index", "--add", "--cacheinfo", `160000,${id},${at}`); git(dir, "commit", "-q", "-m", `a submodule at ${at}`); };
  const prLink = (dir, at, id) => { git(dir, "checkout", "-q", "-B", "change"); gitlink(dir, at, id); git(dir, "checkout", "-q", "main"); git(dir, "merge", "-q", "--no-ff", "-m", "merge", "change"); return dir; };
  const SAYS = "is a submodule where an agent tool reads its files";
  for (const at of [".codex", ".claude/skills/notes", ".Kiro/hooks", ".kiro"])
    fails(run(prLink(project({ ...listing() }), at)), `a submodule at ${at} fails`, `${at} ${SAYS}`, "Mend: ");
  passes(run(prLink(project({ ...listing() }), "vendor/lib")), "a submodule elsewhere is none of the agent tools'");
  const held = project({ ...listing() });
  gitlink(held, ".codex");
  const heldRun = run(pr(held, { "README.md": "a change of its own\n" }));
  ok(heldRun.status === 0 && heldRun.out.includes(`.codex ${SAYS}`), "one the base held is noted, not failed", heldRun.out);
  fails(run(prLink(held, ".codex", git(held, "rev-parse", "HEAD~1"))), "but not once the pull request moves it", `.codex ${SAYS}`);
  ok(notDone(held, STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed"))[0]?.mend.includes(`.codex ${SAYS}`), "the sync note's step reads not done while one stands");
  const core = project({ ...listing() });
  gitlink(core, ".codex");
  fails(run(core, "--core"), "in the core's own repository none may stand", `.codex ${SAYS}`);
}

// ---- what the tools' settings set in the environment of the programs they start ----
{
  const withEnv = (env, file = ".claude/settings.json") => ({ [file]: JSON.stringify({ ...JSON.parse(KIT), env }, null, 2) });
  const SAYS = 'sets the variable "BASH_ENV"';
  passes(run(pr(project({ ...listing() }), withEnv({ ANTHROPIC_MODEL: "x", CLAUDE_CODE_MAX_OUTPUT_TOKENS: "1", DISABLE_TELEMETRY: "1", MAX_THINKING_TOKENS: "1", CI: "1" }))), "a setting's \"env\" of the variables kept passes");
  fails(run(pr(project({ ...listing() }), withEnv({ BASH_ENV: "scripts/x.sh" }))), "one that sets a variable a shell reads as it starts fails", SAYS, '.claude/settings.json: "env"', "Mend: take it out");
  // (each name in one run, a project being costly to set up where git is slow, as on Windows)
  // (any variable but those kept, named whole, of plain letters: #603's fallback security reviews of f021c25, 66d3f04 and
  // 2cc401d found names a list left out, and a prefix kept let others in)
  const names = ["ENV", "PATH", "Path", "NODE_OPTIONS", "GIT_DIR", "GIT_CONFIG_COUNT", "LD_PRELOAD", "BASH_FUNC_x", "HOME", "XDG_CONFIG_HOME", "SSH_ASKPASS", "CLAUDE_CODE_SHELL_PREFIX", "CLAUDE_PROJECT_DIR", "ComSpec", "SHELL", "GCONV_PATH", "LOCPATH", "GCM_GITHUB_HELPER", "EDITOR", "DEBUG", "CLAUDE_CONFIG_DIR", "CLAUDE_CODE_GIT_BASH_PATH", "CLAUDE_CODE_AUTOMOUNT_ROOTS", "CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS", "CLAUDE_CODE_PLUGIN_DIRS", "CLAUDE_CODE_PROCESS_WRAPPER", "CLAUDE_CODE_SAFE_MODE", "ANTHROPIC_BASE_URL", "ANTHROPIC_CUSTOM_HEADERS", "DISABLE_X", "CLAUDE_CODE_MAX_OUTPUT_TOKENſ"];
  fails(run(pr(project({ ...listing() }), withEnv(Object.fromEntries(names.map(n => [n, "x"]))))), `and so does one that sets ${names.join(", ")}`, ...names.map(n => `sets the variable "${n}"`));
  fails(run(pr(project({ ...listing() }), withEnv({ BASH_ENV: "x" }, ".claude/settings.local.json"))), "in settings.local.json too", '.claude/settings.local.json: "env"');
  fails(run(pr(project({ ...listing() }), { ".codex/config.toml": "[profiles.fast.shell_environment_policy.set]\nHOME = \"cfg\"\n" })), "and in a Codex profile's, which replaces it where the profile is chosen", '.codex/config.toml: "profiles.fast.shell_environment_policy.set"', 'sets the variable "HOME"');
  fails(run(pr(project({ ...listing() }), { ".codex/config.toml": "[shell_environment_policy]\nset = { NODE_OPTIONS = \"x\" }\n" })), "and in Codex's config, the environment its commands are given", '.codex/config.toml: "shell_environment_policy.set"', 'sets the variable "NODE_OPTIONS"');
  fails(run(pr(project({ ...listing() }), withEnv(["BASH_ENV"]))), "an \"env\" that is no object is refused as the wrong shape", '"env" is not a JSON object');
  const held = project({ ...withEnv({ BASH_ENV: "scripts/x.sh" }), ...listing() });
  const heldRun = run(pr(held, { "README.md": "a change of its own\n" }));
  ok(heldRun.status === 0 && heldRun.out.includes(SAYS), "one the base held is noted, not failed", heldRun.out);
  const heldHook = run(pr(held, { ".claude/settings.json": JSON.stringify({ ...JSON.parse(KIT), env: { BASH_ENV: "scripts/x.sh" }, model: "opus" }, null, 2) }));
  ok(heldHook.status === 0 && heldHook.out.includes(SAYS), "and stays noted while the file changes around it", heldHook.out);
  fails(run(pr(held, withEnv({ BASH_ENV: "scripts/y.sh" }))), "but not once the pull request changes its value", SAYS);
  fails(run(project(withEnv({ BASH_ENV: "x" })), "--core"), "in the core's own repository none may stand", SAYS);
  // (#603's code review of c08aa8e: with no base to read against, one that stands is noted, as a pin or a hook's source is)
  const noBase = run(project({ ...withEnv({ BASH_ENV: "scripts/x.sh" }), ".Codex/hooks.json": "{}\n", ...listing() }));
  ok(noBase.status === 0 && noBase.out.includes("with no base to read against") && noBase.out.includes(SAYS) && noBase.out.includes(".Codex is .codex in another case"), "with no base, one that stands is noted, and so is a tool's file in another case", noBase.out);
  ok(notDone(held, STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed"))[0]?.mend.includes(SAYS), "the sync note's step reads not done while one stands");
}

// ---- the TOML reader Codex's config is read with ----
{
  const t = parseToml("# c\n__proto__ = 'p'\na.b = 1 # n\ns = \"\\u00e9\\n\"\nm = \"\"\"\nx \\\n   y\"\"\"\nl = '''z'''\n[t]\nd = 1979-05-27T07:32:00Z\ni = { k = [1, 'two', [true]] }\n[[r]]\nn = 1\n[[r]]\nn = 2\n");
  const want = '{"__proto__":"p","a":{"b":1},"s":"é\\n","m":"x y","l":"z","t":{"d":"1979-05-27T07:32:00.000Z","i":{"k":[1,"two",[true]]}},"r":[{"n":1},{"n":2}]}';
  ok(JSON.stringify(t) === want && Object.getPrototypeOf(t) === Object.prototype, "TOML is read as JSON would hold it, a key \"__proto__\" a key like any other", JSON.stringify(t));
  const headers = Array.from({ length: 200 }, (_, i) => `[[${Array(i + 1).fill("a").join(".")}]]`).join("\n");
  for (const [bad, says] of [[`${headers}\n${Array(199).fill("b").join(".")} = 1\n`, "nests deeper than 200"], ["a = 1\na = 2", "line 2: trying to redefine"], ["a = \"x", "unfinished string"], ["[a]\n[a]", "line 2: trying to redefine"], ["a = [1", "expected comma"], ["a = 1 b", "end-of-line"], ["x = [{ a = 1 }]\n[[x]]", "line 2: trying to redefine"], ["a = \"\\q\"", "escape sequence"], [`a = ${"[".repeat(300)}`, "nests deeper than 200"]]) {
    let message = "";
    try { parseToml(bad); } catch (e) { message = e.message; }
    ok(message.includes(says), `TOML that is no TOML is refused: ${says}`, message);
  }
  // (#634's search for differences: the package drops the quotes a string holds before its closing """ where a
  // line-ending backslash runs into them, so such a string is refused; a CRLF inside a string of several lines is LF)
  for (const lost of ["notify = [\"python3\", \"\"\"notify.py\\\n\"\"\"\"\"]\n", "command = \"\"\"x \\\r\n  \"\"\"\"\n", "a = \"\"\"x\\\\\\\n\"\"\"\"\n"]) {
    let message = "";
    try { parseToml(lost); } catch (e) { message = e.message; }
    ok(message.startsWith("line 1: a string's line-ending backslash runs into its closing quotes"), `a string whose quotes the package would drop is refused: ${JSON.stringify(lost)}`, message);
  }
  // (#634's code review: only a multi-line basic string; a literal string, a comment and a one-line string are read)
  const literal = parseToml("notify = ['''a\\\n'''', \"b\\\\\", '''c\\\n''''']\n# d\\\n");
  ok(JSON.stringify(literal.notify) === JSON.stringify(["a\\\n'", "b\\", "c\\\n''"]), "a backslash before the closing quotes of a literal string, or in a comment, is read as written", JSON.stringify(literal));
  ok(parseToml("a = \"\"\"x\\\\\n\"\"\"\"\"\nb = \"\"\"x\\\n\"\"\"\n").a === "x\\\n\"\"","a backslash escaped by another ends no line, and one with no quote of the string's own before the close is read", JSON.stringify(parseToml("a = \"\"\"x\\\\\n\"\"\"\"\"\n")));
  ok(parseToml("a = '''x\r\ny'''\r\nb = \"\"\"p\r\nq\"\"\"\r\n").a === "x\ny" && parseToml("b = \"\"\"p\r\nq\"\"\"\r\n").b === "p\nq", "a CRLF inside a string of several lines is read as LF");
  for (const bare of ["a = 1\r\r\nb = 2\r\n", "a = '''x\ry'''\n"]) {
    let refused = false;
    try { parseToml(bare); } catch { refused = true; }
    ok(refused, `a CR standing alone is refused, before a CRLF too: ${JSON.stringify(bare)}`);
  }
  // (#476's code review of fd9135b: each [[...]] header appends without reading the entries before it again)
  const began = Date.now(), many = parseToml("[[x]]\n".repeat(200000));
  ok(many.x.length === 200000 && Date.now() - began < 3000, "an array of 200,000 tables is read at once", `${Date.now() - began} ms`);
}

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

for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
