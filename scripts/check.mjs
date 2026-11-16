// The core's checks from plain git (modules/hosts.md, "One layer knows no host"; core archive 234; #250). Run from a
// project's root, on a person's machine or in any host's pipeline, it runs each workflow of the core's that the project
// calls, as GitHub would run it for a pull request into main (`--base`, the commit it merges into) or for a push to main
// (none given), on the commit checked out: each step's own shell, through workflow-run.mjs, so that no check is written
// twice. The calls are the project's own (its .github/workflows); where it has none, as on another host, the starter
// kit's (core/setup/template/workflows), each with the inputs the kit gives them, a template the kit fills in with more
// than the core's address and pin left out and said so. Each called workflow is read from the core at the call's pin,
// fetched from the core's address by git, as GitHub reads it, never from the project's copy under core/, which the
// change under check may have edited; and a pipeline that checks a change runs this script itself from a clone of the
// core, not from that copy (modules/hosts.md). It runs in a scratch clone of the commit, removed at its end, so it
// changes nothing in the project, and hands the steps no token or secret of its own environment. What only the host can do (a review app's status, the dependency review,
// code scanning, a job started by a schedule) is not run here and is named: that is the host's part, and where a host
// has none, what stands in is in its part (modules/hosts.md). The personal-terms list is read from the environment
// (PERSONAL_TERMS), never from a file, as the host keeps it among its secrets. It prints each job, each step the host
// alone runs, and each failing step with what it printed; it exits 1 where one failed. Git, bash and Node's own modules.
//
//   node core/scripts/check.mjs [--base <commit>] [--title <the pull request's title>] [--description <a file>]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CORE, CORE_SOURCE } from "./core-address.mjs";
import { MEND } from "./mend.mjs";
import { plainEnv } from "./releases.mjs";
import { evaluate, parseYaml, pathsLetThrough, runWorkflow } from "./workflow-run.mjs";

// The core's workflows a project calls that only the host can run, each with why: check-test.mjs holds that every
// workflow the starter kit calls is run here or named here.
export const HOST_OWN = {
  "security-review.yml": "the security review's status reads the host's reviews and comments",
  "codeql.yml": "code scanning is the host's own",
  "delete-merged-branches.yml": "it deletes branches on the host after a merge",
  "look.yml": "the daily look is started by the host's schedule",
  "core-moved.yml": "it is started by the host's schedule",
  "versions.yml": "it is started by the host's schedule",
};

const env = plainEnv();
// what the steps run with: this environment without its tokens and secrets, as a workflow's steps get none but what the
// call passes (git's own settings kept, so a rewrite of the core's address still reaches it)
const SECRET = /TOKEN|SECRET|PASSWORD|CREDENTIAL|^GH_|^GITHUB_|^ACTIONS_|^RUNNER_|^NPM_|^NUGET_|^PERSONAL_TERMS$/i;
const stepEnv = Object.fromEntries(Object.entries(env).filter(([name]) => !SECRET.test(name)));
let coreClone = null; // (the clone of the core's address, made at the first call: coreFile)
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();
const fail = (what, mend) => { console.error(`FAIL ${what} ${MEND}${mend}`); process.exit(1); };
const call = new RegExp(`^${CORE_SOURCE}/\\.github/workflows/([\\w.-]+)@([0-9a-f]{40})$`, "i");

// It runs only as a command; check-test.mjs imports it for HOST_OWN alone.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

function main() {
  const p = project(options());
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "core-check-"));
  process.on("exit", () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* (left to the system's own cleaning) */ } });
  const run = runner(p, tmp);
  let failed = 0;
  for (const { file, text } of callers(p)) {
    if (!triggered(parseYaml(text).on, p)) continue;
    for (const [id, job] of Object.entries(parseYaml(text).jobs ?? {})) failed += run(file, id, job);
  }
  console.log(failed ? `${failed} of the core's checks failed` : "ok   every check of the core that runs from plain git passed");
  process.exitCode = failed ? 1 : 0;
}

// The options given, each checked.
function options() {
  const args = process.argv.slice(2);
  for (const a of args) if (a.startsWith("--") && !["--base", "--title", "--description"].includes(a)) fail(`${a} is no option of this check.`, "use --base, --title or --description, as the usage line at the top of scripts/check.mjs shows.");
  const opt = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] ?? fail(`${name} is given no value.`, "give it one, as the usage line at the top of scripts/check.mjs shows."); };
  return { base: opt("--base"), title: opt("--title"), description: opt("--description") };
}

// The project at the commit checked out: its root, head, base, manifest's pin and owner, and the pull request's text.
function project({ base: baseArg, title, description }) {
  let root;
  try { root = git(process.cwd(), "rev-parse", "--show-toplevel"); } catch { fail("this folder is in no git repository.", "run it from the project's root, in its clone."); }
  const show = (rev, file) => { try { return git(root, "show", `${rev}:${file}`); } catch { return null; } };
  const head = git(root, "rev-parse", "HEAD");
  const manifest = show(head, "core-manifest.md");
  if (manifest === null) fail("core-manifest.md is not in the commit checked out.", "run it from the root of a project that takes the core, at a commit that holds its manifest.");
  const pin = new RegExp(`^Core: ${CORE_SOURCE} at ([0-9a-f]{40}), copied whole under core/`, "m").exec(manifest)?.[1];
  if (!pin) fail(`core-manifest.md has no "Core: ${CORE} at <full commit SHA>, copied whole under core/" line.`, "write that one line, the commit of the core's main that core/ holds, as the sync writes it.");
  let base = "";
  if (baseArg !== null) {
    try { base = git(root, "rev-parse", "--verify", `${baseArg}^{commit}`); } catch { fail(`--base ${baseArg} is no commit of this repository.`, "give the commit the change merges into, such as origin/main after a fetch."); }
  }
  let body = "";
  if (description !== null) {
    try { body = fs.readFileSync(description, "utf8"); } catch { fail(`--description ${description} cannot be read.`, "give the path of a file that holds the pull request's description."); }
  }
  const owner = /^\| \*owner's account\* \| `([A-Za-z0-9-]+)` \|$/m.exec(manifest)?.[1] ?? "";
  return { root, show, head, pin, base, owner, body, described: description !== null, title: title ?? git(root, "log", "-1", "--format=%s", head),
    event: base ? "pull_request" : "push", changed: base ? git(root, "diff", "--name-only", `${base}...${head}`).split("\n").filter(Boolean) : [] };
}

// The project's calls to the core's workflows, from its .github/workflows; where it has none, the starter kit's.
function callers({ root, show, head, pin }) {
  const listed = dir => { try { return git(root, "ls-tree", "--name-only", `${head}:${dir}`).split("\n").filter(Boolean); } catch { return []; } };
  const own = listed(".github/workflows").filter(f => /\.ya?ml$/.test(f)).map(f => ({ file: f, text: show(head, `.github/workflows/${f}`) }));
  if (own.some(c => Object.values(parseYaml(c.text).jobs ?? {}).some(job => call.test(String(job?.uses ?? ""))))) return own;
  const kit = [];
  for (const f of listed("core/setup/template/workflows").filter(f => f.endsWith(".yml.tmpl"))) {
    const text = show(head, `core/setup/template/workflows/${f}`).replaceAll("{{core}}", CORE).replaceAll("{{pin}}", pin);
    const left = text.match(/\{\{[a-z]+\}\}/);
    if (left) console.log(`note the starter kit's ${f} is filled in with ${left[0]} by the kit, so it is not run: a project that needs it keeps the call it was written`);
    else kit.push({ file: f.replace(/\.tmpl$/, ""), text });
  }
  console.log("note the project calls none of the core's workflows from .github/workflows, so the starter kit's calls are run");
  return kit;
}

// Whether a workflow's triggers start it on this pull request or push, as GitHub reads them.
function triggered(on, { event, base, changed }) {
  const trigger = triggerOf(on, event);
  if (trigger === null || (trigger.branches && !trigger.branches.includes("main"))) return false;
  if (!base) return true;
  if (trigger.types && !trigger.types.includes("synchronize") && !trigger.types.includes("opened")) return false;
  if (trigger.paths && !pathsLetThrough(trigger.paths, changed)) return false;
  return !(trigger["paths-ignore"] && changed.every(f => pathsLetThrough(trigger["paths-ignore"], [f])));
}

// The trigger a workflow's "on" gives an event: its settings, {} where it names the event bare, null where none.
function triggerOf(on, event) {
  if (typeof on === "string") return on === event ? {} : null;
  if (Array.isArray(on)) return on.includes(event) ? {} : null;
  return on?.[event] === undefined ? null : on[event] ?? {};
}

// GitHub's context for the run: a pull request numbered 0 from the branch "change" into main, or a push to main.
function context(p) {
  const { root, head, base, owner, title, body } = p;
  let defaultBranch = "main";
  try { defaultBranch = git(root, "symbolic-ref", "--short", "refs/remotes/origin/HEAD").replace(/^origin\//, ""); } catch { /* (none known: main) */ }
  let repo = "local/project";
  try { repo = /[:/]([^/:]+\/[^/]+?)(?:\.git)?$/.exec(git(root, "remote", "get-url", "origin"))?.[1] ?? repo; } catch { /* (no origin) */ }
  const repository = { default_branch: defaultBranch, private: false, full_name: repo };
  const pull = { number: 0, state: "open", draft: false, title, body, base: { sha: base, ref: "main" }, head: { sha: head, ref: "change", repo: { full_name: repo } }, user: { login: owner } };
  return { event_name: p.event, repository: repo, actor: owner, server_url: "https://github.com", run_id: "0", token: "", sha: head,
    base_ref: base ? "main" : "", head_ref: base ? "change" : "", ref: base ? "refs/pull/0/merge" : "refs/heads/main",
    event: base ? { action: "synchronize", pull_request: pull, repository } : { ref: "refs/heads/main", before: "", after: head, repository } };
}

// What runs a job that calls a workflow of the core's, in a scratch clone of the commit (the branch "change", its base
// "main"), and gives the count of its failures.
function runner(p, tmp) {
  const bare = path.join(tmp, "project.git");
  git(tmp, "clone", "-q", "--bare", "--no-hardlinks", p.root, bare);
  git(tmp, "--git-dir", bare, "update-ref", "refs/heads/main", p.base || p.head);
  git(tmp, "--git-dir", bare, "update-ref", "refs/heads/change", p.head);
  let runs = 0;
  const workspace = () => {
    const ws = path.join(tmp, "ws", String(++runs));
    git(tmp, "clone", "-q", "--no-checkout", pathToFileURL(bare).href, ws);
    git(ws, "checkout", "-q", "--detach", p.head);
    return ws;
  };
  // (the checkouts and Node's setup stand in here; any other action is the host's own, not run and said so)
  const uses = new Proxy({ "actions/checkout": checkout(tmp), "actions/setup-node": () => {} }, { get: (known, action) => known[action] ?? (() => false) });
  const github = context(p);
  const terms = process.env.PERSONAL_TERMS ?? "";
  return (file, id, job) => {
    const name = call.exec(String(job?.uses ?? ""))?.[1];
    if (!name) return 0;
    if (HOST_OWN[name]) { console.log(`host ${file}/${id}: ${name} is not run here (${HOST_OWN[name]})`); return 0; }
    if (name === "pr-description.yml" && !p.described) { console.log(`note ${file}/${id}: pr-description.yml is not run here: give --description <a file> that holds the pull request's description`); return 0; }
    const called = coreFile(tmp, call.exec(job.uses)[2], `.github/workflows/${name}`);
    if (called === null) { console.error(`FAIL ${file}/${id}: ${name} is not at ${call.exec(job.uses)[2]} in the core's history. ${MEND}pin the call to a commit of the core's main that holds it, as the sync writes it, or take the call out.`); return 1; }
    const callerCtx = { github, inputs: {}, secrets: { PERSONAL_TERMS: terms }, vars: {} };
    const value = v => (typeof v === "string" && v.includes("${{") ? evaluate(v.replace(/^\s*\$\{\{|\}\}\s*$/g, ""), callerCtx) : v);
    const inputs = Object.fromEntries(Object.entries(job.with ?? {}).map(([k, v]) => [k, value(v)]));
    const secrets = job.secrets === "inherit" ? { PERSONAL_TERMS: terms } : Object.fromEntries(Object.entries(job.secrets ?? {}).map(([k, v]) => [k, value(v)]));
    try {
      return report(`${file}/${id}`, runWorkflow(called, { inputs, secrets, github: { ...github, workflow_ref: `${github.repository}/.github/workflows/${file}@${github.ref}` }, base: stepEnv, workspace, uses, temp: tmp }), p.event);
    } catch (e) {
      console.error(`FAIL ${file}/${id}: ${name} cannot be run from plain git here (${e.message}). ${MEND}run that check on the host meanwhile, and report it to the core (core/README.md, "Reporting to the core").`);
      return 1;
    }
  };
}

// A file of the core at a commit, from a clone of the core's address made once (never from the project's copy, which
// the change under check may have edited: GitHub too runs a called workflow as the core holds it at the call's pin).
function coreFile(tmp, sha, file) {
  if (!coreClone) { coreClone = path.join(tmp, "core.git"); git(tmp, "clone", "-q", "--bare", `https://github.com/${CORE}`, coreClone); }
  try { return git(tmp, "--git-dir", coreClone, "show", `${sha}:${file}`); } catch { return null; }
}

// The stand-in for actions/checkout: the job's own checkout is the scratch clone; the core is fetched from its address.
function checkout(tmp) {
  return (w, ws) => {
    if (!w.repository) { if (w.ref) git(ws, "checkout", "-q", "--detach", git(ws, "rev-parse", `origin/${w.ref}`)); return; }
    if (w.repository.toLowerCase() !== CORE.toLowerCase()) throw new Error(`a checkout of another repository than the core: ${w.repository}`);
    const to = path.join(ws, w.path || ".");
    git(tmp, "clone", "-q", "--no-checkout", `https://github.com/${CORE}`, to);
    git(to, "checkout", "-q", "--detach", w.ref || "main");
  };
}

// Prints each job's verdict, each step the host alone runs, and each failing step with what it printed; gives the
// count of the jobs that failed.
function report(where, results, event) {
  let failed = 0;
  for (const r of results) {
    const at = `${where}/${r.job}`;
    if (!r.ran) { console.log(`skip ${at}: its condition does not hold for this ${event === "push" ? "push" : "pull request"}`); continue; }
    for (const s of r.steps.filter(s => s.ran === false && s.out)) console.log(`host ${at}: "${s.name}" is the host's own, not run here`);
    if (r.passed) { console.log(`ok   ${at}`); continue; }
    failed++;
    for (const s of r.steps.filter(s => !s.passed)) {
      console.error(`FAIL ${at}: its step "${s.name}" failed, as it printed below. ${MEND}do what its own failure below says, commit, and run this check again.`);
      console.error(s.out.trim().split("\n").map(l => `  ${l}`).join("\n"));
    }
  }
  return failed;
}
