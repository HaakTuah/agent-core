# The reasons behind the core: issue #1413, point 3

The index, and how an item is written: `archive/instructions.md`.

#1413.3. **27 November 2026**, #1413, point 3, a design set out by the owner's adviser and agreed to by the owner, in a
     chat session on 26 November 2026, built in release 8. The `release` workflow tags the commit of `main` the trial
     tried, where every check on it passed, not `main`'s newest commit, so pull requests keep merging while a trial
     runs; a fix the trial finds moves the trial to a newer commit, and a tag is never moved. The reason: while the cut
     had to be on `main`'s newest commit, merging stopped for the length of a trial, or the trial ran again on a newer
     commit. It stands behind "A release is cut on the owner's word" in `AGENTS.md`.
