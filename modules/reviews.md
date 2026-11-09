# Reviews

Which PR gets which review, how Codex's review is asked for and waited on, the security gate, and the rules that make
only a 10 pass without the rounds running on or the bar slipping. Read when a PR is reviewed, by its builder and the
orchestrator. What every reviewer judges by: `modules/review-guidelines.md`. Who fills each role: `modules/roles.md`.

## Codex reviews

Codex reviews Claude's PRs that change the project, in OpenAI's cloud, on its own subscription, so Claude's weekly usage
goes to building. Its usage can run out like any other, and it may then not say so (core archive 20).

**Which PR gets which review:**

- **The *design-checked PRs*:** the code review and the design check, at once (point 5).
- **Every other PR that changes the project, its data, tests, tools or config:** the code review.
- **Dependabot's version and security updates:** the code review (`floor/security.md`, rules 3 and 4).
- **Docs-only PRs and the milestone PRs:** no code review and no design check, except a PR that changes a protected file
  (`floor/security.md`, rule 3), which gets the code review (core archive 47).
- **Every PR:** its one security review when it is marked ready (point 6).
- **A PR Codex built:** the fallback reviewer in place of Codex's code review.

1. **Ask:** a comment `@codex review` alone. Codex reads the PR's description, so the task's text and the design
   sections it names go there, and it follows the review guidelines and the floor. Its security review is not part of
   this: it runs by itself once, when the PR is ready (point 6). **Write the Codex mention only to ask for a code
   review:** `@codex review`, alone at the start of a comment. Any other request to it fails (its tasks need an
   environment it cannot have yet: "Status" in `modules/codex.md`), and its bot answers every mention it finds, even in
   backticks, so text that only talks about it says "the Codex mention".
2. **It starts within seconds** (its 👀 reaction and a "Codex Review Summary" comment) **and finishes within
   minutes**. No sign within about **5 minutes,** or an answer that is not a review (no usage left, an error): the
   fallback reviewer takes the PR at once (core archive 19 and 20).
3. **Still running after about 15 minutes:** ask once more with `@codex review`. No finished review about 5 minutes
   after that: the fallback reviewer takes it. Either way, a late Codex review is still read, but nothing waits for it.
4. **It gives findings by priority, not a score,** whatever it is asked, and passes as "How a review passes" in
   `modules/review-guidelines.md` says: nothing open (its 👍 or "Didn't find any major issues", or every finding fixed
   or moved out as "Only a 10 passes" says) is Codex's 10. P0 and P1 are fixed first.
5. **The design check, with a score:** on the design-checked PRs, once each before it is merged, the design checker
   checks the work against the design: given its brief (point 7 below), it gives the score from 1 to 10 and what keeps
   it from 10, blocking or not, on the design alone, since Codex looks for faults and security. Smaller PRs get Codex's
   review alone. **Why that is enough:** Codex's first canary found every planted fault, a bug, a broken rule and a
   security hole; what it does not give is the broad feedback on the design, which the design check gives (core
   archive 22). **Both at once:** the design check starts in the same turn as the request to Codex, in the background,
   never after Codex's answer, so neither waits for the other, and the builder answers both lists in one round.
6. **Codex reviews only when asked** (which PRs: the list above). **Security reviews: one by itself when a PR is ready;
   after that, the fallback reviewer** (core archive 47, 48, 50 and 51). Codex runs one security review by itself when a
   PR is opened for review or a draft is marked ready, never while it is a draft and never twice on one commit; asking
   for another runs a code review alone ("Setup" in `modules/codex.md`), so no builder asks for one. When a commit after
   that review changes what a security review is for (input from users, models or files, a workflow, the network, saved
   files or exports, or a dependency newly added or moved up a major version), or fixes a security finding, the fallback
   reviewer reviews that change against the floor and the threat model, once, on the round the builder expects to be
   the last, and the PR says so. Never for a change proven unchanged in what it does (a split by meaning, unused code
   removed, a rename) nor for docs: moving the code that writes a save is not changing it.
   **A security review ran only if Codex's review summary on the PR lists "🔒 Security Review" as completed, or the
   fallback reviewer's review is in the PR;** one with no findings posts nothing else. Its findings count as a code
   review's do: each is fixed, or moved out as "Only a 10 passes" says, before the merge; a Codex finding fixed by a
   later commit is closed by the fallback reviewer's check of that commit, its thread answered and resolved. **The
   security gate,** for every PR but the milestone PRs, whose commits each passed it on their way into `develop` (a
   commit that reached `develop` another way, such as a merge of `main` back with a regenerated lock file, a conflict
   resolution or a direct push, is reviewed by the fallback reviewer in the milestone PR, against the floor and the
   threat model, before it merges): a PR merges only once its security review has run, as just said. If no completed
   security review appears within about 30 minutes of the ready mark, the fallback reviewer reviews the diff against the
   floor and the threat model, the PR says so, it may merge on that review, and the next wake reports it to the owner. A
   PR with an open security finding never merges.
7. **Checks that run the work, once Codex can build** (core archive 25). The native review reads the diff but runs
   nothing, so it cannot check a measured claim. When Codex's environments work ("Setup"), a Codex task in its
   container also reruns the measurements a PR's claims rest on (the project's *measurements*) and confirms or corrects
   them, beside the native review, which stays for the diff. Until then CI and the fallback reviewer check them.

## Only a 10 passes

Every review, in either direction, passes the work only at a 10 (for Codex, nothing open), and the rule holds two
guards: the rounds come to an end, and what a 10 means never slips (core archive 18 and 23):

1. **The list decides the score,** as "How a review passes" in `modules/review-guidelines.md` defines it: a 10 is a list
   with nothing open, and only the owner changes that definition.
2. **Every point is fixed, or moved out with a reason.** A point within the task is always fixed. A point outside it
   (code or a question the task did not touch) may become a follow-up (a `bug` issue if it is a bug, otherwise an entry
   in the *progress file*), with the reason in the PR. A point the builder thinks wrong is answered in the PR with why.
   The next round's reviewer rules on each move and each answer.
3. **Later rounds judge the change, and only the change** (core archive 74). A later round's reviewer gets the diff
   since the last round, the earlier rounds' lists and the builder's answers, and "How a review passes" and "What
   blocks" from the review guidelines, not the whole first brief again, with the same model and effort; it may read a
   file the change touches when the diff alone cannot settle a point, and judges as "How a review passes" says, so the
   rounds come to an end. Point 4's three rounds hold for each review, Codex's included, since its quota is paid for
   too.
4. **At most three rounds, then escalation, then blocked, held firmly** (a fourth round is never asked for, whatever the
   reason). Anything still open after the third round goes to escalation (`modules/roles.md`) with a self-contained
   brief. It fixes each point, or rules it outside the task or wrong, with reasons. Whatever is still open after that,
   the PR is **not merged:** it stays open, marked blocked in the progress file, and is filed as a `question` issue
   linked under "Questions for the owner", and the work goes on with the next task that does not depend on it. Nothing
   is ever merged below 10.
5. **The bar does not slip.** These checks, each a builder session the orchestrator starts:
   - **A blind re-review every week:** at the first milestone of each week, a PR merged at 10 in the week before (each
     category in turn) goes to a fresh fallback reviewer with the standard brief (point 7) and nothing of the earlier
     rounds. Every blocking point it finds is a **miss:** it becomes a follow-up (a `bug` issue, if a bug) and is fixed
     like any other.
   - **A canary now and then:** about every two weeks, and whenever a reviewer's setup changes (model, settings or
     guidelines), a test PR with planted faults goes to each reviewer and is never merged. The faults are a bug, a
     broken standing rule, a security hole and a departure from the design, as in the first canary. Each fault not found
     is a miss.
   - **A slop check every month,** where the project has text its users read (core archive 49): a fresh reviewer reads
     only the text users read that changed since the last check, scored against the project's *slop bar*; what it finds
     is fixed where the *slop bar* says. The slop audit's formula test runs on every code PR.
   - **Logged and reported:** each check is a row in the calibration log, `docs/calibration.md`, and each milestone PR
     says in one line the misses since the last one. Two misses in a row by the same reviewer: its brief or guidelines
     are tightened, with the owner, a test is added for each fault it missed, and a canary runs again at once. It keeps
     reviewing meanwhile, since Claude's usage is the scarcer and a reviewer that catches most faults beats none (core
     archive 72).
   - **The log is the schedule:** the first milestone PR of each week also opens a lane for every check whose last row
     in the log is older than its interval (two weeks for the canary, a month for the monthly checks), so none waits on
     anyone's memory (core archive 62).
6. **One line in each PR:** `Review: <category> · <builder> · <each round's result>`, a score from the design check or
   the fallback reviewer, or Codex's verdict (`clean`, or its findings, such as `P1×2`): `Review: interface · Codex ·
   P1×1, P3×2, clean`, or `Review: rules · Claude · 7, 9, 10`. At each milestone the builder who opens the milestone PR
   sums them by category and builder in the milestone PR, with the rounds per PR: a category where Codex scores lower
   moves back to Claude, one where it does well gets more, and one that often needs three rounds needs better briefs.
7. **The briefs.** A reviewer starts cold and gets its brief and nothing more.
   - **The fallback reviewer's:** the diff, the task's text, the project's *review reference*, and the review
     guidelines (`modules/review-guidelines.md` and the project's own), whole.
   - **The design checker's:** the same brief, and what the project's review guidelines add for it; it sends the work
     back until it meets the task and the *review reference*.
   - **A later round's** is point 3's: the diff since the last round, the earlier lists and answers, and the two
     sections of the guidelines it judges by; **an escalation's** is in `modules/roles.md`.
