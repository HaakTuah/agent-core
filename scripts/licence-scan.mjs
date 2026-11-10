// The licence check's scan (floor rule 10, in floor/topics.md beside this folder): nothing a project uses is left out of
// its audit, so the check (licences.mjs, beside this file, which runs this when its config has "scan") holds everything
// to its list, not only what a lockfile names. It reads the project's tracked files (git ls-files), but its copy of the
// core, whose own scan audits it (.github/licences.json in the core), and what "skip" names. What it finds:
//   - each action a workflow or action file uses (`uses:`), but the owner's own (HaakTuah/, the core's workflows among
//     them) and the project's (./): an entry by its name (owner/repo), at whatever version it is pinned to;
//   - each package an npx, npm exec or npm install command fetches, in any workflow, script or tool (comments left
//     out): written name@exact.version, and audited at that version, so an update is audited again, with what it pulls
//     in; npx --no-install (or --no) never fetches, so a bare name passes there; anything else (a bare name, a range or
//     a tag, an alias, a URL, git, a path, a variable) cannot be audited, and fails;
//   - each code file carrying someone's licence notice (code copied in) and each font, image, sound, video or data
//     file: an entry naming it as its "name", or it or a folder holding it in its "files";
//   - what lies under the config's "served" (but its "tools") reaches users, so an entry covering it there ships.
// Each "files" path must still name a tracked file, or a folder holding one, so no entry is left covering nothing.
//
// The config's "scan" names "served", the folders (each ending in "/", or "" for the whole repository) whose files reach
// users; "tools", the folders within them whose files do not; and "skip", the folders or files left out. Node's own
// modules only.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const OWN = "HaakTuah/";
const RUNS = /\.(ya?ml|sh|bash|[cm]?[jt]s)$/iu;
const YAML = /\.ya?ml$/iu;
const CODE = /\.(html?|[cm]?[jt]sx?|css)$/iu;
const ASSET = /\.(png|jpe?g|gif|webp|avif|ico|bmp|svg|woff2?|ttf|otf|eot|mp3|ogg|oga|wav|flac|m4a|aac|opus|webm|mp4|csv|tsv)$/iu;
const NOTICE = /\/\*!|@license|SPDX-License-Identifier|Copyright \(c\)/iu;
const EXACT = /^((?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*)@(\d+\.\d+\.\d+)$/iu;
const FETCH = /\b(npx|npm(?:\s+-\S+)*\s+(?:install|in|i|add|exec|x))\s([^\n;&|>]*)/gu;

/**
 * The packages an npx, npm exec or npm install command fetches, as written: for npx and npm exec, those after -p or
 * --package, else its first word, unless --no-install or --no keeps it to what is installed; for npm install, every word
 * not an option.
 */
export function fetched(command, rest) {
  const runs = command === "npx" || /\s(exec|x)$/u.test(command);
  const words = rest.trim().split(/\s+/u).filter(Boolean), specs = [];
  let local = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === "-p" || w === "--package") { specs.push(words[++i] ?? ""); continue; }
    if (w.startsWith("--package=")) { specs.push(w.slice(10)); continue; }
    if (w === "--prefix") { i++; continue; } // (a folder to install into, not a package)
    if (runs && (w === "--no-install" || w === "--no")) { local = true; continue; }
    if (w === "--") continue;
    if (w.startsWith("-")) continue;
    if (runs) { if (!specs.length && !local) specs.push(w); break; }
    specs.push(w);
  }
  return specs;
}

/** The failures of the scan of the project at `root`, against its audit's `entries` (read from `auditPath`). */
export function scan(settings, root, entries, auditPath) {
  const failures = [];
  const fail = (m) => { if (!failures.includes(m)) failures.push(m); };
  const under = (f, prefixes) => (prefixes ?? []).some((p) => p === f || p === "" || (p.endsWith("/") && f.startsWith(p)));
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  const files = tracked.filter((f) => !f.startsWith("core/") && !under(f, settings.skip));
  const served = (f) => under(f, settings.served) && !under(f, settings.tools);
  const byName = new Map(entries.map((e) => [e.name, e]));
  const holds = (p, f) => typeof p === "string" && p !== "" && (p === f || (p.endsWith("/") && f.startsWith(p)));
  const covering = (f) => entries.filter((e) => e.name === f || (Array.isArray(e.files) && e.files.some((p) => holds(p, f))));
  const need = (name, where, version) => {
    const e = byName.get(name);
    if (!e) fail(`${name} (${where}) is not in ${auditPath}`);
    else if (version && e.version !== version) fail(`${name}@${version} (${where}) is audited at ${e.version ?? "no version"}: audit the new version, and what it pulls in`);
  };
  const needFile = (f, what) => {
    const by = covering(f);
    if (!by.length) fail(`${f} (${what}) is not in ${auditPath}`);
    else if (served(f) && !by.some((e) => e.ships === true)) fail(`${f} (${what}) reaches users, so an entry covering it ships`);
  };

  for (const e of entries) {
    if (e.files !== undefined && (!Array.isArray(e.files) || e.files.some((p) => typeof p !== "string" || !p))) { fail(`${auditPath}: ${e.name}: "files" is not a list of paths`); continue; }
    if (e.version !== undefined && typeof e.version !== "string") fail(`${auditPath}: ${e.name}: "version" is not text`);
    for (const p of e.files ?? []) if (!tracked.some((f) => holds(p, f))) fail(`${auditPath}: ${e.name}: ${p} names no tracked file`);
  }
  for (const f of files) {
    const text = RUNS.test(f) || CODE.test(f) ? readFileSync(join(root, f), "utf8") : "";
    if (RUNS.test(f)) {
      const comment = YAML.test(f) || /\.(sh|bash)$/iu.test(f) ? /(^|\s)#.*$/u : /(^|\s)\/\/.*$/u;
      const src = text.split("\n").map((l) => l.replace(comment, "")).join("\n"); // (a comment fetches nothing)
      if (YAML.test(f)) {
        for (const m of src.matchAll(/\buses:\s*['"]?([^\s'"]+)/gu)) {
          const used = m[1];
          if (used.startsWith("./") || used.startsWith(OWN)) continue;
          need(used.startsWith("docker://") ? used.split("@")[0] : used.split("@")[0].split("/").slice(0, 2).join("/"), f);
        }
      }
      for (const m of src.matchAll(FETCH)) {
        const where = `${f}, ${m[0].trim()}`;
        for (const spec of fetched(m[1], m[2])) {
          const exact = EXACT.exec(spec);
          if (!exact) fail(`${where}: ${spec} cannot be audited (only name@exact.version)`);
          else need(exact[1], where, exact[2]);
        }
      }
    }
    if (CODE.test(f) && NOTICE.test(text)) needFile(f, "a file carrying a licence notice");
    if (ASSET.test(f)) needFile(f, "a font, image, sound, video or data file");
  }
  return { failures, scanned: files.length };
}
