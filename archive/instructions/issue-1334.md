# The reasons behind the core: issue #1334

The index, and how an item is written: `archive/instructions.md`.

#1334. **26 November 2026**, #1334, a design set out by the owner's adviser and agreed to by the owner, in a chat
     session on 25 November 2026, built in release 8. Beside the read-only run of a release's trial, in each project
     of the owner's own that takes the core, the trial's builder opens the project's real sync as a draft pull request
     pinned to the commit under trial, so that the host's own services that run only on a pull request run on it; a
     check that passes on the project's main and fails on the draft is the release's and stops the cut; the draft moves
     forward with each new commit under trial and, once the release is cut, becomes the project's sync, proven pure
     and merged by hand. Another owner's project, or one whose stop switch stands, is written to not at all, and the
     record says why it has no draft. The reason: at release 6 a read-only trial passed, yet both of the owner's games
     failed the host's dependency review at their syncs after the cut, a check that runs only on a pull request. It
     stands behind "A release is cut on the owner's word" in `AGENTS.md`.
     Changes: #1084.
