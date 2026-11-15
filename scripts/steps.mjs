// What a release asks of a project, step by step (AGENTS.md, "Nothing locks a project"; core archive 215): each entry
// of setup/sync-notes.md has a step here, by the entry's lead (its date and its name), with roughly what it costs and
// how it is told done. A step is told done one of three ways, each exact and none by guessing:
//   - "check": this script reads the project and answers done, or not done with the mend, in words a session acts on
//     with no rule file open;
//   - "held": a check of the project's own, named, fails where the step is not done, and its failure says the mend;
//   - "unread": no check reads it exactly, and the step says why; a staged case holds it (#235).
// A step only the project's owner can do says so ("owner"): it is advisory, labelled as waiting on the owner, and the
// rest goes on. A step the project leaves undone on purpose is declared in its manifest's "Differences", on its owner's
// word, by a line that quotes the step's lead ("13 November 2026, the core has moved"): such a step is not reported.
// The sync runs this from the copy it has just written (sync.mjs, beside this file), so a sync reports every step
// not done, a standing one too, and never fails over one: nothing waits on a step, and running it twice changes
// nothing. It reads only. Node's own modules and git only.
//
//   node core/scripts/steps.mjs          from a project's root: the steps not done, each with its mend; nothing else
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "./core-address.mjs";
import { NOTES } from "./releases.mjs";
import { started } from "./started.mjs";
import { parseYaml } from "./workflow-run.mjs";

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Roughly what a step costs a project where it is not done yet (a step done costs nothing).
export const COST = {
  check: "nothing while its check passes; else what the failure says, in the pull request it fails",
  line: "a line or two of a protected file: one small pull request of the trusted builder's",
  workflow: "a workflow's change: one small pull request, with floor rule 3's two security reviews",
  read: "a read of the project's own rules or settings against the entry, and a small pull request where one differs",
  owner: "the owner's yes, asked once; nothing of a session's beyond the ask",
};

// The entries' leads, in the order the notes hold them: "12 November 2026, builders named by role".
export const leads = text => [...String(text).matchAll(/^- \*\*([^*]+?)\.\*\*/gm)].map(m => m[1]);

// The project at `root`, as the checks read it: its files as git lists them (committed or not, ignored ones left out),
// a file's text (null where it is not there), its manifest's slots and differences, and its workflows' YAML.
export function project(root) {
  const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 })
    .split("\0").filter(f => f && fs.existsSync(path.join(root, f)));
  // (a path the project's own files name is read only inside the project: one that leads out of it reads as missing)
  const inside = f => { const to = path.resolve(root, f), rel = path.relative(path.resolve(root), to); return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? to : null; };
  const read = f => { const to = inside(f); if (!to) return null; try { return fs.readFileSync(to, "utf8").replace(/\r\n/g, "\n"); } catch { return null; } };
  const manifest = read("core-manifest.md") ?? "";
  const differences = (/^## Differences\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(manifest)?.[1] ?? "").split("\n").filter(l => l.trim());
  const workflows = Object.fromEntries(listed.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f)).map(f => {
    let yaml = null;
    try { yaml = parseYaml(read(f)); } catch { /* (a workflow this reader cannot read: a check that needs it says so) */ }
    return [f.slice(".github/workflows/".length), { text: read(f), yaml }];
  }));
  return { root, files: listed, read, manifest, differences, workflows };
}

// A workflow the core's reader cannot read (workflow-run.mjs reads the forms the core's own workflows use): a check that
// would read it throws, naming it, so the step is reported as not read, never as done or as missing.
export class Unread extends Error {}
const readable = (p, mentions) => {
  const unread = Object.entries(p.workflows).filter(([, w]) => !w.yaml && mentions.test(w.text ?? "")).map(([f]) => `.github/workflows/${f}`);
  if (unread.length) throw new Unread(`the core's reader cannot read ${unread.join(", ")}, in a form it does not know`);
};

// A project's calls to a workflow of the core's, by the workflow's name: each its job (uses and with); and the first.
export const calls = (p, name) => (readable(p, new RegExp(`/\\.github/workflows/${name.replace(/\./g, "\\.")}@`, "i")), Object.values(p.workflows))
  .flatMap(({ yaml }) => Object.values(yaml?.jobs ?? {}))
  .filter(job => typeof job?.uses === "string" && job.uses.toLowerCase().startsWith(`${CORE}/.github/workflows/${name}@`.toLowerCase()));
export const call = (p, name) => calls(p, name)[0] ?? null;

const PROJECT_FILES = /\.(cs|fs|vb)proj$/;
// The licence check's config a project names (its NuGet check's input, else the starter kit's path).
const licenceConfig = p => call(p, "nuget.yml")?.with?.config ?? call(p, "licences.yml")?.with?.config ?? "checks/licences.json";

export const STEPS = [
  { lead: "12 November 2026, builders named by role", cost: COST.line,
    check: p => {
      const wrong = [];
      if (!/core\/modules\/other-builders\.md/.test(p.read("AGENTS.md") ?? "")) wrong.push("`AGENTS.md` tells a builder of another provider to read `core/modules/other-builders.md` at the start of every task");
      if (/^\|\s*\*Codex's checks\*\s*\|/m.test(p.manifest)) wrong.push("the manifest's row *Codex's checks* is renamed *other builders' checks*");
      return wrong.length ? `${wrong.join("; ")}.` : null;
    },
    partly: "that no builder is given `core/modules/codex.md`, and the names in the size marks, are read by the review" },
  { lead: "12 November 2026, who reviews", cost: COST.read, unread: "whether a project's reviewers differ from the core's is its own choice, which no file states" },
  { lead: "12 November 2026, the core has moved", cost: COST.workflow, unread: "whether the project's orchestrator wakes every day is no file's to say" },
  { lead: "12 November 2026, fetches on Windows and by .NET", cost: COST.check, held: "the licence check", partly: "the idea filed with the core is no file of the project's" },
  { lead: "12 November 2026, the default branch", cost: COST.check, held: "the `core` check" },
  { lead: "12 November 2026, differences", cost: COST.owner, owner: true, unread: "whether a rule of the project's own replaces a module's is a reading of its rules" },
  { lead: "12 November 2026, a slimmer copy", cost: COST.line,
    check: p => {
      const want = /^Paths: .*$/m.exec(fs.readFileSync(path.join(HERE, "setup", "template", "core-manifest.md.tmpl"), "utf8"))?.[0];
      return want && !p.manifest.split("\n").includes(want) ? `The manifest's "Paths:" line reads, whole: ${want}` : null;
    } },
  { lead: "12 November 2026, a sync and the project's own suites", cost: COST.workflow, unread: "which suites a project's workflows run for which change is their own logic" },
  { lead: "12 November 2026, the way work is handed over", cost: COST.read, unread: "what a project's rules say of handing work over is a reading of them" },
  { lead: "12 November 2026, a feature may wait for a later stage", cost: COST.line, unread: "whether a line of the manifest's \"Differences\" says this is a reading of its words" },
  { lead: "12 November 2026, the signature check on every pull request", cost: COST.workflow,
    check: p => {
      const file = p.workflows["signatures.yml"];
      if (!file) return null;
      readable({ workflows: { "signatures.yml": file } }, /./);
      const pr = file.yaml?.on?.pull_request;
      if (!file.yaml || pr === undefined) return "`.github/workflows/signatures.yml` runs on every pull request (`on: pull_request:`), as `core/setup/template/workflows/signatures.yml.tmpl` has it.";
      return pr && (pr.paths || pr["paths-ignore"]) ? "`.github/workflows/signatures.yml` has no `paths:` or `paths-ignore:` under `pull_request:`: the core's workflow looks itself whether a package file changed." : null;
    } },
  { lead: "12 November 2026, exact versions", cost: COST.workflow,
    // (the core's licences.yml runs exact-versions.mjs itself; a project that runs the licence script from a workflow of
    // its own runs it beside it)
    check: p => {
      if (!p.files.some(f => /(^|\/)package-lock\.json$/.test(f) && !f.startsWith("core/") && !f.split("/").includes("node_modules"))) return null;
      if (calls(p, "licences.yml").length) return null;
      readable(p, /licences\.mjs/);
      const own = Object.entries(p.workflows).filter(([, w]) => /core\/scripts\/licences\.mjs/.test(w.text ?? ""));
      return own.length && !own.some(([, w]) => /core\/scripts\/exact-versions\.mjs/.test(w.text ?? ""))
        ? `The workflow that runs the licence check, ${own.map(([f]) => `.github/workflows/${f}`).join(", ")}, runs \`node core/scripts/exact-versions.mjs <its config>\` beside it, as the core's \`licences.yml\` does.` : null;
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
      if (!call(p, "nuget.yml")) wrong.push("a `.github/workflows/nuget.yml` calls the core's, as `core/setup/template/workflows/nuget.yml.tmpl` has it");
      let config = null;
      try { config = JSON.parse(p.read(licenceConfig(p)) ?? "null"); } catch { /* (read as missing, below) */ }
      const named = new Set([...(config?.nuget?.ships ?? []), ...(config?.nuget?.tools ?? [])]);
      const unnamed = locks.filter(l => p.files.includes(l) && !named.has(l));
      if (!config?.nuget) wrong.push(`\`${licenceConfig(p)}\` has a "nuget" part naming each lock file under "ships" or "tools"`);
      else if (unnamed.length) wrong.push(`\`${licenceConfig(p)}\` names under "nuget.ships" or "nuget.tools": ${unnamed.join(", ")}`);
      return wrong.length ? `${wrong.join("; ")}.` : null;
    } },
  { lead: "13 November 2026, the NuGet check fails from the first day", cost: COST.workflow,
    check: p => {
      return calls(p, "nuget.yml").some(job => job.with?.advisory === true || job.with?.advisory === "true")
        ? "The project's call to the core's `nuget.yml` no longer passes `advisory: true` (it stays only while a fault of the check's own is reported to the core)." : null;
    },
    partly: "whether its audit holds an entry of \"kind\": \"nuget\" for a package that ships is read by the NuGet check where it counts" },
  { lead: "13 November 2026, where NuGet packages come from", cost: COST.check, held: "the NuGet check" },
  { lead: "13 November 2026, the security-review check in a private repository", cost: COST.workflow, unread: "whether the repository is private and what its ruleset requires are GitHub's settings, not files" },
  { lead: "13 November 2026, the core's scripts started through bash", cost: COST.workflow,
    check: p => {
      // (a command, at a line's start or after ; & | or (, that is a file under core/scripts/ by its path alone)
      const bare = /(?:^|[;&|(])\s*(?:\.\/)?core\/scripts\/[\w.-]+/m;
      readable(p, /core\/scripts\//);
      const by = Object.entries(p.workflows).filter(([, w]) => Object.values(w.yaml?.jobs ?? {}).some(job => (job?.steps ?? [])
        .some(s => typeof s?.run === "string" && bare.test(s.run.split("\n").filter(l => !/^\s*#/.test(l)).join("\n")))));
      return by.length ? `No workflow runs a file under \`core/scripts/\` by its path alone: start it with \`bash\` (a .sh) or \`node\` (a .mjs). In: ${by.map(([f]) => `.github/workflows/${f}`).join(", ")}.` : null;
    } },
  { lead: "13 November 2026, MS-PL waits for the owner's yes", cost: COST.owner, owner: true, unread: "whether an issue for the owner is open is GitHub's, not a file's" },
  { lead: "13 November 2026, .NET's local tools and the fetch before the restore", cost: COST.check, held: "the NuGet check" },
  { lead: "13 November 2026, a game's previews share its origin", cost: COST.line, unread: "what the threat model says of a preview's origin is a reading of it" },
  { lead: "14 November 2026, the size marks' total counts the project's own files", cost: COST.check, held: "the reading-size check (its note gives the mark)" },
  { lead: "14 November 2026, a listed name in a commit's author", cost: COST.check, held: "the personal-terms check" },
  { lead: "15 November 2026, every step has its check", cost: COST.check, unread: "it asks that the steps above be run, which every sync from this one on does by itself" },
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
  return out;
}

// The report a sync prints for its pull request's description: the steps not done, and nothing where all are.
export function report(missed) {
  if (!missed.length) return "Every step a check reads is done (`core/scripts/steps.mjs`).";
  return [`Steps not done (\`core/scripts/steps.mjs\`; core/${NOTES}): each a task the project's agents take, in a pull request of its own, none waiting on another${missed.some(m => m.owner) ? "; one marked \"the owner's\" waits on the owner and is labelled so" : ""}.`,
    ...missed.map(m => `- ${m.lead}${m.owner ? " (the owner's)" : ""}: ${m.mend}`)].join("\n");
}

if (started(import.meta.url)) {
  try {
    console.log(report(notDone(process.cwd())));
  } catch (e) {
    console.error(`FAIL: the steps could not be read here (${plain(e.message)}): run it from the project's root, a git repository`);
    process.exitCode = 1;
  }
}
