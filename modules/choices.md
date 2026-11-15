# Choices that are hard to undo

Read before a session makes a choice that is hard to undo or advises the owner on one, and by the reader of a pass
over the recorded choices (core archive 222).

A choice is hard to undo where one pull request cannot reverse it: a language, an engine or framework, where data is
kept, how the code is put together, a large dependency, a tool the work will lean on, and the platforms the code builds
and tests on, apart from those the product ships for. Its record stands once, in the *choice records*, under a heading
`## Choice: ` and what was chosen; `core/scripts/choices.mjs` lists them and says when their pass is due.

- **A choice that is hard to undo gets a record.** By default a choice is made on the best reading and noted in a line
  of the *report*, as any reading is. One that is hard to undo gets a record before it stands, written by the session
  that makes it, or that advises the owner on it, alike. It holds, in this order:
  - **criteria first:** before any option is named, what the project needs of the choice, drawn from its aims, with a
    number wherever one can be had: its budget for speed, how long its tests may take, what tools can check in it
    (types, boundaries, lints), what it costs to leave, its licence and upkeep, and how well agents work in it;
  - **at least three options,** one of them the plain or the less common one, each with what would make it the wrong
    pick;
  - **a measure where one is cheap:** a small trial on the project's hardest part, not an argument;
  - **popularity only for what it buys,** named: documentation, upkeep, how well agents write it; "it is what most
    use" is no reason by itself;
  - **the case against:** a fresh session, the challenger, given the record, argues against the pick before it
    stands, and its case and the answer to it stay in the record;
  - **the pick,** what it was chosen for, and, on a line that opens `Reopens it:`, the measurable sign that would
    reopen it.

  It does not mean that what is common is wrong: how well agents write a language is a criterion like any other, once
  named and weighed. Nothing here ever asks for a rewrite, and nothing waits for the owner beyond what floor rule 14
  names: the record is how the reading is taken, not a question.
  Reason: fresh sessions advise what is most common, and both of the owner's first projects paid for an early choice,
  one with a rewrite into another language.
- **The choices a project already made are recorded too.** At its first audit (in a project that stood before this
  rule, as the step its sync asks: `setup/sync-notes.md`), a project's auditing session records each standing choice
  that is hard to undo, a stated feature of its design that works as one included ("no build step"), each with what
  it was chosen for and its `Reopens it:` line. Which platforms the code builds and tests on is such a choice: a
  project is bound to one only with the reason in its first record, and "bound to one platform" is recorded with the
  sign that reopens it ("its tests cannot run where its sessions work"). It does not mean that a rewrite is asked or
  that anything changes in the code: it is a record of what stands. Reason: a choice never written down cannot show
  when it stops paying off.
- **What reopens a choice.** A recorded choice stands until one of two triggers:
  - **its sign trips:** the session that runs the trial, the audit or the measure in which it shows tripped files the
    suggestion below (#330 asks that the scheduled look read a sign written in a measure a check keeps);
  - **the pass twice a year:** the scheduled look keeps an issue open once the day on the records' line `Read whole:`
    is 182 days old, and a fresh reader goes through every record, reads its sign, and asks whether an option plainly
    better exists now (a new version, a tool that did not exist, a need that has gone), reading what it needs, on the
    web too; it then writes the day on that line.

  Either way the result is a suggestion, never an act: an issue for the project's owner, labelled `needs-owner`, with a
  fresh record that compares the options, staying as it is among them, and says the gain and what the move would cost.
  It does not mean a session makes that choice, or that the rest of the work waits on it. Reason: the owner asked
  what would reopen a choice, and wants better options suggested.
- **When a feature may leave the stack.** By default a feature is built in what the project already uses. The trigger
  is a measured miss: where a feature has a need in numbers (speed, memory, size; `modules/how-to-work.md`) and a trial
  shows the stack cannot meet it, its builder opens a choice record. It does not mean that another language being
  faster in general is a reason by itself. The record:
  - shows first where the time or the memory goes, since most slowness is in the algorithm;
  - takes a part, never the whole: the other language goes behind a declared boundary (`modules/code-shape.md`), as
    any system does, and the rest of the code keeps its language;
  - counts the whole cost: the second toolchain, the build step, tests and checks in two languages, and how well
    agents write it;
  - rests on a benchmark of the heavy path, not the feature built twice: no one fits a part into the old stack first
    to prove it slow.

  Once a second language and its toolchain are in a project, a later part in it is an ordinary choice, noted in a line.
  Where the core's dependency checks cannot read the new toolchain's packages, they are built first, as a check for a
  rule that already stands (#278). Reason: the owner wants the heavy parts written where they run well, not first
  fitted into a stack that cannot carry them.
- **A split between languages is decided at the start where it can be.** Where a new project's aims name a need in
  numbers, its first record weighs a second language beside the common one, and if it takes one, writes the line
  between them: which kind of code goes where, by criteria someone can observe ("runs inside the simulation loop",
  "must run with no screen", "changed often while the design is tried out"), and what would move a piece across. That
  line is a declared boundary, and a builder places new code by it with no further record. Where the aims name no such
  need, the project starts in one language. It does not mean a second language taken on a guess. Reason: a division
  decided early, on stated criteria, anchors why it is there.
- **The session decides, and asks the owner in two cases only.** The record is written, a fresh session argues
  against the pick, and the work goes on. The owner is asked, by an issue labelled `needs-owner`, only where the
  choice goes against a feature the owner has stated for the project, in its design's own words, or is of a kind the
  *owner's choices* list as the owner's to keep. It does not mean that the rest of the work waits for the answer: what
  stands is kept meanwhile. Reason: the owner wants these calls made well, without waiting on the owner.

Held by: the starter kit, whose *choice records* ask for a new project's stack before its first code; the scheduled
look, which keeps the pass's issue (`core/scripts/choices.mjs`); a staged case (#235), in which the common answer is
the wrong one for a project's stated aims; and, for the rest, the reviews alone.
