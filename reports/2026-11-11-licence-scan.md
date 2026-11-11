# One licence scan

Tonight's audit of both games against the core (the owner's words: `reports/2026-11-11-shared-checks.md`) found the
licence check whole in only one of them. Snakes' own scan (`tools/licences.js`) fails a PR that uses anything its audit
does not name: an action, a package fetched by npx or npm install, a font, image or sound, code copied in with someone's
notice. Amarna has no such scan: the core's check holds only its lockfile, so its workflows' seven actions, its 127
sounds rendered from two sample libraries, its icons and its map pictures are held to no list, and its notices credit
them by hand. Floor rule 10 asks the same of both (core archive 41: every package used free to use, and every update
too).

- **`scripts/licence-scan.mjs`:** Snakes' scan made general and wider, run by `licences.mjs` when a config has
  `"scan"`. It reads every tracked file (but what `skip` names and, in a project, its copy of the core) and needs:
  - every lockfile, and every `package.json` with dependencies, to be one the config's `lockfiles` checks;
  - an entry for every action but the owner's own and the project's;
  - an entry for every package npx, npm exec, npm install (by any spelling, after any option) or npm pack fetches, at
    the exact version audited. This covers workflows, scripts and tools of any kind (TypeScript components, Dockerfiles,
    files that start with `#!`), a JSON file's commands (package.json's `scripts`, a hook's `command`) and commands
    written as arrays. npx `--no-install` never fetches, so a bare name passes there. Any other fetch that cannot be
    read fails, but npm pack's and another fetcher's (curl, wget, pip, playwright install and the like). Each of
    those passes only in a file an entry's `files` names, as its hand audit;
  - an entry covering every script in a language it cannot read (Python and the like): the entries of what it uses;
  - an entry covering every code file with a licence notice, and every font, image, sound, video, model, data or other
    binary file.

  What lies under `served` but not `tools` reaches users, so an entry covering it ships. A `files` path or a `"scan"`
  path that names no tracked file fails, so nothing is misspelt or outlives what it covered.
- **`scripts/licences.mjs`:** reads and checks `"scan"`: only its three keys, `served` always said (`[]` if nothing
  reaches users), each path written as git lists it, and an audit beside it. It adds the kind `own` with
  `LicenseRef-Owner` for the owner's own work, all rights reserved as floor rule 10 ends, and only for it. Such an
  entry names its files one by one, and never stands in for an action, a package or a file carrying someone's
  notice. The summary counts the files scanned. **`scripts/licences.d.mts`:** the new key.
- **`scripts/licences-test.mjs`** and **`scripts/licence-scan-test.mjs`:** the check had no test here; Amarna tested
  its lists and readers in its own suite. Those tests come into the first, on invented names: how a licence expression
  is read, which list allows what, a package known by its registry address, npm's settings. The second stages a small
  project in a temporary git repository for each case. The project passes as it is, passes 18 allowed forms, and fails
  88 others, each for the reason it names: the licence lists, a lockfile's package, the owner's kind, actions, every
  form of fetch, copied code, assets and binaries, lockfiles left unchecked, an entry covering nothing, and a bad
  `"scan"`.
- **The core's own audit:** `.github/licences.json` and `.github/licences-audit.json` hold what the core's workflows and
  scripts use: four actions, CodeQL, the GitHub CLI, Node (which `scripts/node.sh` fetches) and npm. A project's scan
  leaves its copy of the core out, since this audit holds it, so the games stop listing the core's actions.
- **`.github/workflows/tests.yml`:** runs the test and the core's own audit. **`.github/workflows/licences.yml`:** its
  header names the scan. Both are changes to what runs by itself, so they get Codex's and the fallback reviewer's
  security reviews (floor rule 3). Neither gains a permission or an input.
- **`README.md`,** point 5: the licence check's audit, held whole by the scan.

Tested: the tests pass (8 and 107 checks), and so does the core's own audit of its 95 files. Codex's review and the
fallback reviewer's found ways round the first two versions: `package.json` scripts, hooks, tasks and launches, other
spellings and fetchers, an option's unknown value hiding the command, comments that hid commands, folded YAML, unread
file kinds, lockfiles left out, `own` covering too much. Each is now closed and tested. A dry run on each game with
the new scripts:
- Snakes passes, but for its own scan and that scan's test, which name the forms they look for; both go in its sync
  PR.
- Amarna passes with the audit its sync PR adds, but for two `npx vitest` lines, which would fetch if nothing were
  installed and become `npx --no-install vitest` there.

What changes in every project: nothing until its config adds `"scan"`. Its sync PR then adds it, with an audit entry
for each thing the scan finds. Snakes drops the half of its own scan that moved here, keeps its game's own checks (the
addresses the game loads, its notices, `sw.js`), and drops its audit's entries for the core's actions and for lockfile
packages the check already reads. Amarna gains an audit, its notices are written from that audit's entries, and its
suite drops the tests of the core's functions that moved here.

Readings taken: a hand audit (an entry's `files` naming a file, for npm pack's or another fetcher's fetches the scan
cannot read) covers the whole file, so a later fetch added to that file passes the scan; the review of that PR is what
sees it, as for any edit to an audit. Lockfile packages need no audit entry, since the check reads each one's licence
from the lockfile at every version; Snakes' hand list of them repeated it. The owner's own work gets a kind of its own
rather than a list of folders the scan passes over, so every asset's origin stands in one place. Questions for the
owner: none.
