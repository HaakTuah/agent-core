// The licence check's scan (floor rule 10, in floor/topics.md beside this folder): nothing a project uses is left out
// of its audit, so the check (licences.mjs, beside this file, which runs this when its config has "scan") holds
// everything to its list, not only what a lockfile names. It reads the project's tracked files (git ls-files), but
// what "skip" names and, in a project, its copy of the core, which the core's own scan audits (.github/licences.json
// in the core). An entry covers a file by its "name" (the file's path) or its "files" (paths, or folders ending in
// "/"). It needs:
//   - each lockfile the config's "lockfiles" names, and each package.json with dependencies beside one of them or a
//     workspace of one, so the check reads every package any of them installs;
//   - an entry for each action a workflow or action file uses (`uses:`), but the owner's own (HaakTuah/, the core's
//     workflows among them) and the project's (./), by its name (owner/repo), at whatever version it is pinned to;
//   - an entry for each package a command fetches (licence-commands.mjs, beside this file, reads them: npx, npm exec,
//     npm install, npm link and npm pack, in any workflow, script or tool, a file with no extension read as a shell
//     script, the script blocks of a page or component, any command in a JSON or TOML file), written
//     name@exact.version and audited at that version, one entry for each version used, so an update is audited again,
//     with what it pulls in. A fetch it cannot read fails, but npm pack's, which runs nothing it fetches, and another
//     fetcher's (curl, wget, pip, pnpm, yarn, bun, playwright install, git clone and the like): each of those passes
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
import { OTHER_FETCHER, commandLines, commands, fetched } from "./licence-commands.mjs";

const OWN = "HaakTuah/";
const SHELL = /\.(ya?ml|sh|bash|zsh|fish|mk|toml|envrc)$|(^|\/)(Dockerfile[^/]*|Makefile|GNUmakefile|\.envrc)$/iu;
const JS = /\.([cm]?[jt]sx?)$/iu;
const WEB = /\.(html?|vue|svelte|astro)$/iu; // (pages and components, whose script blocks run too)
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
/** The failures of the scan of the project at `root`, against its audit's `entries` (read from `auditPath`). */
export function scan(settings, root, entries, auditPath, lockfiles = []) {
  const failures = [];
  const fail = (m) => { if (!failures.includes(m)) failures.push(m); };
  const holds = (p, f) => typeof p === "string" && (p === "" || p === f || (p.endsWith("/") && f.startsWith(p)));
  const under = (f, paths) => (paths ?? []).some((p) => holds(p, f));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
  const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
  const project = tracked.includes("core-manifest.md"); // (a project, whose copy of the core the core audits)
  const files = tracked.filter((f) => !(project && f.startsWith("core/")) && !under(f, settings.skip));
  const binary = new Set(git("ls-files", "--eol", "-z").split("\0").filter((l) => /^i\/-text\s/u.test(l)).map((l) => l.slice(l.indexOf("\t") + 1)));
  const served = (f) => under(f, settings.served) && !under(f, settings.tools);
  const covers = (e, f) => e.name === f || (Array.isArray(e.files) && e.files.some((p) => p !== "" && holds(p, f)));
  const covering = (f) => entries.filter((e) => covers(e, f));
  const need = (name, where, version) => {
    const named = entries.filter((e) => e.name === name && e.kind !== "own");
    if (!named.length) fail(`${name} (${where}) is not in ${auditPath}`);
    else if (version && !named.some((e) => e.version === version)) fail(`${name}@${version} (${where}) is audited at ${named.map((e) => e.version ?? "no version").join(", ")}: audit the new version, and what it pulls in`);
  };
  const needFile = (f, what, { own = true } = {}) => {
    const by = covering(f).filter((e) => own || e.kind !== "own");
    if (!by.length) fail(`${f} (${what}) is not in ${auditPath}${own ? "" : ", by an entry not the owner's own"}`);
    else if (served(f) && !by.every((e) => e.ships === true)) fail(`${f} (${what}) reaches users, so every entry covering it ships`);
  };
  const byHand = (f) => covering(f).some((e) => e.kind !== "own");
  const fetches = (text, f) => {
    for (const line of commands(text, JS.test(f) || WEB.test(f))) {
      const { specs, unreadable, packs } = fetched(String(line), line.atCommand === true);
      const where = `${f}, ${line.trim().slice(0, 120)}`;
      if (unreadable) fail(`${where}: ${unreadable}, which cannot be audited (fetch it as npx -p <name>@<exact version>)`);
      for (const spec of specs) {
        const exact = EXACT.exec(spec);
        if (exact) need(exact[1], where, exact[2]);
        else if (!(packs && byHand(f))) fail(`${where}: ${spec} cannot be audited (only name@exact.version${packs ? `, unless an entry's "files" names ${f}` : ""})`);
      }
    }
    if (/\bnpm_config_(@[\w-]+:)?registry\b|\bnpm_config_replace_registry_host\b|\bnpm_config_(user|global)config\b/iu.test(text)) fail(`${f}: it points npm at another registry than npm's, so no audited name can be trusted there`);
    if (/\bnpm_config_(package_lock|shrinkwrap)\b/iu.test(text)) fail(`${f}: it installs without the lockfile, so what it installs is not what the lockfile's check read`);
    if (OTHER_FETCHER.test(text) && !byHand(f)) fail(`${f}: ${OTHER_FETCHER.exec(text)[0]} fetches what no entry's "files" says (name ${f} in the entry that audits it)`);
  };

  for (const key of ["served", "tools", "skip"]) for (const p of settings[key] ?? []) if (p !== "" && !tracked.some((f) => holds(p, f))) fail(`the config's "scan.${key}": ${p} names no tracked file (a folder ends in "/")`);
  for (const e of entries) {
    if (e.files !== undefined && (!Array.isArray(e.files) || e.files.some((p) => typeof p !== "string" || !p))) { fail(`${auditPath}: ${e.name}: "files" is not a list of paths`); continue; }
    if (e.version !== undefined && typeof e.version !== "string") fail(`${auditPath}: ${e.name}: "version" is not text`);
    if (e.kind === "own" && (e.version !== undefined || (e.files ?? []).some((p) => p.endsWith("/")))) fail(`${auditPath}: ${e.name}: the owner's own work names its files one by one, with no version`);
    for (const p of e.files ?? []) if (!tracked.some((f) => holds(p, f))) fail(`${auditPath}: ${e.name}: ${p} names no tracked file`);
    const shipped = files.find((f) => served(f) && covers(e, f));
    if (shipped && e.ships !== true) fail(`${auditPath}: ${e.name}: it covers ${shipped}, which reaches users, so it ships`);
  }
  const locks = lockfiles.map((l) => ({ dir: posix.dirname(l) === "." ? "" : `${posix.dirname(l)}/`, packages: JSON.parse(readFileSync(join(root, l), "utf8")).packages ?? {} }));
  for (const f of files) {
    if (LOCKFILE.test(f) && !lockfiles.includes(f)) fail(`${f} installs packages the config's "lockfiles" does not name, so nothing checks their licences`);
    const text = binary.has(f) ? "" : readFileSync(join(root, f), "utf8");
    // (a file with no extension, a hook or a script, is read by its #! line: as shell or JavaScript, or as a language the
    // scan cannot read; with none, as shell)
    const bare = !binary.has(f) && !/.\.\w+$/u.test(posix.basename(f)); // (".envrc" and the like have none either)
    const interpreter = bare && text.startsWith("#!") ? /^#!\s*\S*?(?:env\s+(?:-\S+\s+)*)?([\w.-]+)/u.exec(text.split("\n")[0].replace(/^#!\s*\S*\//u, "#!"))?.[1] ?? "" : "";
    const other = OTHER_LANGUAGE.test(f) || (bare && interpreter && !/^(sh|bash|dash|zsh|ksh|node|deno|bun|tsx|ts-node)$/u.test(interpreter));
    const runs = !other && (SHELL.test(f) || JS.test(f) || WEB.test(f) || bare);
    if (runs) {
      // (a line that is only a comment fetches nothing; a comment after code stays, since a # or // in a string is none)
      const comment = JS.test(f) ? /^\s*\/\/.*$/u : /^\s*#.*$/u;
      const src = text.split("\n").map((l) => l.replace(comment, "")).join("\n");
      if (YAML.test(f)) {
        for (const m of src.matchAll(/(?:^|[\s{,])['"]?uses['"]?\s*:\s*['"]?([^\s'",}]+)/gu)) {
          const used = m[1];
          if (used.startsWith("./") || used.startsWith(OWN)) continue;
          need(used.startsWith("docker://") ? used.split("@")[0] : used.split("@")[0].split("/").slice(0, 2).join("/"), f);
        }
      }
      fetches(src, f);
    } else if (/\.json[c5]?$/u.test(f) && f !== auditPath && !LOCKFILE.test(f)) {
      let json;
      try { json = JSON.parse(text); } catch {
        // (a config with comments, as jsconfig.json and the like may hold: read whole, but a package.json must parse)
        if (posix.basename(f) === "package.json") fail(`${f} cannot be read as JSON, so the commands in it cannot be scanned`);
        else fetches(text.split("\n").map((l) => l.replace(/^\s*\/\/.*$/u, "")).join("\n"), f);
      }
      if (json !== undefined) {
        fetches(commandLines(json).join("\n"), f);
        const deps = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].some((k) => Object.keys(json?.[k] ?? {}).length);
        if (posix.basename(f) === "package.json" && deps && !locks.some(({ dir, packages }) => f.startsWith(dir) && packages[posix.dirname(f.slice(dir.length)).replace(/^\.$/u, "")]))
          fail(`${f} has dependencies no lockfile the config names installs, so nothing checks their licences`);
      }
    } else if (other) {
      if (!byHand(f)) fail(`${f} is in a language the scan cannot read: name it in the "files" of the entries of what it uses`);
      else if (served(f) && !covering(f).every((e) => e.ships === true)) fail(`${f} (a script in a language the scan cannot read) reaches users, so every entry covering it ships`);
    }
    // (a notice in any file but prose, the notices a project writes itself among them: code copied in, in any language)
    if (!binary.has(f) && !PROSE_FILE.test(f) && NOTICE.test(text)) needFile(f, "a file carrying a licence notice", { own: false });
    if (ASSET.test(f) || binary.has(f)) needFile(f, binary.has(f) && !ASSET.test(f) ? "a binary file" : "a font, image, sound, video, model or data file");
  }
  return { failures, scanned: files.length };
}
