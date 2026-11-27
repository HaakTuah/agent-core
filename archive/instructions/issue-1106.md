# The reasons behind the core: issue #1106

The index, and how an item is written: `archive/instructions.md`.

#1106. **22 November 2026**, #1106: a design the adviser set out to the owner in a chat session, which the owner agreed
     to point by point the same day, for release 7. A project's queue has one orchestrator, which holds a lease on an
     issue of its own, renewed at every wake and read before anything else; the same issue's current text is its
     hand-off, kept current at each change, so that a new orchestrator of any tool or account takes up from it alone,
     started only where no lease is fresh or the holder handed over by a note. A cold orchestrator, with no builder
     running and its last step over an hour old, is replaced by a fresh one rather than woken; one with builders
     running never is. Its wake comes within the cache's hour while work is in flight, set again at each wake, and none
     with nothing in flight. Every builder keeps its hand-off note current at each passed gate. The adviser keeps its
     own cache warm by wakes while the owner is likely to return, never while the owner is likely asleep. On 22 November
     2026 an orchestrator's scheduled wake would have revived it while another account's orchestrator worked the same
     queue, and a wake after the cache lapsed wrote a large context anew at about ten times the cost of a warm one. It
     stands behind "One orchestrator works a queue, by a lease, with its hand-off beside it" and the builder's note in
     "A change of tool loses nothing", both in `tasks/tools.md`; "On every wake" in `roles/orchestrator.md`; "It starts
     orchestrators", "What the owner asks to hear of, it tracks" and "It keeps its cache warm while the owner is likely
     to return" in `roles/adviser.md`; and "A builder hands over by its context" in `roles/shared/work-flow.md`.
     Changes: 200.
