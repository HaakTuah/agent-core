// The step of setup/sync-notes/480-a-project-in-several-repositories.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { modulesOf } from "../manifest-reads.mjs";
import { COST } from "../step-checks.mjs";

export default { lead: "16 November 2026, a project in several repositories", cost: COST.line,
  check: p => {
    const { taken, notTaken } = modulesOf(p.manifest);
    return taken === "all" || taken?.has("repositories.md") || notTaken.has("repositories.md") ? null
      : 'In one small pull request, add `repositories.md` to the "Modules:" line of `core-manifest.md` where the project is, or may become, more than one repository, or else add it to the line "Not taken:" under it as "`repositories.md` (one repository, which no library carries the core into)".';
  } };
