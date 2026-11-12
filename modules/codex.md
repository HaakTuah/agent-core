# Codex's part

Asking Codex: for a code review, a comment `@codex review` alone (it answers every mention of itself, even in backticks,
so other text says "the Codex mention"); its security review runs by itself when a PR is opened for review or marked
ready. Through GitHub it builds nothing: a task started there cannot push (core archive 169).

Building, where Claude Code has its plug-in (`/codex:setup` says if it is ready): the brief goes to the subagent
`codex:codex-rescue`, in a working tree of the task's own; `/codex:review` is its code review where its GitHub app is
not on the repository. Its model is its plan's; its effort high, never above. What it follows:
`modules/other-builders.md`.
