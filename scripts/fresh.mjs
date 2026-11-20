// A project beside a fresh start (AGENTS.md, "Nothing locks a project"; core archive 215): what the starter kit of the
// copy this file lies in would write for a new project of the same kind today, against what the project holds, so
// that an earlier sync taken in part, or a row filled poorly, shows where no step's check reads it (steps.mjs, beside
// this file). It lists each difference: a file the kit writes that the project lacks (the configs it writes beside
// its templates too, at the paths the project names for them); of a rule file, the manifest or
// an issue form, a paragraph of the kit's that the project holds nowhere in that file (the words compared with their
// spacing made one, so a reflowed line is no difference), and of a table, a row whose first cell it lacks (a row's
// value is the project's to fill); of a workflow or the hooks' settings, a line of the kit's it lacks (a pin and its
// version comment made one, since a sync and Dependabot move them); of a check's config, a key of the kit's it lacks.
// A paragraph the kit leaves to the project ("FILL IN") and the progress file, the project's own, are not compared.
// Each difference is one the manifest's "Differences" declares on purpose, on the owner's word, by a line that quotes
// the file's path ("AGENTS.md"), so that file is not compared, or a task the project's agents take. The kind is read
// from the project: its owner and name from the manifest and AGENTS.md, npm and NuGet from its calls to the core's
// signature and NuGet checks and from a lock file or a project file of its own, a private repository from its having neither the CodeQL nor the licence workflow, a game
// from "Modules: all". Given earlier kits (the sync gives the kit of the project's old pin and of every release of the
// core's), it lists too what the project still holds of theirs that the kit no longer writes: the wording the core
// has left. It reads only and fails nothing. Node's own modules and git only.
//
//   node core/scripts/fresh.mjs                   from a project's root: the differences, or that there are none
//   node core/scripts/fresh.mjs --older <dir>     and, of each folder under <dir> that holds an earlier copy's
//                                                 setup/template/, what the project still holds that the kit left
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KIT as CHOICES, where } from "./choices-records.mjs";
import { FILES, TEMPLATES, files, licences, sizes } from "./init.mjs";
import { corePath, hooksAt, readCore } from "./core-path.mjs";
import { MODULES } from "./reading.mjs";
import { ownerOf } from "./releases.mjs";
import { KIT as SHAPE, where as shapeAt } from "./shape.mjs";
import { READERS } from "./shape-readers.mjs";
import { started } from "./started.mjs";
import { KIT_CONFIGS, packagesFolder } from "./check-configs.mjs";
import { Unread, copyAt, folded } from "./workflow-calls.mjs";
import { atCopy } from "./step-checks.mjs";
import { call as callOf, configs, plain, project } from "./steps.mjs";

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// (a call that cannot be read, a workflow in a form the core's reader does not know, counts as none here: steps.mjs
// reports it)
const call = (p, name) => { try { return callOf(p, name); } catch { return null; } };
// Whether the project calls the NuGet check: the core's nuget.yml, or core.yml with its input nuget (#376).
const nugetCalled = p => { try { return !!call(p, "nuget.yml") || folded(p, "nuget").length > 0; } catch { return false; } };
const SKIPPED = new Set(["docs/PROGRESS.md"]); // (the progress file: the project's own from its first task)

// The project's own files: neither the core's copy, at the path its manifest names (core-path.mjs), nor an install's.
const ownFiles = p => { const at = corePath(p.root) || "core/"; return p.files.filter(f => !f.startsWith(at) && !f.split("/").includes("node_modules")); };

// The folder of the signature check: as its calls pass it; where none calls it, or that cannot be read, the lock
// file's, `lock` (the differences say why it was not read: configs, in check-configs.mjs).
function signedIn(p, lock) {
  try { const f = packagesFolder(p); if (f !== undefined) return f; } catch (e) { if (!(e instanceof Unread)) throw e; }
  return lock && path.posix.dirname(lock);
}

// The folder of NuGet's files: Dependabot's directory where it names one, "/" being the root itself; else the
// solution's or project file's folder (`built`).
const nugetFolder = (named, built) => named ? named[1].replace(/\/+$/, "") || "." : built ? path.posix.dirname(built) : ".";

// The starter kit's options for a project of the same kind as `p` (steps.mjs reads it), and the pin its manifest names.
export function kind(p) {
  const pin = /^Core: \S+ at ([0-9a-f]{40}),/m.exec(p.manifest)?.[1] ?? "0".repeat(40); // (a carried core: none)
  const o = { owner: ownerOf(p.manifest) ?? "the-owner", name: /^# (.+)$/m.exec(p.read("AGENTS.md") ?? "")?.[1]?.trim() ?? path.basename(p.root) };
  // (npm and NuGet from what the project holds, a lock file or a project file of its own, as well as from its calls to
  // the core's checks: a project that lost such a call still shows as one that needs it)
  const own = ownFiles(p);
  const shallowest = re => own.filter(f => re.test(f)).sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0];
  const lock = shallowest(/(^|\/)(?:package-lock|npm-shrinkwrap)\.json$/);
  const folder = signedIn(p, lock);
  if (folder !== undefined) o.packages = String(folder).replace(/\/+$/, "") || ".";
  const built = shallowest(/\.(sln|slnx|csproj|fsproj|vbproj)$/i);
  const named = /package-ecosystem:\s*"?nuget"?\s*\n\s*directory:\s*"?\/?([^"\n]*)"?/.exec(p.read(".github/dependabot.yml") ?? "");
  if (nugetCalled(p) || built) o.nuget = nugetFolder(named, built);
  if (!p.workflows["codeql.yml"] && !p.workflows["licences.yml"]) o.private = true;
  if (/^Floor: whole\. Modules: all\.$/m.test(p.manifest)) o.game = true;
  return { o, pin };
}

const oneSpace = t => t.replace(/\s+/g, " ").trim();
const pinsAsOne = t => t.replace(/@[0-9a-f]{40}(\s*#\s*v?[\w.-]+)?/g, "@<pin>");
const firstCell = row => /^\|([^|]*)\|/.exec(row)?.[1]?.trim();
const short = t => `${t.slice(0, 70)}${t.length > 70 ? "…" : ""}`;

// What a file holds, as the comparison reads it: of Markdown, its tables' rows by their first cell and its prose with
// the spacing made one; of a check's config (JSON), its keys, since their values are the project's to fill; of
// anything else, the hooks' settings included, its lines, each with its spacing and a comma after it left out. `has` asks whether a unit of another such file
// stands in this one; `units` are this one's own, a paragraph the kit leaves to the project (FILL IN) left out.
function readAs(to, text) {
  const t = text.replace(/\r\n/g, "\n");
  if (/\.md$/.test(to)) {
    const rows = new Set(t.split("\n").filter(l => l.startsWith("|") && !/^\|[\s|:-]+\|$/.test(l)).map(firstCell));
    const prose = oneSpace(pinsAsOne(t.split("\n").filter(l => !l.startsWith("|")).join("\n")));
    const paras = t.split(/\n\s*\n/).filter(b => b.trim() && !b.includes("FILL IN")).map(b => oneSpace(pinsAsOne(b.split("\n").filter(l => !l.startsWith("|")).join("\n")))).filter(Boolean);
    return { units: [...[...rows].map(r => ({ row: r })), ...paras.map(para => ({ para }))], has: u => u.row !== undefined ? rows.has(u.row) : prose.includes(u.para) };
  }
  if (/\.json$/.test(to) && to !== ".claude/settings.json") {
    let keys = null;
    try { keys = Object.keys(JSON.parse(t)); } catch { /* (read below as holding nothing) */ }
    return { units: (keys ?? []).map(key => ({ key })), has: u => !!keys?.includes(u.key), unread: keys === null };
  }
  const lines = new Set(t.split("\n").map(l => pinsAsOne(l).trim().replace(/,$/, "")));
  return { units: [...lines].filter(l => l && !l.startsWith("#") && !l.includes("FILL IN")).map(line => ({ line })), has: u => lines.has(u.line) };
}
const named = u => u.row !== undefined ? `the row "${u.row}"` : u.para !== undefined ? `the paragraph "${short(u.para)}"` : u.key !== undefined ? `the key "${u.key}"` : `the line "${short(u.line)}"`;

// The differences between what the kit writes, `kit` ([path, text]), and the project `p`, each a line to print: what
// it lacks of the kit's, and, of what an earlier kit wrote (`older`, each a kit as `kit` is), what it still holds that
// the kit no longer writes, the wording the core has left.
export function differences(p, kit, older = []) {
  // (a check's config that a workflow names only when it runs is compared nowhere: said, so no comparison goes missing
  // unsaid)
  const out = configs(p).unread.map(why => plain(why, p.root));
  for (const [to, want] of kit) {
    if (SKIPPED.has(to) || p.differences.some(l => l.includes(`"${to}"`))) continue;
    const text = p.read(to);
    if (text === null) { out.push(`${to}: missing (the starter kit writes it today)`); continue; }
    const have = readAs(to, text), now = readAs(to, want);
    if (have.unread) { out.push(`${to}: its content cannot be read as JSON`); continue; }
    const lacks = now.units.filter(u => !have.has(u)).map(named);
    const seen = new Set();
    const left = older.flatMap(k => k.filter(([f]) => f === to).flatMap(([, then]) => readAs(to, then).units))
      .filter(u => !now.has(u) && have.has(u) && !seen.has(named(u)) && seen.add(named(u))).map(u => `${named(u)}, which the starter kit no longer writes`);
    if (lacks.length) out.push(`${to}: lacks ${lacks.join("; ")}`);
    if (left.length) out.push(`${to}: still holds ${left.join("; ")}`);
  }
  return out;
}

// The shape check's baseline, at the path the project's config names for it, else where the kit writes it.
function shapeBaseline(p) {
  let config = null;
  try { config = JSON.parse(p.read(shapeAt(p.manifest)) ?? "null"); } catch { /* (the kit's path, below) */ }
  return typeof config?.baseline === "string" ? config.baseline : "checks/shape-baseline.json";
}

// A file of the kit's as a project whose manifest names the copy's path holds it (#628): the kit writes the copy as core/, and
// its hooks for that path as the commands core-path.mjs gives for another; a core a library carries, which the kit does not
// write, is the manifest's own line, with the floor's own copy's line that follows it. The manifest's "Differences" is the
// project's own to fill: of it, the kit asks only the heading, not its "None.".
function asHeld(p, to, text) {
  const core = readCore(p.manifest), copy = copyAt(p);
  if (to === ".claude/settings.json" && !core.wrong) return hooksAt(atCopy(text, copy), core);
  if (to !== "core-manifest.md") return atCopy(text, copy);
  const own = core.form === "carried" ? /^Core: .*(?:\nFloor copy: .*)?$/m.exec(p.manifest)?.[0] : null;
  const bare = text.replace(/^## Differences\r?\n+None\.[ \t]*$/m, "## Differences");
  return atCopy(own ? bare.replace(/^Core: .*$/m, () => own) : bare, copy);
}

// What the kit of this copy would write for the project `p`; with `templates`, the folder of an earlier kit's
// templates, what that kit would have written: a template it lacks, one this kit added since, gives that file nothing;
// one whose words this kit no longer fills, and a folder with no kit, give that kit nothing.
export function fresh(p, templates = path.join(HERE, TEMPLATES)) {
  const { o, pin } = kind(p);
  const modules = MODULES.flatMap(d => fs.readdirSync(path.join(HERE, d)).filter(n => n.endsWith(".md")));
  const older = templates !== path.join(HERE, TEMPLATES);
  try {
    if (older && !fs.existsSync(templates)) return [];
    const lacking = new Set();
    const read = name => { try { return fs.readFileSync(path.join(templates, name), "utf8"); } catch (e) { if (!older) throw e; lacking.add(name); return ""; } };
    const built = files(o, pin, modules, read);
    const gone = new Set(FILES.filter(([t]) => lacking.has(t)).map(([, to]) => to));
    // (the manifest's "Differences" is the project's own to fill: of it, the kit asks only the heading, not its "None.")
    // (the choice records and the shape check's config at the paths the manifest names for them; the checks' configs
    // at the paths the project holds them, as its workflows and manifest name them: configs, in steps.mjs. One a
    // workflow names only when it runs is compared nowhere here, the other check's still are: steps.mjs reports it not
    // read)
    const at = configs(p);
    const placed = { [CHOICES]: where(p.manifest) ?? CHOICES, [SHAPE]: shapeAt(p.manifest), [KIT_CONFIGS.copies]: at.copies, [KIT_CONFIGS.audit]: at.audit };
    const kit = built.filter(([to]) => !gone.has(to) && placed[to] !== null).map(([to, text]) => [placed[to] ?? to, asHeld(p, to, text)]);
    if (older) return kit;
    // the configs the kit writes beside its templates, by the paths the project runs its checks with, each read by its keys
    // (sizes.json's optional "skip" and "past" left out)
    const { skip, past, ...marks } = sizes({});
    const json = v => `${JSON.stringify(v, null, 2)}\n`;
    // (the licence config as the kit writes it, its "nuget" part in the NuGet check's own where that is another file, or
    // compared nowhere where the NuGet check's cannot be read)
    const { nuget, ...licence } = licences(o, () => false);
    const licenceFiles = nuget && at.nuget !== at.licences ? [[at.licences, json(licence)], [at.nuget, json({ nuget })]] : [[at.licences, json({ ...licence, ...(nuget ? { nuget } : {}) })]];
    return [...kit, [at.sizes, json(marks)], ...licenceFiles, [at.baseline, json({ windows: {} })], [shapeBaseline(p), json({ reads: Object.keys(READERS), listed: {} })]].filter(([to]) => to !== null);
  } catch (e) {
    if (!older) throw e;
    return [];
  }
}

export function report(found) {
  return found.length
    ? [`Beside a fresh start (\`core/scripts/fresh.mjs\`): ${found.length} differences from what the starter kit writes today. Each is declared in the manifest's "Differences", on the owner's word, by a line that quotes the file's path, or is a task the project's agents take.`, ...found.map(d => `- ${d}`)].join("\n")
    : "Beside a fresh start (`core/scripts/fresh.mjs`): no difference from what the starter kit writes today.";
}


if (started(import.meta.url)) {
  try {
    const p = project(process.cwd());
    const at = process.argv.indexOf("--older");
    const older = at < 0 ? [] : fs.readdirSync(process.argv[at + 1]).map(d => fresh(p, path.join(process.argv[at + 1], d, TEMPLATES)));
    console.log(report(differences(p, fresh(p), older)));
  } catch (e) {
    console.error(`FAIL: the project could not be compared (${plain(e.message)}): run it from the project's root, a git repository`);
    process.exitCode = 1;
  }
}
