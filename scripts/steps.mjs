// What a release asks of a project, step by step (AGENTS.md, "Nothing locks a project"; core archive 215): each entry
// of setup/sync-notes.md has a step here, by the entry's lead (its date and its name), with roughly what it costs and
// how it is told done. A step is told done one of three ways, each exact and none by guessing:
//   - "check": this script reads the project and answers done, or not done with the mend, in words a session acts on
//     with no rule file open;
//   - "held": a check of the project's own, named, fails where the step is not done, and its failure says the mend;
//   - "unread": no check reads it exactly, and the step says why; the staged case "steps" plants it and reads what a
//     session did, or says why it cannot (staged/steps.mjs, beside this file).
// A step only the project's owner can do says so ("owner"): it is advisory, labelled `needs-owner` (labels.json, beside
// this file), and the rest goes on. A step the project leaves undone on purpose is declared in its manifest's "Differences", on its owner's
// word, by a line that quotes the step's lead ("13 November 2026, the core has moved"): such a step is not reported.
// The sync runs this from the copy it has just written (sync.mjs, beside this file), so a sync reports every step
// not done, a standing one too, and never fails over one: nothing waits on a step, and running it twice changes
// nothing. It reads only. Node's own modules and git only.
//
//   node core/scripts/steps.mjs          from a project's root: the steps not done, each with its mend; nothing else
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kitHooks, listed, readProject, check as toolsCheck } from "./agent-tools.mjs";
import { CORE } from "./core-address.mjs";
import { importsOf, projectFilesByContent, readProject as readBuildFile } from "./nuget.mjs";
import { NOTES } from "./releases.mjs";
import { parseConfig, where as shapeAt } from "./shape.mjs";
import { started } from "./started.mjs";
import { parseYaml, pathsLetThrough } from "./workflow-run.mjs";

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Roughly what a step costs a project where it is not done yet (a step done costs nothing).
export const COST = {
  check: "nothing while its check passes; else what the failure says, in the pull request it fails",
  line: "a line or two of a protected file: one small pull request of a builder's",
  workflow: "a workflow's change: one small pull request, with floor rule 3's two security reviews",
  read: "a read of the project's own rules or settings against the entry, and a small pull request where one differs",
  config: "a check's config and its first baseline: one small pull request of a builder's; what the baseline lists is a debt worked down by tasks, at the dose the codebase's state sets",
  owner: "the owner's yes, asked once; nothing of a session's beyond the ask",
};

// The entries' leads, in the order the notes hold them: "12 November 2026, builders named by role".
export const leads = text => [...String(text).matchAll(/^- \*\*([^*]+?)\.\*\*/gm)].map(m => m[1]);

// The project at `root`, as the checks read it: its files as git lists them (committed or not, ignored ones left out),
// a file's text (null where it is not there), its manifest's slots and differences, and its workflows' YAML.
export function project(root) {
  const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 })
    .split("\0").filter(f => f && fs.existsSync(path.join(root, f)));
  // (a path the project's own files name is read only inside the project: one that leads out of it reads as missing)
  const inside = f => { const to = path.resolve(root, f), rel = path.relative(path.resolve(root), to); return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? to : null; };
  const read = f => { const to = inside(f); if (!to) return null; try { return fs.readFileSync(to, "utf8").replace(/\r\n/g, "\n"); } catch { return null; } };
  const manifest = read("core-manifest.md") ?? "";
  const differences = (/^## Differences\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(manifest)?.[1] ?? "").split("\n").filter(l => l.trim());
  const workflows = Object.fromEntries(listed.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f)).map(f => {
    let yaml = null;
    try { yaml = parseYaml(read(f)); } catch { /* (a workflow this reader cannot read: a check that needs it says so) */ }
    return [f.slice(".github/workflows/".length), { text: read(f), yaml }];
  }));
  return { root, files: listed, read, manifest, differences, workflows };
}

// A workflow the core's reader cannot read (workflow-run.mjs reads the forms the core's own workflows use): a check that
// would read it throws, naming it, so the step is reported as not read, never as done or as missing.
export class Unread extends Error {}
// (`mentions` says, from a workflow's text, whether the check would read it)
const readable = (p, mentions) => {
  const unread = Object.entries(p.workflows).filter(([, w]) => !w.yaml && mentions(w.text ?? "")).map(([f]) => `.github/workflows/${f}`);
  if (unread.length) throw new Unread(`the core's reader cannot read ${unread.join(", ")}, in a form it does not know`);
};

// A project's calls to a workflow of the core's, by the workflow's name: each its job (uses and with); and the first.
export const calls = (p, name) => (readable(p, text => text.toLowerCase().includes(`/.github/workflows/${name}@`.toLowerCase())), Object.values(p.workflows))
  .flatMap(({ yaml }) => Object.values(yaml?.jobs ?? {}))
  .filter(job => typeof job?.uses === "string" && job.uses.toLowerCase().startsWith(`${CORE}/.github/workflows/${name}@`.toLowerCase()));
export const call = (p, name) => calls(p, name)[0] ?? null;
// The input the project's call to the core's workflow passes (its `with:`), undefined where there is no call or it passes
// none. One that names it only when the workflow runs (an expression) throws, so the check that needs it is reported not
// read, never read as a path.
const input = (p, name, key = "config") => {
  const v = call(p, name)?.with?.[key];
  if (v !== undefined && typeof v !== "string") throw new Unread(`the project's call to the core's ${name} passes its ${key} as no text`);
  if (v?.includes("${{")) throw new Unread(`the project's call to the core's ${name} passes its ${key} as ${v}, which names it only when the workflow runs`);
  return v;
};

const PROJECT_FILES = /\.(cs|fs|vb)proj$/;
// The paths the manifest's slots name for the progress file and the size marks, else the starter kit's.
const slot = (manifest, name, kit) => new RegExp(`^\\|\\s*\\*${name}\\*\\s*\\|\\s*\`([^\`]+)\``, "m").exec(manifest)?.[1] ?? kit;
const progressOf = manifest => slot(manifest, "progress file", "docs/PROGRESS.md");
const marksOf = manifest => slot(manifest, "size marks", "checks/sizes.json");

// What a workflow of the project's runs: the `run:` values of its jobs' steps, a line continued by "\" joined to the
// next, and a shell comment (a line's, or the end of one after a space) left out, so that a comment naming a script is
// never read as running it (#364).
const runs = w => Object.values(w.yaml?.jobs ?? {}).flatMap(job => (job?.steps ?? []).map(s => typeof s?.run === "string" ? s.run : ""))
  .join("\n").split("\n").map(l => l.replace(/(^|[ \t])#.*$/, "")).join("\n").replace(/\\\r?\n/g, " ");
const script = name => new RegExp(`(?<![\\w./-])(?:\\./)?core/scripts/${name.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&")}(?![\\w.-])`);
// The project's own workflows that run a script of its copy of the core (`core/scripts/<name>`), as [file, workflow].
export const runsOwn = (p, name) => (readable(p, text => text.includes(name)), Object.entries(p.workflows)).filter(([, w]) => script(name).test(runs(w)));
// The first argument those workflows pass to it that is no option, quotes taken off; undefined where none passes one. One that names it
// only when the workflow runs (a variable or an expression) throws, so the check that needs it is reported not read.
// (each word after the script as the shell reads it: quoted, or bare up to a space or an operator; an option, which
// starts with "-", is passed over)
const WORD = /^[ \t]+(?:"([^"\n]*)"|'([^'\n]*)'|([^\s"'\\;&|<>]+))/;
const passedTo = (own, name) => {
  const at = new RegExp(`${script(name).source}["']?`, "g");
  for (const [, w] of own) {
    const text = runs(w);
    for (const m of text.matchAll(at)) {
      let rest = text.slice(m.index + m[0].length), word;
      while ((word = WORD.exec(rest))) {
        rest = rest.slice(word[0].length);
        const passed = word[1] ?? word[2] ?? word[3];
        if (passed.startsWith("-")) continue;
        if (/[$%{]/.test(passed)) throw new Unread(`the project's own workflow passes the config of core/scripts/${name} as ${passed}, which names it only when the workflow runs`);
        return passed;
      }
    }
  }
  return undefined;
};
// The configs of the project's licence and copies checks where the project holds them (#366), each as the check is run:
// the config a call to the core's workflow passes, else the one a workflow of the project's own passes to the script
// (of the licence check, the agent-tools check's first, which runs beside it), else, of the copies check, the one the
// manifest's *copies check* slot names, else, of the licence check, the NuGet check's input, else the starter kit's
// path; and the licence check's audit and the copies check's baseline as those configs name them, else the kit's.
export const KIT_CONFIGS = { licences: "checks/licences.json", audit: "checks/licences-audit.json", copies: "checks/copies.json", baseline: "checks/copies-baseline.json" };
const key = (p, file, name) => { try { const v = JSON.parse(p.read(file) ?? "null")?.[name]; return typeof v === "string" && v ? v : null; } catch { return null; } };
// Each check's apart, so that one whose config cannot be read throws alone (Unread, above), never the other's.
export function licenceConfigs(p) {
  const licences = input(p, "licences.yml")
    ?? (calls(p, "licences.yml").length ? undefined : passedTo(runsOwn(p, "agent-tools.mjs"), "agent-tools.mjs") ?? passedTo(runsOwn(p, "licences.mjs"), "licences.mjs"))
    ?? input(p, "nuget.yml") ?? KIT_CONFIGS.licences;
  return { licences, audit: key(p, licences, "audit") ?? KIT_CONFIGS.audit };
}
export function copiesConfigs(p) {
  // (the slot's own cell: the backticked file that is neither the script nor a command)
  const slotted = (/^\|\s*\*copies check\*\s*\|([^|\n]*)/m.exec(p.manifest)?.[1].match(/`[^`]+`/g) ?? []).map(v => v.slice(1, -1)).find(v => !/\s/.test(v) && !/^(\.\/)?core\//.test(v));
  const copies = input(p, "copies.yml") ?? passedTo(runsOwn(p, "copies.mjs"), "copies.mjs") ?? slotted ?? KIT_CONFIGS.copies;
  return { copies, baseline: key(p, copies, "baseline") ?? KIT_CONFIGS.baseline };
}
// The NuGet check's config: its own input where the project calls it, read first, so that it stands where the licence
// check's cannot be read; else the licence check's.
const nugetOf = (p, licences) => input(p, "nuget.yml") ?? licences();
// All of them, with the NuGet check's as `nuget`; each path null where its check's config cannot be read (Unread), and
// why under `unread`, so the reader can say what it did not compare. Any other error is thrown, never hidden.
export function configs(p) {
  const unread = [];
  const or = (read, names) => { try { return read(p); } catch (e) { if (!(e instanceof Unread)) throw e; unread.push(e.message); return Object.fromEntries(names.map(n => [n, null])); } };
  const licence = or(licenceConfigs, ["licences", "audit"]);
  const nuget = or(q => ({ nuget: nugetOf(q, () => licence.licences) }), ["nuget"]);
  return { ...licence, ...nuget, ...or(copiesConfigs, ["copies", "baseline"]), unread: [...new Set(unread)] };
}
const licenceConfig = p => licenceConfigs(p).licences;
const nugetConfig = p => nugetOf(p, () => licenceConfig(p));

// Whether the shape check's own list is written (AGENTS.md, "Nothing locks a project": no old breach goes unlisted):
// its config, where the manifest names it or the starter kit writes it, read as the check reads it, and the baseline
// that config names. Null where both stand; else the mend.
function shapeWritten(p) {
  const at = shapeAt(p.manifest), text = p.read(at);
  const first = `write its first baseline with \`node core/scripts/shape.mjs ${at} --first\`, commit both, and name both in \`SECURITY.md\` under rule 3, among the checks on the work`;
  if (text === null) return `Write \`${at}\` as the starter kit does (\`core/setup/template/shape.json.tmpl\`), with the project's own code under "code" and its test files under "tests", as git pathspecs; then ${first}. Until then the shape check holds the project to the starter kit's config, with each pull request's base as its baseline.`;
  let config;
  try { config = parseConfig(text, at); } catch (e) { return `Mend \`${at}\`, which the shape check cannot read (${plain(String(e.message).split(". Mend: ")[0], p.root)}), as \`node core/scripts/shape.mjs\` says; then ${first}.`; }
  return p.read(config.baseline) === null ? `The shape check's config stands at \`${at}\` and its baseline does not: ${first}.` : null;
}

// Where the project's call to the NuGet check starts only on the paths it names, each build file a build reads by
// another name than those (an Import's, a property's MSBuild's targets import, a file whose root is a Project), as the
// core's NuGet check lists them, that the filter lets through no change to; null where it names none.
function nugetPathsHold(p) {
  readable(p, text => /\/\.github\/workflows\/nuget\.yml@/i.test(text));
  const filtered = Object.entries(p.workflows).filter(([, w]) => Array.isArray(w.yaml?.on?.pull_request?.paths) && Object.values(w.yaml?.jobs ?? {})
    .some(job => typeof job?.uses === "string" && job.uses.toLowerCase().startsWith(`${CORE}/.github/workflows/nuget.yml@`.toLowerCase())));
  if (!filtered.length) return null;
  const own = p.files.filter(f => !f.startsWith("core/")), byContent = projectFilesByContent(p.root, own);
  const read = [...new Set([...byContent, ...importsOf(own, f => readBuildFile(p.root, f), byContent).brought.keys()])];
  const wrong = filtered.map(([f, w]) => [f, read.filter(r => !pathsLetThrough(w.yaml.on.pull_request.paths, [r]))]).filter(([, missed]) => missed.length);
  // (each as a pattern that matches only itself, its glob characters taken as themselves, and quoted as YAML quotes it;
  // a name that holds a control character is named with "?" in its place, to be renamed)
  const asPattern = f => `'${f.replace(/[\\[\]*?!+]/g, c => `\\${c}`).replace(/'/g, "''")}'`.replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029`]/gu, "?");
  return wrong.length ? `The \`paths:\` of a call to the NuGet check let through a change to every file a build of the project's reads, or the check starts on none of its changes: add each, by its exact path, to ${wrong.map(([f, missed]) => `\`.github/workflows/${f}\`: ${missed.map(asPattern).join(", ")}`).join("; ")} (a name shown with "?" holds a control character or a backtick: rename it).` : null;
}

// Rule 5 of a project's SECURITY.md, from its line "5. " to the next rule or heading at a line's start: its lines, the
// first without its number and title; null where there is none.
function rule5(text) {
  const lines = text?.split("\n") ?? [], at = lines.findIndex(l => /^5\.\s/.test(l));
  if (at < 0) return null;
  const end = lines.findIndex((l, i) => i > at && /^(\d+\.\s|#)/.test(l));
  return [lines[at].replace(/^5\.\s*(\*\*[^*]*\*\*)?:?/, ""), ...lines.slice(at + 1, end < 0 ? undefined : end)];
}
// A block's items: each a list line at its outermost depth, with the lines under it indented deeper (its wrapped text
// and the items nested in it).
function listItems(block) {
  const items = [];
  let depth = null;
  for (const l of block) {
    const indent = /^\s*/.exec(l)[0].length, item = /^\s*[-*]\s/.test(l);
    if (item && (depth === null || indent <= depth)) { depth = indent; items.push(l); }
    else if (items.length && l.trim() && indent > depth) items[items.length - 1] += `\n${l}`;
  }
  return items;
}
// Whether an item names its tests: a path in backticks after the words "hostile tests" that is a file or folder of the
// project (one the item names for what checks the input does not count).
function namesTests(p, item) {
  const there = f => { const n = f.replace(/^\.\//, "").replace(/\/+$/, ""); return !!n && p.files.some(x => x === n || x.startsWith(`${n}/`)); };
  return [...(/hostile\s+tests\b([\s\S]*)/i.exec(item)?.[1] ?? "").matchAll(/`([^`]+)`/g)].some(m => there(m[1]));
}
const CASES = "too long, the wrong type, markup, a file path, a number out of range, nothing at all";
// The step for the inputs rule 5 names: "None", or the starter kit's "FILL IN", reads done only while it lists no input;
// once one is listed, each is read, and an item whose tests are still "FILL IN" names none.
function hostileTests(p) {
  const block = rule5(p.read("SECURITY.md"));
  if (!block) throw new Unread("no SECURITY.md with a rule 5 to read");
  const items = listItems(block), said = block.join("\n");
  if (!items.length && (/FILL IN/.test(said) || /^None\b/i.test(said.trim()))) return null;
  if (!items.length) return `In \`SECURITY.md\`, rule 5, list each input anyone but the user at hand can shape as an item of its own (a line that opens \`- \`), saying what checks it and then, after the words "hostile tests:", naming in backticks the file or folder that holds them (${CASES}), or write "None" where the project takes none.`;
  const bare = items.filter(l => !namesTests(p, l)).map(l => l.split("\n")[0].trim().slice(2).trim());
  return bare.length ? `In \`SECURITY.md\`, rule 5, each input names, after the words "hostile tests:", in backticks, a file or folder of the project that holds them (${CASES}): write those tests where they are missing, and name them so. Naming none that is there: ${bare.map(l => l.length > 80 ? `${l.slice(0, 77)}...` : l).join("; ")}.` : null;
}

export const STEPS = [
  { lead: "12 November 2026, builders named by role", cost: COST.line,
    check: p => {
      const wrong = [];
      if (!/core\/modules\/other-builders\.md/.test(p.read("AGENTS.md") ?? "")) wrong.push("`AGENTS.md` tells a session of another tool to read `core/modules/other-builders.md` at the start of every task");
      if (/^\|\s*\*Codex's checks\*\s*\|/m.test(p.manifest)) wrong.push("the manifest's row *Codex's checks* is renamed *other builders' checks*");
      return wrong.length ? `${wrong.join("; ")}.` : null;
    },
    partly: "that no builder is given `core/modules/codex.md`, and the names in the size marks, are read by the review" },
  { lead: "12 November 2026, who reviews", cost: COST.read, unread: "whether a project's reviewers differ from the core's is its own choice, which no file states" },
  { lead: "12 November 2026, the core has moved", cost: COST.workflow, unread: "whether the project's orchestrator wakes every day is no file's to say" },
  { lead: "12 November 2026, fetches on Windows and by .NET", cost: COST.check, held: "the licence check", partly: "the idea filed with the core is no file of the project's" },
  { lead: "12 November 2026, the default branch", cost: COST.check, held: "the `core` check" },
  { lead: "12 November 2026, differences", cost: COST.owner, owner: true, unread: "whether a rule of the project's own replaces a module's is a reading of its rules" },
  { lead: "12 November 2026, a slimmer copy", cost: COST.line,
    check: p => {
      const want = /^Paths: .*$/m.exec(fs.readFileSync(path.join(HERE, "setup", "template", "core-manifest.md.tmpl"), "utf8"))?.[0];
      return want && !p.manifest.split("\n").includes(want) ? `The manifest's "Paths:" line reads, whole: ${want}` : null;
    } },
  { lead: "12 November 2026, a sync and the project's own suites", cost: COST.workflow, unread: "which suites a project's workflows run for which change is their own logic" },
  { lead: "12 November 2026, the way work is handed over", cost: COST.read, unread: "what a project's rules say of handing work over is a reading of them" },
  { lead: "12 November 2026, a feature may wait for a later stage", cost: COST.line, unread: "whether a line of the manifest's \"Differences\" says this is a reading of its words" },
  { lead: "12 November 2026, the signature check on every pull request", cost: COST.workflow,
    check: p => {
      const file = p.workflows["signatures.yml"];
      if (!file) return null;
      readable({ workflows: { "signatures.yml": file } }, () => true);
      // (`on:` as GitHub takes it: one event's name, a list of names, or a mapping of each to its filters)
      const on = file.yaml?.on;
      const pr = on === "pull_request" || (Array.isArray(on) && on.includes("pull_request")) ? {} : on && typeof on === "object" && !Array.isArray(on) ? on.pull_request : undefined;
      if (!file.yaml || pr === undefined) return "`.github/workflows/signatures.yml` runs on every pull request (`on: pull_request:`), as `core/setup/template/workflows/signatures.yml.tmpl` has it.";
      return pr && (pr.paths || pr["paths-ignore"]) ? "`.github/workflows/signatures.yml` has no `paths:` or `paths-ignore:` under `pull_request:`: the core's workflow looks itself whether a package file changed." : null;
    } },
  { lead: "12 November 2026, exact versions", cost: COST.workflow,
    // (the core's licences.yml runs exact-versions.mjs itself; a project that runs the licence script from a workflow of
    // its own runs it beside it)
    check: p => {
      if (!p.files.some(f => /(^|\/)package-lock\.json$/.test(f) && !f.startsWith("core/") && !f.split("/").includes("node_modules"))) return null;
      if (calls(p, "licences.yml").length) return null;
      const own = runsOwn(p, "licences.mjs");
      return own.length && !own.some(([, w]) => script("exact-versions.mjs").test(runs(w)))
        ? `The workflow that runs the licence check, ${own.map(([f]) => `.github/workflows/${f}`).join(", ")}, runs \`node core/scripts/exact-versions.mjs <its config>\` beside it, as the core's \`licences.yml\` does.` : null;
    },
    partly: "that the licence check passes with its new step is held by that check" },
  { lead: "12 November 2026, the security review shown on every pull request", cost: COST.workflow,
    check: p => call(p, "security-review.yml") ? null
      : "The project has a `.github/workflows/security-review.yml` that calls the core's, as `core/setup/template/workflows/security-review.yml.tmpl` has it. In a private repository whose owner does not want it, the manifest's \"Differences\" says so on the owner's word.",
    partly: "that a security review its app did not post is posted as a comment opening \"Security review:\" is a session's practice, read by the review" },
  { lead: "13 November 2026, a security review where the change needs one", cost: COST.read, unread: "what a project's rules and docs say of its security reviews is a reading of them" },
  { lead: "13 November 2026, every file a tool takes its instructions from", cost: COST.read, unread: "whether the project means to hold such a file is its own" },
  { lead: "13 November 2026, the modules a project takes", cost: COST.line, unread: "which modules fit a project is a reading of what it builds" },
  { lead: "13 November 2026, the size marks count the same on every machine", cost: COST.check, held: "the reading-size check" },
  { lead: "13 November 2026, what a project follows", cost: COST.line, unread: "what the project wants to follow is its own choice; with no row, the default holds" },
  { lead: "13 November 2026, the NuGet check", cost: COST.workflow,
    check: p => {
      const projects = p.files.filter(f => PROJECT_FILES.test(f));
      if (!projects.length) return null;
      const wrong = [];
      const locks = [...new Set(projects.map(f => path.posix.join(path.posix.dirname(f), "packages.lock.json")))];
      const missing = locks.filter(l => !p.files.includes(l));
      if (missing.length) wrong.push(`each project file's \`packages.lock.json\` is committed, lock files turned on (\`RestorePackagesWithLockFile\`): ${missing.join(", ")}`);
      if (!call(p, "nuget.yml")) wrong.push("a `.github/workflows/nuget.yml` calls the core's, as `core/setup/template/workflows/nuget.yml.tmpl` has it (in a private repository with the `paths:` of `nuget-paths.yml.tmpl` beside it), or its owner declines the check in the manifest's \"Differences\", as the entry \"16 November 2026, the NuGet check where it can matter\" says");
      let config = null;
      const file = nugetConfig(p);
      try { config = JSON.parse(p.read(file) ?? "null"); } catch { /* (read as missing, below) */ }
      const named = new Set([...(config?.nuget?.ships ?? []), ...(config?.nuget?.tools ?? [])]);
      const unnamed = locks.filter(l => p.files.includes(l) && !named.has(l));
      if (!config?.nuget) wrong.push(`\`${file}\` has a "nuget" part naming each lock file under "ships" or "tools"`);
      else if (unnamed.length) wrong.push(`\`${file}\` names under "nuget.ships" or "nuget.tools": ${unnamed.join(", ")}`);
      return wrong.length ? `${wrong.join("; ")}.` : null;
    } },
  { lead: "13 November 2026, the NuGet check fails from the first day", cost: COST.workflow,
    check: p => {
      return calls(p, "nuget.yml").some(job => job.with?.advisory === true || job.with?.advisory === "true")
        ? "The project's call to the core's `nuget.yml` no longer passes `advisory: true` (it stays only while a fault of the check's own is reported to the core)." : null;
    },
    partly: "whether its audit holds an entry of \"kind\": \"nuget\" for a package that ships is read by the NuGet check where it counts" },
  { lead: "13 November 2026, where NuGet packages come from", cost: COST.check, held: "the NuGet check" },
  { lead: "13 November 2026, the security-review check in a private repository", cost: COST.workflow, unread: "whether the repository is private and what its ruleset requires are GitHub's settings, not files" },
  { lead: "13 November 2026, the core's scripts started through bash", cost: COST.workflow,
    check: p => {
      // (a command, at a line's start or after ; & | or (, that is a file under core/scripts/ by its path alone)
      const bare = /(?:^|[;&|(])\s*(?:\.\/)?core\/scripts\/[\w.-]+/m;
      readable(p, text => text.includes("core/scripts/"));
      const by = Object.entries(p.workflows).filter(([, w]) => Object.values(w.yaml?.jobs ?? {}).some(job => (job?.steps ?? [])
        .some(s => typeof s?.run === "string" && bare.test(s.run.split("\n").filter(l => !/^\s*#/.test(l)).join("\n")))));
      return by.length ? `No workflow runs a file under \`core/scripts/\` by its path alone: start it with \`bash\` (a .sh) or \`node\` (a .mjs). In: ${by.map(([f]) => `.github/workflows/${f}`).join(", ")}.` : null;
    } },
  { lead: "13 November 2026, MS-PL waits for the owner's yes", cost: COST.owner, owner: true, unread: "whether an issue for the owner is open is GitHub's, not a file's" },
  { lead: "13 November 2026, .NET's local tools and the fetch before the restore", cost: COST.check, held: "the NuGet check" },
  { lead: "13 November 2026, a game's previews share its origin", cost: COST.line, unread: "what the threat model says of a preview's origin is a reading of it" },
  { lead: "14 November 2026, the size marks' total counts the project's own files", cost: COST.line,
    // (the reading-size check passes and says so in a note, which no run of it turns red: this step reads that note,
    // from the project's own copy of the check, and gives its number)
    check: p => {
      const marks = marksOf(p.manifest);
      const script = path.join(p.root, "core", "scripts", "reading-size.mjs");
      if (!fs.existsSync(script) || p.read(marks) === null) throw new Unread(`no copy of the reading-size check, or no ${marks}, to read`);
      const r = spawnSync(process.execPath, [script, marks], { cwd: p.root, encoding: "utf8", env: { ...process.env, SIZES_BASE: "" } });
      // (a run that never reached its end, where its notes and its verdict are given, read nothing: reported as not
      // read, never as done. It ends passing with its "ok" line, or failing with its verdicts alone, every line of its
      // errors one, and none of the refusals it gives before it reads: no config named, one that is no JSON or of the
      // wrong shape, or no base to compare with)
      const out = `${r.stdout}`, lines = `${r.stderr}`.split(/\r?\n/).filter(Boolean);
      const early = /^FAIL: (no config was named|.* could not be read as JSON|.* is not in the form the check reads|\S+ is not a commit here)/;
      const ended = !r.error && (r.status === 0 ? /^ok {3}read by every session/m.test(out)
        : r.status === 1 && lines.length > 0 && lines.every(l => l.startsWith("FAIL: ") && !early.test(l)));
      if (!ended) throw new Unread(`the reading-size check did not run to its end on ${marks}`);
      const to = /set it to (\d+) \(core\/setup\/sync-notes\.md, 14 November 2026\)/.exec(out)?.[1];
      return to ? `The "total" in \`${marks}\` is set to ${to}, the number the reading-size check's note gives, so the project keeps the room it had and the core's copy is held by the core's own cap.` : null;
    } },
  { lead: "14 November 2026, a listed name in a commit's author", cost: COST.check, held: "the personal-terms check" },
  { lead: "15 November 2026, every step has its check", cost: COST.check, unread: "it asks that the steps above be run, which every sync from this one on does by itself" },
  { lead: "15 November 2026, the progress file holds order only", cost: COST.read,
    // (a mark of its own is one below the general mark, "each"; a file under a quarter of that has had no time to fill,
    // and its first trim, which sets the mark, comes once it passes it: the general mark holds there till then)
    check: p => {
      const file = progressOf(p.manifest), marksAt = marksOf(p.manifest);
      const text = p.read(file);
      let marks = null;
      try { marks = JSON.parse(p.read(marksAt) ?? "null"); } catch { /* (read as missing, below) */ }
      if (text === null || !(Number.isInteger(marks?.each) && marks.each > 0 && marks.read && typeof marks.read === "object"))
        throw new Unread(`no ${file}, or no ${marksAt} with its "each" and "read", to read`);
      const mark = marks.read?.[file], bytes = Buffer.byteLength(text);
      if ((Number.isInteger(mark) && mark < marks.each) || bytes < marks.each / 4) return null;
      return `Trim \`${file}\` once, in a pull request of its own: each finished entry leaves it (its pull request and issue keep it), each entry says only what is next and points to its pull requests for what was done, and each line of a queued issue holds its issue, who builds it and what it waits on, nothing more (\`core/modules/inbox.md\`, "The *progress file* holds order only"). Then give it a mark of its own under "read" in \`${marksAt}\`: a number of bytes the project chooses, below "each" (${marks.each}) and at least its size after the trim.`;
    } },
  { lead: "15 November 2026, the owner's inbox where issues cannot be reached", cost: COST.read, unread: "whether issues can be read and written here is GitHub's answer, not a file's: `core/scripts/inbox.mjs` asks it, and each sync runs it from the next one on" },
  { lead: "15 November 2026, labels and openers", cost: COST.read, unread: "whether the labels stand and the issues and comments carry them is GitHub's answer, not a file's: `core/scripts/labels.mjs` asks it and says each mend, and each sync runs it from the next one on; the issue forms' \"Found while:\" line is a difference `core/scripts/fresh.mjs` lists" },
  { lead: "16 November 2026, the daily look", cost: COST.workflow, unread: "whether the project's daily job is to run, or its orchestrator carries the look, is no file's to say, as of the core has moved; where a `look.yml` is missing, `core/scripts/fresh.mjs` lists it at every sync, and the old daily job runs the look meanwhile" },
  { lead: "16 November 2026, the line that says what a pull request waits on", cost: COST.check, held: "the description check" },
  { lead: "16 November 2026, choices that are hard to undo", cost: COST.read, unread: "which of a project's choices are hard to undo is a reading of the project, not a file's to say; where its *choice records* are missing, `core/scripts/fresh.mjs` lists the file at every sync, and `core/scripts/choices.mjs` lists the records it holds" },
  { lead: "16 November 2026, an agent's own tools listed", cost: COST.line,
    // (the agent-tools check's own reading, with a missing list read as an empty one: what it would fail once written.
    // The core's licences.yml runs the check itself; a project that runs the licence script from a workflow of its own
    // runs it beside it, as of exact versions, and the config is the one that workflow passes: configs, above)
    check: p => {
      const own = calls(p, "licences.yml").length ? [] : runsOwn(p, "licences.mjs");
      const beside = own.some(([, w]) => script("agent-tools.mjs").test(runs(w)));
      const file = licenceConfig(p);
      let config = null;
      try { config = JSON.parse(p.read(file) ?? "null"); } catch { /* (read as no list, below) */ }
      const head = readProject(p.root), list = listed(config, file) ?? { keys: new Set(), problems: [] };
      const wrong = [...head.problems, ...head.links.map(at => `\`${at}\` is a link that leads out of the checkout: replace it with what it points to`), ...(({ problems, pins }) => [...problems, ...pins.map(([, problem]) => problem)])(toolsCheck(head, list, kitHooks(), file))];
      if (own.length && !beside) wrong.push(`the workflow that runs the licence check, ${own.map(([f]) => `.github/workflows/${f}`).join(", ")}, runs \`node core/scripts/agent-tools.mjs ${file}\` beside it, as the core's \`licences.yml\` does`);
      return wrong.length ? `List under "agentTools" in \`${file}\` every plug-in, tool server, skill and hook the project configures for its agents beyond the starter kit's hooks, each as { "kind", "name", "publisher", "version" }, a plug-in or tool server at one exact version, the one its configuration pins where it can pin one, or take out what nobody meant to configure; and see that its check runs: ${wrong.join("; ")}` : null;
    } },
  { lead: "16 November 2026, how code is put together", cost: COST.config, check: shapeWritten,
    partly: "which folders hold the project's code, which files are its tests and what its systems are is a reading of the project, which its audit's first question answers" },
  { lead: "16 November 2026, hostile tests for every named input", cost: COST.read, check: hostileTests,
    partly: "whether every input is listed, and whether its tests try each case, is a reading of the project, held by the security review" },
  { lead: "16 November 2026, secret scanning with push protection", cost: COST.read, unread: "whether secret scanning and its push protection are on is GitHub's setting, not a file's: `gh api repos/<owner>/<repo>` answers it under `security_and_analysis`, and the entry says how a session switches them on or names them to the owner" },
  { lead: "16 November 2026, the NuGet check where it can matter", cost: COST.workflow, check: nugetPathsHold,
    partly: "whether the repository is private is GitHub's setting, not a file's: `core/scripts/fresh.mjs`, which every sync runs, lists the `paths:` a private project's call lacks" },
  { lead: "16 November 2026, what a screen is held to", cost: COST.read, unread: "whether people use a project through a screen is a reading of what it builds, not a file's to say; where they do, its *direction* is the first step of its next pull request that changes a screen (`core/modules/screens.md`, point 1), and the critique asks for it there" },
];

// An error's words with no path of the machine's in them (the project's root, this copy's, the temporary folder, the
// home folder), since what is printed may be pasted into a pull request's description (floor rule 1).
export function plain(message, root = process.cwd()) {
  let text = String(message);
  for (const [at, as] of [[path.resolve(root), "<the project>"], [HERE, "<the copy>"], [os.tmpdir(), "<a temporary folder>"], [os.homedir(), "<home>"]])
    if (at && at.length > 1) for (const spelling of new Set([at, at.replace(/\\/g, "/")])) text = text.split(spelling).join(as);
  return text;
}

// Whether the manifest declares a step undone on purpose: a line of its "Differences" that quotes the step's lead.
export const declared = (p, step) => p.differences.some(l => l.includes(`"${step.lead}"`));

// The steps not done in the project at `root`: each { lead, owner, cost, mend }. A check that throws is not read as
// done: it is reported, with what went wrong.
export function notDone(root, steps = STEPS) {
  const p = project(root);
  const out = [];
  for (const step of steps) {
    if (!step.check || declared(p, step)) continue;
    let mend;
    try { mend = step.check(p); } catch (e) { mend = `Its check could not read the project (${plain(e.message, root)}): read the entry in \`core/${NOTES}\` against it.`; }
    if (mend) out.push({ lead: step.lead, owner: !!step.owner, cost: step.cost, mend });
  }
  return out;
}

// The report a sync prints for its pull request's description: the steps not done, and nothing where all are.
export function report(missed) {
  if (!missed.length) return "Every step a check reads is done (`core/scripts/steps.mjs`).";
  return [`Steps not done (\`core/scripts/steps.mjs\`; core/${NOTES}): each a task the project's agents take, in a pull request of its own, none waiting on another${missed.some(m => m.owner) ? "; one marked \"the owner's\" waits on the owner and is labelled so" : ""}.`,
    ...missed.map(m => `- ${m.lead}${m.owner ? " (the owner's)" : ""}: ${m.mend}`)].join("\n");
}

if (started(import.meta.url)) {
  try {
    console.log(report(notDone(process.cwd())));
  } catch (e) {
    console.error(`FAIL: the steps could not be read here (${plain(e.message)}): run it from the project's root, a git repository`);
    process.exitCode = 1;
  }
}
