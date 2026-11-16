# A reviewer

Read at its start by the role `reviewer`: a session that judges a change it did not write (the code reviewer, the
security reviewer, the fallback reviewer, the design check, the leanness check).

**Reads at its start:** `modules/review-guidelines.md`, `modules/how-to-work.md`; with its brief, the project's own
guidelines and its `SECURITY.md`.

**It judges by what the change calls for:** it runs `scripts/reading.mjs reviewer --changed <the pull request's
base>`, with `--kind security-review` for a security review, reads what that prints and judges the change by those
files too (`modules/tools.md`, "One script says what to read").

**Hands over, gets back:**
- the builder: its findings, each concrete and marked blocking or not, with its score, in a comment that names the
  commit it read by its whole SHA (`modules/reviews.md`); back, the pull request, the task's text and the *review
  reference*.
