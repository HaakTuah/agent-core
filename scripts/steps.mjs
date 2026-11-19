// What a release asks of a project, step by step (AGENTS.md, "Nothing locks a project"; core archive 215): each entry
// of setup/sync-notes.md has a step here, by the entry's lead (its date and its name), with roughly what it costs and
// how it is told done. A step is told done one of three ways, each exact and none by guessing:
//   - "check": this script reads the project and answers done, or not done with the mend, in words a session acts on
//     with no rule file open;
//   - "held": a check of the project's own, named, fails where the step is not done, and its failure says the mend;
//   - "unread": no check reads it exactly, and the step says why; the staged case "steps" plants it and reads what a
//     session did, or says why it cannot (staged/steps.mjs, beside this file).
// A step only the project's owner can do says so ("owner"): it is advisory, labelled `needs-owner` (labels.json, beside
// this file), and the rest goes on. A step the project leaves undone on purpose is declared in its manifest's "Differences", on its owner's
// word, by a line that quotes the step's lead ("13 November 2026, the core has moved"): such a step is not reported.
// The sync runs this from the copy it has just written (sync.mjs, beside this file), so a sync reports every step
// not done, a standing one too, and never fails over one: nothing waits on a step, and running it twice changes
// nothing. It reads only. Node's own modules and git only.
//
//   node core/scripts/steps.mjs          from a project's root: the steps not done, each with its mend; nothing else
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kitHooks, listed, readProject, check as toolsCheck } from "./agent-tools.mjs";
import { parse as parseChoices, where as choicesAt } from "./choices.mjs";
import { CORE } from "./core-address.mjs";
import { corePath } from "./core-path.mjs";
import { installed } from "./packages.mjs";
import { differencesOf, modulesOf } from "./manifest-reads.mjs";
import { progressOf } from "./done-when.mjs";
import { leadsOut } from "./guards.mjs";
import { importsOf, projectFilesByContent, readProject as readBuildFile } from "./nuget.mjs";
import { NOTES } from "./releases.mjs";
import { READ_MOST, ownFiles } from "./own-files.mjs";
import { parseBaseline, parseConfig, where as shapeAt } from "./shape.mjs";
import { READERS } from "./shape-readers.mjs";
import { ruleFiles } from "./rule-files.mjs";
import { started } from "./started.mjs";
import { toolOf } from "./strength.mjs";
import { Unread, call, calls, commands, uncommented, copiesConfig, folded, given, licenceConfig, marksConfig, nugetConfig, readable, runFiles } from "./check-configs.mjs";
import { parseYaml, pathsLetThrough } from "./workflow-run.mjs";
import { draftHoles, reads } from "./workflows.mjs";
import { twice } from "./yaml-keys.mjs";
import { releaseAge, WAIT } from "./licences.mjs";
import { codeOf, covers, pinFault, pinRead } from "./licence-scan.mjs";
import { npmPackages, offRegistry } from "./lookup.mjs";

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Roughly what a step costs a project where it is not done yet (a step done costs nothing).
export const COST = {
  check: "nothing while its check passes; else what the failure says, in the pull request it fails",
  line: "a line or two of a protected file: one small pull request of a builder's",
  workflow: "a workflow's change: one small pull request, with floor rule 3's two security reviews",
  read: "a read of the project's own rules or settings against the entry, and a small pull request where one differs",
  config: "a check's config and its first baseline: one small pull request of a builder's; what the baseline lists is a debt worked down by tasks, at the dose the codebase's state sets",
  owner: "the owner's yes, asked once; nothing of a session's beyond the ask",
  clean: "one cleanup lane of a builder's, once, its size set by how much of its owner's words the project holds: a pull request for its files, and its issues and comments edited on the host",
  record: "a choice record argued in full: a session's long list and trial, three fresh sessions (the blind picker, the challenger, the judge), one pull request and one issue",
};

// The entries' leads, in the order the notes hold them: "12 November 2026, builders named by role".
export const leads = text => [...String(text).matchAll(/^- \*\*([^*]+?)\.\*\*/gm)].map(m => m[1]);

// The project at `root`, as the checks read it: its files as git lists them (committed or not, ignored ones left out),
// a file's text (null where it is not there), its manifest's slots and differences, and its workflows' YAML.
export function project(root) {
  const { listed, read, safe, unread } = ownFiles(root);
  const manifest = read("core-manifest.md") ?? "";
  const differences = differencesOf(manifest);
  const workflows = Object.fromEntries(listed.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f)).map(f => {
    let yaml = null;
    try { yaml = parseYaml(read(f)); } catch { /* (a workflow this reader cannot read: a check that needs it says so) */ }
    return [f.slice(".github/workflows/".length), { text: read(f), yaml }];
  }));
  return { root, files: listed, read, safe, unread, manifest, differences, workflows };
}

// Where the project's run of each check finds its config, and its calls to the core's workflows: check-configs.mjs,
// beside this file, whose `Unread` a step throws where it cannot read what it needs.
export { KIT_CONFIGS, Unread, call, calls, configs, runsOwn } from "./check-configs.mjs";

const PROJECT_FILES = /\.(cs|fs|vb)proj$/;

// Whether a test of the project's own lies under its shape check's config's "tests", wherever they stand beside its code:
// a file of the copy of the core (core/) is none.
function testsStand(p) {
  let config;
  try { config = parseConfig(p.read(shapeAt(p.manifest)) ?? "", shapeAt(p.manifest)); } catch { return false; }
  if (!config.tests.length) return false;
  return execFileSync("git", ["ls-files", "-z", "--", ...config.tests], { cwd: p.root, encoding: "utf8" }).split("\0").some(f => f && !f.startsWith(corePath(p.root) || "core/"));
}

// Whether a workflow that runs on pull requests has a step that runs the strength check, with STRENGTH_BASE set on the
// step, its job or the workflow: a mention in a comment, or a step with no base, which measures nothing, is none.
const STRENGTH_RUN = /(^|[\s;&|])node\s+core\/scripts\/strength\.mjs(?=\s*($|[;&|]))/mu;
// Whether a workflow runs on every push to an open pull request: the event pull_request with no "types" that leaves out
// its opening or a push, and no "paths" or "branches" filter that could leave out the change a lookup reads.
const everyPush = on => {
  if (!onPullRequests(on)) return false;
  const pr = on && typeof on === "object" && !Array.isArray(on) ? on.pull_request : null;
  if (!pr || typeof pr !== "object") return true;
  const types = pr.types === undefined ? null : [pr.types].flat();
  return (!types || ["opened", "synchronize"].every(t => types.includes(t))) && ["paths", "paths-ignore", "branches", "branches-ignore"].every(k => pr[k] === undefined);
};
const onPullRequests = on => (typeof on === "string" ? on === "pull_request" : Array.isArray(on) ? on.includes("pull_request") : !!on && "pull_request" in on);
const based = (...envs) => envs.some(e => typeof e?.STRENGTH_BASE === "string" && e.STRENGTH_BASE.trim() !== "");
function strengthRuns(p) {
  readable(p, text => text.includes("strength.mjs"));
  return Object.values(p.workflows).some(({ yaml }) => onPullRequests(yaml?.on) && Object.values(yaml.jobs ?? {})
    .some(job => (job?.steps ?? []).some(step => typeof step?.run === "string" && STRENGTH_RUN.test(step.run) && based(step.env, job.env, yaml.env))));
}

// Whether the project names its mutation tool, or none with its reason, and where it names one, a workflow runs the
// strength check (core/tasks/code-shape.md, "How strong the tests are is measured on the lines a pull request
// changes").
function strengthNamed(p) {
  const tool = toolOf(p.manifest);
  const row = "Add to the manifest's slots the row `| *mutation tool* | `<command>` |`, the command that runs the project's mutation tool (a tool of development only) on `{lines}` and writes its report in the mutation-testing-elements schema to `{report}`; or `| *mutation tool* | `none`: <why> |`, where no such tool exists for its language";
  if (!tool) return `${row}. Until then the measure does not run, and nothing fails for it.`;
  if (tool.none !== undefined && !tool.none) return "The manifest's row *mutation tool* says `none` with no reason: add the reason after it (`none`: <why>).";
  if (tool.none !== undefined) return tool.none.startsWith("no tests yet") && testsStand(p) ? `The manifest's row *mutation tool* says \`none\`: no tests yet, as the starter kit wrote it, and the project has tests now: ${row.charAt(0).toLowerCase()}${row.slice(1)}.` : null;
  if (strengthRuns(p)) return null;
  return "The manifest names a mutation tool and no workflow runs it: add a step `node core/scripts/strength.mjs` after the tests in the job that runs them, with `STRENGTH_BASE` set to the pull request's base (`origin/<its base branch>`, fetched first), as `core/setup/sync-notes.md` says (\"how strong the tests are\").";
}

// Each key given twice in one mapping of a workflow or an action of the project's own, as the workflow check reads
// them (workflows.mjs and yaml-keys.mjs, beside this file), which GitHub refuses, running none of the file's jobs: the
// old ones, which the check notes and passes, listed here at every sync until they are gone (#393). Null where none is.
function keysOnce(p) {
  // (with the core's packages not installed, as after a sync made by a copy from before #654, this step cannot be read:
  // it says so, with the install, and every other step is still told)
  if (!installed("yaml")) return `The core's packages are not installed, so the workflows could not be read for a key given twice: run \`node ${corePath(p.root) || "core/"}scripts/install.mjs\`, then \`node ${corePath(p.root) || "core/"}scripts/steps.mjs\` again.`;
  const found = reads(p.files).flatMap(f => twice(p.read(f) ?? "").map(k => `\`${f}\` line ${k.line}, "${k.key}" (first on line ${k.first})`));
  return found.length ? `In one pull request, keep one of the two keys where a workflow or an action of the project's gives one twice in a mapping, with what both said in it (two \`if:\` conditions joined by \`&&\`, two \`env:\` mappings as one), since GitHub runs none of such a file's jobs: ${found.join("; ")}.` : null;
}

// Whether what the copies and pointer checks hold against in an agent tool's files is listed (#405; AGENTS.md of the
// core, "Nothing locks a project": no old breach goes unlisted): each copy there in the copies check's baseline, which
// `--tools` writes, and each broken pointer there named here, at every sync, until it is gone, as the workflow check's
// old keys are. Each read from the project's own copy of its check, run with no base, where it notes every one it
// holds and fails none; null where nothing is left to list.
// Both checks read only the files git tracks, as the work tree holds them (a tracked link, what it leads to), and the
// copies check its config and baseline besides: where none of those changed since the last reading in this process,
// that reading's answer stands, so the two runs are made once for each state of the project (a sync reads it once; a
// test, many times).
const listedBefore = new Map();
function toolFilesListed(p) {
  const config = copiesConfig(p);
  if (!p.safe(config)) throw new Unread(`the copies check's config \`${shown(config)}\` is no regular file of the project's own of at most ${READ_MOST} bytes`);
  const git = args => execFileSync("git", args, { cwd: p.root, encoding: "utf8", maxBuffer: 1 << 28 });
  let baseline = null;
  try { baseline = JSON.parse(p.read(config) ?? "")?.baseline; } catch { /* (its own run says what of the config it cannot read) */ }
  const index = git(["ls-files", "-s", "-z"]), state = crypto.createHash("sha256").update(index);
  for (const f of [...git(["ls-files", "-m", "-z"]).split("\0").filter(Boolean), config, typeof baseline === "string" ? baseline : null]) if (f) state.update(`\0${f}\0${p.read(f) ?? ""}`);
  // (what a tracked link leads to, a file git does not track among them, as the checks read it through the link: only
  // where they would, a regular file of at most READ_MOST bytes inside the project; anything else, a device, a pipe, a
  // folder or a file outside, is never opened, and counts as nothing)
  for (const f of index.split("\0").filter(e => e.startsWith("120000 ")).map(e => e.slice(e.indexOf("\t") + 1))) {
    const to = path.join(p.root, f);
    let text = "";
    try { if (!leadsOut(p.root, to)) { const stat = fs.statSync(to); if (stat.isFile() && stat.size <= READ_MOST) text = fs.readFileSync(to, "utf8"); } } catch { /* (a link to nothing) */ }
    state.update(`\0${f}\0${text}`);
  }
  const key = `${p.root}\0${state.digest("hex")}`;
  if (!listedBefore.has(key)) listedBefore.set(key, toolFilesRead(p, config));
  return listedBefore.get(key);
}
function toolFilesRead(p, config) {
  const run = (script, args, env) => {
    const at = path.join(p.root, corePath(p.root) || "core/", "scripts", script);
    if (!fs.existsSync(at)) throw new Unread(`no copy of ${script} to run`);
    const r = spawnSync(process.execPath, [at, ...args], { cwd: p.root, encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, ...env } });
    return { status: r.status, out: `${r.stdout}`, err: `${r.stderr}`, error: r.error };
  };
  // (a run that never reached its verdict read nothing: reported as not read, never as done)
  const copies = run("copies.mjs", [config], { COPIES_BASE: "" });
  if (copies.error || !(/^ok {3}no new copies/m.test(copies.out) || /^FAIL: (a new copy|.* lists \d+ windows that are gone)/m.test(copies.err))) throw new Unread(`the copies check did not run to its verdict on ${shown(config)}`);
  const pointers = run("pointers.mjs", [], { POINTERS_BASE: "" });
  if (pointers.error || !(/^ok {3}\d+ pointers/m.test(pointers.out) || /^FAIL: a broken pointer: /m.test(pointers.err))) throw new Unread("the pointer check did not run to its verdict");
  const asks = [];
  if (/^note an old copy in an agent tool's file, not yet in the baseline: /m.test(copies.out)) asks.push(`run \`node core/scripts/copies.mjs ${shown(config)} --tools\`, which lists in the copies check's baseline each copy an agent tool's files held before the check read them, and commit the baseline`);
  const broken = [...pointers.out.matchAll(/^note a broken pointer in an agent tool's file: (.*?) \(with no base to read against/gm)].map(m => shown(m[1]));
  if (broken.length) asks.push(`point each pointer in an agent tool's file that leads nowhere at the file, heading or numbered point that holds what it means, or take it out where that is gone: ${broken.join("; ")}`);
  return asks.length ? `In a pull request of its own, ${asks.join("; and, in another, ")}. Until then what the pull request's base held there is noted, never failed.` : null;
}

// The project's tracked test files, as the shape check's config names them, else as the starter kit's does, so that a
// config taken out leaves the tests counted; the copy of the core aside.
function testsTracked(p) {
  let specs;
  try { specs = parseConfig(p.read(shapeAt(p.manifest)) ?? "", shapeAt(p.manifest)).tests; } catch { specs = JSON.parse(fs.readFileSync(path.join(HERE, "setup/template/shape.json.tmpl"), "utf8")).tests; }
  return specs.length > 0 && execFileSync("git", ["ls-files", "-z", "--", ...specs], { cwd: p.root, encoding: "utf8" }).split("\0").some(f => f && !f.startsWith(corePath(p.root) || "core/"));
}

// Whether a workflow that runs on pull requests has a step that runs the selection, with SELECT_BASE set on the step,
// its job or the workflow (core/tasks/tests.md, "A pull request runs the tests its change can reach"); null where it
// does or the project has no tests yet; else the mend.
const SELECT_RUN = /(^|[\s;&|])node\s+core\/scripts\/select\.mjs(?=\s|$)/mu;
function selectionRuns(p) {
  if (!testsTracked(p)) return null;
  readable(p, text => text.includes("select.mjs"));
  const selects = Object.values(p.workflows).some(({ yaml }) => onPullRequests(yaml?.on) && Object.values(yaml.jobs ?? {})
    .some(job => (job?.steps ?? []).some(step => typeof step?.run === "string" && SELECT_RUN.test(step.run) && [step.env, job.env, yaml.env].some(e => typeof e?.SELECT_BASE === "string" && e.SELECT_BASE.trim() !== ""))));
  return selects ? null : "No workflow on pull requests runs the selection of the tests a change can reach: in the job that runs the project's tests, add a step before them `node core/scripts/select.mjs --env RUN`, with `SELECT_BASE` set to the pull request's base (`origin/<its base branch>`, fetched first, or `HEAD^1` with `fetch-depth: 2`), and have the job run only the test files `RUN` names, each between spaces, or its whole suite where it says `all` (`if [ \"$RUN\" = all ]; then <the whole suite>; else <the runner> $RUN; fi`); name the project's proof, never selected out, under \"select\" and \"proof\" in the shape check's config. Where the record's numbers (`node core/scripts/test-record.mjs`) show the suite needed whole, name every test under \"select\" and \"whole\" instead, citing them in that pull request.";
}

// Whether each job that runs the selection on a push, in a workflow a pull request runs too, gives it --passed, the name
// of the check that gates the tests (core/tasks/tests.md, "A tree that passed is not run again"); null where it does,
// or where no such job selects (the step of the tests a change can reach asks that first); else the mend.
// (the step that selects gives --passed; and every step that reads RUN after it runs nothing on "none", so that no
// runner is handed that word or an empty list, which it would read as every test. Only shapes that can be read to be
// false on "none" count, any other is reported: an `if:` whose parts joined by && at its top hold RUN in one part
// alone, that part nothing but `env.RUN == 'all'` and `contains(env.RUN, ' <file> ')` joined by ||, each false for
// "none"; or a run that is the line the mend gives, `if [ "$RUN" = all ]; then …; elif [ "$RUN" != none ]; then … $RUN; fi`)
const passes = job => (job?.steps ?? []).some(step => typeof step?.run === "string" && SELECT_RUN.test(step.run) && /(?<![\w-])--passed(?![\w-])/u.test(step.run));
const RUN_IN_RUN = /\$\{?RUN\}?(?![\w])/u, RUN_IN_IF = /\benv\.RUN\b/u;
const SAFE_TERM = /^(env\.RUN\s*==\s*'all'|contains\(\s*env\.RUN\s*,\s*' [^' ]+ '\s*\))$/u;
const RUN_LINE = /^if \[ "\$RUN" = all \]; then [^;\n]+; elif \[ "\$RUN" != none \]; then [^;\n]+ \$RUN; fi$/u;
// (an expression split at its top level by `op`, its parentheses kept whole; null where they do not pair)
function topLevel(text, op) {
  const parts = [];
  let depth = 0, from = 0, quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "'") quoted = !quoted;
    else if (!quoted && c === "(") depth++;
    else if (!quoted && c === ")" && --depth < 0) return null;
    else if (!quoted && depth === 0 && text.startsWith(op, i)) { parts.push(text.slice(from, i).trim()); from = i + op.length; i += op.length - 1; }
  }
  return depth === 0 && !quoted ? [...parts, text.slice(from).trim()] : null;
}
const unwrapped = t => { let x = t.trim(); while (x.startsWith("(") && x.endsWith(")") && topLevel(x.slice(1, -1), "&&")) x = x.slice(1, -1).trim(); return x; };
function ifKeepsNone(expression) {
  const body = expression.trim().replace(/^\$\{\{([\s\S]*)\}\}$/u, "$1");
  const ands = topLevel(unwrapped(body), "&&");
  const reading = ands?.filter(part => RUN_IN_IF.test(part)) ?? [];
  if (reading.length !== 1) return false;
  const ors = topLevel(unwrapped(reading[0]), "||");
  return !!ors && ors.every(term => SAFE_TERM.test(unwrapped(term)));
}
const keepsNone = step => {
  if (typeof step?.if === "string" && RUN_IN_IF.test(step.if)) return ifKeepsNone(step.if);
  return typeof step?.run !== "string" || !RUN_IN_RUN.test(step.run) || RUN_LINE.test(step.run.trim());
};
const honoursNone = job => {
  const after = (job?.steps ?? []).filter(step => !(typeof step?.run === "string" && SELECT_RUN.test(step.run)));
  const reads = after.filter(step => (typeof step?.if === "string" && RUN_IN_IF.test(step.if)) || (typeof step?.run === "string" && RUN_IN_RUN.test(step.run)));
  return reads.length > 0 && reads.every(keepsNone);
};
const onPush = on => (typeof on === "string" ? on === "push" : Array.isArray(on) ? on.includes("push") : !!on && "push" in on);
function passedRuns(p) {
  readable(p, text => text.includes("select.mjs"));
  // (only a workflow a pull request runs too: a job that runs on a push alone ran nowhere else, and is never skipped)
  const missing = Object.entries(p.workflows).filter(([, { yaml }]) => onPush(yaml?.on) && onPullRequests(yaml?.on)).flatMap(([file, { yaml }]) => Object.entries(yaml.jobs ?? {})
    .filter(([, job]) => (job?.steps ?? []).some(step => typeof step?.run === "string" && SELECT_RUN.test(step.run)) && !(passes(job) && honoursNone(job)))
    .map(([name]) => `\`.github/workflows/${file}\`, its job \`${name}\``));
  return missing.length ? `The selection runs on a push with nothing to say whether the merged tree passed already (${missing.join("; ")}): give its step \`--passed <the check that gates the tests>\` on a push's first run alone (the job's own check, such as \`tests\`, as a ruleset requires it; in bash, \`\${SELECT_PASSED:+--passed "$SELECT_PASSED"}\` with \`SELECT_PASSED\` set so on a push and empty otherwise), \`GH_TOKEN: \${{ github.token }}\` on that step on a push alone, and \`checks: read\` beside \`contents: read\` in the job's permissions; and have every step that reads \`RUN\` run nothing where it says \`none\` (\`if [ \"$RUN\" = all ]; then <the whole suite>; elif [ \"$RUN\" != none ]; then <the runner> $RUN; fi\`, or an \`if:\` whose parts joined by \`&&\` hold \`RUN\` in one part alone, nothing but \`env.RUN == 'all'\` and \`contains(env.RUN, ' <file> ')\` joined by \`||\`), since a runner given no file runs every test, and one given \`none\` fails; then a push that merges a pull request's head whose tree it holds, whose run selected the whole suite and passed that check, runs no test again. Leave it off any job, or entry of a job's matrix, that a pull request does not run, whose suite ran nowhere else, and any whose tests read what no tree holds (a release's tag, the day). Nothing fails meanwhile: the whole suite runs on a push as before.` : null;
}

// Each job of the project's own that starts a suite through the shape check on a pull request, as every suite is
// started, starts once the pull request is marked ready and skips a draft (tasks/tests.md, "No test run on a draft";
// #733, point 7): its trigger's types hold opened, synchronize, reopened and ready_for_review, and its job's `if:` skips
// a draft: a condition of parts joined by && alone, one of them `!github.event.pull_request.draft` or
// `github.event.pull_request.draft == false`, the others any, a status function such as `!cancelled()` among them,
// its quoted strings read as one word each; any other shape (an ||, a negation of more, an index, text outside its
// `${{ }}`, which GitHub reads as a string and so as true) is read as not done.
const SUITE_RUN = /shape\.mjs\b[^\n]*--suite\b/u;
const READY_TYPES = ["opened", "synchronize", "reopened", "ready_for_review"];
const DRAFT_PART = /^(?:!\s*github\.event\.pull_request\.draft|github\.event\.pull_request\.draft\s*==\s*false)$/u;
const skipsDraft = cond => {
  const inner = String(cond ?? "").trim().replace(/^\$\{\{([\s\S]*)\}\}$/u, "$1").replace(/'(?:[^']|'')*'/gu, "text").replace(/!?\s*\b(?:always|success|cancelled|failure)\(\)/gu, "status");
  return !/\|\||[()[\]'$]|\$\{\{|\}\}/u.test(inner) && inner.split("&&").some(part => DRAFT_PART.test(part.trim()));
};
// A workflow of the project's own that publishes what its users get otherwise than from a green default branch (floor
// rule 12, "What users get is published only from a green default branch"; #733, points 7 and 8): one with a step that
// uses GitHub's own action that publishes a site (actions/deploy-pages), read exactly. It waits on a green branch where
// each of its triggers is a person's dispatch, a release, a push of tags alone, or `workflow_run` of completed runs on
// one named branch, each of its jobs asking by an `if:` of parts joined by && alone that the run's conclusion be success
// and its head repository this one (floor topic workflows, rule 2), read as skipsDraft reads a condition, or, with no
// `if:` of its own, needing a job that asks it, so that no job runs a fork's code. A workflow that publishes otherwise (a package registry, a store, a script of its own)
// is read by the session that syncs, since no file says it publishes.
const PUBLISH_USES = /^actions\/deploy-pages@/u;
const RUN_PARTS = [/^github\.event\.workflow_run\.conclusion\s*==\s*'success'$/u, /^(?:github\.event\.workflow_run\.head_repository\.full_name\s*==\s*github\.repository|github\.repository\s*==\s*github\.event\.workflow_run\.head_repository\.full_name)$/u];
const greenOnly = cond => {
  const inner = String(cond ?? "").trim().replace(/^\$\{\{([\s\S]*)\}\}$/u, "$1").replace(/'(?:[^']|'')*'/gu, q => (q === "'success'" ? "'success'" : "text"));
  if (/\|\||[()[\]$]|\$\{\{|\}\}/u.test(inner)) return false;
  const parts = inner.split("&&").map(x => x.trim());
  return RUN_PARTS.every(re => parts.some(x => re.test(x)));
};
const triggers = on => (typeof on === "string" ? { [on]: null } : Array.isArray(on) ? Object.fromEntries(on.map(t => [t, null])) : on && typeof on === "object" ? on : {});
const tagsAlone = push => !!push && typeof push === "object" && Array.isArray(push.tags) && push.tags.length > 0 && !("branches" in push) && !("branches-ignore" in push);
const oneBranch = run => !!run && typeof run === "object" && Array.isArray(run.branches) && run.branches.length === 1 && typeof run.branches[0] === "string" && !/[*?[\]!+]/u.test(run.branches[0]) && Array.isArray(run.types) && run.types.length === 1 && run.types[0] === "completed";
const needsOf = (jobs, name, seen = new Set()) => {
  if (seen.has(name)) return seen;
  seen.add(name);
  const n = jobs[name]?.needs;
  for (const d of typeof n === "string" ? [n] : Array.isArray(n) ? n : []) needsOf(jobs, d, seen);
  return seen;
};
const publishesUngated = p => Object.entries(p.workflows).filter(([, { yaml }]) => {
  const jobs = yaml?.jobs && typeof yaml.jobs === "object" ? yaml.jobs : {};
  const publishing = Object.keys(jobs).filter(name => (Array.isArray(jobs[name]?.steps) ? jobs[name].steps : []).some(st => typeof st?.uses === "string" && PUBLISH_USES.test(st.uses)));
  if (!publishing.length) return false;
  const on = triggers(yaml?.on);
  return Object.entries(on).some(([t, v]) => {
    if (t === "workflow_dispatch" || t === "release") return false;
    if (t === "push") return !tagsAlone(v);
    if (t === "workflow_run") return !oneBranch(v) || !Object.keys(jobs).every(name => greenOnly(jobs[name]?.if) || (!("if" in (jobs[name] ?? {})) && [...needsOf(jobs, name)].some(j => greenOnly(jobs[j]?.if))));
    return true;
  });
}).map(([file]) => `\`.github/workflows/${shown(file)}\``);
function testsWhenReady(p) {
  return [suitesWhenReady(p), publishedWhenGreen(p)].filter(Boolean).join(" ") || null;
}
function publishedWhenGreen(p) {
  readable(p, text => /deploy-pages/u.test(text));
  const on = publishesUngated(p);
  return on.length ? `The project publishes what its users get otherwise than from a green default branch (${on.join("; ")}): in one small pull request, with floor rule 3's two security reviews, make it wait on one: trigger it on \`workflow_run\` of the one workflow that holds every check run on the default branch (where they stand in several, gather them in one that calls the rest by \`workflow_call\`), types [completed] and branches [its default branch], each of its jobs, or a first job every other \`needs\`, asking \`if: \${{ github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_repository.full_name == github.repository }}\` (floor topic workflows, rule 2), and check out \`github.event.workflow_run.head_sha\`; or publish from a release cut from a green commit (a push of tags alone, or the event release); a person's dispatch may stay, started only on a green commit. Then set the manifest's row *users get* to \`releases\`, so a pull request merges on its own green checks (\`node core/scripts/merge-line.mjs --repo <owner>/<name>\` reads it). Until then a pull request is brought up to date first, as now, and nothing fails.` : null;
}
function suitesWhenReady(p) {
  readable(p, text => SUITE_RUN.test(text));
  const loose = Object.entries(p.workflows).filter(([, { yaml }]) => onPullRequests(yaml?.on)).flatMap(([file, { yaml }]) => {
    const types = yaml.on?.pull_request?.types, ready = Array.isArray(types) && READY_TYPES.every(t => types.includes(t));
    return Object.entries(yaml.jobs ?? {})
      .filter(([, job]) => (Array.isArray(job?.steps) ? job.steps : []).some(st => typeof st?.run === "string" && SUITE_RUN.test(st.run)) && !(ready && skipsDraft(job?.if)))
      .map(([name]) => `\`.github/workflows/${shown(file)}\`, its job \`${shown(name)}\``);
  });
  return loose.length ? `In one small pull request, with floor rule 3's two security reviews, bring the project's own test workflow to \`core/tasks/tests.md\` as its kind reads it (${loose.join("; ")}): give its \`pull_request\` trigger the types opened, synchronize, reopened and ready_for_review, and have each job that starts a suite skip a draft (\`if: \${{ !github.event.pull_request.draft }}\`, or that beside other parts joined by && alone), the check the ruleset requires failing on a draft rather than skipped, since a required check whose job is skipped passes (the core's own \`tests.yml\` shows it); then run the platform suites on the schedule \`node core/scripts/runners.mjs --repo <owner>/<name>\` prints from where the tests run, who pays and what users get (where every merge goes live, on each pull request, as now; where users get a release, at the default branch's newest commit), and give the runs on the default branch one concurrency group that cancels the run in progress. Where \`node core/scripts/merge-line.mjs --repo <owner>/<name>\` says the project's users get a release and the host still asks an up-to-date branch, file the issue it names for the owner, labelled needs-owner; nothing waits on it.` : null;
}

// The shape check's config and baseline as a project holds them: { at, config, reads } (the readers its baseline names),
// or { mend } where the config or the baseline is not there or cannot be read.
function shapeHeld(p) {
  const at = shapeAt(p.manifest), text = p.read(at);
  const first = `write its first baseline with \`node core/scripts/install.mjs all\` and then \`node core/scripts/shape.mjs ${at} --first\` (the parser's packages, which the readers of JavaScript, TypeScript, C# and Python need, are installed only where named: #719), commit both, and name both in \`SECURITY.md\` under rule 3, among the checks on the work`;
  if (text === null) return { none: true, mend: `Write \`${at}\` as the starter kit does (\`core/setup/template/shape.json.tmpl\`), with the project's own code under "code" and its test files under "tests", as git pathspecs; then ${first}. Until then the shape check holds the project to the starter kit's config, with each pull request's base as its baseline.` };
  let config;
  try { config = parseConfig(text, at); } catch (e) { return { mend: `Mend \`${at}\`, which the shape check cannot read (${plain(String(e.message).split(". Mend: ")[0], p.root)}), as \`node core/scripts/shape.mjs\` says; then ${first}.` }; }
  const baseline = p.read(config.baseline);
  if (baseline === null) return { mend: `The shape check's config stands at \`${at}\` and its baseline does not: ${first}.` };
  let reads = [];
  try { reads = parseBaseline(baseline, config.baseline, "").reads; } catch { /* (read as naming no reader: its mend writes it again) */ }
  return { at, config, reads };
}

// The readers a later entry of the sync notes asks a baseline to name, each by its own step (shapeReadsParsed).
const LATER_READERS = ["csharp-tree", "javascript-tree", "python-tree"];

// Whether a baseline names `readers`, else the mend that writes it again.
const readersNamed = (held, readers) => {
  const missing = readers.filter(r => !held.reads.includes(r)).map(r => READERS[r]);
  return missing.length ? `The shape check's baseline \`${held.config.baseline}\` was written before the check read ${missing.join(", ")}: run \`node core/scripts/shape.mjs ${held.at} --write\`, which lists what stands there and names every reader, and commit the baseline in a pull request of its own. Until then what the pull request's base held there is reported, never failed.` : null;
};

// Whether the shape check's own list is written (AGENTS.md, "Nothing locks a project": no old breach goes unlisted):
// its config, where the manifest names it or the starter kit writes it, read as the check reads it, and the baseline
// that config names, which names every reader of the check's but those a later entry asks for ("reads";
// shape-readers.mjs), so that it lists what each finds. Null where all of it stands; else the mend.
function shapeWritten(p) {
  const held = shapeHeld(p);
  return held.mend ?? readersNamed(held, Object.keys(READERS).filter(r => !LATER_READERS.includes(r)));
}

// Whether the shape check's baseline names `reader`, one of its readers on the parser, so that it lists what that reader
// finds: the baseline its config names, or, where the project has no config yet, the one the starter kit's names, which
// the check holds it to. Null where it does, and where there is no such baseline or the config cannot be read, which
// the step of 16 November reports: the first baseline it asks for names every reader.
function shapeReadsParsed(p, reader) {
  const held = shapeHeld(p);
  if (!held.mend) return readersNamed(held, [reader]);
  if (!held.none) return null;
  const config = JSON.parse(fs.readFileSync(path.join(HERE, "setup/template/shape.json.tmpl"), "utf8")), baseline = p.read(config.baseline);
  if (baseline === null) return null;
  let reads = [];
  try { reads = parseBaseline(baseline, config.baseline, "").reads; } catch { /* (read as naming no reader) */ }
  return readersNamed({ at: shapeAt(p.manifest), config, reads }, [reader]);
}

// The files that hold only calls to the core's workflows, each job of each a call: a sync moves their pins, which
// `core.yml` checks on every pull request.
const coreCall = job => typeof job?.uses === "string" && job.uses.toLowerCase().startsWith(`${CORE}/.github/workflows/`.toLowerCase());
export const callers = p => (readable(p, text => text.toLowerCase().includes(`${CORE}/.github/workflows/`.toLowerCase())), Object.entries(p.workflows))
  .filter(([, w]) => { const jobs = Object.values(w.yaml?.jobs ?? {}); return jobs.length > 0 && jobs.every(coreCall); }).map(([f]) => `.github/workflows/${f}`);

// Each workflow of the project's own whose pull-request path filter starts it on a change to such a file alone, as
// GitHub reads a filter (a path filter sees which files changed, never what changed in them); null where none does.
// (a file's name as the mend shows it: a control character or a backtick, which would bend a description, as "?")
const shown = f => String(f).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029`]/gu, "?");
function suitesOnPins(p) {
  const pins = callers(p);
  readable(p, text => /paths(-ignore)?\s*:/.test(text));
  const started = Object.entries(p.workflows).filter(([f]) => !pins.includes(`.github/workflows/${f}`)).flatMap(([f, w]) => {
    const on = w.yaml?.on?.pull_request, only = on?.paths, ignore = on?.["paths-ignore"];
    const by = Array.isArray(only) ? pins.filter(c => pathsLetThrough(only, [c])) : Array.isArray(ignore) ? pins.filter(c => !pathsLetThrough(ignore, [c])) : [];
    return by.length ? [`\`.github/workflows/${shown(f)}\` (${by.map(shown).join(", ")})`] : [];
  });
  return started.length ? `A sync that only moves the pin of a call to the core's workflows starts no suite of the project's own: each workflow named lists in its \`paths-ignore\`, beside \`core/**\` and \`core-manifest.md\`, each file that holds only such calls by its exact path, or, where it filters with \`paths\`, takes each out with \`!<its path>\` after its patterns (\`core.yml\` checks those pins on every pull request). Started by such a file alone: ${started.join("; ")}.` : null;
}

// Where a job of the project's own workflows runs a script of the copy before the core's packages are installed from its
// lock file (#654): each such workflow, with the mend; null where each installs first. A call to the core's own
// workflows installs by itself, and holds no step to read. The install counts only as a step that runs it, node and the
// copy's install.mjs as a command's first words (after a shell's then, else or do), with no `if:` or
// continue-on-error of its own; a command that only names the path, as echo does, installs nothing.
// (the reading both install steps share: the copy's scripts and install; whether a step runs a file, a command as
// check-configs.mjs reads it, its words; and whether it installs, naming one of `named` where it is given)
function installReading(p) {
  const copy = corePath(p.root) || "core/", script = `${copy}scripts/`, install = `${copy}scripts/install.mjs`;
  const bare = t => t.replace(/^\.\//u, "");
  const runs = (st, file) => st.cmds.some(c => c.some(w => file(bare(w.text))));
  const installs = (st, named) => st.unconditioned && st.cmds.some(c => {
    const w = c.map(x => x.text); while (["then", "else", "do"].includes(w[0])) w.shift();
    return /(?:^|[\\/])node(?:\.exe)?$/u.test(w[0] ?? "") && bare(w[1] ?? "") === install && (!named || w.slice(2).some(a => named.includes(a)));
  });
  return { script, install, bare, runs, installs };
}
function installsFirst(p) {
  const { script, install, runs, installs } = installReading(p);
  const wrong = Object.entries(p.workflows).filter(([, w]) => jobsOf(w).some(job => {
    const at = job.steps.findIndex(st => runs(st, t => t.startsWith(script) && t.endsWith(".mjs") && t !== install));
    return at >= 0 && !job.steps.slice(0, at).some(st => installs(st));
  })).map(([f]) => `\`.github/workflows/${shown(f)}\``);
  return wrong.length ? `In one small pull request, add a step \`node ${install}\` before the first step that runs a .mjs script under \`${script}\` in each such job of ${wrong.join(", ")}: the core's scripts load the packages it installs from its lock file, and without them a check says it did not run.` : null;
}

// Where a job of the project's own workflows runs the shape check (its script, or the copies check's steps through
// checks.mjs) before the parser's packages are installed from their own lock file (#719): each such workflow, with the
// mend; null where each names that install first. Read as installsFirst reads an install, and naming `parser` or `all`.
function parserFirst(p) {
  const { script, install, bare, installs } = installReading(p);
  const shapes = st => st.cmds.some(c => { const w = c.map(x => bare(x.text)); return w.includes(`${script}shape.mjs`) || (w.includes(`${script}checks.mjs`) && w.includes("copies")); });
  const wrong = Object.entries(p.workflows).filter(([, w]) => jobsOf(w).some(job => {
    const at = job.steps.findIndex(shapes);
    return at >= 0 && !job.steps.slice(0, at).some(st => installs(st, ["parser", "all"]));
  })).map(([f]) => `\`.github/workflows/${shown(f)}\``);
  return wrong.length ? `In one small pull request, have the step that installs the core's packages in each job of ${wrong.join(", ")} that runs the shape check install the parser's too, \`node ${install} all\`, before the shape check runs: it reads the functions of JavaScript, TypeScript, C# and Python on the parser, whose packages stand in a lock file of their own, and without them, after an install of the core's first lock alone, the check reads none of them, saying so as a warning, and with no install of the core's at all it fails, saying so.` : null;
}

// Where the project's call to the NuGet check starts only on the paths it names, each build file a build reads by
// another name than those (an Import's, a property's MSBuild's targets import, a file whose root is a Project), as the
// core's NuGet check lists them, that the filter lets through no change to; null where it names none.
function nugetPathsHold(p) {
  readable(p, text => /\/\.github\/workflows\/nuget\.yml@/i.test(text));
  const filtered = Object.entries(p.workflows).filter(([, w]) => Array.isArray(w.yaml?.on?.pull_request?.paths) && Object.values(w.yaml?.jobs ?? {})
    .some(job => typeof job?.uses === "string" && job.uses.toLowerCase().startsWith(`${CORE}/.github/workflows/nuget.yml@`.toLowerCase())));
  if (!filtered.length) return null;
  const at = corePath(p.root) || "core/", own = p.files.filter(f => !f.startsWith(at)), byContent = projectFilesByContent(p.root, own);
  const read = [...new Set([...byContent, ...importsOf(own, f => readBuildFile(p.root, f), byContent).brought.keys()])];
  const wrong = filtered.map(([f, w]) => [f, read.filter(r => !pathsLetThrough(w.yaml.on.pull_request.paths, [r]))]).filter(([, missed]) => missed.length);
  // (each as a pattern that matches only itself, its glob characters taken as themselves, and quoted as YAML quotes it;
  // a name that holds a control character is named with "?" in its place, to be renamed)
  const asPattern = f => `'${f.replace(/[\\[\]*?!+]/g, c => `\\${c}`).replace(/'/g, "''")}'`.replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029`]/gu, "?");
  return wrong.length ? `The \`paths:\` of a call to the NuGet check let through a change to every file a build of the project's reads, or the check starts on none of its changes: add each, by its exact path, to ${wrong.map(([f, missed]) => `\`.github/workflows/${f}\`: ${missed.map(asPattern).join(", ")}`).join("; ")} (a name shown with "?" holds a control character or a backtick: rename it).` : null;
}

// A call to one of the core's pull-request checks whose job is skipped on a draft, or which skips a draft by itself (the
// description check's), runs on a pull request once it is ready only where its trigger starts it when one is marked
// ready (#375, #502): without that, the check a draft skipped never runs on that head, and a ruleset counts the skip as
// passed. Each workflow where a call does so is named, as the workflow check reads it (workflows.mjs, draftHoles).
function readyOnlyHolds(p) {
  readable(p, text => /\/\.github\/workflows\/(core|copies|personal-terms|signatures|nuget|pr-description)\.yml@/i.test(text));
  const wrong = Object.entries(p.workflows).filter(([, w]) => w.yaml && draftHoles(w.yaml).length);
  return wrong.length ? `A call to the core's checks whose job is skipped on a draft never runs once the pull request is marked ready, since its trigger leaves that out: add \`ready_for_review\` to the \`types:\` under \`pull_request:\` (where it lists none, \`types: [opened, reopened, synchronize, ready_for_review]\`) in ${wrong.map(([f]) => `\`.github/workflows/${shown(f)}\``).join(", ")}.` : null;
}

// A call to the core's core.yml that runs part of its one job (#376) runs every check the project ran before: the copies
// checks and the description check each folded into it, still called on their own or run by a workflow of the project's,
// the copies checks with their marks,
// and none both folded and called, which would bill its job twice. Null where no call folds any part.
const FOLDS = [["copies", "copies.yml"], ["description", "pr-description.yml"], ["signatures", "signatures.yml"], ["nuget", "nuget.yml"]];
function oneJobHolds(p) {
  readable(p, text => /\/\.github\/workflows\/(core|copies|pr-description|signatures|nuget)\.ya?ml@/i.test(text));
  if (!FOLDS.some(([key]) => folded(p, key).length)) return null;
  // (a check a workflow of the project's own runs, by its script, is run as well)
  const script = { copies: "copies.mjs", description: "pr-description.mjs" };
  const left = FOLDS.slice(0, 2).filter(([key, own]) => !folded(p, key).length && !calls(p, own).length && !runFiles(p, script[key]).length).map(([key]) => key === "copies"
    ? "`copies: checks/copies.json` and `sizes: checks/sizes.json` (the copies check's config and marks, where the project keeps them elsewhere, their paths)" : "`description: true`");
  if (folded(p, "copies").length && !folded(p, "sizes").length) left.push("`sizes: checks/sizes.json` beside its `copies:`");
  const twice = FOLDS.filter(([key, own]) => folded(p, key).length && calls(p, own).length).map(([key, own]) => `the call of its own to the core's \`${own}\`, which its \`${key}:\` runs too`);
  const wrong = [left.length ? `pass it ${left.join(" and ")}, as \`core/setup/template/workflows/core.yml.tmpl\` has it, or call the core's \`copies.yml\` or \`pr-description.yml\` again for what it leaves out` : "", twice.length ? `take out ${twice.join(", and ")}, since it bills its job twice` : ""].filter(Boolean);
  return wrong.length ? `The project's call to the core's \`core.yml\` runs part of its one job and not every check the project ran: ${wrong.join("; ")}.` : null;
}

// Rule 5 of a project's SECURITY.md, from its line "5. " to the next rule or heading at a line's start: its lines, the
// first without its number and title; null where there is none.
function rule5(text) {
  const lines = text?.split("\n") ?? [], at = lines.findIndex(l => /^5\.\s/.test(l));
  if (at < 0) return null;
  const end = lines.findIndex((l, i) => i > at && /^(\d+\.\s|#)/.test(l));
  return [lines[at].replace(/^5\.\s*(\*\*[^*]*\*\*)?:?/, ""), ...lines.slice(at + 1, end < 0 ? undefined : end)];
}
// A block's items: each a list line at its outermost depth, with the lines under it indented deeper (its wrapped text
// and the items nested in it).
function listItems(block) {
  const items = [];
  let depth = null;
  for (const l of block) {
    const indent = /^\s*/.exec(l)[0].length, item = /^\s*[-*]\s/.test(l);
    if (item && (depth === null || indent <= depth)) { depth = indent; items.push(l); }
    else if (items.length && l.trim() && indent > depth) items[items.length - 1] += `\n${l}`;
  }
  return items;
}
// Whether an item names its tests: a path in backticks after the words "hostile tests" that is a file or folder of the
// project (one the item names for what checks the input does not count).
function namesTests(p, item) {
  const there = f => { const n = f.replace(/^\.\//, "").replace(/\/+$/, ""); return !!n && p.files.some(x => x === n || x.startsWith(`${n}/`)); };
  return [...(/hostile\s+tests\b([\s\S]*)/i.exec(item)?.[1] ?? "").matchAll(/`([^`]+)`/g)].some(m => there(m[1]));
}
const CASES = "too long, the wrong type, markup, a file path, a number out of range, nothing at all";
// The step for the inputs rule 5 names: "None", or the starter kit's "FILL IN", reads done only while it lists no input;
// once one is listed, each is read, and an item whose tests are still "FILL IN" names none.
function hostileTests(p) {
  const block = rule5(p.read("SECURITY.md"));
  if (!block) throw new Unread("no SECURITY.md with a rule 5 to read");
  const items = listItems(block), said = block.join("\n");
  if (!items.length && (/FILL IN/.test(said) || /^None\b/i.test(said.trim()))) return null;
  if (!items.length) return `In \`SECURITY.md\`, rule 5, list each input anyone but the user at hand can shape as an item of its own (a line that opens \`- \`), saying what checks it and then, after the words "hostile tests:", naming in backticks the file or folder that holds them (${CASES}), or write "None" where the project takes none.`;
  const bare = items.filter(l => !namesTests(p, l)).map(l => l.split("\n")[0].trim().slice(2).trim());
  return bare.length ? `In \`SECURITY.md\`, rule 5, each input names, after the words "hostile tests:", in backticks, a file or folder of the project that holds them (${CASES}): write those tests where they are missing, and name them so. Naming none that is there: ${bare.map(l => l.length > 80 ? `${l.slice(0, 77)}...` : l).join("; ")}.` : null;
}

// The core's files that moved to folders that say who reads them or when (#304, point 8), old path to new, as the
// files that point from the old paths say it themselves: each says, under its title, which file or folder "holds these
// rules now", as a link whose text is the path from the core's root, in backticks.
export function moved(core = HERE) {
  const out = {};
  for (const old of [...(fs.existsSync(path.join(core, "modules")) ? fs.readdirSync(path.join(core, "modules")).filter(f => f.endsWith(".md")).map(f => `modules/${f}`) : []), "floor/topics.md"]) {
    let text = "";
    try { text = fs.readFileSync(path.join(core, old), "utf8"); } catch { continue; }
    const to = /^\[`([^`\s]+)`\]\([^)\s]+\) holds these rules now/mu.exec(text)?.[1];
    if (to) out[old] = to;
  }
  return out;
}
// What a file at an old path says stands elsewhere than the rest of it, in its lines "Now in [`<path>`](..): **<lead>**.":
// { old path: [{ lead, to }] }.
moved.apart = (core = HERE) => Object.fromEntries(Object.keys(moved(core)).map(old => {
  let text = "";
  try { text = fs.readFileSync(path.join(core, old), "utf8"); } catch { /* (gone since it was listed) */ }
  return [old, [...text.matchAll(/^Now in \[`([^`\s]+)`\]\([^)\s]+\): \*\*([^*]+?)\*\*\.$/gmu)].map(m => ({ to: m[1], lead: m[2] }))];
}).filter(([, parts]) => parts.length));
// The folder of the modules as a copies config's pattern names it, and the patterns of the folders the rules stand in
// now, which join it: the copies check lets a config read more, never less, so the old pattern stays while the files
// that point stand at the old paths.
export const MOVED_GLOB = '"core/modules/*.md"', NEW_GLOBS = ['"core/floor/topics/*.md"', '"core/roles/*.md"', '"core/roles/shared/*.md"', '"core/tasks/*.md"', '"core/tools/*.md"'], MOVED_GLOBS = NEW_GLOBS.join(", ");
// A dated record of the project's own, which stays as it stands: a file of prose (.md or .txt) whose name opens with a
// day (2026-11-16...), or one in a folder named archive, reports or records. What lies at the root under a name that
// opens with a dot is read all the same (namers): there a host and the tools keep what they read.
const dated = f => /\.(md|txt)$/u.test(f) && (/(^|\/)\d{4}-\d{2}-\d{2}[^/]*$/u.test(f) || /(^|\/)(archive|reports|records)\//u.test(f));
// The project's own files that may name a file of the core and that a check, a tool or a session reads as they stand
// now: each rule file and each file a tool takes its instructions from, whatever its name or folder; every file at the
// root whose name, or whose folder's, opens with a dot, where tools keep what they read, whatever its name; and every
// other file of text that is no dated record.
function namers(p) {
  let rules = [];
  try { rules = ruleFiles(p.read, dir => p.files.filter(f => f.startsWith(`${dir}/`)), { tools: true }); } catch { /* (no list of rule files yet: the files of text alone) */ }
  return p.files.filter(f => !f.startsWith(corePath(p.root) || "core/") && (rules.includes(f) || /^\.[^/]/u.test(f) || (/\.(?:md|json|ya?ml|mjs|cjs|js|ts|sh|txt|toml)$/u.test(f) && !dated(f))));
}
// Of those, the files that name each old path: Map(old path -> [file]).
function namedStill(p, map) {
  const found = new Map(), old = new RegExp(`core/(${Object.keys(map).map(f => f.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})(?![\\w/-])`, "gu");
  for (const f of namers(p)) for (const m of (p.read(f) ?? "").matchAll(old)) found.set(m[1], [...new Set([...(found.get(m[1]) ?? []), f])]);
  return found;
}
// A copies config that reads the old folder and not yet each folder the rules stand in, however its patterns are laid out.
const readsOldAlone = (p, f) => f.endsWith(".json") && (p.read(f) ?? "").includes(MOVED_GLOB) && !NEW_GLOBS.every(g => (p.read(f) ?? "").includes(g));
// Where two old paths now lead to one file, the word that it is named once; and, where a file a tool takes its
// instructions from by pulling files in (Kiro's steering, Antigravity's rules) still names an old path, that the step
// comes before any other task, since such a session reads each rule on one line's word until then.
const once = (found, map) => [...found.keys()].filter(a => [...found.keys()].some(b => b < a && map[b] === map[a])).map(a => `a file that named \`core/${a}\` beside the other path that now leads to \`core/${map[a]}\` names that file once`);
const first = found => ([...found.values()].flat().some(f => /^\.(kiro|agents?)\//u.test(f)) ? "Before any other task, since a tool whose entry file pulls the core's files in follows no further import, and its sessions read each rule on one line's word until this is done: in" : "In");
// Where a project's own files still name an old path of the core's, a copies config of its own the old folder's pattern
// alone, and its manifest's "Paths:" line the old folders: the mend, naming each file and each path's new one; null
// where none does.
function movedPaths(p) {
  const map = moved(), found = Object.keys(map).length > 0 ? namedStill(p, map) : new Map(), said = files => files.map(f => `\`${shown(f)}\``).join(", ");
  const apart = from => (moved.apart()[from] ?? []).map(a => `, but its "${a.lead}" is now in \`core/${a.to}\``).join("");
  const wrong = [...found].map(([from, files]) => `\`core/${from}\` is now \`core/${map[from]}\`${map[from].endsWith("/") ? ", a file a topic: name the topic's own file" : ""}${apart(from)} (in ${said(files)})`).concat(once(found, map));
  const globs = Object.keys(map).length > 0 ? namers(p).filter(f => readsOldAlone(p, f)) : [];
  if (globs.length) wrong.push(`after the pattern ${MOVED_GLOB} add the patterns ${MOVED_GLOBS}, leaving it where it is, since a copies config may read more and never less (in ${said(globs)})`);
  if (!/^Paths:.*\btasks\/.*\btools\//mu.test(p.manifest)) wrong.push('the "Paths:" line of `core-manifest.md` reads "one into floor/, roles/, tasks/, tools/, scripts/, setup/ or archive/ is under core/"');
  return wrong.length ? `${first(found)} one pull request, name each of the core's files by the path it now has: ${wrong.join("; ")}.` : null;
}

// A job's steps with each local composite action (`uses: ./…`) read in its place, its own steps in order, so a check or
// a lookup run from one is seen where it runs: an inner step takes its caller's `if:`, continue-on-error and env where
// it gives none of its own, and runs from the folder it names, never its caller's default; each `${{ inputs.x }}` in its
// run, folder, `with:` and env is the caller's `with:` (or the input's default) where it gives one, and is left, never to
// match, where not. An action no deeper than 10, never within itself, and no more than INLINED_MOST steps read in a
// workflow, however the actions call each other; one whose file cannot be read as YAML, is past ACTION_MOST bytes, or
// lies past that bound is named in `unread`, and its step kept as it stands.
const INLINED_MOST = 5000, ACTION_MOST = 1 << 20;
function inlined(list, read, unread, budget, chain = []) {
  return list.flatMap(st => {
    const uses = typeof st?.uses === "string" && st.uses.startsWith("./") ? path.posix.normalize(st.uses.slice(2)).replace(/\/+$/u, "") : null;
    const steps = uses && !uses.startsWith("..") && !chain.includes(uses) && chain.length < 10 ? compositeSteps(uses, read, unread) : null;
    if (!steps) return [st];
    if ((budget.left -= steps.length) < 0) { unread.push(uses); return [st]; }
    const given = inputsOf(st, steps.inputs);
    const inner = steps.map(x => (x && typeof x === "object" ? (y => ({ ...y, composite: true, if: x.if ?? st.if, "continue-on-error": x["continue-on-error"] || st["continue-on-error"], env: { ...(st.env ?? {}), ...(y.env ?? {}) } }))(given(x)) : x));
    return inlined(inner, read, unread, budget, [...chain, uses]);
  });
}
// A step of an action with each `${{ inputs.x }}` of its run, folder, `with:` and env put as its caller gives it.
const inputsOf = (caller, declared) => x => {
  const value = name => {
    const v = caller?.with?.[name] ?? declared?.[name]?.default;
    return typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : null;
  };
  const put = t => (typeof t === "string" ? t.replace(/\$\{\{\s*inputs\.([\w-]+)\s*\}\}/gu, (whole, name) => value(name) ?? whole) : t);
  const out = { ...x, run: put(x.run), "working-directory": put(x["working-directory"]) };
  for (const key of ["with", "env"]) if (x[key] && typeof x[key] === "object") out[key] = Object.fromEntries(Object.entries(x[key]).map(([k, v]) => [k, put(v)]));
  return out;
};
// The steps of the composite action at `at`, with its declared inputs as `inputs`, or null: none there, or not
// composite, or (named in `unread`) no YAML or past ACTION_MOST bytes. Each action is read and parsed once for a project.
const ACTIONS = new WeakMap();
function compositeSteps(at, read, unread) {
  if (!ACTIONS.has(read)) ACTIONS.set(read, new Map());
  const seen = ACTIONS.get(read);
  if (!seen.has(at)) seen.set(at, actionAt(at, read));
  const found = seen.get(at);
  if (found?.unread) unread.push(found.unread);
  return found?.steps ?? null;
}
function actionAt(at, read) {
  for (const f of [`${at}/action.yml`, `${at}/action.yaml`]) {
    const text = read(f);
    if (text === null) continue;
    if (text.length > ACTION_MOST) return { unread: f };
    let yaml = null;
    try { yaml = parseYaml(text); } catch { /* (named below) */ }
    if (!yaml || typeof yaml !== "object") return { unread: f };
    return Array.isArray(yaml.runs?.steps) ? { steps: Object.assign([...yaml.runs.steps], { inputs: yaml.inputs }) } : null;
  }
  return null;
}

// Whether a step's shell stops on a failure: bash or sh, the default off Windows.
function stopsOn(st, job, w) {
  const shell = st?.shell ?? job?.defaults?.run?.shell ?? w.yaml?.defaults?.run?.shell;
  return shell === undefined ? notWindows(job) : /^(?:bash|sh)$/u.test(String(shell).trim());
}
// Whether a job's runner is one of GitHub's own Linux or macOS runners, named outright, whose default shell is bash (a
// runner a matrix, an expression, an organisation or a self-hosted machine names may be Windows, whose default is pwsh;
// a label is the owner's, so one that names a Linux runner is taken at its word).
const notWindows = job => { const r = [job?.["runs-on"] ?? ""].flat(); return r.length > 0 && r.every(x => typeof x === "string" && /^(?:ubuntu|macos)-[\w.-]+$/u.test(x)); };
// The folder a step runs in, where it names one: its own, else (but in a composite action) its job's or workflow's default.
function folderOf(st, job, w) {
  const dir = st?.["working-directory"] ?? (st?.composite ? undefined : job?.defaults?.run?.["working-directory"] ?? w.yaml?.defaults?.run?.["working-directory"]);
  return typeof dir === "string" ? dir : undefined;
}
// Whether a step may run more than its words show: a command run inside another's words, a redirection, or an expansion
// bash may evaluate (anything but a plain ${NAME}); a shell other than bash or sh (an unset one only where the runner is
// no Windows one); or a variable in its env, its job's or its workflow's, but those its config word names (an
// allow-list), and never one a runner, a shell, Node, OpenSSL or the loader reads, even named so.
const READ_BY_RUNNERS = /^(?:LD_|BASH|ENV$|PATH$|NODE_|OPENSSL_|SSL_|SHELLOPTS$|PS4$|IFS$|CDPATH$|GLOBIGNORE$|TMPDIR$|INPUT_|ACTIONS_|RUNNER_|GITHUB_)/iu;
const visible = (env, job, w) => [env, job?.env, w.yaml?.env].flatMap(e => (e && typeof e === "object" ? Object.keys(e) : []));
const plainKey = k => /^[A-Za-z_]\w*$/u.test(k) && !READ_BY_RUNNERS.test(k);
const hides = (st, env, job, w) => {
  const text = typeof st?.run === "string" ? st.run : "";
  const shell = st?.shell ?? job?.defaults?.run?.shell ?? w.yaml?.defaults?.run?.shell;
  const word = commands(text)[0]?.[2]?.text ?? "";
  const given = new Set([...word.matchAll(/\$\{?([A-Za-z_]\w*)|%([A-Za-z_]\w*)%/gu)].map(m => m[1] ?? m[2]));
  // (a redirection, which may write a file, the lookup itself among them, before the program opens it, is refused too)
  return /\$\(|`|[<>]|\$\{(?![A-Za-z_]\w*\})/u.test(text.split(/\r?\n/u).map(uncommented).join("\n"))
    || (shell === undefined ? !notWindows(job) : !/^(?:bash|sh)$/u.test(String(shell).trim()))
    || visible(env, job, w).some(k => !plainKey(k) || !given.has(k));
};
// Whether an action's step may stand before a lookup as it is given: no env of its own and none a runner reads from its
// job or workflow; for the checkout, no other repository, folder or commit than the pull request's; and for a setup
// action, only the version, distribution and architecture to set up, and its cache only turned off, by
// package-manager-cache: false, or by cache: false in setup-dotnet alone (elsewhere a "cache" names a package
// manager, not a switch), since a cache or an
// install could run the pull request's own files (a cache an action takes by default runs the package manager in the
// project's folder, under its config: the step's advisory reading, which a project's own workflow, a protected file, holds).
const plainAction = (st, job, w) => Object.keys(st.env).length === 0 && visible({}, job, w).every(plainKey)
  && Object.entries(st.with ?? {}).every(([k, v]) => (/^actions\/checkout@/u.test(st.uses) ? ["fetch-depth", "persist-credentials"].includes(k)
    : /^(?:[\w-]*version(?:-file)?|distribution|architecture)$/u.test(k) || (String(v) === "false" && (k === "package-manager-cache" || (k === "cache" && /^actions\/setup-dotnet@/u.test(st.uses))))));
// Whether a job runs in a container of its own, or beside service containers, which may mount its folder: it runs as
// they are given, their env and options too, so nothing counts there.
const boxedJob = job => job?.container !== undefined || job?.services !== undefined;
// Whether a step runs whenever its job reaches it: no `if:` and no continue-on-error of its own.
const unconditioned = st => st?.if === undefined && !st?.["continue-on-error"];
// A step of a job as the step reads it: its commands, whether its one lookup counts, its action and its env.
function stepOf(st, job, w, started) {
  const cmds = typeof st?.run === "string" ? commands(st.run) : [];
  const stops = stopsOn(st, job, w);
  // (a lone "|" or "&" in the step's text, a pipe or the background, hides the command's failure from the step)
  const alone = typeof st?.run === "string" && !/(?:^|[^&|>])[&|](?![&|])/mu.test(st.run.split(/\r?\n/u).map(uncommented).join("\n"));
  const counts = started && cmds.length === 1 && alone && stops && st.if === undefined && job?.if === undefined && !st["continue-on-error"] && !job?.["continue-on-error"];
  const env = st?.env && typeof st.env === "object" ? st.env : {};
  const boxed = boxedJob(job);
  return { cmds, counts, unconditioned: unconditioned(st), hidden: boxed || hides(st, env, job, w), plain: !boxed && typeof st?.uses === "string" && plainAction({ ...st, env }, job, w), dir: folderOf(st, job, w), uses: typeof st?.uses === "string" ? st.uses : null, env };
}

// Each job of a workflow: the commands its steps run (shell comments left out, as check-configs.mjs's reader reads
// them), all of them and step by step in order; for each step, whether a lookup there counts; and whether its checkout
// holds the base beside the head (a fetch-depth of 0, or 2 or more, and no ref of another commit). A lookup counts only
// as the one command of its step, in a workflow a pull request starts, where neither the step nor its job carries an
// `if:` or continue-on-error (conditions the reader cannot tell), under bash or sh, which stop on a failure (pwsh, the
// default on Windows, and a shell given its own options do not). A workflow whose YAML cannot be read is read as one
// job, its whole text its one command list, and none of it counts as a lookup.
function jobsOf(w, read = () => null) {
  const deep = (v) => /^(?:0|[2-9]|\d{2,})$/u.test(String(v ?? "").trim());
  const jobs = w.yaml?.jobs && typeof w.yaml.jobs === "object" ? Object.values(w.yaml.jobs) : null;
  if (!jobs) return [{ runs: commands(w.text ?? ""), steps: [], deep: false, unread: [] }];
  const started = everyPush(w.yaml?.on), budget = { left: INLINED_MOST };
  return jobs.map(job => {
    const unread = [];
    const steps = inlined(Array.isArray(job?.steps) ? job.steps : [], read, unread, budget).map(st => stepOf(st, job, w, started));
    return { runs: steps.flatMap(st => st.cmds), steps, unread,
      deep: (job?.steps ?? []).some(st => typeof st?.uses === "string" && /^actions\/checkout@/u.test(st.uses) && deep(st.with?.["fetch-depth"]) && st.with?.ref === undefined) };
  });
}
// A config as a step names it, from the folder the step runs in, so that one name in two folders is two configs.
const placed = (cfg, dir) => (typeof cfg === "string" && dir && !path.posix.isAbsolute(cfg) ? path.posix.normalize(path.posix.join(dir, cfg)) : cfg);
// Whether a counted lookup step runs the lookup, given `flag`, with the config `at.cfg` the check's step gives; a config
// named by a variable is matched only where both steps give that variable the same value (or neither sets it), one
// an action's input names, where its caller gave none, is matched by none, and a lookup counts only where it is a step
// that may stand before the lookup itself (beforeLookup: the runner's node running the copy's own script from the
// project's root, nothing hidden), and every step before it in its job is one too, so nothing the pull request holds
// has run before it.
const lookupOf = (st, flag, copy, at, job) => {
  if (/\$\{\{\s*inputs\./u.test(at.cfg ?? "") || !beforeLookup(st, copy)) return false;
  const i = job.steps.indexOf(st);
  if (i < 0 || !job.steps.slice(0, i).every(x => beforeLookup(x, copy))) return false;
  if (!st.counts || !looksUp(st.cmds[0], flag, copy) || placed(configOf(st.cmds[0], "lookup.mjs", copy), st.dir) !== at.cfg) return false;
  const name = /\$\{?(\w+)|%(\w+)%/u.exec(at.cfg ?? "");
  return !name || st.env[name[1] ?? name[2]] === at.step.env[name[1] ?? name[2]];
};
// Where a lookup stands, as the step's mend says it (beforeLookup).
const FIRST = copy => `with nothing before it in its job but the checkout, \`setup-\` actions and the core's lookup, exact-versions, licence, agent-tools and install scripts, each run as \`node ${copy}scripts/<name>.mjs\` from the project's root under bash (named, or on GitHub's own Linux or macOS runner) in a job with no container or services, with no env but a variable its config is named by, each setup action given only its version, its cache, if named, turned off (\`package-manager-cache: false\`, or in \`setup-dotnet\` \`cache: false\`), so that nothing of the pull request's (\`npm\`, \`dotnet\`, a build script, a local action, \`${copy}scripts/nuget.mjs\`) has run before it`;
// Whether a step may stand before a lookup: checkout or a setup action, or a run, by the runner's own `node`, from the
// project's root, of one of the core's scripts that only read (BEFORE_LOOKUP), named by the copy's own path, with nothing
// hidden (hides). Anything else (dotnet under any spelling, npm, a build script, make, a local action, a script of the
// core's that restores or runs the project's tests) may run the pull request's own files, which could change what the
// lookup reads or the lookup itself: an allow-list, not a search for a build.
// (and the install of the core's own packages from its lock file, which runs none of their code: #654)
const BEFORE_LOOKUP = ["lookup.mjs", "exact-versions.mjs", "licences.mjs", "agent-tools.mjs", "install.mjs"];
const beforeLookup = (st, copy) => (st.uses ? st.plain && /^actions\/(?:checkout|setup-[\w-]+)@/u.test(st.uses)
  : !st.hidden && (st.dir === undefined || st.dir === ".") && st.cmds.length > 0 && st.cmds.every(c => c.length > 1
    && /^node(?:\.exe)?$/iu.test(c[0].text) && BEFORE_LOOKUP.some(n => c[1].text === `${copy}scripts/${n}` || c[1].text === `./${copy}scripts/${n}`)));
// Whether a command names the script `name` of the copy at `copy` (the manifest's path, core/ by default), and, given
// `flag`, with that flag (true) or without it (false).
const running = (words, name, flag, copy = "core/") => words.some(w => new RegExp(`(?:^|/)${copy.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")}scripts/${name.replace(".", "\\.")}$`, "u").test(w.text))
  && (flag === undefined || words.some(w => w.text === "--nuget") === flag);
// The config a command gives the copy's script `name`: its first argument after the script that is no flag.
const configOf = (words, name, copy) => {
  const at = words.findIndex(w => running([w], name, undefined, copy));
  return at < 0 ? null : words.slice(at + 1).find(w => !w.text.startsWith("--"))?.text ?? null;
};
// Whether a command runs the lookup itself: node, then the copy's script.
const looksUp = (words, flag, copy) => /(?:^|[\\/])node(?:\.exe)?$/iu.test(words[0]?.text ?? "") && words.length > 1 && running([words[1]], "lookup.mjs", undefined, copy) && running(words, "lookup.mjs", flag, copy);

// What stood before the package checks read it, which they report and pass (#488, points 3 to 5), read as they read
// it: an .npmrc of "ignoreScriptsIn" without the week's wait (licences.mjs), a lock entry not from npm's registry with an
// integrity value (lookup.mjs), and a file that downloads what may be a program unpinned (licence-scan.mjs). A config,
// audit or lock file those checks cannot read is their own failure, so nothing is said of it here.
function packagesHeld(p) {
  const config = jsonAt(p, licenceConfig(p));
  if (!config) return null;
  const all = [...waitAsks(p, config), ...offAsks(p, config), ...pinAsks(p, config)];
  return all.length ? `Each stood before the package checks read it, which report it and pass; mend each in a pull request of its own: ${all.slice(0, 20).join("; ")}${all.length > 20 ? `; and ${all.length - 20} more, which the licence check and the lookup print` : ""}.` : null;
}
// (a file of the project's read as a JSON object, or null; a list's texts)
const jsonAt = (p, f) => { try { const v = JSON.parse(p.read(f) ?? "null"); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch { return null; } };
const strings = v => (Array.isArray(v) ? v.filter(x => typeof x === "string" && x) : []);
// An .npmrc of "ignoreScriptsIn" with no wait of WAIT days.
const waitAsks = (p, config) => strings(config.ignoreScriptsIn).filter(f => (releaseAge(p.read(f) ?? "") ?? 0) < WAIT)
  .map(f => `\`${shown(f)}\` sets no wait: add the line \`min-release-age=${WAIT}\` to it`);
// A lock entry of "lockfiles" not from npm's registry with an integrity value.
const offAsks = (p, config) => strings(config.lockfiles).flatMap(f => {
  let held = [];
  try { held = npmPackages(p.read(f) ?? "", f); } catch { /* (the lookup and the licence check fail on it themselves) */ }
  return held.filter(offRegistry).map(q => `\`${shown(f)}\`: ${shown(q.name)}@${shown(q.version)}: ${offRegistry(q)}: take it from npm's registry at one exact version, by npm's own install in the lock file's folder with --save-exact and --ignore-scripts, so that npm writes its address and integrity value`);
});
// A file the scan reads that downloads what may be a program, unpinned by version or checksum.
function pinAsks(p, config) {
  if (!config.scan || typeof config.audit !== "string") return [];
  const listed = jsonAt(p, config.audit)?.entries, entries = Array.isArray(listed) ? listed.filter(e => e && typeof e === "object") : [];
  const copy = corePath(p.root) || "core/", skip = strings(config.scan.skip);
  const skipped = f => f.startsWith(copy) || skip.some(s => s === f || (s.endsWith("/") && f.startsWith(s)));
  return p.files.filter(f => !skipped(f) && entries.some(e => covers(e, f))).flatMap(f => {
    const text = p.read(f);
    const fault = text !== null && pinRead(f, text, config.audit) ? pinFault(entries, config.audit, f, codeOf(f, text)) : null;
    return fault ? [`\`${shown(f)}\` downloads what may be a program, and ${shown(fault.what)}: ${fault.mend}`] : [];
  });
}

export const STEPS = [
  { lead: "12 November 2026, builders named by role", cost: COST.line,
    check: p => {
      const wrong = [];
      if (!/core\/(?:modules|tools)\/other-builders\.md/.test(p.read("AGENTS.md") ?? "")) wrong.push("`AGENTS.md` tells a session of another tool to read `core/tools/other-builders.md` at the start of every task");
      if (/^\|\s*\*Codex's checks\*\s*\|/m.test(p.manifest)) wrong.push("the manifest's row *Codex's checks* is renamed *other builders' checks*");
      return wrong.length ? `${wrong.join("; ")}.` : null;
    },
    partly: "that no builder is given `core/tools/codex.md`, and the names in the size marks, are read by the review" },
  { lead: "12 November 2026, who reviews", cost: COST.read, unread: "whether a project's reviewers differ from the core's is its own choice, which no file states" },
  { lead: "12 November 2026, the core has moved", cost: COST.workflow, unread: "whether the project's orchestrator wakes every day is no file's to say" },
  { lead: "12 November 2026, fetches on Windows and by .NET", cost: COST.check, held: "the licence check", partly: "the idea filed with the core is no file of the project's" },
  { lead: "12 November 2026, the default branch", cost: COST.check, held: "the `core` check" },
  { lead: "12 November 2026, differences", cost: COST.owner, owner: true, unread: "whether a rule of the project's own replaces a module's is a reading of its rules" },
  { lead: "12 November 2026, a slimmer copy", cost: COST.line,
    check: p => {
      const want = /^Paths: .*$/m.exec(fs.readFileSync(path.join(HERE, "setup", "template", "core-manifest.md.tmpl"), "utf8"))?.[0];
      // (the folders the line gained or lost later are their own entries' to ask: 16 November 2026)
      return want && /^Paths:.*\breports\//mu.test(p.manifest) ? `The manifest's "Paths:" line reads, whole: ${want}` : null;
    } },
  { lead: "12 November 2026, a sync and the project's own suites", cost: COST.workflow, check: suitesOnPins,
    partly: "which suites a project's workflows run for a change under `core/` is their own logic, read by the review" },
  { lead: "12 November 2026, the way work is handed over", cost: COST.read, unread: "what a project's rules say of handing work over is a reading of them" },
  { lead: "12 November 2026, a feature may wait for a later stage", cost: COST.line, unread: "whether a line of the manifest's \"Differences\" says this is a reading of its words" },
  { lead: "12 November 2026, the signature check on every pull request", cost: COST.workflow,
    check: p => {
      const file = p.workflows["signatures.yml"];
      if (!file) return null;
      readable({ workflows: { "signatures.yml": file } }, () => true);
      // (`on:` as GitHub takes it: one event's name, a list of names, or a mapping of each to its filters)
      const on = file.yaml?.on;
      const pr = on === "pull_request" || (Array.isArray(on) && on.includes("pull_request")) ? {} : on && typeof on === "object" && !Array.isArray(on) ? on.pull_request : undefined;
      if (!file.yaml || pr === undefined) return "`.github/workflows/signatures.yml` runs on every pull request (`on: pull_request:`), as the core's `signatures.yml` asks of its call.";
      return pr && (pr.paths || pr["paths-ignore"]) ? "`.github/workflows/signatures.yml` has no `paths:` or `paths-ignore:` under `pull_request:`: the core's workflow looks itself whether a package file changed." : null;
    } },
  { lead: "12 November 2026, exact versions", cost: COST.workflow,
    // (the core's licences.yml runs exact-versions.mjs itself; a project that runs the licence script from a workflow of
    // its own runs it beside it)
    check: p => {
      if (!p.files.some(f => /(^|\/)(?:package-lock|npm-shrinkwrap)\.json$/.test(f) && !f.startsWith(corePath(p.root) || "core/") && !f.split("/").includes("node_modules"))) return null;
      if (calls(p, "licences.yml").length) return null;
      const own = runFiles(p, "licences.mjs");
      return own.length && !own.some(f => runFiles(p, "exact-versions.mjs").includes(f))
        ? `The workflow that runs the licence check, ${own.join(", ")}, runs \`node core/scripts/exact-versions.mjs <its config>\` beside it, as the core's \`licences.yml\` does.` : null;
    },
    partly: "that the licence check passes with its new step is held by that check" },
  { lead: "12 November 2026, the security review shown on every pull request", cost: COST.workflow,
    check: p => call(p, "security-review.yml") ? null
      : "The project has a `.github/workflows/security-review.yml` that calls the core's, as `core/setup/template/workflows/security-review.yml.tmpl` has it. In a private repository whose owner does not want it, the manifest's \"Differences\" says so on the owner's word.",
    partly: "that a security review its app did not post is posted as a comment opening \"Security review:\" is a session's practice, read by the review" },
  { lead: "13 November 2026, a security review where the change needs one", cost: COST.read, unread: "what a project's rules and docs say of its security reviews is a reading of them" },
  { lead: "13 November 2026, every file a tool takes its instructions from", cost: COST.read, unread: "whether the project means to hold such a file is its own" },
  { lead: "13 November 2026, the modules a project takes", cost: COST.line, unread: "which modules fit a project is a reading of what it builds" },
  { lead: "13 November 2026, the size marks count the same on every machine", cost: COST.check, held: "the reading-size check" },
  { lead: "13 November 2026, what a project follows", cost: COST.line, unread: "what the project wants to follow is its own choice; with no row, the default holds" },
  { lead: "13 November 2026, the NuGet check", cost: COST.workflow,
    check: p => {
      const projects = p.files.filter(f => PROJECT_FILES.test(f));
      if (!projects.length) return null;
      const wrong = [];
      const locks = [...new Set(projects.map(f => path.posix.join(path.posix.dirname(f), "packages.lock.json")))];
      const missing = locks.filter(l => !p.files.includes(l));
      if (missing.length) wrong.push(`each project file's \`packages.lock.json\` is committed, lock files turned on (\`RestorePackagesWithLockFile\`): ${missing.join(", ")}`);
      if (!call(p, "nuget.yml") && !folded(p, "nuget").length) wrong.push("the project's call to the core's `core.yml` passes `nuget:` the licence check's config, as `core/scripts/init.mjs --nuget` writes it, or a `.github/workflows/nuget.yml` calls the core's `nuget.yml`, or its owner declines the check in the manifest's \"Differences\", as the entry \"16 November 2026, the NuGet check where it can matter\" says");
      let config = null;
      const file = nugetConfig(p);
      try { config = JSON.parse(p.read(file) ?? "null"); } catch { /* (read as missing, below) */ }
      const named = new Set([...(config?.nuget?.ships ?? []), ...(config?.nuget?.tools ?? [])]);
      const unnamed = locks.filter(l => p.files.includes(l) && !named.has(l));
      if (!config?.nuget) wrong.push(`\`${file}\` has a "nuget" part naming each lock file under "ships" or "tools"`);
      else if (unnamed.length) wrong.push(`\`${file}\` names under "nuget.ships" or "nuget.tools": ${unnamed.join(", ")}`);
      return wrong.length ? `${wrong.join("; ")}.` : null;
    } },
  { lead: "13 November 2026, the NuGet check fails from the first day", cost: COST.workflow,
    check: p => {
      return [...given(p, "nuget.yml", "advisory"), ...given(p, "core.yml", "advisory")].some(({ value }) => value === true || value === "true")
        ? "The project's call to the core's `nuget.yml` (or `core.yml`) no longer passes `advisory: true` (it stays only while a fault of the check's own is reported to the core)." : null;
    },
    partly: "whether its audit holds an entry of \"kind\": \"nuget\" for a package that ships is read by the NuGet check where it counts" },
  { lead: "13 November 2026, where NuGet packages come from", cost: COST.check, held: "the NuGet check" },
  { lead: "13 November 2026, the security-review check in a private repository", cost: COST.workflow, unread: "whether the repository is private and what its ruleset requires are GitHub's settings, not files" },
  { lead: "13 November 2026, the core's scripts started through bash", cost: COST.workflow,
    check: p => {
      // (a command, at a line's start or after ; & | or (, that is a file under core/scripts/ by its path alone)
      const bare = /(?:^|[;&|(])\s*(?:\.\/)?core\/scripts\/[\w.-]+/m;
      readable(p, text => text.includes("core/scripts/"));
      const by = Object.entries(p.workflows).filter(([, w]) => Object.values(w.yaml?.jobs ?? {}).some(job => (job?.steps ?? [])
        .some(s => typeof s?.run === "string" && bare.test(s.run.split("\n").filter(l => !/^\s*#/.test(l)).join("\n")))));
      return by.length ? `No workflow runs a file under \`core/scripts/\` by its path alone: start it with \`bash\` (a .sh) or \`node\` (a .mjs). In: ${by.map(([f]) => `.github/workflows/${f}`).join(", ")}.` : null;
    } },
  { lead: "13 November 2026, MS-PL waits for the owner's yes", cost: COST.owner, owner: true, unread: "whether an issue for the owner is open is GitHub's, not a file's" },
  { lead: "13 November 2026, .NET's local tools and the fetch before the restore", cost: COST.check, held: "the NuGet check" },
  { lead: "13 November 2026, a game's previews share its origin", cost: COST.line, unread: "what the threat model says of a preview's origin is a reading of it" },
  { lead: "14 November 2026, the size marks' total counts the project's own files", cost: COST.line,
    // (the reading-size check passes and says so in a note, which no run of it turns red: this step reads that note,
    // from the project's own copy of the check, and gives its number)
    check: p => {
      const marks = marksConfig(p);
      const script = path.join(p.root, "core", "scripts", "reading-size.mjs");
      if (!fs.existsSync(script) || p.read(marks) === null) throw new Unread(`no copy of the reading-size check, or no ${marks}, to read`);
      // (the check reads each file its marks name: one the steps' reader would not read is never handed to it; #423)
      let named = {};
      try { named = JSON.parse(p.read(marks))?.read ?? {}; } catch { /* (its own run says what of the marks it cannot read) */ }
      const unsafe = Object.keys(named && typeof named === "object" ? named : {}).filter(f => !p.safe(f));
      if (unsafe.length) throw new Unread(`${marks} names ${unsafe.map(f => `\`${shown(f)}\``).join(", ")}, which is no regular file of the project's own of at most ${READ_MOST} bytes`);
      const r = spawnSync(process.execPath, [script, marks], { cwd: p.root, encoding: "utf8", env: { ...process.env, SIZES_BASE: "" } });
      // (a run that never reached its end, where its notes and its verdict are given, read nothing: reported as not
      // read, never as done. It ends passing with its "ok" line, or failing with its verdicts alone, every line of its
      // errors one, and none of the refusals it gives before it reads: no config named, one that is no JSON or of the
      // wrong shape, or no base to compare with)
      const out = `${r.stdout}`, lines = `${r.stderr}`.split(/\r?\n/).filter(Boolean);
      const early = /^FAIL: (no config was named|.* could not be read as JSON|.* is not in the form the check reads|\S+ is not a commit here)/;
      const ended = !r.error && (r.status === 0 ? /^ok {3}read by every session/m.test(out)
        : r.status === 1 && lines.length > 0 && lines.every(l => l.startsWith("FAIL: ") && !early.test(l)));
      if (!ended) throw new Unread(`the reading-size check did not run to its end on ${marks}`);
      const to = /set it to (\d+) \(core\/setup\/sync-notes\.md, 14 November 2026\)/.exec(out)?.[1];
      return to ? `The "total" in \`${marks}\` is set to ${to}, the number the reading-size check's note gives, so the project keeps the room it had and the core's copy is held by the core's own cap.` : null;
    } },
  { lead: "14 November 2026, a listed name in a commit's author", cost: COST.check, held: "the personal-terms check" },
  { lead: "15 November 2026, every step has its check", cost: COST.check, unread: "it asks that the steps above be run, which every sync from this one on does by itself" },
  { lead: "15 November 2026, the progress file holds order only", cost: COST.read,
    // (a mark of its own is one below the general mark, "each"; a file under a quarter of that has had no time to fill,
    // and its first trim, which sets the mark, comes once it passes it: the general mark holds there till then)
    check: p => {
      const file = progressOf(p.manifest), marksAt = marksConfig(p);
      const text = p.read(file);
      let marks = null;
      try { marks = JSON.parse(p.read(marksAt) ?? "null"); } catch { /* (read as missing, below) */ }
      if (text === null || !(Number.isInteger(marks?.each) && marks.each > 0 && marks.read && typeof marks.read === "object"))
        throw new Unread(`no ${file}, or no ${marksAt} with its "each" and "read", to read`);
      const mark = marks.read?.[file], bytes = Buffer.byteLength(text);
      if ((Number.isInteger(mark) && mark < marks.each) || bytes < marks.each / 4) return null;
      return `Trim \`${file}\` once, in a pull request of its own: each finished entry leaves it (its pull request and issue keep it), each entry says only what is next and points to its pull requests for what was done, and each line of a queued issue holds its issue, who builds it and what it waits on, nothing more (\`core/roles/shared/inbox.md\`, "The *progress file* holds order only"). Then give it a mark of its own under "read" in \`${marksAt}\`: a number of bytes the project chooses, below "each" (${marks.each}) and at least its size after the trim.`;
    } },
  { lead: "15 November 2026, the owner's inbox where issues cannot be reached", cost: COST.read, unread: "whether issues can be read and written here is GitHub's answer, not a file's: `core/scripts/inbox.mjs` asks it, and each sync runs it from the next one on" },
  { lead: "15 November 2026, labels and openers", cost: COST.read, unread: "whether the labels stand and the issues and comments carry them is GitHub's answer, not a file's: `core/scripts/labels.mjs` asks it and says each mend, and each sync runs it from the next one on; the issue forms' \"Found while:\" line is a difference `core/scripts/fresh.mjs` lists" },
  { lead: "16 November 2026, the daily look", cost: COST.workflow, unread: "whether the project's daily job is to run, or its orchestrator carries the look, is no file's to say, as of the core has moved; where a `look.yml` is missing, `core/scripts/fresh.mjs` lists it at every sync, and the old daily job runs the look meanwhile" },
  { lead: "16 November 2026, the line that says what a pull request waits on", cost: COST.check, held: "the description check" },
  { lead: "16 November 2026, choices that are hard to undo", cost: COST.read, unread: "which of a project's choices are hard to undo is a reading of the project, not a file's to say; where its *choice records* are missing, `core/scripts/fresh.mjs` lists the file at every sync, and `core/scripts/choices.mjs` lists the records it holds" },
  { lead: "16 November 2026, an agent's own tools listed", cost: COST.line,
    // (the agent-tools check's own reading, with a missing list read as an empty one: what it would fail once written.
    // The core's licences.yml runs the check itself; a project that runs the licence script from a workflow of its own
    // runs it beside it, as of exact versions, and the config is the one that workflow passes: check-configs.mjs)
    check: p => {
      const own = calls(p, "licences.yml").length ? [] : runFiles(p, "licences.mjs");
      const beside = own.some(f => runFiles(p, "agent-tools.mjs").includes(f));
      const file = licenceConfig(p);
      let config = null;
      try { config = JSON.parse(p.read(file) ?? "null"); } catch { /* (read as no list, below) */ }
      // (with the core's packages not installed, a Codex config cannot be read: the step says so, with the install, and
      // every other step is still told, as of a key given twice)
      if (p.read(".codex/config.toml") !== null && !installed("smol-toml")) return `The core's packages are not installed, so \`.codex/config.toml\` could not be read for the tools it configures: run \`node ${corePath(p.root) || "core/"}scripts/install.mjs\`, then \`node ${corePath(p.root) || "core/"}scripts/steps.mjs\` again.`;
      const head = readProject(p.root), list = listed(config, file) ?? { keys: new Set(), problems: [] };
      const wrong = [...head.problems, ...(({ problems, pins, sources }) => [...problems, ...[...pins, ...sources].map(([, problem]) => problem)])(toolsCheck(head, list, kitHooks(), file))];
      if (own.length && !beside) wrong.push(`the workflow that runs the licence check, ${own.join(", ")}, runs \`node core/scripts/agent-tools.mjs ${file}\` beside it, as the core's \`licences.yml\` does`);
      return wrong.length ? `List under "agentTools" in \`${file}\` every plug-in, tool server, skill and hook the project configures for its agents beyond the starter kit's hooks, each as { "kind", "name", "publisher", "version" }, a plug-in or tool server at one exact version, the one its configuration pins where it can pin one, or take out what nobody meant to configure; and see that its check runs: ${wrong.join("; ")}` : null;
    } },
  { lead: "16 November 2026, how code is put together", cost: COST.config, check: shapeWritten,
    partly: "which folders hold the project's code, which files are its tests and what its systems are is a reading of the project, which its audit's first question answers" },
  { lead: "16 November 2026, hostile tests for every named input", cost: COST.read, check: hostileTests,
    partly: "whether every input is listed, and whether its tests try each case, is a reading of the project, held by the security review" },
  { lead: "16 November 2026, secret scanning with push protection", cost: COST.read, unread: "whether secret scanning and its push protection are on is GitHub's setting, not a file's: `gh api repos/<owner>/<repo>` answers it under `security_and_analysis`, and the entry says how a session switches them on or names them to the owner" },
  { lead: "16 November 2026, the NuGet check where it can matter", cost: COST.workflow, check: nugetPathsHold,
    partly: "whether the repository is private is GitHub's setting, not a file's; the starter kit now runs a private project's NuGet check as a step of `core.yml`'s one job (17 November 2026), so `core/scripts/fresh.mjs` lists that call, not these `paths:`" },
  { lead: "16 November 2026, what a screen is held to", cost: COST.read, unread: "whether people use a project through a screen is a reading of what it builds, not a file's to say; where they do, its *direction* is the first step of its next pull request that changes a screen (`core/tasks/screens.md`, point 1), and the critique asks for it there" },
  { lead: "16 November 2026, how strong the tests are", cost: COST.workflow, check: strengthNamed,
    partly: "which mutation tool fits the project's language is a reading of the project; the row says it, or `none` with its reason" },
  { lead: "16 November 2026, a file for each role, and the script that says what to read", cost: COST.line,
    check: p => {
      const wrong = [];
      if (!/^Paths:.*\broles\//mu.test(p.manifest)) wrong.push('add `roles/` to the folders the "Paths:" line of `core-manifest.md` names, so that it reads as `core/README.md`, "The manifest\'s format", gives it');
      if (!/^@core\/roles\/builder\.md[ \t]*$/mu.test(p.read("AGENTS.md") ?? "")) wrong.push("add the line `@core/roles/builder.md` to the `@` lines of `AGENTS.md`, after the floor's, and to each entry file the project holds the line `core/scripts/entry-files.mjs` then names");
      return wrong.length ? `In one pull request, ${wrong.join("; and ")}.` : null;
    },
    partly: "whether the project's own folders have their kind of task in `checks/reading.json` is a reading of its folders; the sentence of `AGENTS.md` that names the script, step 2 of its \"Starting a task\" and the issue forms' \"What to read\" are differences `core/scripts/fresh.mjs` lists; the line `Read for it:` is held by the description check" },
  { lead: "16 November 2026, the tests a change can reach", cost: COST.workflow, check: selectionRuns,
    partly: "how the project's runner is told the files `RUN` names is the project's own, and which tests are its proof is a reading of the project" },
  { lead: "16 November 2026, the rules in folders that say who reads them or when", cost: COST.line, check: movedPaths,
    partly: "a path the project builds from parts, or names in a file of no text, is no match a check finds" },
  { lead: "16 November 2026, no workflow gives a key twice", cost: COST.workflow, check: keysOnce },
  { lead: "16 November 2026, how done will be judged", cost: COST.line, unread: "whether a project's users notice its changes is a reading of what it builds; where they do, a manifest whose \"Modules:\" is a list takes `done-when.md`, and the idea form's heading comes as `core/scripts/fresh.mjs` lists it" },
  { lead: "16 November 2026, a project in several repositories", cost: COST.line,
    check: p => {
      const { taken, notTaken } = modulesOf(p.manifest);
      return taken === "all" || taken?.has("repositories.md") || notTaken.has("repositories.md") ? null
        : 'In one small pull request, add `repositories.md` to the "Modules:" line of `core-manifest.md` where the project is, or may become, more than one repository, or else add it to the line "Not taken:" under it as "`repositories.md` (one repository, which no library carries the core into)".';
    } },
  { lead: "16 November 2026, what a game is for", cost: COST.read, unread: "whether a project is a game, and whether its *game page* says what the game is for, is a reading of what it builds; the page is written in the game's next pull request that adds a feature (`core/tasks/game-design.md`, \"Every game says what it is for, on one page\"), not at the sync, and the design check reads the feature against it there" },
  { lead: "16 November 2026, milestones named in order", cost: COST.line, unread: "which modules fit a project is a reading of what it builds, as of the modules a project takes; where the manifest's list neither takes `planning.md` nor leaves it out, `core/scripts/manifest-reads.mjs` reports it on every pull request, and the milestones themselves are the file's writer's next planning task" },
  { lead: "16 November 2026, corrections counted and the outcomes read", cost: COST.line,
    unread: "whether the repository holds a label is GitHub's, in no file: the labels check run at each sync reports the label `correction` missing, its mend `core/scripts/labels.mjs --make`; the cost line is held by the description check, and the bug form's line is a difference `core/scripts/fresh.mjs` lists" },
  { lead: "16 November 2026, the agent tools' files read for copies and pointers", cost: COST.config, check: toolFilesListed },
  { lead: "16 November 2026, checks once a pull request is ready", cost: COST.workflow, check: readyOnlyHolds,
    partly: "whether the repository is private is GitHub's setting, not a file's: `core/scripts/fresh.mjs`, which every sync runs, lists the trigger and the condition a private project's calls lack" },
  { lead: "16 November 2026, a new package looked up", cost: COST.workflow,
    check: p => {
      // (a project that calls the core's licences.yml or nuget.yml takes the lookup with the call; one that runs the
      // checks from a workflow of its own, as a private repository does, or a NuGet project whose sources need a
      // sign-in, adds the step beside them: the npm lookup where it runs the exact-versions check, the NuGet lookup
      // where it runs the NuGet check)
      const wrong = Object.entries(p.workflows).flatMap(([f, w]) => {
        const jobs = jobsOf(w, p.read), at = `\`.github/workflows/${shown(f)}\``, copy = corePath(p.root) || "core/";
        // (a workflow this reader cannot read as YAML, whose words name a package check, is said, never taken as done)
        if (!w.yaml?.jobs && /(?:exact-versions|nuget|nuget-fetch)\.mjs/u.test(w.text ?? "")) return [`${at} cannot be read as YAML here, so where it runs its package checks and their lookups cannot be told: write it as plain YAML (quoted keys and values, no anchors)`];
        // (each config a check is given is matched by a lookup given the same config, since the lookup reads only the
        // lock files of the config it is given)
        // (a config named only when the workflow runs, "$CONFIG", may name another file in each job: there the lookup is
        // looked for in the check's own job alone)
        const configs = (...names) => jobs.flatMap(j => j.steps.flatMap(step => step.cmds.flatMap(c => names.flatMap(n => (running(c, n, undefined, copy) ? [{ cfg: placed(configOf(c, n, copy), step.dir), job: j, step }] : [])))));
        const within = ({ cfg, job }) => (/[$%]/u.test(cfg ?? "") ? [job] : jobs);
        const looked = (flag, at) => within(at).some(j => j.steps.some(st => lookupOf(st, flag, copy, at, j)));
        return [
          configs("exact-versions.mjs").some(at => !looked(false, at)) ? `in ${at}, for each config \`${copy}scripts/exact-versions.mjs\` is given, add a step that runs \`node ${copy}scripts/lookup.mjs\` with the same config, ${FIRST(copy)}` : null,
          configs("nuget.mjs", "nuget-fetch.mjs").some(at => !looked(true, at)) ? `in ${at}, for each config \`${copy}scripts/nuget.mjs\` is given, add a step that runs \`node ${copy}scripts/lookup.mjs\` with the same config and \`--nuget\`, ${FIRST(copy)}` : null,
          jobs.some(j => !j.deep && j.steps.some(st => st.counts && looksUp(st.cmds[0], undefined, copy))) ? `in ${at}, which runs the lookup, give its checkout \`fetch-depth: 2\` and no \`ref:\`` : null,
          ...[...new Set(jobs.flatMap(j => j.unread))].map(f => `in ${at}, the local action \`${shown(f)}\` cannot be read whole (no YAML, or past ${INLINED_MOST} steps in all its actions call), so whether it runs a package check cannot be told: write it as YAML, its actions calling fewer`),
        ].filter(Boolean);
      });
      return wrong.length ? `On every pull request, ${wrong.join("; ")}; each lookup as a step of its own that fails where it fails (its step's one command, under bash or sh, with no \`if:\` or \`continue-on-error\` on the step or its job), in a workflow a pull request starts, its checkout with \`fetch-depth: 2\` holding the pull request's base, which the lookup reads against.` : null;
    },
    partly: "a project that calls the core's `licences.yml` or `nuget.yml` takes the step with the call, and the check passing is held by that check" },
  { lead: "17 November 2026, the checks as one job", cost: COST.workflow, check: oneJobHolds,
    partly: "whether the repository is private, and whether a ruleset requires a check by a name the change takes away, are GitHub's settings, not files: `core/scripts/fresh.mjs`, which every sync runs, lists the one call a project's calls differ from, and a required check's name is the owner's to move" },
  { lead: "17 November 2026, a team's owners read from the host", cost: COST.workflow, unread: "whether an account the call to `security-review.yml` names is one the host lets write is GitHub's answer, not a file's: `gh api repos/<owner>/<repo>/collaborators/<login>/permission`" },
  { lead: "17 November 2026, a choice record argued in full", cost: COST.check, held: "the choice records' check" },
  { lead: "17 November 2026, what the project would be built on today", cost: COST.record,
    // (the record of core/tasks/choices.md, "What the project would be built on today", in the *choice records*: its
    // heading's end, and the issue its line "The suggestion:" names; or no record that lacks the lines that module's
    // process writes, a new project's, and one with no record yet, among them: a done that holds only until a first audit
    // records the choices the project already made, on lines "Stood before:", and the step reads not done again)
    check: p => {
      const file = choicesAt(p.manifest);
      if (!file) throw new Unread("the *choice records* the manifest names is no plain path inside the project");
      const text = p.read(file), found = parseChoices(text ?? "");
      if (found.records.some(r => r.today && r.suggestion)) return null;
      if (found.records.every(r => !r.lacks.length)) return null;
      return `Run once the process of \`core/tasks/choices.md\`, "What the project would be built on today", in a pull request of its own: write in \`${file}\` a record headed \`## Choice: \` and what the project is built on, ending "judged again as if written today", argued on its lines \`Looked for:\`, \`The blind pick:\` and \`The judgment:\`, with the second judgment, what a move would take and gain here, apart; file one issue to the project's owner, labelled \`enhancement\`, saying what the pick would have been and, apart, what a move would cost and gain; and write that issue's number on the record's line \`The suggestion: #<its number>\`.`;
    } },
  { lead: "17 November 2026, packages from the registry, the week's wait and pinned downloads", cost: COST.check, check: packagesHeld },
  { lead: "17 November 2026, held packages looked up again", cost: COST.read, unread: "whether a package has gone stale is its registry's answer on the day, and GitHub's, not a file's: the session that syncs runs `node core/scripts/held.mjs` once and puts what it prints in the sync pull request's description, each package gone stale a task; the scheduled look runs it again each month" },
  { lead: "18 November 2026, the core's packages installed from its lock file", cost: COST.workflow, check: installsFirst,
    partly: "that a job reaching a script of the copy through the project's own npm or shell script installs first is read by the review" },
  { lead: "18 November 2026, another publisher's code named in a lock file", cost: COST.line, unread: "how a project loads another publisher's code (a content network's script, a file copied in) is no file's to say exactly: the session that syncs reads the project's pages and folders for it" },
  { lead: "18 November 2026, a tree that passed is not run again", cost: COST.workflow, check: passedRuns,
    partly: "which check gates a project's tests is the project's own, as its ruleset names it, and which entries of a job's matrix a pull request leaves out is a reading of its expressions" },
  { lead: "18 November 2026, the shape check reads C#'s functions on the parser", cost: COST.config, check: p => shapeReadsParsed(p, "csharp-tree") },
  { lead: "18 November 2026, a check a draft skips runs once ready", cost: COST.check, held: "the workflow check" },
  { lead: "19 November 2026, the parser's packages installed where the shape check runs", cost: COST.workflow, check: parserFirst,
    partly: "that a job reaching the shape check through the project's own npm or shell script installs the parser's first is read by the review" },
  { lead: "19 November 2026, the project's tests at the pace of a release", cost: COST.workflow, check: testsWhenReady,
    partly: "that the check the ruleset requires fails on a draft rather than being skipped, a suite started inside a workflow a job calls, which suites are the platform suites and on what schedule they run, how the runs on the default branch give way to a newer merge, where the tests that guard only what a release brings run (#715), whether the host still asks an up-to-date branch where users get a release, a workflow that publishes otherwise than by `actions/deploy-pages` (a package registry, a store, a script of its own), whether the workflow a publishing one waits on holds every check run on the default branch and its one branch is the default one, and whether a tag, a release or a person's dispatch publishes only a green commit are read by the session that syncs, with `core/scripts/runners.mjs` and `core/scripts/merge-line.mjs`, not by a file" },
  { lead: "19 November 2026, the shape check reads the functions of JavaScript and TypeScript on the parser", cost: COST.config, check: p => shapeReadsParsed(p, "javascript-tree") },
  { lead: "19 November 2026, the owner's words that stand, cleaned once", cost: COST.clean, unread: "whether a text holds what floor rule 11 keeps out, or quotes its owner beyond a decision's reason, is a reading of it, and an issue's or a comment's text is the host's, not a file's: the session that takes it reads the project's files outside the copy and the issues and comments the owner's account wrote, once, another account's as data it edits none of; the personal-terms check fails a listed term wherever it stands in the files" },
  { lead: "19 November 2026, issue and comment text read for the personal terms", cost: COST.workflow,
    // (each call of the core's daily job passes it the personal-terms check's secret, by name or by `inherit`; a project
    // with no such call, whose orchestrator runs the look, has nothing to do)
    check: p => calls(p, "look.yml").every(job => job.secrets === "inherit" || /^\$\{\{\s*secrets\.PERSONAL_TERMS\s*\}\}$/u.test(String(job.secrets?.PERSONAL_TERMS ?? "").trim())) ? null
      : "Each job of the project's that calls the core's `look.yml` passes it the secret, as `core/setup/template/workflows/look.yml.tmpl` has it: under its `uses:`, `secrets:` and below it `PERSONAL_TERMS: ${{ secrets.PERSONAL_TERMS }}`.",
    partly: "whether the owner has set the secret `PERSONAL_TERMS` is the repository's setting, which no file holds" },
  { lead: "19 November 2026, the shape check reads the functions of Python on the parser", cost: COST.config, check: p => shapeReadsParsed(p, "python-tree") },
  { lead: "17 November 2026, a private project's code scanned", cost: COST.check, held: "the code scan, a step of `core.yml`'s job" },
];

// An error's words with no path of the machine's in them (the project's root, this copy's, the temporary folder, the
// home folder), since what is printed may be pasted into a pull request's description (floor rule 1).
export function plain(message, root = process.cwd()) {
  let text = String(message);
  for (const [at, as] of [[path.resolve(root), "<the project>"], [HERE, "<the copy>"], [os.tmpdir(), "<a temporary folder>"], [os.homedir(), "<home>"]])
    if (at && at.length > 1) for (const spelling of new Set([at, at.replace(/\\/g, "/")])) text = text.split(spelling).join(as);
  return text;
}

// Whether the manifest declares a step undone on purpose: a line of its "Differences" that quotes the step's lead.
export const declared = (p, step) => p.differences.some(l => l.includes(`"${step.lead}"`));

// The steps not done in the project at `root`: each { lead, owner, cost, mend }. A check that throws is not read as
// done: it is reported, with what went wrong.
export function notDone(root, steps = STEPS) {
  const p = project(root);
  const out = [];
  for (const step of steps) {
    if (!step.check || declared(p, step)) continue;
    let mend;
    try { mend = step.check(p); } catch (e) { mend = `Its check could not read the project (${plain(e.message, root)}): read the entry in \`core/${NOTES}\` against it.`; }
    if (mend) out.push({ lead: step.lead, owner: !!step.owner, cost: step.cost, mend });
  }
  out.unread = p.unread;
  return out;
}

// The report a sync prints for its pull request's description: the steps not done, and nothing where all are.
export function report(missed) {
  const unread = missed.unread?.length ? `\n\nLeft unread, each past ${READ_MOST} bytes, which no file a step reads reaches: ${missed.unread.map(f => `\`${shown(f)}\``).join(", ")}. A step that reads one may have read it as missing: make it smaller, or take it out of git if it is no file of the project's.` : "";
  if (!missed.length) return `Every step a check reads is done (\`core/scripts/steps.mjs\`).${unread}`;
  return [`Steps not done (\`core/scripts/steps.mjs\`; core/${NOTES}): each a task the project's agents take, in a pull request of its own, none waiting on another${missed.some(m => m.owner) ? "; one marked \"the owner's\" waits on the owner and is labelled so" : ""}.`,
    ...missed.map(m => `- ${m.lead}${m.owner ? " (the owner's)" : ""}: ${m.mend}`)].join("\n") + unread;
}

if (started(import.meta.url)) {
  try {
    console.log(report(notDone(process.cwd())));
  } catch (e) {
    console.error(`FAIL: the steps could not be read here (${plain(e.message)}): run it from the project's root, a git repository`);
    process.exitCode = 1;
  }
}
