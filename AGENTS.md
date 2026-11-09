# agent-rules

The shared core of the owner's agent-built projects: a floor every project takes whole and practice modules each
project picks (`README.md`). Every role works from this file, whichever model fills it; Codex: read "For Codex" in
`modules/codex.md` at the start of every task.

## The core this repository takes

The floor whole, and the modules that fit a repository of documents. Read whole at the start of every task (Claude Code
imports them):

@floor/security.md
@modules/how-to-work.md
@modules/inbox.md

Read when needed: `floor/topics.md` (before a task touches one of its topics), `floor/threat-model.md`,
`modules/roles.md`, `modules/helpers.md`, `modules/reviews.md`, `modules/review-guidelines.md`, `modules/codex.md` and
`modules/github-calls.md`. The rest describe work this repository does not do (lanes, milestones, updates, the
orchestrator).

What fills the slots here: the *progress file* and the *report*: this repository's open PRs, and `reports/` (one file
per change, `<date>-<name>.md`); the archive is `archive/instructions.md`, cited "(core archive N)"; the *settling
references*: `README.md` and `archive/instructions.md`; the *descriptions*: `README.md`; the *large file*: past about 50
KB; the *size marks*: about 20 KB for each file a session reads at the start. No other slot applies.

## How changes are made here

- **A change goes on a branch of its own, with a draft PR into `main`, pushed after every commit.** This repository
  has no `develop`. A PR that changes a rule says, for each, what it changes in every project and why.
- **Every PR here changes rule files,** all protected (`floor/security.md`, rule 3), so each gets Codex's code review
  ("Codex reviews" in `modules/reviews.md`) and its security review. **A change to the floor or to `.github/` needs
  the owner's yes in its PR.**
- **The session that writes a change does not merge it:** the design session checks it against every project that
  takes the core, and merges it. It reaches a project only through a sync PR there (`README.md`).
- **A rule moves here only when it holds in every project that takes the core,** and its owner's words come with it,
  word for word, into `archive/instructions.md`. A rule only one project has stays in that project.
- **Nothing personal and nothing exploitable** (`floor/security.md`, rules 1 and 11): the core names no project, except
  in its archive and its reports.
- **The rule-file audit** (point 6 of `modules/workshop-check.md`) runs here, in a PR of its own, whenever more than
  about a fifth of the core's lines changed since the last audit.
- **Usage:** no status line runs here, so `scripts/usage.sh` cannot read usage in this repository; a session uses
  what its environment offers, if any, as "Usage" in `modules/claude.md` says.

## Review guidelines

Every reviewer, Codex's code review included, reads `modules/review-guidelines.md` whole and judges the change by it,
with the floor (`floor/security.md` and `floor/topics.md`). Here, a rule that changes what any project must do without
saying so in the PR is a departure from the PR's description, and blocks.
