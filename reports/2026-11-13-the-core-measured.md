# The core, measured for the first time (13 November 2026)

The owner agreed to have the core measured as it has a game's features measured (core archive 195). This is the first
run of `scripts/core-cost.mjs`, in both games, on the morning of 13 November 2026, four and a half days after the first
game took the core. What the script counts and how is in its header.

## What merged, before the core and since

Pull requests merged into `main`, sorted by what they changed. "The core's share" is the sync PRs and the other
upkeep (rule files, `.github/`, `.claude/`) together, of all that merged.

| Game | When | Merged | Own work | Sync | Other upkeep | Updates | The core's share |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Barkstreet Snakes | before 9 November | 115 | 115 | 0 | 0 | 0 | 0% |
| Barkstreet Snakes | from 9 November on | 109 | 48 | 52 | 9 | 0 | 56% |
| Amarna Letters | before 9 November | 157 | 155 | 0 | 1 | 1 | 1% |
| Amarna Letters | from 9 November on | 120 | 61 | 48 | 10 | 1 | 48% |

Own-work PRs by week, with the lines of own work they changed:

| Week of | Barkstreet Snakes | Amarna Letters |
| --- | --- | --- |
| 26 October | 49 PRs, 86,988 lines | 74 PRs, 247,533 lines |
| 2 November | 35 PRs, 46,760 lines | 68 PRs, 80,005 lines |
| 9 November (to the 13th) | 47 PRs, 8,024 lines | 61 PRs, 16,304 lines |

## What a pull request took

From the line `scripts/session-cost.mjs` prints into a description, which the games have had since 12 November. Of 228
merged PRs, 39 could be priced: 17 in one game and 22 in the other.

| Game | An own-work PR, median | A core PR (sync or upkeep), median |
| --- | --- | --- |
| Barkstreet Snakes | 33 answers, 19,924 output tokens (of 4 PRs) | 88 answers (of 13 PRs) |
| Amarna Letters | 48 answers, 18,112 output tokens (of 6 PRs) | 73 answers (of 16 PRs) |

## What the numbers say, and what they do not

- **About half of what merged since 9 November was the core's upkeep,** in both games: 61 of 109 PRs and 58 of 120.
  Before the core there were none, since the rules then lived in each game and changed with its own work.
- **The games' own work kept its pace in PRs and shrank in size.** As many own-work PRs merged in these four and a
  half days as in a whole week before, but they changed a fifth of the lines or less. Two things beside the core
  explain part of that and cannot be told apart from it here: the weeks before held the large splits and moves, where
  a file moved counts as its lines removed and added again; and both games have since turned to polish and tuning,
  whose PRs are small by nature.
- **These are the weeks the core was built and rolled out,** about thirty changes a day there, each a sync in each
  game. The share should fall as the core settles, and would fall at once for a project that took the core once a
  week and not at every change. The number to watch is this one at the next review of the core: if it has not fallen
  well below half, the core costs more than it was built to.
- **A core PR took more answers than an own-work PR,** by the median, in both games. The samples are small (4 and 6
  own-work PRs priced), and one session often carries a sync and the task that follows it, so this is a hint and no
  finding yet.
- **The cost line is no steady count.** The same session's line drops from one PR to a later one: in the core, 3,566
  answers in #156 and 3,282 in #159, 3,403 in #146 and 3,210 in #147. Claude Code's record of a session can lose
  answers, so "Session so far" understates what a long session has spent, and a PR can be priced only between two
  readings where the line rose in every part. The script counts the rest as not priced and calls what it prints a
  floor. Why the record shrinks was not looked into here; until it is, the line at the end of a description is best
  read as "at least".

Readings taken: the split is by what a PR changed, with the rule files as each game lists them today, so an older PR
that changed a file since renamed counts as own work. Questions for the owner: none.
