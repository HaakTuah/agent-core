// The helper hook ("Pass both model and effort" in modules/claude.md), for Claude Code in every project that takes the
// core: before a helper starts through the Agent tool (once named Task), it refuses a call that names no model or no
// effort, or the effort max, and says what to pass. A left-out effort falls to the app's default, which may be higher,
// and a left-out model to the caller's own: both are spent without anyone having chosen them. Two kinds of call are
// let through: a fork, which runs on its caller's model and effort whatever the call says, and a helper of a type the
// project defines itself, since a model named in the call would overrule its definition's. A project keeps each
// definition as .claude/agents/<name>.md, the file named as its `name:` line says, holding its model and its effort:
// the hook looks only whether that file is there, and what it holds is the review's of the PR that changes it.
// It never traps a session: the same call made again right after a refusal goes on (as work-saved.sh lets a second
// stop through), so a caller that cannot pass a field (an older Claude Code, a model fixed by a setting, a type
// defined elsewhere) loses one call and no more; and whatever it cannot read it lets through. It holds a habit, not a
// floor rule. It judges nothing else: which model and effort fit which role stays with the table in modules/claude.md.
// A helper started another way (a workflow script's own agents, a skill that forks, a session started from a shell)
// never passes this hook.
// It reads Claude Code's own JSON for a hook on stdin and looks whether that one file is there; of a refused call it
// keeps a mark in the temp folder, named by the session and a hash of the call, with nothing in it. Exit 0 lets the
// call go on; exit 2 refuses it, the reason on stderr, which Claude Code shows the caller. Claude Code passes an effort
// on a helper's call from 2.1.292 on. Run by a PreToolUse hook in .claude/settings.json with the matcher "Agent|Task",
// from the copy merged into main (README.md, "How a project takes the core", point 5); its command is COMMAND below,
// which the test runs whole. Node's own modules.
//
//   node core/scripts/helper-call.mjs --command     prints the hook's command, to copy into .claude/settings.json
//   echo '{"session_id":"s1","tool_name":"Agent","tool_input":{"model":"sonnet","effort":"medium"}}' | node core/scripts/helper-call.mjs
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// The hook's command, one line: main's copy of this script, given to node as text; where main holds none yet, or there
// is no repository, the call goes on (as with work-saved.sh).
export const COMMAND = `bash -c 'f=$(git -C "\${CLAUDE_PROJECT_DIR:-.}" --no-replace-objects show refs/remotes/origin/main:core/scripts/helper-call.mjs 2>/dev/null) || exit 0; node --input-type=module -e "$f"'`;

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
  const again = "Where the tool takes no such field here, the same call made again goes on.";
  if (lacks.length) return `This helper's call names no ${lacks.join(" and no ")}: pass both, by the table in the core's modules/claude.md ("Pass both model and effort"). ${again}`;
  if (call.effort.trim().toLowerCase() === "max") return `This helper's call asks for the effort max: never max, and above high only for escalation (the core's modules/claude.md).`;
  return "";
}

// Whether this same call was refused just before in this session (then its mark is taken away and it goes on), noting
// the refusal where it was not. A session the hook cannot name is never held, since nothing could let it through again.
export function refusedBefore(input, dir = os.tmpdir()) {
  const session = input?.session_id;
  if (typeof session !== "string" || !/^[A-Za-z0-9_-]{1,100}$/u.test(session)) return true;
  const call = createHash("sha256").update(JSON.stringify(input.tool_input)).digest("hex").slice(0, 32);
  const mark = path.join(dir, `helper-call-${session}-${call}`);
  try { fs.unlinkSync(mark); return true; } catch { /* no mark: the first refusal */ }
  try { fs.writeFileSync(mark, "", { flag: "wx" }); } catch { return true; } // no mark can be kept: never hold the call
  return false;
}

// Run as a program (also when node is given this text itself, with no file: the hook runs main's copy that way).
if (!process.argv[1] || import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--command") { console.log(COMMAND); process.exit(0); }
  let why = "";
  try {
    const input = JSON.parse(fs.readFileSync(0, "utf8")), project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    why = refusal(input, type => defines(project, type));
    if (why && refusedBefore(input)) why = "";
  } catch { /* not the JSON a hook is given: let it through */ }
  if (why) { console.error(why); process.exit(2); }
}
