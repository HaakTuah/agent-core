- `scripts/look.mjs`, `.github/workflows/look.yml`, `.github/workflows/own-look.yml`: the scheduled look, once a day,
  keeps in issues what has stopped, what is due and what is overdue, and the monthly state report. *Runs:* the runners
  on a schedule; an orchestrator's wake. *Else:* the host's stale-issue actions and Renovate's dashboard, dropped on
  fact: they know nothing of the core's states; the host's agent jobs, dropped on fact: billed. *Bugs:* 3, and 2 naming
  `look.yml`. **Keep:** nothing fits.
