// The runs of the core's scripts a hostile test makes, watched (core-changes/projects.md, "A check that fails says the mend"; #1140,
// point 2): the hostile tests (tests/hostile-*-test.mjs) take spawnSync and execFileSync from here in place of
// node:child_process, and each run of a script under a scripts/ folder by Node that exits with a failure must hold at
// least one failure line, every one of them saying its mend (mend.mjs), and every script its mends name to run there
// from the folder it ran in (#1140, point 3). A run that breaks that is said when the test ends, as a failure with its
// mend, and the test's exit code is 1. A run that exits 0, one killed (no exit code: a time-out the test set), one of
// another program, Node given code to evaluate, and a proof whose exit code is its answer (ANSWERS in check-runs-read.mjs, none of which
// tests/mend-test.mjs holds is a check), are not read. tests/mend-test.mjs holds that each
// hostile test takes them from here; what it reads stands in check-runs-read.mjs beside it. Node's own modules and that file.
//
//   import { execFileSync, spawnSync } from "../scripts/check-runs.mjs";
import * as child from "node:child_process";
import { faultsOf, optionsOf, scriptOf } from "./check-runs-read.mjs";

const said = [];

function watch(file, args, options, status, stdout, stderr) {
  const script = scriptOf(file, args);
  if (!script) return;
  const from = options?.cwd ?? process.cwd();
  for (const fault of faultsOf(status, `${stdout ?? ""}\n${stderr ?? ""}`, from)) said.push(`${script}: ${fault}`);
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
