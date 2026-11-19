# Hosts

Read when a project's repository is to live on a host other than GitHub, when a part of its host a rule needs cannot be
reached, when a host's part is written, and when ready pull requests are lined up to merge
(`roles/shared/work-flow.md`, "Ready pull requests merge in a line"): the kind `host`; the paths `scripts/check.mjs`
and `scripts/merge-line.mjs`. GitHub's part: `tasks/github-calls.md`.

**One layer knows no host** (#250). By default every check of the core runs from plain git: from a
project's root, `node core/scripts/check.mjs --base <the commit a change merges into>` runs each of the core's workflows
the project calls, step by step in their own shell, on the commit checked out, on a person's machine or in any host's
pipeline, and fails, saying its mend, where one of them fails; with no base, as on a push to `main`. Where the project
calls none from `.github/workflows`, the starter kit's calls are run. On a host other than GitHub, the project's
pipeline runs it on every change into `main`, from a clone of the core at the pin `main`'s manifest holds, never from
the change's own copy, which the change could have edited; and a session runs it before marking a pull request ready. It
runs the change's own code (its copy's scripts, its packages' restore), as its tests do, so a pipeline runs it where no
sign-in or key is held but the host's own for that pipeline. It does not mean that a check of the host's own runs there
(a review app's status, the dependency review, code scanning, a job started by a schedule): it names each and runs none,
and the host's part says what stands in. Reason: every check was a GitHub workflow, so a project on another host had
none. Held by `tests/check-test.mjs`, in `.github/workflows/tests.yml`, which fails where a workflow the starter kit
calls is neither run by it nor named the host's own.

**Each host's part:** a thin part for what is the host's own: how a job is started on a schedule, how
a review is asked for and read, issues and labels, statuses and checks, how it says who may write to the repository and
who holds its higher right (`roles/shared/teams.md`), and how its own protection of `main` is set. Each names what stands in
inside the repository where the host has none, as GitHub's part does in "What stands in when a part of GitHub cannot be
reached". A host's part is written when a project first needs it, never before: the session that meets a host with none
files it with the core (`README.md`, "Reporting to the core"), saying what the host offers for each, and until it is
written takes the stand-ins GitHub's part names. Reason: a part written before any project ran there would describe a
host no one had tried. Held by nothing yet: a host's part out of reach leaves no mark a check reads.

**Proven host by host.** GitHub is proven: every project of the core's runs there. Any other host
"should work" until a project runs there with `check.mjs` in its pipeline on a pull request whose checks pass, and
reports so to the core, whose design session then names it proven here. It does not mean a project waits for its host to
be proven: it runs the checks from plain git meanwhile. Reason: a host's documentation says what it offers, not that the
core's checks run there. Held by nothing yet.

**The merge line follows the host** (#702). By default the line of ready pull requests that `roles/shared/work-flow.md`
sets is kept by hand. Where the host offers a merge queue for the repository and it is on, the queue takes the line, and
bringing branches up to date by hand has nothing to act on; where it is offered and off, turning it on is a setting only
the owner makes: the session that first reads it so files one issue for the owner, labelled `needs-owner`, where none
stands, and nothing waits on it ("Nothing locks a project"). Whether a branch must be up to date before it merges,
whether a queue is offered and on, and whether runner minutes are billed are read from the host, never declared: `node
core/scripts/merge-line.mjs --repo <owner>/<name>` prints what it read and what follows, and the manifest's rows *merge
queue* and *billed minutes* only override it. It does not mean a project is moved to another account or plan to gain a
queue, nor that a branch merges behind the default branch (floor rule 12). Reason: what is cheapest differs by kind of
repository (a person's public one has free minutes and no queue, an organisation's public one is offered the queue, a
private one pays for its minutes), and no project should make a worse choice for what fits another. Held by
`tests/merge-line-test.mjs`, which reads each kind, in `.github/workflows/tests.yml`.

**Where the front waits behind the cap, runs far from their turn are cancelled** (#702). By default no run is cancelled.
Where the line is kept by hand and the front pull request's run stands queued behind the host's cap on jobs at once, the
orchestrator cancels the queued runs of the pull requests into the default branch not next in line: `node
core/scripts/merge-line.mjs --repo <owner>/<name> --cancel <front>,<next>`, which cancels nothing while the front's run
is not queued, and nothing where no up-to-date branch is asked or a merge queue keeps the line, since no turn would run
those checks again. It does not mean a check is skipped: each runs again when its pull request is brought up to date in
its turn, and nothing merges without every check passed on its head; a run of the front's, the next's or the default
branch's is never cancelled, and where the sign-in may not cancel, the session says so and the line goes on. Reason: a
run on a branch that will be brought up to date again is thrown away, and while it holds a slot the whole line waits.
Held by `tests/merge-line-test.mjs`, for the runs it spares; when to cancel, by nothing yet: a queued run is no breach a
check reads.
