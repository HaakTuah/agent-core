# What the core's workflows cost a private repository for one pull request (15 November 2026)

The owner asked, on 15 November 2026, through the orchestrator:

> 4. Count what the core's own workflows cost a private repository for one pull request: the jobs each push starts,
> times the pushes a pull request gets under "push after every commit". Say whether they can run as one job, and only
> once a pull request is ready, and file what you find.

Counted from the starter kit on `main` at 2501701 (`scripts/init.mjs`, `setup/template/workflows/`) and the core's
reusable workflows they call. GitHub's free plan gives a private repository 2,000 minutes a month, and bills each job
rounded up to a whole minute. Every job below runs on Linux and takes under a minute, except perhaps a restore or an
install, so each job is counted as one billed minute. That is a floor, not a measure. The project's own suites are not
counted, and a Windows job's minutes count double.

## The jobs, by event

A private project from the kit (`--private`, with `--npm` or `--nuget`). The kit writes no CodeQL and no licence
workflow there.

| Workflow | Its triggers | Jobs per event |
| --- | --- | --- |
| `core.yml` | pull request (opened, synchronize, reopened); push to `main` | 1 |
| `copies.yml` | pull request (opened, synchronize, reopened); push to `main` | 1 |
| `personal-terms.yml` | pull request (opened, edited, synchronize, reopened); push to `main` | 1 |
| `pr-description.yml` | pull request (opened, edited, reopened, synchronize, ready_for_review) | 1, skipped on a draft |
| `security-review.yml` | pull request (opened, reopened, synchronize, ready_for_review); a comment | 0: skipped in a private repository while it advises |
| `signatures.yml` (npm) or `nuget.yml` (.NET) | pull request (opened, synchronize, reopened) | 1; `nuget.yml` only where NuGet's files change, after #373 |
| `look.yml` | daily | 1 a day, about 30 a month, not per pull request |

A job skipped by its `if` takes no runner and bills nothing. So each push to a draft starts 4 jobs, and each push once
the pull request is ready starts 5. Marking it ready starts 1, and so does each edit of a draft's description. Each edit
once it is ready starts 2. The merge's push to `main` starts 3.

## How many pushes a pull request gets

`modules/git.md`: "Push after every commit". This batch merged 43 pull requests here, from release-5 (14 November)
to 2501701. Every commit on a branch was pushed, a merge from `main` included. The first is pushed before the
pull request opens, and its `opened` event checks it, so a pull request's runs equal its commits.

- **Median:** 5 commits.
- **Quartiles:** 2 and 7.
- **Range:** 1 to 18.
- **Mean:** 5.9.
- **Total:** 252.

## Jobs and billed minutes per pull request

The model assumes the pull request is marked ready before its last two pushes (a review's fixes, an update from
`main`). Its description is edited once as a draft and twice once ready, as the `Waits on:` line changes
(`modules/git.md`, "Nothing waits silently").

| Commits | Today, with a package check on each run | Today, no package check (a .NET change after #373) | Only once ready | One job (no-secret checks) | Both |
| --- | --- | --- | --- | --- | --- |
| 2 (lower quartile) | 18 | 16 | 17 | 13 | 10 |
| 5 (median) | 31 | 26 | 22 | 19 | 12 |
| 7 (upper quartile) | 39 | 32 | 22 | 23 | 12 |
| 18 (largest) | 83 | 65 | 22 | 45 | 12 |
| All 43, summed | 1,466 | 1,214 | 871 | 891 | 486 |

At the median, a private project spends about 31 billed minutes on the core's checks for one pull request. That is
about 64 pull requests a month before any suite of its own. At this batch's pace, 43 pull requests in about 28 hours,
it would spend 1,466 of its 2,000 minutes in a day. "Only once ready" costs the same however many pushes come before
ready, so it stops growing with the commits.

## Can they run as one job?

Yes, except for one. `core`, `copies`, `pr-description` and the package check (`signatures` or `nuget`) all run with
`contents: read` and no secret, on Node's own modules, so one called workflow can run them as steps of one job.

- **`personal-terms` stays its own job.** It holds the `PERSONAL_TERMS` secret. The package check runs the pull
  request's build files (a NuGet restore) and `copies` runs the pull request's own copy of `core/scripts/`. A secret
  in that job would sit beside code the pull request wrote: a new way in (floor rule 8; topics, rule 2).
- **`security-review` stays its own job.** It needs `statuses: write` and starts on comments.
- **What it costs:** one status in place of three or four, so a ruleset that requires `core`, `copies` or `nuget` by
  name must name the new one. Each check after a failing one must still run (`if: ${{ !cancelled() }}`) so every
  failure is reported. The job's time is the sum of the parts. The package check goes last, so no step after it runs
  in a job that the pull request's build files have touched. Each project changes its calls, one workflow change of
  the trusted builder's with floor rule 3's two security reviews: an ask of the sync notes.
- **What it saves:** 2 jobs a run in place of 4 or 5; 19 in place of 31 at the median.

## Can they run only once a pull request is ready?

Yes. Each pull-request job takes `ready_for_review` among its triggers and `if: ${{ !github.event.pull_request.draft }}`,
as `pr-description` already does.

- **No check needs to see each commit as it lands.** `personal-terms` reads every commit of the pull request's range
  on each run (its header), and the others read the head against the base, so a check once ready misses nothing a
  check on each push would have found.
- **What it loses:** a draft shows no check at all, so a builder learns of a failure only once it marks the pull request
  ready, and pays a round there. A builder can run each check's script before marking it ready (#321 asks for the
  suites before the push).
- **A ruleset:** a job skipped on a draft reports "skipped", which a ruleset counts as passed. A draft cannot merge,
  and marking it ready runs every check again, so nothing merges unchecked.
- **Dependabot:** its pull requests are never drafts, so they are unchanged.
- **What it saves:** 22 in place of 31 at the median, and the count no longer grows with the pushes made before ready.

## Both, and the merge's push to `main`

Together: 12 jobs at the median, 486 in place of 1,466 for this batch. The merge's push to `main` (3 jobs, 2 as one
job) re-checks a head that was checked up to date. It stays: on GitHub's free plan a private repository has no ruleset,
so that run is the only one that catches a merge made without its checks passing or without its branch up to date
(floor rule 12).

## Runs a newer push supersedes

The counts above take each run as one that ends. None did end early: no workflow of the core's cancelled a run once a
newer push, or an update from `main`, made its commit no longer the pull request's head. On 15 November the
core's own Actions held 96 runs queued or running, and 49 of them, about half, were for commits that were no longer any
open pull request's head. Each such run goes to its end, and in a private repository it is billed. With many lanes, and
every branch brought up to date after each merge, a run is superseded more often than it is read. #388, a bug, fixed in
its own pull request, puts each job a pull request starts in a group of its workflow and pull request that a newer run
cancels. A run on `main`, a schedule or a start by hand is never cancelled, and the security-review check keeps its
order. With that, a superseded run bills only the minute it had begun, and the counts above become a ceiling.

## Filed

- #373, bug, fixed in #374: the NuGet step's job on every pull request, and no way to decline it.
- #375, enhancement: the core's pull-request checks run only once a pull request is ready.
- #376, enhancement: the core's pull-request checks without a secret run as one job.
- #388, bug: no run that a newer push supersedes was cancelled.

Both enhancements change what every project runs, so each waits for the owner's yes. Neither is a fault against
"Nothing locks a project": every job counted above stood before that rule, save the NuGet check's.
