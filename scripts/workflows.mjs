// The workflow check (floor rule 2, floor/topics.md), for every project that takes the core, on every PR: it fails a
// workflow (.github/workflows/), or an action of the project's own (an action.yml anywhere in it, or any file under
// .github/actions/), that names pull_request_target on any line that is not all comment. It searches for the word, not
// for a key, so no way of writing YAML hides it: a name spelled with a YAML escape (\x, \u, \U) is read as what it
// spells, and one broken over two lines by an escape is joined. A line of a script's own text that holds the word is
// reported too, and reworded.
// The rest of rule 2 is held elsewhere: that every action is pinned to a full commit SHA by GitHub's own setting, which
// reads a workflow as GitHub runs it (README.md, "Setting up"); workflow_run, the fewest permissions and untrusted text
// in a script by the reviews, and by CodeQL where the repository has it. The copy of the core (core/) is checked in the
// core, which runs this on itself. Reads only; Node's own modules. It checks the project it lies in, whatever the
// directory it is started from. Run by the copies workflow (.github/workflows/copies.yml).
//
//   node core/scripts/workflows.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const WORD = "pull_request_target";
const plain = line => line.replace(/\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8}))/gu, (whole, x, u, U) => {
  const code = parseInt(x ?? u ?? U, 16);
  return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
});

// The lines of one file's text that name the word, each as its number.
export function lines(text) {
  const found = [];
  let carried = "";
  text.split(/\r\n|\r|\n/u).forEach((raw, i) => {
    if (/^\s*#/u.test(raw)) { carried = ""; return; }
    const line = plain(raw), joined = carried + line.trimStart();
    carried = /\\$/u.test(raw) ? joined.slice(0, -1).slice(-WORD.length) : ""; // the end is enough to find the word across the break
    if (line.includes(WORD) || joined.includes(WORD)) found.push(i + 1);
  });
  return found;
}

// The files the check reads, of those git tracks.
export const reads = files => files.filter(f => !f.startsWith("core/") && !f.split("/").includes("node_modules") &&
  (/^\.github\/(workflows\/[^/]+|actions\/.+)\.ya?ml$/u.test(f) || /(^|\/)action\.ya?ml$/u.test(f)));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const git = args => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  process.chdir(fileURLToPath(new URL(".", import.meta.url)));
  process.chdir(git(["rev-parse", "--show-toplevel"]).trim());
  const files = reads(git(["ls-files", "-z"]).split("\0").filter(Boolean));
  let failed = 0;
  for (const file of files) {
    for (const line of lines(fs.readFileSync(file, "utf8"))) {
      failed++;
      console.log(`FAIL ${file}:${line}: ${WORD} runs a pull request with the repository's own token and secrets: never (floor rule 2)`);
    }
  }
  console.log(`${failed ? "FAIL" : "ok  "} ${files.length} workflows and actions of the project's own read: ${failed} naming ${WORD}`);
  process.exit(failed ? 1 : 0);
}
