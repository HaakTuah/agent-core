// Tests of the sync (sync.mjs) and of the proof that a sync PR is pure (pure-sync.mjs), the two programs run end to end
// as a project runs them: in a scratch copy of the core with a short history on its main (three commits, the newest the
// core as it stands here) and one commit off it, reached through the core's own address by a git rewrite, so neither
// script changes for the test and no call reaches the network. A project makes its first copy with the sync script from
// a clone of the core, syncs, and the sync is pure; then each way a sync branch can be made to carry more than the copy
// and its pins is tried, and the proof refuses each (the alterations the outside audit's probe tried, core archive 201,
// and more): a job added or removed, a workflow added or deleted, a file outside core/ edited, a hook's settings added,
// core/ edited, added to, made a link or a submodule (one whose id is the copy's own tree too), a workflow's mode,
// another manifest line, a call moved to an older commit of main or renamed to another core workflow, the pin off main,
// text beside a pin, carriage returns, a root .gitattributes, the pin moved backwards; each is refused for the reason
// it means, so a check of pure-sync.mjs's gone fails the suite. Where the change lies under core/, the core's own
// core.yml job, run as GitHub runs it (workflow-run.mjs), fails it too; a file's executable bit the core marks, lost, is
// no difference to either, and one it does not mark is refused by the proof alone (copy-tree.mjs), which the sync run
// again at the same pin, where git records no bit, mends by recording the core's. And the sync script's own refusals, and its following of the core's releases: a project
// that follows them takes a commit that is no release only through review. On Linux and on Windows. Git, tar, bash and
// Node's own modules.
//
//   node tests/pure-sync-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { copyTree, entries } from "../scripts/copy-tree.mjs";
import { checkoutStandIn, ghStandIn, hostSays, scratchDir, scratchEnv } from "../scripts/scratch-core.mjs";
import { runWorkflow } from "../scripts/workflow-run.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = scratchDir("pure-sync-test-");
const slash = p => p.replace(/\\/g, "/");
const theCore = path.join(tmp, "the-core"), coreRepo = path.join(theCore, ".git"); // (copy-tree.mjs takes the git folder)
const env = scratchEnv(theCore, tmp);
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();
const node = (dir, ...args) => { const r = spawnSync(process.execPath, args, { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const write = (dir, f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
const read = (dir, f) => fs.readFileSync(path.join(dir, f), "utf8");

// ---- the core: Z, A and B on its main, B the core as it stands; a commit off main ----
fs.cpSync(root, theCore, { recursive: true, filter: src => !["/.git", "/node_modules"].some(x => slash(src).endsWith(x)) });
git(theCore, "init", "-q", "-b", "main");
const NOTE_LINE = "- **13 November 2026, a note for the test.** Done when nothing: an entry that B gains over A.\n";
const terms = read(theCore, ".github/workflows/personal-terms.yml");
// (the core's bits, none on Windows' disk)
const x = git(root, "ls-files", "-s", "-z").split("\0").filter(e => e.startsWith("100755 ")).map(e => e.slice(50));
const commit = (message) => { git(theCore, "add", "-A"); git(theCore, "update-index", "--chmod=+x", "--", ...x); git(theCore, "commit", "-q", "--allow-empty", "-m", message); return git(theCore, "rev-parse", "HEAD"); };
write(theCore, "z.md", "only in Z\n");
write(theCore, ".github/workflows/personal-terms.yml", `${terms}# Z\n`);
const bugTmpl = read(theCore, "setup/template/issue-bug.md.tmpl"), Z_LINE = "<!-- as Z's kit writes it -->\n";
write(theCore, "setup/template/issue-bug.md.tmpl", `${bugTmpl}${Z_LINE}`); // (Z's kit writes a file of the core's otherwise: #1246, point 5)
const claudeTmpl = read(theCore, "setup/template/CLAUDE.md.tmpl"), KEPT = "@core/tasks/tools.md\n";
write(theCore, "setup/template/CLAUDE.md.tmpl", claudeTmpl.replace("@core/tools/claude.md\n", `@core/tools/claude.md\n${KEPT}`)); // (and imports a file A's and B's do not: point 4)
const Z = commit("Z");
write(theCore, "setup/template/issue-bug.md.tmpl", bugTmpl);
write(theCore, "setup/template/CLAUDE.md.tmpl", claudeTmpl);
fs.rmSync(path.join(theCore, "z.md"));
write(theCore, ".github/workflows/personal-terms.yml", `${terms}# A\n`);
const A = commit("A");
write(theCore, ".github/workflows/personal-terms.yml", terms);
write(theCore, "setup/sync-notes/999-a-note-for-the-test.md", NOTE_LINE); // (an entry is a file of the folder: #750, point 1)
// (and one whose step reads it done, which the sync gives by its lead alone: #1264, point 2)
write(theCore, "setup/sync-notes/998-a-done-note.md", "- **13 November 2026, a done note.** Done when its step reads so, as it always does.\n");
write(theCore, "scripts/steps/998-a-done-note.mjs", 'import { COST } from "../step-checks.mjs";\n\nexport default { lead: "13 November 2026, a done note", cost: COST.line, check: () => null };\n');
// (and one whose check passes but leaves a part to the review, `partly`, which stays in full: what is left is still asked)
write(theCore, "setup/sync-notes/997-a-partly-note.md", "- **13 November 2026, a partly note.** Its check reads one half; the review reads the other half.\n");
write(theCore, "scripts/steps/997-a-partly-note.mjs", 'import { COST } from "../step-checks.mjs";\n\nexport default { lead: "13 November 2026, a partly note", cost: COST.line, check: () => null, partly: "the other half, read by the review" };\n');
// (and one the manifest's "Differences" leaves undone on purpose, which no check reads done, so it stays in full)
write(theCore, "setup/sync-notes/996-a-declared-note.md", "- **13 November 2026, a declared note.** Asked of every project; this one leaves it undone on purpose.\n");
write(theCore, "scripts/steps/996-a-declared-note.mjs", 'import { COST } from "../step-checks.mjs";\n\nexport default { lead: "13 November 2026, a declared note", cost: COST.line, check: () => "the declared note is not done. Mend: do it" };\n');
write(theCore, "tests/only-in-b-test.mjs", "// a test B gains, which the copy never holds\n"); // (#1361, point 7)
const B = commit("B");
const SIDE = git(theCore, "commit-tree", `${B}^{tree}`, "-p", B, "-m", "off main");
// (packed once: every later fetch, clone and archive of the core reuses the pack, where the loose objects each time are compressed again, which was about half of a run's time in them; #812)
git(theCore, "repack", "-adq");
const SHA = sha => sha.slice(0, 7);

// ---- a project, its first copy made from a clone of the core at A ----
const clone = path.join(tmp, "core-clone");
git(tmp, "clone", "-q", theCore, clone);
git(clone, "checkout", "-q", A);
const origin = path.join(tmp, "project.git"), p = path.join(tmp, "project");
// (the host says the project, and each clone of it, is public, the security-review job's clone by its address on GitHub)
hostSays(origin, false);
hostSays("https://github.com/someone/project.git", false);
git(tmp, "init", "-q", "--bare", "-b", "main", origin);
fs.mkdirSync(p);
git(p, "init", "-q", "-b", "main");
git(p, "remote", "add", "origin", origin);
const manifest = (owner, pin = A) => `# Core manifest\n\nCore: ${CORE} at ${pin}, copied whole under core/ (never edited here).\nFloor: whole. Modules: all.\n\n## Slots\n| Slot | Here |\n| --- | --- |\n| *owner's account* | \`${owner}\` |\n\n## Differences\n\n- "13 November 2026, a declared note": left undone here on purpose.\n`;
write(p, "core-manifest.md", manifest(OWNER));
const first = node(p, path.join(clone, "scripts", "sync.mjs"));
ok(first.status === 0 && first.out.includes("the first copy"), "the first copy: the sync script, run from a clone of the core, writes core/ at the manifest's pin", first.out);
write(p, ".github/workflows/core.yml", `name: core\non:\n  pull_request:\njobs:\n  core:\n    uses: ${CORE}/.github/workflows/core.yml@${A}\n  terms:\n    uses: ${CORE}/.github/workflows/personal-terms.yml@${A}\n    secrets: inherit\n`);
write(p, "README.md", "# A project\n");
git(p, "add", "-A");
git(p, "commit", "-q", "-m", "base");
git(p, "push", "-q", "origin", "main");
const base = git(p, "rev-parse", "HEAD");
ok(entries(git(p, "rev-parse", "HEAD:core"), path.join(p, ".git")) === entries(copyTree(A, coreRepo), coreRepo), "  core/ is the core's tree at A, without the folder it keeps to itself");

// ---- the sync ----
// (a project that follows main takes its newest commit whose checks all passed, as the host lists the runs its push
// started: a gh of the test's own says each passed; floor rule 12, #733. That stand-in is a script Windows does not
// start by its name, so there the sync is given B's full SHA, which takes the same commit; the green reading itself is
// core-moved-test.mjs's)
const greenBin = path.join(tmp, "green-bin");
fs.mkdirSync(greenBin);
fs.writeFileSync(path.join(greenBin, "gh"), `#!/usr/bin/env node\nconst route = process.argv.slice(2).find(x => x.includes("actions/runs")) ?? "";\nif (!route) { console.error("gh: Not Found (HTTP 404)"); process.exit(1); }\nconsole.log(JSON.stringify({ total_count: 1, workflow_runs: [{ name: "tests", path: ".github/workflows/tests.yml", status: "completed", conclusion: "success" }] }));\n`, { mode: 0o755 });
const PATHKEY = Object.keys(env).find(k => k.toUpperCase() === "PATH") ?? "PATH";
const greenEnv = { ...env, [PATHKEY]: `${greenBin}${path.delimiter}${env[PATHKEY]}` };
git(p, "checkout", "-q", "-b", "sync");
const s = (r => ({ status: r.status, out: `${r.stdout}${r.stderr}` }))(spawnSync(process.execPath, ["core/scripts/sync.mjs", ...process.platform === "win32" ? [B] : []], { cwd: p, env: greenEnv, encoding: "utf8" }));
const calls = read(p, ".github/workflows/core.yml");
ok(s.status === 0 && s.out.includes(`${SHA(A)} -> ${SHA(B)}`) && read(p, "core-manifest.md") === manifest(OWNER, B), "the sync takes a project that follows main to the core's newest commit, and moves the manifest's pin", s.out);
const copied = git(theCore, "diff", "--name-only", copyTree(A, coreRepo), copyTree(B, coreRepo)).split("\n").filter(Boolean).length;
ok(new RegExp(`${SHA(A)} -> ${SHA(B)} \\(${copied} files? changed`).test(s.out) && copied > 0, "  it counts the files of the copy alone, never one of the tests the core keeps to itself (#1361, point 7)", s.out);
ok(calls.includes(`personal-terms.yml@${B}`) && calls.includes(`core.yml@${A}`) && s.out.includes("personal-terms.yml"), "  it moves a call whose workflow changed, and leaves one whose workflow did not", calls);
ok(s.out.includes("Done when nothing: an entry that B gains over A."), "  and prints the sync notes the core gained between the two pins", s.out);
ok(s.out.includes("- 13 November 2026, a done note: done here, as its step reads.") && !s.out.includes("as it always does"), "  each whose step the new copy reads done here by its lead alone (#1264)", s.out);
ok(s.out.includes("this one leaves it undone on purpose") && !s.out.includes("a declared note: done here"), "  one the manifest's \"Differences\" leaves undone on purpose in full, never told done (#1264)", s.out);
ok(s.out.includes("the review reads the other half") && !s.out.includes("a partly note: done here"), "  one whose check leaves a part to the review in full, though its check passes (#1264)", s.out);
ok(/The core's files and parts written[\s\S]*\.github\/workflows\/look\.yml[\s\S]*For the sync PR's description[\s\S]*Steps not done[\s\S]*Beside a fresh start/.test(s.out),
  "  then, from the copy it wrote, what the core owns written by the one process (#1083), and every step not done, a standing one too, and every difference from a fresh start, for the PR's description", s.out);
ok(/\n(No setting only the owner gives is new since [0-9a-f]{7}: the sitting is not asked again|The settings only the owner gives)/.test(s.out), "  and asks the owner's settings again only where one is new since the old pin, saying so where none is (owner-settings.mjs; #1085)", s.out);
ok(/\nattached: (yes|no, \d+ things? in the way)\s*$/u.test(s.out), "  and ends with the one line that says whether the project then holds the core whole and wired (attached.mjs; #1081)", s.out);
ok(read(p, "AGENTS.md").includes("<!-- The core's part ends. -->") && read(p, ".github/workflows/core.yml") === calls && /Left as the project's[\s\S]*\.github\/workflows\/core\.yml is not the core's/.test(s.out),
  "  the kit's files the project lacked are written (at its first copy already), each call of the core's own files pinned to the new pin, and a workflow of its own that is no kit's is left as it stands and named", s.out);
git(p, "add", "-A");
git(p, "commit", "-q", "-m", "sync");
const LEGIT = git(p, "rev-parse", "HEAD");
ok(entries(git(p, "rev-parse", "HEAD:core"), path.join(p, ".git")) === entries(copyTree(B, coreRepo), coreRepo), "  core/ is now the core's tree at B");

// the proof, from the core at B, and the core's own check of the copy, as GitHub runs core.yml
// (its host's answer as GitHub's job gives it, from the event, for the clone's origin by its address on GitHub, which
// git takes to the bare repository; pure-sync.mjs honours no test's stand-in)
const GH_ORIGIN = "https://github.com/someone/project.git", event = path.join(tmp, "event.json");
fs.writeFileSync(event, JSON.stringify({ repository: { full_name: "someone/project", private: false } }));
git(p, "config", `url.${slash(origin)}.insteadOf`, GH_ORIGIN);
const pure = (...args) => {
  git(p, "remote", "set-url", "origin", GH_ORIGIN);
  try {
    const r = spawnSync(process.execPath, [path.join(theCore, "scripts", "pure-sync.mjs"), ...args], { cwd: p, env: { ...env, GITHUB_EVENT_PATH: event }, encoding: "utf8" });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  } finally { git(p, "remote", "set-url", "origin", origin); }
};
const coreCheck = () => {
  const sha = git(p, "rev-parse", "HEAD");
  git(p, "push", "-q", "-f", "origin", "HEAD:refs/heads/check");
  const github = { event_name: "pull_request", repository: "someone/project", event: { repository: { default_branch: "main", private: false }, pull_request: { base: { sha: base } } } };
  const [job] = runWorkflow(read(theCore, ".github/workflows/core.yml"), { github, base: env, temp: tmp,
    workspace: () => { const ws = fs.mkdtempSync(path.join(tmp, "ws-")); git(ws, "clone", "-q", "--no-checkout", origin, "."); git(ws, "checkout", "-q", "--detach", sha); return ws; },
    uses: { "actions/checkout": checkoutStandIn(env, tmp) } });
  return { passed: job.passed, out: job.steps.map(x => x.out).join("") };
};
// (whether the core is attached, as a session runs it on the sync's branch: pure-sync.mjs among its parts, run from the
// core's side, its host's answer as above; #1081)
const attachedHere = () => {
  git(p, "remote", "set-url", "origin", GH_ORIGIN);
  try {
    const r = spawnSync(process.execPath, ["core/scripts/attached.mjs"], { cwd: p, env: { ...env, GITHUB_EVENT_PATH: event }, encoding: "utf8" });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  } finally { git(p, "remote", "set-url", "origin", origin); }
};
const legit = pure(), legitAttached = attachedHere();
git(p, "push", "-q", "-f", "origin", "HEAD:refs/heads/check");
git(p, "repack", "-adq"); git(tmp, `--git-dir=${origin}`, "repack", "-adq"); // (as the core's above: each check that follows clones these; the push before it puts what they hold into origin first, so keep it)
ok(legit.status === 0 && legit.out.includes(`sha=${LEGIT}`), "the sync as the script makes it is pure, and the proof names the head it read", legit.out);
ok(coreCheck().passed, "  and the core's own check of the copy passes it");
ok(legitAttached.status === 0 && /^attached: /u.test(legitAttached.out) && !/^- the (sync|copy): /mu.test(legitAttached.out), "  and whether the core is attached, read on the sync's branch, finds its copy at its pin and the sync pure, run from the core's side", legitAttached.out);

// the security-review check proves the sync pure itself, as GitHub runs its workflow on the sync's pull request (#99):
// the default branch's pure-sync.mjs, in a clone of the head that checks nothing out, the token sent to the project's
// own address alone; GitHub's API is a stand-in that gives the pull request and logs the status it is given
const { env: reviewEnv, ghData, ghLog } = ghStandIn(env, tmp, origin);
const reviewCheck = () => {
  const sha = git(p, "rev-parse", "HEAD");
  git(p, "push", "-q", "-f", "origin", `${sha}:refs/pull/1/head`);
  const files = git(p, "diff", "--name-only", base, sha).split("\n").filter(Boolean).map(filename => ({ filename }));
  const repo = { full_name: "someone/project" };
  const pull = { number: 1, state: "open", draft: false, changed_files: files.length, commits: 1, head: { sha, repo }, base: { sha: base, repo: { ...repo, owner: { login: "someone" } } }, user: { login: "someone" } };
  fs.writeFileSync(ghData, JSON.stringify({ "pulls/1$": pull, "issues/1/comments": [], "pulls/1/comments": [], "pulls/1/commits": [{ sha, parents: [{ sha: base }] }], "pulls/1/files": files }));
  fs.writeFileSync(ghLog, "");
  const github = { event_name: "pull_request", repository: "someone/project", actor: "someone", server_url: "https://github.com", run_id: "1", token: "not-a-token",
    event: { action: "synchronize", pull_request: pull, repository: { default_branch: "main", private: false, full_name: "someone/project" } } };
  const [job] = runWorkflow(read(theCore, ".github/workflows/security-review.yml"), { github, base: reviewEnv, temp: tmp, inputs: { advisory: false },
    workspace: () => { const ws = fs.mkdtempSync(path.join(tmp, "ws-")); git(ws, "clone", "-q", origin, "."); return ws; },
    uses: { "actions/checkout": checkoutStandIn(env, tmp), "actions/setup-node": () => {} } });
  return { passed: job.passed, out: job.steps.map(x => x.out).join(""), posted: fs.readFileSync(ghLog, "utf8") };
};
const proved = reviewCheck();
ok(proved.passed && proved.out.includes("A pure sync, as pure-sync.mjs proves") && /"state": *"success"/.test(proved.posted) && proved.posted.includes("a pure sync, as pure-sync.mjs proves"), "the security-review check runs the proof itself: the sync passes with no review and no note", proved.out + proved.posted);
write(p, "core/README.md", `${read(p, "core/README.md")}more\n`);
git(p, "commit", "-q", "-am", "core/ edited");
const unproved = reviewCheck();
ok(unproved.passed && unproved.out.includes("Not proved a pure sync") && /"state": *"pending"/.test(unproved.posted) && unproved.posted.includes("no security review has run yet"), "  and one that edits core/ is not proved pure: it waits for its security review", unproved.out + unproved.posted);
git(p, "reset", "-q", "--hard", LEGIT);

// each way a sync branch can be made to carry more: refused, and where it lies under core/, failed by core.yml too
let canLink = true;
try { fs.symlinkSync("nowhere", path.join(tmp, "probe")); } catch { canLink = false; }
// (each with the refusal it means, so that a case refused for another reason, its own check gone, fails: pure-sync.mjs's
// words, and where the change lies under core/, core.yml's)
const NOT_COPY = "is not a folder holding the core's tree", DIFFERS = "core/ differs", NO_FOLDER = "core/ is no folder";
const removeCore = () => { git(p, "rm", "-q", "-r", "--cached", "core"); fs.rmSync(path.join(p, "core"), { recursive: true, force: true }); };
const outside = path.join(tmp, "same-outside.md");
const tries = [
  ["a job added to a workflow", () => write(p, ".github/workflows/core.yml", calls.replace("jobs:\n", "jobs:\n  evil:\n    runs-on: ubuntu-latest\n    steps: [{run: \"echo evil\"}]\n")), "lines added or removed, not only a pin moved"],
  ["a job removed from a workflow", () => write(p, ".github/workflows/core.yml", calls.replace(/  terms:\n[^]*$/u, "")), "lines added or removed, not only a pin moved"],
  ["a new workflow", () => write(p, ".github/workflows/new.yml", "on: push\n"), ".github/workflows/new.yml: lines added or removed"],
  ["a workflow deleted", () => fs.rmSync(path.join(p, ".github/workflows/core.yml")), "core.yml: deleted, and not a workflow of the core's whose check the one job"],
  ["a file outside core/ edited", () => write(p, "README.md", "# A project, changed\n"), "README.md: not the core's copy, its pin, a workflow's pins or what the core's process writes"],
  ["a hook's settings added", () => write(p, ".claude/settings.json", "{}\n"), ".claude/settings.json: not the core's copy, its pin, a workflow's pins or what the core's process writes"],
  ["the core's part of a rule file written otherwise", () => write(p, "AGENTS.md", read(p, "AGENTS.md").replace("@core/roles/builder.md\n", "@core/roles/builder.md\n@evil.md\n")), "AGENTS.md: not the core's copy, its pin, a workflow's pins or what the core's process writes"],
  ["a word outside the core's part of a rule file changed", () => write(p, "AGENTS.md", read(p, "AGENTS.md").replace("## Commands", "## Commands, changed")), "AGENTS.md: not the core's copy, its pin, a workflow's pins or what the core's process writes"],
  ["a file of the core's written otherwise", () => write(p, ".github/workflows/look.yml", `${read(p, ".github/workflows/look.yml")}# more\n`), ".github/workflows/look.yml: lines added or removed"],
  ["core/ edited", () => write(p, "core/README.md", `${read(p, "core/README.md")}x\n`), NOT_COPY, DIFFERS],
  ["a file added under core/", () => write(p, "core/extra.md", "x\n"), NOT_COPY, DIFFERS],
  ["a mode change on a workflow", () => { git(p, "update-index", "--chmod=+x", ".github/workflows/core.yml"); return "staged"; }, "a file created, deleted or given a new mode"],
  ["another manifest line changed", () => write(p, "core-manifest.md", read(p, "core-manifest.md").replace("Modules: all.", "Modules: none.")), "a changed line with no pin, or one not the new pin"],
  ["a call moved to an older commit of the core's main, not the new pin", () => write(p, ".github/workflows/core.yml", calls.replace(`personal-terms.yml@${B}`, `personal-terms.yml@${Z}`)), "a changed line with no pin, or one not the new pin"],
  ["a call renamed to another core workflow at the pin", () => write(p, ".github/workflows/core.yml", calls.replace(`personal-terms.yml@${B}`, `security-review.yml@${B}`)), "a change beyond a pin"],
  ["the manifest and a call pinned to a commit not on the core's main", () => { write(p, "core-manifest.md", manifest(OWNER, SIDE)); write(p, ".github/workflows/core.yml", calls.replace(`personal-terms.yml@${B}`, `personal-terms.yml@${SIDE}`)); }, `${SIDE} is not a commit of the core's main`],
  ["text added beside a pin", () => write(p, ".github/workflows/core.yml", calls.replace(`personal-terms.yml@${B}`, `personal-terms.yml@${B} # ok`)), "a change beyond a pin"],
  ["every workflow line given a carriage return", () => write(p, ".github/workflows/core.yml", calls.replace(/\n/g, "\r\n")), "a changed line with no pin, or one not the new pin"],
  ["a .gitattributes added at the root", () => write(p, ".gitattributes", "* text eol=crlf\n"), ".gitattributes: not the core's copy, its pin, a workflow's pins or what the core's process writes"],
  ["core/ made a submodule", () => { removeCore(); git(p, "update-index", "--add", "--cacheinfo", `160000,${B},core`); return "staged"; }, NOT_COPY, NO_FOLDER],
  ["core/ made a submodule's pointer whose id is the copy's own tree", () => { const tree = git(p, "rev-parse", "HEAD:core"); removeCore(); git(p, "update-index", "--add", "--cacheinfo", `160000,${tree},core`); return "staged"; }, NOT_COPY, NO_FOLDER],
  ...(canLink ? [["a file of core/ made a link to an identical file outside the project", () => { fs.copyFileSync(path.join(p, "core/README.md"), outside); fs.rmSync(path.join(p, "core/README.md")); fs.symlinkSync(path.relative(path.join(p, "core"), outside), path.join(p, "core/README.md")); }, NOT_COPY, DIFFERS]] : []),
];
if (!canLink) console.log("skip the link: this machine lets the test make none");
for (const [what, alter, refused, coreFails] of tries) {
  if (alter() !== "staged") git(p, "add", "-A"); // (a change made in the index alone is not undone by an add)
  git(p, "commit", "-q", "-m", what);
  const r = pure();
  ok(r.status === 1 && r.out.includes(`NOT PURE`) && r.out.includes(refused) && !r.out.includes("merge it with"), `${what}: not a pure sync ("${refused}")`, r.out);
  if (coreFails) { const c = coreCheck(); ok(!c.passed && c.out.includes(coreFails), `  and the core's own check of the copy fails it ("${coreFails}")`, c.out); }
  git(p, "reset", "-q", "--hard", LEGIT);
  git(p, "clean", "-q", "-fd");
}
// a file that is the project's from its first commit (SECURITY.md), which main lacks and the sync creates as the kit
// renders it: not pure, since floor rule 8 covers the core's own files and parts alone (#1083)
git(p, "checkout", "-q", "-B", "main-lacking", base);
git(p, "rm", "-q", "SECURITY.md");
git(p, "commit", "-q", "-m", "SECURITY.md taken out");
git(p, "push", "-q", "-f", "origin", "main-lacking:main");
git(p, "checkout", "-q", "-B", "sync-creates");
git(p, "checkout", "-q", LEGIT, "--", ".");
git(p, "commit", "-q", "-m", "the sync, SECURITY.md created");
const creates = pure(), createsAttached = attachedHere();
ok(creates.status === 1 && /NOT PURE[^\n]*SECURITY\.md: not the core's copy, its pin, a workflow's pins or what the core's process writes of the core's own files and parts/.test(creates.out) && read(p, "SECURITY.md") === git(p, "show", `${LEGIT}:SECURITY.md`) + "\n",
  "a file that is the project's own, created by the sync where main lacks it, is not pure, though it is what the kit renders", creates.out);
ok(/^attached: no, /u.test(createsAttached.out) && /^- the sync: not pure: [^\n]*SECURITY\.md[^\n]*Mend: /mu.test(createsAttached.out), "  and whether the core is attached reads no on that branch, naming the file and its mend", createsAttached.out);
git(p, "push", "-q", "-f", "origin", `${base}:main`);
// a sync's branch that changes what the project follows: nothing of the core's runs, since only what main follows may
git(p, "checkout", "-q", "-B", "sync-follows", LEGIT);
write(p, "core-manifest.md", `${read(p, "core-manifest.md").trimEnd()}\n| *follows* | \`releases\` |\n`);
git(p, "commit", "-q", "-am", "the sync, and what it follows changed");
const followsAttached = attachedHere();
ok(/^attached: no, /u.test(followsAttached.out) && /^- the sync: it changes what the project follows[^\n]*was not run\. Mend: /mu.test(followsAttached.out), "  and on a sync's branch that changes what the project follows, pure-sync.mjs is not run, and that stands in the way with its mend", followsAttached.out);
// main marks its own workflow export-ignore (a common line of .gitattributes): the proof reads main's tree blob by blob,
// as git holds it, so a sync that swaps that workflow for the kit's render is not pure (floor rule 3's second review)
git(p, "checkout", "-q", "-B", "main-ignores", base);
write(p, ".gitattributes", ".github/workflows/core.yml export-ignore\n");
git(p, "add", "-A");
git(p, "commit", "-q", "-m", "its own workflow kept out of exports");
git(p, "push", "-q", "-f", "origin", "main-ignores:main");
git(p, "checkout", "-q", "-B", "sync-swaps");
git(p, "checkout", "-q", LEGIT, "--", ".");
fs.rmSync(path.join(p, ".github/workflows/core.yml"));
const rendered = node(p, "core/scripts/converge.mjs", "--write");
git(p, "add", "-A");
git(p, "commit", "-q", "-m", "the sync, its own workflow swapped for the kit's");
const swaps = pure();
ok(rendered.status === 0 && read(p, ".github/workflows/core.yml") !== calls && swaps.status === 1 && /NOT PURE[^\n]*\.github\/workflows\/core\.yml/.test(swaps.out),
  "a workflow of the project's own that main marks export-ignore, swapped by the sync for the kit's render, is not pure", `${rendered.out}\n${swaps.out}`);
git(p, "push", "-q", "-f", "origin", `${base}:main`);
// main's part of AGENTS.md stale (an import of the kit's missing), and the sync writes it again as the process does:
// pure, proved against the render, the host's answer from GitHub's event; with the test's stand-in alone answering,
// which the proof does not honour, and gh giving none, the part is not proved and the sync is reviewed
git(p, "checkout", "-q", "-B", "main-stale", base);
write(p, "AGENTS.md", read(p, "AGENTS.md").replace("@core/roles/builder.md\n", ""));
git(p, "commit", "-q", "-am", "the core's part stale");
git(p, "push", "-q", "-f", "origin", "main-stale:main");
git(p, "checkout", "-q", "-B", "sync-mends");
git(p, "checkout", "-q", LEGIT, "--", ".");
git(p, "commit", "-q", "-m", "the sync, the core's part written again");
const mends = pure();
ok(mends.status === 0 && read(p, "AGENTS.md").includes("@core/roles/builder.md\n"), "a sync that writes the core's part of a rule file again, as the process does, is pure, proved against the kit's render", mends.out);
const silent = path.join(tmp, "gh-silent");
fs.mkdirSync(silent, { recursive: true });
fs.writeFileSync(path.join(silent, "gh"), "#!/bin/sh\necho 'gh: not signed in' >&2\nexit 1\n", { mode: 0o755 });
// (the read with no sign-in sent to a proxy that is not there, so it gives no answer and nothing leaves this machine;
// a stranger's repository of the stand-in's name never answers for it; #1246)
const offline = { HTTPS_PROXY: "http://127.0.0.1:9", https_proxy: "http://127.0.0.1:9", NO_PROXY: "", no_proxy: "" };
const unanswered = given => {
  git(p, "remote", "set-url", "origin", GH_ORIGIN);
  try {
    const r = spawnSync(process.execPath, [path.join(theCore, "scripts", "pure-sync.mjs")], { cwd: p, env: { ...env, ...offline, ...given, [PATHKEY]: `${silent}${path.delimiter}${env[PATHKEY]}` }, encoding: "utf8" });
    return `${r.status}\n${r.stdout}${r.stderr}`;
  } finally { git(p, "remote", "set-url", "origin", origin); }
};
for (const [given, what] of [[{ CORE_HOST_ANSWERS: hostSays() }, "the test's stand-in for the host"], [{ CORE_PRIVATE: "false" }, "an answer given as CORE_PRIVATE"]]) {
  const out = unanswered(given);
  ok(/^1\n/.test(out) && /NOT PURE[^\n]*AGENTS\.md: the project's kind or values cannot be read/.test(out), `  and with only ${what} answering, which the proof does not honour, it is not proved`, out);
}
git(p, "push", "-q", "-f", "origin", `${base}:main`);
git(p, "checkout", "-q", "sync");
git(p, "reset", "-q", "--hard", LEGIT);
git(p, "clean", "-q", "-fd");
// main imports, above CLAUDE.md's part, a module of its copy that the new pin makes a moved stub whose target the part
// imports, and the sync takes the import out, as the one process does with the copy at the new pin: pure, the stub read
// from the core at the pin, never from main's copy (#1272, point 2)
git(p, "checkout", "-q", "-B", "main-stub", base);
write(p, "core/modules/claude.md", "# Claude's part\n\nThe rules as the old pin held them.\n");
write(p, "CLAUDE.md", read(p, "CLAUDE.md").replace("<!-- The core's part: a sync writes it;", "@core/modules/claude.md\n<!-- The core's part: a sync writes it;"));
git(p, "commit", "-q", "-am", "an import of a module, before the module moved");
git(p, "push", "-q", "-f", "origin", "main-stub:main");
git(p, "checkout", "-q", "-B", "sync-stub");
git(p, "checkout", "-q", LEGIT, "--", ".");
git(p, "commit", "-q", "-m", "the sync, the moved stub's import taken out");
const stubbed = pure();
ok(stubbed.status === 0 && !read(p, "CLAUDE.md").includes("@core/modules/claude.md"), "a sync that takes out an import of a module the new pin moves is pure, the stub read from the core at the pin", stubbed.out);
git(p, "push", "-q", "-f", "origin", `${base}:main`);
git(p, "checkout", "-q", "sync");
git(p, "reset", "-q", "--hard", LEGIT);
git(p, "clean", "-q", "-fd");
// a private project whose main holds the calls its earlier kit wrote that the one job of core.yml folds: the sync that
// writes the one job and takes them out, as the process does, is pure; the same deletions with core.yml left as main
// holds it are not, nor is one of a check the one job does not run, the licence check (#1101, point 2)
const asHost = (isPrivate, run) => {
  fs.writeFileSync(event, JSON.stringify({ repository: { full_name: "someone/project", private: isPrivate } }));
  try { return run(); } finally { fs.writeFileSync(event, JSON.stringify({ repository: { full_name: "someone/project", private: false } })); }
};
const converged = isPrivate => asHost(isPrivate, () => {
  git(p, "remote", "set-url", "origin", GH_ORIGIN);
  try { const r = spawnSync(process.execPath, ["core/scripts/converge.mjs", "--write"], { cwd: p, env: { ...env, GITHUB_EVENT_PATH: event, CORE_HOST_ANSWERS: "" }, encoding: "utf8" }); return `${r.stdout}${r.stderr}`; }
  finally { git(p, "remote", "set-url", "origin", origin); }
});
// (main as the kit writes a public project, its calls of their own; pushed as main for each case)
git(p, "checkout", "-q", "-B", "main-public", base);
for (const f of ["core", "copies", "pr-description", "signatures"]) fs.rmSync(path.join(p, `.github/workflows/${f}.yml`), { force: true });
converged(false);
git(p, "add", "-A");
git(p, "commit", "-q", "-m", "the kit's calls, as a public project's");
const publicMain = git(p, "rev-parse", "HEAD");
const drops = (what, change, isPure, said) => {
  git(p, "push", "-q", "-f", "origin", `${publicMain}:refs/heads/main`);
  git(p, "checkout", "-q", "-B", "sync-drops", publicMain);
  git(p, "checkout", "-q", LEGIT, "--", ".");
  git(p, "checkout", "-q", publicMain, "--", ".github/workflows/");
  const taken = converged(true);
  change();
  git(p, "add", "-A");
  git(p, "commit", "-q", "-m", "the sync, as a private project's");
  const r = asHost(true, pure);
  ok(isPure ? r.status === 0 && /taken out: [^\n]*copies\.yml/.test(taken) : r.status === 1 && said.test(r.out), `${what}: ${isPure ? "" : "not "}pure`, `${taken}\n${r.out}`);
  git(p, "push", "-q", "-f", "origin", `${base}:main`);
  git(p, "checkout", "-q", "sync");
  git(p, "reset", "-q", "--hard", LEGIT);
  git(p, "clean", "-q", "-fd");
};
drops("a private project's sync that writes core.yml's one job and takes out the calls it folds", () => {}, true);
drops("  the same deletions with core.yml left as main holds it", () => git(p, "checkout", "-q", publicMain, "--", ".github/workflows/core.yml"), false, /NOT PURE[^\n]*copies\.yml: deleted, and not a workflow of the core's whose check the one job/);
drops("  a deletion of the licence check, which the one job does not run", () => fs.rmSync(path.join(p, ".github/workflows/licences.yml"), { force: true }), false, /NOT PURE[^\n]*licences\.yml: deleted/);
// a file's executable bit: one the core marks, lost, is no difference to either (a copy made on Windows by a sync from
// before #1093 records none); one the core does not mark is none to the core's check, which reads no bit, but the proof
// refuses it; and the sync run again at the same pin, where git records no bit (core.fileMode off, as on Windows),
// records the core's in the index, a stray one taken off, and is pure, and where git reads the bit from the disk, a
// later `git add` keeps them, the files' own bits set too (#1093)
const mode = f => git(p, "ls-files", "-s", f).slice(0, 6);
git(p, "update-index", "--chmod=-x", "core/scripts/work-saved.sh");
fs.chmodSync(path.join(p, "core/scripts/work-saved.sh"), 0o644);
git(p, "commit", "-q", "-m", "a bit lost");
const lost = pure();
ok(lost.status === 0 && mode("core/scripts/work-saved.sh") === "100644", "a copy that lost an executable bit the core marks, as one made on Windows by an older sync, is still pure", lost.out);
ok(coreCheck().passed, "  and the core's own check of the copy passes it");
git(p, "update-index", "--chmod=+x", "core/README.md");
fs.chmodSync(path.join(p, "core/README.md"), 0o755);
git(p, "commit", "-q", "-m", "a bit added");
const added = pure();
ok(added.status === 1 && /NOT PURE core\/README\.md is marked executable, which the core at [0-9a-f]{40} does not mark it/.test(added.out), "a copy that marks executable a file the core does not mark: not pure", added.out);
ok(coreCheck().passed, "  though the core's own check of the copy, which reads no bit, passes it");
const fm = git(p, "config", "core.fileMode");
git(p, "config", "core.fileMode", "false");
const again = node(p, "core/scripts/sync.mjs", B);
git(p, "config", "core.fileMode", fm);
ok(again.status === 0 && mode("core/scripts/work-saved.sh") === "100755" && mode("core/README.md") === "100644" && mode("core/scripts/sync.mjs") === "100644",
  "the sync run again at the same pin, where git records no executable bit, stages each the core marks and takes off one it does not, read from the core's tree", `${again.out}\n${git(p, "ls-files", "-s", "core/scripts")}`);
git(p, "add", "-A");
if (process.platform !== "win32") ok(mode("core/scripts/work-saved.sh") === "100755" && mode("core/README.md") === "100644", "  and a `git add` after it, where git reads the bit from the disk, keeps them", git(p, "ls-files", "-s", "core/scripts/work-saved.sh", "core/README.md"));
git(p, "commit", "-q", "-m", "the bits recorded");
const recorded = pure();
ok(recorded.status === 0, "  and that sync is pure", recorded.out);
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
// (#1246, point 1: a copy an older sync script moved got the copy and the pins alone; the run at the same pin gives the
// rest, what the sync asks since the pin before, read from the project's own history, and every report)
ok(/could not be read from the history of core-manifest\.md[\s\S]*For the sync PR's description[\s\S]*Steps not done/.test(same.out) && /The settings only the owner gives|setting only the owner gives/.test(same.out),
  "  and does all else a sync does, saying where no pin before it stands in the manifest's history, and listing every setting only the owner gives", same.out);
for (const [how, at] of [["committed", LEGIT], ["left in the working tree by an older script", base]]) {
  git(p, "checkout", "-q", "-B", "again", at);
  if (at === base) { git(p, "checkout", "-q", LEGIT, "--", "core"); write(p, "core-manifest.md", manifest(OWNER, B)); }
  const rerun = node(p, "core/scripts/sync.mjs", B);
  ok(rerun.status === 0 && rerun.out.includes("already at") && rerun.out.includes("a note for the test") && /For the sync PR's description[\s\S]*Steps not done[\s\S]*Beside a fresh start[\s\S]*\nattached: /.test(rerun.out),
    `  a sync at the same pin, ${how}, prints what the sync asks since the pin before, read from the manifest's history, and every report`, rerun.out);
  git(p, "reset", "-q", "--hard");
  git(p, "clean", "-qfd");
  git(p, "stash", "clear");
}
// (#1246, point 5: a file of the core's an earlier kit wrote, at a pin no release holds and no sync wrote again, is
// known by the kit of each pin the manifest's history names)
git(p, "checkout", "-q", "-B", "earlier", LEGIT);
const BUG = ".github/ISSUE_TEMPLATE/bug_report.md", bugB = read(p, BUG);
write(p, BUG, `${bugB}${Z_LINE}`);
git(p, "commit", "-qam", "as Z's kit wrote it");
const unknown = node(p, "core/scripts/sync.mjs", B);
for (const pin of [Z, B]) { write(p, "core-manifest.md", manifest(OWNER, pin)); git(p, "commit", "-qam", `the manifest at ${SHA(pin)}`); }
const known = node(p, "core/scripts/sync.mjs", B);
ok(unknown.out.includes(`${BUG} is not the core's`) && read(p, BUG) === bugB && !known.out.includes(`${BUG} is not the core's`),
  "a file as the kit of a pin the manifest's history names wrote it, and no release's, is the core's, written again as the kit writes it", `${unknown.out}\n${known.out}`);
// (and the proof knows it by the same kits, read from the history of the project's main: a main whose manifest named Z
// before A, the file as Z's kit wrote it, synced to B, is a pure sync)
git(p, "reset", "-q", "--hard");
git(p, "checkout", "-q", "-B", "earlier-main", base);
write(p, BUG, `${bugB}${Z_LINE}`);
// (and its CLAUDE.md holds Z's part and, outside it, an import Z's kit wrote whose path B's copy holds: the sync keeps
// it, and so does the proof, which reads a path in the copy from the core at the pin, not from the project; point 4)
write(p, "CLAUDE.md", read(p, "CLAUDE.md").replace("@core/tools/claude.md\n", `@core/tools/claude.md\n${KEPT}`).replace("<!-- The core's part:", `${KEPT}\n<!-- The core's part:`));
for (const pin of [Z, A]) { write(p, "core-manifest.md", manifest(OWNER, pin)); git(p, "commit", "-qam", `the manifest at ${SHA(pin)}, the file as Z's kit wrote it`); }
git(p, "push", "-q", "-f", "origin", "HEAD:main");
const fromZ = node(p, "core/scripts/sync.mjs", B);
git(p, "stash", "clear"); git(p, "add", "-A"); git(p, "commit", "-qm", "sync, the file as Z's kit wrote it");
const provedZ = pure();
ok(fromZ.status === 0 && read(p, BUG) === bugB && provedZ.status === 0 && provedZ.out.includes("a pure sync"),
  "  and the proof renders it by the same kits, read from the history of the project's main, so the sync is pure", `${fromZ.out}\n---\n${provedZ.out}`);
ok(read(p, "CLAUDE.md").startsWith(`# Claude's part\n`) && read(p, "CLAUDE.md").split(KEPT).length === 2 && read(p, "CLAUDE.md").includes(`${KEPT}\n<!-- The core's part:`) && provedZ.status === 0,
  "  and an earlier kit's import outside the core's part, its path in the copy, is kept by the sync and by the proof (#1246, point 4)", read(p, "CLAUDE.md"));
git(p, "reset", "-q", "--hard");
git(p, "checkout", "-q", "more");
write(p, "core-manifest.md", manifest("someone-else"));
git(p, "commit", "-q", "-am", "another owner");
const other = git(p, "rev-parse", "HEAD");
git(p, "push", "-q", "-f", "origin", "HEAD:main"); // (the project of another owner is now main's own)
const none = node(p, "core/scripts/sync.mjs");
ok(none.status === 0 && none.out.includes("no release yet") && git(p, "status", "--porcelain") === "", "a project of another owner follows the releases: where the core has cut none, it takes nothing", none.out);
git(theCore, "tag", "release-1", A);
const atOne = node(p, "core/scripts/sync.mjs");
ok(atOne.status === 0 && atOne.out.includes("release-1") && git(p, "status", "--porcelain") === "", "where the newest release is the project's own pin, it takes nothing", atOne.out);
git(theCore, "tag", "release-2", B);
const atTwo = node(p, "core/scripts/sync.mjs");
ok(atTwo.status === 0 && atTwo.out.includes(`${SHA(A)} -> ${SHA(B)} (release-2)`) && read(p, "core-manifest.md") === manifest("someone-else", B), "and once a newer release is cut, it takes that release", atTwo.out);
git(p, "add", "-A"); git(p, "commit", "-q", "-m", "to release-2"); // (with what the sync added: a new entry is a file)
const released = pure();
ok(released.status === 0 && released.out.includes("a pure sync"), "  a sync to a release, in a project that follows the releases, is pure", released.out);
// (it takes a commit of main that is no release only through review: the sync is made, and is no pure sync; core archive 201)
write(theCore, "c.md", "only in C\n");
const C = commit("C");
git(p, "checkout", "-q", "-B", "unreleased", other);
const toC = node(p, "core/scripts/sync.mjs", C);
git(p, "add", "-A"); git(p, "commit", "-q", "-m", "to C");
const unreleased = pure();
ok(toC.status === 0 && read(p, "core-manifest.md") === manifest("someone-else", C) && unreleased.status === 1 && unreleased.out.includes(`${C} is no release of the core: the sync is reviewed like any PR`) && unreleased.out.includes(`node core/scripts/sync.mjs ${B}\` (release-2, the newest)`) && unreleased.out.includes(`ask the trial's reading instead, \`--trial ${C}\``),
  "a sync to a commit no release, where the releases are followed, is no pure sync: it is reviewed, or made again at the newest release, and in a trial asks the trial's reading", `${toC.out}\n${unreleased.out}`);
// (a release's trial asks the same proof against the commit it tries, as a reading: it reads that commit as the release
// it is to be, prints no head to merge and never exits 0, so nothing that waits on the proof takes it for one; #1261)
const answer = out => { const m = /^trial answer: (.*)$/mu.exec(out); try { return m && JSON.parse(m[1]); } catch { return null; } };
const triedC = pure("--trial", C);
ok(triedC.status === 1 && triedC.out.includes(`a pure sync against the commit tried, ${C}: a trial's reading, which proves no merge`) && !triedC.out.includes("sha=") && !triedC.out.includes("NOT PURE")
  && JSON.stringify(answer(triedC.out)) === JSON.stringify({ commit: C, pure: true, from: "release-1" }),
  "  a trial's reading against the commit tried finds the same sync pure, names the release main's copy stood at, and gives no head to merge", triedC.out);
const triedB = pure("--trial", B);
ok(triedB.status === 1 && triedB.out.includes(`moves the copy to ${C}, not to the commit tried, ${B}`) && answer(triedB.out)?.pure === false && answer(triedB.out)?.commit === B,
  "  a trial's reading against another commit than the sync's is not pure", triedB.out);
// (a trial's clone with no origin, its main a branch of its own, reads that main, where the merge's gate, which takes
// main from the origin alone, says it is not proved and its mend; #1361, point 15)
const lone = path.join(tmp, "lone");
git(tmp, "init", "-q", "-b", "lone", lone);
git(lone, "fetch", "-q", origin, "main:main");
git(lone, "fetch", "-q", p, "unreleased:unreleased");
git(lone, "checkout", "-q", "unreleased");
const inLone = (...args) => { const r = spawnSync(process.execPath, [path.join(theCore, "scripts", "pure-sync.mjs"), ...args], { cwd: lone, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const loneTried = inLone("--trial", C), loneGate = inLone();
ok(loneTried.status === 1 && answer(loneTried.out)?.commit === C && answer(loneTried.out)?.from === "release-1" && /^read against the clone's own branch main, as the clone has no origin/mu.test(loneTried.out) && !loneTried.out.includes("NOT PURE") && !loneTried.out.includes("sha="),
  "  a trial's clone with no origin gives its reading, read against the clone's own main, which it names", loneTried.out);
ok(loneGate.status === 1 && loneGate.out.includes("NOT PURE the clone has no origin to fetch the project's main from") && loneGate.out.includes("Mend: run it in a clone of the project's repository whose origin") && !loneGate.out.includes("sha="),
  "  and the merge's gate there says it is not proved, with its mend, never a head to merge", loneGate.out);
git(lone, "branch", "-q", "-D", "main");
const mainless = inLone("--trial", C);
ok(mainless.status === 1 && mainless.out.includes("NOT PURE the project's main (the clone's own branch main, as the clone has no origin) shares no commit") && answer(mainless.out)?.pure === false && answer(mainless.out)?.from === "unknown",
  "  and where that clone holds no main, its reading is not pure, with its mend", mainless.out);
const triedName = pure("--trial", "main"), triedMore = pure("--trial", C, "--merge");
ok([triedName, triedMore].every(r => r.status === 2 && !/^a pure sync/mu.test(r.out) && !r.out.includes("sha=") && answer(r.out) === null),
  "  and one that names no full SHA, or more than it, is refused before anything is read", `${triedName.out}\n${triedMore.out}`);
// (and a manifest that does not say what it follows, two rows of it, is read as following nothing: no sync to a commit
// that is no release is pure there either)
git(p, "checkout", "-q", "-B", "unclear", other);
write(p, "core-manifest.md", `${manifest("someone-else")}| *follows* | \`main\` |\n| *follows* | \`releases\` |\n`);
git(p, "commit", "-q", "-am", "two rows");
git(p, "push", "-q", "-f", "origin", "HEAD:main");
const toCAgain = node(p, "core/scripts/sync.mjs", C);
git(p, "add", "-A"); git(p, "commit", "-q", "-m", "to C");
const unclear = pure();
ok(unclear.status === 1 && unclear.out.includes(`does not say what it follows, and ${C} is no release of the core`), "a sync to a commit that is no release, in a project whose manifest does not say what it follows, is no pure sync either", `${toCAgain.out}\n${unclear.out}`);

// (a release tag on a commit off the core's main comes in with the tags, so that commit is there to read: a pin at it is
// still no commit of main)
git(p, "push", "-q", "-f", "origin", `${base}:main`);
git(p, "checkout", "-q", "-B", "side", LEGIT);
git(theCore, "tag", "release-3", SIDE);
write(p, "core-manifest.md", manifest(OWNER, SIDE));
write(p, ".github/workflows/core.yml", calls.replace(`personal-terms.yml@${B}`, `personal-terms.yml@${SIDE}`));
git(p, "commit", "-q", "-am", "to the side");
const tagged = pure();
ok(tagged.status === 1 && tagged.out.includes(`${SIDE} is not a commit of the core's main`), "a pin at a commit off the core's main that a release tag names is no commit of main all the same", tagged.out);

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the sync and the proof that it is pure`);
process.exitCode = failed ? 1 : 0;
