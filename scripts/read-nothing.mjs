// Which of the core's checks that read a project's code found nothing there they could read (#459, point 2): the shape
// check (shape.mjs), where its "code" names no file of a language its readers know (shape-readers.mjs, LANGUAGES); and
// the strength of the tests (strength.mjs), where the manifest names no mutation tool, or `none`. Each comes with the
// rules it holds, as holders.json says (one fact, one place), so that a report can say those rules are held by nothing
// there: a check that passes on nothing makes its rule look held. A check that holds no rule is not named. It fails
// nothing (AGENTS.md of the core, "Nothing locks a project"); the sync's report (steps.mjs) and a project's state
// report (state-report.mjs) say it. Reads only; Node's own modules and git.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { copyOf } from "./core-path.mjs";
import { holders } from "./holders.mjs";
import { leftOut } from "./reading.mjs";
import { ROOT } from "./rules.mjs";
import { LANGUAGES, isCode } from "./shape-readers.mjs";
import { parseConfig, where } from "./shape.mjs";
import { toolOf } from "./strength.mjs";

// The rules each of the core's scripts holds, by its path under scripts/, as holders.json names them: those of the
// modules a project takes alone (`out`, the names of those its manifest leaves out; the floor is never left out).
function rulesHeldBy(out) {
  const h = holders(ROOT), by = new Map();
  const taken = new Set(h.rules.filter(r => r.file.startsWith("floor/") || !out.has(path.posix.basename(r.file))).map(r => r.key));
  for (const [key, list] of h.by) if (taken.has(key)) for (const x of list) if (x.kind === "check") by.set(x.by, [...(by.get(x.by) ?? []), key]);
  return by;
}

// Each check that read nothing in the project at `root` (its manifest's text `manifest`, a file read by `read`, null
// where there is none): [{ check, holds, why }], `check` the script as the project calls it (by its copy's path, as the
// manifest names it), `holds` the rules it holds.
export function readNothing(root, manifest, read) {
  const found = [], at = where(manifest), text = read(at);
  let code = null;
  try {
    const config = text === null ? null : parseConfig(text, at);
    const listed = config ? execFileSync("git", ["ls-files", "-z", "--", ...config.code], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean) : [];
    code = listed.filter(isCode).length;
  } catch { /* (a config the check cannot read is the sync's step to mend, not a check that read nothing) */ }
  if (code === 0) found.push({ script: "scripts/shape.mjs", why: `\`${at}\` names under "code" no file the check's readers know (${LANGUAGES.join(", ")})` });
  const tool = toolOf(manifest);
  if (tool === null || tool.none !== undefined) found.push({ script: "scripts/strength.mjs", why: tool === null ? "the manifest names no *mutation tool*" : "the manifest's *mutation tool* is `none`" });
  if (!found.length) return [];
  const held = rulesHeldBy(leftOut(manifest));
  return found.map(f => ({ check: `${copyOf(root)}${f.script}`, holds: held.get(f.script) ?? [], why: f.why })).filter(f => f.holds.length);
}

// The lines a report gives of them, or none where every such check read something; `copy`, the path of the core's copy.
export const saidOf = (found, copy = copyOf()) => (found.length ? [
  `Checks that read nothing here (\`${copy}scripts/read-nothing.mjs\`): each passes on nothing, so the rules it holds are held by nothing here; it fails nothing, and a project in a language its readers do not know reports it to the core (\`${copy}README.md\`, "Reporting to the core").`,
  ...found.map(f => `- \`${f.check}\`: ${f.why}. It holds ${f.holds.length === 1 ? "the rule" : `${f.holds.length} rules`}: ${f.holds.map(k => `\`${k}\``).join("; ")}.`),
] : []);
