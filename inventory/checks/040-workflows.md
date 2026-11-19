- `scripts/workflows.mjs`: fails a workflow or action in which the word `pull_request_target` stands, and, through
  `scripts/yaml-keys.mjs`, one that gives a key twice. *Runs:* any session and the runners. *Else:* zizmor (MIT, a
  program for each system, its audit `dangerous-triggers` among some 30), kept, tried above; actionlint (MIT, Go, its
  syntax check refusing a key given twice, and, where shellcheck is installed, each step's script), kept; yamllint's
  `key-duplicates`, dropped on fact: Python, and actionlint holds it. *Bugs:* 1. **Replace** with zizmor and actionlint,
  which read far more of floor rule 2 than a word and a key; the core's list of what is forbidden stays its own policy,
  given as the tools' configs, and a finding the core judged safe is allowed there with its reason. This takes
  `yaml-keys.mjs` out of #486's YAML package. Found by the challenge, untried: ghalint (MIT, one program, 1.6.0) and
  poutine (Apache-2.0, one program, 1.1.6), each reading a workflow's security policy; proposed for the replacement's
  comparison beside zizmor and actionlint.
