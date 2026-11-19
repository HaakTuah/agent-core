// A package of another publisher, as the core installs it (#654): from the node_modules/ of the core's own install whose
// package list names it (INSTALLS: .packages/, or the parser's .packages/parser/, #719) alone, never a project's own
// install of the same name at another version, and only where what is installed there is what its lock file names,
// each entry by its version, address and integrity (npm's own record of the install, node_modules/.package-lock.json,
// read against the lock file beside it, the package's own entry too; never one the lock flags dev, which only the core's
// own tests run, reading it themselves), so a folder an earlier install
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
// The core's installs, each by the name install.mjs knows it by, and its folder below the core, which holds its own
// package list, lock file, .npmrc and install: the first in every job, the parser's only where a job names it (#719).
export const INSTALLS = { npm: ".packages", parser: ".packages/parser" };

const FIRST = Object.keys(INSTALLS)[0];
// For a copy of .packages/ made by a test that reads no C#: false for the parser's own node_modules/, some 70 MB it would
// copy for nothing, true for every other path (fs.cpSync's filter; #719).
export const parserLeftOut = src => !path.resolve(src).endsWith(path.join(path.normalize(INSTALLS.parser), "node_modules"));

// What to hand the installer of a copy of the core at `copy` (a folder holding scripts/install.mjs) so that it installs
// every one of its installs, as the sync and the starter kit run it: `all`, where the copy holds the parser's package
// list, which came with that word (#719); nothing, for an older copy's installer, which knows no word but its first.
export function everyInstall(copy) {
  return fs.existsSync(path.join(copy, INSTALLS.parser, "package.json")) ? ["all"] : [];
}
// The install whose package list names `name`, or null where none does: a package no list names is loaded from no
// install, whatever a folder holds (#719); and, of each, its folder and how a package is found from there.
const lists = {};
const listOf = install => (lists[install] ??= (() => { try { return JSON.parse(fs.readFileSync(path.join(root, INSTALLS[install], "package.json"), "utf8")); } catch { return {}; } })());
function installOf(name) {
  for (const install of Object.keys(INSTALLS)) {
    const list = listOf(install);
    if (Object.hasOwn(list.dependencies ?? {}, name) || Object.hasOwn(list.devDependencies ?? {}, name)) return install;
  }
  return null;
}
const dirOf = install => path.join(root, INSTALLS[install]);
const needs = {};
const need = install => (needs[install] ??= createRequire(path.join(dirOf(install), "package.json")));

// The package's module, imported from the core's own .packages/node_modules/; where it is not there, a failure that says the mend.
export async function load(name) {
  return import(pathToFileURL(found(name)).href);
}

// The same, required at once: a package whose entry is CommonJS, loaded where a function first uses it.
export function loadSync(name) {
  const file = found(name);
  return need(installOf(name))(file);
}

// Whether the package is installed in the core's own install that names it, for what reads it and must not stop where it
// is not (steps.mjs, which never fails over one step).
export function installed(name) {
  return entry(name) !== null;
}

// An install's lock file and npm's record of what it installed: { wanted, had }, each its entries, or null.
const records = {};
function recordOf(install) {
  const read = f => { try { return JSON.parse(fs.readFileSync(path.join(dirOf(install), f), "utf8")).packages ?? {}; } catch { return null; } };
  return (records[install] ??= { wanted: read("package-lock.json"), had: read("node_modules/.package-lock.json") });
}
// Whether the entry `k` stands in npm's record as the lock file names it: the same version, address and integrity.
const same = ({ wanted, had }, k) => Boolean(wanted?.[k] && had?.[k]) && ["version", "resolved", "integrity"].every(f => wanted[k][f] === had[k][f]);

// Whether an install's node_modules/ holds what its lock file names: each entry of the lock file in npm's record of the
// install, at the same version, from the same address, with the same integrity; all but those only the core's tests run,
// which no script loads and a copy does not install. And each package the package list names has its entry in the
// lock, so an install never reads as current where the lock names fewer packages than the list beside it (#719).
const current = {};
function matches(install) {
  if (current[install] === undefined) {
    const rec = recordOf(install), named = Object.keys(listOf(install).dependencies ?? {});
    current[install] = Boolean(rec.wanted && rec.had) && named.every(n => rec.wanted[`node_modules/${n}`]) && Object.keys(rec.wanted).filter(k => k && !rec.wanted[k].dev).every(k => same(rec, k));
  }
  return current[install];
}

// The package's entry file, in the node_modules/ of the core's own install that names it alone, as its lock file names
// it, or null.
function entry(name) {
  const install = installOf(name);
  // (the package's own entry too, so a folder an earlier install left is never taken for it; and never one the lock flags
  // dev, which only the core's own tests run, reading it themselves: no script loads one, nor what it brings; #719)
  const k = `node_modules/${name}`;
  if (!install || !matches(install) || recordOf(install).wanted?.[k]?.dev || !same(recordOf(install), k)) return null;
  try {
    const own = fs.realpathSync(path.join(dirOf(install), "node_modules")) + path.sep;
    const at = need(install).resolve(name);
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
// package fetched from the registry carries, and none of those that make npm skip an entry or install it only on
// some platforms, which the core's lock never writes (ACTED); and every dependency spec a version, range or tag of
// npm's registry, never one that names git, a web address, a file, a folder or a tarball, which the npm that comes with the least Node
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
  // (npm writes the root entry "" in every lock of its own form: one without it would hold the package list to nothing)
  else if (!Object.hasOwn(lock.packages, "")) out.push("package-lock.json: no root entry \"\" of npm's own form, which holds the package list's packages");
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
// (install.mjs), or unnamed(): a script that reads it checks this first and says that part did not run, as a warning,
// keeping every failure it found without the package (#654, point 4).
export function unreached(name) {
  return !installed(name) && (process.env.CORE_PACKAGES_UNREACHED === "1" || unnamed(name));
}
// Whether, in a copy, the job installed the core's first install but never the one whose list names the package (npm's
// record of it absent): a job of the project's own written before that install came, which no change of the pull
// request's made so, said as a warning with the mend, never failed (#719; "Nothing locks a project"). In the core, which
// holds its tests, every job names what it runs, and a package not there fails.
const own = fs.existsSync(path.join(root, "tests"));
export function unnamed(name) {
  const install = installOf(name);
  return !own && install !== null && install !== FIRST && !installed(name) && matches(FIRST) && recordOf(install).had === null;
}

// The failure where no package list of the core's names the package: no install puts it there, so the mend is the core's
// copy taken back as the core holds it, or, in the core, the package added to a list and its lock (#254, #719).
function unlisted(name) {
  const lists = Object.values(INSTALLS).map(f => `${f}/package.json`).join(", ");
  console.error(`FAIL: the check did not run: the package ${name} is not installed: no package list of the core's names it (${lists}). Mend: in a project, take the core's copy back as the core holds it (node core/scripts/sync.mjs); in the core, add the package to the package list and lock file the script's install reads (${lists}), as npm's own install there writes them, then run node scripts/install.mjs and the check again`);
  process.exit(1);
}

// The package's entry file; where it is not installed, the failure, which never passes: in a job of a workflow, the
// mend is the install step the job lacks, in a pull request of its own, so that a sync pull request stays pure.
function found(name) {
  const file = entry(name);
  if (!file && !installOf(name)) unlisted(name);
  if (!file) {
    console.error(`FAIL: ${missing(installOf(name), name)}`);
    process.exit(1);
  }
  return file;
}

// The words where the package `name` of the install `which` is not installed as its lock names it, with the mend: in a
// job of a workflow, the install step the job lacks or must name; elsewhere, the install to run (#254, #719).
function missing(which, name, rel) {
  const named = which === FIRST ? "" : ` ${which}`;
  const install = path.relative(process.cwd(), path.join(root, "scripts", "install.mjs"));
  const at = path.relative(process.cwd(), path.join(dirOf(which), "node_modules"));
  const mend = process.env.GITHUB_ACTIONS === "true"
    ? `in a pull request of its own, never a sync pull request, add the step if [ -f ${install} ]; then node ${install}${named}; fi to this job before the step that runs this check, then run the job again; where the job has such a step${named ? `, name${named} in it` : ""}, run the job again`
    : `run node ${install}${named}, which installs the core's packages from its lock file, then run the check again`;
  return `the check did not run: the package ${name} is not installed in ${at} as ${INSTALLS[which]}/package-lock.json names it${rel ? ` (${rel})` : ""}. Mend: ${mend}`;
}

// The file `rel` of the package `name`, inside that package's own folder in the core's install that names it, and only
// where the package itself is installed as its lock names it (entry()), for a file that is no module (a WebAssembly file,
// a build of the module's own); where it is not there, the failure's words with its mend, thrown and never an exit, so
// that a worker thread that asks tells its caller (#529, #719).
export function installedFile(name, rel) {
  const which = installOf(name) ?? FIRST, own = path.join(dirOf(which), "node_modules"), dir = path.join(own, name), file = path.join(dir, rel);
  // (the package's folder inside its install's node_modules/, and the file inside that folder, each by its real path)
  const inside = (f, d) => fs.realpathSync(f).startsWith(fs.realpathSync(d) + path.sep);
  try { if (entry(name) && inside(dir, own) && inside(file, dir)) return file; } catch { /* said below */ }
  throw new Error(missing(which, name, rel));
}
