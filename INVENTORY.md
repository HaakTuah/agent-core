# The core's parts, and what else does each

The inventory of #534, point 4: a line for each part of the core (each script a workflow or a hook runs, each workflow,
each mechanism), saying what it does, where it must run, what else does it, and a verdict. It grows the inventory of
#486, point 10 (`CHOICES.md`, "Choice: one parser, tree-sitter, carried in the copy, reads every language's structure",
its list "What is written by hand today"), which weighed the readers inside the checks and stays the word on them: a
line here points to it where a part holds such a reader, and weighs the whole part. It lists too, under a heading of its
own, what the core lacks that a maintained tool gives at once, first a general linter for its own scripts.

It decides nothing by itself. A **replace** or a **try** becomes a line of `QUEUE.md` only on the owner's word, each a
pull request of its own that shows the comparison, old against new (#534, point 2); no tool or package arrives before
#488's points 1, 3, 4 and 5 have merged; and the order is #534's, point 7: the tools that only run first, then the
packages installed from the core's lock file (#654), then the form the rules are delivered in.

Weighed whole: 2026-11-17

Challenged whole: 2026-11-17, by a session that wrote no part of it ("The challenge", below; #534, point 13)

**How a line reads.** The part's files, then what it does. *Runs:* where it must run: in a session's hook, in any
session, on the host's runners, on the owner's own computer; a check that may decide a pull request runs in all three
places that hold a session or a runner (#534, point 5). *Else:* what else does the job, found on the web and in the
registries on 17 November 2026, each kept or dropped in a few words, a drop marked as a fact, as a measure, or as an
assumption to measure (`tasks/choices.md`, "a drop says whether it rests on a fact"). A verdict or a candidate the
challenge changed says "proposed" and waits on the owner's word ("What waits on the owner", below). *Bugs:* the issues
labelled `bug` that name the part's files, of the 61 so labelled. A trial of a tool in its place run from 18 November
2026 on is recorded on the line as *Tried:*, with *Replayed:* saying by number which of the part's bugs the tool reads
and which it does not (`tasks/choices.md`, "A trial of a maintained tool replays the part's past bugs"; #593, point 7);
the trials of 17 November below came before that rule and replayed none. Then the verdict: **replace** where a
maintained tool does the job at the same level or better, the comparison to be shown when it is made; **try** where only
a trial can tell; **keep**, with the exception of #486, point 6, it rests on: small and stable, nothing fits, fitting
costs more than keeping, or it brings too much. A part that gives way keeps the core's glue (#534, point 10): its lists
and baseline, the failure that says the mend, the word that it could read nothing, and "Nothing locks a project".

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
  inventory, whose reason was the core's own definition. Its config's shape is held by a schema and ajv (`scripts/schemas.mjs`;
  #530, item 7).
- `scripts/pointers.mjs`: fails a pointer in the rule files, to a file, a section, a numbered point, a floor rule or an
  archive item, that leads nowhere. *Runs:* any session and the runners. *Else:* lychee (offline, with Markdown's
  anchors), remark-validate-links, markdown-link-check and linkinator, each kept for Markdown's own links and dropped,
  on fact, for the rest: none reads a backticked path, a quoted section, a bold lead or "point 6". *Bugs:* 0. **Try** a
  link checker, run offline, for the form `[text](path)` and a project's own documents (with #486's group 5); **keep**
  the core's own forms: nothing fits, they are the core's. Its reading of Markdown runs on the package marked (#530,
  item 7).
- `scripts/reading-size.mjs`: fails a file every session reads that passes its mark. *Runs:* any session and the
  runners. *Else:* size-limit and bundlesize, dropped on fact: they weigh a built bundle, not a file read whole.
  *Bugs:* 2. **Keep:** nothing fits; what a session reads is the core's own list.
- `scripts/workflows.mjs`: fails a workflow or action in which the word `pull_request_target` stands, and, through
  `scripts/yaml-keys.mjs`, one that gives a key twice. *Runs:* any session and the runners. *Else:* zizmor (MIT, a
  program for each system, its audit `dangerous-triggers` among some 30), kept, tried above; actionlint (MIT, Go, its
  syntax check refusing a key given twice, and, where shellcheck is installed, each step's script), kept; yamllint's
  `key-duplicates`, dropped on fact: Python, and actionlint holds it. *Bugs:* 1. **Replace** with zizmor and actionlint,
  which read far more of floor rule 2 than a word and a key; the core's list of what is forbidden stays its own policy,
  given as the tools' configs, and a finding the core judged safe is allowed there with its reason. This takes
  `yaml-keys.mjs` out of #486's YAML package. Found by the challenge, untried: ghalint (MIT, one program, 1.6.0) and
  poutine (Apache-2.0, one program, 1.1.6), each reading a workflow's security policy; proposed for the replacement's
  comparison beside zizmor and actionlint.
- `scripts/entry-files.mjs`: fails an agent tool's entry file that does not pull in every file `AGENTS.md` names.
  *Runs:* any session and the runners. *Else:* the generators of each tool's rule files (ruler, rulesync), dropped on
  fact: the core keeps one `AGENTS.md` that each tool's file imports, and needs nothing generated. *Bugs:* 0. **Keep:**
  nothing fits; the list of entry files is the core's own.
- `scripts/tools-offer.mjs`: fails the table of what the core offers each agent tool where a cell is empty or in no
  form, names a file not there or an issue not open, a tool of the list has no column, a map says no day, or a file of a
  tool's own is named by no cell (#467). *Runs:* any session and the runners. *Else:* the linters of agent tools'
  instruction files (agnix, agentlint, agent-context-lint, instruction-lint), found on 18 November 2026, dropped on
  fact: each reads a tool's own files against that tool's form, and none reads what the core offers one tool against
  each other tool. *Bugs:* 0. **Keep:** nothing fits; the table is the core's own.
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
  fixing its definitions; its readers go to the parser, as #486's group 3 and #519's path say, C#'s functions the
  first (`scripts/csharp-functions.mjs`, #529).
- `scripts/choices.mjs`: fails a choice record a pull request adds without its lines, says when the pass is due, and
  reads each sign written in a measure. *Runs:* any session and the runners. *Else:* none found; the decision records'
  tools (adr-tools, log4brains) write records and check no form. *Bugs:* 1. **Keep:** nothing fits; the form is the
  core's.
- `scripts/checks.mjs`: runs the checks that need no secret, part by part, as the workflows do and as a session may by
  hand. *Runs:* any session and the runners. *Else:* a task runner (npm scripts, just, make), dropped on fact: a project
  in another stack has none of npm's, and the others are installs. *Bugs:* 2. **Keep:** small and stable glue.
- `scripts/pr-description.mjs`, `.github/workflows/pr-description.yml`, `.github/workflows/own-description.yml`: fail a
  ready pull request whose description lacks a heading the project names, and, here, the lines the core asks, saying so
  of a draft. *Runs:*
  the runners, where the description is; any session given it. *Else:* Danger JS (MIT), its rules written in JavaScript
  and run with a token, dropped on a measure: 14.1.0 installs 86 packages (34 MB), and the check's rules, the headings
  and lines the core asks, would be written again in its file, Danger giving only the description the workflow already
  reads; the semantic title actions, dropped
  on fact: a vendor's wrapper (#534, point 6) reading the title alone. *Bugs:* 2, and 1 naming `pr-description.yml`.
  **Keep:** nothing fits; the headings are the core's.
- `.github/workflows/personal-terms.yml`: fails a pull request whose files, commits, title, description or branch hold a
  term of the secret `PERSONAL_TERMS`. *Runs:* the runners, where the secret is. *Else:* gitleaks (MIT, Go), kept: its
  rules may be written when the job runs, from the secret, and it reads text given on its input too; its maker now
  issues only security fixes for it and builds Betterleaks, which reads the same rules (fact, as reported in March
  2026), so the lookup of #488 picks between them; TruffleHog (AGPL-3.0, allowed for a tool that only runs), dropped on
  an assumption that the challenge measured wrong, and so proposed for the replacement's comparison: its live check of
  a secret turns off (`--no-verification`), as does its look for a newer version of itself when it starts
  (`--no-update`), and so run, offline, with both, over the core's files with a fake key and a term planted, 3.99.7
  found what gitleaks 8.30.1 found (the key, and the term through a rule of its own) and two addresses holding a
  password in two tests' data, which gitleaks did not; 184 MB against gitleaks's 24 MB, 1.3 s against 0.9 s. With its
  defaults it would send each secret it finds to the service the secret belongs to, so it is never run without both.
  *Bugs:* 1.
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
  #486's licence group. *Tried:* 18 November 2026 (#585), npm 11.20.0, on the 70 projects
  `tests/licence-installed-test.mjs` makes and on a real install; the core's reading kept, on measure, since neither of
  npm's own tools reads what is installed at its level. `npm sbom` merges the packages of one name and version, so a
  GPL-3.0 copy of a locked ISC package bundled in another's folder went unread, and it stopped with nothing read wherever
  a package.json had no name, a project's own root among them (15 of the 70 that pass). `npm query "*"` failed what the
  old reading failed on all 70, but its review found four cases it reads worse, each reproduced: a plain file named
  `@block` in a package's `node_modules` makes npm leave out every package in that folder with no word, so a bundled
  GPL-3.0 package passed; a package.json that is itself a link out of the project passed; a valid local package with
  no name and no version failed; and a folder named `..vendor` read as outside the project. The fallbacks were read, not
  run (#649): license-checker-rseidelsohn walks the folders with the same `readdirScoped` npm uses, reads its failure as
  nothing installed, and keys each package by name and version; licensee reads npm's own tree (`loadActual`); and
  CycloneDX's npm tool runs `npm ls --long --all`: each would read the `@block` case as npm does. *Replayed:* #444 not
  read (its cases, lock entries not written as npm writes one, lie in the lock file, which npm's reading of what is
  installed never opens); #339, #364, #366, #386 and #447 not run (their cases lie in where the config stands, the
  steps and the scan, which no tool tried here takes over).
- `scripts/exact-versions.mjs`: fails a dependency of the project's own written as a range. *Runs:* any session and the
  runners. *Else:* npm's `save-exact`, dropped on fact: it writes exact versions and checks none already written.
  *Bugs:* 1. **Keep:** small and stable, a read of `package.json`.
- `scripts/lookup.mjs`: asks its registry of each package a pull request brings in new, and fails a name the registry
  does not know or one first published days ago, printing the rest for the review (#488, point 1, merged later the same
  day). *Runs:* any session and the runners, with the registry reachable. *Else:* npm's own `npm view`, dropped on fact:
  the script asks npm's registry and NuGet's directly, as `npm view` would, with no npm needed; deps.dev and Socket,
  dropped on fact: hosted services (#534, point 6); OpenSSF Scorecard, dropped on fact: it scores a repository's
  practices, not whether a name is new, and wants a token; npm's own `min-release-age` (npm 11.10 and later; the pinned
  Node 26.13.0 carries npm 11.20.0), found by the challenge, which makes an install pass over a version younger than the
  days it is set to, kept beside the lookup and dropped in its place, on fact: npm's alone, and it takes an older
  version without a word where the lookup fails the pull request with its mend. *Bugs:* 0. **Keep:** nothing fits; the
  registries are asked through their own interfaces, and the rule is the core's.
- `scripts/agent-tools.mjs`: fails a plug-in, tool server, skill or hook a project configures for its agents that its
  licence config does not list with a publisher and one exact version. *Runs:* any session and the runners. *Else:* none
  found that reads every tool's own settings. *Bugs:* 2. **Keep:** nothing fits; the list is the core's policy. Its TOML
  reader goes with #486's group 2.
- `.github/workflows/signatures.yml`: installs the packages with their scripts off, runs `npm audit signatures`, and
  reads each installed licence back. *Runs:* the runners, and any session. *Else:* it is npm's own tool already.
  *Bugs:* 1. **Keep:** the job is npm's; the core holds only its call.
- `scripts/nuget.mjs`, `scripts/nuget-fetch.mjs`, `scripts/nuget-look.sh`, `.github/workflows/nuget.yml`: for a .NET
  project, every package one exact version under a licence on the list, each read from a package fetched before the pull
  request's build files run. *Runs:* any session with the .NET SDK, and the runners. *Else:* nuget-license (a .NET tool
  that holds packages to a list of licences), kept; `dotnet list package --include-transitive --format json`, kept, for
  the packages; dotnet-project-licenses, dropped on fact: its last release on NuGet is 3.0.0-alpha.9 of 25 November
  2022, and none came in the year to 17 November 2026, where nuget-license published 25. *Bugs:* 7, 1, 0
  and 4. **Try** nuget-license and the SDK's own list for the reading; **keep** the fetch before the build, which is a
  boundary of the floor's (what a build could write never decides a licence), and the policy. *Tried:* 18 November
  2026 (#586), nuget-license 4.0.18 (Apache-2.0) and `dotnet list package --include-transitive --format json` on .NET
  SDK 10.0.404, on 25 projects built from the kinds of package the core's tests make, each restored from a local feed;
  the core's reading kept, on measure, the check unchanged. Neither reads a licence before a restore has run the pull
  request's project files: nuget-license takes only a project or solution and reads its packages from the assets file
  a restore writes (with none, it stops), reading each licence from the `.nupkg` in the folder that restore filled,
  hash unchecked, so a package swapped there after the restore read MIT for a GPL-3.0 one, and asking the project's
  sources over the network for one that is missing; `dotnet list package` reads no licence at all, restores by itself
  unless told not to, and missed a PackageDownload. Against the core, on the same 25: nuget-license read the same
  licence in 17, read another in 5 and nothing in 3 (a crash on a non-breaking space, a package NuGet would not
  restore, the PackageDownload), and passed 7 the core fails (a licence file and a licence address it guessed from,
  an AND and OR without brackets, a WITH, two version ranges, the PackageDownload), failing none the core passes; it
  holds no exact version, no owner's yes, no audit and no base. *Replayed:* #240, #274 and #280 read, after a restore
  (MSBuild follows the Import that brings the GPL-3.0 package, though nuget-license holds no lock file, so #240's lock
  file kept elsewhere goes unheld); #269 not read (a package folder the pull request names, its package altered to say
  MIT, passes the locked restore and nuget-license alike); #373, #380, #366, #386 and #355 not run (a billed job, the
  first look's choice to restore, the configs' paths, and a change of shape: none a reading of a package); #446 not
  run (open, with no fix).
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
  Go, its rules in YAML), dropped on a measure: 3.25.1, given the core's two lists as two rules written from
  `general.json` and a config of seven lines, caught each word planted, passed a quote with `>` and a word in code
  marks, and found nothing standing in 0.09 s, as the script does; but the script's matching is JavaScript's own
  regular expressions, a few lines, and what it mostly holds (only the lines a pull request adds, a line moved word for
  word aside, the dated records' folders) Vale does not read, so no upkeep would move. alex, dropped on fact: last
  published in August 2023, 414 packages; textlint (MIT, 58 packages), found by the challenge and dropped as Vale is.
  *Bugs:* 0. **Keep:** small and stable; the word lists are the core's.
- `scripts/size.mjs`, `.github/workflows/size.yml`: fails a pull request that grows what a role reads at its start past
  that role's cap, or raises a cap without its comment; `size.yml` runs it with `scripts/general.mjs` and
  `scripts/shape.mjs`. *Runs:* any session and the runners. *Else:* none found. *Bugs:* 0. **Keep:** nothing fits; the
  caps are the core's.
- `scripts/own-modules.mjs`, `scripts/holders.mjs`: fail a module the core's `AGENTS.md` neither takes nor gives a
  reason for, and a rule's holder that is not there. *Runs:* any session and the runners. *Else:* none. *Bugs:* 0.
  **Keep:** nothing fits; both read the core's own rule files.
- `.github/workflows/codeql.yml`: runs the host's CodeQL on a public project's pull requests, its pushes and weekly.
  *Runs:* the runners. *Else:* it is the host's maintained tool already. On a private repository it is paid, so a
  private project does not call it (`README.md`, "A private repository") and has no scan of its code; Semgrep's
  engine (LGPL-2.1, from PyPI), with the core's own rules, will give it one (`CHOICES.md`, "Choice: a private
  project's code is scanned by Semgrep's engine, with the core's own rules"; built under #546). *Bugs:* 1. **Keep**
  for a public project.

## The tests and the strength of the tests

- `.github/workflows/tests.yml`, `scripts/select.mjs`: runs the core's own suites on Linux and Windows, and, through
  `select.mjs`, only the tests a change can reach. *Runs:* the runners; any session by hand. *Else:* Node's own runner
  and assertions (`node:test`, `node:assert`), which #486's point 11 already takes, each where its file is next changed;
  for the selection, Jest's related tests, Vitest's changed mode and Nx's affected, dropped on fact: each needs its
  framework and reads JavaScript alone, where `select.mjs` reads C# and Python too. *Bugs:* 17 naming `tests.yml`, 2
  `select.mjs`. **Keep** the selection: nothing fits. The upgrade test's runner of workflows
  (`scripts/workflow-run.mjs`) stays as #486 says: `act`, dropped on fact, needs a container a session cannot start;
  its YAML is read by the YAML package (#530).
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
- `scripts/issue-terms.mjs`, a step of `.github/workflows/look.yml` and `own-look.yml`: takes the terms of the secret
  `PERSONAL_TERMS` out of the issues, closed pull requests and comments written or edited in the week before, printing
  counts alone; `--private`, in a session the owner works with, names them and the texts whose kept versions hold one
  (#783). *Runs:* the runners on a schedule, where the secret is; a session the owner works with. *Else:* GitHub's
  secret scanning with custom patterns, dropped on fact: it raises alerts and edits nothing, and its custom patterns in
  a private repository are paid; gitleaks or Betterleaks, the lookup of #488, kept for the matching alone, as for
  `personal-terms.yml`, whose matcher this one's test holds it in step with. *Bugs:* 0. **Keep:** nothing fits.
- `scripts/core-moved.mjs`, `.github/workflows/core-moved.yml`: keeps one issue open while the core has moved past a
  project's pin. *Runs:* the runners on a schedule. *Else:* Dependabot and Renovate, which follow a submodule or a
  release, dropped on fact: the copy is neither (#519). *Bugs:* 1 and 1. **Keep:** small and stable.
- `scripts/versions.mjs`, `.github/workflows/versions.yml`: opens an issue for each pinned version, outside a package
  manager, behind its registry's newest stable release old enough to take. *Runs:* the runners, monthly. *Else:*
  Renovate's custom managers with `minimumReleaseAge` (AGPL-3.0, allowed for a tool that only runs), dropped on fact:
  122 direct dependencies and a token, for a job of about 120 lines; Dependabot, dropped on fact: it reads no pattern
  the project writes; updatecli (Apache-2.0, one program), found by the challenge, dropped on fact: its documentation of
  17 November names no age a release must reach, which the script asks. *Bugs:* 1. **Keep:** fitting and keeping
  Renovate costs more than the script.
- `scripts/release.mjs`, `.github/workflows/release.yml`: cuts `release-N` on `main`'s newest commit once every check
  passed and its own run of the upgrade test on Windows, which it also runs once a day, cutting nothing. *Runs:* the
  runners, started by hand, and daily. *Else:* release-please, semantic-release and changesets, dropped on
  fact: they write versions and notes from commit messages, which the core does not ask. *Bugs:* 0. **Keep:** small and
  stable.
- `.github/workflows/delete-merged-branches.yml`: deletes the branches whose every commit is in `main`. *Runs:* the
  runners, started by hand. *Else:* the host's setting that deletes a pull request's branch when it merges, free, kept
  for that case and dropped for the rest, on fact: it leaves a branch that had no pull request. *Bugs:* 0. **Keep:**
  small and stable.
- `scripts/site-publish.sh`, `.github/workflows/preview.yml`: a game's site and each pull request's preview on its pages
  branch. *Runs:* the runners. *Else:* preview actions of others, dropped on fact: a vendor's wrapper (#534, point 6);
  hosted previews, dropped on fact: a hosted product. *Bugs:* 0. **Keep:** small and stable.
- **What a session runs by hand,** a part the inventory did not list, found by the challenge: `scripts/session-cost.mjs`
  (the cost line a pull request ends with), `scripts/labels.mjs` (the labels and openers), `scripts/state-report.mjs`,
  `scripts/pruning.mjs`, and the records (`scripts/stand-in-record.mjs`, `scripts/review-record.mjs`,
  `scripts/core-cost.mjs`). *Runs:* any session. *Else:* for the cost line, ccusage (MIT, 20.0.48, 7 packages, 5.6 MB, a
  program for each system behind a small wrapper, 69 releases in the year to 17 November 2026), which reads the same
  record of Claude Code's and reports each session's tokens, kept, untried: the session's permission check refused
  running it over this session's own record; for the labels, the host's CLI (`gh label create --force`), which writes a
  list of labels, dropped on fact: `labels.mjs` writes none and reads the issues' labels and openers, which no tool
  found does; for the state report, pruning and the records, none found: each reads the core's own forms. *Bugs:* 2, 1,
  0, 0, 0, 2 and 2. **Try**, proposed, ccusage under the cost line, the line's form and its tally staying the core's;
  **keep** the rest: nothing fits. The other files of `scripts/` that no line names are the libraries of the parts above
  (the shape check's readers among them) and the staged cases', weighed with their parts.

## Hooks and set-up

- `scripts/work-saved.sh`: at a session's start, reports work not yet saved, the stop switch and what the branch's paths
  call for; at its stop, keeps a reply from ending once while work is unsaved. *Runs:* a session's hook, in each tool's
  form. *Else:* each tool's own hooks are what run it. Weighed by the challenge: git's own hooks, dropped on fact: git
  has no event at a session's start or as a reply ends, the two this hook needs, and runs a hook from a folder each
  clone must be set to, the working tree's, where these run only the copy merged into `main`; the adapters that write
  one hook into each tool's form (agenthooks, ai-hooks, agent-hooks), dropped on fact: packages at 0.x writing three
  files the starter kit keeps in 97 lines. *Bugs:* 0. **Keep:** small and stable.
- `scripts/helper-call.mjs`: refuses a helper started with no model, no effort, or the effort max. *Runs:* Claude Code's
  hook. *Else:* none. *Bugs:* 0. **Keep:** small and stable; the rule is the core's.
- `scripts/node.sh`: keeps the pinned Node on a session's machine, fetched by its digest. *Runs:* the cloud set-up, from
  `main`. *Else:* nvm, fnm, Volta and mise, dropped on fact: each must be installed first, by digest too; the host's
  `setup-node`, which the runners already use. *Bugs:* 0. **Keep:** small and stable, for Node. #534's point 5 widens
  it to the tools that only run, and there the challenge proposes **try**: aqua (MIT) and mise (MIT), found again, each
  keep a file of every tool's digest for each system (`aqua-checksums.json`, `mise.lock`) and refuse a download that
  does not match, which is the list of digests point 5 asks, kept by a maintained program in place of one script line
  per tool; each is itself fetched first, by its digest, as Node is. Not measured: this session's network refused the
  host's release downloads, from which both, and most of the tools, are fetched (the tools tried here came through the
  Go and npm registries instead).
- `scripts/init.mjs`, `scripts/steps.mjs`, `scripts/sync.mjs`: the starter kit writes a new project's files; the sync
  writes the copy at a newer commit and moves the pins; each step of the sync notes reads done or not. *Runs:* any
  session, in the project. *Else:* Copier and Cookiecutter, dropped on fact: Python and an install in the project, and
  #519 weighed the template; `git archive`, which the sync already uses. *Bugs:* 2, 8 and 4. **Keep:** nothing fits;
  what a release asks is the core's.
- `scripts/install.mjs`, `scripts/packages.mjs`: install the packages of other publishers the scripts run from the
  core's lock file in `.packages/` into `.packages/node_modules/`, and the parser's from `.packages/parser/` only where
  a job names it (#719), and load each from its own install alone, a missing one saying its mend (#654). *Runs:* any session, at its start and at each sync, and on the host's runners before each check.
  *Else:* npm's own `npm ci`, which does the install, kept; a folder of carried packages (#528), dropped on the owner's
  decision of 18 November 2026. *Bugs:* none. **Keep:** the install is npm's; the scripts run it once more after a
  failed fetch and say the mend.
- **What the starter kit holds** (`setup/template/`, 32 files on 17 November 2026), weighed by the challenge: eight
  templates of rule files and records, exempt as content (#534, point 9); three of hooks, weighed in the hook's line
  above; three of Dependabot, the host's own format already; three configs of the core's checks and twelve workflows,
  which go with their checks' lines; one manifest, the core's own form; and two issue templates. *Runs:* any session,
  through `init.mjs`. *Else:* the host's template repositories, dropped on fact: they copy files once, filling in
  nothing and writing no copy of the core at a commit, which `init.mjs` does; the host's issue forms, whose required
  fields the host enforces, dropped on fact: they hold only an issue filed through the host's page, and sessions file
  through the API, which takes any text. *Bugs:* 3 naming `setup/template`. **Keep:** nothing fits beyond what the lines
  above weigh.
- **The steps an owner takes once on the host's account** (`README.md`, "Setting up (the owner's part)"), weighed by the
  challenge: the rulesets on `main` and on the release tags, the Actions setting that pins every action, secret
  scanning, the review app, `NOTICE`, the profile and git's name. *Runs:* the owner, by hand on the host's pages.
  *Else:* the host's own form for a ruleset, which its API gives for the core's two rulesets today as JSON in the form
  its create call takes (read on 17 November), applied by the host's own CLI in one command, kept; the labels, already
  one file (`scripts/labels.json`) whose check says the mend; the Probot Settings app, dropped on fact: a hosted app
  given admin rights over the repositories (#534, point 6); safe-settings, dropped on fact: an app the owner must host,
  made for organisations; Terraform or OpenTofu with the host's provider, dropped on fact: an install and a state file
  to keep for a handful of settings; ghset, a young program, dropped on fact: the host's JSON and its CLI do what it
  does. The app, `NOTICE`, the profile and git's name are no setting a file can hold: an install, the holder's own
  typing, a profile and each machine's config. *Bugs:* 2 naming a ruleset. **Try**, proposed: the rulesets of
  `README.md` kept as the host's JSON, which the owner applies with one command, where the plan has rulesets (a private
  repository on the free plan has none).
- **The definition of a session's environment,** weighed by the challenge: what each tool's cloud session is set up
  with. *Else:* the Dev Container standard (`devcontainer.json`), dropped on fact: Codex's cloud, Copilot's coding agent
  and Claude Code's cloud each define a session's environment their own way (settings and a set-up script; a workflow,
  `copilot-setup-steps.yml`; an environment's set-up script), none names it in its documentation of 17 November, and
  this session had no container daemon to start one. **Keep:** each tool's own set-up, with `scripts/node.sh`, and the
  fetcher of the line above.

## Mechanisms

- **How rules are read by task** (`scripts/reading.mjs`): prints what a role reads at its start and what a task's issue
  and paths call for. *Runs:* any session. *Else:* the open format for agent skills (`SKILL.md`), which most agent tools
  load by themselves; whether Kiro does was not found. Found by the challenge: each tool's own rule files for paths
  (Claude Code's `.claude/rules/` with `paths`, Copilot's `.github/instructions/` with `applyTo`, Kiro's steering files,
  whose matching by path was not confirmed), which load a file's rules when a session reads a path they name, as
  `reading.mjs` does for a pull request's changed paths, but each in its own form; and `claude plugin eval`, which reads
  whether Claude Code loads a skill by itself, half of point 8's trial for one tool. Both proposed for the trial.
  *Bugs:* 1. **Try**, as #534's point 8 sets out: one or two task modules laid out as skills, each tool the core
  supports given a task that calls for one.
- **How the core reaches a project:** the copy, its check and its sync, in the lines above. **Keep**, #519's record.
- **How behaviour is tested:** the core's tests, the upgrade test, and the staged cases (`scripts/staged.mjs` and
  `scripts/staged/`, 1,531 lines), which give a fresh session a task and read what it did. *Runs:* any session; the
  staged cases in a session, each a helper started by its own tool. *Else:* for the staged cases, Inspect AI (MIT, with
  agents for Claude Code and Codex) and Harbor (Terminal-Bench's harness), kept; promptfoo, dropped on an assumption
  that the challenge measured wrong, and so proposed for the trial: since its maker's sale on 9 March 2026 it has
  published 28 releases (66 in the seven months before), and its newest, 0.125.1 of 25 October 2026, still names
  Claude's agent SDK and Codex's among its packages; its upkeep slowed and goes on. Claude Code's own `claude plugin
  eval`, found by the challenge, runs a skill's cases with it and without it and scores the difference, on the session's
  own sign-in; dropped as the harness on fact: Claude Code's alone. *Bugs:* 3 naming `staged.mjs`. **Try** a harness
  under the cases, the cases staying the core's; what decides is whether it runs where a session runs, with no container
  and on the session's own sign-in rather than a paid key, both unmeasured.
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

## What the core lacks that a maintained tool gives at once

Each weighed as a tool that only runs (#534, points 4 and 5), with the same verdicts: **try** where a trial decides
whether it comes in, **keep** where the core stays without it, with the exception it rests on. Tried on 17 November 2026
as the trials above were, over the scripts on `main` that day (36,896 lines of JavaScript and shell, tests included).

- **A general linter for the core's own scripts,** which have none. *Runs:* any session and the runners. *Else:* oxlint
  1.94.0 (MIT, one program for each system, no package of its own), kept, tried: 140 findings in 0.1 s with its
  defaults, among them 13 names declared or imported and never used, which "Keep it lean" asks gone, and 3 expressions
  whose value is thrown away; Biome 2.6.8 (MIT or Apache-2.0, one program, no package of its own, a formatter beside its
  linter), kept, tried: 283 findings in 0.4 s, more of them on how the code is written; ESLint 10 with its recommended
  rules, kept, untried: 30 packages of its own, the reference the other two follow. **Try** oxlint first, then Biome,
  each on its defaults with a baseline of what stands that may only shrink ("Nothing locks a project"), its findings
  read by kind before a kind is turned on; ESLint where neither reads a rule the trial wants.
- **A check of the shell scripts** (the scripts whose names end `.sh`, and each workflow step's script). *Runs:* any
  session and the runners. *Else:* ShellCheck (GPL-3.0, allowed for a tool that only runs, one program for each system),
  kept, untried: not on this machine; actionlint runs it over the steps' scripts where it is installed. **Try** with the
  replacement of the workflow check, which brings actionlint.
- **Code nothing uses,** across files: exports no file imports, and files nothing starts. *Runs:* any session and the
  runners. *Else:* knip (ISC, 11 packages of its own), kept, untried: it reads a project from its `package.json`, which
  the core has none of. **Try** after the linter, whose unused names cover one file at a time; drop it where the linter
  leaves nothing it would find.
- **A spell checker** for the rule files and the scripts. *Else:* typos 1.52.2 (MIT or Apache-2.0, one program), tried:
  none in the floor, the roles, the modules, `AGENTS.md` and `README.md`, and 31 in the scripts, each read as test data
  or a name written on purpose. **Keep** without it, on the trial: it would find nothing worth its upkeep.
- **A formatter.** *Else:* Biome's formatter and Prettier (MIT, 0 packages of its own). **Keep** without it, on a
  measure the challenge took: over the scripts on `main` (188 files, 38,896 lines), Prettier 3.9.10 on its defaults
  rewrote 15,191 lines into 79,463 and touched 187 files of the 188 (at 120 columns, 12,672 into 54,666), and Biome
  2.6.4 rewrote 24,543 into 89,445; every baseline of the copies and shape checks would read that as new, for a style
  the sessions already keep.
- **A scan of the packages for known faults.** *Else:* the host's Dependabot alerts, free on a private repository too,
  whose alerts the owner reads and passes on (floor rule 9); OSV-Scanner (Apache-2.0, one program). **Keep** without
  one: the core's packages stand in its lock file since #654, which the host's Dependabot alerts read; #650 brings the
  scan against a vulnerability database.
- **A type checker.** **Keep** without it: #519's record weighed it on 33 fixed bugs and a writing trial, and found no
  fault it would have caught.
- **A linter for Markdown.** *Else:* markdownlint-cli2 (MIT, 89 packages). **Keep** without it, on a measure the
  challenge took: 0.24.0 on its defaults, over the 50 rule, record and set-up files, gave 3,215 findings in 0.8 s, 3,163
  of them line length and 42 blank lines around lists, a style the core does not ask; of the other ten, one fault (a
  file with no newline at its end) and nine forms written on purpose (a list numbered on from a point before, a space in
  code marks that shows one, a line that opens with an issue's number).

## The challenge (#534, point 13)

A fresh session that wrote no part of the inventory read it whole on 17 November 2026, searched the web and the
registries for a tool it missed, took each of the seven drops that rested on an assumption, and weighed what the
inventory did not list: what the starter kit holds, the owner's steps on the host's account, a standard definition of a
session's environment, and the scripts a session runs by hand, which no workflow or hook names. What it found stands in
each line above, marked "found by the challenge" or "weighed by the challenge"; the twelve verdicts the owner agreed to
stand as they were.

`Looked for:` tools for each part, by the part's job, on the web and in the npm, NuGet and Go registries; found and
weighed, each in its line: TruffleHog again, ghalint and poutine, npm's `min-release-age`, updatecli, textlint,
promptfoo again, `claude plugin eval`, each tool's rule files for paths, aqua and mise again, git's own hooks and the
adapters that write one hook into each tool's form, the host's template repositories and issue forms, the host's ruleset
JSON, the Probot Settings app, safe-settings, Terraform and OpenTofu, ghset, the Dev Container standard, ccusage, and
the host's CLI for labels.

The seven drops, each now on a fact or a measure:

1. Danger JS: the assumption held, on a measure (86 packages, the rules written again).
2. TruffleHog: measured wrong; its live check turns off, and offline it found two things gitleaks did not. Proposed.
3. dotnet-project-licenses: now a fact (no release since November 2022).
4. Vale and alex: Vale matched the lists as well and moves no upkeep (a measure); alex unmaintained since 2023 (a fact).
5. promptfoo: measured wrong; its releases slowed and go on, its newest still naming Claude's and Codex's SDKs.
   Proposed.
6. A formatter: the assumption held, on a measure (two-fifths of the lines rewritten, all but one file touched).
7. markdownlint: the assumption held, on a measure (one fault in 3,215 findings).

The trials ran as the inventory's did: in a scratch folder outside the repository, at one exact version released two
weeks before or more where one was, with install scripts off and nothing committed; the key and the term planted were
fake, built when the trial ran. The programs came from the Go and npm registries, since this session's network refused
the host's release downloads.

### What waits on the owner

Each is proposed, and none becomes a line, or widens one, before the owner's word; the twelve agreed verdicts do not
wait on any of them.

1. TruffleHog joins the comparison of the personal-terms check's replacement, beside gitleaks or Betterleaks, run only
   with `--no-verification` and `--no-update`, offline, as the trial ran it.
2. ghalint and poutine join the comparison of the workflow check's replacement, beside zizmor and actionlint.
3. promptfoo joins the trial of a harness under the staged cases, beside Inspect AI and Harbor.
4. The trial of the skill format (#534, point 8) weighs each tool's own rule files for paths too, and uses
   `claude plugin eval` for Claude Code's part.
5. `scripts/node.sh`, where point 5 widens it to the tools that only run: **try** aqua or mise as the fetcher, its file
   of digests standing as point 5's list, in place of **keep**.
6. The owner's steps on the host's account: **try** the rulesets of `README.md` kept as the host's own JSON, applied
   with one command, a new line.
7. What a session runs by hand: **try** ccusage under the cost line (`scripts/session-cost.mjs`), a new line.

## What the verdicts ask, in #534's order

The owner agreed to all twelve on 17 November 2026, each a line of `QUEUE.md` of its own; none arrives before #488's
points 1, 3, 4 and 5 have merged. What the challenge proposes is not among them until the owner's word.

1. The tools that only run: **replace** the matching of `personal-terms.yml` with gitleaks or Betterleaks; **replace**
   `scripts/workflows.mjs` with zizmor and actionlint; **replace** `scripts/mutate.mjs` with Stryker; **try** a link
   checker, offline, under `scripts/pointers.mjs`; **try** jscpd under `scripts/copies.mjs`; **try** a harness under the
   staged cases; and of what the core lacks, **try** a general linter for its scripts (oxlint, then Biome), ShellCheck
   with actionlint, and knip after the linter.
2. The reading under the package checks: **replace** with `npm sbom`; **try** nuget-license and the SDK's own list.
3. The packages, installed from the core's lock file (#654): as #486's inventory and #519's path have them.
4. The form the rules are delivered in: **try** the skill format (#534, point 8).
