# How to work

How every builder works, whichever model fills the role: the aim, the four pillars and the habits that serve them. Read
at the start of every task.

Every rule here says what it is for. The aim behind them all: as much finished work of full quality as the week's usage
allows, at the lowest cost now and later. Four of them are the pillars that hold the rest up: **one fact, one place**,
**split by meaning**, **keep it lean** and **read little**. Every review enforces the first three ("What blocks" in
`modules/review-guidelines.md`), and the workshop check measures what every session reads (core archive 57).

- **A question is a question.** Answer it; act on it only when the owner says so (core archive 25).
- **Match effort to the task,** and take the cheapest approach that does the job well, since usage is limited. Docs,
  READMEs, small fixes and config: one pass, no helpers.
- **Read little.** Never read a large file (the project's *large file*) whole: find what you need with grep or the
  project's own tools, then read that line range. Don't re-read what you just edited.
- **Print little.** The project's test and long-run scripts (its Commands) print a summary and the failures and keep
  the full log in a file; never paste a full log into the conversation. Run long ones in the background (for Claude:
  `modules/claude.md`) and wait for the completion notice: never poll, and keep no agent alive just to wait.
- **Helpers, effort and escalation:** the roles, escalation and the hard work: `modules/roles.md`; when a helper pays:
  `modules/helpers.md`; each tool's own models and effort: its own file (Claude Code's: `modules/claude.md`; Codex's:
  "For Codex" in `modules/codex.md`).
- **Edit in place.** Change the lines that need changing; never rewrite a large file to change part of it.
- **Don't loop.** If the same approach fails twice, stop, write down what you tried, and take another approach, hand it
  to escalation, or mark the task blocked in the PR and the *progress file*, with its brief ready for a later session
  (the problem, what was tried, the files and lines), and go on to the next.
- **One fact, one place, everywhere** (core archive 3, 57 and 58): in code, data, tests, docs, rule files and the
  briefs agents are given. Point to where a thing lives and never copy it, whole or as a selection of its lines: every
  copy drifts from the original, and is paid for again on every read. The *copies check*, on every PR, fails a new copy
  of code or of the rule files' prose; its baseline lists the old ones, which are removed over time and never added to.
  The one place is where the readers who need it look for it ("Split by meaning"), and only the places whose readers
  need it point to it, since a pointer is read too. When a better home appears, because its readers change or the file
  it sits in grows to hold other things, it moves there in one PR: every pointer that still makes sense updated, the
  rest removed, nothing left behind in the old place.
- **No description left untrue** (core archive 16 and 64), so no reader meets a text the project no longer matches. A
  change updates, in the same PR, every place that describes what it changes, found by searching for its names: the
  project's *descriptions*. Each of those is the one place for its own readers, so where two describe one thing, one
  becomes a pointer to the other. Dated records (the archive, old reports) stay as they were. Each milestone PR says in
  one line whether the README is current, and fixes it if not.
- **Keep it lean** (core archive 24). Every change removes what it replaces, in the same PR: no commented-out code, no
  "old" copies, nothing it made unused (code, files, settings, assets, test helpers). Look for an existing helper
  before writing one. A leftover is a finding in every review.
- **Split by meaning, from the start** (core archive 25 and 26), so each reader reads only what it needs and nothing it
  must read past. Each file holds one thing people look up on its own (a system, a screen, a character), as small as
  that thing is; new work goes into its own file as it is written, never into a big file to be split later. Smaller is
  not better: one thing spread over several files costs every reader more. Where a family differs only in part, write
  the shared part once and each difference as an override. Size is only a warning: a file past about 20 KB probably
  holds more than one thing. Splitting an existing file goes in its own PR, with behaviour proven unchanged and what it
  saves said in the PR. **Step 0:** before a task or lane changes a file past about 50 KB, that file is split by meaning
  first, in its own PR; and new work for a file past the mark goes in as a new file, never as more lines in it (core
  archive 45). The workshop check and the file-by-file reviews still run.
- **Principles over rules** (core archive 25). Where a rule's letter would defeat what it is for, follow its purpose,
  say so in the PR under "Readings taken", and flag the rule to be fixed. Never for the floor (`floor/security.md`),
  nor for a rule the project's AGENTS.md marks as a safety rule.
- **The smallest setup that tests the rule** (core archive 12), so checks stay fast as the project grows: every test
  sets up only what the rule needs. Full-size runs only in the few tests that guard the whole, and long measurements
  run in the project's long-run script, never in the suite or CI.
- **Rule files state rules,** never quotes or dated history (a date a measurement or a status needs may stay), with at
  most a pointer to the archive in the project's *archive citation* form: every session pays to read them, and the
  archive keeps the owner's words (core archive 25 and 74).
