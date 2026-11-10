# Git and GitHub

How work reaches `develop` and, at each milestone, `main`, with nothing lost on the way. Read at the start of every
task. The calls from a cloud session: `modules/github-calls.md`.

- **Work from `develop`:** if you are on `main`, check out `develop` first. Each task on a branch of its own with a PR
  into `develop`, which its builder merges (core archive 5; when: `modules/work-flow.md`, point 1).
- **Push after every commit,** even before the PR opens (a draft if not ready), so nothing is lost if a session dies
  (core archive 6 and 15). Before pushing to a branch whose PR you opened earlier, check whether it merged; if it did,
  start a new branch and PR.
- **Milestones,** so the live project never lags, when the *milestone due* says: a PR from `develop` to `main` carries
  the new work, saying what the owner can try and whether the README is current (fixed first if not; core archive 16),
  merged by the builder once CI is green and the reviews it needs pass (floor rule 8; `modules/reviews.md`), never left
  to him, and the work carries on without waiting (core archive 5 and 25). **Before pushing `develop`,** check the last
  milestone PR: still open, the push adds to it; merged, merge `main` back into `develop` first, then push and open a
  new one.
- **Updates, Dependabot and CodeQL:** `modules/updates.md`.
