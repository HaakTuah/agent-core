# Nothing reviewed twice

The owner, told that each game's sync PR was being reviewed by Codex again after the same text had passed both reviews in
the core's own PR: never review twice without reason (core archive 139).

- **Floor rule 8:** a pure sync PR (its diff only the core's copy, its pin and the pins of calls to the core's
  workflows, which the core check proves identical to a commit on the core's `main`) gets no code review of its own,
  since the core's PR reviewed that code; its security review still runs, as on every PR, and floor rule 3's reviews
  of a moved workflow call stand. A later commit is reviewed only for what it changes.
- **`modules/reviews.md`:** a pure sync gets no code review (the "Which" paragraph); point 6: after a fix, one
  `@codex review` for it and a security check only as point 3 says; never a draft-and-ready toggle to rerun a PR's
  reviews; a branch brought up to date with `main` without a conflict is not reviewed again.
- **`README.md`, `modules/orchestrating.md`:** the same, for the sync PR; one that also fixes the project's own
  pointers is reviewed like any PR.

What changes in every project: a sync PR waits only for its security review and its checks; no review reruns a pass
already given.

Readings taken: the security review stays on every PR, a pure sync's included, since it costs no request (Codex runs it
by itself when a PR is marked ready) and the floor holds it for every merge. Questions for the owner: none.
