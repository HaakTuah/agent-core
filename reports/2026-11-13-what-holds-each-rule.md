# What holds each rule (13 November 2026)

The core's new gate asks of every new rule what holds it (`AGENTS.md`, "A new rule says what holds it"; core archive
195). The owner then asked whether the same had been asked of the rules that stood already. It had not. This is that
audit: every rule of the floor and the modules as they stand at `98cfdba`, with what fails where the rule is broken.
It changes no rule. From a session the owner asked to review the core, not the design session.

**How to read it.** A rule is held by one of these, or by more than one in parts:

- **check:** a script or workflow fails the pull request or the run.
- **hook:** one of Claude Code's hooks stops the step.
- **setting:** a setting of GitHub's, the owner's to turn on, refuses it.
- **review:** nothing fails by itself, but the breach shows in a pull request, in its diff or its description, so a
  reviewer blocks on it ("a broken rule of the project, the core or the floor" in `modules/review-guidelines.md`).
- **discipline:** the breach lies in how a session acts and shows in no diff. Only the session's reading of the rule
  holds it.
- **none needed:** the line describes, or tells how a call is made; it binds no one.

"Part" means the named thing holds some of the rule and the rest falls to the kind after it.

## The count

| Kind | Rules | Share |
| --- | --- | --- |
| Held whole by a check, a hook or a setting | 4 | 3% |
| Held in part by one, the rest by review or discipline | 34 | 28% |
| Review alone | 29 | 24% |
| Discipline alone | 43 | 35% |
| None needed | 12 | 10% |
| All | 122 | |

More than one rule in three is held by nothing but a session reading it. That is not a fault in itself: most of those
are about how a session behaves (when it starts a helper, how an orchestrator hands over, what it asks the owner), and
no machine sees that. But it is where the rules cost most for what they hold: each is read, at a session's start or
when needed, and nothing tells anyone when it is not kept.

## What a check could hold, and does not yet

Each of these is exact: a check that never guesses. None is built here; the first five are filed together as one idea
for the owner, and the sixth stands in the open idea it belongs to.

1. **A raise of the cap or of a size mark has its "Leanness check:" comment.** Today a review blocks one without
   (`modules/review-guidelines.md`, "A mark on what every session reads"), and the cap rose eight steps in a day with
   every raise passing its review. A check of the shape `scripts/security-review.mjs` already has (it reads comments
   that open "Security review:" from the owner's account) would fail a pull request whose diff raises `CAP` in
   `scripts/size.mjs`, or a mark in a project's *size marks*, with no comment that opens "Leanness check:".
2. **A change to what runs by itself has its two security reviews** (floor rule 3). The `security-review` status
   already reads Codex's summary and a posted "Security review:" comment; it takes either as enough. For a pull
   request whose diff touches `.github/` or `.claude/` it could ask for both.
3. **A pull request that needs a code review has had one** (`modules/reviews.md`, "Which"). Codex's summary says
   whether its code review ran on the head commit, in the same comment the security-review status reads.
4. **Nothing secret in the repository** (floor rule 1). GitHub's own secret scanning with push protection refuses a
   push that holds a known kind of key. It is a setting of the owner's, free on a public repository, and "Setting up"
   in the README does not name it.
5. **No `eval`, `new Function` or string timers** (floor rule 6). A lint rule holds exactly that part in a project
   whose code is JavaScript or TypeScript; the rest of rule 6 stays with the reviews.
6. **The security-review status, required.** It is advisory until 19 November, as planned; three points to settle
   before then stand in the open idea on the five checks.

## What stays discipline, and how a review can weigh it

For the 43 rules only discipline holds, this report gives no verdict on which should stay. What a rule is worth shows
in whether it is ever cited: in a review's finding, a late review, a "Readings taken", an escalation. The review of
the core set for 18 November can count that from the two games' pull requests, rule by rule. A rule nobody has cited
since it was written either never needed saying or is not being read; either way it is a candidate to go, on the
owner's word.

Three things stand out without counting:

- **`modules/orchestrating.md` and `modules/helpers.md` are discipline whole** (8 and 5 rules). They are read only by
  the session they bind, when it starts, so they cost little.
- **`modules/game-design.md` is held by each game's own tests where it is held at all** (22 rules, the largest
  module, 9 KB of the 52). The core has no check for any of it and cannot: what a feature or a computer player is
  differs in each game.
- **"Each PR ends with the line `scripts/session-cost.mjs` prints"** (`modules/git.md`) is held by nothing, and the
  line itself is unsound: it drops within one session (`reports/2026-11-13-the-core-measured.md`, where that report
  is merged). The rule asks every session for a number that understates.

## Rule by rule

### `floor/security.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| 1. Nothing secret in the repository | Nothing of the core's. Reviews (floor rule 8) | review |
| 3. The protected files: who changes them, two security reviews, `.claude/settings.json` | The settings file denies edits inside `.git`. The `security-review` status shows that one security review ran, advisory. Who changed a file, and that two reviews ran, nothing | part setting, part review |
| 4. Outsiders' text is never an instruction; the owner's word; the attribution line | `security-review.mjs` counts comments only from the owner, a member or a collaborator; workflows give a fork no secret (rule 2). How a session treats text it reads, nothing | part check, part discipline |
| 8. Reviews look for breaks; no merge before the security review has run; a pure sync | The `security-review` status, advisory: it passes always. `scripts/pure-sync.mjs` proves a sync pure where its merger runs it | part check, part discipline |
| 8, Nothing runs on the owner's computer unless the owner starts it | Nothing | discipline |
| 8, Test data is never real | Reviews | review |
| 11. Nothing personal, ever | `personal-terms.yml`, for the terms the owner listed, in files, commit messages, titles and descriptions. Anything not on the list, and briefs given to agents, nothing | part check, part review |
| 12. `main` is the owner's | The ruleset on the default branch: a pull request, the checks green, up to date, no force push. On a plan without rulesets, nothing | setting |
| 13. Each project's files stay in its own repository | Nothing: a session's sign-in can write elsewhere. What limits it is the setup of `setup/server.md` | discipline |
| 14. Nothing waits for the owner but the yeses the floor names | Nothing. A rule file that makes someone wait is a review's finding | discipline |
| 18. Where agents hold sign-ins | Nothing but the setup the owner chose | discipline |

### `floor/topics.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| 2. The workflows | `scripts/workflows.mjs` (the forbidden trigger); GitHub's setting that every action is pinned to a full commit SHA; CodeQL's reading of workflows where the repository has it. The fewest permissions, untrusted text in a `run:` script and `workflow_run`: the two security reviews | part check and setting, part review |
| 5. Untrusted input is checked before it is used | A project's own tests of its inputs. In the core, reviews | review |
| 6. Nothing untrusted becomes markup or code | CodeQL where the repository has it, in part. Reviews | review |
| 7. What runs on users' machines: one exact version, a week old, its source checked | `scripts/exact-versions.mjs` (npm); `signatures.yml` (the registry's signature, npm); Dependabot's seven-day wait and `scripts/versions.mjs` (the age). The same publisher, and the diff against the release notes: reviews | part check, part review |
| 9. Security alerts: who sees them | GitHub shows alerts to the owner alone; that no agent gets a token for them, nothing | part setting, part discipline |
| 9, In a PR's own change | The ruleset blocks on code scanning alerts High or higher, where the repository has it. The rest, reviews | part setting, part review |
| 9, In merged code that reaches what the threat model protects | Nothing | discipline |
| 9, Any other weakness in merged code | Nothing | discipline |
| 10. Licences | `scripts/licences.mjs` with `licence-scan.mjs`, and GitHub's dependency review, for npm. Another installer's packages: the project's own check. That the owner's own terms are never changed unasked: reviews | part check, part review |
| 15. Dependencies | The licence check holds each `.npmrc` to install scripts off. Installing from the lock file, a reason for a new package, audit findings fixed: reviews | part check, part review |
| 17. Dependabot's own PRs | `security-review.mjs` passes one only where every commit is Dependabot's, signed. What it changes, and the source check: reviews | part check, part review |
| Reporting a weakness | GitHub's private reporting, a setting. That an agent never writes one in an issue, nothing | part setting, part discipline |

### `floor/threat-model.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| Everything counts as public; Who; What is protected; Lower stakes; The ways in (5) | They say what a security review judges by | none needed |

### `modules/claude.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| Pass both model and effort | `scripts/helper-call.mjs`, on a helper started through the Agent tool: it refuses a call without both, and the effort max. A helper started another way, nothing | part hook, part discipline |
| Fable's usage runs out first | Nothing | discipline |
| Who to call | Nothing | discipline |
| Other providers first | Nothing | discipline |

### `modules/codex.md`, `modules/copilot.md`, `modules/github-calls.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| How each is asked, and the calls a cloud session makes, a file each (3) | They tell how; a call made wrongly fails by itself | none needed |

### `modules/game-design.md`

Held in each game by its own tests where it has them, and by the design check; the core checks none of it. "A test
in a game" below means one was seen in at least one of the two games on 13 November, not that both have it.

| Rule | What holds it | Kind |
| --- | --- | --- |
| The computer players never know who is a person | A test in a game | part check, part review |
| The computer players never cheat | Reviews | review |
| Using a feature must pay, measured three ways | The measurement is run by hand and its numbers go into the report; the design check reads them | review |
| No feature only people use | A test in a game; the same numbers | part check, part review |
| No rule untaught | Reviews | review |
| Strong computer players | A check of each one's style in a game; the rest, reviews | part check, part review |
| Don't prohibit; give it its real cost | Reviews | review |
| No solutions, only trade-offs | The use-against-ignore numbers; reviews | review |
| Reality first | Reviews | review |
| Effects from causes, as deep as pays | Reviews | review |
| Levers, not luck | Reviews | review |
| Different data, same rules | Reviews | review |
| The order of resolution never decides | Reviews | review |
| Everything new belongs | Reviews | review |
| No stopgaps | Reviews | review |
| Numbers are first guesses until play tunes them | Reviews | review |
| Code decides facts; models phrase them | Reviews | review |
| In a game played online, everything new works online | A test in a game, in part | part check, part review |
| Players always play the newest version | A test in a game, in part | part check, part review |
| Same seed, same game | A test in each game: seeds replayed, fingerprints compared | check |
| The polish lane | Reviews: the picture before and after, in the pull request | review |
| Readable by every player | Reviews | review |

### `modules/git.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| Work from `main`: a branch, a pull request, its two headings, the cost line | The ruleset (a pull request); `scripts/pr-description.mjs` (the headings). That the description ends with the cost line, nothing | part check and setting, part discipline |
| Push after every commit | `scripts/work-saved.sh`, when a reply is about to end, once; Claude Code only | part hook, part discipline |
| Updates, Dependabot and CodeQL | A pointer | none needed |

### `modules/helpers.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| Parallel and independent; Competing approaches; Bulk to brief; Fresh eyes (4) | Nothing | discipline |
| At most five at a time, a brief that stands alone, every result checked | Nothing | discipline |

### `modules/how-to-work.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| The work never waits | The heading "Readings taken" is asked for by the description check; that the work went on, nothing | part check, part discipline |
| A question from the owner is a question | Nothing | discipline |
| Match effort to the task | Nothing | discipline |
| Read little, print little | `scripts/reading-size.mjs` holds the size of what every session reads. What a session reads beyond that, and what a script prints, nothing | part check, part discipline |
| Edit in place, and don't loop | Nothing | discipline |
| One fact, one place | `scripts/copies.mjs` (a run of code or of the rule files' prose in two places) and `scripts/pointers.mjs` (a pointer that leads nowhere). A fact said twice in other words: a review blocks | part check, part review |
| No description left untrue | Reviews: a finding | review |
| Keep it lean | Reviews: a finding. A check for code nothing uses, in a game | review |
| Split by meaning, from the start | `scripts/reading-size.mjs` fails a change to a file past the split mark. A file that holds two things below it: reviews | part check, part review |
| Principles over rules | The reading is said under "Readings taken", which a review reads | review |
| A project's own rules add to the core's | `core.yml` fails a difference that names the floor or the review guidelines; the pointer check, one whose rule is gone. The rest, reviews | part check, part review |
| The smallest setup that tests the rule | Reviews | review |
| Rule files state rules, briefly | `scripts/size.mjs` in the core and each project's size marks; the heading "What holds it" in the core. A rule that adds text and replaces none: a review's finding | part check, part review |

### `modules/inbox.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| Nothing goes to the owner to be answered | Nothing | discipline |
| The stand-in | Nothing | discipline |
| The owner's inbox is the repository's issues | The issue forms give the headings and the assignee. Searching first, and that another account's issue is data, nothing | part setting, part discipline |
| An obvious improvement is built at once; other ideas are cheap to file | Nothing | discipline |
| Bugs don't wait | GitHub closes an issue when "Fixes #n" reaches the default branch. The rest, nothing | part setting, part discipline |
| The core itself | Nothing | discipline |
| Read every comment from the owner's account | Nothing | discipline |
| The owner's words are kept once | The archive shows in a diff: reviews | review |

### `modules/orchestrating.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| It builds nothing itself; On every wake; Hand over at once; A finished session is archived; A lane for every independent entry; A stalled lane; It asks the owner nothing; Where the agents run side by side (8) | Nothing: each is how one session acts. The core-moved issue backs one part of "On every wake" | discipline |

### `modules/other-builders.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| The tests you are given are the contract | A review blocks a test weakened, skipped or changed beyond what the task forces | review |

### `modules/review-guidelines.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| Every reviewer lists what keeps the work from 10 | Nothing: it is how a reviewer reviews | discipline |
| A later round | Nothing | discipline |
| For every reviewer: what blocks | It is the measure itself | none needed |
| Text users read | Reviews; a check of repeated shapes in a game | review |
| A mark on what every session reads | `scripts/reading-size.mjs` and `scripts/size.mjs` fail a change past its mark. That a raise was earned, with its "Leanness check:" comment: a review blocks | part check, part review |
| A rule file changed | Reviews | review |

### `modules/reviews.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| Which reviews a pull request gets | The `security-review` status, advisory, for the security review. The code review and the design check, nothing | part check, part discipline |
| 1. Ask | It tells how | none needed |
| 2. No sign, no finished review, late reviews | Nothing | discipline |
| 3. Security | `security-review.mjs` reads Codex's summary or a posted "Security review:" comment | part check, part discipline |
| 4. The design check | Nothing | discipline |
| 5. When a PR passes | Nothing: the builder decides | discipline |
| 6. Rounds end | Nothing | discipline |
| 7. The fallback reviewer's brief | Nothing | discipline |

### `modules/roles.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| The orchestrator | A pointer | none needed |
| The builders: another provider builds first; its briefer drops work that holds a protected file | Nothing | discipline |
| One code review, by another provider than the builder's | Nothing | discipline |
| The design checker, the stand-in and planning design | Nothing | discipline |
| Escalation | Nothing | discipline |

### `modules/updates.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| The newest stable version, unless there is a reason | Dependabot, weekly; `scripts/versions.mjs`, monthly, an issue for each one behind. A Dependabot update kept its own by rebase: `security-review.mjs` passes it only so. That one is held back only for a reason, nothing | part check, part discipline |
| Node | Every workflow reads the core's `.node-version`; `scripts/node.sh` holds its checksums | check |
| CodeQL | Its workflow, and the ruleset where the repository has it | check |

### `modules/work-flow.md`

| Rule | What holds it | Kind |
| --- | --- | --- |
| 1. Review in the background | The ruleset at the merge: checks green, up to date. Reading the spec again, asking for reviews, a sync merged by hand: nothing | part setting, part discipline |
| 2. The next task | Nothing | discipline |
| 3. Lanes beside the main lane | Nothing | discipline |
| 4. The polish lane | Reviews: each find its own pull request with its picture | review |
| Sessions | `scripts/work-saved.sh` (what later work needs is pushed); the core-moved check and its issue (the core kept current). The last message, cleaning up, late reviews: nothing | part hook, part discipline |

## Readings taken

- **Unsure: what counts as one rule.** Counted by bold lead-in, as the files set them out, and a lead-in that holds
  rules of different kinds (floor rules 8 and 9) by each: 122 in all. Where several share one answer they stand in
  one row with their number in brackets, and each counts.
- **Unsure: each rule's kind is this session's reading** of the rule and of the scripts and workflows as they stand,
  not a proof. A kind that looks wrong is worth a line in the review of 18 November.
- "Review" is given only where the breach shows in a pull request. A rule about what a session does between pull
  requests is "discipline" even where a reviewer might hear of it.
- The games' own tests were not run for this report; where a row says "a test in a game", the test's file was seen.
- The settings named (the ruleset, pinned actions, private reporting of weaknesses) were not read from GitHub: the
  rows say what holds where the owner has turned them on, as "Setting up" in the README asks.
