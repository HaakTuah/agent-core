# Claude's part: models, effort and helpers

Claude Code's model and effort for each role, its helpers and their limits, and its usage. Read by Claude at the start
of every task. What each role does: `modules/roles.md`, `modules/reviews.md`, `modules/helpers.md`.

| Who | Model | Effort | For |
| --- | --- | --- | --- |
| You, the builder | Opus for the main lane, engine rules, design readings and the hard work; Sonnet (`model: "sonnet"`) for routine lanes: polish, docs, splits, tests, news lines | the model and effort you were started at, read against this table (below it) | the task itself |
| Orchestrator | Sonnet if it can set each session's model; Opus if its sessions take its own | medium | starting each lane at its model, watching PRs, merging at the gates |
| Search helper | Haiku (`model: "haiku"`) | as it comes | finding where things are across many files, the cheap way to look; it returns file:line and one-line conclusions |
| Parallel helper | Sonnet (`model: "sonnet"`) for routine parts; Opus (`model: "opus"`) for parts that need design judgement | medium; high (`effort: "high"`) for the hard work | one part of the work, as `modules/helpers.md` says |
| Reviewer | Opus (`model: "opus"`, `effort: "high"`) | high | the fallback reviewer (code and security review) and the blind re-review |
| Design check | Opus (`model: "opus"`, `effort: "high"`) | high | the design checker, in one short call; not Fable, which drains the week's usage far faster (core archive 66) |
| Planning design | Fable (`model: "fable"`, `effort: "high"`) | high | planning design; you build and measure what it returns with Opus |
| Escalation | Opus (`model: "opus"`, `effort: "high"`, or `"xhigh"` if you already run at high or above) | high or extra high | the escalation step, when Codex is unavailable or has failed too (Codex first once it can build) |
| Last escalation | Fable (`model: "fable"`, `effort: "high"`) | high | a problem the escalation step could not solve, with the same brief. Otherwise Fable only for planning design and work the owner gives it by name, since its usage runs out first |

**Fable's fallback:** if Fable is out of usage or unavailable, or the owner says its share for the week is spent, its
call goes to Opus (`model: "opus"`, `effort: "high"`); nothing ever waits for Fable.

- **Usage: Claude keeps the owner's share** (floor rule 16; core archive 1, 2, 14 and 76), since its weekly limit is
  shared with the owner's own work and every project. Work continuously, task after task. **The brake:** from about 85%
  of it no new side lane opens, and open ones finish; from about 90%, no bigger task: finish the one at hand if nearly
  done, or bring it to a clean commit and a draft PR saying what is left; then only small things in the main lane, the
  *progress file* saying where you stopped. Only the measured share counts, never the app's warning. **Measure it** with
  `scripts/usage.sh` at the start and, where it can read it, after every commit; where it cannot (a cloud session
  today), it says so at the start: then check no more, and say nothing about it in any PR, report or message, since the
  owner watches and pauses the work at about 90%.
- **No agent workflows and no ultracode,** except a process the project's own rules name. Long runs go in the
  background with the Bash tool's background mode.
- **Read this table against yourself** (core archive 70 and 71). Your model is named in your system prompt, your effort
  is in `$CLAUDE_EFFORT` (unset: medium); a session another starts takes its model and effort. Models rank Haiku,
  Sonnet, Opus, Fable; efforts low, medium, high, xhigh. A helper is above you when its model ranks
  higher, or its model is yours and its effort higher. A helper for judgement (the hard work, which needs Opus at high;
  planning design; a part that needs design judgement) is called only when it is above you: otherwise you do that work
  yourself, since such a helper adds only a cold start. A helper for a fresh eye on finished work (the reviewer, the
  design check) is used whatever your level, since its worth is that it did not write the work. An escalation step is a
  fresh solver: one below your level is skipped, except the last, which runs at your level instead; one at your level
  still pays, for its fresh eye. A helper for cost (search, routine parts) is used whatever your level. You can't change
  your own model or effort; if you are not on Opus, say so in your first message. A problem that beats you twice goes
  up the escalation chain; if its last step fails too, or Fable is unavailable, it is blocked ("Don't loop"); say so.
- **Sonnet builds, Opus backs it** (core archive 73). A Sonnet builder hands what needs judgement to an Opus helper at
  high, and a lane that turns out to need it whole goes back to the orchestrator for an Opus builder; a problem that
  beats it twice escalates as for anyone. Its PR's first line says Sonnet built it, and it gets the design check
  whenever it changes behaviour, rules or text a user reads, besides the reviews every PR gets. The workshop check
  compares review rounds and usage per lane by model: a kind of lane where Sonnet needs more rounds to reach a 10 goes
  back to Opus.
- **A helper above you gets only what needs it,** Fable above all, since its usage runs out first: you do the work before it (finding, measuring, and a
  brief that points it only at what it must judge) and after it (building, testing, writing up); it returns its design,
  answer or text and stops.
- Sessions started from a Claude Code Project don't load `.claude/agents/`, so always pass `model` (and `effort`) in the
  call. Never max effort: it costs the most and tends to overthink.
- **The work-saved hook** (`.claude/hooks/work-saved.sh`, run as merged into `develop`): a session starts with a report
  of anything uncommitted, unpushed or stashed, and a reply that would end with any of it gets one nudge to push it, or
  say why it must stay; it runs after every reply, so a builder pushes after each step (core archive 59).
