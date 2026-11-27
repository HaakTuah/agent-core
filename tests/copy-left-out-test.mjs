// Holds README.md's list "What a project's checks leave out for the core's copy" (#661, point 2) to what the checks do.
// It takes the checks from the source, as #593's point 1 asks: every script of the core's that a workflow the starter
// kit calls runs, and every script scripts/checks.mjs's parts run, each a row of the list or named below with why it is
// no check of the copy; so a check added later must join the list. Then, for each row, it stages the row's fault
// inside the copy (core/) and the same fault outside it, and reads whether the check reports each: a row "left out" or
// "left out in part" holds only where the outside one is reported and the inside one is not (for "in part", the fault
// is of the part the row says is left out), and a row "read" only where both are. Three rows have no pair, each named
// below with its reason and the test that holds it. Each check is run the cheapest faithful way: through the function
// that decides what it reads, where the script exports one, else as its workflow runs it, in a scratch project whose
// copy holds the core's scripts as they stand here; the personal-terms workflow through workflow-run.mjs, on Linux
// alone. Never scripts/check.mjs, whose check of the copy (core.yml) would stop at the fault inside it. Every name and
// term is invented. Git, bash and Node's own modules.
//
//   node tests/copy-left-out-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HOST_OWN } from "../scripts/check.mjs";
import { judge as codeReview } from "../scripts/code-review-wait.mjs";
import { CODEX, judge as securityReview } from "../scripts/security-review.mjs";
import { verdict as entryFiles } from "../scripts/entry-files.mjs";
import { run as licenceScan, write as licenceWrite } from "../scripts/licence-scan-stage.mjs";
import { targets as scanTargets } from "../scripts/code-scan.mjs";
import { check as nuget } from "../scripts/nuget.mjs";
import { calledByPaths, library, ownOf } from "../scripts/reading.mjs";
import { ARCHIVE_SERVER, archivesMissing, root, scratchDir, tally } from "../scripts/scratch-core.mjs";
import { reads as workflowsRead } from "../scripts/workflows.mjs";
import { runWorkflow } from "../scripts/workflow-run.mjs";

const { ok, done } = tally();
{ const missing = archivesMissing(); ok(missing === null, "with the network cut off, the archive of Betterleaks the run's set-up fetched stands in CORE_ARCHIVES", missing ?? ""); }
// (each assertion says, where it fails, what is wrong and then its mend)
const held = (cond, what, wrong, mend, detail = "") => ok(cond, cond ? what : `${wrong}. Mend: ${mend}`, detail);
const LIST = "What a project's checks leave out for the core's copy";
const HERE = "tests/copy-left-out-test.mjs";

// ---- The list, as README.md holds it: each row's check and what it does with the copy ----
const STATUSES = ["read", "left out", "left out in part"];
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8").replace(/\r\n/g, "\n");
const section = new RegExp(`^## ${LIST}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu").exec(readme)?.[1] ?? "";
const rows = new Map();
for (const line of section.split("\n").filter(l => /^\|\s*`/u.test(l))) {
  const [, check, status] = /^\|\s*`([^`]+)`\s*\|\s*([^|]*?)\s*\|/u.exec(line) ?? [];
  held(STATUSES.includes(status) && !rows.has(check), `the list's row ${check} says ${status}`, `README.md's list "${LIST}" has a row it cannot read, or a check twice: ${line.slice(0, 120)}`,
    `write the row as | \`<check>\` | ${STATUSES.join(" or ")} | why |, one row for each check`);
  rows.set(check, status);
}
held(rows.size > 0, "README.md holds the list", `README.md has no section "${LIST}" with rows`, `put the list back under that heading, one row for each check a project's pull requests run, as #661 asks`);
for (const check of rows.keys()) {
  const file = check.split(" ")[0];
  held([`scripts/${file}`, `.github/workflows/${file}`].some(f => fs.existsSync(path.join(root, f))), `${check} is a script or a workflow of the core's`,
    `the list's row ${check} names no script under scripts/ and no workflow under .github/workflows/`, "name the check by its file as it now stands, or take out the row of a check that is gone");
}

// ---- The checks, from the source ----
// (each workflow of the core's the starter kit calls, and each script it runs; then each script checks.mjs's parts
// run; a line that is a comment names none)
const live = (text, comment) => text.replace(/\r\n/g, "\n").split("\n").filter(l => !comment.test(l)).join("\n");
const kit = path.join(root, "setup/template/workflows");
const workflows = new Set(fs.readdirSync(kit).flatMap(f => [...fs.readFileSync(path.join(kit, f), "utf8").matchAll(/\/\.github\/workflows\/([\w.-]+\.ya?ml)@/gu)].map(m => m[1])));
const scripts = new Map();
for (const w of workflows) for (const [, s] of live(fs.readFileSync(path.join(root, ".github/workflows", w), "utf8"), /^\s*#/u).matchAll(/scripts\/([\w.-]+\.(?:mjs|sh))\b/gu)) if (!scripts.has(s)) scripts.set(s, w);
for (const [, s] of live(fs.readFileSync(path.join(root, "scripts/checks.mjs"), "utf8"), /^\s*(?:\/\/|import\b)/u).matchAll(/(?:["'`]|scripts\/)([\w-]+\.(?:mjs|sh))\b/gu)) if (!scripts.has(s)) scripts.set(s, "scripts/checks.mjs");
held(workflows.has("core.yml") && scripts.has("copies.mjs") && scripts.has("pr-description.mjs"), "the starter kit's calls, their workflows' scripts and checks.mjs's parts are read",
  "the test finds no call to core.yml in the starter kit's workflows, or no script of checks.mjs's parts", `read again how ${HERE} takes the checks from the source, and mend it to the form the files now take`);

// What is no check of the copy, each with why: a script or a workflow found above that is no row of the list.
const NOT_CHECKS = {
  "lychee.sh": "it fetches the pointer check's link checker and reads no file of the tree; the check is the row pointers.mjs",
  "workflow-tools.sh": "it fetches the workflow check's two tools and reads no file of the tree; the check is the row workflows.mjs",
  "checks.mjs": "it runs its parts' checks, each a row or named here; its own look before it installs is the row `checks.mjs signatures`",
  "manifest-reads.mjs": "it reports and never fails, and reads the copy only as the source of the modules and slots",
  "licences.mjs": "it reads the lock files and audit entries the project's config names, their exact versions and their new packages among them (#1093); its scan of the tree is the row licence-scan.mjs",
  "lookup.mjs": "it asks the registry of the packages new to the lock files the config names, or to the NuGet lock files the row nuget.mjs reads",
  "licence-installed.mjs": "it reads the installed packages' own files, in the folder the signature check installs into",
  "nuget-look.sh": "the NuGet check's first look, a part of the row nuget.mjs, which leaves the copy out as that row does",
  "nuget-fetch.mjs": "the NuGet check's fetch, a part of the row nuget.mjs, from the lock files that row reads",
  "clean-merges.mjs": "it reads the pull request's merge commits, never a file of the tree",
  "power.mjs": "it reads which of the pull request's own commits touch what runs with power, the copy left out, and fails no pull request: where it reads none, each review is asked of the head as before, and each script or workflow changed asks floor rule 3's two",
  "queue-only.yml": "it runs queue-only.mjs, which fails no pull request: one it does not prove is reviewed as any other",
  "queue-only.mjs": "it reads the pull request's patch, its issues and the default branch's progress file, never the copy, and fails no pull request: one it does not prove is reviewed as any other",
  "core-moved.mjs": "it runs on the daily schedule (look.yml) and fails no pull request",
  "look.mjs": "it runs on the daily schedule (look.yml) and fails no pull request",
  "issue-terms.mjs": "it runs on the daily schedule (look.yml), reads issues and comments, never a file of the tree, and fails no pull request",
  "install.mjs": "it installs the core's packages from the copy's own lock files for the checks after it, and judges no file",
  "sync.mjs": "core.yml names it in a failure's mend; no check runs it",
  "copies.yml": "its one step runs checks.mjs copies, whose scripts are rows",
  "pr-description.yml": "its one step runs checks.mjs description, whose script is the row pr-description.mjs",
  "signatures.yml": "its one step runs checks.mjs signatures, the row `checks.mjs signatures`",
  "nuget.yml": "its one step runs checks.mjs nuget, whose scripts are the row nuget.mjs and named here",
  "licences.yml": "its steps run licences.mjs, which runs exact-versions.mjs and npm's lookup itself (#1093), and agent-tools.mjs, each a row or named here",
  "security-review.yml": "its steps run security-review.mjs, pure-sync.mjs, clean-merges.mjs, power.mjs and code-review-wait.mjs, each a row or named here",
  "delete-merged-branches.yml": "it deletes merged branches on the host and checks nothing",
  "look.yml": "it runs on the daily schedule and fails no pull request",
  "preview.yml": "it runs once a game's build has run, publishes its preview to gh-pages and fails no pull request",
  "site-publish.sh": "preview.yml runs it to publish a game's built site, and it judges no file of the tree",
  "versions.yml": "it runs on the monthly schedule and fails no pull request",
  "versions.mjs": "it runs on the monthly schedule (versions.yml), reads the versions its config names, and fails no pull request",
};
for (const [name, from] of [...[...workflows].map(w => [w, "the starter kit"]), ...scripts]) {
  held(rows.has(name) || Object.hasOwn(NOT_CHECKS, name), `${name} (run from ${from}) is a row of the list or named as no check of the copy`,
    `${name}, which ${from} runs, is no row of README.md's list "${LIST}" and is not named as no check of the copy`,
    `add a row for it to that list (read, left out or left out in part, and why), with its pair in ${HERE}; or, where it reads no file of the tree or fails no pull request, add it to NOT_CHECKS in ${HERE} with its reason`);
}
for (const name of Object.keys(NOT_CHECKS)) {
  held(workflows.has(name) || scripts.has(name), `${name}, named as no check of the copy, is still run`, `NOT_CHECKS in ${HERE} names ${name}, which neither the starter kit's workflows nor checks.mjs's parts run any more`,
    `take it out of NOT_CHECKS`);
  held(!rows.has(name), `${name} is named once`, `${name} is both a row of the list and in NOT_CHECKS in ${HERE}`, "keep it in one place: the row where it is a check of the copy, else NOT_CHECKS");
}

// ---- The rows with no pair, each with why and what holds it ----
const NO_PAIR = {
  "core.yml": ["it is the copy's proof: the fault inside the copy is what it fails, so there is no copy for it to leave out", "tests/core-yml-test.mjs"],
  "pure-sync.mjs": ["it judges the shape of a pull request's diff (only the copy, its pins and what the kit renders moved), not a fault in a file", "tests/pure-sync-test.mjs"],
  "converge.mjs": ["it reads only the project's own files and parts the core marks, never a file of the copy, so there is no fault inside the copy for it to leave out; the fault outside is staged there", "tests/converge-test.mjs"],
  "codeql.yml": ["code scanning is the host's own and cannot run here; scripts/check.mjs names it so (HOST_OWN)", "tests/check-test.mjs"],
};
held(Boolean(HOST_OWN["codeql.yml"]), "codeql.yml is named the host's own", "scripts/check.mjs no longer names codeql.yml among the host's own (HOST_OWN), so its row's lack of a pair has no reason",
  `stage its pair in ${HERE}, now that it can run here`);

// ---- The pairs: whether the check reports the fault inside the copy, and the same fault outside it ----
const tmp = scratchDir("copy-left-out-test-");
// (no sign-in reaches a staged check: any variable named as a token, secret, password, credential, key or npm's auth
// is left out)
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(GIT_|GITHUB_|RUNNER_|ACTIONS_|CI$|PR_|BASE_SHA$|CALLER$|CORE_AT$)|_BASE$|TOKEN|SECRET|PASSWORD|CREDENTIAL|_KEY$|_AUTH|^NPM_CONFIG_.*AUTH/iu.test(name)));
// (an invented account's no-reply address, its id 0, which GitHub gives no account; the personal-terms workflow's
// pair passes it: #460, point 2)
const address = `0+t@${["users", "noreply", "github", "com"].join(".")}`;
Object.assign(env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: address, GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: address,
  GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.autocrlf", GIT_CONFIG_VALUE_0: "false" });
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const put = (dir, files) => { for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); } };
const commit = (dir, what) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", what); return git(dir, "rev-parse", "HEAD"); };
let n = 0;
// A project whose copy of the core holds the core's scripts as they stand here (and what they read beside them), its
// base `files` committed on main; `change(fault)` commits the fault on it, and `back()` returns to the base.
function project(files) {
  const dir = path.join(tmp, `p${++n}`);
  fs.cpSync(path.join(root, "scripts"), path.join(dir, "core/scripts"), { recursive: true });
  // (the core's packages beside the copy as install.mjs puts them: its lists copied, what they installed linked, never
  // copied, since git leaves a link's target unread)
  for (const at of [".packages", ".packages/parser"]) {
    for (const f of ["package.json", "package-lock.json"]) fs.cpSync(path.join(root, at, f), path.join(dir, "core", at, f));
    if (fs.existsSync(path.join(root, at, "node_modules"))) fs.symlinkSync(path.join(root, at, "node_modules"), path.join(dir, "core", at, "node_modules"), "junction");
  }
  put(dir, { "core/setup/template/shape.json.tmpl": fs.readFileSync(path.join(root, "setup/template/shape.json.tmpl"), "utf8"), "README.md": "# A project\n", ...files });
  git(dir, "init", "-q", "-b", "main");
  const base = commit(dir, "base");
  return { dir, base, change: fault => { put(dir, fault); commit(dir, "the fault"); }, back: () => { git(dir, "reset", "-q", "--hard", base); git(dir, "clean", "-qfdx"); } };
}
// The core's script run in the project as its workflow runs it, from the copy: whether it failed, and what it said.
const node = (dir, script, args = [], extra = {}) => { const r = spawnSync(process.execPath, [`core/scripts/${script}`, ...args], { cwd: dir, env: { ...env, ...extra }, encoding: "utf8" }); return { failed: r.status !== 0, out: `${r.stdout}${r.stderr}` }; };
// A pair run in one project: the fault inside, then outside, each from the base. [inside reported, outside reported, what each said]
const inProject = (files, inside, outside, reported) => {
  const p = project(files);
  p.change(inside);
  const a = reported(p);
  p.back();
  p.change(outside);
  const b = reported(p);
  return [a.failed, b.failed, `inside: ${a.out}\noutside: ${b.out}`];
};

const BLOCK = `${Array.from({ length: 10 }, (_, i) => `const line${i} = measure(${i}, "words enough to make this run of code count as a copy");`).join("\n")}\n`;
const LONG = `export function long(x) {\n${Array.from({ length: 70 }, (_, i) => `  x = x + ${i};`).join("\n")}\n  return x;\n}\n`;
const PULL = { state: "open", draft: false, head: { sha: "a".repeat(40) }, base: { repo: { owner: { login: "someone" } } } };
const reviewed = { user: { login: CODEX, type: "Bot" }, author_association: "NONE", updated_at: "2026-11-12T10:00:00Z",
  body: `<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ${JSON.stringify({ code_review: { commit_sha: null, status: null }, security_review: { commit_sha: "b".repeat(40), has_any_findings: null, has_unresolved_findings: null, status: "completed" } })} -->\n<details>the table</details>` };
const changed = name => [{ filename: name, status: "modified", patch: "@@ -1,3 +1,3 @@\n jobs:\n-      - run: a\n+      - run: b" }];
const line = [{ sha: "d".repeat(40), parents: [{ sha: "8".repeat(40) }] }, { sha: "a".repeat(40), parents: [{ sha: "d".repeat(40) }] }];
const sizes = read => JSON.stringify({ each: 20000, read, total: 400, split: 2000 });
const agents = "# A project\n\nIts rules: `SECURITY.md`, rule 3, and \"Running it\" in `docs/developing.md`.\n";
const pointing = { "AGENTS.md": agents, "SECURITY.md": "# Security\n\n**3. The protected files,** here, **the rule files:** `docs/developing.md`;\n", "docs/developing.md": "# Developing\n\n## Running it\n\nAs `AGENTS.md` says.\n" };
const broken = agents.replace("Running it", "Shipping it");
const tools = { ".claude/settings.json": fs.readFileSync(path.join(root, "setup/template/claude-settings.json.tmpl"), "utf8"), "checks/licences.json": JSON.stringify({ lockfiles: [], agentTools: [] }) };
const ownHook = JSON.stringify({ hooks: { ...JSON.parse(tools[".claude/settings.json"]).hooks, PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "true" }] }] } });

// Each row's pair: () => [inside reported, outside reported, details], with how it is staged.
const PAIRS = {
  "security-review.mjs": ["in-process, judge(): a changed workflow step asks floor rule 3's second security review", () => {
    const asks = name => securityReview({ ...PULL, changed_files: 1 }, [reviewed], [], undefined, changed(name), true)?.done === false;
    return [asks("core/.github/workflows/x.yml"), asks(".github/workflows/x.yml"), ""];
  }],
  "code-review-wait.mjs": ["in-process, judge(): a changed script waits for a code review", () => {
    const waits = name => codeReview({ ...PULL, commits: 2, changed_files: 1 }, [], line, changed(name), [], true, undefined, "core/")?.done === false;
    return [waits("core/scripts/x.mjs"), waits("scripts/x.mjs"), ""];
  }],
  "licence-scan.mjs": ["licence-scan-stage.mjs's project, scanned: a file that carries a licence notice", () => {
    // (a licence notice, built from pieces as the test runs, so this file holds none for the core's own scan to read)
    const NOTICE = `/${"*"}! moss v1 */\n`;
    const found = f => licenceScan(dir => { licenceWrite("core-manifest.md", "# Core manifest\n")(dir); licenceWrite(f, NOTICE)(dir); });
    const [a, b] = [found("core/scripts/moss.min.js"), found("scripts/moss.min.js")];
    return [a.length > 0, b.length > 0, `inside: ${a.join("; ")}\noutside: ${b.join("; ")}`];
  }],
  "agent-tools.mjs": ["the script, as licences.yml runs it: a hook beside the kit's, not listed", () =>
    inProject(tools, { "core/.claude/settings.json": ownHook }, { ".claude/settings.json": ownHook }, ({ dir }) => {
      const r = spawnSync(process.execPath, [path.join(root, "scripts/agent-tools.mjs"), "checks/licences.json"], { cwd: dir, env, encoding: "utf8" });
      return { failed: r.status !== 0, out: `${r.stdout}${r.stderr}` };
    })],
  "copies.mjs": ["the script, from the copy, against the pull request's base: a file its config reads moved where the config reads it no more, in the copy and in the project", () => {
    const config = JSON.stringify({ baseline: "checks/code-baseline.json", code: ["a/*.js", "core/a/*.js"], prose: [], proseFromSecurity: false });
    const p = project({ "checks/code.json": config, "checks/code-baseline.json": JSON.stringify({ windows: {} }), "a/one.js": LONG, "core/a/one.js": LONG });
    const moved = (from, to) => { git(p.dir, "mv", from, to); commit(p.dir, "the move"); return node(p.dir, "copies.mjs", ["checks/code.json"], { COPIES_BASE: p.base }); };
    const a = moved("core/a/one.js", "core/one.js");
    p.back();
    const b = moved("a/one.js", "one.js");
    return [a.failed, b.failed, `inside: ${a.out}\noutside: ${b.out}`];
  }],
  "code-scan.mjs": ["in-process, targets(): a file of code the change adds, handed to the engine", () =>
    inProject({}, { "core/scripts/added.mjs": "export const x = 1;\n" }, { "scripts/added.mjs": "export const x = 1;\n" }, ({ dir, base }) => {
      const handed = scanTargets(dir, base);
      return { failed: handed.length > 0, out: handed.join(", ") };
    })],
  "pointers.mjs": ["the script, from the copy: a pointer to a heading that is not there", () =>
    inProject(pointing, { "core/AGENTS.md": broken }, { "AGENTS.md": broken }, ({ dir }) => node(dir, "pointers.mjs", [], { POINTERS_BASE: "" }))],
  "reading-size.mjs": ["the script, from the copy: a file past the split mark changed, asked, and a file under \"read\" past the total", () => {
    const big = "x".repeat(3000) + "\n";
    const split = inProject({ "checks/sizes.json": sizes({ "AGENTS.md": 20000 }), "AGENTS.md": "# A\n", "core/big.md": big, "src/big.md": big },
      { "core/big.md": `${big}more\n` }, { "src/big.md": `${big}more\n` }, ({ dir, base }) => {
        // (a changed file past the split mark is asked, failing nothing: #1413, point 6)
        const r = node(dir, "reading-size.mjs", ["checks/sizes.json"], { SIZES_BASE: base });
        return { failed: r.failed || /big\.md is \d+ bytes, past the \d+-byte mark, and this PR changes it, which fails nothing/.test(r.out), out: r.out };
      });
    const total = inProject({ "AGENTS.md": "# A\n", "core/rules.md": "x".repeat(600), "docs/rules.md": "x".repeat(600) },
      { "checks/sizes.json": sizes({ "AGENTS.md": 20000, "core/rules.md": 20000 }) }, { "checks/sizes.json": sizes({ "AGENTS.md": 20000, "docs/rules.md": 20000 }) },
      ({ dir, base }) => node(dir, "reading-size.mjs", ["checks/sizes.json"], { SIZES_BASE: base }));
    return [split[0] || total[0], split[1] && total[1], `the split mark: ${split[2]}\nthe total: ${total[2]}`];
  }],
  "workflows.mjs": ["in-process, reads(): the files it reads, of an action.yml in the copy and in the project", () =>
    [workflowsRead(["core/x/action.yml", "core/.github/workflows/x.yml"]).length > 0, workflowsRead(["x/action.yml"]).length > 0, ""]],
  "entry-files.mjs": ["in-process, verdict(): CLAUDE.md that pulls in less than AGENTS.md names", () => {
    const fails = files => entryFiles(f => files[f] ?? null).fails;
    const whole = { "AGENTS.md": "# A\n\n@floor.md\n", "CLAUDE.md": "@AGENTS.md\n" };
    const [a, b] = [fails({ ...whole, "core/AGENTS.md": "# A\n\n@floor.md\n", "core/CLAUDE.md": "# Nothing pulled in\n" }), fails({ ...whole, "CLAUDE.md": "# Nothing pulled in\n" })];
    return [a.length > 0, b.length > 0, `inside: ${a.join("; ")}\noutside: ${b.join("; ")}`];
  }],
  "shape.mjs": ["the script, from the copy, with no config of the project's (the starter kit's): a function past the line mark", () =>
    inProject({ "src/a.js": "export const a = 1;\n" }, { "core/x/long.js": LONG }, { "src/long.js": LONG }, ({ dir, base }) => node(dir, "shape.mjs", [], { SHAPE_BASE: base }))],
  "choices.mjs": ["the script, from the copy: a choice record added and argued on no line", () => {
    const record = "# Choices\n\n## Choice: a store of saved games\n\nReopens it: never.\n";
    return inProject({}, { "core/CHOICES.md": record }, { "docs/choices.md": record }, ({ dir, base }) => node(dir, "choices.mjs", [], { CHOICES_BASE: base }));
  }],
  "pr-description.mjs": ["in-process, calledByPaths() of ownOf(): what a changed workflow calls for on the line \"Read for it:\"", () => {
    const lib = library(root, "");
    const calls = p => calledByPaths(lib, ownOf([p], "core/")).length > 0;
    return [calls("core/.github/workflows/x.yml"), calls(".github/workflows/x.yml"), ""];
  }],
  "checks.mjs signatures": ["the script, from the copy: the copy's own package list changed in its .packages/, and a package list of the project's", () =>
    inProject({}, { "core/.packages/package.json": "{}\n" }, { "a/package.json": "{}\n" },
      // (the install, where the look asks one, is given a folder that is not there, so nothing is installed)
      ({ dir, base }) => { const r = node(dir, "checks.mjs", ["signatures", "--signatures", "no-such-folder"], { BASE_SHA: base }); return { failed: /^== Install/mu.test(r.out), out: r.out }; })],
  "nuget.mjs": ["in-process, check(): a project file with no lock file", () => {
    const packages = path.join(tmp, "nuget-packages"), at = path.join(tmp, "nuget-project");
    fs.mkdirSync(packages, { recursive: true });
    const failures = f => { put(at, { [f]: "<Project Sdk=\"Microsoft.NET.Sdk\" />\n" }); return nuget({ ships: [], nuget: {} }, at, packages, [f]).failures; };
    const [a, b] = [failures("core/x/App.csproj"), failures("x/App.csproj")];
    return [a.length > 0, b.length > 0, `inside: ${a.join("; ")}\noutside: ${b.join("; ")}`];
  }],
};

// The personal-terms workflow, run as GitHub runs it on a pull request merged into its base (Linux alone: its own job
// runs on GitHub's Linux runners, and its test holds it on Windows).
if (process.platform === "win32") console.log("note the pair of personal-terms.yml runs on Linux alone, where its own job runs: not run here");
else PAIRS["personal-terms.yml"] = ["the workflow, through workflow-run.mjs: a term in a file of the pull request", () => {
  const term = ["qz", "vk", "wy"].join(""), stubs = path.join(tmp, "stubs");
  fs.mkdirSync(stubs, { recursive: true });
  // (a fetch the stand-in serves from the folder CORE_ARCHIVES names, Betterleaks' release, and fails any other)
  fs.writeFileSync(path.join(stubs, "curl"), `#!/bin/sh\n${ARCHIVE_SERVER}exit 22\n`, { mode: 0o755 });
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/personal-terms.yml"), "utf8");
  const run = (f, words = `a line with ${term} in it\n`) => {
    const dir = path.join(tmp, `terms-${++n}`);
    fs.mkdirSync(dir);
    git(dir, "init", "-q", "-b", "main");
    put(dir, { "README.md": "# A project\n" });
    const tip = commit(dir, "first");
    git(dir, "checkout", "-q", "-b", "change");
    put(dir, { [f]: words });
    commit(dir, "a change");
    git(dir, "checkout", "-q", "--detach", "main");
    execFileSync("git", ["merge", "-q", "--no-ff", "--no-edit", "change"], { cwd: dir, env: { ...env, GIT_COMMITTER_NAME: "GitHub", GIT_COMMITTER_EMAIL: "noreply@github.com" }, stdio: "ignore" });
    const github = { event_name: "pull_request", repository: "someone/project", ref: "refs/pull/1/merge", event: { pull_request: { title: "A change", body: "Words.", head: { ref: "change" }, base: { sha: tip } }, repository: { private: false } } };
    const [job] = runWorkflow(workflow, { github, secrets: { PERSONAL_TERMS: `${term}\n` }, base: { ...env, PATH: `${stubs}${path.delimiter}${env.PATH ?? ""}` }, workspace: () => dir, uses: { "actions/checkout": () => {} }, temp: tmp });
    return { failed: !job.passed, out: job.steps.map(s => s.out).join("") };
  };
  // (the same pull request with no term passes, so a failure below is the term's)
  const clean = run("notes.md", "plain words\n");
  if (clean.failed) return [null, null, `with no term: ${clean.out.slice(-400)}`];
  const [a, b] = [run("core/notes.md"), run("notes.md")];
  return [a.failed, b.failed, `inside: ${a.out.slice(-400)}\noutside: ${b.out.slice(-400)}`];
}];

for (const [check, status] of rows) {
  if (NO_PAIR[check]) {
    const [why, test] = NO_PAIR[check];
    held(fs.existsSync(path.join(root, test)), `${check} has no pair: ${why} (held by ${test})`, `${check}'s row has no pair, and the test named as what holds it, ${test}, is not there`,
      `name in NO_PAIR of ${HERE} the test that now holds ${check}`);
    continue;
  }
  if (!PAIRS[check]) {
    if (check === "personal-terms.yml" && process.platform === "win32") continue;
    held(false, "", `the list's row ${check} has no pair in ${HERE} and is not among those with no pair`,
      `add to PAIRS in ${HERE} its fault staged inside the copy and the same fault outside it, or, where none can be staged, add it to NO_PAIR with why and the test that holds it`);
    continue;
  }
  const [how, pair] = PAIRS[check];
  let inside, outside, detail;
  try { [inside, outside, detail] = pair(); } catch (e) { [inside, outside, detail] = [null, null, `threw: ${e.stack}`]; }
  const want = status === "read" ? [true, true] : [false, true];
  const did = inside === null ? "could not be staged" : `reports the fault ${inside && outside ? "both inside the copy and outside it" : inside ? "inside the copy alone" : outside ? "outside the copy alone" : "neither inside the copy nor outside it"}`;
  held(inside === want[0] && outside === want[1], `${check} (${status}): ${how}`,
    `${check} ${did}, where README.md's list says ${status}`,
    `where the check changed, change its row of the list to what it does (read, left out or left out in part) and why; where the pair no longer stages the fault, mend its pair in ${HERE}`, detail);
}
for (const check of Object.keys(PAIRS)) held(rows.has(check), `${check}'s pair is a row's`, `${HERE} stages a pair for ${check}, which is no row of README.md's list`, "add its row to the list, or take out the pair of a check that is gone");
for (const check of Object.keys(NO_PAIR)) held(rows.has(check), `${check}, named with no pair, is a row`, `NO_PAIR in ${HERE} names ${check}, which is no row of README.md's list`, "take it out of NO_PAIR, or add its row to the list");

done("what a project's checks leave out for the core's copy");
