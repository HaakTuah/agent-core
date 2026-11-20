// What holds each rule of the floor and the modules (AGENTS.md, "Every rule says what holds it"; #235, part D), and of
// the core's own AGENTS.md, counted apart (#925): one of three, a check that fails where the rule is broken, a staged
// case (staged.mjs, beside this file), or the scheduled audit. The list is a folder, scripts/holders/, of one file for
// each rule (#750, point 1; #853), read in the order of the files' names and named from the rule's key (entryFile):
// {"rule": its file and bold lead as rules.mjs names it, or a rule file alone for its text outside any rule; "holder":
// one holder or a list of them; "behind": the keys of the core archive's items behind it ("a rule file names no item
// itself": AGENTS.md, "The archive is pointed to from the list"; a number up to 262, or "#N" or "#N.P" for one keyed by
// its issue); "number": "<findings | check fires | correction: <kind>>; outcome: <asked | fast | readable | usable |
// robust>", the count it is meant to lower and the outcome it stands for, which pruning.mjs reads}, each but "rule"
// only where the rule has one. A holder is "check: <the script, test, workflow or hook that fails a pull request or a
// step where the rule is broken, or opens an issue by itself; or GitHub's setting that refuses it>", "audit" (the scheduled audit reads it) or "describes" (it only points
// elsewhere or says what is protected, and binds no one), each with ", in part" where it holds some of the rule and
// the rest has none. A rule with no entry has no holder. Each staged case names the rules it holds in its own file. A rule with none is listed, in the core's monthly state report
// (state-report.mjs), until it gains one or goes on the owner's word. A hook (HOOKS) holds no rule alone: one whose
// only holders are hooks is listed with them (tasks/tools.md, "Hooks save time; checks are the guarantee"). It fails where an entry names a rule that no
// longer stands, a check whose file is not there, or a holder in no form it reads; a rule with no holder fails nothing.
// It reads too the archive's items behind each rule ("behind" in an entry; #252): it fails a key that is no rule nor
// rule file, an item's key that names no issue (#744), an item that is not in the archive, a pointer to the archive ("core archive N") written in a rule file
// itself, and the archive's two forms out of step (archive.mjs, beside this file). And the number each rule names
// ("number" in an entry; #303): it fails a key that is no rule, and a number in no form outcomes.mjs's NUMBER reads.
// The list's form, read as the one list the entries make (each part an object, a holder a string or a list of them, a list behind a rule of keys in the
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

export const FILE = "scripts/holders";
// The file of a rule's entry in FILE/, named from the rule's key, so that its name is the same wherever it is written
// and two rules never share one: the rule file's name, "--", then the lead, each in lower case with a hyphen for each
// run of anything but letters and digits ("AGENTS.md: A part is asked again" stands in agents-md--a-part-is-asked-again.json).
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
export const entryFile = key => { const i = key.indexOf(": "); return `${i < 0 ? slug(key) : `${slug(key.slice(0, i))}--${slug(key.slice(i + 2))}`}.json`; };
const ENTRY_FIELDS = ["rule", "holder", "behind", "number"];
const FORM = /^(?:(check): (.+?)|(audit)|(describes))(, in part)?$/u;
// The hooks a check may name: what a tool runs by itself in a session, which a session of another tool never runs.
export const HOOKS = new Set(["scripts/work-saved.sh", "scripts/helper-call.mjs", "setup/template/claude-settings.json.tmpl"]);
const hook = x => x.kind === "check" && HOOKS.has(x.by);

// One holder as an entry names it for the rule `key`: { kind, by, part }, the line of what is wrong, with its mend,
// or null for one that is no string or an empty one, which the schema says (a project's list, which no schema reads,
// names it wrong where it meets one). `file` and `paths`: the list it stands in, and the names of a check that are
// paths to read as there or not. `show`: how a key or value is written into a line, which a project's list writes as a
// code span on one line.
function holderOf(key, value, root, file = FILE, paths = /^(?:scripts|tests|\.github|setup|floor|roles|tasks|tools)\//u, show = t => `"${t}"`) {
  if (typeof value !== "string" || !value) return null;
  const m = FORM.exec(value);
  if (!m) return `${file}: ${show(key)} has the holder ${show(value)}, in no form it reads. Mend: write "check: <its script, workflow or GitHub's setting>", "audit" or "describes", each with ", in part" where it holds only some of the rule${file === FILE ? "; a staged case names its rules in its own file" : ', or "none" where nothing holds it'}`;
  const kind = m[1] ?? m[3] ?? m[4], what = m[2] ?? "";
  if (kind === "check" && paths.test(what) && (!inProject(what) || !fs.existsSync(path.join(root, what)))) return `${file}: ${show(key)} is held by ${show(what)}, which is not there. Mend: name the check as it now stands, or take the holder out`;
  return { kind, by: what, part: Boolean(m[5]) };
}

// What the entries of FILE/ name, merged as the one list they make ({ holders, behind, numbers }, each keyed by the rule),
// and the items behind each rule, or the line of why they cannot be read (reasons.mjs, beside this file, reads it too).
// `faults`: each entry that is no file of its form, with its mend.
export function named(root) {
  const dir = path.join(root, FILE), json = { holders: {}, behind: {}, numbers: {} }, faults = [];
  let files;
  try { files = fs.readdirSync(dir).sort(); }
  catch (e) { return { named: {}, behind: {}, numbers: {}, faults, wrong: `${FILE}/ cannot be read (${e.message}). Mend: write one file for each rule in it, as the ones that stand there are written` }; }
  for (const f of files) {
    const { entry, fault } = entryOf(dir, f);
    if (fault) { faults.push(fault); continue; }
    faults.push(...entryFaults(f, entry));
    for (const [from, to] of [["holder", "holders"], ["behind", "behind"], ["number", "numbers"]]) if (from in entry) json[to][entry.rule] = entry[from];
  }
  return { json, named: json.holders, behind: json.behind, numbers: json.numbers, faults };
}

// The entry the file `f` of FILE/ holds, or the line of why it is none, with its mend.
function entryOf(dir, f) {
  if (!f.endsWith(".json")) return { fault: `${FILE}/${f} is no entry, which is a file of JSON. Mend: move it out of ${FILE}/, or write the rule's entry in a file named ${f.replace(/\.[^.]*$/u, "")}.json` };
  let e;
  try { e = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
  catch (x) { return { fault: `${FILE}/${f} cannot be read (${String(x.message).split("\n")[0]}). Mend: write it as JSON, an object with the rule's "rule" and its "holder", "behind" and "number"` }; }
  if (e === null || typeof e !== "object" || Array.isArray(e) || typeof e.rule !== "string" || !e.rule) return { fault: `${FILE}/${f} is no object with a "rule". Mend: write it as {"rule": "<the rule's file and lead>", "holder": ..., "behind": [...], "number": "..."}, each but "rule" only where the rule has one` };
  return { entry: e };
}

// What is wrong with an entry that is one: a part it does not read, a file not named from its rule.
function entryFaults(f, e) {
  const faults = [], extra = Object.keys(e).filter(k => !ENTRY_FIELDS.includes(k));
  if (extra.length) faults.push(`${FILE}/${f} has "${extra.join('", "')}", which an entry does not read. Mend: keep "rule", "holder", "behind" and "number", and take the rest out`);
  if (f !== entryFile(e.rule)) faults.push(`${FILE}/${f} holds the rule "${e.rule}", which stands in ${entryFile(e.rule)}. Mend: rename the file to ${entryFile(e.rule)}, so that two pull requests that add a rule never write the same file`);
  return faults;
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
    if (!keys.has(key)) { wrong.push(`${FILE}/${entryFile(key)} ("behind") names "${key}", which is no rule, nor rule file, as they stand. Mend: write the key as the rule's file and bold lead now read, or the file alone for its text outside any rule, or take it out where the rule has gone`); continue; }
    if (!Array.isArray(list)) continue; // (the schema says it is no list, and a key in no form)
    for (const n of list.filter(n => inForm(n) && !reasons.has(n))) wrong.push(`${FILE}/${entryFile(key)} ("behind"): core archive ${n} is no item of the archive. Mend: name an item that stands in archive/instructions/, or add the item first, keyed by its issue (archive/instructions.md)`);
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
    if (!keys.has(key)) wrong.push(`${FILE}/${entryFile(key)} ("number") names "${key}", which is no rule as they stand. Mend: write the key as the rule's file and bold lead now read, and rename the file to match, or take it out where the rule has gone`);
    else if (typeof n === "string" && n && !NUMBER.test(n)) wrong.push(`${FILE}/${entryFile(key)} ("number"): "${n}" is in no form it reads. Mend: write "<findings | check fires | correction: <kind>>; outcome: <asked | fast | readable | usable | robust>", the count the rule is meant to lower and the outcome it stands for, with "; rare harm" at its end where the rule guards against rare and severe harm`);
  }
  return wrong;
}

// The rules whose entries would stand in one file, each set a line with its mend.
function sharedFiles(all) {
  const files = new Map();
  for (const r of all) files.set(entryFile(r.key), [...(files.get(entryFile(r.key)) ?? []), r.key]);
  return [...files].filter(([, ks]) => ks.length > 1).map(([f, ks]) => `${FILE}/${f} would be the entry of ${ks.map(k => `"${k}"`).join(" and ")}. Mend: reword the lead of one of them so that their file names differ`);
}

// Each rule of the floor and the modules with its holders ([{ kind, by, part }]), and what is wrong with the entries,
// each a line with its mend; `own`, the core's own rules, those of its AGENTS.md, the same way ({ rules, by }), counted
// apart (#925).
export function holders(root = ROOT, cases = CASES) {
  const every = rules(root, { agents: true }), all = every.filter(r => r.file !== "AGENTS.md"), mine = every.filter(r => r.file === "AGENTS.md");
  const read = named(root), wrong = read.wrong ? [read.wrong] : [...read.faults];
  if (!read.wrong) wrong.push(...(shapeFaults("holders", read.json, "", FILE) ?? []));
  const by = new Map(all.map(r => [r.key, []])), ownBy = new Map(mine.map(r => [r.key, []])), mapOf = key => by.get(key) ?? ownBy.get(key);
  for (const [key, value] of Object.entries(read.named)) {
    if (!mapOf(key)) { wrong.push(`${FILE}/${entryFile(key)} names "${key}", which is no rule of the floor, the modules or AGENTS.md as they stand. Mend: write the key as the rule's file and bold lead now read ("floor/security.md: 1. Nothing secret in the repository"), or take it out where the rule has gone`); continue; }
    for (const h of (Array.isArray(value) ? value : [value]).map(v => holderOf(key, v, root))) {
      if (typeof h === "string") wrong.push(h); else if (h) mapOf(key).push(h);
    }
  }
  for (const c of cases) for (const key of c.holds) mapOf(key)?.push({ kind: "case", by: c.name, part: c.inPart.includes(key) });
  wrong.push(...sharedFiles(every));
  if (!read.wrong) wrong.push(...behindWrong(root, read.behind), ...numbersWrong(root, read.numbers));
  return { rules: all, by, wrong, own: { rules: mine, by: ownBy } };
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
  const h = holders(root), c = counts(h);
  return [
    `- Of ${c.all} rules of the floor and the modules: ${c.check} held whole by a check, ${c.case} by a staged case, ${c.audit} by the audit, ${c.part} in part; ${c.describes} describe and bind no one; ${c.none.length} have no holder${c.hooked.length ? `, ${c.hooked.length} of them held by a hook alone, which a session of another tool never runs` : ""} (\`scripts/holders.mjs\`).`,
    coreShare(c, counts(h.own)),
    ...(c.none.length ? [`- No holder, each until it gains one or goes on the owner's word: ${c.none.join("; ")}.`] : []),
  ];
}

// The core's share (#459, point 3), as a project's report gives its own: the rules held whole by a check, of the floor
// and the modules (`c`) and of the core's own, those of its AGENTS.md (`own`; #925), each as counts() gives them.
const coreShare = (c, own) => `- rules held by a check: the floor's and the modules' ${c.check} of ${c.all}; the core's own ${own.check} of ${own.all}, those of \`AGENTS.md\`.`;

// Of the core's rules a project takes (the floor's always, a module's unless its manifest leaves it out: `out`, by the
// file's name), how many a check holds whole there, by the core's own list: { held, all }, none counted whose every
// check read nothing there (`nothing`, the scripts read-nothing.mjs names, by their path in the core, scripts/shape.mjs;
// #459, point 3). A check the core's list names that a project may not have set up (a ruleset of the host's) counts as
// the list names it: the count is the core's map less what read nothing, as AGENTS.md's "The share a check holds is
// reported" says.
export function heldThere(root, nothing, out = new Set()) {
  const h = holders(root), gone = new Set(nothing);
  const taken = h.rules.filter(r => r.file.startsWith("floor/") || !out.has(path.posix.basename(r.file)));
  const held = taken.filter(r => (h.by.get(r.key) ?? []).some(x => x.kind === "check" && !x.part && !hook(x) && !gone.has(x.by))).length;
  return { held, all: taken.length };
}

// The line a project's state report carries (state-report.mjs): its own rules a check holds whole, as counts() gives
// them of ownHolders(), and the core's, as heldThere() gives them.
export const shareLine = (own, core) => `- rules held by a check: the project's own ${own.check} of ${own.all}, the core's ${core.held} of ${core.all}.`;

// ---- a project's own rules (#662) ----
export const OWN = "checks/holders.json";
// (text from a project's files as the report and the log carry it: on one line, in a code span, so that no line break,
// workflow command or mention in it acts: floor rule 5)
const span = t => `\`${oneLine(t).replace(/`/gu, "'")}\``;
// (a check's name that is a path of the project: a file name with its extension, or one with a folder)
const OWN_PATHS = /^(?:[\w.@-]+\/)+[\w.@-]+$|^[\w-]+\.\w+$/u;
// Whom a rule of the project's own is about (#484, point 9), as the list's "about" names it, keyed as "holders" is.
const ABOUT = /^(?:this project|every project|its kind: (\S.{0,79}))$/u;
const ABOUT_FORMS = '"this project", "its kind: <the kind>" or "every project"';

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
  return { rules: all, by, wrong, start, list: text !== null, about: answersOf(text, by, wrong) };
}

// The list's answers of whom each rule is about (#484, point 9), by the rule's key, those in no form pushed to `wrong`
// with their mend; none where the list is not there or cannot be read (said with its holders).
function answersOf(text, by, wrong) {
  const about = new Map();
  let answers = {};
  try { answers = text === null ? {} : JSON.parse(text).about ?? {}; } catch { return about; }
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) { wrong.push(`${OWN}: its "about" is no object. Mend: write it as an object keyed by each rule's file and lead, as "holders" is, each value ${ABOUT_FORMS}`); return about; }
  for (const [key, value] of Object.entries(answers)) {
    if (!by.has(key)) wrong.push(`${OWN}'s "about" names ${span(key)}, which is no rule of the project's own rule files as they stand. Mend: write the key as the rule's file and bold lead now read, or take it out where the rule has gone`);
    else if (typeof value !== "string" || !ABOUT.test(value)) wrong.push(`${OWN}: ${span(key)} is said to be about ${span(String(value))}. Mend: write ${ABOUT_FORMS}`);
    else about.set(key, value);
  }
  return about;
}

// The lines a project's state report carries: its own rules by what holds them, those with none worst first (read at a
// session's start before those read on need), and each wrong line of its list; `scripts`: where the core's scripts are.
export function ownReport(root = process.cwd(), scripts = "core/scripts") {
  const h = ownHolders(root), c = counts(h), files = [...new Set(h.rules.map(r => r.file))];
  if (!h.rules.length) return ["- The project's own rule files hold no rule with a bold lead, so none is counted."];
  const none = [...c.none.filter(k => h.start.has(k)), ...c.none.filter(k => !h.start.has(k))];
  const unanswered = h.rules.map(r => r.key).filter(k => !h.about.has(k)), wider = [...h.about].filter(([, v]) => v !== "this project");
  return [
    `- Of ${c.all} rules of the project's own (${files.map(span).join(", ")}): ${c.check} held whole by a check, ${c.audit} by the audit, ${c.part} in part; ${c.describes} describe and bind no one; ${c.none.length} have no holder (\`node ${scripts}/holders.mjs --own\`, its list \`${OWN}\`${h.list ? "" : ", not written yet"}).`,
    ...(none.length ? [`- No holder, worst first (read at a session's start, then on need): the session that takes this report files each as a task at the project's pace, a check where one can read its breach exactly, named in \`${OWN}\`; a move to where it is read on need; or a proposal that it goes, which is the owner's to decide. Where its file is a copy made from elsewhere, the change goes to whoever writes that source. Nothing fails meanwhile: ${none.map(span).join("; ")}.`] : []),
    // (whom each rule is about: #484, point 9, as #459's note adds it)
    ...(unanswered.length ? [`- Whom a rule is about, ${h.about.size} of ${c.all} answered: the session that takes this report answers of each of the rest whether it is about this project, its kind or every project, in \`${OWN}\`'s "about", keyed as "holders" is, ${ABOUT_FORMS}: ${unanswered.map(span).join("; ")}.`] : []),
    ...(wider.length ? [`- About a kind or every project: the session that takes this report files each to the core as an idea where none is filed yet (search first), naming the kind, written for the kind and holding nothing of the project (\`${scripts.replace(/scripts\/?$/u, "")}README.md\`, "Reporting to the core"): ${wider.map(([k, v]) => `${span(k)}, ${span(v)}`).join("; ")}.`] : []),
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
  console.log(unreached("ajv") ? `::warning::The form of ${FILE}/ was not checked: the package ajv could not be installed, the registry not answering. Mend: run this job again before the pull request merges; if it fails again, file it as a fault`
    : `::warning::The form of ${FILE}/ was not checked: the package ajv is not installed. Mend: run node scripts/install.mjs, then this check again`);
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
