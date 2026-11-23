// The files and the pointers of what a project holds twice (twice.mjs, beside this file, which reads the rest, gives
// the project `p` it reads and makes the corrections; tasks/cleaning.md, "The reading asks what a project holds
// twice"; #1087): the files outside the copy equal byte for byte to one of the core's, which of them may go, and the
// pointers in the project's own text. It reads and writes nothing itself but what git's object ids ask. Node's own
// modules and git.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { whole } from "./core-owned.mjs";
import { inBare } from "./releases.mjs";
import { ownText } from "./twice-text.mjs";

export const SKIP = /^(?:reports|archive|words)\//u;
const NOT_COMPARED = /(?:^|\/)(?:LICEN[CS]E|NOTICE|COPYING)[^/]*$|(?:^|\/)\.git(?:ignore|attributes|keep)$/iu;
const SMALLEST = 100; // (a file of fewer bytes, an empty one above all, matches by chance)

// A blob's id as git names it, so that a file is matched to one of an earlier copy's by its id alone.
export const blobId = buf => crypto.createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");

// Each file of the copy and of the earlier copies by its blob's id: the paths of the core's that hold it.
function coreBlobs(p) {
  const byId = new Map();
  const add = (id, file, at) => { if (!byId.has(id)) byId.set(id, []); byId.get(id).push({ file, at }); };
  for (const f of p.copyFiles) if (!f.startsWith("setup/template/")) add(blobId(fs.readFileSync(path.join(p.copyDir, f))), f, "the copy");
  for (const sha of p.earlier) {
    for (const e of listTree(p.bare, sha)) if (!e.file.startsWith("setup/template/")) add(e.id, e.file, sha.slice(0, 7));
  }
  return byId;
}
export const listTree = (bare, sha) => inBare(bare, ["ls-tree", "-r", "-z", sha], { maxBuffer: 1 << 28 }).split("\0").flatMap(l => { const m = /^\d+ blob ([0-9a-f]{40})\t(.+)$/su.exec(l); return m ? [{ id: m[1], file: m[2] }] : []; });

// The files outside the copy equal byte for byte to one of the core's: { file, core, at, to }, `to` the copy's file
// that stands for it, or null where none does, more than one does, or what uses the file cannot all be read (below).
export function filesFound(p) {
  const byId = coreBlobs(p), found = [];
  for (const f of p.outside) {
    const hit = compared(p, f) && equalTo(p, byId, f);
    if (hit) found.push(hit);
  }
  return noneLeft(p, found);
}
const compared = (p, f) => !whole(f) && !NOT_COMPARED.test(f) && !SKIP.test(f) && !linked(p, f) && p.own.read(f, true) !== null;
// A link is never read as the project's own file nor written through: what it leads to may be the copy's.
const linked = (p, f) => { try { return fs.lstatSync(path.join(p.root, f)).isSymbolicLink(); } catch { return true; } };
// Only Markdown goes: what else a project holds (code, a manifest, a config) may be run, or found by a tool where it
// stands, in ways no pointer shows; and of Markdown, not a name a tool looks for in its folder, nor one in a dot folder.
const MARKDOWN = /\.md$/iu;
const BY_PLACE = /(?:^|\/)(?:README|index|AGENTS|CLAUDE|GEMINI|REVIEW|SECURITY|CONTRIBUTING|CODE_OF_CONDUCT|CHANGELOG|SUPPORT)\.md$|(?:^|\/)\./iu;
// The file `f` as a finding where it is equal to one of the core's, else null.
function equalTo(p, byId, f) {
  let buf;
  try { buf = fs.readFileSync(path.join(p.root, f)); } catch { return null; }
  const hits = buf.length < SMALLEST ? null : byId.get(blobId(buf));
  if (!hits) return null;
  const to = [...new Set(hits.map(h => h.at === "the copy" ? h.file : p.moved.has(h.file) ? p.moved.get(h.file) : p.copySet.has(h.file) ? h.file : null))];
  const found = { file: f, core: hits[0].file, at: hits[0].at, to: to.length === 1 && to[0] ? `${p.copy}${to[0]}` : null };
  if (hits.some(h => FLOOR.test(h.file)) || p.safety.has(f)) Object.assign(found, { to: null, why: "it is the floor's text or a safety rule, which goes only on its owner's word" });
  else if (found.to && !MARKDOWN.test(f)) Object.assign(found, { to: null, why: "it is no Markdown, which may be run or found where it stands in ways no pointer shows" });
  else if (found.to && BY_PLACE.test(f)) Object.assign(found, { to: null, why: "a tool may look for it where it stands" });
  return found;
}
// The floor's text (security.md, its topics, the threat model) and the files the project's own AGENTS.md calls safety
// rules, in backticks on a line that says so: never taken out by a script (tasks/cleaning.md).
const FLOOR = /^(?:floor\/|SECURITY\.md$)/u;
export const safetyOf = own => new Set((ownText(own, "AGENTS.md") ?? "").split("\n").filter(l => /safety/iu.test(l)).flatMap(l => [...l.matchAll(/`([^`\s]+)`/gu)].map(m => m[1].replace(/^\.\//u, ""))));
// A file goes only where every pointer to it can be moved: none is left in a file the script does not write (one of
// the core's the project holds whole, a link), none in a text that still names its path once the pointers it moves
// are moved (a form it does not read, such as a path further down another's, or one read from the caller's folder), none
// as a link's target that, decoded, still leads to it, and no link leads to it or a folder of it.
function noneLeft(p, found) {
  const texts = textFiles(p), fixed = texts.map(t => t.file), kept = p.outside.filter(f => !fixed.includes(f) && !SKIP.test(f) && !found.some(x => x.file === f));
  const ends = linkEnds(p);
  for (const x of found.filter(x => x.to)) {
    const end = ends.find(e => e.to === "" || x.file === e.to || x.file.startsWith(`${e.to}/`));
    if (end) { Object.assign(x, { to: null, why: `the link ${end.file} leads to it, which the script does not move` }); continue; }
    const away = linksOut(p, x);
    if (away) { Object.assign(x, { to: null, why: `its link to ${away} leads elsewhere from the copy's file` }); continue; }
    const esc = x.file.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&"), left = new RegExp(`(?<![A-Za-z0-9_-]|${p.copy.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")})${esc}(?![A-Za-z0-9_/-]|\\.[A-Za-z0-9])`, "u");
    const has = exists(p), moved = t => t.text.replace(pointersTo(t.file, x.file, has), pointerTo(t.file, x.file, x.to));
    const at = kept.find(f => pointersTo(f, x.file).test(p.own.read(f, true) ?? ""))
      ?? texts.find(t => t.file !== x.file && left.test(moved(t)))?.file
      ?? texts.find(t => WORKFLOW.test(t.file) && byName(x.file).test(moved(t)))?.file
      ?? texts.find(t => t.file !== x.file && linkTargets(moved(t)).some(l => leadsFrom(t.file, l) === x.file))?.file;
    if (at) Object.assign(x, { to: null, why: `${at} names it in a form the script cannot move, or is a file it does not write` });
  }
  return found;
}

// The first relative target of a link in the file `x` that, read from the copy's file `x.to`, leads to other bytes than
// read from `x.file` (or to nothing, or to a folder): a Markdown link, a reference's definition, an HTML href or src.
// One with a scheme, from the root (/) or to an anchor alone reads the same from both.
function linksOut(p, x) {
  const bytes = f => { try { return fs.readFileSync(path.join(p.root, f)); } catch { return null; } };
  for (const t of linkTargets(p.own.read(x.file, true) ?? "")) {
    const [a, b] = [x.file, x.to].map(f => leadsFrom(f, t)), [ba, bb] = [a, b].map(f => f && bytes(f));
    if (a !== null && (!ba || !bb || !ba.equals(bb))) return t;
  }
  return null;
}
// The targets of a text's links: a Markdown link, a reference's definition, an HTML href or src.
const linkTargets = text => [...text.matchAll(/\]\(\s*<?([^)\s>]+)|^\s{0,3}\[[^\]]+\]:\s*<?([^\s>]+)|\b(?:href|src)\s*=\s*["']([^"']+)/gmu)].map(m => m[1] ?? m[2] ?? m[3]);
// Where the target `t` of a link in the file `from` leads, as a path from the root, decoded as a browser decodes it (a
// sequence that does not decode kept as it stands); null where it has a scheme, starts at the root (/) or is an anchor.
function leadsFrom(from, t) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/iu.test(t)) return null;
  const rel = t.replace(/[?#].*$/su, "");
  let decoded = rel;
  try { decoded = decodeURIComponent(rel); } catch { /* kept as it stands */ }
  return path.posix.join(path.posix.dirname(from), decoded);
}

// A workflow's command may name a file from another folder (a working-directory, a cd): its name, left where no folder
// of the repository's path stands before it, keeps the file.
const byName = file => new RegExp(`(?<![A-Za-z0-9_-]/)(?<![A-Za-z0-9_.-])${path.posix.basename(file).replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")}(?![A-Za-z0-9_/-]|\\.[A-Za-z0-9])`, "u");

// Where each link of the project's leads inside the repository, as a path from the root ("" the root itself); one that
// leads nowhere, or out of the repository, leads to none of its files.
function linkEnds(p) {
  let root;
  try { root = fs.realpathSync(p.root); } catch { return []; }
  return p.outside.filter(f => linked(p, f)).flatMap(f => {
    let to;
    try { to = path.relative(root, fs.realpathSync(path.join(p.root, f))).split(path.sep).join("/"); } catch { return []; }
    return to.startsWith("..") || path.isAbsolute(to) ? [] : [{ file: f, to }];
  });
}

// Each pointer in a text to the path `from`: as the repository's path, as a relative path that opens with ./ or ../,
// or relative to the file `inFile` as a Markdown link's target, a reference's definition or an HTML href or src; in a
// workflow, whose commands run from the root, the
// repository's path opening with ./ too. The repository's path is none where, read from the folder of `inFile`, it
// names another file that `has` finds: that is the caller's own.
export function pointersTo(inFile, from, has = () => false) {
  const esc = s => s.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
  const rel = path.posix.relative(path.posix.dirname(inFile), from), dotted = rel.startsWith(".") ? rel : `./${rel}`;
  const own = !WORKFLOW.test(inFile) && path.posix.dirname(inFile) !== "." && has(path.posix.join(path.posix.dirname(inFile), from));
  const forms = [...own ? [] : [`(?<![A-Za-z0-9._/-])${esc(from)}`], `(?<![A-Za-z0-9._/-])${esc(dotted)}`, `(?<=\\]\\(\\s*<?|^ {0,3}\\[[^\\]\\n]+\\]:[ \\t]*<?|\\b(?:href|src)\\s*=\\s*["'])${esc(rel)}`];
  if (WORKFLOW.test(inFile)) forms.push(`(?<![A-Za-z0-9._/-])\\./${esc(from)}`);
  return new RegExp(`(?:${forms.join("|")})(?![A-Za-z0-9_/-]|\\.[A-Za-z0-9])`, "gmu");
}
// The same pointer to `to`, in the form it stood in.
export const pointerTo = (inFile, from, to) => hit => {
  if (hit === from) return to;
  if (WORKFLOW.test(inFile) && hit === `./${from}`) return `./${to}`;
  const rel = path.posix.relative(path.posix.dirname(inFile), to);
  return hit.startsWith("./") && !rel.startsWith(".") ? `./${rel}` : rel;
};

// Whether a path of the repository stands, for pointersTo's `has`.
export const exists = p => f => fs.existsSync(path.join(p.root, f));

// The project's own text files that may hold a pointer: outside the copy, the core's whole files and the dated records;
// a workflow is the core's only where it carries the core's mark.
const WORKFLOW = /^\.github\/workflows\//u;
export const coreMarked = (p, f) => whole(f) && (!WORKFLOW.test(f) || /^# The core's file:/u.test(p.own.read(f, true) ?? ""));
export const textFiles = p => p.outside.filter(f => !coreMarked(p, f) && !SKIP.test(f) && !linked(p, f)).flatMap(f => { const t = p.own.read(f, true); return t === null || t.includes("\0") || !lossless(p, f, t) ? [] : [{ file: f, text: t }]; });
// Whether the text read is the file's bytes whole, so that writing it back loses nothing (no other encoding).
const lossless = (p, f, t) => { try { return Buffer.from(t, "utf8").equals(fs.readFileSync(path.join(p.root, f))); } catch { return false; } };
