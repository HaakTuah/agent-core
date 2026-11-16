#!/usr/bin/env node
// The lookup (floor rule 15, "A new one is looked up in its registry", in floor/topics/dependencies.md beside this
// folder; #488, point 1), for every project that takes the core: each package a pull request brings into the project,
// one no lock file of its base held under any version, is asked of its registry. It fails a name the registry does not
// know (a model sometimes names a package that does not exist, and someone may register the name), and one first
// published less than YOUNG days ago (such a name is new and has no history). Everything else it reads is printed for
// the review, and no score decides: when it last had a release, where its repository is and whether it is archived,
// who publishes it and whether its repository names it back, how many packages it brings with it, and whether it has
// provenance. A package updated, or one any lock file of the base held, is not looked up: nothing that stood before
// fails (AGENTS.md, "Nothing locks a project"). With no base, as on a push, nothing is new.
//
// npm: the licence check's "lockfiles", each package that npm's registry gives (licences.mjs's registryName), read
// against every package-lock.json and npm-shrinkwrap.json of the base; NuGet (--nuget): its "nuget" lock files, read
// against every packages.lock.json and packages.<name>.lock.json of the base. A package from anywhere else is not
// looked up here. What a registry, or GitHub, answers is a publisher's text: it is printed on one line (guards.mjs's
// logged), and an answer of another shape is a lookup that failed. Repositories are asked of GitHub's API without a
// token, for the packages the project names itself alone (at most GITHUB_MOST), so the hour's limit is never reached.
// Node's own modules; run by the licence workflow (npm) and the NuGet workflow (--nuget).
//
//   node core/scripts/lookup.mjs <the licence check's config> [--nuget]
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import { logged, parseBounded } from "./guards.mjs";
import { baseOf, loadConfig, lockInstalled, registryName, textAt } from "./licences.mjs";
import { lockPackages, nugetConfig } from "./nuget.mjs";
import { projectAt } from "./core-path.mjs";
import { started } from "./started.mjs";

export const YOUNG = 90;
export const GITHUB_MOST = 20;
const DAY = 86400000;
const NPM = "https://registry.npmjs.org/";
const registryOf = (nuget) => `${nuget ? "NuGet" : "the npm"} registry`;
const NUGET = "https://api.nuget.org/v3/registration5-gz-semver2/";
const NUGET_PAGES = 100;
// (a name as npm's registry gives one, an old one in capitals too: at most a scope and a name, nothing an address reads)
const NPM_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/iu;
const KINDS = ["dependencies", "optionalDependencies", "peerDependencies"];
const said = (value) => logged(String(value).slice(0, 200));
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const when = (text) => (typeof text === "string" && /^\d{4}-\d\d-\d\dT/u.test(text) ? Date.parse(text) : NaN);

// ---- What a lock file holds

/** The packages of an npm lock file's text that npm's registry gives: each { name, version, path, direct, brings }. */
export function npmPackages(text, lockPath) {
  const lock = parseBounded(text), packages = lock?.packages;
  if (!packages || typeof packages !== "object" || Array.isArray(packages)) throw new Error(`${lockPath} holds no "packages". Mend: write it anew with npm, version 7 or later: its install, given --package-lock-only`);
  const own = new Set(Object.keys(packages).filter((p) => !lockInstalled(p)));
  // (what the project's own packages ask for, their development dependencies too, it names itself; what an installed
  // package asks for, its development dependencies left out, it brings)
  const names = (entry, kinds = KINDS) => kinds.flatMap((k) => (entry?.[k] && typeof entry[k] === "object" ? Object.keys(entry[k]) : []));
  const direct = new Set([...own].flatMap((p) => names(packages[p], [...KINDS, "devDependencies"]).map((n) => resolve(packages, p, n)).filter(Boolean)));
  const next = (at) => names(packages[at]).map((n) => resolve(packages, at, n)).filter(Boolean);
  const reached = new Map([...direct].map((d) => [d, reach(d, next)]));
  const nameOf = (p) => registryName(packages[p]?.resolved) ?? p.slice(p.lastIndexOf("node_modules/") + 13);
  return Object.entries(packages).filter(([p, e]) => lockInstalled(p) && e && typeof e === "object" && !e.link && registryName(e.resolved))
    .map(([p, e]) => ({ name: registryName(e.resolved), version: String(e.version ?? ""), path: p, direct: direct.has(p), brings: reach(p, next).size,
      by: direct.has(p) ? [] : [...reached].filter(([, set]) => set.has(p)).map(([d]) => nameOf(d)) }));
}

// The lock entry that an install puts in place for `name`, as seen from the package at `from`: the nearest node_modules going up.
function resolve(packages, from, name) {
  for (let dir = from; ; dir = dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "") {
    const key = posix.join(dir, "node_modules", name);
    if (Object.hasOwn(packages, key)) return key;
    if (dir === "") return null;
  }
}

// Every node `next` leads to from `start`, itself left out.
function reach(start, next) {
  const seen = new Set([start]), todo = [start];
  while (todo.length) for (const n of next(todo.pop())) if (!seen.has(n)) { seen.add(n); todo.push(n); }
  seen.delete(start);
  return seen;
}

/** The packages of a NuGet lock file's text: each { name, version, path, direct, brings }, a framework's entries read together. */
export function nugetPackages(text, lockPath) {
  const { packages, failures } = lockPackages(text, lockPath);
  if (failures.length) throw new Error(failures[0]);
  const lock = parseBounded(text.replace(/^﻿/u, "")), out = new Map();
  for (const entries of Object.values(lock.dependencies)) {
    const lower = new Map(Object.keys(entries).map((id) => [id.toLowerCase(), id]));
    const next = (id) => Object.keys(entries[id]?.dependencies ?? {}).map((d) => lower.get(d.toLowerCase())).filter(Boolean);
    const reached = Object.entries(entries).filter(([, e]) => e?.type === "Direct" || e?.type === "CentralTransitive").map(([id]) => [id, reach(id, next)]);
    for (const { id, version } of packages) {
      const entry = entries[lower.get(id.toLowerCase())];
      if (!entry || entry.resolved !== version) continue;
      const was = out.get(id.toLowerCase()), brings = reach(lower.get(id.toLowerCase()), next).size;
      const by = reached.filter(([, set]) => set.has(lower.get(id.toLowerCase()))).map(([d]) => d);
      out.set(id.toLowerCase(), { name: id, version, path: id, direct: (was?.direct ?? false) || entry.type !== "Transitive", brings: Math.max(was?.brings ?? 0, brings), by: [...new Set([...(was?.by ?? []), ...by])] });
    }
  }
  return [...out.values()];
}

// ---- What is new

/** The packages of `head` (lists of packages, one for each lock file) whose name no list of `base` holds, one for each
 *  name, its lock file named: npm's names as written, NuGet's in any case. */
export function newPackages(head, base, nuget = false) {
  const key = (name) => (nuget ? name.toLowerCase() : name);
  const held = new Set(base.flat().map((p) => key(p.name))), out = new Map();
  for (const [lockPath, packages] of head) for (const p of packages) {
    if (held.has(key(p.name))) continue;
    const was = out.get(key(p.name));
    if (!was || (p.direct && !was.direct)) out.set(key(p.name), { ...p, lockPath });
  }
  return [...out.values()];
}

// ---- What the registry says

/** What npm's registry says of the package `name` at `version`, from its answer `doc`: { facts, repo } or { missing }. */
export function npmFacts(doc, version) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new Error("its answer is no JSON object");
  const time = doc.time && typeof doc.time === "object" ? doc.time : {};
  if (time.unpublished || !doc.versions || typeof doc.versions !== "object") return { missing: "its versions were taken off the registry" };
  const created = when(time.created);
  if (Number.isNaN(created)) throw new Error("its answer gives no date it was first published");
  const releases = Object.entries(time).filter(([k]) => k !== "created" && k !== "modified").map(([, v]) => when(v)).filter((t) => !Number.isNaN(t));
  return { first: created, last: releases.length ? Math.max(...releases) : created, ...ofVersion(doc, version) };
}

// What the document says of the one version: its repository, its publisher and whether it has provenance.
function ofVersion(doc, version) {
  const v = doc.versions[version] && typeof doc.versions[version] === "object" ? doc.versions[version] : {};
  return { repo: repository(v.repository ?? doc.repository), publisher: typeof v._npmUser?.name === "string" ? v._npmUser.name : "not named",
    provenance: v.dist?.attestations?.provenance ? "yes" : "no" };
}

/** The repository a package names, as { url, owner, name, dir } where it is on GitHub, { url } elsewhere, or null. */
export function repository(field) {
  const url = typeof field === "string" ? field : typeof field?.url === "string" ? field.url : null;
  if (!url) return null;
  const dir = typeof field?.directory === "string" && /^[\w./-]{1,200}$/u.test(field.directory) && !field.directory.split("/").includes("..") ? field.directory.replace(/^\.?\/+|\/+$/gu, "") : "";
  const gh = /^(?:git\+)?(?:https?|git|ssh):\/\/(?:git@)?github\.com\/([\w.-]{1,100})\/([\w.-]{1,100}?)(?:\.git)?\/?$/u.exec(url) ?? /^(?:github:)?([\w.-]{1,100})\/([\w.-]{1,100})$/u.exec(url);
  return gh && gh[1] !== "." && gh[1] !== ".." ? { url: `github.com/${gh[1]}/${gh[2]}`, owner: gh[1], name: gh[2], dir } : { url };
}

/** What NuGet's registry says of a package, from its registration index and the pages `page(item)` gives. */
export async function nugetFacts(index, page) {
  if (!index || !Array.isArray(index.items) || !index.items.length) throw new Error("its answer holds no pages of versions");
  if (index.items.length > NUGET_PAGES) throw new Error(`its answer holds more than ${NUGET_PAGES} pages of versions`);
  // (every page is read: pages are bounded by version, not by date, so a lower version may be the newer; an unlisted
  // version's date, 1900, is no date)
  const leaves = [];
  for (const item of index.items) leaves.push(...(await page(item)));
  const dated = leaves.map((l) => ({ entry: l?.catalogEntry, at: when(l?.catalogEntry?.published) })).filter((l) => !Number.isNaN(l.at) && new Date(l.at).getUTCFullYear() > 1900);
  if (!dated.length) throw new Error("its answer gives no date any version was published");
  const first = Math.min(...dated.map((l) => l.at)), last = Math.max(...dated.map((l) => l.at));
  const entry = dated.find((l) => l.at === last)?.entry ?? null;
  const versions = new Set(leaves.map((l) => (typeof l?.catalogEntry?.version === "string" ? l.catalogEntry.version.toLowerCase() : null)).filter(Boolean));
  const project = typeof entry?.projectUrl === "string" ? entry.projectUrl : null;
  return { first, last, versions, repo: project ? repository(project) : null, publisher: typeof entry?.authors === "string" ? `${entry.authors} (as the package writes its authors)` : "not named", provenance: "not offered by NuGet's registry" };
}

// ---- The lookup

/** Each new package looked up with `get(url)` ({ status, json }): { failures, reports }, as of `now`. */
export async function lookUp(packages, { get, now = Date.now(), nuget = false, sources = 0 }) {
  const failures = [], reports = [], github = { asked: 0 };
  await pool(packages, 8, async (p) => {
    const at = `${said(p.lockPath)}: ${said(p.name)}@${said(p.version)}`, where = registryOf(nuget);
    let facts;
    try { facts = await registry(p, get, nuget, sources); } catch (e) {
      failures.push(`${at}: ${where} could not be read (${said(e.message)}). Mend: run the job again; if it fails the same way, say so in the pull request and leave the package out until it passes`);
      return;
    }
    if (facts.elsewhere) { reports.push(`${at}: not in ${where} at this version, so from a source the config names, which the lookup does not read; the NuGet check holds it to the lock file's content hash`); return; }
    if (facts.missing) { failures.push(`${at}: ${where} has no such package (${facts.missing}). Mend: take it out of the project's package list and its lock file, and name a package the registry has: a name a model gave may be one nobody published, or one someone registered to be taken`); return; }
    const young = tooYoung(p, facts, now);
    if (young) failures.push(`${at}: ${young}`);
    reports.push(`${at}: ${await described(p, facts, now, { get, nuget, github })}`);
  });
  return { failures: failures.sort(), reports: reports.sort() };
}

const brought = (p) => (p.by ?? []).map(said).join(", ");

// Where a package was first published under YOUNG days before `now`, what is wrong and its mend: for one the project
// names, take another or wait; for one another brings, hold what brings it or take a version of that which does not.
function tooYoung(p, facts, now) {
  const age = Math.floor((now - facts.first) / DAY), until = day(facts.first + YOUNG * DAY), by = brought(p);
  if (age >= YOUNG) return null;
  const mend = p.direct ? `take a package that does the job and was first published ${YOUNG} days ago or more, or wait until ${until} to add this one`
    : `hold the change that brings it${by ? ` (to ${by})` : ""} until ${until}, or take a version of ${by || "what brings it"} that does not bring it`;
  return `first published ${day(facts.first)}, ${age} days ago, under the ${YOUNG} days floor rule 15 asks. Mend: ${mend}`;
}

// What the review is shown of one package, GitHub asked only of one the project names, and of GITHUB_MOST at most.
async function described(p, facts, now, { get, nuget, github }) {
  const age = Math.floor((now - facts.first) / DAY);
  let repo = facts.repo ? said(facts.repo.url) : "not named";
  if (p.direct && facts.repo?.owner) repo += github.asked++ < GITHUB_MOST ? await onGitHub(facts.repo, p.name, get, nuget) : `, GitHub not asked: past the ${GITHUB_MOST} packages a lookup asks of it`;
  return `${p.direct ? "named by the project" : `brought by ${brought(p) || "another"}`}; first published ${day(facts.first)} (${age} days ago); last release ${day(facts.last)}; repository ${repo}; published by ${said(facts.publisher)}; brings ${p.brings} package${p.brings === 1 ? "" : "s"} with it; provenance: ${facts.provenance}`;
}

// What the registry says of the package: its facts, { missing } where it has no such package, or, on NuGet where the
// config names sources of its own, { elsewhere } where NuGet's registry has no such id or version, which one of those
// gives (the NuGet check holds what is restored to the lock file's content hash).
async function registry(p, get, nuget, sources = 0) {
  if (!nuget) {
    if (!NPM_NAME.test(p.name)) throw new Error("its name is not one npm's registry gives");
    const r = await get(`${NPM}${p.name.replaceAll("/", "%2F")}`);
    if (r.status === 404) return { missing: "the registry answers that it knows no such name" };
    if (r.status !== 200) throw new Error(`it answered ${r.status}`);
    return npmFacts(r.json, p.version);
  }
  const r = await get(`${NUGET}${encodeURIComponent(p.name.toLowerCase())}/index.json`);
  if (r.status === 404) return sources ? { elsewhere: true } : { missing: "the registry answers that it knows no such id" };
  if (r.status !== 200) throw new Error(`it answered ${r.status}`);
  const facts = await nugetFacts(r.json, async (item) => {
    if (Array.isArray(item?.items)) return item.items;
    // (a page's address is built here from the bounds the index gives, and the index must name that same page: no
    // address an answer gives is fetched, floor rule 5)
    const bound = (v) => (typeof v === "string" && /^[0-9A-Za-z.+-]{1,100}$/u.test(v) ? v.toLowerCase() : null);
    const lower = bound(item?.lower), upper = bound(item?.upper);
    const at = lower && upper ? `${NUGET}${encodeURIComponent(p.name.toLowerCase())}/page/${lower}/${upper}.json` : null;
    if (!at || String(item?.["@id"]).toLowerCase() !== at) throw new Error("a page of its versions lies outside the registry, or is named in a form it does not know");
    const page = await get(at);
    if (page.status !== 200 || !Array.isArray(page.json?.items)) throw new Error(`a page of its versions answered ${page.status}`);
    return page.json.items;
  });
  if (facts.versions.has(p.version.toLowerCase())) return facts;
  return sources ? { elsewhere: true } : { missing: `the registry knows the id, and no version ${said(p.version)} of it` };
}

// Whether the repository is archived, and, on npm, whether its package.json (in the folder the package names) names
// the package back: as text for the report.
async function onGitHub(repo, name, get, nuget) {
  const r = await get(`https://api.github.com/repos/${repo.owner}/${repo.name}`).catch(() => ({ status: 0 }));
  const archived = r.status === 200 && typeof r.json?.archived === "boolean" ? (r.json.archived ? ", archived" : ", not archived") : r.status === 404 ? ", which GitHub does not show" : ", archived or not: GitHub did not answer";
  if (nuget) return archived;
  const file = await get(`https://raw.githubusercontent.com/${repo.owner}/${repo.name}/HEAD/${repo.dir ? `${repo.dir}/` : ""}package.json`).catch(() => ({ status: 0 }));
  return `${archived}, ${file.status === 200 && file.json?.name === name ? "naming the package back" : "not naming the package back where it says"}`;
}

async function pool(items, size, work) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => { while (queue.length) await work(queue.shift()); }));
}

// ---- The project

/** The lock files of `nuget` or npm the config names, and the base's own of the same kind, each read to packages. */
export function packagesOf(config, root, base, nuget) {
  const named = nuget ? [...nugetConfig(config).ships, ...nugetConfig(config).tools] : config.lockfiles ?? [];
  const read = nuget ? nugetPackages : npmPackages;
  const head = named.map((f) => [f, read(readFileSync(posix.join(root, f), "utf8"), f)]);
  const kind = nuget ? /^packages(?:\.[^/]+)?\.lock\.json$/iu : /^(?:package-lock|npm-shrinkwrap)\.json$/u;
  const listed = execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", base], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0");
  const baseFiles = listed.filter((f) => kind.test(posix.basename(f)) && !f.startsWith("core/"));
  const baseLists = baseFiles.map((f) => { try { return read(textAt(root, base, f) ?? "", f); } catch { return []; } });
  return { head, base: baseLists };
}

async function fetched(url) {
  const r = await fetch(url, { headers: { "user-agent": "agent-core-lookup", accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  if (r.status !== 200) return { status: r.status };
  return { status: 200, json: parseBounded(await r.text()) };
}

const mended = (message, mend) => (/Mend: /u.test(message) ? message : `${message}. Mend: ${mend}`);

/** The check on the project at `root`, read against `base` (a commit, or null), its config at `configPath` as the
 *  working folder names it: { lines, code }, each line as the workflow prints it. */
export async function run(configPath, { root, base, nuget = false, get = fetched, now = Date.now() }) {
  if (!base) return { lines: [`ok   no pull request's base here, so no package is new: nothing looked up${process.env.GITHUB_EVENT_NAME?.startsWith("pull_request") ? " (note: this is a pull request, so its checkout lacks the base: give it fetch-depth: 2, or the lookup reads nothing)" : ""}`], code: 0 };
  let found, sources = 0;
  try {
    const config = nuget ? JSON.parse(readFileSync(configPath, "utf8")) : loadConfig(configPath);
    const { head, base: held } = packagesOf(config, root, base, nuget);
    found = newPackages(head, held, nuget);
    if (nuget) sources = nugetConfig(config).sources.length;
  } catch (e) { return { lines: [`FAIL: ${logged(mended(e.message, "write the config as JSON, and each lock file it names anew with its package manager, never by hand"))}`], code: 1 }; }
  const { failures, reports } = await lookUp(found, { get, now, nuget, sources });
  const s = found.length === 1 ? "" : "s";
  return { lines: [...reports.map((r) => `REPORT: ${r}`), ...failures.map((f) => `FAIL: ${f}`),
    failures.length ? `${failures.length} of ${found.length} new package${s} fail the lookup (floor rule 15)` : `ok   ${found.length} new package${s} looked up in ${registryOf(nuget)}, each printed above for the review`], code: failures.length ? 1 : 0 };
}

if (started(import.meta.url)) {
  const configPath = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!configPath) { console.error("FAIL: no config was named. Mend: name it: node core/scripts/lookup.mjs <the licence check's config> [--nuget]"); process.exit(1); }
  let root;
  try { root = projectAt(fileURLToPath(new URL(".", import.meta.url))).root || execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: fileURLToPath(new URL(".", import.meta.url)), encoding: "utf8" }).trim(); }
  catch (e) { console.error(`FAIL: ${logged(e.message)}. Mend: run it from the project's root, a git repository`); process.exit(1); }
  const { lines, code } = await run(configPath, { root, base: baseOf(root), nuget: process.argv.includes("--nuget") });
  for (const line of lines) (line.startsWith("FAIL") ? console.error : console.log)(line);
  // (what is printed for the review, also on the run's summary page, where a reviewer finds it beside the checks)
  if (process.env.GITHUB_STEP_SUMMARY && lines.length > 1) {
    try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### The lookup${process.argv.includes("--nuget") ? " (NuGet)" : ""}\n\n${lines.map((l) => `- ${l.replace(/[<>&`*_[\]|]/gu, "?")}`).join("\n")}\n`); } catch { /* (a summary is a convenience: the log holds every line) */ }
  }
  process.exit(code);
}
