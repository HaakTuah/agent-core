// One door in (tasks/tools.md; core archive 232; #249): the files every session reads at the start of every task are
// the ones the project's AGENTS.md names on its `@` lines, the one list; each agent tool's entry file that the starter
// kit writes, where the project holds it, pulls in every one of them in that tool's own form:
//   CLAUDE.md                 Claude Code: `@<path>`, from the root; `@AGENTS.md` pulls in all AGENTS.md names
//   .kiro/steering/core.md    Kiro: `#[[file:<path>]]`, from the root, a whole file (one with a line range counts for none)
//   .agents/rules/core.md     Antigravity: `@[<name>](<path>)`, from the rule's own folder
// It fails an entry file that pulls in less than AGENTS.md names, saying the line to add, and one its tool would not
// load at every session's start by its front matter (Kiro's `inclusion`, `always` where it is left out; Antigravity's
// `trigger: always_on`). A line inside a fenced block or an HTML comment pulls in nothing. A tool that reads AGENTS.md
// alone (Codex) has no entry file, and an entry file the project does not hold is not looked for. It fails too a tool's
// folder of instructions, or a tool's file, that a submodule holds (rule-files.mjs, inSubmodule), where no check reads.
//
// Nothing locks a project (core-changes/projects.md of the core): with ENTRY_BASE set to the pull request's base (as
// the copies workflow sets it), what the base already lacked is noted and fails nothing, so only what the pull request
// itself leaves out fails; with no base, as on a push to main, everything is noted and nothing fails, so what a pull
// request was let through with never turns main red. In the core's own repository (`--core`) everything fails. Git and
// Node's own modules only.
//
//   node core/scripts/entry-files.mjs           from a project's root, as the copies workflow runs it
//   node scripts/entry-files.mjs --core         in the core's own repository
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ownText } from "./core-path.mjs";
import { ENTRY_FILES, FOLDERS, TOOL_FILES, followLinks, inSubmodule as heldBySubmodule, isFolderHere, isLinkHere, linkTextHere, placeAt, readAt } from "./rule-files.mjs";
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
// Whether anything stands at the path: a link that leads nowhere included, a folder on its way that is a link
// leading nowhere or out of the project, and a submodule at the path or on its way, behind which no check can see what
// stands.
const standsHere = file => {
  if (throughSubmodule(file)) return true;
  try { fs.lstatSync(file); return true; } catch { /* (then each folder on its way) */ }
  const parts = clean(file).split("/");
  return parts.slice(0, -1).some((_, i) => { const up = parts.slice(0, i + 1).join("/"); try { return fs.lstatSync(up).isSymbolicLink() && leadsOut(".", up); } catch { return false; } });
};

const clean = p => path.posix.normalize(String(p).replace(/\\/gu, "/")).replace(/^\.\//u, "");
// (the submodules git's index holds: a tool reads what is checked out there, another repository's files, which the
// base's tree holds no text of; none where git cannot be read)
let gitlinks = null;
const inSubmodule = file => {
  if (!gitlinks) {
    gitlinks = new Set();
    try { for (const e of execFileSync("git", ["ls-files", "-s", "-z"], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }).split("\0")) { const m = /^160000 \S+ \d+\t([\s\S]+)$/u.exec(e); if (m) gitlinks.add(m[1]); } } catch { /* (none) */ }
  }
  const parts = clean(file).split("/");
  return parts.some((_, i) => gitlinks.has(parts.slice(0, i + 1).join("/")));
};
// (whether the path as written, a path its links' walk passes, or where it ends lies in a submodule: a link into one
// leads a tool to another repository's files as surely as the path itself)
const throughSubmodule = file => {
  let passed = inSubmodule(file);
  const at = followLinks(clean(file), p => { passed ||= inSubmodule(p); return isLinkHere(p); }, linkTextHere, isFolderHere);
  return passed || (at !== null && inSubmodule(at));
};
// (each agent tool's folder of instructions, and each of its files that is no entry file, that a submodule here holds,
// as rule-files.mjs's inSubmodule reads it: the checks list none of what a tool reads there)
const toolsInSubmodule = () => { inSubmodule(""); return [...FOLDERS, ...TOOL_FILES.filter(f => !ENTRY.some(e => e.file === f))].filter(f => heldBySubmodule(f, isLinkHere, linkTextHere, isFolderHere, gitlinks)); };
// Whether each link on the file's way is one rule-files.mjs's placeAt follows at a commit (followLinks): written
// relative, and inside the tree as written, every link followed, at most 40; so the work tree and the base read a link
// alike where a `..` is read as Linux and macOS read it (followLinks says what holds on Windows). (isFolderHere reads a
// part with lstat, which follows no link: it is asked only of a path whose every part the walk found to be no link, so
// on Linux and macOS it reads as the system does, and no case there reads otherwise.)
const asTheBaseReads = file => followLinks(clean(file), isLinkHere, linkTextHere, isFolderHere) !== null;
// (the links on the file's way, the file itself left out, as the walk meets them: those a failure names to mend)
const wayHere = file => { const passed = []; followLinks(clean(file), isLinkHere, linkTextHere, isFolderHere, passed); return passed.filter(p => p !== clean(file)); };

// What each entry file the project holds lacks of AGENTS.md's list: [{ file, tool, missing: [path], line, off }], `off`
// why its tool would not load it at all (every file is then missing), or null.
// `read(file)` gives a file's text, or null where it is not there. Each entry file is read though AGENTS.md is not, so
// that a reader that notes what stands unread meets each.
export function lacking(read) {
  const agents = read(AGENTS), texts = ENTRY.map(e => read(e.file));
  if (agents === null) return [];
  const list = ENTRY[0].pulls(agents).map(clean);
  const out = [];
  for (const [i, e] of ENTRY.entries()) {
    const text = texts[i];
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
// Where `base` carries `held` (placeAt's), an entry file or AGENTS.md it held but did not read, past the bound or
// behind a link it does not follow, may have lacked anything, so what the head lacks there is a note too.
export function verdict(head, base = null) {
  const was = new Set((base ? lacking(base) : []).flatMap(l => [...l.missing.map(p => `${l.file}\0${p}`), ...(l.off ? [`${l.file}\0off`] : [])]));
  // (each file's reading at the base made once, however many imports the head lacks: each is a call to git)
  const seen = new Map(), unread = f => { if (!seen.has(f)) seen.set(f, Boolean(base?.held?.(f)) && base(f) === null); return seen.get(f); }, old = (file, key) => was.has(`${file}\0${key}`) || unread(AGENTS) || unread(file);
  const fails = [], notes = [];
  for (const l of lacking(head)) {
    if (!l.off) continue;
    const said = `${l.file} (${l.tool}'s entry file) is not loaded at a session's start: ${l.off}`;
    (old(l.file, "off") ? notes : fails).push(said);
  }
  for (const l of lacking(head)) for (const p of l.missing) {
    const said = `${l.file} (${l.tool}'s entry file) pulls in none of \`${p}\`, which ${AGENTS} names on an @ line, so a session of ${l.tool} would not read it at its start. Mend: add the line ${l.line(p)} to ${l.file}`;
    (old(l.file, p) ? notes : fails).push(said);
  }
  return { fails, notes };
}

if (guard(import.meta.url)) {
  const core = process.argv.includes("--core"), base = core ? "" : process.env.ENTRY_BASE ?? "";
  // (the work tree's files as ownText reads them, a link inside the project followed, and the base's as readAt reads
  // its tree, each link inside it followed the same way, so that a file the base held as a link reads as its target)
  // (a file that stands here but that ownText refuses, that lies in a submodule or is reached through a link into one, or that a link on its way written from
  // a root or climbing above the project's root reaches, is one no check can read: it fails where the base read it or held nothing there, as
  // the pull request's own doing, and is noted where the base held it unread too)
  const unread = new Set(), place = base ? placeAt(base) : null, was = place ? Object.assign(readAt(base, place, { bound: BOUND }), { held: place.held }) : null;
  const here = file => { const text = !throughSubmodule(file) && asTheBaseReads(file) ? ownText(file, { bound: BOUND }) : null; if (text === null && standsHere(file)) unread.add(file); return text; };
  const read = verdict(here, was);
  for (const f of unread) {
    // (the links on its way are named only where they are why it is not read, and only those that are: a link no read
    // follows, one into a submodule, or one the system does not follow as the walk reads it, such as one whose text holds
    // a backslash on Linux or macOS or one that leads nowhere; a link to a folder inside the project on the way is not)
    const why = p => throughSubmodule(p) || !asTheBaseReads(p) || leadsOut(".", p);
    const way = why(f) ? wayHere(f).filter(why).map(p => `\`${p}\``).join(", then ") : "";
    const said = `${f} stands here but is not read${way ? `, reached through the link ${way}` : ""}: it is no regular file of the project's own of at most 1 MB, outside any submodule, reached by no link written from a root or climbing above the project's root, so what it pulls in cannot be checked. Mend: make ${f} a regular file of the project's own, of at most 1 MB, with no submodule and no such link on its way${way ? ` (here ${way})` : ""}`;
    (core || (was && (was(f) !== null || !place.held(f))) ? read.fails : read.notes).push(said);
  }
  // (a tool's folder or file a submodule holds fails, where the base's submodules held none of it, as the pull request's
  // own doing, and is noted where they did)
  for (const f of toolsInSubmodule()) {
    const said = `${f}, where an agent tool takes its instructions from, lies in a submodule, or holds one, here or through a link, so no check can read what the tool reads there. Mend: keep the tool's files in the project's own tree, with no submodule at ${f}, inside it or on its way`;
    (core || (place && !place.submodule(f)) ? read.fails : read.notes).push(said);
  }
  // (in a project with no base to read against, nothing is new: each is a note)
  const { fails, notes } = core || base ? read : { fails: [], notes: [...read.notes, ...read.fails] };
  for (const n of notes) console.log(asText(`note (it stood so before this pull request, so it fails nothing): ${n}`));
  for (const f of fails) console.error(asText(`FAIL: ${f}`));
  if (fails.length) process.exitCode = 1;
  else console.log(`each agent tool's entry file here pulls in every file ${AGENTS} names`);
}
