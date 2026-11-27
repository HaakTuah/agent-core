# The core's queue

**Who** (`AGENTS.md`, "The queue"): *rule builder*, one on Opus; *the owner*, none before the owner's word. A line on
points of #460, #484, #486, #534 or #593 has its PR say "Part of" that issue, or "Fixes" it if it merges last.

## In order

Release 8 is these lines, the pull requests open now and the bugs found before its cut.

| Issue | Who | Waits on |
| --- | --- | --- |
| #1413, point 8 | rule builder | the owner's Security-tab record (`needs-owner`) |
| #1202 | rule builder; `AGENTS.md` and what every session here reads at its start | |
| #1504 | rule builder; `roles/orchestrator.md` | #1202 (what a role reads at its start, one at a time) |
| #1505 | rule builder; `roles/shared/work-flow.md` | #1504 (what a role reads at its start, one at a time) |
| #1106 | rule builder | #1505, on the same files |
| #1488 | builder | |
| #1510 | builder | #1508, on the same files |
| #810 | the orchestrator | the batch's end |

## After release 8

Each waits on release 8's cut too.

| Issue | Who | Waits on |
| --- | --- | --- |
| #1118, #1113 to #1116, #1119 to #1121, #1109 to #1111 | rule builder; release 9, one PR each | |
| #1123 | rule builder; release 9 | #974, #1060 (`roles/adviser.md`) |
| #1098, #1133, #1356 | builder; release 9, one PR each | |
| #1472 | builder; release 9 | #1510, on the same files |
| #1475, #1476 | builder; release 9, one PR each | #1472, on the same files |
| #1180, #1181 | rule builder; release 9, one PR each | |
| #1182 | rule builder; release 9 | |
| #812 | builder; on Sonnet (#767); `tests.yml` timing | |
| #767 | rule builder; point 5, then the second trial's result (point 4) | the second trial's twenty, for point 4 |
| #593, points 6, 7 widened, 10 and 11 | rule builder | #593's points 1 to 3 |
| #584 | rule builder | |
| #589, #590 | builder; one PR each | |
| #591 | builder | #589 |
| #587 | rule builder; it may change the floor's topics and what every role reads at its start | #530 |
| #308, #309, #318, #310, #325, #314, #457 | rule builder; one PR each | |
| #484, points 8 to 10 | rule builder | |
| #441, with #484, points 6 and 7 | rule builder | |
| #355 | builder | #530 |
| #542, point 5 | rule builder | #457 |
| #485 | rule builder; it changes the floor (rules 7 and 10) | |
| #486, point 5 | builder | the types record reopening |
| #460, points 2 to 5, one PR each | builder | |
| #502, case 2 | rule builder; it changes what every role reads at its start | |
| #593, points 4 and 12 | rule builder; it changes what a builder reads at its start | |
| #204 | builder; it changes what a builder and the orchestrator read at their start | |
| #416 | builder | #441, on the same files |
| #650, #679 to #682, #707 | rule builder; one PR each | |
| #701 | builder | |
| #739 | rule builder; it changes the game module (`tasks/game-design.md`) | |
| #786 | rule builder; it changes the floor (the threat model) | |
| #831 | rule builder; a page for owners beside the floor, with the rule and check that keep it in step; the floor's wording unchanged | |
| #896 | builder; a check for #887's rule: `scripts/pr-description.mjs`, `scripts/pruning.mjs` | |
| #899 | builder; `tasks/tests.md`, a change that keeps the meaning, its design check stating it | |
| #907 | rule builder; each other tool's part under `tools/`, completing #492's point 14 | |
| #913, #870, #943 | builder; one PR each; #913 a split of `tasks/choices.md`, #943 a split, each its meaning kept | |
| #974 | rule builder; `roles/adviser.md` | |
| #1046 | rule builder; #767's third kind, `AGENTS.md` | |
| #1051 | rule builder; each pull request records its own cost | |
| #1052 | rule builder; `AGENTS.md`, the workflow tries its own settings | #1051 (its point 6); #1046 (`AGENTS.md`, one at a time) |
| #1185 | rule builder; release 9 | #1052 (its trial of when a builder hands over); #1505 (the hand-over mark) |
| #1060 | rule builder; `roles/adviser.md` | #1052 (its record holds it in part); #974 (`roles/adviser.md`, one at a time) |
| #259 | a builder that built none of the batch, on Fable at high for this batch | every line above it |

## Beside any line

They read and change no rule, and wait on release 8's cut.

| Issue | Who | Waits on |
| --- | --- | --- |
| #550 | builder; a case a PR | |
| #553 | builder | #552 |
| #554 | builder | #553 |
| #555 | builder | #534's tools, and #554 |
| #556 | builder | #554; #534's tools, for its linter rules |
| #557 | builder | #556 |
| #558 | builder | #557 |
| #931, #884, #852, #860, #857, #685, #937, #958 | builder; one PR each; `tests.yml` naming each split's new suite | |
| #1064 | builder; splits weighed, each its meaning kept | |

## Not taken up

| Issue | Who | Waits on |
| --- | --- | --- |
| #278 | builder | a project's choice record first naming a Cargo dependency that ships |
| #400 | a session of Kiro | a session of Kiro, which no session here can start |
| #315 | the owner | the count of its point 3, which the orchestrator posts on it before the release |
| #163, #187 | the owner | on hold |
| #188, #189 | the owner | on hold, after #187 |
