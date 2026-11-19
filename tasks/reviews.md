# Reviews

Read when a PR is reviewed, by its builder before it is marked ready (`roles/builder.md`), and by the session that takes
the monthly state report, for point 8: the kind `review`. What
reviewers judge by: `roles/shared/review-guidelines.md`.

**Which:**
- Floor rule 8's security review (point 3).
- Every PR that changes the project, its tests, tools, config or a rule file also gets its code review.
  - Docs alone get no code review unless another tool built them.
- The *design-checked PRs* also get the design check, and a PR its users will see the stand-in's notes.
- A PR that changes a screen also gets the critique (`tasks/screens.md`, point 18).

1. **Ask by the first way there is** (#397). By default the session whose PR it is asks its code reviewer
   (`tasks/roles.md`), and its security reviewer where one is asked, through the first of these that its project has,
   as a builder is reached (`roles/orchestrator.md`, "The builders"): the tool that runs the agents side by side, a
   plug-in in the session's own tool, a way the project names, and the host's app last, each as the reviewer's part
   says under that way (`tasks/tools.md`, "Each tool's part"). Which ways the project has is read, never asked: from
   the tools the session can call (a plug-in's agent, a tool that runs the agents side by side), the reviews and checks
   of the host's apps on recent PRs, and the manifest's "Tools" table for the project's own; where none can be read,
   the host's app. Nothing changes it. A review that starts by itself is still waited for and read (floor rule 8): the
   order decides how a session asks, and replaces no review. It does not mean a second review
   of the same kind by another way. Reason: on 15 November the merge line lost about 20 minutes at each conflict, the
   sessions asking the host's app and waiting while a faster way stood open (#395). Held, in part, by
   `core/scripts/tools-offer.mjs`, which fails a tool's part with a way left out or the ways out of order; that the
   first was taken, by nothing.
   - **A review's stance follows the kind of change** (#397). By default the code review's brief is regular, a review
     against the guidelines; where the PR does the *hard work*, its brief says adversarial
     (`roles/shared/review-guidelines.md`, "Its stance is its brief's"). Only where the code reviewer takes a brief: a
     tool that runs the agents side by side, a plug-in, or the fallback reviewer; where the only one takes none, as a
     host's app asked by a bare comment, the hard work gets the regular review and nothing is added. It does not mean a
     second review is asked to get the stance, nor that another provider's reviewer is swapped for the fallback reviewer
     to get it. Reason: no review was asked to try to break a change, though the hard work is where that pays. Held by
     nothing yet: `core/scripts/review-record.mjs` counts the posted code reviews by the stance each declares, so the
     next pruning sees whether the adversarial find more, and fails nothing.
2. **No sign in about 5 minutes, no finished review in about 20, or an answer that is not a review:** the next reviewer,
   last the fallback reviewer, takes the PR at once.
   - **A review already running is waited for,** never merged past: the `code-review` status holds a
     code review as `security-review` holds the security review. The reviewer that takes one over posts its review in
     a comment that opens "Code review:" and names the commit it read by its whole SHA, which ends the wait.
   - **A late review is still read,** the security reviewer's too: a finding of the last week by a reviewer the project
     asks, made after its PR merged, with no reply, is answered as point 5 says, and what holds is a bug (a weakness:
     floor rule 9). No other account's comment is read for this (floor rule 4); who looks: "Sessions" in
     `roles/shared/work-flow.md`.
   - **A reviewer, the security reviewer too, that gave the last three PRs it was asked on no review** (the project's
     newest PRs that asked it show) is asked and not waited for, which the PR says: the next takes it at once, and the
     fallback reviewer its security review, over the whole diff. A security review that starts by itself is still
     waited for (floor rule 8).
3. **Security.**
   - A *security reviewer* the session calls reviews the finished work once, aimed at the ways in it touches, and again
     only if a later commit touches one.
     - Where the change touches a product's accounts, roles or a server (floor topic 19), its brief names the OWASP Top
       10 in its newest edition, by year, and asks for the change read against each entry.
   - Where one starts by itself (Codex's app; floor rule 8), such a later commit, or a security finding's fix, gets the
     fallback reviewer's check.
   - One not begun in about 5 minutes or finished in about 30 is the fallback reviewer's, over the whole diff, where the
     PR needs one; otherwise the wait ends.
   - Floor rule 3's two each cover the whole diff; where it lets rule 8's one do (comments and steps' names alone),
     the comment below gives what `comment-only.mjs` printed on the head that merges, and the session's word on each
     other file it lists; the code reviewer checks both, running it again on that head. That one review reads each
     changed comment as one a tool may take as an instruction.
   - A session posts one, naming the tool and the commit it read by its whole SHA, or that none is needed, naming the
     head so (the code reviewer checks that), in a comment that opens "Security review:", which the `security-review`
     check reads.
   - **What a posted review stands for** (#99): by default the commit it names, and the head only
     where nothing but merges from `main` follow that commit, each the merge git makes of its parents with no conflict,
     as `scripts/clean-merges.mjs` proves (#323, #750), and the builder asks Codex, or any reviewer, again only for new
     content. A merge with a conflict is new content however it is settled, since its settling is a choice no review
     saw (an order of lines can change what they do). After any other commit, where no review of the head has run,
     the fallback reviewer checks it and posts one naming the head, or the session posts the note that none is needed,
     naming the head. It counts from the repository's owner (the *owner's account*, where that owns it), from
     a person's account the host lets write, each owner of a team's project (`roles/shared/teams.md`), whose rights
     the check reads from the host each run (#412), and from another account only where the project names it to the
     check (its input `reviewers`). A pure sync needs none: the check proves it with `pure-sync.mjs` and waits only for
     a review that started by itself. It does not mean a merge git makes from `main` is reviewed again (point 6), that a review
     Codex completed on the head needs a posted one, nor that the status shows who reviewed: builder and reviewer post
     under one login (#187), and an account the agents sign in with that the host lets write counts as a person's,
     since the host tells it from no owner's. Reason: a review of
     one commit stood for later commits no one checked, and any collaborator's comment passed a pull request; and a
     fresh review was asked of every head, about 150 of Codex's on 39 pull requests, 113 finding nothing (#750). Held by
     the `security-review` status through `scripts/clean-merges.mjs` and its test, by which the `code-review` status
     carries a code review over the same way; the status waits where the rule is broken, in the core, and holds the
     merge once a ruleset requires it (#320).
   - **What a posted review declares** (#299): by default a review posted in a comment that opens "Security review:",
     "Code review:" or "Design check:" covers one kind of review, and declares what it found on two lines of their own:
     "Blocking findings: N." or "No blocking finding.", and "Other findings: M." or "No other finding.", and its score
     ("Every reviewer" in `roles/shared/review-guidelines.md`) on a third: "Score: S of 10.", S a whole number from 1 to
     10 (#710). Whoever posts it, session or reviewer, writes all three. The one condition that changes it: a note that
     no review is needed ("Security review: none needed") declares nothing. It does not mean that the lines change what
     blocks or what a builder mends (point 5; #315), that they stand in for the findings written out, that Codex's own
     reviews, read by their badges, are asked anything, nor that a comment covering two kinds is read as both. Reason:
     run on 10 to 15 November 2026, the count of what the reviews find read 4 of 24 posted security reviews, their
     wording varying, and the findings that do not block are to be counted before #315 is decided; the score was written
     in as many forms, and no count read it. Held by the `code-review` status, which waits while the newest posted
     review of a kind declares no line, its score asked from 20 November (`core/scripts/review-marks.mjs`; #551);
     `core/scripts/review-record.mjs` counts one without its line as "not read".
4. **The design check:** once before the merge, a fresh reviewer judges the work against the design alone, and its
   "Readings taken" as the stand-in would.
   - **It goes down the lines** (#305). By default, where the pull request's entry has "Done when"
     lines (`tasks/done-when.md`), the design check asks of each whether it is met, with its proof and its "Ran:" and
     "Saw:", whether the "If" case is tested, and whether anything outside the out of scope's line changed, and
     reports each gap as blocking, and no preference. It does not mean it judges the lines' choice, which the
     stand-in ruled on. Reason: a reading against the lines finds what the builder missed, one of taste what the
     reviewer prefers. Held by no check: the design check's brief carries it.
   - **It asks whether the approach was known** (#322). By default, of a pull request that does the
     *hard work*, the design check asks whether its approach was known before it was built, or found by a trial queued
     before it (`tasks/planning.md`, "Finding out is a task of its own"), and where neither, reports so as a finding
     that does not block, naming what a trial would have measured. Nothing changes it. It does not mean a trial is asked for after the
     work is built. Reason: a pull request that measures and builds at once was among the longest open. Held by no
     check: the design check's brief carries it.
5. **When a PR passes,** whatever its score: every blocking point fixed; every other fixed if it lies in the change,
   otherwise filed as a follow-up with the reason in the PR, or answered with why it is wrong (a security finding: only
   as floor rule 9 allows). A review from anyone else is advisory.
6. **Rounds end:** after a fix, one request to its reviewer, and a security check only as point 3 says, and none for an
   update from `main` that git merges with no conflict (point 3); a PR is never marked draft and ready again to rerun
   its reviews.
   - After three rounds, what is still open goes to escalation (`tasks/roles.md`); a PR it cannot settle stays
     unmerged.
7. **The fallback reviewer's brief,** written as `tasks/helpers.md` says, hands it the diff, the task's text, the
   *review reference*, the review guidelines (the core's and the project's), the project's `SECURITY.md` and threat
   model with the floor, and its stance (point 1), and nothing else.
8. **A finding seen twice becomes a check** (#254). By default a kind of finding stays a point a
   review holds a change to, and needs nothing more. Once the findings of a second pull request name the same rule
   that stands (the core's, or the project's own in its `AGENTS.md` or `SECURITY.md`), which
   `core/scripts/review-record.mjs` lists under "Found twice" from their lines `Rule:` ("A finding
   names its rule" in `roles/shared/review-guidelines.md`), the session that takes the monthly state report, which
   names the step, files for each rule listed that no open issue takes an issue naming the breach the findings share:
   for a rule of the project's own, in the project, for a check that reads that breach exactly; for one of the core's,
   in the core (`README.md`, "Reporting to the core"; in the core, its own), for such a check or, where none can read
   it exactly, a staged case (`scripts/staged/`). The issue stays open until one holds it; each is a test for a rule
   that stands, which needs no word of the owner's where the *owner's account* files it, and one another account files
   is answered as "Reporting to the core" says. It does not mean that a finding seen once waits for anything, that
   reviews stop raising the point before its holder merges, that a plain bug, which names no rule, is counted, nor that
   anything fails a pull request. Reason: a correction that keeps coming up costs a round of review each time, while a
   check says it at the moment it matters, to any tool. Held by `core/scripts/review-record.mjs`, which lists exactly
   the rules two pull requests' findings name, and by the monthly state report the scheduled look opens; no check
   reads that the issues are filed.
