# Who does what

The roles every rule names, who fills each today, escalation, and who merges. Read when a task needs a role's part.
Every rule names a role, never a model, so any model can fill a role when it can; this is the one place that says who
fills each today. Each role works from the project's AGENTS.md and the files it names, whichever model fills it. The
models and effort Claude Code gives each role: `modules/claude.md`. Codex's part: `modules/codex.md`.

- **The orchestrator** (today: Claude): it writes Codex's briefs, routes the work, takes the readings, merges Codex's
  PRs, and brings the owner his questions (`modules/orchestrating.md`).
- **The builders:** Claude's builder sessions, and, once it can build, Codex in OpenAI's cloud, started from a draft PR
  whose description is its brief (`modules/codex-building.md`). **The trusted builder,** whose lanes alone may change
  the protected files (`floor/security.md`, rule 3): Claude's builder sessions.
- **The code reviewer is the other company's model.** Claude's PRs get Codex's code review (`modules/reviews.md`);
  Codex's PRs get **the fallback reviewer,** Claude's reviewer, which also takes Claude's PRs when Codex does not answer
  in time. It holds the picture of the finished project and sends the work back until it meets it (core archive 18).
- **The security reviewer:** Codex's automatic security review; its fallback, the fallback reviewer ("Codex reviews",
  point 6, in `modules/reviews.md`).
- **The design checker** (today: Claude): the design check with a score on the *design-checked PRs* ("Codex reviews",
  point 5).
- **Planning design** (today: Claude): the *planning design* the project names, asked directly when a task needs a new
  or better plan, at most once per task, with a self-contained brief (the problem, the measurements, the files and
  lines). It returns a design, which the builder builds and measures.
- **The hard work:** the project's *hard work*. The builder gives it more effort inside its own session, never by
  waiting for another session (for Claude: `modules/claude.md`).
- **Escalation:** a problem that has defeated a builder twice goes to a fresh solver with a self-contained brief (the
  problem, what was tried, the files and lines); the builder who was stuck applies and checks the answer. The other
  model comes first once Codex can build ("Status" in `modules/codex.md`): a problem that has defeated Claude goes to
  Codex as a draft PR from the stuck branch whose description is the brief, merged into the stuck branch if it works.
  Otherwise, and for one that has defeated Codex, it goes to Claude's escalation step, then its last escalation
  (`modules/claude.md`). Whatever is still unsolved is blocked ("Don't loop" in `modules/how-to-work.md`) (core archive
  25).
- **Who merges:** Claude's builders merge their own PRs (`modules/git.md`), once the review's verdict
  (`modules/reviews.md`) allows, and apply the score rules themselves. **Codex never merges:** the orchestrator merges
  its PRs. Codex never touches `main`, and never pushes to a branch it was not given.
