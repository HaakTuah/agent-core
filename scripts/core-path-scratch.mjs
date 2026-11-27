// What the tests of core-path.mjs stand on (core-path-test.mjs and core-path-hooks-test.mjs): the manifest's "Core:" line in both of its forms,
// and the checkouts by which the tests of the scripts that take copyHeld or copyAside set the core's own repository beside a project's copy. Tests only.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "./core-address.mjs";
import { scratchDir } from "./scratch-core.mjs";

// The workflows a project calls whose first step reads where the core's copy stands.
export const CALLED = ["copies.yml", "core-moved.yml", "licences.yml", "look.yml", "nuget.yml", "pr-description.yml", "signatures.yml", "versions.yml"];
export const A = "a".repeat(40);
export const copied = (at = "core/") => `# Core manifest\n\nCore: ${CORE} at ${A}, copied whole under ${at} (never edited here).\n`;
export const carried = (lib = "lib/", at = "lib/core/") => `# Core manifest\n\nCore: ${CORE}, carried by ${lib} under ${at} (never edited here).\nFloor copy: floor-copy/\n`;
// (a scratch folder: the script is run in it as from a project's root, and the hooks' cases make their projects in it)
export const tmp = scratchDir("core-path-test-");
// (the script the core's own repository alone tracks at its root, which tells it apart from a project's copy: #1350)
export const OWN_SCRIPT = { "scripts/core-path.mjs": "export {};\n" };
// A git checkout at <dir>/<name> of `files`, each added, and with `commit` committed, the machine's git settings set
// aside so that none of them (a signing key, a hook) bears on the case.
export function checkout(dir, name, files, { commit = false } = {}) {
  const at = path.join(dir, name);
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(at, file)), { recursive: true }); fs.writeFileSync(path.join(at, file), text); }
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/u.test(key))), GIT_CONFIG_GLOBAL: path.join(dir, "none"), GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  for (const args of [["init", "-q"], ["add", "-A"], ...(commit ? [["commit", "-qm", "base"]] : [])]) execFileSync("git", args, { cwd: at, env, stdio: "ignore" });
  return at;
}
