# Agent tools

Read when a project sets up an agent tool, hands a role to one or changes its tool mid-task, and when a tool's staged
run is due. Which tool takes which role: `modules/roles.md`, "Tools are preferences".

**One door in: `AGENTS.md`** (core archive 231; #249). By default every rule a session must know is reachable from the
project's `AGENTS.md` in plain sentences, its `@` lines naming the files read at the start of every task. A tool that
reads a file of its own first gets a small entry file that pulls in each file those lines name, with its own part: the
starter kit writes them (`CLAUDE.md`, `.kiro/steering/core.md`, `.agents/rules/core.md`), and a tool that reads
`AGENTS.md` alone, as Codex does, needs none. Where a pull request adds a file to `AGENTS.md`'s `@` lines, its builder
adds it to each entry file in that pull request. It does not mean a project keeps an entry file for a tool it never
uses (it declares the one it deletes under "Differences"). Reason: the `@` lines are Claude Code's import, so another
tool opened the files they name only by discipline. Held by `scripts/entry-files.mjs`, which fails an entry file that
pulls in less than `AGENTS.md` names.

**Hooks save time; checks are the guarantee** (core archive 231). By default no rule is held by a hook alone: what a
tool's hook holds is also held where the tool does not matter, by a check on the pull request, a staged case or the
daily look. Where a rule's only holder in `scripts/holders.json` is a hook, `scripts/holders.mjs` lists it in the core's
monthly state report as held by none, until another holder is named. Each hook is carried to every tool whose
documentation gives its event, as the tool's part says, the starter kit writing it; the helper hook reads Claude Code's
own helper tool, so it goes to no other. It does not mean a hook is taken out: it still saves a session the work a
failing check would cost. Nor does a session review a change to a tool's own folder with that tool open on the branch,
whose hooks would run as they stand there: it reads the diff. Reason: a session of a tool with no hooks must meet the
same rules.

**A change of tool loses nothing** (core archive 231). The state of a task is in the repository and never only in a
session: its branch, pushed after every commit, its pull request's description with the note where to pick up, its
line in the *progress file* and what it waits on (`modules/git.md`). Where a builder's tool stops (its usage spent,
say), a fresh builder of any tool picks up from the branch (`modules/orchestrating.md`, "A stalled lane"). It does not
mean that the tool that stopped hands over by itself. Reason: when one provider's usage ran out, everything held only
in its sessions stopped with them. Held, in part, by `scripts/stalled.mjs`, which the look and the orchestrator run.

**Proven by the staged cases, tool by tool** (core archive 231; `AGENTS.md`, "Staged cases hold what no check
reads"). A tool works with the core once a session of it has passed every staged case (`node scripts/staged.mjs
--read <case> <folder> --record --tool <its name>`), and that stands until the next release, at which its cases are
due again. Until then the core says of the tool only what its documentation says, naming where and the day it was
read. Whoever works in that tool runs them, a session the orchestrator starts where it can reach the tool; the first is
a scratch project opened in Kiro. It does not mean a tool is refused a role before it has passed. Reason: a tool's
documentation says what it reads, not whether its model keeps the rules, and the tools change monthly. Held by
`scripts/staged.mjs`, which says each tool's standing, the release's notes too, and names the cases due for each.

**Each tool's part** (core archive 231): how it is handed a task, how it is asked for a review, what it cannot do that a
rule needs, and its own folders, which floor rule 3 protects by name; the model it runs at is the project's "Pace", or
`modules/claude.md` for Claude. A tool with no review app on the host is asked for a review by a fresh session of it
given the review's brief (`modules/reviews.md`, point 7) and told to change nothing; its answer is posted on the PR in a
comment that opens "Code review:" or "Security review:". The parts: `modules/claude.md`, `modules/codex.md`,
`modules/copilot.md`, `modules/kiro.md` and `modules/antigravity.md`. A project whose tool has none names in its
manifest's "Tools" table how it is reached, and files the part with the core (`README.md`, "Reporting to the core").
Reason: a project with only that tool otherwise had no word on how to reach it. Held by nothing yet.
