// Tests of the rules' pruning (pruning.mjs; AGENTS.md, "Rules are pruned by their numbers"; #303): when one is due, the
// rules taken out of a case's core, and the list: the rules with no holder, which lead it (#545), each sign, the step,
// "too early", the floor and "in use". Node's own modules only; the calls to gh and git are the script's own and are
// not made here, save a run that fails.
//
//   node tests/pruning-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { checksOf, list, rare, readUnheld, stepsOf, without } from "../scripts/pruning-list.mjs";
import { firedOf, stepsAt } from "../scripts/pruning-read.mjs";
import { DIRECT, due, generation, open, said } from "../scripts/pruning-record.mjs";
import { rulesOf } from "../scripts/rules.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

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
const R = (f, lead) => ({ file: f, lead, key: `${f}: ${lead}` });
const marked = R("tasks/b.md", "Marked"), agents = R("AGENTS.md", "A process rule");
const still = R("tasks/a.md", "Still"), moved = R("tasks/a.md", "Moved"), quiet = R("tasks/b.md", "Quiet"), loud = R("tasks/b.md", "Loud"), floor = R("floor/security.md", "1. Floor"),
  passed = R("roles/shared/c.md", "Passed"), stand = R("tasks/d.md", "Stand-in"), young = R("tasks/a.md", "Young"), unknown = R("tasks/a.md", "Unknown"), own = R("tasks/d.md", "Own");
const numbers = { [still.key]: "findings; outcome: robust", [moved.key]: "findings; outcome: robust", [stand.key]: "findings; outcome: asked", [own.key]: "correction: misread; outcome: asked",
  [young.key]: "findings; outcome: robust", [unknown.key]: "findings; outcome: robust", [marked.key]: "check fires; outcome: robust; rare harm", [agents.key]: "findings; outcome: robust" };
const named = { [quiet.key]: "check: scripts/c.mjs", [loud.key]: "check: scripts/a.mjs, in part", [floor.key]: "check: scripts/c.mjs", [marked.key]: "check: scripts/c.mjs", [still.key]: "check: GitHub's ruleset" };
const p = [
  { at: "2026-07-01", numbers: { [stand.key]: 1, [own.key]: 1 }, direct: { misread: 2, failed: 1, live: 3 } },
  { at: "2026-09-01", numbers: { [still.key]: 3, [moved.key]: 3, [stand.key]: 2, [own.key]: 2, [young.key]: 1, [unknown.key]: 1, [agents.key]: 2 }, direct: { misread: 2, failed: 1, live: 3 } },
  { at: "2026-11-01", from: "2026-09-01T00:00:00Z", numbers: { [still.key]: 3, [moved.key]: 4, [stand.key]: 3, [own.key]: 3, [young.key]: 1, [unknown.key]: 1, [agents.key]: 2 }, direct: { misread: 2, failed: 4, live: 3 },
    fired: { ".github/workflows/tests.yml#A and B": 2, ".github/workflows/own.yml#D": 1 }, cited: { [still.key]: 4, [loud.key]: 1 }, without: { "c-case": { verdict: "pass" }, "d-case": { verdict: "fail" } } },
];
const cases = [{ name: "c-case", holds: [passed.key] }, { name: "d-case", holds: [still.key] }];
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

// ---- the rules with no holder lead the list (#545) ----
const bare = R("tasks/e.md", "Bare"), early = R("roles/shared/e.md", "At start"), floorBare = R("floor/security.md", "3. Bare"), unproposed = R("tasks/e.md", "Unproposed");
const proposals = { [bare.key]: { mark: "goes", why: "no breach recorded", noForm: "its breach is in what a session says" }, [early.key]: { mark: "check", by: "#9", why: "a script reads it" },
  [floorBare.key]: { mark: "goes", why: "it costs much", form: "a script reads the file" }, [loud.key]: { mark: "move", why: "held now" }, "tasks/gone.md: Gone": { mark: "case", why: "gone" } };
const led = list({ all: [still, bare, early, floorBare, unproposed, loud], named, numbers, record: rec(...p), cases, steps, starts: new Set([still.key, early.key]), joined: () => 40,
  none: [bare.key, early.key, floorBare.key, unproposed.key], proposals });
const at = k => led.findIndex(l => l.startsWith(`- ${k}:`));
ok(/^- No holder: 4 rules \(`scripts\/holders\.mjs`\), worst first, each with its proposal \(`reports\/unheld\.json`\)\./u.test(led[0])
  && at(early.key) === 1 && at(bare.key) > at(early.key) && at(bare.key) < led.findIndex(l => l.startsWith("- Read:")),
  "the rules with no holder lead the list, ahead of what the pruning read, one read at a role's start first", led.slice(0, 7).join("\n"));
ok(led[at(early.key)] === `- ${early.key}: no holder, read at a role's start. Its proposal: check (#9), a script reads it.` && led[at(bare.key)] === `- ${bare.key}: no holder, read on need. Its proposal: goes, no breach recorded. No form a check could hold: its breach is in what a session says.`,
  "each says where it is read and its proposal, a check with the issue that builds it", `${led[at(early.key)]}\n${led[at(bare.key)]}`);
ok(/^- floor\/security\.md: 3\. Bare: no holder, read on need\. Its proposal: goes, it costs much\. A form a check could hold: a script reads the file\. It guards against rare and severe harm, so it is proposed a holder, a check or a staged case, and nothing else\.$/u.test(led[at(floorBare.key)])
  && /No proposal yet: the session that takes the pruning gives it one in `reports\/unheld\.json`/u.test(led[at(unproposed.key)]),
  "a floor rule proposed to go is said to need a holder instead, and a rule with no proposal is said to need one");
// ---- beside each proposal, a form a check could hold, or why none (#887) ----
const forms = list({ all: [bare, early, still, floorBare, unproposed, loud], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40, none: [bare.key, early.key, still.key, floorBare.key, unproposed.key, loud.key],
  proposals: { [bare.key]: { mark: "move", why: "read rarely" }, [early.key]: { mark: "check", why: "a script reads it" }, [still.key]: { mark: "check", why: "reworded", form: "the file holds the line" }, [floorBare.key]: { mark: "case", why: "a session's act", noForm: "only what a session does shows it" },
    [unproposed.key]: { mark: "describes", why: "binds no one" }, [loud.key]: { mark: "goes", why: "unused", form: "a script reads the line" } } });
const formOf = k => forms.find(l => l.startsWith(`- ${k}:`)) ?? "";
ok(formOf(bare.key).endsWith(" No form proposed yet: the session that takes the pruning gives a form of the rule a check could hold (`form`), or why none exists (`noForm`).")
  && formOf(floorBare.key).endsWith(" No form a check could hold: only what a session does shows it.") && formOf(loud.key).endsWith(" A form a check could hold: a script reads the line.")
  && !/form/iu.test(formOf(early.key)) && !/form/iu.test(formOf(unproposed.key)) && formOf(still.key).endsWith(" A form a check could hold: the file holds the line.")
  && forms.filter(l => / no holder, /u.test(l) && !/check \(|check, |describes, /u.test(l)).every(l => /(A form a check could hold|No form a check could hold|No form proposed yet|a form of the rule a check could hold)/u.test(l)),
  "each rule with no holder carries a form a check could hold or why none exists, or is said to have neither yet; a check, which holds it as worded, and a rule that describes need neither, a check's rewording shown where given", forms.join("\n"));
const tool = R("tools/x.md", "Its own"), floorNone = R("floor/topics/y.md", "Unproposed");
const tooled = list({ all: [bare, tool, floorNone], named, numbers, record: rec(), cases, steps, starts: new Set(), toolStarts: new Set([tool.key]), joined: () => 40, none: [bare.key, tool.key, floorNone.key], proposals });
ok(tooled[1].startsWith(`- ${tool.key}: no holder, read at its tool's start.`) && /^- floor\/topics\/y\.md: Unproposed: no holder, read on need\. No proposal yet: .*a check or staged case that could hold it, since it guards against rare and severe harm, and a form of the rule a check could hold \(`form`\), or why none exists \(`noForm`\)\.$/u.test(tooled.find(l => l.startsWith(`- ${floorNone.key}:`)) ?? ""),
  "a rule of a tool's part, read at its tool's start, comes first, and a floor rule with no proposal is offered only a holder", tooled.join("\n"));
const forged = list({ all: [bare], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40, none: [bare.key],
  proposals: { [bare.key]: { mark: "goes", by: "#1\n- tasks/x.md: Forged", why: "one\n- tasks/y.md: Forged too", form: "two\n- tasks/z.md: Forged" } }, wrong: "`reports/unheld.json` cannot be read (bad). Mend: write it as JSON" });
ok(forged.length === 4 && forged[1].startsWith("- `reports/unheld.json` cannot be read (bad). Mend:") && forged[2] === `- ${bare.key}: no holder, read on need. Its proposal: goes (#1 - tasks/x.md: Forged), one - tasks/y.md: Forged too. A form a check could hold: two - tasks/z.md: Forged.`,
  "a value of the file holding a line break stays on its rule's line, and a file that cannot be read is said with its mend", forged.join("\n"));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "unheld-"));
const at2 = t => { fs.mkdirSync(path.join(scratch, "reports"), { recursive: true }); fs.writeFileSync(path.join(scratch, "reports", "unheld.json"), t); return readUnheld(scratch); };
const none0 = readUnheld(scratch), broken = at2("{"), listed = at2('{"proposals": []}'), good = at2('{"proposals": {"k": {"mark": "goes"}}}');
fs.rmSync(scratch, { recursive: true, force: true });
ok(!none0.wrong && !Object.keys(none0.proposals).length && /Mend: \S+ \S/u.test(broken.wrong) && /Mend: \S+ \S/u.test(listed.wrong) && !Object.keys(listed.proposals).length && !good.wrong && good.proposals.k.mark === "goes",
  "no file reads as no proposals, a file that is no JSON or whose proposals are a list is said with its mend, and a good one is read", JSON.stringify({ broken, listed }));
const lone = list({ all: [bare, floorBare], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40, none: [bare.key, floorBare.key],
  proposals: { [bare.key]: { mark: "check", why: "a script could read it" }, [floorBare.key]: { mark: "move", why: "read rarely" } } });
ok(lone.some(l => l === `- ${bare.key}: no holder, read on need. Its proposal: check, no issue filed yet: the session files one where its upkeep pays, which joins the queue as any check for a rule that stands does, a script could read it.`)
  && lone.some(l => l.startsWith(`- ${floorBare.key}:`) && l.endsWith("so it is proposed a holder, a check or a staged case, and nothing else.")) && !lone.slice(1).some(l => l.includes("the owner's")),
  "a check with no issue is the session's to file, never the owner's, and a floor rule proposed a move is said to need a holder", lone.join("\n"));
ok(led.includes(`- Proposed for a rule that now has a holder or no longer stands, to take out of \`reports/unheld.json\`: ${loud.key}; tasks/gone.md: Gone.`) && !led.some(l => l.startsWith(`- ${loud.key}: no holder`)),
  "a proposal whose rule now has a holder, or is gone, is named to be taken out");
ok(list({ all: [bare], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40, none: [bare.key], proposals: {} }).at(-1).startsWith("- No pruning is recorded yet")
  && list({ all: [bare], named, numbers, record: rec(), cases, steps, starts: new Set(), joined: () => 40, none: [bare.key], proposals: {} })[0].startsWith("- No holder: 1 rule (")
  && list({ all: [still], named, numbers, record: rec(p[2]), cases, steps, starts: new Set(), joined: () => 40 })[0].startsWith("- Read:"),
  "with no pruning recorded the rules with no holder are still listed, and with none the list opens as before");

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
