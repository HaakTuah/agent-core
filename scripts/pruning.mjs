// The pruning of the core's rules (AGENTS.md, "Rules are pruned by their numbers"; #303). With every second monthly
// state report (state-report.mjs, beside this file, says when one is due), and in a month whose session runs on a newer
// generation of model than the last pruning's, the session that takes the report runs each staged case (staged.mjs)
// set from the core with the rules the case holds taken out, records the counts the rules' numbers read for the span
// since the last pruning, and adds the list this prints. The list names each rule of the floor, the modules and the
// core's AGENTS.md that:
//   - names a number (holders.json, "numbers", in outcomes.mjs's form NUMBER) that did not move since the last pruning;
//   - stands in for an outcome (its number not one of the outcome's direct measures) and moved at two prunings in a row
//     while those measures did not, each by the count outcomes.mjs's MEASURES give (DIRECT: a median left out; fast,
//     readable and usable have none);
//   - is held by a check that fired nowhere in the span: no step of a workflow that runs it failed on a pull request,
//     read from GitHub's record of each failed run's jobs and their steps, and from the workflows' steps as the core's
//     own reader of YAML gives them (workflow-run.mjs, beside this file); a check no step names is not judged so;
//   - is held by a staged case that passed without it.
// Each listed with its step of the pruning: a rule read at a role's start (an AGENTS.md rule is, here) is at step 1, to
// move to a module read on need; one read on need is at step 2, to go where nothing changed since it moved. A rule
// fewer than EARLY merged pull requests came under since it joined (read from git: the first commit that wrote its lead
// in bold, and the merges on the first-parent line since) is "too early" and not judged; one that guards against rare
// and severe harm, of the floor or with a number marked "; rare harm", is never listed for its check alone. Beside the list, under "in use", the citations of each rule in the span
// (cited.mjs, beside this file), which say a rule is applied and never that it helps. It removes nothing: the owner
// decides which go. The record is RECORD, written by --read and --record and committed in a pull request of its own.
// The core's own repository alone. Git, gh and Node's own modules.
//
//   node scripts/pruning.mjs                               the list, from the record's newest pruning
//   node scripts/pruning.mjs --due [--model <id>]          whether a pruning is due this month, and why
//   node scripts/pruning.mjs --set <case> <dir>            sets the staged case up in <dir>, a new folder under the
//                                                          system's temporary folder, from the core at HEAD with the
//                                                          rules it holds taken out, and prints the brief
//   node scripts/pruning.mjs --read <case> <dir>           once that session has ended: its verdict, written into
//                                                          today's pruning
//   node scripts/pruning.mjs --record --repo <owner/name> [--model <id>] [--owner <login>]
//                                                          the counts of the span since the last pruning, read through
//                                                          gh and written into today's pruning
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KINDS, MEASURES, NUMBER } from "./outcomes.mjs";
import { ROOT, rules } from "./rules.mjs";
import { started } from "./started.mjs";

export const RECORD = "reports/pruning.json";
export const EVERY = 2, EARLY = 20;
// The outcomes' direct measures (outcomes.mjs; #302) that a count gives, whose counts a pruning records: a median's
// measure gives only how many cases it read, not its value, so it is left out.
export const DIRECT = MEASURES.filter(m => m.direct && !m.median);
const ABOUT = "The prunings of the core's rules (scripts/pruning.mjs; AGENTS.md, \"Rules are pruned by their numbers\"): each pruning's day, the model of the session that took it, the span its counts read (from its day back to the last pruning's), each rule's number as it counted then (\"numbers\"), the count of each outcome's direct measure (\"direct\") and of each kind of correction (\"corrections\"), the failed steps of the runs on a pull request, by workflow and step (\"fired\"), each rule's citations (\"cited\"), and each staged case's verdict with the rules it holds taken out (\"without\"). Written by `node scripts/pruning.mjs --read` and `--record`; committed in a pull request of its own.";

// The record: { prunings: [{ at, model, from, numbers, direct, corrections, fired, cited, without }] }, oldest first.
export function readRecord(root = ROOT) {
  try { const r = JSON.parse(fs.readFileSync(path.join(root, RECORD), "utf8")); return Array.isArray(r.prunings) ? r : { prunings: [] }; } catch { return { prunings: [] }; }
}
const writeRecord = (record, root = ROOT) => fs.writeFileSync(path.join(root, RECORD), `${JSON.stringify({ about: ABOUT, prunings: record.prunings }, null, 2)}\n`);
const ordered = record => [...record.prunings].filter(p => /^\d{4}-\d\d-\d\d$/u.test(String(p?.at))).sort((a, b) => a.at.localeCompare(b.at));

// The generation of a model: the first whole number of its id or name ("claude-opus-5-5" gives 5), or null.
export const generation = model => { const m = /\d+/u.exec(String(model ?? "")); return m ? Number(m[0]) : null; };
const monthIndex = month => { const [y, m] = String(month).split("-").map(Number); return y * 12 + m - 1; };
const monthAt = i => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

// Whether a pruning is due in `month` (YYYY-MM): { due, why }. Due where none is recorded, where EVERY months have
// passed since the newest, or where `model` is of a newer generation than the newest's.
export function due({ month, record, model = null }) {
  const last = ordered(record).at(-1);
  if (!last) return { due: true, why: "no pruning is recorded yet" };
  const then = last.at.slice(0, 7);
  if (monthIndex(month) - monthIndex(then) >= EVERY) return { due: true, why: `the last pruning was in ${then}, and one is due with every second report` };
  const now = generation(model), was = generation(last.model);
  if (now !== null && was !== null && now > was) return { due: true, why: `the model of this session (${model}) is of a newer generation than the last pruning's (${last.model})` };
  return { due: false, why: `the last pruning was in ${then}; the next is due in ${monthAt(monthIndex(then) + EVERY)}` };
}

// The state report's lines on the pruning, for `month`.
export function said({ month, record = readRecord() }) {
  const d = due({ month, record });
  if (d.due) return [`- Due: ${d.why}. The session that takes this report prunes as the core's \`AGENTS.md\`, "Rules are pruned by their numbers", says: each staged case set with the rules it holds taken out (\`node scripts/pruning.mjs --set <case> <dir>\`), run in a fresh helper and read (\`--read\`), the counts recorded (\`--record --repo <this repository> --model <its model's id>\`), and the list \`node scripts/pruning.mjs\` prints added here as a note, \`${RECORD}\` in a pull request of its own.`];
  return [`- Not due: ${d.why}, or sooner where the session that takes a report runs on a newer generation of model than the last pruning's (\`node scripts/pruning.mjs --due --model <its id>\`).`];
}

// The rule files' texts with the rules `keys` taken out, a rule's items with it: { texts: { file: text }, missing },
// from `all` (rules.mjs's rules) and `read(file)`; `missing`, the keys that are no rule as they stand.
export function without(keys, all, read) {
  const texts = {}, missing = [];
  for (const key of keys) {
    const r = all.find(x => x.key === key);
    if (!r) { missing.push(key); continue; }
    texts[r.file] ??= String(read(r.file)).replace(/\r\n/gu, "\n");
    // (a rule inside one already taken out went with it)
    texts[r.file] = texts[r.file].replace(r.text, "").replace(/\n{3,}/gu, "\n\n");
  }
  return { texts, missing };
}

// The steps that run the check `by` (a holder's script, or a workflow, all of whose steps do), each "<workflow>#<its
// name>", from `steps` ({ workflow: [{ name, run }] }).
export const stepsOf = (by, steps) => Object.entries(steps).flatMap(([w, list]) => list.filter(st => (by.startsWith(".github/workflows/") ? w === by : String(st.run ?? "").includes(by))).map(st => `${w}#${st.name}`));

// The checks a rule's holders name (holders.json's "holders"), each a script or workflow, or GitHub's setting.
export const checksOf = (key, named) => [named[key] ?? []].flat().map(h => /^check: (.+?)(?:, in part)?$/u.exec(String(h))?.[1]).filter(Boolean);

// A rule's number as a pruning `x` counted it, or null.
const numberAt = (x, key) => (typeof x?.numbers?.[key] === "number" ? x.numbers[key] : null);

// The sign that the number `n` of the rule `key` did not move between the last two prunings of `p`, or null.
function stood(key, n, p) {
  const now = p.at(-1), was = p.at(-2), v = numberAt(now, key);
  return n && v !== null && v === numberAt(was, key) ? `its number did not move (${v}, as at ${was.at})` : null;
}

// The sign that the number `n` of the rule `key`, a stand-in, moved at each of the last two prunings of `p` while the
// direct measures of the outcome it stands for did not; null where they moved, or where the outcome has none. A number
// that is a direct measure's own count (`correction: misread` for "asked") stands in for nothing.
function standIn(key, n, p) {
  const [, what, outcome] = (n && NUMBER.exec(n)) || [], direct = DIRECT.filter(m => m.outcome === outcome);
  if (!direct.length || direct.some(m => what === `correction: ${m.key}`) || p.length < 3) return null;
  const last = p.slice(-3), v = last.map(x => numberAt(x, key)), o = last.map(x => direct.map(m => x.direct?.[m.key]));
  if (v.includes(null) || o.flat().some(x => typeof x !== "number") || v[0] === v[1] || v[1] === v[2] || `${o[0]}` !== `${o[1]}` || `${o[1]}` !== `${o[2]}`) return null;
  return `its number moved at two prunings while its outcome, ${outcome}, did not (${direct.map((m, i) => `${m.key}: ${o[2][i]}`).join(", ")})`;
}

// Whether the rule `r`, with its number `n`, guards against rare and severe harm: one of the floor, or one whose number
// says so.
export const rare = (r, n) => r.file.startsWith("floor/") || / ?; rare harm$/u.test(String(n ?? ""));

// The sign that no step that runs a check of the rule `r` (`checks`) failed on a pull request in the newest pruning's
// span; null where one did, where a check is run by no step known, or for a rule that guards against rare harm.
function silent(r, n, checks, steps, now) {
  const runs = checks.map(by => stepsOf(by, steps));
  if (!now?.fired || rare(r, n) || !runs.length || runs.some(x => !x.length) || runs.flat().some(x => now.fired[x])) return null;
  return `its check never fired from ${now.from ?? "the start"} to ${now.at} (${[...new Set(runs.flat())].join("; ")})`;
}

// The signs that a rule may go, from the prunings `p` (oldest first, the newest last), its number `n` (or undefined),
// its checks (scripts or workflows), the workflows' steps, and the staged cases that hold it.
function signsOf(r, { p, n, checks, steps, cases }) {
  const now = p.at(-1), passed = cases.filter(c => now.without?.[c.name]?.verdict === "pass").map(c => `its staged case ${c.name} passed without it`);
  return [stood(r.key, n, p), standIn(r.key, n, p), silent(r, n, checks, steps, now), ...passed].filter(Boolean);
}

// The list's closing lines: what was too early or could not be read, the citations "in use", and who decides.
function closing({ all, numbers, now, early, unread }) {
  const cited = Object.entries(now.cited ?? {}).filter(([, k]) => k > 0).sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  const most = cited.length ? `; the most cited: ${cited.slice(0, 5).map(([k, x]) => `${k} (${x})`).join(", ")}` : "";
  return [
    ...(early.length ? [`- Too early, not judged (merged pull requests since it joined, under ${EARLY}): ${early.join("; ")}.`] : []),
    ...(unread.length ? [`- Not judged, since when it joined could not be read from git: ${unread.join("; ")}.`] : []),
    `- In use: ${cited.length} of ${all.length} rules cited in the span${most}. A citation says a rule is applied, never that it helps.`,
    `- No number named: ${all.filter(r => !numbers[r.key]).length} rules; each names one when it is next added or widened.`,
    "- The owner decides which go, a few at a time, the numbers read again before more go; a rule that goes is kept in the archive with its reason and its last number. No session removes one by its own choice.",
  ];
}

// The list's lines. `all`: the rules (rules.mjs's); `named`: holders.json's "holders"; `numbers`: its "numbers";
// `record`; `cases`: the staged cases ({ name, holds }); `steps`: the workflows' steps, { path: [{ name, run }] };
// `starts`: the keys of the rules a role reads at its start; `joined(r)`: how many merged pull requests came under the rule since it joined, or null.
export function list({ all, named, numbers, record, cases, steps, starts, joined }) {
  const p = ordered(record), now = p.at(-1);
  if (!now) return ["- No pruning is recorded yet: nothing to list (`node scripts/pruning.mjs --due`)."];
  const listed = [], early = [], unread = [];
  for (const r of all) {
    const n = numbers[r.key], signs = signsOf(r, { p, n, checks: checksOf(r.key, named), steps, cases: cases.filter(c => c.holds.includes(r.key)) });
    const came = signs.length ? joined(r) : undefined;
    if (came === undefined) continue;
    if (came === null) unread.push(r.key);
    else if (came < EARLY) early.push(`${r.key} (${came})`);
    else {
      const step = starts.has(r.key) ? "1, read at a role's start: it moves first to a module read on need" : "2, read on need: it may go, one moved there only where nothing changed after its move";
      listed.push(`- ${r.key}: ${signs.join("; ")}. Its step of the pruning: ${step}. Its number: ${n ?? "none named"}; cited ${now.cited?.[r.key] ?? 0} times.`);
    }
  }
  return [
    `- Read: the pruning of ${now.at}, against ${p.at(-2)?.at ?? "none before it"}; ${Object.keys(now.without ?? {}).length} staged cases run with their rules taken out; counts from ${now.from ?? "the start"} (\`scripts/pruning.mjs\`).`,
    ...(listed.length ? listed : ["- Nothing listed: no rule shows a sign that it may go."]),
    ...closing({ all, numbers, now, early, unread }),
  ];
}

const git = (args, cwd = ROOT) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 });

// How many merged pull requests came under the rule `r` since it joined, read from git at `root`; null where the
// commit that first wrote its lead in bold cannot be found.
export function joinedIn(r, root = ROOT) {
  try {
    const first = git(["log", "--reverse", "--format=%cI", "-S", `**${r.lead}`, "HEAD"], root).split("\n").find(Boolean);
    if (!first) return null;
    return git(["log", "--first-parent", "--format=%s", `--since=${first}`, "HEAD"], root).split("\n").filter(s => /^Merge pull request #\d+|\(#\d+\)$/u.test(s)).length;
  } catch { return null; }
}

// The workflows' named steps at `root`: { path: [{ name, run }] }, read by the core's own reader of YAML, each mapping
// written on one line as a list's item (a matrix's, which holds no step) set aside first, since it reads none; a
// workflow it cannot read has none.
export async function stepsAt(root = ROOT) {
  const { parseYaml } = await import("./workflow-run.mjs"), dir = path.join(root, ".github", "workflows"), out = {};
  for (const f of fs.readdirSync(dir).filter(x => /\.ya?ml$/u.test(x))) {
    let yaml = {};
    try { yaml = parseYaml(fs.readFileSync(path.join(dir, f), "utf8").replace(/^(\s*-[ \t]+)\{[^\n]*\}[ \t]*$/gmu, "$1(set aside)")); } catch { /* (none read) */ }
    out[`.github/workflows/${f}`] = Object.values(yaml.jobs ?? {}).flatMap(j => (Array.isArray(j?.steps) ? j.steps : [])).filter(st => typeof st?.name === "string").map(st => ({ name: st.name, run: st.run ?? "" }));
  }
  return out;
}
const holdersAt = root => JSON.parse(fs.readFileSync(path.join(root, "scripts", "holders.json"), "utf8"));

// Today's pruning in the record, made where there is none.
function today(record, model) {
  const at = new Date().toISOString().slice(0, 10);
  let p = record.prunings.find(x => x.at === at);
  if (!p) { p = { at, model: model ?? "not said" }; record.prunings.push(p); }
  if (model) p.model = model;
  return p;
}

// Each rule's findings from `from` on: Map ruleOf-key -> the merged pull requests whose reviews name it on a line
// "Rule:" (review-record.mjs).
async function findingsOf({ repo, from, to, owner, gh }) {
  const { pagesOf } = await import("./labels.mjs"), { mergedIn } = await import("./cited.mjs"), { rulesNamed } = await import("./review-record.mjs");
  const numberOf = url => Number(/\/(\d+)$/u.exec(String(url ?? ""))?.[1]), route = r => `repos/${repo}/${r}?since=${from}&sort=created&direction=asc`;
  const issueComments = pagesOf(route("issues/comments"), gh), inline = pagesOf(route("pulls/comments"), gh), out = new Map();
  for (const m of mergedIn(repo, from, to, gh)) {
    const named = rulesNamed(issueComments.filter(c => numberOf(c.issue_url) === m.number), inline.filter(c => numberOf(c.pull_request_url) === m.number), owner);
    for (const rule of named) out.set(rule, (out.get(rule) ?? 0) + 1);
  }
  return out;
}

// The outcomes' direct measures and the corrections of each kind, from `from` to `to`, as outcomes-read.mjs reads
// them within its budget: { direct: { key: count }, corrections: { kind: count } }; each null where it ran out.
async function outcomesOf({ repo, from, to, owner, gh }) {
  const { read } = await import("./outcomes-read.mjs"), w = { from: Date.parse(from), to: Date.parse(to) };
  let data;
  try { data = read(repo, w.from, w.to, owner, gh); } catch (e) { if (e instanceof RangeError) return { direct: null, corrections: null }; throw e; }
  const corrections = Object.fromEntries(KINDS.map(k => [k, data.corrections.filter(c => c.kind === k && Date.parse(c.at) >= w.from && Date.parse(c.at) < w.to).length]));
  return { direct: Object.fromEntries(DIRECT.map(m => [m.key, m.of(data, w).n])), corrections };
}

// The steps that failed on a pull request from `from` to `to`, each "<workflow>#<step's name>": { step: count }, read
// from each failed run's jobs.
function firedOf({ repo, from, to, gh }) {
  const out = {};
  for (let page = 1; page <= 50; page++) {
    const runs = JSON.parse(gh(`repos/${repo}/actions/runs?event=pull_request&status=failure&created=${from.slice(0, 10)}..${to.slice(0, 10)}&per_page=100&page=${page}`) || "{}").workflow_runs ?? [];
    for (const run of runs.filter(x => x.path && Number.isInteger(x.id))) {
      const jobs = JSON.parse(gh(`repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`) || "{}").jobs ?? [];
      for (const st of jobs.flatMap(j => j.steps ?? []).filter(x => x.conclusion === "failure")) out[`${run.path}#${st.name}`] = (out[`${run.path}#${st.name}`] ?? 0) + 1;
    }
    if (runs.length < 100) break;
  }
  return out;
}

// Each rule's citations from `from`'s month to `to`'s (cited.mjs): { key: count }.
async function citedOf({ repo, from, to, gh, all }) {
  const { texts, count, matchers, after } = await import("./cited.mjs");
  const out = {}, m = matchers(all);
  for (let month = from.slice(0, 7); month <= to.slice(0, 7); month = after(month)) {
    for (const [, s] of count(texts(repo, month, gh).items, m)) for (const [k, x] of s.by) out[k] = (out[k] ?? 0) + x;
  }
  return out;
}

// The counts of `repo` from `from` to `to` (ISO times), through `gh` (labels.mjs's ghApi form): { numbers, direct,
// corrections, fired, cited }, each rule's number as `numbers` (holders.json's) names it: its findings, its check's
// fires (of the steps `stepsOfRule(key)` gives), or the corrections of a kind (null where they were not read).
export async function counts({ repo, from, to, owner, gh, all, numbers, stepsOfRule }) {
  const span = { repo, from, to, owner, gh }, { ruleOf } = await import("./review-record.mjs");
  const findings = await findingsOf(span), { direct, corrections } = await outcomesOf(span), fired = firedOf(span), cited = await citedOf({ ...span, all });
  const of = {
    findings: key => findings.get(ruleOf(key)) ?? 0,
    "check fires": key => stepsOfRule(key).reduce((sum, x) => sum + (fired[x] ?? 0), 0),
  };
  const nums = Object.fromEntries(Object.entries(numbers).filter(([, n]) => NUMBER.test(n)).map(([key, n]) => {
    const what = NUMBER.exec(n)[1];
    return [key, of[what] ? of[what](key) : corrections?.[what.slice("correction: ".length)] ?? null];
  }));
  return { numbers: nums, direct, corrections, fired, cited };
}

const fail = msg => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };

// The staged case named, with the folder after it, or null where either is missing, said with its mend.
async function caseAndDir(argv, flag) {
  const { caseOf, CASES } = await import("./staged.mjs");
  const c = caseOf(argv[argv.indexOf(flag) + 1]), dir = argv[argv.indexOf(flag) + 2];
  if (!c) return fail(`no staged case is named ${argv[argv.indexOf(flag) + 1] ?? "(none)"}. Mend: name one of ${CASES.map(x => x.name).join(", ")}`), null;
  if (!dir) return fail(`${flag} needs the case's folder after its name. Mend: give a new folder under the system's temporary folder`), null;
  return { c, dir: path.resolve(dir) };
}

// --set: a clone of the core at HEAD, the case's rules taken out in a commit of its own, from which the case is set.
async function setCmd(argv) {
  const got = await caseAndDir(argv, "--set");
  if (!got) return;
  const { setCase } = await import("./staged.mjs");
  const core = fs.mkdtempSync(path.join(os.tmpdir(), "pruning-core-"));
  try {
    // (with no origin, the kit holds the pin to no main: the commit that takes the rules out stands on none)
    git(["clone", "--quiet", ROOT, core]);
    git(["remote", "remove", "origin"], core);
    const all = rules(core, { agents: true }), cut = without(got.c.holds, all, f => fs.readFileSync(path.join(core, f), "utf8"));
    if (cut.missing.length) return fail(`${got.c.name} holds rules that no longer stand: ${cut.missing.join("; ")}. Mend: bring the case's list of rules up to date in scripts/staged/${got.c.name}.mjs, in a pull request of its own`);
    for (const [f, t] of Object.entries(cut.texts)) fs.writeFileSync(path.join(core, f), t);
    git(["-c", "user.name=pruning", "-c", "user.email=pruning@example.invalid", "-c", "commit.gpgsign=false", "commit", "-q", "-am", `Taken out for the pruning: ${got.c.holds.join("; ")}`], core);
    console.log(setCase(got.c, got.dir, { core, at: git(["rev-parse", "HEAD"], core).trim() }));
  } catch (e) {
    fail(`${got.c.name} could not be set without its rules in ${got.dir}: ${String(e.message).split("\n").filter(Boolean).join(" ")}. Mend: give a new folder under the system's temporary folder, from a clone of the core with git on its path`);
  } finally { fs.rmSync(core, { recursive: true, force: true }); }
}

// --read: the verdict of a case set by --set, into today's pruning.
async function readCmd(argv, get) {
  const got = await caseAndDir(argv, "--read");
  if (!got) return;
  const { memoOf, sealOf, Unreadable } = await import("./staged/scratch.mjs"), { unplaced } = await import("./staged.mjs");
  if (!fs.existsSync(got.dir) || !fs.existsSync(path.join(sealOf(fs.realpathSync(got.dir)), "meta.json"))) return fail(`${got.dir} holds no case set by --set. Mend: give the folder the case was set in`);
  const meta = memoOf(fs.realpathSync(got.dir), "meta");
  if (meta.case !== got.c.name || Object.values(meta.rules ?? {}).some(f => f !== null)) return fail(`${got.dir} was not set for ${got.c.name} with its rules taken out. Mend: set it with \`node scripts/pruning.mjs --set ${got.c.name} <a new folder>\`, and run it again`);
  let v;
  try { v = got.c.read(fs.realpathSync(got.dir)); } catch (e) { if (!(e instanceof Unreadable)) throw e; v = { pass: false, why: `its repositories could not be read: ${e.message}` }; }
  const record = readRecord(), p = today(record, get("--model"));
  (p.without ??= {})[got.c.name] = { verdict: v.pass ? "pass" : "fail", why: unplaced(v.why) };
  writeRecord(record);
  console.log(`${got.c.name}, without its rules: ${v.pass ? "pass" : "fail"}: ${v.why}\nrecorded in ${RECORD}`);
}

// --record: the counts of the span, into today's pruning.
async function recordCmd(get) {
  const repo = get("--repo");
  if (!/^[\w-]+\/[\w.-]+$/u.test(repo ?? "")) return fail("--record needs --repo <owner/name>. Mend: name the core's repository, as GitHub spells it");
  const { ghApi } = await import("./labels.mjs");
  const record = readRecord(), last = ordered(record).filter(x => x.at < new Date().toISOString().slice(0, 10)).at(-1);
  const to = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"), from = last ? `${last.at}T00:00:00Z` : new Date(Date.now() - EVERY * 31 * 864e5).toISOString().replace(/\.\d{3}Z$/u, "Z");
  let c;
  const h = holdersAt(ROOT), steps = await stepsAt(ROOT), stepsOfRule = key => checksOf(key, h.holders ?? {}).flatMap(by => stepsOf(by, steps));
  try { c = await counts({ repo, from, to, owner: get("--owner") ?? repo.split("/")[0], gh: ghApi, all: rules(ROOT, { agents: true }), numbers: h.numbers ?? {}, stepsOfRule }); }
  catch (e) { return fail(`GitHub did not answer for ${repo}: ${String(e.message).split("\n")[0]}. Mend: run it where gh answers for the owner's account, or try again once GitHub does`); }
  Object.assign(today(record, get("--model")), { from, ...c });
  writeRecord(record);
  console.log(`the counts from ${from} recorded in ${RECORD}`);
}

async function main(argv) {
  const get = flag => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] ?? null : null; };
  if (argv.includes("--set")) return setCmd(argv);
  if (argv.includes("--read")) return readCmd(argv, get);
  if (argv.includes("--record")) return recordCmd(get);
  if (argv.includes("--due")) { const d = due({ month: new Date().toISOString().slice(0, 7), record: readRecord(), model: get("--model") }); return console.log(`${d.due ? "due" : "not due"}: ${d.why}`); }
  const { startRules } = await import("./cited.mjs");
  const { CASES } = await import("./staged.mjs");
  // (the core's AGENTS.md, which every builder here reads at its start, with the floor and the modules)
  const all = rules(ROOT, { agents: true }), h = holdersAt(ROOT), starts = new Set([...all.filter(r => r.file === "AGENTS.md").map(r => r.key), ...[...startRules(all).values()].flatMap(x => [...x])]);
  console.log(list({ all, named: h.holders ?? {}, numbers: h.numbers ?? {}, record: readRecord(), cases: CASES, steps: await stepsAt(ROOT), starts, joined: r => joinedIn(r) }).join("\n"));
}

if (started(import.meta.url)) await main(process.argv.slice(2));
