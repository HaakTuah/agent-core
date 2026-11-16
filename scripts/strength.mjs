// How strong the tests are (modules/code-shape.md, "How strong the tests are"; #253), for every project that takes the
// core: whether the tests would fail if a fault were put into the code on purpose, measured on the lines a pull request
// changes. The project's *mutation tool* (its manifest's row; the core's AGENTS.md names its own, mutate.mjs beside
// this file) puts the faults in and writes what it found in the open form of a mutation report (the
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
// may join the baseline only with that reason, or in the pull request that records a new whole run. The whole run is
// the audit's, outside the suite (modules/cleaning.md): --whole runs the tool on every file of the code and writes the
// baseline from it. A test file the pull request deletes is named, for its description to say why (the review reads
// it, modules/review-guidelines.md). A project whose row says `none` has the measure left out; one with no row is told
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
  for (const [file, home] of [["core-manifest.md", "core/"], ["AGENTS.md", ""]]) {
    const text = tolerant(() => fs.readFileSync(path.join(root, file), "utf8"));
    if (text !== null) return { text, home };
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

// The faults of a report, on the lines wanted (a Map of file to a Set; null for all): each { file, line, id, status,
// mutatorName, replacement }. It throws a Refused where the report is not in the form.
export function faultsOf(text, wanted, root = ".") {
  let r;
  try { r = JSON.parse(text); } catch { refuse("the mutation tool's report could not be read as JSON", "have the tool write its report in the mutation-testing-elements schema (Stryker's \"json\" reporter writes it) to the path {report} stands for"); }
  if (!r || typeof r.files !== "object" || r.files === null) refuse("the mutation tool's report has no \"files\"", "have the tool write the mutation-testing-elements schema, whose \"files\" holds each file's \"source\" and \"mutants\"");
  const out = [];
  for (const [name, f] of Object.entries(r.files)) {
    const file = (path.isAbsolute(name) ? path.relative(root, name) : name).replace(/\\/gu, "/");
    if (typeof f?.source !== "string" || !Array.isArray(f.mutants) || !f.mutants.every(aMutant)) refuse(`the mutation tool's report holds ${file} in a form the check does not read`, "have the tool write the mutation-testing-elements schema: each file a \"source\" and \"mutants\", each with \"mutatorName\", \"location\" and \"status\"");
    for (const m of f.mutants) {
      if (wanted && !wanted.get(file)?.has(m.location.start.line)) continue;
      out.push({ file, line: m.location.start.line, id: idOf(file, f.source, m), status: m.status, mutatorName: m.mutatorName, original: originalOf(f.source.split(/\r?\n/u), m.location), replacement: m.replacement ?? "" });
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

// An id's parts: its file, its line's text and what became what.
const partsOf = id => { const m = /^survivor: (.+?): (.*) (\[.*\])$/u.exec(id); return m ? { file: m[1], line: m[2], what: m[3] } : null; };

// The entries whose line no longer stands in their file as it is now (`texts`, a function of a file to its text or
// null): a Map of id to its count. A fault on a line a pull request rewrote may claim one of these.
export function moved(listedMap, texts) {
  const out = new Map(), lines = new Map();
  for (const [id, n] of listedMap) {
    const parts = partsOf(id);
    if (!parts) continue;
    if (!lines.has(parts.file)) lines.set(parts.file, new Set((texts(parts.file) ?? "").split(/\r?\n/u).map(l => collapse(l, 100))));
    if (!lines.get(parts.file).has(parts.line)) out.set(id, n.count ?? 0);
  }
  return out;
}

// The unchanged lines of the files a change touched whose text is that of a listed entry (`texts`, a function of a file
// to its text; `changed`, a Map of file to the Set of changed lines): a Map of file to a Set of lines. The tool is run
// on them too, so that what of each entry they still hold is measured, never guessed (heldBy()).
export function witnesses(listedMap, texts, changed) {
  const out = new Map();
  for (const id of listedMap.keys()) {
    const parts = partsOf(id), text = parts && changed.has(parts.file) && texts(parts.file);
    if (!text) continue;
    text.split(/\r?\n/u).forEach((l, i) => {
      if (changed.get(parts.file).has(i + 1) || collapse(l, 100) !== parts.line) return;
      if (!out.has(parts.file)) out.set(parts.file, new Set());
      out.get(parts.file).add(i + 1);
    });
  }
  return out;
}

// What of each entry the lines a change left alone still hold: the survivors the tool found on them (`faults`, those of
// witnesses()), and those it left unrun, which are not known to be caught, each up to the count listed. A repeated
// line on a changed line cannot use them.
export function heldBy(listedMap, faults) {
  const out = new Map();
  for (const f of faults.filter(f => [...SURVIVED, "Pending"].includes(f.status) && listedMap.has(f.id))) out.set(f.id, Math.min((out.get(f.id) ?? 0) + 1, listedMap.get(f.id).count ?? 0));
  return out;
}

// The survivors no entry of the baseline claims: each id's count, less what unchanged lines hold of it (heldBy()),
// against the count listed; then, of what is left, a
// survivor claims an entry of `gone` (moved()) of the same file and the same fault, where one is left.
export function unlisted(faults, listedMap, gone = new Map(), held = new Map()) {
  const counts = new Map(), left = [], free = new Map(gone);
  for (const f of faults.filter(f => SURVIVED.includes(f.status))) counts.set(f.id, [...(counts.get(f.id) ?? []), f]);
  for (const [id, all] of counts) left.push(...all.slice(Math.max(0, (listedMap.get(id)?.count ?? 0) - (held.get(id) ?? 0))));
  return left.filter(f => {
    const mine = partsOf(f.id), fit = [...free].find(([id, c]) => c > 0 && partsOf(id)?.file === mine?.file && partsOf(id)?.what === mine?.what);
    if (fit) free.set(fit[0], fit[1] - 1);
    return !fit;
  }).filter((f, i, all) => all.findIndex(g => g.id === f.id) === i);
}

// The entries that joined the baseline since the base with no reason under "grown": [id]. None counts where the base
// has no baseline (the first), or where the pull request records a new whole run and changes no file of code or of the
// tests (`touched` false), so that what the run found stood on the base.
export function joinedUnsaid(now, was, touched = true) {
  if (!was || (!touched && JSON.stringify(now.whole ?? null) !== JSON.stringify(was.whole ?? null))) return [];
  return [...now.listed].filter(([id, n]) => (n.count ?? 0) > (was.listed.get(id)?.count ?? 0) && !(now.grown[id] ?? "").trim()).map(([id]) => id);
}

// The baseline at `at` as the check reads it ({ listed, grown, whole }), from its text; null where there is none.
function baselineFrom(text, at) {
  if (text === null || text === undefined) return null;
  const b = parseBaseline(text, at, `write it again from the audit's whole run (node core/scripts/strength.mjs --whole), or take it back as the base holds it`);
  return { ...b, whole: tolerant(() => JSON.parse(text).whole) ?? null };
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
export function verdict({ faults, baseline, was, at, deleted, touched = true, gone = new Map(), held = new Map() }) {
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
  const news = unlisted(faults, baseline.listed, gone, held), unsaid = joinedUnsaid(baseline, was, touched);
  if (c.pending) lines.push(`${c.pending} faults on the changed lines were not run (the tool's budget): they are not held here, and the next whole run reads them.`);
  for (const f of news) lines.push(`FAIL: ${placed(f)}: a fault put in on purpose (${said(f)}) survived, and ${at} does not list it. Mend: write a test that fails on it and run the check again; only where the fault changes nothing the program does, list "${f.id}" in ${at} under "listed" with its count and under "grown" with that reason, say so in the pull request, and have a fresh session say there that it found no other way`);
  for (const id of unsaid) lines.push(`FAIL: ${at} lists "${id}" where the base did not, with no reason under "grown". Mend: take it out and write a test that catches the fault, or give its reason under "grown" (the fault changes nothing the program does), say so in the pull request, and have a fresh session say there that it found no other way`);
  return { lines, fails: news.length + unsaid.length > 0 };
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

// A pull request's run. Before the baseline stands, a tool that cannot run is said and fails nothing.
function onPullRequest(p, base) {
  const changed = changedLines(base, p.code), deleted = deletedTests(base, p.config.tests);
  const baseline = baselineFrom(tolerant(() => fs.readFileSync(unlinked(p.at), "utf8")), p.at);
  const was = baselineFrom(tolerant(() => git(["show", `${base}:${p.at}`])), `${base}:${p.at}`);
  const read = f => (p.code.includes(f) ? tolerant(() => fs.readFileSync(unlinked(f), "utf8")) : null);
  const watched = baseline ? witnesses(baseline.listed, read, changed) : new Map();
  const both = new Map([...changed].map(([f, l]) => [f, new Set([...l, ...(watched.get(f) ?? [])])]));
  let found = [];
  try { if (changed.size) found = faultsOf(runTool(p.tool.command, linesArg(both)), both); } catch (e) {
    if (baseline || !(e instanceof Refused)) throw e;
    console.log(`Reported only, and not measured: ${e.message}`);
  }
  const faults = found.filter(f => changed.get(f.file)?.has(f.line)), held = heldBy(baseline?.listed ?? new Map(), found.filter(f => !changed.get(f.file)?.has(f.line)));
  const from = tolerant(() => git(["merge-base", base, "HEAD"]).trim()) || base;
  const record = new Set([p.at, p.config.baseline]);
  const touched = git(["diff", "--name-only", "--no-renames", from, "--", ...p.config.code, ...p.config.tests]).split("\n").some(f => f && !record.has(f) && path.posix.extname(f) !== ".md");
  const gone = baseline ? moved(baseline.listed, read) : new Map();
  const { lines, fails } = verdict({ faults, baseline, was, at: p.at, deleted, touched, gone, held });
  for (const l of lines) (l.startsWith("FAIL") ? console.error : console.log)(l);
  summary(lines);
  return fails ? 1 : 0;
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
  const ours = id => files.some(f => id.startsWith(`survivor: ${f}: `));
  const listed = Object.fromEntries([...old.listed].map(([id, n]) => [id, ours(id) ? Math.min(n.count ?? 0, now.get(id) ?? 0) : n.count ?? 0]).filter(([, c]) => c > 0).map(([id, c]) => [id, { count: c }]));
  const grown = Object.fromEntries(Object.entries(old.grown).filter(([id]) => id in listed));
  fs.writeFileSync(unlinked(p.at), `${JSON.stringify({ ...(old.whole ? { whole: old.whole } : {}), ...(Object.keys(grown).length ? { grown } : {}), listed }, null, 2)}\n`);
  console.log(`${p.at} lists ${Object.keys(listed).length} faults that survive, against ${old.listed.size} before.`);
  return 0;
}

function main(argv) {
  const [option, files] = argv;
  const known = (option === "--whole" && argv.length === 1) || (option === "--lower" && argv.length === 2) || !argv.length;
  if (!known) refuse(`the check does not know ${argv.join(" ")}`, "run it with no option on a pull request, with --whole for the audit's whole run, or with --lower <file>[,<file>...] in a cleaning task");
  const p = project();
  if (!p.tool) { console.log(`The project names no mutation tool: its manifest has no row ${ROW}. The measure waits for that step (${p.home}setup/sync-notes.md, "how strong the tests are").`); return 0; }
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
  catch (e) { if (!(e instanceof Refused)) throw e; console.error(`FAIL: ${e.message}`); process.exitCode = 1; }
}
