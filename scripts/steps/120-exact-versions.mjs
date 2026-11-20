// The step of setup/sync-notes/120-exact-versions.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { calls, copyAt } from "../workflow-calls.mjs";
import { runFiles } from "../own-runs.mjs";
import { COST } from "../step-checks.mjs";

export default { lead: "12 November 2026, exact versions", cost: COST.workflow,
  // (the core's licences.yml runs exact-versions.mjs itself; a project that runs the licence script from a workflow of
  // its own runs it beside it)
  check: p => {
    if (!p.files.some(f => /(^|\/)(?:package-lock|npm-shrinkwrap)\.json$/.test(f) && !f.startsWith(copyAt(p)) && !f.split("/").includes("node_modules"))) return null;
    if (calls(p, "licences.yml").length) return null;
    const own = runFiles(p, "licences.mjs");
    return own.length && !own.some(f => runFiles(p, "exact-versions.mjs").includes(f))
      ? `The workflow that runs the licence check, ${own.join(", ")}, runs \`node core/scripts/exact-versions.mjs <its config>\` beside it, as the core's \`licences.yml\` does.` : null;
  },
  partly: "that the licence check passes with its new step is held by that check" };
