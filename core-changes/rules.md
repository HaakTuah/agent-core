# Writing a rule

Read in the core's own repository by whoever writes or changes a rule, or what a role reads at its start: the kind `rule`, the paths `floor/`, `roles/`, `tasks/`, `tools/`, `AGENTS.md`, `core-changes/`, `size.mjs` and `general.json`. Rules of `AGENTS.md`'s "How changes are made here", moved here by theme (#1202); a project's copy carries them as the core's text alone, and its sessions read none of them.

- **The size caps keep the rules lean and decide nothing else** (`scripts/size.mjs`).
  By default what a role reads at its start, as its file under `roles/` names it, stays under that role's cap, so
  whoever adds a rule there replaces text. Where a fresh session has read all the rules for room and found too little,
  whoever makes the change raises the role's cap one step, a whole KB, in the same PR, as "A mark on what every
  session reads" in `roles/shared/review-guidelines.md` says of any such mark. Where `main` itself
  stands past a cap, or the queue past its mark, because pull requests that each fitted merged together, it is a task
  to trim, which the scheduled look keeps, never a red that stops merging (#750, point 6): only a pull request whose
  own change takes a start or the queue past its cap, by growing it or lowering the cap, fails. It does not mean a rule is moved from where it belongs, cut short or
  left out to fit, nor another rule's reason, name or example cut to make room, nor that a cap is raised by a task to
  trim. Reason: each start is paid at every task, and a cap that decided where a rule stands would hide it from who
  must keep it; under merge-on-green two rule changes can each fit and together pass a cap. Held by
  `scripts/size.mjs`, against the pull request's base, and `.github/workflows/size.yml`, which fails a raise of more
  than one step, and one in a PR with no "Leanness check:" comment; the task, by the scheduled look's reader of it
  (`scripts/look.mjs`, from `due` in `scripts/size.mjs`).
- **A rule is for what an agent can do** (#303). By default a rule moves here, into the floor or a module, only where
  it holds in every project, an agent can carry it out, and it makes the product better or sturdier, as the licence
  check does: an agent keeps the project within it, and the project is safer for it. It comes from a standing word of
  the owner's (`roles/shared/inbox.md`, "An order for now is not a rule"), with an item of the archive behind it, and
  goes into a module read only when a task needs it, with a check wherever a machine can hold it. Nothing changes it.
  The design check of a pull request that adds or changes a rule blocks one that fails this test. It
  does not mean that what only the owner can act on (a duty to an authority, a promise to customers, whether a law
  reaches a product) is a rule: it is information for the owner, kept out of the rule files, binding no session. The
  core names no project outside its archive and reports. Reason: agents do what a rule file says, needed or not, at
  more cost and no gain, and a rule that only blocks gives them nothing to do. Held by the review guidelines ("A rule
  file changed"), and the standing word by the staged case `order-for-now`.
- **A rule of a game's kind moves to the core once a second game needs it** (#484, point 10). By default a rule a game
  writes for itself stays in that game, and an idea filed here as about its kind, or about every game, waits. The one
  condition that changes it: a second game needs the same rule, one that stands or one the owner has planned, and the
  idea's line joins `QUEUE.md` as any idea's does, on the owner's word. Then whoever builds that line writes the rule
  into the game module for the kind, or for every game, never for the game it came from, naming the kind, and the game's
  own copy goes at its next sync, as the game module says of its sync (`tasks/game-design.md`). It does not mean a
  game's rule is taken from it before the owner's word, nor that a kind with one game gets a part in the core. Reason:
  two games each held rules true of their kind (on what a request to a model may imply, on how fast a computer player
  may react), and a new game of that kind would have had to find them again. Held by none yet.
- **Proof is sized to what a thing costs others** (#303). By default the design check of a pull request that adds a
  thing asks for a number that shows it pays only where the thing is text a role reads at its start, a check that can
  fail a pull request, a test that adds a tenth of its suite's time mark or more (`tasks/tests.md`), or a choice one
  pull request cannot reverse (`tasks/choices.md`); of anything else, a quicker test or a line of a module read on need
  among them, it asks none, and it holds a new measure to one a script counts, never a hand, that costs less than
  keeping the thing does. Nothing changes it. It does not mean a rule names no number: its line costs a line and is asked all
  the same ("Every rule says what holds it"); what is sized is the work of proving. Reason: proof that costs more than
  what it guards against is the overhead it was meant to cut. Held by the review guidelines ("A rule file changed").
- **A rule is written in the form a check can hold** (#887). By default a rule of the floor, the modules or this file
  takes a form whose breach a check reads without guessing: whoever writes or changes one looks first for such a form,
  the rule as asked or one slightly different, writes it, and names the check under "What holds it". The one condition that
  changes it: the checkable form would change what the rule asks or protects in a way that matters a great deal; then
  the form only a reading holds is kept, and the pull request says why. The trigger is a rule written or changed: the
  design check reads each for it, and blocks one held by reading alone where a checkable form exists and the pull
  request gives no such reason (`roles/shared/review-guidelines.md`, "A rule file changed"); and at each pruning ("Rules
  are pruned by their numbers") the session that takes it proposes, for each rule with no holder, beside its other
  proposal, a slightly different form a check could hold, or why none exists (`form` or `noForm` in
  `reports/unheld.json`; a proposal of a check, which holds the rule as worded, or that the rule describes needs
  neither). A project's design checks read its own rules the same way, from the release that brings it. It does not
  mean that a rule's purpose is bent to fit a check, that a rule is turned into a line a pull request declares where
  what it asks is what the work does, that a check that guesses is written, nor that a rule that stands and no change
  touches is rewritten for it outside a pruning's proposal. Reason: a
  rule a check holds need not be given to a session ahead of its work once release 7 (#692) begins, and is kept whether
  or not it is read, while one held by reading costs every session that reads it. Held, for the pruning, by
  `scripts/pruning.mjs`, whose test reads that the list gives each rule with no holder its checkable form or the reason
  it has none, or says it has neither yet; for the design check, by no check, since none can tell without guessing
  whether a form exists.
- **A rule is written to one pattern.** Whoever writes or changes a rule of the floor, the modules or
  this file writes it in six parts: the default first, then the one condition that changes it; a trigger someone can
  observe ("a trial shows the stack misses a need stated in numbers", never `when performance matters`); one actor and
  one action, who does what; what it does not mean, where a reader could overreach; its reason, in one line; and what
  holds it (a check, in the form one can hold where there is one, as the rule before says; a staged case or the
  audit), named under "What holds it" as "Every rule says what holds it" says.
  Kept out: adjectives that measure nothing (`clean`, `performant`), `should consider`, which binds no one, lists of
  preferred technologies, which date within months, and whatever a check's failure can say at the moment it matters
  (#254). A rule that stands and no change touches is the one exception: the audit of the core against itself (#259)
  brings it to the pattern instead. It does not mean a project's own rules are asked to take this pattern; they may be
  written the same way, and what holds them is listed as "A project's own rules name what holds them" says. Reason: in one evening three rules were read against what the owner meant, each for want of an observable
  trigger or a reason. Held by `scripts/general.mjs` with its list "phrases" (`scripts/general.json`), and by the review
  guidelines ("A rule file changed").
- **What can be read is never asked or declared** (#481). By default a fact about a project's set-up
  that can be read exactly, from its repository, its host, the tools at hand or the record of its past work, is read by
  a script, and a row of its manifest, or the owner's word, only overrides what was read; what the owner wants (a pace,
  a taste, what a product ships for, which kinds of choice the owner keeps) is no fact, is never guessed, and has a
  default the owner's word changes, so nothing waits on it. Where a fact cannot be read exactly, it has a default and an
  override, as a choice has. Whoever writes a rule or a slot that takes a fact about the set-up says where it is read
  from, or why it cannot be; each slot of the README's table carries one mark, `read:` with its reader, `choice:` with
  its default, or `cannot be read:` with the reason and a default; and a reader prints what it read, so a wrong reading
  is seen and overridden. It does not mean that a script guesses, nor that what only the owner can give (the personal
  terms, a setting on the owner's account, a certificate, the holder's name in a licence file, and whose word counts
  where the host cannot say it) is taken from elsewhere or given a default (floor rules 4, 11 and 14). Reason: a project
  that takes the core on trust sets nothing, so a rule that waits for a setting gives it its worst case. Held by
  `scripts/manifest-reads.mjs --core`, which fails a slot with no mark, a `read:` whose reader is not there and any
  other with no default; by each reader's own test; and by the review guidelines ("A rule file changed").
- **Rules are written for any project.** The projects that take the core differ in what they build (a game, a program
  people rely on at work), where they are built (the cloud, the owner's own computer), who can read them (anyone, the
  owner alone) and how they release (every merge, a tagged build). A rule reads true in each, what differs is a slot,
  and what holds for one kind alone goes in a module of its own. `scripts/general.mjs` fails a word in the floor or the
  modules that fits only some (`scripts/general.json`); a word a project finds untrue for it joins that list in the PR
  that rewords it. The owner is never "he" or "his" in new text: the same check reads each line a PR adds under
  `archive/` and `reports/` for a gendered pronoun, a line quoted with `>` (the owner's own words) and a record moved
  word for word aside, while the older records stay as they were.
