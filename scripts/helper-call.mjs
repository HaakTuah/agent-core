// The helper hook ("Pass both model and effort" in modules/claude.md), for Claude Code in every project that takes the
// core: before a helper starts (the Agent tool, once named Task), it refuses a call that names no model or no effort,
// or the effort max, and says what to pass. A left-out effort falls to the app's default, which may be higher, and a
// left-out model to the caller's own: both are spent without anyone having chosen them. Two kinds of call are let
// through: a fork, which runs on its caller's model and effort whatever the call says, and a helper of a type the
// project defines itself (a file .claude/agents/<type>.md), whose definition holds its model and effort, which a model
// named in the call would overrule. It judges nothing else: which model and effort fit which role stays with the table
// in modules/claude.md, and what a definition holds with the review of the PR that changes it.
// It reads Claude Code's own JSON for a hook on stdin, looks whether that one file is there, and nothing else;
// whatever it cannot read it lets through, since it holds a habit, not a floor rule, and a hook that stops every
// helper on a format it does not know costs more than the habit. Exit 0 lets the call go on; exit 2 refuses it, the reason on stderr, which Claude Code shows the caller.
// Claude Code passes an effort on a helper's call from 2.1.292 on. Run by a PreToolUse hook in .claude/settings.json,
// from the copy merged into main (README.md, "How a project takes the core", point 5). Node's own modules.
//
//   echo '{"tool_name":"Agent","tool_input":{"model":"sonnet","effort":"medium"}}' | node core/scripts/helper-call.mjs
//
// The hook's command, under "PreToolUse" with the matcher "Agent|Task" (as work-saved.sh, it lets the call through
// where main holds no copy yet):
//   bash -c 'f=$(git -C "${CLAUDE_PROJECT_DIR:-.}" --no-replace-objects show
//     refs/remotes/origin/main:core/scripts/helper-call.mjs 2>/dev/null) || exit 0; node --input-type=module -e "$f"'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Whether the project defines this type of helper itself: a file of its name among the project's agents. A name that
// is no plain name (a path, a plugin's type) is none of the project's.
export const defines = (project, type) => typeof type === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(type) &&
  fs.existsSync(path.join(project, ".claude", "agents", `${type}.md`));

// Why the call is refused, or "" where it goes on. own(type): whether the project defines that type.
export function refusal(input, own = () => false) {
  const call = input?.tool_input;
  if (!["Agent", "Task"].includes(input?.tool_name) || call === null || typeof call !== "object") return "";
  if (call.subagent_type === "fork" || own(call.subagent_type)) return "";
  const given = key => typeof call[key] === "string" && call[key].trim() !== "";
  const lacks = ["model", "effort"].filter(key => !given(key));
  if (lacks.length) return `This helper's call names no ${lacks.join(" and no ")}: pass both, by the table in the core's modules/claude.md ("Pass both model and effort").`;
  if (call.effort.trim().toLowerCase() === "max") return `This helper's call asks for the effort max: never max, and above high only for escalation (the core's modules/claude.md).`;
  return "";
}

// Run as a program (also when node is given this text itself, with no file: the hook runs main's copy that way).
if (!process.argv[1] || import.meta.url === pathToFileURL(process.argv[1]).href) {
  let why = "";
  try {
    const input = JSON.parse(fs.readFileSync(0, "utf8")), project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    why = refusal(input, type => defines(project, type));
  } catch { /* not the JSON a hook is given: let it through */ }
  if (why) { console.error(why); process.exit(2); }
}
