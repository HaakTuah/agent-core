# The core's choices that are hard to undo

The core's *choice records* (`AGENTS.md`, "The slots here"; `tasks/choices.md`), each recorded as it stood when the
rule came.

Read whole: 2026-11-15

## Choice: the scripts in JavaScript on Node, with nothing installed in a project

- Chosen for: a project runs the core's scripts from its copy with nothing installed, so no package of the core's
  needs a licence check, a registry or an install, and the sync runs outside the owner's test box with Node and Git
  alone (`setup/server.md`, point 7). The one exact Node is `.node-version`'s.
- Reopened on 16 November 2026 (#486, point 3), its sign having tripped: the readers written here by hand to stand in
  for a parser passed 600 lines (`scripts/code-shape.mjs`'s lexer, `scripts/shape-csharp.mjs` and
  `scripts/shape-python.mjs`, 1,587 lines), and a reader for Rust was asked for. What stands: the scripts in
  JavaScript, run by the pinned Node from the copy, with nothing installed in a project and Node's own modules for all
  but one thing, as the record below on types weighs again. What gives way: a language's structure is read by one
  parser fetched by its digest, the record below.
- Reopens it: a check the queue asks for needs a package other than that parser, or a reader written here by hand of a
  format, not a language (YAML: `scripts/workflow-run.mjs` and `scripts/yaml-keys.mjs`, 550 lines today), passes 800
  lines.

## Choice: one parser, tree-sitter, reads every language's structure, fetched by its digest

The record of #486, point 2, written and argued on 16 November 2026. The trial's samples, invented, and its commands
are in the pull request that adds this record.

- **Criteria, before the options.**
  1. Exact counts: functions, their lines and their branching as the shape check defines them, matching a count taken
     by hand on code written to trip a reader (a brace in a string, a comment or a character; a raw string; a
     lifetime; a closure; a guard; a switch expression), in Rust and in C#: every number, no misread.
  2. A new language costs hours, not days: each check written once, and a few lines for each language. Today each
     language takes a lexer of its own (`scripts/shape-csharp.mjs`, 318 lines; `scripts/shape-python.mjs`, 388).
  3. Runs wherever the checks run (a cloud session, Actions, the owner's computer, Linux and Windows) with nothing
     installed in a project and no toolchain of the language read: the core's checks read a .NET project's code where
     no .NET is installed.
  4. Fast enough to read a project whole on each pull request: 100,000 lines in under 5 seconds.
  5. Trust and upkeep (floor rules 7, 10 and 15): one exact version, a known publisher, its source checked on each
     update, a licence free to use; what no one reviews by reading kept as small and as few as can be.
  6. What leaving costs: how much of the checks a move away would rewrite.
  7. How well agents work in it: what a builder must know to add a language or a measure.
- **The options**, each with what would make it the wrong pick.
  - **A. Readers written by hand for each language and check, as now.** Wrong where a language's lexer keeps
    misreading, or each language costs days.
  - **B. One parser for many languages, tree-sitter** (MIT; the tree-sitter organisation's own runtime and grammars on
    npm, the runtime with provenance): `web-tree-sitter` (a JavaScript file of 155 KB and a WebAssembly file of 211 KB),
    and one WebAssembly grammar for each language (Rust 1.1 MB, C# 5.4 MB), run by Node's own WebAssembly. Wrong where
    a grammar misparses common code, or its files cannot be checked as floor rule 7 asks.
  - **C. Each language's own tooling** (Rust's compiler and Clippy, C#'s Roslyn, Python's own `ast`), run where it is
    installed. Wrong where the toolchain is missing where the checks run, or its measures cannot be set to the core's.
- **The trial, on the hardest part:** a Rust file of 87 lines and a C# file of 104, invented to trip a reader, counted
  by hand first: Rust 11 functions, 72 lines, 19 branches; C# 10 functions, 86 lines, 25 branches.
  - A: on C#, the core's reader found all 10 functions; its lines came to 77, since it counts from the opening brace
    (a definition, not a misread), and its branches to 23, since it counts no `when` guard. On Rust there is no reader;
    one would need its own lexer (a lifetime that looks like a character, a raw string, a `||` that opens a closure and
    is no "or").
  - B: Rust 11, 72 and 19, and C# 10, 86 and 25, every function exact, with no parse error. The definition was about
    ten lines a language, written against the node types the grammar lists. It loaded in 30 ms, and parsed 87,000
    lines of Rust in 0.66 s, where the core's C# reader takes 0.69 s for 104,000 lines of C#.
  - C: Clippy, its limits at 0, reported 13 functions (every closure, `|| true` too), lines of the body without braces
    or blank lines, and cognitive complexity in place of branches, none of which it lets the core define; it compiled
    the crate first. Roslyn needs the .NET SDK, which the machine the sessions work on lacks: C# could not be counted
    there at all.
- **Popularity, for what it buys:** the tree-sitter organisation keeps the grammars of Rust, C#, Python, JavaScript and
  TypeScript, so the next language a project picks likely has one kept by the same publisher. Godot's own language has
  only an outside author's grammar, whose upkeep is unknown.
- **The case against** (a fresh session, on Opus at high, given this record): CHALLENGE.
- **The answer:** ANSWER.
- **The pick: B.** It alone met criteria 1 and 3 together: exact counts in both languages from about ten lines each,
  with no toolchain. How it is carried: the runtime and each grammar at one exact version, fetched from the npm
  registry with their SHA-256 written in one file of the core, as `scripts/node.sh` fetches Node: never installed,
  never committed, no install script run, and a project fetches only the grammars of the languages its code holds.
  Where the fetch cannot run, the check says what it could not read and fails nothing ("Nothing locks a project"). A
  new version passes floor rule 7's check of its source; the WebAssembly itself no one reads, so the check rests on
  the publisher, the registry's signature, the provenance where the old version had it, and the grammar's source diff
  read against its release notes. The readers by hand that work (JavaScript, C#, Python) stay until the parser
  replaces each, a line each; Rust's is the first built this way, and #426's .NET readers the next.
- **What a sync asks of a project:** for this record, nothing. The line that builds the first reader the picked way
  says what its sync asks; by this record, at most a host to reach (the npm registry, which `scripts/node.sh` already
  reaches) and a reader's new findings listed in the check's baseline, as any new reading is.
- Reopens it: a grammar a project of the owner's needs is missing or fails to parse more than 1 file in 100 of that
  project's code, the runtime's next version cannot pass floor rule 7's check of its source, or the grammars one
  project fetches pass 20 MB.

## Choice: the core's scripts stay in JavaScript with no type checker

The same record weighs types for the core's own scripts (#486, point 4), written and argued with the one above.

- **Criteria, before the options.**
  1. Faults found that the tests and the reviews miss, counted in the scripts that change most.
  2. Its cost: annotations to write, a checker to keep as a dependency, time added to the tests.
  3. Nothing breaks in a project: projects call each of the 92 scripts by its path, and run them with the pinned Node
     where `scripts/node.sh` installs it and with the machine's own where it cannot.
  4. How well agents read and write it.
- **The options**, each with what would make it the wrong pick.
  - **A. As they are:** JavaScript, nothing that checks a value's shape. Wrong where faults a checker catches reach
    `main`.
  - **B. JavaScript with types in comments,** names unchanged, checked by TypeScript's checker in the core's own tests
    alone. Wrong where the annotations and the checker cost more than the faults they catch.
  - **C. TypeScript run directly by the pinned Node,** with no build, behind one stable entry (#376). Wrong where a
    project's Node cannot run it, or the renames break a project's calls.
- **The trial.**
  - The pinned Node (26.13.0, its binary checked against `scripts/node.sh`'s sum) ran a TypeScript file directly, five
    runs of five, with no warning, and a `.mjs` file importing it; it refused an `enum` ("not supported in strip-only
    mode"), and has no flag to transform one. The Node 22.23.4 and 24.22.1 installed here did the same. Node strips the
    types and checks none: C checks nothing unless B's checker runs too.
  - The checker (TypeScript 6.0.2, with Node's types 26.6.6) on the ten scripts changed most in 2026 (`steps`,
    `check-configs`, `copies`, `size`, `security-review`, `workflow-run`, `steps-stage`, `pr-description`, `shape`,
    `look`: 3,935 lines): with no annotation and `strict` off, 14 findings, none a fault, each a pattern it cannot
    follow (a property set on a Map or an array, a variable that changes from an array to a Set, a parameter's default
    read as its type, a comment it misreads). With `strict` on, 1,001 findings, 880 of them a value with no declared
    type: about one annotation for every four and a half lines before it says anything more.
  - The bugs filed against the scripts in the last two weeks (#240, #274, #371, #386, #423, #444, #446) are, by their
    text, input read short (a file, a link, a path or a property not followed); none is a value of the wrong kind.
- **The case against** (the same challenger): CHALLENGE4.
- **The answer:** ANSWER4.
- **The pick: A.** On this trial a checker finds nothing the tests miss until about 880 annotations are written into ten
  scripts, and it would be the core's first dependency; C adds to that a rename of every path a project calls. So
  point 5 of #486 has no steps to take while this stands.
- **What a sync asks of a project:** nothing.
- Reopens it: three bugs that reach `main` in one quarter whose fix corrects a value's kind or a property's name, or a
  move to one stable entry (#376) that renames the scripts for its own reasons.

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
