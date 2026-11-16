# Planning

Read when a queue is planned (core archive 241; #322): the kind `planning`, a task that adds lines to the *progress
file*, changes their order or names a milestone, as the orchestrator and the design session do.

- **Milestones, named in order.** By default whoever writes the *progress file* (the orchestrator or the design session)
  names the project's milestones, each an issue of its own that says the state the owner can use and try there and what
  is judged there, and shows them in the file in order, each as a heading that begins "Milestone" and names its issue,
  over the lines that lead to it; the file holds nothing more, as
  `roles/shared/inbox.md` says. The first is the thinnest whole: the product's main thing from start to finish, plain and working. The
  one condition that changes it: where the *milestone* slot names another unit, such as the core's batch and its
  release, that is the milestone, and the file needs no heading for it. It does not mean dates, deadlines or estimates
  for a milestone, a milestone as a gate that stops work, nor that a project with none named yet fails anything.
  Reason: nothing said when a whole product is tried and judged, and a first version that is thin and whole tests the
  riskiest guess first. Held by the description check (`scripts/pr-description.mjs`, with `scripts/milestones.mjs`),
  in part: it fails a pull request that leaves a milestone's heading naming no issue or with no line under it, or
  adds one naming an issue that is closed.
- **The pull request that takes out a milestone's last line reaches it.** By default the builder whose pull request
  takes out the last line under a milestone's heading takes the heading out with it, closes the milestone's issue
  ("Fixes #n") and names it under "What the owner can try", saying what the owner can now use and try from start to
  finish. The one condition that changes it: where lines still lead to it, the file's writer puts them under it first.
  It does not mean that the milestone's issue closes before its last line merges, nor that a heading is taken out to
  drop a milestone without its issue closed first, saying why. Reason: the owner learns that a whole is ready to try
  from the pull request that made it so. Held by the same check, which fails a pull request that closes a milestone's
  issue and leaves its heading or does not name it under "What the owner can try", or takes out a heading whose issue
  stays open.
- **The owner's notes are gathered at a milestone.** By default, once a pull request that reaches a milestone merges,
  the session the owner gives its notes on it to takes them in one sitting and files each as an issue: a correction,
  naming the merged pull request it corrects, or a task, which is queued as any other line. The one condition that
  changes it: a note the owner gives between milestones is filed the same way when it is given. It does not mean that
  anything waits on the owner: between milestones nothing does, and no milestone stops the build, whose next lines go
  on while the owner tries this one (floor rule 14). Reason: the owner's corrections are the scarcest thing in the
  process, and arriving whenever the owner happens to try the product, each cuts into work in flight. Held in part by
  the description check, which holds that the pull request reaching a milestone names it; the sitting itself, by none.
- **Finding out is a task of its own.** By default, where a task is the *hard work* and no one can name its approach
  before it starts (which of two ways will do, whether a tool can, a number not yet measured), whoever queues it queues
  first a trial, a task whose pull request carries its *report* (what was tried, measured and found), and the build
  after it, waiting on the trial. The one condition that changes it: a builder that finds so only at its task's start
  makes the trial its pull request, which closes nothing, and the build follows from its report in the line's next
  pull request. It does not mean a trial for a task whose approach is known, nor a document of its own beyond the
  report. Reason: measured on 11 to 15 November 2026, the longest tenth of the pull requests held about four fifths of
  all open hours in two projects, each with the measuring and the building in one. Held by the design check, which asks
  of a pull request that does the *hard work* whether its approach was known before it was built (`tasks/reviews.md`,
  point 4), in part.
- **A task finishes under the release it began with.** By default a session syncs the core only between its tasks
  (`roles/shared/work-flow.md`, "Sessions"), and a task in flight finishes under the rules of the copy it began with,
  though its branch takes a newer copy when it is brought up to date with `main`. The one condition that changes it:
  where that newer copy changes the floor (`core/floor/`), its builder reads the floor again and meets it before the
  pull request merges. It does not mean that a check the newer copy brings is skipped, which runs as the base holds it
  ("Nothing locks a project", in the core's `AGENTS.md`), nor that the rest of the rules are read again. Reason: a task
  whose rules move under it is read and built twice, and the floor alone guards what cannot wait. Held by none: no
  check sees what a session read.
