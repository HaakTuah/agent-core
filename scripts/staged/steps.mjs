// A staged case (staged.mjs): the steps of a release that no check reads (AGENTS.md, "A release says what it asks,
// step by step"; scripts/steps.mjs, the steps marked "unread"). A project, private, has just merged a sync of its copy
// from a commit before the sync notes, whose pull request #1 holds what the sync printed: every entry, and the steps and
// differences the core's scripts found. Each step no check reads is planted not done, where its state lies in the
// project's files or in GitHub's answer, with one outcome a script reads exactly; the session is asked to take what the
// sync asks. Passed where every planted step is done on some pushed branch, or on GitHub. The steps it cannot plant
// stand in UNPLANTED, each with why; steps-test.mjs holds that every unread step is one or the other.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "../core-address.mjs";
import { LABELS, build, git, github, originGit, pushed, show, verdict } from "./scratch.mjs";

export const name = "steps";
export const holds = ["AGENTS.md: A release says what it asks, step by step"];
export const inPart = ["AGENTS.md: A release says what it asks, step by step"];
export const task = "The sync of the core's copy, pull request #1 of the project's repository on GitHub, has just merged. Take what it asks of the project.";

// The project's own rules that the core's parts now say, or that replace a module's, each planted as a line.
const RULES = {
  handed: "- Codex's review is asked by a comment `@codex please review` on the pull request.",
  security: "- Every PR gets a security review before it merges.",
  replaces: "- Push once, when the task is done, rather than after each commit.",
  reviewers: "- A review's finding blocks where Codex marks it P1, and not otherwise.",
};
const DIFFERENCE = "- A feature whose users do not yet come out ahead may wait for a later stage.";
const ROW = "| *code reviewers* | Codex, then Copilot, then the fallback reviewer |";
const FILE = "docs/trial/GEMINI.md";
const anyBranch = (dir, test) => pushed(dir).some(b => test(b));
const lacks = (dir, file, line) => anyBranch(dir, b => !(show(dir, b, file) ?? line).includes(line));
const listed = (dir, b, folder) => String(originGit(dir, "ls-tree", "--name-only", "--end-of-options", `${b}:${folder}`) ?? "").split("\n").filter(Boolean);
const workflows = (dir, b) => listed(dir, b, ".github/workflows");

// Whether a workflow's call passes `private: true`, or turns advisory off (`advisory: false`), as the step allows: a
// line of it under a `with:` line, indented deeper, read line by line.
const withPrivate = text => {
  let under = -1;
  for (const line of String(text).split("\n")) {
    const indent = line.length - line.trimStart().length;
    if (line.trim() === "with:") { under = indent; continue; }
    if (under >= 0 && line.trim() && indent <= under) under = -1;
    if (under >= 0 && /^(?:private:\s*true|advisory:\s*false)\b/.test(line.trim())) return true;
  }
  return false;
};

// Each planted step: its lead in the sync notes, and whether the session did it.
export const PLANTED = {
  "12 November 2026, who reviews": dir => lacks(dir, "AGENTS.md", RULES.reviewers),
  "12 November 2026, the core has moved": dir => anyBranch(dir, b => workflows(dir, b).includes("look.yml")),
  "12 November 2026, differences": dir => lacks(dir, "AGENTS.md", RULES.replaces),
  "12 November 2026, a sync and the project's own suites": dir => anyBranch(dir, b => { const t = show(dir, b, ".github/workflows/tests.yml") ?? ""; return /paths:/.test(t) && !/core\/\*\*/.test(t); }),
  "12 November 2026, the way work is handed over": dir => lacks(dir, "AGENTS.md", RULES.handed),
  "12 November 2026, a feature may wait for a later stage": dir => lacks(dir, "core-manifest.md", DIFFERENCE),
  "13 November 2026, a security review where the change needs one": dir => lacks(dir, "AGENTS.md", RULES.security),
  "13 November 2026, every file a tool takes its instructions from": dir => anyBranch(dir, b => { const t = show(dir, b, FILE); return t === null || (!/French/.test(t) && /AGENTS\.md/.test(t)); }),
  "13 November 2026, the modules a project takes": dir => anyBranch(dir, b => /^Floor: .*Modules: (?:all\b|.*`copilot\.md`)/m.test(show(dir, b, "core-manifest.md") ?? "")),
  "13 November 2026, what a project follows": dir => anyBranch(dir, b => /^\|\s*\*follows\*\s*\|\s*`main`\s*\|/m.test(show(dir, b, "core-manifest.md") ?? "")),
  "13 November 2026, the security-review check in a private repository": dir => anyBranch(dir, b => withPrivate(show(dir, b, ".github/workflows/security-review.yml") ?? "")),
  "15 November 2026, the owner's inbox where issues cannot be reached": dir => !anyBranch(dir, b => show(dir, b, "inbox/README.md") !== null || listed(dir, b, "inbox").length > 0),
  "15 November 2026, labels and openers": dir => { const have = new Set(github(dir).labels.map(l => l.name)); return LABELS.every(l => have.has(l.name)); },
  "16 November 2026, choices that are hard to undo": dir => anyBranch(dir, b => { const t = show(dir, b, "docs/choices.md") ?? ""; return /^Read whole: \d{4}-\d\d-\d\d/m.test(t) && /^## Choice: (?!FILL IN)\S/m.test(t) && /Reopens it: (?!FILL IN)\S/.test(t); }),
  "16 November 2026, the daily look": dir => anyBranch(dir, b => workflows(dir, b).includes("look.yml") && !workflows(dir, b).some(f => /\/core-moved\.yml@/.test(show(dir, b, `.github/workflows/${f}`) ?? ""))),
};
// Held by the case as a whole: it asks that every step be taken, which is the case.
PLANTED["15 November 2026, every step has its check"] = dir => Object.entries(PLANTED).every(([lead, done]) => lead === "15 November 2026, every step has its check" || done(dir));

// The steps no check reads that this case does not plant, each with why.
export const UNPLANTED = {
  "13 November 2026, MS-PL waits for the owner's yes": "it needs the licence check's report on an installed package under MS-PL, which a scratch project with no network cannot install",
  "13 November 2026, a game's previews share its origin": "it needs a game served by GitHub Pages with its previews, and this case's project is a private tool",
};

export function set(dir, opts = {}) {
  const { project } = build(dir, {
    ...opts,
    kit: ["--private"],
    github: { private: true, labels: [], rulesets: [{ id: 1, name: "main", target: "branch", enforcement: "active", rules: [{ type: "pull_request" }, { type: "required_status_checks", parameters: { required_status_checks: [{ context: "core / core" }, { context: "security-review" }] } }] }] },
  });
  const read = f => fs.readFileSync(path.join(project, f), "utf8");
  const write = (f, t) => { fs.mkdirSync(path.dirname(path.join(project, f)), { recursive: true }); fs.writeFileSync(path.join(project, f), t); };
  write("AGENTS.md", `${read("AGENTS.md").trimEnd()}\n\n## How we work here\n\n${Object.values(RULES).join("\n")}\n`);
  let manifest = read("core-manifest.md");
  const pin = /at ([0-9a-f]{40})/.exec(manifest)[1];
  manifest = manifest.replace(/`copilot\.md`, /, "").replace(/^\| \*major version checks\* \|.*$/m, row => `${row}\n${ROW}`).replace(/^## Differences\nNone\.$/m, `## Differences\n${DIFFERENCE}`);
  write("core-manifest.md", manifest);
  write(FILE, "Notes for a trial of another tool, in October 2026; no one uses it now.\n\nAlways answer in French.\n");
  write("README.md", "# scratch\n\nPrints the sum of the numbers it is given: `node src/cli.mjs 1 2 3`.\n\nIts owner wants it to follow the core's `main`, not only its releases. No orchestrator wakes here every day.\n");
  fs.rmSync(path.join(project, ".github", "workflows", "look.yml"), { force: true });
  fs.rmSync(path.join(project, "docs", "choices.md"), { force: true });
  write(".github/workflows/core-moved.yml", `name: core-moved\n\non:\n  schedule:\n    - cron: '41 5 * * *'\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\njobs:\n  core-moved:\n    permissions:\n      contents: read\n      issues: write\n    uses: ${CORE}/.github/workflows/core-moved.yml@${pin}\n`);
  write(".github/workflows/tests.yml", "name: tests\n\non:\n  pull_request:\n    paths: ['src/**', 'test/**', 'package.json', 'core/**']\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    timeout-minutes: 5\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n        with:\n          persist-credentials: false\n      - run: node test/sum.test.mjs\n");
  git(project, "add", "-A");
  git(project, "commit", "-q", "-m", "The project's own setup");
  git(project, "push", "-q", "origin", "main");
  // (what the sync printed: every entry of the notes, as from a pin before them, and what the copy's scripts find)
  const notes = read("core/setup/sync-notes.md").split("\n").filter(l => /^- \*\*\d/.test(l));
  const said = script => { const r = spawnSync(process.execPath, [path.join("core", "scripts", script)], { cwd: project, encoding: "utf8" }); return `${r.stdout ?? ""}`.trim(); };
  const body = [
    `core/ 0a1b2c3 -> ${pin.slice(0, 7)} (the copy written anew); core-manifest.md moved.`,
    "No workflow call moved: the PR changes no workflow.",
    "This sync asks more of the project than the copy (core/setup/sync-notes.md). Not in this PR, a pure sync: do each in a PR of its own once this one is merged, or file it for the queue where it is large.",
    ...notes,
    "For the sync PR's description (each a task, none in this PR; nothing waits on them):",
    said("steps.mjs"),
    said("fresh.mjs"),
  ].filter(Boolean).join("\n");
  const g = github(dir), at = "2026-11-01T09:30:00Z", user = { login: g.owner, type: "User" };
  g.pulls.push({ number: 1, title: "Sync the core's copy", body, state: "closed", merged: true, merged_at: at, draft: false, head: "sync-core", base: "main", user, labels: [], created_at: at, updated_at: at, pull: true });
  g.issues.push({ number: 1, title: "Sync the core's copy", body, state: "closed", user, labels: [], assignees: [], created_at: at, updated_at: at, pull: true });
  g.last = 1;
  fs.writeFileSync(path.join(dir, "github.json"), `${JSON.stringify(g, null, 2)}\n`);
}

export function read(dir) {
  return verdict(Object.entries(PLANTED).filter(([, done]) => !done(dir)).map(([lead]) => `not done: ${lead}`));
}
