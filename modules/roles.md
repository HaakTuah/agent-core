# Who does what

Read when a task needs one: who takes a role, who builds a line, who reviews a change.

**The roles, by what they do** (core archive 231): the orchestrator starts builder sessions and hands out lines
(`modules/orchestrating.md`); a builder builds one line to its merge; the session that syncs the core moves the copy
(`modules/work-flow.md`, "Sessions"); the code reviewer and the security reviewer review a PR (`modules/reviews.md`);
the fallback reviewer takes a review no other gives; the design check, the stand-in and planning design judge or plan
against the design and the owner's words; escalation takes what has beaten a builder twice. Any agent tool the owner
has may take any of them.

**Tools are preferences** (core archive 231; #249). By default each role goes to the tool this table prefers, and,
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
- Reason: a lock on one tool shut out an owner who had one tool, and stopped the work when one provider's usage ran
  out.
- Held by nothing yet: which tool took a role leaves no mark a check reads.

**No session reviews its own work** (core archive 231): the session that reviews a change is never the session that
wrote it. A fresh session of the same tool serves; a different tool is a preference, the table's. It does not mean a
second tool is needed. Reason: a reviewer that wrote the change reads its own intent instead of the diff. Held by
nothing yet: builder and reviewer post under one login (#187).

**The builders** (core archive 231): a builder is picked for a line in this order:
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
