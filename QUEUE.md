# The core's queue

The order this repository's open issues are built in, and nothing else (`AGENTS.md`, "The queue"). Each line is an
issue, who builds it and what it waits on; the issue holds the rest, its conditions too. The first line that waits on
nothing is next, and a line leaves in the pull request that closes its issue.

**Who:** *builder*, any builder session; *rule builder*, a builder on Opus, who writes the rule from the owner's word
on the issue; *the owner*, no session takes it up before the owner's own word. **The owner's yes** that floor rule 3
asks for is the one given when the line's issue was queued, relayed into its pull request (`AGENTS.md`, "Queued means
wanted"). A line on points of #460 or #484 has its PR say "Part of" that issue, or "Fixes" it if it merges last.

## In order

| Issue | Who | Waits on |
| --- | --- | --- |
| #252 | rule builder | |
| #303 | rule builder | |
| #306 | rule builder | |
| #307 | rule builder | |
| #308 | rule builder | |
| #309 | rule builder | |
| #318 | rule builder | |
| #310 | rule builder | |
| #325 | rule builder | |
| #314 | rule builder | |
| #456 | rule builder; it changes the floor (rules 5 and 10), and its PR quotes the owner's yes on the issue | |
| #457 | rule builder | |
| #458 | rule builder | |
| #459, and #484, points 8 to 10 | rule builder | |
| #464 | rule builder | #459, whose list of rules (`scripts/holders.mjs`) it reads |
| #375 | rule builder | |
| #376 | rule builder | #375, which changes the same files |
| #361 | rule builder, points 1 and 2 only | |
| #467 | rule builder | |
| #469 | rule builder; it changes what every role reads at its start | |
| #484, points 1 to 5 | rule builder | |
| #441, with #484, points 6 and 7 | builder; a split of its own, behaviour proven unchanged, judged by #469's measure; where no kind of task reads less, the file stays whole | #469 |
| #471 | rule builder; it changes what the orchestrator reads at its start | #355 and #391, built now, whose work-down takes in `scripts/look.mjs` |
| #350 | builder | |
| #355 | builder | |
| #391 | builder; the look's task, which overlaps #355, the work-down of the core's listed functions | |
| #337 | builder | |
| #426 | builder | |
| #394 | builder | |
| #404 | builder | |
| #405 | builder | |
| #407 | builder | |
| #397 | rule builder; it changes the review guidelines (its PR quotes the owner's yes on the issue) and what the reviewer and the orchestrator read at their start | #467's table and #407's check, which it builds on |
| #460, point 1 (a staged case for floor rule 9) | builder | |
| #460, point 2 (the author's address) | builder | #376, which changes the jobs its step joins |
| #460, point 3 (a copy in a test) | builder | #405, which changes `scripts/copies.mjs` too |
| #460, point 4 (names in descriptions) | builder | #405, which changes `scripts/pointers.mjs` too |
| #460, point 5 (a report's size) | builder | |
| #460, point 6 (billed minutes) | builder | |
| #390 | builder | |
| #204 | builder; it changes what a builder and the orchestrator read at their start | |
| #416 | builder | #441, which changes `tasks/game-design.md` and `scripts/screens.mjs` too |
| #477 | builder | |
| #481 | rule builder; it changes `AGENTS.md` and the README's table of slots | |
| #412 | builder | #481, of which it is one case |
| #259 | a builder that built none of the batch, on Fable at high for this batch (its note of 15 November) | every line above it |

## Beside any line

They read and change no rule.

| Issue | Who | Waits on |
| --- | --- | --- |

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
