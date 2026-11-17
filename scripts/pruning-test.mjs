// Tests of the rules' pruning (pruning.mjs; AGENTS.md, "Rules are pruned by their numbers"; #303): when one is due, the
// rules taken out of a case's core, and the list: each sign, the step, "too early", the floor and "in use". Node's own
// modules only; the calls to gh and git are the script's own and are not made here, save a run that fails.
//
//   node scripts/pruning-test.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";
import { checksOf, due, generation, list, said, without, workflowsOf } from "./pruning.mjs";
import { rulesOf } from "./rules.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

// ---- when a pruning is due ----
const rec = (...ps) => ({ prunings: ps });
ok(generation("claude-opus-5-5") === 5 && generation("Opus 4.8") === 4 && generation("not said") === null, "a model's generation is the first whole number of its id or name");
ok(due({ month: "2026-11", record: rec() }).due && due({ month: "2027-01", record: rec({ at: "2026-11-20" }) }).due && due({ month: "2026-01", record: rec({ at: "2025-12-31" }) }).due === false,
  "due where none is recorded, and with every second report, across a year too");
const notDue = due({ month: "2026-12", record: rec({ at: "2026-11-20", model: "claude-opus-5-5" }) });
ok(!notDue.due && notDue.why.includes("the next is due in 2027-01") && due({ month: "2026-12", record: rec({ at: "2026-11-20", model: "claude-opus-5-5" }), model: "claude-opus-6-0" }).due
  && !due({ month: "2026-12", record: rec({ at: "2026-11-20", model: "not said" }), model: "claude-opus-6-0" }).due && !due({ month: "2026-12", record: rec({ at: "2026-11-20", model: "claude-opus-5-5" }), model: "claude-opus-5-6" }).due,
  "in the month between, due only where the session's model is of a newer generation than the last pruning's, which must be known");
ok(/^- Due: no pruning is recorded yet\. .*--set <case> <dir>.*--read.*--record --repo .*reports\/pruning\.json` in a pull request of its own\.$/u.test(said({ month: "2026-11", record: rec() })[0])
  && /^- Not due: the last pruning was in 2026-11; the next is due in 2027-01, or sooner .*--due --model <its id>/u.test(said({ month: "2026-12", record: rec({ at: "2026-11-02" }) })[0]),
  "the state report's line says what the session does where one is due, and when the next is where not");

// ---- the rules taken out of a case's core ----
const file = "tasks/x.md", text = "# X\n\n- **First:** one.\n  - **Inner:** its item.\n- **Second:** two.\n\n**Third.** A paragraph.\n\nAfter it.\n";
const all = rulesOf(file, text), cut = without([`${file}: First`, `${file}: Inner`, `${file}: Gone`], all, () => text);
ok(cut.texts[file] === "# X\n\n- **Second:** two.\n\n**Third.** A paragraph.\n\nAfter it.\n" && JSON.stringify(cut.missing) === JSON.stringify([`${file}: Gone`]),
  "a rule is taken out with its items, one inside it goes with it, and a key that is no rule is named", JSON.stringify(cut));
ok(without([`${file}: Third`], all, () => text.replace(/\n/gu, "\r\n")).texts[file] === "# X\n\n- **First:** one.\n  - **Inner:** its item.\n- **Second:** two.\n\n", "a paragraph's rule too, to the next that opens one, read across either line ending");

// ---- the list ----
const workflows = { ".github/workflows/tests.yml": "run: node scripts/a.mjs && node scripts/b.mjs", ".github/workflows/own.yml": "run: node scripts/c.mjs" };
ok(JSON.stringify(workflowsOf("scripts/a.mjs", workflows)) === JSON.stringify([".github/workflows/tests.yml"]) && JSON.stringify(workflowsOf(".github/workflows/x.yml", workflows)) === JSON.stringify([".github/workflows/x.yml"])
  && workflowsOf("scripts/d.mjs", workflows).length === 0 && JSON.stringify(checksOf("k", { k: ["check: scripts/a.mjs, in part", "audit", "check: GitHub's ruleset"] })) === JSON.stringify(["scripts/a.mjs", "GitHub's ruleset"]),
  "a check's workflows are those whose text names it, or itself; a rule's checks are those its holders name");
const R = (f, lead) => ({ file: f, lead, key: `${f}: ${lead}` });
const still = R("tasks/a.md", "Still"), moved = R("tasks/a.md", "Moved"), quiet = R("tasks/b.md", "Quiet"), loud = R("tasks/b.md", "Loud"), floor = R("floor/security.md", "1. Floor"),
  passed = R("roles/shared/c.md", "Passed"), stand = R("tasks/d.md", "Stand-in"), young = R("tasks/a.md", "Young"), unknown = R("tasks/a.md", "Unknown"), own = R("tasks/d.md", "Own");
const numbers = { [still.key]: "findings; outcome: robust", [moved.key]: "findings; outcome: robust", [stand.key]: "findings; outcome: asked", [own.key]: "correction: misread; outcome: asked",
  [young.key]: "findings; outcome: robust", [unknown.key]: "findings; outcome: robust" };
const named = { [quiet.key]: "check: scripts/c.mjs", [loud.key]: "check: scripts/a.mjs, in part", [floor.key]: "check: scripts/c.mjs", [still.key]: "check: GitHub's ruleset" };
const p = [
  { at: "2026-07-01", numbers: { [stand.key]: 1, [own.key]: 1 }, outcomes: { misread: 2 } },
  { at: "2026-09-01", numbers: { [still.key]: 3, [moved.key]: 3, [stand.key]: 2, [own.key]: 2, [young.key]: 1, [unknown.key]: 1 }, outcomes: { misread: 2 } },
  { at: "2026-11-01", from: "2026-09-01T00:00:00Z", numbers: { [still.key]: 3, [moved.key]: 4, [stand.key]: 3, [own.key]: 3, [young.key]: 1, [unknown.key]: 1 }, outcomes: { misread: 2 },
    fired: { ".github/workflows/tests.yml": 2 }, cited: { [still.key]: 4, [loud.key]: 1 }, without: { "c-case": { verdict: "pass" }, "d-case": { verdict: "fail" } } },
];
const cases = [{ name: "c-case", holds: [passed.key] }, { name: "d-case", holds: [still.key] }];
const out = list({ all: [still, moved, quiet, loud, floor, passed, stand, young, unknown, own], named, numbers, record: rec(...p), cases, workflows, starts: new Set([still.key]),
  joined: r => (r === young ? 3 : r === unknown ? null : 40) });
const line = r => out.find(l => l.startsWith(`- ${r.key}:`)) ?? "";
ok(out[0] === "- Read: the pruning of 2026-11-01, against 2026-09-01; 2 staged cases run with their rules taken out; counts from 2026-09-01T00:00:00Z (`scripts/pruning.mjs`).", "the list opens with what it read", out[0]);
ok(/^- tasks\/a\.md: Still: its number did not move \(3, as at 2026-09-01\)\. Its step: read at a role's start, so it moves first to a module read on need\. Its number: findings; outcome: robust; cited 4 times\.$/u.test(line(still)) && !line(moved),
  "a number that did not move is listed, read at a start it moves first, with its number and its citations; one that moved is not", line(still));
ok(/its check never fired from 2026-09-01T00:00:00Z to 2026-11-01 \(\.github\/workflows\/own\.yml\)\. Its step: read on need, so it may go/u.test(line(quiet)) && !line(loud) && !line(floor),
  "a check that fired nowhere is listed, one whose workflow failed is not, and one of the floor never for its check alone");
ok(/its staged case c-case passed without it/u.test(line(passed)) && !line(still).includes("d-case"), "a case that passed without its rule lists it; one that failed does not");
ok(/its number moved at two prunings while its outcome, asked, did not \(misread: 2\)/u.test(line(stand)) && !line(own), "a stand-in that moved twice while its outcome stood is listed, beside the outcome; the outcome's own count is no stand-in");
ok(out.includes(`- Too early, not judged (merged pull requests since it joined, under 20): ${young.key} (3).`) && out.includes(`- Not judged, since when it joined could not be read from git: ${unknown.key}.`),
  "a rule too young is not judged, nor one whose joining cannot be read; each is named");
ok(out.includes(`- In use: 2 of 10 rules cited in the span; the most cited: ${still.key} (4), ${loud.key} (1). A citation says a rule is applied, never that it helps.`) && out.includes("- No number named: 4 rules; each names one when it is next added or widened.")
  && /^- The owner decides which go, a few at a time/u.test(out.at(-1)), "the citations stand under \"in use\" and decide nothing; the rules with no number are counted; the owner decides");
ok(list({ all: [still], named, numbers, record: rec(), cases, workflows, starts: new Set(), joined: () => 40 })[0].startsWith("- No pruning is recorded yet")
  && list({ all: [moved], named, numbers, record: rec(p[2]), cases, workflows, starts: new Set(), joined: () => 40 })[1] === "- Nothing listed: no rule shows a sign that it may go.",
  "with no pruning recorded there is nothing to list, and with no sign nothing is listed");

// ---- run, a failure says its mend ----
const run = (...a) => spawnSync(process.execPath, [fileURLToPath(new URL("./pruning.mjs", import.meta.url)), ...a], { encoding: "utf8" });
const bad = [run("--set", "no-such-case", "x"), run("--read", "order-for-now"), run("--record")];
ok(bad.every(r => r.status === 1 && mended(`${r.stdout}${r.stderr}`)), "run, a case that is none, a folder left out and a repository not named each fail, saying the mend", bad.map(r => r.stderr).join("\n"));

console.log(failed ? `${failed} of ${count} failed` : `all ${count} passed`);
process.exit(failed ? 1 : 0);
