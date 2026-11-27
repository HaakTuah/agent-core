# Agent tools

Read when a project sets up an agent tool, hands a role to one or changes its tool mid-task, and when a tool's staged
run is due: the kind `tool`; by a session that stops a task before its end, for its hand-off note: the kind
`hand-off`; by an orchestrator and whoever starts one, for its lease: the kind `orchestrator`; the paths `CLAUDE.md`, `.claude/`, `.kiro/`, `.agents/` and `.codex/`. Which tool takes
which role: `tasks/roles.md`, "Tools are preferences". What lies around a tool's session, the cloud, a tool that runs
the agents side by side or a plain terminal, is a way, no tool, with no column below: `tasks/ways.md`.

**One door in: `AGENTS.md`** (#249). By default every rule a session must know is reachable from the
project's `AGENTS.md` in plain sentences, its `@` lines naming the files a builder reads at the start of every task. A
tool that
reads a file of its own first gets a small entry file that pulls in each file those lines name, with its own part: the
starter kit writes them (`CLAUDE.md`, `.kiro/steering/core.md`, `.agents/rules/core.md`), and a tool that reads
`AGENTS.md` alone, as Codex does, needs none. Where a pull request adds a file to `AGENTS.md`'s `@` lines, its builder
adds it to each entry file in that pull request. It does not mean a project keeps an entry file for a tool it never
uses (it declares the one it deletes under "Differences"). Reason: the `@` lines are Claude Code's import, so another
tool opened the files they name only by discipline. Held by `scripts/entry-files.mjs`, which fails an entry file that
pulls in less than `AGENTS.md` names.

**One script says what to read** (#304). By default a session of any agent tool finds what it reads
by one command, which the project's `AGENTS.md` names: `scripts/reading.mjs`, given a role and a task (its issue, its
kinds, or the paths changed so far), prints the role's start (`tasks/roles.md`, "A file for each role") and the
modules the task calls for, each module saying in its opening line when it is read, in words the script matches: a
kind of task, a path, a tool. It does not mean a tool needs a way of its own to find them (where it has a hook at a
session's start, the work-saved hook there calls the script and names what the branch's changed paths call for;
where it has none, the door's sentence is all), nor that an entry file stops pulling in a builder's start, nor that
the floor is ever left to a pick: `floor/security.md` is read whole by every session.
Reason: each tool found the rules its own way, and a session left to judge what it needs read everything or missed
one. Held, in part, by `scripts/reading.mjs --check`, which fails a module or a role's file that does not say when it
is read; that a session then opens what is printed, by nothing yet.

**Hooks save time; checks are the guarantee.** By default no rule is held by a hook alone: what a
tool's hook holds is also held where the tool does not matter, by a check on the pull request, a staged case or the
daily look. Where a rule's only holder in `scripts/holders/` is a hook, `scripts/holders.mjs` lists it in the core's
monthly state report as held by none, until another holder is named. Each hook is carried to every tool whose
documentation gives its event, as the tool's part says, the starter kit writing it; the helper hook reads Claude Code's
own helper tool, so it goes to no other. It does not mean a hook is taken out: it still saves a session the work a
failing check would cost. Nor does a session review a change to a tool's own folder with that tool open on the branch,
whose hooks would run as they stand there: it reads the diff. Reason: a session of a tool with no hooks must meet the
same rules.

**A change of tool loses nothing.** The state of a task is in the repository and never only in a
session: its branch, pushed after every commit, each naming the next step, its pull request's description with its hand-off note, its line in the
*progress file* and what it waits on (`roles/shared/work-flow.md`). A builder keeps the note current at each passed
gate (checks green, a review answered), in the edit that gate already brings to its description, and a session that
stops mid-task, at a limit or the stop switch, writes it (#306; #1106): a line "Hand-off:", then what is done, what was
tried and failed, what is next, and how to check it. Where a builder's tool stops (its usage spent, say), a fresh builder of any tool
picks up from the branch, reading the note first, or with none its newest commit's next step (`roles/orchestrator.md`, "A stalled lane"). It does not mean that
the tool that stopped hands over by itself, nor a note where the task ends merged. Reason: when one provider's usage ran
out, everything held only in its sessions stopped with them, and a lane handed over from its branch alone shows the
code and none of what was tried and failed, so the next builder tries it again. Held, in part,
by `scripts/stalled.mjs`, which the look and the orchestrator run, and which marks a stalled lane with no note.

**Each pushed commit names its next step** (#1505, point 1). By default every commit a builder pushes to its task's
branch holds a line of its message that opens `Next:` and names the task's next step (`Next: the code review`), so a
session that stops without warning, at a usage limit or a hard stop, leaves its next step on its branch. Nothing
changes it. It does not mean a commit is made only to say it, that a pull request's description is edited for it
(`roles/shared/work-flow.md`, on a description's edits; #829), nor that a merge of the base into the branch, or a
commit the host or Dependabot makes, carries one; a session that stops at a gate still
writes its hand-off note. Reason: on 26 November 2026 a hard stop ended one account's sessions mid-work, and the next
steps of four drafts, written once at the end and never pushed, were lost. Held, in part, by `scripts/stalled.mjs`,
which marks a stalled lane whose newest commit names no next step.

**One orchestrator works a queue, by a lease, with its hand-off beside it** (#1106). By default a project's queue has
one orchestrator, which holds its lease: one issue of the project's, labelled `orchestrator`, whose newest lease comment
from the *owner's account* names the session that holds the queue, its tool and its builders running, its time the
host's (`core/scripts/lease.mjs` writes and reads it). Nothing changes it.
- At every wake, before anything else, the orchestrator runs `core/scripts/lease.mjs --session <its own> --tool
  <its tool> --builders <how many run>`: where it prints "Stop:" (another session woke within the lease's term, three
  hours, a first guess, or a hand-over note there names another or replaced its own lease), it deletes every wake of
  its own and stops; else the script renews or claims the lease. It reads the *owner's account*'s issue and comments
  alone; where gh acts as another account, it writes nothing, so the wake goes on without the lease, save where
  another's is fresh. Where no lease can stand (issues switched off, no repository on github.com), it says so and the
  wake goes on without one; where it fails otherwise, that wake works no lane and keeps its next.
- The issue's current text is its hand-off, which it keeps current at each change (a builder started or stopped, a
  merge, an order given): the lanes and their pull requests, what each waits on, the orders for now in force (a pace,
  an order of work, a hold), one given only by message among them, and what comes next.
- A new orchestrator, of any tool or account, is started only where the script, read alone, says one may be: no
  lease is fresh, or its holder handed over by a note there. Whoever starts one (the owner, the adviser) runs it first,
  and the new one takes up from the hand-off alone.
- A cold orchestrator is not woken: where the script says the holder's last wake is over an hour old and it had no
  builder running, so that its cache has lapsed, whoever resumes the work writes the hand-over note (`--hand-over any`,
  or the fresh session's name where it is known), which stops the old one whatever it names, and starts a fresh one
  from the hand-off, as "Hand over at once" (`roles/orchestrator.md`) does for a builder; one with builders running is never replaced, since they report to the session that started them.
- Its wake follows the cache: while a builder of its runs, or a review or check it waits on is due, its next wake
  comes within the cache's hour (55 minutes, a first guess), set again at each wake, which the lease makes safe; with
  nothing in flight (a pause, or no line a session can take) it keeps no wake, its hand-off ready, and the work resumes
  in a fresh one.
- Ready at any moment: since a session's usage can end mid-step with no chance to write a note, the hand-offs are
  kept current, never written only at a stop: the orchestrator's at each change, each builder's at each passed gate
  ("A change of tool loses nothing").

It does not mean that a session's word is trusted for who holds the lease beyond what the issue shows, that a builder
needs a lease, nor that a wake runs on the owner's computer (floor rule 8). Reason: on 22 November 2026 an
orchestrator's scheduled wake would have revived it while another account's orchestrator worked the same queue, and a
wake after its cache lapsed wrote its 440,000 tokens anew ($3.76 for one short turn, against $0.33 warm), where a fresh
one writes only what it needs. Held by `scripts/lease.mjs` and its test (a fresh lease of another session stops the
wake, a stale one is claimed, a hand-over note stops the old holder, a session signed in as another account writes
nothing and goes on, a project whose issues cannot be read keeps its orchestrator, and read alone it says whether the holder's last
wake is over an hour old), and by the scheduled look, which reports a lease renewed by two sessions and wakes more than
an hour apart while builders ran; that the hand-offs are kept current, by nothing yet.

**Proven by the staged cases, tool by tool** (`core-changes/holders.md`, "Staged cases hold what no check
reads"). A tool works with the core once a session of it has passed every staged case (`node scripts/staged.mjs
--read <case> <folder> --record --tool <its name>`), and that stands until the next release, at which its cases are
due again. Until then the core says of the tool only what its documentation says, naming where and the day it was
read. Whoever works in that tool runs them, a session the orchestrator starts where it can reach the tool; the first is
a scratch project opened in Kiro. It does not mean a tool is refused a role before it has passed. Reason: a tool's
documentation says what it reads, not whether its model keeps the rules, and the tools change monthly. Held by
`scripts/staged.mjs`, which says each tool's standing, the release's notes too, and names the cases due for each.

**Each tool's part** (#397). By default each tool the core is used with has a part under `tools/`, its column's heading
in the table below naming it, and whoever adds or changes what the core says of a tool writes it there: how the tool is
handed a task; how it is asked for a review by each way, in the order of `tasks/reviews.md`, point 1, a label in italics
for each (*Side by side:*, *Through a plug-in:*, *On the host:*), what comes back and whether it takes a brief, or
"none" (or "not yet", where the core has not read one); what it cannot do that a rule needs; its own folders, which
floor rule 3 protects by name; and its map of the tiers (`tasks/roles.md`, "The rules name tiers, never a model"), where
it has one. A tool with no review app on the host is asked for a review by a fresh session of it given the review's
brief (`tasks/reviews.md`, point 7) and told to change nothing; its answer is posted on the PR in a comment that opens
"Code review:" or "Security review:". The one condition that changes it: a project whose tool has no part names in its
manifest's "Tools" table how it is reached, and files the part with the core (`README.md`, "Reporting to the core"). It
does not mean a part repeats the project's own way of asking, which stands in `tasks/reviews.md` alone, nor that it says
more of a tool than the tool's documentation. Reason: a project with only that tool otherwise had no word on how to
reach it. Held, in part, by `scripts/tools-offer.mjs`, which fails a part with a way's label left out or the labels out
of order.

**Each tool's part says whether it starts a session of its own** (#492). By default each tool's part says, on a line
*Starts a session:* in its file under `tools/` or in a file of its part read on need, whether a session of the tool
starts another session of its own, one with its own context and no helper inside it, and if so how, and whether that
session goes on once the one that started it is archived or ends, each from the tool's documentation, naming its pages
and the day it was read ("read on <the day>"), and "not stated" for what they leave out; the table's row "Starts a
session of its own" names the file that holds the line. The one condition that changes it: the tool cannot, as its
documentation says; its cell then says `cannot`, and the adviser writes the brief and the owner starts the session
(`roles/adviser.md`). The trigger is a part first written, a tool joining the list, or its documentation found to say
otherwise: whoever writes the part, or finds it, writes the line in that pull request. It does not mean that a session
starts one by its own choice (which session starts which: the roles' files), that a helper counts, or that the line
repeats a way's *Task:* (`tasks/ways.md`). Reason: how a session is started differs from tool to tool, what holds for
every one is what results, and the adviser keeps its own session until a part says one outlives its starter. Held, in
part, by `scripts/tools-offer.mjs`, which fails a `carried` cell of that row whose file has no such line with its day;
that the line says what the documentation says, by nothing yet.

**What the core offers one tool, it offers each** (#467). By default nothing the core gives a session of one agent tool
is given to that tool alone: each thing it offers is a row of the table below, and each tool of the list a column,
Claude Code, Codex, Kiro, Antigravity and GitHub Copilot, the last as a builder too; the owner adds to the list
(`scripts/staged-tools.json`). The one condition that changes it: the tool cannot, as its own documentation says. Each
cell says one of three: `carried`, with the file that carries it; `cannot`, with the tool's documentation, by its page,
and the day it was read; or `not yet`, its open issue the column's last cell, or one it names itself. Whoever adds or
changes something for one tool fills the cell for each other tool in the same pull request. A cell that says `carried`
claims no more than the tool's documentation until the tool has passed the staged cases (above). It does not mean the
tools or their models are equal, that a project must use more than one tool (which tool takes which role stays its
preference: `tasks/roles.md`), or that a `not yet` goes ahead of a project's own work: each is an ordinary task. Reason:
the core grew up with one tool, and a project whose owner has another got less of it for no reason a rule gives. Held by
`scripts/tools-offer.mjs`, which fails an empty cell, a `cannot` with no page and day, a `not yet` with no issue, a map
with no day, a tool of the list with no column and a file of a tool's own that no row names; that the issue is still
open, only where it is run with `--open` and gh answers.

| What the core offers | Claude Code (`tools/claude.md`) | Codex (`tools/codex.md`) | Kiro (`tools/kiro.md`) | Antigravity (`tools/antigravity.md`) | GitHub Copilot (`tools/copilot.md`) |
| --- | --- | --- | --- | --- | --- |
| The entry file | carried: `setup/template/CLAUDE.md.tmpl` | carried: it reads `AGENTS.md` itself | carried: `setup/template/kiro-steering.md.tmpl` | carried: `setup/template/antigravity-rule.md.tmpl` | carried: it reads `AGENTS.md` itself |
| What to read at a task's start | carried: `tools/claude.md`, which the entry file pulls in | carried: `tools/other-builders.md` | carried: `tools/other-builders.md` | carried: `tools/other-builders.md` | carried: `tools/other-builders.md` |
| The work-saved hook at a session's start and stop | carried: `setup/template/claude-settings.json.tmpl`, running `scripts/work-saved.sh` | carried: `setup/template/codex-hooks.json.tmpl` | carried: `setup/template/kiro-hook.json.tmpl` | not yet | not yet |
| Helpers, and the hook that holds their model and effort | carried: `tasks/helpers.md`, `scripts/helper-call.mjs` | not yet | not yet | not yet | not yet |
| The map of the tiers to its models | carried: `tools/claude.md` | not yet | not yet | not yet | not yet |
| How a task is handed over | carried: `roles/orchestrator.md`, a session or helper it starts | carried: `tools/codex.md`, its plug-in's subagent or its command line | carried: `tools/kiro.md`, its editor or `kiro-cli chat` | carried: `tools/antigravity.md`, a conversation in its editor | carried: `tools/copilot.md`, a conversation on GitHub |
| How a review is asked | carried: `tasks/reviews.md`, the fallback reviewer | carried: `tools/codex.md`, its app on GitHub | carried: `tools/kiro.md`, a fresh session given the review's brief | carried: `tools/antigravity.md`, a fresh session of it with that brief | carried: `tools/copilot.md`, its code review |
| The orchestrator | carried: `roles/orchestrator.md` | not yet | not yet | not yet | not yet |
| Starts a session of its own, for the adviser (`roles/adviser.md`) | carried: `tools/claude-sessions.md` | not yet: #907 | not yet: #907 | not yet: #907 | not yet: #907 |
| What it cannot do that a rule needs | carried: `tools/claude-auto-mode.md` | carried: `tools/codex.md`, its app on GitHub pushes nothing | not yet | not yet | not yet |
| The staged run | carried: `scripts/staged.mjs`, every case passed | not yet | not yet: #400 | not yet | not yet |
| Its issue for what is not yet carried | none | #679 | #680 | #681 | #682 |
