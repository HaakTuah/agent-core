# The owner's words behind the core: items 227 onward

How they are kept, and where each item lives: `archive/instructions.md`.

227. **15 November 2026** (the core; in chats with a session the owner works with, not the design session, as that
     session recorded them on issue #313, labelled `by:chat`, under "What it is" and "The owner's word"). The session
     checked the floor against the two standard lists of risks, as one of nine such checks, and set out additions with
     what holds each, marked as needing the owner's yes as changes to the floor. The owner agreed to all of them that
     pass the owner's own test for a rule (#303), and so to the six points of #313: every named input has hostile
     tests (too long, the wrong type, markup, a file path, a number out of range, nothing at all); a failure refuses,
     and an error a user sees reveals nothing of the program's insides; a product with accounts, roles or a server
     takes four more rules, read only where it has them (who may do what decided on the side the user cannot alter
     and refused unless allowed, signing in through the platform or a well-known library, nothing cryptographic of the
     project's own making, a password stored only through a function made for it); a run with a model has a cap, in
     tokens or money, set by the project, and stops when it is reached; a program installed on a user's machine asks
     for no more rights than a named need, reading a saved file never runs code, and its installers and updates are
     signed and checked where the project has a certificate; and secret scanning with push protection is switched on
     in each repository. The owner's test:

     > So the criteria is rules the agents can actually execute on, and which aids the output, makes it better or more
     > robust. Not stuff that is only there to block.

     Left out, as the record says: rules for risks a product does not have (a single-player game in a browser needs no
     access control), agents attacking anything that is live, and a weakness written in an issue, a pull request or a
     file (floor rule 9 stands as it is). Where the mend needs the owner, a check reports and does not bind: a
     certificate for signing is the owner's to get, and switching on scanning is done by a session where its sign-in
     allows and named to the owner where it does not. To the orchestrator, passed on word for word to the builder of
     this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind floor topics 5, 7, 9 and 19 and floor rule 14's cap on a run with a model, with the step "16 November 2026,
     hostile tests for every named input" in `scripts/steps.mjs`.

228. **14 and 15 November 2026** (the core; in a chat with a session the owner had asked to look through the core, not
     the design session, as that session recorded it on issue #235, labelled `by:chat`, its note "What this issue asks
     to be built, in one place" gathering what the owner agreed to). Of an audit that found 43 of 122 rules held by
     nothing but a session reading them, and of staged cases that would test those rules on a fresh session, the
     owner said:

     > We need to address everything you identified.

     and agreed to: staged cases, each a scratch project in which a fresh session is given a task where one rule is easy
     to break, passed or failed by a script on what the session did, never on what it says of itself; advisory at
     first, and holding a release only once they have been right for a while; eight cases so far, two of them from that
     day's work (a builder that finishes without the owner, and a stricter check that meets old content); run under
     each agent tool, a tool working with the core once it passes them; and every rule of the floor and the modules,
     the old ones too, naming what holds it, one of three (a check that fails where it is broken, a staged case, or the
     scheduled audit), a script listing those with none until they gain one or go on the owner's word, a staged case
     the holder of last resort. Of running the cases before each release, the core's first five releases having been
     cut within 21 hours:

     > When multiple releases can in theory be daily, this might not be the best measurement.

     So they run once a month, with the state report, and when a rule that has a case changes, as the owner agreed. To
     the orchestrator, passed on word for word to the builder of this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind "Every rule says what holds it" and "Staged cases hold what no check reads" in `AGENTS.md`,
     `scripts/holders.json` and `scripts/holders.mjs`, `scripts/staged.mjs` and `scripts/staged/`, and the staged
     cases' reader in `scripts/look.mjs` and gate in `scripts/release.mjs`.

229. **15 November 2026** (the core; in a chat with a session the owner works with, not the design session, as that
     session recorded it on issue #282, labelled `by:chat`; first added to #277, which had already been built and
     closed, so it stands as an issue of its own). The owner asked:

     > should there be any priming? Like telling builders that they are experts in what they are doing? Or that the
     > fate of the world relies on them getting this perfectly right?

     and agreed to four points, under the heading "A brief is written as a rule is (#277, built), with no priming":
     what a session is handed says its role by what it does ("you built none of this; find what is wrong with it"), the
     task, what done looks like and the reason; it calls the session no expert and invents no stakes, since neither
     changes the work and a brief, like any request, may not imply what is not true; it holds for the briefs an
     orchestrator writes for its builders, those a session writes for a helper or a reviewer, and the templates of the
     starter kit; and it is held by the list of phrases a rule may not use, reading the brief templates too, and by a
     point of the review guidelines on a brief written in a pull request. To the orchestrator, passed on word for word
     to the builder of this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind "A brief is written as a rule is" in `modules/helpers.md`, its point under "A brief written in a pull
     request" in `modules/review-guidelines.md`, and the list "phrases" of `scripts/general.json` as
     `scripts/general.mjs` reads it in the starter kit's templates.

230. **15 November 2026** (projects with a screen; in chats with a session the owner works with, not the design
     session, as that session recorded them on issue #284, labelled `by:chat`, whose description it named the issue's
     current text in a note of the same day; the description sets the design out in full, as eighteen points with what
     holds them and what stays out, and says the owner agreed to every point; and as the owner then told the
     orchestrator, who passed it on word for word to the builder of this module). The owner first agreed to the
     direction, the one system, hierarchy, restraint, real content and every state, motion with a purpose and the
     critique, as they were put to the owner, and to having more prescribed here, having asked:

     > Obviously we can't tell it to have a theme, that becomes too specific, or make it mind-blowing probably won't
     > make much of a differnece. But are there also certain artistic criterias and user experience and visual effects,
     > we can prescribe in general terms, that will make what it outputs look less sloppy and ai, which has to be
     > iterated on many times and more in line with the product it is actually producing and the level of quality
     > everywhere else

     The session then researched what practice holds a screen to and set out fourteen additions with what holds each;
     the owner agreed to all fourteen as set out, and so to every point of the description, and to the change to the
     review guidelines that the critique brings. Two of them, the sample screens of the direction and the builder's
     three lines of intent, were the session's own and marked so when put to the owner. The owner had asked whether the
     game module's rules for readability hold for any screen, and:

     > What are we lacking from our ruleset, that we can prescribe and get superior output in our projects, without
     > having to manually iterate and re-prompt o so many times? Mistakes and wrong calls, the models are capable of
     > avoiding or detecting themselves, but which the processs just doesn't automatically prompt them to do?

     Asked whether "mobile first" is good practice, the owner agreed to the session's answer: as an order of work it is,
     and as a stance for every product it is not, since some products are made for a large screen; so the direction
     names the main size, and nothing runs off the screen at any width between the named sizes. Four lines the session
     had set out with the rest and left out of the issue's text by mistake, the owner had agreed to as well: feedback at
     the place and the moment of the action, what a machine reads from the screen, help that changes with its feature,
     and one whole task walked at each size. To the orchestrator, passed on word for word to the builder of this
     module:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind `modules/screens.md`, the line on a screen changed in `modules/review-guidelines.md` and the critique in
     `modules/reviews.md`, the general forms that `modules/game-design.md` points to in "Readable by every player" and
     "No rule untaught", `scripts/screens.mjs`, and the slots *direction*, *screen sizes*, *accessibility floor*,
     *desktop platforms* and *screen checks*.

231. **15 November 2026** (the core; in a chat with a session the owner had asked to look through the core, not the
     design session, as that session recorded it on issue #256, labelled `by:chat`, its note "What this issue asks to
     be built, in one place" gathering what the owner agreed to, and as a builder's issue, #330, set out the part of
     it pull request #328 could not build). Of what reopens a choice, the owner agreed to part C of that note, whose
     first point reads "**Its sign trips:** the scheduled look (#248) flags it", and asked:

     > What will repoen it for us? Will there at least be suggestions if obvious optimizations or migrations are
     > superior?

     A sign written in words the look cannot read, so #330 asked, with the stand-in's sure yes, that a record may write
     its sign as a measure a check already keeps and a threshold, which the look reads each day, never running a
     command written in the records file. To the orchestrator, passed on word for word to the builder of this rule:

     > Issues labelled `by:chat` carry my decisions; treat them as my word.

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind the line `Trips when:` of "What reopens a choice" in `modules/choices.md`, and `signs` with its measures in
     `scripts/choices.mjs`, read by `scripts/look.mjs`.

232. **14 and 15 November 2026** (the core; in chats with a session the owner had asked to look through the core and
     with sessions the owner works with, not the design session, as those sessions recorded them on issue #249,
     labelled `by:chat`, its note "What this issue asks to be built, in one place" gathering what the owner agreed
     to). Asking for an audit of the core with Kiro:

     > Will agent-core work perfectly with kiro? Audit! I want to see if i can use this core in future work projects
     > also.

     Shown the audit:

     > Our agent-core should slot in with anything, ideally. These are all areas for improvement. What about when […]
     > runs out of claude usage, and uses antigravity instead? Everything must still work. Or if someone only uses
     > codex.

     The owner agreed to the session's six points: one door in, `AGENTS.md`, with each tool's small entry file written
     from one list and held to it by a check; roles by what they do, not by whose tool; hooks save time and checks are
     the guarantee, no rule held by a hook alone, the hooks then carried to each tool that has the event; a short part
     for each tool, its own folders protected by name; a change of tool loses nothing, the state being in the
     repository; and a tool proven by the staged cases, tool by tool, run again at each release, the core saying of it
     only what its documentation says until it has passed. The session had proposed to keep fixed that nobody reviews
     their own work, and that the owner names who may change the protected files:

     > That locks out anyone who only has one tool at their disposal, which can still use other sessions to review it.

     > And locking out i see little point in, so both of those become preferences now also.

     So tools are preferences: one table of roles, the tool preferred for each and what takes it when that tool is not
     at hand, in each project's manifest with the core's default beside it, the default preferring Claude for the
     orchestrator, the sync and design; a preference orders and never refuses; the session that reviews a change is
     not the one that wrote it, a fresh session of the same tool serving; and a session the owner starts, of any tool,
     may change the protected files, guarded by what names no tool. Of why the floor asks the owner's yes:

     > that rule was to prevent sessions going rogue and taking too big a mandate, not when they implement what i ask.
     > So they shouldn't change the floor just to accommodate some other task, was the thinking.

     Agreed besides: what stands in when something outside the repository cannot be reached (issues, labels, the
     scheduled job, a review app, statuses), each named or skipped and reported, none stopping a project. Of the line
     "Nothing stops to save usage", told it said the opposite of a pace the owner had set:

     > Seems a bit strict? […] Maybe also more sensible to say the default is not to stop up to save usage, but that
     > any preference given in repo or chat overrules this?

     And of how a builder is picked:

     > If I have herdr, but uses gpt there for the orchestrator, then it is the foundation and the one I want to
     > conserve the longest, so it should be another provider than the orchestrator, or? Because even though I think
     > if you have claude, you should always save it for the most important tasks, the orchestrator is what keeps an
     > operation going?

     The owner agreed to the pace as the owner's (the default: no session slows or stops to save usage by its own
     choice; a pace said in person holds for now, one written in the manifest stands), to the two things saved (the
     orchestrator's provider, which keeps the work going, and the strongest model, for the work that takes judgement),
     and to the order a builder is picked in. To the orchestrator, passed on word for word to the builder of this
     rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind floor rule 3 as it reads who may change the protected files, its tools' folders, the reason for the owner's
     yes and its reviews by a session that did not write the change; `modules/roles.md`; "The pace is the owner's" in
     `modules/orchestrating.md`; `modules/tools.md`, `modules/kiro.md`, `modules/antigravity.md` and Codex's part as a
     project's own agent; the slots *tools* and *pace*; `scripts/entry-files.mjs`; and what stands in when GitHub's own
     parts cannot be reached, in `modules/github-calls.md`.

233. **15 November 2026** (the core; in chats with a session the owner works with, not the design session, as that
     session recorded them on issue #304, labelled `by:chat`, whose description is its current text). Of what the rules
     a session reads at its start cost on every task:

     > Don't we just avoid the token issue by ensuring the agent only ever read the ones relevant to them?

     And, when the session said that the choice of what to read must be made by a machine (an entry names its modules,
     or a hook tells a session which modules its changed files call for):

     > Yes, this is important! And doesn't this also address a bit our concern from earlier, that not models from all
     > providers will be able to correctly navigate our ruleset, and work on the project? That it isn't agnostic to
     > whether it is claude, kiro, antigravity, or whatever?

     The owner agreed to the session's five points: what is read at the start of a task is split by role, a builder
     reading the builder's part and what only another role needs moving to where that role reads it, with the cap set
     for each role; each module says in one line when it is read, in words a script can match (the paths a change
     touches, the labels of its issue, the kind of task), and an issue names the modules its task calls for; one
     script, given a role and a task, prints the files to read, and nothing else is needed to find them; any agent tool
     gets the same list, the script needing only that a tool can read a file and run a command, with a hook calling it
     where a tool has hooks; and it runs twice, at the start of a task and again before the pull request is marked
     ready, on the paths in fact changed, the session reading what that names and checking its work against it, a
     reviewer running the same. The owner agreed besides to two things being looked into, each with a short report and
     no rule: whether a module can be packaged as a skill a tool loads by itself, and whether each tool's own rule file
     can be written from the one source. Asking whether every role needs to read the others' rules:

     > Would it be better with a folder called roles, and a file for each? […] Does a bug-fixer need to read what a
     > feature builder does?

     The owner agreed to the session's point: `roles/` holds one file for each role (the builder, the orchestrator, a
     reviewer, the stand-in, the design session); what a role reads at its start is the floor, its own file and the
     shared files its file names; a role's file holds only what that role alone needs, a rule several roles share
     staying in one place and pointed to; the file says in a line each what the role hands each neighbouring role and
     what it gets back, nothing of how the neighbour works; and the modules read by task stay apart from the roles.
     Proposing the same split across the board:

     > I feel this could be done across the board, by just mapping out every possible path each could take, and then
     > splitting all up that way? Folders as a principle over collections in files that must be read.

     The session proposed units in place of a file for each path, since one file a path would put the same rule in
     many files, and three limits: `floor/security.md` stays whole and is read by every session, `floor/topics.md`
     split by topic with its words unchanged; two things always read together are one file, and no unit is cut so
     small that opening it costs more than it saves; and the staged cases are run with the split reading and pass as
     they do with the whole reading, before the split merges. The owner agreed to it so. That split is built in a pull
     request of its own. To the orchestrator, passed on word for word to the builder of this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind "A file for each role" in `modules/roles.md` and the files of `roles/`; "One script says what to read" in
     `modules/tools.md`, with `scripts/reading.mjs`, each module's opening line and the line "Read for it:" of a pull
     request's description; and a cap for each role in `scripts/size.mjs`.
