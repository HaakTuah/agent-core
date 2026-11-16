# The core's choices that are hard to undo

The core's *choice records* (`AGENTS.md`, "The slots here"; `tasks/choices.md`), each recorded as it stood when the
rule came.

Read whole: 2026-11-15

## Choice: the scripts in JavaScript on Node, with nothing installed in a project

- Chosen for: a project runs the core's scripts from its copy with nothing installed, so no package of the core's
  needs a licence check, a registry or an install, and the sync runs outside the owner's test box with Node and Git
  alone (`setup/server.md`, point 7). The one exact Node is `.node-version`'s.
- Reopened on 16 November 2026 (#486, point 3), its sign having tripped: the readers written here by hand to stand in
  for a package pass 600 lines together, though none alone (the lexer of `scripts/code-shape.mjs`,
  `scripts/shape-csharp.mjs` and `scripts/shape-python.mjs`), and a reader for Rust, another, was asked for. What stands: the scripts in JavaScript, run by the
  pinned Node from the copy, a project's sessions installing nothing, and the scripts' own code with no type checker
  (the third record below). What gives way: a format or a language someone else defines is read by a package carried
  in the copy at one exact version, or by a tool that runs only in the core's own checks (#486, points 6 to 8); the
  parser of the next record is the first, and its inventory says what follows.
- Reopens it: a package the core needs cannot run on the pinned Node from the copy with nothing installed (it needs a
  native build or an install script), or the packages carried in the copy pass 20 MB.

## Choice: one parser, tree-sitter, carried in the copy, reads every language's structure

The record of #486, points 2, 9 and 10, written and argued on 16 November 2026. The trial's samples, invented, its
counter and its commands are in the pull request that adds this record (#487).

- **Criteria, before the options.**
  1. Exact counts: functions, their lines and their branching as the shape check defines them, matching a count taken
     by hand on code written to trip a reader (a brace in a string, a comment or a character; a raw string; a
     lifetime; a closure; a guard; a switch expression), in Rust and in C#, on code the definition was not written
     against too.
  2. A new language costs hours, not days: each check written once, and a few lines for each language. Today each
     language takes a lexer of its own (`scripts/shape-csharp.mjs`, 318 lines; `scripts/shape-python.mjs`, 388).
  3. Runs wherever the checks run (a cloud session, Actions, the owner's computer, Linux and Windows) with nothing
     installed in a project and no toolchain of the language read: the core's checks read a .NET project's code where
     no .NET is installed.
  4. Fast enough to read a project whole on each pull request: 100,000 lines in under 5 seconds.
  5. Trust and upkeep (floor rules 7, 10 and 15): one exact version, a known publisher, its source checked on each
     update, a licence free to use; what no one reviews by reading kept as small and as few as can be.
  6. What leaving costs: how much of the checks a move away, or an update the grammars cannot follow, would rewrite.
  7. How well agents work in it: what a builder must know to add a language or a measure.
- **The options**, each with what would make it the wrong pick.
  - **A. Readers written by hand for each language and check, as now.** Wrong where a language's lexer keeps
    misreading, or each language costs days.
  - **B. One parser for many languages, tree-sitter** (MIT; the tree-sitter organisation's runtime, with provenance,
    and its grammars, signed, on npm): `web-tree-sitter` 0.27.2 (a JavaScript file of 155 KB and a WebAssembly file of
    211 KB), and one WebAssembly grammar for each language (Rust 1.1 MB, C# 5.4 MB), run by Node's own WebAssembly.
    Wrong where a grammar misparses common code, or its files cannot pass floor rule 7's check.
  - **C. Each language's own tooling** (Rust's compiler and Clippy, C#'s Roslyn, Python's own `ast`), run where it is
    installed. Wrong where the toolchain is missing where the checks run, or its measures cannot be set to the core's.
- **The trial, on the hardest part.** A Rust file of 87 lines and a C# file of 104, invented to trip a reader, counted
  by hand: Rust 11 functions, 72 lines, 19 branches; C# 10, 86 and 25. Then, held out, a Rust file of 197 lines and a
  C# file of 210, written and counted by hand by a fresh session that never saw the counter, the counter's definition
  frozen first: Rust 19, 162 and 34; C# 19, 164 and 42 (its `do … while` read as one loop, where the hand count had
  two).
  - A: on C#, the core's reader found every function in both files; its lines came to 77 and 149, since it counts
    from the opening brace (a definition, not a misread), and its branches to 23 and 39, since it counts no `when`,
    and once counted a `??=`.
    No bug filed here names a language reader. On Rust there is no reader; one would need its own lexer (a lifetime
    that looks like a character, a raw string, a `||` that opens a closure and is no "or"), not timed.
  - B: the first files exact in every function. Held out, Rust exact in every function, first time; C# counted one
    method written with `=>` alone as a function, a fault in the counter's definition (it asked no block body of a
    method), and with that one line mended, exact in every function, the first files still exact. The definition is
    about ten lines a language, written against the node types the grammar lists; no file had a parse error. It
    loads in 30 ms and parses 87,000 lines of Rust in 0.66 s, where the core's C# reader takes 0.69 s for 104,000
    lines of C#.
  - C: Clippy, its limits at 0, reported 13 functions in the first Rust file (every closure, `|| true` too), lines of
    the body without braces or blank lines, and cognitive complexity in place of branches, none of which it lets the
    core define; it compiled the crate first. Roslyn needs the .NET SDK, which the machine the sessions work on lacks:
    C# could not be counted there at all.
- **Popularity, for what it buys:** the tree-sitter organisation keeps the grammars of Rust, C#, Python, JavaScript,
  TypeScript and Bash, so the next language a project picks likely has one kept by the same publisher. Godot's own
  language has only an outside author's grammar, whose upkeep is unknown.
- **The case against** (a fresh session, on Opus at high, given this record before the held-out trial):
  1. "Exact" was scored on the files the definition was fitted to, the speed on one file repeated, and the sign counts
     parse errors, not miscounts.
  2. A is underrated: on C# it missed only the `when` guards, a few lines to add; no bug names a language reader; a
     Rust lexer's cost was guessed, not timed.
  3. Floor rule 7 asks for the diff read against the release notes, and the WebAssembly, built from a generated parser
     of 29 MB that no one reads, cannot be; the grammars have no provenance.
  4. Fetching against carrying was never argued, though #486 asks it settled here and the session leaned to carrying;
     a fetch that cannot run leaves the rule unheld on Windows or offline, and each grammar's package holds native
     builds and an install script.
  5. Leaving costs are left out: the grammars name older runtimes than 0.27.2, an update may strand one, and the move
     itself costs a fetch script, Windows, and new baseline entries where the counts move.
- **The answer.**
  1. Taken: the held-out trial above, by a session that never saw the counter, found one fault in the definition and
     none in the parser; "Reopens it:" now names a miscount on held-out or real code.
  2. Granted on C#, where the hand reader works. What decides is the next language and #486, point 6, to which the
     owner agreed after the case was written: a language someone else defines is read by a package, not by hand.
  3. A grammar's update passes floor rule 7 as written: the same publisher and repository, the registry's signature
     verified, and the diff of what can be read (the grammar, its node types, its tests) read against the release
     notes, the WebAssembly named as what they do not explain, as the rule asks of anything so. The pinned Node of
     `scripts/node.sh` passes it the same way. Provenance is asked only where the old version had it.
  4. Taken, and the pick changed to carrying: the runtime and all seven grammars the core would read (Rust, C#,
     Python, JavaScript, TypeScript, TSX, Bash) come to 11.9 MB, and 1.1 MB compressed, as git stores them; so a copy carries them
     all at little cost, works offline and on Windows, and is held byte for byte by the copy check
     (`.github/workflows/core.yml`), with no fetch to fail. Only the `.wasm` and the runtime's file are taken from a
     package, never its native builds, and no install script runs.
  5. Taken into the sign: runtime 0.27.2 loaded both grammars, built for older ones, but an update that strands one
     reopens the record. The baseline entries are what "Nothing locks a project" asks of any new reading.
- **The pick: B, carried in the copy.** It alone met criteria 1 and 3 together, with a definition of about ten lines
  for each language. The runtime and each grammar the core reads stand in the core at one exact version, their SHA-256
  in one list a test reads, each update passing floor rule 7's check of its source in its own pull request, and their
  MIT notices kept in the core's third-party notices (floor rule 10), the test that reads the list reading each
  file's licence too. The
  readers by hand that work (JavaScript, C#, Python) stay until the parser replaces each, a line each; Rust's reader
  is the first built this way, and #426's .NET readers the next. No package comes into the core, the parser first,
  until #488's points 1, 3 and 4 (how a package is looked up, the week's wait in the package manager, the registry
  as the only source) have merged: this record picks the way, and #488 is the gate for its arrival.
- **What a sync asks of a project:** for this record, nothing. The line that builds the first reader the picked way
  says what its sync asks; by this record, no install, no host to reach, and a reader's new findings listed in the
  check's baseline, as any new reading is ("Nothing locks a project").
- **What is written by hand today** (#486, point 10). Counted on 16 November 2026: each stand-in's lines, and the
  issues labelled `bug` that name its script (of the 50 so labelled). In the order of what each is worth, each
  replaced by itself, with a trial of its own, at the dose, as cleaning is (`tasks/cleaning.md`), and each that brings
  a package only once #488's gate stands:
  1. **What Node itself brings** (point 11): none of the 76 tests uses `node:test` or `node:assert`, and none of the
     51 scripts that read their arguments uses `util.parseArgs`. Replace each where its file is next changed; no
     package is needed.
  2. **YAML, shell commands and the host's workflows:**
     - `scripts/yaml-keys.mjs` (155 lines, no bug), the key read twice that every project's workflow check fails:
       replace with a YAML package carried in the copy, one that reports a key given twice;
     - `scripts/workflow-run.mjs` (395 lines, no bug), which reads the host's workflow format, its expressions and
       its steps for the core's upgrade test alone: replace its YAML with a package in the core's tests alone, and
       keep its runner until a trial shows a tool that only runs can run the upgrade test where the sessions work;
     - the reader of shell commands in `scripts/check-configs.mjs` (661 lines in all, no bug): replace its Bash with
       the parser's Bash grammar (1.4 MB, the tree-sitter organisation's); keep its PowerShell until a grammar of a
       known publisher exists;
     - the matching of file patterns, written three times (`check-configs.mjs`, `workflow-run.mjs`, `select.mjs`,
       about 70 lines together, no bug): replace with one, on Node's own `path.matchesGlob` where its tests show it
       matches the host's filters;
     - the host's workflow check (`scripts/workflows.mjs`, 119 lines, 1 bug): keep its search for a word, which reads
       no YAML on purpose; its keys given twice go with `yaml-keys.mjs`.
  3. **The readers of languages:** the lexer of `scripts/code-shape.mjs` (in 881 lines), `scripts/shape-csharp.mjs`
     (318) and `scripts/shape-python.mjs` (388), no bug: replace with the parser. Rust's reader is no replacement,
     and is built the picked way first, as is any reader of a language not read yet.
  4. **Cargo's own tool, once a project picks Rust:** the package checks planned for Cargo (#278): use `cargo
     metadata`, a tool that only runs, where Cargo is installed.
  5. **Markdown in a project's documents:** the pointer check (`scripts/pointers.mjs`, 237 lines, no bug), where it
     reads a project's own documents: replace that reading with a Markdown package carried in the copy, where its
     trial shows it reads every pointer form the check lists.
  6. **Schemas for the settings,** last: the checks written by hand of the shape of the settings files
     (`.github/shape.json`, `.github/copies.json`, the licence check's config, `scripts/labels.json`,
     `scripts/holders.json`), spread through the scripts that read them and counted apart only when taken: replace
     with a schema each and one checker of schemas, a tool that only runs where its trial shows it says the mend.
  - **Weighed like the rest:** the licence checks for npm and NuGet (`scripts/licences.mjs`, 545 lines, 4 bugs;
    `scripts/nuget.mjs`, 928, 7; `scripts/licence-scan.mjs`, 239, 1; `scripts/licence-installed.mjs`, 179, 1;
    `scripts/licence-commands.mjs`, 432, none): replace the reading underneath (the lock files, how a licence is
    written out) with packages or each system's own tool, each by a trial, and keep the policy on top (the floor's
    list, the owner's yes, the week's wait, the same publisher, failures that say the mend) the core's own. With 12
    bugs between them, the most of any stand-in, they go with the second group.
  - **Kept:** the finding of copies (`scripts/copies.mjs`, 314 lines, 9 bugs), since what a copy is the core's own
    rule defines; its reading of code goes through the parser once the readers of languages do. Left as they are, as
    #486 says: the core's own mutation tool, and the readers of the core's own rule files.
- Reopens it: the counts of a reader built this way differ from a count by hand on code it was not written against,
  or from real code of a project's, beyond a mend of its definition; a grammar a project of the owner's needs is
  missing, or fails to parse more than 1 file in 100 of that project's code; a runtime update leaves a grammar the
  core reads unable to load; an update cannot pass floor rule 7's check; or the files carried pass 20 MB.

## Choice: the core's scripts stay in JavaScript with no type checker

The same record weighs types for the core's own scripts (#486, point 4), written and argued with the one above.

- **Criteria, before the options.**
  1. Faults found that the tests and the reviews miss, counted in the scripts that change most and in the code each
     fixed bug stood in.
  2. Its cost: annotations to write, a checker to keep as a dependency, time added to the tests.
  3. Nothing breaks in a project: projects call each of the 92 scripts by its path, and run them with the pinned Node
     where `scripts/node.sh` installs it and with the machine's own where it cannot.
  4. How well agents read and write it.
- **The options**, each with what would make it the wrong pick.
  - **A. As they are:** JavaScript, nothing that checks a value's shape. Wrong where faults a checker catches reach
    `main`.
  - **B. JavaScript with types in comments,** names unchanged, checked by TypeScript's checker in the core's own tests
    alone (a tool that only runs, as #486, point 8, prefers), in loose mode with a baseline that may only shrink, or
    stricter. Wrong where the checker and its annotations cost more than the faults they catch.
  - **C. TypeScript run directly by the pinned Node,** with no build, behind one stable entry (#376). Wrong where a
    project's Node cannot run it, or the renames break a project's calls.
- **The trial.**
  - The pinned Node (26.13.0, its binary checked against `scripts/node.sh`'s sum) ran a TypeScript file directly, five
    runs of five, with no warning, and a `.mjs` file importing it; it refused an `enum` ("not supported in strip-only
    mode"), and has no flag to transform one. The Node 22.23.4 and 24.22.1 installed here did the same. Node strips the
    types and checks none: C checks nothing unless B's checker runs too.
  - The checker (TypeScript 6.0.2, with Node's types 26.6.6) on the ten scripts changed most in 2026 (`steps`,
    `check-configs`, `copies`, `size`, `security-review`, `workflow-run`, `steps-stage`, `pr-description`, `shape`,
    `look`: 3,935 lines), each finding read: in loose mode with no annotation, 14 findings, none a fault, each a
    pattern it cannot follow (a property set on a Map or an array, a variable that changes from an array to a Set, a
    parameter's default read as its type, a comment it misreads); with its checks of null alone added, 51 findings, 16
    of them a value that may be null, 13 of those guarded (a pattern that always matches, a length tested first, a
    filter), and 3 in `scripts/steps-stage.mjs`, a test's helper, which would throw only were the core's own template
    or a script's output to change, failing its test either way; in `strict`, 1,001 findings, 880 of them a value
    with no declared type, about one annotation for every four and a half lines.
  - On the code just before the fixes of #371, #386 and #423 (the bugs filed against the scripts whose fixing commits
    name them), loose and with null checks: no finding at a line the fix changed, save two at an unrelated name.
- **The case against** (the same challenger): the checker would no longer be the core's first dependency, the parser
  being that; loose mode needs no annotation, only a baseline of 14 lines, and its gain, a renamed or misspelled
  property caught as it is written, no scan of code that already passed its tests can measure; the bugs were sorted by
  their text, not run; the null findings went unread, and some throw in `steps-stage.mjs`; and the sign needs someone
  to sort fixes by hand.
- **The answer.** The first is granted, and the reason now rests on what the checker finds. The next three were
  measured, above: the run before each fix, the null mode and its 16 findings read one by one found no fault in code
  a project runs. The gain at the moment of writing is real but unmeasured, and B would still cost the core's first
  package in its tests, a lock file, and its updates' source checks, for nothing this trial shows. The sign below is
  now a run, not a sorting.
- **The pick: A.** On this trial a checker finds no fault the tests miss, in any mode short of 880 annotations in ten
  scripts; C adds to that a rename of every path a project calls. So point 5 of #486 has no steps to take while this
  stands.
- **What a sync asks of a project:** nothing.
- Reopens it: at a pass over these records, the trial's run (the checker in loose mode with null checks over the ten
  scripts changed most, the settings in #487) finds a fault in code a project runs; or a move to one stable entry
  (#376) renames the scripts for its own reasons.

## Choice: the core reaches a project as an exact copy under `core/`, pinned to one commit

- Chosen for: every reader of the rules (Claude Code's imports, another provider's reviewer on GitHub, any other tool)
  reads the repository's own files and installs nothing, and the hooks run the copy that was reviewed (core archive
  165); a pure sync needs no review of its own (floor rule 8).
- Reopens it: a project made of several repositories would hold the copy more than once (#285).

## Choice: the rules as Markdown files, one for each thing a reader looks up

- Chosen for: every agent tool the owner's projects use reads its instructions from Markdown files in the repository,
  Claude Code by its imports and any other tool because `AGENTS.md` names them (`README.md`, "How a project takes the
  core", point 3); one file a thing keeps what a session reads at its start under the cap (`scripts/size.mjs`).
- Reopens it: a tool a project uses reads its instructions only in another form than files in the repository.

## Choice: GitHub holds the work's state, and runs every check

- Chosen for: every session already works through GitHub, and the owner reads it from any device: issues hold the
  items, labels their state and sender (core archive 216 and 217), a pull request's description its report, the
  queue a file (`QUEUE.md`), and Actions runs each check at no cost to a public repository; no service or database of
  the core's own.
- Reopens it: a call a task needs is refused to the sessions that work here (as GitHub's GraphQL is refused to Claude
  Code's cloud sessions today, so every call goes through the REST API), or a project of the owner's moves to another
  host.

## Choice: one flat folder of scripts, each a command with its test beside it

- Chosen for: a workflow, a hook and a project's copy each call a script by its path, with nothing to build; each
  check's test stands next to it, and `.github/workflows/tests.yml` runs every one (the audit of #245 found the folder
  flat, with no import cycle: `reports/2026-11-14-how-code-is-put-together.md`).
- Reopens it: `scripts/` passes 150 files of code, or the shape check (`scripts/shape.mjs`) finds a cycle between them.
- Trips when: `files > 150`, `cycles > 0`

## Choice: the code is built and tested on Linux and on Windows, and on no other platform

- Chosen for: the sessions work on Linux, the owner's projects build on Linux and on Windows (a .NET project as
  Windows holds it), and the suites run on both, so a script that reads paths or line endings fails here first
  (`.github/workflows/tests.yml`).
- Reopens it: a project of the owner's builds on another platform (macOS, say), or a suite cannot run where the
  sessions work.
