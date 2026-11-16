# Can each tool's own rule file be written from the one source? (16 November 2026)

The second of the two things `#304` asks to be looked into when it is built (its point 6), with a short report and no
rule. It changes no rule. Read: `scripts/entry-files.mjs`, the starter kit's three entry templates, and each tool's
part (`modules/kiro.md`, `modules/antigravity.md`, `modules/codex.md`), which hold what the tools' documentation said
on 15 November 2026.

## The answer

**It can, with about twenty-five lines, and it is worth doing only as the mend of the check that already holds
them.** Everything a writer needs but two lines a tool is in `scripts/entry-files.mjs` today.

## What the one source already holds

`AGENTS.md`'s `@` lines are the one list (`modules/tools.md`, "One door in"). For each tool that reads a file of its
own first, `ENTRY` in `scripts/entry-files.mjs` holds where its entry file lies, the form of the line that pulls in one
file (`@<path>` for Claude Code, `#[[file:<path>]]` for Kiro, `@[<name>](<path>)` for Antigravity, from the rule's own
folder) and the front matter without which the tool would not load it at a session's start. The check compares each
entry file with the list and fails one that pulls in less, saying the line to add: it is a writer run backwards.

What `ENTRY` lacks is small and fixed for each tool: a heading and a sentence, and the two files the tool's sessions
read that `AGENTS.md` does not name on an `@` line (`modules/other-builders.md` and the tool's own part; for Claude
Code, `modules/claude.md`). Codex reads `AGENTS.md` alone and has no entry file; Copilot's documentation says it reads
`AGENTS.md` too.

## What a writer would change

- The starter kit's three entry templates (`CLAUDE.md.tmpl`, `kiro-steering.md.tmpl`, `antigravity-rule.md.tmpl`)
  would go: `scripts/init.mjs` would write each file from the list, and the list would stand in the `AGENTS.md`
  template alone.
- The check's failure would say one command in place of a line for each file: "Mend: run
  `node core/scripts/entry-files.mjs --write`".
- A builder that adds a file to `AGENTS.md`'s `@` lines would change one file by hand and not up to four.

## What it would cost

- **A project's own lines in an entry file.** The check asks that an entry file pulls in no less than the list, so a
  project may add to one today. A writer that rewrites the file whole would take those lines out; one that keeps them
  needs a marked part of the file that is the script's, which each tool must still load whole.
- **A written file is still a protected file.** An entry file is what a tool takes its instructions from (floor rule
  3): the pull request that carries the rewritten file is reviewed like any other, so the writer saves typing and no
  review.
- **The list is about to change rarely.** With `#304` built, a role's start is its own file and what that names, and
  the modules a task calls for are found by the reading script: a new module joins no `@` line. The edit a writer would
  save comes up a few times a year.

## What is left open

Kiro's and Antigravity's parts rest on their documentation alone until each has passed the staged cases, so a writer's
output for them is proven no further than the templates are today (`#400`). If a writer is built, the natural place is
`scripts/entry-files.mjs` itself, beside the check, with the upgrade test proving that a project written by an earlier
kit holds the same three files after it runs. That is an idea for a line of its own, not part of `#304`.
