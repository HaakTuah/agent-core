# Reviews

Which PR gets which review, how Codex's is asked for, the security gate, and why only a 10 passes. Read when a PR is
reviewed. Leans on `modules/review-guidelines.md` and `modules/roles.md`.

## Codex reviews

Codex reviews Claude's PRs on its own subscription, so Claude's usage goes to building; its usage can run out too,
without a word (core archive 20).

**Which PR gets which review:** the *design-checked PRs* get the code review and the design check, at once (point 5);
every other PR that changes the project, its data, tests, tools or config, and Dependabot's updates, the code review;
docs-only PRs and the milestone PRs none, unless one changes a protected file (`floor/security.md`, rule 3), which gets
the code review (core archive 47); every PR, its one security review when it is marked ready (point 6); a PR Codex
built, the fallback reviewer in place of Codex's code review.

1. **Ask:** a comment `@codex review` alone. Codex reads the PR's description, so the task's text and the sections it
   names go there. **Write the Codex mention only to ask for a code review**, alone at the start of a comment: any other
   request fails (its tasks need an environment it cannot have yet), and its bot answers every mention it finds, even
   in backticks, so text that only talks about it says "the Codex mention".
2. **It starts within seconds** (its 👀 reaction and a "Codex Review Summary" comment) **and finishes within
   minutes.** No sign within about 5 minutes, or an answer that is not a review (no usage left, an error): the fallback
   reviewer takes the PR at once (core archive 19 and 20).
3. **Still running after about 15 minutes:** ask once more. No finished review about 5 minutes after that: the fallback
   reviewer takes it. A late Codex review is still read, but nothing waits for it.
4. **It gives findings by priority, not a score,** whatever it is asked: nothing open (its 👍 or "Didn't find any
   major issues", or every finding fixed or moved out as "Only a 10 passes" says) is Codex's 10. P0 and P1 are fixed
   first.
5. **The design check, with a score:** on the design-checked PRs, once before the merge, the design checker, given its
   brief (point 7 below), scores the work from 1 to 10 against the design alone, listing what keeps it from 10, since
   Codex looks for faults and security: its first canary found every planted fault, but the broad feedback on the
   design is the design check's (core archive 22). **Both at once:** the design check starts in the same turn as the
   request to Codex, in the background, and the builder answers both lists in one round.
6. **Codex reviews only when asked. Security reviews: one by itself when a PR is ready; after that, the fallback
   reviewer** (core archive 47, 48, 50 and 51). Codex runs one security review by itself when a PR is opened for review
   or a draft is marked ready, never while a draft and never twice on one commit; asking runs a code review alone
   ("Setup" in `modules/codex.md`), so no builder asks. When a later commit changes what a security review is for (input
   from users, models or files, a workflow, the network, saved files or exports, a dependency newly added or moved up a
   major version), or fixes a security finding, the fallback reviewer reviews that change against the project's
   `SECURITY.md` with the floor, and its threat model, once, on the round expected to be the last, and the PR says so;
   never for a change proven unchanged in what it does (a split by meaning, unused code removed, a rename) nor for docs.
   **A security review ran only if Codex's summary lists "🔒 Security Review" as completed, or the fallback reviewer's
   review is in the PR;** one with no findings posts nothing else. Its findings count as a code review's; a Codex
   finding fixed by a later commit is closed by the fallback reviewer's check of that commit, its thread answered and
   resolved. **The security gate** is floor rule 8: if no completed security review appears within about 30 minutes
   of the ready mark, the fallback reviewer reviews the diff against the project's `SECURITY.md` with the floor, and its
   threat model, the PR says so, it may merge on that, and the next wake reports it to the owner; the same reviewer
   reviews, in the milestone PR, a commit that reached `develop` without the gate.
7. **Checks that run the work, once Codex can build** (core archive 25). The native review reads the diff but runs
   nothing, so it cannot check a measured claim. Once Codex's environments work, a Codex task also reruns the
   *measurements* a PR's claims rest on and confirms or corrects them; until then CI and the fallback reviewer check
   them.

## Only a 10 passes

Every review, in either direction, passes the work only at a 10 (for Codex, nothing open), with two guards: the rounds
come to an end, and what a 10 means never slips (core archive 18 and 23).

1. **The list decides the score,** as "How a review passes" in `modules/review-guidelines.md` defines it; only the
   owner changes that definition.
2. **Every point is fixed, or moved out with a reason.** A point within the task is always fixed. One outside it may
   become a follow-up (a `bug` issue if a bug, otherwise an entry in the *progress file*), with the reason in the PR. A
   point the builder thinks wrong is answered in the PR with why. The next round's reviewer rules on each.
3. **Later rounds judge the change, and only the change** (core archive 74): the diff since the last round, the earlier
   lists and answers, and "How a review passes" and "What blocks" from the guidelines, with the same model and effort;
   a file the change touches may be read when the diff alone cannot settle a point.
4. **At most three rounds for each review, Codex's included, then escalation, then blocked;** a fourth round is never
   asked for. What is still open goes to escalation (`modules/roles.md`) with a self-contained brief, which fixes each
   point or rules it outside the task or wrong, with reasons. If anything is still open, the PR is **not merged:** it is
   marked blocked in the *progress file* and filed as a `question` issue linked under "Questions for the owner", and the
   work goes on with the next task that does not depend on it. Nothing is ever merged below 10.
5. **The bar does not slip.** These checks, each a builder session the orchestrator starts:
   - **A blind re-review every week:** a PR merged at 10 the week before (each category in turn) goes to a fresh
     fallback reviewer with the standard brief and nothing of its rounds; each blocking point it finds is a **miss**,
     and becomes a follow-up.
   - **A canary now and then:** about every two weeks, and whenever a reviewer's model, settings or guidelines change, a
     test PR with planted faults (a bug, a broken standing rule, a security hole, a departure from the design) goes to
     each reviewer and is never merged. Each fault not found is a miss.
   - **A slop check every month,** where the project has text its users read (core archive 49): a fresh reviewer reads
     only that text changed since the last check, scored against the *slop bar*, which says where its finds are fixed.
     The slop audit's formula test runs on every code PR.
   - **Logged:** each check is a row in the calibration log, `docs/calibration.md`, and each milestone PR says in one
     line the misses since the last. Two misses in a row by one reviewer: its brief or guidelines are tightened with the
     owner, a test is added for each fault it missed, and a canary runs again at once. It keeps reviewing meanwhile,
     since Claude's usage is the scarcer and a reviewer that catches most faults beats none (core archive 72).
   - **The log is the schedule:** the week's first milestone PR opens a lane for each check whose last row is older
     than its interval (core archive 62).
6. **One line in each PR:** `Review: <category> · <builder> · <each round's result>`, a score, or Codex's verdict
   (`clean`, or findings such as `P1×2`): `Review: rules · Claude · 7, 9, 10`. The milestone PR sums them by category
   and builder, with the rounds per PR: a category where Codex scores lower moves back to Claude, one where it does well
   gets more, one that often needs three rounds needs better briefs.
7. **The briefs.** A reviewer starts cold and gets its brief and nothing more. **The fallback reviewer's:** the diff,
   the task's text, the *review reference*, and the review guidelines (the core's and the project's), whole. **The
   design checker's:** the same, and what the project's guidelines add for it; it sends the work back until it meets
   the task and the *review reference*. **A later round's:** point 3's. **An escalation's:** `modules/roles.md`.
