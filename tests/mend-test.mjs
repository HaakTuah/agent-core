// Tests what a failure of a check says (mend.mjs), and holds that each check of the core has a test that reads its
// failures for their mend (AGENTS.md, "A check that fails says the mend"; #254): every script a workflow of the core or
// of the starter kit names, and every workflow with a step that fails by itself, is a check below with its test, or is
// listed with why it fails no pull request; and each check's test calls mended() of mend.mjs. A new check, or a test
// that stops reading the mend, fails here. It holds too that each file git tracks is claimed by a line of the inventory
// of the core's parts (INVENTORY.md; #534, point 4) or left out there with its reason (#593, point 2), that each file
// a line there names is there, and that a line recording a trial says which of the part's bugs the tool read (#593,
// point 7), the inventory read whole through scripts/inventory.mjs: each folder of inventory/ named in INVENTORY.md,
// and no part's line written in INVENTORY.md itself (#750, point 1). Its tests workflow runs it on every pull request
// here. Node's own modules and git.
//
//   node tests/mend-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { failures, mended, unmended } from "../scripts/mend.mjs";
import { ANSWERS } from "../scripts/check-runs-read.mjs";
import { folders, partsIn, whole } from "../scripts/inventory.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

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
  "scripts/install.mjs": "tests/packages-test.mjs",
  "scripts/reading-size.mjs": "tests/init-test.mjs",
  "scripts/read-total.mjs": "tests/read-total-test.mjs",
  "scripts/workflows.mjs": "tests/workflows-test.mjs",
  "scripts/licences.mjs": "tests/licence-scan-test.mjs",
  "scripts/exact-versions.mjs": "tests/exact-versions-test.mjs",
  "scripts/lookup.mjs": "tests/lookup-test.mjs",
  "scripts/week-wait.mjs": "tests/packages-test.mjs",
  "scripts/agent-tools.mjs": "tests/agent-tools-list-test.mjs",
  "scripts/licence-installed.mjs": "tests/licence-installed-test.mjs",
  "scripts/nuget.mjs": "tests/nuget-test.mjs",
  "scripts/nuget-fetch.mjs": "tests/nuget-fetch-test.mjs",
  "scripts/code-scan.mjs": "tests/code-scan-test.mjs",
  "scripts/pr-description.mjs": "tests/pr-description-test.mjs",
  "scripts/checks.mjs": "tests/checks-test.mjs",
  "scripts/security-review.mjs": "tests/security-review-test.mjs",
  "scripts/code-review-wait.mjs": "tests/code-review-wait-test.mjs",
  "scripts/size.mjs": "tests/size-test.mjs",
  "scripts/queue.mjs": "tests/queue-test.mjs",
  "scripts/general.mjs": "tests/general-test.mjs",
  "scripts/pattern.mjs": "tests/pattern-test.mjs",
  "scripts/own-modules.mjs": "tests/own-modules-test.mjs",
  "scripts/manifest-reads.mjs": "tests/manifest-reads-test.mjs",
  "scripts/holders.mjs": "tests/holders-test.mjs",
  "scripts/entry-files.mjs": "tests/entry-files-test.mjs",
  "scripts/tools-offer.mjs": "tests/tools-offer-test.mjs",
  "scripts/reading.mjs": "tests/reading-test.mjs",
  "scripts/select.mjs": "tests/select-test.mjs",
  "scripts/shape.mjs": "tests/shape-test.mjs",
  "scripts/choices.mjs": "tests/choices-check-test.mjs",
  "scripts/strength.mjs": "tests/strength-test.mjs",
  ".github/workflows/core.yml": "tests/core-yml-test.mjs",
  // (their own step that fails is the one that reads where the core's copy stands)
  ".github/workflows/copies.yml": "tests/core-path-hooks-test.mjs",
  ".github/workflows/core-moved.yml": "tests/core-path-hooks-test.mjs",
  ".github/workflows/licences.yml": "tests/core-path-hooks-test.mjs",
  ".github/workflows/look.yml": "tests/core-path-hooks-test.mjs",
  ".github/workflows/pr-description.yml": "tests/core-path-hooks-test.mjs",
  ".github/workflows/signatures.yml": "tests/core-path-hooks-test.mjs",
  ".github/workflows/versions.yml": "tests/core-path-hooks-test.mjs",
  ".github/workflows/nuget.yml": "tests/nuget-gate-test.mjs",
  ".github/workflows/personal-terms.yml": "tests/personal-terms-test.mjs",
  // (its gate fails on a draft, saying the mend, since a required check whose job is skipped passes; #733)
  ".github/workflows/tests.yml": "tests/workflows-test.mjs",
  // (a step's shell, which fails a step it could not cut the network off for, and says so of one that reached it; #770)
  "scripts/offline.sh": "tests/offline-test.mjs",
};
// what a workflow names that fails no pull request, each with why
const NOT_CHECKS = {
  "scripts/core-moved.mjs": "runs on a schedule, and tells a project the core has moved",
  "scripts/look.mjs": "runs on a schedule, and opens issues",
  "scripts/issue-terms.mjs": "runs on a schedule, takes the personal terms out of issues and comments, and fails nothing",
  "scripts/lychee.sh": "fetches the link checker the pointer check runs, at set-up, and always exits 0; the check (pointers.mjs) says where it was not fetched",
  "scripts/test-downloads.sh": "fetches, at set-up, what the tests that run with the network cut off need, and always exits 0; the tests that need it fail saying their own mend where it was not fetched",
  "scripts/workflow-tools.sh": "fetches the two tools the workflow check runs, at set-up, and always exits 0; the check (workflows.mjs) says where one was not fetched",
  "scripts/versions.mjs": "runs on a schedule, and opens issues",
  "scripts/release.mjs": "cuts a release, started by hand on main",
  "scripts/tests-parts.mjs": "picks the jobs a start of the tests by hand that names parts runs: no pull request starts it",
  "scripts/site-publish.sh": "publishes a preview of a pull request's site",
  "scripts/nuget-look.sh": "decides whether the NuGet check restores, and fails nothing by itself: checks.mjs runs it, whose test reads its mends",
  "scripts/sync.mjs": "named in core.yml's mends, as what a session runs to mend the copy",
  "scripts/pure-sync.mjs": "run by security-review.yml as a proof alone: where it fails, the sync is not proved pure and the status says its own mend",
  "scripts/clean-merges.mjs": "run by security-review.yml as a proof alone: a merge it does not prove stops a review of an earlier commit, and the status says its own mend",
  "scripts/power.mjs": "run by security-review.yml as a proof alone: where it fails or reads a commit too late, no later commit is light, each review is asked of the head as before, and each script or workflow changed asks floor rule 3's two",
  "scripts/queue-only.mjs": "run by own-security-review.yml as a proof alone: a pull request it does not prove gets its reviews as any other, the job passing and the status saying its own mend",
  ".github/workflows/preview.yml": "publishes a preview of a pull request's site",
  ".github/workflows/release.yml": "cuts a release, started by hand on main, and runs the upgrade test on Windows on main once a day: no pull request runs it",
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
ok(unlisted.size === 0, `every script a workflow names, and every workflow with a step that fails by itself, is a check with its test or is said to fail no pull request${unlisted.size ? `: not so for ${[...unlisted].join(", ")}. Mend: add it to CHECKS in tests/mend-test.mjs with the test that reads its failures, or to NOT_CHECKS with why it fails no pull request` : ""}`);
for (const [name, why] of Object.entries(NOT_CHECKS)) ok(fs.existsSync(path.join(root, name)) && why, `${name} is there, and says why it is no check`);

// the inventory of the core's parts (INVENTORY.md; #534, point 4), read whole, each folder of inventory/ it names put
// in place by scripts/inventory.mjs (#750, point 1), a sweep whose source is the tracked files
// (tasks/cleaning.md, "A sweep's scope is read, not listed"; #593, point 2): each tracked file is claimed by a part's
// line, or lies under a path its section "What the inventory leaves out" names with the reason. A part's line is a
// bullet from the first "##" heading to that section, its lines joined (what stands above, the trials, and below, the
// challenge and the verdicts, claims nothing); the paths it names are the backticked ones before its first ": ", a
// folder (ending in /) naming what lies under it, and a script's line claims its test too, tests/<its name>-test.mjs.
// The inventory says on a line that opens "Challenged" the day a fresh session challenged it (#593, point 3).
const LEAVES = "What the inventory leaves out";
function inventoryOf(text) {
  const parts = new Set(), leaves = new Map();
  let phase = "above";
  for (const block of String(text).split(/\r?\n(?! )/u)) {
    const heading = /^(#{1,6})\s+(.*)$/u.exec(block);
    if (heading) {
      if (heading[1] === "##") phase = heading[2].trim() === LEAVES ? "leaves" : phase === "above" ? "parts" : phase === "parts" ? "parts" : "below";
      continue;
    }
    if (!/^- /u.test(block) || phase === "above" || phase === "below") continue;
    const [names, ...rest] = block.replace(/\s*\r?\n\s*/gu, " ").split(": ");
    for (const m of names.matchAll(/`([^`]+)`/gu)) {
      if (phase === "leaves") leaves.set(m[1], rest.join(": ").trim());
      else parts.add(m[1]);
    }
  }
  return { parts, leaves };
}
const under = (file, names) => [...names].some(n => n === file || (n.endsWith("/") && file.startsWith(n)));
function unclaimed(files, { parts, leaves }) {
  return files.filter(f => {
    const test = /^tests\/(.+)-test\.mjs$/u.exec(f);
    return !under(f, parts) && !under(f, leaves.keys()) && !(test && (parts.has(`scripts/${test[1]}.mjs`) || parts.has(`scripts/${test[1]}.sh`)));
  });
}
{
  const one = inventoryOf("# I\n\n- *A trial:* `scripts/t.mjs`: ran.\n\n## Checks\n\n- `scripts/a.mjs`, `setup/t/`: does a.\n### More\n\n- `scripts/b.mjs`: does\n  b: more.\n\n## What the inventory leaves out\n\n- `words/`: the owner's words.\n- `x.md`:\n\n## The challenge\n\n- `scripts/c.mjs`: weighed.\n");
  ok(one.parts.has("scripts/a.mjs") && one.parts.has("setup/t/") && one.parts.has("scripts/b.mjs") && !one.parts.has("words/")
    && one.leaves.get("words/") === "the owner's words." && one.leaves.get("x.md") === "",
    "the inventory reads a part's paths before its first colon, its lines joined, and the paths left out with their reasons");
  ok(!one.parts.has("scripts/t.mjs") && !one.parts.has("scripts/c.mjs") && !one.leaves.has("scripts/c.mjs"),
    "a bullet above the first heading of parts, or below the section left out, claims nothing");
  const files = ["scripts/a.mjs", "tests/a-test.mjs", "setup/t/k.tmpl", "words/1.md", "scripts/c.mjs", "tests/c-test.mjs", "x.md"];
  ok(unclaimed(files, one).join() === "scripts/c.mjs,tests/c-test.mjs", "a file no line claims and no path leaves out is unclaimed, a test with its script");
}
const tracked = (() => {
  try { return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean); } catch { return null; }
})();
ok(tracked !== null && tracked.length > 0, `the tracked files are read${tracked ? "" : ". Mend: run the test in a clone of the repository, where git lists its files"}`);
{
  const at = scratchDir("inventory-");
  fs.writeFileSync(path.join(at, "INVENTORY.md"), "# I\r\n\r\n## A\r\n\r\nIts parts stand in `inventory/a/`, a file each, read in the order of their names.\r\n\r\n## B\n\nIts parts stand in `inventory/b/`, a file each, read in the order of their names.\n\nEnd.\n");
  fs.mkdirSync(path.join(at, "inventory/a"), { recursive: true });
  fs.writeFileSync(path.join(at, "inventory/a/020-y.md"), "- `y`: two\n  lines.\n");
  fs.writeFileSync(path.join(at, "inventory/a/010-x.md"), "- `x`: one.\r\n");
  fs.writeFileSync(path.join(at, "inventory/a/030-z.txt"), "- `z`: not a part.\n");
  ok(whole(at) === "# I\r\n\r\n## A\r\n\r\n- `x`: one.\n- `y`: two\n  lines.\n\r\n## B\n\n\n\nEnd.\n" && folders(at).join() === "inventory/a,inventory/b"
    && partsIn(at, "inventory/b").length === 0, "the inventory is read whole, each folder's parts in the order of their names in place of the line naming it, a file not of Markdown or a folder not there giving none");
  fs.rmSync(at, { recursive: true, force: true });
}
// a part's line written in INVENTORY.md itself: a bullet from its first "##" heading to the section of what it leaves
// out, where only the lines naming the folders stand (#750, point 1), each named with its heading
const inPlace = text => {
  const found = [];
  let phase = "above", heading = "";
  for (const line of String(text).split(/\r?\n/u)) {
    const h = /^(#{1,6})\s+(.*)$/u.exec(line);
    if (h) {
      if (h[1] === "##") phase = h[2].trim() === LEAVES ? "leaves" : phase === "above" || phase === "parts" ? "parts" : "below";
      heading = line;
    } else if (phase === "parts" && /^- /u.test(line)) found.push(`${heading}: ${line.slice(0, 60)}`);
  }
  return found;
};
ok(inPlace("# I\n\n- `t`: above.\n\n## A\n\nIts parts stand in `inventory/a/`, a file each, read in the order of their names.\n### Sub\n\n- `x`: here.\n\n## B\r\n\r\n- **y**: no folder.\r\n\n## What the inventory leaves out\n\n- `w/`: left out.\n\n## The challenge\n\n- `c`: below.\n").join("; ") === "### Sub: - `x`: here.; ## B: - **y**: no folder.",
  "a part's line in INVENTORY.md itself is found under any heading of parts, one above them, left out or below is not");
const written = inPlace(fs.readFileSync(path.join(root, "INVENTORY.md"), "utf8"));
ok(written.length === 0, `no part's line stands in INVENTORY.md itself${written.length ? `: not so for ${written.join("; ")}. Mend: move each such line, byte for byte, into a file of its own in the folder its heading names (a heading with none gets the line "Its parts stand in \`inventory/<folder>/\`, a file each, read in the order of their names."), named to stand in order between its neighbours (NNN-<name>.md)` : ""}`);
const inventoryText = whole(root);
// each folder of inventory/ named in INVENTORY.md, each named folder there with its parts, each a file of Markdown
const entries = at => { try { return fs.readdirSync(path.join(root, at), { withFileTypes: true }); } catch { return null; } };
const named = folders(root);
const stray = [...(entries("inventory") ?? []).filter(d => !named.includes(`inventory/${d.name}`)).map(d => `inventory/${d.name}, named nowhere`),
  ...named.filter(f => !entries(f)?.length).map(f => `${f}, named but not there or empty`),
  ...named.flatMap(f => (entries(f) ?? []).filter(e => !e.isFile() || !e.name.endsWith(".md")).map(e => `${f}/${e.name}, no file of Markdown`))];
ok(stray.length === 0, `each folder of inventory/ is named in INVENTORY.md, and holds its parts, each a file of Markdown directly in it${stray.length ? `: not so for ${stray.join("; ")}. Mend: name each folder under its heading in INVENTORY.md with the line "Its parts stand in \`inventory/<folder>/\`, a file each, read in the order of their names.", or take it out where it holds no part; and make each part a file NNN-<name>.md directly in a folder named there` : ""}`);
const inv = inventoryOf(inventoryText);
const left = unclaimed(tracked ?? [], inv);
ok(left.length === 0, `each tracked file is claimed by a part of the inventory or left out there with its reason${left.length
  ? `: not so for ${left.length}, ${left.slice(0, 20).join(", ")}${left.length > 20 ? ", ..." : ""}. Mend: name each on the line of the part it belongs to, in its file under inventory/, or add a file for it to the folder INVENTORY.md names under the heading it belongs to, named to stand in order between its neighbours (NNN-<name>.md), its line as "How a line reads" says (what it does, where it must run, what else does it, searched on the web too, and a verdict); or, where it is no part (a rule file's content, a record), name it or its folder under "${LEAVES}" with the reason`
  : ""}`);
const bare = [...inv.leaves].filter(([, why]) => !why).map(([name]) => name);
ok(bare.length === 0, `each path INVENTORY.md leaves out says why${bare.length ? `: not so for ${bare.join(", ")}. Mend: after its ": ", say why it is no part of the core` : ""}`);
const gone = [...inv.parts, ...inv.leaves.keys()].filter(name => !/\s/u.test(name) && (name.includes("/") || /^\.?[\w-]+\.[\w.]+$|^[A-Z]+$/u.test(name)))
  .filter(name => name.split("/").includes("..") || !fs.existsSync(path.join(root, name))).sort();
ok(/^Challenged\b.*\b\d{4}-\d{2}-\d{2}\b/mu.test(inventoryText), `INVENTORY.md says on a line that opens "Challenged" the day a fresh session challenged it${/^Challenged\b.*\b\d{4}-\d{2}-\d{2}\b/mu.test(inventoryText) ? "" : ". Mend: have a fresh session that wrote no part of it read it whole for what it lacks, write its finds in, and add the line \"Challenged whole: <the day>\" (tasks/cleaning.md, \"An inventory or an audit is challenged once for what it missed\")"}`);
ok(gone.length === 0, `each file a line of the inventory names is there${gone.length
  ? `: not so for ${gone.join(", ")}. Mend: in the part's file under inventory/ (or in INVENTORY.md, for a path it leaves out), name the file where it went, or take out the file of a part that is gone`
  : ""}`);
// a part's line that records a trial of a maintained tool (*Tried:*) says which of the part's bugs the tool reads
// (*Replayed:*; tasks/choices.md, "A trial of a maintained tool replays the part's past bugs"; #593)
const unreplayed = text => text.split(/\r?\n(?! )/u).filter(l => /^- /u.test(l)).map(l => l.replace(/\s*\r?\n\s*/gu, " "))
  .filter(l => /\*Tried:\*/u.test(l) && !/\*Replayed:\*/u.test(l)).map(l => l.split(": ")[0].replace(/^- /u, ""));
ok(unreplayed("- `a.mjs`: reads.\n  *Tried:* a tool, 2 s.\n- `b.mjs`: reads. *Tried:* a tool. *Replayed:* #1 read.\n- `c.mjs`: reads.").join() === "`a.mjs`",
  "a part's line that records a trial and replays none of its bugs is found, one that replays them or records no trial is not");
const notReplayed = unreplayed(inventoryText);
ok(notReplayed.length === 0, `each part of the inventory that records a trial says which of the part's bugs the tool reads and which it does not${notReplayed.length
  ? `: not so for ${notReplayed.join(", ")}. Mend: for each bug filed against the part, run the tool on the test cases its merged fix added or changed, taken from those on the default branch and never from the issue's text, and add to its line "*Replayed:*" with each bug's number and whether the tool reads its case or not ("none" where no bug was filed; a bug whose fix added or changed no test case named as not run), as tasks/choices.md says ("A trial of a maintained tool replays the part's past bugs")`
  : ""}`);

// Every mend a script of the core gives that names the installer by its path gives it guarded, so that a step written
// ahead of a sync passes on a copy that holds no installer yet ("The core's checks run in a project's own jobs as they
// stand" in AGENTS.md; #1093): each `node <path>install.mjs` on a line that says "Mend" stands after `then `, or after
// "in the core, " where the mend gives the core's own repository its form too, the installer always there.
const unguarded = line => /Mend/u.test(line) && [...line.matchAll(/node\s+\S*install\.mjs/gu)].some(m => !/(?:then |in the core, )$/u.test(line.slice(0, m.index)));
ok(unguarded("FAIL x. Mend: run node core/scripts/install.mjs, then the check") && !unguarded("FAIL x. Mend: run `if [ -f core/scripts/install.mjs ]; then node core/scripts/install.mjs all; fi`") && !unguarded("FAIL x. Mend: run `if [ -f core/scripts/install.mjs ]; then node core/scripts/install.mjs; fi` (in the core, node scripts/install.mjs)") && !unguarded("node core/scripts/install.mjs # no mend here"),
  "an install mend with the installer unguarded is found; a guarded one, the core's own form beside it, and a line that gives no mend, are not");
const openInstalls = (tracked ?? []).filter(f => /^scripts\/.*\.(?:mjs|sh)$/u.test(f))
  .flatMap(f => fs.readFileSync(path.join(root, f), "utf8").split("\n").flatMap((l, i) => (unguarded(l) ? [`${f}:${i + 1}`] : [])));
ok(openInstalls.length === 0, `every mend of the core's scripts that names the installer gives it guarded${openInstalls.length ? `: not so at ${openInstalls.join(", ")}. Mend: write it as \`if [ -f <the path> ]; then node <the path>; fi\` (installStep() of scripts/packages.mjs builds it)` : ""}`);

for (const [check, test] of Object.entries(CHECKS)) {
  let text = "";
  try { text = fs.readFileSync(path.join(root, test), "utf8"); } catch { /* read as missing below */ }
  const reads = /from "\.\.\/scripts\/mend\.mjs"/u.test(text) && /\bmended\(/u.test(text);
  ok(fs.existsSync(path.join(root, check)) && reads, `${check}: its test, ${test}, reads its failures for their mend${reads ? ""
    : `${text ? "" : " (no such test)"}. Mend: in ${test}, run the check where it fails and ask mended() of scripts/mend.mjs of its output`}`);
}

// each check of Node's whose entry runs through guard() (#1140, point 1): its import from mend.mjs and its call
for (const check of Object.keys(CHECKS).filter(c => c.endsWith(".mjs"))) {
  let text = "";
  try { text = fs.readFileSync(path.join(root, check), "utf8"); } catch { /* read as missing below */ }
  // (or, in a script that stands alone, as the start hook runs reading.mjs from stdin, mend.mjs imported late)
  const through = (/^import \{[^}]*\bguard\b[^}]*\} from "\.\/mend\.mjs";$/mu.test(text) || /\(await import\("\.\/mend\.mjs"\)\)\.guard\(import\.meta\.url\)/u.test(text))
    && /\bguard\(import\.meta\.url\)/u.test(text);
  ok(through, `${check}: its entry runs through guard(), so an error it does not catch fails with its mend${through ? ""
    : `. Mend: start the script through \`guard()\` from \`scripts/mend.mjs\`: import { guard } from "./mend.mjs", and write its entry as if (guard(import.meta.url)) { ... } in place of started(), or call guard(import.meta.url) before its first statement`}`);
}
// each hostile test runs the core's scripts through check-runs.mjs, which reads each run that fails (#1140, point 2)
const hostile = fs.readdirSync(path.join(root, "tests")).filter(f => /^hostile-.+-test\.mjs$/u.test(f));
ok(hostile.length > 0, `the hostile tests are found${hostile.length ? "" : ". Mend: run the test from the core's clone, where tests/hostile-*-test.mjs stand"}`);
for (const f of hostile) {
  const text = fs.readFileSync(path.join(root, "tests", f), "utf8");
  const watched = !/["'`](?:node:)?child_process["'`]/u.test(text);
  ok(watched, `tests/${f} runs what it starts through scripts/check-runs.mjs${watched ? ""
    : `. Mend: in tests/${f}, import spawnSync and execFileSync from "../scripts/check-runs.mjs" in place of "node:child_process"`}`);
}
const answerFaults = [...ANSWERS].filter(a => a in CHECKS || !fs.existsSync(path.join(root, a)));
ok(answerFaults.length === 0, `each proof whose exit code is its answer is there and no check${answerFaults.length ? `: not so for ${answerFaults.join(", ")}. Mend: take it out of ANSWERS in scripts/check-runs-read.mjs` : ""}`);

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
