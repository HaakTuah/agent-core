// The project's rule files, so the list stands in one place: those floor rule 3 names (`AGENTS.md`, `CLAUDE.md`,
// `SECURITY.md` and the core manifest, where they exist), and those its SECURITY.md adds in rule 3 (its "the rule
// files:" line, ended by ";"). The copies and pointer checks (copies.mjs, pointers.mjs) read them. With `{ tools: true }`
// it adds the files an agent tool takes its instructions from (floor rule 3; tasks/tools.md): GEMINI.md, the entry
// files the starter kit writes for Kiro and Antigravity (ENTRY_FILES, which entry-files.mjs beside this file reads), and
// every file git tracks under a tool's folders of instructions (FOLDERS). The code-review wait and the state report read
// those; the copies and pointer checks do not yet, since a project may hold such files from before the core read them,
// and a check that reads more keeps a baseline first (AGENTS.md of the core, "Nothing locks a project"; #405). Run from
// the project's root. Node's own modules and git only. `read` gives a file's text, or null where it is not there, and
// `list` the files git tracks under a folder: by default the work tree's, and the copies check passes a `read` that
// reads the base's commit, to hold the base's list.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
// Each agent tool's entry file, as the starter kit writes it (tasks/tools.md, "One door in").
export const ENTRY_FILES = Object.freeze({ claude: "CLAUDE.md", kiro: ".kiro/steering/core.md", antigravity: ".agents/rules/core.md" });
// The folders a tool takes its instructions from (floor rule 3; tools/kiro.md and antigravity.md): every file in them.
export const FOLDERS = Object.freeze([".kiro/steering", ".kiro/agents", ".agents/rules", ".agent/rules"]);
const tracked = dir => { try { return execFileSync("git", ["ls-files", "-z", "--", dir], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean); } catch { return []; } };
export const FLOOR = Object.freeze(["AGENTS.md", "CLAUDE.md", "SECURITY.md", "core-manifest.md"]);
export const TOOL_FILES = Object.freeze(["GEMINI.md", ...Object.values(ENTRY_FILES)]);
export function ruleFiles(read = f => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null), list = tracked, { tools = false } = {}) {
  const security = read("SECURITY.md");
  if (security === null) throw new Error('the project has no SECURITY.md yet, where the checks read its rule files. Mend: write it from the starter kit\'s template (core/setup/template/SECURITY.md.tmpl), its rule 3 with the line "**the rule files:** ...;"');
  const rule = /\*\*the rule files:\*\*([^;]*);/.exec(security);
  if (!rule) throw new Error('SECURITY.md, rule 3, has no "the rule files:" line, where the checks read the project\'s own. Mend: add to rule 3 the line "**the rule files:** `<each file>`, ...;" as the starter kit\'s template (core/setup/template/SECURITY.md.tmpl) writes it');
  const own = tools ? TOOL_FILES.filter(f => read(f) !== null).concat(FOLDERS.flatMap(d => list(d))) : [];
  return [...new Set(FLOOR.filter(f => read(f) !== null).concat(own, [...rule[1].matchAll(/`([^`]+)`/g)].map(m => m[1])))];
}
