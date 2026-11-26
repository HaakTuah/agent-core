- `scripts/alerts.mjs`: the daily reading of the Dependabot alerts, filing each left open a day with no pull request
  of Dependabot's as a bug issue (#1142). *Runs:* an orchestrator's wake, with the session's own sign-in; never on the
  runners, whose token cannot read the alerts. *Else:* Dependabot's own security updates, kept as the first mend; the
  registry's audit of every lock file (#650), queued, whose builder makes the two one route; the host's alert
  notifications, dropped on fact: they go to the owner alone. *Bugs:* 0. **Keep:** nothing fits.
