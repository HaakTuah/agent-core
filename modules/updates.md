# Updates: Dependabot, CodeQL and Node

How packages, tools and Node itself are kept current, and what GitHub's own checks do. Read when a task takes an
update. The safety rules every update keeps (exact versions, the week's wait, the source check of what ships,
Dependabot's security PRs): `floor/security.md`, rules 4 and 7.

**The newest version, unless there is a reason** (core archive 65), so fixes, security fixes above all, are always one
small step away, and small steps stay cheap. Updates are upkeep, not ideas: they wait for no queue entry and no word
from the owner, except where `floor/security.md`, rule 3, asks for his yes (`.github/` and the setup script).
Dependabot's version updates (`.github/dependabot.yml`: weekly, grouped) come as PRs into `develop`, merged under
`floor/security.md`, rule 4: the next free lane takes one as an ordinary small PR, runs the checks, gets its code review,
reads the release notes for breaking changes, and merges it, with the licence gate (`floor/security.md`, rule 10)
checking it too (core archive 37). A new major version is its own PR (taken out of its group if Dependabot grouped it),
with the project's *major version checks*. One is held back only for a reason: it breaks something, runs or loads worse,
changes its licence, or its project is abandoned or changes hands. The reason is written in the closed PR and in an
issue that stays open until the reason is gone.

**Node's version** (core archive 39). CI's `node-version` and the cloud machines run the same Node, so a check that
passes in a session passes in CI. Each October, when a new even-numbered Node becomes long-term support, both move to
it in one PR (CI and `scripts/cloud-setup.sh`), proven by the full suites; an odd-numbered one is not taken.

**CodeQL checks every PR** into `develop` and `main`, every push to them and once a week
(`.github/workflows/codeql.yml`). A finding on a PR shows on it as a note; what to do with it is in
`floor/security.md`, rule 9. Alerts already in the code are the owner's to pass on (rule 9).
