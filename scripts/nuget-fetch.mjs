// The NuGet check's packages, fetched before the restore (.github/workflows/nuget.yml; core archive 201), so that the
// licence of each is read from a file no pull request's build could have written: the restore runs the pull request's
// own build files, which could change anything in the job after it. For every package the lock files the config names
// hold (nuget.mjs, beside this file, reads them), and every tool a manifest of dotnet's names (.config/dotnet-tools.json),
// it fetches the package file from NuGet's own registry, or else from a source the config's "nuget.sources" names
// (an https address of a NuGet v3 feed, or a folder of the project's own), holds a locked package to the content hash
// its lock file names (NuGet's own SHA-512 of the package file, a signed one's read without its signature, as NuGet
// reads it), takes the manifest (.nuspec) out of it, and writes it
// into a folder laid out as a restore lays out its own, with NuGet's record of where it took it from beside it
// (.nupkg.metadata), for `nuget.mjs <config> --packages <that folder> --fetched` to read before the restore begins.
//   It fails a locked package whose file is not what its lock file names, a tool whose manifest names no one exact
// version, and a package or tool it can find nowhere it may look (a registry that cannot be reached among them, which a
// restore could not reach either). A package that only a source of another kind holds (a feed of NuGet's older form) is
// left to the check after the restore, and said so. A tool's file has no content hash to hold it to: it is the one the
// registry, or the first source that holds it, gives. Node's own modules only; the network for the registry and the
// sources named. It reads and writes only the folder it is given.
//
//   node core/scripts/nuget-fetch.mjs <config> --into <a folder of its own>
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./licences.mjs";
import { REGISTRY, lockPackages, nugetConfig, sourcesOf } from "./nuget.mjs";
import { started } from "./started.mjs";

const FLAT = "https://api.nuget.org/v3-flatcontainer/"; // the registry's own address for package files
const TOOLS = "dotnet-tools.json";
const EXACT = /^[0-9]+(\.[0-9]+){1,3}(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/u; // one version, no range
const ID = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/u;
const shown = (text) => String(text).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/gu, "?");

/** The manifest (.nuspec) at the root of a package file, as text; throws where the file is no package this reads. */
export function nuspecOf(zip) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]), Math.max(0, zip.length - 22));
  if (end < 0 || zip.length - end > 22 + 65535) throw new Error("no zip's end of directory");
  const entries = zip.readUInt16LE(end + 10), dirAt = zip.readUInt32LE(end + 16);
  if (entries === 0xffff || dirAt === 0xffffffff) throw new Error("a zip of the 64-bit form, which this does not read");
  const found = [];
  for (let at = dirAt, i = 0; i < entries; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error("a zip whose directory this does not read");
    const method = zip.readUInt16LE(at + 10), size = zip.readUInt32LE(at + 20), nameLen = zip.readUInt16LE(at + 28);
    const extraLen = zip.readUInt16LE(at + 30), commentLen = zip.readUInt16LE(at + 32), local = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLen).toString("utf8");
    if (!name.includes("/") && name.toLowerCase().endsWith(".nuspec")) found.push({ method, size, local });
    at += 46 + nameLen + extraLen + commentLen;
  }
  if (found.length !== 1) throw new Error(`${found.length} manifests at the package's root, where it holds one`);
  const { method, size, local } = found[0];
  if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error("a zip whose entry this does not read");
  const data = zip.subarray(local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)).subarray(0, size);
  if (method === 0) return data.toString("utf8");
  if (method === 8) return inflateRawSync(data).toString("utf8");
  throw new Error(`a manifest packed in a way this does not read (method ${method})`);
}

/** The tools a manifest of dotnet's names: { tools: [{ id, version }], failures }. */
export function toolsOf(text, at) {
  let manifest;
  try { manifest = JSON.parse(text); } catch { return { tools: [], failures: [`${at} is not JSON`] }; }
  const tools = [], failures = [];
  for (const [id, entry] of Object.entries(manifest?.tools ?? {})) {
    if (!ID.test(id)) { failures.push(`${at}: ${shown(id)}: no tool id it can read`); continue; }
    if (typeof entry?.version !== "string" || !EXACT.test(entry.version)) { failures.push(`${at}: ${id}: no one exact version (${shown(JSON.stringify(entry?.version))}): name the one version it runs (floor rule 7)`); continue; }
    tools.push({ id, version: entry.version });
  }
  return { tools, failures };
}

const sha512 = (bytes) => createHash("sha512").update(bytes).digest("base64");
/**
 * A package file's content hash as NuGet writes it in a lock file: SHA-512 of the file, save that a signed package
 * (one holding .signature.p7s, as every package of NuGet's registry does) is hashed as though that entry were not in
 * it, its other entries' offsets and the directory's counts, size and offset moved to match, as NuGet's own
 * SignedPackageArchiveUtility reads it. Throws where the file is no zip this reads.
 */
export function contentHash(zip) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]), Math.max(0, zip.length - 22));
  if (end < 0) throw new Error("no zip's end of directory");
  const count = zip.readUInt16LE(end + 10), dirAt = zip.readUInt32LE(end + 16);
  const records = [];
  for (let at = dirAt, i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error("a zip whose directory this does not read");
    const size = 46 + zip.readUInt16LE(at + 28) + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    records.push({ position: at, size, offset: zip.readUInt32LE(at + 42), name: zip.subarray(at + 46, at + 46 + zip.readUInt16LE(at + 28)).toString("utf8") });
    at += size;
  }
  const signature = records.find((r) => r.name === ".signature.p7s");
  if (!signature) return sha512(zip);
  const byOffset = [...records].sort((a, b) => a.offset - b.offset);
  byOffset.forEach((r, i) => { r.entrySize = (byOffset[i + 1]?.offset ?? dirAt) - r.offset; });
  const h = createHash("sha512"), u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }, u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
  const rest = byOffset.filter((r) => r !== signature);
  h.update(zip.subarray(0, byOffset[0].offset));
  for (const r of rest) h.update(zip.subarray(r.offset, r.offset + r.entrySize));
  for (const r of rest.sort((a, b) => a.position - b.position)) {
    h.update(zip.subarray(r.position, r.position + 42));
    h.update(u32(r.offset - (r.offset > signature.offset ? signature.entrySize : 0)));
    h.update(zip.subarray(r.position + 46, r.position + r.size));
  }
  h.update(zip.subarray(end, end + 8));
  h.update(u16(zip.readUInt16LE(end + 8) - 1));
  h.update(u16(zip.readUInt16LE(end + 10) - 1));
  h.update(u32(zip.readUInt32LE(end + 12) - signature.size));
  h.update(u32(zip.readUInt32LE(end + 16) - signature.entrySize));
  h.update(zip.subarray(end + 20));
  return h.digest("base64");
}
async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
// Where a v3 feed keeps its package files, from its own index; null where the source is no feed of that form.
const bases = new Map();
async function baseOf(source) {
  if (source === REGISTRY) return FLAT;
  if (!bases.has(source)) {
    let base = null;
    try {
      const index = JSON.parse((await get(source))?.toString("utf8") ?? "{}");
      base = (index.resources ?? []).find((r) => typeof r?.["@type"] === "string" && r["@type"].startsWith("PackageBaseAddress/3.0.0"))?.["@id"] ?? null;
      if (base && !base.endsWith("/")) base += "/";
      if (base && !base.startsWith("https://")) base = null;
    } catch { base = null; }
    bases.set(source, base);
  }
  return bases.get(source);
}
// A package's file from one source: its bytes, or null where that source does not hold it, or undefined where the
// source is of a kind this cannot read.
async function fromSource(source, id, version) {
  const lid = id.toLowerCase(), lv = version.toLowerCase();
  if (!source.startsWith("https://")) {
    const files = (dir) => { try { return readdirSync(dir); } catch { return []; } };
    const flat = files(source).find((f) => f.toLowerCase() === `${lid}.${lv}.nupkg`);
    if (flat) return readFileSync(join(source, flat));
    const nested = join(source, lid, lv, `${lid}.${lv}.nupkg`);
    return existsSync(nested) ? readFileSync(nested) : null;
  }
  const base = await baseOf(source);
  if (!base) return undefined;
  return get(`${base}${encodeURIComponent(lid)}/${encodeURIComponent(lv)}/${encodeURIComponent(lid)}.${encodeURIComponent(lv)}.nupkg`);
}

/** Every package and tool, fetched into `into`: { failures, notes, summary }. */
export async function fetchAll(config, root, tracked, into, sources = sourcesOf(config, root)) {
  const { ships, tools: toolLocks } = nugetConfig(config);
  const failures = [], notes = [], wanted = new Map();
  for (const f of [...ships, ...toolLocks].filter((l) => tracked.includes(l))) {
    const read = lockPackages(readFileSync(join(root, f), "utf8"), f);
    failures.push(...read.failures);
    for (const p of read.packages) wanted.set(`${p.id}@${p.version}`.toLowerCase(), { ...p, from: f });
  }
  for (const f of tracked.filter((t) => !t.startsWith("core/") && posix.basename(t) === TOOLS)) {
    const read = toolsOf(readFileSync(join(root, f), "utf8"), f);
    failures.push(...read.failures);
    for (const t of read.tools) if (!wanted.has(`${t.id}@${t.version}`.toLowerCase())) wanted.set(`${t.id}@${t.version}`.toLowerCase(), { ...t, from: f, tool: true });
  }
  let fetched = 0;
  for (const p of wanted.values()) {
    const name = `${p.id}@${p.version} (${p.from})`;
    let bytes = null, taken = null, unread = false;
    for (const source of sources) {
      let got;
      try { got = await fromSource(source, p.id, p.version); } catch (e) { failures.push(`${name}: ${source} could not be read (${shown(e.message)})`); bytes = null; break; }
      if (got === undefined) { unread = true; continue; }
      if (got) { bytes = got; taken = source; break; }
    }
    if (!bytes) {
      if (unread) notes.push(`${name}: held by no source this reads before the restore (a feed not of NuGet's v3 form): its licence is read after the restore`);
      else if (!failures.some((f) => f.startsWith(name))) failures.push(`${name}: in neither NuGet's registry nor a source the config names`);
      continue;
    }
    let hashed;
    try { hashed = contentHash(bytes); } catch (e) { failures.push(`${name}: ${shown(e.message)}`); continue; }
    if (!p.tool && hashed !== p.contentHash) { failures.push(`${name}: the file ${taken} gives is not the one its lock file names by its content hash (floor rule 15)`); continue; }
    let nuspec;
    try { nuspec = nuspecOf(bytes); } catch (e) { failures.push(`${name}: ${shown(e.message)}`); continue; }
    const dir = join(into, p.id.toLowerCase(), p.version.toLowerCase());
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${p.id.toLowerCase()}.nuspec`), nuspec);
    writeFileSync(join(dir, ".nupkg.metadata"), JSON.stringify({ version: 2, contentHash: hashed, source: taken }));
    fetched++;
  }
  return { failures, notes, summary: `${fetched} of ${wanted.size} NuGet packages and tools fetched before the restore, each held to its lock file's content hash where it has one; ${failures.length} failing` };
}

if (started(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf("--into");
  const fail = (msg) => { console.error(`FAIL: ${shown(msg)}`); process.exit(1); };
  const configPath = args.find((a, i) => !a.startsWith("--") && i !== at + 1), into = at >= 0 ? args[at + 1] : undefined;
  if (!configPath || !into) fail("name the config and a folder of its own: node core/scripts/nuget-fetch.mjs <config> --into <folder>");
  let result;
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: fileURLToPath(new URL(".", import.meta.url)), encoding: "utf8" }).trim();
    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
    mkdirSync(into, { recursive: true });
    result = await fetchAll(loadConfig(configPath), root, tracked, into);
  } catch (e) { fail(e.message); }
  for (const n of result.notes) console.log(`note ${shown(n)}`);
  for (const f of result.failures) console.error(`FAIL: ${shown(f)}`);
  console.log(result.summary);
  process.exit(result.failures.length ? 1 : 0);
}
