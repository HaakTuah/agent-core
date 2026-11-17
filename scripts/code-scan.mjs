// The scan of a private project's code (#546; CHOICES.md, "Choice: a private project's code is scanned by Semgrep's
// engine, with the core's own rules"): where the host's CodeQL does not scan the project, which it does only where a
// workflow calls the core's codeql.yml, Semgrep's engine reads the files a pull request changes with the core's own
// rules (code-scan.yml beside this file) and fails a finding on a line the pull request adds, saying its mend; what it
// finds on a line that stood before is reported and passes (the core's AGENTS.md, "Nothing locks a project"). A finding
// the pull request's description lists on a line "Scan false alarm: `<path>:<line>`, <why>" passes, said so, for its
// security review to confirm, as floor rule 9 says of CodeQL's false alarms. With no base, as on a push to main, it reads
// every tracked file of the kinds it reads and reports what it finds.
//   The engine is a tool that only runs, fetched at set-up and never while the check runs (#534, point 5): `--fetch`
// takes `semgrep-core` and the libraries beside it from the wheel of Semgrep 1.185.0 on PyPI built for this system,
// checked by the wheel's SHA-256 here, out of a folder outside the repository, and puts it there under the name
// `osemgrep` too, the name by which it runs as a whole command with no Python. Nothing of the wheel runs before its
// digest is checked, and no install script runs at all. Where this system has no build (an Intel Mac, Windows on arm64)
// or the fetch fails, it says so and exits 0; where the engine is not in its folder, the scan says that it did not run
// and why, and decides nothing (#459). The engine runs with no variable but those a program needs to start and a home
// and temporary folder of its own, so no token reaches it, and with its metrics off; a comment in the code that would silence a finding (`nosemgrep`) silences none, and the
// files are named to it, so no ignore file of the project's leaves one out. It reads JavaScript and TypeScript,
// C# and Python; a file that is a link, or leads out of the project, is not read, nor the core's copy, whose code the
// host's CodeQL scans in the core's own public repository. Node's own modules, git, and the engine.
//
//   node core/scripts/code-scan.mjs --fetch [--engine <folder>]     at set-up: a cloud session's, a job's
//   node core/scripts/code-scan.mjs [--base <commit>] [--description <file>] [--engine <folder>]
//        (the description from the file, or else from PR_BODY; the engine's folder by default under the home folder's
//        .cache/agent-core)
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyOf } from "./core-path.mjs";
import { leadsOut, logged } from "./guards.mjs";
import { MEND } from "./mend.mjs";
import { started } from "./started.mjs";
import { zipEntries, zipRead } from "./zip.mjs";

export const VERSION = "1.185.0";
const FILES = "https://files.pythonhosted.org/packages/";
// The wheel built for each system, by its path on PyPI's file host and its SHA-256, as PyPI lists them for this version.
export const WHEELS = {
  "linux-x64": ["f2/13/0d4dc8d124794105f300082c46e3d8ad45eac7af63113b57a5966629b5a3", "manylinux_2_34_x86_64", "0eb6aaadad5b957af96d1300487e10af1dc8016e8ef53072effb48cd4906c02b"],
  "linux-arm64": ["ba/4e/cae05468e1b8c33a18bafb25539f845d6f35e6e58973ebdd2aafa6b387ed", "manylinux_2_34_aarch64", "8cffbaf80abb8e39abc6d7a86588dcf94b7ddc1f40e8e16e555a1116347be3ef"],
  "linux-x64-musl": ["fb/60/e0557977f9b0ae3a5158e2a311c35f8ed59359cac2788bb3c6dc461de3dc", "musllinux_1_2_x86_64", "f030c391af948b493ae2220a1b64372df5f18adf8e2dd909ab62035364c51890"],
  "linux-arm64-musl": ["c6/4e/77b2128d3a7f2e1f9abbeb4b0d7f9f59957663b6aa01a9b2e0f4d1c1b915", "musllinux_1_2_aarch64", "99fde53fda44c25d8ab27424f421947b0a0186d86ce888c593a6da62b811d783"],
  "darwin-arm64": ["63/8a/746b73f404709f89cecbd80f7dcd4e347b21353bfdea163cb23158d4593f", "macosx_11_0_arm64", "d54c7dc22f6f360e0f9f850b1ecdfe00ec755600f9cf2ec6be3928b42818f1b4"],
  "win32-x64": ["8e/8e/c8d5135ff77a60e825c08b68272a924572e59841d01beba29be7041d2c75", "win_amd64", "91812ac0856cfe5b6135a4dffde3052a04c36a46e4e82e78793e3a07e51d7894"],
};
export const wheelAddress = ([at, tag]) =>
  `${FILES}${at}/semgrep-${VERSION}-cp310.cp311.cp312.cp313.cp314.py310.py311.py312.py313.py314-none-${tag}.whl`;
const WHEEL_MOST = 128 << 20; // the most a wheel may weigh: each is 48 to 81 MB
const FILE_MOST = 512 << 20; // the most one file of it may inflate to: the engine is 220 to 267 MB
const BIN = `semgrep-${VERSION}.data/purelib/semgrep/bin/`;
const KINDS = /\.(?:[cm]?js|jsx|ts|tsx|cs|py)$/u;
const RULES = fileURLToPath(new URL("code-scan.yml", import.meta.url));
const exe = (sys = process.platform) => (sys === "win32" ? ".exe" : "");

/** This machine's system as WHEELS names it: platform, architecture and, on Linux, "-musl" where its C library is no glibc. */
export function system(platform = process.platform, arch = process.arch, glibc = process.report?.getReport()?.header?.glibcVersionRuntime) {
  return `${platform}-${arch}${platform === "linux" && !glibc ? "-musl" : ""}`;
}

/** The folder the engine is kept in: given, or under the home folder, outside any repository. */
export const engineAt = given => path.resolve(given || path.join(os.homedir(), ".cache", "agent-core", `semgrep-${VERSION}`));

/** The engine's files in a wheel checked by its digest: [{ name, bytes }], each a plain name under the wheel's bin
 *  folder (or one folder down, as Linux's and macOS's libs/), the Python files left; throws where the wheel holds a
 *  name that is no such plain name, or no engine. */
export function engineFiles(wheel, sys = process.platform) {
  const out = [];
  for (const e of zipEntries(wheel)) {
    if (!e.name.startsWith(BIN) || e.name.endsWith("/") || e.name.endsWith(".py")) continue;
    const name = e.name.slice(BIN.length);
    if (!/^(?:libs\/)?[A-Za-z0-9_+-][A-Za-z0-9._+-]*$/u.test(name)) throw new Error(`the wheel names a file ${logged(name)} this does not take`);
    out.push({ name, bytes: zipRead(wheel, e, FILE_MOST) });
  }
  if (!out.some(f => f.name === `semgrep-core${exe(sys)}`)) throw new Error("the wheel holds no engine");
  return out;
}

/** Puts the engine's files into `dir` through a folder beside it, so that a fetch cut short leaves no engine half
 *  written, and the engine a second time under the name it runs by as a whole command. */
export function place(files, dir, sys = process.platform) {
  const tmp = `${dir}.part-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const { name, bytes } of files) {
    fs.mkdirSync(path.dirname(path.join(tmp, name)), { recursive: true });
    fs.writeFileSync(path.join(tmp, name), bytes, { mode: 0o755 });
  }
  fs.copyFileSync(path.join(tmp, `semgrep-core${exe(sys)}`), path.join(tmp, `osemgrep${exe(sys)}`));
  fs.chmodSync(path.join(tmp, `osemgrep${exe(sys)}`), 0o755);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  fs.renameSync(tmp, dir);
}

/** Fetches the engine into `dir` at set-up; always resolves, to the line it prints. */
export async function fetchEngine(dir, { sys = system(), get = fetch } = {}) {
  const wheel = WHEELS[sys];
  if (!wheel) return `NOT FETCHED: Semgrep ${VERSION}: no build of its engine for ${sys}; the code scan will say it did not run here`;
  if (ran(dir)) return `semgrep ${VERSION}: present in ${dir}`;
  try {
    const r = await get(wheelAddress(wheel), { signal: AbortSignal.timeout(600000) });
    if (!r.ok) return `NOT FETCHED: Semgrep ${VERSION}: PyPI's file host answered ${r.status}`;
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length > WHEEL_MOST) return `NOT FETCHED: Semgrep ${VERSION}: the wheel weighs more than ${WHEEL_MOST} bytes`;
    const sum = createHash("sha256").update(bytes).digest("hex");
    if (sum !== wheel[2]) return `NOT FETCHED: Semgrep ${VERSION}: the wheel's SHA-256 is ${sum}, not ${wheel[2]}; nothing of it was taken`;
    place(engineFiles(bytes, sys.split("-")[0]), dir, sys.split("-")[0]);
  } catch (e) {
    return `NOT FETCHED: Semgrep ${VERSION}: ${logged(e.message)}`;
  }
  return ran(dir) ? `semgrep ${VERSION}: fetched into ${dir}` : `NOT FETCHED: Semgrep ${VERSION}: the engine fetched does not run here`;
}

/** The variables the engine runs with: what a program needs to start, and a home and temporary folder of its own. */
function engineEnv(home) {
  const env = { HOME: home, USERPROFILE: home, TMPDIR: home, TEMP: home, TMP: home, SEMGREP_SEND_METRICS: "off" };
  for (const name of ["PATH", "Path", "SYSTEMROOT", "SystemRoot", "WINDIR", "LANG"]) if (process.env[name]) env[name] = process.env[name];
  return env;
}

/** Whether the engine in `dir` runs and is the version pinned here. */
function ran(dir) {
  const bin = path.join(dir, `osemgrep${exe()}`);
  if (!fs.existsSync(bin)) return false;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "code-scan-"));
  try {
    const r = spawnSync(bin, ["--experimental", "--version"], { encoding: "utf8", env: engineEnv(home), timeout: 60000 });
    return r.status === 0 && r.stdout.trim() === VERSION;
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}

/** Whether a workflow of the project calls the core's codeql.yml, so that the host's CodeQL scans it. */
export function hostScans(root) {
  const dir = path.join(root, ".github", "workflows");
  let names = [];
  try { names = fs.readdirSync(dir).filter(n => /\.ya?ml$/u.test(n)); } catch { return false; }
  return names.some(n => {
    try { return /^\s*uses:\s*["']?[^\s"'#]*\/\.github\/workflows\/codeql\.yml@/mu.test(fs.readFileSync(path.join(dir, n), "utf8")); }
    catch { return false; }
  });
}

/** The files the scan reads: with a base, those the change adds or alters; else every tracked one; each of a kind it
 *  reads, a plain file inside the project, and none of the core's copy, which the core's own scan reads. */
export function targets(root, base) {
  const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
  const listed = base ? git("diff", "--name-only", "-z", "--no-renames", "--diff-filter=AM", base, "HEAD") : git("ls-files", "-z");
  const copy = copyOf(root);
  return listed.filter(f => KINDS.test(f) && !f.startsWith(copy) && !leadsOut(root, path.join(root, f)) && fs.lstatSync(path.join(root, f), { throwIfNoEntry: false })?.isFile());
}

/** The lines the change adds to each file, from git's diff with no context: Map(file → Set(line)). */
export function addedLines(root, base, files) {
  const out = new Map();
  if (!files.length) return out;
  const diff = execFileSync("git", ["diff", "-U0", "--no-renames", "--no-color", base, "HEAD", "--", ...files], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
  let file = null;
  for (const line of diff.split("\n")) {
    const to = /^\+\+\+ (?:b\/(.*)|\/dev\/null)$/u.exec(line);
    if (to) { file = to[1] ?? null; if (file && !out.has(file)) out.set(file, new Set()); continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u.exec(line);
    if (hunk && file) for (let n = Number(hunk[1]), i = 0; i < Number(hunk[2] ?? 1); i++) out.get(file).add(n + i);
  }
  return out;
}

/** The findings a description lists as false alarms: Set("<path>:<line>"). */
export function falseAlarms(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(/^[ \t]*(?:[-*][ \t]+)?Scan false alarm:[ \t]*`([^`\r\n]+):(\d+)`/gmu)) out.add(`${m[1]}:${m[2]}`);
  return out;
}

/** Runs the engine on the files, a batch at a time: { findings: [{ file, line, rule, message }], errors }, or
 *  { failed } where it did not run. */
export function runEngine(dir, root, files) {
  const bin = path.join(dir, `osemgrep${exe()}`);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "code-scan-"));
  const findings = [], errors = [];
  try {
    for (let i = 0; i < files.length; i += 200) {
      const r = spawnSync(bin, ["scan", "--experimental", "--metrics=off", "--disable-version-check", "--disable-nosem", "--json", "-q", "--config", RULES, "--", ...files.slice(i, i + 200)],
        { cwd: root, encoding: "utf8", env: engineEnv(home), maxBuffer: 1 << 28, timeout: 600000 });
      let out;
      try { out = JSON.parse(r.stdout); } catch { return { failed: `the engine gave no answer it could read (exit ${r.status ?? r.signal ?? r.error?.code}): ${logged(String(r.stderr ?? "").trim().split("\n").pop() ?? "")}` }; }
      for (const f of out.results ?? []) findings.push({ file: String(f.path).replace(/\\/gu, "/").replace(/^\.\//u, ""), line: f.start?.line, rule: String(f.check_id).split(".").pop(), message: f.extra?.message ?? "" });
      for (const e of out.errors ?? []) errors.push(e.message ?? e.type ?? "an error");
    }
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
  return { findings, errors };
}

/** The scan: { lines, failed }, each line to print. */
export function scan(root, { base = null, description = "", dir = engineAt() } = {}) {
  if (hostScans(root)) return { lines: ["code scan: not run: a workflow calls the core's codeql.yml, so the host's CodeQL scans this project"], failed: false };
  if (!fs.existsSync(path.join(dir, `osemgrep${exe()}`))) {
    return { lines: [`code scan: did not run: Semgrep's engine is not in ${dir} (fetched at set-up by \`node <the core's copy>/scripts/code-scan.mjs --fetch\`, or no build of it for ${system()}); it decides nothing`], failed: false };
  }
  const files = targets(root, base);
  if (!files.length) return { lines: [`code scan: no file of the kinds it reads ${base ? "changed" : "tracked"}`], failed: false };
  const got = runEngine(dir, root, files);
  if (got.failed) return { lines: [`code scan: did not run: ${got.failed}; it decides nothing`], failed: false };
  const added = base ? addedLines(root, base, files) : new Map(), explained = falseAlarms(description);
  const lines = [], fails = [];
  for (const f of got.findings) {
    const at = `${logged(f.file)}:${f.line}`, what = `${logged(f.message)} (${logged(f.rule)})`;
    if (!base) lines.push(`- reported: ${at}: ${what}, with no base to read a change against`);
    else if (!added.get(f.file)?.has(f.line)) lines.push(`- reported, not failed: ${at}: ${what}, on a line that stood before this change`);
    else if (explained.has(`${f.file}:${f.line}`)) lines.push(`- passed: ${at}: ${what}, listed in the description as a false alarm, for the security review to confirm`);
    else fails.push(`FAIL: ${at}: ${what}, on a line this change adds. ${MEND}change the code so that no input reaches it (a fixed command or its arguments as a list, SQL with parameters, a path checked to stay inside its folder, no eval, no BinaryFormatter or pickle on what comes in); or, where it is a false alarm, add to the pull request's description a line "Scan false alarm: \`${at}\`, <why>" for its security review to confirm (floor rule 9)`);
  }
  for (const e of got.errors) lines.push(`- the engine could not read part of it: ${logged(e)}`);
  lines.unshift(`code scan: Semgrep ${VERSION}, the core's rules, ${files.length} file(s) ${base ? "the change adds or alters" : "tracked"}: ${got.findings.length} finding(s), ${fails.length} failing`);
  return { lines: [...lines, ...fails], failed: fails.length > 0 };
}

if (started(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const dir = engineAt(opt("--engine"));
  if (args.includes("--fetch")) {
    console.log(await fetchEngine(dir));
  } else {
    const file = opt("--description");
    const description = file ? fs.readFileSync(file, "utf8") : process.env.PR_BODY ?? "";
    const { lines, failed } = scan(process.cwd(), { base: opt("--base") || null, description, dir });
    for (const l of lines) console.log(l);
    process.exitCode = failed ? 1 : 0;
  }
}
