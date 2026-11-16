# How code is put together

Read when a system is designed, added or named, when code is ported or rewritten (core archive 226), and when a pull
request deletes a test or weakens one (#253). How what already stands is brought to it: `modules/cleaning.md`.

A **system** is a part of the code that someone can describe in a sentence: what it offers the others. A project names
its systems, and the marks below, in the config of its *shape check* (`core/scripts/shape.mjs`), which runs on every
pull request and says the mend of each thing it fails. Isolated means narrow, declared and checked, not none: systems
work together, so what is complete is that nothing reaches inside another system, and what they share goes through
one declared entrance.

- **Never worse.** By default a pull request that adds a breach of a rule below fails, in every project, and its
  session mends it there. What stood before the check read it is listed in the check's baseline and never fails: a
  listed function may shrink and may not grow, and a listed import may go. The baseline shrinks freely (`--write`). An
  entry joins it in two cases only: the check reads more than it did (a system named, a mark lowered, the first
  baseline), where the base branch held the breach already; or there was no other way, where the baseline gives the
  entry's reason under "grown", the pull request gives it too, and a fresh session says there that it found no other
  way. A mark rises the same way. It does not mean that code which stands is rewritten on demand: the baseline is a
  debt, worked down by tasks (`modules/cleaning.md`), and no project is asked to rewrite. Reason: the rules are there
  for a reason, and one earns from them only where they cannot slip. Held by the shape check, which reads the baseline
  against the pull request's base, and by the reviews for the reason given (`modules/review-guidelines.md`).
- **Each project names its systems, under the same domains.** By default every file of code lies in a system the
  config names, each with its paths, the systems it uses, its entrance and its domain. The domains: the rules; saved
  data; the display; input; the network; storage; code bound to a platform; wrappers of third-party packages; tools;
  tests. A project leaves out what it lacks and adds its own, and a module for one kind of project names that kind's.
  The trigger is code that fits no named system: the builder who adds it names its system in the same pull request.
  It does not mean more systems than someone could describe in a sentence each, a fixed name for the layers inside
  one, or a rewrite to reach them: what then crosses is listed in the baseline. Reason: where most files reach into
  one shared middle, each feature touches the middle, a builder reads widely before it changes anything, and lanes
  cannot run side by side, so the work becomes *one at a time*. Held by the shape check, which, once a project names
  a system, fails a new file of code that lies in none, and says on every run how many old ones do; and by the
  audit's first question.
- **Between systems, absolute for new code:**
  - the rules import nothing outward: not the display, input, the network, storage or a platform, and the clock and
    randomness are passed in to them;
  - dependencies point one way, and there is no cycle, between systems or between files;
  - each system has one entrance, and the others use only that;
  - each piece of data has one owner, and the others get a view they cannot change, or send a command;
  - each third-party package the project ships with is wrapped in one system;
  - a system's tests run without the other systems.

  The trigger is an import, or a call to the clock, that breaks one: the shape check fails it, naming the file, and the
  session mends it as the failure says. It does not mean that a system never reads what another holds: it reads it
  through the other's entrance, where its config declares that it uses that system. Nor does it mean a process or a
  service of its own for each. Reason: a change inside one system then stays inside it. Held by the shape check for
  the imports, the cycles, the entrances, the packages and the rules' own clock; who may change a piece of data, and
  whether a system's tests run alone, no check reads, and the audit's fifth and sixth questions answer.
- **Portable by default.** What a product ships for is its owner's choice. What its code builds and tests on is a
  separate matter: by default code bound to one platform lies in a system of the domain `platform`, and the rest
  builds and tests wherever the project's sessions and checks run. The trigger is an import of something the config
  lists under "platform" from outside that system: the check fails it. The project's builder lists there each package
  or module that binds code so. It does not mean a change to what the product is sold or shipped for. Reason: a
  project bound to one platform from its first day, on a tool's advice, cannot be tested where its sessions work.
  Held by the shape check and the audit's seventh question.
- **A function is held to three marks:** its lines, how deep its blocks nest, and how often it branches, where each
  `if`, loop, `case` and `catch` counts, and each and, or and choice within a line. The first guesses are 60 lines, 4
  deep and 15 branch points, which use tunes in the config's "marks". The trigger is a new function past a mark, or a
  listed one that grows: the check fails it, and its builder splits it by what it does. It does not mean that tests are
  held to the marks, nor that the numbers are the aim: file size was held, and files became small while staying one
  piece, so the checks read what depends on what and the audit's reader judges what no number shows. Reason: on 15
  November 2026 three codebases held 19, 54 and 79 functions with more than 30 branch points, the worst in the files
  changed most. Held by the shape check.
- **The tests have a time mark.** By default each suite a project names in the config's "suites" has a mark in
  seconds, set with room above what it takes today so that a slow runner fails nothing, and is started through the
  check (`--suite`), which fails one that passes and took longer. Each system's tests can be started alone. The
  builder whose change takes a suite past its mark makes it faster or splits it. It does not mean that a long
  measurement joins a suite, nor that a suite's own failure is the mark's. Reason: every session waits on the tests.
  Held by the shape check and the audit's fifth question.
- **A port or a rewrite states what it keeps.** By default a change that moves code proves behaviour unchanged. A port,
  or a part that is rewritten, states in its pull request what it keeps and what it is free to change. What it keeps
  is what the program owes: its rules, what it saves, what its users see. How the old code got there is not owed: the
  old tests' meaning moves, and the new code may be shaped anew. A proof that is exact by accident (a fingerprint of a
  whole run) may be taken again, with its reason, where the tests of the rules and the measured outcomes still hold.
  It does not mean that a split or a cleaning task may change what the program does. Reason: sameness proven line by
  line binds new code to the shape of the old. Held by the reviews alone, which read the statement.
- **A new project starts as rules with no screen.** By default the first code of a project that has rules of its own
  is those rules, run and tested with no display, and a plain view of their data; the display is added on top, as a
  system that uses them. Its first builder starts so. It does not mean that a project which stands is rebuilt, nor
  that one with no rules of its own invents some. Reason: rules that never import the display are tested, ported and
  run by a machine without it. Held by the shape check once the rules and the display are named systems; until then
  by discipline alone.
- **How strong the tests are is measured on the lines a pull request changes** (#253). By default the job that runs a
  project's tests runs its *mutation tool* on those lines through `core/scripts/strength.mjs`, which shows on the pull
  request how many of the faults put in on purpose a test caught, and fails nothing. The project names the tool in its
  manifest, a tool of development only, under the floor's rules for dependencies and licences, that writes its report
  in an open form, the mutation-testing-elements schema; a project with no such tool for its language, or with no
  tests yet, says `none` there with its reason, and the measure is left out. The one condition that changes it: once
  the project's baseline stands, a fault that survives on a changed line and the baseline does not list fails, and the
  session writes a test that catches it; only where the fault changes nothing the program does, it lists it with that
  reason, as "Never worse" says of any entry. The baseline lists what survives a whole run, which is the audit's,
  outside the suite and in a pull request that changes no code or test (`modules/cleaning.md`): a debt worked down at
  the dose. It does not mean that a pull request runs the whole codebase, that a score is the aim, or that the tests
  that stand are rewritten on demand; a listed fault whose line the change rewrote stays listed, and any other fault on
  a changed line is the change's own. Reason: the projects lean on their suites as the proof that a
  change kept behaviour, and nothing measured whether a test fails where the code is wrong. Held by the strength
  check, which counts each kind of fault a file holds against what the baseline lists of it and fails a survivor past
  it, an entry that joins with no reason, and one dropped while its fault survives, and by the reviews of that reason.
- **A test taken out or weakened is said.** By default a pull request keeps its tests and what they assert. The
  trigger is a pull request that deletes a test or weakens what one asserts (an assertion loosened or taken out, a
  case skipped): its builder says so under "Readings taken", with why, and the reviewer checks that the reason holds.
  It does not mean that a test which proves nothing must stay. Reason: a measure on changed lines cannot see a test
  weakened elsewhere, and a test made to pass is the cheapest way to green. No check holds it yet, since none can
  tell a weakened assertion without guessing: the reviews read it (`modules/review-guidelines.md`), the strength check
  names each test file a pull request deletes, and `core/scripts/holders.mjs` lists it until something holds it.
- **Near-copies are reported.** By default code that only looks like other code fails nothing. The trigger is a run
  of code that matches another once names and numbers are set aside: the copies check lists it on every run, and the
  audit's reader judges whether one function should serve both. It does not mean that such code is joined by rule:
  "One fact, one place" forbids a second copy of a fact, and code joined too early is harder to change than two plain
  pieces. Reason: exact copies were held, and copies that differ only in their names were up to 2.5% of a codebase
  that nothing saw. Held by the copies check's report.

**What has no mark here.** A hub, a file most others import: one that holds one small fact is as it should be, and
the audit's reader judges the others. The time a user waits on gets its own measure as its rule comes (#318).

**What the check reads.** JavaScript and TypeScript, by the reader of the measures (`core/scripts/code-shape.mjs`). It
never guesses: a file that holds JSX, whose functions its reader cannot tell, an import that leads nowhere it can tell
and a file in another language are counted and said on every run, never failed; until the check reads them (#354),
the audit's reader holds that code to these rules. A project that has not written its config yet is held to the
starter kit's own, with each pull request's base as its baseline, from the sync that brings the check.
