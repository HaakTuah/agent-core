# #593, point 8: the readers of a project's set-up, read for their whole input

The pass, done once, at `main` 6dfc954 (18 November 2026). The part: `scripts/steps.mjs`, `scripts/fresh.mjs` and the
readers they call to read a project's files: `project()` (steps.mjs:63-100), `scripts/core-path.mjs` (`corePath`),
`scripts/check-configs.mjs`, `scripts/manifest-reads.mjs` (`modulesOf`), `scripts/agent-tools.mjs` (`readProject`),
`scripts/yaml-keys.mjs` (`twice`), `scripts/workflow-run.mjs` (`parseYaml`, `pathsLetThrough`) and `scripts/nuget.mjs`
(`importsOf`, `projectFilesByContent`, `readProject`; its own bugs are counted on the NuGet check's part, not here).
Probes ran outside the repository; nothing was written into it.

## 1. The part's bugs

Source: the core's issues labelled `bug`, 62 on 18 November 2026. Commands:

- `gh api --paginate "repos/HaakTuah/agent-core/issues?labels=bug&state=all&per_page=100" | jq -s -c '[add[] | select(.pull_request|not) | select(((.body//"")+" "+.title)|test("steps\\.mjs|fresh\\.mjs|core-path\\.mjs|check-configs\\.mjs|manifest-reads\\.mjs|steps. reader"))] | map(.number)'`
  gives `[446,423,386,379,373,366,364,362,329]` (9).
- The same with `agent-tools\\.mjs|workflow-run\\.mjs|yaml-keys\\.mjs|nuget\\.mjs` gives
  `[610,513,446,444,386,355,280,274,269,240]` (10).

The 8 that name `steps.mjs` are #593's count of 8 ("Why it matters"). The two commands give 17 issues together (446
and 386 in both); each has a line below (the four Import bugs share one), and reading the other 45 titles found none
more in the part. #455 (`pr-description.mjs` reading a copy at `core/` alone) is gap A's kind on another part.

| # | State | Title (data) | Of this kind? | Why |
| --- | --- | --- | --- | --- |
| 362 | closed | Harden the project reader's guard on where it reads | yes | a path or link that leads out of the project, which `project()` read (steps.mjs:66-67 names it with #423) |
| 364 | closed | steps.mjs takes the licence config's path from a workflow's comment | yes | a kind of input: a comment naming a script, read as a run |
| 366 | closed | fresh.mjs and the NuGet step look for the configs only at the starter kit's paths | yes | a kind of project: checks run from its own workflow, configs at its own paths |
| 373 | closed | The NuGet step adds a billed job on every pull request, and a private repository cannot decline it | no | the fault was what the sync note and the kit's workflow asked; the reader read what it was told |
| 379 | closed | A sync that only moves pins starts a project's own suites | no | the note's remedy could not be held by GitHub's path filters; the step was declared unread, nothing misread |
| 386 | closed | The steps and fresh.mjs still misread some ways a project runs or calls a check | yes | kinds of input: shell spellings, `working-directory`, local actions, `.sh`/Makefile/`package.json`, several sources |
| 423 | closed | The steps' reader follows a tracked link, so a link to an endless file stops the sync's report | yes | a kind of input: a tracked link to a device |
| 446 | open | The sync and the scheduled look read the manifest and the workflows past the steps' reader | yes | the same kind (#423) through other readers; PR #577 fixes it |
| 329 | closed | The starter kit writes a game's manifest without the rows its own module uses | kind yes, part no | a kind of project (a game) the kit missed; `manifest-reads.mjs` read it right |
| 444 | closed | Readers of the core's inputs that do not yet refuse every hostile case | yes (one item) | `agent-tools.mjs`: `enabledPlugins` written as a list, read by its indexes; the other items are other parts |
| 610 | open | yaml-keys.mjs: a text built of thousands of explicit-key marks stops Node | yes | a kind of input to `twice`, which steps' `keysOnce` calls (steps.mjs:155) |
| 513 | closed | workflow-run.mjs starts bash by name, which Windows looks for in the checked-out folder first | no | a platform kind, but in `runScript`, which the part does not call (steps.mjs:38 imports `parseYaml`, `pathsLetThrough` only) |
| 280, 274, 269, 240 | closed | the NuGet check's Import readers | not counted | the NuGet check's part (#593 counts its 6 there) |
| 355 | open | The core's shape baseline lists 58 functions past a mark | no | debt of length, not a reader's input |

Counts: of the 8 that name `steps.mjs`, **6** are of this kind (362, 364, 366, 386, 423, 446); #593 counts all 8, and
this record departs on 373 and 379, whose fault lay in what a note asked. With the readers beside, **8** of 11 in the
part's own code (+444, +610); 329 is the kind on the kit's side.

## 2. The sources that define the kinds

| Kind | Source (file:line) | Full set? |
| --- | --- | --- |
| Kinds of project | `AGENTS.md`:351-354 ("Rules are written for any project": what it builds, where built, who can read, how it releases); `README.md`:523-524 (a bug's kind: public/private, platform, cloud/owner's computer) | yes, four axes |
| Starter kit's kinds | `scripts/init.mjs`:11-25 (`--npm <folder>`, `--nuget <folder>`, `--private`, `--game`) | yes: 3 x 3 x 2 x 2 = 36 |
| Where the copy stands | `tasks/repositories.md`:8-15 (`core/`, another path), :16-27 (carried by a library), :39-46 (its files committed, or a submodule), :59-72 (a floor's copy); `scripts/core-path.mjs`:3-11 | yes, five |
| Manifest forms | `README.md`:414-446 (the format: `Core:` two forms, `Floor copy:`, `Paths:`, `Modules: all` or a list, `## Differences`); slots `README.md`:377-412 (34 rows) | yes |
| Slots the part reads | `README.md`:379, 381-382, 387-389, 391, 400 (owner's account, follows, progress file, copies check, size marks, shape check, mutation tool, choice records), as `grep` of steps/fresh/check-configs names them | yes, 8 |
| Steps | `setup/sync-notes.md` (61 entries) = `STEPS`, steps.mjs:639 (61: 28 check, 8 held, 25 unread) | yes |
| Ways a check is run | `scripts/check-configs.mjs`:1-8 (call `with:`, `core.yml` input, own step, local action, slot, kit path; shell/Makefile/package scripts unread) | the part's own list; GitHub's workflow syntax defines the whole, outside the repository |
| Platforms | `CHOICES.md`:19 (cloud session, host's runners, owner's computer; Linux and Windows); `.github/workflows/tests.yml`:70-80 | yes, two systems |
| Runners a workflow names | steps.mjs:490-498 (`ubuntu-*`, `macos-*`, Windows, matrix/expression, organisation, self-hosted) | the part's own list; GitHub defines the whole |
| Ecosystems | `scripts/init.mjs`:18-20 (npm, NuGet); npm lock files `scripts/licences.mjs`:496-501, `scripts/lookup.mjs`:18 (`package-lock.json`, `npm-shrinkwrap.json`); .NET project files `scripts/fresh.mjs`:69 (`.sln .slnx .csproj .fsproj .vbproj`) | npm: yes (two names); .NET: the SDK defines it, outside |
| Kinds of file on disk | steps.mjs:66-71 (regular, link in, link out, device, folder, past 64 MB, ignored, `.git`) | the part's own list; git defines entry modes (100644, 100755, 120000, 160000), outside |

No source defines: the ways a project's own tooling runs a check beyond workflows (a task runner, a hook); text
encodings (a BOM, UTF-16). Neither is listed below.

## 3. The kinds, each with its test

Tests are in `tests/`. "kit round-trip" = steps-test.mjs:59-70 (no step not done, no difference, kind read back, no
manifest note).

| Kind | Test |
| --- | --- |
| **Project: what it builds** | |
| a program (no `--game`) | steps-test.mjs:59 an-npm-project, kit round-trip |
| a game (`Modules: all`) | steps-test.mjs:59 a-game, kit round-trip |
| **Project: who can read it** | |
| public | steps-test.mjs:59 an-npm-project; upgrade-test.mjs:5 (npm, public) |
| private | steps-test.mjs:59 a-dotnet-project; upgrade-test.mjs:6 (NuGet, private) |
| **Project: where built** | |
| the cloud / the host's runners / the owner's computer | no test: the part reads no file that differs by it (nothing to hold) |
| **Project: how it releases** | |
| every merge / a tagged build | no test: no step reads it (`grep -i tag scripts/steps.mjs` finds none) |
| **Starter kit's options (round-tripped)** | |
| `--npm .` | steps-test.mjs:59 an-npm-project |
| `--npm <sub>` | steps-test.mjs:59 a-game (`web`) |
| no npm | steps-test.mjs:59 a-dotnet-project |
| `--nuget <sub>` | steps-test.mjs:59 a-dotnet-project (`src`) |
| `--nuget .` | no round-trip (steps-test.mjs:331-337 a-root-nuget-project: kind and differences only, no step check) |
| no NuGet | steps-test.mjs:59 an-npm-project |
| `--private` with npm / with a game / with none | no test (only NuGet+private round-tripped) |
| `--game` with NuGet / without packages | no test |
| the other 33 of 36 combinations | no test (a probe ran all 36: each passes today) |
| **Where the copy stands** | |
| copied under `core/` | steps-test.mjs:40-70 (every kit) |
| copied under another path | no test (probe: **3 steps and 12 differences falsely reported**, see 5) |
| carried by a library, files committed | no test (core-yml-test.mjs:149-162 holds core.yml only) |
| carried by a library, a submodule | no test (core-yml-test.mjs:163-181 holds core.yml only) |
| a copy older than release-1 | upgrade-test.mjs:29 (preRelease, after its sync) |
| **Manifest forms** | |
| `Core: … copied whole under <path>/` | steps-test.mjs:40-70 for `core/` only |
| `Core: …, carried by <library>/ under <path>/` | no test |
| `Floor copy: <folder>/` | no test |
| no or a wrong `Core:` line (default `core/`) | core-path-test.mjs (corePath alone); no test of steps/fresh |
| `Modules: all` / a list | steps-test.mjs:59 a-game / an-npm-project |
| `## Differences` "None." / declared lines | steps-test.mjs:216-224, 247-249, 335-337 |
| **Slots the part reads, with a row naming a path not the kit's** | |
| *owner's account* | steps-test.mjs:66 |
| *copies check* | steps-test.mjs:391, 496, 514 |
| *size marks* | steps-test.mjs:458-459, 497 |
| *mutation tool* | steps-test.mjs:79 |
| *follows* | no test needed: its step is unread (steps.mjs:693) |
| *progress file* | no test of the step reading it (steps-test.mjs:240 changes the row for fresh only) |
| *shape check* | no test |
| *choice records* | no test |
| **Steps** | |
| 61 entries, one step each, told one way | steps-test.mjs:30-37 |
| 28 check steps, each taken out and mended | steps-test.mjs:118-127 (on a-dotnet-project), :129-137 (half, on an-npm-project) |
| 8 held steps | steps-test.mjs:33 (form only); each named check's own test |
| 25 unread steps | staged-test.mjs (the staged case `steps`) |
| **Ways a check is run** (check-configs.mjs:1-8) | |
| a call's `with:` | steps-test.mjs:439, 458, 705-716 |
| `core.yml`'s folded input | steps-test.mjs:828- (#376) |
| own step, its spellings (#386) | steps-test.mjs:376-520 (comments, quotes, continuation, `$GITHUB_WORKSPACE`, `working-directory`, Windows paths, expressions) |
| a local action's step | steps-test.mjs:443 |
| shell script, `package.json`, Makefile: unread | steps-test.mjs:446 |
| several sources | steps-test.mjs:452 |
| slot, then kit path | steps-test.mjs:381, 459 |
| **Platforms** | |
| Linux | tests.yml:73 (steps-test, suites) |
| Windows | tests.yml:76 (steps-test, suites-kit); upgrade-test.mjs:6, 166 (CRLF, `core.fileMode false`, every file 100644) |
| a link on Windows | no test: steps-test.mjs:296, 318, 791, 799 skip it where no link can be made |
| **Runners** (steps.mjs:490-498) | |
| `ubuntu-*`, `windows-*`, self-hosted, matrix | lookup-test.mjs:369-372 (steps' shell-stops reading); steps-test.mjs:411-416 (check-configs.mjs:210-211, the root's spelling) |
| `macos-*` | no test (either reader) |
| an organisation's runner group | no test |
| **Ecosystems** | |
| npm by `package-lock.json` | steps-test.mjs:252-258 |
| npm by `npm-shrinkwrap.json` | no test; the part reads only `package-lock.json` (fresh.mjs:66, steps.mjs:678) |
| NuGet by `.csproj` | steps-test.mjs:331-334 |
| NuGet by `.sln`, `.slnx`, `.fsproj`, `.vbproj` | no test (fresh.mjs:69 reads them) |
| **Kinds of file on disk, per reader** | |
| `project().read`: link in, link out, folder link out, device, past 64 MB, `.git`, ignored | steps-test.mjs:280-327 |
| `project().read`: a submodule (gitlink) | no test |
| `corePath` (core-path.mjs:56): a link to a device | no test (probe: **steps and fresh both die**, see 5) |
| `agent-tools` `readProject`: links in and out | agent-tools-test.mjs:124-163 |
| `toolFilesRead` (steps.mjs:184): link to a device, out | steps-test.mjs:799-815 |

Count: **60 lines of kinds; 38 with a test, 22 "no test"** (of which 3 need none: where built, how it releases,
*follows*; so 19 gaps). The 61 steps are one line here, and the 36 kit combinations six; counted per item, 61 of 61 steps and 6
of 36 combinations are held.

## 4. Point 9: where something outside defines the full set

- **git, for the kinds of file a project holds** (entry modes 100644, 100755, 120000, 160000; its filters' view of a
  file's text). Yes. A comparison test: on each project `tests/upgrade-test.mjs` builds (npm public; NuGet private,
  Windows-held; the pre-release copy), after the sync, list `git ls-files -s` and, for each entry, assert `project()`
  agrees: a 100644/100755 entry reads as `git show :<path>` with CRLF made LF; a 120000 entry reads as its target's
  text only where git lists the target inside the project, else as missing; a 160000 entry reads as missing. The
  upgrade test is the place (it alone holds a Windows-held project, `core.autocrlf true`, upgrade-test.mjs:166), but its
  projects hold no link or submodule today: they must gain one of each mode for the comparison to read anything. On
  Windows it is where a link checked out as a plain file (`core.symlinks false`) would show.
- **bash, for how a workflow's `run:` line names a check's config** (#386's kinds). Yes for the shell: the upgrade test
  already runs every workflow through `workflow-run.mjs`, which starts bash (upgrade-test.mjs:11, 46). A comparison:
  put a `node` on the run's PATH that logs each `core/scripts/<check>.mjs` and its arguments from the step's folder,
  then assert `configs(project(dir))` (check-configs.mjs) names the same file for each check. The projects call the
  core's workflows (`with: config`) and fold into `core.yml`; one of them must also run a check from a workflow of its
  own (as steps-test.mjs:363 own-configs does) for the comparison to reach the run-step forms. GitHub's runner, which
  defines the rest (`uses:` forms, default shells, `working-directory`), cannot run in a test; `workflow-run.mjs` is the
  core's own stand-in, so that half is two readings compared, not point 9's authority.
- **The .NET SDK, for the build files the NuGet step's paths must let through** (steps.mjs:286-302 calls
  `importsOf`). Yes: `dotnet msbuild -pp:<out>` lists every file a build imports. On the upgrade test's NuGet project,
  where the SDK is (upgrade-test.mjs:29-30), assert the project's own files in that list equal `importsOf`'s. The
  project holds one `.csproj` only (upgrade-test.mjs:593), so it must gain a `Directory.Build.props` and an `Import` to
  read anything. This reader is the NuGet check's part too; one comparison serves both, and #534 weighs letting the
  SDK do the reading.
- **npm, for which lock file it installs from.** npm defines it, but the set is two names the core's own sources
  already give (licences.mjs:496-501); a case holds it, no comparison.
- **The host, for a repository's settings** (private or not, steps.mjs:799; a path filter's match, #379; a runner's
  default shell). The host defines them, and none can be asked in the upgrade test, whose GitHub API is a stand-in
  (upgrade-test.mjs:14-15). Nothing to compare there.

## 5. The gaps, as tasks

### Bugs found by the pass (a bug waits for no line)

**A. The steps and fresh.mjs misread a project whose copy stands anywhere but `core/`.** Filed: #628.
Which part: `scripts/steps.mjs` (`core/` written into its patterns and mends: lines 121, 149, 221, 594, 643, 723-727,
807, and the size marks' run of `core/scripts/reading-size.mjs`), `scripts/fresh.mjs` (compares the kit's templates,
which name `core/`, with files that name the manifest's path). What happened: a kit project with its copy under
`vendor/core/`, every `core/` in its own files made `vendor/core/` as `README.md`:422-423 says, reports 3 steps not done
(the size marks' total, an agent's own tools, a file for each role) and 12 differences (every rule file, the hooks'
settings, Dependabot, the issue forms); the same kit under `core/` reports none (probe `pass-setup/probe/place.mjs`).
What should happen: each pattern and mend takes the copy's path from `corePath`, and fresh reads the kit's `core/` as
that path. Kinds to test, in `tests/steps-test.mjs`: the kit round-trip with the copy under another path, and with a
core carried by a library (its files committed), with its `Floor copy:` line. The kind of project: any whose manifest
names another path (tasks/repositories.md:8-27). Size: large (many patterns; a submodule's case adds git's gitlink).

**B. `corePath` reads the manifest past the steps' reader, so a tracked link to a device stops the steps and fresh.** Fixed in #624: one reader, `manifestText`, for each of `core-path.mjs`'s four reads of the manifest, with its cases in `tests/core-path-test.mjs`.
Which part: `scripts/core-path.mjs`:56 (and :76, :100), `fs.readFileSync` on `core-manifest.md`, called by
steps.mjs:116, 193, 215, 273, 291, 408, 630, 678 and fresh.mjs:45. What happened: a project whose `core-manifest.md` is a
tracked link to `/dev/zero`: `project()` reads it as missing in 65 ms; `corePath`, `notDone` and `fresh` each end on
`std::bad_alloc`, exit 134 (probe `pass-setup/probe/zero.mjs`, `zero2.mjs`). PR #577 (fixes #446) moves the reader to
`own-files.mjs` and leaves `core-path.mjs` as it is. What should happen: `corePath` reads through that reader (or the
steps pass it `p.manifest`). Test: one case in steps-test.mjs:280-327's link block (not on Windows, as its others).
The kind of project: any; only its own tracked files cause it. Size: small; fits #577 or the pass's pull request.

### Tests small enough for the pass's own pull request (cases in `tests/steps-test.mjs`), each done in #624

**C. Every kit option round-tripped.** Run the round-trip assertion of steps-test.mjs:59-70 inside `kit()`, at
creation, so the six kits made later (a-bare, a-plain `{}`, a-root-nuget `{nuget: ".", private}`, another-npm,
own-configs, mixed `{packages: ".", nuget: "src"}`) are each held too: every value of every option then has one, at no
new kit. Add three kits for the pairs no kit holds: `{packages: ".", private}`, `{private, game}`, `{nuget: "src",
game}` (about 1.6 s each on Linux; the Windows `suites-kit` mark is 600 s, .github/shape.json:18). Kinds: init.mjs:11-25.

**D. The slots the part reads, at a path not the kit's:** *shape check*, *choice records*, *progress file*, each a row
naming another file, the step reading that file and its mend naming it. Kinds: README.md:382, 389, 400.

**E. npm's second lock file** (it failed, a bug of A's form: fixed in #624, both readers reading either lock file): a project with `npm-shrinkwrap.json` and no `package-lock.json`: `kind()` reads it as
npm and the step "12 November 2026, exact versions" reads it (fresh.mjs:66, steps.mjs:678 read only
`package-lock.json`). Kinds: licences.mjs:496-501. If it fails, it is a bug (A's form).

**F. .NET project files** (and in any case of its extension, which failed: `kind()`'s pattern was case-sensitive, fixed in #624): `kind()` on a project holding only a `.sln`, `.slnx`, `.fsproj` or `.vbproj` reads it as
NuGet (fresh.mjs:69). One in-memory loop.

**G. Runners:** a job on `macos-latest` and one on an organisation's runner group read by steps.mjs:490-498 as the
step's shell says, and by check-configs.mjs:210-211 as bash. Both cases in steps-test.mjs.

**J. No or a wrong `Core:` line, read by the steps and fresh:** a kit project whose manifest has no `Core:` line, or one
in neither form, reads its copy at `core/` with every step done, and fresh lists the line alone.

### Large, each a task filed

**H. Point 9 comparisons on the upgrade test's projects** (filed: #629) (`tests/upgrade-test.mjs`), as section 4 sets out: git's
entry modes against `project()`; bash's arguments against `check-configs.configs()`; `dotnet msbuild -pp` against
`importsOf`. Each needs the projects to hold the kinds compared (a link of each kind and a submodule; a workflow of
the project's own running a check; a `Directory.Build.props` with an `Import`), and the upgrade test's time mark
read before and after (`tasks/tests.md`).

**I. A carried core in a submodule** (part of A, filed with it: #628): `git ls-files` lists the gitlink alone, so the copy's files are in
no `p.files`; the steps that list `${copy}scripts/` (steps.mjs:273) see none. Test with core-yml-test.mjs:163-181's
submodule set-up, run through `notDone` and `fresh`.

**Tasks against kinds:** of the 22 "no test", 3 need none (where it is built, how it releases, *follows*). The other 19
each have a task:
- C: the option pairs (87-89).
- A, #628: the copy at another path, carried by a library, its line and its floor copy (92-94, 98, 99), with I's
  submodule (140).
- B, fixed: a link to a device (141).
- D: the three slots (109-111).
- E, fixed: npm's second lock file (135).
- F: the .NET project files (137).
- G: the runners (131, 132).
- J: no or a wrong `Core:` line, through the steps and fresh (100).
- H, #629: a link on Windows (128), where git's comparison on the Windows-held project reads it.

Every kind with no test has a task.
