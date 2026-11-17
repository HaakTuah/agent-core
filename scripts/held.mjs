#!/usr/bin/env node
// What a project holds, looked up again (#488, points 7 and 8): every package the lock files of the licence check's
// config hold, npm's ("lockfiles") and NuGet's ("nuget"), asked of its registry as the lookup asks of a new one
// (lookup.mjs, beside this file, whose readers it uses), and each that has gone stale since it was taken reported: no
// release within STALE days, its registry no longer knowing it, or its repository archived. GitHub is asked, with no
// token, only of the packages the project names itself, and of at most GITHUB_MOST of them, the oldest last release
// first. Each package found so is a task, as `tasks/updates.md` says of one held back: replaced, or kept with its
// reason. A package from anywhere but its registry (point 4's, which the lookup reads) or from a source of the config's
// own on NuGet is not asked. It fails nothing (exit 0, save where it is given a wrong option) and adds no job: the
// session that syncs runs it once at the sync that brings it (setup/sync-notes.md), and the scheduled look once a month,
// with the state report (look.mjs). What a registry or GitHub answers is a publisher's text: printed on one line.
// Node's own modules.
//
//   node core/scripts/held.mjs            from a project's root: the configs its workflows name, else the kit's
//   node core/scripts/held.mjs <config>   that config, for both npm and NuGet
//   node core/scripts/held.mjs --issue    the look's issue body: nothing where nothing is stale; exit 3 where nothing
//                                         could be read
import path from "node:path";
import { logged } from "./guards.mjs";
import { loadConfig } from "./licences.mjs";
import { GITHUB_MOST, archived, fetched, packagesOf, pool, registry } from "./lookup.mjs";
import { nugetConfig } from "./nuget.mjs";
import { started } from "./started.mjs";

export const STALE = 365;
export const SECONDS = 120;
const DAY = 86400000;
const said = (value) => logged(String(value).slice(0, 200));
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The packages of the config at `configPath` (npm's and NuGet's, each read from its lock files), once each by name and
 *  version: [{ ...package, nuget, sources }], and in `unread` each lock file or config that could not be read. */
export function heldPackages(root, configs) {
  const out = new Map(), unread = [];
  for (const [configPath, nuget] of configs) {
    let config;
    try { config = loadConfig(path.resolve(root, configPath)); } catch (e) { unread.push(`${said(configPath)}: ${said(e.message)}`); continue; }
    let sources = 0;
    try { sources = nuget ? nugetConfig(config).sources.length : 0; } catch { /* (no NuGet part: no sources of its own) */ }
    let head = [];
    try { ({ head } = packagesOf(config, root, null, nuget)); } catch (e) { unread.push(`${said(configPath)}: ${said(e.message)}`); continue; }
    for (const [lockPath, packages] of head) for (const p of packages) {
      const key = `${nuget ? "nuget" : "npm"}\u0000${nuget ? p.name.toLowerCase() : p.name}@${p.version}`;
      const was = out.get(key);
      if (!was || (p.direct && !was.direct)) out.set(key, { ...p, lockPath, nuget, sources });
    }
  }
  return { packages: [...out.values()], unread };
}

/** Each package looked up with `get(url)` ({ status, json }), as of `now`, until `clock()` passes `until`: { stale, unread, asked },
 *  `stale` a line for each package gone stale, `unread` one for each that could not be asked or answered. */
export async function lookAgain(packages, { get, now = Date.now(), until = Date.now() + SECONDS * 1000, clock = Date.now }) {
  const stale = [], unread = [], fresh = [];
  let asked = 0;
  await pool(packages.filter((p) => !p.from), 8, async (p) => {
    const at = `${said(p.lockPath)}: ${said(p.name)}@${said(p.version)}`;
    if (clock() > until) { unread.push(`${at}: not asked, past the ${SECONDS} seconds a look takes`); return; }
    asked++;
    let facts;
    try { facts = await registry(p, get, p.nuget, p.sources); } catch (e) { unread.push(`${at}: ${p.nuget ? "NuGet's" : "npm's"} registry could not be read (${said(e.message)})`); return; }
    if (facts.elsewhere) return;
    if (facts.missing) { stale.push(`${at}: its registry no longer has it (${said(facts.missing)})`); return; }
    if (now - facts.last > STALE * DAY) { stale.push(`${at}: no release since ${day(facts.last)}, over ${STALE} days ago${p.direct ? "" : `, brought by ${(p.by ?? []).map(said).join(", ") || "another"}`}`); return; }
    if (p.direct && facts.repo?.owner) fresh.push({ p, at, facts });
  });
  // (GitHub, asked with no token, only of what the project names and at most GITHUB_MOST, the oldest last release first)
  const ask = fresh.sort((a, b) => a.facts.last - b.facts.last), left = ask.slice(GITHUB_MOST).length;
  for (const { at, facts } of ask.slice(0, GITHUB_MOST)) {
    if (clock() > until) { unread.push(`${at}: GitHub not asked whether its repository is archived, past the ${SECONDS} seconds a look takes`); continue; }
    if ((await archived(facts.repo, get)) === true) stale.push(`${at}: its repository, ${said(facts.repo.url)}, is archived`);
  }
  return { stale: stale.sort(), unread: unread.sort(), asked, notOnGitHub: left };
}

/** The report: each package gone stale as a task, then what was left unread; null where nothing is stale. */
export function report({ stale, unread, asked, notOnGitHub }) {
  if (!stale.length) return null;
  return [`Packages the project holds that have gone stale (\`core/scripts/held.mjs\`, of ${asked} asked): no release within ${STALE} days, gone from their registry, or their repository archived. Each is a task an agent takes alone, as \`core/tasks/updates.md\` says of a package held back: replace it, in a pull request of its own as any new package is taken (\`core/floor/topics/dependencies.md\`), or, where it stays, write why in an issue of its own.`,
    "", ...stale.map((l) => `- ${l}`),
    ...(unread.length ? ["", `Left unread this time (${unread.length}): ${unread.slice(0, 20).join("; ")}${unread.length > 20 ? "; and more" : ""}.`] : []),
    ...(notOnGitHub ? ["", `GitHub was not asked of ${notOnGitHub} named package${notOnGitHub === 1 ? "" : "s"} whose last release is newer, past the ${GITHUB_MOST} a run asks.`] : [])].join("\n");
}

/** The configs a project's packages are read by: the licence check's for npm, and the NuGet check's (the same, where it
 *  names none of its own) for NuGet, as its workflows name them (steps.mjs's reader), else the starter kit's. */
async function configsOf(root) {
  const { configs, project } = await import("./steps.mjs");
  const found = configs(project(root));
  return [[found.licences ?? "checks/licences.json", false], [found.nuget ?? found.licences ?? "checks/licences.json", true]];
}

if (started(import.meta.url)) {
  const args = process.argv.slice(2), issue = args.includes("--issue"), named = args.filter((a) => a !== "--issue");
  if (named.length > 1 || named.some((a) => a.startsWith("--"))) { console.error("FAIL: it takes a config and --issue, and nothing else. Mend: run node core/scripts/held.mjs [<the licence check's config>] [--issue]"); process.exit(2); }
  const root = process.cwd();
  const configs = named.length ? [[named[0], false], [named[0], true]] : await configsOf(root);
  const { packages, unread } = heldPackages(root, configs);
  const found = await lookAgain(packages, { get: fetched });
  found.unread.unshift(...unread);
  const text = report(found);
  if (issue) {
    if (text) console.log(text);
    process.exit(text || (found.asked > 0 && found.unread.length === 0) || (!packages.length && !unread.length) ? 0 : 3);
  }
  console.log(text ?? `ok   none of the ${found.asked} package${found.asked === 1 ? "" : "s"} asked has gone stale (\`core/scripts/held.mjs\`)${found.unread.length ? `; left unread (${found.unread.length}): ${found.unread.slice(0, 20).join("; ")}` : ""}`);
}
