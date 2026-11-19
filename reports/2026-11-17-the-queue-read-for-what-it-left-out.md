# The open queue read for what its issues left out

The one-time pass of #593, point 5, on 17 November 2026, at `main` 9f7dc64: each open issue labelled `queued` read once,
asking what its scope leaves out of what its purpose covers. A find that passes point 4's three tests (it adds no new
rule, asks nothing more of any project, and changes neither the floor nor the review guidelines) stands as a note on
its issue, which binds nothing and which the issue's builder weighs under point 4; the rest went to the owner as one
list, #607. No issue was rewritten, and no line waited for the pass.

**The source** (point 10): the open issues labelled `queued`, counted by

    gh api 'repos/HaakTuah/agent-core/issues?labels=queued&state=open&per_page=100' --paginate --jq '.[] | select(.pull_request|not) | .number' | wc -l

**Counts:** 80 in the source; 80 lines below. 28 found nothing; 51 have a note (52 finds, #551's two in one note); 3
went to #607 (#457, #469 and #492; the last two have a note as well). No find was a weakness.

**How it was read:** by a builder session that wrote none of the issues, with four fresh helpers at the same model,
twenty issues each, every find checked against the repository; this session checked a sample of each helper's finds
again before posting them. A find another queued issue already covers, a doubt about an issue's aim, and what an issue
leaves out on purpose were not counted.

| Issue | What its scope left out |
| --- | --- |
| #204 | README's and INVENTORY's lines on the hook; the hardened read in `work-saved.sh` to reuse: [note](https://github.com/HaakTuah/agent-core/issues/204#issuecomment-6961387209) |
| #259 | the hooks, the tools' entry files and the issue forms: [note](https://github.com/HaakTuah/agent-core/issues/259#issuecomment-6961387549) |
| #306 | the start hook is `work-saved.sh`, shared by three tools; no slot for the quick check; paths moved: [note](https://github.com/HaakTuah/agent-core/issues/306#issuecomment-6961387927) |
| #307 | the standing rule "A test taken out or weakened is said"; #557's reader beside it: [note](https://github.com/HaakTuah/agent-core/issues/307#issuecomment-6961388302) |
| #308 | nothing |
| #309 | the pure-sync path in the security-review status, its workflow and `tasks/reviews.md`: [note](https://github.com/HaakTuah/agent-core/issues/309#issuecomment-6961388678) |
| #310 | the issue form's four homes and the audit's fixed questions: [note](https://github.com/HaakTuah/agent-core/issues/310#issuecomment-6961389090) |
| #314 | nothing |
| #318 | rules that already hold parts of points 1 to 3; paths moved: [note](https://github.com/HaakTuah/agent-core/issues/318#issuecomment-6961389423) |
| #325 | `milestones.mjs` and `done-when.mjs` already read most of the form: [note](https://github.com/HaakTuah/agent-core/issues/325#issuecomment-6961389746) |
| #337 | nothing |
| #355 | nothing |
| #361 | paths moved; point 2's words now in `roles/stand-in.md`, under the stand-in's cap: [note](https://github.com/HaakTuah/agent-core/issues/361#issuecomment-6961390127) |
| #390 | nothing |
| #391 | nothing |
| #397 | the other tools' parts, the order's new home, `setup/server.md`: [note](https://github.com/HaakTuah/agent-core/issues/397#issuecomment-6961390468) |
| #404 | nothing |
| #407 | nothing |
| #416 | nothing |
| #426 | nothing |
| #438 | nothing |
| #441 | `own-modules.mjs`, `init.mjs`, the stub and `manifest-reads.mjs`: [note](https://github.com/HaakTuah/agent-core/issues/441#issuecomment-6961390826) |
| #446 | `core-moved.mjs`, run just before the look, reads the manifest the same way: [note](https://github.com/HaakTuah/agent-core/issues/446#issuecomment-6961391202) |
| #447 | a submodule fails the same way (seen in a scratch repository): [note](https://github.com/HaakTuah/agent-core/issues/447#issuecomment-6961391583) |
| #449 | `CASES` in `staged.mjs`, and the rule's entry in `reports/unheld.json`: [note](https://github.com/HaakTuah/agent-core/issues/449#issuecomment-6961391944) |
| #452 | nothing |
| #453 | nothing |
| #455 | the same `core/` pair in `labels.mjs`'s `sinceHere`: [note](https://github.com/HaakTuah/agent-core/issues/455#issuecomment-6961392342) |
| #456 | the kit's `SECURITY.md` template, and the step's staged break in `steps-stage.mjs`: [note](https://github.com/HaakTuah/agent-core/issues/456#issuecomment-6961392716) |
| #457 | point 4 names a kit job of tests that does not exist, so it asks projects to change their own: #607 |
| #458 | nothing |
| #459 | nothing |
| #460 | point 5's marks belong in `reading-size.mjs`, not `size.mjs`: [note](https://github.com/HaakTuah/agent-core/issues/460#issuecomment-6961393061) |
| #464 | the role lists in `cited.mjs` and `labels.json`: [note](https://github.com/HaakTuah/agent-core/issues/464#issuecomment-6961393462) |
| #467 | three more places that name a model: [note](https://github.com/HaakTuah/agent-core/issues/467#issuecomment-6961393807) |
| #469 | the start list read from `reading.mjs` (note); the review guidelines at the reviewer's start (owner): [note](https://github.com/HaakTuah/agent-core/issues/469#issuecomment-6961394135), #607 |
| #471 | the README's list of the kinds of pace: [note](https://github.com/HaakTuah/agent-core/issues/471#issuecomment-6961394464) |
| #484 | one manifest name must leave out every game file (`leftOut`, `own-modules.mjs`): [note](https://github.com/HaakTuah/agent-core/issues/484#issuecomment-6961394801) |
| #485 | `licence-scan.mjs` already asks an entry for a model file: [note](https://github.com/HaakTuah/agent-core/issues/485#issuecomment-6961395196) |
| #486 | the kit's `choices.md.tmpl` and `choices.mjs` for point 1's line: [note](https://github.com/HaakTuah/agent-core/issues/486#issuecomment-6961395584) |
| #492 | the voice in `labels.json` and `labels.mjs` (note); a session the adviser starts is beyond floor rules 3 and 18 (owner): [note](https://github.com/HaakTuah/agent-core/issues/492#issuecomment-6961395959), #607 |
| #502 | two reusable checks that skip a draft by themselves; `readyOnlyHolds`: [note](https://github.com/HaakTuah/agent-core/issues/502#issuecomment-6961396325) |
| #514 | nothing |
| #522 | nothing |
| #527 | four scripts that serve the tests alone: [note](https://github.com/HaakTuah/agent-core/issues/527#issuecomment-6961396688) |
| #528 | CodeQL in a project, and the core's shape, mutation and strength readers: [note](https://github.com/HaakTuah/agent-core/issues/528#issuecomment-6961397040) |
| #529 | nothing |
| #530 | `licence-commands.mjs` and `workflow-run.mjs`'s YAML, named by the record: [note](https://github.com/HaakTuah/agent-core/issues/530#issuecomment-6961397415) |
| #534 | `node.sh` holds digests for Linux alone: [note](https://github.com/HaakTuah/agent-core/issues/534#issuecomment-6961397757) |
| #541 | the same fault on `AGENTS.md` at the base, the other way round: [note](https://github.com/HaakTuah/agent-core/issues/541#issuecomment-6961398091) |
| #542 | nothing |
| #546 | `fresh.mjs` and `check.mjs` take `codeql.yml` as public-only: [note](https://github.com/HaakTuah/agent-core/issues/546#issuecomment-6961398449) |
| #548 | nothing |
| #549 | the reusable `pr-description.yml`, `core.yml` and `checks.mjs`: [note](https://github.com/HaakTuah/agent-core/issues/549#issuecomment-6961398759) |
| #550 | two floor rules with no holder that `unheld.json` leaves out: [note](https://github.com/HaakTuah/agent-core/issues/550#issuecomment-6961399104) |
| #551 | the "none needed" exception and #404; the slot *design-checked PRs* in a project: [note](https://github.com/HaakTuah/agent-core/issues/551#issuecomment-6961399432) |
| #552 | a row that names no issue: [note](https://github.com/HaakTuah/agent-core/issues/552#issuecomment-6961399764) |
| #553 | "no shared measurement": two pull requests that share a role's cap: [note](https://github.com/HaakTuah/agent-core/issues/553#issuecomment-6961400112) |
| #554 | nothing |
| #555 | nothing |
| #556 | nothing |
| #557 | the core's tests have no `test(` line; a renamed test; the README's list: [note](https://github.com/HaakTuah/agent-core/issues/557#issuecomment-6961400460) |
| #558 | the strength baseline the audit's pull request also writes: [note](https://github.com/HaakTuah/agent-core/issues/558#issuecomment-6961400770) |
| #563 | nothing |
| #565 | nothing |
| #579 | `check.mjs` runs the check off the host; terms kept out of the tool's output: [note](https://github.com/HaakTuah/agent-core/issues/579#issuecomment-6961401135) |
| #580 | `yaml-keys.mjs`'s callers in `steps.mjs` and `copies.mjs`; #528 touches it too: [note](https://github.com/HaakTuah/agent-core/issues/580#issuecomment-6961401503) |
| #581 | the README and `test-record.mjs` describe `mutate.mjs`; projects may name it: [note](https://github.com/HaakTuah/agent-core/issues/581#issuecomment-6961401861) |
| #582 | nothing |
| #583 | the copies check's `core.yml` path: [note](https://github.com/HaakTuah/agent-core/issues/583#issuecomment-6961402220) |
| #584 | pruning runs and the tools' runs of the cases: [note](https://github.com/HaakTuah/agent-core/issues/584#issuecomment-6961402604) |
| #585 | the install is in the signature check, not `licences.yml`: [note](https://github.com/HaakTuah/agent-core/issues/585#issuecomment-6961402982) |
| #586 | the NuGet check's `core.yml` path: [note](https://github.com/HaakTuah/agent-core/issues/586#issuecomment-6961403344) |
| #587 | `floor/threat-model.md` and `roles/shared/teams.md` are read by task too: [note](https://github.com/HaakTuah/agent-core/issues/587#issuecomment-6961403736) |
| #589 | nothing |
| #590 | the hooks' `bash -c` commands and their templates: [note](https://github.com/HaakTuah/agent-core/issues/590#issuecomment-6961404080) |
| #591 | nothing |
| #592 | the `"how"` of `versions.json`'s Node entry: [note](https://github.com/HaakTuah/agent-core/issues/592#issuecomment-6961404494) |
| #593 | the README's list of the description check's lines, and `SECURITY.md`'s inputs: [note](https://github.com/HaakTuah/agent-core/issues/593#issuecomment-6961404829) |
| #594 | the outcomes live in `outcomes.mjs`: [note](https://github.com/HaakTuah/agent-core/issues/594#issuecomment-6961405203) |
