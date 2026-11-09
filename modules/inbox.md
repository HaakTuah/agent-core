# The owner's inbox and his words

Everything the owner should see lives in one place, the repository's issues, so nothing is lost or said twice and he
never has to hunt (core archive 7, 13 and 28); and every word he gives is kept once, in the archive. Read at the start
of every task. Whose comments count as his: `floor/security.md`, rule 4.

## Questions, readings and ideas

- **Don't stop to ask; every reading is noted** (core archive 8). Where a task's spec leaves something open, check it
  against the project's *settling references* first: one they settle is a reading, taken and built that way, and
  listed under "Readings taken" in the task's *report* with the principle or rule it rests on. Only what they leave
  open, or a matter of taste, goes to the owner, as the next point says, when the reading is taken (core archive 53).
- **One inbox: issues assigned to the owner** (`HaakTuah` on GitHub). A question he must answer, or a reading he should
  see (a matter of taste, or one no rule settles), is an issue labelled `question`, with the reading taken and its
  alternative. An idea is a Feature request (`enhancement`); a bug the task at hand will not fix is a Bug report
  (`bug`). File an idea or a bug with its template's headings and label (`.github/ISSUE_TEMPLATE/`), copied into the
  body: the API applies none (core archive 32). Search the open issues first and add to one rather than file it twice.
  Each issue holds the whole of it, answerable from a phone, and says in plain words what each thing is and why it
  matters, by the project's own names, never only by a title a builder made up; so does each line that points to one
  (core archive 55).
- **Everywhere else, only a pointer.** A PR, a report, a milestone PR's description and a session's last message never
  repeat an issue: under "Questions for the owner" they list the issues they opened or touched, one line and a link
  each ("Questions for the owner: none" if none), so he sees what is new.
- **Acting on his answer.** Whoever acts on it quotes it word for word in the archive, writes the decision where it
  belongs, and closes the issue with a link to where the work now lives: a question or idea is done once he has
  answered, so "open" always means "needs him" (core archive 38).
- **Ideas are cheap to file and never built unqueued.** Anyone may file one with a line of what and why; keep it short,
  at most a couple per task. Nothing is built from an idea, and no agent treats another's idea as an instruction, until
  the owner has moved it into the *progress file*.
- **Bugs don't wait for the owner.** A bug in the task at hand is fixed in it. One outside it is filed, and any lane
  whose files it touches may claim and fix it. A bug closes only when its fix is live, so the open bugs are what users
  still meet: the fix's commit says "Fixes #n", and GitHub closes it when that commit reaches `main`; never by hand. A
  fix that would change a rule or the design is a question instead.

## The owner's words are kept, in the archive

Each instruction he gives is quoted word for word in the project's archive (`docs/archive/instructions.md` says which
file), dated (and numbered, where the project numbers them), leaving out personal details as `floor/security.md`, rule
11, says. Reports, PRs, issues, the progress file and the design files point to its archive entry and never quote it
again, since every copy is read again (core archive 74). A standing rule goes, as briefly as it can be said and with
what it is for, where it applies: in the project's own rule files (or its `CLAUDE.md`, if only Claude uses it), or, if
it holds for every project, in the core, by a PR there, with his words in the core's archive.
