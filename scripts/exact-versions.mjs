#!/usr/bin/env node
// The exact-versions check (floor rule 7: "every package, tool and script at one exact version, never a range"), for a
// project whose packages come from npm. For each lock file the licence check's config names ("lockfiles"), it takes
// every package of the project's own that the lock file knows (the root and its workspaces) and holds each dependency
// that package asks for (dependencies, devDependencies, optionalDependencies, peerDependencies) to one test: what the
// package list says is, letter for letter, the version the lock file installs for it. A range, a tag, an alias, a git
// or web address or a path is none of those, so each fails; nothing here reads npm's version grammar, and npm's own
// reading is the lock file's. One thing passes besides: a dependency the lock file links to another of the project's
// own packages (a workspace), whatever its list says. What it does not hold: "overrides", which pick among versions the
// lock file still pins; and a lock file out of step with its lists, which `npm ci` refuses.
//
// Usage, from the project's root:  node core/scripts/exact-versions.mjs <the licence check's config>
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

const KINDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const own = (key) => key === "" || !`/${key}/`.includes("/node_modules/");

// The entry npm installs for `name` as seen from the package at `from`: the nearest node_modules going up.
function installed(packages, from, name) {
  for (let dir = from; ; dir = dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "") {
    const key = posix.join(dir, "node_modules", name);
    if (Object.hasOwn(packages, key)) return packages[key];
    if (dir === "") return undefined;
  }
}

export function check(lockfile, read) {
  const problems = [];
  let lock;
  try { lock = JSON.parse(read(lockfile)); } catch (e) { return [`${lockfile}: cannot be read as JSON (${e.message})`]; }
  const packages = lock?.packages;
  if (packages === null || typeof packages !== "object" || Array.isArray(packages)) return [`${lockfile}: holds no "packages" (lockfileVersion 2 or later is needed)`];
  const root = posix.dirname(lockfile);
  for (const key of Object.keys(packages).filter(own)) {
    if (packages[key]?.link === true) continue; // (a link's target is listed under its own folder)
    const file = posix.join(root, key, "package.json");
    let list;
    try { list = JSON.parse(read(file)); } catch (e) { problems.push(`${file}: cannot be read as JSON (${e.message})`); continue; }
    for (const kind of KINDS) {
      const deps = list?.[kind];
      if (deps === undefined) continue;
      if (deps === null || typeof deps !== "object" || Array.isArray(deps)) { problems.push(`${file}: "${kind}" is no list of names and versions`); continue; }
      for (const [name, spec] of Object.entries(deps)) {
        const entry = installed(packages, key, name);
        if (entry === undefined) {
          if (kind === "peerDependencies" || kind === "optionalDependencies") continue; // (a lock file may leave these out)
          problems.push(`${file}: ${kind} "${name}": "${spec}" is not in ${lockfile}`);
        } else if (entry.link === true && typeof entry.resolved === "string" && own(entry.resolved) && Object.hasOwn(packages, entry.resolved)) {
          continue; // (one of the project's own packages)
        } else if (typeof spec !== "string" || typeof entry.version !== "string" || spec !== entry.version) {
          problems.push(`${file}: ${kind} "${name}": "${spec}" is not the one exact version the lock file installs (${entry.version ?? "none"})`);
        }
      }
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const configPath = process.argv[2];
  if (!configPath) { console.error("usage: node core/scripts/exact-versions.mjs <the licence check's config>"); process.exit(2); }
  let lockfiles;
  try { lockfiles = JSON.parse(readFileSync(configPath, "utf8")).lockfiles ?? []; } catch (e) { console.error(`FAIL: ${configPath} cannot be read (${e.message})`); process.exit(1); }
  if (!Array.isArray(lockfiles) || lockfiles.some((f) => typeof f !== "string")) { console.error(`FAIL: "lockfiles" in ${configPath} is no list of paths`); process.exit(1); }
  const problems = lockfiles.flatMap((f) => check(posix.normalize(f), (p) => readFileSync(p, "utf8")));
  for (const p of problems) console.error(`FAIL: ${p}`);
  console.log(problems.length ? `${problems.length} dependencies not at one exact version (floor rule 7)` : `ok   every dependency of ${lockfiles.length} lock file${lockfiles.length === 1 ? "" : "s"} is at the one exact version it installs`);
  process.exit(problems.length ? 1 : 0);
}
