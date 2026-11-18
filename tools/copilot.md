# Copilot's part

Read by a session of the tool `copilot`, and by whoever hands Copilot a task or asks its code review.

Asking Copilot's code review, unless the ruleset does: `gh api -X POST
repos/<owner>/<repo>/pulls/<n>/copilot-code-review`. It marks nothing blocking: what "What blocks" in
`roles/shared/review-guidelines.md` names does. Its login is read from a review it gave (`.user.login` under
`pulls/<n>/reviews`).

As a builder (from its documentation, docs.github.com, its pages "Adding repository custom instructions" and "About
GitHub Copilot cloud agent", read on 18 November 2026, until it has passed the staged cases: `tasks/tools.md`):
- **What it reads:** the nearest `AGENTS.md` in the folders it works in, so it needs no entry file; it pulls in no file
  that names, and opens each itself (`tools/other-builders.md`).
- **Handed a task:** on GitHub, the brief as the first message of a conversation started from the issue or the
  Copilot panel; it works on one branch and opens one pull request for the task.
- **Hooks:** repository hooks in `.github/hooks/*.json`, at a session's start and end among others; the starter kit
  writes none yet (#682).
