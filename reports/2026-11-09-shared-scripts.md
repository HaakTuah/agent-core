# The shared scripts, written once (9 November 2026)

Step 3's scripts, which both games kept twice, are now the core's, so each is written once ("Candidates for later" in
`2026-11-09-first-core.md`; core archive 3 and 68). Both games were read on `develop` (Amarna Letters at `20e00f44`,
Barkstreet Snakes at `1579ad7`) and nothing was written to either.

## What moved

| The core's file | From (the same in both games unless said) | Changed |
| --- | --- | --- |
| `scripts/work-saved.sh` | `.claude/hooks/work-saved.sh` | its comment and message point to the core's `modules/git.md`; the code is unchanged |
| `scripts/statusline.sh` | `scripts/statusline.sh` | its comment names `usage.sh` beside it; the code is unchanged |
| `scripts/usage.sh` | `scripts/usage.sh` (the games differ only in a comment's pointer) | its comment points to "Usage" in the core's `modules/claude.md`; the code is unchanged |
| `scripts/copies.mjs` | Amarna's `scripts/copies.mjs`, Barkstreet's `tools/copies-test.js` (the same check but for what each checks) | what is checked comes from a config the project names (below); it finds the project's root itself, so it runs from `core/scripts/` |
| `.github/workflows/personal-terms.yml` | the same file, already the core's | also callable (`workflow_call`) with the one secret; its concurrency moved to the job, keyed by repository, so a caller's own never clashes with it |
| `.github/workflows/copies.yml` | `.github/workflows/copies.yml` | callable only (the core has no copies check of its own); it runs the caller's `core/scripts/copies.mjs` with the config the caller passes, through `env:` (floor rule 2) |

The copies check's config is a JSON file: `baseline` (the baseline's path), `code` and `prose` (git pathspecs, `:!` to
leave a path out), and `proseFromSecurity` (true adds the files `SECURITY.md` names in rule 3 after "the rule files:",
as Barkstreet's `tools/rule-files.js` does today, so that list stays in one place). The config is part of the copies
check, so it is protected like the check (floor rule 3).

**Shown unchanged:** on scratch clones of both games, the core's `copies.mjs` with each game's config gave the same
output and exit code as each game's own check: clean (Amarna Letters: 3 old copies; Barkstreet Snakes: 0); a planted
prose copy and a planted code copy (the same failure lines, word for word); a baseline raised against `COPIES_BASE`, a
`COPIES_BASE` that is not a commit, a listed window gone, and `--write`. Barkstreet's file set from its pathspecs is the
same 249 files its filter gives. Amarna Letters stays clean once its own `scripts/copies.mjs` is removed. A config
missing, naming nothing, or holding a field of the wrong shape fails.

## What each game changes to use them (step 3)

Both games:

- **`.claude/settings.json`:** the status line runs `core/scripts/statusline.sh`, and both work-saved hooks (start and
  stop) run `core/scripts/work-saved.sh`, each still read from `refs/remotes/origin/develop:` (only the path after the
  colon changes). The cloud setup stays the game's own.
- **Removed:** `.claude/hooks/work-saved.sh`, `scripts/usage.sh` and `scripts/statusline.sh`; every pointer to them now
  names `core/scripts/` (`AGENTS.md` "Commands", `SECURITY.md` rule 3's list, which may drop the status line script,
  since `core/` is protected whole).
- **`.github/workflows/personal-terms.yml`** keeps its triggers and `permissions: contents: read`, and its one job
  becomes
  `uses: HaakTuah/agent-rules/.github/workflows/personal-terms.yml@<the core pin's full SHA>` with
  `secrets: PERSONAL_TERMS: ${{ secrets.PERSONAL_TERMS }}` (that secret alone, never `inherit`), and no steps of its own.
- **`.github/workflows/copies.yml`** keeps its triggers and permissions, and its one job becomes
  `uses: HaakTuah/agent-rules/.github/workflows/copies.yml@<the same SHA>` with `with: config: <its config's path>`.
- **`.github/dependabot.yml`:** an `ignore` entry for `HaakTuah/agent-rules*`, so only the sync PR moves those pins,
  with `core/`.
- **The manifest's *copies check* slot** names `core/scripts/copies.mjs` and the config.

Amarna Letters: a config `scripts/copies.json` with `"baseline": "scripts/copies-baseline.json"`, `"code": ["src/**/*.ts",
"src/**/*.tsx", "src/**/*.mjs", "scripts/*.mjs"]` and `"prose"` its eleven files as listed today (or
`"proseFromSecurity": true` and the two its rule 3 does not list); `scripts/copies.mjs` removed; `scripts/test.sh` runs
`node core/scripts/copies.mjs scripts/copies.json`.

Barkstreet Snakes: a config `tools/copies.json` with `"baseline": "tools/copies-baseline.json"`, `"code": ["*.js",
":!tools/dev/", ":!docs/"]`, `"prose": ["docs/developing.md", "docs/calibration.md"]` and `"proseFromSecurity": true`;
`tools/copies-test.js` removed, so `tools/rule-files.js` serves only the pointer and reading-size checks. Those two ran
inside the copies check's CI step: they become steps of `tests.yml` (the reading-size check with `SIZES_BASE` set to
the fetched base branch, as `COPIES_BASE` is today), and the `copies` suite of `scripts/test.sh` runs the core's check
with the config and the two.

Each game's PR shows its copies check passing before and after, as here.

## Readings taken

- **A reusable workflow that is also the core's own check:** `personal-terms.yml` keeps its triggers here and adds
  `workflow_call`, so it is written once for the core and both games; `copies.yml` is callable only, since the core has
  never had a copies check and adding one is not this task.
- **The caller's checkout runs the caller's `core/` copy,** not a second checkout of this repository: the check that
  `core/` matches its pin, and the one SHA for both, keep the script and the workflow from different commits.
- **Pin and secret:** a full commit SHA (floor rule 2), the same as the core pin, and only `PERSONAL_TERMS` passed.
- **Floor unchanged.** Rule 3 already protects `core/` and every check on the work, the copies check's config included;
  rule 11 still names `.github/workflows/personal-terms.yml`, which stays in each game as the caller.

## Questions for the owner

None beyond the yes this PR needs for its `.github/` changes (floor rule 3).
