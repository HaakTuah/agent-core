// The licence check's scan (floor rule 10, in floor/topics/licences.md beside this folder): nothing a project uses is left out
// of its audit, so the check (licences.mjs, beside this file, which runs this when its config has "scan") holds
// everything to its list, not only what a lockfile names. It reads the project's tracked files (git ls-files), but
// what "skip" names and, in a project, its copy of the core, which the core's own scan audits (.github/licences.json
// in the core). An entry covers a file by its "name" (the file's path) or its "files" (paths, or folders ending in
// "/"). It needs:
//   - each lockfile the config's "lockfiles" names, and each package.json with dependencies beside one of them or a
//     workspace of one, so the check reads every package any of them installs;
//   - an entry for each action a workflow or action file uses (`uses:`), but the owner's own (the account the core is under, the core's
//     workflows among them) and the project's (./), by its name (owner/repo), at whatever version it is pinned to;
//   - an entry for each package a command fetches (licence-commands.mjs, beside this file, reads them: npx, npm exec,
//     npm install, npm link and npm pack, in any workflow, script or tool, a file with no extension read as a shell
//     script, the parts of a page or component that run, any command in a JSON or TOML file), written
//     name@exact.version and audited at that version, one entry for each version used, so an update is audited again,
//     with what it pulls in. A fetch it cannot read fails, but npm pack's, which runs nothing it fetches, and another
//     fetcher's (curl, wget, pip, pnpm, yarn, bun, playwright install, git clone, dotnet tool install, choco, winget,
//     PowerShell's Invoke-WebRequest and the like): each of those passes
//     only in a file an entry's "files" names, that entry its hand audit;
//   - an entry covering each script in a language it cannot read (Python, Ruby, PowerShell and the like): the entries
//     of what it uses;
//   - an entry covering each file but prose (Markdown, text) carrying a licence notice, code in any language or a text
//     asset (an SVG), and each font, image, sound, video, model or data file, and each binary file whatever its name;
//   - what lies under "served" but not "tools" reaches users, so every entry covering it there ships.
// The owner's own work (kind "own") covers only files it names one by one, never a file carrying someone's licence
// notice, an action or a package. Each "files" path, and each path of "scan", must name a tracked file or a folder
// holding one, so none is left covering nothing (or, misspelt, missing what it meant).
//
// The config's "scan" names "served", the folders (each ending in "/", or "" for the whole repository) whose files
// reach users ([] if none); "tools", the folders within them whose files do not; and "skip", the folders or files
// left out. Node's own modules only.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { OWNER } from "./core-address.mjs";
import { DEEPEST, leadsOut, tooDeep } from "./guards.mjs";
import { commandLines, commands, fetched, otherFetch } from "./licence-commands.mjs";
import { copyOf } from "./core-path.mjs";

const OWN = `${OWNER}/`;
const SHELL = /\.(ya?ml|sh|bash|zsh|fish|mk|toml|envrc)$|(^|\/)(Dockerfile[^/]*|Makefile|GNUmakefile|\.envrc)$/iu;
const JS = /\.([cm]?[jt]sx?)$/iu;
const WEB = /\.(html?|vue|svelte|astro)$/iu; // (pages and components: the parts that run, executable() below)
const YAML = /\.ya?ml$/iu;
const OTHER_LANGUAGE = /\.(py|pyw|rb|ps1|psm1|bat|cmd|pl|pm|php|lua|r|jl|tcl|vbs|groovy|gradle|kts)$/iu;
const CODE = /\.(html?|[cm]?[jt]sx?|css|scss|sass|less|vue|svelte|astro)$/iu;
const ASSET = new RegExp(
  "\\.(png|jpe?g|gif|webp|avif|jxl|heic|ico|bmp|tiff?|svg|psd|xcf|woff2?|ttf|otf|eot|mp3|ogg|oga|opus|wav|flac|m4a|aac|aiff?|mid|midi|" +
    "webm|mp4|mov|ogv|glb|gltf|fbx|blend|stl|wasm|pdf|csv|tsv|geojson|topojson|parquet|sqlite|db)$",
  "iu",
);
const PROSE_FILE = /\.(md|markdown|txt|rst|adoc)$/iu;
const NOTICE = /\/\*!|@license|SPDX-License-Identifier|Copyright\s+(\(c\)|©|\d{4})|Permission is hereby granted|Licensed under the/iu;
const EXACT = /^((?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*)@(\d+\.\d+\.\d+)$/iu;
const LOCKFILE = /(^|\/)(package-lock|npm-shrinkwrap)\.json$/u;
/**
 * An opening tag's attributes ([name, value] pairs) and the index of the ">" that ends it, from `at` just after its
 * name, read by the states HTML's tokenizer reads them in: a value is quoted only where it starts with its quote, an
 * unquoted one runs to a space or ">" whatever it holds (x=a="b>), and a name may hold quotes ("type=json is no type).
 * `end` is -1 where the tag has none.
 */
const HTML_SPACE = /[\t\n\f\r ]/u; // (HTML's whitespace, ASCII only: a no-break space is part of a name or value)
function attributesOf(text, at) {
  const tag = { attributes: [], state: "before", name: "", value: "", quote: "" };
  for (let k = at; k < text.length; k++) if (attributeStep(tag, text[k], HTML_SPACE.test(text[k]))) return { attributes: tag.attributes, end: k };
  return { attributes: tag.attributes, end: -1 };
}

// (the attribute read so far, where it has a name, is one of the tag's)
const attributeDone = (tag) => { if (tag.name) tag.attributes.push([tag.name, tag.value]); tag.name = tag.value = ""; };

/** One character `ch` of a tag (attributesOf, above), read in the tag's state: whether it is the ">" that ends it. */
function attributeStep(tag, ch, space) {
  if (tag.state === "quoted" || tag.state === "unquoted") return VALUE_STEP[tag.state](tag, ch, space);
  if (ch === ">") { attributeDone(tag); return true; }
  NAME_STEP[tag.state](tag, ch, space);
  return false;
}

// Each state within a value, on one character: whether it is the ">" that ends the tag.
const VALUE_STEP = {
  quoted(tag, ch) {
    if (ch === tag.quote) { tag.state = "before"; attributeDone(tag); } else tag.value += ch;
    return false;
  },
  unquoted(tag, ch, space) {
    if (!space && ch !== ">") { tag.value += ch; return false; }
    attributeDone(tag);
    tag.state = "before";
    return ch === ">";
  },
};

// Each other state, on one character that is no ">".
const NAME_STEP = {
  value(tag, ch, space) { if (ch === '"' || ch === "'") { tag.quote = ch; tag.state = "quoted"; } else if (!space) { tag.value = ch; tag.state = "unquoted"; } },
  name(tag, ch, space) { if (ch === "=") tag.state = "value"; else if (space) tag.state = "after"; else if (ch === "/") { attributeDone(tag); tag.state = "before"; } else tag.name += ch; },
  after(tag, ch, space) {
    if (ch === "=") { tag.state = "value"; return; }
    if (space) return;
    attributeDone(tag);
    tag.state = "before";
    NAME_STEP.before(tag, ch, space);
  },
  before(tag, ch, space) {
    if (space || ch === "/") return;
    tag.name = ch; tag.state = "name"; // ("before": a name starts, "=" itself among what may start one)
  },
};

/**
 * The parts of a page or component that run, read so as to fail closed rather than to match HTML's parser case by case:
 * every script element's tag and body wherever "<script" stands (in a comment, an attribute's value or a textarea too),
 * to the first "</script" that ends its name, or to the file's end where the body holds "<!--" (as HTML may read it on)
 * or the tag has no end, but a script of data or a template by its own type attribute (JSON-LD, an import map,
 * text/template); every event handler and bound attribute (onclick, @click, :value, v-if, x-data, quoted or not) and
 * javascript: address anywhere; an Astro component's frontmatter; and, but in a plain page, every expression in braces
 * (Vue's, Svelte's, Astro's, a style block's rules among them), each brace read to its match. Text outside these runs
 * nothing, so a page showing a command in its text fetches nothing.
 */
function executable(text, f) {
  const lower = text.toLowerCase(), parts = [];
  if (/\.astro$/iu.test(f)) { const front = /^\s*---\r?\n([\s\S]*?)(?:\r?\n---|$)/u.exec(text); if (front) parts.push(front[1]); }
  scriptParts(text, lower, parts);
  for (const m of text.matchAll(/\s(?:on[\w-]+|@[\w.:-]+|:[\w.:-]+|v-[\w.:-]+|x-[\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu)) parts.push(m[1] ?? m[2] ?? m[3]);
  for (const m of text.matchAll(/javascript:([^"'<>]*)/giu)) parts.push(m[1]);
  if (!/\.html?$/iu.test(f)) braceParts(text, parts);
  return parts.join("\n");
}

const nameEnds = (lower, k, length) => !/[^\t\n\f\r />]/u.test(lower[k + length] ?? ">"); // (a tag's name ends there)

/** Every script element's tag and, where it runs, body (executable, above), pushed onto `parts`; `lower` is `text` in
 *  lower case. */
function scriptParts(text, lower, parts) {
  const closes = [];
  for (let k = lower.indexOf("</script"); k >= 0; k = lower.indexOf("</script", k + 8)) if (nameEnds(lower, k, 8)) closes.push(k);
  for (let k = lower.indexOf("<script"), covered = 0, c = 0; k >= 0; k = lower.indexOf("<script", k + 7)) {
    if (k < covered || !nameEnds(lower, k, 7)) continue; // (one inside a body or tag already read is part of it)
    const tag = attributesOf(text, k + 7);
    if (tag.end < 0) { parts.push(text.slice(k + 7)); break; }
    parts.push(text.slice(k + 7, tag.end)); // (its tag too: one that is only text may span a script that runs)
    while (c < closes.length && closes[c] <= tag.end) c++;
    covered = scriptBody(text, tag, c < closes.length ? closes[c] : text.length, parts);
  }
}

/** A script's body, from the end of its `tag` to `stop`, the first "</script" after it (scriptParts, above), pushed
 *  onto `parts` where it runs: where what it covers ends. */
function scriptBody(text, tag, stop, parts) {
  // (a script that runs is read, to the file's end where it holds "<!--", and covers what it read; one of data covers
  // only its own tag, since it may be only text, in a comment or a value, before a script that runs)
  const type = tag.attributes.find(([n]) => n.toLowerCase() === "type")?.[1] ?? "";
  if (/json|template|importmap|speculationrules|^text\/(html|plain|markdown)$/iu.test(type.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/gu, ""))) return tag.end + 1;
  if (text.slice(tag.end + 1, stop).includes("<!--")) stop = text.length;
  parts.push(text.slice(tag.end + 1, stop));
  return stop;
}

/** Every expression in braces (executable, above), each brace read to its match, pushed onto `parts`. */
function braceParts(text, parts) {
  let depth = 0, start = 0;
  for (let k = 0; k < text.length; k++) {
    if (text[k] === "{" && depth++ === 0) start = k;
    else if (text[k] === "}" && depth > 0 && --depth === 0) parts.push(text.slice(start, k + 1));
  }
  if (depth > 0) parts.push(text.slice(start));
}

/** A tracked file's text, a link's that of the file it leads to, read as the link's own, where that lies inside the
 *  project; a link that leads out of it, or nowhere, is not read and fails, since what it holds cannot be audited. */
function trackedText(root, f, fail) {
  const at = join(root, f);
  if (!leadsOut(root, at)) return readFileSync(at, "utf8");
  fail(`${f} is a link that leads out of the project, so what it holds cannot be read. Mend: put the file itself there, in place of the link`);
  return "";
}

/** The command lines a JSON file `f` holds (licence-commands.mjs); none where it nests past the bound, which fails
 *  unless an entry audits it by hand. */
function linesIn(json, f, byHand, fail) {
  if (!tooDeep(json)) return commandLines(json);
  if (!byHand(f)) fail(`${f}: it nests deeper than ${DEEPEST} objects and lists, so its commands cannot be read. Mend: nest it less deep, or name it in the "files" of the entry that audits it`);
  return [];
}

/** The failures of the scan of the project at `root`, against its audit's `entries` (read from `auditPath`). */
export function scan(settings, root, entries, auditPath, lockfiles = []) {
  const failures = [];
  const fail = (m) => { if (!failures.includes(m)) failures.push(m); };
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
  const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
  const project = tracked.includes("core-manifest.md"); // (a project, whose copy of the core the core audits)
  const files = tracked.filter((f) => !(project && f.startsWith(copyOf(root))) && !under(f, settings.skip)); // (at the manifest's path)
  const binary = new Set(git("ls-files", "--eol", "-z").split("\0").filter((l) => /^i\/-text\s/u.test(l)).map((l) => l.slice(l.indexOf("\t") + 1)));
  // (what the scan's parts share: scanned, below)
  const c = { settings, root, entries, auditPath, lockfiles, tracked, files, binary, fail };

  for (const key of ["served", "tools", "skip"]) for (const p of settings[key] ?? []) if (p !== "" && !tracked.some((f) => holds(p, f))) fail(`the config's "scan.${key}": ${p} names no tracked file. Mend: correct the path, a folder ending in "/", or take it out`);
  for (const e of entries) entryFaults(c, e);
  c.locks = lockfiles.map((l) => ({ dir: posix.dirname(l) === "." ? "" : `${posix.dirname(l)}/`, packages: JSON.parse(readFileSync(join(root, l), "utf8")).packages ?? {} }));
  for (const f of files) scanned(c, f);
  return { failures, scanned: files.length };
}

const holds = (p, f) => typeof p === "string" && (p === "" || p === f || (p.endsWith("/") && f.startsWith(p)));
const under = (f, paths) => (paths ?? []).some((p) => holds(p, f));
const served = (c, f) => under(f, c.settings.served) && !under(f, c.settings.tools);
const covers = (e, f) => e.name === f || (Array.isArray(e.files) && e.files.some((p) => p !== "" && holds(p, f)));
const covering = (c, f) => c.entries.filter((e) => covers(e, f));
const byHand = (c, f) => covering(c, f).some((e) => e.kind !== "own");
const badFiles = (e) => e.files !== undefined && (!Array.isArray(e.files) || e.files.some((p) => typeof p !== "string" || !p));

/** What fails in an audit entry `e` itself (scan, above): its "files", its "version", the owner's own work, and
 *  whether it ships what reaches users. */
function entryFaults(c, e) {
  const { auditPath, fail } = c;
  if (badFiles(e)) { fail(`${auditPath}: ${e.name}: "files" is not a list of paths. Mend: write it as a list of paths from the project's root`); return; }
  if (e.version !== undefined && typeof e.version !== "string") fail(`${auditPath}: ${e.name}: "version" is not text. Mend: write the version in quotes`);
  if (e.kind === "own" && (e.version !== undefined || (e.files ?? []).some((p) => p.endsWith("/")))) fail(`${auditPath}: ${e.name}: the owner's own work names its files one by one, with no version. Mend: list each file, no folder, and take "version" out`);
  for (const p of e.files ?? []) if (!c.tracked.some((f) => holds(p, f))) fail(`${auditPath}: ${e.name}: ${p} names no tracked file. Mend: correct the path, or take it out`);
  const shipped = c.files.find((f) => served(c, f) && covers(e, f));
  if (shipped && e.ships !== true) fail(`${auditPath}: ${e.name}: it covers ${shipped}, which reaches users, so it ships. Mend: set "ships": true on it`);
}

/** That the package `name` (used in `where`) has an entry, at `version` where one is given (scan, above). */
function need(c, name, where, version) {
  const named = c.entries.filter((e) => e.name === name && e.kind !== "own");
  if (!named.length) c.fail(`${name} (${where}) is not in ${c.auditPath}. Mend: add an entry for it there, with its name, exact version, licence and "ships"`);
  else if (version && !named.some((e) => e.version === version)) c.fail(`${name}@${version} (${where}) is audited at ${named.map((e) => e.version ?? "no version").join(", ")}. Mend: audit the new version, and what it pulls in, in ${c.auditPath}`);
}

/** That an entry covers the file `f` (`what` it is), but the owner's own where `own` is false, and that each ships
 *  where it reaches users (scan, above). */
function needFile(c, f, what, { own = true } = {}) {
  const by = covering(c, f).filter((e) => own || e.kind !== "own");
  if (!by.length) c.fail(`${f} (${what}) is not in ${c.auditPath}${own ? "" : ", by an entry not the owner's own"}. Mend: name ${f} in the "files" of the entry that audits it`);
  else if (served(c, f) && !by.every((e) => e.ships === true)) c.fail(`${f} (${what}) reaches users, so every entry covering it ships. Mend: set "ships": true on each entry whose "files" covers it`);
}

/** What the commands in `text`, of the file `f`, fetch, each held to its entry (scan, above). */
function fetches(c, text, f, literal = false) {
  for (const line of commands(text, JS.test(f) || WEB.test(f), literal)) {
    const { specs, unreadable, packs } = fetched(String(line), line.atCommand === true, literal || line.literal === true);
    const where = `${f}, ${line.trim().replaceAll("\u0000", " ").slice(0, 120)}`;
    if (unreadable) c.fail(`${where}: ${unreadable}, which cannot be audited. Mend: fetch it as npx -p <name>@<exact version>`);
    for (const spec of specs) {
      const exact = EXACT.exec(spec);
      if (exact) need(c, exact[1], where, exact[2]);
      else if (!(packs && byHand(c, f))) c.fail(`${where}: ${spec} cannot be audited. Mend: write it as name@exact.version${packs ? `, or name ${f} in the "files" of the entry that audits it` : ""}`);
    }
  }
  if (/\bnpm_config_(@[\w-]+:)?registry\b|\bnpm_config_replace_registry_host\b|\bnpm_config_(user|global)config\b/iu.test(text)) c.fail(`${f}: it points npm at another registry than npm's, so no audited name can be trusted there. Mend: take that setting out`);
  if (/\bnpm_config_(package_lock|shrinkwrap)\b/iu.test(text)) c.fail(`${f}: it installs without the lockfile, so what it installs is not what the lockfile's check read. Mend: take that setting out`);
  const other = byHand(c, f) ? undefined : otherFetch(text);
  if (other) c.fail(`${f}: ${other.trim()} fetches what no entry's "files" says. Mend: name ${f} in the "files" of the entry that audits it`);
}

/** The scan of one tracked file `f` (scan, above): by what it is, and for a licence notice it carries. */
function scanned(c, f) {
  if (LOCKFILE.test(f) && !c.lockfiles.includes(f)) c.fail(`${f} installs packages the config's "lockfiles" does not name, so nothing checks their licences. Mend: name ${f} in the config's "lockfiles"`);
  const text = c.binary.has(f) ? "" : trackedText(c.root, f, c.fail);
  const { other, runs } = readAs(c, f, text);
  if (runs) scanRunning(c, f, text);
  else if (/\.json[c5]?$/u.test(f) && f !== c.auditPath && !LOCKFILE.test(f)) scanJson(c, f, text);
  else if (other) scanOther(c, f);
  // (a notice in any file but prose, the notices a project writes itself among them: code copied in, in any language)
  if (!c.binary.has(f) && !PROSE_FILE.test(f) && NOTICE.test(text)) needFile(c, f, "a file carrying a licence notice", { own: false });
  if (ASSET.test(f) || c.binary.has(f)) needFile(c, f, c.binary.has(f) && !ASSET.test(f) ? "a binary file" : "a font, image, sound, video, model or data file");
}

/** How the scan reads the file `f` holding `text` (scanned, above): `other`, in a language it cannot read; `runs`, as
 *  shell, JavaScript or a page. */
function readAs(c, f, text) {
  // (a file with no extension, a hook or a script, is read by its #! line: as shell or JavaScript, or as a language the
  // scan cannot read; with none, as shell)
  const bare = !c.binary.has(f) && !/.\.\w+$/u.test(posix.basename(f)); // (".envrc" and the like have none either)
  const interpreter = bare && text.startsWith("#!") ? /^#!\s*\S*?(?:env\s+(?:-\S+\s+)*)?([\w.-]+)/u.exec(text.split("\n")[0].replace(/^#!\s*\S*\//u, "#!"))?.[1] ?? "" : "";
  const other = OTHER_LANGUAGE.test(f) || (bare && interpreter && !/^(sh|bash|dash|zsh|ksh|node|deno|bun|tsx|ts-node)$/u.test(interpreter));
  return { other, runs: !other && (SHELL.test(f) || JS.test(f) || WEB.test(f) || bare) };
}

/** A file that runs (scanned, above): the actions a workflow uses, and what its commands fetch. */
function scanRunning(c, f, text) {
  // (a line that is only a comment fetches nothing; a comment after code stays, since a # or // in a string is none)
  const comment = JS.test(f) || WEB.test(f) ? /^\s*\/\/.*$/u : /^\s*#.*$/u;
  // (lines end as Windows writes them too, or a comment there would be read as code)
  const src = (WEB.test(f) ? executable(text, f) : text).split(/\r?\n/u).map((l) => l.replace(comment, "")).join("\n");
  if (YAML.test(f)) {
    for (const m of src.matchAll(/(?:^|[\s{,])['"]?uses['"]?\s*:\s*['"]?([^\s'",}]+)/gu)) {
      const used = m[1];
      if (used.startsWith("./") || used.startsWith(OWN)) continue;
      need(c, used.startsWith("docker://") ? used.split("@")[0] : used.split("@")[0].split("/").slice(0, 2).join("/"), f);
    }
  }
  fetches(c, src, f);
}

/** A script in a language the scan cannot read (scanned, above): the entries of what it uses cover it. */
function scanOther(c, f) {
  if (!byHand(c, f)) c.fail(`${f} is in a language the scan cannot read. Mend: name it in the "files" of the entries of what it uses`);
  else if (served(c, f) && !covering(c, f).every((e) => e.ships === true)) c.fail(`${f} (a script in a language the scan cannot read) reaches users, so every entry covering it ships. Mend: set "ships": true on each entry whose "files" covers it`);
}

/** A JSON file (scanned, above): the commands it holds, and, of a package.json, that a lockfile installs its
 *  dependencies. */
function scanJson(c, f, text) {
  let json;
  try { json = JSON.parse(text); } catch {
    // (a config with comments, as jsconfig.json and the like may hold: read whole, but a package.json must parse)
    if (posix.basename(f) === "package.json") c.fail(`${f} cannot be read as JSON, so the commands in it cannot be scanned. Mend: correct it to JSON`);
    else fetches(c, text.split(/\r?\n/u).map((l) => l.replace(/^\s*\/\/.*$/u, "")).join("\n"), f);
  }
  if (json === undefined) return;
  for (const line of linesIn(json, f, (g) => byHand(c, g), c.fail)) fetches(c, String(line), f, line.literal === true);
  const deps = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].some((k) => Object.keys(json?.[k] ?? {}).length);
  if (posix.basename(f) === "package.json" && deps && !c.locks.some(({ dir, packages }) => f.startsWith(dir) && packages[posix.dirname(f.slice(dir.length)).replace(/^\.$/u, "")]))
    c.fail(`${f} has dependencies no lockfile the config names installs, so nothing checks their licences. Mend: write its lockfile with npm, by its install given --package-lock-only, and name it in the config's "lockfiles"`);
}
