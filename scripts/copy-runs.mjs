// Whether the core's code running now may run a script of a project's copy of the core, as the steps' readers and
// writers do (step-checks-tool-files.mjs, step-writers.mjs, the steps 825 and 827 of steps/, and attached.mjs where the
// copy was not found whole at its pin): only where the copy lies in the project and is this code itself, or holds what
// it can load byte for byte as this code does, so that one run from a clone never runs a copy that was changed. Reads
// only; git, Node's own modules, and step-checks.mjs and workflow-run.mjs beside it.
//
// Not held here, each asking a foothold first (the owner's answer 5 on release 8's hardening): what is installed beside
// the copy outside git, a change made between this reading and the run, a sync at the pin the copy already has, and
// what attached.mjs's own reading of a copy whole at its pin lets through.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { shown } from "./step-checks.mjs";
import { withAbsolutePath } from "./workflow-run.mjs";

// (no program is looked for in the folder it is started in, which the project fills, as check.mjs holds it, for each
// process that loads this file: the steps, and the copy's scripts they run. On Windows not by default, and on any system
// not by way of a relative entry on the PATH, "." or an empty one among them)
if (process.platform === "win32") process.env.NoDefaultCurrentDirectoryInExePath = "1";
for (const [key, value] of Object.entries(withAbsolutePath({ ...process.env }))) if (/^path$/iu.test(key)) process.env[key] = value;
const HERE = path.dirname(fileURLToPath(import.meta.url));
// (what a script of the core's can load: its scripts, and the packages it imports from .packages/ by its lock files)
export const LOADED = ["scripts", ".packages"];
const real = f => { try { return fs.realpathSync.native(f); } catch { return null; } };
const inside = (base, f) => base !== null && f !== null && (f === base || f.startsWith(`${base}${path.sep}`));

// What the folders of LOADED in `dir` hold, as git lists them there (tracked, and new files it does not ignore), by path
// from `dir`: a file by a digest of its bytes as they stand, never through git's filters, which a project's own
// .gitattributes sets; a link by where it leads; anything else by its kind. Null where git cannot list them or one
// listed cannot be read.
function held(dir) {
  let listed;
  try {
    listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...LOADED], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
  } catch { return null; }
  const out = new Map();
  for (const f of listed) {
    const at = path.join(dir, f);
    let stat;
    try { stat = fs.lstatSync(at); } catch { continue; } // (a tracked file taken away: not there)
    try { out.set(f, stat.isSymbolicLink() ? `link ${fs.readlinkSync(at)}` : stat.isFile() ? `file ${crypto.createHash("sha256").update(fs.readFileSync(at)).digest("hex")}` : stat.isDirectory() ? "folder" : "other"); } catch { return null; }
  }
  return out;
}
let own;

// Null where the copy at `at` (its path from the project's root `root`, as its manifest names it) and its scripts lie, by
// their real places, in the project's own tree; else why not, with the mend. A copy outside it is never run.
export function outside(root, at) {
  const base = real(root);
  return inside(base, real(path.join(root, at))) && inside(base, real(path.join(root, at, "scripts"))) ? null : `${shown(at)} or its scripts lie outside the project, so none of them was run from here. Mend: keep the copy in the project's own tree, as the sync writes it`;
}

// Null where the copy at `at` may be run from here; else why not, with the mend, naming no path outside the project.
export function copyRefused(root, at) {
  const away = outside(root, at);
  if (away) return away;
  if (real(path.join(root, at, "scripts")) === real(HERE)) return null;
  own ??= held(path.dirname(HERE));
  const copy = held(path.join(root, at));
  const off = own && copy ? [...new Set([...own.keys(), ...copy.keys()])].sort().find(f => own.get(f) !== copy.get(f)) : null;
  if (own && copy && off === undefined) return null;
  const which = !own ? "the core running these steps is no work tree git lists" : !copy ? `${shown(at)} could not be listed and read` : `${shown(`${at}${off}`)} ${!copy.has(off) ? "is missing" : !own.has(off) ? "is not the core's" : "is changed"}`;
  return `${shown(at)}'s scripts and packages are not those of the core running these steps (${which}), so none of them was run from here. Mend: run the steps from the project's copy, \`node ${shown(at)}scripts/steps.mjs\`, or from a clone of the core at the copy's pin`;
}

// A script of the copy at `at` run from the project's root `root`, from where it resolves once checked, given ten
// minutes so that none holds its caller:
// { status, out, err, error }, or { refused } where the copy holds no such script or may not be run from here.
export function runCopy(root, at, script, args, env = {}) {
  const file = path.join(root, at, "scripts", script);
  if (!fs.existsSync(file)) return { refused: `no copy of ${script} to run` };
  const refused = copyRefused(root, at);
  if (refused) return { refused };
  const r = spawnSync(process.execPath, [real(file) ?? file, ...args], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28, timeout: 600000, env: { ...process.env, ...env } });
  return { status: r.status, out: `${r.stdout}`, err: `${r.stderr}`, error: r.error };
}
