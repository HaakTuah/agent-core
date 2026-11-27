// The step of setup/sync-notes/826-the-daily-look-reads-the-whole-history.md, which steps.mjs, beside this folder, loads
// with the rest in the order of their names.
import { COST } from "../step-checks.mjs";

export default { lead: "26 November 2026, the daily look reads the whole history", cost: COST.workflow, asks: "nothing", unread: "the sync that brings it moves each call of the core's `look.yml` it can read to the copy's commit, since the workflow changed, and names each it cannot read; a later sync leaves a call where `look.yml` is the same at both commits, so no pin a check could compare tells done from not done" };
