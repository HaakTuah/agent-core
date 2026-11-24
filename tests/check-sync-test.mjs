// Tests of the core's checks from plain git (check.mjs; #1258) on a sync: a sync along the core's main runs as
// GitHub runs its merge, its own calls at the new pin, and the base's call of core.yml, left at a pin whose core.yml
// compares the copy leaving out less, neither runs nor gates, though the sync gives the call an input the kit adds; the
// same change, its pin moved to a commit off the core's main, is no sync, and the base's calls run, so a change cannot
// drop a check by taking its call out; and a job stopped behind a failure of core.yml's is written by the key it runs
// under (point 2). Split from check-test.mjs, which holds the rest, to keep each within its size
// mark. A scratch core reached through the core's own address by a git rewrite, its packages from a copy of the
// machine's npm cache, as check-test.mjs sets them up, so nothing reaches the network. Git, bash, npm and Node's own
// modules.
//
//   node tests/check-sync-test.mjs

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { npmWithCache, scratch, scratchEnv, tally } from "../scripts/scratch-core.mjs";
import { npmOnce } from "../scripts/npm-once.mjs";

const { ok, done } = tally();
const { tmp, git, core, project } = scratch("check-sync-test-");
const env = npmOnce(scratchEnv(core, tmp), tmp, { real: npmWithCache(tmp) });
const check = (dir, ...args) => { const r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs"), ...args], { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const commit = (dir, what) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", what); };

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
ok(r.status === 0 && r.out.includes("a sync: its own calls run") && !r.out.includes("differs from the core at its pin") && !r.out.includes("as the base calls it") && /ok {3}core\.yml\/core\/core/.test(r.out) && /ok {3}copies\.yml\/copies\/copies/.test(r.out) && Object.values(after).every(v => v === "passed"),
  "a sync runs its own calls at the new pin, and the base's call of core.yml at an older pin, which reads a copy that leaves out more as differing, neither runs nor stops the rest", `${r.out}\n${JSON.stringify(after)}`);
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

done("a sync's calls in the core's checks from plain git");
