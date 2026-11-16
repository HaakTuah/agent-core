# The owner's words behind the core: items 235 onward

How they are kept, and where each item lives: `archive/instructions.md`.

235. **15 November 2026** (the core; in a chat with a session the owner works with, not the design session, as that
     session recorded it on issue #299, its note of that day "This is the issue's current text." gathering what the
     owner agreed to, above the description a builder wrote while building #234, which first set out two of the
     forms). The session set out
     the builder's two forms, a posted review declaring its blocking points on a line of its own and covering one kind
     of review per comment, and a bug's form ending with an optional line "Brought in by: #N", and the owner agreed to
     them. The owner also agreed to count the findings that do not block before deciding #315; the session set out how
     that count is taken, a posted review saying beside its blocking points "Other findings: M." or "No other
     finding.", and told the owner of it the same day. To the orchestrator, passed on word for word to the builder of
     this rule:

     > Issues labelled `by:chat` carry my decisions; treat them as my word.

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     > Missing now: #299 (before #302; its current text is the newest note on it)

     Behind "What a posted review declares" in `modules/reviews.md`, point 3, the line "Brought in by:" of the bug forms
     (`.github/ISSUE_TEMPLATE/bug_report.md` and the starter kit's), and the other points of a posted review that
     `scripts/review-record.mjs` reads.

236. **14 November 2026** (the core; in chats with a session the owner had asked to look through the core, not the
     design session, as that session recorded them on issue #250, labelled `by:chat`, the last under "What this issue
     asks to be built, in one place", saying the owner agreed to it). The session had set out three decisions before
     the core could be used at work: a licence, a team's shape and another host. The owner:

     > I want to see if i can use this core in future work projects also.

     The licence was decided apart (#257; item 221). Of the other two:

     > should work in every git format, and every person with rights to the repo is an owner, no?

     The owner agreed to the session's take on each. Another host, every one that holds a git repository: one layer
     that knows no host, a single entry point that runs every check of the core from plain git, on a person's machine
     or in any pipeline; a thin part for each host for what is the host's own (a scheduled job, a request for review,
     issues and labels, statuses), each naming what stands in inside the repository where the host has none; proven
     host by host, GitHub proven and any other "should work" until a project runs there, a host's part written when a
     project first needs it, not before. A team's shape, whoever the host lets write is an owner: the host's own rights
     decide and no list is kept, whoever may write to the repository may give its agents a task and settle an open
     reading, the *owner's account* slot becoming the owners; the yeses the floor names given by those with the host's
     higher right, an admin or maintainer, so that one person with the right to write does not loosen the floor alone;
     where two owners say opposite things, the agent reports it and takes neither side, and the higher right decides;
     the stand-in answering from the team's recorded decisions, not one person's taste; a person's approval of each
     change a slot that follows the host's own protection of the branch; and a project where one person holds every
     right changing in nothing. An employer's own rules on tools, models and data come before any of the core's. To
     the orchestrator, passed on word for word to the builder of this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind floor rules 4, 12 and 14 as they read a team's owners, their yeses and the approvals the host asks;
     `modules/hosts.md`, `modules/teams.md` and GitHub's part in `modules/github-calls.md`; the slot *owner's account*; and
     `scripts/check.mjs`.

237. **15 November 2026** (games with a screen; in a chat with a session the owner works with, not the design session,
     as that session recorded it on issue #286, labelled `by:chat`, under "What it is", saying the owner agreed to it;
     and as the owner then told the orchestrator, who passed it on word for word to the builder of this rule). The
     session researched what practice holds a screen to and set out fourteen additions with what holds each; this is
     the thirteenth, and item 230 holds the others. It set out five rules for a game played through a screen: every
     action answered within a tenth of a second, its outcome free to come later, and the computer players' answer left
     as "The computer players never know who is a person" has it; an effect sized to its event, returning to rest, and
     not spent on every routine action; the display judged over the busiest scene, not an empty one; a player's
     settings remembered (controls remapped, the size of text, less shake and less flashing, separate volumes); and
     nothing told by sound alone. What holds them: a timed script from an input to the first change on the screen; a
     picture of the busiest scene a test can stage, read by the critique of item 230; a test that each setting is still
     there after the game is closed and opened again; and the lengths of effects as values of the one system; each
     reporting first, with a baseline that may not get worse, and off in a project until it turns it on; that an effect
     is in proportion to its event only a reader can judge, the critique asking it. The owner agreed to all fourteen as
     set out, having asked:

     > What are we lacking from our ruleset, that we can prescribe and get superior output in our projects, without
     > having to manually iterate and re-prompt o so many times? Mistakes and wrong calls, the models are capable of
     > avoiding or detecting themselves, but which the processs just doesn't automatically prompt them to do?

     To the orchestrator, passed on word for word to the builder of this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind "How a game answers a player" in `modules/game-design.md` and its five points, the questions another module
     may add to the critique and the settings check in `modules/screens.md`, and the check `settings` of
     `scripts/screens.mjs`.

238. **15 November 2026** (every project with tests, the core among them; in a chat with a session the owner works
     with, not the design session, as that session recorded it on issue #275, labelled `by:chat`, under "What it is",
     saying the owner agreed to it). The session set out how the tests would earn their time: each measured (its time,
     when it last failed for a real reason, what it alone catches of the faults put in on purpose, how often it fails
     for no reason), a script keeping the numbers and the audit's report showing them; a pull request running the
     tests its changed files can reach, with new tests and those that failed last time, and saying what it ran, the
     whole suite running where it already ran, so that no job is added, and a fault the whole suite finds that the
     selection skipped mended in the map at once; the tests a project names as its proof that behaviour was kept never
     selected out, their names in a slot; a test keeping its place by one of three (it alone catches a fault, it guards
     a rule the project states, it has failed for a real reason), any other proposed for removal or merging by a
     script and decided by a reader, never by coverage alone, in small pull requests that leave the tests' strength no
     worse; the suite's time and each part's a measure with a baseline that may not get worse, the codebase's state
     setting how fast they come down; a test that fails for no reason mended or removed, never retried in silence; a
     new test saying what rule or fault it guards and setting up only what it needs; and, reaching a project, reported
     first, the selection a step of the release with its check and its mend, nothing stopping a project and nothing
     asked of its owner. The owner had asked:

     > It seems my tests are way out of whack. How will they be made optimal, to only test what absolutely gives
     > value and then never grow into monsters again? […] So the tests are maybe some of the biggest bottlenecks on
     > development right now

     and agreed to those seven points. The same day, having watched a suite of a desktop program open the program's
     window for test after test, the owner asked whether the core says clearly:

     > Test everything without such things first? Only add if it has to for utility?

     The session answered that the core implies it in three places and states it in none, and set out an eighth point:
     a test opens a screen, a window or a device only where that is what it guards, everything else tested beneath it,
     and the share of a suite's tests that open one counted, with the time they take, as a measure with a baseline,
     those that stand listed and worked down, none turning a check red. The owner agreed to it. To the orchestrator,
     passed on word for word to the builder of this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind `modules/tests.md` but its last two rules, the line on it in "The smallest setup that tests the rule" in
     `modules/how-to-work.md`, the audit's record in `modules/cleaning.md`, `scripts/select.mjs`,
     `scripts/test-record.mjs`, the shape check's count of the tests that open a screen and the selection's lists in
     its config, and `scripts/mutate.mjs --every`.


239. **15 November 2026** (every project with checks on its pull requests, the core among them; in chats with a
     session the owner works with, not the design session, as that session recorded it on issue #321, labelled
     `by:chat`, saying the owner agreed to it). The owner had noted:

     > I feel reviews and tests are bottlenecks for us.

     The session measured where a pull request's time goes and set out seven changes, which the owner agreed to; four
     of them are these: a time mark on what a pull request waits on, the checks of one push from the first job's start
     to the last one's end, in a slot, with a baseline that may not get worse; a slow job split, its parts side by side
     and the quick checks first, run only where a change can affect what it tests, done in the core to the Windows
     suites; keeping up with main done once, first a look with a report on whether a merge queue is open to the account
     or a branch can be updated only once its other checks have passed, floor rule 12 staying as it is; and a
     measurement of an hour or more (a first guess, in a slot) started as a job, the session ending at a gate with its
     note and the result posted on the pull request for the session that picks it up, the job the project's own to
     turn on, the core adding no billed job to a project. Of the Windows suites the owner then asked:

     > Is this a lot? Does it give value that warrants it taking so much time

     > Should sessions wait around for all of this?

     The session answered that the suites are worth keeping, since another owner's project is built on Windows, but not
     worth waiting on in a loop. A fifth point, that a builder runs before it pushes the suites its own machine can
     run, came from that answer and is the session's own addition, told to the owner the same day; it is no decision
     of the owner's, and waits as an open point (#321). To the orchestrator, passed on word for word to the builder of
     this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind "The tests have a time mark, which never gets worse" (its split, with the quick checks first),
     "What a push waits on has a time mark" and "A long measurement runs outside the session" in `modules/tests.md`,
     `scripts/wait.mjs` and its line in the monthly state report, the core's own selection in its tests workflow, and
     the report on keeping up with main.



240. **15 November 2026** (games; in chats with a session the owner works with, not the design session, as that
     session recorded it on issue #311, labelled `by:chat`, under "What it is", saying the owner agreed to it; and as
     the owner then told the orchestrator, who passed it on word for word to the builder of this rule). At the owner's
     own asking the session checked the core's game rules against the field's practice and set out eight additions,
     with what holds each: every game says on one page what it is for (what the player does from minute to minute,
     what winning is, two or three kinds of experience it aims at, in the owner's words), a feature's entry says which
     it serves, and a slot names the page; the first stage is the loop alone, nothing else built until it can be played
     from start to finish; teaching has an order, one new thing at a time, first where a mistake costs nothing, then
     under pressure, then combined, in play, not in text, and the time from opening the game to the first real choice
     measured against a target on the page; standing measures from the simulations for every game (the win rate by
     seat or starting place, how often the leader at a third of the game goes on to win, the spread of a game's
     length, the time a player spends knocked out or with no real choice, the share of turns with only one sensible
     move), each reported whenever the rules change against a target that is a first guess; a loss explains itself,
     the player seeing after a round what beat them; chance before the choice where it can, a lever answering it
     where it comes after; what must be remembered decided once for each game, shown to every player where remembering
     is not meant as part of the skill, and where it is, the computer players remembering no better than a person at
     their setting could; and sound with jobs (confirming an action, warning, marking a change of state), one voice
     for each job, the music never covering them, how it sounds staying the owner's taste. Staying out: tricks that
     hold a player (daily rewards, streaks, timers that punish leaving), difficulty that shifts in secret, helping
     whoever is behind by breaking the rules for them, any theory used as a checklist, and a verdict on fun from a
     model, which stays the owner's own play. The owner agreed to every addition that passes the owner's own test for
     a rule (#303), and so to all eight; the test, in the owner's words:

     > So the criteria is rules the agents can actually execute on, and which aids the output, makes it better or more
     > robust.

     To the orchestrator, passed on word for word to the builder of this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind "Every game says what it is for, on one page", "The first stage is the loop alone", "Teaching has an
     order", "A loss explains itself", "Standing measures from the simulations, for every game", "Chance comes before
     the choice where it can", "What must be remembered is decided once for each game" and "Sound has jobs" in
     `tasks/game-design.md`, the slot *game page*, and the check `first-choice` of `scripts/screens.mjs`.
