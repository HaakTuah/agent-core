# Copilot's part

Read by whoever asks Copilot's code review: the tool `copilot`.

Asking Copilot's code review, unless the ruleset does: `gh api -X POST
repos/<owner>/<repo>/pulls/<n>/copilot-code-review`. It marks nothing blocking: what "What blocks" in
`roles/shared/review-guidelines.md` names does. Its login is read from a review it gave (`.user.login` under
`pulls/<n>/reviews`).
