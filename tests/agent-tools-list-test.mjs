// Tests of agent-tools.mjs (floor topic 15, "An agent's own tools are code with its sign-ins"): the list, what a way
// installs and the sync note's step. Each case a made-up project in a temporary git repository, never a real one, run
// as licences.yml runs the check, and every failure read for its mend (mend.mjs). Git and Node's own modules; the
// projects and their runs stand in scripts/agent-tools-scratch.mjs, which the tests beside this one share.
//
//   node tests/agent-tools-list-test.mjs
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { printed, installedBy } from "../scripts/agent-tools.mjs";
import { readWays, waysOf } from "../scripts/ways.mjs";
import { mended } from "../scripts/mend.mjs";
import { parserLeftOut } from "../scripts/packages.mjs";
import { STEPS, notDone } from "../scripts/steps.mjs";
import { listed } from "../scripts/agent-tools-entries.mjs";
import { run, project, withPlugins, withHook, listing, PLUGIN, KIT, MAIN_HOOK, TREE_HOOK, pr, git, asserting } from "../scripts/agent-tools-scratch.mjs";
import { tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const { passes, fails } = asserting(ok);

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
git(synced, "add", "-A");
git(synced, "commit", "-q", "-m", "the copy");
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
// (a hook outside the kit's form that does run main's copy: its mend is a task weighed by a security judgement, never
// that it be taken out; marked, the step reads done; #1248, point 6)
const weigh = notDone(project({ ".claude/settings.json": withHook(MAIN_HOOK) }), step)[0]?.mend ?? "";
ok(weigh.includes("whether it does is a security judgement, not a mend") && weigh.includes(MAIN_HOOK) && weigh.includes("never taking one out before then") && !weigh.includes("else take it out"),
  "and gives a hook outside the kit's form to a task weighed by a security judgement, never a mend that takes it out", weigh);
const bypass = notDone(project({ ".claude/settings.json": { ...JSON.parse(KIT), permissions: { defaultMode: "bypassPermissions" } } }), step)[0]?.mend ?? "";
ok(bypass.includes("take it out of the project's files") && !bypass.includes("never taking one out"), "while a setting of a kind no kit writes, as a bypass mode, keeps the check's own mend, to take it out", bypass);
ok(!notDone(project({ ".claude/settings.json": withHook(MAIN_HOOK), ...listing({ kind: "hook", name: `PostToolUse: ${MAIN_HOOK}`, publisher: "this project", from: "the working tree" }) }), step).length, "and reads done once such a hook is marked");
// (the way out fits what the hook's command reads: "from": "main" for one that fetches its file from main, as a hook run
// from main's copy does, "the working tree" for one that fetches nothing from it; each, followed, reads done; #1273, point 2)
ok(/PostToolUse: git show refs\/remotes\/origin\/main:scripts\/format\.sh \| bash", [^;]* \("from": "main"\)\.$/u.test(weigh) && !weigh.includes('("from": "the working tree")'), "a hook that fetches its file from main is given \"from\": \"main\" as its way out, never \"the working tree\"", weigh);
const treeWeigh = notDone(project({ ".claude/settings.json": withHook(TREE_HOOK) }), step)[0]?.mend ?? "";
ok(/PostToolUse: bash scripts\/format\.sh", [^;]* \("from": "the working tree"\)\.$/u.test(treeWeigh) && !treeWeigh.includes('("from": "main")'), "and one that fetches nothing from main, \"the working tree\"", treeWeigh);
ok(!notDone(project({ ".claude/settings.json": withHook(MAIN_HOOK), ...listing({ kind: "hook", name: `PostToolUse: ${MAIN_HOOK}`, publisher: "this project", from: "main" }) }), step).length
  && !notDone(project({ ".claude/settings.json": withHook(TREE_HOOK), ...listing({ kind: "hook", name: `PostToolUse: ${TREE_HOOK}`, publisher: "this project", from: "the working tree" }) }), step).length, "and each, marked as its way out says, reads done");
ok(listed({ lockfiles: [] }, "c") === null, "a config with no \"agentTools\" holds no list");
passes(run(project({ ".gitignore": ".claude/settings.local.json\n", ".claude/settings.local.json": { enabledPlugins: { "helper@example-market": true } }, ...listing() })), "a settings.local.json git ignores is a person's own, and not read");
fails(run(pr(project({ ".mcp.json": { mcpServers: { files: { command: "files-server" } } }, ...listing({ kind: "server", name: "files", publisher: "Example Tools", version: "2.0.0" }) }), { "checks/licences.json": { lockfiles: [] } })),
  "a pull request that takes out the list the base held fails", '"agentTools" is gone, which the base held');

done("the list, what a way installs and the sync note's step");
