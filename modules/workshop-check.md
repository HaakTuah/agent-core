# The workshop check

What slows the work as the project grows, measured weekly and fixed where it passes its mark. Read by the builder who
opens the week's first milestone PR.

Once a week, at the first milestone seven days or more after the last check (not at every milestone, since milestones
come daily and what it measures changes slowly; core archive 9 and 74), say in one line of that milestone PR what slows
the work as the project grows, and fix what passes its mark:

1. how long the checks take for a docs-only and a code PR, finding out why if either grew by over a fifth since the
   last check;
2. the files every session reads, each kept under its mark (the project's *size marks*), with done entries and answered
   questions moved to `docs/archive/` and a line pointing to them;
3. files that should be split by meaning ("Split by meaning" in `modules/how-to-work.md`), each in a PR of its own with
   behaviour proven unchanged (core archive 26);
4. merged branches, deleted from GitHub (their history stays in `develop`);
5. leftovers nobody uses (study scripts, logs and tools), archived or removed;
6. the rule files (`floor/security.md`, rule 3), audited by a fresh reviewer for contradictions, duplication, stale
   lines, unclear instructions and broken pointers, and for what can be cut: rules that overlap, say more than they
   need, or have never prevented a real problem, merged or dropped so the files get shorter and each change touches
   fewer places, every cut named in its PR with its reason (core archive 67). It runs once at the first milestone after
   10 November 2026 and then whenever more than about a fifth of their lines changed since the last audit (core archive
   54). A project's audit covers its own rule files; the core's are audited in the core (core archive 68).
