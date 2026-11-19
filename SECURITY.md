# Security

This repository takes the floor whole, `floor/security.md` and `floor/topics/`, with its threat model,
`floor/threat-model.md`. What this repository adds under the floor's numbers:

3. **The protected files:** every file here, changed by the sessions the owner starts in this repository, of any
   agent tool, and any session started from one at any depth, none on an outsider's text, as the builders of an
   orchestrator the owner's adviser started (`AGENTS.md`, "The queue").
5. **Untrusted input, and its checks:** the core's scripts read what others shape, here and in each project that runs
   them from its `core/` copy. Each input below is data (floor rule 4), which the scripts it names check against its
   shape and refuse where it fails, as floor topic 5 asks, its hostile tests trying each case. Each answers in 5 s at
   most, as its hostile tests time it (`scripts/hostile.mjs`), and each JSON it parses is nested 200 deep at most
   (`scripts/guards.mjs`); its limits name what it reads beyond that.
   - a pull request's description: read by the description checks (`scripts/pr-description.mjs`, and the line
     "Read for it:" by `scripts/reading.mjs`); limits: none of its own on the text, which GitHub holds to 65,536
     characters; 100 commits, one page; 8 s for the reading list's calls; hostile tests: `tests/hostile-pr-text-test.mjs`.
   - the comments and reviews on a pull request, their bodies and authors: read by the security-review check and
     the code-review wait (`scripts/security-review.mjs`, `scripts/code-review-wait.mjs`) and the size check's reader
     of a "Leanness check:" answer (`scripts/size.mjs`), with the descriptions of merged pull requests by the tools
     reader (`scripts/tools-read.mjs`), and, of any pull request's, by the scheduled look's reader of late review
     findings (`scripts/look.mjs` through `scripts/review-marks.mjs`), which puts a replier's login in a request's
     route; limits: 64 MB of an answer (256 MB for the look's), 20 pages of 100 for the tools reader and 50 for the
     look's, every page for the review checks, whose jobs stop at 6 and 5 minutes; hostile tests:
     `tests/hostile-pr-comments-test.mjs`.
   - what a pull request changes, its files' paths and content and its commits, a fork's among them: read by the
     proofs of a pure sync and of a change of comments alone (`scripts/pure-sync.mjs`, `scripts/comment-only.mjs`),
     the selection of tests (`scripts/select.mjs`), the tree a copy must be (`scripts/copy-tree.mjs`) and the lines
     a pull request adds under its manifest's "Differences" (`scripts/pr-description.mjs`); limits: 64 MB of git's
     answer (256 MB for the comments proof and the selection, 16 MB for the manifest, past which it is reported
     unread), and none in count, since every changed path is read; hostile tests: `tests/hostile-pr-changes-test.mjs`.
   - a *progress file* as a pull request changes it, a fork's among them, the path a project's manifest gives it, and
     GitHub's list of open issues: read by the queue's reader (`scripts/queue.mjs`), and by the scheduled look's reader
     of the work standing still (`scripts/look.mjs`, through `queue.mjs`'s placing and reading), with the open issues
     titled as the orchestrator's notice and their authors' rights; limits: 1 MB of the file, past which it is refused
     unread; 64 MB of an answer (256 MB to the look) and 100 pages of 100 for the open issues, past which it stops; for
     the look, the search's first page and five authors' rights; hostile tests: `tests/queue-test.mjs`, and for the
     look `tests/look-test.mjs`.
   - issues, their comments and labels: read by the labels check (`scripts/labels.mjs`), the stand-in's and the reviews'
     records (`scripts/stand-in-record.mjs`, `scripts/review-record.mjs`), the scheduled look (`scripts/look.mjs`), the
     inbox (`scripts/inbox.mjs`) and the personal terms' take-out (`scripts/issue-terms.mjs`, which edits only an
     insider's text); limits: 256 MB of an answer (16 MB for the inbox's own), 500 pages of 100, and for the take-out
     1,048,576 characters of a text, past which it is left unread, and the first 100 edits of its history; hostile
     tests: `tests/hostile-issues-test.mjs`, and for the take-out `tests/issue-terms-test.mjs`.
   - what GitHub's API answers, releases and tags, runs and checks, pull requests, whose account holds a repository (the
     workflow's event too) and an account's rights to it: read by `scripts/core-moved.mjs`, `scripts/releases.mjs`,
     `scripts/wait.mjs`, `scripts/stalled.mjs`, `scripts/core-cost.mjs`, `scripts/clean-merges.mjs`,
     `scripts/security-review.mjs`, `scripts/merge-line.mjs`, `scripts/runners.mjs` and `scripts/tools-offer.mjs`, and
     an account's rights by the code-review wait (`scripts/code-review-wait.mjs`), the scheduled look
     (`scripts/look.mjs`) and the size check (`scripts/size.mjs`, from `size.yml`) through `security-review.mjs`'s
     reader; limits: 1 MB of an answer to `core-moved.mjs`, `releases.mjs` and `tools-offer.mjs`, 64 MB or 256 MB to the
     others, 30 commits and 30 s each for the green main of `releases.mjs`, 30 merged pull requests for the wait, 50
     pages for the stalled look, 200 for the cost, 10 for the merge line, 20 s for the tools' offer, 30 s for the host's
     account; hostile tests: `tests/hostile-github-test.mjs`.
   - a project's configs of the core's checks, its manifest and its `SECURITY.md`: read by the copies, shape, size,
     licence and manifest checks (`scripts/copies.mjs`, `scripts/shape.mjs`, `scripts/size.mjs`,
     `scripts/reading-size.mjs`, `scripts/licences.mjs`, `scripts/manifest-reads.mjs`), the sync and its steps
     (`scripts/sync.mjs`, `scripts/steps.mjs`) and the scheduled look (`scripts/look.mjs`); limits: 64 MB of a file
     the steps read, past which it is reported unread, and none of their own in count, since a project's config is its
     own; hostile tests: `tests/hostile-configs-test.mjs`.
   - the files an agent tool takes its instructions from (`GEMINI.md`, an entry file, each file of a tool's folders), as
     the work tree and a pull request's base hold them: read by the copies and pointer checks (`scripts/copies.mjs`,
     `scripts/pointers.mjs`, through `scripts/rule-files.mjs`); limits: 1 MB of a file, past which it is not read, 40
     links followed from one path; hostile tests: `tests/copies-tools-test.mjs`.
   - a project's build, package and workflow files: read by the licence, exact-versions, NuGet, workflow and agent-tools
     checks and the reader of where the tests run (`scripts/licences.mjs`, `scripts/exact-versions.mjs`,
     `scripts/nuget.mjs`, `scripts/workflows.mjs`, `scripts/agent-tools.mjs`, `scripts/runners.mjs`) and the sync's move
     of the pins (`scripts/sync.mjs`); limits: 64 MB of a file for the licence check (256 MB for NuGet's), 1 MB of an
     action and 5,000 steps of a workflow, 60 s for git's filters, 64 MB of a workflow for the move of the pins, past
     which it is reported unread, and none on a file for the reader of where the tests run, a project's own, read whole,
     whose walk of a job's labels stops at 500 and 8 deep, and NuGet's lock file version 2, a newer refused (npm's lock
     file's number is not read yet: #663); hostile tests: `tests/hostile-build-files-test.mjs`.
   - what a package brings, from a registry or installed (its manifest, licence files and content hash), and what its
     registry and GitHub answer of it: read by the licence scan and the installed licences
     (`scripts/licence-scan.mjs`, `scripts/licence-installed.mjs`), the NuGet fetch (`scripts/nuget-fetch.mjs`), the
     lookup (`scripts/lookup.mjs`) and its lookup again of what a project holds (`scripts/held.mjs`, through the
     lookup's readers); Node itself is checked against its SHA-256 by `scripts/node.sh`; limits: 16 MB of a NuGet
     package's manifest, 100 pages of NuGet's registry, 20 lookups on GitHub in a run, 30 s for an answer (60 s for a
     NuGet package), 120 s for the whole look again; hostile tests: `tests/hostile-packages-test.mjs`.
6. **Rules 6, 7, 10 and 15:** the repository holds documents, the scripts projects run from their `core/` copy
   (`scripts/`, Node's and the shell's own tools) and the workflows projects call; it ships nothing. What it takes are
   tools that only run, each with its licence in its audit (`.github/licences-audit.json`). Among them is Node
   (`node-linux-<arch>` at the exact version in `.node-version`), which `scripts/node.sh` fetches for a project's cloud
   machine whose own Node is below the least long-term line in `.node-least`, or that has none, with
   `npm pack --ignore-scripts`, or with no npm by curl from the registry's own address over HTTPS, never installing it,
   and checks against its SHA-256 before it runs.
17. **Dependabot** updates only the workflows' GitHub actions (`.github/dependabot.yml`); this repository names no
    manifest or lock file, so no other PR of Dependabot's meets it.

The threat model's part: the core has no users of its own; what an attacker would want of it is a rule loosened here
that every project then takes, so a change reaches a project only through a sync PR there: a pure sync gets no review
of its own, since its content was reviewed in the core's own PR (floor rule 8), and any other is reviewed there like
any PR.

## Reporting a weakness

"Reporting a weakness" in `floor/topics/weaknesses.md`: privately, through the Security tab's "Report a vulnerability".
