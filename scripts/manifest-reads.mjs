// The manifest against the modules, and the README's table of slots against its marks (#157, #481; AGENTS.md, "Nothing
// locks a project" and "What can be read is never asked or declared"). A project's `core-manifest.md` names every
// module of the core in its "Modules:" line, where that is a list and not "all", takes or leaves out with a reason. It
// REPORTS and never fails in a project: a list that was missing before this check came is no breach of the project's
// own, and each note says the line to add. The copies workflow runs it, a step of a job that already runs, so no job
// is added. A slot asks the project for no row: each is read by a script or has a default, as its mark says, and a row
// only overrides it.
//
// A module a list leaves out is named in a line of the manifest, `Not taken: ` and each module as `<name>.md` in
// backticks followed by its reason in brackets, as: Not taken: `game-design.md` (the project is no game).
//
// In the core's own repository (`--core`) each slot of its README's table carries one mark in its third column:
// "read:" naming in backticks a reader that stands in the core, "choice:" with its default ("left out, ..."), or
// "cannot be read:" with its reason and then its default; a slot with none, or a mark short of its part, fails, saying
// the mend. Node's own modules and git only.
//
//   node core/scripts/manifest-reads.mjs    from a project: the notes, or that none is needed; exits 0
//   node scripts/manifest-reads.mjs --core  in the core's own repository: fails a slot's mark short of its part
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logged, unrooted } from "./guards.mjs";
import { MODULES } from "./reading.mjs";
import { started } from "./started.mjs";
import { copyOf, projectAt } from "./core-path.mjs";

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

// The README's "Slots" table: each slot's name, what a project fills in, and its mark, as the third column gives it.
export function slotTable(readme) {
  const out = new Map();
  for (const [first, what, mark = ""] of rows(section(String(readme).split(/\r?\n/u), "## Slots"))) {
    for (const name of italics(first)) out.set(name, { what, mark });
  }
  return out;
}

// What a mark lacks, or "" where it has each part: "read:" names a reader, in backticks, that `stands(path)` finds in
// the core; "choice:" gives its default, "left out, " and what; "cannot be read:" gives its reason, then its default.
export function markGap(mark, stands) {
  const kind = /^(read|choice|cannot be read):\s*(.*)$/su.exec(mark);
  if (!kind) return `carries none of the three marks ("read:", "choice:" or "cannot be read:")`;
  const [, what, rest] = kind;
  if (what === "read") {
    const named = [...rest.matchAll(/`([\w./-]+\.(?:mjs|js|sh|yml|json))`/gu)].map(m => m[1]);
    if (!named.length) return `is marked "read:" and names no reader, a script or workflow in backticks`;
    const gone = named.filter(f => !stands(f));
    return gone.length ? `is marked "read:" by ${gone.map(f => `\`${f}\``).join(", ")}, which the core does not hold` : "";
  }
  const at = rest.search(/\bleft out, \S/u);
  if (at < 0) return `is marked "${what}:" with no default ("left out, " and what stands in its place)`;
  return what === "cannot be read" && !/\w/u.test(rest.slice(0, at)) ? `is marked "cannot be read:" with no reason before its default` : "";
}

// The core's own: each slot of its README's table whose mark lacks a part, with the mend.
export function markGaps(readme, stands) {
  const slots = slotTable(readme);
  if (!slots.size) return [`README.md has no "## Slots" table, which names each slot and its mark. Mend: write it back, a row a slot: its name in italics, what a project fills in, and its mark`];
  const out = [];
  for (const [name, { mark }] of slots) {
    const gap = markGap(mark, stands);
    if (gap) out.push(`README.md, "Slots": *${name}* ${gap}. Mend: give its row's third column "read:" and its reader where a script reads it, else "choice:" or "cannot be read:" with the reason, each with its default ("left out, ..."), as AGENTS.md, "What can be read is never asked or declared", says`);
  }
  return out;
}

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

// What a project's manifest lacks, one note each, with the mend: the modules of `moduleTexts` ({ name: text }) its list
// neither takes nor leaves out.
export function notes({ manifest, moduleTexts, where = {} }) {
  const out = [];
  const { taken, notTaken, line } = modulesOf(manifest);
  const names = Object.keys(moduleTexts).sort();
  if (taken === null) out.push(`core-manifest.md: its "Modules:" line (${line ? `"${line}"` : "none found"}) is neither "all" nor a list of modules as \`<name>.md\` in backticks, so the modules it takes cannot be read; write it as the README's "The manifest's format" has it ("Modules: all." or a list)`);
  if (taken instanceof Set) {
    for (const n of [...taken].filter(n => !names.includes(n)).sort()) out.push(`core-manifest.md: its "Modules:" line names ${n}, which is no module of the core (${MODULES.map(d => `core/${d}/`).join(", ")}); take it out of the line`);
    for (const n of names.filter(n => !taken.has(n) && !notTaken.get(n))) {
      out.push(`core-manifest.md: core/${where[n] ?? "tasks"}/${n} is neither on the "Modules:" line nor left out with a reason; add \`${n}\` to the line where the project takes it, or add it to a line "Not taken: \`${n}\` (<why it does not apply here>)." under it`);
    }
  }
  return out;
}

const readDir = dir => Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort().map(f => [f, fs.readFileSync(path.join(dir, f), "utf8")]));

function main() {
  const core = process.argv.includes("--core");
  const here = path.dirname(fileURLToPath(import.meta.url));
  let root = path.resolve(here, core ? ".." : "../..");
  try {
    root = projectAt(here).root || execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const home = core ? root : path.join(root, copyOf(root));
    if (core) {
      const found = markGaps(fs.readFileSync(path.join(home, "README.md"), "utf8"), f => !path.isAbsolute(f) && !f.split("/").includes("..") && fs.existsSync(path.join(home, f)));
      for (const f of found) console.error(`FAIL: ${logged(f)}`);
      if (found.length) return 1;
      console.log("each slot of the README's table carries its mark: read by a reader that stands here, or a default");
      return 0;
    }
    // (the modules, by name, from each folder that holds them)
    const where = Object.fromEntries(MODULES.flatMap(d => Object.keys(readDir(path.join(home, d))).map(n => [n, d])));
    const moduleTexts = Object.assign({}, ...MODULES.map(d => readDir(path.join(home, d))));
    const found = notes({ manifest: fs.readFileSync(path.join(root, "core-manifest.md"), "utf8"), moduleTexts, where });
    // (a manifest's text is data: a control character, a lone carriage return too, would start a line of its own in the
    // log, and a line led by "::" is a command to the runner)
    for (const f of found) console.log(`note ${logged(f)}`);
    console.log(found.length ? `note ${found.length} lines of the manifest to add; nothing fails over them (AGENTS.md of the core, "Nothing locks a project")` : "ok   the manifest takes or leaves out each module");
  } catch (e) {
    // (a project that cannot be read this way is told so, never failed over it)
    // (the error is Node's, which names the file by its place on this machine: it is named from the project's root)
    const said = logged(unrooted(e.message, root));
    if (core) { console.error(`FAIL: the core's README.md could not be read (${said}). Mend: run it from a clone of the core, where it stands`); return 1; }
    console.log(`note the manifest could not be read against the modules (${said})`);
  }
  return 0;
}

if (started(import.meta.url)) process.exitCode = main();
