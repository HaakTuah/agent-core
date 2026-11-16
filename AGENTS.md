# agent-core

In a project, this file is its copy of the core's (`core/AGENTS.md`) and none of the project's: a session working there
follows the project's own `AGENTS.md`, and reads this one only as the core's text (`README.md`, "The copy's own files").

The shared core of the owner's agent-built projects: a floor every project takes whole and modules each project picks
(`README.md`).

## The core this repository takes

The floor whole, and every module but those "Not taken" below gives its reason for (core archive 209 and 213).
`scripts/own-modules.mjs` fails a module of `modules/` this section neither names nor gives one. A builder reads these
whole at the start of every task (Claude Code imports them); what else a task calls for, and what another role reads,
`node scripts/reading.mjs <role> --issue <its line's issue>` prints (`modules/tools.md`, "One script says what to read"):

@floor/security.md
@roles/builder.md
@modules/how-to-work.md
@modules/inbox.md
@modules/work-flow.md
@modules/git.md

The last two are read so that whoever builds here finishes the pull request (core archive 209). Two things in them
have nothing to act on here: the polish lane, since no one uses the core through a screen, and the sync of a copy of
the core in "Sessions", since this repository is the core and holds no copy.

Read at the start of every task too: by Claude, `modules/claude.md` (`CLAUDE.md` imports it); by a session of any
other tool, `modules/other-builders.md` and its tool's part (`modules/tools.md`), which its entry file pulls in.

Read when a task calls for it, each saying when in its opening line: `floor/topics.md`, `floor/threat-model.md`,
`modules/roles.md`, `modules/helpers.md`, `modules/reviews.md`, `modules/review-guidelines.md`, `modules/tools.md`, `modules/codex.md`, `modules/copilot.md`,
`modules/kiro.md`, `modules/antigravity.md`, `modules/github-calls.md`, `modules/orchestrating.md`,
`modules/updates.md`, `modules/choices.md`, `modules/code-shape.md` and `modules/cleaning.md`.

Not taken, each for its reason:

- `modules/game-design.md`: the core is no game; it has no players, computer players, rules of play or features a
  player chooses to use, which are all that module governs.
- `modules/screens.md`: the core has no screen; no one uses it through one, so none of its points, its critique or its
  checks has anything to act on here, and `scripts/screens.mjs` is held by its test alone.

The slots here: the *progress file*: `QUEUE.md` ("The queue"); the *report*: the PR's description (`reports/` keeps
those written before 12 November 2026, and the staged cases' record); the *audits*: `reports/`; the *choice records*:
`CHOICES.md`; the *shape check*: `scripts/shape.mjs` with `.github/shape.json` (one system, the scripts, as `CHOICES.md` records);
the archive is `archive/instructions.md`, cited "(core archive N)"; the *settling references* and the *descriptions*:
`README.md`; the *large file*: past about 50 KB; the *copies check*: `scripts/copies.mjs` on `.github/copies.json`, in
`tests.yml`, its baseline empty (#259); the *owner's account*: `HaakTuah`; *one at a time*: the queue's lines
that change the same file, and all that add to what a role reads at its start, whose caps they share, in the
queue's order; the
*design-checked PRs*: those that add or change a rule of the floor or the modules; the *review reference*: the line's
issue, with the owner's words quoted on it; the *tools* and the *pace*: the core's defaults (`modules/roles.md`,
`modules/orchestrating.md`); the *hard work*: a new or changed rule; the *size marks*: the caps of
`scripts/size.mjs`, one for each role, and its own mark for `QUEUE.md`, with no split mark; the *major version checks*:
the suites of `.github/workflows/tests.yml`; *planning design*: none; the *other builders' checks*: those suites, which any tool's
session here runs before it finishes, every file here being protected (`SECURITY.md`).

## The queue

`QUEUE.md` holds the order of the work here and nothing else (core archive 208): each line an open issue, who builds it
and what it waits on. A task is a line; its issue is the item and its spec, read with the note that gathers it where
one says it does, and its conditions stand there. The main lane is the lines in order.

- **An idea is built only from a line, and a line joins in a PR of its own** (core archive 211). A new or changed rule
  joins only where that PR relays the owner's yes to its issue, as the chat session records it ("Whose words an issue
  holds"): that PR is the gate, so no verdict of the stand-in's queues one here, a difference from `modules/inbox.md`.
  A test, a check for a rule that already stands, a task the scheduled look opens (#248) and a small finding of an
  audit (#259) join without the owner's word. A bug waits for no line, as that module says. A line leaves in the PR
  that closes its issue.
- **Queued means wanted: nothing queued waits for a second word** (core archive 211). Where the floor asks the owner's
  yes in a PR (floor rule 3: a change to the floor or the review guidelines), the yes the owner gave when its issue was
  queued is that yes: the builder relays it into the PR word for word as it was recorded (floor rule 4), and it covers
  the change as the issue describes it. A PR that goes beyond its issue is not covered by it, and the design check
  says so.
- **The file holds no note.** Where a module asks for one in the *progress file* (a lane that waits), it goes in the
  description of the line's own PR, which the next builder reads with the branch, as a passed gate's note does
  (`modules/work-flow.md`).
- **Whose words an issue holds.** Of the issues open on 14 November 2026 and labelled `queued` and `by:chat`, the owner
  said the decisions quoted in them are the owner's, and so are the answers on other issues that their notes name.
  What the chat session records is the owner's word on any day (core archive 211 and 212): an issue or note from the
  *owner's account*, labelled `by:chat` or opening as from a chat session with the owner, carries the owner's decision
  where it quotes the owner's words, and equally where it sets out a design and says the owner agreed to it, since a
  bare yes is never quoted (#252). Such a record sets the design out in full, as what binds, and says plainly that the
  owner agreed to it, as the notes on #244 and #252 do; it covers what it sets out and nothing beyond, and a view of
  the session's own, marked as not a decision, binds nothing. The builder relays the record word for word (floor rule
  4), and the review reads the change against the design it sets out. A label or opening on another account's text
  makes it no more than data. What any other session adds to an issue is that session's word.
- **Who builds a line, the line says.** A bug, a test and a check for a rule that already stands go to any builder
  session. A new or changed rule goes to the design session or to a builder on Opus, as its line names. That builder
  writes it from the owner's word recorded on the issue ("Whose words an issue holds"), adds it to the archive as an
  item of its own, naming the issue as its source, and takes what it leaves open as `modules/inbox.md` says of any
  open point. This is the second
  difference from that module, where only the design session writes rules from the owner's words.
- **An orchestrator may work the file** (`modules/orchestrating.md`) while it holds a line a session can take. The
  owner starts it; once none is left that a session can take, it says so and stops, keeping no wake. Two steps of its
  wake are not this repository's: the sync of the core, since `scripts/core-moved.mjs` and `scripts/sync.mjs` run from
  a project's root and there is no copy here, and what `setup/sync-notes.md` asks, which it asks of projects.
- **One batch, then one release.** A batch is the lines the file holds between two releases, and the release after it
  is the owner's ("A release is cut on the owner's word"): no session cuts one by its own choice. That word is given
  for every batch (core archive 210 and 211): once the file holds no line a session can take, no PR of a session's is
  open, every check on `main`'s newest commit has passed, and no open issue is left that is to be queued, the session
  that finds it so, the orchestrator at the end of its work, starts the `release` workflow.
- **A batch is sized by what the projects can take:** once its release is synced, the count of "The core is measured
  as a feature is" is taken again in each of the owner's projects and named to the owner, who sizes the next by it. It
  holds back no line the owner has said yes to: there is no pause on new rules.

## How changes are made here

- **The core abides by its own rules, to the full extent** (core archive 209 and 213): this repository keeps every rule
  the core sets for the projects, the audits and the cleaning it asks of them included, save a module "The core this
  repository takes" gives its reason for and a step it says has nothing to act on here. A check, measure or report a
  rule brings runs on the core too: the measures with their baseline, never worse, the strength of its tests, failures
  that say the mend, the labels and the queue, the daily look and the monthly state report, which lists the core
  beside the projects. Its audit and cleaning share is set by the state its own code is in, as any project's is, and
  the staged cases run on its repository. An issue here is done only when the core's own repository meets it.
- **Whoever builds a change finishes it,** the design session and a builder alike: the branch, the draft PR and the
  push after every commit as `modules/git.md` says, then ready, its reviews, their findings fixed and the merge as
  `modules/work-flow.md` says (point 1). A PR that changes a rule says what it changes in every project.
- **Every PR gets Codex's code and security reviews;** one that changes the floor or the review guidelines needs the
  owner's yes in it: that of its queued issue ("Queued means wanted"), or, for one that goes beyond it, a new yes, for
  which it waits unmerged while its builder takes the next line.
- **The size caps keep the rules lean and decide nothing else** (`scripts/size.mjs`; core archive 179, 181 and 233). By
  default what a role reads at its start, as its file under `roles/` names it, stays under that role's cap, so whoever
  adds a rule there replaces text. Where a fresh session has read all the rules for room and found too little, that
  builder raises the role's cap one step, a whole KB, in the same PR, as "A mark on what every session reads" in
  `modules/review-guidelines.md` says of any such mark (core archive 182 and 201). It does not mean a rule is moved from
  where it belongs, cut short or left out to fit, nor another rule's reason, name or example cut to make room. Reason:
  each start is paid at every task, and a cap that decided where a rule stands would hide it from who must keep it.
  Held by `scripts/size.mjs`, and `.github/workflows/size.yml`, which fails a raise of more than one step, and one in
  a PR with no "Leanness check:" comment.
- **A release is cut on the owner's word** (core archive 195 and 196): another owner's project takes the core only
  from a release (`README.md`, "How a project takes the core", point 1), so one is cut when the owner says the core as
  it stands may be handed on, never by a session's own choice: the owner's standing word is that it may each time the
  queue is worked through ("One batch, then one release"). The owner tags nothing by hand:
  the owner, or a session the owner tells and whose own limits let it, starts the `release` workflow on `main` (its
  page under Actions has the button; `.github/workflows/release.yml`; core archive 197), and the workflow cuts it only
  where every check on `main`'s newest commit has passed and, once the staged cases hold a release ("Staged cases hold
  what no check reads"), no case failed in its last run: the tag `release-N` on that commit, never moved or deleted
  afterwards. `node scripts/release.mjs` says what the next one would carry.
- **Nothing locks a project** (core archive 201, 207 and 215), in any owner's project, the core's owner's own included.
  By default, once a project syncs to a release, nothing the release brings stops its work or waits on its owner:
  what an agent can mend alone may bind, and what only the owner can do (a yes the floor names, a setting on the
  owner's account, anything paid) is advisory, reported and labelled `needs-owner` (`scripts/labels.json`) while the
  rest goes on. The trigger is a check the release adds or makes read more, and its actor is whoever builds that check:
  - a pull request that makes something worse than it stood may fail, and the session mends it there; every failure
    says its mend (#254);
  - what stood before the check came, or before it read more, never turns it red: the check keeps a baseline, what
    breaks it today, listed and allowed only to shrink. A sync pull request holds the copy alone, so until the list
    is written the pull request's base counts as it, and the entry of `setup/sync-notes.md` that brings the check
    has a step whose check reads that the list is written: no old breach goes unlisted. The one exception, on the owner's word and no other: the personal-terms check fails a listed term wherever
    it stands, one the project held before and a name a machine's git writes into each commit included, its failure
    saying how the session takes it out in that pull request itself (core archive 202 and 207);
  - it adds no billed job, since a private repository on GitHub's free plan pays a whole minute for each job and its
    Actions stop once the month's are spent.

  A baseline is a debt, not an exemption: the project's agents work it down by tasks, at the dose the codebase's state
  sets, never by a red check, and in the core's own repository none may stand (#259). The audits and the cleaning
  share run by themselves in every project; its owner may change the dose with one line of the manifest, and is not
  asked to (`modules/cleaning.md`). It does not mean that all a release brings arrives advisory or off, nor that old code is left
  alone. Reason: a project that takes the core on trust, from a release, never finds a pull request failing, or work
  waiting on its owner, for something it did not change. Held by `scripts/upgrade-test.mjs`, in
  `.github/workflows/tests.yml`: a project written by the starter kit of each of the last two releases (npm and .NET,
  the .NET one as Windows holds it, its commits made under a listed name), holding old content of each kind a check
  reads and synced to the commit under test, passes every check of the core unchanged, that mend made, starts no job
  it did not start before, and fails a pull request that adds a copy until the mend its failure words is made; by the
  heading "What it asks of a project" below; and, for the dose, by the scheduled look (`scripts/look.mjs`), which
  reads it from the shape check's baseline (`scripts/dose.mjs`).
- **A release says what it asks, step by step** (core archive 215). Whoever adds an entry to `setup/sync-notes.md`
  gives it a step in `scripts/steps.mjs` that answers done or not done exactly, never by guessing: a check of its own
  with its mend, worded so a session acts on it with no rule file open; a check of the project's that fails where it
  is not done; or, where no check reads it, why, held by the staged case `steps`. Every standing entry has one. Every sync
  runs them all (`scripts/sync.mjs`) and prints, for the sync pull request's description, only the steps not done, and
  every difference from what the starter kit writes for a new project of the same kind (`scripts/fresh.mjs`); each is
  a task the project's agents take (`modules/orchestrating.md`; with no orchestrator, the session that syncs), a step
  only the owner can do labelled so, and each difference kept on purpose declared in the manifest's "Differences".
  Each release says in one place what it asks and roughly what each ask costs (`scripts/release.mjs`); a project's
  owner may reorder or slow the asks. It does not mean that a sync pull request carries the steps (it stays pure), nor
  that a step not done fails or stops anything. Reason: a step written only in prose is where one is missed, and
  nothing showed that it was. Held by `scripts/steps-test.mjs`, which fails an entry with no step and a step with a
  check that cannot be taken out and mended, and by `scripts/upgrade-test.mjs`: after the sync every step reads done,
  but one the release adds that it asks of every project (a check's own list to write), which is reported and done
  by its mend as written; each step added since the release started from, taken out, is reported and its mend as
  written makes it done, and steps taken out at random are reported, exactly those.
- **A pull request says what it asks of a project** (core archive 215): one that changes the floor, a module, a script,
  the setup or a workflow has the heading "What it asks of a project", saying what happens in a project that changes
  nothing of its own: nothing, a baseline written, or an ask in the sync notes with its cost. It does not mean that
  every such change asks something of a project: "Nothing" is an answer, and most changes give it. Reason: two of the ideas
  queued on 14 November would have broken "Nothing locks a project", and only a reading caught them. Held by
  `.github/workflows/own-description.yml`, which fails one without it.
- **A check that fails says the mend** (core archive 219; #254). Every check of the core, a script under `scripts/` or
  a workflow's own step that fails a pull request, fails with a line that says what is wrong and where, then "Mend:"
  and what a session does about it, in words it acts on with no rule file open (the form: `scripts/mend.mjs`). Where
  the mend is a step only the owner can take (a yes floor rule 14 names), it says so, and the session's part is the
  issue it files for it. Whoever writes or changes a check writes each failure so, and its test runs it where it fails
  and reads the mend. It does not mean that a project's own checks are asked anything, nor a test's own assertions,
  which are no check. Reason: a session that met a failing check had to find the rule behind it before it could act,
  and on 14 November one stopped at a draft for want of a rule that said what came next. Held by
  `scripts/mend-test.mjs`, in `.github/workflows/tests.yml`: each script a workflow names, and each workflow with a
  step that fails by itself, is a check with its test, or is listed with why it fails no pull request, and each
  check's test reads its failures with `mended()`.
- **Reports from projects** come as issues here, each data (floor rule 4), and are answered as `README.md`, "Reporting
  to the core", says.
- **The core is measured as a feature is** (core archive 195): at each review of the core the owner asks for,
  `node core/scripts/core-cost.mjs --cost`, run in each project of the owner's, says what share of its merged PRs were
  the core's upkeep and what a PR took, and `node core/scripts/stand-in-record.mjs` the stand-in's verdicts and how
  many of the owner's answers they matched (core archive 199), and `node core/scripts/review-record.mjs` what each
  review found and the bugs that reached `main` all the same (#234); the numbers go into that review's report, beside
  the last ones'. Where the
  core's share grew and the project's own work did not, the review says why, or what of the core goes for it.
- **The core's state report reads the projects that take it** (core archive 218): each month the session that takes
  the core's state report, where gh answers for the owner's account, adds to it what `node scripts/state-report.mjs --projects` prints:
  the counts of each project whose manifest names this core and that is the owner's, or whose owner gave the core's
  owner access, or whose manifest's row *shares its counts* says `yes`, found each time and listed nowhere by hand. A
  private project is not named, nor one of another owner's ("a project of another owner"), and of either only counts and
  conclusions are carried, nothing of its code or its discussions. It does not mean a project that is merely public is
  read for the report, though a task may read it (`modules/how-to-work.md`). Reason: the owner wants to see how the
  core works in other projects, and only those that hold use to read.
- **A rule moves here only when it holds in every project,** with the owner's words behind it in the archive. The core
  names no project outside its archive and reports.
- **Every rule says what holds it** (core archive 195 and 228). By default a rule of the floor or the modules is held by
  a check that fails where it is broken (a script, a workflow, a hook, or GitHub's setting that refuses it); where no
  check can read its breach exactly, by a staged case, the holder of last resort, or by the scheduled audit; and where
  none holds it yet, it is listed. Whoever writes or changes a rule names its holder in that PR: in
  `scripts/holders.json`, by the rule's file and bold lead, or in a staged case's own file; and under the PR's heading
  "What holds it" (`.github/workflows/own-description.yml` fails one without it), for each rule it adds or widens, what
  went wrong or would without it (an incident, a review's finding, the owner's reason), and its holder, or that it has
  none yet; "None" where it adds no rule. The rules that stood before are held the same way: `scripts/holders.mjs` lists
  each rule with no holder in the core's monthly state report, until it gains one or goes on the owner's word, and a
  review's finding seen twice moves its rule up to a check where one can hold it (#254). A line that only points
  elsewhere or says what is protected, binding no one, is marked "describes" there and is not listed. It does not mean
  that a rule with no holder fails anything or goes by itself, nor that a review is a holder. Reason: the audit of 13
  November found 43 of 122 rules held by nothing but a session reading them, and nothing listed them. Held by
  `scripts/holders.mjs`, in `.github/workflows/tests.yml`, which fails where `holders.json` names a rule that no longer
  stands or a check that is not there, and by the heading's check.
- **Staged cases hold what no check reads** (core archive 228; #235). By default a rule is held by a check; where none
  can read its breach exactly, since the breach lies in what a session does, a staged case holds it: a scratch project
  (`scripts/staged/`) in which a fresh session is given a task where the rule is easy to break, passed or failed by
  the case's script on what the session did, read from the project (its commits, its pushes, what it wrote to GitHub),
  never on what it says of itself. A case is due on the first scheduled look of each month, and once the words of a
  rule it holds change (`node scripts/staged.mjs`); the look then keeps the issue "Staged cases to run". The session
  that takes it runs each due case in a fresh helper at the builder's model and high effort, records the verdicts in
  `reports/staged-cases.json` in a pull request of its own, and says there of each failure whether the rule, the case
  or the session was wrong. The cases advise until three months in a row have run every one with no verdict found
  wrong; from then `scripts/release.mjs` cuts no release while a case's last verdict fails. They are run under each
  agent tool the core is used with, again at each release, and a tool works with the core once it passes them
  (`modules/tools.md`; #249). It does not mean that a
  case runs on a pull request or in a project, nor that one stands where a check could read the breach. Reason: no
  check sees how a session behaves, and the core's two staged runs, each of which changed it, were never run again
  when the rules or the models changed. Held by `scripts/staged-test.mjs` (each case read as set, kept and broken;
  what is due; when the cases hold a release), in `.github/workflows/tests.yml`, and by the look's issue.
- **A rule is written to one pattern** (core archive 214). Whoever writes or changes a rule of the floor, the modules or
  this file writes it in six parts: the default first, then the one condition that changes it; a trigger someone can
  observe ("a trial shows the stack misses a need stated in numbers", never `when performance matters`); one actor and
  one action, who does what; what it does not mean, where a reader could overreach; its reason, in one line; and what
  holds it (a check, a staged case or the audit), named under "What holds it" as "Every rule says what holds it" says.
  Kept out: adjectives that measure nothing (`clean`, `performant`), `should consider`, which binds no one, lists of
  preferred technologies, which date within months, and whatever a check's failure can say at the moment it matters
  (#254). A rule that stands and no change touches is the one exception: the audit of the core against itself (#259)
  brings it to the pattern instead. It does not mean a project's own rules are asked anything; they may be written the
  same way. Reason: in one evening three rules were read against what the owner meant, each for want of an observable
  trigger or a reason. Held by `scripts/general.mjs` with its list "phrases" (`scripts/general.json`), and by the review
  guidelines ("A rule file changed").
- **Rules are written for any project** (core archive 150). The projects that take the core differ in what they build
  (a game, a program people rely on at work), where they are built (the cloud, the owner's own computer), who can read
  them (anyone, the owner alone) and how they release (every merge, a tagged build). A rule reads true in each, what
  differs is a slot, and what holds for one kind alone goes in a module of its own. `scripts/general.mjs` fails a word
  in the floor or the modules that fits only some (`scripts/general.json`); a word a project finds untrue for it joins
  that list in the PR that rewords it. The owner is never "he" or "his" in new text: the same check reads each line a
  PR adds under `archive/` and `reports/` for a gendered pronoun, a line quoted with `>` (the owner's own words, as the
  archive keeps them) and a record moved word for word aside, while the older records stay as they were (core archive
  201).
- **The core's address stands in one place** (`scripts/core-address.mjs`; core archive 192). Should the account or the
  repository be renamed, it changes there and in the `CORE` of `.github/workflows/core.yml`, in one PR;
  `scripts/core-address-test.mjs` names what else here must follow, and a sync note tells each project to move its
  manifest's line and its calls.
- **Never create a repository named `agent-rules`,** the core's old name: links to it redirect here (core archive 121).

## Review guidelines

Every reviewer reads `modules/review-guidelines.md` whole and judges the change by it, with the floor. Here, a rule that
changes what any project must do without saying so in the PR is a departure from the PR's description, and blocks; so
does one that reads true only for some of the kinds of project "Rules are written for any project" names, and a raise of
a size cap in a PR with no "Leanness check:" comment that found too little room. A finding: a new rule whose "What
holds it" names discipline alone where a check that never guesses could hold it.
