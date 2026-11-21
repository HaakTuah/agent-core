// The core's install step in the test's runner (scripts/workflow-run.mjs, its `installed` option): a step that runs
// install.mjs puts the packages into the workspace, so its first run is copied aside and each later job, with the same
// text, env and lock files, gets a hard-linked copy of it and the step's result in place of running it (#812).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// What an install step is kept under (the same, with the core's lock files and its install script in place of the pinned
// scripts), and the core's .packages/ folder it installs into; null for a step that does not run install.mjs.
export function installKey(rt, text, cwd, env) {
  if (!rt.installed || !/\bscripts\/install\.mjs\b/u.test(text)) return null;
  const core = path.join(cwd, env.CORE_AT ?? ""), packages = path.join(core, ".packages");
  const read = f => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };
  const locks = [packages, ...(fs.existsSync(packages) ? fs.readdirSync(packages, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== "node_modules" && d.name !== "pypi").map(d => path.join(packages, d.name)) : [])]
    .map(d => [path.relative(core, d), read(path.join(d, "package-lock.json")), read(path.join(d, "package.json"))]);
  return { key: JSON.stringify([text, env, read(path.join(core, "scripts/install.mjs")), read(path.join(packages, "requirements.txt")), locks]), packages };
}

// The folders an install left in .packages/, relative to it: node_modules/ and pypi/ of it and of each folder below.
function installedFolders(packages) {
  const at = d => ["node_modules", "pypi"].filter(f => fs.existsSync(path.join(d, f))).map(f => path.relative(packages, path.join(d, f)));
  const below = fs.existsSync(packages) ? fs.readdirSync(packages, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== "node_modules" && d.name !== "pypi").flatMap(d => at(path.join(packages, d.name))) : [];
  return [...at(packages), ...below];
}

// A folder copied with its files hard-linked where the system can, so that a copy of the parser's packages costs no bytes.
function linkCopy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (process.platform !== "win32" && spawnSync("cp", ["-al", from, to]).status === 0) return;
  fs.cpSync(from, to, { recursive: true });
}

// What a passed install left in the workspace, copied aside into the folder the caller made and kept with the step's
// result; and a later job's copy of it, with that result (undefined where none was kept, or the step is no install).
export function keepInstall(rt, install, result) {
  if (!install || !result.passed) return;
  const folders = installedFolders(install.packages), snapshot = fs.mkdtempSync(path.join(rt.installed.temp, "installed-"));
  for (const f of folders) linkCopy(path.join(install.packages, f), path.join(snapshot, f));
  rt.installed.store.set(install.key, { ...result, folders, snapshot });
}
export function takeInstall(rt, install) {
  const kept = install && rt.installed.store.get(install.key);
  for (const f of kept?.folders ?? []) linkCopy(path.join(kept.snapshot, f), path.join(install.packages, f));
  return kept;
}
