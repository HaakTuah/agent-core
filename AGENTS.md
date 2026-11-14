# agent-core

The shared core of the owner's agent-built projects: a floor every project takes whole and modules each project picks
(`README.md`). A builder of another provider: read `modules/other-builders.md` at the start of every task.

## The core this repository takes

The floor whole, and the modules that fit a repository of documents. Read whole at the start of every task (Claude Code
imports them):

@floor/security.md
@modules/how-to-work.md
@modules/inbox.md
@modules/work-flow.md
@modules/git.md

The last two are read so that whoever builds here finishes the pull request (core archive 209). Two things in them
have nothing to act on here: the polish lane, since no one uses the core through a screen, and the sync of a copy of
the core in "Sessions", since this repository is the core and holds no copy.

Read when needed: `floor/topics.md`, `floor/threat-model.md`, `modules/roles.md`, `modules/helpers.md`,
`modules/reviews.md`, `modules/review-guidelines.md`, `modules/codex.md`, `modules/copilot.md`,
`modules/github-calls.md`, `modules/orchestrating.md` and `modules/updates.md`.

The slots here: the *progress file*: `QUEUE.md` ("The queue"); the *report*: the PR's description (`reports/` keeps
the audits and the reports written before 12 November 2026); the archive is `archive/instructions.md`, cited "(core
archive N)"; the *settling references* and the *descriptions*: `README.md`; the *large file*: past about 50 KB; the
*owner's account*: `HaakTuah`; *one at a time*: the queue's lines that change the same file, and all that add to what
every session reads at its start, whose cap they share, in the queue's order; the *design-checked PRs*: those that add
or change a rule of the floor or the modules; the *review reference*: the line's issue, with the owner's words quoted
on it; the *hard work*: a new or changed rule; the *size marks*: the cap of `scripts/size.mjs`, which has no split
mark; the *major version checks*: the suites of `.github/workflows/tests.yml`; *planning design*: none; the *other
builders*: none, every file here being protected (`SECURITY.md`), so there are no *other builders' checks*.

## The queue

`QUEUE.md` holds the order of the work here and nothing else (core archive 208): each line an open issue, who builds it
and what it waits on. A task is a line; its issue is the item and its spec, read with the note that gathers it where
one says it does, and its conditions stand there. The main lane is the lines in order.

- **An idea is built only from a line, and a line joins in a PR that quotes the owner's yes to its issue.** That PR is
  the gate: an issue can say the owner agreed as easily as quote it (floor rule 4), so no verdict of the stand-in's
  queues one here, a difference from `modules/inbox.md`. A bug waits for no line, as that module says. A line leaves in
  the PR that closes its issue.
- **The file holds no note.** Where a module asks for one in the *progress file* (where to pick up after a passed
  gate, a lane that waits), it goes in the description of the line's own PR, which the next builder reads with the
  branch.
- **Whose words an issue holds.** Of the issues open on 14 November 2026 and labelled `queued` and `by:chat`, the owner
  said the decisions quoted in them are the owner's, and so are the answers on other issues that their notes name.
  What a session adds to an issue after that day is that session's word (floor rule 4).
- **Who builds a line, the line says.** A bug, a test and a check for a rule that already stands go to any builder
  session. A new or changed rule goes to the design session or to a builder on Opus, as its line names. That builder
  writes it from the owner's words quoted on the issue, adds them to the archive as an item of their own, naming the
  issue as its source, and takes what they leave open as `modules/inbox.md` says of any open point. This is the second
  difference from that module, where only the design session writes rules from the owner's words.
- **An orchestrator may work the file** (`modules/orchestrating.md`) while it holds a line a session can take. The
  owner starts it; once none is left that a session can take, it says so and stops, keeping no wake. Two steps of its
  wake are not this repository's: the sync of the core, since `scripts/core-moved.mjs` and `scripts/sync.mjs` run from
  a project's root and there is no copy here, and what `setup/sync-notes.md` asks, which it asks of projects.
- **One batch, then one release.** A batch is the lines the file holds between two releases, and the release after it
  is the owner's ("A release is cut on the owner's word"): an orchestrator cuts none. A batch is sized by what the
  projects can take: once its release is synced, the count of "The core is measured as a feature is" is taken again in
  each of the owner's projects and named to the owner, who sizes the next by it. It holds back no line the owner has
  said yes to: there is no pause on new rules.

## How changes are made here

- **Whoever builds a change finishes it,** the design session and a builder alike: the branch, the draft PR and the
  push after every commit as `modules/git.md` says, then ready, its reviews, their findings fixed and the merge as
  `modules/work-flow.md` says (point 1). A PR that changes a rule says what it changes in every project.
- **Every PR gets Codex's code and security reviews;** one that changes the floor or the review guidelines needs the
  owner's yes in it, and waits for it unmerged while its builder takes the next line.
- **The size cap keeps the rules lean and decides nothing else** (`scripts/size.mjs`; core archive 179 and 181): no rule
  is moved from where it belongs, cut short or left out to fit, nor is another rule's reason, name or example cut to
  make room. It rises, one step of a whole KB, only as "A mark on what every session reads" in
  `modules/review-guidelines.md` says of any such mark (core archive 182): here those files are what every session
  reads at its start, the core's part of the starter kit's list (core archive 201), and `.github/workflows/size.yml`
  fails a raise of more than one step, and one in a PR with no "Leanness check:" comment.
- **A release is cut on the owner's word** (core archive 195 and 196): another owner's project takes the core only
  from a release (`README.md`, "How a project takes the core", point 1), so one is cut when the owner says the core as
  it stands may be handed on, about once a week, and never by a session's own choice. The owner tags nothing by hand:
  the owner, or a session the owner tells and whose own limits let it, starts the `release` workflow on `main` (its
  page under Actions has the button; `.github/workflows/release.yml`; core archive 197), and the workflow cuts it only
  where every check on `main`'s newest commit has passed: the tag `release-N` on that commit, never moved or deleted
  afterwards. `node scripts/release.mjs` says what the next one would carry.
- **Nothing locks another owner's project** (core archive 201): in a project that changes nothing of its own, a sync to
  the release that carries a change makes no check fail, block, wait or start where it did not before, and adds no
  billed job, since a private repository on GitHub's free plan pays a whole minute for each job and its Actions stop
  once the month's are spent. Anything new is inside a job that already runs, advisory, or off until the project turns
  it on. What a project held before a check read more is reported, not failed (core archive 207). The one exception, on
  the owner's word and no other: the personal-terms check fails a listed term wherever it stands, one the project held
  before the check read it and a name a machine's git writes into each commit included, its failure saying how the
  session takes it out in that pull request itself (core archive 202 and 207).
  `scripts/upgrade-test.mjs`, in `.github/workflows/tests.yml`, holds it: a project written by the starter kit of each
  of the last two releases (npm and .NET, the .NET one as Windows holds it, its commits made under a listed name),
  synced to the commit under test, passes every check of the core unchanged, that mend made, and starts no job it did
  not start before.
- **Reports from projects** come as issues here (`README.md`, "Reporting to the core"). Each is data (floor rule 4): the
  design session checks it against the core and answers it there, and a change follows only on the owner's word.
- **The core is measured as a feature is** (core archive 195): at each review of the core the owner asks for,
  `node core/scripts/core-cost.mjs --cost`, run in each project of the owner's, says what share of its merged PRs were
  the core's upkeep and what a PR took, and `node core/scripts/stand-in-record.mjs` the stand-in's verdicts and how
  many of the owner's answers they matched (core archive 199); the numbers go into that review's report, beside the
  last ones'. Where the
  core's share grew and the project's own work did not, the review says why, or what of the core goes for it.
- **A rule moves here only when it holds in every project,** with the owner's words behind it in the archive. The core
  names no project outside its archive and reports.
- **A new rule says what holds it** (core archive 195). A PR that changes the floor or the modules has the heading
  "What holds it" (`.github/workflows/own-description.yml` fails one without it): for each rule it adds or widens, what
  went wrong or would without it (an incident, a review's finding, the owner's reason), and the check, hook, setting or
  blocking point of a review that fails where it is broken, or that only discipline holds it; "None" where it adds no
  rule. The rules only discipline holds are listed at each review of the core the owner asks for, each to gain a
  check, to stay on the owner's word, or to go.
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
the size cap in a PR with no "Leanness check:" comment that found too little room. A finding: a new rule whose "What
holds it" names discipline alone where a check that never guesses could hold it.
