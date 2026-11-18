# #593, point 8: the security-review status, read for its whole input

The pass, done once (#593, point 8; a sweep, point 10). The part: `.github/workflows/security-review.yml`,
`.github/workflows/own-security-review.yml`, `scripts/security-review.mjs`, with what they import (`scripts/comment-only.mjs`'s
`RUNS`, `scripts/started.mjs`) and the scripts the workflow runs (`scripts/pure-sync.mjs`, `scripts/clean-merges.mjs`,
`scripts/code-review-wait.mjs`), as `INVENTORY.md`:165-170 groups them. Read on `main` at 9ad580cd, 18 November 2026.
Line numbers are of that commit. Issue text was read as data.

## 1. The part's bugs

**Source:** the issues labelled `bug`, all states. Command:
`gh api --paginate -X GET repos/HaakTuah/agent-core/issues -f labels=bug -f state=all -f per_page=100`, then each file's
name matched in title and body. The search `repo:HaakTuah/agent-core is:issue label:bug security-review` gives the same
set, plus #388 and #373, and the issues matched on other parts. **Source count: 62 bugs; 12 name a file of the part or
say "security-review".** `INVENTORY.md`:169 counts "5, 2, 0 and 3, and 3 naming the workflow", which agrees.

| # | Title | Files named | Of the kind? |
| --- | --- | --- | --- |
| #239 | A "Security review:" comment posted before Codex's own review began ends the wait for it | security-review.mjs, .yml, code-review-wait.mjs | **yes**: an input whose timing it did not read (when Codex's review began, against when a posted review came) |
| #251 | The security-review status passes an open finding of Codex's that it cannot find, on any posted review | security-review.mjs, .yml | **yes**: a finding Codex gives in a review's own body (`pulls/N/reviews`), an input the workflow does not fetch |
| #293 | The security-review status reads only the found finding's time, so it misses a newer finding of Codex's given only in a review's body | security-review.mjs, .yml | **yes**: the same input as #251, after a finding it did find |
| #395 | The security-review check's mend names no actor, so sessions ask Codex and wait | security-review.mjs | no: the words of its mend, not an input |
| #403 | The review checks' mends leave out the two lines a posted review declares | security-review.mjs, code-review-wait.mjs | no: the words of its mend |
| #444 | Readers of the core's inputs that do not yet refuse every hostile case | pure-sync.mjs, comment-only.mjs | yes, but on those scripts' own reading (output cut by a pipe, an argument that names no commit), not the status's |
| #201 | The core's scratch bare repositories stop working where git reads only an explicit bare repository | pure-sync.mjs | yes (a platform), on pure-sync.mjs's own bare repository; the workflow's clone is not bare (security-review.yml:185) |
| #241 | The comment-only proof refuses common edits beside a block scalar | comment-only.mjs | yes, on comment-only.mjs's YAML reader; the status imports only `RUNS` (security-review.mjs:71) |
| #365 | A copy older than the first release syncs to main, not to a release | pure-sync.mjs | no for this part: the sync's fault; pure-sync.mjs reported it rightly |
| #355 | The core's shape baseline lists 58 functions past a mark | comment-only.mjs | no: a function's size |
| #388 | A run that a newer push to the same pull request supersedes runs to the end | "security-review" (named as the exception) | no: billing; the status keeps its order on purpose |
| #373 | The NuGet step adds a billed job on every pull request | "security-review" (named as the precedent) | no: the NuGet step |

**Counts:** 12 lines for 12 issues. On the status's own three files: 5 bugs, 3 of the kind (#239, #251, #293), 2 not.
On the scripts it runs or imports: 3 more of the kind (#201, #241, #444), each that script's own part. The three
on the status are one kind: **Codex's review in a timing or a place the part did not read.** The place is still not read:
the workflow fetches the issue comments, the review comments, the commits and the files (security-review.yml:136-140),
never `pulls/N/reviews`, where Codex's "Codex Security Review" review is posted (seen on #612). The summary-change guard
holds that gap (security-review.mjs:24-31, 343-351), not a reading of the reviews.

## 2. The sources that define the kinds

| What | The source that defines it | A full set? |
| --- | --- | --- |
| Events that start it | Host: GitHub's "Events that trigger workflows" (`pull_request` and its activity types; `issue_comment`: created, edited, deleted; `pull_request_review`, `pull_request_review_comment`, `merge_group`). Core: the caller `setup/template/workflows/security-review.yml.tmpl`:9-13, `own-security-review.yml`:10-14, the job's `if:` security-review.yml:93-104 | **Yes, the host's.** The core picks 4 + 2 of them |
| Who may post a review that counts | Rule: `tasks/reviews.md`:45-58 ("What a posted review stands for"), `roles/shared/teams.md`:13-19, floor rule 8 (`floor/security.md`:58). Host: REST `author_association` (8 values: OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR, FIRST_TIME_CONTRIBUTOR, FIRST_TIMER, MANNEQUIN, NONE); "Get repository permissions for a user" (`permission`: admin, write, read, none; `role_name`: admin, maintain, write, triage, read or a custom role; `user.permissions.push`); `user.type` (User, Bot, Organization) | **Yes, the host's**, for the association, the roles and the account types. The `reviewers` input is the project's own list |
| The forms of a posted review | `tasks/reviews.md`:42-44 (opens "Security review:", names the tool and the whole SHA, or "none needed" naming the head), :59-69 ("What a posted review declares"), :38-41 (comment-only.mjs's printout) | **Yes, the rule's**, and the part reads it (security-review.mjs:80, 237, 293-294) |
| The forms of Codex's review | **No published source.** Codex's app documents neither its summary's state line nor its words. The part's own list: security-review.mjs:76-78 (summary), :81 (finding), :105-107 (`RUNNING`), :131-132 (the "Running since" row). Seen on the core's PRs: one summary issue comment, receipt issue comments (`<!-- codex-review-receipt:v1 -->`), a review per run in `pulls/N/reviews` (state COMMENTED, "Codex Security Review", `commit_id`), findings as review comments with P0-P3 badges, and no check run or status (#612's head: only `github-actions` and `github-advanced-security` check runs) | **No full set exists.** The part reads what it does not know as "not running" or "unread", which holds nothing for good (security-review.mjs:105-107, 142-144) |
| A pure sync | Floor rule 8 (`floor/security.md`:65-68); `scripts/pure-sync.mjs` proves it | Yes, by the proof's own test (`tests/pure-sync-test.mjs`) |
| Dependabot's own | Floor rule 17 (`floor/topics/dependencies.md`:34) | Yes, by the rule |
| Kinds of pull request | Host: `draft`, `state`, `head.repo` (fork or not), the caps on `pulls/N/files` (3000) and `pulls/N/commits` (250). Core: an update from main (#323, `scripts/clean-merges.mjs`), BOUND (security-review.yml:141-158) | The host's fields are a full set; "update from main" is the core's own word |
| Kinds of repository | Host: `repository.private`, owner `type` (User or Organization). Core: the inputs `advisory`, `private`, `root`, `reviewers` (security-review.yml:64-84); `tasks/hosts.md`:30 (GitHub alone is proven) | Yes for visibility and owner type; the inputs are the core's own |

## 3. The kinds, each with its test

"sr" is `tests/security-review-test.mjs`, "hpc" `tests/hostile-pr-comments-test.mjs`, "hgh" `tests/hostile-github-test.mjs`,
"up" `tests/upgrade-test.mjs`, "wf" `tests/workflows-test.mjs`. "By design" means the part does not read it, and its
header says why.

**Events (14)**
- E1 `pull_request` opened, reopened, synchronize, ready_for_review, from a branch of the repository: up:588 (synchronize only; the job runs; what it posts is never read)
- E2 `pull_request` on a draft, skipped: **no test** of the job's `if:` (up:435's list leaves the job out); the script's own part: sr:68, 301
- E3 `pull_request` from a fork, skipped: **no test**
- E4 `pull_request` with Dependabot as the actor, skipped: **no test** (up:65-66 tests a similar expression, not the job's)
- E5 `issue_comment` created or edited by Codex's summary (its login and opening line): **no test** of the condition
- E6 `issue_comment` "Security review:" or "**Security review:" from OWNER, MEMBER or COLLABORATOR; any other association skipped: **no test** of the condition (the script's own part: sr:87-89)
- E7 `issue_comment` "Code review:" starts the job only where it is not advisory: **no test**
- E8 `issue_comment` on an issue, or on a closed pull request, skipped: **no test** of the condition
- E9 `issue_comment` deleted, `pull_request` closed or converted_to_draft, `pull_request_review`, `pull_request_review_comment`, `merge_group`: not listened to, by design (security-review.yml:58-59 for a deletion); the caller's `on:` is pinned only for the template (`tests/init-test.mjs`:74), **not for own-security-review.yml**
- E10 the input `advisory`, true or false: sr:291-293 (the script); the input's passage through the workflow: up (default only)
- E11 the input `private` with a private repository: skipped while advisory, up:606; runs with `private: true`: **no test**
- E12 the input `root`, `core` or `.`: up (`core` only); **`.` no test**
- E13 the input `reviewers`: sr:300 (as REVIEWERS); its passage through the workflow: **no test**
- E14 one run at a time, never cancelled: wf:124

**Who may post (13)**
- W1 the owner's account of a user-owned repository, its login in any case: sr:203
- W2 no owner to be read, or an owner's login that is a path: sr:206; hpc:107
- W3 association NONE, CONTRIBUTOR, FIRST_TIME_CONTRIBUTOR, FIRST_TIMER, MANNEQUIN, or not text: sr:88; hpc:74-75
- W4 a MEMBER or COLLABORATOR with no rights read: sr:203
- W5 role write, maintain, admin: sr:210-211; hgh:189
- W6 role read, triage, a custom role: sr:212-214
- W7 rights of another login, of a non-person, or a comment with no say: sr:215-218; hgh:199-201
- W8 no rights read at all: sr:219
- W9 the accounts `reviewers` names, and how the list is read: sr:204-205, 300; hpc:81
- W10 a pull request from before the check (BOUND=false): an unnamed member counts, told: sr:222
- W11 an organisation's repository (owner `type` Organization; its owners counted only through their rights): **no test** of that shape
- W12 the workflow's reading of rights: more than 20 commenters, the 45 s budget spent, an answer that fails (security-review.yml:218-236): **no test**
- W13 an app's account named in `reviewers`: its name is read (sr:205), whether its comment counts: **no test**

**Forms of a review (28)**
- F1 Codex's summary completed with no finding, real and made: sr:53, 74, 76
- F2 its braces written as entities: sr:54
- F3 running, queued, pending, in_progress, with and without a readable "Running since": sr:73, 90, 100-106; hpc:96, 124-126
- F4 status null, failed, or a word not known: sr:73, 107
- F5 a state that cannot be read (another version, no JSON, no security review, past 4000 characters): sr:58-63; hpc:57, 80
- F6 look-alikes (another login or type, quoted, a copy in the owner's comment): sr:81-84; hpc:93-94
- F7 two summaries: only the first is read: sr:78
- F8 a finding open, found among the review comments: sr:113-120, 131-133
- F9 a finding open, given only in a review's body (#251): sr:121-127
- F10 a newer finding given only in a review's body after one found (#293): sr:131-136
- F11 a finding mark that is not a real false or null: sr:114
- F12 a finding comment by someone else: sr:119
- F13 Codex's review on an earlier commit, or naming none: sr:74-75, 232-243
- F14 Codex's receipt comments and its "Codex Security Review" review in `pulls/N/reviews`: not read, by design (not fetched; F9 and F10 hold the gap); a generic comment of Codex's that is not a summary: sr:65; **the real receipt form: no test**
- F15 a finding's P0-P3 badge: not read, by design (security-review.mjs:55: whether a finding blocks stays with the reviews)
- F16 a posted review opening "Security review:" or "**Security review:": sr:87
- F17 forms that are not one (lower case, quoted, in code, after a first line, "@codex security review"): sr:89; hpc:72, 85-91, 142
- F18 naming the head by its whole SHA, an earlier commit, 39 or 41 hex digits, a SHA split by markup: sr:234-236; hpc:90-91, 105
- F19 naming no commit: sr:87, 231
- F20 "Security review: none needed" naming the head, in the rule's own words (`tasks/reviews.md`:42-44): **no test** of those words (the status cannot tell it from a review: security-review.mjs:36-38)
- F21 posted before Codex's review began, or in the same second: sr:100-110, 198
- F22 posted before or after a finding and the summary's last change: sr:115-139
- F23 comment-only.mjs's printout posted: sr:189-190; hpc:97
- F24 the two declared lines: not read by the status, by design; its mends name them: sr:43, 187, 264-266
- F25 a comment edited after it was posted: **no test**
- F26 a comment deleted: seen at the next run, by design (security-review.yml:58-59): **no test**
- F27 a "Security review:" posted as a pull request review, not a comment: not fetched, by design (the rule asks a comment): **no test**
- F28 pages, thousands of comments, megabytes of text: sr:77; hpc:49-55

**Kinds of pull request (12)**
- P1 closed or a draft: sr:68, 301
- P2 a head that is no SHA, or no pull request: sr:69; hpc:106, 140
- P3 from a fork: the script has no fork case (none needed); the job: E3, **no test**
- P4 a sync, proved pure or not, with Codex's review none, running, done or finding: sr:273-275, 299
- P5 the workflow's sync-shape filter (the manifest among its files, a copy at `core/` or the manifest's path; security-review.yml:167-173): **no test** (`tests/pure-sync-test.mjs` holds the proof, not the filter)
- P6 an update from main: proved, unproved, a merge of its own commit: sr:232-251, 267-268; `tests/clean-merges-test.mjs`
- P7 the workflow's filter for a head that is a merge (security-review.yml:174-178): **no test**
- P8 commits cut short at 250, or a count that is no count: sr:238-239; hpc:118
- P9 files cut short at 3000, or a count that is no count: sr:193-194; hpc:118-121
- P10 a head that holds an older copy of the script (BOUND=false): sr:109, 135, 138, 196, 222, 242, 268
- P11 the workflow's `held()` that sets BOUND (the script changed, the head's copy equal, other, absent, unreadable; security-review.yml:146-158): **no test**
- P12 Dependabot's own, and what runs by itself changed (floor rule 3's two): sr:145-150, 169-198, 231, 295, 297; hpc:110

**Kinds of repository (7)**
- R1 public, advisory: up:588; sr:291
- R2 private, advisory: no job: up:606
- R3 private with `private: true`, or with advisory off: **no test** of the job running
- R4 advisory off, as the core's own (own-security-review.yml:23-26): the script, sr:293-300 (in part); **the caller's inputs: no test**
- R5 an organisation's: see W11, **no test**
- R6 one where every review is posted (a plug-in, no Codex's app): its mends: sr:264-266
- R7 a default branch whose core is older (no security-review.mjs, clean-merges.mjs or code-review-wait.mjs; security-review.yml:131-134, 204, 251): **no test**

**Platform (3)**
- PL1 the host's 140 characters for a status: sr:110, 187, 243
- PL2 the status's link: sr:158
- PL3 the step's shell on the host's runner: run once, one path, by up:588 with a stand-in API (up:128-142); not on GitHub's runner itself

**Counts:** 77 kinds, one line each.
- **Held by a test: 46.** E14; W1-W10; F1-F13, F16-F19, F21-F24, F28; P1, P2, P4, P6, P8, P9, P10, P12; R1, R2, R6; PL1, PL2.
- **Held in part: 6.** E1 (one action), E10 and E13 (the script, not the workflow's passing), E11 (the skip, not the run), R4 (the script, not the caller), PL3 (one path, a stand-in API).
- **No test: 21.** The workflow's own condition, shell and callers, 15: E2-E8, E12, W12, P3, P5, P7, P11, R3, R7. The script's, 6: W11, W13, F14 (the real receipt), F20, F25, R5.
- **Not read, by design: 4.** E9, F15, F26, F27.

The script is held nearly whole; the workflow's 120 lines of shell and its 12-line condition run in no test but one path.

## 4. Point 9: the host as the authority

**Can the part's test run the part and the host on the same pull requests?** Not on the upgrade test's projects: their
API is a stand-in (up:128-142) that answers one completed review, so the host never answers there. Yes on recorded
answers of the host for **the core's own pull requests** (public, the owner's; point 9 rules out another owner's). What
the host can say in full, and what the comparison would read:

1. **Who may write.** The part already asks the host per login (`collaborators/<login>/permission`) and reads it
   strictly (security-review.mjs:231-235). The authority for the whole set is the host's list
   `collaborators?affiliation=all&permission=push`. The test runs `writersOf()` on each recorded per-login answer and
   compares it with that list: any difference fails, but for one listed on purpose (a custom role on write counts for
   no one, sr:212-214). In the core this set holds one account, the owner's; the roles of W5-W7 and an organisation's
   owners (W11) can be recorded only from a repository with such accounts, which only the owner can make.
2. **What a pull request's reviews are.** The host's record of Codex's work is `pulls/N/reviews` (each run's review,
   its `commit_id` and `submitted_at`), `pulls/N/comments` (each finding) and the review threads (`resolved`, through
   GraphQL `reviewThreads`, or `pulls/N/ccr/review_threads` in a cloud session). For each recorded pull request the test
   runs `judge()` on the five inputs the workflow fetches, then checks against the host's record:
   - each Codex security review in `pulls/N/reviews` was submitted no later than the summary's `updated_at`: the
     assumption the summary-change guard rests on (security-review.mjs:27-28, 343-351; #251, #293);
   - the newest such review's `commit_id` is the summary's `security_review.commit_sha`;
   - where a thread opened by a Codex security finding is unresolved on the merged head, the verdict is not "has run"
     with no posted review after it.
   Any difference fails. Codex's running and completed state has no authority outside the summary itself, so that
   part has no comparison ("no full set exists").
3. **Whether the host can do the reading itself (#534).** In part, and not in every project:
   - `required_review_thread_resolution` in the ruleset (now false on `main`) would have the host refuse a merge with a
     Codex finding's thread unresolved. It is wider than the rule (every thread, code review included), it misses a
     finding given only in a review's body, resolving a thread proves no fallback review (one login, #187), and on
     GitHub's free plan a private repository has no rulesets, so it holds nothing there.
   - Required approvals: dropped on fact (`INVENTORY.md`:168-169). Codex reviews as COMMENTED, and an author cannot
     approve their own pull request under one login.
   - A check of Codex's own to require: none exists (no check run or status of Codex's on #612's head).
   So the host can take over at most the open-finding part, as an addition in public and paid repositories. #534's
   trial should weigh `required_review_thread_resolution` beside the status, never in its place.

**Concretely:** a recorder (a script run by hand, or by the monthly state report session) saves, for the core's last
merged pull requests that had a Codex security review, the five inputs, `pulls/N/reviews`, the review threads, and the
rights answers, as JSON under `tests/`. `tests/security-review-test.mjs` (or a file of its own) reads them offline, with
no token and no billed job, and runs the three comparisons above.

## 5. The gaps, as tasks

### Small: in the pass's own pull request (a case or two in an existing test), each done in #624

**Task S1. Test the security-review job's condition for each event kind.**
What to test: evaluate `jobs.report.if` of `security-review.yml` with `workflow-run.mjs`'s `evaluate()`, which already
reads `startsWith`, `contains` and `fromJSON` (up:65-66), for: a `pull_request` on a draft, from a fork, by Dependabot;
an `issue_comment` from Codex's summary and from a look-alike; "Security review:" and "**Security review:" from OWNER,
MEMBER and COLLABORATOR, and from CONTRIBUTOR and NONE; "Code review:" with advisory on and off; a comment on an issue
and on a closed pull request; a private repository with advisory on, with `private: true`, with advisory off.
Kinds: E2-E8, E11, R3. File: `tests/workflows-test.mjs`.

**Task S2. Pin own-security-review.yml's triggers and inputs.**
What to test: its `on:` is the template's (opened, reopened, synchronize, ready_for_review; created, edited) and it
passes `root: .` and `advisory: false`. Kinds: E9 (for this caller), E12, R4. File: `tests/workflows-test.mjs`, beside
`tests/init-test.mjs`:74.

**Task S3. A case for each of four kinds of posted review.**
What to test: "Security review: none needed" naming the head passes, and naming an earlier commit after a push of the
pull request's own waits (F20); a review edited after it was posted (F25), which #630 since holds with a case of
its own, an edited review counting no longer; an organisation's repository (owner of type
Organization) counts an owner's review only through its rights (W11, R5); an app's account named in `reviewers`, its
comment of association NONE and of COLLABORATOR, counts only in the second (W13). File: `tests/security-review-test.mjs`.

**Task S4. Codex's real receipt is not a summary.**
What to test: an issue comment of Codex's opening `<!-- codex-review-receipt:v1 -->`, in the form seen on the core's
pull requests, is read as no summary and no finding (F14). File: `tests/security-review-test.mjs`, beside sr:65.

### Large: filed as tasks

**Task L1, filed: #625. Run the security-review workflow's shell for each kind it branches on.**
What to test: run `security-review.yml` through `workflow-run.mjs`, as the upgrade test does, with a stand-in `gh`
whose answers vary by case, and read the statuses it posts: `held()` (the script changed by the pull request, the
head's copy equal, other, absent, unreadable, the files cut short); the sync-shape filter (a copy at `core/`, at the
path the manifest names, a file outside both); the merge filter (a head that is a merge from main, a merge of the pull
request's own commit); the rights loop (21 commenters, an answer that fails, the time spent); a default branch whose
core lacks each script; `root: .`; `reviewers` passed through; each `pull_request` action the caller lists, the status
it posts read from the stand-in's log. Kinds: E1, E10, E12, E13, W12, P5, P7, P11, R7, PL3.
File: a new `tests/security-review-workflow-test.mjs`, or a part of `tests/upgrade-test.mjs`.

**Task L2, filed: #626. Compare the status with the host's own record (#593, point 9).**
What to test: record, for the core's own merged pull requests that had a Codex security review, the five inputs the
workflow fetches, `pulls/N/reviews`, the review threads and the rights answers; then, offline, fail where
`writersOf()` differs from the host's push list (but for the custom role, listed), where a Codex security review was
submitted after the summary's last change, where Codex's reviewed commit differs from the summary's, or where an
unresolved Codex security thread on the merged head meets a "has run" with no review after it. Kinds: W5-W7, W11, F9,
F10, F13, F14. Files: a recorder under `scripts/`, its answers under `tests/`, the comparison in
`tests/security-review-test.mjs`. Reads from: the host, as an authority.

**Task L3 (for #534), filed: #627. Weigh the host's thread resolution beside the status.**
What to weigh: `required_review_thread_resolution` on the core's `main` ruleset, replayed on #239, #251 and #293 (#593,
point 7), with what it does not hold (findings in a review's body, private repositories on the free plan, one login).
Kinds: F8-F10. File: `INVENTORY.md`:165-170 (its *Tried:* line). A trial, not a test.

**Not read, by design (4), no task:** E9 (events not listened to; the callers' `on:` pinned by S2), F15 (a finding's
badge), F26 (a deletion, seen at the next run), F27 (a review posted as a pull request review). Each is said in the
part's header or the rule. Codex's review in `pulls/N/reviews` (F14) stays unfetched, and L2 compares it instead.

**Tasks against kinds:** S1-S4 take 16 of the 21 with no test (S1: E2-E8, P3, R3; S2: E12; S3: F20, F25, W11, W13, R5;
S4: F14) and 2 held in part (E11, R4); L1 takes the other 5 (W12, P5, P7, P11, R7) and 4 held in part (E1, E10, E13,
PL3); L2 adds the host's side to 8 kinds (W5-W7, W11, F9, F10, F13, F14). Every kind with no test, or held in part, has a task.
