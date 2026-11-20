# Claude's part: auto mode

Read by a session of Claude Code in auto mode before it edits on the host text that someone wrote, and once that mode
refuses such an edit: the kinds `cloud` and `host` (what a tool's part says: `tasks/tools.md`, "Each tool's part").

**Auto mode may refuse** (#990). By default a session of Claude Code makes the calls its task needs. The one condition
that changes it: in auto mode a classifier reads each action before it runs and blocks what it takes for destructive,
irreversible or aimed outside the session's environment, which by default it trusts only for the working directory and
the repository's own remotes; an edit of an issue's or a comment's text on the host may be among them, and a call it
blocked, tried again, is read again and may be blocked again (its documentation, "Configure auto mode" and "Choose a
permission mode", read on 20 November 2026). The trigger is the classifier's refusal of such an edit: the session
neither tries the call again nor reaches the same end another way (another command, tool or helper); it files the step
as a task labelled `needs-owner`, naming the step and how many texts it left, never their links nor anything it would
have cut, which go to the owner in its own chat alone, as step 700 says of what it edits, and goes on with the rest of
its task. The owner allows the step by an entry under `autoMode`, which that mode reads from the owner's user settings
or the organisation's managed ones and never from the project's, by a permission rule, or by saying so to the session in
person, or takes it in a session the owner starts. It does not mean that the session asks the owner in its chat and
waits, that it writes such an entry or rule itself, which would widen its own mandate, that a refusal of any other call
is filed so, or that a call the classifier let through is filed. Reason: in the staged case `steps` a session refused
the host half of a sync step only said so, and nothing named the limit or what came next. Held by nothing yet (#1012).
