// What holds each rule of the floor and the modules (AGENTS.md, "Every rule says what holds it"; #235, part D): one of
// three, a check that fails where the rule is broken, a staged case (staged.mjs, beside this file), or the scheduled
// audit. holders.json, beside this file, names the checks and the audit by each rule's file and lead (rules.mjs); each
// staged case names the rules it holds in its own file. A rule with none is listed, in the core's monthly state report
// (state-report.mjs), until it gains one or goes on the owner's word. A hook (HOOKS) holds no rule alone: one whose
// only holders are hooks is listed with them (tasks/tools.md, "Hooks save time; checks are the guarantee"). It fails where holders.json names a rule that no
// longer stands, a check whose file is not there, or a holder in no form it reads; a rule with no holder fails nothing.
// It reads too the archive's items behind each rule ("behind" in holders.json; #252): it fails a key that is no rule nor
// rule file, an item's key that names no issue (#744), an item that is not in the archive, a pointer to the archive ("core archive N") written in a rule file
// itself, and the archive's two forms out of step (archive.mjs, beside this file). And the number each rule names
// ("numbers" in holders.json; #303): it fails a key that is no rule, and a number in no form outcomes.mjs's NUMBER reads.
// The file's form (each part an object, a holder a string or a list of them, a list behind a rule of keys in the
// archive's form, a number a string) is its schema's, scripts/schemas/holders.json, read by ajv (schemas.mjs; #530);
// where ajv is not installed the form goes unchecked, said as a warning, and what holds its form is read as ever.
// The core's own repository alone; its tests workflow runs it on every pull request here, after the core's install.
// In a project, --own reads the project's own rules the same way (#662): those of the rule files its sessions read, as
// the project's own files name them (floor rule 3's, the files an agent tool takes its instructions from, what its
// SECURITY.md adds, and the files its AGENTS.md and CLAUDE.md pull in by an "@" line, none of the core's copy, where its
// manifest places it), against its list OWN, which names for each its check, test, simulation or script, "audit",
// "describes" or "none". It fails nothing there, a wrong entry of the list included: the project's monthly state report
// lists each rule with no holder, those read at a session's start first, and its sessions work them down as tasks.
//
//   node scripts/holders.mjs                     the counts, and each wrong entry with its mend
//   node scripts/holders.mjs --list              the counts, and each rule with no holder
//   node core/scripts/holders.mjs --own          from a project's root: its own rules' counts, and each with no holder
//   node core/scripts/holders.mjs --own --write  the same, after writing OWN: each rule it does not name added as "none"
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { inStep, items, KEY, LAST_NUMBERED } from "./archive.mjs";
import { copyOf } from "./core-path.mjs";
import { inProject, leadsOut, oneLine } from "./guards.mjs";
import { NUMBER } from "./outcomes.mjs";
import { installed, unreached } from "./packages.mjs";
import { FLOOR, ruleFiles, toolFiles } from "./rule-files.mjs";
import { FOLDERS, ROOT, rules, rulesOf } from "./rules.mjs";
import { shapeFaults } from "./schemas.mjs";
import { started } from "./started.mjs";
import { CASES } from "./staged.mjs";

export const FILE = "scripts/holders.json";
const FORM = /^(?:(check): (.+?)|(audit)|(describes))(, in part)?$/u;
// The hooks a check may name: what a tool runs by itself in a session, which a session of another tool never runs.
export const HOOKS = new Set(["scripts/work-saved.sh", "scripts/helper-call.mjs", "setup/template/claude-settings.json.tmpl"]);
const hook = x => x.kind === "check" && HOOKS.has(x.by);

// One holder as holders.json names it for the rule `key`: { kind, by, part }, the line of what is wrong, with its mend,
// or null for one that is no string or an empty one, which the schema says (a project's list, which no schema reads,
// names it wrong where it meets one). `file` and `paths`: the list it stands in, and the names of a check that are
// paths to read as there or not. `show`: how a key or value is written into a line, which a project's list writes as a
// code span on one line.
function holderOf(key, value, root, file = FILE, paths = /^(?:scripts|\.github|setup|floor|roles|tasks|tools)\//u, show = t => `"${t}"`) {
  if (typeof value !== "string" || !value) return null;
  const m = FORM.exec(value);
  if (!m) return `${file}: ${show(key)} has the holder ${show(value)}, in no form it reads. Mend: write "check: <its script, workflow or GitHub's setting>", "audit" or "describes", each with ", in part" where it holds only some of the rule${file === FILE ? "; a staged case names its rules in its own file" : ', or "none" where nothing holds it'}`;
  const kind = m[1] ?? m[3] ?? m[4], what = m[2] ?? "";
  if (kind === "check" && paths.test(what) && (!inProject(what) || !fs.existsSync(path.join(root, what)))) return `${file}: ${show(key)} is held by ${show(what)}, which is not there. Mend: name the check as it now stands, or take the holder out`;
  return { kind, by: what, part: Boolean(m[5]) };
}

// What holders.json names, and the items behind each rule, or the line of why it cannot be read (reasons.mjs, beside
// this file, reads it too).
export function named(root) {
  try { const j = JSON.parse(fs.readFileSync(path.join(root, FILE), "utf8")); return { json: j, named: part(j?.holders), behind: part(j?.behind), numbers: part(j?.numbers) }; }
  catch (e) { return { named: {}, behind: {}, numbers: {}, wrong: `${FILE} cannot be read (${e.message}). Mend: write it as JSON, its "holders" an object keyed by each rule's file and lead` }; }
}

// (a part of the file as it holds its form, an object, else none: the schema says what it is)
const part = v => (v !== null && typeof v === "object" && !Array.isArray(v) ? v : {});

// The rule files a pointer to the archive may not stand in: the core's AGENTS.md and the files of the floor and the
// modules, as rules.mjs reads them.
export function ruleFilesOf(root) {
  const out = fs.existsSync(path.join(root, "AGENTS.md")) ? ["AGENTS.md"] : [];
  for (const folder of FOLDERS) {
    const dir = path.join(root, folder);
    if (fs.existsSync(dir)) out.push(...fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort().map(f => `${folder}/${f}`));
  }
  return out;
}

// A key in the archive's form, as the schema reads it: a number up to the last numbered item, or "#N" or "#N.P".
const inForm = n => (Number.isInteger(n) && n >= 1 && n <= LAST_NUMBERED) || (typeof n === "string" && KEY.test(n));

// What is wrong with the items behind the rules, each a line with its mend.
function behindWrong(root, behind) {
  const wrong = [], files = ruleFilesOf(root), keys = new Set([...rules(root, { agents: true }).map(r => r.key), ...files]);
  const { reasons } = items(root);
  for (const [key, list] of Object.entries(behind)) {
    if (!keys.has(key)) { wrong.push(`${FILE}, "behind", names "${key}", which is no rule, nor rule file, as they stand. Mend: write the key as the rule's file and bold lead now read, or the file alone for its text outside any rule, or take it out where the rule has gone`); continue; }
    if (!Array.isArray(list)) continue; // (the schema says it is no list, and a key in no form)
    for (const n of list.filter(n => inForm(n) && !reasons.has(n))) wrong.push(`${FILE}, "behind", "${key}": core archive ${n} is no item of the archive. Mend: name an item that stands in archive/instructions/, or add the item first, keyed by its issue (archive/instructions.md)`);
  }
  for (const f of files) {
    fs.readFileSync(path.join(root, f), "utf8").split(/\r?\n/u).forEach((line, i) => {
      if (/\bcore\s+archive\s+#?\d/iu.test(line) || /\bcore\s+archive\s*$/iu.test(line)) wrong.push(`${f}:${i + 1} points to the archive in the rule's own text ("core archive"). Mend: take the pointer out and add its items to the rule's list under "behind" in ${FILE}`);
    });
  }
  return [...wrong, ...inStep(root)];
}

// What is wrong with the number each rule names ("numbers"), each a line with its mend: keyed as "behind" is, by a
// rule of the floor, the modules or AGENTS.md.
function numbersWrong(root, numbers) {
  const keys = new Set(rules(root, { agents: true }).map(r => r.key)), wrong = [];
  for (const [key, n] of Object.entries(numbers)) {
    if (!keys.has(key)) wrong.push(`${FILE}, "numbers", names "${key}", which is no rule as they stand. Mend: write the key as the rule's file and bold lead now read, or take it out where the rule has gone`);
    else if (typeof n === "string" && n && !NUMBER.test(n)) wrong.push(`${FILE}, "numbers", "${key}": "${n}" is in no form it reads. Mend: write "<findings | check fires | correction: <kind>>; outcome: <asked | fast | readable | usable | robust>", the count the rule is meant to lower and the outcome it stands for, with "; rare harm" at its end where the rule guards against rare and severe harm`);
  }
  return wrong;
}

// Each rule with its holders ([{ kind, by, part }]), and what is wrong with holders.json, each a line with its mend.
export function holders(root = ROOT, cases = CASES) {
  const all = rules(root), keys = new Set(all.map(r => r.key)), read = named(root), wrong = read.wrong ? [read.wrong] : [];
  if (!read.wrong) wrong.push(...(shapeFaults("holders", read.json, "", FILE) ?? []));
  const by = new Map(all.map(r => [r.key, []]));
  for (const [key, value] of Object.entries(read.named)) {
    if (!keys.has(key)) { wrong.push(`${FILE} names "${key}", which is no rule of the floor or the modules as they stand. Mend: write the key as the rule's file and bold lead now read ("floor/security.md: 1. Nothing secret in the repository"), or take it out where the rule has gone`); continue; }
    for (const h of (Array.isArray(value) ? value : [value]).map(v => holderOf(key, v, root))) {
      if (typeof h === "string") wrong.push(h); else if (h) by.get(key).push(h);
    }
  }
  for (const c of cases) for (const key of c.holds) if (by.has(key)) by.get(key).push({ kind: "case", by: c.name, part: c.inPart.includes(key) });
  if (!read.wrong) wrong.push(...behindWrong(root, read.behind), ...numbersWrong(root, read.numbers));
  return { rules: all, by, wrong };
}

// The counts: rules held whole, in part, described only, and with no holder; and the rules with none.
export function counts({ rules: all, by }) {
  const out = { all: all.length, check: 0, case: 0, audit: 0, part: 0, describes: 0, none: [], hooked: [] };
  for (const r of all) {
    const h = by.get(r.key) ?? [];
    if (h.some(hook) && h.every(x => hook(x) || x.kind === "describes")) { out.none.push(r.key); out.hooked.push(r.key); continue; }
    if (!h.length) { out.none.push(r.key); continue; }
    if (h.every(x => x.kind === "describes")) { out.describes++; continue; }
    const whole = h.filter(x => x.kind !== "describes" && !x.part && !hook(x)); // (a hook beside a check counts for none)
    if (!whole.length) { out.part++; continue; }
    out[whole.some(x => x.kind === "check") ? "check" : whole.some(x => x.kind === "case") ? "case" : "audit"]++;
  }
  return out;
}

// The lines the state report carries.
export function report(root = ROOT) {
  const c = counts(holders(root));
  return [
    `- Of ${c.all} rules of the floor and the modules: ${c.check} held whole by a check, ${c.case} by a staged case, ${c.audit} by the audit, ${c.part} in part; ${c.describes} describe and bind no one; ${c.none.length} have no holder${c.hooked.length ? `, ${c.hooked.length} of them held by a hook alone, which a session of another tool never runs` : ""} (\`scripts/holders.mjs\`).`,
    ...(c.none.length ? [`- No holder, each until it gains one or goes on the owner's word: ${c.none.join("; ")}.`] : []),
  ];
}

// ---- a project's own rules (#662) ----
export const OWN = "checks/holders.json";
// (text from a project's files as the report and the log carry it: on one line, in a code span, so that no line break,
// workflow command or mention in it acts: floor rule 5)
const span = t => `\`${oneLine(t).replace(/`/gu, "'")}\``;
// (a check's name that is a path of the project: a file name with its extension, or one with a folder)
const OWN_PATHS = /^(?:[\w.@-]+\/)+[\w.@-]+$|^[\w-]+\.\w+$/u;

// The project's own rule files under `root`: [{ file, start }], `start` where a session reads it at its start (its
// AGENTS.md and CLAUDE.md, and the files they pull in by an "@" line); and `read`, a file's text or null.
function ownRuleFiles(root) {
  const read = f => { try { const at = path.join(root, f); return inProject(f) && !leadsOut(root, at) && fs.statSync(at).isFile() ? fs.readFileSync(at, "utf8") : null; } catch { return null; } };
  // (the core's copy where the manifest places it, core/ by default: its rules are the core's, never the project's)
  const copy = copyOf(root), mine = f => !`${path.posix.normalize(f)}/`.startsWith(copy) && read(f) !== null;
  const list = dir => { try { return execFileSync("git", ["-C", root, "ls-files", "-z", "--", dir], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean); } catch { return []; } };
  const pulled = ["AGENTS.md", "CLAUDE.md"].flatMap(f => [...(read(f) ?? "").matchAll(/^@(\S+\.md)[ \t]*\r?$/gmu)].map(m => path.posix.normalize(m[1])));
  let listed;
  try { listed = ruleFiles(read, list, { tools: true }); } catch { listed = [...FLOOR, ...toolFiles(read, list)]; }
  const start = new Set(["AGENTS.md", "CLAUDE.md", ...pulled]);
  return { files: [...new Set([...listed, ...pulled])].filter(mine).map(file => ({ file, start: start.has(file) })), read };
}

// The project's own rules and what its list names for each, as holders() gives the core's: { rules, by, wrong, start,
// list }, `start` the keys of the rules read at a session's start, `list` whether OWN stands, `wrong` each line of the
// list that is wrong, with its mend.
export function ownHolders(root = process.cwd()) {
  const { files, read } = ownRuleFiles(root), all = files.flatMap(f => rulesOf(f.file, read(f.file)));
  const start = new Set(all.filter(r => files.find(f => f.file === r.file).start).map(r => r.key));
  const by = new Map(all.map(r => [r.key, []])), wrong = [], text = read(OWN);
  let named = {};
  if (text !== null) {
    try { named = JSON.parse(text).holders ?? {}; if (typeof named !== "object" || Array.isArray(named)) throw new Error('its "holders" is no object'); }
    catch (e) { named = {}; wrong.push(`${OWN} cannot be read (${span(String(e.message).split("\n")[0])}). Mend: write it as JSON, its "holders" an object keyed by each rule's file and lead`); }
  }
  for (const [key, value] of Object.entries(named)) {
    if (!by.has(key)) { wrong.push(`${OWN} names ${span(key)}, which is no rule of the project's own rule files as they stand. Mend: write the key as the rule's file and bold lead now read, or take it out where the rule has gone`); continue; }
    for (const v of (Array.isArray(value) ? value : [value]).filter(v => v !== "none")) {
      const h = holderOf(key, v, root, OWN, OWN_PATHS, span);
      // (a review reads what a session judged, and fails nothing by itself: it holds no rule)
      // (a holder that is no text, or an empty one, named once for its key however many it has)
      if (h === null) { const w = `${OWN}: ${span(key)} has a holder that is no text or an empty one. Mend: write each holder as "check: <its test, check, simulation or script>", "audit", "describes" or "none"`; if (!wrong.includes(w)) wrong.push(w); }
      else if (typeof h !== "string" && h.kind === "check" && /\breview/iu.test(h.by)) wrong.push(`${OWN}: ${span(key)} is held by ${span(h.by)}, a review, which holds no rule. Mend: name the test, check, simulation or script that fails where the rule is broken, or write "none"`);
      else if (typeof h === "string") wrong.push(h); else by.get(key).push(h);
    }
  }
  return { rules: all, by, wrong, start, list: text !== null };
}

// The lines a project's state report carries: its own rules by what holds them, those with none worst first (read at a
// session's start before those read on need), and each wrong line of its list; `scripts`: where the core's scripts are.
export function ownReport(root = process.cwd(), scripts = "core/scripts") {
  const h = ownHolders(root), c = counts(h), files = [...new Set(h.rules.map(r => r.file))];
  if (!h.rules.length) return ["- The project's own rule files hold no rule with a bold lead, so none is counted."];
  const none = [...c.none.filter(k => h.start.has(k)), ...c.none.filter(k => !h.start.has(k))];
  return [
    `- Of ${c.all} rules of the project's own (${files.map(span).join(", ")}): ${c.check} held whole by a check, ${c.audit} by the audit, ${c.part} in part; ${c.describes} describe and bind no one; ${c.none.length} have no holder (\`node ${scripts}/holders.mjs --own\`, its list \`${OWN}\`${h.list ? "" : ", not written yet"}).`,
    ...(none.length ? [`- No holder, worst first (read at a session's start, then on need): the session that takes this report files each as a task at the project's pace, a check where one can read its breach exactly, named in \`${OWN}\`; a move to where it is read on need; or a proposal that it goes, which is the owner's to decide. Where its file is a copy made from elsewhere, the change goes to whoever writes that source. Nothing fails meanwhile: ${none.map(span).join("; ")}.`] : []),
    ...h.wrong.map(w => `- ${w}.`),
  ];
}

// Writes OWN: each rule of the project's own it does not name yet added as "none", what it names kept.
export function writeOwn(root = process.cwd()) {
  const h = ownHolders(root), at = path.join(root, OWN);
  if (leadsOut(root, at)) throw new Error(`${OWN} leads out of the project. Mend: take out the link on its way, then run it again`);
  let j = {};
  if (fs.existsSync(at)) { try { j = JSON.parse(fs.readFileSync(at, "utf8")); } catch (e) { throw new Error(`${OWN} cannot be read (${span(String(e.message).split("\n")[0])}). Mend: write it as JSON, or take it out and run this again`); } }
  const named = j.holders && typeof j.holders === "object" && !Array.isArray(j.holders) ? j.holders : {};
  for (const r of h.rules) named[r.key] ??= "none";
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.writeFileSync(at, `${JSON.stringify({ ...j, holders: named }, null, 2)}\n`);
}

// Where ajv is not installed the file's form went unchecked: said as a warning, and the check goes on.
function unchecked() {
  if (installed("ajv")) return;
  console.log(unreached("ajv") ? `::warning::The form of ${FILE} was not checked: the package ajv could not be installed, the registry not answering. Mend: run this job again before the pull request merges; if it fails again, file it as a fault`
    : `::warning::The form of ${FILE} was not checked: the package ajv is not installed. Mend: run node scripts/install.mjs, then this check again`);
}

if (started(import.meta.url) && process.argv.includes("--own")) {
  if (process.argv.includes("--write")) { try { writeOwn(); } catch (e) { console.error(`FAIL ${e.message}`); process.exitCode = 1; } }
  console.log(ownReport().map(l => l.slice(2)).join("\n"));
} else if (started(import.meta.url)) {
  unchecked();
  const h = holders();
  const lines = report().map(l => l.slice(2));
  console.log(process.argv.includes("--list") ? lines.join("\n") : lines[0]);
  for (const w of h.wrong) console.error(`FAIL ${w}`);
  if (h.wrong.length) process.exitCode = 1;
}
