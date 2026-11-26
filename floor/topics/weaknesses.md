# The floor, by topic: alerts and weaknesses

Read before a task takes up a security alert or a weakness, and by a security review: the kinds `alert` and
`security-review`.

**9. Security alerts and reported weaknesses.**
- **Sessions read the Dependabot alerts; the rest of the Security tab stays the owner's** (#1142).
  - By default, once a day, a session whose sign-in can read the repository's Dependabot alerts reads the open ones
    (an orchestrator's wake, by `core/scripts/alerts.mjs`); each open more than a day with no open pull request of
    Dependabot's for it becomes a bug task, mended as any update (`tasks/updates.md`, "An alert Dependabot does not
    mend"). Dependabot's own pull request stays the first mend (rule 17).
  - The one condition that changes it: no session's sign-in can read them; then the reading says it read nothing, and
    nothing waits on it.
  - The owner alone dismisses an alert.
  - No session reads secret-scanning alerts, whatever its sign-in allows.
  - Not meant: a key made so a workflow can read alerts (rule 1); a session acting on a secret-scanning alert, whose
    mend, revoking and replacing the secret, is the owner's; or any change for code-scanning alerts: a PR's own CodeQL
    findings are read as below, and the Security tab's list stays the owner's. Reason: an alert Dependabot cannot mend
    otherwise waits on the owner (rule 14), and its advisory is published. Held by `tests/alerts-test.mjs`, in part,
    which also fails a script, workflow or set-up of the core's that reads secret-scanning or code-scanning alerts or
    writes to a Dependabot alert; that a session does neither by hand, by nothing yet.
- **In a PR's own change:** a blocking finding holds the merge until fixed; any other is fixed in the PR, or filed and
  fixed next if it lies outside the change.
  - A CodeQL false alarm, explained in the PR and confirmed by its security reviewer, may merge, with no suppression
    comment; where the ruleset blocks on it, the owner dismisses it.
- **In merged code, if it reaches what the threat model protects:** reported privately (an agent: as "Reporting a
  weakness" says, never in a file, PR, issue or comment) and fixed first, in a PR that says what it hardens, never how
  to attack it.
- **Any other weakness in merged code:** a `bug` issue, fixed with priority.
- **Secret scanning with push protection is switched on** in each repository that has it (floor rule
  1): at the sync that brings this, and when a repository is made, in a public repository, where GitHub gives it free, a
  session whose sign-in may change the repository's settings switches it on; otherwise it files an issue for the owner,
  labelled `needs-owner`, naming the setting, and nothing waits on it.
  - Not meant: a session switching on what may be billed (a private repository's, sold per committer; floor rule 14),
    or a repository without it waiting or failing anything. Reason: GitHub then refuses a push holding a key of
    a kind it knows, before it reaches the history, which no check on a pull request can.

## Reporting a weakness

- Use GitHub's private vulnerability reporting: the repository's Security tab, "Report a vulnerability", which only
  the owner sees.
  - If you cannot, open an issue saying only that a weakness exists and which part it touches, with no details.
- An agent files by that reporting's own call alone (`POST repos/<owner>/<repo>/security-advisories/reports`), only to
  its project's own repository or the core's, whichever the weakness is in, with no secret or personal detail and, to
  the core, nothing of its project.
  - Where the call fails it tells its own owner in its session's last message, never an issue.
