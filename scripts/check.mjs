// The core's checks from plain git (tasks/hosts.md, "One layer knows no host"; core archive 236; #250). Run from a
// project's root, on a person's machine or in any host's pipeline, it runs each workflow of the core's that the project
// calls, as GitHub would run it for a pull request into main (`--base`, the commit it merges into) or for a push to main
// (none given), on the commit checked out (for a pull request, merged into its base, as GitHub merges it, the base its first
// parent): each step's own shell, through workflow-run.mjs, so that no check is written
// twice. The calls are the base's (on a push, main's own), so a change cannot leave a check out by taking its call out:
// the project's .github/workflows, or, where it has none, as on another host, the starter kit's in the base's copy,
// each with the inputs the kit gives them (a template the kit fills in with more than the core's address and pin is
// left out, and said so). core.yml runs first, and where the copy of the core is not the core at its pin no other check
// runs, since each runs the copy's scripts (the steps core.yml runs after its own, given its inputs, among them: a step of
// its own that fails stops the rest here, as a run cancelled there; #376); with no call to core.yml, or none run, it fails. Each called workflow is
// read from the core at the call's pin, fetched from the core's address by git, as GitHub reads it, never from the
// copy under core/, which the change may have edited; and a pipeline runs this script itself from a clone of the core,
// not from that copy (tasks/hosts.md). It runs in a scratch clone of the commit, removed at its end, so it changes
// nothing in the project. The steps run the change's own code, so they get only the variables a program needs to start
// and reach the network, named in KEPT, with a home folder of their own and git's rewrites of an address alone (they
// still run as the caller's user: tasks/hosts.md says where it runs). What only the host can do (a review app's status, the dependency review, code scanning, a job started by a
// schedule) is not run here and is named: that is the host's part, and where a host has none, what stands in is in its
// part (tasks/hosts.md). The personal-terms list is read from the environment (PERSONAL_TERMS), never from a file, as
// the host keeps it among its secrets, and each of its terms is printed as *** wherever a step prints it, in any case. It prints
// each job, each step the host alone runs, and each failing step with what it printed; it exits 1 where one failed.
// Git, bash and Node's own modules.
//
//   node core/scripts/check.mjs [--base <commit>] [--title <the pull request's title>] [--description <a file>]
//                               [--branch <the branch's name, where none is checked out>]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CORE, CORE_SOURCE } from "./core-address.mjs";
import { carriedAt, readCore } from "./core-path.mjs";
import { MEND } from "./mend.mjs";
import { plainEnv } from "./releases.mjs";
import { started } from "./started.mjs";
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
// this where no sign-in is held (tasks/hosts.md).
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
// Every line printed, each term of the personal-terms list (PERSONAL_TERMS, the host's secret) printed as ***, in any
// letters' case, as the check matches it: a workflow's, a job's or a step's name too, not only what a step printed.
const TERMS = (process.env.PERSONAL_TERMS ?? "").split(/\r?\n/).map(t => t.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
const mask = text => TERMS.reduce((t, term) => t.replace(new RegExp(term.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&"), "gi"), "***"), String(text));
const say = text => console.log(mask(text));
const warn = text => console.error(mask(text));
const fail = (what, mend) => { warn(`FAIL ${what} ${MEND}${mend}`); process.exit(1); };
const call = new RegExp(`^${CORE_SOURCE}/\\.github/workflows/([\\w.-]+)@([0-9a-f]{40})$`, "i");

// It runs only as a command; check-test.mjs imports it for HOST_OWN alone.
if (started(import.meta.url)) main();

function main() {
  const p = project(options());
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "core-check-"));
  process.on("exit", () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* (left to the system's own cleaning) */ } });
  const run = runner(p, tmp);
  const jobs = callers(p, tmp).filter(({ wf }) => triggered(wf.on, p))
    .flatMap(({ file, wf }) => Object.entries(wf.jobs ?? {}).map(([id, job]) => ({ file, id, job, name: call.exec(String(job?.uses ?? ""))?.[1] })))
    .filter(j => j.name).sort((a, b) => (b.name === "core.yml") - (a.name === "core.yml"));
  if (!jobs.some(j => j.name === "core.yml")) fail("no call to the core's core.yml starts on this change, so nothing proves the copy of the core is the core.", "call it on every pull request and push to main, as the starter kit's .github/workflows/core.yml does, in the base the change merges into.");
  let failed = 0, ran = 0;
  for (const j of jobs) {
    const r = run(j.file, j.id, j.job);
    failed += r.failed; ran += r.ran;
    if (j.name === "core.yml" && r.copy) { warn(`FAIL the copy of the core is not the core at its pin, so no other check runs: each would run the copy's scripts. ${MEND}mend what core.yml says above, commit, and run this check again.`); break; }
  }
  if (!failed && !ran) fail("no check of the core ran on this change.", "call the core's workflows in the base the change merges into, as the starter kit writes them.");
  say(failed ? `${failed} of the core's checks failed` : `ok   every check of the core that runs from plain git passed (${ran})`);
  process.exitCode = failed ? 1 : 0;
}

// The options given, each checked.
function options() {
  const args = process.argv.slice(2);
  for (const a of args) if (a.startsWith("--") && !["--base", "--title", "--description", "--branch"].includes(a)) fail(`${a} is no option of this check.`, "use --base, --title, --description or --branch, as the usage line at the top of scripts/check.mjs shows.");
  const opt = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] ?? fail(`${name} is given no value.`, "give it one, as the usage line at the top of scripts/check.mjs shows."); };
  return { base: opt("--base"), title: opt("--title"), description: opt("--description"), branch: opt("--branch") };
}

// The pin of the core the manifest's text names (core-path.mjs): its own, or, where a library carries the core, the
// library's, read from the commit `rev` of the repository at `root` (`show` gives a file's text there); where the
// library is a submodule, from the library's commit `rev` pins, in the submodule's own repository. { pin } or { wrong }.
function pinAt(manifest, root, rev, show) {
  const line = readCore(manifest);
  if (line.wrong || line.form === "copied") return line;
  const lib = line.library.slice(0, -1);
  const inSubmodule = f => { try { return git(path.join(root, lib), "show", `${git(root, "rev-parse", `${rev}:${lib}`)}:${f.slice(line.library.length)}`); } catch { return null; } };
  return carriedAt(line, f => show(rev, f) ?? inSubmodule(f));
}

// The project at the commit checked out: its root, head, base, manifest's pin and owner, and the pull request's text.
function project({ base: baseArg, title, description, branch }) {
  let root;
  try { root = git(process.cwd(), "rev-parse", "--show-toplevel"); } catch { fail("this folder is in no git repository.", "run it from the project's root, in its clone."); }
  const show = (rev, file) => { try { return git(root, "show", `${rev}:${file}`); } catch { return null; } };
  const head = git(root, "rev-parse", "HEAD");
  const manifest = show(head, "core-manifest.md");
  if (manifest === null) fail("core-manifest.md is not in the commit checked out.", "run it from the root of a project that takes the core, at a commit that holds its manifest.");
  const pin = pinAt(manifest, root, head, show);
  if (pin.wrong) { const [what, mend] = pin.wrong.split(" Mend: "); fail(what, mend ?? "write the manifest's \"Core:\" line as the sync writes it."); }
  let base = "";
  if (baseArg !== null) {
    try { base = git(root, "rev-parse", "--verify", `${baseArg}^{commit}`); } catch { fail(`--base ${baseArg} is no commit of this repository.`, "give the commit the change merges into, such as origin/main after a fetch."); }
  }
  let body = "";
  if (description !== null) {
    try { body = fs.readFileSync(description, "utf8"); } catch { fail(`--description ${description} cannot be read.`, "give the path of a file that holds the pull request's description."); }
  }
  const owner = /^\| \*owner's account\* \| `([A-Za-z0-9-]+)` \|$/m.exec(manifest)?.[1] ?? "";
  // (the branch's own name, which the personal-terms check reads too: given, or the one checked out)
  let named = branch;
  if (named === null) { try { named = git(root, "symbolic-ref", "--short", "-q", "HEAD"); } catch { named = ""; } }
  return { root, show, head, pin: pin.pin, base, owner, body, described: description !== null, branch: named || "change", title: title ?? git(root, "log", "-1", "--format=%s", head),
    event: base ? "pull_request" : "push", changed: base ? git(root, "diff", "-z", "--name-only", `${base}...${head}`).split("\0").filter(Boolean) : [] };
  // (-z: each path as it is, never quoted as git quotes a name beyond ASCII, so a workflow's path filter reads it)
}

// The project's calls to the core's workflows, as the base the change merges into holds them (on a push, main's own),
// so a change cannot leave a check out by taking its call out: from its .github/workflows; where it has none, the
// starter kit's, from the core itself at the pin the base's manifest holds (never from a copy a change could edit).
function callers({ root, show, head, base }, tmp) {
  const at = base || head;
  const pin = pinAt(show(at, "core-manifest.md") ?? "", root, at, show).pin ?? "";
  const listed = dir => { try { return git(root, "ls-tree", "-z", "--name-only", `${at}:${dir}`).split("\0").filter(Boolean); } catch { return []; } };
  const own = listed(".github/workflows").filter(f => /\.ya?ml$/.test(f)).map(f => readable(f, show(at, `.github/workflows/${f}`))).filter(Boolean);
  if (own.some(c => Object.values(c.wf.jobs ?? {}).some(job => call.test(String(job?.uses ?? ""))))) return own;
  const kit = [];
  const templates = coreFile(tmp, pin, "setup/template/workflows", true);
  if (templates === null) fail(`the base's manifest pins the core at ${pin || "no commit"}, where the starter kit's calls cannot be read.`, "write the manifest's \"Core:\" line as the sync writes it, in the base the change merges into.");
  for (const f of templates.split("\n").filter(f => f.endsWith(".yml.tmpl"))) {
    const text = coreFile(tmp, pin, `setup/template/workflows/${f}`).replaceAll("{{core}}", CORE).replaceAll("{{pin}}", pin);
    const left = text.match(/\{\{[a-z]+\}\}/);
    if (left) say(`note the starter kit's ${f} is filled in with ${left[0]} by the kit, so it is not run: a project that needs it keeps the call it was written`);
    else kit.push({ file: f.replace(/\.tmpl$/, ""), wf: parseYaml(text) });
  }
  say("note the project calls none of the core's workflows from .github/workflows, so the starter kit's calls are run");
  return kit;
}

// A workflow of the project's, read: one in a form workflow-run.mjs does not read is passed over and said so, since it
// is the project's own; one of those that calls the core's fails, since a check would go unrun.
function readable(file, text) {
  try { return { file, wf: parseYaml(text) }; } catch (e) {
    if (text.toLowerCase().includes(`${CORE.toLowerCase()}/.github/workflows/`)) fail(`.github/workflows/${file} calls the core's workflows and is written in a form this check cannot read (${e.message}).`, "write that file's calls to the core as the starter kit writes them, in plain YAML, or run the core's checks on the host meanwhile and report the form to the core (core/README.md, \"Reporting to the core\").");
    say(`note .github/workflows/${file} is written in a form this check does not read (${e.message}); it calls none of the core's workflows, so nothing is left unrun`);
    return null;
  }
}

// Whether a workflow's triggers start it on this pull request or push, as GitHub reads them.
function triggered(on, { event, base, changed }) {
  const trigger = triggerOf(on, event);
  if (trigger === null) return false;
  // (a branch filter is a list of patterns, as GitHub reads it: main must pass the patterns and none of the ignored)
  if (trigger.branches && !pathsLetThrough(trigger.branches, ["main"])) return false;
  if (trigger["branches-ignore"] && pathsLetThrough(trigger["branches-ignore"], ["main"])) return false;
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
  const pull = { number: 0, state: "open", draft: false, title, body, base: { sha: base, ref: "main" }, head: { sha: head, ref: p.branch, repo: { full_name: repo } }, user: { login: owner } };
  return { event_name: p.event, repository: repo, actor: owner, server_url: "https://github.com", run_id: "0", token: "", sha: head,
    base_ref: base ? "main" : "", head_ref: base ? p.branch : "", ref: base ? "refs/pull/0/merge" : "refs/heads/main",
    event: base ? { action: "synchronize", pull_request: pull, repository } : { ref: "refs/heads/main", before: "", after: head, repository } };
}

// What runs a job that calls a workflow of the core's, in a scratch clone of the commit (its base "main"; for a pull
// request, at the merge of the two), and gives how many of its jobs ran and failed.
function runner(p, tmp) {
  const bare = path.join(tmp, "project.git");
  git(tmp, "clone", "-q", "--bare", "--no-hardlinks", p.root, bare);
  git(tmp, "--git-dir", bare, "update-ref", "refs/heads/main", p.base || p.head);
  git(tmp, "--git-dir", bare, "update-ref", "refs/heads/change", p.head);
  const at = p.base ? merged(p, tmp, bare) : p.head;
  let runs = 0;
  const workspace = () => {
    const ws = path.join(tmp, "ws", String(++runs));
    git(tmp, "clone", "-q", "--no-checkout", pathToFileURL(bare).href, ws);
    git(ws, "checkout", "-q", "--detach", at);
    return ws;
  };
  // (the checkouts and Node's setup stand in here; any other action is the host's own, not run and said so)
  const uses = new Proxy({ "actions/checkout": checkout(tmp), "actions/setup-node": () => {} }, { get: (known, action) => known[action] ?? (() => false) });
  const github = context(p);
  const terms = process.env.PERSONAL_TERMS ?? "";
  const home = path.join(tmp, "home");
  fs.mkdirSync(home);
  return (file, id, job) => {
    const name = call.exec(String(job?.uses ?? ""))?.[1];
    const none = { failed: 0, ran: 0 };
    if (!name) return none;
    if (HOST_OWN[name]) { say(`host ${file}/${id}: ${name} is not run here (${HOST_OWN[name]})`); return none; }
    if (name === "pr-description.yml" && !p.described) { say(`note ${file}/${id}: pr-description.yml is not run here: give --description <a file> that holds the pull request's description`); return none; }
    const called = coreFile(tmp, call.exec(job.uses)[2], `.github/workflows/${name}`);
    if (called === null) { warn(`FAIL ${file}/${id}: ${name} is not at ${call.exec(job.uses)[2]} in the core's history. ${MEND}pin the call to a commit of the core's main that holds it, as the sync writes it, or take the call out.`); return { failed: 1, ran: 0 }; }
    // (a caller's `with:` reads no secret, as on GitHub; its `secrets:` reads the one list this script is given)
    const value = (v, secrets) => (typeof v === "string" && v.includes("${{") ? evaluate(v.replace(/^\s*\$\{\{|\}\}\s*$/g, ""), { github, inputs: {}, secrets, vars: {} }) : v);
    const inputs = Object.fromEntries(Object.entries(job.with ?? {}).map(([k, v]) => [k, value(v, {})]));
    undescribed(name, inputs, p.described, `${file}/${id}`);
    const secrets = job.secrets === "inherit" ? { PERSONAL_TERMS: terms } : Object.fromEntries(Object.entries(job.secrets ?? {}).map(([k, v]) => [k, value(v, { PERSONAL_TERMS: terms })]));
    try {
      return report(`${file}/${id}`, runWorkflow(called, { inputs, secrets, github: { ...github, workflow_ref: `${github.repository}/.github/workflows/${file}@${github.ref}` }, base: stepEnv(home), workspace, uses, temp: tmp, stop: name === "core.yml" ? ownSteps(called) : null }), p.event);
    } catch (e) {
      warn(`FAIL ${file}/${id}: ${name} cannot be run from plain git here (${e.message}). ${MEND}run that check on the host meanwhile, and report it to the core (core/README.md, "Reporting to the core").`);
      return { failed: 1, ran: 0 };
    }
  };
}

// core.yml's own steps, before those it runs of the copy's scripts (which begin where it reads where the copy stands):
// one of them that fails stops the rest, since the copy is then not proved the core (#376). A predicate on a step's name.
function ownSteps(text) {
  const steps = Object.values(parseYaml(text).jobs ?? {})[0]?.steps ?? [];
  const parts = steps.findIndex(s => String(s.name ?? "").startsWith("Where the core's copy stands"));
  const own = new Set(steps.slice(0, parts < 0 ? steps.length : parts).map(s => s.name ?? s.uses ?? String(s.run ?? "").split("\n")[0]));
  return name => own.has(name);
}

// core.yml's description check, as a step of its one job (#376), left out where no description is given, and said so.
function undescribed(name, inputs, described, where) {
  if (name !== "core.yml" || inputs.description !== true || described) return;
  inputs.description = false;
  say(`note ${where}: core.yml's description check is not run here: give --description <a file> that holds the pull request's description`);
}

// A file of the core at a commit (with `list`, the names in a folder), from a clone of the core's address made once (never from the project's copy, which
// the change under check may have edited: GitHub too runs a called workflow as the core holds it at the call's pin).
function coreFile(tmp, sha, file, list = false) {
  if (!coreClone) {
    coreClone = path.join(tmp, "core.git");
    try { git(tmp, "clone", "-q", "--bare", `https://github.com/${CORE}`, coreClone); } catch (e) { fail(`the core could not be fetched from https://github.com/${CORE} (${String(e.stderr ?? e.message).trim().split("\n").pop().replace(/:\/\/[^/\s]*@/g, "://")}).`, `let this machine reach github.com, or point git at a copy of the core it can reach (git config url.<the copy>.insteadOf https://github.com/${CORE}), and run this check again.`); }
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) return null;
  try { return list ? git(tmp, "--git-dir", coreClone, "ls-tree", "--name-only", `${sha}:${file}`) : git(tmp, "--git-dir", coreClone, "show", `${sha}:${file}`); } catch { return null; }
}

// The commit a pull request's checks run on, as GitHub makes it: the head merged into its base, the base its first
// parent and the head its second, so a check that reads its base from HEAD^1 finds it.
function merged(p, tmp, bare) {
  const ws = path.join(tmp, "merge");
  git(tmp, "clone", "-q", "--no-checkout", pathToFileURL(bare).href, ws);
  git(ws, "checkout", "-q", "--detach", p.base);
  try { git(ws, "-c", "user.name=core-check", "-c", "user.email=core-check@example.invalid", "merge", "-q", "--no-ff", "--no-edit", p.head); } catch { fail("the change does not merge into its base without a conflict.", "bring the branch up to date with its base, resolve the conflict, commit, and run this check again."); }
  const sha = git(ws, "rev-parse", "HEAD");
  git(ws, "push", "-q", "origin", `${sha}:refs/heads/core-check-merge`); // (a branch, so each job's clone holds it)
  return sha;
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
// the personal-terms list masked; gives how many of its jobs ran and how many failed, and whether a step of core.yml's own failed.
function report(where, results, event) {
  let failed = 0, ran = 0, copy = false;
  for (const r of results) {
    const at = `${where}/${r.job}`;
    if (!r.ran) { say(`skip ${at}: its condition does not hold for this ${event === "push" ? "push" : "pull request"}`); continue; }
    ran++;
    for (const s of r.steps.filter(s => s.ran === false && s.out)) say(`host ${at}: "${s.name}" is the host's own, not run here`);
    if (r.passed) { say(`ok   ${at}`); continue; }
    failed++;
    // (a failure of core.yml's own steps, before those it runs of the copy's scripts, which begin where it reads where the copy stands)
    const parts = r.steps.findIndex(s => s.name.startsWith("Where the core's copy stands"));
    if (r.steps.some((s, i) => !s.passed && (parts < 0 || i < parts))) copy = true;
    for (const s of r.steps.filter(s => !s.passed)) {
      warn(`FAIL ${at}: its step "${s.name}" failed, as it printed below. ${MEND}do what its own failure below says, commit, and run this check again.`);
      warn(s.out.trim().split("\n").map(l => `  ${l}`).join("\n"));
    }
  }
  return { failed, ran, copy };
}
