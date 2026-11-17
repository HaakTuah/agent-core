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
import { fromTree, pathsIndex } from "./hook-source.mjs";
import { mended } from "./mend.mjs";
import { STEPS, notDone } from "./steps.mjs";
import { parseToml } from "./toml.mjs";

const SCRIPT = fileURLToPath(new URL("./agent-tools.mjs", import.meta.url));
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
  git(dir, "checkout", "-q", "-B", "change"); // (-B: a second pull request on the same project starts from its main)
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
if (LINKS) {
// links: one inside the checkout is followed, as the tool that reads it follows it; one that leads out is not
const inside = project({ ...listing() });
fs.mkdirSync(path.join(inside, "shared/notes"), { recursive: true });
fs.writeFileSync(path.join(inside, "shared/notes/SKILL.md"), "x");
fs.mkdirSync(path.join(inside, ".claude/skills"), { recursive: true });
fs.symlinkSync("../../shared/notes", path.join(inside, ".claude/skills/notes"));
fails(run(inside), "a skill linked from inside the checkout is read, so it fails unlisted", 'the skill "notes"');
const away = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tools-"));
made.push(away);
fs.writeFileSync(path.join(away, "settings.json"), withPlugins({ "helper@example-market": true }));
const out = project({ ...listing() });
fs.rmSync(path.join(out, ".claude/settings.json"));
fs.symlinkSync(path.join(away, "settings.json"), path.join(out, ".claude/settings.json"));
fails(run(out), "a settings file linked from outside the checkout fails, never followed", '".claude/settings.json" is a link that leads out of the checkout');
const outSkills = project({ ...listing() });
fs.symlinkSync(away, path.join(outSkills, ".claude/skills"));
fails(run(outSkills), "and so does a skills folder linked from outside", '".claude/skills" is a link that leads out');
// what stood before turns nothing red: a skill linked inside the checkout, or a link out of it, the base held
const linkedBase = project();
fs.mkdirSync(path.join(linkedBase, "shared/notes"), { recursive: true });
fs.writeFileSync(path.join(linkedBase, "shared/notes/SKILL.md"), "x");
fs.mkdirSync(path.join(linkedBase, ".claude/skills"), { recursive: true });
fs.symlinkSync("../../shared/notes", path.join(linkedBase, ".claude/skills/notes"));
fs.symlinkSync(path.join(away, "settings.json"), path.join(linkedBase, ".mcp.json"));
git(linkedBase, "add", "-A"); git(linkedBase, "commit", "-q", "-m", "links");
const kept = run(pr(linkedBase, { "README.md": "a change of its own\n" }));
ok(kept.status === 0 && /note .*"\.mcp\.json" is a link .*as the base held it/.test(kept.out) && /not listed, as the base held them: the skill "notes"/.test(kept.out), "a skill linked inside the checkout and a link out of it, both held by the base, are noted and fail nothing", kept.out);
const fileBase = project({ ".mcp.json": path.join(away, "settings.json") });
fs.rmSync(path.join(fileBase, ".mcp.json"));
fs.symlinkSync(path.join(away, "settings.json"), path.join(fileBase, ".mcp.json"));
fails(run(pr(fileBase, { "README.md": "a change of its own\n" })), "a link out of the checkout where the base held a file of the same text fails: only a link the base held stands", '".mcp.json" is a link that leads out');
}
const colon = JSON.parse(KIT);
colon.hooks.Stop.push({ matcher: "Write: x", hooks: [{ type: "command", command: "y" }] });
fails(run(project({ ".claude/settings.json": JSON.stringify(colon), ...listing({ kind: "hook", name: "Stop Write: x: y", publisher: "this project" }) })), "a matcher that holds \": \", which a hook's name splits at, fails", 'matcher "Write: x" holds ": "');
const twins = JSON.parse(KIT), http = { type: "http", url: "https://hooks.example.invalid" };
twins.hooks.PostToolUse = [{ hooks: [http, { type: "command", command: JSON.stringify(http) }] }];
fails(run(project({ ".claude/settings.json": JSON.stringify(twins), ...listing({ kind: "hook", name: `PostToolUse: ${JSON.stringify(http)}`, publisher: "this project" }) })), "two hooks that would share a name, one by its command and one by its text, fail", "share the name");
// the base read through git's own tree as the working tree is read
passes(run(pr(project({ ".claude/skills/résumé/SKILL.md": "x" }), { "README.md": "a change of its own\n" })), "a skill whose folder's name git would quote, held by the base, stays in its baseline");
if (LINKS) {
const settingsLinked = project();
fs.writeFileSync(path.join(settingsLinked, "shared-settings.json"), withPlugins({ "helper@example-market": true }));
fs.rmSync(path.join(settingsLinked, ".claude/settings.json"));
fs.symlinkSync("../shared-settings.json", path.join(settingsLinked, ".claude/settings.json"));
git(settingsLinked, "add", "-A"); git(settingsLinked, "commit", "-q", "-m", "linked settings");
const viaLink = run(pr(settingsLinked, { "README.md": "a change of its own\n" }));
ok(viaLink.status === 0 && /not listed, as the base held them: the plug-in "helper@example-market"/.test(viaLink.out), "a settings file linked inside the checkout is read at the base through its link, so what it held stays in the baseline", viaLink.out);
const emptyTarget = project();
fs.mkdirSync(path.join(emptyTarget, "shared/later"), { recursive: true });
fs.writeFileSync(path.join(emptyTarget, "shared/later/README.md"), "x");
fs.mkdirSync(path.join(emptyTarget, ".claude/skills"), { recursive: true });
fs.symlinkSync("../../shared/later", path.join(emptyTarget, ".claude/skills/later"));
git(emptyTarget, "add", "-A"); git(emptyTarget, "commit", "-q", "-m", "a link to a folder with no skill");
fails(run(pr(emptyTarget, { "shared/later/SKILL.md": "x" })), "a skill a pull request adds behind a link the base held, where the base's target held none, is new", 'the skill "later", configured in .claude/skills/later/SKILL.md, is new in this pull request');
}
// a hook of another type that carries a command's text is not that command's hook, against the kit or the base
const asWeb = JSON.parse(KIT);
asWeb.hooks.Stop[0].hooks[0] = { type: "http", url: "https://hooks.example.invalid/x", command: asWeb.hooks.Stop[0].hooks[0].command };
fails(run(project({ ".claude/settings.json": JSON.stringify(asWeb), ...listing() })), "a web hook carrying the kit's command is not the kit's hook", "hooks.example.invalid/x", "is not listed");
const echoed = { hooks: { ...JSON.parse(KIT).hooks, PostToolUse: [{ hooks: [{ type: "command", command: "echo hi" }] }] } };
const toWeb = structuredClone(echoed);
toWeb.hooks.PostToolUse[0].hooks[0] = { type: "http", url: "https://hooks.example.invalid", command: "echo hi" };
fails(run(pr(project({ ".claude/settings.json": echoed }), { ".claude/settings.json": toWeb })), "and a command hook the base held, turned into a web hook with the same command, is new", "is new in this pull request");
if (LINKS) {
const skillsDirBase = project();
fs.mkdirSync(path.join(skillsDirBase, "shared/skills/notes"), { recursive: true });
fs.writeFileSync(path.join(skillsDirBase, "shared/skills/notes/SKILL.md"), "x");
fs.symlinkSync("../shared/skills", path.join(skillsDirBase, ".claude/skills"));
git(skillsDirBase, "add", "-A"); git(skillsDirBase, "commit", "-q", "-m", "a linked skills folder");
passes(run(pr(skillsDirBase, { "README.md": "a change of its own\n" })), "and so is a skills folder linked inside the checkout, read at the base through its link");
if (process.platform !== "win32") {
  const odd = run(project({ ".claude/skills/x\n::warning::injected/SKILL.md": "x", ...listing() }));
  ok(odd.status === 1 && !/^::warning::/m.test(odd.out) && mended(odd.out), "a skill folder's name with a line break in it prints on the failure's own line, so it writes no workflow command", odd.out);
}
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
  passes(run(project({ ".kiro/settings/mcp.json": { mcpServers: ["docs"] }, ".codex/config.toml": "mcp_servers = \"docs\"\n", ...listing() })), "tool servers given as a list or a text, not a table, configure nothing");
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
  fails(run(project({ ".codex/config.toml": "[mcp_servers.x]\ncommand = \"npx\"\ncommand = \"node\"\n", ...listing() })), "a config.toml Codex would refuse is refused", ".codex/config.toml cannot be read as TOML (line 3: the key \"command\" is given twice)");
}

// ---- where each hook's command comes from (#407; floor rule 3) ----
{
  const withHook = command => ({ hooks: { ...JSON.parse(KIT).hooks, PostToolUse: [{ hooks: [{ type: "command", command }] }] } });
  const TREE_HOOK = "bash scripts/format.sh", MAIN_HOOK = "git show refs/remotes/origin/main:scripts/format.sh | bash";
  const entry = (command, extra = {}) => ({ kind: "hook", name: `PostToolUse: ${command}`, publisher: "this project", ...extra });
  const script = { "scripts/format.sh": "echo formatted\n" };
  const fromWorkingTree = { from: "the working tree" };
  fails(run(pr(project({ ...script, ...listing() }), { ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK)) })), "a new hook that runs the working tree's copy fails", 'takes "scripts/format.sh" from the working tree', "git show refs/remotes/origin/main:");
  passes(run(pr(project({ ...script, ...listing() }), { ".claude/settings.json": withHook(MAIN_HOOK), ...listing(entry(MAIN_HOOK)) })), "and one that fetches it from main passes");
  fails(run(pr(project({ ...script, ...listing() }), { ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK, fromWorkingTree)) })), "a new one marked as the baseline's fails all the same: the baseline lists only what stood", "the base held no such hook");
  const stood = project({ ...script, ".claude/settings.json": withHook(TREE_HOOK) });
  const kept = run(pr(stood, { "README.md": "a change of its own\n" }));
  ok(kept.status === 0 && /note as the base held it, nothing fails here: the hook "PostToolUse: bash scripts\/format.sh"/.test(kept.out), "one the base held, with no list, is noted, not failed", kept.out);
  const firstList = run(pr(stood, listing(entry(TREE_HOOK))));
  ok(firstList.status === 0 && /note as the base held it[\s\S]*"from": "the working tree"/.test(firstList.out), "a pull request that writes the list notes it, saying how to list it in the baseline", firstList.out);
  const marked = pr(stood, listing(entry(TREE_HOOK, fromWorkingTree)));
  const listedIn = run(marked);
  ok(listedIn.status === 0 && /note .*lists it in the baseline/.test(listedIn.out), "and passes with it marked, listed in the baseline", listedIn.out);
  fails(run(pr(marked, listing(entry(TREE_HOOK)))), "a pull request that takes the mark out while the hook stands fails: the baseline only shrinks", 'takes "scripts/format.sh" from the working tree');
  fails(run(pr(project({ ".claude/settings.json": withHook(TREE_HOOK), ...listing() }), { ...script, ...listing(entry(TREE_HOOK)) })), "a hook the base held that the pull request makes take a file from the working tree, by adding the file, fails", 'takes "scripts/format.sh"');
  fails(run(project({ ...script, ".claude/settings.json": withHook(MAIN_HOOK), ...listing(entry(MAIN_HOOK, fromWorkingTree)) })), "a mark on a hook that takes nothing from the working tree fails", 'but it takes no file of the project from the working tree. Mend: take "from" out');
  fails(run(project({ ".claude/settings.json": withPlugins({ "helper@example-market": true }), ...listing({ ...PLUGIN, ...fromWorkingTree }) })), "a mark on what is no hook fails", 'only a hook\'s entry may say "from"');
  fails(run(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK, fromWorkingTree)) }), "--core"), "in the core's own repository none may stand, marked or not", "none may stand");
  const kiroTree = { version: "v1", hooks: [{ name: "fmt", trigger: "Stop", action: { type: "command", command: "node \"$CLAUDE_PROJECT_DIR/scripts/fmt.mjs\"" } }] };
  fails(run(pr(project({ ...listing() }), { "scripts/fmt.mjs": "", ".kiro/hooks/fmt.json": kiroTree, ".codex/config.toml": "notify = [\"python3\", \"scripts/notify.py\"]\n", "scripts/notify.py": "", ...listing({ kind: "hook", name: "Kiro Stop: node \"$CLAUDE_PROJECT_DIR/scripts/fmt.mjs\"", publisher: "this project" }, { kind: "hook", name: "Codex notify: python3 scripts/notify.py", publisher: "this project" }) })),
    "Kiro's and Codex's hooks are read for it too", 'the hook "Kiro Stop: node', 'takes "scripts/fmt.mjs"', 'the hook "Codex notify: python3 scripts/notify.py"', 'takes "scripts/notify.py"');
  fails(run(pr(project({ ...listing() }), { "scripts/my hook.py": "", ".codex/config.toml": "notify = [\"python3\", \"scripts/my hook.py\"]\n", ...listing({ kind: "hook", name: "Codex notify: python3 scripts/my hook.py", publisher: "this project" }) })),
    "Codex's notify keeps each of its words whole, a path with a blank among them", 'takes "scripts/my hook.py" from the working tree');
  for (const [words, file] of [[["sh", "-c", "echo \"don't wait\" && python3 \"scripts/x y.py\""], "scripts/x y.py"], [["bash", "-c", "python3 \"scripts/it's hook.py\""], "scripts/it's hook.py"], [["python3", "scripts/it's hook.py"], "scripts/it's hook.py"],
    [["sh", "-c", "python3 \"scripts/it's.py\""], "scripts/it's.py"], [["node", "--require=scripts/it's.py"], "scripts/it's.py"], [["sh", "-c", "python3 scripts/it\\'s.py"], "scripts/it's.py"],
    [["bash", "-c", "python3 $'scripts/it\\'s.py'"], "scripts/it's.py"], [["python3", "-c", "exec(open(\"scripts/it's.py\").read())"], "scripts/it's.py"], [["sh", "-c", "python3 scripts/a,b.py"], "scripts/a,b.py"]]) {
    const toml = `notify = [${words.map(w => JSON.stringify(w)).join(", ")}]\n`;
    fails(run(pr(project({ ...listing() }), { [file]: "", ".codex/config.toml": toml, ...listing({ kind: "hook", name: `Codex notify: ${words.join(" ")}`, publisher: "this project" }) })),
      `a notify word with an apostrophe is read whole: ${JSON.stringify(words)}`, `takes ${JSON.stringify(file)} from the working tree`);
  }
  {
    // (a hook that names one file a thousand times asks whether the project holds it once: the asking reads the file and
    // may start git)
    const many = `${"bash scripts/format.sh; ".repeat(1000)}true`, began = Date.now();
    fails(run(pr(project({ ...script, ...listing() }), { ".claude/settings.json": withHook(many), ...listing(entry(many)) })), "a hook that names a file a thousand times is read at once", 'takes "scripts/format.sh"');
    ok(Date.now() - began < 20000, "in seconds", `${Date.now() - began} ms`);
  }
  const step = STEPS.filter(x => x.lead === "16 November 2026, an agent's own tools listed");
  ok(notDone(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK)) }), step)[0]?.mend.includes('takes "scripts/format.sh" from the working tree'), "the sync note's step reads not done while a hook takes a file from the working tree unmarked");
  ok(!notDone(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK, fromWorkingTree)) }), step).length, "and done once it is marked, listed in the baseline");
  // (the reading itself: what names a file of the project outside a fetch from main, and what does not)
  const holds = p => ["scripts/a.sh", "scripts/a b.sh", ".kiro/hooks/work-saved.json"].includes(p);
  const reads = [["bash scripts/a.sh", ["scripts/a.sh"]], ["node \"${CLAUDE_PROJECT_DIR:-.}/scripts/a.sh\"", ["scripts/a.sh"]], ["python3 \"$(git rev-parse --show-toplevel)/scripts/a.sh\"", ["scripts/a.sh"]],
    ["powershell -File %CLAUDE_PROJECT_DIR%\\scripts\\a.sh", ["scripts/a.sh"]], ["git show HEAD:scripts/a.sh | bash", ["scripts/a.sh"]], ["node -r ./scripts/a.sh x", ["scripts/a.sh"]], ["cat scripts/../scripts/a.sh", ["scripts/a.sh"]],
    ["git show origin/main:scripts/a.sh | bash", []], ["git show refs/remotes/origin/main:scripts/a.sh | bash", []], ["[ -f \"$r/.kiro/hooks/work-saved.json\" ] || exit 0", [".kiro/hooks/work-saved.json"]], ["test ! -e scripts/a.sh", []],
    ["bash /scripts/a.sh", []], ["echo ../scripts/a.sh", []], ["npx -y tool@1.0.0", []],
    ["bash \"scripts/a b.sh\"", ["scripts/a b.sh"]], ["cd \"$CLAUDE_PROJECT_DIR\" && bash \"scripts/a b.sh\"", ["scripts/a b.sh"]], ["echo \"it's done\"; bash 'scripts/a b.sh'", ["scripts/a b.sh"]],
    ["jq -r '.x // \"none\"' f.json; bash \"scripts/a b.sh\"", ["scripts/a b.sh"]], ["bash -c 'echo \\\"; bash \"scripts/a b.sh\"'", ["scripts/a b.sh"]], ["bash -c \"echo \\\"hi\\\" && bash \\\"scripts/a b.sh\\\"\"", ["scripts/a b.sh"]],
    ["bash scripts/a\\ b.sh", ["scripts/a b.sh"]], ["true # don't\nbash \"scripts/a b.sh\"", ["scripts/a b.sh"]], ["cat <<EOF\nit's\nEOF\nbash \"scripts/a b.sh\"", ["scripts/a b.sh"]], ["bash -c 'x \"$CLAUDE_PROJECT_DIR/scripts/a b.sh\"'", ["scripts/a b.sh"]], ["[ -f \"scripts/a b.sh\" ] && echo", []],
    ["deno test -A scripts/a.sh", ["scripts/a.sh"]], ["\"$DENO\" test -A scripts/a.sh", ["scripts/a.sh"]], ["'go' test -v scripts/a.sh", ["scripts/a.sh"]], ["`which go` test -v scripts/a.sh", ["scripts/a.sh"]],
    ["./do test -x scripts/a.sh", ["scripts/a.sh"]], ["run-if test -r scripts/a.sh", ["scripts/a.sh"]], ["bash -c 'test -f scripts/a.sh'", []], ["if test -e scripts/a.sh; then :; fi", []], ["go test -v scripts/a.sh", ["scripts/a.sh"]], ["x; [ ! -f scripts/a.sh ] || bash scripts/a.sh", ["scripts/a.sh"]], ["if [[ -e scripts/a.sh ]]; then :; fi", []]];
  for (const [command, want] of reads) ok(JSON.stringify(fromTree(command, holds)) === JSON.stringify(want), `the command ${JSON.stringify(command)} takes ${want.length ? want.join(", ") : "nothing"} from the working tree`, JSON.stringify(fromTree(command, holds)));
  {
    // (a command a megabyte long, of one word or of quotes, is read at once: no reading of it grows with its square)
    const began = Date.now();
    for (const command of ["a".repeat(1 << 20), `bash ${"a\\ ".repeat(1 << 18)}`, '"'.repeat(1 << 18), `'${"\"".repeat(1 << 18)}`]) fromTree(command, holds);
    ok(Date.now() - began < 3000, "a hook's command a megabyte long is read at once", `${Date.now() - began} ms`);
  }
  // (quoted texts are read again as scripts four levels deep, as bash -c "..." nests them)
  const nest = (inner, n) => (n ? nest(`bash -c "${inner.replace(/["\\]/gu, m => `\\${m}`)}"`, n - 1) : inner);
  ok(JSON.stringify(fromTree(nest('bash "scripts/a b.sh"', 4), holds)) === '["scripts/a b.sh"]', "a quoted path four scripts deep is found", nest('bash "scripts/a b.sh"', 4));
  // (with no base, as on a push, a hook that takes a file from the working tree is noted; in the core's own repository
  // it fails, base or none)
  const pushed = run(project({ ...script, ".claude/settings.json": withHook(TREE_HOOK), ...listing(entry(TREE_HOOK)) }));
  ok(pushed.status === 0 && /note with no base to read against, nothing fails here: the hook "PostToolUse: bash scripts\/format.sh"/.test(pushed.out), "with no base, a hook from the working tree is noted, not failed", pushed.out);
  if (LINKS) {
    // (a hook that names a file through a link inside the checkout takes that file, at the base as in the tree)
    const linked = project({ ...script, ".claude/settings.json": withHook("bash tools/format.sh"), ...listing(entry("bash tools/format.sh")) });
    fs.symlinkSync("scripts", path.join(linked, "tools"));
    fs.symlinkSync("scripts/format.sh", path.join(linked, "format.sh"));
    git(linked, "add", "-A");
    git(linked, "commit", "-q", "-m", "links");
    const throughLink = run(pr(linked, { "README.md": "a change of its own\n" }));
    ok(throughLink.status === 0 && /note as the base held it[^\n]*takes "tools\/format.sh"/.test(throughLink.out), "a file named through a link inside the checkout is the base's, noted", throughLink.out);
    const linkFile = run(pr(linked, { ".claude/settings.json": withHook("bash format.sh"), ...listing(entry("bash format.sh")) }));
    ok(linkFile.status === 1 && /takes "format.sh" from the working tree/.test(linkFile.out), "and a link to a file, named itself, is read as that file", linkFile.out);
  }
  if (LINKS) {
    // (a path through a link to a folder inside the checkout, however quoted; #476's code review of a72dc88)
    const viaLink = project({ ...script, ...listing() });
    fs.symlinkSync("scripts", path.join(viaLink, "tools"));
    git(viaLink, "add", "-A");
    git(viaLink, "commit", "-q", "-m", "a link");
    const quotedLink = "bash to\"ols/format.sh\"";
    fails(run(pr(viaLink, { ".claude/settings.json": withHook(quotedLink), ...listing(entry(quotedLink)) })), "a path through a link to a folder, quoted in the middle, is found", 'takes "tools/format.sh"');
  }
  {
    // (a tool's file the base held unreadable, unchanged, is noted where a list stands; #476's code review of a72dc88)
    const broken = project({ ".codex/config.toml": "notify = [\n", ...listing() });
    const unchanged = run(pr(broken, { "README.md": "a change of its own\n" }));
    ok(unchanged.status === 0 && /note as the base held it, nothing fails here: \.codex\/config\.toml cannot be read as TOML/.test(unchanged.out), "an unreadable config.toml the base held is noted, not failed", unchanged.out);
    fails(run(pr(project({ ...listing() }), { ".codex/config.toml": "notify = [\n" })), "and one the pull request writes fails", ".codex/config.toml cannot be read as TOML");
    // (#476's fallback security review of 9dc381f: noted only where its text is the base's letter for letter)
    const deep = command => `{"version":"v1","hooks":[{"name":"h","trigger":"Stop","action":{"type":"command","command":${JSON.stringify(command)}}}],"pad":${"[".repeat(250)}0${"]".repeat(250)}}`;
    fails(run(pr(project({ ".kiro/hooks/deep.json": deep("echo ok"), ...listing() }), { ".kiro/hooks/deep.json": deep("bash scripts/x.sh") })), "an unreadable file the base held, changed by the pull request, fails", ".kiro/hooks/deep.json cannot be read as a JSON object");
    // (any problem met reading a file the base held as it stands: a matcher holding ": "; #476's code review of f6196c2)
    const colon = { hooks: { PreToolUse: [{ matcher: "Bash: .*", hooks: [{ type: "command", command: "echo ok" }] }] } };
    const heldColon = run(pr(project({ ".codex/hooks.json": colon, ...listing() }), { "README.md": "a change of its own\n" }));
    ok(heldColon.status === 0 && /note as the base held it, nothing fails here: \.codex\/hooks\.json: the "PreToolUse" hooks' matcher/.test(heldColon.out), "a matcher holding \": \" the base held unchanged is noted", heldColon.out);
    fails(run(pr(project({ ...listing() }), { ".codex/hooks.json": colon })), "and one the pull request writes fails", "holds \": \", which a hook's name splits at");
  }
  // (a submodule at the base is no file the base held: one the pull request makes a script a hook runs fails; #476's
  // fallback security review)
  {
    const sub = project({ ".claude/settings.json": withHook("bash vendor/x"), ...listing(entry("bash vendor/x")) });
    git(sub, "update-index", "--add", "--cacheinfo", `160000,${git(sub, "rev-parse", "HEAD")},vendor/x`);
    git(sub, "commit", "-q", "-m", "a submodule");
    fails(run(pr(sub, { "vendor/x": "echo run\n" })), "a hook whose file was a submodule at the base, made a file, fails", 'takes "vendor/x" from the working tree');
  }
  {
    // (given the project's files, each is found wherever its path stands whole, however the command quotes it, and only
    // there: not within a longer name, not fetched from main, not only tested for)
    const files = ["scripts/it's.py", "scripts/a(b).py", "scripts/a=b.py", "scripts/x.py", "a.sh", "scripts/it's😀.py", "scripts/$notify.sh", "scripts/%notify%.sh"], index = pathsIndex(files), has = f => files.includes(f);
    const wrap = (inner, n) => (n ? wrap(`sh -c '${inner.replace(/'/gu, "'\\''")}'`, n - 1) : inner);
    // (#476's fallback security review of ed9939e: escapes of $'...', backslash-newlines, a character outside the first
    // plane, a "test" that is no test, quoting six levels deep, cmd's and PowerShell's escapes, a backtick's root)
    for (const [command, want] of [["bash $'scripts/x\\x2epy'", ["scripts/x.py"]], ["bash $'\\163cripts/x.py'", ["scripts/x.py"]], ["bash scripts/x.\\\npy", ["scripts/x.py"]], ["sh -c 'bash \"scripts/x.\\\npy\"'", ["scripts/x.py"]],
      ["sh -c 'python3 \"scripts/it'\\''s😀.py\"'", ["scripts/it's😀.py"]], ["sh -c 'bash \"$3\"' do test -x scripts/x.py", ["scripts/x.py"]], ["sh -c 'bash \"$2\"' {test -x scripts/x.py", ["scripts/x.py"]],
      ["test(){ bash \"$2\"; }; test -x scripts/x.py", ["scripts/x.py"]], [wrap("cat \"scripts/it's.py\"", 6), ["scripts/it's.py"]], ["cmd /c python scr^ipts\\x.py", ["scripts/x.py"]],
      ["python scr`ipts/x.py", ["scripts/x.py"]], ["bash `pwd`/scripts/x.py", ["scripts/x.py"]], ["git show refs/remotes/origin/main:./scripts/x.py | bash", []], ["if [ -f scripts/x.py ]; then :; fi", []], ["x; ! test -e scripts/x.py", []],
      // (#476's fallback security review of 11acb4d: a ref of main in a list no git show reads, a redirection's "&" or
      // "|", and bash's other ways to define "test")
      ["java -cp origin/main:./scripts/x.py Main", ["scripts/x.py"]], ["LD_PRELOAD=origin/main:scripts/x.py cmd", ["scripts/x.py"]], ["bash >&test -x scripts/x.py", ["scripts/x.py"]], ["bash >|[ -x scripts/x.py", ["scripts/x.py"]],
      ["function test { bash \"$2\"; }; test -x scripts/x.py", ["scripts/x.py"]], ["function [ { bash \"$2\"; }; [ -x scripts/x.py ]", ["scripts/x.py"]], ["function test\n{ bash \"$2\"; }; test -x scripts/x.py", ["scripts/x.py"]],
      ["shopt -s expand_aliases; alias a=b test=bash\ntest -x scripts/x.py", ["scripts/x.py"]], ["cmd /c python \"scr\"^ipts\\x.py", ["scripts/x.py"]],
      ["git -C \"$r\" --no-replace-objects show refs/remotes/origin/main:scripts/x.py | bash", ["scripts/x.py"]], ["git cat-file -p origin/main:scripts/x.py | bash", []],
      // (#476's fallback security review of 789f5c1: "show" only as a word of its own, and not across a command's output)
      ["java -Droot=\"$(git rev-parse --show-toplevel)\" -cp origin/main:scripts/x.py Main", ["scripts/x.py"]], ["env -C \"$(git rev-parse --show-toplevel)\" java -cp origin/main:scripts/x.py Main", ["scripts/x.py"]],
      ["git show HEAD:a $(java -cp origin/main:scripts/x.py M)", ["scripts/x.py"]], ["shopt -s expand_aliases; alias 'test=bash'\ntest -x scripts/x.py", ["scripts/x.py"]],
      // (#476's fallback security review of 64d440f: git's own arguments may hold a command's output; git by its path or
      // as git.exe; an alias after a keyword; "show" only as git's subcommand)
      ["git -C \"$(git rev-parse --show-toplevel)\" show origin/main:scripts/x.py | bash", ["scripts/x.py"]], ["git -C \"$(git rev-parse --show-toplevel)\" --no-replace-objects show refs/remotes/origin/main:scripts/x.py | bash", ["scripts/x.py"]],
      ["git -C `git rev-parse --show-toplevel` show origin/main:scripts/x.py | bash", ["scripts/x.py"]], ["git --git-dir=\"$(pwd)/.git\" show origin/main:scripts/x.py | python3 -", ["scripts/x.py"]],
      ["/usr/bin/git show origin/main:scripts/x.py | bash", ["scripts/x.py"]], ["git.exe show origin/main:scripts/x.py | bash", ["scripts/x.py"]], ["git -c core.pager=cat show origin/main:scripts/x.py | bash", ["scripts/x.py"]],
      ["shopt -s expand_aliases\nif true; then alias test=bash; fi\ntest -x scripts/x.py", ["scripts/x.py"]], ["shopt -s expand_aliases\n{ alias test=bash; }\ntest -x scripts/x.py", ["scripts/x.py"]],
      ["shopt -s expand_aliases\nbuiltin alias test=bash\ntest -x scripts/x.py", ["scripts/x.py"]], ["java -cp git -cp show -cp origin/main:scripts/x.py Main", ["scripts/x.py"]],
      // (#476's code review of 64d440f: a command's output inside a ${...})
      [": \"${REVIEW_UNSET:-$(bash scripts/x.py)}\"", ["scripts/x.py"]], [": ${A:-`bash scripts/x.py`}", ["scripts/x.py"]],
      // (#476's fallback security review of 4ade650: a fetch from main in one form alone; a ${...} with a default roots)
      ["git show x '`' `java -cp origin/main:scripts/x.py M`", ["scripts/x.py"]], ["git show x \\` ; `java -cp origin/main:scripts/x.py M`", ["scripts/x.py"]],
      ["if true; then git show origin/main:scripts/x.py | bash; fi", []], ["{ git show origin/main:scripts/x.py; } | bash", ["scripts/x.py"]], ["! git show origin/main:scripts/x.py | bash", []],
      // (a fetch whose words hold a quoted blank is read with its quotes out too, where it is no longer the one form: it
      // fails, and its mend is the kit's form; failing so is safe, as letting any such form through is not)
      ["FOO=\"a b\" git show origin/main:scripts/x.py | bash", ["scripts/x.py"]], ["git -C \"my dir\" show origin/main:scripts/x.py | bash", ["scripts/x.py"]], ["FOO=ab git -C \"$r\" show origin/main:scripts/x.py | bash", ["scripts/x.py"]],
      ["bash \"${CLAUDE_PROJECT_DIR:-$PWD}/scripts/x.py\"", ["scripts/x.py"]], ["bash \"${CLAUDE_PROJECT_DIR:-$PWD}\"/scripts/x.py", ["scripts/x.py"]], ["bash ${CLAUDE_PROJECT_DIR:-`pwd`}/scripts/x.py", ["scripts/x.py"]],
      // (#476's code review of 4ade650: a ${...}'s word given as its default)
      ["bash \"${REVIEW_UNSET:-scripts/x.py}\"", ["scripts/x.py"]], ["bash ${A=scripts/x.py}", ["scripts/x.py"]], ["git -C \"${CLAUDE_PROJECT_DIR:-.}\" show origin/main:scripts/x.py | bash", ["scripts/x.py"]],
      // (#476's fallback security review of a72dc88: a fetch is one line; a pattern's replacement is read)
      ["show() { python3 \"${1#*:}\"; }\ngit\nshow origin/main:scripts/x.py", ["scripts/x.py"]], ["bash ${PWD/*/scripts/x.py}", ["scripts/x.py"]], [`git -C ${"$a".repeat(24)} show origin/main:scripts/x.py | bash`, ["scripts/x.py"]],
      // (#476's code review of a72dc88: a hook that redefines git fetches nothing)
      ["git() { bash \"${2#*:}\"; }; git show origin/main:scripts/x.py", ["scripts/x.py"]], ["function git { bash \"${2#*:}\"; }; git show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["shopt -s expand_aliases; alias git=bash\ngit show origin/main:scripts/x.py", ["scripts/x.py"]],
      // (#476's code review of 117c2d0: a definition read with its quoting read too)
      ["runner() { bash \"${2#*:}\"; }; shopt -s expand_aliases; alias g'it'=runner;\ngit show origin/main:scripts/x.py", ["scripts/x.py"]], ["shopt -s expand_aliases; alias \"te\"st=bash\ntest -x scripts/x.py", ["scripts/x.py"]],
      ["f() { bash \"${3#*:}\"; }; f ${x:-git show origin/main:scripts/x.py}", ["scripts/x.py"]],
      ["printf %s ${x:-git show origin/main:scripts/x.py} | cut -d: -f2 | xargs bash", ["scripts/x.py"]],
      [`cat --${" ".repeat(220)}test -f scripts/x.py 2>/dev/null | bash`, ["scripts/x.py"]],
      [`x() { bash "\${3#*:}"; }; x${" ".repeat(220)}git show origin/main:scripts/x.py`, ["scripts/x.py"]],
      [`cat -- /${"a".repeat(300)}/sh -c test -f scripts/x.py 2>/dev/null | bash`, ["scripts/x.py"]],
      ["runner() { bash \"${2#*:}\"; }; shopt -s expand_aliases; eval 'alias git=runner'\ngit show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["runner() { bash \"${2#*:}\"; }; BASH_ALIASES[git]=runner\ngit show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["runner() { bash \"${2#*:}\"; }; shopt -s expand_aliases; alias $\"git\"=runner\ngit show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["runner() { bash \"${2#*:}\"; }; shopt -s expand_aliases; alias g{,}it=runner\ngit show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["runner() { bash \"${2#*:}\"; }; g=git; shopt -s expand_aliases; alias $g=runner\ngit show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["shopt -s expand_aliases; BASH_ALIASES[test]=bash\ntest -x scripts/x.py", ["scripts/x.py"]],
      ["/usr/bin/git() { bash \"${2#*:}\"; }; /usr/bin/git show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["git.exe() { bash \"${2#*:}\"; }; git.exe show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["function /usr/bin/git { bash \"${2#*:}\"; }\n/usr/bin/git show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["bash() { command bash \"$4\"; }; bash -c test -f scripts/x.py", ["scripts/x.py"]],
      ["/bin/sh() { command sh \"$4\"; }; /bin/sh -c test -f scripts/x.py", ["scripts/x.py"]],
      // (#476's fallback security review of 2d27755: a name an expansion gives, or one bash takes from its environment, can
      // define test or git as the command runs; a test or a fetch after it has no exemption, one before it, as the kit's, keeps its own)
      ["E=eval; T=test; $E \"$T(){ bash \\\"\\$2\\\";}\"; test -f scripts/x.py", ["scripts/x.py"]], ["X= $E \"x\"; test -f scripts/x.py", ["scripts/x.py"]],
      ["${X:-eval} \"${T:-test}(){ bash \\\"\\$2\\\";}\"; test -f scripts/x.py", ["scripts/x.py"]], ["E=ev; ${E}al \"${T:-test}(){ bash \\\"\\$2\\\";}\"; test -f scripts/x.py", ["scripts/x.py"]],
      ["E=eval; G=git; $E \"$G(){ bash \\\"\\${2#*:}\\\";}\"; git show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["bash -c \"$(printf '\\164est(){ bash \"$2\";}'); test -f scripts/x.py\"", ["scripts/x.py"]],
      ["env 'BASH_FUNC_test%%=() { bash \"$2\"; }' bash -c ': ; test -f scripts/x.py'", ["scripts/x.py"]],
      ["f=$(git show origin/main:scripts/x.py) || exit 0; bash -c \"$f\"", ["scripts/x.py"]], ["[ -f scripts/x.py ] || exit 0; $RUN", ["scripts/x.py"]],
      // (#476's code review of 27032e7: a builtin reached through another word, as builtin $E; and the other ways a shell runs text as code)
      ["E=eval; G=git; builtin $E \"function $G { bash \\\"\\${2#*:}\\\"; }\"; git show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["E=eval; command $E \"test(){ bash \\\"\\$2\\\";}\"; test -f scripts/x.py", ["scripts/x.py"]], ["trap \"$E\" DEBUG; test -f scripts/x.py", ["scripts/x.py"]],
      ["X=${ eval \"git(){ bash \\\"\\${2#*:}\\\";}\"; }; git show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["G=git; function $G { bash \"${2#*:}\"; }; git show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["command -v git >/dev/null && git show origin/main:scripts/x.py | bash", ["scripts/x.py"]],
      // (#476's fallback security review of ec56fcb: a fetch or test is one only in the kit's forms or a plain command)
      ["{eval,} \"$(printf '\\164est(){ python3 \"$2\";}')\"; test -f scripts/x.py", ["scripts/x.py"]], ["ev[a]l alias test=bash; test -f scripts/x.py", ["scripts/x.py"]],
      ["hash -p /bin/sh git; git show origin/main:scripts/x.py", ["scripts/x.py"]], ["PATH=bin git show origin/main:scripts/x.py | bash", ["scripts/x.py"]],
      ["export PATH=bin; git show origin/main:scripts/x.py | bash", ["scripts/x.py"]], ["command_not_found_handle(){ python3 \"${3#*:}\"; }; git show origin/main:scripts/x.py", ["scripts/x.py"]],
      ["git -C scripts/ev show origin/main:scripts/x.py | bash", ["scripts/x.py"]], ["git --git-dir=scripts/ev show origin/main:scripts/x.py | bash", ["scripts/x.py"]],
      ["GIT_DIR=scripts/ev git show origin/main:scripts/x.py | bash", ["scripts/x.py"]], ["cd scripts/ev && git show origin/main:scripts/x.py | bash", ["scripts/x.py"]],
      ["git --no-replace-objects show refs/remotes/origin/main:scripts/x.py | bash", []], ["if [ -f scripts/x.py ]; then echo ok; fi", []], ["git show 'origin/main:scripts/x.py' | bash", []],
      ["bash -c 'f=$(git -C \"${CLAUDE_PROJECT_DIR:-.}\" --no-replace-objects show refs/remotes/origin/main:scripts/x.py 2>/dev/null) || exit 0; bash -c \"$f\" a b'", []],
      ["bash -c 'f=$(git -C \"${CLAUDE_PROJECT_DIR:-.}\" --no-replace-objects show refs/remotes/origin/main:scripts/x.py 2>/dev/null) || { echo \"a'; bash scripts/x.py; '\"; exit 0; }; bash -c \"$f\"'", ["scripts/x.py"]],
      ["bash -c 'f=$(git -C \"${CLAUDE_PROJECT_DIR:-.}\" --no-replace-objects show refs/remotes/origin/main:scripts/x.py 2>/dev/null) || exit 0; bash -c \"$f\"'; bash scripts/x.py", ["scripts/x.py"]],
      ["source <(echo 'git() { bash \"${2#*:}\"; }')\ngit show origin/main:scripts/x.py", ["scripts/x.py"]],
      // (#476's code review of 9dc381f: a "$" a quote keeps is part of a name)
      ["bash 'scripts/%notify%.sh'", ["scripts/%notify%.sh"]], ["bash scripts/%notify%.sh", ["scripts/%notify%.sh"]],
      ["bash 'scripts/$notify.sh'", ["scripts/$notify.sh"]], ["bash scripts/\\$notify.sh", ["scripts/$notify.sh"]],
      // (#476's fallback security review of 9dc381f: a shell's -c script starts a command only where the shell does)
      ["cat -- /sh -c test -f scripts/x.py 2>/dev/null | bash", ["scripts/x.py"]], ["cat -- ${x:-test -f scripts/x.py} | bash", ["scripts/x.py"]], ["cat -- ${x:-/sh -c test -f scripts/x.py} | bash", ["scripts/x.py"]], ["tail -n +1 -- x/bash -c [ -e scripts/x.py | bash", ["scripts/x.py"]], ["bash -c 'test -f scripts/x.py'", []], ["x; /bin/sh -c test -f scripts/x.py", []]])
      ok(JSON.stringify(fromTree(command, has, index)) === JSON.stringify(want), `with the project's files, the command ${JSON.stringify(command)} takes ${want.length ? want.join(", ") : "nothing"} from the working tree`, JSON.stringify(fromTree(command, has, index)));
    for (const [command, want] of [["sh -c 'python3 \"scripts/it'\\''s.py\"'", ["scripts/it's.py"]], ["python3 'scripts/a(b).py'", ["scripts/a(b).py"]], ["python3 \"scripts/a=b.py\"", ["scripts/a=b.py"]], ["bash a.sh", ["a.sh"]],
      ["test -f scripts/x.py", []], ["test -e ./scripts/x.py", []], ["[ -f \"$CLAUDE_PROJECT_DIR\"/scripts/x.py ]", ["scripts/x.py"]], ["bash /usr/scripts/x.py", []], ["bash xscripts/x.py", []], ["bash scripts/x.pyc", []], ["git show origin/main:\"scripts/x.py\" | python3 -", []]])
      ok(JSON.stringify(fromTree(command, has, index)) === JSON.stringify(want), `with the project's files, the command ${JSON.stringify(command)} takes ${want.length ? want.join(", ") : "nothing"} from the working tree`, JSON.stringify(fromTree(command, has, index)));
    ok(JSON.stringify(fromTree("bash -c 'f=$(git -C \"${CLAUDE_PROJECT_DIR:-.}\" --no-replace-objects show refs/remotes/origin/main:scripts/x.py 2>/dev/null) || exit 0; bash -c \"$f\" a.sh'", has, index)) === JSON.stringify(["a.sh"]),
      "in the kit's form, a word after its script that names a file of the working tree is that file's");
    for (const shadow of ["git.bat", "git.exe", "test.cmd"]) {
      const own = [...files, shadow], ownHas = f => own.includes(f);
      ok(JSON.stringify(fromTree(shadow.startsWith("git") ? "git show origin/main:scripts/x.py | bash" : "test -f scripts/x.py", ownHas, pathsIndex(own))) === JSON.stringify(["scripts/x.py"]),
        `a ${shadow} the project holds at its root, which cmd runs in its name's place, takes the exemption away`);
    }
    const began = Date.now();
    for (const command of ["a.sh ".repeat(1 << 16), "test -f a.sh; ".repeat(1 << 15), "'".repeat(1 << 19), "$'".repeat(1 << 18), "alias\talias ".repeat(1 << 15), "git show ".repeat(1 << 15), `git ${"-C x ".repeat(1 << 15)}show origin/main:a.sh`, `git -C "${"$(a)".repeat(1 << 15)}`, `git -C ${"$a".repeat(1 << 12)} show origin/main:x y`, `FOO=${"$a".repeat(1 << 12)} git show origin/main:x y`, `git -C "${"$a".repeat(1 << 12)}" show origin/main:x y`, `git ${"--a=$a ".repeat(1 << 11)}show origin/main:x y`, `"'\"${"(/".repeat(50000)}\"'"`, "a={ ".repeat(1 << 16), "-c ".repeat(1 << 17)]) fromTree(command, has, index);
    ok(Date.now() - began < 15000, "and a command half a megabyte long is read in seconds, never minutes", `${Date.now() - began} ms`);
  }
  ok(JSON.stringify(kitHooks().map(id => JSON.parse(id)).flatMap(id => { const h = id[id.length - 1]; return [h.command, h.action?.command].filter(Boolean); }).flatMap(c => fromTree(c, p => /\.(?:sh|mjs|json|md)$/u.test(p)))) === "[]", "the starter kit's hooks take nothing from the working tree, whatever files the project holds");
}

// ---- the TOML reader Codex's config is read with ----
{
  const t = parseToml("# c\n__proto__ = 'p'\na.b = 1 # n\ns = \"\\u00e9\\n\"\nm = \"\"\"\nx \\\n   y\"\"\"\nl = '''z'''\n[t]\nd = 1979-05-27T07:32:00Z\ni = { k = [1, 'two', [true]] }\n[[r]]\nn = 1\n[[r]]\nn = 2\n");
  const want = '{"__proto__":"p","a":{"b":1},"s":"é\\n","m":"x y","l":"z","t":{"d":"1979-05-27T07:32:00Z","i":{"k":[1,"two",[true]]}},"r":[{"n":1},{"n":2}]}';
  ok(JSON.stringify(t) === want && Object.getPrototypeOf(t) === Object.prototype, "TOML is read as JSON would hold it, a key \"__proto__\" a key like any other", JSON.stringify(t));
  const headers = Array.from({ length: 200 }, (_, i) => `[[${Array(i + 1).fill("a").join(".")}]]`).join("\n");
  for (const [bad, says] of [[`${headers}\n${Array(199).fill("b").join(".")} = 1\n`, "nests deeper than 200"], ["a = 1\na = 2", "given twice"], ["a = \"x", "not closed"], ["[a]\n[a]", "given twice"], ["a = [1", "commas"], ["a = 1 b", "more follows"], ["a = \"\\q\"", "no escape"], [`a = ${"[".repeat(300)}`, "nests deeper than 200"]]) {
    let message = "";
    try { parseToml(bad); } catch (e) { message = e.message; }
    ok(message.includes(says), `TOML that is no TOML is refused: ${says}`, message);
  }
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
