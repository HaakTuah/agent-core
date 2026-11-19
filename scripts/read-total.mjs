// The total read (tasks/cleaning.md, "A cut or a join lowers the total read"; #469): what the core's tasks read, each
// file opened counted as a cost of its own, never one file's size. A task is each of the last 30 pull requests merged
// into the history it is given, read by its builder and by its reviewer: each reads at its start what the reading
// script gives its role, with AGENTS.md and each tool's part read at the start (as scripts/size.mjs counts a start), and what the
// paths the pull request changed call for (reading.mjs, beside this file). Beside them, each role's start and each kind
// of task (a builder's start with what the kind calls for) is a reader too, so that a cut that helps a kind no recent
// pull request was of still counts. The sum is all of these readers' cost.
// With --compare it reads the base's tree and this one's against the same 30 pull requests, the base's, every role and
// kind of either side read on both. A cut or a join is a file the reading script names that is added holding text the
// base's named files (AGENTS.md among them) held, or taken out with its text standing in the head's (CUT), read by
// its sentences however its lines are wrapped; a file of new text, one taken out whose text stands nowhere, and a
// rename are none. On a cut or a join it fails unless the sum goes down, no role, kind
// or task reads more, and none loses a file that still stands and that it read before, save one a line `Never needed:`
// of the pull request's description (PR_BODY) names and says why. A move between two files that both stand is not seen,
// and stays with the reviews. --candidates lists the files several kinds of task open (point 10 of #469), ranked by what
// the readers read of each, for the core's audit's reader. It reads the core's own repository alone: in a project the
// files it names stand in the copy, which changes only by a sync of what the core's own check passed, so there it says
// so and decides nothing. It reads only, git's settings that run commands turned off: git, Node's own modules,
// reading.mjs and the two small modules beside it. What it reads of a pull request (its description, its files' names
// and text) is data: names are printed with their control characters written out.
//
//   node scripts/read-total.mjs [--from <rev>]          the sum on this tree, the tasks from <rev>'s history (HEAD)
//   node scripts/read-total.mjs --compare <base>        the base's sum beside this tree's, and the three conditions
//   node scripts/read-total.mjs --candidates            the files several kinds of task open, by what is read of each
//   node scripts/read-total.mjs --line                  one line for the state report
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { counted } from "./file-size.mjs";
import { FLOOR, FLOOR_WHEN, gather, kindsOf, reading, shown, textOf } from "./reading.mjs";
import { started } from "./started.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
// A file opened costs this many bytes beside its own: the call that opens it and the frame its answer comes in, about
// what a tool's call and answer add to a session's context. A reading, not a measure; it only weighs an open against
// its bytes, so that a split into many small files does not read as free.
export const OPEN = 1024;
export const TASKS = 30;
// The roles a merged pull request is read by: its builder, and its reviewer.
const READERS = ["builder", "reviewer"];
// A file added is a cut's part, or one taken out a join's, where at least this many of its sentences, and a quarter of
// them, stand in the other side's named files; a sentence counts where it holds 40 characters or more, so that a
// heading or a list's lead shared by chance is not taken for moved text. A pair of which nine in ten sentences stand in
// the other, both ways, is a rename. Readings, not measures: the reviews read what the check does not see.
export const CUT = { lines: 3, share: 0.25, long: 40, rename: 0.9 };

const QUIET = { GIT_TERMINAL_PROMPT: "0", GIT_NO_LAZY_FETCH: "1", GCM_INTERACTIVE: "never" };
const git = (args, encoding = "utf8") => execFileSync("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "core.quotePath=false", ...args],
  { cwd: ROOT, encoding, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...QUIET } });
// Each line printed, its control characters written out, so that no name a pull request gives starts a line of its own.
const safe = s => String(s).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

// A tree to read: the working tree (rev null) or a commit's. { read(f) → text | null, list(folder) → [path], size(f) → bytes }
export function tree(rev = null) {
  if (!rev) {
    const read = f => { try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch { return null; } };
    const list = folder => { try { return fs.readdirSync(path.join(ROOT, folder)).filter(f => f.endsWith(".md")).sort().map(f => `${folder}/${f}`); } catch { return []; } };
    const size = f => { try { return counted(fs.readFileSync(path.join(ROOT, f))); } catch { return null; } };
    return { read, list, size };
  }
  const texts = new Map();
  const blob = f => { if (!texts.has(f)) { try { texts.set(f, git(["show", `${rev}:${f}`], "buffer")); } catch { texts.set(f, null); } } return texts.get(f); };
  const read = f => blob(f)?.toString("utf8") ?? null;
  const list = folder => { try { return git(["ls-tree", "-z", "--name-only", `${rev}:${folder}`]).split("\0").filter(f => f.endsWith(".md")).sort().map(f => `${folder}/${f}`); } catch { return []; } };
  const size = f => { const b = blob(f); return b ? counted(b) : null; };
  return { read, list, size };
}

// The last `n` pull requests merged into `rev`'s history, each as its merge commit and the paths it changed.
export function tasks(rev = "HEAD", n = TASKS) {
  let merges = [];
  try { merges = git(["log", "--first-parent", "--merges", `-n${n}`, "--format=%H", rev]).split("\n").filter(Boolean); } catch { /* (no history: no task) */ }
  return merges.map(m => ({ id: m.slice(0, 7), paths: git(["diff", "--name-only", "-z", "--no-renames", `${m}^1`, m]).split("\0").filter(Boolean) }));
}

// What a reading costs on a tree: the files it opens, their bytes, and the cost, bytes and opens weighed together.
function cost(t, files) {
  const there = [...new Set(files)].filter(f => t.size(f) !== null);
  const bytes = there.reduce((sum, f) => sum + t.size(f), 0);
  return { files: there, bytes, opens: there.length, cost: bytes + there.length * OPEN };
}
// The file every session in the core reads at its start whatever its role, through its tool's entry file (CLAUDE.md
// imports it, and every other tool's entry names it).
export const ENTRY = "AGENTS.md";
// A reading's files: the entry file, the parts each tool reads at the start, every tool's, as scripts/size.mjs counts
// a start, and what the role and the task call for.
const filesOf = (lib, r) => (r.error ? [] : [ENTRY, ...r.start, ...Object.entries(lib.modules).filter(([, w]) => w?.start && (w.tools.length || w.others.length)).map(([f]) => f), ...r.task.map(c => c.file)]);

// The total on a tree for the tasks given: { sum, readers: Map(name → { files, bytes, opens, cost }), named: Set, read,
// roles, kinds }. `like`, a total of the other side, adds its roles and kinds, so that one either side lacks is read
// on both, as what it reads where its file or its kind's last module is gone.
export function total(t, given, like = null) {
  const lib = gather(t.read, t.list), readers = new Map();
  const roles = [...new Set([...Object.values(lib.roles).map(r => r.name), ...(like?.roles ?? [])])].sort();
  const kinds = [...new Set([...kindsOf(lib).keys(), ...(like?.kinds ?? [])])].sort();
  for (const role of roles) readers.set(`the role ${role}, at its start`, cost(t, filesOf(lib, { ...reading(lib, { role }), task: [] })));
  for (const kind of kinds) readers.set(`a builder's task of the kind ${kind}`, cost(t, filesOf(lib, reading(lib, { role: "builder", kinds: [kind] }))));
  for (const task of given) for (const role of READERS.filter(r => roles.includes(r))) readers.set(`the ${role} of ${task.id}`, cost(t, filesOf(lib, reading(lib, { role, paths: task.paths }))));
  const sum = [...readers.values()].reduce((s, c) => s + c.cost, 0);
  const named = new Set([ENTRY, FLOOR, ...Object.keys(FLOOR_WHEN), ...Object.keys(lib.roles), ...Object.keys(lib.modules)].filter(f => t.size(f) !== null));
  return { sum, readers, named, read: t.read, roles, kinds };
}

const kb = n => `${(n / 1024).toFixed(1)} KB`;
// A text's sentences, its lines joined and its list marks and spacing set aside, so that a move whose lines are wrapped
// anew is still seen.
const linesOf = text => new Set(textOf(text).replace(/^\s*(?:[-*+]|\d+\.)\s+/gmu, "").replace(/\s+/gu, " ").split(/(?<=[.;:!?])\s/u).map(l => l.trim()).filter(l => l.length >= CUT.long));
// The share of `mine`'s long lines that stand in `others`' texts, and how many.
function standIn(mine, others) {
  const there = new Set(others.flatMap(t => [...linesOf(t)]));
  const hit = [...mine].filter(l => there.has(l)).length;
  return { hit, share: mine.size ? hit / mine.size : 0 };
}
const moved = s => s.hit >= CUT.lines && s.share >= CUT.share;

// The files added and taken out that make a cut or a join: { added, gone }, each [file], renames and new or dropped
// text left out (CUT).
export function cuts(base, head) {
  const added = [...head.named].filter(f => !base.named.has(f)), gone = [...base.named].filter(f => !head.named.has(f));
  const rename = (a, g) => { const la = linesOf(head.read(a)), lg = linesOf(base.read(g)); return la.size && standIn(la, [base.read(g)]).share >= CUT.rename && standIn(lg, [head.read(a)]).share >= CUT.rename; };
  const renamed = new Set(added.flatMap(a => gone.filter(g => rename(a, g)).flatMap(g => [a, g])));
  const baseTexts = [...base.named].map(f => base.read(f)), headTexts = [...head.named].map(f => head.read(f));
  return {
    added: added.filter(a => !renamed.has(a) && moved(standIn(linesOf(head.read(a)), baseTexts))),
    gone: gone.filter(g => !renamed.has(g) && moved(standIn(linesOf(base.read(g)), headTexts))),
  };
}

// The files a description's lines `Never needed:` name in backticks and say why of: a line that names files and holds
// no word beside them names none. Read line by line, so that no pattern runs over more than one line.
export function neverNeeded(body) {
  const out = new Set();
  for (const line of textOf(body).split("\n")) {
    const m = /^\s*Never needed:([^]*)$/u.exec(line);
    if (!m) continue;
    const names = [...m[1].matchAll(/`([^`]+)`/gu)].map(x => x[1]);
    if (/\p{L}{2,}/u.test(m[1].replace(/`[^`]*`/gu, ""))) names.forEach(n => out.add(n));
  }
  return out;
}

// The three conditions, as failures each with its mend: [] where they hold, or where the change is no cut or join.
export function conditions(base, head, body = "") {
  const { added, gone } = cuts(base, head);
  if (!added.length && !gone.length) return { cut: false, failures: [] };
  const never = neverNeeded(body), list = fs => fs.map(shown).join(", ");
  const failures = [];
  const how = `${added.length ? `adds ${list(added)}, holding text the base's files held` : ""}${added.length && gone.length ? ", and " : ""}${gone.length ? `takes out ${list(gone)}, its text standing in another` : ""}`;
  if (head.sum >= base.sum) failures.push(`this pull request ${how}, a cut or a join, and the total read does not go down: ${kb(base.sum)} before, ${kb(head.sum)} after. Mend: cut or join the files along a seam where some reader reads less (tasks/cleaning.md, "A cut or a join lowers the total read"), or leave the text where it stood`);
  const none = { files: [], bytes: 0, opens: 0, cost: 0 };
  for (const [name, b] of base.readers) {
    const h = head.readers.get(name) ?? none;
    if (h.cost > b.cost) failures.push(`${shown(name)} reads more after this cut or join: ${kb(b.bytes)} in ${b.opens} files before, ${kb(h.bytes)} in ${h.opens} after. Mend: move what it reads back where it read it, or cut along another seam, so that no reader reads more`);
    const lost = b.files.filter(f => head.named.has(f) && !h.files.includes(f) && !never.has(f));
    if (lost.length) failures.push(`${shown(name)} no longer reads ${list(lost)}, which it read before and which still stands. Mend: have the reading script call it for that reader again, or, where that reader never needed it, add to the description a line \`Never needed:\` naming it in backticks and saying why, then push`);
  }
  return { cut: true, failures };
}

// The files several kinds of task open, each with the kinds and the bytes all the readers read of it, most first: the
// candidates the core's audit's reader is shown, where a part of a file may be all that most of its readers need.
export function candidates(t, given = []) {
  const lib = gather(t.read, t.list), by = new Map(), now = total(t, given);
  for (const [kind, files] of kindsOf(lib)) for (const f of files) by.set(f, [...(by.get(f) ?? []), kind]);
  const readOf = f => [...now.readers.values()].filter(r => r.files.includes(f)).length * (t.size(f) ?? 0);
  return [...by].filter(([, kinds]) => kinds.length > 1).map(([f, kinds]) => [f, kinds, readOf(f)])
    .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]));
}

// Whether this file stands in the core's own repository (its root git's top), not in a project's copy.
function own() {
  try { return fs.realpathSync(git(["rev-parse", "--show-toplevel"]).trim()) === fs.realpathSync(ROOT); } catch { return false; }
}

if (started(import.meta.url)) {
  const args = process.argv.slice(2), at = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const known = ["--compare", "--from", "--candidates", "--line"];
  const bad = args.find((a, i) => a.startsWith("--") ? !known.includes(a) : !["--compare", "--from"].includes(args[i - 1]));
  if (bad !== undefined || (args.includes("--compare") && !at("--compare")) || (args.includes("--from") && !at("--from"))) {
    console.error(safe(`FAIL: the total read does not know ${bad ?? "that call"}. Mend: run node scripts/read-total.mjs [--from <rev>] | --compare <base> | --candidates | --line`));
    process.exit(1);
  }
  if (!own()) {
    console.log("not run: the total read reads the core's own repository alone; here the files the reading script names stand in the copy of the core, which changes only by a sync of what the core's own check passed, so it decides nothing (tasks/cleaning.md, \"A cut or a join lowers the total read\")");
    process.exit(0);
  }
  const rev = at("--compare") ?? at("--from") ?? "HEAD";
  if (!/^\w[\w./^~-]*$/u.test(rev)) { console.error(safe(`FAIL: ${rev} is no revision's name. Mend: name the pull request's base, as a commit or a branch`)); process.exit(1); }
  try { git(["rev-parse", "--verify", "-q", `${rev}^{commit}`]); } catch { console.error(safe(`FAIL: ${rev} is not a commit here. Mend: fetch it (git fetch origin ${rev}), or name the pull request's base`)); process.exit(1); }
  const given = tasks(rev);
  if (args.includes("--candidates")) {
    const list = candidates(tree(), given);
    for (const [f, kinds, read] of list) console.log(safe(`${f}: ${kb(read)} read of it in the total, opened by ${kinds.length} kinds of task (${kinds.join(", ")})`));
    if (!list.length) console.log("no file is opened by more than one kind of task");
    process.exit(0);
  }
  if (args.includes("--compare")) {
    const first = total(tree(rev), given), after = total(tree(), given, first), before = total(tree(rev), given, after);
    console.log(`the total read, each role's start, each kind of task and ${given.length} merged pull requests each read by its builder and its reviewer: ${kb(before.sum)} on the base, ${kb(after.sum)} here`);
    const { cut, failures } = conditions(before, after, process.env.PR_BODY);
    if (!cut) { console.log("ok   no file the reading script names is added with text the base held, or taken out with its text standing in another: no cut or join to hold to the three conditions"); process.exit(0); }
    for (const f of failures) console.error(safe(`FAIL: ${f}`));
    if (failures.length) process.exit(1);
    console.log("ok   a cut or a join: the sum goes down, no reader reads more, and none loses a file it read");
    process.exit(0);
  }
  const now = total(tree(), given);
  const opens = [...now.readers].filter(([n]) => / of [0-9a-f]{7}$/u.test(n)).reduce((s, [, c]) => s + c.opens, 0);
  if (args.includes("--line")) { console.log(`The total read: ${kb(now.sum)}, over each role's start, each kind of task and the last ${given.length} merged pull requests, each read by its builder and its reviewer in ${opens} files opened (scripts/read-total.mjs)`); process.exit(0); }
  console.log(`the total read: ${kb(now.sum)}, over each role's start, each kind of task and ${given.length} merged pull requests (theirs ${opens} files opened, each counted as ${OPEN} bytes beside its own)`);
  for (const [name, c] of now.readers) if (!/ of [0-9a-f]{7}$/u.test(name)) console.log(safe(`  ${name}: ${kb(c.bytes)} in ${c.opens} files`));
}
