// Hostile tests for one input the core reads (floor topic 5, "Every named input has hostile tests"): what a package
// brings, from a registry or installed, which its publisher writes: an npm package's own package.json and licence
// files, installed or copied into a project, a NuGet package's file with its manifest (.nuspec) and content hash,
// Node's own tarball, and what a registry or GitHub answers of a package, read by lookup.mjs from answers made here. Read by licence-installed.mjs, licence-scan.mjs (with licence-pages.mjs, which it reads a page by), licences.mjs (licenceOk, on the licence npm
// copies from a package), nuget.mjs (manifestLicence), nuget-fetch.mjs (nuspecOf, contentHash, named, and fetchAll
// from a folder source, so no network) and node.sh (its SHA-256 check, with a stand-in npm that hands it a tarball made
// here). Each case is refused: a licence it cannot read is not allowed, a version it cannot read is no version, a path
// that leaves the folder is never written, and a failure says its mend. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/hostile-packages-test.mjs
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";
import { check as installed } from "../scripts/licence-installed.mjs";
import { scan } from "../scripts/licence-scan.mjs";
import { licenceOk } from "../scripts/licences.mjs";
import { quick, said, scratch } from "../scripts/hostile.mjs";
import { manifestLicence } from "../scripts/nuget.mjs";
import { contentHash, fetchAll, named, nuspecOf } from "../scripts/nuget-fetch.mjs";
import { lookUp, npmFacts, repository } from "../scripts/lookup.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const { tmp, fresh } = scratch("hostile-packages-test");
// (the samples' commands and notices are built from pieces, so the core's own licence scan, which reads this file, does
// not take them for its own)
const word = (...parts) => parts.join("");
const NPM = word("np", "m");
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
const ALLOW = new Set(["MIT"]);
// an installed package: the lock file names moss-a at 1.0.0 under MIT, and node_modules holds `own` as its package.json
const LINUX = { os: "linux", cpu: "x64", libc: "glibc" };
const lockOf = (packages) => JSON.stringify({ lockfileVersion: 3, packages: { "": {}, ...packages } });
const one = (own, lock = { version: "1.0.0", license: "MIT" }) => installed(fresh({ "package-lock.json": lockOf({ "node_modules/moss-a": lock }), ...(own === undefined ? {} : { "node_modules/moss-a/package.json": typeof own === "string" ? own : JSON.stringify(own) }) }), LINUX);
// a zip, as a NuGet package file is one: each [name, text, deflated]
function zip(files) {
  const locals = [], centrals = [];
  let at = 0;
  for (const [name, text, deflate = true] of files) {
    const raw = Buffer.from(text), data = deflate ? deflateRawSync(raw) : raw, nm = Buffer.from(name), head = Buffer.alloc(30), central = Buffer.alloc(46);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(deflate ? 8 : 0, 8); head.writeUInt32LE(crc32(raw), 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(raw.length, 22); head.writeUInt16LE(nm.length, 26);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(deflate ? 8 : 0, 10); central.writeUInt32LE(crc32(raw), 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nm.length, 28); central.writeUInt32LE(at, 42);
    locals.push(head, nm, data); centrals.push(central, nm);
    at += 30 + nm.length + data.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(at, 16);
  return Buffer.concat([...locals, dir, end]);
}
const nuspec = (licence, id = "Moss.A") => `<?xml version="1.0" encoding="utf-8"?><package><metadata><id>${id}</id><version>1.0.0</version><license type="expression">${licence}</license></metadata></package>`;
// the fetch, from a folder source holding `file` as moss.a.1.0.0.nupkg, held to the lock's content hash `hash` (the
// file's own, where none is given): { failures, written }, written being every file under the scratch folder it made
const fetch = async (file, hash) => {
  const root = fresh({ "packages.lock.json": JSON.stringify({ version: 1, dependencies: { net9: { "Moss.A": { type: "Direct", resolved: "1.0.0", requested: "[1.0.0]", contentHash: hash ?? createHash("sha512").update(file).digest("base64") } } } }) });
  const source = path.join(root, "feed"), into = path.join(root, "into");
  fs.mkdirSync(source);
  if (typeof file === "function") file(path.join(source, "moss.a.1.0.0.nupkg")); else fs.writeFileSync(path.join(source, "moss.a.1.0.0.nupkg"), file);
  const before = new Set(fs.readdirSync(tmp, { recursive: true }));
  const r = await fetchAll({ nuget: { ships: ["packages.lock.json"] } }, root, ["packages.lock.json"], into, [source]);
  return { ...r, written: fs.readdirSync(tmp, { recursive: true }).filter((f) => !before.has(f)) };
};
const refusedFetch = (r) => r.failures.length === 1 && said(r.failures) && r.written.length === 0;
// the licence scan on a project of tracked files, its audit empty
const scanned = (files) => {
  const dir = fresh(files);
  for (const a of [["init", "-q"], ["add", "-A"]]) execFileSync("git", a, { cwd: dir, stdio: "ignore" });
  return scan({ served: [] }, dir, [], "audit.json", []);
};

// ---- too long ----
{
  ok(quick(() => !licenceOk(`${"MIT AND ".repeat(50000)}Moss-1.0`, ALLOW) && !licenceOk(`${"(".repeat(20000)}MIT${")".repeat(20000)}`, ALLOW)), "an SPDX expression of fifty thousand terms, one off the list, or nested twenty thousand deep, is not allowed, in a few seconds");
  const long = `${"MIT OR ".repeat(150000)}Moss-1.0 AND Moss-2.0`;
  ok(quick(() => !licenceOk(manifestLicence(nuspec(long)).expression, ALLOW)), "a NuGet manifest's licence a megabyte long is read, and not allowed");
  ok(quick(() => manifestLicence(`<package><metadata>${"<a>".repeat(50000)}${"</a>".repeat(50000)}</metadata></package>`).expression === undefined), "a manifest nested fifty thousand deep gives no licence");
  let r = one({ version: "1.0.0", license: "x".repeat(5_000_000) });
  ok(r.failures.length === 1 && said(r.failures) && r.failures[0].length < 1000, "a package's licence five megabytes long fails with its mend, shown cut short");
  const away = Object.fromEntries(Array.from({ length: 30000 }, (_, i) => [`node_modules/moss-${i}`, { version: "1.0.0", license: "MIT", optional: true, os: ["moss-os"] }]));
  ok(quick(() => (r = installed(fresh({ "package-lock.json": lockOf(away) }), LINUX)).failures.length === 0 && /30000 of another system/u.test(r.summary)), "thirty thousand optional packages of another system are counted, not read, in a few seconds");
  const bomb = zip([["Moss.A.nuspec", " ".repeat(32 << 20)]]);
  ok(refusedFetch(await fetch(bomb)), "a NuGet package whose manifest inflates past sixteen megabytes is refused with its mend, and nothing is written");
  ok(quick(() => (r = scanned({ "vendor/moss/LICENSE.txt": `${word("Copy", "right")} 2026 Moss\n`.repeat(150000), "vendor/moss/moss.min.js": `${word("/", "*!")} ${word("@lic", "ense")} MIT */${"x;".repeat(1_500_000)}` })).failures.length === 1 && said(r.failures)), "the licence scan reads a vendored package's licence text and code of megabytes, failing its notice with its mend");
}

// ---- the wrong type ----
{
  ok([5, { type: { type: "MIT" } }, [{ type: "MIT" }], { name: "MIT" }, null, true].every((l) => !licenceOk(l, ALLOW)), "a package's licence given as a number, an object, a list of objects, null or true is not allowed");
  ok([5, [{ type: "MIT" }], ["MIT"], { url: "x" }].every((l) => { const f = one({ version: "1.0.0", license: l }).failures; return f.length === 1 && said(f); }), "a package whose own licence is a number, a list or an object with no type, where the lock says MIT, fails with its mend");
  ok(["[]", "5", '"MIT"', "null"].every((t) => said(one(t).failures)), "a package.json that is a list, a number, a text or null cannot be read, and fails with its mend");
  ok(said(one({ version: 1, license: "MIT" }, { version: "1", license: "MIT" }).failures), "a package's version given as a number is not the lock's text");
  for (const [what, entry] of [["a text", "1.0.0"], ["a list", [{ version: "1.0.0" }]], ["null", null], ["a number", 5]]) {
    const r = installed(fresh({ "package-lock.json": lockOf({ "node_modules/moss-a": entry }) }), LINUX);
    ok(r.failures.length === 1 && said(r.failures) && /not read/u.test(r.summary), `a lock entry that is ${what}, not written as npm writes one, is refused with its mend, and nothing of the lock read`);
  }
  ok(["not a zip", "PK\u0005\u0006"].every((b) => throws(() => contentHash(Buffer.from(b))) && throws(() => nuspecOf(Buffer.from(b)))), "bytes that are no zip have no content hash and no manifest");
  ok(refusedFetch(await fetch(Buffer.from("not a zip at all"))), "a NuGet package file that is no zip is refused with its mend, and nothing is written");
  const broken = zip([["Moss.A.nuspec", nuspec("MIT")]]);
  broken.writeUInt32LE(0x7fffffff, broken.length - 6);
  ok(refusedFetch(await fetch(broken)), "a zip whose directory lies past its end is refused with its mend, not a raw error");
  ok(manifestLicence(5).expression === undefined && manifestLicence(null).expression === undefined && named("<package>") === null, "a manifest that is no text gives no licence, and one with no metadata names no id");
}

// ---- markup ----
{
  ok(["<b>MIT</b>", "MIT<script>", "MIT\n::error::x"].every((l) => !licenceOk(l, ALLOW)), "a licence holding markup or a line break and a workflow command is not allowed");
  ok(["<b>MIT</b>", "MIT&lt;x", "<![CDATA[MIT]]>"].every((l) => manifestLicence(nuspec(l)).expression === undefined) && manifestLicence(`<!DOCTYPE p [<!ENTITY e "MIT">]>${nuspec("&e;")}`).expression === undefined, "a manifest's licence holding an element, a reference or CDATA, or a manifest with a document type, gives no licence");
  ok(named(`<package><metadata><id>Moss.A</id><![CDATA[<id>Other</id>]]><version>1.0.0</version></metadata></package>`) === null, "a manifest with CDATA names no id and version");
  const f = one({ version: "1.0.0", license: "MIT\n::error::spoof" }).failures;
  ok(f.length === 1 && said(f) && !f[0].includes("\n"), "a package's licence holding a line break fails, its failure kept on one line");
  const html = scanned({ "vendor/moss/LICENSE.html": `<p>MIT</p><script>${word("np", "x")} -y moss-evil</script>` }).failures;
  ok(html.some((x) => /moss-evil cannot be audited/u.test(x)) && said(html), "the licence scan reads a script in a vendored licence page as code, and fails what it fetches with its mend");
}

// ---- a file path ----
{
  for (const name of ["../Moss.A.nuspec", "/Moss.A.nuspec", "lib/Moss.A.nuspec"]) ok(throws(() => nuspecOf(zip([[name, nuspec("MIT")]]))), `a manifest named ${name} is not at the package's root, and is not read`);
  ok(refusedFetch(await fetch(zip([["../Moss.A.nuspec", nuspec("MIT")]]))), "a package whose manifest is named outside its root is refused with its mend, and nothing is written");
  const outside = path.join(tmp, "outside.nupkg");
  fs.writeFileSync(outside, zip([["Moss.A.nuspec", nuspec("MIT")]]));
  ok(refusedFetch(await fetch((at) => fs.symlinkSync(outside, at), createHash("sha512").update(fs.readFileSync(outside)).digest("base64"))), "a package file in a folder source that is a link out of it is not read, and fails with its mend");
  ok(["node_modules/../../x", "/etc/moss", "node_modules\\moss"].every((p) => installed(fresh({ "package-lock.json": lockOf({ [p]: { version: "1.0.0", license: "MIT" } }) }), LINUX).failures.length === 1), "a lock entry whose path leaves the folder, starts at the root or holds a backslash is refused, and no package.json is read for it");
  const linked = installed(fresh({ "package-lock.json": lockOf({ "node_modules/moss-a": { link: true, resolved: "../outside" } }) }), LINUX).failures;
  ok(linked.length === 1 && said(linked), "a package linked to a folder outside the project is not read, and fails with its mend");
}

// ---- a number out of range ----
{
  ok(["99999999999999999999.0.0", "-1", "1.0.0.0.0", "Infinity"].every((v) => { const f = one({ version: v, license: "MIT" }).failures; return f.length === 1 && said(f); }), "a package whose own version is out of range, where the lock says 1.0.0, fails with its mend");
  const zipped = zip([["Moss.A.nuspec", nuspec("MIT")]]);
  zipped.writeUInt16LE(0xffff, zipped.length - 12);
  ok(throws(() => nuspecOf(zipped)) && refusedFetch(await fetch(zipped)), "a zip that counts more entries than it holds is refused with its mend, not a raw error");
  ok(refusedFetch(await fetch(zip([["Moss.A.nuspec", nuspec("MIT")]]), "A".repeat(88))), "a package file whose content hash is not its lock's is refused with its mend, and nothing is written");
}

// ---- nothing at all ----
{
  ok(said(one("").failures) && said(one(undefined).failures), "an empty package.json, or none, fails with its mend");
  ok(!licenceOk("", ALLOW) && !licenceOk(undefined, ALLOW) && manifestLicence("").expression === undefined && manifestLicence(nuspec("")).expression === undefined, "an empty licence, a missing one, or an empty manifest gives nothing that is allowed");
  ok(refusedFetch(await fetch(Buffer.alloc(0))), "an empty package file is refused with its mend, and nothing is written");
  ok(throws(() => nuspecOf(zip([]))) && refusedFetch(await fetch(zip([]))), "a package file holding no manifest is refused with its mend");
  ok(said(scanned({ "vendor/moss/package.json": "" }).failures), "a vendored package's empty package.json fails the scan with its mend");
}

// ---- Node's own tarball (node.sh) ----
// A stand-in npm, or with no npm a stand-in curl, hands node.sh a tarball made here; a stand-in node stands where the
// machine's would, below the least long-term line. Each tarball is hostile, so the SHA-256 check refuses it: nothing is
// installed, the stand-in node is left as it was, nothing lands outside the script's own folder, and the script exits 0
// saying so. A node at or above the least is kept and nothing is fetched; a version or a least that is no number keeps
// nothing; with no node, nothing is fetched where it could not go. The PATH holds only the stand-ins and the system's
// own tools, so the runner's node, npm and curl are never found. (Not on Windows, which runs no node.sh.)
if (process.platform !== "win32") {
  const script = fileURLToPath(new URL("../scripts/node.sh", import.meta.url));
  const want = /^\s*([0-9.]+)-x86_64\)/mu.exec(fs.readFileSync(script, "utf8"))?.[1];
  const sys = path.join(tmp, "sys");
  fs.mkdirSync(sys);
  for (const tool of ["bash", "tr", "uname", "readlink", "mktemp", "tar", "gzip", "sha256sum", "cp", "chmod", "mv", "rm", "cat", "touch"]) {
    const at = spawnSync("bash", ["-c", `command -v ${tool}`], { encoding: "utf8" }).stdout.trim();
    if (at) fs.symlinkSync(at, path.join(sys, tool));
  }
  const CURL = word("cu", "rl");
  const fetchers = {
    [NPM]: '#!/bin/sh\ntouch "$MARK"; [ "$1" = pack ] && cp "$TARBALL" ./node-linux-moss.tgz\n',
    [CURL]: '#!/bin/sh\ntouch "$MARK"; echo "$@" >"$MARK"; while [ $# -gt 0 ]; do [ "$1" = -o ] && out=$2; shift; done; cp "$TARBALL" "$out"\n',
  };
  // a scratch project with core/'s two Node files (each left out where null) and the bin/ files given, run once
  const run = ({ least = "22", node = "v0.0.1", bin = {}, tarball = "" } = {}) => {
    const files = { "core/.node-version": `${want}\n`, "tmp/.keep": "", ...(least === null ? {} : { "core/.node-least": `${least}\n` }), ...(node === null ? {} : { "bin/node": `#!/bin/sh\necho ${node}\n` }) };
    for (const [name, text] of Object.entries(bin)) files[`bin/${name}`] = text;
    const root = fresh(files);
    for (const f of Object.keys(files).filter((f) => f.startsWith("bin/"))) fs.chmodSync(path.join(root, f), 0o755);
    const mark = path.join(root, "fetched");
    const r = spawnSync(path.join(sys, "bash"), [script], { cwd: root, encoding: "utf8", timeout: 20000, env: { PATH: `${path.join(root, "bin")}:${sys}`, TARBALL: tarball, MARK: mark, TMPDIR: path.join(root, "tmp") } });
    return { root, r, fetched: fs.existsSync(mark) ? fs.readFileSync(mark, "utf8") : null, node: () => fs.readFileSync(path.join(root, "bin/node"), "utf8") };
  };
  const tries = {
    "a binary of other bytes": (d) => fs.writeFileSync(path.join(d, "package/bin/node"), `#!/bin/sh\necho v${want}\n`, { mode: 0o755 }),
    "a binary that is a link out of the package": (d) => { fs.writeFileSync(path.join(tmp, "elsewhere"), `#!/bin/sh\necho v${want}\n`); fs.symlinkSync(path.join(tmp, "elsewhere"), path.join(d, "package/bin/node")); },
    "no binary at all": () => {},
    "a binary beside a file whose name leaves the folder": (d) => { fs.writeFileSync(path.join(d, "package/bin/node"), "x"); fs.writeFileSync(path.join(d, "escape"), "x"); },
  };
  for (const [what, make] of Object.entries(tries)) {
    const stage = fs.mkdtempSync(path.join(tmp, "stage-"));
    fs.mkdirSync(path.join(stage, "package/bin"), { recursive: true });
    make(stage);
    const tarball = `${stage}.tgz`, members = what.includes("leaves") ? ["package", "--transform=s,^escape,../escape,", "escape"] : ["package"];
    execFileSync("tar", ["czf", tarball, "-C", stage, ...members], { stdio: "ignore" });
    for (const [by, text] of Object.entries(fetchers)) {
      const { root, r, fetched, node } = run({ bin: { [by]: text }, tarball });
      ok(r.status === 0 && fetched !== null && /NOT INSTALLED/u.test(r.stdout) && node().includes("v0.0.1") && !fs.existsSync(path.join(root, "tmp/escape")) && !fs.existsSync(path.join(tmp, "escape")), `node.sh refuses Node's tarball with ${what}, fetched by ${by}: nothing installed, the machine's node kept`);
    }
  }
  const curled = run({ bin: { [CURL]: fetchers[CURL] } }).fetched?.trim(), arch = process.arch === "arm64" ? "arm64" : "x64";
  ok(curled === `-fsS --proto =https --connect-timeout 30 --max-time 600 -o node-linux-${arch}.tgz https://registry.npmjs.org/node-linux-${arch}/-/node-linux-${arch}-${want}.tgz`, `with no ${NPM}, node.sh fetches only the pin, only from the registry's own address, over HTTPS alone`);
  for (const [what, opts] of Object.entries({ "at the least long-term line": { node: "v22.0.0" }, "above it": { node: "v24.1.0" } })) {
    const { r, fetched, node } = run({ ...opts, bin: { [NPM]: fetchers[NPM] } });
    ok(r.status === 0 && fetched === null && new RegExp(`present, at or above the least long-term line, 22 \\(the checks run the pin, ${want.replaceAll(".", "\\.")}\\)`, "u").test(r.stdout) && node().includes(opts.node), `node.sh keeps a machine's node ${what} and fetches nothing`);
  }
  for (const [what, opts] of Object.entries({ "no .node-least": { least: null, node: "v99.0.0" }, "a .node-least that is no number": { least: "2x", node: "v99.0.0" }, "a .node-least of a sign and a number": { least: "-1", node: "v22.0.0" }, "a version that is no number": { node: "vxx.0.0" }, "a version with no v": { node: "99.0.0" }, "a version too long to compare": { node: "v99999999999999999999999.0.0" } })) {
    const { r, fetched } = run({ ...opts, bin: { [NPM]: fetchers[NPM] } });
    ok(r.status === 0 && fetched !== null && !/present/u.test(r.stdout), `node.sh keeps no node by ${what}: it fetches the pin`);
  }
  {
    const { r, fetched } = run({ node: null, bin: { [CURL]: fetchers[CURL] } });
    ok(r.status === 0 && fetched === null && /NOT INSTALLED: .*not on PATH/u.test(r.stdout), "with no node and /usr/local/bin not on PATH, node.sh fetches nothing and says where the pin would have gone");
  }
  {
    const none = run({ node: "v24.1.0", bin: {} }).r, some = run({ node: "v24.1.0", bin: { [NPM]: fetchers[NPM] } }).r;
    ok(none.status === 0 && /^note: npm is not here, and this script brings Node alone\. Mend: install npm beside Node/mu.test(none.stdout) && !/npm is not here/u.test(some.stdout), "node.sh says, with its mend, that it brings Node alone where the machine has no npm, and says nothing where it has one");
  }
  {
    const { r, fetched } = run({ bin: {} });
    ok(r.status === 0 && fetched === null && /NOT INSTALLED: .*no curl/u.test(r.stdout), `with no ${NPM} and no ${CURL}, node.sh fetches nothing and says so`);
  }
}

// What a registry or GitHub answers of a package (lookup.mjs): a publisher writes the repository it names and its own
// name, so a folder or owner that leads up is not followed, an answer of another shape is a lookup that failed, and
// whatever is printed stays on one line, never a command the workflow's log acts on.
{
  const pkg = { name: "hostile-moss", version: "1.0.0", path: "node_modules/hostile-moss", direct: true, brings: 0, lockPath: "package-lock.json" };
  const now = Date.parse("2026-11-16T12:00:00Z"), old = new Date(now - 800 * 86400000).toISOString();
  ok(repository({ url: "https://github.com/a/b", directory: "../../etc" })?.dir === "" && repository({ url: "https://github.com/../b" })?.owner === undefined && repository({ url: "https://github.com/a/b/../../c" })?.owner === undefined && repository({ url: "https://github.com/someone/.." })?.owner === undefined && repository("someone/.")?.owner === undefined, "lookup: a repository's folder or owner that leads up is not followed");
  let threw = 0;
  for (const doc of [null, [], "text", { time: { created: 5 }, versions: {} }, { time: { created: "yesterday" }, versions: {} }]) { try { npmFacts(doc, "1.0.0"); } catch { threw++; } }
  ok(threw === 5, "lookup: an answer that is no object, or whose first date is no date, is refused");
  const asked = [];
  const answer = (doc) => async (url) => { asked.push(url); return url.startsWith("https://registry.npmjs.org/") ? { status: 200, json: doc } : { status: 200, json: { archived: "yes", name: ["hostile-moss"] } }; };
  const doc = { time: { created: old, "1.0.0": old, modified: "never" }, versions: { "1.0.0": { _npmUser: { name: `x\n::error::y%0A${"z".repeat(500)}` }, repository: { url: "https://github.com/evil-org/moss", directory: "a/../../../b" }, dist: { attestations: "anything" } } } };
  const r = await lookUp([pkg], { get: answer(doc), now });
  const line = r.reports[0] ?? "";
  ok(r.failures.length === 0 && !/[\r\n]/u.test(line) && !line.includes("::error::y%0A") && line.length < 700, `lookup: a publisher's name is printed cut short, on one line, with nothing GitHub reads as a command (${line.slice(0, 120)})`);
  ok(asked.includes("https://raw.githubusercontent.com/evil-org/moss/HEAD/package.json") && line.includes("archived or not: GitHub did not answer") && line.includes("not naming the package back"), "lookup: a folder that leads up is not fetched, and GitHub's answers of another shape say nothing");
  const pages = [{ "@id": "https://api.nuget.org.evil.invalid/page.json", lower: "1.0.0", upper: "2.0.0" },
    { "@id": "https://api.nuget.org/v3/registration5-gz-semver2/hostile.moss/page/1.0.0/../../../../evil.json", lower: "1.0.0", upper: "../../evil" },
    { "@id": "https://api.nuget.org/v3/registration5-gz-semver2/hostile.moss/page/1.0.0/2.0.0.json", lower: "1.0.0", upper: ["2.0.0"] }];
  for (const item of pages) {
    asked.length = 0;
    const astray = await lookUp([{ ...pkg, name: "Hostile.Moss" }], { get: async (url) => { asked.push(url); return { status: 200, json: { items: [item] } }; }, now, nuget: true });
    ok(astray.failures.length === 1 && /outside the registry/u.test(astray.failures[0]) && asked.length === 1, `lookup: a page of NuGet's versions an answer places elsewhere, or names in another form, is not fetched (${item["@id"]})`);
  }
  const future = await lookUp([pkg], { get: answer({ ...doc, time: { created: "9999-01-01T00:00:00Z" } }), now });
  ok(future.failures.length === 1 && /under the 90 days/u.test(future.failures[0]), "lookup: a first date in the future is no age that passes");
}

console.log(failed ? `${failed} failing` : "ok   every hostile thing a package brings is refused");
process.exit(failed ? 1 : 0);
