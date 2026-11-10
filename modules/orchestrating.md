# Running builder sessions and lanes

For the orchestrator, the session that starts builder sessions. The builder's own part: `modules/work-flow.md`.

**The orchestrator builds nothing itself** (core archive 27). Every lane, the main lane included, goes to a builder
session of its own, with its own brief, at the builder's model and effort. Helpers belong to builders: a lane is never a
helper of the orchestrator's. It keeps its own context small, for what only it does: claims, starting and handing over
sessions, merging Codex's work, the owner's questions. A session it starts runs at its own effort, and it never waits
for one at a higher effort: the builder does the hard work in its own session (`modules/roles.md`). Only if it cannot
start builder sessions at all does it say so and stop, and the owner starts them. Why: its context is re-read on every
turn, so building in it costs the most; it runs at its own effort, not the work's; and if it dies, every lane stops with
it.

**The rules, re-read when they change** (core archive 42 and 44). A running orchestrator remembers the rules as they
stood when it started, so on every wake, the hourly check included, it pulls `develop`; if any rule file
(`floor/security.md`, rule 3) changed since it last read them, it re-reads the changed parts, passes what touches them
to its running builders in one message, and says so in one line to the owner. The same wake reads the *progress file*'s
diff and acts on what is new (an entry added or moved, an answer of the owner's, a lane opened or a bug put first),
skipping its own builders' done-marks. **Its report on every wake counts** the lanes open and every independent entry it
is not running, each with its reason ("waits on 2y's files" is one, none given is not) (core archive 45); the fallback
reviewer's security reviews since the last wake, each with its PR and why it qualified; and every PR merged on the
security gate's fallback or without passing it.

- **Keep the cache warm** (core archive 10). One session per task, continued for its review fixes and its milestone
  while its context is under an hour old. A new task goes to whichever session does the most work for the fewest tokens
  without losing quality: one already open when the task touches the same files, its context is under an hour old and
  still small, and its last task has merged; otherwise a fresh one, always when a session's context has grown large.
- **Bigger review fixes in a session of their own:** more than about an hour's work goes to a fresh session with the PR,
  the review and nothing else, at the builder's model and effort; the builder goes on.
- **Hand over at once:** start the next session as soon as a task merges, woken by the merge, with an hourly check as
  the fallback.
- **A lane for every independent entry you can see** (core archive 11), each a builder session with its own brief and
  check-in, by `modules/work-flow.md`; the brake ("Usage" in `modules/claude.md`) closes lanes first.
- **Every other provider is spent to its end** (floor rule 16; core archive 76): Codex, and any provider the owner keeps
  only for the projects. Where an environment can read every provider's usage (a server, or a tool there that starts
  agents and reads their usage; never the owner's machine, floor rule 8), the orchestrator spreads the work so each is
  spent by its weekly reset before Claude reaches 90%.
- **Questions go on word for word:** every lane's "Questions for the owner" passed to him exactly as written (core
  archive 7).
