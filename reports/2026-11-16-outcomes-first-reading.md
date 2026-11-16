# The outcomes' first reading, 16 November 2026

The first reading of the outcomes #302 asks for (point 3), from history, for 15 September to 15 November 2026: the
numbers before the rules of #303 and the rest of the batch land, kept beside every later state report
(`scripts/outcomes.mjs` reads `reports/outcomes-first-reading.json`, beside this file, for the core). Counts and kinds
only, and none of a private project's.

## How it was taken

- **The measures** by `node scripts/outcomes-read.mjs --repo <repo> --from 2026-09-15 --to 2026-11-15`, as each month's
  report takes them, over the one span with no months added: the pull requests and issues of the span, and item by item
  a sample of the 60 newest merged tasks (idle hours, commits after ready) and of the 60 newest issues closed as done
  (the queue's time).
- **The corrections**, which carried no label before #302, found once by reading: a fresh helper read every issue of the
  span, the comments on issues and pull requests, and the reports and archives that quote the owner, and listed each
  text in the owner's voice that said merged work was wrong, with the pull request it corrects and its kind; its list
  was handed to the script by `--corrections`.
- **How the code grows**, from a checkout of the last commit before 15 November and of the first in the span, read as
  the shape check reads code (the core's own config).

## The core (`HaakTuah/agent-core`)

The repository began on 9 November 2026, so its span is six days: 207 tasks merged.

- **The product does what was asked:** corrections that the task was misread, 2 (± 3), 0.1 for every ten merged
  tasks; that a rule was missing, 1 (± 2); from joining the queue to merged, a median of 2.8 h (of 10 read).
- **It is fast:** no direct measure yet.
- **A newcomer can read and change it:** no direct measure yet; the code was 412 KB in 40 files, 5 of them over 20 KB,
  with 11 functions over 60 lines and 37 over 15 branch points (none at its first commit, which held no code).
- **A new user can use it:** no direct measure yet; corrections that it looks or feels wrong, 0.
- **It does not break:** 3 (± 3) of 207 merges, 1%, followed within two weeks by a correction or a revert; a bug's
  report to its fix live, a median of 4.9 h (of 8); corrections that it does not work, 1 (± 2); unplanned mending,
  5 (± 4), 2%.
- **What the work cost:** corrections of every kind, 4 (± 4), 0.19 for every ten; a merged task, 59 answers and 47,559
  output tokens (of 63 priced), the same for one not corrected after (no corrected task was priced); 426,886 tokens
  carried into each answer, the median (of 63); 6% of 25 open hours in gaps of over an hour (the 60 newest); 93 (± 19)
  commits after ready in 60 pull requests, 32 after a review finding, 15 after a failed check, 46 neither, and 20
  bringing the branch up to date.
- **Corrections found by reading:** 4 (misread 2, rule missing 1, does not work 1), 3 of them unsure of their kind or
  of the pull request they correct; one names no pull request.

## A project of another owner (private)

Read the same way, and its numbers not published here: a private project's measures stand in the core's public files
only where its own owner has said they may (the security review of #450). Nothing of it is kept elsewhere.

## Not taken here

`HaakTuah/amarna-letters` and `HaakTuah/barkstreet-snakes`: this session could read their code but not their issues or
pull requests (its GitHub access reaches them by git alone), and the sessions it started in each, as the core's
"No one is asked before a read" says, rightly took its brief for another session's text and asked their own person
first. Their first reading waits for a session started there (#451).

## What the numbers say, and do not

Every count of corrections is small: no difference between two readings of fewer than 30 is told from chance (± twice
its square root), so the state report adds months until a count reaches 30. Corrections were found by reading, once;
from #302 on they are labelled, so later counts may be higher for being complete rather than for being worse.
