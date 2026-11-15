// One door in (modules/tools.md; core archive 231; #249): the files every session reads at the start of every task are
// the ones the project's AGENTS.md names on its `@` lines, the one list; each agent tool's entry file that the starter
// kit writes, where the project holds it, pulls in every one of them in that tool's own form:
//   CLAUDE.md                 Claude Code: `@<path>`, from the root; `@AGENTS.md` pulls in all AGENTS.md names
//   .kiro/steering/core.md    Kiro: `#[[file:<path>]]`, from the root
//   .agents/rules/core.md     Antigravity: `@[<name>](<path>)`, from the rule's own folder
// It fails an entry file that pulls in less than AGENTS.md names, saying the line to add. A tool that reads AGENTS.md
// alone (Codex) has no entry file, and an entry file the project does not hold is not looked for.
//
// Nothing locks a project (AGENTS.md of the core): with ENTRY_BASE set to the pull request's base (as the copies
// workflow sets it), what the base already lacked is noted and fails nothing, so only what the pull request itself
// leaves out fails. In the core's own repository (`--core`) everything fails. Git and Node's own modules only.
//
//   node core/scripts/entry-files.mjs           from a project's root, as the copies workflow runs it
//   node scripts/entry-files.mjs --core         in the core's own repository
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ENTRY_FILES } from "./rule-files.mjs";
import { started } from "./started.mjs";

export const AGENTS = "AGENTS.md";
// Each entry file: its tool, the paths it pulls in (each from the root), and the line that pulls in one.
export const ENTRY = [
  { file: ENTRY_FILES.claude, tool: "Claude Code", line: p => `@${p}`, pulls: text => [...String(text).matchAll(/^@(\S+)\s*$/gmu)].map(m => m[1]) },
  { file: ENTRY_FILES.kiro, tool: "Kiro", line: p => `#[[file:${p}]]`, pulls: text => [...String(text).matchAll(/#\[\[file:([^\]:]+)(?::[^\]]*)?\]\]/gu)].map(m => m[1].trim()) },
  { file: ENTRY_FILES.antigravity, tool: "Antigravity", line: p => `@[${path.posix.basename(p)}](${path.posix.relative(path.posix.dirname(ENTRY_FILES.antigravity), p)})`,
    pulls: text => [...String(text).matchAll(/@\[[^\]\n]*\]\(([^)\s]+)\)/gu)].map(m => path.posix.join(path.posix.dirname(ENTRY_FILES.antigravity), m[1])) },
];

const clean = p => path.posix.normalize(String(p).replace(/\\/gu, "/")).replace(/^\.\//u, "");

// What each entry file the project holds lacks of AGENTS.md's list: [{ file, tool, missing: [path], line }].
// `read(file)` gives a file's text, or null where it is not there.
export function lacking(read) {
  const agents = read(AGENTS);
  if (agents === null) return [];
  const list = ENTRY[0].pulls(agents).map(clean);
  const out = [];
  for (const e of ENTRY) {
    const text = read(e.file);
    if (text === null) continue;
    const pulled = new Set(e.pulls(text).map(clean));
    if (pulled.has(AGENTS) && e.file === ENTRY_FILES.claude) continue; // (Claude Code follows AGENTS.md's own @ lines)
    const missing = list.filter(p => !pulled.has(p));
    if (missing.length) out.push({ file: e.file, tool: e.tool, missing, line: e.line });
  }
  return out;
}

// The failures, each a line with its mend, and the notes: what `base` (a commit, or null) already lacked is a note.
export function verdict(head, base = null) {
  const was = new Set((base ? lacking(base) : []).flatMap(l => l.missing.map(p => `${l.file}\0${p}`)));
  const fails = [], notes = [];
  for (const l of lacking(head)) for (const p of l.missing) {
    const said = `${l.file} (${l.tool}'s entry file) pulls in none of \`${p}\`, which ${AGENTS} names on an @ line, so a session of ${l.tool} would not read it at its start. Mend: add the line ${l.line(p)} to ${l.file}`;
    (was.has(`${l.file}\0${p}`) ? notes : fails).push(said);
  }
  return { fails, notes };
}

const fileAt = file => (fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file, "utf8") : null);
const gitAt = rev => file => { try { return execFileSync("git", ["show", `${rev}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };

if (started(import.meta.url)) {
  const core = process.argv.includes("--core"), base = core ? "" : process.env.ENTRY_BASE ?? "";
  const { fails, notes } = verdict(fileAt, base ? gitAt(base) : null);
  for (const n of notes) console.log(`note (it stood so before this pull request, so it fails nothing): ${n}`);
  for (const f of fails) console.error(`FAIL: ${f}`);
  if (fails.length) process.exitCode = 1;
  else console.log(`each agent tool's entry file here pulls in every file ${AGENTS} names`);
}
