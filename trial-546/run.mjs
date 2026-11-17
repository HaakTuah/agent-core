// The trial #546's choice record owes: Semgrep's engine alone, from the PyPI wheel checked by its SHA-256, run with no
// Python on this system, on invented samples whose planted lines are marked BAD. Prints what it found and missed.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [url, sum] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, "$1"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "engine-"));
const t0 = Date.now();
const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
const got = createHash("sha256").update(bytes).digest("hex");
if (got !== sum) { console.log(`digest ${got} is not ${sum}`); process.exit(1); }
fs.writeFileSync(path.join(tmp, "w.zip"), bytes);
const py = process.platform === "win32" ? "python" : "python3";
const x = spawnSync(py, ["-I", "-c", "import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1])\nfor i in z.infolist():\n  if '/semgrep/bin/' in i.filename and not i.filename.endswith('.py'): z.extract(i, sys.argv[2])", path.join(tmp, "w.zip"), tmp], { encoding: "utf8" });
if (x.status !== 0) { console.log(x.stderr); process.exit(1); }
const bin = path.join(tmp, "semgrep-1.185.0.data", "purelib", "semgrep", "bin");
const exe = process.platform === "win32" ? ".exe" : "";
fs.copyFileSync(path.join(bin, `semgrep-core${exe}`), path.join(bin, `osemgrep${exe}`));
if (exe === "") fs.chmodSync(path.join(bin, "osemgrep"), 0o755);
console.log(`fetched and unpacked in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const env = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT ?? "", HOME: tmp, USERPROFILE: tmp, TEMP: tmp, TMP: tmp, TMPDIR: tmp };
const t1 = Date.now();
const r = spawnSync(path.join(bin, `osemgrep${exe}`), ["scan", "--experimental", "--metrics=off", "--disable-version-check", "--config", path.join(here, "rules.yml"), "--json", "-q", path.join(here, "samples")], { encoding: "utf8", env, maxBuffer: 1 << 26, cwd: here });
console.log(`ran in ${((Date.now() - t1) / 1000).toFixed(1)} s, exit ${r.status}${r.error ? ` (${r.error.message})` : ""}`);
let out;
try { out = JSON.parse(r.stdout); } catch { console.log("no JSON:", r.stdout.slice(0, 2000), r.stderr.slice(0, 3000)); process.exit(1); }
const found = new Set(out.results.map(f => `${path.basename(f.path)}:${f.start.line}`));
const bad = new Set(), safe = new Set();
for (const f of fs.readdirSync(path.join(here, "samples"))) fs.readFileSync(path.join(here, "samples", f), "utf8").split(/\r?\n/u).forEach((l, i) => { if (/\bBAD\b/u.test(l)) bad.add(`${f}:${i + 1}`); if (/\bSAFE\b/u.test(l)) safe.add(`${f}:${i + 1}`); });
const missed = [...bad].filter(k => !found.has(k)), alarms = [...found].filter(k => !bad.has(k));
console.log(`${bad.size - missed.length} of ${bad.size} planted found; missed: ${missed.join(" ") || "none"}; false alarms: ${alarms.join(" ") || "none"} (of ${safe.size} look-alikes); errors: ${out.errors.length}`);
for (const e of out.errors) console.log("  ", JSON.stringify(e).slice(0, 300));
process.exit(missed.length || alarms.length || out.errors.length ? 1 : 0);
