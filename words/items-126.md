# The owner's words behind the core: items 126 to 156

What these are and how they are kept: `words/README.md`.

126. **10 November 2026** (the core), on the rule "No agent workflows and no ultracode" in Claude's own module, told
     that the helper rules already say when helpers pay and cap them at five, and that the rule bans a tool rather
     than a behaviour: the owner decided that workflows are not banned where they can be genuinely helpful.

127. **10 November 2026** (the core). Told that a security review of a game's step 3 found that, on a machine where
     agents run side by side, the tests run the game's packages under the account that holds the GitHub token, so a
     bad package could take it; and that the fix is to run project code where no sign-in can be read, the owner asked
     how. Told that the separation sits below any tool (a throwaway box for the tests, given a copy of the clone), the
     owner asked that the agents keep internet access. Told that the agents keep full internet, and only the box
     holding project code has no sign-ins, with network only where its run needs it, the owner agreed.

128. **10 November 2026** (the core). A game's orchestrator started a builder on Opus without passing an effort, as no
     rule named one, and the builder ran at extra effort, the app's default for a new Opus session; asked, the
     orchestrator said its session tool takes an effort and that a session does not inherit its own. Told that so
     item 99's premise no longer holds, and that the audit's reading of medium effort for Sonnet lanes was never
     measured, the owner asked why Sonnet should not run on high. To the design session's answer (no strong reason:
     Sonnet is the cheap model, a review round costs more than the extra thinking, and one effort for every session is
     simpler; high for every session the orchestrator starts, Opus and Sonnet alike, and for the orchestrator, never
     above high without the owner's word), the owner agreed, and asked whether escalation still allows extra effort.
     Told yes: the escalation step keeps extra effort where the stuck builder already runs at high, as Claude's table
     sets it.

129. **10 November 2026** (the core). Told that the fallback security review of a game's sync to the core found three
     gaps left in the setup guide's test box (it covered only a project's install, build and tests; its instructions
     reached only Claude, though Codex runs the tests too; and only an instruction made the agents use it), that a
     security finding in a PR's own change blocks it until fixed, so the game's PR cannot merge with them open, and
     asked whether to fix the guide in the core now, the owner agreed.

130. **10 November 2026** (the core), on a game's ruleset page, which required neither code scanning nor code quality
     results: the owner asked why they were not required. Told that code scanning results are worth requiring (a
     false alarm then waits for the owner to dismiss it), that code quality results would block every merge, as no
     Code Quality check runs, and that Copilot's code review is no review the rules count, the owner chose to set the
     ruleset as shown (code scanning blocking on security alerts High or higher and alerts Errors, status checks with
     branches up to date, Copilot's review on). Told to leave code quality off, and asked whether the floor's
     false-alarm line should say the PR waits for the owner's dismissal where the ruleset blocks on the alert, with the
     same setting in every project, and whether Copilot's review should be advisory in the rules, the owner agreed to
     all. On the report's line that code quality results are not required, since no project runs GitHub's Code Quality
     check and GitHub warns that requiring them without it can block every merge, the owner said the setting had been
     made required, and that without the check it would not trigger.

131. **10 November 2026** (the core). Told that a game's builder had skipped the design session's comments on its PR,
     taking every comment from the owner's account with Claude Code's attribution line for its own, and asked whether
     to add a rule that such a comment is not necessarily the reader's own, the owner agreed to the rule, as a better
     fix than dropping the signature.

132. **10 November 2026** (the core). Told that the next security review of the game's sync found three small gaps
     left in the test box (plain `node` on the host was held back by the instruction alone; files returned from the box
     could rewrite a script the host then runs, where a sign-in is in reach; and the box user was not said to be kept
     from Codex's account), and asked whether to fix them in the core before the game merges, the owner agreed.

133. **10 November 2026** (the core). A game's orchestrator asked whether to start fresh builders for two PRs whose
     sessions it could not reach, and another held a PR for an answer the owner had already given; the owner asked
     whether the rules said anything about it. Told that no rule did, and asked whether to add one (a lane whose session
     cannot be reached, with no push for a few hours, goes to a fresh builder from its branch), the owner decided that
     the session handles it, with no further question where the answer is obviously yes.

134. **10 November 2026** (the core). After a day of orchestrators asking the owner what the rules already settled, the
     owner asked which rules made them ask so much, and decided that the rules the owner does not care about go,
     keeping the work loop and the pillars of good program and game design. Shown the plan (the rules that made agents
     ask; what to keep: the owner's safety words, the work loop and the pillars; what to cut; one pass; a size cap in
     CI; what can and cannot be guaranteed), the owner agreed to everything, and objected to the plan's line that
     readings go to the owner as question issues, the stand-in's unsure and taste answers landing in the owner's
     inbox: the agents are not to stop.

135. **10 November 2026** (the core), having turned on auto-merge as an option in every repository, the owner asked
     whether to use it as a rule. Told yes, once Codex's reviews are clean on the head commit, since auto-merge waits
     only for the checks GitHub knows of, and the reviews are not among them, the owner agreed to everything.

136. **10 November 2026** (the core), on Claude's table of models and effort, the owner asked why every effort was
     high and why the search helper's was not set. Told that the search helper's effort was indeed left unset, against
     the rule to pass both model and effort, and that it gets low, since searching needs little thinking; the rest is
     high only where judgement decides the cost.

137. **10 November 2026** (the core). Shown two orchestrators' reports asking the owner for yeses already given and
     settings already made, the owner decided that everything be fixed, so that they stop asking such questions.

138. **10 November 2026** (the core). Told that a Playwright update in a game touched nothing of the owner's, and that
     the owner's yes on the cloud setup script and on workflows protected nothing the owner could judge better than the
     reviews, with the proposal that such changes pass two independent security reviews (Codex's and a fresh Opus
     reviewer's) instead, the owner's yes kept only for spending money, what cannot be undone, the safety rules
     themselves and a licence exception, the owner agreed.

139. **10 November 2026** (the core). Told that each game's sync PR was being reviewed by Codex again, after the same
     text had passed both reviews in the core's own PR, the owner decided that no review or check is done twice
     without reason.

140. **10 November 2026** (the core). Told that a pure sync would keep its security review although its code review
     goes, since dropping both had been refused as weakening security, the owner objected, since the security review
     was already done when the change was made in the core's own repository.

141. **11 November 2026** (the core; first in both games, 2 November 2026). On the audit of what players read, the
     owner asked whether it had no review scored 1 to 10. To each kind of text scored 1 to 10, only a 10 passing, the
     owner agreed, having read the lines before and after the final word. Told that both games had written that bar
     for themselves, and asked for the owner's yes to move it into the core's review guidelines, which change only on
     the owner's word, the owner agreed.

142. **11 November 2026** (the core). The owner asked why the stand-in did not answer on ideas, and whether it could do
     more. Told that it answers open points in work the owner has chosen, while nothing is built from an idea until the
     owner moves it into the progress file, and offered its verdicts on ideas, its sureness and a check of what players
     see, the owner liked the stand-in doing more, and asked that it give them in the answers it already gives rather
     than in calls of their own. To doing so, with one weekly sweep for the ideas no answer touches, the owner agreed to
     everything.

143. **11 November 2026** (the core). The owner asked whether rules were duplicated that should be in the core. Told
     which rules the games repeat from the core, and which rules one game wrote that hold for every game or project (an
     optimization changes nothing a player would notice; a feature too rare to change whole games judged per use and
     against its counter; no refuges; a long task may end its session at a passed gate), the owner agreed to all of it.

144. **28 October 2026** (Amarna Letters, in the design chat), the words behind a reading listed with what it rests
     on, which that game's design document had written as part of its "Reason from the pillars"; moved here when the
     owner asked on 11 November 2026 for a thorough check that the core and both games were cohesive, with no
     duplication: the owner decided that Code should note where it has made an assumption, as it does with questions,
     so that it can be checked afterwards.

145. **31 October 2026** (Amarna Letters, its archive item 73, for both games, in the design chat), behind the polish
     lane, which each game then wrote for itself and which moved here on 11 November 2026, when the thorough audit the
     owner asked for found the two copies drifting apart, and the last lines both games still shared (what it looks
     for, and when it runs) the same day. The owner's reason for it: what capacity is left over goes to polish work.

     To the design session's shape of the polish lane, the owner agreed, asking that things be made as refined as
     possible.

146. **11 November 2026** (both games, in the design chat), after the final audit's report, behind the usage brake's
     removal from the core and both games (floor rule 16 among it, the owner's yes as the owner asked), and the return
     of "other providers first", which core archive 76 gave and the cut-down of 10 November had dropped: the owner
     decided that every reference to usage caps goes, and that the rules about spending other providers first, such as
     Codex, stay.

147. **11 November 2026** (both games, in the design chat), told that one shared workflow for the games' pull-request
     previews (an idea filed in the core) waited on the owner's yes, since it changes what runs with the token that
     publishes the site: the owner asked why one shared workflow was not used, and decided that obvious improvements
     are implemented automatically.

148. **11 November 2026** (the core, in the design chat), asked whether the core should be opened to a project of
     another owner, so that it takes the core whole, its updates through sync PRs, once the owner's GitHub account,
     written into five places (floor rule 4 among them), became a slot each project fills: the owner chose the answer
     offered as recommended, to open the core to the other owner.

149. **11 November 2026** (the core, in the design chat), asked whether floor rule 18 should gain an exception for an
     owner's own computer, since as written it forbade a setup an owner already runs: the owner decided that the setup
     is the owner's to make, and that rules on what set-up is allowed overreach, which is behind rule 18 cut down to
     what agents do, the setup itself left to the owner and `setup/server.md`.

     And, to the design session's answer (rule 18 keeps only what agents do; and the phrases of the core that assume a
     game or a live site, one of them in floor rule 12, are made to fit any project), the owner agreed to all.

150. **11 November 2026** (the core, in the design chat), once a project of another owner, not a game, could take the
     core; behind "Rules are written for any project" and the words check: the owner agreed, decided that every rule
     change made to the core from now on is general enough to account for it, and asked how to ensure it.

151. **11 November 2026** (the core, in the design chat), asked for the owner's yes to five places where the floor
     assumed a public web project on npm (everything public; npm's signature check alone, with "a check that cannot
     run holds the release back"; `npm ci`; text reaching "the page"; a session on the owner's computer holding "no key
     beyond its own sign-in"), after a sample project that was none of those took the core from nothing: the owner
     agreed with everything, added that NuGet and the like should be allowed, and asked whether there should be a
     criterion of being verified by a trusted source, such as NuGet itself.

152. **11 November 2026** (the core, in the design chat), told that a check of the core's own for actions not pinned
     had drawn a new way past it in each of five review rounds, since it read YAML by lines, and that GitHub's own
     setting "Require actions to be pinned to a full-length commit SHA" reads a workflow as GitHub runs it, but asks
     the same of GitHub's own actions, which floor rule 2 lets stand at a tag; the advice given: pin those too, then
     turn the setting on, the core and one project first, and keep of the check only its search for
     `pull_request_target`. The owner asked whether the no-install rule was sensible then, and to test the setting
     instead if so advised, and agreed to everything recommended.

153. **11 November 2026** (the core, in the design chat), shown six rules held only by discipline, each of which a
     check could hold, the sixth being that every PR says what the owner can try and what readings it took, which the
     advice at first left out as rarely broken; a count then showed about three in four merged PRs without the first:
     the owner agreed to all, held that mechanical enforcement of what agents get wrong in following the rules runs
     every time, and asked whether all six were added and why the advice had left out the sixth.

154. **12 November 2026** (the core, in the design chat), of a project of another owner, about to take the core; told
     that the core gave Codex the reviews alone, named Codex and Claude's reviewer where it meant a provider and its
     reviewer, and asked whether who reviews what should be a blank each project fills in, the owner asked what to do,
     concerned that the core would fight that project's setup. To point 1, the owner agreed, held that overrides are
     good, and asked whether general rules would be better, under which Claude hands out the work it can outsource by
     the best criteria, and different providers review each other where possible, with one reviewer.

155. **12 November 2026** (the core, in the design chat), asked whether more rules named one provider where they
     meant any, and shown five: who gives the security reviews (a floor rule among them), how a review is asked for
     and waited on, the instructions for a builder of another provider, how findings are graded (Codex by priority,
     every other reviewer by a score from 1 to 10) and the Node section of the update rules: the owner agreed to all,
     asked whether more rules ought to be generalized, said to do everything advised without interfering with how the
     work runs now, and asked whether Codex and GitHub Copilot can review so through GitHub, and why it was added for
     Codex, preferring one score out of 10 for all if all can give it.

     Told that Codex's reviews through GitHub still give priorities and no score (item 21), and Copilot's no grade at
     all, so that one score for all cannot be had: every finding is blocking or not, the score stays with every
     reviewer that can give one, and a tool's own grades are read as one or the other.

156. **12 November 2026** (the core, in the design chat), once a project of another owner had taken the core: the
     owner decided that no hook, check or rule may stop that project's work because its setup differs, while rules
     that enforce best practices stay. Behind the end of floor rule 10 (the owner's own work carries the terms the
     owner gives it, where it said no licence file ever), and the README's lines under "How a project takes the core"
     for a project set up otherwise, among them the default branch.
