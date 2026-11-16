# Keeping up with main once: what is open to the core's account (16 November 2026)

Point 4 of #321 asks first for a look, with a report: whether a merge queue is open to the account, or whether a
branch can be updated only once its other checks have passed. Floor rule 12 stays as it is. This is that look, made by
the rule builder of #275 and #321. It decides nothing.

## Why it matters

The issue's count, of the last 90 merged pull requests in the core and in two projects that take it: 33, 19 and 26 of
them had to merge main in at least once, and each such merge runs every check again. In the core one push's checks
took 10.9 minutes then. `scripts/wait.mjs` reads 15.5 minutes as the median of the last 15 merged pull requests today,
counted from the first check's start to the last one's end on each one's last push.

## What the account has

- **The repository** is public and owned by a personal account, not an organisation (`gh api repos/HaakTuah/agent-core`:
  `"visibility": "public"`, `"owner": { "type": "User" }`).
- **Its ruleset on the default branch** requires a pull request, the status checks `check`, CodeQL's two analyses,
  `size` and `tests` among them, and that a branch be up to date before it merges
  (`strict_required_status_checks_policy: true`). It requires no merge queue.
- **A merge queue.** GitHub turns one on with the ruleset's "Require merge queue" (rule type `merge_queue`). The
  documentation read today does not say which accounts may turn it on. It used to limit it to organisations (any
  public repository an organisation owns, and private ones under GitHub Enterprise Cloud), and a personal account's
  repository was not offered it. This look could not confirm either way, and changes no setting. The test is the
  owner's own screen: the repository's Settings, Rules, the ruleset on the default branch, and whether "Require merge
  queue" is offered among its rules.
- **A branch updated only once its other checks have passed.** GitHub has no setting for that. "Require branches to be
  up to date" fails a pull request behind main, and auto-merge then waits; neither brings the branch up to date by
  itself (only a merge queue does). Bringing it up to date is a session's step, and when it takes it is the session's
  choice.

## What the core already does

The owner's order for this batch, given to the orchestrator, is a merge line: open pull requests merge one at a time,
and only the front one brings itself up to date with main, after its reviews are clean and its own checks have passed.
That is the second option done by hand: each pull request merges main in once, at its turn, and its checks run once
more there. With the selection of #275 (`scripts/select.mjs`), that run reaches only what the pull request itself
changes, since the merge's first parent is the new main.

## What this leaves open

- Whether a merge queue is offered to the account is the owner's screen to read. Where it is, a queue would bring each
  pull request up to date and run its checks once, in place of the merge line's step by hand. Where it is not, the
  merge line stands as the way to do it once. Neither needs a change to floor rule 12: either way `main` changes only
  by a merged pull request, up to date and with its checks passed.
- The merge line is the owner's order for this batch, not a rule. Whether it becomes one is a question for a later
  issue, filed where the owner asks for it.
