// The step of setup/sync-notes/390-secret-scanning-with-push-protection.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { COST } from "../step-checks.mjs";

export default { lead: "16 November 2026, secret scanning with push protection", cost: COST.read, unread: "whether secret scanning and its push protection are on is GitHub's setting, not a file's: `gh api repos/<owner>/<repo>` answers it under `security_and_analysis`, and the entry says how a session switches them on or names them to the owner" };
