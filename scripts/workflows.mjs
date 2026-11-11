// The workflow check (floor rule 2, floor/topics.md), for every project that takes the core, on every PR: the two parts
// of the rule a machine can decide exactly. It fails a workflow (.github/workflows/) or an action of the project's own
// (an action.yml anywhere in it, or any file under .github/actions/) that
//   - names pull_request_target on any line that is not all comment;
//   - uses an action or a workflow that is neither the project's own (./), nor one of GitHub's own (actions/*), nor
//     pinned to a full commit SHA (a container image: to its sha256 digest);
//   - writes a `uses` key in any form but the plain one, its value on the same line: with no YAML reader among Node's
//     own modules the check reads lines, so what it cannot read it fails. A quoted key is read, and so is a name
//     spelled with a YAML escape (\x, \u, \U) or broken over two lines by one.
// The rest of rule 2 (workflow_run, the fewest permissions, untrusted text in a script) takes judgement and stays with
// the reviews, and with CodeQL where the repository has it. The copy of the core (core/) is checked in the core, which
// runs this on itself. Reads only; Node's own modules. It checks the project it lies in, whatever the directory it is
// started from. Run by the copies workflow (.github/workflows/copies.yml).
//
//   node core/scripts/workflows.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const KEY = /(?:^|[\s{,[?-])(?:"uses"|'uses'|uses)\s*:(?=\s|$)[ \t]*(?:"([^"]*)"|'([^']*)'|([^\s#},]+))?/gu;
const plain = line => line.replace(/\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8}))/gu, (_, x, u, U) => String.fromCodePoint(parseInt(x ?? u ?? U, 16)));
const pinned = uses =>
  uses.startsWith("./") ||
  (uses.startsWith("docker://") ? /@sha256:[0-9a-f]{64}$/u.test(uses) : /^actions\/[\w.-]+(\/[^@]*)?@.+$/u.test(uses) || /@[0-9a-f]{40}$/u.test(uses));

// What is wrong in one file's text, each as { line, what }.
export function problems(text) {
  const found = [];
  let carried = "";
  text.split(/\r\n|\r|\n/u).forEach((raw, i) => {
    if (/^\s*#/u.test(raw)) { carried = ""; return; }
    const line = plain(raw), joined = carried + line.trimStart();
    carried = /\\$/u.test(raw) ? joined.slice(0, -1).slice(-32) : ""; // the end is enough to find the word across the break
    if (line.includes("pull_request_target") || joined.includes("pull_request_target")) found.push({ line: i + 1, what: "pull_request_target runs a pull request with the repository's own token and secrets: never (floor rule 2)" });
    for (const m of line.matchAll(KEY)) {
      const uses = m[1] ?? m[2] ?? m[3];
      if (uses === undefined) found.push({ line: i + 1, what: "a `uses` with its value not on the same line cannot be read: write it as `uses: name@version` (floor rule 2)" });
      else if (!pinned(uses)) found.push({ line: i + 1, what: `"${uses}" is neither the project's own (./), nor GitHub's own (actions/*), nor pinned to a full commit SHA (floor rule 2)` });
    }
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
    for (const { line, what } of problems(fs.readFileSync(file, "utf8"))) { failed++; console.log(`FAIL ${file}:${line}: ${what}`); }
  }
  console.log(`${failed ? "FAIL" : "ok  "} ${files.length} workflows and actions of the project's own read: ${failed} against floor rule 2`);
  process.exit(failed ? 1 : 0);
}
