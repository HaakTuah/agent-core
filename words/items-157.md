# The owner's words behind the core: items 157 to 194

What these are and how they are kept: `words/README.md`.

157. **12 November 2026** (the core, in the design chat), of a project of another owner:
     told that a product needs its seller's name somewhere, that the floor let no name into a repository
     but the GitHub account in its address, so that the build would have to take the name from outside, and that a
     company's name could instead be allowed there:

     The owner's reason: the seller's name a product needs can be a company's, which names no person.

     Behind the second exception of floor rule 11: the company name a project is sold under, naming no person.

158. **12 November 2026** (the core, in the design chat), on development with another provider's tool, one its terms
     keep out of Claude Code, the owner asked whether the core was permissive enough for it: the owner decided that the
     core must not inhibit development with another tool or provider, while it keeps working as it does now.

     Behind the end of "Another provider builds" (`modules/roles.md`) and the two lines of
     `modules/other-builders.md` on the brief and the pull request.

159. **12 November 2026** (the core, in the design chat). First, of how a project learns that the core has moved,
     and of what sessions meet in the core's own rules, hooks and checks, the owner asked whether a script triggered
     on GitHub should make the pull request for new versions of the core, and whether the core should say that agents
     report to the core's issues the bugs and suggestions they run into, so that the owner gets feedback, from sessions
     of other owners' projects too.

     Advised against a workflow that opens the pull request (it would get no checks without a stored token, and
     would be the first workflow able to write code), and for one that only keeps an issue open while the core is
     ahead; and that sessions of a project of another owner report through that project's own inbox, since the
     core's repository is public. The owner agreed to the second point of that advice, and on the first held that most
     of those reports would never arrive that way and saw no harm in another owner commenting on the core's
     repository; the owner accepted the warning on sensitive details, proposed rigid guidelines so that only bug
     reports, feature suggestions or questions fit to be public end up there, anything else and exploits going by a
     private route others do not see, and asked for a view. The owner also asked whether a session knows what the core
     folder in a project is, and that it comes from outside, and whether it should.

     Behind "The core itself" in `modules/inbox.md`, "Reporting to the core" in `README.md` with the three issue
     forms, and the core-moved workflow.

160. **12 November 2026** (the core, in the design chat), of the table of models, which gave the orchestrator Sonnet
     at high: the owner asked whether the table should just say that the orchestrator is the one instance a human
     starts, at the model the owner runs it on, rather than dictate it.

     Behind the orchestrator's row in `modules/claude.md`: the owner starts it, at the model and effort the owner
     chooses; Sonnet is enough, since it builds nothing itself (item 27).

161. **12 November 2026** (the core, in the design chat), of a project's own rules beside the core's: the owner asked
     whether a project may clearly extend and override the core's rules, and whether it should.

     Told that a project may fill slots, pick modules, add rules of its own and add to the floor, that it may never
     loosen the floor, and that nothing said which holds where its own rule and one rule of a module disagree; and
     advised a short list of differences in its manifest, each naming the core's rule, what holds in its place and why,
     never of the floor or the review guidelines, checked by the pointer check and reported to the core; the owner
     agreed to everything else.

     Behind "A project's own rules add to the core's" in `modules/how-to-work.md`, point 7 of "How a project takes
     the core" in `README.md`, and the step of `core.yml` that fails a difference from the floor or the review
     guidelines.

162. **12 November 2026** (the core, in the design chat), of how fully another provider's builder is used; told that
     the core gave another provider's builder first what a check proves right without judgement, and left the rest
     with Claude's:

     The owner had noticed that another provider was used mostly through sub-sessions, and asked whether it would now
     be used more fully, whether those sub-sessions had been reviews only, and what the session's take was. The owner
     decided that the aim is to save Claude usage by giving all work suited to any other provider to it first.

     Behind "Another provider builds first" in `modules/roles.md` (every task or part a brief can carry and a check or
     its review can judge, where the owner set it up for the project) and the end of "Work continuously, other
     providers first" in `modules/claude.md`.

163. **12 November 2026** (the core, in the design chat), of "Another provider builds first" (item 162): the owner
     decided that it holds only where Claude is the orchestrator and prohibits no other kind of work, and that the
     whole core be checked thoroughly for other contradictions and for cohesion.

     The owner's reason: the fix had to reach projects with the next sync of the core, not by a further prompt.

     Behind "Where Claude's sessions hand out work, another provider builds first" in `modules/roles.md` and the
     orchestrator's own line of it in `modules/orchestrating.md`; `setup/sync-notes.md`, what a sync asks of a project
     beyond the copy, which the sync script prints and an orchestrator gives a lane; and the audit's fixes of the
     same pull request.

164. **12 November 2026** (the core, in the design chat), to what the day's audit left for the owner. Put to the
     owner: four wordings of the floor (the owner's word passed on "word for word" against "nothing personal in any
     brief"; "open an issue" in "Reporting a weakness" against "an agent never"; "the changes rule 3 names" in rule
     14, which could read as every protected file; "costs money", which could read as every push to a private
     repository), the cap raised by 1 KB for the dozen fixes that waited for room, the orchestrator's next session kept
     at the merge, and three questions left from earlier in the day: whether each pull request should say what its
     session cost, whether agents may file private weakness reports themselves, and whether the owner's word of item
     157 had been the owner's yes to the company's name in floor rule 11. The owner agreed to everything, and asked for
     a breakdown of everything done.

     Behind the four floor wordings (rules 4 and 14 in `floor/security.md`; rule 9 and "Reporting a weakness" in
     `floor/topics.md`), the cap of 45 KB (`scripts/size.mjs`), the fixes of the same pull request, the last line of
     "Work from main" in `modules/git.md` with `scripts/session-cost.mjs`, and the owner's yes, now said, to floor rule
     11's second exception.

165. **12 November 2026** (the core, in the design chat), asked whether the core should be a package a project installs
     and whether anything more would make it better. Advised: no package, since every reader of the rules (Claude Code's
     imports, another provider's reviewer on GitHub, another tool) reads the repository's own files and installs
     nothing, and the hooks run the copy that was reviewed; instead a slimmer copy that leaves the dated reports in the
     core alone, syncs made once for several changes, a trimming pass over the modules since the cap was full, and the
     day's small leftovers (a clause in floor rule 14 for rule 3's case of a project with no trusted builder, "where one
     answers", a pointer check on the core's own files); another installer in the licence check and the queued checks
     left until a project's real use reports back. The owner agreed to all of it, on the condition that it was the
     advice.

     Behind `/reports export-ignore` in `.gitattributes` with `core.yml` and `scripts/pure-sync.mjs` comparing a copy
     without that folder, the trims of the same pull request, the clause on what is left to the owner in floor rule 14,
     and `scripts/pointers.mjs --core` in the tests workflow.

166. **12 November 2026** (the core, in the design chat), on the stand-in in a project of another owner, whose copy
     carries the core's archive: the first wording (the same day) kept its stand-in from the core's archive
     altogether. The owner held that the owner's answers are logical, and that some general principles of engineering
     and software design stand regardless, and asked whether it should be opt-in. Answered: not opt-in, which would
     need that project's owner to say so, but searched by default, that owner's own words first, and an answer that
     rests on the core's archive alone marked unsure, so that owner sees it first and can overrule it.

     Behind "and one resting only on the core's archive where the core's owner is another" in `modules/inbox.md`,
     "The stand-in".

167. **12 November 2026** (the core, in the design chat), on each project's own tests running again on a sync of the
     copy, which changes no line of the project and whose scripts the core tested before it merged, the owner asked
     for rules not to run tests on anything already tested. Answered: the rule stands already ("Nothing is reviewed
     twice", floor rule 8; a test "runs only where a change can affect it", core archive 9); what did not follow it was
     each project's own suites on a sync. Not all of it goes: the project's checks of its own files against the new
     copy, and a branch brought up to date, test what nothing tested before. The owner agreed to that answer.

     Behind "the project's own suites run on one only for what they take from the copy" in `README.md`, "How a
     project takes the core", point 5, and the sync note of the same day.

168. **12 November 2026** (the core, in the design chat), a day after item 142, seeing 22 open ideas across the
     repositories and one verdict among them, the owner asked why the stand-in was not answering them.

     Told why: the stand-in gives an idea its verdict while answering a question on its topic, or in the weekly sweep,
     which had never run, and "once a week" gave an orchestrator nothing to count from, so one started afresh could
     not tell when a sweep was due. Then, told that its verdict on an idea decided nothing, since every idea waited
     until the owner moved it into the progress file (the hold of item 142, which the owner had approved as part of
     that answer), the owner said the stand-in could authorize anything it was fairly sure of.

     Both changes were first built on those questions; the code review held them for the owner's word, and they were
     put to the owner as two, each for a yes or a no: the sweep due once an open idea has waited a week with no
     verdict; and a verdict the stand-in is sure of deciding an idea, a yes queued behind what stands in the progress
     file and a no closing it, any other left to the owner.

     To both, the owner agreed.

     Behind "once an open idea has waited a week with no verdict of the stand-in's" in `modules/orchestrating.md`,
     "On every wake", and "A verdict the stand-in is sure of decides one" in `modules/inbox.md`, which replaces item
     142's hold. What the stand-in is never sure of stays as it was: a call of taste, and an answer resting only on
     the core's archive in a project of another owner.

169. **12 November 2026** (the core, in the design chat), told that the core said who builds first but left each
     project to write down how a Claude session hands a task to another provider, and that neither game did: the owner
     explained that a hand-off is possible only through a tool that runs agents side by side or a plug-in in Claude
     Code, since through GitHub Codex in the legacy cloud cannot push and only reviews are to be had there, and proposed
     a more general rule, to hand off what can be handed off by the best way a project has, which the core should
     settle for an owner who does not know the options; and asked whether more such holes were left open without good
     cause.

     Shown that rule as a table (the tool that runs agents side by side, else the plug-in, else Claude's build) and six
     more places the core left to a project of another owner; offered the owner's rule and four of them as one change
     (how a reviewer other than Codex is asked; a reviewer that never answers; Codex's model and effort; which session
     is the design session in a project with none), the other two left until that project reports (a licence check for
     another installer; setting up a local machine), with the cap's room to be found or asked for. The owner agreed, and
     asked for a clear explanation of every change made to the rules.

     Behind "by the first way there is" in `modules/roles.md`, "The builders"; `modules/codex.md`, "Building";
     `modules/copilot.md`; "asked and not waited for" in `modules/reviews.md`, point 2; and "in a project with none"
     in `modules/inbox.md`.

     The second security review asked two things of the change, both taken into it: who reviews when a reviewer is not
     waited for, and that work built through the plug-in is pushed by its briefer, with no protected file in it and its
     builder named. Meanwhile the owner asked whether Copilot is always the last resort, and said it should at least be
     preferred over Claude.

     Told that Copilot reviewed ahead of Claude's reviewer only where a project named it, and built only under the tool
     that runs the agents side by side; offered it second in the default order of reviewers, and its agent on GitHub as
     a third way to build, after Codex's plug-in, with what that costs, that GitHub marks the call
     a preview and that it was not yet run; and asked again whether the cap may go to 46 KB. The owner agreed to all of
     it, on the condition that other tools are allowed for too.

     Behind the default order of the *code reviewers* and "a way the project names" in `modules/roles.md`. Copilot's
     building is not in the change: three rounds of review each found a step of it that only a real run can settle (its
     own push before any check of its diff, and the approval its workflows wait for, which asks a permission the
     sessions' sign-ins are set up without), so it is filed as an idea (issue 124) with what a run must show, and a
     project that has Copilot's agent names it as its own way meanwhile. The cap of item 164 goes from 45 to 46 KB on
     that yes.

170. **12 November 2026** (the core, in the design chat), told that the stand-in had given its verdict on some of one
     project's open ideas and that the newest had none, since its sweep took only the ideas that had waited
     a week: the owner decided that this was a glitch, and that the sweep takes all of them when it first runs.

     Behind "every idea that lacks one" in `modules/orchestrating.md`: a week's wait still starts the sweep, and once it
     runs it takes every open idea without a verdict, so none is left for a call of its own.

171. **12 November 2026** (the core, in the design chat), after the change of item 169 was merged with the ways of
     handing work over in order, but nothing on which provider builds where more than one can, the owner asked whether
     every other provider is treated like Codex, and how a project with both Codex and another chooses.

     Told that every other provider's builder follows the same rules and only Codex has a part in the core; that nothing
     chose between two that could both build; offered: the project's order if it names one, otherwise Codex first, a
     task one failed at twice going to the next and Claude's last; told what Codex first costs (work Codex built cannot
     have Codex's code review, and its security review fell to Claude's fallback reviewer, which spends Claude's usage),
     and that the rule needed room the cap did not have: 47 KB, or cuts. The owner decided that Codex can still be used
     for security, and otherwise agreed to how it was laid out, and to everything, now and before.

     Behind "Where more than one can build" in `modules/roles.md`, "The builders", and the *other builders* slot; behind
     the *security reviewer* slot's default, Codex of what its own provider built too, floor rule 3's two reviews
     standing; and behind the cap of item 164 at 47 KB.

172. **12 November 2026** (the core, in the design chat), an hour after item 170, whose words were read as the weekly
     sweep alone; told that ideas in one project and in the core still had no verdict, since the sweep starts
     only once an idea has waited a week and the stand-in, called for a question, judged only the ideas on that
     question's topic, the owner asked whether the stand-in was now told to take all when it steps forward.

     That change was written on those words and held when its review found them a question and no instruction. Asked
     then outright whether the stand-in, every time it is called, should give every open idea that lacks one its
     verdict, and whether the three ideas it had just given a sure yes in the core should be built (a feature that may
     wait for a later stage, the checks still unbuilt, a real run of Copilot's agent), the owner asked whether the
     session agreed.

     Told yes to each, in that order, the check that holds a merge for its security review advisory for a week first,
     and the run likely to need the owner's own approval of the agent's workflows once, and the owner agreed.

     Behind "whenever it is called, its verdict on every open idea that lacks one" in `modules/inbox.md`: item 170's
     wish that the sweep take all when it first runs meant any run of the stand-in, not the sweep's alone. The sweep of
     `modules/orchestrating.md` stays for a project where a week passes without a call.

173. **12 November 2026** (the core, in the design chat), by the owner's agreement in item 172 to the advice on the
     three ideas the stand-in had given a sure yes; the first, filed when one game listed it as a
     difference from the core: a feature that does not pay yet may wait for the later stage that brings what it needs.
     The stand-in rested it on the owner's words of items 86 (no conclusion can be drawn while the game is not fully
     built, but once it is feature complete this cannot be the case) and 107 (no temporary features), with item 89's
     limit that the computer players' bad play is never what waits.

     Behind the third outcome in "Using a feature must pay, measured three ways" (`modules/game-design.md`).

174. **13 November 2026** (the core, in the design chat), shown that the core's "every PR gets
     its security review, once, when it opens" was what GitHub's trigger can do, written as if it were the rule; that a
     security review of a sync had found what the core's own had passed; and that one of Dependabot's updates had merged
     with none: the owner proposed that the core state only the ideal, narrower use, for when the session itself calls
     the review, but still wait for one that starts by itself, as GitHub's triggers do.

     On widening Codex's automatic security review to every pull request so that Dependabot's were covered, the owner
     asked what it would add. Told that it adds next to nothing there (the diff is version numbers and checksums; floor
     rules 17 and 7 and the checks are what guard an update), and that running it with every code review costs more
     than it finds, the owner decided to go back to the team's PRs and to open PRs: where GitHub's trigger starts a
     review it is waited for, where a session calls it it is done where it adds something worthwhile, and a set-up
     whose sessions call another tool themselves uses reviews and security reviews to the full, not limited to what
     GitHub's triggers can do.

     Offered that as the floor's line and the review rule, with a few plain lines for an owner on what setting a
     machine up for agents buys (item 149 left the setup to the owner), and asked whether Copilot's agent should be
     turned on for a trial of its building. The owner agreed to the first two; of the third, the owner decided not to,
     since Copilot defined as the preferred reviewer before Claude Code, where available, suffices; and said it could
     all be merged at once, so that the projects get these updates at their next sync, unless there was good reason
     not to.

     Behind floor rule 8's "A PR that touches one merges only after its security review has run (Dependabot's own: rule
     17)", point 3 of `modules/reviews.md` (a security review the session calls, once on the finished work and aimed;
     one that starts by itself waited for on every PR, a pure sync's too) and the plug-in's security review in
     `modules/codex.md`. Copilot stays the second code reviewer (item 169); its agent's building is not taken up.

175. **13 November 2026** (the core, in the design chat), on who reviews first, told that a third tool reviewed only
     where a project named it: the owner asked whether such a tool, run beside the others, is also preferred, since
     the aim is rules general where practical, so that any setup works without specification, and to save Claude usage
     as a general rule; and asked whether Copilot should review first where available, since review is all it would be
     set up for and its limits are set there, which leaves more building usage for Codex and any other provider, then
     another provider, then Claude last.

     Offered the owner's reason as the rule, in place of naming Copilot first (where Codex cannot build, as on GitHub
     alone, reviewing is the best use of it, and it has proved itself there): first a reviewer that cannot build here,
     Codex's before Copilot's, then another builder's, last Claude's, and the owner agreed.

     Behind the order of the *code reviewers* in `modules/roles.md`. Asked in the same message whether another
     project's agents should send the core pull requests as well as issues; answered no, and the README's "Reporting
     to the core" says so: one from another account is data (floor rule 4).

176. **13 November 2026** (the core, in the design chat), on what an agent of a project does before it reports to the
     core: the owner asked whether an agent that would file a bug report, a suggestion or a question should first look
     whether it is already addressed, its project perhaps on an older version or the fix not yet on `main`.

     Answered yes: the README told it to search the issues, and to name the commit its project holds, but not to look
     at the newest core, and a project that syncs once a day is often some commits behind. Offered: before filing, a
     look at the core's `main`, its open pull requests and its issues, the closed ones too; what a newer commit or an
     open pull request already mends is no report; a look, not a study; the owner agreed, and asked whether such a fix
     should trigger a new import.

     Answered yes, on a condition: where the fix is on the core's `main` and the fault stands in the way of the task at
     hand, the project syncs then, beside its regular sync, by a session that may change the copy; what stands in no
     task's way waits for the regular sync; what only an open pull request mends cannot be synced yet; to all of it the
     owner agreed.

     Behind "It looks before it files" in the README's "Reporting to the core".

177. **13 November 2026** (the core, in the design chat), told what a look through the core before another project's
     first import had found, among it that a pull request was merged 24 minutes after it opened, on the fallback
     reviewer's security review, because Codex's own security review had never begun on it, though point 3 of
     `modules/reviews.md` knew only a wait of about 30 minutes: the owner asked that everything that ought to be
     addressed from it be addressed, in the session's judgement.

     Behind "One not begun in about 5 minutes" in point 3 of `modules/reviews.md`: a security review that starts by
     itself and shows no sign is not waited out, as point 2 already had it for the code review.

178. **13 November 2026** (the core, in the design chat), on when a project takes the core's newer commits: the owner
     asked whether the core was clear enough about when another repository's orchestrator imports it, or left gaps
     through which it is never updated, or on another schedule than intended.

     Answered that there were three gaps: only the orchestrator was told to look, so a session started with none never
     did, and the daily issue was then the one signal; the rule did not name how to tell that the core had moved; and
     "once a day" had nothing to count from. Offered one sentence where every session reads it at the start of a task,
     "A session no orchestrator started, and the orchestrator on every wake, first checks whether the core has moved
     (the script named) and imports if so; where checks cost money, not while an import pull request from the same day
     exists.", and the owner agreed.

     First written shorter than offered, to fit the rules' size; asked whether it stood as offered (item 179), the owner
     agreed to keep it.

     Behind the last sentence of "Sessions" in `modules/work-flow.md`.

179. **13 November 2026** (the core, in the design chat), told that the wait for a security review that starts by itself
     had been written in the review rules and not in the floor, where the owner had been told it would stand, because
     the floor had no room under the rules' size cap: the owner decided that whatever ought to stand somewhere, and was
     cut or moved for size, is put back wherever it happened, and that rules lacking anchors be looked for and mended.

     Told what would follow: the cap raised one step and its principle written down (it keeps the rules lean and
     decides nothing else), every rule moved or cut for size put back, and each limit a session cannot check given
     what it counts from; the owner agreed to all of this.

     Behind floor rule 8's "A security review that starts by itself when a PR opens or is marked ready is waited for and
     read on every PR, a pure sync's too"; the cap at 48 KB and "The size cap keeps the rules lean and decides nothing
     else" in `AGENTS.md`; and, put back or anchored: the fallback reviewer named in the *code reviewers*' order and
     "its closed PRs and the *progress file* say" in `modules/roles.md`, a posted security review "naming the tool and
     the commit it read" and "the project's newest PRs that asked it show" in `modules/reviews.md`, and the hints the
     orchestrator's rule had lost.

180. **13 November 2026** (the core, in the design chat), asked what each provider's tool reads first from a project,
     and told that the tools take their instructions from more files than floor rule 3 named as rule files. Offered:
     floor rule 3 names as rule files "any file a tool takes its instructions from, wherever it lies", with those
     files' names as examples, and the owner approved.

     Behind "and any other file a tool takes its instructions from, wherever it lies" in floor rule 3.

181. **13 November 2026** (the core, in the design chat), asked for a take on everything the owner had said yes to on 12
     and 13 November. Told: keep all of it; add a reader for a review that comes in after its PR merged, since "a late
     review is still read" named none and a session stops at the merge; reword the *code reviewers*' order, whose
     "(Codex's, then Copilot's)" could be read as if Codex never builds; and give "Never a pull request" in the README,
     written on a question of the owner's, its yes. The owner agreed to all of those takes, with a concern that the cap
     could blow up, though the hard cap was worse, and that it be expanded only when it has to be; and then proposed
     that a reviewer concur that condensing is not possible before the cap is expanded.

     Told that it should, and that a code reviewer reads the change before it and not every rule each time, the owner
     asked whether an independent verifier session would be better, since condensing is mostly of what was there
     before.

     Told that it is: a fresh session that wrote none of the change reads all the rules for room, what it finds is
     trimmed, and the cap rises only if that is not enough, the reviewer blocking a raise without that check. The code
     review of the change held that a question of the owner's is no yes (`modules/how-to-work.md`), so the owner was
     asked outright whether this repository's review guidelines should gain that blocking point; the owner agreed to
     all of it.

     Behind "a finding of the last week by a reviewer the project asks, made after its PR merged, with no reply, is
     answered as point 5 says" in `modules/reviews.md` and "then both read what reviews left after a merge" in
     `modules/work-flow.md`; "Codex's before Copilot's, where neither builds" in `modules/roles.md`; "Never a pull
     request" in `README.md`; and "It rises only when it has to" and "a raise of the size cap in a PR with no "Leanness
     check:" comment" in `AGENTS.md`.

182. **13 November 2026** (the core, in the design chat), told that the core's cap and its fresh-session check were the
     core's own, and that a project's marks moved with a reason alone: the owner asked why a project's size cap should
     not work by the same mechanism and rules, a builder not pursuing a raise where a split is more sensible.

     Told that the owner was right for one of a project's two kinds of mark: a file past the split mark is split, as
     before, while a mark on what every session reads at its start should rise as the core's cap does (said shorter,
     what is said twice trimmed, what no session needs at every start moved to a file read when needed, then a fresh
     session's read of those files, and only then the mark, a reviewer blocking a raise without that check), growth
     that a sync of the core brings aside; and that this touches the review guidelines every project takes, so needs
     the owner's yes; the owner agreed to all of it.

     Behind "A mark on what every session reads" in `modules/review-guidelines.md`, which the core's own cap now
     follows too (`AGENTS.md`).

183. **13 November 2026** (the core, in the design chat), told what a fresh session's read of all the rules for room
     had found in the floor: six wordings another floor sentence already says. Recommended: yes to three (the opening
     of `floor/topics.md` drops "read before a task touches one", which `floor/security.md` says; the opening of
     `floor/threat-model.md` drops "The part every project shares", which its title says; rule 17 drops "the one
     exception to rule 4", which rule 4 says), and the other three left alone (rule 3's list of files, a pronoun for
     the owner in rule 14, "key or secret" in rule 1); the owner agreed to apply all the recommendations.

     Behind those three wordings in `floor/topics.md` and `floor/threat-model.md`; no rule's meaning changes.

184. **13 November 2026** (the core, in the design chat), after a fresh session's read of all the rules had found
     trims and some had been taken and some left by the design session's own judgement: the owner asked for clear
     criteria of what must remain for a condensing to be valid, and for a full audit of all the core's rule files under
     them, the cap set where it ends.

     Told: yes to criteria, written into the rule as the test for every trim (a reader with the trimmed text and what
     that reader has already read acts the same in every case; who a rule binds and when, what it asks, every limit
     and exception, what enforces it, its reason and each name and example stay; only a second statement of what that
     reader has already read, or words carrying none of these, may go; in doubt the words stay); yes to one audit
     pass under them over all the core's rule files, any trim in the floor listed for the owner's yes; and the cap set
     at the next whole KB above the result, not at it, since a cap with no room makes every one-line mend pay for a
     read of all the rules; the owner agreed to all of it.

     Behind "A trim is valid" in `modules/review-guidelines.md`.

185. **13 November 2026** (the core, in the design chat), the owner asked for a rule that a finished session or
     helper is archived, by the orchestrator at least, also when it was told to stop for usage with its work pushed, and
     whether sessions can and should archive themselves.

     Told: yes, by the orchestrator and not by the session itself, which is the worst judge of whether it is finished
     and whose last message must be read first; once its task merged or it stopped with its work pushed and its note
     left, a stop for usage too, a fresh builder picking up from the branch; its last message read and nothing scheduled
     bound to it; archived, never deleted; never a session the owner works in or one waiting only on the owner's yes; a
     session nobody orchestrates says in its last message that it can be archived; and that whether an agent can
     archive a session depends on the tool that runs them, which the design session could not confirm for every one;
     the owner agreed to all of it.

     Behind "A finished session is archived" in `modules/orchestrating.md` and "that it can be archived" in "Sessions"
     in `modules/work-flow.md`.

186. **13 November 2026** (the core, in the design chat), the owner asked whether the core says anything of occasional
     clean-ups and condensing runs, and whether a clean-up a project schedules in its work queue would cover the rule
     files and use the new criteria and checks.

     Told: the core schedules none, rightly, since when to clean up is a project's own queue entry and a file reaching
     its mark is what forces a condensing; but the test for a valid trim stood inside the rule on raising a mark, so a
     clean-up that trims a rule file for another reason was not plainly bound by it. Offered: the test holds for every
     trim of a rule file, whatever it is made for, with no fresh session's read where nothing rises; the owner agreed.

     Behind "It holds for every trim of a rule file, whatever its purpose" in `modules/review-guidelines.md`.

187. **13 November 2026** (the core, in the design chat), on the rule that a finished session is archived: the owner
     asked that sessions also clean up, everything future work needs pushed and the rest removed, since outside the
     cloud they tend to leave worktrees, scratch files and branches behind.

     Told: yes; the session cleans up what it made before its last message, since it knows what that is, and the
     orchestrator checks before it archives and does it for a session that could not; only what the session itself
     made; a worktree, clone or local branch goes only where nothing in it is uncommitted or unpushed, the rest pushed
     or left and named; what it started is stopped; no other session's folders and no branch on GitHub; nothing to do
     where the machine ends with the session; the owner agreed to all of it.

     Behind "clean up what you made" in "Sessions" in `modules/work-flow.md` and "It first checks that the session
     cleaned up" in `modules/orchestrating.md`.

188. **13 November 2026** (the core, in the design chat). The audit pass had found one trim in the floor (rule 17's
     "the release notes read", as held by rule 7's source check) and it had been recommended to the owner, who said
     yes. Told before anything was changed that the recommendation was wrong: rule 7's source check covers only what
     ships and what builds it, so for an update to a tool that only runs, rule 17 alone asks that the release notes be
     read, and the words stay: the owner withdrew the yes, and asked whether the criteria should be made clearer to
     avoid such false positives.

     Told: the test already rules that trim out, but "a second statement" did not say what makes two statements the
     same; offered that a second statement counts only if it covers every case the removed words do, with the same
     force, and that whoever proposes a trim names the other statement and what it covers; and that the nineteen trims
     merged that day had been gone over again, scope against scope, and held; the owner agreed.

     Behind "one that covers every case the removed words do, with the same force" in `modules/review-guidelines.md`.

189. **13 November 2026** (the core, in the design chat): the owner asked that the owner, referred to by a gendered
     pronoun everywhere in the core, be named in words that fit any owner, and asked how a project tells whether the
     core's archive holds its own owner's decisions when the stand-in uses it.

     Told: every such word in the core's rules would be reworded to fit any owner ("the owner", or "they" where no one
     else could be meant), the floor's among them on these words, and the words added to the check that fails what
     fits only some projects; this archive stays as written, a dated record. And told that a project tells whose words
     the core's archive holds by two accounts in its manifest, the one in the core's address and its *owner's account*,
     which the rule would now say; the owner approved all of it.

     Behind the wording of the owner throughout the floor, the modules, `README.md` and `setup/`; the last pattern in
     `scripts/general.json`; and "the account in the core's address in the manifest not being the *owner's account*"
     in `modules/inbox.md`.

190. **13 November 2026** (the core, in the design chat): the owner asked whether another project takes all modules,
     whether it did at its first import, and whether it takes new ones at its daily syncs.

     Told: a project's copy of the core always holds every module, and each sync brings its newest text; which modules
     apply is the manifest's line, "all" or a list; changes inside a module a project takes arrive by themselves, but a
     list does not gain a new module by itself and nothing told a project so. Built at once as an obvious improvement,
     to reach the next import: a note for every project, and a sentence in the README.

     Behind "A list of modules does not grow by itself" in `README.md` and the note "the modules a project takes" in
     `setup/sync-notes.md`.

191. **13 November 2026** (the core, in the design chat): the owner asked whether a full audit should be done again.

     Told: yes, by a fresh reader of the whole core as it then stood, with the imports replayed and every suite run;
     plain faults mended at once, each reviewed, and whatever would change what a rule asks listed for the owner; the
     owner agreed.

     The reader found nine faults and some doubts. Mended: a late security finding that holds was to be filed as a
     bug, which floor rule 9 forbids of a weakness; the call for late findings read only those written on a line; the
     core's own `AGENTS.md` took no part of "Sessions", so no one here read late reviews or cleaned up; a clone was
     left out of what a session cleans up; and pointers and descriptions that no longer held (`README.md`, the header
     of `scripts/reading-size.mjs` and of the security-review workflow). The rules stood 17 bytes under the cap and
     the mends add 94: a fresh session's leanness check found too little to trim, its answer in the PR, and the cap
     rose one step, to 52 KB. Left for the owner, each in the PR: a trim of the floor the check found, and the doubts
     that would change what a rule asks.

     Behind "a weakness: floor rule 9" in `modules/reviews.md`; "those not on a line" in `modules/github-calls.md`;
     "worktree or clone" in `modules/work-flow.md`; "It also does here what "Sessions" in `modules/work-flow.md` asks"
     and "one step of a whole KB" in `AGENTS.md`; and the cap in `scripts/size.mjs`.

192. **13 November 2026** (the core, in the design chat; of `scripts/general.json`): on finding the owner's username
     written into that file, the owner asked whether it was wise to anchor things to a name that can change at any
     time, rather than state the repository's owner.

     Told: in that file the name is a banned word, which keeps it out of the rules; that the account stands in about ten
     places outside the archive, each an address or the one anchor of whose word counts, which is stated on purpose and
     never inferred; that GitHub needs it written out in a workflow's call to another repository and in an issue
     template's assignee; and that the scripts could share one place for it, a change for later. The owner agreed
     fully, and decided that it stands in one place at least, so that it changes once, failing a way to follow the
     account's name by itself, and that all that had been agreed be finished.

     Behind `scripts/core-address.mjs`, which every script that names the core reads; the one `CORE` of
     `.github/workflows/core.yml`, which may not read it from the copy it checks; the words check banning the
     account's login from there, the list no longer holding it; and `scripts/core-address-test.mjs`, which holds each
     place GitHub needs it written out to the one, and fails in the core's own repository where that is not the one
     named: the nearest to a name that changes by itself that GitHub allows.

193. **13 November 2026** (the core, in the design chat; of what the second audit left for the owner): the owner asked
     why its leftovers were needed, if they were proven to hold to the criteria.

     Told: the trim of the floor holds to the test and waits only for the yes the floor asks of any change to itself;
     that three of the five wordings change nothing a rule asks and were the design session's to mend, which it does;
     and that two are decisions the test cannot settle.

     Behind "save a helper whose definition gives them" in `modules/claude.md`, and a reviewer's login in
     `modules/codex.md` and `modules/copilot.md`.

194. **13 November 2026** (the core, in the design chat). Asked outright for two answers: yes or no to the trim of the
     floor the leanness check had found valid ("; the rest are in `floor/security.md`" in the opening of
     `floor/topics.md`, which `floor/security.md` says of it in its own opening), advised as a yes since a valid trim
     goes whether or not there is room; and yes or no to the floor winning where two rules pulled against each other:
     floor rule 8 has a security review that starts by itself waited for on every PR, and point 2 of
     `modules/reviews.md` had a reviewer that failed three times running asked and not waited for, "the security
     reviewer too". Advised: the floor stays as it is and the module says so, since waiting on a broken reviewer costs
     minutes and skipping the review that starts by itself costs more. The owner agreed to all that was advised.

     Behind the opening of `floor/topics.md`, and "A security review that starts by itself is still waited for" in
     `modules/reviews.md`. One more case was filed as an idea.
