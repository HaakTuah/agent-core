- `scripts/release.mjs`, `scripts/release-trial.mjs`, `scripts/trial-sync.mjs`, `scripts/trial-draft.mjs`, `scripts/trial-draft-checks.mjs`, `scripts/trial-draft-record.mjs`, `.github/workflows/release.yml`, `tests/release-test.mjs`, `tests/release-trial-test.mjs`: cuts
  `release-N` on the commit of `main` its trial tried once every check on it passed (#1413, point 3), its own run of the upgrade test on Windows, which it
  also runs once a day, cutting nothing, and the trial on a real project, whose record `release-trial.mjs` writes and
  reads, with the sync's reading against the commit tried that `trial-sync.mjs` reads (#1261), and the checks of the
  draft of the sync in the owner's own projects that `trial-draft.mjs` reads and `trial-draft-record.mjs` records (#1334). *Runs:* the
  runners, started by hand, and daily. *Else:* release-please, semantic-release and changesets, dropped on
  fact: they write versions and notes from commit messages, which the core does not ask. *Bugs:* 0. **Keep:** small and
  stable.
