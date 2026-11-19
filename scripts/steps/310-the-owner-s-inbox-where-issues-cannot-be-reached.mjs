// The step of setup/sync-notes/310-the-owner-s-inbox-where-issues-cannot-be-reached.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { COST } from "../step-checks.mjs";

export default { lead: "15 November 2026, the owner's inbox where issues cannot be reached", cost: COST.read, unread: "whether issues can be read and written here is GitHub's answer, not a file's: `core/scripts/inbox.mjs` asks it, and each sync runs it from the next one on" };
