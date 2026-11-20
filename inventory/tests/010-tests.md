- `.github/workflows/tests.yml`, `scripts/select.mjs`, `scripts/hurry.mjs`, `scripts/name-trie.mjs`, `scripts/workflow-run.mjs`, `scripts/scratch-core.mjs`,
  `scripts/hostile.mjs`, `tests/hostile-build-files-test.mjs`, `tests/hostile-configs-test.mjs`,
  `tests/hostile-github-test.mjs`, `tests/hostile-issues-test.mjs`, `tests/hostile-packages-test.mjs`,
  `tests/hostile-pr-changes-test.mjs`, `tests/hostile-pr-comments-test.mjs`, `tests/hostile-pr-text-test.mjs`,
  `tests/own-inputs-test.mjs`, `tests/release-install-test.mjs`, `tests/upgrade-test.mjs`: runs the core's own suites on Linux and Windows, and, through
  `select.mjs`, only the tests a change can reach. *Runs:* the runners; any session by hand. *Else:* Node's own runner
  and assertions (`node:test`, `node:assert`), which #486's point 11 already takes, each where its file is next changed;
  for the selection, Jest's related tests, Vitest's changed mode and Nx's affected, dropped on fact: each needs its
  framework and reads JavaScript alone, where `select.mjs` reads C# and Python too. *Bugs:* 17 naming `tests.yml`, 2
  `select.mjs`. **Keep** the selection: nothing fits. The upgrade test's runner of workflows
  (`scripts/workflow-run.mjs`) stays as #486 says: `act`, dropped on fact, needs a container a session cannot start;
  its YAML is read by the YAML package (#530).
