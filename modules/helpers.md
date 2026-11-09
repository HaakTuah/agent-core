# Helpers: when they pay

When a builder should start helpers (Claude's helpers and, once it can build, Codex's subagents), how many, and how to
brief them. Read before starting a helper. Each tool's models for its helpers: `modules/claude.md`, "For Codex" in
`modules/codex.md`.

A helper starts cold, rereads what it needs and returns only a summary, so it is worth its cost only when the work has
one of these shapes (core archive 25):

- **Parallel and independent:** about three parts or more that touch different files and need nothing from each other,
  a helper for each. Helpers that write run in parallel only when their briefs already fix every choice their parts
  share (the tests, interfaces, names and formats); otherwise one writer does the work, since each parallel writer makes
  choices the others never see, and their work clashes (core archive 60).
- **Competing approaches, judged by measurement:** two to four candidate fixes for one problem, each tried in its own
  worktree and measured the same way (the project's *measurements*); the best is kept, the rest dropped.
- **Bulk to brief:** about ten files or more read to answer one narrow question, a search helper for each question or
  area; it returns file:line and a sentence, so the builder's context stays clean.
- **Fresh eyes:** a review, or a problem that has beaten the builder twice, with one fresh helper each.

It does not pay for small or one-pass work (docs, config, small fixes), for steps that depend on each other, when
briefing it would cost most of the work, or for waiting on a run. **How many:** one for each part, candidate or question
the work has, and at most five at a time, reviewers included, the most that published practice runs at once; a wider
sweep runs in waves of five, and each lane's builder keeps its own five (core archive 61). Give each helper the cheapest
model that does its part well and a brief that stands alone, since it sees nothing else: its goal; what it returns, and
in what form (file:line and a sentence, a diff in its own worktree, a measured table); the files it may change and the
sources it reads; and where its task ends. A vague brief brings back duplicated work and gaps. Check every result before
using it. Never stop to ask about helpers: decide by these shapes.

**Measured:** every PR lists the helpers that ran and what each gave. The first milestone PR of each week sums the
week's lists up in one line: helpers per PR, the shapes they had, what paid and what did not, and how often the cap held
work back. A shape that never pays, or a cap that often holds work back, becomes a `question` issue for the owner, so
the rule and its cap are tuned by what they cost and gave.
