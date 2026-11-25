// Tests of the base the core's workflows name on a pull request: HEAD^1, the first parent of the merge their checkout
// holds at depth 2, where the event's base commit may not be and cannot be fetched with no token (#1231). The lookup
// (lookup.mjs, and licences.mjs beside the licence check) reads LOOKUP_BASE=HEAD^1 as that commit only where HEAD is a
// merge, failing as a base not held on a head alone; checks.mjs gives its signature and NuGet parts --base HEAD^1 as
// that commit. Which steps name it is held by tests/workflows-test.mjs. Git and Node's own modules.
//
//   node tests/base-parent-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { alongside } from "../scripts/licences.mjs";
import { namedBase } from "../scripts/lookup.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";

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

// the lookup: HEAD^1 named is the base on a merge, and a base not held on a head alone
{
  const dir = path.join(tmp, "lookup");
  fs.mkdirSync(dir);
  git(dir, "init", "-q", "-b", "main");
  write(dir, { "c.json": JSON.stringify({ ships: ["package.json"], lockfiles: ["package-lock.json"] }), "package.json": JSON.stringify({ name: "p", dependencies: { a: "^1.2.3" } }),
    "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "p", dependencies: { a: "^1.2.3" } }, "node_modules/a": { version: "1.2.3", license: "MIT", resolved: "https://registry.npmjs.org/a/-/a-1.2.3.tgz" } } }) });
  git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "base");
  const was = { log: console.log, error: console.error, event: process.env.GITHUB_EVENT_NAME, base: process.env.LOOKUP_BASE };
  const named = (name) => { process.env.LOOKUP_BASE = name; return namedBase(dir); };
  const run = async (name) => {
    const lines = [];
    console.log = console.error = (l) => lines.push(String(l));
    process.env.GITHUB_EVENT_NAME = "pull_request"; process.env.LOOKUP_BASE = name;
    try { return { failed: await alongside(path.join(dir, "c.json"), dir), out: lines.join("\n") }; } finally { console.log = was.log; console.error = was.error; }
  };
  try {
    write(dir, { "y.txt": "y" }); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "an earlier commit of the head");
    ok(named("HEAD^1") === null, "HEAD^1 named on a head that is no merge is not taken: it would be the pull request's own earlier commit");
    const alone = await run("HEAD^1");
    ok(alone.failed && /^FAIL: the lookup of the packages new to the project cannot run: the job names the pull request's base \(LOOKUP_BASE\), and its checkout does not hold that commit\. Mend: /mu.test(alone.out),
      "and beside the licence check it fails as a base not held, saying its mend", alone.out);
    const { base } = merged(dir);
    ok(named("HEAD^1") === base, "HEAD^1 named on a merge is read as its first parent, the base, as a commit", named("HEAD^1"));
    ok(named(base) === base && named("f".repeat(40)) === null, "a commit named is read where the checkout holds it, and not where it does not");
    const read = await run("HEAD^1");
    ok(!read.failed && /stood so at the pull request's base: reported, never failed/u.test(read.out) && !/^FAIL/mu.test(read.out), "and beside the licence check it reads what stood at the base, reported, never failed", read.out);
    for (const other of ["HEAD^2", "HEAD~1", "--all", "main", "HEAD^1 "]) ok(named(other) === null, `a base named ${JSON.stringify(other)}, neither a commit nor HEAD^1, is not taken`);
  } finally {
    for (const [k, v] of [["GITHUB_EVENT_NAME", was.event], ["LOOKUP_BASE", was.base]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

// checks.mjs: its signature and NuGet parts read --base HEAD^1 as the merge's first parent, with no BASE_SHA
{
  const dir = path.join(tmp, "checks");
  fs.mkdirSync(path.join(dir, "core/scripts"), { recursive: true });
  for (const f of ["checks.mjs", "core-address.mjs", "core-path.mjs", "mend.mjs", "started.mjs", "workflow-run.mjs", "parse-yaml.mjs", "guards.mjs", "yaml-keys.mjs", "packages.mjs", "npm-reads.mjs"]) fs.copyFileSync(path.join(root, "scripts", f), path.join(dir, "core/scripts", f));
  for (const f of ["package.json", "package-lock.json", ".npmrc", "node_modules/.package-lock.json", "node_modules/yaml"]) fs.cpSync(path.join(root, ".packages", f), path.join(dir, "core/.packages", f), { recursive: true });
  // (stand-ins that print the base they were given: the lookup, and NuGet's first look, which says nothing changed)
  write(dir, { "core/scripts/lookup.mjs": "console.log(`ran lookup.mjs LOOKUP_BASE=${process.env.LOOKUP_BASE}`);\n",
    "core/scripts/nuget-look.sh": 'echo "ran nuget-look.sh BASE=$BASE"\necho "run=false" >> "$GITHUB_OUTPUT"\n', "core/.node-version": "22\n", "web/package.json": "{}\n" });
  git(dir, "init", "-q", "-b", "main"); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "base");
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
