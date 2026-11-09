# The threat model: what every project shares

Who might attack a project's repository and its site, what they want, and where they could get in: the part every
project shares. A project's own threat model adds its users, what they hold and its own ways in, and says what its lower
stakes are; a security review reads both as the threat model. The rules that close each way in are in
`floor/security.md`, whose rule numbers this file cites.

- **Everything is public:** every file, its whole history, every PR, issue, comment and workflow run. So an attacker
  reads the code, the workflows and these rules before trying anything: no defence may rest on not being known, and
  every rule must hold against someone who has read it. Anything committed is public for good, even if a later commit
  removes it (rule 1 says what is done when a secret lands).
- **Who:** anyone on the internet. They write issues and comments, open PRs from forks, publish a package or action
  the repository uses, or plant text on a page a builder or Codex reads; and whatever else the project's own threat
  model names.
- **What is protected, and what an attacker wants of it:**
  - **The owner's accounts:** his GitHub account and its tokens, and his ChatGPT and Claude logins: reached through a
    workflow, a PR's checks or work handed to Codex (rules 1 to 4). His own machine runs nothing from the repository
    (rule 8).
  - **The branches and the site:** `main` (the live project), `develop`, the workflows that deploy, and GitHub Pages: a
    push to `main` or the site (rules 2, 3 and 12).
  - **The project's users,** as its own threat model says.
- **The ways in:** the workflows and what triggers them (rule 2); dependencies and actions (rules 2, 7 and 10);
  outsiders' text reaching an agent (rule 4); and the project's own inputs (rule 5).
