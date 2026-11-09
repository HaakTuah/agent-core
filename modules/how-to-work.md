# How to work

The aim, the four pillars and the habits that serve them, for every builder. Read at the start of every task.

Every rule here says what it is for. The aim behind them all: as much finished work of full quality as the week's usage
allows, at the lowest cost now and later. Four are the pillars that hold the rest up: **one fact, one place**, **split
by meaning**, **keep it lean** and **read little**. Every review enforces the first three, and the workshop check
measures what every session reads (core archive 57).

- **A question is a question.** Answer it; act on it only when the owner says so (core archive 25).
- **Match effort to the task,** and take the cheapest approach that does the job well, since usage is limited. Docs,
  READMEs, small fixes and config: one pass, no helpers.
- **Read little.** Read only the sections the task names. Never read a *large file* whole: find what you need with grep
  or the project's tools, then read that line range. Don't re-read what you just edited.
- **Print little.** The project's test and long-run scripts print a summary and the failures, the full log in a file;
  never paste a full log. Run long ones in the background and wait for the completion notice: never poll, and keep no
  agent alive just to wait.
- **Helpers, effort and escalation:** `modules/helpers.md`, `modules/roles.md`, and each tool's own file.
- **Edit in place:** change the lines that need changing; never rewrite a large file to change part of it. **Don't
  loop:** if the same approach fails twice, stop, write down what you tried, and take another approach, hand it to
  escalation, or mark the task blocked in the PR and the *progress file*, with its brief ready for a later session (the
  problem, what was tried, the files and lines), and go on to the next.
- **One fact, one place, everywhere** (core archive 3, 57 and 58): in code, data, tests, docs, rule files and the
  briefs agents are given. Point to where a thing lives and never copy it, whole or as a selection of its lines: every
  copy drifts from the original, and is paid for again on every read. The *copies check*, on every PR, fails a new copy
  of code or of the rule files' prose; its baseline lists the old ones, removed over time and never added to. The one
  place is where the readers who need it look for it, and only the places whose readers need it point to it, since a
  pointer is read too. When a better home appears, because its readers change or its file grows to hold other things,
  it moves there in one PR: every pointer that still makes sense updated, the rest removed, nothing left behind.
- **No description left untrue** (core archive 16 and 64), so no reader meets a text the project no longer matches. A
  change updates, in the same PR, every place that describes
  what it changes, found by searching for its names: the *descriptions*. Each is the one place for its own readers, so
  where two describe one thing, one becomes a pointer to the other. Dated records (the archive, old reports) stay as
  they were. Each milestone PR says in one line whether the README is current, and fixes it if not.
- **Keep it lean** (core archive 24). Every change removes what it replaces, in the same PR: no commented-out code, no
  "old" copies, nothing it made unused (code, files, settings, assets, test helpers). Look for an existing helper before
  writing one. A leftover is a finding in every review.
- **Split by meaning, from the start** (core archive 25 and 26), so each reader reads only what it needs and nothing it
  must read past. Each file
  holds one thing people look up on its own (a system, a screen), as small as that thing is; new work goes into its own
  file as it is written, never into a big file to be split later. Smaller is not better: one thing spread over several
  files costs every reader more. Where a family differs only in part, write the shared part once and each difference as
  an override. Size is only a warning: a file past about 20 KB probably holds more than one thing. A split goes in its
  own PR, with behaviour proven unchanged and what it saves said. **Step 0:** before a task or lane changes a file past
  about 50 KB, that file is split by meaning first, in its own PR; new work for such a file goes in as a new file (core
  archive 45). The workshop check and the file-by-file reviews still run.
- **Principles over rules** (core archive 25). Where a rule's letter would defeat what it is for, follow its purpose,
  say so in the PR under "Readings taken", and flag the rule to be fixed. Never for the floor, nor for a rule the
  project's `AGENTS.md` marks as a safety rule.
- **The smallest setup that tests the rule** (core archive 12), so checks stay fast as the project grows: each test sets
  up only what the rule needs. Full-size runs only in the few tests that guard the whole; long measurements in the
  project's long-run script, never in the suite or CI.
- **Rule files state rules,** never quotes or dated history (a date a measurement or status needs may stay), with at
  most a pointer in the *archive citation* form: every session pays to read them (core archive 25 and 74).
