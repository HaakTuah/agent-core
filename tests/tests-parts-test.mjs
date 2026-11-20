// Tests the jobs a run of the core's tests started by hand runs where it names parts (scripts/tests-parts.mjs; #954):
// the full run's jobs read from the workflow itself, each the whole of the lists the other events run; what words pick;
// what is refused, each refusal read for its mend (mend.mjs); the script run as the workflow runs it, its outputs
// written; and the workflow's own use of it, a narrowed run named and gated apart from a full one. Run by the core's
// tests workflow (.github/workflows/tests.yml).
//
//   node tests/tests-parts-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { TESTS, fullRun } from "../scripts/release.mjs";
import { FULL, NARROWED, WORKFLOW, fullLists, pick, run } from "../scripts/tests-parts.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const text = fs.readFileSync(path.join(root, WORKFLOW), "utf8");
const key = x => JSON.stringify(x);
const same = (a, b) => key([...a].map(key).sort()) === key([...b].map(key).sort());

// ---- the full run, read from the workflow ----
const lists = fullLists(text);
// (every list each job's matrix holds: a pull request's and a push's, the hourly run's, and the full run's)
const all = job => { const at = text.indexOf(`\n  ${job}:\n`), line = text.slice(at).split("\n").find(l => /^\s+include: \$\{\{ fromJSON\(/u.test(l)); return [...line.matchAll(/'(\[[^']*\])'/gu)].map(m => JSON.parse(m[1])); };
ok(lists && lists.suites.length > 0 && lists.upgrade.length > 0, "the jobs of a full run are read from the matrices of the jobs suites and upgrade", key(lists).slice(0, 300));
ok(lists && ["suites", "upgrade"].every(job => { const [linux, hourly, full] = all(job); return same(full, [...linux, ...hourly]) && same(lists[job], full); }),
  "they are the last list of each matrix, the whole of a pull request's and the hourly run's, so a narrowed run picks from every job there is");
ok(fullLists("jobs:\n  suites:\n    x: 1\n") === null && fullLists(text.replace("}]') }}", "}]x') }}")) === null && fullLists(text.replace("}]') }}", "}")) === null,
  "a workflow whose matrices cannot be read gives no lists, never a list that does not end the expression");

// ---- what words pick ----
const L = {
  suites: [
    { node: ".node-version", os: "ubuntu-latest", parts: "kit core licences terms tools" }, { node: ".node-version", os: "ubuntu-latest", parts: "rest steps" },
    { node: ".node-version", os: "windows-latest", parts: "kit steps" }, { node: ".node-least", os: "windows-latest", parts: "kit steps" },
    { node: ".node-version", os: "windows-latest", parts: "core faults" }, { node: ".node-version", os: "windows-latest", parts: "core places terms" },
    { node: ".node-version", os: "ubuntu-latest", parts: "network" }, { node: ".node-version", os: "windows-latest", parts: "network" },
  ],
  upgrade: [{ os: "ubuntu-latest", part: "older" }, { os: "ubuntu-latest", part: "newer" }, { os: "ubuntu-latest", part: "staged" }, { os: "windows-latest", part: "third" }],
};
const parts = got => got.suites.map(x => `${x.os.slice(0, 3)}:${x.parts}${x.node === ".node-least" ? "*" : ""}`).join("|");
const ups = got => got.upgrade.map(x => `${x.os.slice(0, 3)}:${x.part}`).join("|");
let got = pick(L, "windows kit");
ok(parts(got) === "win:kit steps|win:kit steps*" && ups(got) === "", "a system and a part pick that system's jobs that carry the part, on both Nodes, and no upgrade job", key(got));
got = pick(L, "windows faults");
ok(parts(got) === "win:core faults" && ups(got) === "", "a half of a part picks the job that carries it alone", key(got));
got = pick(L, "core");
ok(parts(got) === "ubu:kit core licences terms tools|win:core faults|win:core places terms" && ups(got) === "", "a part with no system picks its jobs on both, a word matched whole, never within another", key(got));
got = pick(L, "Linux");
ok(parts(got) === "ubu:kit core licences terms tools|ubu:rest steps|ubu:network" && ups(got) === "ubu:older|ubu:newer|ubu:staged", "a system alone picks all its jobs, whatever the case of the word", key(got));
got = pick(L, "staged, upgrade");
ok(parts(got) === "" && ups(got) === "ubu:older|ubu:newer|ubu:staged|win:third", "upgrade and staged pick the upgrade job's parts by the name each job bears, the words split by commas too", key(got));
got = pick(L, "windows network staged");
ok(parts(got) === "win:network" && ups(got) === "win:third", "parts of both jobs are picked together", key(got));

// ---- what is refused ----
const refusals = [pick(L, ""), pick(L, "  , "), pick(L, "windows kitt"), pick(L, "linux faults"), pick(L, "windows; rm")];
ok(refusals.every(r => r.refused && mended(`FAIL: ${r.refused}`)), "no word, a word no job carries and words that pick no job are each refused, saying the mend", refusals.map(r => r.refused).join(" | "));
// (the fallback security review's findings 1 to 3 on 77a7abb: a name GitHub might trim or cut at a line's end, and a
// narrowed run that is a full one in all but its name)
const odd = ["\nwindows kit", " windows kit", "windows kit ", "windows\tkit", "windows kit\r"].map(w => pick(L, w)), every = [pick(L, "linux windows"), pick(L, "staged network kit core rest steps faults places terms licences upgrade")];
ok(odd.every(r => r.refused && mended(`FAIL: ${r.refused}`) && /letters/.test(r.refused)) && every.every(r => r.refused && mended(`FAIL: ${r.refused}`) && /every job/.test(r.refused)) && !pick(L, "windows kit,core").refused,
  "words with anything before, after or between them but spaces and commas are refused, and so are words that pick every job, each saying the mend", [...odd, ...every].map(r => r.refused).join(" | "));
ok(/kitt/.test(refusals[2].refused) && /windows/.test(refusals[2].refused) && /faults/.test(refusals[2].refused) && /picks no job/.test(refusals[3].refused) && /;/.test(refusals[4].refused),
  "a refusal names the word it could not use and what it may name");

// ---- the script, as the workflow runs it (its command line, called beneath the process) ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tests-parts-"));
try {
  const out = path.join(tmp, "output");
  fs.writeFileSync(out, "before=1\n");
  const said = (argv, given = text) => { const lines = []; const status = run(argv, given, { log: l => lines.push(l), err: l => lines.push(l) }); return { status, out: lines.join("\n") }; };
  const r = said(["windows faults", "--output", out]);
  const written = Object.fromEntries(fs.readFileSync(out, "utf8").trim().split("\n").map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  const suites = JSON.parse(written.suites ?? "null"), upgrade = JSON.parse(written.upgrade ?? "null");
  ok(r.status === 0 && written.before === "1" && Array.isArray(suites) && suites.length === 2 && suites.every(x => x.os === "windows-latest" && x.parts === "core faults") && key(upgrade) === "[]"
    && /core faults/.test(r.out) && r.out.includes(`${NARROWED}windows faults`),
    "it adds the jobs picked to the step's outputs, one line for each job, the lines before kept, and prints them", `${r.out}${JSON.stringify(written)}`);
  const refused = [said(["windows bogus", "--output", out]), said([]), said(["a", "b"]), said(["kit", "--output"]), said(["kit"], "name: tests\n")];
  ok(refused.every(x => x.status === 1 && mended(x.out)) && fs.readFileSync(out, "utf8").split("\n").length === 4,
    "it fails a word it cannot use, no words or two, and a workflow it cannot read, each saying the mend and writing no output", refused.map(x => x.out).join(" | "));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ---- a narrowed run is no full run, for the release ----
// (a run of the tests on the commit, as GitHub lists it; a start by hand that names parts bears its name, #954)
const runOf = (event, conclusion, id, status = "completed", title = "tests") => ({ path: TESTS, event, status, conclusion, id, display_title: title, run_started_at: `2026-11-20T10:${String(id).padStart(2, "0")}:00Z` });
const narrowed = (conclusion, id, status) => runOf("workflow_dispatch", conclusion, id, status, `${NARROWED}windows kit`);
const listOf = (...runs) => ({ total_count: runs.length, workflow_runs: runs });
ok(/have not run in full on it yet/.test(fullRun(listOf(narrowed("success", 10)))) && /hourly run\): failure/.test(fullRun(listOf(runOf("schedule", "failure", 9), narrowed("success", 10))))
  && fullRun(listOf(runOf("schedule", "success", 9), narrowed("failure", 10), narrowed(null, 11, "in_progress"))) === null
  && fullRun(listOf(runOf("workflow_dispatch", "success", 10))) === null && /hand-started run\): failure/.test(fullRun(listOf(runOf("schedule", "success", 9), runOf("workflow_dispatch", "failure", 10)))),
  "a start by hand that named parts is never read as the tests in full: its pass lets no release stand, and its failure or its run still going holds none; one that named none, by the workflow's own name, is read as before");
ok(["tests, only", "tests, only\nwindows kit", "Tests", "", null].every(t => /have not run in full on it yet/.test(fullRun(listOf(runOf("workflow_dispatch", "success", 10, "completed", t)))))
  && fullRun(listOf(runOf("schedule", "success", 10, "completed", "anything"))) === null && text.includes(`\nname: ${FULL}\n`),
  "a start by hand is read as full only by the workflow's own name, which the workflow bears: a name trimmed, cut, of another case or missing is not, so a run that cannot be read either way never lets a release stand; an hourly run is read by its event");

// ---- the workflow's own use of it ----
const NAMED = "github.event_name == 'workflow_dispatch' && inputs.only != ''";
ok(text.includes(`run-name: \${{ ${NAMED} && format('${NARROWED}{0}', inputs.only) || '' }}`),
  "a run that names parts is named so, the name a release and the hourly run read to tell it from a full one; any other keeps GitHub's own");
ok(text.includes(`(.event == "schedule" or (.event == "workflow_dispatch" and .display_title == "${FULL}"))`), "the hourly run's skip on main reads a start by hand as full only by the workflow's own name, so no narrowed run");
ok(text.includes(`    name: \${{ ${NAMED} && '${NARROWED}the parts named' || 'tests' }}\n    needs: [moved, pick, suites, upgrade]`),
  "its gate is named apart, so its pass never stands for the check \"tests\" a pull request's head or a push's selection reads; the gate of any other run keeps that name");
ok(text.includes(`  pick:\n    if: \${{ ${NAMED} }}`) && /ONLY: \$\{\{ inputs\.only \}\}\n\s+run: node scripts\/tests-parts\.mjs "\$ONLY" --output "\$GITHUB_OUTPUT"/u.test(text),
  "the jobs are picked only where parts are named, the words handed in through the environment, never into the shell's text");
ok(["suites", "upgrade"].every(job => text.includes(`|| ${NAMED.split(" && ")[1]} && needs.pick.outputs.${job} || '[`) && text.includes(`needs.pick.result == 'success' && needs.pick.outputs.${job} != '[]'`)),
  "each job group runs the jobs picked, and only where the pick passed and picked one of its jobs");

console.log(`${count - failed} of ${count} passed`);
process.exit(failed ? 1 : 0);
