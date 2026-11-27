// The runs of the core's scripts a hostile test makes, watched (AGENTS.md, "A check that fails says the mend"; #1140,
// point 2): the hostile tests (tests/hostile-*-test.mjs) take spawnSync and execFileSync from here in place of
// node:child_process, and each run of a script under a scripts/ folder by Node that exits with a failure must hold at
// least one failure line, every one of them saying its mend (mend.mjs), and every script its mends name to run there
// from the folder it ran in (#1140, point 3). A run that breaks that is said when the test ends, as a failure with its
// mend, and the test's exit code is 1. A run that exits 0, one killed (no exit code: a time-out the test set), one of
// another program, Node given code to evaluate, and a proof whose exit code is its answer (ANSWERS, none of which
// tests/mend-test.mjs holds is a check), are not read. tests/mend-test.mjs holds that each
// hostile test takes them from here. Node's own modules only.
//
//   import { execFileSync, spawnSync } from "../scripts/check-runs.mjs";
import * as child from "node:child_process";
import { failures, missing, unmended } from "./mend.mjs";

const SCRIPT = /(?:^|[\\/])scripts[\\/][\w.-]+\.mjs$/u;
const EVAL = new Set(["-e", "--eval", "-p", "--print", "--input-type=module", "--input-type=commonjs"]);
const said = [];
// the proofs whose exit code is their answer ("NOT PURE", "NOT ALONE", a reading), not a failure (floor rule 8, 3)
export const ANSWERS = new Set(["scripts/pure-sync.mjs", "scripts/queue-only.mjs", "scripts/comment-only.mjs", "scripts/clean-merges.mjs", "scripts/power.mjs"]);

// The script a run of Node starts, or "" where it starts none of the core's (code to evaluate, another program).
export function scriptOf(file, args) {
  if (file !== process.execPath || !Array.isArray(args) || args.some(a => EVAL.has(a))) return "";
  const first = args.find(a => typeof a === "string" && !a.startsWith("-"));
  if (!first || !SCRIPT.test(first)) return "";
  return ANSWERS.has(`scripts/${first.split(/[\\/]/u).at(-1)}`) ? "" : first;
}

// What is wrong with one run's output, given its exit code and the folder it ran in: an empty list where nothing is.
export function faultsOf(status, output, from) {
  if (status === 0 || status === null || status === undefined) return [];
  if (!failures(output).length) return [`it exited ${status} with no failure line (one that opens "FAIL")`];
  return [...unmended(output).map(l => `a failure says no mend: ${l.slice(0, 200)}`),
    ...missing(output, from).map(m => `a mend names a script that is not there from ${from}: ${m}`)];
}

function watch(file, args, options, status, stdout, stderr) {
  const script = scriptOf(file, args);
  if (!script) return;
  const from = options?.cwd ?? process.cwd();
  for (const fault of faultsOf(status, `${stdout ?? ""}\n${stderr ?? ""}`, from)) said.push(`${script}: ${fault}`);
}

// The options a run takes, from those the hostile tests give, each named, and never a shell: what a test starts is the
// program and its arguments alone.
const KEYS = ["cwd", "env", "encoding", "input", "timeout", "stdio", "maxBuffer"];
function optionsOf(options) {
  const other = Object.keys(options ?? {}).filter(k => !KEYS.includes(k));
  if (other.length) throw new Error(`check-runs.mjs takes no option ${other.join(", ")}: name it in KEYS there`);
  const picked = { shell: false };
  for (const k of KEYS) if (options?.[k] !== undefined) picked[k] = options[k];
  return picked;
}

export function spawnSync(file, args, options) {
  const r = child.spawnSync(file, args, optionsOf(options));
  watch(file, args, options, r.status, r.stdout, r.stderr);
  return r;
}

export function execFileSync(file, args, options) {
  try {
    return child.execFileSync(file, args, optionsOf(options));
  } catch (e) {
    watch(file, args, options, e?.status, e?.stdout, e?.stderr);
    throw e;
  }
}

// The faults the runs so far gave, each a line: what the hook below prints.
export function runFaults() { return [...said]; }

process.on("exit", () => {
  if (!said.length) return;
  for (const s of said) console.log(`FAIL a run of ${s}. Mend: have the script print, on each way it fails, a line that opens "FAIL", says what is wrong and where, then "Mend: " and what a session does, naming each script to run by its path from the folder it runs in (scripts/mend.mjs)`);
  process.exitCode = 1;
});
