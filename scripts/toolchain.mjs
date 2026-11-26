#!/usr/bin/env node
// The toolchain a project pins, fetched for a release's trial at set-up (#1361, point 21; AGENTS.md, "The trial's machine
// fetches what a project pins"), as scripts/node.sh fetches Node: one exact version, taken only where the list SDKS
// below holds its checksum for this machine, and checked against it before anything of it runs. The one pin it reads
// is the .NET SDK a project's global.json names ("sdk": { "version" }), at that exact version, which meets any
// "rollForward" the file sets. It reads the global.json at the project's root alone, not one a subfolder's jobs run
// under. Every dotnet it runs runs from the file system's root, so no global.json of the project's, or of the folder it
// was started in, chooses what runs. A version out of form is named by its JSON type alone, nothing of it printed. It
// goes to a folder of its own under the home folder, which it holds outside the project (the trial's builder keeps the
// home outside every repository), never over the machine's own; the line it prints says what to set for the trial's
// runs. Where the machine's own dotnet already lists that SDK, it fetches nothing. A version or a machine the list holds
// no sum for, a host that does not give the file (any status but 200), a sum that differs, or a binary that does not
// give its version, and nothing is installed:
// it says so with its mend. It widens no network (only the owner does that) and changes nothing of the project. Safe to
// run twice; it always exits 0 when it fetches, since it decides nothing: a job wanting what it could not fetch reads
// alike before and after the update, so it stops no cut (scripts/release-trial.mjs). Node's own modules and the
// machine's curl and tar.
//
//   node <core>/scripts/toolchain.mjs [<project folder>]   fetch what the project pins (default: the current folder)
//   node <core>/scripts/toolchain.mjs --entry <version>    print the list's entries for that SDK from the publisher's
//                                                          release notes for its channel, given on standard input (as
//                                                          the mend below names them), for a pull request of the core
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { leadsOut, parseBounded } from "./guards.mjs";
import { started } from "./started.mjs";

export const HOST = "builds.dotnet.microsoft.com";
// (an SDK's exact version, 80 characters at most; global.json read at 64 KB at most)
const VERSION = /^(?=.{1,80}$)\d{1,4}\.\d{1,4}\.\d{3,6}(?:-[0-9A-Za-z.-]{1,64})?$/u;
const MOST = 64 * 1024;
const RIDS = { "linux-x64": ["linux", "x64"], "linux-arm64": ["linux", "arm64"] };
const urlOf = (version, rid) => `https://${HOST}/dotnet/Sdk/${version}/dotnet-sdk-${version}-${rid}.tar.gz`;
const notesOf = (channel) => `https://${HOST}/dotnet/release-metadata/${channel}/releases.json`;
const MEND_LIST = "Mend: add its entries to SDKS in scripts/toolchain.mjs in a pull request of the core, as `node scripts/toolchain.mjs --entry <the version>` prints them from the publisher's release notes for its channel, given on standard input, then run this again from a clone of the core that holds them";

// The list: each .NET SDK version for each machine, its download from the publisher's own host and the SHA-512 the
// publisher's release notes give for it, as --entry prints them, the review reading them against the same notes. A
// version or machine with no entry here is never fetched. 10.0.404, the newest SDK of the newest long-term line, read on
// 26 November 2026, its linux-x64 archive's sum checked against the file the same day.
export const SDKS = [
  { version: "10.0.404", rid: "linux-x64", url: "https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.404/dotnet-sdk-10.0.404-linux-x64.tar.gz", sha512: "577d0eb17fec33d029104c5c63a1ab0accc3e28776274abef2218dbac5af18d2109b5406d26b31d76f5c245215e3ba0926a94c20246c672c41847c9e1eb1dc50" },
  { version: "10.0.404", rid: "linux-arm64", url: "https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.404/dotnet-sdk-10.0.404-linux-arm64.tar.gz", sha512: "3533a3869da219cac45c567aadac3d8e96cdf1c6a04fe1c1d5fdeefea5d45af8424488f0144730d11b4a751f7ad546fb11e4c2b2725cd8401efee726711f8f11" },
];

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

// The list's entries, each formed, no version and machine twice. Throws where it is not so.
export function readList(entries = SDKS) {
  if (!Array.isArray(entries)) throw new Error("the list is not a list");
  const seen = new Set();
  for (const e of entries) {
    const wrong = formed(e);
    if (wrong) throw new Error(wrong);
    if (seen.has(`${e.version} ${e.rid}`)) throw new Error(`${e.version} for ${e.rid} stands twice`);
    seen.add(`${e.version} ${e.rid}`);
  }
  return entries;
}

// The .NET SDK the project pins: its exact version, null where it pins none, or { wrong } where global.json is not read.
export function pinOf(project) {
  const file = path.join(project, "global.json");
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return null;
  if (leadsOut(project, file)) return { wrong: "its global.json leads out of the project" };
  const real = fs.statSync(file, { throwIfNoEntry: false });
  if (!real?.isFile()) return { wrong: "its global.json is not a plain file" };
  if (real.size > MOST) return { wrong: `its global.json is past ${MOST} bytes` };
  let json;
  try { json = parseBounded(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, "")); } catch { return { wrong: "its global.json is not JSON, or nests too deep" }; }
  const version = json?.sdk?.version;
  if (version === undefined) return null;
  if (typeof version === "string" && VERSION.test(version)) return { version };
  const kind = version === null ? "null" : Array.isArray(version) ? "a list" : typeof version === "string" ? "a text" : `a ${typeof version}`;
  return { wrong: `its global.json's sdk.version is ${kind} not in the form of an SDK's exact version` };
}

const ridOf = (platform, arch) => Object.keys(RIDS).find(r => RIDS[r][0] === platform && RIDS[r][1] === arch) ?? null;
// (each run from the file system's root, where dotnet finds no global.json but one only its owner writes, and with the
// SDK's telemetry and banner off)
const QUIET = { DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
const run = (cmd, args, env) => spawnSync(cmd, args, { encoding: "utf8", cwd: path.parse(process.cwd()).root, env: { ...env, ...QUIET }, timeout: 900_000, maxBuffer: 256 * 1024 * 1024 });
const quoted = text => `'${text.replace(/'/gu, "'\\''")}'`;
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
  if (!leadsOut(project, root)) return { said: `NOT FETCHED: the .NET SDK ${version} (its folder, ${root}, would stand inside the project). Mend: run this with a home folder outside the project.` };
  return { version, rid, root };
}

// Fetch the entry's archive beside `root`, check it by its sum before it is opened, open it and run its dotnet; only
// then does it take root's place. What went wrong, or "".
function install(entry, root, env) {
  fs.mkdirSync(path.dirname(root), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(path.dirname(root), ".fetch-"));
  try {
    const archive = path.join(tmp, "sdk.tar.gz"), out = path.join(tmp, "sdk");
    const got = run("curl", ["-sS", "--proto", "=https", "--connect-timeout", "30", "--max-time", "900", "-w", "%{http_code}", "-o", archive, entry.url], env);
    if (got.error || got.status !== 0) return `${HOST} did not give it: ${why(got, "curl")}). Mend: where this machine's network does not allow ${HOST}, only the owner can allow it, in the environment's settings; until then the job that needs it reads alike before and after the update, so it stops no cut.`;
    const code = got.stdout?.trim() ?? "";
    if (code !== "200") return `${HOST} answered ${/^\d{3}$/u.test(code) ? code : "no status"}, not the file, which may have moved; nothing of it was opened). Mend: tell the owner the publisher's address for it changed; its entry is mended in a pull request of the core, as --entry prints it from the publisher's release notes.`;
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
export function fetchPinned({ project = process.cwd(), list = SDKS, home = os.homedir(), env = process.env, platform = process.platform, arch = process.arch } = {}) {
  const place = placed({ project, home, env, platform, arch });
  if (place.said) return [place.said];
  const { version, rid, root } = place;
  const exported = `for the trial's runs: export DOTNET_ROOT=${quoted(root)} PATH=${quoted(root)}:"$PATH" ${Object.entries(QUIET).map(([k, v]) => `${k}=${v}`).join(" ")}`;
  let entries;
  try { entries = readList(list); } catch (e) { return [`NOT FETCHED: the .NET SDK ${version} (the core's list could not be read: ${e.message}). Mend: give each entry of SDKS in scripts/toolchain.mjs the form --entry prints, one entry for each version and machine.`]; }
  const entry = entries.find(e => e.version === version && e.rid === rid);
  if (!entry) return [`NOT FETCHED: the .NET SDK ${version} for ${rid} (the core's list, SDKS in scripts/toolchain.mjs, holds no checksum for it). ${MEND_LIST}.`];
  // (a folder fetched before is trusted as the machine's own SDK is, but only for a version and machine the list holds)
  const dotnet = path.join(root, "dotnet");
  if (fs.existsSync(dotnet) && run(dotnet, ["--version"], env).stdout?.trim() === version) return [`toolchain: the .NET SDK ${version} present in ${root}; ${exported}`];
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

if (started(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === "--entry") {
    const version = args[1] ?? "";
    if (!VERSION.test(version)) { console.error(`FAIL ${JSON.stringify(version)} is not an SDK's exact version. Mend: give it as global.json names it, such as 8.0.404.`); process.exit(1); }
    const channel = version.split(".").slice(0, 2).join(".");
    let entries = [];
    try { entries = entriesFrom(JSON.parse(fs.readFileSync(0, "utf8")), version); } catch { entries = []; }
    if (!entries.length) { console.error(`FAIL the release notes given on standard input hold no entry for the SDK ${version}. Mend: give it the publisher's notes for its channel, ${notesOf(channel)}, saved where that host answers, on standard input, and check the version against them.`); process.exit(1); }
    console.log(entries.map(e => `  ${JSON.stringify(e).replace(/"(\w+)":/gu, "$1: ").replace(/,(\w+): /gu, ", $1: ").replace(/^\{/u, "{ ").replace(/\}$/u, " }")},`).join("\n"));
  } else {
    for (const line of fetchPinned({ project: path.resolve(args[0] ?? ".") })) console.log(line);
  }
}
