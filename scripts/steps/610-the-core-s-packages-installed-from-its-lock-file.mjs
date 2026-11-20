// The step of setup/sync-notes/610-the-core-s-packages-installed-from-its-lock-file.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { COST } from "../step-checks.mjs";
import { installsFirst } from "../step-checks-lookup.mjs";

export default { lead: "18 November 2026, the core's packages installed from its lock file", cost: COST.workflow, check: installsFirst,
  partly: "that a job reaching a script of the copy through the project's own npm or shell script installs first is read by the review" };
