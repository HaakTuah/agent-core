// The manifest against the modules and the slots (#157; AGENTS.md, "Nothing locks a project"): a project's
// `core-manifest.md` names every module of `core/modules/` its "Modules:" line, where that is a list and not "all",
// takes or leaves out with a reason, and fills every slot that a module it takes, or the floor, uses, unless the core
// gives the slot a default (its README's "Slots" table says "left out" of such a slot). It REPORTS and never fails in a
// project: a list or a row that was missing before this check came is no breach of the project's own, and each note
// says the line or the row to add. The copies workflow runs it, a step of a job that already runs, so no job is added.
//
// A module a list leaves out is named in a line of the manifest, `Not taken: ` and each module as `<name>.md` in
// backticks followed by its reason in brackets, as: Not taken: `game-design.md` (the project is no game).
//
// In the core's own repository (`--core`) the same reading is held to the full extent (AGENTS.md, "The core abides by
// its own rules"): its "The slots here" paragraph fills every slot the modules it takes use, and a gap fails, saying
// the slot to add; which modules it takes is `own-modules.mjs`'s, beside this file. Node's own modules and git only.
//
//   node core/scripts/manifest-reads.mjs    from a project: the notes, or that none is needed; exits 0
//   node scripts/manifest-reads.mjs --core  in the core's own repository: fails a gap
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSection } from "./own-modules.mjs";
import { MODULES } from "./reading.mjs";
import { started } from "./started.mjs";

const plain = s => s.toLowerCase().replace(/[‘’]/gu, "'").replace(/\s+/gu, " ").trim();
// (a phrase in italics may run over one line break, as a module's text wraps it: "*where the numbers\n  go*"; the
// wrapped part starts at its first character that is no blank, so a long blank line is read once, not tried each way)
const italics = text => [...String(text).matchAll(/(?<![*\w])\*([^*\n]+?(?:\n[ \t]*[^*\s][^*\n]*?)?)\*(?![*\w])/gu)].map(m => plain(m[1]));
const section = (lines, title) => {
  const at = lines.findIndex(l => l === title);
  if (at < 0) return [];
  const end = lines.findIndex((l, i) => i > at && /^#{1,2} /u.test(l));
  return lines.slice(at + 1, end < 0 ? lines.length : end);
};
const rows = lines => lines.filter(l => l.startsWith("|")).map(l => l.split("|").slice(1, -1).map(c => c.trim()))
  .filter(r => r.length >= 2 && !/^[-: ]+$/u.test(r[0]) && !/^slot$/iu.test(r[0]));

// The README's "Slots" table: each slot's name, what a project fills in, and whether the core gives it a default (its
// description says "left out").
export function slotTable(readme) {
  const out = new Map();
  for (const [first, what] of rows(section(String(readme).split(/\r?\n/u), "## Slots"))) {
    for (const name of italics(first)) out.set(name, { what, fallback: /\bleft out\b/u.test(what) });
  }
  return out;
}

// The slots each file uses: the names of the table in italics in its text.
export const usedIn = (text, slots) => new Set(italics(text).filter(n => slots.has(n)));

// The slots a manifest's "Slots" table fills, each with a value.
export const filledIn = manifest => new Set(rows(section(String(manifest).split(/\r?\n/u), "## Slots")).filter(r => r[1] !== "").flatMap(r => italics(r[0])));

// What the manifest's "Modules:" line takes: "all", the names of a list, or null where it is neither. And the modules
// it leaves out, each with its reason ("" where it names none).
export function modulesOf(manifest) {
  const line = /\bModules:\s*([^\n]*)/u.exec(String(manifest))?.[1].trim() ?? "";
  const names = text => [...text.matchAll(/`(?:[\w-]+\/)*([\w.-]+?)(?:\.md)?`/gu)].map(m => `${m[1]}.md`);
  const taken = /^all\b/iu.test(line) ? "all" : names(line).length ? new Set(names(line)) : null;
  const notTaken = new Map();
  const nt = /^Not taken:\s*(.*)$/mu.exec(String(manifest))?.[1] ?? "";
  for (const m of nt.matchAll(/`(?:[\w-]+\/)*([\w.-]+?)(?:\.md)?`(?:\s*\(([^)]*)\))?/gu)) notTaken.set(`${m[1]}.md`, (m[2] ?? "").trim());
  return { taken, notTaken, line };
}

const list = names => names.map(n => `\`${n}\``).join(", ");

// What a project's manifest lacks, one note each, with the mend: the modules of `moduleTexts` ({ name: text }) its list
// neither takes nor leaves out, and the slots a module it takes, or the floor, uses and its slots do not fill.
export function notes({ manifest, readme, moduleTexts, floorTexts, where = {} }) {
  const out = [];
  const slots = slotTable(readme);
  const { taken, notTaken, line } = modulesOf(manifest);
  const names = Object.keys(moduleTexts).sort();
  if (taken === null) out.push(`core-manifest.md: its "Modules:" line (${line ? `"${line}"` : "none found"}) is neither "all" nor a list of modules as \`<name>.md\` in backticks, so the modules it takes cannot be read; write it as the README's "The manifest's format" has it ("Modules: all." or a list)`);
  const takes = taken === "all" || taken === null ? names : names.filter(n => taken.has(n));
  if (taken instanceof Set) {
    for (const n of [...taken].filter(n => !names.includes(n)).sort()) out.push(`core-manifest.md: its "Modules:" line names ${n}, which is no module of the core (${MODULES.map(d => `core/${d}/`).join(", ")}); take it out of the line`);
    const left = names.filter(n => !taken.has(n));
    for (const n of left.filter(n => !notTaken.get(n))) {
      out.push(`core-manifest.md: core/${where[n] ?? "tasks"}/${n} is neither on the "Modules:" line nor left out with a reason; add \`${n}\` to the line where the project takes it, or add it to a line "Not taken: \`${n}\` (<why it does not apply here>)." under it`);
    }
  }
  const used = new Map();
  const use = (file, text) => { for (const s of usedIn(text, slots)) used.set(s, [...(used.get(s) ?? []), file]); };
  for (const n of takes) use(`core/${where[n] ?? "tasks"}/${n}`, moduleTexts[n]);
  for (const [f, text] of Object.entries(floorTexts)) use(`core/floor/${f}`, text);
  const filled = filledIn(manifest);
  for (const [slot, files] of [...used].sort(([a], [b]) => a.localeCompare(b))) {
    const s = slots.get(slot);
    if (filled.has(slot) || s.fallback) continue;
    out.push(`core-manifest.md, "Slots": no row for *${slot}*, which ${list(files)} use${files.length === 1 ? "s" : ""}; add the row "| *${slot}* | <${s.what.replace(/\|/gu, "/")}> |"`);
  }
  return out;
}

// The core's own: the slots its AGENTS.md fills (the italic names of its "The slots here:" paragraph) against those
// the modules it takes, and the floor, use.
export function coreGaps({ agents, readme, moduleTexts, floorTexts, where = {} }) {
  const slots = slotTable(readme);
  const { error, taken, notTaken } = readSection(agents);
  if (error) return [error];
  const lines = String(agents).split(/\r?\n/u);
  const at = lines.findIndex(l => l.startsWith("The slots here:"));
  if (at < 0) return [`AGENTS.md has no paragraph "The slots here:", which fills the slots the modules use. Mend: write it back, in "The core this repository takes", naming each slot the modules use`];
  const end = lines.findIndex((l, i) => i > at && l.trim() === "");
  const filled = new Set(italics(lines.slice(at, end < 0 ? lines.length : end).join(" ")));
  const used = new Map();
  const use = (file, text) => { for (const s of usedIn(text, slots)) used.set(s, [...(used.get(s) ?? []), file]); };
  // (its own section names each module by its folder and name)
  for (const [file, n] of [...taken].filter(f => !notTaken.has(f)).map(f => [f, path.posix.basename(f)])) if (n in moduleTexts) use(file, moduleTexts[n]);
  for (const [f, text] of Object.entries(floorTexts)) use(`floor/${f}`, text);
  const out = [];
  for (const [slot, files] of [...used].sort(([a], [b]) => a.localeCompare(b))) {
    if (filled.has(slot) || slots.get(slot).fallback) continue;
    out.push(`AGENTS.md, "The slots here": no *${slot}*, which ${list(files)} use${files.length === 1 ? "s" : ""}. Mend: add "the *${slot}*: <${slots.get(slot).what.replace(/\|/gu, "/")}>" to that paragraph`);
  }
  return out;
}

const readDir = dir => Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort().map(f => [f, fs.readFileSync(path.join(dir, f), "utf8")]));

function main() {
  const core = process.argv.includes("--core");
  const here = path.dirname(fileURLToPath(import.meta.url));
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const home = core ? root : path.join(root, "core");
    // (the modules, by name, from each folder that holds them; the floor's own files, its topics among them)
    const where = Object.fromEntries(MODULES.flatMap(d => Object.keys(readDir(path.join(home, d))).map(n => [n, d])));
    const moduleTexts = Object.assign({}, ...MODULES.map(d => readDir(path.join(home, d))));
    const floorTexts = { ...readDir(path.join(home, "floor")), ...Object.fromEntries(Object.entries(readDir(path.join(home, "floor", "topics"))).map(([n, t]) => [`topics/${n}`, t])) };
    const texts = { readme: fs.readFileSync(path.join(home, "README.md"), "utf8"), moduleTexts, floorTexts, where };
    if (core) {
      const found = coreGaps({ agents: fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), ...texts });
      for (const f of found) console.error(`FAIL: ${f}`);
      if (found.length) return 1;
      console.log("each slot that the core's modules and floor use is filled in its AGENTS.md, or has a default");
      return 0;
    }
    const found = notes({ manifest: fs.readFileSync(path.join(root, "core-manifest.md"), "utf8"), ...texts });
    // (a manifest's text is data: a control character, a lone carriage return too, would start a line of its own in the
    // log, and a line led by "::" is a command to the runner)
    for (const f of found) console.log(`note ${f.replace(/[\u0000-\u001f\u007f]/gu, " ")}`);
    console.log(found.length ? `note ${found.length} lines of the manifest to add; nothing fails over them (AGENTS.md of the core, "Nothing locks a project")` : "ok   the manifest takes or leaves out each module, and fills each slot they use");
  } catch (e) {
    // (a project that cannot be read this way is told so, never failed over it)
    if (core) { console.error(`FAIL: the core's AGENTS.md, README.md, modules/ or floor/ could not be read (${String(e.message).replace(/[\u0000-\u001f\u007f]/gu, " ")}). Mend: run it from a clone of the core, where they stand`); return 1; }
    console.log(`note the manifest could not be read against the modules and the slots (${e.message})`);
  }
  return 0;
}

if (started(import.meta.url)) process.exitCode = main();
