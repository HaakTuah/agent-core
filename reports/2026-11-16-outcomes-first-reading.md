# The outcomes' first reading, 16 November 2026

The first reading of the outcomes #302 asks for (point 3), from history, for 15 September to 15 November 2026: the
numbers before the rules of #303 and the rest of the batch land, kept beside every later state report
(`scripts/outcomes.mjs` reads `reports/outcomes-first-reading.json`, beside this file, for the core). Counts and kinds
only, and none of a project of another owner's.

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

## A project of another owner

Read the same way, and its numbers not published here: such a project's measures stand in the core's public files
only where its own owner has said they may (the security review of #450). Nothing of it is kept elsewhere.

## The two public game projects, read on 17 November 2026 (#451)

`HaakTuah/barkstreet-snakes` and `HaakTuah/amarna-letters`, which this session could not read in full, were read on
17 November 2026, on the owner's word, by a session that reaches both repositories and their issues and pull requests,
the same way and over the same span: `node scripts/outcomes-read.mjs --repo <repo> --from 2026-09-15 --to 2026-11-15
--corrections <list> --root <checkout>` from the core's `main` at 4929fd5, each checkout at its last commit before
15 November (Barkstreet Snakes d14a7d3a, Amarna Letters 98b1e63c). The corrections were found once by reading each
project's archive of the owner's words: every entry was screened for words that tell of a fault, and the 61 so found,
42 in Barkstreet Snakes and 19 in Amarna Letters, were read around those words; counted, a text in the owner's voice
that said merged work was wrong; not counted, a remark on a pull request still open, a new wish, or an answer to a
design question. Their numbers stand in `outcomes-first-reading.json` as the script keyed them.

### `HaakTuah/barkstreet-snakes`

690 tasks merged in the span.

- **The product does what was asked:** corrections that the task was misread, 5 (± 4), 0.07 for every ten merged
  tasks; that a rule was missing, 4 (± 4); from joining the queue to merged, none (no item joined a queue by its label).
- **It is fast:** no direct measure yet.
- **A newcomer can read and change it:** no direct measure yet; the code's size was not read (the project did not
  take the shape check at that commit).
- **A new user can use it:** no direct measure yet; corrections that it looks or feels wrong, 7 (± 5), 0.1 for every
  ten.
- **It does not break:** 0 (± 0) of 690 merges, 0%, followed within two weeks by a correction or a revert; a bug's
  report to its fix live, a median of 5.5 h (of 14); corrections that it does not work, 0 (± 0); unplanned mending,
  20 (± 9), 3%.
- **What the work cost:** corrections of every kind, 16 (± 8), 0.23 for every ten; a merged task, 104 answers and
  83,494 output tokens (of 21 priced), the same for one not corrected after; 418,617 tokens carried into each answer,
  the median (of 21); 71% of 133 open hours in gaps of over an hour (the 60 newest); 37 (± 12) commits after ready in
  60 pull requests, 10 after a review finding, 16 after a failed check, 11 neither, and 22 bringing the branch up to
  date.
- **Corrections found by reading:** 16 (looks wrong 7, misread 5, rule missing 4, does not work 0), 7 of them unsure
  of their kind or of whether the work was merged.

### `HaakTuah/amarna-letters`

870 tasks merged in the span.

- **The product does what was asked:** corrections that the task was misread, 3 (± 3), 0.03 for every ten merged
  tasks; that a rule was missing, 2 (± 3); from joining the queue to merged, none (no item joined a queue by its label).
- **It is fast:** no direct measure yet.
- **A newcomer can read and change it:** no direct measure yet; the code's size was not read (the project did not
  take the shape check at that commit).
- **A new user can use it:** no direct measure yet; corrections that it looks or feels wrong, 1 (± 2), 0.01 for every
  ten.
- **It does not break:** 0 (± 0) of 870 merges, 0%, followed within two weeks by a correction or a revert; a bug's
  report to its fix live, a median of 1.8 h (of 54); corrections that it does not work, 3 (± 3); unplanned mending,
  48 (± 14), 6%.
- **What the work cost:** corrections of every kind, 9 (± 6), 0.1 for every ten; a merged task, 68 answers and 53,049
  output tokens (of 28 priced), the same for one not corrected after; 397,962 tokens carried into each answer, the
  median (of 28); 24% of 65 open hours in gaps of over an hour (the 60 newest); 31 (± 11) commits after ready in 60
  pull requests, 5 after a review finding, 5 after a failed check, 21 neither, and 14 bringing the branch up to date.
- **Corrections found by reading:** 9 (misread 3, does not work 3, rule missing 2, looks wrong 1), 5 of them unsure of
  their kind or of whether the work was merged.

### What these two readings do not say

- None of the corrections names a pull request: the archives record what the owner said, and seldom which pull request
  it corrects. Two of those that a rule was missing were said once of both projects' rule files, and are counted in
  each.
- A merge followed by a correction or a revert is 0 in both by how it is read, not by evidence: it counts a merge a
  correction names or a revert undoes, and no correction here names one.
- The corrections are an undercount: entries with no word that tells of a fault were not read, nor the comments on
  issues and pull requests one by one, as the core's own reading did. The core's found 4 in 207 merged tasks, these 16
  in 690 and 9 in 870; the three are not counted alike and are not to be compared closely.

## What the numbers say, and do not

Every count of corrections is small: no difference between two readings of fewer than 30 is told from chance (± twice
its square root), so the state report adds months until a count reaches 30. Corrections were found by reading, once;
from #302 on they are labelled, so later counts may be higher for being complete rather than for being worse.
