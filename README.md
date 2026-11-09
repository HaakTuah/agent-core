# agent-rules

The rules shared by the owner's agent-built projects, written once so that a change to them is made once and every
project takes it the same way (core archive 68). Each rule says what it is for; the owner's words behind each are in
`archive/instructions.md`, word for word.

## Two layers

- **The floor** (`floor/`): what protects the owner's accounts, repositories, systems, money, privacy and rights, and
  what cannot be undone. Every project takes it whole and never edits or leaves out any part of it; no rule of a
  project's own, and no reading of a rule's purpose ("Principles over rules"), loosens it. It points to no module, so a
  project that takes only the floor is safe with nothing else (core archive 75). When unsure whether a rule belongs
  here, ask: if a project dropped it, could the owner be harmed or something be lost for good? Then it is floor.
  - `floor/security.md`: rules 1 to 13 and how to report a weakness.
  - `floor/threat-model.md`: who might attack, what is protected and the ways in, the part every project shares.
- **The practice modules** (`modules/`): everything else the projects share, one file per thing a reader looks up on its
  own, each saying at its top what it is for, when it is read and which others it leans on. A project picks the modules
  it takes.
  - Read at the start of every task: `how-to-work.md` (the aim, the four pillars, the habits), `inbox.md` (questions,
    readings, ideas, bugs, and the owner's words), `work-flow.md` (reviews in the background, lanes, sessions),
    `git.md` (branches, pushes, milestones), `usage.md` (measuring usage, the brake) and, for Claude, `claude.md`
    (models, effort, helpers).
  - Read when needed: `roles.md` (who does what, escalation, who merges), `helpers.md` (when helpers pay),
    `reviews.md` (which review, the security gate, only a 10 passes), `review-guidelines.md` (what reviewers judge by),
    `codex.md` (Codex's status, "For Codex", setup), `codex-building.md` (dormant until Codex can build),
    `orchestrating.md` (the orchestrator), `github-calls.md` (REST calls from a cloud session), `updates.md` (versions,
    Node, CodeQL) and `workshop-check.md` (the weekly check).

## How a project takes the core

1. **An exact copy under `core/`,** pinned to one commit of this repository, generated and never edited by hand. A
   change reaches a project only through a sync PR in that project, which moves the pin, is reviewed like any other PR,
   and changes nothing else; a check in the project fails a PR whose `core/` differs from this repository at its pin.
2. **A manifest of its own,** `core-manifest.md` at its root (format below): the pin, the modules it takes, its names
   for the core's words, and what fills each slot. Every session reads it at the start, with the floor.
3. **Pointer lines.** Its `AGENTS.md` names, as plain lines of their own (not in a table or a code block), the manifest
   and every file read at the start of every task: Claude Code imports them as `@` lines through `CLAUDE.md`, which
   imports `AGENTS.md` (and `core/modules/claude.md`); Codex, which follows no imports, reads them because `AGENTS.md`
   tells it to. `AGENTS.md` keeps its own "Review guidelines" section, which Codex's review reads, pointing to
   `core/modules/review-guidelines.md` and the project's own guidelines.
4. **Its own security files.** Its `SECURITY.md` says the floor's rules hold whole and adds, under the same numbers,
   what the floor leaves to it (the protected files, the trusted builder, its inputs, what ships, its audit), and points
   to "Reporting a weakness" in the floor, since GitHub shows a repository's `SECURITY.md`. Its threat model adds its
   users, its ways in and its lower stakes. Codex's security review is set to read both, with the floor's.
5. **What only it has** stays in its own rule files: what it is, its commands, its queue, its own standing rules (a rule
   marked there as a safety rule is out of reach of "Principles over rules", as the floor is), each file cut to that,
   with pointers into `core/`.

## Slots

The core says what every project says alike; where projects differ only in a name, a path or an example, it leaves a
**slot**, written in italics (*progress file*), and each project's manifest says what fills it. A path the core names
outright (`develop`, `main`, `scripts/usage.sh`, `scripts/cloud-setup.sh`, `docs/calibration.md`,
`docs/archive/instructions.md`, `.github/ISSUE_TEMPLATE/`) is where both games keep it; a project that keeps it
elsewhere says so in its manifest. A task is a project's unit of work (an item, an entry); the main lane is its queue of
tasks taken in order.

| Slot | What the project fills in |
| --- | --- |
| *progress file* | the file that holds the queue and what is done |
| *report* | where a task's report, with its "Readings taken", goes |
| *archive citation* | how a rule file cites the project's archive |
| *settling references* | what a builder checks a question against before it goes to the owner |
| *descriptions* | every place that describes what a change changes, for each kind of reader |
| *copies check* | the check on every PR that fails a new copy |
| *large file* | how large a file is before it is never read whole |
| *size marks* | the marks of the files every session reads |
| *one at a time* | what never runs as parallel lanes |
| *milestone due* | when a milestone PR is due |
| *design-checked PRs* | which PRs get the design check besides the code review |
| *review reference* | what reviewers judge the work against besides the task's text |
| *planning design* | what planning design plans |
| *hard work* | what counts as the hard work |
| *measurements* | how a claim about behaviour is measured |
| *slop bar* | the bar for text users read, and where the monthly slop check's finds are fixed |
| *major version checks* | the extra checks a new major version gets |
| *Codex's checks* | what Codex runs before it finishes |
| *Codex environment* | whether a Codex cloud environment exists for the project |

## The manifest's format

```markdown
# Core manifest

Core: HaakTuah/agent-rules at <full commit SHA>, copied whole under core/ (never edited here).
Floor: whole. Modules: <all, or the list of those taken>.

## Names
<the project's names for the core's words, one line each: a task, the main lane>

## Slots
| Slot | Here |
| --- | --- |
<one row per slot above, its value here; a slot left out means the project has no such thing>
```

## This repository

The core takes its own floor and the modules that fit a repository of documents (`AGENTS.md`). A change to the floor
needs the owner's yes in its PR. Nothing personal and nothing exploitable is ever written here (`floor/security.md`,
rules 1 and 11); the core names no project except in its archive and its reports (`reports/`).
