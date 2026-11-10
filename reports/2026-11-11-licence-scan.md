# One licence scan

Tonight's audit of both games against the core (the owner's words: `reports/2026-11-11-shared-checks.md`) found the
licence check whole in only one of them. Snakes' own scan (`tools/licences.js`) fails a PR that uses anything its audit
does not name: an action, a package fetched by npx or npm install, a font, image or sound, code copied in with someone's
notice. Amarna has no such scan: the core's check holds only its lockfile, so its workflows' seven actions, its 127
sounds rendered from two sample libraries, its icons and its map pictures are held to no list, and its notices credit
them by hand. Floor rule 10 asks the same of both (core archive 41: every package used free to use, and every update
too).

- **`scripts/licence-scan.mjs`:** the general half of Snakes' scan, run by `licences.mjs` when a config has `"scan"`.
  It reads the tracked files (but the copy of the core, and what `skip` names) and needs an audit entry for every
  action but the owner's own and the project's; every package npx, npm exec or npm install fetches, at the exact version
  audited (npx `--no-install` never fetches, so a bare name passes there); every code file carrying a licence notice;
  and every font, image, sound, video or data file. What lies under `served` but not `tools` reaches users, so an entry
  covering it ships. An entry covers files by its name or its `files` (paths, or folders ending in `/`), and a `files`
  path that names no tracked file fails, so no entry outlives what it covered.
- **`scripts/licences.mjs`:** reads and checks `"scan"` (only its three keys, paths inside the project, an audit
  beside it). Adds the kind `own` with `LicenseRef-Owner`, for the owner's own work, all rights reserved as floor rule
  10 ends, and only for it. The summary counts the files scanned. **`scripts/licences.d.mts`:** the new key.
- **`scripts/licences-test.mjs`:** the check had no test here; Amarna tested its lists and readers in its own suite.
  Those tests come here, on invented names: how a licence expression is read, which list allows what, a package known
  by its registry address, npm's settings. Then it stages a small project in a temporary git repository and checks
  that it passes as it is, passes six allowed forms, and fails 39 others: the licence lists, the owner's kind, actions,
  every form of fetch, copied code, assets, an entry covering nothing, and a bad `"scan"`.
- **The core's own audit:** `.github/licences.json` and `.github/licences-audit.json` hold what the core's workflows and
  scripts use (four actions, CodeQL, the GitHub CLI, Node and npm). A project's scan leaves its copy of the core out,
  since this audit holds it, so the games stop listing the core's actions.
- **`.github/workflows/tests.yml`:** runs the test and the core's own audit. **`.github/workflows/licences.yml`:** its
  header names the scan. Both are changes to what runs by itself, so they get Codex's and the fallback reviewer's
  security reviews (floor rule 3). Neither gains a permission or an input.
- **`README.md`,** point 5: the licence check's audit, held whole by the scan.

Tested: the test passes (53 checks), and the core's own audit passes over its 91 files. A dry run on each game with
the new scripts: Snakes passes, with only its own scan and that scan's test flagged, since they name the forms they
look for; both go in its sync PR. Amarna fails on 149 items, all real: seven actions, its sounds, icons and map
pictures, and two `npx vitest` lines that would fetch if nothing were installed.

What changes in every project: nothing until its config adds `"scan"`. Its sync PR then adds it, with an audit entry
for each thing the scan finds. Snakes drops the half of its own scan that moved here, keeps its game's own checks (the
addresses the game loads, its notices, `sw.js`), and drops its audit's entries for the core's actions and for lockfile
packages the check already reads. Amarna gains an audit, its notices are written from that audit's entries, and its
suite drops the tests of the core's functions that moved here.

Readings taken: lockfile packages need no audit entry, since the check reads each one's licence from the lockfile at
every version; Snakes' hand list of them repeated it. The owner's own work gets a kind of its own rather than a list of
folders the scan passes over, so every asset's origin stands in one place. Questions for the owner: none.
