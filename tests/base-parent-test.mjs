// Tests of the base the core's workflows name on a pull request: HEAD^1, the first parent of the merge their checkout
// holds at depth 2, where the event's base commit may not be and cannot be fetched with no token (#1231). The lookup's
// reading of it is tests/lookup-run-test.mjs's; checks.mjs gives its signature and NuGet parts --base HEAD^1 as
// that commit. Which steps name it is held by tests/workflows-test.mjs. Git and Node's own modules.
//
//   node tests/base-parent-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { loadedBy, root, scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("base-parent-test-");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(GIT_|GITHUB_|RUNNER_|PR_|BASE_SHA$|LOOKUP_BASE$|CALLER$)|TOKEN|SECRET/i.test(name)));
Object.assign(env, { GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" });
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const write = (dir, files) => { for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); } };
// (a base commit, a head commit after it, and the merge a pull request's run checks out: HEAD^1 the base, HEAD^2 the head)
function merged(dir) {
  const base = git(dir, "rev-parse", "HEAD");
  write(dir, { "x.txt": "x" }); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "head");
  const head = git(dir, "rev-parse", "HEAD");
  git(dir, "checkout", "-q", "--detach", base); git(dir, "merge", "-q", "--no-ff", "-m", "the merge", head);
  return { base, head };
}

// checks.mjs: its signature and NuGet parts read --base HEAD^1 as the merge's first parent, with no BASE_SHA
{
  const dir = path.join(tmp, "checks");
  fs.mkdirSync(path.join(dir, "core/scripts"), { recursive: true });
  for (const f of loadedBy("checks.mjs")) fs.copyFileSync(path.join(root, "scripts", f), path.join(dir, "core/scripts", f));
  for (const f of ["package.json", "package-lock.json", ".npmrc", "node_modules/.package-lock.json", "node_modules/yaml"]) fs.cpSync(path.join(root, ".packages", f), path.join(dir, "core/.packages", f), { recursive: true });
  // (stand-ins that print the base they were given: the lookup, and NuGet's first look, which says nothing changed)
  write(dir, { "core/scripts/lookup.mjs": "console.log(`ran lookup.mjs LOOKUP_BASE=${process.env.LOOKUP_BASE}`);\n",
    "core/scripts/nuget-look.sh": 'echo "ran nuget-look.sh BASE=$BASE"\necho "run=false" >> "$GITHUB_OUTPUT"\n', "core/.node-version": "22\n", "web/package.json": "{}\n" });
  git(dir, "init", "-q", "-b", "main"); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "base");
  // (the first commit alone: HEAD is no merge)
  const alone = spawnSync(process.execPath, ["core/scripts/checks.mjs", "nuget", "--nuget", "checks/licences.json", "--base", "HEAD^1"], { cwd: dir, env, encoding: "utf8" });
  ok(alone.status === 1 && /HEAD is no merge/.test(alone.stdout + alone.stderr) && mended(alone.stdout + alone.stderr), "on a head that is no merge, --base HEAD^1 fails, saying the mend", alone.stdout + alone.stderr);
  const { base } = merged(dir);
  const run = (args) => { const r = spawnSync(process.execPath, ["core/scripts/checks.mjs", ...args, "--base", "HEAD^1"], { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
  const nuget = run(["nuget", "--nuget", "checks/licences.json"]);
  ok(nuget.status === 0 && nuget.out.includes(`ran lookup.mjs LOOKUP_BASE=${base}`) && nuget.out.includes(`ran nuget-look.sh BASE=${base}`),
    "nuget: --base HEAD^1 on a merge gives the lookup and the first look its first parent, the base, as a commit", nuget.out);
  const signed = run(["signatures", "--signatures", "web"]);
  ok(signed.status === 0 && /nothing to verify/.test(signed.out) && !/^== Install/m.test(signed.out), "signatures: --base HEAD^1 on a merge reads the change against its first parent, the base, which changed no package file", signed.out);
}

fs.rmSync(tmp, { recursive: true, force: true });
done("the base named as HEAD^1, the merge's first parent");
