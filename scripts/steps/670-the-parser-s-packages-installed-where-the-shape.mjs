// The step of setup/sync-notes/670-the-parser-s-packages-installed-where-the-shape.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { COST, parserFirst } from "../step-checks.mjs";

export default { lead: "19 November 2026, the parser's packages installed where the shape check runs", cost: COST.workflow, check: parserFirst,
  partly: "that a job reaching the shape check through the project's own npm or shell script installs the parser's first is read by the review" };
