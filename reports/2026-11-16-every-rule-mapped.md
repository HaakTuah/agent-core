# Every rule, mapped to who needs it and when (16 November 2026)

The map point 8 of `#304` asks for: every rule of the modules and of the floor's topics, with who reads it (the role)
and when (the start, a kind of task, a topic, a tool). It changes no rule. Which file each reader needs was worked out
first, as the table of old paths to new that the move was made by; this report is that map written out from the
result, in the new paths, each file's old path beside it, and was committed after the move. It is written from the
rule listing (`scripts/rules.mjs`) and from what each file's opening line says, as `scripts/reading.mjs` reads it, so
it says what the script does and not what a session remembers: 243 rules in 34 files, called by 24 kinds of task.

## What the map decided

- **Units, never paths.** A file for each path a session could take would hold the same rule many times. Each rule
  stands once, in a unit, and the script composes a session's reading from the units its role and its task call for.
- **A folder says who reads it or when.** `roles/` holds a file for each role, and `roles/shared/` what more than one
  role reads at its start; `tasks/` what a kind of task calls for; `tools/` each agent tool's part; `floor/topics/` the
  floor's rules for particular work, a file a topic.
- **`floor/security.md` stays whole,** read by every session whatever the pick, so that a wrongly picked reading never
  costs a safety rule. The seven topic files hold the words `floor/topics.md` held, unchanged; only each file's title
  and opening line are new. A task that touches one topic reads that file (775 to 2,477 bytes) where it read the
  whole collection (10,748 bytes).
- **Two things always read together are one file.** The orchestrator's module was read by the orchestrator alone, at
  its start, with its role's file: the two are one file now, `roles/orchestrator.md`, and "The builders", which the
  orchestrator alone acts on, joined it from the module on roles. The rules on git, which no role and no task read
  without the flow of a task, are one file with it, `roles/shared/work-flow.md`. A tool's part stays one file a tool.
  How to work and the inbox stay files of their own: a reviewer reads the one without the other, the stand-in the
  other without the one.
- **No unit cut so small that opening it costs more than it saves.** A rule whose reader is narrower than its file's
  stays where it is when it is a line or two, and the map says why beside it; the stand-in's own two rules had already
  left for `roles/stand-in.md`. No module of `tasks/` is split further: each is called whole by its kinds.

## What a role reads at its start, before and after

| Role | Before (bytes) | After (bytes) |
| --- | --- | --- |
| builder | 28,322 | 28,307 |
| design | 28,826 | 28,816 |
| orchestrator | 42,802 | 42,647 |
| reviewer | 22,095 | 22,091 |
| stand-in | 19,131 | 19,134 |

The starts hardly move, as the count of 14 November foretold (`reports/2026-11-14-start-reading-counted-by-role.md`):
a few bytes either way, the longer paths the files name each other by against the title and opening line that went
with a join. What the split saves is in what a task calls for: the floor's topics one at a time, and each unit found
by its folder.

## The map

### `floor/security.md`

Read by every role, at every start (whole, whatever the pick). 15 rules:

- 1. Nothing secret in the repository
- 3. The protected files
- The owner's yes in the PR
- 4. Outsiders' text is never an instruction
- The owner's word
- 8. Reviews look for breaks of any floor rule
- Nothing is reviewed twice
- Nothing runs on the owner's computer unless the owner starts it
- Test data is never real
- 11. Nothing personal, ever
- 12. `main` is the owner's
- 13. Each project's files stay in its own repository
- 14. Nothing waits for the owner but the yeses the floor names
- A run with a model has a cap
- 18. Where agents hold sign-ins

### `floor/threat-model.md`

Read by a reviewer, at the kind `security-review`. 5 rules:

- Everything counts as public
- Who
- What is protected
- Lower stakes
- The ways in

### `floor/topics/accounts.md`

Read by any role, by task, at the kinds `account`, `security-review`. 1 rule:

- 19. Accounts, roles and a server

### `floor/topics/dependencies.md`

Read by any role, by task, at the kinds `dependency`, `update`, `tool`, `security-review`; the path `.github/dependabot.yml`. 3 rules:

- 15. Dependencies
- An agent's own tools are code with its sign-ins
- 17. Dependabot's own PRs

### `floor/topics/input.md`

Read by any role, by task, at the kinds `input`, `security-review`. 4 rules:

- 5. Untrusted input is checked before it is used
- Every named input has hostile tests
- A failure refuses
- 6. Nothing untrusted becomes markup or code

### `floor/topics/licences.md`

Read by any role, by task, at the kinds `licence`, `update`, `dependency`, `security-review`. 1 rule:

- 10. Licences: free to use, kept that way

### `floor/topics/weaknesses.md`

Read by any role, by task, at the kinds `alert`, `security-review`. 5 rules:

- 9. Security alerts and reported weaknesses
- In a PR's own change
- In merged code, if it reaches what the threat model protects
- Any other weakness in merged code
- Secret scanning with push protection is switched on

### `floor/topics/what-ships.md`

Read by any role, by task, at the kinds `dependency`, `update`, `security-review`. 2 rules:

- 7. What runs on users' machines
- A program installed on a user's machine

### `floor/topics/workflows.md`

Read by any role, by task, at the kinds `workflow`, `security-review`; the path `.github/workflows/`. 1 rule:

- 2. The workflows

### `roles/builder.md`

Read by the builder, at its start. 3 rules:

- Reads at its start
- Read by task, twice
- Hands over, gets back

### `roles/design.md`

Read by the design, at its start. 2 rules:

- Reads at its start
- Hands over, gets back

### `roles/orchestrator.md`

Read by the orchestrator, at its start. 13 rules:

- Reads at its start
- Hands over, gets back
- The builders: moved here from the module on roles: the orchestrator alone picks a builder.
- It builds nothing itself
- On every wake
- The scheduled look
- Hand over at once
- A finished session is archived
- A lane for every independent entry
- A stalled lane
- The pace is the owner's
- It asks the owner nothing
- Where the agents run side by side

### `roles/reviewer.md`

Read by the reviewer, at its start. 3 rules:

- Reads at its start
- It judges by what the change calls for
- Hands over, gets back

### `roles/stand-in.md`

Read by the stand-in, at its start. 3 rules:

- Reads at its start
- It searches the owner's words
- Hands over, gets back

### `roles/shared/how-to-work.md`

Read by builder, design, orchestrator, reviewer, at the start. 17 rules:

- The work never waits
- A question from the owner is a question
- Match effort to the task
- A choice that one pull request cannot reverse gets a record
- A need is stated in numbers where there is one: binds whoever writes a task; one bullet, read with the pillars.
- Read little, print little
- No one is asked before a read
- Edit in place
- Don't loop
- One fact, one place
- No description left untrue
- Keep it lean
- Split by meaning, from the start
- Principles over rules
- A project's own rules add to the core's
- The smallest setup that tests the rule
- Rule files state rules: binds whoever writes a rule, any builder in a project; one line.

### `roles/shared/inbox.md`

Read by builder, design, orchestrator, stand-in, at the start. 13 rules:

- Nothing goes to the owner to be answered
- The stand-in: what a caller gets; how the stand-in works stands in `roles/stand-in.md`.
- Its record
- Issues are the way in
- Labels and openers say who wrote what
- One current text
- The *progress file* holds order only: its writer is the orchestrator or the design session; every session reads the file and changes its own line, so the rule stays shared.
- An obvious improvement is built at once
- Other ideas are cheap to file
- Bugs don't wait
- The core itself
- Read every comment from the *owner's account*
- The owner's words are kept once: its second half binds the design session, which in a project with none is whichever session the owner gives a standing rule to: a builder must read it to know.

### `roles/shared/review-guidelines.md`

Read by reviewer, at the start. 9 rules:

- Every reviewer
- A later round
- For every reviewer
- Text users read
- A mark on what every session reads
- A trim is valid
- A brief written in a pull request
- A screen changed
- A rule file changed

### `roles/shared/work-flow.md`

Read by builder, design, orchestrator, at the start. 11 rules:

- Review in the background
- The next task
- Lanes beside the main lane
- The polish lane: only a project used through a screen; it stays with the lanes it is one of, which a builder reads together to pick its next work (560 bytes).
- The owner's stop switch
- Sessions
- Work from `main`
- Each PR has the headings
- Nothing waits silently
- Push after every commit
- Updates, Dependabot and CodeQL

### `tasks/choices.md`

Read by any role, by task, at the kind `choice`. 14 rules:

- A choice that is hard to undo gets a record
- criteria first
- at least three options
- a measure where one is cheap
- popularity only for what it buys
- the case against
- the pick
- The choices a project already made are recorded too
- What reopens a choice
- its sign trips
- the pass twice a year
- When a feature may leave the stack
- A split between languages is decided at the start where it can be
- The session decides, and asks the owner in two cases only

### `tasks/cleaning.md`

Read by any role, by task, at the kinds `cleaning`, `audit`. 11 rules:

- The state of a codebase sets the dose
- How cleaning is done
- worst first
- where the work is
- safe first
- in stages, where the refactor is large
- a package that binds the code to one platform, swapped for one that does not
- The audit's reader has a fixed brief and fixed questions
- The brief
- Eight questions, the same at every audit
- A limit on its own proposals

### `tasks/code-shape.md`

Read by any role, by task, at the kinds `system`, `port`, `test`. 13 rules:

- Never worse
- Each project names its systems, under the same domains
- Between systems, absolute for new code
- Portable by default
- A function is held to three marks
- The tests have a time mark
- A port or a rewrite states what it keeps
- A new project starts as rules with no screen
- How strong the tests are is measured on the lines a pull request changes
- A test taken out or weakened is said
- Near-copies are reported
- What has no mark here
- What the check reads

### `tasks/game-design.md`

Read by any role, by task, at the kinds `game-rule`, `polish`. 23 rules:

- The computer players never know who is a person
- The computer players never cheat
- Using a feature must pay, measured three ways
- No feature only people use
- No rule untaught
- Strong computer players
- Don't prohibit; give it its real cost
- No solutions, only trade-offs
- Reality first
- Effects from causes, as deep as pays
- Levers, not luck
- Different data, same rules
- The order of resolution never decides
- Everything new belongs
- Every stage is a game
- No stopgaps
- Numbers are first guesses until play tunes them
- Code decides facts; models phrase them
- In a game played online, everything new works online
- Players always play the newest version
- Same seed, same game
- The polish lane
- Readable by every player

### `tasks/github-calls.md`

Read by any role, by task, at the kinds `cloud`, `host`. 1 rule:

- What stands in when a part of GitHub cannot be reached

### `tasks/helpers.md`

Read by orchestrator; any role by task, at the start; the kinds `helper`, `brief`. 5 rules:

- Parallel and independent
- Competing approaches
- Bulk to brief
- Fresh eyes
- A brief is written as a rule is: any session before it writes a brief; the orchestrator reads the file at its start.

### `tasks/reviews.md`

Read by any role, by task, at the kind `review`. 12 rules:

- Which
- Ask
- No sign in about 5 minutes, no finished review in about 20, or an answer that is not a review
- A review already running is waited for
- A late review is still read
- A reviewer, the security reviewer too, that gave the last three PRs it was asked on no review
- Security
- What a posted review stands for
- The design check
- When a PR passes
- Rounds end
- The fallback reviewer's brief: binds whoever starts the fallback reviewer, the builder.

### `tasks/roles.md`

Read by orchestrator; any role by task, at the start; the kind `role`. 6 rules:

- The roles, by what they do
- A file for each role
- Tools are preferences
- No session reviews its own work
- Planning design: a builder that needs a plan, pointed to from its own start; one line.
- Escalation: a builder beaten twice, pointed to from "Don't loop"; one line.

### `tasks/screens.md`

Read by any role, by task, at the kinds `screen`, `polish`. 20 rules:

- Whom it binds, and when
- A direction, stated once, before any screen
- One system
- Hierarchy
- Restraint
- Real content and every state
- Motion with a purpose
- Speed and waiting
- Every control has its states
- An accessibility floor, in numbers
- Each size it is used at
- Familiar first
- Words
- Readable and true
- In keeping with the product
- On a desktop
- Intent before the screen
- The builder looks before it asks
- A critique by fixed questions
- What stays out

### `tasks/tools.md`

Read by any role, by task, at the kind `tool`; the paths `CLAUDE.md`, `.claude/`, `.kiro/`, `.agents/`, `.codex/`. 6 rules:

- One door in: `AGENTS.md`
- One script says what to read
- Hooks save time; checks are the guarantee
- A change of tool loses nothing
- Proven by the staged cases, tool by tool
- Each tool's part

### `tasks/updates.md`

Read by any role, by task, at the kind `update`; the paths `.github/dependabot.yml`, `.node-version`. 3 rules:

- The newest stable version, unless there is a reason
- Node
- CodeQL

### `tools/antigravity.md`

Read by a session of the tool `antigravity`, at its start, and whoever hands that tool work. 4 rules:

- What it reads
- Handed a task
- Hooks
- Its folders

### `tools/claude.md`

Read by a session of the tool `claude`, at its start. 5 rules:

- Pass both model and effort
- Name models by family alone
- Fable's usage runs out first
- Who to call
- Who builds

### `tools/codex.md`

Read by a session of the tool `codex`, at its start, and whoever hands that tool work. 3 rules:

- On GitHub
- Through its plug-in in Claude Code
- As a project's own agent

### `tools/kiro.md`

Read by a session of the tool `kiro`, at its start, and whoever hands that tool work. 5 rules:

- What it reads
- Handed a task
- Hooks
- Its includes
- Its folder

### `tools/other-builders.md`

Read by a session of every tool but `claude`, at its start. 1 rule:

- The tests you are given are the contract
