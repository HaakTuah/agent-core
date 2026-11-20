// The step of setup/sync-notes/780-the-workflow-check-runs-zizmor-and-actionlint.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { COST } from "../step-checks.mjs";

export default { lead: "20 November 2026, the workflow check runs zizmor and actionlint", cost: COST.check, unread: "the findings that stood are read by the two tools alone, which the workflow check's job fetches and runs on the host's runners, never in a session, and first on the sync pull request's own run, after the steps were read; each run of the check notes each finding the base held, and the session that syncs files the task that names those of the sync pull request's run, which no file a step reads holds" };
