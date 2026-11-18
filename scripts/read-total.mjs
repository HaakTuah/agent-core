// The total read (tasks/cleaning.md, "A cut or a join lowers the total read"; #469): what the core's tasks read, each
// file opened counted as a cost of its own, never one file's size. A task is each of the last 30 pull requests merged
// into the history it is given, read by its builder and by its reviewer: each reads at its start what the reading
// script gives its role, and what the paths the pull request changed call for (reading.mjs, beside this file). Beside
// them, each role's start and each kind of task (a builder's start with what the kind calls for) is a reader too, so
// that a cut that helps a kind no recent pull request was of still counts. The sum is all of these readers' cost.
// With --compare it reads the base's tree and this one's against the same 30 pull requests, the base's, and, where the
// files the reading script names differ (a file added or taken out: a cut or a join), fails unless the sum goes down,
// no role, kind or task reads more, and none loses a file that still stands and that it read before, save one the
// pull request's description names on a line `Never needed:` (PR_BODY), saying why. A cut between two files that both
// stand is not seen as one, and stays with the reviews. --candidates lists the files several kinds of task open
// (point 10 of #469), for the audit's reader. It reads only: git and Node's own modules, and reading.mjs.
//
//   node scripts/read-total.mjs [--from <rev>]          the sum on this tree, the tasks from <rev>'s history (HEAD)
//   node scripts/read-total.mjs --compare <base>        the base's sum beside this tree's, and the three conditions
//   node scripts/read-total.mjs --candidates            the files several kinds of task open
//   node scripts/read-total.mjs --line                  one line for the state report
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { counted } from "./file-size.mjs";
import { FLOOR, FLOOR_WHEN, gather, kindsOf, reading } from "./reading.mjs";
import { started } from "./started.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
// A file opened costs this many bytes beside its own: the call that opens it and the frame its answer comes in, about
// what a tool's call and answer add to a session's context. A reading, not a measure; it only weighs an open against
// its bytes, so that a split into many small files does not read as free.
export const OPEN = 1024;
export const TASKS = 30;
// The roles a merged pull request is read by: its builder, and its reviewer.
const READERS = ["builder", "reviewer"];

const git = (args, encoding = "utf8") => execFileSync("git", ["-c", "core.quotePath=false", ...args], { cwd: ROOT, encoding, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });

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
  const list = folder => { try { return git(["ls-tree", "--name-only", `${rev}:${folder}`]).split("\n").filter(f => f.endsWith(".md")).sort().map(f => `${folder}/${f}`); } catch { return []; } };
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
  const there = files.filter(f => t.size(f) !== null);
  const bytes = there.reduce((sum, f) => sum + t.size(f), 0);
  return { files: there, bytes, opens: there.length, cost: bytes + there.length * OPEN };
}
const filesOf = r => (r.error ? [] : [...r.start, ...r.task.map(c => c.file)]);

// The total on a tree for the tasks given: { sum, readers: Map(name → { files, bytes, opens, cost }), named: Set }.
export function total(t, given) {
  const lib = gather(t.read, t.list), readers = new Map();
  const roles = Object.values(lib.roles).map(r => r.name).sort();
  for (const role of roles) readers.set(`the role ${role}, at its start`, cost(t, reading(lib, { role }).start ?? []));
  for (const kind of kindsOf(lib).keys()) readers.set(`a builder's task of the kind ${kind}`, cost(t, filesOf(reading(lib, { role: "builder", kinds: [kind] }))));
  for (const task of given) for (const role of READERS.filter(r => roles.includes(r))) readers.set(`the ${role} of ${task.id}`, cost(t, filesOf(reading(lib, { role, paths: task.paths }))));
  const sum = [...readers.values()].reduce((s, c) => s + c.cost, 0);
  const named = new Set([FLOOR, ...Object.keys(FLOOR_WHEN), ...Object.keys(lib.roles), ...Object.keys(lib.modules)].filter(f => t.size(f) !== null));
  return { sum, readers, named };
}

const kb = n => `${(n / 1024).toFixed(1)} KB`;

// The three conditions, as failures each with its mend: [] where they hold, or where the files named did not change.
export function conditions(base, head, body = "") {
  const added = [...head.named].filter(f => !base.named.has(f)), gone = [...base.named].filter(f => !head.named.has(f));
  if (!added.length && !gone.length) return { cut: false, failures: [] };
  const never = new Set([...String(body).matchAll(/^\s*Never needed:(.*)$/gmu)].flatMap(m => [...m[1].matchAll(/`([^`]+)`/gu)].map(x => x[1])));
  const failures = [];
  const how = `${added.length ? `adds ${added.join(", ")}` : ""}${added.length && gone.length ? " and " : ""}${gone.length ? `takes out ${gone.join(", ")}` : ""}`;
  if (head.sum >= base.sum) failures.push(`this pull request ${how}, a cut or a join, and the total read does not go down: ${kb(base.sum)} before, ${kb(head.sum)} after. Mend: cut or join the files along a seam where some reader reads less (tasks/cleaning.md, "A cut or a join lowers the total read"), or keep them as they stand`);
  for (const [name, b] of base.readers) {
    const h = head.readers.get(name);
    if (!h) continue;
    if (h.cost > b.cost) failures.push(`${name} reads more after this cut or join: ${kb(b.bytes)} in ${b.opens} files before, ${kb(h.bytes)} in ${h.opens} after. Mend: move what it reads back where it read it, or cut along another seam, so that no reader reads more`);
    const lost = b.files.filter(f => head.named.has(f) && !h.files.includes(f) && !never.has(f));
    if (lost.length) failures.push(`${name} no longer reads ${lost.join(", ")}, which it read before and which still stands. Mend: have the reading script call it for that reader again, or, where that reader never needed it, say why in the description on a line \`Never needed:\` naming it in backticks`);
  }
  return { cut: true, failures };
}

// The files several kinds of task open, each with the kinds: the candidates the audit's reader is shown.
export function candidates(t) {
  const lib = gather(t.read, t.list), by = new Map();
  for (const [kind, files] of kindsOf(lib)) for (const f of files) by.set(f, [...(by.get(f) ?? []), kind]);
  return [...by].filter(([, kinds]) => kinds.length > 1).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

if (started(import.meta.url)) {
  const args = process.argv.slice(2), at = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const known = ["--compare", "--from", "--candidates", "--line"];
  const bad = args.find((a, i) => a.startsWith("--") ? !known.includes(a) : !["--compare", "--from"].includes(args[i - 1]));
  if (bad !== undefined || (args.includes("--compare") && !at("--compare")) || (args.includes("--from") && !at("--from"))) {
    console.error(`FAIL: the total read does not know ${bad ?? "that call"}. Mend: run node scripts/read-total.mjs [--from <rev>] | --compare <base> | --candidates | --line`);
    process.exit(1);
  }
  if (args.includes("--candidates")) {
    const list = candidates(tree());
    for (const [f, kinds] of list) console.log(`${f}: opened by ${kinds.length} kinds of task (${kinds.join(", ")})`);
    if (!list.length) console.log("no file is opened by more than one kind of task");
    process.exit(0);
  }
  const base = at("--compare");
  if (base) {
    try { git(["rev-parse", "--verify", "-q", `${base}^{commit}`]); } catch { console.error(`FAIL: ${base} is not a commit here. Mend: fetch it (git fetch origin ${base}), or name the pull request's base`); process.exit(1); }
    const given = tasks(base), before = total(tree(base), given), after = total(tree(), given);
    console.log(`the total read, each role's start, each kind of task and ${given.length} merged pull requests each read by its builder and its reviewer: ${kb(before.sum)} on the base, ${kb(after.sum)} here`);
    const { cut, failures } = conditions(before, after, process.env.PR_BODY ?? "");
    if (!cut) { console.log("ok   no file the reading script names is added or taken out: no cut or join to hold to the three conditions"); process.exit(0); }
    for (const f of failures) console.error(`FAIL: ${f}`);
    if (failures.length) process.exit(1);
    console.log("ok   a cut or a join: the sum goes down, no reader reads more, and none loses a file it read");
    process.exit(0);
  }
  const given = tasks(at("--from") ?? "HEAD"), now = total(tree(), given);
  const opens = [...now.readers].filter(([n]) => / of [0-9a-f]{7}$/u.test(n)).reduce((s, [, c]) => s + c.opens, 0);
  if (args.includes("--line")) { console.log(`The total read: ${kb(now.sum)}, over each role's start, each kind of task and the last ${given.length} merged pull requests, each read by its builder and its reviewer in ${opens} files opened (scripts/read-total.mjs)`); process.exit(0); }
  console.log(`the total read: ${kb(now.sum)}, over each role's start, each kind of task and ${given.length} merged pull requests (theirs ${opens} files opened, each counted as ${OPEN} bytes beside its own)`);
  for (const [name, c] of now.readers) if (!/ of [0-9a-f]{7}$/u.test(name)) console.log(`  ${name}: ${kb(c.bytes)} in ${c.opens} files`);
}
