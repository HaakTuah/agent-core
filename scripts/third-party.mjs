#!/usr/bin/env node
// The packages of other publishers the core's scripts run, carried in the copy (#528; CHOICES.md, "The second judgment,
// the path", step 3). Each lies in third-party/<its name>/, files of its registry's tarball taken byte for byte, and the
// folder travels in every project's copy with the rest of the core, so a project installs nothing and fetches nothing
// while a check runs. The folder holds besides:
//   - list.json: each package's name, its one exact version, the registry's sha512 of its tarball ("integrity"), the
//     date the registry gives that version ("published") and the day it was taken, a week after at least (floor rule
//     7), its licence as the package names it, on floor rule 10's list for what ships ("licence"), the tarball's paths
//     it carries, a folder's ending "/" and taken whole ("files"), the digest of what it carries (`digest`, below), and
//     the scripts that read it ("used");
//   - NOTICES.md: each package's name, version and licence, and its copyright lines, its licence's text in its folder;
//   - package.json: `"type": "commonjs"` alone, so Node reads the packages' .js files as the publisher built them,
//     whatever the package.json of the project around the copy says;
//   - .gitignore: `!*`, so no pattern of a project's own (dist/, build/, *.js) keeps a carried file out of the commit
//     that syncs the copy, which core.yml would find differing from the core.
// The checks that read a project's files by its own patterns leave the folder out: the copies check, and the package
// check's look for a changed package list (checks.mjs); the licence scan, the reading-size check and the starter kit's
// shape config leave the whole copy out, and the core's own licence audit covers the folder.
//
// Without an option it reads the folder offline and fails what is wrong with its mend; --verify asks npm's registry, as
// a pull request that adds or updates a package must: the version's integrity and date, its signature by the
// registry's key, the lookup of floor rule 15 (lookup.mjs), and the tarball itself, fetched by its address, held to the
// integrity and unpacked by tar, each carried file the same as the tarball's. To add or update a package: `npm pack
// --ignore-scripts <name>@<version>` (its sha512 is the integrity), unpack it, copy the paths, write the entry and its
// notice, then run this, which names the digest to write, and --verify. Run by third-party-test.mjs. Node's own
// modules, and tar for --verify.
//
//   node scripts/third-party.mjs [--verify]
import { execFileSync } from "node:child_process";
import { createHash, verify as verified } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { THIRD_PARTY } from "./core-path.mjs";
import { exact } from "./exact-versions.mjs";
import { logged, parseBounded } from "./guards.mjs";
import { floorList, licenceOk } from "./licences.mjs";
import { fetched, lookUp } from "./lookup.mjs";
import { started } from "./started.mjs";

const NPM = "https://registry.npmjs.org/", WEEK = 7 * 86400000;
const NAME = /^[a-z0-9][a-z0-9._-]{0,100}$/u, SHA512 = /^sha512-[A-Za-z0-9+/]{86}==$/u, DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/u;
const LICENCE_FILE = /^(?:licen[cs]e|copying)(?:\.[a-z]+)?$/iu;
const KEYS = ["name", "version", "integrity", "published", "taken", "licence", "files", "digest", "used"];
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The files of a package's folder `dir`, each by its path inside it ("/"-joined), sorted; a link or anything but a file
 *  is named in `odd`. */
export function filesIn(dir) {
  const files = [], odd = [];
  const walk = (at) => {
    for (const e of fs.readdirSync(path.join(dir, at), { withFileTypes: true })) {
      const rel = at ? `${at}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel); else if (e.isFile()) files.push(rel); else odd.push(rel);
    }
  };
  walk("");
  return { files: files.sort(), odd };
}

/** The digest of a package's folder: sha256 over each file's path, a NUL and its own sha256, a line each, in order. */
export function digestOf(dir, files) {
  const all = createHash("sha256");
  for (const f of files) all.update(`${f}\0${createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex")}\n`);
  return `sha256-${all.digest("hex")}`;
}

// Whether a carried path is one an entry's "files" names: the path itself, or under a folder it names.
const named = (entries, f) => entries.some(e => (e.endsWith("/") ? f.startsWith(e) : f === e));

// The text of a file, or `none` where it cannot be read.
const textOf = (file, none = null) => { try { return fs.readFileSync(file, "utf8"); } catch { return none; } };

/** What is wrong with the folder of third-party packages in the core at `root`, as of `now`: a line each, with its mend.
 *  Every entry is read, and every folder. */
export function faults(root = ROOT, now = Date.now()) {
  const at = path.join(root, THIRD_PARTY), out = [], fail = (what, mend) => out.push(`FAIL ${THIRD_PARTY}${what}. Mend: ${mend}`);
  let list;
  try { list = parseBounded(fs.readFileSync(path.join(at, "list.json"), "utf8")); } catch (e) {
    fail(`list.json cannot be read as JSON (${logged(String(e.message).slice(0, 120))})`, "write it as the core holds it: an object whose \"packages\" lists an entry for each package the folder holds");
    return out;
  }
  if (!Array.isArray(list?.packages)) { fail("list.json has no list \"packages\"", "give it one, an entry for each package the folder holds"); return out; }
  const notices = textOf(path.join(at, "NOTICES.md"));
  if (notices === null) fail("NOTICES.md is not there", "write it, a section for each package: its name, version and licence, and its copyright lines");
  const c = { root, at, now, fail, notices, floor: new Set(floorList().any), names: new Set() };
  for (const p of list.packages) entryFaults(c, p);
  folderFaults(c);
  return out;
}

// One entry of the list, and the files it names (faults, above).
function entryFaults(c, p) {
  const name = typeof p?.name === "string" && NAME.test(p.name) ? p.name : null;
  if (!name) return c.fail(`list.json: an entry whose "name" is no package name npm gives, without a scope (${logged(JSON.stringify(p?.name ?? null).slice(0, 80))})`, "name the package as its registry does, lower case");
  const where = `list.json: ${name}`, wrong = KEYS.filter(k => p[k] === undefined).concat(Object.keys(p).filter(k => !KEYS.includes(k)));
  if (c.names.has(name)) c.fail(`${where} is listed twice`, "keep one entry for it");
  c.names.add(name);
  if (wrong.length) c.fail(`${where} lacks or holds keys it should not: ${wrong.join(", ")}`, `give it exactly ${KEYS.join(", ")}`);
  if (!exact(p.version)) c.fail(`${where}: "version" is not one exact version`, "write the one version carried, as its tarball's package.json gives it");
  if (typeof p.integrity !== "string" || !SHA512.test(p.integrity)) c.fail(`${where}: "integrity" is no sha512 value`, "write the registry's sha512 of the tarball, its dist.integrity (sha512-...)");
  if (!licenceOk(p.licence, c.floor)) c.fail(`${where}: its licence ${logged(String(p.licence))} is not on floor rule 10's list for what ships`, "take another package, one under a licence the list names: the copy reaches every project");
  dateFaults(c, p, where);
  usedFaults(c, p, name, where);
  filesFaults(c, p, name, where);
}

// The version's date and the day it was taken, a week after at least and no later than today.
function dateFaults(c, p, where) {
  const published = typeof p.published === "string" && DATE.test(p.published) ? Date.parse(p.published) : NaN;
  const taken = typeof p.taken === "string" && /^\d{4}-\d\d-\d\d$/u.test(p.taken) ? Date.parse(`${p.taken}T23:59:59Z`) : NaN;
  if (Number.isNaN(published) || Number.isNaN(taken)) c.fail(`${where}: "published" or "taken" is no date`, "write \"published\" as the registry's time for the version (2026-01-31T12:00:00.000Z) and \"taken\" as the day the entry was written (2026-02-07)");
  else if (taken - published < WEEK || taken - 86400000 > c.now) c.fail(`${where}: taken ${p.taken}, under a week after the version was published (${p.published}), or later than today`, "wait until the version is a week old (floor rule 7), and write the day it is taken");
}

// Each script "used" names imports from the package's folder.
function usedFaults(c, p, name, where) {
  if (!Array.isArray(p.used) || !p.used.length) return c.fail(`${where}: "used" names no script`, "name each script that reads the package, from the core's root");
  for (const s of p.used) {
    const text = typeof s === "string" && /^scripts\/[\w.-]+\.mjs$/u.test(s) ? textOf(path.join(c.root, s)) : null;
    if (!text?.includes(`"../${THIRD_PARTY}${name}/`)) c.fail(`${where}: "used" names ${logged(String(s))}, which is no script of the core's that imports from ${THIRD_PARTY}${name}/`, "name only the scripts that import the package, and take the package out where none does");
  }
}

// The files carried, against "files" and "digest".
function filesFaults(c, p, name, where) {
  const entries = Array.isArray(p.files) && p.files.length && p.files.every(f => typeof f === "string" && /^[\w.-]+(?:\/[\w.-]+)*\/?$/u.test(f)) ? p.files : null;
  if (!entries) return c.fail(`${where}: "files" names no path of the tarball`, "list the paths carried, as they stand in the tarball without its package/ folder, a folder ending in /");
  let found;
  try { found = filesIn(path.join(c.at, name)); } catch { return c.fail(`${name}/ is not there`, `copy the package's files into ${THIRD_PARTY}${name}/, as list.json names them`); }
  if (found.odd.length) c.fail(`${name}/ holds what is no file: ${found.odd.slice(0, 5).map(logged).join(", ")}`, "carry the files alone, never a link");
  const stray = found.files.filter(f => !named(entries, f)), empty = entries.filter(e => !found.files.some(f => named([e], f)));
  if (stray.length || empty.length) c.fail(`${name}/ differs from "files": ${[...stray.slice(0, 5).map(f => `${logged(f)} not named`), ...empty.map(e => `${logged(e)} holds nothing`)].join(", ")}`, "carry exactly the paths \"files\" names");
  const digest = digestOf(path.join(c.at, name), found.files);
  if (p.digest !== digest) c.fail(`${where}: "digest" is not that of the files carried, ${digest}`, `where the files are the tarball's, as --verify proves, write ${digest}; else take the files back from the tarball`);
  noticeFaults(c, p, name, found.files.filter(f => LICENCE_FILE.test(f)));
}

// The package's licence file, and its section of NOTICES.md: the licence and each copyright line of that file.
function noticeFaults(c, p, name, licences) {
  if (!licences.length) return c.fail(`${name}/ carries no licence file`, "carry the package's own LICENSE, which its licence asks to travel with it");
  const copyright = licences.flatMap(f => (textOf(path.join(c.at, name, f), "")).split(/\r?\n/u).map(l => l.trim()).filter(l => /^copyright\b/iu.test(l)));
  const section = c.notices?.split(/^## /mu).find(s => s.startsWith(`${name} ${p.version}\n`)) ?? "";
  if (c.notices !== null && (!section.includes(String(p.licence)) || copyright.some(l => !section.includes(l)))) c.fail(`NOTICES.md has no section "## ${name} ${p.version}" naming ${logged(String(p.licence))} and the package's copyright lines`, `write the section: its heading, the licence, each copyright line of ${name}/'s licence file, and where its text is`);
}

// The folder itself: no folder the list leaves out, its package.json and its .gitignore.
function folderFaults(c) {
  for (const e of fs.readdirSync(c.at, { withFileTypes: true })) if (e.isDirectory() && !c.names.has(e.name)) c.fail(`${e.name}/ is in no entry of list.json`, "write its entry, or take the folder out");
  let boundary = null;
  try { boundary = JSON.parse(textOf(path.join(c.at, "package.json"), "null")); } catch { /* (said below) */ }
  if (boundary?.type !== "commonjs" || Object.keys(boundary).some(k => !["description", "private", "type"].includes(k))) c.fail("package.json does not say \"type\": \"commonjs\" alone", "write it as the core holds it, with its description, \"private\" and \"type\" alone: a project's package.json would otherwise decide how Node reads the packages");
  if (!/^!\*$/mu.test(textOf(path.join(c.at, ".gitignore"), ""))) c.fail(".gitignore holds no line !*", "write it as the core holds it: a project's own ignore patterns would keep carried files out of the commit that syncs the copy");
}

// ---- --verify: the registry asked

/** A file of the registry's, fetched by its address: { status, body } (a Buffer). */
async function bytes(url) {
  const r = await fetch(url, { headers: { "user-agent": "agent-core-third-party" }, signal: AbortSignal.timeout(60000) });
  return { status: r.status, body: r.status === 200 ? Buffer.from(await r.arrayBuffer()) : null };
}

/** What the registry says against the folder in `root`: { failures, reports }. `get(url)` gives JSON as lookup.mjs's
 *  fetched does, `getBytes(url)` a file; `now`, the lookup's day. */
export async function verify(root = ROOT, { get = fetched, getBytes = bytes, now = Date.now() } = {}) {
  const failures = [], reports = [], at = path.join(root, THIRD_PARTY);
  const fail = (what, mend) => failures.push(`FAIL ${THIRD_PARTY}list.json: ${what}. Mend: ${mend}`);
  const packages = parseBounded(fs.readFileSync(path.join(at, "list.json"), "utf8")).packages.filter(p => typeof p?.name === "string" && NAME.test(p.name) && exact(p.version));
  const keys = await get(`${NPM}-/npm/v1/keys`);
  const signing = keys.status === 200 && Array.isArray(keys.json?.keys) ? keys.json.keys : [];
  const looked = await lookUp(packages.map(p => ({ lockPath: `${THIRD_PARTY}list.json`, name: p.name, version: p.version, direct: true, brings: 0 })), { get, now });
  failures.push(...looked.failures.map(f => `FAIL ${f}`));
  reports.push(...looked.reports);
  for (const p of packages) {
    if (!registryHolds(p, await get(`${NPM}${p.name}`), signing, fail)) continue;
    const said = tarballFaults(at, p, await getBytes(`${NPM}${p.name}/-/${p.name}-${p.version}.tgz`));
    if (said.fault) fail(...said.fault); else reports.push(said.report);
  }
  return { failures, reports };
}

// What the registry's document `doc` says of the entry `p`: its integrity, its date, and a signature of the registry's
// keys (`signing`) on them; false where it gives no such version.
function registryHolds(p, doc, signing, fail) {
  const v = doc.json?.versions?.[p.version], at = `${p.name}@${p.version}`;
  if (doc.status !== 200 || !v) { fail(`${at}: the registry gives no such version (it answered ${doc.status})`, "name a version the registry has"); return false; }
  if (v.dist?.integrity !== p.integrity) fail(`${at}: the registry's integrity is ${logged(String(v.dist?.integrity))}`, "write the registry's, and take the files again from its tarball");
  if (doc.json.time?.[p.version] !== p.published) fail(`${at}: the registry gives ${logged(String(doc.json.time?.[p.version]))} as its date`, "write the registry's date as \"published\"");
  const message = Buffer.from(`${at}:${p.integrity}`);
  const live = k => k.expires === null || k.expires === undefined || Date.parse(k.expires) > Date.parse(p.published); // (a key that expired before the version was published signs nothing of it)
  const holds = (k, s) => { try { return k.keyid === s.keyid && live(k) && verified("sha256", message, { key: Buffer.from(k.key, "base64"), format: "der", type: "spki" }, Buffer.from(s.sig, "base64")); } catch { return false; } };
  if (!(v.dist?.signatures ?? []).some(s => signing.some(k => holds(k, s)))) fail(`${at}: no signature of the registry's key holds for its integrity`, "take no version the registry has not signed; if its keys could not be read, run this again");
  return true;
}

// The tarball fetched (`tarball`, { status, body }) against the entry `p` and its folder under `at`: held to the
// integrity, unpacked by tar, and each carried file compared with its own. { fault: [what, mend] } or { report }.
function tarballFaults(at, p, tarball) {
  const sum = tarball.body ? `sha512-${createHash("sha512").update(tarball.body).digest("base64")}` : null, id = `${p.name}@${p.version}`;
  if (sum !== p.integrity) return { fault: [`${id}: its tarball ${tarball.body ? `sums to ${sum}` : `could not be fetched (${tarball.status})`}`, "take the files from the tarball the integrity names, and run this again"] };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "third-party-"));
  try {
    fs.writeFileSync(path.join(dir, "p.tar"), gunzipSync(tarball.body));
    execFileSync("tar", ["-x", "-f", "p.tar"], { cwd: dir, stdio: "ignore" });
    const from = path.join(dir, "package"), theirs = filesIn(from).files.filter(f => named(p.files, f)), ours = filesIn(path.join(at, p.name)).files;
    const same = f => theirs.includes(f) && ours.includes(f) && fs.readFileSync(path.join(from, f)).equals(fs.readFileSync(path.join(at, p.name, f)));
    const differ = [...new Set([...theirs, ...ours])].filter(f => !same(f));
    if (differ.length) return { fault: [`${id}: ${differ.length} carried file${differ.length === 1 ? "" : "s"} differ from the tarball's (${differ.slice(0, 5).map(logged).join(", ")})`, "copy the tarball's files whole, the paths \"files\" names and no other"] };
    return { report: `${THIRD_PARTY}${p.name}/: ${ours.length} files, each the same as the tarball's at ${p.version}, signed by the registry` };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

async function main() {
  const out = process.argv.includes("--verify") ? await verify() : { failures: faults(), reports: [] };
  for (const r of out.reports) console.log(r);
  for (const f of out.failures) console.log(f);
  if (out.failures.length) process.exitCode = 1;
  else console.log(`${THIRD_PARTY}: every package as list.json says${process.argv.includes("--verify") ? ", and as the registry gives it" : ""}`);
}

if (started(import.meta.url)) await main();
