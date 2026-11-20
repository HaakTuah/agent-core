// The step of setup/sync-notes/230-the-core-s-scripts-started-through-bash.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { copyAt, readable } from "../check-configs.mjs";
import { COST, inCopy } from "../step-checks.mjs";

export default { lead: "13 November 2026, the core's scripts started through bash", cost: COST.workflow,
  check: p => {
    // (a command, at a line's start or after ; & | or (, that is a file under core/scripts/ by its path alone)
    const copy = copyAt(p), bare = new RegExp(`(?:^|[;&|(])\\s*(?:\\./)?${inCopy(copy)}scripts/[\\w.-]+`, "m");
    readable(p, text => text.includes(`${copy}scripts/`));
    const by = Object.entries(p.workflows).filter(([, w]) => Object.values(w.yaml?.jobs ?? {}).some(job => (job?.steps ?? [])
      .some(s => typeof s?.run === "string" && bare.test(s.run.split("\n").filter(l => !/^\s*#/.test(l)).join("\n")))));
    return by.length ? `No workflow runs a file under \`${copy}scripts/\` by its path alone: start it with \`bash\` (a .sh) or \`node\` (a .mjs). In: ${by.map(([f]) => `.github/workflows/${f}`).join(", ")}.` : null;
  } };
