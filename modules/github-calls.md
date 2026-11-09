# GitHub's REST calls from a cloud session

The calls builders run to open, mark ready, merge and inspect PRs where `gh`'s usual commands fail. Read when a cloud
session needs one.

Claude's cloud sessions can't use GitHub's GraphQL API, so `gh pr create`, `gh pr list`, `gh pr view` and `gh pr ready`
fail there, and they use the REST calls below (`<repo>`: the repository's name). Where GraphQL works, `gh pr ready <n>`
marks a draft ready; the `ccr/ready_for_review` route below is Claude's cloud proxy's, not GitHub's REST API.

```bash
gh api repos/HaakTuah/<repo>/pulls -f title=... -f head=<branch> -f base=develop -f body=...  # add -F draft=true for a draft
gh api -X POST repos/HaakTuah/<repo>/pulls/<n>/ccr/ready_for_review                           # mark a draft ready, in Claude's cloud sessions (starts the security review)
gh api -X PUT repos/HaakTuah/<repo>/pulls/<n>/merge -f merge_method=merge                     # merge into develop
gh api repos/HaakTuah/<repo>/compare/develop...<branch> --jq '.files[].filename'             # the files a branch changes
gh api repos/HaakTuah/<repo>/pulls/<n> --jq '{state, merged}'                                 # was it merged?
gh api "repos/HaakTuah/<repo>/pulls?state=open&base=main&head=HaakTuah:develop" --jq '.[0].number'  # the open milestone PR
gh api "repos/HaakTuah/<repo>/pulls?state=all&base=main&head=HaakTuah:develop" --jq '.[0] | {number,state,merged_at}'  # the last milestone PR: merged_at set means merge main back into develop first
gh api repos/HaakTuah/<repo>/pulls -f title=... -f head=develop -f base=main -f body=...       # the milestone PR
```
