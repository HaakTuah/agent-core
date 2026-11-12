# Copilot's part

Asking Copilot for a code review, unless the ruleset asks it: `gh api -X POST
repos/<owner>/<repo>/pulls/<n>/copilot-code-review`. It marks nothing blocking: of its findings, what "What blocks" in
`modules/review-guidelines.md` names blocks.

Building, through its agent on GitHub: an issue that holds the brief, assigned to it (`gh api -X POST
repos/<owner>/<repo>/issues/<n>/assignees -f 'assignees[]=copilot-swe-agent[bot]'`). Its draft PR's workflows run once
its briefer approves them, at each push.
