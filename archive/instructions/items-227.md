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
