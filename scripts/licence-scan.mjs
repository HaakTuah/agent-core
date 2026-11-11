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
//   - an entry for each package npx, npm exec, npm install (and its other spellings) or npm pack fetches, in any
//     workflow, script or tool (a file with no extension read as a shell script), any command in a JSON or TOML file
//     (package.json's "scripts", a hook's "command") and any command written as an array (execFileSync("npx", [...])):
//     written name@exact.version, and audited at that version, one entry for each version used, so an update is audited
//     again, with what it pulls in. npx --no-install (or --no) never fetches, so a bare name passes there. A word that
//     is no command, straight after an option, is read as that option's value. A fetch it cannot read (a bare name, a
//     range or tag, an alias, a URL, git, a variable, npm init or create, which fetch by another name, npm update,
//     which takes the newest a range allows) fails, but npm pack's, which runs nothing it fetches, and another
//     fetcher's (curl, wget, pip, pnpm, yarn, bun, playwright install, git clone and the like): each of those passes
//     only in a file an entry's "files" names, that entry its hand audit;
//   - an entry covering each script in a language it cannot read (Python, Ruby, PowerShell and the like): the entries
//     of what it uses;
//   - an entry covering each file but prose (Markdown, text) carrying a licence notice, code in any language or a text
//     asset (an SVG), and each font, image, sound, video, model or data file, and each binary file whatever its name;
//   - what lies under "served" but not "tools" reaches users, so an entry covering it there ships.
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

const OWN = "HaakTuah/";
const SHELL = /\.(ya?ml|sh|bash|zsh|fish|mk|toml|envrc)$|(^|\/)(Dockerfile[^/]*|Makefile|GNUmakefile|\.envrc)$/iu;
const JS = /\.([cm]?[jt]sx?)$/iu;
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
// npm's commands that fetch a package, by every spelling npm takes; those that fetch nothing new (the lockfile's own,
// or none); and options known to take a value. A word that is no command, straight after an option, is read as that
// option's value, so an option it does not know cannot hide the command after it.
const INSTALL = new Set(["install", "i", "in", "ins", "inst", "insta", "instal", "isnt", "isnta", "isntal", "isntall", "add", "install-test", "it", "pack"]);
const RUN = new Set(["exec", "x"]);
const BY_OTHER_NAME = new Set(["create", "init", "innit"]);
const UPDATE = new Set(["update", "up", "upgrade", "udpate"]);
const NO_FETCH = new Set([
  "access", "adduser", "audit", "author", "bugs", "issues", "cache", "ci", "clean-install", "ic", "install-clean", "isntall-clean",
  "cit", "clean-install-test", "completion", "config", "c", "get", "set", "dedupe", "ddp", "deprecate", "diff", "dist-tag",
  "docs", "home", "doctor", "edit", "explain", "why", "explore", "find-dupes", "fund", "help", "hlp", "help-search", "hook",
  "link", "ln", "ll", "la", "login", "logout", "ls", "list", "org", "outdated", "owner", "ping", "pkg", "prefix", "profile",
  "prune", "publish", "query", "rebuild", "rb", "repo", "restart", "root", "run", "run-script", "rum", "urn", "sbom",
  "search", "find", "s", "se", "shrinkwrap", "star", "stars", "start", "stop", "team", "test", "t", "tst", "token",
  "undeprecate", "uninstall", "unlink", "remove", "rm", "r", "un", "unpublish", "unstar", "version", "verison", "v",
  "view", "info", "show", "whoami",
]);
const VALUED = new Set([
  "-C", "-w", "-L", "--access", "--auth-type", "--before", "--browser", "--ca", "--cache", "--cafile", "--call", "-c",
  "--cert", "--cidr", "--cpu", "--depth", "--diff", "--diff-dst-prefix", "--diff-src-prefix", "--diff-unified",
  "--editor", "--expect-result-count", "--fetch-retries", "--fetch-retry-factor", "--fetch-retry-maxtimeout",
  "--fetch-retry-mintimeout", "--fetch-timeout", "--globalconfig", "--heading", "--https-proxy", "--include",
  "--init-author-email", "--init-author-name", "--init-author-url", "--init-license", "--init-module", "--init-version",
  "--install-strategy", "--key", "--libc", "--local-address", "--location", "--lockfile-version", "--loglevel",
  "--logs-dir", "--logs-max", "--maxsockets", "--message", "-m", "--node-options", "--noproxy", "--omit", "--os", "--otp",
  "--pack-destination", "--preid", "--prefix", "--provenance-file", "--proxy", "--registry", "--replace-registry-host",
  "--save-prefix", "--sbom-format", "--sbom-type", "--scope", "--script-shell", "--searchexclude", "--searchlimit",
  "--searchopts", "--searchstaleness", "--shell", "--tag", "--tag-version-prefix", "--umask", "--userconfig", "--viewer",
  "--which", "--workspace",
]);
// Other fetchers, as a command (at a line's or command's start, or as a program named in quotes before its arguments).
const OTHER_FETCHER = new RegExp(
  "(?:^|[\\s;&|(`$\'\"])(?:curl|wget)\\s+(?:-[-a-zA-Z]|https?://|[\'\"$])|['\"`](?:curl|wget|pip3?|pipx|pnpm|yarn|bunx|bun|gem|cargo|deno)['\"`]\\s*,\\s*\\[|" +
    "['\"`]git['\"`]\\s*,\\s*\\[\\s*['\"`]clone|" +
    "\\b(?:pipx?3?\\s+install|pnpm\\s+(?:dlx|add|install|i)\\s|yarn\\s+(?:dlx|add)\\s|bunx\\s|bun\\s+(?:add|x|install)\\s|playwright\\s+install|" +
    "git\\s+clone|gem\\s+install|cargo\\s+install|go\\s+install|apt(?:-get)?\\s+install|brew\\s+install|deno\\s+(?:install|run))",
  "mu",
);

/**
 * What one command line fetches: { specs, unreadable, packs } where specs are the packages written for npx, npm exec,
 * npm install (and its other spellings) or npm pack, unreadable says why a fetch could not be read, and packs that it
 * is npm pack, which only fetches. Each word loses the quotes, brackets and commas of the string or call it sits in.
 * Others: { specs: [] }.
 */
export function fetched(line) {
  const all = line.trim().split(/\s+/u).map((w) => w.replace(/^['"`([]+|['"`),;\]]+$/gu, "")).filter(Boolean);
  const end = all.findIndex((w) => w.startsWith("#") || w.startsWith("//")); // (a comment after the command)
  const words = end < 0 ? all : all.slice(0, end);
  // (an audited name means the npm registry's package: a command that fetches from elsewhere cannot be audited by it)
  if (/^(npx|npm)$/u.test(words[0] ?? "") && words.some((w) => /^--?(@[^=]*:)?registry\b|^--replace-registry-host\b|^--(user|global)config\b|^npm_config_.*(registry|config)/iu.test(w)))
    return { specs: [], unreadable: "it fetches from another registry than npm's, or reads another npm config that may name one" };
  let i = 0;
  const options = () => { while (i < words.length && words[i].startsWith("-")) i += VALUED.has(words[i]) ? 2 : 1; };
  let runs = false, npx = false, local = false, packs = false;
  if (words[0] === "npx") { runs = npx = true; i = 1; } else if (words[0] === "npm") {
    // (after npm, its options; a word that is no command, straight after an option, is taken as that option's value)
    const fetching = (w) => INSTALL.has(w) || RUN.has(w) || BY_OTHER_NAME.has(w) || UPDATE.has(w);
    i = 1;
    let command;
    for (let afterOption = false; i < words.length; ) {
      const w = words[i++];
      if (w.startsWith("-")) { if (VALUED.has(w)) i++; afterOption = !VALUED.has(w) && !w.includes("="); continue; }
      if (fetching(w) || NO_FETCH.has(w) || !afterOption) { command = w; break; }
      afterOption = false;
    }
    if (command === undefined || !fetching(command)) return { specs: [] };
    if (UPDATE.has(command)) return { specs: [], unreadable: `npm ${command} fetches the newest release a range allows, which cannot be audited` };
    if (RUN.has(command)) runs = true;
    else if (BY_OTHER_NAME.has(command)) { options(); return words[i] ? { specs: [], unreadable: `npm ${command} fetches a package by another name` } : { specs: [] }; }
    else packs = command === "pack";
  } else return { specs: [] };
  // (npx reads its options up to the command it runs; npm exec reads them, --package among them, up to "--")
  const specs = [];
  let command;
  for (; i < words.length; i++) {
    const w = words[i];
    if (w === "--") { if (runs && !npx) { command ??= words[i + 1]; break; } continue; }
    if (w === "-p" || w === "--package") { specs.push(words[++i] ?? ""); continue; }
    if (w.startsWith("--package=")) { specs.push(w.slice(10)); continue; }
    if (runs && (w === "--no-install" || w === "--no")) { local = true; continue; }
    if (runs && (w === "--yes" || w === "-y")) { local = false; continue; }
    if (VALUED.has(w)) { i++; continue; }
    if (w.startsWith("-")) continue;
    if (!runs) { specs.push(w); continue; }
    command ??= w;
    if (npx) break;
  }
  if (runs && !specs.length && command !== undefined && !local) specs.push(command);
  return { specs, packs };
}

/**
 * A YAML folded block ("key: >") as the one line it reads as: the lines after it indented deeper than its key, up to a
 * blank line or one indented no deeper, joined with spaces (as YAML folds them).
 */
function folded(text) {
  const lines = text.split(/\r?\n/u), out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*(?:-\s+)?)[\w'"$.-]+\s*:\s*>[-+]?\d?\s*$/u.exec(lines[i]);
    if (!m) { out.push(lines[i]); continue; }
    // (blank lines inside the block, before a line still deeper, break it into the lines YAML folds it to)
    const key = m[1].length, start = i, block = [""];
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) { if (block.at(-1)) block.push(""); continue; }
      if (lines[j].search(/\S/u) <= key) break;
      block[block.length - 1] += ` ${lines[j].trim()}`;
      i = j;
    }
    out.push(`${lines[start]}${block[0]}`, ...block.slice(1).filter(Boolean));
  }
  return out.join("\n");
}

/** The strings of an array written only of string literals ("[", literals and commas, "]"), or null: read by hand. */
function literalArray(src) {
  if (src[0] !== "[") return null;
  const out = [], space = () => { while (/\s/u.test(src[i] ?? "")) i++; };
  let i = 1;
  for (;;) {
    space();
    if (src[i] === "]") return i === src.length - 1 ? out : null;
    const quote = src[i];
    if (quote !== "'" && quote !== '"' && quote !== "`") return null;
    const end = src.indexOf(quote, i + 1);
    if (end < 0 || (quote === "`" && src.slice(i, end).includes("${"))) return null;
    out.push(src.slice(i + 1, end));
    i = end + 1;
    space();
    if (src[i] === ",") i++;
    else if (src[i] !== "]") return null;
  }
}

/**
 * The command lines in a text: each npx or npm and what follows it on its line, and each written as an array. A line
 * continued on the next (a shell's "\\" at its end, or a YAML folded block, "key: >") is read as one.
 */
function commands(text) {
  const out = [];
  const joined = folded(text.replace(/\\\r?\n/gu, " "));
  for (const m of joined.matchAll(/\b(npx|npm)\b(?!['"`]\s*,)[^\n;&|>]*/gu)) out.push(m[0]); // (an array, below)
  // (an array of literal strings is read as its words; any other arguments, a variable or a spread, cannot be)
  for (const m of joined.matchAll(/['"`](npx|npm)['"`]\s*,\s*(\[[^\]]*\]?|[^\s)]*)/gu)) {
    const literal = literalArray(m[2]);
    const first = /^\[\s*(?:'([^']*)'|"([^"]*)"|`([^`$]*)`)/u.exec(m[2]), command = first && (first[1] ?? first[2] ?? first[3]);
    if (literal) out.push([m[1], ...literal].join(" "));
    else if (!(m[1] === "npm" && NO_FETCH.has(command))) out.push(`${m[1]} ${m[1] === "npm" ? "install " : ""}<its-arguments,-not-written-out>`); // (npm view with a variable: no fetch)
  }
  return out;
}

/**
 * The commands in a JSON value, one line each: every string in it (package.json's "scripts" and tools' hooks, a hook's
 * "command", a task's, a container's set-up) but those under a key of prose (an "about", a "description", a "how"),
 * which may name a command without running it. In each object, the strings and lists under keys that hold a command
 * (a task's "command" and "args", a launch's "runtimeExecutable" and "runtimeArgs") are read as one line, so a program
 * meets its arguments.
 */
const COMMAND = /command|cmd|script|exec|args|^run$/iu;
const PROSE = /^(\$?comment|about|description|summary|how|used|why|notes?|help|message|text|title|label|keywords|author|contributors|maintainers|homepage|repository|bugs|funding|licen[cs]e|url)$/iu;
const strings = (v) => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);
function commandLines(v) {
  if (!v || typeof v !== "object") return typeof v === "string" ? [v] : [];
  const programs = [], args = [], out = [];
  for (const [k, x] of Object.entries(v)) {
    if (!Array.isArray(v) && PROSE.test(k)) continue;
    const listed = Array.isArray(x) && x.every((y) => typeof y === "string");
    if (!Array.isArray(v) && COMMAND.test(k) && typeof x === "string") programs.push(x);
    else if (!Array.isArray(v) && COMMAND.test(k) && listed) args.push(...x);
    else if (!Array.isArray(v) && COMMAND.test(k)) out.push(...strings(x)); // (package.json's "scripts": every one, a "help" too)
    else out.push(...commandLines(x));
  }
  // (one program with its arguments, as a task or a launch writes them; several, each its own line, as scripts are)
  if (programs.length === 1) return [[programs[0], ...args].join(" "), ...out];
  return [...programs, ...(args.length ? [args.join(" ")] : []), ...out];
}

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
    else if (served(f) && !by.some((e) => e.ships === true)) fail(`${f} (${what}) reaches users, so an entry covering it ships`);
  };
  const byHand = (f) => covering(f).some((e) => e.kind !== "own");
  const fetches = (text, f) => {
    for (const line of commands(text)) {
      const { specs, unreadable, packs } = fetched(line);
      const where = `${f}, ${line.trim().slice(0, 120)}`;
      if (unreadable) fail(`${where}: ${unreadable}, which cannot be audited (fetch it as npx -p <name>@<exact version>)`);
      for (const spec of specs) {
        const exact = EXACT.exec(spec);
        if (exact) need(exact[1], where, exact[2]);
        else if (!(packs && byHand(f))) fail(`${where}: ${spec} cannot be audited (only name@exact.version${packs ? `, unless an entry's "files" names ${f}` : ""})`);
      }
    }
    if (/\bnpm_config_(@[\w-]+:)?registry\b|\bnpm_config_replace_registry_host\b|\bnpm_config_(user|global)config\b/iu.test(text)) fail(`${f}: it points npm at another registry than npm's, so no audited name can be trusted there`);
    if (OTHER_FETCHER.test(text) && !byHand(f)) fail(`${f}: ${OTHER_FETCHER.exec(text)[0]} fetches what no entry's "files" says (name ${f} in the entry that audits it)`);
  };

  for (const key of ["served", "tools", "skip"]) for (const p of settings[key] ?? []) if (p !== "" && !tracked.some((f) => holds(p, f))) fail(`the config's "scan.${key}": ${p} names no tracked file (a folder ends in "/")`);
  for (const e of entries) {
    if (e.files !== undefined && (!Array.isArray(e.files) || e.files.some((p) => typeof p !== "string" || !p))) { fail(`${auditPath}: ${e.name}: "files" is not a list of paths`); continue; }
    if (e.version !== undefined && typeof e.version !== "string") fail(`${auditPath}: ${e.name}: "version" is not text`);
    if (e.kind === "own" && (e.version !== undefined || (e.files ?? []).some((p) => p.endsWith("/")))) fail(`${auditPath}: ${e.name}: the owner's own work names its files one by one, with no version`);
    for (const p of e.files ?? []) if (!tracked.some((f) => holds(p, f))) fail(`${auditPath}: ${e.name}: ${p} names no tracked file`);
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
    const runs = !other && (SHELL.test(f) || JS.test(f) || bare);
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
        continue;
      }
      fetches(commandLines(json).join("\n"), f);
      const deps = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].some((k) => Object.keys(json?.[k] ?? {}).length);
      if (posix.basename(f) === "package.json" && deps && !locks.some(({ dir, packages }) => f.startsWith(dir) && packages[posix.dirname(f.slice(dir.length)).replace(/^\.$/u, "")]))
        fail(`${f} has dependencies no lockfile the config names installs, so nothing checks their licences`);
    } else if (other) {
      if (!byHand(f)) fail(`${f} is in a language the scan cannot read: name it in the "files" of the entries of what it uses`);
      else if (served(f) && !covering(f).some((e) => e.kind !== "own" && e.ships === true)) fail(`${f} (a script in a language the scan cannot read) reaches users, so an entry covering it ships`);
    }
    // (a notice in any file but prose, the notices a project writes itself among them: code copied in, in any language)
    if (!binary.has(f) && !PROSE_FILE.test(f) && NOTICE.test(text)) needFile(f, "a file carrying a licence notice", { own: false });
    if (ASSET.test(f) || binary.has(f)) needFile(f, binary.has(f) && !ASSET.test(f) ? "a binary file" : "a font, image, sound, video, model or data file");
  }
  return { failures, scanned: files.length };
}
