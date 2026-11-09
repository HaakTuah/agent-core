# Running builder sessions and lanes

For the orchestrator, the session that starts builder sessions. The builder's own part is `modules/work-flow.md`.

**The orchestrator builds nothing itself** (core archive 27). Every lane, the main lane included, goes to a builder
session of its own, with its own brief, at the builder's model and effort (for Claude: `modules/claude.md`). Helpers
belong to builders, never to the orchestrator: a lane is never a helper of the orchestrator's. The orchestrator keeps
its own context small, for what only it does: claims, starting and handing over sessions, merging Codex's work, and the
owner's questions word for word. A session it starts runs at its own effort, and it never waits for one at a higher
effort: the builder gives the hard work more effort inside its own session (`modules/roles.md`). Only if it cannot
start builder sessions at all does it say so and stop, and the owner starts them. Why: its context is re-read on every
turn, so building in it costs the most; it runs at its own effort, not the work's; and if it dies, every lane stops
with it.

**The rules, re-read when they change** (core archive 42 and 44). A running orchestrator remembers the rules as they
stood when it started. So on every wake, the hourly check included, it pulls `develop`, and if any rule file
(`floor/security.md`, rule 3) changed since it last read them, it re-reads the changed parts, passes what touches them
on to its running builders in one message, and says so in one line to the owner. Nobody has to tell it. The same wake
reads the *progress file*'s diff since it last looked: it acts on what is new there (an entry added or moved, an answer
of the owner's, a lane opened or a bug put first), opening a lane where one is due, and skips the done-marks its own
builders made. **Its report on every wake counts the lanes:** the lanes open, and every independent entry it is not
running, each with its reason ("waits on 2y's files" is one, none given is not), so a stall shows in one line (core
archive 45); the fallback reviewer's security reviews since the last wake, each with its PR and why it qualified, so
overuse shows the same night; and every PR merged since then on the security gate's fallback, or without passing the
security gate ("Codex reviews", point 6, in `modules/reviews.md`), so a gap shows too.

The aim: as much work done as possible, for the fewest tokens, without losing quality (core archive 17).

- **Keep the cache warm** (core archive 10). One session per task, continued for its review fixes and its milestone
  while its context is under an hour old, rather than a fresh session reading everything again. A new task goes to
  whichever session does the most work for the fewest tokens without losing quality: one already open, when the task
  touches the same files, its context is under an hour old and still small, and its last task has merged; otherwise a
  fresh session, and always one when a session's context has grown large.
- **Bigger review fixes in a session of their own.** If a review asks for more than about an hour's work, start a fresh
  session for it with the PR, the review and nothing else, at the builder's model and effort; the builder goes on.
- **Hand over at once.** Start the next session as soon as a task merges, woken by the PR's merge rather than a clock,
  with an hourly check as the fallback.
- **A lane for every independent entry you can see** (core archive 11), each a builder session with its own brief and
  check-in, by the rules of `modules/work-flow.md`; the brake (`modules/usage.md`) closes lanes first.
- **Questions go on word for word.** Pass every lane's "Questions for the owner" to the owner exactly as written, never
  summed up (core archive 7).
- **No turn sits idle.** Long runs and checks go in the background; nothing waits on a clock.
