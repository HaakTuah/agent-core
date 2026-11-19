- `.github/workflows/personal-terms.yml`: fails a pull request whose files, commits, title, description or branch hold a
  term of the secret `PERSONAL_TERMS`. *Runs:* the runners, where the secret is. *Else:* gitleaks (MIT, Go), kept: its
  rules may be written when the job runs, from the secret, and it reads text given on its input too; its maker now
  issues only security fixes for it and builds Betterleaks, which reads the same rules (fact, as reported in March
  2026), so the lookup of #488 picks between them; TruffleHog (AGPL-3.0, allowed for a tool that only runs), dropped on
  an assumption that the challenge measured wrong, and so proposed for the replacement's comparison: its live check of
  a secret turns off (`--no-verification`), as does its look for a newer version of itself when it starts
  (`--no-update`), and so run, offline, with both, over the core's files with a fake key and a term planted, 3.99.7
  found what gitleaks 8.30.1 found (the key, and the term through a rule of its own) and two addresses holding a
  password in two tests' data, which gitleaks did not; 184 MB against gitleaks's 24 MB, 1.3 s against 0.9 s. With its
  defaults it would send each secret it finds to the service the secret belongs to, so it is never run without both.
  *Bugs:* 1.
  **Replace** the matching with gitleaks or its successor, which also brings the scan for secrets that floor rule 1 has
  no check for in a private project (the host's own is paid there); **keep** what is read (each commit's names and
  addresses, the title, the description, the branch) and the exception for commits the host made.
