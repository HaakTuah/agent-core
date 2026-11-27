// The step of setup/sync-notes/440-the-tests-a-change-can-reach.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { COST } from "../step-checks.mjs";
import { selectionRuns } from "../step-checks-tests.mjs";

export default { lead: "16 November 2026, the tests a change can reach", cost: COST.workflow, check: selectionRuns,
  partly: "how the project's runner is told the files `RUN` names is the project's own, a job that runs tests without naming a file of them (a runner given none, a matrix) is read only where no job names one, and which tests are its proof is a reading of the project" };
