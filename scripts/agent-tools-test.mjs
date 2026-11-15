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
import { STEPS, notDone } from "./steps.mjs";

const SCRIPT = fileURLToPath(new URL("./agent-tools.mjs", import.meta.url));
const KIT = fs.readFileSync(fileURLToPath(new URL("../setup/template/claude-settings.json.tmpl", import.meta.url)), "utf8");
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
const kitIds = kitHooks().map(id => JSON.parse(id));
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

for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
