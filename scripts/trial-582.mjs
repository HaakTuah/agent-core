// TEMPORARY (#582): the pointer check end to end with lychee itself, on the pull request's runners alone (its first run's
// comparison is recorded on the inventory's line); taken out before the pull request is marked ready.
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LYCHEE = process.env.LYCHEE, repo = process.cwd();
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), "trial-582-")));
const show = (name, r, t) => console.log(`\n### ${name} (status ${r.status}, ${t} ms)\n${(r.stdout + r.stderr).split("\n").filter(l => !/quotes are no section/.test(l)).join("\n").slice(0, 3000)}`);
const timed = (args, cwd, env = {}) => { const t = Date.now(); const r = spawnSync(process.execPath, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } }); return [r, Date.now() - t]; };
show("the core's own run", ...timed(["scripts/pointers.mjs", "--core"], repo));
show("the core's own run, lychee not fetched", ...timed(["scripts/pointers.mjs", "--core"], repo, { LYCHEE: "" }));
const dir = fs.mkdtempSync(path.join(tmp, "kit-")), g = (...a) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
g("init", "-q", "-b", "main");
const r = spawnSync(process.execPath, [path.join(repo, "scripts/init.mjs"), "--owner", "someone", "--at", execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(), "--npm", "."], { cwd: dir, encoding: "utf8" });
if (r.status !== 0) { console.log(`init failed: ${(r.stdout + r.stderr).slice(-400)}`); process.exit(0); }
g("add", "-A"); g("commit", "-q", "-m", "base");
show("the starter kit's project, as written", ...timed(["core/scripts/pointers.mjs"], dir, { POINTERS_BASE: "HEAD" }));
fs.writeFileSync(path.join(dir, "docs/notes.md"), "# Notes\n\n## Running it\n\nText.\n");
fs.writeFileSync(path.join(dir, "untracked.md"), "# U\n");
fs.writeFileSync(path.join(tmp, "away.md"), "# Away\n");
fs.appendFileSync(path.join(dir, "AGENTS.md"), "\nSee [running](docs/notes.md#running-it), [gone](docs/notes.md#gone), [u](untracked.md), [away](../away.md), [titled](docs/none.md \"t\") and [ref][r].\n\n[r]: docs/notes.md#also-gone\n");
g("add", "AGENTS.md", "docs/notes.md");
show("the project, a change that breaks links", ...timed(["core/scripts/pointers.mjs"], dir, { POINTERS_BASE: "HEAD" }));
g("commit", "-q", "-m", "broken");
show("the project, the base held them", ...timed(["core/scripts/pointers.mjs"], dir, { POINTERS_BASE: "HEAD" }));
show("the project, no base", ...timed(["core/scripts/pointers.mjs"], dir, { POINTERS_BASE: "" }));
const raw = spawnSync(LYCHEE, ["--offline", "--no-progress", "--include-fragments", "--format", "json", "--root-dir", dir, "--", path.join(dir, "AGENTS.md")], { cwd: tmp, encoding: "utf8" });
console.log(`\n### lychee's own report on that file (status ${raw.status})\n${raw.stdout.slice(0, 2500)}`);
const dump = spawnSync(LYCHEE, ["--offline", "--no-progress", "--dump", "--root-dir", dir, "--", path.join(dir, "AGENTS.md")], { cwd: tmp, encoding: "utf8" });
console.log(`\n### lychee's list (status ${dump.status})\n${dump.stdout.slice(0, 2500)}`);
