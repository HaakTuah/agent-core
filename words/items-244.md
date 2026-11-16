# The owner's words behind the core: items 244 and 245

What these are and how they are kept: `words/README.md`.

244. **15 November 2026** (every project, the core among them; in chats with a session the owner works with, not the
     design session, as that session recorded it on issue #302, labelled `by:chat`, under "What it is", saying the
     owner agreed to it). The session checked the core's rules against the field's practice on nine topics and set
     out additions with what holds each; the owner agreed to all of them that pass the owner's own test for a rule
     (#303), and so to seven points: an issue or note that corrects merged work carries the label `correction`, names
     the pull request it corrects and says its kind (the task was misread; it looks or feels wrong; it does not work;
     a rule was missing), set by the session that records the owner's word, and by a builder whose bug traces to a
     merged pull request; the monthly state report shows, for the core and each project that takes it, corrections
     for every ten merged tasks by kind, the time from joining the queue to merge, the share of merges followed within
     two weeks by a fix or a revert, the share of merged work that was unplanned mending, a bug's time from report to
     its fix live, the cost of each merged task and of each not corrected afterwards, the open hours with no event for
     over an hour, the commits after a pull request was ready by cause (a failed check, a review finding, measuring
     again), the tokens carried into each answer, the core's share of merged work, and how the code grows (its size,
     its files over the size mark, its functions over each mark, its dropped errors), this last a number to read and
     no target; a first reading, from history, for the two months up to 15 November 2026, the past corrections found
     by reading the issues and reports, kept beside every later one; no process number is a builder's goal, none
     standing in a brief, a rule or an entry as a target, and only properties of the code keeping a baseline; the five
     outcomes named first (the product does what was asked; it is fast; a newcomer can read and change it; a new
     user can use it; it does not break), the report leading with the direct measure of each and showing every other
     number under the outcome it stands for, and saying where an outcome has no direct measure yet; each count given
     with the range chance alone would give, twice its square root, and months added together where a count is under
     30; and an exemption leaving a mark, a pull request saying in a word where a rule lets a thing be left out ("No
     cost line: the script printed none."). Kept out: counts of lines, commits or pull requests as a measure of how
     much work was done or how well, targets for speed, a table ranking models or sessions, a dashboard, and asking
     sessions how it went. Counting the owner's corrections is the session's own fitting of the standard measures,
     marked so when put to the owner. The owner had asked:

     > What are we lacking from our ruleset, that we can prescribe and get superior output in our projects, without
     > having to manually iterate and re-prompt o so many times?

     And, on taking all the additions at once:

     > So if we adopt all of them, we then can see what makes a differnece and shrink down in time?

     And, before points 5 to 7 were added:

     > citing a rule doesn't nessecarily mean the rule made the output better? Do we actually evaluate what matters or
     > do we measures proxies that don't actually measures what we want, which is a better, more effienct, readable,
     > user-friendly, and robust, codebase?

     To the orchestrator, passed on word for word to the builder of this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind "A correction is marked" in `roles/shared/inbox.md`, the label `correction` in `scripts/labels.json` and
     its check in `scripts/labels.mjs`, "An exemption leaves a mark" in `roles/shared/work-flow.md` and its check in
     `scripts/pr-description.mjs`, "The state report leads with the outcomes" and "No process number is a builder's
     goal" in `tasks/cleaning.md` and the review guidelines' line on a brief, `scripts/outcomes.mjs` and
     `scripts/outcomes-read.mjs`, and the first reading in `reports/`.

245. **15 November 2026**; numbered 227, as item 227 (#313) also was, until 16 November 2026 (the core; in a chat with a
     session the owner works with, not the design session, as that session recorded it in a note on issue #342, labelled
     `by:builder` and filed by the builder of #242, and as the owner then told the orchestrator, who passed it on word
     for word to the builder of this rule). Shown that the list of what never matters to a project (item 224) left out
     the core's own queue and the core's workflows that no project calls, so that nearly every release still asked a
     sync, the owner agreed that `QUEUE.md` and those workflows join the list, on the condition the session proposed:
     each workflow is named one by one, the list holding no "and similar" and no pattern. To the orchestrator:

     > From the owner: yes to #342, with each workflow named one by one and no "and similar".

     Behind the core's own files named in "A release that brings nothing a project takes asks no sync of it" in
     `README.md`, "How a project takes the core", point 1, and `OWN_FILES` in `scripts/releases.mjs`.
