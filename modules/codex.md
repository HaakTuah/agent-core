# Claude and Codex

Codex's status, its part, its setup, and what may reach it; Codex reads "For Codex" at the start of every task. Leans
on `modules/roles.md` and `modules/reviews.md`.

Two builders spread the weekly usage, Claude and Codex (OpenAI's), each on its own subscription, and review each other:
different models have different blind spots (core archive 18).

**Status (3 November 2026): Codex reviews, Claude builds.** Codex cannot build yet: its GitHub tasks and its command
line need a "Codex Cloud (Legacy)" environment, which can no longer be created. So no lane goes to Codex until the owner
says it can build; until then all building is Claude's, and `modules/codex-building.md` is dormant. Nothing on the
owner's machine starts Codex, ever (core archive 52): once its tasks work, it is started from the pull request.

## For Codex

- The project's `AGENTS.md` and the files it names apply to you in full; `CLAUDE.md` is Claude Code's own.
- **Helpers:** your subagents, where `modules/helpers.md` says they pay, on the model you run on; list each in your
  report with what it gave.
- Build only what the brief (the PR's description) gives you, and read only what it names and what `AGENTS.md` says.
- **The tests you are given are the contract:** make them pass; never change, skip or weaken them. If you think one is
  wrong, say why in your report and leave that part.
- Run *Codex's checks* before you finish.
- Push your work to the PR's branch, never to `main` or `develop`, and open no new pull request. Never change the
  protected files (`floor/security.md`, rule 3); never put a key or secret anywhere.
- Your environment's setup script installs what the suites need; report anything missing, never work around it.
- **Questions, readings and ideas go to the issues** (`modules/inbox.md`), filed by you with their template's headings,
  label and `HaakTuah` assigned, if your access allows; if not, list them in your report under "Questions for the
  owner", "Ideas" and "Bugs", and the orchestrator files them. Either way the PR carries only the links (core archive
  31).
- Your review of Claude's PRs gives findings by priority (`modules/review-guidelines.md`); every one counts.

## Setup

- Codex on its own subscription, its GitHub app given the owner's repositories, its own Code Review set to automatic
  review off (core archive 18).
- Its security review: Auto security review on, Review "Team PRs", Trigger "On PR open", reporting Medium and above. It
  reads the project's threat model with `floor/threat-model.md` as its threat model, and the project's `SECURITY.md`
  with the floor (`floor/security.md` and `floor/topics.md`) as its instructions. Under this trigger a request runs a
  code review alone; a security review comes with every request only under "Whenever code review runs" (core archive
  51).
- A Codex cloud environment of the newer kind, made in ChatGPT's Codex settings (the *Codex environment*), its setup
  script `bash scripts/cloud-setup.sh` (from `/workspace/<repository>`); tasks by comment fail either way.
- Codex runs on its default model for cloud tasks (none can be chosen); the review scores show whether that is enough.

## What reaches Codex

Only the owner's own work (floor rule 4): a lane goes to Codex only as a PR HaakTuah opened from a branch here, never
`main` or `develop`. A Codex task reads the web, so planted text could try to steer it: a Codex PR that changes a
protected file (floor rule 3) is marked failed, the files named, checked by the orchestrator before any merge (the
compare call), and never merged; the owner decides.
