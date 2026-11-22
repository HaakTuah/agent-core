// Is this sync PR pure (floor rule 8)? Its merger runs it from a checkout of the core's `main`, never from the PR's own
// copy (under core/, or the path the manifest names: core-path.mjs), which the PR could change, in the project's clone
// with the sync branch's head checked out. For a project that follows the core's releases, that checkout is the
// release the sync moves to, itself a commit of `main`, so that nothing newer than a release runs in its sessions (README.md, "How a project takes the core", point 1); a
// sync to a commit that is no release is no pure sync there, and any check of it is run from the core's `main`:
//
//   node <the core's main, or that release>/scripts/pure-sync.mjs
//
// It reads the branch's head commit, not the working tree, and passes only when, against the project's main, the diff
// touches only the copy, core-manifest.md, .github/workflows/*.yml and the files the core's one process writes, the copy's path the same on both sides; outside it,
// each file the process writes (converge.mjs, #1083) is, byte for byte, what this checkout's process writes from the
// kit at the new pin for the project as its main holds it, so nothing outside the core's files and parts changed, and
// each other changed line differs from the one it replaces only in the manifest's pin or a call's to a core workflow,
// each moved to the new pin; a file is created only so, and nothing deleted; the new pin is
// a commit of the core's main at or past the old one, and, where the manifest follows the core's releases, a release
// of the core (any other sync is reviewed like any PR, and merges after it); the copy is a folder, and the core's tree at
// that pin, compared as copy-tree.mjs compares (and says why), without the folder the core keeps to itself; and every
// call to a core workflow is pinned to a commit of the core's main.
// It prints the head it checked, for the merge call's `sha` (`tasks/github-calls.md`), so nothing pushed after the
// check can merge. Git and Node's own modules only, and gh where no workflow's event says whose account holds the
// repository (releases.mjs, hostAccount); it changes nothing.
import "./whole-output.mjs";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyTree, coreIsFolder, entries } from "./copy-tree.mjs";
import { CORE as ADDRESS, CORE_SOURCE as A } from "./core-address.mjs";
import { readCore } from "./core-path.mjs";
import { followsOf, hostSaid, inBare, releasesIn } from "./releases.mjs";
import { plan, unformed } from "./converge.mjs";
import { fresh, kind } from "./fresh.mjs";
import { privateOf } from "./host-private.mjs";
import { project } from "./steps.mjs";

const CORE = `https://github.com/${ADDRESS}.git`;
const raw = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
const git = (args, cwd) => raw(args, cwd).trim();
// the only SHAs a sync may move: the manifest's pin, and a call's to a core workflow (any case, as GitHub reads it)
const PIN_REF = new RegExp(`^(Core: ${A} at )([0-9a-f]{40})(?=, copied whole under )`, "gu");
const CALL = new RegExp(`(?<![\\w./-])(${A}\\/\\.github\\/workflows\\/[\\w.-]+@)([0-9a-f]{40})(?![\\w./-])`, "giu");
const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/u;
const fail = [];

const head = git(["rev-parse", "HEAD"]);
git(["fetch", "-q", "--no-tags", "origin", "refs/heads/main"]);
const base = git(["merge-base", "FETCH_HEAD", head]);
const show = (rev, file) => { try { return git(["show", `${rev}:${file}`]); } catch { return ""; } };
// (the copy's path as main's manifest names it: a sync moves the pin, never the path; a core a library carries is
// synced in the library's repository, so a change here is no sync of it)
const was = readCore(show(base, "core-manifest.md")), now = readCore(show(head, "core-manifest.md"));
const oldPin = was.pin, pin = now.pin, at = was.path ?? "core/";
if (!oldPin || !pin) fail.push(`core-manifest.md has no one "Core: ${ADDRESS} at <full SHA>, copied whole under <path>/" line on both sides${was.form === "carried" || now.form === "carried" ? ": a core a library carries is synced in the library's own repository" : ""}`);
else if (now.path !== at) fail.push(`the copy's path moves from ${at} to ${now.path}: a sync moves the pin alone`);

// what the merge would bring: only the copy, the manifest's pin and the workflows' call pins, each moved to the new pin
// every file as text (a NUL byte can't hide a change as "binary"), with no diff driver of the project's own
const diff = (opt, ...paths) => // only the last newline dropped, so a line's trailing whitespace still counts
  raw(["diff", "--no-renames", "--no-ext-diff", "--no-textconv", "--text", "--no-color", opt, base, head, "--", ...paths]).replace(/\n$/u, "");
const files = diff("--name-only").split("\n").filter(Boolean);
// (every file outside the copy and the manifest is proved below against what the core's one process writes for the
// project at the new pin, #1083, and a workflow it leaves as the project's is held to its pins alone; a regular file
// created is let through to that proof)
const later = [];
for (const line of diff("--summary").split("\n").filter(Boolean)) {
  const named = line.trim().replace(/^.*\b\d{6} /u, "");
  if (named.startsWith(at)) continue;
  if (/^create mode 100644 /u.test(line.trim())) continue;
  fail.push(`a file created, deleted or given a new mode: ${line.trim()}`);
}
for (const f of files) {
  if (f.startsWith(at)) continue;
  if (f === "core-manifest.md") pinsOnly(f);
  else later.push(f);
}

// Each hunk's removed lines, then its added ones: the nth added line must be the nth removed with only its pins moved.
function pinsOnly(f) {
  const hunks = [];
  for (const l of diff("-U0", f).split("\n")) {
    if (l.startsWith("@@")) hunks.push({ "-": [], "+": [] });
    else if (hunks.length && (l[0] === "-" || l[0] === "+")) hunks.at(-1)[l[0]].push(l.slice(1));
  }
  if (!hunks.length) fail.push(`${f}: changed, but with no line to check`);
  for (const h of hunks) {
    if (h["-"].length !== h["+"].length) { fail.push(`${f}: lines added or removed, not only a pin moved: ${(h["+"][0] ?? h["-"][0]).slice(0, 80)}`); continue; }
    h["+"].forEach((line, i) => {
      const ref = f === "core-manifest.md" ? PIN_REF : CALL;
      const shas = [...line.matchAll(ref)].map((m) => m[2]);
      if (!shas.length || shas.some((s) => s !== pin)) fail.push(`${f}: a changed line with no pin, or one not the new pin: ${line.slice(0, 80)}`);
      else if (line.replace(ref, "$1<sha>") !== h["-"][i].replace(ref, "$1<sha>")) fail.push(`${f}: a change beyond a pin: ${line.slice(0, 80)}`);
    });
  }
}

// The core's own files and parts the sync changed, each proved equal, byte for byte, to what the one process writes
// (converge.mjs, as this checkout of the core's main holds it) from the kit at the new pin, with the project as main
// holds it and the new pin, every byte outside the core's part kept; a file it would leave as the project's is held to
// the pins alone, as any workflow is. `dir`: the core's main and releases, fetched.
function provedOwned(dir) {
  if (!later.length) return;
  const tmp = mkdtempSync(join(tmpdir(), "core-render-")), kits = join(tmp, "kits"), base_ = join(tmp, "project");
  try {
    const tree = (sha, to) => { mkdirSync(to, { recursive: true }); execFileSync("tar", ["-x", "-f", "-", "-C", to], { input: inBare(dir, ["archive", sha, "setup/template"], { encoding: "buffer", maxBuffer: 1 << 28 }) }); };
    tree(pin, join(kits, "now"));
    const older = [...new Set([oldPin, ...releasesIn(dir).map((r) => r.sha)])].flatMap((sha) => { try { tree(sha, join(kits, sha)); return [join(kits, sha)]; } catch { return []; } });
    // (the project as its main holds it, the copy left out, its manifest the head's, whose one change is the pin, read above)
    mkdirSync(base_);
    execFileSync("git", ["init", "-q"], { cwd: base_ });
    execFileSync("tar", ["-x", "-f", "-", "-C", base_], { input: execFileSync("git", ["archive", base, "--", ".", `:(exclude)${at.slice(0, -1)}`], { maxBuffer: 1 << 28 }) });
    writeFileSync(join(base_, "core-manifest.md"), raw(["show", `${head}:core-manifest.md`]));
    // (whether it is private, as the host says it of the checkout's repository: host-private.mjs)
    const p = project(base_), k = kind(p, privateOf(process.cwd())), bad = unformed(p, k);
    if (bad.length) { fail.push(`the project's kind or values cannot be read in their forms, so no file of the core's is proved: ${bad.join("; ")}`); return; }
    const kit = fresh(p, join(kits, "now", "setup", "template"), { k });
    if (!kit.length) { fail.push(`the kit at ${pin} gives no file this checkout of the core can render: a sync that writes the core's files is reviewed like any PR`); return; }
    const { write } = plan(p, kit, older.map((at) => fresh(p, join(at, "setup", "template"), { k })));
    for (const f of later) {
      const want = write.find((w) => w.to === f);
      // (a workflow not written so, by a sync from a copy before the process among them, is held to its pins alone)
      if (want && execFileSync("git", ["show", `${head}:${f}`], { maxBuffer: 1 << 26 }).equals(Buffer.from(want.text))) continue;
      if (WORKFLOW.test(f)) pinsOnly(f);
      else fail.push(`${f}: not the core's copy, its pin, a workflow's pins or what the core's process writes for the project at ${pin} (converge.mjs)`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// every pin the branch ends with: the manifest's and each call's
const pins = new Set(pin ? [pin] : []);
for (const f of git(["ls-tree", "--name-only", head, "--", ".github/workflows/"]).split("\n").filter((n) => WORKFLOW.test(n))) {
  for (const m of show(head, f).matchAll(CALL)) pins.add(m[2]);
}
// (the core's main, fetched into a bare repository of its own, which every call names outright: releases.mjs)
const dir = mkdtempSync(join(tmpdir(), "core-main-"));
const inCore = (args) => { try { inBare(dir, args); return true; } catch { return false; } };
try {
  inBare(dir, ["init", "-q", "--bare", dir]);
  inBare(dir, ["fetch", "-q", "--no-tags", CORE, "+refs/heads/main:refs/heads/main", "+refs/tags/release-*:refs/tags/release-*"]);
  for (const sha of pins) if (!inCore(["merge-base", "--is-ancestor", sha, "refs/heads/main"])) fail.push(`${sha} is not a commit of the core's main`);
  if (oldPin && pin && !inCore(["merge-base", "--is-ancestor", oldPin, pin])) fail.push(`the pin goes back: ${pin} is not past ${oldPin}`);
  // (a project that follows the core's releases takes, unreviewed, only what the core's owner chose to hand on: a sync
  // to any other commit of main is reviewed like any PR, and merges after its review; core archive 201)
  const follows = followsOf(show(head, "core-manifest.md"), hostSaid(console.error));
  if (pin && follows !== "main" && !releasesIn(dir).some((r) => r.sha === pin)) {
    // (and how to take a release instead: a copy older than release-1 lands here, its own sync script taking main; #365)
    const [newest] = releasesIn(dir);
    fail.push(`the project ${follows === "releases" ? "follows the core's releases" : "does not say what it follows"}, and ${pin} is no release of the core: the sync is reviewed like any PR${newest ? `, or made again from the project's main to a release with its full SHA, \`node ${at}scripts/sync.mjs ${newest.sha}\` (${newest.name}, the newest), as a copy older than release-1, whose sync script takes the core's main, must` : ""}`);
  }
  if (pin && oldPin && inCore(["merge-base", "--is-ancestor", pin, "refs/heads/main"])) provedOwned(dir);
  else if (later.length) fail.push(`${later.join(", ")}: no file outside the copy is proved where the pin is not a commit of the core's main`);
  const own = git(["rev-parse", "--absolute-git-dir"]); // (the project's clone, named outright as copy-tree.mjs asks)
  if (pin && inCore(["cat-file", "-e", `${pin}^{commit}`]) && (!coreIsFolder(head, own, at.slice(0, -1)) || entries(copyTree(pin, dir), dir) !== entries(`${head}:${at.slice(0, -1)}`, own))) {
    fail.push(`${at} is not a folder holding the core's tree at ${pin} (copy-tree.mjs)`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (fail.length) {
  for (const f of fail) console.log(`  NOT PURE ${f.replace(/[\u0000-\u001f\u007f]/gu, "?")}`);
  console.log("not a pure sync: it gets its reviews as any PR (floor rule 8)");
  process.exit(1);
}
console.log(`a pure sync: core ${oldPin.slice(0, 7)} -> ${pin.slice(0, 7)}, ${files.length} files, ${pins.size} pins on the core's main`);
console.log(`merge it with sha=${head}`);
