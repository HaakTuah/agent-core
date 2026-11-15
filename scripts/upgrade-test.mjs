// Nothing the core changes locks a project that changes nothing of its own (AGENTS.md, "Nothing locks a project"; core
// archive 201 and 215): a project written by the starter kit of each of the last two releases (one that missed a
// release jumps two), then synced to the commit under test as a release of its own, passes every check of the core
// unchanged, and no pull request of its own starts a job there that it did not start before the sync, since each job is
// a billed minute in a private repository. From each, two projects of another owner: one whose packages come from npm,
// public; one whose packages come from NuGet (.NET), private, held as Windows holds it (every file 100644, line endings
// converted), every commit of it made under a name its term list holds, as git writes the name a machine sets, which
// the personal-terms check fails, saying how the session mends it in the pull request itself, and the sync's pull
// request is mended so (core archive 202). Each is synced the way a project of another owner syncs (`node
// core/scripts/sync.mjs`, the release's own copy, which takes the newest release), and then runs, as GitHub would for
// it (workflow-run.mjs, beside this file), every workflow of the core its own workflows call: the sync's pull request,
// the push of its merge to main, a pull request of its own that touches only its docs, one that touches its package
// files, and the daily core-moved run; then its hooks, from main's copy as Claude Code runs them. GitHub's own services
// (CodeQL, the dependency review) are not run here, and GitHub's API is a stand-in that gives the security-review check
// one completed review. The sync's pull request is pure, as pure-sync.mjs reads it from the release it moves to, in
// both projects. Each holds old content too, a breach of each kind a check reads (a long file, a function past a mark,
// two files that import each other, a module its manifest's list does not name, a copy in its prose): none fails, a
// pull request that adds a function past a mark does, saying its mend, and the copy stands in its
// baseline. After the sync, a pull request that adds a copy fails, and the mend as the failure words it passes; every
// step a release asks reads done (steps.mjs), but one the commit under test adds that it asks of every project (a
// check's own list to write), which is reported, alone, and done by its mend as written; each step the commit under
// test adds over the release started from, taken out, is reported, and its mend as written makes it done; and steps
// taken out at random are reported, exactly those; then that a release changing only the core's own files (a test, its queue, a workflow no project calls) asks no
// sync, and the next one syncs all the same.
// Where its issues answer as switched off, the owner's inbox is the folder inbox.mjs names, and a task given,
// queued, built and closed there passes every check on each pull request. And a copy older than the first release,
// written by hand since no starter kit stood then, takes the release as the sync notes say (preRelease, below). It needs the core's history and release tags (a checkout with fetch-depth 0); on GitHub's runners the
// .NET SDK too, which takes nothing from the network for a project with no package, while npm takes one small package
// from the registry. On Linux and on Windows. Git, tar, bash, npm, the .NET SDK where there is one, and Node's own
// modules.
//
//   node scripts/upgrade-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { scratchEnv } from "./scratch-core.mjs";
import { STAGES } from "./steps-stage.mjs";
import { STEPS, leads } from "./steps.mjs";
import { evaluate, parseYaml, runWorkflow } from "./workflow-run.mjs";

const STEP_LEADS = STEPS.map(s => s.lead);
let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- the reader the runner stands on ----
const yaml = parseYaml("name: x # a comment\non:\n  workflow_call:\n    inputs:\n      a:\n        type: boolean\n        default: true\njobs:\n  j:\n    if: >-\n      ${{ a\n      && b }}\n    steps:\n      - uses: x@1 # v1\n        with:\n          k: 'it''s'\n      - name: run\n        run: |\n          one\n            two # kept\n\n          three\n      - run: echo \"#\" plain\n    types: [opened, edited]\n");
ok(yaml.name === "x" && yaml.on.workflow_call.inputs.a.default === true && yaml.jobs.j.if === "${{ a && b }}" && yaml.jobs.j.steps[0].uses === "x@1" && yaml.jobs.j.steps[0].with.k === "it's"
  && yaml.jobs.j.steps[1].run === "one\n  two # kept\n\nthree\n" && yaml.jobs.j.steps[2].run === 'echo "#" plain' && yaml.jobs.j.types.join() === "opened,edited", "the runner reads the YAML the core's workflows are written in", JSON.stringify(yaml));
const c = { github: { event_name: "pull_request", event: { pull_request: { draft: false, user: { login: "Dependabot[bot]" } }, issue: null } }, inputs: { private: false, advisory: true } };
ok(evaluate("github.event_name == 'PULL_REQUEST' && !github.event.pull_request.draft", c) === true && evaluate("github.event.issue.pull_request || 'x'", c) === "x" && evaluate("github.event.pull_request.user.login != 'dependabot[bot]'", c) === false
  && evaluate("contains(fromJSON('[\"OWNER\",\"MEMBER\"]'), 'member') && startsWith('abc', 'A')", c) === true && evaluate("!inputs.private || !inputs.advisory", c) === true, "and evaluates GitHub's expressions as GitHub does: case-blind strings, || giving a value, a missing property null");
const matrixed = runWorkflow("on:\n  workflow_call:\n    inputs:\n      languages:\n        type: string\n        default: '[\"a\", \"b\"]'\njobs:\n  analyze:\n    strategy:\n      matrix:\n        language: ${{ fromJSON(inputs.languages) }}\n        os: [x, y]\n    steps: []\n", { github: {}, dry: true });
ok(matrixed.map(r => r.job).join() === "analyze (a, x),analyze (a, y),analyze (b, x),analyze (b, y)", "a job's matrix is a job for each combination, named by its values, so a matrix that grows starts more jobs", matrixed.map(r => r.job).join());
let threw = 0;
for (const bad of ["vars.X == 1", "hashFiles('x')", "a ~ b"]) { try { evaluate(bad, c); } catch { threw++; } }
ok(threw === 3, "a context, function or sign it does not know stops the test, to be taught, rather than read other than GitHub would");

// ---- the core: its history, with the commit under test as main, cut as a release ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "upgrade-test-"));
process.on("exit", () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* (left to the system's own cleaning) */ } });
const slash = p => p.replace(/\\/g, "/");
const theCore = path.join(tmp, "the-core");
// (what each program it starts reads of the user's own is the scratch folder's: no home, npm or NuGet setting, cache or
// token of the user's reaches a check; the last two releases' sync.mjs finds its bare repository by itself)
const env = scratchEnv(theCore, tmp, { findsBare: true });
const home = path.join(tmp, "home");
fs.mkdirSync(path.join(home, "AppData", "Local"), { recursive: true });
fs.mkdirSync(path.join(home, "AppData", "Roaming"), { recursive: true });
Object.assign(env, { HOME: home, USERPROFILE: home, APPDATA: path.join(home, "AppData", "Roaming"), LOCALAPPDATA: path.join(home, "AppData", "Local"), XDG_CONFIG_HOME: path.join(home, ".config"),
  npm_config_cache: path.join(home, ".npm") }); // (npm's own config is the home's, which holds none)
const named = new Map(); // (a project's folder, and the name git writes into each commit made in it)
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env: { ...env, ...named.get(dir) }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();
const node = (dir, ...args) => { const r = spawnSync(process.execPath, args, { cwd: dir, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };

let history = true;
try { git(root, "rev-parse", "--verify", "-q", "HEAD^{commit}"); history = git(root, "rev-parse", "--is-shallow-repository") === "false"; } catch { history = false; }
fs.mkdirSync(theCore);
git(theCore, "init", "-q", "-b", "main");
if (history) git(theCore, "fetch", "-q", "--no-tags", root, "+refs/tags/release-*:refs/tags/release-*");
const tip = history ? git(root, "rev-parse", "HEAD") : "";
if (history) git(theCore, "fetch", "-q", "--no-tags", root, tip);
const releases = history ? git(theCore, "tag", "--list", "release-*").split("\n").filter(t => /^release-\d+$/.test(t)) : [];
if (!history || !releases.length) {
  ok(!process.env.GITHUB_ACTIONS, "on GitHub's runners the core's history and its release tags are here (fetch-depth 0)");
  console.log(failed ? `${failed} of ${count} failed` : "skip the rest: this clone holds no history or no release of the core's, so no previous release to start from");
  process.exit(failed ? 1 : 0);
}
git(theCore, "checkout", "-q", "-B", "main", tip);
// (the commit under test is the clone's own, with what its working folder holds that is not committed yet)
for (const e of fs.readdirSync(theCore)) if (e !== ".git") fs.rmSync(path.join(theCore, e), { recursive: true, force: true });
fs.cpSync(root, theCore, { recursive: true, filter: src => !["/.git", "/node_modules"].some(x => slash(src).endsWith(x)) });
git(theCore, "add", "-A");
if (git(theCore, "status", "--porcelain")) git(theCore, "commit", "-q", "-m", "the core as it stands");
const head = git(theCore, "rev-parse", "HEAD");
const number = t => Number(t.slice("release-".length));
const isAncestor = (a, b) => { try { git(theCore, "merge-base", "--is-ancestor", a, b); return true; } catch { return false; } };
const cut = releases.filter(t => isAncestor(`${t}^{commit}`, head)).sort((a, b) => number(a) - number(b));
const starts = cut.filter(t => git(theCore, "rev-parse", `${t}^{commit}`) !== head).slice(-2); // (the last two releases before it)
if (!starts.length) {
  ok(!process.env.GITHUB_ACTIONS, "on GitHub's runners a release of the core's comes before the commit under test");
  console.log(failed ? `${failed} of ${count} failed` : "skip the rest: no release of the core's comes before the commit under test, so none to start from");
  process.exit(failed ? 1 : 0);
}
const carrying = cut.find(t => git(theCore, "rev-parse", `${t}^{commit}`) === head) ?? `release-${number(cut.at(-1)) + 1}`;
if (!cut.includes(carrying)) git(theCore, "tag", carrying, head);
console.log(`the releases started from: ${starts.map(t => `${t} (${git(theCore, "rev-parse", "--short=7", `${t}^{commit}`)})`).join(", ")}; the commit under test, cut as ${carrying}: ${head.slice(0, 7)}`);

// ---- GitHub, as far as the checks need it ----
const stubs = path.join(tmp, "bin");
fs.mkdirSync(stubs);
const ghLog = path.join(tmp, "gh-log"), ghData = path.join(tmp, "gh-data.json");
// (GitHub's API, for the security-review check and the core-moved run: one pull request whose security review Codex's
// app says is completed, no issues; what is posted is written to a log)
fs.writeFileSync(path.join(stubs, "gh"), `#!/usr/bin/env node
const fs = require("fs");
const a = process.argv.slice(2), data = JSON.parse(fs.readFileSync(process.env.GH_DATA, "utf8"));
const log = line => fs.appendFileSync(process.env.GH_LOG, line + "\\n");
if (a[0] !== "api") { log(a.join(" ")); process.exit(0); }
const takes = new Set(["-X", "--method", "--input", "--jq", "-q", "-f", "-F", "-H"]);
let route = null; for (let i = 1; i < a.length; i++) { if (takes.has(a[i])) { i++; continue; } if (!a[i].startsWith("-")) { route = a[i]; break; } }
const method = a.includes("-X") ? a[a.indexOf("-X") + 1] : "GET";
if (method !== "GET") { log(method + " " + route + " " + fs.readFileSync(0, "utf8").replace(/\\s+/g, " ")); console.log("{}"); process.exit(0); }
if (a.includes("--jq") || a.includes("-q")) process.exit(0);
const found = Object.entries(data).find(([pattern]) => new RegExp(pattern).test(route));
if (!found) { console.error("gh stand-in: no route for " + route); process.exit(1); }
console.log(JSON.stringify(a.includes("--slurp") ? [found[1]] : found[1]));
`, { mode: 0o755 });
const PATHKEY = Object.keys(env).find(k => k.toUpperCase() === "PATH") ?? "PATH";
const base = { ...env, [PATHKEY]: `${stubs}${path.delimiter}${env[PATHKEY]}`, GH_LOG: ghLog, GH_DATA: ghData };
const summary = sha => ({ user: { login: "chatgpt-codex-connector[bot]", type: "Bot" }, author_association: "NONE", created_at: "2026-11-13T10:00:00Z", updated_at: "2026-11-13T10:00:00Z",
  body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { commit_sha: sha, status: "completed" }, security_review: { commit_sha: sha, has_any_findings: null, has_unresolved_findings: null, status: "completed" } }).replaceAll("{", "&#123;").replaceAll("}", "&#125;")} -->\n<details>the table</details>` });

const version = spawnSync("dotnet", ["--version"], { env, encoding: "utf8" });
const sdk = version.status === 0;
const tfm = `net${sdk ? version.stdout.trim().split(".")[0] : "9"}.0`; // (the SDK's own, so the restore takes no targeting pack from the network)
ok(sdk || !process.env.GITHUB_ACTIONS, "on GitHub's runners there is a .NET SDK, so the NuGet check's restore runs here as in a project");
const sdkEnv = { DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1", MSBUILDDISABLENODEREUSE: "1", DOTNET_CLI_USE_MSBUILD_SERVER: "0", UseSharedCompilation: "false", DOTNET_CLI_HOME: path.join(tmp, "sdk-home"), NUGET_HTTP_CACHE_PATH: path.join(tmp, "sdk-http") };
// (two invented terms, built from pieces as the test runs, so that no file holds them and the check finds none)
const terms = [["qz", "vk", "wy"], ["xj", "qq", "zf"]].map(t => t.join("")).join("\n");
const ownersName = { GIT_AUTHOR_NAME: `An owner ${terms.split("\n")[0]}`, GIT_COMMITTER_NAME: `An owner ${terms.split("\n")[0]}` };
const BODY = "A change.\n\n## What the owner can try\n\nNothing.\n\n## Readings taken\n\nNone.\n";

// ---- a project of another owner's, written by the starter kit of the release `from` ----
function project(name, from, { owner, kit, isPrivate, windows, files, as }) {
  const dir = path.join(tmp, name), origin = path.join(tmp, `${name}.git`);
  git(tmp, "init", "-q", "--bare", "-b", "main", origin);
  fs.mkdirSync(dir);
  if (as) named.set(dir, as);
  git(dir, "init", "-q", "-b", "main");
  if (windows) { git(dir, "config", "core.fileMode", "false"); git(dir, "config", "core.autocrlf", "true"); }
  git(dir, "remote", "add", "origin", origin);
  files(dir);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "the project");
  const k = node(dir, path.join(from.dir, "scripts", "init.mjs"), "--owner", owner, "--name", name, "--at", from.sha, ...kit);
  ok(k.status === 0, `${name}: the starter kit of ${from.tag} writes it`, k.out);
  return { name, dir, owner, isPrivate, named: !!as, repo: `${owner}/${name}` };
}
const write = (dir, to, text) => { fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true }); fs.writeFileSync(path.join(dir, to), text); };

let runs = 0;
// Every workflow of the project's that one event starts, and in it each call to a workflow of the core's, as GitHub
// would run it on the commit `sha` (a pull request: the head, against `baseSha`). Each result: [file/job, result].
function checks(p, event, sha, { baseSha = "", title = "A change", body = BODY, dry = false, only = null, ownToo = false } = {}) {
  const repository = { default_branch: "main", private: p.isPrivate, full_name: p.repo };
  const pull = { number: 1, state: "open", draft: false, title, body, base: { sha: baseSha, ref: "main" }, head: { sha, ref: "change", repo: { full_name: p.repo } }, user: { login: p.owner } };
  const github = { event_name: event, repository: p.repo, actor: p.owner, server_url: "https://github.com", run_id: "1", token: "", sha,
    base_ref: event === "pull_request" ? "main" : "", head_ref: event === "pull_request" ? "change" : "", ref: event === "pull_request" ? "refs/pull/1/merge" : "refs/heads/main",
    event: event === "pull_request" ? { action: "synchronize", pull_request: pull, repository } : event === "push" ? { ref: "refs/heads/main", before: baseSha, after: sha, repository } : { repository } };
  fs.writeFileSync(ghData, JSON.stringify({ "pulls/1$": pull, "issues/1/comments": [summary(sha)], "pulls/1/comments": [], "pulls/1/commits": [{ sha, commit: { author: { name: p.owner } }, author: { login: p.owner } }], "pulls/1/files": [], "/issues\\?": [] }));
  const workspace = () => {
    const ws = path.join(tmp, "ws", String(++runs));
    git(tmp, "clone", "-q", "--no-checkout", p.dir, ws);
    git(ws, "checkout", "-q", "--detach", sha);
    return ws;
  };
  const uses = {
    "actions/checkout": (w, ws) => {
      if (w.repository) {
        if (w.repository !== CORE) throw new Error(`a checkout of another repository: ${w.repository}`);
        const to = path.join(ws, w.path || ".");
        git(tmp, "clone", "-q", "--no-checkout", theCore, to);
        git(to, "checkout", "-q", "--detach", w.ref || "main");
      } else if (w.ref) git(ws, "checkout", "-q", "--detach", git(ws, "rev-parse", `origin/${w.ref}`));
    },
    "actions/setup-node": () => {}, // (the Node this test runs on is the core's own, in CI)
    "actions/dependency-review-action": () => false,
    "github/codeql-action/init": () => false,
    "github/codeql-action/analyze": () => false,
  };
  const out = [];
  const wfDir = git(p.dir, "ls-tree", "--name-only", `${sha}:.github/workflows`).split("\n").filter(f => /\.ya?ml$/.test(f));
  for (const file of wfDir.filter(f => !only || f === only)) {
    const wf = parseYaml(git(p.dir, "show", `${sha}:.github/workflows/${file}`));
    const on = wf.on;
    const trigger = typeof on === "string" ? (on === event ? {} : null) : Array.isArray(on) ? (on.includes(event) ? {} : null) : on?.[event] === undefined ? null : on[event] ?? {};
    if (trigger === null) continue;
    if (trigger.branches && !trigger.branches.includes("main")) continue;
    if (event === "pull_request" && trigger.types && !trigger.types.includes("synchronize") && !trigger.types.includes("opened")) continue;
    // (a workflow of the project's own that calls none of the core's, run as GitHub would where asked: its steps run the
    // project's copy of the core's scripts)
    if (ownToo && Object.values(wf.jobs ?? {}).every(job => !String(job?.uses ?? "").toLowerCase().startsWith(`${CORE.toLowerCase()}/`))) {
      for (const r of runWorkflow(git(p.dir, "show", `${sha}:.github/workflows/${file}`), { github, base: { ...base, ...sdkEnv }, workspace, uses, dry, temp: tmp })) out.push([`${file}/${r.job}`, { ...r, own: true }]);
      continue;
    }
    for (const [id, job] of Object.entries(wf.jobs ?? {})) {
      const call = new RegExp(`^${CORE.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&")}/\\.github/workflows/([\\w.-]+)@([0-9a-f]{40})$`, "i").exec(job.uses ?? "");
      if (!call) { out.push([`${file}/${id}`, { job: id, ran: true, passed: true, steps: [], own: true }]); continue; }
      if (call[1] === "nuget.yml" && !sdk) { out.push([`${file}/${id}`, { job: id, ran: true, passed: true, steps: [] }]); console.log(`note ${p.name}: no .NET SDK here, so the NuGet check is not run`); continue; }
      const text = git(theCore, "show", `${call[2]}:.github/workflows/${call[1]}`);
      const callerCtx = { github, inputs: {}, secrets: { PERSONAL_TERMS: terms }, vars: {} };
      const inputs = Object.fromEntries(Object.entries(job.with ?? {}).map(([k, v]) => [k, typeof v === "string" && v.includes("${{") ? evaluate(v.replace(/^\$\{\{|\}\}$/g, ""), callerCtx) : v]));
      const secrets = job.secrets === "inherit" ? { PERSONAL_TERMS: terms } : Object.fromEntries(Object.entries(job.secrets ?? {}).map(([k, v]) => [k, evaluate(String(v).replace(/^\$\{\{|\}\}$/g, ""), callerCtx)]));
      const caller = { ...github, workflow_ref: `${p.repo}/.github/workflows/${file}@${github.ref}` };
      for (const r of runWorkflow(text, { inputs, secrets, github: caller, base: { ...base, ...sdkEnv }, workspace, uses, dry, temp: tmp })) out.push([`${file}/${id}/${r.job}`, r]);
    }
  }
  return out;
}
const failures = results => results.filter(([, r]) => !r.passed).map(([where, r]) => `${where}: ${r.steps.filter(s => !s.passed).map(s => `${s.name}\n${s.out.trim().split("\n").slice(-8).join("\n")}`).join("\n")}`).join("\n");
const started = results => results.filter(([, r]) => r.ran).map(([where]) => where).sort();

// Whether a step of a workflow of the project's ran, in a set of results.
const ran = (results, file, step) => results.some(([where, r]) => where.startsWith(`${file}/`) && r.steps.some(x => x.name === step && x.ran));
const jobRan = (results, file) => results.some(([where, r]) => where.startsWith(`${file}/`) && r.ran);

function upgrade(p, from, ownChanges, expect) {
  git(p.dir, "commit", "-q", "-m", "the starter kit");
  git(p.dir, "push", "-q", "origin", "main");
  const main0 = git(p.dir, "rev-parse", "HEAD");
  // a pull request of the project's own, before the sync: which jobs it starts
  const own = (from, change) => { git(p.dir, "checkout", "-q", "-B", "change", from); change(p.dir); git(p.dir, "add", "-A"); git(p.dir, "commit", "-q", "-m", "a change of its own"); git(p.dir, "push", "-q", "-f", "origin", "change"); return git(p.dir, "rev-parse", "HEAD"); };
  const was = ownChanges.map(([what, change]) => [what, started(checks(p, "pull_request", own(main0, change), { baseSha: main0, dry: true }))]);

  // the sync, as the project's own copy of the release's sync.mjs makes it
  git(p.dir, "checkout", "-q", "-B", "sync", main0);
  const s = node(p.dir, "core/scripts/sync.mjs");
  ok(s.status === 0 && s.out.includes(carrying), `${p.name}: its own sync script takes the release that carries the change, ${carrying}`, s.out);
  git(p.dir, "add", "-A");
  git(p.dir, "commit", "-q", "-m", `Sync the core to ${carrying}`);
  git(p.dir, "push", "-q", "origin", "sync");
  let syncHead = git(p.dir, "rev-parse", "HEAD");
  let onSync = checks(p, "pull_request", syncHead, { baseSha: main0, title: `Sync the core to ${carrying}` });
  if (p.named) {
    // its machine writes a listed name into every commit: the personal-terms check alone fails, saying how to mend it,
    // and the session mends it in the pull request itself, as the failure says (core archive 202)
    const failed = onSync.filter(([, r]) => !r.passed);
    ok(failed.length === 1 && failed[0][0].startsWith("personal-terms.yml/") && failed[0][1].steps.some(x => /Mend: on the machine that made them/.test(x.out)),
      `${p.name}: on the sync's pull request, its commit carrying a listed name, only the personal-terms check fails, and it says how to mend it`, failures(onSync));
    named.set(p.dir, { GIT_AUTHOR_NAME: p.owner, GIT_AUTHOR_EMAIL: `${p.owner}@users.noreply.github.com`, GIT_COMMITTER_NAME: p.owner, GIT_COMMITTER_EMAIL: `${p.owner}@users.noreply.github.com` });
    git(p.dir, "rebase", "-q", "--exec", "git commit --amend --no-edit --reset-author", "origin/main");
    git(p.dir, "push", "-q", "--force-with-lease", "origin", "sync");
    syncHead = git(p.dir, "rev-parse", "HEAD");
    onSync = checks(p, "pull_request", syncHead, { baseSha: main0, title: `Sync the core to ${carrying}` });
  }
  ok(!failures(onSync), `${p.name}: every check passes on the sync's pull request (${started(onSync).length} jobs${p.named ? ", once mended" : ""})`, failures(onSync));
  const pure = node(p.dir, path.join(theCore, "scripts", "pure-sync.mjs"));
  ok(pure.status === 0 && pure.out.includes(`sha=${syncHead}`), `${p.name}: the sync is pure, as pure-sync.mjs reads it from the release it moves to, whatever modes git here records`, pure.out);

  // merged, as its merger merges it, and pushed to main
  git(p.dir, "checkout", "-q", "main");
  git(p.dir, "merge", "-q", "--no-ff", "-m", "Merge the sync", "sync");
  git(p.dir, "push", "-q", "origin", "main");
  const main1 = git(p.dir, "rev-parse", "HEAD");
  const onPush = checks(p, "push", main1, { baseSha: main0 });
  ok(!failures(onPush), `${p.name}: every check passes on main after the merge (${started(onPush).length} jobs)`, failures(onPush));
  if (process.platform !== "win32") { // (the run is GitHub's, on Linux; its script starts gh as a program, which a stand-in on Windows cannot be)
    const daily = checks(p, "schedule", main1);
    ok(!failures(daily) && started(daily).some(w => w.startsWith("core-moved.yml")), `${p.name}: the daily core-moved run passes`, failures(daily));
  }

  // its own pull requests after the sync: they pass, and start no job they did not start before it
  for (const [what, change] of ownChanges) {
    const results = checks(p, "pull_request", own(main1, change), { baseSha: main1 });
    const before = was.find(([w]) => w === what)[1];
    ok(!failures(results), `${p.name}: a pull request of its own that ${what} passes every check after the sync`, failures(results));
    const more = started(results).filter(w => !before.includes(w));
    ok(!more.length, `${p.name}: and starts no job it did not start before the sync (${started(results).length} now, ${before.length} before)`, more.join("\n"));
    for (const [holds, said] of expect(results, what)) ok(holds, `${p.name}: on a pull request that ${what}, ${said}`);
  }

  // its hooks, as Claude Code runs them: from main's copy, through the commands of its settings
  git(p.dir, "checkout", "-q", "main");
  git(p.dir, "fetch", "-q", "origin");
  const settings = JSON.parse(fs.readFileSync(path.join(p.dir, ".claude/settings.json"), "utf8")).hooks;
  const hook = (event, input) => {
    const command = settings[event][0].hooks[0].command;
    const r = spawnSync("bash", ["-c", command], { cwd: p.dir, input: JSON.stringify(input), env: { ...base, CLAUDE_PROJECT_DIR: p.dir }, encoding: "utf8" });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const start = hook("SessionStart", { hook_event_name: "SessionStart", source: "startup", session_id: "s1" });
  const call = hook("PreToolUse", { hook_event_name: "PreToolUse", session_id: "s1", tool_name: "Agent", tool_input: { description: "x", prompt: "y", subagent_type: "general-purpose", model: "sonnet", effort: "medium" } });
  const stop = hook("Stop", { hook_event_name: "Stop", session_id: "s1", stop_hook_active: false });
  ok(start.status === 0 && call.status === 0 && stop.status === 0 && !/"decision"\s*:\s*"block"/.test(stop.out + start.out), `${p.name}: its hooks run from main's copy and stop nothing in a clean clone`, `${start.out}\n${call.out}\n${stop.out}`);

  // a change that makes something worse than it stood fails, and the mend as the failure words it passes
  const copied = fs.readFileSync(path.join(p.dir, "core/floor/security.md"), "utf8").split(/\r?\n/).find(l => /^- It is never pushed to/.test(l)) ?? "";
  const worse = own(main1, dir => fs.appendFileSync(path.join(dir, "SECURITY.md"), `\n${copied}\n`));
  const failing = checks(p, "pull_request", worse, { baseSha: main1, only: "copies.yml" }).filter(([, r]) => !r.passed);
  ok(copied && failing.length === 1 && failing[0][1].steps.some(x => /a new copy:[\s\S]*Mend: keep it in the one place it belongs and point there from the others/.test(x.out)), `${p.name}: a pull request that adds a copy fails, and its failure says the mend`, failures(failing) || "it passed");
  git(p.dir, "checkout", "-q", "change");
  git(p.dir, "checkout", "-q", main1, "--", "SECURITY.md");
  git(p.dir, "commit", "-q", "-m", "point to one place instead");
  const mended = checks(p, "pull_request", git(p.dir, "rev-parse", "HEAD"), { baseSha: main1, only: "copies.yml" });
  ok(mended.length && !failures(mended), `${p.name}: the mend as the failure words it, the copy taken out, passes`, failures(mended));
  // (the shape check holds from the sync on, though the project has written no config of it yet: the pull request's
  // base is its baseline, so the old function past a mark and the old cycle passed above, and a new one fails)
  const taller = own(main1, dir => fs.writeFileSync(path.join(dir, "src/newer.js"), `export function newer(a) {\n${"  a += 1;\n".repeat(70)}  return a;\n}\n`));
  const tall = checks(p, "pull_request", taller, { baseSha: main1, only: "copies.yml" }).filter(([, r]) => !r.passed);
  ok(tall.length === 1 && tall[0][1].steps.some(x => /1 function passes a mark[\s\S]*Mend: split each by what it does/.test(x.out)), `${p.name}: a pull request that adds a function past a mark fails, and its failure says the mend`, failures(tall) || "it passed");

  // every step a release asks reads done; each step the commit under test adds, taken out, is reported and mended
  git(p.dir, "checkout", "-q", "main");
  const steps = () => node(p.dir, "core/scripts/steps.mjs");
  const reported = out => out.split("\n").filter(l => l.startsWith("- ")).map(l => STEP_LEADS.find(lead => l.startsWith(`- ${lead}:`) || l.startsWith(`- ${lead} (`))).filter(Boolean);
  const clean = () => { git(p.dir, "reset", "-q", "--hard"); git(p.dir, "clean", "-qfd"); };
  const before = leads(git(theCore, "show", `${from.sha}:setup/sync-notes.md`));
  const added = STEP_LEADS.filter(lead => !before.includes(lead) && STAGES[lead]);
  // (a step the commit under test adds that asks something of every project, a check's own list to write, the sync
  // alone does not do: it is reported, it alone, and its mend as written, merged as the project's own pull request
  // would be, makes it done)
  let r = steps();
  const asked = reported(r.out);
  ok(r.status === 0 && asked.every(lead => added.includes(lead) && STAGES[lead].asked), `${p.name}: after the sync, the steps not done are those the release adds that it asks of every project (${asked.length})`, r.out);
  for (const lead of asked) STAGES[lead].mend(p.dir);
  if (asked.length) { git(p.dir, "add", "-A"); git(p.dir, "commit", "-q", "-m", "what the release asks of every project"); }
  r = steps();
  ok(r.status === 0 && r.out.includes("Every step a check reads is done"), `${p.name}: and with each such step mended as it words it, every step a check reads is done`, r.out);
  for (const lead of added) {
    STAGES[lead].stage(p.dir);
    r = steps();
    ok(JSON.stringify(reported(r.out)) === JSON.stringify([lead]), `${p.name}: "${lead}", added since ${from.tag} and taken out, is reported`, r.out);
    STAGES[lead].mend(p.dir);
    r = steps();
    ok(r.out.includes("Every step a check reads is done"), `${p.name}: and its mend as written makes it done`, r.out);
    clean();
  }
  if (!added.length) console.log(`note ${p.name}: no step with a check is added since ${from.tag}`);
  const out = Object.keys(STAGES).filter(() => Math.random() < 0.5);
  if (!out.length) out.push(Object.keys(STAGES)[0]);
  console.log(`note ${p.name}: the steps taken out at random: ${out.join("; ")}`);
  for (const lead of out) STAGES[lead].stage(p.dir);
  r = steps();
  ok(JSON.stringify(reported(r.out)) === JSON.stringify(STEP_LEADS.filter(l => out.includes(l))), `${p.name}: steps taken out at random are reported, exactly those (${out.length})`, `${out.join("\n")}\n---\n${r.out}`);
  clean();

  // where issues answer as switched off, the owner's inbox is the folder: a task given, queued, built and closed there,
  // each in a pull request of its own and merged, with no check failing (core archive 216). On Linux alone, since the
  // script starts gh as a program, which a stand-in on Windows cannot be.
  if (process.platform !== "win32") inboxCase(p);
}

// The inbox as inbox.mjs finds it, GitHub answering for the repository with `repo` (left out: gh gives no answer at
// all), origin's address on github.com for the call alone.
function inbox(p, repo) {
  fs.writeFileSync(ghData, JSON.stringify(repo === undefined ? {} : { [`^repos/${p.repo}$`]: repo }));
  const was = git(p.dir, "config", "--get", "remote.origin.url");
  git(p.dir, "remote", "set-url", "origin", `https://github.com/${p.repo}`);
  try { const r = spawnSync(process.execPath, ["core/scripts/inbox.mjs"], { cwd: p.dir, env: base, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; }
  finally { git(p.dir, "remote", "set-url", "origin", was); }
}

function inboxCase(p) {
  const off = { has_issues: false, permissions: { admin: true, push: true, triage: true, pull: true } };
  const on = { ...off, has_issues: true };
  let r = inbox(p, off);
  ok(r.status === 0 && /^Issues cannot be read and written here \(its issues are switched off\), so the owner's inbox is the folder `inbox\/`/.test(r.out) && /name it to the owner once/.test(r.out),
    `${p.name}: where its issues answer as switched off, the inbox is the folder, and the owner is to be told once`, r.out);
  const item = "State:\nBy: owner\n\n**What it is**\nA word more in the README.\n\n**Why it matters**\nIt says what the project is.\n";
  const progress = "docs/PROGRESS.md", line = "1. `inbox/a-word-more.md`, a builder's; it waits on nothing.";
  const merged = (what, change) => {
    git(p.dir, "checkout", "-q", "-B", "change", "main");
    change(p.dir);
    git(p.dir, "add", "-A");
    git(p.dir, "commit", "-q", "-m", what);
    git(p.dir, "push", "-q", "-f", "origin", "change");
    const main = git(p.dir, "rev-parse", "main");
    const results = checks(p, "pull_request", git(p.dir, "rev-parse", "HEAD"), { baseSha: main, title: what });
    ok(!failures(results), `${p.name}: with the inbox in the folder, the pull request that ${what} passes every check (${started(results).length} jobs)`, failures(results));
    git(p.dir, "checkout", "-q", "main");
    git(p.dir, "merge", "-q", "--no-ff", "-m", `Merge: ${what}`, "change");
    git(p.dir, "push", "-q", "origin", "main");
  };
  merged("makes the folder and files a task the owner gave", dir => {
    write(dir, "inbox/README.md", `# The owner's inbox\n\n${r.out.trim()}\n`);
    write(dir, "inbox/a-word-more.md", item);
  });
  r = inbox(p, off);
  ok(/^The owner's inbox is the folder `inbox\/` \(1 item/.test(r.out) && !/name it to the owner/.test(r.out), `${p.name}: once the folder stands, it is the inbox, and the owner's setting is not named again`, r.out);
  merged("queues it", dir => {
    write(dir, "inbox/a-word-more.md", item.replace("State:\n", "State: queued\n"));
    write(dir, progress, fs.readFileSync(path.join(dir, progress), "utf8").replace(/^1\. FILL IN:.*$/m, line));
  });
  merged("builds it and closes it", dir => {
    fs.appendFileSync(path.join(dir, "README.md"), "\nA project.\n");
    fs.rmSync(path.join(dir, "inbox/a-word-more.md"));
    write(dir, progress, fs.readFileSync(path.join(dir, progress), "utf8").replace(`${line}\n`, ""));
  });
  r = inbox(p, off);
  ok(/^The owner's inbox is the folder `inbox\/` \(0 item/.test(r.out), `${p.name}: the task closed, the folder stands with no item`, r.out);
  write(p.dir, "inbox/another.md", item);
  r = inbox(p, on);
  ok(/one place at a time/.test(r.out) && /another\.md/.test(r.out) && /take `inbox\/` out/.test(r.out), `${p.name}: once its issues answer, each open item is moved over and the folder taken out`, r.out);
  fs.rmSync(path.join(p.dir, "inbox/another.md"));
  r = inbox(p, undefined);
  ok(r.status === 0 && /could not be asked here/.test(r.out) && /nothing moves/.test(r.out), `${p.name}: where gh gives no answer at all, nothing moves and nothing fails`, r.out);
  r = inbox(p, { has_issues: true });
  ok(r.status === 0 && /could not be asked here/.test(r.out), `${p.name}: where GitHub answers for no account, it says what to ask, and fails nothing`, r.out);
}

// Old content, as a project holds it before a check reads it: a breach of each kind a check reads, committed with the
// starter kit. The copy in its prose is listed in its copies baseline, written again by its own copy of the check.
function seed(p, eol) {
  const lines = n => Array.from({ length: n }, (_, i) => `export const v${i} = ${(i * 7919) % 10007};`).join(eol);
  write(p.dir, "src/long.js", `${lines(2000)}${eol}`);
  write(p.dir, "src/a/x.js", `import { y } from "../b/y.js";${eol}export const x = () => y;${eol}`);
  write(p.dir, "src/b/y.js", `import { x } from "../a/x.js";${eol}export const y = () => x;${eol}`);
  write(p.dir, "src/tall.js", `export function tall(a) {${eol}${`  a += 1;${eol}`.repeat(70)}  return a;${eol}}${eol}`);
  const manifest = path.join(p.dir, "core-manifest.md");
  fs.writeFileSync(manifest, fs.readFileSync(manifest, "utf8").replace(/^(Floor: whole\. Modules: .*?)`copilot\.md`, /m, "$1"));
  const copied = fs.readFileSync(path.join(p.dir, "core/floor/security.md"), "utf8").split(/\r?\n/).find(l => /^- Nothing secret goes in the repository/.test(l)) ?? "";
  fs.appendFileSync(path.join(p.dir, "SECURITY.md"), `${eol}${copied}${eol}`);
  const baseline = path.join(p.dir, "checks/copies-baseline.json");
  const had = Object.keys(JSON.parse(fs.readFileSync(baseline, "utf8")).windows).length;
  fs.rmSync(baseline);
  git(p.dir, "add", "-A");
  const first = node(p.dir, "core/scripts/copies.mjs", "checks/copies.json", "--first");
  git(p.dir, "add", "-A");
  ok(copied && first.status === 0 && Object.keys(JSON.parse(fs.readFileSync(baseline, "utf8")).windows).length > had && !/`copilot\.md`/.test(fs.readFileSync(manifest, "utf8").split("\n").find(l => l.startsWith("Floor:"))),
    `${p.name}: seeded with old content of each kind a check reads; the copy is listed in its baseline`, first.out);
}

let synced = null; // (the npm project of the newest release started from, once synced)
for (const tag of starts) {
  const from = { tag, sha: git(theCore, "rev-parse", `${tag}^{commit}`), dir: path.join(tmp, `core-at-${tag}`) };
  git(tmp, "clone", "-q", theCore, from.dir);
  git(from.dir, "checkout", "-q", from.sha);

  // the npm project, public
  const npmProject = project(`an-npm-project-from-${tag}`, from, { owner: "someone-else", kit: ["--npm", "."], isPrivate: false, files: dir => {
    write(dir, "package.json", '{\n  "name": "an-npm-project",\n  "version": "1.0.0",\n  "private": true,\n  "dependencies": {\n    "ms": "2.1.3"\n  }\n}\n');
    write(dir, "package-lock.json", `${JSON.stringify({ name: "an-npm-project", version: "1.0.0", lockfileVersion: 3, requires: true, packages: { "": { name: "an-npm-project", version: "1.0.0", dependencies: { ms: "2.1.3" } },
      "node_modules/ms": { version: "2.1.3", resolved: "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz", integrity: "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==", license: "MIT" } } }, null, 2)}\n`);
    write(dir, "README.md", "# An npm project\n");
    write(dir, ".gitignore", "node_modules/\n");
  } });
  seed(npmProject, "\n");
  synced = npmProject;
  upgrade(npmProject, from, [["touches only its docs", dir => write(dir, "README.md", "# An npm project\n\nMore words.\n")],
    ["touches its package list", dir => write(dir, "package.json", fs.readFileSync(path.join(dir, "package.json"), "utf8").replace('"private": true,', '"private": true,\n  "description": "a project",'))]],
  (results, what) => [[jobRan(results, "security-review.yml"), "a public repository's security-review check runs as before"],
    [ran(results, "signatures.yml", "Install from the lock file, from the registry alone, running no package's install script") === what.includes("package"), "the signature check installs only where the package list changed"]]);

  // the .NET project, private, held as Windows holds it
  const dotnetProject = project(`a-dotnet-project-from-${tag}`, from, { owner: "someone-else", kit: ["--nuget", ".", "--private"], isPrivate: true, windows: true, as: ownersName, files: dir => {
    write(dir, "src/App/App.csproj", `<Project Sdk="Microsoft.NET.Sdk">\r\n  <PropertyGroup>\r\n    <OutputType>Exe</OutputType>\r\n    <TargetFramework>${tfm}</TargetFramework>\r\n    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>\r\n  </PropertyGroup>\r\n</Project>\r\n`);
    write(dir, "src/App/Program.cs", 'System.Console.WriteLine("Hello");\r\n');
    write(dir, "src/App/packages.lock.json", `{\r\n  "version": 1,\r\n  "dependencies": {\r\n    "${tfm}": {}\r\n  }\r\n}\r\n`);
    write(dir, "README.md", "# A .NET project\r\n");
    write(dir, ".gitignore", "bin/\r\nobj/\r\n");
  } });
  const config = path.join(dotnetProject.dir, "checks/licences.json");
  fs.writeFileSync(config, `${JSON.stringify({ ...JSON.parse(fs.readFileSync(config, "utf8")), nuget: { ships: ["src/App/packages.lock.json"], tools: [] } }, null, 2)}\n`);
  git(dotnetProject.dir, "add", "-A");
  ok(git(dotnetProject.dir, "ls-files", "-s").split("\n").every(l => l.startsWith("100644 ")), `${dotnetProject.name}: every file it holds is 100644, as on Windows, the copy of the core's scripts too`);
  seed(dotnetProject, "\r\n");
  upgrade(dotnetProject, from, [["touches only its docs", dir => write(dir, "README.md", "# A .NET project\r\n\r\nMore words.\r\n")],
    ["touches a project file", dir => write(dir, "src/App/App.csproj", fs.readFileSync(path.join(dir, "src/App/App.csproj"), "utf8").replace("</Project>", "  <!-- a note -->\r\n</Project>"))]],
  (results, what) => [[!jobRan(results, "security-review.yml"), "a private repository's security-review check starts no job, so none is billed"],
    ...(sdk ? [[ran(results, "nuget.yml", "Restore each project file from its lock file alone") === what.includes("project file"), "the NuGet check restores only where something NuGet reads changed"]] : [])]);

}

// A release that brings nothing a project takes asks no sync of it (#242, #342): with the copy it has just taken, the
// project stays at the release that carries the change while the next one changes only the core's own files, and
// syncs at the one after, whatever that changes: a jump of two, which this test proves from either of the last two.
if (synced) {
  const p = synced;
  let n = Math.max(number(carrying), ...releases.map(number));
  const ownOnly = (...own) => {
    for (const f of ["scripts/upgrade-test.mjs", ...own]) fs.appendFileSync(path.join(theCore, f), "\n");
    git(theCore, "add", "-A");
    git(theCore, "commit", "-q", "-m", "only the core's own files");
    git(theCore, "tag", `release-${++n}`);
    return git(theCore, "rev-parse", "HEAD");
  };
  ownOnly("QUEUE.md", ".github/workflows/tests.yml"); // (and the core's own queue and a workflow no project calls: #342)
  git(p.dir, "checkout", "-q", "-B", "stays", "main");
  const was = git(p.dir, "status", "--porcelain"), manifest = () => fs.readFileSync(path.join(p.dir, "core-manifest.md"), "utf8");
  let s = node(p.dir, "core/scripts/sync.mjs");
  ok(s.status === 0 && /changes nothing this project takes/.test(s.out) && git(p.dir, "status", "--porcelain") === was && manifest().includes(head), `${p.name}: a release that changes only a test of the core's own scripts, its queue and its tests workflow asks no sync of it, and changes nothing`, s.out);
  const third = ownOnly();
  s = node(p.dir, "core/scripts/sync.mjs");
  ok(s.status === 0 && s.out.includes(`release-${n}`) && manifest().includes(third), `${p.name}: at the next release it syncs all the same, two releases on`, s.out);
}

// A copy older than the first release (#365, #366): no starter kit stood before release-1, so the project is written by
// hand, as one took the core then: core/ at a commit before release-1, its manifest, calls to the core's workflows
// pinned there, and a workflow of its own that runs the copies, licence, pointer and reading-size scripts with configs
// at paths of its own, which its manifest's slots name, a comment naming the licence script before them. Its own old
// sync script, run with no SHA, takes the core's newest main, which no release holds, and pure-sync.mjs says so; with
// the release's full SHA the sync is pure, every check passes, its own workflow's too, no job starts that did not
// before, and steps.mjs and fresh.mjs name the project's own configs. Once as Linux holds it, once as Windows does.
const PRE = "2532c6b"; // (12 November 2026: its sync.mjs takes main and knows no release; no core-moved.mjs)
function preRelease(name, { windows }) {
  const eol = windows ? "\r\n" : "\n";
  const pre = git(theCore, "rev-parse", `${PRE}^{commit}`);
  const dir = path.join(tmp, name), origin = path.join(tmp, `${name}.git`);
  git(tmp, "init", "-q", "--bare", "-b", "main", origin);
  fs.mkdirSync(dir);
  git(dir, "init", "-q", "-b", "main");
  if (windows) { git(dir, "config", "core.fileMode", "false"); git(dir, "config", "core.autocrlf", "true"); }
  git(dir, "remote", "add", "origin", origin);
  fs.mkdirSync(path.join(dir, "core"));
  // (a relative folder, as the old sync script gives it: the tar Windows' runners find reads a drive's colon as a host)
  execFileSync("tar", ["-x", "-f", "-", "-C", "core"], { cwd: dir, input: execFileSync("git", ["archive", pre], { cwd: theCore, env, maxBuffer: 1 << 28 }) });
  const lines = (...l) => `${l.join(eol)}${eol}`;
  const at = () => `${CORE}/.github/workflows`;
  write(dir, "core-manifest.md", lines("# Core manifest", "", `Core: ${CORE} at ${pre}, copied whole under core/ (never edited here).`,
    "Paths: in the core's files, one into floor/, modules/, scripts/, setup/, archive/ or reports/ is under core/; any other is ours.", "Floor: whole. Modules: all.", "",
    "## Names", "", "## Slots", "| Slot | Here |", "| --- | --- |", "| *owner's account* | `someone-else` |",
    "| *copies check* | `core/scripts/copies.mjs` with `config/copies.json` |", "| *size marks* | `config/sizes.json` |"));
  write(dir, "AGENTS.md", lines(`# ${name}`, "", "Read `core-manifest.md` and `SECURITY.md` at the start of every task."));
  write(dir, "SECURITY.md", lines("# Security", "", "3. The protected files.", "   - **the rule files:** `AGENTS.md`;"));
  write(dir, "README.md", lines(`# ${name}`));
  write(dir, "config/copies.json", lines(JSON.stringify({ baseline: "config/copies-baseline.json", code: [], prose: ["README.md"], proseFromSecurity: true })));
  write(dir, "config/licences.json", lines(JSON.stringify({ lockfiles: [], ships: [], audit: "config/licences-audit.json" })));
  write(dir, "config/licences-audit.json", lines(JSON.stringify({ entries: [] })));
  write(dir, "config/sizes.json", lines(JSON.stringify({ each: 20480, read: { "AGENTS.md": 20480, "core-manifest.md": 20480, "core/floor/security.md": 20480 }, total: 81920, split: 51200 })));
  write(dir, ".github/workflows/checks.yml", lines("name: checks", "", "on:", "  pull_request:", "", "jobs:", "  checks:", "    runs-on: ubuntu-latest", "    steps:",
    "      - uses: actions/checkout@0000000000000000000000000000000000000000", "      # core/scripts/licences.mjs reads the config below",
    "      - run: |", "          # core/scripts/licences.mjs takes its config first", "          node core/scripts/copies.mjs config/copies.json", "          node core/scripts/licences.mjs config/licences.json",
    "      - run: node core/scripts/pointers.mjs", "      - run: node core/scripts/reading-size.mjs config/sizes.json"));
  write(dir, ".github/workflows/core.yml", lines("name: core", "", "on:", "  pull_request:", "", "jobs:", "  core:", `    uses: ${at()}/core.yml@${pre}`,
    "  personal-terms:", `    uses: ${at()}/personal-terms.yml@${pre}`, "    secrets:", "      PERSONAL_TERMS: ${{ secrets.PERSONAL_TERMS }}", "  description:", `    uses: ${at()}/pr-description.yml@${pre}`));
  git(dir, "add", "-A");
  const first = node(dir, "core/scripts/copies.mjs", "config/copies.json", "--first");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "the project, its copy of the core older than the first release");
  git(dir, "push", "-q", "origin", "main");
  ok(first.status === 0 && !fs.existsSync(path.join(dir, "core/scripts/core-moved.mjs")), `${name}: written by hand at ${PRE}, its copies baseline by its own copy of the check, and no core-moved.mjs`, first.out);
  const p = { name, dir, owner: "someone-else", isPrivate: true, repo: `someone-else/${name}` };
  const main0 = git(dir, "rev-parse", "HEAD");
  const docs = from => { git(dir, "checkout", "-q", "-B", "change", from); fs.appendFileSync(path.join(dir, "README.md"), `${eol}More words.${eol}`); git(dir, "commit", "-q", "-am", "a change of its own"); return git(dir, "rev-parse", "HEAD"); };
  const before = started(checks(p, "pull_request", docs(main0), { baseSha: main0, dry: true }));

  // its own old sync script, run as its rules say, with no SHA: the core's newest main, which no release holds
  git(theCore, "commit", "-q", "--allow-empty", "-m", "a commit of main past the newest release");
  git(dir, "checkout", "-q", "-B", "sync", main0);
  let s = node(dir, "core/scripts/sync.mjs");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "Sync the core");
  let pure = node(dir, path.join(theCore, "scripts", "pure-sync.mjs"));
  ok(s.status === 0 && fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8").includes(git(theCore, "rev-parse", "HEAD")) && pure.status === 1 && /is no release of the core/.test(pure.out),
    `${name}: its own old sync script, with no SHA, takes the core's main, a commit no release holds, and pure-sync.mjs refuses it`, `${s.out}\n${pure.out}`);

  // with the release's full SHA, as the top of the sync notes says
  git(dir, "checkout", "-q", "-B", "sync", main0);
  s = node(dir, "core/scripts/sync.mjs", head);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", `Sync the core to ${carrying}`);
  git(dir, "push", "-q", "-f", "origin", "sync");
  const syncHead = git(dir, "rev-parse", "HEAD");
  pure = node(dir, path.join(theCore, "scripts", "pure-sync.mjs"));
  ok(s.status === 0 && pure.status === 0 && pure.out.includes(`sha=${syncHead}`), `${name}: with the release's full SHA its own old sync script makes a pure sync to ${carrying}`, `${s.out}\n${pure.out}`);
  const onSync = checks(p, "pull_request", syncHead, { baseSha: main0, title: `Sync the core to ${carrying}`, ownToo: true });
  ok(!failures(onSync) && onSync.some(([w, r]) => w.startsWith("checks.yml/") && r.ran), `${name}: every check passes on the sync's pull request, its own workflow's scripts from the new copy too (${started(onSync).length} jobs)`, failures(onSync));
  git(dir, "checkout", "-q", "main");
  git(dir, "merge", "-q", "--no-ff", "-m", "Merge the sync", "sync");
  git(dir, "push", "-q", "origin", "main");
  const main1 = git(dir, "rev-parse", "HEAD");
  const after = checks(p, "pull_request", docs(main1), { baseSha: main1, ownToo: true });
  const more = started(after).filter(w => !before.includes(w));
  ok(!failures(after) && !more.length, `${name}: a pull request of its own passes after the sync and starts no job it did not start before (${started(after).length} now, ${before.length} before)`, `${failures(after)}\n${more.join("\n")}`);

  // the steps and the differences name the configs where the project holds them, and read no comment as a run
  git(dir, "checkout", "-q", "main");
  const steps = node(dir, "core/scripts/steps.mjs"), fresh = node(dir, "core/scripts/fresh.mjs");
  const tools = steps.out.split("\n").find(l => l.startsWith("- 16 November 2026, an agent's own tools listed:")) ?? "";
  ok(steps.status === 0 && tools.includes("`node core/scripts/agent-tools.mjs config/licences.json`") && !/checks\/(licences|copies)/.test(steps.out) && !/`(reads|takes)`/.test(steps.out),
    `${name}: steps.mjs names the licence config the project's own workflow passes, never a comment's word or the starter kit's path`, steps.out);
  ok(fresh.status === 0 && !/^- checks\/(copies|copies-baseline|licences|licences-audit|sizes)\.json:/m.test(fresh.out) && !/^- config\/[\w-]+\.json: missing/m.test(fresh.out),
    `${name}: fresh.mjs compares the configs where the project holds them, and calls none at the starter kit's paths missing`, fresh.out);
}
preRelease("a-project-older-than-release-1", { windows: false });
preRelease("a-windows-project-older-than-release-1", { windows: true });

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions: a project of each of the last two releases, synced to this commit, passes every check unchanged`);
process.exitCode = failed ? 1 : 0;
