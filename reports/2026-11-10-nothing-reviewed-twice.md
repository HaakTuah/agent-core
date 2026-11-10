# Nothing reviewed twice

The owner, told that each game's sync PR was being reviewed by Codex again after the same text had passed both reviews in
the core's own PR: never review twice without reason (core archive 139).

- **Floor rule 8:** a pure sync PR (its diff only the core's copy, its pin and the pins of calls to the core's
  workflows, all on the core's `main`: the core check proves it, and the merger checks the call to the core check
  itself with the compare call in `modules/github-calls.md`) gets no review of its own, since both reviews passed that
  code in the core's own PR (core archive 139 and 140). A later commit is reviewed only for what it changes.
- **`.github/workflows/core.yml`:** the core check now also fails a pin, or a call's pin, that is not a commit of the
  core's `main` (fetched as `refs/heads/main`, so a tag named `main` can't stand in for it), so a pure sync can only
  carry what passed the core's own reviews (Codex's P1 and the fallback reviewer's two P2s on the first round). The
  call to the core check itself is checked by the merger, outside the PR (`modules/github-calls.md`).
- **`modules/reviews.md`:** a pure sync gets no code review (the "Which" paragraph); point 6: after a fix, one
  `@codex review` for it and a security check only as point 3 says; never a draft-and-ready toggle to rerun a PR's
  reviews; a branch brought up to date with `main` without a conflict is not reviewed again.
- **`README.md`, `modules/orchestrating.md`:** the same, for the sync PR; one that also fixes the project's own
  pointers is reviewed like any PR.

What changes in every project: a pure sync PR waits only for its checks; no review reruns a pass already given.

Readings taken: none. Questions for the owner: none.
