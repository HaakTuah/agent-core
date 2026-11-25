// Tests of the core's checks from plain git (check.mjs; #1258) on a sync: a sync along the core's main runs as
// GitHub runs its merge, its own calls at the new pin, and the base's call of core.yml, left at a pin whose core.yml
// compares the copy leaving out less, runs at the new pin as the base calls it, though the sync gives the call an input
// the kit adds; the same change, its pin moved to a commit off the core's main, is no sync, and the base's calls run,
// so a change cannot drop a check by taking its call out; and a job stopped behind a failure of core.yml's is written by
// the key it runs under (point 2). Split from check-test.mjs, which holds the rest, to keep each within its size mark.
// A scratch core reached through the core's own address by a git rewrite, its packages from a copy of the
// machine's npm cache, as check-test.mjs sets them up, so nothing reaches the network. Git, bash, npm and Node's own
// modules.
//
//   node tests/check-sync-test.mjs

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { closing, proves, syncCalls } from "../scripts/check-calls.mjs";
import { mended } from "../scripts/mend.mjs";
import { npmRefusal } from "../scripts/npm-reads.mjs";
import { npmWithCache, scratch, scratchEnv, tally } from "../scripts/scratch-core.mjs";
import { npmOnce } from "../scripts/npm-once.mjs";

const { ok, done } = tally();
const { tmp, git, core, project } = scratch("check-sync-test-");
const env = npmOnce(scratchEnv(core, tmp), tmp, { real: npmWithCache(tmp) });
const check = (dir, ...args) => { const r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs"), ...args], { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const commit = (dir, what) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", what); };

// (#1258, point 1: every base call moves to the sync's pin, whatever pin it held, where its workflow stands there; one
// the sync's file calls alike is left to it, and one it calls otherwise, from another trigger or at another commit,
// runs as the base calls it, so nothing is dropped)
const move = uses => (uses.startsWith("lic@") ? uses : uses.replace(/@\w+$/u, "@new"));
const stale = syncCalls([{ file: "core.yml", wf: { on: "pull_request", jobs: { core: { uses: "core@older" }, same: { uses: "copies@older" }, gone: { uses: "terms@older" }, kept: { uses: "lic@older" } } } },
  { file: "t.yml", wf: { on: "pull_request", jobs: { t: { uses: "terms@older" } } } }, { file: "c.yml", wf: { on: "pull_request", jobs: { c: { uses: "core@older", with: { copies: true } } } } }],
[{ file: "core.yml", wf: { on: "pull_request", jobs: { core: { uses: "core@new", with: { added: true } }, same: { uses: "copies@new" } } } },
  { file: "t.yml", wf: { on: "workflow_dispatch", jobs: { t: { uses: "terms@new" } } } }, { file: "c.yml", wf: { on: "pull_request", jobs: { c: { uses: "core@other" } } } }], job => Boolean(job?.uses), move);
const kept = stale.slice(3).map(c => `${c.file}:${c.wf.on}:${Object.entries(c.wf.jobs).map(([id, j]) => `${id}=${j.uses}${j.with ? JSON.stringify(j.with) : ""}`).join()}`).join(";");
ok(stale.length === 6 && kept === 'core.yml:pull_request:core (as the base calls it)=core@new,gone=terms@new,kept=lic@older;t.yml:pull_request:t (as the base calls it)=terms@new;c.yml:pull_request:c (as the base calls it)=core@new{"copies":true}' && stale.slice(3).every(c => c.base) && !stale.slice(0, 3).some(c => c.base),
  "of the base's calls on a sync, whatever pin each held, one the sync calls alike is left to it; one it calls otherwise, from a trigger that starts on no change, or at another commit, runs as the base calls it at the sync's pin; one it leaves out runs at the sync's pin, or where its workflow is not there, as the base holds it (#1258, point 1)", kept);

// (only the sync's own call of core.yml at the manifest's pin, its own steps passed, proves the copy, so a base's call
// of core.yml stops nothing behind it; one the change points at another commit never does)
const own = { name: "core.yml", base: false, job: { uses: "o/c/.github/workflows/core.yml@P" } }, passed = { failed: 0, ran: 1, unrun: 0 };
ok(proves(own, passed, "P") && proves(own, { failed: 0, ran: 0, unrun: 1, held: true }, "P") && ![[{ ...own, job: { uses: "o/c/.github/workflows/core.yml@Q" } }, passed], [{ ...own, base: true }, passed], [own, { failed: 1, ran: 1, unrun: 0 }], [own, { failed: 0, ran: 0, unrun: 1, held: false }], [own, { failed: 0, ran: 0, unrun: 0 }]].some(([j, r]) => proves(j, r, "P")),
  "only the sync's own call of core.yml at the manifest's pin, its own steps passed, proves the copy; one at another commit, the base's, one failed, or one unrun before its own steps passed never does");

// a project the starter kit writes, at the scratch core's commit
const p = project("a-project", "--owner", "someone");
ok(p.status === 0, "the starter kit writes a project", p.out);
const dir = p.dir;
commit(dir, "the starter kit");
let r;
const at = /^Core: \S+ at ([0-9a-f]{40})/m.exec(fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8"))[1];
const coreYml = path.join(core, ".github", "workflows", "core.yml"), stands = fs.readFileSync(coreYml, "utf8");
ok(stands.includes("for kept in reports words tests; do"), "core.yml leaves reports, words and tests out of the copy it compares, as the test reads it");
fs.writeFileSync(coreYml, stands.replace("for kept in reports words tests; do", "for kept in reports words; do"));
git(core, "commit", "-q", "-am", "an older core.yml, which compares the copy leaving out less");
const older = git(core, "rev-parse", "HEAD");
fs.writeFileSync(coreYml, stands);
git(core, "commit", "-q", "-am", "core.yml as it stands");
const newer = git(core, "rev-parse", "HEAD");
git(core, "branch", "-q", "off-main", git(core, "commit-tree", `${newer}^{tree}`, "-p", newer, "-m", "a commit off the core's main"));
const offMain = git(core, "rev-parse", "off-main");
const workflows = path.join(dir, ".github", "workflows"), caller = path.join(workflows, "core.yml");
// (the base: its call of core.yml left at the older pin, as an older sync left it, its manifest at its own)
fs.writeFileSync(caller, fs.readFileSync(caller, "utf8").replace(`core.yml@${at}`, `core.yml@${older}`));
commit(dir, "a call of core.yml left at an older pin");
git(dir, "branch", "-q", "-f", "before-sync");
const syncTo = pin => {
  git(dir, "reset", "-q", "--hard", "before-sync");
  for (const f of ["core-manifest.md", ...fs.readdirSync(workflows).map(w => path.join(".github", "workflows", w))]) {
    const file = path.join(dir, f);
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replaceAll(at, pin).replaceAll(older, pin));
  }
  fs.appendFileSync(caller, "    with:\n      description: false\n");
  commit(dir, `the sync to ${pin.slice(0, 7)}`);
};
syncTo(newer);
const synced = path.join(tmp, "synced.json");
r = check(dir, "--base", "before-sync", "--verdicts", synced);
const after = JSON.parse(fs.readFileSync(synced, "utf8"));
ok(r.status === 0 && r.out.includes("a sync: its own calls run") && !r.out.includes("differs from the core at its pin") && /ok {3}core\.yml\/core\/core/.test(r.out) && /ok {3}core\.yml\/core \(as the base calls it\)\/core/.test(r.out) && /ok {3}copies\.yml\/copies\/copies/.test(r.out) && Object.values(after).every(v => v === "passed"),
  "a sync runs its own calls at the new pin, and the base's call of core.yml, held at an older pin whose core.yml reads a copy that leaves out more as differing, runs as the base calls it at the new pin, and passes", `${r.out}\n${JSON.stringify(after)}`);
syncTo(offMain);
const stopped = path.join(tmp, "stopped.json");
r = check(dir, "--base", "before-sync", "--verdicts", stopped);
const stoppedAt = JSON.parse(fs.readFileSync(stopped, "utf8"));
ok(r.status === 1 && !r.out.includes("a sync") && r.out.includes("so no other check runs") && mended(r.out),
  "  and the same change, its pin moved to a commit off the core's main, is no sync: the base's calls run, its call of core.yml at the older pin among them", r.out);
// (a job stopped behind the failure is written by the key it is written under where it runs, one for each job of the
// workflow its call calls, so a trial sets it beside the same job run: #1258, point 2)
ok(stoppedAt["copies.yml/copies/copies"] === "stopped" && !("copies.yml/copies" in stoppedAt) && Object.keys(stoppedAt).some(k => k.startsWith("core.yml/core") && stoppedAt[k] === "failed"),
  "  and each job left is said stopped by the key it runs under", JSON.stringify(stoppedAt));
// (#1262: core.yml failed only by the signature check's refusal of this machine's npm, after its own steps proved the
// copy, is unrun here, and stops nothing: every other check runs, and the run still fails, as for any unrun job)
fs.writeFileSync(coreYml, stands.replace("      - name: The NuGet check, last", `      - name: The signature check, as a stand-in that refuses this machine's npm\n        run: |\n          echo 'FAIL ${npmRefusal("10.9.9", ["allow-git"], "11.15.0")}'\n          exit 1\n      - name: The NuGet check, last`));
git(core, "commit", "-q", "-am", "core.yml whose signature check refuses this machine's npm");
syncTo(git(core, "rev-parse", "HEAD"));
fs.copyFileSync(coreYml, path.join(dir, "core", ".github", "workflows", "core.yml"));
commit(dir, "its copy of the core at that pin");
const refused = path.join(tmp, "refused.json");
r = check(dir, "--base", "before-sync", "--verdicts", refused);
const refusedAt = JSON.parse(fs.readFileSync(refused, "utf8"));
ok(r.status === 1 && r.out.includes("it needs npm 11.15.0 or later") && !r.out.includes("so no other check runs") && refusedAt["core.yml/core/core"] === "unrun" && refusedAt["copies.yml/copies/copies"] === "passed" && !Object.values(refusedAt).includes("stopped"),
  "core.yml failed only by the signature check's refusal of this machine's npm, its own steps passed, is unrun and stops no other check", `${r.out}\n${JSON.stringify(refusedAt)}`);

// (#1287: the summary counts the project's own jobs apart from the core's checks, with --own alone)
const said = [], own = (failed, unrun) => closing({ failed: 2, ran: 5, unrun: 1, own: { failed, ran: 3, unrun } }, l => said.push(l), l => said.push(l));
own(1, 1); closing({ failed: 0, ran: 5, unrun: 0, own: { failed: 0, ran: 3, unrun: 0 } }, l => said.push(l));
ok(said[1].endsWith("; of those the project's own: 1 failed, 1 not run, 3 ran)") && said[2].startsWith("ok   every job run here passed (5: ") && said[2].endsWith("; of those the project's own: 0 failed, 0 not run, 3 ran)"),
  "with --own the summary counts the project's own jobs apart from the core's, those that failed, were not run and ran", said.join("\n"));

done("a sync's calls in the core's checks from plain git");
