# Reviews

Read when a PR is reviewed, by its builder before it is marked ready (`roles/builder.md`): the kind `review`. What
reviewers judge by: `roles/shared/review-guidelines.md`.

**Which:**
- Floor rule 8's security review (point 3).
- Every PR that changes the project, its tests, tools, config or a rule file also gets its code review.
  - Docs alone get no code review unless another tool built them.
- The *design-checked PRs* also get the design check, and a PR its users will see the stand-in's notes.
- A PR that changes a screen also gets the critique (`tasks/screens.md`, point 18).

1. **Ask** the code reviewer (`tasks/roles.md`) as its part (`tools/codex.md`, `tools/copilot.md`) or the project
   says.
2. **No sign in about 5 minutes, no finished review in about 20, or an answer that is not a review:** the next reviewer,
   last the fallback reviewer, takes the PR at once (core archive 19 and 20).
   - **A review already running is waited for,** never merged past (core archive 206): the `code-review` status holds a
     code review as `security-review` holds the security review. The reviewer that takes one over posts its review in
     a comment that opens "Code review:" and names the commit it read by its whole SHA, which ends the wait.
   - **A late review is still read,** the security reviewer's too: a finding of the last week by a reviewer the project
     asks, made after its PR merged, with no reply, is answered as point 5 says, and what holds is a bug (a weakness:
     floor rule 9). No other account's comment is read for this (floor rule 4); who looks: "Sessions" in
     `roles/shared/work-flow.md` (core archive 181).
   - **A reviewer, the security reviewer too, that gave the last three PRs it was asked on no review** (the project's
     newest PRs that asked it show) is asked and not waited for, which the PR says: the next takes it at once, and the
     fallback reviewer its security review, over the whole diff. A security review that starts by itself is still
     waited for (floor rule 8).
3. **Security** (core archive 47 to 51, 174, 177).
   - A *security reviewer* the session calls reviews the finished work once, aimed at the ways in it touches, and again
     only if a later commit touches one.
     - Where the change touches a product's accounts, roles or a server (floor topic 19), its brief names the OWASP Top
       10 in its newest edition, by year, and asks for the change read against each entry (core archive 227).
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
   - **What a posted review stands for** (#99; core archive 220): by default the commit it names, and the head only
     where nothing but updates from `main` follow that commit; after any other commit, where no review of the head has
     run, the fallback reviewer checks it and posts one naming the head, or the session posts the note that none is
     needed, naming the head. It counts from the repository's owner (the *owner's account*, where that owns it), and
     from another account only where the project names it to the check (its input `reviewers`). A pure sync needs
     none: the check proves it with `pure-sync.mjs` and waits only for a review that started by itself. It does not
     mean an update from `main` is reviewed again (point 6), that a review Codex completed on the head needs a posted
     one, nor that the status shows who reviewed: builder and reviewer post under one login (#187). Reason: a review of
     one commit stood for later commits no one checked, and any collaborator's comment passed a pull request. Held by
     the `security-review` status, which waits where it is broken, in the core, and holds the merge once a ruleset
     requires it (#320).
   - **What a posted review declares** (#299; core archive 235): by default a review posted in a comment that opens
     "Security review:", "Code review:" or "Design check:" covers one kind of review, and declares what it found on two
     lines of their own: "Blocking findings: N." or "No blocking finding.", and "Other findings: M." or "No other
     finding.". Whoever posts it, session or reviewer, writes both. The one condition that changes it: a note that no
     review is needed ("Security review: none needed") declares nothing. It does not mean that the lines change what
     blocks or what a builder mends (point 5; #315), that they stand in for the findings written out, that Codex's own
     reviews, read by their badges, are asked anything, nor that a comment covering two kinds is read as both. Reason:
     run on 10 to 15 November 2026, the count of what the reviews find read 4 of 24 posted security reviews, their
     wording varying, and the findings that do not block are to be counted before #315 is decided. Held by no check
     yet: `core/scripts/review-record.mjs` counts a review without its line as "not read", never as none, so the share
     not read shows where the form is not kept, and no check fails a pull request for it.
4. **The design check:** once before the merge, a fresh reviewer judges the work against the design alone, and its
   "Readings taken" as the stand-in would (core archive 22).
   - **It goes down the lines** (core archive 240; #305). By default, where the pull request's entry has "Done when"
     lines (`tasks/done-when.md`), the design check asks of each whether it is met, with its proof and its "Ran:" and
     "Saw:", whether the "If" case is tested, and whether anything outside the out of scope's line changed, and
     reports each gap as blocking, and no preference. It does not mean it judges the lines' choice, which the
     stand-in ruled on. Reason: a reading against the lines finds what the builder missed, one of taste what the
     reviewer prefers. Held by no check: the design check's brief carries it.
5. **When a PR passes,** whatever its score: every blocking point fixed; every other fixed if it lies in the change,
   otherwise filed as a follow-up with the reason in the PR, or answered with why it is wrong (a security finding: only
   as floor rule 9 allows). A review from anyone else is advisory (core archive 130).
6. **Rounds end:** after a fix, one request to its reviewer, and a security check only as point 3 says, and none for an
   update from `main` without a conflict; a PR is never marked draft and ready again to rerun its reviews.
   - After three rounds, what is still open goes to escalation (`tasks/roles.md`); a PR it cannot settle stays
     unmerged.
7. **The fallback reviewer's brief,** written as `tasks/helpers.md` says, hands it the diff, the task's text, the
   *review reference*, the review guidelines (the core's and the project's) and the project's `SECURITY.md` and threat
   model with the floor, and nothing else.
