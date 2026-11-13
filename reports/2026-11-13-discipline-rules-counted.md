# The discipline-only rules, counted (13 November 2026)

The audit of what holds each rule (`reports/2026-11-13-what-holds-each-rule.md`) found 43 rules that only discipline
holds, gave no verdict on them, and said what a rule is worth shows in whether it is ever cited. The owner asked for
that count and a proposal of what to cut or merge. This is it. It changes no rule. From a session the owner asked to
review the core, not the design session.

## The answer

**One rule is a candidate to go: "Match effort to the task" (`modules/how-to-work.md`).** The other 42 stay. The count
does not show a set of dead rules: 33 of the 43 show in at least one pull request's "Readings taken" or comments, and
each of the 10 that never do was read again, below, for what it does. Most of those are one line that sends a session
to a module it would not otherwise open, or that carries an obligation said nowhere else.

Two rows of the audit are better counted another way, which changes no text: the five rules of `modules/helpers.md`
are one rule in a 1 KB file, and "The fallback reviewer's brief" tells how and binds no one. Counted so, 38 rules are
held by discipline alone, six of them the floor's.

Where the weight of the rules can still come down is not here but in the checks that would hold a rule a machine can
read exactly (the two open ideas on such checks), and in `modules/game-design.md`, the largest module, which only
review holds and which this count did not cover.

## How it was counted

Every pull request of the two projects the owner builds with the core, as GitHub held them on 13 November: 695 in one,
877 in the other, with every comment and review comment on them. For each rule, a pattern of its own words (its name,
its number, the phrases a session uses when it follows or cites it). Two counts for each project, as "cited / named":

- **cited:** pull requests where the pattern shows in the description's "Readings taken" or in a comment or review
  comment (a request for a review left out). This is the audit's measure: a reading, a finding, a late review.
- **named:** pull requests where it shows anywhere, the rest of the description included.

The count is rough, and says so where it matters: a pattern such as "lane" or "helper" counts a subject, not a rule
being invoked, and a rule about how a session acts is kept without a word far more often than it is cited. A zero is a
reason to read the rule again, never proof that it is dead. The rules are older than the core: most stood in each
project's own rule files before 9 November, and the count covers those weeks too.

## Rule by rule

| Rule | First project | Second project | Verdict |
| --- | --- | --- | --- |
| `floor/`: Nothing runs on the owner's computer unless the owner starts it | 3 / 10 | 4 / 13 | Stays: the floor. |
| `floor/`: Each project's files stay in its own repository | 0 / 1 | 2 / 3 | Stays: the floor. |
| `floor/`: Nothing waits for the owner but the yeses the floor names | 11 / 37 | 11 / 34 | Stays: the floor, and in steady use. |
| `floor/`: Where agents hold sign-ins | 5 / 8 | 3 / 6 | Stays: the floor. |
| `floor/`: A weakness in merged code that reaches what the threat model protects: reported privately | 1 / 6 | 2 / 4 | Stays: the floor. |
| `floor/`: Any other weakness in merged code: a bug issue, fixed with priority | 1 / 14 | 4 / 15 | Stays: the floor. |
| `modules/claude.md`: Fable's usage runs out first | 25 / 43 | 27 / 43 | Stays: in steady use. |
| `modules/claude.md`: Who to call (a helper for judgement only when it ranks above you) | 0 / 17 | 0 / 17 | Stays. Never cited, and it need not be: it decides which helper a session starts, and the hook holds the half a machine can (model and effort on the call). |
| `modules/claude.md`: Other providers first | 0 / 5 | 0 / 5 | Stays. One line, read at every start, and the only thing that sends a builder to "The builders" in `modules/roles.md`, which is read only when needed. |
| `modules/helpers.md`: Parallel and independent | 2 / 12 | 1 / 13 | Stays, counted as one rule with the four below: a 1 KB file read only before helpers start. |
| `modules/helpers.md`: Competing approaches | 0 / 5 | 0 / 3 | As above. |
| `modules/helpers.md`: Bulk to brief | 1 / 11 | 1 / 13 | As above. |
| `modules/helpers.md`: Fresh eyes | 0 / 5 | 0 / 4 | As above. |
| `modules/helpers.md`: At most five at a time, a brief that stands alone, every result checked | 20 / 164 | 33 / 188 | As above; helpers are named in every fifth pull request. |
| `modules/how-to-work.md`: A question from the owner is a question | 2 / 3 | 2 / 3 | Stays: the owner's own words (core archive 25), and cited when it mattered. |
| `modules/how-to-work.md`: Match effort to the task | 0 / 0 | 0 / 2 | **The one candidate to go.** Never cited in either game, no archive item behind it, and it says again what the file's first line says ("the cheapest approach that does it well" against "at the lowest cost now and later"). |
| `modules/how-to-work.md`: Edit in place, and don't loop | 5 / 13 | 3 / 7 | Stays: cited where a builder changed approach or marked a task blocked. |
| `modules/inbox.md`: Nothing goes to the owner to be answered | 2 / 4 | 2 / 3 | Stays. Its first clause repeats floor rule 14; the rest (the stand-in gives the reading, the unsure first) is said nowhere else. A trim would save under 100 bytes. |
| `modules/inbox.md`: The stand-in | 14 / 37 | 5 / 28 | Stays: in steady use. |
| `modules/inbox.md`: An obvious improvement is built at once; other ideas are cheap to file | 0 / 6 | 6 / 25 | Stays: it is why ideas reach the owner as issues. |
| `modules/inbox.md`: The core itself (a fault or idea about it is filed there) | 7 / 35 | 8 / 35 | Stays: in steady use. |
| `modules/inbox.md`: Read every comment from the owner's account | 6 / 20 | 9 / 23 | Stays: in steady use. |
| `modules/orchestrating.md`: It builds nothing itself | 19 / 63 | 7 / 68 | Stays. |
| `modules/orchestrating.md`: On every wake | 0 / 7 | 0 / 6 | Stays: the orchestrator's whole loop; it shows in what the orchestrator does, not in what it writes. |
| `modules/orchestrating.md`: Hand over at once | 1 / 5 | 2 / 15 | Stays. |
| `modules/orchestrating.md`: A finished session is archived | 0 / 2 | 1 / 3 | Stays: a day old when counted (core archive 185); too young to judge. |
| `modules/orchestrating.md`: A lane for every independent entry | 0 / 4 | 0 / 4 | Stays. It reads as a pointer, and is the line that makes the orchestrator open a lane for every entry. |
| `modules/orchestrating.md`: A stalled lane | 4 / 14 | 7 / 16 | Stays: cited when lanes stalled. |
| `modules/orchestrating.md`: It asks the owner nothing | 0 / 1 | 0 / 1 | Stays. Its first sentence repeats floor rule 14; the second (check GitHub before reporting anything as waiting) came from a real repeat report (core archive 137). |
| `modules/orchestrating.md`: Where the agents run side by side | 3 / 13 | 2 / 9 | Stays. |
| `modules/review-guidelines.md`: Every reviewer lists what keeps the work from 10, and scores it | 7 / 20 | 9 / 32 | Stays: it is how every review is scored. |
| `modules/review-guidelines.md`: A later round | 6 / 23 | 11 / 40 | Stays. |
| `modules/reviews.md`: No sign, no finished review, late reviews | 12 / 38 | 24 / 53 | Stays: in steady use. |
| `modules/reviews.md`: The design check | 14 / 58 | 14 / 57 | Stays: in steady use. |
| `modules/reviews.md`: When a PR passes | 6 / 23 | 13 / 131 | Stays. |
| `modules/reviews.md`: Rounds end | 4 / 26 | 2 / 29 | Stays. |
| `modules/reviews.md`: The fallback reviewer's brief | 0 / 2 | 1 / 3 | Stays, and is better counted as "none needed": it tells what a brief holds, and binds no one. |
| `modules/roles.md`: The builders: another provider builds first; its briefer drops work that holds a protected file | 8 / 30 | 8 / 29 | Stays. |
| `modules/roles.md`: One code review, by another provider than the builder's | 90 / 131 | 160 / 201 | Stays. |
| `modules/roles.md`: The design checker, the stand-in and planning design | 0 / 11 | 0 / 9 | Stays. Moving it to `modules/claude.md` would put it in every session's reading, where it now costs nothing until needed. |
| `modules/roles.md`: Escalation | 10 / 29 | 10 / 52 | Stays: in steady use. |
| `modules/work-flow.md`: The next task goes on while this one is reviewed | 0 / 1 | 0 / 0 | Stays. Never cited; one line, and "no lane is stacked on another's" is said nowhere else. |
| `modules/work-flow.md`: Lanes beside the main lane | 55 / 235 | 41 / 293 | Stays: lanes are named in a third of all pull requests. |

## Readings taken

- **Unsure: one candidate, where the audit's count of 43 suggested more.** Three more were weighed and kept: two
  pointers that turned out to be the only trigger for what they point to ("Other providers first", "A lane for every
  independent entry"), and a move that would have put an on-demand rule into every session's reading.
- **Unsure: the cut is left to the owner.** It removes a rule and none of its words stand elsewhere, so it waits for
  the owner's word like any rule's end; the two repeats of floor rule 14 are left, a trim of under 200 bytes together.
- The patterns are this session's and are not kept as a script: the count is a one-time reading for this report, and
  the next one can be made the same way from the rules as they then stand.
