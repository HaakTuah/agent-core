# The reasons behind the core: issue #1413.7

The index, and how an item is written: `archive/instructions.md`.

#1413.7. **26 November 2026**, #1413, point 7: a design the adviser set out to the owner, who agreed to it. A bug that a
     release's trial finds is built at once, like any bug, with no line in the queue first; and the orchestrator keeps
     at most one pull request open that changes the queue alone, adding new lines to that one while it is open rather
     than opening one for each item. Of the 392 pull requests merged in the core from 19 to 26 November 2026, 47
     changed the queue alone, and each ran the checks and, where its line named an item of the owner's voice through a
     chat session, waited for a code review (#1339): a pull request whose only work is to let other work start. It
     stands behind "A bug a release's trial finds is built at once" in `AGENTS.md` and "One queue-only pull request at
     a time" in `roles/orchestrator.md`.
