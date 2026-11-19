// How strong the tests are (tasks/code-shape.md, "How strong the tests are"; #253), for every project that takes the
// core: whether the tests would fail if a fault were put into the code on purpose, measured on the lines a pull request
// changes. The project's *mutation tool* (its manifest's row; the core's AGENTS.md names its own, Stryker run by
// stryker.mjs beside this file) puts the faults in and writes what it found in the open form of a mutation report (the
// mutation-testing-elements schema, as Stryker writes it); this script runs it, with no shell, as the row says,
// `{lines}` given the lines to fault (<file>:<first>-<last>, joined by commas) and `{report}` the file to write, and
// reads the report: a fault a test failed on (Killed, Timeout) was caught, one none did (Survived, NoCoverage)
// survived, and one the tool did not run (Pending) is counted as not run.
//
// Reported first: the number is printed, and in the job's summary, and fails nothing while the project has no
// baseline. Its baseline stands beside the shape check's (strength-baseline.json in the same folder), in its form:
// "listed", each fault that survives (by its file, its line's text and what it became) to how many times; "grown",
// the reason of each that had to join; "whole", the day and commit of the whole run it was written from. Once it
// stands, a fault that survives on a changed line and the baseline does not list fails, with its mend: a test that
// catches it, or, where it changes nothing the program does, the entry listed with that reason under "grown". An entry
// may join the baseline only with that reason, or in the pull request that records a new whole run. The baseline is
// read by kind, a file and what became what, whatever line a fault stands on: of each kind, the survivors on the
// changed lines and what the lines left alone still hold may not pass what it lists, so debt that only moved stays
// listed; and a pull request may not list fewer of a kind than still survive. Where the tool's budget leaves faults on
// the lines left alone unrun, it is run once more on those lines alone, with a budget of its own (#408). The whole run is
// the audit's, outside the suite (tasks/cleaning.md): --whole runs the tool on every file of the code and writes the
// baseline from it. A test file the pull request deletes is named, for its description to say why (the review reads
// it, roles/shared/review-guidelines.md). A project whose row says `none` has the measure left out; one with no row is told
// the step (setup/sync-notes.md). The code and the tests are the shape check's config's.
//
//   node core/scripts/strength.mjs           on a pull request, STRENGTH_BASE set to the branch it merges into
//                                            (origin/main): the lines it changes; with no base, nothing to measure
//   node core/scripts/strength.mjs --whole   the whole run, which writes the baseline: the first, or the new one
//   node core/scripts/strength.mjs --lower <file>[,<file>...]   a cleaning task's run: the tool on those files whole,
//                                            and their entries lowered to what still survives; nothing joins
// Run from the project's root, as a step of the job that runs its tests. git and Node's own modules.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CODE, OTHER } from "./code-shape.mjs";
import { logged, parseBounded } from "./guards.mjs";
import { pathIn } from "./reading.mjs";
import { notLinked, parseBaseline, parseConfig, where } from "./shape.mjs";
import { started } from "./started.mjs";

const SAFE = ["-c", "core.fsmonitor=false", "-c", "core.quotePath=false"];
const git = args => execFileSync("git", [...SAFE, ...args], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const tolerant = read => { try { return read(); } catch { return null; } };
const CAUGHT = ["Killed", "Timeout"], SURVIVED = ["Survived", "NoCoverage"];
const ROW = "*mutation tool*";

class Refused extends Error {}
const refuse = (what, mend) => { throw new Refused(`${what}. Mend: ${mend}`); };
// A file of the project's, read and written through no link (shape.mjs, notLinked): its path, or a refusal.
export const unlinked = file => { try { return notLinked(file); } catch (e) { const [what, mend] = String(e.message).split(". Mend: "); return refuse(what, mend ?? "make it a plain file of the project's own"); } };

// The project's rules: its manifest, else (the core) its AGENTS.md; and where the core's scripts lie from its root.
export function rulesHere(root = ".") {
  for (const [file, home] of [["core-manifest.md", null], ["AGENTS.md", ""]]) {
    const text = tolerant(() => fs.readFileSync(path.join(root, file), "utf8"));
    if (text !== null) return { text, home: home ?? pathIn(text) };
  }
  return { text: "", home: "core/" };
}

// The row that names the mutation tool: { command } (its words), { none } (the reason given), or null where there is
// no row. The command is the row's first text in backticks.
export function toolOf(rules) {
  const line = String(rules ?? "").split(/\r?\n/u).find(l => l.includes(ROW));
  if (!line) return null;
  const said = /`([^`]+)`/u.exec(line.slice(line.indexOf(ROW) + ROW.length))?.[1]?.trim();
  if (!said) return null;
  if (said === "none") return { none: line.slice(line.indexOf("`none`") + 6).replace(/^[\s:|,;-]+|[\s|]+$/gu, "") };
  return { command: said.split(/\s+/u) };
}

// Where the baseline stands: beside the shape check's.
export const baselineOf = config => path.posix.join(path.posix.dirname(config.baseline), "strength-baseline.json");

// The lines a pull request changes, of the files of code: a Map of file to a Set of line numbers, read from git's diff
// of the base (where they part, if git can tell; else the base itself) against the working folder.
export function changedLines(base, code) {
  const from = tolerant(() => git(["merge-base", base, "HEAD"]).trim()) || base;
  const out = new Map();
  if (!code.length) return out;
  let file = null;
  for (const line of git(["diff", "-U0", "--no-color", "--no-renames", "--no-ext-diff", from, "--", ...code]).split("\n")) {
    if (line.startsWith("+++ ")) file = line === "+++ /dev/null" ? null : line.slice(6).replace(/\t$/u, ""); // (git ends a name that holds a space with a tab)
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/u.exec(line);
    if (!file || !hunk) continue;
    const first = Number(hunk[1]), count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (!out.has(file)) out.set(file, new Set());
    for (let n = first; n < first + count; n++) out.get(file).add(n);
  }
  return new Map([...out].filter(([, lines]) => lines.size));
}

// The lines as the tool is told them: <file>:<first>-<last> for each run of lines, joined by commas.
export function linesArg(changed) {
  const runs = [];
  for (const [file, lines] of changed) {
    const sorted = [...lines].sort((a, b) => a - b);
    let start = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) continue;
      runs.push(`${file}:${start}-${sorted[i - 1]}`);
      start = sorted[i];
    }
  }
  return runs.join(",");
}

const collapse = (s, most) => { const t = String(s).replace(/\s+/gu, " ").trim(); return t.length > most ? `${t.slice(0, most - 1)}…` : t; };

// The text a fault replaced.
const originalOf = (lines, { start, end }) => (start.line === end.line ? lines[start.line - 1]?.slice(start.column - 1, end.column - 1) : lines[start.line - 1]?.slice(start.column - 1)) ?? "";

// A fault's id in the baseline: its file, the text of its line, and what became what; stable where lines move.
export function idOf(file, source, m) {
  const lines = source.split(/\r?\n/u);
  return `survivor: ${file}: ${collapse(lines[m.location.start.line - 1] ?? "", 100)} [${collapse(originalOf(lines, m.location), 40)} -> ${collapse(m.replacement ?? "", 40)}]`;
}

const aPlace = p => p && Number.isInteger(p.line) && p.line > 0 && Number.isInteger(p.column) && p.column > 0;
const aMutant = m => m && typeof m.status === "string" && typeof m.mutatorName === "string" && aPlace(m.location?.start) && aPlace(m.location?.end);

// The faults of a report, on the lines wanted (a Map of file to a Set; null for all): each { file, line, column, end,
// id, status, mutatorName, replacement }. It throws a Refused where the report is not in the form.
export function faultsOf(text, wanted, root = ".") {
  let r;
  try { r = parseBounded(text); } catch { refuse("the mutation tool's report could not be read as JSON", "have the tool write its report in the mutation-testing-elements schema (Stryker's \"json\" reporter writes it) to the path {report} stands for"); }
  if (!r || typeof r.files !== "object" || r.files === null) refuse("the mutation tool's report has no \"files\"", "have the tool write the mutation-testing-elements schema, whose \"files\" holds each file's \"source\" and \"mutants\"");
  const out = [];
  for (const [name, f] of Object.entries(r.files)) {
    const file = (path.isAbsolute(name) ? path.relative(root, name) : name).replace(/\\/gu, "/");
    if (typeof f?.source !== "string" || !Array.isArray(f.mutants) || !f.mutants.every(aMutant)) refuse(`the mutation tool's report holds ${file} in a form the check does not read`, "have the tool write the mutation-testing-elements schema: each file a \"source\" and \"mutants\", each with \"mutatorName\", \"location\" and \"status\"");
    for (const m of f.mutants) {
      if (wanted && !wanted.get(file)?.has(m.location.start.line)) continue;
      out.push({ file, line: m.location.start.line, column: m.location.start.column, end: `${m.location.end.line}:${m.location.end.column}`, id: idOf(file, f.source, m), status: m.status, mutatorName: m.mutatorName, original: originalOf(f.source.split(/\r?\n/u), m.location), replacement: m.replacement ?? "" });
    }
  }
  return out;
}

// The counts of a run, and its line: caught, survived, not run.
export function counted(faults) {
  const n = statuses => faults.filter(f => statuses.includes(f.status)).length;
  const caught = n(CAUGHT), survived = n(SURVIVED), pending = n(["Pending"]), judged = caught + survived;
  const share = judged ? `${Math.round((1000 * caught) / judged) / 10}%` : "none judged";
  return { caught, survived, pending, line: `${caught} of ${judged} faults put in on purpose were caught (${share})${survived ? `, ${survived} survived` : ""}${pending ? `, ${pending} not run (the tool's budget)` : ""}` };
}

// An id's parts: its file, its line's text, what became what ("[<original> -> <replacement>]") and the original, less
// the mark of a cut. A line's text may hold " [" itself: the split taken is the first whose rest reads as what became
// what and whose original the line holds, else the last that reads so.
const partsOf = id => {
  const m = /^survivor: (.+?): (.*)$/su.exec(id), splits = [];
  for (let i = m ? m[2].indexOf(" [") : -1; i >= 0; i = m[2].indexOf(" [", i + 1)) {
    const what = m[2].slice(i + 1), o = /^\[(.*?) -> .*\]$/su.exec(what);
    if (o) splits.push({ file: m[1], line: m[2].slice(0, i), what, original: o[1].replace(/…$/u, "") });
  }
  return splits.find(s => s.line.includes(s.original)) ?? splits.at(-1) ?? null;
};

// A fault's kind: its file and what became what, whatever line it stands on. The baseline is read by kind: how many of
// each fault a file holds, so that debt which only moved (a line rewritten, one copy of a repeated line, a line moved
// to another) stays listed, whatever id it is listed under.
export const kindOf = id => { const p = partsOf(id); return p ? `${p.file}\n${p.what}` : id; };

// What a baseline lists of each kind (`listedMap`, id to { count }), and how many faults of each kind a run found.
export const totals = listedMap => [...listedMap].reduce((t, [id, n]) => t.set(kindOf(id), (t.get(kindOf(id)) ?? 0) + (n.count ?? 0)), new Map());
const tally = faults => faults.reduce((t, f) => t.set(kindOf(f.id), (t.get(kindOf(f.id)) ?? 0) + 1), new Map());
// What the lines a change left alone hold: those found surviving (`known`), a fault the tool left unrun there counting
// as caught, as one on a changed line does, so that a budget that runs out turns no rewrite red (unsure() says so);
// and, where a pull request lowers a kind (undercut(), movedOut()), those not known to be caught (`holding`), since
// only debt measured gone may leave the list.
const known = still => still.filter(f => SURVIVED.includes(f.status));
const holding = still => still.filter(f => [...SURVIVED, "Pending"].includes(f.status));
const whatOf = kind => kind.slice(kind.lastIndexOf("\n") + 1);

// The listed ids whose kind the lines a change left alone must be measured for: a kind of which a survivor stands on a
// changed line and the baseline (`now`) lists some, and one the baseline lists fewer of than the base (`was`) did,
// unless the pull request records a new whole run (`recorded`). The rest need no measure: a kind it lists none of
// fails whatever stands elsewhere, and one it neither adds to nor lowers cannot grow.
export function needed(faults, now, was, recorded = false) {
  const mine = new Set(faults.filter(f => SURVIVED.includes(f.status)).map(f => kindOf(f.id)));
  const nowT = totals(now.listed), wasT = was && !recorded ? totals(was.listed) : new Map();
  const want = k => (mine.has(k) && (nowT.get(k) ?? 0) > 0) || (nowT.get(k) ?? 0) < (wasT.get(k) ?? 0);
  return [...new Set([...now.listed.keys(), ...(was?.listed.keys() ?? [])])].filter(id => want(kindOf(id)));
}

// The lines a change left alone that could hold a fault of those ids' kinds (`texts`, a function of a file to its text;
// `changed`, a Map of file to the Set of changed lines): each line whose text holds the kind's original, wherever it
// stands in the file. A Map of file to a Set of lines, on which the tool is run so that what they hold is measured,
// never guessed.
export function watched(ids, texts, changed) {
  const originals = new Map(), out = new Map();
  for (const p of ids.map(partsOf).filter(Boolean)) originals.set(p.file, [...(originals.get(p.file) ?? []), p.original]);
  for (const [file, wants] of originals) {
    const lines = (texts(file) ?? "").split(/\r?\n/u).map((l, i) => [collapse(l, Infinity), i + 1]);
    const held = lines.filter(([l, n]) => l && !changed.get(file)?.has(n) && wants.some(o => l.includes(o))).map(([, n]) => n);
    if (held.length) out.set(file, new Set(held));
  }
  return out;
}

// The survivors on the changed lines that the baseline cannot hold: of each kind, those on the changed lines (`faults`)
// and what the lines left alone hold (`still`, the faults found on watched()) may not pass what the baseline lists of
// it. Those past it fail, a survivor of an id the baseline lists last; one of each id.
export function unlisted(faults, listedMap, still = []) {
  const total = totals(listedMap), held = tally(known(still)), mine = new Map();
  const order = faults.filter(f => SURVIVED.includes(f.status)).sort((a, b) => Number(!listedMap.has(a.id)) - Number(!listedMap.has(b.id)));
  for (const f of order) mine.set(kindOf(f.id), [...(mine.get(kindOf(f.id)) ?? []), f]);
  const over = [...mine].flatMap(([k, all]) => all.slice(Math.max(0, (total.get(k) ?? 0) - (held.get(k) ?? 0))));
  return over.filter((f, i, all) => all.findIndex(g => g.id === f.id) === i);
}

// The kinds whose survivors on the changed lines pass only because faults on the lines left alone were not run: not
// measured, and said so. Each [kind, how many not run].
export function unsure(faults, listedMap, still = []) {
  const run = unlisted(faults, listedMap, still), strict = unlisted(faults, listedMap, holding(still).map(f => ({ ...f, status: "Survived" })));
  const kinds = new Set(strict.map(f => kindOf(f.id)).filter(k => !run.some(f => kindOf(f.id) === k)));
  return [...kinds].map(k => [k, still.filter(f => f.status === "Pending" && kindOf(f.id) === k).length]);
}

// The kinds a pull request's baseline (`now`) lists fewer of than the base (`was`) did, below what the lines it left
// alone may still hold (`still`, a fault not run counting as held): [{ kind, listed, before, held, unrun }], `unrun`
// the faults among those held that the tool did not run (its budget). Debt dropped from the list while it survives
// would turn the change that next moves it red.
export function undercut(now, was, still = []) {
  if (!was) return [];
  const nowT = totals(now.listed), held = tally(holding(still)), unrun = tally(still.filter(f => f.status === "Pending"));
  return [...totals(was.listed)].filter(([k, n]) => (nowT.get(k) ?? 0) < n && (held.get(k) ?? 0) > (nowT.get(k) ?? 0))
    .map(([k, before]) => ({ kind: k, listed: nowT.get(k) ?? 0, before, held: held.get(k), unrun: unrun.get(k) ?? 0 }));
}

// What the lines a change left alone hold (`still`), once the tool is run a second time, with a budget of its own, on
// only the lines whose faults the first run left unrun (`measure`, a Map of file to a Set of lines to the faults found
// there), so a survivor on a changed line is seldom passed, and an entry seldom held, for want of a run (#408). Fault by
// fault, by the whole of it (its place from start to end, what put it in and what it became, uncut): one the first run
// left unrun takes the second run's verdict on that same fault, those alike taken in the report's order; any the first
// run judged keeps its verdict, and none is counted twice. Where the lines left unrun are all those on which the first
// run found any fault (`first`, a Map of file to a Set), a second run would face the same queue, and none is made.
const spot = f => JSON.stringify([f.file, f.line, f.column, f.end, f.mutatorName, f.replacement, f.id]);
export function again(still, measure, first) {
  const unrun = still.filter(f => f.status === "Pending");
  if (!unrun.length) return still;
  const lines = new Map();
  for (const f of unrun) lines.set(f.file, (lines.get(f.file) ?? new Set()).add(f.line));
  const count = m => [...m.values()].reduce((n, at) => n + at.size, 0);
  if (count(lines) >= count(first)) return still;
  const judged = new Map();
  for (const g of measure(lines).filter(g => g.status !== "Pending")) judged.set(spot(g), [...(judged.get(spot(g)) ?? []), g]);
  return still.map(f => (f.status === "Pending" ? judged.get(spot(f))?.shift() ?? f : f));
}

// Of the entries a pull request that records a new whole run lists anew or above the base, those whose line stands
// nowhere in its file as it is (`texts`), or whose count passes what the file can hold (room()): no run could have
// found them, so the whole run's exception holds them not.
function invented(now, was, texts) {
  return [...now.listed].filter(([id, n]) => {
    const parts = partsOf(id), text = parts && texts(parts.file);
    if ((n.count ?? 0) <= (was.listed.get(id)?.count ?? 0) || (now.grown[id] ?? "").trim()) return false;
    return !parts || !text || (n.count ?? 0) > room(parts, text);
  }).map(([id]) => id);
}

// How many faults of an entry's kind its file can hold: for each line of the entry's text, as often as the replaced
// text stands in it, at least once; none where no such line stands.
function room(parts, text) {
  return text.split(/\r?\n/u).filter(l => collapse(l, 100) === parts.line).reduce((n, l) => n + Math.max(1, parts.original ? collapse(l, Infinity).split(parts.original).length - 1 : 1), 0);
}

// Whether the pull request records a new whole run: it changes no file of code or of the tests (`touched` false), and
// its baseline's stamp is not the base's.
export const recordsWhole = (now, was, touched) => Boolean(was) && !touched && JSON.stringify(now?.whole ?? null) !== JSON.stringify(was.whole ?? null);

// Of each fault (what became what), how many a pull request lowered in a file and is measured no longer to hold there
// (`still`, a fault not run counting as held): debt that left its file, as in a split, which another file may take up.
function movedOut(now, was, still) {
  const nowT = totals(now.listed), held = tally(holding(still)), out = new Map();
  for (const [k, n] of totals(was.listed)) {
    const drop = n - Math.max(nowT.get(k) ?? 0, held.get(k) ?? 0);
    if (drop > 0) out.set(whatOf(k), (out.get(whatOf(k)) ?? 0) + drop);
  }
  return out;
}

// The entries that joined the baseline since the base with no reason under "grown": [id]. None counts where the base
// has no baseline (the first). Where the pull request records a new whole run (recordsWhole()), what the run found
// stood on the base, and only an entry no run could have found counts (invented()). Else a kind's total may not grow
// past the base's but by the entries of it that grew with a reason, and by debt of the same fault that left another
// file (movedOut()), up to what the run found of it in this one (`found`: the survivors of the changed lines and of
// those left alone); where it does, those that grew with none count.
export function joinedUnsaid(now, was, touched = true, texts = () => null, found = [], still = []) {
  if (!was) return [];
  if (recordsWhole(now, was, touched)) return invented(now, was, texts);
  const wasT = totals(was.listed), grew = id => (now.listed.get(id)?.count ?? 0) - (was.listed.get(id)?.count ?? 0);
  const said = id => Boolean((now.grown[id] ?? "").trim()), pool = movedOut(now, was, still), seen = tally(known(found));
  return [...totals(now.listed)].flatMap(([k, n]) => {
    const ids = [...now.listed.keys()].filter(id => kindOf(id) === k && grew(id) > 0);
    const over = n - (wasT.get(k) ?? 0) - ids.filter(said).reduce((s, id) => s + grew(id), 0);
    const moved = Math.max(0, Math.min(over, pool.get(whatOf(k)) ?? 0, (seen.get(k) ?? 0) - (wasT.get(k) ?? 0)));
    pool.set(whatOf(k), (pool.get(whatOf(k)) ?? 0) - moved);
    return over - moved > 0 ? ids.filter(id => !said(id)) : [];
  });
}

// The baseline at `at` as the check reads it ({ listed, grown, whole }), from its text; null where there is none.
function baselineFrom(text, at) {
  if (text === null || text === undefined) return null;
  const b = parseBaseline(text, at, `write it again from the audit's whole run (node core/scripts/strength.mjs --whole), or take it back as the base holds it`);
  return { ...b, whole: tolerant(() => parseBounded(text).whole) ?? null };
}

// The tool run, as the row says, on the lines given: the report's text. It throws a Refused where the tool fails or
// writes none.
export function runTool(command, lines, cwd = ".") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strength-")), report = path.join(dir, "report.json");
  try {
    const args = command.map(w => w.replaceAll("{lines}", lines).replaceAll("{report}", report));
    const r = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8", stdio: ["ignore", "inherit", "inherit"], shell: false });
    if (r.error || r.status !== 0) refuse(`the mutation tool (${command.join(" ")}) ${r.error ? `could not start (${r.error.code ?? "no code given"})` : `ended with ${r.status ?? r.signal}`}`, `run the row's command by hand, mend what it says, and see that it writes its report to {report}`);
    if (!fs.existsSync(report)) refuse(`the mutation tool (${command.join(" ")}) wrote no report`, "put {report} in the row's command where the tool takes the path of its report in the mutation-testing-elements schema");
    return fs.readFileSync(report, "utf8");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const placed = f => `${f.file}:${f.line}`;
const said = f => `${f.mutatorName}: "${collapse(f.original, 40)}" ${f.replacement === "" ? "taken out" : `made "${collapse(f.replacement, 40)}"`}`;

// What the check says of a pull request's run, and whether it fails: { lines, fails }.
// `faults` are those of the changed lines; `still`, those watched() found on the lines the change left alone.
export function verdict({ faults, still = [], baseline, was, at, deleted, touched = true, texts = () => null }) {
  const c = counted(faults), lines = [`How strong the tests are, on the lines this pull request changes: ${c.line}.`];
  for (const t of deleted) lines.push(`A test file this pull request deletes: ${t}. Its description says why, under "Readings taken", and the review checks it.`);
  if (!baseline && was) {
    lines.push(`FAIL: ${at} stood on the base and this pull request takes it out. Mend: take it back as the base holds it (git checkout <the base> -- ${at}); only the audit's whole run writes it anew`);
    return { lines, fails: true };
  }
  if (!baseline) {
    lines.push(...faults.filter(f => SURVIVED.includes(f.status)).map(f => `survived: ${placed(f)}: ${said(f)}, and ${f.status === "NoCoverage" ? "no test runs that line" : "no test failed"}`));
    lines.push(`Reported only: there is no baseline at ${at} yet. The audit's whole run writes it (node core/scripts/strength.mjs --whole), and from then on a fault that survives on a changed line fails.`);
    return { lines, fails: false };
  }
  const news = unlisted(faults, baseline.listed, still), unsaid = joinedUnsaid(baseline, was, touched, texts, [...faults, ...still], still), cut = undercut(baseline, was, still);
  const unrun = still.filter(f => f.status === "Pending").length;
  if (c.pending) lines.push(`${c.pending} faults on the changed lines were not run (the tool's budget): they are not held here, and the next whole run reads them.`);
  if (unrun) lines.push(`${unrun} faults on lines this pull request left alone, of a kind it adds to or lowers, were not run (the tool's budget), even in a second run on their lines alone: a survivor on a changed line is not failed for them, and an entry is not lowered past them.`);
  for (const [k, n] of unsure(faults, baseline.listed, still)) lines.push(`Not measured: the fault ${k.split("\n").reverse().join(" in ")} survives on a changed line, and whether that adds to its debt turns on ${n} faults not run on lines this pull request left alone. The pull request says so under "Readings taken", and the next whole run reads it.`);
  for (const f of news) lines.push(`FAIL: ${placed(f)}: a fault put in on purpose (${said(f)}) survived, past what ${at} lists of that fault in ${f.file} with what the lines this pull request left alone still hold. Mend: write a test that fails on it and run the check again; where the fault only moved here from another file this pull request changes (a split), list "${f.id}" in ${at} under "listed" and that fault as many fewer in the file it left; only where the fault changes nothing the program does, list "${f.id}" in ${at} under "listed" with its count and under "grown" with that reason, say so in the pull request, and have a fresh session say there that it found no other way`);
  for (const id of unsaid) lines.push(`FAIL: ${at} lists "${id}" where the base did not, with no reason under "grown". Mend: take it out and write a test that catches the fault; where the fault only moved from another file this pull request changes, list it there as many fewer; or give its reason under "grown" (the fault changes nothing the program does), say so in the pull request, and have a fresh session say there that it found no other way`);
  for (const k of cut) lines.push(`FAIL: ${at} lists ${k.listed} of the fault ${k.kind.split("\n").reverse().join(" in ")}, where the base listed ${k.before}, and ${k.held} still survive on lines this pull request left alone${k.unrun ? `, ${k.unrun} of them faults the tool did not run (its budget), counted as surviving` : ""}. Mend: ${k.unrun ? "where the debt only moved (a split), raise the tool's budget where the check runs (for the core's mutate.mjs or stryker.mjs, MUTATE_BUDGET in the step of the workflow that runs the check, a change to a workflow with its two security reviews; else the budget the row's command sets) and run it again, so the faults not run are measured and those caught leave the count; else " : ""}list them again as the base did (a cleaning run, node core/scripts/strength.mjs --lower <file>, lowers an entry only to what still survives), or first write the tests that catch them`);
  return { lines, fails: news.length + unsaid.length + cut.length > 0 };
}

// The test files the pull request deletes.
const deletedTests = (base, tests) => (tests.length ? git(["diff", "--name-only", "--diff-filter=D", "--no-renames", tolerant(() => git(["merge-base", base, "HEAD"]).trim()) || base, "--", ...tests]).split("\n").filter(Boolean) : []);

const summary = lines => { if (process.env.GITHUB_STEP_SUMMARY) tolerant(() => fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.map(l => `- ${l}`).join("\n")}\n`)); };

// The files git lists under pathspecs, none a link.
const listed = specs => (specs.length ? git(["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...specs]).split("\0").filter(f => f && !tolerant(() => fs.lstatSync(f).isSymbolicLink())) : []);

// The project as the check reads it: its tool, its config, its code (each file of the config's "code" in a language
// the core knows by its ending, JavaScript's, TypeScript's or another's, that is no test) and the baseline's path. A
// change "touches" the code or the tests where it changes any file their pathspecs read (data the code reads too),
// but the two baselines and a text in Markdown, such as an audit's report.
function project() {
  const { text, home } = rulesHere(), tool = toolOf(text);
  const configAt = where(text);
  if (!fs.existsSync(unlinked(configAt))) return { tool, home, config: null };
  const config = parseConfig(fs.readFileSync(configAt, "utf8"), configAt), tests = new Set(listed(config.tests));
  const code = listed(config.code).filter(f => !tests.has(f) && [...CODE, ...OTHER].includes(path.posix.extname(f)));
  return { tool, home, config, code, at: baselineOf(config) };
}

// A pull request's run: the tool on the changed lines; then, where a kind's survivors there or its entries lowered
// call for it (needed()), on the lines the change left alone that could hold that kind (watched()), and once more on
// those of them whose faults it left unrun (again()).
function onPullRequest(p, base) {
  const changed = changedLines(base, p.code), deleted = deletedTests(base, p.config.tests), touched = touches(p, base);
  const baseline = baselineFrom(tolerant(() => fs.readFileSync(unlinked(p.at), "utf8")), p.at);
  const was = baselineFrom(tolerant(() => git(["show", `${base}:${p.at}`])), `${base}:${p.at}`);
  const read = f => (p.code.includes(f) ? tolerant(() => fs.readFileSync(unlinked(f), "utf8")) : null);
  const faults = measured(p, changed, baseline);
  const ids = baseline ? needed(faults, baseline, was, recordsWhole(baseline, was, touched)) : [];
  const kinds = new Set(ids.map(kindOf)), ofKinds = all => all.filter(f => kinds.has(kindOf(f.id)));
  // (the lines on which the first run found any fault, of any kind: those a second run would face again)
  const around = ids.length ? measured(p, watched(ids, read, changed), baseline) : [], found = new Map();
  for (const f of around) found.set(f.file, (found.get(f.file) ?? new Set()).add(f.line));
  const still = ids.length ? again(ofKinds(around), lines => ofKinds(measured(p, lines, baseline)), found) : [];
  const { lines, fails } = verdict({ faults, still, baseline, was, at: p.at, deleted, touched, texts: read });
  for (const l of lines) (l.startsWith("FAIL") ? console.error : console.log)(logged(l));
  summary(lines);
  return fails ? 1 : 0;
}

// The faults the tool finds on the lines given (a Map of file to a Set). Before the baseline stands, a tool that cannot
// run is said and fails nothing.
function measured(p, lines, baseline) {
  try { return lines.size ? faultsOf(runTool(p.tool.command, linesArg(lines)), lines) : []; } catch (e) {
    if (baseline || !(e instanceof Refused)) throw e;
    console.log(`Reported only, and not measured: ${e.message}`);
    return [];
  }
}

// Whether the pull request changes a file the code's or the tests' pathspecs read, but the baselines and Markdown.
function touches(p, base) {
  const from = tolerant(() => git(["merge-base", base, "HEAD"]).trim()) || base, record = new Set([p.at, p.config.baseline]);
  return git(["diff", "--name-only", "--no-renames", from, "--", ...p.config.code, ...p.config.tests]).split("\n").some(f => f && !record.has(f) && path.posix.extname(f) !== ".md");
}

// The whole run: the tool on every file of the code, and the baseline written from it, keeping the reasons of the
// entries that still stand.
function whole(p) {
  const faults = faultsOf(runTool(p.tool.command, p.code.join(",")), null), unrun = faults.filter(f => f.status === "Pending").length;
  if (unrun) refuse(`the mutation tool left ${unrun} faults not run, so the whole run is not whole`, "run it again with no budget (MUTATE_BUDGET unset for the core's tool)");
  const old = baselineFrom(tolerant(() => fs.readFileSync(unlinked(p.at), "utf8")), p.at);
  const listed = {};
  for (const f of faults.filter(f => SURVIVED.includes(f.status))) listed[f.id] = { count: (listed[f.id]?.count ?? 0) + 1 };
  const grown = Object.fromEntries(Object.entries(old?.grown ?? {}).filter(([id]) => id in listed));
  const head = tolerant(() => git(["rev-parse", "HEAD"]).trim()) ?? "unknown";
  const sorted = Object.fromEntries(Object.entries(listed).sort(([a], [b]) => a.localeCompare(b)));
  fs.mkdirSync(path.dirname(unlinked(p.at)), { recursive: true });
  fs.writeFileSync(unlinked(p.at), `${JSON.stringify({ whole: { day: new Date().toISOString().slice(0, 10), commit: head }, ...(Object.keys(grown).length ? { grown } : {}), listed: sorted }, null, 2)}\n`);
  console.log(`The whole run: ${counted(faults).line}. ${p.at} lists ${Object.keys(listed).length} faults that survive${old ? `, against ${old.listed.size} before` : ""}.`);
  return 0;
}

// The baseline's entries lowered by a run of `files` (`now`, each surviving id to its count): of each kind of those
// files, the ids that survive now, those it listed first, up to what it listed of the kind, so that debt which only
// moved keeps its place and debt whose fault no longer survives goes; an entry of another file stays as it was. A Map
// of id to count; nothing joins, and no kind's total grows.
export function lowered(listedMap, now, files) {
  const ours = id => files.some(f => id.startsWith(`survivor: ${f}: `)), room = totals(new Map([...listedMap].filter(([id]) => ours(id))));
  const out = new Map([...listedMap].filter(([id, n]) => !ours(id) && (n.count ?? 0) > 0).map(([id, n]) => [id, n.count]));
  for (const [id, c] of [...now].filter(([id]) => ours(id)).sort(([a], [b]) => Number(!listedMap.has(a)) - Number(!listedMap.has(b)))) {
    const take = Math.min(c, room.get(kindOf(id)) ?? 0);
    if (take > 0) { out.set(id, take); room.set(kindOf(id), room.get(kindOf(id)) - take); }
  }
  return out;
}

// A cleaning task's run: the tool on the files named, and the baseline's entries of those files lowered to what
// survives now. Nothing joins, and an entry of another file stays as it was.
function lower(p, named) {
  const files = named.split(",").filter(Boolean);
  const outside = files.find(f => !p.code.includes(f));
  if (outside !== undefined) refuse(`${outside} is no file of the code the shape check's config reads`, "name files of its \"code\" that are no tests, joined by commas");
  const old = baselineFrom(tolerant(() => fs.readFileSync(unlinked(p.at), "utf8")), p.at);
  if (!old) refuse(`there is no baseline at ${p.at} to lower`, "write it first with the audit's whole run (--whole)");
  const now = new Map(), found = faultsOf(runTool(p.tool.command, files.join(",")), null);
  const unrun = found.filter(f => f.status === "Pending").length;
  if (unrun) refuse(`the mutation tool left ${unrun} faults of ${files.join(", ")} not run, so what they would show is not known`, "run it again with no budget (MUTATE_BUDGET unset for the core's tool), or on fewer files at a time");
  for (const f of found.filter(f => SURVIVED.includes(f.status))) now.set(f.id, (now.get(f.id) ?? 0) + 1);
  const listed = Object.fromEntries([...lowered(old.listed, now, files)].map(([id, c]) => [id, { count: c }]));
  // (a reason given for an entry that left follows its kind's debt to the ids it is now listed under)
  const left = Object.keys(old.grown).filter(id => !(id in listed)), why = id => old.grown[id] ?? (old.listed.has(id) ? undefined : old.grown[left.find(g => kindOf(g) === kindOf(id))]);
  const grown = Object.fromEntries(Object.keys(listed).map(id => [id, why(id)]).filter(([, w]) => (w ?? "").trim()));
  fs.writeFileSync(unlinked(p.at), `${JSON.stringify({ ...(old.whole ? { whole: old.whole } : {}), ...(Object.keys(grown).length ? { grown } : {}), listed }, null, 2)}\n`);
  console.log(`${p.at} lists ${Object.keys(listed).length} faults that survive, against ${old.listed.size} before.`);
  return 0;
}

function main(argv) {
  const [option, files] = argv;
  const known = (option === "--whole" && argv.length === 1) || (option === "--lower" && argv.length === 2) || !argv.length;
  if (!known) refuse(`the check does not know ${argv.join(" ")}`, "run it with no option on a pull request, with --whole for the audit's whole run, or with --lower <file>[,<file>...] in a cleaning task");
  const p = project();
  if (!p.tool) { console.log(`The project names no mutation tool: its manifest has no row ${ROW}. The measure waits for that step (${p.home}setup/sync-notes/, "how strong the tests are").`); return 0; }
  if (p.tool.none !== undefined) { console.log(`The measure is left out: the project names no mutation tool${p.tool.none ? ` (${p.tool.none})` : ""}.`); return 0; }
  if (!p.config) { console.log("The measure waits for the shape check's config, whose \"code\" and \"tests\" it reads."); return 0; }
  if (option === "--whole") return whole(p);
  if (option === "--lower") return lower(p, files);
  const base = process.env.STRENGTH_BASE || "";
  if (!base) { console.log("No base (STRENGTH_BASE): no pull request's lines to measure."); return 0; }
  if (!/^\w[\w./^~-]*$/u.test(base) || tolerant(() => git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`])) === null) refuse(`STRENGTH_BASE (${JSON.stringify(base).slice(0, 80)}) is no commit here`, "set it to the pull request's base, such as origin/main, and fetch it first");
  return onPullRequest(p, base);
}

if (started(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { if (!(e instanceof Refused)) throw e; console.error(`FAIL: ${logged(e.message)}`); process.exitCode = 1; }
}
