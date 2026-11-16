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

233. **14 November 2026** (the core; in a chat with a session the owner had asked to look through the core, not the
     design session, as that session recorded it on issue #253, labelled `by:chat`, under "What it is", saying the
     owner agreed to it). The session set out what a search the owner had asked for found, and what it would build from
     it, this among it: a measure of how strong a project's tests are, whether they would fail if a fault were put into
     the code on purpose, run on the lines a pull request changes; reported first, failing nothing; then held with a
     baseline, as one of the measures of how code is put together, that may not get worse, the state the codebase is in
     setting how fast it must improve; the tool named in the manifest, a tool of development only, under the floor's
     rules for dependencies and licences, or the measure left out where none exists for the project's language; a pull
     request that deletes a test or weakens what one asserts saying so under "Readings taken", which a reviewer checks;
     and the whole-codebase run belonging to the scheduled audit, outside the suite. The owner agreed:

     > What do we implement from this […]? Go ahead with making us better?

     To the orchestrator, passed on word for word to the builder of this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind "How strong the tests are is measured on the lines a pull request changes" and "A test taken out or weakened
     is said" in `modules/code-shape.md`, the two lines on them in `modules/review-guidelines.md`, the tests' whole run
     in `modules/cleaning.md`, `scripts/strength.mjs` and the core's own tool `scripts/mutate.mjs`, and the slot
     *mutation tool*.

234. **14 November 2026** (the core; in chats with a session the owner had asked to look through the core, not the
     design session, as that session recorded them on issue #250, labelled `by:chat`, the last under "What this issue
     asks to be built, in one place", saying the owner agreed to it). The session had set out three decisions before
     the core could be used at work: a licence, a team's shape and another host. The owner:

     > I want to see if i can use this core in future work projects also.

     The licence was decided apart (#257; item 221). Of the other two:

     > should work in every git format, and every person with rights to the repo is an owner, no?

     The owner agreed to the session's take on each. Another host, every one that holds a git repository: one layer
     that knows no host, a single entry point that runs every check of the core from plain git, on a person's machine
     or in any pipeline; a thin part for each host for what is the host's own (a scheduled job, a request for review,
     issues and labels, statuses), each naming what stands in inside the repository where the host has none; proven
     host by host, GitHub proven and any other "should work" until a project runs there, a host's part written when a
     project first needs it, not before. A team's shape, whoever the host lets write is an owner: the host's own rights
     decide and no list is kept, whoever may write to the repository may give its agents a task and settle an open
     reading, the *owner's account* slot becoming the owners; the yeses the floor names given by those with the host's
     higher right, an admin or maintainer, so that one person with the right to write does not loosen the floor alone;
     where two owners say opposite things, the agent reports it and takes neither side, and the higher right decides;
     the stand-in answering from the team's recorded decisions, not one person's taste; a person's approval of each
     change a slot that follows the host's own protection of the branch; and a project where one person holds every
     right changing in nothing. An employer's own rules on tools, models and data come before any of the core's. To
     the orchestrator, passed on word for word to the builder of this rule:

     > My yes is given for every queued change, the floor and the review guidelines included, as its issue describes
     > it: quote this in those pull requests.

     Behind floor rules 4, 12 and 14 as they read a team's owners, their yeses and the approvals the host asks;
     `modules/hosts.md`, `modules/teams.md` and GitHub's part in `modules/github-calls.md`; the slots *owner's account*
     and *approvals*; and `scripts/check.mjs`.
