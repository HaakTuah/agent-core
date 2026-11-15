// Tests of agent-tools.mjs (floor topic 15, "An agent's own tools are code with its sign-ins"): each case a made-up
// project in a temporary git repository, never a real one, run as licences.yml runs the check, and every failure read
// for its mend (mend.mjs). Git and Node's own modules.
//
//   node scripts/agent-tools-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kitHooks, listed } from "./agent-tools.mjs";
import { mended } from "./mend.mjs";

const SCRIPT = fileURLToPath(new URL("./agent-tools.mjs", import.meta.url));
const KIT = fs.readFileSync(fileURLToPath(new URL("../setup/template/claude-settings.json.tmpl", import.meta.url)), "utf8");
let failed = 0, count = 0;
const made = [];
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail ? `\n${detail}` : ""}`); } };
const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: os.devNull };
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8" }).trim();
const write = (dir, file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
const withPlugins = plugins => JSON.stringify({ ...JSON.parse(KIT), enabledPlugins: plugins }, null, 2);
const PLUGIN = { kind: "plugin", name: "helper@example-market", publisher: "Example Tools", version: "1.4.0" };

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
    else write(dir, file, typeof text === "string" ? text : JSON.stringify(text, null, 2));
  }
}
// The pull request: the change committed on a branch and merged into main with --no-ff, as GitHub's merge checkout has
// it (the base is its first parent).
function pr(dir, files) {
  git(dir, "checkout", "-q", "-b", "change");
  change(dir, files);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "change");
  git(dir, "checkout", "-q", "main");
  git(dir, "merge", "-q", "--no-ff", "-m", "merge", "change");
  return dir;
}
const run = (dir, ...args) => { const r = spawnSync(process.execPath, [SCRIPT, "checks/licences.json", ...args], { cwd: dir, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const passes = (r, what) => ok(r.status === 0 && !/FAIL/.test(r.out), what, r.out);
const fails = (r, what, ...says) => ok(r.status === 1 && mended(r.out) && says.every(s => r.out.includes(s)), `${what}, and says the mend`, r.out);

// ---- the kit's own hooks are the core's ----
const kitGroups = JSON.parse(KIT).hooks;
ok(JSON.stringify(kitHooks().map(k => k.slice(0, k.indexOf(":")))) === JSON.stringify(["hook SessionStart startup|resume", "hook PreToolUse Agent|Task", "hook Stop"]) && kitHooks()[2] === `hook Stop: ${kitGroups.Stop[0].hooks[0].command}`,
  "the starter kit's hooks are read by event, matcher and command", JSON.stringify(kitHooks()));
passes(run(project()), "a project as the starter kit writes it, with no list, passes");
passes(run(project({ "checks/licences.json": { lockfiles: [], agentTools: [] } })), "and with an empty list");
passes(run(project({ "checks/licences.json": { lockfiles: [], agentTools: [] } }), "--core"), "in the core's own repository too");

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
const linkedSettings = project({ ...listing() });
fs.rmSync(path.join(linkedSettings, ".claude/settings.json"));
fs.writeFileSync(path.join(linkedSettings, "elsewhere.json"), KIT);
fs.symlinkSync("../elsewhere.json", path.join(linkedSettings, ".claude/settings.json"));
fails(run(linkedSettings), "a settings file that is a link fails, never followed out of the checkout", '".claude/settings.json" is a link');
const linkedSkills = project({ ...listing() });
fs.mkdirSync(path.join(linkedSkills, "outside/notes"), { recursive: true });
fs.writeFileSync(path.join(linkedSkills, "outside/notes/SKILL.md"), "x");
fs.symlinkSync("../outside", path.join(linkedSkills, ".claude/skills"));
fails(run(linkedSkills), "and so does a skills folder that is a link", '".claude/skills" is a link');
if (process.platform !== "win32") {
  const odd = run(project({ ".claude/skills/x\n::warning::injected/SKILL.md": "x", ...listing() }));
  ok(odd.status === 1 && !/^::warning::/m.test(odd.out) && mended(odd.out), "a skill folder's name with a line break in it prints on the failure's own line, so it writes no workflow command", odd.out);
}
// a sync that changes the kit's hooks: the project's own, as the base's kit wrote them, still count as the core's
const synced = project({ ...listing() });
const HERE = fileURLToPath(new URL("..", import.meta.url));
fs.cpSync(path.join(HERE, "scripts"), path.join(synced, "core/scripts"), { recursive: true });
fs.cpSync(path.join(HERE, "setup/template"), path.join(synced, "core/setup/template"), { recursive: true });
git(synced, "add", "-A"); git(synced, "commit", "-q", "-m", "the copy");
const newKit = JSON.parse(KIT);
newKit.hooks.Stop[0].hooks[0].command = "a newer stop";
pr(synced, { "core/setup/template/claude-settings.json.tmpl": JSON.stringify(newKit, null, 2) });
const fromCopy = spawnSync(process.execPath, ["core/scripts/agent-tools.mjs", "checks/licences.json"], { cwd: synced, encoding: "utf8" });
ok(fromCopy.status === 0 && !/FAIL/.test(fromCopy.stdout + fromCopy.stderr), "a sync that changes the kit's hooks fails no project whose hooks the base's kit wrote", fromCopy.stdout + fromCopy.stderr);
ok(listed({ lockfiles: [] }, "c") === null, "a config with no \"agentTools\" holds no list");

// ---- with no list yet: the pull request's base counts as it (nothing locks a project) ----
const old = project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }) });
const noted = run(old);
ok(noted.status === 0 && /note .*holds no "agentTools" yet[\s\S]*helper@example-market/.test(noted.out), "with no list and no base, as on a push, what is unlisted is noted and nothing fails", noted.out);
passes(run(pr(old, { "README.md": "a change of its own\n" })), "a pull request that adds no tool passes, a tool its base held unlisted standing");
fails(run(pr(project(), { ".claude/settings.json": withPlugins({ "helper@example-market": true }) })), "a pull request that adds an unlisted tool fails", "is new in this pull request and listed nowhere");
passes(run(pr(project(), { ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing(PLUGIN) })), "and passes once it writes the list");
fails(run(pr(project(), { ".claude/skills/notes/SKILL.md": "x" })), "a pull request that adds a skill, unlisted, fails", 'the skill "notes"');
fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }) }), "--core"), "in the core's own repository a missing list counts as empty, so an unlisted tool fails", "is not listed");

for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
