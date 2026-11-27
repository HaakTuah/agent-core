# What holds a rule

Read in the core's own repository by whoever writes or changes a rule or what holds one, or takes a state report or a pruning: the kind `rule`, the paths `floor/`, `roles/`, `tasks/`, `tools/`, `AGENTS.md`, `core-changes/`, `scripts/holders/`, `holders.mjs`, `scripts/staged/`, `staged.mjs` and `pruning.mjs`. Rules of `AGENTS.md`'s "How changes are made here", moved here by theme (#1202); a project's copy carries them as the core's text alone, and its sessions read none of them.

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
  carries it as numbers alone, and the core's own report gives the same of the core's own rules, those of this file,
  beside the floor's and the modules'. Nothing changes it. It does not mean the share is a target, nor that a check the
  core's list names (a ruleset of the host's) is read as set up in the project. Reason: the owner sees how much of what
  binds a project a check holds there, which a count of the core alone hides. Held by `tests/look-test.mjs` and
  `tests/holders-test.mjs`, the core's own count included (#925).
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
  scripts/pruning.mjs` prints, the record in a pull request of its own: the rules of the floor, the modules and this
  file whose number did not move since the last pruning, whose check no failed step of a pull request's run shows
  firing, whose case passed without them, or whose number, a stand-in, moved at two prunings while its outcome's direct
  measures did not. A rule fewer than twenty merged pull requests have come under since it joined is "too early" and not
  judged, and one that guards against rare and severe harm, the floor's and any whose number says so, is judged by its
  staged case alone, never listed for a check that did not fire. Ahead of all these, the list leads with the rules
  `scripts/holders.mjs` counts as having no holder, worst first, a rule read at a role's or a tool's start before one
  read on need, each with its proposal in `reports/unheld.json` (#545): a check or staged case that could hold it, filed
  as a task; a move to a module read on need; that it goes; or, where it binds no one, that it describes. The session
  gives one to each that has none, a check only where it never guesses and its upkeep pays, a maintained tool where one
  reads the breach (#534) and a maintained linter's rule that can be switched on before a check written by hand, takes
  out those whose rule gained a holder, and files each check as an issue, which joins the queue as any check for a rule
  that stands does, worst first; a rule that guards against rare and severe harm is proposed a holder, never to go.
  Nothing changes it. The owner decides which move or go, a few at a time, the numbers read again before more go; the
  list gives each rule its step: a rule read at a role's start is at step 1, to move to a module read on need, and one
  read on need at step 2, to go where nothing changed after its move, kept in the archive with its reason and its last
  number, and free to return. It does not mean that a session removes or moves a rule by its own choice, that a listed
  rule goes, or that a new rule waits for a holder. Reason: the core tested that a rule holds and never whether it is
  still needed, and an unneeded one costs every session that reads it; on 17 November 2026, 189 of its 310 rules were
  held by being read alone. Held by `scripts/pruning.mjs`, which makes the list, its test reading that the rules with no
  holder lead it, and by the state report, which says when a pruning is due.
