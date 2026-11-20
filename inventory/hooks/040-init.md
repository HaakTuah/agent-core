- `scripts/init.mjs`, `scripts/steps.mjs`, `scripts/step-checks.mjs`, `scripts/step-checks-tests.mjs`,
  `scripts/step-checks-ready.mjs`, `scripts/step-checks-tool-files.mjs`, `scripts/step-checks-shape.mjs`,
  `scripts/step-checks-workflow-text.mjs`, `scripts/step-checks-jobs.mjs`, `scripts/step-checks-lookup.mjs`,
  `scripts/step-checks-hostile.mjs`, `scripts/step-checks-moved.mjs`, `scripts/step-checks-packages.mjs`,
  `scripts/steps/`, `scripts/sync-notes.mjs`, `scripts/sync.mjs`, `scripts/fresh.mjs`, `scripts/check-configs.mjs`,
  `scripts/steps-stage.mjs`, `scripts/stage-helpers.mjs`, `scripts/stages/`, `scripts/bash-commands.mjs`,
  `scripts/own-files.mjs`, `scripts/runners.mjs`, `scripts/read-nothing.mjs`, `scripts/core-reading.mjs`,
  `setup/sync-notes.md`, `setup/sync-notes/`, `tests/init-dotnet-test.mjs`, `scripts/steps-kit.mjs`,
  `tests/steps-checks-run-test.mjs`, `tests/steps-files-test.mjs`, `tests/steps-tool-files-test.mjs`: the starter kit
  writes a new project's files; the sync writes the copy at a newer commit and moves the pins; each step of the sync
  notes reads done or not, the sync's report names each check that read nothing there (#459), and the step of a reading
  against the core names the rules no reading covered (#464). *Runs:* any session, in the project. *Else:* Copier and
  Cookiecutter, dropped on fact: Python and an install in the project, and #519 weighed the template; `git archive`,
  which the sync already uses. *Bugs:* 2, 8 and 4. **Keep:** nothing fits; what a release asks is the core's.
