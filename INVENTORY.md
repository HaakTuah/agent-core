# The core's parts, and what else does each

The inventory of #534, point 4: a line for each part of the core (each script a workflow or a hook runs, each workflow,
each mechanism), saying what it does, where it must run, what else does it, and a verdict. It grows the inventory of
#486, point 10 (`CHOICES.md`, "Choice: one parser, tree-sitter, carried in the copy, reads every language's structure",
its list "What is written by hand today"), which weighed the readers inside the checks and stays the word on them: a
line here points to it where a part holds such a reader, and weighs the whole part.

It decides nothing by itself. A **replace** or a **try** becomes a line of `QUEUE.md` only on the owner's word, each a
pull request of its own that shows the comparison, old against new (#534, point 2); no tool or package arrives before
#488's points 1, 3, 4 and 5 have merged; and the order is #534's, point 7: the tools that only run first, then the
packages carried in the copy, then the form the rules are delivered in.

Weighed whole: 2026-11-17

**How a line reads.** The part's files, then what it does. *Runs:* where it must run: in a session's hook, in any
session, on the host's runners, on the owner's own computer; a check that may decide a pull request runs in all three
places that hold a session or a runner (#534, point 5). *Else:* what else does the job, found on the web and in the
registries on 17 November 2026, each kept or dropped in a few words, a drop marked as a fact or as an assumption to
measure (`tasks/choices.md`, "a drop says whether it rests on a fact"). *Bugs:* the issues labelled `bug` that name the
part's files, of the 61 so labelled. Then the verdict: **replace** where a maintained tool does the job at the same
level or better, the comparison to be shown when it is made; **try** where only a trial can tell; **keep**, with the
exception of #486, point 6, it rests on: small and stable, nothing fits, fitting costs more than keeping, or it brings
too much. A part that gives way keeps the core's glue (#534, point 10): its lists and baseline, the failure that says
the mend, the word that it could read nothing, and "Nothing locks a project".

**Trials of 17 November 2026,** each in a scratch folder outside the repository, at one exact version, with install
scripts off, nothing committed, as the owner allowed for #486's trial on 16 November:
- *Mutation:* StrykerJS 10.1.1 (its command runner, which starts any command) against `scripts/mutate.mjs`, each given
  one script and its one test. `scripts/mend.mjs`: Stryker 32 faults, 3 survived, 2 s; the core's 4, none survived,
  under 1 s. `scripts/core-path.mjs`: Stryker 211 faults, 63 survived, 118 s; the core's 24, 4 survived, 31 s. Stryker
  installed 176 packages, 65 MB, and writes the report `scripts/strength.mjs` already reads.
- *Copies:* jscpd 5.4.3, one program of 47 MB for each system with no package of its own, over the scripts and the rule
  files in 0.2 s, against `scripts/copies.mjs` in 1 s. At 8 lines it found 2 copies of code, both in tests, where the
  core's check notes 9 runs alike once names are set aside and fails none; over the rule files' prose at 12 tokens it
  found 8 copies where the core's check, at 12 words, finds none. The definitions differ, which point 3 of #534 settles.
- *Workflows:* zizmor 1.32.0, offline, over `.github/workflows/` in 0.1 s: 4 findings of kinds the core's check does not
  read (a trigger it counts as dangerous, a checkout that keeps its credentials, a call it would write another way),
  each for the replacement to judge, and a key given twice refused as a file it cannot read.

## The checks on a pull request

- `scripts/copies.mjs`, `.github/workflows/copies.yml`: fails a run of code (8 lines) or of the rule files' prose (12
  words) that stands in two places, unless its baseline lists it; `copies.yml` runs it and the other checks of the part
  "copies" through `scripts/checks.mjs`. *Runs:* any session and the runners. *Else:* jscpd (MIT, maintained, a program
  for each system, 224 languages, Markdown among them), kept, tried above; PMD's CPD, dropped on fact: a Java runtime;
  Simian, dropped on fact: no licence the Open Source Initiative approves. *Bugs:* 9, and 4 naming `copies.yml`, the
  most of any check. **Try** jscpd for the finding, its definition taking the core's place by default (#534, point 3);
  the baseline and the near-copies the audit reads stay the core's glue. This weighs again the "Kept" of #486's
  inventory, whose reason was the core's own definition.
- `scripts/pointers.mjs`: fails a pointer in the rule files, to a file, a section, a numbered point, a floor rule or an
  archive item, that leads nowhere. *Runs:* any session and the runners. *Else:* lychee (offline, with Markdown's
  anchors), remark-validate-links, markdown-link-check and linkinator, each kept for Markdown's own links and dropped,
  on fact, for the rest: none reads a backticked path, a quoted section, a bold lead or "point 6". *Bugs:* 0. **Try** a
  link checker, run offline, for the form `[text](path)` and a project's own documents (with #486's group 5); **keep**
  the core's own forms: nothing fits, they are the core's.
- `scripts/reading-size.mjs`: fails a file every session reads that passes its mark. *Runs:* any session and the
  runners. *Else:* size-limit and bundlesize, dropped on fact: they weigh a built bundle, not a file read whole. *Bugs:*
  2. **Keep:** nothing fits; what a session reads is the core's own list.
- `scripts/workflows.mjs`: fails a workflow or action in which the word `pull_request_target` stands, and, through
  `scripts/yaml-keys.mjs`, one that gives a key twice. *Runs:* any session and the runners. *Else:* zizmor (MIT, a
  program for each system, its audit `dangerous-triggers` among some 30), kept, tried above; actionlint (MIT, Go, its
  syntax check refusing a key given twice, and, where shellcheck is installed, each step's script), kept; yamllint's
  `key-duplicates`, dropped on fact: Python, and actionlint holds it. *Bugs:* 1. **Replace** with zizmor and actionlint,
  which read far more of floor rule 2 than a word and a key; the core's list of what is forbidden stays its own policy,
  given as the tools' configs, and a finding the core judged safe is allowed there with its reason. This takes
  `yaml-keys.mjs` out of #486's YAML package.
- `scripts/entry-files.mjs`: fails an agent tool's entry file that does not pull in every file `AGENTS.md` names.
  *Runs:* any session and the runners. *Else:* the generators of each tool's rule files (ruler, rulesync), dropped on
  fact: the core keeps one `AGENTS.md` that each tool's file imports, and needs nothing generated. *Bugs:* 0. **Keep:**
  nothing fits; the list of entry files is the core's own.
- `scripts/manifest-reads.mjs`: reports the manifest against the modules, and the README's slots against their marks.
  *Runs:* any session and the runners. *Else:* a schema and one checker of schemas, as #486's last group weighs for the
  settings. *Bugs:* 1. **Keep:** nothing fits; the manifest's form is the core's. Its checks of shape go with #486's
  schemas.
- `scripts/shape.mjs`: fails what is new in how the code is put together: a function past its marks for lines, depth and
  branching, an import on a cycle, a file in no system. *Runs:* any session and the runners. *Else:* Lizard (MIT,
  Python, some 30 languages), dropped on fact: its definitions of a branch are fixed in its code (#519's record);
  ESLint's `complexity` and `max-lines-per-function`, dropped on fact: JavaScript alone; dependency-cruiser (MIT, 18
  packages) and madge, for cycles and boundaries, dropped on fact: JavaScript and TypeScript alone, where the check
  reads C# and Python too. *Bugs:* 3. **Keep:** fitting costs more than keeping, each tool knowing one language or
  fixing its definitions; its readers go to the parser, as #486's group 3 and #519's path say.
- `scripts/choices.mjs`: fails a choice record a pull request adds without its lines, says when the pass is due, and
  reads each sign written in a measure. *Runs:* any session and the runners. *Else:* none found; the decision records'
  tools (adr-tools, log4brains) write records and check no form. *Bugs:* 1. **Keep:** nothing fits; the form is the
  core's.
- `scripts/checks.mjs`: runs the checks that need no secret, part by part, as the workflows do and as a session may by
  hand. *Runs:* any session and the runners. *Else:* a task runner (npm scripts, just, make), dropped on fact: a project
  in another stack has none of npm's, and the others are installs. *Bugs:* 2. **Keep:** small and stable glue.
- `scripts/pr-description.mjs`, `.github/workflows/pr-description.yml`, `.github/workflows/own-description.yml`: fail a
  ready pull request whose description lacks a heading the project names, and, here, the lines the core asks. *Runs:*
  the runners, where the description is; any session given it. *Else:* Danger JS (MIT), its rules written in JavaScript
  and run with a token, dropped on an assumption: fitting costs more than the check; the semantic title actions, dropped
  on fact: a vendor's wrapper (#534, point 6) reading the title alone. *Bugs:* 2, and 1 naming `pr-description.yml`.
  **Keep:** nothing fits; the headings are the core's.
- `.github/workflows/personal-terms.yml`: fails a pull request whose files, commits, title, description or branch hold a
  term of the secret `PERSONAL_TERMS`. *Runs:* the runners, where the secret is. *Else:* gitleaks (MIT, Go), kept: its
  rules may be written when the job runs, from the secret, and it reads text given on its input too; its maker now
  issues only security fixes for it and builds Betterleaks, which reads the same rules (fact, as reported in March
  2026), so the lookup of #488 picks between them; TruffleHog (AGPL-3.0, allowed for a tool that only runs), dropped on
  an assumption: what it adds, checking a secret against the live service, is what a check may not do. *Bugs:* 1.
  **Replace** the matching with gitleaks or its successor, which also brings the scan for secrets that floor rule 1 has
  no check for in a private project (the host's own is paid there); **keep** what is read (each commit's names and
  addresses, the title, the description, the branch) and the exception for commits the host made.
- `scripts/licences.mjs`, `scripts/licence-scan.mjs`, `scripts/licence-installed.mjs`, `scripts/licence-yes.mjs`,
  `.github/workflows/licences.yml`: hold every package the lock files install, and every entry of the audit, to floor
  rule 10's list, with the owner's yes for what is off it. *Runs:* any session and the runners. *Else:* npm's own `npm
  sbom` (each installed package's licence, as SPDX or CycloneDX), kept, as the package system's own tool; licensee
  (Apache-2.0, 10 packages), license-checker-rseidelsohn and CycloneDX's npm tool, kept as the fallback; Trivy's licence
  scan, dropped on fact: its project's build was broken into in March 2026 and its own policy is written in Rego;
  ScanCode, dropped on fact: Python and a large install. *Bugs:* 5, 1 and 1 (15 with the NuGet check's, the most of any
  group). **Replace** the reading underneath with `npm sbom` after the install the check already makes; **keep** the
  policy (the floor's list, the owner's yes, the scan of what no lock file holds) and the HTML reading, which goes with
  #486's licence group.
- `scripts/exact-versions.mjs`: fails a dependency of the project's own written as a range. *Runs:* any session and the
  runners. *Else:* npm's `save-exact`, dropped on fact: it writes exact versions and checks none already written.
  *Bugs:* 1. **Keep:** small and stable, a read of `package.json`.
- `scripts/lookup.mjs`: asks its registry of each package a pull request brings in new, and fails a name the
  registry does not know or one first published days ago, printing the rest for the review (#488, point 1, merged
  later the same day). *Runs:* any session and the runners, with the registry reachable. *Else:* `npm view` and NuGet's
  own API, which it already asks; deps.dev and Socket, dropped on fact: hosted services (#534, point 6); OpenSSF
  Scorecard, dropped on fact: it scores a repository's practices, not whether a name is new, and wants a token.
  *Bugs:* 0. **Keep:** nothing fits; the registries are asked through their own interfaces, and the rule is the core's.
- `scripts/agent-tools.mjs`: fails a plug-in, tool server, skill or hook a project configures for its agents that its
  licence config does not list with a publisher and one exact version. *Runs:* any session and the runners. *Else:* none
  found that reads every tool's own settings. *Bugs:* 2. **Keep:** nothing fits; the list is the core's policy. Its TOML
  reader goes with #486's group 2.
- `.github/workflows/signatures.yml`: installs the packages with their scripts off, runs `npm audit signatures`, and
  reads each installed licence back. *Runs:* the runners, and any session. *Else:* it is npm's own tool already. *Bugs:*
  1. **Keep:** the job is npm's; the core holds only its call.
- `scripts/nuget.mjs`, `scripts/nuget-fetch.mjs`, `scripts/nuget-look.sh`, `.github/workflows/nuget.yml`: for a .NET
  project, every package one exact version under a licence on the list, each read from a package fetched before the pull
  request's build files run. *Runs:* any session with the .NET SDK, and the runners. *Else:* nuget-license (a .NET tool
  that holds packages to a list of licences), kept; `dotnet list package --include-transitive --format json`, kept, for
  the packages; dotnet-project-licenses, dropped on an assumption: less kept up than nuget-license. *Bugs:* 7, 1, 0 and
  4. **Try** nuget-license and the SDK's own list for the reading; **keep** the fetch before the build, which is a
  boundary of the floor's (what a build could write never decides a licence), and the policy.
- `.github/workflows/core.yml`, `scripts/copy-tree.mjs`, `scripts/core-path.mjs`, `scripts/core-address.mjs`: fail a
  project whose copy is not the core, whole, at the commit its manifest pins, or whose calls to the core's workflows are
  pinned elsewhere. *Runs:* the runners, where nothing of the project's runs before it; any session by hand. *Else:* the
  options of #519's record (a submodule, a subtree, a package, a fetched release, the host's reusable workflows,
  vendir), each weighed there. *Bugs:* 3 and 1. **Keep:** #519's record, judged on merit on 17 November.
- `.github/workflows/security-review.yml`, `.github/workflows/own-security-review.yml`, `scripts/security-review.mjs`,
  `scripts/code-review-wait.mjs`, `scripts/clean-merges.mjs`, `scripts/pure-sync.mjs`: give each pull request's head the
  statuses that say whether its security review has run and a running code review has finished, and prove a sync pure.
  *Runs:* the runners, with the host's statuses. *Else:* the host's required reviews, dropped on fact: they wait for a
  person's approval; hosted review bots, dropped on fact: paid on a private repository, and a hosted product (#534,
  point 6). *Bugs:* 5, 2, 0 and 3, and 3 naming the workflow. **Keep:** nothing fits; the reviews are maintained tools
  already, and these hold only the core's policy on them.
- `scripts/general.mjs`: fails, in the floor and the modules, a word true only for some projects, a gendered pronoun for
  the owner in a dated record, and a phrase a rule may not use. *Runs:* any session and the runners. *Else:* Vale (MIT,
  Go, its rules in YAML) and alex, kept as matchers and dropped on an assumption: fitting costs more, since the check
  reads only the lines a pull request adds and sets quotes aside. *Bugs:* 0. **Keep:** small and stable; the word lists
  are the core's.
- `scripts/size.mjs`, `.github/workflows/size.yml`: fails a pull request that grows what a role reads at its start past
  that role's cap, or raises a cap without its comment; `size.yml` runs it with `scripts/general.mjs` and
  `scripts/shape.mjs`. *Runs:* any session and the runners. *Else:* none found. *Bugs:* 0. **Keep:** nothing fits; the
  caps are the core's.
- `scripts/own-modules.mjs`, `scripts/holders.mjs`: fail a module the core's `AGENTS.md` neither takes nor gives a
  reason for, and a rule's holder that is not there. *Runs:* any session and the runners. *Else:* none. *Bugs:* 0.
  **Keep:** nothing fits; both read the core's own rule files.
- `.github/workflows/codeql.yml`: runs the host's CodeQL on a public project's pull requests, its pushes and weekly.
  *Runs:* the runners. *Else:* it is the host's maintained tool already. On a private repository it is paid, so a
  private project does not call it (`README.md`, "A private repository") and has no scan of its code; Opengrep
  (LGPL-2.1, a program, a fork of Semgrep's engine) would give it one, a case filed as #546. *Bugs:* 1. **Keep** for a
  public project.

## The tests and the strength of the tests

- `.github/workflows/tests.yml`, `scripts/select.mjs`: runs the core's own suites on Linux and Windows, and, through
  `select.mjs`, only the tests a change can reach. *Runs:* the runners; any session by hand. *Else:* Node's own runner
  and assertions (`node:test`, `node:assert`), which #486's point 11 already takes, each where its file is next changed;
  for the selection, Jest's related tests, Vitest's changed mode and Nx's affected, dropped on fact: each needs its
  framework and reads JavaScript alone, where `select.mjs` reads C# and Python too. *Bugs:* 17 naming `tests.yml`, 2
  `select.mjs`. **Keep** the selection: nothing fits. The upgrade test's runner of workflows
  (`scripts/workflow-run.mjs`) stays as #486 says: `act`, dropped on fact, needs a container a session cannot start.
- `scripts/mutate.mjs`, `scripts/strength.mjs`: the mutation tool puts faults into the lines a change touches, one at a
  time, and writes the open mutation report, which the strength check reads to say how strong the tests are. *Runs:* any
  session and the runners. *Else:* StrykerJS (Apache-2.0, 176 packages) and Stryker.NET, kept, tried above; mutmut and
  Cosmic Ray for Python, kept for a Python project. *Bugs:* 0. **Replace** `mutate.mjs` with Stryker (a tool that only
  runs, fetched at set-up), which put nine times as many faults into the same lines, 63 of them surviving against the
  core's 4, and reaches .NET, which the core's tool does not; its packages are what #488's lookup weighs. **Keep**
  `strength.mjs`: it reads the report every such tool writes, and holds the core's measure.

## Jobs on a schedule or by hand

- `scripts/look.mjs`, `.github/workflows/look.yml`, `.github/workflows/own-look.yml`: the scheduled look, once a day,
  keeps in issues what has stopped, what is due and what is overdue, and the monthly state report. *Runs:* the runners
  on a schedule; an orchestrator's wake. *Else:* the host's stale-issue actions and Renovate's dashboard, dropped on
  fact: they know nothing of the core's states; the host's agent jobs, dropped on fact: billed. *Bugs:* 3, and 2 naming
  `look.yml`. **Keep:** nothing fits.
- `scripts/core-moved.mjs`, `.github/workflows/core-moved.yml`: keeps one issue open while the core has moved past a
  project's pin. *Runs:* the runners on a schedule. *Else:* Dependabot and Renovate, which follow a submodule or a
  release, dropped on fact: the copy is neither (#519). *Bugs:* 1 and 1. **Keep:** small and stable.
- `scripts/versions.mjs`, `.github/workflows/versions.yml`: opens an issue for each pinned version, outside a package
  manager, behind its registry's newest stable release old enough to take. *Runs:* the runners, monthly. *Else:*
  Renovate's custom managers with `minimumReleaseAge` (AGPL-3.0, allowed for a tool that only runs), dropped on fact:
  122 direct dependencies and a token, for a job of about 120 lines; Dependabot, dropped on fact: it reads no pattern
  the project writes. *Bugs:* 1. **Keep:** fitting and keeping Renovate costs more than the script.
- `scripts/release.mjs`, `.github/workflows/release.yml`: cuts `release-N` on `main`'s newest commit once every check
  passed. *Runs:* the runners, started by hand. *Else:* release-please, semantic-release and changesets, dropped on
  fact: they write versions and notes from commit messages, which the core does not ask. *Bugs:* 0. **Keep:** small and
  stable.
- `.github/workflows/delete-merged-branches.yml`: deletes the branches whose every commit is in `main`. *Runs:* the
  runners, started by hand. *Else:* the host's setting that deletes a pull request's branch when it merges, free, kept
  for that case and dropped for the rest, on fact: it leaves a branch that had no pull request. *Bugs:* 0. **Keep:**
  small and stable.
- `scripts/site-publish.sh`, `.github/workflows/preview.yml`: a game's site and each pull request's preview on its pages
  branch. *Runs:* the runners. *Else:* preview actions of others, dropped on fact: a vendor's wrapper (#534, point 6);
  hosted previews, dropped on fact: a hosted product. *Bugs:* 0. **Keep:** small and stable.

## Hooks and set-up

- `scripts/work-saved.sh`: at a session's start, reports work not yet saved, the stop switch and what the branch's paths
  call for; at its stop, keeps a reply from ending once while work is unsaved. *Runs:* a session's hook, in each tool's
  form. *Else:* none; each tool's own hooks are what run it. *Bugs:* 0. **Keep:** small and stable.
- `scripts/helper-call.mjs`: refuses a helper started with no model, no effort, or the effort max. *Runs:* Claude Code's
  hook. *Else:* none. *Bugs:* 0. **Keep:** small and stable; the rule is the core's.
- `scripts/node.sh`: keeps the pinned Node on a session's machine, fetched by its digest. *Runs:* the cloud set-up, from
  `main`. *Else:* nvm, fnm, Volta and mise, dropped on fact: each must be installed first, by digest too; the host's
  `setup-node`, which the runners already use. *Bugs:* 0. **Keep:** small and stable; #534's point 5 widens it to the
  tools that only run.
- `scripts/init.mjs`, `scripts/steps.mjs`, `scripts/sync.mjs`: the starter kit writes a new project's files; the sync
  writes the copy at a newer commit and moves the pins; each step of the sync notes reads done or not. *Runs:* any
  session, in the project. *Else:* Copier and Cookiecutter, dropped on fact: Python and an install in the project, and
  #519 weighed the template; `git archive`, which the sync already uses. *Bugs:* 2, 8 and 4. **Keep:** nothing fits;
  what a release asks is the core's.

## Mechanisms

- **How rules are read by task** (`scripts/reading.mjs`): prints what a role reads at its start and what a task's issue
  and paths call for. *Runs:* any session. *Else:* the open format for agent skills (`SKILL.md`), which most agent tools
  load by themselves; whether Kiro does was not found. *Bugs:* 1. **Try**, as #534's point 8 sets out: one or two task
  modules laid out as skills, each tool the core supports given a task that calls for one.
- **How the core reaches a project:** the copy, its check and its sync, in the lines above. **Keep**, #519's record.
- **How behaviour is tested:** the core's tests, the upgrade test, and the staged cases (`scripts/staged.mjs` and
  `scripts/staged/`, 1,531 lines), which give a fresh session a task and read what it did. *Runs:* any session; the
  staged cases in a session, each a helper started by its own tool. *Else:* for the staged cases, Inspect AI (MIT, with
  agents for Claude Code and Codex) and Harbor (Terminal-Bench's harness), kept; promptfoo, dropped on an assumption:
  its maker was bought by a model's maker in March 2026, so its upkeep for other tools is unsure. *Bugs:* 3 naming
  `staged.mjs`. **Try** a harness under the cases, the cases staying the core's; what decides is whether it runs where a
  session runs, with no container and on the session's own sign-in rather than a paid key, both unmeasured.
- **The mutation tool:** the line above. **Replace.**
- **The reviews:** Codex's code and security reviews and the fallback reviewer, with the statuses above. *Else:* hosted
  review products, dropped on fact: paid on a private repository and hosted (#534, point 6). **Keep**, looked at again
  at the pass.
- **The orchestrator and the queue** (`roles/orchestrator.md`, `QUEUE.md`): one session works the lines in order.
  *Else:* the host's project boards, dropped on fact: the queue is the trust gate, a file changed only by a reviewed
  pull request, which a board is not; the host's coding agent and other hosted orchestrators, dropped on fact: paid and
  hosted. **Keep**, looked at again at the pass.
- **The scheduled look:** the line above. **Keep.**
- **The rule text** (the floor, the roles, the modules, the choice records, the stand-in and the owner's word, the rules
  for games): **keep** its content, exempt as #534's point 9 says; its form is the skills' trial above.

## What the verdicts ask, in #534's order

Each waits on the owner's word to become a line, and on #488's points 1, 3, 4 and 5 before anything arrives.

1. The tools that only run: **replace** the matching of `personal-terms.yml` with gitleaks or Betterleaks; **replace**
   `scripts/workflows.mjs` with zizmor and actionlint; **replace** `scripts/mutate.mjs` with Stryker; **try** a link
   checker, offline, under `scripts/pointers.mjs`; **try** jscpd under `scripts/copies.mjs`; **try** a harness under the
   staged cases.
2. The reading under the package checks: **replace** with `npm sbom`; **try** nuget-license and the SDK's own list.
3. The packages carried in the copy: as #486's inventory and #519's path have them.
4. The form the rules are delivered in: **try** the skill format (#534, point 8).
