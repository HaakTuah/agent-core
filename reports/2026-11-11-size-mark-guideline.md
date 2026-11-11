# A size mark raised without its reason blocks, in every project's reviews

The final audit of the core and both games found the rule that a PR crossing a size mark says why written in two places.
It stands in `scripts/reading-size.mjs` ("A PR that crosses a mark moves the mark in the config and says why in its
description"), which no reviewer is asked to read. It also stands in one game's own review guidelines, which the other
game's lack. So one game's reviewers held it and the other's did not.

- **`modules/review-guidelines.md`, "What blocks":** a size mark raised without its reason in the PR blocks, for every
  reviewer. The paragraph is rewrapped.

What changes in every project: its reviewers block a raised size mark that the PR does not explain. A game that wrote
this in its own review guidelines drops that line, now a copy. The review guidelines change only on the owner's word
(core archive 56), so this waits for his yes in the PR, as does the game's line going.

Questions for the owner: his yes in the PR.
