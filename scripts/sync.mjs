// The sync (README, "How a project takes the core", point 1): run from a project's root, it brings the project's copy
// of the core to a newer commit of the core, as a sync PR carries it. It writes the copy whole at that commit, at the path the
// manifest's "Core:" line names (`core/` as a rule; core-path.mjs), moves that line to it, and moves each call to a core workflow whose workflow changed (as `core.yml` checks),
// listing those calls, and prints what the sync asks of the project beyond the copy (the core's setup/sync-notes.md, the
// entries it gained between the two commits), then, from the copy it has just written, every step a release asks that
// is not done, every difference from a fresh start, where the owner's inbox is and what its labels and openers lack
// (steps.mjs, fresh.mjs, inbox.mjs and labels.mjs, beside this file), for the sync PR's description: they report and fail nothing (AGENTS.md of the core, "Nothing locks a project"). It commits and pushes nothing: the session that runs it reviews the diff and opens the PR,
// which, a pure sync, its merger checks with `scripts/pure-sync.mjs` (floor rule 8). Git, tar, gh where it asks whose
// account holds the repository (releases.mjs, hostAccount) and Node's own modules only; the core's address:
// core-address.mjs, beside this file. Where the line says a library carries the core, it syncs nothing: the library's
// own repository does (tasks/repositories.md).
//
//   node core/scripts/sync.mjs              to the newest of what the project follows: the core's main, or its newest
//                                           release where it follows the releases (releases.mjs, beside this file),
//                                           unless that release changes nothing the project takes (staysAt there)
//   node core/scripts/sync.mjs <full SHA>   to that commit of the core's main, whatever the project follows
//
// The first copy: a project with its manifest written and no copy yet runs this file from a clone of the core's main
// (`node <the clone>/scripts/sync.mjs`, a full SHA after it for another commit), and the copy is written at the commit its
// manifest's "Core:" line names, that line moved if a SHA was given. A project that follows the core's releases runs
// it from a clone at a release, so that nothing newer than one runs in its sessions (README.md, point 1).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { CORE } from "./core-address.mjs";
import { readCore } from "./core-path.mjs";
import { NOTES, asksBetween, fetchCore, followsOf, hostSaid, inBare, newestRelease, past, releasesIn, staysAt } from "./releases.mjs";

// (the core's main and its releases, fetched into a bare repository of its own, which every call names outright, with
// git's own variables that point elsewhere left out: releases.mjs)
const git = (args, tmp) => inBare(tmp, args).trim();
class Failure extends Error {}
const fail = msg => { throw new Failure(msg); };

// What a sync prints for its pull request's description, each a script of the new copy with its arguments (`kits`:
// the folder of the earlier starter kits): the steps not done, the differences from a fresh start, where the inbox
// is, what the labels lack, and last the line that lists what the sync's own paths outside the copy call for, the
// pins of the project's workflows above all (reading.mjs, by which the description check reads that line).
const REPORTS = kits => [["steps.mjs"], ["fresh.mjs", "--older", kits], ["inbox.mjs"], ["labels.mjs"], ["reading.mjs", "builder", "--changed", "HEAD", "--line"]];

// Where the copy stands, as the manifest's "Core:" line names it (tasks/repositories.md; core-path.mjs); null, said,
// where a library carries the core, which is synced in the library's own repository.
function ownCopy(text) {
  const line = readCore(text);
  if (line.wrong) fail(line.wrong);
  // (the copy is written where the path leads, so no folder on the way is a link, which could lead out of the project)
  const parts = line.path?.split("/").filter(Boolean) ?? [];
  for (let i = 1; i <= parts.length; i++) {
    let st = null;
    try { st = fs.lstatSync(parts.slice(0, i).join("/")); } catch { break; } // (not there yet: nothing further is either)
    if (st.isSymbolicLink()) fail(`${parts.slice(0, i).join("/")}, on the way to the copy's path ${line.path}, is a link, which could lead out of the project. Mend: make it a folder of the project's own, or name another path in the "Core:" line`);
  }
  if (line.form === "copied") return line;
  console.log(`the core here is the one the library at ${line.library} carries, at that library's pin: it is synced in the library's own repository, and reaches this one when this repository takes the library at a newer version (tasks/repositories.md). Nothing to sync here.`);
  return null;
}

// The commit the copy moves to and the release it is, if one (" (release-N)", or ""): the SHA given, the pin the
// manifest names for the first copy, or the newest of what the project follows; null, said, where there is nothing to
// sync.
function targetOf({ manifest, text, old, first, at }, tmp) {
  const arg = process.argv[2];
  if (arg && !/^[0-9a-f]{40}$/.test(arg)) fail("give the core's commit as a full SHA");
  const pin = arg ?? (first ? old : null);
  if (pin) return { pin, release: "" };
  const follows = followsOf(text, hostSaid()) ?? fail(`${manifest} does not say what the project follows: its *follows* row is \`main\` or \`releases\`, once, or left out where the owner's account is read: its one row, or the repository's own account where the host says a person holds it`);
  if (follows === "main") return { pin: git(["rev-parse", "refs/heads/main"], tmp), release: "" };
  return releaseToTake({ text, old, at }, tmp);
}

// The core's newest release, where the project follows the releases; null, said, where it brings nothing to sync.
function releaseToTake({ text, old, at }, tmp) {
  const newest = newestRelease(old, tmp);
  if (!newest) { console.log("the core has cut no release yet: nothing to sync (a full SHA takes a commit of its main)"); return null; }
  if (!newest.moved) { console.log(`${at} is at or past the core's newest release, ${newest.name} (${newest.sha.slice(0, 7)}): nothing to sync`); return null; }
  if (staysAt(old, text, tmp)) { console.log(`the core's newest release, ${newest.name} (${newest.sha.slice(0, 7)}), changes nothing this project takes since ${old.slice(0, 7)}, the release before it: ${at} stays there, nothing to sync until the next release (README.md, point 1; a full SHA takes it all the same)`); return null; }
  return { pin: newest.sha, release: ` (${newest.name})` };
}

// Each call to a core workflow whose workflow changed between its pin and `pin`, moved to `pin`; the list of those moved.
function moveCalls(pin, tmp) {
  const moved = [];
  const wf = ".github/workflows";
  for (const file of fs.existsSync(wf) ? fs.readdirSync(wf).filter(f => /\.ya?ml$/.test(f)) : []) {
    const p = path.join(wf, file);
    const src = fs.readFileSync(p, "utf8");
    const out = src.replace(new RegExp(`${CORE}/\\.github/workflows/([A-Za-z0-9._-]+\\.ya?ml)@([0-9a-f]{40})`, "g"),
      (call, name, sha) => {
        let same = false;
        try { git(["diff", "--quiet", sha, pin, "--", `.github/workflows/${name}`], tmp); same = true; } catch {}
        if (same) return call;
        moved.push(`${file}: ${name} ${sha.slice(0, 7)} -> ${pin.slice(0, 7)}`);
        return `${CORE}/.github/workflows/${name}@${pin}`;
      });
    if (out !== src) fs.writeFileSync(p, out);
  }
  return moved;
}

// What the sync moved (the copy, the manifest's line and the workflow calls), and what it asks beyond the copy.
function sayMoved({ at, old, pin, release, manifest, moved }, tmp) {
  const changed = git(["diff", "--stat", "--format=", old, pin], tmp).split("\n").pop() || "no files";
  console.log(`${at} ${old.slice(0, 7)} -> ${pin.slice(0, 7)}${release} (${changed.trim()}); ${manifest} moved.`);
  console.log(moved.length
    ? `Workflow calls moved:\n  ${moved.join("\n  ")}`
    : "No workflow call moved: the PR changes no workflow.");
  // What this sync asks of the project beyond the copy: the entries the core's sync notes gained between the two pins.
  // (A pin from before the notes gives every entry. Where the entries cannot be read, it says so: never an all-clear.)
  const asks = asksBetween(old, pin, tmp);
  console.log(asks === null
    ? `What this sync asks of the project beyond the copy could not be read: read ${at}${NOTES} for the entries newer than the old pin.`
    : asks.length
      ? `This sync asks more of the project than the copy (${at}${NOTES}). Not in this PR, a pure sync: do each in a PR of its own once this one is merged, or file it for the queue where it is large.\n${asks.join("\n")}`
      : `This sync asks nothing of the project beyond the copy (${at}${NOTES}).`);
}

// The folder of the earlier starter kits, each in a folder named for its commit.
// (fresh.mjs is given the starter kit of the old pin and of every release, to find the wording the core has left)
function kitsOf(old, tmp) {
  const kits = path.join(tmp, "kits");
  for (const sha of new Set([old, ...releasesIn(tmp).map(r => r.sha)])) {
    const to = path.join(kits, sha);
    fs.mkdirSync(to, { recursive: true });
    try { execFileSync("tar", ["-x", "-f", "-", "-C", to], { input: inBare(tmp, ["archive", sha, "setup/template"], { encoding: "buffer", maxBuffer: 1 << 28 }) }); }
    catch { fs.rmSync(to, { recursive: true, force: true }); } // (a commit from before the starter kit: no kit to compare)
  }
  return kits;
}

// Every step not done, a standing one too, every difference from a fresh start, where the owner's inbox is and what its
// labels and openers lack, as the new copy reads them; for the sync PR's description. (A copy from before these scripts has neither: nothing is said of them.)
function report(at, dir, kits) {
  console.log("For the sync PR's description (each a task, none in this PR; nothing waits on them):");
  for (const [script, ...args] of REPORTS(kits)) {
    if (!fs.existsSync(path.join(dir, "scripts", script))) continue;
    // (each given ten minutes, so that none can hold the sync. Of what it writes to stderr only its own "FAIL:" lines are
    // printed, which name no path of the machine: a crash's trace would, and this goes into a PR's description)
    const r = spawnSync(process.execPath, [path.join(dir, "scripts", script), ...args], { encoding: "utf8", timeout: 600000, maxBuffer: 1 << 26 });
    const said = String(r.stderr ?? "").split("\n").filter(l => l.startsWith("FAIL:")).join("\n");
    const text = `${r.stdout ?? ""}${said}`.trim() || (r.status === 0 ? `${at}scripts/${script} said nothing` : "");
    if (text) console.log(text);
    if (r.error?.code === "ETIMEDOUT") console.log(`${at}scripts/${script} was stopped after ten minutes: run it again by itself`);
    else if (r.status !== 0 && !said) console.log(`${at}scripts/${script} failed: run it again by itself to see why`);
  }
}

function sync(tmp) {
  const manifest = "core-manifest.md";
  if (!fs.existsSync(manifest)) fail(`run it from a project's root, beside ${manifest}`);
  const text = fs.readFileSync(manifest, "utf8"), line = ownCopy(text);
  if (!line) return;
  const at = line.path, dir = at.slice(0, -1), old = line.pin, lineRe = new RegExp(`^Core: ${CORE} at ([0-9a-f]{40}), copied whole under `, "m");
  const first = !fs.existsSync(dir); // (the first copy: the manifest is written, the copy not yet)

  fetchCore(tmp);
  const target = targetOf({ manifest, text, old, first, at }, tmp);
  if (!target) return;
  const { pin, release } = target;
  if (!past(pin, "refs/heads/main", tmp)) fail(`${pin} is not a commit of the core's main`);
  if (pin === old && !first) { console.log(`${at} is already at ${pin}: nothing to sync`); return; }

  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // ("-f -": Windows' own tar reads a tape drive unless told to read its input)
  execFileSync("tar", ["-x", "-f", "-", "-C", dir], { input: inBare(tmp, ["archive", pin], { encoding: "buffer", maxBuffer: 1 << 28 }) });
  fs.writeFileSync(manifest, text.replace(lineRe, line => line.replace(old, pin)));
  install(dir);

  const moved = moveCalls(pin, tmp);
  if (first) { console.log(`${at} written at ${pin.slice(0, 7)}, the first copy; ${manifest} names it.`); return; }
  sayMoved({ at, old, pin, release, manifest, moved }, tmp);
  report(at, dir, kitsOf(old, tmp));
}

// The new copy's packages, installed from its lock file by its own install script, into its .packages/node_modules/,
// which git does not track (#654); a copy from before it has none. One that fails twice leaves the copy written and says so, with the
// command to run again: the sync's pull request holds the copy alone, and no registry's silence fails it.
function install(dir) {
  const script = path.join(dir, "scripts", "install.mjs");
  if (!fs.existsSync(script)) return;
  const r = spawnSync(process.execPath, [script], { encoding: "utf8" });
  process.stdout.write(r.stdout ?? "");
  if (r.status !== 0) console.log(`note the copy is written, but its packages are not installed: ${(r.stderr ?? "").trim().split("\n").slice(-1)[0]}. Mend: run node ${path.relative(process.cwd(), script)} before running a check`);
}

// The core is fetched into a temporary folder, removed however the sync ends.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "core-sync-"));
try {
  sync(tmp);
} catch (e) {
  console.error(`FAIL: ${e instanceof Failure ? e.message : e.stack}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
