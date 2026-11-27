# The reasons behind the core: issue #1413, point 4

The index, and how an item is written: `archive/instructions.md`.

#1413.4. **27 November 2026**, #1413, point 4, a design set out by the owner's adviser and agreed to by the owner, in a
     chat session on 26 November 2026, built in release 8. A release is cut from part of the queue, not only once the
     queue is worked through: once enough lines have merged since the last cut, or enough time has passed with at least
     one merged, the orchestrator starts a release's trial, and the lines after go to the next batch; the owner's
     standing word that a release is cut each time the queue is worked through covers each such batch. It was built
     after points 1, 3 and 5, which made each release cheaper. The numbers were left to the builder with the stand-in:
     ten lines, or seven days with at least one, counted from the commit the newest release stands on, a line merged
     being an issue a line of the queue named that closed as completed since; the scheduled look keeps an issue while a
     trial is due. The reason: a big batch holds every fix in it back for weeks. It stands behind "One batch, then one
     release" in `AGENTS.md`.
