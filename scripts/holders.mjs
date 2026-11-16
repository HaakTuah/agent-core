// What holds each rule of the floor and the modules (AGENTS.md, "Every rule says what holds it"; #235, part D): one of
// three, a check that fails where the rule is broken, a staged case (staged.mjs, beside this file), or the scheduled
// audit. holders.json, beside this file, names the checks and the audit by each rule's file and lead (rules.mjs); each
// staged case names the rules it holds in its own file. A rule with none is listed, in the core's monthly state report
// (state-report.mjs), until it gains one or goes on the owner's word. A hook (HOOKS) holds no rule alone: one whose
// only holders are hooks is listed with them (tasks/tools.md, "Hooks save time; checks are the guarantee"). It fails where holders.json names a rule that no
// longer stands, a check whose file is not there, or a holder in no form it reads; a rule with no holder fails nothing.
// The core's own repository alone; its tests workflow runs it on every pull request here. Node's own modules only.
//
//   node scripts/holders.mjs          the counts, and each wrong entry with its mend
//   node scripts/holders.mjs --list   the counts, and each rule with no holder
import fs from "node:fs";
import path from "node:path";
import { ROOT, rules } from "./rules.mjs";
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

// What holders.json names, or the line of why it cannot be read.
function named(root) {
  try { return { named: JSON.parse(fs.readFileSync(path.join(root, FILE), "utf8")).holders ?? {} }; }
  catch (e) { return { named: {}, wrong: `${FILE} cannot be read (${e.message}). Mend: write it as JSON, its "holders" an object keyed by each rule's file and lead` }; }
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

if (started(import.meta.url)) {
  const h = holders();
  const lines = report().map(l => l.slice(2));
  console.log(process.argv.includes("--list") ? lines.join("\n") : lines[0]);
  for (const w of h.wrong) console.error(`FAIL ${w}`);
  if (h.wrong.length) process.exitCode = 1;
}
