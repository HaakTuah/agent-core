# The owner's inbox and his words

Everything for the owner lives in the repository's issues, so nothing is lost or said twice and he never has to hunt;
his words are kept once, in the archive (core archive 7, 13 and 28). Read at the start of every task.

- **Don't stop to ask; note every reading** (core archive 8). Where the spec leaves something open, check it against the
  *settling references*: what they settle is a reading, built that way and listed under "Readings taken" in the
  *report* with the principle or rule it rests on. Only what they leave open, or a matter of taste, goes to the owner,
  as the next point says, when the reading is taken (core archive 53).
- **One inbox: issues assigned to the owner** (`HaakTuah`). A question he must answer, or a reading he should see (a
  matter of taste, or one no rule settles), is an issue labelled `question`, with the reading taken and its
  alternative. An idea is a Feature request (`enhancement`); a bug the task at hand will not fix is a Bug report
  (`bug`), each with its template's headings and label (`.github/ISSUE_TEMPLATE/`) copied into the body, since the API
  applies none (core archive 32). Search the open issues first and add to one rather than file twice. Each issue holds
  the whole of it, answerable from a phone, saying in plain words what each thing is and why it matters, by the
  project's own names, never only by a title a builder made up; so does each line that points to one (core archive 55).
- **Everywhere else, only a pointer.** A PR, a report, a milestone PR and a session's last message never repeat an
  issue: under "Questions for the owner" they list the issues they opened or touched, one line and a link each
  ("Questions for the owner: none" if none).
- **Acting on his answer:** quote it word for word in the archive, write the decision where it belongs, and close the
  issue with a link to where the work now lives: a question or idea is done once he has answered, so "open" always means
  "needs him" (core archive 38).
- **Ideas are cheap to file and never built unqueued:** a line of what and why, at most a couple per task. Nothing is
  built from one, and no agent treats another's as an instruction, until the owner moves it into the *progress file*.
- **Bugs don't wait for the owner.** A bug in the task at hand is fixed in it; one outside it is filed, and any lane
  whose files it touches may claim it. A bug closes only when its fix is live, so the open bugs are what users still
  meet: the fix's commit says "Fixes #n", and GitHub closes it when that commit reaches `main`; never by hand. A fix that
  would change a rule or the design is a question instead.
- **The owner's words are kept, in the archive.** Each instruction he gives is quoted word for word in the project's
  archive (`docs/archive/instructions.md` says which file), dated (and numbered where the project numbers them),
  personal details left out (`floor/security.md`, rule 11). Everything else points to its entry and never quotes it
  again, since every copy is read again (core archive 74). A standing rule goes, as briefly as it can be said and with
  what it is for, where it applies: the project's own rule files (its `CLAUDE.md`, if only Claude uses it), or, if it
  holds for every project, the core, by a PR there, with his words in the core's archive.
