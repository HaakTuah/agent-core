// The YAML reader of the core's scripts: the workflow's YAML as plain values, split out of workflow-run.mjs (#1056) so
// that a reader of either reads less. Used by the runner (workflow-run.mjs) and by the scripts that read a project's
// workflows (among them check.mjs, steps.mjs, checks.mjs, own-runs.mjs, workflows.mjs and pruning-read.mjs). Node's own
// modules, and the YAML package.
import { installed, loadSync, unreached } from "./packages.mjs";
import { LONGEST } from "./yaml-keys.mjs";

/** The workflow's YAML as plain values, read by the YAML package the core installs from its lock file (packages.mjs;
 *  #530): YAML 1.2's core schema, as GitHub reads a workflow (keys as written: `on` stays the string "on", and a key
 *  `__proto__` is the mapping's own). A key given twice, or more than one document, throws, as GitHub refuses either;
 *  a text with no value is an empty mapping; a text longer than LONGEST (yaml-keys.mjs) is never given to the package,
 *  whose parser builds a token for each mark before anything of the core's runs (#864). Where the package is not
 *  installed, it throws, saying so. */
export function parseYaml(text) {
  // (where the package is not installed it throws, never stops the process, so a reader that asks, as the steps do,
  // reports the file as not read and goes on)
  if (!installed("yaml")) throw new Error("the check did not run: the package yaml is not installed beside the core's copy, so no YAML can be read. Mend: run the core's scripts/install.mjs (in a project, node core/scripts/install.mjs), then run this again");
  if (String(text).length > LONGEST) throw new Error(`the file is longer than ${LONGEST} characters, past what this reader reads, so it is not given to the YAML package. Mend: cut the file to under ${LONGEST} characters, the steps it repeats moved to a script or a workflow of their own`);
  const { parse } = loadSync("yaml"); // (loaded where it is used: no import of this file needs it)
  // (an error throws, for the caller to say; a warning prints nothing, since it would print the workflow's own line)
  return parse(text, { schema: "core", uniqueKeys: true, logLevel: "error" }) ?? {};
}

// The warning that a check did not run `what` for want of a package of the core's, with its mend: the registry not
// answering, or, in a project's job that never installed (`copy`, the core's folder there), the guarded install step
// (#654, point 4; #1079). A warning only: what reads it decides nothing ("Nothing locks a project" in AGENTS.md).
export function didNotRun(what, name, copy) {
  return unreached(name) ? `::warning::${what}: the package ${name} could not be installed, the registry not answering. Mend: run this job again before the pull request merges; if it fails again, file it as a fault`
    : `::warning::${what}: the package ${name} is not installed beside the core's copy. Mend: in a pull request of its own, add the step \`if [ -f ${copy}scripts/install.mjs ]; then node ${copy}scripts/install.mjs; fi\` to this job before the step that runs this check`;
}
