// Where a project's run of each of the core's checks finds its config (#366, #368, #386), read as the check is run, for
// the steps and the comparison with a fresh start (steps.mjs and fresh.mjs, beside this file): from the project's calls
// to the core's workflows (their `with:`), from the steps of its own workflows and of the local actions they use that
// run a script of its copy of the core with `node`, and, where neither runs the check, from the manifest's slot, else
// the starter kit's path. Every source is read, never only the first: where two give different files, or one names its
// file only when the workflow runs, or a script is run from a file the reader does not run (a shell script, a Makefile,
// a package's scripts), the config is not read (Unread), said with why, and compared nowhere, never read as a path no
// check is given. One check's config not read leaves every other's read. Node's own modules only.
import path from "node:path";
import { CORE } from "./core-address.mjs";
import { corePath } from "./core-path.mjs";
import { parseYaml } from "./workflow-run.mjs";

// A config, or a workflow, the reader cannot read: a step that would need it throws this, naming why, so the step is
// reported as not read, never as done or as missing.
export class Unread extends Error {}
// (`mentions` says, from a workflow's text, whether the check would read it)
export const readable = (p, mentions) => {
  const unread = Object.entries(p.workflows).filter(([, w]) => !w.yaml && mentions(w.text ?? "")).map(([f]) => `.github/workflows/${f}`);
  if (unread.length) throw new Unread(`the core's reader cannot read ${unread.join(", ")}, in a form it does not know`);
};

// A project's calls to a workflow of the core's, by the workflow's name: each as [where, job] (its file and its job,
// with uses and with); `calls` the jobs alone, and `call` the first.
const calling = (p, name) => (readable(p, text => text.toLowerCase().includes(`/.github/workflows/${name}@`.toLowerCase())), Object.entries(p.workflows))
  .flatMap(([f, { yaml }]) => Object.values(yaml?.jobs ?? {}).map(job => [`.github/workflows/${f}`, job]))
  .filter(([, job]) => typeof job?.uses === "string" && job.uses.toLowerCase().startsWith(`${CORE}/.github/workflows/${name}@`.toLowerCase()));
export const calls = (p, name) => calling(p, name).map(([, job]) => job);
export const call = (p, name) => calls(p, name)[0] ?? null;

// What each call to the core's workflow `name` passes as its input `key`, as { where, value }: undefined where it passes
// none. One that names it only when the workflow runs (an expression) throws, so the check that needs it is not read.
export function given(p, name, key) {
  return calling(p, name).map(([where, job]) => {
    const value = job.with?.[key];
    if (typeof value === "string" && value.includes("${{")) throw new Unread(`${where} passes the core's ${name} its ${key} as ${value}, which names it only when the workflow runs`);
    return { where, value };
  });
}
// The files the calls pass as `key`, an input the workflow requires: a call that passes none, or no text, is not read.
const passed = (p, name, key = "config") => given(p, name, key).map(({ where, value }) => {
  if (typeof value !== "string" || !value.trim()) throw new Unread(`${where} calls the core's ${name} with no ${key} that names a file`);
  return { where, value: tidy(value) };
});
// A path as the project's root reads it: "./" and a slash at its end left out, and any "." or ".." in it taken.
const tidy = f => path.posix.normalize(f.replace(/\/+$/u, "")).replace(/^\.\//u, "");

// The copy's folder, from the manifest (core-path.mjs), "core/" where it names none.
const copyOf = p => { try { return (p.root && corePath(p.root)) || "core/"; } catch { return "core/"; } };

// A shell's line without its comment: a "#" that starts a word, outside quotes and outside an expression of GitHub's.
function uncommented(line) {
  for (let i = 0, quote = ""; i < line.length; i++) {
    const c = line[i];
    if (quote === "'") { if (c === "'") quote = ""; }
    else if (quote === '"') { if (c === "\\") i++; else if (c === '"') quote = ""; }
    else if (line.startsWith("${{", i)) { const end = line.indexOf("}}", i); if (end < 0) break; i = end + 1; }
    else if (c === "\\") i++;
    else if (c === "'" || c === '"') quote = c;
    else if (c === "#" && (i === 0 || /\s/u.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

// The commands of a step's `run:`, each a list of its words as { text, dynamic }, quotes taken off, as a shell reads
// them: a line continued by "\" joined to the next, a comment left out, commands parted by a line's end, ; & | ( or ).
// A word is dynamic where a variable, a command's output or an expression of GitHub's in it is filled only when the
// workflow runs. A "\" between two letters of a path is read as "/", a folder's parting on Windows.
export function commands(run) {
  const text = run.split(/\r?\n/u).map(uncommented).join("\n").replace(/\\\n/gu, " ");
  const out = [];
  let words = [], word = null;
  const add = (s, dynamic = false) => { word ??= { text: "", dynamic: false }; word.text += s; word.dynamic ||= dynamic; };
  const close = () => { if (word) words.push(word); word = null; };
  const end = () => { close(); if (words.length) out.push(words); words = []; };
  for (let i = 0; i < text.length; i++) {
    if ("\n;&|()".includes(text[i])) end();
    else if (" \t<>".includes(text[i])) close();
    else i = part(text, i, add);
  }
  end();
  for (const ws of out) for (const w of ws) w.dynamic ||= /%\w+%/u.test(w.text);
  return out;
}
// One part of a word, at `i`: given to `add` as what it spells, and whether it is filled only when the workflow runs;
// it returns where the part ends.
const expressionEnd = (text, i) => { const e = text.indexOf("}}", i); return e < 0 ? text.length : e + 2; };
function part(text, i, add) {
  const c = text[i];
  if (text.startsWith("${{", i)) { const j = expressionEnd(text, i); add(text.slice(i, j), true); return j - 1; }
  if (c === "'") { const e = text.indexOf("'", i + 1), j = e < 0 ? text.length : e; add(text.slice(i + 1, j)); return j; }
  if (c === '"') return doubleQuoted(text, i, add);
  if (c === "\\") { const next = text[i + 1] ?? ""; add(/[\w.-]/u.test(next) && /[\w.-]/u.test(text[i - 1] ?? "") ? `/${next}` : next); return i + 1; }
  add(c, c === "$" || c === "`");
  return i;
}
function doubleQuoted(text, i, add) {
  let j = i + 1;
  for (; j < text.length && text[j] !== '"'; j++) {
    if (text.startsWith("${{", j)) { const k = expressionEnd(text, j); add(text.slice(j, k), true); j = k - 1; }
    else if (text[j] === "\\" && /["\\$`]/u.test(text[j + 1] ?? "")) add(text[++j]);
    else add(text[j], text[j] === "$" || text[j] === "`");
  }
  return j;
}

// The root of the checkout as a workflow names it, at a path's start: read as the project's root.
const ROOT = /^(?:\$GITHUB_WORKSPACE|\$\{GITHUB_WORKSPACE\}|\$\{\{\s*github\.workspace\s*\}\}|\$env:GITHUB_WORKSPACE|%GITHUB_WORKSPACE%)\//u;
// A word as a path from the project's root, run in the folder `dir` (from the root): { at } where it is known, at null
// where it leads out of the project; { dynamic } where it is named only when the workflow runs.
function located(word, dir) {
  const rooted = ROOT.test(word.text), rest = word.text.replace(ROOT, "");
  if (word.dynamic && /\$|`|%\w+%/u.test(rest)) return { dynamic: true };
  if (!rooted && rest.startsWith("/")) return { at: null };
  const at = path.posix.normalize(rooted ? rest : path.posix.join(dir, rest));
  return { at: at === ".." || at.startsWith("../") ? null : at.replace(/^\.\//u, "") };
}
const NODE = /(?:^|\/)node(?:\.exe)?$/iu;
const WRAPPERS = new Set(["env", "exec", "time", "command", "nohup"]);
// Node's options that take the next word as their value, so that it is no script.
const VALUED = new Set(["-r", "--require", "--import", "--loader", "--experimental-loader", "-C", "--conditions", "--env-file", "--title", "--input-type"]);
const CHDIR = /^(?:cd|pushd|popd|chdir|set-location|sl)$/iu;

// The word a command runs with node, by its index ({ at }), past what goes before node (a variable set, env, exec)
// and node's own options; { moves } where the command changes the folder; {} where it runs nothing with node.
function nodeRuns(words) {
  let i = 0;
  while (i < words.length && (/^\w+=/u.test(words[i].text) || WRAPPERS.has(words[i].text))) i++;
  if (i < words.length && CHDIR.test(words[i].text)) return { moves: true };
  if (i >= words.length || !NODE.test(words[i].text)) return {};
  for (i++; i < words.length && words[i].text.startsWith("-"); i++) if (VALUED.has(words[i].text)) i++;
  return { at: i };
}
// The config a run passes the script at word `i`: the first word after it that is no option, as { config }, a path
// from the root; or { unread } with why it cannot be known.
function configAfter(words, i, dir, script) {
  let arg = i + 1;
  while (arg < words.length && words[arg].text.startsWith("-")) arg++;
  if (arg >= words.length) return { unread: `runs ${script} with no config` };
  const config = located(words[arg], dir.at);
  if (config.dynamic) return { unread: `passes ${script} its config as ${words[arg].text}, which names it only when the workflow runs` };
  return config.at === null ? { unread: `passes ${script} its config as ${words[arg].text}, outside the project` } : { config: config.at };
}
// Where a step's `run:`, in the folder `dir`, runs `script` (a path from the root, "core/scripts/copies.mjs") with
// node: each as configAfter gives it.
function runsIn(run, dir, script) {
  const found = [], name = path.posix.basename(script);
  let moved = false;
  for (const words of commands(run)) {
    const { moves, at: i } = nodeRuns(words);
    moved ||= !!moves;
    const word = words[i ?? words.length];
    if (!word || !word.text.endsWith(`scripts/${name}`)) continue;
    // (after a cd, or in a folder named only when it runs, which copy it runs cannot be known)
    const at = dir.dynamic || moved ? { dynamic: true } : located(word, dir.at);
    if (moved) found.push({ unread: `runs ${word.text} after a command that changes its folder` });
    else if (at.dynamic) found.push({ unread: `runs ${word.text} in a folder or by a path named only when the workflow runs` });
    else if (at.at === script) found.push(configAfter(words, i, dir, script));
  }
  return found;
}

// A step's folder, from the root: its own `working-directory`, else its job's or its workflow's default.
const folder = (...dirs) => {
  const d = dirs.find(v => v !== undefined && v !== null);
  if (d === undefined) return { at: "." };
  const text = String(d);
  if (/\$/u.test(text)) return { dynamic: true };
  const at = path.posix.normalize(text.replace(ROOT, "").replace(/\\/gu, "/"));
  return at === ".." || at.startsWith("../") || at.startsWith("/") ? { dynamic: true } : { at };
};

// Each step the project runs from its workflows, and from the local actions (`uses: ./…`) they use, as
// { where, run, dir }: the file it stands in, its `run:` and its folder (an action's steps run from the root, save
// where one names its own); an action the reader cannot read as { where, unreadable }, its text.
function steps(p) {
  const out = [], seen = new Set();
  const action = uses => {
    const at = tidy(uses);
    if (seen.has(at)) return;
    seen.add(at);
    for (const f of [`${at}/action.yml`, `${at}/action.yaml`]) {
      const text = p.read(f);
      if (text === null) continue;
      let yaml = null;
      try { yaml = parseYaml(text); } catch { /* (below) */ }
      if (!yaml) { out.push({ where: f, unreadable: text }); return; }
      walk(f, yaml.runs?.steps ?? [], step => folder(step["working-directory"]));
      return;
    }
  };
  const walk = (where, list, dirOf) => {
    for (const step of Array.isArray(list) ? list : []) {
      if (typeof step?.run === "string") out.push({ where, run: step.run, dir: dirOf(step) });
      if (typeof step?.uses === "string" && step.uses.startsWith("./")) action(step.uses);
    }
  };
  for (const [f, w] of Object.entries(p.workflows)) {
    const where = `.github/workflows/${f}`;
    if (!w.yaml) continue;
    for (const job of Object.values(w.yaml.jobs ?? {})) {
      walk(where, job?.steps, step => folder(step["working-directory"], job?.defaults?.run?.["working-directory"], w.yaml.defaults?.run?.["working-directory"]));
    }
  }
  return out;
}

// The project's own runs of a script of its copy (`name`, "copies.mjs"), each as { where, config } or { where, unread }.
export function runsOwn(p, name) {
  readable(p, text => text.includes(name));
  const script = `${copyOf(p)}scripts/${name}`;
  return steps(p).flatMap(s => {
    if (s.unreadable !== undefined) return s.unreadable.includes(name) ? [{ where: s.where, unread: `the core's reader cannot read ${s.where}, in a form it does not know` }] : [];
    return runsIn(s.run, s.dir, script).map(r => ({ where: s.where, ...r }));
  });
}
// The files of the project's own that run the script, once each.
export const runFiles = (p, name) => [...new Set(runsOwn(p, name).map(r => r.where))];
const fromRuns = (p, name) => runsOwn(p, name).map(r => {
  if (r.unread) throw new Unread(`${r.where} ${r.unread}`);
  return { where: r.where, value: r.config };
});

// The files a project runs some other way, which name a script of its copy: a shell script, a Makefile, a package's
// scripts. The reader does not run them, so a check run from one alone is not read, never read at the slot's path.
const OTHER_RUNNERS = /(?:^|\/)(?:[^/]+\.(?:sh|bash|zsh|ps1|psm1|cmd|bat|mk)|Makefile|GNUmakefile|makefile|justfile|package\.json)$/u;
function namedElsewhere(p, names) {
  const at = copyOf(p);
  const own = (p.files ?? []).filter(f => OTHER_RUNNERS.test(f) && !f.startsWith(at) && !f.split("/").includes("node_modules"));
  const of = new RegExp(`(?:^|[^\\w.-])(?:\\./)?${at.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&").replace(/\//gu, "[\\\\/]")}scripts[\\\\/](?:${names.map(n => n.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")).join("|")})(?![\\w.-])`, "u");
  return own.filter(f => {
    const text = p.read(f) ?? "";
    if (!f.endsWith("package.json")) return of.test(text);
    try { return Object.values(JSON.parse(text)?.scripts ?? {}).some(s => typeof s === "string" && of.test(s)); } catch { return of.test(text); }
  });
}
const notElsewhere = (p, names) => {
  const named = namedElsewhere(p, names);
  if (named.length) throw new Unread(`${named.join(", ")} ${named.length > 1 ? "name" : "names"} ${names.map(n => `${copyOf(p)}scripts/${n}`).join(" or ")}, run from a file the core's reader does not run`);
};

// The one file the sources give, undefined where none gives one; where they give different files, not read.
function one(found, what) {
  const files = [...new Set(found.map(f => f.value))];
  if (files.length > 1) throw new Unread(`${what} is given as ${found.map(f => `${f.value} (${f.where})`).join(", ")}, files that differ`);
  return files[0];
}

// The path a manifest's slot names (its first backticked value), else `kit`.
export const slot = (manifest, name, kit) => new RegExp(`^\\|\\s*\\*${name}\\*\\s*\\|\\s*\`([^\`]+)\``, "m").exec(manifest)?.[1] ?? kit;

export const KIT_CONFIGS = { licences: "checks/licences.json", audit: "checks/licences-audit.json", copies: "checks/copies.json", baseline: "checks/copies-baseline.json", sizes: "checks/sizes.json" };

// What a check's config names under `name`, as a path: null where the config is not there or names none; where the
// config is there and no JSON, not read. `rooted`: a "/" at its start read from the project's root, as the licence
// check joins it.
export function key(p, file, name, rooted = false) {
  const text = p.read(file);
  if (text === null) return null;
  let value;
  try { value = JSON.parse(text)?.[name]; } catch { throw new Unread(`${file} is no JSON, so the ${name} it names cannot be read`); }
  return typeof value === "string" && value ? tidy(rooted ? value.replace(/^\//u, "") : value) : null;
}

// The licence check's config: what the calls to the core's licences.yml pass, and the project's own runs of the
// licence and agent-tools scripts, which run beside each other; where none runs it, the NuGet check's own, else the
// kit's.
export function licenceConfig(p) {
  const found = one([...passed(p, "licences.yml"), ...fromRuns(p, "licences.mjs"), ...fromRuns(p, "agent-tools.mjs")], "the licence check's config");
  if (found !== undefined) return found;
  notElsewhere(p, ["licences.mjs", "agent-tools.mjs"]);
  return nugetOwn(p) ?? KIT_CONFIGS.licences;
}
// The NuGet check's own config: what the calls to the core's nuget.yml pass and the project's own runs of its script.
function nugetOwn(p) {
  const found = one([...passed(p, "nuget.yml"), ...fromRuns(p, "nuget.mjs")], "the NuGet check's config");
  if (found === undefined) notElsewhere(p, ["nuget.mjs"]);
  return found;
}
// The NuGet check's config: its own, read first, so that it stands where the licence check's cannot be read; else the
// licence check's (`licences`, read only then).
export const nugetConfig = (p, licences = () => licenceConfig(p)) => nugetOwn(p) ?? licences();
// The copies check's config: the calls' and the project's own runs', else the manifest's *copies check* slot (the
// backticked file in its own cell that is neither the script nor a command), else the kit's.
export function copiesConfig(p) {
  const found = one([...passed(p, "copies.yml"), ...fromRuns(p, "copies.mjs")], "the copies check's config");
  if (found !== undefined) return found;
  notElsewhere(p, ["copies.mjs"]);
  const cell = /^\|\s*\*copies check\*\s*\|([^|\n]*)/m.exec(p.manifest)?.[1].match(/`[^`]+`/g) ?? [];
  return cell.map(v => v.slice(1, -1)).find(v => !/\s/.test(v) && !/^(\.\/)?core\//.test(v)) ?? KIT_CONFIGS.copies;
}
// The size marks: what the calls to the core's copies.yml pass as `sizes` and the project's own runs of the
// reading-size script, else the manifest's *size marks* slot, else the kit's.
export function marksConfig(p) {
  const found = one([...passed(p, "copies.yml", "sizes"), ...fromRuns(p, "reading-size.mjs")], "the size marks");
  if (found !== undefined) return found;
  notElsewhere(p, ["reading-size.mjs"]);
  return slot(p.manifest, "size marks", KIT_CONFIGS.sizes);
}
// The folder the signature check reads package-lock.json in, from the root: what the calls to the core's
// signatures.yml pass as `directory` ("." where one passes none), undefined where none calls it.
export function packagesFolder(p) {
  const found = given(p, "signatures.yml", "directory").map(({ where, value }) => {
    if (value !== undefined && typeof value !== "string") throw new Unread(`${where} passes the core's signatures.yml a directory that is no text`);
    return { where, value: tidy(value ?? ".") || "." };
  });
  return one(found, "the signature check's folder");
}

// All of them, each null where it cannot be read (Unread), and why under `unread`, each line naming whose it is, so
// the reader can say what it did not compare. Any other error is thrown, never hidden.
export function configs(p) {
  const unread = [];
  const or = (what, read) => { try { return read(); } catch (e) { if (!(e instanceof Unread)) throw e; unread.push(`${what}: ${e.message}`); return null; } };
  const licences = or("the licence check's config not compared", () => licenceConfig(p));
  const audit = licences === null ? null : or("the licence check's audit not compared", () => key(p, licences, "audit", true) ?? KIT_CONFIGS.audit);
  const nuget = or("the NuGet check's config not compared", () => nugetConfig(p, () => licences));
  const copies = or("the copies check's config not compared", () => copiesConfig(p));
  const baseline = copies === null ? null : or("the copies check's baseline not compared", () => key(p, copies, "baseline") ?? KIT_CONFIGS.baseline);
  const sizes = or("the size marks not compared", () => marksConfig(p));
  const packages = or("the signature check's folder not read, its lock file's taken", () => packagesFolder(p));
  return { licences, audit, nuget, copies, baseline, sizes, packages, unread: [...new Set(unread)] };
}
