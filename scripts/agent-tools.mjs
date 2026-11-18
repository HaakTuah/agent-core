// The agent-tools check (floor topic 15, "An agent's own tools are code with its sign-ins"; core archive 225): every
// plug-in, tool server, skill and hook a project configures for its agents is listed under "agentTools" in its licence
// check's config, each entry { "kind", "name", "publisher", "version" }: kind one of plugin, server, skill, hook; a
// publisher named; a version that is one exact version (as SemVer writes one) or a full 40-character commit, which a
// plug-in and a tool server must give and a skill or hook may (each is a file of the project's, pinned by its commit).
// The hooks the starter kit writes for Claude Code, Kiro and Codex (setup/template/claude-settings.json.tmpl,
// kiro-hook.json.tmpl and codex-hooks.json.tmpl, beside this copy) are the core's, listed by it at the core's pin. An
// entry nothing configures fails too, so the list stays true.
//
// What it reads as configured, in the files at the project's root that git does not ignore: `.claude/settings.json`
// and, where it is committed, `.claude/settings.local.json`, each hook by its event, matcher and command ("Stop: bash -c '...'") and
// each plug-in their "enabledPlugins" turn on ("name@marketplace"); `.mcp.json`, each tool server of its "mcpServers";
// and `.claude/skills/`, each folder holding a SKILL.md; and what Kiro and Codex configure (#407), each named with its
// tool first: Kiro's hooks, in each JSON file directly under `.kiro/hooks` ("Kiro Stop: <command>"), and its tool
// servers in `.kiro/settings/mcp.json` ("Kiro <name>"); Codex's hooks in `.codex/hooks.json` and inline in
// `.codex/config.toml` ("Codex Stop: <command>"), the program config.toml's "notify" starts ("Codex notify: <its
// words>"), and its tool servers there ("Codex <name>"; toml.mjs reads it). A link inside the checkout is followed; one
// that leads out of it is not, and fails, save one the base held as it stands. What a person or a machine configures
// outside the repository is no file of the project's (floor rule 18); another tool's settings (Kiro's agents under
// `.kiro/agents`, say, or the plug-ins and marketplaces a Codex config names), and where a plug-in's marketplace or a
// tool server's command points, are the review's. A tool's file, or a folder on its way, in another letter case, as the
// commit holds it, fails, as the tool may read it, save one the base held while what the tool reads through it stands.
// So does a variable a tool's settings set (Claude Code's "env", Codex's shell environment policy) that changes how the
// programs a hook runs start, save one the base held while its entry stands.
//
// Where each hook's command comes from (#407; floor rule 3, what an agent tool starts by itself runs from its copy on
// `main`): a hook of any tool read here runs its copy on main only where each command it may run, Codex's for Windows
// among them, is the starter kit's form (hook-source.mjs), which fetches its script from main, and the file it fetches
// is no link; any other fails, since nothing shows it does not run the working tree's copy, which the branch it runs on
// can change. One that stood before is listed in the baseline, its
// entry saying "from": "the working tree", and noted; the baseline only shrinks: a new hook marked so fails, and so does
// a mark taken out while its hook stands, or a mark on a hook in the kit's form.
//
// A listed plug-in or tool server is held to the pin its own configuration gives, where it gives one in a form read here
// (#352; Claude Code's plug-in and tool-server documentation): a plug-in by its marketplace in "extraKnownMarketplaces",
// a "github" or "git" source at the full commit its "ref" names, or a "settings" source whose entry for it fetches it at
// its "sha" (a "github", "url" or "git-subdir" source) or its exact version (an "npm" source); a tool server of
// `.mcp.json` that npx starts, by the version its package names in its arguments. There the list's version is the pin,
// letter for letter, and a form that takes a pin but names none, or names a range or tag, fails as fetched at no fixed
// version. Elsewhere (a marketplace the project does not declare, a hosted server, another command) whether the listed
// version is the one run stays the review's. A hook the starter kit writes counts as the core's only where it is the kit's
// hook, of the same event and matcher and the same in every field, in this copy or in the base's, so the sync that changes the kit's hooks fails nothing; a release that
// changes them asks in its sync note that a project whose list is written lists the hooks it kept.
//
// Nothing locks a project (AGENTS.md): until the config holds "agentTools", a pull request's base counts as the list,
// read against the first parent of GitHub's merge (licences.mjs's baseOf), so only what the pull request itself adds
// fails; with no base, as on a push, what is unlisted is noted and nothing fails. So too a pin that differs from its
// entry, or a tool fetched at no fixed version: it fails only where the pull request changed that tool's configuration
// or its entry, and is noted where the base held both as they stand, or where there is no base; and a hook that takes a
// file from the working tree, unmarked, fails only where the base held no such hook or marked it, and is noted
// otherwise. The sync note of 16 November 2026 has the step that reads the list written, each pin matched and each
// such hook marked (steps.mjs). In the core's own repository (`--core`) a missing list counts as an empty one, so
// nothing unlisted stands, and no pin breach or hook from the working tree does, marked or not.
// Node's own modules and git only.
//
//   node core/scripts/agent-tools.mjs <the licence check's config>     from a project's root, as licences.yml runs it
//   node scripts/agent-tools.mjs .github/licences.json --core          in the core's own repository
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exact } from "./exact-versions.mjs";
import { DEEPEST, logged, parseBounded } from "./guards.mjs";
import { fetchedBy } from "./hook-source.mjs";
import { baseOf, textAt } from "./licences.mjs";
import { started } from "./started.mjs";
import { parseToml } from "./toml.mjs";

const KINDS = { plugin: "the plug-in", server: "the tool server", skill: "the skill", hook: "the hook" };
const PINNED = new Set(["plugin", "server"]); // (the kinds that must give a version: neither is a file of the project's)
const COMMIT = /^[0-9a-f]{40}$/u; // (a full commit, as git writes it and Claude Code takes it)
const commit = v => typeof v === "string" && COMMIT.test(v);
// (how a "ref" or "sha" that pins nothing reads: none, a branch or tag, or what is no text at all)
const takes = (v, none) => (v === undefined ? none : typeof v === "string" ? `the branch or tag ${show(v)}` : `the value ${show(v)}, which names no commit`);
// (the starter kit's hooks: each file it writes in a project, by the template it writes it from, beside this copy)
// (the mend of a hook that takes a file from the working tree)
const HOW = "write its command in the starter kit's form, as setup/claude-settings.json.tmpl does: bash -c 'f=$(git -C \"${CLAUDE_PROJECT_DIR:-.}\" --no-replace-objects show refs/remotes/origin/main:<the file> 2>/dev/null) || exit 0; bash -c \"$f\"', which runs the copy on main";
const KITS = { ".claude/settings.json": "claude-settings.json.tmpl", ".kiro/hooks/work-saved.json": "kiro-hook.json.tmpl", ".codex/hooks.json": "codex-hooks.json.tmpl" };
const KIT_DIR = fileURLToPath(new URL("../setup/template/", import.meta.url));
// (what an entry's "from" may say: that its hook takes a file of the project from the working tree, as the base held it)
const TREE = "the working tree";
const show = value => JSON.stringify(value) ?? String(value);

// The tools a project's files configure, as "kind name" keys, each with the file that configures it; the problems met
// reading them; `sources`, each hook that does not run its copy on main, with why (readSource()). `read(file)` gives a
// file's text or null; `skills()` the names of the folders under .claude/skills/ that hold a SKILL.md; `files(dir)` the
// names in a folder of the project (here .kiro/hooks); `linked(path)` whether the project, or main, holds a path as a
// link.
export function configured(read, skills, files = () => [], linked = () => false) {
  // (each tool's name, as the list writes it, and what it is: for a hook its tool, event, matcher and the whole hook,
  // its type, command, timeout and all, which is what the kit's hooks and the base's are compared by)
  // (`texts`: each problem met reading a file, with that file's text, so one the base held as it stands can be told)
  const tools = new Map(), ids = new Map(), problems = [], sources = new Map(), servers = [], texts = new Map();
  const flag = (problem, file, text = read(file)) => { problems.push(problem); texts.set(problem, `${file}\0${text}`); };
  const add = (name, id) => ids.set(name, (ids.get(name) ?? new Set()).add(id));
  const state = { tools, problems, texts, flag, add, shapes: new Map(), clashed: new Set(), sources, servers, linked };
  const json = file => {
    const text = read(file);
    if (text === null) return null;
    try { const v = parseBounded(text); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch { /* (below) */ }
    const problem = `${file} cannot be read as a JSON object, nested no deeper than ${DEEPEST} objects and lists. Mend: correct it to JSON, as the tool that reads it takes it`;
    flag(problem, file, text);
    return null;
  };
  // (a list, or any other value that is no object, is refused as the wrong shape, never read by its indexes; here and in
  // Kiro's and Codex's files, as `state.entries`)
  const entries = (file, key, v, form) => {
    if (v === undefined || v === null) return {};
    if (typeof v === "object" && !Array.isArray(v)) return v;
    flag(`${file}: "${key}" is not ${file.endsWith(".toml") ? "a TOML table" : "a JSON object"}. Mend: write it as one, of ${form}, as the tool that reads it takes it`, file);
    return {};
  };
  state.entries = entries;
  const markets = new Map(), plugins = [];
  for (const file of [".claude/settings.json", ".claude/settings.local.json"]) {
    const settings = json(file);
    declaredMarkets(settings, file, markets);
    readHooks(state, file, settings);
    readEnv(state, file, "env", settings?.env);
    for (const [name, on] of Object.entries(entries(file, "enabledPlugins", settings?.enabledPlugins, "each plug-in's \"name@marketplace\" to true"))) if (on) { tools.set(`plugin ${name}`, file); plugins.push(name); }
  }
  // (a plug-in is what its name and its marketplace's declared source make it, so one fetched from elsewhere is another;
  // of a marketplace of the "settings" kind, its own fields and this plug-in's entries alone, as pluginPin() reads it)
  for (const name of plugins) add(`plugin ${name}`, canonical(["plugin", name, marketOf(name, markets)]));
  addServers(state, ".mcp.json", entries(".mcp.json", "mcpServers", json(".mcp.json")?.mcpServers, SERVERS), "");
  for (const name of skills()) { tools.set(`skill ${name}`, `.claude/skills/${name}/SKILL.md`); add(`skill ${name}`, `skill ${name}`); }
  readKiro(state, json, files);
  readCodex(state, json, read);
  return { tools, ids, problems, texts, sources, pins: pinsOf(plugins, markets, servers) };
}

const SERVERS = "each tool server's name to its settings";

// The tool servers of one file's "mcpServers" (or Codex's "mcp_servers"), into configured()'s `state`, each named
// with its tool before it where it is not Claude Code's, as "Kiro docs"; one name configured in two files is refused,
// since the list could not say which of the two it holds.
function addServers(state, file, servers, tool) {
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) return;
  for (const [name, server] of Object.entries(servers)) {
    const key = `server ${tool}${name}`, there = state.tools.get(key);
    if (there !== undefined && there !== file) { state.flag(`${file}: the tool server ${show(tool + name)} is configured in ${there} too, so the list cannot say which it holds. Mend: give one of the two another name, or take one out`, file); continue; }
    state.tools.set(key, file);
    // (a server is its whole entry: its command, arguments, address and all, so one the pull request changes is another)
    state.add(key, canonical(["server", file, name, server ?? null]));
    state.servers.push([key, file, name, server]);
  }
}

// What Kiro configures in the project (tools/kiro.md; kiro.dev, its pages on hooks and on tool servers, read on 16
// November 2026): each JSON file directly under .kiro/hooks, { "version", "hooks": [ { "name", "trigger", "matcher",
// "action": { "type", "command" }, "timeout", "confirm" } ] }, a command hook named by its trigger, matcher and command,
// as "Kiro Stop: <command>"; and the tool servers of .kiro/settings/mcp.json's "mcpServers", as "Kiro <name>".
function readKiro(state, json, files) {
  for (const name of files(".kiro/hooks").filter(n => n.endsWith(".json")).sort()) {
    const file = `.kiro/hooks/${name}`, hooks = json(file)?.hooks;
    // (and a "hooks" that is no list is refused as the wrong shape, as the readers of Claude Code's files refuse theirs)
    if (hooks !== undefined && hooks !== null && !Array.isArray(hooks)) state.flag(`${file}: "hooks" is not a JSON list. Mend: write it as one, of each hook's settings, as Kiro reads it`, file);
    for (const hook of Array.isArray(hooks) ? hooks : []) {
      const action = hook?.action, runs = action?.type === "command" && typeof action.command === "string";
      const confirm = hook?.confirm, options = Array.isArray(confirm?.options) ? confirm.options : [];
      const commands = [runs ? action.command : null, confirm?.confirmCommand, ...options.map(o => o?.run)].filter(c => typeof c === "string");
      const matcher = typeof hook?.matcher === "string" && hook.matcher ? hook.matcher : "";
      addHook(state, file, { tool: "Kiro", event: String(hook?.trigger), matcher, hook, runs, text: runs ? action.command : JSON.stringify(hook), commands });
    }
  }
  addServers(state, ".kiro/settings/mcp.json", state.entries(".kiro/settings/mcp.json", "mcpServers", json(".kiro/settings/mcp.json")?.mcpServers, SERVERS), "Kiro ");
}

// What Codex configures in the project (tools/codex.md; its pages on hooks and on its config, read on 16 November
// 2026): the hooks of .codex/hooks.json, and those written inline in .codex/config.toml under "hooks", both as Claude
// Code's are, each named "Codex <event> <matcher>: <command>"; config.toml's "notify", the program Codex starts at
// each turn's end, as the hook "Codex notify: <its words>"; and config.toml's "mcp_servers", as "Codex <name>".
function readCodex(state, json, read) {
  const hooksFile = json(".codex/hooks.json");
  state.entries(".codex/hooks.json", "hooks", hooksFile?.hooks, "each event to its hooks");
  readHooks(state, ".codex/hooks.json", hooksFile, "Codex");
  const text = read(".codex/config.toml");
  if (text === null) return;
  let config;
  try { config = parseToml(text); } catch (e) {
    const problem = `.codex/config.toml cannot be read as TOML (${e.message}). Mend: correct it to TOML, as Codex reads it`;
    state.flag(problem, ".codex/config.toml", text);
    return;
  }
  state.entries(".codex/config.toml", "hooks", config.hooks, "each event to its hooks");
  readHooks(state, ".codex/config.toml", config, "Codex");
  const notify = config.notify;
  if (Array.isArray(notify) && notify.length && notify.every(w => typeof w === "string")) {
    // (its words are a program and its arguments, each one whole: they are read as the one command a shell would run them
    // as, a word that needs no quote as written and any other single-quoted, so a fetch keeps its context, the kit's form
    // given as bash, -c and its script reads as the kit's, and "scripts/my hook.py" stays one path)
    const command = notify.map(w => (/^[\w./:@%+,=-]+$/u.test(w) ? w : `'${w.replace(/'/gu, "'\\''")}'`)).join(" ");
    addHook(state, ".codex/config.toml", { tool: "Codex", event: "notify", matcher: "", hook: notify, runs: true, text: notify.join(" "), commands: [command] });
  }
  addServers(state, ".codex/config.toml", state.entries(".codex/config.toml", "mcp_servers", config.mcp_servers, SERVERS), "Codex ");
  const policy = state.entries(".codex/config.toml", "shell_environment_policy", config.shell_environment_policy, "its settings");
  readEnv(state, ".codex/config.toml", "shell_environment_policy.set", policy.set);
}

// The variables a shell, git, Node or the system's loader reads as a program starts, before what it was given to run:
// set by a tool's settings for the programs it starts, hooks among them, they change what a hook runs, so that main's
// copy is not all it runs (floor rule 3). Names read as Windows reads them, whatever their case.
const STARTS = /^(?:BASH_ENV|ENV|PATH|NODE_OPTIONS|NODE_PATH|SHELLOPTS|BASHOPTS|PS4|IFS|CDPATH|GLOBIGNORE|GIT_.*|LD_.*|DYLD_.*|BASH_FUNC_.*)$/iu;
// Each such variable a tool's setting `key` in `file` sets, as a problem with the entry's own text, so one the base held
// is noted while that entry stands, whatever else of the file changes.
function readEnv(state, file, key, env) {
  for (const [name, value] of Object.entries(state.entries(file, key, env, "each variable's name to its value"))) {
    if (!STARTS.test(name)) continue;
    const problem = `${file}: "${key}" sets the variable "${name}", which changes how the programs a hook runs start, so nothing shows a hook runs main's copy alone (floor rule 3). Mend: take it out of "${key}", in this pull request; where a tool needs it, the owner sets it on the machine`;
    state.problems.push(problem);
    state.texts.set(problem, `${file}\0${key}\0${name}\0${JSON.stringify(value)}`);
  }
}

// What a plug-in's marketplace declares of it, for its id: the source, or of a "settings" source its own fields and the
// entries of this plug-in's name.
function marketOf(name, markets) {
  const at = name.lastIndexOf("@");
  if (at <= 0) return null; // (a plug-in named with no marketplace, as pluginPin() reads it)
  const source = markets.get(name.slice(at + 1))?.source ?? null;
  if (source?.source !== "settings" || !Array.isArray(source.plugins)) return source;
  return { market: Object.fromEntries(Object.entries(source).filter(([k]) => k !== "plugins")), items: source.plugins.filter(p => p?.name === name.slice(0, at)) };
}

// The marketplaces one settings file declares, each by its name with its source and file, into `markets`: read
// settings.json then settings.local.json, so the second's stand above the first's, as Claude Code reads them.
function declaredMarkets(settings, file, markets) {
  const declared = settings?.extraKnownMarketplaces;
  if (!declared || typeof declared !== "object" || Array.isArray(declared)) return;
  for (const [name, m] of Object.entries(declared)) markets.set(name, { source: m?.source, file });
}

// What one hook of these runs: { runs, whether it is a command hook; text, its name's command; commands, each command
// it may run }, the command Codex runs on Windows in its place among them ("commandWindows", or "command_windows" in
// TOML), whatever the hook's type, each held to the kit's form and named, so its entry in the list reads otherwise than
// the kit's.
const WINDOWS = ["commandWindows", "command_windows"];
function commandsOf(hook) {
  const runs = hook?.type === "command" && typeof hook.command === "string";
  const windows = WINDOWS.filter(k => hook && typeof hook === "object" && Object.hasOwn(hook, k)).map(k => hook[k]);
  if (!runs) return { runs, text: JSON.stringify(hook), commands: windows };
  return { runs, text: `${hook.command}${windows.length ? ` (Windows: ${windows.map(String).join(", ")})` : ""}`, commands: [hook.command, ...windows] };
}
// The hooks one settings file configures, into configured()'s `state`: Claude Code's, or, with `tool`, another tool's
// written the same way (Codex's).
function readHooks(state, file, settings, tool = "") {
  const all = settings?.hooks;
  for (const [event, groups] of Object.entries(all && typeof all === "object" && !Array.isArray(all) ? all : {})) {
    for (const group of Array.isArray(groups) ? groups : []) {
      const matcher = typeof group?.matcher === "string" && group.matcher ? group.matcher : "";
      for (const hook of Array.isArray(group?.hooks) ? group.hooks : []) addHook(state, file, { tool, event, matcher, given: group?.matcher, hook, ...commandsOf(hook) });
    }
  }
}
// One hook, into configured()'s `state`: its name, as the list writes it, `tool`, `event`, `matcher` and `text`; its
// id, all of it; and the files of the project its `commands` take from the working tree.
function addHook(state, file, { tool, event, matcher, given = matcher, hook, runs, text, commands }) {
  const name = `hook ${tool ? `${tool} ` : ""}${event}${matcher ? ` ${matcher}` : ""}: ${text}`;
  // (Claude Code's hooks keep the id they had before other tools were read, so a base read by an older copy is the same)
  const id = canonical(tool ? ["hook", tool, event, given ?? "", hook] : ["hook", event, given ?? "", hook]);
  // (a hook's name is its event, matcher and command, split at the first ": ": a matcher holding one would let two
  // hooks share a name)
  if (matcher.includes(": ") && !state.clashed.has(`matcher ${file} ${event} ${matcher}`)) {
    state.clashed.add(`matcher ${file} ${event} ${matcher}`);
    state.flag(`${file}: the ${show(event)} hooks' matcher ${show(matcher)} holds ": ", which a hook's name splits at. Mend: write the matcher without it, as a pattern that matches the same tools`, file);
  }
  // (a command and a hook of another type whose text reads as that command share a name, and the list could not tell
  // them apart; two command hooks of one command, a timeout apart, are one name for the list, each kept)
  const kinds = state.shapes.get(name) ?? new Set();
  kinds.add(runs);
  if (kinds.size > 1 && !state.clashed.has(name)) { state.clashed.add(name); state.flag(`${file}: a command and a hook of another type share the name ${show(name.slice(5))}. Mend: give the one a command of its own, or take one out`, file); }
  state.shapes.set(name, kinds);
  state.add(name, id);
  state.tools.set(name, file);
  // (the starter kit's own hooks too: they are in its form, and what they fetch must be no link, as any hook's)
  readSource(state, name, commands);
}
// Each hook with a command that is not the starter kit's form, into `state.sources` with why: nothing shows it runs its
// copy on main (hook-source.mjs); nor where the file the kit's form fetches the project holds as a link (`linked`), whose
// target's name main gives in the script's place, a file the branch can change.
function readSource(state, name, commands) {
  for (const command of commands) {
    const at = fetchedBy(command);
    if (at === null) return void state.sources.set(name, "is not in the starter kit's form");
    if (state.linked(at)) return void state.sources.set(name, `fetches ${show(at)} from main, which the project holds as no plain file (a link, a folder or a submodule), so main gives no script but what git prints of it`);
  }
}

// The pins of the plug-ins turned on and the tool servers, by their "kind name" keys, where their configuration gives
// one (pluginPin() and serverPin(), below); `servers` holds each as [key, file, name, its entry].
function pinsOf(plugins, markets, servers) {
  const pins = new Map();
  for (const name of plugins) { const p = pluginPin(name, markets); if (p) pins.set(`plugin ${name}`, p); }
  for (const [key, file, name, server] of servers) { const p = serverPin(file, name, server); if (p) pins.set(key, p); }
  return pins;
}

// What a plug-in's or tool server's own configuration fixes it at: { pin, where } where it names one exact version or a
// full commit; { loose, where, mend } where it is fetched in a form that takes a pin but names none, or a range or tag;
// null where the configuration names nothing read here, which leaves it to the review. Each also holds `from`, the whole
// configuration it was read from (the marketplace's source, the server's entry), never printed: what makes a breach
// the base held the same one, so that a tool given another source or package is no longer held.
const npmSpec = spec => (typeof spec === "string" ? /^((?:@[^\s/@]+\/)?[^\s/@:]+)(?:@(.*))?$/u.exec(spec) : null);
function npmPin(spec, version, where, field, from) {
  const parts = npmSpec(spec);
  if (!parts) return null; // (a link, a path or a git address: the review's)
  const v = parts[2] ?? version;
  if (exact(v)) return { pin: v, where, from };
  return { from, loose: v === undefined ? "names no version, so the newest is fetched" : `names the version ${show(v)}, which is no one exact version`, where, mend: `write it ${field(parts[1])}` };
}
function pluginPin(name, markets) {
  const at = name.lastIndexOf("@");
  const market = at > 0 ? markets.get(name.slice(at + 1)) : undefined;
  const source = market?.source;
  if (!source || typeof source !== "object") return null;
  const where = `the marketplace ${show(name.slice(at + 1))} in ${market.file}`;
  if (source.source === "github" || source.source === "git") {
    if (commit(source.ref)) return { pin: source.ref, where, from: source };
    return { from: source, loose: `takes ${takes(source.ref, "its repository's default branch")}`, where, mend: `set its "ref" to the full 40-character commit of the marketplace meant` };
  }
  if (source.source !== "settings" || !Array.isArray(source.plugins)) return null;
  const item = source.plugins.find(p => p?.name === name.slice(0, at)), entry = item?.source;
  // (what it was read from: every entry of this plug-in's name, so that adding one is a change, and the marketplace's
  // other fields; not its other plug-ins' entries)
  const from = { market: Object.fromEntries(Object.entries(source).filter(([k]) => k !== "plugins")), items: source.plugins.filter(p => p?.name === name.slice(0, at)) };
  const its = `${where}, by its entry for ${show(name.slice(0, at))},`;
  if (from.items.length > 1) return { from, loose: `holds ${from.items.length} entries for ${show(name.slice(0, at))}, so which one is fetched is not plain`, where, mend: "keep one entry for it, fetched at one commit or exact version" };
  if (["github", "url", "git-subdir"].includes(entry?.source)) {
    if (commit(entry.sha)) return { pin: entry.sha, where: its, from };
    return { from, loose: entry.sha === undefined ? `names no "sha", so it takes ${takes(entry.ref, "the repository's default branch")}` : `gives as its "sha" ${show(entry.sha)}, which is no full commit as git writes one`, where: its, mend: `set the entry's "sha" to the full 40-character commit meant` };
  }
  if (entry?.source === "npm") return npmPin(entry.package, entry.version, its, pkg => `with its "package" as "${pkg}" and its "version" one exact version, such as 1.2.3`, from);
  return null;
}
// (npx's own options, read before the package it runs; one it does not know here leaves the server to the review)
const NPX_FLAGS = new Set(["-y", "--yes", "-q", "--quiet"]);
function serverPin(file, name, server) {
  const args = npxArgs(server);
  if (!args) return null;
  const spec = npxPackage(args);
  if (spec === null) return null;
  return npmPin(spec, undefined, `${file}, in the arguments of ${show(name)},`, pkg => `in those arguments as "${pkg}@" and one exact version, such as ${pkg}@1.2.3`, server);
}
// The arguments npx is given, where a stdio server is started by npx, as on Windows through cmd /c too; else null.
function npxArgs(server) {
  if (!server || typeof server !== "object" || (server.type ?? "stdio") !== "stdio" || typeof server.command !== "string") return null;
  const program = text => String(text).replace(/\\/gu, "/").split("/").pop().toLowerCase().replace(/\.(?:cmd|exe)$/u, "");
  let args = Array.isArray(server.args) ? server.args : [];
  let command = program(server.command);
  if (command === "cmd" && /^\/c$/iu.test(args[0] ?? "")) { command = program(args[1] ?? ""); args = args.slice(2); }
  return command === "npx" && args.every(a => typeof a === "string") ? args : null;
}
// The package npx runs, from its arguments: the one its -p or --package names, else the first after its own options;
// null where it is given two, or an option not read here (the review's).
function npxPackage(args) {
  let spec, i = 0;
  for (; i < args.length; i++) {
    const a = args[i];
    if (NPX_FLAGS.has(a)) continue;
    const named = a === "-p" || a === "--package" || a.startsWith("--package=");
    if (named && spec !== undefined) return null;
    if (named) { spec = a.startsWith("--package=") ? a.slice(10) : args[++i]; continue; }
    if (a === "--") i++;
    else if (a.startsWith("-")) return null;
    break;
  }
  return spec ?? args[i];
}

// The hooks the starter kit writes, Claude Code's, Kiro's and Codex's, each by what it is (configured()'s ids): the
// core's, listed by it. `template(name)` gives the text of one of the kit's templates as a copy holds it, or null.
const kitTemplate = name => { try { return fs.readFileSync(path.join(KIT_DIR, name), "utf8"); } catch { return null; } };
export function kitHooks(template = kitTemplate) {
  const read = f => (Object.hasOwn(KITS, f) ? template(KITS[f]) : null);
  const files = dir => Object.keys(KITS).filter(f => path.posix.dirname(f) === dir).map(f => path.posix.basename(f));
  return [...configured(read, () => [], files).ids.values()].flatMap(set => [...set]);
}

// The list a config holds: { keys, versions, from, problems }, keys the "kind name" of each well-formed entry, versions
// its version by the same key, from the keys of the hooks whose entry says "from": "the working tree" (the baseline of
// those that stood before the check read where a hook's command comes from); null where the config holds no "agentTools".
export function listed(config, file) {
  if (!config || !Object.hasOwn(config, "agentTools")) return null;
  const list = config.agentTools, keys = new Set(), versions = new Map(), from = new Set(), problems = [];
  if (!Array.isArray(list)) return { keys, versions, from, problems: [`${file}: "agentTools" is no list. Mend: write it as a list of entries, each { "kind", "name", "publisher", "version" }`] };
  list.forEach((entry, i) => {
    const at = `${file}: "agentTools" entry ${i + 1}${typeof entry?.name === "string" ? ` (${show(entry.name)})` : ""}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) { problems.push(`${at} is no entry. Mend: write it as { "kind", "name", "publisher", "version" }`); return; }
    const bad = entryProblems(entry);
    for (const b of bad) problems.push(`${at}: ${b}`);
    if (bad.length) return;
    keys.add(`${entry.kind} ${entry.name}`);
    versions.set(`${entry.kind} ${entry.name}`, entry.version);
    if (entry.from === TREE) from.add(`${entry.kind} ${entry.name}`);
  });
  return { keys, versions, from, problems };
}
// What is wrong with one entry of the list, each with its mend.
function entryProblems(entry) {
  const bad = [], version = entry.version;
  if (!Object.hasOwn(KINDS, entry.kind)) bad.push(`its kind ${show(entry.kind)} is none of ${Object.keys(KINDS).join(", ")}. Mend: write the kind it is`);
  if (typeof entry.name !== "string" || !entry.name.trim()) bad.push(`it names no tool. Mend: write the name it is configured by`);
  if (typeof entry.publisher !== "string" || !entry.publisher.trim()) bad.push(`it names no publisher. Mend: write who publishes it, "this project" for a file of its own`);
  if (version === undefined ? PINNED.has(entry.kind) : !(exact(version) || /^[0-9a-f]{40}$/u.test(version)))
    bad.push(`${version === undefined ? "it gives no version" : `its version ${show(version)} is not one exact version`}. Mend: write the one it is taken at, such as 1.2.3, or the full 40-character commit`);
  if (Object.hasOwn(entry, "from") && (entry.from !== TREE || entry.kind !== "hook"))
    bad.push(`its "from" is ${show(entry.from)}, where only a hook's entry may say "from", and only ${show(TREE)}. Mend: take "from" out of the entry`);
  return bad;
}

// A value as JSON with every object's keys in order, so that a hook is the same whichever order its keys are written in.
const canonical = value => JSON.stringify(value, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v));

const describe = key => { const at = key.indexOf(" "); return `${KINDS[key.slice(0, at)]} ${show(key.slice(at + 1))}`; };

// What breaks the rule in a project: { problems, unlisted, missing, pins, sources, marked }, the first held against the list
// where there is one, the second the tools configured that neither the list nor the core lists (where there is no
// list, so that a caller may hold them against a base), `missing` those of `problems` that are a tool configured and
// not listed where there is a list, as [key, problem] (the caller holds them against a base too), the third each listed tool whose configuration pins it
// otherwise than its entry, or fetches it at no fixed version, as [key, problem], the fourth, as [key, problem], each
// hook that takes a file of the project from the working tree and whose entry does not say so, and the fifth those
// whose entry says so ("from": "the working tree"), as [key, what is said of it], the baseline, which the caller holds
// to what its base held. `head` is configured()'s answer, `list` listed()'s or null, `kit` kitHooks()'s.
export function check(head, list, kit, file) {
  const { tools, ids } = head;
  const problems = [...(list?.problems ?? [])];
  const unlisted = [...tools.keys()].filter(k => ![...ids.get(k)].every(id => kit.includes(id)) && !list?.keys.has(k));
  const missing = [];
  if (list) {
    for (const k of unlisted) missing.push([k, `${describe(k)}, configured in ${tools.get(k)}, is not listed. Mend: list it under "agentTools" in ${file} with its publisher and, for a plug-in or tool server, one exact version, in this pull request, where its task names it; else take it out`]);
    problems.push(...missing.map(([, problem]) => problem));
    for (const k of list.keys) if (!tools.has(k)) problems.push(`${file}: "agentTools" lists ${describe(k)}, which nothing configures. Mend: take its entry out of the list, in this pull request`);
  }
  const pins = [];
  for (const [k, p] of head.pins ?? []) {
    if (!list?.keys.has(k)) continue;
    const v = list.versions.get(k);
    if (p.loose) pins.push([k, `${describe(k)} is fetched at no fixed version: ${p.where} ${p.loose}. Mend: ${p.mend}, and list that same version under "agentTools" in ${file}, in this pull request`]);
    else if (p.pin !== v) pins.push([k, `${describe(k)} is listed at ${show(v)} in ${file}, but ${p.where} pins it at ${show(p.pin)}. Mend: make the two the same, the list's version or the pin, whichever is the one meant, in this pull request`]);
  }
  return { problems, unlisted: list ? [] : unlisted, missing, pins, ...sourcesOf(head, list, file, problems) };
}
// check()'s `sources` and `marked`, and into `problems` each mark on a hook in the starter kit's form.
function sourcesOf(head, list, file, problems) {
  const sources = [], marked = [];
  for (const [k, why] of head.sources ?? []) {
    const said = `${describe(k)}, configured in ${head.tools.get(k)}, ${why}, so nothing shows that it runs its copy on main, where floor rule 3 has what an agent tool starts by itself run from its copy on main, and not the working tree's, which the branch it runs on can change`;
    if (list?.from?.has(k)) marked.push([k, said]);
    else sources.push([k, `${said}. Mend: ${HOW}, in this pull request`]);
  }
  for (const k of list?.from ?? []) if (head.tools.has(k) && !head.sources?.has(k)) problems.push(`${file}: "agentTools" says of ${describe(k)} "from": ${show(TREE)}, but its command is the starter kit's form, which runs its copy on main. Mend: take "from" out of its entry, in this pull request`);
  return { sources, marked };
}

// The project at `root`, at its working tree or at a commit `rev`: configured()'s answer, and `links`, each link on the
// way to a file that leads out of the checkout, which is not followed (a link inside it is, at a commit as in the tree).
export function readProject(root, rev = null, linkedOnMain = () => false) {
  const links = [], top = fs.realpathSync(root);
  const outside = f => {
    const parts = f.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const at = parts.slice(0, i).join("/");
      let link = false;
      try { link = fs.lstatSync(path.join(root, at)).isSymbolicLink(); } catch { return false; }
      if (!link) continue;
      let real = null;
      try { real = fs.realpathSync(path.join(root, at)); } catch { /* (a link to nothing: read as leading out) */ }
      const rel = real === null ? ".." : path.relative(top, real);
      if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) { if (!links.includes(at)) links.push(at); return true; }
    }
    return false;
  };
  const commit = rev ? commitReader(root, rev) : null;
  // (in the working tree, a file git ignores is a person's or a machine's own, as a .claude/settings.local.json mostly
  // is, and no file of the project's: floor rule 18)
  const ignored = f => { try { execFileSync("git", ["check-ignore", "-q", "--", f], { cwd: root, stdio: "ignore" }); return true; } catch { return false; } };
  const read = rev ? commit.read
    : f => {
      // (a file that is not there is known without asking git, so a hook's command, read word by word, costs no process)
      if (outside(f)) return null;
      let text;
      try { text = fs.readFileSync(path.join(root, f), "utf8"); } catch { return null; }
      return ignored(f) ? null : text;
    };
  // (the names in a folder of the project, at the commit or in the working tree, a link out of the checkout not followed)
  const names = dir => {
    if (rev) return commit.names(dir);
    if (outside(dir)) return [];
    try { return fs.readdirSync(path.join(root, dir)); } catch { return []; }
  };
  const skills = () => names(".claude/skills").filter(n => read(`.claude/skills/${n}/SKILL.md`) !== null);
  // (whether the project holds a path as a link: git's mode 120000 at a commit, a link in the working tree)
  // (or on main, as `linkedOnMain` says: the base, which a hook fetches from until the pull request merges)
  // (anything but a plain file: a link, a folder or a submodule, in the commit's listing; in the working tree, the
  // commit it stands on too, where a submodule shows as an empty folder)
  const own = at => notFile(listing(root, rev ?? "HEAD"), at) || shownNotBlob(root, rev ?? "HEAD", at) || (!rev && (() => { try { const st = fs.lstatSync(path.join(root, at)); return st.isSymbolicLink() || st.isDirectory(); } catch { return false; } })());
  const linked = at => own(at) || linkedOnMain(at);
  const project = configured(read, skills, names, linked);
  // (read at the commit, the working tree's at HEAD, the pull request's head: a file not committed, ignored or not, is
  // no file of the project's, and the base is read the same way)
  for (const [problem, text] of caseProblems(root, rev ?? "HEAD")) { project.problems.push(problem); project.texts.set(problem, text); }
  if (!rev && listing(root, "HEAD").failed) project.problems.push(`the commit HEAD cannot be listed by git (an error, or names past ${LISTING_MAX} bytes), so this check cannot read the tools' files there. Mend: run the check again; where it fails the same way, take out of this pull request what makes its tree too large to list`);
  return { ...project, links };
}

// A commit's files as an agent tool reads them: a path walked as the file system walks it, a link inside the checkout
// followed (walk), a file's text, and the names in a folder.
function commitReader(root, rev) {
  const resolve = f => walk(root, rev, f);
  const read = f => { const r = resolve(f); return r?.type === "blob" ? textAt(root, rev, r.f) : null; };
  const names = dir => {
    const d = resolve(dir);
    return d?.type === "tree" ? [...(listing(root, rev).children.get(d.f) ?? [])] : [];
  };
  // (what a name holds, as a fingerprint reads it: a file's object, or what else stands there, a link's target and a
  // submodule's commit among it, each said with its kind, so no file reads as a link or another file)
  const holds = f => {
    const r = resolve(f), { ids, linked } = listing(root, rev);
    if (r?.type === "blob") return `\0a file\0${ids.get(r.f)}`;
    const parent = resolve(path.posix.dirname(f)), real = parent ? `${parent.f === "." ? "" : `${parent.f}/`}${path.posix.basename(f)}` : null;
    return real !== null && linked.has(real) ? `\0a link to\0${textAt(root, rev, real)}` : `\0${r?.type ?? "nothing"}\0${ids.get(r?.f) ?? ""}`;
  };
  return { resolve, read, names, holds };
}

// Each path on the way to a tool's file that stands in another case at the commit `rev`, as [its problem, what the tool
// reads through it], so one the base held is noted only while that stands letter for letter.
function caseProblems(root, rev) {
  const { resolve, names, holds } = commitReader(root, rev);
  return misnamed(toolPaths(names, at => resolve(at)?.type)).map(([at, want]) =>
    [`${at} is ${want} in another case, which an agent tool reads in its place where the file system ignores case, as macOS's and Windows' do, while this check reads ${want} alone. Mend: rename it to ${want}, in this pull request`, through(at, want, holds, names, f => resolve(f)?.type)]);
}

// Whether a commit's listing holds `at` as anything but a plain file: a link, a folder or a submodule's entry.
const notFile = (l, at) => l.linked.has(at) || l.dirs.has(at) || l.others.has(at);
// Whether what git shows at `rev:at` is no plain file, asked of git for that path alone, so one broken entry elsewhere
// cannot empty what the listing gives: its mode and object, the same object git show resolves, a link's, a folder's (an empty one too, which the listing leaves out)
// or a submodule's; or the object it resolves to, of another kind than a file's whatever its mode says. Replace objects
// are not read, as the kit's form reads none; git asked once a path a commit, and a path it holds nothing at is no
// script either way.
const shown = new Map();
function shownNotBlob(root, rev, at) {
  const key = `${root}\0${rev}\0${at}`;
  if (!shown.has(key)) {
    const ask = (args, input = "") => { try { return execFileSync("git", ["--no-replace-objects", ...args], { cwd: root, encoding: "utf8", input, stdio: ["pipe", "pipe", "ignore"] }); } catch { return ""; } };
    const [mode = "", , oid = ""] = ask(["ls-tree", "-z", rev, "--", at]).split("\0")[0].split("\t")[0].split(" ");
    // (the object git show resolves and its kind, asked in one process: "<object> <kind> <size>", or "<name> missing";
    // a path that holds a line's end could not be asked so, and is no plain file either)
    const [resolved = "", type = ""] = /[\r\n]/u.test(at) ? ["?", "?"] : /^([0-9a-f]{40,64}) (\w+) \d+$/u.exec(ask(["cat-file", "--batch-check"], `${rev}:${at}\n`).trim())?.slice(1) ?? [];
    // (and the entry named must be the object git show resolves: where a tree git would refuse holds two of a name, or
    // out of order, the two can differ, and then nothing shows what is run)
    shown.set(key, resolved !== oid || (mode !== "" && mode !== "100644" && mode !== "100755") || (type !== "" && type !== "blob"));
  }
  return shown.get(key);
}
// A name as a file system that folds case compares it: wholly, so a letter whose upper case is another's ("\u017f" and
// "s") is the same, which lower case alone does not make it.
const fold = name => name.toUpperCase().toLowerCase();
// The tools' files this check reads, and their folders, as each tool names them.
const TOOL_FILES = [".claude/settings.json", ".claude/settings.local.json", ".mcp.json", ".kiro/settings/mcp.json", ".codex/hooks.json", ".codex/config.toml"];
const TOOL_FOLDERS = [".claude/skills/", ".kiro/hooks/"];
// Each step on the way to a tool's file or folder (.codex, .kiro/settings, .claude/skills and the files themselves).
const WAYS = new Set([...TOOL_FILES, ...TOOL_FOLDERS.map(d => d.slice(0, -1))].flatMap(f => f.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/"))));
// Each path of `paths`, or step on its way, a folder or a link among them, that names one of those in another case, and
// each hook file of Kiro's whose ".json" is, and each skill's SKILL.md, as [the path, the name the check reads]: a file
// system that ignores case gives the tool what this check passes by.
function misnamed(paths) {
  const out = new Map();
  for (const at of paths) {
    const parts = at.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const step = parts.slice(0, i).join("/"), low = fold(step);
      if (WAYS.has(low) && step !== low) { out.set(step, low); break; }
    }
    if (path.posix.dirname(at) === ".kiro/hooks" && /\.json$/iu.test(at) && !at.endsWith(".json")) out.set(at, at.replace(/\.json$/iu, ".json"));
    if (parts.length === 4 && at.startsWith(".claude/skills/") && fold(parts[3]) === "skill.md" && parts[3] !== "SKILL.md") out.set(at, `${parts.slice(0, 3).join("/")}/SKILL.md`);
  }
  return [...out];
}
// What a tool reads through `at`, a path in another case that stands for `want`: each tool file under it, and each entry
// of a tool folder under it with its text (and a skill's SKILL.md), so one the base held is noted only while that stands.
// Each step below `at` is found among its folder's own names, in whatever case they stand, as a file system that
// ignores case finds it, every one that matches.
function through(at, want, holds, names, typeOf) {
  const under = f => f === want || f.startsWith(`${want}/`);
  const found = (from, rest) => rest.split("/").filter(Boolean).reduce((dirs, step) => dirs.flatMap(d => names(d).filter(n => fold(n) === fold(step)).sort().map(n => `${d}/${n}`)), [from]);
  // (each entry by what it holds, a file's text or what else stands there, so one added, taken out or changed is seen)
  const text = (name, a) => [`${name}\0${a}\0${holds(a)}`];
  const files = TOOL_FILES.filter(under).flatMap(f => found(at, f.slice(want.length)).flatMap(a => text(f, a)));
  // (of a tool folder's entries, only what the tool reads there: a hook file of Kiro's, a skill's SKILL.md, and the
  // skill's folder itself where it is neither a file nor a folder, by what stands there, a link's target or a
  // submodule's commit)
  const folders = TOOL_FOLDERS.filter(d => under(d.slice(0, -1))).flatMap(d => found(at, d.slice(want.length, -1)).flatMap(dir => names(dir).sort().flatMap(n => {
    const reads = d === ".kiro/hooks/" ? (/\.json$/iu.test(n) ? [`${dir}/${n}`] : []) : [...(["blob", "tree"].includes(typeOf(`${dir}/${n}`)) ? [] : [`${dir}/${n}`]), ...found(`${dir}/${n}`, "SKILL.md")];
    return reads.flatMap(a => text(`${d}${n}`, a));
  })));
  return [at, holds(at), ...files, ...folders].join("\0\0");
}
// The entries on the way to a tool's file, in whatever case they stand: each one the walk reaches as no folder, whose
// name folded is a step of WAYS or lies in a tool folder, a few deep, found through `names`, so a link inside the
// checkout is followed as the rest of the check follows it.
const READS = /^(?:\.kiro\/hooks\/[^/]+\.json|\.claude\/skills\/[^/]+\/skill\.md)$/u, SKILL_DIR = /^\.claude\/skills\/[^/]+$/u;
function toolPaths(names, typeOf) {
  const out = [], folders = TOOL_FOLDERS.map(d => d.slice(0, -1));
  const visit = (at, depth) => {
    for (const n of names(at || ".")) {
      const p = at ? `${at}/${n}` : n, low = fold(p), inFolder = folders.some(d => low.startsWith(`${d}/`));
      // (nor, in a tool folder, a path that is neither what the tool reads nor a skill's folder on its way: never looked at)
      if ((!WAYS.has(low) && !inFolder) || (inFolder && !READS.test(low) && !SKILL_DIR.test(low))) continue;
      // (whatever the walk reaches that is no folder is named, a file, a link that leads nowhere or out, a submodule's
      // entry; in a tool folder, only what the tool reads there, a hook file, a skill's SKILL.md, and a skill's folder
      // that is neither a folder nor a file, through which the tool may read a SKILL.md this check cannot)
      const type = typeOf(p), folder = type === "tree";
      if (!folder && (!inFolder || READS.test(low) || (SKILL_DIR.test(low) && type !== "blob"))) out.push(p);
      if (folder && depth < 4) visit(p, depth + 1);
    }
  };
  visit("", 0);
  return out;
}
// At the commit `rev`, git's own tree is walked as the working tree is, a name at a time as the file system walks it:
// a link inside the repository is followed (forty hops at most, as Linux follows them), its target put before what is
// left of the path, so a ".." in it steps back from the folder the links before it led to; one that leads out of the
// repository is not. Names are read as git stores them (-z: no quoting), each looked up in the commit's one listing, so
// a file read costs git no process but its text's.
// A link's target at a commit, read once; null where it leads out of the repository, or is longer than PATH_MAX, Linux's,
// which no file system follows.
const targets = new Map(), PATH_MAX = 4096;
function target(root, rev, at) {
  const key = `${root}\0${rev}\0${at}`;
  if (!targets.has(key)) {
    const to = textAt(root, rev, at) ?? "/";
    targets.set(key, path.posix.isAbsolute(to) || to.length > PATH_MAX ? null : to);
  }
  return targets.get(key);
}
function walk(root, rev, f) {
  const { blobs, linked, dirs, others } = listing(root, rev), left = f.split("/"), at = [];
  let hops = 0;
  while (left.length) {
    const name = left.shift();
    if (name === "" || name === ".") continue;
    if (name === "..") { if (!at.length) return null; at.pop(); continue; }
    const here = [...at, name].join("/");
    if (linked.has(here)) {
      const to = target(root, rev, here);
      if (++hops > 40 || to === null) return null;
      left.unshift(...to.split("/"));
      continue;
    }
    // (a name with more of the path after it must be a folder: the file system goes neither into a file nor back out of
    // one by "..")
    if (!dirs.has(here) && (left.length || (!blobs.has(here) && !others.has(here)))) return null;
    at.push(name);
  }
  return reached(at.join("/") || ".", blobs, dirs);
}

// The path a walk at a commit reached, and what it is there: the checkout's root, which no listing names (as a link to
// ".." from a folder at the root leads to), and any folder a "tree", a file a "blob", anything else a submodule's.
function reached(f, blobs, dirs) {
  if (f === "." || dirs.has(f)) return { f, type: "tree" };
  return { f, type: blobs.has(f) ? "blob" : "commit" };
}

// The files and links of the commit `rev`, git asked once for each commit: { blobs, links, linked, ids, others, dirs,
// children, failed }; its bound (bytes of names) may be lowered for a test.
const listings = new Map(), LISTING_MAX = Number(process.env.AGENT_TOOLS_LISTING_MAX) > 0 ? Number(process.env.AGENT_TOOLS_LISTING_MAX) : 1 << 28;
function listing(root, rev) {
  const key = `${root}\0${rev}`;
  if (listings.has(key)) return listings.get(key);
  let out = "", failed = false;
  // (a commit git cannot list, an error or names past the bound, is said, never read as one with nothing in it; where
  // there is no such commit, as before a project's first, there is nothing to list)
  const git = (args, opts = {}) => execFileSync("git", ["--no-replace-objects", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], ...opts });
  try { out = git(["ls-tree", "-r", "-z", rev], { maxBuffer: LISTING_MAX }); } catch { try { git(["rev-parse", "-q", "--verify", `${rev}^{commit}`]); failed = true; } catch { /* (no commit) */ } }
  const entries = out.split("\0").filter(Boolean).map(l => { const tab = l.indexOf("\t"), [mode, , id] = l.slice(0, tab).split(" "); return [mode, l.slice(tab + 1), id]; });
  // (a file is a plain or an executable blob; a submodule's entry, 160000, is no file the commit holds)
  const found = { blobs: new Set(entries.filter(([mode]) => mode === "100644" || mode === "100755").map(([, at]) => at)), links: entries.filter(([mode]) => mode === "120000").map(([, at]) => at) };
  found.linked = new Set(found.links);
  // (each entry's object, a file's blob or a submodule's commit, by its path)
  found.ids = new Map(entries.map(([, at, id]) => [at, id]));
  // (and any other entry, a submodule's among them, and the folders on every entry's way, each by its path)
  found.others = new Set(entries.filter(([mode]) => mode !== "100644" && mode !== "100755" && mode !== "120000").map(([, at]) => at));
  found.dirs = new Set(entries.flatMap(([, at]) => at.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))));
  // (the names in each folder, "." the root's, built once)
  found.children = new Map();
  for (const at of [...entries.map(([, a]) => a), ...found.dirs]) {
    const cut = at.lastIndexOf("/"), dir = cut < 0 ? "." : at.slice(0, cut);
    if (!found.children.has(dir)) found.children.set(dir, new Set());
    found.children.get(dir).add(at.slice(cut + 1));
  }
  found.failed = failed;
  listings.set(key, found);
  return found;
}

// Whether the commit `rev` holds the path `at` as a link (git's mode 120000), not a file whose text names the same place.
function linkAt(root, rev, at) {
  try { return execFileSync("git", ["ls-tree", rev, "--", at], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).startsWith("120000 "); } catch { return false; }
}

// The config as the base held it, parsed, or null where it held none as a JSON object.
function configAtBase(root, base, file) {
  if (!base) return null;
  try {
    const held = JSON.parse(textAt(root, base, path.relative(root, path.resolve(root, file)).split(path.sep).join("/")) ?? "null");
    return held && typeof held === "object" && !Array.isArray(held) ? held : null;
  } catch { return null; }
}

// What stood before the check read more, which is noted, not failed, where a list stands and a base is read (never in
// the core's own repository): a tool the base held as it stands, which its list did not name either, and a tool's
// file's problem the base held, the file's text the same letter for letter (Kiro's and Codex's files are read since #407).
function heldBefore(checked, { head, baseProject, baseList, held, core }) {
  if (core || !baseProject) return new Set();
  const sameUnread = p => head.texts.has(p) && head.texts.get(p) === baseProject.texts.get(p);
  return new Set([...checked.missing.filter(([k]) => held(k) && !baseList?.keys.has(k)).map(([, problem]) => problem), ...head.problems.filter(sameUnread)]);
}

// Each pin breach into `fail` or `notes`: one the base held as it stands, the tool's whole configuration (its source or
// package, not only its pin) and its entry both unchanged, is noted, and so is each where there is no base, as on a
// push; in the core's own repository none may stand. A list written for the first time is held to an exact pin at once,
// its entry being the pull request's own text, while a tool its base fetched at no fixed version is noted.
function sortPins(pins, { head, list, baseProject, baseList, core }, fail, notes) {
  for (const [k, problem] of pins) {
    const entry = baseList ? baseList.versions.get(k) === list.versions.get(k) : !head.pins.get(k).pin;
    const same = baseProject && canonical(baseProject.pins.get(k) ?? null) === canonical(head.pins.get(k)) && entry;
    if (core || (baseProject && !same)) fail.push(problem);
    else notes.push(`${baseProject ? "as the base held it" : "with no base to read against"}, nothing fails here: ${problem.replace(". Mend: ", ". To mend: ")}`);
  }
}

// Each hook that takes a file of the project from the working tree into `fail` or `notes`. One that stood in the base,
// the same hook taking the same files, is noted, and so is each where there is no base: unmarked where the base did
// not mark it either (the list unwritten, or written before the check read where a hook's command comes from), and
// marked "from": "the working tree" in its entry, which lists it in the baseline. A new one fails, marked or not, and
// so does one whose mark the pull request took out while it stands: the baseline only shrinks. In the core's own
// repository none may stand.
function sortSources({ sources, marked }, { head, baseProject, baseList, core, file }, fail, notes) {
  const before = new Set(baseProject ? [...baseProject.ids.values()].flatMap(set => [...set]) : []);
  const stood = k => !!baseProject && [...head.ids.get(k)].every(id => before.has(id)) && baseProject.sources.has(k);
  const how = HOW;
  for (const [k, problem] of sources) {
    if (!core && !baseProject) notes.push(`with no base to read against, nothing fails here: ${problem.replace(". Mend: ", ". To mend: ")}`);
    else if (!core && stood(k) && !baseList?.from.has(k)) notes.push(`as the base held it, nothing fails here: ${problem.replace(". Mend: ", ". To mend: ")}; or, to list it in the baseline, give its entry in ${file} "from": ${show(TREE)}`);
    else fail.push(problem);
  }
  for (const [k, said] of marked) {
    if (core) fail.push(`${said}, and in the core's own repository none may stand. Mend: ${how}, and take "from" out of its entry, in this pull request`);
    else if (!baseProject || stood(k)) notes.push(`${said}: its entry lists it in the baseline ("from": ${show(TREE)}), to be worked down`);
    else fail.push(`${said}, and its entry says "from": ${show(TREE)}, but the base held no such hook, and the baseline lists only what stood before. Mend: ${how}, and take "from" out of its entry, in this pull request`);
  }
}

// Each link out of the checkout into `fail`, save one the base held as it stands, into `notes`: what stood before turns
// nothing red.
function sortLinks(root, base, links, fail, notes) {
  for (const at of links) {
    let to = null;
    try { to = fs.readlinkSync(path.join(root, at)); } catch { /* (read as new) */ }
    const said = `${show(at)} is a link that leads out of the checkout, so what it holds is not read`;
    if (base && to !== null && linkAt(root, base, at) && textAt(root, base, at) === to) notes.push(`${said}, as the base held it. Replace it with the file or folder itself`);
    else fail.push(`${said}. Mend: replace it with the file or folder itself, committed in the project, in this pull request`);
  }
}

// The whole check, from the project's root: { fail, notes }.
export function run(root, file, { core = false, base = baseOf(root) } = {}) {
  let config;
  try { config = parseBounded(fs.readFileSync(path.resolve(root, file), "utf8")); } catch (e) {
    return { fail: [`${file} cannot be read (${logged(e.message)}). Mend: name the licence check's config, written as JSON`], notes: [] };
  }
  const head = readProject(root, null, base ? at => notFile(listing(root, base), at) || shownNotBlob(root, base, at) : undefined);
  const atBase = name => textAt(root, base, path.relative(root, path.join(KIT_DIR, name)).split(path.sep).join("/"));
  const kit = [...kitHooks(), ...(base ? kitHooks(atBase) : [])];
  let list = listed(config, file);
  const baseConfig = configAtBase(root, base, file);
  // (a list the base held is no longer missing: taking it out does not bring back the time before it was written)
  if (!list && base) {
    if (baseConfig && Object.hasOwn(baseConfig, "agentTools")) {
      return { fail: [`${file}: "agentTools" is gone, which the base held. Mend: put the list back as the base held it, changing only the entries this pull request's task names`], notes: [] };
    }
  }
  if (!list && core) list = { keys: new Set(), versions: new Map(), from: new Set(), problems: [] };
  const checked = check(head, list, kit, file), { problems, unlisted, pins } = checked;
  const baseProject = base ? readProject(root, base) : null, baseList = base ? listed(baseConfig, file) : null;
  const before = new Set(baseProject ? [...baseProject.ids.values()].flatMap(set => [...set]) : []), held = k => [...head.ids.get(k)].every(id => before.has(id));
  const stood = heldBefore(checked, { head, baseProject, baseList, held, core });
  const fail = [...head.problems, ...problems].filter(p => !stood.has(p));
  const notes = [...stood].map(p => `as the base held it, nothing fails here: ${p.replace(". Mend: ", ". To mend: ")}`);
  sortPins(pins, { head, list, baseProject, baseList, core }, fail, notes);
  sortSources(checked, { head, baseProject, baseList, core, file }, fail, notes);
  sortLinks(root, base, head.links, fail, notes);
  sortUnlisted(unlisted, { head, base, held, file }, fail, notes);
  return { fail, notes };
}

// Each tool configured where no list is written yet, into `fail` or `notes`: the base counts as the list, so one it
// held is noted, as each is where there is no base, and one new in the pull request fails.
function sortUnlisted(unlisted, { head, base, held, file }, fail, notes) {
  if (!unlisted.length) return;
  if (!base) {
    notes.push(`${file} holds no "agentTools" yet, so nothing fails here; not listed: ${unlisted.map(describe).join(", ")}. Write the list as the sync note of 16 November 2026 says`);
    return;
  }
  for (const k of unlisted) {
    if (held(k)) continue;
    fail.push(`${describe(k)}, configured in ${head.tools.get(k)}, is new in this pull request and listed nowhere. Mend: list it under "agentTools" in ${file}, with every tool the project configures, each with its publisher and, for a plug-in or tool server, one exact version, in this pull request, where its task names it; else take it out`);
  }
  if (unlisted.some(held)) notes.push(`not listed, as the base held them: ${unlisted.filter(held).map(describe).join(", ")}. Write the list as the sync note of 16 November 2026 says`);
}

if (started(import.meta.url)) {
  const args = process.argv.slice(2), file = args.find(a => !a.startsWith("--"));
  if (!file) { console.error("usage: node core/scripts/agent-tools.mjs <the licence check's config> [--core]"); process.exit(2); }
  const { fail, notes } = run(process.cwd(), file, { core: args.includes("--core") });
  for (const n of notes) console.log(`note ${logged(n)}`);
  for (const f of fail) console.error(`FAIL: ${logged(f)}`);
  console.log(fail.length ? `${fail.length} of the agent's own tools not as floor topic 15 asks` : "ok   every tool the project configures for its agents is listed");
  process.exitCode = fail.length ? 1 : 0;
}
