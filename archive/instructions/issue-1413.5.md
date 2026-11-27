# The reasons behind the core: issue #1413, point 5

The index, and how an item is written: `archive/instructions.md`.

#1413.5. **27 November 2026**, #1413, point 5, a design set out by the owner's adviser and agreed to by the owner, in a
     chat session on 26 November 2026, built in release 8. Once a day, the core at main's newest commit whose checks all
     passed is tried on each of the owner's own projects as a release's trial tries it, read-only, the projects' checks
     run before and after the sync; a project held is filed in the core as a bug, which waits for no line. It runs once
     a day, never on each merge, writes nothing to a project, the real sync drafts staying at a release's trial, adds no
     billed job to a project, tries no project of another owner, and leaves a sign-in only the owner can give to the
     owner, labelled needs-owner, while the try runs where it can. Where it runs was left to the builder: on the core's
     own runners, as jobs of its scheduled look, each project on a fresh runner of its own, with a read-only sign-in the
     owner gives, since a daily session costs usage and the core's public runners cost no minutes; what they print stays
     counts and conclusions. The reason: release 6's faults were found at its trial, round after round, long after the
     changes that brought them in. It stands behind "The owner's own projects try the core each day" in `AGENTS.md`.
