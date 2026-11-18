// A package of another publisher, as the core installs it (#654): from .packages/node_modules/ in the core alone, never
// a project's own install of the same name at another version, and only where what is installed there is what the lock
// file names, each entry by its version, address and integrity (npm's own record of the install,
// .packages/node_modules/.package-lock.json, read against .packages/package-lock.json), so a folder an earlier install
// of another lock file left is never run. Where it is not so, the check that needs it did not run, and says so with the command that installs it
// (#254, #457); it never passes. In a project's pull request whose install could not reach the registry, a script asks
// unreached() first, and says that part did not run as a warning (#654, point 4).
//
//   import { load, loadSync } from "./packages.mjs";   const { Lexer } = await load("yaml");
//                                                     loadSync("yaml"): the same, at once, for a package of CommonJS,
//                                                     so a script loads it only where it is used, never on import
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// (the core's dot folder of its package list, lock file and install, which no workspace pattern of a project takes in)
const packages = path.join(root, ".packages");

const need = createRequire(path.join(packages, "package.json"));

// The package's module, imported from the core's own .packages/node_modules/; where it is not there, a failure that says the mend.
export async function load(name) {
  return import(pathToFileURL(found(name)).href);
}

// The same, required at once: a package whose entry is CommonJS, loaded where a function first uses it.
export function loadSync(name) {
  return need(found(name));
}

// Whether the package is installed in the core's own .packages/node_modules/, for what reads it and must not stop where it is
// not (steps.mjs, which never fails over one step).
export function installed(name) {
  return entry(name) !== null;
}

// Whether .packages/node_modules/ holds what .packages/package-lock.json names: each entry of the lock file in npm's record of the install,
// at the same version, from the same address, with the same integrity; all but those only the core's tests run, which
// no script loads and a copy does not install.
let current;
function matches() {
  if (current === undefined) {
    const read = f => { try { return JSON.parse(fs.readFileSync(path.join(packages, f), "utf8")).packages ?? {}; } catch { return null; } };
    const wanted = read("package-lock.json"), had = read("node_modules/.package-lock.json");
    current = Boolean(wanted && had) && Object.keys(wanted).filter(k => k && !wanted[k].dev).every(k => had[k] && ["version", "resolved", "integrity"].every(f => wanted[k][f] === had[k][f]));
  }
  return current;
}

// The package's entry file, in the core's own .packages/node_modules/ alone, as the lock file names it, or null.
function entry(name) {
  if (!matches()) return null;
  try {
    const own = fs.realpathSync(path.join(packages, "node_modules")) + path.sep;
    const at = need.resolve(name);
    return fs.realpathSync(at).startsWith(own) ? at : null;
  } catch { return null; }
}

// The lines of an .npmrc the core's install takes: none but a blank line, a comment, and the core's own two settings,
// install scripts off and the week's wait (floor rules 7 and 15). Every other line is returned, since npm reads far
// more than any list of forbidden forms could name (a registry, a host's token, a proxy, a certificate). Its lines are
// split as npm splits them, at each carriage return too, after a leading byte-order mark; only spaces and tabs stand
// beside a setting, so no line npm reads otherwise than these patterns do is taken.
export function npmrcOthers(text) {
  return String(text ?? "").replace(/^\uFEFF/u, "").split(/[\r\n]+/u)
    .filter(l => !/^[ \t]*(?:[#;].*)?$/u.test(l) && !/^[ \t]*(?:ignore-scripts[ \t]*=[ \t]*true|min-release-age[ \t]*=[ \t]*\d+)[ \t]*$/u.test(l));
}

// What the core's package list and lock file may hold, read before npm runs (install.mjs) and by the core's own test:
// the package list its own fields alone; each lock entry a folder of node_modules/ named in npm's name characters,
// fetched from npm's registry at an address in its one plain form and held to its sha512, with no field but those a
// package fetched from the registry carries, and none of those npm would act on that the core's lock never writes
// (ACTED); and every dependency spec a version, range or tag of npm's registry,
// never one that names git, a web address, a file, a folder or a tarball, which the npm that comes with the least Node
// would fetch, and run its prepare script, whatever setting says otherwise (#654). Each fault as a line; none, [].
export const ENTRY_FIELDS = new Set(["version", "resolved", "integrity", "license", "dev", "peer", "engines", "bin", "funding",
  "dependencies", "optionalDependencies", "peerDependencies", "peerDependenciesMeta", "deprecated", "hasInstallScript"]);
const ACTED = new Set(["optional", "devOptional", "os", "cpu", "libc"]);
const LIST_FIELDS = ["name", "private", "description", "license", "dependencies", "devDependencies"];
const SPEC_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
// (a range or tag of the registry: no ".tgz" or ".tar" anywhere, which some npm reads as a file however it ends)
const registrySpec = v => typeof v === "string" && /^[\w.^~<>=|*+ -]*$/u.test(v) && !/^\./u.test(v) && !/\.t(?:gz|ar)/iu.test(v);
const KEY = /^(?:node_modules\/(?:@[\w~-][\w.~-]*\/)?[\w~-][\w.~-]*\/)*node_modules\/(?:@[\w~-][\w.~-]*\/)?[\w~-][\w.~-]*$/u;
const plainAddress = r => { try { return /^https:\/\/registry\.npmjs\.org\//u.test(r) && new URL(r).href === r; } catch { return false; } };
export function lockFaults(list, lock) {
  const out = [], specs = (where, o) => { for (const [n, v] of Object.entries(o ?? {})) if (!registrySpec(v)) out.push(`${where}: the spec ${JSON.stringify(n)}: ${JSON.stringify(v)} names no version, range or tag of npm's registry`); };
  if (!plainObject(list)) return ["package.json: not an object of fields"];
  if (!plainObject(lock)) return ["package-lock.json: not an object of fields"];
  for (const k of Object.keys(list ?? {})) if (!LIST_FIELDS.includes(k)) out.push(`package.json: the field ${JSON.stringify(k)}, which the core's package list does not hold`);
  for (const f of SPEC_FIELDS) specs(`package.json ${f}`, list?.[f]);
  // (the package list's own packages at one exact version each: floor rule 7)
  for (const f of ["dependencies", "devDependencies"]) for (const [n, v] of Object.entries(list?.[f] ?? {})) if (!/^\d+\.\d+\.\d+$/u.test(String(v))) out.push(`package.json ${f}: ${JSON.stringify(n)} at ${JSON.stringify(v)}, not one exact version`);
  out.push(...formFaults(lock));
  for (const [k, e] of Object.entries(lock?.packages ?? {})) out.push(...(k ? entryFaults(k, e ?? {}, specs) : rootFaults(e, list)));
  return out;
}

const plainObject = v => v !== null && typeof v === "object" && !Array.isArray(v);

// The lock's root entry: the package list's own name, version, licence and packages, nothing else, since npm reads it
// where it cannot read the package list.
function rootFaults(e, list) {
  if (!plainObject(e)) return ["package-lock.json \"\": not an object of fields"];
  const odd = Object.keys(e).filter(f => !["name", "version", "license", "dependencies", "devDependencies"].includes(f));
  // (as sorted pairs of name and version, since npm writes the root entry's packages sorted, whatever order the list holds)
  const pairs = o => JSON.stringify(Object.entries(o ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const differ = ["dependencies", "devDependencies"].filter(f => pairs(e[f]) !== pairs(list[f]));
  return [...(odd.length ? [`package-lock.json "": the field${odd.length === 1 ? "" : "s"} ${odd.join(", ")}, which the package list does not hold`] : []),
    ...differ.map(f => `package-lock.json "": its ${f} not the package list's`)];
}

// The lock file's own form: npm's version 3, its entries under "packages" alone, since an older form's "dependencies"
// npm would read in their place.
function formFaults(lock) {
  const out = [], top = Object.keys(lock ?? {}).filter(k => !["name", "version", "lockfileVersion", "requires", "packages"].includes(k));
  if (lock?.lockfileVersion !== 3) out.push("package-lock.json: not npm's own form, version 3");
  if (top.length) out.push(`package-lock.json: the field${top.length === 1 ? "" : "s"} ${top.join(", ")}, which npm's own form, version 3, does not hold`);
  if (!lock?.packages || typeof lock.packages !== "object" || Array.isArray(lock.packages)) out.push("package-lock.json: no \"packages\" of npm's own form");
  return out;
}

// One lock entry's fields that no package fetched from the registry carries, and those npm would act on that the core's
// lock never writes, each as a fault.
function fieldFaults(k, e) {
  const odd = Object.keys(e).filter(f => !ENTRY_FIELDS.has(f) && !ACTED.has(f)), acted = Object.keys(e).filter(f => ACTED.has(f));
  const said = (fields, why) => (fields.length ? [`package-lock.json ${k}: the field${fields.length === 1 ? "" : "s"} ${fields.join(", ")}, ${why}`] : []);
  return [...said(odd, "which no package fetched from the registry carries"), ...said(acted, "which npm would act on and the core's lock never writes")];
}

// One lock entry's faults, its specs' through `specs(where, fields)`.
function entryFaults(k, e, specs) {
  const out = fieldFaults(k, e);
  if (!KEY.test(k)) out.push(`package-lock.json ${JSON.stringify(k)}: a key that names no folder of node_modules/`);
  // (the folder, the version and the address bound together: the address is exactly the registry's tarball of the
  // package the folder names, at the entry's version, so no part of an entry is free for npm to read otherwise)
  const name = k.slice(k.lastIndexOf("node_modules/") + "node_modules/".length), base = name.slice(name.indexOf("/") + 1);
  const named = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/u.test(name) && !/\.t(?:gz|ar)/iu.test(name);
  const version = typeof e.version === "string" && /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/u.test(e.version) ? e.version : null;
  if (!named || !version || e.resolved !== `https://registry.npmjs.org/${name}/-/${base}-${version}.tgz` || !plainAddress(e.resolved) || !/^sha512-/u.test(e.integrity ?? "")) {
    out.push(`package-lock.json ${k}: not npm's registry tarball of ${named ? name : "a package named as npm names one"} at ${version ?? "one exact version"}, held to its sha512`);
  }
  for (const f of SPEC_FIELDS) specs(`package-lock.json ${k} ${f}`, e[f]);
  return out;
}

// Whether the package could not be installed because the registry did not answer, in a project's pull request
// (install.mjs): a script that reads it checks this first and says that part did not run, as a warning, keeping every
// failure it found without the package (#654, point 4).
export function unreached(name) {
  return process.env.CORE_PACKAGES_UNREACHED === "1" && !installed(name);
}

// The package's entry file; where it is not installed, the failure, which never passes: in a job of a workflow, the
// mend is the install step the job lacks, in a pull request of its own, so that a sync pull request stays pure.
function found(name) {
  const file = entry(name);
  if (!file) {
    const install = path.relative(process.cwd(), path.join(root, "scripts", "install.mjs"));
    const at = path.relative(process.cwd(), path.join(packages, "node_modules"));
    const mend = process.env.GITHUB_ACTIONS === "true"
      ? `in a pull request of its own, never a sync pull request, add the step if [ -f ${install} ]; then node ${install}; fi to this job before the step that runs this check, then run the job again; where the job has such a step, run the job again`
      : `run node ${install}, which installs the core's packages from its lock file, then run the check again`;
    console.error(`FAIL: the check did not run: the package ${name} is not installed in ${at} as .packages/package-lock.json names it. Mend: ${mend}`);
    process.exit(1);
  }
  return file;
}
