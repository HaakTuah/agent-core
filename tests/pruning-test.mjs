// Tests of the rules' pruning (pruning.mjs; AGENTS.md, "Rules are pruned by their numbers"; #303): when one is due, the
// rules taken out of a case's core, and the list: each sign, the step, "too early", the floor and "in use"; the rules
// with no holder are tested in tests/pruning-unheld-test.mjs (#895). Node's own modules only; the calls to gh and git
// are the script's own and are not made here, save a run that fails.
//
//   node tests/pruning-test.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { checksOf, list, rare, stepsOf, without } from "../scripts/pruning-list.mjs";
import { firedOf, stepsAt } from "../scripts/pruning-read.mjs";
import { DIRECT, due, generation, open, said } from "../scripts/pruning-record.mjs";
import { rulesOf } from "../scripts/rules.mjs";
import * as facade from "../scripts/pruning.mjs";
import { R, marked, agents, still, moved, quiet, loud, floor, passed, stand, young, unknown, own, numbers, named, p, cases } from "../scripts/pruning-scratch.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// ---- the names pruning.mjs exported before its split (#888) ----
ok(["DIRECT", "EARLY", "EVERY", "MARKS", "RECORD", "UNHELD", "checksOf", "counts", "due", "firedOf", "generation", "joinedIn", "list", "open", "rare", "readRecord", "readUnheld", "said", "stepsAt", "stepsOf", "unheldLines", "without"].every(n => n in facade), "pruning.mjs still exports each name it exported before its split");

// ---- when a pruning is due ----
const rec = (...ps) => ({ prunings: ps });
ok(generation("claude-opus-5-5") === 5 && generation("Opus 4.8") === 4 && generation("not said") === null, "a model's generation is the first whole number of its id or name");
ok(due({ month: "2026-11", record: rec() }).due && due({ month: "2027-01", record: rec({ at: "2026-11-20", recorded: true }) }).due && due({ month: "2026-01", record: rec({ at: "2025-12-31", recorded: true }) }).due === false,
  "due where none is recorded, and with every second report, across a year too");
const notDue = due({ month: "2026-12", record: rec({ at: "2026-11-20", model: "claude-opus-5-5", recorded: true }) });
ok(!notDue.due && notDue.why.includes("the next is due in 2027-01") && due({ month: "2026-12", record: rec({ at: "2026-11-20", model: "claude-opus-5-5", recorded: true }), model: "claude-opus-6-0" }).due
  && !due({ month: "2026-12", record: rec({ at: "2026-11-20", model: "not said", recorded: true }), model: "claude-opus-6-0" }).due && !due({ month: "2026-12", record: rec({ at: "2026-11-20", model: "claude-opus-5-5", recorded: true }), model: "claude-opus-5-6" }).due,
  "in the month between, due only where the session's model is of a newer generation than the last pruning's, which must be known");
ok(due({ month: "2026-11", record: rec({ at: "2026-09-01", recorded: true }, { at: "2026-11-01" }) }).why === "the pruning begun on 2026-11-01 has no counts recorded yet"
  && due({ month: "2026-12", record: rec({ at: "2026-09-01", recorded: true }, { at: "2026-11-01", recorded: true }) }).due === false,
  "a pruning begun stays due until its counts are recorded, and the next is counted from the last recorded");
ok(/^- Due: no pruning is recorded yet\. .*--set <case> <dir>.*--read.*--record --repo .*reports\/pruning\.json` in a pull request of its own\.$/u.test(said({ month: "2026-11", record: rec() })[0])
  && /^- Not due: the last pruning was in 2026-11; the next is due in 2027-01, or sooner .*--due --model <its id>/u.test(said({ month: "2026-12", record: rec({ at: "2026-11-02", recorded: true }) })[0]),
  "the state report's line says what the session does where one is due, and when the next is where not");

// ---- the rules taken out of a case's core ----
const file = "tasks/x.md", text = "# X\n\n- **First:** one.\n  - **Inner:** its item.\n- **Second:** two.\n\n**Third.** A paragraph.\n\nAfter it.\n";
const all = rulesOf(file, text), cut = without([`${file}: First`, `${file}: Inner`, `${file}: Gone`], all, () => text);
ok(cut.texts[file] === "# X\n\n- **Second:** two.\n\n**Third.** A paragraph.\n\nAfter it.\n" && JSON.stringify(cut.missing) === JSON.stringify([`${file}: Gone`]),
  "a rule is taken out with its items, one inside it goes with it, and a key that is no rule is named", JSON.stringify(cut));
ok(without([`${file}: Third`], all, () => text.replace(/\n/gu, "\r\n")).texts[file] === "# X\n\n- **First:** one.\n  - **Inner:** its item.\n- **Second:** two.\n\n", "a paragraph's rule too, to the next that opens one, read across either line ending");

// ---- the list ----
const steps = { ".github/workflows/tests.yml": [{ name: "A and B", run: "node scripts/a.mjs && node scripts/b.mjs" }, { name: "Its test", run: "node scripts/a-test.mjs" }], ".github/workflows/own.yml": [{ name: "C", run: "node scripts/c.mjs" }, { name: "D", run: "node scripts/d2.mjs" }] };
ok(JSON.stringify(stepsOf("scripts/a.mjs", steps)) === JSON.stringify([".github/workflows/tests.yml#A and B"]) && JSON.stringify(stepsOf(".github/workflows/own.yml", steps)) === JSON.stringify([".github/workflows/own.yml#C", ".github/workflows/own.yml#D"])
  && stepsOf("scripts/d.mjs", steps).length === 0 && JSON.stringify(checksOf("k", { k: ["check: scripts/a.mjs, in part", "audit", "check: GitHub's ruleset"] })) === JSON.stringify(["scripts/a.mjs", "GitHub's ruleset"]),
  "a check's steps are those whose command names it, or every step of its workflow; a rule's checks are those its holders name");
const core = await stepsAt();
ok(core[".github/workflows/tests.yml"].length > 50 && core[".github/workflows/tests.yml"].some(x => x.run.includes("scripts/copies.mjs")) && stepsOf("scripts/holders.mjs", core).length > 0,
  "the core's own workflows are read for their steps, tests.yml's matrix set aside, and a check of the core's is found in a step");
ok(rare({ file: "floor/topics/x.md" }) && rare({ file: "tasks/x.md" }, "check fires; outcome: robust; rare harm") && !rare({ file: "tasks/x.md" }, "check fires; outcome: robust"), "a rule of the floor, or one whose number says so, guards against rare harm");
const out = list({ all: [still, moved, quiet, loud, floor, passed, stand, young, unknown, own, marked, agents], named, numbers, record: rec(...p), cases, steps, starts: new Set([still.key, agents.key]),
  joined: r => (r === young ? 3 : r === unknown ? null : 40) });
const line = r => out.find(l => l.startsWith(`- ${r.key}:`)) ?? "";
ok(out[0] === "- Read: the pruning of 2026-11-01, against 2026-09-01; 2 staged cases run with their rules taken out; counts from 2026-09-01T00:00:00Z (`scripts/pruning.mjs`).", "the list opens with what it read", out[0]);
ok(/^- tasks\/a\.md: Still: its number did not move \(3, as at 2026-09-01\)\. Its step of the pruning: 1, read at a role's start: it moves first to a module read on need\. Its number: findings; outcome: robust; cited 4 times\.$/u.test(line(still)) && !line(moved),
  "a number that did not move is listed, read at a start it moves first, with its number and its citations; one that moved is not", line(still));
ok(/its check never fired from 2026-09-01T00:00:00Z to 2026-11-01 \(\.github\/workflows\/own\.yml#C\)\. Its step of the pruning: 2, read on need: it may go, one moved there only where nothing changed after its move/u.test(line(quiet)) && !line(loud) && !line(floor) && !line(marked),
  "a check whose steps failed nowhere is listed, though another step of its workflow failed; one whose step failed is not; one that guards against rare harm never for its check alone");
ok(/^- AGENTS\.md: A process rule: its number did not move \(2, as at 2026-09-01\)\. Its step of the pruning: 1,/u.test(line(agents)), "a rule of the core's AGENTS.md is listed as any other", line(agents));
ok(/its staged case c-case passed without it/u.test(line(passed)) && !line(still).includes("d-case"), "a case that passed without its rule lists it; one that failed does not");
ok(/its number moved at two prunings while its outcome, asked, did not \(misread: 2\)/u.test(line(stand)) && !line(own), "a stand-in that moved twice while its outcome's direct measures stood is listed, beside them; a direct measure's own count is no stand-in");
ok(JSON.stringify(DIRECT.map(m => m.key)) === JSON.stringify(["misread", "failed"]), "the direct measures a pruning compares are those a count gives, the median of a bug's time to live left out");
const robust = list({ all: [stand], named, numbers: { [stand.key]: "findings; outcome: robust" }, record: rec(...p), cases, steps, starts: new Set(), joined: () => 40 });
const usable = list({ all: [stand], named, numbers: { [stand.key]: "findings; outcome: usable" }, record: rec(...p), cases, steps, starts: new Set(), joined: () => 40 });
ok(!robust.some(l => l.includes("its outcome")) && !usable.some(l => l.includes("its outcome")), "one whose outcome's direct measures moved is not listed, nor one whose outcome has none");
ok(out.includes(`- Too early, not judged (merged pull requests since it joined, under 20): ${young.key} (3).`) && out.includes(`- Not judged, since when it joined could not be read from git: ${unknown.key}.`),
  "a rule too young is not judged, nor one whose joining cannot be read; each is named");
ok(out.includes(`- In use: 2 of 12 rules cited in the span; the most cited: ${still.key} (4), ${loud.key} (1). A citation says a rule is applied, never that it helps.`) && out.includes("- No number named: 4 rules; each names one when it is next added or widened.")
  && /^- The owner decides which go, a few at a time/u.test(out.at(-1)), "the citations stand under \"in use\" and decide nothing; the rules with no number are counted; the owner decides");
ok(list({ all: [still], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40 })[0].startsWith("- No pruning is recorded yet")
  && list({ all: [moved], named, numbers, record: rec(p[2]), cases, steps, starts: new Set(), joined: () => 40 })[1] === "- Nothing listed: no rule shows a sign that it may go.",
  "with no pruning recorded there is nothing to list, and with no sign nothing is listed");

const floorStood = R("floor/security.md", "2. Stood"), rec2 = rec({ at: "2026-09-01", numbers: { [floorStood.key]: 0, [marked.key]: 0 } }, { at: "2026-11-01", numbers: { [floorStood.key]: 0, [marked.key]: 0 }, without: { "f-case": { verdict: "pass" } } });
const guarded = list({ all: [floorStood, marked], named, numbers: { [floorStood.key]: "check fires; outcome: robust", [marked.key]: "check fires; outcome: robust; rare harm" }, record: rec2, cases: [{ name: "f-case", holds: [floorStood.key] }], steps, starts: new Set(), joined: () => 40 });
ok(guarded.some(l => l.startsWith(`- ${floorStood.key}: its staged case f-case passed without it.`)) && !guarded.some(l => l.startsWith(`- ${marked.key}:`)),
  "a rule that guards against rare harm is judged by its staged case alone: a count that stood lists it not, a case that passed without it does");

// ---- the failed steps, read from GitHub's runs and jobs (a mocked gh) ----
const W = ".github/workflows/tests.yml", calls = [];
const runs = [{ id: 1, path: W, conclusion: "success", run_attempt: 1 }, { id: 2, path: W, conclusion: "failure", run_attempt: 1 }, { id: 3, path: W, conclusion: "cancelled", run_attempt: 1 },
  { id: 4, path: W, conclusion: "success", run_attempt: 2 }, { id: 5, path: ".github/workflows/fork.yml", conclusion: "failure", run_attempt: 1 }];
const failedIn = { 2: "A and B", 3: "A and B", 4: "Its test", 5: "Anything a fork names" };
const gh = route => {
  calls.push(route);
  if (route.includes("/actions/runs?")) return JSON.stringify({ workflow_runs: route.includes("page=1") ? runs : [] });
  const id = Number(/runs\/(\d+)\/jobs/u.exec(route)[1]), page = Number(/[?&]page=(\d+)/u.exec(route)?.[1] ?? 1);
  // (run 4 holds a hundred passing jobs on its first page, and its failure on the second)
  if (id === 4 && page === 1) return JSON.stringify({ jobs: Array.from({ length: 100 }, () => ({ steps: [{ name: "C", conclusion: "success" }] })) });
  if (page > 1 && id !== 4) return JSON.stringify({ jobs: [] });
  return JSON.stringify({ jobs: [{ steps: [{ name: failedIn[id], conclusion: "failure" }, { name: "C", conclusion: "success" }] }] });
};
const fired = firedOf({ repo: "o/r", from: "2026-09-01T00:00:00Z", to: "2026-11-01T00:00:00Z", gh, known: new Set([`${W}#A and B`, `${W}#Its test`]) });
ok(JSON.stringify(fired) === JSON.stringify({ [`${W}#A and B`]: 2, [`${W}#Its test`]: 1 }) && !calls.some(c => c.includes("runs/1/jobs")) && calls.filter(c => c.includes("/jobs")).every(c => c.includes("filter=all"))
  && !calls.find(c => c.includes("/actions/runs?")).includes("status="),
  "a failed step counts from a failed run, one a newer push cancelled, and an earlier attempt a re-run passed, every attempt and every page of jobs read; a run that succeeded at once is not read; no step a fork's workflow names is kept", JSON.stringify(fired));

// ---- the pruning in progress ----
const r = rec({ at: "2026-09-01", recorded: true });
const first = open(r, "claude-opus-5-5", "2026-11-01"), again = open(r, null, "2026-11-02");
ok(first === again && first.at === "2026-11-01" && r.prunings.length === 2 && first.model === "claude-opus-5-5", "the cases read on the next day go into the pruning in progress, not a new one");
first.recorded = true;
ok(open(r, null, "2026-11-02").at === "2026-11-02" && r.prunings.length === 3, "once its counts are recorded the pruning ends, and the next read begins another");

// ---- run, a failure says its mend ----
const run = (...a) => spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/pruning.mjs", import.meta.url)), ...a], { encoding: "utf8" });
const bad = [run("--set", "no-such-case", "x"), run("--read", "order-for-now"), run("--record")];
ok(bad.every(r => r.status === 1 && mended(`${r.stdout}${r.stderr}`)), "run, a case that is none, a folder left out and a repository not named each fail, saying the mend", bad.map(r => r.stderr).join("\n"));

console.log(failed ? `${failed} of ${count} failed` : `all ${count} passed`);
process.exit(failed ? 1 : 0);
