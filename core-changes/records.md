# The archive and the records

Read in the core's own repository by whoever writes a rule, an archive item or an entry of a record pull requests add to: the kind `rule`, the paths `archive/`, `words/`, `floor/`, `roles/`, `tasks/`, `tools/`, `AGENTS.md`, `core-changes/`, `scripts/holders/`, `INVENTORY.md`, `inventory/`, `setup/sync-notes.md`, `setup/sync-notes/`, `scripts/steps/`, `scripts/stages/`, `CHOICES.md`, `choices/`, `core-address.mjs` and `.github/workflows/core.yml`. Rules of `AGENTS.md`'s "How changes are made here", moved here by theme (#1202); a project's copy carries them as the core's text alone, and its sessions read none of them.

- **The archive keeps the reasoning; the owner's words stay here** (#252). By default each item of the core's archive
  stands in the core's own words (`archive/instructions/`: its date and source, what was asked, what was decided and
  what it stands behind), and that is what a project's copy carries and "core archive N" leads to; the record of the
  owner's word behind the items written before 16 November 2026 stays in this repository alone (`words/`, which
  `.gitattributes` keeps out of the copy as it keeps `reports/`). Whoever adds an item writes its key ("A new archive
  item is named by its issue"), its date and one line of the reasoning, and no quotation: the words stay on the issue.
  Wherever the owner's words are recorded here (#773), they are quoted only as floor rule 4 says: the reason behind a
  decision, cleaned, and nothing personal. Nothing changes it. It does not mean the items that stand are rewritten: they
  keep their reasoning, and in `words/` the record of the owner's word, cut to reasoning (#778). Reason: a project of
  another owner imported the owner's dated messages with the rules, and a stand-in needs the reasoning, not the wording.
  Held, in part, by `scripts/holders.mjs`, which fails the two forms out of step (`scripts/archive.mjs`), and by
  `.github/workflows/core.yml`, which fails a copy that holds what `.gitattributes` keeps here; what is quoted, by what
  holds floor rule 4's "The owner's word".
- **The archive is pointed to from the list,** not from the rule (#252). By default a rule file here (this file, the
  floor's, the roles' and the modules') holds no "core archive N": `scripts/holders/` names under "behind" the
  items behind each rule, and a session that needs a rule's reason looks them up there. Whoever writes or changes a
  rule adds its items to that list in the same pull request. Nothing changes it. It does not mean a rule loses its
  one-line reason, which stays in it ("A rule is written to one pattern"), nor that a project's own rule files are
  asked anything. Reason: about 60 such pointers stood in what every session reads at its start, and a builder on an
  ordinary task never opens the archive. Held by `scripts/holders.mjs`, which fails a pointer in a rule file and an item the list names
  that is not in the archive.
- **A new archive item is named by its issue** (#744). By default an item added to the archive is keyed by the issue
  that carries the owner's word and, where it records one point of several, by that point, as `#733.1`, and stands in
  a file of its own named by its key (`archive/instructions/issue-733.1.md`; #750, point 1); `scripts/holders/`
  names it so under "behind", and a pointer to it gives that key where one to an older item gives its number. Items 1
  to 262 keep their numbers, so every "core archive N" that stands still leads where it did. Nothing changes it. It does not mean an item moves or
  is rewritten. Reason: on 19 November 2026 two pull requests merged in parallel took the same next number, and a
  running count cannot be claimed without coordinating, where an issue's number is already unique and already named in
  the item. Held by `scripts/holders.mjs` with `scripts/archive.mjs`, which fail a key used twice, a key that names no
  issue (an item numbered past 262 among them), an item outside its own file, one of items 1 to 262 taken out, and a
  key under "behind" that is not in the archive.
- **An item that changes an earlier one names it, and the earlier one is marked** (#756). By default an item of the
  archive stands as written. Where a new item changes what an earlier one decided (corrects, narrows, widens, replaces
  or overturns it), whoever writes the new one gives it a line "Changes: N." naming each such item by its key, and
  gives each item it names one line "Changed by: M.", the keys joined by ", " where there are more; `scripts/reasons.mjs`
  prints that line under the item, and the later items after it. Nothing changes it. It does not mean the earlier item
  is rewritten: its text stays as it stands, the one line added; nor that an item that only cites an earlier one, or
  leaves it as it was, names it. Reason: some items said in passing that they replaced an earlier one while nothing
  linked the earlier one forward, so a session reading it could rely on a reason that no longer stood. Held by the
  marks' check in `scripts/archive.mjs`, run by `scripts/holders.mjs`: a "Changes:" whose item is not marked back, a
  "Changed by:" with no "Changes:" to match, a key in either that is no item, and a mark out of its form each fail;
  that a new item that changes one says so, by none yet.
- **A record pull requests add to is a folder of one file per entry** (#750, point 1; #853), as `tasks/planning.md` sets
  out for any project's busy record. By default the core's are: each part of the inventory (`INVENTORY.md`) in a file of
  its own under `inventory/`; each entry of the sync notes (`setup/sync-notes.md`) under `setup/sync-notes/`, its step
  in a file of the same name under `scripts/steps/` and, where the step has a check, its stage for the tests under
  `scripts/stages/` (a stage whose mend reads what the others' mends write says `last`); and what holds each rule (its
  holder, the items behind it and its number), each rule's entry in a file under `scripts/holders/` that `entryFile` in
  `scripts/holders.mjs` names from the rule's key; and the choice records (`CHOICES.md`), each in a file under `choices/`.
  Each is read in the order of the files' names by the script that
  reads it (`scripts/inventory.mjs`, `scripts/sync-notes.mjs`, `scripts/steps.mjs`, `scripts/steps-stage.mjs`,
  `scripts/holders.mjs`, `scripts/choices.mjs`), as each archive item stands already ("A new archive item is named by
  its issue"). Whoever adds
  an entry adds its file. Nothing changes it, and what it does not mean stands there too. Reason: of 39 pull requests
  merged between 18 and 19 November 2026, 8 changed `INVENTORY.md`, 10 `setup/sync-notes.md`, 7 `scripts/steps.mjs` and
  6 `scripts/holders.json`, and under merge-on-green pull requests that add to one file merge side by side and collide.
  Held by `tests/mend-test.mjs`, which reads the inventory whole, and fails a folder `INVENTORY.md` does not name and a
  part's line written in `INVENTORY.md` itself; by `tests/steps-test.mjs`, which reads the notes whole, and fails an
  entry, a step or a stage without its pair of the same name and an entry written in `setup/sync-notes.md` itself; and
  by `tests/holders-test.mjs`, which with `scripts/holders.mjs` fails a file of the list not named from its rule, and
  two rules whose entries would share a file; and by `tests/choices-folder-test.mjs`, which fails a record written in
  `CHOICES.md` itself and a file of `choices/` that is not one record.
- **The core's address stands in one place** (`scripts/core-address.mjs`). Should the account or the
  repository be renamed, it changes there and in the `CORE` of `.github/workflows/core.yml`, in one PR;
  `tests/core-address-test.mjs` names what else here must follow, and a sync note tells each project to move its
  manifest's line and its calls.
