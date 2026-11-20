// The step of setup/sync-notes/360-an-agent-s-own-tools-listed.md, which steps.mjs, beside this folder, loads with the rest in the order
// of their names.
import { coreOf, kitHooks, listed, readProject, check as toolsCheck } from "../agent-tools.mjs";
import { installed } from "../packages.mjs";
import { calls, copyAt, licenceConfig, runFiles } from "../check-configs.mjs";
import { COST } from "../step-checks.mjs";

export default { lead: "16 November 2026, an agent's own tools listed", cost: COST.line,
  // (the agent-tools check's own reading, with a missing list read as an empty one: what it would fail once written.
  // The core's licences.yml runs the check itself; a project that runs the licence script from a workflow of its own
  // runs it beside it, as of exact versions, and the config is the one that workflow passes: check-configs.mjs)
  check: p => {
    const own = calls(p, "licences.yml").length ? [] : runFiles(p, "licences.mjs");
    const beside = own.some(f => runFiles(p, "agent-tools.mjs").includes(f));
    const file = licenceConfig(p);
    let config = null;
    try { config = JSON.parse(p.read(file) ?? "null"); } catch { /* (read as no list, below) */ }
    // (with the core's packages not installed, a Codex config cannot be read: the step says so, with the install, and
    // every other step is still told, as of a key given twice)
    if (p.read(".codex/config.toml") !== null && !installed("smol-toml")) return `The core's packages are not installed, so \`.codex/config.toml\` could not be read for the tools it configures: run \`node ${copyAt(p)}scripts/install.mjs\`, then \`node ${copyAt(p)}scripts/steps.mjs\` again.`;
    const head = readProject(p.root), list = listed(config, file) ?? { keys: new Set(), problems: [] };
    const wrong = [...head.problems, ...(({ problems, pins, sources }) => [...problems, ...[...pins, ...sources].map(([, problem]) => problem)])(toolsCheck(head, list, kitHooks(undefined, coreOf(p.manifest)), file))];
    if (own.length && !beside) wrong.push(`the workflow that runs the licence check, ${own.join(", ")}, runs \`node ${copyAt(p)}scripts/agent-tools.mjs ${file}\` beside it, as the core's \`licences.yml\` does`);
    return wrong.length ? `List under "agentTools" in \`${file}\` every plug-in, tool server, skill and hook the project configures for its agents beyond the starter kit's hooks, each as { "kind", "name", "publisher", "version" }, a plug-in or tool server at one exact version, the one its configuration pins where it can pin one, or take out what nobody meant to configure; and see that its check runs: ${wrong.join("; ")}` : null;
  } };
