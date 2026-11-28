// Whether the core's code running now may run a script of a project's copy of the core, as the steps' readers and
// writers do (step-checks-tool-files.mjs, step-writers.mjs): only where the copy is this code itself, or holds what it
// can load byte for byte as this code does, so that one run from a clone never runs a copy that was changed (as
// attached.mjs, beside this file, says of its own run of the pointer check). Reads only; git and Node's own modules.
//
// Not held here, each asking a foothold first (the owner's answer 5 on release 8's hardening): what is installed beside
// the copy outside git, a change made between this reading and the run, and a sync at the pin the copy already has.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// (what a script of the core's can load: its scripts, and the packages it imports from .packages/ by its lock files)
export const LOADED = ["scripts", ".packages"];
const real = f => { try { return fs.realpathSync(f); } catch { return null; } };

// What the folders of LOADED in `dir` hold, as git lists them there (tracked, and new files it does not ignore), by path
// from `dir`: a file by a digest of its bytes as they stand, never through git's filters, which a project's own
// .gitattributes sets; a link by where it leads; anything else by its kind. Null where git cannot list them.
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
    out.set(f, stat.isSymbolicLink() ? `link ${fs.readlinkSync(at)}` : stat.isFile() ? `file ${crypto.createHash("sha256").update(fs.readFileSync(at)).digest("hex")}` : stat.isDirectory() ? "folder" : "other");
  }
  return out;
}
let own;

// Null where the copy at `at` (its path from the project's root `root`, as its manifest names it) may be run from here;
// else why not, with the mend, naming no path outside the project.
export function copyRefused(root, at) {
  const scripts = real(path.join(root, at, "scripts"));
  if (scripts !== null && scripts === real(HERE)) return null;
  own ??= held(path.dirname(HERE));
  const copy = held(path.join(root, at));
  const off = own && copy ? [...new Set([...own.keys(), ...copy.keys()])].sort().find(f => own.get(f) !== copy.get(f)) : null;
  if (own && copy && off === undefined) return null;
  const which = !own ? "the core running these steps is no work tree git lists" : !copy ? `git could not list ${at}` : `${at}${off} ${!copy.has(off) ? "is missing" : !own.has(off) ? "is not the core's" : "is changed"}`;
  return `${at}'s scripts and packages are not those of the core running these steps (${which}), so none of them was run from here. Mend: run the steps from the project's copy, \`node ${at}scripts/steps.mjs\`, or from a clone of the core at the copy's pin`;
}
