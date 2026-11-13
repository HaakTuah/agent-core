// Tests of the sync (sync.mjs) and of the proof that a sync PR is pure (pure-sync.mjs), the two programs run end to end
// as a project runs them: in a scratch copy of the core with a short history on its main (three commits, the newest the
// core as it stands here) and one commit off it, reached through the core's own address by a git rewrite, so neither
// script changes for the test and no call reaches the network. A project makes its first copy with the sync script from
// a clone of the core, syncs, and the sync is pure; then each way a sync branch can be made to carry more than the copy
// and its pins is tried, and the proof refuses each (the alterations the outside audit's probe tried, core archive
// 201): a job added, a new workflow, core/ edited, added to, made a link or a submodule (one whose id is the copy's own
// tree too), a workflow's mode, another manifest line, a call pinned off main, text beside a pin, carriage returns, a
// root .gitattributes, the pin moved backwards. Where the change lies under core/, the core's own core.yml job, run as
// GitHub runs it (workflow-run.mjs), fails it too; a file's executable bit alone is no difference to either
// (copy-tree.mjs). And the sync script's own refusals, and its following of the core's releases. On Linux and on
// Windows. Git, tar, bash and Node's own modules.
//
//   node scripts/pure-sync-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, OWNER } from "./core-address.mjs";
import { copyTree, entries } from "./copy-tree.mjs";
import { runWorkflow } from "./workflow-run.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pure-sync-test-"));
process.on("exit", () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* (left to the system's own cleaning) */ } });
const slash = p => p.replace(/\\/g, "/");
const theCore = path.join(tmp, "the-core");
const url = `https://github.com/${CORE}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(GIT_|GITHUB_|RUNNER_|ACTIONS_|CI$)|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name)));
Object.assign(env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: `url.${slash(theCore)}.insteadOf`, GIT_CONFIG_VALUE_0: url, GIT_CONFIG_KEY_1: `url.${slash(theCore)}.insteadOf`, GIT_CONFIG_VALUE_1: `${url}.git`, GIT_ALLOW_PROTOCOL: "file" });
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();
const node = (dir, ...args) => { const r = spawnSync(process.execPath, args, { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const write = (dir, f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
const read = (dir, f) => fs.readFileSync(path.join(dir, f), "utf8");

// ---- the core: Z, A and B on its main, B the core as it stands; a commit off main ----
fs.cpSync(root, theCore, { recursive: true, filter: src => !["/.git", "/node_modules"].some(x => slash(src).endsWith(x)) });
git(theCore, "init", "-q", "-b", "main");
const NOTE_LINE = "- **13 November 2026, a note for the test.** Done when nothing: an entry that B gains over A.\n";
const notes = read(theCore, "setup/sync-notes.md");
const terms = read(theCore, ".github/workflows/personal-terms.yml");
const commit = (message) => { git(theCore, "add", "-A"); git(theCore, "commit", "-q", "--allow-empty", "-m", message); return git(theCore, "rev-parse", "HEAD"); };
write(theCore, "z.md", "only in Z\n");
write(theCore, ".github/workflows/personal-terms.yml", `${terms}# Z\n`);
const Z = commit("Z");
fs.rmSync(path.join(theCore, "z.md"));
write(theCore, ".github/workflows/personal-terms.yml", `${terms}# A\n`);
const A = commit("A");
write(theCore, ".github/workflows/personal-terms.yml", terms);
write(theCore, "setup/sync-notes.md", `${notes}${NOTE_LINE}`);
const B = commit("B");
const SIDE = git(theCore, "commit-tree", `${B}^{tree}`, "-p", B, "-m", "off main");
const SHA = sha => sha.slice(0, 7);

// ---- a project, its first copy made from a clone of the core at A ----
const clone = path.join(tmp, "core-clone");
git(tmp, "clone", "-q", theCore, clone);
git(clone, "checkout", "-q", A);
const origin = path.join(tmp, "project.git"), p = path.join(tmp, "project");
git(tmp, "init", "-q", "--bare", "-b", "main", origin);
fs.mkdirSync(p);
git(p, "init", "-q", "-b", "main");
git(p, "remote", "add", "origin", origin);
const manifest = (owner, pin = A) => `# Core manifest\n\nCore: ${CORE} at ${pin}, copied whole under core/ (never edited here).\nFloor: whole. Modules: all.\n\n## Slots\n| Slot | Here |\n| --- | --- |\n| *owner's account* | \`${owner}\` |\n`;
write(p, "core-manifest.md", manifest(OWNER));
const first = node(p, path.join(clone, "scripts", "sync.mjs"));
ok(first.status === 0 && first.out.includes("the first copy"), "the first copy: the sync script, run from a clone of the core, writes core/ at the manifest's pin", first.out);
write(p, ".github/workflows/core.yml", `name: core\non:\n  pull_request:\njobs:\n  core:\n    uses: ${CORE}/.github/workflows/core.yml@${A}\n  terms:\n    uses: ${CORE}/.github/workflows/personal-terms.yml@${A}\n    secrets: inherit\n`);
write(p, "README.md", "# A project\n");
git(p, "add", "-A");
git(p, "commit", "-q", "-m", "base");
git(p, "push", "-q", "origin", "main");
const base = git(p, "rev-parse", "HEAD");
ok(entries(git(p, "rev-parse", "HEAD:core"), p) === entries(copyTree(A, theCore), theCore), "  core/ is the core's tree at A, without the folder it keeps to itself");

// ---- the sync ----
git(p, "checkout", "-q", "-b", "sync");
const s = node(p, "core/scripts/sync.mjs");
const calls = read(p, ".github/workflows/core.yml");
ok(s.status === 0 && s.out.includes(`${SHA(A)} -> ${SHA(B)}`) && read(p, "core-manifest.md") === manifest(OWNER, B), "the sync takes a project that follows main to the core's newest commit, and moves the manifest's pin", s.out);
ok(calls.includes(`personal-terms.yml@${B}`) && calls.includes(`core.yml@${A}`) && s.out.includes("personal-terms.yml"), "  it moves a call whose workflow changed, and leaves one whose workflow did not", calls);
ok(s.out.includes("a note for the test"), "  and prints the sync notes the core gained between the two pins", s.out);
git(p, "add", "-A");
git(p, "commit", "-q", "-m", "sync");
const LEGIT = git(p, "rev-parse", "HEAD");
ok(entries(git(p, "rev-parse", "HEAD:core"), p) === entries(copyTree(B, theCore), theCore), "  core/ is now the core's tree at B");

// the proof, from the core at B, and the core's own check of the copy, as GitHub runs core.yml
const pure = () => node(p, path.join(theCore, "scripts", "pure-sync.mjs"));
const coreCheck = () => {
  const sha = git(p, "rev-parse", "HEAD");
  git(p, "push", "-q", "-f", "origin", "HEAD:refs/heads/check");
  const github = { event_name: "pull_request", repository: "someone/project", event: { repository: { default_branch: "main", private: false }, pull_request: { base: { sha: base } } } };
  const [job] = runWorkflow(read(theCore, ".github/workflows/core.yml"), { github, base: env, temp: tmp,
    workspace: () => { const ws = fs.mkdtempSync(path.join(tmp, "ws-")); git(ws, "clone", "-q", "--no-checkout", origin, "."); git(ws, "checkout", "-q", "--detach", sha); return ws; },
    uses: { "actions/checkout": (w, ws) => { if (!w.repository) return; const to = path.join(ws, w.path); git(tmp, "clone", "-q", "--no-checkout", theCore, to); git(to, "checkout", "-q", "--detach", w.ref); } } });
  return { passed: job.passed, out: job.steps.map(x => x.out).join("") };
};
const legit = pure();
ok(legit.status === 0 && legit.out.includes(`sha=${LEGIT}`), "the sync as the script makes it is pure, and the proof names the head it read", legit.out);
ok(coreCheck().passed, "  and the core's own check of the copy passes it");

// each way a sync branch can be made to carry more: refused, and where it lies under core/, failed by core.yml too
let canLink = true;
try { fs.symlinkSync("nowhere", path.join(tmp, "probe")); } catch { canLink = false; }
const tries = [
  ["a job added to a workflow", () => write(p, ".github/workflows/core.yml", calls.replace("jobs:\n", "jobs:\n  evil:\n    runs-on: ubuntu-latest\n    steps: [{run: \"echo evil\"}]\n"))],
  ["a new workflow", () => write(p, ".github/workflows/new.yml", "on: push\n")],
  ["core/ edited", () => write(p, "core/README.md", `${read(p, "core/README.md")}x\n`), "core"],
  ["a file added under core/", () => write(p, "core/extra.md", "x\n"), "core"],
  ["a mode change on a workflow", () => { git(p, "update-index", "--chmod=+x", ".github/workflows/core.yml"); return "staged"; }],
  ["another manifest line changed", () => write(p, "core-manifest.md", read(p, "core-manifest.md").replace("Modules: all.", "Modules: none."))],
  ["a call pinned to a commit not on the core's main", () => write(p, ".github/workflows/core.yml", calls.replace(`personal-terms.yml@${B}`, `personal-terms.yml@${SIDE}`))],
  ["text added beside a pin", () => write(p, ".github/workflows/core.yml", calls.replace(`personal-terms.yml@${B}`, `personal-terms.yml@${B} # ok`))],
  ["every workflow line given a carriage return", () => write(p, ".github/workflows/core.yml", calls.replace(/\n/g, "\r\n"))],
  ["a .gitattributes added at the root", () => write(p, ".gitattributes", "* text eol=crlf\n")],
  ["core/ made a submodule", () => { git(p, "rm", "-q", "-r", "--cached", "core"); fs.rmSync(path.join(p, "core"), { recursive: true, force: true }); git(p, "update-index", "--add", "--cacheinfo", `160000,${B},core`); return "staged"; }, "core"],
  ["core/ made a submodule's pointer whose id is the copy's own tree", () => { const tree = git(p, "rev-parse", "HEAD:core"); git(p, "rm", "-q", "-r", "--cached", "core"); fs.rmSync(path.join(p, "core"), { recursive: true, force: true }); git(p, "update-index", "--add", "--cacheinfo", `160000,${tree},core`); return "staged"; }, "core"],
  ...(canLink ? [["a file of core/ made a link to an identical file", () => { fs.copyFileSync(path.join(p, "core/README.md"), path.join(p, "same.md")); fs.rmSync(path.join(p, "core/README.md")); fs.symlinkSync("../same.md", path.join(p, "core/README.md")); }, "core"]] : []),
];
if (!canLink) console.log("skip the link: this machine lets the test make none");
for (const [what, alter, under] of tries) {
  if (alter() !== "staged") git(p, "add", "-A"); // (a change made in the index alone is not undone by an add)
  git(p, "commit", "-q", "-m", what);
  const r = pure();
  ok(r.status === 1 && r.out.includes("NOT PURE") && !r.out.includes("merge it with"), `${what}: not a pure sync`, r.out);
  if (under) { const c = coreCheck(); ok(!c.passed && c.out.includes("core/"), `  and the core's own check of the copy fails it`, c.out); }
  git(p, "reset", "-q", "--hard", LEGIT);
  git(p, "clean", "-q", "-fd");
}
// a file's executable bit alone: no difference to either (a copy made on Windows records none)
git(p, "update-index", "--chmod=+x", "core/README.md");
git(p, "update-index", "--chmod=-x", "core/scripts/work-saved.sh");
git(p, "commit", "-q", "-m", "modes");
const modes = pure();
ok(modes.status === 0 && git(p, "ls-files", "-s", "core/scripts/work-saved.sh").startsWith("100644"), "a copy whose files' executable bits differ from the core's, as one made on Windows, is still pure", modes.out);
ok(coreCheck().passed, "  and the core's own check of the copy passes it");
git(p, "reset", "-q", "--hard", LEGIT);

// the pin moved backwards, as the sync script itself would move it given an older commit
git(p, "checkout", "-q", "-B", "back", base);
const back = node(p, "core/scripts/sync.mjs", Z);
git(p, "add", "-A");
git(p, "commit", "-q", "-m", "back");
const backwards = pure();
ok(back.status === 0 && backwards.status === 1 && backwards.out.includes("the pin goes back"), "the pin moved backwards: not a pure sync", `${back.out}\n${backwards.out}`);

// ---- the sync script's own refusals, and the releases ----
git(p, "checkout", "-q", "-B", "more", base);
const short = node(p, "core/scripts/sync.mjs", "main");
ok(short.status === 1 && short.out.includes("full SHA") && git(p, "status", "--porcelain") === "", "a commit given otherwise than as a full SHA is refused, and nothing is written", short.out);
const off = node(p, "core/scripts/sync.mjs", SIDE);
ok(off.status === 1 && off.out.includes("not a commit of the core's main") && git(p, "status", "--porcelain") === "", "so is one off the core's main", off.out);
const same = node(p, "core/scripts/sync.mjs", A);
ok(same.status === 0 && same.out.includes("already at") && git(p, "status", "--porcelain") === "", "at the pin already, there is nothing to sync", same.out);
write(p, "core-manifest.md", manifest("someone-else"));
git(p, "commit", "-q", "-am", "another owner");
const none = node(p, "core/scripts/sync.mjs");
ok(none.status === 0 && none.out.includes("no release yet") && git(p, "status", "--porcelain") === "", "a project of another owner follows the releases: where the core has cut none, it takes nothing", none.out);
git(theCore, "tag", "release-1", A);
const atOne = node(p, "core/scripts/sync.mjs");
ok(atOne.status === 0 && atOne.out.includes("release-1") && git(p, "status", "--porcelain") === "", "where the newest release is the project's own pin, it takes nothing", atOne.out);
git(theCore, "tag", "release-2", B);
const atTwo = node(p, "core/scripts/sync.mjs");
ok(atTwo.status === 0 && atTwo.out.includes(`${SHA(A)} -> ${SHA(B)} (release-2)`) && read(p, "core-manifest.md") === manifest("someone-else", B), "and once a newer release is cut, it takes that release", atTwo.out);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the sync and the proof that it is pure`);
process.exitCode = failed ? 1 : 0;
