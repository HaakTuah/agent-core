// Tests of where the owner's inbox is (inbox.mjs): the repository origin names, GitHub's answer read as yes or no, an
// app's token told apart and its job's grant read from its workflow, the folder's items, and what is printed in each
// case; and, on Linux and macOS, the script itself against a stand-in for gh that fails as GitHub does, so that only
// "Not Found" moves the inbox and no other failure does, and that logs each call, so that a run sends GitHub nothing
// but GETs (#1363). Git, Node's own modules and the core's YAML reader; the upgrade test runs it on a project whose
// issues answer as switched off.
//
//   node tests/inbox-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { FOLDER, answer, asked, granted, items, repoOf, report, whoOf } from "../scripts/inbox.mjs";
import { parseYaml } from "../scripts/parse-yaml.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

ok(repoOf("https://github.com/someone/a-game") === "someone/a-game" && repoOf("https://x-token@github.com/someone/a-game.git\n") === "someone/a-game"
  && repoOf("git@github.com:someone/a.game.git") === "someone/a.game" && repoOf("ssh://git@github.com/someone/x/") === "someone/x",
"origin's address on github.com names the repository, in each form git writes it");
ok([null, "", "https://gitlab.com/someone/x", "/tmp/x.git", "https://github.com.evil.example/someone/x", "https://github.com/someone", "https://github.com/../user", "https://github.com/someone/.."].every(u => repoOf(u) === null),
  "another host, a path, a look-alike host, an address with no repository or a part that is only dots names none");

const on = { has_issues: true, permissions: { pull: true, triage: true } };
ok(answer(on).yes && answer({ ...on, permissions: { push: true } }).yes, "issues on and the right to triage or more: yes");
ok(!answer({ ...on, has_issues: false }).yes && /switched off/.test(answer({ ...on, has_issues: false }).why), "issues switched off: no, saying so");
ok(!answer({ has_issues: true, permissions: { pull: true } }).yes && /may not write/.test(answer({ has_issues: true, permissions: { pull: true } }).why), "no right to write them: no");
ok(!answer(null).yes && !answer("x").yes, "no answer: no");
ok(["false", "true", 1, {}].every((right) => !answer({ has_issues: true, permissions: { admin: right, maintain: right, push: right, triage: right } }).yes), "a right given as anything but a real true: no");

// an app's token (GitHub's job's own), whose `permissions` read no write whatever the job grants (#338): told apart by
// `GET user`, and answered by the job's grant as its workflow says it, never by a write (#1363)
const app = { has_issues: true, permissions: { admin: false, maintain: false, push: false, triage: false, pull: false } };
const integration = "gh: Resource not accessible by integration (HTTP 403)";
ok(whoOf(0) === "user" && whoOf(1, integration) === "app" && whoOf(1, "gh: Bad credentials (HTTP 401)") === null && whoOf(1, "gh: API rate limit exceeded, not accessible by integration (HTTP 403)") === null
  && whoOf(null, integration) === null && whoOf(1, "gh: Resource not accessible by integration (HTTP 4031)") === null, "what gh made of `GET user` read exactly: a user, an app's token, or no answer");
const asks = (kind, right) => { const said = []; return { said, opts: { who: () => { said.push("who"); return kind; }, grant: () => { said.push("grant"); return right; } } }; };
let q = asks("app", "write");
ok(asked(app, q.opts).yes === true && q.said.join() === "who,grant", "an app's token whose job grants `issues: write`: yes, by its grant", q.said);
for (const right of ["read", "none"]) {
  const no = asked(app, asks("app", right).opts);
  ok(no?.yes === false && /may not write/.test(no.why) && new RegExp(`grants \`issues: ${right}\``).test(no.why) && /issues: write/.test(no.why), `an app's token whose job grants \`issues: ${right}\`: no, saying what grants it`, no?.why);
}
ok(asked(app, asks("app", null).opts) === null, "an app's token whose job's grant nothing tells: not read, so nothing moves");
q = asks("user", "write");
ok(asked({ has_issues: true, permissions: { pull: true } }, q.opts)?.yes === false && q.said.join() === "who", "a signed-in account that may only read: no, its role standing, the grant never asked", q.said);
ok(asked(app, asks(null, "write").opts) === null, "no answer to `GET user`: no answer, so nothing moves");
q = asks("app", "write");
ok(asked(on, q.opts).yes && asked({ ...app, has_issues: false }, q.opts).why.includes("switched off") && !q.said.length, "a role that may write, or issues switched off: nothing more is asked");

// the job's grant, read from the workflow that started it as it ran (GITHUB_WORKFLOW_REF at GITHUB_WORKFLOW_SHA)
const SHA = "a".repeat(40), PIN = "b".repeat(40);
const kit = fs.readFileSync(new URL("../setup/template/workflows/look.yml.tmpl", import.meta.url), "utf8").replaceAll("{{core}}", CORE).replaceAll("{{pin}}", PIN);
const own = fs.readFileSync(new URL("../.github/workflows/own-look.yml", import.meta.url), "utf8");
const jobEnv = (file, more = {}) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REPOSITORY: "o/n", GITHUB_WORKFLOW_REF: `o/n/.github/workflows/${file}@refs/heads/main`, GITHUB_WORKFLOW_SHA: SHA, GITHUB_JOB: "look", ...more });
const shows = text => { const seen = []; return { seen, show: (sha, file) => { seen.push(`${sha}:${file}`); if (text === null) throw new Error("not there"); return text; } }; };
let g = shows(kit);
ok(granted(jobEnv("look.yml"), g.show) === "write" && g.seen.join() === `${SHA}:.github/workflows/look.yml`, "the starter kit's daily job, calling the core's look.yml: its grant `issues: write`, read from its file as it ran", g.seen);
ok(granted(jobEnv("own-look.yml", { GITHUB_JOB: "own-look", GITHUB_EVENT_NAME: "workflow_dispatch" }), shows(own).show) === "write", "the core's own daily job, started by hand: `issues: write`");
for (const flow of ["look.yml", "core-moved.yml"]) {
  const called = parseYaml(fs.readFileSync(new URL(`../.github/workflows/${flow}`, import.meta.url), "utf8"));
  ok(Object.values(called.jobs).every(j => j.permissions?.issues === "write"), `the core's ${flow} grants its job \`issues: write\`, so a caller's grant is what the token holds`);
}
const moved = `on: schedule\njobs:\n  moved:\n    permissions: { contents: read, issues: write }\n    uses: ${CORE}/.github/workflows/core-moved.yml@${PIN}\n`;
ok(granted(jobEnv("core-moved.yml", { GITHUB_JOB: "moved" }), shows(moved).show) === "write", "a project's daily job that still calls the core's core-moved.yml, which runs the look too: `issues: write`");
const flowOf = (jobPerms, flowPerms) => `on: schedule\n${flowPerms === undefined ? "" : `permissions: ${flowPerms}\n`}jobs:\n  look:\n${jobPerms === undefined ? "" : `    permissions: ${jobPerms}\n`}    uses: ${CORE}/.github/workflows/look.yml@${PIN}\n`;
for (const [jobPerms, flowPerms, want, what] of [
  ["{ issues: read }", undefined, "read", "a job that grants `issues: read`"], ["{ contents: read }", "write-all", "none", "a job whose grant leaves out issues, over the workflow's"],
  ["{}", undefined, "none", "a job that grants nothing"], [undefined, "write-all", "write", "a workflow's `write-all`"], [undefined, "read-all", "read", "a workflow's `read-all`"],
  [undefined, undefined, null, "no grant written (the repository's default, which no file says)"], ["{ issues: maybe }", undefined, null, "a grant GitHub does not take"]])
  ok(granted(jobEnv("look.yml"), shows(flowOf(jobPerms, flowPerms)).show) === want, `${what}: ${want ?? "not read"}`);
const two = `on: schedule\njobs:\n  a:\n    permissions: { issues: write }\n    uses: ${CORE}/.github/workflows/look.yml@${PIN}\n  b:\n    permissions: { issues: read }\n    uses: ${CORE}/.github/workflows/look.yml@${PIN}\n`;
const other = `on: schedule\njobs:\n  daily:\n    permissions: { issues: write }\n    uses: someone/else/.github/workflows/look.yml@${PIN}\n`;
const mine = `on: schedule\njobs:\n  look:\n    permissions: { issues: write }\n    runs-on: ubuntu-latest\n    steps:\n      - run: node core/scripts/look.mjs\n`;
ok(granted(jobEnv("look.yml"), shows(mine).show) === "write" && granted(jobEnv("look.yml", { GITHUB_JOB: "other" }), shows(mine).show) === null, "a job with steps of its own is the run's own only where GITHUB_JOB names it");
for (const [env, text, what] of [[{}, kit, "not in a GitHub job"], [jobEnv("look.yml", { GITHUB_EVENT_NAME: "pull_request" }), kit, "an event on which GitHub may give less than the file grants"],
  [jobEnv("look.yml", { GITHUB_WORKFLOW_SHA: "main" }), kit, "a commit that is no full SHA"], [jobEnv("look.yml", { GITHUB_WORKFLOW_REF: "x/y/.github/workflows/look.yml@refs/heads/main" }), kit, "a workflow of another repository"],
  [jobEnv("look.yml", { GITHUB_WORKFLOW_REF: "o/n/../look.yml@refs/heads/main" }), kit, "a path outside the workflows' folder"], [jobEnv("look.yml"), null, "the file not at hand at that commit"],
  [jobEnv("look.yml"), "on: [", "a file that is no YAML"], [jobEnv("look.yml"), two, "two jobs that call the look"], [jobEnv("look.yml", { GITHUB_JOB: "daily" }), other, "a call of another's look.yml"]])
  ok(granted(env, shows(text).show) === null, `${what}: not read`);

const dir = scratchDir("inbox-test-");
try {
  ok(items(dir).length === 0, "no folder: no items");
  fs.mkdirSync(path.join(dir, FOLDER));
  for (const f of ["README.md", "b-task.md", "a-bug.md", "notes.txt", "odd `name`.md"]) fs.writeFileSync(path.join(dir, FOLDER, f), "State: queued\nBy: owner\n");
  fs.mkdirSync(path.join(dir, FOLDER, "sub.md"));
  ok(items(dir).join() === "a-bug.md,b-task.md" && items(dir).odd === 1, "the items are its Markdown files, its README and folders left out, in order; one whose name is not plain is counted, never printed", items(dir).join());
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

ok(report({ yes: true }, [], false) === "The owner's inbox is this repository's issues.", "issues reachable, no folder: the inbox is the issues, one line");
ok(/take it out/.test(report({ yes: true }, [], true)), "an empty folder beside issues that answer is taken out");
const oddOnly = report({ yes: true }, Object.assign([], { odd: 1 }), true);
ok(/one place at a time/.test(oddOnly) && /\(1 whose name is not plain\)/.test(oddOnly) && !/take it out/.test(oddOnly), "a folder holding only items whose name is not plain moves them over, never reads as empty", oddOnly);
const back = report({ yes: true }, Object.assign(["a-bug.md"], { odd: 1 }), true);
ok(/one place at a time/.test(back) && /a-bug\.md, 1 more whose name is not plain/.test(back) && /as an issue/.test(back) && /another account added moves over as data/.test(back) && /take `inbox\/` out/.test(back), "issues reachable again, items in the folder: each moved over and the folder taken out, in one pull request", back);
const off = report({ yes: false, why: "its issues are switched off" }, [], false);
ok(/switched off/.test(off) && /State: <queued, needs-owner, later, on-hold>/.test(off) && /By: </.test(off) && /ISSUE_TEMPLATE/.test(off) && /name it to the owner once/.test(off) && /nothing waits on it/.test(off),
  "issues not reachable, no folder: the folder is made as said, its item format given, and the owner's setting named once", off);
const kept = report({ yes: false, why: "its issues are switched off" }, ["a.md"], true);
ok(/is the folder `inbox\/` \(1 item/.test(kept) && !/name it to the owner/.test(kept), "the folder standing: it is the inbox, and the owner is not named again", kept);
ok(/the 2 item\(s\) of `inbox\/` move over/.test(report(null, Object.assign(["a.md"], { odd: 1 }), true)), "nothing asked: the count of items takes in those whose name is not plain");
ok(/could not be asked here/.test(report(null, [], false)) && /nothing moves/.test(report(null, [], false)) && /own GitHub tools/.test(report(null, [], false)), "nothing asked: nothing moves, and it says what to ask with the session's own tools");

ok(/\(1 item\(s\), and 1 whose name is not plain: rename each/.test(report({ yes: false, why: "x" }, Object.assign(["a.md"], { odd: 1 }), true)), "the folder standing, a name that is not plain is counted and its mend said");

// the script itself, gh failing as GitHub does, each call it makes logged (a stand-in that is a shell script: not on
// Windows): only "Not Found" moves the inbox, an app's token is answered by its job's grant, and nothing but GETs is sent
if (process.platform !== "win32") {
  const at = scratchDir("inbox-run-"), bin = path.join(at, "bin"), repo = path.join(at, "repo"), log = path.join(at, "calls");
  try {
    fs.mkdirSync(bin); fs.mkdirSync(repo);
    const plain = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GITHUB_/.test(k)));
    const env = { ...plain, PATH: `${bin}${path.delimiter}${process.env.PATH}`, GIT_CONFIG_GLOBAL: path.join(at, "none"), GIT_CONFIG_NOSYSTEM: "1", CALLS: log };
    const git = (...a) => spawnSync("git", a, { cwd: repo, env, encoding: "utf8" });
    git("init", "-q"); git("remote", "add", "origin", "https://github.com/someone/a-game");
    const run = (gh, more = {}) => { fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh
printf '%s\\037' "$@" >> "$CALLS"; echo >> "$CALLS"
${gh}
`, { mode: 0o755 }); const r = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/inbox.mjs", import.meta.url))], { cwd: repo, env: { ...env, ...more }, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
    let r;
    // no origin, as a release's trial clones a project: not read, no folder asked, gh not called (#1361, point 17)
    git("remote", "remove", "origin");
    r = run("exit 1");
    ok(r.status === 0 && /could not be asked here \(its origin names no host, being none or a folder on this machine, so no host is named to ask\): nothing moves/.test(r.out) && !/^Issues cannot be read/.test(r.out) && !fs.existsSync(log), "a repository with no origin is not read as one with no issues: nothing is asked, no folder made, nothing moves", r.out);
    for (const folder of [repo, `file://${repo}`, "../a-game"]) {
      git("remote", "add", "origin", folder);
      r = run("exit 1");
      ok(r.status === 0 && /could not be asked here \(its origin names no host/.test(r.out) && !fs.existsSync(log), `an origin that is a folder (${folder === repo ? "a path" : folder.slice(0, 7)}) names no host: nothing is asked, nothing moves`, r.out);
      git("remote", "remove", "origin");
    }
    git("remote", "add", "origin", "https://github.com/someone/a-game");
    r = run("echo 'gh: Not Found (HTTP 404)' >&2; exit 1");
    ok(r.status === 0 && /^Issues cannot be read and written here \(GitHub finds no repository someone\/a-game/.test(r.out), "GitHub's Not Found is an answer: the repository cannot be reached for this account, so the folder", r.out);
    for (const [how, said] of [["echo 'gh: API rate limit exceeded (HTTP 403)' >&2; exit 1", "a rate limit"], ["echo 'gh: Bad Gateway (HTTP 502)' >&2; exit 1", "a fault of GitHub's"], ["echo 'error connecting to api.github.com' >&2; exit 1", "no network"], ["echo '{\"has_issues\": true}'", "an answer for no account"]]) {
      r = run(how);
      ok(r.status === 0 && /could not be asked here[\s\S]*nothing moves/.test(r.out), `${said}: nothing is asked, nothing moves, nothing fails`, r.out);
    }
    // the role reads no write; `GET user` says whose token it is (USER: what gh says to it)
    const role = `if [ "$2" = "user" ]; then [ -z "$USER_SAYS" ] && { echo '{"login": "someone"}'; exit 0; }; echo "$USER_SAYS" >&2; exit 1; fi; echo '{"has_issues": true, "permissions": {"pull": true}}'`;
    r = run(role, { USER_SAYS: "" });
    ok(r.status === 0 && /^Issues cannot be read and written here \(the account signed in here may not write its issues/.test(r.out), "a signed-in account that may only read: the folder", r.out);
    r = run(role, { USER_SAYS: "gh: Resource not accessible by integration (HTTP 403)" });
    ok(r.status === 0 && /could not be asked here \([^)]*an app's token[\s\S]*nothing moves/.test(r.out), "an app's token outside a GitHub job: not read, so nothing moves", r.out);
    // in a GitHub job, the workflow that started it committed here, as the job's checkout holds it
    const job = grant => {
      fs.mkdirSync(path.join(repo, ".github/workflows"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".github/workflows/look.yml"), `on: schedule\njobs:\n  look:\n    permissions:\n      issues: ${grant}\n    uses: ${CORE}/.github/workflows/look.yml@${PIN}\n`);
      git("add", "-A"); git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", grant);
      return { USER_SAYS: "gh: Resource not accessible by integration (HTTP 403)", GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REPOSITORY: "someone/a-game",
        GITHUB_WORKFLOW_REF: "someone/a-game/.github/workflows/look.yml@refs/heads/main", GITHUB_WORKFLOW_SHA: git("rev-parse", "HEAD").stdout.trim(), GITHUB_JOB: "look" };
    };
    r = run(role, job("write"));
    ok(r.status === 0 && /^The owner's inbox is this repository's issues\./.test(r.out), "a GitHub job's token whose workflow grants `issues: write`: the inbox is its issues", r.out);
    r = run(role, job("read"));
    ok(r.status === 0 && /^Issues cannot be read and written here \(the job's token may not write its issues: its workflow grants `issues: read`/.test(r.out), "one whose workflow grants `issues: read`: the folder, and what grants the right", r.out);
    r = run(role, { ...job("write"), GITHUB_WORKFLOW_SHA: "c".repeat(40) });
    ok(r.status === 0 && /could not be asked here[\s\S]*nothing moves/.test(r.out), "the workflow as it ran not at hand: not read, so nothing moves", r.out);
    r = run(`echo '{"has_issues": false, "permissions": {"push": true}}'`);
    ok(r.status === 0 && /\(its issues are switched off\)/.test(r.out), "an answer with issues switched off: the folder", r.out);
    const calls = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map(l => l.split("\x1f").slice(0, -1));
    const routes = new Set(calls.map(c => c[1]));
    ok(calls.length > 10 && calls.every(c => c.length === 2 && c[0] === "api" && /^[\w./-]+$/.test(c[1]) && !c[1].startsWith("-")) && routes.has("user") && routes.has("repos/someone/a-game"),
      "every request the runs sent GitHub is a GET: `gh api <route>` and nothing more, never a method, a field or a body", calls.map(c => c.join(" ")).join("\n"));
  } finally { fs.rmSync(at, { recursive: true, force: true }); }
}

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
