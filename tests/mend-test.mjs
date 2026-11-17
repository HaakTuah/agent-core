// Tests what a failure of a check says (mend.mjs), and holds that each check of the core has a test that reads its
// failures for their mend (AGENTS.md, "A check that fails says the mend"; #254): every script a workflow of the core or
// of the starter kit names, and every workflow with a step that fails by itself, is a check below with its test, or is
// listed with why it fails no pull request; and each check's test calls mended() of mend.mjs. A new check, or a test
// that stops reading the mend, fails here. It holds too that each script a workflow or a session's hook names, and each
// workflow of the core, has its line in the inventory of the core's parts (INVENTORY.md; #534, point 4), and that each
// file a line there names is there, and that a line recording a trial says which of the part's bugs the tool read
// (#593, point 7). Its tests workflow runs it on every pull request here. Node's own modules.
//
//   node tests/mend-test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { failures, mended, unmended } from "../scripts/mend.mjs";

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
  "scripts/copies.mjs": "tests/init-test.mjs",
  "scripts/pointers.mjs": "tests/pointers-test.mjs",
  "scripts/reading-size.mjs": "tests/init-test.mjs",
  "scripts/workflows.mjs": "tests/workflows-test.mjs",
  "scripts/licences.mjs": "tests/licence-scan-test.mjs",
  "scripts/exact-versions.mjs": "tests/exact-versions-test.mjs",
  "scripts/lookup.mjs": "tests/lookup-test.mjs",
  "scripts/agent-tools.mjs": "tests/agent-tools-test.mjs",
  "scripts/licence-installed.mjs": "tests/licence-installed-test.mjs",
  "scripts/nuget.mjs": "tests/nuget-test.mjs",
  "scripts/nuget-fetch.mjs": "tests/nuget-fetch-test.mjs",
  "scripts/pr-description.mjs": "tests/pr-description-test.mjs",
  "scripts/checks.mjs": "tests/checks-test.mjs",
  "scripts/security-review.mjs": "tests/security-review-test.mjs",
  "scripts/code-review-wait.mjs": "tests/code-review-wait-test.mjs",
  "scripts/size.mjs": "tests/size-test.mjs",
  "scripts/general.mjs": "tests/general-test.mjs",
  "scripts/own-modules.mjs": "tests/own-modules-test.mjs",
  "scripts/manifest-reads.mjs": "tests/manifest-reads-test.mjs",
  "scripts/holders.mjs": "tests/holders-test.mjs",
  "scripts/entry-files.mjs": "tests/entry-files-test.mjs",
  "scripts/reading.mjs": "tests/reading-test.mjs",
  "scripts/select.mjs": "tests/select-test.mjs",
  "scripts/shape.mjs": "tests/shape-test.mjs",
  "scripts/choices.mjs": "tests/choices-test.mjs",
  "scripts/strength.mjs": "tests/strength-test.mjs",
  ".github/workflows/core.yml": "tests/core-yml-test.mjs",
  // (their own step that fails is the one that reads where the core's copy stands)
  ".github/workflows/copies.yml": "tests/core-path-test.mjs",
  ".github/workflows/core-moved.yml": "tests/core-path-test.mjs",
  ".github/workflows/licences.yml": "tests/core-path-test.mjs",
  ".github/workflows/look.yml": "tests/core-path-test.mjs",
  ".github/workflows/pr-description.yml": "tests/core-path-test.mjs",
  ".github/workflows/signatures.yml": "tests/core-path-test.mjs",
  ".github/workflows/versions.yml": "tests/core-path-test.mjs",
  ".github/workflows/nuget.yml": "tests/nuget-gate-test.mjs",
  ".github/workflows/personal-terms.yml": "tests/personal-terms-test.mjs",
};
// what a workflow names that fails no pull request, each with why
const NOT_CHECKS = {
  "scripts/core-moved.mjs": "runs on a schedule, and tells a project the core has moved",
  "scripts/look.mjs": "runs on a schedule, and opens issues",
  "scripts/versions.mjs": "runs on a schedule, and opens issues",
  "scripts/release.mjs": "cuts a release, started by hand on main",
  "scripts/site-publish.sh": "publishes a preview of a pull request's site",
  "scripts/nuget-look.sh": "decides whether the NuGet check restores, and fails nothing by itself: checks.mjs runs it, whose test reads its mends",
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
// what runs: each script a workflow or a session's hook names, a test aside (the hooks' settings: Claude Code's here,
// and each tool's that the starter kit writes)
const named = new Set();
const hooks = [".claude/settings.json", ...fs.readdirSync(path.join(root, "setup/template"))
  .filter(f => /(?:hook|settings).*\.json/u.test(f)).map(f => `setup/template/${f}`)];
for (const hook of hooks) for (const m of fs.readFileSync(path.join(root, hook), "utf8").matchAll(/scripts\/([a-z0-9-]+\.(?:mjs|sh))/gu)) {
  if (!m[1].endsWith("-test.mjs")) named.add(`scripts/${m[1]}`);
}
for (const wf of workflows) {
  // each line without its comment: a "#" that starts the line or follows a space
  const code = fs.readFileSync(path.join(root, wf), "utf8").split(/\r?\n/u).map(l => l.replace(/(^|\s)#.*$/u, ""));
  for (const line of code) for (const m of line.matchAll(/scripts\/([a-z0-9-]+\.(?:mjs|sh))/gu)) {
    const name = `scripts/${m[1]}`;
    if (!name.endsWith("-test.mjs")) named.add(name);
    if (!name.endsWith("-test.mjs") && !(name in CHECKS) && !(name in NOT_CHECKS)) unlisted.add(`${name} (named in ${wf})`);
  }
  if (code.some(l => /(?:^|[;&|{\s])exit\s+(?:1\b|"?\$)/u.test(l)) && !(wf in CHECKS) && !(wf in NOT_CHECKS)) unlisted.add(`${wf} (a step of its own fails)`);
}
ok(unlisted.size === 0, `every script a workflow names, and every workflow with a step that fails by itself, is a check with its test or is said to fail no pull request${unlisted.size ? `: not so for ${[...unlisted].join(", ")}. Mend: add it to CHECKS in tests/mend-test.mjs with the test that reads its failures, or to NOT_CHECKS with why it fails no pull request` : ""}`);
for (const [name, why] of Object.entries(NOT_CHECKS)) ok(fs.existsSync(path.join(root, name)) && why, `${name} is there, and says why it is no check`);

// the inventory: a part's line is a bullet, its lines joined; the files it names are the backticked ones before its
// first ": "
const inventory = fs.readFileSync(path.join(root, "INVENTORY.md"), "utf8");
const parts = new Set();
for (const part of inventory.split(/\r?\n(?! )/u).filter(l => /^- /u.test(l))) {
  for (const m of part.replace(/\s*\r?\n\s*/gu, " ").split(": ")[0].matchAll(/`([^`]+)`/gu)) parts.add(m[1]);
}
const runs = [...named, ...fs.readdirSync(path.join(root, ".github/workflows")).map(f => `.github/workflows/${f}`)];
const left = runs.filter(name => !parts.has(name)).sort();
ok(left.length === 0, `each script a workflow or a hook names, and each workflow, has its line in INVENTORY.md${left.length
  ? `: not so for ${left.join(", ")}. Mend: add a line for each to INVENTORY.md, under the heading it belongs to, as its "How a line reads" says: what it does, where it must run, what else does it (searched on the web too), and a verdict`
  : ""}`);
const gone = [...parts].filter(name => /^(?:scripts|\.github|setup)\//u.test(name)
  && (name.split("/").includes("..") || !fs.existsSync(path.join(root, name)))).sort();
ok(gone.length === 0, `each file a line of INVENTORY.md names is there${gone.length
  ? `: not so for ${gone.join(", ")}. Mend: in INVENTORY.md, name the file where it went, or take out the line of a part that is gone`
  : ""}`);
// a part's line that records a trial of a maintained tool (*Tried:*) says which of the part's bugs the tool read
// (*Replayed:*; tasks/choices.md, "A trial of a maintained tool replays the part's past bugs"; #593)
const unreplayed = text => text.split(/\r?\n(?! )/u).filter(l => /^- /u.test(l)).map(l => l.replace(/\s*\r?\n\s*/gu, " "))
  .filter(l => /\*Tried:\*/u.test(l) && !/\*Replayed:\*/u.test(l)).map(l => l.split(": ")[0].replace(/^- /u, ""));
ok(unreplayed("- `a.mjs`: reads.\n  *Tried:* a tool, 2 s.\n- `b.mjs`: reads. *Tried:* a tool. *Replayed:* #1 read.\n- `c.mjs`: reads.").join() === "`a.mjs`",
  "a part's line that records a trial and replays none of its bugs is found, one that replays them or records no trial is not");
const notReplayed = unreplayed(inventory);
ok(notReplayed.length === 0, `each part's line of INVENTORY.md that records a trial says which of the part's bugs the tool read${notReplayed.length
  ? `: not so for ${notReplayed.join(", ")}. Mend: run the tool on the case of each bug filed against the part, and add to its line "*Replayed:*" with each bug's number and whether the tool read it ("none" where no bug was filed; a case no longer at hand named as not run, and why), as tasks/choices.md says ("A trial of a maintained tool replays the part's past bugs")`
  : ""}`);

for (const [check, test] of Object.entries(CHECKS)) {
  let text = "";
  try { text = fs.readFileSync(path.join(root, test), "utf8"); } catch { /* read as missing below */ }
  const reads = /from "\.\.\/scripts\/mend\.mjs"/u.test(text) && /\bmended\(/u.test(text);
  ok(fs.existsSync(path.join(root, check)) && reads, `${check}: its test, ${test}, reads its failures for their mend${reads ? ""
    : `${text ? "" : " (no such test)"}. Mend: in ${test}, run the check where it fails and ask mended() of scripts/mend.mjs of its output`}`);
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
