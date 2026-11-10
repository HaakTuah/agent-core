# Where agents hold sign-ins

The owner's end goal (core archive 118): agents of every provider running side by side on a machine of his, each signed
in, so Codex can build, push and be watched as it works, which its cloud tasks cannot. The core holds it in general
terms only (core archive 119): floor rule 18 and the threat model say what such a machine may hold and run and how its
agents treat their sign-ins; `modules/orchestrating.md` and `modules/codex-building.md` say how sessions are started
and watched there; `modules/claude.md` lets the orchestrator set each session's effort where it can. What the machine
is, its tools and its setup stay out of every repository: the machine tells its own agents where they run.

## Readings taken

1. **The licence of the tool that runs the agents needs no change:** floor rule 10 already lets a tool that only runs,
   nothing of which ships, be under any open-source licence, copyleft included.
2. **Codex at high effort, never its maximum,** on its newest model: the owner took every effort below high out of
   Codex's settings, and Claude's own table keeps high for the hard work and never max.
3. **The GitHub access there cannot change workflows:** a branch pushed with a changed workflow could run with the
   repository's secrets before any review, so `.github/` changes keep coming from a cloud session, with the owner's yes
   (floor rule 3).

Questions for the owner: none.
