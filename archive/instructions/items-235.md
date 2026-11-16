# The owner's words behind the core: items 235 onward

How they are kept, and where each item lives: `archive/instructions.md`.

235. **15 November 2026** (every project with checks on its pull requests, the core among them; in chats with a
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
