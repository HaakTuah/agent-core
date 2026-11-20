// The step of setup/sync-notes/780-the-workflow-check-runs-zizmor-and-actionlint.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { COST } from "../step-checks.mjs";

export default { lead: "20 November 2026, the workflow check runs zizmor and actionlint", cost: COST.check, unread: "the findings that stood are read by the two tools alone, which the workflow check's job fetches and runs on the host's runners, never in a session; each run of the check, on every pull request and on main, notes each that the base held, so they are listed there" };
