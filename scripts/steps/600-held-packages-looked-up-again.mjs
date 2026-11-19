// The step of setup/sync-notes/600-held-packages-looked-up-again.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { COST } from "../step-checks.mjs";

export default { lead: "17 November 2026, held packages looked up again", cost: COST.read, unread: "whether a package has gone stale is its registry's answer on the day, and GitHub's, not a file's: the session that syncs runs `node core/scripts/held.mjs` once and puts what it prints in the sync pull request's description, each package gone stale a task; the scheduled look runs it again each month" };
