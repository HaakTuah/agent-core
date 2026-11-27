# What holds a rule, and the records

Read in the core by whoever writes or changes a rule, what holds one, an archive item or a record's entry, or takes a
state report or a pruning: the kinds `rule` and `audit`, the paths `floor/`, `roles/`, `tasks/`, `tools/`, `AGENTS.md`,
`core-changes/`, `scripts/holders/`, `holders.mjs`, `scripts/staged/`, `staged.mjs`, `pruning.*`, `unheld.json`,
`archive/`, `words/`, `INVENTORY.md`, `inventory/`, `sync-notes.md`, `setup/sync-notes/`, `scripts/steps/`,
`scripts/stages/`, `CHOICES.md`, `choices/`, `core-address.mjs` and `core.yml`.

- **Every rule says what holds it.** By default a rule of the floor or the modules is held by
  a check that fails where it is broken (a script, a workflow, a hook, or GitHub's setting that refuses it); where no
  check can read its breach exactly, by a staged case, the holder of last resort, or by the scheduled audit; and where
  none holds it yet, it is listed. Whoever writes or changes a rule names its holder in that PR: in
  `scripts/holders/`, a file by the rule's file and bold lead, or in a staged case's own file; and under the PR's heading
  "What holds it" (`.github/workflows/own-description.yml` fails one without it), for each rule it adds or widens, what
  went wrong or would without it (an incident, a review's finding, the owner's reason), its holder, or that it has
  none yet, and its number (#303): a line "Number:" with the count the rule is meant to lower (`findings`, the review
  findings that name it; `check fires`; or `correction: <kind>`, #302) and the one of the five outcomes it stands for
  (`; outcome: asked`, `fast`, `readable`, `usable` or `robust`), then `; rare harm` where it guards against rare and
  severe harm, as `scripts/holders/` keeps it under "number";
  "None" where it adds no rule. The rules that stood before are held the same way: `scripts/holders.mjs` lists each
  rule with no holder in the core's monthly state report, until it gains one or goes on the owner's word, and a
  review's finding seen twice moves its rule up (`tasks/reviews.md`, point 8). A line that only points elsewhere or
  says what is protected, binding no one, is marked "describes" there and is not listed. It does not mean that a rule
  with no holder fails anything or goes by itself, that a review is a holder, or that a count of a rule's citations is
  its number: a citation says a rule is applied, never that it helps. Reason: the audit of 13 November found 43 of 122
  rules held by nothing but a session reading them, and nothing listed them. Held by
  `scripts/holders.mjs`, in `.github/workflows/tests.yml`, which fails where an entry names a rule that no longer
  stands, a check that is not there, a number in no form or `check fires` where none of the rule's holders is a check
  (#1138), and by the heading's check, which asks the line "Number:" where the heading holds more than "None" and, here,
  one of its own for each entry whose number the pull request adds or changes, each line a number an entry holds.
- **A project's own rules name what holds them** (#662). By default the rules a project writes for itself, in the
  rule files its sessions read as its own files name them, are read as the core's are: `scripts/holders.mjs --own`,
  run from the project, reads them against its list `checks/holders.json`, which the starter kit writes and a sync's
  step asks for (`setup/sync-notes.md`, which gives the files and the list's forms). Each month the session that takes
  the project's state report files, for each rule it lists with no holder, those read at a session's start first, a
  task at the project's pace: a check where one can read the breach exactly, the rule moved to where it is read on
  need, or a proposal that it goes, which is the owner's to decide. Of every rule of the project's own, held or not,
  it answers, as an auditor reads (`roles/auditor.md`), whether it is about this project, its kind or every project, in the list's "about" (`this project`, `its
  kind: <the kind>` or `every project`), and files each about a kind or every project to the core as an idea where
  none is filed yet, naming the kind, written for the kind and holding nothing of the project (`README.md`,
  "Reporting to the core"; #484, point 9). The staged cases and the pruning stay the core's,
  for the whole sessions each costs a month. Nothing changes it. It does not mean that a rule with no holder, or a wrong
  line of the list, fails anything, is removed or stops binding, that a session rewords a project's rule on its own
  reading, nor that a review, or how often a rule is cited, holds one. Reason: a rule file read at every session's
  start with nothing that enforces it is the case the study behind #545 measured, no gain in the work and more cost.
  Held by `tests/holders-test.mjs`, on a scratch project with one rule held and one not, by `tests/look-test.mjs`, for
  the report's list, and by the step `scripts/steps.mjs` reads for the first list; the answers, by the report's lists
  of the rules not yet answered and of those to file, in part.
- **The share a check holds is reported** (#459, point 3). By default a project's monthly state report counts its own
  rules by what holds them. The session that takes it gives, on its line "rules held by a check", how many of the
  project's own rules a check holds whole and how many of the core's it takes, as the core's list maps them, counting
  none whose every check read nothing there ("A check that read nothing says so"); the core's report of the projects
  carries it as numbers alone, and the core's own report gives the same of the core's own rules, those of `AGENTS.md`
  and `core-changes/`, beside the floor's and the modules'. Nothing changes it. It does not mean the share is a target,
  nor that a check the core's list names (a ruleset of the host's) is read as set up in the project. Reason: the owner
  sees how much of what binds a project a check holds there, which a count of the core alone hides. Held by
  `tests/look-test.mjs` and `tests/holders-test.mjs`, the core's own count included (#925).
- **Staged cases hold what no check reads** (#235). By default a rule is held by a check; where none
  can read its breach exactly, since the breach lies in what a session does, a staged case holds it: a scratch project
  (`scripts/staged/`) in which a fresh session is given a task where the rule is easy to break, passed or failed by
  the case's script on what the session did, read from the project (its commits, its pushes, what it wrote to GitHub),
  never on what it says of itself. A case is due on the first scheduled look of each month, and once the words of a
  rule it holds change (`node scripts/staged.mjs`), save the reviewers' case `review`, due monthly alone
  (`tasks/reviews.md`, point 9); the look then keeps the issue "Staged cases to run". The session
  that takes it runs each due case in a fresh helper at the builder's model and high effort, records the verdicts in
  `reports/staged-cases.json` in a pull request of its own, and says there of each failure whether the rule, the case
  or the session was wrong. The cases advise until three months in a row have run every one with no verdict found
  wrong; from then `scripts/release.mjs` cuts no release while a case's last verdict fails. They are run under each
  agent tool the core is used with, again at each release, and a tool works with the core once it passes them
  (`tasks/tools.md`; #249). It does not mean that a
  case runs on a pull request or in a project, nor that one stands where a check could read the breach. Reason: no
  check sees how a session behaves, and the core's two staged runs, each of which changed it, were never run again
  when the rules or the models changed. Held by `tests/staged-test.mjs` (each case read as set, kept and broken;
  what is due; when the cases hold a release), in `.github/workflows/tests.yml`, and by the look's issue.
- **Rules are pruned by their numbers** (#303). By default with every second monthly state report, and in a month whose
  report a session of a newer generation of model takes than the last pruning's (`node scripts/pruning.mjs --due --model
  <its id>`), the session that takes the report runs each staged case with the rules it holds taken out
  (`scripts/pruning.mjs --set`, then `--read`), records the counts (`--record`) and adds as a note the list `node
  scripts/pruning.mjs` prints, the record in a pull request of its own: the rules of the floor, the modules, `AGENTS.md`
  and `core-changes/` whose number did not move since the last pruning, whose check no failed step of a pull request's
  run shows firing, whose case passed without them, or whose number, a stand-in, moved at two prunings while its
  outcome's direct measures did not. A rule fewer than twenty merged pull requests have come under since it joined is
  "too early" and not judged, and one that guards against rare and severe harm, the floor's and any whose number says
  so, is judged by its staged case alone, never listed for a check that did not fire. Ahead of all these, the list leads
  with the rules `scripts/holders.mjs` counts as having no holder, worst first, a rule read at a role's or a tool's
  start before one read on need, each with its proposal in `reports/unheld.json` (#545): a check or staged case that
  could hold it, filed as a task; a move to a module read on need; that it goes; or, where it binds no one, that it
  describes. The session gives one to each that has none, a check only where it never guesses and its upkeep pays, a
  maintained tool where one reads the breach (#534) and a maintained linter's rule that can be switched on before a
  check written by hand, takes out those whose rule gained a holder, and files each check as an issue, which joins the
  queue as any check for a rule that stands does, worst first; a rule that guards against rare and severe harm is
  proposed a holder, never to go. Nothing changes it. The owner decides which move or go, a few at a time, the numbers
  read again before more go; the list gives each rule its step: a rule read at a role's start is at step 1, to move to a
  module read on need, and one read on need at step 2, to go where nothing changed after its move, kept in the archive
  with its reason and its last number, and free to return. It does not mean that a session removes or moves a rule by
  its own choice, that a listed rule goes, or that a new rule waits for a holder. Reason: the core tested that a rule
  holds and never whether it is still needed, and an unneeded one costs every session that reads it; on 17 November
  2026, 189 of its 310 rules were held by being read alone. Held by `scripts/pruning.mjs`, which makes the list, its
  test reading that the rules with no holder lead it, and by the state report, which says when a pruning is due.
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
- **The archive is pointed to from the list,** not from the rule (#252). By default a rule file here (`AGENTS.md`,
  `core-changes/`, the floor's, the roles' and the modules') holds no "core archive N": `scripts/holders/` names under
  "behind" the items behind each rule, and a session that needs a rule's reason looks them up there. Whoever writes or
  changes a rule adds its items to that list in the same pull request. Nothing changes it. It does not mean a rule loses
  its one-line reason, which stays in it ("A rule is written to one pattern"), nor that a project's own rule files are
  asked anything. Reason: about 60 such pointers stood in what every session reads at its start, and a builder on an
  ordinary task never opens the archive. Held by `scripts/holders.mjs`, which fails a pointer in a rule file and an item
  the list names that is not in the archive.
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
