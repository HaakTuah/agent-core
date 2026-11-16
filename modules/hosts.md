# Hosts

Read when a project's repository is to live on a host other than GitHub, when a part of its host a rule needs cannot be
reached, and when a host's part is written. GitHub's part: `modules/github-calls.md`.

**One layer knows no host** (core archive 234; #250). By default every check of the core runs from plain git: from a
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
none. Held by `scripts/check-test.mjs`, in `.github/workflows/tests.yml`, which fails where a workflow the starter kit
calls is neither run by it nor named the host's own.

**Each host's part** (core archive 234): a thin part for what is the host's own: how a job is started on a schedule, how
a review is asked for and read, issues and labels, statuses and checks, how it says who may write to the repository and
who holds its higher right (`modules/teams.md`), and how its own protection of `main` is set. Each names what stands in
inside the repository where the host has none, as GitHub's part does in "What stands in when a part of GitHub cannot be
reached". A host's part is written when a project first needs it, never before: the session that meets a host with none
files it with the core (`README.md`, "Reporting to the core"), saying what the host offers for each, and until it is
written takes the stand-ins GitHub's part names. Reason: a part written before any project ran there would describe a
host no one had tried. Held by nothing yet: a host's part out of reach leaves no mark a check reads.

**Proven host by host** (core archive 234). GitHub is proven: every project of the core's runs there. Any other host
"should work" until a project runs there with `check.mjs` in its pipeline on a pull request whose checks pass, and
reports so to the core, whose design session then names it proven here. It does not mean a project waits for its host to
be proven: it runs the checks from plain git meanwhile. Reason: a host's documentation says what it offers, not that the
core's checks run there. Held by nothing yet.
