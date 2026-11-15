// The core's own mutation tool (modules/code-shape.md, "How strong the tests are"; #253), the *mutation tool* the core's
// AGENTS.md names, and one any project whose code is JavaScript run by Node, and whose tests are files run by
// `node <file>`, may name too. It puts faults into the code on purpose, one at a time: an equality or comparison
// turned (=== to !==, < to <=), and or or swapped, true and false swapped, a ! dropped, + and - swapped; and for each
// it runs the tests that name the changed file, until one fails. A fault no test catches survives. It writes what it
// found in the open form of a mutation report (the mutation-testing-elements schema, as Stryker writes it), which
// strength.mjs, beside this file, reads.
//
// The tests of a file are the files the shape check's config lists under "tests" whose text names the file (by its
// name, as an import or a path a test starts it by). Each is run once as it stands first: one that fails there, or
// takes longer than LONGEST, catches nothing and is left out, and the run says so. Each fault runs in a working copy of
// its own (a git worktree of HEAD, with the files that differ from it copied in), several side by side, so the
// project's own files are never changed; a fault whose tests run past their time is caught (a timeout, as Stryker
// counts it). Past the budget, the faults left are written as not run ("Pending").
//
//   node core/scripts/mutate.mjs --report <file> [--budget <seconds>] [<file>[:<first>-<last>],...]
//       the faults on those lines, or with no file named every file of the config's "code" that is no test (the
//       whole run, outside the suite); the config is the one the shape check reads (shape.mjs, where()). The budget,
//       where none is given, is MUTATE_BUDGET's, else none.
// Reads the project; writes the report and its working copies, which it takes away. git and Node's own modules.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tokens } from "./code-shape.mjs";
import { parseConfig, standing, where } from "./shape.mjs";
import { started } from "./started.mjs";

const LONGEST = 120; // seconds: a test that takes longer as it stands is no test a fault is run against
const SAFE = ["-c", "core.fsmonitor=false"];
const git = (args, cwd = ".") => execFileSync("git", [...SAFE, ...args], { cwd, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const OPERATORS = { "===": "!==", "!==": "===", "==": "!=", "!=": "==", "<=": "<", ">=": ">", "&&": "||", "||": "&&" };
const SINGLE = { "<": "<=", ">": ">=" };
const NAMES = { "&&": "LogicalOperator", "||": "LogicalOperator", "+": "ArithmeticOperator", "-": "ArithmeticOperator" };
const VALUE = new Set(["str", "num", "regex"]);

class Refused extends Error {}
const refuse = (what, mend) => { throw new Refused(`${what}. Mend: ${mend}`); };

// The line and column (both from 1) of an offset in a text.
function placeOf(src, at) {
  const before = src.slice(0, at), line = before.split("\n").length;
  return { line, column: at - before.lastIndexOf("\n") };
}

// Whether a token holds a value, so that a + or - after it joins two values (not a sign).
const aValue = tok => !!tok && (VALUE.has(tok.t) || (tok.t === "id" && !["return", "typeof", "case", "in", "of", "new", "void", "throw", "await", "yield"].includes(tok.v)) || (tok.t === "punct" && (tok.v === ")" || tok.v === "]")));

// The operator that starts at a punctuation token, and what it becomes: [text, replacement, name] or null. One that is
// part of a longer operator (<<=, >>>, =>, ++, -=) is none.
function operatorAt(src, k, toks) {
  const at = toks[k].at, c = src[at], after = src[at + 1] ?? "", before = src[at - 1] ?? "";
  if ("<>=!&|".includes(before)) return null;
  const long = Object.keys(OPERATORS).find(op => src.startsWith(op, at) && !"<>=&|".includes(src[at + op.length] ?? ""));
  if (long) return [long, OPERATORS[long], NAMES[long] ?? "EqualityOperator"];
  if (c in SINGLE && !"<>=".includes(after)) return [c, SINGLE[c], "EqualityOperator"];
  if (c === "!" && after !== "=") return ["!", "", "BooleanLiteral"];
  if ((c === "+" || c === "-") && !"+-=".includes(after) && !"+-".includes(before) && aValue(toks[k - 1])) return [c, c === "+" ? "-" : "+", "ArithmeticOperator"];
  return null;
}

// The faults a file's text can take on the lines wanted (a function of a line number; all where none is given):
// each { at, length, original, replacement, mutatorName }.
export function faults(src, wanted = () => true) {
  const toks = tokens(src), out = [];
  let skip = -1;
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    if (tok.at < skip || !wanted(tok.line)) continue;
    let found = null;
    if (tok.t === "id" && (tok.v === "true" || tok.v === "false") && toks[k - 1]?.v !== ".") found = [tok.v, tok.v === "true" ? "false" : "true", "BooleanLiteral"];
    else if (tok.t === "punct") found = operatorAt(src, k, toks);
    if (!found) continue;
    const [original, replacement, mutatorName] = found;
    out.push({ at: tok.at, length: original.length, original, replacement, mutatorName });
    skip = tok.at + original.length;
  }
  return out;
}

// The files and lines named on the command line: a Map of file to a function of a line number, or null for every
// line of every file of the code.
function wantedOf(args, code) {
  if (!args.length) return new Map(code.map(f => [f, () => true]));
  const out = new Map();
  for (const part of args.flatMap(a => a.split(",")).filter(Boolean)) {
    const m = /^(.+?)(?::(\d+)-(\d+))?$/u.exec(part);
    if (!code.includes(m[1])) refuse(`${m[1]} is no file of the code the shape check's config reads`, "name a file of its \"code\" that is no test, with its lines as <file>:<first>-<last>");
    const was = out.get(m[1]) ?? (() => false), first = Number(m[2] ?? 1), last = Number(m[3] ?? Infinity);
    out.set(m[1], line => was(line) || (line >= first && line <= last));
  }
  return out;
}

// The tests that name a file: the test files whose text holds its name, not as the end of a longer one; its own
// (<name>-test or <name>.test) first, so that a fault is mostly caught by the first test it runs.
export function testsOf(file, tests) {
  const stem = path.posix.basename(file).replace(/\.[^.]+$/u, ""), name = path.posix.basename(file).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const named = new RegExp(`(^|[^\\w-])${name}`, "u"), own = t => new RegExp(`(^|/)${stem.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}[-.]test\\.`, "u").test(t);
  return Object.keys(tests).filter(t => named.test(tests[t])).sort((x, y) => Number(own(y)) - Number(own(x)) || x.localeCompare(y));
}

// One run of a test file in a working copy: "passed", "failed" or "timeout", and how long it took, in seconds.
function run(test, cwd, limit) {
  return new Promise(done => {
    const start = Date.now(), child = spawn(process.execPath, [test], { cwd, stdio: "ignore" });
    const timer = setTimeout(() => { child.kill("SIGKILL"); done({ result: "timeout", took: limit }); }, limit * 1000);
    child.on("exit", code => { clearTimeout(timer); done({ result: code === 0 ? "passed" : "failed", took: (Date.now() - start) / 1000 }); });
  });
}

// A working copy of the project: a git worktree of HEAD, with the files that differ from it copied in.
function copyOf(dir) {
  git(["worktree", "add", "--detach", "--quiet", dir, "HEAD"]);
  const differ = git(["ls-files", "-z", "--modified", "--others", "--exclude-standard"]).split("\0").filter(Boolean);
  for (const f of differ) {
    const from = path.join(".", f), to = path.join(dir, f);
    if (!fs.existsSync(from) || fs.lstatSync(from).isSymbolicLink()) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  return dir;
}

// Each fault's status, in working copies side by side: Killed, Survived, NoCoverage, Timeout or Pending. Each test is
// run once as it stands before a fault is first run against it (`asIs`, shared): one that fails there, or runs past
// LONGEST, is left out.
async function judge(jobs, copies, budget) {
  const until = Date.now() + budget * 1000, asIs = new Map(), left = new Set();
  const checked = (test, dir) => {
    if (!asIs.has(test)) asIs.set(test, run(test, dir, LONGEST).then(r => (r.result === "passed" ? Math.max(10, Math.ceil(3 * r.took + 5)) : (left.add(test), 0))));
    return asIs.get(test);
  };
  const one = async (job, dir) => {
    const target = path.join(dir, job.file), mutated = job.text.slice(0, job.at) + job.replacement + job.text.slice(job.at + job.length);
    let ran = false;
    for (const test of job.tests) {
      const limit = await checked(test, dir);
      if (!limit) continue;
      ran = true;
      fs.writeFileSync(target, mutated);
      const { result } = await run(test, dir, limit);
      fs.writeFileSync(target, job.text);
      if (result !== "passed") return result === "timeout" ? "Timeout" : "Killed";
    }
    return ran ? "Survived" : "NoCoverage";
  };
  let next = 0;
  const worker = async dir => {
    while (next < jobs.length) {
      const job = jobs[next++];
      job.status = Date.now() > until ? "Pending" : await one(job, dir);
    }
  };
  await Promise.all(copies.map(worker));
  return [...left];
}

// The report, in the mutation-testing-elements schema: each file's text and its faults with their status.
export function report(texts, jobs) {
  const files = {};
  for (const [i, j] of jobs.entries()) {
    files[j.file] ??= { language: "javascript", source: texts[j.file], mutants: [] };
    const start = placeOf(j.text, j.at), end = placeOf(j.text, j.at + j.length);
    files[j.file].mutants.push({ id: String(i + 1), mutatorName: j.mutatorName, replacement: j.replacement, location: { start, end }, status: j.status });
  }
  return { schemaVersion: "1", thresholds: { high: 80, low: 60 }, files };
}

async function main(argv) {
  const at = argv.indexOf("--report"), out = at >= 0 ? argv[at + 1] : null;
  const b = argv.indexOf("--budget"), budget = Number(b >= 0 ? argv[b + 1] : process.env.MUTATE_BUDGET || Infinity);
  if (!out || !(budget > 0)) refuse("the mutation tool was not told where to write its report, or its budget is no number of seconds", "run node scripts/mutate.mjs --report <file> [--budget <seconds>] [<file>[:<first>-<last>],...]");
  const named = argv.filter((a, i) => i !== at && i !== at + 1 && i !== b && i !== b + 1);
  const rules = [path.join(".", "core-manifest.md"), path.join(".", "AGENTS.md")].map(f => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null)).find(t => t !== null);
  const configAt = where(rules), config = parseConfig(fs.readFileSync(configAt, "utf8"), configAt);
  const { texts, tests } = standing(config);
  const code = Object.keys(texts).filter(f => !tests.has(f) && !f.endsWith("package.json"));
  const wanted = wantedOf(named, code), testTexts = Object.fromEntries([...tests].filter(t => t in texts).map(t => [t, texts[t]]));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mutate-")), copies = [];
  try {
    const jobs = [...wanted].flatMap(([file, lines]) => faults(texts[file], lines).map(f => ({ ...f, file, text: texts[file], tests: testsOf(file, testTexts) })));
    const width = Math.max(1, Math.min(os.cpus().length, jobs.length));
    for (let i = 0; i < width; i++) copies.push(copyOf(path.join(scratch, String(i))));
    const left = await judge(jobs, copies, budget);
    fs.writeFileSync(out, `${JSON.stringify(report(texts, jobs))}\n`);
    const count = s => jobs.filter(j => j.status === s).length;
    if (left.length) console.log(`left out, failing or past ${LONGEST} s as they stand: ${left.join(", ")}`);
    console.log(`mutate: ${jobs.length} faults in ${wanted.size} files: ${count("Killed") + count("Timeout")} caught, ${count("Survived") + count("NoCoverage")} survived, ${count("Pending")} not run (the budget); the report is at ${out}`);
  } finally {
    for (const dir of copies) try { git(["worktree", "remove", "--force", dir]); } catch { /* (taken away below) */ }
    fs.rmSync(scratch, { recursive: true, force: true });
    try { git(["worktree", "prune"]); } catch { /* (nothing to prune) */ }
  }
  return 0;
}

if (started(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => {
    if (!(e instanceof Refused)) throw e;
    console.error(`FAIL: ${e.message}`);
    process.exitCode = 1;
  });
}
