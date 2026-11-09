# When Codex builds

What goes to Codex, how a lane is handed to it, and what happens when it is not there. **Dormant until the owner says
Codex can build** ("Status" in `modules/codex.md`); until then all building is Claude's, and no session needs to read
this file. The project's own table of what goes to whom, and its trials, are in its own rule files (core archive 18).

## What goes to Codex

**Route by how the result can be checked.** If tests, the suites and the project's *measurements* can prove the work
right, Codex builds it, and a wrong result shows itself; if only judgment can (taste, the design, the sources), Claude
does.

- **Claude keeps the decisions and hands them over as tests that fail.** Codex makes them pass without changing them;
  if it thinks one is wrong, it says so on the thread instead of rewriting it.
- **Hand off only when the implementation is clearly bigger than its brief and review:** many files, a few hundred
  lines or more, or long measuring runs. Smaller work Claude does itself. The PR says which was chosen and why.
- **Whole with Claude:** the orchestrator's own work (briefs, routing, readings, merges), and what the project names,
  where the code is the hard part and a brief cannot hold the decisions.
- What runs one at a time stays so: a Codex lane runs beside the main lane, never inside the same files. Codex's first
  task with a part of a helper's shape uses its subagents, so that PR shows whether they start in its cloud, whether
  they keep to five at a time (Codex's own default allows six; if not, its settings set five), and what they give.

## Handing work to Codex

1. **Claim the lane with a draft PR,** as usual: a fresh branch from `develop` with one empty commit ("Claim: ..."),
   and a draft PR into `develop` whose **description is the brief.** Codex starts fresh each time and sees only the
   brief and the repository, so the brief stands alone: the task, the sections and files to read (paths), the tests it
   must pass, what not to touch, and what its report must say ("Readings taken", "Questions for the owner").
2. **Start Codex from the PR.** How is written here once its tasks work; never by a program on the owner's machine.
   Codex works in its cloud, pushes to the PR's branch itself, and reports on the PR.
3. **Questions go on the PR,** both ways: Codex's in its report; the orchestrator answers by adding a section to the
   description ("Round 2: ...") and starting Codex again. At most **two rounds** per question; then the orchestrator
   takes the most reasonable reading and writes it under "Readings taken". Whatever only the owner can settle is filed
   as a `question` issue, and the PR links it.
4. **The PR is then reviewed** as `modules/reviews.md` says, sent back the same way (the review's list added to the
   description, Codex started again), marked ready, and merged by the orchestrator.
5. **The Codex mention** is written only to ask for a review ("Codex reviews", point 1, in `modules/reviews.md`).

## When Codex is not there

Codex's usage can run out with no alert, so the orchestrator never waits on Codex for long:

- **A failure Codex reports** (no usage left, an error, a task that could not be applied) **is a take-back at once.**
- **No sign of Codex starting within about 5 minutes, or no finished work within about 2 hours:** take the lane back.
  Five minutes leaves room for GitHub's delays; two hours, for the suites and a round of fixes.
- **Taking back:** write "Taken back by Claude" on the PR with the reason, and give the lane to a Claude builder.
- **Codex's work never merges after a take-back:** a push that arrives after the take-back is left unmerged, and the
  branch goes to the Claude builder as it stood before.
- **After a take-back for no usage, an error or silence, Codex counts as unavailable:** hand it nothing until a small
  test task gets through, tried at most every few hours (not in use while Codex cannot build). Meanwhile the work is
  Claude's alone. A take-back for a slow PR alone does not count: the next lane still goes to Codex.
- These times are first guesses (core archive 19): change them here when the first weeks show better ones.
