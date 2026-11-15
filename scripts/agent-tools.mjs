// The agent-tools check (floor topic 15, "An agent's own tools are code with its sign-ins"; core archive 225): every
// plug-in, tool server, skill and hook a project configures for its agents is listed under "agentTools" in its licence
// check's config, each entry { "kind", "name", "publisher", "version" }: kind one of plugin, server, skill, hook; a
// publisher named; a version that is one exact version (as SemVer writes one) or a full 40-character commit, which a
// plug-in and a tool server must give and a skill or hook may (each is a file of the project's, pinned by its commit).
// The hooks the starter kit writes (setup/template/claude-settings.json.tmpl, beside this copy) are the core's, listed
// by it at the core's pin. An entry nothing configures fails too, so the list stays true.
//
// What it reads as configured, in the files at the project's root that git does not ignore: `.claude/settings.json`
// and, where it is committed, `.claude/settings.local.json`, each hook by its event, matcher and command ("Stop: bash -c '...'") and
// each plug-in their "enabledPlugins" turn on ("name@marketplace"); `.mcp.json`, each tool server of its "mcpServers";
// and `.claude/skills/`, each folder holding a SKILL.md. A link inside the checkout is followed; one that leads out of
// it is not, and fails, save one the base held as it stands. What a person or a machine configures outside the repository is no file of the project's (floor rule 18);
// another provider's settings and where a plug-in's marketplace or a tool server's command points are the review's.
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
// or its entry, and is noted where the base held both as they stand, or where there is no base. The sync note of 16
// November 2026 has the step that reads the list written and each pin matched (steps.mjs). In the core's own
// repository (`--core`) a missing list counts as an empty one, so nothing unlisted stands, and no pin breach does.
// Node's own modules and git only.
//
//   node core/scripts/agent-tools.mjs <the licence check's config>     from a project's root, as licences.yml runs it
//   node scripts/agent-tools.mjs .github/licences.json --core          in the core's own repository
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exact } from "./exact-versions.mjs";
import { baseOf, textAt } from "./licences.mjs";
import { started } from "./started.mjs";

const KINDS = { plugin: "the plug-in", server: "the tool server", skill: "the skill", hook: "the hook" };
const PINNED = new Set(["plugin", "server"]); // (the kinds that must give a version: neither is a file of the project's)
const COMMIT = /^[0-9a-f]{40}$/u; // (a full commit, as git writes it and Claude Code takes it)
const KIT = fileURLToPath(new URL("../setup/template/claude-settings.json.tmpl", import.meta.url));
const show = value => JSON.stringify(value) ?? String(value);
const clean = text => String(text).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/gu, "?");

// The tools a project's files configure, as "kind name" keys, each with the file that configures it; and the problems
// met reading them. `read(file)` gives a file's text or null; `skills()` the names of the folders under .claude/skills/
// that hold a SKILL.md.
export function configured(read, skills) {
  // (each tool's name, as the list writes it, and what it is: for a hook its event, matcher and the whole hook, its type,
  // command, timeout and all, which is what the kit's hooks and the base's are compared by)
  const tools = new Map(), ids = new Map(), shapes = new Map(), clashed = new Set(), problems = [];
  const add = (name, id) => ids.set(name, (ids.get(name) ?? new Set()).add(id));
  const json = file => {
    const text = read(file);
    if (text === null) return null;
    try { const v = JSON.parse(text); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch { /* (below) */ }
    problems.push(`${file} cannot be read as a JSON object. Mend: correct it to JSON, as the tool that reads it takes it`);
    return null;
  };
  // (the marketplaces the project declares, each by its name with its source and file; settings.local.json's above
  // settings.json's, as Claude Code reads them)
  const markets = new Map(), plugins = [];
  for (const file of [".claude/settings.json", ".claude/settings.local.json"]) {
    const settings = json(file);
    const declared = settings?.extraKnownMarketplaces;
    if (declared && typeof declared === "object" && !Array.isArray(declared))
      for (const [name, m] of Object.entries(declared)) markets.set(name, { source: m?.source, file });
    for (const [event, groups] of Object.entries(settings?.hooks ?? {})) {
      for (const group of Array.isArray(groups) ? groups : []) {
        const matcher = typeof group?.matcher === "string" && group.matcher ? ` ${group.matcher}` : "";
        // (a hook's name is its event, matcher and command, split at the first ": ": a matcher holding one would let
        // two hooks share a name)
        if (matcher.includes(": ")) problems.push(`${file}: the ${show(event)} hooks' matcher ${show(group.matcher)} holds ": ", which a hook's name splits at. Mend: write the matcher without it, as a pattern that matches the same tools`);
        for (const hook of Array.isArray(group?.hooks) ? group.hooks : []) {
          const runs = hook?.type === "command" && typeof hook.command === "string";
          const name = `hook ${event}${matcher}: ${runs ? hook.command : JSON.stringify(hook)}`;
          const id = canonical(["hook", event, group.matcher ?? "", hook]);
          // (a command and a hook of another type whose text reads as that command share a name, and the list could not
          // tell them apart; two command hooks of one command, a timeout apart, are one name for the list, each kept)
          const kinds = shapes.get(name) ?? new Set();
          kinds.add(runs);
          if (kinds.size > 1 && !clashed.has(name)) { clashed.add(name); problems.push(`${file}: a command and a hook of another type share the name ${show(name.slice(5))}. Mend: give the one a command of its own, or take one out`); }
          shapes.set(name, kinds);
          add(name, id);
          tools.set(name, file);
        }
      }
    }
    for (const [name, on] of Object.entries(settings?.enabledPlugins ?? {})) if (on) { tools.set(`plugin ${name}`, file); add(`plugin ${name}`, `plugin ${name}`); plugins.push(name); }
  }
  const pins = new Map();
  for (const name of plugins) { const p = pluginPin(name, markets); if (p) pins.set(`plugin ${name}`, p); }
  const servers = json(".mcp.json")?.mcpServers ?? {};
  for (const name of Object.keys(servers)) {
    tools.set(`server ${name}`, ".mcp.json"); add(`server ${name}`, `server ${name}`);
    const p = serverPin(name, servers[name]);
    if (p) pins.set(`server ${name}`, p);
  }
  for (const name of skills()) { tools.set(`skill ${name}`, `.claude/skills/${name}/SKILL.md`); add(`skill ${name}`, `skill ${name}`); }
  return { tools, ids, problems, pins };
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
    if (COMMIT.test(source.ref ?? "")) return { pin: source.ref, where, from: source };
    return { from: source, loose: `takes ${source.ref === undefined ? "its repository's default branch" : `the branch or tag ${show(source.ref)}`}`, where, mend: `set its "ref" to the full 40-character commit of the marketplace meant` };
  }
  if (source.source !== "settings" || !Array.isArray(source.plugins)) return null;
  const entry = source.plugins.find(p => p?.name === name.slice(0, at))?.source;
  const its = `${where}, by its entry for ${show(name.slice(0, at))},`;
  if (["github", "url", "git-subdir"].includes(entry?.source)) {
    if (COMMIT.test(entry.sha ?? "")) return { pin: entry.sha, where: its, from: source };
    return { from: source, loose: `names no "sha", so it takes ${entry.ref === undefined ? "the repository's default branch" : `the branch or tag ${show(entry.ref)}`}`, where: its, mend: `set the entry's "sha" to the full 40-character commit meant` };
  }
  if (entry?.source === "npm") return npmPin(entry.package, entry.version, its, pkg => `with its "package" as "${pkg}" and its "version" one exact version, such as 1.2.3`, source);
  return null;
}
// (npx's own options, read before the package it runs; one it does not know here leaves the server to the review)
const NPX_FLAGS = new Set(["-y", "--yes", "-q", "--quiet"]);
function serverPin(name, server) {
  if (!server || typeof server !== "object" || (server.type ?? "stdio") !== "stdio" || typeof server.command !== "string") return null;
  const program = text => String(text).replace(/\\/gu, "/").split("/").pop().toLowerCase().replace(/\.(?:cmd|exe)$/u, "");
  let args = Array.isArray(server.args) ? server.args : [];
  let command = program(server.command);
  if (command === "cmd" && /^\/c$/iu.test(args[0] ?? "")) { command = program(args[1] ?? ""); args = args.slice(2); }
  if (command !== "npx" || !args.every(a => typeof a === "string")) return null;
  let spec = null, i = 0;
  for (; i < args.length; i++) {
    const a = args[i];
    if (NPX_FLAGS.has(a)) continue;
    if (a === "-p" || a === "--package" || a.startsWith("--package=")) {
      if (spec !== null) return null; // (two packages: the review's)
      spec = a.startsWith("--package=") ? a.slice(10) : args[++i];
      continue;
    }
    if (a === "--") i++;
    else if (a.startsWith("-")) return null;
    break;
  }
  spec ??= args[i];
  return npmPin(spec, undefined, `.mcp.json, in the arguments of ${show(name)},`, pkg => `in those arguments as "${pkg}@" and one exact version, such as ${pkg}@1.2.3`, server);
}

// The hooks the starter kit writes, each by what it is (configured()'s ids): the core's, listed by it. `text` is the
// kit's settings as a copy holds them.
const kitText = () => { try { return fs.readFileSync(KIT, "utf8"); } catch { return null; } };
export function kitHooks(text = kitText()) {
  return text === null ? [] : [...configured(f => (f === ".claude/settings.json" ? text : null), () => []).ids.values()].flatMap(set => [...set]);
}

// The list a config holds: { keys, versions, problems }, keys the "kind name" of each well-formed entry, versions its
// version by the same key; null where the config
// holds no "agentTools".
export function listed(config, file) {
  if (!config || !Object.hasOwn(config, "agentTools")) return null;
  const list = config.agentTools, keys = new Set(), versions = new Map(), problems = [];
  if (!Array.isArray(list)) return { keys, versions, problems: [`${file}: "agentTools" is no list. Mend: write it as a list of entries, each { "kind", "name", "publisher", "version" }`] };
  list.forEach((entry, i) => {
    const at = `${file}: "agentTools" entry ${i + 1}${typeof entry?.name === "string" ? ` (${show(entry.name)})` : ""}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) { problems.push(`${at} is no entry. Mend: write it as { "kind", "name", "publisher", "version" }`); return; }
    const bad = [];
    if (!Object.hasOwn(KINDS, entry.kind)) bad.push(`its kind ${show(entry.kind)} is none of ${Object.keys(KINDS).join(", ")}. Mend: write the kind it is`);
    if (typeof entry.name !== "string" || !entry.name.trim()) bad.push(`it names no tool. Mend: write the name it is configured by`);
    if (typeof entry.publisher !== "string" || !entry.publisher.trim()) bad.push(`it names no publisher. Mend: write who publishes it, "this project" for a file of its own`);
    const version = entry.version;
    if (version === undefined ? PINNED.has(entry.kind) : !(exact(version) || /^[0-9a-f]{40}$/u.test(version)))
      bad.push(`${version === undefined ? "it gives no version" : `its version ${show(version)} is not one exact version`}. Mend: write the one it is taken at, such as 1.2.3, or the full 40-character commit`);
    for (const b of bad) problems.push(`${at}: ${b}`);
    if (!bad.length) { keys.add(`${entry.kind} ${entry.name}`); versions.set(`${entry.kind} ${entry.name}`, version); }
  });
  return { keys, versions, problems };
}

// A value as JSON with every object's keys in order, so that a hook is the same whichever order its keys are written in.
const canonical = value => JSON.stringify(value, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v));

const describe = key => { const at = key.indexOf(" "); return `${KINDS[key.slice(0, at)]} ${show(key.slice(at + 1))}`; };

// What breaks the rule in a project: { problems, unlisted, pins }, the first held against the list where there is one,
// the second the tools configured that neither the list nor the core lists (where there is no list, so that a caller
// may hold them against a base), the third each listed tool whose configuration pins it otherwise than its entry, or
// fetches it at no fixed version, as [key, problem]. `head` is configured()'s answer, `list` listed()'s or null, `kit`
// kitHooks()'s.
export function check(head, list, kit, file) {
  const { tools, ids } = head;
  const problems = [...(list?.problems ?? [])];
  const unlisted = [...tools.keys()].filter(k => ![...ids.get(k)].every(id => kit.includes(id)) && !list?.keys.has(k));
  if (list) {
    for (const k of unlisted) problems.push(`${describe(k)}, configured in ${tools.get(k)}, is not listed. Mend: list it under "agentTools" in ${file} with its publisher and, for a plug-in or tool server, one exact version, in this pull request, where its task names it; else take it out`);
    for (const k of list.keys) if (!tools.has(k)) problems.push(`${file}: "agentTools" lists ${describe(k)}, which nothing configures. Mend: take its entry out of the list, in this pull request`);
  }
  const pins = [];
  for (const [k, p] of head.pins ?? []) {
    if (!list?.keys.has(k)) continue;
    const v = list.versions.get(k);
    if (p.loose) pins.push([k, `${describe(k)} is fetched at no fixed version: ${p.where} ${p.loose}. Mend: ${p.mend}, and list that same version under "agentTools" in ${file}, in this pull request`]);
    else if (p.pin !== v) pins.push([k, `${describe(k)} is listed at ${show(v)} in ${file}, but ${p.where} pins it at ${show(p.pin)}. Mend: make the two the same, the list's version or the pin, whichever is the one meant, in this pull request`]);
  }
  return { problems, unlisted: list ? [] : unlisted, pins };
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
    : f => { if (outside(f) || ignored(f)) return null; try { return fs.readFileSync(path.join(root, f), "utf8"); } catch { return null; } };
  const skills = () => {
    if (rev) {
      const dir = resolve(".claude/skills");
      if (dir?.type !== "tree") return [];
      const names = tree(`${dir.f}/`).map(e => e.f.slice(dir.f.length + 1));
      return names.filter(n => resolve(`.claude/skills/${n}/SKILL.md`)?.type === "blob");
    }
    if (outside(".claude/skills")) return [];
    const dir = path.join(root, ".claude/skills");
    try { return fs.readdirSync(dir).filter(n => !outside(`.claude/skills/${n}/SKILL.md`) && fs.existsSync(path.join(dir, n, "SKILL.md")) && !ignored(`.claude/skills/${n}/SKILL.md`)); } catch { return []; }
  };
  return { ...configured(read, skills), links };
}

// Whether the commit `rev` holds the path `at` as a link (git's mode 120000), not a file whose text names the same place.
function linkAt(root, rev, at) {
  try { return execFileSync("git", ["ls-tree", rev, "--", at], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).startsWith("120000 "); } catch { return false; }
}

// The whole check, from the project's root: { fail, notes }.
export function run(root, file, { core = false, base = baseOf(root) } = {}) {
  let config;
  try { config = JSON.parse(fs.readFileSync(path.resolve(root, file), "utf8")); } catch (e) {
    return { fail: [`${file} cannot be read (${clean(e.message)}). Mend: name the licence check's config, written as JSON`], notes: [] };
  }
  const head = readProject(root);
  const kit = [...kitHooks(), ...(base ? kitHooks(textAt(root, base, path.relative(root, KIT).split(path.sep).join("/"))) : [])];
  let list = listed(config, file);
  let baseConfig = null;
  if (base) try { baseConfig = JSON.parse(textAt(root, base, path.relative(root, path.resolve(root, file)).split(path.sep).join("/")) ?? "null"); } catch { /* (none) */ }
  // (a list the base held is no longer missing: taking it out does not bring back the time before it was written)
  if (!list && base) {
    if (baseConfig && typeof baseConfig === "object" && Object.hasOwn(baseConfig, "agentTools")) {
      return { fail: [`${file}: "agentTools" is gone, which the base held. Mend: put the list back as the base held it, changing only the entries this pull request's task names`], notes: [] };
    }
  }
  if (!list && core) list = { keys: new Set(), problems: [] };
  const { problems, unlisted, pins } = check(head, list, kit, file);
  const fail = [...head.problems, ...problems], notes = [];
  // (a pin breach the base held as it stands, the tool's whole configuration (its source or package, not only its pin)
  // and its entry both unchanged, is noted, and so is each where there is no base, as on a push; in the core's own
  // repository none may stand)
  const baseProject = base ? readProject(root, base) : null;
  const baseList = base ? listed(baseConfig && typeof baseConfig === "object" ? baseConfig : null, file) : null;
  for (const [k, problem] of pins) {
    const same = baseProject && canonical(baseProject.pins.get(k) ?? null) === canonical(head.pins.get(k)) && (!baseList || baseList.versions.get(k) === list.versions.get(k));
    if (core || (base && !same)) fail.push(problem);
    else notes.push(`${base ? "as the base held it" : "with no base to read against"}, nothing fails here: ${problem.replace(". Mend: ", ". To mend: ")}`);
  }
  // (a link out of the checkout fails, save one the base held as it stands: what stood before turns nothing red)
  for (const at of head.links) {
    let to = null;
    try { to = fs.readlinkSync(path.join(root, at)); } catch { /* (read as new) */ }
    const said = `${show(at)} is a link that leads out of the checkout, so what it holds is not read`;
    if (base && to !== null && linkAt(root, base, at) && textAt(root, base, at) === to) notes.push(`${said}, as the base held it. Replace it with the file or folder itself`);
    else fail.push(`${said}. Mend: replace it with the file or folder itself, committed in the project, in this pull request`);
  }
  if (!unlisted.length) return { fail, notes };
  if (!base) {
    notes.push(`${file} holds no "agentTools" yet, so nothing fails here; not listed: ${unlisted.map(describe).join(", ")}. Write the list as the sync note of 16 November 2026 says`);
    return { fail, notes };
  }
  const before = new Set([...baseProject.ids.values()].flatMap(set => [...set])), held = k => [...head.ids.get(k)].every(id => before.has(id));
  for (const k of unlisted) {
    if (held(k)) continue;
    fail.push(`${describe(k)}, configured in ${head.tools.get(k)}, is new in this pull request and listed nowhere. Mend: list it under "agentTools" in ${file}, with every tool the project configures, each with its publisher and, for a plug-in or tool server, one exact version, in this pull request, where its task names it; else take it out`);
  }
  if (unlisted.some(held)) notes.push(`not listed, as the base held them: ${unlisted.filter(held).map(describe).join(", ")}. Write the list as the sync note of 16 November 2026 says`);
  return { fail, notes };
}

if (started(import.meta.url)) {
  const args = process.argv.slice(2), file = args.find(a => !a.startsWith("--"));
  if (!file) { console.error("usage: node core/scripts/agent-tools.mjs <the licence check's config> [--core]"); process.exit(2); }
  const { fail, notes } = run(process.cwd(), file, { core: args.includes("--core") });
  for (const n of notes) console.log(`note ${clean(n)}`);
  for (const f of fail) console.error(`FAIL: ${clean(f)}`);
  console.log(fail.length ? `${fail.length} of the agent's own tools not as floor topic 15 asks` : "ok   every tool the project configures for its agents is listed");
  process.exitCode = fail.length ? 1 : 0;
}
