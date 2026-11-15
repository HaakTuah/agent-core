# The core's queue

The order this repository's open issues are built in, and nothing else (`AGENTS.md`, "The queue"). Each line is an
issue, who builds it and what it waits on; the issue holds the rest, its conditions too. The first line that waits on
nothing is next, and a line leaves in the pull request that closes its issue.

**Who:** *builder*, any builder session; *rule builder*, a builder on Opus, who writes the rule from the owner's word
on the issue; *the owner*, no session takes it up before the owner's own word. **The owner's yes** that floor rule 3
asks for is the one given when the line's issue was queued, relayed into its pull request (`AGENTS.md`, "Queued means
wanted").

## In order

| Issue | Who | Waits on |
| --- | --- | --- |
| #254 | rule builder | |
| #256 | rule builder | |
| #252 | rule builder | |
| #296 | builder | |
| #249 | rule builder | |
| #250 | rule builder | #249 |
| #253 | rule builder | |
| #275 | rule builder | #253 |
| #321 | rule builder | #275, or built with it |
| #285 | rule builder | #249 |
| #286 | rule builder | |
| #299 | rule builder | |
| #302 | rule builder | |
| #303 | rule builder | #302 |
| #304 | rule builder, on Fable at high for this batch (its note of 15 November) | #249 |
| #305 | rule builder | #304 |
| #322 | rule builder | #304 and #305 |
| #306 | rule builder | #304 |
| #307 | rule builder | |
| #308 | rule builder | #253 and #304 |
| #309 | rule builder | #304 |
| #318 | rule builder | #304 |
| #310 | rule builder | #256 and #285 |
| #311 | rule builder | #286 |
| #325 | rule builder | #256, #305, #311 and #322 |
| #359 | rule builder | |
| #314 | rule builder | #304 |
| #375 | rule builder | |
| #376 | rule builder | #375, which changes the same files |
| #361 | rule builder, points 1 and 2 only | |
| #350 | builder | |
| #354 | builder | |
| #355 | builder | |
| #391 | builder; the look's task, which overlaps #355, the work-down of the core's listed functions | |
| #337 | builder | |
| #357 | builder | |
| #362 | builder | |
| #370 | builder | |
| #371 | builder | #370, which changes the same part of `scripts/copies.mjs` |
| #386 | builder | #362, which changes the same file |
| #393 | builder | |
| #394 | builder | |
| #390 | builder | |
| #259 | a builder that built none of the batch, on Fable at high for this batch (its note of 15 November) | every line above it |

## Beside any line

They read and change no rule.

| Issue | Who | Waits on |
| --- | --- | --- |

## Not taken up

| Issue | Who | Waits on |
| --- | --- | --- |
| #204 | builder | a stop that was ignored, as the staged case `stop` shows by failing |
| #278 | builder | a project's choice record first naming a Cargo dependency that ships |
| #315 | the owner | the count of its point 3, which the orchestrator posts on it before the release |
| #163 | the owner | on hold |
| #187 | the owner | on hold |
| #188 | the owner | on hold, after #187 |
| #189 | the owner | on hold, after #187 |
