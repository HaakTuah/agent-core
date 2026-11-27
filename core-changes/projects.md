# What a change of the core asks of a project

Read in the core's own repository by whoever builds a check, a writer, a sync note or a step, or anything a project's copy runs: the paths `scripts/`, `setup/` and `.github/workflows/`. Rules of `AGENTS.md`'s "How changes are made here", moved here by theme (#1202); a project's copy carries them as the core's text alone, and its sessions read none of them.

- **Nothing locks a project,** in any owner's project, the core's owner's own included.
  By default, once a project syncs to a release, nothing the release brings stops its work or waits on its owner:
  what an agent can mend alone may bind, and what only the owner can do (a yes the floor names, a setting on the
  owner's account, anything paid) is advisory, reported and labelled `needs-owner` (`scripts/labels.json`) while the
  rest goes on. The trigger is a check the release adds or makes read more, and its actor is whoever builds that check:
  - a pull request that makes something worse than it stood may fail, and the session mends it there; every failure
    says its mend (#254);
  - what stood before the check came, or before it read more, never turns it red: the check keeps a baseline, what
    breaks it today, listed and allowed only to shrink. A sync pull request holds the copy and what the core writes alone, so until the list
    is written the pull request's base counts as it, and the entry of `setup/sync-notes.md` that brings the check
    has a step whose check reads that the list is written: no old breach goes unlisted. The one exception, on the owner's word and no other: the personal-terms check fails a listed term wherever
    it stands, one the project held before and a name a machine's git writes into each commit included, its failure
    saying how the session takes it out in that pull request itself;
  - it adds no billed job, since a private repository on GitHub's free plan pays a whole minute for each job and its
    Actions stop once the month's are spent.

  A baseline is a debt, not an exemption: the project's agents work it down by tasks, at the dose the codebase's state
  sets, never by a red check, and in the core's own repository none may stand (#259). The audits and the cleaning
  share run by themselves in every project; its owner may change the dose with one line of the manifest, and is not
  asked to (`tasks/cleaning.md`). It does not mean that all a release brings arrives advisory or off, nor that old code is left
  alone. Reason: a project that takes the core on trust, from a release, never finds a pull request failing, or work
  waiting on its owner, for something it did not change. Held by `tests/upgrade-test.mjs`, in
  `.github/workflows/tests.yml` on Linux, and on Windows in `release.yml` daily and before each release: a project written by the starter kit of each of the last two releases (npm and .NET,
  the .NET one as Windows holds it, its commits made under a listed name), holding old content of each kind a check
  reads and synced to the commit under test, passes every check of the core unchanged, that mend made, starts no job
  it did not start before, and fails a pull request that adds a copy until the mend its failure words is made; by the
  heading "What it asks of a project" below; and, for the dose, by the scheduled look (`scripts/look.mjs`), which
  reads it from the shape check's baseline (`scripts/dose.mjs`).
- **One process takes the core in** (#1083). By default the starter kit (`scripts/init.mjs`) and every sync
  (`scripts/sync.mjs`) take the core into a repository, a new one or one at any earlier copy, by one process,
  `scripts/converge.mjs` (the kit by the same `converged` of `scripts/core-owned.mjs`), which writes what the core owns
  from the kit's templates at the copy's commit and what the project holds, its kind read from the host (#1095), so both
  end in the same state, and run again changes nothing. The core owns each workflow, Dependabot
  config, issue form, hooks' settings and tool entry file the kit writes, whole, where it is not there, carries the
  core's mark or is what a kit writes for the project; and its part of `AGENTS.md` and `CLAUDE.md`, between its marks.
  A workflow of the core's whose check the one job of the `core.yml` it ends with runs, it takes out (#1083, point 1).
  Each value of the project's that lands in a file it writes is held to its form first (floor topic 5), and where one is
  not, it writes nothing and says the mend. The one condition that changes it: a file the project holds that is not
  the core's, or one the manifest's "Differences" names: the process writes nothing of it and names it as a
  difference, as it names a rule file whose part it cannot tell apart. The trigger is a run of the kit or a sync: the
  session that runs it commits what it wrote in the sync's pull request, which `scripts/pure-sync.mjs`, run from the
  core's `main`, proves equal byte for byte to what the process there writes from the kit at the new pin and the
  project's `main`, so it stays a pure sync (floor rule 8). It does not mean that a project's own rule, workflow or
  setting is changed, a difference it keeps on purpose lost, a check that nothing else runs taken out, or what only the
  owner can do done; nor that the manifest,
  `SECURITY.md`, the threat model, the progress file, the choice records or a check's config is written where it
  stands, nor after the first copy where it does not: each is then a step's to ask, with what it needs beside it, save the keys of the kit's that the copies, shape and licence checks' configs lack whose value
  reads nothing (an empty list, mapping or text, false or null) and whose absence fails no check (a missing "ships" does), which the
  steps' writers add after the sync with every value of the project's kept (#1095, point 5). Reason: a release asked 63 things of each project, 19 of them workflow changes each with two security
  reviews, built by hand from the notes, and a project of another owner held 25 differences from what the kit writes
  for a new one. Held by `tests/converge-test.mjs` and `tests/pure-sync-test.mjs` (a render that differs, a word outside
  the core's part changed, a value out of its form, a deletion the one job does not cover, each refused), by `tests/upgrade-test.mjs`, which takes
  projects of the last two releases through the process and finds the core's files and parts as the kit writes them in
  a new repository of the same kind, and by the copies part's check of
  `scripts/checks.mjs`, in `core.yml`'s job and `copies.yml`'s, which fails a pull request that changes a file or part
  the core marks so that it is not as the core writes it.
- **The core's checks run in a project's own jobs as they stand** (#1093). By default a script of the core that a
  project's own job may run takes what it needs from the core itself: run from a copy, it installs the core's packages
  it needs from the core's lock file (`scripts/packages.mjs`, by `scripts/install.mjs`) once, before it reads, and the
  licence check, the shape check and the suites' selection (`scripts/select.mjs`) bring what a project's workflow once
  carried for them, so no step asks a project to edit its own workflow for an install. The one condition that changes it:
  the install cannot be made (the registry does not answer, the installer is missing); the script then says, as a
  warning, that it did not run and why, with its mend, and fails nothing. The trigger is a check written or widened
  that a project's own job may run: whoever builds it has it take what it needs so, and every mend that names an
  install gives the guarded form (`if [ -f core/scripts/install.mjs ]; then …; fi`). It does not mean that a project's
  own workflow is rewritten by the core, nor that no step asks where its own lookup stands or what its own suites skip
  (#1093), nor that the core's own repository installs as it runs: its jobs name what
  they install, and a package not there fails there. Reason: #1079 turned a project's sync pull request red over
  nothing it changed, and seven steps asked an agent to edit a project's own workflows by hand. Held by
  `tests/upgrade-test.mjs` (a project's own job that runs the copy's scripts on a runner with nothing installed passes
  after the sync with no change of its own) and `tests/packages-test.mjs` (a copy's script with its packages missing,
  installed first, or, where the install cannot be made, a warning that fails nothing), and, for the guarded form,
  `tests/mend-test.mjs`.
- **A writer of the core's and its readers meet in a round trip** (#1108). By default each file the core writes into a
  project (the starter kit, the one process, the sync, and the baselines and records a check or a step writes there) is
  read back in a test by each of the core's own readers that reads it (the YAML and Markdown readers, the readers of
  the checks' configs, the manifest's), written in projects of each kind the upgrade test holds, and the test fails
  where a reader cannot read it or reads another meaning. Nothing changes it. The trigger is a pull request that adds a
  script that writes a file, or a reader of what one writes, or changes the form either takes: its builder adds the
  round trip in the same pull request, in `tests/round-trip-test.mjs` or the writer's own test, and lists the script
  there, or names it there with why it writes nothing a reader of the core reads in a project. It does not mean that a
  property-testing library is added, nor that a project is asked anything. Reason: on 22 November 2026 only the upgrade
  test, a run of whole projects, found that the core's YAML reader could not read the `core.yml` the one process wrote.
  Held by `tests/round-trip-test.mjs`, in `.github/workflows/tests.yml`, which fails a script that writes a file and
  stands in neither of its lists, and a writer whose round trip did not run; that a new reader brings its round trip,
  by none.
- **The host is read and written by the look** (#1092). By default a step of the sync notes whose state is the host's,
  not a file's (a label, a setting, the look's own record, an account's right), is told done by a check of what the host
  answers (its `host` in `scripts/steps/`, `scripts/step-checks-host.mjs`, read through `scripts/host.mjs`), and what a
  step needs written on the host, the labels of the core's list and the look's issues, the daily look's own job writes
  with that job's token, each right it uses named in its workflow's `permissions:` with a comment saying what it is for
  (`.github/workflows/look.yml`, the starter kit's call of it). The one condition that changes it: GitHub refuses the
  read or the write to that token, or shows a setting to the repository's admins alone; then the step is said not read,
  never done, and the look files in one issue, "Settings only the owner gives", labelled `needs-owner`, each setting
  only the owner gives it read as not given, with its link, and each write refused, with the right it would need, naming
  there too the settings it could not read, which the owner's sitting reads. The trigger is the look's run in a project,
  each day, and each sync, which prints what `host.mjs` reads and writes nothing. It does not mean that an agent session
  edits the host for a step with its own sign-in, save where the floor asks it (secret scanning in a public repository,
  floor topic 9), that the look's token gains a right to give a setting only the owner gives, that the value of the
  secret `PERSONAL_TERMS` is read (the workflow says only whether it is given), nor that a step not read fails anything.
  Reason: a step the host holds was left to a session's own sign-in, which reaches past the project and an agent tool's
  automatic mode may refuse, the step then waiting on the owner. Held by `tests/host-test.mjs`, on a stand-in for the
  host: each step read done, not done and not read, the host only read where nothing is to be written, the labels made,
  a write refused said with its right, the issue's text, and each right of the look's workflows named with what it is
  for.
- **A release says what it asks, step by step.** Whoever adds an entry to the sync notes (`setup/sync-notes/`)
  gives it a step in `scripts/steps/` that answers done or not done exactly, never by guessing: a check of its own
  with its mend, worded so a session acts on it with no rule file open; a check of the project's that fails where it
  is not done; or, where no check reads it, why, held by the staged case `steps`. Every standing entry has one. Every sync
  runs them all (`scripts/sync.mjs`) and prints, for the sync pull request's description, only the steps not done, and
  every difference from what the starter kit writes for a new project of the same kind but in the project's own words, which the one process keeps (`scripts/fresh.mjs`; #1361, point 27), and the packages it holds gone stale (`scripts/held.mjs`; #1095); where the core's packages cannot be installed it reads no step and says so
  in one line with its mend, and a step only a tool fetched at set-up reads is read where the session fetched it (#1095,
  points 2 and 4); each is
  a task the project's agents take (`roles/orchestrator.md`; with no orchestrator, the session that syncs), a step
  only the owner can do labelled so, and each difference kept on purpose declared in the manifest's "Differences".
  Where a script does a step exactly, the sync runs it (`scripts/steps.mjs --write`; #1091): it writes a check's config
  or baseline, a pointer's path or the manifest's module lines alone, lists it and sets it aside for the session that
  syncs to commit after the sync's merge, or says why it wrote nothing. The module lines (#1094): where the manifest's
  "Modules:" is a list, each module it neither takes nor leaves out is placed from what `scripts/manifest-reads.mjs`
  reads exactly, and one no fact decides is taken, as the kit takes it, and named on the line "Modules to confirm:",
  which the owner answers once while nothing waits. An entry whose step asks nothing of what stands (`asks: "nothing"`)
  stays in the notes and leaves the report a sync prints. Each release says in one place what it asks and roughly what each ask costs (`scripts/release.mjs`); a project's
  owner may reorder or slow the asks. It does not mean that a sync pull request carries the steps beyond what the core writes (it stays pure), nor
  that a step not done fails or stops anything, nor that a step is told done that no check reads, nor that a step that needs judgement is written by a script, nor that a module the line "Not taken:" names is
  taken without the owner's word. Reason: a
  step written only in prose is where one is missed, and nothing showed that it was; modules placed by hand took a
  judgement a fact settles, and entries that ask nothing hid those that ask. Held by
  `tests/steps-write-test.mjs` (no rule's words changed but the module lines), by `tests/manifest-reads-test.mjs`
  (the modules placed) and `tests/releases-test.mjs` (the entries that ask nothing), by `tests/steps-test.mjs`, which fails an entry with no step and a step with a
  check that cannot be taken out and mended, and by `tests/upgrade-test.mjs`: after the sync every step reads done,
  but one the release adds that it asks of every project (a check's own list to write), which is reported and done
  by its mend as written; each step added since the release started from, taken out, is reported and its mend as
  written makes it done, and steps taken out at random are reported, exactly those, and done by the writers.
- **A check that fails says the mend** (#254). Every check of the core, a script under `scripts/` or
  a workflow's own step that fails a pull request, fails with a line that says what is wrong and where, then "Mend:"
  and what a session does about it, in words it acts on with no rule file open (the form: `scripts/mend.mjs`). Where
  the mend is a step only the owner can take (a yes floor rule 14 names), it says so, and the session's part is the
  issue it files for it. Whoever writes or changes a check writes each failure so, and its test runs it where it fails
  and reads the mend. It does not mean that a project's own checks are asked anything, nor a test's own assertions,
  which are no check. Reason: a session that met a failing check had to find the rule behind it before it could act,
  and on 14 November one stopped at a draft for want of a rule that said what came next. Held by
  `tests/mend-test.mjs`, in `.github/workflows/tests.yml`: each script a workflow names, and each workflow with a
  step that fails by itself, is a check with its test, or is listed with why it fails no pull request, and each
  check's test reads its failures with `mended()`.
- **A check that read nothing says so** (#459, point 2). By default a check of the core's that reads a project's code
  passes where it finds nothing wrong. The one condition that changes it: it found no file there it could read, the
  shape check where its config is missing, its "code" and "tests" name no file of a language its readers know, or the
  manifest turns it off with `none` and the owner's reason, the tests' strength where the manifest names no *mutation
  tool*, or `none`, or Stryker from a folder that holds no lock file, or the shape check's config, whose files it
  measures, is missing or names no file it measures, or the licence check where packages stand in a file it does not read (a package.json with no lock file, a yarn.lock, a pnpm-lock.yaml). Then `scripts/read-nothing.mjs` names it, with the rules of the
  modules the project takes that it holds, in the report every sync prints (`scripts/steps.mjs`), and where it cannot
  tell, the report says so. The trigger is such a check, written or widened: whoever builds it gives it its case in
  `read-nothing.mjs` in the same pull request. It does not mean that it fails anything. Reason: a check that passes on
  nothing makes its rule look held: in a project of another owner a check held 10 of the 75 of the core's rules that
  applied there, and nothing told its owner which. Held by `tests/steps-own-configs-test.mjs`, for the sync's report; that a new
  check gives its case, by none.
