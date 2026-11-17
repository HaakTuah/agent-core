# Updates: Dependabot, CodeQL and Node

Read when a task takes an update: the kind `update`, which a changed lock file is of (`scripts/reading.mjs` lists
them); the paths `.github/dependabot.yml`, `.node-version` and `.node-least`. Its safety rules: floor rules 7, 15 and 17.

**The newest stable version, unless there is a reason.**
- Updates are upkeep: they wait for no queue entry.
- Dependabot's version updates (weekly, grouped) come as PRs under floor rule 17. They are kept up to
  date by its own rebase (a comment `@dependabot rebase`), never by merging `main`, so that every commit stays its own.
- What it cannot see, listed where each is written, the core's versions workflow checks monthly, an `enhancement` issue
  for each one behind.
- A new major version is its own PR, with the *major version checks*.
- One is held back only for a reason (it breaks something, runs worse, changes its licence, or its project is abandoned
  or changes hands), written in the closed PR and an open issue.

**Node** runs the core's scripts in every project.
- By default CI runs the exact version in the core's `.node-version`, the pin, and a cloud setup runs
  `scripts/node.sh`, which keeps a machine's own Node where it is at or above the least long-term line in the core's
  `.node-least` and fetches the pin where it is below or there is none, by the checksums it holds; the core's own
  suites run on both (#526).
- When a new Node becomes long-term support, both the pin and CI move to it, proven by the full suites. When the line in
  `.node-least` leaves long-term support (Node 22 at the end of April 2027), the session that takes the issue saying
  so moves it to the next long-term line, proven by the suites on it; no check opens that issue yet (#538).
- It does not mean that a project's CI or its own code runs on the least line, that a session must run on it, or that
  a line above it but outside long-term support, which `node.sh` keeps all the same, is tested: what is proven is the
  least line and the pin. Reason: a project's machine holds whatever Node it holds, and every later step of the core's
  path stands on the scripts running on it.

**CodeQL,** where the repository has it, checks every PR into `main`, every push to it and once a week; a finding is
handled as floor rule 9 says.
