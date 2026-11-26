#!/usr/bin/env node
// The toolchain a project pins, fetched for a release's trial at set-up (#1361, point 21; AGENTS.md, "The trial's machine
// fetches what a project pins"), as scripts/node.sh fetches Node: one exact version, taken only where the core's list,
// scripts/toolchains.json beside this file, holds its checksum for this machine, and checked against it before anything
// of it runs. The one pin it reads is the .NET SDK a project's global.json names ("sdk": { "version" }), at that exact
// version, which meets any "rollForward" the file sets. It goes to a folder of its own under the home folder, outside
// every repository, never over the machine's own; the line it prints says what to set for the trial's runs. Where the
// machine's own dotnet already lists that SDK, it fetches nothing. A version or a machine the list holds no sum for, a
// host that does not answer, a sum that differs, or a binary that does not give its version, and nothing is installed:
// it says so with its mend. It widens no network (only the owner does that) and changes nothing of the project. Safe to
// run twice; it always exits 0 when it fetches, since it decides nothing: a job wanting what it could not fetch reads
// alike before and after the update, so it stops no cut (scripts/release-trial.mjs). Node's own modules and the
// machine's curl and tar.
//
//   node <core>/scripts/toolchain.mjs [<project folder>]   fetch what the project pins (default: the current folder)
//   node <core>/scripts/toolchain.mjs --entry <version>    print the list's entries for that SDK, read from the
//                                                          publisher's release notes, for a pull request of the core
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LIST = path.join(HERE, "toolchains.json");
export const HOST = "builds.dotnet.microsoft.com";
const VERSION = /^\d+\.\d+\.\d{3,}(?:-[0-9A-Za-z.-]+)?$/u;
const RIDS = { "linux-x64": ["linux", "x64"], "linux-arm64": ["linux", "arm64"] };
const urlOf = (version, rid) => `https://${HOST}/dotnet/Sdk/${version}/dotnet-sdk-${version}-${rid}.tar.gz`;
const MEND_LIST = "Mend: add its entries to scripts/toolchains.json in a pull request of the core, as `node scripts/toolchain.mjs --entry <the version>` prints them from the publisher's release notes, then run this again from a clone of the core that holds them";

// Each entry of the list in its one form, the URL the publisher's own for that version and machine: what is wrong, or "".
export function formed(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "an entry is not an object";
  const keys = Object.keys(entry).sort().join();
  if (keys !== "rid,sha512,url,version") return `an entry has the keys ${keys || "none"}, not exactly version, rid, url and sha512`;
  if (typeof entry.version !== "string" || !VERSION.test(entry.version)) return `the version ${JSON.stringify(entry.version)} is not an SDK's exact version`;
  if (!Object.hasOwn(RIDS, entry.rid)) return `the machine ${JSON.stringify(entry.rid)} is none of ${Object.keys(RIDS).join(", ")}`;
  if (entry.url !== urlOf(entry.version, entry.rid)) return `the url of ${entry.version} for ${entry.rid} is not ${urlOf(entry.version, entry.rid)}`;
  if (typeof entry.sha512 !== "string" || !/^[0-9a-f]{128}$/u.test(entry.sha512)) return `the sha512 of ${entry.version} for ${entry.rid} is not 128 lower-case hexadecimal digits`;
  return "";
}

// The list: { "dotnet-sdk": [entries] }, each formed, no version and machine twice. Throws where it is not so.
export function readList(file = LIST) {
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  const entries = list?.["dotnet-sdk"];
  if (!Array.isArray(entries)) throw new Error(`${file} holds no list "dotnet-sdk"`);
  const seen = new Set();
  for (const e of entries) {
    const wrong = formed(e);
    if (wrong) throw new Error(`${file}: ${wrong}`);
    if (seen.has(`${e.version} ${e.rid}`)) throw new Error(`${file}: ${e.version} for ${e.rid} stands twice`);
    seen.add(`${e.version} ${e.rid}`);
  }
  return entries;
}

// The .NET SDK the project pins: its exact version, null where it pins none, or { wrong } where global.json is not read.
export function pinOf(project) {
  const file = path.join(project, "global.json");
  if (!fs.existsSync(file)) return null;
  let json;
  try { json = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/u, "")); } catch { return { wrong: "its global.json is not JSON" }; }
  const version = json?.sdk?.version;
  if (version === undefined) return null;
  return typeof version === "string" && VERSION.test(version) ? { version } : { wrong: `its global.json names ${JSON.stringify(version)}, not an SDK's exact version` };
}

const ridOf = (platform, arch) => Object.keys(RIDS).find(r => RIDS[r][0] === platform && RIDS[r][1] === arch) ?? null;
const run = (cmd, args, env) => spawnSync(cmd, args, { encoding: "utf8", env, timeout: 900_000, maxBuffer: 256 * 1024 * 1024 });
const sdkListed = (dotnet, version, env) => run(dotnet, ["--list-sdks"], env).stdout?.split(/\r?\n/u).some(l => l.split(" ")[0] === version) ?? false;

const NOT_RUN = "Mend: none here; the job that needs it reads alike before and after the update, so it stops no cut.";
const why = (r, tool) => (r.error?.code ?? r.stderr?.trim()) || `${tool} exited ${r.status}`;

// Where the project's pin goes on this machine: { said } where nothing is to be fetched, else { version, rid, root }.
function placed({ project, home, env, platform, arch }) {
  const pin = pinOf(project);
  if (!pin) return { said: "toolchain: the project pins no toolchain this script fetches (no global.json naming an SDK's version); nothing fetched" };
  if (pin.wrong) return { said: `NOT FETCHED: the .NET SDK the project pins (${pin.wrong}). ${NOT_RUN}` };
  const { version } = pin;
  if (sdkListed("dotnet", version, env)) return { said: `toolchain: the .NET SDK ${version} is the machine's own; nothing fetched` };
  const rid = ridOf(platform, arch);
  if (!rid) return { said: `NOT FETCHED: the .NET SDK ${version} (this machine, ${platform} on ${arch}, is none the list holds sums for: ${Object.keys(RIDS).join(", ")}). ${NOT_RUN}` };
  const root = path.resolve(home, ".agent-core", "toolchains", `dotnet-sdk-${version}-${rid}`);
  const inside = path.relative(path.resolve(project), root);
  if (!inside.startsWith("..") && !path.isAbsolute(inside)) return { said: `NOT FETCHED: the .NET SDK ${version} (its folder, ${root}, would stand inside the project). Mend: run this with a home folder outside the project.` };
  return { version, rid, root };
}

// Fetch the entry's archive beside `root`, check it by its sum before it is opened, open it and run its dotnet; only
// then does it take root's place. What went wrong, or "".
function install(entry, root, env) {
  fs.mkdirSync(path.dirname(root), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(path.dirname(root), ".fetch-"));
  try {
    const archive = path.join(tmp, "sdk.tar.gz"), out = path.join(tmp, "sdk");
    const got = run("curl", ["-fsS", "--proto", "=https", "--connect-timeout", "30", "--max-time", "900", "-o", archive, entry.url], env);
    if (got.error || got.status !== 0) return `${HOST} did not give it: ${why(got, "curl")}). Mend: where this machine's network does not allow ${HOST}, only the owner can allow it, in the environment's settings; until then the job that needs it reads alike before and after the update, so it stops no cut.`;
    const sum = crypto.createHash("sha512").update(fs.readFileSync(archive)).digest("hex");
    if (sum !== entry.sha512) return `its download's SHA-512 is ${sum}, not the list's ${entry.sha512}; nothing of it was opened). Mend: tell the owner, since the publisher's file differs from what the core pinned; fetch nothing else in its place.`;
    fs.mkdirSync(out);
    const untar = run("tar", ["-xzf", archive, "-C", out, "--no-same-owner"], env);
    if (untar.error || untar.status !== 0) return `its archive could not be opened: ${why(untar, "tar")}). ${NOT_RUN}`;
    const said = run(path.join(out, "dotnet"), ["--version"], env).stdout?.trim();
    if (said !== entry.version) return `its dotnet gave ${JSON.stringify(said ?? "nothing")} as its version). ${NOT_RUN}`;
    fs.rmSync(root, { recursive: true, force: true });
    fs.renameSync(out, root);
    return "";
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// Fetch what the project pins; the lines to print. `env` is the environment curl, tar and dotnet are found by (PATH),
// and `home` the folder under which the toolchain goes.
export function fetchPinned({ project = process.cwd(), list = LIST, home = os.homedir(), env = process.env, platform = process.platform, arch = process.arch } = {}) {
  const place = placed({ project, home, env, platform, arch });
  if (place.said) return [place.said];
  const { version, rid, root } = place;
  const exported = `for the trial's runs: export DOTNET_ROOT=${root} PATH=${root}:$PATH`;
  const dotnet = path.join(root, "dotnet");
  if (fs.existsSync(dotnet) && run(dotnet, ["--version"], env).stdout?.trim() === version) return [`toolchain: the .NET SDK ${version} present in ${root}; ${exported}`];
  let entries;
  try { entries = readList(list); } catch (e) { return [`NOT FETCHED: the .NET SDK ${version} (the core's list could not be read: ${e.message}). Mend: make the list as tests/toolchain-test.mjs reads it.`]; }
  const entry = entries.find(e => e.version === version && e.rid === rid);
  if (!entry) return [`NOT FETCHED: the .NET SDK ${version} for ${rid} (the core's list, scripts/toolchains.json, holds no checksum for it). ${MEND_LIST}.`];
  const wrong = install(entry, root, env);
  return [wrong ? `NOT FETCHED: the .NET SDK ${version} (${wrong}` : `toolchain: the .NET SDK ${version} fetched to ${root}, its SHA-512 as the list holds it; ${exported}`];
}

// The list's entries for an SDK, read from the publisher's release notes for its channel, for a pull request of the core
// that adds them; the review reads them against the same page.
export function entriesFrom(notes, version) {
  const sdks = (notes?.releases ?? []).flatMap(r => [...(r.sdks ?? []), ...(r.sdk ? [r.sdk] : [])]);
  const sdk = sdks.find(s => s?.version === version);
  if (!sdk) return [];
  return Object.keys(RIDS).map(rid => (sdk.files ?? []).find(f => f?.rid === rid && f?.url === urlOf(version, rid)))
    .filter(Boolean).map(f => ({ version, rid: f.rid, url: f.url, sha512: String(f.hash).toLowerCase() }))
    .filter(e => !formed(e));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === "--entry") {
    const version = args[1] ?? "";
    if (!VERSION.test(version)) { console.error(`FAIL ${JSON.stringify(version)} is not an SDK's exact version. Mend: give it as global.json names it, such as 8.0.404.`); process.exit(1); }
    const channel = version.split(".").slice(0, 2).join(".");
    const got = run("curl", ["-fsS", "--proto", "=https", "--connect-timeout", "30", "--max-time", "120", `https://${HOST}/dotnet/release-metadata/${channel}/releases.json`], process.env);
    let entries = [];
    try { entries = got.status === 0 ? entriesFrom(JSON.parse(got.stdout), version) : []; } catch { entries = []; }
    if (!entries.length) { console.error(`FAIL the publisher's release notes for ${channel} gave no entry for the SDK ${version}${got.status === 0 ? "" : ` (${HOST} did not answer)`}. Mend: check the version against the notes at https://${HOST}/dotnet/release-metadata/${channel}/releases.json, and run this where that host answers.`); process.exit(1); }
    console.log(entries.map(e => JSON.stringify(e)).join(",\n"));
  } else {
    for (const line of fetchPinned({ project: path.resolve(args[0] ?? ".") })) console.log(line);
  }
}
