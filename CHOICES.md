# The core's choices that are hard to undo

The core's *choice records* (`AGENTS.md`, "The slots here"; `tasks/choices.md`), each recorded as it stood when the
rule came.

Read whole: 2026-11-15

## Choice: the core's foundations, judged again as if written today

The record of #519, written and argued on 17 November 2026 by the process of #515 (points 1 and 3 to 7): one question,
were the core written today, from nothing, what would it be written in and built on? Its four parts: the language and
runtime of the scripts; whether their code is typed and checked; how a language or a format someone else defines is
read, and whether what reads it is carried or fetched; and how the core reaches a project. It argues again the first
three records below and the fourth, the copy. The target is judged on merit first, the cost of moving left out; the path
and its cost are a second judgment, apart. The trial's commands and its numbers in full are in the pull request that
adds this record.

- **The constraints.** Fixed, and not argued: the floor; "Nothing locks a project"; and that the core's checks run
  wherever sessions run (a cloud session, the host's runners, the owner's computer, Linux and Windows), in a project of
  any stack. Every other one is argued below, never assumed: that nothing is installed in a project; that a check
  needs no network when it runs; that one runtime is pinned; and the size of what a project carries.
- **Criteria, before the options.**
  1. Runs everywhere with what is there: the tools a place must already hold before a check starts (today Git, and a
     runtime `scripts/node.sh` fetches by its digest where the machine's differs).
  2. Correct: faults the tests and reviews miss, counted on the bugs fixed so far; for another language, counts equal
     to a hand count on code written to trip a reader, held out from whoever wrote it.
  3. Fast where it is paid: a hook starts in under 100 ms; a check reads 100,000 lines in under 5 s; the core's suites
     stay inside their time marks on the slowest runner (Windows, where starting a process costs most).
  4. Trust and upkeep under the floor: the fewest publishers, the least code no one reads by eye, each update one exact
     version read against its notes, licences on the allowed list.
  5. What a project carries and pays: the copy's bytes (4.0 MB today, 1.6 MB of it the core's own tests) and the minutes
     its checks add.
  6. How well agents work in it: written right the first time, no build step to change one script, faults said before
     the tests run.
  7. A new language or format costs hours, not days.
  8. What leaving costs later, and how long the choice lives (its upkeep, its promises of compatibility).
  9. Works with the network a session has: only the package registries and the host reachable, or none on the owner's
     computer; a fetch that fails says its mend and turns nothing red that stood before.
- **The long list,** searched on the web as well as known, each kept or dropped against a criterion.
  - *Language and runtime.*
    - JavaScript on the pinned Node: kept.
    - TypeScript, only the syntax Node strips, run by the same Node: kept.
    - Bun, which runs the same JavaScript: kept, as the stand-in for a faster JavaScript runtime.
    - Deno 2: dropped on criterion 1, on no runner or session machine, and its trial read from Bun's, the same profile.
    - Python 3: kept.
    - Go, a static binary for each system: kept, as the stand-in for a compiled language.
    - Rust: dropped on criterion 6; compiled like Go, slower to write and to build for some 90 commands.
    - C# on .NET (a file run by `dotnet run`): dropped on criterion 1, an SDK of hundreds of MB no npm project or cloud
      session holds, and 3, its start-up.
    - PowerShell 7: dropped on criterion 1, on no Linux session by default.
    - Bash with the usual tools: dropped on criteria 1 (Windows has it only through Git Bash) and 2.
    - Lua, Nim, Zig, Kotlin on the JVM: dropped on criteria 6 and 1, and the JVM on 3.
  - *Types.*
    - None, as now: kept.
    - Types in comments (JSDoc), checked by TypeScript's checker: kept.
    - TypeScript's own syntax, erasable, the checker run in the core's own tests: kept.
    - TypeScript built to JavaScript and the output committed: dropped on criterion 6, a build step on every change and
      the code held twice.
    - Flow: dropped on criterion 8, its upkeep outside its maker narrow.
    - A checker of the picked language's own (mypy or Pyright for Python; Go's compiler): follows the language.
  - *Reading another's language or format.*
    - Readers written by hand, as now: kept.
    - Tree-sitter, its grammars run as WebAssembly by Node (`web-tree-sitter`), carried in the copy: kept.
    - The same, fetched by digest when a check first needs it: kept.
    - Each language's own tooling (Roslyn, the Rust compiler, Python's `ast`, Go's parser): kept.
    - Lizard (a counter of functions and their branching in some 30 languages, Godot's among them; Python): kept.
    - ast-grep (tree-sitter inside a native binary for each system, queries in YAML): dropped on criteria 4 and 5, a
      native binary for each system and processor no one reads, holding the grammars `web-tree-sitter` runs as they are.
    - Mozilla's rust-code-analysis (tree-sitter, Rust): dropped on criterion 8, its last release over three years old.
    - scc and tokei: dropped on criterion 2; they count a file's keywords, not functions.
    - Semgrep: dropped on criteria 1 and 4, a native engine and a Python install.
    - srcML: dropped on criteria 1 and 7, a native tool for a few languages.
    - ANTLR's community grammars with its JavaScript runtime: dropped on criteria 3 and 8, slower parsers and grammars
      of uneven upkeep.
    - A language server for each language: dropped on criterion 1, each needs its toolchain.
    - A parser for one language alone (acorn, oxc, Babel for JavaScript): dropped on criterion 7, as the base for
      every language; it may still read one.
    - For the formats: YAML by `yaml` (one publisher, no dependency, reports a key given twice) or `js-yaml`; TOML by
      `smol-toml`; Markdown by `markdown-it` or `micromark`; file patterns by Node's own `path.matchesGlob`: kept, each
      as #486's inventory weighs it, and not tried here, since they read formats with one exact answer and change
      nothing of the foundations.
  - *How the core reaches a project.*
    - An exact copy under `core/`, pinned to one commit, as now: kept.
    - The same copy cut to what a project runs, with no tests: kept.
    - A git submodule: dropped on criterion 1; a checkout without its submodules holds an empty folder, so the rule
      files every session and every outside reviewer reads at its start are missing.
    - A git subtree: dropped on criterion 5; a copy that carries the core's history into each project.
    - A package in the project's own package manager: dropped on criterion 1 and on "Nothing locks a project"; a .NET
      or Python project has no npm, and an install would be the project's.
    - A release archive fetched by digest into an ignored folder at a session's start and in each check's job: kept.
    - The checks reached as the host's reusable workflows at a pinned commit, with no copy for them: kept, for the
      checks alone, since the rules must still be files in the repository.
    - One binary for each system, fetched by digest (Go, or JavaScript built into one by `bun build --compile` or
      Node's single executable, still "active development" in Node 26): dropped on criterion 4, a binary no one reads
      for each system and processor, and on 8 for Node's.
    - A container image: dropped on criterion 1; no container runs in a cloud session or on a Windows runner as a step.
    - An agent tool's plug-in: dropped on the third fixed constraint; it reaches one tool, and every tool reads the
      rules.
    - A template repository copied once: dropped on criterion 8; nothing reaches a project after its start.
    - The rules read from an address at a session's start: dropped on the floor (rule 4: text the project did not
      review) and on criterion 9.
- **The trial,** on what decides, each run in a scratch folder outside the repository, nothing of it committed.
  - *Start-up,* on Linux here, each the mean of 20 runs: Node (22.23.4; the pinned 26.13.0 is not on this machine)
    37 ms for nothing, Bun (1.4.4) 5, Python (3.13) 12, a Go (1.24) binary 3; a TypeScript file 65 ms on Node, the
    stripping about 28 ms of it, and 6 on Bun. The core's helper hook (`scripts/helper-call.mjs`) given a call: 76 ms
    on Node, 26 on Bun, and 104 on Node as TypeScript, past the 100 ms mark on Linux before Windows is reached. A Go
    binary that prints one line: 2.2 MB for Linux and 2.3 MB for Windows, one for each system and processor.
  - *The core's own tests, unchanged, under Node and Bun:* the 72 test files that fetch nothing and are not the long
    upgrade or staged ones. Node: 322 s, every case passed. Bun: 274 s, 15% less, with 3 cases failing in 2 files (a
    hostile test's "nothing was written outside the project", and two git cases of `reading-test.mjs`), and the file
    that starts the most processes (`check-test.mjs`) slower, 90 s against 80. Python and Go were not given a port of
    a script: what they save is what they start faster, about 25 and 34 ms a process; Python is on the host's runners
    and in the cloud session, not on the owner's computer unless installed, and its own library reads TOML but no
    YAML.
  - *Types, over every fixed bug* (#515, point 2): of the 44 closed issues labelled `bug`, the 33 whose fix changed a
    script that is no test, each on the tree just before its fix (30 trees), TypeScript's checker (6.0.2, with Node's
    types 26.6.6, `allowJs` and `checkJs`) in loose mode and with its checks of null. Findings at a line a fix changed:
    loose at 1 fix, null at 6; findings that point at the fault: none of 33 in either mode. None of the 33 bugs was of a
    kind a type check reaches: each was a rule, a text, a pattern, YAML, git's settings, a path or a platform (npm
    started on Windows, a bare repository, line endings, a link to a device). In `strict`, the tree before #422 gives
    7,332 findings, 4,951 of them a value with no declared type. Each tree took 4 to 17 s a mode.
  - *Reading other languages:* the numbers of the record below (#487) stand and were not run again: tree-sitter exact
    on held-out files in Rust and C#, the hand reader off by its definition on C# and absent on Rust, each language's
    tooling unable to run where the sessions work or to take the core's definition. Lizard 1.21.6 was fetched at that
    exact version, but this session's permission check refused to run its code, so its code was read: its definitions
    are fixed in it (in Rust a `match` counts once and not each arm, an error's `?` and a type's `where` count as
    branches, a closure is no function; in C# `??` counts and `when` does not), so it cannot count by the core's
    definition without a change to its own code. It reads Godot's language, which no grammar of a known publisher does.
  - *What a project carries:* the copy is 4.0 MB unpacked, of which the core's own tests are 1.6 MB, which no project
    runs; without them, 2.4 MB. The grammars the record below picks add 11.9 MB unpacked, 1.1 MB as git stores them.
- **The author's pick,** which the judge settles.
  1. *Language and runtime:* JavaScript on one pinned Node. Bun saves 15% of the tests' time on Linux and fails 3
     cases the core holds, is on no runner, and its gain is start-up, which a test that calls a check's function in its
     own process gains on any runtime. Go and Python start faster still, but Go puts a binary no one reads in each copy
     for each system (criterion 4) and a build step on each change (6), and Python is missing on the owner's computer
     (1) and reads no YAML of its own.
  2. *Types:* none, as now. Over 33 fixed bugs the checker pointed at no fault in any mode, and none of them was of the
     kind it reaches; `strict` asks about 5,000 annotations in the scripts that are no test. TypeScript run by Node adds
     about 28 ms to each start, which takes the helper hook past its mark. The gain at the moment of writing is not
     measured, and is the case for a checker.
  3. *Reading another's language or format:* tree-sitter, run as WebAssembly by Node, for every language's structure,
     and a small package for each format, each carried in the copy at one exact version and never fetched while a check
     runs, as the record below has it. Carried: a copy works offline and on Windows and is held byte for byte, at 1.1 MB
     as git stores the grammars.
  4. *How the core reaches a project:* the exact copy under `core/`, pinned, as now, but without the core's own tests,
     which no project runs: 1.6 MB of 4.0 left in the core, as its reports are. One copy for every project, not one cut
     to each project's stack, so one comparison proves it exact.
- The blind pick: a fresh session (Opus, at high), given the problem and the criteria alone, never this record:
  "(1) TypeScript run straight by Node.js, one pinned LTS line, no build step; (2) typed, with strict checking by `tsc`
  in the core's own CI only; (3) tree-sitter grammars compiled to WASM (`web-tree-sitter`) for source code, plus a few
  small pure-JS readers for the data formats, all carried inside the core at exact versions and never fetched while a
  check runs; (4) a pinned, reviewed snapshot committed into each project, cut down to that project's stacks." Its
  runners-up: Go (a build for each script and an unreadable binary for each system), Deno (on no runner), types in
  comments (agents write them less well), each language's compiler, readers by hand, a release fetched by digest (each
  fresh machine fetches it, and the rule files are missing until then), a submodule. Its open constraints: nothing
  installed in a project, kept; no network while a check runs, kept; one pinned runtime, kept as one long-term line
  with a least version; the size carried, cut to each project's stacks, tests and reports never carried. It took about
  15% of shipped JavaScript bugs to be caught by a checker (a study of 2017), "to test against" the core's own bugs, and
  named its pick wrong where fewer than about 5 of them a checker would catch, or where a hook's start as TypeScript
  passes 100 ms on Windows.

- Looked for: the challenger (a fresh session, Opus at high; this machine holds no second provider's tool, read from
  what is installed, so both that argue are fresh sessions of the one tool), searching the web before its case, named
  eight options the long list lacked:
  1. Microsoft's `@vscode/tree-sitter-wasm` (MIT; the runtime 0.25.10 and 16 grammars built as WebAssembly by one
     publisher, PowerShell among them), for criterion 4. Kept, as a source of the parser's grammars from one publisher,
     weighed against the tree-sitter organisation's own when the first grammar arrives; the parser is the same, so no
     trial of its own.
  2. Lezer (MIT; parsers in plain JavaScript for Python, Rust, Java, Go and C++), for code a person reads. Dropped on
     criterion 7: its maintainer keeps no C#.
  3. TypeScript 7 (stable in July 2026, about ten times faster, reading fewer JSDoc forms). Weighed with the types: its
     speed under criterion 3, its narrower JSDoc against types in comments; the trials ran on 6.0.2.
  4. A value's shape checked where a configuration or a format is read. Kept, as #486's inventory already holds it
     (its last group, schemas), and no foundation of its own.
  5. Python fetched by digest, as Node is. Taken: it puts Python level with Node on criterion 1, and the judge weighed
     the rest.
  6. Node's permission model, for a check that reads hostile input. Dropped as a foundation: a flag any Node check may
     take.
  7. Template updates by a three-way merge (Copier), against the drop of the template. Dropped on criterion 1 (Python
     and an install in the project) and on the exact copy a pure sync proves.
  8. The host's required workflows set by a ruleset, with no copy. Dropped on criterion 1: they need an organisation,
     and the projects stand under personal accounts.
  It found no runtime beyond the niche (LLRT, txiki.js), which fall on criteria 1 and 8.
- **The case against** (the same challenger):
  1. Criterion 1 is applied unevenly: Bun and Python can be fetched by digest as the pinned Node is, and the whole
     sweep passed on Node 22.23.4, not the pin, so the exact pin bought nothing the trial measured; one long-term line
     with a least version, as the blind pick has it, would use the Node most machines hold. Settled by the suites on the
     Node 22 and 24 the runners hold, on Linux and Windows.
  2. Bun's three failures are not Bun's: one test compares a folder's listing unsorted (Bun lists `x,tests`, Node
     `tests,x`), a latent fault in the core's test; two start the hook with Node's `--input-type=module -`. Granted to
     Node all the same: its long-term promises (8) and Windows, where `check-test.mjs` ran slower on Bun.
  3. The types trial measures the wrong thing: bugs that reached `main` are those that survived the tests and reviews,
     while a checker saves the faults found while writing (red runs, review findings within a pull request); a checker
     over code with no annotation has only `any` to go on, and typed strict code was never tried; and the 4,951
     annotations are a cost of moving, which this judgment leaves out. Settled by the checker on the heads of recent
     pull requests that failed a check or drew a review finding, counting findings at lines the same pull request then
     changed, and by 3 or 4 of the replayed faulty functions written fresh as strict typed code.
  4. The 100 ms mark argues against TypeScript in a hook's entry file only: types in comments cost nothing at run time,
     and a typed core may keep its hooks plain. Its own run: the hook 32 ms as JavaScript on Node 22 and 68 to 71 ms as
     TypeScript, about 37 ms of stripping; the 76 ms above was the hook fed through a shell pipe.
  5. How well agents write it (criterion 6) is what decides the blind pick, and it was never measured. Settled only by
     sessions writing the same check three ways, counting red runs before green: a few hours.
  6. Carrying grammars leaves out their cost over time: each update adds a binary, the C# one up to 5.4 MB, to every
     project's history for good; a copy cut to the project's stacks can be proven exact the same way, from the commit
     and the manifest. Settled by packing two versions of the C# grammar and measuring the growth.
  7. Conceded: JavaScript on Node, tree-sitter over readers by hand, carried over fetched, the formats by packages,
     the core's tests out of the copy, and the drops of the submodule, the container and the plug-in.
- **The answer:** the author grants 2 (the listing is sorted as a bug of its own, #522) and 4 (the
  mark binds a hook's entry file, not the core's types), and leaves 1, 3, 5 and 6 to the judge, with the cheap trials
  their case names.
- The judgment: a fresh session (Opus, at high) that wrote no part of the record, on the target alone, the cost of
  moving left out: "All four picks stand: JavaScript on Node, no type checker, tree-sitter and small format packages
  carried in the copy, and one exact copy under `core/` without the core's tests. On the pin I change one thing: the
  exact pin stays for the checks that decide a pull request, and the scripts also promise to run on a stated least
  long-term Node, tested in the core's CI. Sessions then use the machine's Node when it meets that least version."
  It settled objections by trial where one was cheap:
  1. *The pin* (objection 1, taken in part): the core's 73 test files on Node 24.22.1 all passed, as on 22.23.4, so the
     exact pin bought nothing the trials measured; it stays where a verdict must repeat (the host's runners, which read
     `.node-version`), and a session uses its machine's Node at or above a least version the core's CI tests, sparing a
     fetch of 30 to 40 MB on each fresh cloud machine (criteria 1 and 9).
  2. *Types* (objection 3, rejected on its trial): the checker in loose mode and with null checks on the tree before
     each of 134 commits, from the last 90 merged pull requests, that followed a review's finding or a failed check
     inside its pull request and changed 1,744 lines of scripts that are no test: 5 findings at a changed line in 2
     commits, and 51 in 20 with null checks, each read; none points at what the commit mended (each a pattern the
     checker cannot follow: `fail()` not known to exit, `[]` read as `never[]`, a `Buffer` given to `JSON.parse`, a
     property set by `Object.assign`, a null filtered out first). With the 33 fixed bugs and the ten scripts of the
     record below, three replays found no fault (criterion 2).
  3. *The 100 ms mark* (objection 4, overtaken): the helper hook 30 times on Node 22 took 36 ms as JavaScript and 77 as
     TypeScript; on Node 24, 38, and 82 cold and 38 with Node's compile cache. Start-up is no case against TypeScript
     on Node 24 and later with the cache; the case for no checker rests on the faults found alone.
  4. *The grammars' growth* (objection 6, rejected on its trial): the C# grammar 0.23.1 (5.9 MB) and 0.23.5 (5.35 MB)
     committed in turn into a scratch repository: 356 KB and 320 KB packed alone, 632 KB both, so an update adds about
     0.3 MB to a project's history. A copy cut to each project's stacks would hang the copy on the project's code, and
     a project that adds a language would go unread or red until it synced; one copy is proven exact by one comparison
     (criteria 2 and 8).
  Its verdicts on the open constraints: nothing installed in a project, kept; no network while a check runs, kept (a
  fetch fails on the owner's computer offline); the pin, exact in the host's checks with a least long-term line tested
  in the core's CI and used by sessions; the size, about 2.4 MB of scripts and 1.1 MB of grammars as git stores them,
  one copy for every stack. What it could not settle: Windows, where nothing here runs; the pinned Node 26.13.0, not on
  this machine; and objection 5, how well agents write each form, which the author then put to a trial and the judge
  read again:
  5. *How agents write each form* (objection 5, rejected on its trial): five tasks, each in three equal forms (plain
     JavaScript; types in comments checked strictly; strict TypeScript run by Node 24, the checker run before the
     tests), each writer a fresh session that saw only its folder and 5 or 6 public tests, scored on hidden ones. Three
     tasks written fresh (a Markdown table, 40 hidden cases; a `git diff` reader, 39; a configuration of time marks,
     39), one writer a form, Opus at high; two changes to a program of 7 modules (a failure's record reshaped across
     them, 38 hidden cases, 31 of them old behaviour; a configuration's list made a map with fields moved, 36, 26 old),
     two writers a form on Opus at high and two on Sonnet at high. A stale field left in one module, planted to test the
     tasks, passed the public tests in JavaScript, failed 2 to 5 hidden cases, and was caught by the checker in both
     typed forms. Of 33 sessions, none left a hidden case failing, in any form; one run in 33 was red for a fault in
     code, a parse error in JavaScript, which Node itself names. The typed forms ran 8 to 57% longer on the fresh tasks.
     The judge: "Nothing changes; all four picks stand as I judged them."
- **The second judgment, the path:** a fresh session (Opus, at high) that wrote no part of the record, given the
  target and #515's points 9 to 14 on moving code: "move, in five kinds of small pull request, none of them a
  rewrite." In order, each an ordinary pull request that leaves `main` working, each its own line in the queue on the
  owner's word, and the sync of each asking nothing of a project unless it says so:
  1. *A least long-term Node beside the pin* (Node 22 now, 24 once 22 ends in April 2027): `scripts/node.sh` keeps a
     machine's Node at or above it and fetches the pin otherwise, and the core's suites run on it too, on Linux on each
     pull request and on Windows on each push to `main`. About one session, and two security reviews, since the cloud
     setup runs it. Proved by the old and new `node.sh` on three machines (Node at the pin, below the least, none), and
     by the suites on both Nodes, which settles Windows.
  2. *The core's tests out of the copy,* in two pull requests a release apart: first the copy's comparison
     (`scripts/copy-tree.mjs`, `core.yml`) learns a folder `tests` that nothing yet leaves out; then
     `scripts/*-test.mjs` move to `tests/`, kept out of the copy by `.gitattributes`, every path that names them moved
     with them, and no script a project calls moved. About two sessions. A move by rule: every past release gives the
     same copy under the old and new comparison, every test runs the same cases with the same results, a check fails a
     test left behind, and its review reads the rule and a sample (#515, point 12).
  3. *How the core carries a package,* once #488's points 1, 3 and 4 have merged: one folder, a list of each package's
     version, digest and licence that a test reads, and its notices; the first the YAML package, for
     `scripts/yaml-keys.mjs`. About one and a half sessions, through every gate of #515's point 10, and proving that no
     check of a project reads the carried files as the project's own (copies, licences, size, personal terms).
  4. *The parser and one grammar, with the first new reader a queued line needs* (#426's .NET reader, or Rust's), the
     held-out hand count its proof; each further grammar arrives with its reader, never all seven at once. Its sync
     asks one step: the new check's list, written and failing nothing.
  5. *The readers by hand replaced one at a time,* most bugs first, at the dose: the YAML of `comment-only.mjs`, the
     reading under the licence checks, the shell readers, file patterns on `path.matchesGlob`, TOML; then the lexers of
     the shape check, Markdown and schemas last. About one session each, ten to twelve over several batches, each a
     port with its behaviour kept, old against new, its definition mended only after, in a pull request of its own.
  Not done: several readers in one pull request, a port that changes its definition, a path a project calls moved,
  the pin dropped, the copy cut by stack, anything fetched while a check runs, and anything of types. The count of the
  move (#515, point 11) is the inventory's stand-ins replaced. The bug the Bun run found, an unsorted folder listing in
  a test, is #522, fixed apart.
- **What a sync asks of a project:** nothing, by this record; each step of the path says what its own sync asks.
- **Step 2 came without the release between its two pull requests** (17 November 2026, #527), on the owner's order for
  this batch, which asked first whether the gap was needed. It was not: a project that skips a release takes both
  halves at once in any case, so the gap protected none that synced straight across it, and the upgrade test, a
  project from the starter kit of release-4 and one of release-5 each synced straight to the second pull request's
  commit, passed every check unchanged. A release cut between the two would have stopped the batch's queue for nothing.
- Reopens it: the suites' verdicts differ between the least Node and the pin, on Linux or Windows (the least
  goes); a hook's start passes 100 ms on Windows; a carried file turns a project's check red or raises its code
  scanning's alerts; a port's comparison differs beyond its definition's mend (that reader stays); the replay of fixed
  bugs and fixes inside pull requests finds 5 or more faults the checker points at in code a project runs; the writing
  trial, on a lighter model, vaguer tasks or longer changes, shows types cutting hidden failures or real red runs by a
  third or more; the grammars add more than 1 MB a year to a project's history, or the files carried pass 20 MB; or the
  move's cost passes twice the estimates above, or no step of it merges for 30 days (#515, points 11 and 14).

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
- Judged again on 17 November 2026 (#519, the record above), on merit: it stands. "Nothing installed in a project"
  was argued there and kept, as was no fetch while a check runs. What gives way: the one exact Node stays the pin of
  the host's checks, beside a least long-term Node the scripts promise to run on, tested in the core's suites and used
  by a session whose machine holds it (the path's first step).
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
- **The trial, on the hardest part,** run on the packages themselves (`web-tree-sitter` 0.27.2, `tree-sitter-rust`
  0.24.0 and `tree-sitter-c-sharp` 0.23.5 from the npm registry, and the Python, JavaScript, TypeScript and Bash
  grammars for their sizes), each at one exact version, fetched with install scripts off into a scratch folder outside
  the repository, nothing of them committed: the trial is not their arrival, which waits on #488 as the pick says. A
  Rust file of 87 lines and a C# file of 104, invented to trip a reader, counted by hand: Rust 11 functions, 72 lines, 19 branches; C# 10, 86 and 25. Then, held out, a Rust file of 197 lines and a
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
  2. **YAML, TOML, shell commands and the host's workflows:**
     - `scripts/yaml-keys.mjs` (155 lines, no bug), the key read twice that every project's workflow check fails:
       replace with a YAML package carried in the copy, one that reports a key given twice;
     - `scripts/workflow-run.mjs` (395 lines, no bug), which reads the host's workflow format, its expressions and
       its steps for the core's upgrade test alone: replace its YAML (`parseYaml`, `scalar` and the block scalars'
       `block`, about 80 lines) with a package in the core's tests alone, and
       keep its runner until a trial shows a tool that only runs can run the upgrade test where the sessions work;
     - the YAML of `scripts/comment-only.mjs` (`readYaml` and `node`, 135 of its 294 lines, 3 bugs naming the
       script), which proves a change to what runs by itself is only comments: replace with the YAML package carried
       in the copy, once its trial shows it keeps each comment's place;
     - the readers of shell commands: in `scripts/check-configs.mjs` (661 lines in all, no bug), and the commands of
       npm scripts and files in `scripts/licence-commands.mjs` (432 lines, no bug): replace their Bash with the
       parser's Bash grammar (1.4 MB, the tree-sitter organisation's); keep the PowerShell until a grammar of a known
       publisher exists;
     - the matching of file patterns, written three times (`check-configs.mjs`, `workflow-run.mjs`, `select.mjs`,
       about 70 lines together, no bug): replace with one, on Node's own `path.matchesGlob` where its tests show it
       matches the host's filters;
     - the reader of TOML (`scripts/toml.mjs`, 193 lines, coming with #476, which reads Codex's own settings in a
       project): replace with a TOML package carried in the copy, one that refuses a key given twice as the tool does;
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
    `scripts/licence-commands.mjs`, 432, none, its shell commands taken with the second group): replace the reading
    underneath (the lock files, how a licence is written out, and the HTML of `scripts/licence-scan.mjs`'s
    `executable` and `attributesOf`, 52 lines that read a page's script tags and their attributes) with packages or
    each system's own tool, each by a trial, and keep the policy on top (the floor's
    list, the owner's yes, the week's wait, the same publisher, failures that say the mend) the core's own. With 12
    bugs between them, the most of any stand-in, they go with the second group.
  - **Kept:** the finding of copies (`scripts/copies.mjs`, 314 lines, 9 bugs), since what a copy is the core's own
    rule defines; its reading of code goes through the parser once the readers of languages do. Left as they are: the
    readers of the core's own rule files. The core's own mutation tool stood here until 17 November 2026, when #534
    widened this inventory to every part of the core, the mutation tool and the finding of copies weighed again among
    them, in `INVENTORY.md`; the lines above stay the word on the readers inside the checks.
- Judged again on 17 November 2026 (#519): it stands, carried and never fetched while a check runs. A grammar comes
  with the reader that needs it, never all at once, and Microsoft's `@vscode/tree-sitter-wasm` (one publisher's runtime
  and grammars) is weighed as their source when the first arrives (the path's third and fourth steps).
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
- Judged again on 17 November 2026 (#519): it stands. The checker over the 33 fixed bugs that changed a script and
  over 134 fixes inside pull requests, and 33 sessions writing and changing code in each form, found no fault a
  checker would have caught that the tests did not.
- Reopens it: at each pass over these records, the run of #515, point 2, over the fixes made since the last:
  `node scripts/fixes.mjs --since <the day on "Read whole:">` lists each fix of a bug that changed a script that is no
  test, the tree before it and the lines it changed; the checker, fetched into a scratch folder with its install scripts
  off and never into the core, runs on each tree in loose mode and with its checks of null (the settings in #521). It
  reopens where the fixes at whose changed lines a finding points at the fault reach 5, counted over every pass since
  17 November 2026 and written here at each (0 of 33 then); or where a move to one stable entry (#376) renames the
  scripts for its own reasons.

## Choice: the core reaches a project as an exact copy under `core/`, pinned to one commit

- Chosen for: every reader of the rules (Claude Code's imports, another provider's reviewer on GitHub, any other tool)
  reads the repository's own files and installs nothing, and the hooks run the copy that was reviewed (core archive
  165); a pure sync needs no review of its own (floor rule 8).
- Judged again on 17 November 2026 (#519): it stands, one copy for every project, and the core's own tests leave it
  (the path's second step).
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
- Changed on 17 November 2026 (#527, the path's second step): each test stands in `tests/`, which the copy leaves out,
  under its script's name; the folder of scripts stays flat.
- Reopens it: `scripts/` passes 150 files of code, or the shape check (`scripts/shape.mjs`) finds a cycle between them.
- Trips when: `files > 150`, `cycles > 0`

## Choice: the code is built and tested on Linux and on Windows, and on no other platform

- Chosen for: the sessions work on Linux, the owner's projects build on Linux and on Windows (a .NET project as
  Windows holds it), and the suites run on both, so a script that reads paths or line endings fails here first
  (`.github/workflows/tests.yml`).
- Reopens it: a project of the owner's builds on another platform (macOS, say), or a suite cannot run where the
  sessions work.

## Choice: a private project's code is scanned by Semgrep's engine, with the core's own rules

The record of #546, written and argued on 17 November 2026. The trial's samples, invented, its rules for each engine
and its commands are in the pull request that adds this record.

- **Criteria, before the options.**
  1. Finds what a scan must: input that reaches a shell command, `eval`, an SQL string or a file path, and unsafe
     deserialization, in JavaScript and TypeScript and in C#, the starter kit's two kinds, and in Python; on invented
     samples, every planted weakness found, and few false alarms on the safe look-alikes (a literal command, SQL with
     parameters, a constant held in a variable), few enough that a mend in the code clears each.
  2. Fetched by its digest from a registry the cloud's default network allows (npm, PyPI, NuGet), one exact version a
     week old, with no install script (floor rules 7 and 15), never while the check runs (#534, point 5): the default
     network refuses github.com.
  3. Runs wherever the checks run (a cloud session on Linux, x64 and arm64; the host's runners, Linux and Windows; the
     owner's own computer, Linux, Windows or macOS), with no toolchain of the language it reads, nothing installed in
     the project, and no network or report sent while it runs.
  4. Fast enough to be a step of a job that already runs, since it adds no billed job ("Nothing locks a project"): a
     project of 100,000 lines in under 30 seconds on 4 cores.
  5. Licence (floor rule 10): the engine and its rules under a licence the Open Source Initiative approves, with no
     Commons Clause or other source-available terms; no account and no key.
  6. Trust and upkeep: a known publisher, a release in the last 90 days, and as few packages as can be, each looked up
     as #488 asks.
  7. What leaving costs: how much of the check a move to another tool would rewrite.
  8. How well agents work in it: a documented rule format, output a script reads with file and line, and a mark in
     the code that accepts a finding with its reason.
- **The long list,** searched on the web and in the registries on 17 November 2026, each kept or dropped:
  - Opengrep (LGPL-2.1, Semgrep's engine forked): dropped, a fact against 2: its program is published as GitHub
    release assets only; PyPI has no package of the name, and npm's `opengrep` is a 1.0.0 placeholder with no
    licence and no program. Its rules (`opengrep-rules`) carry the Commons Clause on top of LGPL-2.1, against 5.
  - Semgrep Community Edition (LGPL-2.1, on PyPI): **kept.** Its maintained rules are under the "Semgrep Rules License
    v1.0", source-available, against 5 (a fact), so the rules would be the core's own.
  - ast-grep (MIT, on npm, a binary for each system in a package of its own): **kept.** Its one security rule set,
    CodeRabbit's `ast-grep-essentials` (Apache-2.0), was archived in September 2026, against 6 (a fact), so the rules
    would be the core's own.
  - The host's CodeQL command line: dropped, a fact against 5: its terms allow it on open-source code alone, not a
    private repository's.
  - Bearer CLI: dropped, a fact against 5: the Elastic License 2.0.
  - Snyk Code, SonarCloud, DeepSource, Codacy, Aikido: dropped, a fact: hosted services (#534, point 6).
  - SonarQube's community build: dropped, a fact against 3: it needs a server running.
  - Bandit (Apache-2.0, PyPI), `eslint-plugin-security` (Apache-2.0, npm), njsscan (LGPL-3.0, PyPI), Security Code
    Scan and Roslyn's analyzers (.NET): dropped, a fact against 1 and 3: each reads one language, an ESLint plug-in
    is installed in the project, and the .NET ones need the .NET SDK, which the sessions' machine lacks.
  - gosec, Brakeman, SpotBugs with Find Security Bugs, cargo's audits: dropped, a fact against 1: other languages,
    or the dependencies rather than the code.
  - Trivy, OSV-Scanner, Grype: dropped, a fact against 1: they read dependencies, settings and secrets, not the
    code's own flows (the core's licence and lookup checks and gitleaks cover those).
  - Joern (Apache-2.0): dropped, a fact against 2 and 3: GitHub releases only, and a Java runtime needed.
  - Infer: dropped, a fact against 3: it builds the code first, on Linux and macOS alone.
  - Horusec: dropped, a fact against 6: archived.
  - Graudit (GPL-3.0, patterns for grep): dropped, a fact against 2 and 3: GitHub only, and Bash.
  - Microsoft's DevSkim (MIT, a .NET tool on NuGet): dropped, a fact against 3: it needs the .NET runtime, which the
    sessions' machine lacks.
  - No program: **kept**, the plain option, as the issue allows: the record says why none fits, and a private
    project keeps the reviews alone.
- **The options**, each with what would make it the wrong pick.
  - **A. Semgrep CE**, `semgrep` 1.185.0 from PyPI, its rules the core's own, run as
    `semgrep scan --metrics=off --config <the core's rules>`. Wrong where its fetch or its speed cannot fit a step of
    a job that runs, or a machine has no Python 3.10 or later.
  - **B. ast-grep**, `@ast-grep/cli-<system>` 0.51 from npm (the binary's package alone, never the wrapper's, whose
    install script picks it), its rules the core's own, run as `ast-grep scan -c <the core's config> --json`. Wrong
    where matching shapes without following data raises more false alarms than a mend in the code clears.
  - **C. No program,** CodeQL on a public project as now, and the reviews alone on a private one. Wrong where either
    tool finds what the reviews miss at a cost a project can carry.
- **The trial, on the hardest part,** run on the packages themselves, each at one exact version, fetched with install
  scripts off into a scratch folder outside the repository, nothing of them committed. Three invented files, one each
  in JavaScript, C# and Python, hold 15 planted weaknesses (5 a language: a command built from input, directly and
  through a variable; `eval`; SQL by concatenation or formatting, once through a variable in C#; a path joined from
  input; `BinaryFormatter` and `pickle`) and 12 safe look-alikes (a literal command, `execFile` with its arguments,
  SQL with parameters, a constant command or query held in a variable, `ast.literal_eval`, "eval(" in a string and a
  comment). The same rules, 12 of them, were written once for each engine, each by its documented format.
  - A: 15 of 15 found, no false alarm, its rules in taint mode following data from a request or a parameter to the
    call. Fetched: the wheel (72 MB) and 67 packages it brings, 372 MB installed, in 70 seconds; Python 3.10 or later
    needed on the machine; wheels for Linux (x64 and arm64), Windows x64 and macOS on arm64, none for macOS on Intel.
    Speed: 1.5 seconds on the three files; 63 seconds on 104,000 lines (the files copied 2,000 times) on 4 cores.
  - B: 15 of 15 found, 3 false alarms: each a constant command or query held in a variable, one a language, which a
    match of shapes cannot tell from input; one rule had to be written twice before the C# literal was read as one.
    Fetched: one package of 9 MB, a binary of 57 MB, in 1.4 seconds, with nothing else; a package for Linux (x64 and
    arm64, glibc and musl), Windows (x64, arm64 and x86) and macOS (x64 and arm64). Speed: 0.01 seconds on the three
    files; 1.1 seconds on 104,000 lines.
  - C: none found by a check: what the reviews would find was not tried.
  - What was not tried: either engine on Windows or macOS; rules beyond the 12 the trial wrote; real code of a
    project's. Semgrep's engine without its Python wrapper was tried by the blind pick, the challenger and the judge
    (below).
- **Popularity, for what it buys:** both engines are documented at length and released weekly or so (Semgrep 1.185.0
  on 10 November, ast-grep 0.51.3 on 16 November), and agents write both formats from their documentation; neither
  brings a maintained rule set the floor allows, so the rules are the core's whichever is picked.
- **The writer's pick: B, ast-grep.** A finds more exactly, by following data, but its fetch is a Python environment
  of 68 packages, each one to pin and look up, on a machine that must hold Python, with no package for an Intel Mac,
  and a whole project takes it twice the time criterion 4 allows. B is one binary with nothing brought, on every
  system named, at a hundredth of the time, and its false alarms are of one kind, a constant held in a variable, which
  the mend clears by writing the constant in place or marking the line with its reason. A pull request's scan reads
  only the files it changes, where A's time fits too; so what decides is the fetch, the systems and the packages.
- **The case against** (a fresh session, on Opus at high, given this record and the trial's files):
  1. Each engine was scored on the samples its rules were written for. The trial's rules, unchanged, on new samples it
     wrote (15 planted, 12 look-alikes, in JavaScript, TypeScript, C# and Python): A 15 of 15 with no false alarm; B 4
     of 15 with 4 false alarms, missing every TypeScript and Python case (SQL in an f-string, `shell=True` with
     another argument, SQL through a variable, `os.system(f"...")`), JavaScript SQL through a variable, a path from
     `req.params` and a C# command through a variable.
  2. TypeScript, which criterion 1 names, was never tried: a rule of B's for `javascript` never reads a `.ts` file,
     so each needs a copy for TypeScript and one for TSX; one rule of A's covers both.
  3. B's false alarms are not of one kind: a literal path, two literals joined and a constant at a module's top were
     flagged too; widening the shapes to catch the misses adds false alarms, and "write the constant in place" makes
     code worse to suit the tool.
  4. A's fetch was weighed by its wrapper, not its engine: the wheel's `semgrep-core`, unzipped (72 MB fetched in 2.9
     seconds), ran with no Python and none of the 67 packages, and found what the wrapper found. A's real costs: a
     binary of 267 MB, no build for an Intel Mac, and the engine run without its documented command.
  5. The time was the wrapper's default of 3 jobs; the engine alone with 4 took 31.7 seconds on the 104,000 lines,
     6% over the mark, and a pull request's changed files fit.
  6. Upkeep and leaving favour A: ast-grep is at 0.x with one maintainer on npm and its format is read by nothing
     else, where Semgrep's is read by Opengrep too; B needed 14 rules for the trial's 12 before any copy for
     TypeScript.
  7. An Intel Mac is B's one advantage left, and only if the owner's computer is one; a step that says it did not run
     there costs less than a scan that misses 11 of 15.
  8. Mixing was not weighed: Ruff (MIT, one binary on PyPI) carries Bandit's maintained rules for Python beside A for
     the rest, so the core writes fewer.
- **The answer.**
  1. to 3. Taken, and checked: the trial's rules, run again by the writer on the new samples, gave A 15 findings, each
     a planted case, and B 8, none in TypeScript. A shape is not a flow: B finds what its rule's shape names and
     nothing a variable or a format string carries, and the misses are the cases that matter.
  4. Taken: the case against A rested on the wrapper. The engine alone needs no Python and brings no package; the
     command it is run by is the build's to settle, the documented `semgrep` where Python is at hand being the other
     way, by a trial on each system the check runs on before the first project takes it.
  5. Taken: a pull request's scan reads the files it changes, and the whole project is read where a scheduled look
     asks it, where 32 seconds costs nothing billed.
  6. Taken. 7. Taken: a system with no build says the scan did not run there and decides nothing (#534, point 5).
  8. Dropped against 7 and 2, a fact: a second tool is a second fetch, digest, format and update, for Python, which
     neither starter kit's kind is; a Python project of the owner's reopens it.
- **The writer's pick, changed: A, Semgrep's engine.**
- **The blind pick:** A, Semgrep CE, with rules the core writes (a fresh session, on Opus at high, given the problem
  and the criteria alone). Its reasons: taint rules it wrote flagged every planted case in JavaScript and C# and none
  of the literal, constant or parameterised look-alikes; the wheel never runs an install script; the wheel's
  `semgrep-core`, linked as `osemgrep` and run as `scan --experimental --metrics=off --disable-version-check`, ran
  with no Python on Linux x64; 140,800 lines took 18 seconds on 4 cores with 2 rules; the same rules run on
  Opengrep, so leaving is cheap; a finding is accepted with `nosemgrep`. Wrong, it says, where the mode without
  Python, marked experimental, fails on a system (none for Windows on arm64 or an Intel Mac), where a set of about 40
  rules passes 30 seconds, where taint must cross files (the paid engine's), or where its publisher moves more of the
  engine to paid terms, as it did its rules in December 2024. ast-grep was its second, dropped for matching shapes
  alone.
- **Looked for:** the challenger searched npm and PyPI and the web and named five the list lacked. Semgrep's engine
  alone, from the wheel: taken into A (the answer, 4). Ruff (MIT, one binary on PyPI, Bandit's rules for Python):
  dropped against 7, as the answer's 8 says. Biome and oxlint (MIT and Apache-2.0, binaries on npm): dropped, a fact
  against 1: JavaScript and TypeScript alone, with few rules on these weaknesses. GritQL's command line
  (`@getgrit/cli`, MIT): dropped, a fact against 2 and 6: an install script, and no release since March 2025.
  tree-sitter's command line with queries: dropped, a fact against 2: its install script fetches from GitHub. It
  named Datadog's static analyzer and Comby as not on npm or PyPI, from memory, unchecked, and Comby as matching
  shapes as B does: dropped against 2, an assumption, and against 1 with B.
- **The judgment:** the pick stands, A, Semgrep's engine with rules the core writes and keeps (a fresh session, on
  Opus at high, that wrote no part of the record), on a trial it ran rather than the arguments: the 1.185.0 wheel's
  `semgrep-core` and its folder of 26 libraries (272 MB), run with no Python as `osemgrep scan --experimental
  --metrics=off --disable-version-check`, found 30 of the 30 planted cases of both sample sets with the trial's 12
  rules unchanged, TypeScript and Python's f-string included, and no false alarm; 22.7 seconds on the 104,000 lines
  with 4 jobs; the same with the network cut off; and `nosemgrep: <id> -- <reason>` cleared its finding. The engine
  alone answers the fetch that made the writer first pick B, and B's misses rule it out by criterion 1. The mode
  without Python is marked experimental, so the check's test runs these samples against each pinned version and an
  update that misses fails it; where a runner holds Python, the documented `semgrep` is the way back. A system with no
  build (an Intel Mac, Windows on arm64) says the scan did not run there and decides nothing. The paid-terms risk is
  bounded: the rules are the core's, and Opengrep reads them, so leaving is a new fetch, not new rules. That the rules
  are the core's to write is so of every option and decides nothing. One trial is owed, which no machine here could
  run: the same samples, the engine alone, on the host's Windows x64 and macOS arm64 runners, before the first project
  takes the check; where it fails there, those runners take the documented command, and the pick stands.
- **The pick: A, Semgrep's engine, its rules the core's own.** It alone found every planted case on samples its rules
  were not written for. The build (#546) takes the engine and its libraries from the PyPI wheel of one exact version
  a week old, by the wheel's SHA-256 in the core's list, unzipped outside the repository at set-up (a cloud session's
  set-up, and a set-up step of the job a private project already runs), never while the check runs; the check reads a
  pull request's changed files with the core's rules, each rule with a planted and a safe sample in its test, and
  treats a finding as floor rule 9 treats CodeQL's (`floor/topics/weaknesses.md`): one the pull request brings is
  shown for its security review to weigh, a false alarm explained in it, and what stood before is reported. No package comes in but through #488's lookup, and the trial owed above runs first.
- **What a sync asks of a project:** for this record, nothing; the build says what its sync asks.
- Reopens it: a Semgrep release whose engine is not under a licence the Open Source Initiative approves, or that drops
  the engine's mode without Python or the build for a system the check runs on; the samples' test failing after an
  update of the engine; a whole scan with the core's rules taking more than 30 seconds on 100,000 lines on 4 cores;
  no Semgrep release for 90 days; Opengrep publishing its engine on npm or PyPI under LGPL with no Commons Clause; or
  a project of the owner's in Python, or the owner's computer an Intel Mac.
