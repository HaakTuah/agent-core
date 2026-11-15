// The agent-tools check (floor topic 15, "An agent's own tools are code with its sign-ins"; core archive 224): every
// plug-in, tool server, skill and hook a project configures for its agents is listed under "agentTools" in its licence
// check's config, each entry { "kind", "name", "publisher", "version" }: kind one of plugin, server, skill, hook; a
// publisher named; a version that is one exact version (as SemVer writes one) or a full 40-character commit, which a
// plug-in and a tool server must give and a skill or hook may (each is a file of the project's, pinned by its commit).
// The hooks the starter kit writes (setup/template/claude-settings.json.tmpl, beside this copy) are the core's, listed
// by it at the core's pin. An entry nothing configures fails too, so the list stays true.
//
// What it reads as configured, in the files committed at the project's root: `.claude/settings.json` and, where it is
// committed, `.claude/settings.local.json`, each hook by its event, matcher and command ("Stop: bash -c '...'") and
// each plug-in their "enabledPlugins" turn on ("name@marketplace"); `.mcp.json`, each tool server of its "mcpServers";
// and `.claude/skills/`, each folder holding a SKILL.md. A link inside the checkout is followed; one that leads out of
// it is not, and fails, save one the base held as it stands. What a person or a machine configures outside the repository is no file of the project's (floor rule 18);
// another provider's settings, where a plug-in's marketplace or a tool server's command points, and whether the version
// listed is the one run, are the review's. A hook the starter kit writes counts as the core's only where it is the kit's
// hook, of the same event, matcher, type and command, in this copy or in the base's, so the sync that changes the kit's hooks fails nothing; a release that
// changes them asks in its sync note that a project whose list is written lists the hooks it kept.
//
// Nothing locks a project (AGENTS.md): until the config holds "agentTools", a pull request's base counts as the list,
// read against the first parent of GitHub's merge (licences.mjs's baseOf), so only what the pull request itself adds
// fails; with no base, as on a push, what is unlisted is noted and nothing fails. The sync note of 16 November 2026 has
// the step that reads the list written (steps.mjs). In the core's own repository (`--core`) a missing list counts as an
// empty one, so nothing unlisted stands. Node's own modules and git only.
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
const KIT = fileURLToPath(new URL("../setup/template/claude-settings.json.tmpl", import.meta.url));
const show = value => JSON.stringify(value) ?? String(value);
const clean = text => String(text).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/gu, "?");

// The tools a project's files configure, as "kind name" keys, each with the file that configures it; and the problems
// met reading them. `read(file)` gives a file's text or null; `skills()` the names of the folders under .claude/skills/
// that hold a SKILL.md.
export function configured(read, skills) {
  // (each tool's name, as the list writes it, and what it is: for a hook its event, matcher, type and command, or its
  // whole text where it runs no command, which is what the kit's hooks and the base's are compared by)
  const tools = new Map(), ids = new Map(), problems = [];
  const json = file => {
    const text = read(file);
    if (text === null) return null;
    try { const v = JSON.parse(text); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch { /* (below) */ }
    problems.push(`${file} cannot be read as a JSON object. Mend: correct it to JSON, as the tool that reads it takes it`);
    return null;
  };
  for (const file of [".claude/settings.json", ".claude/settings.local.json"]) {
    const settings = json(file);
    for (const [event, groups] of Object.entries(settings?.hooks ?? {})) {
      for (const group of Array.isArray(groups) ? groups : []) {
        const matcher = typeof group?.matcher === "string" && group.matcher ? ` ${group.matcher}` : "";
        // (a hook's name is its event, matcher and command, split at the first ": ": a matcher holding one would let
        // two hooks share a name)
        if (matcher.includes(": ")) problems.push(`${file}: the ${show(event)} hooks' matcher ${show(group.matcher)} holds ": ", which a hook's name splits at. Mend: write the matcher without it, as a pattern that matches the same tools`);
        for (const hook of Array.isArray(group?.hooks) ? group.hooks : []) {
          const runs = hook?.type === "command" && typeof hook.command === "string";
          const name = `hook ${event}${matcher}: ${runs ? hook.command : JSON.stringify(hook)}`;
          const id = JSON.stringify(["hook", event, group.matcher ?? "", runs ? ["command", hook.command] : ["other", hook]]);
          // (two hooks of one name that are not the same hook, as a command and a text that reads the same: neither is
          // told apart from the other in the list)
          if (ids.has(name) && ids.get(name) !== id) problems.push(`${file}: two of the ${show(event)} hooks share the name ${show(name.slice(5))} and are not the same hook. Mend: give the one a command of its own, or take one out`);
          ids.set(name, id);
          tools.set(name, file);
        }
      }
    }
    for (const [name, on] of Object.entries(settings?.enabledPlugins ?? {})) if (on) { tools.set(`plugin ${name}`, file); ids.set(`plugin ${name}`, `plugin ${name}`); }
  }
  for (const name of Object.keys(json(".mcp.json")?.mcpServers ?? {})) { tools.set(`server ${name}`, ".mcp.json"); ids.set(`server ${name}`, `server ${name}`); }
  for (const name of skills()) { tools.set(`skill ${name}`, `.claude/skills/${name}/SKILL.md`); ids.set(`skill ${name}`, `skill ${name}`); }
  return { tools, ids, problems };
}

// The hooks the starter kit writes, each by what it is (configured()'s ids): the core's, listed by it. `text` is the
// kit's settings as a copy holds them.
const kitText = () => { try { return fs.readFileSync(KIT, "utf8"); } catch { return null; } };
export function kitHooks(text = kitText()) {
  return text === null ? [] : [...configured(f => (f === ".claude/settings.json" ? text : null), () => []).ids.values()];
}

// The list a config holds: { keys, problems }, keys the "kind name" of each well-formed entry; null where the config
// holds no "agentTools".
export function listed(config, file) {
  if (!config || !Object.hasOwn(config, "agentTools")) return null;
  const list = config.agentTools, keys = new Set(), problems = [];
  if (!Array.isArray(list)) return { keys, problems: [`${file}: "agentTools" is no list. Mend: write it as a list of entries, each { "kind", "name", "publisher", "version" }`] };
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
    if (!bad.length) keys.add(`${entry.kind} ${entry.name}`);
  });
  return { keys, problems };
}

const describe = key => { const at = key.indexOf(" "); return `${KINDS[key.slice(0, at)]} ${show(key.slice(at + 1))}`; };

// What breaks the rule in a project: { problems, unlisted }, the first held against the list where there is one, the
// second the tools configured that neither the list nor the core lists (where there is no list, so that a caller may
// hold them against a base). `head` is configured()'s answer, `list` listed()'s or null, `kit` kitHooks()'s.
export function check(head, list, kit, file) {
  const { tools, ids } = head;
  const problems = [...(list?.problems ?? [])];
  const unlisted = [...tools.keys()].filter(k => !kit.includes(ids.get(k)) && !list?.keys.has(k));
  if (list) {
    for (const k of unlisted) problems.push(`${describe(k)}, configured in ${tools.get(k)}, is not listed. Mend: list it under "agentTools" in ${file} with its publisher and, for a plug-in or tool server, one exact version, in this pull request, where its task names it; else take it out`);
    for (const k of list.keys) if (!tools.has(k)) problems.push(`${file}: "agentTools" lists ${describe(k)}, which nothing configures. Mend: take its entry out of the list, in this pull request`);
  }
  return { problems, unlisted: list ? [] : unlisted };
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
  const read = rev ? f => { const r = resolve(f); return r?.type === "blob" ? textAt(root, rev, r.f) : null; }
    : f => { if (outside(f)) return null; try { return fs.readFileSync(path.join(root, f), "utf8"); } catch { return null; } };
  const skills = () => {
    if (rev) {
      const dir = resolve(".claude/skills");
      if (dir?.type !== "tree") return [];
      const names = tree(`${dir.f}/`).map(e => e.f.slice(dir.f.length + 1));
      return names.filter(n => resolve(`.claude/skills/${n}/SKILL.md`)?.type === "blob");
    }
    if (outside(".claude/skills")) return [];
    const dir = path.join(root, ".claude/skills");
    try { return fs.readdirSync(dir).filter(n => !outside(`.claude/skills/${n}/SKILL.md`) && fs.existsSync(path.join(dir, n, "SKILL.md"))); } catch { return []; }
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
  if (!list && core) list = { keys: new Set(), problems: [] };
  const { problems, unlisted } = check(head, list, kit, file);
  const fail = [...head.problems, ...problems], notes = [];
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
  const before = new Set(readProject(root, base).ids.values()), held = k => before.has(head.ids.get(k));
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
