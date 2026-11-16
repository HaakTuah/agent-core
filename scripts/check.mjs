// The core's checks from plain git (modules/hosts.md, "One layer knows no host"; core archive 234; #250). Run from a
// project's root, on a person's machine or in any host's pipeline, it runs each workflow of the core's that the project
// calls, as GitHub would run it for a pull request into main (`--base`, the commit it merges into) or for a push to main
// (none given), on the commit checked out: each step's own shell, through workflow-run.mjs, so that no check is written
// twice. The calls are the base's (on a push, main's own), so a change cannot leave a check out by taking its call out:
// the project's .github/workflows, or, where it has none, as on another host, the starter kit's in the base's copy,
// each with the inputs the kit gives them (a template the kit fills in with more than the core's address and pin is
// left out, and said so). core.yml runs first, and where the copy of the core is not the core at its pin no other check
// runs, since each runs the copy's scripts; with no call to core.yml, or none run, it fails. Each called workflow is
// read from the core at the call's pin, fetched from the core's address by git, as GitHub reads it, never from the
// copy under core/, which the change may have edited; and a pipeline runs this script itself from a clone of the core,
// not from that copy (modules/hosts.md). It runs in a scratch clone of the commit, removed at its end, so it changes
// nothing in the project. The steps run the change's own code, so they get only the variables a program needs to start
// and reach the network, named in KEPT, with a home folder of their own and git's rewrites of an address alone (they
// still run as the caller's user: modules/hosts.md says where it runs). What only the host can do (a review app's status, the dependency review, code scanning, a job started by a
// schedule) is not run here and is named: that is the host's part, and where a host has none, what stands in is in its
// part (modules/hosts.md). The personal-terms list is read from the environment (PERSONAL_TERMS), never from a file, as
// the host keeps it among its secrets, and each of its terms is printed as *** wherever a step prints it, in any case. It prints
// each job, each step the host alone runs, and each failing step with what it printed; it exits 1 where one failed.
// Git, bash and Node's own modules.
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
// What the steps run with, since they run the change's own code (its copy's scripts, its packages' restore): only what
// a program needs to start and reach the network, by name, with a home folder of its own in the scratch folder, no
// system git settings, and of git's settings given here only the rewrites of an address (url.*.insteadOf), so no token
// in this environment or in git's settings reaches them. They still run as the caller's own user, so a pipeline runs
// this where no sign-in is held (modules/hosts.md).
const KEPT = /^(PATH|LANG|LC_[A-Z]+|TZ|TMPDIR|TEMP|TMP|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|HTTPS?_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR|GIT_ALLOW_PROTOCOL)$/i;
function stepEnv(home) {
  const kept = Object.fromEntries(Object.entries(env).filter(([name]) => KEPT.test(name)));
  const rewrites = [];
  for (let i = 0; i < Number(env.GIT_CONFIG_COUNT ?? 0); i++) {
    const key = env[`GIT_CONFIG_KEY_${i}`] ?? "";
    // (a rewrite that carries a sign-in, "url.https://user:token@host/.insteadOf", is left out)
    if (/^url\..+\.insteadof$/i.test(key) && !/:\/\/[^/]*@/.test(key)) rewrites.push([key, env[`GIT_CONFIG_VALUE_${i}`] ?? ""]);
  }
  const git = Object.fromEntries(rewrites.flatMap(([key, value], i) => [[`GIT_CONFIG_KEY_${i}`, key], [`GIT_CONFIG_VALUE_${i}`, value]]));
  return { ...kept, ...git, GIT_CONFIG_COUNT: String(rewrites.length), GIT_CONFIG_NOSYSTEM: "1", HOME: home, USERPROFILE: home };
}
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
  const jobs = callers(p).filter(({ text }) => triggered(parseYaml(text).on, p))
    .flatMap(({ file, text }) => Object.entries(parseYaml(text).jobs ?? {}).map(([id, job]) => ({ file, id, job, name: call.exec(String(job?.uses ?? ""))?.[1] })))
    .filter(j => j.name).sort((a, b) => (b.name === "core.yml") - (a.name === "core.yml"));
  if (!jobs.some(j => j.name === "core.yml")) fail("no call to the core's core.yml starts on this change, so nothing proves the copy of the core is the core.", "call it on every pull request and push to main, as the starter kit's .github/workflows/core.yml does, in the base the change merges into.");
  let failed = 0, ran = 0;
  for (const j of jobs) {
    const r = run(j.file, j.id, j.job);
    failed += r.failed; ran += r.ran;
    if (j.name === "core.yml" && r.failed) { console.error(`FAIL the copy of the core is not the core at its pin, so no other check runs: each would run the copy's scripts. ${MEND}mend what core.yml says above, commit, and run this check again.`); break; }
  }
  if (!failed && !ran) fail("no check of the core ran on this change.", "call the core's workflows in the base the change merges into, as the starter kit writes them.");
  console.log(failed ? `${failed} of the core's checks failed` : `ok   every check of the core that runs from plain git passed (${ran})`);
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

// The project's calls to the core's workflows, as the base the change merges into holds them (on a push, main's own),
// so a change cannot leave a check out by taking its call out: from its .github/workflows; where it has none, the
// starter kit's, from the base's copy, pinned where the base's manifest pins the core.
function callers({ root, show, head, base }) {
  const at = base || head;
  const pin = new RegExp(`^Core: ${CORE_SOURCE} at ([0-9a-f]{40}), copied whole under core/`, "m").exec(show(at, "core-manifest.md") ?? "")?.[1] ?? "";
  const listed = dir => { try { return git(root, "ls-tree", "--name-only", `${at}:${dir}`).split("\n").filter(Boolean); } catch { return []; } };
  const own = listed(".github/workflows").filter(f => /\.ya?ml$/.test(f)).map(f => ({ file: f, text: show(at, `.github/workflows/${f}`) }));
  if (own.some(c => Object.values(parseYaml(c.text).jobs ?? {}).some(job => call.test(String(job?.uses ?? ""))))) return own;
  const kit = [];
  for (const f of listed("core/setup/template/workflows").filter(f => f.endsWith(".yml.tmpl"))) {
    const text = show(at, `core/setup/template/workflows/${f}`).replaceAll("{{core}}", CORE).replaceAll("{{pin}}", pin);
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
  // (each listed term is printed as *** wherever a step prints it, in any letters' case, as the check matches it)
  const listed = terms.split(/\r?\n/).map(t => t.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  const mask = text => listed.reduce((t, term) => t.replace(new RegExp(term.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&"), "gi"), "***"), text);
  const home = path.join(tmp, "home");
  fs.mkdirSync(home);
  return (file, id, job) => {
    const name = call.exec(String(job?.uses ?? ""))?.[1];
    const none = { failed: 0, ran: 0 };
    if (!name) return none;
    if (HOST_OWN[name]) { console.log(`host ${file}/${id}: ${name} is not run here (${HOST_OWN[name]})`); return none; }
    if (name === "pr-description.yml" && !p.described) { console.log(`note ${file}/${id}: pr-description.yml is not run here: give --description <a file> that holds the pull request's description`); return none; }
    const called = coreFile(tmp, call.exec(job.uses)[2], `.github/workflows/${name}`);
    if (called === null) { console.error(`FAIL ${file}/${id}: ${name} is not at ${call.exec(job.uses)[2]} in the core's history. ${MEND}pin the call to a commit of the core's main that holds it, as the sync writes it, or take the call out.`); return { failed: 1, ran: 0 }; }
    // (a caller's `with:` reads no secret, as on GitHub; its `secrets:` reads the one list this script is given)
    const value = (v, secrets) => (typeof v === "string" && v.includes("${{") ? evaluate(v.replace(/^\s*\$\{\{|\}\}\s*$/g, ""), { github, inputs: {}, secrets, vars: {} }) : v);
    const inputs = Object.fromEntries(Object.entries(job.with ?? {}).map(([k, v]) => [k, value(v, {})]));
    const secrets = job.secrets === "inherit" ? { PERSONAL_TERMS: terms } : Object.fromEntries(Object.entries(job.secrets ?? {}).map(([k, v]) => [k, value(v, { PERSONAL_TERMS: terms })]));
    try {
      return report(`${file}/${id}`, runWorkflow(called, { inputs, secrets, github: { ...github, workflow_ref: `${github.repository}/.github/workflows/${file}@${github.ref}` }, base: stepEnv(home), workspace, uses, temp: tmp }), p.event, mask);
    } catch (e) {
      console.error(`FAIL ${file}/${id}: ${name} cannot be run from plain git here (${e.message}). ${MEND}run that check on the host meanwhile, and report it to the core (core/README.md, "Reporting to the core").`);
      return { failed: 1, ran: 0 };
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
    const to = path.resolve(ws, w.path || ".");
    if (to === ws || !to.startsWith(ws + path.sep)) throw new Error(`a checkout into ${w.path || "."}, which is not a folder inside the job's own`);
    git(tmp, "clone", "-q", "--no-checkout", `https://github.com/${CORE}`, to);
    git(to, "checkout", "-q", "--detach", w.ref || "main");
  };
}

// Prints each job's verdict, each step the host alone runs, and each failing step with what it printed, every term of
// the personal-terms list masked; gives how many of its jobs ran and how many failed.
function report(where, results, event, mask) {
  let failed = 0, ran = 0;
  for (const r of results) {
    const at = `${where}/${r.job}`;
    if (!r.ran) { console.log(`skip ${at}: its condition does not hold for this ${event === "push" ? "push" : "pull request"}`); continue; }
    ran++;
    for (const s of r.steps.filter(s => s.ran === false && s.out)) console.log(`host ${at}: "${s.name}" is the host's own, not run here`);
    if (r.passed) { console.log(`ok   ${at}`); continue; }
    failed++;
    for (const s of r.steps.filter(s => !s.passed)) {
      console.error(`FAIL ${at}: its step "${s.name}" failed, as it printed below. ${MEND}do what its own failure below says, commit, and run this check again.`);
      console.error(mask(s.out.trim()).split("\n").map(l => `  ${l}`).join("\n"));
    }
  }
  return { failed, ran };
}
