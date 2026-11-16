# Security

This repository takes the floor whole, `floor/security.md` and `floor/topics/`, with its threat model,
`floor/threat-model.md`. What this repository adds under the floor's numbers:

3. **The protected files:** every file here, changed by the sessions the owner starts in this repository, of any
   agent tool, and the builder sessions an orchestrator among them starts (`AGENTS.md`, "The queue").
5. **Untrusted input, and its checks:** the core's scripts read what others shape, here and in each project that runs
   them from its `core/` copy. Each input below is data (floor rule 4), which the scripts it names check against its
   shape and refuse where it fails, as floor topic 5 asks, its hostile tests trying each case.
   - a pull request's description: read by the description checks (`scripts/pr-description.mjs`, and the line
     "Read for it:" by `scripts/reading.mjs`); hostile tests: `scripts/hostile-pr-text-test.mjs`.
   - the comments and reviews on a pull request, their bodies and authors: read by the security-review check and
     the code-review wait (`scripts/security-review.mjs`, `scripts/code-review-wait.mjs`) and the size check's reader
     of a "Leanness check:" answer (`scripts/size.mjs`); hostile tests: `scripts/hostile-pr-comments-test.mjs`.
   - what a pull request changes, its files' paths and content and its commits, a fork's among them: read by the
     proofs of a pure sync and of a change of comments alone (`scripts/pure-sync.mjs`, `scripts/comment-only.mjs`),
     the selection of tests (`scripts/select.mjs`) and the tree a copy must be (`scripts/copy-tree.mjs`); hostile
     tests: `scripts/hostile-pr-changes-test.mjs`.
   - issues, their comments and labels: read by the labels check (`scripts/labels.mjs`), the stand-in's and the
     reviews' records (`scripts/stand-in-record.mjs`, `scripts/review-record.mjs`), the scheduled look
     (`scripts/look.mjs`) and the inbox (`scripts/inbox.mjs`); hostile tests: `scripts/hostile-issues-test.mjs`.
   - what GitHub's API answers, releases and tags, runs and checks, pull requests: read by `scripts/core-moved.mjs`,
     `scripts/releases.mjs`, `scripts/wait.mjs`, `scripts/stalled.mjs`, `scripts/core-cost.mjs` and
     `scripts/clean-merges.mjs`; hostile tests: `scripts/hostile-github-test.mjs`.
   - a project's configs of the core's checks, its manifest and its `SECURITY.md`: read by the copies, shape, size,
     licence and manifest checks (`scripts/copies.mjs`, `scripts/shape.mjs`, `scripts/size.mjs`,
     `scripts/reading-size.mjs`, `scripts/licences.mjs`, `scripts/manifest-reads.mjs`) and the sync's steps
     (`scripts/steps.mjs`); hostile tests: `scripts/hostile-configs-test.mjs`.
   - a project's build, package and workflow files: read by the licence, exact-versions, NuGet, workflow and
     agent-tools checks (`scripts/licences.mjs`, `scripts/exact-versions.mjs`, `scripts/nuget.mjs`,
     `scripts/workflows.mjs`, `scripts/agent-tools.mjs`); hostile tests: `scripts/hostile-build-files-test.mjs`.
   - what a package brings, from a registry or installed (its manifest, licence files and content hash), and what its
     registry and GitHub answer of it: read by the licence scan and the installed licences
     (`scripts/licence-scan.mjs`, `scripts/licence-installed.mjs`), the NuGet fetch (`scripts/nuget-fetch.mjs`) and
     the lookup (`scripts/lookup.mjs`); Node itself is checked against its SHA-256 by `scripts/node.sh`; hostile
     tests: `scripts/hostile-packages-test.mjs`.
6. **Rules 6, 7, 10 and 15:** the repository holds documents, the scripts projects run from their `core/` copy
   (`scripts/`, Node's and the shell's own tools) and the workflows projects call; it ships nothing. What it takes are
   tools that only run, each with its licence in its audit (`.github/licences-audit.json`). Among them is Node
   (`node-linux-<arch>` at the exact version in `.node-version`), which `scripts/node.sh` fetches for projects' cloud
   machines with `npm pack --ignore-scripts`, never installing it, and checks against its SHA-256 before it runs.
17. **Dependabot** updates only the workflows' GitHub actions (`.github/dependabot.yml`); this repository names no
    manifest or lock file, so no other PR of Dependabot's meets it.

The threat model's part: the core has no users of its own; what an attacker would want of it is a rule loosened here
that every project then takes, so a change reaches a project only through a sync PR there: a pure sync gets no review
of its own, since its content was reviewed in the core's own PR (floor rule 8), and any other is reviewed there like
any PR.

## Reporting a weakness

"Reporting a weakness" in `floor/topics/weaknesses.md`: privately, through the Security tab's "Report a vulnerability".
