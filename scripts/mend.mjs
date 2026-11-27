// What a failure of a check of the core says (AGENTS.md, "A check that fails says the mend"; core archive 219; #254):
// each is a line of the check's output that starts "FAIL" (after the workflow command that opens it, "::error::" or
// one like it, where one does), or, of a check that marks a pull request with a status that waits, the status's
// description, which starts "Waiting: ". It says what is wrong and where, then "Mend: " and what a session does about
// it, in words it acts on with no rule file open. Lines after a failure that do not start so are its details (the
// files, the lines), read with it. Each check's own test reads its failures here (tests/mend-test.mjs holds that it
// does). A check's entry runs through guard(), so that an error it did not catch fails with its mend too (#1140, point
// 1); and a mend that names a script to run (`node <path>`) names one that is there from the folder the check ran in,
// where the caller gives that folder (point 3). Node's own modules, guards.mjs and started.mjs beside it.
//
//   import { guard, mended, unmended } from "./mend.mjs";
//   if (guard(import.meta.url)) { ... }      (a check's entry, in place of started())
//   mended(output, { from: <the folder it ran in> })
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logged, loggedAlone, loggedCause } from "./guards.mjs";
import { started } from "./started.mjs";

export const MEND = "Mend: ";
const FAILURE = /^(?:::[a-z]+(?: [^:\r\n]*)?::)?(?:FAIL\b|Waiting: )/u;
// a mend of at least two words after the marker, so that "Mend: " alone, or one word, is none
const SAID = /Mend: \S+\s+\S/u;

// The failures in a check's output (its stdout and stderr as one text), one line each.
export function failures(output) {
  return String(output ?? "").split(/\r?\n/u).filter(line => FAILURE.test(line));
}

// The failures that do not say their mend: an empty list where each does.
export function unmended(output) {
  return failures(output).filter(line => !SAID.test(line));
}

// Each script a mend names to run (`node <path>`, the path written out, not a placeholder) whose file is not there from
// the folder `from`: "<path> (in: <the failure>)" each. A path the same line tests for first (`[ -f <path> ]`) is
// there or not by design, as the guarded install is, and is not read. A path may be relative, absolute or in quotes (#1488).
const RUN = /\bnode\s+["'`]?((?:\/|[A-Za-z]:\/|\.{1,2}\/)?[\w.-]+(?:\/[\w.-]+)*\.(?:mjs|cjs|js|sh))(?=$|[\s`'"),;:]|\.(?:\s|$))/gu;
export function missing(output, from) {
  const gone = [];
  for (const line of failures(output)) {
    if (!line.includes(MEND)) continue;
    const mend = line.slice(line.indexOf(MEND) + MEND.length);
    for (const run of mend.matchAll(RUN)) {
      const file = run[1];
      if (mend.slice(0, run.index).includes(`-f ${file}`) || fs.existsSync(path.resolve(from, file))) continue;
      gone.push(`${file} (in: ${line.slice(0, 200)})`);
    }
  }
  return gone;
}

// Whether a check's output holds a failure and every failure in it says its mend: what a check's test asks of a run
// that fails. Given the folder the check ran in (`from`), each script its mends name to run is there from it too.
export function mended(output, { from } = {}) {
  return failures(output).length > 0 && unmended(output).length === 0 && (from === undefined || missing(output, from).length === 0);
}

// The failure a check gives for an error it did not catch: a parser's abort, a raw error of git's, a RangeError.
// An error whose message is a failure that says its mend already is printed as it stands, on its one line. Its words
// may come from a project's file (a parse error's excerpt), so each is printed as the log reads text alone, any
// address's sign-in cut out (guards.mjs: loggedAlone, loggedCause, logged; floor rule 1).
export function unknown(script, error) {
  const said = String(error instanceof Error ? error.message || error.name : error);
  if (mended(said)) return loggedAlone(said);
  const [first, ...rest] = said.split(/\r?\n/u);
  const stack = error instanceof Error && typeof error.stack === "string" ? error.stack.split(/\r?\n/u).filter(l => /^\s+at /u.test(l)).slice(0, 5) : [];
  return [`FAIL: ${script} stopped on an error it does not know: ${loggedCause(first.trim()) || "(no message)"}. ${MEND}run it again; if it fails the same way, file a bug with this line.`,
    ...rest.map(l => `  ${logged(l)}`), ...stack.map(l => `  ${logged(l.trim())}`)].join("\n");
}

// A script as a mend names it: its path from the folder it runs in ("core/scripts/x.mjs" in a project, "scripts/x.mjs"
// in the core), or its whole path where it lies outside that folder.
export function named(url) {
  const file = fileURLToPath(url);
  const rel = path.relative(process.cwd(), file);
  return (rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : file).replace(/\\/gu, "/");
}

// A check's entry: whether its file was started by itself (as started() of started.mjs says), and, where it was, an
// error it does not catch, thrown or rejected, ends it with the failure unknown() words and exit code 1, never Node's
// own trace. The script is named by its path from the folder it runs in, as a mend names it.
let guarded = false;
export function guard(url) {
  if (!started(url)) return false;
  if (guarded) return true;
  guarded = true;
  const script = named(url);
  const stop = error => {
    try { process.stderr.write(`${unknown(script, error)}\n`); } catch { /* the line cannot be written: the exit code still says it */ }
    process.exit(1);
  };
  process.on("uncaughtException", stop);
  process.on("unhandledRejection", stop);
  return true;
}
