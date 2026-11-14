# The rules of the start reading, counted by role (14 November 2026)

The count that `#243` asks for, before anything is moved: for each rule a session reads at its start, how often each
role cites it, read as the count of 13 November (`reports/2026-11-13-discipline-rules-counted.md`) read every rule, and
for each rule whether a check already holds it whole. It changes no rule. Built by a routine-lane builder, not the
design session.

## The answer

**This count is half taken, and moves nothing.** It covers the core's own pull requests, which are not the population
the 13 November count read: the two projects' pull requests were out of this session's reach (a request to read one of
them was refused, and the other came with git reads only, no pull requests). So the counts below stand for the core, and
two roles, the stand-in and the orchestrator, have almost no text here at all (4 and 2 threads). The by-role count of
the projects' pull requests is left, as "What is left" says, and the verdicts follow it, not this.

What the core's own half shows:

- **No rule is a candidate to move on this half alone.** Of the 58 rules of the start reading, 16 are cited by no
  builder and 7 by no role (`H4`, `H5`, `H13`, `I7`, `W2`, `G1`, `O1`); each of the 16 was read again below, and none
  is moved. A zero here is weaker than in the projects, since the core has no screen, no game and no sync of its own.
- **The two parts the issue guessed at stay a question.** The stand-in's duties (`I2`) are cited by builders in 18
  pull requests, but as the stand-in's verdict, not its duties, and the polish lane (`W4`) can have no cite in a
  repository with no screen. Whether a routine builder, an orchestrator or a reviewer ever needs either text is
  what the projects' count will say.
- **A check holds the start reading little.** By the 13 November audit (`reports/2026-11-13-what-holds-each-rule.md`)
  two rules of it are held whole: floor rule 12 (the ruleset on `main`, where the plan has rulesets) and the headings
  of "Each PR has the two headings" (`scripts/pr-description.mjs`; the cost line it does not read). Nineteen more are
  held in part, mostly by a check on a part of the rule, so a failure can name only that part. The ways to say a rule at
  the moment it matters (#254) therefore reach few of these rules whole.

## How it was counted

Every pull request of this repository as GitHub held it on 14 November 2026 (202, one of them Dependabot's and left out),
with every issue comment and review comment on them (1,451), and the 117 comments on issues that are not pull requests,
read only for the stand-in and the orchestrator. For each of the 58 rules, a pattern of its own words, its number or its
usual phrases (listed at the end, so the projects' count reads the same). Two numbers for a rule and a role, as
"cited / named", counted in pull requests (issues, for the last two roles):

- **cited:** the rule's pattern shows in a "Readings taken" section or in a comment of that role;
- **named:** it shows anywhere in the role's text, a pull request's whole description included.

**Roles are not marked in this repository's text:** every agent here posts under the owner's login, so a role is read
from the text, which is rough.

- *Main*: a pull request's description (not the next two) and the builder's comments on it, 164 pull requests.
- *Design*: a description or comment that opens as from the owner's design session, 37.
- *Routine*: a first line that says Sonnet built it, or a routine lane, 3.
- *Codex*: its findings (its "no issues" receipts and summaries left out, being the same text each time), 58 pull requests.
- *Fallback*: a session's comment that opens "Code review:", "Security review:", "Leanness check:" or as the fallback
  reviewer, 72 pull requests.
- *Stand-in* and *orchestrator*: a comment on an issue that opens naming one, 4 and 2. A request to a reviewer
  ("@codex review") is left out of every role.

A zero is a reason to read again, never proof that a rule is dead, as on 13 November, and a pattern such as "lane" or
"split" counts a subject, not a rule invoked. A rule about how a session acts is kept without a word far more often than
it is cited.

## The count, rule by rule

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

## The rules read again

Each rule no builder cites, with the reading that follows from the table, the 13 November report and the audit. None is
moved; a move waits for the projects' count.

| Rule | Read again |
| --- | --- |
| `F1`, `F8o`, `F8d` (the floor) | Cited by the fallback reviewer (9, 2 and 4 pull requests), by no builder: a builder is bound by them and a reviewer checks them. The floor stays whole in every reading. |
| `H2`, `I1`, `C5`, `H14` | Cited by a reviewer once to three times, by no builder. Each states how a session acts, which shows in no description. `H14` is why a rule file stays short. |
| `H4`, `H5`, `H13` | Cited by no one. `H4` and `H13` are the owner's own (core archive 17 and 12) and `H5` is three words; a move saves almost nothing and a rule read at no start is read nowhere. |
| `W2` | Never cited (0 here, 0 / 1 and 0 / 0 on 13 November). One line; "no lane is stacked on another's" is said nowhere else. |
| `W8`, `G1` | `W8` is cited by the fallback reviewer twice. `G1` repeats floor rule 12 and the ruleset, and its one part that nothing else says is that the builder merges its own PR. |
| `I7` | Cannot be counted here: the core is the repository it names, so its builders never need to file anywhere else. In use in the projects on 13 November (7 / 35 and 8 / 35). |
| `W4` (polish lane) | No cite in a repository with no screen: the count says nothing of it. |
| `I2` (the stand-in) | Cited by main-lane builders in 18 pull requests, as the stand-in's verdict, which the builder reads as data; the duties text (what it searches, what it is always unsure of, its record) is the stand-in's. First candidate for the next count, to be read again with the stand-in's own role. |
| `O1` (the tests you are given are the contract) | Cited by no role; it is for a builder of another provider, and none builds here (every file here is protected). The projects' count is the only one that can say whether a session of a Claude builder ever needs it. |

## What is left

1. **The count of the two projects' pull requests, by the same patterns and roles** (those below), run by a session
   that has them in reach, with their roles read from the text as here. Until it is in, nothing moves (#243 asks that).
   Read with this table, it gives each rule by role over the core, the first project and the second.
2. For every rule that no role of the projects cites either, a second reading as on 13 November.
3. The stand-in and the orchestrator: where this count has 4 and 2 threads, the projects have the verdicts and the
   orchestrator's own pull requests.

## Readings taken

- **Unsure: the count is closed as half taken, with #243 still open.** The issue asks for the count as 13 November read
  it, which was the two projects' pull requests; those were out of this session's reach, so the line stays in the queue,
  and #256 waits as it did. The other reading, to close the issue on the core's own half, would let a rule move on a
  population that cannot show a screen, a game or a sync.
- **Unsure: the roles are read from text.** Nothing in a pull request marks one, as every agent posts under the owner's
  login. A pull request whose description says nothing of its builder is counted as a main-lane one.
- **Unsure: the "held whole" count is the audit's.** Where the audit did not list a rule (`work-flow.md`), the label with
  a \* is this report's reading.
- The patterns are the rule's own words and are listed below so the next count reads the same; this report keeps no script.

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
