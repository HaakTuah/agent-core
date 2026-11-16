// What a session reads, by its role and its task (modules/tools.md, "One script says what to read"; modules/roles.md,
// "A file for each role"; core archive 233; #304). Given a role and a task (its issue, its kinds, or the paths changed
// so far), it prints the files to read: at the start the floor (floor/security.md, whole, whatever the role), the
// role's own file under roles/ and the files that file names on its line "Reads at its start:" (a role's file named
// there brings what it names too), with the part of each tool given; then, of the other modules, those the task
// calls for. A module says when it is read in its opening paragraph, which begins "Read", in words matched here:
//   the kind `screen`, the kinds `screen` and `polish`       a kind of task: given with --kind, by a label of that
//                                                              name on the task's issue, or under its "What to read"
//   the path `.github/workflows/`, the paths `a`, `b`         a changed path: a folder (ending in /), a file's name
//                                                              wherever it lies (no /), or a path from the root (* and **)
//   the tool `claude`, every tool but `claude`                the agent tool a session runs in or hands work to
//   at the start, at its start                                read at a role's start: a role's file names it
// A role's file opens "Read ... by the role `<its file's name>`". A project gives its own paths a kind in its manifest,
// under "Reading", a table of a path and a kind in backticks. It needs only that a tool can run a command and read a
// file: no tool's own import or hook; a hook may call it (work-saved.sh, beside this file, does at a session's start,
// from the copy merged into main, so this file stands alone: Node's own modules, git and gh only, nothing beside it).
// It reads only, and what it reads of an issue is data: a label or a word there picks among the core's own files and
// can name no other.
//
//   node core/scripts/reading.mjs <role> [--tool <t>]... [--kind <k>]... [--issue <n or an inbox file>] [--path <p>]...
//   node core/scripts/reading.mjs <role> --changed [<base>]   and, for the paths changed since <base> (where the
//                                                             branch left origin/main), with --line the line
//                                                             "Read for it:" for the pull request's description
//   node core/scripts/reading.mjs --kinds                     each kind, with the files it calls for
//   node scripts/reading.mjs --check                          in the core: every module and role says when it is read
// From a project's root (the core's copy under core/), or the core's own.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const FLOOR = "floor/security.md";
export const START = "Reads at its start:", READY = "Reads before its pull request is ready:";
// The line of a pull request's description that lists what its changed paths called for (pr-description.mjs asks it).
export const READ_LINE = "Read for it:";
// The floor's two files read when needed, by the topics the floor's own opening names, until they are a folder of
// topics that each say when (#304, point 8): the floor's words are not changed for it here.
export const FLOOR_WHEN = {
  "floor/topics.md": { kinds: ["workflow", "input", "dependency", "alert", "licence", "account", "update", "security-review"], paths: [".github/workflows/", ".github/dependabot.yml"] },
  "floor/threat-model.md": { kinds: ["security-review"], paths: [] },
};
const WORD = /^[a-z][a-z0-9-]{0,39}$/u;
const ticks = text => [...String(text).matchAll(/`([^`\n]+)`/gu)].map(m => m[1]);
const LIST = "((?:`[^`\\n]+`(?:,? (?:and |or )?)?)+)";
const clause = (said, lead) => [...said.matchAll(new RegExp(`\\b${lead} ${LIST}`, "gu"))].flatMap(m => ticks(m[1]));

// A file's opening paragraph: the first after its title.
export function opening(text) {
  const lines = String(text ?? "").replace(/\r\n/gu, "\n").split("\n");
  let i = lines.findIndex(l => /^# /u.test(l)) + 1;
  while (i < lines.length && !lines[i].trim()) i++;
  const para = [];
  for (; i < lines.length && lines[i].trim(); i++) para.push(lines[i].trim());
  return para.join(" ");
}

// When a file says it is read: { start, kinds, paths, tools, others (every tool but these), roles }, or null where its
// opening paragraph does not begin "Read".
export function whenOf(text) {
  const said = opening(text);
  if (!/^Read\b/u.test(said)) return null;
  return { start: /\bat (?:the|its) start\b/u.test(said), kinds: clause(said, "the kinds?"), paths: clause(said, "the paths?"),
    tools: clause(said, "the tools?"), others: clause(said, "every tool but"), roles: clause(said, "the roles?") };
}

// The files a role's file names after a lead ("Reads at its start:"), up to the first stop or semicolon.
export function readsOf(text, lead) {
  const lines = String(text ?? "").replace(/\r\n/gu, "\n").split("\n");
  const at = lines.findIndex(l => l.startsWith(`**${lead}**`));
  if (at < 0) return null;
  let end = at;
  while (end + 1 < lines.length && lines[end + 1].trim()) end++;
  const said = lines.slice(at, end + 1).join(" ").slice(lead.length + 4);
  return ticks(said.split(/[;.](?:\s|$)/u)[0]).filter(f => f.endsWith(".md"));
}

// Whether a changed path matches a pattern of a module's line.
export function matches(pattern, file) {
  const p = String(pattern).replace(/^\.\//u, ""), f = String(file).replace(/\\/gu, "/").replace(/^\.\//u, "");
  if (p.endsWith("/")) return f.startsWith(p);
  const glob = s => s.replace(/[.+^${}()|[\]\\?]/gu, "\\$&").replace(/\*\*\/?/gu, "\u0000").replace(/\*/gu, "[^/]*").replace(/\u0000/gu, ".*");
  return new RegExp(`^${glob(p)}$`, "u").test(p.includes("/") ? f : f.split("/").pop());
}

// The core's roles and modules as they say when they are read: `read(file)` gives a file's text or null, `list(folder)`
// the Markdown files of a folder of the core, by their paths in it.
export function gather(read, list) {
  const roles = {}, modules = {};
  for (const f of list("roles")) { const text = read(f); roles[f] = { name: path.posix.basename(f, ".md"), when: whenOf(text), start: readsOf(text, START), ready: readsOf(text, READY) }; }
  for (const f of list("modules")) modules[f] = whenOf(read(f));
  return { roles, modules };
}

// Where the core lies under `dir`: "core/" in a project, "" in the core's own repository, null where neither.
export function coreAt(dir) {
  return ["core/", ""].find(prefix => fs.existsSync(path.join(dir, prefix, "roles")) && fs.existsSync(path.join(dir, prefix, FLOOR))) ?? null;
}
export function library(dir, prefix) {
  const read = f => { try { return fs.readFileSync(path.join(dir, prefix, f), "utf8"); } catch { return null; } };
  const list = folder => { try { return fs.readdirSync(path.join(dir, prefix, folder)).filter(f => f.endsWith(".md")).sort().map(f => `${folder}/${f}`); } catch { return []; } };
  return gather(read, list);
}

// The kinds a project's manifest gives its own paths: the rows of the table under "## Reading", [{ path, kind }].
export function ownPaths(manifest) {
  const part = /^## Reading\n([\s\S]*?)(?=^## |(?![\s\S]))/mu.exec(String(manifest ?? "").replace(/\r\n/gu, "\n"))?.[1] ?? "";
  return part.split("\n").map(l => /^\|\s*`([^`|]+)`\s*\|\s*`([^`|]+)`\s*\|\s*$/u.exec(l)).filter(Boolean).map(m => ({ path: m[1], kind: m[2] })).filter(r => WORD.test(r.kind));
}

// Every kind the modules name, each with the files it calls for.
export function kindsOf(lib) {
  const out = new Map();
  const put = (kind, file) => out.set(kind, [...(out.get(kind) ?? []), file]);
  for (const [f, w] of Object.entries(FLOOR_WHEN)) for (const k of w.kinds) put(k, f);
  for (const [f, w] of Object.entries(lib.modules)) for (const k of w?.kinds ?? []) put(k, f);
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
}

// What the changed paths call for, whatever the role: [{ file, why }], each file once, by the first path that called it.
export function calledByPaths(lib, paths, own = []) {
  const out = new Map(), kinds = new Map();
  for (const p of paths) for (const r of own) if (!kinds.has(r.kind) && matches(r.path, p)) kinds.set(r.kind, `the path ${p}, of the kind ${r.kind} by the manifest's "Reading"`);
  for (const [f, w] of [...Object.entries(FLOOR_WHEN), ...Object.entries(lib.modules)]) {
    if (!w) continue;
    const hit = paths.find(p => w.paths.some(pattern => matches(pattern, p)));
    const kind = w.kinds.find(k => kinds.has(k));
    if (hit !== undefined) out.set(f, `the path ${hit}`); else if (kind) out.set(f, kinds.get(kind));
  }
  return [...out].map(([file, why]) => ({ file, why }));
}

// What a session reads: { start: [file], task: [{ file, why }] }, or { error } where the role has no file. `tools`,
// `kinds` ([{ kind, why }] or names), `paths` and `named` (files an issue names) are the task; `ready` adds what the
// role reads before its pull request is marked ready.
export function reading(lib, { role, tools = [], kinds = [], paths = [], named = [], own = [], ready = false }) {
  const names = Object.values(lib.roles).map(r => r.name);
  const file = Object.keys(lib.roles).find(f => lib.roles[f].name === role);
  if (!file) return { error: `"${role}" is no role the core has a file for. Mend: give one of ${names.join(", ")} (the builder, where your brief names none)` };
  const start = [FLOOR], task = new Map();
  const take = (f, key, add) => { if (lib.roles[f]) { if (key === "start") add(f); for (const g of lib.roles[f][key] ?? []) take(g, key, add); } else add(f); };
  take(file, "start", f => { if (!start.includes(f)) start.push(f); });
  const call = (f, why) => { if (!start.includes(f) && !task.has(f)) task.set(f, why); };
  for (const [f, w] of Object.entries(lib.modules)) {
    if (!w) continue;
    const tool = tools.find(t => w.tools.includes(t) || (w.others.length && !w.others.includes(t)));
    if (tool === undefined) continue;
    if (w.start) { if (!start.includes(f)) start.push(f); } else call(f, `the tool ${tool}`);
  }
  if (ready) take(file, "ready", f => call(f, "before the pull request is marked ready"));
  for (const f of named) call(f, "the issue names it");
  const given = kinds.map(k => (typeof k === "string" ? { kind: k, why: `the kind ${k}` } : k));
  for (const [f, w] of [...Object.entries(FLOOR_WHEN), ...Object.entries(lib.modules)]) {
    const k = given.find(g => w?.kinds.includes(g.kind));
    if (k) call(f, k.why);
  }
  for (const c of calledByPaths(lib, paths, own)) call(c.file, c.why);
  return { start, task: [...task].map(([f, why]) => ({ file: f, why })) };
}

// What is wrong, one line each with its mend, with how the core's roles and modules say when they are read.
export function faults(lib, exists) {
  const found = [], named = new Set();
  const form = "the kind `<a word>`, the path `<a path>` or the tool `<its name>`";
  for (const [f, r] of Object.entries(lib.roles)) {
    if (!WORD.test(r.name)) found.push(`${f}: its name is no word a session can give as its role. Mend: name the file in small letters, digits and hyphens`);
    if (!r.when?.roles.includes(r.name)) found.push(`${f} does not say when it is read. Mend: open it, under its title, with a paragraph that begins "Read" and holds "the role \`${r.name}\`"`);
    if (!r.start) found.push(`${f} names no file its role reads at its start. Mend: give it a paragraph that opens "**${START}**" and names each shared file in backticks, by its path in the core`);
    for (const g of [...(r.start ?? []), ...(r.ready ?? [])]) {
      named.add(g);
      if (!exists(g)) found.push(`${f} names ${g}, which is no file of the core. Mend: name the file as it now stands, or take it out`);
      if (g === FLOOR) found.push(`${f} names ${FLOOR}, which every role reads whatever its file names. Mend: take it out of the line`);
    }
  }
  for (const [f, w] of Object.entries(lib.modules)) {
    if (!w) { found.push(`${f} does not say when it is read. Mend: open it, under its title, with a paragraph that begins "Read" and says when, in words the reading script matches: ${form}; or have a role's file name it`); continue; }
    for (const k of w.kinds) if (!WORD.test(k)) found.push(`${f}: \`${k}\` is no kind the script can match. Mend: write the kind as one word of small letters, digits and hyphens`);
    const by = w.kinds.length + w.paths.length + w.tools.length + w.others.length;
    if (!by && !named.has(f)) found.push(`${f} says "Read" but not when in words the reading script matches, and no role's file names it. Mend: add to its opening paragraph ${form}, or name it on a role's line "${START}"`);
    if (w.start && !named.has(f) && !w.tools.length && !w.others.length) found.push(`${f} says it is read at the start, and no role's file names it. Mend: name it on the line "${START}" of each role that reads it then (roles/), or say when a task calls for it`);
  }
  return found;
}

// The files a description's line lists: its last line that starts "Read for it:", or null where there is none.
export function listed(body) {
  const line = String(body ?? "").split(/\r\n|\r|\n/u).map(l => l.trim()).filter(l => l.startsWith(READ_LINE)).at(-1);
  return line === undefined ? null : ticks(line);
}
// What a description's line lacks of what the changed paths called for, as the failure with its mend; null where
// nothing: the paths called for nothing, or the line lists each file.
export function lineMend(body, called, command) {
  const has = listed(body) ?? [], lacks = called.filter(c => !has.includes(c.file));
  if (!lacks.length) return null;
  return `the description's line "${READ_LINE}" ${listed(body) ? "does not list" : "is missing; it must list"} ${lacks.map(c => `\`${c.file}\` (${c.why})`).join(", ")}, which the changed paths call for. Mend: read each of those files whole, check the change against it, then add it in backticks to a line "${READ_LINE} ..." of the description (${command} prints the line)`;
}

const git = (dir, ...args) => { const r = spawnSync("git", args, { cwd: dir, encoding: "utf8", maxBuffer: 1 << 26 }); return r.status === 0 ? r.stdout : null; };
// The paths changed since `base` (a commit; left out, where the branch left origin/main): committed or not, new files too.
export function changed(dir, base) {
  const from = base || git(dir, "merge-base", "origin/main", "HEAD")?.trim();
  if (!from) return null;
  const diff = git(dir, "diff", "--name-only", "--end-of-options", from), fresh = git(dir, "ls-files", "--others", "--exclude-standard");
  return diff === null ? null : [...new Set(`${diff}\n${fresh ?? ""}`.split("\n").filter(Boolean))];
}

// The section "What to read" of an issue's text (a heading, or a line in bold as the issue forms write it): its words
// in backticks, up to the next heading or line in bold.
export function asked(body) {
  const lines = String(body ?? "").split(/\r\n|\r|\n/u), head = l => /^\s*(?:#{1,6}\s+\S|\*\*[^*]+\*\*\s*$)/u.test(l);
  const at = lines.findIndex(l => head(l) && /^\s*(?:#{1,6}\s+|\*\*)What to read\b/iu.test(l));
  if (at < 0) return [];
  const end = lines.findIndex((l, i) => i > at && head(l));
  return ticks(lines.slice(at + 1, end < 0 ? lines.length : end).join("\n"));
}
// An issue as the task: its labels and its text, by gh for a number, from the file for an item of the inbox's folder.
function issue(dir, which) {
  if (!/^\d{1,9}$/u.test(which)) { try { return { labels: [], body: fs.readFileSync(path.resolve(dir, which), "utf8") }; } catch { return null; } }
  const origin = git(dir, "remote", "get-url", "origin")?.trim() ?? "";
  const repo = process.env.GITHUB_REPOSITORY || /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/u.exec(origin)?.[1] || /\/git\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/u.exec(origin)?.[1];
  if (!repo || !/^[\w.-]+\/[\w.-]+$/u.test(repo) || repo.split("/").some(part => /^\.+$/u.test(part))) return null;
  const r = spawnSync("gh", ["api", `repos/${repo}/issues/${which}`], { cwd: dir, encoding: "utf8", maxBuffer: 1 << 24 });
  try { const got = JSON.parse(r.status === 0 ? r.stdout : "null"); return got && { labels: (got.labels ?? []).map(l => String(l?.name ?? "")), body: String(got.body ?? "") }; } catch { return null; }
}

function main(argv) {
  const dir = process.cwd(), prefix = coreAt(dir);
  const many = flag => argv.flatMap((a, i) => (a === flag && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? [argv[i + 1]] : []));
  if (prefix === null) {
    if (argv.includes("--hook")) return 0;
    console.error("FAIL: the core's roles/ and floor/ are not here. Mend: run it from the project's root, where core/ stands, or from the core's own root"); return 1;
  }
  const lib = library(dir, prefix), at = f => `${prefix}${f}`, self = `node ${prefix}scripts/reading.mjs`;
  const roles = Object.values(lib.roles).map(r => r.name).filter(n => WORD.test(n));
  if (argv.includes("--hook")) {
    if (roles.length) console.log(`What to read is set by your role and your task: \`${self} <role> --issue <its issue>\` prints it (the roles: ${roles.join(", ")}; the builder, where your brief names none), and again with \`--changed\` before a pull request is marked ready.`);
    return 0;
  }
  if (argv.includes("--check")) {
    const found = faults(lib, f => fs.existsSync(path.join(dir, prefix, f)));
    for (const f of found) console.error(`FAIL: ${f}`);
    if (!found.length) console.log(`each of the ${Object.keys(lib.modules).length} modules and ${roles.length} roles says when it is read, in words the reading script matches`);
    return found.length ? 1 : 0;
  }
  const kinds = kindsOf(lib);
  if (argv.includes("--kinds")) { for (const [k, files] of kinds) console.log(`${k.padEnd(16)} ${files.map(at).join(", ")}`); return 0; }
  const role = argv[0] && !argv[0].startsWith("--") ? argv[0] : "";
  const notes = [], given = many("--kind").map(k => ({ kind: k, why: `the kind ${k}` })), named = [];
  for (const k of given) if (!kinds.has(k.kind)) notes.push(`no module is read for the kind "${k.kind}" (${self} --kinds lists them)`);
  for (const which of many("--issue")) {
    const got = issue(dir, which);
    if (!got) { notes.push(`the issue ${which} could not be read: give its kinds with --kind (${self} --kinds lists them)`); continue; }
    for (const l of got.labels) if (kinds.has(l)) given.push({ kind: l, why: `the kind ${l}, the issue's label` });
    for (const word of asked(got.body)) {
      const f = word.replace(/^core\//u, "");
      if (lib.modules[f] !== undefined || lib.roles[f] || FLOOR_WHEN[f]) named.push(f);
      else if (kinds.has(word)) given.push({ kind: word, why: `the kind ${word}, which the issue names` });
      else if (WORD.test(word)) notes.push(`the issue names "${word}" under "What to read", which is no kind or file of the core`);
    }
  }
  let paths = many("--path");
  if (argv.includes("--changed")) {
    const got = changed(dir, many("--changed")[0]);
    if (got === null) notes.push("the changed paths could not be read from git: give each with --path");
    else paths = [...paths, ...got];
  }
  const own = prefix ? ownPaths((() => { try { return fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8"); } catch { return ""; } })()) : [];
  if (argv.includes("--line")) {
    const called = calledByPaths(lib, paths, own);
    console.log(`${READ_LINE} ${called.length ? called.map(c => `\`${at(c.file)}\``).join(", ") : "nothing its paths call for"}`);
    return 0;
  }
  const got = reading(lib, { role, tools: many("--tool"), kinds: given, paths, named, own, ready: argv.includes("--changed") });
  if (got.error) { console.error(`FAIL: ${got.error}`); return 1; }
  console.log(`Read at the start, in the role ${role} (each whole):`);
  for (const f of got.start) console.log(`  ${at(f)}`);
  if (!many("--tool").length) console.log("  and your tool's part: give --tool <its name> (a module names its tool in its opening line)");
  console.log(got.task.length ? "Read for this task:" : "Nothing more is called for by this task as given.");
  for (const t of got.task) console.log(`  ${at(t.file).padEnd(34)} ${t.why}`);
  for (const n of notes) console.log(`note ${n}`);
  return 0;
}

const direct = () => { try { return !process.argv[1] || process.argv[1] === "-" || [process.argv[1], fs.realpathSync(process.argv[1])].some(p => import.meta.url === pathToFileURL(p).href); } catch { return false; } };
if (direct()) process.exitCode = main(process.argv.slice(2));
