// What holds each rule of the floor and the modules (AGENTS.md, "Every rule says what holds it"; #235, part D): one of
// three, a check that fails where the rule is broken, a staged case (staged.mjs, beside this file), or the scheduled
// audit. holders.json, beside this file, names the checks and the audit by each rule's file and lead (rules.mjs); each
// staged case names the rules it holds in its own file. A rule with none is listed, in the core's monthly state report
// (state-report.mjs), until it gains one or goes on the owner's word. A hook (HOOKS) holds no rule alone: one whose
// only holders are hooks is listed with them (tasks/tools.md, "Hooks save time; checks are the guarantee"). It fails where holders.json names a rule that no
// longer stands, a check whose file is not there, or a holder in no form it reads; a rule with no holder fails nothing.
// It reads too the archive's items behind each rule ("behind" in holders.json; #252): it fails a key that is no rule nor
// rule file, an item that is not in the archive, a pointer to the archive ("core archive N") written in a rule file
// itself, and the archive's two forms out of step (archive.mjs, beside this file). And the number each rule names
// ("numbers" in holders.json; #303): it fails a key that is no rule, and a number in no form outcomes.mjs's NUMBER reads.
// The core's own repository; its tests workflow runs it on every pull request here. In a project (--project, from its
// root; #459, point 1), it reads the project's own rules the same way: each rule of its own rule files (those SECURITY.md
// names, rule-files.mjs, the copy of the core aside), with what its list, checks/holders.json, says of it: what holds it
// ("check: <path>", "test: <path>", "review" or "describes") and what it is about ("this project", "its kind: <kind>" or
// "every project", #484, points 9 and 10). It lists each rule the list does not name, each entry for a rule that no
// longer stands or a check that is not there, and the rules about a kind or about every project, which the audit's
// session files to the core as ideas (tasks/cleaning.md); it fails nothing, since a rule with no check is a debt the
// audit reads, not a fault. Node's own modules only, and git.
//
//   node scripts/holders.mjs                 the counts, and each wrong entry with its mend
//   node scripts/holders.mjs --list          the counts, and each rule with no holder
//   node core/scripts/holders.mjs --project  in a project: its own rules, by what holds them
import fs from "node:fs";
import path from "node:path";
import { inStep, items } from "./archive.mjs";
import { NUMBER } from "./outcomes.mjs";
import { FOLDERS, ROOT, rules, rulesOf } from "./rules.mjs";
import { started } from "./started.mjs";
import { CASES } from "./staged.mjs";

export const FILE = "scripts/holders.json";
const FORM = /^(?:(check): (.+?)|(audit)|(describes))(, in part)?$/u;
// The hooks a check may name: what a tool runs by itself in a session, which a session of another tool never runs.
export const HOOKS = new Set(["scripts/work-saved.sh", "scripts/helper-call.mjs", "setup/template/claude-settings.json.tmpl"]);
const hook = x => x.kind === "check" && HOOKS.has(x.by);

// One holder as holders.json names it for the rule `key`: { kind, by, part }, or the line of what is wrong, with its mend.
function holderOf(key, value, root) {
  const m = FORM.exec(String(value));
  if (!m) return `${FILE}: "${key}" has the holder "${value}", in no form it reads. Mend: write "check: <its script, workflow or GitHub's setting>", "audit" or "describes", each with ", in part" where it holds only some of the rule; a staged case names its rules in its own file`;
  const kind = m[1] ?? m[3] ?? m[4], what = m[2] ?? "";
  if (kind === "check" && /^(?:scripts|\.github|setup|floor|roles|tasks|tools)\//u.test(what) && !fs.existsSync(path.join(root, what))) return `${FILE}: "${key}" is held by ${what}, which is not there. Mend: name the check as it now stands, or take the holder out`;
  return { kind, by: what, part: Boolean(m[5]) };
}

// What holders.json names, and the items behind each rule, or the line of why it cannot be read.
function named(root) {
  try { const j = JSON.parse(fs.readFileSync(path.join(root, FILE), "utf8")); return { named: j.holders ?? {}, behind: j.behind ?? {}, numbers: j.numbers ?? {} }; }
  catch (e) { return { named: {}, behind: {}, numbers: {}, wrong: `${FILE} cannot be read (${e.message}). Mend: write it as JSON, its "holders" an object keyed by each rule's file and lead` }; }
}

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

// What is wrong with the items behind the rules, each a line with its mend.
function behindWrong(root, behind) {
  const wrong = [], files = ruleFilesOf(root), keys = new Set([...rules(root, { agents: true }).map(r => r.key), ...files]);
  const { reasons } = items(root);
  for (const [key, list] of Object.entries(behind)) {
    if (!keys.has(key)) { wrong.push(`${FILE}, "behind", names "${key}", which is no rule, nor rule file, as they stand. Mend: write the key as the rule's file and bold lead now read, or the file alone for its text outside any rule, or take it out where the rule has gone`); continue; }
    if (!Array.isArray(list) || !list.length || !list.every(Number.isInteger)) { wrong.push(`${FILE}, "behind", "${key}": ${JSON.stringify(list)} is no list of item numbers. Mend: write it as a list of the archive's item numbers, such as [134, 232]`); continue; }
    for (const n of list.filter(n => !reasons.has(n))) wrong.push(`${FILE}, "behind", "${key}": core archive ${n} is no item of the archive. Mend: name an item that stands in archive/instructions/, or add the item first`);
  }
  for (const f of files) {
    fs.readFileSync(path.join(root, f), "utf8").split(/\r?\n/u).forEach((line, i) => {
      if (/\bcore\s+archive\s+\d/iu.test(line) || /\bcore\s+archive\s*$/iu.test(line)) wrong.push(`${f}:${i + 1} points to the archive in the rule's own text ("core archive"). Mend: take the pointer out and add its items to the rule's list under "behind" in ${FILE}`);
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
    else if (!NUMBER.test(String(n))) wrong.push(`${FILE}, "numbers", "${key}": "${n}" is in no form it reads. Mend: write "<findings | check fires | correction: <kind>>; outcome: <asked | fast | readable | usable | robust>", the count the rule is meant to lower and the outcome it stands for, with "; rare harm" at its end where the rule guards against rare and severe harm`);
  }
  return wrong;
}

// Each rule with its holders ([{ kind, by, part }]), and what is wrong with holders.json, each a line with its mend.
export function holders(root = ROOT, cases = CASES) {
  const all = rules(root), keys = new Set(all.map(r => r.key)), read = named(root), wrong = read.wrong ? [read.wrong] : [];
  const by = new Map(all.map(r => [r.key, []]));
  for (const [key, value] of Object.entries(read.named)) {
    if (!keys.has(key)) { wrong.push(`${FILE} names "${key}", which is no rule of the floor or the modules as they stand. Mend: write the key as the rule's file and bold lead now read ("floor/security.md: 1. Nothing secret in the repository"), or take it out where the rule has gone`); continue; }
    for (const h of (Array.isArray(value) ? value : [value]).map(v => holderOf(key, v, root))) {
      if (typeof h === "string") wrong.push(h); else by.get(key).push(h);
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

// ---- a project's own rules (--project) ----

export const OWN = "checks/holders.json";
const OWN_HELD = /^(?:(check|test): (\S.*)|(review)|(describes))$/u;
const ABOUT = /^(?:this project|its kind: \S.*|every project)$/u;

// A project's own rules (`files`, its rule files, read by `read`) against its list (the text of checks/holders.json,
// or null): { rules, counts: { all, check, test, review, describes }, none, wrong, toCore }.
export function ownRules(files, read, listText) {
  const all = files.filter(f => !f.startsWith("core/") && f !== "core-manifest.md").flatMap(f => { const t = read(f); return t === null ? [] : rulesOf(f, t); });
  const keys = new Set(all.map(r => r.key)), wrong = [], toCore = [];
  let list = {};
  if (listText !== null) {
    try { list = JSON.parse(listText)?.rules ?? {}; } catch { wrong.push(`${OWN} cannot be read as JSON. Mend: write it as { "rules": { "<file>: <bold lead>": { "held": "check: <path>", "about": "this project" } } }`); }
    if (!list || typeof list !== "object" || Array.isArray(list)) { wrong.push(`${OWN} holds no "rules" object. Mend: write it as { "rules": { "<file>: <bold lead>": { "held": ..., "about": ... } } }`); list = {}; }
  }
  const counts = { all: all.length, check: 0, test: 0, review: 0, describes: 0 }, none = [];
  for (const r of all) {
    const e = Object.hasOwn(list, r.key) ? list[r.key] : null, m = OWN_HELD.exec(String(e?.held ?? ""));
    if (!e || !m) { none.push(r.key); if (e) wrong.push(`${OWN}: "${r.key}" is held by "${e.held}", in no form it reads. Mend: write "check: <path>", "test: <path>", "review" or "describes"`); continue; }
    const kind = m[1] ?? m[3] ?? m[4];
    // (a check or test that is not there holds nothing: its entry is said, and the rule is counted as held by none)
    if (m[2] && !/^[a-z]+:/iu.test(m[2]) && read(m[2]) === null) wrong.push(`${OWN}: "${r.key}" is held by ${m[2]}, which is not there. Mend: name the check or test that holds it, or what holds it now`);
    else counts[kind]++;
    if (!ABOUT.test(String(e.about ?? ""))) wrong.push(`${OWN}: "${r.key}" says no "about" the check reads. Mend: write "this project", "its kind: <kind>" or "every project"`);
    else if (e.about !== "this project") toCore.push(`${r.key} (${e.about})`);
  }
  for (const k of Object.keys(list)) if (!keys.has(k)) wrong.push(`${OWN}: "${k}" names no rule that stands. Mend: take it out, or name the rule by its file and bold lead as it stands now`);
  return { rules: all, counts, none, wrong, toCore };
}

// Of the core's rules, those a check holds whole in a project, none whose every check read nothing there (`nothing`,
// the scripts read-nothing.mjs names, as core/scripts/<name>): { held, all }.
export function heldThere(root, nothing) {
  const h = holders(root), gone = new Set(nothing.map(n => n.replace(/^core\//u, "")));
  let held = 0;
  for (const r of h.rules) if ((h.by.get(r.key) ?? []).some(x => x.kind === "check" && !x.part && !hook(x) && !gone.has(x.by))) held++;
  return { held, all: h.rules.length };
}

// The line a project's state report carries (state-report.mjs; #459, point 3).
export const shareLine = (own, core) => `- rules held by a check: the project's own ${own.counts.check + own.counts.test} of ${own.counts.all}, the core's ${core.held} of ${core.all}.`;

if (started(import.meta.url) && process.argv.includes("--project")) {
  // (each file read only where it lies inside the project and is a file: a path that leads out, a link to a device or a
  // folder, reads as not there)
  const { readHere: read, ruleFiles } = await import("./rule-files.mjs");
  let files;
  try { files = ruleFiles(); } catch (e) {
    // (in the core's own repository, whose SECURITY.md names no rule files of a project's, the rules are its own list's)
    console.log(fs.existsSync(path.join(process.cwd(), FILE)) && !fs.existsSync(path.join(process.cwd(), "core")) ? "FAIL this is the core's own repository, whose rules holders.json lists. Mend: run node scripts/holders.mjs --list here" : `FAIL ${e.message}`);
    process.exit(1);
  }
  const o = ownRules(files, read, read(OWN));
  const c = o.counts;
  console.log(`Of the project's own ${c.all} rules: ${c.check} held by a check, ${c.test} by a test, ${c.review} by the review, ${c.describes} describe; ${o.none.length} not in ${OWN}${o.none.length ? `: ${o.none.join("; ")}` : ""}.`);
  if (o.toCore.length) console.log(`About a kind or every project, each to file to the core as an idea where none is filed yet, written for the kind and holding nothing of this project, no file's name and no rule's own words ("Reporting to the core"): ${o.toCore.join("; ")}.`);
  for (const w of o.wrong) console.log(`note ${w}`);
} else if (started(import.meta.url)) {
  const h = holders();
  const lines = report().map(l => l.slice(2));
  console.log(process.argv.includes("--list") ? lines.join("\n") : lines[0]);
  for (const w of h.wrong) console.error(`FAIL ${w}`);
  if (h.wrong.length) process.exitCode = 1;
}
