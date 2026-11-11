// The workflow check (floor rule 2, floor/topics.md), for every project that takes the core, on every PR: the two parts
// of the rule a machine can decide exactly. It fails a workflow or an action of the project's own (.github/workflows/,
// .github/actions/) that
//   - names pull_request_target on any line that is not all comment;
//   - uses an action or a workflow that is neither the project's own (./), nor one of GitHub's own (actions/*), nor
//     pinned to a full commit SHA (a container image: to its sha256 digest).
// The rest of rule 2 (workflow_run, the fewest permissions, untrusted text in a script) takes judgement and stays with
// the reviews, and with CodeQL where the repository has it. The copy of the core (core/) is checked in the core, which
// runs this on itself. Reads only; Node's own modules. It checks the project it lies in, whatever the directory it is
// started from. Run by the copies workflow (.github/workflows/copies.yml).
//
//   node core/scripts/workflows.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const USES = /(?:^|[\s{,-])uses:\s*(?:"([^"]*)"|'([^']*)'|([^\s#},]+))/gu;
const pinned = uses =>
  uses.startsWith("./") ||
  (uses.startsWith("docker://") ? /@sha256:[0-9a-f]{64}$/u.test(uses) : /^actions\/[\w.-]+(\/[^@]*)?@.+$/u.test(uses) || /@[0-9a-f]{40}$/u.test(uses));

// What is wrong in one file's text, each as { line, what }.
export function problems(text) {
  const found = [];
  text.split(/\r?\n/u).forEach((line, i) => {
    if (/^\s*#/u.test(line)) return;
    if (line.includes("pull_request_target")) found.push({ line: i + 1, what: "pull_request_target runs a pull request with the repository's own token and secrets: never (floor rule 2)" });
    for (const m of line.matchAll(USES)) {
      const uses = m[1] ?? m[2] ?? m[3];
      if (!pinned(uses)) found.push({ line: i + 1, what: `"${uses}" is neither the project's own (./), nor GitHub's own (actions/*), nor pinned to a full commit SHA (floor rule 2)` });
    }
  });
  return found;
}

// The files the check reads, of those git tracks.
export const reads = files => files.filter(f => !f.startsWith("core/") && /^\.github\/(workflows\/[^/]+|actions\/.+)\.ya?ml$/u.test(f));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const git = args => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  process.chdir(fileURLToPath(new URL(".", import.meta.url)));
  process.chdir(git(["rev-parse", "--show-toplevel"]).trim());
  const files = reads(git(["ls-files", "-z", ".github"]).split("\0").filter(Boolean));
  let failed = 0;
  for (const file of files) {
    for (const { line, what } of problems(fs.readFileSync(file, "utf8"))) { failed++; console.log(`FAIL ${file}:${line}: ${what}`); }
  }
  console.log(`${failed ? "FAIL" : "ok  "} ${files.length} workflows and actions of the project's own read: ${failed} against floor rule 2`);
  process.exit(failed ? 1 : 0);
}
