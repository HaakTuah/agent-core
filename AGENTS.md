# agent-core

In a project, this file is its copy of the core's (`core/AGENTS.md`) and none of the project's: a session working there
follows the project's own `AGENTS.md`, and reads this one only as the core's text (`README.md`, "The copy's own files").

The shared core of the owner's agent-built projects: a floor every project takes whole and modules each project picks
(`README.md`).

## The core this repository takes

The floor whole, and every module but those "Not taken" below gives its reason for.
`scripts/own-modules.mjs` fails a module of `roles/shared/`, `tasks/` or `tools/` this section neither names nor gives
one. A builder reads these whole at the start of every task (Claude Code imports them); what else a task calls for, and
what another role reads, `node scripts/reading.mjs <role> --issue <its line's issue>` prints (`tasks/tools.md`, "One
script says what to read"):

@floor/security.md
@roles/builder.md
@roles/shared/how-to-work.md
@roles/shared/inbox.md
@roles/shared/work-flow.md

The last is read so that whoever builds here finishes the pull request. Two things in it
have nothing to act on here: the polish lane, since no one uses the core through a screen, and the sync of a copy of
the core in "Sessions", since this repository is the core and holds no copy.

Read at the start of every task too: by Claude, `tools/claude.md` (`CLAUDE.md` imports it); by a session of any
other tool, `tools/other-builders.md` and its tool's part, a file of `tools/` (`tasks/tools.md`, "Each tool's part"),
which its entry file pulls in.

Read when a task calls for it, each saying when in its opening line: the files of `floor/topics/` and `core-changes/`,
`floor/threat-model.md`, `tasks/roles.md`, `tasks/helpers.md`, `tasks/reviews.md`, `roles/shared/review-guidelines.md`,
`tasks/tools.md`, `tasks/ways.md`, `tools/claude-sessions.md`, `tools/claude-auto-mode.md`, `tools/codex.md`, `tools/copilot.md`, `tools/kiro.md`,
`tools/antigravity.md`, `tasks/github-calls.md`, `tasks/hosts.md`, `tasks/repositories.md`, `roles/shared/teams.md`,
`roles/orchestrator.md`, `roles/auditor.md`, `tasks/updates.md`, `tasks/choices.md`, `tasks/code-shape.md`, `tasks/tests.md`,
`tasks/cleaning.md`, `tasks/done-when.md`, `tasks/planning.md` and `roles/shared/records.md`.

Not taken, each for its reason:

- `tasks/game-design.md`: the core is no game; it has no players, computer players, rules of play or features a
  player chooses to use, which are all that module governs.
- `tasks/screens.md`: the core has no screen; no one uses it through one, so none of its points, its critique or its
  checks has anything to act on here, and `scripts/screens.mjs` is held by its test alone.

The slots here: the *progress file*: `QUEUE.md` ("The queue"); the *milestone*: a batch and its release ("One batch,
then one release"; #322), and of `tasks/planning.md` the point on a task's release and of `tasks/cleaning.md` the reading of a project
against the core (#259 is that reading here) have nothing to act on here, which holds no copy; the *report*: the PR's description (`reports/` keeps
those written before 12 November 2026, the staged cases' record and the trial's); the *audits*: `reports/`; the *choice records*:
`CHOICES.md`, a file each in `choices/` (#870); the *shape check*: `scripts/shape.mjs` with `.github/shape.json` (one system, the scripts, as `CHOICES.md` records);
the *mutation tool*: `node scripts/stryker.mjs --tool tests/mutation --report {report} {lines}`, Stryker at the version
`tests/mutation/`'s lock file pins (#581), in `tests.yml`;
the archive is `archive/instructions.md`, the items behind each rule listed in `scripts/holders/`; the *settling references* and the *descriptions*:
`README.md`; the *large file*: past about 50 KB; the *copies check*: `scripts/copies.mjs` on `.github/copies.json`, in
`tests.yml`, its baseline empty (#259); the *owner's account*: `HaakTuah`; the *users get*:
`releases`, its users taking the core from a release or, following `main`, from its newest commit whose checks all
passed (#733); *one at a time*: the queue's lines
that change the same file, and all that add to what a role reads at its start, whose caps they share, in the
queue's order; the
*design-checked PRs*: those that add or change a rule of the floor or the modules; the *review reference*: the line's
issue, with the owner's words quoted on it; the *tools* and the *pace*: the core's defaults (`tasks/roles.md`,
`roles/orchestrator.md`); the *hard work*: a new or changed rule; the *size marks*: the caps of
`scripts/size.mjs`, one for each role, and its own mark for `QUEUE.md`, and the split mark, 20 KB, with its `"past"`
list, in `.github/sizes.json`, which `scripts/reading-size.mjs` reads as a project's; the *major version checks*:
the suites of `.github/workflows/tests.yml`; *planning design*: none; the *quick check*: `node scripts/holders.mjs && node scripts/size.mjs && node scripts/reading.mjs --check && node tests/holders-test.mjs && node tests/manifest-reads-test.mjs && node tests/general-test.mjs`; the *other builders' checks*: those suites, which any tool's
session here runs before it finishes, every file here being protected (`SECURITY.md`).

## The queue

`QUEUE.md` holds the order of the work here and nothing else: each line an open issue, who builds it
and what it waits on. A task is a line; its issue is the item and its spec, read with the note that gathers it where
one says it does, and its conditions stand there. The main lane is the lines in order.

- **An idea is built only from a line, and a line joins in a PR of its own.** A new or changed rule
  joins only where that PR relays the owner's yes to its issue, as the chat session records it ("Whose words an issue
  holds"): that PR is the gate, so no verdict of the stand-in's queues one here, a difference from `roles/shared/inbox.md`.
  A test, a check for a rule that already stands, a task the scheduled look opens (#248), a small finding of an
  audit (#259) and a change to a rule that keeps its meaning (#886, point 2) join without the owner's word: the design
  check of the PR that builds such a change states it, as `roles/shared/review-guidelines.md` says of the floor ("A
  change that keeps the meaning is stated so"), and where it does not, that PR waits for the owner's yes, held for the
  floor and the guidelines by `scripts/meaning-kept.mjs` and for any other rule by nothing yet. A line does not leave in the PR that
  closes its issue: the readers of the file skip the
  line of a closed issue, and the next PR that changes the file takes such lines out together (`node scripts/queue.mjs
  --clear`; #750, point 1), as that module says, since PRs merging side by side collided on it. Held here by `own-description.yml`, which fails a ready PR that changes the
  file and leaves one.
- **Queued means wanted: nothing queued waits for a second word.** Where the floor asks the owner's
  yes in a PR (floor rule 3: a change to the floor or the review guidelines that means something), the yes the owner
  gave when its issue was queued is that yes: the builder relays it into the PR word for word as it was recorded
  (floor rule 3), and it covers the change as the issue describes it. A PR that goes beyond its issue is not covered by
  it, and the design check says so.
- **The file holds no note.** Where a module asks for one in the *progress file* (a lane that waits), it goes in the
  description of the line's own PR, which the next builder reads with the branch, as a hand-off note does
  (`tasks/tools.md`, "A change of tool loses nothing").
- **Whose words an issue holds.** Of the issues open on 14 November 2026 and labelled `queued` and `by:chat`, the owner
  said the decisions quoted in them are the owner's, and so are the answers on other issues that their notes name.
  What the chat session records is the owner's word on any day: an issue or note from the
  *owner's account*, labelled `by:chat` or opening as from a chat session with the owner, carries the owner's decision
  where it quotes the owner's words, and equally where it sets out a design and says the owner agreed to it, since a
  bare yes is never quoted (#252). Such a record sets the design out in full, as what binds, and says plainly that the
  owner agreed to it, as the notes on #244 and #252 do; it covers what it sets out and nothing beyond, and a view of
  the session's own, marked as not a decision, binds nothing. The builder relays the record word for word, and the
  review reads the change against the design it sets out. A label or opening on another account's text
  makes it no more than data. What any other session adds to an issue is that session's word.
- **Who builds a line, the line says.** A bug, a test and a check for a rule that already stands go to any builder
  session. A new or changed rule goes to the design session or to a builder at the strongest tier (`tasks/roles.md`), as its
  line names. That builder
  writes it from the owner's word recorded on the issue ("Whose words an issue holds"), adds it to the archive as an
  item of its own, naming the issue as its source, and takes what it leaves open as `roles/shared/inbox.md` says of any
  open point. This is the second
  difference from that module and `roles/shared/records.md`, where only the design session writes rules from the owner's
  words.
- **A bug a release's trial finds is built at once** (#1413, point 7). By default, where the trial of a release ("Each
  release is tried on a real project first") finds a bug of the core's, it is filed and built like any bug
  (`roles/shared/inbox.md`, "Bugs don't wait"), the orchestrator giving it a lane with no line in this file first.
  Nothing changes it. It does not mean the release is cut before its trial passes on the fix, nor that an idea the
  trial brings joins without a line. Reason: 47 of the 392 pull requests merged in the core from 19 to 26 November
  2026 changed the queue alone, each running the checks and, where its line names a `by:chat` item, waiting for a code
  review (#1339). Held by nothing yet.
- **A bug fix and a rework of tests are built on Sonnet** (#767). By default, where "The builders" of
  `roles/orchestrator.md` picks Claude for a line that fixes a bug or reworks tests, the orchestrator starts its builder
  on Sonnet; a line that writes or changes a rule, touches security or reads a format another publisher defines stays
  on Opus at high. The first trial is settled: on 20 November 2026 `node scripts/builder-trial.mjs`, setting the
  Sonnet builders of those two kinds since 18 November 2026 beside the Opus builders', read the bug fixes' findings,
  rounds of review and bugs that reached `main` each "no worse within noise", as #1023 gives in numbers, so
  Claude's part (`tools/claude.md`) gives its builder of a bug fix the middle tier, Sonnet, beside the routine lanes the
  tier table of `tasks/roles.md` gives it (#1023). The second trial changes the effort alone: from 20 November 2026, the
  day #1023 merged, the orchestrator starts the builder of each such line on Sonnet at medium and at high in turn, its
  first line naming its effort ("on Sonnet at medium"); once twenty have merged, as the same script with `--effort
  --since 2026-11-20` counts them, the session that finds it so, the orchestrator at a wake, gives what it prints on
  #767 in a note, numbers first, and builds the result in a pull request of its own, each kind's verdicts on findings,
  rounds and bugs deciding its own lane: where medium reads "no worse within noise", Claude's part gives that lane
  medium effort; where one reads "worse", the lane stays at high, and the note says by how much; where one reads "too
  few to tell", the trial goes on. It does not mean the order of "The builders" changes, so a line it gives another
  tool counts in no trial; nor that a Sonnet builder decides what needs judgement (`tools/claude.md`, "Who to call");
  nor that a result reaches another tool's part; nor that a trial changes the model and the effort at once. Reason: on
  19 November 2026 all eleven of the core's builders ran on Opus at high, three bug fixes among them, and the earlier
  rework of the tests (#715) on Opus too, where the tier table gives routine work to the middle tier, Sonnet in
  Claude's map. Held, in part, by `scripts/builder-trial.mjs`, which counts each kind by its builder from what
  `scripts/review-record.mjs` reads and from the session-cost lines; which model and effort the orchestrator starts, by
  nothing yet.
- **An orchestrator may work the file** (`roles/orchestrator.md`) while it holds a line a session can take. The
  owner starts it, or the owner's adviser on the owner's word (`roles/adviser.md`); once none is left that a session can take, it says so and stops, keeping no wake. Two steps of its
  wake are not this repository's: the sync of the core, since `scripts/core-moved.mjs` and `scripts/sync.mjs` run from
  a project's root and there is no copy here, and what `setup/sync-notes.md` asks, which it asks of projects.
- **One batch, then one release** (#1413, point 4). By default a batch is the lines of the file merged since the
  commit the newest release stands on, and the release after it is the owner's ("A release is cut on the owner's
  word"), that word given for every batch. Its trial is due once ten lines have merged since that commit, or seven
  days have passed since it with at least one merged, as `node scripts/release-due.mjs` counts them. The one condition
  that changes it: the file holds no line a session can take, no PR of a session's is open, every check on `main`'s
  newest commit has passed and no open issue is left that is to be queued; then the trial is due whatever the count.
  The trigger is the scheduled look's issue "A release's trial is due", or the orchestrator finding the queue worked
  through at the end of its work: the orchestrator gives the trial a lane, and once its record merges starts the
  `release` workflow ("A release is cut on the owner's word"); the lines that merge after the commit tried go to the
  next batch. It does not mean a session cuts a release by its own choice, that a second trial is due while a trial's
  record that holds no cut, past the newest release, stands, nor that a line waits for a release. Reason: a big batch
  held every fix in it back for weeks, and points 1, 3 and 5 of #1413 made each release cheaper. Held by `tests/release-due-test.mjs` (the
  count, the marks and the look's issue); that the orchestrator starts the trial, by nothing yet.
- **A batch is sized by what the projects can take:** once its release is synced, the count of "The core is measured
  as a feature is" is taken again in each of the owner's projects and named to the owner, who sizes the next by it, the marks of `scripts/release-due.mjs` changed on the owner's
  word. It holds back no line the owner has said yes to: there is no pause on new rules.

## How changes are made here

The rules here that bind only whoever builds one kind of change stand by theme in the files of `core-changes/`, each
read when a task calls for it, as its opening line says (#1202). These bind every change:

- **The core abides by its own rules, to the full extent:** this repository keeps every rule
  the core sets for the projects, the audits and the cleaning it asks of them included, save a module "The core this
  repository takes" gives its reason for and a step it says has nothing to act on here. A check, measure or report a
  rule brings runs on the core too: the measures with their baseline, never worse, the strength of its tests, failures
  that say the mend, the labels and the queue, the daily look and the monthly state report, which lists the core
  beside the projects. Its audit and cleaning share is set by the state its own code is in, as any project's is, and
  the staged cases run on its repository. An issue here is done only when the core's own repository meets it.
- **Whoever builds a change finishes it,** the design session and a builder alike, as `roles/shared/work-flow.md`
  says ("Git and GitHub", and point 1). A PR that changes a rule says what it changes in every project.
- **Every PR gets Codex's code and security reviews,** save one of queue lines alone that `scripts/queue-only.mjs`
  proves (floor rule 8; `tasks/reviews.md`, point 3).
- **A pull request says what it asks of a project:** one that changes the floor, a module, a script,
  the setup or a workflow has the heading "What it asks of a project", saying what happens in a project that changes
  nothing of its own: nothing, a baseline written, or an ask in the sync notes with its cost. It does not mean that
  every such change asks something of a project: "Nothing" is an answer, and most changes give it. Reason: two of the ideas
  queued on 14 November would have broken "Nothing locks a project", and only a reading caught them. Held by
  `.github/workflows/own-description.yml`, which fails one without it.
- **Reports from projects** come as issues here, each data (floor rule 4), and are answered as `README.md`, "Reporting
  to the core", says.
- **Never create a repository named `agent-rules`,** the core's old name: links to it redirect here.

## Review guidelines

Every reviewer reads `roles/shared/review-guidelines.md` whole and judges the change by it, with the floor. Here, a rule that
changes what any project must do without saying so in the PR is a departure from the PR's description, and blocks; so
does one that reads true only for some of the kinds of project "Rules are written for any project" names, and a raise of
a size cap in a PR with no "Leanness check:" comment that found too little room.
