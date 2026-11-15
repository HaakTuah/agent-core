// The project's rule files, so the list stands in one place: those floor rule 3 names (`AGENTS.md`, `CLAUDE.md`,
// `SECURITY.md` and the core manifest, where they exist), and those its SECURITY.md adds in rule 3 (its "the rule
// files:" line, ended by ";"). The copies and pointer checks (copies.mjs, pointers.mjs) read them. Run from the
// project's root. Node's own modules only.
import fs from "node:fs";
const FLOOR = ["AGENTS.md", "CLAUDE.md", "SECURITY.md", "core-manifest.md"];
export function ruleFiles() {
  if (!fs.existsSync("SECURITY.md")) throw new Error('the project has no SECURITY.md yet, where the checks read its rule files. Mend: write it from the starter kit\'s template (core/setup/template/SECURITY.md.tmpl), its rule 3 with the line "**the rule files:** ...;"');
  const rule = /\*\*the rule files:\*\*([^;]*);/.exec(fs.readFileSync("SECURITY.md", "utf8"));
  if (!rule) throw new Error('SECURITY.md, rule 3, has no "the rule files:" line, where the checks read the project\'s own. Mend: add to rule 3 the line "**the rule files:** `<each file>`, ...;" as the starter kit\'s template (core/setup/template/SECURITY.md.tmpl) writes it');
  return [...new Set(FLOOR.filter(f => fs.existsSync(f)).concat([...rule[1].matchAll(/`([^`]+)`/g)].map(m => m[1])))];
}
