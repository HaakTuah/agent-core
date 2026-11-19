- `.github/workflows/security-review.yml`, `.github/workflows/own-security-review.yml`, `scripts/security-review.mjs`,
  `scripts/code-review-wait.mjs`, `scripts/clean-merges.mjs`, `scripts/pure-sync.mjs`: give each pull request's head the
  statuses that say whether its security review has run and a running code review has finished, and prove a sync pure.
  *Runs:* the runners, with the host's statuses. *Else:* the host's required reviews, dropped on fact: they wait for a
  person's approval; hosted review bots, dropped on fact: paid on a private repository, and a hosted product (#534,
  point 6). *Bugs:* 5, 2, 0 and 3, and 3 naming the workflow. **Keep:** nothing fits; the reviews are maintained tools
  already, and these hold only the core's policy on them.
