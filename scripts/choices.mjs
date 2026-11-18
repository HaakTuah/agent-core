// The records of the choices that are hard to undo (tasks/choices.md; core archive 222 and 231): where a project
// keeps them, what they hold, whether the pass over them, twice a year, is due, and whether a sign written in a measure
// has tripped. Where they are: the *choice records*, a row of the manifest's slots or, in the core, a slot of its
// AGENTS.md; left out, the starter kit's file, KIT. A record is a heading "## Choice: " and what was chosen, its sign
// on a line that opens "Reopens it:", and, where that sign is a measure a check keeps, a line that opens "Trips when:"
// with each condition in backticks: one of MEASURES, an operator of OPS and a number (`files > 150`); the file's line
// "Read whole:" holds the day of its last pass, in the form 2026-11-15. The scheduled look (look.mjs, beside this file)
// keeps one issue open while the pass is due (`look`), and one while a condition holds (`signs`), reading the measures
// from what the shape check reads (dose.mjs, reading()): it compares numbers and never runs anything a records file
// says, which is no protected file while the look's job holds a token that writes issues (#330). A session that takes
// either issue runs this script to find again what stands, and writes the day on the line "Read whole:" once its pass
// is done. A record is argued on lines that open "Looked for:", "The blind pick:" and "The judgment:" (ARGUED; #515):
// with CHOICES_BASE set, as the copies check sets it to the commit a pull request merges into, it is the records'
// check, which fails a record the pull request adds without one of them and lists, never fails, one that stood there
// (AGENTS.md, "Nothing locks a project"). It reads only, posts nothing and exits 0, save where the records cannot be
// read or that check fails. git and Node's own modules.
//
//   node core/scripts/choices.mjs      from a project's root: each record, whether it names its sign and is argued,
//                                      each condition and the number it reads, and whether the pass is due (in the
//                                      core: node scripts/choices.mjs); with CHOICES_BASE=<a commit>, the check
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { reading, rulesOf } from "./dose.mjs";
import { MEND } from "./mend.mjs";
import { started } from "./started.mjs";

export const KIT = "docs/choices.md";
export const TITLE = "Choices to read again";
// The issue of the signs written in a measure: one that holds, or a line "Trips when:" that names no measure.
export const TRIPPED = "A choice's measured sign to act on";
// The most conditions, and records naming no measure, its issue lists one by one.
export const LISTED = 30;
// Twice a year: the pass is due once the day on the line "Read whole:" is this many days old.
export const DAYS = 182;

// The path a project's rules name for its *choice records* (the manifest's row, or a line of the core's AGENTS.md that
// gives the slot), else KIT; null where the name is no plain path inside the project.
export function where(rules) {
  const named = /\*choice records\*\s*(?:\|\s*|:\s*)`([^`\n]+)`/u.exec(String(rules ?? ""))?.[1] ?? KIT;
  return /^[\w][\w.-]*(\/[\w][\w.-]*)*$/u.test(named) ? named : null;
}

// (control characters, and those that reorder or hide text, so a name reads as its bytes)
const plain = text => String(text ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/gu, " ").trim().slice(0, 120);

// The measures a line "Trips when:" may name, each [what it counts, how it is read from the dose's reading]: numbers
// the shape check reads on every run (shape.mjs, survey()), never a command.
export const MEASURES = {
  files: ["files of code the shape check reads", r => r.found.read.files],
  functions: ["functions it reads", r => r.found.read.functions],
  imports: ["imports it reads", r => r.found.read.imports],
  listed: ["old breaches its baseline lists", r => r.listed],
  debt: ["the share of what it reads that its baseline lists, in percent", r => (r.read > 0 ? 100 * r.listed / r.read : 0)],
  cycles: ["imports that lie on a cycle between files", r => [...r.found.entries.keys()].filter(id => id.startsWith("cycle: ")).length],
  unnamed: ["files of code that lie in no system", r => r.found.read.unnamed],
};
export const OPS = { ">": (a, b) => a > b, ">=": (a, b) => a >= b, "<": (a, b) => a < b, "<=": (a, b) => a <= b };
const CONDITION = /^([a-z]+) *(>=|<=|>|<) *(\d{1,9}(?:\.\d{1,3})?)$/u;
const measured = said => { const m = CONDITION.exec(said); return m && Object.hasOwn(MEASURES, m[1]) ? { measure: m[1], op: m[2], limit: Number(m[3]) } : null; };
// (a number as shown: whole, or to three places; the comparison takes it exact)
const figure = n => String(Math.round(n * 1000) / 1000);
const shown = text => `\`${plain(text).replace(/`/gu, "'")}\``;

// A record's line "Trips when:": the conditions it names that the look reads, and, quoted, what else it holds in
// backticks, or the line itself where it holds none.
function tripsOf(body) {
  const line = /^[ \t]*(?:[-*][ \t]+)?(?:\*\*)?Trips when:(?:\*\*)?(.*)$/mu.exec(body)?.[1];
  if (line === undefined) return { conditions: [], unknown: [] };
  const said = [...line.matchAll(/`([^`\n]*)`/gu)].map(m => m[1].trim());
  if (!said.length) return { conditions: [], unknown: [line.trim()] };
  return { conditions: said.map(measured).filter(Boolean), unknown: said.filter(c => !measured(c)) };
}

// The lines a record is argued on (tasks/choices.md, "A choice that is hard to undo gets a record"; #515): the
// challenger's search for what the list lacks, the pick of a session that never saw the record, and the judge's.
export const ARGUED = ["Looked for:", "The blind pick:", "The judgment:"];
// (the label bold whole, or plain and not followed by the bold's close, then content: an empty bold label is none)
const labelled = label => { const l = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"); return `^[ \\t]*(?:[-*][ \\t]+)?(?:\\*\\*${l}\\*\\*|${l}(?!\\*))[ \\t]*`; };
const opens = (body, label) => new RegExp(`${labelled(label)}\\S`, "mu").test(body);

// The heading's end of the record of what a project would be built on today (tasks/choices.md, "What the project would
// be built on today"; #515), whose line "The suggestion:" names the issue filed to the project's owner.
export const TODAY = /judged again as if written today\s*$/u;

// What a records file holds: each record's name (cut to its printed length), whether its whole heading ends as TODAY's
// (`today`), whether it names its sign, the lines of ARGUED it lacks (`lacks`), whether it records a choice already made
// (a line "Stood before:"), the issue its line "The suggestion:" names ("#12", or null), and its line "Trips when:"
// (`conditions`, `unknown`); the day of the last pass (null where the line is missing or holds no day); and how many
// lines are still left to fill in (FILL IN). A record whose heading is still the starter kit's, left to fill in, is no
// record yet, so a new project's file makes no pass due.
export function parse(text) {
  const t = String(text ?? "").replace(/\r\n/gu, "\n");
  const heads = [...t.matchAll(/^## Choice: (.+)$/gmu)];
  const records = heads.map((m, i) => {
    const body = t.slice(m.index + m[0].length, i + 1 < heads.length ? heads[i + 1].index : t.length).split(/^#{1,2} /mu)[0];
    return { name: plain(m[1]), today: TODAY.test(m[1]), sign: opens(body, "Reopens it:"), lacks: ARGUED.filter(label => !opens(body, label)),
      stood: opens(body, "Stood before:"), suggestion: new RegExp(`${labelled("The suggestion:")}(#\\d+)\\b`, "mu").exec(body)?.[1] ?? null, ...tripsOf(body) };
  }).filter(r => !r.name.startsWith("FILL IN:"));
  const read = /^(?:\*\*)?Read whole:(?:\*\*)?[ \t]*(\d{4}-\d\d-\d\d)\b/mu.exec(t)?.[1] ?? null;
  return { records, read: read && Number.isFinite(Date.parse(`${read}T00:00:00Z`)) ? read : null, open: (t.match(/FILL IN:/gu) ?? []).length };
}

// Whole days from a day (2026-11-15) to a time.
const daysSince = (day, at) => Math.floor((Date.parse(at) - Date.parse(`${day}T00:00:00Z`)) / 86400000);

// Why the pass is due, as one line, or null where it is not: no record yet, or the last pass less than DAYS ago.
export function due(found, at) {
  if (!found.records.length) return null;
  if (!found.read) return "its line \"Read whole:\" holds no day, so no pass is known";
  const days = daysSince(found.read, at);
  return days >= DAYS ? `its line "Read whole:" says ${found.read}, ${days} days before ${at.slice(0, 10)}` : null;
}

// The most a records file is read to: a handful of records a year is a few KB.
export const MOST = 256 * 1024;

// The records of the project at `root`, read from inside it alone: { file, text } (text null where there is no such
// file), or { file, unread } where its name or the file cannot be read so: no link is followed, at the file or at any
// folder on its way, and no file past MOST is read.
export function records(rules, root = ".") {
  const file = where(rules);
  if (!file) return { file: null, unread: "the *choice records* named in the rules is no plain path inside the project" };
  const parts = file.split("/");
  for (let i = 1; i <= parts.length; i++) {
    let stat;
    try { stat = fs.lstatSync(path.join(root, ...parts.slice(0, i))); } catch { return { file, text: null }; }
    if (stat.isSymbolicLink()) return { file, unread: `${file} is no regular file (a link stands on its way)` };
    if (i === parts.length && !stat.isFile()) return { file, unread: `${file} is no regular file (a folder)` };
    if (i === parts.length && stat.size > MOST) return { file, unread: `${file} is past ${MOST} bytes` };
  }
  try { return { file, text: fs.readFileSync(path.join(root, file), "utf8") }; } catch { return { file, unread: `${file} could not be read` }; }
}

// The scheduled look's reader (look.mjs, DUE): the pass's issue, its body null where nothing is due, so the look closes
// one it keeps; `unread` where the records could not be read, so it leaves that issue as it stands.
export function look({ manifest, at, root = "." }) {
  const { rules, home } = rulesOf(manifest, root);
  const got = records(rules, root);
  if (got.unread) return { title: TITLE, body: null, unread: got.unread };
  if (got.text === null) return { title: TITLE, body: null };
  const found = parse(got.text), why = due(found, at);
  if (!why) return { title: TITLE, body: null };
  const unsigned = found.records.filter(r => !r.sign).length, unknown = found.records.filter(r => r.unknown.length).length;
  return { title: TITLE, body: `The pass over the choices that are hard to undo is due (\`${home}tasks/choices.md\`, "What reopens a choice"): \`${got.file}\` holds ${found.records.length} records, and ${why}; the pass falls ${DAYS} days after the last.${unsigned ? ` ${unsigned} of them name no sign on a line "Reopens it:".` : ""}${unknown ? ` ${unknown} of them hold, on their line "Trips when:", what names no measure the look reads.` : ""} A fresh reader goes through each record as that rule says, files an issue for the owner, labelled needs-owner, for each choice whose sign has tripped or for which a plainly better option exists now, save one the issue \"${TRIPPED}\" already names, and writes the day of its pass on that line, in a pull request of its own. \`node ${home}scripts/choices.mjs\` lists the records.` };
}

// Each condition of the records that holds today, with the number read: [{ name, measure, op, limit, value }].
export const tripped = (found, r) => found.records.flatMap(rec => rec.conditions.map(c => ({ name: rec.name, ...c, value: MEASURES[c.measure][1](r) })))
  .filter(c => OPS[c.op](c.value, c.limit));

// The measured signs as the look reads them: the records, the dose's reading, and `unread` where either cannot be read.
function measuredSigns(manifest, root) {
  const { rules, home } = rulesOf(manifest, root);
  const got = records(rules, root);
  if (got.unread) return { unread: got.unread };
  const found = parse(got.text ?? "");
  if (!found.records.some(rec => rec.conditions.length)) return { got, found, home, r: null };
  let r;
  try { r = reading(rules, root); } catch (e) { return { unread: `the shape check could not be read (${String(e.message).split(". Mend: ")[0]})` }; }
  if (!r) return { unread: "a record names a measure, and the shape check has no config here to read it from" };
  // (a project whose code the shape check does not read, in another language, would read 0 and never trip)
  return r.found.read.files > 0 ? { got, found, home, r } : { unread: "a record names a measure, and the shape check reads no file of code here" };
}

// The text of the issue of the signs written in a measure: each condition that holds, each line that names no measure,
// and what its session does about each.
export function trippedBody(file, held, found, home) {
  const unknown = found.records.filter(rec => rec.unknown.length);
  // (a few lines each, and three of a record's unknown conditions, the rest counted, so the body stays under 30 000
  // characters, far under GitHub's limit of 65 536, however many a file of MOST bytes holds)
  const some = (list, line) => [...list.slice(0, LISTED).map(line), ...(list.length > LISTED ? [`- and ${list.length - LISTED} more: \`node ${home}scripts/choices.mjs\` lists them`] : [])];
  const rule = `\`${home}tasks/choices.md\`, "What reopens a choice"`;
  return [...(held.length ? [`A choice's sign, written in a measure the shape check keeps, holds today in \`${file}\` (${rule}):`,
    ...some(held, c => `- ${shown(c.name)}: \`${c.measure} ${c.op} ${c.limit}\`, and it reads ${figure(c.value)} ${MEASURES[c.measure][0]}.`), ""] : []),
  ...(unknown.length ? [`A line "Trips when:" in \`${file}\` names what is no measure the look reads, so that sign is not read (${rule}; the measures: ${Object.keys(MEASURES).join(", ")}):`,
    ...some(unknown, rec => `- ${shown(rec.name)}: ${rec.unknown.slice(0, 3).map(shown).join(", ")}${rec.unknown.length > 3 ? `, and ${rec.unknown.length - 3} more` : ""}`), ""] : []),
  [held.length ? "A session takes this issue: for each choice whose sign holds, it writes in a comment here a fresh record that compares the options, staying as it is among them, with the gain and what the move would cost, and labels this issue needs-owner in place of queued; no session makes the choice. Where the owner keeps it, the session that acts on the answer writes its sign anew in a pull request." : "",
    unknown.length ? "Each line that names no measure is mended in a pull request: to a measure the look reads, or taken out where the sign is none a check keeps." : "",
    `This issue closes on the look's next run once nothing above stands, and opens again as queued if something comes back. \`node ${home}scripts/choices.mjs\` reads the signs as they stand.`].filter(Boolean).join(" ")].join("\n");
}

// What a line of that issue's lists stands for, apart from the numbers read today: a choice and its condition, or a
// choice and what names no measure; null for the count of the rest. The look compares these (look.mjs, updating), so a
// number that moves changes nothing, and a choice the issue did not name before puts it back to queued.
const READS = ", and it reads ";
export const signKey = line => (line.startsWith("- and ") ? null : line.includes(READS) ? line.slice(0, line.indexOf(READS)) : line);

// The scheduled look's reader of the signs written in a measure (look.mjs, DUE): its issue's body null where none
// holds and every line "Trips when:" names measures alone, so the look closes one it keeps; `unread` where the records
// or the measures could not be read; `requeue`, the key of each line of its lists (signKey).
export function signs({ manifest, root = "." }) {
  const s = measuredSigns(manifest, root);
  if (s.unread) return { title: TRIPPED, body: null, unread: s.unread };
  const held = s.r ? tripped(s.found, s.r) : [];
  const stands = held.length || s.found.records.some(rec => rec.unknown.length);
  return { title: TRIPPED, body: stands ? trippedBody(s.got.file, held, s.found, s.home) : null, requeue: signKey };
}

// One record as the script prints it: its name, whether it names its sign, and each condition of its line "Trips
// when:" with the number read (`r`, the dose's reading; a string where the measures could not be read).
function recordLine(rec, r) {
  const read = c => (typeof r === "string" ? `${c.measure} ${c.op} ${c.limit} (${r})` : `${c.measure} ${c.op} ${c.limit} (${figure(MEASURES[c.measure][1](r))} now${OPS[c.op](MEASURES[c.measure][1](r), c.limit) ? ": it holds" : ""})`);
  return [`- ${rec.name}${rec.sign ? "" : ": names no sign on a line \"Reopens it:\""}`,
    ...(rec.lacks.length ? [`  argued on no line that opens ${rec.lacks.map(l => `"${l}"`).join(", ")}`] : []),
    ...(rec.conditions.length ? [`  trips when: ${rec.conditions.map(read).join("; ")}`] : []),
    ...(rec.unknown.length ? [`  names no measure this reads, on its line "Trips when:": ${rec.unknown.map(shown).join(", ")} (the measures: ${Object.keys(MEASURES).join(", ")})`] : [])];
}

// What the script prints: each record, and whether the pass is due.
export function report(got, at, r = "the measures were not read") {
  if (got.unread) return `The choice records could not be read: ${got.unread}.`;
  if (got.text === null) return `No choice records at \`${got.file}\` yet: a project records there each choice that is hard to undo (tasks/choices.md).`;
  const found = parse(got.text), why = due(found, at);
  return [`\`${got.file}\`: ${found.records.length} records${found.read ? `, read whole on ${found.read}` : ""}${found.open ? `, ${found.open} lines still marked FILL IN` : ""}.`,
    ...found.records.flatMap(rec => recordLine(rec, r)),
    why ? `The pass over them is due: ${why}.` : found.records.length ? `The pass over them is not due until ${DAYS} days after ${found.read}.` : "No record yet, so no pass is due."].join("\n");
}

// The records' check (#515): of the records at the head (`head`, a records file's text), those the base (`base`, its
// text there, null where it held none) did not hold by name and that lack a line of ARGUED fail, save one that records
// a choice already made (tasks/choices.md, "The choices a project already made are recorded too"); those it held, and
// those, are listed and never fail. { failed, listed }, each a list of records.
export function argued(head, base) {
  const before = new Set(parse(base ?? "").records.map(r => r.name));
  const lacking = parse(head ?? "").records.filter(r => r.lacks.length), old = r => before.has(r.name) || r.stood;
  return { failed: lacking.filter(r => !old(r)), listed: lacking.filter(old) };
}

// What the base reads as where it held a file as a link (#541): a case of its own, apart from no commit (undefined)
// and no file (null).
export const LINK = Symbol("a link");

// A file's text at a commit, read from git, or null where the commit does not hold it as a file of at most MOST bytes;
// undefined where `commit` is no commit here, or a name git would read as an option; LINK where the file is a link there.
export function atCommit(commit, file, root = ".") {
  const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: MOST * 2 });
  // (a name that opens with "-" would be read by git as an option: it is no commit)
  if (String(commit).startsWith("-")) return undefined;
  try { git(["rev-parse", "--verify", "-q", `${commit}^{commit}`]); } catch { return undefined; }
  try {
    // (a link at the base is no file the records were read from there, as records() reads none at the head)
    if (/^120000 /u.test(git(["ls-tree", commit, "--", file]))) return LINK;
    if (git(["cat-file", "-t", `${commit}:${file}`]).trim() !== "blob" || Number(git(["cat-file", "-s", `${commit}:${file}`])) > MOST) return null;
    return git(["show", `${commit}:${file}`]);
  } catch { return null; }
}

// The records at the base, by the path the base's own rules name (its manifest's row, or the core's AGENTS.md), so a
// pull request that moves them reads the records they held: their text, null where the base held none, undefined where
// `base` is no commit here, and LINK where the records, or the file that names them, were a link there.
export function baseRecords(base, root = ".") {
  const manifest = atCommit(base, "core-manifest.md", root);
  if (manifest === undefined || manifest === LINK) return manifest;
  const rules = manifest ?? atCommit(base, "AGENTS.md", root);
  if (rules === LINK) return LINK;
  const file = where(rules ?? "");
  return file ? atCommit(base, file, root) : null;
}

// What the check prints and whether it failed: `got`, the records at the head (records()); `base`, the commit the
// change merges into ("" for none). [lines, failed].
export function checkOf(got, base, root = ".") {
  const rule = 'core/tasks/choices.md, "A choice that is hard to undo gets a record"';
  const then = base ? baseRecords(base, root) : undefined;
  if (got.unread) {
    const was = typeof then === "string";
    return [[was ? `FAIL: the choice records could not be read (${got.unread}), and the base held them as a file. ${MEND}name a regular file inside the project as the *choice records*, under ${MOST} bytes, as the base had it.`
      : `The choice records could not be read (${got.unread}), as at the base: nothing to check.`], was];
  }
  if (got.text === null) return [["No choice records here: nothing to check."], false];
  // (a base that held the records as a link: what the link led to is not read, so each record is listed, as with no
  // base, and none fails, since any of them may have stood there: AGENTS.md, "Nothing locks a project")
  const unlisted = why => [[`${why}, so no record is read as one this change adds.`, ...argued(got.text, got.text).listed.map(r => `- listed, not failed: "${r.name}", argued on no line that opens ${r.lacks.map(l => `"${l}"`).join(", ")}`)], false];
  if (then === undefined) return unlisted(`No base to compare with${base ? ` (${base} is no commit here)` : ""}`);
  if (then === LINK) return unlisted(`The base held the records as a link, which is not read`);
  const { failed, listed } = argued(got.text, then);
  return [[...failed.map(r => `FAIL: \`${got.file}\`: the record "${r.name}", which this change adds, is argued on no line that opens ${r.lacks.map(l => `"${l}"`).join(", ")}. ${MEND}argue it as ${rule}, says, each on its own line in the record: "Looked for:", the challenger's search for options the list lacks, with the writer's answer to each; "The blind pick:", the pick of a fresh session given the problem and the criteria and never the record; "The judgment:", the decision of a fresh session that wrote no part of it. A record of a choice the project had already made, as a first audit writes it, takes instead a line that opens "Stood before:", saying when.`),
    ...listed.map(r => `- listed, not failed: "${r.name}" ${r.stood ? "records a choice already made" : "stood before this change"}, argued on no line that opens ${r.lacks.map(l => `"${l}"`).join(", ")}`),
    `\`${got.file}\`: ${failed.length ? `${failed.length} record${failed.length === 1 ? "" : "s"} this change adds not argued in full` : "every record this change adds is argued in full"}${listed.length ? `; ${listed.length} that stood before listed` : ""}.`], failed.length > 0];
}

// The dose's reading the script reads the measures from, or why it could not.
function measuresHere(rules) {
  try { return reading(rules) ?? "the shape check has no config here"; } catch (e) { return `the shape check could not be read: ${String(e.message).split(". Mend: ")[0]}`; }
}

if (started(import.meta.url)) {
  let manifest = null;
  try { manifest = fs.readFileSync("core-manifest.md", "utf8"); } catch { /* (the core's own AGENTS.md, or the kit's file) */ }
  const { rules } = rulesOf(manifest, ".");
  const got = records(rules);
  if (process.env.CHOICES_BASE !== undefined) {
    const [lines, failed] = checkOf(got, process.env.CHOICES_BASE);
    console.log(lines.join("\n"));
    if (failed) process.exitCode = 1;
  } else {
    const named = !got.unread && got.text !== null && parse(got.text).records.some(rec => rec.conditions.length);
    console.log(report(got, new Date().toISOString(), named ? measuresHere(rules) : undefined));
    if (got.unread) { console.error(`FAIL: the choice records could not be read (${got.unread}). Mend: name a regular file inside the project as the *choice records* in the manifest's slots, or leave the row out for ${KIT}`); process.exitCode = 1; }
  }
}
