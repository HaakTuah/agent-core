// The NuGet check (floor rules 7 and 10, in floor/topics.md beside this folder), for a project whose packages come
// from NuGet (.NET): every package its lock files install, the ones packages pull in included, is one exact version
// and under a licence on its list. It reads two things, both NuGet's own: the project's lock files
// (packages.lock.json, which a project writes once it sets RestorePackagesWithLockFile), and each installed package's
// own manifest (its .nuspec) in the folder a restore from those lock files filled, so a package's licence is read
// from the package NuGet checked, never from a second place. It holds:
//   - that every project file git knows (.csproj, .fsproj, .vbproj) has its lock file beside it, and that every lock
//     file is named in the config as one whose packages ship or as one of tools that only run, so no project's
//     packages go unread; the older packages.config, which has no lock, fails;
//   - floor rule 7's "one exact version, never a range": what a project asks for is, letter for letter, the version
//     its lock installs (NuGet writes a plain Version="1.2.3" as "[1.2.3, )", which with a lock file is that version);
//   - floor rule 10: a package whose manifest names its licence as an SPDX expression is held to its list by that
//     (what ships to the floor's, a tool that only runs to the tools': policy, in licences.mjs). One whose manifest
//     names a licence file, an address or nothing has no licence a machine can read: it passes only with an entry in
//     the project's audit named <Id>@<version>, the licence read by hand, which the licence check then holds to its
//     list like any entry. A new version needs a new entry, so a licence that changes with a version is read again.
//   - "one the owner wants anyway waits for the owner's yes" (floor rule 10): a package off its list passes only where
//     the config's "accepted" names that exact version with what it is under and the owner's words for it, and, where
//     it ships, its notice; never one under terms the floor never allows. It is named there alone: an audit entry for
//     it too would be held to the list by the licence check, so the two together fail here. An accepted version no
//     lock installs any more fails, so the list only shrinks by itself.
// What it does not hold: that the lock files are what a restore gives today (the workflow that runs this,
// .github/workflows/nuget.yml, restores with --locked-mode first, which fails where they are not: floor rule 15);
// whether the owner said what "accepted" quotes, which the reviews hold, the config being a protected file; and what
// no lock file names (a tool a script installs, a font, an image), which the licence check's audit and scan hold.
// A manifest is read as the XML it is, by its one licence element under its metadata; anything it cannot read so
// (a document type, a manifest that is not well formed, two such elements, an expression with a comment, CDATA or an
// entity inside it) counts as no readable licence. Node's own
// modules only, and no network: the restore brought the manifests. It checks the project it lies in (core/scripts/
// there), whatever the directory it is started from; the config's own path is read from that directory.
//
//   node core/scripts/nuget.mjs <config> --packages <the folder the restore filled> [--advisory]
//
// The config is the licence check's (licences.mjs), with one key more, "nuget": { "ships": the lock files whose
// packages ship, "tools": those of projects that only run (tests, tools), "accepted": [{ "package": "<Id>@<version>",
// "licence": what it is under, "yes": the owner's words and their date, "notice": its notice, where it ships }] }. With --advisory it says what it would
// fail and passes, for a project's first weeks with it.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { NEVER, licenceOk, loadConfig, policy } from "./licences.mjs";
import { started } from "./started.mjs";

const PROJECT = /\.(?:cs|fs|vb)proj$/iu;
const LOCK = "packages.lock.json";
const ID = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/u; // a package's id, as NuGet takes one
const VERSION = /^[0-9][0-9A-Za-z.+-]{0,99}$/u; // a version as a lock file writes one
const key = (id, version) => `${id}@${version}`.toLowerCase();
const CUT = "\u0000"; // stands where a comment, CDATA or a processing instruction was cut from a manifest: no XML holds it

/** The config's "nuget", checked: { ships, tools, accepted }. A key or a shape it does not know would check less. */
export function nugetConfig(config) {
  const nuget = config?.nuget;
  if (!nuget || typeof nuget !== "object" || Array.isArray(nuget)) throw new Error('the config has no "nuget": { "ships": [...], "tools": [...] }');
  const odd = Object.keys(nuget).filter((k) => !["ships", "tools", "accepted"].includes(k));
  if (odd.length) throw new Error(`the config's "nuget" holds keys it does not know: ${odd.join(", ")}`);
  const paths = (name) => {
    const v = nuget[name] ?? [];
    const ok = (p) => typeof p === "string" && posix.normalize(p) === p && posix.basename(p) === LOCK && !p.startsWith("/") && !p.startsWith("../");
    if (!Array.isArray(v) || !v.every(ok)) throw new Error(`the config's "nuget.${name}" is not a list of ${LOCK} files in the project, each written as git lists it`);
    return v;
  };
  const ships = paths("ships"), tools = paths("tools");
  const twice = ships.filter((p) => tools.includes(p)).concat(ships.filter((p, i) => ships.indexOf(p) !== i), tools.filter((p, i) => tools.indexOf(p) !== i));
  if (twice.length) throw new Error(`the config's "nuget" names a lock file twice: ${[...new Set(twice)].join(", ")}`);
  const accepted = nuget.accepted ?? [];
  const whole = (a) => a && typeof a === "object" && !Array.isArray(a) && Object.keys(a).every((k) => ["package", "licence", "yes", "notice"].includes(k))
    && [a.package, a.licence, a.yes].every((s) => typeof s === "string" && s.trim()) && /^[^@\s]+@[^@\s]+$/u.test(a.package) && (a.notice === undefined || typeof a.notice === "string");
  if (!Array.isArray(accepted) || !accepted.every(whole)) throw new Error('the config\'s "nuget.accepted" is not a list of { "package": "<Id>@<version>", "licence": ..., "yes": ..., and "notice" where it ships }');
  return { ships, tools, accepted };
}

/**
 * The packages one lock file installs, as { id, version }, and what is wrong with it as lines. A project's own
 * projects (type "Project") are no packages. What a project asks for itself must be the version installed.
 */
export function lockPackages(text, lockPath) {
  const failures = [], packages = new Map();
  let lock;
  try { lock = JSON.parse(text); } catch { return { packages: [], failures: [`${lockPath} is not JSON`] }; }
  if (![1, 2].includes(lock?.version) || !lock.dependencies || typeof lock.dependencies !== "object" || Array.isArray(lock.dependencies)) {
    return { packages: [], failures: [`${lockPath} is no lock file this check knows (NuGet's version 1 or 2, with "dependencies")`] };
  }
  for (const [framework, entries] of Object.entries(lock.dependencies)) {
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) { failures.push(`${lockPath}, ${framework}: not a list of packages`); continue; }
    for (const [id, entry] of Object.entries(entries)) {
      const at = `${lockPath}, ${framework}: ${id}`;
      if (entry?.type === "Project") continue;
      if (!["Direct", "Transitive", "CentralTransitive"].includes(entry?.type)) { failures.push(`${at}: a kind of entry this check does not know (${JSON.stringify(entry?.type)})`); continue; }
      const { resolved, requested, contentHash } = entry;
      if (!ID.test(id) || typeof resolved !== "string" || !VERSION.test(resolved)) { failures.push(`${at}: no package id and installed version it can read`); continue; }
      if (typeof contentHash !== "string" || !contentHash) failures.push(`${at}: no content hash, so a restore cannot hold it to the package it was (floor rule 15)`);
      if (entry.type !== "Transitive" && ![`[${resolved}, )`, `[${resolved}]`, `[${resolved}, ${resolved}]`].includes(requested)) {
        failures.push(`${at}: the project asks for ${typeof requested === "string" ? requested : "no version it can read"} and the lock installs ${resolved}: ask for one exact version, the one installed (floor rule 7)`);
      }
      packages.set(key(id, resolved), { id, version: resolved });
    }
  }
  return { packages: [...packages.values()], failures };
}

/**
 * The licence a package's manifest (its .nuspec, as text) names: { expression } for an SPDX expression, { other }
 * (a word for what it has instead: "a licence file", "an address", "nothing") where a machine cannot read one.
 * Read as XML: comments, CDATA and processing instructions are no elements, and the licence is the one `license`
 * element directly under `metadata` under `package`. A document type, a manifest that is not well formed, or two such
 * elements give no licence it will trust; nor does an expression with any of those cut-out parts inside it, since
 * CDATA there is part of the expression a reader of XML sees, and this one would see less.
 */
export function manifestLicence(text) {
  if (typeof text !== "string" || /<!DOCTYPE|<!ENTITY/iu.test(text)) return { other: "a manifest it will not read" };
  // (what is no element is cut out first, each from its opening to its own end, in the order they stand, and a mark
  // no manifest can hold is left where each stood)
  if (text.includes(CUT)) return { other: "a manifest it will not read" };
  let plain = "", at = 0;
  const ends = { "<!--": "-->", "<![CDATA[": "]]>", "<?": "?>" };
  for (;;) {
    const found = Object.keys(ends).map((open) => [text.indexOf(open, at), open]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0])[0];
    if (!found) { plain += text.slice(at); break; }
    const end = text.indexOf(ends[found[1]], found[0] + found[1].length);
    if (end < 0) return { other: "a manifest that is not well formed" };
    plain += `${text.slice(at, found[0])}${CUT}`;
    at = end + ends[found[1]].length;
  }
  const stack = [], licences = [];
  let url = false, last = 0, open = null;
  const tags = /<(\/?)([A-Za-z_][\w.:-]*)((?:"[^"]*"|'[^']*'|[^'"<>])*?)(\/?)>/gu;
  for (const tag of plain.matchAll(tags)) {
    if (plain.slice(last, tag.index).includes("<")) return { other: "a manifest that is not well formed" };
    const [, closing, name, attributes, empty] = tag;
    const inMetadata = stack.length === 2 && stack[0] === "package" && stack[1] === "metadata";
    if (closing) {
      if (stack.pop() !== name) return { other: "a manifest that is not well formed" };
      if (open && stack.length === 2) { licences.push({ attributes: open.attributes, body: plain.slice(open.from, tag.index) }); open = null; }
    } else {
      if (inMetadata && name === "license") { if (empty) licences.push({ attributes, body: "" }); else open = { attributes, from: tag.index + tag[0].length }; }
      if (inMetadata && name === "licenseUrl") url = true;
      if (!empty) stack.push(name);
    }
    last = tag.index + tag[0].length;
  }
  if (stack.length || plain.slice(last).includes("<")) return { other: "a manifest that is not well formed" };
  if (licences.length > 1) return { other: "a manifest with two licences" };
  if (!licences.length) return { other: url ? "an address" : "nothing" };
  const type = /^\s+type\s*=\s*(?:"(expression|file)"|'(expression|file)')(?:\s+version\s*=\s*(?:"[^"]*"|'[^']*'))?\s*$/u.exec(licences[0].attributes);
  const kind = type?.[1] ?? type?.[2];
  if (kind === "file") return { other: "a licence file" };
  const expression = licences[0].body.trim();
  if (kind !== "expression" || !expression || /[<&]/u.test(expression) || expression.includes(CUT)) return { other: "a licence it cannot read" };
  return { expression };
}

/** The check, on the project at `root`, whose tracked files are `tracked`, with the restore's folder: { failures, summary }. */
export function check(config, root, packagesDir, tracked) {
  const { ships, tools, accepted } = nugetConfig(config);
  const { allowedFor } = policy(config);
  const failures = [];
  const own = tracked.filter((f) => !f.startsWith("core/"));
  const locks = new Set(own.filter((f) => posix.basename(f) === LOCK));
  for (const f of own.filter((f) => PROJECT.test(f))) {
    if (!locks.has(posix.join(posix.dirname(f), LOCK))) failures.push(`${f} has no ${LOCK} beside it that git knows: set RestorePackagesWithLockFile, restore, and commit the lock file (floor rule 15)`);
  }
  for (const f of own.filter((f) => posix.basename(f).toLowerCase() === "packages.config")) failures.push(`${f}: packages.config has no lock file this check can read: move the project to PackageReference`);
  const listed = [...ships, ...tools];
  for (const f of locks) if (!listed.includes(f)) failures.push(`${f} is named in neither "nuget.ships" nor "nuget.tools" of the config: say whether its packages ship`);
  for (const f of listed) if (!locks.has(f)) failures.push(`the config's "nuget" names ${f}, which is no lock file git knows`);

  const packages = new Map(); // by id@version, lower case: { id, version, shipped, lock }
  for (const f of listed.filter((l) => locks.has(l))) {
    const read = lockPackages(readFileSync(join(root, f), "utf8"), f);
    failures.push(...read.failures);
    for (const p of read.packages) {
      const k = key(p.id, p.version), shipped = ships.includes(f);
      if (!packages.has(k) || (shipped && !packages.get(k).shipped)) packages.set(k, { ...p, shipped, lock: f });
    }
  }
  let entries = [];
  if (config.audit) {
    entries = JSON.parse(readFileSync(join(root, config.audit), "utf8")).entries;
    if (!Array.isArray(entries)) throw new Error(`${config.audit} has no "entries" list`);
  }
  const audited = new Map(entries.filter((e) => e && typeof e.name === "string").map((e) => [e.name.toLowerCase(), e]));
  const yes = new Map(accepted.map((a) => [a.package.toLowerCase(), a]));
  const used = new Set();
  for (const [k, p] of packages) {
    const name = `${p.id}@${p.version}`, list = p.shipped ? "the list for what ships" : "the tools' list";
    const manifest = join(packagesDir ?? "", p.id.toLowerCase(), p.version.toLowerCase(), `${p.id.toLowerCase()}.nuspec`);
    if (!packagesDir || !existsSync(manifest)) { failures.push(`${name} (${p.lock}): its manifest is not in the restore's folder, so its licence cannot be read: restore from the lock files first (dotnet restore --locked-mode)`); continue; }
    const licence = manifestLicence(readFileSync(manifest, "utf8"));
    let why, byHand = false;
    if (licence.expression !== undefined) {
      if (licenceOk(licence.expression, allowedFor(p.id, p.shipped))) continue;
      why = `${licence.expression} is off ${list}`;
    } else {
      const entry = audited.get(k);
      if (!entry) byHand = true;
      if (!entry) why = `its manifest names ${licence.other}, no licence a machine can read: read it by hand and record it in ${config.audit ?? "the audit"} as "${name}"`;
      else if (p.shipped && entry.ships !== true) why = `its entry in ${config.audit} does not say it ships ("ships": true), and ${p.lock} is a lock file of what ships`;
      else if (licenceOk(entry.licence, allowedFor(p.id, p.shipped))) continue;
      else why = `${entry.licence}, as ${config.audit} records it, is off ${list}`;
    }
    const a = yes.get(k);
    if (a) {
      used.add(k);
      if (NEVER.test(a.licence)) failures.push(`${name}: accepted under ${a.licence}, terms floor rule 10 never allows`);
      if (audited.has(k)) failures.push(`${name}: named in "nuget.accepted" and in ${config.audit} both: an accepted package stands in "nuget.accepted" alone, since the licence check holds every audit entry to its list`);
      if (p.shipped && !a.notice?.trim()) failures.push(`${name}: it ships, so its notice ships too (floor rule 10): its "notice" in "nuget.accepted"`);
      continue;
    }
    failures.push(`${name} (${p.lock}): ${why}${byHand ? "" : `; one the owner wants anyway is named in the config's "nuget.accepted", with the owner's words (floor rule 10)`}`);
  }
  for (const a of accepted) if (!used.has(a.package.toLowerCase())) failures.push(`"nuget.accepted" names ${a.package}, which no lock file installs off its list: remove it`);
  const all = [...packages.values()], shipped = all.filter((p) => p.shipped).length;
  const summary = `${all.length} NuGet packages in ${listed.length} lock files checked (${shipped} in what ships, ${all.length - shipped} tools that only run), ` +
    `${used.size} accepted on the owner's yes; ${failures.length} failing (floor rules 7 and 10)`;
  return { failures, summary };
}

if (started(import.meta.url)) {
  const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };
  const args = process.argv.slice(2), advisory = args.includes("--advisory");
  const at = args.indexOf("--packages"), packagesDir = at >= 0 ? args[at + 1] : undefined;
  const configPath = args.find((a, i) => !a.startsWith("--") && i !== at + 1);
  if (!configPath || !packagesDir) fail("name the config and the restore's folder: node core/scripts/nuget.mjs <config> --packages <folder> [--advisory]");
  let result;
  try {
    const config = loadConfig(configPath);
    const here = fileURLToPath(new URL(".", import.meta.url));
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: here, encoding: "utf8" }).trim();
    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
    result = check(config, root, packagesDir, tracked);
  } catch (e) { fail(e.message); }
  for (const f of result.failures) console.error(`${advisory ? "WOULD FAIL" : "FAIL"}: ${f}`);
  console.log(result.summary + (advisory && result.failures.length ? ". Advisory: nothing fails for it yet." : ""));
  process.exit(result.failures.length && !advisory ? 1 : 0);
}
