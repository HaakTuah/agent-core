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
// `.kiro/agents`, say), and where a plug-in's marketplace or a tool server's command points, are the review's.
//
// Where each hook's command comes from (#407; floor rule 3, what an agent tool starts by itself runs from its copy on
// `main`): a hook of any tool read here that names a file the project holds, other than by fetching it from the
// remote's main (`git show refs/remotes/origin/main:<path>`) or testing that it is there, takes it from the working
// tree, which the branch it runs on can change, and fails (hook-source.mjs says what it reads). One that stood before
// is listed in the baseline, its entry saying "from": "the working tree", and noted; the baseline only shrinks: a new
// hook marked so fails, and so does a mark taken out while its hook stands, or a mark on a hook that takes nothing from
// the working tree.
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
import { fromTree } from "./hook-source.mjs";
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
const KITS = { ".claude/settings.json": "claude-settings.json.tmpl", ".kiro/hooks/work-saved.json": "kiro-hook.json.tmpl", ".codex/hooks.json": "codex-hooks.json.tmpl" };
const KIT_DIR = fileURLToPath(new URL("../setup/template/", import.meta.url));
// (what an entry's "from" may say: that its hook takes a file of the project from the working tree, as the base held it)
const TREE = "the working tree";
const show = value => JSON.stringify(value) ?? String(value);

// The tools a project's files configure, as "kind name" keys, each with the file that configures it; the problems met
// reading them; and `sources`, each hook that takes a file of the project from the working tree, with those files
// (hook-source.mjs). `read(file)` gives a file's text or null; `skills()` the names of the folders under .claude/skills/
// that hold a SKILL.md; `files(dir)` the names in a folder of the project (here .kiro/hooks); `holds(file)` whether the
// project holds a file there, as read() would read it.
export function configured(read, skills, files = () => [], holds = f => read(f) !== null) {
  // (each tool's name, as the list writes it, and what it is: for a hook its tool, event, matcher and the whole hook,
  // its type, command, timeout and all, which is what the kit's hooks and the base's are compared by)
  const tools = new Map(), ids = new Map(), problems = [], sources = new Map(), servers = [];
  const add = (name, id) => ids.set(name, (ids.get(name) ?? new Set()).add(id));
  const state = { tools, problems, add, shapes: new Map(), clashed: new Set(), sources, holds, servers };
  const json = file => {
    const text = read(file);
    if (text === null) return null;
    try { const v = parseBounded(text); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch { /* (below) */ }
    problems.push(`${file} cannot be read as a JSON object, nested no deeper than ${DEEPEST} objects and lists. Mend: correct it to JSON, as the tool that reads it takes it`);
    return null;
  };
  const markets = new Map(), plugins = [];
  for (const file of [".claude/settings.json", ".claude/settings.local.json"]) {
    const settings = json(file);
    declaredMarkets(settings, file, markets);
    readHooks(state, file, settings);
    for (const [name, on] of Object.entries(settings?.enabledPlugins ?? {})) if (on) { tools.set(`plugin ${name}`, file); plugins.push(name); }
  }
  // (a plug-in is what its name and its marketplace's declared source make it, so one fetched from elsewhere is another)
  for (const name of plugins) add(`plugin ${name}`, canonical(["plugin", name, markets.get(name.slice(name.lastIndexOf("@") + 1))?.source ?? null]));
  addServers(state, ".mcp.json", json(".mcp.json")?.mcpServers, "");
  for (const name of skills()) { tools.set(`skill ${name}`, `.claude/skills/${name}/SKILL.md`); add(`skill ${name}`, `skill ${name}`); }
  readKiro(state, json, files);
  readCodex(state, json, read);
  return { tools, ids, problems, sources, pins: pinsOf(plugins, markets, servers) };
}

// The tool servers of one file's "mcpServers" (or Codex's "mcp_servers"), into configured()'s `state`, each named
// with its tool before it where it is not Claude Code's, as "Kiro docs"; one name configured in two files is refused,
// since the list could not say which of the two it holds.
function addServers(state, file, servers, tool) {
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) return;
  for (const [name, server] of Object.entries(servers)) {
    const key = `server ${tool}${name}`, there = state.tools.get(key);
    if (there !== undefined && there !== file) { state.problems.push(`${file}: the tool server ${show(tool + name)} is configured in ${there} too, so the list cannot say which it holds. Mend: give one of the two another name, or take one out`); continue; }
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
    for (const hook of Array.isArray(hooks) ? hooks : []) {
      const action = hook?.action, runs = action?.type === "command" && typeof action.command === "string";
      const confirm = hook?.confirm, options = Array.isArray(confirm?.options) ? confirm.options : [];
      const commands = [runs ? action.command : null, confirm?.confirmCommand, ...options.map(o => o?.run)].filter(c => typeof c === "string");
      const matcher = typeof hook?.matcher === "string" && hook.matcher ? hook.matcher : "";
      addHook(state, file, { tool: "Kiro", event: String(hook?.trigger), matcher, hook, runs, text: runs ? action.command : JSON.stringify(hook), commands });
    }
  }
  addServers(state, ".kiro/settings/mcp.json", json(".kiro/settings/mcp.json")?.mcpServers, "Kiro ");
}

// What Codex configures in the project (tools/codex.md; its pages on hooks and on its config, read on 16 November
// 2026): the hooks of .codex/hooks.json, and those written inline in .codex/config.toml under "hooks", both as Claude
// Code's are, each named "Codex <event> <matcher>: <command>"; config.toml's "notify", the program Codex starts at
// each turn's end, as the hook "Codex notify: <its words>"; and config.toml's "mcp_servers", as "Codex <name>".
function readCodex(state, json, read) {
  readHooks(state, ".codex/hooks.json", json(".codex/hooks.json"), "Codex");
  const text = read(".codex/config.toml");
  if (text === null) return;
  let config;
  try { config = parseToml(text); } catch (e) {
    state.problems.push(`.codex/config.toml cannot be read as TOML (${e.message}). Mend: correct it to TOML, as Codex reads it`);
    return;
  }
  readHooks(state, ".codex/config.toml", config, "Codex");
  const notify = config.notify;
  if (Array.isArray(notify) && notify.length && notify.every(w => typeof w === "string")) {
    // (its words are a program and its arguments, each one whole, so each is read as a single-quoted word of a command:
    // "scripts/my hook.py" stays one path)
    const quoted = notify.map(w => `'${w.replace(/'/gu, "'\\''")}'`).join(" ");
    addHook(state, ".codex/config.toml", { tool: "Codex", event: "notify", matcher: "", hook: notify, runs: true, text: notify.join(" "), commands: [quoted] });
  }
  addServers(state, ".codex/config.toml", config.mcp_servers, "Codex ");
}

// The marketplaces one settings file declares, each by its name with its source and file, into `markets`: read
// settings.json then settings.local.json, so the second's stand above the first's, as Claude Code reads them.
function declaredMarkets(settings, file, markets) {
  const declared = settings?.extraKnownMarketplaces;
  if (!declared || typeof declared !== "object" || Array.isArray(declared)) return;
  for (const [name, m] of Object.entries(declared)) markets.set(name, { source: m?.source, file });
}

// The hooks one settings file configures, into configured()'s `state`: Claude Code's, or, with `tool`, another tool's
// written the same way (Codex's).
function readHooks(state, file, settings, tool = "") {
  const all = settings?.hooks;
  for (const [event, groups] of Object.entries(all && typeof all === "object" && !Array.isArray(all) ? all : {})) {
    for (const group of Array.isArray(groups) ? groups : []) {
      const matcher = typeof group?.matcher === "string" && group.matcher ? group.matcher : "";
      for (const hook of Array.isArray(group?.hooks) ? group.hooks : []) {
        const runs = hook?.type === "command" && typeof hook.command === "string";
        addHook(state, file, { tool, event, matcher, given: group?.matcher, hook, runs, text: runs ? hook.command : JSON.stringify(hook), commands: runs ? [hook.command] : [] });
      }
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
    state.problems.push(`${file}: the ${show(event)} hooks' matcher ${show(matcher)} holds ": ", which a hook's name splits at. Mend: write the matcher without it, as a pattern that matches the same tools`);
  }
  // (a command and a hook of another type whose text reads as that command share a name, and the list could not tell
  // them apart; two command hooks of one command, a timeout apart, are one name for the list, each kept)
  const kinds = state.shapes.get(name) ?? new Set();
  kinds.add(runs);
  if (kinds.size > 1 && !state.clashed.has(name)) { state.clashed.add(name); state.problems.push(`${file}: a command and a hook of another type share the name ${show(name.slice(5))}. Mend: give the one a command of its own, or take one out`); }
  state.shapes.set(name, kinds);
  state.add(name, id);
  state.tools.set(name, file);
  const taken = commands.flatMap(c => fromTree(c, state.holds));
  if (taken.length) state.sources.set(name, [...new Set([...(state.sources.get(name) ?? []), ...taken])]);
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
// check()'s `sources` and `marked`, and into `problems` each mark on a hook that takes nothing from the working tree.
function sourcesOf(head, list, file, problems) {
  const sources = [], marked = [];
  for (const [k, paths] of head.sources ?? []) {
    const said = `${describe(k)}, configured in ${head.tools.get(k)}, takes ${paths.map(show).join(", ")} from the working tree, which the branch it runs on can change, where floor rule 3 has what an agent tool starts by itself run from its copy on main`;
    if (list?.from?.has(k)) marked.push([k, said]);
    else sources.push([k, `${said}. Mend: have it fetch what it runs from main, as the starter kit's hooks do (git show refs/remotes/origin/main:<the file>), in this pull request`]);
  }
  for (const k of list?.from ?? []) if (head.tools.has(k) && !head.sources?.has(k)) problems.push(`${file}: "agentTools" says of ${describe(k)} "from": ${show(TREE)}, but it takes no file of the project from the working tree. Mend: take "from" out of its entry, in this pull request`);
  return { sources, marked };
}

// The project at `root`, at its working tree or at a commit `rev`: configured()'s answer, and `links`, each link on the
// way to a file that leads out of the checkout, which is not followed (a link inside it is, at a commit as in the tree).
export function readProject(root, rev = null) {
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
  // At a commit, git's own tree is walked as the working tree is: a link inside the repository is followed (eight hops at
  // most), one that leads out of it is not, and names are read as git stores them (-z: no quoting).
  const tree = at => {
    let out = "";
    try { out = execFileSync("git", ["ls-tree", "-z", rev, "--", at], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }); } catch { /* (none) */ }
    return out.split("\0").filter(Boolean).map(l => { const tab = l.indexOf("\t"), [mode, type] = l.slice(0, tab).split(" "); return { mode, type, f: l.slice(tab + 1) }; });
  };
  const resolve = (f, hops = 0) => {
    const parts = f.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const at = parts.slice(0, i).join("/"), entry = tree(at).find(e => e.f === at);
      if (!entry) return null;
      if (entry.mode !== "120000") continue;
      const to = path.posix.normalize(path.posix.join(path.posix.dirname(at), textAt(root, rev, at) ?? "/"));
      if (hops >= 8 || to === ".." || to.startsWith("../") || path.posix.isAbsolute(to)) return null;
      return resolve([to, ...parts.slice(i)].join("/"), hops + 1);
    }
    return { f, type: tree(f).find(e => e.f === f)?.type ?? "tree" };
  };
  // (in the working tree, a file git ignores is a person's or a machine's own, as a .claude/settings.local.json mostly
  // is, and no file of the project's: floor rule 18)
  const ignored = f => { try { execFileSync("git", ["check-ignore", "-q", "--", f], { cwd: root, stdio: "ignore" }); return true; } catch { return false; } };
  const read = rev ? f => { const r = resolve(f); return r?.type === "blob" ? textAt(root, rev, r.f) : null; }
    : f => {
      // (a file that is not there is known without asking git, so a hook's command, read word by word, costs no process)
      if (outside(f)) return null;
      let text;
      try { text = fs.readFileSync(path.join(root, f), "utf8"); } catch { return null; }
      return ignored(f) ? null : text;
    };
  // (the names in a folder of the project, at the commit or in the working tree, a link out of the checkout not followed)
  const names = dir => {
    if (rev) { const d = resolve(dir); return d?.type === "tree" ? tree(`${d.f}/`).map(e => e.f.slice(d.f.length + 1)) : []; }
    if (outside(dir)) return [];
    try { return fs.readdirSync(path.join(root, dir)); } catch { return []; }
  };
  const skills = () => names(".claude/skills").filter(n => read(`.claude/skills/${n}/SKILL.md`) !== null);
  return { ...configured(read, skills, names, rev ? heldAt(root, rev, read) : f => read(f) !== null), links };
}

// Whether the commit `rev` holds a file at a path, as configured()'s `holds` asks it word by word of a hook's command:
// from one listing of the commit, git asked once, and through read() only where a link stands on the path's way.
function heldAt(root, rev, read) {
  let blobs = null, links = null;
  return f => {
    if (blobs === null) {
      let out = "";
      try { out = execFileSync("git", ["ls-tree", "-r", "-z", rev], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }); } catch { /* (none) */ }
      const entries = out.split("\0").filter(Boolean).map(l => { const tab = l.indexOf("\t"); return [l.slice(0, tab).split(" ")[0], l.slice(tab + 1)]; });
      blobs = new Set(entries.filter(([mode]) => mode !== "120000").map(([, at]) => at));
      links = entries.filter(([mode]) => mode === "120000").map(([, at]) => at);
    }
    return links.some(at => f === at || f.startsWith(`${at}/`)) ? read(f) !== null : blobs.has(f);
  };
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
  const stood = k => !!baseProject && [...head.ids.get(k)].every(id => before.has(id)) && head.sources.get(k).every(p => baseProject.sources.get(k)?.includes(p));
  const how = `have it fetch what it runs from main, as the starter kit's hooks do (git show refs/remotes/origin/main:<the file>)`;
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
  const head = readProject(root);
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
  const stood = new Set(core || !baseProject ? [] : checked.missing.filter(([k]) => held(k) && !baseList?.keys.has(k)).map(([, problem]) => problem));
  const fail = [...head.problems, ...problems.filter(p => !stood.has(p))];
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
