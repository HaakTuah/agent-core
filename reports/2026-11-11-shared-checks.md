# The pointer and reading-size checks, shared

Tonight's audit of both games against the core (the owner: "Are you absolutely sure there are no other overlaps,
discrepancies, or fat that should be cut or shared, between amarna and snakes, expert? Is the implementation of
agent-core in both, fully perfect?", then "Everything must be fixed, my protégé expert!") found that only Snakes had a
pointer check and a reading-size check, while Amarna's lane was building its own (Amarna #721). Both checks serve the
core's pillars, so they move here, once, for every project.

- **`scripts/pointers.mjs`:** Snakes' pointer check, unchanged in what it reads, run from the project it lies in. It
  no longer takes a package's name (`@types/node`) for a path.
- **`scripts/sizes.mjs`:** Snakes' reading-size check, its marks now a config of the project's (the *size marks*),
  with a `skip` list for what is not counted besides `core/` (the archive, generated copies).
- **`scripts/rule-files.mjs`:** the rule files now include those floor rule 3 names (`AGENTS.md`, `CLAUDE.md`,
  `SECURITY.md`, the core manifest), so a project lists only its others. Snakes had to list them, Amarna to name them
  in its copies config: neither needs to now. The copies check reads more of Amarna's files as prose.
- **`.github/workflows/copies.yml`:** runs both after the copies check, each even when one before it failed, with the
  project's marks as a second input. A change to what runs by itself: Codex's and the fallback reviewer's security
  reviews (floor rule 3).
- **`README.md`:** point 4 (list only the rule files the floor does not name), point 5 (the two checks), and the slot.

Tested on both games' `main`: Snakes' result is the same as its own checks' (111 pointers; its marks pass). On
Amarna, one pointer fails: its manifest names "The game in one page" as if it were a section of `AGENTS.md`, fixed in
Amarna's switch.

What changes in every project: after the sync, its `copies.yml` passes its *size marks*; its own pointer and size
checks go; its `SECURITY.md` lists only the rule files the floor does not name.

Readings taken: the checks join the copies workflow rather than a workflow of their own, since all three guard one
fact, one place, and run on the same events. Questions for the owner: none.
