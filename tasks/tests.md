# What the tests cost

Read when a test or a suite is added, changed or taken out, when the jobs that run them or a pull request's checks
change, when a measurement may run an hour or more, and by the audit's reader (#275, #321): the kinds `test`,
`workflow` and `audit`. How strong the tests are, and a test taken out: `tasks/code-shape.md`. What every check here
reads is the *shape check*'s config.
- **Each test is measured.** By default every test file of a project has its numbers: how long it takes, when it last
  failed for a real reason, how often it failed for no reason (it failed, and passed, on the same commit in the same
  job), and what it alone catches of the faults put in on purpose (#253). `core/scripts/test-record.mjs` reads them,
  from the runs of the workflow that runs the tests, or from the JUnit reports the project's runner writes, and from a
  mutation report whose faults name every test that caught them (`core/scripts/mutate.mjs --every`, or a tool's with
  its bail turned off). The trigger is the audit (`tasks/cleaning.md`): the session that takes its task runs the
  record, and the audit's report shows its table. It does not mean that a number fails anything, nor that a project
  writes the reports for this alone: one whose job runs its tests in one step and writes no report has its suite's
  numbers until it does. Reason: nothing asked what each test is worth, while every session waits on all of them.
  Held by the audit.
- **A pull request runs the tests its change can reach.** By default the job that runs a project's tests runs, on a
  pull request, only those `core/scripts/select.mjs` selects against its base: each test whose imports, followed from
  file to file, or whose code's names of files, reach a file the change touches; a test it adds or changes; one that
  failed last time; and the tests the config names under "select.proof", the project's proof that behaviour was kept
  (a simulation's fingerprint, a replay, a save's round trip), which are never selected out. The one condition that
  changes it: where a changed file's reach cannot be told (a file of no code the readers follow, data, a file gone),
  where no base is told and where the config cannot be read, the whole suite runs. The whole suite runs where it ran
  before: on the default branch, save where the tree passed whole ("A tree that passed is not run again", below), on a
  schedule, before a release, so no job is added. A test that reaches an import the
  readers cannot follow (a path built at run time, a file they do not read) runs on any change; one that reaches files
  by a path it builds, by listing a folder or through a running program, its builder names under "select.whole". The
  trigger is a fault the whole suite finds that the selection left out: its finder mends the map at once, as a bug (a
  name under "select.whole", or the import the readers missed). It does not mean that a test is taken out, nor
  that a project whose suite proves to be needed whole runs less: where the record's numbers show it, its session
  names every test under "select.whole", citing them in that pull request, and nothing is asked of its owner. Reason: the suites ran whole on every pull request, one that changed a line of the queue
  too, and set the pace of every pull request. Held by `core/scripts/steps.mjs`, which reports a project whose job of
  tests selects nothing, and by the whole run on the default branch.
- **A test keeps its place by one of three:** it alone catches a fault, it guards a rule the project states, or it has
  failed for a real reason; the project's proof keeps its place too. The record reads a test as guarding a rule where
  a rule file names its path, or its opening line names a rule file or an issue (`#n`). By default the audit's record proposes each
  other test for removal or for merging with its neighbour, and the audit's reader decides, never by coverage alone,
  each in a small pull request that leaves the tests' strength (`tasks/code-shape.md`) no worse. The trigger is the
  record's table at an audit; a test whose faults no run has counted is never proposed. It does not mean that a test
  is taken out because a script proposed it, nor that a pull request's own work removes tests beyond what its task
  forces. Reason: a study of 5.5 million tests found every failure in about 63 thousand, and judging a test by
  coverage alone loses faults (#275's evidence). Held by the audit.
- **A time mark measures and never fails** (#733). By default each suite a project names in the config's "suites" has a
  mark in seconds, set with room above what it takes today, and is started through the shape check (`--suite`), which
  measures it against its mark and says a job past it as a warning, never a failure; each system's tests can be started
  alone. Nothing changes it. A mark rises only as a breach joins a baseline (`tasks/code-shape.md`, "Never worse"): with
  its reason under "grown", in the pull request too. The trigger is a job past its mark, which its run's warning shows:
  the session that reads it, a builder on its pull request's run or the orchestrator on the default branch's, adds it to
  the open task on the tests' time, or files one where none is open, and that task makes the suite faster (each test
  sets up only what it needs, and runs only where the change can reach), or splits the job, its parts side by side and
  the quick ones first, so a failure shows early; how fast the marks come down is the dose the codebase's state sets
  (`tasks/cleaning.md`). It does not mean the marks go, since the shape check still holds them never worse and the state
  report gives the trend; nor that a long measurement joins a suite, nor that a suite's own failure is the mark's, nor
  that a suite is dropped to meet it: what guards a promise stays. Reason: every session waits on the tests, and under
  floor rule 12 a red default branch stops all merging, where of the core's 8 red runs on it in 24 hours at least 3 were
  a suite past its mark on a slow runner. Held by the shape check's test (`tests/shape-test.mjs`), which reads the
  warning and the pass, and by the audit's fifth question.
- **No test run on a draft** (#733). By default the job that runs a project's tests on its host starts on a pull request
  once it is marked ready, and again on each push after, and runs nothing on a draft. Nothing changes it. The trigger is
  a workflow that runs tests on a pull request: whoever writes or changes it gives its trigger the types opened,
  synchronize, reopened and ready_for_review and skips each of its jobs on a draft; and a builder, before it marks its
  pull request ready, runs in its own working copy the suites its change reaches (`core/scripts/select.mjs`, with
  `SELECT_BASE` the default branch). It does not mean a builder pushes less: it pushes after every commit
  (`roles/shared/work-flow.md`). Reason: in the core 43% of the job-minutes of 24 hours went to runs that a newer push
  replaced before they finished. Held by `tests/workflows-test.mjs`, for the core's own workflow; in a project, by
  nothing yet: which of its workflows runs its tests cannot be read without guessing.
- **The default branch is tested at its newest commit** (#733). By default a run of the tests on the default branch gives
  way to the run of a newer merge, so that when merges come fast one run covers several: whoever writes the workflow
  puts its runs there in one concurrency group that cancels the run in progress. Nothing changes it. The trigger is a
  red run on the default branch: the session that reads it (`core/scripts/merge-line.mjs` says it, where users get a
  release) narrows it, first by the history of the files its failing test names since the last green run, then by
  halving the merges since that run, running the failing suite alone at each half's commit in its own working copy, and
  fixes it before any other merge (floor rule 12; `tasks/hosts.md`). It does not mean a pull request's run, a start by
  hand or the run before a release is cancelled, nor that a red run is merged past. Reason: a batch tested once costs
  less than each merge tested alone, and a break between merges is rare and quickly found. Held, in the core, by the
  concurrency its `tests.yml` gives the runs on main, which the workflows test reads; the narrowing, by nothing yet.

- **The slow suites run once per batch, wherever they run** (#733). By default a pull request's run holds the suites its
  change reaches on one platform, and the platform suites (those on any other platform) and the suites its builders move
  there for their time run at the default branch's newest commit, where it moved since their last run, as often as their
  cost allows: once an hour on the host's free runners, once a night where minutes are billed or the runner is a machine
  of the owner's, and only before a release where the tests run on a computer alone; in full before each release in
  every case. The one condition that changes it: where every merge goes live (the *users get* slot, `merges` where no
  row says), each merge is a release, so the slow suites run before each merge, on its pull request. Where the tests run
  and who pays is read, never asked: `core/scripts/runners.mjs --repo <owner>/<name>` prints both and the schedule, and
  the manifest's rows *test runners* and *billed minutes* only override them. The trigger is a workflow that runs the
  tests on a pull request: whoever writes or changes it moves the platform suites, and any it moves for their time, to
  that schedule. In the core, the Linux suites run after every merge and the Windows suites once an hour
  (`.github/workflows/tests.yml`). It does not mean a public repository takes a runner on a machine of the owner's,
  where a stranger's pull request would run its code (the script prints the advice: forks kept off that job at once, and
  one issue filed for the owner, labelled `needs-owner`), nor that a suite runs less than once before each release, nor
  that a project changes its workflow for this before its builders take it up. Reason: a full run on the default branch
  after every merge holds most of the host's jobs at once and leaves the pull requests waiting, and a slow suite run
  once per change costs most where it is paid for, in money or in a machine's hours; in the core Windows took 69% of the
  pull requests' job-minutes, where about three of its bugs were found by Windows alone. Held by
  `tests/runners-test.mjs`, for what is read, and in the core by its workflow's schedule and matrix, which the workflows
  test reads.

- **A test that fails for no reason is mended or removed, never retried in silence.** By default a test passes or
  fails the same way each time it runs on the same commit. The trigger is a test that failed and then passed on the
  same commit in the same job, which the record names: the session that meets it, or the audit's next cleaning task,
  mends it or takes it out, saying so under "Readings taken". It does not mean that a job is never run again: a job
  run again for a cause outside the tests (a runner lost, the network) says so in the pull request. Reason: a test
  that fails at random teaches every session to run again rather than read. Held by the audit, through the record.
- **A new test says what it guards.** By default a test file opens with a line that names the rule it holds or the
  fault it catches (a module's rule, an issue, a bug's number), and sets up only what that needs (`roles/shared/how-to-work.md`,
  "The smallest setup that tests the rule"). The trigger is a test file a pull request adds: its builder writes that
  line. It does not mean a line for each case inside it, nor that the tests that stand are reworded on demand. Reason:
  a test that names nothing it guards cannot be weighed by the record, and is kept or cut by guess. Held by nothing
  yet: no check can tell whether a line names a rule without guessing, so it is listed, and the reviews read it.
- **A test opens a screen only where the screen is what it guards.** By default a test runs beneath the display,
  through the systems it uses (the rules import no display: `tasks/code-shape.md`); a test opens a screen, a window
  or a device only where that screen, window or device is itself what it guards. The trigger is a test file that
  imports what the config lists under "screens" (a package that opens a browser, a window or a device): the shape
  check counts each, and the time they take is in the record. Those that stood when
  the check came are listed in its baseline and worked down at the dose; a new one fails, and its builder tests the
  thing beneath the screen, or lists the test with its reason under "grown". It does not mean that a project has no
  tests of its screens: they guard what only a screen shows. Reason: a desktop program's suite opened its window
  for test after test, each paying for a screen it did not test. Held by the shape check.
- **A test reaches a real clock or another process only where it guards it** (#457). By default a test runs beneath
  the clock and the process: the time is handed in, and the code a process would run is called from the test itself.
  The one condition that changes it: where the clock or the process is itself what the test guards (a command's own
  line, its exit code, what it prints; a program the test starts and waits for). The trigger is a test file that calls
  or imports what reaches a real clock (a sleep, a timed wait, a read of the time) or starts another process: the shape
  check counts each, by the names it knows for each language and those the config adds under "clocks" and
  "processes", and the record gives the share of the tests' time each takes. What stood is held as the screens' is,
  above; a new one fails, and its builder hands the time in or calls the code itself, or gives the test's reason under
  "grown". It does not mean that such tests go, since they guard what only a running program shows, nor that what a
  test's helpers reach is counted. Reason: in one project's suite (#426), the few tests that started another process,
  or reached a real clock, took most of its time. Held by the shape check.
- **A test asserts no time measured on a real clock.** By default a test that needs time has it handed in, as the
  rules of a program do (`tasks/code-shape.md`), and asserts on that. The one exception is a measure of speed, which
  keeps room above its floor so that a slow machine fails nothing (#318). The trigger is a test that reads the time,
  sleeps or waits on a timer and then asserts a duration: its builder hands the time in instead. It does not mean a
  test never waits for a program it starts. Reason: in one project's suite (#426), the one failure at random in many
  thousands of runs came from a test that asserted a duration on a real clock. Held by the record's list of tests that
  failed for no reason, at the audit.
- **A tree that passed is not run again.** By default, where a pull request's head was up to date with the default
  branch and its whole suite passed on that tree, the run on the default branch for the same tree runs no test again:
  whoever writes a job of tests that a pull request and a push both run gives its selection, on a push, `--passed` with
  the check that gates the tests (`core/scripts/select.mjs`), which finds the merged head's tree, its whole selection
  and that check's pass, as GitHub Actions posted it, and then says `none`, which the job's runner honours, or otherwise
  runs the whole suite; that the head held the default
  branch is read from the tree, never assumed, since floor rule 12 lets a pull request merge without being brought up
  to date where users get a release. A test that reads what no tree holds
  (a release's tag, the day) stays out of the skip. The trigger is a push that merges a pull request with a merge commit. It does not
  mean a run is skipped where the pull request ran a selection only, where it was merged by a squash or a rebase, on a
  re-run, on a schedule or before a release, nor that a job a pull request does not run is skipped. Reason: in one
  project (#426) every push to the default branch ran the whole suite again after its pull request had run it on the
  same tree.
  Held by the selection's own test, and by `core/scripts/steps.mjs`, which reports a job that selects on a push without
  it.
- **What a push waits on has a time mark.** By default the checks of one push, from the first job's start to the
  last job's end, take no longer than the mark the config gives under "wait", in seconds, which rises only as a
  suite's does. The trigger is the monthly state report, which gives the median of the last 30 merged pull requests
  beside the mark (`core/scripts/wait.mjs`): the session that reads it past the mark files the task that brings it
  down. It does not mean that a pull request fails for the time its checks took, nor that a check is dropped or
  merged past before it passes. Reason: once a pull request is ready, its checks set its pace, and in the core one
  push waited about 11 minutes, mostly on one platform's suites. Held by the shape check, which fails a mark raised
  with no reason, and by the scheduled look, whose state report gives the median.
- **A long measurement runs outside the session.** By default a measurement that may run for "long" seconds or more
  (the config's, an hour where it gives none: a first guess) runs neither in a suite nor in the checks of a pull
  request, nor while a session waits on it. The trigger is such a run: its session starts it as a job of the
  project's own, which posts its result on the pull request, then ends at a passed gate with its note
  (`roles/shared/work-flow.md`), and the session that picks the work up reads the result there. It does not mean that the
  core adds a billed job to a project: the job is the project's own to turn on, and with none the measurement runs on
  a machine its owner starts (floor rule 18). Reason: one entry of a project held 130 minutes of measuring inside one
  session. Held by nothing yet: no check can tell how long a run would have taken, so it is listed.
