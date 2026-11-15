# The rules of the start reading, counted by role (14 November 2026)

The count that `#243` asks for, before anything is moved: for each rule a session reads at its start, how often each
role cites it, read as the count of 13 November (`reports/2026-11-13-discipline-rules-counted.md`) read every rule, and
for each rule whether a check already holds it whole. It changes no rule. The core's half was built by a routine-lane
builder; the two projects' half, the verdicts and the readings again by a builder on Opus, from the counts two read-only
sessions took inside the projects. Neither is the design session.

## The answer

**No rule of the start reading is a candidate to leave it: all 58 stay, and the count ends in "leave it", as the issue
said it might.** It covers the core's 201 pull requests and the projects' 704 (snakes) and 878 (amarna).

- **Every role reads the same start reading,** so a rule leaves it for every role at once, and one that builders cite
  stays whatever another role does. Builders (main, design, routine) are nearly every session; a candidate is a rule
  that no builder cites. Six are, in all three populations: `H2`, `H14`, `I1`, `C5` (each cited by a reviewer in the
  core, one to three times) and `I7`, `G1` (cited by no role at all). Each was read again below, and none moves.
- **The two parts the issue guessed at are in use, by the role it guessed would not need them.** The stand-in (`I2`)
  is cited by main-lane builders in 18, 23 and 22 pull requests (core, snakes, amarna), by routine builders in amarna in
  all 5 that name it, and by the stand-in itself in 4, 6 and 10 threads. The polish lane (`W4`) is cited by main-lane
  builders in 17 and 2 of the projects' pull requests, by routine builders in amarna in 2 of 8, and by the stand-in in 2
  and 3; the core, with no screen, cannot cite it.
- **The roles the core's half could hardly see.** Routine builders: 3, 4 and 21 pull requests, read from the first
  line; those in amarna cite 11 rules (`F3`, `F8`, `F8s`, `F18`, `H10`, `I2`, `W3`, `W4`, `W7`, `G3`, `G5`), those in
  snakes none. The stand-in: 20 threads over the three, citing 11 rules (`F1`, `F3`, `F8`, `F14`, `H12`, `I2`, `I3`,
  `I9`, `W3`, `W4`, `C1`). The orchestrator: no text of it in either project matched (2 threads in snakes, none in
  amarna), so nothing can be said of it, and it already reads its own module when needed. Reviewers cite the floor most
  (the fallback reviewer: `F3` in 14 and 15 of the projects' pull requests, `F8` in 24 and 23, `F18` in 10 and 8).
- **A check holds whole only floor rule 12 and half of `G2`.** By the 13 November audit
  (`reports/2026-11-13-what-holds-each-rule.md`), floor rule 12 is held by the ruleset on `main` where the plan has
  rulesets, and the floor is read whole; `G2`'s headings are held by `scripts/pr-description.mjs`, its cost line (`G3`)
  by none. So no rule is a candidate to leave on that ground (the issue's comment of 14 November, point 2). A failure
  that says its rule at the moment it matters (#254) helps the 19 rules held in part, and moves none.
- **For #256,** which waits on where this count says a rule is read: a choice that is hard to undo comes rarely, and
  the rules here that apply rarely (`I7`, `H14`, `C5`) are cited rarely or never; the one-line pointers of the start
  reading (`G5`, to `modules/updates.md`; `C6`, to "The builders") are cited by builders in all three, though their
  patterns count the subject as much as the pointer. The count fits a one-line pointer at the start and the rule in a
  module read when needed; it does not show the rule would then be read, as the 13 November count warned of a move.
  That reading is #256's builder's to take.

## How it was counted

Three populations, read by the same patterns (listed at the end) and the same roles:

- **The core:** every pull request of this repository as GitHub held it on 14 November 2026 (202, one of them
  Dependabot's and left out), with every issue comment and review comment on them (1,451), and the 117 comments on
  issues that are not pull requests, read only for the stand-in and the orchestrator.
- **snakes** (`barkstreet-snakes`): 704 pull requests (2 of Dependabot's left out), 1,835 comments on them, and 65
  comments on 42 issues.
- **amarna** (`amarna-letters`): 878 pull requests (10 of Dependabot's left out), 2,189 issue comments and 873 review
  comments on them, and 105 comments on issues.

The projects' counts were taken by two read-only sessions that the orchestrator started inside each project on the
owner's word, which wrote nothing there and sent counts and rule names only; this session did not read the projects. A
first attempt that day (#268) reached neither project's threads: one attach was refused, and the other came with git
reads only, which hold no pull request's description or comments.

For each of the 58 rules, two numbers for a rule and a role, as "cited / named", counted in pull requests (issues, for
the last two roles):

- **cited:** the rule's pattern shows in a "Readings taken" section or in a comment of that role;
- **named:** it shows anywhere in the role's text, a pull request's whole description included.

**Roles are not marked in the text:** every agent posts under the owner's login, so a role is read from the text,
which is rough.

- *Main*: a pull request's description (not the next two) and the builder's comments on it: 164 pull requests in the
  core; in amarna, 840 descriptions and 505 comments.
- *Design*: a description or comment that opens as from the owner's design session (in snakes, also an answer relayed
  from the design chat): 37, 21 and 27.
- *Routine*: a first line that says Sonnet built it, or a routine lane: 3, 4 and 21. In snakes 19 more say it in their
  second to sixth line and count as main; in amarna it is read from descriptions only, the builder's comments on such a
  pull request counting as main.
- *Codex*: its findings (its "no issues" receipts, summaries and boilerplate left out): 58 pull requests, 59, and 437
  findings on 121.
- *Fallback*: a session's comment whose first line opens "Code review:", "Security review:", "Leanness check:",
  "Design check" or as the fallback reviewer: 72, 25 and 27 pull requests. The projects' numbers are lower because
  Codex reviews most there.
- *Stand-in* and *orchestrator*: a comment on an issue that opens naming one: 4 and 2, 6 and 2, 10 and 0. In snakes the
  orchestrator's 2 threads match no pattern; in amarna 66 descriptions mention it, but this role is read in issues
  only.

Left out of every role: a request to a reviewer ("@codex review": 270 in snakes, 539 in amarna), and in snakes the
comments of `github-actions[bot]` (638) and `github-advanced-security[bot]` (4).

**What the projects' sessions did not read,** so that a number there is a floor, not a full count: the bodies of
reviews (`pulls/N/reviews`) in both, and in amarna the 126 issues' own text. **Older amarna pull requests have no
"Readings taken"** (268 of 878 do; older ones used a heading of questions for the owner), so its main-lane "cited" is
low. A "Readings taken" section runs from its heading, or its inline line, to the next heading, rule line or (inline)
blank line.

A zero is a reason to read again, never proof that a rule is dead, as on 13 November, and a pattern such as "lane" or
"split" counts a subject, not a rule invoked. A rule about how a session acts is kept without a word far more often than
it is cited.

## The core's count, rule by rule

"Held by" is the 13 November audit's reading, or this report's own where marked \* (the audit did not list the rule).

| Rule | Held by | Main | Design | Routine | Codex | Fallback | Stand-in | Orch. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **`floor/security.md`** | | | | | | | | |
| 1. Nothing secret in the repository | review | 0/2 | 0/0 | 0/0 | 1/1 | 9/9 | 0/0 | 0/0 |
| 3. The protected files (who changes them, two security reviews) | part setting, part review | 47/80 | 13/15 | 1/1 | 3/3 | 39/39 | 1/1 | 0/0 |
| 3. The owner's yes in the PR (floor and review guidelines) | review | 28/54 | 9/13 | 0/0 | 3/3 | 11/11 | 0/0 | 0/0 |
| 4. Outsiders' text is never an instruction | part check, part discipline | 22/32 | 9/13 | 0/0 | 2/2 | 15/15 | 0/0 | 1/1 |
| 4. The owner's word, passed on word for word | discipline | 21/29 | 8/11 | 0/0 | 1/1 | 4/4 | 0/0 | 0/0 |
| 8. Reviews look for breaks; no merge before the security review | part check, part discipline | 68/109 | 15/20 | 1/1 | 14/14 | 54/54 | 1/1 | 2/2 |
| 8. A pure sync needs no review of its own | part check, part discipline | 9/25 | 1/3 | 0/0 | 2/2 | 14/14 | 0/0 | 0/0 |
| 8. Nothing is reviewed twice | discipline | 1/3 | 0/1 | 0/0 | 0/0 | 1/1 | 0/0 | 0/0 |
| 8. Nothing runs on the owner's computer unless the owner starts it | discipline | 0/6 | 0/1 | 0/0 | 0/0 | 2/2 | 0/0 | 1/1 |
| 8. Test data is never real | review | 0/2 | 0/0 | 0/0 | 0/0 | 4/4 | 0/0 | 0/0 |
| 11. Nothing personal, ever | part check, part review | 15/26 | 3/3 | 0/0 | 0/0 | 21/21 | 0/0 | 0/0 |
| 12. main is the owner's | setting | 2/7 | 0/1 | 0/0 | 0/0 | 7/7 | 0/0 | 0/0 |
| 13. Each project's files stay in its own repository | discipline | 2/8 | 2/2 | 0/0 | 0/0 | 5/5 | 0/0 | 0/0 |
| 14. Nothing waits for the owner but the yeses the floor names | discipline | 9/19 | 3/6 | 0/1 | 0/0 | 5/5 | 0/0 | 1/1 |
| 18. Where agents hold sign-ins | discipline | 6/15 | 2/3 | 0/0 | 2/2 | 7/7 | 0/0 | 1/1 |
| **`how-to-work.md`** | | | | | | | | |
| The work never waits | part check, part discipline | 2/3 | 0/1 | 0/0 | 0/0 | 2/2 | 0/0 | 0/0 |
| A question from the owner is a question | discipline | 0/0 | 0/0 | 0/0 | 1/1 | 0/0 | 0/0 | 0/0 |
| Match effort to the task | discipline | 3/4 | 2/2 | 0/0 | 0/0 | 2/2 | 0/0 | 0/0 |
| Read little, print little | part check, part discipline | 0/0 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Edit in place | discipline | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Don't loop | discipline | 1/2 | 2/2 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| One fact, one place | part check, part review | 4/4 | 0/2 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| No description left untrue | review | 2/3 | 0/0 | 0/0 | 3/3 | 2/2 | 0/0 | 0/0 |
| Keep it lean | review | 8/16 | 1/2 | 1/1 | 0/0 | 9/9 | 0/0 | 0/0 |
| Split by meaning, from the start | part check, part review | 19/28 | 5/6 | 0/0 | 4/4 | 5/5 | 0/0 | 0/0 |
| Principles over rules | review | 0/2 | 1/1 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| A project's own rules add to the core's | part check, part review | 1/3 | 0/0 | 0/0 | 1/1 | 0/0 | 1/1 | 0/0 |
| The smallest setup that tests the rule | review | 0/2 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Rule files state rules, briefly | part check, part review | 0/0 | 0/0 | 0/0 | 0/0 | 1/1 | 0/0 | 0/0 |
| **`inbox.md`** | | | | | | | | |
| Nothing goes to the owner to be answered | discipline | 0/1 | 0/0 | 0/0 | 0/0 | 3/3 | 0/0 | 0/0 |
| The stand-in | discipline | 18/39 | 2/4 | 0/0 | 6/6 | 23/23 | 4/4 | 0/0 |
| The owner's inbox is the repository's issues | part setting, part discipline | 6/35 | 3/6 | 0/0 | 1/1 | 9/9 | 0/0 | 0/0 |
| An obvious improvement is built at once | discipline | 2/4 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Other ideas are cheap to file | discipline | 3/4 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Bugs don't wait | part setting, part discipline | 2/3 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| The core itself (a fault or idea about it is filed there) | discipline | 0/4 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| Read every comment from the owner's account | discipline | 6/10 | 0/3 | 0/0 | 2/2 | 5/5 | 0/0 | 0/0 |
| The owner's words are kept once | review | 33/123 | 7/26 | 1/3 | 4/4 | 8/8 | 3/3 | 1/1 |
| **`work-flow.md`** | | | | | | | | |
| 1. Review in the background; auto-merge | none (the call is the rule)* | 2/9 | 0/4 | 0/0 | 2/2 | 1/1 | 0/0 | 0/0 |
| 2. The next task goes on while this one is reviewed | discipline* | 0/3 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| 3. Lanes beside the main lane | discipline* | 2/21 | 1/6 | 0/1 | 2/2 | 4/4 | 0/0 | 1/1 |
| 4. The polish lane | review | 0/6 | 0/1 | 0/0 | 0/0 | 2/2 | 0/0 | 0/0 |
| The owner's stop switch (agents-stop) | part hook (`work-saved.sh` reports it at the start only), part discipline* | 1/2 | 0/0 | 0/0 | 0/0 | 3/3 | 0/0 | 0/0 |
| Sessions: stop when merged; say what is next | discipline* | 3/10 | 1/4 | 0/0 | 1/1 | 3/3 | 0/0 | 0/0 |
| Sessions: has the core moved; sync it | check (core-moved issue) | 13/32 | 4/8 | 0/0 | 9/9 | 10/10 | 0/0 | 1/1 |
| Sessions: clean up what you made | discipline* | 0/2 | 0/0 | 0/0 | 0/0 | 2/2 | 0/0 | 0/0 |
| **`git.md`** | | | | | | | | |
| Work from main: a branch and a PR each task | setting | 0/0 | 0/0 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 |
| Each PR has the two headings | check (pr-description.mjs) | 4/109 | 0/19 | 0/2 | 1/1 | 0/0 | 0/0 | 0/0 |
| Each PR ends with the cost line | discipline | 3/4 | 1/1 | 0/0 | 1/1 | 2/2 | 0/0 | 0/0 |
| Push after every commit | part hook, part discipline | 3/8 | 1/1 | 0/0 | 0/0 | 4/4 | 0/0 | 0/0 |
| Updates, Dependabot and CodeQL (a pointer) | none needed | 14/28 | 4/11 | 0/1 | 2/2 | 8/8 | 0/0 | 0/0 |
| **`claude.md`** | | | | | | | | |
| Models and effort by role (the table) | part hook | 5/25 | 1/5 | 0/3 | 1/1 | 18/18 | 1/1 | 0/0 |
| Pass both model and effort | part hook, part discipline | 2/5 | 1/2 | 0/1 | 1/1 | 2/2 | 0/0 | 0/0 |
| Name models by family alone | discipline* | 1/1 | 0/0 | 0/1 | 0/0 | 1/1 | 0/0 | 0/0 |
| Fable's usage runs out first | discipline | 41/46 | 2/3 | 0/1 | 0/0 | 0/0 | 0/0 | 0/0 |
| Who to call (a helper only for judgement above you) | discipline | 0/0 | 0/0 | 0/0 | 0/0 | 1/1 | 0/0 | 0/0 |
| Other providers first | discipline | 8/18 | 1/3 | 0/1 | 1/1 | 5/5 | 0/0 | 0/0 |
| **`other-builders.md`** | | | | | | | | |
| The tests you are given are the contract | review | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |

## The projects' count, rule by rule

Each cell is "snakes · amarna", each count "cited / named" as above. The ids are the patterns', in the order of the
core's table. The orchestrator's column is left out: it is 0 / 0 in every row of both projects. "Read again" sends to
the next section.

| Rule | Main | Design | Routine | Codex | Fallback | Stand-in | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **`floor/security.md`** | | | | | | | |
| `F1` nothing secret | 2/4 · 3/11 | 0/1 · 0/0 | 0/0 · 0/0 | 0/0 · 3/3 | 2/2 · 0/0 | 1/1 · 0/0 | Stays: the floor; builders cite it in both projects |
| `F3` protected files | 10/55 · 13/56 | 3/6 · 6/7 | 0/1 · 1/1 | 0/0 · 1/1 | 14/14 · 15/15 | 1/1 · 0/0 | Stays: the floor |
| `F3y` owner's yes | 4/31 · 6/29 | 7/8 · 6/7 | 0/0 · 0/0 | 0/0 · 0/0 | 1/1 · 1/1 | 0/0 · 0/0 | Stays: the floor |
| `F4` outsiders' text | 4/17 · 2/14 | 6/6 · 5/5 | 0/1 · 0/0 | 0/0 · 0/0 | 3/3 · 2/2 | 0/0 · 0/0 | Stays: the floor |
| `F4w` owner's word word for word | 6/78 · 3/71 | 7/9 · 4/7 | 0/0 · 0/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: the floor |
| `F8` reviews / security review | 29/135 · 29/151 | 0/4 · 5/6 | 0/1 · 2/4 | 8/8 · 19/19 | 24/24 · 23/23 | 1/1 · 0/0 | Stays: the floor |
| `F8s` pure sync | 14/55 · 11/56 | 0/0 · 0/0 | 0/0 · 1/2 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: the floor |
| `F8t` reviewed twice | 2/2 · 1/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: the floor |
| `F8o` owner's computer | 2/5 · 2/9 | 0/0 · 0/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 1/1 | 0/0 · 0/0 | Stays: the floor; builders cite it in both projects |
| `F8d` test data | 0/2 · 1/8 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 1/1 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: the floor; a builder cites it once |
| `F11` nothing personal | 0/9 · 2/16 | 0/1 · 0/0 | 0/0 · 0/0 | 0/0 · 2/2 | 3/3 · 3/3 | 0/0 · 0/0 | Stays: the floor |
| `F12` main | 1/2 · 1/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 1/1 · 0/0 | 0/0 · 0/0 | Stays: the floor, held whole by a setting where the plan has rulesets |
| `F13` own repository | 0/4 · 1/5 | 0/1 · 0/1 | 0/0 · 0/0 | 0/0 · 0/0 | 1/1 · 0/0 | 0/0 · 0/0 | Stays: the floor |
| `F14` nothing waits | 2/10 · 3/11 | 1/1 · 1/3 | 0/1 · 0/1 | 1/1 · 0/0 | 0/0 · 0/0 | 2/2 · 0/0 | Stays: the floor |
| `F18` sign-ins | 2/5 · 1/4 | 0/0 · 0/0 | 0/0 · 1/2 | 1/1 · 0/0 | 10/10 · 8/8 | 0/0 · 0/0 | Stays: the floor |
| **`how-to-work.md`** | | | | | | | |
| `H1` work never waits | 0/4 · 0/5 | 0/1 · 0/2 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in the core |
| `H2` question | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: read again |
| `H3` effort | 5/30 · 0/19 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it |
| `H4` read little | 1/8 · 1/11 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in both projects |
| `H5` edit in place | 1/1 · 1/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in both projects |
| `H6` don't loop | 5/12 · 2/5 | 0/0 · 0/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `H7` one fact | 8/13 · 9/12 | 0/0 · 0/0 | 0/0 · 0/0 | 1/1 · 3/3 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `H8` no description untrue | 6/8 · 1/5 | 0/0 · 0/0 | 0/0 · 0/0 | 4/4 · 4/4 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `H9` lean | 5/11 · 4/16 | 0/1 · 0/1 | 0/0 · 0/1 | 0/0 · 1/1 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `H10` split | 25/134 · 25/109 | 0/0 · 1/2 | 0/0 · 3/8 | 2/2 · 9/9 | 1/1 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `H11` principles | 11/14 · 1/2 | 0/0 · 0/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `H12` project's rules | 0/5 · 1/8 | 0/0 · 0/0 | 0/0 · 0/0 | 1/1 · 1/1 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it |
| `H13` smallest setup | 3/8 · 0/2 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in one project |
| `H14` rule files brief | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: read again |
| **`inbox.md`** | | | | | | | |
| `I1` nothing to owner | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: read again |
| `I2` stand-in | 23/78 · 22/168 | 2/4 · 0/0 | 0/0 · 5/5 | 4/4 · 24/24 | 2/2 · 0/0 | 6/6 · 10/10 | Stays: every builder role cites it; read again |
| `I3` inbox issues | 3/15 · 5/27 | 0/2 · 0/3 | 0/2 · 0/1 | 1/1 · 8/8 | 0/0 · 0/0 | 5/5 · 0/0 | Stays: builders cite it in all three |
| `I4` obvious improvement | 0/1 · 0/2 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in the core |
| `I5` ideas cheap | 0/1 · 1/7 | 0/0 · 0/1 | 0/0 · 0/0 | 1/1 · 0/0 | 0/0 · 1/1 | 0/0 · 0/0 | Stays: builders cite it |
| `I6` bugs | 2/2 · 2/2 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `I7` core itself | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: read again |
| `I8` owner's comments | 1/5 · 1/4 | 0/0 · 1/1 | 0/1 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `I9` words kept once | 3/20 · 6/122 | 3/8 · 3/12 | 0/2 · 0/0 | 0/0 · 0/0 | 0/0 · 1/1 | 0/0 · 5/5 | Stays: builders cite it in all three |
| **`work-flow.md`** | | | | | | | |
| `W1` review in background | 2/3 · 1/2 | 2/7 · 0/4 | 0/0 · 0/1 | 0/0 · 1/1 | 1/1 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `W2` next task | 1/12 · 0/11 | 0/0 · 0/0 | 0/0 · 0/1 | 0/0 · 0/0 | 1/1 · 0/0 | 0/0 · 0/0 | Stays: a builder cites it once; read again |
| `W3` lanes | 55/233 · 34/269 | 4/9 · 5/13 | 0/3 · 6/19 | 4/4 · 1/1 | 0/0 · 0/0 | 3/3 · 6/6 | Stays: builders cite it in all three |
| `W4` polish lane | 17/83 · 2/84 | 0/3 · 0/7 | 0/1 · 2/8 | 2/2 · 0/0 | 0/0 · 0/0 | 2/2 · 3/3 | Stays: main and routine builders cite it; read again |
| `W5` stop switch | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: read again |
| `W6` stop when merged | 4/96 · 4/73 | 1/1 · 1/1 | 0/0 · 0/0 | 5/5 · 2/2 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `W7` core moved; sync | 11/36 · 9/31 | 0/1 · 1/2 | 0/2 · 1/2 | 0/0 · 0/0 | 0/0 · 1/1 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `W8` clean up | 0/33 · 3/15 | 0/0 · 0/0 | 0/0 · 0/0 | 1/1 · 0/0 | 1/1 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in one project |
| **`git.md`** | | | | | | | |
| `G1` work from main | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: read again |
| `G2` two headings | 0/91 · 0/77 | 0/6 · 0/9 | 0/3 · 0/19 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: read again |
| `G3` cost line | 0/2 · 0/3 | 0/0 · 0/0 | 0/0 · 1/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it |
| `G4` push after commit | 1/6 · 0/9 | 0/2 · 0/1 | 0/0 · 0/0 | 1/1 · 0/0 | 3/3 · 2/2 | 0/0 · 0/0 | Stays: builders cite it |
| `G5` updates | 4/33 · 5/41 | 1/4 · 1/2 | 0/1 · 2/2 | 0/0 · 0/0 | 5/5 · 4/4 | 0/0 · 0/0 | Stays: builders cite it in all three |
| **`claude.md`** | | | | | | | |
| `C1` models table | 1/12 · 1/10 | 0/2 · 0/1 | 0/1 · 0/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| `C2` model and effort | 1/4 · 0/3 | 0/1 · 0/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it |
| `C3` family names | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: a builder cites it in the core |
| `C4` Fable's usage | 26/43 · 30/46 | 0/1 · 1/1 | 0/1 · 0/0 | 0/0 · 0/0 | 1/1 · 0/0 | 0/0 · 0/0 | Stays: in steady use in all three |
| `C5` who to call | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: read again |
| `C6` other providers | 1/12 · 2/16 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 1/1 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: builders cite it in all three |
| **`other-builders.md`** | | | | | | | |
| `O1` tests contract | 1/1 · 0/1 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | 0/0 · 0/0 | Stays: a builder cites it once; read again |

## The rules read again

Each rule that no builder cites in some population, or that the issue named, with the reading that follows from the
three counts, the 13 November report and the audit. None is moved.

| Rule | Read again |
| --- | --- |
| `F1`, `F8o`, `F8d` (the floor) | Cited by no builder in the core, but by builders in the projects (2 and 3, 2 and 2, 0 and 1 pull requests) and by the fallback reviewer. The floor is read whole in every reading. |
| `H2`, `I1`, `C5` | Cited by no builder in any of the three; by a reviewer in the core, once to three times. Each states how a session acts, which shows in no description: `H2` where the owner asks in person, not in a pull request; `I1` is the frame of the inbox, whose break would be a question put to the owner, and none is counted; `C5` decides which helper a session starts, and the hook holds the half a machine can (model and effort on the call). Every builder needs each at its start, so a move would take them from the role that keeps them. |
| `H14` | Cited by no builder in any of the three. The one rule here whose need is narrow: whoever writes a rule file. But any builder may change one in a project, and the rule is one line (about 150 bytes); a move saves almost nothing and leaves that builder without it. |
| `I7` | Cited by no role by this pattern, in any of the three; the 13 November count, by its own pattern, found it cited in both projects (7 / 35 and 8 / 35). A zero of the pattern, not of the rule. |
| `G1` | Cited by no role anywhere: every counted pull request follows it, so it is never in doubt. Most of it is said again by floor rule 12 and point 1 of `modules/work-flow.md` (the builder merges its own); whether to fold it into them is a question of leanness, not of this count. |
| `G2` | Never cited in the projects, as its headings show in each description (named in 91 and 77): `scripts/pr-description.mjs` holds the headings and names them when it fails. Its cost line (`G3`) no check holds, so the line stays at the start. |
| `W2` | Cited once (snakes). One line; "no lane is stacked on another's" is said nowhere else. |
| `W5` | Cited by no builder in the projects: the stop switch came late (core archive 201), and most of their pull requests are older. `work-saved.sh` reports it at the start. |
| `H1`, `H13`, `W8`, `C3`, `I4`, `H4`, `H5` | Each cited by builders in one or two of the three, never in all. Cited, so not candidates; `H4` and `H13` are the owner's own (core archive 17 and 12). |
| `I2` (the stand-in) | Cited by main-lane builders in all three (18, 23, 22) and by routine builders in amarna (5 of 5): builders read it, as the stand-in's verdict and its record ("matched" or "missed"), which bind the builder who acts on a point. Its duties (what the stand-in searches, what it is always unsure of) are the stand-in's own, but a cite does not tell which part was read. Moving the duties into the stand-in's brief would save well under 1 KB; no count here backs it, and it is not proposed. |
| `W4` (the polish lane) | Cited by main-lane builders in both projects (17 and 2), by routine builders in amarna (2 of 8) and by the stand-in (2 and 3). In use where there is a screen; the core has none. |
| `O1` (the tests you are given are the contract) | Cited once (snakes). It binds a builder of another provider, whose pull requests these roles do not set apart. |

## What the count leaves open

1. **Nothing moves, and #243 closes.** Its own test found no candidate: every rule that no builder cites was read again
   and stays.
2. **The orchestrator is not measured.** No text of it in either project matched; its own pull requests and
   transcripts would be needed, and it reads its own module when needed already, so this is worth taking only if a
   move for it is ever proposed.
3. **The reviewers' numbers are a floor:** the bodies of reviews were read in neither project.
4. **The routine role is thin:** 28 pull requests over the three, read from the first line.
5. **A cite does not say which part of a rule was read,** which `I2` alone would need to settle.

## Readings taken

- **Unsure: a candidate is a rule no builder cites.** The issue's test is a rule "a role reads at every start and
  never cites". Every role reads the same start reading, so a rule moved out leaves every role's at once; a rule that
  builders cite stays whatever another role does.
- **Unsure: the roles are read from text, and differently in each project.** Nothing marks a role, as every agent posts
  under the owner's login; each project's session read its own text as the method notes above say, and a pull request
  whose description says nothing of its builder counts as a main-lane one.
- **Unsure: the projects are named by their short names, as this repository's archive and reports already hold them,**
  and once each by the repository's own name, which the owner's words quoted in #268 hold. Nothing else of either
  project is here: counts and rule names only.
- **Unsure: the "held whole" count is the audit's.** Where the audit did not list a rule (`work-flow.md`), the label with
  a \* is this report's reading.
- The patterns are the rule's own words and are listed below so a later count reads the same; this report keeps no
  script.

## The patterns

One per rule, matched without regard to case; the id is the table's row in order.

```
F1  nothing secret|secret.{0,20}(repository|history)|floor rule 1\b|\brule 1\b.{0,25}secret|revoke
F3  protected file|floor rule 3\b|\brule 3\b|two security reviews
F3y  owner'?s yes|\byes\b.{0,40}(relayed|word for word)|relayed word for word
F4  \bis data\b|floor rule 4\b|\brule 4\b|outsider|another account|other account|attribution line
F4w  word for word
F8  floor rule 8\b|\brule 8\b|security review
F8s  pure sync|pure-sync
F8t  reviewed twice|only for what it changes
F8o  owner'?s computer|poller
F8d  test data|fake key|invented (names|addresses)|sample names
F11  nothing personal|floor rule 11\b|\brule 11\b|personal-terms|personal information
F12  floor rule 12\b|\brule 12\b|force-push|never pushed to
F13  floor rule 13\b|\brule 13\b|its own repository|own repository
F14  floor rule 14\b|\brule 14\b|nothing waits|waits? for the owner
F18  floor rule 18\b|\brule 18\b|sign-ins?\b
H1  never waits|work never waits|best reading
H2  question from the owner|a question is a question
H3  match effort|one pass|cheapest approach
H4  read little|print little|large file
H5  edit in place
H6  don'?t loop|failed twice|marked? (it )?blocked|blocked task
H7  one fact,? one place|single home
H8  description left untrue|descriptions?\b.{0,40}(untrue|updated|still true)
H9  keep it lean|leanness|lean pass|removes what it replaces
H10  split by meaning|split mark|\bsplit\b
H11  principles over rules
H12  own rules add|\bdifferences\b
H13  smallest setup
H14  rule files state|state rules,? briefly|replaces text rather
I1  nothing goes to the owner|asks? the owner nothing|no (question|answer) (is )?(sent|asked)
I2  stand-in|standin
I3  \binbox\b|assigned to the owner|never file twice|search(ed)? first
I4  obvious improvement
I5  cheap to file|\bidea (is )?filed|filed as (an )?(idea|issue)|\bfiled #\d+
I6  bugs? don'?t wait|outside the task
I7  reporting to the core|a fault, idea or question|filed (there|in the core|on the core)
I8  read every comment|owner'?s account
I9  kept once|owner'?s words are kept|archive item|core archive \d+
W1  auto-merge|review in the background|reviews are clean
W2  next task|while this one is reviewed|stacked
W3  beside the main lane|lane beside|main lane|\blanes?\b
W4  polish lane
W5  agents-stop|stop switch
W6  can be archived|\barchived\b|last message
W7  core-moved|sync pr|sync\.mjs|syncs? the core
W8  clean(ed)? up|worktree|local branch
G1  work from main|branch of its own|fresh branch
G2  what the owner can try
G3  session-cost|cost line
G4  push after every commit|pushed after every|work-saved
G5  dependabot|codeql
C1  model and effort|effort level|modules/claude\.md
C2  both model and effort|helper-call
C3  by family
C4  \bfable\b
C5  who to call|ranks above you
C6  other providers first|another provider|other provider
O1  tests you are given|the contract
```
