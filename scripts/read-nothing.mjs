// Which of the core's checks that read a project's code found nothing there they could read (#459, point 2): the shape
// check and the selection of tests (shape.mjs, select.mjs), where the shape check's "code" names no file of a language
// their readers know (JavaScript and TypeScript, C#, Python); and the strength of the tests (strength.mjs), where the
// manifest names no mutation tool, or `none`. Each comes with the rule files it holds, so that a report can say those
// rules are held by nothing there: a check that passes on nothing makes its rule look held. It fails nothing (AGENTS.md
// of the core, "Nothing locks a project"); the sync's report (steps.mjs) and a project's state report (state-report.mjs)
// say it. Reads only; Node's own modules and git.
import { execFileSync } from "node:child_process";
import { isCode } from "./shape-readers.mjs";
import { parseConfig, where } from "./shape.mjs";
import { toolOf } from "./strength.mjs";

// Each check that read nothing in the project at `root` (its manifest's text `manifest`, a file read by `read`, null
// where there is none): [{ check, holds, why }], `check` the script, `holds` the rule files whose rules it holds.
export function readNothing(root, manifest, read) {
  const out = [], at = where(manifest), text = read(at);
  let code = null;
  try {
    const config = text === null ? null : parseConfig(text, at);
    const listed = config ? execFileSync("git", ["ls-files", "-z", "--", ...config.code], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean) : [];
    code = listed.filter(isCode).length;
  } catch { /* (a config the check cannot read is the sync's step to mend, not a check that read nothing) */ }
  if (code === 0) {
    const why = `\`${at}\` names under "code" no file of JavaScript, TypeScript, C# or Python, the languages its readers know`;
    out.push({ check: "core/scripts/shape.mjs", holds: ["core/tasks/code-shape.md"], why }, { check: "core/scripts/select.mjs", holds: ["core/tasks/tests.md"], why });
  }
  const tool = toolOf(manifest);
  if (tool === null || tool.none !== undefined) out.push({ check: "core/scripts/strength.mjs", holds: ["core/tasks/code-shape.md"], why: tool === null ? "the manifest names no *mutation tool*" : "the manifest's *mutation tool* is `none`" });
  return out;
}

// The lines a report gives of them, or none where every such check read something.
export const saidOf = found => (found.length ? [
  "Checks that read nothing here (`core/scripts/read-nothing.mjs`): each passes on nothing, so the rules it holds are held by nothing here; it fails nothing, and a project in a language its readers do not know reports it to the core (`core/README.md`, \"Reporting to the core\").",
  ...found.map(f => `- \`${f.check}\`, holding rules of ${f.holds.map(h => `\`${h}\``).join(", ")}: ${f.why}.`),
] : []);
