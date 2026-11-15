# Git and GitHub

Read at the start of every task. The calls from a cloud session: `modules/github-calls.md`.

- **Work from `main`:** each task on a branch of its own with a PR into `main`, which its builder merges (core archive 5
  and 113; floor rule 12); every merge goes live or into the next release.
- **Each PR has the headings** "What the owner can try" (with whether the README is current) and "Readings taken" (core
  archive 16 and 153), and ends, above its attribution line, with the line `scripts/session-cost.mjs` prints, where it
  prints one: never worked out by hand (core archive 164).
- **Nothing waits silently** (core archive 218): above that line stands one that says what the PR waits on, `Waits on:`
  `nothing`, `a review`, `checks`, `#<n>` or `the owner: <the question, in one sentence>?`, with the label
  `needs-owner` on the PR for the owner; its builder edits it whenever that changes. It does not mean a PR waits on the owner for
  more than floor rule 14 names. Reason: a finished draft stood still and no one was shown it.
- **Push after every commit,** even before the PR opens (a draft if not ready) (core archive 6 and 15).
  - Before pushing to a branch whose PR you opened earlier, check whether it merged; if it did, start a new branch and
    PR.
- **Updates, Dependabot and CodeQL:** `modules/updates.md`.
