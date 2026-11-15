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
| #248 | rule builder | |
| #254 | rule builder | its second point: #234 and #235 |
| #99 | rule builder | |
| #236 | builder | |
| #257 | rule builder | |
| #234 | builder | |
| #256 | rule builder | its staged case: #235 |
| #242 | rule builder | |
| #157 | builder | |
| #252 | rule builder | |
| #235 | rule builder | |
| #249 | rule builder | #235 |
| #250 | rule builder | #249 |
| #185 | builder | |
| #246 | rule builder | #245's report |
| #253 | rule builder | #246 and #245's report |
| #275 | rule builder | #253 |
| #259 | a builder that built none of the batch | every line above it |

## Beside any line

They read and change no rule.

| Issue | Who | Waits on |
| --- | --- | --- |

## Not taken up

| Issue | Who | Waits on |
| --- | --- | --- |
| #204 | builder | a stop that was ignored |
| #278 | builder | a project's choice record first naming a Cargo dependency that ships |
| #163 | the owner | on hold |
| #187 | the owner | on hold |
| #188 | the owner | on hold, after #187 |
| #189 | the owner | on hold, after #187 |
