- `.github/workflows/security-review.yml`, `.github/workflows/own-security-review.yml`,
  `.github/workflows/queue-only.yml`, `scripts/security-review.mjs`, `scripts/code-review-wait.mjs`,
  `scripts/review-marks.mjs`, `scripts/clean-merges.mjs`, `scripts/pure-sync.mjs`, `scripts/comment-only.mjs`,
  `scripts/queue-only.mjs`, `scripts/security-review-host.mjs`, `scripts/security-review-record.mjs`,
  `tests/security-review-record-run-test.mjs`: give each
  pull request's head the statuses that say whether its security review has run and a running code review has
  finished, prove a sync pure or a pull request queue-only, and compare the status with the host's own record of
  reviews and rights (#626). *Runs:* the runners,
  with the host's statuses, and the recorder by hand or at the core's monthly state report. *Else:* the host's required reviews, dropped on fact: they wait for a person's approval;
  hosted review bots, dropped on fact: paid on a private repository, and a hosted product (#534, point 6). *Bugs:* 5,
  2, 0 and 3, and 3 naming the workflow. **Keep:** nothing fits; the reviews are maintained tools already, and these
  hold only the core's policy on them.
