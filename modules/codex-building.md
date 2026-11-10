# When Codex builds

What goes to Codex, the hand-over, and what happens when it is not there; read by the orchestrator when it routes
work. **Dormant until the owner says Codex can build** (the status below). The project's own table of what goes to
whom, and its trials, are its own (core archive 18).

**Status (3 November 2026): Codex reviews, Claude builds.** Codex cannot build yet: its GitHub tasks and its command
line need a "Codex Cloud (Legacy)" environment, which can no longer be created. So no lane goes to Codex until the owner
says it can build; until then all building is Claude's, and this file is dormant.

## What reaches Codex

Only the owner's own work (floor rule 4): a lane goes to Codex only as a PR HaakTuah opened from a branch here, never
`main`. A Codex task reads the web, so planted text could try to steer it: a Codex PR that changes a
protected file (floor rule 3) is marked failed, the files named, checked by the orchestrator before any merge (the
compare call), and never merged; the owner decides.

## What goes to Codex

**Route by how the result can be checked.** If tests, the suites and the *measurements* can prove the work right, Codex
builds it, and a wrong result shows itself; if only judgement can (taste, the design, the sources), Claude does.

- **Claude keeps the decisions and hands them over as tests that fail.** Codex makes them pass without changing them;
  if it thinks one is wrong, it says so on the thread instead of rewriting it.
- **Hand off only when the implementation is clearly bigger than its brief and review:** many files, a few hundred lines
  or more, or long measuring runs. Smaller work Claude does itself. The PR says which was chosen and why.
- **Whole with Claude:** the orchestrator's own work (briefs, routing, readings, merges) and what the project names,
  where the code is the hard part and a brief cannot hold the decisions.
- **Checks that run the work** (core archive 25): a Codex task also reruns the *measurements* a PR's claims rest on, and
  confirms or corrects them.
- **The review sums route the work:** a category where Codex's builds score lower moves back to Claude; one where they
  do well gets more.
- What runs one at a time stays so: a Codex lane runs beside the main lane, never in the same files. Codex's first task
  with a part of a helper's shape uses its subagents, to show whether they start in its cloud, keep to five at a time
  (if not, its settings set five), and what they give.

## Handing work to Codex

1. **Claim the lane with a draft PR:** a fresh branch from `main` with one empty commit ("Claim: ..."), and a draft
   PR into `main` whose **description is the brief,** standing alone, since Codex sees only it and the repository:
   the task, the sections and files to read, the tests it must pass, what not to touch, and what its report must say
   ("Readings taken", "Questions for the owner").
2. **Start Codex from the PR** (how, written here once its tasks work). It works in its cloud, pushes to the PR's branch
   itself, and reports on the PR.
3. **Questions go on the PR,** both ways: Codex's in its report; the orchestrator answers with a section added to the
   description ("Round 2: ...") and starts Codex again. At most **two rounds** per question; then the orchestrator takes
   the most reasonable reading under "Readings taken". What only the owner can settle is a `question` issue, linked.
4. **The PR is reviewed** as `modules/reviews.md` says, sent back the same way, marked ready, and merged by the
   orchestrator.

## When Codex is not there

The orchestrator never waits on Codex for long (core archive 19):

- **A failure Codex reports** (no usage left, an error, a task that could not be applied) **is a take-back at once.**
- **No sign of Codex starting within about 5 minutes, or no finished work within about 2 hours:** take the lane back.
  Five minutes leaves room for GitHub's delays; two hours, for the suites and a round of fixes.
- **Taking back:** "Taken back by Claude" on the PR with the reason; the lane, and the branch as it stood, go to a
  Claude builder, and a push that arrives later is never merged.
- **After a take-back for no usage, an error or silence, Codex counts as unavailable:** it gets nothing until a small
  test task gets through, tried at most every few hours. A take-back for a slow PR alone does not count.
