// The step of setup/sync-notes/460-no-workflow-gives-a-key-twice.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { COST, keysOnce } from "../step-checks.mjs";

export default { lead: "16 November 2026, no workflow gives a key twice", cost: COST.workflow, check: keysOnce };
