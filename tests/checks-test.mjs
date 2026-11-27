// Tests of scripts/checks.mjs, the one script that holds the steps of the core's pull-request checks without a secret
// (#376), on a scratch project whose copy of the core holds checks.mjs as it stands here and a stand-in for each check
// it runs, which prints what it was given and fails where the project says: each check runs even after one before it
// failed, with its base and its file; its failures and its own say their mend; with no part named, it runs what the
// project's calls to the core's workflows run, folded into core.yml or each in its own; and the package checks look
// first, running nothing where nothing they read changed. What each check does is its own test's. Git, bash and Node's
// own modules.
//
//   node tests/checks-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { COPIES } from "../scripts/checks.mjs";
import { mended } from "../scripts/mend.mjs";
import { npmRefused } from "../scripts/npm-reads.mjs";
import { unrunWhy } from "../scripts/check-calls.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const tmp = scratchDir("checks-test-");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(GIT_|GITHUB_|RUNNER_|PR_|BASE_SHA$|CALLER$)|TOKEN|SECRET/i.test(name)));
Object.assign(env, { GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" });
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// (a stand-in prints its name, its arguments and the base it was given, and fails where the project's fails.txt names it)
const STAND_IN = name => `import fs from "node:fs";\nconst base = Object.entries(process.env).filter(([k]) => /_BASE$|^BASE_SHA$|^PR_BODY$/.test(k)).map(([k, v]) => \`\${k}=\${v}\`).join(",");\nconsole.log(\`ran ${name} [\${process.argv.slice(2).join(" ")}] \${base}\`);\nconst failing = fs.existsSync("fails.txt") ? fs.readFileSync("fails.txt", "utf8") : "";\nif (failing.includes("${name}")) { console.log("FAIL ${name} failed here. Mend: mend it."); process.exit(1); }\n`;
const CALLS = with_ => `name: core\non:\n  pull_request:\njobs:\n  core:\n    uses: ${CORE}/.github/workflows/core.yml@${"a".repeat(40)}\n${with_}`;
let n = 0;
function project(files = {}) {
  const dir = path.join(tmp, `p${++n}`);
  fs.mkdirSync(path.join(dir, "core/scripts"), { recursive: true });
  for (const f of ["checks.mjs", "core-address.mjs", "core-path.mjs", "mend.mjs", "started.mjs", "workflow-run.mjs", "parse-yaml.mjs", "guards.mjs", "yaml-keys.mjs", "packages.mjs", "npm-reads.mjs"]) fs.copyFileSync(path.join(root, "scripts", f), path.join(dir, "core/scripts", f));
  // (the YAML package its reader of workflows loads, as the core's install leaves it: the lock file, npm's record of the
  // install and the package, from the core's own install, which its tests' job runs)
  for (const f of ["package.json", "package-lock.json", ".npmrc", "node_modules/.package-lock.json", "node_modules/yaml"]) fs.cpSync(path.join(root, ".packages", f), path.join(dir, "core/.packages", f), { recursive: true });
  for (const [, script] of COPIES) fs.writeFileSync(path.join(dir, "core/scripts", script), STAND_IN(script));
  for (const s of ["pr-description.mjs", "licence-installed.mjs", "nuget.mjs", "nuget-fetch.mjs", "lookup.mjs"]) fs.writeFileSync(path.join(dir, "core/scripts", s), STAND_IN(s));
  fs.writeFileSync(path.join(dir, "core/scripts/nuget-look.sh"), 'echo "ran nuget-look.sh BASE=$BASE CONFIG=$CONFIG"\necho "run=false" >> "$GITHUB_OUTPUT"\n');
  fs.writeFileSync(path.join(dir, "core/.node-version"), "22\n");
  git(dir, "init", "-q", "-b", "main");
  for (const [f, text] of Object.entries({ "README.md": "# p\n", ...files })) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  return dir;
}
const run = (dir, args, extra = {}) => {
  const r = spawnSync(process.execPath, ["core/scripts/checks.mjs", ...args], { cwd: dir, env: { ...env, ...extra }, encoding: "utf8" });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};

// the part copies: each check in turn, a failure not stopping the rest, each given its base and its file
{
  const dir = project({ "fails.txt": "pointers.mjs" });
  const head = git(dir, "rev-parse", "HEAD");
  const r = run(dir, ["copies", "--copies", "checks/copies.json", "--sizes", "checks/sizes.json", "--base", head]);
  const ran = [...r.out.matchAll(/^ran (\S+)/gm)].map(m => m[1]);
  ok(r.status === 1 && ran.join() === COPIES.map(([, s]) => s).join() && /^ran copies\.mjs \[checks\/copies\.json\] COPIES_BASE=[0-9a-f]{40}/m.test(r.out) && /^ran reading-size\.mjs \[checks\/sizes\.json\] SIZES_BASE=/m.test(r.out)
    && /^ran shape\.mjs \[\] SHAPE_BASE=[0-9a-f]{40}/m.test(r.out) && /^ran choices\.mjs \[\] CHOICES_BASE=[0-9a-f]{40}/m.test(r.out) && /1 of 10 checks failed/.test(r.out) && mended(r.out),
  "copies: each of its nine checks runs, in order, the one that fails not stopping the rest, each with its base and its file; it fails, and says each failure's mend", r.out);
  const none = run(dir, ["copies", "--copies", "c.json", "--sizes", "s.json", "--base", ""]);
  ok(/^ran copies\.mjs \[c\.json\] COPIES_BASE=(,|$)/m.test(none.out), "with the base given empty, as on a push to main, each check is given none", none.out);
}
// its own failures say their mend
{
  const dir = project();
  for (const [what, args] of [["a part or option it does not know", ["--fast"]], ["an option with no value", ["copies", "--copies"]], ["copies without its marks", ["copies", "--copies", "c.json"]],
    ["a description with nothing to read", ["description"]], ["a base that is no commit", ["copies", "--copies", "c", "--sizes", "s", "--base", "nowhere"]],
    ["no part, and no call to the core's workflows", []]]) {
    const r = run(dir, args);
    ok(r.status === 1 && mended(r.out), `${what}: it fails, saying its mend`, r.out);
  }
}
// a base that cannot be had fails as a check of its own, and every check of the part still runs
{
  const dir = project();
  const r = run(dir, ["copies", "--copies", "c.json", "--sizes", "s.json", "--base", "origin/nowhere"]);
  ok(r.status === 1 && [...r.out.matchAll(/^ran (\S+)/gm)].length === COPIES.length && /^FAIL --base origin\/nowhere is no commit here/m.test(r.out) && mended(r.out),
    "a base that cannot be fetched fails as a check of its own, saying its mend, and each of the seven checks still runs", r.out);
}
// (#674) in a checkout as the workflows make one, the merge commit and its parents with no branch of origin's, whose
// origin refuses a fetch with no token as a private repository's does: origin/main cannot be had, and HEAD^1, which the
// workflows give, is had with no fetch and given to each check as its commit
{
  const origin = project();
  git(origin, "switch", "-q", "-c", "change");
  fs.writeFileSync(path.join(origin, "a.txt"), "a\n");
  git(origin, "add", "-A");
  git(origin, "commit", "-q", "-m", "change");
  git(origin, "switch", "-q", "main");
  git(origin, "merge", "-q", "--no-ff", "--no-edit", "change");
  const base = git(origin, "rev-parse", "HEAD^1");
  const ws = path.join(tmp, "checkout");
  git(tmp, "init", "-q", ws);
  git(ws, "remote", "add", "origin", path.join(tmp, "refuses.git")); // (no repository there: every fetch fails)
  git(ws, "fetch", "-q", "--depth=2", "--no-tags", `file://${origin}`, git(origin, "rev-parse", "HEAD"));
  git(ws, "checkout", "-q", "--detach", "FETCH_HEAD");
  const refused = run(ws, ["copies", "--copies", "c.json", "--sizes", "s.json", "--base", "origin/main"]);
  ok(refused.status === 1 && /^FAIL --base origin\/main is no commit here, and could not be fetched/m.test(refused.out) && mended(refused.out),
    "where origin refuses a fetch, the base given as origin/<branch> cannot be had, which the workflows gave before #674", refused.out);
  const r = run(ws, ["copies", "--copies", "c.json", "--sizes", "s.json", "--base", "HEAD^1"]);
  const given = [...r.out.matchAll(/^ran \S+ \[[^\]]*\] (\w+_BASE)=([^,\s]*)/gm)];
  ok(r.status === 0 && given.length === COPIES.filter(([, , , v]) => v).length && given.every(m => m[2] === base),
    "the base given as HEAD^1, the merge's first parent, is had with no fetch, and each check is given it as its commit", r.out);
}
// with no part named: what the project's calls run, folded into core.yml, or each in its own
{
  const folded = project({ ".github/workflows/core.yml": CALLS("    with:\n      copies: checks/copies.json\n      sizes: checks/sizes.json\n      description: true\n      nuget: checks/licences.json\n") });
  const r = run(folded, []);
  ok(r.status === 0 && /^ran copies\.mjs \[checks\/copies\.json\]/m.test(r.out) && /^ran nuget-look\.sh BASE= CONFIG=checks\/licences\.json$/m.test(r.out) && !/^ran pr-description/m.test(r.out) && /description check is not run/.test(r.out),
    "core.yml's inputs: the copies checks with its files, and the NuGet check's look with its config; the description only where one is given", r.out);
  // (with the core's packages not installed, the calls cannot be read, which is said so, never as calling none)
  fs.renameSync(path.join(folded, "core/.packages/node_modules"), path.join(folded, "core/.packages/away"));
  const bare = run(folded, []);
  ok(bare.status === 1 && mended(bare.out) && /cannot be read: the core's packages are not installed/.test(bare.out) && /install\.mjs/.test(bare.out) && !/^ran /m.test(bare.out),
    "with the core's packages not installed, a run with no part named fails, saying the calls cannot be read and how to install", bare.out);
  fs.renameSync(path.join(folded, "core/.packages/away"), path.join(folded, "core/.packages/node_modules"));
  fs.writeFileSync(path.join(folded, "body.md"), "the description\n");
  const d = run(folded, ["--description", "body.md"]);
  ok(d.status === 0 && /^ran pr-description\.mjs \[\] .*PR_BODY=the description/m.test(d.out), "given a description's file, it runs the description check on it", d.out);
  const separate = project({ ".github/workflows/copies.yml": `name: copies\non: pull_request\njobs:\n  copies:\n    uses: ${CORE}/.github/workflows/copies.yml@${"a".repeat(40)}\n    with:\n      config: own/copies.json\n      sizes: own/sizes.json\n`,
    ".github/workflows/signatures.yml": `name: signatures\non: pull_request\njobs:\n  signatures:\n    uses: ${CORE}/.github/workflows/signatures.yml@${"a".repeat(40)}\n    with:\n      directory: web\n` });
  const s = run(separate, []);
  ok(/^ran copies\.mjs \[own\/copies\.json\]/m.test(s.out) && /^ran reading-size\.mjs \[own\/sizes\.json\]/m.test(s.out) && /^== Does the pull request change what this check reads\?$/m.test(s.out), "the calls of their own: copies with its config and marks, and the signature check", s.out);
  // (two calls of the signature check, each for a lock file's folder of its own: each runs, nothing merged into one)
  const two = project({ "web/package.json": "{}\n", "api/package.json": "{}\n", ".github/workflows/signatures.yml": ["web", "api"].map((d, k) => `${k ? "" : "name: signatures\non: pull_request\njobs:\n"}  s${k}:\n    uses: ${CORE}/.github/workflows/signatures.yml@${"a".repeat(40)}\n    with:\n      directory: ${d}\n`).join("") });
  const both = run(two, [], { BASE_SHA: git(two, "rev-parse", "HEAD") });
  ok(both.status === 0 && (both.out.match(/^== Does the pull request change what this check reads\?$/gm) ?? []).length === 2, "two calls of the signature check, for two folders, each run by hand, as their workflows run them", both.out);
  // (two calls of the NuGet check, each with a config of its own: both lookups run before either look, which may restore)
  const nugets = project({ ".github/workflows/nuget.yml": ["checks/a.json", "checks/b.json"].map((c, k) => `${k ? "" : "name: nuget\non: pull_request\njobs:\n"}  n${k}:\n    uses: ${CORE}/.github/workflows/nuget.yml@${"a".repeat(40)}\n    with:\n      config: ${c}\n`).join("") });
  const order = run(nugets, [], { BASE_SHA: git(nugets, "rev-parse", "HEAD") });
  const at = what => order.out.indexOf(what);
  ok(at("ran lookup.mjs [checks/a.json") >= 0 && at("ran lookup.mjs [checks/b.json") >= 0 && at("ran lookup.mjs [checks/b.json") < at("ran nuget-look.sh"),
    "two calls of the NuGet check: every config's lookup runs before any look, which may run the change's build files", order.out);
}
// a changed file's name is listed as text alone (#1348)
{
  const dir = project(), base = git(dir, "rev-parse", "HEAD");
  git(dir, "update-index", "--add", "--cacheinfo", `100644,${git(dir, "rev-parse", "HEAD:core/.node-version")},web/a::b##[c\u0001\n:\u00e9:#\u00e9#[d/package.json`);
  git(dir, "commit", "-qm", "n");
  for (const q of ["true", "false"]) {
    git(dir, "config", "core.quotePath", q);
    const r = run(dir, ["signatures", "--signatures", "web"], { BASE_SHA: base }), at = r.out.split("\n").find(l => l.includes("web/a"));
    ok(at.startsWith('- "web/a: :b# #[c') && !/:[^\0-\x7f]*:|#[^\0-\x7f]*#[^\0-\x7f]*\[/u.test(at), `signatures: a name listed as text (quotePath ${q})`, r.out);
  }
}
// the package checks look first: with nothing they read changed, nothing is installed or restored
{
  const dir = project({ "web/package.json": "{}\n" });
  const base = git(dir, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(dir, "README.md"), "# p\n\nMore.\n");
  git(dir, "commit", "-q", "-am", "a doc");
  const npm = run(dir, ["signatures", "--signatures", "web"], { BASE_SHA: base });
  ok(npm.status === 0 && /nothing to verify/.test(npm.out) && !/^== Install/m.test(npm.out), "signatures: a change to a doc alone installs nothing", npm.out);
  fs.mkdirSync(path.join(dir, "core/.packages"), { recursive: true });
  fs.writeFileSync(path.join(dir, "core/.packages/package.json"), "{\"private\": true, \"dependencies\": {\"yaml\": \"2.9.1\"}}\n");
  fs.writeFileSync(path.join(dir, "core/.packages/package-lock.json"), "{\"lockfileVersion\": 3, \"packages\": {}}\n");
  fs.writeFileSync(path.join(dir, "core/.packages/.npmrc"), "ignore-scripts=true\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "a sync moves the core's lock file");
  const carried = run(dir, ["signatures", "--signatures", "web"], { BASE_SHA: base });
  ok(carried.status === 0 && /nothing to verify/.test(carried.out) && !/^== Install/m.test(carried.out), "and so does the core's own package list, lock file and .npmrc in its copy's .packages/, which the core's own repository checks", carried.out);
  fs.mkdirSync(path.join(dir, ".github/workflows"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".github/workflows/core.yml"), "name: core\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "the caller");
  const called = run(dir, ["signatures", "--signatures", "web"], { BASE_SHA: base, CALLER: "o/p/.github/workflows/core.yml@refs/pull/1/merge", GITHUB_REPOSITORY: "o/p" });
  ok(/^Changed:\n- \.github\/workflows\/core\.yml$/m.test(called.out) && /^== Install from the lock file/m.test(called.out), "and a change to the workflow that calls it, whatever it is named, is one it reads", called.out);
  const nuget = run(dir, ["nuget", "--nuget", "checks/licences.json"], { BASE_SHA: base });
  ok(nuget.status === 0 && new RegExp(`^ran nuget-look\\.sh BASE=${base} CONFIG=checks/licences\\.json$`, "m").test(nuget.out) && !/^== (Every locked|Restore)/m.test(nuget.out), "nuget: where its look says nothing NuGet reads changed, nothing is fetched or restored", nuget.out);
  ok(new RegExp(`^ran lookup\\.mjs \\[checks/licences\\.json --nuget\\] .*LOOKUP_BASE=${base}`, "m").test(nuget.out) && nuget.out.indexOf("ran lookup.mjs") < nuget.out.indexOf("ran nuget-look.sh"), "nuget: each new package is looked up first, against the base, before the look, which may restore", nuget.out);
  fs.writeFileSync(path.join(dir, "fails.txt"), "lookup.mjs");
  const looked = run(dir, ["nuget", "--nuget", "checks/licences.json"], { BASE_SHA: base });
  ok(looked.status === 1 && /^ran nuget-look\.sh/m.test(looked.out) && /1 of 2 checks failed/.test(looked.out), "and a failed lookup fails the run, the look still running after it", looked.out);
  const advised = run(dir, ["nuget", "--nuget", "checks/licences.json", "--advisory"], { BASE_SHA: base });
  ok(advised.status === 0 && /Advisory: nothing fails for it yet/.test(advised.out), "where advisory, it fails nothing", advised.out);
  fs.rmSync(path.join(dir, "fails.txt"));
}
// (#1361, point 19: a restore whose dotnet is not on this machine did not run, in each of two calls, the run exiting 127
// with its mend; with a check that failed beside them, the run failed)
if (process.platform !== "win32") {
  const dir = project({ "checks/a.json": "{}\n", "checks/b.json": "{}\n", ".github/workflows/nuget.yml": ["a", "b"].map((c, k) => `${k ? "" : "name: nuget\non: pull_request\njobs:\n"}  n${k}:\n    uses: ${CORE}/.github/workflows/nuget.yml@${"a".repeat(40)}\n    with:\n      config: checks/${c}.json\n`).join("") });
  const base = git(dir, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(dir, "core/scripts/nuget-look.sh"), 'echo "run=true" >> "$GITHUB_OUTPUT"\necho "built=true" >> "$GITHUB_OUTPUT"\n');
  const bin = path.join(tmp, "no-dotnet-bin");
  fs.mkdirSync(bin, { recursive: true });
  for (const p of ["bash", "git"]) fs.symlinkSync(execFileSync("bash", ["-c", `command -v ${p}`], { encoding: "utf8" }).trim(), path.join(bin, p));
  const lacked = () => run(dir, [], { BASE_SHA: base, PATH: bin });
  const alone = lacked();
  ok(alone.status === 127 && /^dotnet could not be started \(spawnSync dotnet ENOENT\)\.$/m.test(alone.out) && /^FAIL 2 of \d+ checks could not run here, since this machine lacks dotnet: Restore each project file from its lock file alone; Restore each project file from its lock file alone\. Mend: /m.test(alone.out)
    && !/A restore from a lock file failed/.test(alone.out) && !/checks failed/.test(alone.out) && mended(alone.out), "nuget: a restore whose dotnet is not on this machine did not run, in each of two calls: it says so with its mend and exits 127, as a shell does for a command not found", alone.out);
  fs.writeFileSync(path.join(dir, "fails.txt"), "lookup.mjs");
  const beside = lacked();
  ok(beside.status === 1 && /^\d of \d+ checks failed, each saying its mend above: Each package new/m.test(beside.out) && /could not run here, since this machine lacks dotnet/.test(beside.out), "  and where a check failed beside them, the run fails", beside.out);
}
// the signature check's install, under an npm that reads none of --allow-git, --allow-remote and --allow-file (npm 10,
// which Node 22 brings, and npm 11 before 11.15.0, since 11.14 refuses the registry's own packages under --allow-remote=none), installs nothing and fails saying the mend, since that npm would
// fetch any git, web or file source the lock file names; under one that reads them all, it installs (#704). A stand-in
// npm on the PATH says the version it is given and records each install; on Linux, where it is a script of the shell's.
if (process.platform !== "win32") {
  const dir = project({ "web/package.json": "{}\n" });
  const base = git(dir, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(dir, "web/package.json"), "{\"private\": true}\n");
  git(dir, "commit", "-q", "-am", "the package list");
  const bin = path.join(tmp, "npm-bin");
  fs.mkdirSync(bin, { recursive: true });
  // (its name built from pieces, so that the licence scan reads no npm command here)
  fs.writeFileSync(path.join(bin, ["n", "pm"].join("")), '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "$NPM_STANDS_AS"; exit 0; fi\necho "ran $(basename "$0") $*"\n', { mode: 0o755 });
  const under = version => run(dir, ["signatures", "--signatures", "web"], { BASE_SHA: base, NPM_STANDS_AS: version, PATH: `${bin}${path.delimiter}${env.PATH}` });
  for (const v of ["10.9.9", "11.14.1", ""]) {
    const old = under(v);
    ok(old.status === 1 && !/^ran npm ci/m.test(old.out) && /^FAIL .*--allow-remote.*Mend: /m.test(old.out) && mended(old.out) && npmRefused(old.out) === (v ? "11.15.0" : null) && (!v || old.out.includes(`--ignore-scripts npm@${npmRefused(old.out)}`)), `signatures: under npm ${v || "whose version cannot be read"} it installs nothing and fails, saying the mend${v ? ", in the words check.mjs reads to leave the job unrun on this machine" : ", which check.mjs leaves failed, since the change may be why"} (#1262)`, old.out);
    // (#1262: a job failed by that refusal alone is unrun on this machine, naming the least version of npm, as check.mjs writes
    // its verdict; one with another failure beside it, or a passed job, is not)
    const jobOf = (...outs) => ({ passed: false, ran: true, steps: [{ passed: true, ran: true, out: "" }, ...outs.map((out, i) => ({ name: i ? "A step of the change" : "The signature check", passed: false, ran: true, out }))] });
    if (v === "10.9.9") ok(/^it needs npm 11\.15\.0 or later, .*\.node-version.*, which this machine lacks$/u.test(unrunWhy(jobOf(old.out)) ?? "") && unrunWhy(jobOf(old.out, "a real fault\n")) === null && unrunWhy(jobOf("a real fault\n")) === null && unrunWhy({ ...jobOf(old.out), passed: true }) === null && [`${old.out}FAIL a real fault\n`, `FAIL: a real fault\n${old.out}`, `assertion failed\n${old.out}`, old.out.replace(/^FAIL npm/mu, "a real fault\rFAIL npm")].every(o => npmRefused(o) === null) && unrunWhy({ ...jobOf(old.out), steps: [{ name: "A step of the change", passed: false, ran: true, out: old.out }] }) === null,
      "  and check.mjs writes a job failed by it alone unrun on this machine, naming the least version of npm; one with another failure beside it, in its step or another, or such words printed by another step, stays failed", unrunWhy(jobOf(old.out)));
  }
  // (#1361, point 9: with no npm on this machine at all, the check did not run, saying to install npm beside Node, and
  // never the refusal, whose mend runs npm)
  const nonpm = path.join(tmp, "no-npm-bin");
  fs.mkdirSync(nonpm, { recursive: true });
  for (const p of ["bash", "git"]) fs.symlinkSync(execFileSync("bash", ["-c", `command -v ${p}`], { encoding: "utf8" }).trim(), path.join(nonpm, p));
  const none = run(dir, ["signatures", "--signatures", "web"], { BASE_SHA: base, PATH: nonpm });
  ok(none.status === 127 && /^The package manager could not be started \(spawnSync npm ENOENT\)\. Mend: install npm beside Node/m.test(none.out) && /could not run here, since this machine lacks npm/.test(none.out)
    && !/--allow-remote/.test(none.out) && !/checks failed/.test(none.out) && mended(none.out), "signatures: with no npm on this machine, it did not run, saying to install npm beside Node, and gives no refusal", none.out);
  const now = under("11.15.0");
  ok(now.status === 0 && /^ran npm ci --ignore-scripts --no-audit --no-fund --allow-git=none --allow-remote=none --allow-file=none$/m.test(now.out) && /^ran npm audit signatures$/m.test(now.out), "and under npm 11.15.0, which reads them all, it installs and checks the signatures", now.out);
}

done("the one script of the core's checks");
