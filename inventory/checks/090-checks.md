- `scripts/checks.mjs`: runs the checks that need no secret, part by part, as the workflows do and as a session may by
  hand. *Runs:* any session and the runners. *Else:* a task runner (npm scripts, just, make), dropped on fact: a project
  in another stack has none of npm's, and the others are installs. *Bugs:* 2. **Keep:** small and stable glue.
