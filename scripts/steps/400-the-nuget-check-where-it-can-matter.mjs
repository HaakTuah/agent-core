// The step of setup/sync-notes/400-the-nuget-check-where-it-can-matter.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { COST } from "../step-checks.mjs";
import { nugetPathsHold } from "../step-checks-workflow-text.mjs";

export default { lead: "16 November 2026, the NuGet check where it can matter", cost: COST.workflow, check: nugetPathsHold,
  partly: "whether the repository is private is GitHub's setting, not a file's; the starter kit now runs a private project's NuGet check as a step of `core.yml`'s one job (17 November 2026), so `core/scripts/fresh.mjs` lists that call, not these `paths:`" };
