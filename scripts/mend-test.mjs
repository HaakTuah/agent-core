// Tests what a failure of a check says (mend.mjs), and holds that each check of the core has a test that reads its
// failures for their mend (AGENTS.md, "A check that fails says the mend"; #254): every script a workflow of the core or
// of the starter kit names, and every workflow with a step that fails by itself, is a check below with its test, or is
// listed with why it fails no pull request; and each check's test calls mended() of mend.mjs. A new check, or a test
// that stops reading the mend, fails here. Its tests workflow runs it on every pull request here. Node's own modules.
//
//   node scripts/mend-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { failures, mended, unmended } from "./mend.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// what a failure says
ok(mended("FAIL: core-manifest.md has no pin line. Mend: write the line the sync writes.") && mended("ok   one\nFAIL x.md:3: a broken pointer. Mend: point it at the file that holds it.\n  x.md:3\nok   two"),
  "a failure that says its mend is mended, with its details and passing lines around it");
ok(mended("::error::FAIL the cap is passed. Mend: say it in fewer words.") && mended("::error file=a.md,line=2::FAIL a.md:2: x. Mend: take it out."),
  "a failure opened by a workflow command is read after it");
ok(!mended("FAIL: something is wrong") && unmended("FAIL: a\nFAIL: b. Mend: do this here.").length === 1, "a failure without its mend is not, and is listed");
ok(!mended("FAIL: x. Mend:") && !mended("FAIL: x. Mend: fix") && !mended("FAIL: x. mend: fix it"), "nor one whose mend is empty, one word, or not the marker");
ok(!mended("") && !mended("ok   all is well") && !mended(undefined), "output with no failure in it is no mended failure: a test asks this of a run that fails");
ok(failures("FAILED to read\n  FAIL indented\nFAIL: a. Mend: do it now.\r\nFAIL\tb. Mend: do it now.").length === 2, "a failure is a line that starts with the word FAIL, whatever ends the line");

// the checks of the core and their tests
const CHECKS = {
  "scripts/copies.mjs": "scripts/init-test.mjs",
  "scripts/pointers.mjs": "scripts/pointers-test.mjs",
  "scripts/reading-size.mjs": "scripts/init-test.mjs",
  "scripts/workflows.mjs": "scripts/workflows-test.mjs",
  "scripts/licences.mjs": "scripts/licence-scan-test.mjs",
  "scripts/exact-versions.mjs": "scripts/exact-versions-test.mjs",
  "scripts/licence-installed.mjs": "scripts/licence-installed-test.mjs",
  "scripts/nuget.mjs": "scripts/nuget-test.mjs",
  "scripts/nuget-fetch.mjs": "scripts/nuget-fetch-test.mjs",
  "scripts/pr-description.mjs": "scripts/pr-description-test.mjs",
  "scripts/security-review.mjs": "scripts/security-review-test.mjs",
  "scripts/code-review-wait.mjs": "scripts/code-review-wait-test.mjs",
  "scripts/size.mjs": "scripts/size-test.mjs",
  "scripts/general.mjs": "scripts/general-test.mjs",
  "scripts/own-modules.mjs": "scripts/own-modules-test.mjs",
  "scripts/manifest-reads.mjs": "scripts/manifest-reads-test.mjs",
  ".github/workflows/core.yml": "scripts/core-yml-test.mjs",
  ".github/workflows/nuget.yml": "scripts/nuget-gate-test.mjs",
  ".github/workflows/personal-terms.yml": "scripts/personal-terms-test.mjs",
};
// what a workflow names that fails no pull request, each with why
const NOT_CHECKS = {
  "scripts/core-moved.mjs": "runs on a schedule, and tells a project the core has moved",
  "scripts/look.mjs": "runs on a schedule, and opens issues",
  "scripts/versions.mjs": "runs on a schedule, and opens issues",
  "scripts/release.mjs": "cuts a release, started by hand on main",
  "scripts/site-publish.sh": "publishes a preview of a pull request's site",
  "scripts/sync.mjs": "named in core.yml's mends, as what a session runs to mend the copy",
  "scripts/pure-sync.mjs": "run by security-review.yml as a proof alone: where it fails, the sync is not proved pure and the status says its own mend",
  "scripts/clean-merges.mjs": "run by security-review.yml as a proof alone: a merge it does not prove stops a review of an earlier commit, and the status says its own mend",
  ".github/workflows/preview.yml": "publishes a preview of a pull request's site",
  ".github/workflows/release.yml": "cuts a release, started by hand on main",
};

const workflows = [
  ...fs.readdirSync(path.join(root, ".github/workflows")).map(f => `.github/workflows/${f}`),
  ...fs.readdirSync(path.join(root, "setup/template/workflows")).map(f => `setup/template/workflows/${f}`),
];
const unlisted = new Set();
for (const wf of workflows) {
  // each line without its comment: a "#" that starts the line or follows a space
  const code = fs.readFileSync(path.join(root, wf), "utf8").split(/\r?\n/u).map(l => l.replace(/(^|\s)#.*$/u, ""));
  for (const line of code) for (const m of line.matchAll(/scripts\/([a-z0-9-]+\.(?:mjs|sh))/gu)) {
    const name = `scripts/${m[1]}`;
    if (!name.endsWith("-test.mjs") && !(name in CHECKS) && !(name in NOT_CHECKS)) unlisted.add(`${name} (named in ${wf})`);
  }
  if (code.some(l => /(?:^|[;&|{\s])exit\s+(?:1\b|"?\$)/u.test(l)) && !(wf in CHECKS) && !(wf in NOT_CHECKS)) unlisted.add(`${wf} (a step of its own fails)`);
}
ok(unlisted.size === 0, `every script a workflow names, and every workflow with a step that fails by itself, is a check with its test or is said to fail no pull request${unlisted.size ? `: not so for ${[...unlisted].join(", ")}. Mend: add it to CHECKS in scripts/mend-test.mjs with the test that reads its failures, or to NOT_CHECKS with why it fails no pull request` : ""}`);
for (const [name, why] of Object.entries(NOT_CHECKS)) ok(fs.existsSync(path.join(root, name)) && why, `${name} is there, and says why it is no check`);

for (const [check, test] of Object.entries(CHECKS)) {
  let text = "";
  try { text = fs.readFileSync(path.join(root, test), "utf8"); } catch { /* read as missing below */ }
  const reads = /from "\.\/mend\.mjs"/u.test(text) && /\bmended\(/u.test(text);
  ok(fs.existsSync(path.join(root, check)) && reads, `${check}: its test, ${test}, reads its failures for their mend${reads ? ""
    : `${text ? "" : " (no such test)"}. Mend: in ${test}, run the check where it fails and ask mended() of scripts/mend.mjs of its output`}`);
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
