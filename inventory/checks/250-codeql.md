- `.github/workflows/codeql.yml`: runs the host's CodeQL on a public project's pull requests, its pushes and weekly.
  *Runs:* the runners. *Else:* it is the host's maintained tool already. On a private repository it is paid, so a
  private project does not call it (`README.md`, "A private repository") and has no scan of its code; Semgrep's
  engine (LGPL-2.1, from PyPI), with the core's own rules, will give it one (`CHOICES.md`, "Choice: a private
  project's code is scanned by Semgrep's engine, with the core's own rules"; built under #546). *Bugs:* 1. **Keep**
  for a public project.
