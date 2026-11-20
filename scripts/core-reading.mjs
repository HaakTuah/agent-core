// A project read against the core (tasks/cleaning.md, "A project is read against the core once, then for what each
// release changes"; #464): the rules the project takes, the floor's and its modules' as rules.mjs reads them from its
// copy, against RECORD, the record of the readings made: the day of the last and a mark of each rule of the copy at
// that reading, made from its key and its text, so that a rule a release adds or changes is no longer covered. Every
// rule of the copy is marked, not only those taken, so that a module the project takes later is read for what a
// release changes in it, as the rest are, and taking it in asks nothing by itself. What is due:
// a whole reading where no record stands or it cannot be read, else the rules no reading covered, each by its key.
// The sync's step (steps/, beside this file) reads it, and so the scheduled look's issue of steps not done; it fails
// nothing (AGENTS.md of the core, "Nothing locks a project"). The core's own repository takes no copy: there it reads
// nothing (#259 is that reading). Node's own modules.
//
//   node core/scripts/core-reading.mjs             from a project's root: what is due, each rule to read by its key
//   node core/scripts/core-reading.mjs --rules     every rule the project takes, by its key: what a whole reading reads
//   node core/scripts/core-reading.mjs --recorded  record the reading made today, marking every rule of the copy
//                                                  as it stands: the session that took the reading's task runs it in
//                                                  the pull request that holds the reading's report
import fs from "node:fs";
import path from "node:path";
import { copyOf } from "./core-path.mjs";
import { fingerprint, ROOT, rules, takenRules } from "./rules.mjs";
import { started } from "./started.mjs";

export const RECORD = "checks/core-reading.json";
const DAY = /^\d{4}-\d\d-\d\d$/u, MARK = /^[0-9a-f]{12}$/u;
const markOf = r => fingerprint(`${r.key}\n${r.text}`);

// The record's text read: { day, marks } where it is in its form, false where it is not, null where there is none.
export function recordOf(text) {
  if (text === null || text === undefined) return null;
  let r;
  try { r = JSON.parse(text); } catch { return false; }
  const ok = r && typeof r === "object" && DAY.test(r.day) && Array.isArray(r.read) && r.read.every(m => MARK.test(m));
  return ok ? { day: r.day, marks: new Set(r.read) } : false;
}

// What is due in a project whose manifest's text is `manifest` and whose record's text is `text` (null where it has
// none), against the rules of the copy at `root`: null where nothing is; { whole, why } for a whole reading; else
// { day, keys }, the rules no reading covered.
export function due(manifest, text, root = ROOT) {
  const record = recordOf(text);
  if (record === null) return { whole: true, why: `no reading of the project against the core is recorded (\`${RECORD}\`)` };
  if (record === false) return { whole: true, why: `\`${RECORD}\` cannot be read as JSON with a "day" (YYYY-MM-DD) and a list "read" of marks` };
  const keys = takenRules(rules(root), manifest).filter(r => !record.marks.has(markOf(r))).map(r => r.key);
  return keys.length ? { day: record.day, keys } : null;
}

// What is due, in words a session acts on with no rule file open; null where nothing is. `copy`, the copy's path.
export function said(d, copy = "core/") {
  if (!d) return null;
  const how = `a fresh auditor (\`${copy}roles/auditor.md\`) answers for each rule met, partly, not met or not applicable, with its evidence and what holds it in the project; the session that took the task writes its answers as a report in the project's *audits*, named by its day, files each gap as a task taken at the dose, and records the reading with \`node ${copy}scripts/core-reading.mjs --recorded\`, in one pull request (\`${copy}tasks/cleaning.md\`, "A project is read against the core once, then for what each release changes")`;
  if (d.whole) return `A whole reading of the project against the core is due: ${d.why}. Read it against every rule it takes, as \`node ${copy}scripts/core-reading.mjs --rules\` lists them: ${how}.`;
  return `${d.keys.length === 1 ? "A rule" : `${d.keys.length} rules`} the project takes ${d.keys.length === 1 ? "was" : "were"} added or changed since the reading of ${d.day}, which no reading has covered: ${d.keys.map(k => `\`${k}\``).join("; ")}. Read the project against ${d.keys.length === 1 ? "it" : "them"}: ${how}.`;
}

// The reading recorded: every rule of the copy as it stands, marked, with the day.
export function record(day, root = ROOT) {
  const marks = [...new Set(rules(root).map(markOf))].sort();
  return `${JSON.stringify({ day, read: marks }, null, 2)}\n`;
}

// What the command prints, run in `cwd` with `args`; it writes the record with --recorded.
export function main(args, cwd = process.cwd()) {
  const read = f => { const at = path.join(cwd, f); return fs.existsSync(at) ? fs.readFileSync(at, "utf8") : null; };
  const manifest = read("core-manifest.md");
  if (manifest === null) return "No core-manifest.md here: the core's own repository takes no copy, so it is read against nothing (#259 is its reading); run this from a project's root.";
  if (args[0] === "--recorded") {
    fs.mkdirSync(path.join(cwd, path.dirname(RECORD)), { recursive: true });
    fs.writeFileSync(path.join(cwd, RECORD), record(new Date().toISOString().slice(0, 10)));
    return `${RECORD}: the reading of today is recorded, marking every rule of the copy.`;
  }
  if (args[0] === "--rules") return takenRules(rules(), manifest).map(r => r.key).join("\n");
  return said(due(manifest, read(RECORD)), copyOf(cwd)) ?? "No reading of the project against the core is due: every rule it takes is covered by one.";
}

if (started(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && !["--rules", "--recorded"].includes(args[0]))) { console.error("FAIL: the reading against the core does not know that. Mend: run it with no option, with --rules or with --recorded"); process.exitCode = 1; }
  else try { console.log(main(args)); } catch (e) { console.error(`FAIL: what is due could not be read here (${e.message}). Mend: run it from the project's root, beside core-manifest.md`); process.exitCode = 1; }
}
