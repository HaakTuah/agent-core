// What the upgrade test stands on (upgrade-test.mjs): it runs a workflow of the core's as GitHub would run it for a
// project, job by job and step by step, so that the test runs each check's own shell and not a copy of it. It reads
// the YAML the core's workflows are written in (block mappings and sequences, block scalars, plain and quoted scalars,
// flow sequences, comments), evaluates GitHub's expressions (`${{ }}`: contexts, literals, ! == != && || and the
// functions the core's workflows use), and runs each job whose `if` holds, a job for each combination of its matrix:
// each `run` step in bash as GitHub runs it (with -e, and pipefail where its shell is named bash), its env and its
// expressions filled in, its outputs read from GITHUB_OUTPUT; each `uses`
// step by a handler the caller gives for that action, or not at all, said so. A context, function or form it does not
// know throws, so a workflow the core changes in a way this cannot read fails the test, and is taught here, rather than
// running other than GitHub would. Run by the tests, and by check.mjs, which runs the core's checks from plain git where
// no GitHub runs them (tasks/hosts.md); no workflow of the core's runs it. Node's own modules.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---- YAML, as the core's workflows write it ----

const strip = line => { // a comment after a value: " #" outside quotes
  let q = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = ""; continue; }
    if ((c === '"' || c === "'") && (i === 0 || /[\s:[,{-]/.test(line[i - 1]))) q = c;
    else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
};
function scalar(text) {
  const t = text.trim();
  if (t.startsWith("'")) { if (!t.endsWith("'") || t.length < 2) throw new Error(`a quoted value not ended: ${t}`); return t.slice(1, -1).replace(/''/g, "'"); }
  if (t.startsWith('"')) { if (!t.endsWith('"') || t.length < 2) throw new Error(`a quoted value not ended: ${t}`); return JSON.parse(t); }
  if (t.startsWith("[")) {
    if (!t.endsWith("]")) throw new Error(`a flow sequence not ended: ${t}`);
    const inner = t.slice(1, -1).trim();
    return inner ? inner.split(",").map(scalar) : [];
  }
  if (t.startsWith("{") || t.startsWith("&") || t.startsWith("*") || t.startsWith("!")) throw new Error(`a YAML form this reader does not know: ${t}`);
  if (t === "true" || t === "false") return t === "true";
  if (t === "" || t === "null" || t === "~") return null;
  if (/^-?\d+$/.test(t)) return Number(t);
  return t;
}

// A key set as the mapping's own, even where it is __proto__, which a plain assignment would take as its prototype.
const own = (map, key, value) => Object.defineProperty(map, key, { value, enumerable: true, writable: true, configurable: true });
/** The workflow's YAML as plain values (keys as written: `on` stays the string "on"). */
export function parseYaml(text) {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const indentOf = l => l.length - l.trimStart().length;
  const blank = l => l.trim() === "" || l.trim().startsWith("#");
  const next = () => { while (i < raw.length && blank(raw[i])) i++; return i < raw.length ? raw[i] : null; };

  function block(header, parent) { // a block scalar: | or > with its chomping
    const style = header[0], chomp = header.includes("-") ? "strip" : header.includes("+") ? "keep" : "clip";
    const lines = [];
    let at = null;
    while (i < raw.length) {
      const l = raw[i];
      if (l.trim() === "") { lines.push(""); i++; continue; }
      const n = indentOf(l);
      if (n <= parent) break;
      at ??= n;
      if (n < at) break;
      lines.push(l.slice(at));
      i++;
    }
    while (chomp !== "keep" && lines.length && lines.at(-1) === "") lines.pop();
    let out = style === "|" ? lines.join("\n")
      : lines.reduce((acc, l, k) => (k === 0 ? l : l === "" ? `${acc}\n` : acc.endsWith("\n") ? acc + l : `${acc} ${l}`), "");
    if (chomp !== "strip" && lines.length) out += "\n";
    return out;
  }

  function value(rest, indent) { // what follows "key:" or "- "
    const r = strip(rest);
    if (/^[|>][-+]?$/.test(r)) return block(r, indent);
    if (r !== "") return scalar(r);
    const l = next();
    if (l === null) return null;
    const n = indentOf(l);
    if (n > indent || (n === indent && l.trimStart().startsWith("- "))) return node(n);
    return null;
  }

  function node(indent) {
    const first = next();
    if (first.trimStart().startsWith("- ") || first.trim() === "-") {
      const list = [];
      for (let l = next(); l !== null && indentOf(l) === indent && (l.trimStart().startsWith("- ") || l.trim() === "-"); l = next()) {
        const content = l.trimStart().slice(2);
        if (/^[\w.-]+:(\s|$)/.test(content)) { // a mapping that starts on the dash's line
          raw[i] = " ".repeat(indent + 2) + content;
          list.push(node(indent + 2));
        } else { i++; list.push(value(content, indent)); }
      }
      return list;
    }
    const map = {};
    for (let l = next(); l !== null && indentOf(l) === indent && !l.trimStart().startsWith("- "); l = next()) {
      const m = /^([\w.-]+|"[^"]*"|'[^']*'):(?:\s(.*)|$)/.exec(l.trimStart());
      if (!m) throw new Error(`a line this reader does not know: ${l.trim()}`);
      i++;
      own(map, scalar(m[1]), value(m[2] ?? "", indent));
    }
    const l = next();
    if (l !== null && indentOf(l) > indent) throw new Error(`a line indented where no value begins: ${l.trim()}`);
    return map;
  }

  return next() === null ? {} : node(indentOf(next()));
}

// ---- GitHub's expressions ----

const truthy = v => !(v === false || v === null || v === undefined || v === 0 || v === "" || Number.isNaN(v));
const str = v => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
const num = v => (v === null || v === undefined ? 0 : v === true ? 1 : v === false ? 0 : v === "" ? 0 : Number(v));
const equal = (a, b) => {
  a ??= null; b ??= null;
  if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
  if (typeof a === typeof b) return a === b;
  if (a === null || b === null) return false;
  return num(a) === num(b);
};

/** The value of an expression (without its `${{ }}`), in the contexts given and the job's state so far. */
export function evaluate(expr, contexts, state = { failed: false }) {
  const ps = { expr, contexts, tokens: tokenize(expr), p: 0, fns: expressionFunctions(state) };
  const out = orExpr(ps);
  if (ps.p !== ps.tokens.length) throw new Error(`an expression this reader does not know: ${expr}`);
  return out;
}

function tokenize(expr) {
  const tokens = [];
  for (let k = 0; k < expr.length;) {
    const rest = expr.slice(k);
    let m;
    if ((m = /^\s+/.exec(rest))) { k += m[0].length; continue; }
    if ((m = /^'(?:[^']|'')*'/.exec(rest))) tokens.push({ s: m[0].slice(1, -1).replace(/''/g, "'") });
    else if ((m = /^(==|!=|&&|\|\||<=|>=|[!()[\],.<>])/.exec(rest))) tokens.push({ op: m[0] });
    else if ((m = /^-?\d+(\.\d+)?/.exec(rest))) tokens.push({ n: Number(m[0]) });
    else if ((m = /^[A-Za-z_][\w-]*/.exec(rest))) tokens.push({ id: m[0] });
    else throw new Error(`an expression this reader does not know: ${expr}`);
    k += m[0].length;
  }
  return tokens;
}

// The functions an expression may call, by their lower-case names.
function expressionFunctions(state) {
  return {
    startswith: (a, b) => str(a).toLowerCase().startsWith(str(b).toLowerCase()),
    endswith: (a, b) => str(a).toLowerCase().endsWith(str(b).toLowerCase()),
    contains: (a, b) => (Array.isArray(a) ? a.some(x => equal(x, b)) : str(a).toLowerCase().includes(str(b).toLowerCase())),
    fromjson: a => JSON.parse(str(a)), tojson: a => JSON.stringify(a ?? null),
    format: (f, ...args) => str(f).replace(/\{\{|\}\}|\{(\d+)\}/g, (m, k) => (m === "{{" ? "{" : m === "}}" ? "}" : str(args[Number(k)]))),
    always: () => true, cancelled: () => !!state.cancelled, success: () => !state.failed, failure: () => state.failed,
  };
}

// The parser `ps` holds the expression, its tokens, the place it stands at, its contexts and its functions.
const peek = (ps, op) => ps.tokens[ps.p]?.op === op;
const take = (ps, op) => { if (!peek(ps, op)) throw new Error(`"${op}" expected in: ${ps.expr}`); ps.p++; };

function callExpr(ps, name) {
  const fn = ps.fns[name.toLowerCase()];
  if (!fn) throw new Error(`a function this reader does not know: ${name}`);
  take(ps, "(");
  const args = [];
  while (!peek(ps, ")")) { args.push(orExpr(ps)); if (!peek(ps, ")")) take(ps, ","); }
  take(ps, ")");
  return fn(...args);
}

function primaryExpr(ps) {
  const t = ps.tokens[ps.p++];
  if (!t) throw new Error(`an expression ends too soon: ${ps.expr}`);
  if (t.op === "(") { const v = orExpr(ps); take(ps, ")"); return v; }
  if ("s" in t) return t.s;
  if ("n" in t) return t.n;
  if (t.id === "true" || t.id === "false") return t.id === "true";
  if (t.id === "null") return null;
  if (t.id && peek(ps, "(")) return callExpr(ps, t.id);
  if (t.id) { if (!(t.id in ps.contexts)) throw new Error(`a context this test does not give: ${t.id} (in ${ps.expr})`); return ps.contexts[t.id]; }
  throw new Error(`an expression this reader does not know: ${ps.expr}`);
}

function postfixExpr(ps) {
  let v = primaryExpr(ps);
  for (;;) {
    if (peek(ps, ".")) { ps.p++; const t = ps.tokens[ps.p++]; if (!t?.id) throw new Error(`a property name expected in: ${ps.expr}`); v = v?.[t.id] ?? null; }
    else if (peek(ps, "[")) { ps.p++; const k = orExpr(ps); take(ps, "]"); v = v?.[k] ?? null; }
    else return v;
  }
}

const unaryExpr = ps => (peek(ps, "!") ? (ps.p++, !truthy(unaryExpr(ps))) : postfixExpr(ps));

const ordered = { "<": (a, b) => a < b, ">": (a, b) => a > b, "<=": (a, b) => a <= b, ">=": (a, b) => a >= b };
function compareExpr(ps) {
  let v = unaryExpr(ps);
  while (["<", ">", "<=", ">="].includes(ps.tokens[ps.p]?.op)) { const op = ps.tokens[ps.p++].op, w = unaryExpr(ps); v = ordered[op](num(v), num(w)); }
  return v;
}

function eqExpr(ps) {
  let v = compareExpr(ps);
  while (peek(ps, "==") || peek(ps, "!=")) { const op = ps.tokens[ps.p++].op, w = compareExpr(ps); v = op === "==" ? equal(v, w) : !equal(v, w); }
  return v;
}

function andExpr(ps) {
  let v = eqExpr(ps);
  while (peek(ps, "&&")) { ps.p++; const w = eqExpr(ps); v = truthy(v) ? w : v; }
  return v;
}

function orExpr(ps) {
  let v = andExpr(ps);
  while (peek(ps, "||")) { ps.p++; const w = andExpr(ps); v = truthy(v) ? v : w; }
  return v;
}

/** A text with each `${{ }}` in it filled in. */
export const fill = (text, contexts, state) => (typeof text === "string" ? text.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, e) => str(evaluate(e, contexts, state))) : text);
/** Whether an `if` holds: a whole `${{ }}`, or an expression written bare. Left out: success(). */
export function holds(cond, contexts, state) {
  if (cond === undefined || cond === null) return !state.failed;
  if (typeof cond === "boolean") return cond && !state.failed;
  const t = String(cond).trim();
  // (as GitHub reads it: a condition that asks no status of its own is read as success() && it)
  if (!/\b(?:success|failure|always|cancelled)\s*\(/u.test(t) && state.failed) return false;
  const whole = /^\$\{\{([\s\S]*)\}\}$/.exec(t);
  return truthy(whole ? evaluate(whole[1], contexts, state) : t.includes("${{") ? fill(t, contexts, state) : evaluate(t, contexts, state));
}

// ---- running a called workflow ----

// A value as written: a whole `${{ }}` gives the expression's own value (a list, say), anything else is text.
const valueOf = (v, contexts) => {
  const whole = typeof v === "string" && /^\s*\$\{\{([\s\S]*)\}\}\s*$/.exec(v);
  return whole ? evaluate(whole[1], contexts) : v;
};
// A job's matrix as its combinations ([null] for a job with none): each key's list, in GitHub's order. An include or an
// exclude, which this has no need of yet, stops the test, to be taught.
function combinations(matrix, contexts) {
  if (matrix === undefined || matrix === null) return [null];
  const m = valueOf(matrix, contexts);
  if (!m || typeof m !== "object" || Array.isArray(m) || "include" in m || "exclude" in m) throw new Error(`a matrix this runner does not know: ${JSON.stringify(matrix)}`);
  let list = [{}];
  for (const [key, raw] of Object.entries(m)) {
    const values = valueOf(raw, contexts);
    if (!Array.isArray(values)) throw new Error(`a matrix this runner does not know: ${key}`);
    list = list.flatMap(c => values.map(v => ({ ...c, [key]: v })));
  }
  return list;
}

const outputsOf = file => {
  const out = {};
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : [];
  for (let k = 0; k < lines.length; k++) {
    const heredoc = /^([\w-]+)<<(.+)$/.exec(lines[k]);
    if (heredoc) { const end = lines.indexOf(heredoc[2], k + 1); out[heredoc[1]] = lines.slice(k + 1, end).join("\n"); k = end; continue; }
    const kv = /^([\w-]+)=(.*)$/.exec(lines[k]);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
};

/**
 * Runs each job of a called workflow (its text) as GitHub would for one event, and gives each job's result:
 * { job, ran, passed, steps: [{ name, ran, passed, out }] }. `inputs` and `secrets` are what the call passes (defaults
 * filled in here); `github` the github context; `base` the environment every step starts from; `workspace(job)` a
 * fresh folder for a job's runner; `uses` maps an action (its name before @) to a handler (step `with`, filled in;
 * the job's folder; the job's env) that does its part, or returns false where it stands for a step not run here.
 * With `dry`, it only says which jobs would start: each one that starts is a job the repository's owner pays for.
 * With `until`, a job stops after the step of that id (each job's `outputs` hold its steps' outputs). With `stop`, a
 * step that fails where `stop(its name)` holds cancels the rest of its job, as a run cancelled there: a step that runs
 * where `!cancelled()` runs no more. Each job's own
 * temporary folder is made under `temp` and removed when the job ends.
 */
// Whether a trigger's `paths:` filter lets a change through, as GitHub's cheat sheet reads one: `*` (no slash), `**`
// (any folders, none included, where `**/` begins it), `?` and `+` (zero or one, and one or more, of the character
// before), `[...]`, `\` before a character taking it as itself, and `!` before a pattern taking out what it matches;
// the last pattern a file matches decides, and the workflow starts where any changed file is let through. A `?` or `+`
// with nothing before it to repeat, and a `[` or `]` that closes no class, is taken as itself: every pattern is read.
export function pathsLetThrough(patterns, changed) {
  const rules = patterns.map(p => (p.startsWith("!") ? [false, globItems(p.slice(1))] : [true, globItems(p)]));
  return changed.some(f => rules.reduce((let_, [keep, items]) => (globMatches(items, f) ? keep : let_), false));
}

// A pattern as items, each one character's test with how often it may stand (`min` 0 or 1, `many`), or the folders
// `**/` stands for; the matcher walks them over a name keeping every position it could have reached at once, so no
// pattern makes it go back, and its work grows with the pattern's length times the name's, never more.
function globItems(glob) {
  const items = [];
  const one = test => items.push({ test, min: 1, many: false, single: true });
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i], last = items[items.length - 1];
    if (c === "\\" && i + 1 < glob.length) { const x = glob[++i]; one(ch => ch === x); }
    else if (glob.startsWith("**/", i)) { items.push({ folders: true }); i += 2; }
    else if (glob.startsWith("**", i)) { items.push({ test: () => true, min: 0, many: true }); i += 1; }
    else if (c === "*") items.push({ test: ch => ch !== "/", min: 0, many: true });
    else if (c === "[" && glob.indexOf("]", i + 2) > i) {
      const end = glob.indexOf("]", i + 2), set = glob.slice(i + 1, end);
      one(ch => [...set.matchAll(/(.)-(.)|(.)/gsu)].some(([, a, b, x]) => (x === undefined ? ch >= a && ch <= b : ch === x)));
      i = end;
    } else if ((c === "?" || c === "+") && last?.single) {
      last.single = false;
      if (c === "?") last.min = 0; else last.many = true;
    } else one(ch => ch === c);
  }
  return items;
}

function globMatches(items, name) {
  let at = new Set([0]);
  for (const item of items) {
    const next = new Set();
    if (item.folders) {
      let from = name.length;
      for (const p of at) { next.add(p); if (p < from) from = p; }
      for (let j = from; j < name.length; j++) if (name[j] === "/") next.add(j + 1);
    } else {
      for (const p of at) if (item.min === 0) next.add(p);
      for (const p of [...at].sort((a, b) => a - b)) {
        for (let j = p; j < name.length && item.test(name[j]); j++) {
          if (next.has(j + 1) && item.many) break;
          next.add(j + 1);
          if (!item.many) break;
        }
      }
    }
    at = next;
    if (!at.size) return false;
  }
  return at.has(name.length);
}

// The shell a step runs in: its own, its job's default or the workflow's; bash alone, or none named.
function shellOf(step, job, defaults, id) {
  const shell = step.shell ?? job.defaults?.run?.shell ?? defaults;
  if (shell !== undefined && shell !== "bash") throw new Error(`a shell this runner does not know: ${shell} (in ${id})`);
  return shell;
}

// What a step wrote to GITHUB_ENV (the file `file`), NAME=value a line, set in `env`, the environment of every step after
// it, as GitHub sets it; the file is emptied for the next step.
function carryEnv(file, env, id) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/u).filter(Boolean)) {
    const at = line.indexOf("=");
    if (at <= 0) throw new Error(`a line of GITHUB_ENV in a form this runner does not read: ${line.slice(0, 80)} (in ${id})`);
    env[line.slice(0, at)] = line.slice(at + 1);
  }
  fs.rmSync(file);
}

// The inputs the workflow is called with, the declared ones' defaults filled in; a call that gives one the workflow does
// not take, or leaves out a required input or secret, throws.
function callInputs(wf, inputs, secrets) {
  const declared = wf.on?.workflow_call?.inputs ?? {};
  const given = Object.fromEntries(Object.entries(declared).map(([name, d]) => [name, name in inputs ? inputs[name] : d?.default ?? (d?.type === "boolean" ? false : "")]));
  for (const name of Object.keys(inputs)) if (!(name in declared)) throw new Error(`an input the workflow does not take: ${name}`);
  for (const [name, d] of Object.entries(declared)) if (d?.required && !(name in inputs)) throw new Error(`the call leaves out a required input: ${name}`);
  for (const [name, d] of Object.entries(wf.on?.workflow_call?.secrets ?? {})) if (d?.required && !(name in secrets)) throw new Error(`the call leaves out a required secret: ${name}`);
  return given;
}

export function runWorkflow(text, { inputs = {}, secrets = {}, github, base, workspace, uses, runner = {}, dry = false, until = null, stop = null, temp = os.tmpdir() }) {
  const wf = parseYaml(text);
  const rt = { defaults: wf.defaults?.run?.shell, github, base, workspace, uses, runner, dry, until, stop, temp };
  const given = callInputs(wf, inputs, secrets);
  const results = [];
  for (const [id, job] of Object.entries(wf.jobs ?? {})) {
    const top = { github, inputs: given, secrets, vars: {} };
    if (!holds(job.if, top, { failed: false })) { results.push({ job: id, ran: false, passed: true, steps: [], outputs: {} }); continue; }
    // (a matrix makes a job of each of its combinations, each one billed, named by its values as GitHub names it)
    for (const matrix of combinations(job.strategy?.matrix, top)) runMatrixJob(rt, job, id, top, matrix, results);
  }
  return results;
}

// One job of a workflow for one combination of its matrix (null for none): its runner folder made, the job run, the folder removed.
function runMatrixJob(rt, job, id, top, matrix, results) {
  const tmp = fs.mkdtempSync(path.join(rt.temp, "runner-temp-"));
  const ctx = { ...top, runner: { temp: tmp, os: "Linux", ...rt.runner }, env: {}, steps: {}, matrix: matrix ?? {} };
  const state = { failed: false };
  const result = { job: matrix ? `${id} (${Object.values(matrix).map(str).join(", ")})` : id, ran: true, passed: true, steps: [], outputs: ctx.steps };
  results.push(result);
  try { if (!rt.dry) runJob({ rt, job, id, ctx, state, result, tmp }); } finally { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
}

// A map's values, each with its `${{ }}` filled in as text.
const fillValues = (map, ctx, state) => Object.fromEntries(Object.entries(map ?? {}).map(([k, v]) => [k, fill(str(v), ctx, state)]));

// The steps of a job, in order, each one's result put in `jr.result`; `jr` holds the run's settings (`rt`), the job, its
// id, its contexts, its state, its result and its temporary folder.
function runJob(jr) {
  const { rt, job, id, ctx, state, result } = jr;
  jr.dir = rt.workspace(id);
  ctx.env = fillValues(job.env, ctx, state);
  for (const step of job.steps ?? []) {
    const name = step.name ?? step.uses ?? step.run?.split("\n")[0];
    if (!holds(step.if, ctx, state)) { result.steps.push({ name, ran: false, passed: true, out: "" }); continue; }
    const env = { ...ctx.env, ...fillValues(step.env, ctx, state) };
    if (step.uses) { runUses(jr, step, name, env); continue; }
    runScript(jr, step, name, env);
    if (rt.until && step.id === rt.until) return;
  }
}

// A `uses` step, by the handler the caller gave for its action.
function runUses(jr, step, name, env) {
  const { rt, ctx, state, result, dir, id } = jr;
  const action = step.uses.split("@")[0];
  const handler = rt.uses[action];
  if (!handler) throw new Error(`an action this test has no part for: ${action} (in ${id})`);
  const w = fillValues(step.with, ctx, state);
  let did;
  try {
    did = handler(w, dir, env);
  } catch (e) {
    // (a stand-in that refuses what the step asks of it fails the step, as the action would)
    result.steps.push({ name, ran: true, passed: false, out: `${e.message}\n` });
    state.failed = true; result.passed = false;
    return;
  }
  result.steps.push({ name, ran: did !== false, passed: true, out: did === false ? "GitHub's own, not run here" : "" });
}

// A `run` step in bash, its outputs and its GITHUB_ENV read when it ends.
function runScript(jr, step, name, env) {
  const { rt, job, ctx, state, result, tmp, dir, id } = jr;
  const output = path.join(tmp, `output-${result.steps.length}`);
  const script = path.join(tmp, `step-${result.steps.length}.sh`);
  fs.writeFileSync(script, fill(step.run, ctx, state));
  const cwd = step["working-directory"] ? path.join(dir, fill(str(step["working-directory"]), ctx, state)) : dir;
  // (as GitHub runs it: a step that names no shell in bash with -e alone; one whose shell is bash, by its own word or
  // the defaults', with --noprofile --norc -e -o pipefail)
  const shell = shellOf(step, job, rt.defaults, id);
  const r = spawnSync("bash", shell === "bash" ? ["--noprofile", "--norc", "-eo", "pipefail", script] : ["-e", script], { cwd, encoding: "utf8", env: {
    ...rt.base, ...env, CI: "true", GITHUB_ACTIONS: "true", GITHUB_OUTPUT: output, GITHUB_ENV: path.join(tmp, "env"), GITHUB_STEP_SUMMARY: path.join(tmp, "summary"),
    GITHUB_WORKSPACE: dir, GITHUB_REPOSITORY: str(rt.github.repository), GITHUB_EVENT_NAME: str(rt.github.event_name), RUNNER_TEMP: tmp, RUNNER_OS: ctx.runner.os } });
  const passed = r.status === 0;
  carryEnv(path.join(tmp, "env"), ctx.env, id);
  result.steps.push({ name, ran: true, passed, out: `${r.stdout ?? ""}${r.stderr ?? ""}${r.error?.message ?? ""}` });
  if (step.id) ctx.steps[step.id] = { outputs: outputsOf(output), outcome: passed ? "success" : "failure", conclusion: passed ? "success" : "failure" };
  if (!passed) failed(state, result, rt.stop, name);
}

// A step that failed: its job fails, and, where `stop` holds for its name, the rest of the job is cancelled.
function failed(state, result, stop, name) {
  state.failed = true;
  result.passed = false;
  if (stop && stop(name)) state.cancelled = true;
}
