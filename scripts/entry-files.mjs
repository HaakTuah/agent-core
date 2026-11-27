// One door in (tasks/tools.md; core archive 232; #249): the files every session reads at the start of every task are
// the ones the project's AGENTS.md names on its `@` lines, the one list; each agent tool's entry file that the starter
// kit writes, where the project holds it, pulls in every one of them in that tool's own form:
//   CLAUDE.md                 Claude Code: `@<path>`, from the root; `@AGENTS.md` pulls in all AGENTS.md names
//   .kiro/steering/core.md    Kiro: `#[[file:<path>]]`, from the root, a whole file (one with a line range counts for none)
//   .agents/rules/core.md     Antigravity: `@[<name>](<path>)`, from the rule's own folder
// It fails an entry file that pulls in less than AGENTS.md names, saying the line to add, and one its tool would not
// load at every session's start by its front matter (Kiro's `inclusion`, `always` where it is left out; Antigravity's
// `trigger: always_on`). A line inside a fenced block or an HTML comment pulls in nothing. A tool that reads AGENTS.md
// alone (Codex) has no entry file, and an entry file the project does not hold is not looked for.
//
// Nothing locks a project (core-changes/projects.md of the core): with ENTRY_BASE set to the pull request's base (as
// the copies workflow sets it), what the base already lacked is noted and fails nothing, so only what the pull request
// itself leaves out fails; with no base, as on a push to main, everything is noted and nothing fails, so what a pull
// request was let through with never turns main red. In the core's own repository (`--core`) everything fails. Git and
// Node's own modules only.
//
//   node core/scripts/entry-files.mjs           from a project's root, as the copies workflow runs it
//   node scripts/entry-files.mjs --core         in the core's own repository
import fs from "node:fs";
import path from "node:path";
import { ownText } from "./core-path.mjs";
import { ENTRY_FILES, followLinks, placeAt, readAt } from "./rule-files.mjs";
import { asText, leadsOut } from "./guards.mjs";
import { guard } from "./mend.mjs";

export const AGENTS = "AGENTS.md";
// A file's front matter (the lines between a first line "---" and the next "---"), as { key: value }, or {} where none.
const front = text => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/u.exec(String(text));
  return Object.fromEntries((m?.[1] ?? "").split(/\r?\n/u).map(l => /^([A-Za-z_]+):[ \t]*(.*?)[ \t]*$/u.exec(l)).filter(Boolean).map(x => [x[1], x[2].replace(/^(["'])(.*)\1$/u, "$2")]));
};
// A file's text without its fenced blocks and HTML comments, which pull in nothing.
const live = text => String(text).replace(/<!--[\s\S]*?(?:-->|$)/gu, "").replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gmu, "");

// Each entry file: its tool, the paths it pulls in (each from the root), the line that pulls in one, and why its tool
// would not load it at every session's start, with the mend (null where it would).
export const ENTRY = [
  { file: ENTRY_FILES.claude, tool: "Claude Code", line: p => `@${p}`, pulls: text => [...live(text).matchAll(/^@(\S+)\s*$/gmu)].map(m => m[1]), off: () => null },
  { file: ENTRY_FILES.kiro, tool: "Kiro", line: p => `#[[file:${p}]]`, pulls: text => [...live(text).matchAll(/#\[\[file:([^\]:]+)\]\]/gu)].map(m => m[1].trim()), // (a line range pulls in part of a file, never the whole)
    off: text => { const v = front(text).inclusion; return v === undefined || v === "always" ? null : `its front matter's inclusion is ${JSON.stringify(v)}. Mend: set "inclusion: always" in its front matter`; } },
  { file: ENTRY_FILES.antigravity, tool: "Antigravity", line: p => `@[${path.posix.basename(p)}](${path.posix.relative(path.posix.dirname(ENTRY_FILES.antigravity), p)})`,
    pulls: text => [...live(text).matchAll(/@\[[^\]\n]*\]\(([^)\s]+)\)/gu)].map(m => path.posix.join(path.posix.dirname(ENTRY_FILES.antigravity), m[1])),
    off: text => (front(text).trigger === "always_on" ? null : `its front matter has no "trigger: always_on". Mend: open the file with the front matter ---, trigger: always_on, --- on three lines`) },
];

// The most bytes of an entry file or AGENTS.md read, here and at the base alike (SECURITY.md, the 1 MB of a tool's files).
const BOUND = 1 << 20;
// Whether anything stands at the path: a link that leads nowhere included, and a folder on its way that is a link
// leading nowhere or out of the project, behind which no check can see what stands.
const standsHere = file => {
  try { fs.lstatSync(file); return true; } catch { /* (then each folder on its way) */ }
  const parts = clean(file).split("/");
  return parts.slice(0, -1).some((_, i) => { const up = parts.slice(0, i + 1).join("/"); try { return fs.lstatSync(up).isSymbolicLink() && leadsOut(".", up); } catch { return false; } });
};

const clean = p => path.posix.normalize(String(p).replace(/\\/gu, "/")).replace(/^\.\//u, "");
// Whether each link on the file's way is one rule-files.mjs's placeAt follows at a commit (followLinks): written
// relative, and inside the tree as written, every link followed, at most 40; so the work tree and the base read a link alike.
const isLink = p => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };
const linkText = p => { try { return fs.readlinkSync(p); } catch { return null; } };
const asTheBaseReads = file => followLinks(clean(file), isLink, linkText) !== null;

// What each entry file the project holds lacks of AGENTS.md's list: [{ file, tool, missing: [path], line, off }], `off`
// why its tool would not load it at all (every file is then missing), or null.
// `read(file)` gives a file's text, or null where it is not there.
export function lacking(read) {
  const agents = read(AGENTS);
  if (agents === null) return [];
  const list = ENTRY[0].pulls(agents).map(clean);
  const out = [];
  for (const e of ENTRY) {
    const text = read(e.file);
    if (text === null) continue;
    const off = e.off(text);
    if (off) { out.push({ file: e.file, tool: e.tool, missing: [], line: e.line, off }); continue; }
    const pulled = new Set(e.pulls(text).map(clean));
    if (pulled.has(AGENTS) && e.file === ENTRY_FILES.claude) continue; // (Claude Code follows AGENTS.md's own @ lines)
    const missing = list.filter(p => !pulled.has(p));
    if (missing.length) out.push({ file: e.file, tool: e.tool, missing, line: e.line, off: null });
  }
  return out;
}

// The failures, each a line with its mend, and the notes: what `base` (a commit, or null) already lacked is a note.
export function verdict(head, base = null) {
  const was = new Set((base ? lacking(base) : []).flatMap(l => [...l.missing.map(p => `${l.file}\0${p}`), ...(l.off ? [`${l.file}\0off`] : [])]));
  const fails = [], notes = [];
  for (const l of lacking(head)) {
    if (!l.off) continue;
    const said = `${l.file} (${l.tool}'s entry file) is not loaded at a session's start: ${l.off}`;
    (was.has(`${l.file}\0off`) ? notes : fails).push(said);
  }
  for (const l of lacking(head)) for (const p of l.missing) {
    const said = `${l.file} (${l.tool}'s entry file) pulls in none of \`${p}\`, which ${AGENTS} names on an @ line, so a session of ${l.tool} would not read it at its start. Mend: add the line ${l.line(p)} to ${l.file}`;
    (was.has(`${l.file}\0${p}`) ? notes : fails).push(said);
  }
  return { fails, notes };
}

if (guard(import.meta.url)) {
  const core = process.argv.includes("--core"), base = core ? "" : process.env.ENTRY_BASE ?? "";
  // (the work tree's files as ownText reads them, a link inside the project followed, and the base's as readAt reads
  // its tree, each link inside it followed the same way, so that a file the base held as a link reads as its target)
  // (a file that stands here but that ownText refuses is one no check can read: it fails where the base read it or
  // held nothing there, as the pull request's own doing, and is noted where the base held it unread too)
  const unread = new Set(), place = base ? placeAt(base) : null, was = place ? readAt(base, place, { bound: BOUND }) : null;
  const here = file => { const text = asTheBaseReads(file) ? ownText(file, { bound: BOUND }) : null; if (text === null && standsHere(file)) unread.add(file); return text; };
  const read = verdict(here, was);
  for (const f of unread) {
    const said = `${f} stands here but is not read: it is no regular file of the project's own of at most 1 MB, so what it pulls in cannot be checked. Mend: make ${f} a regular file of the project's own, of at most 1 MB`;
    (core || (was && (was(f) !== null || !place.held(f))) ? read.fails : read.notes).push(said);
  }
  // (in a project with no base to read against, nothing is new: each is a note)
  const { fails, notes } = core || base ? read : { fails: [], notes: [...read.notes, ...read.fails] };
  for (const n of notes) console.log(asText(`note (it stood so before this pull request, so it fails nothing): ${n}`));
  for (const f of fails) console.error(asText(`FAIL: ${f}`));
  if (fails.length) process.exitCode = 1;
  else console.log(`each agent tool's entry file here pulls in every file ${AGENTS} names`);
}
