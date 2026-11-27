# A part of the core and what is maintained

Read in the core's own repository by whoever replaces a part of the core, widens what one reads, or fetches a tool: the kind `update`, the paths `INVENTORY.md`, `inventory/`, `QUEUE.md`, `CHOICES.md`, `choices/`, `node.sh` and `scripts/`. Rules of `AGENTS.md`'s "How changes are made here", moved here by theme (#1202); a project's copy carries them as the core's text alone, and its sessions read none of them.

- **A part of the core gives way to what is maintained** (#534). By default the core keeps the parts it has. The one
  condition that changes it: a maintained tool, package or standard, free to use, does a part's job at the same level or
  better. The trigger is a line of `QUEUE.md` that names the part, as a verdict of the inventory (`INVENTORY.md`) joins
  it on the owner's word: whoever takes that line replaces the part, and from then on the core follows the tool's
  releases by `tasks/updates.md` in place of keeping a version of its own. "The same level or better" is shown: the tool
  and the part run on the same inputs (the core's own repository, the projects the upgrade test writes of each kind, and
  the part's own fixtures), and the pull request states what each found that the other did not, as `tasks/choices.md`
  asks of a trial. Where the tool defines the thing otherwise than the core (what a copy is, what counts as a branch),
  its definition is taken unless the comparison shows it worse for what the rule is for, and the pull request says
  which; and that pull request adds a sync note whose step has a project's list for that check written anew at the sync
  that brings the replacement, the pull request's base counting as the list until then. A part rests on one of the
  exceptions of `tasks/code-shape.md`, "A job a maintained package does is done by it", to stay. The writer of
  `QUEUE.md` queues the replacements in one order: the inventory, then the tools that only run, which hand over the most
  upkeep for the least work (secrets and personal terms, then the workflow checks, then mutation testing, then links),
  then the packages installed from the core's lock file (#654), then the form the rules are delivered in, each
  replacement a line and a pull request of its own. Whatever gives way, the core keeps: the floor and the policy a check
  applies (what is allowed, its lists); the content of the rule text, which another's text never replaces, though its
  form and delivery may change, the text that describes a check that gave way shrinks to a pointer to the tool's own
  documentation, and what others do may be written anew as the core's own, joining as any rule does; and the glue around
  every check: a baseline that may only shrink, a failure that says the mend, the word that it could read nothing
  (#459), and "Nothing locks a project"; the tool finds, and the core decides and words the failure. It does not mean a
  part is replaced for the sake of it, nor that a sync asks a project to replace anything of its own. Reason: what the
  core writes itself, the core alone maintains, in every project that takes it; and rule text breaks on no update, holds
  the owner's decisions with their reasons, would run with the agents' rights where another's (floor rule 4), and cannot
  be shown "the same level or better" without trials of behaviour. Held by no check: the comparison and the definition
  taken are stated in each replacement's pull request, which the reviews read, and the inventory is held by its own
  check (`tests/mend-test.mjs`).
- **A tool that only runs is fetched at set-up, as its own program** (#534). By default a check of the core is a script
  of its own. Where a part gives way to a tool that only runs, whoever builds the replacement has the tool fetched at
  set-up, never while a check runs: one exact version, its digest in a list a test reads (a registry's own lock file
  first, for a tool a registry carries; #654), an entry for each platform a check runs on, fetched to a place outside
  the repository when a session is set up and in the set-up step of the job on the host's runners, as `scripts/node.sh`
  fetches Node. The check then runs wherever the tool is, in a cloud session, on the owner's own computer or on the
  runners; where the tool is not there and cannot be fetched, the check says that it did not run and why, and decides
  nothing. The tool runs as its own program, never through a vendor's action for the host, a hosted service or a feature
  of the host's paid plans, and passes floor rules 7, 10 and 15 and the lookup (`floor/topics/dependencies.md`). It adds
  no job: what adds minutes, mutation testing above all, stays on the lines a change touches. It does not mean a check
  that exists on the host's runners alone. Reason: a private repository on the host's free plan stops its jobs once the
  month's minutes are spent, a project built on its owner's own computer gets least from a check it cannot run there,
  and a wrapper or a hosted feature brings terms of its own (a licence key for an organisation's repositories, a price
  for each committer) and may send data out of the repository. Held, for the pin, by the licence scan's check that a
  program a file downloads is pinned by version and checksum (`scripts/licence-scan.mjs`; #488); that no workflow runs
  such a tool through another's action, by no check yet (#639).
- **A part is asked again** (#534). By default the pass twice a year over the choice records (`tasks/choices.md`) asks
  of each part the inventory marks keep or try whether something maintained now does it, and writes the day on the
  inventory's line `Weighed whole:`. The trigger that asks sooner: a bug filed that names such a part, or a pull request
  that widens what such a part reads or checks (a new case, a new format, a new language) and does not only mend it;
  whoever takes that work puts the question and answers it in that pull request. A tool the core holds is followed by
  the update rules and looked up again by the scheduled look (#488). It does not mean that an answer replaces a part: a
  replace joins the queue on the owner's word, as above. Reason: twice a year is slow for a part that has begun to cost,
  and a bug or a widening is the sign that it has. Held, for the pass, by its issue, which the scheduled look opens and
  which asks it of the inventory (`scripts/choices.mjs`); the sooner asking, by no check, since none can tell a mend
  from a widening without guessing.
