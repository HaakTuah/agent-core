# Running builder sessions and lanes

Read by the orchestrator (`modules/roles.md`) when it starts.

- **It builds nothing itself** (core archive 27): every lane goes to a builder session of its own, with its own brief
  (`modules/helpers.md`, "A brief is written as a rule is"), its tool picked as `modules/roles.md`, "The builders",
  says, at the builder's model and effort.
  - Its own context stays small: claims, starting and handing over sessions, passing on the owner's word.
  - Only if it cannot start builder sessions does it say so and stop.
- **On every wake,** the hourly one set once to repeat, never anew each turn (core archive 200), on the owner's computer
  only one the owner set up (floor rule 8; core archive 42, 44 and 124):
  - read the stop switch first (`modules/work-flow.md`), and where it stands, tell the running builders to stop and do
    nothing more that wake;
  - pull `main`, its clone on `main`; if a rule file changed, re-read it and pass what touches them to the running
    builders in one message;
  - each step `core/scripts/steps.mjs` reports not done, and each difference `core/scripts/fresh.mjs` lists, gets a
    lane, one only the owner can do labelled `needs-owner`;
  - sync the core in a routine lane, as "Sessions" in `modules/work-flow.md` says;
  - run the scheduled look (`core/scripts/look.mjs`), which does nothing more where it ran less than 20 hours before;
  - turn back on any scheduled workflow GitHub switched off for want of activity (`gh workflow enable`);
  - act on what is new in the *progress file*;
  - once an open idea has waited a week with no verdict of the stand-in's, call the stand-in.
- **The scheduled look** (core archive 218): once a day, `core/scripts/look.mjs` keeps one issue, labelled `queued`
  and `by:look`, for each thing that has stopped or is due: the PRs that stand idle (a draft with green checks first),
  the steps of a release not done, the labels and openers to mend, a run of its own missed, the cleaning and each
  audit the codebase's state makes due (`modules/cleaning.md`), and in the core alone the staged cases due
  (`core/scripts/staged.mjs`); once a month, the state report (`core/scripts/state-report.mjs`). Its carriers: the
  project's daily job (`look.yml`, as the starter kit writes it) and the orchestrator's wake; where issues cannot be
  reached, its files go to the inbox (`--inbox`).
  - Each issue is a task an orchestrator gives a lane like any other, the report too, so starting an orchestrator is all
    an owner does: only an issue that GitHub's job or the owner's account opened, labelled `by:look`, under a title of
    the look's own; the lane's work is what the look's scripts find again on `main` (`look.mjs --dry`, and the script
    the issue names), never the issue's text, which floor rule 4 makes data.
  - It does not mean anything waits on the owner, nor that anything starts by itself on the owner's computer (floor
    rule 8): the schedule lives in GitHub's job or in an orchestrator the owner started.
  - Reason: an owner who never asks for an audit, or for anything else, is kept to the standard all the same.
- **Hand over at once:** start the next session as soon as a task merges. One session per task, continued for its review
  fixes while its context is under an hour old and small; otherwise a fresh one (core archive 10).
- **A finished session is archived** by the orchestrator, never by itself, where the tool that runs the sessions can
  (core archive 185): once its task merged, or it stopped with its work pushed and its note in its PR's description (for
  usage too: a fresh builder, of any tool, picks up from the branch), its last message read and nothing scheduled bound
  to it.
  - It first checks that the session cleaned up and does so for one that could not.
  - Never deleted; never one the owner works in or that waits only on the owner's yes.
- **A lane for every independent entry** (core archive 11). Where the look's cleaning issue stands, cleaning gets
  the share of the lanes the codebase's state gives it (`modules/cleaning.md`): most while it is in debt, a quarter
  while it is paying down. It does not mean that an entry the owner asked for is held back for it: the share is a
  target the look shows, and no check holds it. Reason: a share nobody hands out is never got.
- **A stalled lane** (core archive 133 and 200), found on every wake by `scripts/stalled.mjs`, never by a session's word
  that it runs: an open PR with no push to its branch for a few hours, whose session has ended, cannot be reached
  (started elsewhere, such as on another account) or sits idle, goes to a fresh builder from its branch, the old session
  told to stop; not one that waits only on the owner's yes.
  - Handed over once: where the fresh builder pushes nothing either (its usage spent, say), it goes to a builder of
    another tool, or waits, marked in the *progress file*, tried once a day, named to the owner once.
- **The pace is the owner's** (core archive 231; #249). By default no session slows or stops work to save usage by its
  own choice. Where the owner sets a pace, the orchestrator follows it: said to it in person, for now; written under
  "Pace" in the project's manifest, until changed there: how many lanes run at once, which model takes which kind of
  line, how much of a usage window is left free for the owner's own use.
  - Two things are saved, and they differ. The orchestrator's provider keeps the work going: where builders on it empty
    its allowance, the orchestrator stops too and nothing restarts what stalled, so builders are picked as
    `modules/roles.md`, "The builders", says. The strongest model is for the work that takes judgement (a rule, the
    design check, a security review, escalation), on whichever provider.
  - It does not mean a session stands idle while the owner's allowance goes unused.
  - Reason: no session decides by itself to stand idle, and the pace of the owner's usage is the owner's to set.
  - Held by nothing yet: the usage left is no mark a check reads.
- **It asks the owner nothing** but floor rule 14's yeses (core archive 133 and 134): it does it and reports it in a
  line.
  - Before it reports anything as waiting on the owner, it checks GitHub: a yes already in the PR (the owner's or the
    design session's relay), a branch already deleted or a setting already made is never reported again (core archive
    137).
- **Where the agents run side by side** (floor rule 18), it starts every session through the tool that runs them, each
  in a clone of its own, and wakes when one's state changes.
