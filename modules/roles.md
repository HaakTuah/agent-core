# Who does what

Read at its start by the orchestrator, and when a task needs one (who takes a role, who builds a line, who reviews a
change): the kind `role`.

**The roles, by what they do** (core archive 232): the orchestrator starts builder sessions and hands out lines
(`modules/orchestrating.md`); a builder builds one line to its merge; the session that syncs the core moves the copy
(`modules/work-flow.md`, "Sessions"); the code reviewer and the security reviewer review a PR (`modules/reviews.md`);
the fallback reviewer takes a review no other gives; the design check, the stand-in and planning design judge or plan
against the design and the owner's words; escalation takes what has beaten a builder twice. Any agent tool the owner
has may take any of them.

**A file for each role** (core archive 234; #304). By default what a role reads at its start is the floor's
`security.md`, its own file under `roles/` (the builder's, the orchestrator's, a reviewer's, the stand-in's, the design
session's) and the shared files that file names on its line "Reads at its start:". Whoever writes or changes a rule
puts one that a single role needs in that role's file, and one that several roles share in one shared file their files
name, so that no rule stands in two files; a role's file says in a line each what the role hands each neighbouring role
and gets back, and nothing of how the neighbour works. It does not mean a module read by task belongs to a role (a
builder that mends a bug and one that builds a feature have one role and read different modules), nor that a session
with no file here (a helper, planning design, escalation) reads more than its brief names. Reason: every role read
every other role's rules at each start. Held by `scripts/size.mjs`, a cap for each role's start, and
`scripts/reading.mjs --check`, which fails a role's file that names no start; where a rule stands, by nothing yet.

**Tools are preferences** (core archive 232; #249). By default each role goes to the tool this table prefers, and,
where that tool is not at hand, to the next it names:

| Role | Preferred | When it is not at hand |
| --- | --- | --- |
| Orchestrator, the session that syncs the core | Claude | any tool the owner has |
| Builder | as "The builders" says | the next tool there |
| Code reviewer | a tool that cannot build here (Codex's app, then Copilot's), then a builder of a tool other than the builder's | the fallback reviewer |
| Security reviewer | Codex's app, which starts by itself (floor rule 8) | the fallback reviewer |
| Fallback reviewer | Claude | a fresh session of any tool at hand |
| Design check, stand-in, planning design | Claude | the strongest tool at hand |

- Where a project's manifest has a table under "Tools", each row it holds replaces the default's for that role; a row
  it lacks keeps the default's.
- A tool is not at hand where it is not installed or set up for the project, its usage window is spent, or it gives no
  sign as `modules/reviews.md`, point 2, says. Whoever hands out the role (the orchestrator, or the session that needs
  the review) takes the next.
- It does not mean that any tool is refused a role: a preference orders and never refuses, and a project with one tool
  runs every role with it. Nor does it mean that a session judges what it wrote (below).
- Reason: where only one tool might take a role, the work stopped when that provider's usage ran out, and an owner
  with another tool alone could fill none.
- Held by nothing yet: which tool took a role leaves no mark a check reads.

**No session reviews its own work** (core archive 232): the session that reviews a change is never the session that
wrote it. A fresh session of the same tool serves; a different tool is a preference, the table's. It does not mean a
second tool is needed. Reason: a reviewer that wrote the change reads its own intent instead of the diff. Held by
nothing yet: builder and reviewer post under one login (#187).

**The builders** (core archive 232): a builder is picked for a line in this order:
1. by what the line needs: the *hard work* to the tool the project prefers for it (by default Claude), routine work to
   the cheapest tool that can do it;
2. not the orchestrator's provider, while another has allowance left;
3. among the rest, the project's order (its table's row "Builder"), Codex first where it names none;
4. the orchestrator's provider last, and never below a reserve that keeps the orchestrator itself waking: by default,
   no new builder on that provider once its usage window shows its warning level.

- The orchestrator picks. A tool is reached by the first way there is (core archive 122, 154, 158, 162, 163, 169): the
  tool that runs the agents side by side (floor rule 18), else a plug-in in the orchestrator's tool, else a way the
  project names, as the tool's part says (`modules/tools.md`).
- Each takes every task or part whose brief can say all it needs, each in its own working tree and PR, whose first line
  names its builder; what no brief carries (a design reading, the owner's past words) goes to a builder that reads them
  itself. A task one failed at twice (its closed PRs and the *progress file* say) goes to the next, from `main`.
- It does not mean the order holds back a line the owner gave a tool by name, nor that a project's own pace is passed
  over (`modules/orchestrating.md`, "The pace is the owner's").
- Reason: the orchestrator is what keeps the work going, so its provider is saved the longest, and the strongest model
  is kept for the work that takes judgement.
- Held by nothing yet: a builder's tool and the usage left are no mark a check reads.

**Planning design** is asked at most once per task (its PR says when it was), with a self-contained brief, when it needs
a new or better plan.

**Escalation** (core archive 25): what has beaten a builder twice may go to a fresh solver with a self-contained brief;
the builder applies and checks the answer.
