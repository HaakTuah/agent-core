// What the watch on the hostile tests' runs reads (check-runs.mjs, beside this file; AGENTS.md, "A check that fails
// says the mend"; #1140, point 2), apart from the runs it starts, so a test reads it without starting a process: the
// script a run of Node starts, what is wrong with a run's output, the proofs whose exit code is their answer, and the
// options a run takes. Node's own modules and mend.mjs beside it.
import { failures, missing, unmended } from "./mend.mjs";

const SCRIPT = /(?:^|[\\/])scripts[\\/][\w.-]+\.mjs$/u;
const EVAL = new Set(["-e", "--eval", "-p", "--print", "--input-type=module", "--input-type=commonjs"]);
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

// The options a run takes, from those the hostile tests give, each named, and never a shell: what a test starts is the
// program and its arguments alone.
const KEYS = ["cwd", "env", "encoding", "input", "timeout", "stdio", "maxBuffer"];
export function optionsOf(options) {
  const other = Object.keys(options ?? {}).filter(k => !KEYS.includes(k));
  if (other.length) throw new Error(`check-runs.mjs takes no option ${other.join(", ")}: name it in KEYS in scripts/check-runs-read.mjs`);
  const picked = { shell: false };
  for (const k of KEYS) if (options?.[k] !== undefined) picked[k] = options[k];
  return picked;
}
