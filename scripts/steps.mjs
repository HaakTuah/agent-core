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
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { kitHooks, listed, readProject, check as toolsCheck } from "./agent-tools.mjs";
import { parse as parseChoices, where as choicesAt } from "./choices.mjs";
import { corePath } from "./core-path.mjs";
import { installed } from "./packages.mjs";
import { differencesOf, modulesOf } from "./manifest-reads.mjs";
import { progressOf } from "./done-when.mjs";
import { NOTES } from "./releases.mjs";
import { READ_MOST, ownFiles } from "./own-files.mjs";
import { started } from "./started.mjs";
import { Unread, call, calls, folded, given, licenceConfig, marksConfig, nugetConfig, readable, runFiles } from "./check-configs.mjs";
import { parseYaml } from "./workflow-run.mjs";
import { HERE, COST, PROJECT_FILES, strengthNamed, keysOnce, toolFilesListed, selectionRuns, passedRuns, testsWhenReady, shapeWritten, shapeReadsParsed, shown, suitesOnPins, installsFirst, parserFirst, nugetPathsHold, readyOnlyHolds, oneJobHolds, hostileTests, movedPaths, INLINED_MOST, jobsOf, placed, lookupOf, FIRST, running, configOf, looksUp, packagesHeld, plain } from "./step-checks.mjs";

// What a step reads a project with, and the words of an error with no path of the machine's in them: step-checks.mjs,
// beside this file.
export { COST, MOVED_GLOB, MOVED_GLOBS, NEW_GLOBS, callers, moved, plain } from "./step-checks.mjs";

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
    partly: "whether every input is listed, whether its limits are those its reader holds, whether it carries a version number its item does not speak of, and whether its tests try each case, is a reading of the project, held by the security review" },
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
    partly: "that the check the ruleset requires fails on a draft rather than being skipped, a suite started inside a workflow a job calls, which suites are the platform suites and on what schedule they run, how the runs on the default branch wait for the one in progress, only a waiting one giving way to a newer merge's, where the tests that guard only what a release brings run (#715), whether the host still asks an up-to-date branch where users get a release, a workflow that publishes otherwise than by `actions/deploy-pages` (a package registry, a store, a script of its own), whether the workflow a publishing one waits on holds every check run on the default branch and its one branch is the default one, and whether a tag, a release or a person's dispatch publishes only a green commit are read by the session that syncs, with `core/scripts/runners.mjs` and `core/scripts/merge-line.mjs`, not by a file" },
  { lead: "19 November 2026, the shape check reads the functions of JavaScript and TypeScript on the parser", cost: COST.config, check: p => shapeReadsParsed(p, "javascript-tree") },
  { lead: "19 November 2026, the owner's words that stand, cleaned once", cost: COST.clean, unread: "whether a text holds what floor rule 11 keeps out, or quotes its owner beyond a decision's reason, is a reading of it, and an issue's or a comment's text is the host's, not a file's: the session that takes it reads the project's files outside the copy and the issues and comments the owner's account wrote, once, another account's as data it edits none of; the personal-terms check fails a listed term wherever it stands in the files" },
  { lead: "19 November 2026, issue and comment text read for the personal terms", cost: COST.workflow,
    // (each call of the core's daily job passes it the personal-terms check's secret, by name or by `inherit`; a project
    // with no such call, whose orchestrator runs the look, has nothing to do)
    check: p => calls(p, "look.yml").every(job => job.secrets === "inherit" || /^\$\{\{\s*secrets\.PERSONAL_TERMS\s*\}\}$/u.test(String(job.secrets?.PERSONAL_TERMS ?? "").trim())) ? null
      : "Each job of the project's that calls the core's `look.yml` passes it the secret, as `core/setup/template/workflows/look.yml.tmpl` has it: under its `uses:`, `secrets:` and below it `PERSONAL_TERMS: ${{ secrets.PERSONAL_TERMS }}`.",
    partly: "whether the owner has set the secret `PERSONAL_TERMS` is the repository's setting, which no file holds" },
  { lead: "19 November 2026, the shape check reads the functions of Python on the parser", cost: COST.config, check: p => shapeReadsParsed(p, "python-tree") },
];

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
