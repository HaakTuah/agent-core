// The records of the choices that are hard to undo (modules/choices.md; core archive 222): where a project keeps them,
// what they hold, and whether the pass over them, twice a year, is due. Where they are: the *choice records*, a row of
// the manifest's slots or, in the core, a slot of its AGENTS.md; left out, the starter kit's file, KIT. A record is a
// heading "## Choice: " and what was chosen, its sign on a line that opens "Reopens it:"; the file's line "Read whole:"
// holds the day of its last pass, in the form 2026-11-15. The scheduled look (look.mjs, beside this file) keeps one
// issue open while the pass is due (`due`); a session that takes it runs this script to find again what is due, and
// writes the day on that line once its pass is done. It reads only, posts nothing and exits 0, save where the records
// cannot be read. Node's own modules only.
//
//   node core/scripts/choices.mjs      from a project's root: each record, whether it names its sign, and whether the
//                                      pass is due (in the core: node scripts/choices.mjs)
import fs from "node:fs";
import path from "node:path";
import { started } from "./started.mjs";

export const KIT = "docs/choices.md";
export const TITLE = "Choices to read again";
// Twice a year: the pass is due once the day on the line "Read whole:" is this many days old.
export const DAYS = 182;

// The path a project's rules name for its *choice records* (the manifest's row, or a line of the core's AGENTS.md that
// gives the slot), else KIT; null where the name is no plain path inside the project.
export function where(rules) {
  const named = /\*choice records\*\s*(?:\|\s*|:\s*)`([^`\n]+)`/u.exec(String(rules ?? ""))?.[1] ?? KIT;
  return /^[\w][\w.-]*(\/[\w][\w.-]*)*$/u.test(named) ? named : null;
}

const plain = text => String(text ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").trim().slice(0, 120);

// What a records file holds: each record's name and whether it names its sign, the day of the last pass (null where the
// line is missing or holds no day), and how many lines are still left to fill in (FILL IN). A record whose heading is
// still the starter kit's, left to fill in, is no record yet, so a new project's file makes no pass due.
export function parse(text) {
  const t = String(text ?? "").replace(/\r\n/gu, "\n");
  const heads = [...t.matchAll(/^## Choice: (.+)$/gmu)];
  const records = heads.map((m, i) => {
    const body = t.slice(m.index + m[0].length, i + 1 < heads.length ? heads[i + 1].index : t.length).split(/^#{1,2} /mu)[0];
    return { name: plain(m[1]), sign: /^[ \t]*(?:[-*][ \t]+)?(?:\*\*)?Reopens it:(?:\*\*)?[ \t]*\S/mu.test(body) };
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
  const rules = manifest ?? (() => { try { return fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"); } catch { return ""; } })();
  const scripts = manifest === null || manifest === undefined ? "scripts" : "core/scripts";
  const got = records(rules, root);
  if (got.unread) return { title: TITLE, body: null, unread: got.unread };
  if (got.text === null) return { title: TITLE, body: null };
  const found = parse(got.text), why = due(found, at);
  if (!why) return { title: TITLE, body: null };
  const unsigned = found.records.filter(r => !r.sign).length;
  return { title: TITLE, body: `The pass over the choices that are hard to undo is due (\`${scripts === "scripts" ? "" : "core/"}modules/choices.md\`, "What reopens a choice"): \`${got.file}\` holds ${found.records.length} records, and ${why}; the pass falls ${DAYS} days after the last.${unsigned ? ` ${unsigned} of them name no sign on a line "Reopens it:".` : ""} A fresh reader goes through each record as that rule says, files an issue for the owner, labelled needs-owner, for each choice whose sign has tripped or for which a plainly better option exists now, and writes the day of its pass on that line, in a pull request of its own. \`node ${scripts}/choices.mjs\` lists the records.` };
}

// What the script prints: each record, and whether the pass is due.
export function report(got, at) {
  if (got.unread) return `The choice records could not be read: ${got.unread}.`;
  if (got.text === null) return `No choice records at \`${got.file}\` yet: a project records there each choice that is hard to undo (modules/choices.md).`;
  const found = parse(got.text), why = due(found, at);
  return [`\`${got.file}\`: ${found.records.length} records${found.read ? `, read whole on ${found.read}` : ""}${found.open ? `, ${found.open} lines still marked FILL IN` : ""}.`,
    ...found.records.map(r => `- ${r.name}${r.sign ? "" : ": names no sign on a line \"Reopens it:\""}`),
    why ? `The pass over them is due: ${why}.` : found.records.length ? `The pass over them is not due until ${DAYS} days after ${found.read}.` : "No record yet, so no pass is due."].join("\n");
}

if (started(import.meta.url)) {
  let rules = "";
  try { rules = fs.readFileSync("core-manifest.md", "utf8"); } catch { try { rules = fs.readFileSync("AGENTS.md", "utf8"); } catch { /* (the kit's file) */ } }
  const got = records(rules);
  console.log(report(got, new Date().toISOString()));
  if (got.unread) { console.error(`FAIL: the choice records could not be read (${got.unread}). Mend: name a regular file inside the project as the *choice records* in the manifest's slots, or leave the row out for ${KIT}`); process.exitCode = 1; }
}
