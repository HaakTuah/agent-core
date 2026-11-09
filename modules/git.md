# Git and GitHub

How work reaches `develop` and, at each milestone, `main`, with nothing lost on the way. Read at the start of every
task. Leans on `modules/work-flow.md` (when a PR may merge). `main` itself: `floor/security.md`, rule 12. The calls
that do these things from a cloud session: `modules/github-calls.md`.

- **Work from `develop`:** if you are on `main`, check out `develop` first. Each task on a branch of its own with a PR
  into `develop`, merged by its builder when the suites pass and its reviews pass (core archive 5).
- **Push after every commit,** even before the PR opens (a draft PR if it is not ready), so nothing is lost if a
  session dies (core archive 6 and 15). Before pushing to a branch whose PR you opened earlier, check whether that PR
  was merged; if it was, start a new branch and PR.
- **Milestones,** so the live project never lags: one is due as the project's *milestone due* says. Make sure a PR from
  `develop` to `main` carries the new work, saying what the owner can try; merge it yourself once its CI is green, never
  leaving it to the owner, and carry on without waiting for him (core archive 5 and 25). **Before pushing `develop`,**
  check the last `develop` -> `main` PR: if it is still open, the push adds to it; if it has merged, merge `main` back
  into `develop` first (whatever way the PR was merged), then push and open a new milestone PR.
- **Dependabot, CodeQL and version updates:** `modules/updates.md`; Dependabot's security PRs and what to do with a
  finding: `floor/security.md`, rules 4 and 9.
