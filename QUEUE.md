# The core's queue

The first line that waits on nothing is next.

**Who:** *builder*, any builder session; *rule builder*, one on Opus; *the owner*, no session takes it up before
the owner's word. A line on points of #460, #484, #486, #534 or #593 has its PR say "Part of" that issue, or "Fixes" it if
it merges last.

## In order

| Issue | Who | Waits on |
| --- | --- | --- |
| #715 | rule builder; `tests.yml` steps one by one | |
| #744 | rule builder; it changes the archive's key and its check | |
| #750 | rule builder; it changes floor rule 8 (point 2) | |
| #756 | rule builder | |
| #767 | rule builder; it changes `tools/claude.md`'s table | |
| #704 | builder; `tests.yml` | #715, same file |
| #770 | builder; `tests.yml` | #769 and #704, same file |
| #772 | builder; `tests.yml` | #769 and #770, same file |
| #530, step 5 | builder; licence readers | |
| #593, points 1 to 3 | rule builder | |
| #534, points 1 to 3, 5 to 7 and 9 to 12 | rule builder; point 12 changes `tasks/cleaning.md` | |
| #593, points 8 and 9 | rule builder | #577 |
| #625 | builder | #624 |
| #626 | builder | #624 |
| #627 | builder | #624 |
| #628 | builder | #577 |
| #629 | builder | #624 and #577 |
| #593, points 6, 7 widened, 10 and 11 | rule builder | #593's points 1 to 3 |
| #579 | builder | |
| #580 | builder | |
| #581 | rule builder; it changes `AGENTS.md`'s *mutation tool* | |
| #582 | builder | |
| #583 | builder | |
| #584 | rule builder | |
| #589 | builder | |
| #590 | builder | #580 |
| #591 | builder | #589 |
| #587 | rule builder; it may change the floor's topics and what every role reads at its start | #530 |
| #306 | rule builder | |
| #307 | rule builder | |
| #308 | rule builder | |
| #309 | rule builder | |
| #318 | rule builder | |
| #310 | rule builder | |
| #325 | rule builder | |
| #314 | rule builder | |
| #456 | rule builder; it changes the floor (rules 5 and 10) | |
| #457 | rule builder | |
| #458 | rule builder | |
| #459, and #484, points 8 to 10 | rule builder | |
| #464 | rule builder | #459, whose rule list it reads |
| #361 | rule builder, points 1 and 2 only | |
| #467 | rule builder | |
| #469 | rule builder; it changes what every role reads at its start | |
| #484, points 1 to 5 | rule builder | |
| #441, with #484, points 6 and 7 | rule builder; the file stays whole where #469's measure finds no kind of task reads less | #469 |
| #471 | rule builder; it changes what the orchestrator reads at its start | |
| #355 | builder | #530: the readers left go on the parser #529 brings |
| #542 | rule builder; it changes what the orchestrator reads at its start | #457 |
| #337 | builder | |
| #426 | builder | |
| #404 | builder | |
| #397 | rule builder; it changes the review guidelines and what the reviewer and the orchestrator read at their start | #467 |
| #492 | rule builder; it changes floor rule 4, who may start the orchestrator, and what every role reads at its start | #397 and #467 |
| #485 | rule builder; it changes the floor (rules 7 and 10) | |
| #486, point 1 | rule builder | |
| #486, point 5 | builder | the types record reopening |
| #460, point 2 (the author's address) | builder | |
| #460, point 3 (a copy in a test) | builder | |
| #460, point 4 (names in descriptions) | builder | |
| #460, point 5 (a report's size) | builder | |
| #460, point 6 (billed minutes) | builder | |
| #502, case 1 | builder | |
| #502, case 2 | rule builder; it changes what every role reads at its start | |
| #593, points 4 and 12 | rule builder; it changes what a builder reads at its start | |
| #594 | rule builder; it changes the README | |
| #204 | builder; it changes what a builder and the orchestrator read at their start | |
| #416 | builder | #441, on the same files |
| #650 | rule builder | |
| #661 | builder | |
| #662 | rule builder | |
| #679 to #682 | rule builder; one PR each | #467 |
| #707 | rule builder | |
| #701 | builder | |
| #716 | builder | |
| #551 | builder; #710 adds a line to `tasks/reviews.md` | #642 |
| #739 | rule builder; it changes the game module (`tasks/game-design.md`) | |
| #259 | a builder that built none of the batch, on Fable at high for this batch | every line above it |

## Beside any line

They read and change no rule.

| Issue | Who | Waits on |
| --- | --- | --- |
| #550 | builder; a case a PR | |
| #765 | builder | #756, whose #763 brings the rule |
| #552 | builder | #551 |
| #553 | builder | #552 |
| #554 | builder | #553 |
| #555 | builder | #534's tools, and #554 |
| #556 | builder | #554; #534's tools, for its linter rules |
| #557 | builder | #556 |
| #558 | builder | #557 |

## Not taken up

| Issue | Who | Waits on |
| --- | --- | --- |
| #278 | builder | a project's choice record first naming a Cargo dependency that ships |
| #400 | a session of Kiro | a session of Kiro, which no session here can start |
| #315 | the owner | the count of its point 3, which the orchestrator posts on it before the release |
| #163 | the owner | on hold |
| #187 | the owner | on hold |
| #188 | the owner | on hold, after #187 |
| #189 | the owner | on hold, after #187 |
