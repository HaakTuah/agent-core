#!/usr/bin/env node
// The description and size checks, run by a builder on its own machine before it marks its pull request ready
// (roles/shared/work-flow.md, "A description is written in as few edits as the work allows"; #1413, point 6), on the
// description it is about to write, so that a failure is mended before the host runs them. It makes the merge the
// host's run checks, the branch's commit merged into the base in a worktree of its own outside the repository, and runs
// there what the host runs on it:
//   - in the core's own repository (no core manifest at its root), the steps of own-description.yml's job and size.yml's
//     as they stand, each with the values the host would give it (EXPRESSIONS) and the description read from the file;
//     a step that reads the pull request's comments (a raise of a cap, its "Leanness check:") is the host's alone, and
//     said so;
//   - in a project, its copy's checks.mjs, with the parts copies (the reading-size check among them) and description,
//     as its own job runs them.
// Only committed work is read: what is not committed is said, never read. The worktree and its merge go once it ends;
// the merge's author is a name of this script's, no one's. Git and Node's own modules, and the YAML reader.
//
//   node core/scripts/before-ready.mjs <a file that holds the description> [--base <rev>] [--created <the PR's opening, ISO>]
//        (in the core's own repository: node scripts/before-ready.mjs ...; the base: origin/main, fetched, by default)
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MANIFEST, corePath } from "./core-path.mjs";
import { MEND } from "./mend.mjs";
import { parseYaml } from "./parse-yaml.mjs";

// The jobs the host runs on the core's own pull requests that this reads: own-description.yml's and size.yml's.
export const JOBS = [[".github/workflows/own-description.yml", "own-description"], [".github/workflows/size.yml", "size"]];
// What each expression a step of theirs holds stands for here, given the description, the base and the opening.
export const EXPRESSIONS = {
  "github.event.pull_request.body": v => v.body,
  "github.event.pull_request.created_at": v => v.created,
  "github.event.pull_request.base.sha": v => v.base,
  "github.event.pull_request.draft": () => "false",
  "github.token": () => process.env.GH_TOKEN ?? "",
  "github.event_name == 'pull_request' && 'HEAD^1' || ''": () => "HEAD^1",
  "github.event_name == 'pull_request'": () => "true",
};
// A step the host alone can run: it reads the pull request's comments, through files its first step puts by.
const HOSTS = /\$RUNNER_TEMP\b/u;

const fail = (what, mend) => { console.error(`FAIL ${what} ${MEND}${mend}`); process.exit(1); };
const expr = /\$\{\{\s*(.*?)\s*\}\}/gu;

// The steps of the core's two jobs as this runs them: { name, run, env } with each value given, or { name, host: true }
// for a step the host alone runs; one whose expression stands nowhere in EXPRESSIONS throws, its mend with it.
export function stepsOf(top, values) {
  const out = [];
  for (const [file, job] of JOBS) {
    let steps;
    try { steps = parseYaml(fs.readFileSync(path.join(top, file), "utf8")).jobs[job].steps; } catch (e) { throw new Error(`${file}'s job ${job} could not be read (${e.message}). ${MEND}run this from the core's own repository, its workflows as the default branch holds them.`); }
    for (const s of steps) {
      if (typeof s.run !== "string") continue;
      const name = `${file.slice(file.lastIndexOf("/") + 1)}: ${s.name ?? s.run.split("\n")[0]}`;
      if (HOSTS.test(s.run) || Object.values(s.env ?? {}).some(v => HOSTS.test(String(v)))) { out.push({ name, host: true }); continue; }
      const given = text => String(text).replace(expr, (all, e) => {
        if (!(e in EXPRESSIONS)) throw new Error(`the step "${name}" holds \${{ ${e} }}, which this script does not know the value of. ${MEND}add it to EXPRESSIONS in scripts/before-ready.mjs with the value the host gives it on a pull request, or run the step on the host.`);
        return EXPRESSIONS[e](values);
      });
      if (s.if !== undefined && given(s.if).trim() !== "true") continue;
      out.push({ name, run: given(s.run), env: Object.fromEntries(Object.entries(s.env ?? {}).map(([k, v]) => [k, given(v)])) });
    }
  }
  return out;
}

// The repository's owner and name, as the host names it, from the address of origin, for the checks that read the host.
function repoOf(top) {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try { return /([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(\.git)?\/?$/u.exec(execFileSync("git", ["-C", top, "remote", "get-url", "origin"], { encoding: "utf8" }).trim())?.[1] ?? ""; } catch { return ""; }
}

function main(args) {
  const at = flag => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
  const file = args.find((a, i) => !a.startsWith("--") && !["--base", "--created"].includes(args[i - 1]));
  if (!file || args.some((a, i) => a.startsWith("--") && !["--base", "--created"].includes(a)) || ["--base", "--created"].some(f => args.includes(f) && !at(f))) fail("this script takes a file that holds the description, and at most --base <rev> and --created <time>.", "run node core/scripts/before-ready.mjs <a file that holds the description> [--base <rev>] [--created <the pull request's opening, ISO>].");
  let body;
  try { body = fs.readFileSync(file, "utf8"); } catch { fail(`${file} cannot be read.`, "write the description you are about to give the pull request into a file, and give its path."); }
  const created = at("--created") ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(created))) fail(`--created ${created} is no time.`, "give the pull request's opening as GitHub gives it, such as 2026-11-28T09:00:00Z, or leave it out for now.");
  const git = (cwd, ...a) => execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  let top;
  try { top = git(".", "rev-parse", "--show-toplevel").trim(); } catch { fail("this is no git repository.", "run it from the clone of the repository whose pull request it is."); }
  const baseName = at("--base") ?? "origin/main";
  if (!at("--base")) { try { git(top, "fetch", "-q", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main"); } catch { console.log("note origin/main could not be fetched: the base is origin/main as this clone last fetched it"); } }
  let base, head;
  try { base = git(top, "rev-parse", "--verify", "-q", `${baseName}^{commit}`).trim(); head = git(top, "rev-parse", "HEAD").trim(); } catch { fail(`${baseName} is no commit here.`, "fetch the branch the pull request merges into (git fetch origin main), or give its commit with --base."); }
  const dirty = git(top, "status", "--porcelain", "--untracked-files=no").trim();
  if (dirty) console.log("note what is not committed is not read: the checks read the branch's commit, as the host does");
  const project = fs.existsSync(path.join(top, MANIFEST));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "before-ready-")), tree = path.join(scratch, "merge");
  const failed = [];
  try {
    git(top, "worktree", "add", "-q", "--detach", tree, base);
    const merge = spawnSync("git", ["-C", tree, "-c", "user.name=before-ready", "-c", "user.email=before-ready@example.invalid", "-c", "commit.gpgsign=false", "merge", "-q", "--no-ff", "--no-edit", head], { encoding: "utf8" });
    if (merge.status !== 0) { failed.push("the merge"); console.error(`FAIL the branch does not merge into ${baseName} without a conflict. ${MEND}bring the branch up to date with ${baseName}, mend the conflict, commit, and run this again.`); return failed; }
    const env = { ...process.env, PR_BODY: body, PR_CREATED: created, BASE_SHA: base, GITHUB_REPOSITORY: repoOf(top) };
    const run = (name, cmd, cmdArgs, more = {}) => {
      console.log(`== ${name}`);
      const r = spawnSync(cmd, cmdArgs, { cwd: tree, env: { ...env, ...more }, stdio: ["ignore", "inherit", "inherit"] });
      if (r.status !== 0) failed.push(name);
    };
    if (project) {
      const copy = corePath(tree) || "core/", text = path.join(scratch, "description.md");
      fs.writeFileSync(text, body);
      run("the copies and description checks (checks.mjs)", process.execPath, [path.join(tree, copy, "scripts/checks.mjs"), "copies", "description", "--description", text, "--base", "HEAD^1"]);
    } else {
      let steps;
      try { steps = stepsOf(tree, { body, created, base }); } catch (e) { failed.push("the steps"); console.error(`FAIL ${e.message}`); return failed; }
      for (const s of steps) {
        if (s.host) { console.log(`== ${s.name}\nnote read on the host alone, from the pull request's comments: a raise of a cap there asks its "Leanness check:" comment`); continue; }
        const script = path.join(scratch, "step.sh");
        fs.writeFileSync(script, s.run);
        run(s.name, "bash", ["--noprofile", "--norc", "-eo", "pipefail", script], s.env);
      }
    }
    return failed;
  } finally {
    spawnSync("git", ["-C", top, "worktree", "remove", "--force", tree], { stdio: "ignore" });
    spawnSync("git", ["-C", top, "worktree", "prune"], { stdio: "ignore" });
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failed = main(process.argv.slice(2));
  if (failed.length) fail(`${failed.length} of the checks the host runs before ready failed: ${failed.join("; ")}.`, "mend each FAIL above in the branch or the description's file, commit, and run this again; mark the pull request ready once it passes.");
  console.log("ok   the description and size checks pass on the merge, as the host will run them");
}
