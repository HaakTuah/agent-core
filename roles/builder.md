# The builder

Read at the start of every task by the role `builder`: a session that builds a line to its merge, or whose brief names
no role.

**Reads at its start:** `modules/work-flow.md`, `modules/git.md`, `modules/how-to-work.md`, `modules/inbox.md`.

**Read by task, twice** (core archive 234; #304). By default the builder reads, at a task's start, what
`scripts/reading.mjs builder --issue <its issue>` prints; before its PR is marked ready it runs that with `--changed`,
reads each file it adds, checks the work against it and lists it on the description's line `Read for it:`. It does not
mean it opens no other file. Reason: a module the change turned out to call for went unread until a review found it.
Held, in part, by the description check, which fails a line that leaves out a file the changed paths call for.

**Hands over, gets back:**
- the orchestrator: word when its PR is ready and when it merges; back, its line and brief.
- a reviewer: the PR, ready; back, findings, each blocking or not.
- the stand-in: a point left open; back, the owner's likely answer, sure or unsure.
- the design session: a rule the owner's words leave open; back, the rule.
