// Which of npm's settings that keep an install to the registry, and to a release a week old, the npm at hand reads
// (#704): each from its first version, as npm's own docs/content/using-npm/config.md of each version lists it; an older
// npm, npm 10 that Node 22 brings among them, ignores each without a word. checks.mjs's signature check installs only
// under an npm that reads those it gives, and install.mjs notes one that does not. Node's own modules only.
//
//   import { npmIgnores, npmReadsAll, npmVersion } from "./npm-reads.mjs";
import { spawnSync } from "node:child_process";

// The npm settings that keep an install to the registry, and to a release a week old, each with the first npm that reads
// it, as npm's own docs/content/using-npm/config.md of each version lists it: an older npm, npm 10 that Node 22 brings
// among them, ignores each without a word (#704).
export const NPM_READS = { "allow-git": "11.9.0", "allow-remote": "11.14.0", "allow-file": "11.14.0", "allow-directory": "11.14.0", "min-release-age": "11.10.0" };
// The first npm that reads every one of the settings named.
export const npmReadsAll = (settings = Object.keys(NPM_READS)) => settings.map(s => NPM_READS[s]).sort((a, b) => a.localeCompare(b, "en", { numeric: true })).at(-1);
// Of the settings named, those the npm at `version` ("10.9.9") does not read: every one where no version is given.
export function npmIgnores(version, settings = Object.keys(NPM_READS)) {
  const parts = v => (/^(\d+)\.(\d+)\.(\d+)/u.exec(v ?? "") ?? []).slice(1).map(Number);
  const [have, read] = [parts(version), s => parts(NPM_READS[s])];
  const older = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
  return settings.filter(s => have.length !== 3 || older(have, read(s)));
}
// The version of the npm the PATH finds, run in `cwd` (on Windows through its shell, by the path the system names, where
// npm is a .cmd file), or "" where it cannot be read.
export function npmVersion(cwd) {
  const opts = { cwd, encoding: "utf8" };
  const r = process.platform === "win32" ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm --version"], opts)
    : spawnSync("npm", ["--version"], opts);
  return /^\d+\.\d+\.\d+/u.exec((r.stdout ?? "").trim())?.[0] ?? "";
}
