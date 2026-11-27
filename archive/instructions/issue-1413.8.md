# The reasons behind the core: issue #1413, point 8

The index, and how an item is written: `archive/instructions.md`.

#1413.8. **27 November 2026**, #1413, point 8, a design set out by the owner's adviser and agreed to by the owner, in a
     chat session on 26 November 2026, its record moved out of the Security tab on the owner's word of 27 November
     2026, built in release 8. A weakness is fixed where it was found; where one of the same kind needs fixing a second
     time, whoever fixes it also fixes its cause, the shared code, check or rule that let both in, in a pull request of
     its own that says only what it hardens. "Twice" is counted from the fixes' own pull requests, in public: each
     carries a label of the core's list and names the kind it hardens against in the general words it already uses,
     never how to attack it. No private record is kept and nothing waits on the owner; the label and the kind say no
     more than the pull request does, and a weakness not yet fixed is never labelled or listed. The owner accepted the
     one cost, that a list by kind makes these fixes easier to find, since they are public already. The record first
     planned in the Security tab was given up once a builder found that no session can keep one there. The reason:
     fixing each case alone leaves the cause to let in the next one, and counting needs no private detail, since
     whoever fixes a second case has the details from its own work. It stands behind "A weakness fixed twice is fixed
     at its root" in `floor/topics/weaknesses.md` and "A fix of a weakness is read for its root" in `tasks/reviews.md`.
