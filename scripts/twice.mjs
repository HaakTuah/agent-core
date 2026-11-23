// What a project holds twice, or against the core (tasks/cleaning.md, "The reading asks what a project holds twice";
// #1087): the scripts' part of the reading of a project against the core, run at every sync (sync.mjs, beside this
// file, prints it for the sync's pull request) and by the session that takes the reading's task. It lists what it reads
// without guessing, and with --fix corrects only what is exact; what reads close it lists for the auditor
// (roles/auditor.md), who reads it by meaning, and corrects nothing of. What it reads, from the project's root:
//   - text: each paragraph or list item of the project's own Markdown, outside the copy, the core's part of a rule file
//     (core-owned.mjs, BEGIN to END) and the core's whole files, that is a copy of one of the copy's own Markdown files
//     or of another of the project's, or reads close to one (its runs of three words shared, past CLOSE); listed;
//   - a file outside the copy equal byte for byte to one of the core's, at the copy or, with the core fetched, at an
//     earlier copy (the old pin and each release); it goes, its pointers moved to the copy's file, where one file of
//     the copy stands for it and no pointer to it is left that cannot be moved; else it is listed;
//   - a job that calls one of the core's workflows that another job calls too: the second of two in one workflow, the
//     same in all but its name and named in no `needs:`, goes from a workflow of the project's own; any other is listed;
//   - a pointer, in the project's own text, to a path of the copy that is not there: with the core fetched, one the
//     core moved unchanged (a rename git finds whole, between an earlier copy and the copy) moves to where it stands;
//     any other is listed.
// The dated records (reports/, archive/) are not read, nor changed. It fails nothing (AGENTS.md of the core, "Nothing
// locks a project"); in the core's own repository, which holds no copy, it reads nothing. Node's own modules, git and
// the YAML reader (parse-yaml.mjs).
//
//   node core/scripts/twice.mjs                         from a project's root: each finding, exact or for the auditor
//   node core/scripts/twice.mjs --fix                   and correct what is exact, for a pull request of its own
//   node core/scripts/twice.mjs --all                   every finding for the auditor, past the first MOST too
//   ... --fetched <dir> [--since <sha>]                 with the core fetched into the bare repository <dir> (the sync
//                                                       gives it), and the copy's pin before the sync
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "./core-address.mjs";
import { BEGIN, END, whole } from "./core-owned.mjs";
import { MANIFEST, readCore } from "./core-path.mjs";
import { ownFiles } from "./own-files.mjs";
import { parseYaml } from "./parse-yaml.mjs";
import { inBare, releasesIn } from "./releases.mjs";
import { started } from "./started.mjs";

// (first guesses: a paragraph of fewer words than the copies check's window says too little to be a rule; one whose
// runs of three words are shared past CLOSE with another's, of the smaller's, reads close)
export const WORDS = 12, CLOSE = 0.6;
const SKIP = /^(?:reports|archive|words)\//u;
const NOT_COMPARED = /(?:^|\/)(?:LICEN[CS]E|NOTICE|COPYING)[^/]*$|(?:^|\/)\.git(?:ignore|attributes|keep)$/iu;
const SMALLEST = 100; // (a file of fewer bytes, an empty one above all, matches by chance)

// A blob's id as git names it, so that a file is matched to one of an earlier copy's by its id alone.
export const blobId = buf => crypto.createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");

// The words of a text as compared: marks of Markdown and case set aside, its spacing made one.
const wordsOf = t => t.toLowerCase().replace(/[*_`>#|]/gu, " ").replace(/^\s*(?:[-+]|\d+\.)\s+/u, "").split(/\s+/u).filter(Boolean);

// A Markdown text's units: each paragraph, and each list item at its start, with the line it starts on. Code blocks
// and tables are skipped; a unit of fewer than WORDS words is left out.
export function unitsOf(text) {
  const units = [];
  let cur = null, fence = false;
  const close = () => { if (cur && cur.words.length >= WORDS) units.push(cur); cur = null; };
  text.split(/\r?\n/u).forEach((line, i) => {
    if (/^\s*(?:```|~~~)/u.test(line)) { fence = !fence; close(); return; }
    if (fence || /^\s*\|/u.test(line) || /^\s*#/u.test(line) || !line.trim()) { close(); return; }
    if (/^(?:[-*+]|\d+\.)\s/u.test(line)) close();
    cur ??= { line: i + 1, words: [] };
    cur.words.push(...wordsOf(line));
  });
  close();
  return units.map(u => ({ line: u.line, text: u.words.join(" "), runs: runsOf(u.words) }));
}
const runsOf = words => new Set(words.slice(0, -2).map((w, i) => `${w} ${words[i + 1]} ${words[i + 2]}`));

// The share of the smaller unit's runs of three words that the other holds.
export function closeness(a, b) {
  const [small, big] = a.runs.size <= b.runs.size ? [a.runs, b.runs] : [b.runs, a.runs];
  let shared = 0;
  for (const r of small) if (big.has(r)) shared++;
  return small.size ? shared / small.size : 0;
}

// The project's own Markdown, as the text is compared: the core's part of a rule file blanked, its lines kept.
function ownText(own, f) {
  const t = own.read(f);
  if (t === null) return null;
  const b = t.indexOf(BEGIN), e = t.indexOf(END);
  return b >= 0 && e > b ? t.slice(0, b) + t.slice(b, e + END.length).replace(/[^\n]/gu, "") + t.slice(e + END.length) : t;
}

// Each unit of `mine` (file, unit) matched to the units of `theirs` it is a copy of or reads close to: the best one.
function matches(mine, theirs, same = false) {
  const index = new Map();
  theirs.forEach((u, k) => { for (const r of u.unit.runs) { if (!index.has(r)) index.set(r, []); index.get(r).push(k); } });
  const found = [];
  mine.forEach((u, j) => {
    const counts = new Map();
    for (const r of u.unit.runs) for (const k of index.get(r) ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
    let best = null;
    for (const [k, n] of counts) {
      if (same && (k <= j)) continue;
      const share = n / Math.min(u.unit.runs.size, theirs[k].unit.runs.size);
      if (share >= CLOSE && (!best || share > best.share)) best = { other: theirs[k], share, copy: theirs[k].unit.text === u.unit.text };
    }
    if (best) found.push({ at: u, ...best });
  });
  return found;
}

const units = (files, read) => files.flatMap(f => { const t = read(f); return t === null ? [] : unitsOf(t).map(unit => ({ file: f, unit })); });
const where = u => `${u.file}:${u.unit.line}`;
const said = m => m.copy ? `is a copy of ${where(m.other)}` : `reads close to ${where(m.other)} (${Math.round(m.share * 100)}% of its runs of words shared)`;

// The text found twice, against the core's copy and within the project's own: each a line for the auditor.
export function textFound(p, skip = new Set()) {
  const mine = units(p.markdown.filter(f => !skip.has(f)), f => ownText(p.own, f));
  const core = units(p.coreMarkdown, f => p.readCopy(f)).map(u => ({ ...u, file: `${p.copy}${u.file}` }));
  const lines = matches(mine, core).map(m => `${where(m.at)} ${said(m)}, the core's text`);
  return lines.concat(matches(mine, mine, true).map(m => `${where(m.at)} ${said(m)}, the project's own`));
}

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
const listTree = (bare, sha) => inBare(bare, ["ls-tree", "-r", "-z", sha], { maxBuffer: 1 << 28 }).split("\0").flatMap(l => { const m = /^\d+ blob ([0-9a-f]{40})\t(.+)$/su.exec(l); return m ? [{ id: m[1], file: m[2] }] : []; });

const CODE = /\.(?:mjs|cjs|js|ts|py|sh|ps1)$/iu;
// The relative paths a code file names in quotes (its imports, the files it reads), resolved from its folder.
const named = (text, file) => [...text.matchAll(/["'](\.\.?\/[^"'\s]+)["']/gu)].map(m => path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])));

// The files outside the copy equal byte for byte to one of the core's: { file, core, at, to }, `to` the copy's file
// that stands for it, or null where none does, more than one does, or, for code, where it is not the copy's own (an
// earlier version runs otherwise) or a file it names would not stand beside the copy's as it stands beside this one.
export function filesFound(p) {
  const byId = coreBlobs(p), found = [];
  for (const f of p.outside) {
    if (whole(f) || NOT_COMPARED.test(f) || SKIP.test(f) || p.own.read(f, true) === null) continue;
    let buf;
    try { buf = fs.readFileSync(path.join(p.root, f)); } catch { continue; }
    const hits = buf.length < SMALLEST ? null : byId.get(blobId(buf));
    if (!hits) continue;
    const kept = CODE.test(f) ? hits.filter(h => h.at === "the copy") : hits;
    const to = [...new Set(kept.map(h => h.at === "the copy" ? h.file : p.moved.get(h.file) ?? (p.copySet.has(h.file) ? h.file : null)))];
    found.push({ file: f, core: hits[0].file, at: hits[0].at, to: to.length === 1 && to[0] ? `${p.copy}${to[0]}` : null, text: buf.toString("utf8") });
  }
  // (code goes only with every file it names: each goes too, to the copy's file at the same place beside it)
  let dropped = true;
  while (dropped) {
    dropped = false;
    const going = new Map(found.filter(x => x.to).map(x => [x.file, x.to]));
    for (const x of found.filter(x => x.to && CODE.test(x.file))) {
      const ok = named(x.text, x.file).every(n => going.get(n) === path.posix.normalize(path.posix.join(path.posix.dirname(x.to), path.posix.relative(path.posix.dirname(x.file), n))));
      if (!ok) { x.to = null; x.why = "it names a file that would not stand beside the copy's as it stands beside it"; dropped = true; }
    }
  }
  return found;
}

// Each pointer in a text to the path `from`: as the repository's path, as a relative path that opens with ./ or ../,
// or as a Markdown link's target relative to the file `inFile`.
export function pointersTo(inFile, from) {
  const esc = s => s.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
  const rel = path.posix.relative(path.posix.dirname(inFile), from), dotted = rel.startsWith(".") ? rel : `./${rel}`;
  const forms = [`(?<![A-Za-z0-9._/-])${esc(from)}`, `(?<![A-Za-z0-9._/-])${esc(dotted)}`, `(?<=\\]\\()${esc(rel)}`];
  return new RegExp(`(?:${forms.join("|")})(?![A-Za-z0-9_/-]|\\.[A-Za-z0-9])`, "gu");
}
// The same pointer to `to`, in the form it stood in.
export const pointerTo = (inFile, from, to) => hit => {
  if (hit === from) return to;
  const rel = path.posix.relative(path.posix.dirname(inFile), to);
  return hit.startsWith("./") && !rel.startsWith(".") ? `./${rel}` : rel;
};

// The project's own text files that may hold a pointer: outside the copy, the core's whole files and the dated records.
const textFiles = p => p.outside.filter(f => !whole(f) && !SKIP.test(f)).flatMap(f => { const t = p.own.read(f, true); return t === null || t.includes("\0") ? [] : [{ file: f, text: t }]; });

// The pointers to paths of the copy that are not there: { file, line, path, to } where `to` is where the core moved it
// unchanged (null where it did not, or it cannot be read).
export function pointersFound(p) {
  const re = new RegExp(`(?<![A-Za-z0-9._/-])${p.copy.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")}([A-Za-z0-9_][A-Za-z0-9._/-]*[A-Za-z0-9_/])`, "gu");
  const found = [];
  for (const { file, text } of textFiles(p)) {
    for (const m of text.matchAll(re)) {
      const at = m[1].replace(/\/$/u, "");
      if (p.copySet.has(at) || p.copyFolders.has(at)) continue;
      found.push({ file, line: text.slice(0, m.index).split("\n").length, path: `${p.copy}${at}`, to: p.moved.has(at) ? `${p.copy}${p.moved.get(at)}` : null });
    }
  }
  return found;
}

// Each job that calls a workflow of the core's that another job calls too: { file, job, other, exact }, `exact` where it
// is the second of two in one workflow of the project's own, the same in all but its name and needed by no job.
export function callsFound(p) {
  const calls = [], needed = new Set();
  for (const f of p.outside.filter(f => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(f))) {
    let doc;
    try { doc = parseYaml(p.own.read(f) ?? ""); } catch { continue; }
    for (const [job, body] of Object.entries(doc?.jobs ?? {})) {
      const m = new RegExp(`^${CORE}/\\.github/workflows/([^@]+)@`, "u").exec(String(body?.uses ?? ""));
      for (const n of [body?.needs ?? []].flat()) needed.add(`${f}#${n}`);
      if (m) calls.push({ file: f, job, name: m[1], body: JSON.stringify(body), core: whole(f) && /^# The core's file:/u.test(p.own.read(f) ?? "") });
    }
  }
  const found = [];
  calls.forEach((c, i) => {
    const first = calls.slice(0, i).find(o => o.name === c.name);
    if (!first) return;
    const exact = first.file === c.file && first.body === c.body && !c.core && !needed.has(`${c.file}#${c.job}`);
    found.push({ file: c.file, job: c.job, other: `${first.file}#${first.job}`, name: c.name, exact });
  });
  return found;
}

// The workflow's text with the job `job` taken out: its key's line and every line under it, where what is left reads
// as the workflow did without that job; null where it does not, so nothing is guessed.
export function withoutJob(text, job) {
  const lines = text.split("\n"), at = lines.findIndex(l => new RegExp(`^(\\s+)${job.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&")}:\\s*$`, "u").test(l));
  if (at < 0) return null;
  const indent = /^\s*/u.exec(lines[at])[0].length;
  let end = at + 1;
  while (end < lines.length && (!lines[end].trim() || /^\s*/u.exec(lines[end])[0].length > indent)) end++;
  while (end > at + 1 && !lines[end - 1].trim()) end--;
  const out = [...lines.slice(0, at), ...lines.slice(end)].join("\n");
  try {
    const was = parseYaml(text), now = parseYaml(out);
    delete was.jobs[job];
    return JSON.stringify(was) === JSON.stringify(now) ? out : null;
  } catch { return null; }
}

// The project as the script reads it, from `root`; null in the core's own repository or where no copy stands.
export function projectOf(root, { fetched = null, since = null } = {}) {
  const own = ownFiles(root), manifest = own.read(MANIFEST);
  if (manifest === null) return null;
  const line = readCore(manifest);
  if (!line.path || !fs.existsSync(path.join(root, line.path))) return null;
  const copy = line.path, copyDir = path.join(root, copy);
  const copyFiles = listCopy(copyDir), copySet = new Set(copyFiles);
  const copyFolders = new Set(copyFiles.flatMap(f => f.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/"))));
  const outside = own.listed.filter(f => !f.startsWith(copy));
  const markdown = outside.filter(f => /\.md$/iu.test(f) && !whole(f) && !SKIP.test(f));
  const coreMarkdown = copyFiles.filter(f => /\.md$/iu.test(f) && !/^(?:setup\/template|archive|reports|words|inventory|choices)\//u.test(f));
  const readCopy = f => { try { return fs.readFileSync(path.join(copyDir, f), "utf8"); } catch { return null; } };
  const p = { root, own, copy, copyDir, copyFiles, copySet, copyFolders, outside, markdown, coreMarkdown, readCopy, bare: fetched, earlier: [], moved: new Map() };
  if (fetched && line.pin) history(p, line.pin, since);
  return p;
}
const listCopy = dir => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile() && !/(?:^|[\\/])(?:\.packages|node_modules)(?:[\\/]|$)/u.test(e.parentPath ?? e.path)).map(e => path.relative(dir, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join("/"));

// The earlier copies (the old pin and each release before the pin) and the files the core moved unchanged since them.
function history(p, pin, since) {
  let earlier = [];
  try { earlier = [...new Set([since, ...releasesIn(p.bare).map(r => r.sha)])].filter(s => s && s !== pin && /^[0-9a-f]{40}$/u.test(s)); } catch { return; }
  for (const sha of earlier) {
    let out;
    try { out = inBare(p.bare, ["diff", "--name-status", "-z", "--find-renames=100%", sha, pin], { maxBuffer: 1 << 28 }); } catch { continue; }
    p.earlier.push(sha);
    const parts = out.split("\0");
    for (let i = 0; i < parts.length; i++) {
      if (/^R100$/u.test(parts[i]) && p.copySet.has(parts[i + 2])) p.moved.set(parts[i + 1], parts[i + 2]);
      if (/^[RC]\d*$/u.test(parts[i])) i += 2; else if (/^[ADMT]$/u.test(parts[i])) i += 1;
    }
  }
}

// Every finding, each { line, fix } where `fix` is the exact correction, or null where it is for the auditor.
export function findings(p) {
  const out = [];
  const files = filesFound(p);
  for (const f of files) {
    const of = f.at === "the copy" ? `core's ${f.core}` : `core's ${f.core} at ${f.at}, an earlier copy`;
    const why = f.why ?? "no one file of the copy stands for it as it stands";
    out.push({ line: `${f.file} is the ${of}, byte for byte${f.to ? `: it goes, its pointers moved to ${f.to}` : `; ${why}, so it stays for the auditor`}`, fix: f.to ? { kind: "file", ...f } : null });
  }
  for (const c of callsFound(p)) out.push({ line: `${c.file}: the job ${c.job} calls the core's ${c.name}, as ${c.other} does${c.exact ? ", the same in every input: it goes" : ""}`, fix: c.exact ? { kind: "call", ...c } : null });
  for (const q of pointersFound(p)) out.push({ line: `${q.file}:${q.line} names ${q.path}, which the copy does not hold${q.to ? `: the core moved it unchanged to ${q.to}, where it moves` : ""}`, fix: q.to ? { kind: "pointer", ...q } : null });
  for (const t of textFound(p, new Set(files.map(f => f.file)))) out.push({ line: t, fix: null });
  return out;
}

// The exact corrections made: each file that goes, its pointers moved; each call that goes; each pointer moved.
export function fix(p, found) {
  const done = [], edits = new Map(), texts = textFiles(p);
  const text = f => edits.has(f) ? edits.get(f) : p.own.read(f, true);
  const move = (file, from, to) => { const now = text(file), moved = now.replace(pointersTo(file, from), pointerTo(file, from, to)); if (moved !== now) edits.set(file, moved); return moved !== now; };
  const gone = new Set(found.filter(f => f.fix?.kind === "file").map(f => f.fix.file));
  for (const { fix: x } of found.filter(f => f.fix?.kind === "file")) {
    for (const t of texts) if (!gone.has(t.file)) move(t.file, x.file, x.to);
    fs.rmSync(path.join(p.root, x.file));
    done.push(`${x.file} taken out, its pointers moved to ${x.to}`);
  }
  for (const { fix: x } of found.filter(f => f.fix?.kind === "call")) {
    const out = withoutJob(text(x.file), x.job);
    if (out === null) continue;
    edits.set(x.file, out);
    done.push(`${x.file}: the job ${x.job} taken out`);
  }
  for (const { fix: x } of found.filter(f => f.fix?.kind === "pointer" && !gone.has(f.fix.file))) {
    if (move(x.file, x.path, x.to)) done.push(`${x.file}: ${x.path} moved to ${x.to}`);
  }
  for (const [f, t] of edits) if (!gone.has(f)) fs.writeFileSync(path.join(p.root, f), t);
  return [...new Set(done)];
}

// What the command prints; past MOST lines for the auditor, the count of the rest, unless `all`.
export const MOST = 40;
export function report(found, copy, fixed = null, all = false) {
  const head = `What the project holds twice, or against the core (${copy}tasks/cleaning.md, "The reading asks what a project holds twice"):`;
  if (!found.length) return `${head} nothing the scripts read.`;
  const exact = found.filter(f => f.fix), close = found.filter(f => !f.fix);
  const lines = [head];
  if (fixed) lines.push(fixed.length ? `Corrected, for a pull request of its own that the usual reviews read:\n  ${fixed.join("\n  ")}` : "Nothing was corrected.");
  else if (exact.length) lines.push(`Exact, which \`node ${copy}scripts/twice.mjs --fix\` corrects, in a pull request of its own that the usual reviews read, the project's tests run before it is ready:\n  ${exact.map(f => f.line).join("\n  ")}`);
  const shown = all ? close : close.slice(0, MOST), more = close.length - shown.length;
  if (close.length) lines.push(`For the auditor, by meaning (the same, stricter or narrower, different, contradicting, or unsure), none corrected:\n  ${shown.map(f => f.line).join("\n  ")}${more ? `\n  and ${more} more: \`node ${copy}scripts/twice.mjs --all\` lists every one` : ""}`);
  return lines.join("\n");
}

if (started(import.meta.url)) {
  const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
  const fetched = arg("--fetched");
  const p = projectOf(process.cwd(), { fetched: fetched && path.resolve(fetched), since: arg("--since") });
  if (!p) console.log("No copy of the core stands here (the core's own repository, or no manifest's \"Core:\" line names a copy that stands): nothing is read.");
  else {
    const found = findings(p);
    console.log(report(found, p.copy, process.argv.includes("--fix") ? fix(p, found) : null, process.argv.includes("--all")));
  }
}
