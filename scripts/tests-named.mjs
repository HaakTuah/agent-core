// Each test of the core runs in its tests workflow (#1546): every file tests/*-test.mjs is run by a line of
// .github/workflows/tests.yml that is no comment, as `node [<option> …] tests/<file>`, wherever on the line (a run line,
// a loop, a command another script starts after `--`). A name only in a comment or in a step's condition runs nothing,
// so it is none. It fails each test no line runs, saying its mend. This repository only: no project runs it. Its tests
// workflow runs it on every pull request here and every push to main. It checks the repository it lies in, from any
// directory; Node's own modules only.
//
//   node scripts/tests-named.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asText } from "./guards.mjs";
import { guard } from "./mend.mjs";
import { WORKFLOW } from "./tests-parts.mjs";

export const TESTS = "tests";
const TEST = /-test\.mjs$/u;
const RUN = /(?:^|[\s;&|(])node\s+(?:-\S+\s+)*["']?(tests\/[\w.-]+-test\.mjs)(?=$|["'\s;&|)])/gu;

// The tests the workflow's text runs: the set of their paths ("tests/<file>").
export function runIn(text) {
  const run = new Set();
  for (const line of String(text).split(/\r?\n/u)) {
    if (/^\s*#/u.test(line)) continue;
    for (const m of line.matchAll(RUN)) run.add(m[1]);
  }
  return run;
}

// The tests of `files` (the names in tests/) that the workflow's text runs nowhere, as "tests/<file>", in order.
export function unnamed(text, files) {
  const run = runIn(text);
  return files.filter(f => TEST.test(f)).map(f => `${TESTS}/${f}`).filter(f => !run.has(f)).sort();
}

// What the check prints and exits with, read where `root` stands: { status, out, err }.
export function report(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  let text, files;
  try {
    text = fs.readFileSync(path.join(root, WORKFLOW), "utf8");
    files = fs.readdirSync(path.join(root, TESTS));
  } catch (e) {
    return { status: 1, out: [], err: [`FAIL: ${WORKFLOW} or the folder ${TESTS}/ could not be read (${e.message}). Mend: run it from a clone of the core, where both stand`] };
  }
  const gone = unnamed(text, files);
  if (gone.length) return { status: 1, out: [], err: gone.map(f => `FAIL: ${f} is run by no line of ${WORKFLOW}, so its cases hold nothing in CI. Mend: add a step that runs \`node ${f}\` to a part of the job suites there, its condition gated as its neighbours' are`) };
  return { status: 0, out: [`each of the ${files.filter(f => TEST.test(f)).length} tests of ${TESTS}/ is run by ${WORKFLOW}`], err: [] };
}

function main() {
  const { status, out, err } = report();
  for (const line of err) console.error(asText(line));
  for (const line of out) console.log(asText(line));
  return status;
}

if (guard(import.meta.url)) process.exitCode = main();
