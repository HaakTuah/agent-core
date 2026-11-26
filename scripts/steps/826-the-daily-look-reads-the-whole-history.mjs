// The step of setup/sync-notes/826-the-daily-look-reads-the-whole-history.md, which steps.mjs, beside this folder, loads
// with the rest in the order of their names.
import { CORE } from "../core-address.mjs";
import { carriedAt, readCore } from "../core-path.mjs";
import { COST, shown } from "../step-checks.mjs";
import { Unread, callers, calls } from "../workflow-calls.mjs";

// (the commit the copy stands at, as the manifest's "Core:" line names it, or the carrying library's does: null where
// the line itself cannot be read, which the manifest's own step reports with its mend; a library not read here leaves
// the step not read)
const pinOf = p => {
  const core = readCore(p.manifest);
  if (core.wrong) return null;
  const at = core.form === "carried" ? carriedAt(core, p.read) : core;
  if (at.wrong) throw new Unread(at.wrong);
  return at.pin;
};

export default { lead: "26 November 2026, the daily look reads the whole history", cost: COST.workflow,
  // (each call of the core's daily job is pinned at the copy's own commit, whose look.yml checks out the whole history;
  // a project with no such call, whose orchestrator runs the look, has nothing to do here)
  check: p => {
    if (!calls(p, "look.yml").length) return null;
    const pin = pinOf(p), off = pin === null ? [] : [...new Set(calls(p, "look.yml").map(job => job.uses.slice(job.uses.indexOf("@") + 1)).filter(at => at !== pin))];
    return off.length ? `The daily job calls the core's \`look.yml\` at another commit than the copy's (at ${off.map(at => `\`${shown(at)}\``).join(", ")}, in ${callers(p, "look.yml").map(f => `\`${shown(f)}\``).join(", ")}), so its checkout may take one commit alone and the look's readers of history, the cleaning task's among them, read nothing. Mend: in one small pull request, set each such call's \`uses:\` to \`${CORE}/.github/workflows/look.yml@${pin}\`, the copy's commit, as \`core/setup/template/workflows/look.yml.tmpl\` has it; a sync's own process does so where the file is the kit's.` : null;
  } };
