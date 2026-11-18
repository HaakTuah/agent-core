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
import { kitHooks, listed } from "../scripts/agent-tools.mjs";
import { kitForm } from "../scripts/hook-source.mjs";
import { mended } from "../scripts/mend.mjs";
import { STEPS, notDone } from "../scripts/steps.mjs";
import { parseToml } from "../scripts/toml.mjs";

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
fs.cpSync(path.join(HERE, "third-party"), path.join(synced, "core/third-party"), { recursive: true });
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
  if (LINKS) {
    // (#476's code review of adeba79: a folder linked to the checkout's root is read at the base as in the tree, so a hook it held stands)
    const rootLinked = project({ "lint.json": kiroHook("npx eslint@9.0.0 --fix"), ...listing() });
    fs.mkdirSync(path.join(rootLinked, ".kiro"), { recursive: true });
    fs.symlinkSync("..", path.join(rootLinked, ".kiro/hooks"));
    git(rootLinked, "add", "-A"); git(rootLinked, "commit", "-q", "-m", "hooks at the root");
    const rootKept = run(pr(rootLinked, { "README.md": "a change of its own\n" }));
    ok(rootKept.status === 0 && /nothing fails here: the hook "Kiro PostFileSave/.test(rootKept.out), "a hook under a folder linked to the checkout's root, the base's, is noted, not failed", rootKept.out);
    // (#476's code review of b786c88: a link's ".." steps back from where the links before it led, as the file system walks it)
    const walked = project({ "config/sub/keep.md": "", "config/hooks/lint.json": kiroHook("npx eslint@9.0.0 --fix"), "hooks/other.md": "", ...listing() });
    fs.mkdirSync(path.join(walked, ".kiro"), { recursive: true });
    fs.symlinkSync("config/sub", path.join(walked, "tools"));
    fs.symlinkSync("../tools/../hooks", path.join(walked, ".kiro/hooks"));
    git(walked, "add", "-A"); git(walked, "commit", "-q", "-m", "hooks through two links");
    const walkedKept = run(pr(walked, { "README.md": "a change of its own\n" }));
    ok(walkedKept.status === 0 && /nothing fails here: the hook "Kiro PostFileSave/.test(walkedKept.out), "a hook under a link whose \"..\" follows the links before it, the base's, is noted, not failed", walkedKept.out);
    // (#476's code review of 56c2716: a file on a link's way is no folder, so ".." after it leads nowhere, as in the tree)
    const blocked = project({ "blocker": "a file\n", "hooks/lint.json": kiroHook("bash scripts/run.sh"), "scripts/run.sh": "", ...listing() });
    fs.mkdirSync(path.join(blocked, ".kiro"), { recursive: true });
    fs.symlinkSync("../blocker/../hooks", path.join(blocked, ".kiro/hooks"));
    git(blocked, "add", "-A"); git(blocked, "commit", "-q", "-m", "a link through a file");
    git(blocked, "checkout", "-q", "-B", "change");
    fs.unlinkSync(path.join(blocked, ".kiro/hooks"));
    fs.symlinkSync("../hooks", path.join(blocked, ".kiro/hooks"));
    git(blocked, "add", "-A"); git(blocked, "commit", "-q", "-m", "the link mended");
    git(blocked, "checkout", "-q", "main"); git(blocked, "merge", "-q", "--no-ff", "-m", "merge", "change");
    fails(run(blocked), "a hook a link turns on, where the base's link went through a file and so led nowhere, is new", 'the hook "Kiro PostFileSave');
    // (#476's code review of 9a2907b: a folder reached through nine links is read at the base as in the tree, which follows forty)
    const chained = project({ "hooks/lint.json": kiroHook("npx eslint@9.0.0 --fix"), ...listing() });
    fs.symlinkSync("hooks", path.join(chained, "l1"));
    for (let i = 2; i <= 8; i++) fs.symlinkSync(`l${i - 1}`, path.join(chained, `l${i}`));
    fs.mkdirSync(path.join(chained, ".kiro"), { recursive: true });
    fs.symlinkSync("../l8", path.join(chained, ".kiro/hooks"));
    git(chained, "add", "-A"); git(chained, "commit", "-q", "-m", "hooks through nine links");
    const chainedKept = run(pr(chained, { "README.md": "a change of its own\n" }));
    ok(chainedKept.status === 0 && /nothing fails here: the hook "Kiro PostFileSave/.test(chainedKept.out), "a hook under a folder reached through nine links, the base's, is noted, not failed", chainedKept.out);
  }
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
  fails(run(project({ ".codex/config.toml": "[mcp_servers.x]\ncommand = \"npx\"\ncommand = \"node\"\n", ...listing() })), "a config.toml Codex would refuse is refused", ".codex/config.toml cannot be read as TOML (line 3: the key \"command\" is given twice)");
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
  if (LINKS) {
    // (a link below a folder of agents or commands fails, and is held by all it leads to; links back to their own folder
    // are read once, not followed)
    const LINKED = "is a link below a folder of Claude Code's agents or commands";
    const looped = () => { const dir = project({ ...script, ".claude/agents/rev.md": "---\nname: rev\n---\n", "elsewhere/x.md": "---\nname: x\n---\n", ...listing() }); for (let i = 0; i < 6; i++) fs.symlinkSync(".", path.join(dir, `.claude/agents/l${i}`)); fs.symlinkSync("../../elsewhere", path.join(dir, ".claude/agents/out")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "links below agents"); return dir; };
    const started = Date.now(), loopedNew = run(looped(), "--core");
    ok(loopedNew.status === 1 && loopedNew.out.includes(LINKED) && Date.now() - started < 30000, "links below a folder of agents fail, read once each, in seconds", loopedNew.out);
    const loopedKept = run(pr(looped(), { "README.md": "x\n" }));
    ok(loopedKept.status === 0 && loopedKept.out.includes(LINKED), "one the base held is noted", loopedKept.out);
    fails(run(pr(looped(), { "elsewhere/x.md": `---\nname: x\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n` })), "but not once what it leads to changes", LINKED);
    // (#647's fallback security review of e5a319d: a link reached through another link is read and failed as well, a loop
    // reached so is walked once, and a link below agents into an installed package is held by what an install reads)
    const viaDocs = () => { const dir = project({ ...script, "docs/a.md": "---\nname: a\n---\n", "evil/x.md": `---\nname: x\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`, ...listing() }); fs.symlinkSync("../docs", path.join(dir, ".claude/agents")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "agents through a link"); return dir; };
    const subAdded = viaDocs();
    git(subAdded, "checkout", "-q", "-B", "change"); fs.symlinkSync("../evil", path.join(subAdded, "docs/sub"));
    git(subAdded, "add", "-A"); git(subAdded, "commit", "-q", "-m", "a link"); git(subAdded, "checkout", "-q", "main"); git(subAdded, "merge", "-q", "--no-ff", "-m", "merge", "change");
    const WAY = "is a link on the way to a folder of Claude Code's agents or commands";
    fails(run(subAdded), "a link added in the folder agents lead to through a link fails, as that link is held by all it leads to", WAY);
    const loops = viaDocs();
    for (let i = 0; i < 6; i++) fs.symlinkSync(".", path.join(loops, `docs/l${i}`));
    git(loops, "add", "-A"); git(loops, "commit", "-q", "-m", "loops behind a link");
    const loopsStarted = Date.now(), loopsKept = run(pr(loops, { "README.md": "x\n" }));
    ok(loopsKept.status === 0 && loopsKept.out.includes(WAY) && Date.now() - loopsStarted < 30000, "loops of links behind a link are never walked, and the link the base held is noted", loopsKept.out);
    const agentPkg = () => { const dir = project({ ...script, ".gitignore": "node_modules/\n", "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/pkg": { version: "1.0.0" } } }), ...listing() }); fs.mkdirSync(path.join(dir, ".claude/agents"), { recursive: true }); fs.symlinkSync("../../node_modules/pkg/agents", path.join(dir, ".claude/agents/pkg")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "agents from a package"); return dir; };
    fails(run(pr(agentPkg(), { "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/pkg": { version: "6.6.6" } } }) })), "a link the base held below agents into an installed package fails once its lock changes", LINKED);
    // (Codex's code review of 872cc8d: and so does one reached through another link the base held)
    const nestedPkg = viaDocs();
    fs.writeFileSync(path.join(nestedPkg, ".gitignore"), "node_modules/\n"); fs.writeFileSync(path.join(nestedPkg, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/pkg": { version: "1.0.0" } } }));
    fs.symlinkSync("../node_modules/pkg/agents", path.join(nestedPkg, "docs/pkg")); git(nestedPkg, "add", "-A"); git(nestedPkg, "commit", "-q", "-m", "a package's agents behind a link");
    fails(run(pr(nestedPkg, { "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/pkg": { version: "6.6.6" } } }) })), "and so does one reached through another link the base held, once its lock changes", WAY);
    // (its fallback security review of cd32eb7: and once a workspace member's package.json changes, as an install puts
    // that member's packages in the node_modules the link leads into; while many such links, nothing changed, are read in
    // seconds, each folder's install files once)
    const memberPkg = viaDocs();
    fs.writeFileSync(path.join(memberPkg, ".gitignore"), "node_modules/\n"); fs.writeFileSync(path.join(memberPkg, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    fs.mkdirSync(path.join(memberPkg, "packages/w"), { recursive: true }); fs.writeFileSync(path.join(memberPkg, "packages/w/package.json"), JSON.stringify({ name: "w" }));
    fs.symlinkSync("../node_modules/pkg/agents", path.join(memberPkg, "docs/pkg")); git(memberPkg, "add", "-A"); git(memberPkg, "commit", "-q", "-m", "a package's agents behind a link, in a workspace");
    fails(run(pr(memberPkg, { "packages/w/package.json": JSON.stringify({ name: "w", dependencies: { pkg: "1.0.0" } }) })), "and so does one whose workspace member's package.json changes", WAY);
    const manyPkg = viaDocs();
    fs.writeFileSync(path.join(manyPkg, ".gitignore"), "node_modules/\n"); fs.writeFileSync(path.join(manyPkg, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));
    for (let i = 0; i < 300; i++) fs.symlinkSync("../node_modules/pkg/agents", path.join(manyPkg, `docs/l${i}`));
    git(manyPkg, "add", "-A"); git(manyPkg, "commit", "-q", "-m", "many links into a package");
    for (let i = 0; i < 400; i++) { fs.mkdirSync(path.join(manyPkg, `fx/f${i}`), { recursive: true }); fs.writeFileSync(path.join(manyPkg, `fx/f${i}/package.json`), "{}\n"); }
    git(manyPkg, "add", "-A"); git(manyPkg, "commit", "-q", "-m", "and many packages");
    const manyStarted = Date.now(), manyKept = run(pr(manyPkg, { "README.md": "x\n" }));
    ok(manyKept.status === 0 && manyKept.out.includes(WAY) && Date.now() - manyStarted < 30000, "while 300 such links the base held, beside 400 packages, nothing changed, are noted in seconds", `${Date.now() - manyStarted} ms\n${manyKept.out.slice(0, 2000)}`);
    // (#647's fallback security review of 90bcf1a: a folder of agents or commands that is a link out of the checkout fails
    // as any such link does; a folder in another case a link reaches first is still read for its case; and a hook is named
    // by the path Claude Code reads it at)
    const linkAdded = (target, at) => { const dir = project({ ...script, ".gitignore": "node_modules/\n", ...listing() }); git(dir, "checkout", "-q", "-B", "change"); fs.mkdirSync(path.dirname(path.join(dir, at)), { recursive: true }); fs.symlinkSync(target, path.join(dir, at)); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link"); git(dir, "checkout", "-q", "main"); git(dir, "merge", "-q", "--no-ff", "-m", "merge", "change"); return dir; };
    fails(run(linkAdded("../node_modules/pkg/agents", ".claude/agents")), "a folder of agents that is a link into an installed package fails", '".claude/agents" is a link that leads out of the checkout');
    fails(run(linkAdded("../../outside-commands", ".claude/commands")), "and so does a folder of commands that is a link out of the checkout", '".claude/commands" is a link that leads out of the checkout');
    const hooksDir = project({ ...script, ".kiro/Hooks/x.json": JSON.stringify({ hooks: [{ name: "x", trigger: "Stop", action: { type: "command", command: "bash x.sh" } }] }), ...listing() });
    fs.symlinkSync("../.kiro/Hooks", path.join(hooksDir, ".claude/agents")); git(hooksDir, "add", "-A"); git(hooksDir, "commit", "-q", "-m", "agents to a folder in another case");
    fails(run(hooksDir, "--core"), "a tool's folder in another case is read for its case, though a link below agents reaches it first", ".kiro/Hooks is .kiro/hooks in another case");
    const namedAt = project({ ...script, "docs/x.md": `---\nname: x\nhooks:\n  Stop:\n    - hooks:\n${HOOKS}\n---\n`, ...listing() });
    fs.symlinkSync("../docs", path.join(namedAt, ".claude/agents")); git(namedAt, "add", "-A"); git(namedAt, "commit", "-q", "-m", "agents through a link");
    fails(run(namedAt, "--core"), "a folder of agents that is a link inside the checkout fails, nothing read through it", WAY, "Mend: replace it with the folder itself");
    const claudeLinked = project({ "cfg/settings.json": KIT, "cfg/agents/x.md": "---\nname: x\n---\n", ...listing() });
    fs.rmSync(path.join(claudeLinked, ".claude"), { recursive: true, force: true }); fs.symlinkSync("cfg", path.join(claudeLinked, ".claude")); git(claudeLinked, "add", "-A"); git(claudeLinked, "commit", "-q", "-m", "a .claude through a link");
    fails(run(claudeLinked, "--core"), "and so does .claude as a link, where the agents are reached through it", '.claude is a link on the way to a folder');
    // (#647's fallback security review of 8922450: a chain of links too long for recursion is read, and fails with
    // its mend)
    const chain = project({ ...script, ...listing() });
    for (let i = 1; i <= 2500; i++) { fs.mkdirSync(path.join(chain, `d/${i}`), { recursive: true }); fs.symlinkSync(`../${i + 1}`, path.join(chain, `d/${i}/next`)); }
    fs.mkdirSync(path.join(chain, ".claude/agents"), { recursive: true }); fs.symlinkSync("../../d/1", path.join(chain, ".claude/agents/c"));
    git(chain, "add", "-A"); git(chain, "commit", "-q", "-m", "a long chain of links");
    fails(run(chain, "--core"), "a link below agents into a long chain of links fails with its mend", LINKED);
    const deep = project({ ...script, [`.claude/agents/${"a/".repeat(1000)}x.md`]: "---\nname: x\n---\n", ...listing() });
    const deepStarted = Date.now(), deepRun = run(deep, "--core");
    ok(deepRun.status === 0 && Date.now() - deepStarted < 30000, "a plain folder a thousand deep below agents is read in seconds", deepRun.out);
    // (#647's fallback security review of 2b74d24: and a folder of agents thousands wide, each folder's entries found in the
    // listing by a search, not a scan of it)
    const wide = project({ ...script, ...Object.fromEntries(Array.from({ length: 3000 }, (_, i) => [`.claude/agents/s${i}/a.txt`, "a\n"])), ...listing() });
    const wideStarted = Date.now(), wideRun = run(pr(wide, { "README.md": "x\n" }));
    ok(wideRun.status === 0 && Date.now() - wideStarted < 30000, "a folder of agents three thousand wide is read in seconds", wideRun.out);
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
  const unlisted = run(pr(project({ ...listing() }), { "README.md": "a change of its own\n" }));
  delete process.env.AGENT_TOOLS_LISTING_MAX;
  fails(unlisted, "a head git cannot list fails", "cannot be listed", "Mend: ");
  // (#600's fallback security review of 72e6450: names are compared as a file system that folds case does)
  fails(run(pr(project({ ...listing() }), { ".claude/\u017fkills/notes/SKILL.md": "# notes\n" })), "a name that differs only by a letter a full case fold matches fails too", "in another case");
  if (LINKS) {
    // (#600's fallback security review of 72e6450: a link of the tool's own name to a folder in the checkout is followed,
    // as the rest of the check follows it, so a file in another case behind it is read too)
    for (const [link, inside, says] of [[".codex", "Config.toml", "Mend: rename it to .codex/config.toml"], [".kiro/hooks", "x.JSON", "Mend: rename it to .kiro/hooks/x.json"], [".claude/skills/notes", "Skill.md", "Mend: rename it to .claude/skills/notes/SKILL.md"]]) {
      const behind = project({ ...listing() });
      fs.mkdirSync(path.join(behind, "cfg"), { recursive: true });
      fs.writeFileSync(path.join(behind, "cfg", inside), "{}\n");
      fs.mkdirSync(path.dirname(path.join(behind, link)), { recursive: true });
      fs.symlinkSync(path.relative(path.dirname(path.join(behind, link)), path.join(behind, "cfg")), path.join(behind, link));
      git(behind, "add", "-A"); git(behind, "commit", "-q", "-m", "a link of the tool's own name");
      fails(run(behind, "--core"), `a file in another case behind ${link}, a link of its own name, fails`, says);
    }
    // (#600's code review of a21b252: a file in a tool folder the tool does not read is not looked at, so an ignored link
    // out of the checkout there fails nothing; and a path beyond a link stops no other's question to git)
    const docLink = project({ ".gitignore": ".claude/skills/notes/README.md\n", ".claude/skills/notes/notes.txt": "x\n", ...listing() });
    fs.symlinkSync(path.join(os.tmpdir()), path.join(docLink, ".claude/skills/notes/README.md"));
    passes(run(pr(docLink, { "README.md": "a change of its own\n" })), "an ignored link out of the checkout in a skill's folder, which the tool does not read, fails nothing");
    const viaLink = project({ ".gitignore": ".codex/Config.toml\n", "config/settings.json": KIT, ".claude/settings.json": null, ...listing() });
    fs.rmSync(path.join(viaLink, ".claude"), { recursive: true, force: true });
    fs.symlinkSync("config", path.join(viaLink, ".claude"));
    git(viaLink, "add", "-A"); git(viaLink, "commit", "-q", "-m", "settings through a link");
    write(viaLink, ".codex/Config.toml", "notify = [\"bash\", \"x.sh\"]\n");
    passes(run(pr(viaLink, { "README.md": "a change of its own\n" })), "an ignored file in another case is still read as ignored where a tool's folder is a link");
    // (#600's code review of 681de78: what the tool reads there and is no file, a link out among it, is held to the base
    // as a file's text is, by what it holds)
    const heldDir = project({ ".Codex/hooks.json": "{}\n", ...listing() });
    const addLink = pr(heldDir, { "README.md": "a change of its own\n" });
    git(addLink, "checkout", "-q", "-B", "change2");
    fs.symlinkSync(os.tmpdir(), path.join(addLink, ".Codex/config.toml"));
    git(addLink, "add", "-A"); git(addLink, "commit", "-q", "-m", "a link out added");
    git(addLink, "checkout", "-q", "main"); git(addLink, "merge", "-q", "--no-ff", "-m", "merge", "change2");
    fails(run(addLink), "a link out added under a folder the base held in another case fails", "Mend: rename it to .codex");
    const moved = project({ ".Codex/hooks.json": "{}\n", ...listing() });
    fs.symlinkSync(os.tmpdir(), path.join(moved, ".Codex/config.toml"));
    git(moved, "add", "-A"); git(moved, "commit", "-q", "-m", "a link out");
    git(moved, "checkout", "-q", "-B", "change2"); fs.unlinkSync(path.join(moved, ".Codex/config.toml"));
    fs.symlinkSync(path.dirname(os.tmpdir()), path.join(moved, ".Codex/config.toml"));
    git(moved, "add", "-A"); git(moved, "commit", "-q", "-m", "the link moved");
    git(moved, "checkout", "-q", "main"); git(moved, "merge", "-q", "--no-ff", "-m", "merge", "change2");
    fails(run(moved), "and so does one whose target the pull request moves", "Mend: rename it to .codex");
    // (#600's code review of 462c48a: and a folder on the way to what the tool reads that is a link out, added there, or
    // the tool folder itself)
    for (const [base, add] of [[".Kiro/hooks/x.json", ".Kiro/Settings"], [".Kiro/settings/mcp.json", ".Kiro/Hooks"]]) {
      const onWay = project({ [base]: "{}\n", ...listing() });
      const added = pr(onWay, { "README.md": "a change of its own\n" });
      git(added, "checkout", "-q", "-B", "change2");
      fs.symlinkSync(os.tmpdir(), path.join(added, add));
      git(added, "add", "-A"); git(added, "commit", "-q", "-m", "a folder linked out");
      git(added, "checkout", "-q", "main"); git(added, "merge", "-q", "--no-ff", "-m", "merge", "change2");
      fails(run(added), `a link out added as ${add} under a folder the base held in another case fails`, "Mend: rename it to .kiro");
    }
    // (#600's fallback security review of 348aaed: an entry reached through a link is held by what the walk reaches and
    // each link on the way, so a submodule moved behind it, a broken link filled in or a link on the way moved is seen)
    const held = (setup, change, says) => {
      const dir = project({ ".Kiro/hooks/x.json": "{}\n", ...listing() });
      setup(dir);
      git(dir, "checkout", "-q", "-B", "change2");
      change(dir);
      git(dir, "checkout", "-q", "main"); git(dir, "merge", "-q", "--no-ff", "-m", "merge", "change2");
      fails(run(dir), says, "Mend: rename it to .kiro");
    };
    // (a submodule's entry, its folder left empty on disk so `git add -A` keeps it, committed on its own)
    const sub = (dir, at, id) => { fs.mkdirSync(path.join(dir, at), { recursive: true }); git(dir, "update-index", "--add", "--cacheinfo", `160000,${id},${at}`); git(dir, "commit", "-q", "-m", `a submodule at ${at}`); };
    const linkIn = dir => { fs.symlinkSync("../inner", path.join(dir, ".Kiro/settings")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link in"); };
    held(dir => { linkIn(dir); sub(dir, "inner", git(dir, "rev-parse", "HEAD")); }, dir => sub(dir, "inner", git(dir, "rev-parse", "HEAD~2")), "a submodule behind a link the base held, moved, fails");
    held(linkIn, dir => sub(dir, "inner", git(dir, "rev-parse", "HEAD")), "a broken link the base held, filled in with a submodule, fails");
    held(linkIn, dir => { fs.symlinkSync(os.tmpdir(), path.join(dir, "inner")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "filled in"); }, "and filled in with a link out");
    held(dir => { fs.symlinkSync(os.tmpdir(), path.join(dir, "inner")); linkIn(dir); }, dir => { fs.unlinkSync(path.join(dir, "inner")); fs.symlinkSync(path.dirname(os.tmpdir()), path.join(dir, "inner")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "moved"); }, "a link on the way the pull request moves fails");
    // (#600's fallback security review of b333c75: a link into a submodule's folder, the submodule moved)
    held(dir => { fs.symlinkSync("../sub/cfg", path.join(dir, ".Kiro/settings")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link in"); sub(dir, "sub", git(dir, "rev-parse", "HEAD")); }, dir => sub(dir, "sub", git(dir, "rev-parse", "HEAD~2")), "a link into a submodule the base held, the submodule moved, fails");
    // (and a plain file on the way, which gives the tool nothing to read, is not held)
    const plainOnWay = project({ ".Kiro/hooks/x.json": "{}\n", ".Kiro/settings": "a\n", ...listing() });
    const plainRun = run(pr(plainOnWay, { ".Kiro/settings": "b\n" }));
    ok(plainRun.status === 0, "a plain file on the way to a tool's file, changed, changes nothing the base held", plainRun.out);
    // (#600's fallback security review of 4252c30: one taken out is seen, as the tool then reads what it hid)
    fails(run(pr(project({ ".Kiro/hooks/x.json": "{}\n", ".Kiro/settings": "a\n", ...listing() }), { ".Kiro/settings": null })), "and one taken out fails", "Mend: rename it to .kiro");
    // (and a link through a submodule's folder and back out of it by "..", to a file the pull request changes)
    held(dir => { fs.mkdirSync(path.join(dir, "real"), { recursive: true }); fs.writeFileSync(path.join(dir, "real/mcp.json"), "{}\n"); fs.symlinkSync("../sub/../real", path.join(dir, ".Kiro/settings")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link through a submodule"); sub(dir, "sub", git(dir, "rev-parse", "HEAD")); }, dir => { fs.writeFileSync(path.join(dir, "real/mcp.json"), "{ \"mcpServers\": {} }\n"); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "changed"); }, "a file reached through a submodule's folder and out of it, changed, fails");
    // (#600's fallback security review of 243d29e: and through the root's .git, which every clone holds beside the commit)
    for (const via of [".git"]) held(dir => { fs.mkdirSync(path.join(dir, "real"), { recursive: true }); fs.writeFileSync(path.join(dir, "real/mcp.json"), "{}\n"); fs.symlinkSync(`../${via}/../real`, path.join(dir, ".Kiro/settings")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link through a name the commit lacks"); }, dir => { fs.writeFileSync(path.join(dir, "real/mcp.json"), "{ \"mcpServers\": {} }\n"); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "changed"); }, `a file reached through ${via} and out of it, changed, fails`);
    // (#600's fallback security review of 4c63650: a name no clone holds ends the walk, as it ends the file system's, so
    // the base never holds what its tools could not read)
    const absentServer = project({ ".mcp.json": null, "real.json": JSON.stringify({ mcpServers: { files: { command: "npx", args: ["-y", "files@1.0.0"] } } }), ...listing() });
    fs.symlinkSync("nothere/../real.json", path.join(absentServer, ".mcp.json"));
    git(absentServer, "add", "-A"); git(absentServer, "commit", "-q", "-m", "a link through a name no clone holds");
    fails(run(pr(absentServer, { "nothere/.keep": "" })), "a server the base's tools could not read, made readable, is new", 'the tool server "files"');
    const absentKept = project({ "real/mcp.json": "{}\n", ".Kiro/hooks/x.json": "{}\n", ...listing() });
    fs.symlinkSync("../nothere/../real", path.join(absentKept, ".Kiro/settings"));
    git(absentKept, "add", "-A"); git(absentKept, "commit", "-q", "-m", "a link through a name no clone holds");
    // (while what is held there is read through any name a working copy may hold, .git's own folders and ignored ones
    // among them: #600's fallback security review of 09ed8b5)
    fails(run(pr(absentKept, { "real/mcp.json": "{ \"mcpServers\": {} }\n" })), "what a working copy may give a tool there, changed, fails", "Mend: rename it to .kiro");
    for (const via of [".git/refs/..", "node_modules"]) held(dir => { fs.mkdirSync(path.join(dir, "real"), { recursive: true }); fs.writeFileSync(path.join(dir, "real/mcp.json"), "{}\n"); fs.symlinkSync(`../${via}/../real`, path.join(dir, ".Kiro/settings")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link through a folder beside the commit"); }, dir => { fs.writeFileSync(path.join(dir, "real/mcp.json"), "{ \"mcpServers\": {} }\n"); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "changed"); }, `a file reached through ${via} and out of it, changed, fails`);
    // (#600's fallback security review of 1a67694: and a path in another case found through such a folder)
    const behindRefs = project({ "kreal/Settings/mcp.json": "{}\n", ...listing() });
    fs.symlinkSync(".git/refs/../../kreal", path.join(behindRefs, ".kiro"));
    git(behindRefs, "add", "-A"); git(behindRefs, "commit", "-q", "-m", "a tool's folder through .git's own");
    fails(run(behindRefs, "--core"), "a path in another case behind a link through a folder beside the commit fails", "Mend: rename it to .kiro/settings");
    // (#600's fallback security review of 27d9d98: a file is held by its kind too, so none reads as a link it names)
    const asLink = project({ ".Codex/hooks.json": "{}\n", ...listing() });
    fs.symlinkSync(os.tmpdir(), path.join(asLink, ".Codex/config.toml"));
    git(asLink, "add", "-A"); git(asLink, "commit", "-q", "-m", "a link out");
    git(asLink, "checkout", "-q", "-B", "change2"); fs.unlinkSync(path.join(asLink, ".Codex/config.toml"));
    fs.writeFileSync(path.join(asLink, ".Codex/config.toml"), `\0a link to ${os.tmpdir()}`);
    git(asLink, "add", "-A"); git(asLink, "commit", "-q", "-m", "the link a file");
    git(asLink, "checkout", "-q", "main"); git(asLink, "merge", "-q", "--no-ff", "-m", "merge", "change2");
    fails(run(asLink), "and so does a file put in a link's place that names what the link led to", "Mend: rename it to .codex");
    // (#600's fallback security review of 8dfe536: behind a link of the tool's own name, an entry in another case that is no
    // folder the walk reaches is named too, whatever it is)
    for (const [link, to, inside, says] of [[".kiro", "k", "hooks/x.JSON", "Mend: rename it to .kiro/hooks/x.json"], [".codex", "c", "Config.toml", "Mend: rename it to .codex/config.toml"], [".claude/skills", "../s", "n/Skill.md", "Mend: rename it to .claude/skills/n/SKILL.md"]]) {
      const out = project({ ...listing() }), real = path.join(out, path.dirname(link), to);
      fs.mkdirSync(path.dirname(path.join(real, inside)), { recursive: true });
      fs.symlinkSync(os.tmpdir(), path.join(real, inside));
      fs.symlinkSync(to, path.join(out, link));
      git(out, "add", "-A"); git(out, "commit", "-q", "-m", "a link out behind a link of the tool's own name");
      fails(run(out, "--core"), `a link out of the checkout in another case behind ${link} fails`, says);
    }
    const subBehind = project({ "c/keep.md": "", ...listing() });
    fs.symlinkSync("c", path.join(subBehind, ".codex"));
    git(subBehind, "add", "-A"); git(subBehind, "update-index", "--add", "--cacheinfo", `160000,${git(subBehind, "rev-parse", "HEAD")},c/Config.toml`);
    git(subBehind, "commit", "-q", "-m", "a submodule in another case behind a link");
    fails(run(subBehind, "--core"), "and so does a submodule's entry there", "Mend: rename it to .codex/config.toml");
    // (#600's fallback security review of 27d9d98: a skill's folder in a folder in another case that is no folder, a link
    // out of the checkout or a submodule's entry, through which the tool reads a SKILL.md this check cannot, is named too)
    for (const [skills, says] of [[".claude/Skills", "Mend: rename it to .claude/skills"], [".Claude/skills", "Mend: rename it to .claude"]]) {
      const outSkill = project({ ...listing() });
      fs.mkdirSync(path.join(outSkill, skills), { recursive: true });
      fs.symlinkSync(os.tmpdir(), path.join(outSkill, skills, "foo"));
      git(outSkill, "add", "-A"); git(outSkill, "commit", "-q", "-m", "a skill's folder linked out");
      fails(run(outSkill, "--core"), `a skill's folder under ${skills} that links out of the checkout fails`, says);
    }
    const subSkill = project({ "README.md": "x\n", ...listing() });
    git(subSkill, "update-index", "--add", "--cacheinfo", `160000,${git(subSkill, "rev-parse", "HEAD")},.claude/Skills/foo`);
    git(subSkill, "commit", "-q", "-m", "a skill's folder as a submodule");
    fails(run(subSkill, "--core"), "and so does one that is a submodule's entry", "Mend: rename it to .claude/skills");
    const plainSkill = project({ ".claude/Skills/notes.md": "# notes\n", ...listing() });
    passes(run(plainSkill, "--core"), "while a plain file there, which the tool does not read, is not looked at");
    const skillHeld = project({ ".claude/Skills/bar/SKILL.md": "# bar\n", ...listing() });
    const skillAdded = pr(skillHeld, { "README.md": "a change of its own\n" });
    git(skillAdded, "checkout", "-q", "-B", "change2");
    fs.symlinkSync(os.tmpdir(), path.join(skillAdded, ".claude/Skills/foo"));
    git(skillAdded, "add", "-A"); git(skillAdded, "commit", "-q", "-m", "a skill's folder linked out");
    git(skillAdded, "checkout", "-q", "main"); git(skillAdded, "merge", "-q", "--no-ff", "-m", "merge", "change2");
    fails(run(skillAdded), "one a pull request adds under a folder the base held in another case fails", "Mend: rename it to .claude/skills");
    const noteAdded = run(pr(project({ ".claude/Skills/bar/SKILL.md": "# bar\n", ...listing() }), { ".claude/Skills/notes.md": "# notes\n" }));
    ok(noteAdded.status === 0, "while a file there the tool does not read changes nothing the base held", noteAdded.out);
    // (#600's code review of 33315a2: nor does a folder added there with no SKILL.md in it)
    const docAdded = run(pr(project({ ".Claude/skills/bar/SKILL.md": "# bar\n", ...listing() }), { ".Claude/skills/notes/README.md": "# notes\n" }));
    ok(docAdded.status === 0, "and a folder added there that holds no SKILL.md changes nothing either", docAdded.out);
    // (a folder or a link in another case on the way to a tool's file)
    const aliased = project({ "config/config.toml": "notify = [\"bash\", \"scripts/new.sh\"]\n", ...listing() });
    fs.symlinkSync("config", path.join(aliased, ".Codex"));
    git(aliased, "add", "-A"); git(aliased, "commit", "-q", "-m", "a link in another case");
    fails(run(aliased, "--core"), "a link in another case to a tool's folder fails", ".Codex is .codex in another case", "Mend: rename it to .codex");
    const aliasStood = project({ "config/config.toml": "# none\n", ...listing() });
    fs.symlinkSync("config", path.join(aliasStood, ".Codex"));
    git(aliasStood, "add", "-A"); git(aliasStood, "commit", "-q", "-m", "a link in another case");
    const aliasKept = run(pr(aliasStood, { "README.md": "a change of its own\n" }));
    ok(aliasKept.status === 0 && /\.Codex is \.codex in another case/.test(aliasKept.out), "one the base held is noted, not failed", aliasKept.out);
    fails(run(pr(aliasStood, { "config/config.toml": "notify = [\"bash\", \"scripts/new.sh\"]\n" })), "but not once what the tool reads through it changes", "Mend: rename it to .codex");
  }
  // (#476's security review of a74309b: what the kit's form fetches from main must be a file, not a link, whose target's
  // name main would give in the script's place)
  if (LINKS) {
    const linkFetch = project({ "scripts/tree.sh": "echo the branch's\n", ...listing() });
    fs.symlinkSync("./tree.sh", path.join(linkFetch, "scripts/format.sh"));
    fails(run(pr(linkFetch, { ".claude/settings.json": withHook(KIT_HOOK), ...listing(entry(KIT_HOOK)) })), "a hook in the kit's form that fetches a link from main fails", 'fetches "scripts/format.sh" from main, which the project holds as no plain file');
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
  if (LINKS) {
    // (#600's fallback security review of 33315a2: a submodule a tool's path leads to through a link)
    for (const [at, to] of [[".codex", "sub"], [".claude/skills/foo", "../../sub"], [".kiro/settings", "../sub/cfg"]]) {
      const behind = project({ ...listing() });
      gitlink(behind, "sub");
      fs.mkdirSync(path.dirname(path.join(behind, at)), { recursive: true });
      fs.symlinkSync(to, path.join(behind, at));
      git(behind, "add", "-A"); git(behind, "commit", "-q", "-m", "a link to a submodule");
      fails(run(behind, "--core"), `one ${at} leads to through a link fails`, `${at} leads, through a link, to the submodule sub`, "Mend: ");
    }
    const heldBehind = project({ ...listing() });
    gitlink(heldBehind, "sub");
    fs.symlinkSync("sub", path.join(heldBehind, ".codex"));
    git(heldBehind, "add", "-A"); git(heldBehind, "commit", "-q", "-m", "a link to a submodule");
    const heldBehindRun = run(pr(heldBehind, { "README.md": "a change of its own\n" }));
    ok(heldBehindRun.status === 0 && heldBehindRun.out.includes("leads, through a link, to the submodule sub"), "one the base held is noted, not failed", heldBehindRun.out);
    fails(run(prLink(heldBehind, "sub", git(heldBehind, "rev-parse", "HEAD~1"))), "but not once the pull request moves the submodule", "leads, through a link, to the submodule sub");
    // (#618's fallback security review of 4d141c6: and from a link anywhere under a tool's folder)
    const skillLink = project({ ".claude/skills/x/SKILL.md": "# x\n", ...listing() });
    gitlink(skillLink, "sub");
    fs.symlinkSync("../../../sub", path.join(skillLink, ".claude/skills/x/scripts"));
    git(skillLink, "add", "-A"); git(skillLink, "commit", "-q", "-m", "a skill's folder linked to a submodule");
    fails(run(skillLink, "--core"), "a skill's own folder linked to a submodule fails", ".claude/skills/x/scripts leads, through a link, to the submodule sub");
    // (and a tool's path in another case the base held, through a chain of links: each link on the way is held too)
    const chain = project({ ...listing() });
    fs.mkdirSync(path.join(chain, ".claude/Skills"), { recursive: true });
    fs.symlinkSync(os.tmpdir(), path.join(chain, "l1"));
    fs.symlinkSync("../../l1", path.join(chain, ".claude/Skills/foo"));
    git(chain, "add", "-A"); git(chain, "commit", "-q", "-m", "a chain of links out");
    git(chain, "checkout", "-q", "-B", "change2"); fs.unlinkSync(path.join(chain, "l1"));
    fs.symlinkSync(path.dirname(os.tmpdir()), path.join(chain, "l1"));
    git(chain, "add", "-A"); git(chain, "commit", "-q", "-m", "the chain moved");
    git(chain, "checkout", "-q", "main"); git(chain, "merge", "-q", "--no-ff", "-m", "merge", "change2");
    fails(run(chain), "a link on the way the pull request moves fails a path in another case the base held", "Mend: rename it to .claude/skills");
    // (#600's fallback security review of 462c48a: a link to a folder in the checkout, moved to one whose SKILL.md is the same)
    const twin = project({ "docs/a/SKILL.md": "# a\n", "docs/b/SKILL.md": "# a\n", "docs/b/run.sh": "echo b\n", ...listing() });
    fs.mkdirSync(path.join(twin, ".claude/Skills"), { recursive: true });
    fs.symlinkSync("../../docs/a", path.join(twin, ".claude/Skills/foo"));
    git(twin, "add", "-A"); git(twin, "commit", "-q", "-m", "a skill linked in");
    git(twin, "checkout", "-q", "-B", "change2"); fs.unlinkSync(path.join(twin, ".claude/Skills/foo"));
    fs.symlinkSync("../../docs/b", path.join(twin, ".claude/Skills/foo"));
    git(twin, "add", "-A"); git(twin, "commit", "-q", "-m", "the link moved");
    git(twin, "checkout", "-q", "main"); git(twin, "merge", "-q", "--no-ff", "-m", "merge", "change2");
    fails(run(twin), "and so does a skill's link moved to a folder whose SKILL.md is the same", "Mend: rename it to .claude/skills");
    // (a link whose target the commit holds only in another case, which a file system that ignores case follows)
    const LINK_SAYS = "in another case, which an agent tool reads there";
    for (const [at, to, file] of [[".kiro/settings", "../Inner", "inner/mcp.json"], [".claude/skills/s", "../../Sk", "sk/SKILL.md"], [".mcp.json", "Real.json", "real.json"]]) {
      const caseLink = project({ [file]: "{}\n", ...listing() });
      fs.mkdirSync(path.dirname(path.join(caseLink, at)), { recursive: true });
      fs.symlinkSync(to, path.join(caseLink, at));
      git(caseLink, "add", "-A"); git(caseLink, "commit", "-q", "-m", "a link in another case");
      fails(run(caseLink, "--core"), `${at} linked to ${to}, held as ${file.split("/")[0]}, fails`, `${at} leads, through a link, to`, LINK_SAYS, "Mend: write the link's target as");
    }
    const caseHeld = project({ "inner/mcp.json": "{}\n", ...listing() });
    fs.mkdirSync(path.join(caseHeld, ".kiro"), { recursive: true });
    fs.symlinkSync("../Inner", path.join(caseHeld, ".kiro/settings"));
    git(caseHeld, "add", "-A"); git(caseHeld, "commit", "-q", "-m", "a link in another case");
    const caseKept = run(pr(caseHeld, { "README.md": "a change of its own\n" }));
    ok(caseKept.status === 0 && caseKept.out.includes(LINK_SAYS), "one the base held is noted, not failed", caseKept.out);
    fails(run(pr(caseHeld, { "inner/mcp.json": "{ \"mcpServers\": {} }\n" })), "but not once what stands under its target changes", LINK_SAYS);
    passes(run(pr(project({ "Inner/mcp.json": "{}\n", ...listing() }), { "README.md": "x\n" })), "a folder in another case that no link leads to is none of this");
    // (a target the commit holds under two names that fold alike, which a file system that ignores case keeps one of)
    const SEVERAL = "under more than one name a file system that ignores case reads as one";
    const twice = () => { const dir = project({ "Cfg/settings/mcp.json": "{}\n", "cfg/settings/mcp.json": "{}\n", ...listing() }); fs.symlinkSync("Cfg", path.join(dir, ".kiro")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link to a name held twice"); return dir; };
    fails(run(twice(), "--core"), "a link to a name the commit holds twice, folded alike, fails", `leads, through a link, to Cfg, which the commit holds ${SEVERAL} (Cfg, cfg)`, "Mend: keep one of those names");
    const twiceKept = run(pr(twice(), { "README.md": "x\n" }));
    ok(twiceKept.status === 0 && twiceKept.out.includes(SEVERAL), "one the base held is noted, not failed", twiceKept.out);
    fails(run(pr(twice(), { "cfg/settings/mcp.json": "{ \"mcpServers\": {} }\n" })), "but not once what the tool may read under the other name changes", SEVERAL);
    // (Codex's code review of a2ed364: held by what a tool may read under each name alone, so what else stands there
    // changes freely, while a tool's file changed or added under either name fails)
    const twiceDoc = run(pr(twice(), { "Cfg/README.md": "x\n", "cfg/notes.txt": "y\n" }));
    ok(twiceDoc.status === 0 && twiceDoc.out.includes(SEVERAL), "one the base held is noted while what no tool reads under either name changes", twiceDoc.out);
    fails(run(pr(twice(), { "Cfg/settings/mcp.json": "{ \"mcpServers\": {} }\n" })), "but not once what the tool may read under the name git keeps changes", SEVERAL);
    fails(run(pr(twice(), { "Cfg/hooks/lint.json": JSON.stringify({ version: "v1", hooks: [] }) })), "nor once a hook file is added under the name git keeps", SEVERAL);
    // (its fallback security review of f8559d9: and under each spelling of each name past the first held twice)
    const twiceDeep = () => { const dir = project({ "A/b/settings/mcp.json": "{}\n", "a/b/settings/mcp.json": "{}\n", "A/B/hooks/n.txt": "x\n", "A/B/settings/mcp.json": "{}\n", ...listing() }); fs.symlinkSync("A/b", path.join(dir, ".kiro")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link through names held twice"); return dir; };
    fails(run(pr(twiceDeep(), { "A/B/hooks/new.json": JSON.stringify({ version: "v1", hooks: [] }) })), "a hook file added under another spelling of a name past the first held twice fails", SEVERAL);
    fails(run(pr(twiceDeep(), { "A/B/settings/mcp.json": "{ \"mcpServers\": {} }\n" })), "and so does a tool's file changed there", SEVERAL);
    const kiroHook = command => ({ version: "v1", hooks: [{ name: "lint", trigger: "Stop", action: { type: "command", command } }] });
    // (a hook file added under the other name, where no tool's path the walk takes passes, is held all the same; and a
    // link to a folder held twice is seen where no tool's file stands under the name git keeps, or where the name it
    // names stands in no case but two others)
    fails(run(pr(twice(), { "cfg/hooks/lint.json": kiroHook("bash scripts/run.sh") })), "and so does a hook file added under the other name", SEVERAL);
    // (#633's code review of de3cb32: and a tool's file the other name alone holds, added)
    const twiceClaude = () => { const dir = project({ "Cfg/settings.json": KIT, "cfg/settings.json": KIT, ...listing() }); fs.rmSync(path.join(dir, ".claude"), { recursive: true, force: true }); fs.symlinkSync("Cfg", path.join(dir, ".claude")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link to a name held twice"); return dir; };
    fails(run(pr(twiceClaude(), { "cfg/settings.local.json": JSON.stringify({ apiKeyHelper: "bash scripts/key.sh" }) })), "and so does a settings file only the other name holds, added", SEVERAL);
    const bare = project({ "Cfg/x": "x\n", "cfg/hooks/lint.json": kiroHook("bash scripts/run.sh"), ...listing() });
    fs.symlinkSync("Cfg", path.join(bare, ".kiro")); git(bare, "add", "-A"); git(bare, "commit", "-q", "-m", "a link to a folder held twice");
    fails(run(bare, "--core"), "a link to a folder held twice fails where no tool's file stands under the name git keeps", SEVERAL);
    const neither = project({ "Cfg/settings/mcp.json": "{}\n", "CFG/settings/mcp.json": "{}\n", ...listing() });
    fs.symlinkSync("cfg", path.join(neither, ".kiro")); git(neither, "add", "-A"); git(neither, "commit", "-q", "-m", "a link to a name in no case");
    fails(run(neither, "--core"), "and so does one to a name that stands in no case but two others", SEVERAL);
    // (and a target in another of Unicode's normal forms, which macOS's file system reads as the same)
    const nfd = project({ ["cf\u0065\u0301/settings/mcp.json"]: "{}\n", ...listing() });
    fs.symlinkSync("cf\u00e9", path.join(nfd, ".kiro"));
    git(nfd, "add", "-A"); git(nfd, "commit", "-q", "-m", "a link to a name in another normal form");
    fails(run(nfd, "--core"), "a link to a name the commit holds in another normal form fails", ".kiro leads, through a link, to", LINK_SAYS);
    // (#600's code review of 09ed8b5: a tool's folder in another case, itself a link whose target stands only in another
    // case, the base holding both, and what stands under that target changed)
    const both = project({ "cfg/config.toml": "# none\n", ...listing() });
    fs.symlinkSync("CFG", path.join(both, ".Codex"));
    git(both, "add", "-A"); git(both, "commit", "-q", "-m", "a link in another case to a target in another case");
    fails(run(pr(both, { "cfg/config.toml": "notify = [\"bash\", \"new.sh\"]\n" })), "and so does one the base held whose tool's folder is in another case too", LINK_SAYS);
    // (#618's code review of 1e710c8: held by what the tool reads there alone, so a file beside it changes nothing)
    const besideCase = run(pr(both, { "cfg/notes.md": "x\n" }));
    ok(besideCase.status === 0 && besideCase.out.includes(LINK_SAYS), "a file there no tool reads, added, changes nothing the base held", besideCase.out);
    // (a link the base held that leads out of the checkout, as one through a folder CI's checkout lacks does, is held by
    // what its path reaches in the commit too)
    const throughIgnored = project({ ".gitignore": "node_modules/\n", "kreal/settings/mcp.json": "{}\n", ...listing() });
    fs.symlinkSync("node_modules/../kreal", path.join(throughIgnored, ".kiro"));
    git(throughIgnored, "add", "-A"); git(throughIgnored, "commit", "-q", "-m", "a link through an ignored folder");
    const outKept = run(pr(throughIgnored, { "README.md": "x\n" }));
    ok(outKept.status === 0 && outKept.out.includes("as the base held it"), "a link out the base held is noted while what its path reaches stands", outKept.out);
    fails(run(pr(throughIgnored, { "kreal/settings/mcp.json": JSON.stringify({ mcpServers: { files: { command: "npx", args: ["-y", "files@1.0.0"] } } }) })), "but not once what it reaches changes", '".kiro" is a link that leads out of the checkout');
    // (#618's code review of 4d141c6: only what a tool reads there, so a file beside it, or a link that reaches the
    // checkout's root, changes nothing the base held)
    const besideRead = run(pr(throughIgnored, { "kreal/notes.md": "x\n" }));
    ok(besideRead.status === 0 && besideRead.out.includes("as the base held it"), "a file there no tool reads, changed, changes nothing the base held", besideRead.out);
    const toRoot = project({ ".gitignore": "node_modules/\n", ...listing() });
    fs.rmSync(path.join(toRoot, ".codex"), { recursive: true, force: true });
    fs.symlinkSync("node_modules/..", path.join(toRoot, ".codex"));
    git(toRoot, "add", "-A"); git(toRoot, "commit", "-q", "-m", "a link through an ignored folder to the root");
    const rootKept = run(pr(toRoot, { "README.md": "an unrelated change\n" }));
    ok(rootKept.status === 0 && rootKept.out.includes("as the base held it"), "and so does an unrelated change where a held link reaches the checkout's root", rootKept.out);
    // (#618's fallback security review of 1e710c8: a link or submodule on the way to what a tool reads there, and what a
    // link under it leads to, are held too)
    const underLink = (setup, change, says) => {
      const dir = project({ ".gitignore": "node_modules/\n", ...listing() });
      fs.rmSync(path.join(dir, ".claude"), { recursive: true, force: true });
      setup(dir);
      git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link out through an ignored folder");
      git(dir, "checkout", "-q", "-B", "change2"); change(dir);
      git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "changed");
      git(dir, "checkout", "-q", "main"); git(dir, "merge", "-q", "--no-ff", "-m", "merge", "change2");
      fails(run(dir), says, '".claude" is a link that leads out of the checkout');
    };
    const skillAt = (dir, folder) => { fs.mkdirSync(path.join(dir, folder, "x"), { recursive: true }); fs.writeFileSync(path.join(dir, folder, "x/SKILL.md"), `# ${folder}\n`); };
    underLink(dir => { fs.mkdirSync(path.join(dir, "cl"), { recursive: true }); fs.writeFileSync(path.join(dir, "cl/settings.json"), KIT); skillAt(dir, "s1"); skillAt(dir, "s2"); fs.symlinkSync("../s1", path.join(dir, "cl/skills")); fs.symlinkSync("node_modules/../cl", path.join(dir, ".claude")); },
      dir => { fs.unlinkSync(path.join(dir, "cl/skills")); fs.symlinkSync("../s2", path.join(dir, "cl/skills")); }, "a link under a held link out, moved, fails");
    underLink(dir => { fs.mkdirSync(path.join(dir, "cl"), { recursive: true }); fs.writeFileSync(path.join(dir, "cl/settings.json"), KIT); skillAt(dir, "s1"); fs.symlinkSync("../s1", path.join(dir, "cl/skills")); fs.symlinkSync("node_modules/../cl", path.join(dir, ".claude")); },
      dir => fs.writeFileSync(path.join(dir, "s1/x/SKILL.md"), "# changed\n"), "and so does what a link under it leads to, changed");
    // (#618's fallback security review of 8ff37cf: and what it leads to in another case, as a file system that ignores case
    // finds it)
    underLink(dir => { fs.mkdirSync(path.join(dir, "cl"), { recursive: true }); fs.writeFileSync(path.join(dir, "cl/settings.json"), KIT); fs.symlinkSync("node_modules/../CL", path.join(dir, ".claude")); },
      dir => fs.writeFileSync(path.join(dir, "cl/settings.json"), JSON.stringify({ ...JSON.parse(KIT), model: "opus" })), "and so does what it leads to in another case, changed");
    // (and through an installed package, by what the lock file says of it: a version or source locked anew fails)
    const lockAt = version => JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/pkg": { version, resolved: `https://registry.npmjs.org/pkg/-/pkg-${version}.tgz` }, "node_modules/other": { version: "1.0.0" } } });
    const viaPackage = () => { const dir = project({ ".gitignore": "node_modules/\n", "package-lock.json": lockAt("1.0.0"), ...listing() }); fs.rmSync(path.join(dir, ".claude"), { recursive: true, force: true }); fs.symlinkSync("node_modules/pkg/.claude", path.join(dir, ".claude")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link into an installed package"); return dir; };
    const UNREAD = "through a node_modules folder an install fills, whose files this check does not read";
    const lockKept = run(pr(viaPackage(), { "package-lock.json": JSON.stringify({ ...JSON.parse(lockAt("1.0.0")), packages: { ...JSON.parse(lockAt("1.0.0")).packages, "node_modules/other": { version: "2.0.0" } } }) }));
    ok(lockKept.status === 1 && lockKept.out.includes(UNREAD), "a link the base held into an installed package fails once the lock file changes, read whole, another package's update among it", lockKept.out);
    fails(run(pr(viaPackage(), { "package-lock.json": lockAt("2.0.0") })), "but not once the pull request locks the package anew", '".claude" is a link that leads out of the checkout');
    // (#633's fallback security reviews of b0f654f and acf5691: an entry too deep to write back fails with the mend, not a
    // crash, and is held by the lock file's text; and a yarn or pnpm lock is read whole, as no reading of its entries here
    // is the package manager's: an alias's package, or a key written in another form, is locked elsewhere in it)
    // (#633's fallback security review of acf5691: where a link's target stands in no case but folds alike to a folder
    // and a link beside it, the one the listing gives first is read, as before the names were folded once a folder)
    const order = () => { const dir = project({ "CONF/settings.json": KIT, "other/settings.json": KIT, ...listing() }); fs.rmSync(path.join(dir, ".claude"), { recursive: true, force: true }); fs.symlinkSync("conf", path.join(dir, ".claude")); fs.symlinkSync("other", path.join(dir, "Conf")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link to a name in no case"); return dir; };
    fails(run(pr(order(), { "other/settings.json": JSON.stringify({ ...JSON.parse(KIT), hooks: { ...JSON.parse(KIT).hooks, SessionStart: [{ hooks: [{ type: "command", command: "bash scripts/x.sh" }] }] } }) })), "a hook added where a link to a name in no case leads, through a link beside a folder of that name, fails", ".claude");
    // (#633's code review of b1866cb: and one in a folder's own node_modules, by the lock file beside it)
    const nested = version => ({ "app/package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/pkg": { version } } }) });
    const nestedHeld = () => { const dir = project({ ".gitignore": "node_modules/\n", ...nested("1.0.0"), ...listing() }); fs.rmSync(path.join(dir, ".claude"), { recursive: true, force: true }); fs.symlinkSync("app/node_modules/pkg/.claude", path.join(dir, ".claude")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link into a folder's installed package"); return dir; };
    fails(run(pr(nestedHeld(), nested("2.0.0"))), "a link the base held into a folder's own installed package, locked anew there, fails", '".claude" is a link that leads out of the checkout');
    const deep = version => `{"lockfileVersion":3,"packages":{"node_modules/pkg":{"version":"${version}","x":${"[".repeat(200000)}${"]".repeat(200000)}}}}`;
    fails(run(pr(viaPackage(), { "package-lock.json": deep("1.0.0") })), "and an entry too deep to read back fails with its mend", '".claude" is a link that leads out of the checkout', "Mend:");
    const deepHeld = () => { const dir = viaPackage(); fs.writeFileSync(path.join(dir, "package-lock.json"), deep("1.0.0")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a deep entry"); return dir; };
    fails(run(pr(deepHeld(), { "package-lock.json": deep("2.0.0") })), "and so does one held too deep by the base, locked anew", '".claude" is a link that leads out of the checkout');
    // (and fail closed: a package no lock file read here holds, one a lock takes from the project's own files, bun's lock
    // beside, a file of the package's folder committed, or a workspace's lock at a folder above, are each held or new)
    const viaWith = (files, target = "node_modules/pkg/.claude") => { const dir = project({ ".gitignore": "node_modules/\n", ...files, ...listing() }); fs.rmSync(path.join(dir, ".claude"), { recursive: true, force: true }); fs.symlinkSync(target, path.join(dir, ".claude")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link into an installed package"); return dir; };
    // (a new one fails; one the base held is held by every file an install reads in those folders, and by all the
    // folder holds whose lock takes the package from the project's own files)
    const unread = (what, files, change, target) => {
      const added = project({ ".gitignore": "node_modules/\n", ...files, ...listing() });
      fs.rmSync(path.join(added, ".claude"), { recursive: true, force: true });
      git(added, "add", "-A"); git(added, "commit", "-q", "-m", "no link yet");
      git(added, "checkout", "-q", "-B", "change"); fs.symlinkSync(target ?? "node_modules/pkg/.claude", path.join(added, ".claude"));
      git(added, "add", "-A"); git(added, "commit", "-q", "-m", "a link added"); git(added, "checkout", "-q", "main"); git(added, "merge", "-q", "--no-ff", "-m", "merge", "change");
      fails(run(added), `a link added through a package ${what} fails`, UNREAD, "Mend:");
      const kept = run(pr(viaWith(files, target), { "README.md": "x\n" }));
      ok(kept.status === 0 && kept.out.includes("as the base held it"), `one the base held, ${what}, is noted while all an install reads there stands`, kept.out);
      fails(run(pr(viaWith(files, target), change)), `but not once that changes, ${what}`, UNREAD);
    };
    unread("no lock file holds", { "package.json": "{}\n" }, { "package.json": "{\"dependencies\":{\"pkg\":\"2.0.0\"}}\n" });
    unread("an npm lock file before npm 7 holds", { "package-lock.json": JSON.stringify({ lockfileVersion: 1, dependencies: { pkg: { version: "1.0.0" } } }) }, { "package-lock.json": JSON.stringify({ lockfileVersion: 1, dependencies: { pkg: { version: "2.0.0" } } }) });
    unread("the lock takes from the project's own files", { "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/pkg": { resolved: "packages/pkg", link: true } } }), "packages/pkg/.claude/settings.json": KIT }, { "packages/pkg/.claude/settings.json": JSON.stringify({ ...JSON.parse(KIT), model: "x" }) });
    // (#633's code review of de3cb32: an npm entry that links to a folder of the project is held by what that folder holds)
    unread("npm links to a folder of the project", { "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/pkg": { resolved: "vendor/pkg", link: true }, "vendor/pkg": { version: "1.0.0" } } }), "vendor/pkg/.claude/settings.json": KIT }, { "vendor/pkg/.claude/settings.json": JSON.stringify({ ...JSON.parse(KIT), apiKeyHelper: "bash x.sh" }) });
    unread("beside bun's lock", { "package-lock.json": lockAt("1.0.0"), "bun.lock": "{}\n" }, { "bun.lock": "{ \"x\": 1 }\n" });
    unread("pnpm links from the project", { "pnpm-lock.yaml": "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      pkg:\n        specifier: link:pkg\n        version: link:pkg\n", "pkg/.claude/settings.json": KIT }, { "pkg/.claude/settings.json": JSON.stringify({ ...JSON.parse(KIT), model: "x" }) });
    unread("through node_modules in another case", { "package-lock.json": lockAt("1.0.0") }, { "package-lock.json": lockAt("2.0.0") }, "Node_Modules/pkg/.claude");
    const committed = { "package-lock.json": lockAt("1.0.0"), ".gitignore": "node_modules/*\n!node_modules/pkg/\nnode_modules/pkg/*\n!node_modules/pkg/package.json\n", "node_modules/pkg/package.json": "{}\n" };
    fails(run(pr(viaWith(committed), { "package-lock.json": lockAt("2.0.0") })), "a package with a file of its folder committed, locked anew, fails", '".claude" is a link that leads out of the checkout');
    const workspace = { "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "packages/a/node_modules/pkg": { version: "1.0.0" } } }), "packages/a/package.json": "{}\n" };
    const wsKept = run(pr(viaWith(workspace, "packages/a/node_modules/pkg/.claude"), { "README.md": "x\n" }));
    ok(wsKept.status === 0 && wsKept.out.includes("as the base held it"), "a package a workspace's lock at a folder above holds is noted as it stands", wsKept.out);
    fails(run(pr(viaWith(workspace, "packages/a/node_modules/pkg/.claude"), { "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "packages/a/node_modules/pkg": { version: "2.0.0" } } }) })), "but not once it locks the package anew", '".claude" is a link that leads out of the checkout');
    const atRoot = { "package-lock.json": lockAt("1.0.0") };
    const pkgKept = run(pr(viaWith(atRoot, "node_modules/pkg"), { "README.md": "x\n" }));
    ok(pkgKept.status === 0 && pkgKept.out.includes("as the base held it"), "a link the base held to a package's own folder is noted as its lock stands", pkgKept.out);
    fails(run(pr(viaWith(atRoot, "node_modules/pkg"), { "package-lock.json": lockAt("2.0.0") })), "but not once it locks that package anew", '".claude" is a link that leads out of the checkout');
    const lockLinked = () => { const dir = viaWith({ "locks/package-lock.json": lockAt("1.0.0") }); fs.symlinkSync("locks/package-lock.json", path.join(dir, "package-lock.json")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a lock file held as a link"); return dir; };
    const linkedKept = run(pr(lockLinked(), { "README.md": "x\n" }));
    ok(linkedKept.status === 0 && linkedKept.out.includes("as the base held it"), "one the base held whose lock file is a link is noted while what it leads to stands", linkedKept.out);
    fails(run(pr(lockLinked(), { "locks/package-lock.json": lockAt("2.0.0") })), "but not once what that link leads to changes", UNREAD);
    // (#647's fallback security review of 341004e: a Yarn project's own root, which its lock file names, is never held,
    // so a file of the project an install does not read changes nothing; a link to node_modules itself is held as any;
    // and a folder an npm lock file links to is read exactly, whatever its name)
    const berry = { "yarn.lock": "__metadata:\n  version: 8\n\n\"app@workspace:.\":\n  version: 0.0.0-use.local\n\n\"pkg@npm:^1.0.0\":\n  version: 1.0.0\n  bin:\n    pkg: bin/pkg.js\n  linkType: hard\n", "bin/tool.sh": "echo\n" };
    const berryKept = run(pr(viaWith(berry), { "bin/tool.sh": "echo 2\n" }));
    ok(berryKept.status === 0 && berryKept.out.includes("as the base held it"), "a Yarn project's own files an install does not read, changed, leave the link noted", berryKept.out);
    fails(run(pr(viaWith({ "package-lock.json": lockAt("1.0.0") }, "node_modules"), { "package-lock.json": lockAt("2.0.0") })), "a link the base held to node_modules itself fails once its lock changes", UNREAD);
    unread("npm links to a folder with a space in its name", { "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/pkg": { resolved: "my pkgs/pkg", link: true } } }), "my pkgs/pkg/.claude/settings.json": KIT }, { "my pkgs/pkg/.claude/settings.json": JSON.stringify({ ...JSON.parse(KIT), apiKeyHelper: "bash x.sh" }) });
    // (#647's fallback security review of 304f1e9: a patch file at any path a lock or package.json names, and a path a
    // workspace member's lock entry names from that member's folder)
    unread("pnpm patches from a file of its own", { "package.json": JSON.stringify({ pnpm: { patchedDependencies: { "pkg@1.0.0": "custom/pkg.patch" } } }), "pnpm-lock.yaml": "lockfileVersion: '9.0'\npatchedDependencies:\n  pkg@1.0.0:\n    hash: abc\n    path: custom/pkg.patch\n", "custom/pkg.patch": "a\n" }, { "custom/pkg.patch": "b\n" });
    unread("Yarn patches from a file of its own", { "yarn.lock": "\"pkg@patch:pkg@npm%3A1.0.0#./custom/pkg.patch::locator=app%40workspace%3A.\":\n  version: 1.0.0\n", "custom/pkg.patch": "a\n" }, { "custom/pkg.patch": "b\n" });
    unread("a workspace member links from its own folder", { "pnpm-lock.yaml": "lockfileVersion: '9.0'\nimporters:\n  packages/a:\n    dependencies:\n      pkg:\n        specifier: link:../pkg\n        version: link:../pkg\n", "packages/a/package.json": "{}\n", "packages/pkg/.claude/settings.json": KIT }, { "packages/pkg/.claude/settings.json": JSON.stringify({ ...JSON.parse(KIT), apiKeyHelper: "bash x.sh" }) }, "packages/a/node_modules/pkg/.claude");
    const yarnAt = pkg => `# yarn lockfile v1\n\n\npkg@^1.0.0:\n  version "1.0.0"\n  resolved "https://registry.yarnpkg.com/pkg/-/pkg-1.0.0.tgz"\n${pkg}`;
    const pnpmAt = pkg => `lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    dependencies:\n      pkg:\n        specifier: npm:real-pkg@^1.0.0\n        version: real-pkg@1.0.0\n\npackages:\n\n  real-pkg@1.0.0:\n    resolution: {integrity: ${pkg}}\n`;
    for (const [lock, at, moved] of [["yarn.lock", yarnAt, '\n"pkg@^1.0.0":\n  version "1.0.0"\n  resolved "https://example.invalid/pkg-1.0.0.tgz"\n'], ["pnpm-lock.yaml", pnpmAt, "sha512-q"]]) {
      const viaLock = () => { const dir = project({ ".gitignore": "node_modules/\n", [lock]: at(lock === "yarn.lock" ? "" : "sha512-p"), ...listing() }); fs.rmSync(path.join(dir, ".claude"), { recursive: true, force: true }); fs.symlinkSync("node_modules/pkg/.claude", path.join(dir, ".claude")); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "a link into an installed package"); return dir; };
      const kept = run(pr(viaLock(), { "README.md": "a change of its own\n" }));
      ok(kept.status === 0 && kept.out.includes("as the base held it"), `with ${lock} as it stood, it is noted`, kept.out);
      fails(run(pr(viaLock(), { [lock]: at(moved) })), `but ${lock} changed fails, read whole`, '".claude" is a link that leads out of the checkout');
    }
  }
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
  const want = '{"__proto__":"p","a":{"b":1},"s":"é\\n","m":"x y","l":"z","t":{"d":"1979-05-27T07:32:00Z","i":{"k":[1,"two",[true]]}},"r":[{"n":1},{"n":2}]}';
  ok(JSON.stringify(t) === want && Object.getPrototypeOf(t) === Object.prototype, "TOML is read as JSON would hold it, a key \"__proto__\" a key like any other", JSON.stringify(t));
  const headers = Array.from({ length: 200 }, (_, i) => `[[${Array(i + 1).fill("a").join(".")}]]`).join("\n");
  for (const [bad, says] of [[`${headers}\n${Array(199).fill("b").join(".")} = 1\n`, "nests deeper than 200"], ["a = 1\na = 2", "given twice"], ["a = \"x", "not closed"], ["[a]\n[a]", "given twice"], ["a = [1", "commas"], ["a = 1 b", "more follows"], ["x = [{ a = 1 }]\n[[x]]", "a value and as an array of tables"], ["a = \"\\q\"", "no escape"], [`a = ${"[".repeat(300)}`, "nests deeper than 200"]]) {
    let message = "";
    try { parseToml(bad); } catch (e) { message = e.message; }
    ok(message.includes(says), `TOML that is no TOML is refused: ${says}`, message);
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
