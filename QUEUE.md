# The core's queue

The first line that waits on nothing is next.

**Who:** *builder*, any builder session; *rule builder*, a builder on Opus; *the owner*, no session takes it up before
the owner's own word. A line on points of #460, #484, #486, #488 or #534 has its PR say "Part of" that issue, or "Fixes" it if
it merges last.

## In order

| Issue | Who | Waits on |
| --- | --- | --- |
| #486, points 6 to 8 and 11 | rule builder | |
| #527, step 2 | rule builder | #526 |
| #563 | rule builder; it changes `tasks/cleaning.md`, with the owner's yes on the issue, as #534's line below does | |
| #534, points 1 to 3, 5 to 7 and 9 to 12 | rule builder; point 12 changes `tasks/cleaning.md`, with the owner's yes on the issue | #488's points 1 and 3 to 5 |
| #528, step 3 | rule builder | #527, and #488's points 1 and 3 to 5 |
| #529, step 4 | builder | #528 |
| #530, step 5 | builder | #529 |
| #534, point 8 | rule builder | #530 |
| #488, points 3 to 5, 7 and 8 | builder; #534's tools wait on points 3 to 5 | #488's points 1 and 2 |
| #306 | rule builder | |
| #307 | rule builder | |
| #308 | rule builder | |
| #309 | rule builder | |
| #318 | rule builder | |
| #310 | rule builder | |
| #325 | rule builder | |
| #314 | rule builder | |
| #456 | rule builder; it changes the floor (rules 5 and 10) | |
| #457 | rule builder; point 1's reading of tests for a clock or process waits on #529 | |
| #458 | rule builder | |
| #459, and #484, points 8 to 10 | rule builder | |
| #464 | rule builder | #459, whose rule list it reads |
| #361 | rule builder, points 1 and 2 only | |
| #467 | rule builder | |
| #469 | rule builder; it changes what every role reads at its start | |
| #484, points 1 to 5 | rule builder | |
| #441, with #484, points 6 and 7 | rule builder; a split of its own, behaviour proven unchanged; the file stays whole where #469's measure finds no kind of task reads less | #469 |
| #471 | rule builder; it changes what the orchestrator reads at its start | #355 and #391, which change `scripts/look.mjs` |
| #355 | builder | |
| #391 | builder; the look's work-down of the core's listed functions, which overlaps #355 | |
| #542 | rule builder; it changes what the orchestrator reads at its start | #457, whose rule its point 5 follows, and #355 and #391, which change `scripts/look.mjs` |
| #337 | builder | |
| #426 | builder; a .NET reader it files waits on #529 | |
| #404 | builder | |
| #407 | builder | |
| #397 | rule builder; it changes the review guidelines and what the reviewer and the orchestrator read at their start | #467 and #407, which it builds on |
| #492 | rule builder; it changes floor rule 4, with the owner's yes on the issue, who may start the orchestrator, and what every role reads at its start | #397 and #467 |
| #485 | rule builder; it changes the floor (rules 7 and 10) | |
| #486, point 1 | rule builder | |
| #486, point 5 | builder | the types record reopening |
| #460, point 1 | builder | |
| #460, point 2 (the author's address) | builder | |
| #460, point 3 (a copy in a test) | builder | |
| #460, point 4 (names in descriptions) | builder | |
| #460, point 5 (a report's size) | builder | |
| #460, point 6 (billed minutes) | builder | |
| #502, case 1 | builder | |
| #502, case 2 | rule builder; it changes what every role reads at its start | |
| #390 | builder | |
| #204 | builder; it changes what a builder and the orchestrator read at their start | |
| #416 | builder | #441, on the same files |
| #259 | a builder that built none of the batch, on Fable at high for this batch (its note of 15 November) | every line above it |

## Beside any line

They read and change no rule.

| Issue | Who | Waits on |
| --- | --- | --- |
| #548 | builder | |
| #549 | builder; a workflow, two security reviews | #548, on `scripts/holders.json` |
| #550 | builder; a case a PR | |
| #551 | builder | #549; #355 and #391, for its point 3 |
| #552 | builder | #551 |
| #553 | builder | #552, #355 and #391 |
| #554 | builder | #553 and #355 |
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
