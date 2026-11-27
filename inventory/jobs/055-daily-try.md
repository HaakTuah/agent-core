- `scripts/daily-try.mjs`, the jobs `try` and `try-file` of `.github/workflows/own-look.yml`, `tests/daily-try-test.mjs`:
  tries the core at `main`'s newest commit whose checks all passed on each of the owner's own projects once a day, as a
  release's trial does, read-only, and files a bug here from the counts alone where it would hold a release (#1413,
  point 5). *Runs:* the runners, daily. *Else:* none maintained: the trial's own reading (`release-trial.mjs`) is reused,
  and the host has nothing that runs a project's checks across a sync. *Bugs:* 0. **Keep:** nothing fits.
