# Releases and their trials

Read in the core by whoever builds a release, its trial or a check of either, or takes the core's review or state
report: the kinds `trial` and `audit`, the paths `own-look.yml`, `release*`, `trial-*`, `daily-try*`, `toolchain.mjs`,
`state-report.mjs` and `core-cost.mjs`.

- **A release is cut on the owner's word:** another owner's project takes the core only from a release (`README.md`,
  "How a project takes the core", point 1), so one is cut when the owner says the core as it stands may be handed on,
  never by a session's own choice: the owner's standing word is that it may for each batch whose trial is due ("One
  batch, then one release"). The owner tags nothing by hand: the owner, or a session the owner tells and whose own
  limits let it, starts the `release` workflow on `main` (its page under Actions has the button;
  `.github/workflows/release.yml`), and the workflow cuts it only where every check on the commit it stands on has passed
  and, once the staged cases hold a release ("Staged cases hold what no check reads"), no case failed in its last run:
  the tag `release-N` on that commit, never moved or deleted afterwards. `node scripts/release.mjs` says what the next
  one would carry. **A release is cut from the commit its trial tried** (#1413, point 3). By default the `release`
  workflow tags the commit of `main` that the trial's record on `main`'s newest commit names, where every check on it
  passed, its tests in full and the Windows upgrade test among them, not `main`'s newest commit, so pull requests keep
  merging while a trial runs. The one condition that changes it: the commit named is not of `main`, or does not follow
  the newest release; then the workflow cuts nothing and says the mend, a trial on a newer commit. The trigger is the
  start of the `release` workflow, by whoever starts it. A fix the trial finds moves the trial to a newer commit, whose
  record then names it. It does not mean that a tag is ever moved, that a check passed on a later commit stands for the
  commit tried, or that a release is cut on a merge alone or from a commit whose push's checks failed (floor rule 12).
  Reason: while the cut had to be on `main`'s newest commit, merging stopped for the length of a trial, or the trial ran
  again on a newer commit. Held by `tests/release-test.mjs`, for the commit read, the refusals and the step that reads it, and
  by `tests/workflows-test.mjs`, for the runs read on it. **Each release is tried on a real project first** (#1084). By default, before the `release` workflow
  is started, the orchestrator has a builder at the strongest tier try the release on a copy of a project that takes the
  core and whose owner allows it, the owner's own as `scripts/state-report.mjs --projects` finds them, read-only,
  nothing written there: its checks run as on a pull request (`scripts/check.mjs --base <its main> --own --own-repository --verdicts <a
  file outside every repository>`, the flag only for the owner's own projects) once before the update, as a baseline, and again after it, the sync between; where
  the copy holds no `check.mjs`, or one without `--verdicts`, the baseline is taken with the release's, from a clone of
  the core at the release's commit, run from the project's clone, the core's clone outside it, its verdicts still
  outside every repository, and the record says which way each was taken (#1244); each passed both, failed both
  (standing before), or passed before, or ran not before, and failed after (the release's, which stops the cut), or ran
  before and could not be read after, or could not be read before and failed after (not measured, which stops it too;
  #1257), or ran before and was stopped behind a failure or not run after (which stops it too, the trial run again once
  what stopped it is mended), or ran or was read in neither run (which stops nothing); the sync is read pure or not
  against the release's commit by floor rule 8's proof (`scripts/pure-sync.mjs --trial <the commit>`, a reading whose
  answer stops nothing and proves no merge, though a trial recorded without it for each project stops the cut; #1261);
  it records the counts alone (`node scripts/release.mjs --trial`) in a pull request of its own. Another owner's project
  has its own code run only where no sign-in or key of the owner's is held (floor rule 18). The one condition that
  changes it: no such project allows a trial; the record says so, and so does the release. It does not mean that
  another owner's project is written to, that a project's private code leaves it, or that a project is named anywhere. Reason: #1079 passed every check
  of the core and failed only on a real project, and the sync's proof was first met on one after the cut (#1261). Held
  by `scripts/release.mjs` with `scripts/release-trial.mjs`, which say the trial has not run, and cut nothing, where its
  record does not stand for the commit, cut nothing where a check passed before, or ran not before, and failed after, or
  ran before and was not measured, stopped or not run after, or was not read before and failed after, and refuse the
  record of none allowed where a project of the owner's takes the core, or a record without the sync's reading for each
  project tried (with `scripts/trial-sync.mjs`); where another owner's code may run, by nothing yet.
  **A release's trial opens its update as a draft in the owner's own projects** (#1334). By default the trial runs as
  #1084 says: on a copy of each project that takes the core and allows it, read-only, its checks run before and after
  the sync. Beside that run, in each project of the owner's own, owned by the *owner's account* and found as
  `scripts/state-report.mjs --projects` finds them, the builder of the trial also opens that project's real sync as a
  draft pull request in the project, pinned to the commit under trial. The host's own services that run only on a pull
  request then run on it, the dependency review among them. The builder reads their results with the trial's. A check
  that passes on the project's `main` and fails on the draft is the release's, and stops the cut, as a check that passed
  before and failed after does. Where a fix gives a new commit under trial, the builder moves the same draft forward to
  it. Once the release is cut, the session that syncs that project moves the draft to the release's commit and takes it
  as the project's sync, proven pure by `scripts/pure-sync.mjs`, then marked ready and merged by hand as any sync is
  (floor rule 8). The one condition that changes it: a project the *owner's account* does not own, or one whose stop
  switch stands. There the trial writes nothing, as now, and its record says why no draft was opened. The trigger is
  each release's trial. It does not mean that a project of another owner's is written to, a branch or a pull request
  included; that the draft merges, or is marked ready, before the cut; that the draft holds more than a pure sync, the
  steps' writes coming after its merge as at any sync; nor that the trial adds a job of the core's own in the project:
  the jobs that run are the project's own pull-request jobs, as at any sync. Reason: the host's dependency review runs
  only on a pull request, so a read-only trial cannot see it; at release 6, both of the owner's games failed it at their
  syncs after the cut (#1310). Held by `scripts/trial-draft.mjs`, which reads the draft's checks beside those of the
  project's `main` and gives no answer for a draft of a repository the core's owner does not own, behind a stop switch,
  no longer a draft or pinned elsewhere, and by `scripts/release.mjs` with `scripts/release-trial.mjs` and `scripts/trial-draft-record.mjs`, which cut
  nothing where a check failed on the draft that passed on `main` or ran on the draft alone, or where the record holds fewer
  drafts than the owner's own projects found; that the draft merges no sooner, by the host, which merges no draft, and
  by `scripts/trial-draft.mjs`, which reads none no longer a draft; that it is marked ready no sooner, and that a project
  of another owner's is not written to, by nothing yet.
  **The trial's machine fetches what a project pins** (#1361, point 21). By default, before a release's trial first runs
  a project's checks, its builder runs `scripts/toolchain.mjs` from the clone of the core under trial on the project's
  clone, which fetches the .NET SDK the project's `global.json` pins exactly, the one pin it reads yet, to a folder
  outside every repository, as `scripts/node.sh` fetches Node: only at a version and for a machine whose SHA-512 the
  script's own list holds, checked before anything of it runs; the builder sets what its line prints for both runs. The
  one condition that changes it: the list holds no sum for the pin or the machine, the host does not give the file, what
  it gives differs from the list's sum or version or does not open, the folder would stand in the project, or the
  `global.json` is not read. Then nothing is fetched, the line says why with its mend (an entry added in a pull request
  of the core, as its `--entry` prints it from the publisher's release notes; a host only the owner allows; or, for a
  file that differs, word to the owner), and the job that needs it reads alike before and after the update, so it stops
  no cut. Its trigger is the trial of each release. It does not mean a session widens the environment's network, which
  only the owner does, that a project's pin is changed, that a toolchain is fetched while a check runs, or that the
  machine's own is replaced. Reason: at release 7's trial a .NET SDK band a project pinned was neither in the
  distribution's packages nor reachable, and its job failed after the sync for a reason not the release's. Held by
  `tests/toolchain-test.mjs` (a pin with no sum, a sum that differs and a host that refuses each fetch nothing; a pin
  listed is fetched, checked by its sum, outside the project); that the builder runs it, by nothing yet.
  **A trial's brief is written by a tested script** (#1413, point 1). By default the orchestrator gives the builder of a
  release's trial the brief that `node scripts/trial-brief.mjs <the commit under trial>` prints, and adds to it nothing
  but the name of a project of another owner's, given in private by `--other`. The script finds the owner's own
  projects as `scripts/state-report.mjs --projects` finds them, and sets out each step these rules ask: the clone kept
  read-only, its pushes blocked and the block checked by reading it, never by a push expected to fail; the toolchain;
  the run before the sync and the run after it; the pure-sync reading; the drafts in the owner's own projects; and the
  record. The one condition that changes it: gh gives no answer for the owner's projects; then it prints no brief, its
  failure says the mend, and the trial starts once gh answers. Each release's trial triggers it. It does not mean that
  the brief finds, keeps or writes a project of another owner's anywhere but in what the orchestrator gives in private,
  nor that a step of the brief stands in for the rule it carries out. Reason: release 6's trial took four rounds, and at least one fault lay in a
  hand-written brief, which asked for a test that could never pass on a project the account can write. Held by
  `tests/trial-brief-test.mjs`, which reads the brief for each of those steps and each command as one its script takes;
  that the orchestrator gives it, by nothing yet.
- **The owner's own projects try the core each day** (#1413, point 5). By default, once a day, the core's scheduled look
  tries the core at `main`'s newest commit whose checks all passed on each project of the owner's own that takes it, as
  a release's trial does (#1084): each project alone in a scratch clone on a fresh runner of the core's own, read-only,
  the project's checks run before the sync and after it, and a project is held where the trial's record would hold a cut
  (`scripts/daily-try.mjs`). Where one is held, the look files one bug here, from the counts alone, which waits for no
  line, and notes on it each newer commit held, until it closes. The one condition that changes it: the owner has given
  the core no read-only sign-in to the owner's private projects, the Actions secret `PROJECTS_READ`; then only the
  public ones are tried, and the look files the issue that asks for it, labelled `needs-owner`, closing it once given.
  Its trigger is the look's run each day, never a merge. It does not mean that anything is written to a project, a draft
  included, which stays at a release's trial (#1334); that a project's own jobs run it or are billed for it; that a
  project of another owner is tried; that the bug, a log or anything public names a project, or holds more of it than
  counts and conclusions: a session where gh answers for the owner's account runs `node scripts/daily-try.mjs --local`,
  which runs no project's code, to see which project each runner tried, and a session in that project its checks; nor
  that a held try stops a merge or a release, which the trial still decides. Reason: release 6's faults were found at
  its trial, round after round, long after the changes that brought them in. Held by `tests/daily-try-test.mjs` and
  `tests/daily-try-file-test.mjs` (the owner's projects found with and without the sign-in, names masked, each runner
  cloning its one project alone, the clone keeping no sign-in, each runner's counts read from its own log alone, the
  projects' code given no key, a held project read as the trial reads it, a bug filed once from counts with no name and
  noted again for a newer commit, the sign-in's issue filed and closed); that the look runs it, a project's code as a
  user outside sudo, by `.github/workflows/own-look.yml`.
- **The core is measured as a feature is:** at each review of the core the owner asks for,
  `node core/scripts/core-cost.mjs --cost`, run in each project of the owner's, says what share of its merged PRs were
  the core's upkeep and what a PR took, and `node core/scripts/stand-in-record.mjs` the stand-in's verdicts and how
  many of the owner's answers they matched, and `node core/scripts/review-record.mjs` what each
  review found and the bugs that reached `main` all the same (#234); the numbers go into that review's report, beside
  the last ones'. Where the
  core's share grew and the project's own work did not, the review says why, or what of the core goes for it.
- **The core's state report reads the projects that take it:** each month the session that takes
  the core's state report, where gh answers for the owner's account, adds to it what `node scripts/state-report.mjs --projects` prints:
  the counts of each project whose manifest names this core and that is the owner's, or whose owner gave the core's
  owner access, or whose manifest's row *shares its counts* says `yes`, found each time and listed nowhere by hand. A
  private project is not named, nor one of another owner's ("a project of another owner"), and of either only counts and
  conclusions are carried, nothing of its code or its discussions. It does not mean a project that is merely public is
  read for the report, though a task may read it (`roles/shared/how-to-work.md`). Reason: the owner wants to see how the
  core works in other projects, and only those that hold use to read.
