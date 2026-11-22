// The one process that takes the core into a repository (#1083; AGENTS.md, "One process takes the core in"): run from a
// project's root, by the starter kit (init.mjs) and by every sync (sync.mjs), it writes what the core owns, from the
// kit's templates of the copy it lies in and what the project holds (fresh.mjs, `kind`), so that a new project and one
// at any earlier copy end in the same state, and run again it changes nothing. The core owns three kinds of file:
//   - its whole files: each workflow, Dependabot config, issue form, hooks' settings and tool entry file the kit writes.
//     One is the core's where it is not there, where it carries the core's mark (its first line, `MARK` in init.mjs, in
//     a workflow and Dependabot's config), or where it is, but for its mark and its pins, what this kit or an earlier
//     one (`--older`) writes for the project; the core's is written whole again, any other left as it is and named;
//   - its part of a rule file of the project's own (AGENTS.md, CLAUDE.md): the lines between `BEGIN` and `END`, or,
//     before there were marks, the one run of import lines (each line "@" and a path) every line of which a kit
//     writes; that part alone is written, every byte outside it kept, and a file with no such run gets it at its end;
//   - the rest of what the kit writes (the manifest, SECURITY.md, the threat model, the progress file, the choice
//     records, the checks' configs): the project's own from its first commit, written only where it is not there.
// A file named in the manifest's "Differences" (a line that quotes its path) is the project's, and never written. A
// value the project gives that lands in a file written (the owner's login, the project's name, the folders of npm and
// NuGet, the pin, the copy's path) is held to its form first (floor topic 5), and where one is not, nothing is
// written. Nothing is written through a link. It commits and pushes nothing. Node's own modules and git only.
//
//   node core/scripts/converge.mjs [--older <dir>]          what it would write, and what it leaves as the project's
//   node core/scripts/converge.mjs --write [--older <dir>]  writes it (<dir>: a folder of earlier kits, each a folder
//                                                           holding setup/template/, as sync.mjs gives fresh.mjs)
//   node core/scripts/converge.mjs --check --base <rev>     core.yml's check: fails where the pull request changed a
//                                                           file or part the core marks and it is not as the core writes it
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyAt } from "./workflow-calls.mjs";
import { fresh, kind } from "./fresh.mjs";
import { BEGIN, END, FILES, NAME, TEMPLATES, linked, marked, named } from "./init.mjs";
import { project } from "./steps.mjs";
import { started } from "./started.mjs";

export const BLOCKS = ["AGENTS.md", "CLAUDE.md"];
// (of the kit's files, the project's own from its first commit: written only where they are not there)
const OWN = new Set(["core-manifest.md", "SECURITY.md", "docs/threat-model.md", "docs/PROGRESS.md", "docs/choices.md", "checks/copies.json", "checks/shape.json", "checks/licences-audit.json"]);
export const WHOLE = FILES.map(([, to]) => to).filter(to => !OWN.has(to) && !BLOCKS.includes(to));
const KIT = new Set(FILES.map(([, to]) => to));
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const FOLDER = /^(\.|[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*)$/u;
const COPY = /^[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*\/$/u;

// What of the project's values does not hold to its form, each a line with its mend; none, an empty list.
export function unformed(p, { o, pin }) {
  const bad = [];
  if (!LOGIN.test(o.owner)) bad.push(`the owner's account in core-manifest.md is no GitHub login. Mend: write the row *owner's account* with one login, letters, digits and hyphens`);
  if (!named(o.name)) bad.push(`the project's name, AGENTS.md's first heading, is not ${NAME}. Mend: write the name so in that heading`);
  for (const [key, what] of [["packages", "npm's lock file"], ["nuget", "NuGet's solution"]]) {
    if (o[key] !== undefined && !FOLDER.test(o[key])) bad.push(`the folder of ${what}, as the project's calls and files name it, is not a folder inside the project in plain letters, digits, ".", "_" and "-". Mend: move it to such a folder, or name it so in the call`);
  }
  if (!/^[0-9a-f]{40}$/u.test(pin)) bad.push(`core-manifest.md's "Core:" line has no full commit SHA. Mend: write the line as the sync writes it`);
  if (!COPY.test(copyAt(p))) bad.push(`the copy's path in core-manifest.md's "Core:" line is not a folder in plain letters, digits, ".", "_" and "-". Mend: name it so`);
  return bad;
}

const lf = t => t.replace(/\r\n/gu, "\n");
// (a file as the comparison reads it: its line ends made one, the core's mark taken out and every pin made one, since
// the sync and Dependabot move pins)
const plainOf = t => lf(t).replace(/^# The core's file:[^\n]*\n/u, "").replace(/@[0-9a-f]{40}(\s*#\s*v?[\w.-]+)?/gu, "@<pin>");
const blockOf = t => { const b = lf(t).indexOf(BEGIN), e = lf(t).indexOf(END); return b < 0 || e < b ? null : lf(t).slice(b, e + END.length); };
const imports = l => /^@\S+$/u.test(l);

// Where the core's part stands in a rule file's text: { at, end } (end past its last line, its line end kept outside),
// null where it has none, or "many" where it cannot be told which run of import lines it is. `kitLines` are the lines
// every kit's part holds.
export function partIn(text, kitLines) {
  const b = text.indexOf(BEGIN), e = text.indexOf(END);
  if (b >= 0 && e > b && text.indexOf(BEGIN, b + 1) < 0) return { at: b, end: e + END.length };
  if (b >= 0 || e >= 0) return "many";
  const lines = text.split("\n"), runs = [];
  let offset = 0, run = null;
  lines.forEach((l, i) => {
    const bare = l.replace(/\r$/u, "");
    if (imports(bare)) { run ??= { at: offset, lines: [] }; run.lines.push(bare); run.end = offset + bare.length; } else if (run) { runs.push(run); run = null; }
    offset += l.length + (i < lines.length - 1 ? 1 : 0);
  });
  if (run) runs.push(run);
  const core = runs.filter(r => r.lines.every(l => kitLines.has(l)));
  return core.length === 1 ? core[0] : core.length ? "many" : null;
}

// One file after the process, from what stands, `now` (null where nothing does), the kit's text `want` and the earlier
// kits' (`older`): { text } to write, {} where it is left as it stands, and `left` where it is left as the project's.
export function converged(to, now, want, older = []) {
  if (now === null) return { text: want };
  if (OWN.has(to) || !KIT.has(to)) return {};
  if (BLOCKS.includes(to)) {
    const part = blockOf(want);
    if (part === null) return {};
    const kitLines = new Set([want, ...older].flatMap(t => (blockOf(t) ?? t).split("\n").map(l => l.replace(/\r$/u, "")).filter(imports)));
    const at = partIn(now, kitLines);
    if (at === "many") return { left: "its part of the core cannot be told apart (the core's marks stand more than once or apart, or more than one run of import lines is the kit's): left as it is" };
    const eol = now.includes("\r\n") ? "\r\n" : "\n", block = part.replaceAll("\n", eol);
    const text = at === null ? `${now}${now.endsWith("\n") || now === "" ? "" : eol}${eol}${block}${eol}` : `${now.slice(0, at.at)}${block}${now.slice(at.end)}`;
    return text === now ? {} : { text };
  }
  const core = (marked(to) && /^# The core's file:/u.test(now)) || [want, ...older].some(t => t && plainOf(t) === plainOf(now));
  if (!core) return { left: "is not the core's (no mark of the core's, and not what a starter kit writes for the project): left as it is" };
  return now === want ? {} : { text: want };
}

// What the process does to the project `p`: [{ to, text }] to write, [{ to, why }] left as the project's. `kit` is
// what this kit writes for it ([path, text]), `older` the earlier kits'.
export function plan(p, kit, older = []) {
  const write = [], left = [];
  for (const [to, want] of kit) {
    if (p.differences.some(l => l.includes(`"${to}"`))) continue;
    const link = linked(p.root, to);
    if (link) { left.push({ to, why: `stands under the link ${link}, which the process never writes through` }); continue; }
    let there = false;
    try { there = !!fs.lstatSync(path.join(p.root, to)); } catch { /* (not there) */ }
    const now = there ? p.read(to, true) : null;
    if (there && now === null) { left.push({ to, why: "is no regular file the process can read: left as it is" }); continue; }
    const r = converged(to, now, want, older.map(k => k.find(([f]) => f === to)?.[1]).filter(t => t !== undefined));
    if (r.text !== undefined) write.push({ to, text: r.text });
    if (r.left) left.push({ to, why: r.left });
  }
  return { write, left };
}

// The kit's files for the project (the configs fresh.mjs adds beside them left out: those are the starter kit's and
// the steps' to write, with what the project holds) and the earlier kits', each [path, text].
export function kits(p, older) {
  const kit = fresh(p, path.join(HERE, TEMPLATES), { kitOnly: true });
  const before = older ? fs.readdirSync(older).map(d => fresh(p, path.join(older, d, TEMPLATES))) : [];
  return { kit, before };
}

function run(argv) {
  const root = process.cwd(), p = project(root);
  const at = argv.indexOf("--older"), older = at < 0 ? null : argv[at + 1];
  if (argv.includes("--check")) return check(p, argv[argv.indexOf("--base") + 1]);
  const bad = unformed(p, kind(p));
  if (bad.length) { for (const b of bad) console.error(`FAIL ${b}; the process wrote nothing.`); process.exitCode = 1; return; }
  const { kit, before } = kits(p, older);
  const { write, left } = plan(p, kit, before);
  const writing = argv.includes("--write");
  for (const { to, text } of write) {
    if (!writing) continue;
    fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    fs.writeFileSync(path.join(root, to), text);
  }
  console.log(write.length ? `The core's files and parts ${writing ? "written" : "to write (--write writes them)"} (\`core/scripts/converge.mjs\`): ${write.map(w => w.to).join(", ")}.` : "The core's files and parts are as the core writes them (`core/scripts/converge.mjs`): nothing to write.");
  if (left.length) console.log(`Left as the project's, each a difference the manifest's "Differences" declares on the owner's word or a task the project's agents take:\n${left.map(l => `- ${l.to} ${l.why}`).join("\n")}`);
}

// core.yml's check: of the paths the pull request changed against `base`, each the core marks (a whole file whose first
// line is the core's mark, a rule file holding the core's part) must be as this copy writes it. What the pull request
// did not change is never read, so nothing that stood fails here (AGENTS.md, "Nothing locks a project").
function check(p, base) {
  if (!base) { console.log("the core's files and parts are read on a pull request alone: nothing to read"); return; }
  const changed = execFileSync("git", ["diff", "--name-only", "--no-renames", `${base}...HEAD`], { cwd: p.root, encoding: "utf8" }).split("\n").filter(Boolean);
  const bad = unformed(p, kind(p));
  if (bad.length) { console.log(`the core's files and parts could not be read against the kit: ${bad.join("; ")}`); return; }
  const { kit } = kits(p, null);
  const wrong = [];
  for (const [to, want] of kit) {
    if (!changed.includes(to) || p.differences.some(l => l.includes(`"${to}"`))) continue;
    const now = p.read(to, true);
    if (now === null) continue;
    const ours = BLOCKS.includes(to) ? blockOf(now) !== null : marked(to) && /^# The core's file:/u.test(now);
    if (!ours) continue;
    const same = BLOCKS.includes(to) ? lf(blockOf(now)) === blockOf(want) : now === want;
    if (!same) wrong.push(to);
  }
  for (const to of wrong) console.log(`FAIL ${to}: ${BLOCKS.includes(to) ? "the core's part of it" : "the core's file"} is not as the core writes it for this project at its pin. Mend: run \`node ${copyAt(p)}scripts/converge.mjs --write\`, which writes it again, and commit it; or, to keep the change as the project's own, ${BLOCKS.includes(to) ? "write it outside the core's part" : "take out its first line, the core's mark, and name the file in core-manifest.md's \"Differences\" on the owner's word"}.`);
  if (wrong.length) process.exitCode = 1;
  else console.log("the core's files and parts the pull request changed are as the core writes them");
}

if (started(import.meta.url)) {
  try { run(process.argv.slice(2)); } catch (e) {
    console.error(`FAIL: the process could not read the project (${String(e.message).split("\n")[0].slice(0, 160)}). Mend: run it from the project's root, a git repository that holds core-manifest.md`);
    process.exitCode = 1;
  }
}
