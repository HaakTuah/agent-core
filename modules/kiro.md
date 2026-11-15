# Kiro's part

Read by a session of Kiro, and by whoever hands Kiro a task or a review. From Kiro's documentation alone (kiro.dev,
its pages on steering, hooks and the command line, read on 15 November 2026), as `modules/tools.md` asks until Kiro
has passed the staged cases.

- **What it reads:** an `AGENTS.md` at the root, always, and one in any folder it works in; the steering files under
  .kiro/steering, in which `#[[file:<path from the root>]]` pulls a file in. Its entry file from the starter kit,
  `.kiro/steering/core.md`, holds a line of that kind for each file `AGENTS.md` names, this part and
  `modules/other-builders.md`.
- **Handed a task:** in its editor, the brief as a chat's first message; from its command line,
  `kiro-cli chat --no-interactive "<the brief>"`, which reads its key from `KIRO_API_KEY`, set by the owner on the
  machine it runs on and never in a session's or a cloud environment's variables (floor rule 1). A review is asked of
  it the way `modules/tools.md`, "Each tool's part", gives for a tool with no review app.
- **Hooks:** it runs a command before a tool is used, which may block it, and when the agent stops, each set in a JSON
  file under .kiro/hooks. The starter kit's `.kiro/hooks/work-saved.json` runs the work-saved hook's copy merged into
  `main` when the agent stops; what Kiro does with its exit and its words, its documentation does not say, so #400's
  run shows it. It has no start event.
- **Its folder:** .kiro (steering, hooks, its agents), which floor rule 3 protects.
