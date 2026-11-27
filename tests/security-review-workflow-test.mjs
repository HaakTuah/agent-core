// The security-review workflow's own shell (.github/workflows/security-review.yml), run as GitHub runs it
// (workflow-run.mjs) for each kind of input it branches on (#625; the kinds E1, E10, E12, E13, W12, P5, P7, P11, R7 and
// PL3 of the pass recorded in reports/2026-11-18-the-security-review-status-read-whole.md): held(), which sets BOUND;
// the sync-shape filter and the merge filter, which decide whether a proof runs; the loop that reads commenters' rights;
// a default branch whose core lacks one of the check's scripts; the inputs root, advisory and reviewers; and each
// pull_request action the callers list. GitHub's API is a stand-in `gh` whose answers each case sets, and which logs
// each route read and each status posted, so that what the shell asked and what it posted are read, never what it says
// of itself. The scripts the shell runs are the core's own, as they stand. Git, jq, bash, timeout and Node's own modules.
//
//   node tests/security-review-workflow-test.mjs
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { checkoutStandIn, root, scratchDir, scratchEnv, tally } from "../scripts/scratch-core.mjs";
import { parseYaml } from "../scripts/parse-yaml.mjs";
import { runWorkflow } from "../scripts/workflow-run.mjs";

const self = fileURLToPath(import.meta.url);
const WORKFLOW = fs.readFileSync(path.join(root, ".github/workflows/security-review.yml"), "utf8");
const slash = (p) => p.replace(/\\/g, "/");
const sha = (c) => c.repeat(40);
const BASE = sha("0"), SEEN = sha("1"), HEAD = sha("2"), MAIN = sha("3"), OWN = sha("4");
const FIRST = sha("5"), MERGE = sha("6"), BEFORE = sha("7");
const OPENED = "2026-11-15T09:00:00Z", CAME = "2026-11-16T00:00:00Z";

// ---- the default branch: the core's scripts at its root (root ".") and under core/ (the default root), in one repository ----
function fixture(tmp, env) {
  const repo = path.join(tmp, "repo");
  for (const at of [".", "core"]) {
    fs.cpSync(path.join(root, "scripts"), path.join(repo, at, "scripts"), { recursive: true });
    fs.copyFileSync(path.join(root, ".node-version"), path.join(repo, at, ".node-version"));
  }
  const git = (...args) => execFileSync("git", args, { cwd: repo, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "the default branch");
  // (GitHub's stand-in: a GET answered from the case's data, a route's pattern to its answer, {$fail} an error of the
  // host's and {$slow} an answer that comes after that many seconds; none found, gh's own 404; each GET and each post
  // logged as a line of JSON; --jq read only as ".key", the one form the shell uses)
  const bin = path.join(tmp, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "gh"), `#!/usr/bin/env node
const fs = require("fs");
const a = process.argv.slice(2), data = JSON.parse(fs.readFileSync(process.env.GH_DATA, "utf8"));
const log = (entry) => fs.appendFileSync(process.env.GH_LOG, JSON.stringify(entry) + "\\n");
const route = a.find((x, i) => i > 0 && !x.startsWith("-") && !["-X", "--input", "--jq"].includes(a[i - 1]));
if (a.includes("-X")) { log({ post: route, body: JSON.parse(fs.readFileSync(0, "utf8")) }); process.exit(0); }
log({ get: route });
const found = Object.entries(data).find(([pattern]) => new RegExp(pattern).test(route));
if (!found) { console.error("gh: Not Found (HTTP 404)"); process.exit(1); }
const v = found[1];
if (v && v.$fail) { console.error("gh: " + v.$fail); process.exit(1); }
if (v && v.$slow) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, v.$slow * 1000);
if (a.includes("--jq")) { const f = a[a.indexOf("--jq") + 1]; if (!/^\\.\\w+$/.test(f)) process.exit(3); console.log(String(v?.[f.slice(1)] ?? "")); process.exit(0); }
console.log(JSON.stringify(a.includes("--slurp") ? [v] : v));
`, { mode: 0o755 });
  // (the runner's jq ends a line with LF, a Windows jq with CRLF, which `for login in $(jq -r ...)` keeps in each login:
  // there the same jq runs with --binary)
  if (execFileSync("jq", ["-rn", '"a"'], { env, encoding: "utf8" }).includes("\r")) {
    const real = execFileSync(process.platform === "win32" ? "where" : "which", ["jq"], { env, encoding: "utf8" }).split(/\r?\n/)[0];
    fs.writeFileSync(path.join(bin, "jq"), `#!/bin/sh\nexec "${slash(real)}" --binary "$@"\n`, { mode: 0o755 });
  }
  return { repo, bin, blob: (p) => git("rev-parse", `HEAD:${p}`) };
}

// ---- one run of the workflow ----
// `files` and `commits` are the pull request's, as GitHub lists them; `comments` follow Codex's summary of `reviewed`;
// `data` adds routes; `inputs` the call's; `missing` the scripts the default branch's core lacks, `broken` those that
// fail as they run; `action` the event's;
// `copyAt` the folder the default branch's manifest names for the copy of the core (a manifest is written, #918).
function runCase(fx, env, tmp, { files = [{ filename: "notes.txt" }], cut = 0, commits = [{ sha: SEEN, parents: [{ sha: BASE }] }, { sha: HEAD, parents: [{ sha: SEEN }] }],
  reviewed = SEEN, comments = [], data = {}, inputs = { advisory: false, root: "." }, missing = [], broken = [], action = "synchronize", base = {}, copyAt = null } = {}) {
  const dir = fs.mkdtempSync(path.join(tmp, "case-"));
  const ghData = path.join(dir, "data.json"), ghLog = path.join(dir, "log");
  const repoOf = { full_name: "someone/project" };
  const pull = { number: 7, state: "open", draft: false, created_at: OPENED, changed_files: files.length + cut, commits: commits.length,
    head: { sha: HEAD, ref: "change", repo: repoOf }, base: { sha: BASE, ref: "main", repo: { ...repoOf, owner: { login: "someone" } } }, user: { login: "someone" } };
  const state = { code_review: { commit_sha: reviewed, status: "completed" }, security_review: { commit_sha: reviewed, has_any_findings: false, has_unresolved_findings: false, status: "completed" } };
  const summary = { user: { login: "chatgpt-codex-connector[bot]", type: "Bot" }, author_association: "NONE", created_at: "2026-11-15T10:00:00Z", updated_at: "2026-11-15T10:00:00Z",
    body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify(state)} -->\n<details>the table</details>` };
  fs.writeFileSync(ghData, JSON.stringify({ "pulls/7$": pull, "issues/7/comments": [summary, ...comments], "pulls/7/comments": [], "pulls/7/commits": commits, "pulls/7/files": files, ...data }));
  fs.writeFileSync(ghLog, "");
  // (a copy, its history with it, where a script is taken out of the working tree; otherwise the one repository, which
  // the shell writes nothing into)
  const workspace = () => {
    if (!missing.length && !broken.length && copyAt === null) return fx.repo;
    const ws = fs.mkdtempSync(path.join(tmp, "ws-"));
    fs.cpSync(fx.repo, ws, { recursive: true });
    for (const p of missing) fs.rmSync(path.join(ws, p));
    for (const p of broken) fs.writeFileSync(path.join(ws, p), "process.exit(1);\n");
    if (copyAt !== null) {
      // (the manifest tracked, and the core's own scripts/core-path.mjs not, as in a project's checkout: the scripts at
      // the root stay on disk for the workflow to run, but git tracks them as a project would not, so the core's own
      // repository is told apart from a project's by what git tracks, core-path.mjs)
      fs.writeFileSync(path.join(ws, "core-manifest.md"), `# Core manifest\n\nCore: ${CORE} at ${"a".repeat(40)}, copied whole under ${copyAt} (never edited here).\n`);
      execFileSync("git", ["add", "core-manifest.md"], { cwd: ws, stdio: "ignore" });
      execFileSync("git", ["rm", "-q", "--cached", "scripts/core-path.mjs"], { cwd: ws, stdio: "ignore" });
    }
    return ws;
  };
  let nodeFile;
  const github = { event_name: "pull_request", repository: "someone/project", actor: "someone", server_url: "https://github.com", run_id: "1", token: "not-a-token",
    event: { action, pull_request: pull, repository: { default_branch: "main", private: false } } };
  const [job] = runWorkflow(WORKFLOW, { github, inputs, temp: dir, workspace,
    base: { ...env, PATH: `${fx.bin}${path.delimiter}${env.PATH}`, GH_DATA: ghData, GH_LOG: ghLog, ...base },
    uses: { "actions/checkout": checkoutStandIn(env, tmp), "actions/setup-node": (w) => { nodeFile = w["node-version-file"]; } } });
  const log = fs.readFileSync(ghLog, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const posted = (context) => log.find((e) => e.post && e.body.context === context)?.body;
  return { ran: job.ran, passed: job.passed, out: job.steps.map((s) => s.out).join(""), gets: log.filter((e) => e.get).map((e) => e.get),
    security: posted("security-review"), code: posted("code-review"), posts: log.filter((e) => e.post).length, nodeFile };
}

const tmp = scratchDir("security-review-workflow-test-");
// (the project's address rewritten to the scratch repository, so the proofs' fetch never leaves this machine)
const env0 = scratchEnv(tmp, tmp);
const n = Number(env0.GIT_CONFIG_COUNT);
const env = { ...env0, GIT_CONFIG_COUNT: String(n + 1), [`GIT_CONFIG_KEY_${n}`]: `url.${slash(path.join(tmp, "repo"))}.insteadOf`, [`GIT_CONFIG_VALUE_${n}`]: "https://github.com/someone/project.git" };
const member = (login, body, association = "MEMBER") => ({ user: { login, type: "User" }, author_association: association, created_at: "2026-11-15T11:00:00Z", updated_at: "2026-11-15T11:00:00Z", body });
const right = (login, permission, role_name = permission) => ({ [`collaborators/${login}/permission$`]: { permission, role_name, user: { login, type: "User" } } });

// ---- the rights' time spent: run beside the rest, since it waits out the loop's 30 seconds on the clock it guards ----
if (process.argv[2] === "--spent") {
  const fx = { repo: process.argv[3], bin: process.argv[4] };
  const slow = ["m1", "m2", "m3", "m4", "m5"];
  const r = runCase(fx, env, process.argv[5], { comments: slow.map((l) => member(l, `Security review: ${HEAD}\nNo blocking finding.\nNo other finding.`)),
    data: Object.fromEntries(slow.map((l) => [`collaborators/${l}/permission$`, { $slow: 15 }])) });
  console.log(JSON.stringify({ ...r, out: r.out.slice(-4000) }));
  process.exit(0);
}

const { ok, done } = tally();
for (const tool of ["jq", "timeout"]) {
  try { execFileSync(tool, ["--version"], { stdio: "ignore" }); } catch { console.log(`skip: ${tool} is not on the PATH, which the workflow's shell needs, as GitHub's runners have it`); process.exit(0); }
}
const fx = fixture(tmp, env);
const spentDir = fs.mkdtempSync(path.join(tmp, "spent-"));
const child = spawn(process.execPath, [self, "--spent", fx.repo, fx.bin, spentDir], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
let spentOut = "";
child.stdout.on("data", (b) => { spentOut += b; });
child.stderr.on("data", (b) => { spentOut += b; });
const spentExit = new Promise((resolve) => child.on("close", resolve));
const run = (opts) => runCase(fx, env, tmp, opts);
const show = (r) => `${r.out}\n${JSON.stringify({ security: r.security, code: r.code, gets: r.gets })}`;
const since = (script, at = ".") => `path=${encodeURIComponent(slash(path.join(at, "scripts", script)).replace(/^\.\//u, ""))}`;

// ---- held(), which sets BOUND (P11) ----
// a later commit with no review: held, it waits; not held, it asks when the script came, and, opened before that, is told
// (a text matched as itself in the stand-in's patterns)
const literal = (text) => text.replace(/[\\^$.*+?()[\]{}|/]/gu, "\\$&");
const came = (script) => ({ [`commits\\?${literal(since(script))}`]: [{ sha: FIRST }], [`commits/${FIRST}/pulls`]: [{ merged_at: CAME, base: { ref: "main" }, merge_commit_sha: MERGE }],
  [`commits/${MERGE}$`]: { sha: MERGE, parents: [{ sha: BEFORE }, { sha: FIRST }] } });
const history = { ...came("security-review.mjs"), ...came("code-review-wait.mjs") };
const theirs = (answer, script = "security-review.mjs") => ({ [`contents/${literal(`scripts/${script}`)}\\?ref=${HEAD}`]: answer });
const told = (r) => r.passed && r.security?.state === "success" && r.security.description.includes("before this check came") && r.gets.some((g) => g.includes(since("security-review.mjs")));
const held = (r) => r.passed && r.security?.state === "pending" && !r.security.description.includes("before this check came") && !r.gets.some((g) => g.includes(since("security-review.mjs")));
const other = run({ data: { ...history, ...theirs({ sha: sha("9") }) } });
ok(told(other), "held(): a head whose copy of the script is other than the default branch's is not held, and, opened before the script came, is told", show(other));
const absent = run({ data: history });
ok(told(absent), "  nor one whose head holds no copy (the host's 404)", show(absent));
const equal = run({ data: { ...history, ...theirs({ sha: fx.blob("scripts/security-review.mjs") }) } });
ok(held(equal) && equal.gets.some((g) => g.startsWith(`repos/someone/project/contents/scripts/security-review.mjs?ref=${HEAD}`)), "  one whose head's copy is the default branch's is held, read from the host", show(equal));
const unreadable = run({ data: { ...history, ...theirs({ $fail: "HTTP 502: Bad Gateway" }) } });
ok(held(unreadable), "  so is one whose copy the host gives an error for other than 404", show(unreadable));
const changed = run({ files: [{ filename: "notes.txt" }, { filename: "scripts/security-review.mjs" }], data: history });
const renamed = run({ files: [{ filename: "notes.txt" }, { filename: "scripts/review.mjs", previous_filename: "scripts/security-review.mjs" }], data: history });
const cut = run({ cut: 1, data: history });
ok([changed, renamed, cut].every((r) => held(r) && !r.gets.some((g) => g.includes("contents/scripts/security-review.mjs"))),
  "  and one that changes the script, renames it away, or whose list of files is cut short, without reading the head's copy", [changed, renamed, cut].map(show).join("\n"));

// ---- the copy of the core where the default branch's manifest names it (#918): a change in it asks no second review ----
const insideCopy = { filename: "vendor/core/.github/workflows/ci.yml", status: "modified", patch: "@@ -1 +1 @@\n-      - run: a\n+      - run: b" };
const atVendor = run({ files: [insideCopy], copyAt: "vendor/core/", reviewed: HEAD }), atOther = run({ files: [insideCopy], copyAt: "elsewhere/core/", reviewed: HEAD }), unmanifested = run({ files: [insideCopy], reviewed: HEAD });
ok(atVendor.passed && atVendor.security?.state === "success" && !/floor rule 3/u.test(atVendor.security.description) && [atOther, unmanifested].every((r) => r.passed && /floor rule 3/u.test(r.security?.description ?? "")),
  "a change inside the copy at the path the manifest on the default branch names asks no second review; at another path, or with no manifest, it is the project's own file", [atVendor, atOther, unmanifested].map(show).join("\n"));

// ---- the sync-shape filter (P5) ----
const manifest = (p) => ({ filename: "core-manifest.md", patch: p ? `@@ -3 +3 @@\n-Core: ${CORE} at ${sha("a")}, copied whole under ${p} by a sync\n+Core: ${CORE} at ${sha("b")}, copied whole under ${p} by a sync` : "" });
const shaped = (r) => r.passed && /pure sync/u.test(r.out);
const atCore = run({ files: [manifest(), { filename: "core/scripts/x.mjs" }, { filename: ".github/workflows/core.yml" }] });
const atPath = run({ files: [manifest("vendor/core/"), { filename: "vendor/core/scripts/x.mjs" }] });
ok(shaped(atCore) && shaped(atPath), "the sync-shape filter: the manifest with a copy at core/, or at the path its patch names, and workflows, takes the proof", show(atCore) + show(atPath));
const outside = run({ files: [manifest(), { filename: "core/scripts/x.mjs" }, { filename: "README.md" }] });
const unnamed = run({ files: [manifest(), { filename: "vendor/core/scripts/x.mjs" }] });
const noManifest = run({ files: [{ filename: "core/scripts/x.mjs" }] });
ok([outside, unnamed, noManifest].every((r) => r.passed && !/pure sync/u.test(r.out) && r.security),
  "  a file outside both, a copy at a path the manifest does not name, or no manifest, does not", [outside, unnamed, noManifest].map(show).join("\n"));

// ---- the merge filter (P7), and a default branch whose core lacks clean-merges.mjs (R7) ----
const fromMain = [{ sha: SEEN, parents: [{ sha: BASE }] }, { sha: HEAD, parents: [{ sha: SEEN }, { sha: MAIN }] }];
const merged = run({ commits: fromMain });
ok(merged.passed && /merges from main could not be proved|Merges from main that are/u.test(merged.out) && merged.security?.state === "pending",
  "the merge filter: a head that merges a commit from beyond the pull request takes the proof", show(merged));
const ownMerge = run({ commits: [{ sha: SEEN, parents: [{ sha: BASE }] }, { sha: OWN, parents: [{ sha: BASE }] }, { sha: HEAD, parents: [{ sha: SEEN }, { sha: OWN }] }] });
ok(ownMerge.passed && !/[Mm]erges from main/u.test(ownMerge.out) && ownMerge.security?.state === "pending", "  one that merges the pull request's own commit does not", show(ownMerge));
const older = run({ commits: fromMain, missing: ["scripts/clean-merges.mjs"] });
ok(older.passed && !/[Mm]erges from main/u.test(older.out) && older.security?.state === "success" && older.code?.state === "success",
  "  nor any, on a default branch whose core has no clean-merges.mjs: its scripts read the merge's parents alone, as before, and post both statuses", show(older));

// ---- the rights loop (W12) ----
const codeBy = (l) => member(l, `Code review: ${HEAD}\nNo blocking finding.\nNo other finding.`);
const many = Array.from({ length: 21 }, (_, i) => codeBy(`m${String(i + 1).padStart(2, "0")}`));
const crowd = run({ comments: [...many, member("someone", `Security review: ${HEAD}`, "OWNER"), member("zz", `Security review: ${HEAD}`)] });
const asked = crowd.gets.filter((g) => g.includes("/collaborators/")).map((g) => g.split("/")[4]);
ok(crowd.passed && asked.join() === ["zz", ...many.slice(0, 19).map((c) => c.user.login)].join(), "the rights loop: of more than twenty commenters it asks twenty, those who posted a security review first, never the owner", show(crowd));
const failing = run({ comments: [member("m1", `Security review: ${HEAD}\nNo blocking finding.\nNo other finding.`), member("m2", `Security review: ${HEAD}\nNo blocking finding.\nNo other finding.`)],
  data: { "collaborators/m1/permission$": { $fail: "HTTP 500: Server Error" }, "collaborators/m2/permission$": [] } });
ok(failing.passed && ["m1", "m2"].every((l) => failing.out.includes(`The host's rights of ${l} could not be read`)) && failing.security?.state === "pending",
  "  an answer that fails, or is no object, counts for no one, and the run says so", show(failing));

// ---- the inputs: root (E12), advisory (E10), reviewers (E13) ----
const atRoot = run({ data: history }), inCore = run({ inputs: { advisory: false }, data: { [`commits\\?path=core`]: [] } });
ok(atRoot.nodeFile === "./.node-version" && atRoot.gets.some((g) => g.includes(`contents/scripts/security-review.mjs?ref=${HEAD}`))
  && inCore.nodeFile === "core/.node-version" && inCore.gets.some((g) => g.includes(`contents/core/scripts/security-review.mjs?ref=${HEAD}`)) && inCore.security?.state === "pending",
  "root: `.` reads the scripts and their paths at the root, the default `core` under core/", show(atRoot) + show(inCore));
const advising = run({ inputs: { root: "." } });
ok(advising.passed && advising.security?.state === "success" && /^Advisory: /u.test(advising.security.description) && advising.code?.state === "success",
  "advisory, left out: the statuses pass, saying what the check would have done", show(advising));
const byReviewer = [member("a-reviewer", `Security review: ${HEAD}\nNo blocking finding.\nNo other finding.`, "COLLABORATOR")];
const unnamedReviewer = run({ comments: byReviewer, data: right("a-reviewer", "read") });
const namedReviewer = run({ comments: byReviewer, data: right("a-reviewer", "read"), inputs: { advisory: false, root: ".", reviewers: "someone-else a-reviewer" } });
ok(unnamedReviewer.security?.state === "pending" && namedReviewer.passed && namedReviewer.security?.state === "success",
  "reviewers: a reader's posted review counts only where the input names the account", show(unnamedReviewer) + show(namedReviewer));

// ---- a default branch whose core lacks the check's scripts (R7) ----
const none = run({ missing: ["scripts/security-review.mjs"] });
ok(none.ran && none.passed && none.out.includes("does not hold the check's script yet") && none.posts === 0 && none.gets.length === 0, "a default branch with no security-review.mjs: nothing read or posted, and the job passes", show(none));
const noWait = run({ missing: ["scripts/code-review-wait.mjs"] });
ok(noWait.passed && noWait.security && !noWait.code && noWait.posts === 1, "  with no code-review-wait.mjs, the security-review status alone", show(noWait));

// ---- the code-review status's verdict folded into the security-review status (#1339) ----
// (a later commit than Codex's reviews, whose security review is posted for the head, declaring no count, so that it
// checks no fix the code review would stand across, and whose code review is still to be posted)
const securityPosted = member("someone", `Security review: ${HEAD}`, "OWNER");
const unreviewed = run({ comments: [securityPosted] }), posted = run({ comments: [securityPosted, member("someone", `Code review: ${HEAD}\nNo blocking finding.\nNo other finding.`, "OWNER")] });
ok(unreviewed.passed && unreviewed.code?.state === "pending" && unreviewed.security?.state === "pending" && unreviewed.security.description.startsWith("Waiting: code-review waits: no code review.")
  && posted.passed && posted.code?.state === "success" && posted.security?.state === "success",
  "while the code-review status waits for a code review the pull request needs, the security-review status, which a ruleset requires, waits too; once one is posted, both pass", show(unreviewed) + show(posted));
const advisedWait = run({ comments: [securityPosted], inputs: { root: "." } });
ok(advisedWait.passed && advisedWait.security?.state === "success" && advisedWait.security.description.startsWith("Advisory: code-review waits"), "  advisory, it says so and passes", show(advisedWait));
const brokenWait = run({ broken: ["scripts/code-review-wait.mjs"], reviewed: HEAD });
ok(brokenWait.passed && !brokenWait.code && brokenWait.security?.state === "pending" && /code-review not worked out\. Mend: /u.test(brokenWait.security.description) && brokenWait.out.includes("could not be worked out"),
  "  where code-review-wait.mjs fails, the security-review status waits, never a pass, the code-review status is not posted, and the run warns", show(brokenWait));

// ---- each pull_request action the callers list (E1) ----
// (the template's placeholders filled, as the starter kit fills them)
const typesOf = (file) => parseYaml(fs.readFileSync(path.join(root, file), "utf8").replace(/\{\{\w+\}\}/gu, "x")).on.pull_request.types;
const types = typesOf("setup/template/workflows/security-review.yml.tmpl");
ok(types.join() === typesOf(".github/workflows/own-security-review.yml").join(), "the project's caller and the core's own list the same pull_request actions", types.join());
const byAction = types.map((action) => [action, run({ action, reviewed: HEAD })]);
ok(byAction.every(([, r]) => r.ran && r.passed && r.security?.state === "success" && r.code), `each action (${types.join(", ")}) runs the job, which posts both statuses`, byAction.map(([a, r]) => `${a}: ${show(r)}`).join("\n"));

// ---- the rights' time spent (W12), from the run beside ----
const code = await spentExit;
let spent = null;
try { spent = JSON.parse(spentOut.trim().split("\n").at(-1)); } catch { /* (read as a failure below) */ }
const spentAsked = spent?.gets.filter((g) => g.includes("/collaborators/")).length;
ok(code === 0 && spent?.passed && /The time for reading the host's rights is spent: a review of m\d and those after/u.test(spent.out) && spentAsked < 5 && spent.security?.state === "pending",
  "  and where the host's answers are slow, it stops at the loop's 30 seconds, says so, and still posts the status", spentOut.slice(-1600));

done("the security-review workflow's shell");
