# How code is put together: the core's half of the audit

14 November 2026, for #245. The audit asks two things of every codebase the owner keeps: what the rules and checks say
of how code is built, set against a list of practices, and where the code stands, measured, the numbers kept as a
baseline. Each of the owner's projects has its own half, filed there (#245's comments name the issues). This report is
the core's: the core's rules and checks against the practices, the core's own code measured, the owner's two games
measured from a read-only clone, and for each practice a proposal for #246. The audit writes no rule.

What the audit asked for, in the owner's words on the issue:

> But i want good codebases, or else I'll grow tired of developing these 2 games. […] Should we have size checks, or
> more sophisticated checks? I think this requires a full audit. What does our rules and enforcement leave out of best
> practices?

**The measures are a script now,** so the next audit is a run and not a study: `node core/scripts/code-shape.mjs` in a
project (`node scripts/code-shape.mjs` here, `--repo <folder>` for a clone it does not lie in) prints the summary
below, and with `--json` writes every number. It reads
JavaScript and TypeScript; a project in another language counts its files there and measures with its own tools. Its
reader is a lexer that knows comments, strings, template literals and regular expressions, not a parser, so where a
check must never guess (#246) it is a start, not the check. The core's numbers stand in
`2026-11-14-code-shape.json`, beside this report.

## First: can the core's tests prove behaviour unchanged?

Yes, for its scripts, which are all the code it has. Of its 76 files in JavaScript, 36 are tests and every other has
a test of its own or is run by one (`copies.mjs`, `reading-size.mjs` and `file-size.mjs` by the starter kit's tests;
`sync.mjs` and `workflow-run.mjs` by four or five each). The two shell scripts have none: `node.sh`, which fetches
Node for a project's cloud machine, and `site-publish.sh`, which publishes a game's site. Both are #259's to list
("has it a test").

## 1. The rules against the practices

Each practice, what stands in the core that bears on it, and its mark: **held by a check**, **held by review alone**,
**said, held by nothing**, or **missing**. A rule that reaches only part of a practice is marked by what it reaches.

| Practice | What stands in the core | Mark |
| --- | --- | --- |
| Each system has a boundary, and imports run one way | Nothing. "Split by meaning" (`modules/how-to-work.md`) splits files by what they hold, not by what they may depend on | missing |
| Each system declares what it offers, and others use only that | Nothing | missing |
| No import cycles | Nothing | missing |
| Each system owns its data | "Everything new belongs" (`modules/game-design.md`): a feature reads and changes the quantities other systems use, never keeping its own beside them. It keeps one copy of a quantity; it says nothing of which system may change it. Games only | review alone, in part |
| Rules apart from display | "Code decides facts; models phrase them" (game design), for language models only; "Different data, same rules": only presentation and voice may name a faction. Nothing says where the rules' code lies or what it may import | review alone, in part |
| Tests fast, and per part | "The smallest setup that tests the rule" (how to work): each test sets up only what it needs and runs only where a change can affect it; long measurements run outside the suite. No time is marked; a CI job's `timeout-minutes` is the only number, and it is a harness's limit, not a mark | review alone |
| Functions short enough to read | Nothing of functions. Of files: the split mark (about 50 KB) on any file a PR changes, held by the reading-size check; "a file past about 20 KB probably holds two things", held by nothing | missing (files: held by a check at 50 KB) |
| A new thing is added without editing what stands (data before code) | "Different data, same rules" (game design): what sets a player, faction or character apart lives in its data, which every rule reads alike. Games, and that case only | review alone, in part |
| A budget for start-up and for a frame | Nothing. The polish lane (`modules/work-flow.md`, point 4) takes "slow spots", found by eye | missing |
| A port carries what the program must do, not how the old code behaved | Nothing. What stands leans the other way: "A split goes in its own PR, behaviour proven unchanged" (how to work) and "Same seed, same game" (game design) prove sameness, which suits a split and binds a port to the old code's line-by-line behaviour unless the port says it starts a new version | missing |
| Invariants checked while the game runs | "Nothing appears or vanishes without a cause it could name" (game design, "Effects from causes") is a design aim; no rule asks that it be checked in code, on every seeded game or any | said, held by nothing |
| How good the tests are, not only that they pass | Review: "a test weakened or skipped, or changed beyond what the task forces" blocks, and a 10 needs "its tests prove it" (`modules/review-guidelines.md`). Nothing measures it (#253) | review alone |
| Strict types where systems meet | Nothing | missing |
| Flaky tests named and counted | Nothing. Floor rule 14 has a failing test fixed or its task marked blocked, which a test that fails now and then escapes; the core's own `tests.yml` tells a reader of a cancelled job that a rerun is the first thing to try | missing |
| Budgets held by a check where a benchmark exists | Nothing held. "Same seed, same game": an optimization proves once, on fresh seeds, that nothing a player would notice changed; nothing holds a time after it | missing |
| One name for each thing, in the code as on the screen, kept in one list | "Readable by every player" (game design): each thing has one name everywhere the game shows it. On the screen only; nothing of the code's names, and no list | review alone, in part |

**In all:** of the sixteen practices, none is held by a check; six are held by review alone, four of them only in part
and three of those for games alone; one is said and held by nothing; nine are missing. The first look's finding on the
issue stands: the core holds what a file may be (its size, its copies, its licences, its secrets) and nothing of what
it may depend on.

**Beside the practices,** three things the core already has that bear on how code is built, and how far they reach:

- **The copies check** fails a new copy of code, but the starter kit writes its config with `"code": []`
  (`setup/template/copies.json.tmpl`): a new project's code is checked for copies only once someone fills it in. A
  practice the core holds by a check is held in a new project by nothing until then. #246's to take: the kit could
  fill it from the folders it is given (`--npm`, `--nuget`).
- **"Keep it lean"** (how to work): nothing left unused. Held by review alone (a finding in the review guidelines); no
  check reads for an unused export or file.
- **The core reads its own scripts less than a project's:** `copies.yml` runs only when a project calls it, and the core
  keeps no copies config of its own, so its 76 scripts are not checked for copies. This is #255's ("The core abides by
  its own rules, to the full extent").

## 2. The core's own code, measured

The baseline, at `a8528e4` with this pull request's script and its test; every number is in
`2026-11-14-code-shape.json`.

**How it is laid out.** All of it in one folder, `scripts/`: 76 files in JavaScript, 36 of them tests, beside two
shell scripts. In it stand the projects' checks, the two hooks, the starter kit, the sync and the core's own tools,
with nothing but their names to tell them apart.

**Imports.** 353, none crossing a folder, since there is one; no cycle. Outside the repository only Node's own modules,
and two packages that `readers-test.mjs` alone fetches as reference parsers.

**Hubs.**

| File | Imported by | What it gives them |
| --- | --- | --- |
| `started.mjs` | 20 | `started` |
| `core-address.mjs` | 18 | `CORE`, `CORE_SOURCE`, `OWNER` |
| `releases.mjs` | 8 | 13 names |
| `licences.mjs` | 6 | 18 names |
| `workflow-run.mjs` | 5 | `evaluate`, `parseYaml`, `runWorkflow` |

The first two are hubs as they should be: one small fact each, in one place. `licences.mjs` gives 18 names to six
files: it is the licence check, and the lists, the lockfile readers and the config those six need besides.

**Shared global names:** none; every file is a module.

**Functions.** 551; half are 4 lines or fewer, nine in ten 21 or fewer. 17 run past 50 lines and 2 past 100; 5 nest
four blocks deep.

| Function | Lines | Depth |
| --- | --- | --- |
| `check`, `nuget.mjs:314` | 183 | 3 |
| `fetched`, `licence-commands.mjs:113` | 106 | 4 |
| `check`, `licences.mjs:382` | 99 | 3 |
| `fetchAll`, `nuget-fetch.mjs:219` | 97 | 3 |
| `scan`, `licence-scan.mjs:125` | 96 | 4 |

**Tests.** 39 suites in `tests.yml`, each a script that runs alone, so a part's tests run without the rest. On this
session's machine, run one by one: 103 seconds in all, the upgrade test 34 of them, then the work-saved hook's (13),
the pure-sync proof's (11) and the personal-terms check's (8); 29 take under two seconds. In CI, at `main`'s newest
passing run: the suites take 117 seconds on Linux and 571 on Windows, against a limit of 15 minutes (900), and the
upgrade test 55 and 313. Windows is where a time mark would first bite.

**Flaky tests.** Of the last 100 runs of `tests`, 7 failed and 2 were cancelled; one passed on its second attempt.
Nothing records whether that was a flake: the practice is missing, so the number cannot be told.

**What changes together** (the newest 500 commits that are no merge, leaving out those that touch more than 30 of the
files). Most pairs are a script and its own test, as they should be. The rest is one cluster, the licence check:

| Pair | Together | Share of the rarer one's changes |
| --- | --- | --- |
| `licence-fetch-test.mjs` and `licence-scan.mjs` | 26 | 0.74 |
| `licence-commands.mjs` and `licence-fetch-test.mjs` | 20 | 0.91 |
| `nuget-test.mjs` and `nuget.mjs` | 19 | 0.95 |
| `licence-fetch-test.mjs` and `licence-scan-test.mjs` | 19 | 0.63 |
| `licence-commands.mjs` and `licence-scan.mjs` | 9 | 0.41 |

The files changed most are the same: `licence-fetch-test.mjs` (39 times), `licence-scan.mjs` (35), its test (30),
`nuget.mjs` (27), `licence-commands.mjs` and `licences.mjs` (22 each).

**Start-up and frame:** the core has no screen; nothing to measure.

**What no number shows.** The core's code is not tangled: no cycle, small hubs that hold one fact each, short functions
on the whole. Its debt is where change meets size, which is where #246's cleaning lane would start ("worst first means
where change meets tangle"): the licence and NuGet checks, whose longest functions are the core's longest and whose
files change most, and change together. And its one folder: nothing marks the projects' checks apart from the core's
own tools, so no boundary between them could be checked until #246 names them.

## 3. The owner's two games, read from a clone

On the owner's word, given in person to the orchestrator on 14 November 2026 and passed on word for word:

> Yes: sessions may read `amarna-letters` and `barkstreet-snakes` for #243 and #245. Read only; nothing is written
> there. #245's session also measures what a read-only clone of each allows and puts it in the core's report. #246 and
> #253 wait on that report alone. The games' own halves, in their own issues, hold up no line and no release.

Nothing was written to either repository: no branch, push, issue or comment. Each game's own half of the audit stays
with that game's issue, for its own sessions to do with its own tools.

**What a read-only clone allowed.** Both repositories are public, so this session could clone them without credentials.
It could also:

- read the history, the newest 500 commits of each, by a bounded fetch;
- install amarna-letters's packages from its lockfile (`npm ci --ignore-scripts`, five seconds);
- run the suites with Node and the session's own Chromium.

It could not reach GitHub's API for either repository. That rules out their issues and their CI runs, so the CI times
and the reruns that the core's own numbers draw on are missing here. Attaching amarna-letters read-only was refused by
this session's own permission check; the anonymous clone read the same files. Not run: barkstreet-snakes's `ui` and
`layout` suites (the second takes about 30 minutes one part after another, by its own script's word) and its copies and
versions checks. Not read: amarna-letters's 14 files of Python. The `.tsx` files hold JSX, which the script's reader
does not know, so their function counts are rough.

**amarna-letters** (`98b1e63`; TypeScript, five packages: engine, game, llm, web, batch):

- **Size:** 714 files of code, 474 of them not tests.
- **Imports:** 4,287.
  - Between the packages' own code there is no cycle, and no two packages import each other both ways.
  - Inside them, 8 cycles between files at run time (imports of types alone left out, since TypeScript erases them).
    The largest joins 41 files of the engine's `rules` and `turn` folders.
  - Seven pairs of folders import each other both ways, the most `rules` and `turn` (8 imports one way, 195 the other).
- **Hubs:** the engine's entry file is imported by 416 files and gives 790 names, which is a package declaring what it
  offers, as the practice asks. Its `model/power.ts` is imported by 134 files; the tests' shared support by 216.
- **Functions,** not counting the tests: 3,684.
  - Half are 7 lines or fewer, nine in ten 34 or fewer; 211 run past 50 lines and 89 past 100; 17 nest four deep.
  - The longest: the play page's component (822 lines), the computer players' `makePlan` (631, four deep) and the batch
    runner's `parseArgs` (596).
- **What changes together:** `engine/src/turn/kings-fate.ts` changed in 33 of 497 commits, with `resolve.ts`,
  `views.ts` and `model/state.ts`. The state and the save-version test changed together all 13 times the test changed.
- **Suites,** run alone from the clone:
  - the type check passed in 20 s and the lint, with its unused-code check, in 13 s;
  - the whole of vitest did not finish within 20 minutes on this session's four cores, and was stopped (CI splits it
    four ways);
  - one package's tests run without the rest: the engine's 777 tests passed in 66 s, the web package's 244 in 134 s.

**barkstreet-snakes** (`d14a7d3`; JavaScript with no build):

- **Size:** 313 files, 152 of them the game's own (not `tools/` or `scripts/`).
- **Shared global names:** the page loads 130 scripts, and 129 have no import at all. Their top levels share one space
  of 1,734 names, none declared twice (the issue's first count was about 1,650).
- **Imports:** only the tools have any (248, 11 crossing a folder, no cycle).
- **Functions,** the game's own: 1,482.
  - Half are 8 lines or fewer, nine in ten 31 or fewer; 71 run past 50 lines and 25 past 100; 40 nest four deep.
  - The longest: `SnakeAudioCues` (614 lines). Like several others, it is a whole file wrapped in one function, so it
    reads as one function. Then `drawFace` (485, four deep) and the engine's `step` (368, six deep, the deepest).
- **What changes together:** `game/core.js` and `game/friends.js` (20 times), `engine/view.js` and `tuning.js` (13).
  The files changed most are the version stamp (41), `friends.js` (32), `core.js` (30) and `tuning.js` (29).
- **Suites,** twelve run alone from the clone, all passed:
  - the touch-input suite took 124 s and the render suite 60 s, both in a browser;
  - the network suite 69 s, the rules 14, the content-security policy 11, online play 10, the scope check 7, the
    licences 3 and the type check 1; the rest under one second.
  - The input suite already measures time from touch to a swipe registering, in milliseconds: a benchmark that a
    budget held by a check (practice 15) could hold.

**What this says to #246.** The two games need different first checks:

- **amarna-letters** has boundaries between its packages that hold; its tangle is inside them, so a cycle check with a
  baseline bites at once.
- **barkstreet-snakes** has no imports for a boundary check to read. Until it has modules, what holds its shape is a
  check on its one global space: no new name without its file declaring it once.

A mark on a function's size would list hundreds of functions in amarna-letters and dozens in barkstreet-snakes on its
first day.

## 4. A proposal for each practice

For #246, which writes the rules and checks; each with the check that would hold it without guessing, and its baseline
in the core. "Never worse" and the baseline that may only shrink are #246's own, on the owner's word recorded there.

| Practice | The rule | The check that holds it exactly | Baseline in the core |
| --- | --- | --- | --- |
| Boundaries, imports one way | The project names its systems (folders) and which may import which, in a config | An import from one system into another that the config does not allow fails; imports are read by a parser for each language the project uses | Empty: one folder. Once `scripts/` is split into named systems, the imports that cross against the allowed way, listed |
| What a system offers | Each system has one entry file that names what it offers; others import only it | An import into a system's file other than its entry fails | Empty until systems are named |
| No cycles | No import cycle between files or between systems | A new cycle fails; the cycles that stand are listed | Empty: none stands |
| Owns its data | Each quantity is changed only by the system that owns it, through what it offers | No exact check found: what a function changes cannot be read from imports alone. Held by review, with the check of what a system offers narrowing where a change can come from | None |
| Rules apart from display | The rules never import the display; their tests run with no screen | The boundary check, with display a system the rules may not import | None: no display |
| Tests fast, per part | Each suite has a time mark, as files have size marks; each system's tests run alone | CI times each suite and fails one past its mark, set with room above today's time so a slow runner fails nothing; a mark rises as a size mark does | Today's times, above: 571 s for the suites on Windows |
| Functions short | A mark on a function's lines and its depth (first guesses: 60 lines, 4 deep) | A function past either mark fails, read by a parser; those past it today are listed, and may only shrink | The 17 past 50 lines and the 5 four deep, in the JSON |
| Data before code | A new kind of thing (a unit, a faction, a card) is added as data that every rule reads alike | Rule code that compares against an id from the data's own list fails | None: no such data |
| Start-up and frame | A project with a screen names its marks (time to first frame, time per frame, on a named kind of device) | Its benchmark runs in CI and fails past a mark, as tests do | None: no screen |
| A port | A port carries the old tests' meaning, not the old code's shape | The port's PR keeps a list of each old test and the new one that carries it, or why it goes; an old test missing from the list fails | None |
| Invariants while running | Each game lists what must always hold, and its suite checks every step of every seeded game it plays against them | The list exists and its runner calls each of them (a test of the runner) | None: not a game |
| Test strength | #253: mutation testing on the lines a PR changes | #253's | #253's |
| Strict types where systems meet | The compiler's strict mode where one system offers another something: `strict` in TypeScript, nullable in C#; in JavaScript, its type check on each entry file | The compiler's config is read for the setting; the files that fail the type check are listed and may only shrink | 75 files of plain JavaScript and one declaration file: the core would need to choose this first |
| Flaky tests | A test that fails and passes on the same commit is filed as a bug and mended, never rerun past | A script reads the CI's runs: a job that failed and then passed on one commit is named, and counted with what the reviews find (#234) | The one rerun of the last 100, unknown whether a flake |
| Budgets held where a benchmark exists | A benchmark's result has a mark | As tests' time marks | None |
| One name | Each thing's name stands in one list, which the code and the screen both read | Display code that writes a name from the list as a literal fails | None: no screen |

**What this leaves to others.** The games' own halves, in their own issues, go deeper than a clone allows (their CI's
times, their reruns, the suites not run here) with their own tools, and hold up no line and no release. #246 writes the
module and the checks from this table; #253 the measure of tests' strength; #248 when the audit repeats; #255 the core's
own copies check; #259 the two shell scripts with no test.
