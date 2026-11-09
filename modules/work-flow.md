# How work flows

How a builder moves from one task to the next without waiting, and how lanes run beside the main lane. Read at the start
of every task. Leans on `modules/reviews.md` (which PR gets which review, and when one passes) and `modules/usage.md`
(the brake). The orchestrator's part: `modules/orchestrating.md`.

Waiting is lost time and, past an hour, a lost cache (core archive 10).

1. **Review in the background.** When the work is done, mark its draft PR ready (`modules/github-calls.md`), which
   starts its one automatic security review; ask for the code review and the design check when the PR gets them, at
   once (which PR gets which: `modules/reviews.md`); go on with what comes next. Fix what the reviews find in one
   round. Merge only at a 10 from each review it gets (a PR with no review merges on green checks), and only past the
   security gate ("Codex reviews", point 6, in `modules/reviews.md`).
2. **The next task** goes on while this one is reviewed, branched as the project's AGENTS.md says (whether the main
   lane's next task may start from the open PR's branch is the project's own); no lane is ever stacked on another
   lane's branch.
3. **Lanes beside the main lane** (core archive 11). Independent work runs in parallel: different files from every
   open lane, no shared measurement, no waiting on another's result. What runs one at a time is the project's *one at
   a time*. Claim a lane with a draft PR from a fresh branch off `develop`, after checking the open PRs; merge
   `develop` into it before review; change the *progress file* only when it merges.
4. **The brake:** `modules/usage.md`.

**Sessions.** When sessions are started for you task by task, stop when your task is merged, and say in your last
message what merged and what is next; otherwise carry on with the next task.
