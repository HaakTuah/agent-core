# The core's queue

**Who** (`AGENTS.md`, "The queue"): *rule builder*, one on Opus; *the owner*, none before the owner's word. A line on
points of #460, #484, #486, #534 or #593 has its PR say "Part of" that issue, or "Fixes" it if it merges last.

## In order

| Issue | Who | Waits on |
| --- | --- | --- |
| #810 | the orchestrator, for its done-when: reads `main`'s runs, then closes it | a stretch of merges landing faster than a run; at the batch's end, if none came, the orchestrator reads `main`'s runs since #813 and closes #810 on that |
| #812 | builder; on Sonnet (#767); `tests.yml` timing | |
| #767 | rule builder; point 5, then the second trial's result (point 4) | the second trial's twenty, for point 4 |
| #704 | builder; `tests.yml` | |
| #770 | builder; `tests.yml` | #704 |
| #772 | builder; `tests.yml` | #770 |
| #593, points 6, 7 widened, 10 and 11 | rule builder | #593's points 1 to 3 |
| #584 | rule builder | |
| #589 | builder | |
| #590 | builder | #580 |
| #591 | builder | #589 |
| #587 | rule builder; it may change the floor's topics and what every role reads at its start | #530 |
| #308 | rule builder | |
| #309 | rule builder | |
| #318 | rule builder | |
| #310 | rule builder | |
| #325 | rule builder | |
| #314 | rule builder | |
| #457 | rule builder | |
| #459, and #484, points 8 to 10 | rule builder | |
| #441, with #484, points 6 and 7 | rule builder; the file stays whole where #469's measure finds no kind of task reads less | #469 |
| #355 | builder | #530: the readers left go on the parser #529 brings |
| #542, point 5 | rule builder | #457 |
| #675 | builder | |
| #485 | rule builder; it changes the floor (rules 7 and 10) | |
| #486, point 5 | builder | the types record reopening |
| #460, point 2 (the author's address) | builder | |
| #460, point 3 (a copy in a test) | builder | |
| #460, point 4 (names in descriptions) | builder | |
| #460, point 5 (a report's size) | builder | |
| #502, case 2 | rule builder; it changes what every role reads at its start | |
| #593, points 4 and 12 | rule builder; it changes what a builder reads at its start | |
| #204 | builder; it changes what a builder and the orchestrator read at their start | |
| #416 | builder | #441, on the same files |
| #650 | rule builder | |
| #679 to #682 | rule builder; one PR each | |
| #707 | rule builder | |
| #701 | builder | |
| #716 | builder | |
| #739 | rule builder; it changes the game module (`tasks/game-design.md`) | |
| #786 | rule builder; it changes the floor (the threat model) | |
| #831 | rule builder; a page for owners beside the floor, with the rule and check that keep it in step; the floor's wording unchanged | |
| #896 | builder; a check for #887's rule: `scripts/pr-description.mjs`, `scripts/pruning.mjs` | |
| #899 | builder; `tasks/tests.md`, a change that keeps the meaning, its design check stating it | |
| #907 | rule builder; each other tool's part under `tools/`, completing #492's point 14 | |
| #913 | builder; a split of `tasks/choices.md`, its meaning kept | |
| #870 | builder | #925 |
| #943 | builder; a split, its meaning kept | #962 |
| #974 | rule builder; `roles/adviser.md` | |
| #1046 | rule builder; #767's third kind, `AGENTS.md` | |
| #1051 | rule builder; each pull request records its own cost | |
| #1052 | rule builder; `AGENTS.md`, the workflow tries its own settings | #1051 (its point 6); #1046 (`AGENTS.md`, one at a time) |
| #1060 | rule builder; `roles/adviser.md` | #1052 (its record holds it in part); #974 (`roles/adviser.md`, one at a time) |
| #259 | a builder that built none of the batch, on Fable at high for this batch | every line above it |

## Beside any line

They read and change no rule.

| Issue | Who | Waits on |
| --- | --- | --- |
| #732 | builder; a faster check | |
| #550 | builder; a case a PR | |
| #765 | builder | |
| #809 | builder | |
| #552 | builder | |
| #553 | builder | #552 |
| #554 | builder | #553 |
| #555 | builder | #534's tools, and #554 |
| #556 | builder | #554; #534's tools, for its linter rules |
| #557 | builder | #556 |
| #558 | builder | #557 |
| #895 | builder; a test split; `tests.yml` names the suite | |
| #931 | builder | |
| #884 | builder | |
| #852 | builder | |
| #860 | builder | |
| #857 | builder | |
| #685 | builder | |
| #937 | builder | |
| #958 | builder | |
| #1017 | builder; a split, its meaning kept; `tests.yml` names the new suite | |
| #1064 | builder; splits weighed, each its meaning kept | #704 and #772 (`scripts/check.mjs`, `scripts/checks.mjs`, one at a time) |

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
