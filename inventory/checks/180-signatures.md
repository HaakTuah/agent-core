- `.github/workflows/signatures.yml`: installs the packages with their scripts off, runs `npm audit signatures`, and
  reads each installed licence back. *Runs:* the runners, and any session. *Else:* it is npm's own tool already.
  *Bugs:* 1. **Keep:** the job is npm's; the core holds only its call.
