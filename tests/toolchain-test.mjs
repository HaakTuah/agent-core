// Tests of the toolchain a release's trial fetches for a project that pins it (scripts/toolchain.mjs; #1361, point 21;
// AGENTS.md, "The trial's machine fetches what a project pins"): the core's list read in its one form, and each case of
// a fetch, on a stand-in curl that hands over an archive made here and a stand-in dotnet, so no call reaches the network:
// a project that pins none, a pin the list holds no sum for, one fetched and checked by its sum, then present, a sum that
// differs, a host that does not answer, a binary that gives another version, the machine's own SDK kept, a machine the
// list holds none for, and a folder that would stand in the project. (Not on Windows, where no trial machine runs it.)
//
//   node tests/toolchain-test.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { HOST, entriesFrom, fetchPinned, formed, pinOf, readList } from "../scripts/toolchain.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const V = "8.0.404", RID = "linux-x64";
const url = (v = V, rid = RID) => `https://${HOST}/dotnet/Sdk/${v}/dotnet-sdk-${v}-${rid}.tar.gz`;

// (the core's own list, read whole, and the form each entry is held to)
const own = readList();
ok(own.length > 0, "the core's list, SDKS in scripts/toolchain.mjs, is read whole, each entry in its form", `${own.length} entries`);
const good = { version: V, rid: RID, url: url(), sha512: "a".repeat(128) };
ok(formed(good) === "", "an entry with the version, the machine, the publisher's own URL for both and a SHA-512 is formed");
const wrong = [{ ...good, url: url().replace(HOST, "example.com") }, { ...good, url: url().replace("https:", "http:") }, { ...good, url: url("8.0.405") },
  { ...good, sha512: "A".repeat(128) }, { ...good, sha512: "a".repeat(64) }, { ...good, version: "8.0" }, { ...good, version: "8.0.4xx" }, { ...good, rid: "win-x64" }, { ...good, extra: 1 }, { version: V }, null, []];
ok(wrong.every(e => formed(e) !== ""), "an entry whose URL is another host's, not HTTPS or another version's, whose sum is not a SHA-512 in lower case, whose version is a band, whose machine is not listed, or with a key more or fewer, is refused",
  wrong.filter(e => formed(e) === "").map(e => JSON.stringify(e)).join("; "));

const root = scratchDir("toolchain-test-");
const write = (file, text, mode) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); if (mode) fs.chmodSync(file, mode); return file; };
let threw = "";
try { readList([good, good]); } catch (e) { threw = e.message; }
ok(/stands twice/u.test(threw), "a list holding one version and machine twice is refused", threw);

// (the pin: global.json's sdk.version, exact; none, or one not read)
const pins = [[undefined, null], [JSON.stringify({ sdk: { version: V, rollForward: "disable" } }), { version: V }], [JSON.stringify({ "msbuild-sdks": {} }), null],
  ["{ not json", "wrong"], [JSON.stringify({ sdk: { version: "8.0.4xx" } }), "wrong"], [`﻿${JSON.stringify({ sdk: { version: V } })}`, { version: V }]];
ok(pins.every(([text, want], i) => {
  const dir = path.join(root, `pin-${i}`);
  fs.mkdirSync(dir, { recursive: true });
  if (text !== undefined) write(path.join(dir, "global.json"), text);
  const got = pinOf(dir);
  return want === "wrong" ? typeof got?.wrong === "string" : JSON.stringify(got) === JSON.stringify(want);
}), "the pin is the exact version global.json names, none where it names none or is not there, and not read where it is not JSON or names a band");

if (process.platform === "win32") { console.log("skip the fetches on Windows, where no trial machine runs them"); done("the toolchain a release's trial fetches"); }
else {
  // (an archive as the publisher gives one, a gzipped tar written here: a dotnet that says its version, and an SDK's
  // folder; each entry a ustar header and its content in blocks of 512 bytes, then two empty blocks)
  const tarOf = files => Buffer.concat([...files.flatMap(([name, text, mode]) => {
    const body = Buffer.from(text), head = Buffer.alloc(512);
    const put = (at, len, value) => head.write(value, at, len, "latin1");
    put(0, 100, name); put(100, 8, `${mode.toString(8).padStart(7, "0")}\0`); put(108, 8, "0000000\0"); put(116, 8, "0000000\0");
    put(124, 12, `${body.length.toString(8).padStart(11, "0")}\0`); put(136, 12, "00000000000\0"); put(148, 8, "        "); put(156, 1, "0"); put(257, 8, "ustar\u000000");
    put(148, 8, `${[...head].reduce((a, b) => a + b, 0).toString(8).padStart(6, "0")}\0 `);
    return [head, body, Buffer.alloc((512 - (body.length % 512)) % 512)];
  }), Buffer.alloc(1024)]);
  const archiveOf = (said, name) => {
    const file = write(path.join(root, `${name}.tar.gz`), zlib.gzipSync(tarOf([["./dotnet", `#!/bin/sh\n[ "$1" = "--version" ] && echo ${said}\n`, 0o755], [`./sdk/${said}/dotnet.dll`, "stand-in", 0o644]])));
    return { file, sum: crypto.createHash("sha512").update(fs.readFileSync(file)).digest("hex") };
  };
  // (each tool the script and the stand-ins need, found on the runner's PATH)
  const found = tool => process.env.PATH.split(path.delimiter).map(d => path.join(d, tool)).find(f => fs.existsSync(f));
  const right = archiveOf(V, "right"), other = archiveOf("8.0.100", "other");
  // (a bin holding a stand-in curl, which logs its arguments and copies the archive to -o, or fails as a refused host;
  // and, where asked, a stand-in dotnet of the machine's own that lists the pinned SDK)
  const bin = (name, { give, fail, machine } = {}) => {
    const dir = path.join(root, `bin-${name}`);
    const log = path.join(dir, "curl.log");
    write(path.join(dir, "curl"), `#!/bin/sh\necho "$@" >> "${log}"\n${fail ? `echo "curl: (56) CONNECT tunnel failed, response 403" >&2\nexit 56\n` : `while [ $# -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; shift; done\ncp "${give}" "$out"\n`}`, 0o755);
    if (machine) write(path.join(dir, "dotnet"), `#!/bin/sh\n[ "$1" = "--list-sdks" ] && echo "${V} [/usr/lib/dotnet/sdk]"\n`, 0o755);
    for (const tool of ["tar", "gzip", "sh", "cp"]) if (found(tool) && !fs.existsSync(path.join(dir, tool))) fs.symlinkSync(found(tool), path.join(dir, tool));
    return { env: { ...process.env, PATH: dir }, log: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8") : null) };
  };
  const project = (name, version = V) => { const dir = path.join(root, `project-${name}`); write(path.join(dir, "global.json"), JSON.stringify({ sdk: { version, rollForward: "disable" } })); return dir; };
  const home = name => path.join(root, `home-${name}`);
  const nothingIn = name => { const dir = path.join(home(name), ".agent-core", "toolchains"); return !fs.existsSync(dir) || fs.readdirSync(dir).length === 0; };
  const linux = { platform: "linux", arch: "x64" };

  const none = bin("none", { give: right.file });
  const noPin = fetchPinned({ project: path.join(root, "pin-0"), list: [], home: home("none"), env: none.env, ...linux });
  ok(/pins no toolchain/u.test(noPin.join()) && none.log() === null, "a project that pins no SDK fetches nothing", noPin.join());

  const unlisted = bin("unlisted", { give: right.file });
  const said = fetchPinned({ project: project("unlisted"), list: [], home: home("unlisted"), env: unlisted.env, ...linux }).join();
  ok(/^NOT FETCHED: the \.NET SDK 8\.0\.404 for linux-x64 \(the core's list, SDKS in scripts\/toolchain\.mjs, holds no checksum for it\)\. Mend: .*--entry/u.test(said) && unlisted.log() === null,
    "a pin the list holds no sum for is never fetched, and its mend says how the entry is added", said);

  const fetched = bin("fetched", { give: right.file });
  const at = { project: project("fetched"), list: [{ ...good, sha512: right.sum }], home: home("fetched"), env: fetched.env, ...linux };
  const first = fetchPinned(at).join(), sdk = path.join(home("fetched"), ".agent-core", "toolchains", `dotnet-sdk-${V}-${RID}`);
  ok(/^toolchain: the \.NET SDK 8\.0\.404 fetched to .*export DOTNET_ROOT=/u.test(first) && fs.existsSync(path.join(sdk, "dotnet")) && fs.existsSync(path.join(sdk, "sdk", V, "dotnet.dll")),
    "a listed pin is fetched to its own folder under the home folder, outside the project, checked by its sum, with what to set for the trial's runs", first);
  const curled = (fetched.log() ?? "").trim().split(" ");
  ok(curled.length === 10 && curled.slice(0, 8).join(" ") === "-fsS --proto =https --connect-timeout 30 --max-time 900 -o" && curled[9] === url(),
    "it fetches only the listed URL, over HTTPS alone", fetched.log());
  const again = fetchPinned(at).join();
  ok(/present in/u.test(again) && fetched.log().trim().split("\n").length === 1, "run twice, it finds the SDK present and fetches nothing again", again);

  const differs = bin("differs", { give: other.file });
  const bad = fetchPinned({ project: project("differs"), list: [{ ...good, sha512: right.sum }], home: home("differs"), env: differs.env, ...linux }).join();
  ok(/^NOT FETCHED: .*SHA-512 is [0-9a-f]{128}, not the list's .*Mend: tell the owner/u.test(bad) && nothingIn("differs"),
    "a download whose sum differs from the list's is never opened, and nothing is installed", bad);

  const refused = bin("refused", { fail: true });
  const host = fetchPinned({ project: project("refused"), list: [{ ...good, sha512: right.sum }], home: home("refused"), env: refused.env, ...linux }).join();
  ok(/^NOT FETCHED: .*did not give it: curl: \(56\).*only the owner can allow it.*reads alike before and after the update/u.test(host) && nothingIn("refused"),
    "a host the network refuses fetches nothing, and the mend says only the owner widens it", host);

  const lies = bin("lies", { give: other.file });
  const another = fetchPinned({ project: project("lies"), list: [{ ...good, sha512: other.sum }], home: home("lies"), env: lies.env, ...linux }).join();
  ok(/^NOT FETCHED: .*its dotnet gave "8\.0\.100"/u.test(another) && nothingIn("lies"), "a binary that gives another version is not installed", another);

  const machine = bin("machine", { give: right.file, machine: true });
  const kept = fetchPinned({ project: project("machine"), list: [{ ...good, sha512: right.sum }], home: home("machine"), env: machine.env, ...linux }).join();
  ok(/is the machine's own; nothing fetched/u.test(kept) && machine.log() === null, "where the machine's own dotnet lists the SDK, nothing is fetched", kept);

  const elsewhere = bin("elsewhere", { give: right.file });
  const mac = fetchPinned({ project: project("elsewhere"), list: [{ ...good, sha512: right.sum }], home: home("elsewhere"), env: elsewhere.env, platform: "darwin", arch: "arm64" }).join();
  ok(/^NOT FETCHED: .*darwin on arm64, is none the list holds sums for/u.test(mac) && elsewhere.log() === null, "a machine the list holds no sums for fetches nothing", mac);

  const within = bin("within", { give: right.file });
  const dir = project("within");
  const inside = fetchPinned({ project: dir, list: [{ ...good, sha512: right.sum }], home: dir, env: within.env, ...linux }).join();
  ok(/would stand inside the project/u.test(inside) && within.log() === null, "a home folder inside the project fetches nothing there", inside);

  // (the entries --entry prints, from the publisher's release notes)
  const notes = { releases: [{ sdks: [{ version: V, files: [{ rid: RID, url: url(), hash: "B".repeat(128) }, { rid: "linux-arm64", url: url(V, "linux-arm64"), hash: "c".repeat(128) }, { rid: "win-x64", url: "https://x", hash: "d" }] }] }] };
  const entries = entriesFrom(notes, V);
  ok(entries.length === 2 && entries.every(e => !formed(e)) && entries[0].sha512 === "b".repeat(128) && entriesFrom(notes, "8.0.405").length === 0 && entriesFrom({ releases: [{ sdks: [{ version: V, files: [{ rid: RID, url: "https://elsewhere/x.tar.gz", hash: "b".repeat(128) }] }] }] }, V).length === 0,
    "the entries read from the release notes are the two machines', in the list's form; none for a version the notes lack, nor for a URL not the publisher's own", JSON.stringify(entries));

  done("the toolchain a release's trial fetches");
}
