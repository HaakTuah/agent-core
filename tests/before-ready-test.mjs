// Tests of the checks a builder runs before ready (before-ready.mjs; #1413, point 6): the core's two jobs read as the
// host runs them, every value they ask known, and the script run on scratch repositories in the core's form and a
// project's, on the merge it makes. Git and Node's own modules, and the YAML reader.
//
//   node tests/before-ready-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPRESSIONS, JOBS, stepsOf } from "../scripts/before-ready.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };
const script = fileURLToPath(new URL("../scripts/before-ready.mjs", import.meta.url)), root = path.dirname(path.dirname(script));

// the core's own jobs, as they stand: every value a step asks is one the script gives, the description where the host
// gives it, a ready pull request's, and the steps that read the pull request's comments left to the host
{
  const steps = stepsOf(root, { body: "the body", created: "2026-11-28T00:00:00Z", base: "abc" });
  const named = re => steps.find(s => re.test(s.name));
  const description = named(/^own-description\.yml: The description has its parts/u), split = named(/^size\.yml: A file past the split mark/u);
  ok(description?.env.PR_BODY === "the body" && description.env.BASE_SHA === "abc" && description.env.DRAFT === "false" && /pr-description\.mjs/u.test(description.run)
    && split?.env.SIZES_BASE === "HEAD^1" && /reading-size\.mjs/u.test(split.run) && named(/^size\.yml: What each role reads at its start/u)?.env.BASE === "HEAD^1"
    && steps.filter(s => s.host).length === 3 && steps.every(s => s.host || !/\$\{\{/u.test(s.run + Object.values(s.env).join(""))),
    "the core's description and size jobs are read as the host runs them on a ready pull request, every value they ask given, and the three steps that read its comments left to the host", JSON.stringify(steps.map(s => s.name)));
  ok(JOBS.length === 2 && Object.keys(EXPRESSIONS).length > 0, "it reads own-description.yml's job and size.yml's");
}

// a scratch repository in the core's form: its two workflows, whose steps stand in for the checks
const tmp = scratchDir("before-ready-");
const env = { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.invalid", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1" };
const git = (dir, ...args) => execFileSync("git", ["-C", dir, ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const write = (dir, f, text) => { fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
const repo = name => { const dir = path.join(tmp, name); fs.mkdirSync(dir); git(dir, "init", "-q", "-b", "main"); return dir; };
const core = repo("core");
write(core, ".github/workflows/own-description.yml", `name: own-description
jobs:
  own-description:
    steps:
      - uses: actions/checkout@v0
      - name: The description has its parts
        env:
          PR_BODY: \${{ github.event.pull_request.body }}
          DRAFT: \${{ github.event.pull_request.draft }}
        run: |
          git rev-parse -q --verify HEAD^2 > /dev/null || { echo "FAIL not on a merge. Mend: make one"; exit 1; }
          if printf '%s' "$PR_BODY" | grep -q '^## What the owner can try'; then echo "ok   the parts (draft: $DRAFT)"; else echo 'FAIL the description has no heading "What the owner can try". Mend: add it'; exit 1; fi
`);
write(core, ".github/workflows/size.yml", `name: size
jobs:
  size:
    steps:
      - name: The pull request's comments
        env:
          NUMBER: \${{ github.event.pull_request.number }}
        run: mkdir -p "$RUNNER_TEMP/raise"
      - name: A file past the split mark
        if: \${{ github.event_name == 'pull_request' }}
        env:
          SIZES_BASE: HEAD^1
        run: test -f head.md && echo "ok   the sizes, against $SIZES_BASE"
`);
write(core, "base.md", "the base\n");
git(core, "add", "-A"); git(core, "commit", "-q", "-m", "base");
git(core, "checkout", "-q", "-b", "change"); write(core, "head.md", "the change\n"); git(core, "add", "-A"); git(core, "commit", "-q", "-m", "change");
const description = text => { const f = path.join(tmp, `description-${count}.md`); fs.writeFileSync(f, text); return f; };
const run = (dir, ...args) => { const r = spawnSync(process.execPath, [script, ...args], { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: r.stdout + r.stderr }; };
const trees = dir => git(dir, "worktree", "list", "--porcelain").split("\n").filter(l => l.startsWith("worktree ")).length;

let r = run(core, description("Built so.\n"), "--base", "main");
ok(r.status === 1 && /FAIL the description has no heading "What the owner can try"/u.test(r.out) && /FAIL 1 of the checks the host runs before ready failed: own-description\.yml: The description has its parts\./u.test(r.out) && mended(r.out),
  "a description that lacks a part fails before ready, on the merge the host checks, each failure with its mend", r.out);
ok(/ok {3}the sizes, against HEAD\^1/u.test(r.out) && /== size\.yml: The pull request's comments\nnote read on the host alone/u.test(r.out), "  the steps that pass run too, and the one that reads the pull request's comments is left to the host", r.out);
r = run(core, description("Built so.\n\n## What the owner can try\nNone.\n"), "--base", "main");
ok(r.status === 0 && /ok {3}the parts \(draft: false\)/u.test(r.out) && /ok {3}the description and size checks pass on the merge/u.test(r.out), "the description mended, it passes, read as a ready pull request's", r.out);
ok(trees(core) === 1 && git(core, "branch", "--show-current").trim() === "change" && git(core, "status", "--porcelain").trim() === "", "  and it leaves no worktree, the branch and its files as they were");
fs.appendFileSync(path.join(core, "head.md"), "not committed\n");
ok(/note what is not committed is not read/u.test(run(core, description("## What the owner can try\nNone.\n"), "--base", "main").out), "what is not committed is said, never read");
git(core, "checkout", "-q", "--", "head.md");
// (a base the branch cannot merge into)
git(core, "checkout", "-q", "main"); write(core, "head.md", "another\n"); git(core, "add", "-A"); git(core, "commit", "-q", "-m", "a conflict"); git(core, "checkout", "-q", "change");
r = run(core, description("## What the owner can try\nNone.\n"), "--base", "main");
ok(r.status === 1 && /FAIL the branch does not merge into main without a conflict/u.test(r.out) && mended(r.out) && trees(core) === 1, "a branch that does not merge into its base fails, saying to bring it up to date, and leaves no worktree", r.out);
// (a step that asks a value the script does not know)
const odd = repo("odd");
write(odd, ".github/workflows/own-description.yml", "jobs:\n  own-description:\n    steps:\n      - name: odd\n        run: echo \"${{ github.event.pull_request.title }}\"\n");
write(odd, ".github/workflows/size.yml", "jobs:\n  size:\n    steps: []\n");
git(odd, "add", "-A"); git(odd, "commit", "-q", "-m", "base");
r = run(odd, description("## What the owner can try\nNone.\n"), "--base", "HEAD");
ok(r.status === 1 && /holds \$\{\{ github\.event\.pull_request\.title \}\}, which this script does not know the value of/u.test(r.out) && mended(r.out), "a step that asks a value the script does not know fails, saying to add it", r.out);
ok(run(core).status === 1 && mended(run(core, "--base").out) && mended(run(core, path.join(tmp, "missing.md")).out) && mended(run(core, description("x"), "--created", "never").out),
  "with no description, a flag with no value, a file it cannot read or a time that is none, it fails with its mend");

// a project: its copy's checks.mjs, with the parts copies and description, on the merge
const project = repo("project");
write(project, "core-manifest.md", "# Core manifest\n");
write(project, "core/scripts/checks.mjs", `import fs from "node:fs";\nconst a = process.argv.slice(2);\nconsole.log("args", JSON.stringify(a.map(x => x.endsWith("description.md") ? "<file>" : x)), "body", JSON.stringify(fs.readFileSync(a[a.indexOf("--description") + 1], "utf8")));\n`);
git(project, "add", "-A"); git(project, "commit", "-q", "-m", "base");
git(project, "checkout", "-q", "-b", "change"); write(project, "x.md", "x\n"); git(project, "add", "-A"); git(project, "commit", "-q", "-m", "change");
r = run(project, description("the project's description\n"), "--base", "main");
ok(r.status === 0 && r.out.includes(`args ["copies","description","--description","<file>","--base","HEAD^1"] body "the project's description\\n"`) && trees(project) === 1,
  "in a project it runs its copy's checks.mjs with the parts copies and description, on the description given, against the merge's base", r.out);

console.log(failed ? `\n${failed} of ${count} failed` : `ok   ${count} assertions on the checks before ready`);
process.exit(failed ? 1 : 0);
