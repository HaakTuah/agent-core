// Tests of the core's checks from plain git (check.mjs; modules/hosts.md, "One layer knows no host"; #250): on a
// project the starter kit writes, synced to the core as it stands here, it passes with each check run and each step
// only the host runs named; a copy of the core edited, or a new copy of code, fails with that check's own failure and
// its mend; a project that calls none of the core's workflows, as on another host, is checked by the kit's calls; and
// every workflow of the core's that the starter kit calls is run by it or named among the host's own (HOST_OWN), so a
// new check cannot be left out of it. A scratch core reached through the core's own address by a git rewrite, so no
// call reaches the network. Git, tar, bash and Node's own modules.
//
//   node scripts/check-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HOST_OWN } from "./check.mjs";
import { mended } from "./mend.mjs";
import { root, scratch, scratchEnv, tally } from "./scratch-core.mjs";

const { ok, done } = tally();
const { tmp, git, core, project } = scratch("check-test-");
const env = scratchEnv(core, tmp);
const check = (dir, ...args) => { const r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs"), ...args], { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const commit = (dir, what) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", what); };

// every workflow the starter kit calls is run here or named the host's own
const kit = path.join(root, "setup", "template", "workflows");
for (const f of fs.readdirSync(kit)) {
  const caller = fs.readFileSync(path.join(kit, f), "utf8");
  const started = /^\s+(?:pull_request|push):/m.test(caller);
  for (const [, name] of caller.matchAll(/\/\.github\/workflows\/([\w.-]+)@/g)) {
    ok(name in HOST_OWN || (started && fs.readFileSync(path.join(root, ".github", "workflows", name), "utf8").includes("workflow_call")),
      `${name}, which the starter kit's ${f} calls, is run by check.mjs on a pull request or a push, or named among the host's own`);
  }
}
for (const name of Object.keys(HOST_OWN)) ok(fs.existsSync(path.join(root, ".github", "workflows", name)), `${name}, named the host's own, is a workflow of the core's`);

// a project the starter kit writes, at the scratch core's commit
const p = project("a-project", "--owner", "someone");
ok(p.status === 0, "the starter kit writes a project", p.out);
const dir = p.dir;
commit(dir, "the starter kit");
let r = check(dir);
ok(r.status === 0 && /ok {3}core\.yml\/core\/core/.test(r.out) && /ok {3}copies\.yml\/copies/.test(r.out), "a project as the kit writes it passes on a push to main, its copy and its copies checked", r.out);

const config = path.join(dir, "checks", "copies.json");
fs.writeFileSync(config, JSON.stringify({ ...JSON.parse(fs.readFileSync(config, "utf8")), code: ["src"] }, null, 2));
commit(dir, "the code the copies check reads");
git(dir, "branch", "-q", "base");
fs.writeFileSync(path.join(dir, "notes.md"), "A note.\n");
commit(dir, "a note");
fs.writeFileSync(path.join(tmp, "description.md"), "## What the owner can try\nNothing.\n\n## Readings taken\nNone.\n\nWaits on: nothing\n");
r = check(dir, "--base", "base", "--description", path.join(tmp, "description.md"));
ok(r.status === 0 && /ok {3}pr-description\.yml\//.test(r.out) && /host security-review\.yml\/[\w-]+: security-review\.yml is not run here/.test(r.out), "a pull request with its description passes, the security review's status named the host's own and not run", r.out);
r = check(dir, "--base", "base");
ok(r.status === 0 && r.out.includes("pr-description.yml is not run here: give --description"), "without a description, the description check is named and not run", r.out);
git(dir, "reset", "-q", "--hard", "base");
fs.writeFileSync(path.join(dir, "core", "README.md"), "edited here\n");
commit(dir, "an edit to the copy");
r = check(dir, "--base", "base");
ok(r.status === 1 && r.out.includes("core/ differs from the core at its pin") && mended(r.out), "an edit to the copy of the core fails, with core.yml's own failure and its mend", r.out);

git(dir, "reset", "-q", "--hard", "base");
fs.writeFileSync(path.join(dir, "core", ".github", "workflows", "core.yml"), "on:\n  workflow_call:\njobs:\n  core:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo nothing checked\n");
commit(dir, "the copy's own check emptied");
r = check(dir, "--base", "base");
ok(r.status === 1 && r.out.includes("core/ differs from the core at its pin") && !r.out.includes("nothing checked") && mended(r.out), "a change that edits the copy's own workflow runs the core's as it stands at the call's pin, never the edited one, and fails", r.out);

git(dir, "reset", "-q", "--hard", "base");
fs.mkdirSync(path.join(dir, "src"), { recursive: true });
const block = Array.from({ length: 40 }, (_, i) => `export function f${i}(a, b) { const c = a * ${i} + b; if (c > ${i}) { return c - a; } return c + b * ${i}; }`).join("\n");
fs.writeFileSync(path.join(dir, "src", "one.js"), `${block}\n`);
fs.writeFileSync(path.join(dir, "src", "two.js"), `${block}\n`);
commit(dir, "a copy of code");
r = check(dir, "--base", "base");
ok(r.status === 1 && /FAIL copies\.yml\/copies\/copies: its step "No new copies" failed/.test(r.out) && mended(r.out), "a new copy of code fails on a pull request, with the copies check's own failure and its mend", r.out);

// a change that takes a check's call out still runs it: the calls are the base's
git(dir, "reset", "-q", "--hard", "base");
fs.rmSync(path.join(dir, ".github", "workflows", "core.yml"));
fs.writeFileSync(path.join(dir, "core", "README.md"), "edited here\n");
commit(dir, "the copy edited, and its check's call taken out");
r = check(dir, "--base", "base");
ok(r.status === 1 && r.out.includes("core/ differs from the core at its pin") && r.out.includes("so no other check runs") && !/ok {3}copies\.yml/.test(r.out) && mended(r.out),
  "a change that takes out its call to core.yml is still checked by the base's call, and a copy that fails it runs no other check", r.out);
git(dir, "branch", "-q", "-f", "nocore");
r = check(dir, "--base", "nocore");
ok(r.status === 1 && r.out.includes("no call to the core's core.yml") && mended(r.out), "a base that calls no core.yml fails, saying its mend", r.out);

// a listed personal term is found and never printed
git(dir, "reset", "-q", "--hard", "base");
const term = ["Zq", "xv", "Wk"].join("");
fs.writeFileSync(path.join(dir, "notes.md"), `A note naming ${term}.\n`);
commit(dir, "a note with a listed term");
r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs"), "--base", "base"], { cwd: dir, env: { ...env, PERSONAL_TERMS: `${term.toLowerCase()}\n` }, encoding: "utf8" });
const said = `${r.stdout}${r.stderr}`;
ok(r.status === 1 && /FAIL personal-terms\.yml\/check\/check/.test(said) && !said.toLowerCase().includes(term.toLowerCase()) && mended(said), "a listed personal term, listed in other letters' case, fails the change, and the term is printed nowhere in any case", said);

git(dir, "reset", "-q", "--hard", "base");
fs.writeFileSync(path.join(dir, "notes.md"), "A plain note.\n");
commit(dir, "a plain note");
const terms = { ...env, PERSONAL_TERMS: `${term}\n` };
r = spawnSync(process.execPath, [path.join(dir, "core", "scripts", "check.mjs"), "--base", "base", "--branch", `fix-${term.toLowerCase()}`], { cwd: dir, env: terms, encoding: "utf8" });
ok(r.status === 1 && /FAIL personal-terms\.yml\/check\/check/.test(`${r.stdout}${r.stderr}`), "a listed term in the branch's own name fails the change", `${r.stdout}${r.stderr}`);

// a check that keeps a baseline reads the base: the change is checked on its merge into the base, as GitHub checks it
git(dir, "reset", "-q", "--hard", "base");
fs.writeFileSync(path.join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { unlisted: { command: ["np", "x"].join(""), args: ["-y", "an-unlisted-server@1.0.0"] } } }, null, 2));
commit(dir, "an agent's tool no list names");
r = check(dir, "--base", "base");
ok(r.status === 1 && /FAIL licences\.yml\/licences\/licences: its step "Every tool the agents load listed/.test(r.out) && mended(r.out), "a tool the agents load that no list names fails the agent-tools check on a pull request, its base read from the merge's first parent", r.out);

// another host: no .github/workflows, so the kit's calls are run, read from the core itself
git(dir, "reset", "-q", "--hard", "base");
fs.rmSync(path.join(dir, ".github", "workflows"), { recursive: true, force: true });
commit(dir, "on another host");
r = check(dir);
ok(r.status === 0 && r.out.includes("the starter kit's calls are run") && /ok {3}core\.yml\/core\/core/.test(r.out), "a project with no calls of its own is checked by the starter kit's", r.out);
git(dir, "branch", "-q", "-f", "elsewhere");
fs.rmSync(path.join(dir, "core", "setup", "template", "workflows"), { recursive: true, force: true });
commit(dir, "the copy's starter kit calls taken out");
r = check(dir, "--base", "elsewhere");
ok(r.status === 1 && r.out.includes("core/ differs from the core at its pin") && mended(r.out), "a change that takes the kit's calls out of its copy is still checked by the core's own", r.out);
git(dir, "reset", "-q", "--hard", "elsewhere");

// what it refuses
r = check(dir, "--colour");
ok(r.status === 1 && mended(r.out), "an option it does not know fails, saying its mend", r.out);
r = check(dir, "--base", "no-such-commit");
ok(r.status === 1 && r.out.includes("no commit of this repository") && mended(r.out), "a base that is no commit fails, saying its mend", r.out);
fs.rmSync(path.join(dir, "core-manifest.md"));
commit(dir, "no manifest");
r = check(dir);
ok(r.status === 1 && r.out.includes("core-manifest.md is not in the commit") && mended(r.out), "a commit with no manifest fails, saying its mend", r.out);
done("the core's checks from plain git");
