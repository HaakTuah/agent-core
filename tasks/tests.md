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
- **The tests have a time mark, which never gets worse.** By default each suite a project names in the config's
  "suites" has a mark in seconds, set with room above what it takes today so that a slow runner fails nothing, and is
  started through the shape check (`--suite`), which fails one that passes and took longer; each system's tests can
  be started alone. A mark rises only as a breach joins a baseline (`tasks/code-shape.md`, "Never worse"): with its
  reason under "grown", in the pull request too. The trigger is a suite past its mark: the builder whose change took
  it there makes it faster (each test sets up only what it needs, and runs only where the change can reach), or
  splits the job, its parts side by side and the quick ones first, so a failure shows early; how fast the marks come
  down is the dose the codebase's state sets (`tasks/cleaning.md`). It does not mean that a long measurement joins a
  suite, nor that a suite's own failure is the mark's, nor that a suite is dropped to meet it: what guards a promise
  stays. Reason: every session waits on the tests, and in the core the slowest job set a push's wait. Held by the
  shape check, and by the audit's fifth question.
- **A test that fails for no reason is mended or removed, never retried in silence.** By default a test passes or
  fails the same way each time it runs on the same commit. The trigger is a test that failed and then passed on the
  same commit in the same job, which the record names: the session that meets it, or the audit's next cleaning task,
  mends it or takes it out, saying so under "Readings taken". It does not mean that a job is never run again: a job
  run again for a cause outside the tests (a runner lost, the network) says so in the pull request, and one on the
  default branch is run again and filed as the rule below says. Reason: a test that fails at random teaches every
  session to run again rather than read. Held by the audit, through the record.
- **A check that fails on the default branch has an owner, and is run again once** (#542). By default a check that
  fails on a pull request is its builder's. The one condition that changes it: where a check run on the default
  branch's newest commit ends in failure, it is owned by the session whose merge it followed, while that session still
  runs; otherwise by the orchestrator at its next wake; and with no orchestrator, by the next builder session at its
  start. The trigger is that failure, read before a merge (`tasks/hosts.md`), before a session's last message, at a
  wake or a start, or in the issue the scheduled look keeps while one stands: its owner reads the failure's mend and,
  where it says to run the check again or the failure is of a source that could not be reached, runs the failed jobs
  again, once. A check that then passes on the same commit is unsteady: the owner files a `bug` for the test, naming it
  and what it could not reach or do, or adds the day to the one that stands, and that bug is mended at its cause as any
  is. A check that fails again is a bug that waits for no line, naming the merge it followed ("Brought in by:",
  `roles/shared/inbox.md`). It does not mean a check is run until it passes, nor a second run where the mend names
  something to change, nor a retry the host's workflows make by themselves, which would hide what a second run counts;
  nor that other lanes stop while the default branch is red: they go on, and only merges wait (`tasks/hosts.md`).
  Reason: on 17 November 2026 a suite failed on the core's default branch for a fetch that failed, its mend said to
  run it again, and no session was left to read it, while a release waits on a green default branch. Held by the
  scheduled look, which keeps an issue open while a check on the default branch's newest commit has failed
  (`core/scripts/look.mjs`), and by the staged case `red-main`, for the second run and what is filed.
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
  test's helpers reach is counted. Reason: in the counts of #426, 6% of a suite's tests started another process and
  took 66% of its time, and 21% reached a real clock and took 89%. Held by the shape check.
- **A test asserts no time measured on a real clock.** By default a test that needs time has it handed in, as the
  rules of a program do (`tasks/code-shape.md`), and asserts on that. The one exception is a measure of speed, which
  keeps room above its floor so that a slow machine fails nothing (#318). The trigger is a test that reads the time,
  sleeps or waits on a timer and then asserts a duration: its builder hands the time in instead. It does not mean a
  test never waits for a program it starts. Reason: in the counts of #426, the one failure at random in 26,518 runs of a
  suite came from a test that asserted a duration on a real clock. Held by the record's list of tests that failed for no
  reason, at the audit.
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
  re-run, on a schedule or before a release, nor that a job a pull request does not run is skipped. Reason: in #426's
  counts every push to the default branch ran the whole suite again after its pull request had run it on the same tree.
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
