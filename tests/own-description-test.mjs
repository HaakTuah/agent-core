// The draft and ready branches of this repository's description check (.github/workflows/own-description.yml), its
// own shell run as GitHub runs it (workflow-run.mjs) on scratch pull requests (#809): each of its two checks, the
// description's (scripts/pr-description.mjs) and the queue's (scripts/queue.mjs), fails a ready pull request where
// its script fails, and on a draft reports the failure, says so and passes; where its script passes, neither branch
// fails or says so; the queue's runs only where QUEUE.md changed; and the description's is asked for the parts the
// changed paths call for. The two scripts are stand-ins, which fail or pass as each case sets and log what they are
// given, so that what is read is the workflow's shell and not the scripts, which their own tests read. Git, bash and
// Node's own modules.
//
//   node tests/own-description-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { checkoutStandIn, root, scratchDir, scratchEnv, tally } from "../scripts/scratch-core.mjs";
import { runWorkflow } from "../scripts/workflow-run.mjs";

const { ok, done } = tally();
const WORKFLOW = fs.readFileSync(path.join(root, ".github/workflows/own-description.yml"), "utf8");
const tmp = scratchDir("own-description-test-");
const env = scratchEnv(tmp, tmp);
const repo = path.join(tmp, "repo"), log = path.join(tmp, "stand-in-log");
const git = (...args) => execFileSync("git", args, { cwd: repo, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const write = (f, text) => { fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }); fs.writeFileSync(path.join(repo, f), text); };

// ---- the base: the stand-ins for the step's scripts, each logging its name and arguments, failing where the case says ----
const standIn = (name, exit) => `import fs from "node:fs";
fs.appendFileSync(process.env.STAND_IN_LOG, JSON.stringify(["${name}", ...process.argv.slice(2)]) + "\\n");
const code = Number(process.env.${exit} ?? 0);
console.log(code ? "FAIL ${name}: as the case sets" : "ok   ${name}");
process.exit(code);
`;
fs.mkdirSync(repo);
git("init", "-q", "-b", "main");
write("scripts/install.mjs", "");
write("scripts/pr-description.mjs", standIn("description", "DESCRIPTION_EXIT"));
write("scripts/queue.mjs", standIn("queue", "QUEUE_EXIT"));
write("QUEUE.md", "# The queue\n");
write("notes.txt", "one\n");
git("add", "-A");
git("commit", "-q", "-m", "the base");
const BASE = git("rev-parse", "HEAD");
// a pull request's merge commit: one commit on the base, which the checkout's HEAD^1 reads as the base
const change = (file) => { git("checkout", "-q", "--detach", BASE); write(file, `${file} changed\n`); git("add", "-A"); git("commit", "-q", "-m", `changes ${file}`); return git("rev-parse", "HEAD"); };
const HEADS = { floor: change("floor/security.md"), scripts: change("scripts/other.mjs"), notes: change("notes.txt"), queue: change("QUEUE.md") };

// ---- one run of the workflow on a pull request: its head, whether it is a draft, which scripts fail ----
function run({ head, draft, description = 0, queue = 0, login = "someone" }) {
  git("checkout", "-q", "--detach", HEADS[head]);
  fs.writeFileSync(log, "");
  const github = { event_name: "pull_request", repository: "someone/project", token: "a-read-only-token", run_id: "1",
    event: { pull_request: { number: 1, draft, body: "the description", created_at: "2026-11-23T00:00:00Z", base: { sha: BASE }, user: { login } } } };
  const [job] = runWorkflow(WORKFLOW, { github, temp: tmp, workspace: () => repo,
    base: { ...env, STAND_IN_LOG: log, DESCRIPTION_EXIT: String(description), QUEUE_EXIT: String(queue) },
    uses: { "actions/checkout": checkoutStandIn(env, tmp), "actions/setup-node": () => {} } });
  const step = (word) => job.steps.find((s) => s.name.includes(word));
  const calls = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { job, description: step("The description has its parts"), queue: step("takes out the lines of closed issues"), calls };
}
const NOTICE = "::notice::A draft:";
const detail = (r) => r.job.steps.map((s) => `${s.name}: ${s.ran ? (s.passed ? "passed" : "failed") : "not run"}\n${s.out}`).join("\n");

// ---- the description's check ----
{
  const r = run({ head: "notes", draft: false, description: 1 });
  ok(!r.job.passed && r.description.ran && !r.description.passed && !r.description.out.includes(NOTICE), "a ready pull request whose description fails the check fails the job, at the description's step, with no draft's notice", detail(r));
  ok(!r.queue.ran, "and the queue's step after it is not run", detail(r));
}
{
  const r = run({ head: "notes", draft: true, description: 1 });
  ok(r.job.passed && r.description.passed && r.description.out.includes("FAIL description") && r.description.out.includes(NOTICE), "a draft's: the failure is printed, the draft's notice said, and the step and the job pass", detail(r));
  ok(r.queue.ran && r.queue.passed, "and the queue's step after it runs", detail(r));
}
for (const draft of [false, true]) {
  const r = run({ head: "notes", draft });
  ok(r.job.passed && r.description.passed && !r.description.out.includes(NOTICE), `one that passes the check passes ${draft ? "on a draft" : "ready"}, with no notice`, detail(r));
}
{
  const r = run({ head: "notes", draft: "false", description: 1 });
  ok(!r.job.passed && !r.description.passed, "a draft flag that is not the boolean true (here the text \"false\") is read as ready, and fails", detail(r));
}

// ---- the queue's check ----
{
  const r = run({ head: "queue", draft: false, queue: 1 });
  ok(!r.job.passed && r.queue.ran && !r.queue.passed && !r.queue.out.includes(NOTICE), "a ready pull request that changes the queue and leaves a closed issue's line fails the job, at the queue's step, with no draft's notice", detail(r));
  ok(r.calls.some(([n, ...a]) => n === "queue" && a.join(" ") === "--check"), "the queue's script is run with --check", JSON.stringify(r.calls));
}
{
  const r = run({ head: "queue", draft: true, queue: 1 });
  ok(r.job.passed && r.queue.passed && r.queue.out.includes("FAIL queue") && r.queue.out.includes(NOTICE), "a draft's: the failure is printed, the draft's notice said, and the step and the job pass", detail(r));
}
for (const draft of [false, true]) {
  const r = run({ head: "queue", draft });
  ok(r.job.passed && r.queue.passed && !r.queue.out.includes(NOTICE), `one whose queue passes the check passes ${draft ? "on a draft" : "ready"}, with no notice`, detail(r));
}
for (const draft of [false, true]) {
  const r = run({ head: "notes", draft, queue: 1 });
  ok(r.job.passed && r.queue.passed && r.queue.out.includes("ok   the queue is not changed") && !r.calls.some(([n]) => n === "queue"), `one that leaves the queue as it was passes ${draft ? "on a draft" : "ready"}, its script not run`, detail(r));
}

// ---- the parts the description is asked for, by the paths changed ----
for (const [head, parts] of [["floor", "+What holds it|What it asks of a project"], ["scripts", "+What it asks of a project"], ["notes", "+"]]) {
  for (const draft of [false, true]) {
    const r = run({ head, draft });
    const asked = r.calls.filter(([n]) => n === "description").map(([, ...a]) => a.join(" "));
    ok(asked.length === 1 && asked[0] === parts, `a change to ${head === "notes" ? "no rule, script or workflow" : `${head}/`} asks the description for "${parts}" ${draft ? "on a draft" : "ready"}`, JSON.stringify(r.calls));
  }
}

// ---- a pull request Dependabot opened is not checked ----
{
  const r = run({ head: "notes", draft: false, description: 1, login: "dependabot[bot]" });
  ok(!r.job.ran && r.job.passed, "Dependabot's own pull request is not checked", detail(r));
}

done("the description check's draft and ready branches");
