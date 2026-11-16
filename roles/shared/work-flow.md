# How work flows

Read at the start of every task.

1. **Review in the background.**
   - When the work is done, read the task's spec again: build what changed, or queue it if large.
   - Mark the draft PR ready and ask for its reviews (`tasks/reviews.md`). Fix every review's findings together.
   - Once every review asked for has answered on the head commit with no finding open, turn on auto-merge
     (`tasks/github-calls.md`; a sync PR is merged by hand: floor rule 8) and go on: GitHub merges when the checks are
     green and the branch is up to date (core archive 135). Where it refuses, the PR already `clean` or `unstable`,
     merge it yourself as floor rule 12 says.
   - A push after that turns auto-merge off first; bringing the branch up to date with `main` keeps it on.
2. **The next task** goes on while this one is reviewed, save under an orchestrator; no lane is stacked on another's.
3. **Lanes beside the main lane** (core archive 11): independent work in different files from every open lane, with no
   shared measurement and no waiting on another's result; never what the project runs *one at a time*.
   - Claim a lane with a draft PR from a fresh branch off `main`, after checking the open PRs; bring it up to date
     before review.
4. **The polish lane** (core archive 145), where people use the project through a screen: what makes it feel finished
   without changing what it does (glitches, layout, tap targets, contrast, reduced motion, wording, console errors, slow
   spots), beside the main lane and never ahead of it.
   - Finds come from every screen of the newest build, at each size it is used at; each is its own small PR, with a
     before-and-after picture and its behaviour proven unchanged.

**The owner's stop switch** (core archive 201): the branch `agents-stop` on the project's own repository, which the
owner creates from any device to stop its agents and deletes to let them go on.
- Every session reads it at its start and before each commit (`git ls-remote origin refs/heads/agents-stop`; the
  work-saved hook says so at the start).
- Where it stands, no task starts, and a running one commits and pushes what it has and stops, saying so.
  - It never stops what the owner then asks a session for in person.
- Where it cannot be read, the session says so.
- It stops only that repository's agents, and no agent creates or deletes it.

**Sessions:**
- Started task by task, stop when your task is merged, saying in your last message what merged and what is next (with
  no orchestrator, also that it can be archived); otherwise carry on with the next task.
- Before that message, on a machine that outlives the session, clean up what you made (core archive 187): what later
  work needs is pushed, what you started is stopped, and your own worktree or clone, scratch files and local branches
  go, save what holds anything uncommitted or unpushed, which you push or leave and name in the message.
- A long task may end a session at a passed gate, with a commit and a note in its PR's description saying where to pick
  up (core archive 143).
- A builder session that no orchestrator started, and the orchestrator on every wake, first checks whether the core
  has moved (`core/scripts/core-moved.mjs --dry`) and syncs it if so (`core/scripts/sync.mjs`, then each step and
  difference it reports), between tasks, a floor change at once: a task ends under the copy it began with (`tasks/planning.md`); where checks cost money, not on a day a sync PR was already opened (core archive 178). Then both read what reviews left after a merge (`tasks/reviews.md`, point 2).

## Git and GitHub

The calls from a cloud session: `tasks/github-calls.md`.

- **Work from `main`:** each task on a branch of its own with a PR into `main` (core archive 5 and 113; floor rule 12).
- **Each PR has the headings** "What the owner can try" (with whether the README is current) and "Readings taken" (core
  archive 16 and 153), and ends, above its attribution line, with the line `scripts/session-cost.mjs` prints, where it
  prints one: never worked out by hand (core archive 164).
- **Nothing waits silently** (core archive 218): above that line stands one that says what the PR waits on, `Waits on:`
  `nothing`, `a review`, `checks`, `#<n>` or `the owner: <the question, in one sentence>?`, with the label
  `needs-owner` on the PR where it is the owner; its builder edits it whenever that changes. It does not mean a PR waits on the owner for
  more than floor rule 14 names. Reason: a finished draft stood still and no one was shown it.
- **Push after every commit,** even before the PR opens (a draft if not ready) (core archive 6 and 15).
  - Before pushing to a branch whose PR you opened earlier, check whether it merged; if it did, start a new branch and
    PR.
- **Updates, Dependabot and CodeQL:** `tasks/updates.md`.
