# The core's choices that are hard to undo

The core's *choice records* (`AGENTS.md`, "The slots here"; `modules/choices.md`), each recorded as it stood when the
rule came.

Read whole: 2026-11-15

## Choice: the scripts in JavaScript on Node, with Node's own modules alone

- Chosen for: a project runs the core's scripts from its copy with nothing installed, so no package of the core's
  needs a licence check, a registry or an install, and the sync runs outside the owner's test box with Node and Git
  alone (`setup/server.md`, point 7). The one exact Node is `.node-version`'s.
- Reopens it: a check the queue asks for cannot be written without a package, or a reader written here by hand to
  stand in for one (`scripts/workflow-run.mjs`'s YAML, 315 lines today) passes 600 lines.

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
- Reopens it: `scripts/` passes 150 files, or the shape check (`scripts/shape.mjs`) finds a cycle between them.

## Choice: the code is built and tested on Linux and on Windows, and on no other platform

- Chosen for: the sessions work on Linux, the owner's projects build on Linux and on Windows (a .NET project as
  Windows holds it), and the suites run on both, so a script that reads paths or line endings fails here first
  (`.github/workflows/tests.yml`).
- Reopens it: a project of the owner's builds on another platform (macOS, say), or a suite cannot run where the
  sessions work.
