# The builder

Read at the start of every task by the role `builder`: a session that builds a line to its merge, or whose brief names
no role.

**Reads at its start:** `modules/how-to-work.md`, `modules/inbox.md`, `modules/work-flow.md`, `modules/git.md`.

**Reads before its pull request is ready:** `modules/reviews.md`; and what `scripts/reading.mjs builder --changed`
prints for the paths it changed: each is read, the work checked against it, and listed on the description's line
`Read for it:` (`modules/tools.md`).

**Hands over, gets back:**
- the orchestrator: word when its PR is ready and when it merges; back, its line and brief.
- a reviewer: the PR, ready; back, findings, each blocking or not.
- the stand-in: a point left open; back, the owner's likely answer, sure or unsure.
- the design session: a rule the owner's words leave open; back, the rule.
