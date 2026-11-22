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
//     records, the checks' configs): the project's own from its first commit, written only where it is not there, and
//     only at the first copy (--first): later, each is a step's to ask, with the baseline a config needs beside it.
// A file named in the manifest's "Differences" (a line that quotes its path) is the project's, and never written. A
// value the project gives that lands in a file written (the owner's login, the project's name, the folders of npm and
// NuGet, the pin, the copy's path) is held to its form first (floor topic 5), and where one is not, nothing is
// written; so too where the host cannot say whether the repository is private (fresh.mjs, `kind`). Nothing is written
// through a link. It commits and pushes nothing. Node's own modules, git and gh.
//
//   node core/scripts/converge.mjs [--older <dir>]          what it would write, and what it leaves as the project's
//   node core/scripts/converge.mjs --write [--older <dir>]  writes it (<dir>: a folder of earlier kits, each a folder
//                                                           holding setup/template/, as sync.mjs gives fresh.mjs)
//   ... --first                                             at the first copy (sync.mjs): the project's own files too
//   node core/scripts/converge.mjs --check --base <rev>     the check (checks.mjs runs it in the copies part, in
//                                                           core.yml's job and copies.yml's, the base in CONVERGE_BASE):
//                                                           fails where the pull request changed a file or part the
//                                                           core marks and it is not as the core writes it
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyAt } from "./workflow-calls.mjs";
import { fresh, kind } from "./fresh.mjs";
import { BLOCKS, blockOf, converged, dropped, lf, marked, whole } from "./core-owned.mjs";
import { NAME, TEMPLATES, linked, named } from "./init.mjs";
import { project } from "./steps.mjs";
import { inside } from "./step-paths.mjs";
import { started } from "./started.mjs";

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const FOLDER = /^(\.|[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*)$/u;
const COPY = /^[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*\/$/u;

// What of the project's values does not hold to its form, each a line with its mend, the kind the host could not say
// first; none, an empty list.
export function unformed(p, { o, pin, unread }) {
  const bad = unread ? [unread] : [];
  if (!LOGIN.test(o.owner)) bad.push(`the owner's account in core-manifest.md is no GitHub login. Mend: write the row *owner's account* with one login, letters, digits and hyphens`);
  if (!named(o.name)) bad.push(`the project's name, AGENTS.md's first heading, is not ${NAME}. Mend: write the name so in that heading`);
  for (const [key, what] of [["packages", "the lock file of npm"], ["nuget", "NuGet's solution"]]) {
    if (o[key] !== undefined && !FOLDER.test(o[key])) bad.push(`the folder of ${what}, as the project's calls and files name it, is not a folder inside the project in plain letters, digits, ".", "_" and "-". Mend: move it to such a folder, or name it so in the call`);
  }
  if (!/^[0-9a-f]{40}$/u.test(pin)) bad.push(`core-manifest.md's "Core:" line has no full commit SHA. Mend: write the line as the sync writes it`);
  if (!COPY.test(copyAt(p))) bad.push(`the copy's path in core-manifest.md's "Core:" line is not a folder in plain letters, digits, ".", "_" and "-". Mend: name it so`);
  return bad;
}

// Whether a path the kit writes lies outside the project (a row of the manifest that places it with ".." or from the
// root): floor rule 13 and topic 5.
const outside = to => { try { inside(to, "the path"); return false; } catch { return true; } };

// What the process does to the project `p`: [{ to, text }] to write, [{ to }] to take out, [{ to, why }] left as the
// project's. `kit` is what this kit writes for it ([path, text]), `older` the earlier kits'. A whole file of the core's
// that this kit no longer writes (one with the core's mark, or, mark and pins aside, what an earlier kit wrote) is taken
// out, so a project ends as a new one of its kind and no check runs twice (#1101, point 2): the one-job core.yml of a
// private project runs the copies, description and NuGet checks its earlier kit wrote as workflows of their own. A file the project's own from its first commit
// (neither a whole file of the core's nor a rule file it holds a part of) is written only where `first`, at the first
// copy: at any later sync each is a step's to ask, with what it needs beside it (a config's baseline), and a sync that
// created one would be no pure sync (floor rule 8 covers the core's own files and parts alone).
export function plan(p, kit, older = [], { first = false } = {}) {
  const write = [], left = [];
  for (const [to, want] of kit) {
    if (p.differences.some(l => l.includes(`"${to}"`))) continue;
    if (!first && !whole(to) && !BLOCKS.includes(to)) continue;
    if (outside(to)) { left.push({ to, why: "lies outside the project, where the manifest places it: never written" }); continue; }
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
  return { write, remove: dropping(p, kit, older), left };
}

// The whole files of the core's that this kit no longer writes and the project holds as the core's, [{ to }]: of the
// paths an earlier kit writes and the project's files that carry the core's mark, each not named in "Differences".
function dropping(p, kit, older) {
  const kept = new Set(kit.map(([to]) => to)), remove = [];
  for (const to of [...new Set([...older.flatMap(k => k.map(([f]) => f)), ...p.files.filter(marked)])].filter(f => whole(f) && !kept.has(f))) {
    if (p.differences.some(l => l.includes(`"${to}"`)) || outside(to) || linked(p.root, to)) continue;
    let file = false;
    try { file = fs.lstatSync(path.join(p.root, to)).isFile(); } catch { /* (not there) */ }
    const now = file ? p.read(to, true) : null;
    if (now !== null && dropped(to, now, older.map(k => k.find(([f]) => f === to)?.[1]).filter(t => t !== undefined))) remove.push({ to });
  }
  return remove;
}

// The kit's files for the project (the configs fresh.mjs adds beside them left out: those are the starter kit's and
// the steps' to write, with what the project holds) and the earlier kits', each [path, text].
export function kits(p, older, k = kind(p)) {
  const kit = fresh(p, path.join(HERE, TEMPLATES), { kitOnly: true, k });
  const before = older ? fs.readdirSync(older).flatMap(d => asEarlier(p, path.join(older, d, TEMPLATES), k)) : [];
  return { kit, before };
}

// An earlier kit's files for the project, to know a file of the core's by: as this checkout renders the kit for its
// kind, and, for a private one, also as kits before #375 and #376 wrote it (its workflows not yet one job, nor started
// only once a pull request is ready), which this checkout's renderer would otherwise put in a form that kit never wrote.
// Only what is written comes from the kit at the pin. `opts`: fresh.mjs's.
export function asEarlier(p, templates, k, opts = {}) {
  return [fresh(p, templates, { ...opts, k }), ...(k.o.private ? [fresh(p, templates, { ...opts, k: { ...k, o: { ...k.o, private: undefined } } })] : [])];
}

function run(argv) {
  const root = process.cwd(), p = project(root);
  const at = argv.indexOf("--older"), older = at < 0 ? null : argv[at + 1];
  // (checks.mjs runs it as a check of the copies part, with the base in CONVERGE_BASE and no argument)
  if (argv.includes("--check") || process.env.CONVERGE_BASE !== undefined) return check(p, argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : process.env.CONVERGE_BASE);
  const k = kind(p), bad = unformed(p, k);
  if (bad.length) { for (const b of bad) console.error(`FAIL ${b}; the process wrote nothing.`); process.exitCode = 1; return; }
  const { kit, before } = kits(p, older, k);
  const out = kit.map(([to]) => to).filter(outside);
  if (out.length) { for (const to of out) console.error(`FAIL ${to}, where core-manifest.md places a file the kit writes, lies outside the project. Mend: name a path inside the project in that row; the process wrote nothing.`); process.exitCode = 1; return; }
  const { write, remove, left } = plan(p, kit, before, { first: argv.includes("--first") });
  const writing = argv.includes("--write");
  if (writing) applied(root, write, remove);
  console.log(write.length ? `The core's files and parts ${writing ? "written" : "to write (--write writes them)"} (\`core/scripts/converge.mjs\`): ${write.map(w => w.to).join(", ")}.` : "The core's files and parts are as the core writes them (`core/scripts/converge.mjs`): nothing to write.");
  if (remove.length) console.log(`The core's files its kit no longer writes, ${writing ? "taken out" : "to take out (--write takes them out)"}: ${remove.map(r => r.to).join(", ")}.`);
  if (left.length) console.log(`Left as the project's, each a difference the manifest's "Differences" declares on the owner's word or a task the project's agents take:\n${left.map(l => `- ${l.to} ${l.why}`).join("\n")}`);
}

// What the plan writes and takes out, done in the project at `root`.
function applied(root, write, remove) {
  for (const { to, text } of write) {
    fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    fs.writeFileSync(path.join(root, to), text);
  }
  for (const { to } of remove) fs.rmSync(path.join(root, to));
}

// core.yml's check: of the paths the pull request changed against `base`, each the core marks (a whole file whose first
// line is the core's mark, a rule file holding the core's part) must be as this copy writes it. What the pull request
// did not change is never read, so nothing that stood fails here (AGENTS.md, "Nothing locks a project").
function check(p, base) {
  if (!base) { console.log("the core's files and parts are read on a pull request alone: nothing to read"); return; }
  const changed = execFileSync("git", ["diff", "--name-only", "--no-renames", `${base}...HEAD`], { cwd: p.root, encoding: "utf8" }).split("\n").filter(Boolean);
  const k = kind(p), bad = unformed(p, k);
  if (bad.length) { console.log(`the core's files and parts could not be read against the kit: ${bad.join("; ")}`); return; }
  const { kit } = kits(p, null, k);
  const read = kit.filter(([to]) => changed.includes(to) && !p.differences.some(l => l.includes(`"${to}"`))).map(([to, want]) => [to, judged(p, base, to, want)]);
  const wrong = read.filter(([, j]) => j === "wrong").map(([to]) => to);
  for (const [to] of read.filter(([, j]) => j === "stale")) console.log(`${to}: ${BLOCKS.includes(to) ? "the core's part of it" : "the core's file"} stood otherwise than the core writes it before this pull request, which ${BLOCKS.includes(to) ? "left that part as it was" : "did not bring it nearer"}: reported, not failed. Mend, in a task: run \`node ${copyAt(p)}scripts/converge.mjs --write\` and commit what it writes.`);
  for (const to of wrong) console.log(`FAIL ${to}: ${BLOCKS.includes(to) ? "the core's part of it" : "the core's file"} is not as the core writes it for this project at its pin. Mend: run \`node ${copyAt(p)}scripts/converge.mjs --write\`, which writes it again, and commit it; or, to keep the change as the project's own, ${BLOCKS.includes(to) ? "write it outside the core's part" : "take out its first line, the core's mark, and name the file in core-manifest.md's \"Differences\" on the owner's word"}.`);
  if (wrong.length) process.exitCode = 1;
  else console.log("the core's files and parts the pull request changed are as the core writes them");
}

// Of one file the pull request changed, `to`, the kit writing `want`: null where it is no file or part the core
// marks or is as the core writes it; "stale" where it stood otherwise on the base and the pull request left the part
// as it was, or did not bring the file back (reported, never failed); else "wrong".
function judged(p, base, to, want) {
  const now = p.read(to, true), block = BLOCKS.includes(to), ours = t => block ? blockOf(t) !== null : marked(to) && /^# The core's file:/u.test(t);
  if (now === null || !ours(now)) return null;
  if (block ? lf(blockOf(now)) === blockOf(want) : now === want) return null;
  const was = atBase(p, base, to), part = t => lf(blockOf(t) ?? "");
  if (was === null) return "wrong";
  return (block ? part(was) === part(now) : was !== want && ours(was)) ? "stale" : "wrong";
}

// The file `to` as the base holds it, or null where it holds none.
function atBase(p, base, to) {
  try { return execFileSync("git", ["show", `${base}:${to}`], { cwd: p.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }); } catch { return null; }
}

if (started(import.meta.url)) {
  try { run(process.argv.slice(2)); } catch (e) {
    console.error(`FAIL: the process could not read the project (${String(e.message).split("\n")[0].slice(0, 160)}). Mend: run it from the project's root, a git repository that holds core-manifest.md`);
    process.exitCode = 1;
  }
}
